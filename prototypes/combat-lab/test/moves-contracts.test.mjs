// @ts-check
// Validador de contratos dos Moves (#08): casos negativos sintéticos + o registro real. Os conflitos conhecidos ficam EXPLÍCITOS abaixo,
// como decisão pendente do responsável (o teste não corrige valor nenhum); qualquer problema novo derruba o teste.
import {assert, C, suite, arena, resetConfig} from './moves-new-helpers.mjs';
import {defaults} from '../src/sim/config.js';
import {listMoves, validateMove, getTackleSetup} from '../src/sim/moves.js';
import {getEffect} from '../src/sim/move-effects.js';
import {MOVES_PARAMS} from '../src/ui/moves-panel.js';
import {checkMoveContracts, formatIssues} from '../src/sim/move-contracts.js';

const {test, done} = suite('CONTRATOS DOS MOVES');
const NL = '\n';
const rows = () => MOVES_PARAMS.flatMap(g => g[1]);
const realEnv = () => ({moves: listMoves(), world: C.world, rows: rows(), hasEffect: n => !!getEffect(n), hasTackleSetup: n => !!getTackleSetup(n), validateMove});

/** DECISÃO PENDENTE do responsável (plano de 23/10, #08): reportados, nunca corrigidos em silêncio. */
// Riposte (recuo 16,8 × slider 15; custo 0,8 × 1,55) decidido em 25/10/2026: slider até 17 e fábrica = 1,55.
const KNOWN = new Map([]);

test('registro real, fábrica: nenhum erro de contrato', () => {
  arena();
  const errors = checkMoveContracts(realEnv()).filter(i => i.severity === 'error');
  assert.deepEqual(errors, [], NL + formatIssues(errors));
});
test('registro real com a base de calibração do jogo: nenhum erro e só os conflitos conhecidos como aviso', () => {
  arena();resetConfig(defaults());   // os valores que o jogador realmente usa (calibração v8)
  const issues = checkMoveContracts(realEnv());
  const errors = issues.filter(i => i.severity === 'error');
  assert.deepEqual(errors, [], NL + formatIssues(errors));
  const unknown = issues.filter(i => !KNOWN.has(`${i.id}|${i.field}`));
  assert.deepEqual(unknown, [], 'conflito novo (decida ou registre em KNOWN):' + NL + formatIssues(unknown));
  for (const k of KNOWN.keys()) assert.ok(issues.some(i => `${i.id}|${i.field}` === k), `conflito conhecido já resolvido: tire ${k} de KNOWN`);
});
test('todo grupo de Move do registro tem linhas no painel (inclui os 4 elementais)', () => {
  arena();
  const titles = new Set(rows().map(r => r[0]));
  for (const m of listMoves()) if (m.group) assert.ok(titles.has(m.group), `${m.id}: grupo ${m.group} sem sliders`);
  for (const g of ['waterPulse', 'fireSpin', 'airSlash', 'seedBomb']) assert.ok(titles.has(g), g);
});
test('RED sintético: grupo inexistente, efeito e tackle não registrados', () => {
  arena();
  const bad = {id: 'teste-ruim', name: 'Ruim', group: 'naoExiste', duration: .3, timeline: [{at: .1, effect: 'efeito-que-nao-existe'}], tackle: 'setup-que-nao-existe'};
  const issues = checkMoveContracts({...realEnv(), moves: [bad]});
  assert.ok(issues.some(i => i.field === 'group' && /não existe em C\.world/.test(i.message)));
  const noGroup = checkMoveContracts({...realEnv(), moves: [{...bad, group: undefined}]});
  assert.ok(noGroup.some(i => i.field === 'timeline[0].effect'), 'efeito ausente por campo');
  assert.ok(noGroup.some(i => i.field === 'tackle'), 'tackle ausente por campo');
});
test('RED sintético: parâmetro sem slider, slider órfão e padrão fora da faixa', () => {
  arena();
  const world = {...C.world, tmp: {cost: 1, extra: 3, alvo: 50}};
  const rows2 = [['tmp', 'cost', 'Custo', 'x', 0, 5, .1, v => v, false], ['tmp', 'alvo', 'Alvo', 'x', 0, 10, 1, v => v, false], ['tmp', 'fantasma', 'F', 'x', 0, 1, .1, v => v, false]];
  const issues = checkMoveContracts({...realEnv(), world, rows: rows2, moves: [{id: 'tmp-move', name: 'T', group: 'tmp', duration: .3}]});
  const has = (field, re) => issues.some(i => i.field === field && re.test(i.message));
  assert.ok(has('tmp.extra', /sem controle/), 'parâmetro sem slider');
  assert.ok(has('tmp.fantasma', /não existe/), 'slider órfão');
  assert.ok(has('tmp.alvo', /fora do slider/), 'padrão fora da faixa');
});
test('definição inválida chega ao relatório com a causa do validateMove', () => {
  arena();
  const issues = checkMoveContracts({...realEnv(), moves: [{id: 'sem-duracao', name: 'S'}]});
  assert.ok(issues.some(i => i.severity === 'error' && /duration/.test(i.message)), formatIssues(issues));
});

done();
