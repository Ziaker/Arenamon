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

export const id = 'sand-wave';

/** Aplica as configurações de acessibilidade do jogo aos parâmetros do efeito */
function accessible(p, acc) {
  const res = {...p};
  if (acc?.reduceMotion) {
    for (const k of ['density', 'particleDensity', 'sparks', 'flash', 'emissivity', 'shards']) if (k in res) res[k] *= .45;
    if ('impactIntensity' in res) res.impactIntensity *= .7;
    for (const k of ['turn', 'angularSpeed', 'twist', 'spiral', 'undulation']) if (k in res) res[k] *= .3;
  }
  if (acc?.noFlash) {
    for (const k of ['flash', 'halo', 'shotRecoilFlash']) if (k in res) res[k] = 0;
    for (const k of ['coreGlow', 'edgeGlow', 'veinGlow', 'emissivity', 'glow']) if (k in res) res[k] *= .4;
  }
  return res;
}

function paramsOf(over = {}) {
  return {...defaults.sand, ...ATELIER_GAME_PARAMS.sand, ...over};
}

/** Verifica se a entidade informada é uma onda de areia */
export function handles(e) {
  return !!e && e.kind === 'sandwave';
}

/** Cria a representação visual da barragem no mundo 3D */
export function spawn(view, e, acc) {
  const parent = view.group ?? view;
  const group = new T.Group();
  parent.add(group);

  const batch = view.atelierFx?.batch ?? view.elementalFx?.batch;
  const particles = new Particles(group, batch ? {renderer: batch, emitterParent: group} : {emitterParent: group});

  const len = e.length ?? 4, width = e.width ?? 3, dir = e.dir ?? {x: 0, z: 1};
  const p = accessible(paramsOf({length: len, width, flightTime: Math.max(.05, e.active ?? .75)}), acc);

  group.position.set(e.pos.x + dir.x * len / 2, e.y ?? 0, e.pos.z + dir.z * len / 2);
  group.rotation.y = Math.atan2(dir.x, dir.z);

  const fx = new SandEffect(group, particles, ATELIER_GAME_VARIANT.sand, p);
  const start = p.startOn !== 0 ? fx.cast : 0;
  const clock = fx.timeline ? new PhaseClock(fx.timeline(), p) : null;

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
  };
}

/** Atualiza a animação visual por frame */
export function update(view, e, state, dt, acc) {
  if (!state) return;
  state.age += dt;
  const total = state.clock ? state.clock.duration : state.fx.duration;
  const t = Math.min(total, state.start + state.age);

  state.fx.update(state.clock ? state.clock.map(t) : t, dt);
  state.particles.update(dt);
}

/** Reage a eventos do simulador (impactos de areia) */
export function onEvent(view, ev, state) {
  // Eventos de impacto podem emitir anel de poeira ou som
}

/** Retorna a posição central do efeito visual */
export function positionOf(state) {
  if (!state?.pos) return null;
  return {
    x: state.pos.x + state.dir.x * state.len / 2,
    y: state.y,
    z: state.pos.z + state.dir.z * state.len / 2,
  };
}

/** Libera memória, texturas, geometrias e remove da cena */
export function dispose(view, e, state) {
  if (!state) return;
  state.particles.clear();
  disposeGroup(state.group);
  state.group.removeFromParent();
}
