// @ts-check
// Gerador da matriz de cenários por Move (#10 do plano de 23/10/2026): para cada Move registrado, monta cenários DETERMINÍSTICOS a partir da
// definição (categoria, ar, charge, marcador) e confere invariantes transversais. Cada Move declara os escopos que se aplicam; o que não
// se aplica sai como N/A com a razão (nada é pulado em silêncio). Nenhuma regra de produto é inventada: só se verifica o que vale para qualquer
// Move (valores finitos, HP/stamina dentro dos limites, nada fora da arena, ação que termina, determinismo, save/load, cooldown cobrado).
// Quem chama precisa ter registrado os Moves (registerStandardMoves) e a configuração desejada em C.
import {C} from './config.js';
import {Game} from './game.js';
import {emptyCommand, getFighterMaxStamina} from './entity.js';
import {getMove} from './moves.js';
import {effectiveArenaRadius} from './map.js';
import {normalizeState, hashText} from './replay-diff.js';
import {withValues} from './compare.js';

/** Escopos da matriz, na ordem em que aparecem no relatório. */
export const SCOPES = ['ground', 'air', 'platform', 'wall', 'guard', 'dodge-cancel', 'hitstop', 'lock-on', 'determinism', 'save-load', 'simultaneous'];
const TICKS = 360;   // 3 s de simulação por cenário (passo fixo de 1/120 s)

/** @typedef {{move: string, scope: string, status: 'ok' | 'fail' | 'na', reason?: string, seed: number, tick?: number, expected?: string, got?: string}} MatrixResult */

const held = (/** @type {number} */ slot) => Array.from({length: C.world.slots}, (_, i) => i === slot);
const cmd = (/** @type {any} */ o = {}) => ({...emptyCommand(), ...o});

/** Como acionar o Move: toque, segurar-e-soltar (carga) ou segurar com marcador (mira). */
export function usageOf(/** @type {any} */ def) {
  if (def.charge) return {mode: 'charge', hold: 40};
  if (def.aimMode === 'marker' || def.moveCast) return {mode: 'aim', hold: 60};
  return {mode: 'tap', hold: 1};
}
/** Comando do azul no tick t para usar o Move no slot 0, a partir do tick `start`. */
function scriptFor(/** @type {any} */ def, start = 0) {
  const u = usageOf(def);
  return (/** @type {number} */ t) => {
    const k = t - start;
    if (k < 0 || k >= u.hold) return cmd();
    return cmd({skill: k === 0 ? 0 : null, skillHeld: held(0)});
  };
}

/** Escopos que NÃO se aplicam ao Move, com a razão (derivada da definição; nada é pulado em silêncio). */
export function notApplicable(/** @type {any} */ def) {
  /** @type {Record<string, string>} */ const na = {};
  if (def.air === 'none' || def.groundOnly) na.air = 'Move só no chão (air: none / groundOnly)';
  return na;
}

function build(/** @type {any} */ def, /** @type {number} */ seed, /** @type {{red?: string | null, platform?: boolean, wall?: boolean, air?: boolean, lock?: boolean, close?: boolean}} */ o = {}) {
  const g = new Game({seed});g.start();
  g.reset({positions: [{x: 0, z: -3}, {x: 0, z: o.close ? -1.6 : 3}]});
  /** @type {any} */ (g.mapState).platforms = o.platform ? [{id: 'p', pos: {x: 0, y: 0, z: -3}, width: 5, depth: 5, height: 1}] : [];
  g.mapState.obstacles = [];g.mapState.destructibles = [];g.mapState.items = [];g.mapState.regularSpawnTimer = 1e9;
  if (o.wall) g.world.entities.push({id: 9001, kind: 'wall', owner: 1, pos: {x: 0, z: -1.2}, hx: 3, hz: .2, height: 2.2, angle: 0, life: 99, age: 0});
  g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
  if (o.platform) g.fighters[0].groundY = 1;
  g.setLoadout(0, [def.id]);
  if (o.red) g.setLoadout(1, [o.red]);
  return g;
}

/** Confere invariantes a cada tick; devolve a primeira violação ou null. */
function invariants(/** @type {any} */ g, /** @type {number} */ t) {
  const R = effectiveArenaRadius() + 3;
  for (const f of g.fighters) {
    for (const [k, v] of Object.entries({x: f.position.x, z: f.position.z, hp: f.hp, stamina: f.stamina, vx: f.velocity.x, vz: f.velocity.z})) if (!Number.isFinite(v)) return {tick: t, expected: 'valor finito', got: `${k} = ${v} (lutador ${f.id})`};
    if (f.hp < 0 || f.hp > f.maxHp + 1e-6) return {tick: t, expected: `0 ≤ hp ≤ ${f.maxHp}`, got: `hp ${f.hp} (lutador ${f.id})`};
    const max = getFighterMaxStamina(f);
    if (f.stamina < -1e-6 || f.stamina > max + 1e-6) return {tick: t, expected: `0 ≤ stamina ≤ ${max}`, got: `stamina ${f.stamina} (lutador ${f.id})`};
    if (Math.hypot(f.position.x, f.position.z) > R) return {tick: t, expected: `dentro da arena (${R.toFixed(1)} m)`, got: `${Math.hypot(f.position.x, f.position.z).toFixed(1)} m (lutador ${f.id})`};
  }
  return null;
}

/** Roda `ticks` passos com os scripts dos dois lados e confere os invariantes. Devolve violação, cooldown e estados normalizados. */
function run(/** @type {any} */ g, /** @type {number} */ ticks, /** @type {(t: number) => any} */ blue, /** @type {(t: number) => any} */ red = () => cmd(), /** @type {(t: number, g: any) => void} */ hook = () => {}) {
  const states = [];
  for (let t = 0; t < ticks && g.phase !== 'result'; t++) {
    hook(t, g);
    g.step(blue(t), red(t));
    states.push(normalizeState(g));
    const v = invariants(g, t);if (v) return {violation: v, states};
  }
  return {violation: null, states};
}

/**
 * Executa a matriz de UM Move. `seed` fixa tudo (reprodutível); cada resultado traz seed/tick/esperado/obtido.
 * @param {string} moveId @param {number} [seed]
 * @returns {MatrixResult[]}
 */
export function runMoveMatrix(moveId, seed = 7) {
  // IA do rival desligada e hitstop ligado só durante a matriz; a configuração viva volta ao que era
  return withValues({'extras.toggles.enableEnemyAI': 0, 'extras.toggles.enableHitstop': 1}, () => matrixInner(moveId, seed));
}
/** @returns {MatrixResult[]} */
function matrixInner(/** @type {string} */ moveId, /** @type {number} */ seed) {
  const def = getMove(moveId);
  if (!def) throw new Error('Move não registrado: ' + moveId);
  const na = notApplicable(def), use = scriptFor(def);
  /** @type {MatrixResult[]} */ const out = [];
  const add = (/** @type {string} */ scope, /** @type {MatrixResult['status']} */ status, /** @type {Partial<MatrixResult>} */ extra = {}) => out.push({move: moveId, scope, status, seed, ...extra});
  const check = (/** @type {string} */ scope, /** @type {() => {violation: any, extra?: Partial<MatrixResult>}} */ fn) => {
    if (na[scope]) {add(scope, 'na', {reason: na[scope]});return;}
    try {
      const r = fn();
      if (r.violation) add(scope, 'fail', {tick: r.violation.tick, expected: r.violation.expected, got: r.violation.got});
      else add(scope, 'ok', r.extra);
    } catch (e) {add(scope, 'fail', {expected: 'sem exceção', got: String(/** @type {Error} */ (e).stack?.split('\n').slice(0, 2).join(' | ') ?? e)});}
  };
  /** Depois do uso, a ação precisa terminar e o lutador voltar a poder agir dentro do tempo. */
  const settles = (/** @type {any} */ g) => g.fighters[0].action ? {tick: g.tick, expected: 'ação encerrada em 3 s', got: `ação ${g.fighters[0].action.kind} ainda ativa`} : null;
  const cooldownOrDenied = (/** @type {any} */ g) => (g.fighters[0].moveCooldowns?.[moveId] ?? 0) > 0 || (g.fighters[0].stamina < (def.cost ?? 0)) ? null : {tick: g.tick, expected: 'recarga iniciada ao usar', got: 'sem recarga e stamina intacta (o Move nem tentou)'};

  check('ground', () => {const g = build(def, seed, {close: true});const r = run(g, TICKS, use);return {violation: r.violation ?? settles(g) ?? cooldownOrDenied(g)};});
  check('air', () => {
    const g = build(def, seed, {close: true});
    const r = run(g, TICKS, t => t === 0 ? cmd({jump: true, jumpHeld: true}) : t < 12 ? cmd({jumpHeld: true}) : use(t - 20), undefined);
    return {violation: r.violation ?? (g.fighters[0].action ? settles(g) : null)};
  });
  check('platform', () => {const g = build(def, seed, {platform: true, close: true});return {violation: run(g, TICKS, use).violation ?? settles(g)};});
  check('wall', () => {const g = build(def, seed, {wall: true});return {violation: run(g, TICKS, use).violation ?? settles(g)};});
  check('guard', () => {const g = build(def, seed, {close: true});return {violation: run(g, TICKS, use, () => cmd({guard: true, guardPressed: false})).violation ?? settles(g)};});
  check('dodge-cancel', () => {const g = build(def, seed, {close: true});return {violation: run(g, TICKS, t => t === 12 ? cmd({dodge: true}) : use(t)).violation};});
  check('hitstop', () => {const g = build(def, seed, {close: true});return {violation: run(g, TICKS, use).violation};});
  check('lock-on', () => {const g = build(def, seed, {close: true});return {violation: run(g, TICKS, t => ({...use(t), target: 1, locked: true})).violation};});
  check('determinism', () => {
    const a = run(build(def, seed, {close: true}), TICKS, use).states, b = run(build(def, seed, {close: true}), TICKS, use).states;
    const h = (/** @type {any[]} */ s) => hashText(JSON.stringify(s));
    return {violation: h(a) === h(b) ? null : {tick: a.findIndex((s, i) => JSON.stringify(s) !== JSON.stringify(b[i])), expected: 'duas execuções idênticas', got: 'estados diferentes'}};
  });
  check('save-load', () => {
    const g = build(def, seed, {close: true});
    run(g, 60, use);
    const saved = g.save();
    const tailA = run(g, 200, t => use(t + 60)).states;
    const g2 = new Game({seed});g2.load(saved);
    const tailB = run(g2, 200, t => use(t + 60)).states;
    const same = tailA.length === tailB.length && tailA.every((s, i) => JSON.stringify(s) === JSON.stringify(tailB[i]));
    return {violation: same ? null : {tick: tailA.findIndex((s, i) => JSON.stringify(s) !== JSON.stringify(tailB[i])) + 60, expected: 'continuar do save igual a continuar sem salvar', got: 'estados divergem depois de load'}};
  });
  check('simultaneous', () => {const g = build(def, seed, {close: true, red: moveId});return {violation: run(g, TICKS, use, use).violation};});
  return out;
}

/** Roda a matriz de todos os Moves dados e devolve os resultados e um resumo. */
export function runAllMatrices(/** @type {string[]} */ ids, seed = 7) {
  const results = ids.flatMap(id => runMoveMatrix(id, seed));
  const count = (/** @type {string} */ s) => results.filter(r => r.status === s).length;
  return {results, ok: count('ok'), fail: count('fail'), na: count('na'), failures: results.filter(r => r.status === 'fail')};
}
