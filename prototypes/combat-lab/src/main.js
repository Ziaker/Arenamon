// Laboratório de combate Arenamon v7 — composição: simulação, câmera, HUD, entrada, replay, telemetria,
// cenários, ajustador, personagens do Studio, exportação e aviso de alterações não salvas.

import {C, keyFor, keyFor2, defaults, resetConfig as resetCfg, useFactoryDefaults} from './sim/config.js';
if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('fabrica')) {useFactoryDefaults(true);resetCfg(defaults());}   // ?fabrica=1: valores de fábrica, sem a base de calibração v8
import {Game, FixedClock} from './sim/game.js';


import {Recorder} from './sim/telemetry.js';
import {ReplayBuffer} from './sim/replay.js';
import {SCENARIOS, runScenario} from './sim/scenarios.js';


import {View} from './view/view.js';
import {loadStudioFile, studioWindows, loadAnimationFile, STATE_ACTIONS, STATE_LABELS, ACTION_IDS} from './view/characters.js';
import {createAnimationEditor} from './ui/animation-editor.js';
import {ACTION_LABELS} from './ui/characters-panel.js';
import {ACTION_TABS} from './ui/actions-drawer.js';
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
import {BoostFeedback} from './ui/boost-feedback.js';
import {createPassivesPanel} from './ui/passives-panel.js';
import {installHoverTip} from './ui/hover-tip.js';
import {deterministicCapture} from './view/visual-random.js';   // captura determinística dos testes de paridade (só __lab)
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
import {wireControls, wireDrawers, wireKeyboard, wireToolbar} from './app/wire-controls.js';
import {startApp, wireExtras} from './app/wire-startup.js';

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
{let phaseSig = '';tuning.onChange(() => {const G = C.extras.gameFeel, sig = [G.phaseMode, G.phaseActive, G.phaseCancel, G.phaseInvuln].join();if (sig !== phaseSig) {phaseSig = sig;syncCharacterCombatWindows();}});}   // game feel 6: o contrato de fases acompanha o ajuste
export const animEditor = createAnimationEditor({ui, $, tuning, ACTION_TABS, STATE_LABELS, ACTION_LABELS, STATE_ACTIONS, ACTION_IDS, loadAnimationFile, onChanged: () => {syncCharacterCombatWindows();syncRuleDurations();dock.invalidate();}});
export const renderCharacters = () => {charPanel.render();renderStudioEvents();renderRuleDurations();passivesPanel.render();};
const setCharacter = (id, source) => charPanel.setCharacter(id, source);
export const renderCharacterLive = () => charPanel.live();
wireCharacters();
wireControls();

const toolsPop = $('tools-pop'), toolsBtn = $('tools-toggle');
export function closeTools() {if (toolsPop.hidden) return;toolsPop.hidden = true;toolsBtn.setAttribute('aria-expanded', 'false');}
toolsBtn.onclick = e => {e.stopPropagation();if (!toolsPop.hidden) {closeTools();return;}toolsPop.hidden = false;toolsBtn.setAttribute('aria-expanded', 'true');const r = toolsBtn.getBoundingClientRect(), w = toolsPop.getBoundingClientRect().width;toolsPop.style.top = (r.bottom + 6) + 'px';toolsPop.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';};
document.addEventListener('pointerdown', e => {if (!toolsPop.hidden && !toolsPop.contains(e.target) && e.target !== toolsBtn) closeTools();});
window.addEventListener('keydown', e => {if (e.key === 'Escape' && !toolsPop.hidden) {e.preventDefault();e.stopImmediatePropagation();closeTools();}}, true);
wireToolbar();

wireDrawers();

wireKeyboard();

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
/** Ganchos preenchidos mais tarde (wire-startup): abrir o Editor de Moves num Move. */
export const editorHooks = /** @type {{open: ((id: string) => void) | null, refresh: (() => void) | null, close: (() => void) | null}} */ ({open: null, refresh: null, close: null});
export const movesPanel = createMovesPanel({$, game, download, tuning, view, ui, canvas, startMatch, visual: createMovesVisual({tuning}), cards: false,
  presetValues: {options: () => [...$('preset-a').options].map(o => [o.value, o.textContent]), valuesOf: id => presets.valuesOf(id)},
  nav: {openParams: id => {toggleMoves(false);editorHooks.open?.(id);},
    openActions: id => {movesPanel.ensureEquipped(id);toggleMoves(true);actionsDrawer.show('moves');movesPanel.focusAction(id);},
    seekMoveTick,
    refreshActions: () => {if (!$('moves-drawer').hidden) actionsDrawer.render();}}});
export const actionsDrawer = createActionsDrawer({$, tuning, ui, renderMoves: c => movesPanel.renderActions(c), renderAiMoves: c => movesPanel.renderAiParams(c), onCharactersChanged: () => {syncCharacterCombatWindows();syncRuleDurations();dock.invalidate();}});
export const movesHud = new MovesHud($('moves-hud'));
// Recarga acelerada (novo toque durante o cooldown paga stamina): faixa no HUD, flash do slot e anel no chão.
export const boostFeedback = new BoostFeedback();
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
wireExtras();

startApp();


// ---------- Interfaces para testes e compatibilidade com o v6 ----------
window.__arenamon = {snapshot: () => ({...game.snapshot(), frame: ui.frame, camera: view.rig.snapshot(), locked: input.locked, hitboxDebug: !!C.extras.toggles.showHitboxes, playerAI: !!C.extras.toggles.enablePlayerAI})};
window.__arenaLive = {rules: C.rules, test: C.test, locomotion: C.locomotion, camera: C.camera, profiles: C.profiles, extras: C.extras, game, view, input, clock, reset: startMatch, apply: applyConfig};
// window.__lab só aparece depois da restauração do workspace (os testes esperam por ele).
bootWorkspace().catch(e => {console.error('workspace:', e);ui.workspaceError = e.message;return null;}).then(boot => {
  if (boot) quickMenu.attachWorkspace(boot);   // Seleção Rápida: personagens salvos + prévia 3D
  // API dos movimentos especiais (registro vazio): registerMove, listMoves, validateMove; equipar com setLoadout.
  window.__lab = {syncCharacterCombatWindows, quickMenu, menuStyles, charPanel, moves: {...Moves, setLoadout: (id, ids) => game.setLoadout(id, ids), standard: STANDARD_MOVE_IDS, equipStandard: id => game.setLoadout(id, STANDARD_MOVE_IDS)}, C, game, view, cinematic: view.cinematic, cinePanel, hudProposals, presets, movement, playSequence, diagnostics, training, perf: perfPanel, aiEval, projectFiles, reportsOf, visualPanel, recorder, replay, tuning, ui, startMatch, seedVisualRandom: (/** @type {number | null} */ seed) => deterministicCapture(view.worldView, seed), startScenario: id => startScenario(SCENARIOS.find(s => s.id === id)), stepFrames, seekTick, goLive, togglePause, setCharacter, loadStudioFile, triggerWarmup, SCENARIOS, runScenario, spawn, openTool,
    ws: boot?.ws ?? null, store: boot?.store ?? null, wsUI: boot?.wsUI ?? null, workspaceBoot: boot};
});
