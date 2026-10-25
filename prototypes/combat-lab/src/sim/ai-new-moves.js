// @ts-check
// IA com os 13 Moves NOVOS (Harden … Emerging Stone) e os 4 elementais (Water Pulse, Fire Spin, Air Slash, Seed Bomb; protótipo de 23/10/2026). Mesmas regras do jogador: a IA pede pelos campos de comando (`skill`, `skillHeld`, `move`) e só tenta o que a função de
// permissão do controlador aceitaria agora (custo, recarga, chão, alvo elegível). Sem Moves novos equipados este módulo não faz nada e não consome sorteios.
// Cada Move tem uma regra de OPORTUNIDADE (quando vale a pena) no PERFIL declarativo da própria ficha (`ficha.ai`, ver ai-profile.js; desde 25/10/2026 todos os Moves com IA); a chance final é `taxa × estilo de ataque`, ajustável em Moves › IA com Moves (newMovesRate).
// Execução: toque (Normal/Burst), carga com PL (Guard Break, Bounce) ou segurar-e-soltar com marcador (Spikes, Bullet Punch, Emerging Stone), esta última guiada por um plano
// (`mv.plan`) que mantém o botão, aponta o marcador e solta. Percepção: só vê o que o jogador veria (`observedAction` da percepção justa, quando existe).
import {C} from './config.js';
import {getMove} from './moves.js';
import {movePermission, chargePermission} from './controller.js';
import {hasFlag} from './status.js';
import {getAiRule, hasAiProfile} from './ai-profile.js';
import {length, sub, normalize, direction, dot, angleDelta, angleOf} from './math.js';

const held = (/** @type {number} */ slot) => Array.from({length: C.world.slots}, (_, i) => i === slot);
/** O Move é da IA de Moves novos: perfil declarativo na ficha, ou o Feint (decisão feita DURANTE o Tackle, tratada à parte abaixo). */
const isAiMove = (/** @type {string} */ id) => id === 'feint' || hasAiProfile(id);
const has = (/** @type {any} */ f, /** @type {string} */ id) => !!f.statuses?.some((/** @type {any} */ s) => s.id === id);

/**
 * Contexto de decisão (tudo derivado do que um jogador veria).
 * @param {any} self @param {any} target @param {any} perc
 */
function context(self, target, perc) {
  const d = sub(target.position, self.position), distance = length(d), toward = distance > 1e-6 ? normalize(d) : direction(self.facing);
  const facing = Math.abs(angleDelta(self.facing, angleOf(d))) < Math.PI / 6;
  const observed = perc && perc.observedAction !== undefined ? perc.observedAction : (target.action?.kind ?? null);
  const tackling = observed === 'tackle' || (observed == null && target.action?.kind === 'tackle');
  const closing = Math.max(0, -dot(target.velocity ?? {x: 0, z: 0}, toward));   // velocidade do rival vindo na minha direção
  return {distance, toward, facing, tackling, closing, ttc: closing > 1 ? Math.max(0, distance - 1.2) / closing : Infinity, tGround: !target.flight && !(target.vaultHeight > 0), tGuard: !!target.guard, tCharging: !!target.charge || !!target.tackleCharge, stamina: self.stamina};
}

/** Mantém o botão, aponta o marcador e solta, conforme o plano. Devolve true se assumiu o comando. */
function driveAim(brain, self, target, c, mv) {
  const a = self.aim, plan = mv.plan;
  if (!a || !plan) {mv.plan = null;return false;}
  const slot = a.slot, d = sub(target.position, self.position), dist = length(d), dir = dist > 1e-6 ? normalize(d) : direction(self.facing);
  c.tackle = false;c.dodge = false;c.guard = false;c.guardPressed = false;
  let hold = true;
  if (plan.mode === 'absolute') {   // Spikes: leva o marcador até onde o rival está (com um pouco de antecipação) e solta
    const lead = {x: target.position.x + (target.velocity?.x ?? 0) * .35, z: target.position.z + (target.velocity?.z ?? 0) * .35};
    const to = sub(lead, a.pos), l = length(to);
    c.move = l > .3 ? normalize(to) : {x: 0, z: 0};
    if ((l <= .45 && a.valid) || a.ticks > 90) hold = false;
  } else if (plan.mode === 'near') {   // Fire Spin / Seed Bomb: marcador junto do rival, do lado de quem atira (offset m), com antecipação de 0,35 s
    const lead = {x: target.position.x + (target.velocity?.x ?? 0) * .35 - dir.x * (plan.offset ?? 1), z: target.position.z + (target.velocity?.z ?? 0) * .35 - dir.z * (plan.offset ?? 1)};
    const to = sub(lead, a.pos), l = length(to);
    c.move = l > .3 ? normalize(to) : {x: 0, z: 0};
    if ((l <= .5 && a.valid) || a.ticks > 90) hold = false;
  } else {   // Emerging Stone: o cast começa ao pressionar; mantém parado até o cast terminar, mira o marcador no rival e solta
    const to = sub(target.position, a.pos), l = length(to);
    c.move = a.castLeft <= 0 && l > .6 ? {x: to.x / l, z: to.z / l} : {x: 0, z: 0};   // depois do cast, conduz o marcador até o rival (antes ficava parado e soltava por tempo)
    if (a.castLeft <= 0 && (l <= 1.2 || a.ticks > 150)) hold = false;
  }
  if (hold) c.skillHeld = held(slot);
  else {c.skillHeld = null;if (!self.aim || a.ticks > 1) {/* solta */}}
  mv.log.push({time: +(brain.t?.time ?? 0).toFixed(3), move: a.move, why: hold ? 'ajustando o marcador' : 'solta o marcador'});if (mv.log.length > 30) mv.log.shift();
  return true;
}

/**
 * Chamado por `movesCommand` (ai-moves.js) a cada decisão. `mv` é o estado de Moves da IA (`brain.t.mv`).
 * Devolve true quando assumiu o comando deste passo.
 * @param {any} brain @param {any} self @param {any} target @param {any} c @param {any} mv @param {any} perc @param {any} S estilo da IA
 */
export function newMovesCommand(brain, self, target, c, mv, perc, S) {
  const slots = self.loadout;
  if (!slots?.some((/** @type {string} */ id) => isAiMove(id))) return false;
  const A = C.world.ai;
  if (!(A.newMovesRate > 0)) return false;
  if (self.aim?.range) {c.tackle = false;c.dodge = false;c.guard = false;c.guardPressed = false;c.skill = null;c.skillHeld = null;return true;}   // círculo de alcance aberto: solta o botão no passo seguinte (executa)
  if (self.aim) return driveAim(brain, self, target, c, mv);
  mv.plan = null;
  if (self.hp <= 0 || target.hp <= 0 || target.absent) return false;
  const x = context(self, target, perc);
  // Feint: cancela o próprio ataque ainda na antecipação quando o rival acabou de levantar a defesa (janela de defesa perfeita aberta: o golpe seria anulado e punido) — única decisão feita DURANTE uma ação.
  const fi = slots.indexOf('feint');
  if (fi >= 0 && self.action?.kind === 'tackle' && self.action.elapsed < .11 && (self.action.hits?.size ?? 0) === 0 && (target.perfectLeft ?? 0) > .03 && movePermission(self, getMove('feint'), fi).ok && brain.random() < .6 * A.newMovesRate) {
    c.skill = fi;c.skillHeld = held(fi);c.tackle = false;return true;
  }
  if (self.action || self.flight || self.knockRecovery > 0 || self.charge) return false;
  // Riposte: a janela é de 0,13 s, curta demais para a decisão de 0,25 s; avalia a cada passo (chance por passo) enquanto o golpe do rival chega.
  const ri = slots.indexOf('riposte'), rdef = ri >= 0 ? getMove('riposte') : null, rrule = rdef ? getAiRule('riposte') : null, rr = rrule ? rrule(x, self, target) : null;
  if (rr && movePermission(self, rdef, ri).ok && brain.random() < .04 * A.newMovesRate) {
    c.skill = ri;c.skillHeld = held(ri);c.tackle = false;c.dodge = false;c.guard = false;c.guardPressed = false;brain.wasGuard = false;
    mv.log.push({time: +(brain.t?.time ?? 0).toFixed(3), move: 'riposte', why: rr.why, distance: +x.distance.toFixed(2)});if (mv.log.length > 30) mv.log.shift();
    return true;
  }
  mv.nroll = Math.max(0, (mv.nroll ?? 0) - Math.max(0, (brain.t?.time ?? 0) - (mv.nlast ?? 0)));mv.nlast = brain.t?.time ?? 0;
  if (mv.nroll > 0) return false;
  mv.nroll = .25;   // decide a cada 0,25 s
  for (let slot = 0; slot < slots.length; slot++) {
    const id = slots[slot];if (!id || !isAiMove(id)) continue;
    const def = getMove(id), rule = getAiRule(id);if (!def || !rule) continue;
    const ok = def.charge ? chargePermission(self, def, slot).ok : movePermission(self, def, slot).ok;
    if (!ok) continue;
    const r = rule(x, self, target);if (!r) continue;
    if (brain.random() >= Math.min(.95, r.p * A.newMovesRate * (.6 + .8 * (S?.attack ?? .5)))) continue;
    const log = {time: +(brain.t?.time ?? 0).toFixed(3), move: id, why: r.why, distance: +x.distance.toFixed(2)};
    c.tackle = false;c.dodge = false;c.guard = false;c.guardPressed = false;brain.wasGuard = false;
    if (r.kind === 'tap') {c.skill = slot;c.skillHeld = held(slot);}
    else if (r.kind === 'charge') {c.skill = slot;c.skillHeld = held(slot);mv.phase = 'charging';mv.slot = slot;mv.goalTicks = r.goal;}
    else {c.skill = slot;c.skillHeld = held(slot);mv.plan = {mode: r.mode, dist: x.distance, offset: r.offset};}
    mv.log.push(log);if (mv.log.length > 30) mv.log.shift();
    void hasFlag;
    return true;
  }
  return false;
}
