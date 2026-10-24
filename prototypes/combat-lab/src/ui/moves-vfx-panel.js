// Controles de aparência dos Moves, exibidos na aba Visual do cartão de cada Move (aba Moves), em subgrupos:
// efeito principal, disparo, contato/explosão, hit (cor e tremor) e efeitos compartilhados.
import {C} from '../sim/config.js';
import {MOVE_INFO,MOVES_PARAMS,isVisualWorldParam,DEPENDS_ON} from './moves-panel.js';
import {elementalSubs, elementalGlobalMarkup, bindElementalVisual, visualField} from './elemental-move-controls.js';
import {VISUAL_SUB_ORDER, MOVE_KEYS} from './elemental-visual-model.js';
import {MOVE_GROUP, SHAKE_GROUPS, MOVE_ELEMENT} from '../sim/move-hit-map.js';
import {MOVE_VFX, VFX_NAMES} from '../sim/move-vfx-map.js';

// Efeitos globais efetivamente reutilizados por vários Moves. A interface deixa
// explícito que mudar um deles afeta todos os Moves que disparam esse efeito.
const SHARED = MOVE_VFX;
const NAMES = VFX_NAMES;
const ELEMENT_NAMES = {water:'Água',fire:'Fogo',air:'Voador',grass:'Planta',psychic:'Psíquico',ground:'Terra',normal:'Normal'};
const ESC = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labelOf = (key, manifest) => manifest?.label ?? key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,s=>s.toUpperCase());
const colorKey = key => /color|accent/i.test(key);
const hex = value => `#${Math.max(0,Math.min(0xffffff,value)).toString(16).padStart(6,'0')}`;
const unitOf = fmt => (fmt(1).match(/(?:m\/s²|m\/s|m|s|×|%|°)$/)||[''])[0];

/** Sliders de aparência que moram em C.world (sem os do tremor de hit, que têm subgrupo próprio). */
function worldRows(moveId) {
  const title = MOVE_INFO[moveId]?.group;
  return (MOVES_PARAMS.find(([name])=>name===title)?.[1].filter(isVisualWorldParam) ?? []);
}
function worldField([group,key,label,help,min,max,step,fmt]) {
  const toggle = step===1&&min===0&&max===1, dep = DEPENDS_ON[`${group}.${key}`];
  return visualField({path:`world.${group}.${key}`, label, unit:unitOf(fmt), min, max, step, help, kind:toggle?'toggle':'range', dep:dep?`world.${group}.${dep}`:''});
}

/** Subgrupo “Hit (cor e tremor)”: cor do VFX de hit do Move e tremor de câmera (só nos Moves que não são corpo a corpo). */
function hitSub(moveId) {
  const group = MOVE_GROUP[moveId];
  if (!group || !SHAKE_GROUPS.includes(group)) return '';
  const tint = `vfx.moveHit.${group}`, element = MOVE_ELEMENT[moveId];
  const colors = C.vfx.moveHit?.[group] ? [
    visualField({path:`${tint}.enabled`, label:'Hit com a cor do Move', kind:'toggle', help:'Ligado: o efeito de hit usa as cores abaixo. Desligado: usa a cor do hit do Tackle.'}),
    visualField({path:`${tint}.color`, label:'Cor do hit', kind:'color', help:'Cor dos traços e partículas do hit deste Move.', dep:`${tint}.enabled`}),
    visualField({path:`${tint}.color2`, label:'Cor secundária do hit', kind:'color', help:'Cor do brilho/segunda camada do hit deste Move.', dep:`${tint}.enabled`}),
  ].join('') : '';
  const note = element ? `<p class="hint">Elemento: ${ESC(ELEMENT_NAMES[element] ?? element)}. O hit próprio deste elemento ainda não existe: por enquanto o Move usa o hit do Tackle com a cor acima. (Gancho pronto em HIT_BY_ELEMENT, view/vfx.js.)</p>` : '';
  const shake = MOVES_PARAMS.find(([name])=>name===MOVE_INFO[moveId]?.group)?.[1].filter(r=>r[1].startsWith('hitShake')).map(worldField).join('') ?? '';
  return colors + note + shake;
}

function sharedFields(group,tuning) {
  const top = group === 'rangeRing' ? C.display.rangeRing : C.vfx[group];
  const base = group === 'rangeRing' ? 'display.rangeRing' : `vfx.${group}`;
  if (!top) return '';
  return Object.entries(top).filter(([,v]) => typeof v === 'number').map(([key,value]) => {
    const path = `${base}.${key}`, meta = tuning?.byPath?.get(path), label = labelOf(key,meta);
    if(colorKey(key)) return `<label class="mv-visual-field"><span>${ESC(label)}</span><input type="color" data-visual="${path}" value="${hex(value)}"><output>${hex(value)}</output></label>`;
    const toggle = /^(enabled|.*On|trail|shatter|ripples|byDamage|coreOn|bladeOn|ringPlaneOn|ringGroundOn|sparksOn|embersOn)$/.test(key) && (value === 0 || value === 1);
    if(toggle) return `<label class="mv-visual-field"><span>${ESC(label)}</span><input type="checkbox" data-visual="${path}" ${value?'checked':''}></label>`;
    const enumValue = key === 'variant' || key === 'profile';
    const min = enumValue ? (meta?.min ?? 0) : (meta?.min ?? Math.min(0,value < 0 ? value * 5 : 0));
    const max = enumValue ? (meta?.max ?? 2) : Math.max(meta?.max ?? 0,Math.abs(value)*5,1);
    const step = enumValue ? 1 : (meta?.step ?? (Number.isInteger(value)?1:.01));
    return `<label class="mv-visual-field" title="${ESC(meta?.help ?? '')}"><span>${ESC(label)}</span><input type="range" data-visual="${path}" min="${min}" max="${max}" step="${step}" value="${value}"><output>${value}</output></label>`;
  }).join('');
}

/** Marcação visual de cada Move (e do bloco global), usada dentro do cartão do Move na aba Moves. */
export function createMovesVisual({tuning}) {
  return {
    markup(id) {
      const subs = new Map(), add = (name, html) => {if (html) subs.set(name, (subs.get(name) ?? '') + html);};
      const elemental = MOVE_KEYS[id] ? elementalSubs(id) : [];
      for (const {sub, html} of elemental) add(sub, html);
      for (const row of worldRows(id)) {
        if (row[1].startsWith('hitShake')) continue;   // tremor de hit: subgrupo “Hit”
        add(elemental.length ? (row[1] === 'blastLife' ? (id === 'seed-bomb' ? 'Contato / explosão' : 'Contato e explosão') : 'Efeito principal') : 'Efeito do Move', worldField(row));
      }
      add('Hit (cor e tremor)', hitSub(id));
      add('Efeitos compartilhados', (SHARED[id] ?? []).map(group => `<details data-k="shared:${id}:${group}"><summary>${ESC(NAMES[group] ?? group)} <small class="muted">compartilhado</small></summary><p class="hint">Este efeito também pode aparecer em outros Moves.</p>${sharedFields(group,tuning)}</details>`).join(''));
      if (!subs.size) return '<p class="hint">Este Move usa um efeito fixo no jogo e ainda não possui parâmetros visuais próprios.</p>';
      const order = name => { const i = VISUAL_SUB_ORDER.indexOf(name);return i < 0 ? 99 : i; };
      return [...subs].sort((a, b) => order(a[0]) - order(b[0])).map(([name, html]) => `<details class="mv-sub" data-k="vsub:${id}:${ESC(name)}" open><summary>${ESC(name)}</summary>${html}</details>`).join('');
    },
    globalMarkup: elementalGlobalMarkup,
    bind: root => bindElementalVisual(root,tuning),
  };
}
