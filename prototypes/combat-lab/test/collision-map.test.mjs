// Fase 1 do overhaul de colisões — lutador × obstáculos do mapa (map.collideMapFighter): depenetração sem pontos mortos.
// Origem: reprodução da Fase 0 sobre 4634ca2 (cilindro/pilar com o centro do lutador exatamente no centro do obstáculo
// não empurrava ninguém: o `d > 1e-6` descartava o contato e o lutador ficava preso dentro do sólido).
// Uso: node prototypes/combat-lab/test/collision-map.test.mjs
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {vec, length} from '../src/sim/math.js';
import {collideMapFighter} from '../src/sim/map.js';

resetConfig(defaults());
const r = C.test.halfExtent;
const fighter = p => ({id: 0, position: {...p}, velocity: vec(), locomotionVelocity: vec(), flight: null, vaultHeight: 0, groundY: 0, contacts: 0, action: null});
const world = obstacles => ({obstacles, platforms: [], destructibles: []});
let tests = 0;const failures = [];
const check = (name, fn) => {try {fn();tests++;console.log('✓', name);} catch (error) {failures.push(name);console.log('✗', name, '—', String(error.message).split(/\r?\n/)[0]);}};

for (const shape of ['cylinder', 'pillar']) {
  const o = {shape, pos: {x: 2, y: 0, z: -1}, radius: 1, height: 3};
  for (const [label, start] of [['exatamente no centro', vec(2, -1)], ['a 1e-7 do centro', vec(2 + 1e-7, -1)], ['dentro, perto da borda', vec(2.9, -1)]]) {
    check(`${shape}: lutador ${label} sai em uma chamada, até r + raio do centro`, () => {
      const f = fighter(start);
      collideMapFighter(world([o]), f, []);
      const d = Math.hypot(f.position.x - o.pos.x, f.position.z - o.pos.z);
      assert.ok(d >= o.radius + r - 1e-9, `ainda dentro: distância ${d.toFixed(4)} < ${(o.radius + r).toFixed(4)}`);
      assert.ok(Number.isFinite(f.position.x) && Number.isFinite(f.position.z));
      assert.equal(f.contacts, 1);
      const again = fighter(f.position);collideMapFighter(world([o]), again, []);
      assert.equal(again.contacts, 0, 'segunda chamada não pode mover de novo (jitter)');
    });
  }
}
check('cilindro: contato normal fora do centro continua empurrando radialmente e preservando a tangente', () => {
  const o = {shape: 'cylinder', pos: {x: 0, y: 0, z: 0}, radius: 1, height: 3}, f = fighter(vec(1.2, 0));
  f.velocity = vec(-2, 3);
  collideMapFighter(world([o]), f, []);
  assert.ok(Math.abs(f.position.x - (1 + r)) < 1e-9 && Math.abs(f.position.z) < 1e-9);
  // Só a componente que viola o contato é removida (como nas caixas): a tangente (z) fica intacta.
  assert.ok(Math.abs(f.velocity.x) < 1e-9, `velocidade para dentro do pilar ficou ${f.velocity.x}`);
  assert.ok(Math.abs(f.velocity.z - 3) < 1e-9);
});
check('cilindro: afastando-se do pilar a velocidade não é alterada', () => {
  const o = {shape: 'cylinder', pos: {x: 0, y: 0, z: 0}, radius: 1, height: 3}, f = fighter(vec(1.2, 0));
  f.velocity = vec(2, 1);
  collideMapFighter(world([o]), f, []);
  assert.deepEqual(f.velocity, vec(2, 1));
});
// ---------- Resposta física DIFERENCIADA por estado (R3.12, R3.7, R7.15; decisão do responsável de 21/10/2026) ----------
const pillar = () => ({shape: 'pillar', pos: {x: 0, y: 0, z: 0}, radius: 1, height: 3});
check('locomoção: remove só a componente que entra no pilar e preserva a tangente (sem rebote)', () => {
  const f = fighter(vec(1.2, 0));f.velocity = vec(-2, 3);
  collideMapFighter(world([pillar()]), f, []);
  assert.ok(Math.abs(f.velocity.x) < 1e-9 && Math.abs(f.velocity.z - 3) < 1e-9, JSON.stringify(f.velocity));
});
check('locomoção: o contato registra a normal da superfície para o controlador deslizar (sem travar)', () => {
  const f = fighter(vec(1.2, 0));f.velocity = vec(-2, 3);
  collideMapFighter(world([pillar()]), f, []);
  assert.equal(f.surfaceNormals.length, 1);
  assert.ok(Math.abs(f.surfaceNormals[0].x - 1) < 1e-12 && Math.abs(f.surfaceNormals[0].z) < 1e-12 && f.surfaceNormals[0].age === 0);
});
check('arremesso contra indestrutível (R3.12): rebote especular pelo ângulo, intensidade pela restituição, tangente preservada', () => {
  const f = fighter(vec(1.2, 0));f.flight = {y: 0, vy: -1, horizontal: vec(-5, 2)};f.launchedByHit = true;f.velocity = vec(-5, 2);
  const k = C.rules.wallRestitution * (C.map?.wallBounceMultiplier ?? 1);
  collideMapFighter(world([pillar()]), f, []);
  assert.ok(Math.abs(f.flight.horizontal.x - 5 * k) < 1e-9, `normal refletida: ${f.flight.horizontal.x} (esperado ${5 * k})`);
  assert.ok(Math.abs(f.flight.horizontal.z - 2) < 1e-9, 'tangente preservada');
  assert.deepEqual(f.velocity, f.flight.horizontal, 'a velocidade do voo segue o rebote nos subpassos restantes');
  assert.ok(Math.hypot(f.flight.horizontal.x, f.flight.horizontal.z) < Math.hypot(-5, 2), 'nunca ganha energia');
  assert.equal(f.surfaceNormals?.length ?? 0, 0, 'arremesso não alimenta o deslize da locomoção');
});
check('voos que NÃO são arremesso por golpe (queda de borda, Move Bounce) não rebatem: mantêm a própria velocidade', () => {
  for (const [name, flight] of [['queda de borda', {y: 0, vy: -1, horizontal: vec(-5, 2), isEdgeFall: true}], ['Move Bounce', {y: 0, vy: -1, horizontal: vec(-5, 2), bounce: {recovery: .3}}]]) {
    const f = fighter(vec(1.2, 0));f.flight = flight;f.velocity = vec(-5, 2);
    collideMapFighter(world([pillar()]), f, []);
    assert.deepEqual(f.flight.horizontal, vec(-5, 2), name);
    assert.ok(Math.abs(f.position.x - (1 + r)) < 1e-9, name);
  }
});
check('restituição máxima aceita (multiplicador 3 × 0,28 = 0,84 < 1): o arremesso nunca ganha energia', () => {
  C.map.wallBounceMultiplier = 3;
  const f = fighter(vec(1.2, 0));f.flight = {y: 0, vy: -1, horizontal: vec(-5, 2)};f.launchedByHit = true;
  collideMapFighter(world([pillar()]), f, []);
  assert.ok(Math.hypot(f.flight.horizontal.x, f.flight.horizontal.z) < Math.hypot(-5, 2));
});
check('arremesso afastando-se do pilar não é alterado', () => {
  const f = fighter(vec(1.2, 0));f.flight = {y: 0, vy: -1, horizontal: vec(5, 2)};f.launchedByHit = true;
  collideMapFighter(world([pillar()]), f, []);
  assert.deepEqual(f.flight.horizontal, vec(5, 2));
});
check('rebote desligado (enableWallBounce = 0): o arremesso apenas perde a parte que entra', () => {
  C.extras.toggles.enableWallBounce = 0;
  const f = fighter(vec(1.2, 0));f.flight = {y: 0, vy: -1, horizontal: vec(-5, 2)};f.launchedByHit = true;f.velocity = vec(-5, 2);
  collideMapFighter(world([pillar()]), f, []);
  assert.ok(Math.abs(f.flight.horizontal.x) < 1e-9 && Math.abs(f.flight.horizontal.z - 2) < 1e-9);
});
check('salto voluntário (isNormalJump) mantém flight.horizontal intacta; só a posição é corrigida', () => {
  const f = fighter(vec(1.2, 0));f.flight = {y: 0, vy: -1, horizontal: vec(-5, 2), isNormalJump: true};
  collideMapFighter(world([pillar()]), f, []);
  assert.deepEqual(f.flight.horizontal, vec(-5, 2));
  assert.ok(Math.abs(f.position.x - (1 + r)) < 1e-9);
});
check('ação especial (tackle/esquiva em curso): a velocidade da ação NÃO é alterada pelo pilar; só a posição', () => {
  for (const kind of ['tackle', 'dodge']) {
    const f = fighter(vec(1.2, 0));f.action = {kind, heading: Math.PI / 2, elapsed: .1};f.velocity = vec(-6, 1);
    collideMapFighter(world([pillar()]), f, []);
    assert.deepEqual(f.velocity, vec(-6, 1), kind);
    assert.ok(Math.abs(f.position.x - (1 + r)) < 1e-9, kind);
    assert.equal(f.surfaceNormals?.length ?? 0, 0, kind);
  }
});
check('pilar: lutador acima do topo (apoiado sobre ele) não sofre empurrão lateral', () => {
  const o = {shape: 'pillar', pos: {x: 0, y: 0, z: 0}, radius: 1, height: 1}, f = fighter(vec(.3, 0));
  f.groundY = 1;
  collideMapFighter(world([o]), f, []);
  assert.deepEqual(f.position, vec(.3, 0));
  assert.equal(f.contacts, 0);
});
check('pilar: centro exato resolve sempre na mesma direção (determinístico, compatível com o código anterior: +z)', () => {
  const o = {shape: 'cylinder', pos: {x: 0, y: 0, z: 0}, radius: 1, height: 3}, f = fighter(vec(0, 0));
  collideMapFighter(world([o]), f, []);
  assert.ok(Math.abs(f.position.x) < 1e-12 && Math.abs(f.position.z - (1 + r)) < 1e-9, JSON.stringify(f.position));
});

console.log(`Colisões de obstáculos do mapa: ${tests} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) process.exit(1);
