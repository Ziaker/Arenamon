// @ts-check
// Replay de referência (#12, tarefa 3 do plano de 23/10/2026): gravações guardadas em test/replays/referencia-*.json rodam de novo e precisam
// reproduzir o mesmo estado, tick a tick. Se uma regra mudar, o teste aponta o primeiro tick e o grupo/campo que divergiu.
// Atualizar uma referência é decisão explícita: `node prototypes/combat-lab/test/replay-referencia.test.mjs --atualizar`.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assert, C, suite, arena} from './moves-new-helpers.mjs';
import {expandScript, recordReference, compareReference} from '../src/sim/replay-referencia.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'replays');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^referencia-.*\.json$/.test(f)).sort() : [];
const prep = () => {arena();C.extras.toggles.enableEnemyAI = 1;};

if (process.argv.includes('--atualizar')) {
  for (const f of files) {
    const ref = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    prep();
    fs.writeFileSync(path.join(dir, f), JSON.stringify(recordReference(ref), null, 1) + '\n');
    console.log('referência atualizada: ' + f);
  }
  process.exit(0);
}

const {test, done} = suite('REPLAY DE REFERÊNCIA');

test('existem as 3 referências (Tackle, Quick Attack, Reflect) com estados guardados', () => {
  assert.deepEqual(files, ['referencia-quick-attack.json', 'referencia-reflect.json', 'referencia-tackle.json']);
  for (const f of files) {
    const ref = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    assert.ok(ref.expected?.hashes?.length > 100, f + ': sem hashes guardados');
    assert.ok(Object.keys(ref.expected.checkpoints).length >= 3, f + ': sem estados normalizados em intervalos');
  }
});
for (const f of files) {
  const ref = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  test(`${f}: reproduz a referência tick a tick`, () => {
    prep();
    const r = compareReference(ref);
    assert.equal(r.ok, true, r.ok ? '' : `primeiro tick divergente ${r.tick}, ${r.group}${r.field ? ' → ' + r.field : ''}: esperado ${JSON.stringify(r.expected)}, obtido ${JSON.stringify(r.got)}`);
  });
}
test('MUTAÇÃO: mudar uma regra faz o teste apontar o tick e o grupo', () => {
  if (!files.length) throw new Error('sem referências');
  const ref = JSON.parse(fs.readFileSync(path.join(dir, 'referencia-tackle.json'), 'utf8'));
  prep();
  const r = compareReference(ref, {values: {'actions.tackle.cost': C.actions.tackle.cost + .5}});
  assert.equal(r.ok, false);
  if (!r.ok) {assert.ok(r.tick <= 5, 'tick ' + r.tick);assert.match(r.group, /^fighter/);}
});
test('MUTAÇÃO: empurrar o azul no meio acusa o tick exato, com o campo quando há estado guardado', () => {
  const ref = JSON.parse(fs.readFileSync(path.join(dir, 'referencia-tackle.json'), 'utf8'));
  const at = Number(Object.keys(ref.expected.checkpoints)[1]);
  prep();
  const r = compareReference(ref, {mutate: (t, g) => {if (t === at - 1) g.fighters[0].position.x += .01;}});
  assert.equal(r.ok, false);
  if (!r.ok) {assert.equal(r.tick, at);assert.equal(r.group, 'fighter0');assert.match(String(r.field), /^fighters\.0\.x/);}
});
test('a configuração é restaurada e o roteiro expande em um comando por tick', () => {
  prep();
  const ref = JSON.parse(fs.readFileSync(path.join(dir, 'referencia-tackle.json'), 'utf8')), cost = C.actions.tackle.cost;
  compareReference(ref, {values: {'actions.tackle.cost': 9}});
  assert.equal(C.actions.tackle.cost, cost);
  assert.equal(expandScript(ref.script, ref.ticks).length, ref.ticks);
});

done();
