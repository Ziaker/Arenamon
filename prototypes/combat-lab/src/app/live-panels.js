// @ts-check
// Dividido de main.js (comportamento idêntico): live-panels.

import {C} from '../sim/config.js';
import {styleLabel} from '../sim/tactics.js';
import {collisionRows} from '../view/collision-overlays.js';
import {escape} from '../ui/tuning.js';
import {length, sub, dot} from '../sim/math.js';
import {physicsProbe} from '../sim/physics.js';
import * as T from 'three';
import {$, actionsDrawer, diagnostics, editorHooks, game, homologation, input, movement, movesPanel, perfPanel, presets, recorder, renderCharacters, tuning, ui, view} from '../main.js';
import {renderStudioEvents} from './characters-sync.js';
import {renderGameDiff, syncCompareOptions} from './tuning-sync.js';

export function renderLive() {
  const [a, b] = game.fighters;if (!a) return;const d = length(sub(b.position, a.position)), rel = sub(a.velocity, b.velocity), n = d > 1e-6 ? {x: (b.position.x - a.position.x) / d, z: (b.position.z - a.position.z) / d} : {x: 0, z: 0};
  // Diagnóstico físico por lutador (auditoria externa §64): apoio, altitude, velocidade vertical,
  // gravidade e impulso em efeito, e último contato válido registrado pela física.
  const physLine = f => {
    const fl = f.flight, alt = (fl?.y ?? 0) + (f.vaultHeight ?? 0);
    const parts = [f.state, `|v| ${length(f.velocity).toFixed(2)} m/s`, `apoio ${(f.groundY ?? 0).toFixed(2)} m`];
    if (fl) parts.push(`alt ${alt.toFixed(2)} m`, `vy ${fl.vy >= 0 ? '+' : ''}${fl.vy.toFixed(2)} m/s`, `g ${(fl.gravity ?? C.rules.launchGravity).toFixed(1)} m/s²`, `impulso ${length(fl.horizontal).toFixed(2)} m/s`);
    else if ((f.vaultHeight ?? 0) > 0.01) parts.push(`alt ${alt.toFixed(2)} m`);
    return parts.join(' · ');
  };
  const lastContact = [a, b].map((f, i) => {
    const bits = [];
    if (f.lastLanding) bits.push(`pouso (vertical ${f.lastLanding.vertical.toFixed(1)}, horizontal ${f.lastLanding.horizontal.toFixed(1)} m/s)`);
    if (f.lastCeilingBump) bits.push(`teto (face ${f.lastCeilingBump.face.toFixed(2)} m)`);
    return bits.length ? `${i ? 'Vermelho' : 'Azul'}: ${bits.join(' + ')}` : null;
  }).filter(Boolean).join(' | ') || '—';
  const rows = [['Distância entre centros', `${d.toFixed(2)} m`], ['Espaço entre colisores', `${Math.max(0, d - 2 * C.test.halfExtent).toFixed(2)} m`], ['Velocidade de aproximação', `${dot(rel, n).toFixed(2)} m/s`],
    ['Azul (física)', physLine(a)], ['Vermelho (física)', physLine(b)],
    ['Último contato válido', lastContact],
    ['Subpassos físicos', `${physicsProbe.substeps} subpasso(s) · ${physicsProbe.contacts} contato(s) no último passo · conflitos de espaço: ${physicsProbe.staticConflicts} no passo, ${physicsProbe.staticConflictsTotal} no total`],
    ['Ação', `${a.action ? `${a.action.kind}${a.action.fromCancel ? ' (C→X)' : ''}${a.action.buffered ? ' (buffer)' : ''} ${(a.action.elapsed * 1000).toFixed(0)} ms` : '—'} / ${b.action ? `${b.action.kind}${b.action.fromCancel ? ' (C→X)' : ''}${b.action.buffered ? ' (buffer)' : ''} ${(b.action.elapsed * 1000).toFixed(0)} ms` : '—'}`], ['Estilo da IA (tático)', `${game.playerBrain.t && C.extras.toggles.enablePlayerAI && ui.playerMode === 'tactical' ? styleLabel(game.playerBrain) : '—'} / ${game.mode === 'tactical' ? styleLabel(game.brain) : '—'}`], ['Contra-ataque', `${a.counterWindow.toFixed(2)} s / ${b.counterWindow.toFixed(2)} s`], ['Hitstop', `${(game.hitstop * 1000).toFixed(0)} ms`]];
  rows.push(...collisionRows(game));   // Fase 7: apoio, último contato com o ambiente, vãos entre objetos e penetrações
  $('live-data').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${escape(v)}</dd>`).join('');
}

export function renderHistory() {$('input-history').innerHTML = input.history.map(h => `<li><b>${escape(h.label)}</b><span>${h.frames}</span></li>`).join('');$('pad-status').textContent = input.padName ? `Gamepad: ${input.padName}` : 'Nenhum gamepad conectado. Pressione um botão do controle para ativá-lo.';}

// ---------- Barra superior, painéis e doca ----------
export function syncButtons() {
  const hb = $('arena-hitboxes-toggle'), on = !!C.extras.toggles.showHitboxes;hb.setAttribute('aria-checked', String(on));
  $('arena-toast-toggle').setAttribute('aria-checked', String(!!C.display.diagnostics.toast));const eb = $('arena-enemy-ai-toggle');eb.setAttribute('aria-checked', String(!!C.extras.toggles.enableEnemyAI));
  const ab = $('arena-autoplay-toggle'), ai = !!C.extras.toggles.enablePlayerAI;ab.setAttribute('aria-checked', String(ai));$('name0').textContent = ai ? 'JOGADOR IA · AZUL' : 'JOGADOR · AZUL';
  $('pause').textContent = ui.paused ? '▶ Continuar' : '❚❚ Pausar';$('rp-play').textContent = ui.paused ? '▶' : '❚❚';
  const zb = $('arena-zen-toggle');
  if (zb) {
    const isZen = document.querySelector('.lab')?.classList.contains('zen-mode') ?? false;
    zb.setAttribute('aria-checked', String(isZen));
    zb.classList.toggle('active', isZen);
  }
}

export function syncDockButtons() {const open = !$('dock').classList.contains('collapsed');if ($('dock-reopen')) $('dock-reopen').hidden = open || $('dock').closest('.zen-mode') !== null;$('dock-toggle').classList.toggle('active', open);const c = $('dock-collapse');if (c) {c.textContent = open ? '▾' : '▴';c.setAttribute('aria-expanded', String(open));c.title = open ? 'Fechar a linha do tempo' : 'Abrir a linha do tempo';}}

// Redimensionar arrastando: largura do painel lateral e altura da linha do tempo (valores guardados no navegador)
export function dragResize(handle, start, move, done, reset) {
  handle.addEventListener('pointerdown', e => {
    e.preventDefault();handle.setPointerCapture(e.pointerId);const s = start(e);handle.classList.add('dragging');
    const mv = ev => move(s, ev), up = () => {handle.removeEventListener('pointermove', mv);handle.removeEventListener('pointerup', up);handle.classList.remove('dragging');done();};
    handle.addEventListener('pointermove', mv);handle.addEventListener('pointerup', up);
  });
  handle.addEventListener('dblclick', reset);
}

export const store = (k, v) => {try {v == null ? localStorage.removeItem(k) : localStorage.setItem(k, String(v));} catch {}};

export const stored = k => {try {return Number(localStorage.getItem(k)) || 0;} catch {return 0;}};

export const TITLES = {match: 'Partida', moves: 'Moves (vitrine e editor)', scenarios: 'Cenários', tuning: 'Ajustes', overlays: 'Visualizar', characters: 'Personagens', controls: 'Controles', export: 'Exportar', homolog: 'Homologação'};

export function setSubCardFilter(tool, sub) {
  const panel = $('panel'), sec = document.querySelector(`.panel-body section[data-section="${tool}"]`);
  panel.dataset.subcard = sub;
  if (sec) for (const c of sec.querySelectorAll(':scope > .bento-card[data-subcard], :scope > #moves-panel > .bento-card[data-subcard]')) c.classList.toggle('subcard-hidden', sub !== 'all' && c.dataset.subcard !== sub);
  const bar = $('panel-subtabs');
  if (bar) for (const b of bar.querySelectorAll('[data-subtab]')) b.setAttribute('aria-pressed', String(b.dataset.subtab === sub));
}

export function renderSubTabs(tool) {
  const bar = $('panel-subtabs'), sec = document.querySelector(`.panel-body section[data-section="${tool}"]`);
  if (!bar) return;
  const cards = sec ? [...sec.querySelectorAll(':scope > .bento-card[data-subcard], :scope > #moves-panel > .bento-card[data-subcard]')] : [];
  if (tool === 'match' || cards.length <= 1) {bar.hidden = true;bar.replaceChildren();$('panel').dataset.subcard = 'all';return;}
  bar.hidden = false;
  const makeBtn = (id, label) => {
    const b = document.createElement('button');b.type = 'button';b.dataset.subtab = id;b.textContent = label;
    b.setAttribute('aria-pressed', String(id === 'all'));
    b.onclick = () => setSubCardFilter(tool, $('panel').dataset.subcard === id && id !== 'all' ? 'all' : id);
    return b;
  };
  bar.replaceChildren(makeBtn('all', '⊞ Tudo'), ...cards.map(c => makeBtn(c.dataset.subcard, c.dataset.sublabel || c.dataset.subcard)));
  setSubCardFilter(tool, 'all');
}

/** Moves: gaveta própria no canto da arena (fora da barra esquerda). */
export function toggleMoves(open = $('moves-drawer').hidden) {
  if (open) {toggleChars(false);editorHooks.close?.();}   // Ações, Personagens e Editor ocupam o mesmo lugar: abrir um fecha os outros
  $('moves-drawer').hidden = !open;$('moves-open').setAttribute('aria-expanded', String(open));$('moves-open').classList.toggle('active', open);
  if (open) actionsDrawer.render();
}

/** Personagens: gaveta larga própria (modelos, biblioteca de clipes e a animação de cada estado). */
export function toggleChars(open = $('chars-drawer').hidden) {
  if (open) {toggleMoves(false);editorHooks.close?.();}
  $('chars-drawer').hidden = !open;$('chars-open').setAttribute('aria-expanded', String(open));$('chars-open').classList.toggle('active', open);
  if (open) {renderCharacters();renderStudioEvents();}
}

export function openTool(tool) {
  if (tool === 'characters') {toggleChars(true);return;}   // abre a gaveta (o botão da barra é só compatibilidade e fica oculto)
  const same = !$('panel').hidden && $('panel').dataset.tool === tool;$('panel').hidden = same;$('panel').dataset.tool = tool;
  for (const b of document.querySelectorAll('[data-tool]')) b.classList.toggle('active', !same && b.dataset.tool === tool);
  for (const s of document.querySelectorAll('[data-section]')) s.hidden = s.dataset.section !== tool;$('panel-title').textContent = TITLES[tool];
  if (tool === 'homolog') homologation.render();
  if (tool === 'moves') {movesPanel.render();editorHooks.refresh?.();}
  if (tool === 'scenarios') {syncCompareOptions();movement.render();}
  if (tool === 'tuning') presets.render();
  if (tool === 'export') renderGameDiff();if (tool === 'tuning') tuning.render();if (tool === 'overlays') {diagnostics.live();perfPanel.live();}
  renderSubTabs(tool);
}

/** Grupos estáticos com mais de dois controles ganham botão ▼ (recolher/expandir). */
export function foldStaticSections() {
  for (const section of document.querySelectorAll('.panel-body section[data-section]')) {
    for (const h of section.querySelectorAll(':scope > h3, :scope > .bento-card > h3')) {
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

export const _projPos = new T.Vector3();

export function updateOffscreenArrow(w, h) {
  const arrow = $('offscreen-arrow');
  if (!arrow) return;
  if (game.phase !== 'playing' && game.phase !== 'finishing') {arrow.hidden = true; return;}
  const red = game.fighters[1];
  if (!red || !view?.camera) {arrow.hidden = true; return;}
  _projPos.set(red.position.x, 0.75, red.position.z);
  _projPos.project(view.camera);
  const isBehind = _projPos.z > 1.0, isOffX = _projPos.x < -0.92 || _projPos.x > 0.92, isOffY = _projPos.y < -0.92 || _projPos.y > 0.92;
  if (isBehind || isOffX || isOffY) {
    let nx = _projPos.x, ny = _projPos.y;
    if (isBehind) {nx = -nx; ny = -ny;}
    const angle = Math.atan2(ny, nx), borderMargin = 36, cx = w / 2, cy = h / 2, rx = cx - borderMargin, ry = cy - borderMargin;
    const cos = Math.cos(angle), sin = Math.sin(angle), scale = Math.min(Math.abs(rx / (cos || 1e-5)), Math.abs(ry / (sin || 1e-5)));
    const sx = cx + cos * scale, sy = cy - sin * scale;
    arrow.style.left = `${sx.toFixed(1)}px`;
    arrow.style.top = `${sy.toFixed(1)}px`;
    const deg = ((-angle) * 180 / Math.PI) + 90;
    arrow.style.transform = `translate(-50%, -50%) rotate(${deg.toFixed(1)}deg)`;
    arrow.hidden = false;
  } else {
    arrow.hidden = true;
  }
}

export function updateActionHintPill() {
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

// ---------- Laço principal ----------

export let lastAdvantageHit = null, advantageTimer = null;

export function updateDojoAdvantageBadge() {
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
