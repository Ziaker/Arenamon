import assert from 'node:assert/strict';
import {C, resetConfig} from '../src/sim/config.js';
import {collideMapFighter} from '../src/sim/map.js';
import {collideFighter} from '../src/sim/world.js';
import {toLocal, toWorld} from '../src/sim/geometry.js';

resetConfig();
const r = C.test.halfExtent;
const fighter = (position, extra = {}) => ({id: 0, hp: 100, position: {...position}, groundY: 0, vaultHeight: 0, velocity: {x: 4, z: 0}, locomotionVelocity: {x: 4, z: 0}, contacts: 0, ...extra});

{
  const p = {id: 'p', pos: {x: 0, y: 0, z: 0}, width: 3, depth: 3, height: 1.5};
  const f = fighter({x: -1.5 - r + .05, z: 0}, {flight: {y: .2, vy: 9, horizontal: {x: 4, z: 0}, isNormalJump: true}});
  collideMapFighter({platforms: [p], obstacles: [], destructibles: []}, f);
  assert.ok(f.position.x <= -1.5 - r + 1e-9, `a lateral continua sólida durante a subida (${f.position.x})`);
  assert.equal(f.velocity.x, 0);
}

{
  const box = {pos: {x: 2, y: 0, z: -1}, hx: 1.8, hz: .7, height: 2.2, angle: Math.PI / 4, shape: 'box'};
  const start = toWorld(box, box.hx + r - .08, 0), f = fighter(start, {velocity: {x: -3, z: 3}, locomotionVelocity: {x: -3, z: 3}});
  collideMapFighter({platforms: [], obstacles: [box], destructibles: []}, f);
  const local = toLocal(box, f.position);
  assert.ok(Math.abs(local.u - (box.hx + r)) < 1e-8, `o collider acompanha a rotação visual (${local.u})`);
}

{
  const wall = {id: 1, kind: 'wall', shape: 'box', pos: {x: 0, z: 0}, hx: 2, hz: 1, angle: Math.PI / 6, y: 0, height: 2, blocksFighters: true};
  const f = fighter({x: 0, z: 0}, {velocity: {x: 0, z: 4}, locomotionVelocity: {x: 0, z: 4}});
  collideFighter({entities: [wall]}, f);
  const local = toLocal(wall, f.position);
  assert.ok(Math.abs(Math.abs(local.u) - (wall.hx + r)) < 1e-8 || Math.abs(Math.abs(local.v) - (wall.hz + r)) < 1e-8, `centro expulso até uma face (${local.u}, ${local.v})`);
}

{
  const wall = {id: 1, kind: 'wall', shape: 'box', pos: {x: 0, z: 0}, hx: 2, hz: 1, angle: 0, y: 0, height: 1.2, blocksFighters: true};
  const f = fighter({x: 0, z: 0}, {groundY: 1.5});
  collideFighter({entities: [wall]}, f);
  assert.deepEqual(f.position, {x: 0, z: 0}, 'groundY participa da sobreposição vertical da hitbox');
}

console.log('✓ colisores: plataforma, caixas giradas, penetração profunda e groundY');
