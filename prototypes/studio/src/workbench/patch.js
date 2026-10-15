// Rig Patch na Workbench: contrato CANÔNICO da API oficial (`rigging/patch.js`, docs/CONTRATO_TECNICO_RIGGING.md):
//   {"schema":"arenamon-rig-patch","version":1,"targetModel"?,"description"?,"operations":[{op, ...}]}
//
// Este módulo não executa nada no modelo. Ele:
// 1. Lê o JSON (erro de sintaxe com número da linha).
// 2. Migra EXPLICITAMENTE o formato anterior da Workbench (`ops`: setPosition, translate, …) para `operations`,
//    devolvendo um relatório linha a linha que a interface mostra antes de qualquer validação.
// 3. Confere o patch com `validatePatch` oficial (desde 249e34b ele valida cada campo e aponta o caminho, como
//    `operations[2].position`); a Workbench só converte a mensagem em itens {path, message} para a interface.
// 4. Marca operações que a API aceita mas que não funcionam no estado atual do rig (ver OP_LIMITS).
// A migração daqui preserva a posição na raiz em `reparent`/`addJoint`; `migrateWorkbenchPatch` oficial não preserva.
import {validatePatch} from '../rigging/patch.js';

export const PATCH_SCHEMA = 'arenamon-rig-patch';
/**
 * Limites comprovados da API oficial (249e34b) — ver test/workbench.test.mjs e WORKBENCH.md.
 * `all`: bloqueada em qualquer estado. `bound`: bloqueada em rig vinculado. `draft`: bloqueada em rascunho/proposta.
 */
export const OP_LIMITS = {
  deleteBone: {bound: 'em rig vinculado, deleteBone da API oficial remove o osso da paleta sem remapear skinIndex: os pesos dos ossos seguintes passam a apontar para o osso errado. Exclua pela aba Rigging ou antes do bind.'},
  mirrorBone: {draft: 'em rascunho, mirrorBone da API oficial não altera o ponto (só atua em ossos reais).'},
  correctSymmetry: {draft: 'em rascunho, correctSymmetry da API oficial não altera os pontos (só atua em ossos reais).'},
  recomputeBindMatrices: {draft: 'rascunho ainda sem skin: não há matrizes de bind.'},
  normalizeSkinWeights: {draft: 'rascunho ainda sem skin: não há pesos.'},
  modifyVertexWeights: {draft: 'rascunho ainda sem skin: não há pesos.'},
};
const findJoint = (joints, ref) => joints.find(j => j.id === ref) || joints.find(j => j.name === ref) || null;

/** Formato anterior da Workbench (campo `ops`). Usado só pela migração. */
export const LEGACY_OPS = ['setPosition', 'translate', 'setRotation', 'rename', 'reparent', 'addJoint', 'removeJoint', 'mirror'];
let legacySeq = 0;

/**
 * Migração explícita `ops` → `operations`. `joints` = articulações atuais [{id, name, p}] (para preservar a semântica
 * antiga de `reparent`, que mantinha a posição no espaço da raiz, e de `addJoint`, cujo `p` era no espaço da raiz).
 * Devolve {patch, report: [{from, to: [...], note}], errors}.
 */
export function migrateLegacyPatch(legacy, joints = []) {
  const operations = [], report = [], errors = [];
  const {ops, space, ...rest} = legacy;
  if (space !== undefined && space !== 'model-root') errors.push({path: 'space', message: 'O formato anterior só aceitava "model-root".'});
  if (!Array.isArray(ops) || !ops.length) errors.push({path: 'ops', message: 'Esperado um array "ops" com pelo menos uma operação.'});
  (Array.isArray(ops) ? ops : []).forEach((o, i) => {
    const at = `ops[${i}]`, out = [];let note = '';
    if (!o || typeof o !== 'object') {errors.push({path: at, message: 'Operação deve ser um objeto.'});return;}
    const keep = o.note ? {note: o.note} : {};
    switch (o.op) {
      case 'setPosition': out.push({op: 'setBonePosition', jointId: o.joint, position: o.p, space: 'model-root', ...keep});break;
      case 'translate': out.push({op: 'moveBone', jointId: o.joint, delta: o.delta, space: 'model-root', ...keep});break;
      case 'setRotation': out.push({op: 'setBoneQuaternion', jointId: o.joint, quaternion: o.q, ...keep});break;
      case 'rename': out.push({op: 'renameJoint', jointId: o.joint, newName: o.name, ...keep});break;
      case 'mirror': out.push({op: 'mirrorBone', jointId: o.joint, ...keep});break;
      case 'removeJoint': out.push({op: 'deleteBone', jointId: o.joint, reparentChildren: true, ...keep});break;
      case 'reparent': {
        const j = findJoint(joints, o.joint);
        out.push({op: 'reparentBone', jointId: o.joint, newParentJointId: o.parent, ...keep});
        if (j) {out.push({op: 'setBonePosition', jointId: j.id, position: [...j.p], space: 'model-root'});note = 'reparentBone oficial mantém a posição LOCAL; a migração acrescenta setBonePosition com a posição atual no espaço da raiz, como o formato anterior fazia.';}
        else note = 'Osso não encontrado no rig atual: a posição não pôde ser preservada.';
        break;
      }
      case 'addJoint': {
        // createBone oficial grava `position` como LOCAL ao pai num rig vinculado; o `p` antigo era no espaço da raiz.
        const id = `joint-mig-${Date.now().toString(36)}-${(++legacySeq).toString(36)}`;
        out.push({op: 'createBone', id, name: o.name, parent: o.parent, position: o.p, ...(o.q ? {quaternion: o.q} : {}), ...keep});
        out.push({op: 'setBonePosition', jointId: id, position: o.p, space: 'model-root'});
        note = `ID persistente atribuído ao osso novo: ${id}. setBonePosition garante a posição no espaço da raiz.`;
        break;
      }
      default: errors.push({path: at + '.op', message: `Operação desconhecida no formato anterior ${JSON.stringify(o.op)}. Use: ${LEGACY_OPS.join(', ')}.`});return;
    }
    report.push({from: `${at} ${o.op}`, to: out.map((x, k) => `operations[${operations.length + k}] ${x.op}`), note});
    operations.push(...out);
  });
  return {patch: {...rest, operations}, report, errors};
}

/** Lê, migra (se preciso) e valida a estrutura. Devolve {ok, errors: [{path, message}], patch, migration}. */
export function parsePatch(input, {joints = []} = {}) {
  let patch = input, migration = null;
  if (typeof input === 'string') {
    try {patch = JSON.parse(input);} catch (e) {
      const m = /position (\d+)/.exec(e.message), pos = m ? Number(m[1]) : null, line = pos === null ? null : input.slice(0, pos).split('\n').length;
      return {ok: false, errors: [{path: line ? `linha ${line}` : '(JSON)', message: 'JSON inválido: ' + e.message}], patch: null};
    }
  }
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return {ok: false, errors: [{path: '(raiz)', message: 'Esperado um objeto JSON.'}], patch: null};
  if (patch.ops !== undefined && patch.operations !== undefined) return {ok: false, errors: [{path: '(raiz)', message: 'O patch tem "ops" (formato anterior) e "operations" (canônico) ao mesmo tempo; use só "operations".'}], patch: null};
  if (patch.ops !== undefined) {
    const m = migrateLegacyPatch(patch, joints);migration = {from: 'ops', report: m.report};
    if (m.errors.length) return {ok: false, errors: m.errors, patch: null, migration};
    patch = m.patch;
  }
  const errors = [];
  try {validatePatch(patch);} catch (e) {
    // A mensagem oficial tem uma linha "- operations[0].position: esperado …" por erro: um item por linha.
    const lines = e.message.split('\n').filter(l => l.startsWith('- '));
    if (lines.length) for (const l of lines) {const m = /^- ([^:]+): (.*)$/.exec(l);errors.push(m ? {path: m[1], message: m[2]} : {path: '(validatePatch)', message: l.slice(2)});}
    else errors.push({path: '(validatePatch)', message: e.message});
  }
  if (Array.isArray(patch.operations) && !patch.operations.length) errors.push({path: 'operations', message: 'Esperado pelo menos uma operação.'});
  return {ok: !errors.length, errors, patch, migration};
}

/** Operações do patch bloqueadas no estado do rig ('bound' | 'draft'), com o motivo comprovado. */
export function blockedOperations(patch, kind) {
  return patch.operations.map((o, i) => {const l = OP_LIMITS[o.op];const why = l && (l.all || l[kind]);return why ? {path: `operations[${i}]`, message: `${o.op}: ${why}`} : null;}).filter(Boolean);
}

/**
 * Compatibilidade de rascunho: em rascunho, createBone oficial grava `parent` exatamente como recebido, e o rascunho
 * referencia pais pelo NOME. Converte `parent` de ID para nome (sem mudar o significado).
 */
export function draftCompatible(patch, joints) {
  const copy = structuredClone(patch), names = new Map(joints.map(j => [j.id, j.name]));
  for (const o of copy.operations) if (o.op === 'createBone' && o.parent && names.has(o.parent)) o.parent = names.get(o.parent);
  return copy;
}

/** Converte um JSON de coordenadas do Codex (`arenamon-rig`) num patch canônico de setBonePosition. */
export function patchFromRigJSON(rig, joints) {
  if (rig?.schema !== 'arenamon-rig' || !Array.isArray(rig.joints)) throw Error('Esperado um JSON de coordenadas "arenamon-rig" com joints.');
  const operations = [];
  for (const j of rig.joints) {
    const target = (j.id && findJoint(joints, j.id)) || findJoint(joints, j.name);
    if (!target) throw Error(`Osso do JSON não existe no rig atual: ${j.name}`);
    // inspectRig arredonda posições a 5 casas: diferenças menores que isso não são correções.
    if (j.p.some((v, k) => Math.abs(v - target.p[k]) > 1e-5)) operations.push({op: 'setBonePosition', jointId: target.id, position: [...j.p], space: 'model-root'});
  }
  return {schema: PATCH_SCHEMA, version: 1, description: 'Coordenadas importadas de JSON arenamon-rig', operations};
}
