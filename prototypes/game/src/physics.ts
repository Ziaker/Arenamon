import { ACTIONS, TEST } from './config';
import { Fighter } from './entity';
import { ContactEvent, clash, clashPossible, strike } from './combat';
import { Vec, add, clamp, dot, length, scale, smooth, sub, vec } from './math';
export function wall(f: Fighter) {
  const bound = TEST.arenaHalf - TEST.halfExtent;
  const x = clamp(f.position.x, -bound, bound), z = clamp(f.position.z, -bound, bound);
  if (x !== f.position.x) { f.contacts++; f.velocity.x = 0; }
  if (z !== f.position.z) { f.contacts++; f.velocity.z = 0; }
  f.position = vec(x, z);
}
export function contact(a: Fighter, b: Fighter): { normal: Vec; depth: number } | null {
  const dx = b.position.x - a.position.x, dz = b.position.z - a.position.z;
  const px = 2 * TEST.halfExtent - Math.abs(dx), pz = 2 * TEST.halfExtent - Math.abs(dz);
  if (px < -TEST.epsilon || pz < -TEST.epsilon) return null;
  return px < pz ? { normal: vec(dx >= 0 ? 1 : -1, 0), depth: Math.max(0, px) }
    : { normal: vec(0, dz >= 0 ? 1 : -1), depth: Math.max(0, pz) };
}
export function integrate(fighters: Fighter[], dt: number): ContactEvent[] {
  const events: ContactEvent[] = [];
  const pushVel = new Map<number, Vec>();
  for (const f of fighters) {
    f.contacts = 0;
    if (!f.push) { pushVel.set(f.id, vec()); continue; }
    const p = f.push;
    const distance = p.distance * (smooth((p.elapsed + dt) / TEST.pushDuration) - smooth(p.elapsed / TEST.pushDuration));
    pushVel.set(f.id, scale(p.direction, distance / dt));
    p.elapsed += dt; if (p.elapsed >= TEST.pushDuration - 1e-8) f.push = null;
  }
  const speed = Math.max(0, ...fighters.map(f => length(add(f.velocity, pushVel.get(f.id)!))));
  const steps = Math.max(1, Math.ceil(speed * dt / TEST.contactStep));
  for (let s = 0; s < steps; s++) {
    for (const f of fighters) {
      if (f.hp <= 0) continue;
      f.position = add(f.position, scale(add(f.velocity, pushVel.get(f.id)!), dt / steps)); wall(f);
    }
    // Repeat projection so a body at a wall cannot force the other body into it.
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < fighters.length; i++) for (let j = i + 1; j < fighters.length; j++) {
        const a = fighters[i], b = fighters[j], c = contact(a, b);
        if (!c || a.hp <= 0 || b.hp <= 0) continue;
        // Salto de C: acima da altura de atravessamento o colisor não toca o de quem está no chão.
        if (Math.max(a.vaultHeight, b.vaultHeight) > ACTIONS.dodge.vaultCollisionHeight) continue;
        if (pass === 0) {
          a.contacts++; b.contacts++;
          const relative = sub(add(a.velocity, pushVel.get(a.id)!), add(b.velocity, pushVel.get(b.id)!));
          if (clashPossible(a, b, c.normal, relative)) events.push(...clash(a, b, c.normal, relative));
          else {
            const ea = strike(a, b, c.normal, relative);
            const eb = strike(b, a, scale(c.normal, -1), scale(relative, -1));
            if (ea) events.push(ea); if (eb) events.push(eb);
          }
        }
        // Distribute penetration according to available space at arena limits.
        const bound = TEST.arenaHalf - TEST.halfExtent;
        const room = (f: Fighter, n: Vec) => Math.abs(n.x) > .5 ? bound - f.position.x * n.x : bound - f.position.z * n.z;
        let da = Math.min(c.depth / 2, room(a, scale(c.normal, -1)));
        let db = Math.min(c.depth - da, room(b, c.normal));
        da = Math.min(c.depth - db, room(a, scale(c.normal, -1)));
        a.position = sub(a.position, scale(c.normal, da)); b.position = add(b.position, scale(c.normal, db));
        wall(a); wall(b);
        // Remove closing components without manufacturing an impulse.
        const av = dot(a.velocity, c.normal), bv = dot(b.velocity, c.normal);
        if (av > 0) a.velocity = sub(a.velocity, scale(c.normal, av));
        if (bv < 0) b.velocity = sub(b.velocity, scale(c.normal, bv));
      }
    }
  }
  return events;
}
