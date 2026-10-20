// Laboratório de combate Arenamon v7 — composição: simulação, câmera, HUD, entrada, replay, telemetria,
// cenários, ajustador, personagens do Studio, exportação e aviso de alterações não salvas.
import {C, keyFor, defaults} from './sim/config.js';
import {Game, FixedClock} from './sim/game.js';
import {AI_MODES, UI_AI_MODES} from './sim/ai.js';
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
import {Workspace, readPackage} from './workspace/workspace.js';
import {createWorkspaceUI} from './ui/workspace-panel.js';
import {createPresetsPanel} from './ui/presets-panel.js';
import {createQuickPanel} from './ui/quick-panel.js';
import {createActionsDrawer} from './ui/actions-drawer.js';
import {createMovementPanel} from './ui/movement-panel.js';
import {createDiagnostics, createWindowsOverlay} from './ui/diagnostics-panel.js';
import {createTrainingPanel} from './ui/training-panel.js';
import {createMovesPanel} from './ui/moves-panel.js';
import {MovesHud} from './ui/moves-hud.js';
import {createPerfPanel} from './ui/perf-panel.js';
import {createAiEvalPanel} from './ui/ai-eval-panel.js';
import {createProjectFiles} from './ui/project-files.js';
import * as Moves from './sim/moves.js';
import {registerStandardMoves, STANDARD_MOVE_IDS} from './sim/moves/standard.js';
/* global __GAME_CONFIG_TS__ */
const GAME_CONFIG_TS = typeof __GAME_CONFIG_TS__ === 'string' ? __GAME_CONFIG_TS__ : '';
import {length, sub, dot} from './sim/math.js';
import {spawn} from './sim/world.js';
import * as T from 'three';
import {soundFx} from './view/audio.js';
// ─── Sistema de habilidades passivas (Propostas A/B/C) ───
import {initPassivesOnView} from './view/passive-view-extension.js';
import {initPassiveControls} from './ui/passive-ui-controls.js';

// Moves padrão (D2): registrados aqui, no bootstrap do laboratório, nunca no núcleo da simulação. Registrar não equipa nenhum slot.
registerStandardMoves();

const $ = id => document.getElementById(id);
const canvas = document.querySelector('.stage canvas');
const game = new Game(), clock = new FixedClock(), hud = new Hud(), recorder = new Recorder(), replay = new ReplayBuffer();
let view;
try {view = new View(canvas);} catch (e) {$('fatal').hidden = false;throw e;}
// Inicializa extensão de passivas na view (runtime patch)
initPassivesOnView(view);
// Inicializa controles de UI para passivas
initPassiveControls(view, game);

const matchRec = new MatchRecording();
/** Workspace persistente (preenchido quando o armazenamento abre; ver bootWorkspace). */
const wsRef = {ws: null, ui: null, store: null};
const ui = {playback: null, paused: false, scenario: null, playerMode: 'tactical', lastResult: null, fps: 60, characters: [null, null], sources: [null, null], frame: 0};
// Vermelho no controle manual (Partida › Controle manual do vermelho): teclas e gamepad próprios.
const input2 = new Input(canvas, () => {}, {slot: 1});
const input = new Input(canvas, code => {
  if (code === keyFor('pause') || code === 'Space') togglePause();
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

// ---------- Partida ----------
function resetViewAndLogs() {view.reset(game.fighters[0]);recorder.clear();replay.clear();pushReplay();dock.invalidate();clock.reset();}
function startMatch({playback = null} = {}) {
  if (ui.training) {training.end();}
  abortScenario();restorePlaybackValues();ui.playback = playback;
  if (!playback && !$('seed-fixed').checked) $('seed').value = String(1 + Math.floor(Math.random() * 99999));
  applySeed();game.profile = $('profile').value;game.enemyProfile = $('enemy-profile').value;game.mode = $('mode').value;
  game.reset();ui.paused = false;input.clear();input.locked = false;resetViewAndLogs();canvas.focus();syncButtons();resetMatchStats();
  matchRec.start({seed: Number($('seed').value), profile: game.profile, enemyProfile: game.enemyProfile, mode: game.mode, values: tuning.snapshotValues()});renderRecStatus();
}
function toggleZenMode(force) {
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
  const c1 = ui.training && !ui.playback ? ui.training.enemyCommand(game) : ui.playback ? ui.playback.commands1?.[game.tick] ?? undefined : C.extras.toggles.enemyManual ? input2.command(game.fighters[1], game.fighters[0], view.rig.yaw, game.tick) : undefined;
  presets.ab.beforeStep(game);
  const tickBefore = game.tick;game.step(c0, c1 ?? undefined);if (game.tick > tickBefore) {matchRec.record(tickBefore, c0, c1);if (!ui.playback) movement.onStep(c0, game.lastCommands?.[1]);if (ui.training) training.afterStep(c0);}view.rig.step(game.fighters[0], game.fighters[1], input.locked, C.test.step);
  if (game.lastStepEvents?.length) {handleSoundEvents(game.lastStepEvents);trackMatchEvents(game.lastStepEvents);}
trackChargeSounds();trackExhaustionSounds();checkKoTrigger();
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
    + (p.diff ? `<pre class="diff">${escape(p.diff)}</pre><div class="hint">Não vê diferença? Copie o texto acima e cole em um comparador (ex: diffchecker.com). Navegadores podem ocultar espaços.</div>` : '');
};
$('patch-copy').onclick = () => {const p = window.__lab?.lastPatch;if (!p || !p.text) return;navigator.clipboard.writeText(p.text).then(() => {$('patch-result').insertAdjacentHTML('beforeend', '<p class="ok">Copiado para a área de transferência.</p>');});};
const download = (text, name) => {const a = document.createElement('a');a.href = URL.createObjectURL(new Blob([text], {type: 'application/json'}));a.download = name;a.click();URL.revokeObjectURL(a.href);};
const maybeHex = v => typeof v === 'number' ? '0x' + v.toString(16).padStart(6, '0') : '';
let tuning = createTuning(C, {
  // Display (renderização e animação)
  display: [
    {label: 'Composição', groups: [
      {label: 'Câmera', items: [
        {path: 'camera.distance', label: 'Distância', min: 6, max: 30, step: 1},
        {path: 'camera.fov', label: 'FOV', min: 15, max: 90, step: 1},
        {path: 'camera.anglePitch', label: 'Inclinação', min: 0, max: 80, step: 1},
        {path: 'camera.smooth', label: 'Suavização', min: 0.01, max: 1, step: 0.01},
        {path: 'camera.angleYaw', label: 'Rotação', min: -180, max: 180, step: 1},
        {path: 'camera.height', label: 'Altura', min: 0, max: 8, step: 0.5},
        {path: 'camera.pitchOffset', label: 'Desloc. de inclinação', min: -30, max: 30, step: 1},
        {path: 'camera.lookAtOffsetY', label: 'Desloc. do alvo Y', min: -2, max: 4, step: 0.2},
        {path: 'camera.shake', label: 'Tremer na queda', min: 0, max: 1, step: 0.1},
      ]},
      {label: 'Arena', items: [
        {path: 'display.gridSize', label: 'Tamanho da grade', min: 5, max: 60, step: 1},
        {path: 'display.gridColor', label: 'Cor da grade', type: 'hex'},
        {path: 'display.groundColor', label: 'Cor do chão', type: 'hex'},
        {path: 'display.groundOpacity', label: 'Opacidade do chão', min: 0, max: 1, step: 0.1},
        {path: 'display.arenaRadius', label: 'Raio da arena', min: 2, max: 15, step: 0.5},
        {path: 'display.arenaOpacity', label: 'Opacidade da arena', min: 0, max: 1, step: 0.1},
        {path: 'display.arenaColor', label: 'Cor da arena', type: 'hex'},
        {path: 'display.shadowOpacity', label: 'Opacidade da sombra', min: 0, max: 1, step: 0.1},
        {path: 'display.ambientIntensity', label: 'Intensidade ambiente', min: 0, max: 3, step: 0.1},
        {path: 'display.directionalIntensity', label: 'Intensidade direcional', min: 0, max: 4, step: 0.1},
        {path: 'display.fogNear', label: 'Névoa perto', min: 0, max: 60, step: 1},
        {path: 'display.fogFar', label: 'Névoa longe', min: 0, max: 100, step: 1},
        {path: 'display.fogColor', label: 'Cor da névoa', type: 'hex'},
        {path: 'display.arenaCenterOpacity', label: 'Centro da arena', min: 0, max: 1, step: 0.05},
        {path: 'display.exhaustionLabel', label: 'Mostrar “exausto”', type: 'bool'},
        {path: 'display.lodDistance', label: 'Distância LOD', min: 4, max: 40, step: 1},
        {path: 'display.threePointLight', label: 'Luz tripla (key/fill/back)', type: 'bool'},
        {path: 'display.cellShading', label: 'Toon shading (basic)', type: 'bool'},
      ]},
      {label: 'Animação', items: [
        {path: 'display.animation.fade', label: 'Transição (s)', min: 0, max: 1, step: 0.05},
        {path: 'display.animation.actionFade', label: 'Ação rápida (s)', min: 0, max: 0.5, step: 0.01},
        {path: 'display.animation.locomotionHold', label: 'Mín. em movimento (s)', min: 0.01, max: 0.3, step: 0.01},
        {path: 'display.animation.speed', label: 'Velocidade geral', min: 0.2, max: 2.5, step: 0.05},
        {path: 'display.animation.interp', label: 'Interpolação', type: 'select', options: [['lerp', 'Linear'], ['slerp', 'Esfera']]},
        {path: 'display.animation.syncFps', label: 'Sincronizar com FPS', type: 'bool'},
      ]},
      {label: 'VFX', items: [
        {path: 'vfx.globalIntensity', label: 'Intensidade geral', min: 0, max: 2, step: 0.1},
        {path: 'vfx.hitFlash', label: 'Clarão de acerto', min: 0, max: 1, step: 0.1},
        {path: 'vfx.sparkCount', label: 'Faíscas', min: 0, max: 60, step: 1},
        {path: 'vfx.shockwaveOpacity', label: 'Opacidade da onda', min: 0, max: 1, step: 0.05},
        {path: 'vfx.hitTintColor', label: 'Cor do clarão', type: 'hex'},
        {path: 'vfx.hitTintDuration', label: 'Duração do clarão (s)', min: 0, max: 0.5, step: 0.02},
        {path: 'vfx.flashMinIntensity', label: 'Clarão mín.', min: 0, max: 1, step: 0.05},
        {path: 'vfx.solidFxParticleCount', label: 'Partículas SFX', min: 0, max: 40, step: 1},
        {path: 'vfx.solidFxOpacity', label: 'Opacidade SFX', min: 0, max: 1, step: 0.05},
        {path: 'vfx.solidFxMesh', label: 'Tipo SFX', type: 'select', options: [['cube', 'Cubo'], ['octahedron', 'Octaedro'], ['icosahedron', 'Icosaedro'], ['sphere', 'Esfera'], ['tetrahedron', 'Tetraedro'], ['dodecahedron', 'Dodecaedro']]},
        {path: 'vfx.solidFxTrailLength', label: 'Rastro SFX', min: 0, max: 24, step: 1},
        {path: 'vfx.solidFxEmissive', label: 'Emissivo SFX', min: 0, max: 4, step: 0.1},
        {path: 'vfx.particleMode', label: 'Modo partículas', type: 'select', options: [['low', 'Baixo'], ['medium', 'Médio'], ['high', 'Alto']]},
        {path: 'vfx.passiveA.opacity', label: 'A: Opacidade', min: 0.1, max: 1, step: 0.05},
        {path: 'vfx.passiveB.opacity', label: 'B: Opacidade', min: 0.1, max: 1, step: 0.05},
        {path: 'vfx.passiveC.opacity', label: 'C: Opacidade', min: 0.1, max: 1, step: 0.05},
      ]},
    ]},
  ],
  // Regras
  rules: [
    {label: 'Regras', groups: [
      {label: 'Base', items: [
        {path: 'rules.hpMax', label: 'HP máximo', min: 100, max: 500, step: 10},
        {path: 'rules.staminaMax', label: 'Stamina máxima', min: 50, max: 300, step: 5},
        {path: 'rules.hpRegen', label: 'Regeneração de HP', min: 0, max: 10, step: 0.1},
        {path: 'rules.staminaRegen', label: 'Regeneração de stamina', min: 0, max: 20, step: 0.5},
        {path: 'rules.staminaRegenResting', label: 'Reg. em repouso', min: 0, max: 30, step: 0.5},
        {path: 'rules.staminaRegenMoving', label: 'Reg. em movimento', min: 0, max: 10, step: 0.5},
        {path: 'rules.damageScale', label: 'Escala de dano', min: 0.2, max: 5, step: 0.1},
        {path: 'rules.massScale', label: 'Escala de massa', min: 0.5, max: 3, step: 0.1},
        {path: 'rules.gravity', label: 'Gravidade', min: 0.5, max: 3, step: 0.1},
        {path: 'rules.hitstop', label: 'Hitstop', min: 0, max: 0.4, step: 0.02},
        {path: 'rules.hitstopScale', label: 'Escala de hitstop', min: 0, max: 2, step: 0.1},
        {path: 'rules.koThreshold', label: 'Limiar de nocaute', min: 0, max: 0.4, step: 0.05},
        {path: 'rules.tackleCancelWindow', label: 'Cancel. Tackle (s)', min: 0, max: 0.3, step: 0.01},
        {path: 'rules.dashCancelWindow', label: 'Cancel. Dash (s)', min: 0, max: 0.3, step: 0.01},
        {path: 'rules.partialBlockDamage', label: 'Dano parcial', min: 0, max: 1, step: 0.05},
        {path: 'rules.perfectBlockDamage', label: 'Dano perfeito', min: 0, max: 1, step: 0.05},
        {path: 'rules.perfectBlockStun', label: 'Stun perfeito', min: 0, max: 1, step: 0.05},
        {path: 'rules.stoneClashDamageMul', label: 'Mult. choque Stone', min: 0, max: 2, step: 0.1},
        {path: 'rules.lagCancelCost', label: 'Custo lag-cancel', min: 0, max: 40, step: 1},
      ]},
      {label: 'Locomoção', items: [
        {path: 'locomotion.runSpeed', label: 'Velocidade corrida', min: 2, max: 16, step: 0.5},
        {path: 'locomotion.walkSpeed', label: 'Velocidade caminhada', min: 0.5, max: 8, step: 0.25},
        {path: 'locomotion.turnSpeed', label: 'Velocidade de giro', min: 1, max: 12, step: 0.5},
        {path: 'locomotion.accel', label: 'Aceleração', min: 1, max: 30, step: 1},
        {path: 'locomotion.friction', label: 'Atrito', min: 1, max: 30, step: 1},
        {path: 'locomotion.frictionTurning', label: 'Atrito em giro', min: 0, max: 1, step: 0.05},
        {path: 'locomotion.dashSpeed', label: 'Velocidade dash', min: 5, max: 30, step: 1},
        {path: 'locomotion.dashDuration', label: 'Duração dash', min: 0.1, max: 1.2, step: 0.05},
        {path: 'locomotion.dashCooldown', label: 'Cooldown dash', min: 0, max: 2, step: 0.05},
        {path: 'locomotion.backdashMul', label: 'Mult. backdash', min: 0.2, max: 2, step: 0.05},
        {path: 'locomotion.flightSpeed', label: 'Velocidade voo', min: 1, max: 12, step: 0.5},
        {path: 'locomotion.flightCost', label: 'Custo voo', min: 0, max: 40, step: 1},
        {path: 'locomotion.flightGravity', label: 'Gravidade voo', min: 0, max: 1, step: 0.05},
        {path: 'locomotion.flightAccel', label: 'Aceleração voo', min: 0.5, max: 10, step: 0.5},
        {path: 'locomotion.flightStartBoost', label: 'Impulso inicial voo', min: 0, max: 5, step: 0.5},
        {path: 'locomotion.dashInvincible', label: 'Dash invencível', type: 'bool'},
        {path: 'locomotion.dashIframes', label: 'Quadros invenc.', min: 0, max: 30, step: 1},
        {path: 'locomotion.dashGhostTrail', label: 'Rastro dash', type: 'bool'},
        {path: 'locomotion.dashGhostColor', label: 'Cor rastro dash', type: 'hex'},
        {path: 'locomotion.dashGhostOpacity', label: 'Opacidade rastro dash', min: 0, max: 1, step: 0.05},
        {path: 'locomotion.dashGhostCount', label: 'Quantidade rastro', min: 0, max: 12, step: 1},
        {path: 'locomotion.backdashInvincible', label: 'Backdash invencível', type: 'bool'},
        {path: 'locomotion.backdashIframes', label: 'I-frames backdash', min: 0, max: 30, step: 1},
        {path: 'locomotion.backdashGhostTrail', label: 'Rastro backdash', type: 'bool'},
      ]},
      {label: 'Combustível', items: [
        {path: 'rules.chargeSpeed', label: 'Velocidade de carga', min: 0.5, max: 5, step: 0.1},
        {path: 'rules.chargeCost', label: 'Custo de carga', min: 0, max: 2, step: 0.1},
        {path: 'rules.chargeDecay', label: 'Decaimento de carga', min: 0, max: 1, step: 0.05},
        {path: 'rules.reflectCost', label: 'Custo reflect', min: 0, max: 40, step: 1},
        {path: 'rules.reflectHoldCost', label: 'Custo segurar Reflect', min: 0, max: 2, step: 0.1},
        {path: 'rules.reflectPowerMax', label: 'Potência máxima', min: 1, max: 5, step: 0.1},
        {path: 'rules.reflectProjectileScale', label: 'Escala do projétil', min: 0.5, max: 3, step: 0.1},
        {path: 'rules.reflectDamageScale', label: 'Dano refletido', min: 0.2, max: 5, step: 0.1},
        {path: 'rules.reflectSpeedScale', label: 'Velocidade refletida', min: 0.2, max: 5, step: 0.1},
        {path: 'rules.chargeHoldIdle', label: 'Segurar sem custo', type: 'bool'},
        {path: 'rules.chargeCancelCooldown', label: 'Cooldown de cancel.', min: 0, max: 1, step: 0.05},
        {path: 'rules.exhaustionRecoveryTime', label: 'Tempo de exaustão', min: 0, max: 2, step: 0.05},
        {path: 'rules.exhaustionStaminaLock', label: 'Stamina bloqueada', min: 0, max: 1, step: 0.05},
        {path: 'rules.exhaustionDamageMul', label: 'Mult. dano exausto', min: 0.5, max: 3, step: 0.1},
        {path: 'rules.exhaustionSpeedMul', label: 'Mult. vel. exausto', min: 0.1, max: 1, step: 0.05},
        {path: 'rules.staminaBurnoutThreshold', label: 'Limiar burnout', min: 0, max: 1, step: 0.05},
        {path: 'rules.tackleMomentumMode', label: 'Modo momento tackle', type: 'select', options: [['locked', 'Bloqueado (D5)'], ['preserved', 'Preservado (D6+)']]},
      ]},
      {label: 'Dano e vulnerabilidade', items: [
        {path: 'rules.bleedDamage', label: 'Dano de sangramento', min: 0, max: 5, step: 0.1},
        {path: 'rules.bleedInterval', label: 'Intervalo de sangramento', min: 0.1, max: 2, step: 0.05},
        {path: 'rules.staggerDuration', label: 'Duração do stagger', min: 0, max: 2, step: 0.05},
        {path: 'rules.stunMultiplier', label: 'Mult. stun', min: 0.5, max: 3, step: 0.1},
        {path: 'rules.exhaustionStunMultiplier', label: 'Mult. stun exausto', min: 0.5, max: 3, step: 0.1},
        {path: 'rules.damageBonusOnStamina', label: 'Bônus stamina cheia', min: 0, max: 1, step: 0.05},
        {path: 'rules.damageBonusOnHalfHp', label: 'Bônus metade HP', min: 0, max: 1, step: 0.05},
        {path: 'rules.lagOnExhaustion', label: 'Lag em exaustão', min: 0, max: 1, step: 0.05},
        {path: 'rules.lagOnHp50', label: 'Lag em metade HP', min: 0, max: 1, step: 0.05},
        {path: 'rules.lagOnHp25', label: 'Lag em 25% HP', min: 0, max: 1, step: 0.05},
        {path: 'rules.flinchChance', label: 'Chance de flinch', min: 0, max: 1, step: 0.05},
        {path: 'rules.hpRegenPerSecond', label: 'Regen HP/s', min: 0, max: 10, step: 0.1},
        {path: 'rules.hpRegenDelay', label: 'Atraso regen HP', min: 0, max: 5, step: 0.1},
      ]},
      {label: 'Sobreposições', items: [
        {path: 'rules.counterWindowDuration', label: 'Duração da janela', min: 0, max: 1.2, step: 0.05},
        {path: 'rules.counterWindowCooldown', label: 'Cooldown', min: 0, max: 5, step: 0.05},
        {path: 'rules.counterDamageMul', label: 'Mult. dano', min: 1, max: 3, step: 0.1},
        {path: 'rules.counterStunMul', label: 'Mult. stun', min: 1, max: 3, step: 0.1},
        {path: 'rules.counterIframes', label: 'I-frames', min: 0, max: 30, step: 1},
        {path: 'rules.counterWalkSpeedMul', label: 'Mult. vel. caminhada', min: 0.2, max: 1, step: 0.05},
        {path: 'rules.counterLagOnMiss', label: 'Lag no erro', min: 0, max: 0.5, step: 0.02},
        {path: 'rules.shieldCostPerSecond', label: 'Custo por segundo', min: 0, max: 20, step: 1},
        {path: 'rules.shieldMovePenalty', label: 'Penalidade mov.', min: 0, max: 1, step: 0.05},
        {path: 'rules.shieldDamageMul', label: 'Mult. dano com escudo', min: 0, max: 1, step: 0.05},
        {path: 'rules.shieldBlockAngle', label: 'Ângulo de bloqueio', min: 60, max: 180, step: 5},
        {path: 'rules.shieldKnockbackReduction', label: 'Redução knockback', min: 0, max: 1, step: 0.05},
        {path: 'rules.burstCancelCost', label: 'Custo cancelamento', min: 0, max: 40, step: 1},
        {path: 'rules.burstDamageMul', label: 'Mult. dano', min: 1, max: 3, step: 0.1},
        {path: 'rules.burstKnockbackMul', label: 'Mult. knockback', min: 1, max: 3, step: 0.1},
        {path: 'rules.burstDuration', label: 'Duração', min: 0.5, max: 4, step: 0.1},
        {path: 'rules.burstCooldown', label: 'Cooldown', min: 0, max: 10, step: 0.1},
        {path: 'rules.burstSlowMul', label: 'Desaceleração', min: 0.2, max: 1, step: 0.05},
        {path: 'rules.burstRegenBonus', label: 'Bônus de regen.', min: 0, max: 3, step: 0.1},
        {path: 'rules.burstMaxSpeedMul', label: 'Máx. velocidade', min: 1, max: 2, step: 0.05},
        {path: 'rules.burstJumpBonus', label: 'Bônus de pulo', min: 0, max: 1, step: 0.05},
        {path: 'rules.burstCounterBonus', label: 'Bônus contra-ataque', min: 0, max: 1, step: 0.05},
        {path: 'rules.burstReflectBonus', label: 'Bônus Reflect', min: 0, max: 1, step: 0.05},
      ]},
      {label: 'Movimentos especiais', items: [
        {path: 'rules.psyshockCost', label: 'Custo Psyshock', min: 0, max: 40, step: 1},
        {path: 'rules.psyshockSpeed', label: 'Velocidade Psyshock', min: 3, max: 20, step: 0.5},
        {path: 'rules.psyshockDamage', label: 'Dano Psyshock', min: 5, max: 60, step: 1},
        {path: 'rules.psyshockStun', label: 'Stun Psyshock', min: 0, max: 2, step: 0.05},
        {path: 'rules.psyshockStartup', label: 'Startup Psyshock', min: 0, max: 0.5, step: 0.02},
        {path: 'rules.psyshockProjectileSize', label: 'Tamanho projétil', min: 0.2, max: 2, step: 0.05},
        {path: 'rules.psyshockCooldown', label: 'Cooldown Psyshock', min: 0, max: 3, step: 0.05},
        {path: 'rules.psyshockAirCostMul', label: 'Custo no ar', min: 0.5, max: 2, step: 0.1},
        {path: 'rules.psyshockPl2DamageMul', label: 'Mult. dano PL2', min: 1, max: 2, step: 0.05},
        {path: 'rules.psyshockPl2SpeedMul', label: 'Mult. vel. PL2', min: 1, max: 2, step: 0.05},
        {path: 'rules.psyshockPl2SizeMul', label: 'Mult. tamanho PL2', min: 1, max: 2, step: 0.05},
        {path: 'rules.psyshockPl2StunMul', label: 'Mult. stun PL2', min: 1, max: 2, step: 0.05},
        {path: 'rules.safeguardDuration', label: 'Duração Safeguard', min: 0, max: 5, step: 0.1},
        {path: 'rules.safeguardStun', label: 'Stun Safeguard', min: 0, max: 2, step: 0.05},
        {path: 'rules.safeguardCooldown', label: 'Cooldown Safeguard', min: 0, max: 5, step: 0.1},
        {path: 'rules.tackleSpeed', label: 'Velocidade Tackle', min: 2, max: 20, step: 0.5},
        {path: 'rules.tackleDamage', label: 'Dano Tackle', min: 5, max: 60, step: 1},
        {path: 'rules.tackleStun', label: 'Stun Tackle', min: 0, max: 2, step: 0.05},
        {path: 'rules.tackleStartup', label: 'Startup Tackle', min: 0, max: 0.5, step: 0.02},
        {path: 'rules.tackleDuration', label: 'Duração Tackle', min: 0.1, max: 1, step: 0.05},
        {path: 'rules.tackleCooldown', label: 'Cooldown Tackle', min: 0, max: 3, step: 0.05},
        {path: 'rules.tackleAirCostMul', label: 'Custo no ar', min: 0.5, max: 2, step: 0.1},
        {path: 'rules.tackleLagOnWhiff', label: 'Lag no erro', min: 0, max: 1, step: 0.05},
        {path: 'rules.tackleLagOnHit', label: 'Lag no acerto', min: 0, max: 1, step: 0.05},
        {path: 'rules.tackleLagOnBlock', label: 'Lag no bloqueio', min: 0, max: 1, step: 0.05},
        {path: 'rules.tacklePl2SpeedMul', label: 'Mult. vel. PL2', min: 1, max: 2, step: 0.05},
        {path: 'rules.tacklePl2DamageMul', label: 'Mult. dano PL2', min: 1, max: 2, step: 0.05},
        {path: 'rules.tacklePl2StunMul', label: 'Mult. stun PL2', min: 1, max: 2, step: 0.05},
        {path: 'rules.quickAttackCost', label: 'Custo Quick Attack', min: 0, max: 40, step: 1},
        {path: 'rules.quickAttackSpeed', label: 'Velocidade Quick Attack', min: 5, max: 25, step: 0.5},
        {path: 'rules.quickAttackDamage', label: 'Dano Quick Attack', min: 2, max: 40, step: 1},
        {path: 'rules.quickAttackStun', label: 'Stun Quick Attack', min: 0, max: 1, step: 0.05},
        {path: 'rules.quickAttackStartup', label: 'Startup Quick Attack', min: 0, max: 0.3, step: 0.01},
        {path: 'rules.quickAttackDuration', label: 'Duração Quick Attack', min: 0.05, max: 0.5, step: 0.01},
        {path: 'rules.quickAttackCooldown', label: 'Cooldown Quick Attack', min: 0, max: 2, step: 0.05},
        {path: 'rules.stoneArmorDuration', label: 'Duração Stone Armor', min: 0, max: 5, step: 0.1},
        {path: 'rules.stoneArmorDamageMul', label: 'Redução de dano', min: 0, max: 1, step: 0.05},
        {path: 'rules.stoneArmorSpeedMul', label: 'Mult. velocidade', min: 0.2, max: 1, step: 0.05},
        {path: 'rules.stoneArmorCooldown', label: 'Cooldown Stone Armor', min: 0, max: 5, step: 0.1},
        {path: 'rules.lifeDewDuration', label: 'Duração Life Dew', min: 0, max: 5, step: 0.1},
        {path: 'rules.lifeDewRegenPerSecond', label: 'Regen/s', min: 0, max: 10, step: 0.5},
        {path: 'rules.lifeDewStun', label: 'Stun Life Dew', min: 0, max: 2, step: 0.05},
        {path: 'rules.lifeDewCooldown', label: 'Cooldown Life Dew', min: 0, max: 5, step: 0.1},
        {path: 'rules.synthesisDuration', label: 'Duração Synthesis', min: 0, max: 5, step: 0.1},
        {path: 'rules.synthesisStaminaRegen', label: 'Regen stamina/s', min: 0, max: 20, step: 1},
        {path: 'rules.synthesisCooldown', label: 'Cooldown Synthesis', min: 0, max: 5, step: 0.1},
      ]},
      {label: 'Poise', items: [
        {path: 'rules.poiseDamage', label: 'Dano de poise', min: 0, max: 40, step: 1},
        {path: 'rules.poiseBreakStun', label: 'Stun na quebra', min: 0, max: 2, step: 0.05},
        {path: 'rules.poiseBreakKnockback', label: 'Knockback na quebra', min: 0, max: 10, step: 0.5},
        {path: 'rules.poiseRecover', label: 'Recuperação de poise', min: 0, max: 10, step: 0.5},
        {path: 'rules.poiseDrainOnHit', label: 'Drenagem ao acertar', min: 0, max: 10, step: 0.5},
        {path: 'rules.poiseDrainOnBlock', label: 'Drenagem ao bloquear', min: 0, max: 10, step: 0.5},
        {path: 'rules.poiseWhileMoving', label: 'Poise em movimento', min: 0, max: 1, step: 0.05},
        {path: 'rules.poiseDecay', label: 'Decaimento de poise', min: 0, max: 2, step: 0.05},
        {path: 'rules.poiseDamagePerHit', label: 'Dano de poise por golpe', min: 0, max: 10, step: 0.5},
        {path: 'rules.poiseStaggerThreshold', label: 'Limiar de stagger', min: 0, max: 1, step: 0.05},
        {path: 'rules.poiseKnockbackScale', label: 'Escala de knockback', min: 0, max: 3, step: 0.1},
        {path: 'rules.poiseStaminaOnBreak', label: 'Stamina na quebra', min: 0, max: 1, step: 0.05},
      ]},
      {label: 'Hyperarmor', items: [
        {path: 'rules.hyperarmorDamageReduction', label: 'Redução de dano', min: 0, max: 1, step: 0.05},
        {path: 'rules.hyperarmorKnockbackReduction', label: 'Redução knockback', min: 0, max: 1, step: 0.05},
        {path: 'rules.hyperarmorActiveAfterHp', label: 'Ativo após HP', min: 0, max: 1, step: 0.05},
        {path: 'rules.hyperarmorStaminaMul', label: 'Mult. stamina', min: 0, max: 2, step: 0.05},
        {path: 'rules.hyperarmorDamageMul', label: 'Mult. dano', min: 0, max: 2, step: 0.05},
        {path: 'rules.hyperarmorFlinchImmune', label: 'Imune a flinch', type: 'bool'},
      ]},
      {label: 'Combos', items: [
        {path: 'rules.comboDamageScale', label: 'Escala de dano', min: 0, max: 1, step: 0.05},
        {path: 'rules.comboStunScale', label: 'Escala de stun', min: 0, max: 1, step: 0.05},
        {path: 'rules.comboKnockbackScale', label: 'Escala de knockback', min: 0, max: 1, step: 0.05},
        {path: 'rules.comboMaxHits', label: 'Máximo de golpes', min: 2, max: 20, step: 1},
        {path: 'rules.comboDamageRamp', label: 'Aumento de dano', min: 0, max: 1, step: 0.05},
        {path: 'rules.comboKnockbackRamp', label: 'Aumento knockback', min: 0, max: 1, step: 0.05},
        {path: 'rules.comboGravityScale', label: 'Escala de gravidade', min: 0.2, max: 2, step: 0.05},
        {path: 'rules.comboResetTime', label: 'Tempo de reset', min: 0, max: 2, step: 0.05},
        {path: 'rules.groundBounceChance', label: 'Chance de quicar', min: 0, max: 1, step: 0.05},
        {path: 'rules.wallBounceChance', label: 'Chance de ricochetear', min: 0, max: 1, step: 0.05},
        {path: 'rules.wallStickDuration', label: 'Duração grudado', min: 0, max: 2, step: 0.05},
        {path: 'rules.groundBounceHeight', label: 'Altura do quique', min: 0, max: 5, step: 0.2},
        {path: 'rules.launchAngleMin', label: 'Ângulo mín. lançamento', min: 10, max: 90, step: 5},
        {path: 'rules.launchAngleMax', label: 'Ângulo máx. lançamento', min: 10, max: 90, step: 5},
      ]},
      {label: 'Projéteis', items: [
        {path: 'rules.projectileSpeed', label: 'Velocidade base', min: 2, max: 20, step: 0.5},
        {path: 'rules.projectileSize', label: 'Tamanho base', min: 0.1, max: 2, step: 0.05},
        {path: 'rules.projectileDamage', label: 'Dano base', min: 5, max: 60, step: 1},
        {path: 'rules.projectileStun', label: 'Stun base', min: 0, max: 2, step: 0.05},
        {path: 'rules.projectileKnockback', label: 'Knockback base', min: 0, max: 10, step: 0.5},
        {path: 'rules.projectileGravity', label: 'Gravidade', min: 0, max: 2, step: 0.05},
        {path: 'rules.projectileMaxAge', label: 'Vida máx. (s)', min: 0.5, max: 10, step: 0.1},
        {path: 'rules.projectileCollisionSize', label: 'Tamanho de colisão', min: 0.1, max: 2, step: 0.05},
        {path: 'rules.projectileBounce', label: 'Quique', type: 'bool'},
        {path: 'rules.projectileHoming', label: 'Busca', type: 'bool'},
        {path: 'rules.projectileHomingStrength', label: 'Força de busca', min: 0, max: 2, step: 0.1},
      ]},
      {label: 'Arena', items: [
        {path: 'rules.arenaDamage', label: 'Dano na borda', min: 0, max: 20, step: 1},
        {path: 'rules.arenaKnockback', label: 'Knockback na borda', min: 0, max: 10, step: 0.5},
        {path: 'rules.ringOutDamage', label: 'Dano de ring-out', min: 0, max: 50, step: 1},
        {path: 'rules.ringOutStun', label: 'Stun de ring-out', min: 0, max: 2, step: 0.05},
        {path: 'rules.ringOutKnockback', label: 'Knockback de ring-out', min: 0, max: 10, step: 0.5},
        {path: 'rules.arenaShrinkRate', label: 'Taxa de encolhimento', min: 0, max: 2, step: 0.1},
        {path: 'rules.arenaShrinkInterval', label: 'Intervalo encolh.', min: 1, max: 60, step: 1},
        {path: 'rules.arenaMinRadius', label: 'Raio mínimo', min: 2, max: 10, step: 0.5},
        {path: 'rules.arenaShrinkDamage', label: 'Dano encolh.', min: 0, max: 10, step: 0.5},
      ]},
      {label: 'IA', items: [
        {path: 'ai.aggroDistance', label: 'Distância de aggro', min: 2, max: 20, step: 0.5},
        {path: 'ai.attackRange', label: 'Alcance de ataque', min: 1, max: 8, step: 0.25},
        {path: 'ai.reactionTime', label: 'Tempo de reação', min: 0, max: 1, step: 0.05},
        {path: 'ai.dodgeChance', label: 'Chance de esquiva', min: 0, max: 1, step: 0.05},
        {path: 'ai.blockChance', label: 'Chance de bloqueio', min: 0, max: 1, step: 0.05},
        {path: 'ai.counterChance', label: 'Chance de contra-ataque', min: 0, max: 1, step: 0.05},
        {path: 'ai.chargeChance', label: 'Chance de carga', min: 0, max: 1, step: 0.05},
        {path: 'ai.jumpChance', label: 'Chance de pulo', min: 0, max: 1, step: 0.05},
        {path: 'ai.flyChance', label: 'Chance de voo', min: 0, max: 1, step: 0.05},
        {path: 'ai.retreatDistance', label: 'Distância de recuo', min: 1, max: 10, step: 0.5},
        {path: 'ai.attackCooldown', label: 'Cooldown de ataque', min: 0, max: 2, step: 0.05},
        {path: 'ai.skillCooldown', label: 'Cooldown de habilidade', min: 0, max: 3, step: 0.05},
        {path: 'ai.patrolRadius', label: 'Raio de patrulha', min: 2, max: 15, step: 0.5},
        {path: 'ai.patrolSpeed', label: 'Velocidade patrulha', min: 0.5, max: 4, step: 0.25},
        {path: 'ai.flankChance', label: 'Chance de flanquear', min: 0, max: 1, step: 0.05},
        {path: 'ai.retreatHealth', label: 'Recuar com HP', min: 0, max: 1, step: 0.05},
        {path: 'ai.chargeDistance', label: 'Distância de carga', min: 1, max: 10, step: 0.5},
        {path: 'ai.predictLead', label: 'Predição', min: 0, max: 1, step: 0.05},
        {path: 'ai.pressureThreshold', label: 'Limiar de pressão', min: 0, max: 1, step: 0.05},
        {path: 'ai.pressureChance', label: 'Chance de pressão', min: 0, max: 1, step: 0.05},
        {path: 'ai.aggression', label: 'Agressividade', min: 0, max: 1, step: 0.05},
        {path: 'ai.defense', label: 'Defensividade', min: 0, max: 1, step: 0.05},
        {path: 'ai.burstChance', label: 'Chance de burst', min: 0, max: 1, step: 0.05},
        {path: 'ai.shieldChance', label: 'Chance de escudo', min: 0, max: 1, step: 0.05},
        {path: 'ai.safeguardChance', label: 'Chance de Safeguard', min: 0, max: 1, step: 0.05},
        {path: 'ai.moveDistance', label: 'Distância de movimento', min: 1, max: 10, step: 0.5},
        {path: 'ai.comboAwareness', label: 'Consciência de combo', min: 0, max: 1, step: 0.05},
        {path: 'ai.adaptationRate', label: 'Taxa de adaptação', min: 0, max: 1, step: 0.05},
        {path: 'ai.staminaConservation', label: 'Conservação de stamina', min: 0, max: 1, step: 0.05},
        {path: 'ai.learningEnabled', label: 'Aprendizado habilitado', type: 'bool'},
        {path: 'ai.perfectBlockChance', label: 'Chance de bloqueio perfeito', min: 0, max: 1, step: 0.05},
      ]},
    ]},
  ],
  // Teste (velocidade, semente e hooks)
  test: [
    {label: 'Teste', groups: [
      {label: 'Controle', items: [
        {path: 'test.step', label: 'Passo (s)', min: 0.005, max: 0.1, step: 0.001},
        {path: 'test.seed', label: 'Semente', type: 'int'},
        {path: 'test.fixedSeed', label: 'Fixar semente', type: 'bool'},
        {path: 'test.enableRecord', label: 'Gravar partida', type: 'bool'},
        {path: 'test.timeLimit', label: 'Limite de tempo (s)', min: 0, max: 600, step: 10},
        {path: 'test.startDelay', label: 'Atraso inicial (s)', min: 0, max: 2, step: 0.1},
        {path: 'test.invincible', label: 'Invencível', type: 'bool'},
        {path: 'test.infiniteStamina', label: 'Stamina infinita', type: 'bool'},
        {path: 'test.maxCharge', label: 'Carga máxima', type: 'bool'},
        {path: 'test.restartOnResult', label: 'Reiniciar ao terminar', type: 'bool'},
        {path: 'test.saveOnResult', label: 'Gravar ao terminar', type: 'bool'},
        {path: 'test.skipMenu', label: 'Pular menu', type: 'bool'},
        {path: 'test.fastRespawn', label: 'Respawn rápido', type: 'bool'},
        {path: 'test.showFps', label: 'Mostrar FPS', type: 'bool'},
        {path: 'test.showFrame', label: 'Mostrar quadro', type: 'bool'},
        {path: 'test.showGhosts', label: 'Mostrar fantasmas', type: 'bool'},
        {path: 'test.showPaths', label: 'Mostrar caminhos', type: 'bool'},
        {path: 'test.showAngles', label: 'Mostrar ângulos', type: 'bool'},
        {path: 'test.showDistances', label: 'Mostrar distâncias', type: 'bool'},
        {path: 'test.showStates', label: 'Mostrar estados', type: 'bool'},
        {path: 'test.showStamina', label: 'Mostrar stamina', type: 'bool'},
        {path: 'test.showCooldowns', label: 'Mostrar cooldowns', type: 'bool'},
        {path: 'test.showHitboxDetails', label: 'Detalhes de hitbox', type: 'bool'},
        {path: 'test.showAiDebug', label: 'Debug da IA', type: 'bool'},
        {path: 'test.showDecisionTree', label: 'Árvore de decisão', type: 'bool'},
        {path: 'test.perfOverlay', label: 'Sobreposição de desempenho', type: 'bool'},
        {path: 'test.perfHistory', label: 'Histórico de desempenho', type: 'bool'},
        {path: 'test.mirrorInputs', label: 'Espelhar entradas', type: 'bool'},
        {path: 'test.mirrorDelay', label: 'Atraso espelho', min: 0, max: 1, step: 0.01},
        {path: 'test.aiMirror', label: 'Espelhar IA', type: 'bool'},
        {path: 'test.frameByFrame', label: 'Quadro a quadro', type: 'bool'},
        {path: 'test.frameByFrameKey', label: 'Tecla Q-Q', type: 'bool'},
        {path: 'test.showCollisionPairs', label: 'Pares de colisão', type: 'bool'},
      ]},
    ]},
  ],
  // Extras (hooks, presets e modo de jogo)
  extras: [
    {label: 'Extras', groups: [
      {label: 'Atalhos', items: [
        {path: 'extras.toggles.showHitboxes', label: 'Mostrar hitboxes', type: 'bool'},
        {path: 'extras.toggles.showAttackVectors', label: 'Mostrar vetores de ataque', type: 'bool'},
        {path: 'extras.toggles.showInputs', label: 'Mostrar entradas', type: 'bool'},
        {path: 'extras.toggles.showAiDebug', label: 'Debug da IA', type: 'bool'},
        {path: 'extras.toggles.enablePlayerAI', label: 'IA do jogador', type: 'bool'},
        {path: 'extras.toggles.enemyManual', label: 'Controle manual do vermelho', type: 'bool'},
        {path: 'extras.toggles.enableAssist', label: 'Assistência de combo', type: 'bool'},
        {path: 'extras.toggles.showFrameGuide', label: 'Guia de quadros', type: 'bool'},
        {path: 'extras.toggles.showDojoOverlay', label: 'Sobreposição do dojo', type: 'bool'},
        {path: 'extras.toggles.showMoveGuide', label: 'Guia de movimentos', type: 'bool'},
        {path: 'extras.toggles.showMatchupGuide', label: 'Guia de matchup', type: 'bool'},
        {path: 'extras.toggles.showCharacterStats', label: 'Estatísticas do personagem', type: 'bool'},
        {path: 'extras.toggles.showActionGuide', label: 'Guia de ações', type: 'bool'},
        {path: 'extras.toggles.showResourceGuide', label: 'Guia de recursos', type: 'bool'},
        {path: 'extras.toggles.showPhaseGuide', label: 'Guia de fases', type: 'bool'},
        {path: 'extras.toggles.showComboGuide', label: 'Guia de combos', type: 'bool'},
        {path: 'extras.toggles.showTrainingOverlay', label: 'Sobreposição de treino', type: 'bool'},
        {path: 'extras.toggles.showPerfOverlay', label: 'Sobreposição de desempenho', type: 'bool'},
        {path: 'extras.toggles.showDiagnosticOverlay', label: 'Sobreposição de diagnóstico', type: 'bool'},
        {path: 'extras.toggles.showAiEvalOverlay', label: 'Sobreposição de avaliação IA', type: 'bool'},
        {path: 'extras.toggles.showMovementOverlay', label: 'Sobreposição de movimento', type: 'bool'},
        {path: 'extras.toggles.showWindowsOverlay', label: 'Sobreposição de janelas', type: 'bool'},
        {path: 'extras.toggles.showHomologation', label: 'Painel de homologação', type: 'bool'},
      ]},
      {label: 'Ajustes', items: [
        {path: 'extras.preset', label: 'Conjunto', type: 'select', options: [
          ['balanced', 'Equilibrado'],
          ['fast', 'Rápido'],
          ['slow', 'Lento'],
          ['chaotic', 'Caótico'],
          ['defensive', 'Defensivo'],
          ['aggressive', 'Agressivo'],
          ['tournament', 'Torneio'],
          ['experimental', 'Experimental'],
          ['training', 'Treino'],
          ['custom', 'Personalizado'],
        ]},
      ]},
      {label: 'Modo de jogo', items: [
        {path: 'extras.gameModes.playerMode', label: 'Modo do jogador', type: 'select', options: UI_AI_MODES},
        {path: 'extras.gameModes.enemyMode', label: 'Modo do oponente', type: 'select', options: UI_AI_MODES},
      ]},
      {label: 'HUD', items: [
        {path: 'extras.hud.debugVisible', label: 'Debug visível', type: 'bool'},
        {path: 'extras.hud.showDamageNumbers', label: 'Números de dano', type: 'bool'},
        {path: 'extras.hud.showDamageBreakdown', label: 'Detalhamento de dano', type: 'bool'},
        {path: 'extras.hud.showStaminaBar', label: 'Barra de stamina', type: 'bool'},
        {path: 'extras.hud.showChargeBar', label: 'Barra de carga', type: 'bool'},
        {path: 'extras.hud.showComboCounter', label: 'Contador de combo', type: 'bool'},
        {path: 'extras.hud.showAdvantage', label: 'Vantagem', type: 'bool'},
        {path: 'extras.hud.showInputs', label: 'Entradas', type: 'bool'},
        {path: 'extras.hud.showAiDebug', label: 'Debug da IA', type: 'bool'},
        {path: 'extras.hud.fpsSmoothing', label: 'Suavização FPS', min: 0, max: 1, step: 0.01},
        {path: 'extras.hud.showTimers', label: 'Temporizadores', type: 'bool'},
        {path: 'extras.hud.showDistance', label: 'Distância', type: 'bool'},
        {path: 'extras.hud.showSpeed', label: 'Velocidade', type: 'bool'},
        {path: 'extras.hud.showPosition', label: 'Posição', type: 'bool'},
        {path: 'extras.hud.showHitstop', label: 'Hitstop', type: 'bool'},
        {path: 'extras.hud.showHitlag', label: 'Hitlag', type: 'bool'},
        {path: 'extras.hud.showDamageLog', label: 'Log de dano', type: 'bool'},
        {path: 'extras.hud.showStateLog', label: 'Log de estado', type: 'bool'},
        {path: 'extras.hud.showActionLog', label: 'Log de ação', type: 'bool'},
        {path: 'extras.hud.showMoveLog', label: 'Log de movimento', type: 'bool'},
        {path: 'extras.hud.showAiLog', label: 'Log da IA', type: 'bool'},
        {path: 'extras.hud.showPerfLog', label: 'Log de desempenho', type: 'bool'},
        {path: 'extras.hud.showResourceLog', label: 'Log de recursos', type: 'bool'},
        {path: 'extras.hud.showFrameLog', label: 'Log de quadros', type: 'bool'},
        {path: 'extras.hud.showTrainingLog', label: 'Log de treino', type: 'bool'},
        {path: 'extras.hud.showDiagnosticLog', label: 'Log de diagnóstico', type: 'bool'},
        {path: 'extras.hud.showMovementLog', label: 'Log de movimento', type: 'bool'},
        {path: 'extras.hud.showHomologationLog', label: 'Log de homologação', type: 'bool'},
        {path: 'extras.hud.showMatchupGuide', label: 'Guia de matchup', type: 'bool'},
        {path: 'extras.hud.showActionGuide', label: 'Guia de ações', type: 'bool'},
        {path: 'extras.hud.showResourceGuide', label: 'Guia de recursos', type: 'bool'},
        {path: 'extras.hud.showPhaseGuide', label: 'Guia de fases', type: 'bool'},
        {path: 'extras.hud.showComboGuide', label: 'Guia de combos', type: 'bool'},
        {path: 'extras.hud.showPassiveActivation', label: 'Ativação passiva', type: 'bool'},
      ]},
    ]},
  ],
});

// ============ Presets ============
const presets = createPresetsPanel(C, tuning);
// Preset de balanceamento: mescla “comum” (A/B) + “exclusivo” (A∖B, B∖A) em compareMatch.
let balance = null;
function runBalancePreset(scenarioIds) {
  if (!scenarioIds?.length) {alert('Selecione pelo menos um cenário.');return;}
  const scenarios = scenarioIds.map(id => SCENARIOS.find(s => s.id === id)).filter(Boolean);
  if (!scenarios.length) return;
  balance = runBalance({game, view, scenarios, compareFn: compareMatch, clock, C, tuning, makeRecording: () => matchRec});balance.rows = balanceRows(balance);
  const box = document.getElementById('balance-report');box.innerHTML = `<table><tr><th>Cenário</th><th>Vitórias P1</th><th>Vitórias P2</th><th>Empates</th><th>Taxa P1</th><th>Taxa P2</th></tr>${balance.rows.map(r => `<tr><td>${escape(r.name)}</td><td>${r.p1}</td><td>${r.p2}</td><td>${r.draws}</td><td>${r.p1Rate}</td><td>${r.p2Rate}</td></tr>`).join('')}</table>`;
}

// ============ Personagens ============
let charPanel = null, charHooks = {};
function onCharactersChanged() {syncCharacterCombatWindows();syncRuleDurations();dock.invalidate();}
function setCharacter(slot, character) {ui.characters[slot] = character;game.fighters[slot].character = character;onCharactersChanged();}
async function loadStudioFileForSlot(file, slot) {const r = await loadStudioFile(file);if (r.error) return {error: r.error};ui.sources[slot] = {file, name: file.name, size: file.size};setCharacter(slot, r.character);return r;}
function renderCharacters() {charPanel.render();}
function renderCharacterLive() {charPanel.live?.();}
function syncCharacterCombatWindows() {for (const f of game.fighters) if (f.character) f.character.syncCombatWindows();}
function syncRuleDurations() {for (const f of game.fighters) if (f.character) f.character.syncRuleDurations();}
function refreshAnimSliders() {charPanel.refreshSliders?.();}
charPanel = createCharacterPanel({game, ui, $, setCharacter, loadStudioFileForSlot, renderCharacters, onCharactersChanged});
Object.assign(charHooks, charPanel.hooks);

// ============ Dock e painéis ============
const dock = createDock($('dock'), {tuning, clock, game, view, $, compareScenarios, SCENARIOS, runScenario});
const movement = createMovementPanel({$, game, view, C});
const diagnostics = createDiagnostics({$, C, game, ui, movement});
const training = createTrainingPanel({$, game, view, input, C, startMatch, resetViewAndLogs, togglePause, diagnostics});
const perfPanel = createPerfPanel({$, game, C});
const aiEval = createAiEvalPanel({$, game, C, input, startMatch, togglePause});
const homologation = createHomologation({$, SCENARIOS});
const visualPanel = createVisualPanel({$, view, C, game, canvas, tuning, startMatch, applyConfig});
const hudProposals = new HudProposals({$, game, C});
const movesHud = new MovesHud({$, game});
const windowsOverlay = createWindowsOverlay({$, game});
let projectFiles = null;
const quickPanel = createQuickPanel({$, game, onQuickStart});
const presetsPanel = createPresetsPanel(C, tuning);
const actionsDrawer = createActionsDrawer({$, input, game, view, canvas});

// ---------- Ferramentas ----------
const TITLES = {
  match: 'Partida',
  characters: 'Personagens',
  visual: 'Visual',
  tuning: 'Ajustes',
  scenarios: 'Cenários',
  telemetry: 'Telemetria',
  replay: 'Replay',
  workspace: 'Workspace',
  presets: 'Presets',
  actions: 'Ações',
  movement: 'Movimento',
  diagnostics: 'Diagnóstico',
  training: 'Treino',
  perf: 'Desempenho',
  ai: 'IA',
  homologation: 'Homologação',
  project: 'Projeto',
  quick: 'Início Rápido',
};
function openTool(id) {
  const panel = $('panel');
  panel.hidden = false;
  panel.dataset.tool = id;
  for (const b of document.querySelectorAll('[data-tool]')) b.classList.toggle('active', b.dataset.tool === id);
  const title = TITLES[id] ?? id;
  const h = panel.querySelector('h2');if (h) h.textContent = title;
  document.querySelectorAll('.tool-panel').forEach(p => p.hidden = true);
  const tp = document.querySelector(`.tool-panel[data-tool="${id}"]`);if (tp) tp.hidden = false;
  if (id === 'visual') visualPanel.enter();
  else visualPanel.leave();
  syncDockButtons();
  canvas.focus();
}
for (const b of document.querySelectorAll('[data-tool]')) b.addEventListener('click', () => openTool(b.dataset.tool));
$('panel-close').addEventListener('click', () => {$('panel').hidden = true;for (const b of document.querySelectorAll('[data-tool]')) b.classList.remove('active');syncDockButtons();canvas.focus();});
function syncDockButtons() {for (const b of document.querySelectorAll('[data-dock]')) b.classList.toggle('active', b.getAttribute('aria-pressed') === 'true');}

// ---------- Botões e entrada ----------
function syncButtons() {
  const playing = game.phase === 'playing' || game.phase === 'finishing';
  $('btn-start').textContent = playing ? 'Reiniciar (R)' : 'Iniciar';
  $('btn-start').classList.toggle('primary', !playing);
  $('btn-pause').textContent = ui.paused ? 'Retomar' : 'Pausar';
  $('btn-pause').disabled = !playing;
  $('btn-zen').classList.toggle('active', document.querySelector('.lab').classList.contains('zen-mode'));
  $('btn-zen').textContent = document.querySelector('.lab').classList.contains('zen-mode') ? 'Sair Zen' : 'Zen';
  $('dock').classList.toggle('playing', playing);
}
$('btn-start').addEventListener('click', () => {if (ui.training) training.begin();else startMatch();});
$('btn-pause').addEventListener('click', togglePause);
$('btn-zen').addEventListener('click', toggleZenMode);
$('btn-step').addEventListener('click', () => stepFrames(1));
$('btn-back').addEventListener('click', () => stepFrames(-1));
$('btn-live').addEventListener('click', goLive);
$('btn-hud').addEventListener('click', () => {hud.enabled = !hud.enabled;syncButtons();});
$('btn-audio').addEventListener('click', () => {soundFx.enabled = !soundFx.enabled;syncButtons();});
$('btn-debug').addEventListener('click', () => {C.extras.toggles.showHitboxes = !C.extras.toggles.showHitboxes;syncButtons();});
$('btn-restart').addEventListener('click', () => {if (ui.training) training.begin();else startMatch();});
$('btn-quit').addEventListener('click', () => {game.phase = 'menu';ui.paused = false;syncButtons();});
$('btn-settings').addEventListener('click', () => openTool('tuning'));
$('btn-help').addEventListener('click', () => openTool('quick'));

function applySeed() {
  const v = Number($('seed').value) || 1;
  if ($('seed-fixed').checked) C.test.seed = v;
  else delete C.test.seed;
}
$('seed').addEventListener('change', applySeed);
$('seed-fixed').addEventListener('change', applySeed);
function applyConfig() {
  view.applyConfig?.(C);
  hud.applyConfig?.(C);
  input.applyConfig?.(C);
  soundFx.applyConfig?.(C);
  visualPanel.applyConfig?.(C);
  movement.applyConfig?.(C);
  diagnostics.applyConfig?.(C);
  training.applyConfig?.(C);
  perfPanel.applyConfig?.(C);
  aiEval.applyConfig?.(C);
}
function resetMatchStats() {lastKoHandled = false;}

// ---------- Sistema de preset de balanceamento ----------
const BALANCE_SCENARIOS = ['basic-melee', 'ranged-spam', 'stamina-drain', 'corner-pressure', 'projectile-dodge', 'combo-test', 'exhaustion-test'];
$('balance-run').addEventListener('click', () => {
  const checked = [...document.querySelectorAll('[name="balance-scenario"]:checked')].map(cb => cb.value);
  runBalancePreset(checked.length ? checked : BALANCE_SCENARIOS);
});
for (const id of BALANCE_SCENARIOS) {
  const cb = document.querySelector(`[name="balance-scenario"][value="${id}"]`);
  if (cb) cb.checked = true;
}

// ---------- Movimentos especiais ----------
function createMovesDrawer() {
  const drawer = $('moves-drawer');
  if (!drawer) return;
  drawer.innerHTML = `
    <div class="drawer-header"><h4>Movimentos</h4><button type="button" class="drawer-close">×</button></div>
    <div class="drawer-body">
      <div class="move-group"><h5>Reflect</h5><button data-move="reflect">Reflect</button></div>
      <div class="move-group"><h5>Psyshock</h5><button data-move="psyshock">Psyshock</button></div>
      <div class="move-group"><h5>Safeguard</h5><button data-move="safeguard">Safeguard</button></div>
      <div class="move-group"><h5>Tackle</h5><button data-move="tackle">Tackle</button></div>
      <div class="move-group"><h5>Quick Attack</h5><button data-move="quickAttack">Quick Attack</button></div>
      <div class="move-group"><h5>Stone Armor</h5><button data-move="stoneArmor">Stone Armor</button></div>
      <div class="move-group"><h5>Life Dew</h5><button data-move="lifeDew">Life Dew</button></div>
      <div class="move-group"><h5>Synthesis</h5><button data-move="synthesis">Synthesis</button></div>
    </div>
  `;
  drawer.querySelector('.drawer-close').addEventListener('click', () => drawer.classList.remove('open'));
  drawer.querySelectorAll('[data-move]').forEach(btn => {
    btn.addEventListener('click', () => {
      const move = btn.dataset.move;
      const fighter = game.fighters[0];
      if (!fighter) return;
      fighter.action = {kind: move, elapsed: 0, ...Moves.getMove(move)};
    });
  });
}
createMovesDrawer();
$('btn-moves').addEventListener('click', () => $('moves-drawer').classList.toggle('open'));

// ---------- Replay e telemetria ----------
function renderLive() {
  const el = $('live-report');if (!el) return;
  const [p, e] = game.fighters;
  el.innerHTML = `<table><tr><th>Atributo</th><th>Jogador</th><th>Oponente</th></tr>
    <tr><td>HP</td><td>${p.hp.toFixed(0)}/${p.attributes.hp}</td><td>${e.hp.toFixed(0)}/${e.attributes.hp}</td></tr>
    <tr><td>Stamina</td><td>${p.stamina.toFixed(0)}/${C.rules.staminaMax}</td><td>${e.stamina.toFixed(0)}/${C.rules.staminaMax}</td></tr>
    <tr><td>Estado</td><td>${p.state}</td><td>${e.state}</td></tr>
    <tr><td>Posição</td><td>(${p.position.x.toFixed(1)}, ${p.position.z.toFixed(1)})</td><td>(${e.position.x.toFixed(1)}, ${e.position.z.toFixed(1)})</td></tr>
    <tr><td>Carga</td><td>${p.charge ? (p.charge.pl ?? 1) : '-'}</td><td>${e.charge ? (e.charge.pl ?? 1) : '-'}</td></tr>
  </table>`;
}
function renderHistory() {
  const el = $('history-report');if (!el) return;
  const hits = recorder.hits.slice(-20);
  el.innerHTML = hits.length ? `<table><tr><th>Tick</th><th>Atacante</th><th>Alvo</th><th>Dano</th><th>Resultado</th></tr>${hits.map(h => `<tr><td>${h.tick}</td><td>${h.attacker === 0 ? 'Jogador' : 'Oponente'}</td><td>${h.target === 0 ? 'Jogador' : 'Oponente'}</td><td>${h.damage?.toFixed(1) ?? '-'}</td><td>${h.result}</td></tr>`).join('')}</table>` : '<p class="hint">Nenhum acerto registrado.</p>';
}

// ---------- Áudio ----------
function handleSoundEvents(events) {
  if (!soundFx.enabled) return;
  for (const ev of events) {
    if (ev.type === 'hit') soundFx.playHit(ev.damage ?? 10);
    if (ev.type === 'block') soundFx.playBlock();
    if (ev.type === 'dash') soundFx.playDash();
    if (ev.type === 'jump') soundFx.playJump();
    if (ev.type === 'land') soundFx.playLand();
    if (ev.type === 'charge') soundFx.playCharge();
    if (ev.type === 'chargeRelease') soundFx.playChargeRelease(ev.pl ?? 1);
    if (ev.type === 'reflect') soundFx.playReflect();
    if (ev.type === 'exhaustion') soundFx.playExhaustion();
    if (ev.type === 'ko') soundFx.playKo();
    if (ev.type === 'projectile') soundFx.playProjectile();
    if (ev.type === 'counter') soundFx.playCounter();
    if (ev.type === 'burst') soundFx.playBurst();
    if (ev.type === 'shield') soundFx.playShield();
    if (ev.type === 'stagger') soundFx.playStagger();
    if (ev.type === 'poiseBreak') soundFx.playPoiseBreak();
    if (ev.type === 'perfectBlock') soundFx.playPerfectBlock();
    if (ev.type === 'tackle') soundFx.playTackle();
    if (ev.type === 'stoneArmor') soundFx.playStoneArmor();
    if (ev.type === 'lifeDew') soundFx.playLifeDew();
    if (ev.type === 'synthesis') soundFx.playSynthesis();
    if (ev.type === 'safeguard') soundFx.playSafeguard();
    if (ev.type === 'quickAttack') soundFx.playQuickAttack();
  }
}
function trackChargeSounds() {
  const [p] = game.fighters;
  if (!p || !soundFx.enabled) return;
  if (p.charge && !p._chargeSoundPlaying) {soundFx.playCharge();p._chargeSoundPlaying = true;}
  if (!p.charge && p._chargeSoundPlaying) {p._chargeSoundPlaying = false;}
}
function trackExhaustionSounds() {
  const [p] = game.fighters;
  if (!p || !soundFx.enabled) return;
  if (p.state === 'exhausted' && !p._exhaustionSoundPlaying) {soundFx.playExhaustion();p._exhaustionSoundPlaying = true;}
  if (p.state !== 'exhausted' && p._exhaustionSoundPlaying) {p._exhaustionSoundPlaying = false;}
}
let lastKoHandled = false;
function checkKoTrigger() {
  if (lastKoHandled) return;
  const [p, e] = game.fighters;
  if (game.phase === 'result' && (p.hp <= 0 || e.hp <= 0)) {
    lastKoHandled = true;
    if (soundFx.enabled) soundFx.playKo();
    diagnostics.toast?.({text: p.hp <= 0 ? 'K.O.! Oponente venceu!' : 'K.O.! Você venceu!', fighter: p.hp <= 0 ? 1 : 0, kind: 'ko'});
  }
}
function trackMatchEvents(events) {
  for (const ev of events) {
    if (ev.type === 'hit' || ev.type === 'block') {
      diagnostics.toast?.({text: `${ev.result?.toUpperCase() ?? 'HIT'} · ${ev.damage?.toFixed(1) ?? '?'} dmg`, fighter: ev.target, kind: ev.type});
    }
  }
}

// ---------- Movimentos especiais (HUD) ----------
function moveNotices() {
  const [p] = game.fighters;
  if (!p) return;
  // Notices de movimentos especiais são gerenciados pelo MovesHud
}

// ---------- HUD de propostas ----------
function updateOffscreenArrow(w, h) {
  const arrow = $('offscreen-arrow');
  if (!arrow) return;
  const [p, e] = game.fighters;
  if (!p || !e || game.phase !== 'playing') {arrow.hidden = true;return;}
  const dx = e.position.x - p.position.x;
  const dz = e.position.z - p.position.z;
  const angle = Math.atan2(dx, dz);
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > 8) {
    const cx = w / 2, cy = h / 2;
    const sin = Math.sin(angle), cos = Math.cos(angle);
    const scale = Math.min(w, h) * 0.35;
    const ry = Math.abs(cy / (cos || 1e-5)), rx = Math.abs(cx / (sin || 1e-5));
    const r = Math.min(rx, ry, scale);
    const sx = cx + sin * r, sy = cy - cos * r;
    arrow.style.left = `${sx.toFixed(1)}px`;
    arrow.style.top = `${sy.toFixed(1)}px`;
    const deg = ((-angle) * 180 / Math.PI) + 90;
    arrow.style.transform = `translate(-50%, -50%) rotate(${deg.toFixed(1)}deg)`;
    arrow.hidden = false;
  } else {
    arrow.hidden = true;
  }
}

function updateActionHintPill() {
  const pill = $('action-hint-pill');
  if (!pill) return;
  if (game.phase !== 'playing' && game.phase !== 'finishing') {pill.hidden = true; return;}
  const p = game.fighters[0];
  if (!p) {pill.hidden = true; return;}
  let text = '', kind = 'hint';
  if (p.charge) {
    const pl = p.charge.pl ?? (p.charge.ticks >= (p.charge.params?.pl2Ticks || 90) ? 2 : 1);
    text = `⚡ Segurando ${p.charge.move === 'reflect' ? '[A] Reflect' : '[S] Psyshock'} (PL${pl}) · Solte para disparar ou aperte C para cancelar`;
    kind = 'charge';
  } else if (p.action?.kind === 'tackle' && p.action.elapsed <= (C.rules.tackleCancelWindow || 0.15)) {
    text = '💨 Arrancada de Tackle · Aperte C para CANCELAR em esquiva!';
    kind = 'cancel';
  } else if (p.stamina <= 0 || p.state === 'exhausted') {
    text = '⚠️ EXAUSTO · Stamina zerada! Recue para recuperar';
    kind = 'warn';
  } else if (p.counterWindow > 0) {
    text = `✨ CONTRA-ATAQUE ATIVO (+${p.counterWindow.toFixed(2)}s) · Golpeie agora!`;
    kind = 'counter';
  }
  if (text) {pill.textContent = text; pill.dataset.kind = kind; pill.hidden = false;}
  else {pill.hidden = true;}
}

function resetArenaFighters() {
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

function cycleOpponentAiMode() {
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

function onQuickStart() {
  if ($('quick-profile')) $('profile').value = $('quick-profile').value;
  if ($('quick-enemy-profile')) $('enemy-profile').value = $('quick-enemy-profile').value;
  if ($('quick-ai-mode')) {
    $('mode').value = $('quick-ai-mode').value;
    game.mode = $('mode').value;
    C.extras.gameModes.enemyMode = AI_MODES.findIndex(([id]) => id === game.mode);
  }
  const equipReflect = $('quick-reflect')?.checked;
  const equipPsyshock = $('quick-psyshock')?.checked;
  if (equipReflect || equipPsyshock) {
    const loadout = [
      equipReflect ? 'reflect' : null,
      equipPsyshock ? 'psyshock' : null,
      null,
      null
    ];
    game.setLoadout(0, loadout);
  }
  if ($('quick-zen')?.checked) toggleZenMode(true);
  if ($('quick-autolock')?.checked) input.locked = true;
  startMatch();
}

function updateAudioBtn() {
  const b = $('audio-toggle');
  if (!b) return;
  b.textContent = soundFx.enabled ? '🔊 Som' : '🔇 Mudo';
  b.setAttribute('aria-checked', String(soundFx.enabled));
  b.classList.toggle('active', soundFx.enabled);
}

// ---------- Laço principal ----------

let lastAdvantageHit = null, advantageTimer = null;
function updateDojoAdvantageBadge() {
  const badge = $('dojo-advantage-badge');
  if (!badge) return;
  const latest = recorder.hits.filter(h => h.advantage !== null).at(-1);
  if (latest && latest !== lastAdvantageHit) {
    lastAdvantageHit = latest;
    const adv = latest.advantage;
    const isBlock = ['partial', 'perfect', 'shielded', 'blocked', 'guard'].includes(latest.result);
    const isClash = ['clash', 'tackleClash', 'stoneClash'].includes(latest.result);
    const tag = isBlock ? (latest.result === 'perfect' ? 'PERFECT GUARD' : 'ON BLOCK') : isClash ? 'CLASH' : 'ON HIT';
    const msVal = (Math.abs(adv) * C.test.step * 1000).toFixed(0);
    badge.className = adv > 0 ? 'adv-plus' : adv < 0 ? 'adv-minus' : 'adv-even';
    badge.innerHTML = `<span class="adv-tag">${tag}</span> <b>${adv > 0 ? '+' : ''}${adv}</b> <small>(${msVal}ms)</small> · ${adv > 0 ? 'VANTAGEM' : adv < 0 ? 'DESVANTAGEM' : 'NEUTRO'}`;
    badge.hidden = false;
    clearTimeout(advantageTimer);
    advantageTimer = setTimeout(() => { badge.hidden = true; }, 1800);
  }
}

let last = performance.now(), uiTimer = 0;
function frame(now) {
  const dt = Math.max(0, (now - last) / 1000);last = now;
  const live = !ui.paused && (game.phase === 'playing' || game.phase === 'finishing');
  const tSim = performance.now();let steps = 0;
  if (live) clock.advance(dt, () => {steps++;stepOnce();});else clock.reset();
  const simMs = performance.now() - tSim;
  ui.fps += (1 / Math.max(.001, dt) - ui.fps) * C.extras.hud.fpsSmoothing;
  view.draw(game.fighters, game.events, live ? dt * clock.timeScale : 0, {paused: !live, realDt: dt, tick: game.tick, sources: [C.extras.toggles.enablePlayerAI || ui.scenario ? 'IA' : 'jogador', 'IA'], world: game.world});
  const back = replay.length ? (replay.length - 1 - replay.cursor) : 0;
  hud.render(game, ui.fps, {locked: input.locked, paused: ui.paused && game.phase !== 'menu', replay: back ? `−${back} passos (${(back * C.test.step * 1000).toFixed(0)} ms) · ▶ retoma daqui` : 'último passo · , e . avançam/voltam', playerAI: !!C.extras.toggles.enablePlayerAI});
  movesHud.render(game);moveNotices();
  $('rp-readout').textContent = `passo ${game.tick}${back ? ` · −${(back * C.test.step).toFixed(2)} s` : ''}${clock.timeScale !== 1 ? ` · ${clock.timeScale}×` : ''}`;
  dock.render();updateDojoAdvantageBadge();hudProposals.render(game, live ? dt * clock.timeScale : 0);windowsOverlay.update();perfPanel.frame({frameMs: dt * 1000, simMs, steps});updateOffscreenArrow(canvas.clientWidth, canvas.clientHeight);updateActionHintPill();if (game.phase === 'result' && !lastKoHandled) checkKoTrigger();
  if ((uiTimer += dt) > .1) {uiTimer = 0;renderLive();renderHistory();renderCharacterLive();renderRecStatus();visualPanel.live();diagnostics.live();perfPanel.live();}
  ui.frame++;requestAnimationFrame(frame);
}
applyConfig();renderScenarios();renderCharacters();syncTuneState();openTool('match');syncButtons();
requestAnimationFrame(frame);

// ---------- Workspace persistente: preferências de interface, última partida e opções de animação ----------
function collectUi() {
  const pressed = document.querySelector('[data-dock][aria-pressed="true"]');
  return {tool: $('panel').hidden ? null : $('panel').dataset.tool, dockCollapsed: $('dock').classList.contains('collapsed'), dockView: pressed?.dataset.dock ?? 'timeline', timeScale: $('rp-speed').value,
    overlays: {...view.overlays}, showHistory: $('show-history').checked, charSyncSource: $('char-sync-source').value, previewSlot: $('char-preview-slot').value, tuneMode: presets.mode, abKey: presets.abKey, vfxMode: visualPanel.vfxMode};
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
  if (u.vfxMode) visualPanel.setMode(u.vfxMode);
  if (u.abKey) {presets.setABKey(u.abKey);$('ab-key').value = u.abKey;}
  if (u.previewSlot) $('char-preview-slot').value = u.previewSlot;
  if (typeof u.dockCollapsed === 'boolean' && u.dockCollapsed !== $('dock').classList.contains('collapsed')) $('dock-toggle').click();
  if (u.dockView) document.querySelector(`[data-dock="${u.dockView}"]`)?.click();
  if (u.tool === null) $('panel-close').click();else if (u.tool && TITLES[u.tool] && ($('panel').hidden || $('panel').dataset.tool !== u.tool)) openTool(u.tool);
}
const collectApp = () => ({name: 'arenamon-combate-laboratorio', build: document.title, userAgent: navigator.userAgent});

/** Primeira abertura (workspace novo neste navegador): importa o pacote inicial embutido na compilação (ver inicial/README.md). */
async function applyInitialWorkspace(ws, wsUI) {
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

async function bootWorkspace() {
  const store = await openStore();let ls = null;try {ls = localStorage;} catch {ls = null;}
  const ws = await Workspace.open(store, {ls});wsRef.store = store;
  const wsUI = createWorkspaceUI({ws, store, ui, tuning, $, download, presets: presets.api, homologation, applyDocUi, collectApp, onCharactersChanged: () => {syncCharacterCombatWindows();syncRuleDurations();dock.invalidate();}});
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
  return {ws, store, wsUI, restored};
}
let projectFiles = null;
/** Relatórios já gerados nesta sessão (para gravar nas pastas do projeto). */
function reportsOf() {
  const out = [];
  if (movement.last) out.push({name: 'movimento', kind: 'movement-comparison', data: movement.report()});
  if (diagnostics.log.length) out.push({name: 'diagnostico-comandos', kind: 'command-diagnostics', data: diagnostics.exportData()});
  if (training.trainer?.attempts.length) out.push({name: 'treino', kind: 'perfect-training', data: training.exportData()});
  if (perfPanel.lastBench) out.push({name: 'benchmark', kind: 'performance-benchmark', data: perfPanel.lastBench});
  if (aiEval.last) out.push({name: 'avaliacao-ia', kind: 'ai-evaluation', data: aiEval.last});
  return out;
}

// ---------- Interfaces para testes e compatibilidade com o v6 ----------
window.__arenamon = {snapshot: () => ({...game.snapshot(), frame: ui.frame, camera: view.rig.snapshot(), locked: input.locked, hitboxDebug: !!C.extras.toggles.showHitboxes, playerAI: !!C.extras.toggles.enablePlayerAI})};
window.__arenaLive = {rules: C.rules, test: C.test, locomotion: C.locomotion, camera: C.camera, profiles: C.profiles, extras: C.extras, game, view, input, clock, reset: startMatch, apply: applyConfig};
// window.__lab só aparece depois da restauração do workspace (os testes esperam por ele).
bootWorkspace().catch(e => {console.error('workspace:', e);ui.workspaceError = e.message;return null;}).then(boot => {
  // API dos movimentos especiais (registro vazio): registerMove, listMoves, validateMove; equipar com setLoadout.
  window.__lab = {moves: {...Moves, setLoadout: (id, ids) => game.setLoadout(id, ids), standard: STANDARD_MOVE_IDS, equipStandard: id => game.setLoadout(id, STANDARD_MOVE_IDS)}, C, game, view, hudProposals, presets, movement, playSequence, diagnostics, training, perf: perfPanel, aiEval, projectFiles, reportsOf, visualPanel, recorder, replay, tuning, ui, startMatch, startScenario: id => startScenario(SCENARIOS.find(s => s.id === id)), stepFrames, seekTick, goLive, togglePause, setCharacter, loadStudioFile, SCENARIOS, runScenario, spawn, openTool,
    ws: boot?.ws ?? null, store: boot?.store ?? null, wsUI: boot?.wsUI ?? null, workspaceBoot: boot};
});
