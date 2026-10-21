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
import {bounceDef, bounceEffect, bounceStep} from './bounce.js';
import {riposteDef} from './riposte.js';
import {quickAttackDef, quickAttackSetup, quickAttackStep} from './quick-attack.js';

/** @type {{def: any, effect?: [string, Function], tackle?: [string, Function], hooks?: [string, Function][], steps?: [string, Function][]}[]} */
export const NEW_MOVES = [
  {def: hardenDef, effect: ['harden', hardenEffect]},
  {def: secondWindDef, effect: ['second-wind', secondWindEffect]},
  {def: swiftDef, effect: ['swift', swiftEffect]},
  {def: lungeDef, tackle: ['lunge', lungeSetup]},
  {def: guardBreakDef, tackle: ['guard-break', guardBreakSetup]},
  {def: bounceDef, effect: ['bounce', bounceEffect], steps: [['bounce', bounceStep]]},
  {def: feintDef},
  {def: riposteDef},
  {def: quickAttackDef, tackle: ['quick-attack', quickAttackSetup], hooks: [['quick-attack:step', quickAttackStep]]},
];
export const NEW_MOVE_IDS = NEW_MOVES.map(m => m.def.id);
