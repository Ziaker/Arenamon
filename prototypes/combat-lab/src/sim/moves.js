// @ts-check
// Movimentos especiais (golpes dos Pokémon): registro, validação e execução. Infraestrutura SEM conteúdo — o registro
// começa vazio; os movimentos serão adicionados depois, um a um, só com dados (ver MOVIMENTOS.md).
//
// Um movimento é uma ação do lutador (kind 'move'), no mesmo controlador que X e C: custa stamina, tem recarga, ocupa
// um dos slots do lutador (C.world.slots) e, ao longo da duração, dispara uma LINHA DO TEMPO de efeitos:
//   • spawn  — cria uma entidade do mundo (projétil, barreira, parede, área/explosão) relativa ao lutador;
//   • status — aplica um buff/debuff (a si ou ao adversário);
//   • hit    — golpe corpo a corpo instantâneo (uma área curta à frente, pela mesma função de acerto);
//   • effect — efeito com código próprio, por nome (move-effects.js), para lógica que depende da execução (ex.: carga).
// Movimentos de CARGA (`charge`): segurar o botão carrega, soltar executa; ver charge.js e o controlador. Neles `duration` é
// opcional e todos os eventos da linha do tempo disparam NA SOLTURA (`at` é ignorado).
// Deslocamento opcional (motion) e janelas próprias de invulnerabilidade e de cancelamento.
import {C} from './config.js';
import {altitudeOf} from './entity.js';
import {validateEntity, DEFAULTS} from './world.js';
import {validateStatus} from './status.js';
import {CHARGE_OVERRIDES} from './charge.js';

const REGISTRY = new Map();
/** Preparações de Moves que viram AÇÃO DE TACKLE (`def.tackle` = nome): (f, action, P, ctx) ajusta duração, distância, dano, knockback e janelas da ação. */
const TACKLE_SETUPS = new Map();
export const registerTackleSetup = (/** @type {string} */ name, /** @type {Function} */ fn) => {TACKLE_SETUPS.set(name, fn);return name;};
export const getTackleSetup = (/** @type {string} */ name) => TACKLE_SETUPS.get(name) ?? null;
export const MOVE_SCHEMA_VERSION = 1;
const AIMS = ['target', 'facing', 'input'], MOTIONS = ['none', 'root', 'dash', 'walk'], TARGETS = ['self', 'opponent'];

/**
 * Valida a definição (lança Error com o motivo). Campos:
 *   id, name, description?, type? (tipo Pokémon, texto livre), category? ('physical' | 'special' | 'status'),
 *   duration (s, > 0), cost (stamina, padrão 1), cooldown (s, padrão 0), cancelAfter (s; a partir daí X/C/D/movimento
 *   podem interromper; padrão = duration), cancelFrom (tipos de ação que este movimento pode interromper, ex.: ['dodge']),
 *   fromGuard (padrão true), fromGuardStun (padrão false), invulnerable ([t0, t1] em s), aim ('target' | 'facing' | 'input'),
 *   motion ({type: 'none' | 'root' | 'dash', distance, start, end}), animation (id do bloco de animação; padrão move_<slot>),
 *   timeline: [{at, spawn | status (+ target) | hit | effect}],
 *   charge ({max (s, padrão 4) e substituições de C.world.charge}: movimento de carga), cooldownBoost (padrão true em TODO Move; false: desliga. Novo toque durante a recarga
 *   gasta stamina para encurtá-la, M2.3)
 * @param {import('./types').MoveDef} def
 */
export function validateMove(def) {
  const fail = m => {throw new Error(`movimento ${def?.id ?? '?'}: ${m}`);};
  if (!def || typeof def.id !== 'string' || !def.id) throw new Error('movimento sem id');
  if (!def.charge && !((def.duration ?? 0) > 0)) fail('duration deve ser > 0');
  if (def.duration !== undefined && !(def.duration > 0)) fail('duration deve ser > 0');
  if (def.charge) {
    if (typeof def.charge !== 'object') fail('charge deve ser um objeto');
    if (def.charge.max !== undefined && !(def.charge.max > 0)) fail('charge.max deve ser > 0');
    if (def.charge.group !== undefined && !(C.world[def.charge.group] && typeof C.world[def.charge.group] === 'object')) fail(`charge.group desconhecido (${def.charge.group})`);
    for (const k of CHARGE_OVERRIDES) if (def.charge[k] !== undefined && !(def.charge[k] >= 0)) fail(`charge.${k} inválido`);
  }
  if (def.cooldownBoost !== undefined && typeof def.cooldownBoost !== 'boolean') fail('cooldownBoost deve ser booleano');
  if (def.group !== undefined && !(C.world[def.group] && typeof C.world[def.group] === 'object')) fail(`group desconhecido (${def.group}): precisa existir em C.world`);
  if (def.tackle !== undefined && (typeof def.tackle !== 'string' || !def.tackle)) fail('tackle deve ser o nome de uma preparação registrada');
  if (def.aimMode !== undefined && (!['marker', 'follow'].includes(def.aimMode) || !def.group)) fail("aimMode so aceita 'marker' ou 'follow' e exige group (os parametros do marcador vem de C.world[group])");
  if (def.groundOnly !== undefined && typeof def.groundOnly !== 'boolean') fail('groundOnly deve ser booleano');
  if (def.feint !== undefined && typeof def.feint !== 'boolean') fail('feint deve ser booleano');
  if (def.needsTarget !== undefined && (typeof def.needsTarget !== 'string' || !def.group)) fail('needsTarget deve ser a chave (em C.world[group]) do alcance de aquisição');
  for (const k of ['cost', 'cooldown', 'cancelAfter']) if (def[k] !== undefined && !(def[k] >= 0)) fail(`${k} inválido`);
  if (def.aim && !AIMS.includes(def.aim)) fail(`aim desconhecido (${def.aim})`);
  if (def.motion && !MOTIONS.includes(def.motion.type)) fail(`motion desconhecido (${def.motion.type})`);
  if (def.invulnerable && !(Array.isArray(def.invulnerable) && def.invulnerable[0] <= def.invulnerable[1])) fail('invulnerable deve ser [início, fim]');
  for (const [i, ev] of (def.timeline || []).entries()) {
    if (!def.charge && !((ev.at ?? -1) >= 0 && (ev.at ?? 0) <= (def.duration ?? 0))) fail(`timeline[${i}].at fora da duração`);
    const kinds = ['spawn', 'status', 'hit', 'effect'].filter(k => ev[k]);if (kinds.length !== 1) fail(`timeline[${i}] precisa de exatamente um entre spawn, status, hit e effect`);
    if (ev.effect && typeof ev.effect !== 'string') fail(`timeline[${i}].effect deve ser o nome de um efeito`);
    if (ev.spawn) validateEntity(ev.spawn);if (ev.status) validateStatus(ev.status);
    if (ev.target && !TARGETS.includes(ev.target)) fail(`timeline[${i}].target desconhecido`);
  }
  return true;
}
/**
 * Registra um movimento (sobrescreve o de mesmo id). Nenhum movimento é registrado pelo laboratório.
 * @param {import('./types').MoveDef} def
 */
export function registerMove(def) {validateMove(def);REGISTRY.set(def.id, Object.freeze(structuredClone(def)));return def.id;}
export const unregisterMove = id => REGISTRY.delete(id);
/** Campos da definição que os sliders do grupo (`def.group` → C.world[grupo]) sobrepõem: cost, cooldown, cast (= duration) e cancelAfter. */
const GROUP_OVERRIDES = {cost: 'cost', cooldown: 'cooldown', cast: 'duration', cancelAfter: 'cancelAfter'};
/** Definição EFETIVA: a registrada + sliders do grupo do Move. Sem `group` (Reflect/Psyshock) é a própria definição (zero custo, zero mudança). */
export function effectiveMove(def) {
  const g = def.group ? C.world[def.group] : null;
  if (!g) return def;
  const out = {...def};
  for (const [k, field] of Object.entries(GROUP_OVERRIDES)) if (typeof g[k] === 'number') out[field] = g[k];
  if (def.durationKeys) out.duration = def.durationKeys.reduce((s, k) => s + (typeof g[k] === 'number' ? g[k] : 0), 0);   // duração = soma de sliders do grupo (Bullet Punch: preparação + desaparecimento)
  if (def.invulnerableKeys) out.invulnerable = [g[def.invulnerableKeys[0]], g[def.invulnerableKeys[1]]];   // janela de i-frames ajustável nos sliders do grupo
  if (def.timeline) out.timeline = def.timeline.map(ev => ev.atKeys ? {...ev, at: ev.atKeys.reduce((s, k) => s + (g[k] ?? 0), 0)} : ev.atKey && typeof g[ev.atKey] === 'number' ? {...ev, at: g[ev.atKey]} : ev);   // atKey: o instante vem de um slider (ex.: 'cast')
  return Object.freeze(out);
}
export const getMove = id => {const d = id ? REGISTRY.get(id) : null;return d ? effectiveMove(d) : null;};
export const listMoves = () => [...REGISTRY.values()];
/** Esvazia o registro (testes). */
export const clearMoves = () => REGISTRY.clear();

/**
 * Adversário ELEGÍVEL mais próximo a até `range` m (distância horizontal): vivo, no chão (o Tackle não alcança quem está em voo) e com diferença de altura
 * que o corpo alcança. Desempate determinístico pelo id. Usado por Moves com aquisição automática de alvo (Quick Attack).
 */
export function nearestEligible(f, fighters, range) {
  let best = null, bd = Infinity;
  const bodyH = C.extras?.visual?.bodyHeight ?? 1.2, fy = altitudeOf(f);
  for (const o of fighters) {
    if (o.id === f.id || o.hp <= 0 || o.absent || (o.flight && !o.wallSplat)) continue;
    const oy = (o.groundY ?? 0) + (o.vaultHeight ?? 0);
    if (Math.abs(fy - oy) > bodyH) continue;
    const d = Math.hypot(o.position.x - f.position.x, o.position.z - f.position.z);
    if (d <= range + 1e-9 && (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && best && o.id < best.id))) {bd = d;best = o;}
  }
  return best;
}

/** Movimento equipado no slot (ou null). Os slots ficam em f.loadout (ids). */
export const moveInSlot = (f, slot) => getMove(f.loadout?.[slot]);
/** Equipa ids nos slots de um lutador (ids inexistentes são recusados). */
export function setLoadout(f, ids) {
  const slots = C.world.slots, list = Array.from({length: slots}, (_, i) => ids?.[i] ?? null);
  for (const id of list) if (id && !REGISTRY.has(id)) throw new Error(`movimento não registrado: ${id}`);
  f.loadout = list;return list;
}
/** Parâmetros de tempo de uma ação 'move' (para o resto do motor tratá-la como qualquer ação). */
export function moveSpec(action) {
  const d = action.def ?? getMove(action.move);
  if (!d) return {duration: 0, chainAfter: 0, invulnerable: 0, invulnerableFrom: 0, recovery: 0};
  return {duration: d.duration, chainAfter: d.cancelAfter ?? d.duration, invulnerable: d.invulnerable?.[1] ?? 0, invulnerableFrom: d.invulnerable?.[0] ?? 0, recovery: 0};
}

/** Posição/direção de uma entidade relativa ao lutador: offset {forward, side, up}, rotação do rumo em `angle` (rad). */
export function placeRelative(f, heading, template) {
  const o = template.offset || {}, s = Math.sin(heading), c = Math.cos(heading), fw = o.forward ?? 0, sd = o.side ?? 0, ang = heading + (template.angle ?? 0);
  return {...template, owner: template.owner ?? f.id, pos: {x: f.position.x + s * fw + c * sd, z: f.position.z + c * fw - s * sd}, y: (template.y ?? DEFAULTS[template.kind]?.y ?? 0) + (o.up ?? 0) + ((f.flight?.y ?? 0) + (f.vaultHeight ?? 0)), angle: ang, dir: {x: Math.sin(ang), z: Math.cos(ang)}};
}
