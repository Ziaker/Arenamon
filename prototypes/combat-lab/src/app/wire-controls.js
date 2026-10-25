// @ts-check
// Dividido de main.js (comportamento idêntico): wire-controls.

import {C} from '../sim/config.js';
import {AI_MODES, UI_AI_MODES} from '../sim/ai.js';
import {soundFx} from '../view/audio.js';
import {applySeed, cycleOpponentAiMode, goLive, onQuickStart, resetArenaFighters, seekTick, startMatch, stepFrames, togglePause, toggleZenMode} from './match-flow.js';
import {abortScenario} from './scenario-flow.js';
import {dragResize, openTool, store, stored, syncButtons, syncDockButtons, toggleChars, toggleMoves} from './live-panels.js';
import {updateAudioBtn} from './match-stats.js';
import {$, canvas, clock, diagnostics, game, hud, input, input2, presets, quick, tuning, ui, view} from '../main.js';

export function wireControls() {
// ---------- Controles ----------
// Atalho da troca A × B: qualquer tecla que não seja usada pelo jogador (avisa se coincidir).
{
  const codes = [...new Set(['KeyB', 'KeyN', 'KeyM', 'KeyV', 'KeyG', 'KeyH', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Backquote', 'F2', 'F4', ...C.extras.keyCodes])];
  $('ab-key').replaceChildren(...codes.map(c => new Option(c.replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow', 'Seta '), c)));$('ab-key').value = presets.abKey;
  $('ab-key').onchange = e => {const code = e.target.value, used = Object.entries(C.extras.bindings).find(([, i]) => C.extras.keyCodes[i] === code);presets.setABKey(code);$('ab-key').title = used ? `Atenção: ${code} também é a tecla de “${used[0]}”` : '';if (used) $('ab-key').setCustomValidity?.('tecla em uso');};
}
$('mode').replaceChildren(...UI_AI_MODES.map(([id, label]) => new Option(label, id)));
$('mode').value = game.mode;
$('player-mode').replaceChildren(...UI_AI_MODES.filter(([id]) => id !== 'inactive').map(([id, label]) => new Option(label, id)));
$('player-mode').value = ui.playerMode;
$('mode').onchange = () => {game.mode = $('mode').value;C.extras.gameModes.enemyMode = AI_MODES.findIndex(([id]) => id === game.mode);game.brain.reset();syncButtons();};
$('profile').onchange = () => {C.extras.gameModes.playerProfile = ['balanced', 'agile', 'resistant'].indexOf($('profile').value);};
$('player-mode').onchange = () => {ui.playerMode = $('player-mode').value;game.playerBrain.reset();};
$('seed').onchange = () => {$('seed-fixed').checked = true;applySeed();};
$('show-history').onchange = e => {$('input-history').hidden = !e.target.checked;};
$('arena-zen-toggle').onclick = () => toggleZenMode();
$('arena-hitboxes-toggle').onclick = () => {const v = C.extras.toggles.showHitboxes ? 0 : 1;tuning.commit([['extras.toggles.showHitboxes', v], ['extras.toggles.showAttackVectors', v]], 'Hitboxes');canvas.focus();};
}

export function wireToolbar() {
$('arena-toast-toggle').onclick = () => {tuning.commit([['display.diagnostics.toast', C.display.diagnostics.toast ? 0 : 1]], 'Avisos de comando');syncButtons();canvas.focus();};
$('arena-enemy-ai-toggle').onclick = () => {tuning.commit([['extras.toggles.enableEnemyAI', C.extras.toggles.enableEnemyAI ? 0 : 1]], 'IA do oponente');game.brain.reset();syncButtons();canvas.focus();};
$('arena-autoplay-toggle').onclick = () => {tuning.commit([['extras.toggles.enablePlayerAI', C.extras.toggles.enablePlayerAI ? 0 : 1]], 'IA do jogador');game.playerBrain.reset();input.clear();canvas.focus();};
$('pause').onclick = () => togglePause();
$('restart-top').onclick = startMatch;
$('restart').onclick = startMatch;
$('start').onclick = startMatch;
$('start-center').onclick = onQuickStart;
$('btn-rematch')?.addEventListener('click', () => {$('overlay').hidden = true;startMatch();});
$('btn-new-match')?.addEventListener('click', () => {$('overlay').hidden = true;$('seed-fixed').checked = false;startMatch();});
$('btn-review-replay')?.addEventListener('click', () => {$('overlay').hidden = true;seekTick(0);togglePause(false);});
$('audio-toggle')?.addEventListener('click', () => {soundFx.toggle();updateAudioBtn();});
updateAudioBtn();
$('resume').onclick = () => togglePause(false);
$('back').onclick = () => {abortScenario();game.phase = 'menu';input.clear();};
$('debug-toggle').onclick = () => {hud.debug = !hud.debug;C.extras.hud.debugVisible = Number(hud.debug);canvas.focus();};
$('camera-reset').onclick = () => {view.reset(game.fighters[0]);canvas.focus();};
$('rp-back').onclick = () => stepFrames(-1);
$('rp-fwd').onclick = () => stepFrames(1);
$('rp-play').onclick = () => togglePause();
$('rp-live').onclick = goLive;
$('rp-speed').onchange = () => {clock.timeScale = Number($('rp-speed').value) || 1;};
$('dock-toggle').onclick = () => {$('dock').classList.toggle('collapsed');syncDockButtons();};
$('dock-collapse').onclick = $('dock-toggle').onclick;
syncDockButtons();
$('dock-reopen').onclick = $('dock-toggle').onclick;
}

export function wireDrawers() {
{
  const panelEl = $('panel'), w0 = stored('arenamon.panelW');if (w0 >= 280) panelEl.style.width = w0 + 'px';
  dragResize($('panel-resizer'), e => ({x: e.clientX, w: panelEl.getBoundingClientRect().width}), (s, ev) => {panelEl.style.width = Math.max(280, Math.min(window.innerWidth - 190, s.w + ev.clientX - s.x)) + 'px';}, () => store('arenamon.panelW', Math.round(panelEl.getBoundingClientRect().width)), () => {panelEl.style.width = '';store('arenamon.panelW', null);});
  const dockEl = $('dock'), h0 = stored('arenamon.dockH'), root = document.documentElement;if (h0 >= 90) root.style.setProperty('--dock-h', h0 + 'px');
  dragResize($('dock-resizer'), e => ({y: e.clientY, h: dockEl.getBoundingClientRect().height}), (s, ev) => {root.style.setProperty('--dock-h', Math.max(90, Math.min(window.innerHeight * .75, s.h - (ev.clientY - s.y))) + 'px');}, () => store('arenamon.dockH', Math.round(dockEl.getBoundingClientRect().height)), () => {root.style.removeProperty('--dock-h');store('arenamon.dockH', null);});
}
if ($('panel-layout-toggle')) {
  $('panel-layout-toggle').onclick = () => {
    const p = $('panel'), next = p.dataset.layout === 'sidebar' ? 'bento' : 'sidebar';
    p.dataset.layout = next;
    $('panel-layout-toggle').setAttribute('aria-pressed', String(next === 'bento'));
    $('panel-layout-toggle').textContent = next === 'bento' ? '⊞ Grade' : '▯ Lateral';
  };
}
if ($('panel-hints-toggle')) {
  $('panel-hints-toggle').onclick = () => {
    const on = $('panel').classList.toggle('show-hints');
    $('panel-hints-toggle').setAttribute('aria-pressed', String(on));
  };
}
$('moves-open').onclick = () => toggleMoves();
$('moves-close').onclick = () => toggleMoves(false);
$('chars-open').onclick = () => toggleChars();
$('chars-close').onclick = () => toggleChars(false);
window.addEventListener('keydown', e => {if (e.key === 'Escape' && !$('chars-drawer').hidden && !e.target.matches?.('input[type=text],input[type=search]')) {e.preventDefault();e.stopImmediatePropagation();toggleChars(false);}}, true);
window.addEventListener('keydown', e => {if (e.key === 'Escape' && !$('moves-drawer').hidden && !e.target.matches?.('input[type=text],input[type=search]')) {e.preventDefault();e.stopImmediatePropagation();toggleMoves(false);}}, true);
for (const b of document.querySelectorAll('[data-tool]')) b.onclick = () => openTool(b.dataset.tool);
$('panel-close').onclick = () => {$('panel').hidden = true;for (const b of document.querySelectorAll('[data-tool]')) b.classList.remove('active');};
}

export function wireKeyboard() {
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {e.preventDefault();quick.isOpen() ? quick.hide() : quick.show('params');return;}
  if (quick.isOpen()) return;
  const typing = e.target.matches('input[type=text],input[type=search],input[type=number],textarea,select');
  if ((e.ctrlKey || e.metaKey) && !typing) {const k = e.key.toLowerCase();if (k === 'z' && !e.shiftKey) {e.preventDefault();tuning.undo();}else if (k === 'y' || (k === 'z' && e.shiftKey)) {e.preventDefault();tuning.redo();}return;}
  if (typing) return;
  if (e.key === '/' ) {e.preventDefault();quick.show('params');return;}
  if (e.key === '?') {e.preventDefault();quick.show('keys');return;}
  // Atalhos de combate (Space, R, H, F2, M, Backspace/F4, F5) são tratados pelo Input
  if (e.code === 'KeyM') {e.preventDefault();soundFx.toggle();updateAudioBtn();}
  if (e.code === 'Backspace' || e.code === 'F4') {e.preventDefault();resetArenaFighters();}
  if (e.code === 'F5') {e.preventDefault();cycleOpponentAiMode();}

  if (e.key === ',') {e.preventDefault();stepFrames(-1);}else if (e.key === '.') {e.preventDefault();stepFrames(1);}
  else if (e.code === presets.abKey && presets.ab.active && !e.repeat) {e.preventDefault();presets.toggleAB();}
});
window.addEventListener('blur', () => {input.clear();input2.clear();});
document.addEventListener('visibilitychange', () => {if (document.hidden && game.phase === 'playing') togglePause(true);});
}
