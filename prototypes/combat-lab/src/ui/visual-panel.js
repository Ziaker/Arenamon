// Aba Visualizar: efeitos visuais (três variantes cada), sombras, tremor de câmera, câmera, HUD, altura visual,
// indicador da janela C → X e depuração dos disparos de VFX. Todos os controles são do ajustador (desfazer,
// presets e exportação); nenhum altera regras de combate.
import {C, vfxDefaults, displayDefaults} from '../sim/config.js';
import {spawn} from '../sim/world.js';
import {VFX_TYPES, SHAKE_EVENTS} from '../view/vfx.js';
import {fold} from './characters-panel.js';
import {escape} from './tuning.js';

/** Parâmetro principal de cada efeito no modo simples. */
const MAIN = {hit: 'intensity', dodge: 'intensity', sprint: 'intensity', block: 'intensity', perfect: 'intensity', ground: 'intensity', clash: 'intensity', exhaust: 'glow', regen: 'intensity'};
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
      const t = el.dataset.vfxType, show = f === 'all' || (f === 'active' && C.vfx.master.enabled && C.vfx[t].enabled) || (f === 'changed' && changed(t)) || (f === 'costly' && top.includes(t));
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
    const h = (t, hint) => {const e = document.createElement('h3');e.textContent = t;root.append(e);if (hint) {const p = document.createElement('p');p.className = 'hint';p.textContent = hint;root.append(p);}};
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
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <span class="muted" style="font-size:0.85rem;">Prévia Rápida:</span>
        <button type="button" data-laser-preview="1">▶ Laser PL1 (Ciano)</button>
        <button type="button" data-laser-preview="2">▶ Laser PL2 (Dourado)</button>
        <button type="button" data-laser-preview="3">▶ Laser PL3 (Magenta)</button>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px;">
        <span class="muted" style="font-size:0.85rem;">Simulação Física Real (Dano e Colisão):</span>
        <button type="button" data-sim-laser="1">⚡ Laser Real PL1</button>
        <button type="button" data-sim-laser="2">⚡ Laser Real PL2</button>
        <button type="button" data-sim-laser="3">⚡ Laser Real PL3</button>
        <button type="button" data-sim-scene="reflect">⚡ Testar Reflexão Real</button>
        <button type="button" data-sim-scene="neutralize">⚡ Testar Neutralização Real</button>
      </div>
    `;
    root.append(renderModeBox);
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
    // Modo simples (toggle, variante, intensidade principal, prévia) e avançado (todos os parâmetros). Mesmos parâmetros.
    const bar = document.createElement('div');bar.className = 'vfx-bar';
    bar.innerHTML = `<div class="seg wide" role="group" aria-label="Modo dos efeitos"><button type="button" data-vfx-mode-btn="simple">Simples</button><button type="button" data-vfx-mode-btn="advanced">Avançado</button></div>
      <div class="seg wide" role="group" aria-label="Filtro dos efeitos">${[['all', 'Todos'], ['active', 'Ativos'], ['changed', 'Alterados'], ['costly', 'Mais caros']].map(([v, t]) => `<button type="button" data-vfx-filter="${v}">${t}</button>`).join('')}</div><p class="hint" id="vfx-filter-info"></p>`;
    root.append(bar);
    const simple = document.createElement('div');simple.className = 'vfx-simple';simple.dataset.vfxMode = 'simple';
    for (const [type, label] of VFX_TYPES) {
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
    root.append(simple);
    const advanced = document.createElement('div');advanced.dataset.vfxMode = 'advanced';
    advanced.append(group('Geral dos efeitos', 'vfx-master', tuning.sectionControls('VFX · geral')));
    const laserRows = tuning.sectionControls('VFX · Laser da Arena (BeamRenderer)');
    advanced.append(group('Laser da Arena (BeamRenderer)', 'vfx-laser', laserRows, [actions('vfx.laser', 'Laser da Arena', () => vfxDefaults().laser, () => view.vfxRuntime.preview('laser', game.fighters))], true));
    for (const [type, label] of VFX_TYPES) {
      const rows = tuning.sectionControls(`VFX · ${label}`), g = group(label, `vfx-${type}`, rows, [actions(`vfx.${type}`, label, () => vfxDefaults()[type], () => {
        view.vfxRuntime.setVariant(type, C.vfx[type]?.variant || 0);
        if (view.useNewVfx) view.vfxRuntime.preview(type, game.fighters);
        else view.vfx.preview(type, game.fighters);
      })]);
      g.dataset.vfxType = type;advanced.append(g);
    }
    root.append(advanced);
    for (const b of bar.querySelectorAll('[data-vfx-mode-btn]')) b.onclick = () => setMode(b.dataset.vfxModeBtn);
    for (const b of bar.querySelectorAll('[data-vfx-filter]')) b.onclick = () => setFilter(b.dataset.vfxFilter);
    setMode(state.mode);setFilter(state.filter);
    h('Tremor de câmera', 'Transformação visual temporária da câmera, aplicada depois do posicionamento: não muda a direção de movimento, o referencial das setas nem a física.');
    root.append(group('Geral dos tremores', 'shake-master', tuning.sectionControls('Tremor · geral')));
    for (const [key, label] of SHAKE_EVENTS) {
      const rows = tuning.sectionControls(`Tremor · ${label}`), n = {x: 0, z: 1};
      root.append(group(label, key, rows, [actions(`vfx.${key}`, label, () => vfxDefaults()[key], () => {view.vfx.shake(key, n, 1, 'prévia manual');})]));
    }
    h('Sombras');
    const shadowRows = [...tuning.sectionControls('Sombras'), tuning.controlFor('extras.visual.shadowHeightFade'), tuning.controlFor('extras.visual.shadowMin')];
    root.append(group('Estilo e forma da sombra', 'shadow', shadowRows, [actions('display.shadow', 'Sombras', () => displayDefaults().shadow)], true));
    h('Câmera');
    root.append(group('Câmera', 'camera', tuning.sectionControls('Câmera')), group('Câmera: ajustes avançados', 'camera-extra', tuning.sectionControls('Câmera: ajustes avançados')));
    h('HUD', 'Três propostas funcionais para comparação (A Arcade Vector, B Combat Halo, C Tactical Combat) com os mesmos dados reais. Os quatro cooldowns são SÓ DEMONSTRAÇÃO: não existem movimentos, nomes ou tempos oficiais.');
    const demo = document.createElement('div');demo.className = 'row';
    for (let i = 0; i < 4; i++) {const b = document.createElement('button');b.type = 'button';b.textContent = `Disparar demo ${i + 1}`;b.dataset.demo = i;b.onclick = () => hud.triggerDemo(i);demo.append(b);}
    root.append(group('Propostas de HUD', 'hud', tuning.sectionControls('HUD'), [demo], true));
    h('Altura visual e indicadores');
    root.append(group('Altura visual (blocos e modelos)', 'grounding', tuning.sectionControls('Altura visual')), group('Indicador da janela C → X', 'cancel-ring', tuning.sectionControls('Indicador da janela C → X'),
      [Object.assign(document.createElement('p'), {className: 'hint', textContent: 'A reativação do tackle durante a esquiva é decidida por TEMPO (início e fim da janela, em Ajustes › X e C). Não há círculo de distância nas regras: este anel só desenha a janela. Ver relatório técnico.'})]));
    h('Depuração dos efeitos');
    const dbg = document.createElement('div');dbg.id = 'vfx-debug';dbg.className = 'report';root.append(dbg);
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
    if (C.vfx.laser && view.vfxRuntime.beamRenderer) {
      view.vfxRuntime.beamRenderer.setConfig(C.vfx.laser);
      view.vfxRuntime.beamRenderer.setQuality(['low', 'medium', 'high'][C.vfx.laser.quality] || 'medium');
    }
  });
  return {render, live, setMode, setFilter, get vfxMode() {return state.mode;}};
}
