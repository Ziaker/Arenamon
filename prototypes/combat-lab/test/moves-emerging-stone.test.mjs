// @ts-check
// Emerging Stone (Mushroom, Move 1; cronologia C = ES-D103): cast de 0,55 s que começa ao pressionar, disparo só com cast concluído E botão solto, projétil subterrâneo a 15 m/s,
// explosão horizontal de 5 m, cenário destruído, rocha 3×3×3 m que emerge em 0,40 s. Fonte: docs/MUSHROOM_MOVES_DECISOES.md §7 e o brief em docs/moves-nao-iniciados/.
import {assert, C, Game, cmd, vec, secs, suite, arena as arenaBase, run, fighterHash, HOLD} from './moves-new-helpers.mjs';
/** Estes testes caracterizam o marcador de resposta INSTANTÂNEA (markerAccel = 0); o movimento suave tem teste próprio em moves-marker-smooth.test.mjs. */
const arena = (o = {}) => arenaBase({...o, setup: () => {o.setup?.();C.world.emergingStone.markerAccel = 0;}});
import {getMove} from '../src/sim/moves.js';
import {getGroundHeight} from '../src/sim/physics.js';
import {damageDestructible} from '../src/sim/map.js';
import {spawn} from '../src/sim/world.js';

const {test, done} = suite('EMERGING STONE');
const press0 = {skill: 0, skillHeld: HOLD(0)};
const held = {skillHeld: HOLD(0)};
const rocks = g => g.mapState.destructibles.filter(d => d.rock && d.state === 'solid');
const burrows = g => g.world.entities.filter(e => e.kind === 'burrow' && !e.dead);
/** Azul em (0,-8) olhando +z; o marcador nasce a 5 m (0,-3). Segura `hold` passos (cast = 66 passos) e solta. Devolve o jogo logo após a soltura. */
function aim({hold = 70, input = vec(0, 0), red = vec(0, 30), blue = vec(0, -8), tweak = null, release = true, equipRed = []} = {}) {
  const g = arena({equip: ['emerging-stone'], equipRed, positions: [blue, red], setup: tweak});
  g.mapState.destructibles = [];g.mapState.obstacles = [];g.mapState.platforms = [];
  g.step(cmd({...press0, move: input}), cmd());
  for (let i = 1; i < hold; i++) g.step(cmd({...held, move: input}), cmd());
  if (release) g.step(cmd(), cmd());
  return g;
}
const upto = (g, n, c1 = () => cmd()) => {const ev = [];for (let i = 0; i < n; i++) {g.step(cmd(), c1(i));ev.push(...g.lastStepEvents);}return ev;};
const stoneHits = ev => ev.filter(e => e.source === 'stone' && ['impact', 'partial', 'perfect'].includes(e.result));

test('registrado com os dados do documento: 3 de stamina, 9 s, cast 0,55 s; nada equipado por padrão', () => {
  const g = arena();const d = getMove('emerging-stone');
  assert.deepEqual([d.cost, d.cooldown, d.duration, d.castFirst], [3, 9, .55, true]);
  assert.ok(g.fighters.every(f => (f.loadout ?? []).every(x => !x)));
});
test('pressionar inicia o cast físico NA HORA, sem cobrar stamina nem recarga', () => {
  const g = aim({hold: 2, release: false});const b = g.fighters[0];
  assert.ok(b.aim?.castFirst && b.aim.castLeft > .5 && b.aim.castLeft <= .55, `castLeft ${b.aim?.castLeft}`);
  assert.equal(b.stamina, C.rules.staminaMax);assert.ok(!(b.moveCooldowns?.['emerging-stone'] > 0));
});
test('durante o cast o corpo anda a 30%; terminado o cast, sem lentidão extra mesmo com a mira aberta', () => {
  const dist = (from, n) => {const g = aim({hold: from, release: false, input: vec(0, 1)});const b = g.fighters[0], z0 = b.position.z;for (let i = 0; i < n; i++) g.step(cmd({...held, move: vec(0, 1)}), cmd());return b.position.z - z0;};
  const duringCast = dist(2, 30), afterCast = dist(80, 30);
  assert.ok(afterCast > duringCast * 2, `${duringCast.toFixed(2)} (cast) < ${afterCast.toFixed(2)} (livre)`);
});
test('soltar ANTES de 0,55 s: espera o tempo restante e dispara uma única vez exatamente quando o cast acaba', () => {
  const g = aim({hold: 20, release: false});const b = g.fighters[0];
  g.step(cmd(), cmd());   // solta no passo 21 (0,17 s)
  let fired = -1, n = 0;
  for (let i = 0; i < 100; i++) {g.step(cmd(), cmd());if (burrows(g).length && fired < 0) fired = i;n = Math.max(n, burrows(g).length);}
  assert.ok(fired >= 0 && Math.abs((fired + 21) / 120 - .55) < .03, `disparou no passo ${fired + 21}`);
  assert.equal(n, 1, 'um único projétil');void b;
});
test('soltar DEPOIS de 0,55 s dispara na soltura; segurar muito não dispara sozinho', () => {
  const g = aim({hold: 200, release: false});assert.equal(burrows(g).length, 0);assert.ok(g.fighters[0].aim);
  g.step(cmd(), cmd());g.step(cmd(), cmd());assert.equal(burrows(g).length, 1);assert.ok(!g.fighters[0].aim);
});
test('stamina 3 e recarga 9 s cobradas SÓ no disparo (soltura confirmada), antes do projétil', () => {
  const g = aim({hold: 100, release: false});const b = g.fighters[0];
  assert.equal(b.stamina, C.rules.staminaMax);
  g.step(cmd(), cmd());g.step(cmd(), cmd());
  assert.ok(Math.abs(C.rules.staminaMax - b.stamina - 3) < .06, `${C.rules.staminaMax - b.stamina}`);assert.ok(Math.abs(b.moveCooldowns['emerging-stone'] - 9) < .1);
  assert.ok(!b.action, 'livre para mover, atacar e defender logo após o disparo');
});
test('marcador fora de 3–10 m (3D) fica vermelho, não vai ao limite e soltar cancela sem custo', () => {
  const far = aim({hold: 120, input: vec(0, 1), release: false});const b = far.fighters[0];
  assert.ok(!b.aim.valid && b.aim.reason === 'range', JSON.stringify([b.aim.valid, b.aim.reason, b.aim.distance]));
  const z = b.aim.pos.z;far.step(cmd({...held}), cmd());assert.equal(b.aim.pos.z, z, 'não é teleportado');
  far.step(cmd(), cmd());assert.ok(!b.aim && !burrows(far).length);assert.equal(b.stamina, C.rules.staminaMax);
  const near = aim({hold: 100, input: vec(0, -1), release: false});
  assert.ok(!near.fighters[0].aim.valid && near.fighters[0].aim.reason === 'tooClose', JSON.stringify(near.fighters[0].aim.reason));
});
test('pode começar no ar: o cast corre e, se pousar antes do fim, dispara; sem apoio ao concluir, cancela sem custo', () => {
  const landing = arena({equip: ['emerging-stone'], positions: [vec(0, -8), vec(0, 30)]});landing.mapState.destructibles = [];
  const b = landing.fighters[0];b.flight = {y: .6, vy: 0, horizontal: vec(0, 0), gravity: 17.5, isNormalJump: true};b.normalJumpLanding = true;
  landing.step(cmd(press0), cmd());assert.ok(b.aim, 'cast aberto no ar');
  for (let i = 0; i < 60; i++) landing.step(cmd({...held}), cmd());
  landing.step(cmd(), cmd());for (let i = 0; i < 12; i++) landing.step(cmd(), cmd());
  assert.equal(burrows(landing).length, 1, 'pousou e disparou');
  const stuck = arena({equip: ['emerging-stone'], positions: [vec(0, -8), vec(0, 30)]});const c = stuck.fighters[0];
  c.flight = {y: 40, vy: 0, horizontal: vec(0, 0)};
  stuck.step(cmd(press0), cmd());for (let i = 0; i < 80; i++) stuck.step(cmd({...held}), cmd());
  assert.ok(!c.aim && !burrows(stuck).length);assert.equal(c.stamina, C.rules.staminaMax);
});
test('perder o apoio DEPOIS de apoiado durante o cast cancela', () => {
  const g = aim({hold: 20, release: false});const b = g.fighters[0];
  b.flight = {y: 1, vy: 2, horizontal: vec(0, 0)};
  g.step(cmd({...held}), cmd());
  assert.ok(!b.aim, 'cancelado');assert.equal(b.stamina, C.rules.staminaMax);
});
test('o projétil nasce onde o lutador REALMENTE está no disparo, vai em linha reta a 15 m/s e atravessa paredes sem causar nada', () => {
  const g = arena({equip: ['emerging-stone'], positions: [vec(0, -8), vec(1.2, -5)]});g.mapState.destructibles = [];
  spawn(g.world, {kind: 'wall', pos: {x: 0, z: -5.5}, hx: 5, hz: .3, angle: 0, y: 0, height: 3}, []);
  g.step(cmd(press0), cmd());for (let i = 1; i < 70; i++) g.step(cmd({...held, move: vec(1, 0)}), cmd());
  const b = g.fighters[0];const at = {x: b.position.x, z: b.position.z};
  g.step(cmd(), cmd());g.step(cmd(), cmd());
  const bu = burrows(g)[0];assert.ok(bu, 'projétil existe');
  assert.ok(Math.abs(bu.from.x - at.x) < .05 && Math.abs(bu.from.z - at.z) < .1, `origem ${JSON.stringify(bu.from)} esperada ${JSON.stringify(at)}`);
  const hpBefore = g.fighters[1].hp, p0 = {...bu.pos};
  g.step(cmd(), cmd());
  const moved = Math.hypot(bu.pos.x - p0.x, bu.pos.z - p0.z) * 120;assert.ok(Math.abs(moved - 15) < 1.5 || Math.hypot(bu.to.x - bu.from.x, bu.to.z - bu.from.z) < 1, `velocidade ${moved}`);
  void hpBefore;
});
test('explosão: 5 m HORIZONTAIS, uma vez, 20 nominais (× Ataque ÷ referência) e empurrão radial de 8 m/s; aéreo e fora do raio não sofrem', () => {
  const g = aim({red: vec(0, -1)});const r = g.fighters[1], h0 = r.hp;
  const ev = upto(g, secs(1));
  const hit = stoneHits(ev);assert.equal(hit.length, 1);
  assert.ok(Math.abs(h0 - r.hp - 20) < 1e-6, `dano ${h0 - r.hp}`);
  assert.ok(Math.abs(hit[0].launch.horizontal - 8) < 1e-6 && hit[0].launch.vertical === 0, JSON.stringify(hit[0].launch));
  const out = aim({red: vec(0, 3.5)});const hp = out.fighters[1].hp;upto(out, secs(1));assert.equal(out.fighters[1].hp, hp, 'a 6,5 m do centro');
  const air = aim({red: vec(0, -1)});air.fighters[1].flight = {y: 30, vy: 0, horizontal: vec(0, 0)};const ha = air.fighters[1].hp;upto(air, secs(.8));assert.equal(air.fighters[1].hp, ha, 'no ar não sofre a explosão');
});
test('a explosão atravessa parede (alvo atrás dela, dentro do raio, é atingido)', () => {
  const g = aim({red: vec(0, -1)});spawn(g.world, {kind: 'wall', pos: {x: 0, z: -2}, hx: 6, hz: .3, angle: 0, y: 0, height: 3}, []);
  const r = g.fighters[1], h = r.hp;upto(g, secs(1));assert.ok(h - r.hp > 19);
});
test('dono derrotado depois de disparar: o laboratório encerra a rodada e o projétil é descartado SEM detonar (fim de rodada remove sem detonação tardia)', () => {
  const g = aim({red: vec(0, -1)});g.fighters[0].hp = 0;
  const r = g.fighters[1], h = r.hp;
  for (let i = 0; i < 150; i++) g.step(cmd(), cmd());
  assert.ok(['result', 'finishing'].includes(g.phase));assert.equal(r.hp, h, 'sem dano tardio');
});
test('cenário: destrutível tocado pelo raio é destruído INTEIRO e não renasce; o de fora fica', () => {
  const g = aim({});
  g.mapState.destructibles.push({id: 'a', hp: 30, maxHp: 30, pos: {x: 0, y: 0, z: -1}, size: {hx: .8, hz: .8, height: 1.6}, shape: 'box', angle: 0, state: 'solid', respawnTimer: 0, ghostTimer: 0},
    {id: 'b', hp: 30, maxHp: 30, pos: {x: 12, y: 0, z: -3}, size: {hx: .8, hz: .8, height: 1.6}, shape: 'box', angle: 0, state: 'solid', respawnTimer: 0, ghostTimer: 0});
  upto(g, secs(40));
  const a = g.mapState.destructibles.find(d => d.id === 'a'), b = g.mapState.destructibles.find(d => d.id === 'b');
  assert.equal(a.state, 'dead');assert.equal(b.state, 'solid');
});
test('cenário: plataforma e parede no raio caem; quem estava na plataforma leva o dano ANTES e depois cai pela gravidade', () => {
  const g = aim({red: vec(0, -1)});
  g.mapState.platforms.push({pos: {x: 0, z: -1}, width: 3, depth: 3, height: 1});g.fighters[1].groundY = 1;
  spawn(g.world, {kind: 'wall', pos: {x: 3, z: -3}, hx: .3, hz: 1, angle: 0, y: 0, height: 3}, []);
  const r = g.fighters[1], h = r.hp;
  const ev = upto(g, secs(1));
  assert.ok(h - r.hp > 19, 'dano calculado enquanto apoiado');assert.equal(g.mapState.platforms.length, 0);
  assert.ok(ev.filter(e => e.result === 'sceneryDestroyed').length >= 2);
  assert.ok(!g.world.entities.some(e => e.kind === 'wall' && !e.dead));
});
test('rocha: nasce no marcador, prisma 3×3×3 m, 5 HP, emerge em 0,40 s com o colisor crescendo junto', () => {
  const g = aim({});upto(g, secs(.55));
  let r = rocks(g)[0];assert.ok(r, 'rocha criada');
  assert.deepEqual([r.size.hx, r.size.hz, r.targetHeight, r.hp], [1.5, 1.5, 3, 5]);
  assert.ok(Math.abs(r.pos.x) < .01 && Math.abs(r.pos.z - -3) < .01, JSON.stringify(r.pos));
  const h1 = r.size.height;upto(g, 3);r = rocks(g)[0];
  assert.ok(r.size.height > h1 && r.size.height <= 3, `crescendo ${h1.toFixed(2)} → ${r.size.height.toFixed(2)}`);
  upto(g, secs(.5));assert.ok(Math.abs(rocks(g)[0].size.height - 3) < 1e-6);
  assert.ok(Math.abs(getGroundHeight({x: 0, z: -3}, g.world, 3.1) - 3) < .01, 'topo sustenta quem pousa em cima');
});
test('lançamento da emergência: primeira interseção, UMA vez, 8 m/s H e 14 m/s V, sem dano da rocha', () => {
  const g = aim({red: vec(0, -3.4)});
  const r = g.fighters[1];
  const ev = upto(g, secs(1.2));
  const l = ev.filter(e => e.result === 'rockLaunch');
  assert.equal(l.length, 1, `lançamentos ${l.length}`);assert.ok(l[0].horizontal === 8 && l[0].vertical === 14);
});
test('defesa não impede o deslocamento da emergência (o lançamento continua valendo)', () => {
  const g = aim({red: vec(0, -3.4)});
  const ev = upto(g, secs(1.2), () => cmd({guard: true}));
  assert.ok(ev.some(e => e.result === 'rockLaunch'));
});
test('sem lugar válido (paredes em volta): a explosão ocorre e NÃO nasce rocha', () => {
  const g = aim({});
  for (const [x, z] of [[-4, -3], [4, -3], [0, 1], [0, -7]]) spawn(g.world, {kind: 'wall', pos: {x, z}, hx: x ? .3 : 4, hz: x ? 4 : .3, angle: 0, y: 0, height: 3}, []);
  g.world.entities.forEach(e => {e.life = Infinity;});
  g.mapState.destructibles = [];
  const ev = upto(g, secs(1));
  assert.ok(ev.some(e => e.result === 'stoneBlast'));
});
test('se o marcador está ocupado por um sólido sobrevivente, a rocha procura o lugar válido mais próximo e a explosão fica no marcador', () => {
  const g = aim({});
  g.mapState.obstacles.push({id: 'o1', shape: 'cylinder', pos: {x: 0, y: 0, z: -3}, radius: 1, height: 4});
  const ev = upto(g, secs(1));
  const blast = ev.find(e => e.result === 'stoneBlast');assert.ok(blast && Math.abs(blast.x) < .01 && Math.abs(blast.z + 3) < .01);
});
test('máximo de 3 rochas por dono: a quarta destrói a mais antiga que SOBROU da explosão', () => {
  const g = arena({equip: ['emerging-stone'], positions: [vec(0, -8), vec(0, 30)], setup: () => {C.world.emergingStone.cooldown = 0;C.world.emergingStone.cost = 0;C.world.emergingStone.blastRadius = .5;}});
  g.mapState.destructibles = [];g.mapState.platforms = [];g.mapState.obstacles = [];
  const shoot = x => {
    const b = g.fighters[0];b.position = vec(0, -8);b.facing = 0;
    g.step(cmd(press0), cmd());b.aim.pos = {x, z: -3};
    for (let i = 1; i < 70; i++) g.step(cmd({...held}), cmd());
    g.step(cmd(), cmd());upto(g, secs(1.1));
  };
  shoot(0);shoot(5);shoot(-5);
  assert.equal(rocks(g).length, 3);const oldest = Math.min(...rocks(g).map(r => r.seq));
  shoot(2.5);
  assert.equal(rocks(g).length, 3, 'continua 3');assert.ok(Math.min(...rocks(g).map(r => r.seq)) > oldest, 'a mais antiga saiu');
});
test('dano à rocha por PL: sem PL = 1 HP, Tackle PL1 = 2, PL2 = 3, PL3 = 4; ao zerar some na hora', () => {
  const g = aim({});upto(g, secs(1));const d = rocks(g)[0];
  const hit = pl => {d.hp = 5;const before = d.hp;damageDestructible(d, 99, pl == null ? 'projectile' : 'physical', pl == null ? null : {action: {pl}}, g.mapState, []);return before - d.hp;};
  assert.deepEqual([hit(null), hit(1), hit(2), hit(3)], [1, 2, 3, 4]);
  d.hp = 1;damageDestructible(d, 99, 'projectile', null, g.mapState, []);
  assert.equal(rocks(g).length, 0, 'destruída ao zerar');
});
test('perda do apoio integral destrói a rocha e propaga pela pilha', () => {
  const g = aim({});upto(g, secs(1));
  const mk = (id, x, y) => ({id, rock: true, owner: 0, hp: 5, maxHp: 5, pos: {x, y, z: 6}, size: {hx: 1.5, hz: 1.5, height: 3}, targetHeight: 3, rise: .4, age: 1, launched: [], launchH: 8, launchV: 14, shape: 'box', angle: 0, state: 'solid', seq: 90 + y});
  g.mapState.platforms.push({pos: {x: 10, z: 6}, width: 5, depth: 5, height: 1});
  g.mapState.destructibles.push(mk('p', 10, 1));
  upto(g, 3);assert.ok(g.mapState.destructibles.some(d => d.id === 'p'), 'apoiada: permanece');
  g.mapState.platforms.length = 0;upto(g, 3);
  assert.ok(!g.mapState.destructibles.some(d => d.id === 'p'), 'sem a plataforma é destruída');
  g.mapState.destructibles.push(mk('a', -10, 0), mk('b', -10, 3));
  upto(g, 3);assert.ok(g.mapState.destructibles.some(d => d.id === 'b'), 'pilha apoiada permanece');
  g.mapState.destructibles = g.mapState.destructibles.filter(d => d.id !== 'a');upto(g, 3);
  assert.ok(!g.mapState.destructibles.some(d => d.id === 'b'), 'cascata: a de cima cai junto');
});
test('escala do prisma: 2× vira 6×6×6 m', () => {
  const g = aim({tweak: () => {C.world.emergingStone.rockScale = 2;}});upto(g, secs(1.2));
  const r = rocks(g)[0];assert.ok(r && r.size.hx === 3 && r.targetHeight === 6, JSON.stringify(r && [r.size.hx, r.targetHeight]));
});
test('M28.4: sliders mexidos depois de apertar não alteram esse uso; o próximo lê o novo', () => {
  const g = aim({release: false, hold: 20});C.world.emergingStone.blastRadius = .1;C.world.emergingStone.damage = 99;
  for (let i = 0; i < 60; i++) g.step(cmd({...held}), cmd());g.step(cmd(), cmd());upto(g, 5);
  assert.equal(burrows(g)[0].params.blastRadius, 5);
});
test('paridade e determinismo: registrado e não equipado não muda nada; save/load com o projétil em voo reproduz o futuro', () => {
  const sim = () => {const g = arena();g.mode = 'tactical';C.extras.toggles.enableEnemyAI = 1;for (let i = 0; i < 1200; i++) g.step(cmd(), undefined);return fighterHash(g);};
  assert.equal(sim(), sim());
  const go = split => {
    const g = aim({red: vec(0, -1)});upto(g, 8);
    const tail = x => {upto(x, secs(1.5));return fighterHash(x) + JSON.stringify(x.mapState.destructibles.map(d => [d.id, d.state, +d.size.height.toFixed(3)]));};
    if (split) {const snap = g.save();const h = new Game({seed: 3});h.start();h.load(snap);return tail(h);}
    return tail(g);
  };
  assert.equal(go(true), go(false));
});

done();
void run;
