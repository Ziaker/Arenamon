// @ts-check
// Dividido de main.js (comportamento idêntico): characters-sync.

import {C} from '../sim/config.js';
import {Character, compareWindows} from '../view/characters.js';
import {resolveAllPhases, phaseReports} from '../sim/phase-contract.js';
import {escape, pathGet} from '../ui/tuning.js';
import * as Moves from '../sim/moves.js';
import {length} from '../sim/math.js';
import {$, game, tuning, ui} from '../main.js';

// ---------- Personagens ----------
// Ganchos do workspace (persistência dos GLBs e das animações importadas), instalados quando o armazenamento abre.
export const charHooks = {};

/** Associa explicitamente à simulação (Game) as janelas de combate validadas dos personagens carregados. */
export function syncCharacterCombatWindows() {
  const G = C.extras.gameFeel;
  for (const id of [0, 1]) {
    const ch = ui.characters[id], raw = ch ? ch.getAllCombatWindows() : null;
    // Game feel 6: 0 = Definição (como sempre) · 1 = Animação aprovada (fases autorizadas e contrato válido) · 2 = Comparar (só a tabela; o combate não muda).
    const view = raw ? resolveAllPhases(raw, C, G, {forceAll: G.phaseMode === 2}) : null;
    phaseReports[id] = view?.reports ?? null;
    game.setCombatWindows(id, raw && G.phaseMode === 1 ? view.windows : raw);
  }
}

/** Sliders da aba Personagens: editam os parâmetros oficiais display.animation.* (desfazer, presets, workspace, exportação). */
export const secs = v => `${v.toFixed(2)} s`;

export const ANIM_SLIDERS = [['char-fade', 'fade', 'char-fade-out', secs], ['char-action-fade', 'actionFade', 'char-action-fade-out', secs], ['char-hold', 'locomotionHold', 'char-hold-out', secs], ['char-speed', 'speed', 'char-speed-out', v => `${v.toFixed(2)}×`]];

export function refreshAnimSliders() {for (const [id, key, out, fmt] of ANIM_SLIDERS) {if (document.activeElement !== $(id)) $(id).value = String(C.display.animation[key]);$(out).textContent = fmt(C.display.animation[key]);}}

/** Personagem cujas animações definem as regras (o escolhido; se não houver, o outro). */
export function ruleSource() {const id = Number($('char-sync-source').value);return ui.characters[id] || ui.characters[1 - id];}

/** Moves do lutador de referência cujo cast pode vir do clipe (sem marcador, sem carga, sem duração composta): [{slot, cast: caminho do slider, name}]. */
export function moveCastTargets(ch) {
  const src = Number($('char-sync-source').value), id = ui.characters[src] === ch ? src : 1 - src, f = game.fighters[id], out = [];
  for (let slot = 0; slot < C.world.slots; slot++) {
    const def = Moves.getMove(f?.loadout?.[slot]);
    if (def?.group && !def.durationKeys && !def.charge && !def.aimMode && typeof C.world[def.group]?.cast === 'number' && tuning.byPath.has(`world.${def.group}.cast`)) out.push({moveId: def.id, slot, cast: `world.${def.group}.cast`, name: def.name ?? def.id});
  }
  return out;
}

/** Durações das ações vindas das animações (duração do clip ÷ velocidade), aplicadas às regras com desfazer. */
export function syncRuleDurations() {
  if (Character.options.syncRules) {
    const ch = ruleSource();
    const changes = ch ? Object.entries(ch.ruleDurations(moveCastTargets(ch))).map(([path, {value}]) => {const m = tuning.byPath.get(path);return [path, Math.max(m.min, Math.min(m.max, value))];}) : [];
    if (changes.length) tuning.commit(changes, 'Durações das animações');
  }
  renderRuleDurations();renderStudioEvents();
}

export function renderRuleDurations() {
  const ch = ruleSource(), box = $('char-durations');
  if (!ch) {box.innerHTML = '<p class="hint">Carregue um personagem para usar as durações das animações.</p>';return;}
  const rows = Object.entries(ch.ruleDurations(moveCastTargets(ch)));
  box.innerHTML = rows.length ? `<table><tr><th>Regra</th><th>Animação</th><th>Clip ÷ velocidade</th><th>No jogo agora</th></tr>${rows.map(([path, {value, from}]) => {const m = tuning.byPath.get(path);return `<tr><td>${escape(m.label)}</td><td>${escape(from)}</td><td>${value.toFixed(3)} s</td><td>${m.fmt(pathGet(C, path))}</td></tr>`;}).join('')}</table>${Character.options.syncRules ? '<p class="ok">Sincronizado: mudar a animação ou a velocidade atualiza as regras (Ctrl+Z desfaz).</p>' : ''}` : '<p class="hint">Nenhuma ação com duração definida tem animação própria (tackle, dodge_forward, blocked, guard_impact, land/recover).</p>';
}

export function renderStudioEvents() {
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
