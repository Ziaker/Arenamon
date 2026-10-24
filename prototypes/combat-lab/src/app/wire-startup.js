// @ts-check
// Dividido de main.js (comportamento idêntico): wire-startup.

import {UI_AI_MODES} from '../sim/ai.js';
import {C, keyFor, keyFor2} from '../sim/config.js';
import {abortScenario, renderScenarios, startScenario} from './scenario-flow.js';
import {createMoveEditor} from '../editor/move-editor-panel.js';
import {createMoveShowcase} from '../editor/move-showcase.js';
import {EDITABLE_MOVES} from '../editor/editable-moves.js';
import {getMove, listMoves} from '../sim/moves.js';
import {MOVE_INFO} from '../ui/moves-panel.js';
import {keyLabel} from '../ui/menu-styles-model.js';
import {applyConfig, download, syncTuneState} from './tuning-sync.js';
import {foldStaticSections, openTool, syncButtons, toggleChars, toggleMoves} from './live-panels.js';
import {frame} from './main-loop.js';
import {seekTick} from './match-flow.js';
import {$, actionsDrawer, cinePanel, clock, closeTools, game, movesPanel, renderCharacters, tuning, ui} from '../main.js';

export function wireExtras() {
  wireMoveEditor();
$('cinematic-camera-btn')?.addEventListener('click', () => cinePanel?.toggle());
$('tools-cine-btn')?.addEventListener('click', () => {closeTools(); cinePanel?.toggle(true);});
$('enemy-ai-control').append(tuning.controlFor('extras.toggles.enableEnemyAI'), tuning.controlFor('extras.toggles.enemyManual'));
$('bindings-controls').append(...tuning.sectionControls('Teclas: índices configuráveis'));
$('bindings2-controls').append(...tuning.sectionControls('Teclas do vermelho (controle manual)'));
foldStaticSections();
}

export function startApp() {
applyConfig();
renderScenarios();
renderCharacters();
syncTuneState();
openTool('match');
syncButtons();
// IA do Vermelho na Seleção Rápida: mesmo valor do seletor da Partida (applyConfig define o modo efetivo).
$('quick-mode').replaceChildren(...UI_AI_MODES.map(([id, label]) => new Option(label, id)));
$('quick-mode').value = game.mode;
requestAnimationFrame(frame);
}

/** Editor de Moves (fase 2): gaveta própria, aberta pelo botão «🛠 Editor» no canto da arena. */
export function wireMoveEditor() {
  const editor = createMoveEditor({getWorld: () => C.world, $, tuning, startScenario: def => startScenario(def), abortScenario, getScenario: () => ui.scenario, getLastResult: () => ui.lastResult, seekToTime: sec => {if (!ui.lastResult?.id?.startsWith('editor-')) return false;seekTick(Math.round(sec / C.test.step));return true;}, download, setTimeScale: v => {clock.timeScale = v;$('rp-speed').value = String(v);}});
  const toggle = (open = $('move-editor').hidden) => {
    if (open) {toggleMoves(false);toggleChars(false);}
    $('move-editor').hidden = !open;$('editor-open').setAttribute('aria-expanded', String(open));$('editor-open').classList.toggle('active', open);
    if (open) editor.render();
  };
  /** Vitrine da aba Moves (fase 4): cartões equipados em destaque e não equipados; clicar abre o editor (ou o painel antigo, para quem ainda está em código). */
  const showcase = createMoveShowcase({$, game, slots: () => C.world.slots, listMoves, getMove, info: MOVE_INFO,
    keyOf: (fighter, slot) => keyLabel((fighter === 1 ? keyFor2 : keyFor)('skill' + (slot + 1))),
    editableIds: () => new Set(EDITABLE_MOVES.map(m => m.id)),
    openEditor: id => {toggle(true);editor.select(id);},
    openLegacy: id => {const lg = $('moves-legacy');if (lg) lg.open = true;try {movesPanel?.focusMove?.(id);} catch {/* Move sem cartão no painel antigo */}},
    onEquipChanged: () => {if (!$('moves-drawer').hidden) actionsDrawer?.render?.();}});
  Object.assign(editor, {showcase});
  $('editor-open').onclick = () => toggle();$('editor-close').onclick = () => toggle(false);
  window.addEventListener('keydown', e => {if (e.key === 'Escape' && !$('move-editor').hidden && !e.target.matches?.('input[type=text],input[type=search]')) {e.preventDefault();e.stopImmediatePropagation();toggle(false);}}, true);
  return editor;
}
