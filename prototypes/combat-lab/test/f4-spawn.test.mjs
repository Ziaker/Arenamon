// F4 (Task 7): spawn validado com recusa determinística. Nada do mapa (obstáculo, destrutível, consumível) nasce dentro de sólido ou colado
// em lutador: reamostra na espiral (anéis já usados + 2) e, sem posição, RECUSA com motivo (mapState.spawnLog na geração, evento spawnRejected
// durante a partida). Lutador nunca é recusado: posição sorteada só se válida, senão a válida mais próxima da arena inteira.
// Oráculo: test/fixtures/f4-spawn-base.json, gravado no commit base 3fb7a64 (5 configs × 50 seeds): layout que era válido não muda nada.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {createMapState, stepMap, generateFighterSpawnPositions} from '../src/sim/map.js';
import {isValidSpawnPosition, placeOrReject} from '../src/sim/map/map-spawn.js';

const BASE = JSON.parse(fs.readFileSync(new URL('./fixtures/f4-spawn-base.json', import.meta.url), 'utf8'));
const H = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const layout = g => JSON.stringify({f: g.fighters.map(f => f.position), p: g.mapState.platforms, o: g.mapState.obstacles, d: g.mapState.destructibles, i: g.mapState.items, rng: g.mapState.rngState});
const CROWD = {obstacleCount: 80, destructibleCount: 80, itemInitialCount: 40};   // além do que cabe: força muitas recusas (teto do log)
const game = (cfg, seed) => {resetConfig(defaults());Object.assign(C.map, cfg);const g = new Game({seed});g.start();return g;};
/** Revalida na ordem de colocação (o que já existia quando cada um nasceu); devolve a lista de inválidos. */
const invalids = g => {
  const ms = g.mapState, f = g.fighters, part = {platforms: ms.platforms, obstacles: [], destructibles: []}, bad = [];
  for (const o of ms.obstacles) {if (!isValidSpawnPosition(o.pos, 2.0, part, f, 5, o.shape === 'box' ? {hx: o.hx, hz: o.hz} : {r: o.radius})) bad.push(o.id);part.obstacles.push(o);}
  for (const d of ms.destructibles) {if (!isValidSpawnPosition(d.pos, 1.2, part, f, 5, {hx: .8, hz: .8})) bad.push(d.id);part.destructibles.push(d);}
  for (const it of ms.items) if (!isValidSpawnPosition(it.pos, 1.0, part, f, 5)) bad.push('item ' + it.id);
  return bad;
};

test('oráculo do commit base: todo layout que já era válido (5 configs × 50 seeds) sai idêntico, e a RNG termina no mesmo estado em TODAS as seeds', () => {
  let same = 0;
  for (const [name, cfg] of Object.entries(BASE.configs)) BASE.seeds[name].forEach(([hash, rng], i) => {
    const g = game(cfg, i + 1);
    assert.equal(g.mapState.rngState, rng, `${name} seed ${i + 1}: RNG divergiu (a recusa não pode pular nem gastar sorteios)`);
    if (hash) {assert.equal(H(layout(g)), hash, `${name} seed ${i + 1}: layout válido mudou`);same++;}
  });
  assert.ok(same >= 4 * 50 - 10, `só ${same} layouts comparados`);
});

test('mapa lotado (28+28+10, 40+40+20, 80+80+40): nada nasce sobreposto a sólido ou lutador; toda recusa fica registrada com motivo', () => {
  for (const [cfg, n] of [[BASE.configs.media, 50], [BASE.configs.lotada, 50], [CROWD, 10]]) for (let seed = 1; seed <= n; seed++) {
    const g = game(cfg, seed), ms = g.mapState, name = JSON.stringify(cfg);
    assert.deepEqual(invalids(g), [], `${name} seed ${seed}`);
    const missing = (cfg.obstacleCount - ms.obstacles.length) + (cfg.destructibleCount - ms.destructibles.length) + (cfg.itemInitialCount - ms.items.length);
    assert.ok(Array.isArray(ms.spawnLog), 'spawnLog ausente');
    assert.equal(ms.spawnLog.length, Math.min(32, missing), `${name} seed ${seed}: ${missing} recusas, log com ${ms.spawnLog.length}`);
    assert.equal(ms.placementConflicts, (cfg.obstacleCount - ms.obstacles.length) + (cfg.destructibleCount - ms.destructibles.length), 'sólido recusado conta em placementConflicts');
    for (const e of ms.spawnLog) {
      assert.equal(e.tick, 0);assert.ok(['obstacle', 'destructible', 'item'].includes(e.kind), e.kind);
      assert.match(e.reason, /^(outsideArena|nearFighter|overlapsPlatform|overlapsObstacle|overlapsDestructible|passageClearance)$/, e.reason);
    }
  }
  const g = game(CROWD, 3);assert.equal(g.mapState.spawnLog.length, 32, 'mantém só as últimas 32');assert.ok(g.mapState.placementConflicts > 32);
});

test('mesma seed = mesmo resultado (layout e spawnLog)', () => {
  for (const seed of [1, 7, 42]) {
    const a = game(CROWD, seed), b = game(CROWD, seed);
    assert.equal(layout(a), layout(b));assert.deepEqual(a.mapState.spawnLog, b.mapState.spawnLog);
  }
});

test('placeOrReject: posição válida passa; sem espaço devolve {rejected: motivo} sem consumir RNG', () => {
  resetConfig(defaults());
  const ms = createMapState(5);
  assert.deepEqual(placeOrReject({x: 0, y: 0, z: 0}, 1.0, ms, []), {pos: {x: 0, y: 0, z: 0}});
  ms.obstacles = [{id: 'big', pos: {x: 0, y: 0, z: 0}, shape: 'cylinder', radius: 40, hx: 40, hz: 40, height: 3}];
  const rng = ms.rngState, r = placeOrReject({x: 3, y: 0, z: 0}, 1.0, ms, []);
  assert.deepEqual(r, {rejected: 'overlapsObstacle'});assert.equal(ms.rngState, rng);
});

test('durante a partida: consumível e destrutível sem posição emitem spawnRejected {kind, reason, position} e entram no spawnLog com o tick', () => {
  resetConfig(defaults());
  const ms = createMapState(9);
  ms.obstacles = [{id: 'big', pos: {x: 0, y: 0, z: 0}, shape: 'cylinder', radius: 40, hx: 40, hz: 40, height: 3}];
  ms.regularSpawnTimer = 0.001;
  const d = {id: 'dest_1', hp: 0, maxHp: 30, pos: {x: 5, y: 0, z: 5}, size: {hx: .8, hz: .8, height: 1.6}, shape: 'box', angle: 0, state: 'dead', respawnTimer: 1.0, ghostTimer: 0, resistances: {}};
  ms.destructibles = [d];
  const events = [];
  stepMap(ms, 1 / 120, [], events, 77);
  const rej = events.filter(e => e.result === 'spawnRejected');
  assert.deepEqual(rej.map(e => e.kind).sort(), ['destructible', 'item']);
  for (const e of rej) {assert.equal(e.reason, 'overlapsObstacle');assert.ok(Number.isFinite(e.position.x) && Number.isFinite(e.position.y) && Number.isFinite(e.position.z));}
  assert.equal(ms.items.length, 0);assert.equal(d.state, 'dead');
  assert.deepEqual(ms.spawnLog.map(e => [e.tick, e.kind]).sort(), [[77, 'destructible'], [77, 'item']]);
});

test('spawnLog sobrevive a save/load e zera no reset', () => {
  const g = game(CROWD, 4);
  const log = structuredClone(g.mapState.spawnLog);assert.ok(log.length > 0);
  const s = g.save();g.mapState.spawnLog = [];g.load(s);
  assert.deepEqual(g.mapState.spawnLog, log);
  resetConfig(defaults());g.reset();assert.deepEqual(g.mapState.spawnLog, []);
});

test('lutador nunca é recusado: se sorteio e fallback forem inválidos, vai para o ponto válido mais próximo da arena inteira', () => {
  resetConfig(defaults());
  const ms = createMapState(11);
  ms.obstacles = [{id: 'big', pos: {x: 0, y: 0, z: 0}, shape: 'cylinder', radius: 20, hx: 20, hz: 20, height: 3}];   // cobre o anel de sorteio, a espiral e o fallback (0, ±8)
  const [p0, p1] = generateFighterSpawnPositions(ms);
  assert.ok(isValidSpawnPosition({x: p0.x, z: p0.z}, 1.0, ms, []), `p0 inválido ${JSON.stringify(p0)}`);
  assert.ok(isValidSpawnPosition({x: p1.x, z: p1.z}, 1.0, ms, [{position: p0}]), `p1 inválido ${JSON.stringify(p1)}`);
  const ms2 = createMapState(11);ms2.obstacles = structuredClone(ms.obstacles);
  assert.deepEqual(generateFighterSpawnPositions(ms2), [p0, p1], 'determinístico');
});
