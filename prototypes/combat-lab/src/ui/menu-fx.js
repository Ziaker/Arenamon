// @ts-check
// Feedback visual de seleção das telas A/B/C do pré-jogo, feito com three.quarks (a mesma camada `QuarksFx` do VFX de combate, aqui na cena da prévia 3D de cada lutador):
// ao trocar personagem, Move ou passiva, uma rajada curta nasce no modelo, com a paleta e o jeito do estilo (A faíscas vermelho/amarelo, B estrelas ciano/amarelo/magenta, C partículas suaves
// verde-água/azul). Só aparência: não toca no estado, não roda fora do menu e respeita movimento reduzido (do sistema ou do laboratório) e «sem flash».
import * as T from 'three';
import * as Quarks from 'three.quarks';
import {QuarksFx} from '../view/quarks/adapter.js';
import {QUARKS_PRESETS} from '../view/quarks/presets.js';
import {C} from '../sim/config.js';

/** Presets próprios do menu (mesma linguagem declarativa de view/quarks/presets.js). */
export const MENU_PRESETS = Object.freeze({
  menuA: {label: 'Menu A · faíscas de impacto', continuous: false, duration: .55, looping: false, worldSpace: true, maxParticles: 120, scale: 1, burst: {count: 30, time: 0},
    shape: {type: 'sphere', radius: .12}, startLife: [.22, .5], startSpeed: [2.2, 5.5], startSize: [.05, .13], startColor: {a: 0xff2b3f, b: 0xffd400}, gravity: -2.2,
    sizeOverLife: [1, .85, .4, .05], speedOverLife: [1, .7, .3, .1], colorOverLife: {stops: [{t: 0, color: 0xffffff, alpha: .95}, {t: .35, color: 0xffd400, alpha: .8}, {t: 1, color: 0xff2b3f, alpha: 0}]}},
  menuB: {label: 'Menu B · estrelas de quadrinhos', continuous: false, duration: .7, looping: false, worldSpace: true, maxParticles: 80, scale: 1, burst: {count: 18, time: 0},
    shape: {type: 'sphere', radius: .18}, startLife: [.35, .65], startSpeed: [1.4, 3.4], startSize: [.12, .26], startColor: {a: 0x19b5e8, b: 0xffd60a}, gravity: -1,
    sizeOverLife: [1, 1.15, .6, .05], speedOverLife: [1, .8, .4, .1], colorOverLife: {stops: [{t: 0, color: 0xffffff, alpha: 1}, {t: .4, color: 0xffd60a, alpha: .9}, {t: 1, color: 0xff4fa3, alpha: 0}]}},
  menuC: {label: 'Menu C · partículas suaves', continuous: false, duration: .9, looping: false, worldSpace: true, maxParticles: 100, scale: 1, burst: {count: 22, time: 0},
    shape: {type: 'cone', radius: .3, angle: 40}, direction: {x: 0, y: 1, z: 0}, startLife: [.5, .9], startSpeed: [.6, 1.6], startSize: [.05, .12], startColor: {a: 0x2dd4bf, b: 0x5aa9ff}, gravity: 0,
    sizeOverLife: [1, .9, .5, .05], speedOverLife: [1, .8, .5, .2], colorOverLife: {stops: [{t: 0, color: 0xdff8f4, alpha: .8}, {t: 1, color: 0x5aa9ff, alpha: 0}]}},
});
const KEY = {a: 'menuA', b: 'menuB', c: 'menuC'};

/** Movimento reduzido pedido pelo sistema (prefers-reduced-motion) ou pelo laboratório (vfx.master.reduceMotion). */
export const reducedMotion = () => !!(C.vfx?.master?.reduceMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches));

/**
 * @param {{ok: boolean, scene: any, onTick: (fn: (dt: number) => void) => () => void, modelHeight?: number} | null | undefined} preview prévia do menu (menu-preview.js)
 * @returns {{burst: (style: string, kind?: string) => boolean, stats: {emitted: number, active: number}, dispose: () => void} | null}
 */
export function createMenuFx(preview) {
  if (!preview?.ok || !preview.scene) return null;
  const fx = new QuarksFx({THREE: T, Quarks, scene: preview.scene, accessibility: {reduceMotion: () => !!C.vfx?.master?.reduceMotion}, presets: {...JSON.parse(JSON.stringify(QUARKS_PRESETS)), ...JSON.parse(JSON.stringify(MENU_PRESETS))}});
  const off = preview.onTick(dt => fx.update(dt));
  return {
    /** Dispara a rajada do estilo (`a`/`b`/`c`) no centro do modelo; sem efeito com movimento reduzido do sistema. Devolve se disparou. */
    burst(style, kind = 'move') {
      const name = KEY[style];
      if (!name || reducedMotion()) return false;
      const h = Math.max(.4, preview.modelHeight ?? 1.2), noFlash = !!C.vfx?.master?.noFlash;
      fx.emitBurst(name, {x: 0, y: h * .55, z: 0}, {power: Math.min(2, Math.max(.6, h * .6)) * (kind === 'char' ? 1.3 : 1), countScale: noFlash ? .5 : 1});
      return true;
    },
    get stats() {return fx.stats;},
    dispose() {off();fx.dispose();},
  };
}
