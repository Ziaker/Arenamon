// Rig Patch na Workbench: contrato CANÔNICO da API oficial (`rigging/patch.js`, docs/CONTRATO_TECNICO_RIGGING.md):
//   {"schema":"arenamon-rig-patch","version":1,"targetModel"?,"description"?,"operations":[{op, ...}]}
//
// Este módulo não executa nada no modelo. Ele:
// 1. Lê o JSON (erro de sintaxe com número da linha).
// 2. Migra EXPLICITAMENTE o formato anterior da Workbench (`ops`: setPosition, translate, …) para `operations`,
//    devolvendo um relatório linha a linha que a interface mostra antes de qualquer validação.
// 3. Confere o patch com `validatePatch` oficial e complementa com a checagem de campos (tipos e caminhos como
//    `operations[2].position`), que o validador oficial não faz.
// 4. Marca operações que a API oficial aceita mas que não funcionam no estado atual do rig (ver OP_LIMITS).
import {validatePatch} from '../rigging/patch.js';

export const PATCH_SCHEMA = 'arenamon-rig-patch';
/** Campos de cada operação canônica. `ref` = ID persistente (jointId) ou nome do osso. */
export const OP_FIELDS = {
  setBonePosition: {required: {jointId: 'ref', position: 'vec3'}, optional: {space: 'space'}},
  moveBone: {required: {jointId: 'ref', delta: 'vec3'}, optional: {space: 'space'}},
  setBoneQuaternion: {required: {jointId: 'ref', quaternion: 'quat'}},
  renameJoint: {required: {jointId: 'ref', newName: 'name'}},
  createBone: {required: {name: 'name'}, optional: {id: 'name', parent: 'refOrNull', position: 'vec3', quaternion: 'quat'}},
  deleteBone: {required: {jointId: 'ref'}, optional: {reparentChildren: 'bool'}},
  reparentBone: {required: {jointId: 'ref', newParentJointId: 'refOrNull'}},
  mirrorBone: {required: {jointId: 'ref'}, optional: {symmetryCenter: 'number'}},
  correctSymmetry: {required: {}, optional: {referenceSide: 'side'}},
  recomputeBindMatrices: {required: {}},
  normalizeSkinWeights: {required: {}, optional: {meshName: 'name'}},
  modifyVertexWeights: {required: {meshName: 'name', vertexIndex: 'index', influences: 'influences'}},
  setRestPose: {required: {jointId: 'ref'}, optional: {position: 'vec3', quaternion: 'quat'}},
  recomputeSkinningWeights: {required: {}},
};
/**
 * Limites comprovados da API oficial (56b01a5) — ver testes `workbench-official` e WORKBENCH.md.
 * `all`: bloqueada em qualquer estado. `bound`: bloqueada em rig vinculado. `draft`: bloqueada em rascunho/proposta.
 */
export const OP_LIMITS = {
  setRestPose: {all: 'a API oficial aceita setRestPose na validação, mas applyRigPatch não a executa (o rig não muda).'},
  recomputeSkinningWeights: {all: 'a API oficial aceita recomputeSkinningWeights na validação, mas applyRigPatch não a executa.'},
  deleteBone: {bound: 'em rig vinculado, deleteBone da API oficial remove o osso da paleta sem remapear skinIndex: os pesos dos ossos seguintes passam a apontar para o osso errado. Exclua pela aba Rigging ou antes do bind.'},
  mirrorBone: {draft: 'em rascunho, mirrorBone da API oficial não altera o ponto (só atua em ossos reais).'},
  correctSymmetry: {draft: 'em rascunho, correctSymmetry da API oficial não altera os pontos (só atua em ossos reais).'},
  recomputeBindMatrices: {draft: 'rascunho ainda sem skin: não há matrizes de bind.'},
  normalizeSkinWeights: {draft: 'rascunho ainda sem skin: não há pesos.'},
  modifyVertexWeights: {draft: 'rascunho ainda sem skin: não há pesos.'},
};
const finite = v => typeof v === 'number' && Number.isFinite(v);
const isVec = (v, n) => Array.isArray(v) && v.length === n && v.every(finite);
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
  const errors = [], err = (path, message) => errors.push({path, message});
  try {validatePatch(patch);} catch (e) {err('(validatePatch oficial)', e.message);}
  if (Array.isArray(patch.operations) && !patch.operations.length) err('operations', 'Esperado pelo menos uma operação.');
  if (Array.isArray(patch.operations)) patch.operations.forEach((o, i) => {
    const at = `operations[${i}]`, spec = o && OP_FIELDS[o.op];if (!spec) return;
    const check = (key, type, required) => {
      const v = o[key];
      if (v === undefined) {if (required) err(`${at}.${key}`, `Campo obrigatório em ${o.op}.`);return;}
      const bad = m => err(`${at}.${key}`, m);
      if (type === 'ref' && !(typeof v === 'string' && v.trim())) bad('Esperado o ID persistente (jointId) ou o nome de um osso.');
      if (type === 'refOrNull' && !(v === null || (typeof v === 'string' && v.trim()))) bad('Esperado o ID ou o nome de um osso, ou null.');
      if (type === 'name' && !(typeof v === 'string' && v.trim() && v.length <= 80)) bad('Esperado um texto com 1 a 80 caracteres.');
      if (type === 'vec3' && !isVec(v, 3)) bad('Esperado um array de 3 números finitos [x, y, z].');
      if (type === 'vec3' && isVec(v, 3) && v.some(x => Math.abs(x) > 1e6)) bad('Coordenada fora do limite (±1e6).');
      if (type === 'quat' && !isVec(v, 4)) bad('Esperado um quaternion [x, y, z, w] com 4 números finitos.');
      if (type === 'quat' && isVec(v, 4) && Math.abs(Math.hypot(...v) - 1) > 1e-3) bad(`Quaternion não normalizado (norma ${Math.hypot(...v).toFixed(4)}).`);
      if (type === 'space' && !['model-root', 'local'].includes(v)) bad('Esperado "model-root" ou "local".');
      if (type === 'side' && !['Left', 'Right'].includes(v)) bad('Esperado "Left" ou "Right".');
      if (type === 'bool' && typeof v !== 'boolean') bad('Esperado true ou false.');
      if (type === 'number' && !finite(v)) bad('Esperado um número finito.');
      if (type === 'index' && !(Number.isInteger(v) && v >= 0)) bad('Esperado um índice inteiro ≥ 0.');
      if (type === 'influences' && !(Array.isArray(v) && v.length <= 4 && v.every(x => x && typeof x.jointId === 'string' && finite(x.weight)))) bad('Esperado até 4 itens {jointId, weight}.');
    };
    for (const [k, t] of Object.entries(spec.required)) check(k, t, true);
    for (const [k, t] of Object.entries(spec.optional || {})) check(k, t, false);
    const known = new Set(['op', 'note', ...Object.keys(spec.required), ...Object.keys(spec.optional || {})]);
    for (const k of Object.keys(o)) if (!known.has(k)) err(`${at}.${k}`, `Campo desconhecido em ${o.op}.`);
  });
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
