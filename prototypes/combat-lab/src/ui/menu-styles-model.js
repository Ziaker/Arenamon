// @ts-check
// Modelo de dados das três telas do pré-jogo (A Impacto · B Quadrinhos · C Clássico). Funções PURAS (testáveis em Node) que transformam os catálogos REAIS em cartas de exibição:
// Moves vêm de `listMoves()` (registro executável) e passivas de `passives.js`; nada é digitado à mão e nenhum número de gameplay é inventado (custo e recarga são os do Move efetivo).
// «Equipamentos» = os loadouts (4 Moves + 2 passivas): o projeto não tem inventário nem itens equipáveis (docs/PASSIVAS_DECISOES.md, Rodada 5, chama os dois espaços de passivas de «equipamento»).
import {listMoves, getMove} from '../sim/moves.js';
import {PASSIVE_SLOTS, exclusivePassives, genericPassives, validateLoadout} from '../sim/passives.js';

/** Ícones do conjunto autoral do laboratório visual (prototypes/hud-moves/src/data.js ICONS); só decoração, não é regra. */
export const MOVE_ICON = Object.freeze({
  'quick-attack': 'raio', psyshock: 'espiral', harden: 'escudo', 'sand-wave': 'onda', 'bullet-punch': 'punho', reflect: 'escudo', 'second-wind': 'gota', lunge: 'impacto', riposte: 'estrela',
  bounce: 'onda', swift: 'estrela', 'guard-break': 'impacto', feint: 'espiral', spikes: 'pedra', 'emerging-stone': 'pedra',
});
/** @param {string} id */
export const iconForMove = id => MOVE_ICON[id] ?? 'impacto';
/** @param {string} category */
export const iconForPassive = category => category === 'permanente' ? 'escudo' : 'raio';

/** Rótulo curto de uma tecla (`KeyA` → `A`, `Digit3` → `3`). @param {string | undefined} code */
export const keyLabel = code => !code ? '' : String(code).replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'N').replace(/^Arrow/, '');

/**
 * Cartas dos Moves SELECIONÁVEIS: exatamente o que está registrado agora. Campos: id, name, description (texto do Move/painel), cost, cooldown (do Move EFETIVO), icon.
 * @param {Record<string, {hint?: string}>} [info] MOVE_INFO do painel de Moves (texto de uso)
 * @returns {{id: string, name: string, description: string, cost: number, cooldown: number, icon: string}[]}
 */
export function moveCatalog(info = {}) {
  return listMoves().map(d => {
    const eff = getMove(d.id) ?? d;
    return {id: d.id, name: d.name ?? d.id, description: String(info[d.id]?.hint ?? d.description ?? ''), cost: eff.cost ?? 1, cooldown: eff.cooldown ?? 0, icon: iconForMove(d.id)};
  });
}
/** Linha de uso («Custo X de stamina · recarga Y s») no mesmo formato da dica do painel de Moves. @param {{cost: number, cooldown: number}} m */
export const usageLine = m => `Custo ${m.cost.toFixed(2)} de stamina · recarga ${m.cooldown.toFixed(1)} s`;

/**
 * Cartas das passivas: as EXCLUSIVAS da espécie atual primeiro, depois as genéricas. Texto real de gatilho e efeito; catálogo experimental.
 * @param {string | null} species
 */
export function passiveCatalog(species) {
  const card = (/** @type {any} */ p, /** @type {'exclusiva' | 'genérica'} */ origem) => ({id: p.id, nome: p.nome, categoria: p.categoria, gatilho: p.gatilho, efeito: p.efeito, origem, especie: p.species ?? null, icon: iconForPassive(p.categoria)});
  // `exclusivePassives(null)` devolve as GENÉRICAS (species === null): sem espécie não há exclusivas.
  return {exclusive: (species ? exclusivePassives(species) : []).map((/** @type {any} */ p) => card(p, 'exclusiva')), generic: genericPassives().map((/** @type {any} */ p) => card(p, 'genérica'))};
}
/** Motivos pelos quais a seleção de passivas é inválida (as mesmas regras do painel e do motor). @param {(string|null)[]} ids @param {string | null} species */
export const invalidReasons = (ids, species) => validateLoadout(ids.filter(/** @returns {x is string} */ x => !!x), species);
export {PASSIVE_SLOTS};
