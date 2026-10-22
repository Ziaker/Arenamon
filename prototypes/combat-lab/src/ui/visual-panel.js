// Aba Visualizar: efeitos visuais (três variantes cada), sombras, tremor de câmera, câmera, HUD, altura visual,
// indicador da janela C → X e depuração dos disparos de VFX. Todos os controles são do ajustador (desfazer,
// presets e exportação); nenhum altera regras de combate.
import {C, vfxDefaults, displayDefaults} from '../sim/config.js';
import {spawn} from '../sim/world.js';
import {VFX_TYPES, SHAKE_EVENTS} from '../view/vfx.js';
import {SOLID_FAMILIES} from '../view/solid-fx.js';
import {PASSIVE_ABILITIES} from '../view/passive-abilities.js';
import {fold} from './characters-panel.js';
import {escape, pathGet as pathGetRoot} from './tuning.js';

/** Parâmetro principal de cada efeito no modo simples. */
const MAIN = {hit: 'intensity', dodge: 'intensity', sprint: 'intensity', block: 'intensity', perfect: 'intensity', ground: 'intensity', clash: 'intensity', exhaust: 'glow', regen: 'intensity', rock: 'scale', barrier: 'opacity'};
export function createVisualPanel({tuning, view, game, $, hud, download}) {
  const root = $('visual-panel'), state = {mode: 'advanced', filter: 'all', sel: null}, api = {};
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
    root.className = 'vx';
    // Layout em seções empilhadas (tudo visível, sem colunas apertadas), com atalhos fixos no topo.
    const SECS = [
      ['geral', 'Geral', 'Só aparência: nada aqui muda regras, tempos da simulação, invulnerabilidade ou cooldowns. Ctrl+Z desfaz; presets e exportação incluem tudo.'],
      ['combate', 'Efeitos de combate', 'Impacto, esquiva, sprint, bloqueio, clash, exaustão e regeneração. Cada efeito tem 3 variantes, liga/desliga, prévia e preset.'],
      ['3d', 'Movimento 3D', 'Malhas com volume real que giram com a câmera. O estilo marcado é exatamente o usado na luta; clicar já mostra a prévia.'],
      ['rochas', 'Rochas (Psyshock)', 'Modelo da pedra, rastro e estilhaços.'],
      ['barreira', 'Barreira (Reflect)', 'Estilo, brilho, pulsação e quebra da barreira.'],
      ['laser', 'Laser da arena', 'Prévias visuais e disparos reais na simulação.'],
      ['extras', 'Câmera, tremor e HUD', 'Tremores, sombras, câmera, HUD, altura visual e depuração.'],
    ];
    const nav = document.createElement('nav');nav.className = 'vx-nav';nav.setAttribute('aria-label', 'Seções de Visualizar');
    const SHORT = {combate: 'Combate', extras: 'Câmera e HUD', rochas: 'Rochas', barreira: 'Barreira'};
    nav.innerHTML = SECS.map(([id, t]) => `<button type="button" data-vx-go="${id}">${escape(SHORT[id] ?? t)}</button>`).join('');root.append(nav);
    const S = {};
    for (const [id, title, hint] of SECS) {
      const s = document.createElement('section');s.className = 'vx-sec';s.id = 'vx-' + id;
      s.innerHTML = `<h3>${escape(title)}</h3><p class="hint">${escape(hint)}</p>`;root.append(s);S[id] = s;
    }
    for (const b of nav.querySelectorAll('[data-vx-go]')) b.onclick = () => {
      for (const x of nav.querySelectorAll('[data-vx-go]')) x.removeAttribute('aria-current');b.setAttribute('aria-current', 'true');
      S[b.dataset.vxGo].scrollIntoView({block: 'start', behavior: 'smooth'});
    };
    const pressed = on => `aria-pressed="${on ? 'true' : 'false'}"`;
    S.geral.insertAdjacentHTML('beforeend', `<div class="vx-grid">
      <div class="vx-card"><h4>Renderizador de VFX</h4>
        <div class="seg wide" role="group" aria-label="Renderizador de VFX">
          <button type="button" data-vfx-runtime-btn="legacy" ${pressed(!view.useNewVfx)}>Legado (v6)</button>
          <button type="button" data-vfx-runtime-btn="new" ${pressed(view.useNewVfx)}>VfxRuntime + Laser</button>
        </div>
        <p class="hint" id="vfx-runtime-hint">${view.useNewVfx ? 'Ativo: VfxRuntime com instanciamento único, BeamRenderer dedicado (núcleo incondicional, halo aditivo) e variantes A/B/C.' : 'Ativo: renderizador legado. O novo sistema está em repouso como fallback seguro.'}</p>
      </div>
      <div class="vx-card"><h4>Estilo global dos efeitos de combate</h4>
        <div class="seg wide" role="group" aria-label="Estilo Global">
          <button type="button" data-global-vfx="0" ${pressed(C.vfx.hit?.variant === 0)}>A · Arcade</button>
          <button type="button" data-global-vfx="1" ${pressed(C.vfx.hit?.variant === 1)}>B · Cinematic</button>
          <button type="button" data-global-vfx="2" ${pressed(C.vfx.hit?.variant === 2)}>C · Tático</button>
        </div>
        <p class="hint">Aplica a mesma variante a todos os efeitos de combate de uma vez.</p>
      </div>
      <div class="vx-card"><h4>Acessibilidade visual</h4>
        <label class="vx-check"><input type="checkbox" data-vfx-a11y="noFlash" ${(C.vfx.master?.noFlash || C.vfx.laser?.noFlash) ? 'checked' : ''}> Sem flash</label>
        <label class="vx-check"><input type="checkbox" data-vfx-a11y="reduceMotion" ${(C.vfx.master?.reduceMotion || C.vfx.laser?.reduceMotion) ? 'checked' : ''}> Reduzir movimento</label>
        <label class="vx-check"><input type="checkbox" data-vfx-a11y="highContrast" ${(C.vfx.master?.highContrast || C.vfx.laser?.highContrast) ? 'checked' : ''}> Alto contraste</label>
      <div class="vx-card"><h4>Camada three.quarks (experimental)</h4>
        <div data-quarks-toggle></div>
        <p class="hint">Partículas GPU para carga (A), impacto (B), pouso (C) e footstool. Roda AO LADO do VFX atual — comparação A/B sem substituir efeitos aprovados. Edite os efeitos no laboratório VFX · Quarks (portal de testes). Ajuste fino: Ajustes › VFX · three.quarks.</p>
      </div>
      </div></div>`);
    S.rochas.insertAdjacentHTML('beforeend', `<div class="vx-card vx-wide"><h4>Modelo da pedra</h4>
        <div class="seg wide" role="group" aria-label="Modelo 3D da Rocha">
          <button type="button" data-rock-style="0" ${pressed(C.vfx.rock?.variant === 0)}>Boulder facetado</button>
          <button type="button" data-rock-style="1" ${pressed(C.vfx.rock?.variant === 1)}>Cristal psíquico</button>
          <button type="button" data-rock-style="2" ${pressed(C.vfx.rock?.variant === 2)}>Meteorito com runas</button>
        </div>
        <h4>Testar</h4>
        <div class="vx-btns"><button type="button" data-rock-preview="1">▶ Prévia PL1</button><button type="button" data-rock-preview="2">▶ Prévia PL2</button><button type="button" data-rock-preview="3">▶ Prévia PL3</button>
          <button type="button" data-sim-rock="1">⚡ Disparar pedras reais</button><button type="button" data-sim-rock="shatter">💥 Testar estilhaçamento</button></div></div>`);
    S.barreira.insertAdjacentHTML('beforeend', `<div class="vx-card vx-wide"><h4>Estilo da barreira</h4>
        <div class="seg wide" role="group" aria-label="Estilo da Barreira">
          <button type="button" data-barrier-style="0" ${pressed(C.vfx.barrier?.variant === 0)}>Hex-grid ciclado</button>
          <button type="button" data-barrier-style="1" ${pressed(C.vfx.barrier?.variant === 1)}>Cristal prismático</button>
          <button type="button" data-barrier-style="2" ${pressed(C.vfx.barrier?.variant === 2)}>Campo de força puro</button>
        </div>
        <h4>Testar</h4>
        <div class="vx-btns"><button type="button" data-barrier-preview="1">▶ Prévia</button><button type="button" data-sim-barrier="spawn">⚡ Materializar barreira real</button><button type="button" data-sim-barrier="shatter">💥 Testar quebra por tackle</button></div></div>`);
    S.laser.insertAdjacentHTML('beforeend', `<div class="vx-card vx-wide"><h4>Prévia visual</h4>
        <div class="vx-btns"><button type="button" data-laser-preview="1">▶ PL1 · ciano</button><button type="button" data-laser-preview="2">▶ PL2 · dourado</button><button type="button" data-laser-preview="3">▶ PL3 · magenta</button></div>
        <h4>Disparo real na simulação</h4>
        <div class="vx-btns"><button type="button" data-sim-laser="1">⚡ Laser PL1</button><button type="button" data-sim-laser="2">⚡ Laser PL2</button><button type="button" data-sim-laser="3">⚡ Laser PL3</button>
          <button type="button" data-sim-scene="reflect">⚡ Reflexão real</button><button type="button" data-sim-scene="neutralize">⚡ Neutralização real</button></div></div>`);
    const renderModeBox = root;
    // ---------- VFX 3D sólidos: malhas com volume real; por família: estilo, prévias, comparação e sliders ----------
    const solidBox = document.createElement('div');solidBox.className = 'vfx-solid-box';solidBox.dataset.solidBox = '1';
    const SOLID_SLIDERS = ['intensity', 'amount', 'size', 'duration', 'velocity', 'scatter', 'lift', 'turbulence', 'opacity', 'fadeStart', 'fadeEnd'];
    solidBox.innerHTML = `<div class="vx-toolbar"><label class="vx-check"><input type="checkbox" data-solid-master ${C.vfx.solid?.enabled ? 'checked' : ''}> Efeitos 3D ligados</label>
        <span class="vx-sep"></span><b>Poeira + vento juntos:</b><span class="vx-btns" data-solid-combo>${[['dash', 'Dash'], ['start', 'Arrancada'], ['run', 'Corrida'], ['turn', 'Curva'], ['stop', 'Parada']].map(([w, l]) => `<button type="button" data-solid-combo-prev="${w}">▶ ${l}</button>`).join('')}</span></div>
      <div class="vx-toolbar"><b>Limite e qualidade:</b><span class="vx-global" data-solid-global></span></div><div class="solid-families-grid">` +
      SOLID_FAMILIES.map(f => `<div class="vx-card" data-solid-family="${f.key}">
        <div class="vx-fam-head"><b>${escape(f.label)}</b><label class="vx-check"><input type="checkbox" data-solid-on="${f.key}" ${C.vfx[f.key]?.enabled ? 'checked' : ''}> ligado</label></div>
        <p class="hint">Dispara em: ${escape(f.trigger)}</p>
        <div class="vx-btns">${f.previews ? f.previews.map(([w, l]) => `<button type="button" data-solid-prev="${f.key}:${w}">▶ ${l}</button>`).join('') + `<button type="button" data-solid-prev="${f.key}:compare" title="Todos os estilos lado a lado, no mesmo movimento">▶ Comparar os ${f.names.length}</button>` : `<button type="button" data-solid-prev="${f.key}:dash">▶ Prévia</button>`}</div>
        <div class="vx-variants" role="group" aria-label="${escape(f.label)}">${f.names.map((n, v) => `<button type="button" data-solid-variant="${f.key}:${v}" aria-pressed="${(C.vfx[f.key]?.variant | 0) === v}" title="${escape(n)}">${escape(n)}</button>`).join('')}</div>
        <details data-solid-sliders="${f.key}"><summary>Ajustes finos</summary><div class="vx-rows" data-solid-rows></div></details></div>`).join('') + `</div>`;
    S['3d'].append(solidBox);
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
        {const qt = S.geral.querySelector('[data-quarks-toggle]');if (qt) {try {qt.append(tuning.controlFor('vfx.quarks.enabled'));} catch (e) {qt.textContent = 'Controle indisponível: ' + e.message;}}}
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
    const advanced = document.createElement('div');advanced.dataset.vfxMode = 'advanced';
    advanced.append(group('Geral dos efeitos', 'vfx-master', tuning.sectionControls('VFX · geral')));
    const laserRows = tuning.sectionControls('VFX · Laser da Arena (BeamRenderer)');
    S.laser.append(group('Parâmetros do laser (BeamRenderer)', 'vfx-laser', laserRows, [actions('vfx.laser', 'Laser da Arena', () => vfxDefaults().laser, () => view.vfxRuntime.preview('laser', game.fighters))], true));
    for (const [type, label] of VFX_TYPES) {
      const rows = tuning.sectionControls(`VFX · ${label}`), g = group(label, `vfx-${type}`, rows, [actions(`vfx.${type}`, label, () => vfxDefaults()[type], () => {
        view.vfxRuntime.setVariant(type, C.vfx[type]?.variant || 0);
        if (view.useNewVfx) view.vfxRuntime.preview(type, game.fighters);
        else view.vfx.preview(type, game.fighters);
      })], type === 'rock' || type === 'barrier');
      if (type === 'rock' || type === 'barrier') S[type === 'rock' ? 'rochas' : 'barreira'].append(g);else {g.dataset.vfxType = type;advanced.append(g);}
    }
    S.combate.append(advanced);
    setMode(state.mode);
    const extraGrid = document.createElement('div');extraGrid.className = 'vx-folds';S.extras.append(extraGrid);
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
    const passiveDemo = document.createElement('div');passiveDemo.className = 'vx-btns';
    PASSIVE_ABILITIES.forEach((ability, kind) => {const b = document.createElement('button');b.type = 'button';b.textContent = `▶ ${ability.name}`;b.onclick = () => view.previewPassive(0, kind);passiveDemo.append(b);});
    const enemyPassive = document.createElement('button');enemyPassive.type = 'button';enemyPassive.textContent = '▶ Prévia do vermelho';enemyPassive.onclick = () => view.previewPassive(1, C.display.passive.enemyAbility);passiveDemo.append(enemyPassive);
    extraGrid.append(group('Habilidades passivas', 'passive-abilities', tuning.sectionControls('Habilidades passivas'), [passiveDemo], true));
    // Cenário "Laboratório técnico", HUD "Banco de Células" e consumíveis "Gemas Facetadas" (aprovados em 21/10/2026): só aparência, com alternância para o visual clássico.
    const hintP = t => Object.assign(document.createElement('p'), {className: 'hint', textContent: t});
    extraGrid.append(group('Cenário do laboratório', 'scenery', tuning.sectionControls('Cenário do laboratório'), [hintP('0 em “Cenário do laboratório” volta ao visual clássico cinza. As cores, luzes, espessura do piso, divisões do grid e altura das paredes (Ajustes › Visual) e o raio da arena (Ajustes › Mapa) continuam valendo.')], true));
    extraGrid.append(group('HUD de progressão (Banco de Células)', 'progress', tuning.sectionControls('HUD de progressão (Banco de Células)'), [hintP('Mostra os estágios reais (0 a 4) de Ataque, Defesa, Stamina máxima, Cooldown e Velocidade. Os valores acompanham Mapa › Progressão de estágios e escudo.')], true));
    extraGrid.append(group('Consumíveis (Gemas Facetadas)', 'consumables', tuning.sectionControls('Consumíveis (Gemas Facetadas)'), [hintP('Só aparência: tipo, posição, coleta e efeito vêm da simulação. Estilo 0 devolve as formas clássicas.')], true));
    extraGrid.append(group('Altura visual (blocos e modelos)', 'grounding', tuning.sectionControls('Altura visual')), group('Indicador da janela C → X', 'cancel-ring', tuning.sectionControls('Indicador da janela C → X'),
      [Object.assign(document.createElement('p'), {className: 'hint', textContent: 'A reativação do tackle durante a esquiva é decidida por TEMPO (início e fim da janela, em Ajustes › X e C). Não há círculo de distância nas regras: este anel só desenha a janela. Ver relatório técnico.'})]));
    const dbg = document.createElement('div');dbg.id = 'vfx-debug';dbg.className = 'report';extraGrid.append(dbg);
    // ---------- Mestre-detalhe: lista de efeitos à esquerda, só o efeito escolhido à direita ----------
    const units = [], GROUPS = ['Geral', 'Combate', 'Movimento 3D', 'Mundo', 'Câmera, tremor e HUD'];
    const wrap = els => {const d = document.createElement('div');d.append(...els);return d;};
    const unit = (group, label, el, o = {}) => {el.classList.add('vx-unit');el.hidden = true;units.push({id: o.id ?? label, group, label, el, prefix: o.prefix, on: o.on});};
    const foldLabel = g => g.querySelector('.fold-title')?.firstChild?.textContent?.trim() ?? g.dataset.group;
    const body = s => wrap([...s.children].filter(c => !c.matches('h3, p.hint')));
    unit('Geral', 'Renderizador, estilo e acessibilidade', body(S.geral), {id: 'geral'});
    const dbgBox = $('vfx-debug');if (dbgBox) unit('Geral', 'Disparos recentes (depuração)', wrap([dbgBox]), {id: 'debug'});
    const master = advanced.querySelector('[data-group="vfx-master"]');if (master) unit('Combate', 'Geral dos efeitos', master, {id: 'vfx-master', prefix: 'vfx.master.'});
    for (const [type, label] of VFX_TYPES) {const g = advanced.querySelector(`[data-group="vfx-${type}"]`);if (g) unit('Combate', label, g, {id: 'vfx-' + type, prefix: `vfx.${type}.`, on: `vfx.${type}.enabled`});}
    const tools = [...solidBox.querySelectorAll(':scope > .vx-toolbar')];unit('Movimento 3D', 'Geral dos efeitos 3D', wrap(tools), {id: 'solid-geral', prefix: 'vfx.solid.', on: 'vfx.solid.enabled'});
    for (const f of SOLID_FAMILIES) unit('Movimento 3D', f.label, solidBox.querySelector(`[data-solid-family="${f.key}"]`), {id: f.key, prefix: `vfx.${f.key}.`, on: `vfx.${f.key}.enabled`});
    unit('Mundo', 'Rochas (Psyshock)', body(S.rochas), {id: 'rock', prefix: 'vfx.rock.', on: 'vfx.rock.enabled'});
    unit('Mundo', 'Barreira (Reflect)', body(S.barreira), {id: 'barrier', prefix: 'vfx.barrier.', on: 'vfx.barrier.enabled'});
    unit('Mundo', 'Laser da arena', body(S.laser), {id: 'laser', prefix: 'vfx.laser.', on: 'vfx.laser.enabled'});
    for (const g of [...extraGrid.children]) if (g !== dbgBox && g.classList.contains('fold')) unit('Câmera, tremor e HUD', foldLabel(g), g, {id: g.dataset.group});
    for (const u of units) if (u.el.classList.contains('fold') || u.el.dataset.group) u.el.setOpen?.(true);
    const md = document.createElement('div');md.className = 'vx-md';
    const list = document.createElement('aside');list.className = 'vx-list';
    list.innerHTML = '<input type="search" placeholder="Buscar efeito…" aria-label="Buscar efeito" data-vx-search>';
    const detail = document.createElement('div');detail.className = 'vx-detail';
    const head = document.createElement('header');head.className = 'vx-head';detail.append(head);
    for (const g of GROUPS) {
      const us = units.filter(u => u.group === g);if (!us.length) continue;
      const h = document.createElement('div');h.className = 'vx-gh';h.textContent = g;h.dataset.vxGroup = g;list.append(h);
      for (const u of us) {
        const b = document.createElement('button');b.type = 'button';b.dataset.vxItem = u.id;b.innerHTML = `<i class="dot"></i><span>${escape(u.label)}</span><em hidden title="Tem valores diferentes do padrão">●</em>`;
        b.onclick = () => select(u.id);u.btn = b;list.append(b);detail.append(u.el);
      }
    }
    const autoBox = document.createElement('label');autoBox.className = 'vx-check vx-auto';autoBox.title = 'Mostra o efeito de novo toda vez que você muda um valor';
    let autoOn = true;try {autoOn = localStorage.getItem('arenamon.vfxAutoPreview') !== '0';} catch {}
    autoBox.innerHTML = `<input type="checkbox" data-vx-auto ${autoOn ? 'checked' : ''}> Prévia automática`;
    autoBox.querySelector('input').onchange = e => {autoOn = e.target.checked;try {localStorage.setItem('arenamon.vfxAutoPreview', autoOn ? '1' : '0');} catch {}};
    let autoTimer = 0;
    api.autoPreview = () => {
      if (!autoOn) return;clearTimeout(autoTimer);
      autoTimer = setTimeout(() => {const cur = units.find(u => u.id === state.sel);cur?.el.querySelector('[data-preview],[data-solid-prev],[data-rock-preview],[data-barrier-preview],[data-laser-preview]')?.click();}, 280);
    };
    function refreshList() {
      for (const u of units) {
        const on = u.on ? !!pathGetRoot(C, u.on) : null, chg = u.prefix ? tuning.manifest.some(m => m.path.startsWith(u.prefix) && tuning.changed(m)) : false;
        u.btn.querySelector('.dot').className = 'dot ' + (on === null ? 'na' : on ? 'on' : 'off');u.btn.querySelector('em').hidden = !chg;
      }
    }
    function select(id) {
      const cur = units.find(u => u.id === id) ?? units[0];state.sel = cur.id;
      for (const u of units) {u.el.hidden = u !== cur;u.btn.setAttribute('aria-current', String(u === cur));}
      head.innerHTML = `<h3>${escape(cur.label)}</h3><span class="muted">${escape(cur.group)}</span>`;
      head.append(autoBox);
    }
    list.querySelector('[data-vx-search]').oninput = e => {
      const q = e.target.value.trim().toLowerCase();
      for (const u of units) u.btn.hidden = !!q && !u.label.toLowerCase().includes(q);
      for (const h of list.querySelectorAll('.vx-gh')) h.hidden = !units.some(u => u.group === h.dataset.vxGroup && !u.btn.hidden);
    };
    md.append(list, detail);root.replaceChildren(md);
    api.select = select;api.refreshList = refreshList;select(state.sel ?? 'vfx-hit');refreshList();
  }
  function live() {
    const box = $('vfx-debug');if (!box || box.closest('[hidden]')) return;
    const v = view.useNewVfx ? view.vfxRuntime : view.vfx;
    const rows = v.log ? v.log.slice(-18).reverse() : [];
    const beams = view.useNewVfx ? ` · ${v.stats.beamsActive ?? 0} lasers ativos` : '';
    box.innerHTML = `<p class="muted">${v.stats.active ?? 0} partículas ativas · pico ${v.stats.peak} · ${v.stats.spawned} criadas${beams} · limite ${C.vfx.master.maxParticles}</p><table><tr><th>t</th><th>Efeito</th><th>Var.</th><th>Motivo do disparo</th></tr>${rows.map(e => `<tr><td>${e.t.toFixed(2)}</td><td>${escape(e.effect)}</td><td>${e.variant}</td><td>${escape(e.action || e.reason)}</td></tr>`).join('')}</table>`;
  }
  let lastVfx = JSON.stringify(C.vfx);
  render();
  tuning.onChange(() => {
    api.refreshList?.();
    {const now = JSON.stringify(C.vfx);if (now !== lastVfx) {lastVfx = now;if (!root.closest('[hidden]')) api.autoPreview?.();}}
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
  return {render, live, setMode, setFilter, select: id => api.select?.(id), get vfxMode() {return state.mode;}};
}
