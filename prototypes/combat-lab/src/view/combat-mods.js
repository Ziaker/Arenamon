// Ponte Editor de animações → simulação: os campos de combate por ação (armadura, hit-stop ×, interrompível, prioridade de combate, buffer de entrada)
// viram um objeto {chave: {campo: valor}} entregue ao Game (setCombatMods). Só entram valores SOBRESCRITOS no Editor; sem nada salvo o combate é idêntico ao original.
// Vale para as ações que causam/recebem golpes de tackle: tackle (PL1–3) e todos os Moves (move_<id>). Esquivas e as demais ações não têm esses campos no combate.
import {listMoves} from '../sim/moves.js';

export const COMBAT_MOD_FIELDS = ['armor', 'hitstopMult', 'interruptible', 'combatPriority', 'bufferWindow'];
const NEUTRAL = {armor: 0, hitstopMult: 1, interruptible: true, combatPriority: 0, bufferWindow: 0};

/** @param {any} ch Character @returns {Record<string, Record<string, number|boolean>>} */
export function combatModsOf(ch) {
  const out = {}, ids = ['tackle', 'tackle_pl2', 'tackle_pl3', ...listMoves().map(m => `move_${m.id}`)];
  for (const id of ids) {
    const mods = {};
    for (const f of COMBAT_MOD_FIELDS) {
      const v = ch.profileValue(id, f);
      if (v !== undefined && v !== null && v !== NEUTRAL[f]) mods[f] = v;
    }
    if (Object.keys(mods).length) out[id] = mods;
  }
  return out;
}
