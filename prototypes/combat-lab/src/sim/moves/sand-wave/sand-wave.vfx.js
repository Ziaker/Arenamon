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

export const id = 'sand-wave';

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
  state.age += dt;
  const total = state.clock ? state.clock.duration : state.fx.duration;
  const t = Math.min(total, state.start + state.age);

  state.fx.update(state.clock ? state.clock.map(t) : t, dt);
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
  if (impacts.includes(ev.result)) {
    // Determinar o ponto de contato real no espaço de mundo
    let wx = ev.x, wy = ev.y, wz = ev.z;
    if (wx == null || wz == null) {
      if (ev.target != null && view.fighters?.[ev.target]) {
        const b = view.fighters[ev.target];
        wx = b.position.x;
        wy = (b.groundY ?? 0) + (b.flight?.y ?? b.vaultHeight ?? 0) + 0.35;
        wz = b.position.z;
      } else if (state.pos) {
        // Posição média do alcance da onda (evita nascer na extremidade distante)
        wx = state.pos.x + state.dir.x * (state.len * 0.5);
        wy = state.y ?? 0.3;
        wz = state.pos.z + state.dir.z * (state.len * 0.5);
      } else {
        wx = 0; wy = 0.3; wz = 0;
      }
    }
    if (wy == null) wy = state.y ?? 0.3;

    // Conversão canônica: transforma coordenadas mundiais no espaço local do grupo
    // garantindo que o emissor filho nasça no ponto exato do alvo, sem deslocamento duplo.
    let localPos = new T.Vector3(wx, wy, wz);
    let localDir = new T.Vector3(0, 1, 0);

    if (state.group) {
      state.group.updateWorldMatrix(true, false);
      localPos = state.group.worldToLocal(localPos.clone());
      if (ev.normal && (Math.abs(ev.normal.x) > 1e-4 || Math.abs(ev.normal.z) > 1e-4)) {
        const worldDir = new T.Vector3(ev.normal.x, 0.4, ev.normal.z).normalize();
        const normalMatrix = new T.Matrix3().getNormalMatrix(state.group.matrixWorld);
        localDir = worldDir.applyMatrix3(normalMatrix).normalize();
      }
    }

    if (typeof state.particles.burst === 'function') {
      state.particles.burst({
        kind: 'dust',
        color: 0xc49c68,
        count: 24,
        position: [localPos.x, localPos.y, localPos.z],
        direction: [localDir.x, Math.max(0.2, localDir.y), localDir.z],
        speed: 3.0,
        size: 0.45,
        life: 0.6
      });
    } else {
      state.particles.create({
        kind: 'dust',
        color: 0xc49c68,
        count: 24,
        duration: 0.2,
        life: 0.6,
        size: 0.45,
        speed: 3.0,
        radius: 0.4,
        position: [localPos.x, localPos.y, localPos.z],
        direction: [localDir.x, Math.max(0.2, localDir.y), localDir.z]
      });
    }
  }
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
