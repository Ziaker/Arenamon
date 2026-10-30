// Viewport 3D própria do Editor de animações (src/view/animation-preview.js), sem navegador.
// 1. FIDELIDADE DE PIPELINE: o caminho de tempo da prévia (createPreviewCharacter, ramo `p` de blend()) é IDÊNTICO
//    ao da prévia do lutador da arena para o mesmo clipe+campos — frame a frame, em 1e-12 — em 7 configurações
//    (clássico, trims/laço %, os 15 controles de loopagem, velocidade, duração máxima, Reverso, execução única);
//    e com campos configurados também coincide com o caminho REAL DO JOGO (partida parada em idle), em 1e-9.
// 2. TRANSPORTE: play do início, pause congela, seek vai ao instante exato, ±1 quadro (1/30 s), laço.
// 3. persist:false: nada é gravado no armazenamento (nem syncFrom, nem save explícito).
// 4. A edição AO VIVO (syncFrom no meio da reprodução) muda o mapeamento de tempo no quadro seguinte.
// 5. createAnimationPreview: renderer stub recebe render() apenas quando visível; rendererFactory que lança → fallback.
// Uso: node prototypes/combat-lab/test/animation-editor-preview.test.mjs
import assert from 'node:assert/strict';
import {Character} from '../src/view/characters.js';
import {setField} from '../src/sim/animation-profile.js';
import {createPreviewCharacter, createAnimationPreview, previewFighter, PREVIEW_FRAME} from '../src/view/animation-preview.js';
import {makeMatch, makeCharacter} from './animation-runtime-harness.mjs';
import {C} from '../src/sim/config.js';

let n = 0;
const ok = l => {n++;console.log('✓', l);};
const DT = 1 / 120;   // cadência do relógio do laboratório (mesma do jogo)

// ---------- fixture: personagem da arena + personagem de prévia espelhado ----------
/** Cria o par arena/prévia com os MESMOS campos configurados e a prévia pronta para tocar o clipe do idle. */
function makePair(fields = {}, opts = {}) {
  const arena = makeCharacter();
  arena.playback.idle = {loop: opts.loop !== false};
  if (opts.speed) arena.speeds.idle = opts.speed;
  if (opts.maxDuration) arena.playback.idle = {...arena.playback.idle, maxDuration: opts.maxDuration};
  for (const [id, v] of Object.entries(fields)) arena.animProfile = setField(arena.animProfile, 'idle', id, v);
  arena.refreshVisual();
  const pc = createPreviewCharacter(arena.source).syncFrom(arena);
  const idx = arena.variantsOf('idle')[0];
  return {arena, pc, idx, action: 'idle'};
}
/** Passa os dois personagens em lockstep e devolve as séries de (tempo, peso) da camada atual. */
function runPair(pair, frames, setup = () => {}) {
  const {arena, pc, idx, action} = pair;
  const af = previewFighter();
  arena.startPreview(idx, {action, loop: true});
  pc.load(idx, {action, loop: true});
  const aT = [], aW = [], pT = [], pW = [], seam = [];
  for (let i = 0; i < frames; i++) {
    setup(i, arena, pc);
    af.position.x = 0;af.visualFacing = af.facing = 0;
    arena.update(af, DT, 0, [], {source: 'prévia'});
    pc.step(DT);
    aT.push(arena.current?.action.time);aW.push(arena.current?.action.getEffectiveWeight());
    pT.push(pc.character.current?.action.time);pW.push(pc.character.current?.action.getEffectiveWeight());
    seam.push([arena.seamAction?.time ?? null, pc.character.seamAction?.time ?? null, arena.seamAction?.getEffectiveWeight() ?? 0, pc.character.seamAction?.getEffectiveWeight() ?? 0]);
  }
  return {aT, aW, pT, pW, seam};
}
const same = (pair, frames, setup) => {
  const r = runPair(pair, frames, setup);
  for (let i = 0; i < frames; i++) {
    assert.ok(Math.abs(r.aT[i] - r.rT?.[i]) >= 0 || true);   // (placeholder, comparações abaixo)
    assert.ok(Math.abs(r.aT[i] - r.pT[i]) < 1e-12, `frame ${i}: arena=${r.aT[i]} prévia=${r.pT[i]}`);
    assert.ok(Math.abs(r.aW[i] - r.pW[i]) < 1e-12, `frame ${i}: peso arena=${r.aW[i]} prévia=${r.pW[i]}`);
    const [as, ps, aw, pw] = r.seam[i];
    assert.ok((as === null) === (ps === null), `frame ${i}: emenda presente só num dos dois`);
    if (as !== null) {assert.ok(Math.abs(as - ps) < 1e-12 && Math.abs(aw - pw) < 1e-12, `frame ${i}: emenda arena=${as}/${aw} prévia=${ps}/${pw}`);}
  }
  return r;
};

// ---------- 1. fidelidade frame a frame vs prévia da arena (7 configurações) ----------
{
  const cases = [
    ['clássico (sem campos)', {}, {}],
    ['trims + laço central em %', {trimStart: 10, trimEnd: 90, loopStart: 30, loopEnd: 70}, {}],
    ['15 controles de loopagem', {loopStartTime: .2, loopEndTime: .4, introSpeed: .8, cycleSpeed: 1.6, outroSpeed: 1.2, cyclePauseStart: .1, cyclePauseEnd: .06, repeatGap: .12, loopCrossfade: .05, loopCrossfadeWeight: .6, entrySmooth: 'ease-in', exitSmooth: 'ease-out', conclusionBlend: .3, loopExitDelay: .2, cyclePhaseOffset: .03}, {}],
    ['velocidade 1.7', {}, {speed: 1.7}],
    ['duração máxima .8', {}, {maxDuration: .8}],
    ['Reverso', {reverse: true}, {}],
    ['execução única + easings', {loopStartTime: .1, loopEndTime: .3, entrySmooth: 'ease-in', exitSmooth: 'ease-in'}, {loop: false}],
  ];
  for (const [label, fields, opts] of cases) {
    const pair = makePair(fields, opts);
    const frames = Math.round(2.2 / DT);
    const r = same(pair, frames);
    assert.ok(r.pT.every(t => t != null), 'tempo sempre definido');
    ok(`pipeline idêntico à prévia da arena: ${label} (${frames} frames, emenda conferida)`);
  }
}

// ---------- 1b. com campos configurados, o caminho da prévia é o do JOGO REAL (partida parada em idle) ----------
{
  const m = makeMatch();
  const ch = m.chars[0];
  ch.animProfile = setField(ch.animProfile, 'idle', 'trimStart', 10);
  ch.animProfile = setField(ch.animProfile, 'idle', 'trimEnd', 85);
  ch.animProfile = setField(ch.animProfile, 'idle', 'loopStartTime', .15);
  ch.animProfile = setField(ch.animProfile, 'idle', 'loopEndTime', .35);
  ch.animProfile = setField(ch.animProfile, 'idle', 'cycleSpeed', 1.8);
  ch.refreshVisual();
  const pc = createPreviewCharacter(ch.source).syncFrom(ch);
  const idx = ch.variantsOf('idle')[0];
  // Jogo: localiza a ENTRADA do idle (a partida pode começar noutro estado) e grava o relógio da entrada.
  let entry = null;
  for (let i = 0; i < 400 && !entry; i++) {m.step();if (ch.current?.id === 'idle') entry = {started: ch.current.started, time: ch.current.action.time};}
  assert.ok(entry, 'o idle entrou no jogo');
  const gameT = [];
  for (let i = 0; i < 240; i++) {m.step();gameT.push(ch.current?.action.time);}
  // Prévia: queima o relógio até o MESMO instante da entrada e inicia a prévia ali (p.started == layer.started do jogo).
  while (pc.character.clock < entry.started - 1e-12) pc.step(Math.min(DT, entry.started - pc.character.clock));
  pc.load(idx, {action: 'idle', loop: true});
  pc.step(0);   // a entrada ocorre neste quadro (relógio == started), como no jogo: elapsed = 0
  assert.ok(Math.abs(pc.time() - entry.time) < 1e-12, `quadro da entrada igual (jogo=${entry.time} prévia=${pc.time()})`);
  const prevT = [];
  for (let i = 0; i < gameT.length; i++) {pc.step(DT);prevT.push(pc.character.current?.action.time);}
  assert.equal(prevT.length, gameT.length, 'mesmo número de quadros de idle');
  let maxDiff = 0;
  for (let i = 0; i < gameT.length; i++) maxDiff = Math.max(maxDiff, Math.abs(gameT[i] - prevT[i]));
  assert.ok(maxDiff < 1e-9, ` prévia == jogo real frame a frame (desvio máx ${maxDiff})`);
  ok(`caminho da prévia == caminho do jogo real com trim+laço em segundos+cycleSpeed (240 quadros, desvio < 1e-9)`);
}

// ---------- 2. transporte: play/pause/seek/quadro/laço ----------
{
  const pair = makePair({loopStartTime: .1, loopEndTime: .3, cycleSpeed: 1.4});
  const {pc, idx} = pair;
  pc.load(idx, {action: 'idle', loop: true});
  for (let i = 0; i < 60; i++) pc.step(DT);
  assert.ok(pc.playing() && pc.time() > 0, 'tocando após play');
  const tPlay = pc.time();
  pc.pause();
  for (let i = 0; i < 30; i++) pc.step(DT);
  assert.ok(Math.abs(pc.time() - tPlay) < 1e-12, `pause congela o tempo (${pc.time()} == ${tPlay})`);
  pc.seekTo(.23);
  pc.step(DT);
  assert.ok(Math.abs(pc.time() - .23) < 1e-12, `seek vai ao instante exato (${pc.time()})`);
  pc.stepFrames(1);pc.step(DT);
  assert.ok(Math.abs(pc.time() - (.23 + PREVIEW_FRAME)) < 1e-9, `1 quadro = 1/30 s (${pc.time()})`);
  pc.stepFrames(-2);pc.step(DT);
  assert.ok(Math.abs(pc.time() - (.23 - PREVIEW_FRAME)) < 1e-9, `voltar 2 quadros (${pc.time()})`);
  assert.ok(Math.abs(pc.duration() - pair.arena.clips[idx].duration) < 1e-12, 'duração do clipe');
  pc.setLoop(false);pc.play();
  for (let i = 0; i < Math.ceil(3 / DT); i++) pc.step(DT);
  assert.ok(!pc.playing(), 'execução única termina e para');
  ok('transporte: play do início, pause congela, seek exato, ±1 quadro (1/30 s), duração, laço único termina');
}

// ---------- 3. persist:false não grava nada ----------
{
  const bag = {};
  const real = globalThis.localStorage;
  globalThis.localStorage = {getItem: k => bag[k] ?? null, setItem: (k, v) => {bag[k] = String(v);}, removeItem: k => {delete bag[k];}};
  try {
    const arena = makeCharacter();
    const ref = new Character(arena.source, {persist: true});
    ref.speeds.idle = 2;ref.save();   // referência: o lutador da arena grava (persist:true no jogo real)
    const keysAfterArena = Object.keys(bag).length;
    assert.ok(keysAfterArena > 0, 'arena gravou (referência)');
    const pc = createPreviewCharacter(arena.source).syncFrom(arena);
    pc.load(arena.variantsOf('idle')[0], {action: 'idle'});
    for (let i = 0; i < 10; i++) pc.step(DT);
    pc.character.speeds.idle = 3;pc.character.save();
    pc.character.animProfile = setField(pc.character.animProfile, 'idle', 'cycleSpeed', 2);
    pc.character.save();
    assert.equal(Object.keys(bag).length, keysAfterArena, 'prévia (persist:false) não escreveu nada');
    assert.equal(pc.character.persist, false);
    ok('persist=false: localStorage intacto após reproduzir, editar e salvar a prévia');
  } finally {if (real === undefined) delete globalThis.localStorage;else globalThis.localStorage = real;}
}

// ---------- 4. edição ao vivo (syncFrom no meio da reprodução) ----------
{
  const pair = makePair({});
  const {arena, pc, idx} = pair;
  pc.load(idx, {action: 'idle', loop: true});
  for (let i = 0; i < 60; i++) pc.step(DT);
  // Edição no editor: introSpeed/cycleSpeed novos no lutador da arena → syncFrom → vale no quadro seguinte.
  arena.animProfile = setField(arena.animProfile, 'idle', 'loopStartTime', .05);
  arena.animProfile = setField(arena.animProfile, 'idle', 'loopEndTime', .2);
  arena.animProfile = setField(arena.animProfile, 'idle', 'cycleSpeed', 3);
  arena.refreshVisual();
  pc.syncFrom(arena);
  assert.ok(Math.abs(pc.character.profileValue('idle', 'cycleSpeed') - 3) < 1e-12, 'perfil copiado para a prévia');
  pc.step(DT);
  const deltas = [];
  for (let i = 0; i < 6; i++) {const a = pc.time();pc.step(DT);deltas.push(pc.time() - a);}
  // Novo mapeamento (ciclo [.05,.2] à 3×): no ciclo o avanço por quadro é ≈ cycleSpeed × velocidade efetiva × DT
  // (a velocidade efetiva inclui display.animation.speed — a MESMA que multiplica o jogo em loopScheduleOf).
  const eff = 3 * DT * (C.display.animation.speed || 1);
  assert.ok(deltas.some(d => Math.abs(d - eff) < 1e-9), `cycleSpeed 3 aplicado ao vivo (deltas ${deltas.map(d => d.toFixed(4)).join(',')} vs ${eff.toFixed(4)})`);
  ok('edição ao vivo: syncFrom muda o mapeamento de tempo no quadro seguinte, sem reiniciar o clipe');
}

// ---------- 5. createAnimationPreview: renderização sob demanda e fallback sem WebGL ----------
{
  const arena = makeCharacter();
  const renders = [];
  const fakeCanvas = {dataset: {}, style: {}};
  const stub = {domElement: fakeCanvas, setPixelRatio() {}, setSize() {}, render() {renders.push(1);}, getContext() {return null;}, dispose() {}};
  const mount = {clientWidth: 320, clientHeight: 200, appendChild() {}, removeChild() {}};
  const vp = createAnimationPreview({mount, rendererFactory: () => stub});
  assert.ok(vp.available, 'renderer stub criado');
  assert.ok(vp.loadFrom(arena, arena.variantsOf('idle')[0], {action: 'idle'}), 'loadFrom');
  const f0 = vp.frames();
  vp.show();
  await new Promise(r => setTimeout(r, 60));
  const f1 = vp.frames();
  assert.ok(f1 > f0, `renderiza quando visível (${f0} → ${f1} frames)`);
  vp.pause();vp.seekTo(.1);vp.stepFrames(1);
  assert.ok(Math.abs(vp.time() - (.1 + PREVIEW_FRAME)) < 1e-9, 'transporte da viewport via API');
  vp.hide();
  await new Promise(r => setTimeout(r, 40));
  const f2 = vp.frames();
  await new Promise(r => setTimeout(r, 40));
  assert.equal(vp.frames(), f2, 'rAF pausado quando oculto');
  assert.ok(vp.character() && vp.character().root, 'personagem de prévia anexado à cena própria');
  // Fallback: WebGL indisponível → available false, nada lança.
  const vpBad = createAnimationPreview({mount, rendererFactory: () => {throw Error('sem webgl');}});
  assert.equal(vpBad.available, false, 'falha de WebGL vira fallback (available=false)');
  vpBad.show();vpBad.hide();vpBad.dispose();
  vp.dispose();
  ok('viewport: renderiza só visível (rAF próprio), transporte via API, falha de WebGL → fallback limpo');
}

console.log(`\n${n} verificações da viewport 3D do editor de animações aprovadas.`);
process.exit(0);
