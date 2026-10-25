// Editor de Moves (fase 2): o cenário do palco roda o Move de verdade e os sliders de mecânica mudam o resultado.
// Uso: node prototypes/combat-lab/test/move-editor.test.mjs
import assert from 'node:assert/strict';
import {runScenario} from '../src/sim/scenarios.js';
import {C, resetConfig, defaults} from '../src/sim/config.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {EDITABLE_MOVES, editableMove} from '../src/editor/editable-moves.js';
import {makeMoveScenario, currentMoveJson, observeSeconds, DISTANCE_RANGE} from '../src/editor/move-editor-model.js';
import {validateMoveData} from '../src/sim/moves/move-data.js';

registerStandardMoves();
const sand = editableMove('sand-wave');
let n = 0;
const ok = (name, fn) => {try {fn();n++;console.log('  ✓ ' + name);} catch (e) {console.log('  ✗ ' + name + '\n' + (e.stack || e.message).split('\n').slice(0, 4).join('\n'));process.exitCode = 1;}};
const run = stage => { resetConfig(defaults()); return runScenario(makeMoveScenario(sand, stage)); };
const val = (r, label) => r.checks.find(c => c.label === label).actual;

ok('o Sand Wave está na lista de Moves editáveis', () => { assert.ok(sand); assert.equal(EDITABLE_MOVES.length, 1); assert.equal(sand.group, 'sandWave'); });
ok('executar com o alvo perto: acerta, causa o dano do slider e cega', () => {
  const r = run({distance: 3});
  assert.equal(val(r, 'Acertou o alvo').startsWith('sim'), true);
  assert.equal(val(r, 'Dano causado ao alvo'), `${C.world.sandWave.damage.toFixed(1)} HP`);
  assert.equal(val(r, 'Cegueira aplicada'), 'sim');
});
ok('executar com o alvo fora do alcance: não acerta', () => {
  const r = run({distance: 12});
  assert.equal(val(r, 'Acertou o alvo'), 'não');
  assert.equal(val(r, 'Dano causado ao alvo'), '0.0 HP');
});
ok('mudar o slider de dano muda o resultado do play', () => {
  resetConfig(defaults());C.world.sandWave.damage = 15;
  const r = runScenario(makeMoveScenario(sand, {distance: 3}));
  assert.equal(val(r, 'Dano causado ao alvo'), '15.0 HP');
});
ok('mudar o alcance (length) deixa o mesmo alvo de fora', () => {
  resetConfig(defaults());C.world.sandWave.length = 1.5;
  const r = runScenario(makeMoveScenario(sand, {distance: 3}));
  assert.equal(val(r, 'Acertou o alvo'), 'não');
});
ok('o custo de stamina e a recarga aparecem', () => {
  const r = run({distance: 3});
  assert.equal(val(r, 'Custo de stamina do Move'), '2.00');
  assert.ok(parseFloat(val(r, 'Stamina líquida gasta pelo azul (com a regeneração)')) > 1.5);
  assert.ok(parseFloat(val(r, 'Recarga restante do Move (azul)')) > 0);
});
ok('a distância é limitada à faixa do palco', () => {
  const s = makeMoveScenario(sand, {distance: 99});
  assert.equal(s.positions[1].z - s.positions[0].z, DISTANCE_RANGE.max);
});
ok('o tempo observado cobre preparação + janela ativa + dissipação', () => {
  resetConfig(defaults());
  assert.ok(observeSeconds(sand) >= C.world.sandWave.cast + C.world.sandWave.active + C.world.sandWave.dissipate);
});
ok('o move.json exportado é válido e carrega os valores atuais dos sliders', () => {
  resetConfig(defaults());C.world.sandWave.damage = 11;C.world.sandWave.cooldown = 7;
  const doc = currentMoveJson(sand);
  assert.deepEqual(validateMoveData(doc), []);
  assert.equal(doc.params.rows.find(r => r.key === 'damage').value, 11);
  assert.equal(doc.def.cooldown, 7);
  resetConfig(defaults());
});
console.log(`${n} verificações do Editor de Moves.`);
