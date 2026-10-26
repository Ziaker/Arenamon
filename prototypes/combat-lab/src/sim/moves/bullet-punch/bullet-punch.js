// @ts-check
// Bullet Punch (Soco-Bala) — Normal · Melee · PL2. Funciona como o Quick Attack: o alvo é o adversário elegível mais próximo DENTRO DO ALCANCE do Move (`reach`, em C.world.bulletPunch),
// fixado ao SOLTAR o botão (segurar só mostra o círculo de alcance: azul com alvo dentro, vermelho sem alvo; sem alvo no alcance, soltar não gasta nada). Não há mais marcador de destino.
// Cobra 1,5× o custo do Tackle e 8 s de recarga ao soltar e inicia a preparação de 0,75 s (anda a 30%, interrompível; a interrupção mantém o custo). Depois o lutador DEIXA DE EXISTIR
// por 0,2 s (`f.absent`: sem corpo, colisão, acerto nem seleção como alvo) mas VIAJA em linha reta até um ponto colado ao alvo (`stopShort` m antes dele; o alvo é seguido: vale a posição
// dele no instante do desaparecimento) e reaparece. O golpe (Tackle PL2 curto, `strikeReach` m, com a velocidade, invulnerabilidade, dano, knockback e recuperação do Tackle) começa NO MOMENTO
// da chegada. Quem estiver no caminho da corrida invisível é atingido e a corrida PARA ali: o lutador reaparece no ponto do contato e golpeia esse adversário.
// A velocidade de impacto do knockback tem slider próprio (`impactMult`). Valores: C.world.bulletPunch, capturados no uso.
import {C} from '../../config.js';
import {startTackleAt} from '../../controller.js';
import {nominalDistance, altitudeOf} from '../../entity.js';
import {getGroundHeight} from '../../physics.js';
import {effectiveArenaRadius} from '../../map.js';
import {solidsOf, insideSolid} from '../../vision.js';
import {angleOf, sub} from '../../math.js';
import {defineFicha} from '../params-registry.js';
import {params, def as bulletPunchDef} from './bullet-punch.params.js';

export {bulletPunchDef};   // definição (id, fases, custo…) vem de bullet-punch.move.json

/** Preparação do Tackle do golpe: PL2, rumo fixo, mesma velocidade do Tackle (duração e distância escalam juntas até `strikeReach`). */
export function bulletPunchSetup(/** @type {any} */ f, /** @type {any} */ a, /** @type {Record<string, any>} */ P) {
  const k = (P.strikeReach ?? 2.2) / Math.max(1e-6, nominalDistance(f, 'tackle'));   // MV-P34: velocidade do Tackle preservada; só a distância total muda
  a.pl = 2;a.fixedHeading = true;a.durationScale = k;a.distanceScale = k;a.impactMult = P.impactMult;
  if (P.knockbackOwn) a.kb = {horizontal: P.knockbackH ?? 0, vertical: P.knockbackV ?? 0};   // knockback próprio (como o Lunge) em vez da fórmula do Tackle
}

/** Alvo do golpe: o adversário fixado ao soltar (`fx.lock`), se ainda estiver vivo e presente. */
// (um alvo também em corrida invisível vale: ele reaparece em até `vanish` s; sem isso dois Bullet Punch simultâneos dependiam só do índice do lutador)
const targetOf = (/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ fx) => game.fighters.find((/** @type {any} */ o) => o !== f && o.id === fx.lock && o.hp > 0) ?? null;

/** Fim da preparação: o lutador deixa de existir fisicamente e parte rumo ao alvo. */
export function bulletPunchVanish(/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ def, /** @type {any} */ fx) {
  if (f.hp <= 0) return {ok: false, reason: 'defeated'};
  const P = fx.params ?? C.world.bulletPunch, tgt = targetOf(game, f, fx);
  f.absent = true;f.velocity = {x: 0, z: 0};f.locomotionVelocity = {x: 0, z: 0};f.guard = false;f.push = null;f.flight = null;
  // Destino: ponto colado ao alvo, no lado de quem chega; alvo perdido (derrotado) ou longe demais: percorre só o que o alcance permite e não golpeia.
  let to = {x: f.position.x, z: f.position.z};
  if (tgt) {
    const dx = tgt.position.x - f.position.x, dz = tgt.position.z - f.position.z, d = Math.hypot(dx, dz) || 1e-6, stop = P.stopShort ?? 1.1, run = Math.min(Math.max(0, d - stop), (P.reach ?? 6) + stop);
    to = nearestFree(game, f, firstFree(game, f.position, {x: f.position.x + dx / d * run, z: f.position.z + dz / d * run}, P), P);
  }
  if (f.action) f.action.travel = {from: {x: f.position.x, z: f.position.z}, to, t0: f.action.elapsed, time: Math.max(1e-6, P.vanish),
    airFrom: f.vaultHeight ?? 0, airTo: tgt ? Math.max(0, altitudeOf(tgt) - (f.groundY ?? 0)) : 0};   // anti-aéreo: a corrida invisível sobe até o alvo
  fx.events?.push({result: 'bulletVanish', attacker: f.id, target: tgt?.id ?? null, damage: 0, x: f.position.x, z: f.position.z, move: def.id});
}

/** Último ponto da reta a→b antes do primeiro sólido (parede, obstáculo, destrutível): a corrida invisível NÃO atravessa paredes (como o Quick Attack). Plataformas não bloqueiam. */
function firstFree(/** @type {any} */ game, /** @type {{x: number, z: number}} */ a, /** @type {{x: number, z: number}} */ b, /** @type {Record<string, any>} */ P = C.world.bulletPunch) {
  const solids = solidsOf(game.world);if (!solids.length) return b;
  const step = Math.max(.05, P?.rayStep ?? .25);
  const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / step)), m = C.test.halfExtent * .9;
  let last = {x: a.x, z: a.z};
  for (let i = 1; i <= n; i++) {const p = {x: a.x + (b.x - a.x) * i / n, z: a.z + (b.z - a.z) * i / n};if (insideSolid(solids, p, m)) return last;last = p;}
  return b;
}

/** Ponto livre mais próximo do desejado (arena, sólidos e outros corpos), em anéis configuráveis; determinístico. */
function nearestFree(/** @type {any} */ game, /** @type {any} */ f, /** @type {{x: number, z: number}} */ want, /** @type {Record<string, any>} */ P = C.world.bulletPunch) {
  const solids = solidsOf(game.world), lim = effectiveArenaRadius() - C.test.halfExtent, h = C.test.halfExtent;
  const ok = (/** @type {{x: number, z: number}} */ p) => Math.hypot(p.x, p.z) <= lim && !insideSolid(solids, p, h * .9)
    && game.fighters.every((/** @type {any} */ o) => o === f || o.hp <= 0 || o.absent || o.flight || Math.hypot(o.position.x - p.x, o.position.z - p.z) >= 2 * h * .98);
  if (ok(want)) return want;
  const step = Math.max(.05, P?.freeSearchStep ?? .25), maxR = P?.freeSearchRadius ?? 6;
  for (let r = step; r <= maxR + 1e-9; r += step) {
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
  if (t.airTo !== undefined) f.vaultHeight = Math.max(0, t.airFrom + (t.airTo - t.airFrom) * k);   // anti-aéreo: sobe junto com a corrida
  const R = action.params?.hitRadius ?? .8, ax = f.position.x, az = f.position.z, bx = next.x - ax, bz = next.z - az, len2 = bx * bx + bz * bz;
  const antiAir = (action.params?.airReach ?? 0) > 0, reachY = Math.max(C.extras?.visual?.bodyHeight ?? 1.2, action.params?.airReach ?? 0), fy = altitudeOf(f);
  /** @type {any} */ let hit = null, hitU = Infinity;
  for (const o of fighters) {
    if (o === f || o.hp <= 0 || o.absent || ((o.flight && !o.wallSplat) && !antiAir)) continue;
    if (Math.abs(altitudeOf(o) - fy) > reachY) continue;
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
  const pos = nearestFree(game, f, f.position, P);
  f.position = {x: pos.x, z: pos.z};
  f.groundY = getGroundHeight(f.position, game.world, (f.groundY ?? 0) + (P.maxRise ?? 2));   // sem subir plataformas altas de graça: o apoio vale até `maxRise` acima de onde o lutador estava
  f.velocity = {x: 0, z: 0};f.locomotionVelocity = {x: 0, z: 0};
  fx.events?.push({result: 'bulletReturn', attacker: f.id, target: tgt?.id ?? null, damage: 0, x: f.position.x, z: f.position.z, move: def.id, blocked: !!blocker});
  if (!tgt) {fx.events?.push({result: 'bulletNoTarget', attacker: f.id, target: null, damage: 0, move: def.id});return;}   // alvo derrotado durante o preparo: reaparece sem golpe
  const lift = Math.max(0, altitudeOf(tgt) - f.groundY);   // alvo em voo: o golpe começa na altura dele e desce durante o Tackle
  const strike = startTackleAt(f, def, P, angleOf(sub(tgt.position, f.position)), game.fighters);
  if (lift > 1e-6) {f.vaultHeight = lift;strike.liftStart = lift;strike.liftTime = C.actions.tackle.duration;}
}

/** FICHA do Move (ver docs/COMO_CRIAR_UM_MOVE.md): `params` gera o padrão em C.world.bulletPunch e os sliders da aba Moves; `def` e os manipuladores são registrados sozinhos. */
export const ficha = defineFicha({
  // Quando a IA usa o Move (perfil declarativo, ver ai-profile.js): rival no chão além de 2,5 m e dentro do alcance (alcance do slider − 0,3 m).
  ai: {kind: 'tap', p: .25, why: 'soco-bala: some e golpeia o rival ao chegar', distance: {min: 2.5}, requires: ['tGround'], minStamina: 2.2, when: x => x.distance < (C.world.bulletPunch.reach ?? 6) - .3},
  def: bulletPunchDef, tackle: ['bullet-punch', bulletPunchSetup], effects: [['bullet-punch-vanish', bulletPunchVanish], ['bullet-punch-return', bulletPunchReturn]],
  params,
});
