// @ts-check
// ARENAMON — Testes Determinísticos a 120 Hz: Eliminação de Falsa Aterrissagem
// Validação das 15 regras mecânicas e visuais contra aterrissagem falsa.
// Critério: nenhum evento de dano, status, flinch ou empurrão horizontal
// pode gerar 'landing' sem a transição física correspondente.

import {assert, C, factoryDefaults, resetConfig, Game, emptyCommand, vec, arena, step, run, cmd, HOLD} from './moves-new-helpers.mjs';
import {pushAway, knockbackReaction, resolveHit} from '../src/sim/combat.js';
import {applyHit} from '../src/sim/world/world-hit.js';
import {applyCounterStagger, spawn} from '../src/sim/world.js';
import {Character} from '../src/view/characters.js';
import {canAct, canMove} from '../src/sim/entity.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('✓', name);
}

function makeGame(p0 = vec(0, -4), p1 = vec(0, -1.5), equip = []) {
  const g = arena({equip, positions: [p0, p1]});
  C.test.step = 1 / 120; // 120 Hz estrito
  return g;
}

const press0 = {skill: 0, skillHeld: HOLD(0)};
const held0 = {skillHeld: HOLD(0)};

function makeAnimRig() {
  const ch = Object.create(Character.prototype);
  ch.clock = 0;
  ch.lastFlight = -99;
  ch.actionSerial = 0;
  ch.current = null;
  ch.variantsOf = () => [0];
  ch.actionFor = (k) => k;
  ch.smoothLocomotion = (k) => k;
  return ch;
}

console.log('\n--- ARENAMON: TESTES DE FALSA ATERRISSAGEM (120 HZ) ---\n');

test('1. Sand Wave causando dano sem knockback vertical: dano sem landing', () => {
  const g = makeGame(vec(0, -4), vec(0, -1.5), ['sand-wave']);
  C.world.sandWave.knockbackV = 0;
  const ch = makeAnimRig();

  const states = [];
  const animStates = [];

  // Ativação do Sand Wave
  g.step(cmd(press0), cmd());

  for (let i = 0; i < 180; i++) {
    g.step(cmd(), cmd());
    const target = g.fighters[1];
    states.push(target.state);
    animStates.push(ch.stateKey(target));
  }

  assert.ok(g.fighters[1].hp < 100, 'Alvo deve ter recebido dano do Sand Wave');
  assert.equal(g.fighters[1].flight, null, 'Alvo não deve ter sido lançado (sem voo)');
  assert.ok(!states.includes('landing'), `Alvo nunca deve entrar no estado mecânico 'landing' (vistos: ${[...new Set(states)].join(', ')})`);
  assert.ok(!animStates.includes('landing'), `Alvo nunca deve reproduzir animação 'landing' (vistos: ${[...new Set(animStates)].join(', ')})`);
});

test('2. Sand Wave aplicando cegueira: status sem deslocamento e sem landing', () => {
  const g = makeGame(vec(0, -4), vec(0, -1.5), ['sand-wave']);
  const ch = makeAnimRig();

  let sawBlind = false;
  const statesDuringBlind = [];

  g.step(cmd(press0), cmd());

  for (let i = 0; i < 240; i++) {
    g.step(cmd(), cmd());
    const target = g.fighters[1];
    const isBlind = target.statuses?.some(s => s.id === 'blind' || s.def?.id === 'blind');
    if (isBlind) {
      sawBlind = true;
      statesDuringBlind.push(target.state);
      assert.notEqual(target.state, 'landing', 'Estado sob cegueira não pode ser landing');
      assert.notEqual(ch.stateKey(target), 'landing', 'Animação sob cegueira não pode ser landing');
    }
  }

  assert.ok(sawBlind, 'Cegueira deve ter sido aplicada');
  assert.ok(!statesDuringBlind.includes('landing'), 'Nenhum tick de cegueira pode estar em landing');
});

test('3. Sand Wave mantendo empurrão contra parede: estado pushed contínuo sem landing', () => {
  const g = makeGame(vec(0, -4), vec(0, -2.2), ['sand-wave']);
  spawn(g.world, {kind: 'wall', pos: {x: 0, z: -1.1}, hx: 4, hz: 0.3, angle: 0, y: 0, height: 3}, []);
  const ch = makeAnimRig();
  C.world.sandWave.wallStaggerOn = 0; // focado na física do empurrão contínuo

  const states = [];
  g.step(cmd(press0), cmd());

  for (let i = 0; i < 180; i++) {
    g.step(cmd(), cmd());
    const target = g.fighters[1];
    if (target.sandPush) {
      states.push(target.state);
      assert.equal(target.state, 'pushed', `Durante empurrão o estado deve ser pushed, obtido: ${target.state}`);
      assert.notEqual(ch.stateKey(target), 'landing', 'Animação contra a parede não pode ser landing');
    }
  }

  assert.ok(states.length > 0, 'Empurrão deve ter atuado sobre o alvo');
  assert.ok(!states.includes('landing'), 'Empurrão contínuo contra parede nunca entra em landing');
});

test('4. Sand Wave aplicando stagger sem simular pouso', () => {
  const g = makeGame(vec(0, -4), vec(0, -2.2), ['sand-wave']);
  spawn(g.world, {kind: 'wall', pos: {x: 0, z: -1.1}, hx: 4, hz: 0.3, angle: 0, y: 0, height: 3}, []);
  const ch = makeAnimRig();
  C.world.sandWave.wallStaggerOn = 1;
  C.world.sandWave.wallStagger = 0.35;

  let sawStagger = false;
  const states = [];

  g.step(cmd(press0), cmd());

  for (let i = 0; i < 240; i++) {
    g.step(cmd(), cmd());
    const target = g.fighters[1];
    states.push(target.state);
    if (target.stagger > 0 || target.state === 'stagger') {
      sawStagger = true;
      assert.notEqual(target.state, 'landing', 'Stagger na parede não pode ser landing');
      assert.notEqual(ch.stateKey(target), 'landing', 'Animação do stagger não pode ser landing');
    }
  }

  assert.ok(sawStagger, 'Stagger na parede deve ter ocorrido');
  assert.ok(!states.includes('landing'), 'Nenhum tick de stagger pode ser landing');
});

test('5. Water Pulse com knockback horizontal e vertical zero: sem falso pouso', () => {
  const g = makeGame(vec(0, -4), vec(0, -1.5), ['water-pulse']);
  const ch = makeAnimRig();
  C.world.waterPulse.knockbackH = 0;
  C.world.waterPulse.knockbackV = 0;

  const states = [];
  // Ativação da carga do Water Pulse
  g.step(cmd(press0), cmd());
  for (let i = 1; i < 20; i++) g.step(cmd(held0), cmd());
  g.step(cmd(), cmd()); // soltura

  for (let i = 0; i < 180; i++) {
    g.step(cmd(), cmd());
    const target = g.fighters[1];
    states.push(target.state);
    assert.notEqual(target.state, 'landing', 'Alvo atingido sem knockback nunca entra em landing');
    assert.notEqual(ch.stateKey(target), 'landing', 'Visual nunca pode ser landing');
  }

  assert.ok(g.fighters[1].hp < 100, 'Alvo deve ter tomado dano do Water Pulse');
  assert.ok(!states.includes('landing'), 'Nunca entra em landing');
});

test('6. Defesa parcial e perfeita: sem aterrissagem', () => {
  const g = makeGame(vec(0, -1.5), vec(0, 0));
  const ch = makeAnimRig();
  const def = g.fighters[1];
  def.facing = Math.PI; // Virado para o atacante que está em -Z
  def.guard = true;

  // Ataque contra defesa parcial
  const hit = {damage: 10, flinch: 0.2, knockback: {horizontal: 0, vertical: 0}, guardable: true};
  const evPartial = applyHit(g, 0, def, hit, vec(0, 1), {origin: g.fighters[0].position});

  assert.equal(evPartial?.result, 'partial', 'Deve ser defesa parcial');
  assert.equal(def.state, 'guardStun', 'Defesa parcial deve colocar em guardStun');
  assert.equal(ch.stateKey(def), 'guardStun', 'Visual deve ser guardStun');
  assert.notEqual(def.state, 'landing', 'Não pode ser landing');

  // Defesa perfeita
  def.perfectLeft = 0.2;
  const evPerfect = applyHit(g, 0, def, hit, vec(0, 1), {origin: g.fighters[0].position});
  assert.equal(evPerfect?.result, 'perfect', 'Deve ser defesa perfeita');
  assert.notEqual(def.state, 'landing', 'Defesa perfeita não gera landing');
  assert.equal(ch.stateKey(def), 'guard', 'Visual deve permanecer guard');
});

test('7. Flinch causado por ataque sem lançamento: estado hitstun próprio', () => {
  const g = makeGame(vec(-1, 0), vec(0, 0));
  const ch = makeAnimRig();
  const target = g.fighters[1];

  const hit = {damage: 8, flinch: 0.25, knockback: {horizontal: 0, vertical: 0}};
  applyHit(g, 0, target, hit, vec(1, 0));

  assert.equal(target.state, 'hitstun', 'Impacto com flinch no chão deve entrar em hitstun');
  assert.equal(ch.stateKey(target), 'hitstun', 'Visual deve ser hitstun');
  assert.equal(canAct(target), false, 'Não pode agir durante o hitstun');
  assert.equal(canMove(target), false, 'Não pode se mover durante o hitstun');
  assert.notEqual(target.state, 'landing', 'Flinch no solo JAMAIS pode gerar landing');

  for (let i = 0; i < 35; i++) {
    g.step(cmd({}), cmd({}));
    if (target.knockRecovery > 0) {
      assert.equal(target.state, 'hitstun', 'Deve permanecer em hitstun durante a recuperação');
      assert.notEqual(target.state, 'landing', 'Nunca pode trocar para landing');
    }
  }

  assert.equal(target.knockRecovery, 0, 'Recuperação concluída');
  assert.equal(target.state, 'neutral', 'Volta para neutral');
  assert.equal(canAct(target), true, 'Pode agir novamente');
});

test('8. Counter Stagger: estado stagger próprio com bloqueio de ação', () => {
  const g = makeGame(vec(-1, 0), vec(0, 0));
  const ch = makeAnimRig();
  const target = g.fighters[1];

  const evs = [];
  applyCounterStagger(target, 0.30, evs, 0);

  assert.equal(target.state, 'stagger', 'Counter Stagger deve colocar o alvo em stagger');
  assert.equal(ch.stateKey(target), 'stagger', 'Visual deve ser stagger');
  assert.equal(canAct(target), false, 'Alvo em stagger não pode agir');
  assert.equal(canMove(target), false, 'Alvo em stagger não pode mover');
  assert.notEqual(target.state, 'landing', 'Counter Stagger JAMAIS pode ser interpretado como pouso');

  for (let i = 0; i < 15; i++) {
    g.step(cmd({}), cmd({}));
    assert.equal(target.state, 'stagger', 'Deve permanecer em stagger');
    assert.notEqual(target.state, 'landing', 'Nunca pode virar landing');
  }

  for (let i = 0; i < 30; i++) g.step(cmd({}), cmd({}));
  assert.equal(target.knockRecovery, 0, 'Stagger expirou');
  assert.equal(target.state, 'neutral', 'Retorna a neutral');
  assert.equal(canAct(target), true, 'Pode agir');
});

test('9. Empurrão horizontal: reação física própria sem simular queda', () => {
  const g = makeGame(vec(-1, 0), vec(0, 0));
  const ch = makeAnimRig();
  const target = g.fighters[1];

  pushAway(target, vec(1, 0), 2.5, 0.30);

  assert.equal(target.state, 'pushed', 'pushAway deve definir estado pushed');
  assert.equal(ch.stateKey(target), 'pushed', 'Visual deve ser pushed');
  assert.equal(target.flight, null, 'Empurrão horizontal não tem voo');
  assert.notEqual(target.state, 'landing', 'Empurrão não pode ser landing');

  for (let i = 0; i < 40; i++) {
    g.step(cmd({}), cmd({}));
    if (target.push || target.knockRecovery > 0) {
      assert.equal(target.state, 'pushed', 'Durante o empurrão permanece pushed');
      assert.notEqual(target.state, 'landing', 'Nunca se torna landing');
    }
  }

  assert.equal(target.state, 'neutral', 'Ao terminar o empurrão volta a neutral');
});

test('10. Lançamento vertical seguido de aterrissagem verdadeira: landing real confirmado', () => {
  const g = makeGame(vec(-1, 0), vec(0, 0));
  const ch = makeAnimRig();
  const target = g.fighters[1];

  const hit = {damage: 15, knockback: {horizontal: 4.0, vertical: 7.0}};
  applyHit(g, 0, target, hit, vec(1, 0));

  assert.ok(target.flight !== null, 'Deve entrar em voo (flight)');
  assert.equal(target.state, 'airborne', 'Deve estar airborne no ar');
  assert.equal(ch.stateKey(target), 'airborne', 'Visual deve ser airborne');

  let sawRealLanding = false;
  for (let i = 0; i < 150; i++) {
    g.step(cmd({}), cmd({}));
    if (target.state === 'landing') {
      sawRealLanding = true;
      assert.ok(target.lastLanding !== null, 'Aterrissagem real deve registrar lastLanding');
      assert.equal(ch.stateKey(target), 'landing', 'Visual durante o pouso real deve ser landing');
      assert.equal(canAct(target), false, 'Não pode agir na recuperação do pouso');
    }
  }

  assert.ok(sawRealLanding, 'Queda real com contato físico DEVE produzir estado landing');
  assert.equal(target.state, 'neutral', 'Ao fim da recuperação volta para neutral');
});

test('11. Personagem atingido em plataforma elevada: sem queda e sem landing', () => {
  const g = makeGame(vec(-2, 0), vec(0, 0));
  const ch = makeAnimRig();
  const target = g.fighters[1];

  target.groundY = 1.5;
  target.position.y = 1.5;

  const hit = {damage: 10, flinch: 0.20, knockback: {horizontal: 0, vertical: 0}};
  applyHit(g, 0, target, hit, vec(1, 0));

  assert.equal(target.state, 'hitstun', 'Deve entrar em hitstun na plataforma');
  assert.equal(target.flight, null, 'Sem lançamento vertical');
  assert.notEqual(target.state, 'landing', 'Não pode entrar em landing na plataforma');

  for (let i = 0; i < 30; i++) {
    g.step(cmd({}), cmd({}));
    assert.notEqual(target.state, 'landing', 'Permanece sem landing');
  }
});

test('12. Recuperação após queda de plataforma: transição correta de queda e pouso', () => {
  const g = makeGame(vec(-2, 0), vec(0, 0));
  const target = g.fighters[1];

  target.flight = {y: 1.5, vy: 0, horizontal: vec(1, 0), isEdgeFall: true};
  target.groundY = 0;
  target.state = 'airborne';

  let landed = false;
  for (let i = 0; i < 60; i++) {
    g.step(cmd({}), cmd({}));
    if (target.state === 'landing' || (target.lastLanding && target.lastLanding.regular)) {
      landed = true;
    }
  }

  assert.ok(landed, 'Queda até o chão deve acionar o evento de contato real');
});

test('13. Recuperação de Tackle sem queda: actionRecovery sem aterrissagem', () => {
  const g = makeGame(vec(0, -3), vec(0, 3));
  const ch = makeAnimRig();
  const attacker = g.fighters[0];

  g.step(cmd({tackle: true}), cmd());
  assert.equal(attacker.action?.kind, 'tackle', 'Tackle iniciado');

  const states = [];
  const animStates = [];

  for (let i = 0; i < 120; i++) {
    g.step(cmd(), cmd());
    states.push(attacker.state);
    animStates.push(ch.stateKey(attacker));
  }

  assert.ok(!states.includes('landing'), `Recuperação de tackle no solo nunca entra em landing (vistos: ${[...new Set(states)].join(', ')})`);
  assert.ok(!animStates.includes('landing'), `Visual de tackle no solo nunca vira landing (vistos: ${[...new Set(animStates)].join(', ')})`);
});

test('14. Duas reações concorrentes e prioridade de estados', () => {
  const g = makeGame(vec(-1, 0), vec(0, 0));
  const ch = makeAnimRig();
  const target = g.fighters[1];

  pushAway(target, vec(1, 0), 2.0, 0.3);
  assert.equal(target.state, 'pushed', 'Inicialmente pushed');

  applyHit(g, 0, target, {damage: 5, knockback: {horizontal: 2, vertical: 5}}, vec(1, 0));
  assert.equal(target.state, 'airborne', 'Voo físico tem prioridade sobre empurrão horizontal');
  assert.equal(ch.stateKey(target), 'airborne', 'Visual reflete airborne');

  target.hp = 0;
  g.step(cmd({}), cmd({}));
  assert.equal(target.state, 'defeated', 'Derrota tem prioridade máxima imediata');
  assert.notEqual(target.state, 'landing', 'Derrotado nunca vira landing');
});

test('15. Personagem derrotado durante reação: prioridade de defeated', () => {
  const g = makeGame(vec(-1, 0), vec(0, 0));
  const ch = makeAnimRig();
  const target = g.fighters[1];

  applyHit(g, 0, target, {damage: 5, flinch: 0.3, knockback: {horizontal: 0, vertical: 0}}, vec(1, 0));
  assert.equal(target.state, 'hitstun', 'Está em hitstun');

  applyHit(g, 0, target, {damage: 200, flinch: 0.3, knockback: {horizontal: 0, vertical: 0}}, vec(1, 0));
  assert.equal(target.hp, 0, 'Vida zerada');
  assert.equal(target.state, 'defeated', 'Estado deve ser defeated imediatamente');
  assert.equal(ch.stateKey(target), 'defeated', 'Visual deve ser defeated');

  for (let i = 0; i < 20; i++) {
    g.step(cmd({}), cmd({}));
    assert.equal(target.state, 'defeated', 'Permanece defeated');
    assert.notEqual(target.state, 'landing', 'JAMAIS cai em landing após a morte');
  }
});

console.log(`\nTodos os ${passed} testes de regressão de falsa aterrissagem passaram com 100% de aprovação!`);
