// @ts-check
// Seed Bomb (Normal · Projectile + Field instantâneo): protótipo de 23/10/2026 com os números do prompt de 22/10 (NÃO homologados) e as decisões provisórias da Rodada 1
// (SB-P04 B: explosão ESFÉRICA 3D; FS-P01/SB-P09 A: sem Clash de área; destino inviável FALHA sem corrigir a trajetória). M22.7: a semente só detona; o dano é UM evento da explosão.
import {assert, C, cmd, vec, suite, arena as arenaBase, run, fighterHash, HOLD} from './moves-new-helpers.mjs';
import {getMove} from '../src/sim/moves.js';
import {ballisticLaunch} from '../src/sim/moves/seed-bomb.js';
import {spawn} from '../src/sim/world.js';

const {test, done} = suite('SEED BOMB');
/** Marcador a 7 m à frente do azul (alcance 8 m) e resposta instantânea. */
const arena = (o = {}) => arenaBase({equip: ['seed-bomb'], positions: [vec(0, -6), vec(10, 6)], ...o, setup: () => {C.world.seedBomb.markerAccel = 0;C.world.seedBomb.startDistance = 7;o.setup?.();}});
const press0 = {skill: 0, skillHeld: HOLD(0)}, held = {skillHeld: HOLD(0)};
const seeds = g => g.world.entities.filter(e => e.kind === 'projectile' && e.visual === 'seed' && !e.dead);
const blasts = g => g.world.entities.filter(e => e.kind === 'area' && e.visual === 'seedblast');
/** Abre o marcador, segura `ticks` passos e solta. */
function confirm(g, ticks = 3, move = vec(0, 0)) {g.step(cmd(press0), cmd());for (let i = 0; i < ticks; i++) g.step(cmd({...held, move}), cmd());g.step(cmd(), cmd());}
/** Roda `n` passos coletando os eventos. */
const collect = (g, n, c1 = () => cmd()) => {const ev = [];for (let i = 0; i < n; i++) {g.step(cmd(), c1(i));ev.push(...g.lastStepEvents);}return ev;};

test('registrado: Normal · Projectile + Field por marcador, 1 de stamina, 8 s, ação de 60 passos (cast 36 + recovery 24); nada equipado por padrão', () => {
  const g = arenaBase();const d = getMove('seed-bomb');
  assert.ok(d && d.aimMode === 'marker' && d.air === 'cast' && !d.charge);assert.deepEqual([d.cost, d.cooldown], [1, 8]);assert.equal(Math.round(d.duration * 120), 60);
  assert.ok(g.fighters.every(f => (f.loadout ?? []).every(x => !x)));
});

test('cobrança na confirmação (stamina e 8 s); com allowOccupied desligado, marcador sobre o adversário cancela sem custo', () => {
  const g = arena();const f = g.fighters[0], s0 = f.stamina;g.step(cmd(press0), cmd());for (let i = 0; i < 3; i++) g.step(cmd(held), cmd());assert.equal(f.stamina, s0);
  g.step(cmd(), cmd());assert.ok(Math.abs(s0 - f.stamina - 1) < 1e-9 && f.moveCooldowns['seed-bomb'] > 7.9);
  const g2 = arena({positions: [vec(0, -6), vec(0, 1)]});C.world.seedBomb.allowOccupied = 0;   // a regra padrão agora permite lançar sobre o adversário; desligada, o marcador ocupado é inválido
  const f2 = g2.fighters[0], s2 = f2.stamina;confirm(g2);run(g2, 100);
  assert.equal(f2.stamina, s2);assert.equal(seeds(g2).length + blasts(g2).length, 0);
});

test('cast de 36 passos: a semente nasce no passo 36 após a confirmação (índice +35); o controle volta no passo 60', () => {
  const g = arena();const f = g.fighters[0];confirm(g);let spawnAt = -1, endAt = -1;
  for (let i = 1; i < 80; i++) {g.step(cmd(), cmd());if (spawnAt < 0 && seeds(g).length) spawnAt = i;if (endAt < 0 && !f.action) endAt = i;}
  assert.equal(spawnAt, 35);assert.equal(endAt, 59);
});

test('semente: raio 0,24 m, gravidade 17,5, PL1, detona ao tocar (não causa dano por contato) e carrega a explosão esférica de 1,8 m', () => {
  const g = arena();confirm(g);run(g, 36);const s = seeds(g)[0];
  assert.ok(s);assert.equal(s.radius, .24);assert.equal(s.gravity, 17.5);assert.equal(s.pl, 1);assert.equal(s.detonateOnly, true);assert.equal(s.hit.damage, 0);
  assert.equal(s.onHit.sphere, true);assert.equal(s.onHit.radius, 1.8);assert.equal(s.onHit.explosion, true);assert.ok(Math.abs(s.onHit.hit.damage - 10) < 1e-9);assert.deepEqual(s.onHit.hit.knockback, {horizontal: 3, vertical: 1});
});

test('arco balístico: pousa no marcador (erro horizontal < 0,12 m) em ≈0,65 s e com velocidade 3D ≤ 20 m/s', () => {
  const g = arena({positions: [vec(0, -6), vec(10, 6)]});confirm(g);let t0 = -1, boom = null;
  for (let i = 0; i < 200 && !boom; i++) {g.step(cmd(), cmd());if (t0 < 0 && seeds(g).length) t0 = i;boom = blasts(g)[0] ?? null;}
  assert.ok(boom, 'explodiu');assert.ok(Math.hypot(boom.pos.x - 0, boom.pos.z - 1) < .12, `pouso (${boom.pos.x.toFixed(2)}, ${boom.pos.z.toFixed(2)}) vs marcador (0, 1)`);
  const sp = ballisticLaunch(Math.hypot(0, 7 - .5), -.8, .65, 17.5);assert.ok(sp.speed <= 20, `v3D ${sp.speed.toFixed(1)} m/s`);
});

test('explosão ESFÉRICA: acerta quem está a 1,3 m do centro no chão e poupa quem está a 2,5 m; 10 HP uma vez; empurrão radial', () => {
  const run1 = x => {const g = arena({positions: [vec(0, -6), vec(x, 1)]});confirm(g);const ev = collect(g, 200);return {hp: g.fighters[1].hp, hits: ev.filter(e => e.entity != null && e.target === 1 && (e.result === 'impact' || e.result === 'partial')).length};};
  const near = run1(1.3), far = run1(2.7);
  assert.deepEqual(near, {hp: 90, hits: 1});assert.deepEqual(far, {hp: 100, hits: 0});
});

test('esfera 3D: quem está numa plataforma de 3 m perto da explosão NÃO é atingido (o cilindro antigo ficava em y=0 e falhava em plataformas)', () => {
  const g = arena({positions: [vec(0, -6), vec(2.2, 1)]});
  g.mapState.platforms = [{id: 'alta', pos: {x: 2.2, z: 1}, x: 2.2, z: 1, width: 2, depth: 2, height: 3}];g.fighters[1].groundY = 3;
  confirm(g);collect(g, 200);assert.equal(g.fighters[1].hp, 100);
});

test('destino numa plataforma de 1 m: a explosão nasce NA ALTITUDE do impacto e atinge quem está em cima (o y herdado)', () => {
  const g = arena({positions: [vec(0, -6), vec(.5, 1)]});
  g.mapState.platforms = [{id: 'baixa', pos: {x: 0, z: 1}, x: 0, z: 1, width: 4, depth: 4, height: 1}];g.fighters[1].groundY = 1;
  g.fighters[0].position = {x: 0, z: -6};confirm(g, 3);const ev = collect(g, 200);
  const boom = ev.find(e => e.result === 'spawn' && e.kind === 'area');assert.ok(boom, 'explodiu');
  assert.ok(g.fighters[1].hp < 100, `alvo na plataforma atingido (HP ${g.fighters[1].hp})`);
});

test('um único evento de dano: se a semente toca o corpo antes de pousar, detona ali (evento detonate) e o alvo leva 10 HP UMA vez, sem acerto da própria semente', () => {
  const g = arena({positions: [vec(0, -6), vec(0, 0)]});confirm(g);const ev = collect(g, 200);
  assert.ok(ev.some(e => e.result === 'detonate' && e.target === 1), 'detonou no contato');
  const dmg = ev.filter(e => e.target === 1 && e.damage > 0);assert.equal(dmg.length, 1, 'um só evento de dano');assert.ok(Math.abs(dmg[0].damage - 10) < 1e-9 && dmg[0].entity !== seeds(g)[0]?.id);
  assert.equal(g.fighters[1].hp, 90);
});

test('defesa: com a guarda voltada para a explosão o dano é parcial (×0,5 = 5 HP)', () => {
  const g = arena({positions: [vec(0, -6), vec(1.3, 1)]});g.fighters[1].facing = -Math.PI / 2;confirm(g);
  const ev = [];for (let i = 0; i < 200; i++) {g.step(cmd(), cmd({guard: true}));ev.push(...g.lastStepEvents);}
  assert.ok(ev.some(e => e.result === 'partial' && e.target === 1));assert.equal(g.fighters[1].hp, 95);
});

test('oclusão: parede entre o centro e o alvo bloqueia a explosão (evento occluded); com o slider desligado o dano atravessa', () => {
  const mk = occ => {
    const g = arena({positions: [vec(0, -6), vec(2, 1)], setup: () => {C.world.seedBomb.occlusion = occ;}});
    spawn(g.world, {kind: 'wall', owner: 1, pos: {x: 1, z: 1}, hx: .1, hz: 2, y: 0, height: 3, angle: 0}, []);
    confirm(g);const ev = collect(g, 200);return {hp: g.fighters[1].hp, occ: ev.filter(e => e.result === 'occluded').length};
  };
  const on = mk(1), off = mk(0);assert.equal(on.hp, 100);assert.ok(on.occ >= 1);assert.equal(off.hp, 90);
});

test('Reflect: a semente refletida muda de dono e a explosão passa a usar o Ataque de quem refletiu (10 × 40/20 = 20 HP)', () => {
  const g = arena({positions: [vec(0, -6), vec(10, 6)]});
  spawn(g.world, {kind: 'barrier', reflect: true, owner: 1, pl: 1, pos: {x: 0, z: -2}, hx: 3, hz: .05, y: 0, height: 4, angle: Math.PI, life: 30, captured: {tieTolerance: .001, maxReflections: 16}}, []);
  g.fighters[1].attributes.attack = 40;confirm(g);const ev = collect(g, 120);
  assert.ok(ev.some(e => e.result === 'reflected'), 'refletida');
  const s = g.world.entities.find(e => e.kind === 'projectile' && e.visual === 'seed') ?? null;
  const area = blasts(g)[0];const dmg = (s?.onHit ?? area)?.hit?.damage;
  assert.ok(Math.abs(dmg - 20) < 1e-9, `dano da explosão ${dmg}`);assert.ok((s?.owner ?? area?.owner) === 1, 'dono = refletor');
});

test('destino inviável (velocidade exigida > máxima) FALHA com evento tooFar, sem semente e sem corrigir a trajetória em silêncio', () => {
  const g = arena({setup: () => {C.world.seedBomb.maxSpeed = 5;}});confirm(g);const ev = collect(g, 90);
  assert.ok(ev.some(e => e.result === 'moveFailed' && e.reason === 'tooFar'));assert.equal(seeds(g).length + blasts(g).length, 0);
});

test('sem contato (vida curta): a semente se dissolve SEM explodir', () => {
  const g = arena({setup: () => {C.world.seedBomb.lifetime = .3;}});confirm(g);const ev = collect(g, 150);
  assert.ok(ev.some(e => e.result === 'expire' && e.kind === 'projectile'));assert.equal(blasts(g).length, 0);assert.ok(!ev.some(e => e.result === 'spawn' && e.kind === 'area'));
});

test('de uma plataforma: a semente nasce na altitude do atirador (+0,8 m) e não detona na própria plataforma', () => {
  const g = arena({positions: [vec(0, -6), vec(10, 6)]});g.mapState.platforms = [{id: 'p', pos: {x: 0, z: -6}, x: 0, z: -6, width: 3, depth: 3, height: 1.5}];g.fighters[0].groundY = 1.5;
  confirm(g);run(g, 36);const s = seeds(g)[0];assert.ok(s && Math.abs(s.y - 2.3) < .08, `y ${s?.y}`);
  const ev = collect(g, 10);assert.ok(!ev.some(e => e.result === 'platformHit'));
});

test('M28.4: sliders mexidos depois da confirmação não mudam a semente; o próximo uso usa o valor novo', () => {
  const g = arena();confirm(g);C.world.seedBomb.explosionRadius = 4;C.world.seedBomb.damage = 40;run(g, 36);
  assert.equal(seeds(g)[0].onHit.radius, 1.8);assert.ok(Math.abs(seeds(g)[0].onHit.hit.damage - 10) < 1e-9);
  const g2 = arena({setup: () => {C.world.seedBomb.explosionRadius = 4;}});confirm(g2);run(g2, 36);assert.equal(seeds(g2)[0].onHit.radius, 4);
});

test('determinismo e save/load: duas partidas idênticas terminam no mesmo estado, com a semente no ar', () => {
  const play = () => {const g = arena({positions: [vec(0, -6), vec(1.3, 1)]});confirm(g);run(g, 60);return g;};
  const a = play(), b = play();assert.equal(fighterHash(a), fighterHash(b));assert.deepEqual(JSON.parse(JSON.stringify(a.world.entities)), JSON.parse(JSON.stringify(b.world.entities)));
  assert.equal(structuredClone(a.world).entities.length, a.world.entities.length);
});

done();
