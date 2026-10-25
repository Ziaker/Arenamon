// @ts-check
// Modelo do Editor de Moves (sem interface): monta o CENÁRIO de teste de um Move (azul executa, vermelho é o alvo) e resume o resultado em números.
// Roda no mesmo Game/World da partida (prepareScenario), então dano, empurrão, cegueira, custo e recarga são os do jogo. Testável sem navegador.
import {C} from '../sim/config.js';
import {emptyCommand} from '../sim/entity.js';
import {vec} from '../sim/math.js';

/** Estados do alvo que o palco sabe montar. */
export const TARGET_STATES = [['still', 'Parado'], ['guard', 'Defendendo']];
export const DEFAULT_STAGE = {distance: 3, target: 'still'};
export const DISTANCE_RANGE = {min: 1, max: 12, step: .25};

const cmd = (/** @type {any} */ o) => ({...emptyCommand(), ...o});
const HELD = (/** @type {number} */ slot) => Array.from({length: C.world.slots}, (_, i) => i === slot);

/** Duração (s) que vale a pena observar: preparação + janela ativa + dissipação + folga. */
export function observeSeconds(/** @type {any} */ move) {
  const g = /** @type {any} */ (C.world)[move.group] ?? {};
  return (g.cast ?? move.def.duration ?? 0.5) + (g.active ?? 0.75) + (g.dissipate ?? 0.5) + 0.8;
}

/**
 * Cenário do palco para um Move: azul (slot 1) usa o Move uma vez a `distance` m do alvo; o vermelho fica parado ou em guarda.
 * @param {{id: string, group: string, def: any, name: string}} move
 * @param {{distance?: number, target?: string}} [stage]
 */
export function makeMoveScenario(move, stage = {}) {
  const distance = Math.min(DISTANCE_RANGE.max, Math.max(DISTANCE_RANGE.min, stage.distance ?? DEFAULT_STAGE.distance));
  const target = stage.target ?? DEFAULT_STAGE.target;
  const seconds = () => observeSeconds(move);
  return {
    id: `editor-${move.id}`, name: `Editor · ${move.name} (alvo a ${distance} m, ${target === 'guard' ? 'defendendo' : 'parado'})`,
    description: 'Cenário gerado pelo Editor de Moves.',
    positions: [vec(0, -distance / 2), vec(0, distance / 2)],
    ticks: () => Math.ceil(seconds() / C.test.step),
    setup(/** @type {any} */ g) {
      g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
      g.setLoadout(0, [move.id]);g.setLoadout(1, []);
    },
    script(/** @type {number} */ t) {
      const blue = t === 1 ? cmd({target: 1, skill: 0, skillHeld: HELD(0)}) : cmd({target: 1});
      const red = target === 'guard' ? cmd({target: 0, guard: true, guardPressed: t === 0}) : cmd({target: 0});
      return [blue, red];
    },
    /** Resumo em números (linhas «esperado × obtido» no formato dos cenários). */
    checks({log, game, start}) {
      const red = game.fighters[1], blue = game.fighters[0];
      const hits = log.events.filter((/** @type {any} */ e) => e.attacker === 0 && e.target === 1 && e.result !== 'invulnerable');
      const first = hits[0];
      const dmg = start[1].hp - red.hp;
      const blind = (red.statuses ?? []).some((/** @type {any} */ s) => s.id === 'blind') || log.events.some((/** @type {any} */ e) => e.result === 'blinded' && e.target === 1);
      const spent = start[0].stamina - blue.stamina;
      const row = (/** @type {string} */ label, /** @type {any} */ actual, ok = true, expected = '—') => ({label, expected, actual: String(actual), ok});
      return [
        row('Acertou o alvo', hits.length ? `sim (${first.result})` : 'não', hits.length > 0, 'sim'),
        row('Dano causado ao alvo', `${dmg.toFixed(1)} HP`),
        row('Cegueira aplicada', blind ? 'sim' : 'não'),
        row('Custo de stamina do Move', `${(/** @type {any} */ (C.world)[move.group]?.cost ?? move.def.cost).toFixed(2)}`),
        row('Stamina líquida gasta pelo azul (com a regeneração)', `${spent.toFixed(2)}`),
        row('Recarga restante do Move (azul)', `${(blue.moveCooldowns?.[move.id] ?? 0).toFixed(1)} s`),
      ];
    },
  };
}

/** `move.json` com os valores de mecânica ATUAIS (os sliders), pronto para colar no arquivo do Move. */
export function currentMoveJson(/** @type {{def: any, params: any, visual: any}} */ move, /** @type {any} */ world = C.world) {
  const g = world[move.params.group] ?? {};
  const rows = move.params.rows.map((/** @type {any} */ r) => { const {approved, ...rest} = r; return r.key in g ? {...rest, value: g[r.key]} : rest; });
  const hs = rows.filter((/** @type {any} */ r) => String(r.key).startsWith('hitShake'));
  const body = rows.filter((/** @type {any} */ r) => !String(r.key).startsWith('hitShake'));
  const def = {...move.def};
  for (const [k, key] of [['cost', 'cost'], ['cooldown', 'cooldown'], ['duration', 'cast']]) if (typeof g[key] === 'number') def[k] = g[key];
  return {schemaVersion: 1, def, params: {group: move.params.group, title: move.params.title, hint: move.params.hint, ...(move.params.meta ? {meta: move.params.meta} : {}), rows: [...body, ...(hs.length ? [{preset: 'hitShake'}] : [])]}, ...(move.visual ? {visual: move.visual} : {})};
}
