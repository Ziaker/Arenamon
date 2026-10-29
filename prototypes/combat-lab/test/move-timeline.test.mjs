// @ts-check
// Linha do tempo do Move (#04): as marcas estáticas (definição + sliders, em ticks de 120 Hz) coincidem com os eventos medidos no motor.
import {assert, C, suite, arena} from './moves-new-helpers.mjs';
import {buildMoveTimeline, measureMoveRun, TICK_RATE, clipFrameAtTick, findMoveRunStart} from '../src/sim/move-timeline.js';
import {MOVE_VFX} from '../src/sim/move-vfx-map.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
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

// ---- Tarefa 5 do plano restante: marcas de VFX, câmera e animação na mesma linha do tempo, sem misturar tick com frame ----
test('cada marca de cue declara o domínio e o relógio: tick da simulação ou animação (nunca os dois)', () => {
  arena();
  for (const m of listMoves()) {
    const tl = buildMoveTimeline(m.id);
    for (const c of tl.cues) {
      assert.ok(['vfx', 'camera', 'animation'].includes(c.domain), m.id + ': domínio ' + c.domain);
      assert.equal(c.clock, c.domain === 'animation' ? 'animation' : 'tick', m.id + ': relógio de ' + c.domain);
      assert.ok(c.tick === null || (Number.isInteger(c.tick) && c.tick >= 0), m.id + ': tick de cue');
      assert.ok(c.label.length > 5, m.id + ': rótulo');
    }
  }
});
test('Swift: o cue de VFX cai no tick do spawn medido no motor (±1) e traz as chaves de VFX do Move', () => {
  arena();
  const tl = buildMoveTimeline('swift'), real = measureMoveRun('swift');
  const vfx = tl.cues.find(c => c.domain === 'vfx' && c.tick !== null);
  assert.ok(vfx && real.spawns.length, JSON.stringify(real));
  const rel = real.spawns[0].tick - (real.actionStart ?? 0);
  assert.ok(Math.abs(rel - vfx.tick) <= 1, 'cue ' + vfx.tick + ' × motor ' + rel);
  assert.deepEqual(vfx.keys, MOVE_VFX.swift);
});
test('animação: o clipe do slot e o relógio normalizado pela duração da ação (não é tick)', () => {
  arena();
  const tl = buildMoveTimeline('swift'), anim = tl.cues.find(c => c.domain === 'animation');
  assert.equal(anim.clip, 'move_swift');assert.equal(anim.clock, 'animation');assert.equal(anim.tick, 0);
  assert.match(anim.label, /não é tick|normalizad/);
  assert.equal(buildMoveTimeline('swift', {slot: 2}).cues.find(c => c.domain === 'animation').clip, 'move_swift');
});
test('clipFrameAtTick converte tick em quadro do clipe (proporcional à duração da ação, limitado ao clipe)', () => {
  assert.equal(clipFrameAtTick(60, 120, 31), 15);
  assert.equal(clipFrameAtTick(0, 120, 31), 0);
  assert.equal(clipFrameAtTick(120, 120, 31), 30);
  assert.equal(clipFrameAtTick(500, 120, 31), 30, 'passou do fim: último quadro');
  assert.equal(clipFrameAtTick(10, 0, 31), 0, 'ação sem duração: quadro 0');
});
test('câmera: Move corpo a corpo treme no acerto; Move à distância depende do interruptor do Move e a marca acompanha o slider', () => {
  arena();
  const lunge = buildMoveTimeline('lunge').cues.find(c => c.domain === 'camera');
  assert.ok(lunge && lunge.tick === Math.round(C.world.lunge.hitStart * TICK_RATE), JSON.stringify(lunge));
  const off = buildMoveTimeline('swift').cues.find(c => c.domain === 'camera');
  assert.match(off.label, /desligado/);
  C.world.swift.hitShakeOn = 1;
  assert.match(buildMoveTimeline('swift').cues.find(c => c.domain === 'camera').label, /ligado/);
  C.world.lunge.hitStart = .3;
  assert.equal(buildMoveTimeline('lunge').cues.find(c => c.domain === 'camera').tick, Math.round(.3 * TICK_RATE));
});
/** Joga o Move e guarda o estado de cada tick (como o buffer de replay do jogo). */
function recordRun(moveId) {
  const g = new Game({seed: 7});g.start();g.reset({positions: [{x: 0, z: -3}, {x: 0, z: 3}]});
  C.extras.toggles.enableEnemyAI = 0;
  g.mapState.platforms = [];g.mapState.obstacles = [];g.mapState.destructibles = [];g.mapState.items = [];g.mapState.regularSpawnTimer = 1e9;
  g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;g.setLoadout(0, [moveId]);
  const frames = [];
  for (let t = 0; t < 200; t++) {
    g.step({...emptyCommand(), ...(t < 1 ? {skill: 0, skillHeld: Array.from({length: C.world.slots}, (_, i) => i === 0)} : {})}, emptyCommand());
    frames.push({tick: g.tick, game: g.save()});
  }
  return frames;
}
test('pausar no tick da marca: findMoveRunStart acha o começo da ação e o estado nesse tick já mostra o efeito (e 10 ticks antes, não)', () => {
  arena();
  const frames = recordRun('harden'), start = findMoveRunStart(frames, 'harden');
  assert.ok(start !== null && start >= 1, 'início da ação: ' + start);
  const vfx = buildMoveTimeline('harden').cues.find(c => c.domain === 'vfx' && c.tick !== null);
  assert.ok(vfx.tick > 10, 'o efeito do Harden vem depois do cast: tick ' + vfx.tick);
  const has = f => f.game.fighters[0].statuses?.some(s => s.id === 'harden');
  const at = frames.find(f => f.tick === start + vfx.tick + 1);   // +1: o estado do tick é gravado depois do passo
  assert.ok(at && has(at), 'o status existe no frame da marca');
  const before = frames.find(f => f.tick === start + vfx.tick - 10);
  assert.ok(before && !has(before), 'e ainda não existia 10 ticks antes');
});
test('findMoveRunStart: sem uso do Move no buffer devolve null; com dois usos, devolve o mais recente', () => {
  const mk = (tick, moveId) => ({tick, game: {fighters: [{action: moveId ? {kind: 'move', move: moveId, elapsed: 0} : null}, {action: null}]}});
  assert.equal(findMoveRunStart([mk(1, null), mk(2, null)], 'swift'), null);
  const frames = [mk(1, null), mk(2, 'swift'), mk(3, 'swift'), mk(4, null), mk(5, 'swift'), mk(6, 'swift'), mk(7, null)];
  assert.equal(findMoveRunStart(frames, 'swift'), 5);
  assert.equal(findMoveRunStart(frames, 'harden'), null);
});

done();
