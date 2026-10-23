// @ts-check
// Water Pulse (Charge · Projectile · PL1–PL3 pela carga): protótipo de 23/10/2026 com os números do prompt de 22/10 (NÃO homologados) e as decisões provisórias da Rodada 1
// (WP-P08 A: emissão no passo da soltura; EL-P04 A: knockback com V=0 é o empurrão do motor, 1,5 × H m). Mecânica nos valores de FÁBRICA.
import {assert, C, cmd, vec, suite, arena as arenaBase, run, fighterHash, HOLD} from './moves-new-helpers.mjs';
import {getMove} from '../src/sim/moves.js';
import {spawn} from '../src/sim/world.js';

const {test, done} = suite('WATER PULSE');
const arena = (o = {}) => arenaBase({equip: ['water-pulse'], ...o});
const press0 = {skill: 0, skillHeld: HOLD(0)}, held = {skillHeld: HOLD(0)};
const pulses = g => g.world.entities.filter(e => e.kind === 'projectile' && e.visual === 'waterorb' && !e.dead);
/** Aperta e segura por `k` passos no total (1 de toque + k−1 mantidos), sem soltar. */
const charge = (g, k, extra = {}) => {g.step(cmd({...press0, ...extra}), cmd());for (let i = 1; i < k; i++) g.step(cmd({...held, ...extra}), cmd());};
/** Solta (um passo sem o botão) e devolve os eventos desse passo. */
const release = (g, extra = {}) => {g.step(cmd(extra), cmd());return g.lastStepEvents;};
const fire = (k, o = {}) => {const g = arena(o);charge(g, k);release(g);return g;};

test('registrado: Charge, air cast, 1 de stamina, 9 s, carga máx. 1,5 s e recarga na ativação; nada equipado por padrão', () => {
  const g = arenaBase();const d = getMove('water-pulse');
  assert.ok(d && d.charge && d.air === 'cast' && d.cooldownOnStart === true);
  assert.deepEqual([d.cost, d.cooldown], [1, 9]);
  assert.equal(C.world.waterPulse.maxCharge, 1.5);
  assert.ok(g.fighters.every(f => (f.loadout ?? []).every(x => !x)));
  const idle = arenaBase();run(idle, 60, i => cmd({skill: i % 4}));
  assert.equal(idle.world.entities.length, 0, 'sem Move equipado a tecla do slot não faz nada');
});

test('cobrança única na ATIVAÇÃO da carga: stamina −1 e recarga de 9 s no primeiro passo; soltar não cobra de novo', () => {
  const g = arena();const f = g.fighters[0], s0 = f.stamina;
  g.step(cmd(press0), cmd());
  assert.ok(Math.abs(s0 - f.stamina - 1) < 1e-9, 'débito na pressão');
  assert.ok(f.moveCooldowns['water-pulse'] > 8.9, 'recarga já iniciada (cooldownOnStart)');
  for (let i = 1; i < 30; i++) g.step(cmd(held), cmd());
  const before = f.stamina;release(g);
  assert.ok(f.stamina >= before - 1e-9, 'sem novo débito na soltura');
});

test('marcos de PL pela contagem de passos: 89→PL1, 90→PL2, 179→PL2, 180→PL3 (acima disso, trava em PL3)', () => {
  const pl = {};for (const k of [89, 90, 179, 180, 181, 300]) pl[k] = pulses(fire(k))[0]?.pl;
  assert.deepEqual(pl, {89: 1, 90: 2, 179: 2, 180: 3, 181: 3, 300: 3});
});

test('dano nominal 6/9/12 (Ataque de referência) gravado no projétil; PL e knockback H 2/3/4 com V 0', () => {
  for (const [k, lvl, dmg, kb] of [[10, 1, 6, 2], [100, 2, 9, 3], [200, 3, 12, 4]]) {
    const p = pulses(fire(k))[0];
    assert.equal(p.pl, lvl);assert.ok(Math.abs(p.hit.damage - dmg) < 1e-9, `dano PL${lvl}`);
    assert.deepEqual([p.hit.knockback.horizontal, p.hit.knockback.vertical], [kb, 0]);
    assert.equal(p.clashable, true);assert.equal(p.pierce, 1);assert.equal(p.homing ?? null, null, 'sem homing');
  }
});

test('o projétil sai no PASSO DA SOLTURA, com raio 0,38 m e 14 m/s; recuperação de 36 passos a partir da soltura', () => {
  const g = arena();charge(g, 20);const f = g.fighters[0];
  const ev = release(g);
  assert.ok(ev.some(e => e.result === 'spawn' && e.kind === 'projectile'), 'nasce no passo da soltura');
  const p = pulses(g)[0];assert.equal(p.radius, .38);
  assert.ok(Math.abs(Math.hypot(p.vel.x, p.vel.z) - 14) < 1e-6, 'velocidade 14 m/s');
  assert.equal(Math.round(f.moveRecovery / C.test.step), 36 - 1, 'recuperação de 0,30 s (36 passos; um já consumido no passo da soltura)');
});

test('alcance 12 m: expira em ≈103 passos percorrendo ≈12 m (lifetime = alcance ÷ velocidade, não 1,0 s)', () => {
  const g = fire(10, {positions: [vec(0, -3), vec(10, -3)]});const p = pulses(g)[0], z0 = p.pos.z;let n = 0;let lastZ = z0;
  for (let i = 0; i < 200 && pulses(g)[0]; i++) {lastZ = pulses(g)[0].pos.z;g.step(cmd(), cmd());n++;}
  const dist = lastZ - z0 + 14 / 120;
  assert.ok(n >= 100 && n <= 106, `passos até expirar: ${n}`);assert.ok(dist > 11.8 && dist < 12.3, `distância ${dist.toFixed(2)} m`);
});

test('acerto: 6 HP no PL1 e empurrão de 1,5 × H = 3 m no chão (V = 0), com recuperação do alvo', () => {
  const g = fire(10, {positions: [vec(0, -3), vec(0, 3)]});const red = g.fighters[1];
  let hit = null;for (let i = 0; i < 200 && !hit; i++) {g.step(cmd(), cmd());hit = g.lastStepEvents.find(e => e.result === 'impact' && e.target === 1) ?? null;}
  assert.ok(hit && Math.abs(hit.damage - 6) < 1e-9, 'dano 6');
  assert.equal(red.hp, 94);assert.ok(red.knockRecovery > 0, 'recuperação do empurrão');
  run(g, 240);
  assert.ok(Math.abs(red.position.z - 3 - 3) < .25, `deslocamento ${(red.position.z - 3).toFixed(2)} m ≈ 3 m`);
});

test('alvo travado na SOLTURA: direção 3D até o corpo de quem está numa plataforma de 1,0 m (o projétil sobe)', () => {
  const g = arena({positions: [vec(0, -4), vec(0, 3)]});
  g.mapState.platforms = [{id: 'plat', pos: {x: 0, z: 3}, x: 0, z: 3, width: 3, depth: 3, height: 1}];g.fighters[1].groundY = 1;
  charge(g, 10, {target: 1});const ev = release(g, {target: 1});
  const p = pulses(g)[0];assert.ok(p.vy > 0, `sobe (vy ${p.vy?.toFixed(2)})`);
  assert.ok(Math.abs(Math.hypot(Math.hypot(p.vel.x, p.vel.z), p.vy) - 14) < 1e-6, 'velocidade escalar 14 m/s em 3D');
  let hit = false;for (let i = 0; i < 120 && !hit; i++) {g.step(cmd(), cmd());hit = g.lastStepEvents.some(e => e.result === 'impact' && e.target === 1);}
  assert.ok(hit && ev.length >= 0, 'acerta o alvo em cima da plataforma');
});

test('atirador NUMA PLATAFORMA: nasce na altitude dele (+0,8 m) e não morre na própria plataforma (o padrão do Swift morria)', () => {
  const g = arena({positions: [vec(0, -3), vec(0, 8)]});
  g.mapState.platforms = [{id: 'plat', pos: {x: 0, z: -3}, x: 0, z: -3, width: 3, depth: 3, height: 1.5}];g.fighters[0].groundY = 1.5;
  charge(g, 10);const ev = release(g);
  const p = pulses(g)[0];assert.ok(p, 'nasceu');assert.ok(Math.abs(p.y - 2.3) < 1e-9, `y = ${p.y}`);
  let died = false;for (let i = 0; i < 20; i++) {g.step(cmd(), cmd());if (g.lastStepEvents.some(e => e.result === 'platformHit')) died = true;}
  assert.ok(!died && ev.every(e => e.result !== 'moveFailed'), 'sem platformHit nem falha');
});

test('sem espaço (sólido no ponto de nascimento): FALHA com reembolso e sem recarga; nada é teletransportado', () => {
  const g = arena();const f = g.fighters[0], s0 = f.stamina;
  spawn(g.world, {kind: 'wall', owner: 1, pos: {x: 0, z: -2.3}, hx: 2, hz: .3, y: 0, height: 2}, []);
  charge(g, 20);const ev = release(g);
  assert.ok(ev.some(e => e.result === 'moveFailed' && e.reason === 'semEspaco'));
  assert.ok(Math.abs(f.stamina - s0) < 1e-6 && !f.moveCooldowns['water-pulse'], 'stamina devolvida e sem recarga');
  assert.equal(pulses(g).length, 0);
});

test('Reflect: PL1 é refletido (dono troca) e o dano passa a usar o Ataque do refletor; PL superior destrói a barreira', () => {
  const g = arena({positions: [vec(0, -3), vec(0, 4)]});
  const bar = spawn(g.world, {kind: 'barrier', reflect: true, owner: 1, pl: 1, pos: {x: 0, z: 1.5}, hx: 2, hz: .05, y: 0, height: 2.5, angle: Math.PI, life: 30, captured: {tieTolerance: .001, maxReflections: 16}}, []);
  g.fighters[1].attributes.attack = 40;
  charge(g, 10);release(g);let ev = [];for (let i = 0; i < 40; i++) {g.step(cmd(), cmd());ev.push(...g.lastStepEvents);}
  const refl = ev.find(e => e.result === 'reflected');assert.ok(refl, 'refletido');
  assert.ok(Math.abs(refl.pl - 1) < 1e-9);
  const p = g.world.entities.find(e => e.kind === 'projectile' && e.visual === 'waterorb');
  assert.ok(p && p.owner === 1 && Math.abs(p.hit.damage - 12) < 1e-9, `dono ${p?.owner}, dano ${p?.hit.damage} (6 × 40/20)`);
  assert.ok(bar);
  const g3 = arena({positions: [vec(0, -3), vec(0, 4)]});
  spawn(g3.world, {kind: 'barrier', reflect: true, owner: 1, pl: 1, pos: {x: 0, z: 1.5}, hx: 2, hz: .05, y: 0, height: 2.5, angle: Math.PI, life: 30, captured: {tieTolerance: .001, maxReflections: 16}}, []);
  charge(g3, 200);release(g3);ev = [];for (let i = 0; i < 40; i++) {g3.step(cmd(), cmd());ev.push(...g3.lastStepEvents);}
  assert.ok(ev.some(e => e.result === 'barrierBroken' && e.by === 'pl') && ev.some(e => e.result === 'neutralized'), 'PL3 destrói o Reflect PL1 e é neutralizado');
});

test('Clash: dois Water Pulse de mesmo PL se destroem; PL superior vence e segue', () => {
  const g = arena({equip: ['water-pulse'], equipRed: ['water-pulse'], positions: [vec(0, -3), vec(0, 3)]});
  g.step(cmd(press0), cmd(press0));for (let i = 1; i < 10; i++) g.step(cmd(held), cmd(held));
  g.step(cmd(), cmd());const ev = [];for (let i = 0; i < 40; i++) {g.step(cmd(), cmd());ev.push(...g.lastStepEvents);}
  assert.ok(ev.some(e => e.result === 'stoneClash'), 'PL igual: clash');
  assert.equal(pulses(g).length, 0);assert.equal(g.fighters[0].hp, 100);assert.equal(g.fighters[1].hp, 100);
});

test('defesa cancela a carga: stamina mantida e a recarga de 9 s continua (cooldownOnStart); nenhum projétil', () => {
  const g = arena();const f = g.fighters[0];
  charge(g, 30);g.step(cmd({...held, guard: true, guardPressed: true}), cmd());g.step(cmd({guard: true}), cmd());
  assert.ok(!f.charge, 'carga cancelada');assert.ok(f.stamina < f.stamina + 1 && f.moveCooldowns['water-pulse'] > 8.5, 'recarga mantida');
  assert.equal(pulses(g).length, 0);
});

test('M28.4: mexer no slider depois de apertar não muda aquela execução; a próxima usa o novo valor', () => {
  const g = arena();charge(g, 10);C.world.waterPulse.speed = 20;C.world.waterPulse.damagePl1 = 30;
  release(g);const p = pulses(g)[0];
  assert.ok(Math.abs(Math.hypot(p.vel.x, p.vel.z) - 14) < 1e-6 && Math.abs(p.hit.damage - 6) < 1e-9, 'instância guarda os valores do toque');
  const g2 = arena({setup: () => {C.world.waterPulse.speed = 20;}});charge(g2, 10);release(g2);
  assert.ok(Math.abs(Math.hypot(pulses(g2)[0].vel.x, pulses(g2)[0].vel.z) - 20) < 1e-6, 'o próximo uso usa 20 m/s');
});

test('determinismo: duas partidas idênticas terminam no mesmo estado; save/load (structuredClone) do mundo com o projétil no ar', () => {
  const play = () => {const g = fire(100);run(g, 40);return g;};
  const a = play(), b = play();assert.equal(fighterHash(a), fighterHash(b));
  assert.deepEqual(JSON.parse(JSON.stringify(a.world.entities)), JSON.parse(JSON.stringify(b.world.entities)));
  const cl = structuredClone(a.world);assert.equal(cl.entities.length, a.world.entities.length);
});

done();
