// Layout v8: Viewport 3D soberano (>= 85% da janela), 3 modos de trabalho (Rigging, Animar, Preview & Entrega),
// único inspetor contextual à direita (#st-inspector), HUD flutuante de 4 botões (#st-hud),
// barra de status de 1 linha (#st-statusbar), tooltips progressivos (?) e Modo Zen unificado (.st-zen).
const $ = id => document.getElementById(id);
const q = (sel, root = document) => root.querySelector(sel);
const field = id => $(id)?.closest('label') || $(id);
const box = id => $(id)?.closest('.lab-inline') || field(id);

const STORAGE_KEY = 'arenamon-studio-ui-v8';
const CONTEXT_META = {
  project: {section: 'project', kicker: 'PROJETO', title: 'Projeto & Importação', needsModel: false},
  bone: {section: 'rigging', kicker: 'RIGGING', title: 'Inspetor de Osso', needsModel: true},
  rigging: {section: 'rigging', kicker: 'RIGGING', title: 'Inspetor de Osso', needsModel: true},
  clips: {section: 'clips', kicker: 'BIBLIOTECA', title: 'Clipes e Ações', needsModel: false, group: 'anim'},
  clip: {section: 'clip', kicker: 'ANIMAÇÃO', title: 'Propriedades do Clipe', needsModel: true, group: 'anim'},
  trim: {section: 'trim', kicker: 'EDIÇÃO', title: 'Recortar Trecho', needsModel: true, group: 'anim'},
  event: {section: 'event', kicker: 'EDIÇÃO', title: 'Eventos de Combate', needsModel: true, group: 'anim'},
  events: {section: 'event', kicker: 'EDIÇÃO', title: 'Eventos de Combate', needsModel: true, group: 'anim'},
  root: {section: 'root', kicker: 'EDIÇÃO', title: 'Root Motion', needsModel: true, group: 'anim'},
  compare: {section: 'compare', kicker: 'EDIÇÃO', title: 'Comparar Animações', needsModel: true, group: 'anim'},
  scene: {section: 'scene', kicker: 'CENA 3D', title: 'Cenário e Chão', needsModel: false, group: 'scene'},
  appearance: {section: 'appearance', kicker: 'CENA 3D', title: 'Aparência e Cor', needsModel: false, group: 'scene'},
  camera: {section: 'camera', kicker: 'CENA 3D', title: 'Câmera e Lente', needsModel: false, group: 'scene'},
  inspect: {section: 'inspect', kicker: 'CENA 3D', title: 'Inspeção 3D', needsModel: false, group: 'scene'},
  export: {section: 'export', kicker: 'ENTREGA', title: 'Exportar Pacote', needsModel: true},
};

const SUBNAV_GROUPS = {
  scene: [
    {kind: 'scene', label: 'Cenário'},
    {kind: 'appearance', label: 'Aparência'},
    {kind: 'camera', label: 'Câmera'},
    {kind: 'inspect', label: 'Inspeção'},
  ],
  anim: [
    {kind: 'clip', label: 'Clipe'},
    {kind: 'clips', label: 'Clipes/Ações'},
    {kind: 'trim', label: 'Recortar'},
    {kind: 'event', label: 'Eventos'},
    {kind: 'root', label: 'Root'},
    {kind: 'compare', label: 'Comparar'},
  ],
};

// ---------- Montagem DOM (movendo controles existentes sem duplicar IDs) ----------
document.body.classList.add('st7');
const studioEl = q('.studio'), workspace = q('.workspace'), stage = q('.stage'), header = q('.topbar');

q('.brand', header).after($('st-top-left'), $('st-modes'));
$('st-project-badge-slot').append(q('.project-badge'));
q('.header-actions').append($('st-top-actions'));

stage.append($('st-hud'), $('rg-toolbar'), $('st-deliver-bar'), $('st-inspector'));
studioEl.append($('st-statusbar'));
document.body.append($('st-tooltip'), $('st-confirm'));

$('ed-clips-btn-slot')?.replaceWith($('st-open-clips'));
$('st-status-help-slot')?.replaceWith($('shortcut-help'));

const slot = name => q(`[data-slot="${name}"]`);
const put = (name, ...nodes) => {const target = slot(name);if (!target) return;for (const n of nodes) if (n) target.append(n);};

// HUD do Viewport (4 botões no canto superior direito)
put('hud-camera-select', $('lab-quick-camera'));
put('hud-camera-actions', $('frame'), $('view-game-preset'), $('lab-compare-button'), $('v4-screenshot'));
put('hud-scene-toggles', $('quick-textures'), $('quick-lighting'), $('lab-quick-grid'));
const focusBtn = $('v4-focus');
if (focusBtn) {
  focusBtn.textContent = '⛶';
  focusBtn.title = 'Modo Zen (Tab / F)';
  focusBtn.setAttribute('aria-label', 'Modo Zen');
  put('hud-zen', focusBtn);
}

// Projeto
put('import', q('.project-card'));
put('import-json', $('import-json-btn'), $('import-json-input'));
if ($('import-json-btn')) {
  $('import-json-btn').textContent = '↥ Importar organização (JSON)';
  $('import-json-btn').title = 'Aplica categorias, ações e nomes de um JSON exportado antes';
}
put('guide', q('.sidebar-guide'));
put('foot', q('.sidebar-foot'));

// Organizador de Clipes e Ações + painéis de edição da timeline
const quickAssign = q('.v6-quick-assign');
const libCol = q('.v6-library-column');
put('organizer', q('.organizer'));
put('editor-time', q('[data-panel="time"]'));
put('editor-trim', q('[data-panel="trim"]'));
put('editor-events', q('[data-panel="events"]'));
put('editor-root', q('[data-panel="root"]'));
put('editor-compare', q('[data-panel="compare"]'));

// Aparência
put('toggles', field('textures'), field('lighting'));
put('paint', q('.v6-selected-paint'));
put('background', field('v4-background-on'), field('v4-background'));

// Cenário
put('grid', field('lab-grid'), field('lab-floor'), field('lab-axes'), q('.lab-btns'));
put('grid-advanced', box('lab-grid-size'), box('lab-grid-x'), box('lab-grid-yaw'));
put('dummy', field('lab-dummy'), box('lab-dummy-x'));

// Câmera
put('camera-mode', field('lab-camera'), $('lab-preset'));
put('camera-advanced', box('lab-cam-distance'), box('lab-cam-shoulder'));
put('lens', field('v4-fov'), field('v4-orbit'), field('v4-orbit-speed'));
put('camera-slots', $('v4-camera-slots'));

// Movimento (dentro do contexto de Clipe)
put('root-preview', field('lab-root-mode'));
put('trajectory', field('lab-trajectory'), $('lab-trajectory-metrics'));
for (const row of document.querySelectorAll('.playback-more .v4-transport-row')) put('playback', row);

// Inspeção
put('overlays', field('v4-skeleton'), field('v4-wireframe'), field('v4-bounds'));
put('mesh', field('v4-mesh'));
put('feet', field('lab-feet'), $('lab-foot-status'));
put('metadata', $('v4-metadata'));

// Exportar
const exportPanel = q('#export-moved-content .panel');
if (exportPanel) {
  q('h3', exportPanel)?.remove();
  q('.panel-sub', exportPanel)?.remove();
  put('export', ...exportPanel.children);
}
if ($('export')) $('export').textContent = '↓ Exportar GLB final';
if ($('export-json')) $('export-json').textContent = '↓ Exportar JSON de ações';

// Remove/oculta superfícies legadas esvaziadas
q('aside.rail')?.remove();
q('.v6-resize')?.remove();
for (const el of [$('studio-tools'), $('settings-backdrop'), $('studio-export'), $('export-backdrop'), q('.workflow'), $('open-tools'), $('open-export'), q('.playback-more'), q('.stage-top'), q('.lab-view-toolbar')]) {
  el?.setAttribute('hidden', '');
}

// ---------- Estado coordenado (arenamon-studio-ui-v8) ----------
const state = {
  mode: 'animate', // 'rigging' | 'animate' | 'deliver'
  inspector: {open: false, kind: null, targetId: null},
  timeline: {expanded: false, height: 196, pinned: false},
  zen: false,
};

try {
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (raw && typeof raw === 'object') {
    if (['rigging', 'animate', 'deliver'].includes(raw.mode)) state.mode = raw.mode;
    if (raw.timeline && typeof raw.timeline === 'object') {
      if (Number(raw.timeline.height) > 0) state.timeline.height = Number(raw.timeline.height);
      state.timeline.pinned = !!raw.timeline.pinned;
    }
  }
} catch {}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: state.mode,
      inspector: state.inspector,
      timeline: state.timeline,
      zen: state.zen,
    }));
  } catch {}
}

function normalizeKind(kind) {
  if (kind === 'rigging') return 'bone';
  if (kind === 'events') return 'event';
  if (kind === 'motion') return 'clip';
  return CONTEXT_META[kind] ? kind : 'project';
}

function renderSubnav(meta) {
  const nav = $('st-inspector-subnav');
  if (!nav) return;
  const items = meta?.group ? SUBNAV_GROUPS[meta.group] : null;
  if (!items) {nav.hidden = true;nav.replaceChildren();return;}
  nav.hidden = false;
  nav.replaceChildren(...items.map(item => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = item.label;
    b.setAttribute('aria-selected', String(state.inspector.kind === item.kind));
    b.onclick = () => selectContext(item.kind, state.inspector.targetId);
    return b;
  }));
}

function render() {
  const kind = state.inspector.kind;
  const meta = kind ? CONTEXT_META[kind] : null;
  const inspectorOpen = !state.zen && state.inspector.open && !!meta;
  const hasModel = !!window.__importer?.model;
  const blockedByModel = inspectorOpen && meta.needsModel && !hasModel;

  document.body.dataset.studioMode = state.mode;
  document.body.classList.toggle('st-inspector-open', inspectorOpen);
  document.body.classList.toggle('st-zen', state.zen);

  // Botões de modo na topbar
  for (const b of document.querySelectorAll('#st-modes [data-mode]')) {
    b.setAttribute('aria-selected', String(b.dataset.mode === state.mode));
  }

  // Barras flutuantes de modo
  $('rg-toolbar').hidden = state.zen || state.mode !== 'rigging';
  $('st-deliver-bar').hidden = state.zen || state.mode !== 'deliver';
  $('ed-dock').hidden = state.zen || state.mode !== 'animate';

  // Botão Projeto e Clipes/Ações
  $('st-project-btn')?.setAttribute('aria-expanded', String(inspectorOpen && kind === 'project'));
  $('st-open-clips')?.setAttribute('aria-pressed', String(inspectorOpen && kind === 'clips'));
  if ($('v4-focus')) $('v4-focus').setAttribute('aria-pressed', String(state.zen));

  // Inspetor contextual único
  const inspectorEl = $('st-inspector');
  inspectorEl.hidden = !inspectorOpen;
  if (inspectorOpen && meta) {
    $('st-inspector-kicker').textContent = meta.kicker;
    $('st-inspector-title').textContent = meta.title;
    renderSubnav(meta);

    // Move .v6-quick-assign para o contexto ativo ('clip' vs 'clips')
    if (quickAssign) {
      if (meta.section === 'clip') slot('clip-quick-assign')?.append(quickAssign);
      else if (meta.section === 'clips' && libCol) libCol.append(quickAssign);
    }

    for (const s of inspectorEl.querySelectorAll('[data-section]')) {
      s.hidden = s.dataset.section !== meta.section || blockedByModel;
    }
    $('st-needs-model').hidden = !blockedByModel;

    // Garante visibilidade das sub-seções movidas do editor
    for (const p of document.querySelectorAll('[data-panel]')) {
      if (p.dataset.panel === 'time') p.hidden = meta.section !== 'clip';
      else if (p.dataset.panel === 'events') p.hidden = meta.section !== 'event';
      else p.hidden = p.dataset.panel !== meta.section;
    }
  }

  window.__studioRig?.syncMode?.();
  refreshStatus();
  persist();
}

function setMode(mode) {
  if (!['rigging', 'animate', 'deliver'].includes(mode)) return;
  closeHudPopovers();
  state.mode = mode;
  // Alternar de modo nunca abre o inspetor automaticamente
  state.inspector = {open: false, kind: null, targetId: null};
  if (window.__studioEditor && mode !== 'animate') {
    window.__studioEditor.openTool?.(null, {fromLayout: true});
  }
  render();
  window.dispatchEvent(new Event('resize'));
}

function selectContext(kind, targetId = null, opts = {}) {
  closeHudPopovers();
  const norm = normalizeKind(kind);
  if (norm === 'bone' && state.mode !== 'rigging') state.mode = 'rigging';
  state.inspector = {open: true, kind: norm, targetId};

  if (!opts.fromEditor && window.__studioEditor) {
    const editorTool = norm === 'trim' ? 'trim' : norm === 'event' ? 'events' : norm === 'root' ? 'root' : norm === 'compare' ? 'compare' : norm === 'clip' ? 'time' : null;
    window.__studioEditor.openTool?.(editorTool, {keep: true, fromLayout: true});
  }
  render();
  window.__studioEditor?.renderAll?.();
}

function closeInspector(opts = {}) {
  state.inspector = {open: false, kind: null, targetId: null};
  if (!opts.fromEditor && window.__studioEditor) {
    window.__studioEditor.openTool?.(null, {fromLayout: true});
  }
  render();
}

function toggleContext(kind, targetId = null) {
  const norm = normalizeKind(kind);
  if (state.inspector.open && state.inspector.kind === norm) closeInspector();
  else selectContext(norm, targetId);
}

// ---------- Popovers do HUD (Câmera e Cena/Luz) ----------
const camBtn = $('st-hud-camera-btn'), camPop = $('st-hud-camera-pop');
const sceneBtn = $('st-hud-scene-btn'), scenePop = $('st-hud-scene-pop');
const xrayBtn = $('st-hud-xray-btn');

function closeHudPopovers() {
  if (camPop) camPop.hidden = true;
  if (scenePop) scenePop.hidden = true;
  camBtn?.setAttribute('aria-expanded', 'false');
  sceneBtn?.setAttribute('aria-expanded', 'false');
}

camBtn.onclick = e => {
  e.stopPropagation();
  const next = camPop.hidden;
  closeHudPopovers();
  camPop.hidden = !next;
  camBtn.setAttribute('aria-expanded', String(next));
};
sceneBtn.onclick = e => {
  e.stopPropagation();
  const next = scenePop.hidden;
  closeHudPopovers();
  scenePop.hidden = !next;
  sceneBtn.setAttribute('aria-expanded', String(next));
};
$('st-more-camera').onclick = () => selectContext('camera');
$('st-more-scene').onclick = () => selectContext('scene');

xrayBtn.onclick = () => {
  const skel = $('v4-skeleton');
  if (skel) {
    skel.checked = !skel.checked;
    skel.dispatchEvent(new Event('change', {bubbles: true}));
  }
  if (state.mode === 'rigging' && $('rg-markers')) {
    $('rg-markers').checked = skel ? skel.checked : !$('rg-markers').checked;
    $('rg-markers').dispatchEvent(new Event('change', {bubbles: true}));
  }
  xrayBtn.setAttribute('aria-pressed', String(!!skel?.checked));
};
$('v4-skeleton')?.addEventListener('change', () => {
  xrayBtn.setAttribute('aria-pressed', String(!!$('v4-skeleton').checked));
});

document.addEventListener('pointerdown', e => {
  if (!camPop.hidden && !camPop.contains(e.target) && e.target !== camBtn) closeHudPopovers();
  if (!scenePop.hidden && !scenePop.contains(e.target) && e.target !== sceneBtn) closeHudPopovers();
});

// ---------- Eventos de UI (Topbar, Rigging Toolbar, Deliver Bar, Inspetor) ----------
for (const b of document.querySelectorAll('#st-modes [data-mode]')) {
  b.onclick = () => setMode(b.dataset.mode);
}
$('st-project-btn').onclick = () => toggleContext('project');
$('st-inspector-close').onclick = () => closeInspector();
$('st-open-clips').onclick = () => toggleContext('clips');
$('st-top-export').onclick = () => selectContext('export');
$('st-deliver-export-btn').onclick = () => selectContext('export');
$('st-deliver-play').onclick = () => $('play')?.click();
$('st-clip-open-events').onclick = () => {
  window.__studioEditor?.setExpanded?.(true);
  selectContext('event', window.__studioEditor?.selectedEvent || null);
};
$('st-open-root-tool').onclick = () => {
  window.__studioEditor?.setExpanded?.(true);
  selectContext('root', window.__importer?.selectedIndex ?? 0);
};

for (const b of document.querySelectorAll('[data-goto]')) {
  b.onclick = () => selectContext(b.dataset.goto);
}

// Filtro de sub-abas em Clipes/Ações
const clipsSection = q('[data-section="clips"]');
if (clipsSection) clipsSection.dataset.orgFilter = 'all';
for (const b of document.querySelectorAll('[data-org-view]')) {
  b.onclick = () => {
    const v = b.dataset.orgView;
    if (clipsSection) clipsSection.dataset.orgFilter = v;
    for (const x of document.querySelectorAll('[data-org-view]')) {
      const on = x.dataset.orgView === v;
      x.classList.toggle('active', on);
      x.setAttribute('aria-selected', String(on));
    }
  };
}

// Barra rápida de Rigging
$('rg-open-inspector').onclick = () => {
  const sel = window.__studioRig?.state?.()?.selected || null;
  toggleContext('bone', sel);
};
for (const b of document.querySelectorAll('[data-rg-proxy]')) {
  b.onclick = () => {
    const targetId = b.dataset.rgProxy;
    $(targetId)?.click();
    if (targetId === 'rg-template' || targetId === 'rg-audit') {
      selectContext('bone', window.__studioRig?.state?.()?.selected || null);
    }
  };
}

// Presets de câmera na barra de Preview & Entrega
for (const b of document.querySelectorAll('[data-cam-preset]')) {
  b.onclick = () => {
    const cam = $('lab-camera');
    if (cam) {
      cam.value = b.dataset.camPreset;
      cam.dispatchEvent(new Event('change', {bubbles: true}));
    }
    for (const x of document.querySelectorAll('[data-cam-preset]')) {
      x.classList.toggle('active', x === b);
    }
  };
}

// ---------- Clique curto no fundo vazio do #view abre 'scene' ou fecha inspetor ----------
{
  const viewEl = $('view');
  let down = null;
  viewEl.addEventListener('pointerdown', e => {
    if (e.button !== 0 || state.zen) {down = null;return;}
    down = {x: e.clientX, y: e.clientY, t: performance.now()};
  });
  viewEl.addEventListener('pointerup', e => {
    if (!down || state.zen) return;
    const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (dist > 4) return; // arrasto de órbita nunca abre nem fecha o inspetor
    setTimeout(() => {
      if (state.zen) return;
      // Se o clique selecionou um marcador de osso ou gizmo 3D no modo Rigging, não sobrescreve
      if (window.__studioRigPickedAt && performance.now() - window.__studioRigPickedAt < 80) return;
      if (!window.__importer?.model && !state.inspector.open) return;
      if (state.inspector.open) closeInspector();
      else selectContext('scene');
    }, 0);
  });
}

// ---------- Modo Zen unificado (.st-zen) ----------
let lastDblClickAt = 0;
function enterZen() {
  if (state.zen) return;
  closeHudPopovers();
  state.zen = true;
  render();
  window.dispatchEvent(new Event('resize'));
}
function exitZen() {
  if (!state.zen) return;
  state.zen = false;
  render();
  window.dispatchEvent(new Event('resize'));
}
function toggleZen() {
  if (state.zen) exitZen();
  else enterZen();
}

queueMicrotask(() => {
  if ($('v4-focus')) $('v4-focus').onclick = () => toggleZen();
});

$('view').addEventListener('dblclick', e => {
  if (window.__studioRigPickedAt && performance.now() - window.__studioRigPickedAt < 120) return;
  lastDblClickAt = performance.now();
  e.preventDefault();
  toggleZen();
});

// Em Modo Zen, qualquer tecla ou clique restaura a interface antes de disparar outras ações
window.addEventListener('keydown', e => {
  if (state.zen) {
    exitZen();
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  if (!$('st-confirm')?.hidden || !$('help-modal')?.hidden) return;
  const a = document.activeElement;
  const typing = a && (['INPUT', 'SELECT', 'TEXTAREA'].includes(a.tagName) && a.type !== 'checkbox' && a.type !== 'range');
  if (e.key === 'Escape') {
    if (!camPop.hidden || !scenePop.hidden) {closeHudPopovers();return;}
    if (state.inspector.open) {closeInspector();return;}
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Tab' || (e.key === 'f' && !e.shiftKey) || (e.key === 'F' && !e.shiftKey)) {
    e.preventDefault();
    enterZen();
  }
}, true);

window.addEventListener('pointerdown', e => {
  if (!state.zen) return;
  if (performance.now() - lastDblClickAt < 80) return;
  exitZen();
  e.preventDefault();
  e.stopImmediatePropagation();
}, true);

window.addEventListener('click', e => {
  if (!state.zen) return;
  if (performance.now() - lastDblClickAt < 120) return;
  exitZen();
  e.preventDefault();
  e.stopImmediatePropagation();
}, true);

// ---------- Ajuda progressiva (?) via popover acessível ----------
{
  const tip = $('st-tooltip');
  let activeTrigger = null;
  function showTip(btn) {
    const text = btn?.dataset?.help;
    if (!text || !tip) return;
    activeTrigger = btn;
    tip.textContent = text;
    tip.hidden = false;
    btn.setAttribute('aria-describedby', 'st-tooltip');
    const r = btn.getBoundingClientRect();
    const tw = tip.offsetWidth || 250, th = tip.offsetHeight || 60;
    const left = Math.max(8, Math.min(innerWidth - tw - 8, r.right - tw));
    const top = r.bottom + th + 10 < innerHeight ? r.bottom + 6 : Math.max(8, r.top - th - 6);
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  function hideTip() {
    if (!tip || tip.hidden) return;
    tip.hidden = true;
    activeTrigger?.removeAttribute('aria-describedby');
    activeTrigger = null;
  }
  document.addEventListener('pointerover', e => {
    const btn = e.target?.closest?.('.st-help-trigger[data-help]');
    if (btn) showTip(btn);
  });
  document.addEventListener('pointerout', e => {
    const btn = e.target?.closest?.('.st-help-trigger[data-help]');
    if (btn && btn === activeTrigger) hideTip();
  });
  document.addEventListener('focusin', e => {
    const btn = e.target?.closest?.('.st-help-trigger[data-help]');
    if (btn) showTip(btn);
  });
  document.addEventListener('focusout', e => {
    const btn = e.target?.closest?.('.st-help-trigger[data-help]');
    if (btn && btn === activeTrigger) hideTip();
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !tip.hidden) hideTip();
  });
}

// ---------- Barra de status de 1 linha ----------
function refreshStatus() {
  const statusEl = $('status'), mainEl = $('st-status-main');
  if (statusEl && mainEl) {
    const clean = (statusEl.textContent || '').replace(/\s+/g, ' ').trim();
    if (clean) {
      mainEl.textContent = clean;
      mainEl.title = clean;
    }
  }
  const rigChip = $('st-status-rig');
  if (rigChip) {
    const hasModel = !!window.__importer?.model;
    const count = window.__studioRig?.state?.()?.boneCount ?? 0;
    rigChip.hidden = !hasModel;
    if (hasModel) rigChip.textContent = `${count} osso(s)`;
  }
  const playBtn = $('st-deliver-play');
  if (playBtn && window.__importer) {
    playBtn.textContent = window.__importer.playing ? '❚❚ Pausar' : '▶ Prévia';
  }
}
const statusNode = $('status');
if (statusNode) {
  new MutationObserver(refreshStatus).observe(statusNode, {childList: true, characterData: true, subtree: true});
}

// ---------- API pública window.__studioLayout ----------
function syncTimeline(collapsed, pinned = state.timeline.pinned) {
  state.timeline.expanded = !collapsed;
  state.timeline.pinned = !!pinned;
  persist();
}

function open(panel) {
  if (panel === 'rigging') {
    state.mode = 'rigging';
    selectContext('bone', window.__studioRig?.state?.()?.selected || null);
  } else {
    selectContext(panel);
  }
}

function close() {closeInspector();}
function toggle(panel) {toggleContext(panel);}
function setLibrary(on) {if (on) selectContext('clips');else if (state.inspector.kind === 'clips') closeInspector();}

render();

window.__studioLayout = {
  get mode() {return state.mode;},
  setMode,
  get inspector() {return {...state.inspector};},
  selectContext,
  closeInspector,
  toggleContext,
  get timeline() {return {...state.timeline, expanded: !window.__studioEditor?.collapsed, pinned: !!window.__studioEditor?.pinned};},
  syncTimeline,
  get zen() {return state.zen;},
  enterZen,
  exitZen,
  toggleZen,
  refreshStatus,
  render,
  // Compatibilidade legada
  open,
  close,
  toggle,
  setLibrary,
  get panel() {return state.inspector.kind || 'project';},
  get leftOpen() {return state.inspector.open;},
  get rightOpen() {return state.inspector.open && state.inspector.kind === 'clips';},
};
