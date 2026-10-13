import { RULES, TEST } from './config';
import { Fighter, invulnerable, offensive } from './entity';
import { Vec, angle, direction, dot, length, scale, sub, unit, vec } from './math';
export interface ContactEvent { attacker: number; target: number; result: 'impact' | 'partial' | 'perfect' | 'invulnerable'; damage: number }
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
export function isAttackApproach(attacker: Fighter, target: Fighter, normal: Vec): boolean {
  if (attacker.action?.kind !== 'dodge') return false;
  const dodgeDir = direction(attacker.action.heading);
  const offset = sub(target.position, attacker.position);
  const toTarget = length(offset) > 1e-6 ? unit(offset) : normal;
  return dot(dodgeDir, toTarget) > 0.2 && dot(dodgeDir, normal) > -0.1;
}

export function strike(a: Fighter, b: Fighter, normal: Vec, relative: Vec): ContactEvent | null {
  if (!isAttackApproach(a, b, normal) || a.action!.hits.has(b.id) || b.hp <= 0) return null;
  if (invulnerable(b)) return { attacker: a.id, target: b.id, result: 'invulnerable', damage: 0 };
  a.action!.hits.add(b.id);
  const protectedFront = b.guard && dot(direction(b.facing), unit(sub(a.position, b.position))) >= -1e-8;
  const perfect = protectedFront && b.perfectLeft > 1e-8;
  const damage = perfect ? 0 : a.attributes.attack * (protectedFront ? .5 : 1);
  b.hp = Math.max(0, b.hp - damage);
  if (protectedFront) {
    a.action = { kind: 'recoil', elapsed: 0, heading: angle(scale(normal, -1)), startAngle: 0, offensive: false, hits: new Set(), from: null };
    a.velocity = vec(); a.state = 'recoil'; a.blend = null;
    if (perfect) { b.perfectSucceeded = true; b.stun = 0; }
    else if (b.stun <= 1e-8) b.stun = RULES.guardStun;
  }
  if (!perfect) {
    b.action = null; b.blend = null; b.velocity = vec();
    if (!protectedFront) { b.guard = false; b.guardSuppressed = true; b.stun = 0; }
    const closing = Math.max(0, dot(relative, normal));
    b.push = { direction: contactDirection([{ normal, approach: closing }], a, b), distance: pushDistance(a.attributes.attack, closing, b.attributes.defense), elapsed: 0 };
    b.state = protectedFront ? 'guardStun' : 'pushed';
  }
  if (b.hp === 0) { b.state = 'defeated'; b.action = null; b.push = null; b.guard = false; }
  return { attacker: a.id, target: b.id, result: perfect ? 'perfect' : protectedFront ? 'partial' : 'impact', damage };
}
