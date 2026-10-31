// Sprint em qualquer direção (view/sprint-turn.js): divisão do giro entre corpo, tronco e cabeça, quem usa o giro e o giro limitado das pernas.
// Uso: node prototypes/combat-lab/test/sprint-turn.test.mjs
import assert from 'node:assert/strict';
import {C} from '../src/sim/config.js';
import {splitSprintTurn, sprintUsesTurn, updateSprintTurn} from '../src/view/sprint-turn.js';

const D = Math.PI / 180, lim = {torsoMax: 60, headMax: 45, backAngle: 110};
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} ≠ ${b}`);

// Correndo para o lado (90°): tronco volta 60° e a cabeça os 30° restantes — o rosto fica no rival.
let s = splitSprintTurn(90 * D, lim);
near(s.torso, -60 * D, 'tronco a 90°');near(s.head, -30 * D, 'cabeça a 90°');near(s.body + s.torso + s.head, 0, 'rosto no rival');
// Diagonal (40°): só o tronco desfaz o giro.
s = splitSprintTurn(-40 * D, lim);near(s.torso, 40 * D, 'tronco a −40°');near(s.head, 0, 'cabeça a −40°');
// De costas (180°): tronco solto, cabeça no limite.
s = splitSprintTurn(Math.PI - 1e-3, lim);near(s.torso, 0, 'tronco de costas');near(Math.abs(s.head), 45 * D, 'cabeça de costas');

// Quem usa: só quem tem sprint e NÃO tem os três direcionais.
const fake = own => ({variantsOf: id => own.includes(id) ? [0] : []});
assert.equal(sprintUsesTurn(fake(['sprint'])), true, 'só sprint para a frente → gira');
assert.equal(sprintUsesTurn(fake(['sprint', 'sprint_left'])), false, 'tem direcional → como sempre');
assert.equal(sprintUsesTurn(fake([])), false, 'sem sprint → como sempre');
const prev = C.extras.sprintTurn.sprintTurnOn;C.extras.sprintTurn.sprintTurnOn = 0;
assert.equal(sprintUsesTurn(fake(['sprint'])), false, 'desligado → como sempre');
C.extras.sprintTurn.sprintTurnOn = prev;

// Pernas giram no máximo sprintTurnLegRate °/s e voltam a zero quando o sprint acaba.
const ch = {...fake(['sprint']), current: {key: 'sprint'}};
const f = {sprinting: true, visualFacing: 0, velocity: {x: 5, z: 0}};   // corre para +X = 90° à esquerda do rosto (angleOf = atan2(x, z))
updateSprintTurn(ch, f, .1);
near(ch.sprintTurn.body, C.extras.sprintTurn.sprintTurnLegRate * D * .1, 'giro limitado em 0,1 s');
for (let i = 0; i < 20; i++) updateSprintTurn(ch, f, .1);
near(ch.sprintTurn.body, 90 * D, 'chega a 90°');
f.sprinting = false;for (let i = 0; i < 20; i++) updateSprintTurn(ch, f, .1);
near(ch.sprintTurn.body, 0, 'volta a 0 sem sprint');
assert.equal(updateSprintTurn(ch, f, .1), null, 'nada a torcer');
console.log('sprint-turn: ok');
