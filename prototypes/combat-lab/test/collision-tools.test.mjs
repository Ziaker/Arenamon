// Fase 7 do overhaul — ferramentas visuais de colisão (src/view/collision-overlays.js) sem navegador: usam uma «view» falsa que só anota o que foi desenhado.
// Garantem que cada sobreposição desenha o que promete (e nada quando desligada) e que o painel «Dados ao vivo» traz apoio, último contato, vãos e penetrações.
// Uso: node prototypes/combat-lab/test/collision-tools.test.mjs
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {resetCollisionProbe} from '../src/sim/collision-probe.js';
import {COLLISION_OVERLAYS, drawCollisionOverlays, collisionRows, solidPairs, groundPenetration} from '../src/view/collision-overlays.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
let tests = 0;const failures = [];
const check = (name, fn) => {try {resetConfig(defaults());resetCollisionProbe();fn();tests++;console.log('✓', name);} catch (error) {failures.push(name);console.log('✗', name, '—', String(error.message).split(/\r?\n/)[0]);}};
const fakeView = () => {const v = {lines: [], rings: [], line(p, color, o) {v.lines.push({p, color, o});}, ring(x, z, r, color, a, b, y) {v.rings.push({x, z, r, color, y});}};return v;};
const keys = COLLISION_OVERLAYS.map(o => o[0]);
const off = () => Object.fromEntries(keys.map(k => [k, false]));
const lab = (map = {}) => {
  C.extras.toggles.enableEnemyAI = 0;
  const g = new Game();g.reset({positions: [vec(0, 0), vec(-20, -20)]});g.mode = 'inactive';
  Object.assign(g.mapState, {platforms: [], obstacles: [], destructibles: [], items: [], regularSpawnTimer: 1e9, ...map});
  return g;
};
const draw = (g, which) => {const v = fakeView();drawCollisionOverlays(v, g.fighters, g.world, {...off(), ...which});return v;};

check('5 sobreposições, com chave, rótulo e descrição; desligadas não desenham nada', () => {
  assert.equal(COLLISION_OVERLAYS.length, 5);
  for (const [k, label, desc] of COLLISION_OVERLAYS) assert.ok(k && label && desc.length > 40, k);
  const g = lab({platforms: [{id: 'p', pos: {x: 0, y: 0, z: 4}, width: 3, depth: 3, height: 1}]});
  const v = draw(g, {});assert.equal(v.lines.length + v.rings.length, 0);
});
check('Colisores do cenário: plataforma, pilar, caixa e destrutível (e a prévia) viram contornos com a altura real', () => {
  const g = lab({
    platforms: [{id: 'p', pos: {x: 0, y: 0, z: 4}, width: 3, depth: 3, height: 1.5}],
    obstacles: [{id: 'c', shape: 'pillar', pos: {x: 8, y: 0, z: 0}, hx: .9, hz: .9, radius: .9, height: 4.5, angle: 0}, {id: 'b', shape: 'box', pos: {x: -8, y: 0, z: 0}, hx: 1.5, hz: 1, radius: 1.5, height: 2.2, angle: 0}],
    destructibles: [{id: 'd', hp: 30, maxHp: 30, pos: {x: 0, y: 0, z: -8}, size: {hx: .8, hz: .8, height: 1.6}, shape: 'box', angle: 0, state: 'solid'}, {id: 'g', hp: 30, maxHp: 30, pos: {x: 3, y: 0, z: -8}, size: {hx: .8, hz: .8, height: 1.6}, shape: 'box', angle: 0, state: 'ghost'}],
  });
  const v = draw(g, {mapSolids: true}), tops = new Set(v.lines.flatMap(l => l.p.map(q => +q[1].toFixed(2))));
  for (const h of [1.5, 4.5, 2.2, 1.6]) assert.ok(tops.has(h), `sem contorno na altura ${h}`);
  assert.ok(v.rings.length >= 2 && v.lines.length >= 3 * 3 + 6, `${v.lines.length} linhas`);
});
check('Apoio atual: anel na altura da superfície (plataforma) e linha dos pés; em voo, linha até a superfície abaixo', () => {
  const g = lab({platforms: [{id: 'p', pos: {x: 0, y: 0, z: 0}, width: 3, depth: 3, height: 1}]});
  g.fighters[0].groundY = 1;for (let i = 0; i < 3; i++) g.step(emptyCommand(), emptyCommand());
  let v = draw(g, {support: true});assert.ok(v.rings.some(r => Math.abs(r.y - 1.02) < 1e-9 && r.color === 0x6fe28a), 'anel de plataforma');
  const f = g.fighters[0];f.flight = {y: 2.5, vy: 0, horizontal: vec(0, 0)};
  v = draw(g, {support: true});assert.ok(v.lines.some(l => l.p[0][1] === 2.5 && Math.abs(l.p[1][1] - 1.02) < 1e-9), 'linha dos pés até a superfície');
});
check('Contatos com o ambiente: seta de normal, barra de profundidade e setas de velocidade antes/depois aparecem depois do toque e somem com o tempo', () => {
  const g = lab({obstacles: [{id: 'pi', shape: 'pillar', pos: {x: 0, y: 0, z: 5}, hx: .9, hz: .9, radius: .9, height: 4.5, angle: 0}]});
  const f = g.fighters[0];f.flight = {y: .01, vy: 12, horizontal: vec(0, 12)};f.launchedByHit = true;f.state = 'airborne';
  for (let i = 0; i < 100; i++) g.step(emptyCommand(), emptyCommand());
  const v = draw(g, {envContacts: true});
  for (const c of [0x73caff, 0xff4a4a, 0xffffff, 0x5dff9a]) assert.ok(v.lines.some(l => l.color === c), `sem linha ${c.toString(16)}`);
  for (let i = 0; i < 300; i++) g.step(emptyCommand(), emptyCommand());
  assert.equal(draw(g, {envContacts: true}).lines.length, 0, 'o registro não expirou');
});
check('Sobreposições e vãos: par de sólidos com vão < mínimo (laranja) ou sobrepostos (vermelho); lutador penetrando ganha anel', () => {
  const g = lab({obstacles: [{id: 'a', shape: 'box', pos: {x: 0, y: 0, z: 10}, hx: 1.5, hz: 1.5, radius: 1.5, height: 2, angle: 0}, {id: 'b', shape: 'box', pos: {x: 3.6, y: 0, z: 10}, hx: 1.5, hz: 1.5, radius: 1.5, height: 2, angle: 0}, {id: 'c', shape: 'box', pos: {x: 1, y: 0, z: 12}, hx: 1.5, hz: 1.5, radius: 1.5, height: 2, angle: 0}]});
  const pairs = solidPairs(g.mapState);assert.ok(pairs.some(p => p.gap < 0) && pairs.some(p => p.gap >= 0 && p.gap < C.map.passageClearance));
  const v = draw(g, {overlaps: true});assert.ok(v.lines.some(l => l.color === 0xff4a4a) && v.lines.some(l => l.color === 0xffa040));
  g.fighters[0].position = vec(0, 9.2);assert.ok(groundPenetration(g.mapState, g.fighters[0]) > 0.1);
  assert.ok(draw(g, {overlaps: true}).rings.some(r => r.color === 0xff4a4a && r.r === .7));
});
check('Dados ao vivo: apoio, último contato, objetos do cenário e penetração', () => {
  const g = lab({platforms: [{id: 'p', pos: {x: 0, y: 0, z: 0}, width: 3, depth: 3, height: 1}]});
  g.fighters[0].groundY = 1;for (let i = 0; i < 3; i++) g.step(emptyCommand(), emptyCommand());
  const rows = Object.fromEntries(collisionRows(g));
  assert.match(rows['Azul · apoio'], /^platform p a 1\.00 m/);assert.equal(rows['Azul · último contato'], '—');
  assert.match(rows['Objetos do cenário'], /0 par\(es\)/);assert.equal(rows['Penetração em sólidos'], 'nenhuma');
  g.fighters[0].groundY = 0;g.fighters[0].position = vec(1.2, 0);assert.match(Object.fromEntries(collisionRows(g))['Penetração em sólidos'], /Azul \d+\.\d cm/);
});

console.log(`Ferramentas visuais de colisão: ${tests} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) process.exit(1);
