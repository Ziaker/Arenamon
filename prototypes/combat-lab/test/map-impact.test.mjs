// Fase 5 — colisão ambiental de arremessado com destrutível (R3.7, R7.15): os números que estavam fixos no código viram parâmetros do laboratório
// com os MESMOS padrões (nenhuma mudança de comportamento): dano ao objeto = velocidade horizontal relativa × 6, dano ao lutador = × 2,5, e só vale
// acima de 1 m/s. Uso: node prototypes/combat-lab/test/map-impact.test.mjs
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {vec} from '../src/sim/math.js';
import {collideMapFighter} from '../src/sim/map.js';
import {NAMES, SECTIONS} from '../src/ui/tuning-meta.js';

let tests = 0;const failures = [];
const check = (name, fn) => {try {resetConfig(defaults());fn();tests++;console.log('✓', name);} catch (error) {failures.push(name);console.log('✗', name, '—', String(error.message).split(/\r?\n/)[0]);}};
const mkMap = () => ({platforms: [], obstacles: [], items: [], destructibles: [{id: 'd', hp: 300, maxHp: 300, pos: {x: 0, y: 0, z: 0}, size: {hx: 1, hz: 1, height: 1.6}, shape: 'box', angle: 0, state: 'solid', respawnTimer: 0, resistances: {physical: 1, projectile: 1, area: 1, environment: 1}}], destructibleStats: {broken: 0, respawned: 0}, items0: 0});
const thrown = speed => ({id: 0, position: vec(1.3, 0), velocity: vec(-speed, 0), locomotionVelocity: vec(), flight: {y: 0, vy: -1, horizontal: vec(-speed, 0)}, vaultHeight: 0, groundY: 0, contacts: 0, action: null, hp: 100, shield: 0, stages: {}, statuses: [], launchedByHit: true, attributes: {...C.profiles.balanced}});

check('parâmetros expostos no painel com os padrões atuais (6, 2,5 e 1 m/s)', () => {
  assert.equal(C.map.impactDamageToObject, 6);assert.equal(C.map.impactDamageToFighter, 2.5);assert.equal(C.map.impactMinSpeed, 1);
  for (const k of ['impactDamageToObject', 'impactDamageToFighter', 'impactMinSpeed']) {
    assert.ok(NAMES[k], `${k} sem rótulo`);assert.ok(SECTIONS.some(s => Array.isArray(s[2]) && s[2].includes(k)), `${k} fora do painel`);
  }
});
check('padrão: arremessado a 8 m/s causa 48 ao objeto e 20 a si (proporcional à velocidade horizontal relativa) e perde o impulso', () => {
  const ms = mkMap(), f = thrown(8), events = [];
  collideMapFighter(ms, f, events);
  assert.equal(ms.destructibles[0].hp, 300 - 48);
  assert.ok(events.some(e => e.result === 'destructibleSplat' && Math.abs(e.damage - 20) < 1e-9), JSON.stringify(events.map(e => e.result)));
  assert.deepEqual(f.flight.horizontal, {x: 0, z: 0});
});
check('proporcionalidade: dobrar a velocidade dobra o dano ao objeto', () => {
  const a = mkMap(), b = mkMap();collideMapFighter(a, thrown(4), []);collideMapFighter(b, thrown(8), []);
  assert.ok(Math.abs((300 - b.destructibles[0].hp) - 2 * (300 - a.destructibles[0].hp)) < 1e-9);
});
check('os parâmetros mandam: coeficientes e velocidade mínima do painel mudam o resultado', () => {
  C.map.impactDamageToObject = 10;C.map.impactDamageToFighter = 1;
  const ms = mkMap(), f = thrown(8), events = [];collideMapFighter(ms, f, events);
  assert.equal(ms.destructibles[0].hp, 300 - 80);
  assert.ok(events.some(e => e.result === 'destructibleSplat' && Math.abs(e.damage - 8) < 1e-9));
  C.map.impactMinSpeed = 9;
  const ms2 = mkMap(), f2 = thrown(8);collideMapFighter(ms2, f2, []);
  assert.equal(ms2.destructibles[0].hp, 300, 'abaixo da velocidade mínima não há dano');
});
check('abaixo de 1 m/s não há dano nem splat (limiar padrão)', () => {
  const ms = mkMap(), events = [];collideMapFighter(ms, thrown(.9), events);
  assert.equal(ms.destructibles[0].hp, 300);assert.ok(!events.some(e => e.result === 'destructibleSplat'));
});
check('salto voluntário e locomoção contra destrutível: sem dano (R7.15 só vale para arremessado)', () => {
  const ms = mkMap(), j = thrown(8);j.launchedByHit = false;j.flight.isNormalJump = true;collideMapFighter(ms, j, []);
  const l = thrown(8);l.flight = null;l.velocity = vec(-8, 0);collideMapFighter(ms, l, []);
  assert.equal(ms.destructibles[0].hp, 300);
});

console.log(`Impacto ambiental em destrutíveis: ${tests} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) process.exit(1);
