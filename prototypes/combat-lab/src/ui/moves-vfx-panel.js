// Controles de aparência dos Moves. A aba Moves guarda apenas regras, slots e animações.
import {C} from '../sim/config.js';
import {listMoves} from '../sim/moves.js';
import {MOVE_INFO,MOVES_PARAMS,isVisualWorldParam} from './moves-panel.js';
import {elementalVisualMarkup, elementalGlobalMarkup, bindElementalVisual} from './elemental-move-controls.js';

const ELEMENTAL = new Set(['water-pulse','fire-spin','air-slash','seed-bomb']);
// Efeitos globais efetivamente reutilizados por vários Moves. A interface deixa
// explícito que mudar um deles afeta todos os Moves que disparam esse efeito.
const SHARED = {
  reflect:['barrier','solidReflect'], psyshock:['rock','solidImpact'], harden:['block'],
  swift:['hit'], riposte:['hit','clash'], 'emerging-stone':['rock','ground'],
  'bullet-punch':['hit','rangeRing'], 'sand-wave':['ground','solidDust'],
  spikes:['ground'], bounce:['ground','jumpLanding'], feint:['dodge'],
  'guard-break':['hit','block'], lunge:['hit'], 'quick-attack':['hit','rangeRing'],
  'second-wind':['regen'],
};
const NAMES = {barrier:'Barreira do Reflect',solidReflect:'Superfície 3D da defesa',rock:'Pedras e estilhaços',solidImpact:'Impacto sólido',hit:'Impacto compartilhado',clash:'Colisão de ataques',ground:'Contato com o chão',solidDust:'Poeira sólida',rangeRing:'Círculo de alcance',jumpLanding:'Pouso',dodge:'Esquiva',block:'Bloqueio',regen:'Regeneração'};
const ESC = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labelOf = (key, manifest) => manifest?.label ?? key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,s=>s.toUpperCase());
const colorKey = key => /color|accent/i.test(key);
const hex = value => `#${Math.max(0,Math.min(0xffffff,value)).toString(16).padStart(6,'0')}`;
function worldVisualMarkup(moveId) {
  const title = MOVE_INFO[moveId]?.group, rows = MOVES_PARAMS.find(([name])=>name===title)?.[1].filter(isVisualWorldParam) ?? [];
  if(!rows.length)return '';
  return `<details data-k="world-vfx:${moveId}"><summary>Visual próprio do Move</summary>${rows.map(([group,key,label,help,min,max,step,fmt])=>{
    const path=`world.${group}.${key}`,value=C.world[group][key],toggle=step===1&&min===0&&max===1;
    const unit=(fmt(1).match(/(?:m\/s²|m\/s|m|s|×|%|°)$/)||[''])[0];
    return `<label class="mv-visual-field" title="${ESC(help)}"><span>${ESC(label)}${unit?` (${unit})`:''}</span><input type="${toggle?'checkbox':'range'}" data-visual="${path}" ${toggle?(value?'checked':''):`min="${min}" max="${max}" step="${step}" value="${value}" data-unit="${unit}"`}><output>${toggle?'':value+(unit?` ${unit}`:'')}</output></label>`;
  }).join('')}</details>`;
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

export function createMovesVfxPanel({$,tuning,download}) {
  const root = $('moves-vfx-panel');let subscribed = false;
  function render() {
    const open = new Set([...root.querySelectorAll('details[open][data-k]')].map(x=>x.dataset.k));
    const cards = listMoves().map(move => {
      const id = move.id,name = MOVE_INFO[id]?.group ?? move.name ?? id;
      const own = worldVisualMarkup(id);
      const content = (ELEMENTAL.has(id) ? elementalVisualMarkup(id) : '') + own + (SHARED[id] ?? []).map(group => `<details data-k="shared:${id}:${group}"><summary>${ESC(NAMES[group] ?? group)} <small class="muted">compartilhado</small></summary><p class="hint">Este efeito também pode aparecer em outros Moves.</p>${sharedFields(group,tuning)}</details>`).join('');
      return `<details class="mv-move" data-k="vfx:${id}" data-move="${ESC(id)}"><summary><b>◈ ${ESC(name)}</b></summary>${content || '<p class="hint">Este Move usa um efeito fixo no jogo e ainda não possui parâmetros visuais próprios.</p>'}</details>`;
    }).join('');
    root.innerHTML = `<p class="hint">Aparência dos Moves: nenhum controle desta aba muda dano, colisão ou alcance. Os efeitos marcados “compartilhado” afetam outros Moves que usam o mesmo efeito.</p>
      <div class="row"><button type="button" data-export-vfx>↓ Exportar parâmetros e VFX (JSON)</button></div>
      ${elementalGlobalMarkup()}${cards}`;
    for(const d of root.querySelectorAll('details[data-k]')) if(open.has(d.dataset.k)) d.open = true;
    bindElementalVisual(root,tuning);
    root.querySelector('[data-export-vfx]').onclick = () => download(JSON.stringify(tuning.exportData(),null,2),'arenamon-vfx-moves.json');
    if(!subscribed && tuning?.onChange){subscribed=true;tuning.onChange(()=>{if(!root.closest('[data-section="moves-vfx"]')?.hidden && !root.querySelector('[data-visual]:active'))render();});}
  }
  return {render};
}
