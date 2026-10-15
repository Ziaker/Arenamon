// Aba Visualizar: efeitos visuais (três variantes cada), sombras, tremor de câmera, câmera, HUD, altura visual,
// indicador da janela C → X e depuração dos disparos de VFX. Todos os controles são do ajustador (desfazer,
// presets e exportação); nenhum altera regras de combate.
import {C, vfxDefaults, displayDefaults} from '../sim/config.js';
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
    // Modo simples (toggle, variante, intensidade principal, prévia) e avançado (todos os parâmetros). Mesmos parâmetros.
    const bar = document.createElement('div');bar.className = 'vfx-bar';
    bar.innerHTML = `<div class="seg wide" role="group" aria-label="Modo dos efeitos"><button type="button" data-vfx-mode-btn="simple">Simples</button><button type="button" data-vfx-mode-btn="advanced">Avançado</button></div>
      <div class="seg wide" role="group" aria-label="Filtro dos efeitos">${[['all', 'Todos'], ['active', 'Ativos'], ['changed', 'Alterados'], ['costly', 'Mais caros']].map(([v, t]) => `<button type="button" data-vfx-filter="${v}">${t}</button>`).join('')}</div><p class="hint" id="vfx-filter-info"></p>`;
    root.append(bar);
    const simple = document.createElement('div');simple.className = 'vfx-simple';simple.dataset.vfxMode = 'simple';
    for (const [type, label] of VFX_TYPES) {
      const row = document.createElement('div');row.className = 'vfx-simple-row';row.dataset.vfxType = type;
      const head = document.createElement('div');head.className = 'vfx-simple-head';head.innerHTML = `<b>${escape(label)}</b><span class="muted" data-cost></span>`;
      const pv = document.createElement('button');pv.type = 'button';pv.textContent = '▶';pv.title = 'Prévia';pv.dataset.preview = `vfx.${type}`;pv.onclick = () => view.vfx.preview(type, game.fighters);
      const adv = document.createElement('button');adv.type = 'button';adv.textContent = 'Avançado ▸';adv.title = 'Todos os parâmetros deste efeito';adv.onclick = () => {setMode('advanced');const g = root.querySelector(`[data-group="vfx-${type}"]`);g?.setOpen?.(true);g?.scrollIntoView({block: 'start'});};
      head.append(pv, adv);row.append(head, ...[`vfx.${type}.enabled`, `vfx.${type}.variant`, `vfx.${type}.${MAIN[type]}`].map(p => tuning.controlFor(p)));simple.append(row);
    }
    root.append(simple);
    const advanced = document.createElement('div');advanced.dataset.vfxMode = 'advanced';
    advanced.append(group('Geral dos efeitos', 'vfx-master', tuning.sectionControls('VFX · geral')));
    for (const [type, label] of VFX_TYPES) {
      const rows = tuning.sectionControls(`VFX · ${label}`), g = group(label, `vfx-${type}`, rows, [actions(`vfx.${type}`, label, () => vfxDefaults()[type], () => view.vfx.preview(type, game.fighters))]);
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
    const v = view.vfx, rows = v.log.slice(-18).reverse();
    box.innerHTML = `<p class="muted">${v.stats.active ?? 0} partículas ativas · pico ${v.stats.peak} · ${v.stats.spawned} criadas · limite ${C.vfx.master.maxParticles}</p><table><tr><th>t</th><th>Efeito</th><th>Var.</th><th>Motivo do disparo</th></tr>${rows.map(e => `<tr><td>${e.t.toFixed(2)}</td><td>${escape(e.effect)}</td><td>${e.variant}</td><td>${escape(e.reason)}</td></tr>`).join('')}</table>`;
  }
  render();
  tuning.onChange(() => {if (state.filter !== 'all') setFilter(state.filter);});
  return {render, live, setMode, setFilter, get vfxMode() {return state.mode;}};
}
