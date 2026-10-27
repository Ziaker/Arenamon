// @ts-check
// Visual e partículas do Water Pulse (Documento 02).
// Módulo de renderização consumido exclusivamente pela camada view/ (moves-vfx-registry.js).
// Encapsula o ciclo de vida visual completo do projétil hidráulico (waterorb):
//   - Criação da malha 3D e sistemas de partículas do Ateliê Elemental (three.quarks)
//   - Escala proporcional ao nível de carga (PL1/PL2/PL3) e raio físico
//   - Jatos d'água, rastro espiral e borrifos de impacto / splash
//   - Suporte dinâmico aos interruptores visuais (waterVariant A/B/C, projectilePlBorder, elemental.enabled)
//   - Reconstrução suave a qualquer alteração de sliders de presets visuais em tempo real
//   - Limpeza completa de recursos e respeito à acessibilidade (noFlash/reduceMotion).

import * as THREE from 'three';
import {ElementalPreview} from '../../../view/quarks/elemental-preview.js';
import {ELEMENTAL_GAME_PARAMS} from '../../../view/quarks/elemental-game-params.js';
import {C} from '../../config.js';
import {elementalVisualKey} from '../../elemental-visual-config.js';

export const id = 'water-pulse';

const TAIL_DURATION = 0.6;
const PL_HEX = [0xffffff, 0x59d6e6, 0xffcf6a, 0xff6adf];

const elementalCfg = () => C.vfx?.elemental ?? {};

/** Variante A/B/C do Water Pulse (0, 1 ou 2) */
function variantOf() {
  return Math.max(0, Math.min(2, Math.round(elementalCfg().waterVariant ?? 0)));
}

/**
 * Parâmetros visuais aprovados da variante ativa
 * @param {number} [variant]
 * @returns {Record<string, any>}
 */
function paramsOf(variant = variantOf()) {
  return elementalCfg().visual?.[elementalVisualKey('waterPulse', variant)] ?? ELEMENTAL_GAME_PARAMS.waterPulse?.[variant];
}

/**
 * Calcula o fator de escala geométrica para casar com o raio e o bônus de PL
 * @param {any} e
 * @param {any} base
 * @param {number} pl
 * @returns {number}
 */
function scaleOf(e, base, pl) {
  const eff = Math.max(.05, base.size * (1 + (Math.max(1, Math.min(3, pl)) - 1) * .32));
  return Math.max(.05, (e.radius ?? .38) * (e.visualScale ?? 1) / eff);
}

/**
 * Rotação para a direção horizontal do trajeto do projétil
 * @param {any} e
 * @returns {number}
 */
function headingOf(e) {
  const dx = e?.dir?.x ?? 0, dz = e?.dir?.z ?? 0;
  if (!dx && !dz) return 0;
  return Math.atan2(-dz, dx);
}

/**
 * Sincroniza o anel indicador de Power Level (projectilePlBorder)
 * @param {any} root
 * @param {number} pl
 */
function syncPlBorder(root, pl) {
  const borderOn = !!C.vfx?.projectilePlBorder;
  /** @type {any} */
  let border = root.getObjectByName('plBorder');
  if (borderOn && !border) {
    const plIdx = Math.max(0, Math.min(3, pl));
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, .06, 8, 32),
      new THREE.MeshBasicMaterial({color: PL_HEX[plIdx], transparent: true, opacity: .9, depthWrite: false})
    );
    ring.rotation.x = Math.PI / 2;
    ring.name = 'plBorder';
    root.add(ring);
  } else if (!borderOn && border) {
    border.removeFromParent();
    border.geometry?.dispose();
    border.material?.dispose();
  } else if (borderOn && border) {
    const plIdx = Math.max(0, Math.min(3, pl));
    if (border.material?.color) border.material.color.setHex(PL_HEX[plIdx]);
  }
}

/**
 * Verifica se a entidade informada é o projétil do Water Pulse
 * @param {any} e
 * @returns {boolean}
 */
export function handles(e) {
  if (elementalCfg().enabled === 0) return false;
  return !!e && e.kind === 'projectile' && e.visual === 'waterorb';
}

/**
 * Assinatura dos parâmetros para reconstrução suave caso o usuário altere qualquer slider no painel
 * @param {any} e
 * @param {any} acc
 * @returns {string}
 */
export function signatureOf(e, acc) {
  const v = variantOf();
  return JSON.stringify([
    v,
    paramsOf(v),
    !!C.vfx?.projectilePlBorder,
    e.pl ?? 1,
    !!(acc?.noFlash || C.vfx?.master?.noFlash),
    !!(acc?.reduceMotion || C.vfx?.master?.reduceMotion),
    elementalCfg().enabled !== 0
  ]);
}

/**
 * Cria e inicializa o efeito visual na cena
 * @param {any} view
 * @param {any} e
 * @param {any} acc
 */
export function spawn(view, e, acc) {
  const parent = view.group ?? view;
  const batch = view.elementalFx?.batch ?? view.atelierFx?.batch ?? view.batch;
  const variant = variantOf();
  const base = paramsOf(variant);
  if (!base) return null;

  const pl = e.pl ?? 1;
  /** @type {any} */
  const params = {...base, variant, shotFollowTime: base.shotFollowTime ?? elementalCfg().shotFollowTime ?? .3};

  const preview = new ElementalPreview(parent, {batch, parent});
  preview.root.position.set(e.pos.x, e.y ?? 0, e.pos.z);
  preview.root.rotation.y = headingOf(e);
  const scale = scaleOf(e, base, pl);
  preview.root.scale.setScalar(scale);
  syncPlBorder(preview.root, pl);

  preview.play('waterPulse', params, pl, {
    noFlash: !!(acc?.noFlash || C.vfx?.master?.noFlash),
    reduced: !!(acc?.reduceMotion || C.vfx?.master?.reduceMotion),
    follow: true
  });
  preview.velocity = preview.p?.speed ?? 14;

  return {
    id: e.id,
    entity: e,
    base,
    preview,
    dying: false,
    age: 0,
    pl
  };
}

/**
 * Atualiza a cada quadro enquanto o projétil viaja pela arena
 * @param {any} view
 * @param {any} e
 * @param {any} state
 * @param {number} dt
 * @param {any} acc
 */
export function update(view, e, state, dt, acc) {
  if (!state || !state.preview) return;

  if (!state.dying && e && e.pos) {
    state.preview.root.position.set(e.pos.x, e.y ?? 0, e.pos.z);
    state.preview.root.rotation.y = headingOf(e);
    const scale = scaleOf(e, state.base, e.pl ?? state.pl ?? 1);
    state.preview.root.scale.setScalar(scale);
    syncPlBorder(state.preview.root, e.pl ?? state.pl ?? 1);
  }

  state.preview.noFlash = !!(acc?.noFlash || C.vfx?.master?.noFlash);
  state.preview.reduced = !!(acc?.reduceMotion || C.vfx?.master?.reduceMotion);
  state.preview.update(dt);
}

/**
 * Mantém a expansão e dissipação das partículas de splash após o impacto
 * @param {any} view
 * @param {any} e
 * @param {any} state
 * @param {number} dt
 * @param {any} acc
 */
export function updateDying(view, e, state, dt, acc) {
  if (!state || !state.preview) return;
  state.preview.noFlash = !!(acc?.noFlash || C.vfx?.master?.noFlash);
  state.preview.reduced = !!(acc?.reduceMotion || C.vfx?.master?.reduceMotion);
  state.preview.update(dt);
}

/**
 * Ativa a animação de impacto/splash quando o projétil atinge o alvo ou some
 * @param {any} view
 * @param {any} e
 * @param {any} state
 */
export function onDeath(view, e, state) {
  if (!state || !state.preview) return;
  if (!state.dying) {
    state.dying = true;
    state.age = 0;
    state.preview.contact();
  }
  if (state.preview?.core) state.preview.core.visible = false;
}

/**
 * Informa se o ciclo de dissipação de 2.4s da água terminou
 * @param {any} state
 * @param {number} age
 * @returns {boolean}
 */
export function isFinished(state, age) {
  return age >= TAIL_DURATION;
}

/**
 * Dispara a animação de impacto/splash ao acertar um alvo ou parede
 * @param {any} view
 * @param {any} ev
 * @param {any} state
 */
export function onEvent(view, ev, state) {
  if (!state || !state.preview) return;
  const triggers = ['hit', 'impact', 'partial', 'perfect', 'wallClash', 'clash', 'shieldDeflect', 'expire', 'groundHit', 'arenaHit', 'obstacleHit', 'destructibleHit', 'platformHit', 'blocked', 'reflected'];
  if (!state.dying && triggers.includes(ev.result)) {
    state.dying = true;
    state.age = 0;
    state.preview.contact(ev);
  }
}

/**
 * Obtém a posição tridimensional da esfera de água
 * @param {any} state
 * @returns {{x: number, y: number, z: number} | null}
 */
export function positionOf(state) {
  if (!state?.preview?.root) return null;
  return state.preview.root.position;
}

/**
 * Descarta e libera malhas, emissores de quarks e materiais
 * @param {any} view
 * @param {any} e
 * @param {any} state
 */
export function dispose(view, e, state) {
  if (!state || !state.preview) return;
  /** @type {any} */
  const border = state.preview.root.getObjectByName('plBorder');
  if (border) {
    border.removeFromParent();
    border.geometry?.dispose();
    border.material?.dispose();
  }
  state.preview.dispose();
}
