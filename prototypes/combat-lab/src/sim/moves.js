// Movimentos especiais (golpes dos Pokémon): registro, validação e execução. Infraestrutura SEM conteúdo — o registro
// começa vazio; os movimentos serão adicionados depois, um a um, só com dados (ver MOVIMENTOS.md).
//
// Um movimento é uma ação do lutador (kind 'move'), no mesmo controlador que X e C: custa stamina, tem recarga, ocupa
// um dos slots do lutador (C.world.slots) e, ao longo da duração, dispara uma LINHA DO TEMPO de efeitos:
//   • spawn  — cria uma entidade do mundo (projétil, barreira, parede, área/explosão) relativa ao lutador;
//   • status — aplica um buff/debuff (a si ou ao adversário);
//   • hit    — golpe corpo a corpo instantâneo (uma área curta à frente, pela mesma função de acerto).
// Deslocamento opcional (motion) e janelas próprias de invulnerabilidade e de cancelamento.
import {C} from './config.js';
import {validateEntity, DEFAULTS} from './world.js';
import {validateStatus} from './status.js';

const REGISTRY = new Map();
export const MOVE_SCHEMA_VERSION = 1;
const AIMS = ['target', 'facing', 'input'], MOTIONS = ['none', 'root', 'dash'], TARGETS = ['self', 'opponent'];

/**
 * Valida a definição (lança Error com o motivo). Campos:
 *   id, name, description?, type? (tipo Pokémon, texto livre), category? ('physical' | 'special' | 'status'),
 *   duration (s, > 0), cost (stamina, padrão 1), cooldown (s, padrão 0), cancelAfter (s; a partir daí X/C/D/movimento
 *   podem interromper; padrão = duration), cancelFrom (tipos de ação que este movimento pode interromper, ex.: ['dodge']),
 *   fromGuard (padrão true), fromGuardStun (padrão false), invulnerable ([t0, t1] em s), aim ('target' | 'facing' | 'input'),
 *   motion ({type: 'none' | 'root' | 'dash', distance, start, end}), animation (id do bloco de animação; padrão move_<slot>),
 *   timeline: [{at, spawn | status (+ target) | hit}]
 */
export function validateMove(def) {
  const fail = m => {throw new Error(`movimento ${def?.id ?? '?'}: ${m}`);};
  if (!def || typeof def.id !== 'string' || !def.id) throw new Error('movimento sem id');
  if (!(def.duration > 0)) fail('duration deve ser > 0');
  for (const k of ['cost', 'cooldown', 'cancelAfter']) if (def[k] !== undefined && !(def[k] >= 0)) fail(`${k} inválido`);
  if (def.aim && !AIMS.includes(def.aim)) fail(`aim desconhecido (${def.aim})`);
  if (def.motion && !MOTIONS.includes(def.motion.type)) fail(`motion desconhecido (${def.motion.type})`);
  if (def.invulnerable && !(Array.isArray(def.invulnerable) && def.invulnerable[0] <= def.invulnerable[1])) fail('invulnerable deve ser [início, fim]');
  for (const [i, ev] of (def.timeline || []).entries()) {
    if (!(ev.at >= 0 && ev.at <= def.duration)) fail(`timeline[${i}].at fora da duração`);
    const kinds = ['spawn', 'status', 'hit'].filter(k => ev[k]);if (kinds.length !== 1) fail(`timeline[${i}] precisa de exatamente um entre spawn, status e hit`);
    if (ev.spawn) validateEntity(ev.spawn);if (ev.status) validateStatus(ev.status);
    if (ev.target && !TARGETS.includes(ev.target)) fail(`timeline[${i}].target desconhecido`);
  }
  return true;
}
/** Registra um movimento (sobrescreve o de mesmo id). Nenhum movimento é registrado pelo laboratório. */
export function registerMove(def) {validateMove(def);REGISTRY.set(def.id, Object.freeze(structuredClone(def)));return def.id;}
export const unregisterMove = id => REGISTRY.delete(id);
export const getMove = id => (id ? REGISTRY.get(id) ?? null : null);
export const listMoves = () => [...REGISTRY.values()];
/** Esvazia o registro (testes). */
export const clearMoves = () => REGISTRY.clear();

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
  const d = getMove(action.move);
  if (!d) return {duration: 0, chainAfter: 0, invulnerable: 0, invulnerableFrom: 0, recovery: 0};
  return {duration: d.duration, chainAfter: d.cancelAfter ?? d.duration, invulnerable: d.invulnerable?.[1] ?? 0, invulnerableFrom: d.invulnerable?.[0] ?? 0, recovery: 0};
}

/** Posição/direção de uma entidade relativa ao lutador: offset {forward, side, up}, rotação do rumo em `angle` (rad). */
export function placeRelative(f, heading, template) {
  const o = template.offset || {}, s = Math.sin(heading), c = Math.cos(heading), fw = o.forward ?? 0, sd = o.side ?? 0, ang = heading + (template.angle ?? 0);
  return {...template, owner: template.owner ?? f.id, pos: {x: f.position.x + s * fw + c * sd, z: f.position.z + c * fw - s * sd}, y: (template.y ?? DEFAULTS[template.kind]?.y ?? 0) + (o.up ?? 0) + ((f.flight?.y ?? 0) + (f.vaultHeight ?? 0)), angle: ang, dir: {x: Math.sin(ang), z: Math.cos(ang)}};
}
