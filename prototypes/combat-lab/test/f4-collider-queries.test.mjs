// F4 (Task 6): ColliderQueries únicas. Equivalência EXATA com as implementações antigas (copiadas abaixo como oráculos congelados):
// vision.solidsOf/insideSolid/segmentClear, nav-graph collectSolids/insideSolid, map-step getGroundHeightAt e physics.groundSurface,
// sobre 2000 pontos/segmentos de seed fixa em mapas reais gerados (várias seeds + parede, rocha crescendo e destrutível quebrado).
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {closestOnShape} from '../src/sim/world/world-hit.js';
import {solidsOf, blockingSolids, pointInSolid, segmentClear, navSolidsOf, insideFootprint, groundSurface, groundHeightAt} from '../src/sim/collision/queries.js';
import {collectSolids} from '../src/nav/nav-graph.js';
import * as physics from '../src/sim/physics.js';

registerStandardMoves();

// ---------- Oráculos congelados (cópia literal do código anterior à F4) ----------
const oldVisionSolids = world => {
  const out = [];
  for (const e of world?.entities ?? []) if (!e.dead && e.kind === 'wall' && e.shape === 'box') out.push({shape: 'box', pos: e.pos, hx: e.hx, hz: e.hz, angle: e.angle ?? 0});
  const ms = world?.mapState;
  for (const o of ms?.obstacles ?? []) {
    const pos = {x: o.pos?.x ?? 0, z: o.pos?.z ?? 0};
    if (o.shape === 'cylinder' || o.shape === 'pillar') out.push({shape: 'circle', pos, radius: o.radius ?? 1});
    else out.push({shape: 'box', pos, hx: o.hx ?? 1.5, hz: o.hz ?? 1.5, angle: 0});
  }
  for (const d of ms?.destructibles ?? []) if (d.state === 'solid') out.push({shape: 'box', pos: {x: d.pos.x, z: d.pos.z}, hx: d.size?.hx ?? .8, hz: d.size?.hz ?? .8, angle: 0});
  return out;
};
const oldInsideSolid = (solids, p, margin = 0) => {for (const s of solids) if (closestOnShape(s, p).distance < margin) return true;return false;};
const oldSegmentClear = (solids, a, b, step = .2) => {
  if (!solids.length) return true;
  const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / step));
  for (let i = 1; i < n; i++) {const t = i / n;if (oldInsideSolid(solids, {x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t})) return false;}
  return true;
};
const oldCollectSolids = mapState => {
  const out = [];
  for (const p of mapState?.platforms ?? []) out.push({id: p.id, kind: 'platform', shape: 'box', x: p.pos ? p.pos.x : p.x, z: p.pos ? p.pos.z : p.z, hx: (p.width ?? 3) / 2, hz: (p.depth ?? 3) / 2, r: 0, base: 0, top: p.height});
  for (const o of mapState?.obstacles ?? []) {
    const base = o.pos?.y ?? 0, cyl = o.shape === 'cylinder' || o.shape === 'pillar';
    out.push({id: o.id, kind: 'obstacle', shape: cyl ? 'cyl' : 'box', x: o.pos.x, z: o.pos.z, hx: o.hx ?? o.radius ?? 1.5, hz: o.hz ?? o.radius ?? 1.5, r: o.radius ?? 1, base, top: base + (o.height ?? 1.5)});
  }
  for (const d of mapState?.destructibles ?? []) {
    if (d.state !== 'solid') continue;
    const base = d.pos?.y ?? 0;
    out.push({id: d.id, kind: 'destructible', shape: 'box', x: d.pos.x, z: d.pos.z, hx: d.size?.hx ?? .8, hz: d.size?.hz ?? .8, r: 0, base, top: base + (d.targetHeight ?? d.size?.height ?? 1.6)});
  }
  return out;
};
const oldNavInside = (s, x, z, pad = 0) => s.shape === 'cyl' ? Math.hypot(x - s.x, z - s.z) <= s.r + pad : Math.abs(x - s.x) <= s.hx + pad && Math.abs(z - s.z) <= s.hz + pad;
const oldGroundHeightAt = (x, z, mapState) => {
  let highest = 0;
  if (mapState.platforms) for (const p of mapState.platforms) {const hx = p.width / 2, hz = p.depth / 2;if (Math.abs(x - p.pos.x) <= hx && Math.abs(z - p.pos.z) <= hz) {if (p.height > highest) highest = p.height;}}
  if (mapState.obstacles) for (const o of mapState.obstacles) {
    const h = (o.pos?.y ?? 0) + o.height;
    if (o.shape === 'cylinder' || o.shape === 'pillar') {const dx = x - o.pos.x, dz = z - o.pos.z;if (dx * dx + dz * dz <= o.radius * o.radius) {if (h > highest) highest = h;}}
    else if (Math.abs(x - o.pos.x) <= o.hx && Math.abs(z - o.pos.z) <= o.hz) {if (h > highest) highest = h;}
  }
  if (mapState.destructibles) for (const d of mapState.destructibles) {
    if (d.state !== 'solid') continue;
    const h = (d.pos?.y ?? 0) + (d.size?.height ?? 1.6);
    if (Math.abs(x - d.pos.x) <= d.size.hx && Math.abs(z - d.pos.z) <= d.size.hz) {if (h > highest) highest = h;}
  }
  return highest;
};
const GROUND = {y: 0, kind: 'ground', id: null, normal: {x: 0, y: 1, z: 0}};
const oldGroundSurface = (pos, world, currentY = null) => {
  const mapState = world?.mapState;
  const platforms = mapState?.platforms ?? world?.platforms ?? C.map?.platforms, obstacles = mapState?.obstacles ?? world?.obstacles ?? C.map?.obstacles, destructibles = mapState?.destructibles ?? world?.destructibles;
  if (!platforms && !obstacles && !destructibles) return GROUND;
  let best = GROUND;
  const footMargin = (C.test?.halfExtent ?? 0.35) * 0.5, support = (C.map?.mountTolerance ?? 0.25) + 0.10;
  const consider = (h, kind, id) => {if ((currentY === null || currentY >= h - support) && h > best.y) best = {y: h, kind, id, normal: GROUND.normal};};
  if (platforms) for (const p of platforms) {
    const px = p.pos ? p.pos.x : p.x, pz = p.pos ? p.pos.z : p.z, hx = ((p.width ?? 3) / 2) + footMargin, hz = ((p.depth ?? 3) / 2) + footMargin;
    if (Math.abs(pos.x - px) <= hx && Math.abs(pos.z - pz) <= hz) consider(p.height, 'platform', p.id ?? null);
  }
  if (obstacles) for (const o of obstacles) {
    const ox = o.pos?.x ?? 0, oz = o.pos?.z ?? 0, h = (o.pos?.y ?? 0) + (o.height ?? 1.5);
    if (o.shape === 'cylinder' || o.shape === 'pillar') {const r = (o.radius ?? 1) + footMargin, dx = pos.x - ox, dz = pos.z - oz;if (dx * dx + dz * dz <= r * r) consider(h, 'obstacle', o.id ?? null);}
    else {const hx = (o.hx ?? 1.5) + footMargin, hz = (o.hz ?? 1.5) + footMargin;if (Math.abs(pos.x - ox) <= hx && Math.abs(pos.z - oz) <= hz) consider(h, 'obstacle', o.id ?? null);}
  }
  if (destructibles) for (const d of destructibles) {
    if (d.state !== 'solid') continue;
    const h = (d.pos?.y ?? 0) + (d.size?.height ?? 1.6), hx = (d.size?.hx ?? 0.8) + footMargin, hz = (d.size?.hz ?? 0.8) + footMargin;
    if (Math.abs(pos.x - d.pos.x) <= hx && Math.abs(pos.z - d.pos.z) <= hz) consider(h, 'destructible', d.id ?? null);
  }
  return best;
};

// ---------- Mapas reais ----------
const rng = seed => () => {seed = (seed + 0x6D2B79F5) >>> 0;let t = seed;t = Math.imul(t ^ (t >>> 15), t | 1);t ^= t + Math.imul(t ^ (t >>> 7), t | 61);return ((t ^ (t >>> 14)) >>> 0) / 4294967296;};
function maps() {
  const out = [];
  for (const seed of [1, 7, 42, 12345, 90210]) {
    resetConfig(defaults());
    const g = new Game({seed});g.start();
    out.push({name: `seed ${seed}`, g});
  }
  // Variante: parede (barreira), rocha crescendo (targetHeight), destrutível quebrado e obstáculo suspenso.
  resetConfig(defaults());
  const g = new Game({seed: 7});g.start();
  g.world.entities.push({id: 'w1', kind: 'wall', shape: 'box', pos: {x: 3, z: -2}, hx: 2, hz: .3, angle: .7, y: 0, height: 3, dead: false});
  g.world.entities.push({id: 'w2', kind: 'wall', shape: 'box', pos: {x: -5, z: 4}, hx: 1, hz: 1, angle: 0, y: 0, height: 3, dead: true});
  g.mapState.destructibles.push({id: 'rock', hp: 30, maxHp: 30, pos: {x: 1, y: 0, z: 6}, size: {hx: 1, hz: 1, height: .4}, targetHeight: 2.2, shape: 'box', angle: 0, state: 'solid'});
  g.mapState.destructibles.push({id: 'dead', hp: 0, maxHp: 30, pos: {x: -2, y: 0, z: -6}, size: {hx: .8, hz: .8, height: 1.6}, shape: 'box', angle: 0, state: 'dead'});
  g.mapState.obstacles.push({id: 'sus', shape: 'box', pos: {x: 0, y: 1.4, z: 0}, hx: 1.5, hz: 1.5, radius: 1.5, height: .5, angle: 0});
  out.push({name: 'variante', g});
  return out;
}
const N = 2000;

test('solidsOf/blockingSolids + pointInSolid + segmentClear = vision antigo (2000 pontos e segmentos por mapa)', () => {
  for (const {name, g} of maps()) {
    const rand = rng(1234), R = C.map.arenaRadius ?? 32.5, pt = () => ({x: (rand() * 2 - 1) * R * .8, z: (rand() * 2 - 1) * R * .8});
    const oldS = oldVisionSolids(g.world), newS = blockingSolids(g.world);
    assert.equal(newS.length, oldS.length, `${name}: nº de sólidos`);
    assert.deepEqual(solidsOf(g.world.mapState, g.world, {platforms: false, barriers: true}), newS, `${name}: blockingSolids = preset do solidsOf`);
    for (let i = 0; i < N; i++) {
      const p = pt(), m = [0, .02, .45, rand() * .8][i % 4];
      assert.equal(pointInSolid(p, newS, {margin: m}), oldInsideSolid(oldS, p, m), `${name}: ponto ${i}`);
      const a = pt(), b = rand() < .3 ? {x: a.x + rand() * 4 - 2, z: a.z + rand() * 4 - 2} : pt();
      assert.equal(segmentClear(a, b, newS), oldSegmentClear(oldS, a, b), `${name}: segmento ${i}`);
    }
    assert.equal(segmentClear({x: 0, z: 0}, {x: 9, z: 9}, []), true);
  }
});

test('navSolidsOf = collectSolids antigo (formato exato) e insideFootprint = insideSolid do nav-graph', () => {
  for (const {name, g} of maps()) {
    const rand = rng(99), R = C.map.arenaRadius ?? 32.5;
    const oldS = oldCollectSolids(g.mapState), newS = navSolidsOf(g.mapState);
    assert.deepEqual(newS, oldS, `${name}: sólidos do nav`);
    assert.deepEqual(collectSolids(g.mapState), oldS, `${name}: nav-graph usa a query`);
    for (let i = 0; i < N; i++) {
      const x = (rand() * 2 - 1) * R * .8, z = (rand() * 2 - 1) * R * .8, pad = [0, .62, -.4, rand()][i % 4];
      for (let k = 0; k < newS.length; k++) assert.equal(insideFootprint(newS[k], x, z, pad), oldNavInside(oldS[k], x, z, pad), `${name}: ponto ${i} sólido ${k}`);
    }
  }
});

test('groundHeightAt(…, {footMargin:0}) = getGroundHeightAt dos consumíveis; groundSurface idêntico', () => {
  for (const {name, g} of maps()) {
    const rand = rng(5), R = C.map.arenaRadius ?? 32.5;
    assert.equal(physics.groundSurface, groundSurface, 'physics reexporta a mesma função');
    for (let i = 0; i < N; i++) {
      const pos = {x: (rand() * 2 - 1) * R * .8, z: (rand() * 2 - 1) * R * .8};
      assert.equal(groundHeightAt(pos, {mapState: g.mapState}, {footMargin: 0}), oldGroundHeightAt(pos.x, pos.z, g.mapState), `${name}: consumível ${i}`);
      const cy = i % 3 === 0 ? null : rand() * 4;
      assert.deepEqual(groundSurface(pos, g.world, cy), oldGroundSurface(pos, g.world, cy), `${name}: superfície ${i}`);
      assert.equal(groundHeightAt(pos, g.world, {currentY: cy}), oldGroundSurface(pos, g.world, cy).y, `${name}: altura ${i}`);
      assert.equal(physics.getGroundHeight(pos, g.world, cy), oldGroundSurface(pos, g.world, cy).y);
    }
  }
});

test('Solid: forma única {shape, kind, id, pos, hx, hz, radius, angle, y0, y1, ref}', () => {
  const [{g}] = maps().slice(-1);
  const all = solidsOf(g.mapState, g.world, {barriers: true});
  for (const s of all) {
    assert.ok(s.shape === 'box' || s.shape === 'circle');
    assert.ok(['wall', 'platform', 'obstacle', 'destructible'].includes(s.kind));
    assert.ok(Number.isFinite(s.y0) && s.y1 >= s.y0 && s.ref);
  }
  assert.ok(all.some(s => s.kind === 'platform') && all.some(s => s.kind === 'wall'));
  assert.ok(!all.some(s => s.id === 'dead' || s.id === 'w2'), 'quebrado/morto não é sólido');
  assert.equal(solidsOf(g.mapState, g.world, {destructibles: false}).some(s => s.kind === 'destructible'), false);
  const sus = all.find(s => s.id === 'sus');
  assert.equal(pointInSolid({x: 0, z: 0}, [sus]), true);
  assert.equal(pointInSolid({x: 0, z: 0}, [sus], {y: .5}), false, 'y abaixo da base do obstáculo suspenso');
  assert.equal(pointInSolid({x: 0, z: 0}, [sus], {y: 1.6}), true);
});
