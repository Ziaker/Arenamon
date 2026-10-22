// @ts-check
// Bullet Punch (Soco-Bala) — Normal · Melee · PL2. Funciona como o Quick Attack: o alvo é o adversário elegível mais próximo DENTRO DO ALCANCE do Move (`reach`, em C.world.bulletPunch),
// fixado ao SOLTAR o botão (segurar só mostra o círculo de alcance: azul com alvo dentro, vermelho sem alvo; sem alvo no alcance, soltar não gasta nada). Não há mais marcador de destino.
// Cobra 1,5× o custo do Tackle e 8 s de recarga ao soltar e inicia a preparação de 0,75 s (anda a 30%, interrompível; a interrupção mantém o custo). Depois o lutador DEIXA DE EXISTIR
// por 0,2 s (`f.absent`: sem corpo, colisão, acerto nem seleção como alvo) mas VIAJA em linha reta até um ponto colado ao alvo (`stopShort` m antes dele; o alvo é seguido: vale a posição
// dele no instante do desaparecimento) e reaparece. O golpe (Tackle PL2 curto, `strikeReach` m, com a velocidade, invulnerabilidade, dano, knockback e recuperação do Tackle) começa NO MOMENTO
// da chegada. Quem estiver no caminho da corrida invisível é atingido e a corrida PARA ali: o lutador reaparece no ponto do contato e golpeia esse adversário.
// A velocidade de impacto do knockback tem slider próprio (`impactMult`). Valores: C.world.bulletPunch, capturados no uso.
import {C} from '../config.js';
import {startTackleAt} from '../controller.js';
import {nominalDistance} from '../entity.js';
import {getGroundHeight} from '../physics.js';
import {effectiveArenaRadius} from '../map.js';
import {solidsOf, insideSolid} from '../vision.js';
import {angleOf, sub} from '../math.js';

export const bulletPunchDef = Object.freeze({
  id: 'bullet-punch', name: 'Bullet Punch', air: 'descend', group: 'bulletPunch', needsTarget: 'reach', moveCast: true, fromDodge: true, tackle: 'bullet-punch', aim: 'target',
  description: 'Normal · PL2. Como o Quick Attack: acha o adversário mais próximo dentro do alcance (segure para ver o círculo), prepara 0,75 s, some por 0,2 s numa corrida invisível até ele e o golpeia ao chegar (quem estiver no caminho leva o golpe e para a corrida).',
  cost: 1.5, cooldown: 8, duration: 1.75, durationKeys: ['cast', 'vanish'], motion: {type: 'walk'},
  timeline: [
    {at: .75, atKey: 'cast', effect: 'bullet-punch-vanish'},
    {at: 1.75, atKeys: ['cast', 'vanish'], effect: 'bullet-punch-return'},
  ],
});

/** Preparação do Tackle do golpe: PL2, rumo fixo, mesma velocidade do Tackle (duração e distância escalam juntas até `strikeReach`). */
export function bulletPunchSetup(/** @type {any} */ f, /** @type {any} */ a, /** @type {Record<string, any>} */ P) {
  const k = (P.strikeReach ?? 2.2) / Math.max(1e-6, nominalDistance(f, 'tackle'));   // MV-P34: velocidade do Tackle preservada; só a distância total muda
  a.pl = 2;a.fixedHeading = true;a.durationScale = k;a.distanceScale = k;a.impactMult = P.impactMult;
}

/** Alvo do golpe: o adversário fixado ao soltar (`fx.lock`), se ainda estiver vivo e presente. */
const targetOf = (/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ fx) => game.fighters.find((/** @type {any} */ o) => o !== f && o.id === fx.lock && o.hp > 0 && !o.absent) ?? null;

/** Fim da preparação: o lutador deixa de existir fisicamente e parte rumo ao alvo. */
export function bulletPunchVanish(/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ def, /** @type {any} */ fx) {
  if (f.hp <= 0) return {ok: false, reason: 'defeated'};
  const P = fx.params ?? C.world.bulletPunch, tgt = targetOf(game, f, fx);
  f.absent = true;f.velocity = {x: 0, z: 0};f.locomotionVelocity = {x: 0, z: 0};f.guard = false;f.push = null;f.flight = null;
  // Destino: ponto colado ao alvo, no lado de quem chega; alvo perdido (derrotado) ou longe demais: percorre só o que o alcance permite e não golpeia.
  let to = {x: f.position.x, z: f.position.z};
  if (tgt) {
    const dx = tgt.position.x - f.position.x, dz = tgt.position.z - f.position.z, d = Math.hypot(dx, dz) || 1e-6, stop = P.stopShort ?? 1.1, run = Math.min(Math.max(0, d - stop), (P.reach ?? 6) + stop);
    to = nearestFree(game, f, {x: f.position.x + dx / d * run, z: f.position.z + dz / d * run});
  }
  if (f.action) f.action.travel = {from: {x: f.position.x, z: f.position.z}, to, t0: f.action.elapsed, time: Math.max(1e-6, P.vanish)};
  fx.events?.push({result: 'bulletVanish', attacker: f.id, target: tgt?.id ?? null, damage: 0, x: f.position.x, z: f.position.z, move: def.id});
}

/** Ponto livre mais próximo do desejado (arena, sólidos e outros corpos), em anéis de 0,25 m; determinístico. */
function nearestFree(/** @type {any} */ game, /** @type {any} */ f, /** @type {{x: number, z: number}} */ want) {
  const solids = solidsOf(game.world), lim = effectiveArenaRadius() - C.test.halfExtent, h = C.test.halfExtent;
  const ok = (/** @type {{x: number, z: number}} */ p) => Math.hypot(p.x, p.z) <= lim && !insideSolid(solids, p, h * .9)
    && game.fighters.every((/** @type {any} */ o) => o === f || o.hp <= 0 || o.absent || o.flight || Math.hypot(o.position.x - p.x, o.position.z - p.z) >= 2 * h * .98);
  if (ok(want)) return want;
  for (let r = .25; r <= 6; r += .25) {
    const n = Math.max(8, Math.round(r * 16));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, p = {x: want.x + Math.sin(a) * r, z: want.z + Math.cos(a) * r};
      if (ok(p)) return p;
    }
  }
  return want;
}

/**
 * Um passo da viagem invisível (chamado a cada passo enquanto `f.absent`): avança em linha reta, chegando exatamente ao fim do desaparecimento.
 * Devolve o adversário ATINGIDO no caminho (a corrida para ali), ou null. Atinge quem ficar a menos de `hitRadius` m do trecho percorrido neste passo.
 * @returns {any}
 */
export function bulletPunchTravel(/** @type {any} */ f, /** @type {any} */ action, /** @type {number} */ dt, /** @type {any[]} */ fighters = []) {
  const t = action.travel;if (!t || !f.absent) return null;
  const k = Math.max(0, Math.min(1, (action.elapsed + dt - t.t0) / t.time)), next = {x: t.from.x + (t.to.x - t.from.x) * k, z: t.from.z + (t.to.z - t.from.z) * k};
  const R = action.params?.hitRadius ?? .8, ax = f.position.x, az = f.position.z, bx = next.x - ax, bz = next.z - az, len2 = bx * bx + bz * bz;
  /** @type {any} */ let hit = null, hitU = Infinity;
  for (const o of fighters) {
    if (o === f || o.hp <= 0 || o.absent || (o.flight && !o.wallSplat)) continue;
    const u = len2 > 1e-12 ? Math.max(0, Math.min(1, ((o.position.x - ax) * bx + (o.position.z - az) * bz) / len2)) : 0;
    if (Math.hypot(o.position.x - (ax + bx * u), o.position.z - (az + bz * u)) <= R && u < hitU) {hit = o;hitU = u;}
  }
  if (hit) {   // para antes de atravessar: fica no ponto de contato (a `hitRadius` do corpo atingido)
    const d = Math.hypot(hit.position.x - ax, hit.position.z - az);
    if (d > R) {const m = (d - R) / d;f.position = {x: ax + (hit.position.x - ax) * m, z: az + (hit.position.z - az) * m};}
    return hit;
  }
  f.position = next;
  return null;
}

/** Fim do desaparecimento (ou contato no caminho): reaparece e golpeia NA HORA o alvo (ou quem barrou a corrida). */
export function bulletPunchReturn(/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ def, /** @type {any} */ fx) {
  const P = fx.params ?? C.world.bulletPunch;
  f.absent = false;
  if (f.hp <= 0) return;
  const blocker = fx.arrive?.hitId != null ? game.fighters.find((/** @type {any} */ o) => o.id === fx.arrive.hitId && o.hp > 0) : null;
  const tgt = blocker ?? targetOf(game, f, fx);
  const pos = nearestFree(game, f, f.position);
  f.position = {x: pos.x, z: pos.z};
  f.groundY = getGroundHeight(f.position, game.world, (tgt?.groundY ?? f.groundY ?? 0) + .3);
  f.velocity = {x: 0, z: 0};f.locomotionVelocity = {x: 0, z: 0};
  fx.events?.push({result: 'bulletReturn', attacker: f.id, target: tgt?.id ?? null, damage: 0, x: f.position.x, z: f.position.z, move: def.id, blocked: !!blocker});
  if (!tgt) {fx.events?.push({result: 'bulletNoTarget', attacker: f.id, target: null, damage: 0, move: def.id});return;}   // alvo derrotado durante o preparo: reaparece sem golpe
  startTackleAt(f, def, P, angleOf(sub(tgt.position, f.position)), game.fighters);
}
