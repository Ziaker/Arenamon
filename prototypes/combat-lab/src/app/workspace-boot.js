// @ts-check
// Dividido de main.js (comportamento idêntico): workspace-boot.

import {C} from '../sim/config.js';
import {Character} from '../view/characters.js';
import {escape} from '../ui/tuning.js';
import {openStore} from '../workspace/store.js';
import {Workspace, readPackage} from '../workspace/workspace.js';
import {createWorkspaceUI} from '../ui/workspace-panel.js';
import {createProjectFiles} from '../ui/project-files.js';
import {length} from '../sim/math.js';
import {$, aiEval, charPanel, clock, diagnostics, dock, homologation, movement, perfPanel, presets, quick, quickMenu, training, tuning, ui, view, visualPanel, wsRef} from '../main.js';
import {applySeed, triggerWarmup} from './match-flow.js';
import {charHooks, refreshAnimSliders, syncCharacterCombatWindows, syncRuleDurations} from './characters-sync.js';
import {TITLES, openTool, store} from './live-panels.js';
import {download, sessionBanner} from './tuning-sync.js';
import {last} from './main-loop.js';

// ---------- Workspace persistente: preferências de interface, última partida e opções de animação ----------
export function collectUi() {
  const pressed = document.querySelector('[data-dock][aria-pressed="true"]');
  return {tool: $('panel').hidden ? null : $('panel').dataset.tool, dockCollapsed: $('dock').classList.contains('collapsed'), dockView: pressed?.dataset.dock ?? 'timeline', timeScale: $('rp-speed').value,
    overlays: {...view.overlays}, showHistory: $('show-history').checked, charSyncSource: $('char-sync-source').value, previewSlot: $('char-preview-slot').value, tuneMode: presets.mode, abKey: presets.abKey, vfxMode: visualPanel.vfxMode, quick: quickMenu.collect()};
}

export const collectMatch = () => ({enemyProfile: $('enemy-profile').value, playerMode: $('player-mode').value, seed: $('seed').value, seedFixed: $('seed-fixed').checked, recValues: $('rec-values').value});

export const collectAnim = () => {const o = Character.options;return {fit: o.fit, fade: o.fade, actionFade: o.actionFade, locomotionHold: o.locomotionHold, speed: o.speed, syncRules: o.syncRules};};

export const fire = (id, type = 'change') => $(id).dispatchEvent(new Event(type, {bubbles: true}));

/** Reaplica preferências de interface, última partida e opções de animação gravadas no workspace. */
export function applyDocUi(doc) {
  const u = doc.ui || {}, m = doc.match, a = doc.animOptions;
  if (m) {
    if ([...$('enemy-profile').options].some(o => o.value === m.enemyProfile)) $('enemy-profile').value = m.enemyProfile;
    if ([...$('player-mode').options].some(o => o.value === m.playerMode)) {$('player-mode').value = m.playerMode;fire('player-mode');}
    $('seed-fixed').checked = !!m.seedFixed;if (m.seed) {$('seed').value = String(m.seed);applySeed();}
    if (m.recValues) $('rec-values').value = m.recValues;
  }
  if (a) {
    $('char-fit').checked = a.fit !== false;fire('char-fit');
    // Workspaces da fase 1 guardavam as transições aqui; agora são parâmetros do ajustador (restaurados com os ajustes).
    if (!doc.tuning?.values || !('display.animation.fade' in doc.tuning.values)) for (const key of ['fade', 'actionFade', 'locomotionHold', 'speed']) if (typeof a[key] === 'number') C.display.animation[key] = a[key];
    refreshAnimSliders();
    $('char-sync').checked = !!a.syncRules;$('act-sync').checked = !!a.syncRules;Character.options.syncRules = !!a.syncRules;
  }
  if (u.overlays) for (const [k, v] of Object.entries(u.overlays)) if (k in view.overlays) {view.overlays[k] = !!v;const box = document.querySelector(`[data-overlay="${k}"]`);if (box) box.checked = !!v;}
  if (u.timeScale) {$('rp-speed').value = u.timeScale;clock.timeScale = Number(u.timeScale) || 1;}
  if (typeof u.showHistory === 'boolean') {$('show-history').checked = u.showHistory;$('input-history').hidden = !u.showHistory;}
  if (u.charSyncSource) $('char-sync-source').value = u.charSyncSource;
  if (u.tuneMode) presets.setMode(u.tuneMode);
  if (u.vfxMode) visualPanel.setMode(u.vfxMode);
  if (u.abKey) {presets.setABKey(u.abKey);$('ab-key').value = u.abKey;}
  if (u.quick) quickMenu.apply(u.quick);
  if (u.previewSlot) $('char-preview-slot').value = u.previewSlot;
  if (typeof u.dockCollapsed === 'boolean' && u.dockCollapsed !== $('dock').classList.contains('collapsed')) $('dock-toggle').click();
  if (u.dockView) document.querySelector(`[data-dock="${u.dockView}"]`)?.click();
  if (u.tool === null) $('panel-close').click();else if (u.tool && TITLES[u.tool] && u.tool !== 'characters' && ($('panel').hidden || $('panel').dataset.tool !== u.tool)) openTool(u.tool);
}

export const collectApp = () => ({name: 'arenamon-combate-laboratorio', build: document.title, userAgent: navigator.userAgent});

/** Primeira abertura (workspace novo neste navegador): importa o pacote inicial embutido na compilação (ver inicial/README.md). */
export async function applyInitialWorkspace(ws, wsUI) {
  const tag = document.getElementById('initial-workspace'), q = new URLSearchParams(location.search).get('inicial');
  if (!tag || q === 'nao' || (navigator.webdriver && q !== 'sim')) return false;   // navegador automatizado (testes) parte do estado vazio
  if (!ws.fresh || ws.doc.extra?.initialWorkspace || ws.doc.slots.some(s => s.modelId) || Object.keys(ws.doc.models).length) return false;
  try {
    const bin = atob(tag.textContent.trim()), bytes = new Uint8Array(bin.length);for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const pkg = await readPackage(bytes);if (pkg.error) throw new Error(pkg.error);
    await wsUI.applyImport(pkg, {tuning: 'package', models: 'package', presets: 'both', ui: 'package', homologation: 'package'}, 'pacote inicial');
    ws.doc.extra.initialWorkspace = 'v1';ws.touch();
    ws.notes.push('Primeira abertura: workspace inicial importado (ajustes calibrados, personagens e animações).');
    return true;
  } catch (e) {console.warn('workspace inicial:', e);ws.notes.push('Workspace inicial não pôde ser importado: ' + e.message);return false;}
}

export async function bootWorkspace() {
  const store = await openStore();let ls = null;try {ls = localStorage;} catch {ls = null;}
  const ws = await Workspace.open(store, {ls});wsRef.store = store;
  const wsUI = createWorkspaceUI({ws, store, ui, tuning, $, download, presets: presets.api, homologation, applyDocUi, collectApp, onCharactersChanged: () => {syncCharacterCombatWindows();syncRuleDurations();dock.invalidate();quickMenu.refresh();}});
  Object.assign(charHooks, wsUI.hooks);wsUI.setPanel(charPanel);presets.attachWorkspace(ws);
  await ws.batch(async () => {
    if (ws.doc.prefs.autoRestoreSession) applyDocUi(ws.doc);
    if (ws.doc.tuning?.values) ui.sessionRestored = sessionBanner(ws.doc.tuning.values, {auto: !!ws.doc.prefs.autoRestoreSession});
  });
  wsRef.ws = ws;wsRef.ui = wsUI;wsUI.bind();
  const initialApplied = await applyInitialWorkspace(ws, wsUI);
  // Modelos: restauração automática por slot (o vermelho reaproveita o modelo do azul quando é o mesmo arquivo).
  const S = ws.doc.slots, restored = [];
  for (const slot of [0, 1]) {
    const s = S[slot];if (initialApplied || !s.autoRestore || !s.active || !s.modelId) continue;
    if (slot === 1 && S[0].modelId === s.modelId && ui.characters[0]?.source.assetId === s.modelId) {await wsUI.useSame();restored.push(slot);continue;}
    if ((await wsUI.reopen(slot, {auto: true})).ok) restored.push(slot);
  }
  ui.workspaceNotes = ws.notes;
  if (ws.fresh || ws.notes.length) ws.touch();
  // Preferências de interface, partida e animação: gravadas quando mudam (verificação leve a cada 0,5 s).
  let last = '';
  setInterval(() => {const snap = {ui: collectUi(), match: collectMatch(), animOptions: collectAnim()}, key = JSON.stringify(snap);if (key !== last) {if (last) {ws.doc.ui = snap.ui;ws.doc.match = snap.match;ws.doc.animOptions = snap.animOptions;ws.touch();}last = key;}}, 500);
  if (ws.notes.length) $('ws-status-line')?.insertAdjacentHTML('afterend', `<p class="hint warn" id="ws-notes">${ws.notes.map(escape).join('<br>')}</p>`);
  // Pastas do projeto (servidor local opcional ou pasta autorizada no navegador).
  projectFiles = createProjectFiles({$, ui, presets: presets.api, wsUI, charPanel, reportsOf});
  if (window.__ARENAMON_DEV__) $('reports-link').href = '/relatorios';
  if (restored.length && !navigator.webdriver) {
    setTimeout(() => triggerWarmup(), 120);
  }
  return {ws, store, wsUI, restored};
}

export let projectFiles = null;

/** Relatórios já gerados nesta sessão (para gravar nas pastas do projeto). */
export function reportsOf() {
  const out = [];
  if (movement.last) out.push({name: 'movimento', kind: 'movement-comparison', data: movement.report()});
  if (diagnostics.log.length) out.push({name: 'diagnostico-comandos', kind: 'command-diagnostics', data: diagnostics.exportData()});
  if (training.trainer?.attempts.length) out.push({name: 'treino', kind: 'perfect-training', data: training.exportData()});
  if (perfPanel.lastBench) out.push({name: 'benchmark', kind: 'performance-benchmark', data: perfPanel.lastBench});
  if (aiEval.last) out.push({name: 'avaliacao-ia', kind: 'ai-evaluation', data: aiEval.last});
  return out;
}
