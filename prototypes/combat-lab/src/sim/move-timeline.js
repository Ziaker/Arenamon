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
import {MOVE_GROUP, MELEE_MOVES, SHAKE_GROUPS} from './move-hit-map.js';
import {MOVE_VFX, VFX_NAMES} from './move-vfx-map.js';

export const TICK_RATE = 120;
const toTick = (/** @type {number} */ s) => Math.round(s * TICK_RATE);

/**
 * @typedef {{tick: number, label: string, kind: 'cast' | 'spawn' | 'status' | 'hit' | 'effect' | 'cancel' | 'end' | 'invuln'}} TimelineMark
 * @typedef {{from: number, to: number, label: string, kind: 'cast' | 'active' | 'invuln' | 'recovery' | 'cancel'}} TimelineSpan
 * @typedef {{domain: 'vfx' | 'camera' | 'animation', clock: 'tick' | 'animation', tick: number | null, label: string, keys?: string[], clip?: string}} TimelineCue
 *   cue = momento de VFX, câmera ou animação. `clock: 'tick'` = tick mecânico (120 Hz, relativo ao início da ação; null = «quando acertar», sem tick fixo);
 *   `clock: 'animation'` = relógio do clipe, normalizado pela duração da ação (NÃO é tick; converta com clipFrameAtTick).
 */
/** Quadro do clipe de animação que corresponde a um tick da ação: o clipe é esticado à duração da ação (progresso = tempo ÷ duração). */
export function clipFrameAtTick(/** @type {number} */ tick, /** @type {number} */ totalTicks, /** @type {number} */ clipFrames) {
  if (!(totalTicks > 0) || !(clipFrames > 1)) return 0;
  return Math.min(clipFrames - 1, Math.max(0, Math.round(tick / totalTicks * (clipFrames - 1))));
}
/** Clipe tocado pela visão (view/characters.js): na carga `charge_<id>`; ao agir, `move_<slot+1>` (Reflect e Psyshock têm `release_<id>`). */
function animationCues(/** @type {any} */ def, /** @type {number} */ slot) {
  const own = def.id === 'reflect' || def.id === 'psyshock';
  const action = own ? 'release_' + def.id : 'move_' + (Math.max(0, Math.min(3, slot)) + 1);
  /** @type {TimelineCue[]} */ const cues = [];
  if (def.charge) cues.push({domain: 'animation', clock: 'animation', tick: null, clip: 'charge_' + def.id, label: `animação: durante a carga toca o clipe charge_${def.id} (em laço; não é tick)`});
  cues.push({domain: 'animation', clock: 'animation', tick: 0, clip: action, label: `animação: o clipe ${action} começa com a ação; o progresso dele é normalizado pela duração da ação (não é tick: converta com «Quadros do clipe»)`});
  return cues;
}
/** Cues de VFX (nos eventos da simulação) e de câmera (tremor de hit) a partir das marcas mecânicas e dos sliders vivos. */
function eventCues(/** @type {string} */ moveId, /** @type {TimelineMark[]} */ marks) {
  /** @type {TimelineCue[]} */ const cues = [];
  const keys = [...(MOVE_VFX[/** @type {keyof typeof MOVE_VFX} */ (moveId)] ?? [])];
  const names = keys.map(k => VFX_NAMES[/** @type {keyof typeof VFX_NAMES} */ (k)] ?? k).join(', ') || 'efeito próprio do Move (aba Visual)';
  for (const k of marks) if (k.kind === 'spawn' || k.kind === 'effect' || k.kind === 'status' || k.kind === 'hit') cues.push({domain: 'vfx', clock: 'tick', tick: k.tick, keys, label: `VFX no evento «${k.label}»: ${names}`});
  const group = /** @type {Record<string, string>} */ (MOVE_GROUP)[moveId], w = group ? C.world[group] : null, hit = marks.find(k => k.kind === 'hit');
  if (MELEE_MOVES.has(moveId)) cues.push({domain: 'camera', clock: 'tick', tick: hit?.tick ?? null, label: 'câmera: tremor de hit padrão ao acertar (corpo a corpo)'});
  else if (w && SHAKE_GROUPS.includes(group)) cues.push({domain: 'camera', clock: 'tick', tick: hit?.tick ?? null, label: w.hitShakeOn ? `câmera: tremor de hit ligado (intensidade ×${w.hitShakeAmount}, duração ×${w.hitShakeDuration}) quando acertar` : 'câmera: sem tremor de hit (interruptor do Move desligado)'});
  return cues;
}
/**
 * Primeiro tick (da partida) da execução MAIS RECENTE do Move no buffer de replay do lutador `fighter`; null se o Move não foi usado.
 * `frames` = [{tick, game: {fighters: [{action}]}}] (o que main.js guarda). Soma a isso o tick relativo de uma marca para pausar o replay nela.
 * @param {{tick: number, game: any}[]} frames @param {string} moveId @param {number} [fighter]
 */
export function findMoveRunStart(frames, moveId, fighter = 0) {
  const isRun = (/** @type {any} */ fr) => { const a = fr?.game?.fighters?.[fighter]?.action; return a?.kind === 'move' && a.move === moveId; };
  let i = frames.length - 1;
  while (i >= 0 && !isRun(frames[i])) i--;
  if (i < 0) return null;
  while (i > 0 && isRun(frames[i - 1])) i--;
  return frames[i].tick;
}
/**
 * Linha do tempo estática (a partir da definição efetiva e dos parâmetros do grupo).
 * @param {string} moveId @param {{slot?: number}} [opts] slot do Move (0–3): define o clipe `move_<slot+1>`
 * @returns {{id: string, tickRate: number, totalTicks: number, marks: TimelineMark[], spans: TimelineSpan[], cues: TimelineCue[], source: string, charge: boolean} | null}
 */
export function buildMoveTimeline(moveId, {slot = 0} = {}) {
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
  const cues = [...eventCues(moveId, marks), ...animationCues(def, slot)];
  return {id: moveId, tickRate: TICK_RATE, totalTicks: total, marks, spans, cues, source: def.group ? `definição + sliders de C.world.${def.group}` : 'definição', charge: !!def.charge};
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
