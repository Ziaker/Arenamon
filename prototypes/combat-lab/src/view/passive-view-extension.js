// Extensão runtime do View para integração de passivas.
// Este módulo PATCHA o View.prototype em tempo de execução, evitando
// modificações no arquivo view.js (que é grande e propenso a conflitos).
//
// Uso: import './passive-view-extension.js' no main.js ANTES de criar o View.

import {View} from './view.js';
import {PassiveFx} from './vfx/effects/passives.js';
import {soundFx} from './audio.js';
import {passiveToast} from '../ui/passive-toast.js';
import {C} from '../sim/config.js';

const _origDraw = View.prototype.draw;
const _origReset = View.prototype.reset;

// Patch construtor para inicializar PassiveFx
const _origConstructor = View.prototype.constructor;
// Não podemos patchar o construtor diretamente, então usamos um init separado

/**
 * Inicializa o sistema de passivas em uma instância de View.
 * Chamar após criar o View: initPassivesOnView(view)
 */
export function initPassivesOnView(view) {
  if (view.passiveFx) return;
  view.passiveFx = new PassiveFx(view.scene);
  // Substitui draw para incluir update de passivas
  const origDraw = view.draw.bind(view);
  view.draw = function(...args) {
    const result = origDraw(...args);
    const vfxDt = args[3]?.paused ? 0 : Math.min(args[3]?.dt ?? 1 / 60, 0.05);
    if (view.passiveFx) {
      view.passiveFx.update(vfxDt, {visible: !!C.extras.hud.fxVisible});
    }
    return result;
  };
  // Substitui reset para limpar passivas
  const origReset = view.reset.bind(view);
  view.reset = function(...args) {
    origReset(...args);
    view.passiveFx?.reset();
  };
}

/**
 * Spawna o efeito da Passiva A (Orbital Halo) no lutador.
 */
export function spawnPassiveA(view, fighterId, position, opts = {}) {
  if (!view.passiveFx) initPassivesOnView(view);
  const id = view.passiveFx.spawnOrbitalHalo(position, opts);
  soundFx.playPassiveA();
  passiveToast.show('A', {fighter: fighterId === 0 ? 'Jogador' : 'Adversário'});
  return id;
}

/**
 * Spawna o efeito da Passiva B (Celestial Intersections) no lutador.
 */
export function spawnPassiveB(view, fighterId, position, opts = {}) {
  if (!view.passiveFx) initPassivesOnView(view);
  const id = view.passiveFx.spawnCelestialIntersections(position, opts);
  soundFx.playPassiveB();
  passiveToast.show('B', {fighter: fighterId === 0 ? 'Jogador' : 'Adversário'});
  return id;
}

/**
 * Spawna o efeito da Passiva C (Luminous Resonance) no lutador.
 */
export function spawnPassiveC(view, fighterId, position, opts = {}) {
  if (!view.passiveFx) initPassivesOnView(view);
  const id = view.passiveFx.spawnLuminousResonance(position, opts);
  soundFx.playPassiveC();
  passiveToast.show('C', {fighter: fighterId === 0 ? 'Jogador' : 'Adversário'});
  return id;
}

/**
 * Desativa um efeito passivo pelo ID.
 */
export function deactivatePassive(view, id) {
  view.passiveFx?.deactivate(id);
}

/**
 * Retorna estatísticas do sistema de passivas.
 */
export function getPassiveStats(view) {
  return view.passiveFx ? view.passiveFx.getStats() : {spawned: 0, peak: 0, active: 0, rejected: 0, passives: 0};
}
