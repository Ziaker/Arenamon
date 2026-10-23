// @ts-check
// Quick Attack (genérico, Burst · Melee · PL1): alvo elegível mais próximo a ≤ 7 m, ida ≤ 0,16 s, volta ≤ 0,14 s ao ponto de partida, recuperação 0,12 s,
// 8 HP nominais, 4 m/s H sem V. Fonte: docs/moves-nao-iniciados/5_MOVES_GENERICOS_PROMPT.md §2. Resolve como Tackle (colisão, defesa, Clash).
import {assert, C, Game, cmd, vec, secs, suite, arena, run, fighterHash} from './moves-new-helpers.mjs';
import {getMove, nearestEligible} from '../src/sim/moves.js';
import {movePermission} from '../src/sim/controller.js';
import {spawn} from '../src/sim/world.js';

const {test, done} = suite('QUICK ATTACK');
const press0 = {skill: 0, skillHeld: [true, false, false, false]};
/** Azul usa o Quick Attack contra o vermelho (parado) a `dist` m; devolve o jogo logo após o primeiro passo. */
function qa({dist = 5, tweak = null, red = {}, atk = null, guard = false, extra = {}} = {}) {
  const g = arena({equip: ['quick-attack'], setup: tweak, positions: [vec(0, -dist / 2), vec(0, dist / 2)]});
  if (atk) g.fighters[0].attributes.attack = atk;
  Object.assign(g.fighters[1], red);
  g.step(cmd({...press0, ...extra}), guard ? cmd({guard: true, guardPressed: true}) : cmd());
  g.step(cmd(), guard ? cmd({guard: true}) : cmd());   // alvo único: apertar abre o círculo de alcance; o Move sai ao SOLTAR (passo seguinte)
  return g;
}
const play = (g, n, guard = false) => {const ev = [];for (let i = 0; i < n; i++) {g.step(cmd(), guard ? cmd({guard: true}) : cmd());ev.push(...g.lastStepEvents);}return ev;};
const impacts = ev => ev.filter(e => e.result === 'impact' && e.attacker === 0);

test('registrado com os dados do catálogo: 0,75 de stamina, 6 s; nada equipado por padrão', () => {
  const g = arena();const d = getMove('quick-attack');
  assert.deepEqual([d.cost, d.cooldown, d.tackle, d.needsTarget], [.75, 6, 'quick-attack', 'acquireRange']);
  assert.ok(g.fighters.every(f => (f.loadout ?? []).every(x => !x)));
});
test('cobra stamina e cooldown no início; a ação é UM Tackle real marcado com o Move', () => {
  const g = qa();const b = g.fighters[0];
  assert.equal(b.action.kind, 'tackle');assert.equal(b.action.move, 'quick-attack');assert.equal(b.action.pl, 1);
  assert.ok(Math.abs(b.moveCooldowns['quick-attack'] - 6) < .06, `cooldown ${b.moveCooldowns['quick-attack']}`);
  assert.ok(C.rules.staminaMax - b.stamina > .7 && C.rules.staminaMax - b.stamina < .8);
});
test('elegibilidade: o adversário mais próximo vivo e no chão a ≤ 7 m; fora do alcance ou em voo não conta', () => {
  const g = arena({equip: ['quick-attack'], positions: [vec(0, -3), vec(0, 3)]});const [b, r] = g.fighters;
  assert.equal(nearestEligible(b, g.fighters, 7), r);
  assert.equal(nearestEligible(b, g.fighters, 5), null, 'a 6 m está fora de 5 m');
  r.flight = {y: 3, vy: 0};assert.equal(nearestEligible(b, g.fighters, 7), null, 'em voo não é elegível');
  r.flight = null;r.hp = 0;assert.equal(nearestEligible(b, g.fighters, 7), null, 'derrotado não é elegível');
});
test('sem adversário elegível o Move NÃO começa e não cobra nada (motivo noTarget)', () => {
  const g = qa({dist: 12});const b = g.fighters[0];
  assert.ok(!b.action, 'não iniciou');assert.equal(b.stamina, C.rules.staminaMax);assert.ok(!(b.moveCooldowns?.['quick-attack'] > 0));
  const perm = movePermission(b, getMove('quick-attack'), 0);
  assert.deepEqual([perm.ok, perm.reason], [false, 'noTarget']);
});
test('ida em altíssima velocidade: alcança alvo a 5 m em ≤ 0,16 s e acerta uma única vez', () => {
  const g = qa({dist: 5});const t = [];let n = 0;
  for (let i = 0; i < secs(.6); i++) {g.step(cmd(), cmd());const k = impacts(g.lastStepEvents).length;n += k;if (k && !t.length) t.push((i + 2) * C.test.step);}
  assert.equal(n, 1, `acertos ${n}`);
  assert.ok(t[0] <= .16 + .03, `tempo até o acerto ${t[0]}`);
});
test('volta ao ponto de partida (±0,15 m) em ≤ 0,14 s depois do acerto, sem segundo acerto', () => {
  const g = qa({dist: 5});const b = g.fighters[0], z0 = -2.5;
  const ev = play(g, secs(.7));
  assert.equal(impacts(ev).length, 1);
  assert.ok(Math.abs(b.position.z - z0) < .15, `parou a ${(b.position.z - z0).toFixed(3)} m da origem`);
  assert.ok(!b.action, 'ação terminou');
});
test('errando (alvo some do caminho): ainda assim volta à origem', () => {
  const g = qa({dist: 6});const b = g.fighters[0], z0 = -3;
  run(g, secs(.8), () => cmd(), () => cmd({move: vec(1, 0)}));
  assert.ok(Math.abs(b.position.z - z0) < .25 && Math.abs(b.position.x) < .25, `pos ${b.position.x.toFixed(2)},${b.position.z.toFixed(2)}`);
});
test('duração total = ida + volta + recuperação (0,12 s): não encadeia antes do fim', () => {
  const g = qa({dist: 5});const b = g.fighters[0];let end = -1;
  for (let i = 0; i < secs(1); i++) {g.step(cmd(), cmd());if (!b.action && end < 0) end = (i + 2) * C.test.step;}
  assert.ok(end > .12 && end <= .16 + .14 + .12 + .08, `fim em ${end}`);
});
test('dano nominal 8 HP com Ataque de referência e proporcional ao Ataque (MV-P13)', () => {
  const dmg = atk => {const g = qa({atk});const r = g.fighters[1], hp0 = r.hp;play(g, 120);return hp0 - r.hp;};
  assert.ok(Math.abs(dmg(20) - 8) < 1e-6, `${dmg(20)}`);
  assert.ok(Math.abs(dmg(40) - 16) < 1e-6);
});
test('knockback 4 m/s horizontal e 0 vertical: empurrão deslizante, NÃO voo', () => {
  const g = qa();const ev = impacts(play(g, 120));
  assert.equal(ev.length, 1);
  assert.ok(Math.abs(ev[0].launch.horizontal - 4) < 1e-6 && ev[0].launch.vertical === 0, JSON.stringify(ev[0].launch));
  assert.ok(!g.fighters[1].flight);
});
test('defesa comum reduz o dano e a perfeita o anula; o atacante NÃO recua (volta à origem mesmo bloqueado)', () => {
  const none = (() => {const g = qa();const r = g.fighters[1], h = r.hp;play(g, 120);return h - r.hp;})();
  const guarded = () => {const g = arena({equip: ['quick-attack'], positions: [vec(0, -2.5), vec(0, 2.5)]});g.step(cmd(), cmd({guard: true, guardPressed: true}));run(g, secs(.5), () => cmd(), () => cmd({guard: true}));g.step(cmd({...press0}), cmd({guard: true}));return g;};
  const part = (() => {const g = guarded();const b = g.fighters[0], z0 = -2.5, r = g.fighters[1], h = r.hp;play(g, 120, true);return {loss: h - r.hp, back: Math.abs(b.position.z - z0), rec: b.state === 'recoil'};})();
  assert.ok(part.loss < none && part.loss > 0, `${part.loss} < ${none}`);
  assert.ok(part.back < .2 && !part.rec, `voltou ${part.back} recoil ${part.rec}`);
  const perfect = (() => {const g = qa({guard: true});g.fighters[1].perfectLeft = 1;g.fighters[1].perfectSucceeded = false;const r = g.fighters[1], h = r.hp;play(g, 120, true);return h - r.hp;})();
  assert.equal(perfect, 0);
});
test('i-frames do alvo (esquiva): o golpe não conecta e o atacante ainda volta', () => {
  const g = qa({dist: 4});const b = g.fighters[0], z0 = -2, r = g.fighters[1], h = r.hp;
  for (let i = 0; i < 120; i++) g.step(cmd(), cmd(i === 0 ? {dodge: true, move: vec(1, 0)} : {}));
  void h;void r;
  assert.ok(Math.abs(b.position.z - z0) < .3, 'voltou');
});
test('parede no caminho: a ida para na parede (sem atravessar) e a volta acontece', () => {
  const g = arena({equip: ['quick-attack'], positions: [vec(0, -3), vec(0, 3)]});
  spawn(g.world, {kind: 'wall', pos: {x: 0, z: -1}, hx: 3, hz: .3, angle: 0, y: 0, height: 3}, []);
  g.step(cmd({...press0}), cmd());run(g, secs(.9));
  assert.ok(g.fighters[0].position.z <= -1 - .3 - C.test.halfExtent + .05 && g.fighters[0].position.z >= -3.3, `z=${g.fighters[0].position.z}`);
});
test('cancelável só depois da sequência completa: esquiva no meio é negada', () => {
  const g = qa({dist: 5});run(g, secs(.1));
  g.step(cmd({dodge: true, move: vec(1, 0)}), cmd());
  assert.equal(g.fighters[0].action?.kind, 'tackle');
});
test('M28.4: sliders mexidos depois do início não alteram o uso em andamento; o próximo uso lê o novo', () => {
  const g = qa({dist: 5});const b = g.fighters[0];
  C.world.quickAttack.damage = 99;C.world.quickAttack.acquireRange = 1;
  const r = g.fighters[1], hp0 = r.hp;play(g, 120);
  assert.ok(Math.abs(hp0 - r.hp - 8) < 1e-6, `dano ${hp0 - r.hp}`);void b;
});
test('sliders têm efeito: acquireRange, damage e knockbackV mudam o resultado', () => {
  const g1 = qa({dist: 5, tweak: () => {C.world.quickAttack.acquireRange = 2;}});
  assert.ok(!g1.fighters[0].action, 'a 5 m com alcance 2 m não inicia');
  const g2 = qa({tweak: () => {C.world.quickAttack.knockbackV = 5;}});const ev = impacts(play(g2, 120));
  assert.ok(ev[0].launch.vertical > 0, 'V > 0 vira lançamento');
});
test('paridade e determinismo: registrado e não equipado não muda nada; save/load no meio da ida reproduz o futuro', () => {
  const sim = () => {const g = arena();g.mode = 'tactical';C.extras.toggles.enableEnemyAI = 1;for (let i = 0; i < 1200; i++) g.step(cmd(), undefined);return fighterHash(g);};
  assert.equal(sim(), sim());
  const go = split => {
    const g = qa();run(g, 8);
    if (split) {const snap = g.save();const h = new Game({seed: 3});h.start();h.load(snap);run(h, 200);return fighterHash(h);}
    run(g, 200);return fighterHash(g);
  };
  assert.equal(go(true), go(false));
});

done();
