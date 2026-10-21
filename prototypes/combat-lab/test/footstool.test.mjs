// @ts-check
// Plano D (Salto 3D estilo SM64 + Footstool): testes de comportamento novos.
// Footstool: dano exato 5 em desprotegido, rebote ~3,7, stagger 0,25, um acerto por contato,
// inválido lateral/subindo, invulnerável rebate sem dano, escudo absorve, sem múltiplos eventos.
// Salto: curto × completo distintos (salto variável), coyote time, buffer de entrada.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {createFighter, emptyCommand} from '../src/sim/entity.js';
import {resolveFootstool} from '../src/sim/combat.js';
import {vec} from '../src/sim/math.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try {fn();passed++;console.log(`  ✓ ${name}`);}
  catch (err) {failed++;console.error(`  ✗ ${name}:`, err.message);}
}
const near = (a, b, tol = 1e-3) => Math.abs(a - b) <= tol;

console.log('\n--- PLANO D: SALTO 3D E FOOTSTOOL ---\n');

// ---------- Auxiliares ----------
/** Partida nova com os lutadores posicionados e a IA desligada. */
function setup(seed = 21) {
  resetConfig(defaults());
  C.extras.toggles.enableEnemyAI = 0;
  const g = new Game({seed});
  g.start();
  const a = g.fighters[0], d = g.fighters[1];
  a.position = {x: 0, z: -0.3};a.velocity = vec();a.groundY = 0;
  d.position = {x: 0, z: 0};d.velocity = vec();d.groundY = 0;
  return {g, a, d};
}
/** Atacante em queda controlada sobre o defensor (salto normal injetado direto na física). */
function dropAbove(a, y = 2.2, vy = -3) {
  a.flight = {y, vy, horizontal: vec(), isNormalJump: true, jumpFeel: true, jumpHeld: false};
}
/** Avança até o evento footstool/invulnerable acontecer (ou esgotar os passos). */
function stepUntilContact(g, max = 240) {
  for (let i = 0; i < max; i++) {
    g.step(emptyCommand(), emptyCommand());
    const ev = g.events.findLast(e => e.result === 'footstool' || (e.result === 'invulnerable' && e.contact === 'footstool'));
    if (ev) return ev;
  }
  return null;
}
const bodyH = () => C.extras?.visual?.bodyHeight ?? 1.2;

// ==========================================
console.log('1. Footstool: detecção e efeitos');
// ==========================================

test('Dano exatamente 5 HP e stagger 0,25 s em alvo desprotegido', () => {
  const {g, a, d} = setup();
  const hp0 = d.hp;
  dropAbove(a);
  const ev = stepUntilContact(g);
  assert.ok(ev, 'Footstool deve ocorrer ao cair sobre o rival');
  assert.equal(ev.result, 'footstool');
  assert.equal(ev.damage, 5, `Dano deve ser exatamente 5 (obtido ${ev.damage})`);
  assert.equal(d.hp, hp0 - 5, 'HP deve cair exatamente 5');
  assert.ok(near(ev.stagger, 0.25, 1e-6), 'Evento carrega stagger de 0,25 s');
  assert.ok((d.stun ?? 0) > 0, 'Defensor entra em stagger real (stun)');
  assert.equal(ev.contact, 'footstool');
});

test('Atacante rebate para cima com ~3,7 m/s e sem dano a si mesmo', () => {
  const {g, a, d} = setup();
  const hpA = a.hp;
  dropAbove(a);
  const ev = stepUntilContact(g);
  assert.ok(ev && ev.result === 'footstool', 'Footstool deve ocorrer');
  assert.ok(a.flight, 'Atacante continua no ar após o footstool');
  assert.ok(near(a.flight.vy, C.map.footstoolBounce, 1e-6), `Rebote deve ser footstoolBounce (${C.map.footstoolBounce} m/s, obtido ${a.flight.vy})`);
  const bTop = (d.groundY ?? 0) + bodyH();
  assert.ok(a.flight.y >= bTop, 'Pés do atacante ficam apoiados no topo do colisor do defensor');
  assert.equal(a.hp, hpA, 'Atacante não recebe dano ao pisar');
});

test('Sem re-acerto: um único footstool por trajetória/contato', () => {
  const {g} = setup();
  dropAbove(g.fighters[0]);
  stepUntilContact(g);
  // Continua a simulação: o rebote sobe e pode cair de novo sobre o mesmo rival.
  for (let i = 0; i < 240; i++) g.step(emptyCommand(), emptyCommand());
  const hits = g.events.filter(e => e.result === 'footstool');
  assert.equal(hits.length, 1, `Deve existir exatamente 1 evento de footstool (obtidos ${hits.length})`);
});

test('Contato lateral (sem sobreposição horizontal) não gera footstool', () => {
  const {g, a, d} = setup();
  const reach = 2 * C.test.halfExtent + C.map.footstoolTolerance;
  a.position = {x: reach + 0.3, z: 0};   // fora da tolerância
  d.position = {x: 0, z: 0};
  const hp0 = d.hp;
  dropAbove(a, 2.2, -3);
  for (let i = 0; i < 240; i++) g.step(emptyCommand(), emptyCommand());
  assert.ok(!g.events.some(e => e.result === 'footstool'), 'Sem sobreposição horizontal: nenhum footstool');
  assert.equal(d.hp, hp0, 'Defensor não recebe dano');
});

test('Subindo (sem velocidade de queda) não gera footstool', () => {
  const {g, a, d} = setup();
  const hp0 = d.hp;
  // Cruza o topo do defensor durante a SUBIDA (vy positivo) e deriva para o lado:
  // ao cair depois do ápice, já está fora da sobreposição horizontal.
  a.flight = {y: bodyH() + 0.9, vy: 3, horizontal: vec(6, 0), isNormalJump: true, jumpFeel: true, jumpHeld: false};
  for (let i = 0; i < 240; i++) g.step(emptyCommand(), emptyCommand());
  assert.ok(!g.events.some(e => e.result === 'footstool'), 'Subindo: nenhum footstool');
  assert.equal(d.hp, hp0, 'Defensor não recebe dano');
});

test('Queda lenta demais (abaixo da velocidade mínima) não gera footstool', () => {
  const {g, a, d} = setup(23);
  C.map.footstoolMinFallSpeed = 3.0;    // exigência alta: a queda atravessa a faixa de contato sem jamais atingi-la
  const hp0 = d.hp;
  dropAbove(a, bodyH() + 0.03, -0.5);   // começa lento e atravessa a banda de tolerância ainda abaixo de 3 m/s
  for (let i = 0; i < 240; i++) g.step(emptyCommand(), emptyCommand());
  assert.ok(!g.events.some(e => e.result === 'footstool'), 'Queda lenta: nenhum footstool');
  assert.equal(d.hp, hp0, 'Defensor não recebe dano');
});

test('Footstool desligado (footstoolEnabled = 0) não gera contato', () => {
  const {g, a, d} = setup();
  C.map.footstoolEnabled = 0;
  const hp0 = d.hp;
  dropAbove(a);
  for (let i = 0; i < 240; i++) g.step(emptyCommand(), emptyCommand());
  assert.ok(!g.events.some(e => e.result === 'footstool'), 'Sistema desligado: nenhum footstool');
  assert.equal(d.hp, hp0, 'Defensor não recebe dano');
});

// ==========================================
console.log('\n2. Footstool: pipeline de dano (unitário)');
// ==========================================

test('Invulnerável: rebate sem dano e sem stagger, evento result invulnerable', () => {
  resetConfig(defaults());
  const a = createFighter(0, {hp: 100, attack: 10, defense: 10, speed: 10}, vec(0, -0.3));
  const d = createFighter(1, {hp: 100, attack: 10, defense: 10, speed: 10}, vec(0, 0));
  d.action = {kind: 'dodge', elapsed: 0, invulnerableFor: 0.5};
  const hp0 = d.hp;
  const ev = resolveFootstool(a, d);
  assert.equal(ev.result, 'invulnerable');
  assert.equal(ev.damage, 0);
  assert.equal(ev.contact, 'footstool');
  assert.equal(d.hp, hp0, 'Sem dano em alvo invulnerável');
  assert.ok(!(d.stun > 0), 'Sem stagger em alvo invulnerável');
});

test('Escudo absorve os 5 HP antes do dano ao HP', () => {
  resetConfig(defaults());
  const a = createFighter(0, {hp: 100, attack: 10, defense: 10, speed: 10}, vec(0, -0.3));
  const d = createFighter(1, {hp: 100, attack: 10, defense: 10, speed: 10}, vec(0, 0));
  d.shield = {hp: 40, duration: 10, maxHp: 80};
  const hp0 = d.hp;
  const ev = resolveFootstool(a, d);
  assert.equal(ev.result, 'footstool');
  assert.equal(ev.damage, 0, 'Nada passa para o HP');
  assert.equal(ev.shieldAbsorbed, 5, 'Escudo absorve os 5 HP');
  assert.equal(d.hp, hp0, 'HP intacto');
  assert.equal(d.shield.hp, 35, 'Escudo consumiu 5');
  assert.ok((d.stun ?? 0) > 0, 'Stagger aplica mesmo com escudo');
});

test('Estágios de defesa reduzem o dano residual (pipeline central)', () => {
  resetConfig(defaults());
  const a = createFighter(0, {hp: 100, attack: 10, defense: 10, speed: 10}, vec(0, -0.3));
  const d = createFighter(1, {hp: 100, attack: 10, defense: 10, speed: 10}, vec(0, 0));
  d.stages.defense = 1;   // -10 pp: 5 × 0,90 = 4,5
  const ev = resolveFootstool(a, d);
  assert.ok(near(ev.damage, 4.5, 0.01), `Dano residual deve respeitar estágio de defesa (obtido ${ev.damage})`);
});

test('Interrupção: ação e guarda do defensor caem (sem launch/push)', () => {
  resetConfig(defaults());
  const a = createFighter(0, {hp: 100, attack: 10, defense: 10, speed: 10}, vec(0, -0.3));
  const d = createFighter(1, {hp: 100, attack: 10, defense: 10, speed: 10}, vec(0, 0));
  d.action = {kind: 'tackle', elapsed: 0.1, invulnerableFor: 0};   // fora da janela de invulnerabilidade
  d.guard = true;
  resolveFootstool(a, d);
  assert.equal(d.action, null, 'Ação em curso interrompida');
  assert.equal(d.guard, false, 'Defesa frontal não protege do contato superior');
  assert.equal(d.push, null, 'Sem empurrão (push) no footstool');
});

// ==========================================
console.log('\n3. Salto: salto variável, coyote time e buffer');
// ==========================================

test('Salto completo (botão segurado) alcança ~2,0 m; salto curto fica bem menor', () => {
  const apex = hold => {
    resetConfig(defaults());
    C.extras.toggles.enableEnemyAI = 0;
    const g = new Game({seed: 31});
    g.start();
    const f = g.fighters[0];
    f.position = {x: -10, z: -10};   // longe do rival: footstool impossível
    let top = 0;
    g.step({...emptyCommand(), jump: true, jumpHeld: true}, emptyCommand());
    for (let i = 0; i < 300; i++) {
      g.step({...emptyCommand(), jumpHeld: hold || i === 0}, emptyCommand());
      if (f.flight) top = Math.max(top, f.flight.y);
      else if (top > 0) break;
    }
    return top;
  };
  const full = apex(true), short = apex(false);
  assert.ok(near(full, C.map.jumpHeight, 0.05), `Salto completo deve chegar a ~${C.map.jumpHeight} m (obtido ${full})`);
  assert.ok(short < full * 0.7, `Salto curto deve ser claramente menor (${short} × ${full})`);
  assert.ok(short > 0.3, 'Salto curto ainda sobe um pouco');
});

test('Coyote time: salto logo após sair da borda converte a queda em salto normal', () => {
  resetConfig(defaults());
  C.extras.toggles.enableEnemyAI = 0;
  const g = new Game({seed: 33});
  g.start();
  const f = g.fighters[0];
  const p = g.mapState.platforms[0];
  f.position = {x: p.pos.x, z: p.pos.z + p.depth / 2 - 0.05};
  f.groundY = p.height;
  f.velocity = vec(0, 5);
  // Anda para fora da plataforma até entrar em queda de borda.
  let fell = false;
  for (let i = 0; i < 40 && !fell; i++) {
    g.step({...emptyCommand(), move: vec(0, 1)}, emptyCommand());
    fell = !!f.flight && !!f.flight.isEdgeFall;
  }
  assert.ok(fell, 'Lutador deve cair da borda da plataforma');
  assert.ok((f.coyoteLeft ?? 0) > 0, 'Queda de borda concede coyote time');
  g.step({...emptyCommand(), jump: true, jumpHeld: true}, emptyCommand());
  assert.ok(f.flight && f.flight.isNormalJump, 'Dentro do coyote time, o salto converte a queda em salto normal');
  assert.ok(f.flight.vy > 0, 'Salto de coyote impulsiona para cima');
});

test('Buffer: aperto de salto antes do pouso dispara o salto ao aterrissar', () => {
  resetConfig(defaults());
  C.extras.toggles.enableEnemyAI = 0;
  const g = new Game({seed: 35});
  g.start();
  const f = g.fighters[0];
  f.position = {x: -10, z: 10};
  g.step({...emptyCommand(), jump: true, jumpHeld: true}, emptyCommand());
  assert.ok(f.flight, 'Primeiro salto sai do chão');
  let buffered = false, landed = -1;
  for (let i = 0; i < 300; i++) {
    const cmd = {...emptyCommand()};
    if (!buffered && f.flight && f.flight.vy < 0 && f.flight.y < 0.3) {cmd.jump = true;buffered = true;}
    g.step(cmd, emptyCommand());
    if (buffered && landed < 0 && !f.flight) landed = i;
    if (landed >= 0 && i > landed + 40) break;
  }
  assert.ok(buffered, 'Comando de salto foi dado no ar');
  assert.ok(landed >= 0, 'Lutador aterrissou');
  // Após o pouso, o salto bufferado dispara sozinho (respeitando o intervalo/cooldown).
  let reflew = false;
  for (let i = 0; i < 60; i++) {
    g.step(emptyCommand(), emptyCommand());
    if (f.flight && f.flight.isNormalJump) {reflew = true;break;}
  }
  assert.ok(reflew, 'Salto bufferado dispara automaticamente após o pouso');
});

test('Controle aéreo: curvar no ar preserva a velocidade total (sem ganho de momentum)', () => {
  resetConfig(defaults());
  C.extras.toggles.enableEnemyAI = 0;
  const g = new Game({seed: 37});
  g.start();
  const f = g.fighters[0];
  f.position = {x: -10, z: -10};
  f.velocity = vec(0, 5);
  g.step({...emptyCommand(), jump: true, move: vec(0, 1), jumpHeld: true}, emptyCommand());
  assert.ok(f.flight && f.flight.isNormalJump);
  const speed0 = Math.hypot(f.flight.horizontal.x, f.flight.horizontal.z);
  for (let i = 0; i < 12; i++) g.step({...emptyCommand(), move: vec(1, 0), jumpHeld: true}, emptyCommand());
  const h = f.flight ? Math.hypot(f.flight.horizontal.x, f.flight.horizontal.z) : 0;
  assert.ok(f.flight && f.flight.horizontal.x > 0.3, 'Controle aéreo gera deslocamento lateral');
  assert.ok(h <= speed0 + 1e-6, `Velocidade total não pode crescer (${h} > ${speed0})`);
});

console.log(`\n--- RESULTADO: PLANO D (SALTO + FOOTSTOOL) ---`);
console.log(`Total aprovados: ${passed}`);
console.log(`Total falhas: ${failed}`);
if (failed > 0) process.exit(1);
