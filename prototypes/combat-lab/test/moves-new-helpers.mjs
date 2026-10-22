// Auxiliares compartilhados pelos testes dos Moves novos (um arquivo por Move: moves-<id>.test.mjs).
// Este teste caracteriza a mecânica nos valores de FÁBRICA do laboratório (factoryDefaults); a base de calibração v8 é coberta por calibration-base.test.mjs e pelos testes de colisão/ambiente.
import assert from 'node:assert/strict';
import {C, factoryDefaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {clearMoves} from '../src/sim/moves.js';
import {clearEffects} from '../src/sim/move-effects.js';

export {assert, C, factoryDefaults, resetConfig, Game, emptyCommand, vec};
export const cmd = o => ({...emptyCommand(), ...o});
export const HOLD = i => [0, 1, 2, 3].map(k => k === i);
export const DT = 1 / 120;
export const secs = s => Math.round(s / DT);

/** Contador/relato simples no estilo dos demais testes do laboratório. */
export function suite(title) {
  let passed = 0, failed = 0;
  console.log(`\n--- ${title} ---\n`);
  return {
    test(name, fn) {try {fn();passed++;console.log(`  ✓ ${name}`);} catch (e) {failed++;console.error(`  ✗ ${name}: ${e.message}`);}},
    done() {console.log(`\n${passed} passaram, ${failed} falharam`);if (failed) process.exit(1);},
  };
}

/**
 * Arena neutra: sem plataformas/obstáculos/itens, IA do vermelho desligada, azul em (0,-3) olhando +z e vermelho em (0,3).
 * `equip` equipa os Moves no slot 0 do azul (e `equipRed` no do vermelho).
 */
export function arena({equip = [], equipRed = [], setup = null, positions = [vec(0, -3), vec(0, 3)]} = {}) {
  resetConfig(factoryDefaults());
  clearMoves();clearEffects();registerStandardMoves();
  setup?.();
  C.extras.toggles.enableEnemyAI = 0;
  const g = new Game({seed: 3});g.start();
  g.reset({positions});
  g.mapState.platforms = [];g.mapState.obstacles = [];g.mapState.destructibles = [];g.mapState.items = [];g.mapState.regularSpawnTimer = 1e9;
  g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
  if (equip.length) g.setLoadout(0, equip);
  if (equipRed.length) g.setLoadout(1, equipRed);
  return g;
}
/** Um passo com comandos do azul (c0) e do vermelho (c1). */
export const step = (g, c0 = cmd(), c1 = cmd()) => g.step(c0, c1);
export const run = (g, n, c0 = () => cmd(), c1 = () => cmd()) => {for (let i = 0; i < n; i++) g.step(c0(i), c1(i));};
/** Toque (borda) no slot. */
export const press = (g, slot, extra = {}) => g.step(cmd({skill: slot, skillHeld: HOLD(slot), ...extra}), cmd());
export const status = (f, id) => f.statuses?.find(s => s.id === id) ?? null;
/** Tackle do vermelho contra o azul (parte de perto); devolve os passos até o impacto (ou -1). */
export function redTackle(g, maxSteps = 200) {
  for (let i = 0; i < maxSteps; i++) {
    g.step(cmd(), cmd({tackle: i === 0, move: vec(0, -1)}));
    if (g.lastStepEvents.some(e => e.result === 'impact' || e.result === 'partial' || e.result === 'perfect')) return i;
  }
  return -1;
}
/** Hash resumido do estado dos lutadores (paridade/determinismo). */
export const fighterHash = g => JSON.stringify(g.fighters.map(f => [f.position, f.velocity, f.hp, f.stamina, f.groundY, f.state, (f.statuses ?? []).map(s => [s.id, +s.remaining.toFixed(4)])]));
