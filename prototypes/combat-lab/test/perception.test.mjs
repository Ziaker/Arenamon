// Testes da Fase 2: Percepção Justa e Memória Robusta da IA
import assert from 'node:assert/strict';
import {Brain} from '../src/sim/ai.js';
import {initPerception, updatePerception, perceiveIncomingProjectile, isMoveRevealed} from '../src/sim/perception.js';
import {vec, length} from '../src/sim/math.js';
import {C, defaults, resetConfig} from '../src/sim/config.js';

let n = 0;
const ok = l => {n++; console.log('✓', l);};

resetConfig(defaults());

// 1. Inicialização e contrato do módulo de percepção
{
  const brain = new Brain(42);
  const P = brain.personality();
  const perc = initPerception(brain, P);
  assert.equal(perc.lastSeenPos, null);
  assert.equal(perc.observedAction, null);
  assert.equal(perc.revealedMoves.size, 0);
  assert.equal(perc.trackedProjectiles.size, 0);
}
ok('inicialização do estado sensorial de percepção');

// 2. Velocidade aparente estimada por deslocamento temporal
{
  const brain = new Brain(101);
  const P = brain.personality();
  const perc = initPerception(brain, P);
  const self = {position: vec(0, 0)};
  const target = {position: vec(0, 0), action: null, guard: false};

  updatePerception(perc, brain, self, target, 0.016, P, 0.016);
  assert.deepEqual(perc.lastSeenPos, target.position);
  assert.equal(length(perc.apparentVel), 0);

  // Alvo se move para (0.16, 0) em 0.016s (~10 m/s)
  target.position = vec(0.16, 0);
  updatePerception(perc, brain, self, target, 0.016, P, 0.032);
  assert.ok(perc.apparentVel.x > 2.0, 'velocidade aparente detecta movimento progressivo sem telepatia');
}
ok('estimativa de velocidade aparente por amostragem temporal');

// 3. Atraso de reação humano a ações do adversário (estado oculto não altera a decisão antes do tempo)
{
  const brain = new Brain(202);
  const P = {reaction: 0.16, reactionJitter: 0, mistake: 0};
  const perc = initPerception(brain, P);
  const self = {position: vec(0, 0)};
  const target = {position: vec(2, 0), action: null, guard: false};

  // Alvo neutro em t=0
  updatePerception(perc, brain, self, target, 0.01, P, 0.01);
  assert.equal(perc.observedAction, null);

  // Em t=0.02, alvo inicia tackle
  target.action = {kind: 'tackle', elapsed: 0};
  updatePerception(perc, brain, self, target, 0.01, P, 0.02);
  assert.equal(perc.observedAction, null, 'em t=0.02 a IA ainda não percebeu o tackle (janela de atraso)');

  // Em t=0.10 (< 0.16s), ainda não percebeu
  updatePerception(perc, brain, self, target, 0.08, P, 0.10);
  assert.equal(perc.observedAction, null, 'em t=0.10 a IA ainda está no tempo de reação humano');

  // Em t=0.20 (>= 0.16s), a ação é confirmada e percebida
  updatePerception(perc, brain, self, target, 0.10, P, 0.20);
  assert.equal(perc.observedAction, 'tackle', 'em t=0.20 o tackle foi percebido e registrado');
}
ok('atraso de reação e isolamento de estado oculto antes da percepção confirmada');

// 4. Percepção justa de projéteis com atraso de reação e revelação de loadout
{
  const brain = new Brain(303);
  const P = {reaction: 0.15, reactionJitter: 0, mistake: 0};
  const perc = initPerception(brain, P);
  const self = {id: 0, position: vec(0, 0)};
  const world = {
    entities: [
      {id: 99, kind: 'projectile', owner: 1, pos: vec(0, 6), vel: vec(0, -12), pl: 2, radius: 0.3, dead: false, move: 'psyshock'},
    ],
  };

  // t=0.5: projétil acabou de surgir
  const threat0 = perceiveIncomingProjectile(perc, brain, world, self, 0.5, P);
  assert.equal(threat0, null, 'projétil no frame inicial ainda não foi percebido (respeita reação)');
  assert.equal(isMoveRevealed(perc, 'psyshock'), false, 'loadout do rival permanece não revelado antes de ser percebido');

  // t=0.7 (0.2s após surgimento >= 0.15s delay): projétil percebido
  const threat1 = perceiveIncomingProjectile(perc, brain, world, self, 0.7, P);
  assert.ok(threat1 !== null, 'projétil percebido após a janela de reação');
  assert.equal(threat1.pl, 2, 'Power Level observado corretamente');
  assert.equal(isMoveRevealed(perc, 'psyshock'), true, 'move revelado formalmente na memória da IA');
}
ok('percepção justa de projéteis e revelação dinâmica de loadout');

// 5. Determinismo: mesma semente reproduz a mesma percepção
{
  const b1 = new Brain(777);
  const b2 = new Brain(777);
  const P1 = b1.personality();
  const P2 = b2.personality();
  const perc1 = initPerception(b1, P1);
  const perc2 = initPerception(b2, P2);

  const self = {position: vec(0, 0)};
  const target = {position: vec(1.5, 0), action: {kind: 'tackle'}, guard: false};

  updatePerception(perc1, b1, self, target, 0.05, P1, 0.05);
  updatePerception(perc2, b2, self, target, 0.05, P2, 0.05);

  assert.equal(perc1.actionPerceivedAt, perc2.actionPerceivedAt, 'atrasos idênticos para mesma semente');
  assert.equal(perc1.actionMisread, perc2.actionMisread, 'erros de percepção idênticos');
}
ok('determinismo estrito na percepção e memória sensorial');

console.log(`\n${n} verificações de percepção justa e memória (Fase 2) aprovadas.`);
