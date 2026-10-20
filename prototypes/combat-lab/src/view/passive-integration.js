// Integração do sistema de passivas (PassiveFx) ao View existente.
// Este módulo estende o View.prototype para adicionar spawn de efeitos de passivas
// sem modificar o arquivo view.js diretamente (reduzindo risco de conflitos).

import {PassiveFx} from './vfx/effects/passives.js';
import {makePassiveEvent} from './vfx/contract.js';
import {soundFx} from './audio.js';
import {passiveToast} from '../ui/passive-toast.js';

/**
 * Inicializa o sistema de passivas no View.
 * Chamar uma vez após a criação do View.
 */
export function initPassiveFx(view) {
  if (view.passiveFx) return;
  view.passiveFx = new PassiveFx(view.scene);
}

/**
 * Atualiza o sistema de passivas por quadro.
 * Chamar dentro do loop de draw do View.
 */
export function updatePassiveFx(view, dt, opts = {}) {
  if (view.passiveFx) {
    view.passiveFx.update(dt, opts);
  }
}

/**
 * Reseta o sistema de passivas.
 */
export function resetPassiveFx(view) {
  if (view.passiveFx) {
    view.passiveFx.reset();
  }
}

/**
 * Ativa a passiva A (Orbital Halo) no lutador especificado.
 */
export function spawnPassiveA(view, fighterId, position, opts = {}) {
  if (!view.passiveFx) initPassiveFx(view);
  const id = view.passiveFx.spawnOrbitalHalo(position, opts);
  soundFx.playPassiveA();
  passiveToast.show('A', {fighter: fighterId === 0 ? 'Jogador' : 'Adversário'});
  return id;
}

/**
 * Ativa a passiva B (Celestial Intersections) no lutador especificado.
 */
export function spawnPassiveB(view, fighterId, position, opts = {}) {
  if (!view.passiveFx) initPassiveFx(view);
  const id = view.passiveFx.spawnCelestialIntersections(position, opts);
  soundFx.playPassiveB();
  passiveToast.show('B', {fighter: fighterId === 0 ? 'Jogador' : 'Adversário'});
  return id;
}

/**
 * Ativa a passiva C (Luminous Resonance) no lutador especificado.
 */
export function spawnPassiveC(view, fighterId, position, opts = {}) {
  if (!view.passiveFx) initPassiveFx(view);
  const id = view.passiveFx.spawnLuminousResonance(position, opts);
  soundFx.playPassiveC();
  passiveToast.show('C', {fighter: fighterId === 0 ? 'Jogador' : 'Adversário'});
  return id;
}

/**
 * Desativa um efeito passivo pelo ID.
 */
export function deactivatePassive(view, id) {
  if (view.passiveFx) {
    view.passiveFx.deactivate(id);
  }
}

/**
 * Retorna estatísticas do sistema de passivas.
 */
export function getPassiveStats(view) {
  return view.passiveFx ? view.passiveFx.getStats() : {spawned: 0, peak: 0, active: 0, rejected: 0, passives: 0};
}
