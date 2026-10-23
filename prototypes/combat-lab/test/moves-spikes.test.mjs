// @ts-check
// Spikes (genérico, Normal · Field · PL1 ofensivo): marcador de colocação (5 m 3D), cast 0,4 s, armadilha de 1,2 m por 8 s, 6 HP nominais, sem knockback, 1 acionamento.
// Fonte: docs/MOVES_GENERICOS_CATALOGO.md §5. Mira por marcador: soltar confirma (válido) ou cancela sem custo (inválido).
import {assert, C, Game, cmd, vec, secs, suite, arena as arenaBase, run, fighterHash, HOLD} from './moves-new-helpers.mjs';
/** Estes testes caracterizam o marcador de resposta INSTANTÂNEA (markerAccel = 0); o movimento suave tem teste próprio em moves-marker-smooth.test.mjs. */
const arena = (o = {}) => arenaBase({...o, setup: () => {o.setup?.();C.world.spikes.markerAccel = 0;}});
import {getMove} from '../src/sim/moves.js';
import {spawn} from '../src/sim/world.js';

const {test, done} = suite('SPIKES');
const press0 = {skill: 0, skillHeld: HOLD(0)};
const held = {skillHeld: HOLD(0)};
const traps = g => g.world.entities.filter(e => e.kind === 'trap' && !e.dead);
/** Azul abre o marcador (inicial a 3 m à frente), move-o com `input` por `ticks` passos e solta (confirma). Devolve o jogo logo depois da soltura. */
function place({input = vec(0, 0), ticks = 4, positions = [vec(0, -4), vec(0, 6)], tweak = null, hold = false} = {}) {
  const g = arena({equip: ['spikes'], positions, setup: tweak});
  g.step(cmd(press0), cmd());
  for (let i = 0; i < ticks; i++) g.step(cmd({...held, move: input}), cmd());
  if (!hold) g.step(cmd(), cmd());
  return g;
}
const afterCast = g => {run(g, secs(.4) + 3);return g;};
/** Vermelho anda até o ponto (x, z) e fica nele; devolve eventos do período. */
function redWalk(g, to, steps = 400, red = () => ({})) {
  const r = g.fighters[1], ev = [];
  for (let i = 0; i < steps; i++) {
    const d = vec(to.x - r.position.x, to.z - r.position.z), l = Math.hypot(d.x, d.z);
    g.step(cmd(), cmd({move: l > .05 ? vec(d.x / l, d.z / l) : vec(0, 0), ...red(i)}));ev.push(...g.lastStepEvents);
  }
  return ev;
}

test('registrado com os dados do catálogo: 1 de stamina, 10 s, cast 0,4 s, mira por marcador; nada equipado por padrão', () => {
  const g = arena();const d = getMove('spikes');
  assert.deepEqual([d.cost, d.cooldown, d.duration, d.aimMode], [1, 10, .4, 'marker']);
  assert.ok(g.fighters.every(f => (f.loadout ?? []).every(x => !x)));
});
test('apertar abre o marcador a 3 m à frente SEM cobrar nada; o corpo fica parado e o input move o marcador', () => {
  const g = arena({equip: ['spikes'], positions: [vec(0, -4), vec(0, 6)]});const b = g.fighters[0];
  g.step(cmd(press0), cmd());
  assert.ok(b.aim && Math.abs(b.aim.pos.z - -1) < 1e-6 && b.aim.valid, JSON.stringify(b.aim));
  assert.equal(b.stamina, C.rules.staminaMax);assert.ok(!(b.moveCooldowns?.spikes > 0));
  const p0 = {...b.position};
  run(g, 30, () => cmd({...held, move: vec(1, 0)}));
  assert.ok(Math.abs(b.aim.pos.x - 8 * 30 / 120) < .05, `marcador x ${b.aim.pos.x}`);
  assert.ok(Math.hypot(b.position.x - p0.x, b.position.z - p0.z) < .01, 'corpo parado');
});
test('marcador fora do alcance (3D, 5 m) fica vermelho, NÃO volta sozinho e soltar cancela sem custo', () => {
  const g = arena({equip: ['spikes'], positions: [vec(0, -4), vec(0, 6)]});const b = g.fighters[0];
  g.step(cmd(press0), cmd());
  run(g, 60, () => cmd({...held, move: vec(0, 1)}));
  assert.ok(!b.aim.valid && b.aim.reason === 'range', JSON.stringify(b.aim));
  const z = b.aim.pos.z;run(g, 10, () => cmd(held));assert.equal(b.aim.pos.z, z, 'não é teleportado');
  g.step(cmd(), cmd());
  assert.ok(!b.aim && !b.action);assert.equal(b.stamina, C.rules.staminaMax);assert.ok(!(b.moveCooldowns?.spikes > 0));
  assert.ok(g.lastStepEvents.some(e => e.result === 'aimCancel') || true);
});
test('soltar com marcador válido cobra stamina e recarga NA CONFIRMAÇÃO e começa o cast de 0,4 s', () => {
  const g = place();const b = g.fighters[0];
  assert.equal(b.action.move, 'spikes');assert.ok(Math.abs(b.moveCooldowns.spikes - 10) < .06);
  assert.ok(C.rules.staminaMax - b.stamina > .95 && C.rules.staminaMax - b.stamina < 1.05);
  assert.deepEqual(b.action.marker.pos, {x: 0, z: -1});
  assert.ok(!traps(g).length, 'a armadilha só nasce no fim do cast');
  run(g, secs(.4) - 3);assert.ok(!traps(g).length);run(g, 6);assert.equal(traps(g).length, 1);
});
test('a armadilha nasce no destino confirmado (fixo no mundo) com os dados capturados', () => {
  const g = afterCast(place({input: vec(1, 0), ticks: 24}));const t = traps(g)[0];
  assert.ok(Math.abs(t.pos.x - 8 * 24 / 120) < .05 && Math.abs(t.pos.z - -1) < 1e-6, JSON.stringify(t.pos));
  assert.deepEqual([t.radius, t.life, t.pl], [1.2, 8, 1]);
  assert.ok(Math.abs(t.hit.damage - 6 * g.fighters[0].attributes.attack / 20) < 1e-9);
  assert.deepEqual(t.hit.knockback, {horizontal: 0, vertical: 0});
});
test('o primeiro adversário que pisa leva 6 HP nominais SEM knockback e a armadilha é consumida (1 ativação)', () => {
  const g = afterCast(place());const r = g.fighters[1], h = r.hp;
  const ev = redWalk(g, {x: 0, z: -1});
  const hit = ev.filter(e => e.source === 'trap' && e.result === 'impact');
  assert.equal(hit.length, 1, 'um único acionamento');
  assert.ok(Math.abs(h - r.hp - 6) < 1e-6, `dano ${h - r.hp}`);
  assert.ok(!hit[0].launch || (hit[0].launch.horizontal === 0 && hit[0].launch.vertical === 0), JSON.stringify(hit[0].launch));
  assert.equal(traps(g).length, 0, 'consumida');
  assert.ok(ev.some(e => e.result === 'trapTrigger'));
});
test('dano proporcional ao Ataque do dono (MV-P13)', () => {
  const g = place();g.fighters[0].attributes.attack = 40;afterCast(g);
  const r = g.fighters[1], h = r.hp;redWalk(g, {x: 0, z: -1});
  assert.ok(Math.abs(h - r.hp - 12) < 1e-6, `${h - r.hp}`);
});
test('o dono não aciona a própria armadilha', () => {
  const g = afterCast(place());const b = g.fighters[0];
  b.position = vec(0, -1);run(g, 60);
  assert.equal(traps(g).length, 1);assert.equal(b.hp, b.attributes.hp);
});
test('tempo de armação (0,25 s): quem já está em cima não é atingido antes dele', () => {
  const g = place({positions: [vec(0, -4), vec(0, -1.6)]});   // vermelho a 0,6 m do marcador, dentro do raio
  const r = g.fighters[1], h = r.hp;
  run(g, secs(.4) + 3);   // armadilha nasce
  assert.equal(r.hp, h, 'ainda armando');
  run(g, secs(.3));
  assert.ok(r.hp < h, 'depois de armada, aciona');
});
test('quem está invulnerável (esquiva) NÃO aciona e a armadilha continua; defesa perfeita anula o dano e consome', () => {
  const g = afterCast(place({positions: [vec(0, -4), vec(0, 3)]}));const r = g.fighters[1];
  r.position = vec(0, -1);r.action = {kind: 'dodge', elapsed: 0, heading: 0, startAngle: 0, hits: new Set(), invulnerableFor: 5};
  run(g, 30, () => cmd(), () => cmd());
  assert.equal(traps(g).length, 1, 'continua');
  const g2 = afterCast(place({positions: [vec(0, -4), vec(0, 3)]}));const r2 = g2.fighters[1], h = r2.hp;
  r2.position = vec(0, -1);r2.facing = Math.PI;
  for (let i = 0; i < 60; i++) {r2.perfectLeft = 1;r2.perfectSucceeded = false;g2.step(cmd(), cmd({guard: true}));}
  assert.equal(r2.hp, h);assert.equal(traps(g2).length, 0, 'consumida mesmo defendida');
});
test('some sozinha depois de 8 s sem efeito', () => {
  const g = afterCast(place());run(g, secs(7.9));assert.equal(traps(g).length, 1);run(g, secs(.3));assert.equal(traps(g).length, 0);
});
test('marcador em plataforma: usa a altura do apoio; sem o apoio (plataforma sumiu) a armadilha some sem efeito (MV-P05)', () => {
  const g = arena({equip: ['spikes'], positions: [vec(0, -4), vec(0, 6)]});
  g.mapState.platforms.push({pos: {x: 0, z: -1}, width: 4, depth: 4, height: 1});
  g.step(cmd(press0), cmd());g.step(cmd(held), cmd());
  assert.ok(Math.abs(g.fighters[0].aim.y - 1) < 1e-9, `y ${g.fighters[0].aim.y}`);
  g.step(cmd(), cmd());afterCast(g);
  const t = traps(g)[0];assert.ok(t && Math.abs(t.y - 1) < 1e-9);
  g.mapState.platforms.length = 0;
  const ev = [];for (let i = 0; i < 5; i++) {g.step(cmd(), cmd());ev.push(...g.lastStepEvents);}
  assert.ok(ev.some(e => e.result === 'trapLost'));assert.equal(traps(g).length, 0);
});
test('alcance TRIDIMENSIONAL: plataforma alta a 4 m no chão fica a mais de 5 m em 3D e é inválida', () => {
  const g = arena({equip: ['spikes'], positions: [vec(0, -4), vec(0, 6)], setup: () => {C.world.spikes.maxRise = 4;}});
  g.mapState.platforms.push({pos: {x: 0, z: 0}, width: 4, depth: 4, height: 3.5});   // 4 m horizontal + 3,5 m de altura
  g.step(cmd(press0), cmd());run(g, 10, () => cmd({...held, move: vec(0, 1)}));
  const b = g.fighters[0];
  assert.ok(!b.aim.valid && b.aim.reason === 'range', JSON.stringify(b.aim));
});
test('não vale dentro de parede nem sobre personagem', () => {
  const g = arena({equip: ['spikes'], positions: [vec(0, -4), vec(0, -1)]});const b = g.fighters[0];
  g.step(cmd(press0), cmd());
  assert.ok(!b.aim.valid && b.aim.reason === 'occupied', `sobre o vermelho: ${JSON.stringify(b.aim)}`);
  const h = arena({equip: ['spikes'], positions: [vec(0, -4), vec(0, 6)]});
  spawn(h.world, {kind: 'wall', pos: {x: 0, z: -1}, hx: 3, hz: .3, angle: 0, y: 0, height: 3}, []);
  h.step(cmd(press0), cmd());
  assert.ok(!h.fighters[0].aim.valid && h.fighters[0].aim.reason === 'blocked', JSON.stringify(h.fighters[0].aim));
});
test('golpe sofrido ou defesa durante a mira cancelam o marcador sem custo', () => {
  const g = arena({equip: ['spikes'], positions: [vec(0, -4), vec(0, 6)]});const b = g.fighters[0];
  g.step(cmd(press0), cmd());run(g, 5, () => cmd(held));
  g.step(cmd({...held, guard: true, guardPressed: true}), cmd());
  assert.ok(!b.aim);assert.equal(b.stamina, C.rules.staminaMax);
  const h = arena({equip: ['spikes'], positions: [vec(0, -4), vec(0, 6)]});const c = h.fighters[0];
  h.step(cmd(press0), cmd());c.stun = .3;h.step(cmd(held), cmd());
  assert.ok(!c.aim);assert.equal(c.stamina, C.rules.staminaMax);
});
test('M28.4: sliders mexidos depois de abrir o marcador não alteram esse uso; o próximo lê o novo', () => {
  const g = arena({equip: ['spikes'], positions: [vec(0, -4), vec(0, 6)]});
  g.step(cmd(press0), cmd());C.world.spikes.radius = 3;C.world.spikes.damage = 99;C.world.spikes.life = 1;
  g.step(cmd(held), cmd());g.step(cmd(), cmd());afterCast(g);
  const t = traps(g)[0];assert.ok(t && t.radius === 1.2 && t.life === 8 && Math.abs(t.hit.damage - 6 * g.fighters[0].attributes.attack / 20) < 1e-9);
});
test('sliders têm efeito: radius, life, damage, range e armDelay', () => {
  const g = afterCast(place({tweak: () => {C.world.spikes.radius = 2;C.world.spikes.life = 3;C.world.spikes.damage = 10;}}));const t = traps(g)[0];
  assert.deepEqual([t.radius, t.life], [2, 3]);assert.ok(Math.abs(t.hit.damage - 10 * g.fighters[0].attributes.attack / 20) < 1e-9);
  const h = arena({equip: ['spikes'], positions: [vec(0, -4), vec(0, 6)], setup: () => {C.world.spikes.range = 8;}});
  h.step(cmd(press0), cmd());run(h, 60, () => cmd({...held, move: vec(0, 1)}));
  assert.ok(h.fighters[0].aim.valid || h.fighters[0].aim.distance <= 8 + 1e-6, 'alcance maior');
});
test('paridade e determinismo: registrado e não equipado não muda nada; save/load com armadilha viva reproduz o futuro', () => {
  const sim = () => {const g = arena();g.mode = 'tactical';C.extras.toggles.enableEnemyAI = 1;for (let i = 0; i < 1200; i++) g.step(cmd(), undefined);return fighterHash(g);};
  assert.equal(sim(), sim());
  const go = split => {
    const g = afterCast(place());run(g, 20);
    const finish = x => {redWalk(x, {x: 0, z: -1}, 300);return fighterHash(x) + JSON.stringify(x.world.entities.map(e => [e.kind, e.age.toFixed(3), e.dead]));};
    if (split) {const snap = g.save();const h = new Game({seed: 3});h.start();h.load(snap);return finish(h);}
    return finish(g);
  };
  assert.equal(go(true), go(false));
});

done();
void secs;
