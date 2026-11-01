// Segurar quadro (editor de animações): conversão quadro ↔ segundo, o agendador puro (corre até o quadro, segura, segue) e,
// numa partida real (Game + Character + AnimationMixer), o pico do pulo segurado por tempo finito antes da queda (só visual).
// Uso: node prototypes/combat-lab/test/animation-hold-frame.test.mjs
import assert from 'node:assert/strict';
import {makeMatch, cmd, C} from './animation-runtime-harness.mjs';
import {setField} from '../src/sim/animation-profile.js';
import {scheduleClipTime, holdReach, holdPhase, TIME_FIELD_IDS} from '../src/view/clip-scheduler.js';
import {frameRateOf, frameTime, timeFrame, frameCount, HOLD_FIELD_IDS} from '../src/view/frame-hold.js';

let n = 0;const ok = l => {n++;console.log('✓', l);};
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// ---------- quadros ↔ segundos ----------
{
  const times = Array.from({length: 30}, (_, i) => i / 24);
  assert.equal(frameRateOf([times]), 24, '24 quadros/s detectado');
  assert.equal(frameRateOf([Array.from({length: 20}, (_, i) => i / 60)]), 60, '60 quadros/s detectado');
  assert.equal(frameRateOf([]), 30, 'sem chaves: 30');
  assert.ok(near(frameTime(1, 24), 0) && near(frameTime(14, 24), 13 / 24), 'quadro 1 = 0 s; quadro 14 = 13/24 s');
  assert.equal(timeFrame(13 / 24, 24), 14, 'volta ao quadro 14');
  assert.equal(frameCount(29 / 24, 24), 30, '30 quadros');
  assert.deepEqual(HOLD_FIELD_IDS.filter(id => !TIME_FIELD_IDS.includes(id)), [], 'campos do hold entram no relógio do agendador');
  ok('quadros: taxa detectada, quadro N ↔ segundos, campos do hold no agendador');
}

// ---------- agendador puro ----------
const cfgOf = (o = {}) => ({trimStart: 0, trimEnd: 1, loopStart: 0, loopEnd: 1, cycleStart: 0, cycleLen: 1, loop: false, introSpeed: 1, cycleSpeed: 1, outroSpeed: 1,
  cyclePauseStart: 0, cyclePauseEnd: 0, repeatGap: 0, loopCrossfade: 0, loopCrossfadeWeight: 1, entrySmooth: 'linear', exitSmooth: 'linear', cyclePhaseOffset: 0,
  holdAt: 13 / 24, holdFor: 2, ...o});
{
  const cfg = cfgOf(), at = e => scheduleClipTime({elapsed: e, duration: 1, cfg});
  assert.ok(near(holdReach({duration: 1, cfg}), 13 / 24, 1e-4), 'o quadro 14 é alcançado em 13/24 s');
  assert.ok(near(at(.3).time, .3) && !at(.3).hold, 'corre normal até o quadro');
  const h0 = 13 / 24;
  assert.ok(at(h0 + .001).hold && near(at(h0 + .001).time, h0), 'parado no quadro 14');
  assert.ok(at(h0 + 1.9).hold && near(at(h0 + 1.9).time, h0), 'continua parado aos 1,9 s');
  assert.ok(!at(h0 + 2.01).hold && at(h0 + 2.01).time > h0, 'depois dos 2 s o clipe segue');
  assert.ok(near(at(h0 + 2 + .2).time, h0 + .2, 1e-4), 'segue de onde parou, sem salto');
  assert.ok(at(h0 + 2.6).done && at(h0 + 2.6).time === 1, 'termina e segura a última pose');
  assert.equal(holdPhase({elapsed: .2, duration: 1, cfg}), 'before');
  assert.equal(holdPhase({elapsed: h0 + 1, duration: 1, cfg}), 'holding');
  assert.equal(holdPhase({elapsed: h0 + 3, duration: 1, cfg}), 'after');
  assert.equal(holdPhase({elapsed: 1, duration: 1, cfg: cfgOf({holdAt: null})}), 'off');
  ok('agendador: corre até o quadro 14, segura 2 s e segue de onde parou');
}
{
  // Sem fim (holdFor = Infinity): fica no quadro até o jogo trocar de estado. Em laço também vale uma vez só.
  const cfg = cfgOf({holdFor: Infinity}), loopCfg = cfgOf({loop: true, holdFor: .5});
  assert.ok(scheduleClipTime({elapsed: 50, duration: 1, cfg}).hold, 'sem fim: segura para sempre');
  const h0 = 13 / 24, at = e => scheduleClipTime({elapsed: e, duration: 1, cfg: loopCfg}).time;
  assert.ok(near(at(h0 + .2), h0), 'laço: segura no quadro');
  assert.ok(near(at(h0 + .5 + .1), h0 + .1, 1e-4) && at(1 + .5 + .01) < .1, 'laço: segura uma vez e o laço segue/recomeça normalmente');
  // Compõe com velocidade do ciclo, recorte e pausa: o quadro continua sendo alcançado e segurado.
  const fast = cfgOf({cycleSpeed: 2, cyclePauseStart: .1}), r = holdReach({duration: 1, cfg: fast});
  assert.ok(near(r, .1 + (13 / 24) / 2, 1e-4), `com ciclo 2× e pausa inicial o quadro chega em ${r.toFixed(3)} s`);
  assert.ok(scheduleClipTime({elapsed: r + .3, duration: 1, cfg: fast}).hold, 'segura depois');
  assert.equal(holdReach({duration: 1, cfg: cfgOf({holdAt: 5})}), null, 'quadro fora do trecho tocado: sem hold');
  ok('agendador: sem fim, laço e composição com velocidade/pausa/recorte');
}

// ---------- partida real: pico do pulo segurado antes da queda ----------
function jumpRun({hold}) {
  const m = makeMatch();const ch = m.chars[0];
  if (hold) {
    ch.animProfile = setField(ch.animProfile, 'jump_apex', 'holdFrame', 1);   // 1º quadro do clipe do pico
    ch.animProfile = setField(ch.animProfile, 'jump_apex', 'holdFor', hold);
  }
  m.run(30);
  m.step(cmd({jump: true, jumpHeld: true}));
  const log = [];let guard = 0;
  while (guard++ < 400) {
    m.step(cmd({jumpHeld: true}));   // botão segurado: pulo inteiro (≈0,9 s no ar)
    log.push({t: ch.clock, key: ch.current?.key, vy: m.g.fighters[0].flight?.vy ?? null, flying: !!m.g.fighters[0].flight});
    if (!m.g.fighters[0].flight && log.length > 5) break;
  }
  return log;
}
{
  const base = jumpRun({hold: 0}), held = jumpRun({hold: .3});   // pico começa em ~0,38 s, queda física em ~0,56 s, o pouso em ~0,9 s: 0,3 s segura até ~0,68 s
  const firstFall = l => l.find(e => e.key === 'jump_fall');
  const physicsFall = l => l.find(e => e.flying && e.vy < -C.rules.launchGravity * 0 - 1.8);   // vy abaixo da faixa do pico
  assert.ok(firstFall(base) && physicsFall(base), 'sem hold: o personagem entra em jump_fall');
  const tBaseFall = firstFall(base).t - base[0].t, tHeldFall = firstFall(held).t - held[0].t;
  assert.ok(tHeldFall - tBaseFall >= .08, `com hold de 0,3 s a queda visual atrasa (${tBaseFall.toFixed(2)} s → ${tHeldFall.toFixed(2)} s)`);
  // Durante o atraso a física já está caindo, mas o visual segue no pico.
  const during = held.filter(e => e.flying && e.vy < -1.8 && e.key === 'jump_apex');
  assert.ok(during.length > 3, `${during.length} quadros com vy < −1,8 m/s e o clipe ainda no pico`);
  // A física não muda: o tempo de voo é o mesmo.
  assert.ok(Math.abs(base.length - held.length) <= 2, `tempo de voo igual (${base.length} × ${held.length} quadros)`);
  ok('pulo: o pico segura 0,3 s e vai direto para a queda; a física do pulo não muda');
}

console.log(`\n${n} blocos OK`);
