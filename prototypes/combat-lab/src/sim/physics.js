// Física de passo fixo: voo balístico, deslizamento ao aterrissar, subpassos, limites da arena com rebote
// e separação de colisores AABB. Detecta clash/impacto no primeiro passe de contato.
import {C} from './config.js';
import {clashPossible, clash, resolveHit} from './combat.js';
import {vec, add, scale, sub, dot, length, normalize, clamp, direction, smoothstep} from './math.js';

/** Mantém o lutador dentro da arena; em voo, rebate na parede conforme a restituição. */
export function clampToArena(f) {
  const bound = C.test.arenaHalf - C.test.halfExtent, bounce = C.extras.toggles.enableWallBounce;
  const x = clamp(f.position.x, -bound, bound), z = clamp(f.position.z, -bound, bound);
  if (x !== f.position.x) {
    f.contacts++;
    if (f.flight) {f.flight.horizontal.x = bounce ? -f.flight.horizontal.x * C.rules.wallRestitution : 0;f.velocity.x = f.flight.horizontal.x;}
    else f.velocity.x = 0;
  }
  if (z !== f.position.z) {
    f.contacts++;
    if (f.flight) {f.flight.horizontal.z = bounce ? -f.flight.horizontal.z * C.rules.wallRestitution : 0;f.velocity.z = f.flight.horizontal.z;}
    else f.velocity.z = 0;
  }
  f.position = vec(x, z);
}
/** Sobreposição entre dois colisores quadrados: normal de a para b e profundidade. */
export function overlap(a, b) {
  const T = C.test, dx = b.position.x - a.position.x, dz = b.position.z - a.position.z, sx = 2 * T.halfExtent - Math.abs(dx), sz = 2 * T.halfExtent - Math.abs(dz);
  return sx < -T.epsilon || sz < -T.epsilon ? null : sx < sz ? {normal: vec(dx >= 0 ? 1 : -1, 0), depth: Math.max(0, sx)} : {normal: vec(0, dz >= 0 ? 1 : -1), depth: Math.max(0, sz)};
}
export function stepPhysics(fighters, dt) {
  const R = C.rules, X = C.extras.combat, T = C.extras.toggles, events = [], pushVel = new Map();
  for (const f of fighters) {
    f.contacts = 0;
    if (f.flight) {
      const flight = f.flight;
      // Voo balístico de passo fixo: gravidade na altura e arrasto exponencial no plano.
      flight.y += flight.vy * dt - .5 * R.launchGravity * dt * dt;
      flight.vy -= R.launchGravity * dt;
      flight.horizontal = scale(flight.horizontal, Math.exp(-R.launchDrag * dt));
      if (flight.y <= 0) {
        // Evento real de colisão com o solo (usado pelos efeitos visuais): velocidade vertical e horizontal no contato.
        f.lastLanding = {n: (f.lastLanding?.n ?? 0) + 1, vertical: Math.max(0, -flight.vy), horizontal: length(flight.horizontal), x: f.position.x, z: f.position.z};
        f.landingSlide = T.enableLandingSkid ? {velocity: scale(flight.horizontal, X.landingSkidFraction)} : null;
        f.flight = null;f.velocity = vec();f.knockRecovery = R.landingRecovery;
        f.state = f.hp <= 0 ? 'defeated' : 'landing';
      } else {f.velocity = {...flight.horizontal};f.state = 'airborne';}
    }
    if (f.landingSlide) {
      f.landingSlide.velocity = scale(f.landingSlide.velocity, Math.exp(-X.landingSkidDrag * dt));
      if (length(f.landingSlide.velocity) < X.landingSkidMin) f.landingSlide = null;
    }
    const skid = f.landingSlide ? f.landingSlide.velocity : vec();
    if (!f.push) {pushVel.set(f.id, skid);continue;}
    const p = f.push, dist = p.distance * (smoothstep((p.elapsed + dt) / C.test.pushDuration) - smoothstep(p.elapsed / C.test.pushDuration));
    pushVel.set(f.id, add(scale(p.direction, dist / dt), skid));
    p.elapsed += dt;if (p.elapsed >= C.test.pushDuration - 1e-8) f.push = null;
  }
  const speed = Math.max(0, ...fighters.map(f => length(add(f.velocity, pushVel.get(f.id)))));
  const steps = Math.max(1, Math.ceil(speed * dt / C.test.contactStep));
  for (let s = 0; s < steps; s++) {
    for (const f of fighters) {
      if (f.hp <= 0 && !f.flight) continue;
      f.position = add(f.position, scale(add(f.velocity, pushVel.get(f.id)), dt / steps));
      clampToArena(f);
    }
    for (let pass = 0; pass < X.contactProjectionPasses; pass++) {
      for (let ai = 0; ai < fighters.length; ai++) for (let bi = ai + 1; bi < fighters.length; bi++) {
        const a = fighters[ai], b = fighters[bi];
        // Sobreposição no ar é ignorada: o colisor de quem está acima não toca o de quem está no chão.
        if (Math.max(a.flight?.y ?? 0, a.vaultHeight ?? 0) > X.vaultCollisionHeight || Math.max(b.flight?.y ?? 0, b.vaultHeight ?? 0) > X.vaultCollisionHeight) continue;
        const contact = overlap(a, b);
        if (!contact) continue;
        if (pass === 0) {
          a.contacts++;b.contacts++;
          if (!a.flight && !b.flight && a.hp > 0 && b.hp > 0) {
            const rel = sub(add(a.velocity, pushVel.get(a.id)), add(b.velocity, pushVel.get(b.id)));
            if (clashPossible(a, b, contact.normal, rel)) events.push(...clash(a, b, contact.normal));
            else {
              const hitA = resolveHit(a, b, contact.normal, rel), hitB = resolveHit(b, a, scale(contact.normal, -1), scale(rel, -1));
              if (hitA) events.push(hitA);if (hitB) events.push(hitB);
            }
          }
        }
        const bound = C.test.arenaHalf - C.test.halfExtent;
        const room = (f, n) => Math.abs(n.x) > .5 ? bound - f.position.x * n.x : bound - f.position.z * n.z;
        const bGuards = a.action?.kind === 'recoil' && b.guard && dot(direction(b.facing), normalize(sub(a.position, b.position))) >= -1e-8;
        const aGuards = b.action?.kind === 'recoil' && a.guard && dot(direction(a.facing), normalize(sub(b.position, a.position))) >= -1e-8;
        let da, db;
        if (bGuards && !aGuards) {da = Math.min(contact.depth, room(a, scale(contact.normal, -1)));db = Math.min(contact.depth - da, room(b, contact.normal));}
        else if (aGuards && !bGuards) {db = Math.min(contact.depth, room(b, contact.normal));da = Math.min(contact.depth - db, room(a, scale(contact.normal, -1)));}
        else {
          da = Math.min(contact.depth / 2, room(a, scale(contact.normal, -1)));
          db = Math.min(contact.depth - da, room(b, contact.normal));
          da = Math.min(contact.depth - db, room(a, scale(contact.normal, -1)));
        }
        a.position = sub(a.position, scale(contact.normal, da));
        b.position = add(b.position, scale(contact.normal, db));
        clampToArena(a);clampToArena(b);
        const av = dot(a.velocity, contact.normal), bv = dot(b.velocity, contact.normal);
        if (av > 0) a.velocity = sub(a.velocity, scale(contact.normal, av));
        if (bv < 0) b.velocity = sub(b.velocity, scale(contact.normal, bv));
      }
    }
  }
  return events;
}
