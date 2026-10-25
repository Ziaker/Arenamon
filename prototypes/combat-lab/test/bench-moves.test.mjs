// @ts-check
// Benchmark da simulação com carga de Moves (#15): estrutura do relatório e honestidade do que NÃO mede. Sem limiar de tempo (varia por máquina).
import {assert, suite} from './moves-new-helpers.mjs';
import {runBench, toMarkdown, SCENARIOS} from '../bench-moves.mjs';

const {test, done} = suite('BENCHMARK DA SIMULAÇÃO COM MOVES');

test('cada cenário gera P50/P95/P99/máx, orçamento, entidades, heap e ruído entre repetições', () => {
  const r = runBench({repeats: 2, ticks: 240});
  assert.equal(r.rows.length, SCENARIOS.length);
  assert.ok(r.repeats === 2 && r.budgetUsPerStep === 8333);
  for (const x of r.rows) {
    assert.ok(x.p50 > 0 && x.p95 >= x.p50 && x.p99 >= x.p95 && x.max >= x.p99, x.id);
    assert.ok(Number.isFinite(x.budgetPctP95) && Number.isFinite(x.repeatNoisePct) && x.stepsPerSecond > 0, x.id);
  }
  assert.ok(r.rows.find(x => x.id === 'entidades-no-limite').maxEntities >= 60, 'o cenário de limite realmente enche o mundo');
  assert.ok(r.rows.find(x => x.id === 'swift-metralhadora').maxEntities >= 2, 'o cenário de projéteis cria projéteis');
});
test('o ambiente é identificado e o relatório diz que GPU/render NÃO foram medidos', () => {
  const r = runBench({repeats: 1, ticks: 120, only: ['ia-sem-moves']});
  assert.ok(r.env.cpu && r.env.node && r.env.platform);assert.match(r.env.gpu, /não medida/);
  const md = toMarkdown(r);
  assert.match(md, /não mede GPU/);assert.match(md, /MESMO computador/);assert.match(md, /Pendente \(não medido\)/);
});
test('o ruído alto entre repetições é sinalizado', () => {
  const md = toMarkdown({generatedAt: '2026-10-23T00:00:00Z', env: {cpu: 'x', cores: 1, platform: 'p', node: 'n', gpu: 'não medida'}, repeats: 3, ticks: 10, budgetUsPerStep: 8333,
    rows: [{id: 'a', label: 'A', p50: 1, p95: 2, p99: 3, max: 4, budgetPctP95: .1, stepsPerSecond: 1000, maxEntities: 0, heapDeltaKB: 1, repeatNoisePct: 40, noisy: true}]});
  assert.match(md, /40%.*alto/);
});

done();
