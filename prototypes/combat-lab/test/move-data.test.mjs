// Move como dado (fase 1): o formato do move.json, o carregador e o Sand Wave migrado.
// Uso: node prototypes/combat-lab/test/move-data.test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateMoveData, loadMoveData, MOVE_DATA_SCHEMA} from '../src/sim/moves/move-data.js';
import {removeMoveParams, moveParamGroups} from '../src/sim/moves/params-registry.js';
import {sandWaveDef, ficha} from '../src/sim/moves/sand-wave.js';
import {params, visual} from '../src/sim/moves/sand-wave.params.js';
import {factoryDefaults} from '../src/sim/config.js';

const here = new URL('../src/sim/moves/', import.meta.url);
const raw = JSON.parse(readFileSync(new URL('sand-wave.move.json', here), 'utf8'));
let n = 0;
const ok = (name, fn) => {try {fn();n++;console.log('  ✓ ' + name);} catch (e) {console.log('  ✗ ' + name + '\n' + e.message);process.exitCode = 1;}};
const clone = () => structuredClone(raw);

ok('o sand-wave.move.json é válido', () => assert.deepEqual(validateMoveData(raw), []));
ok('a definição do jogo é exatamente a do JSON (congelada)', () => {
  assert.deepEqual({...sandWaveDef}, raw.def);
  assert.ok(Object.isFrozen(sandWaveDef));
  assert.equal(ficha.def, sandWaveDef);
});
ok('os sliders e os padrões em C.world.sandWave vêm das linhas do JSON', () => {
  const w = factoryDefaults().world.sandWave;
  for (const r of raw.params.rows) if (r.key) assert.equal(w[r.key], r.value, `${r.key}: C.world.sandWave diferente do JSON`);
  assert.equal(params.group, raw.params.group);
  assert.equal(params.id, raw.def.id);
});
ok('custo, recarga e preparação da definição batem com os sliders (mesma fonte de verdade)', () => {
  const v = k => raw.params.rows.find(r => r.key === k).value;
  assert.equal(raw.def.cost, v('cost'));
  assert.equal(raw.def.cooldown, v('cooldown'));
  assert.equal(raw.def.duration, v('cast'));
});
ok('a referência de visual aponta para um arquivo aprovado do atelier que existe e combina', () => {
  assert.deepEqual(visual, raw.visual);
  const doc = JSON.parse(readFileSync(new URL(`../../../../sand-stone-lab/approved/${raw.visual.atelier}.json`, here), 'utf8'));
  assert.equal(doc.category, raw.visual.atelier);
  assert.equal(doc.variant, raw.visual.variant);
});
ok('a mudança de um valor no JSON chega à ficha (carregador de ida e volta)', () => {
  const d = clone();d.params.group = 'sandWaveTeste';d.params.rows.find(r => r.key === 'damage').value = 9;
  try {
    const l = loadMoveData(d);
    assert.equal(l.params.rows.find(r => r.key === 'damage').value, 9);
    assert.equal(l.def.id, 'sand-wave');
  } finally {removeMoveParams('sandWaveTeste');}
  assert.ok(moveParamGroups().some(g => g.group === 'sandWave'), 'o grupo real não pode sumir');
});
ok('JSON inválido é recusado com a lista dos problemas', () => {
  const cases = [
    [d => {d.schemaVersion = 2;}, 'schemaVersion'],
    [d => {d.extra = 1;}, 'campo desconhecido: extra'],
    [d => {delete d.def.name;}, 'def.name'],
    [d => {d.def.cost = 'caro';}, 'def.cost precisa ser número'],
    [d => {d.def.id = 'Sand Wave';}, 'kebab-case'],
    [d => {d.params.rows = [];}, 'params.rows'],
    [d => {delete d.params.rows[0].label;}, 'falta label'],
    [d => {d.params.rows.push({preset: 'nada'});}, 'preset desconhecido'],
    [d => {d.params.id = 'x';}, 'params.id não existe'],
    [d => {d.visual.cor = 'azul';}, 'visual.cor'],
  ];
  for (const [mut, msg] of cases) {const d = clone();mut(d);const bad = validateMoveData(d);assert.ok(bad.some(b => b.includes(msg)), `esperava "${msg}" em ${JSON.stringify(bad)}`);}
  assert.throws(() => loadMoveData({}), /move\.json inválido/);
});
ok(`esquema versão ${MOVE_DATA_SCHEMA}`, () => assert.equal(raw.schemaVersion, MOVE_DATA_SCHEMA));
console.log(`${n} verificações de Move como dado.`);
