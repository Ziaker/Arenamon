// @ts-check
// Captura de bug reproduzível com um clique (#11 do plano de 23/10/2026): um pacote JSON autocontido com tudo o que é preciso para ver o
// defeito de novo — semente, comandos de cada tick, ajustes, equipamento, snapshot exato do motor no instante do clique, eventos recentes,
// entidades e status próximos e os erros capturados. Não coleta dados pessoais (sem usuário, caminhos, navegador ou rede) e nada fica só no
// localStorage: o pacote vai para um arquivo. Importar reproduz o estado e avisa se a configuração ou a versão mudaram.
import {C} from './config.js';
import {configHash, runRecording, normalizeState, firstDivergence} from './replay-diff.js';

export const BUG_SCHEMA = 'arenamon-bug';
export const BUG_VERSION = 1;
/** Tira caminhos locais (file:///C:/Users/...) das mensagens de erro: o pacote não pode levar dados do computador de quem capturou. */
export const scrubPaths = (/** @type {any} */ s) => String(s).replace(/file:\/\/\/[^\s)]*\//g, '<local>/').replace(/[A-Za-z]:[\\/][^\s)]*[\\/]/g, '<local>/');

/** JSON que preserva Set e Map (o snapshot do motor guarda conjuntos de acertos). */
export const encodeBug = (/** @type {any} */ data) => JSON.stringify(data, (_, v) => v instanceof Set ? {__set: [...v]} : v instanceof Map ? {__map: [...v]} : v);
const revive = (/** @type {any} */ v) => {
  if (Array.isArray(v)) return v.map(revive);
  if (v && typeof v === 'object') {
    if (Array.isArray(v.__set) && Object.keys(v).length === 1) return new Set(v.__set.map(revive));
    if (Array.isArray(v.__map) && Object.keys(v).length === 1) return new Map(v.__map.map((/** @type {any} */ e) => revive(e)));
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)]));
  }
  return v;
};

/**
 * Monta o pacote. `recording` é o MatchRecording (ou seu toJSON) da partida em curso.
 * @param {{game: any, recording: any, appVersion?: string, note?: string, errors?: string[]}} p
 */
export function captureBug({game, recording, appVersion = 'desconhecida', note = '', errors = []}) {
  const rec = typeof recording?.toJSON === 'function' ? recording.toJSON() : recording;
  const near = (/** @type {any} */ e) => ({id: e.id, kind: e.kind, owner: e.owner, x: e.pos?.x, z: e.pos?.z, life: e.life, age: e.age, dead: !!e.dead});
  return {
    schema: BUG_SCHEMA, version: BUG_VERSION, appVersion, createdAt: new Date().toISOString(), note: String(note).slice(0, 2000),
    tick: game.tick, seed: rec?.seed ?? null, startPositions: rec?.positions ?? null, configHash: configHash(),
    moveLoadouts: structuredClone(game.loadouts), passiveLoadouts: structuredClone(game.passiveLoadouts), passiveIdentity: structuredClone(game.passiveIdentity),
    recording: rec, snapshot: game.save(),
    recentEvents: structuredClone(game.events ?? []),
    fighters: game.fighters.map((/** @type {any} */ f) => ({id: f.id, hp: f.hp, stamina: f.stamina, state: f.state, action: f.action?.kind ?? null, move: f.action?.move ?? null, loadout: f.loadout, statuses: (f.statuses ?? []).map((/** @type {any} */ s) => ({id: s.id, remaining: s.remaining}))})),
    entities: (game.world?.entities ?? []).slice(0, 64).map(near),
    errors: errors.slice(0, 20).map(e => scrubPaths(e).slice(0, 500)),
  };
}

/** Valida um pacote (texto ou objeto). Recusa JSON inválido, outro esquema e versões que este laboratório não conhece. */
export function parseBugCapture(/** @type {any} */ raw) {
  let data;
  try {data = typeof raw === 'string' ? JSON.parse(raw) : raw;} catch (e) {return {error: 'JSON inválido: ' + /** @type {Error} */ (e).message};}
  if (data?.schema !== BUG_SCHEMA) return {error: 'Não é uma captura de bug do Arenamon.'};
  if (!Number.isInteger(data.version) || data.version < 1) return {error: `Versão de captura inválida (${data.version}).`};
  if (data.version > BUG_VERSION) return {error: `Captura da versão ${data.version}; este laboratório lê até a ${BUG_VERSION}. Atualize o laboratório.`};
  if (data.seed !== null && data.seed !== undefined && !Number.isFinite(data.seed)) return {error: 'Captura inválida: a semente precisa ser um número.'};
  if (!data.snapshot || !Array.isArray(data.snapshot.fighters) || !Number.isInteger(data.tick) || !data.recording) return {error: 'Captura incompleta (faltam snapshot, tick ou gravação).'};
  return {data: /** @type {any} */ (revive(data))};
}

/**
 * Restaura a captura num Game e confere a reprodução: avisa se configuração/versão mudaram e se refazer a gravação desde o início chega ao
 * mesmo estado do snapshot (prova de determinismo). Não altera a configuração.
 * @param {any} data pacote já validado
 * @param {any} game Game que receberá o snapshot (será sobrescrito)
 * @param {{appVersion?: string, verify?: boolean, setup?: ((game: any) => void) | null}} [opts] setup: mesmo ajuste de cena usado na partida capturada (cenários montados à mão)
 */
export function reproduceBugCapture(data, game, opts = {}) {
  /** @type {string[]} */ const warnings = [];
  if (data.configHash !== configHash()) warnings.push('A configuração atual é diferente da do momento da captura: o comportamento pode não se repetir. Aplique os ajustes da gravação (data.recording.values) para igualar.');
  if (opts.appVersion && data.appVersion && data.appVersion !== opts.appVersion) warnings.push(`Versão diferente: captura em ${data.appVersion}, laboratório em ${opts.appVersion}.`);
  game.load(data.snapshot);
  /** @type {boolean | null} */ let replayMatches = null;
  /** @type {{field: string, replayed?: any, snapshot?: any} | null} */ let divergence = null;
  if (opts.verify !== false) {
    const rec = data.recording, commands = rec.commands;   // commands já expandidos? (MatchRecording.toJSON comprime): expandir quando necessário
    const flat = Array.isArray(commands) && commands.length && Array.isArray(commands[0]) && typeof commands[0][0] === 'number' ? commands.flatMap((/** @type {[number, any]} */ [n, c]) => Array.from({length: n}, () => c)) : commands;
    const states = runRecording({meta: {...rec, moveLoadouts: data.moveLoadouts, positions: data.startPositions ?? rec.positions}, commands: flat.slice(0, data.tick), commands1: null}, {setup: opts.setup});
    const at = states[states.length - 1];
    if (!at) {replayMatches = false;divergence = {field: 'gravação vazia'};}
    else {
      const d = firstDivergence([at], [normalizeState(game)]);
      replayMatches = d.identical;
      if (!d.identical) divergence = {field: d.field, replayed: d.a, snapshot: d.b};
      if (!replayMatches) warnings.push(`Refazer a gravação desde o início NÃO chega ao estado capturado (${divergence?.field}): a gravação não cobre tudo (ex.: vermelho com IA ou controle manual) ou o motor mudou.`);
    }
  }
  return {game, warnings, replayMatches, divergence, tick: data.tick, note: data.note};
}
