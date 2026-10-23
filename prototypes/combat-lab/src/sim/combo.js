// Contador de combo OBSERVACIONAL (decisões D1–D5 do plano de combos de 23/10/2026): lê os eventos já resolvidos do passo e
// nunca muda dano, física, permissões nem IA. Conta só acertos corpo a corpo com dano real ao HP (`impact` de contato `tackle` ou
// `melee`): defesa parcial/perfeita, esquiva, escudo e dano zero não contam (D4); projéteis, áreas, armadilhas e footstool também não (D3).
// O combo de um atacante contra um alvo termina quando o alvo recupera uma resposta legal (canAct) ou cai; juggle/scaling ficam para depois (D5).
import {canAct} from './entity.js';

const MELEE = new Set(['tackle', 'melee']);
export const newCombos = () => ({active: [null, null], last: [null, null]});
export const countsForCombo = e => e.result === 'impact' && e.damage > 0 && MELEE.has(e.contact) && e.attacker != null && e.target != null && e.attacker !== e.target;

function finish(combos, attacker, tick) {
  const t = combos.active[attacker];if (!t) return;
  combos.last[attacker] = {...t, endTick: tick};combos.active[attacker] = null;
}

/** Chamado uma vez por passo normal, com os eventos já numerados (`id`, `tick`). */
export function observeCombos(game, events) {
  const combos = game.combos ??= newCombos();
  for (const e of events) {
    if (!countsForCombo(e)) continue;
    const t = combos.active[e.attacker];
    if (t && t.target === e.target) {t.count++;t.damage += e.damage;t.lastTick = e.tick;t.lastId = e.id;}
    else {finish(combos, e.attacker, e.tick);combos.active[e.attacker] = {target: e.target, count: 1, damage: e.damage, startTick: e.tick, lastTick: e.tick, firstId: e.id, lastId: e.id};}
  }
  for (const attacker of [0, 1]) {
    const t = combos.active[attacker];if (!t) continue;
    const defender = game.fighters[t.target];
    if (!defender || defender.hp <= 0 || canAct(defender)) finish(combos, attacker, game.tick);
  }
}
