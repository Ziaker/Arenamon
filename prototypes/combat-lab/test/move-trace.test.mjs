// Editor de Moves (fase 3): rastreio (linha do tempo + métricas) e comparação A × B, sem navegador.
// Uso: node prototypes/combat-lab/test/move-trace.test.mjs
import assert from 'node:assert/strict';
import {C, resetConfig, defaults} from '../src/sim/config.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {EDITABLE_MOVES, editableMove} from '../src/editor/editable-moves.js';
import {traceMove, compareTraces, currentValues, defaultValues, withValues, diffCount} from '../src/editor/move-trace.js';

registerStandardMoves();
const sand = editableMove('sand-wave');
let n = 0;
const ok = (name, fn) => {try {fn();n++;console.log('  ✓ ' + name);} catch (e) {console.log('  ✗ ' + name + '\n' + (e.stack || e.message).split('\n').slice(0, 4).join('\n'));process.exitCode = 1;}};
const fresh = () => resetConfig(defaults());
const lane = (t, kind, text) => t.lanes.find(l => l.kind === kind && (!text || l.label.includes(text)));

ok('Sand Wave: tempo até o efeito ≈ preparação, acerto depois, dano e custo vêm do jogo', () => {
  fresh();
  const t = traceMove(sand, {distance: 3});
  const w = C.world.sandWave;
  assert.ok(Math.abs(t.metrics['Tempo até o efeito (s)'] - w.cast) < 0.03, `efeito ${t.metrics['Tempo até o efeito (s)']} × cast ${w.cast}`);
  assert.ok(t.metrics['Tempo até o primeiro acerto (s)'] > t.metrics['Tempo até o efeito (s)']);
  assert.equal(t.metrics['Acertos'], 1);
  assert.equal(t.metrics['Dano total (HP)'], w.damage);
  assert.equal(t.metrics['Custo de stamina'], w.cost);
  assert.equal(t.metrics['Recarga (s)'], w.cooldown);
  assert.equal(t.metrics['Dano por stamina (HP)'], +(w.damage / w.cost).toFixed(3));
});
ok('a linha do tempo tem as faixas da ação, do efeito e do status, em ordem e dentro do cenário', () => {
  fresh();
  const t = traceMove(sand, {distance: 3});
  const act = lane(t, 'action'), eff = lane(t, 'entity', 'sandwave'), st = lane(t, 'status', 'blind');
  assert.ok(act && eff && st, t.lanes.map(l => l.label).join(' | '));
  assert.ok(act.spans[0].from <= eff.spans[0].from, 'a ação começa antes do efeito');
  assert.ok(Math.abs((eff.spans[0].to - eff.spans[0].from) - (C.world.sandWave.active + C.world.sandWave.dissipate)) < 0.05, 'o efeito dura janela + dissipação');
  assert.ok(st.spans[0].from >= t.hits[0].t - 0.02, 'a cegueira começa no acerto');
  for (const l of t.lanes) for (const sp of l.spans) {assert.ok(sp.from >= 0 && sp.to <= t.total + 0.02 && sp.to > sp.from, `${l.label}: ${JSON.stringify(sp)}`);}
  assert.ok(t.press >= 0 && t.press < t.hits[0].t);
});
ok('A × B: dano maior em B aparece como delta positivo e «B melhor»', () => {
  fresh();
  const A = traceMove(sand, {distance: 3}, defaultValues(sand));
  const B = traceMove(sand, {distance: 3}, {...defaultValues(sand), damage: 12});
  const row = compareTraces(A, B).find(r => r.label === 'Dano total (HP)');
  assert.deepEqual([row.a, row.b, row.delta, row.better], [6, 12, 6, 'b']);
  assert.equal(compareTraces(A, B).find(r => r.label === 'Custo de stamina').better, 'igual');
});
ok('A × B: preparação maior em B atrasa o efeito (delta ≈ +0,25 s, «A melhor»)', () => {
  fresh();
  const A = traceMove(sand, {distance: 3}, defaultValues(sand));
  const B = traceMove(sand, {distance: 3}, {...defaultValues(sand), cast: C.world.sandWave.cast + 0.25});
  const row = compareTraces(A, B).find(r => r.label === 'Tempo até o efeito (s)');
  assert.ok(Math.abs(row.delta - 0.25) < 0.03, String(row.delta));
  assert.equal(row.better, 'a');
});
ok('A × B: alcance menor em B perde o acerto (acertos 1 → 0)', () => {
  fresh();
  const A = traceMove(sand, {distance: 3}, defaultValues(sand));
  const B = traceMove(sand, {distance: 3}, {...defaultValues(sand), length: 1.5});
  const row = compareTraces(A, B).find(r => r.label === 'Acertos');
  assert.deepEqual([row.a, row.b, row.better], [1, 0, 'a']);
});
ok('os valores aplicados só valem durante o rastreio (C.world volta ao que era)', () => {
  fresh();
  const antes = {...C.world.sandWave};
  traceMove(sand, {distance: 3}, {...defaultValues(sand), damage: 99});
  assert.deepEqual({...C.world.sandWave}, antes);
  assert.throws(() => withValues(sand, {damage: 77}, () => {throw new Error('x');}), /x/);
  assert.equal(C.world.sandWave.damage, antes.damage, 'restaura mesmo se a função lançar');
});
ok('currentValues lê os sliders atuais e defaultValues lê o move.json', () => {
  fresh();C.world.sandWave.damage = 9;
  assert.equal(currentValues(sand).damage, 9);
  assert.equal(defaultValues(sand).damage, 6);
  // 29/10/2026: pushSpeed e pushMaxSpeed saem da ficha com 0 e o padrão do jogo (tabela de calibração) é 13,33: 2 diferenças de base
  assert.equal(diffCount(defaultValues(sand), currentValues(sand)), 3);
  fresh();assert.equal(diffCount(defaultValues(sand), currentValues(sand)), 2);
});
ok('rastrear com os valores atuais (null) é igual a rastrear com eles explicitamente', () => {
  fresh();C.world.sandWave.damage = 8;
  assert.deepEqual(traceMove(sand, {distance: 3}), traceMove(sand, {distance: 3}, currentValues(sand)));
});
ok('o rastreio é determinístico (duas execuções iguais)', () => {
  fresh();
  assert.deepEqual(traceMove(sand, {distance: 3}), traceMove(sand, {distance: 3}));
});
ok('os 17 Moves rastreiam sem erro: faixa de ação, tempos coerentes e métricas completas', () => {
  for (const m of EDITABLE_MOVES) {
    fresh();
    const t = traceMove(m, {distance: 3});
    assert.ok(t.lanes.some(l => l.kind === 'action'), `${m.id}: sem faixa de ação`);
    assert.equal(Object.keys(t.metrics).length, 10, m.id);
    const ate = t.metrics['Tempo até o efeito (s)'];
    if (ate != null) assert.ok(ate >= 0 && ate <= t.total, `${m.id}: tempo até o efeito ${ate}`);
    assert.equal(t.metrics['Custo de stamina'], +(C.world[m.group]?.cost ?? m.def.cost ?? 0).toFixed(3), m.id);
  }
});
ok('um Move de carga (Water Pulse) mostra o efeito só depois de o botão ser solto', () => {
  fresh();
  const wp = editableMove('water-pulse');
  const curto = traceMove(wp, {distance: 3, hold: 0.3}), longo = traceMove(wp, {distance: 3, hold: 1.2});
  assert.ok(longo.metrics['Tempo até o efeito (s)'] > curto.metrics['Tempo até o efeito (s)'], `${curto.metrics['Tempo até o efeito (s)']} × ${longo.metrics['Tempo até o efeito (s)']}`);
});
console.log(`${n} verificações do rastreio e do A × B.`);
