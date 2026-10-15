// Visualizar › Diagnóstico de comandos (histórico detalhado + exportação) e o aviso curto na arena. As entradas vêm do
// relato do controlador (sim/attempts.js); aqui só se filtra (lutadores da partida ao vivo) e se apresenta.
import * as T from 'three';
import {C} from '../sim/config.js';
import {setAttemptSink, describe, condition} from '../sim/attempts.js';
import {isInvulnerable, invulnerableWindow, actionSpec} from '../sim/entity.js';
import {cancelWindow} from '../sim/controller.js';
import {getMove} from '../sim/moves.js';
import {escape} from './tuning.js';

const KIND = {tackle: 'X', dodge: 'C', guard: 'D', perfectGuard: 'D perfeita', sprint: 'Sprint', skill: 'Movimento'};
const RES = {denied: 'negado', buffered: 'buffer', expired: 'expirou', executed: 'executado'};

export function createDiagnostics({$, game, tuning, download}) {
  const log = [];let lastToast = {text: '', at: 0}, toastTimer = null;
  setAttemptSink((f, e) => {
    if (!game.fighters.includes(f)) return; // reexecuções sem renderização (cenários, A × B, equilíbrio) não entram aqui
    const entry = {...e, tick: game.tick, t: +(game.tick * C.test.step).toFixed(3), text: describe(e)};
    if (e.result === 'executed' && !C.display.diagnostics.logExecuted) {log.executedCount = (log.executedCount ?? 0) + 1;return;}
    log.push(entry);if (log.length > 500) log.shift();
    const mode = C.display.diagnostics.toast | 0;
    if (e.result !== 'executed' && mode && (mode === 2 || f.id === 0)) toast(entry);
  });
  function toast(e) {
    const el = $('deny-toast'), now = performance.now(), text = (e.fighter ? 'Vermelho · ' : '') + e.text;el.dataset.kind = e.kind === 'ok' || e.kind === 'train' ? e.kind : 'deny';
    if (text === lastToast.text && now - lastToast.at < 350) return;lastToast = {text, at: now};
    el.textContent = text;el.dataset.fighter = e.fighter;el.hidden = false;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');
    clearTimeout(toastTimer);toastTimer = setTimeout(() => {el.hidden = true;}, C.display.diagnostics.toastMs);
  }
  function render() {
    const box = $('diag-panel');if (!box) return;
    box.innerHTML = `<div id="diag-controls"></div><div class="row"><label class="field">Mostrar<select id="diag-filter"><option value="problems">Negados, buffer e expirados</option><option value="all">Todos</option></select></label><label class="field">Lutador<select id="diag-who"><option value="both">Ambos</option><option value="0">Azul</option><option value="1">Vermelho</option></select></label></div>
      <div class="row"><button type="button" id="diag-export">↓ Exportar (JSON)</button><button type="button" id="diag-clear">Limpar</button><span class="muted" id="diag-count"></span></div><div id="diag-log" class="report"></div>`;
    $('diag-controls').append(...tuning.sectionControls('Diagnóstico de comandos'));
    $('diag-clear').onclick = () => {log.length = 0;live();};
    $('diag-export').onclick = () => download(JSON.stringify(exportData(), null, 1), 'arenamon-diagnostico-comandos.json');
    for (const id of ['diag-filter', 'diag-who']) $(id).onchange = live;
  }
  const visible = () => {const f = $('diag-filter')?.value ?? 'problems', w = $('diag-who')?.value ?? 'both';return log.filter(e => (f === 'all' || e.result !== 'executed') && (w === 'both' || String(e.fighter) === w));};
  function live() {
    const box = $('diag-log');if (!box || box.closest('[hidden]')) return;
    const rows = visible().slice(-40).reverse();
    $('diag-count').textContent = `${log.length} registro(s)`;
    box.innerHTML = rows.length ? `<table><tr><th>t</th><th></th><th>Comando</th><th>Motivo</th><th>Estado</th><th>Atual / exigido</th></tr>${rows.map(e => {const c = condition(e);return `<tr class="${e.result === 'executed' ? '' : 'warn'}"><td>${e.t.toFixed(2)}</td><td>${e.fighter ? 'V' : 'A'}</td><td>${KIND[e.kind] ?? e.kind}${e.viaCancel ? ' (C→X)' : ''} · ${RES[e.result] ?? e.result}</td><td>${escape(e.text)}</td><td>${escape(e.action ? `${e.action} ${Math.round(e.actionElapsed * 1000)} ms` : e.state)}</td><td>${c ? escape(fmtCond(c)) : '—'}</td></tr>`;}).join('')}</table>` : '<p class="hint">Nenhum comando negado ainda. Jogue: cada X, C ou D recusado aparece aqui com o motivo avaliado pelo motor.</p>';
  }
  const fmtCond = c => Array.isArray(c.required) ? `${(c.current * 1000).toFixed(0)} ms (janela ${(c.required[0] * 1000).toFixed(0)}–${(c.required[1] * 1000).toFixed(0)} ms)` : c.unit === 's' ? `${(c.current * 1000).toFixed(0)} ms restantes` : `${c.current.toFixed(2)} / ${c.required.toFixed(2)}`;
  const exportData = () => ({schema: 'arenamon-lab-report', version: 1, kind: 'command-diagnostics', createdAt: new Date().toISOString(), step: C.test.step, entries: log.map(({tick, t, fighter, kind, result, reason, detail, text, state, action, actionElapsed, stamina, viaCancel, fromBuffer}) => ({tick, t, fighter, kind, result, reason, detail, text, state, action, actionElapsed, stamina, viaCancel, fromBuffer}))});
  render();
  return {log, render, live, exportData, toast};
}

// ---------- Indicadores das janelas de combate ----------
const WINDOW_DEFS = [
  ['invulnerable', 'Invulnerável', '#59d6e6', f => isInvulnerable(f) ? [invulnerableWindow(f.action) - f.action.elapsed, invulnerableWindow(f.action)] : null],
  ['cancel', 'C → X', '#5dff9a', f => {
    if (f.action?.kind !== 'dodge' || !C.actions.cancel.dodgeToTackle) return null;const [w0, w1] = cancelWindow(), t = f.action.elapsed, perfect = C.actions.cancel.perfectAnytime && f.counterWindow > 0;
    if (perfect) return [f.counterWindow, Math.max(f.counterWindow, .01), 'aberta (esquiva perfeita)'];
    return t < w0 ? [w0 - t, w0, 'abre em', true] : t <= w1 ? [w1 - t, Math.max(1e-3, w1 - w0)] : null;
  }],
  ['chain', 'Encadear', '#ffcf7d', f => {if (!f.action || f.action.kind === 'recoil') return null;const ca = actionSpec(f.action).chainAfter;return f.action.elapsed < ca ? [ca - f.action.elapsed, ca, 'bloqueado', true] : null;}],
  ['recovery', 'Recuperação', '#9db4ff', (f, s) => f.knockRecovery > 0 ? [f.knockRecovery, s.maxRecovery = Math.max(s.maxRecovery && s.recovering ? s.maxRecovery : 0, f.knockRecovery)] : null],
  ['guardStun', 'Guard stun', '#ffb347', f => f.stun > 1e-8 ? [f.stun, C.rules.guardStun] : null],
  ['recoil', 'Recuo', '#c77dff', f => f.action?.kind === 'recoil' ? [Math.max(0, C.rules.recoil - f.action.elapsed), C.rules.recoil] : null],
  ['perfect', 'Defesa perfeita', '#9dffd2', f => f.perfectLeft > 1e-8 ? [f.perfectLeft, C.rules.perfect] : null],
  ['perfectCooldown', 'Recarga D perfeita', '#8a94a6', f => f.perfectCooldown > 1e-8 ? [f.perfectCooldown, C.rules.perfectCooldown] : null],
  ['counter', 'Contra-ataque', '#ffd34d', (f, s) => f.counterWindow > 0 ? [f.counterWindow, s.maxCounter = Math.max(s.counter ? s.maxCounter : 0, f.counterWindow)] : null],
  ['buffer', 'Buffer', '#fff27a', f => f.inputBuffer && C.actions.buffer.window > 0 ? [Math.max(0, C.actions.buffer.window - f.inputBuffer.age), C.actions.buffer.window, f.inputBuffer.kind === 'tackle' ? 'X guardado' : 'C guardado'] : null],
];
export const WINDOW_KEYS = WINDOW_DEFS.map(d => d[0]);
/** Janelas ativas de um lutador, com tempo restante e total (só leitura do estado da simulação). */
export function activeWindows(f, game, memo = {}) {
  const W = C.display.windows, out = [];
  for (const [key, label, color, fn] of WINDOW_DEFS) {
    if (!W[key]) continue;const r = fn(f, memo);
    if (key === 'recovery') memo.recovering = !!r;if (key === 'counter') memo.counter = !!r;
    if (r) out.push({key, label: r[2] ?? label, name: label, color, left: r[0], total: r[1], waiting: !!r[3]});
  }
  // Buffs/debuffs (tempo restante de cada status) e recargas dos movimentos especiais.
  if (W.statuses) for (const s of f.statuses || []) out.push({key: 'status', label: `${s.id}${s.stacks > 1 ? ` ×${s.stacks}` : ''}`, name: s.id, color: s.tags?.includes('debuff') ? '#ff7a7a' : '#9fe58a', left: s.remaining, total: s.duration});
  if (W.cooldowns) for (const [id, left] of Object.entries(f.moveCooldowns || {})) out.push({key: 'cooldown', label: `↻ ${id}`, name: id, color: '#8a94a6', left, total: Math.max(left, getMove(id)?.cooldown ?? left), waiting: true});
  if (W.hitstop && game.hitstop > 0) out.push({key: 'hitstop', label: 'Hitstop', name: 'Hitstop', color: '#ffffff', left: game.hitstop, total: Math.max(game.hitstop, C.extras.combat.clashHitstop)});
  return out;
}
export function createWindowsOverlay({root, view, game}) {
  const memo = [{}, {}], boxes = [0, 1].map(i => {const d = document.createElement('div');d.className = 'win-stack';d.dataset.fighter = i;root.append(d);return d;});
  const v = new T.Vector3();
  function update() {
    const W = C.display.windows, mode = W.mode | 0, canvas = view.canvas;
    for (const [i, f] of game.fighters.entries()) {
      const box = boxes[i];if (!box) continue;
      const show = mode === 2 || (mode === 1 && i === 0);
      const list = show && f.hp > 0 ? activeWindows(f, game, memo[i]) : [];
      if (!list.length) {box.hidden = true;continue;}
      const alt = (f.flight?.y ?? 0) + (f.vaultHeight ?? 0);v.set(f.position.x, alt + C.extras.visual.bodyHeight + .55, f.position.z).project(view.camera);
      if (v.z > 1) {box.hidden = true;continue;}
      box.hidden = false;box.style.left = `${(v.x * .5 + .5) * canvas.clientWidth}px`;box.style.top = `${(-v.y * .5 + .5) * canvas.clientHeight}px`;
      box.style.setProperty('--win-scale', W.scale);box.style.opacity = W.opacity;
      box.innerHTML = list.map(w => `<div class="win-row${w.waiting ? ' waiting' : ''}" data-win="${w.key}"><span>${w.label}</span><i style="--c:${w.color};--p:${Math.max(0, Math.min(1, w.left / Math.max(1e-6, w.total)))}"></i><b>${Math.round(w.left * 1000)}</b></div>`).join('');
    }
  }
  return {update};
}
