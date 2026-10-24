// Laboratório de combate Arenamon v7 — composição: simulação, câmera, HUD, entrada, replay, telemetria,
// cenários, ajustador, personagens do Studio, exportação e aviso de alterações não salvas.

import {C, keyFor, keyFor2, defaults, resetConfig as resetCfg, useFactoryDefaults} from './sim/config.js';
if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('fabrica')) {useFactoryDefaults(true);resetCfg(defaults());}   // ?fabrica=1: valores de fábrica, sem a base de calibração v8
import {Game, FixedClock} from './sim/game.js';
import {AI_MODES, UI_AI_MODES} from './sim/ai.js';

import {Recorder} from './sim/telemetry.js';
import {ReplayBuffer} from './sim/replay.js';
import {SCENARIOS, runScenario} from './sim/scenarios.js';


import {View} from './view/view.js';
import {loadStudioFile, studioWindows} from './view/characters.js';
import {createCharacterPanel} from './ui/characters-panel.js';
import {createVisualPanel} from './ui/visual-panel.js';
import {HudProposals} from './ui/hud-proposals.js';
import {ProgressHud} from './ui/progress-hud.js';
import {Hud} from './ui/hud.js';
import {Input} from './ui/input.js';
import {createTuning} from './ui/tuning.js';
import {createDock} from './ui/dock.js';
import {createHomologation} from './ui/homologation.js';


import {MatchRecording} from './sim/recording.js';


import {createPresetsPanel} from './ui/presets-panel.js';
import {createQuickPanel} from './ui/quick-panel.js';
import {createActionsDrawer} from './ui/actions-drawer.js';
import {createMovementPanel} from './ui/movement-panel.js';
import {createDiagnostics, createWindowsOverlay} from './ui/diagnostics-panel.js';
import {createTrainingPanel} from './ui/training-panel.js';
import {createMovesPanel, MOVE_INFO} from './ui/moves-panel.js';
import {createMovesVisual} from './ui/moves-vfx-panel.js';
import {MovesHud} from './ui/moves-hud.js';
import {createPassivesPanel} from './ui/passives-panel.js';
import {installHoverTip} from './ui/hover-tip.js';
import {createQuickMenu} from './ui/menu-quick.js';
import {createMenuStyles} from './ui/menu-styles.js';
import {keyLabel} from './ui/menu-styles-model.js';
import {PassivesHud} from './ui/passives-hud.js';

import {createPerfPanel} from './ui/perf-panel.js';
import {createAiEvalPanel} from './ui/ai-eval-panel.js';

import {createCinematicPanel} from './ui/cinematic-camera-panel.js';
import * as Moves from './sim/moves.js';
import {registerStandardMoves, STANDARD_MOVE_IDS} from './sim/moves/standard.js';
/* global __GAME_CONFIG_TS__ */
export const GAME_CONFIG_TS = typeof __GAME_CONFIG_TS__ === 'string' ? __GAME_CONFIG_TS__ : '';

import {spawn} from './sim/world.js';


import {soundFx} from './view/audio.js';
import {applySeed, cycleOpponentAiMode, goLive, onQuickStart, resetArenaFighters, resetViewAndLogs, seekMoveTick, seekTick, startMatch, stepFrames, togglePause, toggleZenMode, triggerWarmup} from './app/match-flow.js';
import {abortScenario, playSequence, renderRecStatus, renderScenarios, reportHtml, restorePlaybackValues, startScenario} from './app/scenario-flow.js';
import {applyConfig, download, gamePatch, syncCompareOptions, syncTuneState} from './app/tuning-sync.js';
import {dragResize, foldStaticSections, openTool, store, stored, syncButtons, syncDockButtons, toggleChars, toggleMoves} from './app/live-panels.js';
import {ANIM_SLIDERS, charHooks, refreshAnimSliders, renderRuleDurations, renderStudioEvents, syncCharacterCombatWindows, syncRuleDurations} from './app/characters-sync.js';
import {updateAudioBtn} from './app/match-stats.js';
import {frame} from './app/main-loop.js';
import {bootWorkspace, projectFiles, reportsOf} from './app/workspace-boot.js';
import {wireRecording} from './app/wire-recording.js';
import {wireExport, wireOverlays, wireTuningPersistence} from './app/wire-settings.js';
import {wireCharacters} from './app/wire-characters.js';

// Moves padrão (D2): registrados aqui, no bootstrap do laboratório, nunca no núcleo da simulação. Registrar não equipa nenhum slot.
registerStandardMoves();

export const $ = id => document.getElementById(id);
export const canvas = document.querySelector('.stage canvas');
export const game = new Game(), clock = new FixedClock(), hud = new Hud(), recorder = new Recorder(), replay = new ReplayBuffer();
export let view;
try {view = new View(canvas);} catch (e) {$('fatal').hidden = false;throw e;}
export const matchRec = new MatchRecording();
/** Workspace persistente (preenchido quando o armazenamento abre; ver bootWorkspace). */
export const wsRef = {ws: null, ui: null, store: null};
export const ui = {playback: null, paused: false, scenario: null, playerMode: 'tactical', lastResult: null, fps: 60, characters: [null, null], sources: [null, null], frame: 0};
// Vermelho no controle manual (Partida › Controle manual do vermelho): teclas e gamepad próprios.
export const input2 = new Input(canvas, () => {}, {slot: 1});
export const input = new Input(canvas, code => {
  if (code === keyFor('pause')) togglePause();
  if ((code === keyFor('restart') || code === 'KeyR') && game.phase !== 'menu') {if (ui.training) training.begin();else startMatch();}
  if (code === keyFor('debug') || code === 'F3') {hud.debug = !hud.debug;C.extras.hud.debugVisible = Number(hud.debug);}
  if (code === 'KeyH') {
    const v = C.extras.toggles.showHitboxes ? 0 : 1;
    tuning.commit([['extras.toggles.showHitboxes', v], ['extras.toggles.showAttackVectors', v]], 'Hitboxes');
    syncButtons();
  }
  if (code === 'F2') {
    toggleZenMode();
  }
});
input.visionWorld = () => game.world;   // lock-on do cegado precisa conferir paredes no mundo da partida
wireRecording();

export const tuning = createTuning({apply: applyConfig});
// Presets (sensação, completos e por categoria), calibração simplificada, modo simples/avançado e A × B jogável.
export const presets = createPresetsPanel({tuning, $, game, download: (...a) => download(...a)});
export const quick = createQuickPanel({$, tuning, presets, onOpen: () => input.clear()});
export const movement = createMovementPanel({$, game, ui, presets, tuning, download: (...a) => download(...a), playSequence: (...a) => playSequence(...a), getWs: () => wsRef.ws});
wireTuningPersistence();

export const homologation = createHomologation($('homolog-list'));
wireExport();

wireOverlays();

export const charPanel = createCharacterPanel({ui, view, $, hooks: charHooks, onCharactersChanged: () => {syncCharacterCombatWindows();syncRuleDurations();dock.invalidate();movesPanel?.render?.();actionsDrawer?.render?.();}});
syncCharacterCombatWindows();
export const renderCharacters = () => {charPanel.render();renderStudioEvents();renderRuleDurations();passivesPanel.render();};
const setCharacter = (id, source) => charPanel.setCharacter(id, source);
export const renderCharacterLive = () => charPanel.live();
wireCharacters();


// ---------- Controles ----------
// Atalho da troca A × B: qualquer tecla que não seja usada pelo jogador (avisa se coincidir).
{
  const codes = [...new Set(['KeyB', 'KeyN', 'KeyM', 'KeyV', 'KeyG', 'KeyH', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Backquote', 'F2', 'F4', ...C.extras.keyCodes])];
  $('ab-key').replaceChildren(...codes.map(c => new Option(c.replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow', 'Seta '), c)));$('ab-key').value = presets.abKey;
  $('ab-key').onchange = e => {const code = e.target.value, used = Object.entries(C.extras.bindings).find(([, i]) => C.extras.keyCodes[i] === code);presets.setABKey(code);$('ab-key').title = used ? `Atenção: ${code} também é a tecla de “${used[0]}”` : '';if (used) $('ab-key').setCustomValidity?.('tecla em uso');};
}
$('mode').replaceChildren(...UI_AI_MODES.map(([id, label]) => new Option(label, id)));$('mode').value = game.mode;
$('player-mode').replaceChildren(...UI_AI_MODES.filter(([id]) => id !== 'inactive').map(([id, label]) => new Option(label, id)));$('player-mode').value = ui.playerMode;
$('mode').onchange = () => {game.mode = $('mode').value;C.extras.gameModes.enemyMode = AI_MODES.findIndex(([id]) => id === game.mode);game.brain.reset();syncButtons();};
$('profile').onchange = () => {C.extras.gameModes.playerProfile = ['balanced', 'agile', 'resistant'].indexOf($('profile').value);};
$('player-mode').onchange = () => {ui.playerMode = $('player-mode').value;game.playerBrain.reset();};
$('seed').onchange = () => {$('seed-fixed').checked = true;applySeed();};
$('show-history').onchange = e => {$('input-history').hidden = !e.target.checked;};
$('arena-zen-toggle').onclick = () => toggleZenMode();
$('arena-hitboxes-toggle').onclick = () => {const v = C.extras.toggles.showHitboxes ? 0 : 1;tuning.commit([['extras.toggles.showHitboxes', v], ['extras.toggles.showAttackVectors', v]], 'Hitboxes');canvas.focus();};
const toolsPop = $('tools-pop'), toolsBtn = $('tools-toggle');
function closeTools() {if (toolsPop.hidden) return;toolsPop.hidden = true;toolsBtn.setAttribute('aria-expanded', 'false');}
toolsBtn.onclick = e => {e.stopPropagation();if (!toolsPop.hidden) {closeTools();return;}toolsPop.hidden = false;toolsBtn.setAttribute('aria-expanded', 'true');const r = toolsBtn.getBoundingClientRect(), w = toolsPop.getBoundingClientRect().width;toolsPop.style.top = (r.bottom + 6) + 'px';toolsPop.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';};
document.addEventListener('pointerdown', e => {if (!toolsPop.hidden && !toolsPop.contains(e.target) && e.target !== toolsBtn) closeTools();});
window.addEventListener('keydown', e => {if (e.key === 'Escape' && !toolsPop.hidden) {e.preventDefault();e.stopImmediatePropagation();closeTools();}}, true);
$('arena-toast-toggle').onclick = () => {tuning.commit([['display.diagnostics.toast', C.display.diagnostics.toast ? 0 : 1]], 'Avisos de comando');syncButtons();canvas.focus();};
$('arena-enemy-ai-toggle').onclick = () => {tuning.commit([['extras.toggles.enableEnemyAI', C.extras.toggles.enableEnemyAI ? 0 : 1]], 'IA do oponente');game.brain.reset();syncButtons();canvas.focus();};
$('arena-autoplay-toggle').onclick = () => {tuning.commit([['extras.toggles.enablePlayerAI', C.extras.toggles.enablePlayerAI ? 0 : 1]], 'IA do jogador');game.playerBrain.reset();input.clear();canvas.focus();};
$('pause').onclick = () => togglePause();$('restart-top').onclick = startMatch;$('restart').onclick = startMatch;$('start').onclick = startMatch;$('start-center').onclick = onQuickStart;
$('btn-rematch')?.addEventListener('click', () => {$('overlay').hidden = true;startMatch();});
$('btn-new-match')?.addEventListener('click', () => {$('overlay').hidden = true;$('seed-fixed').checked = false;startMatch();});
$('btn-review-replay')?.addEventListener('click', () => {$('overlay').hidden = true;seekTick(0);togglePause(false);});
$('audio-toggle')?.addEventListener('click', () => {soundFx.toggle();updateAudioBtn();});updateAudioBtn();
$('resume').onclick = () => togglePause(false);$('back').onclick = () => {abortScenario();game.phase = 'menu';input.clear();};
$('debug-toggle').onclick = () => {hud.debug = !hud.debug;C.extras.hud.debugVisible = Number(hud.debug);canvas.focus();};
$('camera-reset').onclick = () => {view.reset(game.fighters[0]);canvas.focus();};
$('rp-back').onclick = () => stepFrames(-1);$('rp-fwd').onclick = () => stepFrames(1);$('rp-play').onclick = () => togglePause();$('rp-live').onclick = goLive;
$('rp-speed').onchange = () => {clock.timeScale = Number($('rp-speed').value) || 1;};
$('dock-toggle').onclick = () => {$('dock').classList.toggle('collapsed');syncDockButtons();};$('dock-collapse').onclick = $('dock-toggle').onclick;syncDockButtons();
$('dock-reopen').onclick = $('dock-toggle').onclick;
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
$('moves-open').onclick = () => toggleMoves();$('moves-close').onclick = () => toggleMoves(false);
$('chars-open').onclick = () => toggleChars();$('chars-close').onclick = () => toggleChars(false);
window.addEventListener('keydown', e => {if (e.key === 'Escape' && !$('chars-drawer').hidden && !e.target.matches?.('input[type=text],input[type=search]')) {e.preventDefault();e.stopImmediatePropagation();toggleChars(false);}}, true);
window.addEventListener('keydown', e => {if (e.key === 'Escape' && !$('moves-drawer').hidden && !e.target.matches?.('input[type=text],input[type=search]')) {e.preventDefault();e.stopImmediatePropagation();toggleMoves(false);}}, true);
for (const b of document.querySelectorAll('[data-tool]')) b.onclick = () => openTool(b.dataset.tool);
$('panel-close').onclick = () => {$('panel').hidden = true;for (const b of document.querySelectorAll('[data-tool]')) b.classList.remove('active');};
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
export const dock = createDock({recorder, getCursorTick: () => game.tick, onSeek: seekTick,
  studioWindowsFor: id => {const ch = ui.characters[id];if (!ch) return null;return {tackle: studioWindows(ch, 'tackle'), dodge: studioWindows(ch, 'dodge_forward')};}});

// ---------- Overhaul: Visualizar, Partida, Controles e propostas de HUD ----------
export const hudProposals = new HudProposals($('hud-proposals'));
export const progressHud = new ProgressHud($('progress-hud'));   // HUD de progressão "Banco de Células" (estágios 0–4 dos 5 atributos)
// Diagnóstico de comandos (relato do controlador) e indicadores das janelas de combate (estado real da simulação).
export const diagnostics = createDiagnostics({$, game, tuning, download});
export const windowsOverlay = createWindowsOverlay({root: $('win-overlay'), view, game});
$('win-controls').append(...tuning.sectionControls('Janelas de combate'));
// Treino de defesa/esquiva perfeitas: o vermelho segue o roteiro do treino; tudo cronometrado em passos de simulação.
export const movesPanel = createMovesPanel({$, game, download, tuning, view, ui, canvas, startMatch, visual: createMovesVisual({tuning}),
  presetValues: {options: () => [...$('preset-a').options].map(o => [o.value, o.textContent]), valuesOf: id => presets.valuesOf(id)},
  nav: {openParams: (id, tab) => {toggleMoves(false);if ($('panel').hidden || $('panel').dataset.tool !== 'moves') openTool('moves');movesPanel.focusMove(id, tab);},
    openActions: id => {movesPanel.ensureEquipped(id);toggleMoves(true);actionsDrawer.show('moves');movesPanel.focusAction(id);},
    seekMoveTick,
    refreshActions: () => {if (!$('moves-drawer').hidden) actionsDrawer.render();}}});
export const actionsDrawer = createActionsDrawer({$, tuning, ui, renderMoves: c => movesPanel.renderActions(c), renderAiMoves: c => movesPanel.renderAiParams(c), onCharactersChanged: () => {syncCharacterCombatWindows();syncRuleDurations();dock.invalidate();}});
export const movesHud = new MovesHud($('moves-hud'));
// Passivas: painel de seleção (Partida), HUD da arena e VFX de ativação (§16/§17).
installHoverTip();
export const passivesPanel = createPassivesPanel({getCharacterNames: () => [ui.characters[0]?.source?.name ?? null, ui.characters[1]?.source?.name ?? null]});
$('passives-card')?.append(passivesPanel.root);
// Seleção Rápida do menu: dois blocos (personagem/moves/abilities + prévia 3D). Workspace anexado no boot.
export const quickMenu = createQuickMenu({$, game, ui, passivesPanel});
// Telas A/B/C do pré-jogo (22/10/2026): só visão sobre o estado do quickMenu; padrão = menu atual. Teclas dos slots = as configuradas (azul e vermelho).
const menuStyles = createMenuStyles({$, quickMenu, ui, info: MOVE_INFO, keys: (slot, i) => keyLabel((slot === 1 ? keyFor2 : keyFor)(`skill${i + 1}`))});
export const passivesHud = new PassivesHud($('passives-hud'));
export const training = createTrainingPanel({$, game, ui, clock, download, toast: e => diagnostics.toast(e),
  start: trainer => {abortScenario();restorePlaybackValues();ui.playback = null;trainer.start(game);ui.paused = false;input.clear();input.locked = false;resetViewAndLogs();matchRec.start({seed: trainer.seed, profile: game.profile, enemyProfile: game.enemyProfile, mode: 'training', values: tuning.snapshotValues()});syncButtons();canvas.focus();},
  stop: () => {game.phase = 'menu';}});
export const aiEval = createAiEvalPanel({$, download});
// Medidor de desempenho, perfis gráficos e benchmark (IA × IA com semente fixa no laço real).
let benchRestore = null;
export const perfPanel = createPerfPanel({$, view, game, tuning, ui, download, getWs: () => wsRef.ws,
  onWarmup: () => triggerWarmup({force: true}),
  startBench: ({seed, characters}) => {
    if (!benchRestore) benchRestore = {toggles: [['extras.toggles.enablePlayerAI', C.extras.toggles.enablePlayerAI], ['extras.toggles.enableEnemyAI', C.extras.toggles.enableEnemyAI], ['extras.toggles.enemyManual', C.extras.toggles.enemyManual]], mode: $('mode').value, playerMode: ui.playerMode, seed: $('seed').value, fixed: $('seed-fixed').checked};
    tuning.setTransient([['extras.toggles.enablePlayerAI', 1], ['extras.toggles.enableEnemyAI', 1], ['extras.toggles.enemyManual', 0]]);ui.playerMode = 'tactical';
    $('mode').value = 'tactical';$('seed').value = String(seed);$('seed-fixed').checked = true;startMatch();
    const red = ui.characters[1];if (red) {red.root.visible = characters === 2;view.setCharacter(1, characters === 2 ? red : null);}
  },
  endBench: () => {
    const red = ui.characters[1];if (red) {red.root.visible = true;view.setCharacter(1, red);}
    if (benchRestore) {tuning.setTransient(benchRestore.toggles);$('mode').value = benchRestore.mode;game.mode = benchRestore.mode;ui.playerMode = benchRestore.playerMode;$('seed').value = benchRestore.seed;$('seed-fixed').checked = benchRestore.fixed;benchRestore = null;}
    game.phase = 'menu';
  }});
export const visualPanel = createVisualPanel({tuning, view, game, $, hud: hudProposals, download});
export const cinePanel = createCinematicPanel({$, view, getWs: () => wsRef.ws});
$('cinematic-camera-btn')?.addEventListener('click', () => cinePanel?.toggle());
$('tools-cine-btn')?.addEventListener('click', () => {closeTools(); cinePanel?.toggle(true);});
$('enemy-ai-control').append(tuning.controlFor('extras.toggles.enableEnemyAI'), tuning.controlFor('extras.toggles.enemyManual'));
$('bindings-controls').append(...tuning.sectionControls('Teclas: índices configuráveis'));
$('bindings2-controls').append(...tuning.sectionControls('Teclas do vermelho (controle manual)'));
foldStaticSections();
applyConfig();renderScenarios();renderCharacters();syncTuneState();openTool('match');syncButtons();
// IA do Vermelho na Seleção Rápida: mesmo valor do seletor da Partida (applyConfig define o modo efetivo).
$('quick-mode').replaceChildren(...UI_AI_MODES.map(([id, label]) => new Option(label, id)));$('quick-mode').value = game.mode;
requestAnimationFrame(frame);

// ---------- Interfaces para testes e compatibilidade com o v6 ----------
window.__arenamon = {snapshot: () => ({...game.snapshot(), frame: ui.frame, camera: view.rig.snapshot(), locked: input.locked, hitboxDebug: !!C.extras.toggles.showHitboxes, playerAI: !!C.extras.toggles.enablePlayerAI})};
window.__arenaLive = {rules: C.rules, test: C.test, locomotion: C.locomotion, camera: C.camera, profiles: C.profiles, extras: C.extras, game, view, input, clock, reset: startMatch, apply: applyConfig};
// window.__lab só aparece depois da restauração do workspace (os testes esperam por ele).
bootWorkspace().catch(e => {console.error('workspace:', e);ui.workspaceError = e.message;return null;}).then(boot => {
  if (boot) quickMenu.attachWorkspace(boot);   // Seleção Rápida: personagens salvos + prévia 3D
  // API dos movimentos especiais (registro vazio): registerMove, listMoves, validateMove; equipar com setLoadout.
  window.__lab = {quickMenu, menuStyles, charPanel, moves: {...Moves, setLoadout: (id, ids) => game.setLoadout(id, ids), standard: STANDARD_MOVE_IDS, equipStandard: id => game.setLoadout(id, STANDARD_MOVE_IDS)}, C, game, view, cinematic: view.cinematic, cinePanel, hudProposals, presets, movement, playSequence, diagnostics, training, perf: perfPanel, aiEval, projectFiles, reportsOf, visualPanel, recorder, replay, tuning, ui, startMatch, startScenario: id => startScenario(SCENARIOS.find(s => s.id === id)), stepFrames, seekTick, goLive, togglePause, setCharacter, loadStudioFile, triggerWarmup, SCENARIOS, runScenario, spawn, openTool,
    ws: boot?.ws ?? null, store: boot?.store ?? null, wsUI: boot?.wsUI ?? null, workspaceBoot: boot};
});
