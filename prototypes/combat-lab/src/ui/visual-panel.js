// Aba Visualizar: efeitos visuais (três variantes cada), sombras, tremor de câmera, câmera, HUD, altura visual,
// indicador da janela C → X e depuração dos disparos de VFX. Todos os controles são do ajustador (desfazer,
// presets e exportação); nenhum altera regras de combate.
import {C, vfxDefaults, displayDefaults} from '../sim/config.js';
import {VFX_TYPES, SHAKE_EVENTS} from '../view/vfx.js';
import {fold} from './characters-panel.js';
import {escape} from './tuning.js';

export function createVisualPanel({tuning, view, game, $, hud, download}) {
  const root = $('visual-panel');
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
    h('Efeitos visuais (VFX)', 'Cada efeito tem três variantes visuais diferentes, liga/desliga, parâmetros próprios, prévia e preset. Só aparência: nada aqui muda regras, tempos da simulação, invulnerabilidade ou cooldowns.');
    root.append(group('Geral dos efeitos', 'vfx-master', tuning.sectionControls('VFX · geral')));
    for (const [type, label] of VFX_TYPES) {
      const rows = tuning.sectionControls(`VFX · ${label}`);
      root.append(group(label, `vfx-${type}`, rows, [actions(`vfx.${type}`, label, () => vfxDefaults()[type], () => view.vfx.preview(type, game.fighters))]));
    }
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
  return {render, live};
}
