// @ts-check
// Dividido de main.js (comportamento idêntico): scenario-flow.

import {C} from '../sim/config.js';
import {SCENARIOS, prepareScenario, runScenario} from '../sim/scenarios.js';
import {resetCollisionProbe} from '../sim/collision-probe.js';
import {escape, pathGet} from '../ui/tuning.js';
import {emptyCommand} from '../sim/entity.js';
import {length} from '../sim/math.js';
import {$, canvas, game, input, matchRec, tuning, ui} from '../main.js';
import {resetViewAndLogs} from './match-flow.js';
import {syncButtons} from './live-panels.js';
import {last} from './main-loop.js';

// ---------- Gravador de movimento ----------
/** Parâmetros aplicados só durante a reprodução de uma sequência na arena (voltam ao terminar ou ao reiniciar). */
export let playbackRestore = null;

export function restorePlaybackValues() {if (playbackRestore) {tuning.setTransient(playbackRestore);playbackRestore = null;}}

/** Reproduz uma sequência na arena com o mesmo motor: estado inicial, semente e comandos gravados. */
export function playSequence(seq, preset) {
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
export function renderScenarios() {
  const box = $('scenario-list');box.replaceChildren();
  $('scenario-all').textContent = `▶ Executar todos (${SCENARIOS.length})`;
  const add = def => {
    const el = document.createElement('div');el.className = 'scenario';el.dataset.id = def.id;
    const last = ui.lastResult?.id === def.id ? ui.lastResult : null;if (last) el.dataset.result = last.ok ? 'ok' : 'fail';
    el.innerHTML = `<header><strong>${escape(def.name)}</strong><button type="button">▶ Executar</button></header><p>${escape(def.description)}</p>`;
    el.querySelector('button').onclick = () => startScenario(def);box.append(el);
  };
  // Colisões e ambiente (overhaul): grupo próprio no topo, com «Executar os N» e dicas de quais sobreposições ligar em «Visualizar».
  const col = SCENARIOS.filter(d => d.id.startsWith('col-'));
  if (col.length) {
    const head = document.createElement('div');head.className = 'scenario-group';head.id = 'scenario-collisions-group';
    head.innerHTML = `<header><strong>Colisões e ambiente (${col.length})</strong><button type="button" id="scenario-collisions">▶ Executar os ${col.length}</button></header><p class="hint">Contato com paredes, quinas, objetos, plataformas, destrutíveis e projéteis rápidos. Em «Visualizar» ligue <b>Colisores do cenário</b>, <b>Apoio atual</b>, <b>Contatos com o ambiente</b>, <b>Varredura dos projéteis</b> e <b>Sobreposições e vãos</b> para ver o que a física está fazendo; os números ficam em «Dados ao vivo».</p>`;
    box.append(head);
    head.querySelector('button').onclick = () => {
      abortScenario();const results = col.map(def => runScenario(def)), ok = results.filter(r => r.ok).length;
      $('scenario-report').innerHTML = `<p class="${ok === results.length ? 'ok' : 'bad'}"><b>${ok} de ${results.length} cenários de colisão aprovados</b> com os ajustes atuais.</p>` + reportHtml(results);
      resetCollisionProbe();game.phase = 'menu';ui.lastResult = null;renderScenarios();
    };
    col.forEach(add);
  }
  for (const def of SCENARIOS) if (!def.id.startsWith('col-')) add(def);
}

export function startScenario(def) {
  abortScenario();ui.scenario = prepareScenario(def, game);ui.scenario.def = def;ui.paused = false;input.clear();input.locked = true;
  resetViewAndLogs();$('scenario-report').innerHTML = `<p class="warn">Executando “${escape(def.name)}”…</p>`;syncButtons();canvas.focus();
}

export function abortScenario() {if (ui.scenario) {ui.scenario.abort();ui.scenario = null;}}

export function reportHtml(results) {
  return results.map(r => `<p class="${r.ok ? 'ok' : 'bad'}"><b>${r.ok ? '✓' : '✗'} ${escape(r.name)}</b></p><table><tr><th>Verificação</th><th>Esperado</th><th>Obtido</th></tr>${r.checks.map(c => `<tr><td class="${c.ok ? '' : 'bad'}">${c.ok ? '✓' : '✗'} ${escape(c.label)}</td><td>${escape(c.expected)}</td><td>${escape(c.actual)}</td></tr>`).join('')}</table>`).join('');
}

export function finishScenario() {
  const result = ui.scenario.finish();ui.lastResult = result;ui.scenario = null;ui.paused = true;
  $('scenario-report').innerHTML = reportHtml([result]) + '<p class="hint">Use ◂/▸ e a linha do tempo para inspecionar o cenário passo a passo.</p>';renderScenarios();syncButtons();
}

export function renderRecStatus() {
  $('rec-save').disabled = !matchRec.ticks;$('bug-capture').disabled = !matchRec.ticks;
  $('rec-status').textContent = ui.playback && !ui.playback.ended ? `Reproduzindo: passo ${game.tick} de ${ui.playback.commands.length}` : matchRec.ticks ? `${matchRec.ticks} passos gravados (${(matchRec.ticks * C.test.step).toFixed(1)} s)` : 'Nenhuma partida gravada.';
}
