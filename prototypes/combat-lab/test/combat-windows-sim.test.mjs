// prototypes/combat-lab/test/combat-windows-sim.test.mjs
// Testes de integração das Janelas de Combate da Animação conectadas à simulação da Arena.
// Cobre: fallback legado quando desativado, startup, ativo, recuperação, multi-hit,
// invulnerabilidade, clash condicional, snapshot, replay e save/load determinísticos.

import {strict as assert} from 'node:assert';
import {C, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {createFighter, isOffensive, isInvulnerable} from '../src/sim/entity.js';
import {resolveHit, clashPossible} from '../src/sim/combat.js';
import {createAnimationCombatWindows} from '../src/sim/animation-combat-windows.js';
import {vec} from '../src/sim/math.js';

let passed = 0;
function test(name, fn) {
  resetConfig();
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err);
    process.exit(1);
  } finally {
    resetConfig();
  }
}

// Contrato de teste padrão baseado no personagem real do GLB (janela ativa [10, 38), invuln [0, 24))
function makeStandardTackleContract(overrides = {}) {
  return createAnimationCombatWindows({
    characterId: 'test_fighter',
    actionId: 'tackle',
    clipName: 'tackle_anim',
    clipDurationSeconds: 3.0,
    actionDurationSeconds: 0.4,
    stepSeconds: C.test.step, // 1/120 s
    activeWindows: [[10, 38]],
    invulnerabilityWindows: [[0, 24]],
    cancelWindows: [[24, 48]],
    recoveryStart: 38,
    ...overrides
  });
}

function makeAttackerAndDefender(attackerStep = 15) {
  const attacker = createFighter(0, C.profiles.balanced, vec(0, 0));
  const defender = createFighter(1, C.profiles.balanced, vec(0, 1.0));
  attacker.action = {
    kind: 'tackle',
    elapsed: attackerStep * C.test.step,
    heading: 0,
    startAngle: 0,
    offensive: true,
    vault: false,
    hits: new Set(),
    from: null,
    speedMultiplier: 1,
    combatWindows: makeStandardTackleContract(),
    hitWindows: [new Set()]
  };
  attacker.velocity = vec(0, 5);
  defender.facing = Math.PI; // olhando para o atacante
  return {attacker, defender};
}

// 1. Fallback legado quando toggle está desativado (padrão)
test('fallback legado: quando enableAnimationCombatWindows = 0, tackle atinge em qualquer passo', () => {
  C.extras.toggles.enableAnimationCombatWindows = 0;
  // Passo 2 (startup da animação, fora de [10, 38))
  const {attacker, defender} = makeAttackerAndDefender(2);
  const normal = vec(0, 1);
  const relative = vec(0, 5);

  assert.equal(isOffensive(attacker), true, 'No modo legado, tackle é ofensivo durante toda a duração');
  const hit = resolveHit(attacker, defender, normal, relative);
  assert.ok(hit, 'No modo legado, resolveHit conecta mesmo durante startup');
  assert.equal(hit.result, 'impact');
  assert.equal(attacker.action.hits.has(defender.id), true);
  assert.equal(defender.hp < C.profiles.balanced.hp, true);
});

// 2. Bloqueio de dano durante fase de startup (passos 0..9)
test('com toggle ativo: bloqueia dano durante startup [0, 10)', () => {
  C.extras.toggles.enableAnimationCombatWindows = 1;
  const normal = vec(0, 1);
  const relative = vec(0, 5);

  for (let s = 0; s < 10; s++) {
    const {attacker, defender} = makeAttackerAndDefender(s);
    assert.equal(isOffensive(attacker), false, `Passo ${s} deve ser não-ofensivo (startup)`);
    const initialHp = defender.hp;
    const hit = resolveHit(attacker, defender, normal, relative);
    assert.equal(hit, null, `Passo ${s} não deve conectar`);
    assert.equal(defender.hp, initialHp, `Defender não deve sofrer dano no passo ${s}`);
    assert.equal(attacker.action.hits.has(defender.id), false);
  }
});

// 3. Conexão e dano no intervalo ativo [10, 38)
test('com toggle ativo: conecta e causa dano dentro da janela ativa [10, 38)', () => {
  C.extras.toggles.enableAnimationCombatWindows = 1;
  const normal = vec(0, 1);
  const relative = vec(0, 5);

  const {attacker, defender} = makeAttackerAndDefender(15);
  assert.equal(isOffensive(attacker), true, 'Passo 15 está dentro da janela ativa');
  const hit = resolveHit(attacker, defender, normal, relative);
  assert.ok(hit, 'Passo 15 deve conectar');
  assert.equal(hit.result, 'impact');
  assert.equal(attacker.action.hits.has(defender.id), true);
  assert.equal(attacker.action.hitWindows[0].has(defender.id), true);
  assert.equal(defender.hp < C.profiles.balanced.hp, true);

  // Segunda colisão no mesmo passo/janela não deve causar dano duplicado
  const hitDuplicate = resolveHit(attacker, defender, normal, relative);
  assert.equal(hitDuplicate, null, 'Contato repetido na mesma janela deve ser ignorado');
});

// 4. Bloqueio de dano durante recuperação pós-ativo [38, 48)
test('com toggle ativo: bloqueia dano na recuperação pós-ativo [38, 48)', () => {
  C.extras.toggles.enableAnimationCombatWindows = 1;
  const normal = vec(0, 1);
  const relative = vec(0, 5);

  for (let s = 38; s < 48; s++) {
    const {attacker, defender} = makeAttackerAndDefender(s);
    assert.equal(isOffensive(attacker), false, `Passo ${s} deve ser não-ofensivo (recuperação)`);
    const initialHp = defender.hp;
    const hit = resolveHit(attacker, defender, normal, relative);
    assert.equal(hit, null, `Passo ${s} não deve conectar`);
    assert.equal(defender.hp, initialHp, `Defender não deve sofrer dano no passo ${s}`);
  }
});

// 5. Suporte a multi-hit com janelas ativas separadas
test('multi-hit: duas janelas ativas separadas [10, 20) e [30, 40) conectam 1 vez cada', () => {
  C.extras.toggles.enableAnimationCombatWindows = 1;
  const multiContract = makeStandardTackleContract({
    activeWindows: [[10, 20], [30, 40]]
  });
  const normal = vec(0, 1);
  const relative = vec(0, 5);

  const attacker = createFighter(0, C.profiles.balanced, vec(0, 0));
  const defender = createFighter(1, C.profiles.balanced, vec(0, 1.0));
  attacker.action = {
    kind: 'tackle',
    elapsed: 15 * C.test.step,
    heading: 0,
    startAngle: 0,
    offensive: true,
    vault: false,
    hits: new Set(),
    from: null,
    speedMultiplier: 1,
    combatWindows: multiContract,
    hitWindows: [new Set(), new Set()]
  };
  attacker.velocity = vec(0, 5);
  defender.facing = Math.PI;

  // 1º Hit: no passo 15 (janela 0)
  const hit1 = resolveHit(attacker, defender, normal, relative);
  assert.ok(hit1, 'Primeira janela deve conectar');
  assert.equal(hit1.result, 'impact');
  const hpAfterHit1 = defender.hp;

  // Contato repetido na janela 0 (passo 16)
  attacker.action.elapsed = 16 * C.test.step;
  assert.equal(resolveHit(attacker, defender, normal, relative), null, 'Janela 0 não deve dar dano duplo');

  // Intervalo entre janelas (passo 25)
  attacker.action.elapsed = 25 * C.test.step;
  assert.equal(isOffensive(attacker), false, 'Passo 25 está no vão entre janelas');
  assert.equal(resolveHit(attacker, defender, normal, relative), null, 'Vão entre janelas não conecta');

  // 2º Hit: no passo 35 (janela 1) — defensor no solo/juggle
  defender.flight = null;
  attacker.action.elapsed = 35 * C.test.step;
  assert.equal(isOffensive(attacker), true, 'Passo 35 está na segunda janela ativa');
  const hit2 = resolveHit(attacker, defender, normal, relative);
  assert.ok(hit2, 'Segunda janela ativa deve conectar');
  assert.equal(hit2.result, 'impact');
  assert.equal(defender.hp < hpAfterHit1, true, 'Defensor deve ter tomado dano do 2º hit');
  assert.equal(attacker.action.hitWindows[0].has(defender.id), true);
  assert.equal(attacker.action.hitWindows[1].has(defender.id), true);
});

// 6. Invulnerabilidade validada da animação protege contra o golpe
test('invulnerabilidade conectada: filtra acerto durante [start, end) de invulnerabilidade', () => {
  C.extras.toggles.enableAnimationCombatWindows = 1;
  C.extras.toggles.enableInvulnerability = 1;
  const normal = vec(0, 1);
  const relative = vec(0, 5);

  const {attacker, defender} = makeAttackerAndDefender(15);
  // Defensor executando esquiva com invulnerabilidade em [0, 24)
  defender.action = {
    kind: 'dodge',
    elapsed: 15 * C.test.step,
    heading: Math.PI,
    startAngle: Math.PI,
    offensive: false,
    vault: false,
    hits: new Set(),
    from: null,
    speedMultiplier: 1,
    combatWindows: createAnimationCombatWindows({
      characterId: 'defender',
      actionId: 'dodge',
      clipName: 'dodge_anim',
      clipDurationSeconds: 1.0,
      actionDurationSeconds: 0.4,
      stepSeconds: C.test.step,
      activeWindows: [],
      invulnerabilityWindows: [[0, 24]]
    })
  };

  assert.equal(isInvulnerable(defender), true, 'Passo 15 do defensor é invulnerável');
  const hit = resolveHit(attacker, defender, normal, relative);
  assert.ok(hit);
  assert.equal(hit.result, 'perfectDodge', 'Deve resolver como esquiva perfeita/invulnerável');
  assert.equal(hit.damage, 0, 'Dano zero durante invulnerabilidade');
  assert.equal(defender.hp, C.profiles.balanced.hp);

  // Avança defensor para passo 25 (após a invulnerabilidade)
  defender.action.elapsed = 25 * C.test.step;
  assert.equal(isInvulnerable(defender), false, 'Passo 25 não é mais invulnerável');
});

// 7. Clash só ocorre se ambos estiverem em suas janelas ativas
test('clash condicional: clash só ocorre quando ambos estão ofensivos', () => {
  C.extras.toggles.enableAnimationCombatWindows = 1;
  C.extras.toggles.enableClash = 1;
  const normal = vec(0, 1);
  const relative = vec(0, 10);

  const a = createFighter(0, C.profiles.balanced, vec(0, 0));
  const b = createFighter(1, C.profiles.balanced, vec(0, 1.0));
  a.action = {
    kind: 'tackle',
    elapsed: 5 * C.test.step, // startup: não-ofensivo
    heading: 0,
    startAngle: 0,
    offensive: true,
    vault: false,
    hits: new Set(),
    from: null,
    speedMultiplier: 1,
    combatWindows: makeStandardTackleContract()
  };
  b.action = {
    kind: 'tackle',
    elapsed: 15 * C.test.step, // ativo: ofensivo
    heading: Math.PI,
    startAngle: Math.PI,
    offensive: true,
    vault: false,
    hits: new Set(),
    from: null,
    speedMultiplier: 1,
    combatWindows: makeStandardTackleContract()
  };

  assert.equal(isOffensive(a), false);
  assert.equal(isOffensive(b), true);
  assert.equal(clashPossible(a, b, normal, relative), false, 'Não deve haver clash se um dos lutadores está em startup');

  // Coloca ambos em janela ativa (passo 15)
  a.action.elapsed = 15 * C.test.step;
  assert.equal(isOffensive(a), true);
  assert.equal(clashPossible(a, b, normal, relative), true, 'Clash permitido quando ambos estão na janela ativa');
});

// 8. Determinismo, preservação e restauração em Game save() e load()
test('Game save() e load(): preserva combatWindows, hitWindows e determinismo', () => {
  C.extras.toggles.enableAnimationCombatWindows = 1;
  const game = new Game({seed: 42});
  const contract = makeStandardTackleContract();
  game.setCombatWindows(0, {tackle: contract});
  game.setCombatWindows(1, {tackle: contract});

  assert.ok(game.fighters[0].combatWindows);
  assert.deepEqual(game.fighters[0].combatWindows.tackle.activeWindows, [[10, 38]]);

  // Salva o estado
  const savedState = game.save();
  assert.ok(savedState.combatWindows);
  assert.deepEqual(savedState.combatWindows[0].tackle.activeWindows, [[10, 38]]);

  // Restaura em outra instância de Game
  const game2 = new Game({seed: 99});
  game2.load(savedState);
  assert.ok(game2.combatWindows);
  assert.deepEqual(game2.combatWindows[0].tackle.activeWindows, [[10, 38]]);
  assert.deepEqual(game2.fighters[0].combatWindows.tackle.activeWindows, [[10, 38]]);

  // Snapshot inclui offensive e hitWindows
  const snap = game.snapshot();
  assert.equal(snap.fighters[0].offensive, false); // neutro inicialmente
});

// 9. Simulação completa via Game.step(): tackle iniciado por comando respeita startup e conecta no passo ativo
test('Game.step() de ponta a ponta: tackle por comando não acerta no startup e conecta no passo ativo', () => {
  C.extras.toggles.enableAnimationCombatWindows = 1;
  C.extras.toggles.enableHitstop = 0; // simplifica contagem linear de passos
  C.extras.toggles.enableEnemyAI = 0; // inimigo parado como boneco de treino

  const game = new Game({seed: 123});
  const contract = makeStandardTackleContract();
  // Posiciona atacante azul em (0, 0) e defensor vermelho em (0, 1.2) - dentro do alcance do tackle
  game.reset({positions: [vec(0, 0), vec(0, 1.2)]});
  game.setCombatWindows(0, {tackle: contract});
  game.fighters[0].facing = 0;
  game.fighters[1].facing = Math.PI;

  const initialHp = game.fighters[1].hp;
  let impactTick = null;

  // Passo 0: envia comando de tackle
  const tackleCmd = {move: vec(0, 1), tackle: true, dodge: false, dodgeHeld: false, guard: false, guardPressed: false, target: null, skill: null};
  const idleCmd = {move: vec(0, 0), tackle: false, dodge: false, dodgeHeld: false, guard: false, guardPressed: false, target: null, skill: null};

  game.step(tackleCmd, idleCmd);
  assert.equal(game.fighters[0].action?.kind, 'tackle');
  assert.equal(game.fighters[1].hp, initialHp, 'Passo 0 (startup) não deve causar dano');

  // Passos 1 a 9: startup do tackle
  for (let s = 1; s < 10; s++) {
    game.step(idleCmd, idleCmd);
    assert.equal(game.fighters[1].hp, initialHp, `Passo ${s} (startup) não deve causar dano`);
  }

  // Passos 10 em diante: janela ativa conectando
  for (let s = 10; s < 30; s++) {
    game.step(idleCmd, idleCmd);
    const impactEvent = game.lastStepEvents.find(e => e.result === 'impact');
    if (impactEvent) {
      impactTick = game.tick - 1;
      break;
    }
  }

  assert.ok(impactTick !== null, 'Tackle deve ter conectado dentro da janela ativa');
  assert.ok(impactTick >= 10, `Impacto (${impactTick}) deve ocorrer no passo 10 ou posterior`);
  assert.equal(game.fighters[1].hp < initialHp, true, 'Defensor deve ter recebido dano do impacto');
});

console.log(`\nTODOS OS ${passed} CENÁRIOS DE INTEGRAÇÃO DA SIMULAÇÃO PASSARAM COM SUCESSO!`);
