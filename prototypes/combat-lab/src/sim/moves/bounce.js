// @ts-check
// Bounce (Salto Ofensivo) — Charge · Trick + Melee · PL1/PL2/PL3 (catálogo de genéricos §6; substitui o Teleport). Segurar carrega (até 1,2 s); soltar executa um
// SALTO BALÍSTICO REAL: o lutador entra em voo (`f.flight.bounce`) com a altura da carga (1,5 / 2,5 / 3,5 m), gravidade própria e a velocidade horizontal que o leva
// ao destino (alvo travado ou à frente, no máximo 6 m). Sem teletransporte e sem invulnerabilidade: tetos, plataformas, obstáculos e o apoio vêm da física de
// voo existente (o pouso é onde a superfície realmente está). O golpe é conferido por `bounceStep` (gancho de passo) logo depois da física:
//   • CONTATO NA DESCIDA: adversário dentro do raio do corpo (+ contactRadius) e na mesma altura → dano 12 HP nominais (× Ataque ÷ referência, MV-P13), 3 m/s H e
//     6 m/s V, pela MESMA função de acerto das entidades (`applyHit`: defesa parcial/perfeita, i-frames, status, Sturdy…); uma vez por alvo por execução;
//   • IMPACTO DO POUSO: quem estiver no chão dentro de landRadius e ainda não foi atingido leva o mesmo golpe; o pouso sem acerto só dá o efeito visual;
//   • Poder: contra um Tackle ofensivo em curso, o PL maior vence; PL igual anula os dois (Clash); PL menor perde (MV-P27, provisório).
// Custo e recarga na ATIVAÇÃO da carga (Charge); só no chão (MV-P04, provisório); recuperação própria após o pouso (0,25 s). Valores: C.world.bounce, capturados na soltura.
import {C} from '../config.js';
import {applyHit} from '../world.js';
import {isOffensive} from '../entity.js';
import {isAirJump} from '../air.js';
import {sub, add, scale, length, normalize, direction} from '../math.js';

export const bounceDef = Object.freeze({
  id: 'bounce', name: 'Bounce', air: 'cast', group: 'bounce', cooldownOnStart: true,
  description: 'Charge. Segure para carregar (até 1,2 s), solte para um salto altíssimo em arco rumo ao alvo e caia em cima do adversário. Mais carga = mais altura e mais PL.',
  cost: 1.2, cooldown: 12, charge: {max: 1.2, group: 'bounce'}, duration: .5,
  timeline: [{effect: 'bounce'}],
});

/** Altura inicial do salto pela carga (nível de PL 1 a 3). */
export const bounceHeight = (/** @type {Record<string, any>} */ P, /** @type {number} */ level) => [P.heightPl1, P.heightPl2, P.heightPl3][Math.max(0, Math.min(2, level - 1))];

/** Efeito da soltura: põe o lutador em voo balístico rumo ao destino e abre o estado do golpe (`f.bounceState`). */
export function bounceEffect(/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ def, /** @type {any} */ fx) {
  const rel = fx.charge, P = rel.params.group ?? C.world.bounce;
  if ((f.flight && !isAirJump(f)) || (!f.flight && (f.vaultHeight ?? 0) > 1e-8)) return {ok: false, reason: 'noGround'};   // lançado: sem Bounce. No salto (pedido de 22/10) o novo arco parte da altitude atual
  const g = P.gravity, vy = Math.sqrt(2 * g * bounceHeight(P, rel.level)), airTime = 2 * vy / g;
  const foe = rel.lock != null ? game.fighters.find((/** @type {any} */ o) => o.id === rel.lock && o.hp > 0) : null;
  const toFoe = foe ? sub(foe.position, f.position) : null;
  const dir = toFoe && length(toFoe) > 1e-6 ? normalize(toFoe) : direction(f.facing);
  const dist = toFoe ? Math.min(P.maxDistance, length(toFoe)) : P.maxDistance;
  f.flight = {y: f.flight?.y ?? (f.groundY ?? 0), vy, horizontal: scale(dir, dist / airTime), gravity: g, bounce: {recovery: P.landRecovery}};   // no ar, recomeça da altitude do corpo
  f.bounceState = {pl: rel.level, params: structuredClone(P), hits: [], damage: P.damage * f.attributes.attack / C.test.attackReference, neutralized: false};   // MV-P13
  f.state = 'airborne';f.guard = false;f.guardSuppressed = true;f.push = null;f.blend = null;f.velocity = {...f.flight.horizontal};f.locomotionVelocity = {x: 0, z: 0};
  f.sprinting = false;f.sprintCarry = false;f.footstoolDoneWith = null;f.coyoteLeft = 0;f.airMoveDir = null;f.tech = null;
  fx.events?.push({result: 'moveEffect', move: 'bounce', attacker: f.id, target: null, damage: 0, level: rel.level, height: bounceHeight(P, rel.level), distance: dist});
}

/** O alvo cai no golpe? Disputa de PL contra Tackle ofensivo e depois a função de acerto das entidades. Devolve eventos. */
function strike(/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ o, /** @type {any} */ st, /** @type {string} */ phase) {
  const events = [];
  st.hits.push(o.id);
  if (o.action?.kind === 'tackle' && !o.action.neutralized && isOffensive(o)) {
    const po = o.action.pl ?? 1;
    if (po > st.pl) {st.neutralized = true;events.push({result: 'neutralized', attacker: f.id, target: o.id, damage: 0, kind: 'bounce', pl: st.pl});return events;}
    if (po === st.pl) {st.neutralized = true;o.action.neutralized = true;events.push({result: 'clash', attacker: f.id, target: o.id, damage: 0, contact: 'bounce', pl: st.pl});return events;}
    o.action.neutralized = true;o.plDefeated = true;   // PL maior: derruba o Tackle do alvo e o golpe conecta
  }
  const normal = (() => {const d = sub(o.position, f.position);return length(d) > 1e-6 ? normalize(d) : direction(f.facing);})();
  const P = st.params;
  const ev = applyHit(game, f.id, o, {damage: st.damage, knockback: {horizontal: P.knockbackH, vertical: P.knockbackV}}, normal, {source: 'bounce', contact: 'bounce', move: 'bounce', pl: st.pl, origin: add(f.position, scale(normal, -1))});
  if (ev) {events.push({...ev, phase});st.connected = true;}
  return events;
}

/** Gancho de passo: contato na descida e impacto do pouso. Roda depois da física, uma vez por passo. */
export function bounceStep(/** @type {any} */ game) {
  /** @type {any[]} */ const events = [];
  const bodyH = C.extras?.visual?.bodyHeight ?? 1.2;
  for (const f of game.fighters) {
    const st = f.bounceState;if (!st) continue;
    const P = st.params;
    if (f.flight?.bounce) {   // em voo: confere o contato durante a descida
      if (f.hp <= 0) {f.bounceState = null;continue;}
      if (st.neutralized || f.flight.vy >= 0) continue;
      const reach = 2 * C.test.halfExtent + P.contactRadius, fy = f.flight.y;
      for (const o of game.fighters) {
        if (o === f || o.hp <= 0 || o.absent || st.hits.includes(o.id)) continue;
        if (Math.hypot(o.position.x - f.position.x, o.position.z - f.position.z) > reach) continue;
        const oy = o.flight ? o.flight.y : (o.groundY ?? 0) + (o.vaultHeight ?? 0);
        if (Math.abs(fy - oy) > bodyH) continue;
        events.push(...strike(game, f, o, st, 'descent'));
        if (st.neutralized) break;
      }
    } else {   // pousou (ou o voo foi trocado por um golpe sofrido)
      const landed = !f.flight && f.state !== 'airborne';
      if (!landed && f.flight) {f.bounceState = null;continue;}
      if (!st.neutralized && f.hp > 0) {
        for (const o of game.fighters) {
          if (o === f || o.hp <= 0 || o.absent || o.flight || st.hits.includes(o.id)) continue;
          if (Math.hypot(o.position.x - f.position.x, o.position.z - f.position.z) > P.landRadius) continue;
          if (Math.abs((f.groundY ?? 0) - (o.groundY ?? 0) - (o.vaultHeight ?? 0)) > bodyH) continue;
          events.push(...strike(game, f, o, st, 'landing'));
          if (st.neutralized) break;
        }
      }
      events.push({result: 'bounceLand', attacker: f.id, target: null, damage: 0, connected: !!st.connected, x: f.position.x, z: f.position.z, pl: st.pl, move: 'bounce'});
      f.bounceState = null;
    }
  }
  return events;
}
