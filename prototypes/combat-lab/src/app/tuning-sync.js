// @ts-check
// Dividido de main.js (comportamento idêntico): tuning-sync.

import {C} from '../sim/config.js';
import {AI_MODES} from '../sim/ai.js';
import {escape, pathGet} from '../ui/tuning.js';
import {patchConfigTs, unifiedDiff, collectChanges} from '../ui/gamepatch.js';
import {OFFICIAL_MAP} from '../ui/actions-meta.js';
import {length} from '../sim/math.js';
import {$, GAME_CONFIG_TS, game, hud, presets, tuning, ui, view, wsRef} from '../main.js';
import {syncButtons} from './live-panels.js';

/** Caminho equivalente no config.ts do jogo (ou null para parâmetros só do laboratório). */
export const gamePathOf = m => typeof m.official !== 'number' ? null : OFFICIAL_MAP[m.path] ?? (m.path.startsWith('extras.') ? null : m.path);

export function gamePatch(includeDefaults) {
  const all = tuning.manifest.map(m => ({path: m.path, label: m.label, gamePath: gamePathOf(m), value: pathGet(C, m.path), official: m.official, initial: m.initial})).filter(e => e.gamePath && typeof e.value === 'number');
  const picked = new Set(all.filter(e => includeDefaults ? Math.abs(e.value - e.official) > 1e-12 : Math.abs(e.value - e.initial) > 1e-12).map(e => e.gamePath));
  const {changes, conflicts} = collectChanges(all.filter(e => picked.has(e.gamePath)));
  const result = patchConfigTs(GAME_CONFIG_TS, changes);
  return {...result, conflicts, diff: unifiedDiff(GAME_CONFIG_TS, result.text)};
}

export function syncCompareOptions() {
  presets.render();for (const id of ['comp-a', 'comp-b']) {const sel = $(id), prev = sel.value;sel.innerHTML = $('preset-a').innerHTML;sel.value = [...sel.options].some(o => o.value === prev) ? prev : id === 'comp-a' ? '__current' : '__lab';}
}

// ---------- Ajustes ----------
export function applyConfig() {
  view.applyConfig();const root = document.documentElement.style, X = C.extras;
  view.abilityBanners?.applyConfig();
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

export function syncTuneState() {
  const dirty = tuning.dirty(), chip = $('tune-state'), isDefault = tuning.manifest.every(m => !tuning.changed(m));
  chip.dataset.state = dirty ? 'dirty' : isDefault ? 'clean' : 'saved';
  chip.querySelector('span').textContent = dirty ? 'Ajustes não exportados' : isDefault ? 'Ajustes padrão' : 'Ajustes salvos';
  chip.title = dirty ? 'Ajustes alterados desde o último preset salvo ou JSON exportado' : isDefault ? 'Todos os ajustes estão nos padrões do laboratório' : `Ajustes salvos (${tuning.savedLabel})`;
  const values = tuning.snapshotValues();
  // Cópia no formato v7 (compatibilidade): só depois de o workspace ler a sessão anterior, para não sobrescrevê-la ao abrir.
  if (wsRef.ws) try {localStorage.setItem('arenamon-lab-session-v7', JSON.stringify(values));} catch {}
  wsRef.ws?.set('tuning', {values, at: new Date().toISOString()});wsRef.ui?.renderCalibrations();
  renderGameDiff();
}

/** Ajustes da sessão anterior: restaurados automaticamente (com desfazer) ou oferecidos num aviso, conforme a preferência. */
export function sessionBanner(prevValues, {auto}) {
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

// ---------- Exportar ----------
export function download(data, name, type = 'application/json') {const url = URL.createObjectURL(new Blob([data], {type})), a = document.createElement('a');a.href = url;a.download = name;a.click();setTimeout(() => URL.revokeObjectURL(url), 4000);}

export function renderGameDiff() {
  const rows = tuning.manifest.filter(m => tuning.status(m) === 'experimental');
  $('game-diff').innerHTML = rows.length ? `<table><tr><th>Parâmetro</th><th>Jogo (config.ts)</th><th>Laboratório</th></tr>${rows.map(m => `<tr><td title="${m.path}">${escape(m.label)}<br><code>${m.path}</code></td><td>${m.fmt(m.official)}</td><td class="warn">${m.fmt(pathGet(C, m.path))}</td></tr>`).join('')}</table><p class="hint">${tuning.manifest.filter(m => m.official === undefined).length} parâmetros existem só no laboratório (lançamento, clash, salto, IA estendida, câmera e visual) e não têm equivalente no jogo.</p>` : '<p class="ok">Todos os parâmetros em comum são iguais aos do jogo.</p>';
}
