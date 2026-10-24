// Laboratório de combate Arenamon v7 — composição: simulação, câmera, HUD, entrada, replay, telemetria,
// cenários, ajustador, personagens do Studio, exportação e aviso de alterações não salvas.

import {C, keyFor, keyFor2, defaults, resetConfig as resetCfg, useFactoryDefaults} from './sim/config.js';
if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('fabrica')) {useFactoryDefaults(true);resetCfg(defaults());}   // ?fabrica=1: valores de fábrica, sem a base de calibração v8
import {Game, FixedClock} from './sim/game.js';
import {AI_MODES, UI_AI_MODES} from './sim/ai.js';

import {Recorder} from './sim/telemetry.js';
import {ReplayBuffer} from './sim/replay.js';
import {SCENARIOS, runScenario} from './sim/scenarios.js';

import {resetCollisionProbe} from './sim/collision-probe.js';
import {View, OVERLAYS} from './view/view.js';
import {Character, loadStudioFile, studioWindows} from './view/characters.js';
import {createCharacterPanel} from './ui/characters-panel.js';
import {createVisualPanel} from './ui/visual-panel.js';
import {HudProposals} from './ui/hud-proposals.js';
import {ProgressHud} from './ui/progress-hud.js';
import {Hud} from './ui/hud.js';
import {Input} from './ui/input.js';
import {createTuning, escape, pathGet} from './ui/tuning.js';
import {createDock} from './ui/dock.js';
import {createHomologation} from './ui/homologation.js';
import {runBalance, balanceRows} from './sim/balance.js';
import {compareScenarios, compareMatch} from './sim/compare.js';
import {MatchRecording, parseRecording} from './sim/recording.js';
import {captureBug, parseBugCapture, reproduceBugCapture, encodeBug} from './sim/bug-capture.js';
import {diffRecording} from './sim/replay-diff.js';


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
$('rec-save').onclick = () => {download(JSON.stringify(matchRec.toJSON()), `arenamon-partida-${matchRec.meta.seed}.json`);};
$('rec-file').onchange = async e => {
  const file = e.target.files[0];if (!file) return;const parsed = parseRecording(await file.text());e.target.value = '';
  if (parsed.error) {$('rec-result').innerHTML = `<p class="warn">${escape(parsed.error)}</p>`;return;}
  const {data, commands} = parsed;
  if ($('rec-values').value === 'recorded') {
    const changes = Object.entries(data.values || {}).filter(([path, v]) => tuning.byPath.has(path) && pathGet(C, path) !== v);
    if (changes.length) tuning.commit(changes, 'ajustes da gravação');
  }
  $('seed').value = String(data.seed);$('seed-fixed').checked = true;$('profile').value = data.profile;$('enemy-profile').value = data.enemyProfile;$('mode').value = data.mode;
  if (Array.isArray(data.loadouts)) passivesPanel.setFromRecording({loadouts: data.loadouts, identity: data.identity});   // reprodução exata (§27)
  startMatch({playback: {commands, commands1: parsed.commands1, source: file.name}});
  $('rec-result').innerHTML = `<p class="ok">Reproduzindo ${escape(file.name)}: ${commands.length} passos, semente ${data.seed}, ${$('rec-values').value === 'recorded' ? 'ajustes da gravação (Ctrl+Z desfaz)' : 'ajustes atuais'}.</p>`;
};
// Captura de bug reproduzível (#11): erros da página ficam guardados para entrar no pacote.
const pageErrors = [];
window.addEventListener('error', e => {pageErrors.push(`${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`);if (pageErrors.length > 20) pageErrors.shift();});
window.addEventListener('unhandledrejection', e => {pageErrors.push('Promessa rejeitada: ' + String(e.reason?.message ?? e.reason));if (pageErrors.length > 20) pageErrors.shift();});
const appVersion = () => ($('app-version')?.textContent ?? '').replace(/^Combate\s*·\s*/, '') || 'desconhecida';
$('bug-capture').onclick = () => {
  const pkg = captureBug({game, recording: matchRec, appVersion: appVersion(), note: $('bug-note').value, errors: pageErrors});
  download(encodeBug(pkg), `arenamon-bug-${pkg.seed ?? 'x'}-t${pkg.tick}.json`);
  $('bug-result').innerHTML = `<p class="ok">Captura salva: passo ${pkg.tick}, semente ${pkg.seed}, ${pkg.errors.length} erro(s) da página, config ${pkg.configHash}.</p>`;
};
$('bug-file').onchange = async e => {
  const file = e.target.files[0];if (!file) return;const parsed = parseBugCapture(await file.text());e.target.value = '';
  if (parsed.error) {$('bug-result').innerHTML = `<p class="warn">${escape(parsed.error)}</p>`;return;}
  ui.playback = null;
  const out = reproduceBugCapture(parsed.data, game, {appVersion: appVersion()});
  recorder.clear();replay.clear();resetViewAndLogs();togglePause(true);renderRecStatus();
  $('bug-result').innerHTML = `<p class="ok">Captura aberta no passo ${out.tick} (semente ${escape(String(parsed.data.seed))}); o jogo ficou pausado nesse instante.${parsed.data.note ? ` Nota: ${escape(parsed.data.note)}` : ''}</p>`
    + (out.replayMatches === true ? '<p class="ok">Refazer a gravação desde o início chega ao mesmo estado: o defeito é reproduzível.</p>' : '')
    + out.warnings.map(w => `<p class="warn">${escape(w)}</p>`).join('')
    + (parsed.data.errors?.length ? `<p class="warn">Erros capturados: ${parsed.data.errors.map(escape).join(' · ')}</p>` : '');
};
window.__labRecording = {matchRec, parseRecording, ui};
$('patch-generate').onclick = () => {
  if (!GAME_CONFIG_TS) {$('patch-result').innerHTML = '<p class="warn">O texto do config.ts não está neste build.</p>';return;}
  const p = gamePatch($('patch-defaults').checked);window.__lab.lastPatch = p;
  const label = path => escape(tuning.byPath.get(path)?.label ?? path);
  $('patch-result').innerHTML = (p.applied.length ? `<p>${p.applied.length} valor(es) mudariam no jogo:</p><table><tr><th>config.ts</th><th>Jogo</th><th>Proposto</th><th>Origem</th></tr>${p.applied.map(a => `<tr><td><code>${a.gamePath}</code></td><td>${escape(a.before)}</td><td class="warn">${escape(a.after)}</td><td>${a.from.map(label).join('<br>')}</td></tr>`).join('')}</table>` : '<p class="ok">Nenhum valor do jogo mudaria.</p>')
    + (p.conflicts.length ? `<p class="warn"><b>Conflitos (fora da proposta):</b></p><ul>${p.conflicts.map(c => `<li><code>${c.gamePath}</code>: ${c.list.map(e => `${label(e.path)} = ${+e.value.toFixed(4)}`).join(' · ')}</li>`).join('')}</ul>` : '')
    + (p.skipped.length ? `<p class="warn">Sem equivalente no config.ts: ${p.skipped.map(s => `<code>${s.gamePath}</code>`).join(', ')}</p>` : '')
    + (p.diff ? `<pre class="diff">${escape(p.diff)}</pre><div class="row"><button type="button" id="patch-download">↓ Baixar .patch</button><button type="button" id="patch-copy">Copiar diff</button></div>` : '');
  if (p.diff) {
    $('patch-download').onclick = () => download(p.diff, 'config-ts-proposta.patch');
    $('patch-copy').onclick = async () => {try {await navigator.clipboard.writeText(p.diff);} catch {/* sem área de transferência: o diff continua visível */}};
  }
};
$('comp-run').onclick = () => {
  syncCompareOptions();const ida = $('comp-a').value, idb = $('comp-b').value, A = presets.valuesOf(ida), B = presets.valuesOf(idb), name = id => escape($('comp-a').querySelector(`option[value="${CSS.escape(id)}"]`)?.textContent ?? id);
  if ($('comp-source').value === 'match') {
    if (!matchRec.ticks) {$('comp-report').innerHTML = '<p class="warn">Nenhuma partida gravada: jogue uma partida (aba Partida) e volte aqui.</p>';return;}
    const r = compareMatch(A, B, matchRec.meta, matchRec.commands);window.__lab.lastCompare = r;
    const dv = diffRecording({meta: {...matchRec.meta, moveLoadouts: game.loadouts}, commands: matchRec.commands}, {values: A}, {values: B}).divergence;   // #12: primeiro tick em que A e B se separam
    r.divergence = dv;
    $('comp-report').innerHTML = `<p>${matchRec.ticks} passos gravados (semente ${matchRec.meta.seed}). O vermelho reage de novo pela IA em cada lado.</p><table><tr><th></th><th>A · ${name(ida)}</th><th>B · ${name(idb)}</th></tr>${r.rows.map(([k, a, b]) => `<tr><td>${escape(k)}</td><td>${a}</td><td class="${String(a) !== String(b) ? 'warn' : ''}">${b}</td></tr>`).join('')}</table>${r.divergence.identical ? '<p class="muted">A e B percorrem a gravação inteira com o mesmo estado (nenhum tick diverge).</p>' : `<p>Primeiro tick em que A e B se separam: <b>passo ${r.divergence.tick}</b>, campo <code>${escape(r.divergence.field)}</code> (A ${escape(String(r.divergence.a))} · B ${escape(String(r.divergence.b))}).</p>`}`;
    return;
  }
  const rows = compareScenarios(A, B);window.__lab.lastCompare = rows;
  $('comp-report').innerHTML = `<table><tr><th>Cenário</th><th>A · ${name(ida)}</th><th>B · ${name(idb)}</th></tr>${rows.map(r => `<tr><td><b>${escape(r.name)}</b>${r.diffs.map(d => `<br><small>${escape(d.label)}</small>`).join('')}</td><td>${r.okA ? '✓' : '✗'}${r.diffs.map(d => `<br><small>${escape(String(d.a))}</small>`).join('')}</td><td class="${r.okA !== r.okB ? 'warn' : ''}">${r.okB ? '✓' : '✗'}${r.diffs.map(d => `<br><small>${escape(String(d.b))}</small>`).join('')}</td></tr>`).join('')}</table><p class="hint">✓/✗ = esperado × obtido de cada cenário com aqueles ajustes; abaixo, só as medições que diferem entre A e B.</p>`;
};
$('balance-run').onclick = () => {
  const matches = Math.max(1, Math.min(200, Number($('balance-matches').value) || 20)), seed = Math.max(1, Number($('balance-seed').value) || 1);
  const t0 = performance.now(), r = runBalance({matches, seed, profile: $('profile').value, enemyProfile: $('enemy-profile').value, mode: $('player-mode').value, enemyMode: $('mode').value === 'inactive' ? 'tactical' : $('mode').value});window.__lab.lastBalance = r;
  $('balance-report').innerHTML = `<p>${r.matches} lutas · ${((performance.now() - t0) / 1000).toFixed(1)} s · duração média ${r.avgSeconds.toFixed(1)} s (${r.minSeconds.toFixed(1)}–${r.maxSeconds.toFixed(1)}) · ${r.timeouts ? `<span class="warn">${r.timeouts} sem vencedor em 90 s</span>` : 'todas com vencedor'}</p>
    <table><tr><th></th><th>Azul</th><th>Vermelho</th></tr>${balanceRows(r).map(([k, a, b]) => `<tr><td>${escape(k)}</td><td>${a}</td><td>${b}</td></tr>`).join('')}</table>`;
};
$('scenario-all').onclick = () => {
  abortScenario();const results = SCENARIOS.map(def => runScenario(def));const ok = results.filter(r => r.ok).length;
  $('scenario-report').innerHTML = `<p class="${ok === results.length ? 'ok' : 'bad'}"><b>${ok} de ${results.length} cenários aprovados</b> com os ajustes atuais.</p>` + reportHtml(results);
  resetCollisionProbe();game.phase = 'menu';ui.lastResult = null;renderScenarios();
};
export const tuning = createTuning({apply: applyConfig});
// Presets (sensação, completos e por categoria), calibração simplificada, modo simples/avançado e A × B jogável.
export const presets = createPresetsPanel({tuning, $, game, download: (...a) => download(...a)});
export const quick = createQuickPanel({$, tuning, presets, onOpen: () => input.clear()});
export const movement = createMovementPanel({$, game, ui, presets, tuning, download: (...a) => download(...a), playSequence: (...a) => playSequence(...a), getWs: () => wsRef.ws});
tuning.onChange(syncTuneState);
// Aviso ao fechar: sempre que o workspace não conseguiu salvar (ou só existe na memória); com a preferência ligada,
// também quando há ajustes não exportados em JSON (comportamento anterior).
window.addEventListener('beforeunload', e => {
  const ws = wsRef.ws, unsafe = !ws || ws.status.state === 'error' || ws.store.kind === 'memory';
  if (ws?.status.pending) ws.saveNow();
  if (tuning.dirty() && (unsafe || ws.doc.prefs.warnOnClose)) {e.preventDefault();e.returnValue = '';}
});
for (const ev of ['pagehide', 'visibilitychange']) window.addEventListener(ev, () => {if ((ev === 'pagehide' || document.hidden) && wsRef.ws?.status.pending) wsRef.ws.saveNow();});
export const homologation = createHomologation($('homolog-list'));
const exportAll = () => ({...tuning.exportData(), homologation: homologation.exportData()});
$('export-json').onclick = () => {download(JSON.stringify(exportAll(), null, 2), 'arenamon-calibracao-v8.json');tuning.markSaved('JSON exportado');wsRef.ui?.saveCalibration('JSON exportado', 'auto');$('import-result').innerHTML = '<p class="ok">JSON enviado para Downloads. O navegador não confirma a gravação: verifique o arquivo.</p>';};
$('copy-json').onclick = async () => {try {await navigator.clipboard.writeText(JSON.stringify(exportAll(), null, 2));$('import-result').innerHTML = '<p class="ok">JSON copiado.</p>';} catch {$('import-text').value = JSON.stringify(exportAll(), null, 2);$('import-text').select();$('import-result').innerHTML = '<p class="warn">Sem acesso à área de transferência: o JSON está na caixa abaixo, selecionado.</p>';}};
$('import-file').onchange = async () => {const f = $('import-file').files[0];if (f) $('import-text').value = await f.text();$('import-preview').click();};
$('import-preview').onclick = () => {
  const p = tuning.preview($('import-text').value);
  if (p.error) {$('import-result').innerHTML = `<p class="bad">${escape(p.error)}</p>`;return;}
  if (!p.changes.length) {$('import-result').innerHTML = (p.converted.length ? `<p class="warn">${p.converted.length} campo(s) de formato antigo convertido(s).</p>` : '') + '<p class="ok">O JSON é igual aos ajustes atuais.</p>';return;}
  const migration = (p.converted.length ? `<p class="warn"><b>Migração de formato antigo:</b> ${p.converted.length} campo(s) convertido(s).</p><table><tr><th>Campo antigo</th><th>Novo</th><th>Valor</th></tr>${p.converted.map(c => `<tr><td><code>${escape(c.from)}</code></td><td><code>${escape(c.to)}</code></td><td>${c.value}</td></tr>`).join('')}</table>` : '') + (p.ignored.length ? `<p class="warn"><b>Campos não reconhecidos</b> (não aplicados): ${p.ignored.map(i => `<code>${escape(i.path)}</code>`).join(', ')}</p>` : '');
  $('import-result').innerHTML = migration + `<p>${p.changes.length} parâmetros mudariam (schema ${escape(p.schema)}, versão ${escape(p.version)}):</p><table><tr><th>Parâmetro</th><th>Atual</th><th>JSON</th></tr>${p.changes.slice(0, 40).map(([path, v]) => {const m = tuning.byPath.get(path);return `<tr><td title="${path}">${escape(m.label)}</td><td>${m.fmt(pathGet(C, path))}</td><td>${m.fmt(v)}</td></tr>`;}).join('')}</table>${p.changes.length > 40 ? '<p class="hint">…</p>' : ''}<button type="button" class="primary" id="import-apply">Aplicar ${p.changes.length} ajustes</button>`;
  $('import-apply').onclick = () => {const n = tuning.applyChanges(p.changes, 'JSON importado');$('import-result').innerHTML = `<p class="ok">${n} ajustes aplicados (Ctrl+Z desfaz).</p>`;};
};
$('reset-all').onclick = () => tuning.resetAll();

// ---------- Visualizar ----------
for (const [key, label, help] of OVERLAYS) {
  const row = document.createElement('label');row.className = 'check';row.title = help;
  row.innerHTML = `<input type="checkbox" data-overlay="${key}"><span><b>${escape(label)}</b><br><small class="muted">${escape(help)}</small></span>`;
  row.querySelector('input').onchange = e => {view.overlays[key] = e.target.checked;};$('overlay-list').append(row);
}
export const charPanel = createCharacterPanel({ui, view, $, hooks: charHooks, onCharactersChanged: () => {syncCharacterCombatWindows();syncRuleDurations();dock.invalidate();movesPanel?.render?.();actionsDrawer?.render?.();}});
syncCharacterCombatWindows();
export const renderCharacters = () => {charPanel.render();renderStudioEvents();renderRuleDurations();passivesPanel.render();};
const setCharacter = (id, source) => charPanel.setCharacter(id, source);
export const renderCharacterLive = () => charPanel.live();
$('char-fit').onchange = e => {Character.options.fit = e.target.checked;};
for (const [id, key, out, fmt] of ANIM_SLIDERS) {
  const path = 'display.animation.' + key;let before = null;
  $(id).oninput = e => {if (before === null) before = C.display.animation[key];C.display.animation[key] = Number(e.target.value) || (key === 'speed' ? 1 : 0);$(out).textContent = fmt(C.display.animation[key]);};
  $(id).onchange = () => {const after = C.display.animation[key];if (before !== null && before !== after) {C.display.animation[key] = before;tuning.commit([[path, after]], tuning.byPath.get(path).label);}before = null;if (key === 'speed') syncRuleDurations();};
}
tuning.onChange(refreshAnimSliders);
$('char-sync').onchange = e => {Character.options.syncRules = e.target.checked;$('act-sync').checked = e.target.checked;syncRuleDurations();};
// Atalho visível no topo da gaveta Ações: é a MESMA opção «Usar duração dos clipes nas regras» (Personagens › avançado).
$('act-sync').onchange = e => {$('char-sync').checked = e.target.checked;$('char-sync').dispatchEvent(new Event('change'));};
$('char-sync-source').onchange = () => syncRuleDurations();

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
