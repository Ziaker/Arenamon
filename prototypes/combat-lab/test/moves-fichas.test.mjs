// @ts-check
// Fichas de Moves (um arquivo por Move): índice automático em dia, parâmetros declarados uma vez e usados em todo lugar, validação da ficha.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assert, C, suite, arena, factoryDefaults} from './moves-new-helpers.mjs';
import {renderIndex, renderParamsIndex} from '../gen-fichas.mjs';
import {FICHAS} from '../src/sim/moves/fichas.generated.js';
import {defineMoveParams, moveParamGroups, moveParamDefaults, standardRows, paramRow} from '../src/sim/moves/params-registry.js';
import {NEW_MOVES} from '../src/sim/moves/new-moves.js';
import {getMove} from '../src/sim/moves.js';
import {MOVES_PARAMS, MOVE_INFO} from '../src/ui/moves-panel.js';

const {test, done} = suite('FICHAS DE MOVES');

test('o índice gerado está em dia com os arquivos (rode npm run fichas se falhar)', () => {
  const current = readFileSync(new URL('../src/sim/moves/fichas.generated.js', import.meta.url), 'utf8');
  assert.equal(current, renderIndex(), 'fichas.generated.js desatualizado');
  assert.equal(readFileSync(new URL('../src/sim/moves/params.generated.js', import.meta.url), 'utf8'), renderParamsIndex(), 'params.generated.js desatualizado');
});
test('os parâmetros existem em C.world mesmo sem registrar nenhum Move (processo limpo: só config.js)', () => {
  const code = `import {C} from './src/sim/config.js';console.log(JSON.stringify(Object.keys(C.world.swift ?? {}).length + ',' + Object.keys(C.world.harden ?? {}).length + ',' + Object.keys(C.world.guardBreak ?? {}).length));`;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', code], {cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8'}).trim();
  const counts = JSON.parse(out).split(',').map(Number);
  assert.ok(counts.every(n => n > 5), 'grupos ausentes sem registrar Moves: ' + out);
});
test('toda ficha tem def e, se declara effect ou tackle, com função e é registrada junto dos Moves novos', () => {
  assert.ok(FICHAS.length >= 2);
  for (const f of FICHAS) {
    assert.ok(f.def?.id, 'def.id');for (const k of ['effect', 'tackle']) if (f[k] !== undefined) assert.ok(Array.isArray(f[k]) && typeof f[k][1] === 'function', `${f.def.id}: ${k} deve ser [nome, função]`);
    // Feint e Riposte são só definição: o comportamento está no controlador (como antes da ficha)
    if (!f.effect && !f.tackle) assert.ok(['feint', 'riposte'].includes(f.def.id), `${f.def.id}: sem effect nem tackle`);
    // Reflect e Psyshock (Moves padrão) também são fichas, mas standard.js os registra: não entram em NEW_MOVES e o grupo está em def.charge.group
    const padrao = ['reflect', 'psyshock'].includes(f.def.id);
    if (padrao) assert.ok(!NEW_MOVES.some(m => m.def === f.def), `${f.def.id} é Move padrão: não deve estar em NEW_MOVES`);
    else assert.ok(NEW_MOVES.some(m => m.def === f.def), `${f.def.id} fora de NEW_MOVES`);
    assert.ok(arena() && getMove(f.def.id), `${f.def.id} não registrado`);
    assert.equal(padrao ? f.def.charge.group : f.def.group, f.params.group, `${f.def.id}: o grupo da definição deve ser o grupo dos parâmetros`);
  }
});
test('os parâmetros da ficha viram o padrão em C.world, na fábrica e no formato do painel', () => {
  arena();
  for (const g of moveParamGroups()) {
    for (const r of g.rows) {
      assert.equal(C.world[g.group][r.key], r.value, `C.world.${g.group}.${r.key}`);
      assert.equal(factoryDefaults().world[g.group][r.key], r.value, `fábrica ${g.group}.${r.key}`);
    }
    const table = MOVES_PARAMS.find(([title]) => title === g.title);
    assert.ok(table, `${g.title} sem grupo no painel`);
    assert.deepEqual(table[1].map(r => r[1]), g.rows.map(r => r.key), `${g.title}: linhas do painel`);
    assert.equal(MOVE_INFO[g.id].group, g.title);
  }
  assert.deepEqual(Object.keys(moveParamDefaults()).sort(), moveParamGroups().map(g => g.group).sort());
});
test('a ficha recusa parâmetros inválidos com a causa', () => {
  const ok = standardRows({cost: 1, cooldown: 5, cast: .3});
  const bad = (rows, re) => assert.throws(() => defineMoveParams('_teste', {id: 'x', title: 'X', rows}), re);
  bad([...ok, ...ok], /repetida/);
  bad([paramRow({key: 'a', label: 'A', tip: 't', unit: 'furlongs', value: .5})], /unidade/);
  bad([paramRow({key: 'a', label: 'A', tip: 't', unit: 'num', min: 0, max: 1, value: 2})], /fora de/);
  bad([paramRow({key: 'a', label: '', tip: 't', unit: 'num', value: .5})], /rótulo/);
  bad([paramRow({key: 'a', label: 'A', tip: 't', unit: 'num', step: 0, value: .5})], /step/);
});

done();
