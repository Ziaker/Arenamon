// @ts-check
// Dividido de main.js (comportamento idêntico): wire-characters.

import {C} from '../sim/config.js';
import {Character} from '../view/characters.js';
import {ANIM_SLIDERS, refreshAnimSliders, syncRuleDurations} from './characters-sync.js';
import {$, tuning} from '../main.js';

export function wireCharacters() {
$('char-fit').onchange = e => {Character.options.fit = e.target.checked;};
for (const [id, key, out, fmt] of ANIM_SLIDERS) {
  const path = 'display.animation.' + key;let before = null;
  $(id).oninput = e => {if (before === null) before = C.display.animation[key];C.display.animation[key] = Number(e.target.value) || (key === 'speed' ? 1 : 0);$(out).textContent = fmt(C.display.animation[key]);};
  $(id).onchange = () => {const after = C.display.animation[key];if (before !== null && before !== after) {C.display.animation[key] = before;tuning.commit([[path, after]], tuning.byPath.get(path).label);}before = null;if (key === 'speed') syncRuleDurations();};
}
tuning.onChange(refreshAnimSliders);
$('char-sync').onchange = e => {Character.options.syncRules = e.target.checked;$('act-sync').checked = e.target.checked;syncRuleDurations();};
// Atalho visível no topo da gaveta Ações: é a MESMA opção «Usar duração dos clipes nas regras» (Personagens › avançado).
$('act-sync').onchange = e => {$('char-sync').checked = e.target.checked;$('char-sync').dispatchEvent(new Event('change'));};
$('char-sync-source').onchange = () => syncRuleDurations();
}
