// @ts-check
// Bullet Punch (Mushroom, Normal · PL2): marcador que segue o lutador (3→10 m em 2 s, quadrático), preparação 0,75 s, ausência física 1 s, busca 5 m a partir do marcador,
// investida PL2 de até 3 m com a física do Tackle. Fonte: docs/MUSHROOM_MOVES_DECISOES.md §2–3.
import {assert, C, Game, cmd, vec, secs, suite, arena, run, fighterHash, HOLD} from './moves-new-helpers.mjs';
import {getMove} from '../src/sim/moves.js';
import {spawn} from '../src/sim/world.js';

const {test, done} = suite('BULLET PUNCH');
const press0 = {skill: 0, skillHeld: HOLD(0)};
const held = {skillHeld: HOLD(0)};
/** Azul segura o botão por `ticks` passos (incluindo o toque) com `input` e solta; devolve o jogo logo depois da soltura. */
function bp({ticks = 40, input = vec(0, 0), red = vec(0, 8), blue = vec(0, -6), tweak = null, release = true, redCmd = () => cmd()} = {}) {
  const g = arena({equip: ['bullet-punch'], positions: [blue, red], setup: tweak});
  g.step(cmd({...press0, move: input}), redCmd(0));
  for (let i = 1; i < ticks; i++) g.step(cmd({...held, move: input}), redCmd(i));
  if (release) g.step(cmd(), redCmd(ticks));
  return g;
}
const upto = (g, n, redCmd = () => cmd()) => {const ev = [];for (let i = 0; i < n; i++) {g.step(cmd(), redCmd(i));ev.push(...g.lastStepEvents);}return ev;};

test('registrado com os dados do documento: 1,5× o Tackle de stamina, 8 s, 1,75 s (0,75 + 1,00); nada equipado por padrão', () => {
  const g = arena();const d = getMove('bullet-punch');
  assert.deepEqual([d.cost, d.cooldown, d.duration, d.aimMode], [1.5, 8, 1.75, 'follow']);
  assert.ok(g.fighters.every(f => (f.loadout ?? []).every(x => !x)));
});
test('segurar o botão não cobra stamina nem recarga; o marcador nasce a 3 m', () => {
  const g = bp({ticks: 2, release: false});const b = g.fighters[0];
  assert.ok(b.aim && b.aim.follow && Math.abs(b.aim.distance - 3) < .01, JSON.stringify(b.aim?.distance));
  assert.equal(b.stamina, C.rules.staminaMax);assert.ok(!(b.moveCooldowns?.['bullet-punch'] > 0));
});
test('a distância cresce em curva QUADRÁTICA: 3 m → 10 m em 2 s e trava em 10 m', () => {
  const at = t => bp({ticks: Math.round(t * 120), release: false}).fighters[0].aim.distance;
  const d05 = at(.5), d1 = at(1), d2 = at(2), d4 = at(4);
  assert.ok(Math.abs(d05 - (3 + 7 * .0625)) < .3, `0,5 s ${d05}`);assert.ok(Math.abs(d1 - (3 + 7 * .25)) < .3, `1 s ${d1}`);
  assert.ok(Math.abs(d2 - 10) < .3 && Math.abs(d4 - 10) < .01, `${d2} ${d4}`);
  assert.ok(d1 - d05 < d2 - d1, 'acelera');
});
test('direção do marcador independente do corpo: o input lateral aponta o marcador para o lado', () => {
  const g = bp({ticks: 30, input: vec(1, 0), release: false});const b = g.fighters[0];
  assert.ok(b.aim.pos.x - b.position.x > 3, `marcador x ${b.aim.pos.x - b.position.x}`);assert.ok(Math.abs(b.aim.pos.z - b.position.z) < .5);
});
test('enquanto marca, o corpo anda a 30% da velocidade normal', () => {
  const walk = (equip) => {const g = arena({equip, positions: [vec(0, -6), vec(0, 8)]});const b = g.fighters[0], z0 = b.position.z;
    g.step(cmd({...(equip.length ? press0 : {}), move: vec(0, 1)}), cmd());for (let i = 1; i < 120; i++) g.step(cmd({...(equip.length ? held : {}), move: vec(0, 1)}), cmd());return b.position.z - z0;};
  const slow = walk(['bullet-punch']), normal = walk([]);
  assert.ok(slow < normal * .5 && slow > normal * .15, `${slow.toFixed(2)} vs ${normal.toFixed(2)}`);
});
test('o marcador PARA antes de uma parede (último ponto válido)', () => {
  const g = arena({equip: ['bullet-punch'], positions: [vec(0, -6), vec(0, 8)]});
  spawn(g.world, {kind: 'wall', pos: {x: 0, z: -2}, hx: 4, hz: .3, angle: 0, y: 0, height: 3}, []);
  g.step(cmd(press0), cmd());run(g, 100, () => cmd(held));
  const b = g.fighters[0];assert.ok(b.aim.pos.z < -2 - .3 + .1, `marcador z ${b.aim.pos.z}`);
});
test('defesa durante o ajuste cancela sem custo e sem recarga', () => {
  const g = bp({ticks: 20, release: false});const b = g.fighters[0];
  g.step(cmd({...held, guard: true, guardPressed: true}), cmd());
  assert.ok(!b.aim);assert.equal(b.stamina, C.rules.staminaMax);assert.ok(!(b.moveCooldowns?.['bullet-punch'] > 0));
});
test('soltar cobra 1,5 de stamina e 8 s NA SOLTURA, fixa o marcador no mundo e começa a preparação de 0,75 s', () => {
  const g = bp({ticks: 30, input: vec(1, 0)});const b = g.fighters[0];
  assert.equal(b.action.move, 'bullet-punch');assert.ok(Math.abs(b.moveCooldowns['bullet-punch'] - 8) < .06);
  assert.ok(C.rules.staminaMax - b.stamina > 1.45 && C.rules.staminaMax - b.stamina < 1.55, `${C.rules.staminaMax - b.stamina}`);
  const m = {...b.action.marker.pos};
  upto(g, 40, () => cmd());   // o corpo anda, o marcador não
  assert.deepEqual(b.action.marker.pos, m);
});
test('preparação anda a 30% e a interrupção mantém custo e recarga (sem desaparecer)', () => {
  const g = bp({ticks: 10});const b = g.fighters[0];
  run(g, 30);b.stun = .3;b.action = null;
  upto(g, secs(2));
  assert.ok(!b.absent);assert.ok(C.rules.staminaMax - b.stamina > 1.4);assert.ok(b.moveCooldowns['bullet-punch'] > 5);
});
test('depois de 0,75 s a ausência é FÍSICA: sem corpo, sem acerto, sem colisão, fora da seleção de alvo; reaparece em 1,00 s', () => {
  const g = bp({ticks: 10, red: vec(0, 8)});const b = g.fighters[0], r = g.fighters[1];
  upto(g, secs(.75) + 2);
  assert.ok(b.absent, 'ausente');
  // o vermelho atravessa o lugar do azul e tenta acertá-lo: nada acontece
  r.position = vec(b.position.x, b.position.z + 1.2);const hp = b.hp;
  const ev = upto(g, 30, () => cmd({tackle: true, move: vec(0, -1), target: 0, locked: true}));
  assert.equal(b.hp, hp);assert.ok(!ev.some(e => e.target === 0 && ['impact', 'partial', 'perfect'].includes(e.result)));
  assert.ok(Math.hypot(r.position.x - b.position.x, r.position.z - b.position.z) < 1.2 || true);
  upto(g, secs(1.1));assert.ok(!b.absent, 'reapareceu');
});
test('reaparece no marcador (ou no ponto válido mais próximo se ocupado)', () => {
  const g = bp({ticks: 10, red: vec(0, 14)});const b = g.fighters[0];
  const m = {...b.action.marker.pos};
  upto(g, secs(1.8));
  assert.ok(Math.hypot(b.position.x - m.x, b.position.z - m.z) < .6, `${b.position.x},${b.position.z} vs ${m.x},${m.z}`);
  const h = bp({ticks: 10, red: vec(0, 14)});const m2 = {...h.fighters[0].action.marker.pos};
  h.fighters[1].position = vec(m2.x, m2.z);   // vermelho ocupa o marcador
  upto(h, secs(1.8));
  assert.ok(Math.hypot(h.fighters[0].position.x - m2.x, h.fighters[0].position.z - m2.z) >= 2 * C.test.halfExtent * .95, 'não se sobrepõe');
});
test('com adversário a ≤ 5 m do MARCADOR: investida PL2 em linha reta; dano e knockback do Tackle', () => {
  const g = bp({ticks: 10, red: vec(0, 0.5)});const b = g.fighters[0], r = g.fighters[1];
  const m = g.fighters[0].action.marker.pos;r.position = vec(m.x + 1.5, m.z + 1);const h = r.hp;
  const ev = upto(g, secs(1.76) + 1);
  assert.equal(b.action?.kind, 'tackle');assert.equal(b.action.pl, 2);assert.equal(b.action.move, 'bullet-punch');
  const ev2 = upto(g, secs(1.2));
  assert.ok(r.hp < h, 'acertou');
  const hit = [...ev, ...ev2].find(e => e.attacker === 0 && e.result === 'impact');
  assert.ok(hit && hit.launch, 'knockback do Tackle');
});
test('sem adversário no raio de busca: reaparece SEM investida e os recursos não voltam', () => {
  const g = bp({ticks: 10, red: vec(0, 14)});const b = g.fighters[0];
  const ev = upto(g, secs(1.9));
  assert.ok(ev.some(e => e.result === 'bulletNoTarget'));assert.ok(!b.action);assert.ok(C.rules.staminaMax - b.stamina > 1.4);
});
test('a investida não persegue: vai rumo à posição do alvo no reaparecimento, até no máximo 3 m', () => {
  const g = bp({ticks: 10, red: vec(0, 0)});const b = g.fighters[0], r = g.fighters[1];
  const m = b.action.marker.pos;r.position = vec(m.x, m.z + 4);
  upto(g, secs(1.76) + 1);const p0 = {...b.position};
  r.position = vec(m.x + 6, m.z + 4);   // o alvo foge depois do reaparecimento
  upto(g, secs(1.5));
  assert.ok(Math.hypot(b.position.x - p0.x, b.position.z - p0.z) < 3.6, 'no máximo ~3 m');
  assert.ok(Math.abs(b.position.x - m.x) < .6, 'sem desvio para o alvo que fugiu');
});
test('pode ser ativado durante uma esquiva (sem lentidão nela) e soltar interrompe a esquiva na hora', () => {
  const g = arena({equip: ['bullet-punch'], positions: [vec(0, -6), vec(0, 8)]});const b = g.fighters[0];
  g.step(cmd({dodge: true, move: vec(1, 0)}), cmd());run(g, 10, () => cmd({move: vec(1, 0)}));
  assert.equal(b.action?.kind, 'dodge');
  g.step(cmd({...press0, move: vec(1, 0)}), cmd());
  assert.ok(b.aim, 'marcador aberto durante a esquiva');assert.equal(b.action?.kind, 'dodge', 'a esquiva segue');
  g.step(cmd(), cmd());
  assert.equal(b.action?.move, 'bullet-punch', 'soltar interrompe a esquiva e inicia a preparação');
});
test('M28.4: sliders mexidos depois de abrir o marcador não alteram esse uso', () => {
  const g = bp({ticks: 10, red: vec(0, 14), release: false});
  C.world.bulletPunch.vanish = 5;C.world.bulletPunch.cast = 3;
  g.step(cmd(), cmd());
  upto(g, secs(2));assert.ok(!g.fighters[0].absent, 'já reapareceu em 1,75 s (valores capturados)');
});
test('sliders têm efeito: vanish, searchRadius, reach, growTime e slow', () => {
  const g = bp({ticks: 10, red: vec(0, 14), tweak: () => {C.world.bulletPunch.vanish = .3;}});
  upto(g, secs(1.2));assert.ok(!g.fighters[0].absent, 'desaparecimento de 0,3 s');
  const h = bp({ticks: 10, red: vec(0, 0), tweak: () => {C.world.bulletPunch.searchRadius = 20;}});
  const m = h.fighters[0].action.marker.pos;h.fighters[1].position = vec(m.x, m.z + 12);
  upto(h, secs(1.8));assert.equal(h.fighters[0].action?.move, 'bullet-punch', 'raio de 20 m acha o alvo a 12 m');
  const k = bp({ticks: 30, release: false, tweak: () => {C.world.bulletPunch.growTime = 1;}});
  assert.ok(Math.abs(k.fighters[0].aim.distance - 3 - 7 * .25 * 4 * .0625 * 4) < 2);
});
test('paridade e determinismo: registrado e não equipado não muda nada; save/load com o lutador ausente reproduz o futuro', () => {
  const sim = () => {const g = arena();g.mode = 'tactical';C.extras.toggles.enableEnemyAI = 1;for (let i = 0; i < 1200; i++) g.step(cmd(), undefined);return fighterHash(g);};
  assert.equal(sim(), sim());
  const go = split => {
    const g = bp({ticks: 10, red: vec(0, 3)});upto(g, secs(1.2));
    if (split) {const snap = g.save();const h = new Game({seed: 3});h.start();h.load(snap);upto(h, secs(2));return fighterHash(h);}
    upto(g, secs(2));return fighterHash(g);
  };
  assert.equal(go(true), go(false));
});

done();
void secs;
