import {C} from '../sim/config.js';
import {ELEMENTAL_VARIANTS} from '../view/quarks/presets.js';
import {elementalVisualKey} from '../sim/elemental-visual-config.js';
import {elementalRows, sliderRange, MOVE_KEYS, VARIANT_PATH} from './elemental-visual-model.js';

const safe = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hex = value => `#${Math.max(0,Math.min(0xffffff,value)).toString(16).padStart(6,'0')}`;
const get = path => path.split('.').reduce((o,k) => o?.[k],C);

/**
 * Um controle visual (slider, interruptor ou seletor de cor) ligado a um caminho de C por `data-visual`.
 * `dep`: caminho do interruptor que o libera (some enquanto estiver desligado). `unit` aparece no rótulo e no valor.
 */
export function visualField({path, label, unit = '', min = 0, max = 1, step = .01, help = '', kind = 'range', dep = ''}) {
  const value = get(path), hidden = dep && !get(dep) ? 'hidden' : '', attrs = `class="mv-visual-field" ${hidden} data-dep="${safe(dep)}" title="${safe(help)}"`;
  if (kind === 'color') return `<label ${attrs}><span>${safe(label)}</span><input type="color" data-visual="${path}" value="${hex(value ?? 0)}"><output>${hex(value ?? 0)}</output></label>`;
  if (kind === 'toggle') return `<label ${attrs}><span>${safe(label)}</span><input type="checkbox" data-visual="${path}" ${value ? 'checked' : ''}></label>`;
  const range = sliderRange({unit, min, max}, value), shown = unit && unit !== 'cor' ? ` (${safe(unit)})` : '';
  return `<label ${attrs}><span>${safe(label)}${shown}</span><input type="range" data-visual="${path}" min="${range.min}" max="${range.max}" step="${step}" value="${value ?? 0}" data-unit="${safe(unit === 'cor' ? '' : unit)}"><output>${value ?? 0}${unit && unit !== 'cor' ? ` ${safe(unit)}` : ''}</output></label>`;
}

/**
 * Subgrupos visuais de um Move elemental, só com os parâmetros que o desenho dele realmente lê (mesma lista do Ateliê Elemental).
 * Devolve [{sub, html}] na ordem de aparição; o painel Moves os aninha por nome.
 */
export function elementalSubs(moveId) {
  const move = MOVE_KEYS[moveId];if (!move) return [];
  const el = C.vfx.elemental, effect = el.seedShotEffect | 0;
  const variant = move === 'seedBomb' ? 0 : Math.max(0, Math.min(2, el[VARIANT_PATH[move]] | 0)), key = elementalVisualKey(move, variant), data = el.visual[key];
  if (!data) return [];
  const subs = new Map(), add = (sub, html) => subs.set(sub, (subs.get(sub) ?? '') + html);
  if (move !== 'seedBomb') {
    const names = ELEMENTAL_VARIANTS[move] ?? ['A', 'B', 'C'], vp = `vfx.elemental.${VARIANT_PATH[move]}`;
    add('Efeito principal', `<label class="mv-visual-field" title="Cada opção tem forma e valores próprios; os controles abaixo editam a opção escolhida."><span>Opção ativa</span><select data-visual="${vp}">${names.map((n, i) => `<option value="${i}" ${el[VARIANT_PATH[move]] === i ? 'selected' : ''}>${safe(n)}</option>`).join('')}</select></label>`);
  }
  let lastSection = null, lastSub = null;
  for (const r of elementalRows(move, effect)) {
    if (r.sub !== lastSub) lastSection = null;
    lastSub = r.sub;
    const section = r.section ? `<h5 class="mv-section">${safe(r.section)}</h5>` : '';
    const head = r.section !== lastSection && r.section ? section : '';lastSection = r.section;
    if (r.key === '__shotEffect') {
      add(r.sub, `${head}<label class="mv-visual-field" title="${safe(r.help)}"><span>Efeito de disparo</span><select data-visual="vfx.elemental.seedShotEffect"><option value="0" ${!effect ? 'selected' : ''}>Nenhum</option><option value="1" ${effect === 1 ? 'selected' : ''}>Argolas</option><option value="2" ${effect === 2 ? 'selected' : ''}>Cone</option></select></label>`);
      continue;
    }
    const base = `vfx.elemental.visual.${key}`, path = r.shotKind ? `${base}.${r.shotKind === 'ring' ? 'shotRing' : 'shotCone'}.${r.key}` : `${base}.${r.key}`, value = get(path);
    if (typeof value !== 'number') continue;
    add(r.sub, head + visualField({path, label: r.label, unit: r.unit, min: r.min, max: r.max, step: r.step, help: r.help, kind: r.unit === 'cor' ? 'color' : 'range'}));
  }
  return [...subs].map(([sub, html]) => ({sub, html}));
}

/** Controles que valem para todos os disparos e projéteis elementais. */
export function elementalGlobalMarkup() {
  return `<details data-k="visual:shared"><summary><b>Visual dos projéteis</b></summary><label class="mv-visual-field"><span>Borda com cor do PL nos projéteis</span><input type="checkbox" data-visual="vfx.projectilePlBorder" ${C.vfx.projectilePlBorder?'checked':''}></label><p class="hint">O tempo de seguimento do efeito de disparo agora é por Move: Visual › Disparo.</p></details>`;
}

export function bindElementalVisual(root,tuning) {
  for (const input of root.querySelectorAll('[data-visual]')) {
    const path = input.dataset.visual;
    const getv = () => get(path);
    const set = value => {const parts = path.split('.'), key = parts.pop();parts.reduce((o,k) => o[k],C)[key] = value;};
    const numeric = () => input.type === 'color' ? Number.parseInt(input.value.slice(1),16) : input.type === 'checkbox' ? Number(input.checked) : Number(input.value);
    const output = input.parentElement.querySelector('output');
    let before;
    input.oninput = () => {if (before === undefined) before = getv();const value = numeric();set(value);if(output) output.textContent = input.type === 'color' ? input.value : `${value}${input.dataset.unit?` ${input.dataset.unit}`:''}`;};
    input.onchange = () => {
      const value = numeric(), old = before ?? getv();before = undefined;
      if (input.type === 'checkbox') for (const dep of root.querySelectorAll('[data-dep]')) if (dep.dataset.dep === path) dep.hidden = !input.checked;   // libera/esconde os sliders dependentes na hora
      if (old === value) return;set(old);if(tuning) tuning.commit([[path,value]],`Visual: ${path.split('.').pop()}`);else set(value);
    };
  }
}
