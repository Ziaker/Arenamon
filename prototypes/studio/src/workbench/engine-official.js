// Adaptador da Workbench para a API OFICIAL de rigging (rigging/telemetry.js, patch.js, autorig.js — commit 56b01a5;
// contrato em docs/CONTRATO_TECNICO_RIGGING.md). Não há mais telemetria nem motor de patch paralelos na Workbench.
//
// O que este adaptador faz, e por quê:
// - Telemetria: `inspectRig` oficial. A Workbench só reorganiza o objeto para a interface (telemetry.js).
// - Validação: `validatePatch` + `simulateRigPatch` oficiais (mais a checagem de campos de patch.js).
// - Aplicar (rig com ossos): `applyRigPatch` oficial com um `undoStack` próprio. A entrada que ele empilha (snapshots
//   antes/depois de ossos, pesos, matrizes de bind e metadados) vira UM comando no histórico do Studio. Depois de
//   aplicar, desfazer ou refazer, `importer.commitRig` atualiza o mapa de repouso do motor do Studio — sem isso,
//   `enterRigRest` restauraria a pose antiga (defeito do `__studioRig.applyPatch`, ver WORKBENCH.md).
// - Comparar: `simulateRigPatch` (sem efeito) + ensaio REAL: aplica com `applyRigPatch`, lê `inspectRig`, desfaz pela
//   própria entrada de undo oficial e confere que ossos, pesos, matrizes e metadados voltaram bit a bit.
// - Rascunhos (sem skin): `applyRigPatch` oficial sobre um contêiner vazio que carrega uma CÓPIA do rascunho em
//   `userData.arenamonRigDraft` — o modelo não é tocado. O rascunho resultante passa por `validateDraft`.
// - Auto-rig: `analyzeGeometry`, `generateHumanoidDraft`, `generateQuadrupedDraft`, `fitDraftToLandmarks` e
//   `regenerateRegion` ('tail') oficiais. A proposta gerada vive na Workbench até o bind (`bindDraftToModel` oficial,
//   no mesmo formato de transação do bind da aba Rigging).
import * as T from 'three';
import {inspectRig} from '../rigging/telemetry.js';
import {simulateRigPatch, applyRigPatch, takeRigSnapshot} from '../rigging/patch.js';
import {analyzeGeometry, generateHumanoidDraft, generateQuadrupedDraft, fitDraftToLandmarks, regenerateRegion} from '../rigging/autorig.js';
import {validateDraft, modelBounds, bindDraftToModel, ensureJointIds, syncRigMetadata} from '../rigging/core.js';
import {rigState, toView, selectTelemetry, warningDiff, influenceDiff, transformChanges} from './telemetry.js';
import {parsePatch, blockedOperations, draftCompatible, patchFromRigJSON} from './patch.js';

/** Perfis do auto-rig oficial. Habilitados após o fluxo completo na interface passar nos testes E2E. */
export const PROFILES = [
  {id: 'humanoid-20', label: 'Humanoide · 20 ossos', kind: 'humanoid', available: true, source: 'generateHumanoidDraft'},
  {id: 'quadruped-24', label: 'Quadrúpede · 24 ossos', kind: 'quadruped', boneCount: 24, available: true, source: 'generateQuadrupedDraft({boneCount: 24})'},
  {id: 'quadruped-27', label: 'Quadrúpede · 27 ossos', kind: 'quadruped', boneCount: 27, available: true, source: 'generateQuadrupedDraft({boneCount: 27})'},
];
/** Regiões regeneráveis: a API oficial só implementa 'tail' (outras regiões devolvem o rascunho inalterado). */
export const REGIONS = [{id: 'tail', label: 'Cauda', available: true}, {id: 'leftArm', label: 'Braço esquerdo', available: false}, {id: 'head', label: 'Cabeça', available: false}];
/** Marcos estimados pela análise oficial que correspondem a pontos do rascunho. */
const LANDMARKS = {head: 'Head', neck: 'Neck', pelvis: 'Hips'};
const POSITIONAL = new Set(['setBonePosition', 'moveBone', 'setBoneQuaternion', 'mirrorBone', 'deleteBone', 'reparentBone', 'renameJoint']);

/** Impressão digital completa do rig: ossos (nome, ID, pai, TRS), pesos, matrizes de bind e metadados. */
export function rigFingerprint(root) {
  const s = takeRigSnapshot(root);
  return JSON.stringify({bones: s.boneStates.map(b => [b.uuid, b.name, b.arenamonJointId, b.parentUuid, b.position, b.quaternion, b.scale]),
    meshes: s.meshes.map(m => [m.uuid, m.isSkinned, m.skinIndex && Array.from(m.skinIndex), m.skinWeight && Array.from(m.skinWeight), m.boneInverses?.map(x => x.elements), m.skeletonBoneUuids]),
    metadata: s.metadata, draft: s.draft});
}

/**
 * simulateRigPatch oficial não detecta ciclos: reparentar um osso sob um descendente passa na simulação e o apply
 * estoura a pilha (com rollback). Esta checagem percorre a hierarquia prevista antes de chamar a API.
 */
export function hierarchyCycle(patch, joints, view) {
  const parent = new Map(view.map(j => [j.id, j.parentId])), resolve = ref => joints.find(j => j.id === ref)?.id || joints.find(j => j.name === ref)?.id || ref;
  for (const [i, o] of patch.operations.entries()) {
    if (o.op === 'createBone') parent.set(o.id || `novo:${o.name}`, o.parent ? resolve(o.parent) : null);
    if (o.op === 'deleteBone') {const id = resolve(o.jointId), up = parent.get(id) ?? null;for (const [k, v] of parent) if (v === id) parent.set(k, up);parent.delete(id);}
    if (o.op !== 'reparentBone') continue;
    const id = resolve(o.jointId), target = o.newParentJointId ? resolve(o.newParentJointId) : null;
    for (let p = target, guard = 0; p && guard <= parent.size; p = parent.get(p), guard++) if (p === id) return {path: `operations[${i}]`, message: `Ciclo na hierarquia: ${o.newParentJointId} é o próprio osso ou descendente de ${o.jointId}.`};
    parent.set(id, target);
  }
  return null;
}

export function createOfficialEngine({importer = () => globalThis.__importer, rig = () => globalThis.__studioRig, history = () => globalThis.__studioEditor?.history, onChange = () => {}} = {}) {
  const E = () => importer(), R = () => rig(), $ = id => globalThis.document?.getElementById(id);
  const S = {proposal: null, profile: null, locked: new Set(), analysis: null};
  const model = () => E()?.model;
  const available = () => !!(model() && R());
  /** 'proposta' = rascunho gerado pelo auto-rig da Workbench, ainda não vinculado. */
  const state = () => S.proposal ? 'proposta' : rigState(model(), R()?.draft);
  const draftNow = () => S.proposal || R()?.draft || null;
  const kind = () => ({vinculado: 'bound', 'ossos-sem-skin': 'bound', proposta: 'draft', rascunho: 'draft'})[state()] || null;
  const official = (opts = {}) => inspectRig(model(), {draft: state() === 'vinculado' || state() === 'ossos-sem-skin' ? null : draftNow(), clips: E().clips, ...opts});
  const view = (t = official()) => toView(t, {state: state(), clips: E().clips});
  const telemetry = ({select} = {}) => select ? selectTelemetry(official(), select) : view();
  const current = () => view().joints.map(j => ({id: j.id, name: j.name, p: j.p}));
  const notify = reason => {try {onChange(reason);} catch (e) {console.warn(e);}};
  // commitRig atualiza o mapa de repouso do Studio, mas também recalcula as matrizes de bind a partir da pose. Depois de
  // restaurar um snapshot (undo/redo), as matrizes corretas são as do snapshot — num GLB importado elas diferem do
  // recálculo na última casa decimal. Por isso são preservadas em volta do commitRig.
  const syncStudio = reason => {
    const keep = [];model().traverse(o => {if (o.isSkinnedMesh && o.skeleton) keep.push([o.skeleton, o.skeleton.boneInverses.map(m => m.clone())]);});
    E().commitRig({reason, emitDirty: false});
    for (const [sk, inv] of keep) {sk.boneInverses = inv;sk.update?.();}
    try {const id = R()?.selectedId;if (id) R().select(id);} catch {/* osso selecionado pode não existir mais */}
  };

  /** Rascunho → aplica o patch oficial numa cópia (contêiner vazio) e valida o resultado. */
  function applyToDraft(draft, patch) {
    const carrier = new T.Group();carrier.userData.arenamonRigDraft = ensureJointIds(structuredClone(draft));
    applyRigPatch(carrier, draftCompatible(patch, draft.joints), {draft: carrier.userData.arenamonRigDraft});
    const next = ensureJointIds(structuredClone(carrier.userData.arenamonRigDraft));
    validateDraft(next, modelBounds(model()));
    return next;
  }

  /** Validação: estrutura/migração, limites comprovados, travas e `simulateRigPatch` oficial. */
  function validate(input) {
    if (!available()) return {ok: false, stage: 'modelo', errors: [{path: '(modelo)', message: 'Nenhum modelo carregado.'}]};
    const parsed = parsePatch(input, {joints: current()});
    if (!parsed.ok) return {ok: false, stage: 'estrutura', errors: parsed.errors, migration: parsed.migration};
    const k = kind();
    if (!k) return {ok: false, stage: 'estado', errors: [{path: '(estado)', message: 'O modelo ainda não tem rig: gere uma proposta no auto-rig.'}], patch: parsed.patch, migration: parsed.migration};
    const blocked = blockedOperations(parsed.patch, k);
    if (k === 'draft' && S.proposal) parsed.patch.operations.forEach((o, i) => {
      const j = o.jointId && current().find(x => x.id === o.jointId || x.name === o.jointId);
      if (j && POSITIONAL.has(o.op) && S.locked.has(j.id)) blocked.push({path: `operations[${i}]`, message: `${o.op}: o osso ${j.name} está travado na proposta.`});
    });
    if (blocked.length) return {ok: false, stage: 'pendente', errors: blocked, patch: parsed.patch, migration: parsed.migration};
    let simulation;
    try {simulation = simulateRigPatch(model(), parsed.patch, {draft: k === 'draft' ? draftNow() : null, clips: E().clips});}
    catch (e) {return {ok: false, stage: 'simulateRigPatch', errors: [{path: '(simulateRigPatch)', message: e.message}], patch: parsed.patch, migration: parsed.migration};}
    if (!simulation.valid) return {ok: false, stage: 'simulateRigPatch', errors: simulation.errors.map(m => ({path: /\[Op (\d+)/.exec(m) ? `operations[${/\[Op (\d+)/.exec(m)[1]}]` : '(simulação)', message: m})), patch: parsed.patch, migration: parsed.migration, simulation};
    const cycle = hierarchyCycle(parsed.patch, current(), view().joints);
    if (cycle) return {ok: false, stage: 'hierarquia', errors: [cycle], patch: parsed.patch, migration: parsed.migration, simulation};
    return {ok: true, patch: parsed.patch, migration: parsed.migration, simulation, kind: k};
  }

  /** Comparar: ensaio real. O modelo (ou o rascunho) não muda; a restauração é conferida bit a bit. */
  function dryRun(input) {
    const v = validate(input);if (!v.ok) return v;
    const root = model(), beforeFp = rigFingerprint(root), before = view();
    let after, draftAfter = null;
    if (v.kind === 'draft') {
      try {draftAfter = applyToDraft(draftNow(), v.patch);} catch (e) {return {...v, ok: false, stage: 'applyRigPatch (rascunho)', errors: [{path: '(motor oficial)', message: e.message}]};}
      after = toView(inspectRig(root, {draft: draftAfter, clips: E().clips}), {state: state(), clips: E().clips});
    } else {
      E().enterRigRest();
      const stack = [];
      try {
        applyRigPatch(root, v.patch, {clips: E().clips, undoStack: {push: e => stack.push(e)}});
        after = view();
      } catch (e) {return {...v, ok: false, stage: 'applyRigPatch', errors: [{path: '(motor oficial)', message: e.message}]};}
      finally {if (stack[0]) stack[0].undo();}
      if (stack.length !== 1) throw Error(`applyRigPatch empilhou ${stack.length} entradas de desfazer; esperado 1.`);
    }
    const restored = rigFingerprint(root) === beforeFp;
    if (!restored) throw Error('O ensaio não restaurou o rig exatamente (ossos, pesos, matrizes ou metadados); nada foi confirmado.');
    return {ok: true, patch: v.patch, migration: v.migration, simulation: v.simulation, kind: v.kind, before, after, draftAfter, restored,
      changes: transformChanges(before, after), warnings: warningDiff(before, after), influence: influenceDiff(before, after)};
  }

  /** Aplica de verdade: UMA entrada no histórico do Studio. */
  function apply(input) {
    const v = validate(input);if (!v.ok) return v;
    if (v.kind === 'draft' && !S.proposal) return {ok: false, stage: 'rascunho da aba Rigging', errors: [{path: '(estado)', message: 'A API oficial não sincroniza o rascunho da aba Rigging. Use “Editar este rascunho na Workbench” no auto-rig (vira uma proposta) ou corrija na aba Rigging.'}]};
    const label = 'Rig Patch' + (v.patch.description ? ': ' + v.patch.description : '') + ` (${v.patch.operations.length} op.)`;
    if (v.kind === 'draft') {let next;try {next = applyToDraft(S.proposal, v.patch);} catch (e) {return {ok: false, stage: 'applyRigPatch (rascunho)', errors: [{path: '(motor oficial)', message: e.message}]};}setProposal(next, label);return {ok: true, label, entries: 1};}
    const root = model();let entry = null, result = null;
    const command = {label,
      redo() {
        E().enterRigRest();
        if (!entry) {const stack = [];result = applyRigPatch(root, v.patch, {clips: E().clips, undoStack: {push: e => stack.push(e)}});if (stack.length !== 1) throw Error(`applyRigPatch empilhou ${stack.length} entradas.`);entry = stack[0];}
        else entry.redo();
        syncStudio(label);
      },
      undo() {E().enterRigRest();entry.undo();syncStudio('desfazer ' + label);},
    };
    try {const H = history();if (H) H.run(command);else command.redo();}
    catch (e) {return {ok: false, stage: 'applyRigPatch', errors: [{path: '(motor oficial)', message: e.message}]};}
    globalThis.__studioProject?.markDirty?.('aplicar Rig Patch');
    return {ok: true, label, entries: 1, warnings: result?.warnings || []};
  }

  /** Prévia de pesos (rascunho/proposta): bind oficial em CÓPIAS do modelo, antes e depois do patch. */
  function bindPreview(input) {
    const v = validate(input);if (!v.ok) return v;
    if (v.kind !== 'draft') return {ok: false, errors: [{path: '(estado)', message: 'Prévia de pesos só se aplica a um rascunho ainda não vinculado.'}]};
    const bindCopy = draft => {const c = model().clone(true);c.traverse(o => {if (o.isMesh) o.geometry = o.geometry.clone();});bindDraftToModel(c, structuredClone(draft));return toView(inspectRig(c, {clips: E().clips}), {state: 'vinculado', clips: E().clips});};
    const before = bindCopy(draftNow()), after = bindCopy(applyToDraft(draftNow(), v.patch));
    return {ok: true, before, after, warnings: warningDiff(before, after), influence: influenceDiff(before, after)};
  }

  // ---------- Auto-rig (proposta da Workbench) ----------
  function setProposal(next, label, {profile} = {}) {
    const prev = {proposal: S.proposal && structuredClone(S.proposal), profile: S.profile, locked: [...S.locked]};
    const after = {proposal: next && structuredClone(next), profile: profile === undefined ? S.profile : profile, locked: next ? [...S.locked].filter(id => next.joints.some(j => j.id === id)) : []};
    const put = s => {S.proposal = s.proposal && structuredClone(s.proposal);S.profile = s.profile;S.locked = new Set(s.locked);notify(label);};
    const command = {label, redo: () => put(after), undo: () => put(prev)};
    const H = history();if (H) H.run(command);else command.redo();
  }
  const canPropose = () => ['sem-rig', 'rascunho', 'proposta'].includes(state());
  function analysis() {return S.analysis = analyzeGeometry(model());}
  function generate(profileId) {
    const p = PROFILES.find(x => x.id === profileId);if (!p?.available) throw Error('Perfil indisponível: ' + profileId);
    if (!canPropose()) throw Error('O modelo já tem ossos; a proposta automática só vale para malhas sem rig.');
    const b = modelBounds(model()), an = analysis();
    const draft = ensureJointIds(p.kind === 'quadruped' ? generateQuadrupedDraft(b, an, {boneCount: p.boneCount}) : generateHumanoidDraft(b, an));
    validateDraft(structuredClone(draft), b);
    setProposal(draft, `Auto-rig: ${p.label}`, {profile: p.id});
    return draft;
  }
  function adoptDraft() {
    if (state() !== 'rascunho') throw Error('Não há rascunho da aba Rigging para editar.');
    setProposal(ensureJointIds(structuredClone(R().draft)), 'Editar rascunho na Workbench', {profile: 'rigging'});
  }
  function toggleLock(id) {
    if (!S.proposal?.joints.some(j => j.id === id)) throw Error('Travas valem para pontos da proposta do auto-rig.');
    S.locked.has(id) ? S.locked.delete(id) : S.locked.add(id);notify('trava');
  }
  const lockedNames = () => S.proposal.joints.filter(j => S.locked.has(j.id)).map(j => j.name);
  function regenerate(region) {
    if (!S.proposal) throw Error('Gere uma proposta antes.');
    const r = REGIONS.find(x => x.id === region);if (!r?.available) throw Error('Região não implementada pela API oficial: ' + region);
    if (!S.proposal.joints.some(j => j.name.startsWith('Tail'))) throw Error('A proposta atual não tem cauda (perfil quadrúpede).');
    const next = regenerateRegion(structuredClone(S.proposal), modelBounds(model()), region, {lockedJoints: lockedNames()});
    validateDraft(structuredClone(next), modelBounds(model()));
    setProposal(ensureJointIds(next), `Regenerar região: ${r.label}`);
  }
  /** Ajusta os pontos aos marcos estimados por analyzeGeometry; respeita os ossos travados. */
  function fitLandmarks() {
    if (!S.proposal) throw Error('Gere uma proposta antes.');
    const an = analysis(), landmarks = {};
    for (const [region, name] of Object.entries(LANDMARKS)) {const c = an.candidateRegions?.[region]?.estimatedCenter;if (c && S.proposal.joints.some(j => j.name === name)) landmarks[name] = c;}
    const result = fitDraftToLandmarks(structuredClone(S.proposal), landmarks, {lockedJoints: [...S.locked, ...lockedNames()]});
    validateDraft(structuredClone(result.draft), modelBounds(model()));
    setProposal(ensureJointIds(result.draft), `Ajustar aos marcos (${result.modifiedCount})`);
    return {modified: result.modifiedJoints, landmarks: Object.keys(landmarks)};
  }
  function discard() {if (S.proposal) setProposal(null, 'Descartar proposta do auto-rig', {profile: null});}
  /** Vincula a proposta com o bind oficial; desfazer devolve o modelo e a proposta (mesma transação da aba Rigging). */
  function bind() {
    if (!S.proposal) throw Error('Gere uma proposta antes.');
    if (E().clips.length) throw Error('Remova as animações antes do bind (mesma regra da aba Rigging).');
    const root = model(), draft = structuredClone(S.proposal), profile = S.profile, locked = [...S.locked], smoothness = Number($('rg-smooth')?.value) || .13;
    const previousRig = root.userData.arenamonRig ? structuredClone(root.userData.arenamonRig) : null, previousDraft = root.userData.arenamonRigDraft ? structuredClone(root.userData.arenamonRigDraft) : null;
    let result = null, bound = null;
    const command = {label: 'Vincular proposta do auto-rig',
      redo() {
        if (!result) result = bindDraftToModel(root, structuredClone(draft), {smoothness});
        else {for (const p of result.replacements) {p.parent.add(p.mesh);p.old.removeFromParent();}for (const b of result.bones.filter(b => !b.parent)) root.add(b);root.userData.arenamonRig = structuredClone(bound);}
        delete root.userData.arenamonRigDraft;
        E().commitRig({replacements: result.replacements, reason: 'vincular proposta do auto-rig', emitDirty: false});
        bound = structuredClone(syncRigMetadata(root, root.userData.arenamonRig));
        S.proposal = null;S.locked = new Set();notify('bind');
      },
      undo() {
        for (const p of result.replacements) {p.parent.add(p.old);p.mesh.removeFromParent();}
        for (const b of result.bones) if (b.parent === root) b.removeFromParent();
        E().commitRig({replacements: result.replacements.map(p => ({old: p.mesh, mesh: p.old})), reason: 'desfazer vínculo da proposta', emitDirty: false});
        if (previousRig) root.userData.arenamonRig = structuredClone(previousRig);else delete root.userData.arenamonRig;
        if (previousDraft) root.userData.arenamonRigDraft = structuredClone(previousDraft);else delete root.userData.arenamonRigDraft;
        S.proposal = structuredClone(draft);S.profile = profile;S.locked = new Set(locked);notify('desfazer bind');
      },
    };
    const H = history();if (H) H.run(command);else command.redo();
    globalThis.__studioProject?.markDirty?.('vincular proposta do auto-rig');
    return result;
  }

  return {
    id: 'official-56b01a5', available, state, kind, telemetry, official, validate, dryRun, apply, bindPreview, current,
    patchFromRigJSON: rigJSON => patchFromRigJSON(rigJSON, current()),
    select: id => R()?.select(id), selectedId: () => R()?.selectedId,
    undo: () => history()?.undo(), redo: () => history()?.redo(), historyState: () => history()?.state(),
    reset() {S.proposal = null;S.profile = null;S.locked = new Set();S.analysis = null;},
    autoRig: {
      profiles: PROFILES, regions: REGIONS, generate, adoptDraft, toggleLock, regenerate, fitLandmarks, discard, bind, canPropose, analysis,
      get proposal() {return S.proposal;}, get profile() {return S.profile;}, get locked() {return [...S.locked];},
      /** Confiança por REGIÃO informada por analyzeGeometry (a API não informa incerteza por ponto). */
      get regionConfidence() {const c = S.analysis?.candidateRegions;return c ? Object.entries(c).filter(([, r]) => r && typeof r.confidence === 'number').map(([name, r]) => ({region: name, confidence: r.confidence, estimated: !!r.isEstimated})) : null;},
      testDeformation: () => globalThis.__studioLayout?.open('rigging'),
    },
  };
}
