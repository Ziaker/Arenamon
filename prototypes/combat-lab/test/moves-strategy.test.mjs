// Testes unitários da Fase 7 — Moves como parte da estratégia central
import {strict as assert} from 'node:assert';
import {createFighter} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {registerMove, clearMoves} from '../src/sim/moves.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {
  getMoveTacticalProfile,
  evaluateMoveOpportunity,
  evaluateChargeContinuation,
  contractCheckMoveStrategy,
  findObstacleBetween,
} from '../src/sim/move-strategy.js';

registerStandardMoves();

const baseAttributes = {hp: 100, attack: 10, defense: 10, speed: 1.0};

console.log('--- Iniciando testes da Fase 7 (Moves como parte da estratégia central) ---');

// 1. Perfil tático dos movimentos registrados
{
  const psyProf = getMoveTacticalProfile('psyshock');
  assert.equal(psyProf.role, 'offensive_ranged');
  assert(psyProf.optimalRange[0] >= 3.0, 'Alcance mínimo deve ser à distância');

  const refProf = getMoveTacticalProfile('reflect');
  assert.equal(refProf.role, 'defensive_shield');
  assert(refProf.minChargeSec >= 1.5, 'Carga mínima do reflect é 1.5s');
  console.log('✓ perfis táticos de movimentos declarados corretamente');
}

// 2. Avaliação de oportunidade de Reflect contra projétil
{
  const self = createFighter(0, baseAttributes, vec(0, 0));
  self.loadout = ['reflect', null];
  const target = createFighter(1, baseAttributes, vec(6, 0));
  const world = {entities: []};

  // Com tempo suficiente para armar barreira: viável
  const threatWithTime = {time: 2.0, pl: 1, id: 10};
  const evalGood = evaluateMoveOpportunity(self, target, 'reflect', 0, world, {distance: 6, threat: threatWithTime});
  assert(evalGood.viable === true, 'Reflect deve ser viável quando há tempo suficiente');
  assert(evalGood.utilityScore > 5, 'Pontuação de utilidade de contra-ataque deve ser alta');

  // Sem projétil a caminho: não é viável carregar barreira à toa
  const evalNoThreat = evaluateMoveOpportunity(self, target, 'reflect', 0, world, {distance: 6, threat: null});
  assert(evalNoThreat.viable === false, 'Reflect não deve iniciar sem ameaça');
  console.log('✓ oportunidade de Reflect avaliada com tempo e utilidade');
}

// 3. Avaliação de Psyshock com linha de tiro e barreira no caminho
{
  const self = createFighter(0, baseAttributes, vec(0, 0));
  self.loadout = ['psyshock', null];
  const target = createFighter(1, baseAttributes, vec(5.0, 0));

  // Sem barreira: viável a média distância
  const worldOpen = {entities: []};
  const evalOpen = evaluateMoveOpportunity(self, target, 'psyshock', 0, worldOpen, {distance: 5.0, threat: null});
  assert(evalOpen.viable === true, 'Psyshock deve ser viável a média distância com caminho livre');

  // Com barreira refletora do rival no caminho: inviável
  const barrier = {id: 88, reflect: true, dead: false, owner: 1, pl: 2, y: 0, height: 2, hx: 1, hz: 1, pos: {x: 2.5, z: 0}};
  const worldBlocked = {entities: [barrier]};
  const evalBlocked = evaluateMoveOpportunity(self, target, 'psyshock', 0, worldBlocked, {distance: 5.0, threat: null});
  assert(evalBlocked.viable === false, 'Psyshock não deve disparar contra barreira hostil');
  assert.equal(evalBlocked.reason, 'barrier_in_line_of_fire');
  console.log('✓ Psyshock avalia linha de tiro e bloqueio por barreiras');
}

// 4. Decisão de continuação vs soltura antecipada da carga
{
  const self = createFighter(0, baseAttributes, vec(0, 0));
  const target = createFighter(1, baseAttributes, vec(2.5, 0)); // Rival se aproximou muito

  // Carga de Psyshock já com ticks suficientes para PL1: solta antecipadamente para repelir
  const chargeAtPl1 = {move: 'psyshock', ticks: 45};
  const decEarly = evaluateChargeContinuation(self, target, chargeAtPl1, 2.5);
  assert(decEarly.shouldRelease === true, 'Deve soltar antecipadamente se rival invadir espaço');

  // Rival distante (7.0m): continua carregando para PL superior
  const decKeep = evaluateChargeContinuation(self, target, chargeAtPl1, 7.0);
  assert(decKeep.shouldRelease === false, 'Deve continuar carregando com rival distante');
  console.log('✓ soltura antecipada defensiva vs manutenção de carga decidida dinamicamente');
}

// 5. Teste de contrato para inclusão de novos movimentos
{
  const dummyMove = {
    id: 'thunderbolt',
    category: 'special',
    cost: 1.0,
    duration: 1.0,
    charge: {max: 3.0},
  };
  assert(contractCheckMoveStrategy(dummyMove) === true, 'Novo movimento válido passa no teste de contrato');

  const invalidMove = {id: null};
  assert(contractCheckMoveStrategy(invalidMove) === false, 'Movimento sem id falha no teste de contrato');
  console.log('✓ teste de contrato para movimentos validado com sucesso');
}

console.log('\n5 verificações de estratégia de Moves (Fase 7) aprovadas.');
