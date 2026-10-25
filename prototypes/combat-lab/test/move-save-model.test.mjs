// Modelo da gravação do Editor de Moves: o novo documento parte do arquivo do disco e só muda o que mudou. Salvar sem editar = mesmo arquivo.
// Uso: node prototypes/combat-lab/test/move-save-model.test.mjs
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {factoryDefaults} from '../src/sim/config.js';
import {loadMoveData, validateMoveData} from '../src/sim/moves/move-data.js';
import {removeMoveParams} from '../src/sim/moves/params-registry.js';
import {diffDocs, buildMoveDoc, buildVisualDoc, describeDiffs, labelFor} from '../src/editor/move-save-model.js';

const movesDir = new URL('../src/sim/moves/', import.meta.url), approvedDir = new URL('../../sand-stone-lab/approved/', import.meta.url);
const files = readdirSync(movesDir).filter(f => f.endsWith('.move.json'));
const disk = Object.fromEntries(files.map(f => [f.replace('.move.json', ''), JSON.parse(readFileSync(new URL(f, movesDir), 'utf8'))]));
let n = 0;const ok = (name, fn) => {try {fn();n++;console.log('  ✓ ' + name);} catch (e) {console.log('  ✗ ' + name + '\n' + (e.stack || e.message).split('\n').slice(0, 5).join('\n'));process.exitCode = 1;}};
const world = () => structuredClone(factoryDefaults().world);
/** Carrega o documento como o jogo carregaria (num grupo de teste, para não mexer no registro real). */
const loads = doc => {const d = structuredClone(doc);d.params.group = '_teste';try {return loadMoveData(d);} finally {removeMoveParams('_teste');}};

ok(`salvar SEM editar produz exatamente o mesmo arquivo nos ${files.length} Moves (ida e volta)`, () => {
  assert.ok(files.length >= 19);
  const w = world();
  for (const [id, doc] of Object.entries(disk)) assert.deepEqual(buildMoveDoc(doc, w[doc.params.group]), doc, id);
});
ok('mudar um slider altera só o valor dele (e o custo/recarga/preparação levam a definição junto)', () => {
  const w = world(), g = w.sandWave;g.damage = 11;
  let doc = buildMoveDoc(disk['sand-wave'], g);
  assert.deepEqual(diffDocs(disk['sand-wave'], doc).map(d => d.path), ['params.rows[damage].value']);
  g.cost = 3;g.cooldown = 7;g.cast = 0.5;
  doc = buildMoveDoc(disk['sand-wave'], g);
  assert.deepEqual(diffDocs(disk['sand-wave'], doc).map(d => d.path).sort(), ['def.cooldown', 'def.cost', 'def.duration', 'params.rows[cast].value', 'params.rows[cooldown].value', 'params.rows[cost].value', 'params.rows[damage].value'].sort());
  assert.equal(doc.def.duration, 0.5);
});
ok('a definição só acompanha o slider quando o slider mudou (def e sliders podem divergir de propósito)', () => {
  const w = world(), g = w.waterPulse;
  const doc = buildMoveDoc(disk['water-pulse'], g);
  assert.deepEqual(doc.def, disk['water-pulse'].def);
});
ok('valor acima do limite do arquivo (os sliders do editor são ampliados): o limite do arquivo cresce e o jogo ainda carrega', () => {
  const w = world(), g = w.reflect;g.durationBase = 15;g.burstForce = 12;
  const doc = buildMoveDoc(disk.reflect, g);
  const rows = Object.fromEntries(doc.params.rows.filter(r => r.key).map(r => [r.key, r]));
  assert.equal(rows.durationBase.value, 15);assert.ok(rows.durationBase.max >= 15, 'max ' + rows.durationBase.max);
  assert.equal(rows.burstForce.value, 12);assert.ok(rows.burstForce.max >= 12);
  const diffs = describeDiffs(disk.reflect, doc);
  assert.ok(diffs.some(d => d.path === 'params.rows[durationBase].max'), 'o limite ampliado aparece no diálogo');
  assert.deepEqual(validateMoveData(doc), []);
  assert.doesNotThrow(() => loads(doc));
});
ok('qualquer slider de qualquer Move no limite DOBRADO continua gerando um arquivo que o jogo carrega', () => {
  const w = world();
  for (const [id, doc] of Object.entries(disk)) {
    const g = w[doc.params.group];
    for (const r of doc.params.rows) if (r.key && typeof g[r.key] === 'number' && r.unit !== 'yesno') g[r.key] = r.max * 2;
    const next = buildMoveDoc(doc, g);
    assert.deepEqual(validateMoveData(next), [], id);
    assert.doesNotThrow(() => loads(next), id);
    for (const r of doc.params.rows) if (r.key && typeof g[r.key] === 'number') g[r.key] = r.value;
  }
});
ok('tremor de hit: com os padrões o preset fica; mexeu em algum valor, vira linhas explícitas e o jogo carrega', () => {
  const w = world(), g = w.sandWave;
  assert.ok(buildMoveDoc(disk['sand-wave'], g).params.rows.some(r => r.preset === 'hitShake'));
  g.hitShakeOn = 1;g.hitShakeAmount = 2;
  const doc = buildMoveDoc(disk['sand-wave'], g);
  assert.ok(!doc.params.rows.some(r => r.preset));
  const shake = Object.fromEntries(doc.params.rows.filter(r => String(r.key).startsWith('hitShake')).map(r => [r.key, r.value]));
  assert.deepEqual(shake, {hitShakeOn: 1, hitShakeAmount: 2, hitShakeDuration: 1});
  assert.equal(loads(doc).params.rows.find(r => r.key === 'hitShakeAmount').value, 2);
});
ok('Reflect/Psyshock: as linhas explícitas de tremor e o selo «aprovado» são preservados', () => {
  const w = world(), g = w.reflect;g.widthMin = 2;
  const doc = buildMoveDoc(disk.reflect, g);
  assert.deepEqual(diffDocs(disk.reflect, doc).map(d => d.path), ['params.rows[widthMin].value']);
  assert.equal(doc.params.rows.find(r => r.key === 'widthMin').approved, true);
});
ok('visual aprovado: junta o atual sobre o arquivo e mantém o que o arquivo tinha', () => {
  const sand = JSON.parse(readFileSync(new URL('sand.json', approvedDir), 'utf8'));
  const next = buildVisualDoc(sand, {...sand.visualParameters, density: 3});
  assert.deepEqual(diffDocs(sand, next).map(d => d.path), ['visualParameters.density']);
  const psy = JSON.parse(readFileSync(new URL('psyshock.json', approvedDir), 'utf8'));
  const keys = Object.keys(psy.visualParameters);
  assert.deepEqual(Object.keys(buildVisualDoc(psy, {}).visualParameters), keys, 'sem mudança: mesmas chaves (não inventa campos)');
  assert.deepEqual(buildVisualDoc(psy, psy.visualParameters), psy);
});
ok('diffDocs compara linhas por chave, ignora igualdade e rotula os caminhos', () => {
  const a = {params: {rows: [{key: 'x', label: 'Alcance', value: 1}, {key: 'y', label: 'Largura', value: 2}]}};
  const b = {params: {rows: [{key: 'x', label: 'Alcance', value: 1}, {key: 'y', label: 'Largura', value: 5}]}};
  assert.deepEqual(diffDocs(a, a), []);
  assert.deepEqual(diffDocs(a, b), [{path: 'params.rows[y].value', from: 2, to: 5}]);
  assert.equal(labelFor('params.rows[y].value', b), 'Largura · valor');
  assert.equal(labelFor('def.cost', b), 'Definição · cost');
  const d = describeDiffs(a, b)[0];
  assert.deepEqual([d.label, d.from, d.to], ['Largura · valor', '2', '5']);
});
console.log(`${n} verificações do modelo de gravação.`);
