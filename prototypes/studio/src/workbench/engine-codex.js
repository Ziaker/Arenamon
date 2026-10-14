// Adaptador da Workbench para o motor REAL de Rigging do Codex no Studio.
//
// Contrato consumido (ver WORKBENCH.md):
// - Funções puras de `rigging/core.js`: currentJoints, auditRig, validateDraft e operações de rascunho
//   (via telemetry.js e patch.js), bindDraftToModel (prévia de pesos em cópias).
// - Pontos públicos do Rigging do Codex em `window.__studioRig`: select, applyJoint, renameBone, reparentBone,
//   addBone, deleteBone, draft, exportCoordinates, createTemplate e bind. São os mesmos caminhos da interface do
//   Codex, com histórico e metadados (IDs persistentes, schema v2).
// - Histórico do editor `window.__studioEditor.history`.
//
// Um patch é aplicado como UMA transação: os comandos que o Codex registra durante a aplicação são reunidos num
// único passo de desfazer. A "simulação" do comparador é um ensaio real: aplica com o motor do Codex, mede a
// telemetria e desfaz a transação, conferindo que o rig voltou exatamente ao estado anterior.
import {buildTelemetry, warningDiff, influenceDiff, rigState} from './telemetry.js';
import {parsePatch, simulateOnDraft, diffDrafts, draftFromModel, findJoint, patchFromRigJSON} from './patch.js';
import {validateDraft, modelBounds, applyMirror, bindDraftToModel} from '../rigging/core.js';

/** Operações sem caminho público no motor atual: aparecem como pendentes, nunca como aplicadas. */
export const PENDING_OPS = {
  setRotation: 'Rotação de repouso: o motor do Codex ainda não expõe uma API pública (commitOrientation é interno).',
};
const $ = id => document.getElementById(id);
const toDraftJoints = t => ({joints: t.joints.map(j => ({id: j.id, name: j.name, parent: j.parent, p: j.p, q: j.q}))});

export function createCodexEngine({importer = () => window.__importer, rig = () => window.__studioRig, history = () => window.__studioEditor?.history} = {}) {
  const E = () => importer(), R = () => rig();
  const available = () => !!(E()?.model && R());
  const state = () => rigState(E()?.model, R()?.draft);
  const telemetry = (opts = {}) => buildTelemetry(E().model, {draft: R().draft, clips: E().clips, modelName: E().model?.name || '', ...opts});
  const current = () => draftFromModel(E().model, R().draft);

  /** Validação completa antes de tocar no modelo: estrutura, operações pendentes e motor do Codex (rascunho). */
  function validate(input) {
    const parsed = parsePatch(input);if (!parsed.ok) return {ok: false, stage: 'estrutura', errors: parsed.errors};
    const pending = parsed.patch.ops.map((o, i) => PENDING_OPS[o.op] || (o.op === 'addJoint' && o.q && Math.abs(o.q[3]) < 1 - 1e-9 ? PENDING_OPS.setRotation : null) ? {path: `ops[${i}]`, message: PENDING_OPS[o.op] || PENDING_OPS.setRotation} : null).filter(Boolean);
    if (pending.length) return {ok: false, stage: 'pendente', errors: pending, patch: parsed.patch};
    const before = current(), bounds = modelBounds(E().model);let preexisting = null;
    try {validateDraft(structuredClone(before), bounds);} catch (e) {preexisting = e.message;}
    const sim = simulateOnDraft(before, parsed.patch, bounds);
    if (!sim.ok && !preexisting) return {ok: false, stage: 'motor do Codex', errors: [{path: sim.error.split(':')[0], message: sim.error}], steps: sim.steps, patch: parsed.patch};
    return {ok: true, patch: parsed.patch, steps: sim.steps, draftAfter: sim.after, preexisting};
  }

  /** Executa as operações pelos pontos públicos do Codex. Devolve a transação (comandos reunidos). */
  function runTransaction(patch) {
    const H = history(), r = R(), collected = [], run = H?.run, confirm = window.confirm, mirror = $('rg-mirror'), mirrorWas = mirror?.checked;
    if (H) H.run = cmd => {cmd.redo();collected.push(cmd);return cmd;};
    window.confirm = () => true;if (mirror) mirror.checked = false;
    E().enterRigRest();
    try {
      for (const [i, o] of patch.ops.entries()) {
        const fail = m => {throw Error(`ops[${i}] (${o.op}): ${m}`);};
        const cur = current(), need = ref => findJoint(cur, ref) || fail('osso não encontrado: ' + ref);
        if (o.op === 'setPosition') r.applyJoint(need(o.joint).name, [...o.p]);
        else if (o.op === 'translate') {const j = need(o.joint);r.applyJoint(j.name, j.p.map((v, k) => v + o.delta[k]));}
        else if (o.op === 'mirror') {
          const j = need(o.joint), copy = structuredClone(cur), pair = applyMirror(copy, j.name) || fail('sem par simétrico Left/Right');
          r.applyJoint(pair.name, pair.p);
        } else if (o.op === 'rename') {
          const j = need(o.joint);r.select(j.id);$('rg-name').value = o.name;r.renameBone();
          if (findJoint(current(), j.id)?.name !== o.name) fail($('rg-state')?.textContent || 'o motor recusou o nome');
        } else if (o.op === 'reparent') {
          const j = need(o.joint), parent = o.parent === null ? null : need(o.parent);
          r.select(j.id);$('rg-parent-select').value = parent?.id || '';r.reparentBone();
          if ((findJoint(current(), j.id)?.parent ?? null) !== (parent?.name ?? null)) fail($('rg-state')?.textContent || 'o motor recusou a hierarquia');
        } else if (o.op === 'addJoint') {
          const parent = o.parent === null ? fail('o motor do Codex cria ossos como filhos de um osso existente') : need(o.parent), ids = new Set(cur.joints.map(j => j.id));
          r.select(parent.id);r.addBone();
          const made = current().joints.find(j => !ids.has(j.id)) || fail('o motor não criou o osso');
          r.select(made.id);$('rg-name').value = o.name;r.renameBone();
          if (findJoint(current(), made.id)?.name !== o.name) fail($('rg-state')?.textContent || 'o motor recusou o nome');
          r.applyJoint(o.name, [...o.p]);
        } else if (o.op === 'removeJoint') {
          const j = need(o.joint);r.select(j.id);r.deleteBone();
          if (findJoint(current(), j.id)) fail($('rg-state')?.textContent || 'o motor não excluiu o osso');
        } else fail(PENDING_OPS[o.op] || 'operação não suportada');
      }
    } catch (e) {
      for (const c of [...collected].reverse()) c.undo();
      throw e;
    } finally {
      if (H) H.run = run;window.confirm = confirm;if (mirror) mirror.checked = mirrorWas;
    }
    let first = true;
    return {collected, command: {label: 'Rig Patch' + (patch.description ? ': ' + patch.description : '') + ` (${patch.ops.length} op.)`,
      redo() {if (first) {first = false;return;}for (const c of collected) c.redo();}, undo() {for (const c of [...collected].reverse()) c.undo();}}};
  }

  const fingerprint = t => JSON.stringify(t.joints.map(j => [j.id, j.name, j.parent, j.p, j.q]));

  /** Ensaio real: aplica com o motor do Codex, mede, desfaz e confere a restauração. */
  function dryRun(input) {
    const v = validate(input);if (!v.ok) return v;
    const before = telemetry();let after;
    const tx = runTransaction(v.patch);
    try {after = telemetry();} finally {tx.command.undo();}
    const restored = telemetry();
    if (fingerprint(restored) !== fingerprint(before)) throw Error('O ensaio não restaurou o rig exatamente; nada foi confirmado.');
    return {ok: true, patch: v.patch, before, after, steps: v.steps, preexisting: v.preexisting,
      changes: diffDrafts(toDraftJoints(before), toDraftJoints(after)), warnings: warningDiff(before, after), influence: influenceDiff(before, after)};
  }

  /** Aplica de verdade (uma entrada no histórico). */
  function apply(input) {
    const v = validate(input);if (!v.ok) return v;
    const tx = runTransaction(v.patch), H = history();
    if (H) H.run(tx.command);else window.__studioProject?.markDirty('aplicar Rig Patch');
    window.__studioProject?.markDirty('aplicar Rig Patch');
    return {ok: true, label: tx.command.label, operations: tx.collected.length};
  }

  /** Rascunho (malha sem skin): pesos previstos com o bind REAL do Codex em cópias do modelo, antes e depois. */
  function bindPreview(input) {
    const v = validate(input);if (!v.ok) return v;
    const model = E().model;if (state() !== 'rascunho') return {ok: false, errors: [{path: '(estado)', message: 'Prévia de pesos só se aplica a um rascunho ainda não vinculado.'}]};
    const bindCopy = draft => {const c = model.clone(true);c.traverse(o => {if (o.isMesh) o.geometry = o.geometry.clone();});bindDraftToModel(c, structuredClone(draft));return buildTelemetry(c);};
    const before = bindCopy(current()), after = bindCopy(v.draftAfter);
    return {ok: true, before, after, warnings: warningDiff(before, after), influence: influenceDiff(before, after)};
  }

  return {
    id: 'codex-core', available, state, telemetry, validate, dryRun, apply, bindPreview, current,
    patchFromRigJSON: rig => patchFromRigJSON(rig, current()),
    select: id => R().select(id), selectedId: () => R().selectedId,
    undo: () => history()?.undo(), redo: () => history()?.redo(), historyState: () => history()?.state(),
    // Auto-rig assistido: o que o motor atual oferece (template humanoide e bind), sem prometer o que ainda não existe.
    autoRig: {
      profiles: [
        {id: 'humanoid-20', label: 'Humanoide · 20 ossos', available: true, source: 'makeTemplate (Codex)'},
        {id: 'quadruped-24', label: 'Quadrúpede · 24 ossos', available: false, reason: 'Aguarda o auto-rig aprimorado do Codex.'},
        {id: 'creature-27', label: 'Criatura estilizada · 27 ossos', available: false, reason: 'Aguarda o auto-rig aprimorado do Codex.'},
      ],
      createTemplate: () => R().createTemplate(),
      bind: () => R().bind(),
      uncertainty: null, // o motor atual não informa incerteza por ponto
      regenerateRegion: null, lockJoints: null, // pendentes de API
    },
  };
}
