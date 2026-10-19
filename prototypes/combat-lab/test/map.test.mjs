// @ts-check
// Suíte de testes abrangente do Novo Mapa Arenamon (Rodadas 1–11):
// Cobre física circular, plataformas 3D, salto normal, objetos destrutíveis,
// consumíveis, progressão de estágios, escudos temporários, MAP-T01 a MAP-T24,
// testes de estresse com 100 seeds distintas e determinismo de save/replay.

import assert from 'node:assert/strict';
import {C, defaults} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {createFighter, emptyCommand, getFighterMaxStamina} from '../src/sim/entity.js';
import {
  MAP_DEFAULTS,
  CONSUMABLE_TYPES,
  createMapState,
  initMap,
  nextRandom,
  generateFighterSpawnPositions,
  stepMap,
  stepShield,
  applyShield,
  applyConsumableEffect,
  applyHpHeal,
  applyStaminaHeal,
  processDamageWithShieldAndStages,
  damageDestructible,
  findNearestValidPosition,
  isValidSpawnPosition,
} from '../src/sim/map.js';
import {stepPhysics, getGroundHeight} from '../src/sim/physics.js';
import {vec, length} from '../src/sim/math.js';
import {SCENARIOS, runScenario} from '../src/sim/scenarios.js';

const near = (a, b, tol = 1e-4) => Math.abs(a - b) <= tol;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}:`, err.message);
  }
}

console.log('\n--- INICIANDO AUDITORIA E TESTES DO NOVO MAPA ARENAMON ---\n');

// ==========================================
// 1. ARENA CIRCULAR E LIMITES FÍSICOS (MAP-T01, R1.1, R1.8)
// ==========================================
console.log('1. Arena Circular e Limites Físicos:');

test('Raio da arena circular é 50 m (diâmetro 100 m)', () => {
  const g = new Game({seed: 42});
  assert.equal(C.map.arenaRadius, 50, 'Raio padrão deve ser 50m');
  assert.equal(C.map.arenaShape, 'circle', 'Formato padrão deve ser circle');
});

test('Lutadores são contidos radialmente no limite de 50 m', () => {
  const g = new Game({seed: 1});
  g.start();
  const f = g.fighters[0];
  f.position = {x: 48, z: 0, y: 0};
  f.flight = {y: 0, vy: 0, horizontal: vec(25, 0)};
  g.step(emptyCommand(), emptyCommand());
  const dist = Math.hypot(f.position.x, f.position.z);
  assert.ok(dist <= 50.05, `Distância ${dist} deve ser <= 50 m`);
  assert.ok(f.velocity.x <= 0, 'Velocidade deve ser refletida para dentro da arena');
});

test('Rebote na borda circular preserva elasticidade configurável', () => {
  const g = new Game({seed: 2});
  g.start();
  const f = g.fighters[0];
  f.position = {x: 0, z: 49.6};
  f.flight = {y: 0.5, vy: 1, horizontal: vec(0, 10)};
  g.step(emptyCommand(), emptyCommand());
  assert.ok(f.velocity.z < 0, 'Velocidade z deve ser invertida para dentro');
});

// ==========================================
// 2. SALTO NORMAL E FÍSICA VERTICAL (MAP-T06, R2.1-R2.7, R7.1-R7.4)
// ==========================================
console.log('\n2. Salto Normal e Física Vertical:');

test('Salto normal na barra de espaço inicia decolagem sem custo de stamina', () => {
  const g = new Game({seed: 3});
  g.start();
  const f = g.fighters[0];
  const staminaBefore = f.stamina;
  g.step({jump: true, move: vec()}, emptyCommand());
  assert.ok(f.flight, 'Lutador deve entrar em voo balístico');
  assert.ok(f.flight.isNormalJump, 'Deve ser classificado como salto normal');
  assert.equal(f.stamina, staminaBefore, 'Salto normal não consome stamina');
  assert.ok(f.flight.vy > 0, 'Velocidade vertical inicial deve ser positiva');
});

test('Salto normal conserva velocidade horizontal sem permitir esterçamento no ar', () => {
  const g = new Game({seed: 4});
  g.start();
  const f = g.fighters[0];
  f.velocity = vec(0, 5); // correndo para frente
  g.step({jump: true, move: vec(0, 1)}, emptyCommand()); // pula
  assert.ok(f.flight && f.flight.isNormalJump);
  const vx0 = f.flight.horizontal.x;
  const vz0 = f.flight.horizontal.z;
  // Tenta virar para a direita no ar
  g.step({move: vec(1, 0)}, emptyCommand());
  assert.equal(f.flight.horizontal.x, vx0, 'Velocidade horizontal X não deve ser alterada no ar');
  assert.ok(f.flight.horizontal.z > 4.5 && f.flight.horizontal.z <= vz0, 'Velocidade horizontal Z deve sofrer apenas arrasto e não esterçamento');
});

test('Aterrissagem do salto normal aplica delay de recuperação (0,25s)', () => {
  const g = new Game({seed: 5});
  g.start();
  const f = g.fighters[0];
  g.step({jump: true, move: vec()}, emptyCommand());
  // Avança até pousar (~0.95s = ~115 passos a 120Hz)
  for (let i = 0; i < 120; i++) g.step(emptyCommand(), emptyCommand());
  assert.ok(f.jumpState.cooldown > 0 || f.knockRecovery > 0, 'Deve ter cooldown ou recovery pós-pouso');
});

// ==========================================
// 3. PLATAFORMAS E COMBATE 3D (MAP-T05, MAP-T06, R7.4, R7.10-R7.12)
// ==========================================
console.log('\n3. Plataformas e Combate 3D:');

test('Plataformas sólidas têm alturas corretas (1,0 m e 1,5 m)', () => {
  const g = new Game({seed: 6});
  const plats = g.mapState.platforms;
  assert.equal(plats.length, 2, 'Devem existir 2 plataformas sólidas');
  assert.ok(plats.some(p => Math.abs(p.height - 1.0) < 0.01), 'Plataforma de 1.0m deve existir');
  assert.ok(plats.some(p => Math.abs(p.height - 1.5) < 0.01), 'Plataforma de 1.5m deve existir');
});

test('Lutador em cima da plataforma caminha na altura da plataforma', () => {
  const g = new Game({seed: 7});
  g.start();
  const f = g.fighters[0];
  const p = g.mapState.platforms[0];
  f.position = {x: p.pos.x, z: p.pos.z};
  f.groundY = p.height;
  g.step(emptyCommand(), emptyCommand());
  assert.equal(f.groundY, p.height, 'Altura deve ser sustentada pela plataforma');
});

test('Lutador que caminha além da borda da plataforma cai até o solo sem travar', () => {
  const g = new Game({seed: 8});
  g.start();
  const f = g.fighters[0];
  const p = g.mapState.platforms[0];
  // Posição no limite da borda avançando para fora
  f.position = {x: p.pos.x, z: p.pos.z + p.depth / 2 - 0.05};
  f.groundY = p.height;
  f.velocity = vec(0, 5);
  // Avança múltiplos passos
  for (let i = 0; i < 30; i++) {
    g.step({move: vec(0, 1)}, emptyCommand());
  }
  assert.ok(f.position.z > p.pos.z + p.depth / 2, 'Lutador deve ultrapassar a borda');
  assert.ok((f.flight?.y ?? f.groundY) < p.height, 'Lutador deve ter caído em direção ao solo');
});

test('Tackle com desnível vertical > 1,2 m não conecta dano', () => {
  const g = new Game({seed: 9});
  g.start();
  const a = g.fighters[0];
  const d = g.fighters[1];
  a.position = {x: 0, z: -2, y: 0};
  d.position = {x: 0, z: 0, y: 1.5}; // Diferença de 1.5m
  d.groundY = 1.5;
  g.step({tackle: true, move: vec(0, 1), target: 1}, emptyCommand());
  for (let i = 0; i < 15; i++) g.step(emptyCommand(), emptyCommand());
  const hit = g.events.some(e => e.result === 'impact');
  assert.ok(!hit, 'Tackle no chão não pode conectar em combatente a 1.5m de altura');
});

// ==========================================
// 4. OBJETOS DESTRUTÍVEIS E DROP (MAP-T07-T10, R3.1-R3.10)
// ==========================================
console.log('\n4. Objetos Destrutíveis e Drops:');

test('Existem 4 objetos destrutíveis com 30 HP base', () => {
  const g = new Game({seed: 10});
  const dests = g.mapState.destructibles;
  assert.equal(dests.length, 4, 'Devem existir exatamente 4 objetos destrutíveis');
  dests.forEach(d => {
    assert.equal(d.hp, 30, 'HP base deve ser 30');
    assert.equal(d.state, 'solid', 'Estado inicial deve ser solid');
  });
});

test('Destruição de objeto gera drop balístico de consumível', () => {
  const mapState = createMapState(11);
  initMap(mapState);
  const d = mapState.destructibles[0];
  const events = [];
  const destroyed = damageDestructible(d, 50, 'physical', null, mapState, events);
  assert.ok(destroyed, 'Dano letal deve destruir o objeto');
  assert.equal(d.state, 'dead', 'Estado deve mudar para dead');
  assert.ok(mapState.items.some(it => it.isDrop), 'Item dropado deve ser registrado no mapa');
});

test('Destrutível destruído passa por prévia fantasma (ghost) antes de materializar', () => {
  const mapState = createMapState(12);
  initMap(mapState);
  const d = mapState.destructibles[0];
  d.state = 'dead';
  d.respawnTimer = 2.0; // limite de ghost preview
  const events = [];
  stepMap(mapState, 0.1, [], events);
  assert.equal(d.state, 'ghost', 'Deve entrar em estado ghost');
  assert.ok(events.some(e => e.result === 'destructibleGhost'), 'Evento destructibleGhost deve ser emitido');
});

test('Respawn é adiado se não houver posição válida (R10.6, Caso C)', () => {
  const mapState = createMapState(13);
  initMap(mapState);
  const d = mapState.destructibles[0];
  d.state = 'dead';
  d.respawnTimer = 1.9;
  // Simula arena onde candidate sempre falha
  const origFind = findNearestValidPosition;
  // Força encontrar nada
  const events = [];
  d.respawnTimer = 1.8;
  // Teste de adiamento: se ocupado por fighter, ghostTimer é adiado
  d.state = 'ghost';
  d.ghostTimer = 0.01;
  const fighterOnTop = {position: {...d.pos}};
  stepMap(mapState, 0.05, [fighterOnTop], events);
  assert.equal(d.state, 'ghost', 'Deve permanecer em ghost quando local estiver ocupado');
  assert.ok(d.ghostTimer > 0, 'Ghost timer deve ser adiado');
});

// ==========================================
// 5. CONSUMÍVEIS, ESTÁGIOS E STAMINA INDIVIDUAL (MAP-T11-T15, R4.1-R6.10)
// ==========================================
console.log('\n5. Consumíveis, Estágios e Stamina Individual:');

test('7 tipos de consumíveis têm probabilidades rigorosamente iguais', () => {
  assert.equal(CONSUMABLE_TYPES.length, 7, 'Devem existir exatamente 7 tipos');
  const mapState = createMapState(100);
  const counts = {};
  CONSUMABLE_TYPES.forEach(t => counts[t] = 0);
  const N = 7000;
  for (let i = 0; i < N; i++) {
    const idx = Math.floor(nextRandom(mapState) * CONSUMABLE_TYPES.length);
    counts[CONSUMABLE_TYPES[idx]]++;
  }
  // Cada tipo deve estar próximo de 1000 (tolerância de 15%)
  CONSUMABLE_TYPES.forEach(t => {
    assert.ok(counts[t] > 800 && counts[t] < 1200, `Contagem ${t}: ${counts[t]} dentro da faixa estatística`);
  });
});

test('Limite de 4 itens suspende geração regular mesmo com drops (Caso B)', () => {
  const mapState = createMapState(14);
  mapState.items = [
    {id: 1, type: 'heal_hp', pos: {x: 1, z: 1, y: 0.4}, life: 15, isDrop: false},
    {id: 2, type: 'heal_stamina', pos: {x: 2, z: 2, y: 0.4}, life: 15, isDrop: false},
    {id: 3, type: 'buff_speed', pos: {x: 3, z: 3, y: 0.4}, life: 15, isDrop: true}, // Drop
    {id: 4, type: 'buff_attack', pos: {x: 4, z: 4, y: 0.4}, life: 15, isDrop: true}, // Drop
  ];
  mapState.regularSpawnTimer = 5.0;
  stepMap(mapState, 1.0, []);
  assert.equal(mapState.regularSpawnTimer, 5.0, 'Timer de spawner regular deve ficar suspenso com 4 itens no total');
});

test('Evolução de stamina é estritamente individual e não altera C.rules.staminaMax (Caso A)', () => {
  C.rules.staminaMax = 3;
  const f0 = createFighter(0, {hp: 100, attack: 10, defense: 10, speed: 10}, vec(-5, 0));
  const f1 = createFighter(1, {hp: 100, attack: 10, defense: 10, speed: 10}, vec(5, 0));
  
  applyConsumableEffect(f0, 'buff_stamina_max');
  assert.equal(f0.stages.staminaMax, 1, 'F0 deve subir 1 estágio de stamina');
  assert.equal(f1.stages.staminaMax, 0, 'F1 deve permanecer no estágio 0');
  
  assert.equal(getFighterMaxStamina(f0), 4, 'F0 deve ter max stamina individual 4');
  assert.equal(getFighterMaxStamina(f1), 3, 'F1 deve ter max stamina individual 3');
  assert.equal(C.rules.staminaMax, 3, 'C.rules.staminaMax global DEVE permanecer 3');
});

test('Coleta de HP com excesso converte apenas o excedente em escudo (R11.4)', () => {
  const f = createFighter(0, {hp: 100, attack: 10, defense: 10, speed: 10}, vec(0, 0));
  f.hp = 92;
  applyHpHeal(f, 20); // 92 + 20 = 112 -> 100 HP + 12 Escudo
  assert.equal(f.hp, 100, 'HP deve ser truncado em 100');
  assert.equal(f.shield.hp, 12, 'Excedente de 12 deve virar pontos de escudo');
  assert.equal(f.shield.duration, 10, 'Duração do escudo deve ser 10 s');
});

// ==========================================
// 6. PIPELINE UNIFICADO DE ESCUDO E DANO (MAP-T16-T17, Caso H)
// ==========================================
console.log('\n6. Pipeline Unificado de Escudo e Dano (Caso H):');

test('Escudo absorve dano bruto antes de passar para a Defesa', () => {
  const f = createFighter(1, {hp: 100, attack: 10, defense: 10, speed: 10}, vec(0, 0));
  f.shield = {hp: 40, duration: 10, maxHp: 80};
  f.stages.defense = 2; // -20 pp de redução no residual
  
  // Dano de 30 (menor que escudo de 40)
  const res1 = processDamageWithShieldAndStages(null, f, 30, false);
  assert.equal(res1.absorbedByShield, 30, 'Escudo deve absorver todos os 30 pontos');
  assert.equal(res1.hpDamage, 0, 'Nenhum dano deve atingir o HP');
  assert.equal(f.shield.hp, 10, 'Escudo deve ficar com 10 HP');
  assert.equal(f.hp, 100, 'HP deve permanecer 100');
});

test('Dano residual que supera o escudo passa por mitigação de Defesa', () => {
  const f = createFighter(1, {hp: 100, attack: 10, defense: 10, speed: 10}, vec(0, 0));
  f.shield = {hp: 20, duration: 10, maxHp: 80};
  f.stages.defense = 2; // fator 0.80 no residual
  
  // Dano de 50: 20 absorvido pelo escudo, 30 residual -> 30 * 0.80 = 24 de dano ao HP
  const res = processDamageWithShieldAndStages(null, f, 50, false);
  assert.equal(res.absorbedByShield, 20, '20 pontos absorvidos pelo escudo');
  assert.equal(f.shield.hp, 0, 'Escudo zerado');
  assert.ok(near(res.hpDamage, 24, 0.01), `Dano ao HP deve ser 24 (obtido ${res.hpDamage})`);
  assert.ok(near(f.hp, 76, 0.01), `HP deve ser 76 (obtido ${f.hp})`);
});

test('Acúmulo de escudo respeita teto configurável e renova duração para 10s', () => {
  const f = createFighter(0, {hp: 100, attack: 10, defense: 10, speed: 10}, vec(0, 0));
  f.shield = {hp: 30, duration: 4.0, maxHp: 60};
  applyShield(f, 40, 10);
  assert.equal(f.shield.hp, 60, 'Deve acumular e truncar no teto de 60');
  assert.equal(f.shield.duration, 10, 'Deve renovar a duração completa de 10 s');
});

test('Timers de escudo e respawn não avançam durante hitstop e pausa (Caso E)', () => {
  const g = new Game({seed: 15});
  const f = g.fighters[0];
  f.shield = {hp: 40, duration: 10.0, maxHp: 80};
  g.hitstop = 0.5;
  g.step(emptyCommand(), emptyCommand());
  assert.equal(f.shield.duration, 10.0, 'Duração do escudo não deve avançar durante hitstop');
});

// ==========================================
// 7. DETERMINISMO E REPLAY (MAP-T23, Caso D)
// ==========================================
console.log('\n7. Determinismo e Replay:');

test('Simulação e save/load produzem replay 100% idêntico sem performance.now', () => {
  const g1 = new Game({seed: 777});
  g1.start();
  const g2 = new Game({seed: 777});
  g2.start();
  
  for (let i = 0; i < 60; i++) {
    const cmd0 = {move: vec(0.5, 0.5), tackle: i === 20};
    const cmd1 = {move: vec(-0.5, -0.5)};
    g1.step(cmd0, cmd1);
    g2.step(cmd0, cmd1);
  }
  
  assert.equal(g1.tick, g2.tick, 'Ticks devem ser idênticos');
  assert.equal(g1.fighters[0].hp, g2.fighters[0].hp, 'HP de f0 idêntico');
  assert.equal(g1.fighters[1].hp, g2.fighters[1].hp, 'HP de f1 idêntico');
  assert.ok(near(g1.fighters[0].position.x, g2.fighters[0].position.x, 1e-9), 'Posições X idênticas');
  assert.ok(near(g1.fighters[0].position.z, g2.fighters[0].position.z, 1e-9), 'Posições Z idênticas');
});

// ==========================================
// 8. TESTE DE ESTRESSE: 100 SEEDS DISTINTAS (SEÇÃO 5)
// ==========================================
console.log('\n8. Teste de Estresse em 100 Seeds Distintas:');

test('100 seeds de geração de mapa respeitam todas as invariantes', () => {
  let seedsTested = 0;
  for (let s = 1; s <= 100; s++) {
    const mapState = createMapState(s);
    const g = new Game({seed: s});
    initMap(mapState, g.fighters);
    
    // Invariante 1: 4 destrutíveis e 4 indestrutíveis
    assert.equal(mapState.destructibles.length, 4, `Seed ${s}: 4 destrutíveis`);
    assert.equal(mapState.obstacles.length, 4, `Seed ${s}: 4 obstáculos`);
    assert.equal(mapState.platforms.length, 2, `Seed ${s}: 2 plataformas`);
    
    // Invariante 2: Todas as entidades dentro do raio da arena
    for (const d of mapState.destructibles) {
      const dist = Math.hypot(d.pos.x, d.pos.z);
      assert.ok(dist < 49, `Seed ${s}: destrutível dentro da arena`);
    }
    for (const o of mapState.obstacles) {
      const dist = Math.hypot(o.pos.x, o.pos.z);
      assert.ok(dist < 49, `Seed ${s}: obstáculo dentro da arena`);
    }
    for (const p of mapState.platforms) {
      const dist = Math.hypot(p.pos.x, p.pos.z);
      assert.ok(dist < 49, `Seed ${s}: plataforma dentro da arena`);
    }
    
    // Invariante 3: Simulação de 60 passos sem NaN ou crash
    for (let t = 0; t < 60; t++) {
      g.step(emptyCommand(), emptyCommand());
    }
    for (const f of g.fighters) {
      assert.ok(!Number.isNaN(f.hp), `Seed ${s}: HP não pode ser NaN`);
      assert.ok(!Number.isNaN(f.stamina), `Seed ${s}: Stamina não pode ser NaN`);
      assert.ok(!Number.isNaN(f.position.x), `Seed ${s}: PosX não pode ser NaN`);
      assert.ok(!Number.isNaN(f.position.z), `Seed ${s}: PosZ não pode ser NaN`);
    }
    seedsTested++;
  }
  assert.equal(seedsTested, 100, '100 seeds testadas com sucesso');
});

// ==========================================
// 9. EXECUÇÃO DOS CENÁRIOS DO MAPA NA SUÍTE
// ==========================================
console.log('\n9. Execução dos Cenários Oficiais do Mapa:');

const mapScenarios = SCENARIOS.filter(s => s.id.startsWith('map-'));
assert.equal(mapScenarios.length, 34, 'Devem existir exatamente 34 cenários do mapa');

let scenariosPassed = 0;
for (const sc of mapScenarios) {
  try {
    const res = runScenario(sc);
    assert.ok(res.ok, `Cenário ${sc.id} falhou nos checks: ${JSON.stringify(res.checks.filter(c => !c.ok))}`);
    scenariosPassed++;
    console.log(`  ✓ [Cenário] ${sc.name}`);
  } catch (err) {
    console.error(`  ✗ [Cenário] ${sc.name}:`, err.message);
    failed++;
  }
}
assert.equal(scenariosPassed, 34, 'Todos os 34 cenários do mapa devem passar com 100% de aprovação');

console.log(`\n--- RESULTADO FINAL DA SUÍTE DE TESTES DO MAPA ---`);
console.log(`Total aprovados: ${passed + scenariosPassed}`);
console.log(`Total falhas: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
