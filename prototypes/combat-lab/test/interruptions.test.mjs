// Interrupções simultâneas e transições de estado (§20–§23 da auditoria sistêmica, 20/10/2026).
// Cada teste fixa uma invariante de ordem/integridade quando dois eventos competem pelo mesmo passo físico.
// Uso: node prototypes/combat-lab/test/interruptions.test.mjs
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {vec} from '../src/sim/math.js';
import {launch} from '../src/sim/combat.js';
import {stepPhysics} from '../src/sim/physics.js';
import {stepMap, processDamageWithShieldAndStages} from '../src/sim/map.js';
import {spawn} from '../src/sim/world.js';
import {emptyCommand} from '../src/sim/entity.js';

let passed = 0, failed = 0;
const failures = [];
const test = (name, fn) => {
  try {fn();passed++;console.log('✓', name);}
  catch (e) {failed++;failures.push(name);console.log('✗', name, '—', String(e.message).split('\n')[0]);}
};

/** Partida inativa determinística com mapa vazio sob medida. */
function arena() {
  resetConfig(defaults());
  const g = new Game({seed: 3});
  g.mode = 'inactive';
  g.reset({positions: [vec(0, -3), vec(0, 3)]});
  g.mapState.platforms = [];
  g.mapState.obstacles = [];
  g.mapState.destructibles = [];
  g.mapState.items = [];
  return g;
}
const step = (g) => stepPhysics(g.fighters, C.test.step, g.world);

// ---------------------------------------------------------------------------
// §9/§23 — a plataforma some sob o lutador: perda de apoio vira queda balística, sem teleporte
// ---------------------------------------------------------------------------
test('plataforma removida sob o lutador: queda balística pela borda até o solo (§9/§23)', () => {
  const g = arena();
  g.mapState.platforms = [{id: 'p1', pos: {x: 0, z: 0}, width: 3, depth: 3, height: 1.5}];
  const f = g.fighters[0];
  f.position = vec(0, 0);
  f.groundY = 1.5;
  step(g); // apoiado: confirma o apoio
  assert.equal(f.groundY, 1.5, 'apoiado no topo antes da remoção');
  assert.equal(f.state, 'neutral');
  g.mapState.platforms = []; // a plataforma desaparece no mesmo instante
  step(g);
  assert.ok(f.flight, 'perda de apoio entra em voo (queda balística)');
  assert.equal(f.flight.y, 1.5, 'a queda começa na altitude real, sem teleporte');
  for (let i = 0; i < 400 && f.flight; i++) step(g);
  assert.ok(!f.flight && f.groundY === 0, `aterrissou no solo (groundY=${f.groundY})`);
});

// ---------------------------------------------------------------------------
// §23 — derrota em pleno voo: aterrissa 'defeated', sem recuperação de aterrissagem
// ---------------------------------------------------------------------------
test('HP zerado em pleno voo: aterrissagem direta em "defeated", sem recovery de pouso (§23)', () => {
  const g = arena();
  const f = g.fighters[0];
  f.position = vec(0, -3);
  launch(f, vec(1, 0), 4, 6);
  for (let i = 0; i < 6; i++) step(g); // no ar
  assert.ok(f.flight, 'lutador em voo');
  f.hp = 0; // derrota acontece no ar
  for (let i = 0; i < 400 && f.flight; i++) step(g);
  assert.equal(f.state, 'defeated', `estado físico corresponde ao fato (state=${f.state})`);
  assert.equal(f.knockRecovery, 0, 'sem recuperação de aterrissagem após a derrota');
  assert.equal(f.groundY, 0, 'apoiado no solo');
});

// ---------------------------------------------------------------------------
// §22/§23 — cadeia completa: lançamento → colisão com parede → wall-splat → aterrissagem
// ---------------------------------------------------------------------------
test('cadeia lançamento → wall-splat → queda → aterrissagem, com recuperação de knockdown (§22)', () => {
  resetConfig(defaults());
  C.rules.wallSplatDamage = 0; // isolamento: só a cadeia cinemática importa aqui
  const g = arena();
  const b = g.fighters[1];
  b.position = vec(0, 49.6);
  b.flight = {y: 3, vy: -5, horizontal: vec(0, 9)};
  b.state = 'airborne';
  const events = step(g);
  assert.ok(events.some(e => e.result === 'wallSplat'), 'wall-splat disparou na parede');
  assert.equal(b.state, 'wallSplat', 'preso na parede');
  let sawAirborne = false;
  for (let i = 0; i < 600 && (b.flight || b.state === 'wallSplat'); i++) {
    step(g);
    if (b.state === 'airborne' && b.flight) sawAirborne = true;
  }
  assert.ok(sawAirborne, 'após o wall-splat o lutador volta a cair (airborne)');
  assert.ok(!b.flight && b.groundY === 0, `aterrissou no solo (groundY=${b.groundY})`);
  assert.ok(b.state === 'landing' || b.state === 'neutral' || b.state === 'defeated', `estado de aterrissagem coerente (state=${b.state})`);
});

// ---------------------------------------------------------------------------
// §23 — dois danos no mesmo passo: escudo absorve o primeiro, o excedente do segundo passa; ordem determinística
// ---------------------------------------------------------------------------
test('dois impactos no mesmo passo: escudo → HP na ordem, resultado determinístico (§23)', () => {
  resetConfig(defaults());
  const g = arena();
  const f = g.fighters[0];
  f.position = vec(0, -3);
  f.shield = {hp: 6, duration: 10, maxHp: 80};
  const r1 = processDamageWithShieldAndStages(f, 5, null, false); // 5 no escudo
  const r2 = processDamageWithShieldAndStages(f, 5, null, false); // 1 no escudo + 4 no HP
  assert.equal(r1.hpDamage, 0, 'primeiro impacto totalmente absorvido');
  assert.equal(r2.hpDamage, 4, 'segundo impacto: excedente do escudo vai ao HP');
  assert.equal(f.hp, 96, `HP reflete ambos na ordem (hp=${f.hp})`);
  assert.equal(f.shield.hp, 0, 'escudo esgotado');
});

// ---------------------------------------------------------------------------
// §23 — item coletado e dano no mesmo passo: ambos os efeitos vigentes; derrotado não coleta (R10.5)
// ---------------------------------------------------------------------------
test('coleta de item + dano no mesmo passo: ambos aplicados; derrotado não coleta (§23/R10.5)', () => {
  const g = arena();
  const [a, b] = g.fighters;
  a.position = vec(0, -3);
  b.position = vec(6, 3);
  b.hp = 0; // derrotado fica longe, mas o item fica ao alcance do vivo
  a.hp = 50;
  g.mapState.items = [{id: 'i1', type: 'heal_hp', pos: {x: 0, y: 0.6, z: -3}, life: 15, isDrop: false, vy: 0}];
  const events = [];
  stepMap(g.mapState, C.test.step, g.fighters, events);
  const collected = events.find(e => e.result === 'itemCollected');
  assert.ok(collected, 'item coletado pelo lutador vivo');
  assert.equal(collected.fighter, a.id, 'o derrotado (longe) não é candidato; o vivo coletou');
  assert.ok(a.hp > 50, `cura aplicada no mesmo passo (hp=${a.hp})`);
  const hpAfterHeal = a.hp;
  const dmg = processDamageWithShieldAndStages(a, 10, null, false); // dano no mesmo "passo" do jogo
  assert.equal(dmg.hpDamage, 10, 'dano bruto sem escudo');
  assert.equal(a.hp, hpAfterHeal - 10, `cura e dano coexistem e somam corretamente: hp=${a.hp}`);
});

// ---------------------------------------------------------------------------
// §31 — obstáculos/plataformas/destrutíveis bloqueiam projéteis (com sobreposição vertical real)
// ---------------------------------------------------------------------------
/** Arena com os lutadores fora da linha de tiro (eixo z, x=0) e um projétil em voo. */
function firingRange() {
  const g = arena();
  g.reset({positions: [vec(-12, -3), vec(12, 3)]});
  g.mapState.platforms = [];
  g.mapState.obstacles = [];
  g.mapState.destructibles = [];
  g.mapState.items = [];
  return g;
}
const PROJ = {kind: 'projectile', owner: 0, pos: {x: 0, z: -4}, dir: {x: 0, z: 1}, y: .65, radius: .25, speed: 14, life: 8, hit: {damage: 10, knockback: {horizontal: 4, vertical: 2}}};
const runProj = (g, tpl, steps = 90) => {
  spawn(g.world, structuredClone(tpl), []);
  const events = [];
  for (let i = 0; i < steps; i++) {g.step(undefined, {...emptyCommand()});events.push(...(g.lastStepEvents ?? []));}
  return events;
};
test('projétil é bloqueado por obstáculo indestrutível (§31)', () => {
  const g = firingRange();
  g.mapState.obstacles = [{id: 'ob1', pos: {x: 0, z: 0, y: 0}, hx: 1.5, hz: 1.5, height: 1.5}];
  const events = runProj(g, PROJ);
  assert.ok(events.some(e => e.result === 'obstacleHit'), 'evento obstacleHit emitido');
  assert.ok(g.world.entities.every(e => e.dead), 'o projétil morreu no obstáculo (não atravessou)');
});
test('projétil é bloqueado pela lateral sólida de uma plataforma (§31)', () => {
  const g = firingRange();
  g.mapState.platforms = [{id: 'p1', pos: {x: 0, z: 0}, width: 3, depth: 3, height: 1}];
  const events = runProj(g, PROJ);
  assert.ok(events.some(e => e.result === 'platformHit'), 'evento platformHit emitido');
  assert.ok(g.world.entities.every(e => e.dead), 'o projétil morreu na plataforma');
});
test('projétil acima da plataforma passa livre (sem sobreposição vertical, não há bloqueio) (§31)', () => {
  const g = firingRange();
  g.mapState.platforms = [{id: 'p1', pos: {x: 0, z: 0}, width: 3, depth: 3, height: 1}];
  const events = runProj(g, {...PROJ, y: 2.5}, 60);
  assert.ok(!events.some(e => e.result === 'platformHit'), 'nenhum bloqueio acima da plataforma');
  assert.ok(g.world.entities.every(e => !e.dead), 'o projétil segue vivo acima da plataforma');
});
test('projétil danifica destrutível e é consumido (§30/§31)', () => {
  const g = firingRange();
  g.mapState.destructibles = [{id: 'd1', pos: {x: 0, z: 0, y: 0}, hp: 30, maxHp: 30, state: 'solid', size: {hx: 1.2, hz: 1.2, height: 1.6}, shape: 'box', angle: 0}];
  const events = runProj(g, PROJ);
  assert.ok(events.some(e => e.result === 'destructibleHit'), 'evento destructibleHit emitido');
  assert.ok(g.mapState.destructibles[0].hp < 30, `o destrutível sofreu dano (hp=${g.mapState.destructibles[0].hp})`);
  assert.ok(g.world.entities.every(e => e.dead), 'o projétil foi consumido no impacto');
});

// ---------------------------------------------------------------------------
// §57 — save/load e replay com estados 3D (voo em altitude, apoio em plataforma): futuro idêntico após restaurar
// ---------------------------------------------------------------------------
test('save/load no meio de um voo sobre plataforma: o futuro reproduzido é idêntico (§57)', () => {
  const g = arena();
  g.mapState.platforms = [{id: 'p1', pos: {x: 0, z: 0}, width: 3, depth: 3, height: 1.5}];
  const f = g.fighters[0];
  f.position = vec(0, -6);
  launch(f, vec(0, 1), 7, 8); // arco longo sobre a plataforma
  const advance = (n) => {
    const events = [];
    for (let i = 0; i < n; i++) {g.step(undefined, {...emptyCommand()});events.push(...(g.lastStepEvents ?? []).map(e => e.result));}
    return events;
  };
  advance(20); // no meio do voo
  const saved = g.save();
  const traceA = advance(60);
  const stateA = {pos: {...f.position}, groundY: f.groundY, flight: f.flight ? {...f.flight} : null, state: f.state, hp: f.hp};
  g.load(saved);
  const traceB = advance(60);
  const stateB = {pos: {...f.position}, groundY: f.groundY, flight: f.flight ? {...f.flight} : null, state: f.state, hp: f.hp};
  assert.deepEqual(traceB, traceA, 'o fluxo de eventos reproduzido é idêntico após restore');
  assert.deepEqual(stateB, stateA, 'posição, apoio, voo, estado e HP idênticos após restore');
});

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed) {console.log('Falhas:', failures.join(' | '));process.exit(1);}
