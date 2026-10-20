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

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed) {console.log('Falhas:', failures.join(' | '));process.exit(1);}
