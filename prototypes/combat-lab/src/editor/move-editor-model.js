// @ts-check
// Modelo do Editor de Moves (sem interface): monta o CENÁRIO de teste de um Move (azul executa, vermelho é o alvo) e resume o resultado em números.
// Roda no mesmo Game/World da partida (prepareScenario), então dano, empurrão, cegueira, custo e recarga são os do jogo. Testável sem navegador.
import {C} from '../sim/config.js';
import {emptyCommand} from '../sim/entity.js';
import {vec} from '../sim/math.js';

/** Estados do alvo que o palco sabe montar. */
export const TARGET_STATES = [['still', 'Parado'], ['guard', 'Defendendo']];
export const DEFAULT_STAGE = {distance: 3, target: 'still', hold: 0};
export const DISTANCE_RANGE = {min: 1, max: 12, step: .25};
export const HOLD_RANGE = {min: 0, max: 3, step: .05};

const cmd = (/** @type {any} */ o) => ({...emptyCommand(), ...o});
const HELD = (/** @type {number} */ slot) => Array.from({length: C.world.slots}, (_, i) => i === slot);

/** Moves que se usam SEGURANDO o botão (mira com marcador ou carga): o palco libera o controle «Segurar o botão». */
export const needsHold = (/** @type {any} */ move) => !!(move.def.charge || move.def.aimMode);
/** Tempo (s) de botão segurado sugerido para o Move: o mínimo que o motor aceita costuma ser curto; mira e carga ganham uma folga. */
/** Dica do palco para Moves de mira por marcador: com o alvo travado o marcador nasce em cima dele. */
export const holdHint = (/** @type {any} */ move) => move.def.aimMode === 'marker' ? 'Mira por marcador: o marcador nasce sobre o alvo travado. Armadilhas (Spikes) só armam em chão livre: afaste o alvo além do alcance.' : move.def.charge ? 'Move de carga: o tempo segurando define o nível de carga (PL).' : '';
export function suggestedHold(/** @type {any} */ move) {return move.def.charge ? Math.max(0.6, (move.def.charge.min ?? 0) + 0.3) : move.def.aimMode ? 0.3 : 0;}   // carga: acima do mínimo do Move (Reflect exige 0,9 s)

/** Duração (s) que vale a pena observar: preparação + janela ativa + dissipação + folga (+ o tempo segurando). */
export function observeSeconds(/** @type {any} */ move, hold = 0) {
  const g = /** @type {any} */ (C.world)[move.group] ?? {};
  const base = (g.cast ?? move.def.duration ?? 0.5) + (g.active ?? 0.75) + (g.dissipate ?? 0.5);
  return Math.min(12, base + hold + 1.2);
}

/**
 * Cenário do palco para um Move: azul (slot 1) usa o Move uma vez a `distance` m do alvo; o vermelho fica parado ou em guarda.
 * `hold` (s) = tempo com o botão apertado (mira/carga). O resumo é genérico: serve a golpes, projéteis, campos e buffs.
 * @param {{id: string, group: string, def: any, name: string}} move
 * @param {{distance?: number, target?: string, hold?: number}} [stage]
 */
export function makeMoveScenario(move, stage = {}) {
  const distance = Math.min(DISTANCE_RANGE.max, Math.max(DISTANCE_RANGE.min, stage.distance ?? DEFAULT_STAGE.distance));
  const target = stage.target ?? DEFAULT_STAGE.target;
  const hold = needsHold(move) ? Math.min(HOLD_RANGE.max, Math.max(0, stage.hold ?? suggestedHold(move))) : 0;
  const holdTicks = Math.round(hold / C.test.step);
  const seconds = () => observeSeconds(move, hold);
  return {
    id: `editor-${move.id}`, name: `Editor · ${move.name} (alvo a ${distance} m, ${target === 'guard' ? 'defendendo' : 'parado'}${hold ? `, botão ${hold.toFixed(2)} s` : ''})`,
    description: 'Cenário gerado pelo Editor de Moves.',
    positions: [vec(0, -distance / 2), vec(0, distance / 2)],
    ticks: () => Math.ceil(seconds() / C.test.step),
    setup(/** @type {any} */ g) {
      g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
      g.setLoadout(0, [move.id]);g.setLoadout(1, []);
    },
    script(/** @type {number} */ t, /** @type {any} */ g, /** @type {any} */ scratch) {
      // anota o que apareceu durante o teste (status nos dois lutadores e tipos de entidade criados): o resumo usa isso no fim
      scratch.status ??= [new Set(), new Set()];scratch.kinds ??= new Set();
      g?.fighters?.forEach((/** @type {any} */ f, /** @type {number} */ i) => {for (const st of f.statuses ?? []) scratch.status[i].add(st.id);});
      for (const e of g?.world?.entities ?? []) scratch.kinds.add(e.kind);
      const pressed = t >= 1 && t <= 1 + holdTicks;
      const blue = pressed ? cmd({target: 1, skill: t === 1 ? 0 : null, skillHeld: HELD(0)}) : cmd({target: 1});
      const red = target === 'guard' ? cmd({target: 0, guard: true, guardPressed: t === 0}) : cmd({target: 0});
      return [blue, red];
    },
    /** Resumo em números (linhas «esperado × obtido» no formato dos cenários). */
    checks({log, game, start, scratch}) {
      const red = game.fighters[1], blue = game.fighters[0];
      const hits = log.events.filter((/** @type {any} */ e) => e.attacker === 0 && e.target === 1 && e.result !== 'invulnerable' && e.result !== 'blinded' && e.result !== 'sandStagger');
      const first = hits[0];
      const dmg = start[1].hp - red.hp;
      const blind = (scratch.status?.[1] ?? new Set()).has('blind') || log.events.some((/** @type {any} */ e) => e.result === 'blinded' && e.target === 1);
      const spent = start[0].stamina - blue.stamina;
      const FAIL_TEXT = /** @type {Record<string, string>} */ ({invalidMarker: 'marcador inválido (ocupado, fora do alcance ou bloqueado): a mira foi cancelada sem gastar nada', noGround: 'precisa estar no chão', entityLimit: 'limite de entidades', semEspaco: 'sem espaço', semCargaMinima: 'carga abaixo do mínimo: segure o botão por mais tempo', semCarga: 'sem carga', minCharge: 'botão solto antes da carga mínima: nada foi criado, segure por mais tempo'});
      const failures = [...new Set(log.events.filter((/** @type {any} */ e) => (e.result === 'moveFailed' && e.attacker === 0) || e.result === 'aimCancel' || e.result === 'chargeInterrupt').map((/** @type {any} */ e) => FAIL_TEXT[String(e.reason)] ?? String(e.reason ?? 'falhou')))];
      const list = (/** @type {Set<string> | undefined} */ set) => set && set.size ? [...set].join(', ') : 'nenhum';
      const row = (/** @type {string} */ label, /** @type {any} */ actual, ok = true, expected = '—') => ({label, expected, actual: String(actual), ok});
      return [
        row('Acertou o alvo', hits.length ? `sim (${first.result})` : 'não'),
        row('Dano causado ao alvo', `${dmg.toFixed(1)} HP`),
        row('Cegueira aplicada', blind ? 'sim' : 'não'),
        row('Status no alvo', list(scratch.status?.[1])),
        row('Status no azul', list(scratch.status?.[0])),
        row('Entidades criadas', list(scratch.kinds)),
        row('Falha ao usar o Move', failures.length ? failures.join(' · ') : 'nenhuma', failures.length === 0),
        row('Custo de stamina do Move', `${(/** @type {any} */ (C.world)[move.group]?.cost ?? move.def.cost ?? 0).toFixed(2)}`),
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
