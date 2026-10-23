// @ts-check
// Fire Spin (Normal · Field): protótipo de 23/10/2026 com os números do prompt de 22/10 (NÃO homologados) e as decisões provisórias da Rodada 1 (FS-P07 A: pulsos sem guard stun;
// FS-P01 A: sem Clash de área; FS-P04: 1 zona por dono; oclusão por paredes). Relógios: a zona conta em IDADE LOCAL (cada `impact` congela o mundo 1 passo de hitstop). Valores de FÁBRICA.
import {assert, C, cmd, vec, suite, arena as arenaBase, run, fighterHash, HOLD} from './moves-new-helpers.mjs';
import {getMove} from '../src/sim/moves.js';
import {spawn} from '../src/sim/world.js';

const {test, done} = suite('FIRE SPIN');
const arena = (o = {}) => arenaBase({equip: ['fire-spin'], ...o, setup: () => {o.setup?.();C.world.fireSpin.markerAccel = 0;}});
const press0 = {skill: 0, skillHeld: HOLD(0)}, held = {skillHeld: HOLD(0)};
const zones = g => g.world.entities.filter(e => e.kind === 'area' && e.visual === 'firespin' && !e.dead);
/** Azul abre o marcador (3 m à frente), mantém `ticks` passos e solta. Devolve o jogo e o índice do passo da confirmação. */
function place({positions = [vec(0, -4), vec(1.2, -1)], ticks = 4, setup = null, input = vec(0, 0)} = {}) {
  const g = arena({positions, setup});
  g.step(cmd(press0), cmd());for (let i = 0; i < ticks; i++) g.step(cmd({...held, move: input}), cmd());g.step(cmd(), cmd());
  return g;
}
const pulseLog = (g, steps) => {const out = [];for (let i = 0; i < steps; i++) {const z = zones(g)[0];const age = z ? z.age : null;g.step(cmd(), cmd());for (const e of g.lastStepEvents) if (e.pulse) out.push({pulse: e.pulse, result: e.result, damage: e.damage, ageBefore: age});}return out;};

test('registrado: Normal · Field por marcador, 1 de stamina, 11 s, ação de 72 passos (cast 48 + recovery 24); nada equipado por padrão', () => {
  const g = arenaBase();const d = getMove('fire-spin');
  assert.ok(d && d.aimMode === 'marker' && d.air === 'cast' && !d.charge);assert.deepEqual([d.cost, d.cooldown], [1, 11]);assert.equal(Math.round(d.duration * 120), 72);
  assert.ok(g.fighters.every(f => (f.loadout ?? []).every(x => !x)));
});

test('apertar abre o marcador a 3 m SEM cobrar; soltar com marcador válido cobra 1 de stamina e 11 s no passo da confirmação', () => {
  const g = arena({positions: [vec(0, -4), vec(10, 4)]});const f = g.fighters[0], s0 = f.stamina;
  g.step(cmd(press0), cmd());assert.ok(f.aim && Math.abs(f.aim.pos.z - -1) < 1e-6);assert.equal(f.stamina, s0);
  for (let i = 0; i < 4; i++) g.step(cmd(held), cmd());assert.equal(f.stamina, s0, 'segurando não cobra');
  g.step(cmd(), cmd());
  assert.ok(Math.abs(s0 - f.stamina - 1) < 1e-9, 'cobrado na confirmação');assert.ok(f.moveCooldowns['fire-spin'] > 10.9);
});

test('marcador inválido (sobre o adversário) cancela SEM custo e nenhuma zona nasce', () => {
  const g = arena({positions: [vec(0, -4), vec(0, -1)]});const f = g.fighters[0], s0 = f.stamina;
  g.step(cmd(press0), cmd());for (let i = 0; i < 3; i++) g.step(cmd(held), cmd());g.step(cmd(), cmd());run(g, 80);
  assert.equal(f.stamina, s0);assert.equal(zones(g).length, 0);assert.ok(!f.moveCooldowns['fire-spin']);
});

test('cast de 48 passos: a zona nasce no passo 48 após a confirmação (índice +47) e o controle volta no passo 72', () => {
  const g = place({positions: [vec(0, -4), vec(10, 4)]});const f = g.fighters[0];let spawnAt = -1, endAt = -1;
  // g já está no passo da confirmação (índice 0 do cast): a ação existe
  assert.ok(f.action?.kind === 'move');
  for (let i = 1; i < 90; i++) {g.step(cmd(), cmd());if (spawnAt < 0 && zones(g).length) spawnAt = i;if (endAt < 0 && !f.action) endAt = i;}
  assert.equal(spawnAt, 47, 'zona no índice 47 = passo 48');assert.equal(endAt, 71, 'ação encerrada no índice 71 = passo 72');
});

test('zona: cilindro de 1,6 m × 2,4 m sobre o apoio, vida 2,4 s, 4 pulsos a cada 0,6 s, 2 HP nominais, sem knockback e sem guard stun; sem dono afetado', () => {
  const g = place({positions: [vec(0, -4), vec(10, 4)]});run(g, 50);const z = zones(g)[0];
  assert.ok(z);assert.equal(z.radius, 1.6);assert.equal(z.height, 2.4);assert.equal(z.life, 2.4);assert.equal(z.pulses, 4);assert.equal(z.interval, .6);
  assert.ok(Math.abs(z.hit.damage - 2) < 1e-9);assert.deepEqual(z.hit.knockback, {horizontal: 0, vertical: 0});assert.equal(z.hit.guardStun, 0);
  assert.equal(z.support, true);assert.equal(z.occlusion, 1);assert.equal(z.affectsOwner, false);assert.equal(z.y, 0);
});

test('4 pulsos em idade local 0 / 0,6 / 1,2 / 1,8 s, 2 HP cada (8 no total), sem stun nem empurrão; a zona expira em 2,4 s', () => {
  const g = place();run(g, 46);const red = g.fighters[1];
  const log = pulseLog(g, 330);
  assert.equal(log.length, 4);log.forEach((p, i) => {assert.equal(p.result, 'impact');assert.ok(Math.abs(p.damage - 2) < 1e-9);assert.ok(Math.abs((p.ageBefore ?? 0) - i * .6) < C.test.step * 1.5, `pulso ${i + 1} em idade ${p.ageBefore}`);});
  assert.equal(red.hp, 92);assert.equal(red.stun, 0);assert.equal(zones(g).length, 0, 'expirou');
  assert.ok(Math.abs(red.position.x - 1.2) < 1e-6 && Math.abs(red.position.z - -1) < 1e-6, 'sem empurrão (0/0)');
});

test('1 acerto por alvo por pulso; quem está fora do raio (1,6 + corpo) não sofre; quem sai evita os pulsos seguintes', () => {
  const g = place({positions: [vec(0, -4), vec(2.6, -1)]});run(g, 46);const red = g.fighters[1];
  pulseLog(g, 330);assert.equal(red.hp, 100, 'fora do raio');
  const g2 = place();run(g2, 46);const r2 = g2.fighters[1];let out = false;
  for (let i = 0; i < 330; i++) {g2.step(cmd(), cmd({move: i > 80 ? vec(1, 0) : vec(0, 0)}));if (i > 80) out = true;}
  assert.ok(out && r2.hp > 92 && r2.hp <= 96, `saiu a tempo (HP ${r2.hp})`);
});

test('defesa: cada pulso é parcial (×0,5 = 1 HP) e, por padrão, SEM guard stun (o defensor continua livre); com o slider em 0,514 s ele trava', () => {
  const run1 = guardStun => {
    const g = place({setup: () => {C.world.fireSpin.guardStun = guardStun;}});const red = g.fighters[1];red.facing = -Math.PI / 2;   // olha para o centro da zona (−x)
    run(g, 46);let stunned = 0;const res = [];
    for (let i = 0; i < 300; i++) {g.step(cmd(), cmd({guard: true}));if (red.stun > 1e-8) stunned++;for (const e of g.lastStepEvents) if (e.pulse) res.push(e.result);}
    return {stunned, res, hp: red.hp};
  };
  const a = run1(0), b = run1(.514);
  assert.equal(a.stunned, 0);assert.ok(b.stunned > 150, `com guard stun: ${b.stunned} passos travado`);
  assert.deepEqual(a.res, ['partial', 'partial', 'partial', 'partial']);assert.equal(a.hp, 96, '4 pulsos × 1 HP (×0,5)');
});

test('oclusão: uma parede entre o centro da zona e o alvo bloqueia o pulso (evento occluded, 0 dano); com o slider desligado o dano atravessa', () => {
  const mk = occ => {
    const g = place({setup: () => {C.world.fireSpin.occlusion = occ;}});
    spawn(g.world, {kind: 'wall', owner: 1, pos: {x: .6, z: -1}, hx: .1, hz: 1.5, y: 0, height: 3, angle: 0}, []);
    g.fighters[1].position = {x: 1.6, z: -1};const ev = [];run(g, 46);for (let i = 0; i < 330; i++) {g.step(cmd(), cmd());ev.push(...g.lastStepEvents);}
    return {hp: g.fighters[1].hp, occluded: ev.filter(e => e.result === 'occluded').length};
  };
  const on = mk(1), off = mk(0);
  assert.equal(on.hp, 100);assert.equal(on.occluded, 4);assert.equal(off.hp, 92);
});

test('apoio: sobre uma plataforma a base fica no topo; se a plataforma some, a zona some SEM efeito (fieldLost) e não flutua', () => {
  const g = arena({positions: [vec(0, -4), vec(10, 4)]});
  g.mapState.platforms = [{id: 'plat', pos: {x: 0, z: -1}, x: 0, z: -1, width: 4, depth: 4, height: 1}];
  g.step(cmd(press0), cmd());for (let i = 0; i < 4; i++) g.step(cmd(held), cmd());g.step(cmd(), cmd());run(g, 50);
  const z = zones(g)[0];assert.ok(z && Math.abs(z.y - 1) < 1e-9, `y ${z?.y}`);
  g.mapState.platforms = [];const ev = [];for (let i = 0; i < 5; i++) {g.step(cmd(), cmd());ev.push(...g.lastStepEvents);}
  assert.ok(ev.some(e => e.result === 'fieldLost') && zones(g).length === 0);
});

test('revalidação no fim do cast: se surgir um sólido no local, o efeito falha (moveFailed) e nenhuma zona nasce', () => {
  const g = place({positions: [vec(0, -4), vec(10, 4)]});
  spawn(g.world, {kind: 'wall', owner: 1, pos: {x: 0, z: -1}, hx: 1, hz: 1, y: 0, height: 2}, []);
  const ev = [];for (let i = 0; i < 80; i++) {g.step(cmd(), cmd());ev.push(...g.lastStepEvents);}
  assert.ok(ev.some(e => e.result === 'moveFailed' && e.reason === 'invalidPlacement'));assert.equal(zones(g).length, 0);
});

test('1 zona por dono (padrão): a segunda substitui a primeira (fieldReplaced); maxActive 2 mantém as duas', () => {
  const two = maxActive => {
    const g = arena({positions: [vec(0, -4), vec(10, 4)], setup: () => {C.world.fireSpin.cooldown = 0;C.world.fireSpin.maxActive = maxActive;}});const ev = [];
    for (const dz of [0, 1]) {g.step(cmd(press0), cmd());for (let i = 0; i < 3; i++) g.step(cmd({...held, move: vec(dz, 0)}), cmd());g.step(cmd(), cmd());for (let i = 0; i < 80; i++) {g.step(cmd(), cmd());ev.push(...g.lastStepEvents);}}
    return {zones: zones(g).length, replaced: ev.filter(e => e.result === 'fieldReplaced').length};
  };
  assert.deepEqual(two(1), {zones: 1, replaced: 1});assert.deepEqual(two(2), {zones: 2, replaced: 0});
});

test('M28.4: sliders mexidos depois da confirmação não mudam a zona; o próximo uso usa o valor novo', () => {
  const g = place({positions: [vec(0, -4), vec(10, 4)]});C.world.fireSpin.zoneRadius = 3;C.world.fireSpin.damage = 20;run(g, 50);
  assert.ok(zones(g)[0].radius === 1.6 && Math.abs(zones(g)[0].hit.damage - 2) < 1e-9);
  const g2 = place({positions: [vec(0, -4), vec(10, 4)], setup: () => {C.world.fireSpin.zoneRadius = 3;}});run(g2, 50);assert.equal(zones(g2)[0].radius, 3);
});

test('determinismo e save/load: duas partidas idênticas terminam no mesmo estado (zona viva no meio)', () => {
  const play = () => {const g = place();run(g, 200);return g;};
  const a = play(), b = play();assert.equal(fighterHash(a), fighterHash(b));assert.deepEqual(JSON.parse(JSON.stringify(a.world.entities)), JSON.parse(JSON.stringify(b.world.entities)));
  assert.equal(structuredClone(a.world).entities.length, a.world.entities.length);
});

done();
