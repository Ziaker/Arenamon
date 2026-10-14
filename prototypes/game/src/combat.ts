import { ACTIONS, RULES, TEST } from './config';
import { Fighter, invulnerable } from './entity';
import { Vec, angle, direction, dot, length, scale, sub, unit, vec } from './math';
export interface ContactEvent { attacker: number; target: number; result: 'impact' | 'partial' | 'perfect' | 'invulnerable' | 'perfectDodge' | 'clash'; damage: number }
export function pushDistance(attack: number, closingSpeed: number, defense: number) {
  const force = .6 * attack / TEST.attackReference + .4 * Math.max(0, closingSpeed) / TEST.speedReference;
  return TEST.pushCoefficient * force * (1 - .5 * defense / (defense + TEST.defenseMedian));
}
// One box yields one contact normal. Compound colliders can supply weighted normals here later.
export function contactDirection(normals: { normal: Vec; approach: number }[], a: Fighter, b: Fighter): Vec {
  let sum = vec(), weights = 0;
  for (const c of normals) { const w = Math.max(0, c.approach); sum.x += c.normal.x * w; sum.z += c.normal.z * w; weights += w; }
  if (weights > 1e-8 && length(sum) / weights >= .1) return unit(sum);
  const centers = sub(b.position, a.position);
  if (length(centers) > 1e-8) return unit(centers);
  return unit(sub(a.velocity, b.velocity));
}
/** Só o tackle X ataca (C nunca causa dano); o acerto depende da trajetória real, não da orientação do corpo. */
export function isAttackApproach(attacker: Fighter, target: Fighter, normal: Vec): boolean {
  if (attacker.action?.kind !== 'tackle') return false;
  const dir = direction(attacker.action.heading);
  const offset = sub(target.position, attacker.position);
  const toTarget = length(offset) > 1e-6 ? unit(offset) : normal;
  return dot(dir, toTarget) > 0.2 && dot(dir, normal) > -0.1;
}

/** X contra X frente a frente e se aproximando: clash (resolve antes da invulnerabilidade, como no laboratório). */
export function clashPossible(a: Fighter, b: Fighter, normal: Vec, relative: Vec): boolean {
  const K = ACTIONS.clash;
  if (a.action?.kind !== 'tackle' || b.action?.kind !== 'tackle' || a.action.hits.has(b.id) || b.action.hits.has(a.id)) return false;
  return dot(direction(a.action.heading), normal) > K.facingAlignment && dot(direction(b.action.heading), normal) < -K.facingAlignment && dot(relative, normal) > K.closingSpeed;
}
/** Clash: cada um recebe 30% do ataque do outro; os dois terminam o X e são empurrados para trás pelo empurrão do GDD. */
export function clash(a: Fighter, b: Fighter, normal: Vec, relative: Vec): ContactEvent[] {
  const fraction = ACTIONS.clash.fraction, toA = b.attributes.attack * fraction, toB = a.attributes.attack * fraction, closing = Math.max(0, dot(relative, normal));
  a.hp = Math.max(0, a.hp - toA); b.hp = Math.max(0, b.hp - toB);
  for (const [f, other, away] of [[a, b, scale(normal, -1)], [b, a, normal]] as const) {
    f.action!.hits.add(other.id);
    f.action = null; f.blend = null; f.velocity = vec(); f.vaultHeight = 0; f.counterWindow = 0;
    f.push = { direction: away, distance: pushDistance(other.attributes.attack, closing, f.attributes.defense), elapsed: 0 };
    f.state = f.hp === 0 ? 'defeated' : 'pushed';
  }
  return [{ attacker: a.id, target: b.id, result: 'clash', damage: toB }, { attacker: b.id, target: a.id, result: 'clash', damage: toA }];
}

export function strike(a: Fighter, b: Fighter, normal: Vec, relative: Vec): ContactEvent | null {
  if (!isAttackApproach(a, b, normal) || a.action!.hits.has(b.id) || b.hp <= 0) return null;
  if (invulnerable(b)) {
    a.action!.hits.add(b.id);
    // Esquiva perfeita: só a esquiva C (não um X que herdou invulnerabilidade de C) concede o bônus, uma vez por tackle.
    if (b.action?.kind === 'dodge') {
      const D = ACTIONS.dodge;
      b.counterWindow = Math.max(b.counterWindow, D.counterWindow);
      b.stamina = Math.min(RULES.staminaMax, b.stamina + D.perfectEvadeStamina); b.regenBase = b.stamina; b.regenAge = 0;
      if (b.stamina >= D.cost) b.exhausted = false;
      return { attacker: a.id, target: b.id, result: 'perfectDodge', damage: 0 };
    }
    return { attacker: a.id, target: b.id, result: 'invulnerable', damage: 0 };
  }
  a.action!.hits.add(b.id);
  const protectedFront = b.guard && dot(direction(b.facing), unit(sub(a.position, b.position))) >= -1e-8;
  const perfect = protectedFront && b.perfectLeft > 1e-8;
  const damage = perfect ? 0 : a.attributes.attack * (protectedFront ? .5 : 1);
  b.hp = Math.max(0, b.hp - damage);
  if (protectedFront) {
    a.action = { kind: 'recoil', elapsed: 0, heading: angle(scale(normal, -1)), startAngle: 0, offensive: false, hits: new Set(), from: null };
    a.velocity = vec(); a.state = 'recoil'; a.blend = null; a.vaultHeight = 0;
    if (perfect) { b.perfectSucceeded = true; b.stun = 0; b.counterWindow = Math.max(b.counterWindow, ACTIONS.perfectGuardCounterWindow); }
    else if (b.stun <= 1e-8) b.stun = RULES.guardStun;
  }
  if (!perfect) {
    b.action = null; b.blend = null; b.velocity = vec(); b.vaultHeight = 0;
    if (!protectedFront) { b.guard = false; b.guardSuppressed = true; b.stun = 0; b.counterWindow = 0; }
    // Etapa A / GDD: a defesa não desloca o defensor (só o atacante recua). O empurrão do GDD vale para o impacto.
    if (protectedFront) { b.push = null; b.locomotionVelocity = vec(); b.state = 'guardStun'; }
    else {
      const closing = Math.max(0, dot(relative, normal));
      b.push = { direction: contactDirection([{ normal, approach: closing }], a, b), distance: pushDistance(a.attributes.attack, closing, b.attributes.defense), elapsed: 0 };
      b.state = 'pushed';
    }
  }
  if (b.hp === 0) { b.state = 'defeated'; b.action = null; b.push = null; b.guard = false; }
  return { attacker: a.id, target: b.id, result: perfect ? 'perfect' : protectedFront ? 'partial' : 'impact', damage };
}
