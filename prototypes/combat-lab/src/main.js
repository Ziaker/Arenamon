// Laboratório de combate Arenamon v7 — composição: simulação, câmera, HUD, entrada, replay, telemetria,
// cenários, ajustador, personagens do Studio, exportação e aviso de alterações não salvas.
import {C, keyFor, defaults} from './sim/config.js';
import {Game, FixedClock} from './sim/game.js';
import {AI_MODES} from './sim/ai.js';
import {styleLabel} from './sim/tactics.js';
import {Recorder} from './sim/telemetry.js';
import {ReplayBuffer} from './sim/replay.js';
import {SCENARIOS, prepareScenario, runScenario} from './sim/scenarios.js';
import {View, OVERLAYS} from './view/view.js';
import {Character, loadStudioFile, studioWindows, compareWindows} from './view/characters.js';
import {createCharacterPanel} from './ui/characters-panel.js';
import {createVisualPanel} from './ui/visual-panel.js';
import {HudProposals} from './ui/hud-proposals.js';
import {Hud} from './ui/hud.js';
import {Input} from './ui/input.js';
import {createTuning, escape, pathGet} from './ui/tuning.js';
import {createDock} from './ui/dock.js';
import {createHomologation} from './ui/homologation.js';
import {runBalance, balanceRows} from './sim/balance.js';
import {compareScenarios, compareMatch} from './sim/compare.js';
import {MatchRecording, parseRecording} from './sim/recording.js';
import {emptyCommand} from './sim/entity.js';
import {patchConfigTs, unifiedDiff, collectChanges} from './ui/gamepatch.js';
import {OFFICIAL_MAP} from './ui/actions-meta.js';
import {openStore} from './workspace/store.js';
import {Workspace} from './workspace/workspace.js';
import {createWorkspaceUI} from './ui/workspace-panel.js';
import {createPresetsPanel} from './ui/presets-panel.js';
import {createMovementPanel} from './ui/movement-panel.js';
/* global __GAME_CONFIG_TS__ */
const GAME_CONFIG_TS = typeof __GAME_CONFIG_TS__ === 'string' ? __GAME_CONFIG_TS__ : '';
import {length, sub, dot} from './sim/math.js';

const $ = id => document.getElementById(id);
const canvas = document.querySelector('.stage canvas');
const game = new Game(), clock = new FixedClock(), hud = new Hud(), recorder = new Recorder(), replay = new ReplayBuffer();
let view;
try {view = new View(canvas);} catch (e) {$('fatal').hidden = false;throw e;}
const matchRec = new MatchRecording();
/** Workspace persistente (preenchido quando o armazenamento abre; ver bootWorkspace). */
const wsRef = {ws: null, ui: null, store: null};
const ui = {playback: null, paused: false, scenario: null, playerMode: 'tactical', lastResult: null, fps: 60, characters: [null, null], sources: [null, null], frame: 0};
// Vermelho no controle manual (Partida › Controle manual do vermelho): teclas e gamepad próprios.
const input2 = new Input(canvas, () => {}, {slot: 1});
const input = new Input(canvas, code => {
  if (code === keyFor('pause')) togglePause();
  if (code === keyFor('restart') && game.phase !== 'menu') startMatch();
  if (code === keyFor('debug')) {hud.debug = !hud.debug;C.extras.hud.debugVisible = Number(hud.debug);}
});

// ---------- Partida ----------
function resetViewAndLogs() {view.reset(game.fighters[0]);recorder.clear();replay.clear();pushReplay();dock.invalidate();clock.reset();}
function startMatch({playback = null} = {}) {
  abortScenario();restorePlaybackValues();ui.playback = playback;
  if (!playback && !$('seed-fixed').checked) $('seed').value = String(1 + Math.floor(Math.random() * 99999));
  applySeed();game.profile = $('profile').value;game.enemyProfile = $('enemy-profile').value;game.mode = $('mode').value;
  game.reset();ui.paused = false;input.clear();input.locked = false;resetViewAndLogs();canvas.focus();syncButtons();
  matchRec.start({seed: Number($('seed').value), profile: game.profile, enemyProfile: game.enemyProfile, mode: game.mode, values: tuning.snapshotValues()});renderRecStatus();
}
function togglePause(force) {
  if (game.phase === 'menu') return;
  const next = force ?? !ui.paused;
  if (!next && !replay.atEnd) {recorder.truncate(game.tick);matchRec.truncate(game.tick);} // retoma a partir do ponto do replay: o futuro gravado é descartado
  if (!next && ui.playback?.ended) ui.playback = null;
  ui.paused = next;input.clear();syncButtons();
}
function pushReplay() {replay.push({tick: game.tick, game: game.save(), rig: view.rig.save()});}
function loadFrame(frame) {if (!frame) return;game.load(frame.game);view.rig.load(frame.rig);dock.invalidate();}
function playerCommand() {
  const [p, e] = game.fighters;
  if (C.extras.toggles.enablePlayerAI) {input.locked = true;return game.playerBrain.command(p, e, ui.playerMode, C.test.step);}
  return input.command(p, e, view.rig.yaw, game.tick);
}
/** Um passo de simulação ao vivo (jogo normal ou cenário). */
function stepOnce() {
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
  const c1 = ui.playback ? ui.playback.commands1?.[game.tick] ?? undefined : C.extras.toggles.enemyManual ? input2.command(game.fighters[1], game.fighters[0], view.rig.yaw, game.tick) : undefined;
  presets.ab.beforeStep(game);
  const tickBefore = game.tick;game.step(c0, c1 ?? undefined);if (game.tick > tickBefore) {matchRec.record(tickBefore, c0, c1);if (!ui.playback) movement.onStep(c0, game.lastCommands?.[1]);}view.rig.step(game.fighters[0], game.fighters[1], input.locked, C.test.step);
  recorder.record(game);pushReplay();
}
function stepFrames(delta) {
  if (game.phase === 'menu') return;
  togglePause(true);if (delta > 0 && ui.playback?.ended) ui.playback = null;
  if (delta < 0) loadFrame(replay.step(-1));
  else if (!replay.atEnd) loadFrame(replay.step(1));
  else if (game.phase === 'playing' || game.phase === 'finishing') {stepOnce();}
}
function seekTick(tick) {
  if (!replay.length) return;togglePause(true);
  let lo = 0, hi = replay.length - 1;while (lo < hi) {const mid = (lo + hi) >> 1;if (replay.frames[mid].tick < tick) lo = mid + 1;else hi = mid;}
  loadFrame(replay.seek(lo));
}
function goLive() {if (!replay.length) return;loadFrame(replay.seek(replay.length - 1));togglePause(false);}

// ---------- Gravador de movimento ----------
/** Parâmetros aplicados só durante a reprodução de uma sequência na arena (voltam ao terminar ou ao reiniciar). */
let playbackRestore = null;
function restorePlaybackValues() {if (playbackRestore) {tuning.setTransient(playbackRestore);playbackRestore = null;}}
/** Reproduz uma sequência na arena com o mesmo motor: estado inicial, semente e comandos gravados. */
function playSequence(seq, preset) {
  abortScenario();restorePlaybackValues();
  if (preset?.values) {playbackRestore = Object.keys(preset.values).map(p => [p, pathGet(C, p)]);tuning.setTransient(Object.entries(preset.values));}
  game.profile = seq.profile || 'balanced';game.enemyProfile = seq.enemyProfile || 'balanced';
  if (seq.initial) {game.load(seq.initial);game.phase = 'playing';for (const f of game.fighters) {const p = C.profiles[f.id ? game.enemyProfile : game.profile];if (p) f.attributes = {...p};}}
  else {game.reset({positions: seq.positions.map(p => ({x: p.x, z: p.z}))});game.fighters.forEach((f, i) => {const a = seq.facing?.[i];if (a !== undefined) {f.facing = a;f.visualFacing = a;f.combatHeading = a;f.faceGoal = a;}});}
  ui.paused = false;input.clear();input.locked = true;resetViewAndLogs();
  const commands = [], commands1 = [], off = game.tick;
  seq.commands.forEach((c, i) => {commands[off + i] = c;commands1[off + i] = seq.enemy === 'still' ? emptyCommand() : seq.commands1?.[i] ?? emptyCommand();});
  ui.playback = {commands, commands1, source: seq.label, onEnd: restorePlaybackValues};
  matchRec.start({seed: seq.seed, profile: game.profile, enemyProfile: game.enemyProfile, mode: game.mode, values: tuning.snapshotValues()});
  $('rec-result').innerHTML = `<p class="ok">Reproduzindo a sequência “${escape(seq.label)}”${preset ? ` com ${escape(preset.name)}` : ''}.</p>`;syncButtons();canvas.focus();
}

// ---------- Cenários ----------
function renderScenarios() {
  const box = $('scenario-list');box.replaceChildren();
  for (const def of SCENARIOS) {
    const el = document.createElement('div');el.className = 'scenario';el.dataset.id = def.id;
    const last = ui.lastResult?.id === def.id ? ui.lastResult : null;if (last) el.dataset.result = last.ok ? 'ok' : 'fail';
    el.innerHTML = `<header><strong>${escape(def.name)}</strong><button type="button">▶ Executar</button></header><p>${escape(def.description)}</p>`;
    el.querySelector('button').onclick = () => startScenario(def);box.append(el);
  }
}
function startScenario(def) {
  abortScenario();ui.scenario = prepareScenario(def, game);ui.scenario.def = def;ui.paused = false;input.clear();input.locked = true;
  resetViewAndLogs();$('scenario-report').innerHTML = `<p class="warn">Executando “${escape(def.name)}”…</p>`;syncButtons();canvas.focus();
}
function abortScenario() {if (ui.scenario) {ui.scenario.abort();ui.scenario = null;}}
function reportHtml(results) {
  return results.map(r => `<p class="${r.ok ? 'ok' : 'bad'}"><b>${r.ok ? '✓' : '✗'} ${escape(r.name)}</b></p><table><tr><th>Verificação</th><th>Esperado</th><th>Obtido</th></tr>${r.checks.map(c => `<tr><td class="${c.ok ? '' : 'bad'}">${c.ok ? '✓' : '✗'} ${escape(c.label)}</td><td>${escape(c.expected)}</td><td>${escape(c.actual)}</td></tr>`).join('')}</table>`).join('');
}
function finishScenario() {
  const result = ui.scenario.finish();ui.lastResult = result;ui.scenario = null;ui.paused = true;
  $('scenario-report').innerHTML = reportHtml([result]) + '<p class="hint">Use ◂/▸ e a linha do tempo para inspecionar o cenário passo a passo.</p>';renderScenarios();syncButtons();
}
function renderRecStatus() {
  $('rec-save').disabled = !matchRec.ticks;
  $('rec-status').textContent = ui.playback && !ui.playback.ended ? `Reproduzindo: passo ${game.tick} de ${ui.playback.commands.length}` : matchRec.ticks ? `${matchRec.ticks} passos gravados (${(matchRec.ticks * C.test.step).toFixed(1)} s)` : 'Nenhuma partida gravada.';
}
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
  startMatch({playback: {commands, commands1: parsed.commands1, source: file.name}});
  $('rec-result').innerHTML = `<p class="ok">Reproduzindo ${escape(file.name)}: ${commands.length} passos, semente ${data.seed}, ${$('rec-values').value === 'recorded' ? 'ajustes da gravação (Ctrl+Z desfaz)' : 'ajustes atuais'}.</p>`;
};
window.__labRecording = {matchRec, parseRecording, ui};
/** Caminho equivalente no config.ts do jogo (ou null para parâmetros só do laboratório). */
const gamePathOf = m => typeof m.official !== 'number' ? null : OFFICIAL_MAP[m.path] ?? (m.path.startsWith('extras.') ? null : m.path);
function gamePatch(includeDefaults) {
  const all = tuning.manifest.map(m => ({path: m.path, label: m.label, gamePath: gamePathOf(m), value: pathGet(C, m.path), official: m.official, initial: m.initial})).filter(e => e.gamePath && typeof e.value === 'number');
  const picked = new Set(all.filter(e => includeDefaults ? Math.abs(e.value - e.official) > 1e-12 : Math.abs(e.value - e.initial) > 1e-12).map(e => e.gamePath));
  const {changes, conflicts} = collectChanges(all.filter(e => picked.has(e.gamePath)));
  const result = patchConfigTs(GAME_CONFIG_TS, changes);
  return {...result, conflicts, diff: unifiedDiff(GAME_CONFIG_TS, result.text)};
}
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
function syncCompareOptions() {
  presets.render();for (const id of ['comp-a', 'comp-b']) {const sel = $(id), prev = sel.value;sel.innerHTML = $('preset-a').innerHTML;sel.value = [...sel.options].some(o => o.value === prev) ? prev : id === 'comp-a' ? '__current' : '__lab';}
}
$('comp-run').onclick = () => {
  syncCompareOptions();const ida = $('comp-a').value, idb = $('comp-b').value, A = presets.valuesOf(ida), B = presets.valuesOf(idb), name = id => escape($('comp-a').querySelector(`option[value="${CSS.escape(id)}"]`)?.textContent ?? id);
  if ($('comp-source').value === 'match') {
    if (!matchRec.ticks) {$('comp-report').innerHTML = '<p class="warn">Nenhuma partida gravada: jogue uma partida (aba Partida) e volte aqui.</p>';return;}
    const r = compareMatch(A, B, matchRec.meta, matchRec.commands);window.__lab.lastCompare = r;
    $('comp-report').innerHTML = `<p>${matchRec.ticks} passos gravados (semente ${matchRec.meta.seed}). O vermelho reage de novo pela IA em cada lado.</p><table><tr><th></th><th>A · ${name(ida)}</th><th>B · ${name(idb)}</th></tr>${r.rows.map(([k, a, b]) => `<tr><td>${escape(k)}</td><td>${a}</td><td class="${String(a) !== String(b) ? 'warn' : ''}">${b}</td></tr>`).join('')}</table>`;
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
  game.phase = 'menu';ui.lastResult = null;renderScenarios();
};

// ---------- Ajustes ----------
function applyConfig() {
  view.applyConfig();const root = document.documentElement.style, X = C.extras;
  root.setProperty('--arena-hud-scale', X.hud.uiScale);root.setProperty('--arena-notice-font', X.fx.noticeFontSize + 'px');root.setProperty('--arena-clash-font', X.fx.clashNoticeFontSize + 'px');
  for (const f of game.fighters) {
    const profile = C.profiles[f.id === 0 ? game.profile : game.enemyProfile] || C.profiles.balanced;
    if (profile) {const oldHP = f.attributes.hp;f.attributes = {...profile};if (profile.hp !== oldHP) f.hp = Math.min(profile.hp, Math.max(0, f.hp + (profile.hp - oldHP)));}
    f.stamina = Math.min(C.rules.staminaMax, f.stamina);f.regenBase = Math.min(C.rules.staminaMax, f.regenBase);
  }
  // HUD atual só quando nenhuma proposta (A/B/C) está em avaliação: nunca dois HUDs ao mesmo tempo.
  $('hud-root').hidden = !X.hud.hudVisible || (C.display.hud.proposal | 0) !== 0;hud.debug = !!X.hud.debugVisible;
  const mode = AI_MODES[X.gameModes.enemyMode | 0]?.[0] || 'combat';$('mode').value = mode;game.mode = mode;
  const profile = ['balanced', 'agile', 'resistant'][X.gameModes.playerProfile | 0] || 'balanced';$('profile').value = profile;game.profile = profile;
  syncButtons();
}
const tuning = createTuning({apply: applyConfig});
// Presets (sensação, completos e por categoria), calibração simplificada, modo simples/avançado e A × B jogável.
const presets = createPresetsPanel({tuning, $, game, download: (...a) => download(...a)});
const movement = createMovementPanel({$, game, ui, presets, tuning, download: (...a) => download(...a), playSequence: (...a) => playSequence(...a), getWs: () => wsRef.ws});
function syncTuneState() {
  const dirty = tuning.dirty(), chip = $('tune-state'), isDefault = tuning.manifest.every(m => !tuning.changed(m));
  chip.dataset.state = dirty ? 'dirty' : isDefault ? 'clean' : 'saved';
  chip.querySelector('span').textContent = dirty ? 'Ajustes não exportados' : isDefault ? 'Ajustes padrão' : `Ajustes salvos (${tuning.savedLabel})`;
  const values = tuning.snapshotValues();
  // Cópia no formato v7 (compatibilidade): só depois de o workspace ler a sessão anterior, para não sobrescrevê-la ao abrir.
  if (wsRef.ws) try {localStorage.setItem('arenamon-lab-session-v7', JSON.stringify(values));} catch {}
  wsRef.ws?.set('tuning', {values, at: new Date().toISOString()});wsRef.ui?.renderCalibrations();
  renderGameDiff();
}
tuning.onChange(syncTuneState);
// Aviso ao fechar: sempre que o workspace não conseguiu salvar (ou só existe na memória); com a preferência ligada,
// também quando há ajustes não exportados em JSON (comportamento anterior).
window.addEventListener('beforeunload', e => {
  const ws = wsRef.ws, unsafe = !ws || ws.status.state === 'error' || ws.store.kind === 'memory';
  if (ws?.status.pending) ws.saveNow();
  if (tuning.dirty() && (unsafe || ws.doc.prefs.warnOnClose)) {e.preventDefault();e.returnValue = '';}
});
for (const ev of ['pagehide', 'visibilitychange']) window.addEventListener(ev, () => {if ((ev === 'pagehide' || document.hidden) && wsRef.ws?.status.pending) wsRef.ws.saveNow();});
/** Ajustes da sessão anterior: restaurados automaticamente (com desfazer) ou oferecidos num aviso, conforme a preferência. */
function sessionBanner(prevValues, {auto}) {
  const prev = tuning.migrate(prevValues).values;
  const diff = tuning.manifest.filter(m => m.path in prev && typeof prev[m.path] === 'number' && Math.abs(prev[m.path] - pathGet(C, m.path)) > 1e-9);
  if (!diff.length) return 0;
  const banner = document.createElement('div');banner.className = 'report warn';banner.id = 'session-banner';
  const clampTo = m => Math.max(m.min, Math.min(m.max, prev[m.path]));
  if (auto) {
    tuning.commit(diff.map(m => [m.path, clampTo(m)]), 'Sessão anterior');tuning.markSaved('sessão anterior');
    banner.innerHTML = `<p><b>Sessão anterior restaurada</b> automaticamente (${diff.length} ajustes).</p><div class="row"><button type="button" id="session-undo">Desfazer restauração</button><button type="button" id="session-ok">OK</button></div>`;
    document.querySelector('[data-section="tuning"]').prepend(banner);
    $('session-undo').onclick = () => {tuning.commit(diff.map(m => [m.path, m.initial]), 'Desfazer sessão anterior');banner.remove();};
    $('session-ok').onclick = () => banner.remove();
  } else {
    banner.innerHTML = `<p><b>Ajustes da sessão anterior encontrados</b> (${diff.length} diferenças), guardados neste navegador.</p><div class="row"><button type="button" id="session-restore">Restaurar</button><button type="button" id="session-discard">Descartar</button></div>`;
    document.querySelector('[data-section="tuning"]').prepend(banner);
    $('session-restore').onclick = () => {tuning.commit(diff.map(m => [m.path, clampTo(m)]), 'Sessão anterior');banner.remove();};
    $('session-discard').onclick = () => {banner.remove();try {localStorage.removeItem('arenamon-lab-session-v7');} catch {}};
  }
  return diff.length;
}
const difficulty = {
  easy: {attackRange: 2.6, combatAttackCooldown: 1.8, initialCooldown: 1.2, threatDistance: 3.2, evadeCycle: 5, evadeCycleIndex: 2, reactiveRetreatStrength: .1},
  normal: Object.fromEntries(Object.entries(defaults().extras.ai).filter(([k]) => ['attackRange', 'combatAttackCooldown', 'initialCooldown', 'threatDistance', 'evadeCycle', 'evadeCycleIndex', 'reactiveRetreatStrength'].includes(k))),
  hard: {attackRange: 3.8, combatAttackCooldown: .7, initialCooldown: .3, threatDistance: 6, evadeCycle: 2, evadeCycleIndex: 1, reactiveRetreatStrength: .35},
};
for (const b of document.querySelectorAll('[data-difficulty]')) b.onclick = () => {tuning.commit(Object.entries(difficulty[b.dataset.difficulty]).map(([k, v]) => ['extras.ai.' + k, v]), 'Dificuldade ' + b.textContent);game.brain.reset();};

// ---------- Exportar ----------
function download(data, name, type = 'application/json') {const url = URL.createObjectURL(new Blob([data], {type})), a = document.createElement('a');a.href = url;a.download = name;a.click();setTimeout(() => URL.revokeObjectURL(url), 4000);}
const homologation = createHomologation($('homolog-list'));
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
function renderGameDiff() {
  const rows = tuning.manifest.filter(m => tuning.status(m) === 'experimental');
  $('game-diff').innerHTML = rows.length ? `<table><tr><th>Parâmetro</th><th>Jogo (config.ts)</th><th>Laboratório</th></tr>${rows.map(m => `<tr><td title="${m.path}">${escape(m.label)}<br><code>${m.path}</code></td><td>${m.fmt(m.official)}</td><td class="warn">${m.fmt(pathGet(C, m.path))}</td></tr>`).join('')}</table><p class="hint">${tuning.manifest.filter(m => m.official === undefined).length} parâmetros existem só no laboratório (lançamento, clash, salto, IA estendida, câmera e visual) e não têm equivalente no jogo.</p>` : '<p class="ok">Todos os parâmetros em comum são iguais aos do jogo.</p>';
}

// ---------- Visualizar ----------
for (const [key, label, help] of OVERLAYS) {
  const row = document.createElement('label');row.className = 'check';row.title = help;
  row.innerHTML = `<input type="checkbox" data-overlay="${key}"><span><b>${escape(label)}</b><br><small class="muted">${escape(help)}</small></span>`;
  row.querySelector('input').onchange = e => {view.overlays[key] = e.target.checked;};$('overlay-list').append(row);
}
function renderLive() {
  const [a, b] = game.fighters;if (!a) return;const d = length(sub(b.position, a.position)), rel = sub(a.velocity, b.velocity), n = d > 1e-6 ? {x: (b.position.x - a.position.x) / d, z: (b.position.z - a.position.z) / d} : {x: 0, z: 0};
  const rows = [['Distância entre centros', `${d.toFixed(2)} m`], ['Espaço entre colisores', `${Math.max(0, d - 2 * C.test.halfExtent).toFixed(2)} m`], ['Velocidade de aproximação', `${dot(rel, n).toFixed(2)} m/s`],
    ['Azul', `${a.state} · ${length(a.velocity).toFixed(2)} m/s · alt ${((a.flight?.y ?? 0) + a.vaultHeight).toFixed(2)} m`], ['Vermelho', `${b.state} · ${length(b.velocity).toFixed(2)} m/s · alt ${((b.flight?.y ?? 0) + b.vaultHeight).toFixed(2)} m`],
    ['Ação', `${a.action ? `${a.action.kind}${a.action.fromCancel ? ' (C→X)' : ''}${a.action.buffered ? ' (buffer)' : ''} ${(a.action.elapsed * 1000).toFixed(0)} ms` : '—'} / ${b.action ? `${b.action.kind}${b.action.fromCancel ? ' (C→X)' : ''}${b.action.buffered ? ' (buffer)' : ''} ${(b.action.elapsed * 1000).toFixed(0)} ms` : '—'}`], ['Estilo da IA (tático)', `${game.playerBrain.t && C.extras.toggles.enablePlayerAI && ui.playerMode === 'tactical' ? styleLabel(game.playerBrain) : '—'} / ${game.mode === 'tactical' ? styleLabel(game.brain) : '—'}`], ['Contra-ataque', `${a.counterWindow.toFixed(2)} s / ${b.counterWindow.toFixed(2)} s`], ['Hitstop', `${(game.hitstop * 1000).toFixed(0)} ms`]];
  $('live-data').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${escape(v)}</dd>`).join('');
}

// ---------- Personagens ----------
// Ganchos do workspace (persistência dos GLBs e das animações importadas), instalados quando o armazenamento abre.
const charHooks = {};
const charPanel = createCharacterPanel({ui, view, $, hooks: charHooks, onCharactersChanged: () => {syncRuleDurations();dock.invalidate();}});
const renderCharacters = () => {charPanel.render();renderStudioEvents();renderRuleDurations();};
const setCharacter = (id, source) => charPanel.setCharacter(id, source);
const renderCharacterLive = () => charPanel.live();
$('char-fit').onchange = e => {Character.options.fit = e.target.checked;};
/** Sliders da aba Personagens: editam os parâmetros oficiais display.animation.* (desfazer, presets, workspace, exportação). */
const secs = v => `${v.toFixed(2)} s`;
const ANIM_SLIDERS = [['char-fade', 'fade', 'char-fade-out', secs], ['char-action-fade', 'actionFade', 'char-action-fade-out', secs], ['char-hold', 'locomotionHold', 'char-hold-out', secs], ['char-speed', 'speed', 'char-speed-out', v => `${v.toFixed(2)}×`]];
for (const [id, key, out, fmt] of ANIM_SLIDERS) {
  const path = 'display.animation.' + key;let before = null;
  $(id).oninput = e => {if (before === null) before = C.display.animation[key];C.display.animation[key] = Number(e.target.value) || (key === 'speed' ? 1 : 0);$(out).textContent = fmt(C.display.animation[key]);};
  $(id).onchange = () => {const after = C.display.animation[key];if (before !== null && before !== after) {C.display.animation[key] = before;tuning.commit([[path, after]], tuning.byPath.get(path).label);}before = null;if (key === 'speed') syncRuleDurations();};
}
function refreshAnimSliders() {for (const [id, key, out, fmt] of ANIM_SLIDERS) {if (document.activeElement !== $(id)) $(id).value = String(C.display.animation[key]);$(out).textContent = fmt(C.display.animation[key]);}}
tuning.onChange(refreshAnimSliders);
$('char-sync').onchange = e => {Character.options.syncRules = e.target.checked;syncRuleDurations();};
$('char-sync-source').onchange = () => syncRuleDurations();
/** Personagem cujas animações definem as regras (o escolhido; se não houver, o outro). */
function ruleSource() {const id = Number($('char-sync-source').value);return ui.characters[id] || ui.characters[1 - id];}
/** Durações das ações vindas das animações (duração do clip ÷ velocidade), aplicadas às regras com desfazer. */
function syncRuleDurations() {
  if (Character.options.syncRules) {
    const ch = ruleSource();
    const changes = ch ? Object.entries(ch.ruleDurations()).map(([path, {value}]) => {const m = tuning.byPath.get(path);return [path, Math.max(m.min, Math.min(m.max, value))];}) : [];
    if (changes.length) tuning.commit(changes, 'Durações das animações');
  }
  renderRuleDurations();renderStudioEvents();
}
function renderRuleDurations() {
  const ch = ruleSource(), box = $('char-durations');
  if (!ch) {box.innerHTML = '<p class="hint">Carregue um personagem para usar as durações das animações.</p>';return;}
  const rows = Object.entries(ch.ruleDurations());
  box.innerHTML = rows.length ? `<table><tr><th>Regra</th><th>Animação</th><th>Clip ÷ velocidade</th><th>No jogo agora</th></tr>${rows.map(([path, {value, from}]) => {const m = tuning.byPath.get(path);return `<tr><td>${escape(m.label)}</td><td>${escape(from)}</td><td>${value.toFixed(3)} s</td><td>${m.fmt(pathGet(C, path))}</td></tr>`;}).join('')}</table>${Character.options.syncRules ? '<p class="ok">Sincronizado: mudar a animação ou a velocidade atualiza as regras (Ctrl+Z desfaz).</p>' : ''}` : '<p class="hint">Nenhuma ação com duração definida tem animação própria (tackle, dodge_forward, blocked, guard_impact, land/recover).</p>';
}
function renderStudioEvents() {
  const parts = [];
  for (const id of [0, 1]) {
    const ch = ui.characters[id];if (!ch) continue;
    for (const r of compareWindows(ch)) {
      if (r.missing) {parts.push(`<p class="warn">${id ? 'Vermelho' : 'Azul'} · ${r.action}: nenhuma animação associada.</p>`);continue;}
      parts.push(`<p><b>${id ? 'Vermelho' : 'Azul'} · ${r.action}</b> — “${escape(r.clip)}”, ${r.events} eventos, reescalado ×${r.scale.toFixed(2)} para ${(r.duration * 1000).toFixed(0)} ms.</p>`);
      parts.push(r.rows.length ? `<table><tr><th>Janela</th><th>Studio</th><th>Jogo</th><th>Diferença</th></tr>${r.rows.map(x => `<tr><td class="${x.ok ? 'ok' : 'warn'}">${x.ok ? '✓' : '≠'} ${escape(x.label)}</td><td>${escape(x.studio)}</td><td>${escape(x.game)}</td><td>${escape(x.note)}</td></tr>`).join('')}</table>` : '<p class="hint">Sem eventos de combate nesta animação.</p>');
      if (r.impact != null) parts.push(`<p class="hint">Impacto marcado no Studio: ${(r.impact * 1000).toFixed(0)} ms. O contato real de cada golpe aparece em Linha do tempo › Golpes (“Contato na ação”).</p>`);
    }
  }
  $('studio-events').innerHTML = parts.join('') || '<p class="hint">Carregue um GLB do Studio para comparar os eventos de combate.</p>';
}

// ---------- Controles ----------
// Atalho da troca A × B: qualquer tecla que não seja usada pelo jogador (avisa se coincidir).
{
  const codes = [...new Set(['KeyB', 'KeyN', 'KeyM', 'KeyV', 'KeyG', 'KeyH', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Backquote', 'F2', 'F4', ...C.extras.keyCodes])];
  $('ab-key').replaceChildren(...codes.map(c => new Option(c.replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow', 'Seta '), c)));$('ab-key').value = presets.abKey;
  $('ab-key').onchange = e => {const code = e.target.value, used = Object.entries(C.extras.bindings).find(([, i]) => C.extras.keyCodes[i] === code);presets.setABKey(code);$('ab-key').title = used ? `Atenção: ${code} também é a tecla de “${used[0]}”` : '';if (used) $('ab-key').setCustomValidity?.('tecla em uso');};
}
$('mode').replaceChildren(...AI_MODES.map(([id, label]) => new Option(label, id)));$('mode').value = game.mode;
$('player-mode').replaceChildren(...AI_MODES.filter(([id]) => id !== 'inactive').map(([id, label]) => new Option(label, id)));$('player-mode').value = ui.playerMode;
$('mode').onchange = () => {game.mode = $('mode').value;C.extras.gameModes.enemyMode = AI_MODES.findIndex(([id]) => id === game.mode);game.brain.reset();syncButtons();};
$('profile').onchange = () => {C.extras.gameModes.playerProfile = ['balanced', 'agile', 'resistant'].indexOf($('profile').value);};
$('player-mode').onchange = () => {ui.playerMode = $('player-mode').value;game.playerBrain.reset();};
function applySeed() {const s = Math.max(1, Math.round(Number($('seed').value) || 1));game.brain.seed = s;game.playerBrain.seed = s + 7919;game.brain.reset();game.playerBrain.reset();}
$('seed').onchange = () => {$('seed-fixed').checked = true;applySeed();};
$('show-history').onchange = e => {$('input-history').hidden = !e.target.checked;};
function renderHistory() {$('input-history').innerHTML = input.history.map(h => `<li><b>${escape(h.label)}</b><span>${h.frames}</span></li>`).join('');$('pad-status').textContent = input.padName ? `Gamepad: ${input.padName}` : 'Nenhum gamepad conectado. Pressione um botão do controle para ativá-lo.';}

// ---------- Barra superior, painéis e doca ----------
function syncButtons() {
  const hb = $('arena-hitboxes-toggle'), on = !!C.extras.toggles.showHitboxes;hb.setAttribute('aria-checked', String(on));
  const ab = $('arena-autoplay-toggle'), ai = !!C.extras.toggles.enablePlayerAI;ab.setAttribute('aria-checked', String(ai));$('name0').textContent = ai ? 'JOGADOR IA · AZUL' : 'JOGADOR · AZUL';
  $('pause').textContent = ui.paused ? '▶ Continuar' : '❚❚ Pausar';$('rp-play').textContent = ui.paused ? '▶' : '❚❚';
}
$('arena-hitboxes-toggle').onclick = () => {const v = C.extras.toggles.showHitboxes ? 0 : 1;tuning.commit([['extras.toggles.showHitboxes', v], ['extras.toggles.showAttackVectors', v]], 'Hitboxes');canvas.focus();};
$('arena-autoplay-toggle').onclick = () => {tuning.commit([['extras.toggles.enablePlayerAI', C.extras.toggles.enablePlayerAI ? 0 : 1]], 'IA do jogador');game.playerBrain.reset();input.clear();canvas.focus();};
$('pause').onclick = () => togglePause();$('restart-top').onclick = startMatch;$('restart').onclick = startMatch;$('start').onclick = startMatch;$('start-center').onclick = startMatch;
$('resume').onclick = () => togglePause(false);$('back').onclick = () => {abortScenario();game.phase = 'menu';input.clear();};
$('debug-toggle').onclick = () => {hud.debug = !hud.debug;C.extras.hud.debugVisible = Number(hud.debug);canvas.focus();};
$('camera-reset').onclick = () => {view.reset(game.fighters[0]);canvas.focus();};
$('rp-back').onclick = () => stepFrames(-1);$('rp-fwd').onclick = () => stepFrames(1);$('rp-play').onclick = () => togglePause();$('rp-live').onclick = goLive;
$('rp-speed').onchange = () => {clock.timeScale = Number($('rp-speed').value) || 1;};
$('dock-toggle').onclick = () => {$('dock').classList.toggle('collapsed');$('dock-toggle').classList.toggle('active', !$('dock').classList.contains('collapsed'));};$('dock-toggle').classList.add('active');
const TITLES = {match: 'Partida', scenarios: 'Cenários', tuning: 'Ajustes', overlays: 'Visualizar', characters: 'Personagens', controls: 'Controles', export: 'Exportar', homolog: 'Homologação'};
function openTool(tool) {
  const same = !$('panel').hidden && $('panel').dataset.tool === tool;$('panel').hidden = same;$('panel').dataset.tool = tool;
  for (const b of document.querySelectorAll('[data-tool]')) b.classList.toggle('active', !same && b.dataset.tool === tool);
  for (const s of document.querySelectorAll('[data-section]')) s.hidden = s.dataset.section !== tool;$('panel-title').textContent = TITLES[tool];
  if (tool === 'homolog') homologation.render();
  if (tool === 'scenarios') {syncCompareOptions();movement.render();}
  if (tool === 'tuning') presets.render();
  if (tool === 'export') renderGameDiff();if (tool === 'tuning') tuning.render();
}
for (const b of document.querySelectorAll('[data-tool]')) b.onclick = () => openTool(b.dataset.tool);
$('panel-close').onclick = () => {$('panel').hidden = true;for (const b of document.querySelectorAll('[data-tool]')) b.classList.remove('active');};
window.addEventListener('keydown', e => {
  const typing = e.target.matches('input[type=text],input[type=search],input[type=number],textarea,select');
  if ((e.ctrlKey || e.metaKey) && !typing) {const k = e.key.toLowerCase();if (k === 'z' && !e.shiftKey) {e.preventDefault();tuning.undo();}else if (k === 'y' || (k === 'z' && e.shiftKey)) {e.preventDefault();tuning.redo();}return;}
  if (typing) return;
  if (e.key === ',') {e.preventDefault();stepFrames(-1);}else if (e.key === '.') {e.preventDefault();stepFrames(1);}
  else if (e.code === presets.abKey && presets.ab.active && !e.repeat) {e.preventDefault();presets.toggleAB();}
});
window.addEventListener('blur', () => {input.clear();input2.clear();});
document.addEventListener('visibilitychange', () => {if (document.hidden && game.phase === 'playing') togglePause(true);});
const dock = createDock({recorder, getCursorTick: () => game.tick, onSeek: seekTick,
  studioWindowsFor: id => {const ch = ui.characters[id];if (!ch) return null;return {tackle: studioWindows(ch, 'tackle'), dodge: studioWindows(ch, 'dodge_forward')};}});

// ---------- Overhaul: Visualizar, Partida, Controles e propostas de HUD ----------
const hudProposals = new HudProposals($('hud-proposals'));
const visualPanel = createVisualPanel({tuning, view, game, $, hud: hudProposals, download});
$('enemy-ai-control').append(tuning.controlFor('extras.toggles.enableEnemyAI'), tuning.controlFor('extras.toggles.enemyManual'));
$('bindings-controls').append(...tuning.sectionControls('Teclas: índices configuráveis'));
$('bindings2-controls').append(...tuning.sectionControls('Teclas do vermelho (controle manual)'));
/** Grupos estáticos com mais de dois controles ganham botão ▼ (recolher/expandir). */
function foldStaticSections() {
  for (const section of document.querySelectorAll('.panel-body section[data-section]')) {
    for (const h of [...section.children].filter(el => el.tagName === 'H3')) {
      if (h.querySelector('.fold-btn')) continue;
      const items = [];for (let el = h.nextElementSibling; el && el.tagName !== 'H3'; el = el.nextElementSibling) items.push(el);
      const count = items.reduce((n, el) => n + (el.matches('input,select,button,textarea') ? 1 : 0) + el.querySelectorAll('input,select,button,textarea').length, 0);
      if (count <= 2) continue;
      const body = document.createElement('div');body.className = 'fold-body';items.forEach(el => body.append(el));h.after(body);h.classList.add('static-fold');
      const b = document.createElement('button');b.type = 'button';b.className = 'fold-btn';const set = open => {body.hidden = !open;b.textContent = open ? '▼' : '▶';b.setAttribute('aria-expanded', String(open));b.title = (open ? 'Recolher ' : 'Expandir ') + h.textContent.trim();};
      b.onclick = () => set(body.hidden);set(true);h.append(b);
    }
  }
}
foldStaticSections();

// ---------- Laço principal ----------
let last = performance.now(), uiTimer = 0;
function frame(now) {
  const dt = Math.max(0, (now - last) / 1000);last = now;
  const live = !ui.paused && (game.phase === 'playing' || game.phase === 'finishing');
  if (live) clock.advance(dt, stepOnce);else clock.reset();
  ui.fps += (1 / Math.max(.001, dt) - ui.fps) * C.extras.hud.fpsSmoothing;
  view.draw(game.fighters, game.events, live ? dt * clock.timeScale : 0, {paused: !live, realDt: dt, tick: game.tick, sources: [C.extras.toggles.enablePlayerAI || ui.scenario ? 'IA' : 'jogador', 'IA']});
  const back = replay.length ? (replay.length - 1 - replay.cursor) : 0;
  hud.render(game, ui.fps, {locked: input.locked, paused: ui.paused && game.phase !== 'menu', replay: back ? `−${back} passos (${(back * C.test.step * 1000).toFixed(0)} ms) · ▶ retoma daqui` : 'último passo · , e . avançam/voltam', playerAI: !!C.extras.toggles.enablePlayerAI});
  $('rp-readout').textContent = `passo ${game.tick}${back ? ` · −${(back * C.test.step).toFixed(2)} s` : ''}${clock.timeScale !== 1 ? ` · ${clock.timeScale}×` : ''}`;
  dock.render();hudProposals.render(game, live ? dt * clock.timeScale : 0);
  if ((uiTimer += dt) > .1) {uiTimer = 0;renderLive();renderHistory();renderCharacterLive();renderRecStatus();visualPanel.live();}
  ui.frame++;requestAnimationFrame(frame);
}
applyConfig();renderScenarios();renderCharacters();syncTuneState();openTool('match');syncButtons();
requestAnimationFrame(frame);

// ---------- Workspace persistente: preferências de interface, última partida e opções de animação ----------
function collectUi() {
  const pressed = document.querySelector('[data-dock][aria-pressed="true"]');
  return {tool: $('panel').hidden ? null : $('panel').dataset.tool, dockCollapsed: $('dock').classList.contains('collapsed'), dockView: pressed?.dataset.dock ?? 'timeline', timeScale: $('rp-speed').value,
    overlays: {...view.overlays}, showHistory: $('show-history').checked, charSyncSource: $('char-sync-source').value, previewSlot: $('char-preview-slot').value, tuneMode: presets.mode, abKey: presets.abKey};
}
const collectMatch = () => ({enemyProfile: $('enemy-profile').value, playerMode: $('player-mode').value, seed: $('seed').value, seedFixed: $('seed-fixed').checked, recValues: $('rec-values').value});
const collectAnim = () => {const o = Character.options;return {fit: o.fit, fade: o.fade, actionFade: o.actionFade, locomotionHold: o.locomotionHold, speed: o.speed, syncRules: o.syncRules};};
const fire = (id, type = 'change') => $(id).dispatchEvent(new Event(type, {bubbles: true}));
/** Reaplica preferências de interface, última partida e opções de animação gravadas no workspace. */
function applyDocUi(doc) {
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
    $('char-sync').checked = !!a.syncRules;Character.options.syncRules = !!a.syncRules;
  }
  if (u.overlays) for (const [k, v] of Object.entries(u.overlays)) if (k in view.overlays) {view.overlays[k] = !!v;const box = document.querySelector(`[data-overlay="${k}"]`);if (box) box.checked = !!v;}
  if (u.timeScale) {$('rp-speed').value = u.timeScale;clock.timeScale = Number(u.timeScale) || 1;}
  if (typeof u.showHistory === 'boolean') {$('show-history').checked = u.showHistory;$('input-history').hidden = !u.showHistory;}
  if (u.charSyncSource) $('char-sync-source').value = u.charSyncSource;
  if (u.tuneMode) presets.setMode(u.tuneMode);
  if (u.abKey) {presets.setABKey(u.abKey);$('ab-key').value = u.abKey;}
  if (u.previewSlot) $('char-preview-slot').value = u.previewSlot;
  if (typeof u.dockCollapsed === 'boolean' && u.dockCollapsed !== $('dock').classList.contains('collapsed')) $('dock-toggle').click();
  if (u.dockView) document.querySelector(`[data-dock="${u.dockView}"]`)?.click();
  if (u.tool === null) $('panel-close').click();else if (u.tool && TITLES[u.tool] && ($('panel').hidden || $('panel').dataset.tool !== u.tool)) openTool(u.tool);
}
const collectApp = () => ({name: 'arenamon-combate-laboratorio', build: document.title, userAgent: navigator.userAgent});

async function bootWorkspace() {
  const store = await openStore();let ls = null;try {ls = localStorage;} catch {ls = null;}
  const ws = await Workspace.open(store, {ls});wsRef.store = store;
  const wsUI = createWorkspaceUI({ws, store, ui, tuning, $, download, presets: presets.api, homologation, applyDocUi, collectApp, onCharactersChanged: () => {syncRuleDurations();dock.invalidate();}});
  Object.assign(charHooks, wsUI.hooks);wsUI.setPanel(charPanel);presets.attachWorkspace(ws);
  await ws.batch(async () => {
    if (ws.doc.prefs.autoRestoreSession) applyDocUi(ws.doc);
    if (ws.doc.tuning?.values) ui.sessionRestored = sessionBanner(ws.doc.tuning.values, {auto: !!ws.doc.prefs.autoRestoreSession});
  });
  wsRef.ws = ws;wsRef.ui = wsUI;wsUI.bind();
  // Modelos: restauração automática por slot (o vermelho reaproveita o modelo do azul quando é o mesmo arquivo).
  const S = ws.doc.slots, restored = [];
  for (const slot of [0, 1]) {
    const s = S[slot];if (!s.autoRestore || !s.active || !s.modelId) continue;
    if (slot === 1 && S[0].modelId === s.modelId && ui.characters[0]?.source.assetId === s.modelId) {await wsUI.useSame();restored.push(slot);continue;}
    if ((await wsUI.reopen(slot, {auto: true})).ok) restored.push(slot);
  }
  ui.workspaceNotes = ws.notes;
  if (ws.fresh || ws.notes.length) ws.touch();
  // Preferências de interface, partida e animação: gravadas quando mudam (verificação leve a cada 0,5 s).
  let last = '';
  setInterval(() => {const snap = {ui: collectUi(), match: collectMatch(), animOptions: collectAnim()}, key = JSON.stringify(snap);if (key !== last) {if (last) {ws.doc.ui = snap.ui;ws.doc.match = snap.match;ws.doc.animOptions = snap.animOptions;ws.touch();}last = key;}}, 500);
  if (ws.notes.length) $('ws-status-line')?.insertAdjacentHTML('afterend', `<p class="hint warn" id="ws-notes">${ws.notes.map(escape).join('<br>')}</p>`);
  return {ws, store, wsUI, restored};
}

// ---------- Interfaces para testes e compatibilidade com o v6 ----------
window.__arenamon = {snapshot: () => ({...game.snapshot(), frame: ui.frame, camera: view.rig.snapshot(), locked: input.locked, hitboxDebug: !!C.extras.toggles.showHitboxes, playerAI: !!C.extras.toggles.enablePlayerAI})};
window.__arenaLive = {rules: C.rules, test: C.test, locomotion: C.locomotion, camera: C.camera, profiles: C.profiles, extras: C.extras, game, view, input, clock, reset: startMatch, apply: applyConfig};
// window.__lab só aparece depois da restauração do workspace (os testes esperam por ele).
bootWorkspace().catch(e => {console.error('workspace:', e);ui.workspaceError = e.message;return null;}).then(boot => {
  window.__lab = {C, game, view, hudProposals, presets, movement, playSequence, visualPanel, recorder, replay, tuning, ui, startMatch, startScenario: id => startScenario(SCENARIOS.find(s => s.id === id)), stepFrames, seekTick, goLive, togglePause, setCharacter, loadStudioFile, SCENARIOS, runScenario,
    ws: boot?.ws ?? null, store: boot?.store ?? null, wsUI: boot?.wsUI ?? null, workspaceBoot: boot};
});
