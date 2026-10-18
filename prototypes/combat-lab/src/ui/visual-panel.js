// Aba Visualizar: efeitos visuais (três variantes cada), sombras, tremor de câmera, câmera, HUD, altura visual,
// indicador da janela C → X e depuração dos disparos de VFX. Todos os controles são do ajustador (desfazer,
// presets e exportação); nenhum altera regras de combate.
import {C, vfxDefaults, displayDefaults} from '../sim/config.js';
import {spawn} from '../sim/world.js';
import {VFX_TYPES, SHAKE_EVENTS} from '../view/vfx.js';
import {SOLID_FAMILIES} from '../view/solid-fx.js';
import {fold} from './characters-panel.js';
import {escape} from './tuning.js';

/** Parâmetro principal de cada efeito no modo simples. */
const MAIN = {hit: 'intensity', dodge: 'intensity', sprint: 'intensity', block: 'intensity', perfect: 'intensity', ground: 'intensity', clash: 'intensity', exhaust: 'glow', regen: 'intensity', rock: 'scale', barrier: 'opacity'};
export function createVisualPanel({tuning, view, game, $, hud, download}) {
  const root = $('visual-panel'), state = {mode: 'simple', filter: 'all'};
  function setMode(m) {
    state.mode = m === 'advanced' ? 'advanced' : 'simple';
    for (const b of root.querySelectorAll('[data-vfx-mode-btn]')) b.setAttribute('aria-pressed', String(b.dataset.vfxModeBtn === state.mode));
    for (const el of root.querySelectorAll('[data-vfx-mode]')) el.hidden = el.dataset.vfxMode !== state.mode;
  }
  /** Filtros: todos, só ligados, só alterados (≠ padrão) e mais caros (partículas criadas por tipo, medidas ao vivo). */
  function setFilter(f) {
    state.filter = f;for (const b of root.querySelectorAll('[data-vfx-filter]')) b.setAttribute('aria-pressed', String(b.dataset.vfxFilter === f));
    const cost = view.vfx.stats.byType || {}, changed = t => tuning.manifest.some(m => m.path.startsWith(`vfx.${t}.`) && tuning.changed(m));
    const ranked = VFX_TYPES.map(([t]) => t).sort((a, b) => (cost[b] ?? 0) - (cost[a] ?? 0)), top = ranked.filter(t => (cost[t] ?? 0) > 0);
    for (const el of root.querySelectorAll('[data-vfx-type]')) {
      const t = el.dataset.vfxType, show = f === 'all' || (f === 'active' && C.vfx.master.enabled && C.vfx[t]?.enabled) || (f === 'changed' && changed(t)) || (f === 'costly' && top.includes(t));
      el.hidden = !show;el.style.order = f === 'costly' ? String(ranked.indexOf(t)) : '';
      const c = el.querySelector('[data-cost]');if (c) c.textContent = cost[t] ? `${cost[t]} partículas` : '';
    }
    const info = $('vfx-filter-info');if (info) info.textContent = f === 'costly' ? (top.length ? `Ordem por partículas criadas desde a abertura (medido): ${top.map(t => `${t} ${cost[t]}`).join(' · ')}.` : 'Ainda não há medição: jogue ou rode o benchmark para ver quais efeitos custam mais.') : f === 'changed' ? 'Efeitos com algum parâmetro diferente do padrão do laboratório.' : '';
  }
  const reset = (prefix, values) => tuning.commit(Object.entries(values).filter(([k, v]) => typeof v === 'number' && tuning.byPath.has(`${prefix}.${k}`)).map(([k, v]) => [`${prefix}.${k}`, v]), 'Restaurar ' + prefix);
  const exportPreset = (prefix, label) => download(JSON.stringify({schema: 'arenamon-vfx-preset', version: 1, path: prefix, label, values: structuredClone(prefix.split('.').reduce((o, k) => o[k], C))}, null, 2), `arenamon-${prefix.replace('.', '-')}.json`);
  function importPreset(prefix, file, out) {
    file.text().then(t => {
      let d;try {d = JSON.parse(t);} catch (e) {out.textContent = 'JSON inválido: ' + e.message;return;}
      if (d.schema !== 'arenamon-vfx-preset' || d.path !== prefix) {out.textContent = `Preset de outro efeito (${escape(d.path ?? '?')}).`;return;}
      const changes = Object.entries(d.values || {}).filter(([k, v]) => typeof v === 'number' && tuning.byPath.has(`${prefix}.${k}`)).map(([k, v]) => {const m = tuning.byPath.get(`${prefix}.${k}`);return [`${prefix}.${k}`, Math.max(m.min, Math.min(m.max, v))];});
      out.textContent = `${tuning.commit(changes, 'Preset ' + prefix)} valor(es) aplicados (Ctrl+Z desfaz).`;
    });
  }
  /** Barra de ações de um efeito: prévia, restaurar padrão, exportar e importar preset. */
  function actions(prefix, label, defaultsOf, previewFn) {
    const bar = document.createElement('div');bar.className = 'row fx-actions';
    const btn = (text, title, fn) => {const b = document.createElement('button');b.type = 'button';b.textContent = text;b.title = title;b.onclick = fn;bar.append(b);return b;};
    if (previewFn) btn('▶ Prévia', 'Mostrar este efeito agora, perto do lutador azul', previewFn).dataset.preview = prefix;
    btn('↺ Padrão', 'Restaurar os valores padrão deste efeito', () => reset(prefix, defaultsOf()));
    btn('↓ Preset', 'Exportar os valores deste efeito (JSON)', () => exportPreset(prefix, label));
    const lab = document.createElement('label');lab.className = 'file-btn';lab.textContent = '↑ Preset';lab.title = 'Importar um preset deste efeito';
    const inp = document.createElement('input');inp.type = 'file';inp.accept = '.json,application/json';inp.hidden = true;const out = document.createElement('span');out.className = 'muted';
    inp.onchange = () => {if (inp.files[0]) importPreset(prefix, inp.files[0], out);inp.value = '';};lab.append(inp);bar.append(lab, out);
    return bar;
  }
  function group(title, key, rows, extra = [], open = false) {
    const body = document.createElement('div');body.append(...rows, ...extra);
    const box = rows.length + extra.length > 2 ? fold(title, key, body, {open, count: `${rows.length} controles`}) : (() => {const d = document.createElement('div');const h = document.createElement('h4');h.textContent = title;d.append(h, body);return d;})();
    box.dataset.group = key;return box;
  }
  function render() {
    root.replaceChildren();
    const colLeft = document.createElement('div');colLeft.className = 'vfx-col-left';const colMid = document.createElement('div');colMid.className = 'vfx-col-mid';const colRight = document.createElement('div');colRight.className = 'vfx-col-right';root.append(colLeft, colMid, colRight);
    const h = (t, hint, host = colLeft) => {const e = document.createElement('h3');e.textContent = t;host.append(e);if (hint) {const p = document.createElement('p');p.className = 'hint';p.textContent = hint;host.append(p);}};
    h('Efeitos visuais (VFX)', 'Cada efeito tem variantes visuais diferentes, liga/desliga, parâmetros próprios, prévia e preset. Só aparência: nada aqui muda regras, tempos da simulação, invulnerabilidade ou cooldowns.');
    // Seletor de Renderizador VFX e Controles do Laser
    const renderModeBox = document.createElement('div');
    renderModeBox.className = 'vfx-runtime-toggle-box';
    renderModeBox.style.cssText = 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.14);border-radius:6px;padding:10px 12px;margin:8px 0 14px;';
    renderModeBox.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
        <span style="font-weight:600;font-size:0.95rem;">Renderizador Ativo de VFX & Laser</span>
        <div class="seg" role="group" aria-label="Renderizador de VFX">
          <button type="button" data-vfx-runtime-btn="legacy" ${!view.useNewVfx ? 'aria-pressed="true"' : 'aria-pressed="false"'}>Legado (v6 Fallback)</button>
          <button type="button" data-vfx-runtime-btn="new" ${view.useNewVfx ? 'aria-pressed="true"' : 'aria-pressed="false"'}>Novo VfxRuntime (Declarativo + Laser)</button>
        </div>
      </div>
      <p class="hint" style="margin:0 0 8px 0;" id="vfx-runtime-hint">
        ${view.useNewVfx ? 'Ativo: VfxRuntime com instanciamento único, BeamRenderer dedicado (núcleo incondicional, halo aditivo) e variantes A/B/C.' : 'Ativo: renderizador legado. O novo sistema está em repouso como fallback seguro.'}
      </p>

      <!-- SEÇÃO LASER DA ARENA -->
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <span class="muted" style="font-size:0.85rem;">Laser da Arena:</span>
        <button type="button" data-laser-preview="1">▶ Laser PL1 (Ciano)</button>
        <button type="button" data-laser-preview="2">▶ Laser PL2 (Dourado)</button>
        <button type="button" data-laser-preview="3">▶ Laser PL3 (Magenta)</button>
        <button type="button" data-sim-laser="1">⚡ Laser Real PL1</button>
        <button type="button" data-sim-laser="2">⚡ Laser Real PL2</button>
        <button type="button" data-sim-laser="3">⚡ Laser Real PL3</button>
        <button type="button" data-sim-scene="reflect">⚡ Testar Reflexão Real</button>
        <button type="button" data-sim-scene="neutralize">⚡ Testar Neutralização Real</button>
      </div>

      <!-- SEÇÃO ROCHAS TELECINÉTICAS (PSYSHOCK) -->
      <div class="vfx-quick-rock" style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:6px;">
          <span style="font-weight:600;font-size:0.9rem;">🪨 Rochas Telecinéticas (Psyshock) — Modelo 3D & Efeitos:</span>
          <div class="seg" role="group" aria-label="Modelo 3D da Rocha">
            <button type="button" data-rock-style="0" ${C.vfx.rock?.variant === 0 ? 'aria-pressed="true"' : 'aria-pressed="false"'}>Boulder Facetado</button>
            <button type="button" data-rock-style="1" ${C.vfx.rock?.variant === 1 ? 'aria-pressed="true"' : 'aria-pressed="false"'}>Cristal Psíquico</button>
            <button type="button" data-rock-style="2" ${C.vfx.rock?.variant === 2 ? 'aria-pressed="true"' : 'aria-pressed="false"'}>Meteorito Runas</button>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <span class="muted" style="font-size:0.85rem;">Ações das Rochas:</span>
          <button type="button" data-rock-preview="1">▶ Prévia Rochas PL1</button>
          <button type="button" data-rock-preview="2">▶ Prévia Rochas PL2</button>
          <button type="button" data-rock-preview="3">▶ Prévia Rochas PL3</button>
          <button type="button" data-sim-rock="1">⚡ Disparar Pedras Reais</button>
          <button type="button" data-sim-rock="shatter">💥 Testar Estilhaçamento</button>
        </div>
      </div>

      <!-- SEÇÃO BARREIRA DE ENERGIA (REFLECT) -->
      <div class="vfx-quick-barrier" style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:6px;">
          <span style="font-weight:600;font-size:0.9rem;">🛡️ Barreira de Energia (Reflect) — Estrutura & VFX:</span>
          <div class="seg" role="group" aria-label="Estilo da Barreira">
            <button type="button" data-barrier-style="0" ${C.vfx.barrier?.variant === 0 ? 'aria-pressed="true"' : 'aria-pressed="false"'}>Hex-Grid Ciclado</button>
            <button type="button" data-barrier-style="1" ${C.vfx.barrier?.variant === 1 ? 'aria-pressed="true"' : 'aria-pressed="false"'}>Cristal Prismático</button>
            <button type="button" data-barrier-style="2" ${C.vfx.barrier?.variant === 2 ? 'aria-pressed="true"' : 'aria-pressed="false"'}>Campo de Força Puro</button>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <span class="muted" style="font-size:0.85rem;">Ações da Barreira:</span>
          <button type="button" data-barrier-preview="1">▶ Prévia Barreira</button>
          <button type="button" data-sim-barrier="spawn">⚡ Materializar Barreira Real</button>
          <button type="button" data-sim-barrier="shatter">💥 Testar Quebra por Tackle</button>
        </div>
      </div>

      <!-- ACESSIBILIDADE VISUAL -->
      <div class="vfx-quick-a11y" style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <span style="font-weight:600;font-size:0.85rem;">Acessibilidade Visual:</span>
        <label style="display:inline-flex;align-items:center;gap:4px;font-size:0.85rem;cursor:pointer;">
          <input type="checkbox" data-vfx-a11y="noFlash" ${(C.vfx.master?.noFlash || C.vfx.laser?.noFlash) ? 'checked' : ''}> Sem Flash (noFlash)
        </label>
        <label style="display:inline-flex;align-items:center;gap:4px;font-size:0.85rem;cursor:pointer;">
          <input type="checkbox" data-vfx-a11y="reduceMotion" ${(C.vfx.master?.reduceMotion || C.vfx.laser?.reduceMotion) ? 'checked' : ''}> Reduzir Movimento (reduceMotion)
        </label>
        <label style="display:inline-flex;align-items:center;gap:4px;font-size:0.85rem;cursor:pointer;">
          <input type="checkbox" data-vfx-a11y="highContrast" ${(C.vfx.master?.highContrast || C.vfx.laser?.highContrast) ? 'checked' : ''}> Alto Contraste (highContrast)
        </label>
      </div>
    `;
    renderModeBox.insertAdjacentHTML("beforeend", `
      <div class="vfx-quick-style" style="margin-top:10px;">
        <b>Estilo Global de VFX:</b>
        <div class="seg" role="group" aria-label="Estilo Global">
          <button type="button" data-global-vfx="0" ${C.vfx.hit?.variant === 0 ? 'aria-pressed="true"' : 'aria-pressed="false"'}>Variante A (Arcade)</button>
          <button type="button" data-global-vfx="1" ${C.vfx.hit?.variant === 1 ? 'aria-pressed="true"' : 'aria-pressed="false"'}>Variante B (Cinematic)</button>
          <button type="button" data-global-vfx="2" ${C.vfx.hit?.variant === 2 ? 'aria-pressed="true"' : 'aria-pressed="false"'}>Variante C (Tático)</button>
        </div>
      </div>
  `);
    colLeft.append(renderModeBox);
    // ---------- VFX 3D sólidos: malhas com volume real; por família: estilo, prévias, comparação e sliders ----------
    const solidBox = document.createElement('div');solidBox.className = 'vfx-solid-box';solidBox.dataset.solidBox = '1';
    solidBox.style.cssText = 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.14);border-radius:6px;padding:10px 12px;margin:0 0 14px;';
    const SOLID_SLIDERS = ['intensity', 'amount', 'size', 'duration', 'velocity', 'scatter', 'lift', 'turbulence', 'opacity', 'fadeStart', 'fadeEnd'];
    solidBox.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:6px;"><span style="font-weight:600;font-size:.95rem;">Efeitos 3D sólidos (malhas com volume, giram com a câmera)</span>
        <label style="display:inline-flex;align-items:center;gap:4px;font-size:.85rem;"><input type="checkbox" data-solid-master ${C.vfx.solid?.enabled ? 'checked' : ''}> Ligados</label></div>
      <p class="hint" style="margin:0 0 8px;">Funcionam com os dois renderizadores. O estilo marcado é exatamente o usado na luta; clicar já mostra a prévia. Poeira e vento têm estilo, intensidade e cores independentes (use os dois juntos). Ctrl+Z desfaz; presets e exportação incluem tudo.</p>
      <div class="row" data-solid-combo style="margin-bottom:6px;"><b style="font-size:.85rem;">Poeira + vento juntos:</b>${[['dash', 'Dash'], ['start', 'Arrancada'], ['run', 'Corrida'], ['turn', 'Curva'], ['stop', 'Parada']].map(([w, l]) => `<button type="button" data-solid-combo-prev="${w}">▶ ${l}</button>`).join('')}</div>
      <div class="row" style="margin-bottom:6px;"><span class="muted" style="font-size:.8rem;">Limite de objetos e qualidade:</span><span data-solid-global></span></div><div class="solid-families-grid">` +
      SOLID_FAMILIES.map(f => `<div data-solid-family="${f.key}" style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;"><b style="font-size:.9rem;">${escape(f.label)}</b><span class="muted" style="font-size:.8rem;">Dispara em: ${escape(f.trigger)}</span>
          <label style="display:inline-flex;align-items:center;gap:4px;font-size:.8rem;"><input type="checkbox" data-solid-on="${f.key}" ${C.vfx[f.key]?.enabled ? 'checked' : ''}> ligado</label>
          ${f.previews ? f.previews.map(([w, l]) => `<button type="button" data-solid-prev="${f.key}:${w}">▶ ${l}</button>`).join('') + `<button type="button" data-solid-prev="${f.key}:compare" title="Todos os estilos lado a lado, no mesmo movimento">▶ Comparar os ${f.names.length}</button>` : `<button type="button" data-solid-prev="${f.key}:dash">▶ Prévia</button>`}</div>
        <div class="seg" role="group" aria-label="${escape(f.label)}" style="flex-wrap:wrap;">${f.names.map((n, v) => `<button type="button" data-solid-variant="${f.key}:${v}" aria-pressed="${(C.vfx[f.key]?.variant | 0) === v}" title="${escape(n)}">${escape(n)}</button>`).join('')}</div>
        <details data-solid-sliders="${f.key}" style="margin-top:4px;"><summary class="muted" style="cursor:pointer;font-size:.8rem;">Ajustes finos (quantidade, tamanho, duração, velocidade, dispersão, altura, turbulência, opacidade, dissipação, cores)</summary><div data-solid-rows></div></details></div>`).join('') + `</div>`;
    colRight.append(solidBox);
    for (const f of SOLID_FAMILIES) {
      const rows = solidBox.querySelector(`[data-solid-sliders="${f.key}"] [data-solid-rows]`);
      for (const p of [...SOLID_SLIDERS, 'color', ...(f.colors > 1 ? ['color2'] : [])]) rows.append(tuning.controlFor(`vfx.${f.key}.${p}`));
    }
    const globalRow = solidBox.querySelector('[data-solid-global]');for (const p of ['vfx.solid.maxObjects', 'vfx.solid.quality']) globalRow.append(tuning.controlFor(p));
    const solidPreview = (key, what = 'dash') => {
      const fx = view.solid;if (!fx) return;
      if (what === 'compare') fx.compare(key, game.fighters, key.startsWith('solidRun') ? 'run' : 'dash');else fx.preview(key, game.fighters, what);
    };
    for (const b of solidBox.querySelectorAll('[data-solid-variant]')) b.onclick = () => {
      const [key, v] = b.dataset.solidVariant.split(':'), fam = SOLID_FAMILIES.find(f => f.key === key);
      tuning.commit([[`vfx.${key}.variant`, Number(v)]], `${fam.label}: ${fam.names[Number(v)].split(':')[0]}`);
      solidPreview(key, fam.previews ? (key.startsWith('solidRun') ? 'run' : 'dash') : 'dash');
    };
    for (const b of solidBox.querySelectorAll('[data-solid-prev]')) b.onclick = () => {const [key, what] = b.dataset.solidPrev.split(':');solidPreview(key, what);};
    for (const b of solidBox.querySelectorAll('[data-solid-combo-prev]')) b.onclick = () => view.solid?.preview('all', game.fighters, b.dataset.solidComboPrev);
    for (const c of solidBox.querySelectorAll('[data-solid-on]')) c.onchange = () => tuning.commit([[`vfx.${c.dataset.solidOn}.enabled`, c.checked ? 1 : 0]], 'Efeito 3D ' + c.dataset.solidOn);
    solidBox.querySelector('[data-solid-master]').onchange = e => tuning.commit([['vfx.solid.enabled', e.target.checked ? 1 : 0]], 'Efeitos 3D sólidos');
    const updateVfxModeButtons = () => {
      const legBtn = renderModeBox.querySelector('[data-vfx-runtime-btn="legacy"]');
      const newBtn = renderModeBox.querySelector('[data-vfx-runtime-btn="new"]');
      const hint = renderModeBox.querySelector('#vfx-runtime-hint');
      if (legBtn) legBtn.setAttribute('aria-pressed', String(!view.useNewVfx));
      if (newBtn) newBtn.setAttribute('aria-pressed', String(view.useNewVfx));
      if (hint) {
        hint.textContent = view.useNewVfx
          ? 'Ativo: VfxRuntime com instanciamento único, BeamRenderer dedicado (núcleo incondicional, halo aditivo) e variantes A/B/C.'
          : 'Ativo: renderizador legado. O novo sistema está em repouso como fallback seguro.';
      }
    };
    renderModeBox.querySelector('[data-vfx-runtime-btn="legacy"]')?.addEventListener('click', () => {
      view.useNewVfx = false;
      updateVfxModeButtons();
    });
    renderModeBox.querySelector('[data-vfx-runtime-btn="new"]')?.addEventListener('click', () => {
      view.useNewVfx = true;
      updateVfxModeButtons();
    });
    
    for (const b of renderModeBox.querySelectorAll('[data-global-vfx]')) {
      b.onclick = () => {
        const v = Number(b.dataset.globalVfx) || 0;
        const changes = [];
        for (const [t] of VFX_TYPES) {
          if (C.vfx[t] && C.vfx[t].variant !== v) {
            changes.push([`vfx.${t}.variant`, v]);
          }
        }
        if (changes.length) {
          tuning.commit(changes, 'Estilo Global VFX ' + ['A', 'B', 'C'][v]);
        }
        for (const [t] of VFX_TYPES) {
          view.vfxRuntime?.setVariant?.(t, v);
        }
        for (const x of renderModeBox.querySelectorAll('[data-global-vfx]')) {
          x.setAttribute('aria-pressed', String(x === b));
        }
      };
    }
    
    for (const b of renderModeBox.querySelectorAll('[data-laser-preview]')) {
      b.onclick = () => {
        const pl = Number(b.dataset.laserPreview) || 1;
        view.vfxRuntime.beamRenderer?.setConfig({pl});
        view.vfxRuntime.preview('laser', game.fighters);
      };
    }
    for (const b of renderModeBox.querySelectorAll('[data-sim-laser]')) {
      b.onclick = () => {
        const pl = Number(b.dataset.simLaser) || 1;
        if (game.phase !== 'playing') game.startMatch?.('center');
        const [blue, red] = game.fighters;
        const dx = blue.position.x - red.position.x, dz = blue.position.z - red.position.z, d = Math.hypot(dx, dz) || 1;
        spawn(game.world, {
          kind: 'beam', owner: 1, pos: {x: red.position.x + dx / d * .7, z: red.position.z + dz / d * .7},
          dir: {x: dx / d, z: dz / d}, life: 4, pl, length: 24, maxSegments: 8, interval: 0.25,
          hit: {damage: 2}
        }, game.lastStepEvents);
      };
    }
    for (const b of renderModeBox.querySelectorAll('[data-sim-scene]')) {
      b.onclick = () => {
        const sc = b.dataset.simScene;
        if (game.phase !== 'playing') game.startMatch?.('center');
        if (sc === 'reflect') {
          spawn(game.world, {kind: 'wall', reflect: true, owner: 0, pos: {x: 0, z: 0}, height: 2.2, hx: 2.5, hz: 0.1, angle: 0, life: 8, age: 0, pl: 1}, game.lastStepEvents);
          spawn(game.world, {kind: 'beam', owner: 1, pos: {x: 0, z: 5}, dir: {x: 0, z: -1}, life: 4, pl: 1, length: 24, maxSegments: 8, interval: 0.25, hit: {damage: 2}}, game.lastStepEvents);
        } else if (sc === 'neutralize') {
          spawn(game.world, {kind: 'wall', reflect: true, owner: 0, pos: {x: 0, z: 0}, height: 2.2, hx: 2.5, hz: 0.1, angle: 0, life: 8, age: 0, pl: 1}, game.lastStepEvents);
          spawn(game.world, {kind: 'beam', owner: 1, pos: {x: 0, z: 5}, dir: {x: 0, z: -1}, life: 4, pl: 3, length: 24, maxSegments: 8, interval: 0.25, hit: {damage: 2}}, game.lastStepEvents);
        }
      };
    }
    // Manipuladores de Rochas (Psyshock)
    for (const b of renderModeBox.querySelectorAll('[data-rock-style]')) {
      b.onclick = () => {
        const v = Number(b.dataset.rockStyle) || 0;
        tuning.commit([['vfx.rock.variant', v]], 'Modelo de Rocha ' + ['Boulder', 'Cristal', 'Meteorito'][v]);
        view.vfxRuntime?.setVariant?.('rock', v);
        for (const x of renderModeBox.querySelectorAll('[data-rock-style]')) x.setAttribute('aria-pressed', String(x === b));
      };
    }
    for (const b of renderModeBox.querySelectorAll('[data-rock-preview]')) {
      b.onclick = () => {
        const pl = Number(b.dataset.rockPreview) || 1;
        const [blue, red] = game.fighters;
        const target = red || blue;
        if (view.useNewVfx) view.vfxRuntime.preview('rock', game.fighters);
        else view.vfx.preview('rock', game.fighters);
        view.worldView?.emitRockShatter?.(target.position.x, 0.8, target.position.z, {x: 0, z: 1}, [0x59d6e6, 0xffcf6a, 0xff6adf][pl - 1]);
      };
    }
    for (const b of renderModeBox.querySelectorAll('[data-sim-rock]')) {
      b.onclick = () => {
        const act = b.dataset.simRock;
        if (game.phase !== 'playing') game.startMatch?.('center');
        const [blue, red] = game.fighters;
        if (act === 'shatter') {
          const mid = {x: (blue.position.x + red.position.x) / 2, z: (blue.position.z + red.position.z) / 2};
          view.worldView?.emitRockShatter?.(mid.x, 0.8, mid.z, {x: 0, z: 1}, 0x59d6e6);
          view.vfx.fire('rock', {pos: mid, n: {x: 0, z: 1}, power: 1.5}, 'estilhaçamento manual');
        } else {
          const dx = red.position.x - blue.position.x, dz = red.position.z - blue.position.z, d = Math.hypot(dx, dz) || 1;
          const count = 4;
          for (let i = 0; i < count; i++) {
            const angle = Math.atan2(dx, dz) + (i - (count - 1) / 2) * 0.18;
            const dir = {x: Math.sin(angle), z: Math.cos(angle)};
            spawn(game.world, {
              kind: 'projectile', owner: 0, pos: {x: blue.position.x + dir.x * 0.9, z: blue.position.z + dir.z * 0.9},
              y: 0.65 + i * 0.15, radius: 0.22, speed: 13, dir, vy: 0, life: 6, pierce: 1, blockedBy: ['barrier', 'wall'],
              hit: {damage: 6, knockback: {horizontal: 1.8, vertical: 0}}, pl: 2, clashable: true, visualScale: 1.0,
              captured: {attackFraction: 0.2, successiveFactor: 0.8, knockbackCap: 4, knockbackPerStone: 1.8, counterStagger: 0.25, level: 2, move: 'psyshock', speed: 13}
            }, game.lastStepEvents);
          }
        }
      };
    }
    // Manipuladores de Barreira (Reflect)
    for (const b of renderModeBox.querySelectorAll('[data-barrier-style]')) {
      b.onclick = () => {
        const v = Number(b.dataset.barrierStyle) || 0;
        tuning.commit([['vfx.barrier.variant', v]], 'Estilo da Barreira ' + ['Hex-Grid', 'Cristal', 'Campo de Força'][v]);
        view.vfxRuntime?.setVariant?.('barrier', v);
        for (const x of renderModeBox.querySelectorAll('[data-barrier-style]')) x.setAttribute('aria-pressed', String(x === b));
      };
    }
    for (const b of renderModeBox.querySelectorAll('[data-barrier-preview]')) {
      b.onclick = () => {
        const [blue] = game.fighters;
        if (view.useNewVfx) view.vfxRuntime.preview('barrier', game.fighters);
        else view.vfx.preview('barrier', game.fighters);
        view.worldView?.emitBarrierShatter?.(blue.position.x, 0.8, blue.position.z, 0x59d6e6);
      };
    }
    for (const b of renderModeBox.querySelectorAll('[data-sim-barrier]')) {
      b.onclick = () => {
        const act = b.dataset.simBarrier;
        if (game.phase !== 'playing') game.startMatch?.('center');
        const [blue, red] = game.fighters;
        if (act === 'spawn') {
          const dir = {x: Math.sin(blue.facing), z: Math.cos(blue.facing)};
          spawn(game.world, {
            kind: 'barrier', owner: 0, shape: 'box', pos: {x: blue.position.x + dir.x * 1.2, z: blue.position.z + dir.z * 1.2},
            angle: blue.facing, hx: 1.5, hz: 0.05, y: 0, height: 2.4, life: 10, hp: Infinity,
            blocksProjectiles: true, blocksFighters: true, blocksOwner: true, reflect: true, shields: true, breakableByTackle: true, pl: 2,
            captured: {tackleRecoil: 0.15, tackleStagger: 0.25, tieTolerance: 0.001, maxReflections: 16}
          }, game.lastStepEvents);
        } else if (act === 'shatter') {
          const mid = {x: (blue.position.x + red.position.x) / 2, z: (blue.position.z + red.position.z) / 2};
          spawn(game.world, {
            kind: 'barrier', owner: 1, shape: 'box', pos: mid, angle: 0, hx: 1.8, hz: 0.05, y: 0, height: 2.4, life: 10, hp: Infinity,
            blocksProjectiles: true, blocksFighters: true, blocksOwner: true, reflect: true, shields: true, breakableByTackle: true, pl: 1,
            captured: {tackleRecoil: 0.15, tackleStagger: 0.25, tieTolerance: 0.001, maxReflections: 16}
          }, game.lastStepEvents);
          blue.action = {kind: 'tackle', heading: Math.atan2(mid.x - blue.position.x, mid.z - blue.position.z), duration: 0.5, elapsed: 0, canCancel: true};
        }
      };
    }
    // Acessibilidade
    for (const inp of renderModeBox.querySelectorAll('[data-vfx-a11y]')) {
      inp.onchange = () => {
        const key = inp.dataset.vfxA11y;
        const val = inp.checked ? 1 : 0;
        tuning.commit([
          [`vfx.master.${key}`, val],
          [`vfx.laser.${key}`, val]
        ], 'Acessibilidade ' + key);
        const a = {[key]: !!val};
        view.setAccessibility?.(a);
        view.vfx?.setAccessibility?.(a);
        view.vfxRuntime?.setAccessibility?.(a);
        view.worldView?.setAccessibility?.(a);
      };
    }
    // Modo simples (toggle, variante, intensidade principal, prévia) e avançado (todos os parâmetros). Mesmos parâmetros.
    const bar = document.createElement('div');bar.className = 'vfx-bar';
    bar.innerHTML = `<div class="seg wide" role="group" aria-label="Modo dos efeitos"><button type="button" data-vfx-mode-btn="simple">Simples</button><button type="button" data-vfx-mode-btn="advanced">Avançado</button></div>
      <div class="seg wide" role="group" aria-label="Filtro dos efeitos">${[['all', 'Todos'], ['active', 'Ativos'], ['changed', 'Alterados'], ['costly', 'Mais caros']].map(([v, t]) => `<button type="button" data-vfx-filter="${v}">${t}</button>`).join('')}</div><p class="hint" id="vfx-filter-info"></p>`;
    colMid.append(bar);
    const simple = document.createElement('div');simple.className = 'vfx-simple';simple.dataset.vfxMode = 'simple';
    const CORE_VFX = VFX_TYPES.filter(([t]) => t !== 'rock' && t !== 'barrier');
    for (const [type, label] of CORE_VFX) {
      const row = document.createElement('div');row.className = 'vfx-simple-row';row.dataset.vfxType = type;
      const head = document.createElement('div');head.className = 'vfx-simple-head';head.innerHTML = `<b>${escape(label)}</b><span class="muted" data-cost></span>`;
      const pv = document.createElement('button');pv.type = 'button';pv.textContent = '▶';pv.title = 'Prévia';pv.dataset.preview = `vfx.${type}`;
      pv.onclick = () => {
        view.vfxRuntime.setVariant(type, C.vfx[type]?.variant || 0);
        if (view.useNewVfx) view.vfxRuntime.preview(type, game.fighters);
        else view.vfx.preview(type, game.fighters);
      };
      const adv = document.createElement('button');adv.type = 'button';adv.textContent = 'Avançado ▸';adv.title = 'Todos os parâmetros deste efeito';adv.onclick = () => {setMode('advanced');const g = root.querySelector(`[data-group="vfx-${type}"]`);g?.setOpen?.(true);g?.scrollIntoView({block: 'start'});};
      head.append(pv, adv);row.append(head, ...[`vfx.${type}.enabled`, `vfx.${type}.variant`, `vfx.${type}.${MAIN[type]}`].map(p => tuning.controlFor(p)));simple.append(row);
    }
    colMid.append(simple);
    const advanced = document.createElement('div');advanced.dataset.vfxMode = 'advanced';
    advanced.append(group('Geral dos efeitos', 'vfx-master', tuning.sectionControls('VFX · geral')));
    const laserRows = tuning.sectionControls('VFX · Laser da Arena (BeamRenderer)');
    advanced.append(group('Laser da Arena (BeamRenderer)', 'vfx-laser', laserRows, [actions('vfx.laser', 'Laser da Arena', () => vfxDefaults().laser, () => view.vfxRuntime.preview('laser', game.fighters))], false));
    for (const [type, label] of VFX_TYPES) {
      const rows = tuning.sectionControls(`VFX · ${label}`), g = group(label, `vfx-${type}`, rows, [actions(`vfx.${type}`, label, () => vfxDefaults()[type], () => {
        view.vfxRuntime.setVariant(type, C.vfx[type]?.variant || 0);
        if (view.useNewVfx) view.vfxRuntime.preview(type, game.fighters);
        else view.vfx.preview(type, game.fighters);
      })]);
      g.dataset.vfxType = type;advanced.append(g);
    }
    colMid.append(advanced);
    for (const b of bar.querySelectorAll('[data-vfx-mode-btn]')) b.onclick = () => setMode(b.dataset.vfxModeBtn);
    for (const b of bar.querySelectorAll('[data-vfx-filter]')) b.onclick = () => setFilter(b.dataset.vfxFilter);
    setMode(state.mode);setFilter(state.filter);
    const extraFold = document.createElement('details');extraFold.className = 'vfx-extra-fold';extraFold.innerHTML = '<summary><b>Tremor, Sombras, Câmera, HUD & Indicadores</b></summary>';
    const extraGrid = document.createElement('div');extraGrid.className = 'vfx-extra-grid';extraFold.append(extraGrid);colMid.append(extraFold);
    extraGrid.append(group('Geral dos tremores', 'shake-master', tuning.sectionControls('Tremor · geral')));
    for (const [key, label] of SHAKE_EVENTS) {
      const rows = tuning.sectionControls(`Tremor · ${label}`), n = {x: 0, z: 1};
      extraGrid.append(group(label, key, rows, [actions(`vfx.${key}`, label, () => vfxDefaults()[key], () => {view.vfx.shake(key, n, 1, 'prévia manual');})]));
    }
    const shadowRows = [...tuning.sectionControls('Sombras'), tuning.controlFor('extras.visual.shadowHeightFade'), tuning.controlFor('extras.visual.shadowMin')];
    extraGrid.append(group('Estilo e forma da sombra', 'shadow', shadowRows, [actions('display.shadow', 'Sombras', () => displayDefaults().shadow)], false));
    extraGrid.append(group('Câmera', 'camera', tuning.sectionControls('Câmera')), group('Câmera: ajustes avançados', 'camera-extra', tuning.sectionControls('Câmera: ajustes avançados')));
    const demo = document.createElement('div');demo.className = 'row';
    for (let i = 0; i < 4; i++) {const b = document.createElement('button');b.type = 'button';b.textContent = `Disparar demo ${i + 1}`;b.dataset.demo = i;b.onclick = () => hud.triggerDemo(i);demo.append(b);}
    extraGrid.append(group('Propostas de HUD', 'hud', tuning.sectionControls('HUD'), [demo], false));
    extraGrid.append(group('Altura visual (blocos e modelos)', 'grounding', tuning.sectionControls('Altura visual')), group('Indicador da janela C → X', 'cancel-ring', tuning.sectionControls('Indicador da janela C → X'),
      [Object.assign(document.createElement('p'), {className: 'hint', textContent: 'A reativação do tackle durante a esquiva é decidida por TEMPO (início e fim da janela, em Ajustes › X e C). Não há círculo de distância nas regras: este anel só desenha a janela. Ver relatório técnico.'})]));
    const dbg = document.createElement('div');dbg.id = 'vfx-debug';dbg.className = 'report';extraGrid.append(dbg);
  }
  function live() {
    const box = $('vfx-debug');if (!box || box.closest('[hidden]')) return;
    const v = view.useNewVfx ? view.vfxRuntime : view.vfx;
    const rows = v.log ? v.log.slice(-18).reverse() : [];
    const beams = view.useNewVfx ? ` · ${v.stats.beamsActive ?? 0} lasers ativos` : '';
    box.innerHTML = `<p class="muted">${v.stats.active ?? 0} partículas ativas · pico ${v.stats.peak} · ${v.stats.spawned} criadas${beams} · limite ${C.vfx.master.maxParticles}</p><table><tr><th>t</th><th>Efeito</th><th>Var.</th><th>Motivo do disparo</th></tr>${rows.map(e => `<tr><td>${e.t.toFixed(2)}</td><td>${escape(e.effect)}</td><td>${e.variant}</td><td>${escape(e.action || e.reason)}</td></tr>`).join('')}</table>`;
  }
  render();
  tuning.onChange(() => {
    if (state.filter !== 'all') setFilter(state.filter);
    for (const [t] of VFX_TYPES) {
      if (C.vfx[t] && C.vfx[t].variant != null) {
        view.vfxRuntime.setVariant(t, C.vfx[t].variant);
      }
    }
    const a11y = {
      noFlash: !!(C.vfx.master?.noFlash || C.vfx.laser?.noFlash),
      reduceMotion: !!(C.vfx.master?.reduceMotion || C.vfx.laser?.reduceMotion),
      highContrast: !!(C.vfx.master?.highContrast || C.vfx.laser?.highContrast),
    };
    view.setAccessibility?.(a11y);
    view.vfx?.setAccessibility?.(a11y);
    view.vfxRuntime?.setAccessibility?.(a11y);
    view.worldView?.setAccessibility?.(a11y);

    for (const b of root.querySelectorAll('[data-solid-variant]')) {const [k, v] = b.dataset.solidVariant.split(':');b.setAttribute('aria-pressed', String((C.vfx[k]?.variant | 0) === Number(v)));}
    for (const c of root.querySelectorAll('[data-solid-on]')) c.checked = !!C.vfx[c.dataset.solidOn]?.enabled;
    const sm = root.querySelector('[data-solid-master]');if (sm) sm.checked = !!C.vfx.solid?.enabled;
    const activeVar = C.vfx.hit?.variant ?? 0;
    for (const x of root.querySelectorAll('[data-global-vfx]')) {
      x.setAttribute('aria-pressed', String(Number(x.dataset.globalVfx) === activeVar));
    }
    if (C.vfx.laser && view.vfxRuntime.beamRenderer) {
      view.vfxRuntime.beamRenderer.setConfig(C.vfx.laser);
      view.vfxRuntime.beamRenderer.setQuality(['low', 'medium', 'high'][C.vfx.laser.quality] || 'medium');
    }
  });
  return {render, live, setMode, setFilter, get vfxMode() {return state.mode;}};
}
