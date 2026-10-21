// @ts-check
// Efeitos de status (buffs e debuffs). Infraestrutura sem conteúdo: nenhum status vem predefinido — cada movimento
// (futuro) descreve o próprio efeito ao aplicá-lo. Tudo é dado simples dentro do lutador (`f.statuses`), então entra
// em save/load, replay e cenários sem código extra, e é determinístico (passo fixo).
//
// Um status:
//   {id, source, duration, remaining, stacks, maxStacks, stacking, mul: {stat: fator}, add: {stat: valor},
//    flags: {rooted, silenced, disarmed, ...}, tick: {interval, damage, heal, stamina}, acc}
// stacking: 'refresh' (renova a duração, 1 pilha), 'stack' (soma pilhas até maxStacks e renova), 'independent'
// (instâncias separadas) ou 'ignore' (mantém a existente).
// Sem nenhum status ativo, todos os modificadores valem exatamente 1 (multiplicação) e 0 (soma): o motor fica
// idêntico ao de antes (verificado nos testes de paridade e regressão).

import {processDamageWithShieldAndStages} from './map.js';
import {dotFactor, passiveContribute} from './passive-engine.js';

/** Atributos que os modificadores podem alterar e onde o motor os usa. */
export const STATS = {
  speed: 'velocidade de locomoção (caminhada e sprint); não altera a distância nominal de X/C',
  attack: 'dano e força de lançamento dos tackles e dos acertos de movimentos',
  damageTaken: 'multiplicador do dano recebido (defesa < 1, vulnerabilidade > 1)',
  staminaRegen: 'velocidade da regeneração de stamina',
  staminaCost: 'multiplicador do custo de stamina de X, C e movimentos',
  knockbackTaken: 'multiplicador do lançamento recebido',
  cooldownRate: 'velocidade de recarga dos movimentos',
  mobilityCost: 'multiplicador do custo de stamina da esquiva (C) e do consumo do sprint (Second Wind)',
};
/** Flags reconhecidas pelo controlador (bloqueiam ações; o diagnóstico de comandos informa o motivo). */
export const FLAGS = {
  rooted: 'não anda nem corre (X/C/movimentos continuam permitidos)',
  silenced: 'não usa movimentos especiais',
  disarmed: 'não usa o tackle (X)',
  stunned: 'não age nem anda',
};
const STACKING = ['refresh', 'stack', 'independent', 'ignore'];

/**
 * Valida a descrição de um status (lança erro com motivo legível).
 * @param {import('./types').StatusDef} s
 */
export function validateStatus(s) {
  if (!s || typeof s.id !== 'string' || !s.id) throw new Error('status sem id');
  if (!(s.duration > 0)) throw new Error(`status ${s.id}: duração deve ser > 0`);
  if (s.stacking && !STACKING.includes(s.stacking)) throw new Error(`status ${s.id}: empilhamento desconhecido (${s.stacking})`);
  for (const k of [...Object.keys(s.mul || {}), ...Object.keys(s.add || {})]) if (!STATS[k]) throw new Error(`status ${s.id}: atributo desconhecido (${k})`);
  for (const k of Object.keys(s.flags || {})) if (!FLAGS[k]) throw new Error(`status ${s.id}: flag desconhecida (${k})`);
  if (s.tick && !(s.tick.interval > 0)) throw new Error(`status ${s.id}: tick precisa de intervalo > 0`);
  return true;
}

/**
 * Aplica um status a `f`. Devolve a instância (nova ou renovada) ou null (ignorado).
 * @param {any} f lutador (ver entity.js)
 * @param {import('./types').StatusDef} def
 * @param {{source?: number | null}} [opts]
 * @returns {import('./types').StatusInstance | null}
 */
export function applyStatus(f, def, {source = null} = {}) {
  validateStatus(def);
  f.statuses ??= [];
  const stacking = def.stacking ?? 'refresh', maxStacks = def.maxStacks ?? 1;
  const existing = stacking === 'independent' ? null : f.statuses.find(s => s.id === def.id);
  if (existing) {
    if (stacking === 'ignore') return null;
    existing.remaining = existing.duration = def.duration;
    if (stacking === 'stack') existing.stacks = Math.min(maxStacks, existing.stacks + 1);
    return existing;
  }
  const inst = {id: def.id, source, duration: def.duration, remaining: def.duration, stacks: 1, maxStacks, stacking, mul: {...(def.mul || {})}, add: {...(def.add || {})},
    flags: {...(def.flags || {})}, tick: def.tick ? {...def.tick} : null, acc: 0, tags: [...(def.tags || [])]};
  f.statuses.push(inst);return inst;
}
export function removeStatus(f, id) {const n = f.statuses?.length ?? 0;f.statuses = (f.statuses || []).filter(s => s.id !== id);return n - f.statuses.length;}
/** Remove por etiqueta (ex.: “debuff”, para um futuro movimento de purificação). */
export function cleanse(f, tag) {const n = f.statuses?.length ?? 0;f.statuses = (f.statuses || []).filter(s => !s.tags.includes(tag));return n - f.statuses.length;}

/** Multiplicador efetivo de um atributo (produto de fator^pilhas) e soma das parcelas aditivas. */
export function modifier(f, stat) {
  let mul = 1, add = 0;
  for (const s of f.statuses || []) {const m = s.mul[stat], a = s.add[stat];if (m !== undefined) mul *= m ** s.stacks;if (a !== undefined) add += a * s.stacks;}
  return {mul, add};
}
/** Valor efetivo: base × (Π mul^pilhas legado) × (1 + Σ pct das fontes novas) + Σ add. Sem status nem passivas, devolve exatamente `base`
 * (paridade verificada nos testes de não-regressão). Regra das passivas (R7–R11): acúmulo ADITIVO por fonte,
 * sem caps novos e sem arredondamento (ex.: 100 +20% +30abs = 150; 87×1,15 = 100,05 preservado). */
export function stat(f, key, base) {
  if (!f.statuses?.length && !f.passiveState) return base;
  const {mul, add} = modifier(f, key);
  const p = passiveContribute(f, key);
  return base * mul * (1 + p.pct) + add + p.add;
}
export const hasFlag = (f, flag) => !!f.statuses?.some(s => s.flags[flag]);

/**
 * Avança os status de `f` em dt: dano/cura/stamina periódicos e expiração. Devolve eventos de status
 * ({result: 'statusTick' | 'statusExpired', ...}) para a telemetria, os VFX e o diagnóstico.
 */
export function tickStatuses(f, dt, staminaMax) {
  if (!f.statuses?.length) return [];
  const events = [];
  for (const s of f.statuses) {
    s.remaining -= dt;
    if (s.tick) {
      s.acc += dt;
      while (s.acc >= s.tick.interval - 1e-9 && f.hp > 0) {
        s.acc -= s.tick.interval;
        const dmg = (s.tick.damage ?? 0) * s.stacks * stat(f, 'damageTaken', 1) * dotFactor(f), heal = (s.tick.heal ?? 0) * s.stacks;
        let actualDmg = dmg;
        if (dmg > 0) {
          const res = processDamageWithShieldAndStages(f, dmg, s.source !== undefined ? {id: s.source} : null, false, false, {category: 'periodic'});
          actualDmg = res.hpDamage;
          if (f.hp === 0) {f.guard = false;f.guardSuppressed = true;}
        }
        if (heal) f.hp = Math.min(f.attributes.hp, f.hp + heal);
        if (s.tick.stamina) {f.stamina = Math.max(0, Math.min(staminaMax, f.stamina + s.tick.stamina * s.stacks));f.regenBase = f.stamina;}
        events.push({result: 'statusTick', target: f.id, attacker: s.source, status: s.id, damage: actualDmg, heal});
      }
    }
  }
  for (const s of f.statuses) if (s.remaining <= 1e-9) events.push({result: 'statusExpired', target: f.id, attacker: s.source, status: s.id, damage: 0});
  f.statuses = f.statuses.filter(s => s.remaining > 1e-9);
  return events;
}
