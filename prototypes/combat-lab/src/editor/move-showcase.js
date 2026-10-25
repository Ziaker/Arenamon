// @ts-check
// Vitrine de Moves (fase 4): a aba «Moves» da barra esquerda mostra os Moves como cartões — EQUIPADOS em destaque (um por slot, com o botão do jogo) e
// NÃO EQUIPADOS abaixo. Clicar num cartão abre o Editor de Moves naquele Move; nada de slider aqui. Reflect e Psyshock (ainda em código) abrem o
// painel antigo. Interface fina: os dados vêm de move-showcase-model.js.
import {buildShowcase, equipInto, firstFreeSlot, statusBadge} from './move-showcase-model.js';

/**
 * @param {{$: (id: string) => any, game: any, slots: () => number, listMoves: () => any[], getMove: (id: string) => any, info: Record<string, any>, keyOf: (fighter: number, slot: number) => string,
 *   editableIds: () => Set<string>, openEditor: (id: string) => void, openLegacy: (id: string) => void, onEquipChanged?: () => void}} deps
 */
export function createMoveShowcase({$, game, slots, listMoves, getMove, info, keyOf, editableIds, openEditor, openLegacy, onEquipChanged}) {
  const root = $('moves-showcase');
  const state = {fighter: 0};
  const el = (/** @type {string} */ tag, /** @type {Record<string, any>} */ attrs = {}, /** @type {(Node | string)[]} */ kids = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) k === 'class' ? (e.className = v) : k === 'text' ? (e.textContent = v) : e.setAttribute(k, String(v));
    e.append(...kids);return e;
  };
  const loadoutOf = (/** @type {number} */ id) => Array.from({length: slots()}, (_, i) => game.fighters[id]?.loadout?.[i] ?? null);

  /** Cartões de TODOS os Moves registrados, com nome, selos e custo/recarga efetivos (os sliders atuais). */
  function cards() {
    const editable = editableIds();
    return listMoves().map(d => {
      const eff = getMove(d.id) ?? d, meta = info[d.id]?.meta ?? null;
      return {id: d.id, name: info[d.id]?.group ?? d.name ?? d.id, category: meta?.category ?? null, types: meta?.types ?? [], pl: meta?.pl ?? null, status: meta?.status ?? null,
        hint: info[d.id]?.hint ?? d.description ?? '', cost: eff.cost ?? 0, cooldown: eff.cooldown ?? 0, editable: editable.has(d.id)};
    });
  }
  function equip(/** @type {number} */ slot, /** @type {string | null} */ moveId) {
    game.setLoadout(state.fighter, equipInto(loadoutOf(state.fighter), slots(), slot, moveId));
    render();onEquipChanged?.();
  }

  function badges(/** @type {import('./move-showcase-model.js').MoveCard} */ c) {
    const out = [];
    if (c.category) out.push(el('span', {class: 'mvs-badge mvs-cat-' + c.category.toLowerCase(), text: c.category}));
    if (c.types.length) out.push(el('span', {class: 'mvs-badge', text: c.types.join(' · ')}));
    if (c.pl) out.push(el('span', {class: 'mvs-badge', text: c.pl}));
    const st = statusBadge(c.status);
    if (st) out.push(el('span', {class: 'mvs-badge mvs-st-' + st.level, text: st.text}));
    if (!c.editable) out.push(el('span', {class: 'mvs-badge mvs-code', title: 'Este Move ainda está em código: os sliders ficam no painel antigo.', text: 'em código'}));
    return el('div', {class: 'mvs-badges'}, out);
  }
  function open(/** @type {import('./move-showcase-model.js').MoveCard} */ c) {c.editable ? openEditor(c.id) : openLegacy(c.id);}
  const numbers = (/** @type {import('./move-showcase-model.js').MoveCard} */ c) => `custo ${(+c.cost).toFixed(2)} · recarga ${(+c.cooldown).toFixed(1)} s`;

  function equippedCard(/** @type {any} */ e) {
    if (!e.id) {
      const sel = /** @type {HTMLSelectElement} */ (el('select', {class: 'mvs-equip', 'data-slot': e.slot, 'aria-label': `Equipar um Move no slot ${e.slot + 1}`}, [el('option', {value: '', text: '+ Equipar um Move…'}), ...cards().filter(c => !loadoutOf(state.fighter).includes(c.id)).map(c => el('option', {value: c.id, text: c.name}))]));
      sel.onchange = () => {if (sel.value) equip(e.slot, sel.value);};
      return el('div', {class: 'mvs-card mvs-empty', 'data-slot': e.slot}, [el('span', {class: 'mvs-key', text: e.key}), el('span', {class: 'mvs-name', text: 'Slot vazio'}), sel]);
    }
    const btn = el('button', {type: 'button', class: 'mvs-open', 'data-move': e.id, title: e.hint, 'aria-label': `${e.name}: abrir no Editor`}, [el('span', {class: 'mvs-name', text: e.name}), badges(e), el('span', {class: 'mvs-num', text: numbers(e)}), el('span', {class: 'mvs-go', text: e.editable ? '🛠 Editar' : '⚙ Parâmetros'})]);
    btn.onclick = () => open(e);
    const off = el('button', {type: 'button', class: 'mvs-off', title: 'Tirar do slot', 'aria-label': `Tirar ${e.name} do slot ${e.slot + 1}`, text: '✕'});
    off.onclick = () => equip(e.slot, null);
    return el('div', {class: 'mvs-card mvs-equipped', 'data-slot': e.slot, 'data-move': e.id}, [el('span', {class: 'mvs-key', title: `Botão do slot ${e.slot + 1}`, text: e.key}), btn, off]);
  }
  function otherCard(/** @type {import('./move-showcase-model.js').MoveCard} */ c, /** @type {number} */ free) {
    const btn = el('button', {type: 'button', class: 'mvs-open', 'data-move': c.id, title: c.hint, 'aria-label': `${c.name}: abrir no Editor`}, [el('span', {class: 'mvs-name', text: c.name}), badges(c), el('span', {class: 'mvs-num', text: numbers(c)})]);
    btn.onclick = () => open(c);
    const sel = /** @type {HTMLSelectElement} */ (el('select', {class: 'mvs-equip', 'aria-label': `Equipar ${c.name}`}, [el('option', {value: '', text: 'Equipar…'}), ...Array.from({length: slots()}, (_, i) => el('option', {value: String(i), text: `no slot ${i + 1} (${keyOf(state.fighter, i)})${loadoutOf(state.fighter)[i] ? ' — troca' : ''}`}))]));
    sel.onchange = () => {if (sel.value !== '') equip(Number(sel.value), c.id);};
    if (free > 0) sel.value = '';
    return el('div', {class: 'mvs-card mvs-other', 'data-move': c.id}, [btn, sel]);
  }

  function render() {
    const lo = loadoutOf(state.fighter), model = buildShowcase({loadout: lo, slots: slots(), keys: i => keyOf(state.fighter, i), cards: cards()});
    const who = el('div', {class: 'mvs-who', role: 'group', 'aria-label': 'Lutador'}, [0, 1].map(i => {
      const b = el('button', {type: 'button', 'aria-pressed': String(state.fighter === i), 'data-fighter': i, text: i ? 'Vermelho' : 'Azul'});
      b.onclick = () => {state.fighter = i;render();};return b;
    }));
    root.replaceChildren(
      el('div', {class: 'mvs-head'}, [el('h3', {text: 'Moves'}), who]),
      el('p', {class: 'hint', text: 'Clique num Move para abrir o Editor (play, sliders, linha do tempo e A × B). Equipados ficam em destaque; os botões são os do jogo.'}),
      el('h4', {class: 'mvs-sec', text: `Equipados (${slots() - model.free}/${slots()})`}),
      el('div', {class: 'mvs-grid mvs-grid-eq', id: 'mvs-equipped'}, model.equipped.map(equippedCard)),
      el('h4', {class: 'mvs-sec', text: `Não equipados (${model.others.length})`}),
      el('div', {class: 'mvs-grid', id: 'mvs-others'}, model.others.map(c => otherCard(c, model.free))),
    );
  }
  let last = '';
  /** Mantém a vitrine em dia quando o loadout muda por outro caminho (gaveta Ações, Seleção Rápida) ou os sliders mudam custo/recarga. */
  function poll() {
    if (!root.isConnected || root.closest('[hidden]')) return;
    const sig = JSON.stringify([loadoutOf(0), loadoutOf(1), listMoves().map(d => {const m = getMove(d.id);return [d.id, m?.cost, m?.cooldown];})]);
    if (sig !== last) {last = sig;render();}
  }
  render();
  setInterval(poll, 400);
  return {render, state, equip, poll};
}
export {firstFreeSlot};
