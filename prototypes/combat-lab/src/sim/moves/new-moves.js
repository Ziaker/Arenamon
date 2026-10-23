// @ts-check
// Moves NOVOS do Arenamon (genéricos e de Mushroom): tabela {def, effect?: [nome, manipulador], tackle?: [nome, preparação]}. Quem REGISTRA é standard.js
// (regra D2 do teste de arquitetura: só ele chama registerMove) e só o bootstrap do laboratório chama registerStandardMoves. Registrar não equipa: os slots
// continuam vazios e, sem equipar, nada muda no jogo (paridade testada). Plano e ordem: docs/moves-nao-iniciados/PROMPT_IMPLEMENTACAO_MOVES_NOVOS.md.
import {hardenDef, hardenEffect} from './harden.js';
import {secondWindDef, secondWindEffect} from './second-wind.js';
import {swiftDef, swiftEffect} from './swift.js';
import {lungeDef, lungeSetup} from './lunge.js';
import {guardBreakDef, guardBreakSetup} from './guard-break.js';
import {feintDef} from './feint.js';
import {emergingStoneDef, emergingStoneEffect} from './emerging-stone.js';
import {stoneStep} from '../stone.js';
import {bulletPunchDef, bulletPunchSetup, bulletPunchVanish, bulletPunchReturn} from './bullet-punch.js';
import {sandWaveDef, sandWaveEffect} from './sand-wave.js';
import {spikesDef, spikesEffect} from './spikes.js';
import {bounceDef, bounceEffect, bounceStep} from './bounce.js';
import {riposteDef} from './riposte.js';
import {quickAttackDef, quickAttackSetup, quickAttackStep} from './quick-attack.js';
import {waterPulseDef, waterPulseEffect} from './water-pulse.js';
import {fireSpinDef, fireSpinEffect} from './fire-spin.js';
import {airSlashDef, airSlashEffect} from './air-slash.js';
import {seedBombDef, seedBombEffect} from './seed-bomb.js';

/** @type {{def: any, effect?: [string, Function], tackle?: [string, Function], hooks?: [string, Function][], steps?: [string, Function][], effects?: [string, Function][]}[]} */
export const NEW_MOVES = [
  {def: hardenDef, effect: ['harden', hardenEffect]},
  {def: secondWindDef, effect: ['second-wind', secondWindEffect]},
  {def: swiftDef, effect: ['swift', swiftEffect]},
  {def: lungeDef, tackle: ['lunge', lungeSetup]},
  {def: guardBreakDef, tackle: ['guard-break', guardBreakSetup]},
  {def: bounceDef, effect: ['bounce', bounceEffect], steps: [['bounce', bounceStep]]},
  {def: spikesDef, effect: ['spikes', spikesEffect]},
  {def: sandWaveDef, effect: ['sand-wave', sandWaveEffect]},
  {def: bulletPunchDef, tackle: ['bullet-punch', bulletPunchSetup], effects: [['bullet-punch-vanish', bulletPunchVanish], ['bullet-punch-return', bulletPunchReturn]]},
  {def: emergingStoneDef, effect: ['emerging-stone', emergingStoneEffect], steps: [['stone', stoneStep]]},
  {def: feintDef},
  {def: riposteDef},
  {def: quickAttackDef, tackle: ['quick-attack', quickAttackSetup], hooks: [['quick-attack:step', quickAttackStep]]},
  // Moves elementais (protótipo de 23/10/2026; números do prompt de 22/10, não homologados)
  {def: waterPulseDef, effect: ['water-pulse', waterPulseEffect]},
  {def: fireSpinDef, effect: ['fire-spin', fireSpinEffect]},
  {def: airSlashDef, effect: ['air-slash', airSlashEffect]},
  {def: seedBombDef, effect: ['seed-bomb', seedBombEffect]},
];
export const NEW_MOVE_IDS = NEW_MOVES.map(m => m.def.id);
