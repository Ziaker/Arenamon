import * as THREE from 'three';
import {ELEMENT_DEFS, SLIDER_SPECS, STATE, createDefaultState} from './data.js';
import {clamp, computeDurationOpacity} from './math.js';
import {OptionStage} from './stage.js';

// ============================================================================
// 6. INICIALIZAÇÃO WEBGL, CONTROLES DE CÂMERA E INTERAÇÃO
// ============================================================================

const canvas = document.getElementById('vfx-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setScissorTest(true);

const stages = [new OptionStage(0), new OptionStage(1), new OptionStage(2)];
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

let camYaw = 0.22;
let camPitch = 0.36;
let camDist = 6.8;
let isDragging = false;
let prevMouse = { x: 0, y: 0 };

function applyCameraPreset(preset) {
  if (preset === 'combat') {
    camYaw = 0.22;
    camPitch = 0.36;
    camDist = 6.8;
  } else if (preset === 'side') {
    camYaw = 0.0;
    camPitch = 0.18;
    camDist = 6.6;
  } else if (preset === 'front') {
    camYaw = Math.PI / 2;
    camPitch = 0.22;
    camDist = 5.8;
  } else if (preset === 'top') {
    camYaw = 0.0;
    camPitch = 1.35;
    camDist = 7.5;
  }
}

canvas.addEventListener('pointerdown', (e) => {
  isDragging = true;
  prevMouse = { x: e.clientX, y: e.clientY };
});
window.addEventListener('pointerup', () => {
  isDragging = false;
});
window.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - prevMouse.x;
  const dy = e.clientY - prevMouse.y;
  prevMouse = { x: e.clientX, y: e.clientY };
  camYaw -= dx * 0.008;
  camPitch = clamp(camPitch + dy * 0.008, 0.05, 1.48);
});
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    camDist = clamp(camDist + e.deltaY * 0.004, 3.2, 13.0);
  },
  { passive: false }
);

// ============================================================================
// 7. CONSTRUÇÃO DINÂMICA DAS ABAS, OVERLAYS, CURVAS E SLIDERS
// ============================================================================

function syncModernRangeSlider(input) {
  input.style.setProperty('--attr-min', input.min || 0);
  input.style.setProperty('--attr-max', input.max || 100);
  input.style.setProperty('--control-value', input.value);
}

const curveCanvases = [];

function getActiveBaseCategory() {
  const elDef = ELEMENT_DEFS[STATE.element];
  const curCat = STATE.activeCategory;
  if (curCat === 'sequence') {
    return elDef.categories[0].key;
  }
  return curCat;
}

function drawOpacityCurve(optIdx, uCurrent) {
  const cvs = curveCanvases[optIdx];
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const w = cvs.width;
  const h = cvs.height;
  ctx.clearRect(0, 0, w, h);

  const baseCat = getActiveBaseCategory();
  const params = STATE.elements[STATE.element][baseCat][optIdx];

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.moveTo(w * params.fadeStart, 0);
  ctx.lineTo(w * params.fadeStart, h);
  ctx.moveTo(w * params.fadeEnd, 0);
  ctx.lineTo(w * params.fadeEnd, h);
  ctx.stroke();

  const strokeCol = optIdx === 0 ? '#38bdf8' : optIdx === 1 ? '#a855f7' : '#10b981';
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    const op = computeDurationOpacity(params, u);
    ctx.lineTo(u * w, h - op * (h - 8) - 4);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = optIdx === 0 ? 'rgba(56,189,248,0.22)' : optIdx === 1 ? 'rgba(168,85,247,0.22)' : 'rgba(16,185,129,0.22)';
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    const op = computeDurationOpacity(params, u);
    const x = u * w;
    const y = h - op * (h - 8) - 4;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = strokeCol;
  ctx.lineWidth = 2;
  ctx.stroke();

  const curOp = computeDurationOpacity(params, uCurrent);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(uCurrent * w, h - curOp * (h - 8) - 4, 3.8, 0, Math.PI * 2);
  ctx.fill();
}

function formatSliderValue(spec, val) {
  if (spec.scale === 100) return `${Math.round(val * 100)}${spec.unit}`;
  return `${Number(val).toFixed(2)}${spec.unit}`;
}

function renderElementChrome() {
  const elDef = ELEMENT_DEFS[STATE.element];

  document.querySelectorAll('.el-pill[data-el]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-el') === STATE.element);
  });

  const tabWrap = document.getElementById('category-tabs');
  tabWrap.innerHTML = '';
  elDef.categories.forEach((cat) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = `tab-${cat.key}`;
    b.className = `tab-btn${STATE.activeCategory === cat.key ? ' active' : ''}`;
    b.setAttribute('data-cat', cat.key);
    b.textContent = cat.label;
    b.addEventListener('click', () => {
      STATE.activeCategory = cat.key;
      simTime = 0;
      renderElementChrome();
      buildSlidersDeck();
      updateFavoriteButtonsUI();
      refreshExportData();
    });
    tabWrap.appendChild(b);
  });

  document.getElementById('lbl-submode').textContent = elDef.submodeLabel;
  const selSub = document.getElementById('sel-submode');
  selSub.innerHTML = '';
  elDef.submodes.forEach((sm) => {
    const opt = document.createElement('option');
    opt.value = sm.value;
    opt.textContent = sm.label;
    selSub.appendChild(opt);
  });
  selSub.value = STATE.submodeByElement[STATE.element];

  elDef.options.forEach((optMeta, idx) => {
    document.getElementById(`vp-title-${idx}`).textContent = optMeta.name.toUpperCase();
    document.getElementById(`vp-sub-${idx}`).textContent = optMeta.sub;
  });
}

function buildSlidersDeck() {
  const deck = document.getElementById('sliders-deck');
  deck.innerHTML = '';
  curveCanvases.length = 0;

  const elDef = ELEMENT_DEFS[STATE.element];
  const baseCat = getActiveBaseCategory();
  const catLabel = elDef.categories.find((c) => c.key === baseCat)?.label || '';

  const colorLabels =
    STATE.element === 'flying'
      ? ['Cor do Vento', 'Cor da Poeira', 'Cor Lâminas/Brilho']
      : STATE.element === 'fire'
      ? ['Chama Principal', 'Sombra / Tinta', 'Núcleo / Brasas']
      : ['Cor Primária', 'Cor Secundária', 'Cor Destaque'];

  elDef.options.forEach((meta, optIdx) => {
    const params = STATE.elements[STATE.element][baseCat][optIdx];
    const card = document.createElement('article');
    card.className = `option-card opt-${optIdx}`;

    card.innerHTML = `
      <div class="opt-card-header">
        <div>
          <div class="opt-card-title">${meta.name}</div>
          <div class="opt-card-ref">Inspiração: <strong>${meta.inspiration}</strong> · Editando: <em>${catLabel}</em></div>
        </div>
        <div class="opt-card-btns">
          <button type="button" class="btn-mini" data-copy-cats="${optIdx}" title="Aplicar estes sliders de ${meta.code} para todas as categorias deste elemento">⇄ Aplicar na Aba</button>
          <button type="button" class="btn-mini" data-reset-opt="${optIdx}" title="Restaurar padrão desta opção">↺ Resetar ${meta.code}</button>
        </div>
      </div>

      <div class="curve-box">
        <canvas class="curve-canvas" width="140" height="52" id="curve-cvs-${optIdx}"></canvas>
        <div class="curve-info">
          <strong>Curva de Opacidade na Duração (Ao Vivo)</strong>
          <span id="curve-summary-${optIdx}">
            Total: ${(params.opacity * 100).toFixed(0)}% · Cai de ${Math.round(params.fadeStart * 100)}% até ${Math.round(params.fadeEnd * 100)}% (Curva ${params.fadePower.toFixed(2)}×)
          </span>
        </div>
      </div>

      <div class="slider-section">
        <div class="sec-label">
          <span>1. Opacidade Total &amp; Redução durante a Duração</span>
          <span style="color:var(--accent)">Controle de Fade</span>
        </div>
        <div class="slider-grid" id="grid-opacity-${optIdx}"></div>
      </div>

      <div class="slider-section">
        <div class="sec-label">
          <span>2. Dinâmica, Escala &amp; Duração da Animação 3D</span>
          <span>Tempo Real</span>
        </div>
        <div class="slider-grid" id="grid-dynamics-${optIdx}"></div>
      </div>

      <div class="slider-section">
        <div class="sec-label">
          <span>3. Espaço, Turbulência, Pulso &amp; Cores 3D</span>
          <span>Shaders &amp; Malhas</span>
        </div>
        <div class="slider-grid" id="grid-space-${optIdx}"></div>
        <div class="color-row">
          <label class="color-cell">
            <input type="color" data-opt="${optIdx}" data-color="color" value="${params.color}">
            <span>${colorLabels[0]}</span>
          </label>
          <label class="color-cell">
            <input type="color" data-opt="${optIdx}" data-color="color2" value="${params.color2}">
            <span>${colorLabels[1]}</span>
          </label>
          <label class="color-cell">
            <input type="color" data-opt="${optIdx}" data-color="color3" value="${params.color3}">
            <span>${colorLabels[2]}</span>
          </label>
        </div>
      </div>
    `;

    deck.appendChild(card);
    curveCanvases[optIdx] = card.querySelector(`#curve-cvs-${optIdx}`);

    for (const spec of SLIDER_SPECS) {
      const targetGrid = card.querySelector(`#grid-${spec.group}-${optIdx}`);
      const item = document.createElement('div');
      item.className = `slider-item${spec.key === 'opacity' ? ' full-width' : ''}`;
      const inputId = `sl-${optIdx}-${spec.key}`;
      const val = params[spec.key];
      const formatted = formatSliderValue(spec, val);

      item.innerHTML = `
        <div class="slider-top">
          <label for="${inputId}">${spec.label}</label>
          <span class="slider-val" id="val-${inputId}">${formatted}</span>
        </div>
        <input
          type="range"
          id="${inputId}"
          min="${spec.min}"
          max="${spec.max}"
          step="${spec.step}"
          value="${val}"
          aria-valuetext="${formatted}"
          data-opt="${optIdx}"
          data-key="${spec.key}"
        />
      `;
      targetGrid.appendChild(item);

      const input = item.querySelector('input[type="range"]');
      const valSpan = item.querySelector(`#val-${inputId}`);
      syncModernRangeSlider(input);

      input.addEventListener('input', () => {
        const num = parseFloat(input.value);
        const curParams = STATE.elements[STATE.element][baseCat][optIdx];

        if (spec.key === 'fadeStart' && num >= curParams.fadeEnd - 0.02) {
          curParams.fadeEnd = clamp(num + 0.03, 0.05, 1.0);
          const feInput = document.getElementById(`sl-${optIdx}-fadeEnd`);
          if (feInput) {
            feInput.value = curParams.fadeEnd;
            syncModernRangeSlider(feInput);
            const feSpec = SLIDER_SPECS.find((s) => s.key === 'fadeEnd');
            document.getElementById(`val-sl-${optIdx}-fadeEnd`).textContent = formatSliderValue(feSpec, curParams.fadeEnd);
          }
        } else if (spec.key === 'fadeEnd' && num <= curParams.fadeStart + 0.02) {
          curParams.fadeStart = clamp(num - 0.03, 0.0, 0.95);
          const fsInput = document.getElementById(`sl-${optIdx}-fadeStart`);
          if (fsInput) {
            fsInput.value = curParams.fadeStart;
            syncModernRangeSlider(fsInput);
            const fsSpec = SLIDER_SPECS.find((s) => s.key === 'fadeStart');
            document.getElementById(`val-sl-${optIdx}-fadeStart`).textContent = formatSliderValue(fsSpec, curParams.fadeStart);
          }
        }

        curParams[spec.key] = num;
        syncModernRangeSlider(input);
        const textVal = formatSliderValue(spec, num);
        valSpan.textContent = textVal;
        input.setAttribute('aria-valuetext', textVal);

        const sumEl = document.getElementById(`curve-summary-${optIdx}`);
        if (sumEl) {
          sumEl.textContent = `Total: ${(curParams.opacity * 100).toFixed(0)}% · Cai de ${Math.round(curParams.fadeStart * 100)}% até ${Math.round(curParams.fadeEnd * 100)}% (Curva ${curParams.fadePower.toFixed(2)}×)`;
        }
        refreshExportData();
      });
    }

    card.querySelectorAll('input[type="color"]').forEach((colInput) => {
      colInput.addEventListener('input', () => {
        const key = colInput.getAttribute('data-color');
        STATE.elements[STATE.element][baseCat][optIdx][key] = colInput.value;
        refreshExportData();
      });
    });

    card.querySelector(`[data-copy-cats="${optIdx}"]`).addEventListener('click', () => {
      const src = STATE.elements[STATE.element][baseCat][optIdx];
      for (const k of Object.keys(STATE.elements[STATE.element])) {
        STATE.elements[STATE.element][k][optIdx] = { ...src };
      }
      refreshExportData();
    });

    card.querySelector(`[data-reset-opt="${optIdx}"]`).addEventListener('click', () => {
      const fresh = createDefaultState();
      STATE.elements[STATE.element][baseCat][optIdx] = fresh.elements[STATE.element][baseCat][optIdx];
      buildSlidersDeck();
      refreshExportData();
    });
  });
}

// ============================================================================
// 8. EXPORTADOR JSON & GERADOR DE PROMPT PARA IMPLEMENTAÇÃO NO JOGO
// ============================================================================

function generateExportPayload() {
  const elKey = STATE.element;
  const elDef = ELEMENT_DEFS[elKey];
  const favMap = STATE.selectedOptions[elKey];
  const selectedFavorites = {};
  const combatLabVfxPatch = {};

  for (const [catKey, optIdx] of Object.entries(favMap)) {
    const optMeta = elDef.options[optIdx];
    const params = STATE.elements[elKey][catKey][optIdx];
    selectedFavorites[catKey] = {
      optionIndex: optIdx,
      optionCode: optMeta.code,
      optionName: optMeta.name,
      inspiration: optMeta.inspiration,
      params: { ...params },
    };
    combatLabVfxPatch[`${elKey}_${catKey}`] = {
      variant: optIdx,
      ...params,
    };
  }

  return {
    schema: 'arenamon-vfx-elemental-v3',
    activeElement: elKey,
    timestamp: new Date().toISOString(),
    submode: STATE.submodeByElement[elKey],
    selectedFavorites,
    combatLabVfxPatch,
    allElementsCalibrated: STATE.elements,
  };
}

function generateImplementationPrompt(payload) {
  const elDef = ELEMENT_DEFS[payload.activeElement];
  const lines = [
    `Implemente no jogo principal (prototypes/combat-lab) os efeitos visuais 3D da aba "${elDef.label}" com exatamente as opções favoritas e os sliders calibrados abaixo (incluindo opacidade total e curva de redução de opacidade durante a duração):`,
    ``,
  ];

  let idx = 1;
  for (const [catKey, fav] of Object.entries(payload.selectedFavorites)) {
    const p = fav.params;
    lines.push(
      `${idx++}. ${catKey.toUpperCase()} (${fav.optionName} · Ref: ${fav.inspiration}):`,
      `   - Opacidade: total=${p.opacity}, fadeStart=${p.fadeStart}, fadeEnd=${p.fadeEnd}, fadePower=${p.fadePower}, endOpacity=${p.endOpacity}`,
      `   - Parâmetros 3D: intensity=${p.intensity}, size=${p.size}, duration=${p.duration}s, velocity=${p.velocity}, amount=${p.amount}, scatter=${p.scatter}, lift=${p.lift}, turbulence=${p.turbulence}, pulseFreq=${p.pulseFreq}Hz, glow=${p.glow}`,
      `   - Cores: primary=${p.color}, secondary/ink=${p.color2}, core/embers=${p.color3}`,
      ``
    );
  }

  lines.push(`JSON compatível com C.vfx (Combat Lab):`, JSON.stringify(payload.combatLabVfxPatch, null, 2));
  return lines.join('\n');
}

function refreshExportData() {
  const payload = generateExportPayload();
  const jsonEl = document.getElementById('txt-export-json');
  const promptEl = document.getElementById('txt-export-prompt');
  if (jsonEl) jsonEl.value = JSON.stringify(payload, null, 2);
  if (promptEl) promptEl.value = generateImplementationPrompt(payload);
}

// ============================================================================
// 9. EVENTOS DE NAVEGAÇÃO ENTRE ABAS ELEMENTAIS E CONTROLES GLOBAIS
// ============================================================================

function updateFavoriteButtonsUI() {
  const baseCat = getActiveBaseCategory();
  const fav = STATE.selectedOptions[STATE.element][baseCat];
  document.querySelectorAll('[data-pick]').forEach((btn) => {
    const idx = parseInt(btn.getAttribute('data-pick'), 10);
    if (idx === fav) {
      btn.classList.add('selected');
      btn.textContent = '★ Favorita na Categoria';
    } else {
      btn.classList.remove('selected');
      btn.textContent = '☆ Marcar Favorita';
    }
  });
}

function updateViewportOverlaysUI() {
  const container = document.getElementById('viewport-overlays');
  const overlays = container.querySelectorAll('.vp-Overlay');
  if (STATE.viewMode === 'triple') {
    container.classList.remove('single-mode');
    overlays.forEach((ov) => (ov.style.display = 'flex'));
    document.querySelectorAll('[data-focus]').forEach((b, i) => {
      b.textContent = `🔍 Expandir ${['A', 'B', 'C'][i]}`;
    });
  } else {
    const focusIdx = parseInt(STATE.viewMode.split('-')[1], 10);
    container.classList.add('single-mode');
    overlays.forEach((ov, i) => {
      ov.style.display = i === focusIdx ? 'flex' : 'none';
    });
    document.querySelectorAll('[data-focus]').forEach((b) => {
      b.textContent = '⚖️ Voltar p/ 3 Opções';
    });
  }
}

document.querySelectorAll('.el-pill[data-el]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const el = btn.getAttribute('data-el');
    if (!ELEMENT_DEFS[el]) return;
    STATE.element = el;
    simTime = 0;
    renderElementChrome();
    buildSlidersDeck();
    updateFavoriteButtonsUI();
    refreshExportData();
  });
});

document.querySelectorAll('[data-pick]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const idx = parseInt(btn.getAttribute('data-pick'), 10);
    const baseCat = getActiveBaseCategory();
    STATE.selectedOptions[STATE.element][baseCat] = idx;
    updateFavoriteButtonsUI();
    refreshExportData();
  });
});

document.querySelectorAll('[data-focus]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const idx = parseInt(btn.getAttribute('data-focus'), 10);
    const selView = document.getElementById('sel-view');
    STATE.viewMode = STATE.viewMode === `focus-${idx}` ? 'triple' : `focus-${idx}`;
    selView.value = STATE.viewMode;
    updateViewportOverlaysUI();
  });
});

document.getElementById('sel-view').addEventListener('change', (e) => {
  STATE.viewMode = e.target.value;
  updateViewportOverlaysUI();
});

document.getElementById('sel-submode').addEventListener('change', (e) => {
  STATE.submodeByElement[STATE.element] = e.target.value;
  refreshExportData();
});

document.getElementById('sel-cam').addEventListener('change', (e) => {
  STATE.cameraPreset = e.target.value;
  applyCameraPreset(STATE.cameraPreset);
});

document.getElementById('btn-toggle-dummies').addEventListener('click', (e) => {
  STATE.showDummies = !STATE.showDummies;
  e.currentTarget.textContent = `🧍 Lutadores: ${STATE.showDummies ? 'ON' : 'OFF'}`;
});

const btnPlayPause = document.getElementById('btn-play-pause');
btnPlayPause.addEventListener('click', () => {
  STATE.playing = !STATE.playing;
  btnPlayPause.textContent = STATE.playing ? '⏸️ Pausar' : '▶️ Reproduzir';
});

document.getElementById('btn-restart').addEventListener('click', () => {
  simTime = 0;
});

const scrubInput = document.getElementById('global-scrub');
syncModernRangeSlider(scrubInput);
scrubInput.addEventListener('input', () => {
  STATE.playing = false;
  btnPlayPause.textContent = '▶️ Reproduzir';
  const u = parseFloat(scrubInput.value);
  const baseCat = getActiveBaseCategory();
  const refDur = STATE.elements[STATE.element][baseCat][0].duration;
  simTime = u * refDur;
  syncModernRangeSlider(scrubInput);
});

const speedInput = document.getElementById('global-speed');
syncModernRangeSlider(speedInput);
speedInput.addEventListener('input', () => {
  STATE.globalSpeed = parseFloat(speedInput.value);
  document.getElementById('global-speed-val').textContent = `${STATE.globalSpeed.toFixed(2)}×`;
  syncModernRangeSlider(speedInput);
});

// Modal Exportador JSON & Prompt
const exportModal = document.getElementById('export-modal');
const exportStatus = document.getElementById('export-status');

document.getElementById('btn-open-export').addEventListener('click', () => {
  refreshExportData();
  exportModal.classList.add('open');
});
document.getElementById('btn-close-export').addEventListener('click', () => {
  exportModal.classList.remove('open');
});
exportModal.addEventListener('click', (e) => {
  if (e.target === exportModal) exportModal.classList.remove('open');
});

document.getElementById('btn-copy-json').addEventListener('click', async () => {
  const txt = document.getElementById('txt-export-json').value;
  try {
    await navigator.clipboard.writeText(txt);
    exportStatus.textContent = '✓ JSON copiado para a área de transferência!';
  } catch {
    document.getElementById('txt-export-json').select();
    exportStatus.textContent = '✓ JSON selecionado (pressione Ctrl+C).';
  }
});

document.getElementById('btn-copy-prompt').addEventListener('click', async () => {
  const txt = document.getElementById('txt-export-prompt').value;
  try {
    await navigator.clipboard.writeText(txt);
    exportStatus.textContent = '🚀 Prompt de implementação + JSON copiados!';
  } catch {
    document.getElementById('txt-export-prompt').select();
    exportStatus.textContent = '✓ Prompt selecionado (pressione Ctrl+C).';
  }
});

document.getElementById('btn-download-json').addEventListener('click', () => {
  const txt = document.getElementById('txt-export-json').value;
  const blob = new Blob([txt], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `arenamon-vfx-${STATE.element}-${STATE.activeCategory}.json`;
  a.click();
  URL.revokeObjectURL(url);
  exportStatus.textContent = '💾 Arquivo JSON baixado com sucesso!';
});

document.getElementById('btn-import-json').addEventListener('click', () => {
  const raw = prompt('Cole abaixo o JSON exportado anteriormente para carregar os sliders:');
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.allElementsCalibrated) {
      STATE.elements = parsed.allElementsCalibrated;
      buildSlidersDeck();
      refreshExportData();
      exportStatus.textContent = '📂 Configuração JSON importada e aplicada!';
    }
  } catch {
    exportStatus.textContent = '✖ JSON inválido: verifique o formato.';
  }
});

document.getElementById('btn-reset-all').addEventListener('click', () => {
  const fresh = createDefaultState();
  STATE.elements = fresh.elements;
  STATE.selectedOptions = fresh.selectedOptions;
  buildSlidersDeck();
  updateFavoriteButtonsUI();
  refreshExportData();
  exportStatus.textContent = '↺ Todos os sliders foram restaurados para os padrões de fábrica.';
});

// ============================================================================
// 10. LOOP DE ANIMAÇÃO 3D EM TEMPO REAL (60 FPS · MULTI-VIEWPORT)
// ============================================================================

let simTime = 0;
let lastFrameMs = performance.now();

function renderLoop(nowMs) {
  requestAnimationFrame(renderLoop);

  const dtRaw = Math.min(0.05, (nowMs - lastFrameMs) / 1000);
  lastFrameMs = nowMs;

  if (STATE.playing) {
    simTime += dtRaw * STATE.globalSpeed;
  }

  if (STATE.cameraPreset === 'orbit' && !isDragging) {
    camYaw += dtRaw * 0.45;
  }

  const stageWrap = document.getElementById('stage-wrapper');
  const rect = stageWrap.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));

  if (canvas.width !== Math.floor(width * renderer.getPixelRatio()) || canvas.height !== Math.floor(height * renderer.getPixelRatio())) {
    renderer.setSize(width, height, false);
  }

  const cx = Math.sin(camYaw) * Math.cos(camPitch) * camDist;
  const cy = Math.sin(camPitch) * camDist + 0.9;
  const cz = Math.cos(camYaw) * Math.cos(camPitch) * camDist;
  camera.position.set(cx, cy, cz);
  camera.lookAt(0, 1.05, 0);

  const elKey = STATE.element;
  const catKey = STATE.activeCategory;
  const baseCat = getActiveBaseCategory();

  for (let i = 0; i < 3; i++) {
    const dur = Math.max(0.25, STATE.elements[elKey][baseCat][i].duration || 1.8) * (catKey === 'sequence' ? 1.55 : 1.0);
    const u = (((simTime % dur) + dur) % dur) / dur;
    stages[i].update(elKey, catKey, u, simTime);
    drawOpacityCurve(i, u);

    const statEl = document.getElementById(`stat-${i}`);
    if (statEl) statEl.textContent = `Malhas 3D: ${stages[i].activeMeshCount} · Ciclo: ${(u * 100).toFixed(0)}%`;
    const alphaBar = document.getElementById(`alpha-bar-${i}`);
    const alphaTxt = document.getElementById(`alpha-txt-${i}`);
    if (alphaBar) alphaBar.style.width = `${Math.round(stages[i].lastAlpha * 100)}%`;
    if (alphaTxt) alphaTxt.textContent = stages[i].lastAlpha.toFixed(2);

    if (i === 0 && STATE.playing) {
      scrubInput.value = u.toFixed(3);
      syncModernRangeSlider(scrubInput);
      document.getElementById('scrubber-time').textContent = `Ciclo A: ${(u * dur).toFixed(2)}s / ${dur.toFixed(2)}s`;
    }
  }

  if (STATE.viewMode === 'triple') {
    const vpW = Math.floor(width / 3);
    for (let i = 0; i < 3; i++) {
      const x = i * vpW;
      const w = i === 2 ? width - x : vpW;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setViewport(x, 0, w, height);
      renderer.setScissor(x, 0, w, height);
      renderer.render(stages[i].scene, camera);
    }
  } else {
    const focusIdx = parseInt(STATE.viewMode.split('-')[1], 10) || 0;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setViewport(0, 0, width, height);
    renderer.setScissor(0, 0, width, height);
    renderer.render(stages[focusIdx].scene, camera);
  }
}

renderElementChrome();
buildSlidersDeck();
updateFavoriteButtonsUI();
updateViewportOverlaysUI();
refreshExportData();
requestAnimationFrame(renderLoop);

window.__ARENAMON_VFX_ELEMENTAL__ = {
  STATE,
  stages,
  computeDurationOpacity,
  generateExportPayload,
  generateImplementationPrompt,
};

