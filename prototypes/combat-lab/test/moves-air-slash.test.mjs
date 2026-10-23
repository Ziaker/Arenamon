// @ts-check
// Air Slash (Burst · Projectile · PL1 fixo): protótipo de 23/10/2026 com os números do prompt de 22/10 (NÃO homologados) e as decisões provisórias da Rodada 1 (AS-P02 A: colisor =
// círculo equivalente de raio 0,6 m; EL-P04 A: empurrão do motor). Convenção: «passo N» = fim do N-ésimo passo = índice N−1 na chamada de Game.step. Valores de FÁBRICA.
import {assert, C, cmd, vec, suite, arena as arenaBase, run, fighterHash, HOLD} from './moves-new-helpers.mjs';
import {getMove} from '../src/sim/moves.js';
import {spawn} from '../src/sim/world.js';

const {test, done} = suite('AIR SLASH');
const arena = (o = {}) => arenaBase({equip: ['air-slash'], ...o});
const blades = g => g.world.entities.filter(e => e.kind === 'projectile' && e.visual === 'airslash' && !e.dead);
const press = {skill: 0, skillHeld: HOLD(0)};
/** Toca e roda até a lâmina nascer; devolve o índice do passo de nascimento (0 = passo do toque) ou −1. */
function spawnIndex(g, extra = {}, max = 60) {
  for (let i = 0; i < max; i++) {g.step(cmd(i === 0 ? {...press, ...extra} : {}), cmd());if (g.lastStepEvents.some(e => e.result === 'spawn' && e.kind === 'projectile')) return i;}
  return -1;
}

test('registrado: Burst, air cast, 0,8 de stamina, 6 s, ação de 28 passos (startup 8 + recovery 20); nada equipado por padrão', () => {
  const g = arenaBase();const d = getMove('air-slash');
  assert.ok(d && !d.charge && !d.aimMode && d.air === 'cast' && d.captureAim);
  assert.deepEqual([d.cost, d.cooldown], [.8, 6]);assert.equal(Math.round(d.duration * 120), 28);
  assert.ok(g.fighters.every(f => (f.loadout ?? []).every(x => !x)));
});

test('Burst: stamina e recarga no passo do toque (MV-P11); nenhuma lâmina nos passos [0,8); ela nasce no passo 8 (índice 7)', () => {
  const g = arena();const f = g.fighters[0], s0 = f.stamina;
  g.step(cmd(press), cmd());
  assert.ok(Math.abs(s0 - f.stamina - .8) < 1e-9, 'débito no passo 0');assert.ok(f.moveCooldowns['air-slash'] > 5.9);
  assert.equal(blades(g).length, 0);
  for (let i = 1; i < 7; i++) {g.step(cmd(), cmd());assert.equal(blades(g).length, 0, `sem hitbox no índice ${i}`);}
  g.step(cmd(), cmd());assert.equal(blades(g).length, 1, 'nasce no índice 7 = passo 8');
});

test('retorno ao controle: a ação termina no passo 28 (índice 27) e a lâmina continua independente', () => {
  const g = arena();const f = g.fighters[0];g.step(cmd(press), cmd());
  for (let i = 1; i < 27; i++) {g.step(cmd(), cmd());assert.ok(f.action, `ação viva no índice ${i}`);}
  g.step(cmd(), cmd());assert.ok(!f.action, 'ação encerrada no índice 27');assert.equal(blades(g).length, 1, 'lâmina segue viva');
});

test('lâmina: raio 0,6 m (colisor equivalente), 22 m/s, PL1, sem homing; dano 8 HP nominais e empurrão H 2,5 / V 0', () => {
  const g = arena({positions: [vec(0, -3), vec(10, -3)]});spawnIndex(g);const p = blades(g)[0];
  assert.equal(p.radius, .6);assert.equal(p.pl, 1);assert.equal(p.homing ?? null, null);assert.equal(p.pierce, 1);assert.equal(p.clashable, true);
  assert.ok(Math.abs(Math.hypot(p.vel.x, p.vel.z) - 22) < 1e-6);
  assert.ok(Math.abs(p.hit.damage - 8) < 1e-9);assert.deepEqual([p.hit.knockback.horizontal, p.hit.knockback.vertical], [2.5, 0]);
});

test('alcance 10 m: expira em ≈55 passos (lifetime = alcance ÷ velocidade; o 0,60 s do prompt nunca limita)', () => {
  const g = arena({positions: [vec(0, -3), vec(10, -3)]});spawnIndex(g);let n = 0;const z0 = blades(g)[0].pos.z;let z = z0;
  for (let i = 0; i < 100 && blades(g)[0]; i++) {z = blades(g)[0].pos.z;g.step(cmd(), cmd());n++;}
  assert.ok(n >= 53 && n <= 58, `passos ${n}`);assert.ok(z - z0 + 22 / 120 > 9.8 && z - z0 + 22 / 120 < 10.4, `distância ${(z - z0 + 22 / 120).toFixed(2)} m`);
});

test('acerto: 8 HP; empurrão de 1,5 × 2,5 = 3,75 m (V = 0)', () => {
  const g = arena({positions: [vec(0, -3), vec(0, 3)]});const red = g.fighters[1];
  run(g, 360, i => cmd(i === 0 ? press : {}));
  assert.equal(red.hp, 92);assert.ok(Math.abs(red.position.z - 3 - 3.75) < .3, `deslocamento ${(red.position.z - 3).toFixed(2)} m`);
});

test('colisor circular de 0,6 m: acerta quem está a 1,0 m do eixo e erra quem está a 1,3 m (corpo ±0,5)', () => {
  for (const [x, hits] of [[1, true], [1.3, false]]) {
    const g = arena({positions: [vec(0, -3), vec(x, 3)]});run(g, 150, i => cmd(i === 0 ? press : {}));
    assert.equal(g.fighters[1].hp === 92, hits, `alvo a ${x} m`);
  }
});

test('a mira NÃO persegue: o alvo travado é o do instante do toque (vertical e horizontal capturados na pressão)', () => {
  const g = arena({positions: [vec(0, -5), vec(0, 3)]});
  g.mapState.platforms = [{id: 'plat', pos: {x: 0, z: 3}, x: 0, z: 3, width: 3, depth: 3, height: 1}];g.fighters[1].groundY = 1;
  g.step(cmd({...press, target: 1}), cmd());
  g.fighters[1].groundY = 0;g.fighters[1].position = {x: 6, z: 3};   // o alvo sai depois do toque
  for (let i = 1; i < 12; i++) g.step(cmd(), cmd());
  const p = blades(g)[0];assert.ok(p, 'nasceu');assert.ok(p.vy > 0, `vertical capturado na pressão (vy ${p.vy?.toFixed(2)})`);assert.ok(Math.abs(p.vel.x) < 1e-6, 'direção horizontal sem seguir o alvo');
});

test('de uma plataforma: nasce na altitude do atirador (+0,8 m) e não morre nela', () => {
  const g = arena({positions: [vec(0, -3), vec(10, -3)]});
  g.mapState.platforms = [{id: 'plat', pos: {x: 0, z: -3}, x: 0, z: -3, width: 3, depth: 3, height: 1.5}];g.fighters[0].groundY = 1.5;
  spawnIndex(g);const p = blades(g)[0];assert.ok(p && Math.abs(p.y - 2.3) < 1e-9);
  let died = false;for (let i = 0; i < 20; i++) {g.step(cmd(), cmd());if (g.lastStepEvents.some(e => e.result === 'platformHit')) died = true;}
  assert.ok(!died);
});

test('parede: a lâmina para no sólido; sem espaço no ponto de nascimento o Burst é gasto sem efeito (sem lâmina, sem reembolso)', () => {
  const g = arena({positions: [vec(0, -3), vec(10, -3)]});spawn(g.world, {kind: 'wall', owner: 1, pos: {x: 0, z: 2}, hx: 3, hz: .3, y: 0, height: 2}, []);
  run(g, 120);assert.equal(blades(g).length, 0);
  const g2 = arena({positions: [vec(0, -3), vec(10, -3)]});spawn(g2.world, {kind: 'wall', owner: 1, pos: {x: 0, z: -2.3}, hx: 3, hz: .3, y: 0, height: 2}, []);
  const ev = [];g2.step(cmd(press), cmd());for (let i = 1; i < 20; i++) {g2.step(cmd(), cmd());ev.push(...g2.lastStepEvents);}
  assert.ok(ev.some(e => e.result === 'moveFailed' && e.reason === 'semEspaco') && blades(g2).length === 0);
  assert.ok(g2.fighters[0].stamina < 5.3 - .79, 'custo mantido');
});

test('Clash: duas lâminas PL1 de donos diferentes se destroem no encontro (nenhuma acerta)', () => {
  const g = arena({equipRed: ['air-slash'], positions: [vec(0, -3), vec(0, 3)]});let clash = false;
  for (let i = 0; i < 80; i++) {g.step(cmd(i === 0 ? press : {}), cmd(i === 0 ? press : {}));if (g.lastStepEvents.some(e => e.result === 'stoneClash')) clash = true;}
  assert.ok(clash, 'stoneClash');assert.equal(blades(g).length, 0);assert.equal(g.fighters[0].hp, 100);assert.equal(g.fighters[1].hp, 100);
});

test('alvo em esquiva (invulnerável): a lâmina é consumida sem dano (o contato com i-frames não a deixa atravessar)', () => {
  const g = arena({positions: [vec(0, -3), vec(0, 3)]});
  for (let i = 0; i < 80; i++) g.step(cmd(i === 0 ? press : {}), cmd(i >= 30 && i < 31 ? {dodge: true, move: vec(0, 0)} : {}));
  assert.equal(blades(g).length, 0);assert.ok(g.fighters[1].hp >= 92);
});

test('M28.4: sliders mexidos depois do toque não mudam a lâmina; startup configurável muda só os próximos usos', () => {
  const g = arena({positions: [vec(0, -3), vec(10, -3)]});g.step(cmd(press), cmd());C.world.airSlash.speed = 40;C.world.airSlash.damage = 30;
  for (let i = 1; i < 10; i++) g.step(cmd(), cmd());const p = blades(g)[0];
  assert.ok(Math.abs(Math.hypot(p.vel.x, p.vel.z) - 22) < 1e-6 && Math.abs(p.hit.damage - 8) < 1e-9);
  const g2 = arena({positions: [vec(0, -3), vec(10, -3)], setup: () => {C.world.airSlash.startup = 12 / 120;}});assert.equal(spawnIndex(g2), 11);
});

test('determinismo: duas partidas idênticas terminam no mesmo estado', () => {
  const play = () => {const g = arena({positions: [vec(0, -3), vec(0, 3)]});run(g, 200, i => cmd(i === 0 ? press : {}));return g;};
  assert.equal(fighterHash(play()), fighterHash(play()));
});

done();
