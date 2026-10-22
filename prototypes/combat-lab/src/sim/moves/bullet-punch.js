// @ts-check
// Bullet Punch (Soco-Bala) — Normal · Melee · PL2, 1º Move de Mushroom na lista do diretor (docs/MUSHROOM_MOVES_DECISOES.md §2–3). Segurar o botão abre um marcador de
// reaparecimento que SEGUE o lutador (3 m → 10 m em 2 s, curva quadrática, direção do input independente do corpo, para antes de obstáculo); o corpo anda a 30%.
// Soltar confirma: cobra 1,5× o custo do Tackle e 8 s de recarga, fixa o marcador no mundo e inicia a preparação de 0,75 s (anda a 30%, interrompível; a interrupção
// mantém o custo). Depois o lutador DEIXA DE EXISTIR por 0,2 s (`f.absent`: sem corpo, colisão, acerto nem seleção como alvo) mas VIAJA em linha reta até o marcador (a câmera o segue) e reaparece nele (ou no ponto válido
// mais próximo). No reaparecimento procura o adversário mais próximo A PARTIR DO MARCADOR (raio de busca 5 m); sem alvo, não investe (recursos gastos); com alvo, faz uma
// investida PL2 em linha reta rumo à posição dele naquele instante (sem perseguir), com a velocidade, invulnerabilidade, dano, knockback e recuperação do Tackle, até
// `reach` (3 m) ou o primeiro acerto. A velocidade de impacto do knockback tem slider próprio (`impactMult`). Valores: C.world.bulletPunch, capturados ao abrir o marcador.
import {C} from '../config.js';
import {startTackleAt} from '../controller.js';
import {nominalDistance} from '../entity.js';
import {getGroundHeight} from '../physics.js';
import {effectiveArenaRadius} from '../map.js';
import {solidsOf, insideSolid} from '../vision.js';
import {angleOf, sub} from '../math.js';

export const bulletPunchDef = Object.freeze({
  id: 'bullet-punch', name: 'Bullet Punch', air: 'descend', group: 'bulletPunch', aimMode: 'follow', fromDodge: true, tackle: 'bullet-punch', aim: 'facing',
  description: 'Normal · PL2. Segure para marcar onde reaparecer (3 a 10 m), solte: some por 0,2 s, viaja até lá e reaparece no marcador investindo contra o adversário mais próximo (se houver).',
  cost: 1.5, cooldown: 8, duration: 1.75, durationKeys: ['cast', 'vanish'], motion: {type: 'walk'},
  timeline: [
    {at: .75, atKey: 'cast', effect: 'bullet-punch-vanish'},
    {at: 1.75, atKeys: ['cast', 'vanish'], effect: 'bullet-punch-return'},
  ],
});

/** Preparação do Tackle da investida: PL2, rumo fixo, mesma velocidade do Tackle (duração e distância escalam juntas até `reach`). */
export function bulletPunchSetup(/** @type {any} */ f, /** @type {any} */ a, /** @type {Record<string, any>} */ P) {
  const k = P.reach / Math.max(1e-6, nominalDistance(f, 'tackle'));   // MV-P34: velocidade do Tackle preservada; só a distância total muda
  a.pl = 2;a.fixedHeading = true;a.durationScale = k;a.distanceScale = k;a.impactMult = P.impactMult;
}

/** Fim da preparação: o lutador deixa de existir fisicamente. */
export function bulletPunchVanish(/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ def, /** @type {any} */ fx) {
  if (f.hp <= 0) return {ok: false, reason: 'defeated'};
  f.absent = true;f.velocity = {x: 0, z: 0};f.locomotionVelocity = {x: 0, z: 0};f.guard = false;f.push = null;f.flight = null;
  // Invisível e intangível, mas em movimento: viaja em linha reta até o marcador durante o desaparecimento (a câmera segue `f.position`).
  if (f.action && fx.marker) f.action.travel = {from: {x: f.position.x, z: f.position.z}, to: nearestFree(game, f, fx.marker.pos), t0: f.action.elapsed, time: Math.max(1e-6, (fx.params ?? C.world.bulletPunch).vanish)};
  fx.events?.push({result: 'bulletVanish', attacker: f.id, target: null, damage: 0, x: f.position.x, z: f.position.z, move: def.id});
}

/** Ponto livre mais próximo do marcador (arena, sólidos e outros corpos), em anéis de 0,25 m; determinístico. */
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

/** Um passo da viagem invisível até o marcador (chamado a cada passo enquanto `f.absent`); chega exatamente ao fim do desaparecimento. */
export function bulletPunchTravel(/** @type {any} */ f, /** @type {any} */ action, /** @type {number} */ dt) {
  const t = action.travel;if (!t || !f.absent) return;
  const k = Math.max(0, Math.min(1, (action.elapsed + dt - t.t0) / t.time));
  f.position = {x: t.from.x + (t.to.x - t.from.x) * k, z: t.from.z + (t.to.z - t.from.z) * k};
}

/** Fim do desaparecimento: reaparece, procura o alvo a partir do marcador e investe (ou não). */
export function bulletPunchReturn(/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ def, /** @type {any} */ fx) {
  const P = fx.params ?? C.world.bulletPunch, m = fx.marker;
  f.absent = false;
  if (f.hp <= 0 || !m) return;
  const pos = nearestFree(game, f, m.pos);
  f.position = {x: pos.x, z: pos.z};
  f.groundY = getGroundHeight(f.position, game.world, (m.y ?? 0) + .3);
  f.velocity = {x: 0, z: 0};f.locomotionVelocity = {x: 0, z: 0};
  fx.events?.push({result: 'bulletReturn', attacker: f.id, target: null, damage: 0, x: f.position.x, z: f.position.z, move: def.id});
  // alvo: o adversário mais próximo A PARTIR DO MARCADOR, com as posições atuais (vivo, presente)
  let best = null, bd = Infinity;
  for (const o of game.fighters) {
    if (o === f || o.hp <= 0 || o.absent) continue;
    const d = Math.hypot(o.position.x - m.pos.x, o.position.z - m.pos.z);
    if (d <= P.searchRadius + 1e-9 && (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && best && o.id < best.id))) {bd = d;best = o;}
  }
  if (!best) {fx.events?.push({result: 'bulletNoTarget', attacker: f.id, target: null, damage: 0, move: def.id});return;}   // reaparece normalmente, sem investida; recursos gastos
  const heading = angleOf(sub(best.position, f.position));
  startTackleAt(f, def, P, heading, game.fighters);
}
