// Loop avançado (editor de animações): os 15 controles novos de loopagem no RUNTIME — partida real (Game + Character +
// AnimationMixer) medindo action.time/peso por frame, mais casos diretos no scheduler puro (clip-scheduler.js) e a
// regressão do caminho antigo (perfil sem nenhum campo novo = sequência de tempos idêntica ao commit b7596f9c).
// Uso: node prototypes/combat-lab/test/animation-loop-controls.test.mjs
import assert from 'node:assert/strict';
import {makeMatch, makeCharacter, setupRegistry, cmd, vec, C} from './animation-runtime-harness.mjs';
import {setField, emptyProfile, migrateProfile, FIELDS, FIELD_BY_ID, resolveField} from '../src/sim/animation-profile.js';
import {scheduleClipTime, loopScheduleOf, LOOP_FIELD_IDS, TIME_FIELD_IDS} from '../src/view/clip-scheduler.js';

const STEP = C.test.step;
let n = 0;const ok = l => {n++;console.log('✓', l);};
/** Grava campos do loop avançado numa ação do personagem (perfil: ação). */
const loopCfg = (ch, action, fields) => {for (const [id, v] of Object.entries(fields)) ch.animProfile = setField(ch.animProfile, action, id, v);};
/** Partida parada: o lutador azul fica em «idle» (neutral). */
const idleMatch = (setup = () => {}) => {const m = makeMatch();setup(m.chars[0]);m.run(10);return m;};
/** Avança n passos chamando fn(ch) após cada passo. */
const steps = (m, k, fn = () => {}) => {for (let i = 0; i < k; i++) {m.step();fn(m.chars[0]);}};

// ---------- inventário dos campos ----------
{
  const esperados = ['loopStartTime', 'loopEndTime', 'introSpeed', 'cycleSpeed', 'outroSpeed', 'cyclePauseStart', 'cyclePauseEnd',
    'repeatGap', 'loopCrossfade', 'loopCrossfadeWeight', 'entrySmooth', 'exitSmooth', 'conclusionBlend', 'loopExitDelay', 'cyclePhaseOffset'];
  assert.deepEqual(LOOP_FIELD_IDS, esperados, '15 campos novos listados no scheduler');
  assert.deepEqual(esperados.filter(id => !TIME_FIELD_IDS.includes(id)), ['conclusionBlend', 'loopExitDelay'], 'conclusionBlend/loopExitDelay agem fora do relógio');
  assert.deepEqual(esperados.filter(id => FIELD_BY_ID[id]?.applied !== true), [], 'todos os 15 campos marcados applied:true');
  assert.deepEqual(esperados.filter(id => FIELD_BY_ID[id]?.group !== 'Loop avançado'), [], 'todos no grupo «Loop avançado»');
  // Persistência/migração: entram no perfil, migram de idempotente, herdam variante → ação.
  let p = emptyProfile();
  for (const id of esperados) p = setField(p, 'idle', id, id.includes('Smooth') || id === 'entrySmooth' || id === 'exitSmooth' ? 'ease-in' : .5);
  const m2 = migrateProfile(JSON.parse(JSON.stringify(p)));
  assert.equal(m2.entries.idle.cycleSpeed, .5);assert.equal(m2.entries.idle.entrySmooth, 'ease-in');
  assert.deepEqual(migrateProfile(m2), m2, 'migração idempotente');
  p = setField(p, 'idle@clipX', 'cycleSpeed', 2);
  assert.equal(resolveField(p, 'cycleSpeed', 'idle', 'clipX').value, 2, 'variante vence a ação');
  assert.equal(resolveField(p, 'cycleSpeed', 'idle', 'outroClip').value, .5, 'ação vale para as demais variantes');
  ok('inventário: 15 campos aplicados, persistidos no perfil, migração idempotente, herança variante → ação');
}

// ---------- scheduler puro: segmentação intro/ciclo/saída + laço em segundos vencendo os % ----------
{
  const d = .5, base = {trimStart: 0, trimEnd: d, loopStart: .2, loopEnd: .4, cycleStart: .2, cycleLen: .2, loop: true,
    introSpeed: 1, cycleSpeed: 2, outroSpeed: 1, cyclePauseStart: 0, cyclePauseEnd: 0, repeatGap: 0, loopCrossfade: 0, loopCrossfadeWeight: 1, entrySmooth: 'linear', exitSmooth: 'linear', cyclePhaseOffset: 0};
  // Introdução [0,.2) à velocidade 1: orçamento .2; ciclo [.2,.4] à 2×: orçamento .1 por passo.
  let r = scheduleClipTime({elapsed: .1, duration: d, cfg: base});
  assert.ok(Math.abs(r.time - .1) < 1e-9 && !r.hold && !r.done, `intro avança 1× (t=${r.time})`);
  r = scheduleClipTime({elapsed: .25, duration: d, cfg: base});   // .05 de ciclo à 2× = .1 de clipe
  assert.ok(Math.abs(r.time - .3) < 1e-9, `ciclo avança 2× (t=${r.time})`);
  // loopStartTime/loopEndTime em segundos: o laço central vive em segundos no cfg resolvido (o % só vira segundos antes).
  const t1 = scheduleClipTime({elapsed: .25, duration: d, cfg: {...base, loopStart: .05, loopEnd: .1, cycleStart: .05, cycleLen: .05}});
  assert.ok(t1.time >= .049 && t1.time <= .101, `laço em segundos [.05,.1] respeitado (t=${t1.time})`);
  // Execução única: done no fim do recorte e saída com velocidade própria.
  const once = {...base, loop: false};
  r = scheduleClipTime({elapsed: 1e9, duration: d, cfg: once});
  assert.ok(r.done && r.hold && Math.abs(r.time - d) < 1e-9, 'execução única conclui segurando a última pose');
  const oHalf = scheduleClipTime({elapsed: .35, duration: d, cfg: {...once, outroSpeed: .5}});   // saída (.4,.5] à .5×: orçamento .2 → k=.25
  const oFull = scheduleClipTime({elapsed: .35, duration: d, cfg: once});                        // saída à 1×: orçamento .1 → k=.5
  assert.ok(oHalf.time < oFull.time && oHalf.time > .4 && oFull.time <= .45 + 1e-9, `outroSpeed .5 desacelera a saída (meio=${oHalf.time.toFixed(3)}, cheio=${oFull.time.toFixed(3)})`);
  ok('scheduler puro: introSpeed≠cycleSpeed mudam o mapeamento; laço em segundos; execução única done/hold');
}

// ---------- scheduler puro: pausas, intervalo, easings, fase e emenda ----------
{
  const d = .5, mk = over => ({trimStart: 0, trimEnd: d, loopStart: .2, loopEnd: .4, cycleStart: .2, cycleLen: .2, loop: true,
    introSpeed: 1, cycleSpeed: 1, outroSpeed: 1, cyclePauseStart: 0, cyclePauseEnd: 0, repeatGap: 0, loopCrossfade: 0, loopCrossfadeWeight: 1,
    entrySmooth: 'linear', exitSmooth: 'linear', cyclePhaseOffset: 0, ...over});
  // Pausa na primeira pose do ciclo: orçamento .2 (intro) + .25 → travado em .2.
  let r = scheduleClipTime({elapsed: .3, duration: d, cfg: mk({cyclePauseStart: .25})});
  assert.ok(r.hold && Math.abs(r.time - .2) < 1e-9, `pausa na 1ª pose do ciclo (t=${r.time}, hold=${r.hold})`);
  // Intervalo entre repetições: congela na última pose (~.4) por .3 após o passo do ciclo (orçamento .2).
  r = scheduleClipTime({elapsed: .2 + .2 + .15, duration: d, cfg: mk({repeatGap: .3})});
  assert.ok(r.hold && r.time > .39, `repeatGap congela na última pose (t=${r.time}, hold=${r.hold})`);
  r = scheduleClipTime({elapsed: .2 + .2 + .31, duration: d, cfg: mk({repeatGap: .3})});
  assert.ok(!r.hold && r.time < .3, `após o intervalo o ciclo recomeça (t=${r.time})`);
  // Easings de entrada: ease-in fica ATRÁS da linear no meio do trecho (a aceleração vem no fim) — as mesmas curvas do blendCurve.
  const easeIn = k => scheduleClipTime({elapsed: k * .2, duration: d, cfg: mk({entrySmooth: 'ease-in'})}).time;
  const lin = k => scheduleClipTime({elapsed: k * .2, duration: d, cfg: mk()}).time;
  assert.ok(easeIn(.5) < lin(.5) - 1e-6 && easeIn(.75) > lin(.25), `entrySmooth ease-in atrasa o início (50%→${(easeIn(.5) / .2).toFixed(2)} vs linear ${(lin(.5) / .2).toFixed(2)})`);
  // Fase: desloca a posição dentro do ciclo.
  const f0 = scheduleClipTime({elapsed: .25, duration: d, cfg: mk()}), f1 = scheduleClipTime({elapsed: .25, duration: d, cfg: mk({cyclePhaseOffset: .05})});
  assert.ok(Math.abs(f1.time - (.2 + ((f0.time - .2 + .05) % .2))) < 1e-9, `cyclePhaseOffset desloca a fase (t0=${f0.time}, t1=${f1.time})`);
  // Emenda: janela reportada só no fim do ciclo efetivo; o crossfade desloca o ciclo da action principal para loopStart+xf.
  const xf = mk({loopCrossfade: .05, loopStart: .2, cycleStart: .25, cycleLen: .15});   // ciclo efetivo [.25,.4], emenda [.2,.25]
  const fora = scheduleClipTime({elapsed: .25 + .05, duration: d, cfg: xf});
  assert.equal(fora.seam, null, 'fora da janela: sem emenda');
  const dentro = scheduleClipTime({elapsed: .25 + .14, duration: d, cfg: xf});
  assert.ok(dentro.seam != null && dentro.seam > .7, `janela de emenda no fim do ciclo (seam=${dentro.seam?.toFixed(2)})`);
  // Degeneração: sem laço central configurado os trechos somem (velocidades/easings viram 1/linear — lógica de loopScheduleOf).
  const ch = makeCharacter();
  loopCfg(ch, 'idle', {introSpeed: 2});
  let prof = ch.profileValue('idle', 'introSpeed');assert.equal(prof, 2, 'campo lido do perfil');
  const schFull = loopScheduleOf(ch, ch.current ?? {id: 'idle', index: ch.variants.idle[0], action: null, started: 0}, {duration: .5, cap: .5, speed: 1, loop: true, preview: null, previewSpeed: 1});
  assert.ok(schFull && schFull.cfg.introSpeed === 1 && schFull.cfg.cycleSpeed === 1 && schFull.cfg.entrySmooth === 'linear', 'sem laço central: degenera no comportamento clássico');
  ok('scheduler puro: pausas travam a pose, repeatGap congela entre repetições, easings/fase/emenda conferem');
}

// ---------- 1–2. laço em segundos vence os %; 3–5. introSpeed/cycleSpeed no jogo (idle) ----------
{
  const m = makeMatch();loopCfg(m.chars[0], 'idle', {loopStart: 10, loopEnd: 20, loopStartTime: .2, loopEndTime: .4, introSpeed: 1, cycleSpeed: 2});
  const ch = m.chars[0], d = ch.clips[ch.variants.idle[0]].duration;
  assert.ok(Math.abs(d - .5) < 1e-9, `clipe do idle sintético com .5 s (d=${d})`);
  const times = [], deltas = [];
  steps(m, 240, c => {if (c.current?.id === 'idle') {const t = c.current.action.time;times.push(t);}});
  for (let i = 1; i < times.length; i++) {const dt = times[i] - times[i - 1];if (dt > 0) deltas.push(dt);}
  assert.ok(times.every(t => t >= -1e-9 && t <= .4 + 1e-6), `laço em segundos vence os %: tempo sempre em [0,.4] (máx ${Math.max(...times).toFixed(3)})`);
  const introD = [], cycleD = [];
  for (let i = 1; i < times.length; i++) {const dt = times[i] - times[i - 1];if (dt <= 0) continue;(times[i] < .2 - 1e-9 ? introD : cycleD).push(dt);}   // pelo fim do frame: o frame que cruza .2 não pertence a nenhum trecho
  const mx = a => Math.max(...a);
  assert.ok(introD.length > 5 && cycleD.length > 5 && mx(cycleD) > mx(introD) * 1.6, `intro 1× (máx Δ ${mx(introD).toFixed(4)}) vs ciclo 2× (máx Δ ${mx(cycleD).toFixed(4)})`);
  ok(`loopStartTime/loopEndTime vencem os % e introSpeed/cycleSpeed mudam o mapeamento no mixer (idle, ${times.length} frames)`);
}

// ---------- 6–7. pausas na 1ª/última pose do ciclo (jogo) ----------
{
  const m = idleMatch(ch => loopCfg(ch, 'idle', {loopStartTime: .2, loopEndTime: .4, cyclePauseStart: .25}));
  const times = [];
  steps(m, 300, c => {if (c.current?.id === 'idle') times.push(c.current.action.time);});
  let run = 0, mx = 0;
  for (const t of times) {run = Math.abs(t - .2) < 1e-6 ? run + 1 : 0;mx = Math.max(mx, run);}
  assert.ok(mx >= STEP > 0 && mx >= Math.floor(.25 / STEP) - 2, `pausa na 1ª pose do ciclo: ${mx} frames travados em t=.2`);
  ok(`cyclePauseStart trava a primeira pose do ciclo por ~.25 s (${mx} frames congelados)`);
}
{
  const m = idleMatch(ch => loopCfg(ch, 'idle', {loopStartTime: .2, loopEndTime: .4, cyclePauseEnd: .2}));
  const times = [];
  steps(m, 300, c => {if (c.current?.id === 'idle') times.push(c.current.action.time);});
  let run = 0, mx = 0;
  for (const t of times) {run = t > .39 ? run + 1 : 0;mx = Math.max(mx, run);}
  assert.ok(mx >= Math.floor(.2 / STEP) - 2, `pausa na última pose do ciclo: ${mx} frames travados em t≈.4`);
  ok(`cyclePauseEnd trava a última pose do ciclo por ~.2 s (${mx} frames congelados)`);
}

// ---------- 8. intervalo entre repetições (jogo) ----------
{
  const m = idleMatch(ch => loopCfg(ch, 'idle', {loopStartTime: .2, loopEndTime: .4, repeatGap: .3}));
  const times = [];
  steps(m, 300, c => {if (c.current?.id === 'idle') times.push(c.current.action.time);});
  let run = 0, mx = 0;
  for (const t of times) {run = t > .39 ? run + 1 : 0;mx = Math.max(mx, run);}
  assert.ok(mx >= Math.floor(.3 / STEP) - 3, `repeatGap: ${mx} frames congelados na última pose entre repetições`);
  ok(`repeatGap congela a última pose do ciclo entre repetições (~.3 s, ${mx} frames)`);
}

// ---------- 9–10. emenda do laço com mistura real de poses (jogo) ----------
{
  const m = idleMatch(ch => loopCfg(ch, 'idle', {loopStartTime: .2, loopEndTime: .4, loopCrossfade: .1, loopCrossfadeWeight: .6}));
  const ch = m.chars[0];
  let seamFrames = 0, maxSeamW = 0, minMain = Infinity, seamTimes = [], mainAtWrap = [], lastT = null, ciclo = false;
  steps(m, 360, c => {
    if (c.current?.id !== 'idle') return;
    const t = c.current.action.time;
    if (t >= .3 - 1e-6) ciclo = true;   // só mede o ciclo efetivo depois de entrar nele (a intro fica em [0,.2])
    if (ciclo) minMain = Math.min(minMain, t);
    const a2 = c.seamAction;
    if (a2 && a2.getEffectiveWeight() > 1e-4) {   // paused=true de propósito (isRunning() seria falso; a pose mistura normalmente)
      seamFrames++;maxSeamW = Math.max(maxSeamW, a2.getEffectiveWeight());
      seamTimes.push(a2.time);
      if (lastT != null && t < lastT - 1e-6) mainAtWrap.push([lastT, t, a2.time]);   // quadro do laço: main voltou, seam no fim
    }
    lastT = t;
  });
  assert.ok(seamFrames > 3, `janela de emenda ativa por ${seamFrames} frames`);
  assert.ok(maxSeamW <= .6 + 1e-6 && maxSeamW > .3, `peso da emenda respeita loopCrossfadeWeight .6 (máx ${maxSeamW.toFixed(3)})`);
  assert.ok(minMain >= .3 - 1e-6, `action principal fica no ciclo efetivo [.3,.4] (mín ${minMain.toFixed(3)})`);
  assert.ok(seamTimes.every(t => t >= .2 - 1e-6 && t <= .3 + 1e-6), `segunda action cobre o início do ciclo [${Math.min(...seamTimes).toFixed(3)}, ${Math.max(...seamTimes).toFixed(3)}]`);
  assert.ok(mainAtWrap.length > 0, 'houve quadro de laço com a segunda action ativa');
  const [mainAntes, mainDepois, seamFim] = mainAtWrap[0];
  assert.ok(mainDepois >= .3 - 1e-6 && Math.abs(seamFim - .3) < .02, `sem salto de pose: main recomeça em ${mainDepois.toFixed(3)} = fim da seam ${seamFim.toFixed(3)} (era ${mainAntes.toFixed(3)})`);
  ok(`loopCrossfade/loopCrossfadeWeight: segunda action mistura o fim com o início do ciclo, contínua no laço (${seamFrames} frames, peso máx ${maxSeamW.toFixed(2)})`);
}

// ---------- 11–12. easings de entrada/saída (jogo, execução única) ----------
{
  const m = makeMatch();const ch0 = m.chars[0];ch0.playback.idle = {loop: false};loopCfg(ch0, 'idle', {loopStartTime: .2, loopEndTime: .4, entrySmooth: 'ease-in', exitSmooth: 'ease-in'});
  const times = [];
  steps(m, 240, c => {if (c.current?.id === 'idle') times.push(c.current.action.time);});
  const intro = [], outro = [];
  for (let i = 1; i < times.length; i++) {const dt = times[i] - times[i - 1];if (dt <= 0) continue;(times[i] < .2 - 1e-9 ? intro : times[i - 1] >= .4 - 1e-9 ? outro : []).push(dt);}   // só conta frames INTEIROS em cada trecho
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  assert.ok(intro.length > 5 && mean(intro.slice(0, Math.floor(intro.length / 3))) < mean(intro.slice(-Math.floor(intro.length / 3))), `entrySmooth ease-in: começo da intro mais lento que o fim (${mean(intro.slice(0, 5)).toFixed(4)} → ${mean(intro.slice(-5)).toFixed(4)})`);
  assert.ok(outro.length > 5 && mean(outro.slice(0, Math.floor(outro.length / 3))) < mean(outro.slice(-Math.floor(outro.length / 3))), `exitSmooth ease-in: começo da saída mais lento que o fim`);
  assert.ok(Math.abs(times.at(-1) - .5) < 1e-6, `execução única conclui segurando o fim do recorte (t=${times.at(-1).toFixed(3)})`);
  ok('entrySmooth/exitSmooth alteram o avanço do tempo nos trechos de introdução e saída');
}

// ---------- 15. deslocamento de fase (jogo) ----------
{
  const run = off => {
    const m = idleMatch(ch => loopCfg(ch, 'idle', {loopStartTime: .2, loopEndTime: .4, ...(off ? {cyclePhaseOffset: off} : {})}));
    const ts = [];
    steps(m, 300, c => {if (c.current?.id === 'idle' && c.clock - c.current.started > .3 && ts.length < 1) ts.push(c.current.action.time);});
    return (ts[0] - .2 + 1) % .2;   // 1ª amostra no ciclo: mesmo u nos dois runs → a diferença é só a fase
  };
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const b0 = run(0), b1 = run(.05);
  assert.ok(Math.abs((b1 - b0 + .3) % .2 - .1 - .05) < .02, `fase deslocada em ~.05 s (base ${b0.toFixed(3)} → deslocada ${b1.toFixed(3)})`);
  ok(`cyclePhaseOffset desloca a fase dentro do ciclo (${b0.toFixed(3)} → ${b1.toFixed(3)})`);
}

// ---------- 13. conclusionBlend no fade da transição pós-epílogo ----------
{
  const lock = {target: 1, locked: true};
  const shortTackle = () => {C.actions.tackle.duration = C.test.step * 8;};
  // Controle: sem conclusionBlend, o fade da conclusão natural é o padrão (.18).
  {
    const m = makeMatch({cfg: shortTackle});
    m.run(10);m.step(cmd({tackle: true, move: vec(0, 1), ...lock}));
    let guard = 0;
    while (m.chars[0].epilogue && guard++ < 400) m.step();
    guard = 0;while (m.chars[0].current.key === 'tackle' && guard++ < 400) m.step();
    assert.ok(m.chars[0].current.key !== 'tackle', 'transição após conclusão natural');
    assert.ok(Math.abs(m.chars[0].current.fade - C.display.animation.fade) < 1e-9, `fade padrão sem o campo (${m.chars[0].current.fade})`);
    ok('controle: conclusão natural sem conclusionBlend usa o fade padrão');
  }
  {
    const m = makeMatch({cfg: shortTackle});
    loopCfg(m.chars[0], 'tackle', {conclusionBlend: .37});
    m.run(10);m.step(cmd({tackle: true, move: vec(0, 1), ...lock}));
    let guard = 0;
    while (m.chars[0].epilogue && guard++ < 400) m.step();
    guard = 0;while (m.chars[0].current.key === 'tackle' && guard++ < 400) m.step();
    assert.ok(Math.abs(m.chars[0].current.fade - .37) < 1e-9, `conclusão natural usou conclusionBlend .37 (fade=${m.chars[0].current.fade})`);
    ok('conclusionBlend aparece no fade da transição seguinte à conclusão natural do epílogo');
  }
}

// ---------- 14. loopExitDelay retém a troca pedida pela mecânica e cede à autoridade na hora ----------
{
  // Sem walk_stop/sprint_stop no cenário: soltar o direcional pede «neutral» direto (o freio não assume).
  const m = makeMatch({cfg: () => {C.display.animation.locomotionHold = 0;}, omit: ['walk_stop', 'sprint_stop']});
  const ch = m.chars[0], f = m.g.fighters[0];
  loopCfg(ch, 'walk', {loopExitDelay: .5});
  m.run(10);
  steps(m, 30, () => {});m.step(cmd({move: vec(0, 1)}));
  for (let i = 0; i < 60; i++) m.step(cmd({move: vec(0, 1)}));   // segura a marcha: sem pedido de troca durante o aquecimento
  assert.equal(ch.current.key, 'walk', `andando para frente (key=${ch.current.key})`);
  // Troca pedida pela mecânica (andar → parar): retida pelo atraso.
  const t0 = ch.clock;
  m.step(cmd());
  assert.ok(ch.current.key === 'walk' && f.state !== 'hitstun', 'a troca walk→neutral ainda não ocorreu no 1º passo');
  let held = 0;
  for (let i = 0; i < 200; i++) {m.step(cmd());if (ch.current.key === 'walk') held++;}
  assert.ok(held >= Math.floor(.5 / STEP) - 2 && held < 200, `a saída do laço esperou o atraso (~.5 s + desaceleração, ${held} frames em «walk»)`);
  assert.equal(ch.current.key, 'neutral', `depois do atraso a troca ocorreu (key=${ch.current.key}, Δt=${(ch.clock - t0).toFixed(2)})`);
  ok(`loopExitDelay retém a troca pedida pela mecânica por ~.5 s (${held} frames)`);
  // Autoridade: nova ação (esquiva) interrompe na hora, sem esperar o atraso.
  steps(m, 10);
  loopCfg(ch, 'neutral', {loopExitDelay: .5});
  m.step(cmd({dodge: true, dodgeDirection: vec(0, -1)}));
  assert.ok(ch.current.key.startsWith('dodge'), `esquiva autorizada assume imediatamente (key=${ch.current.key})`);
  ok('loopExitDelay cede na hora à autoridade (nova ação aceita)');
}

// ---------- regressão: perfil sem nenhum campo novo → caminho antigo byte a byte ----------
{
  const m = makeMatch();   // sem aquecimento: o idle assume no 1º quadro e a série temporal começa em 0
  const ch = m.chars[0], cap = ch.clips[ch.variants.idle[0]].duration, s = ch.speedOf('idle');
  assert.equal(loopScheduleOf(ch, ch.current ?? {id: 'idle', index: ch.variants.idle[0], action: null, started: 0}, {duration: cap, cap, speed: s, loop: true, preview: null, previewSpeed: 1}), null, 'sem campos novos o scheduler não entra');
  // Fórmula legada do commit b7596f9c (ramo de relógio livre com laço): a.time = (a.time + dt*s) % cap — reproduzida com as
  // MESMAS operações em ponto flutuante; só avança nos frames em que o idle é a camada atual (como o mixer acumula).
  let t = 0, frames = 0;
  steps(m, 240, c => {
    if (c.current?.id !== 'idle') return;
    t = (t + STEP * s) % cap;frames++;
    assert.ok(Math.abs(c.current.action.time - t) < 1e-12, `frame ${frames}: t=${c.current.action.time} esperado ${t}`);
  });
  ok(`regressão: perfil sem campos novos reproduz a sequência de tempos do b7596f9c exatamente (${frames} frames)`);
}

console.log(`\n${n} verificações dos controles de loopagem avançada aprovadas.`);
process.exit(0);
