// @ts-check
// Dividido de main.js (comportamento idêntico): match-flow.

import {C} from '../sim/config.js';
import {AI_MODES, UI_AI_MODES} from '../sim/ai.js';
import {resetCollisionProbe} from '../sim/collision-probe.js';
import {findMoveRunStart} from '../sim/move-timeline.js';
import {emptyCommand} from '../sim/entity.js';
import {length} from '../sim/math.js';
import {$, canvas, clock, diagnostics, dock, game, input, input2, matchRec, movement, passivesPanel, presets, quickMenu, recorder, replay, training, tuning, ui, view} from '../main.js';
import {abortScenario, finishScenario, renderRecStatus, restorePlaybackValues} from './scenario-flow.js';
import {syncButtons, syncDockButtons} from './live-panels.js';
import {checkKoTrigger, handleSoundEvents, passiveFeedback, resetMatchStats, trackChargeSounds, trackExhaustionSounds, trackMatchEvents} from './match-stats.js';
import {frame} from './main-loop.js';

// ---------- Partida ----------
export let warmingUp = false;

export async function triggerWarmup({force = false} = {}) {
  if (warmingUp) return;
  if (!force && view.isWarmedUp) return;
  const hasModels = ui.characters[0] || ui.characters[1];
  if (!hasModels && !force) return;
  const loader = $('arena-loader'), msg = $('loader-msg'), bar = $('loader-bar');
  if (loader && !navigator.webdriver) {
    loader.hidden = false;
    loader.style.opacity = '1';
  }
  warmingUp = true;
  try {
    await view.warmUp(ui.characters, {
      onProgress: (p, text) => {
        if (bar) bar.style.width = `${Math.round(p * 100)}%`;
        if (msg && text) msg.textContent = text;
      }
    });
  } catch (err) {
    console.warn('warmup error:', err);
  } finally {
    warmingUp = false;
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => { loader.hidden = true; }, 280);
    }
  }
}

export function resetViewAndLogs() {resetCollisionProbe();view.reset(game.fighters[0]);recorder.clear();replay.clear();pushReplay();dock.invalidate();clock.reset();}

export function startMatch({playback = null} = {}) {
  if (ui.training) {training.end();}
  abortScenario();restorePlaybackValues();ui.playback = playback;
  if (!playback && !$('seed-fixed').checked) $('seed').value = String(1 + Math.floor(Math.random() * 99999));
  applySeed();game.profile = $('profile').value;game.enemyProfile = $('enemy-profile').value;game.mode = $('mode').value;
  passivesPanel.applyTo(game);   // identidade + loadouts validados (R5: recusa duplicata/exclusiva errada)
  game.reset();ui.paused = false;input.clear();input.locked = false;resetViewAndLogs();canvas.focus();syncButtons();resetMatchStats();
  matchRec.start({seed: Number($('seed').value), profile: game.profile, enemyProfile: game.enemyProfile, mode: game.mode, values: tuning.snapshotValues(),
    loadouts: game.passiveLoadouts, identity: game.passiveIdentity});renderRecStatus();
  if (!view.isWarmedUp && (ui.characters[0] || ui.characters[1]) && !navigator.webdriver) {
    triggerWarmup();
  }
}

export function toggleZenMode(force) {
  const lab = document.querySelector('.lab');
  if (!lab) return;
  const next = force ?? !lab.classList.contains('zen-mode');
  lab.classList.toggle('zen-mode', next);
  syncButtons();
  if (next) {
    $('panel').hidden = true;
    for (const b of document.querySelectorAll('[data-tool]')) b.classList.remove('active');
    $('dock').classList.add('collapsed');
    $('dock-toggle')?.classList.remove('active');$('dock-collapse')?.setAttribute('aria-expanded', 'false');
  } else {
    $('dock').classList.remove('collapsed');
    $('dock-toggle')?.classList.add('active');
  }
  syncDockButtons();canvas.focus();
}

export function togglePause(force) {
  if (game.phase === 'menu') return;
  const next = force ?? !ui.paused;
  if (!next && !replay.atEnd) {recorder.truncate(game.tick);matchRec.truncate(game.tick);} // retoma a partir do ponto do replay: o futuro gravado é descartado
  if (!next && ui.playback?.ended) ui.playback = null;
  ui.paused = next;input.clear();syncButtons();
}

export function pushReplay() {replay.push({tick: game.tick, game: game.save(), rig: view.rig.save()});}

export function loadFrame(frame) {if (!frame) return;resetCollisionProbe();game.load(frame.game);view.rig.load(frame.rig);dock.invalidate();}

export function playerCommand() {
  const [p, e] = game.fighters;
  if (C.extras.toggles.enablePlayerAI) {input.locked = true;return game.assistNav(game.playerBrain, p, e, game.playerBrain.command(p, e, ui.playerMode, C.test.step));}
  return input.command(p, e, view.rig.yaw, game.tick);
}

/** Um passo de simulação ao vivo (jogo normal ou cenário). */
export function stepOnce() {
  if (ui.scenario) {
    const [a, b] = ui.scenario.commands();game.step(a, b);view.rig.step(game.fighters[0], game.fighters[1], true, C.test.step);
    recorder.record(game);ui.scenario.observe();pushReplay();
    if (ui.scenario.done) finishScenario();
    return;
  }
  let c0;
  if (ui.playback) {
    // Fim da gravação: para no último passo gravado (inclusive os passos restantes deste mesmo quadro).
    if (ui.playback.ended) return;
    c0 = ui.playback.commands[game.tick] ?? emptyCommand();
    if (game.tick >= ui.playback.commands.length) {ui.playback.ended = true;ui.playback.onEnd?.();togglePause(true);$('rec-result').innerHTML = '<p class="ok">Fim da gravação: a partida ficou pausada no último passo gravado.</p>';return;}
  } else c0 = playerCommand();
  const c1 = ui.training && !ui.playback ? ui.training.enemyCommand(game) : ui.playback ? ui.playback.commands1?.[game.tick] ?? undefined : C.extras.toggles.enemyManual ? input2.command(game.fighters[1], game.fighters[0], view.rig.yaw, game.tick) : undefined;
  presets.ab.beforeStep(game);
  const tickBefore = game.tick;game.step(c0, c1 ?? undefined);if (game.tick > tickBefore) {matchRec.record(tickBefore, c0, c1);if (!ui.playback) movement.onStep(c0, game.lastCommands?.[1]);if (ui.training) training.afterStep(c0);}view.rig.step(game.fighters[0], game.fighters[1], input.locked, C.test.step);
  if (game.lastStepEvents?.length) {handleSoundEvents(game.lastStepEvents);trackMatchEvents(game.lastStepEvents);passiveFeedback(game.lastStepEvents);}
trackChargeSounds();trackExhaustionSounds();checkKoTrigger();
recorder.record(game);pushReplay();
}

export function stepFrames(delta) {
  if (game.phase === 'menu') return;
  togglePause(true);if (delta > 0 && ui.playback?.ended) ui.playback = null;
  if (delta < 0) loadFrame(replay.step(-1));
  else if (!replay.atEnd) loadFrame(replay.step(1));
  else if (game.phase === 'playing' || game.phase === 'finishing') {stepOnce();}
}

export function seekTick(tick) {
  if (!replay.length) return;togglePause(true);
  let lo = 0, hi = replay.length - 1;while (lo < hi) {const mid = (lo + hi) >> 1;if (replay.frames[mid].tick < tick) lo = mid + 1;else hi = mid;}
  loadFrame(replay.seek(lo));
}

/** Aba Moves › linha do tempo: pausa o replay no tick (relativo ao começo da ação) da última vez que o Move foi usado pelo azul. */
export function seekMoveTick(moveId, rel) {
  if (!replay.length) return {ok: false, msg: 'Ainda não há replay: inicie uma partida e use o Move.'};
  const start = findMoveRunStart(replay.frames, moveId, 0);
  if (start === null) return {ok: false, msg: 'Este Move não aparece nos últimos 12 s do replay: use-o na partida e tente de novo.'};
  const tick = start + rel;
  if (tick > replay.frames[replay.length - 1].tick) return {ok: false, msg: `O replay termina no tick ${replay.frames[replay.length - 1].tick}; a marca cairia no tick ${tick}, depois do fim.`};
  seekTick(tick);
  return {ok: true, msg: `Replay pausado no tick ${tick} da partida (começo da ação: tick ${start}; marca +${rel}). A conversão pode variar ±1 tick; use os botões de quadro para ajustar.`};
}

export function goLive() {if (!replay.length) return;loadFrame(replay.seek(replay.length - 1));togglePause(false);}

export function applySeed() {const s = Math.max(1, Math.round(Number($('seed').value) || 1));game.brain.seed = s;game.playerBrain.seed = s + 7919;game.brain.reset();game.playerBrain.reset();}

export function resetArenaFighters() {
  game.fighters[0].position = {x: 0, z: -4};
  game.fighters[0].hp = game.fighters[0].attributes.hp;
  game.fighters[0].stamina = C.rules.staminaMax;
  game.fighters[0].state = 'idle';
  game.fighters[0].flight = null;
  game.fighters[0].action = null;
  game.fighters[0].charge = null;

  game.fighters[1].position = {x: 0, z: 2};
  game.fighters[1].hp = game.fighters[1].attributes.hp;
  game.fighters[1].stamina = C.rules.staminaMax;
  game.fighters[1].state = 'idle';
  game.fighters[1].flight = null;
  game.fighters[1].action = null;
  game.fighters[1].charge = null;

  game.hitstop = 0;
  game.phase = 'playing';
  view.reset(game.fighters[0]);
  diagnostics.toast?.({text: 'Arena resetada: posições e HP/Stamina restaurados', fighter: 0, kind: 'info'});
}

export function cycleOpponentAiMode() {
  const modes = UI_AI_MODES.map(([id]) => id);
  const cur = $('mode').value;
  const idx = modes.indexOf(cur);
  const next = modes[(idx + 1) % modes.length];
  $('mode').value = next;
  game.mode = next;
  C.extras.gameModes.enemyMode = AI_MODES.findIndex(([id]) => id === game.mode);
  game.brain.reset();
  syncButtons();
  diagnostics.toast?.({text: `Modo do oponente: ${UI_AI_MODES.find(([id]) => id === next)[1]}`, fighter: 1, kind: 'info'});
}

export function onQuickStart() {
  if ($('quick-profile')) $('profile').value = $('quick-profile').value;
  if ($('quick-enemy-profile')) $('enemy-profile').value = $('quick-enemy-profile').value;
  if ($('quick-mode')) {
    $('mode').value = $('quick-mode').value;
    game.mode = $('mode').value;
    C.extras.gameModes.enemyMode = AI_MODES.findIndex(([id]) => id === game.mode);
  }
  quickMenu.applyAll();   // moves dos dois lutadores + passivas (identidade e validação do painel, R5)
  if ($('quick-auto-zen')?.checked) toggleZenMode(true);
  if ($('quick-auto-lock')?.checked) input.locked = true;
  startMatch();
}
