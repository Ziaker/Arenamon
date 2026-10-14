// Rig Patch JSON (schema `arenamon-rig-patch`, versão 1): instruções de correção de esqueleto, pensadas para serem
// produzidas por uma IA a partir da telemetria e revisadas pelo usuário antes de aplicar.
//
// Este módulo só faz duas coisas:
// 1. Valida a ESTRUTURA do JSON, com mensagens que apontam o caminho do erro (ex.: `ops[2].p`).
// 2. Simula o patch sobre uma CÓPIA do rascunho usando as funções do motor do Codex (`rigging/core.js`):
//    renameDraftJoint, reparentDraftJoint, addDraftJoint, removeDraftJoint, applyMirror e validateDraft.
// A validação de topologia (ciclos, raiz única, nomes e IDs duplicados, limites) é a do Codex, não desta interface.
import {ensureJointIds, validateDraft, renameDraftJoint, reparentDraftJoint, addDraftJoint, removeDraftJoint, applyMirror, currentJoints, modelBounds} from '../rigging/core.js';

export const PATCH_SCHEMA = 'arenamon-rig-patch';
/** Operações aceitas. `applied` diz se o Studio consegue aplicar no modelo hoje (ver engine-codex.js). */
export const OPS = {
  setPosition: {fields: {joint: 'ref', p: 'vec3'}, help: 'Move a articulação para a posição p no espaço da raiz do modelo.'},
  translate: {fields: {joint: 'ref', delta: 'vec3'}, help: 'Desloca a articulação por delta (espaço da raiz).'},
  setRotation: {fields: {joint: 'ref', q: 'quat'}, help: 'Define a rotação local de repouso (quaternion x, y, z, w).'},
  rename: {fields: {joint: 'ref', name: 'name'}, help: 'Renomeia o osso (o ID persistente não muda).'},
  reparent: {fields: {joint: 'ref', parent: 'refOrNull'}, help: 'Troca o pai do osso (null = raiz).'},
  addJoint: {fields: {name: 'name', parent: 'refOrNull', p: 'vec3'}, optional: {q: 'quat'}, help: 'Cria um osso novo.'},
  removeJoint: {fields: {joint: 'ref'}, help: 'Exclui o osso; os filhos passam para o pai anterior.'},
  mirror: {fields: {joint: 'ref'}, help: 'Copia a posição do osso para o lado oposto (Left ↔ Right), espelhada no centro do modelo.'},
};
const finite = v => typeof v === 'number' && Number.isFinite(v);
const isVec = (v, n) => Array.isArray(v) && v.length === n && v.every(finite);

/** Validação estrutural. Devolve {ok, errors: [{path, message}], patch}. Aceita string ou objeto. */
export function parsePatch(input) {
  const errors = [], err = (path, message) => errors.push({path, message});
  let patch = input;
  if (typeof input === 'string') {
    try {patch = JSON.parse(input);} catch (e) {
      const m = /position (\d+)/.exec(e.message), pos = m ? Number(m[1]) : null, line = pos === null ? null : input.slice(0, pos).split('\n').length;
      return {ok: false, errors: [{path: line ? `linha ${line}` : '(JSON)', message: 'JSON inválido: ' + e.message}], patch: null};
    }
  }
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return {ok: false, errors: [{path: '(raiz)', message: 'Esperado um objeto JSON.'}], patch: null};
  if (patch.schema !== PATCH_SCHEMA) err('schema', `Esperado "${PATCH_SCHEMA}" (recebido ${JSON.stringify(patch.schema)}).`);
  if (patch.version !== 1) err('version', `Versão suportada: 1 (recebido ${JSON.stringify(patch.version)}).`);
  if (patch.space !== undefined && patch.space !== 'model-root') err('space', 'Só o espaço "model-root" é suportado (coordenadas relativas à raiz do modelo).');
  if (!Array.isArray(patch.ops) || !patch.ops.length) err('ops', 'Esperado um array "ops" com pelo menos uma operação.');
  else patch.ops.forEach((o, i) => {
    const at = `ops[${i}]`;
    if (!o || typeof o !== 'object') return err(at, 'Operação deve ser um objeto.');
    const spec = OPS[o.op];
    if (!spec) return err(at + '.op', `Operação desconhecida ${JSON.stringify(o.op)}. Use: ${Object.keys(OPS).join(', ')}.`);
    const check = (key, type, required) => {
      const v = o[key];
      if (v === undefined) {if (required) err(`${at}.${key}`, `Campo obrigatório em ${o.op}.`);return;}
      if (type === 'ref' && !(typeof v === 'string' && v.trim())) err(`${at}.${key}`, 'Esperado o ID ou o nome de um osso.');
      if (type === 'refOrNull' && !(v === null || (typeof v === 'string' && v.trim()))) err(`${at}.${key}`, 'Esperado o ID ou o nome de um osso, ou null.');
      if (type === 'name' && !(typeof v === 'string' && v.trim() && v.length <= 80)) err(`${at}.${key}`, 'Esperado um nome com 1 a 80 caracteres.');
      if (type === 'vec3' && !isVec(v, 3)) err(`${at}.${key}`, 'Esperado um array de 3 números finitos [x, y, z].');
      if (type === 'vec3' && isVec(v, 3) && v.some(x => Math.abs(x) > 1e6)) err(`${at}.${key}`, 'Coordenada fora do limite (±1e6).');
      if (type === 'quat' && !isVec(v, 4)) err(`${at}.${key}`, 'Esperado um quaternion [x, y, z, w] com 4 números finitos.');
      if (type === 'quat' && isVec(v, 4) && Math.abs(Math.hypot(...v) - 1) > 1e-3) err(`${at}.${key}`, `Quaternion não normalizado (norma ${Math.hypot(...v).toFixed(4)}).`);
    };
    for (const [k, t] of Object.entries(spec.fields)) check(k, t, true);
    for (const [k, t] of Object.entries(spec.optional || {})) check(k, t, false);
    const known = new Set(['op', 'note', ...Object.keys(spec.fields), ...Object.keys(spec.optional || {})]);
    for (const k of Object.keys(o)) if (!known.has(k)) err(`${at}.${k}`, `Campo desconhecido em ${o.op}.`);
  });
  return {ok: !errors.length, errors, patch};
}

/** Rascunho v2 (schema do Codex) que representa o rig atual: o rascunho em edição ou os ossos do modelo. */
export function draftFromModel(root, draft = null) {
  const base = draft ? structuredClone(draft) : {schema: 'arenamon-rig', version: 2, space: 'model-root', mode: 'bound',
    joints: currentJoints(root).map(j => ({id: j.id, name: j.name, parent: j.parent, p: [...j.p], q: [...j.q]}))};
  const b = modelBounds(root);base.bounds ??= {min: b.min, max: b.max, size: b.size};
  return ensureJointIds(base);
}

/** Encontra um osso do rascunho pelo ID persistente ou pelo nome. */
export const findJoint = (draft, ref) => draft.joints.find(j => j.id === ref) || draft.joints.find(j => j.name === ref) || null;

/**
 * Simula o patch numa cópia do rascunho com as funções do Codex e valida com validateDraft do Codex.
 * Devolve {ok, after, steps: [{index, op, ok, error?}], error?}. Para no primeiro erro (nada é aplicado ao modelo).
 */
export function simulateOnDraft(before, patch, bounds) {
  const after = structuredClone(before), steps = [];
  for (const [index, o] of patch.ops.entries()) {
    try {
      const need = ref => {const j = findJoint(after, ref);if (!j) throw Error(`Osso não encontrado: ${ref}`);return j;};
      if (o.op === 'setPosition') need(o.joint).p = [...o.p];
      else if (o.op === 'translate') {const j = need(o.joint);j.p = j.p.map((v, k) => v + o.delta[k]);}
      else if (o.op === 'setRotation') need(o.joint).q = [...o.q];
      else if (o.op === 'rename') renameDraftJoint(after, need(o.joint).id, o.name);
      else if (o.op === 'reparent') reparentDraftJoint(after, need(o.joint).id, o.parent === null ? null : need(o.parent).id);
      else if (o.op === 'addJoint') addDraftJoint(after, {name: o.name, parent: o.parent === null ? null : need(o.parent).id, p: o.p, q: o.q || [0, 0, 0, 1]});
      else if (o.op === 'removeJoint') removeDraftJoint(after, need(o.joint).id);
      else if (o.op === 'mirror') {const j = need(o.joint);if (!applyMirror(after, j.name)) throw Error(`Sem par simétrico (Left/Right) para ${j.name}.`);}
      validateDraft(after, bounds);
      steps.push({index, op: o.op, ok: true});
    } catch (e) {
      steps.push({index, op: o.op, ok: false, error: e.message});
      return {ok: false, after: null, steps, error: `ops[${index}] (${o.op}): ${e.message}`};
    }
  }
  return {ok: true, after, steps};
}

/** Diferenças entre dois rascunhos, por ID persistente: posição, rotação, nome, hierarquia, criados e removidos. */
export function diffDrafts(before, after) {
  const byId = d => new Map(d.joints.map(j => [j.id, j])), A = byId(before), B = byId(after), changes = [];
  const parentId = (d, name) => name ? d.joints.find(j => j.name === name)?.id ?? null : null;
  const angle = (q1, q2) => {const d = Math.abs(q1[0] * q2[0] + q1[1] * q2[1] + q1[2] * q2[2] + q1[3] * q2[3]);return 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI;};
  for (const [id, b] of B) {
    const a = A.get(id);
    if (!a) {changes.push({id, name: b.name, kind: 'added', parentAfter: b.parent, p: b.p});continue;}
    const c = {id, name: b.name, kind: 'changed'};
    const dp = b.p.map((v, k) => v - a.p[k]), moved = Math.hypot(...dp);
    if (moved > 1e-9) {c.moved = moved;c.delta = dp;c.pBefore = a.p;c.pAfter = b.p;}
    const qa = a.q || [0, 0, 0, 1], qb = b.q || [0, 0, 0, 1], turned = angle(qa, qb);
    if (turned > 1e-6) {c.rotatedDeg = turned;c.qBefore = qa;c.qAfter = qb;}
    if (a.name !== b.name) {c.nameBefore = a.name;}
    if (parentId(before, a.parent) !== parentId(after, b.parent)) {c.parentBefore = a.parent;c.parentAfter = b.parent;}
    if (Object.keys(c).length > 3) changes.push(c);
  }
  for (const [id, a] of A) if (!B.has(id)) changes.push({id, name: a.name, kind: 'removed', parentBefore: a.parent});
  return changes;
}

/** Converte um JSON de coordenadas do Codex (`arenamon-rig`) num patch de setPosition (importar coordenadas corrigidas). */
export function patchFromRigJSON(rig, current) {
  if (rig?.schema !== 'arenamon-rig' || !Array.isArray(rig.joints)) throw Error('Esperado um JSON de coordenadas "arenamon-rig" com joints.');
  const ops = [];
  for (const j of rig.joints) {
    const target = (j.id && findJoint(current, j.id)) || findJoint(current, j.name);
    if (!target) throw Error(`Osso do JSON não existe no rig atual: ${j.name}`);
    if (j.p.some((v, k) => Math.abs(v - target.p[k]) > 1e-9)) ops.push({op: 'setPosition', joint: target.id, p: [...j.p]});
  }
  return {schema: PATCH_SCHEMA, version: 1, space: 'model-root', description: 'Coordenadas importadas de JSON arenamon-rig', ops};
}
