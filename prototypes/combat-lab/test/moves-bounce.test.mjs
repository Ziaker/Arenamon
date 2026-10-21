// @ts-check
// Bounce (genérico, Charge · Trick + Melee · PL1/PL2/PL3): carga até 1,2 s; salto balístico real de 1,5/2,5/3,5 m, até 6 m de distância; 12 HP nominais, 3 m/s H,
// 6 m/s V; recuperação 0,25 s. Fonte: docs/MOVES_GENERICOS_CATALOGO.md §6.
import {assert, C, Game, cmd, vec, secs, suite, arena, run, fighterHash, HOLD} from './moves-new-helpers.mjs';
import {getMove} from '../src/sim/moves.js';
import {isInvulnerable} from '../src/sim/entity.js';

const {test, done} = suite('BOUNCE');
const hold = {skill: 0, skillHeld: HOLD(0)};
const held = {skillHeld: HOLD(0)};
const lockCmd = {target: 1, locked: true};
/** Azul carrega `ticks` passos e solta (com lock se pedido); devolve o jogo logo depois da soltura. */
function jump({ticks = 20, dist = 8, lock = false, tweak = null, atk = null, red = () => cmd()} = {}) {
  const g = arena({equip: ['bounce'], setup: tweak, positions: [vec(0, -dist / 2), vec(0, dist / 2)]});
  if (atk) g.fighters[0].attributes.attack = atk;
  g.step(cmd({...hold, ...(lock ? lockCmd : {})}), red(0));
  for (let i = 1; i < ticks; i++) g.step(cmd({...held, ...(lock ? lockCmd : {})}), red(i));
  g.step(cmd(lock ? lockCmd : {}), red(ticks));
  return g;
}
/** Roda até pousar (ou n passos) e devolve {events, maxY, g}. */
function fly(g, n = 400, red = () => cmd()) {
  const b = g.fighters[0], ev = [];let maxY = 0, landedAt = -1;
  for (let i = 0; i < n; i++) {
    g.step(cmd(), red(i));ev.push(...g.lastStepEvents);
    if (b.flight) maxY = Math.max(maxY, b.flight.y - (b.groundY ?? 0));
    if (!b.flight && landedAt < 0 && maxY > 0.1) {landedAt = i;}
    if (landedAt >= 0 && i > landedAt + 60) break;
  }
  return {ev, maxY, g, b};
}
const hits = ev => ev.filter(e => e.attacker === 0 && e.source === 'bounce' && ['impact', 'partial', 'perfect'].includes(e.result));

test('registrado com os dados do catálogo: 1,2 de stamina, 12 s, carga máx. 1,2 s; nada equipado por padrão', () => {
  const g = arena();const d = getMove('bounce');
  assert.deepEqual([d.cost, d.cooldown, d.charge.max], [1.2, 12, 1.2]);
  assert.ok(g.fighters.every(f => (f.loadout ?? []).every(x => !x)));
});
test('stamina e recarga cobradas ao INICIAR a carga; interromper mantém os dois', () => {
  const g = arena({equip: ['bounce']});const b = g.fighters[0];
  g.step(cmd(hold), cmd());
  assert.ok(b.charge && Math.abs(b.moveCooldowns.bounce - 12) < .06, `cooldown ${b.moveCooldowns.bounce}`);
  assert.ok(C.rules.staminaMax - b.stamina > 1.15 && C.rules.staminaMax - b.stamina < 1.25);
  run(g, 20, () => cmd(held));g.step(cmd({...held, guard: true, guardPressed: true}), cmd());
  assert.ok(!b.charge && !b.flight);assert.ok(b.moveCooldowns.bounce >= 6 - .06);
});
test('altura e PL pela carga: PL1 1,5 m, PL2 2,5 m, PL3 3,5 m (picos do arco real)', () => {
  const peak = ticks => {const g = jump({ticks});const pl = g.fighters[0].bounceState?.pl;const r = fly(g);return {pl, y: r.maxY};};
  const a = peak(10), b = peak(90), c = peak(150);
  assert.equal(a.pl, 1);assert.equal(b.pl, 2);assert.equal(c.pl, 3);
  assert.ok(Math.abs(a.y - 1.5) < .08, `PL1 ${a.y}`);assert.ok(Math.abs(b.y - 2.5) < .08, `PL2 ${b.y}`);assert.ok(Math.abs(c.y - 3.5) < .08, `PL3 ${c.y}`);
});
test('marcos de PL: <50% (0,59 s) = PL1; de 50% a <100% = PL2; 100% = PL3', () => {
  const pl = ticks => jump({ticks}).fighters[0].bounceState?.pl;
  assert.equal(pl(70), 1);assert.equal(pl(73), 2);assert.equal(pl(143), 2);assert.equal(pl(146), 3);
});
test('sem alvo travado: avança ~6 m à frente em arco e pousa (sem teletransporte: nenhum passo salta mais que ~1 m)', () => {
  const g = jump({dist: 20});const b = g.fighters[0], z0 = b.position.z;let worst = 0, prev = b.position.z;
  for (let i = 0; i < 300; i++) {g.step(cmd(), cmd());worst = Math.max(worst, Math.abs(b.position.z - prev));prev = b.position.z;}
  assert.ok(Math.abs(b.position.z - z0 - 6) < .5, `distância ${(b.position.z - z0).toFixed(2)}`);
  assert.ok(worst < .5, `maior salto de posição por passo ${worst}`);
});
test('com alvo travado perto: avança só até ele (distância limitada pelo alvo)', () => {
  const g = jump({dist: 3, lock: true});const b = g.fighters[0], z0 = b.position.z;
  fly(g);
  assert.ok(b.position.z - z0 < 3.2 && b.position.z - z0 > 1.2, `${(b.position.z - z0).toFixed(2)}`);
});
test('golpe na descida: 12 HP nominais (× Ataque ÷ referência), 3 m/s H e 6 m/s V (lança o alvo)', () => {
  const dmg = atk => {const g = jump({dist: 5, lock: true, atk});const r = g.fighters[1], h = r.hp;const out = fly(g);return {loss: h - r.hp, ev: hits(out.ev)};};
  const a = dmg(20), b = dmg(40);
  assert.ok(Math.abs(a.loss - 12) < 1e-6, `${a.loss}`);assert.ok(Math.abs(b.loss - 24) < 1e-6);
  assert.equal(a.ev.length, 1, 'uma única vez');
  assert.ok(Math.abs(a.ev[0].launch.horizontal - 3) < 1e-6 && Math.abs(a.ev[0].launch.vertical - 6) < 1e-6, JSON.stringify(a.ev[0].launch));
});
test('impacto do pouso: quem está no chão dentro do raio de pouso também é atingido', () => {
  const g = jump({dist: 14});   // sem lock: pousa a ~6 m; alvo colocado onde vai pousar
  g.fighters[1].position = vec(0, g.fighters[0].position.z + 6.3);
  const out = fly(g);
  assert.ok(hits(out.ev).length >= 1, 'o alvo foi atingido');
});
test('errando: pouso sem acerto gera só o evento de pouso (connected = false)', () => {
  const g = jump({dist: 30});const out = fly(g);
  const land = out.ev.find(e => e.result === 'bounceLand');
  assert.ok(land && land.connected === false, JSON.stringify(land));
  assert.equal(hits(out.ev).length, 0);
});
test('recuperação de 0,25 s depois do pouso (não age) e sem invulnerabilidade durante o salto', () => {
  const g = jump({dist: 30});const b = g.fighters[0];let inv = false, rec = 0;
  for (let i = 0; i < 400; i++) {g.step(cmd(), cmd());if (b.flight && isInvulnerable(b)) inv = true;if (!b.flight && b.knockRecovery > 0) rec = Math.max(rec, b.knockRecovery);}
  assert.ok(!inv, 'nunca invulnerável');assert.ok(Math.abs(rec - .25) < .02, `recuperação ${rec}`);
});
test('alvo com esquiva (i-frames) não é atingido; defesa perfeita anula o dano', () => {
  const dodge = (() => {const g = jump({dist: 5, lock: true});const r = g.fighters[1], h = r.hp;const out = fly(g, 400, i => cmd(i < 2 ? {dodge: true, move: vec(1, 0)} : {}));return {loss: h - r.hp, n: hits(out.ev).length};})();
  assert.ok(dodge.loss === 0 || dodge.n === 0, JSON.stringify(dodge));
  const perf = (() => {const g = jump({dist: 5, lock: true});const r = g.fighters[1], h = r.hp;let l = 0;for (let i = 0; i < 400; i++) {r.perfectLeft = 1;r.perfectSucceeded = false;g.step(cmd(), cmd({guard: true}));}l = h - r.hp;return l;})();
  assert.equal(perf, 0);
});
test('PL maior derruba o Tackle do alvo; PL igual anula os dois (Clash)', () => {
  const setup = ticks => {
    const g = jump({dist: 5, lock: true, ticks});const r = g.fighters[1];
    r.action = {kind: 'tackle', elapsed: 0, heading: Math.PI, startAngle: Math.PI, offensive: true, hits: new Set(), pl: 1, from: null, speedMultiplier: 1, combatWindows: null, hitWindows: [], invulnerableFor: 0, durationScale: 6, distanceScale: 0};
    return g;
  };
  const eq = setup(10);const outEq = fly(eq);
  assert.ok(outEq.ev.some(e => e.result === 'clash'), `eventos ${[...new Set(outEq.ev.map(e => e.result))]}`);
  const hi = setup(90);const r2 = hi.fighters[1], h = r2.hp;const outHi = fly(hi);
  assert.ok(h - r2.hp > 0 && hits(outHi.ev).length >= 1, 'PL2 contra Tackle PL1 conecta');
});
test('só no chão (MV-P04): sem apoio na soltura o efeito falha e devolve o custo', () => {
  const g = arena({equip: ['bounce']});const b = g.fighters[0];
  g.step(cmd(hold), cmd());run(g, 20, () => cmd(held));
  b.flight = {y: 2, vy: 0, horizontal: vec(0, 0)};
  g.step(cmd(), cmd());
  assert.ok(!b.bounceState, 'nenhum salto novo');
});
test('golpe sofrido no ar encerra o estado do Bounce (sem acertos fantasma depois)', () => {
  const g = jump({dist: 20});const b = g.fighters[0];run(g, 10);
  assert.ok(b.bounceState);
  b.flight = {y: b.flight.y, vy: 3, horizontal: vec(0, 0)};   // lançamento por golpe substitui o voo
  run(g, 300);
  assert.ok(!b.bounceState);
});
test('M28.4: sliders mexidos depois da soltura não alteram o salto em andamento; o próximo uso lê o novo', () => {
  const g = jump({dist: 30});const b = g.fighters[0], z0 = b.position.z;
  C.world.bounce.maxDistance = 1;C.world.bounce.heightPl1 = 9;C.world.bounce.damage = 99;
  const out = fly(g);
  assert.ok(Math.abs(b.position.z - z0 - 6) < .5 && Math.abs(out.maxY - 1.5) < .1, `dist ${(b.position.z - z0).toFixed(2)} alt ${out.maxY.toFixed(2)}`);
});
test('sliders têm efeito: maxDistance, heightPl1, damage e knockbackV', () => {
  const a = jump({dist: 30, tweak: () => {C.world.bounce.maxDistance = 3;C.world.bounce.heightPl1 = 2;}});const z0 = a.fighters[0].position.z;const ra = fly(a);
  assert.ok(Math.abs(a.fighters[0].position.z - z0 - 3) < .4 && Math.abs(ra.maxY - 2) < .1);
  const b = jump({dist: 5, lock: true, tweak: () => {C.world.bounce.damage = 20;C.world.bounce.knockbackV = 0;}});const r = b.fighters[1], h = r.hp;const rb = fly(b);
  assert.ok(Math.abs(h - r.hp - 20) < 1e-6);assert.equal(hits(rb.ev)[0].launch.vertical, 0);
});
test('paridade e determinismo: registrado e não equipado não muda nada; save/load no ar reproduz o futuro', () => {
  const sim = () => {const g = arena();g.mode = 'tactical';C.extras.toggles.enableEnemyAI = 1;for (let i = 0; i < 1200; i++) g.step(cmd(), undefined);return fighterHash(g);};
  assert.equal(sim(), sim());
  const go = split => {
    const g = jump({dist: 5, lock: true});run(g, 30);
    if (split) {const snap = g.save();const h = new Game({seed: 3});h.start();h.load(snap);run(h, 300);return fighterHash(h);}
    run(g, 300);return fighterHash(g);
  };
  assert.equal(go(true), go(false));
});

done();
void secs;
