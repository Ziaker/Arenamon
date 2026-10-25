// @ts-check
// Dividido de main.js (comportamento idêntico): wire-recording.

import {C} from '../sim/config.js';
import {SCENARIOS, runScenario} from '../sim/scenarios.js';
import {resetCollisionProbe} from '../sim/collision-probe.js';
import {escape, pathGet} from '../ui/tuning.js';
import {runBalance, balanceRows} from '../sim/balance.js';
import {compareScenarios, compareMatch} from '../sim/compare.js';
import {parseRecording} from '../sim/recording.js';
import {captureBug, parseBugCapture, reproduceBugCapture, encodeBug} from '../sim/bug-capture.js';
import {diffRecording} from '../sim/replay-diff.js';
import {resetViewAndLogs, startMatch, togglePause} from './match-flow.js';
import {abortScenario, renderRecStatus, renderScenarios, reportHtml} from './scenario-flow.js';
import {download, gamePatch, syncCompareOptions} from './tuning-sync.js';
import {$, GAME_CONFIG_TS, game, matchRec, passivesPanel, presets, recorder, replay, tuning, ui} from '../main.js';

export function wireRecording() {
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
}
