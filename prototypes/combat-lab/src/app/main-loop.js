// @ts-check
// Dividido de main.js (comportamento idêntico): main-loop.

import {applyInterpolation} from '../sim/interpolation.js';
import {C} from '../sim/config.js';
import {Character} from '../view/characters.js';
import {length} from '../sim/math.js';
import {$, boostFeedback, canvas, cinePanel, clock, diagnostics, dock, game, hud, hudProposals, input, movesHud, passivesHud, perfPanel, progressHud, renderCharacterLive, replay, ui, view, visualPanel, windowsOverlay} from '../main.js';
import {stepOnce} from './match-flow.js';
import {checkKoTrigger, lastKoHandled, moveNotices} from './match-stats.js';
import {renderHistory, renderLive, updateActionHintPill, updateDojoAdvantageBadge, updateOffscreenArrow} from './live-panels.js';
import {renderRecStatus} from './scenario-flow.js';

export let last = performance.now(), uiTimer = 0;

export function frame(now) {
  const dt = Math.max(0, (now - last) / 1000);last = now;
  const live = !ui.paused && (game.phase === 'playing' || game.phase === 'finishing');
  Character.isLiveCombat = live;
  const tSim = performance.now();let steps = 0;
  if (live) clock.advance(dt, () => {steps++;stepOnce();});else clock.reset();
  const simMs = performance.now() - tSim;
  ui.fps += (1 / Math.max(.001, dt) - ui.fps) * C.extras.hud.fpsSmoothing;
  // Interpolação do desenho (só visual): pose entre o passo anterior e o atual; a simulação é restaurada logo depois.
  const interp = C.display.interpolation, restorePose = live && interp?.enabled ? applyInterpolation(game.fighters, game.prevPose, clock.accumulator / C.test.step, interp.maxJump) : null;
  try {view.draw(game.fighters, game.events, live ? dt * clock.timeScale : 0, {paused: !live, realDt: dt, tick: game.tick, sources: [C.extras.toggles.enablePlayerAI || ui.scenario ? 'IA' : 'jogador', 'IA'], world: game.world, navGame: game});} finally {restorePose?.();}
  const back = replay.length ? (replay.length - 1 - replay.cursor) : 0;
  hud.render(game, ui.fps, {locked: input.locked, paused: ui.paused && game.phase !== 'menu', replay: back ? `−${back} passos (${(back * C.test.step * 1000).toFixed(0)} ms) · ▶ retoma daqui` : 'último passo · , e . avançam/voltam', playerAI: !!C.extras.toggles.enablePlayerAI});
  movesHud.render(game);moveNotices();progressHud.render(game);
  boostFeedback.update(game, {live, view, movesHud});
  passivesHud.render(game, C.extras.toggles.enablePassives !== 0);
  $('rp-readout').textContent = `passo ${game.tick}${back ? ` · −${(back * C.test.step).toFixed(2)} s` : ''}${clock.timeScale !== 1 ? ` · ${clock.timeScale}×` : ''}`;
  dock.render();updateDojoAdvantageBadge();hudProposals.render(game, live ? dt * clock.timeScale : 0);windowsOverlay.update();perfPanel.frame({frameMs: dt * 1000, simMs, steps});cinePanel?.updateBadge?.();updateOffscreenArrow(canvas.clientWidth, canvas.clientHeight);updateActionHintPill();if (game.phase === 'result' && !lastKoHandled) checkKoTrigger();
  if ((uiTimer += dt) > .1) {uiTimer = 0;renderLive();renderHistory();renderCharacterLive();renderRecStatus();visualPanel.live();diagnostics.live();perfPanel.live();}
  ui.frame++;requestAnimationFrame(frame);
}
