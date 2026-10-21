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
check('cilindro: lançado (não é salto) perde só a parte horizontal que entra no pilar', () => {
  const o = {shape: 'pillar', pos: {x: 0, y: 0, z: 0}, radius: 1, height: 3}, f = fighter(vec(1.2, 0));
  f.flight = {y: 0, vy: -1, horizontal: vec(-5, 2)};
  collideMapFighter(world([o]), f, []);
  assert.ok(Math.abs(f.flight.horizontal.x) < 1e-9 && Math.abs(f.flight.horizontal.z - 2) < 1e-9, JSON.stringify(f.flight.horizontal));
});

console.log(`Colisões de obstáculos do mapa: ${tests} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) process.exit(1);
