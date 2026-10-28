// Motor das habilidades passivas (CATÁLOGO EXPERIMENTAL). Regras implementadas (ordem 2026-10-20):
// R7–R11 acúmulo ADITIVO universal (resultado = base + base×Σ% + Σabs, via passiveContribute + status.js);
// R12–R14 ativações simultâneas avaliadas do mesmo estado, sem prioridade de slot; R15 cooldowns de passivas
// NUNCA passam por cooldownRate; R16–R18 cooldown começa no TÉRMINO do efeito (postEnd), término antecipado inicia
// na hora, efeitos instantâneos iniciam logo após a aplicação; R19 suspensão individual; R20 gatilhos da MESMA
// passiva ignorados durante o efeito ativo; R21 cooldowns avançam em stun/recuo (timers próprios no passo normal);
// R22 respawn/onRoundStart zera cooldowns de passivas; R23 KO encerra efeitos ativos imediatamente; R24–R25 hitstop
// congela cooldowns e durações (o engine só é chamado no passo normal — o retorno antecipado de Game.step fica
// intacto); R26–R29 efeitos permanecem aplicados e eventos reais processados no passo normal, com proteção técnica
// anti-ciclo (limite de profundidade + telemetria; R29 NÃO aprovou regra de negócio — pendência declarada).
// Determinismo: nenhum Date.now/Math.random aqui (timers em ticks do jogo e dt do passo fixo).

import {C} from './config.js';
import {wholeDamage} from './damage-rule.js';
import {resolveDamage, damageEventFields, sturdyGuard} from './resolvers/damage-resolver.js';
import {length, sub} from './math.js';
import {applyStatus} from './status.js';
import {chargeLevel} from './charge.js';
import {PASSIVE_BY_ID, validateLoadout} from './passives.js';

/** Profundidade máxima de encadeamento de eventos de passivas (proteção técnica anti-ciclo, R29). */
export const MAX_PASSIVE_CHAIN_DEPTH = 8;

export const passivesEnabled = () => !!C.extras?.toggles?.enablePassives;

/** Parâmetros experimentais vigentes de uma passiva (ajustáveis no painel, §29; congelados por snapshot na ativação). */
export const P = id => ({...(C.passivas?.[id] || {})});

/**
 * Estado serializável das passivas de um lutador (entra em save/load/replay como parte do lutador).
 * @param {any} f
 */
export function ensureState(f) {
  if (!f.passiveState) f.passiveState = {loadout: [], cooldowns: {}, actives: [], sturdyAvailable: false, sturdyUsed: false,
    lastDamageDealt: -1e9, lastDamageReceived: -1e9};
  return f.passiveState;
}
export const hasPassive = (f, id) => passivesEnabled() && !!f?.passiveState?.loadout?.includes(id);
const hasDebuff = f => !!f?.statuses?.some(s => s.tags?.includes('debuff'));
const distanceTo = (a, b) => length(sub(a.position, b.position));

/**
 * Equipa um loadout de passivas num lutador da partida (validação dupla: UI e motor, R5).
 * @param {any} game
 * @param {number} slot
 * @param {string[]} ids
 */
export function setPassiveLoadout(game, slot, ids) {
  const species = game.passiveIdentity?.[slot] ?? null;
  const errors = validateLoadout(ids, species);
  if (errors.length) return {ok: false, errors};
  game.passiveLoadouts ??= [[], []];
  game.passiveLoadouts[slot] = ids.filter(Boolean).slice(0, 2);
  if (game.fighters?.[slot]) ensureState(game.fighters[slot]).loadout = [...game.passiveLoadouts[slot]];
  return {ok: true, loadout: game.passiveLoadouts[slot]};
}

/** Liga o estado de passivas aos lutadores no início da partida (restaura Sturdy: fronteira de rodada, §7/R22). */
export function attachPassives(game) {
  if (!game.fighters) return;
  for (const f of game.fighters) {
    const st = ensureState(f);
    st.loadout = [...(game.passiveLoadouts?.[f.id] || [])];
    onRoundStart(game, f);
  }
}
/** Ciclo de rodada: Sturdy volta a ficar disponível (1 uso por rodada, §7). Não é chamado em load/replay/menu. */
export function onRoundStart(game, f) {
  const st = ensureState(f);
  if (hasPassive(f, 'sturdy')) {st.sturdyAvailable = true;st.sturdyUsed = false;}
}

/**
 * Ativa uma passiva (se todas as condições permitirem). Devolve true quando ativou.
 * Campos novos dos eventos: passive (id), result 'passiveActivated' | 'passiveBlocked'.
 */
function activate(game, owner, id, {target = null, events = [], depth = 0} = {}) {
  const def = PASSIVE_BY_ID[id];
  if (!def || owner.hp <= 0) return false;
  const st = ensureState(owner);
  if ((st.cooldowns[id] ?? 0) > 1e-9) return false;                                  // cooldown em curso (R16–R18)
  if (st.actives.some(a => a.id === id)) return false;                               // R20: sem renovar/duplicar
  const p = P(id);
  const pushActive = (who, duration) => ensureState(who).actives.push({id, owner: owner.id, remaining: duration, duration,
    cooldown: p.cooldown ?? 0, cooldownMode: def.cooldownMode, params: p});
  switch (id) {
    case 'poison-touch': {
      if (!target || target.hp <= 0 || !p.dps || !p.duration) return false;
      applyStatus(target, {id: 'passive-poison', duration: p.duration, stacking: 'refresh', tick: {interval: 1, damage: p.dps}, tags: ['debuff', 'poison']}, {source: owner.id});
      events.push({result: 'statusApplied', attacker: owner.id, target: target.id, damage: 0, status: 'passive-poison', passive: 'poison-touch'});
      pushActive(owner, p.duration);
      break;}
    case 'anticipation': if (!p.duration) return false; pushActive(owner, p.duration); break;
    case 'forewarn': if (!p.maxDuration) return false; pushActive(owner, p.maxDuration); break;
    case 'effect-spore': if (!target || !p.duration) return false; pushActive(target, p.duration); break;
    case 'rough-skin': {
      if (!target || target.hp <= 0 || !p.reflectDamage) return false;
      // Refletido: ignora escudo e estágios de Defesa, sem Sturdy; registra só lastAttacker (lastDamagedTick fica como estava).
      const res = resolveDamage({target, attacker: owner, rawDamage: Math.min(target.hp, wholeDamage(p.reflectDamage)), sourceKind: 'reflected', contact: 'reflected',
        policy: {bypassShield: true, bypassDefense: true, trackAttacker: false}});
      target.lastAttacker = owner.id;
      const tst = ensureState(target);tst.lastDamageReceived = game.tick;
      ensureState(owner).lastDamageDealt = game.tick;
      events.push({result: 'passiveReflect', attacker: owner.id, target: target.id, damage: res.hpDamage, ...damageEventFields(res), passive: 'rough-skin', contact: 'reflected'});
      break;}
    case 'regenerator': {
      if (!p.heal) return false;
      const before = owner.hp;
      owner.hp = Math.min(owner.attributes.hp, owner.hp + p.heal);
      events.push({result: 'passiveHeal', attacker: owner.id, target: owner.id, damage: 0, heal: owner.hp - before, passive: 'regenerator'});
      break;}
    case 'unburden': if (!p.duration) return false; pushActive(owner, p.duration); break;
    case 'stamina': if (!p.duration) return false; pushActive(owner, p.duration); break;
    case 'defiant': if (!p.duration) return false; pushActive(owner, p.duration); break;
    default: return false;
  }
  if (def.cooldownMode === 'instant' && (p.cooldown ?? 0) > 0) st.cooldowns[id] = p.cooldown;   // R18
  events.push({result: 'passiveActivated', attacker: owner.id, target: target ? target.id : null, damage: 0, passive: id, depth});
  return true;
}

const stampDamage = (game, a, t) => {ensureState(a).lastDamageDealt = game.tick;ensureState(t).lastDamageReceived = game.tick;};

/**
 * Processa os eventos do passo em busca de gatilhos de passivas. Devolve os eventos novos (incl. ativações,
 * reflexões, bloqueios). Encadeamento imediato com proteção de profundidade (R29 técnico).
 */
export function passiveOnEvents(game, events, depth = 0) {
  if (!passivesEnabled() || !events?.length) return [];
  const out = [];
  if (depth > MAX_PASSIVE_CHAIN_DEPTH) {out.push({result: 'passiveCycleSuspect', attacker: null, target: null, damage: 0, detail: {depth}});return out;}
  for (const e of events) {
    if (e.result === 'passiveActivated' || e.result === 'passiveReady' || e.result === 'passiveEnded') continue;
    // R31: detecção de processamento repetido do mesmo evento (por ID estável, quando houver).
    if (e.id != null) {if (game.passiveProcessed?.has(e.id)) {out.push({result: 'passiveCycleSuspect', attacker: null, target: null, damage: 0, detail: {reason: 'duplicateEvent', id: e.id}});continue;}game.passiveProcessed?.add(e.id);}
    const outBefore = out.length;   // R31: eventos gerados a partir deste carregam a causa (id do evento origem)
    const A = e.attacker != null ? game.fighters[e.attacker] : null;
    const T = e.target != null ? game.fighters[e.target] : null;
    const dmg = e.damage || 0;
    if ((e.result === 'impact' || e.result === 'partial' || e.result === 'clash') && A && T && dmg > 0) {
      stampDamage(game, A, T);
      if (e.contact === 'tackle' && hasPassive(A, 'poison-touch')) activate(game, A, 'poison-touch', {target: T, events: out, depth});          // defesa perfeita nunca chega com dano > 0
      if (e.contact === 'tackle' && hasPassive(T, 'rough-skin')) activate(game, T, 'rough-skin', {target: A, events: out, depth});
      if (hasPassive(T, 'stamina')) activate(game, T, 'stamina', {events: out, depth});
      if ((e.contact === 'tackle' || e.contact === 'melee') && hasPassive(T, 'effect-spore')) activate(game, T, 'effect-spore', {target: A, events: out, depth});
    }
    if (e.result === 'statusTick' && dmg > 0 && T) ensureState(T).lastDamageReceived = game.tick;
    if (e.result === 'statusApplied' && A && T && A.id !== T.id && hasPassive(T, 'clear-body')) {
      const inst = (T.statuses || []).find(s => s.id === e.status && s.source === A.id);
      if (inst) {
        let stripped = 0;
        for (const key of ['attack', 'speed']) {                                    // reduções diretas de Ataque/Velocidade
          if (inst.mul?.[key] !== undefined && inst.mul[key] < 1) {delete inst.mul[key];stripped++;}
          if (inst.add?.[key] !== undefined && inst.add[key] < 0) {delete inst.add[key];stripped++;}
        }
        if (inst.mul?.damageTaken !== undefined && inst.mul.damageTaken > 1) {delete inst.mul.damageTaken;stripped++;}   // redução de Defesa
        if (inst.add?.damageTaken !== undefined && inst.add.damageTaken > 0) {delete inst.add.damageTaken;stripped++;}
        if (stripped > 0) {
          out.push({result: 'passiveBlocked', attacker: A.id, target: T.id, damage: 0, passive: 'clear-body', status: e.status});
          if (hasPassive(T, 'defiant')) activate(game, T, 'defiant', {events: out, depth});
        }
      }
    }
    if (e.result === 'itemCollected' && e.fighter != null) {
      const f = game.fighters[e.fighter];
      if (f && hasPassive(f, 'unburden')) activate(game, f, 'unburden', {events: out, depth});
    }
    for (let i = outBefore; i < out.length; i++) if (out[i].cause === undefined) out[i].cause = e.id ?? null;
  }
  const chainable = out.filter(o => o.result === 'passiveReflect' || o.result === 'statusApplied');
  if (chainable.length) out.push(...passiveOnEvents(game, chainable, depth + 1));
  return out;
}

/**
 * Avança timers de passivas de um lutador (passo normal apenas: hitstop congela, R24–R25). Cooldowns avançam em
 * hit stun/guard stun/recuo (R21). Devolve eventos (passiveEnded/passiveReady/passiveActivated).
 */
export function tickPassives(game, f, dt) {
  if (!passivesEnabled()) return [];
  const out = [];
  const st = ensureState(f);
  for (const id of Object.keys(st.cooldowns)) {
    if (st.cooldowns[id] > 0) {st.cooldowns[id] = Math.max(0, st.cooldowns[id] - dt);if (st.cooldowns[id] <= 1e-9) out.push({result: 'passiveReady', attacker: null, target: f.id, damage: 0, passive: id});}
  }
  const opp = game.fighters.find(o => o.id !== f.id);
  for (const a of st.actives) {
    a.remaining -= dt;
    if (a.id === 'forewarn' && opp && !opp.charge) a.remaining = Math.min(a.remaining, 0);   // término antecipado → cooldown na hora
  }
  const expired = st.actives.filter(a => a.remaining <= 1e-9);
  st.actives = st.actives.filter(a => a.remaining > 1e-9);
  for (const a of expired) {
    if (a.cooldownMode === 'postEnd' && a.cooldown > 0) ensureState(game.fighters[a.owner]).cooldowns[a.id] = a.cooldown;   // R16
    out.push({result: 'passiveEnded', attacker: null, target: f.id, damage: 0, passive: a.id, owner: a.owner});
  }
  if (hasPassive(f, 'regenerator')) {
    const p = P('regenerator'), quiet = Math.max(st.lastDamageDealt, st.lastDamageReceived);
    if ((game.tick - quiet) * C.test.step >= (p.quietTime ?? 5) - 1e-9) activate(game, f, 'regenerator', {events: out});
  }
  if (opp && hasPassive(f, 'anticipation')) {
    const p = P('anticipation'), dMax = p.detectDistance ?? C.passivas?.globals?.detectDistance ?? 3.5;
    if (opp.tackleCharge && opp.tackleCharge.level >= 2 && distanceTo(f, opp) <= dMax) activate(game, f, 'anticipation', {events: out});
  }
  if (opp && hasPassive(f, 'forewarn')) {
    const p = P('forewarn'), dMax = p.detectDistance ?? C.passivas?.globals?.detectDistance ?? 3.5;
    if (opp.charge && chargeLevel(opp.charge.ticks ?? 0, opp.charge.params) >= 2 && distanceTo(f, opp) <= dMax) activate(game, f, 'forewarn', {events: out});
  }
  return out;
}

/** KO (R23): encerra imediatamente os efeitos ativos do lutador; término efetivo inicia cooldown (postEnd). */
export function passiveOnKO(game, f) {
  if (!passivesEnabled()) return [];
  const out = [];
  for (const g of game.fighters) {
    const st = ensureState(g);
    const mine = st.actives.filter(a => a.owner === f.id);
    if (!mine.length) continue;
    st.actives = st.actives.filter(a => a.owner !== f.id);
    for (const a of mine) {
      if (a.cooldownMode === 'postEnd' && a.cooldown > 0) ensureState(game.fighters[a.owner]).cooldowns[a.id] = a.cooldown;
      out.push({result: 'passiveEnded', attacker: null, target: g.id, damage: 0, passive: a.id, owner: a.owner, reason: 'ko'});
    }
  }
  return out;
}

// ---- Contribuições para o agregador ADITIVO (R7–R11): passiveContribute + status.stat ----

/**
 * Parcela percentual/aditiva de passivas para um atributo. Somada às demais fontes em status.js:
 * resultado = base × (Π mul^pilhas legado) × (1 + Σ pct) + Σ add. Sem passivas: {pct: 0, add: 0} (paridade exata).
 * @param {any} f
 * @param {string} key
 */
export function passiveContribute(f, key) {
  if (!passivesEnabled() || !f?.passiveState) return {pct: 0, add: 0};
  const st = f.passiveState;
  let pct = 0;
  const own = id => st.loadout.includes(id);
  for (const a of st.actives) {
    const p = a.params || {};
    if (key === 'speed') {
      if (a.id === 'anticipation') pct += p.speedPct ?? 0;
      if (a.id === 'unburden') pct += p.speedPct ?? 0;
      if (a.id === 'effect-spore') pct -= p.slowPct ?? 0;
    }
    if (key === 'attack' && a.id === 'defiant') pct += p.attackPct ?? 0;
    if (key === 'damageTaken' && a.id === 'stamina') pct += 1 / (1 + (p.defensePct ?? 0)) - 1;   // +X% Defesa ⇒ dano × 1/(1+X)
  }
  if (key === 'speed' && own('speed-boost')) pct += P('speed-boost').speedPct ?? 0;
  if (key === 'attack' && own('guts') && hasDebuff(f)) pct += P('guts').attackPct ?? 0;
  if (key === 'staminaRegen' && own('vital-spirit')) {
    const p = P('vital-spirit');
    if (f.stamina < (p.thresholdPct ?? .3) * (C.rules.staminaMax + (f.stages?.staminaMax ?? 0))) pct += p.regenPct ?? 0;
  }
  return {pct, add: 0};
}

/** Fator de dano periódico (veneno/DOT) com Magic Guard (base 1; ×(1−dotReductionPct) quando equipada). */
export const dotFactor = f => hasPassive(f, 'magic-guard') ? 1 - (P('magic-guard').dotReductionPct ?? .5) : 1;
/** Fator de knockback horizontal recebido com Suction Cups (só em contato com o chão; vertical intacto). */
export const knockbackFactor = f => (hasPassive(f, 'suction-cups') && !f.flight) ? 1 - (P('suction-cups').knockbackPct ?? .2) : 1;
/** Fator de hit stun com Inner Focus (−stunPct). */
export const hitStunFactor = f => hasPassive(f, 'inner-focus') ? 1 - (P('inner-focus').stunPct ?? .2) : 1;
/** Bônus de janela de defesa perfeita com Forewarn ativo (0 sem efeito). */
export const perfectWindowBonus = f => {const a = f?.passiveState?.actives?.find(x => x.id === 'forewarn');return a ? (a.params?.windowBonus ?? 0) : 0;};
/** Custo efetivo de stamina (Technician: −costPct em esquivas e recovery de pouso; X/tackles e Moves intactos). */
export function passiveCost(f, kind, base) {
  if ((kind === 'dodge' || kind === 'tech') && hasPassive(f, 'technician')) return base * (1 - (P('technician').costPct ?? .2));
  return base;
}

/** Sturdy (R6/§7) mora no DamageResolver desde a F3.1 (regra de dano); reexportado aqui para quem já o importava. */
export {sturdyGuard};
