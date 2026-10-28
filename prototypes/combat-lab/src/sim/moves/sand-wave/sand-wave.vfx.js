// @ts-check
// Visual e partículas do Sand Wave (Documento 02).
// Módulo de renderização consumido exclusivamente pela camada view/ (moves-vfx-registry.js).
// Encapsula o ciclo de vida visual completo da onda de areia:
//   - Criação da malha 3D e emissor de partículas
//   - Propagação visual sincronizada com a hitbox ativa da simulação
//   - Efeito de poeira sólida e dissipação
//   - Limpeza completa de recursos e respeito à acessibilidade (noFlash/reduceMotion).

import * as T from 'three';
import {SandEffect} from '../../../../../sand-stone-lab/src/effects.js';
import {Particles} from '../../../../../sand-stone-lab/src/particles.js';
import {PhaseClock} from '../../../../../sand-stone-lab/src/phases.ts';
import {defaults} from '../../../../../sand-stone-lab/src/config.ts';
import {disposeGroup} from '../../../../../sand-stone-lab/src/art.js';
import {ATELIER_GAME_PARAMS, ATELIER_GAME_VARIANT} from '../../../view/quarks/atelier-game-params.js';
import {C} from '../../config.js';
import {sandFrontAt, sandFieldOf} from '../../sand.js';
import {parentPointToLocal, parentDirToLocal} from '../../../view/quarks/coords.js';

export const id = 'sand-wave';
/** Altura (m) do jato de poeira acima do chão da onda no ponto de contato (canela do alvo). */
export const CONTACT_Y = 0.35;

/**
 * Alcance LIVRE (m) ao longo do eixo da onda pelo campo de distâncias da simulação (sand.js, recalculado com obstáculos móveis): marcha a linha
 * central em passos de ¼ de célula e para na primeira célula bloqueada/inalcançável (Infinity) ou que a frente só alcança contornando
 * (distância de caminho bem maior que a reta: `dist − u > 1,5·célula + 9 %·u`, folga da grade octal). Sem obstáculo no eixo devolve `length`
 * (nenhum corte: o desenho fica idêntico). Sem campo (ainda não calculado) devolve `length`.
 * @param {any} e entidade sandwave @param {any} [field] @returns {number}
 */
export function freeReachOf(e, field = sandFieldOf(e)) {
  const len = e.length ?? 4;
  if (!field || !e?.pos || !e?.dir) return len;
  const {minX, minZ, nx, nz, cs, dist} = field, ds = cs / 4;
  for (let u = 0; u <= len + 1e-9; u += ds) {
    const x = e.pos.x + e.dir.x * u, z = e.pos.z + e.dir.z * u;
    const ix = Math.floor((x - minX) / cs), iz = Math.floor((z - minZ) / cs);
    if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return Math.min(len, u);
    const d = dist[iz * nx + ix];
    if (!Number.isFinite(d) || d - u > 1.5 * cs + .09 * u) return Math.min(len, u);
  }
  return len;
}

/** Corta o desenho da onda no alcance livre: frentes, jatos de poeira/grão e o impacto final não passam de `reach` (eixo local z: −len/2 … +len/2). @param {any} state @param {number} reach */
function clipToReach(state, reach) {
  const fx = state.fx, half = state.len / 2, maxZ = -half + reach;
  let drawn = 0;
  for (const {head} of fx.fronts ?? []) if (head.visible) drawn = Math.max(drawn, head.position.z + half);
  state.drawnLength = Math.min(state.len, Math.max(0, drawn));
  if (reach < state.len - 1e-9) {
    for (const {head} of fx.fronts ?? []) if (head.position.z > maxZ) head.position.z = maxZ;
    for (const {dust, grain} of fx.streams ?? []) {if (dust?.emitter && dust.emitter.position.z > maxZ) dust.emitter.position.z = maxZ;if (grain?.emitter && grain.emitter.position.z > maxZ) grain.emitter.position.z = maxZ;}
    for (const sh of fx.shocks ?? []) sh.position.z = maxZ;
    if (fx.rubble) fx.rubble.position.z = maxZ;
  } else if (fx.rubble) fx.rubble.position.z = half;   // obstáculo móvel saiu do eixo: o impacto volta ao fim do retângulo

  state.visibleLength = Math.min(state.drawnLength, reach);
}

/**
 * Idade VISUAL (s) da onda viva, pela frente física: o tempo em que uma frente linear (length ÷ active) chegaria à distância que a simulação
 * calculou (sandFrontAt, com a aceleração capturada no disparo). Com o padrão (velocidade derivada do alcance) é a própria idade da entidade.
 * @param {any} e entidade sandwave @returns {{age: number, front: number}}
 */
function physicalClock(e) {
  const front = Math.min(e.length ?? 4, sandFrontAt(e, e.age ?? 0)), active = Math.max(.05, e.active ?? .75), len = Math.max(1e-6, e.length ?? 4);
  return {front, age: (e.age ?? 0) <= active ? front / len * active : (e.age ?? 0)};
}

/**
 * Aplica as configurações de acessibilidade do jogo aos parâmetros do efeito
 * @param {Record<string, any>} p
 * @param {any} acc
 * @returns {Record<string, any>}
 */
function accessible(p, acc) {
  const res = {...p};
  const reduceMotion = !!(acc?.reduceMotion || C.vfx?.master?.reduceMotion);
  const noFlash = !!(acc?.noFlash || C.vfx?.master?.noFlash);
  if (reduceMotion) {
    for (const k of ['density', 'particleDensity', 'sparks', 'flash', 'emissivity', 'shards']) if (k in res) res[k] *= .45;
    if ('impactIntensity' in res) res.impactIntensity *= .7;
    for (const k of ['turn', 'angularSpeed', 'twist', 'spiral', 'undulation']) if (k in res) res[k] *= .3;
  }
  if (noFlash) {
    for (const k of ['flash', 'halo', 'shotRecoilFlash']) if (k in res) res[k] = 0;
    for (const k of ['coreGlow', 'edgeGlow', 'veinGlow', 'emissivity', 'glow']) if (k in res) res[k] *= .4;
  }
  return res;
}

/**
 * @param {Record<string, any>} [over]
 * @returns {Record<string, any>}
 */
function paramsOf(over = {}) {
  return {...defaults.sand, ...ATELIER_GAME_PARAMS.sand, ...over};
}

/**
 * Verifica se a entidade informada é uma onda de areia
 * @param {any} e
 * @returns {boolean}
 */
export function handles(e) {
  return !!e && e.kind === 'sandwave';
}

/**
 * Assinatura visual para detectar mudanças em tempo real no ateliê / acessibilidade / sliders
 * @param {any} e
 * @param {any} acc
 * @returns {string}
 */
export function signatureOf(e, acc) {
  return JSON.stringify([
    acc?.noFlash || C.vfx?.master?.noFlash,
    acc?.reduceMotion || C.vfx?.master?.reduceMotion,
    ATELIER_GAME_VARIANT.sand,
    paramsOf()
  ]);
}

/**
 * Cria a representação visual da barragem no mundo 3D
 * @param {any} view
 * @param {any} e
 * @param {any} acc
 */
export function spawn(view, e, acc) {
  const parent = view.group ?? view;
  const group = new T.Group();
  parent.add(group);

  const batch = view.atelierFx?.batch ?? view.elementalFx?.batch;
  const particles = new Particles(group, /** @type {any} */ (batch ? {renderer: batch, emitterParent: group} : {emitterParent: group}));

  const len = e.length ?? 4, width = e.width ?? 3, dir = e.dir ?? {x: 0, z: 1};
  const p = accessible(paramsOf({length: len, width, flightTime: Math.max(.05, e.active ?? .75)}), acc);

  group.position.set(e.pos.x + dir.x * len / 2, e.y ?? 0, e.pos.z + dir.z * len / 2);
  group.rotation.y = Math.atan2(dir.x, dir.z);

  const fx = new SandEffect(group, particles, ATELIER_GAME_VARIANT.sand, p);
  const start = p.startOn !== 0 ? fx.cast : 0;
  const clock = fx.timeline ? new PhaseClock(/** @type {any} */ (fx.timeline()), p) : null;

  return {
    group,
    particles,
    fx,
    clock,
    start,
    age: 0,
    len,
    dir,
    pos: e.pos,
    y: e.y ?? 0,
    front: 0,
    entity: e,
    reach: len,
    drawnLength: 0,
    visibleLength: 0,
    dying: false
  };
}

/**
 * Atualiza a animação visual por frame
 * @param {any} view
 * @param {any} e
 * @param {any} state
 * @param {number} dt
 * @param {any} acc
 */
export function update(view, e, state, dt, acc) {
  if (!state) return;
  // F5: viva, a onda segue o relógio FÍSICO (idade/frente da entidade): quadros perdidos ou dt do desenho não adiantam nem atrasam a frente visual.
  // Na dissipação (entidade fora do mundo) o relógio continua pelo dt.
  if (e && !state.dying && Number.isFinite(e.age)) {const k = physicalClock(e);state.age = k.age;state.front = k.front;}
  else state.age += dt;
  const total = state.clock ? state.clock.duration : state.fx.duration;
  const t = Math.min(total, state.start + state.age);

  state.fx.update(state.clock ? state.clock.map(t) : t, dt);
  // F5: a frente visual não atravessa obstáculos — corta no alcance livre do campo de distâncias da simulação (rota física).
  state.reach = freeReachOf(e ?? state.entity);
  clipToReach(state, state.reach);
  state.particles.update(dt);
}

/**
 * Transição para a fase de dissipação quando a entidade da simulação expira
 * @param {any} view
 * @param {any} e
 * @param {any} state
 */
export function onDeath(view, e, state) {
  if (!state) return;
  state.dying = true;
}

/**
 * Atualiza a dissipação de poeira pós-expiração
 * @param {any} view
 * @param {any} e
 * @param {any} state
 * @param {number} dt
 * @param {any} acc
 */
export function updateDying(view, e, state, dt, acc) {
  update(view, e, state, dt, acc);
}

/**
 * Determina se a dissipação de poeira e partículas foi concluída (+0.4s de cauda após a expiração da simulação)
 * @param {any} state
 * @param {number} age
 * @returns {boolean}
 */
export function isFinished(state, age) {
  return age >= 0.4;
}

/**
 * Reage a eventos do simulador (impactos de areia)
 * @param {any} view
 * @param {any} ev
 * @param {any} state
 */
export function onEvent(view, ev, state) {
  if (!state || !state.particles) return;
  const impacts = ['impact', 'partial', 'clash', 'obstacleHit', 'destructibleHit', 'wallSplat', 'sandStagger'];
  if (!impacts.includes(ev.result)) return;
  // F5: ponto de contato = o do EVENTO (a simulação grava x/z dos pés do alvo no contato). Sem ele: o alvo do evento; sem alvo: a FRENTE física
  // da onda no eixo (nunca o meio do retângulo nem o extremo). Coordenadas da simulação = espaço do pai do grupo (o mundo do jogo).
  const fighters = view?.fighters ?? view?.worldView?.fighters ?? [];
  const b = ev.target != null ? fighters[ev.target] : null;
  /** @type {{x: number, y: number, z: number}} */
  let at;
  if (Number.isFinite(ev.x) && Number.isFinite(ev.z)) at = {x: ev.x, y: Number.isFinite(ev.y) ? ev.y : (b?.groundY ?? state.y ?? 0) + CONTACT_Y, z: ev.z};
  else if (b?.position) at = {x: b.position.x, y: (b.groundY ?? 0) + CONTACT_Y, z: b.position.z};
  else {const u = Math.min(state.len ?? 0, state.front ?? 0);at = {x: state.pos.x + state.dir.x * u, y: (state.y ?? 0) + CONTACT_Y, z: state.pos.z + state.dir.z * u};}
  // Conversão canônica (coords.js): ponto por worldToLocal; direção do empurrão pelo quaternion mundial inverso (inversa linear se houver escala não uniforme).
  const local = state.group ? parentPointToLocal(state.group, at) : new T.Vector3(at.x, at.y, at.z);
  const n = ev.normal, hasN = n && (Math.abs(n.x) > 1e-4 || Math.abs(n.z) > 1e-4);
  const dir = hasN ? (state.group ? parentDirToLocal(state.group, {x: n.x, y: .4, z: n.z}) : new T.Vector3(n.x, .4, n.z).normalize()) : new T.Vector3(0, 1, 0);
  const o = {kind: 'dust', color: 0xc49c68, count: 24, position: [local.x, local.y, local.z], direction: [dir.x, Math.max(0.2, dir.y), dir.z], speed: 3.0, size: 0.45, life: 0.6};
  if (typeof state.particles.burst === 'function') state.particles.burst(o);
  else state.particles.create({...o, duration: 0.2, radius: 0.4});
}

/**
 * Retorna a posição central do efeito visual
 * @param {any} state
 * @returns {{x: number, y: number, z: number} | null}
 */
export function positionOf(state) {
  if (!state?.pos) return null;
  return {
    x: state.pos.x + state.dir.x * state.len / 2,
    y: state.y,
    z: state.pos.z + state.dir.z * state.len / 2,
  };
}

/**
 * Libera memória, texturas, geometrias e remove da cena
 * @param {any} view
 * @param {any} e
 * @param {any} state
 */
export function dispose(view, e, state) {
  if (!state) return;
  state.particles.clear();
  disposeGroup(state.group);
  state.group.removeFromParent();
}
