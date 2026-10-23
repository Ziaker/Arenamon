// @ts-check
// Linha do tempo do Move (#04): as marcas estáticas (definição + sliders, em ticks de 120 Hz) coincidem com os eventos medidos no motor.
import {assert, C, suite, arena} from './moves-new-helpers.mjs';
import {buildMoveTimeline, measureMoveRun, TICK_RATE} from '../src/sim/move-timeline.js';
import {listMoves} from '../src/sim/moves.js';

const {test, done} = suite('LINHA DO TEMPO DO MOVE');

test('todo Move registrado tem linha do tempo coerente: ticks inteiros, ordenados, dentro da ação', () => {
  arena();
  for (const m of listMoves()) {
    const tl = buildMoveTimeline(m.id);
    assert.ok(tl, m.id);assert.equal(tl.tickRate, TICK_RATE);
    assert.ok(tl.marks.every(k => Number.isInteger(k.tick) && k.tick >= 0), `${m.id}: ticks inteiros`);
    assert.deepEqual(tl.marks.map(k => k.tick), [...tl.marks.map(k => k.tick)].sort((a, b) => a - b), `${m.id}: ordenado`);
    assert.ok(tl.spans.every(s => s.to >= s.from), `${m.id}: trechos válidos`);
    assert.equal(tl.marks.at(-1)?.kind, 'end');
  }
});
test('Harden: a marca de efeito cai no tick em que o status aparece no motor (±1 tick)', () => {
  arena();
  const tl = buildMoveTimeline('harden'), real = measureMoveRun('harden');
  const mark = tl.marks.find(k => k.kind === 'effect');
  assert.ok(mark && real.statusAt !== null);
  assert.ok(Math.abs(real.statusAt - mark.tick) <= 1, `marca ${mark.tick} × motor ${real.statusAt}`);
});
test('Swift: as estrelas nascem no tick da marca de spawn (±1) e a ação termina no tick final (±1)', () => {
  arena();
  const tl = buildMoveTimeline('swift'), real = measureMoveRun('swift');
  const spawn = tl.marks.find(k => k.kind === 'effect' || k.kind === 'spawn');   // o Swift cria as estrelas por um efeito nomeado
  assert.ok(spawn && real.spawns.length >= 1, JSON.stringify(real));
  assert.ok(Math.abs(real.spawns[0].tick - spawn.tick) <= 1, `spawn: marca ${spawn.tick} × motor ${real.spawns[0].tick}`);
  assert.ok(real.actionEnd !== null && Math.abs((real.actionEnd - (real.actionStart ?? 0)) - tl.totalTicks) <= 2, `fim: ${real.actionEnd} − ${real.actionStart} × ${tl.totalTicks}`);
});
test('mudar o slider de cast muda a linha do tempo (ela lê os valores vivos)', () => {
  arena();
  const before = buildMoveTimeline('harden').totalTicks;
  C.world.harden.cast = .7;
  const after = buildMoveTimeline('harden').totalTicks;
  assert.equal(after, Math.round(.7 * TICK_RATE));assert.notEqual(after, before);
});
test('Guard Break: hitbox e cancelamento vêm do grupo, em ticks', () => {
  arena();
  const tl = buildMoveTimeline('guard-break'), g = C.world.guardBreak;
  assert.equal(tl.marks.find(k => k.kind === 'hit')?.tick, Math.round(g.hitStart * TICK_RATE));
  assert.equal(tl.marks.find(k => k.kind === 'cancel')?.tick, Math.round(g.chainAfter * TICK_RATE));
});
test('Move desconhecido devolve null', () => {assert.equal(buildMoveTimeline('nao-existe'), null);});

done();
