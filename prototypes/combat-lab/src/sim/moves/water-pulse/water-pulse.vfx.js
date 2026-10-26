// @ts-check
// Visual e partículas do Water Pulse (Documento 02).
// Módulo de renderização consumido exclusivamente pela camada view/ (moves-vfx-registry.js).
// Encapsula o ciclo de vida visual completo do projétil hidráulico (waterorb):
//   - Criação da malha 3D e sistemas de partículas do Ateliê Elemental (three.quarks)
//   - Escala proporcional ao nível de carga (PL1/PL2/PL3) e raio físico
//   - Jatos d'água, rastro espiral e borrifos de impacto / splash
//   - Suporte dinâmico aos interruptores visuais (waterVariant A/B/C, projectilePlBorder, elemental.enabled)
//   - Limpeza completa de recursos e respeito à acessibilidade (noFlash/reduceMotion).

import * as THREE from 'three';
import {ElementalPreview} from '../../../view/quarks/elemental-preview.js';
import {ELEMENTAL_GAME_PARAMS} from '../../../view/quarks/elemental-game-params.js';
import {C} from '../../config.js';
import {elementalVisualKey} from '../../elemental-visual-config.js';

export const id = 'water-pulse';

const TAIL_DURATION = 2.4;
const PL_HEX = [0xffffff, 0x59d6e6, 0xffcf6a, 0xff6adf];

const elementalCfg = () => C.vfx?.elemental ?? {};

/** Variante A/B/C do Water Pulse (0, 1 ou 2) */
function variantOf() {
  return Math.max(0, Math.min(2, Math.round(elementalCfg().waterVariant ?? 0)));
}

/** Parâmetros visuais aprovados da variante ativa */
function paramsOf(variant = variantOf()) {
  return elementalCfg().visual?.[elementalVisualKey('waterPulse', variant)] ?? ELEMENTAL_GAME_PARAMS.waterPulse?.[variant];
}

/** Calcula o fator de escala geométrica para casar com o raio e o bônus de PL */
function scaleOf(e, base, pl) {
  const eff = Math.max(.05, base.size * (1 + (Math.max(1, Math.min(3, pl)) - 1) * .32));
  return Math.max(.05, (e.radius ?? .38) * (e.visualScale ?? 1) / eff);
}

/** Rotação para a direção horizontal do trajeto do projétil */
function headingOf(e) {
  const dx = e?.dir?.x ?? 0, dz = e?.dir?.z ?? 0;
  if (!dx && !dz) return 0;
  return Math.atan2(-dz, dx);
}

/** Sincroniza o anel indicador de Power Level (projectilePlBorder) */
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

/** Verifica se a entidade informada é o projétil do Water Pulse */
export function handles(e) {
  if (elementalCfg().enabled === 0) return false;
  return !!e && e.kind === 'projectile' && e.visual === 'waterorb';
}

/** Assinatura dos parâmetros para reconstrução suave caso o usuário altere no painel */
export function signatureOf(e, acc) {
  return JSON.stringify([
    variantOf(),
    !!C.vfx?.projectilePlBorder,
    e.pl ?? 1,
    !!(acc?.noFlash || C.vfx?.master?.noFlash),
    !!(acc?.reduceMotion || C.vfx?.master?.reduceMotion),
    elementalCfg().enabled !== 0
  ]);
}

/** Cria e inicializa o efeito visual na cena */
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

/** Atualiza a cada quadro enquanto o projétil viaja pela arena */
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

/** Mantém a expansão e dissipação das partículas de splash após o impacto */
export function updateDying(view, e, state, dt, acc) {
  if (!state || !state.preview) return;
  state.preview.noFlash = !!(acc?.noFlash || C.vfx?.master?.noFlash);
  state.preview.reduced = !!(acc?.reduceMotion || C.vfx?.master?.reduceMotion);
  state.preview.update(dt);
}

/** Ativa a animação de impacto/splash quando o projétil atinge o alvo ou some */
export function onDeath(view, e, state) {
  if (!state || !state.preview) return;
  if (!state.dying) {
    state.dying = true;
    state.age = 0;
    state.preview.contact();
  }
}

/** Informa se o ciclo de dissipação de 2.4s da água terminou */
export function isFinished(state, age) {
  return age >= TAIL_DURATION;
}

/** Dispara a animação de impacto/splash ao acertar um alvo ou parede */
export function onEvent(view, ev, state) {
  if (!state || !state.preview) return;
  if (!state.dying && (ev.result === 'hit' || ev.result === 'wallClash' || ev.result === 'clash' || ev.result === 'shieldDeflect' || ev.result === 'expire' || ev.result === 'groundHit' || ev.result === 'arenaHit')) {
    state.dying = true;
    state.age = 0;
    state.preview.contact(ev);
  }
}

/** Obtém a posição tridimensional da esfera de água */
export function positionOf(state) {
  if (!state?.preview?.root) return null;
  return state.preview.root.position;
}

/** Descarta e libera malhas, emissores de quarks e materiais */
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
