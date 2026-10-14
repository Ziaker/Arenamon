// Layout v7: barra de ferramentas à esquerda, um painel por ferramenta (somente a ativa é exibida),
// visualizador ao centro, biblioteca à direita e timeline embaixo.
// Os controles da v6 são MOVIDOS (mesmos ids e handlers) para a seção da ferramenta correspondente:
// cada função passa a existir em um único lugar. O antigo painel “Seu projeto”, a gaveta “Ajustes” e o
// diálogo de exportação deixam de existir como superfícies separadas.
const $ = id => document.getElementById(id);
const q = (sel, root = document) => root.querySelector(sel);
const field = id => $(id)?.closest('label') || $(id);
const box = id => $(id)?.closest('.lab-inline') || field(id);
const TITLES = {project: 'Projeto', rigging: 'Rigging', appearance: 'Aparência', scene: 'Cenário', camera: 'Câmera', motion: 'Movimento', inspect: 'Inspeção', export: 'Exportar'};
const NEEDS_MODEL = new Set(['rigging', 'scene', 'camera', 'motion', 'inspect', 'export']);
const store = {
  get: (k, d) => {try {return sessionStorage.getItem(k) ?? d;} catch {return d;}},
  set: (k, v) => {try {sessionStorage.setItem(k, v);} catch {}},
  getL: (k, d) => {try {return localStorage.getItem(k) ?? d;} catch {return d;}},
  setL: (k, v) => {try {localStorage.setItem(k, v);} catch {}},
};

// ---------- Montagem ----------
document.body.classList.add('st7');
const workspace = q('.workspace'), stage = q('.stage'), header = q('.topbar');
const shell = $('st-rail');
workspace.prepend($('st-left-grip'));workspace.prepend($('st-panel'));workspace.prepend(shell);
q('.brand', header).after($('st-topinfo'));
$('st-topinfo').prepend(q('.project-badge'));
q('.header-actions').append($('st-top-actions'));
const slot = name => q(`[data-slot="${name}"]`);
const put = (name, ...nodes) => {for (const n of nodes) if (n) slot(name).append(n);};

// Projeto
put('import', q('.project-card'));put('import-json', $('import-json-btn'), $('import-json-input'));
$('import-json-btn').textContent = '↥ Importar organização (JSON)';$('import-json-btn').title = 'Aplica categorias, ações e nomes de um JSON exportado antes';
put('guide', q('.sidebar-guide'));put('foot', q('.sidebar-foot'));
// Aparência
put('toggles', field('textures'), field('lighting'));
put('paint', q('.v6-selected-paint'));
put('background', field('v4-background-on'), field('v4-background'));
// Cenário
put('grid', field('lab-grid'), field('lab-floor'), field('lab-axes'), q('.lab-btns'));
put('grid-advanced', box('lab-grid-size'), box('lab-grid-x'), box('lab-grid-yaw'), $('lab-grid-help'));
put('dummy', field('lab-dummy'), box('lab-dummy-x'));
// Câmera
const presetNote = $('lab-preset')?.nextElementSibling;
put('camera-mode', field('lab-camera'), $('lab-preset'), presetNote);
put('camera-advanced', box('lab-cam-distance'), box('lab-cam-shoulder'));
put('lens', field('v4-fov'), field('v4-orbit'), field('v4-orbit-speed'));
put('camera-slots', $('v4-camera-slots')?.previousElementSibling, $('v4-camera-slots'));
// Movimento
const rootNote = field('lab-root-mode')?.nextElementSibling;
put('root-preview', field('lab-root-mode'), rootNote);
put('trajectory', field('lab-trajectory'), $('lab-trajectory-metrics'));
for (const row of document.querySelectorAll('.playback-more .v4-transport-row')) put('playback', row);
// Inspeção
put('overlays', field('v4-skeleton'), field('v4-wireframe'), field('v4-bounds'));
put('mesh', field('v4-mesh'));
put('feet', field('lab-feet'), $('lab-foot-status'));
put('metadata', $('v4-metadata'));
// Exportar
const exportPanel = q('#export-moved-content .panel');
q('h3', exportPanel)?.remove();q('.panel-sub', exportPanel)?.remove();
put('export', ...exportPanel.children);
$('export').textContent = '↓ Exportar GLB final';$('export-json').textContent = '↓ Exportar JSON de ações';
// Superfícies antigas que ficaram vazias: ocultas (os módulos legados ainda as referenciam por id).
for (const el of [q('aside.rail'), $('studio-tools'), $('settings-backdrop'), $('studio-export'), $('export-backdrop'), q('.workflow'), $('open-tools'), $('open-export'), q('.playback-more')]) el?.setAttribute('hidden', '');
// Biblioteca: botão de recolher no cabeçalho.
const libClose = document.createElement('button');libClose.type = 'button';libClose.className = 'st-icon-btn';libClose.id = 'st-library-close';
libClose.title = 'Recolher a biblioteca de animações';libClose.setAttribute('aria-label', 'Recolher biblioteca');libClose.textContent = '⟩';
q('.v6-organizer-header').append(libClose);
// Ajuda atualizada para o novo layout.
const help = q('#help-modal .modal-card p span');
if (help) help.innerHTML = '<b>1.</b> Em <b>Projeto</b>, importe o personagem. <b>Rigging</b> cria/edita ossos e verifica pesos. Depois importe as animações em Projeto.<br><b>2.</b> Escolha a animação na barra da timeline e use ▶.<br><b>3.</b> Arraste clipes da biblioteca (direita) para as ações.<br><b>4.</b> Em <b>Editar</b> (timeline), recorte, ajuste o tempo e marque eventos.<br><b>5.</b> <b>Salvar</b> guarda o projeto; <b>Exportar</b> gera o GLB final.<br><br>Os ícones à esquerda abrem uma ferramenta por vez. Clique de novo no ícone ativo (ou em ⟨) para recolher o painel.';

// ---------- Estado dos painéis ----------
const ui = {
  panel: store.get('st-panel', 'project'),
  left: store.get('st-left-open', null),
  right: store.get('st-right-open', null),
  leftW: Number(store.getL('st-left-width', 320)) || 320,
};
const mode = () => innerWidth <= 700 ? 'phone' : innerWidth <= 1100 ? 'tablet' : 'desktop';
// Em telas menores os painéis são sobrepostos: começam fechados para não cobrir o personagem.
if (ui.left === null) ui.left = mode() === 'desktop' ? '1' : '0';
if (ui.right === null) ui.right = mode() === 'desktop' ? '1' : '0';
function needsModel() {return NEEDS_MODEL.has(ui.panel) && !window.__importer?.model;}
function render() {
  const leftOpen = ui.left === '1', rightOpen = ui.right === '1';
  document.body.classList.toggle('st-left-closed', !leftOpen);document.body.classList.toggle('st-right-closed', !rightOpen);
  document.body.dataset.stMode = mode();
  for (const b of shell.querySelectorAll('[data-panel]')) {const on = leftOpen && b.dataset.panel === ui.panel;b.setAttribute('aria-selected', String(on));b.classList.toggle('active', on);}
  for (const s of document.querySelectorAll('[data-section]')) s.hidden = s.dataset.section !== ui.panel || needsModel();
  $('st-needs-model').hidden = !needsModel();
  $('st-panel-title').textContent = TITLES[ui.panel] || '';
  $('st-toggle-library').setAttribute('aria-pressed', String(rightOpen));$('st-toggle-library').classList.toggle('active', rightOpen);
  document.documentElement.style.setProperty('--st-left', ui.leftW + 'px');
  $('st-left-grip').setAttribute('aria-valuenow', String(ui.leftW));
  store.set('st-panel', ui.panel);store.set('st-left-open', ui.left);store.set('st-right-open', ui.right);store.setL('st-left-width', String(ui.leftW));
}
function open(panel) {
  if (panel) ui.panel = panel;ui.left = '1';
  if (mode() !== 'desktop') ui.right = '0'; // sobreposições: uma de cada vez
  render();
}
function close() {ui.left = '0';render();}
function toggle(panel) {if (ui.left === '1' && ui.panel === panel) close();else open(panel);}
function setLibrary(on) {ui.right = on ? '1' : '0';if (on && mode() !== 'desktop') ui.left = '0';render();}
for (const b of shell.querySelectorAll('[data-panel]')) b.onclick = () => toggle(b.dataset.panel);
$('st-panel-close').onclick = close;
$('st-toggle-library').onclick = () => setLibrary(ui.right !== '1');
libClose.onclick = () => setLibrary(false);
for (const b of document.querySelectorAll('[data-goto]')) b.onclick = () => open(b.dataset.goto);
$('st-top-export').onclick = () => open('export');
$('st-open-root-tool').onclick = () => {window.__studioEditor?.setCollapsed?.(false);window.__studioEditor?.openTool?.('root', {keep: true});};
$('st-toggle-timeline').onclick = () => window.__studioEditor?.setCollapsed?.(!window.__studioEditor.collapsed);
// Modo foco (botão “Foco” da v4): recolhe as duas laterais; clicar de novo restaura o estado anterior.
let beforeFocus = null;
// Executado depois dos módulos legados (a V4 também atribui onclick a este botão).
queueMicrotask(() => $('v4-focus').onclick = () => {
  if (beforeFocus) {Object.assign(ui, beforeFocus);beforeFocus = null;} else {beforeFocus = {left: ui.left, right: ui.right};ui.left = '0';ui.right = '0';}
  $('v4-focus').setAttribute('aria-pressed', String(!!beforeFocus));$('v4-focus').textContent = beforeFocus ? '⤢ Sair do foco' : '⛶ Foco';render();
});
// Fechar sobreposições com Esc (tablet/celular) ou clicando no visualizador.
window.addEventListener('keydown', e => {if (e.key === 'Escape' && mode() !== 'desktop' && $('st-confirm').hidden) {if (ui.left === '1') close();else if (ui.right === '1') setLibrary(false);}});
q('#view').addEventListener('pointerdown', () => {if (window.__studioRig?.active) return;if (mode() !== 'desktop' && (ui.left === '1' || ui.right === '1')) {ui.left = '0';ui.right = '0';render();}});

// ---------- Redimensionar o painel esquerdo ----------
{
  const grip = $('st-left-grip');let drag = null;
  const clampW = w => Math.round(Math.max(240, Math.min(560, w, innerWidth * .45)));
  grip.addEventListener('pointerdown', e => {e.preventDefault();drag = {x: e.clientX, w: ui.leftW};grip.setPointerCapture(e.pointerId);document.body.classList.add('st-resizing');});
  grip.addEventListener('pointermove', e => {if (!drag) return;ui.leftW = clampW(drag.w + e.clientX - drag.x);render();});
  const end = () => {drag = null;document.body.classList.remove('st-resizing');};grip.addEventListener('pointerup', end);grip.addEventListener('pointercancel', end);
  grip.addEventListener('keydown', e => {if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {e.preventDefault();ui.leftW = clampW(ui.leftW + (e.key === 'ArrowLeft' ? -24 : 24));render();}});
  grip.addEventListener('dblclick', close);
}
let lastMode = mode();
window.addEventListener('resize', () => {const m = mode();if (m !== lastMode) {lastMode = m;if (m !== 'desktop') {ui.left = '0';ui.right = '0';}}render();});
render();
window.__studioLayout = {open, close, toggle, setLibrary, render, get panel() {return ui.panel;}, get leftOpen() {return ui.left === '1';}, get rightOpen() {return ui.right === '1';},
  syncTimeline(collapsed) {const b = $('st-toggle-timeline');b.setAttribute('aria-pressed', String(!collapsed));b.classList.toggle('active', !collapsed);}};
