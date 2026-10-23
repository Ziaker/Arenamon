import {C} from '../sim/config.js';
import {ELEMENTAL_CONTROLS, FIRE_CONTROLS, WATER_CONTROLS, SHOT_CONTROLS, SEED_CONTROLS, SHOT_RING_CONTROLS, SHOT_CONE_CONTROLS} from '../view/quarks/presets.js';
import {elementalVisualKey} from '../sim/elemental-visual-config.js';

const MOVES = {'water-pulse':'waterPulse','fire-spin':'fireSpin','air-slash':'airSlash','seed-bomb':'seedBomb'};
const LABELS = {waterPulse:'Water Pulse',fireSpin:'Fire Spin',airSlash:'Air Slash',seedBomb:'Seed Bomb'};
const META = new Map([...ELEMENTAL_CONTROLS,...FIRE_CONTROLS,...WATER_CONTROLS,...SHOT_CONTROLS,...SEED_CONTROLS,...SHOT_RING_CONTROLS,...SHOT_CONE_CONTROLS].map(row => [row[0],row]));
const isColor = key => /color|accent|palette/i.test(key);
const safe = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hex = value => `#${Math.max(0,Math.min(0xffffff,value)).toString(16).padStart(6,'0')}`;
const fields = (object, path) => Object.entries(object).map(([key,value]) => {
  const full = `${path}.${key}`;
  if (value && typeof value === 'object') return `<details data-k="visual:${full}"><summary>${safe(key === 'shotRing' ? 'Argolas de disparo' : key === 'shotCone' ? 'Cone de disparo' : key)}</summary>${fields(value,full)}</details>`;
  if (typeof value !== 'number') return '';
  const meta = META.get(key), label = meta?.[1] ?? key, unit = meta?.[2] ?? '';
  if (isColor(key)) return `<label class="mv-visual-field"><span>${safe(label)}</span><input type="color" data-visual="${full}" value="${hex(value)}"><output>${hex(value)}</output></label>`;
  const min = key === 'opacity' ? 0 : Math.min(meta?.[3] ?? (value < 0 ? value * 5 : 0),value < 0 ? value * 5 : 0);
  const max = key === 'opacity' ? 1 : Math.max(meta?.[4] ? meta[4] * 5 : 0,Math.abs(value) * 5,1);
  const step = meta?.[5] || (Number.isInteger(value) ? 1 : .01);
  return `<label class="mv-visual-field" title="${safe(meta?.[6] ?? '')}"><span>${safe(label)}${unit && unit !== 'cor' ? ` (${safe(unit)})` : ''}</span><input type="range" data-visual="${full}" min="${min}" max="${max}" step="${step}" value="${value}"><output>${value}</output></label>`;
}).join('');

export function elementalVisualMarkup(moveId) {
  const move = MOVES[moveId];if (!move) return '';
  return `<details data-k="visual:${move}"><summary><b>Visual · ${LABELS[move]}</b></summary><p class="hint">Opacidade, luz, cores e parâmetros do efeito. Cada valor entra no JSON de ajustes.</p>
    ${move !== 'seedBomb' ? `<label class="mv-visual-field"><span>Paleta / variante ativa</span><select data-visual="vfx.elemental.${move === 'waterPulse' ? 'waterVariant' : move === 'fireSpin' ? 'fireVariant' : 'airVariant'}">${[0,1,2].map(n=>`<option value="${n}" ${C.vfx.elemental[move === 'waterPulse' ? 'waterVariant' : move === 'fireSpin' ? 'fireVariant' : 'airVariant']===n?'selected':''}>${['A','B','C'][n]}</option>`).join('')}</select></label>` : ''}
    ${Array.from({length:move === 'seedBomb' ? 1 : 3},(_,variant) => {
      const key = elementalVisualKey(move,variant), data = C.vfx.elemental.visual[key];
      return `<details data-k="visual:${key}"><summary>Paleta e efeito ${['A','B','C'][variant]}</summary>${fields(data,`vfx.elemental.visual.${key}`)}</details>`;
    }).join('')}
    ${move === 'seedBomb' ? `<label class="mv-visual-field"><span>Efeito de disparo</span><select data-visual="vfx.elemental.seedShotEffect"><option value="0" ${!C.vfx.elemental.seedShotEffect?'selected':''}>Nenhum</option><option value="1" ${C.vfx.elemental.seedShotEffect===1?'selected':''}>Argolas</option><option value="2" ${C.vfx.elemental.seedShotEffect===2?'selected':''}>Cone</option></select></label>` : ''}</details>`;
}

export function elementalGlobalMarkup() {
  const value = C.vfx.elemental.shotFollowTime;
  return `<details data-k="visual:shared"><summary><b>Visual dos disparos e projéteis</b></summary><label class="mv-visual-field"><span>Tempo de seguimento de argolas e cones (s)</span><input type="range" data-visual="vfx.elemental.shotFollowTime" min="0" max="2" step="0.01" value="${value}"><output>${value} s</output></label><label class="mv-visual-field"><span>Borda com cor do PL nos projéteis</span><input type="checkbox" data-visual="vfx.projectilePlBorder" ${C.vfx.projectilePlBorder?'checked':''}></label></details>`;
}

export function bindElementalVisual(root,tuning) {
  for (const input of root.querySelectorAll('[data-visual]')) {
    const path = input.dataset.visual;
    const get = () => path.split('.').reduce((o,k) => o[k],C);
    const set = value => {const parts = path.split('.'), key = parts.pop();parts.reduce((o,k) => o[k],C)[key] = value;};
    const numeric = () => input.type === 'color' ? Number.parseInt(input.value.slice(1),16) : input.type === 'checkbox' ? Number(input.checked) : Number(input.value);
    const output = input.parentElement.querySelector('output');
    let before;
    input.oninput = () => {if (before === undefined) before = get();const value = numeric();set(value);if(output) output.textContent = input.type === 'color' ? input.value : `${value}${path.endsWith('shotFollowTime')?' s':input.dataset.unit?` ${input.dataset.unit}`:''}`;};
    input.onchange = () => {const value = numeric(), old = before ?? get();before = undefined;if (old === value) return;set(old);if(tuning) tuning.commit([[path,value]],`Visual: ${path.split('.').pop()}`);else set(value);};
  }
}
