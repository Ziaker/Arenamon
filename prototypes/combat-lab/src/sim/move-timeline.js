// @ts-check
// Linha do tempo unificada do Move (#04 do plano de 23/10/2026): marcas e trechos em TICKS de 120 Hz (o passo fixo da simulação), calculados da
// definição EFETIVA (a registrada + sliders do grupo) e, à parte, medidos no motor de verdade (`measureMoveRun`) para provar que cada marca
// corresponde ao evento real. Ticks mecânicos ≠ frames de animação: a animação tem o próprio relógio e não entra aqui.
import {C} from './config.js';
import {Game} from './game.js';
import {emptyCommand} from './entity.js';
import {getMove} from './moves.js';
import {usageOf} from './move-matrix.js';
import {withValues} from './compare.js';

export const TICK_RATE = 120;
const toTick = (/** @type {number} */ s) => Math.round(s * TICK_RATE);

/**
 * @typedef {{tick: number, label: string, kind: 'cast' | 'spawn' | 'status' | 'hit' | 'effect' | 'cancel' | 'end' | 'invuln'}} TimelineMark
 * @typedef {{from: number, to: number, label: string, kind: 'cast' | 'active' | 'invuln' | 'recovery' | 'cancel'}} TimelineSpan
 */
/**
 * Linha do tempo estática (a partir da definição efetiva e dos parâmetros do grupo).
 * @param {string} moveId
 * @returns {{id: string, tickRate: number, totalTicks: number, marks: TimelineMark[], spans: TimelineSpan[], source: string, charge: boolean} | null}
 */
export function buildMoveTimeline(moveId) {
  const def = getMove(moveId);
  if (!def) return null;
  const g = def.group ? C.world[def.group] : null;
  /** @type {TimelineMark[]} */ const marks = [];
  /** @type {TimelineSpan[]} */ const spans = [];
  const total = toTick(def.duration ?? 0);
  if (total > 0) spans.push({from: 0, to: total, label: def.charge ? 'ação após soltar' : 'ação do Move', kind: 'cast'});
  for (const ev of def.timeline ?? []) {
    const kind = ev.spawn ? 'spawn' : ev.status ? 'status' : ev.hit ? 'hit' : 'effect';
    const what = ev.spawn?.kind ?? ev.status?.id ?? ev.effect ?? 'golpe';
    marks.push({tick: def.charge ? 0 : toTick(ev.at ?? 0), label: `${kind}: ${what}`, kind});
  }
  if (def.invulnerable) {
    const [a, b] = def.invulnerable;
    if (b > a) {spans.push({from: toTick(a), to: toTick(b), label: 'invulnerável', kind: 'invuln'});marks.push({tick: toTick(a), label: 'início da invulnerabilidade', kind: 'invuln'});}
  }
  // Moves que viram ação de Tackle: janela de acerto e cancelamento vêm do grupo.
  if (def.tackle && g) {
    if (typeof g.hitStart === 'number' && typeof g.hitEnd === 'number') {spans.push({from: toTick(g.hitStart), to: toTick(g.hitEnd), label: 'janela de acerto', kind: 'active'});marks.push({tick: toTick(g.hitStart), label: 'início da hitbox', kind: 'hit'});}
    if (typeof g.chainAfter === 'number') {marks.push({tick: toTick(g.chainAfter), label: 'cancelável a partir daqui', kind: 'cancel'});spans.push({from: toTick(g.chainAfter), to: total, label: 'cancelável', kind: 'cancel'});}
  } else if (typeof def.cancelAfter === 'number' && def.cancelAfter < (def.duration ?? 0)) {
    marks.push({tick: toTick(def.cancelAfter), label: 'cancelável a partir daqui', kind: 'cancel'});spans.push({from: toTick(def.cancelAfter), to: total, label: 'cancelável', kind: 'cancel'});
  }
  marks.push({tick: total, label: 'fim da ação', kind: 'end'});
  marks.sort((a, b) => a.tick - b.tick);
  return {id: moveId, tickRate: TICK_RATE, totalTicks: total, marks, spans, source: def.group ? `definição + sliders de C.world.${def.group}` : 'definição', charge: !!def.charge};
}

/**
 * Mede no motor real quando as coisas acontecem ao usar o Move (azul perto do vermelho, arena limpa, IA desligada): tick em que a ação começa,
 * em que cada entidade nasce, em que o status aparece, em que há impacto e em que a ação termina. `t = 0` é o tick do comando.
 * @param {string} moveId @param {number} [seed]
 */
export function measureMoveRun(moveId, seed = 7) {
  return withValues({'extras.toggles.enableEnemyAI': 0}, () => measureInner(moveId, seed));   // restaura a IA do rival no fim
}
function measureInner(/** @type {string} */ moveId, /** @type {number} */ seed) {
  const def = getMove(moveId);
  if (!def) throw new Error('Move não registrado: ' + moveId);
  const g = new Game({seed});g.start();
  g.reset({positions: [{x: 0, z: -3}, {x: 0, z: 3}]});   // rival longe: entidades do Move aparecem antes de qualquer impacto
  g.mapState.platforms = [];g.mapState.obstacles = [];g.mapState.destructibles = [];g.mapState.items = [];g.mapState.regularSpawnTimer = 1e9;
  g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
  g.setLoadout(0, [def.id]);
  const u = usageOf(def), held = Array.from({length: C.world.slots}, (_, i) => i === 0);
  /** @type {{actionStart: number | null, actionEnd: number | null, spawns: {tick: number, kind: string}[], statusAt: number | null, impacts: number[]}} */
  const m = {actionStart: null, actionEnd: null, spawns: [], statusAt: null, impacts: []};
  const seen = new Set();
  /** @type {number | null} */ let releasedAt = null;
  for (let t = 0; t < 480 && g.phase !== 'result'; t++) {
    const k = t, pressing = k < u.hold;
    if (!pressing && releasedAt === null) releasedAt = t;
    g.step(/** @type {any} */ ({...emptyCommand(), ...(pressing ? {skill: k === 0 ? 0 : null, skillHeld: held} : {})}), emptyCommand());
    const f = g.fighters[0];
    // ticks relativos ao início da AÇÃO (para Charge/mira, depois de soltar); para toque, ao comando
    if (m.actionStart === null && f.action?.kind === 'move' && f.action.move === def.id) m.actionStart = t;
    if (m.actionStart !== null && m.actionEnd === null && !f.action) m.actionEnd = t;
    for (const e of g.world.entities) if (!seen.has(e.id) && e.owner === 0) {seen.add(e.id);m.spawns.push({tick: t, kind: e.kind});}
    if (m.statusAt === null && f.statuses?.some((/** @type {any} */ s) => s.id === def.id)) m.statusAt = t;
    for (const ev of g.lastStepEvents) if (ev.attacker === 0 && (ev.result === 'impact' || ev.result === 'partial') && typeof ev.damage === 'number') m.impacts.push(t);
  }
  return m;
}
