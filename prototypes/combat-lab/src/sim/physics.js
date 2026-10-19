// Física de passo fixo: voo balístico, deslizamento ao aterrissar, subpassos, limites da arena com rebote
// e separação de colisores AABB. Detecta clash/impacto no primeiro passe de contato.
import {C} from './config.js';
import {clashPossible, mutualTackle, clash, resolveHit} from './combat.js';
import {collideFighter} from './world.js';
import {vec, add, scale, sub, dot, length, normalize, clamp, direction, smoothstep} from './math.js';

/** Componente vertical do rebote: multiplica a velocidade vertical atual e soma um impulso para cima. */
function wallVertical(f) {const R = C.rules;f.flight.vy = f.flight.vy * R.wallBounceVertical + R.wallBounceUp;}
/**
 * Wall-splat: lançado que bate na parede já CAINDO (vy < 0), com velocidade horizontal acima do mínimo, gruda nela na altura do impacto,
 * indefeso e suspenso pela duração configurada (acertável de novo). Subindo, vale o ricochete de sempre.
 */
function tryWallSplat(f, normal) {
  const R = C.rules;
  if (!C.extras.toggles.enableWallSplat || f.wallSplat || !f.flight || f.flight.vy >= 0 || length(f.flight.horizontal) < R.wallSplatMinSpeed) return false;
  f.flight.horizontal = vec();f.flight.vy = 0;f.flight.y = Math.min(f.flight.y, C.extras.combat.vaultCollisionHeight - .1);f.velocity = vec();
  f.wallSplat = {t: 0, duration: R.wallSplatDuration, normal: {...normal}, fresh: true};f.state = 'wallSplat';
  return true;
}
/** Mantém o lutador dentro da arena; em voo, rebate na parede conforme a restituição. */
export function clampToArena(f) {
  const bound = C.test.arenaHalf - C.test.halfExtent, bounce = C.extras.toggles.enableWallBounce;
  const x = clamp(f.position.x, -bound, bound), z = clamp(f.position.z, -bound, bound);
  if (x !== f.position.x) {
    f.contacts++;
    if (f.flight && tryWallSplat(f, vec(x > f.position.x ? -1 : 1, 0))) {/* gruda */}
    else if (f.flight) {f.flight.horizontal.x = bounce ? -f.flight.horizontal.x * C.rules.wallRestitution : 0;f.velocity.x = f.flight.horizontal.x;if (bounce) wallVertical(f);}
    else f.velocity.x = 0;
  }
  if (z !== f.position.z) {
    f.contacts++;
    if (f.flight && tryWallSplat(f, vec(0, z > f.position.z ? -1 : 1))) {/* gruda */}
    else if (f.flight) {f.flight.horizontal.z = bounce ? -f.flight.horizontal.z * C.rules.wallRestitution : 0;f.velocity.z = f.flight.horizontal.z;if (bounce) wallVertical(f);}
    else f.velocity.z = 0;
  }
  f.position = vec(x, z);
}
/** Sobreposição entre dois colisores quadrados: normal de a para b e profundidade. */
export function overlap(a, b) {
  const T = C.test, dx = b.position.x - a.position.x, dz = b.position.z - a.position.z, sx = 2 * T.halfExtent - Math.abs(dx), sz = 2 * T.halfExtent - Math.abs(dz);
  return sx < -T.epsilon || sz < -T.epsilon ? null : sx < sz ? {normal: vec(dx >= 0 ? 1 : -1, 0), depth: Math.max(0, sx)} : {normal: vec(0, dz >= 0 ? 1 : -1), depth: Math.max(0, sz)};
}
export function stepPhysics(fighters, dt, world = null) {
  const R = C.rules, X = C.extras.combat, T = C.extras.toggles, events = [], pushVel = new Map();
  for (const f of fighters) {
    f.contacts = 0;
    // Preso na parede: suspenso (sem gravidade nem movimento) até acabar a janela; depois volta a cair.
    if (f.wallSplat) {
      const w = f.wallSplat;
      if (w.fresh) {w.fresh = false;f.velocity = vec();pushVel.set(f.id, vec());continue;}   // o passo em que gruda só registra; o tempo corre a partir do próximo
      w.t += dt;f.velocity = vec();f.state = 'wallSplat';pushVel.set(f.id, vec());
      if (w.t >= w.duration - 1e-8) {f.wallSplat = null;if (f.flight) f.state = 'airborne';}
      continue;
    }
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
        f.flight = null;f.velocity = vec();f.knockRecovery = R.landingRecovery;f.recoveryFrom = null;
        f.state = f.hp <= 0 ? 'defeated' : 'landing';
        // Recovery rápido: C apertado a tempo no ar e stamina suficiente: ao tocar o chão, a esquiva sai na hora (o controlador a inicia).
        const tech = f.tech;f.tech = null;
        if (T.enableTechRecovery && tech && f.hp > 0 && f.stamina >= R.techCost - 1e-8 && (R.techCost <= 0 || !f.exhausted)) {f.knockRecovery = 0;f.landingSlide = null;f.techDodge = {dir: tech.dir};f.state = 'neutral';}
      } else {f.velocity = {...flight.horizontal};f.state = 'airborne';}
    }
    if (f.landingSlide) {
      f.landingSlide.velocity = scale(f.landingSlide.velocity, Math.exp(-X.landingSkidDrag * dt));
      if (length(f.landingSlide.velocity) < X.landingSkidMin) f.landingSlide = null;
    }
    const skid = f.landingSlide ? f.landingSlide.velocity : vec();
    if (!f.push) {pushVel.set(f.id, skid);continue;}
    const p = f.push, dur = p.duration ?? C.test.pushDuration, dist = p.distance * (smoothstep((p.elapsed + dt) / dur) - smoothstep(p.elapsed / dur));
    pushVel.set(f.id, add(scale(p.direction, dist / dt), skid));
    p.elapsed += dt;if (p.elapsed >= dur - 1e-8) f.push = null;
  }
  const speed = Math.max(0, ...fighters.map(f => length(add(f.velocity, pushVel.get(f.id)))));
  const steps = Math.max(1, Math.ceil(speed * dt / C.test.contactStep));
  for (let s = 0; s < steps; s++) {
    for (const f of fighters) {
      if (f.hp <= 0 && !f.flight) continue;
      f.position = add(f.position, scale(add(f.velocity, pushVel.get(f.id)), dt / steps));
      clampToArena(f);
      // Paredes e barreiras sólidas criadas por movimentos (sem elas, nada muda).
      if (world?.entities.length) {collideFighter(world, f, events);clampToArena(f);}
    }
    for (let pass = 0; pass < X.contactProjectionPasses; pass++) {
      for (let ai = 0; ai < fighters.length; ai++) for (let bi = ai + 1; bi < fighters.length; bi++) {
        const a = fighters[ai], b = fighters[bi];
        // Sobreposição no ar é ignorada: o colisor de quem está acima não toca o de quem está no chão.
        if (Math.max(a.flight?.y ?? 0, a.vaultHeight ?? 0) > X.vaultCollisionHeight || Math.max(b.flight?.y ?? 0, b.vaultHeight ?? 0) > X.vaultCollisionHeight) continue;
        // Pulo físico por cima do rival: os dois não se tocam até o pouso.
        if (a.action?.jump?.over === b.id || b.action?.jump?.over === a.id) continue;
        const contact = overlap(a, b);
        if (!contact) continue;
        if (pass === 0) {
          a.contacts++;b.contacts++;
          if ((!a.flight || a.wallSplat) && (!b.flight || b.wallSplat) && a.hp > 0 && b.hp > 0) {
            const rel = sub(add(a.velocity, pushVel.get(a.id)), add(b.velocity, pushVel.get(b.id)));
            if (clashPossible(a, b, contact.normal, rel) || mutualTackle(a, b, contact.normal, rel)) events.push(...clash(a, b, contact.normal));
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
  // Wall-splat que começou neste passo: evento e dano extra (slider; 0 por padrão).
  for (const f of fighters) {
    const w = f.wallSplat;if (!w || !w.fresh || w.announced) continue;
    w.announced = true;const dmg = R.wallSplatDamage;if (dmg > 0 && f.hp > 0) f.hp = Math.max(0, f.hp - dmg);
    events.push({result: 'wallSplat', attacker: f.lastAttacker ?? 1 - f.id, target: f.id, damage: dmg, normal: {...w.normal}, duration: w.duration});
  }
  return events;
}
