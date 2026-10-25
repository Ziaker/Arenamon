// @ts-check
// Vitrine de Moves (fase 4): o modelo PURO da aba Moves — quais Moves estão equipados (em destaque, por slot) e quais não estão, com os dados de cada cartão.
// Sem DOM e sem jogo: recebe dados simples e devolve dados simples, então dá para testar sem navegador.

/**
 * @typedef {{id: string, name: string, category: string | null, types: string[], pl: string | null, status: {proposto?: boolean, aprovado?: boolean, implementado?: boolean, homologado?: boolean} | null,
 *   hint: string, cost: number, cooldown: number, editable: boolean}} MoveCard
 * @typedef {MoveCard & {slot: number, key: string}} EquippedCard
 * @typedef {{equipped: (EquippedCard | {slot: number, key: string, id: null})[], others: MoveCard[], free: number}} Showcase
 */

/** Rótulo curto do estado de governança mais avançado do Move (para o selo do cartão). */
export function statusBadge(/** @type {MoveCard['status']} */ s) {
  if (!s) return null;
  if (s.homologado) return {text: 'homologado', level: 3};
  if (s.aprovado && s.implementado) return {text: 'aprovado', level: 2};
  if (s.implementado) return {text: 'implementado', level: 1};
  if (s.aprovado) return {text: 'aprovado', level: 2};
  if (s.proposto) return {text: 'proposto', level: 0};
  return null;
}

/**
 * Monta a vitrine.
 * @param {{loadout: (string | null)[], slots: number, keys: (slot: number) => string, cards: MoveCard[]}} input
 *   loadout = ids equipados por slot; cards = TODOS os Moves registrados (já com nome, selos e custo efetivo).
 * @returns {Showcase}
 */
export function buildShowcase({loadout, slots, keys, cards}) {
  const byId = new Map(cards.map(c => [c.id, c]));
  /** @type {Showcase['equipped']} */
  const equipped = Array.from({length: slots}, (_, slot) => {
    const id = loadout[slot] ?? null, c = id ? byId.get(id) : null;
    return c ? {...c, slot, key: keys(slot)} : {slot, key: keys(slot), id: null};
  });
  const used = new Set(equipped.map(e => e.id).filter(Boolean));
  const others = cards.filter(c => !used.has(c.id)).sort((a, b) => Number(b.editable) - Number(a.editable) || a.name.localeCompare(b.name, 'pt-BR'));
  return {equipped, others, free: equipped.filter(e => !e.id).length};
}

/** Novo loadout depois de pôr `moveId` no slot (um Move não ocupa dois slots; null esvazia o slot). */
export function equipInto(/** @type {(string | null)[]} */ loadout, /** @type {number} */ slots, /** @type {number} */ slot, /** @type {string | null} */ moveId) {
  const list = Array.from({length: slots}, (_, i) => loadout[i] ?? null);
  if (moveId) for (let i = 0; i < list.length; i++) if (list[i] === moveId) list[i] = null;
  list[slot] = moveId || null;
  return list;
}
/** Primeiro slot livre (ou -1). */
export const firstFreeSlot = (/** @type {(string | null)[]} */ loadout, /** @type {number} */ slots) => Array.from({length: slots}, (_, i) => loadout[i] ?? null).findIndex(v => !v);
