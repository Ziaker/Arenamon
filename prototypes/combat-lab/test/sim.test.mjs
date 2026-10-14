// Testes da simulação em Node: cenários, determinismo, replay por estado e telemetria.
import assert from 'node:assert/strict';
import {Game} from '../src/sim/game.js';
import {C, resetConfig, defaults} from '../src/sim/config.js';
import {SCENARIOS, runScenario} from '../src/sim/scenarios.js';
import {Recorder, frameTable} from '../src/sim/telemetry.js';
import {ReplayBuffer} from '../src/sim/replay.js';
import {runBalance, balanceRows} from '../src/sim/balance.js';
let passed = 0;const test = (name, fn) => {fn();passed++;console.log('✓', name);};

for (const def of SCENARIOS) test(`cenário “${def.name}”`, () => {
  const r = runScenario(def);for (const c of r.checks) console.log(`   ${c.ok ? '·' : '✗'} ${c.label}: esperado ${c.expected} · obtido ${c.actual}`);
  assert.ok(r.ok, def.id);
});
test('cenários restauram a configuração (overrides temporários)', () => assert.equal(C.extras.toggles.enableVault, 1));
test('cenário repetido produz o mesmo resultado', () => {
  const a = runScenario(SCENARIOS[2]), b = runScenario(SCENARIOS[2]);assert.deepEqual(a.checks, b.checks);
});
function aiRun(seed, ticks, cut) {
  const g = new Game({seed});g.mode = 'random';g.reset();let saved = null;
  for (let t = 0; t < ticks; t++) {g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], 'combat', C.test.step));if (t === cut) saved = g.save();if (g.phase === 'result') g.reset();}
  return {g, saved};
}
test('IA aleatória determinística por semente', () => {
  const a = aiRun(7, 3000).g, b = aiRun(7, 3000).g, c = aiRun(8, 3000).g;
  assert.deepEqual(a.save(), b.save());assert.notDeepEqual(JSON.stringify(a.fighters), JSON.stringify(c.fighters));
});
test('replay por estado: restaurar e reexecutar reproduz o mesmo futuro', () => {
  const {g, saved} = aiRun(3, 1200, 600);const end = g.save();
  const h = new Game({seed: 3});h.mode = 'random';h.load(saved);
  for (let t = 601; t < 1200; t++) {h.step(h.playerBrain.command(h.fighters[0], h.fighters[1], 'combat', C.test.step));if (h.phase === 'result') h.reset();}
  assert.deepEqual(JSON.stringify(h.save()), JSON.stringify(end));
});
test('buffer de replay: limite, busca e ramificação', () => {
  const r = new ReplayBuffer(5);for (let i = 0; i < 8; i++) r.push(i);assert.equal(r.length, 5);assert.equal(r.current, 7);
  r.step(-2);assert.equal(r.current, 5);r.push(99);assert.deepEqual(r.frames, [3, 4, 5, 99]);assert.ok(r.atEnd);
});
test('telemetria: vantagem de quadros no bloqueio', () => {
  const r = runScenario(SCENARIOS[0]);const hit = r.recorder.hits.find(h => h.result === 'partial');
  assert.ok(hit, 'contato registrado');assert.ok(hit.advantage !== null, 'vantagem calculada');
  console.log(`   bloqueio: agir ${hit.attackerFree}/${hit.targetFree} passos (vantagem ${hit.advantage}); mover ${hit.attackerMove}/${hit.targetMove} (vantagem ${hit.moveAdvantage})`);
  assert.equal(hit.moveAdvantage, hit.attackerMove - hit.targetMove < 0 ? hit.targetMove - hit.attackerMove : hit.moveAdvantage);assert.ok(hit.attackerMove > hit.targetMove, 'recuo dura mais que o guard stun');
  assert.equal(r.recorder.actions.filter(a => a.fighter === 0 && a.kind === 'tackle').length, 1);
});
test('tabela de quadros reflete a configuração', () => {
  const before = frameTable()[0].total;C.actions.tackle.duration = .5;assert.equal(frameTable()[0].total, 60);assert.equal(frameTable()[1].total, 48);resetConfig();assert.equal(frameTable()[0].total, before);
  assert.deepEqual(JSON.parse(JSON.stringify(C)), JSON.parse(JSON.stringify(defaults())));
});
function aiDuel(seed, ticks = 120 * 60) {
  const g = new Game({seed});g.mode = 'combat';g.reset();const hits = [];
  for (let t = 0; t < ticks; t++) {g.step(g.playerBrain.command(g.fighters[0], g.fighters[1], 'combat', C.test.step));hits.push(...g.lastStepEvents.map(e => `${e.tick}:${e.attacker}:${e.result}`));if (g.phase === 'result') g.reset();}
  return hits;
}
test('personalidade: lutas variam por semente e se repetem com a mesma semente', () => {
  const a = aiDuel(11), b = aiDuel(11), c = aiDuel(12);assert.deepEqual(a, b);assert.notDeepEqual(a, c);
  console.log(`   semente 11: ${a.length} contatos · semente 12: ${c.length} contatos`);
});
test('personalidade: azul e vermelho decidem de forma diferente', () => {
  const hits = aiDuel(5), byBlue = hits.filter(h => h.split(':')[1] === '0').length;
  console.log(`   contatos iniciados: azul ${byBlue}, vermelho ${hits.length - byBlue}`);assert.notEqual(byBlue, hits.length - byBlue);
});
test('personalidade neutra reproduz o ritmo fixo do v6 (sem aleatoriedade)', () => {
  const saved = structuredClone([C.extras.aiRed, C.extras.aiBlue]);
  for (const k of ['aiRed', 'aiBlue']) Object.assign(C.extras[k], {reaction: 0, reactionJitter: 0, mistake: 0, aggression: .5, variation: 0, hesitation: 0});
  assert.deepEqual(aiDuel(1, 2400), aiDuel(99, 2400), 'sem aleatoriedade, a semente não muda nada');
  Object.assign(C.extras.aiRed, saved[0]);Object.assign(C.extras.aiBlue, saved[1]);
});
test('equilíbrio IA × IA: determinístico, consistente e sem alterar a configuração', () => {
  const before = JSON.stringify(C), a = runBalance({matches: 6, seed: 3}), b = runBalance({matches: 6, seed: 3});
  assert.deepEqual(a, b);assert.equal(JSON.stringify(C), before);
  assert.equal(a.sides[0].wins + a.sides[1].wins + a.timeouts, 6);assert.equal(balanceRows(a).length, 14);
  for (const s of a.sides) assert.ok(s.tackle > 0 && s.cancel <= s.tackle && s.damage >= 0);
  console.log(`   6 lutas: vitórias ${a.sides[0].wins}/${a.sides[1].wins}, ${a.timeouts} sem vencedor, média ${a.avgSeconds.toFixed(1)} s`);
});
console.log(`\n${passed} testes da simulação aprovados.`);
