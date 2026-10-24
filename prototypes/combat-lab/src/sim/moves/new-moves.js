// @ts-check
// Moves NOVOS do Arenamon (genéricos e de Mushroom): tabela {def, effect?: [nome, manipulador], tackle?: [nome, preparação]}. Quem REGISTRA é standard.js
// (regra D2 do teste de arquitetura: só ele chama registerMove) e só o bootstrap do laboratório chama registerStandardMoves. Registrar não equipa: os slots
// continuam vazios e, sem equipar, nada muda no jogo (paridade testada). Plano e ordem: docs/moves-nao-iniciados/PROMPT_IMPLEMENTACAO_MOVES_NOVOS.md.
import {FICHAS} from './fichas.generated.js';
import {emergingStoneDef, emergingStoneEffect} from './emerging-stone.js';
import {stoneStep} from '../stone.js';
import {bulletPunchDef, bulletPunchSetup, bulletPunchVanish, bulletPunchReturn} from './bullet-punch.js';
import {sandWaveDef, sandWaveEffect} from './sand-wave.js';
import {spikesDef, spikesEffect} from './spikes.js';
import {waterPulseDef, waterPulseEffect} from './water-pulse.js';
import {fireSpinDef, fireSpinEffect} from './fire-spin.js';
import {airSlashDef, airSlashEffect} from './air-slash.js';
import {seedBombDef, seedBombEffect} from './seed-bomb.js';

/** @type {import('./params-registry.js').Ficha[]} */
export const NEW_MOVES = [
  {def: spikesDef, effect: ['spikes', spikesEffect]},
  {def: sandWaveDef, effect: ['sand-wave', sandWaveEffect]},
  {def: bulletPunchDef, tackle: ['bullet-punch', bulletPunchSetup], effects: [['bullet-punch-vanish', bulletPunchVanish], ['bullet-punch-return', bulletPunchReturn]]},
  {def: emergingStoneDef, effect: ['emerging-stone', emergingStoneEffect], steps: [['stone', stoneStep]]},
  // Moves elementais (protótipo de 23/10/2026; números do prompt de 22/10, não homologados)
  {def: waterPulseDef, effect: ['water-pulse', waterPulseEffect]},
  {def: fireSpinDef, effect: ['fire-spin', fireSpinEffect]},
  {def: airSlashDef, effect: ['air-slash', airSlashEffect]},
  {def: seedBombDef, effect: ['seed-bomb', seedBombEffect]},
  // Moves em FICHA (um arquivo só, índice automático): ver docs/COMO_CRIAR_UM_MOVE.md
  ...FICHAS,
];
/** Ordem histórica dos Moves nos menus: os migrados para ficha mantêm o lugar de antes; Moves novos em ficha vêm depois. */
const ORDEM = ['harden', 'second-wind', 'swift', 'lunge', 'guard-break', 'bounce', 'spikes', 'sand-wave', 'bullet-punch', 'emerging-stone', 'feint', 'riposte', 'quick-attack', 'water-pulse', 'fire-spin', 'air-slash', 'seed-bomb'];
NEW_MOVES.sort((a, b) => (ORDEM.indexOf(a.def.id) + 1 || 999) - (ORDEM.indexOf(b.def.id) + 1 || 999));
export const NEW_MOVE_IDS = NEW_MOVES.map(m => m.def.id);
