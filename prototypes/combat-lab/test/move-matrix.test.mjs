// @ts-check
// Matriz de cenários por Move (#10): todos os Moves passam em todos os escopos aplicáveis; e a matriz DETECTA violações provocadas (mutação).
import {assert, C, suite, arena} from './moves-new-helpers.mjs';
import {registerMove, listMoves} from '../src/sim/moves.js';
import {registerEffect} from '../src/sim/move-effects.js';
import {runMoveMatrix, runAllMatrices, SCOPES, usageOf, notApplicable, renderMatrixReport} from '../src/sim/move-matrix.js';

const {test, done} = suite('MATRIZ DE CENÁRIOS POR MOVE');

test('todo Move registrado passa em todos os escopos aplicáveis (duas sementes) e nada é pulado em silêncio', () => {
  arena();
  const ids = listMoves().map(m => m.id);
  assert.ok(ids.length >= 19);
  for (const seed of [7, 21]) {
    const r = runAllMatrices(ids, seed);
    assert.deepEqual(r.failures.map(f => `${f.move}/${f.scope} t${f.tick}: ${f.expected} → ${f.got}`), [], `semente ${seed}`);
    assert.equal(r.results.length, ids.length * SCOPES.length, 'um resultado por Move e escopo');
    assert.ok(r.results.filter(x => x.status === 'na').every(x => x.reason && x.reason.length > 5), 'N/A sempre com a razão');
    console.log(`    semente ${seed}: ${r.ok} ok · ${r.fail} falhas · ${r.na} N/A`);
  }
});
test('a classificação de uso (toque / carga / marcador) vem da definição', () => {
  arena();
  const by = id => usageOf(listMoves().find(m => m.id === id));
  assert.equal(by('swift').mode, 'tap');assert.equal(by('guard-break').mode, 'charge');assert.equal(by('spikes').mode, 'aim');
});
test('N/A com razão para Move que não funciona no ar', () => {
  arena();
  const noAir = listMoves().find(m => m.air === 'none' || m.groundOnly);
  assert.ok(noAir, 'existe pelo menos um Move só de chão');
  const r = runMoveMatrix(noAir.id).find(x => x.scope === 'air');
  assert.equal(r?.status, 'na');assert.match(r?.reason ?? '', /só no chão/);
  assert.ok(notApplicable(noAir).air);
});

/** Move de teste cuja execução viola um invariante: `effect` recebe o lutador. */
function fake(id, effect) {
  registerEffect(id, (game, f) => effect(f, game));
  registerMove(/** @type {any} */ ({id, name: id, duration: .2, cost: .5, cooldown: 30, aim: 'facing', timeline: [{at: .1, effect: id}]}));
}
test('MUTAÇÃO: HP = NaN é acusado com tick, esperado e obtido', () => {
  arena();fake('teste-nan', f => {f.hp = NaN;});
  const r = runMoveMatrix('teste-nan').find(x => x.scope === 'ground');
  assert.equal(r?.status, 'fail');assert.match(String(r?.got), /hp = NaN/);assert.ok(r?.tick >= 10, 'tick ' + r?.tick);assert.equal(r?.seed, 7);
});
test('MUTAÇÃO: stamina acima do máximo e HP negativo são acusados', () => {
  arena();
  fake('teste-stamina', f => {f.stamina = 999;});
  assert.match(String(runMoveMatrix('teste-stamina').find(x => x.scope === 'ground')?.expected), /stamina/);
  // (velocidade infinita não entra aqui: o motor não tem trava contra isso e o passo não termina — registrado em docs/AUDITORIA_LIMPEZA_CODIGO_2026-10-23.md)
  fake('teste-hp-negativo', f => {f.hp = -5;});
  assert.match(String(runMoveMatrix('teste-hp-negativo').find(x => x.scope === 'ground')?.expected), /0 ≤ hp/);
});
test('MUTAÇÃO: efeito com Math.random quebra o determinismo', () => {
  arena();fake('teste-aleatorio', f => {f.position.x += Math.random() * .2;});
  const r = runMoveMatrix('teste-aleatorio').find(x => x.scope === 'determinism');
  assert.equal(r?.status, 'fail');assert.match(String(r?.expected), /idênticas/);
});
test('MUTAÇÃO: exceção no efeito vira falha com a pilha, não derruba a matriz', () => {
  arena();fake('teste-excecao', () => {throw new Error('boom de teste');});
  const r = runMoveMatrix('teste-excecao').find(x => x.scope === 'ground');
  assert.equal(r?.status, 'fail');assert.match(String(r?.got), /boom de teste/);
});
test('a configuração usada é a viva (C): trocar a base não quebra a matriz', () => {
  arena();C.world.slots = 4;
  assert.equal(runMoveMatrix('harden').filter(x => x.status === 'fail').length, 0);
});

test('escopos novos: teto, borda da arena, destrutível, refletir e status existem na matriz', () => {
  for (const s of ['ceiling', 'arena-edge', 'destructible', 'reflect', 'status']) assert.ok(SCOPES.includes(s), 'falta o escopo ' + s);
});
/** Move de teste com a ficha declarando N/A: matrix = {na: {escopo: 'razão'}}. */
function fakeNa(id, na, effect = () => {}) {
  registerEffect(id, (game, f) => effect(f, game));
  registerMove(/** @type {any} */ ({id, name: id, duration: .2, cost: .5, cooldown: 30, aim: 'facing', matrix: {na}, timeline: [{at: .1, effect: id}]}));
}
test('N/A declarado na ficha (matrix.na) aparece com a razão e não é executado', () => {
  arena();fakeNa('teste-na', {air: 'só age com os dois pés no chão', ceiling: 'sem sentido sem teto'});
  const out = runMoveMatrix('teste-na');
  const air = out.find(x => x.scope === 'air'), ceiling = out.find(x => x.scope === 'ceiling');
  assert.equal(air?.status, 'na');assert.equal(air?.reason, 'só age com os dois pés no chão');
  assert.equal(ceiling?.status, 'na');
  assert.equal(out.length, SCOPES.length, 'um resultado por escopo, nada pulado em silêncio');
});
test('N/A declarado inválido (escopo desconhecido ou sem razão) é recusado', () => {
  arena();
  fakeNa('teste-na-ruim', {inexistente: 'razão qualquer longa'});
  assert.throws(() => runMoveMatrix('teste-na-ruim'), /escopo desconhecido/);
  fakeNa('teste-na-sem-razao', {air: ''});
  assert.throws(() => runMoveMatrix('teste-na-sem-razao'), /razão/);
});
test('MUTAÇÃO: defeito que só aparece com destrutível por perto é acusado SÓ no escopo destructible', () => {
  arena();fake('teste-destrutivel', (f, g) => {if (g.mapState.destructibles.length) f.hp = NaN;});
  const out = runMoveMatrix('teste-destrutivel');
  assert.equal(out.find(x => x.scope === 'destructible')?.status, 'fail');
  assert.equal(out.find(x => x.scope === 'ground')?.status, 'ok');
});
test('MUTAÇÃO: defeito que só aparece com Harden ativo é acusado SÓ no escopo status', () => {
  arena();fake('teste-status', f => {if (f.statuses?.some(s => s.id === 'harden')) f.hp = NaN;});
  const out = runMoveMatrix('teste-status');
  assert.equal(out.find(x => x.scope === 'status')?.status, 'fail');
  assert.equal(out.find(x => x.scope === 'ground')?.status, 'ok');
});
test('MUTAÇÃO: defeito que só aparece perto da borda é acusado SÓ no escopo arena-edge', () => {
  arena();fake('teste-borda', f => {if (Math.hypot(f.position.x, f.position.z) > 4) f.hp = NaN;});
  const out = runMoveMatrix('teste-borda');
  assert.equal(out.find(x => x.scope === 'arena-edge')?.status, 'fail');
  assert.equal(out.find(x => x.scope === 'ground')?.status, 'ok');
});
test('MUTAÇÃO: defeito que só aparece com gravidade alterada é acusado SÓ no escopo gravity', () => {
  arena();const base = C.rules.launchGravity;fake('teste-gravidade', f => {if (C.rules.launchGravity !== base) f.hp = NaN;});
  const out = runMoveMatrix('teste-gravidade');
  assert.equal(out.find(x => x.scope === 'gravity')?.status, 'fail');
  assert.match(out.find(x => x.scope === 'gravity')?.got ?? '', /gravidade × 0\.5/);
  assert.equal(out.find(x => x.scope === 'air')?.status, 'ok');
});
test('MUTAÇÃO: defeito que só aparece fora da linha reta é acusado SÓ no escopo fuzz', () => {
  arena();fake('teste-fuzz', f => {if (Math.abs(f.position.x) > .5) f.stamina = -5;});   // só andando de lado (os outros escopos ficam em x = 0)
  const out = runMoveMatrix('teste-fuzz');
  assert.equal(out.find(x => x.scope === 'fuzz')?.status, 'fail');
});
test('o relatório traz semente, tick, esperado e obtido de cada falha, e a razão de cada N/A, e é regenerável', () => {
  arena();fake('teste-relatorio', f => {f.hp = NaN;});
  const r = runAllMatrices(['teste-relatorio', 'harden'], 7);
  const md = renderMatrixReport(r, {seed: 7, date: '2026-10-23'});
  assert.match(md, /Semente: 7/);assert.match(md, /teste-relatorio/);assert.match(md, /hp = NaN/);assert.match(md, /\| ground \|/);
  assert.equal(md, renderMatrixReport(r, {seed: 7, date: '2026-10-23'}), 'mesma entrada, mesmo texto');
});

done();
