// @ts-check
// Fase 3 (Yuka): grafo de superfícies (caminhada, salto, queda), planejador e integração com a IA.
// A navegação é opcional (extras.nav.enableNav = 0 por padrão): desligada, nada muda no comportamento.
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {getNavGraph, clearNavCache, collectSolids} from '../src/nav/nav-graph.js';
import {NAV_SCENARIOS, NAV_SCENARIO_IDS, setupNavScenario, runNavScenario} from '../src/nav/nav-scenarios.js';

registerStandardMoves();
let passed = 0, failed = 0;
function test(name, fn) {try {fn();passed++;console.log(`  ✓ ${name}`);} catch (e) {failed++;console.error(`  ✗ ${name}: ${e.message}`);}}
const fresh = () => {resetConfig(defaults());clearNavCache();};
const sceneGraph = id => {fresh();const g = new Game({seed: 7});g.start();setupNavScenario(g, id);return {g, nav: getNavGraph(g.mapState)};};

console.log('\n--- FASE 3: NAVEGAÇÃO YUKA ---\n');

console.log('1. Grafo de superfícies');
test('grafo do muro tem nós de chão e arestas de caminhada, sem saltos', () => {
  const {nav} = sceneGraph('muro'), s = nav.stats();
  assert.ok(s.nodes > 500 && s.walk > 1000, JSON.stringify(s));
  assert.equal(s.jump, 0);
});
test('plataformas de 1,0 m e 1,5 m geram arestas explícitas de salto (chão→topo) e de queda (topo→chão)', () => {
  const {nav} = sceneGraph('plataforma'), s = nav.stats();
  assert.ok(s.jump > 0, 'sem arestas de salto');assert.ok(s.drop > 0, 'sem arestas de queda');
  const tops = new Set(nav.nodes.filter(n => n.surface !== 'ground').map(n => n.surface));
  assert.ok(tops.has('degrau') && tops.has('alta'));
});
test('bloco de 3,5 m (acima da altura do salto) NÃO tem aresta de subida', () => {
  const {nav} = sceneGraph('torre');
  const up = [...nav.edges.values()].filter(e => e.type === 'jump' && nav.nodes[e.to].surface === 'torre');
  assert.equal(up.length, 0);
  assert.ok(nav.nodes.some(n => n.surface === 'torre'), 'o topo existe como superfície, só não é alcançável por salto');
});
test('nenhum nó de chão fica dentro de um sólido ou da zona de folga', () => {
  const {g, nav} = sceneGraph('completo');
  for (const n of nav.nodes) if (n.surface === 'ground') assert.ok(!nav.blockedAt(n.x, n.z, 0), `nó dentro de sólido em ${n.x},${n.z}`);
  assert.ok(collectSolids(g.mapState).length > 0);
});
test('zona bloqueada de navegação remove nós e força desvio', () => {
  const {nav} = sceneGraph('rotas');
  assert.ok(nav.blockedAt(0, 0, 0), 'o centro está bloqueado');
  assert.ok(!nav.clearLine(0, 8, 0, -8, 0), 'a linha reta passa pela zona/muros');
});
test('grafo em cache: mesmo mapa reutiliza; destrutível quebrado reconstrói', () => {
  fresh();const g = new Game({seed: 7});g.start();setupNavScenario(g, 'muro');
  g.mapState.destructibles = [{id: 'd1', pos: {x: 5, y: 0, z: 5}, size: {hx: .8, hz: .8, height: 1.6}, state: 'solid'}];
  const a = getNavGraph(g.mapState), b = getNavGraph(g.mapState);
  assert.equal(a, b);
  g.mapState.destructibles[0].state = 'dead';
  assert.notEqual(getNavGraph(g.mapState), a, 'quebrar o destrutível muda o layout');
});

console.log('\n2. Cenários com a simulação real');
const outcomes = {};
for (const id of NAV_SCENARIO_IDS) {
  fresh();
  outcomes[id] = {legacy: runNavScenario(Game, id, {nav: 0, seconds: 30}), yuka: runNavScenario(Game, id, {nav: 1, seconds: 30})};
}
for (const id of ['muro', 'rotas', 'completo']) test(`${id}: a navegação atual falha e o Yuka chega ao alvo`, () => {
  assert.equal(outcomes[id].legacy.reachedAt, null, 'a navegação atual não deveria alcançar');
  assert.ok(outcomes[id].yuka.reachedAt !== null && outcomes[id].yuka.reachedAt < 15, `Yuka não chegou: ${JSON.stringify({...outcomes[id].yuka, trace: 0})}`);
});
test('corredor: caminho livre — o Yuka não interfere (mesmo resultado da navegação atual)', () => {
  const {legacy, yuka} = outcomes.corredor;
  assert.equal(yuka.reachedAt, legacy.reachedAt);assert.equal(yuka.pathLength, legacy.pathLength);assert.equal(yuka.plans, 0);
});
test('plataforma: o Yuka salta para alcançar o alvo elevado, a navegação atual ataca o vazio', () => {
  const {legacy, yuka} = outcomes.plataforma;
  assert.ok(yuka.reachedAt !== null && yuka.jumps >= 1, JSON.stringify({...yuka, trace: 0}));
  assert.equal(yuka.tacklesOutOfReach, 0);
  assert.ok(legacy.tacklesOutOfReach > 0, 'sem Yuka a IA tenta o tackle em altura incompatível');
});
test('torre: alvo inalcançável — sem ataque no vazio, sem insistir na parede, sem saltos inúteis', () => {
  const {yuka, legacy} = outcomes.torre;
  assert.equal(yuka.status, 'unreachable');assert.equal(yuka.tackles, 0);assert.equal(yuka.reachedAt, null);
  assert.ok(yuka.wallSeconds < 1, `empurrou a parede por ${yuka.wallSeconds}s`);
  assert.ok(legacy.tacklesOutOfReach > 0);
});
test('o Yuka reduz o tempo empurrando parede em todos os cenários com obstáculo', () => {
  for (const id of ['muro', 'rotas', 'completo']) assert.ok(outcomes[id].yuka.wallSeconds < outcomes[id].legacy.wallSeconds / 3, `${id}: ${outcomes[id].yuka.wallSeconds} vs ${outcomes[id].legacy.wallSeconds}`);
});

console.log('\n3. Determinismo e preservação');
test('duas execuções com a mesma semente produzem a mesma trilha', () => {
  fresh();const a = runNavScenario(Game, 'completo', {nav: 1, seconds: 20}), b = runNavScenario(Game, 'completo', {nav: 1, seconds: 20});
  assert.deepEqual(a.trace, b.trace);
});
test('desligado (padrão), a IA produz exatamente os mesmos comandos de antes (nada interfere)', () => {
  fresh();assert.equal(C.extras.nav.enableNav, 0);
  const run = () => {const g = new Game({seed: 3});g.start();g.mode = 'tactical';const out = [];for (let i = 0; i < 1500; i++) {g.step(emptyCommand());const c = g.lastCommands[1];out.push([c.move.x, c.move.z, c.tackle, c.jump]);}return JSON.stringify(out) + JSON.stringify(g.fighters.map(f => f.position));};
  assert.equal(run(), run());
  const g = new Game({seed: 3});g.start();for (let i = 0; i < 600; i++) g.step(emptyCommand());
  assert.equal(g.brain.nav, null, 'sem navegação ligada o planejador nem é criado');
});
test('ligado, partidas em arena aberta mantêm a IA atual (caminho direto, sem replanejar)', () => {
  fresh();C.extras.nav.enableNav = 1;
  const g = new Game({seed: 3});g.start();g.mapState.obstacles = [];g.mapState.platforms = [];g.mapState.destructibles = [];
  for (let i = 0; i < 1200; i++) g.step(emptyCommand());
  assert.equal(g.brain.nav?.plans ?? 0, 0);
});
test('estado do planejador é JSON puro: save/load da partida o preserva', () => {
  fresh();const g = new Game({seed: 7});g.start();C.extras.nav.enableNav = 1;setupNavScenario(g, 'muro');
  for (let i = 0; i < 300; i++) g.step(emptyCommand());
  const snap = g.save();assert.ok(Array.isArray(snap.brain.nav.path));
  const h = new Game({seed: 7});h.start();h.load(snap);
  assert.deepEqual(h.brain.nav, g.brain.nav);
});
test('cada cenário declara resultado esperado coerente com o medido', () => {
  for (const id of NAV_SCENARIO_IDS) {
    const exp = NAV_SCENARIOS[id].expect, y = outcomes[id].yuka;
    if (exp === 'reach') assert.ok(y.reachedAt !== null, `${id} deveria alcançar`); else assert.equal(y.reachedAt, null, `${id} não deveria alcançar`);
  }
});

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
