// @ts-check
// Dividido de main.js (comportamento idêntico): wire-startup.

import {UI_AI_MODES} from '../sim/ai.js';
import {C, keyFor, keyFor2} from '../sim/config.js';
import {abortScenario, renderScenarios, startScenario} from './scenario-flow.js';
import {createMoveEditor} from '../editor/move-editor-panel.js';
import {createMoveShowcase} from '../editor/move-showcase.js';
import {EDITABLE_MOVES} from '../editor/editable-moves.js';
import {getMove, listMoves} from '../sim/moves.js';
import {MOVE_INFO, MOVES_PARAMS} from '../ui/moves-panel.js';
import {keyLabel} from '../ui/menu-styles-model.js';
import {applyConfig, download, syncTuneState} from './tuning-sync.js';
import {foldStaticSections, openTool, syncButtons, toggleChars, toggleMoves} from './live-panels.js';
import {frame} from './main-loop.js';
import {seekTick, startMatch} from './match-flow.js';
import {createMovesSync} from '../editor/moves-sync.js';
import {ATELIER_GAME_PARAMS} from '../view/quarks/atelier-game-params.js';
import {createMovesVisual} from '../ui/moves-vfx-panel.js';
import {$, actionsDrawer, editorHooks, cinePanel, clock, closeTools, game, movesPanel, renderCharacters, tuning, ui} from '../main.js';

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
syncButtons();
// IA do Vermelho na Seleção Rápida: mesmo valor do seletor da Partida (applyConfig define o modo efetivo).
$('quick-mode').replaceChildren(...UI_AI_MODES.map(([id, label]) => new Option(label, id)));
$('quick-mode').value = game.mode;
requestAnimationFrame(frame);
}

/** Editor de Moves (fase 2): gaveta própria, aberta pelo botão «🛠 Editor» no canto da arena. */
export function wireMoveEditor() {
  /** @type {any} */ let sync = null;
  const editor = createMoveEditor({onVisualChange: (key, k, v) => sync?.sendVisual(key, k, v),getWorld: () => C.world, $, tuning, startScenario: def => startScenario(def), abortScenario, getScenario: () => ui.scenario, getLastResult: () => ui.lastResult, save: (() => {
      // O servidor local injeta window.__ARENAMON_DEV__ DEPOIS do script do jogo: por isso tudo é lido na hora do uso (getter), não aqui.
      const dev = () => /** @type {any} */ (window).__ARENAMON_DEV__, api = () => dev()?.api ?? '/api';
      const call = async (/** @type {string} */ method, /** @type {string} */ url, /** @type {any} */ body) => {
        const r = await fetch(api() + url, {method, headers: body ? {'content-type': 'application/json'} : {}, body: body ? JSON.stringify(body) : undefined});
        return {status: r.status, json: await r.json().catch(() => ({}))};
      };
      return {get available() {return !!dev()?.save;}, rememberOpen: (/** @type {string} */ id) => {try {sessionStorage.setItem('arenamon.editor.reopen', id);} catch {/* sem armazenamento */}},
        read: (/** @type {string} */ kind, /** @type {string} */ id) => call('GET', '/' + kind + '/' + encodeURIComponent(id)),
        write: (/** @type {string} */ kind, /** @type {string} */ id, /** @type {any} */ doc, /** @type {string} */ expectHash) => call('PUT', '/' + kind + '/' + encodeURIComponent(id), {doc, expectHash, confirm: true})};
    })(), ficha: {timelineMarkup: id => movesPanel.timelineMarkup(id), abMarkup: id => movesPanel.abMarkup(id), bind: root => movesPanel.bindMoveTools(root), fire: id => movesPanel.fire(id)}, openActions: id => {movesPanel.ensureEquipped(id);toggleMoves(true);actionsDrawer.show('moves');movesPanel.focusAction(id);}, vfx: (() => {const v = createMovesVisual({tuning});return {markup: id => v.markup(id), bind: root => v.bind(root), bindParams: (root, rerender) => movesPanel.bindParams(root, rerender)};})(), seekToTime: sec => {if (!ui.lastResult?.id?.startsWith('editor-')) return false;seekTick(Math.round(sec / C.test.step));return true;}, download, setTimeScale: v => {clock.timeScale = v;$('rp-speed').value = String(v);}});
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
    openLegacy: id => {const lg = $('moves-tools');if (lg) lg.open = true;},   // só se algum Move voltar a ficar fora do editor
    onEquipChanged: () => {if (!$('moves-drawer').hidden) actionsDrawer?.render?.();}});
  Object.assign(editor, {showcase});
  editorHooks.open = id => {toggle(true);editor.select(id);};
  editorHooks.refresh = () => showcase.render();
  editorHooks.close = () => {if (!$('move-editor').hidden) toggle(false);};
  // Depois de gravar, o servidor recompila e a página recarrega: reabre o Editor no Move em que você estava.
  try {const again = sessionStorage.getItem('arenamon.editor.reopen');if (again) {sessionStorage.removeItem('arenamon.editor.reopen');toggle(true);editor.select(again);}} catch {/* sem armazenamento */}
  $('editor-open').onclick = () => toggle();$('editor-close').onclick = () => toggle(false);
  // Fase 6: o Estúdio de Moves em janela própria (visualizador + editor) e a sincronia ao vivo entre janelas.
  const movePaths = MOVES_PARAMS.flatMap(([, rows]) => rows.map((/** @type {any[]} */ r) => `world.${r[0]}.${r[1]}`));
  sync = createMovesSync({tuning, visualParams: /** @type {any} */ (ATELIER_GAME_PARAMS), local: ['extras.toggles.enableEnemyAI'],
    snapshot: () => ({...tuning.snapshotValues(), ...Object.fromEntries(movePaths.map(p => [p, p.split('.').reduce((/** @type {any} */ o, k) => o?.[k], C)]))}),
    onRemote: () => {if (!$('move-editor').hidden) editor.render();}});
  const studioUrl = (/** @type {string} */ id) => {const u = new URL(location.href);u.search = '';u.hash = '';u.searchParams.set('moves', '1');u.searchParams.set('move', id);return u.href;};
  $('editor-popout').onclick = () => {window.open(studioUrl(editor.state.moveId), 'arenamon-estudio-moves');};
  $('editor-keys').onclick = () => {const h = $('editor-keys-help'), open = h.hidden;h.hidden = !open;$('editor-keys').setAttribute('aria-expanded', String(open));};
  const studio = new URLSearchParams(location.search).has('moves');
  // Atalhos do Editor (só com o Editor aberto e fora de campos de texto/seleção): Enter executa, L laço, [ ] troca de Move, ? ajuda.
  window.addEventListener('keydown', e => {
    if ($('move-editor').hidden || e.ctrlKey || e.metaKey || e.altKey || e.target.matches?.('input[type=text],input[type=search],input[type=number],textarea,select')) return;
    const ids = EDITABLE_MOVES.map(m => m.id), i = ids.indexOf(editor.state.moveId);
    const act = e.key === 'Enter' ? () => editor.play()
      : e.key === 'l' || e.key === 'L' ? () => {editor.state.loop = !editor.state.loop;editor.render();if (editor.state.loop) editor.play();}
      : e.key === '[' ? () => editor.select(ids[(i - 1 + ids.length) % ids.length])
      : e.key === ']' ? () => editor.select(ids[(i + 1) % ids.length])
      : e.key === '?' ? () => $('editor-keys').click()
      : e.key === 'Escape' && studio ? () => {editor.state.loop = false;abortScenario();editor.state.running = false;editor.render();}
      : null;
    if (!act) return;
    e.preventDefault();e.stopImmediatePropagation();act();
  }, true);
  if (studio) {
    // Estúdio de Moves: só a arena (visualizador) e o Editor; IA do rival parada; abre no Move pedido (?move=<id>).
    document.body.classList.add('modo-moves');document.title = 'Arenamon · Estúdio de Moves';
    C.extras.toggles.enableEnemyAI = 0;
    startMatch();
    const want = new URLSearchParams(location.search).get('move');
    toggle(true);editor.select(want && EDITABLE_MOVES.some(m => m.id === want) ? want : editor.state.moveId);
  }
  window.addEventListener('keydown', e => {if (e.key === 'Escape' && !document.body.classList.contains('modo-moves') && !$('move-editor').hidden && !e.target.matches?.('input[type=text],input[type=search]')) {e.preventDefault();e.stopImmediatePropagation();toggle(false);}}, true);
  return editor;
}
