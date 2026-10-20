// Física de passo fixo: voo balístico, deslizamento ao aterrissar, subpassos, limites da arena com rebote
// e separação de colisores AABB. Detecta clash/impacto no primeiro passe de contato.
import {C} from './config.js';
import {clashPossible, mutualTackle, clash, resolveHit} from './combat.js';
import {collideFighter} from './world.js';
import {collideMapFighter, damageDestructible, processDamageWithShieldAndStages} from './map.js';
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
/** Altura do piso/plataforma na posição XZ. Só considera superfícies válidas para a altura vertical atual do lutador (currentY). */
export function getGroundHeight(pos, world, currentY = null) {
  const mapState = world?.mapState;
  const platforms = mapState?.platforms ?? world?.platforms ?? C.map?.platforms;
  const obstacles = mapState?.obstacles ?? world?.obstacles ?? C.map?.obstacles;
  const destructibles = mapState?.destructibles ?? world?.destructibles;
  if (!platforms && !obstacles && !destructibles) return 0;
  let highest = 0;
  const footMargin = (C.test?.halfExtent ?? 0.35) * 0.5;
  if (platforms) {
    for (const p of platforms) {
      const px = p.pos ? p.pos.x : p.x;
      const pz = p.pos ? p.pos.z : p.z;
      const hx = ((p.width ?? 3) / 2) + footMargin;
      const hz = ((p.depth ?? 3) / 2) + footMargin;
      if (Math.abs(pos.x - px) <= hx && Math.abs(pos.z - pz) <= hz) {
        if (currentY === null || currentY >= p.height - 0.35) {
          if (p.height > highest) highest = p.height;
        }
      }
    }
  }
  if (obstacles) {
    for (const o of obstacles) {
      const ox = o.pos?.x ?? 0, oz = o.pos?.z ?? 0;
      const h = (o.pos?.y ?? 0) + (o.height ?? 1.5);
      if (o.shape === 'cylinder' || o.shape === 'pillar') {
        const r = (o.radius ?? 1) + footMargin;
        const dx = pos.x - ox, dz = pos.z - oz;
        if (dx * dx + dz * dz <= r * r) {
          if (currentY === null || currentY >= h - 0.35) {
            if (h > highest) highest = h;
          }
        }
      } else {
        const hx = (o.hx ?? 1.5) + footMargin;
        const hz = (o.hz ?? 1.5) + footMargin;
        if (Math.abs(pos.x - ox) <= hx && Math.abs(pos.z - oz) <= hz) {
          if (currentY === null || currentY >= h - 0.35) {
            if (h > highest) highest = h;
          }
        }
      }
    }
  }
  if (destructibles) {
    for (const d of destructibles) {
      if (d.state !== 'solid') continue;
      const h = (d.pos?.y ?? 0) + (d.size?.height ?? 1.6);
      const hx = (d.size?.hx ?? 0.8) + footMargin;
      const hz = (d.size?.hz ?? 0.8) + footMargin;
      if (Math.abs(pos.x - d.pos.x) <= hx && Math.abs(pos.z - d.pos.z) <= hz) {
        if (currentY === null || currentY >= h - 0.35) {
          if (h > highest) highest = h;
        }
      }
    }
  }
  return highest;
}

/**
 * Face inferior (teto) mais baixa cruzada entre fromY e toY na posição XZ: plataformas, obstáculos e destrutíveis sólidos.
 * Só conta superfícies cujo UNDERSIDE está estritamente acima do ponto de partida e alcançado nesta subida.
 * Fora da área XZ (ou sem travessia) não há teto. Não altera estado: apenas consulta a geometria.
 */
export function getCeilingHeight(pos, world, fromY, toY) {
  if (toY <= fromY) return null;
  const mapState = world?.mapState;
  const platforms = mapState?.platforms ?? world?.platforms ?? C.map?.platforms;
  const obstacles = mapState?.obstacles ?? world?.obstacles ?? C.map?.obstacles;
  const destructibles = mapState?.destructibles ?? world?.destructibles;
  let lowest = Infinity;
  if (platforms) {
    for (const p of platforms) {
      const px = p.pos ? p.pos.x : p.x, pz = p.pos ? p.pos.z : p.z;
      const hx = (p.width ?? 3) / 2, hz = (p.depth ?? 3) / 2;
      if (Math.abs(pos.x - px) <= hx && Math.abs(pos.z - pz) <= hz) {
        const underside = p.height;
        if (underside > fromY + 1e-6 && underside <= toY + 1e-6 && underside < lowest) lowest = underside;
      }
    }
  }
  if (obstacles) {
    for (const o of obstacles) {
      const ox = o.pos?.x ?? 0, oz = o.pos?.z ?? 0;
      const underside = o.pos?.y ?? 0;
      if (underside <= fromY + 1e-6 || underside > toY + 1e-6) continue;
      let inside = false;
      if (o.shape === 'cylinder' || o.shape === 'pillar') {
        const dx = pos.x - ox, dz = pos.z - oz, r = o.radius ?? 1;
        inside = dx * dx + dz * dz <= r * r;
      } else inside = Math.abs(pos.x - ox) <= (o.hx ?? 1.5) && Math.abs(pos.z - oz) <= (o.hz ?? 1.5);
      if (inside && underside < lowest) lowest = underside;
    }
  }
  if (destructibles) {
    for (const d of destructibles) {
      if (d.state !== 'solid') continue;
      const underside = d.pos?.y ?? 0;
      if (underside <= fromY + 1e-6 || underside > toY + 1e-6) continue;
      if (Math.abs(pos.x - d.pos.x) <= (d.size?.hx ?? .8) && Math.abs(pos.z - d.pos.z) <= (d.size?.hz ?? .8) && underside < lowest) lowest = underside;
    }
  }
  return lowest === Infinity ? null : lowest;
}
/** Mantém o lutador dentro da arena circular (ou quadrada configurada); em voo, rebate na parede conforme a restituição. */
export function clampToArena(f) {
  const isCircle = C.map?.arenaShape !== 'square';
  const bounce = C.extras.toggles.enableWallBounce;

  if (isCircle) {
    const radius = C.map?.arenaRadius ?? 50;
    // arenaHalf é o half-size da arena QUADRADA legada (protótipo de blocos): o padrão 16 NÃO é um cap para a
    // arena circular oficial. Cap técnico para cenários de teste da arena circular: C.test.circleCap (null = raio oficial).
    const LEGACY_SQUARE_HALF = 16;
    const legacyCap = (C.test.arenaHalf != null && C.test.arenaHalf < radius && C.test.arenaHalf !== LEGACY_SQUARE_HALF) ? C.test.arenaHalf : null;
    const effRadius = C.test.circleCap != null ? Math.min(C.test.circleCap, radius) : (legacyCap ?? radius);
    const bound = effRadius - C.test.halfExtent;
    const d = length(f.position);
    if (d > bound) {
      f.contacts++;
      const nOut = d > 1e-7 ? scale(f.position, 1 / d) : vec(1, 0);
      const nIn = scale(nOut, -1);
      f.position = scale(nOut, bound);

      if (f.flight && tryWallSplat(f, nIn)) {
        /* gruda no wall-splat */
      } else if (f.flight) {
        const vDotN = dot(f.flight.horizontal, nOut);
        if (vDotN > 0) {
          const vNorm = scale(nOut, vDotN);
          const vTan = sub(f.flight.horizontal, vNorm);
          const bounceFactor = bounce ? C.rules.wallRestitution * (C.map?.wallBounceMultiplier ?? 1) : 0;
          f.flight.horizontal = sub(vTan, scale(vNorm, bounceFactor));
          f.velocity = {...f.flight.horizontal};
          if (bounce) wallVertical(f);
        }
      } else {
        const vDotN = dot(f.velocity, nOut);
        if (vDotN > 0) {
          f.velocity = sub(f.velocity, scale(nOut, vDotN));
        }
      }
    }
    return;
  }

  const bound = C.test.arenaHalf - C.test.halfExtent;
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
      flight.y ??= f.groundY ?? 0;
      const g = flight.gravity ?? R.launchGravity;
      // Voo balístico de passo fixo: gravidade na altura e arrasto exponencial no plano.
      const prevY = flight.y;
      flight.y += flight.vy * dt - .5 * g * dt * dt;
      flight.vy -= g * dt;
      // Teto: subindo e cruzando a face inferior de uma plataforma/obstáculo/destrutível sólido, a subida para ali.
      // Sem isso a face inferior era atravessada e a checagem de pouso "teleportava" o lutador para o topo.
      // O corpo inteiro é respeitado: os PÉS param a bodyHeight abaixo da face (a CABEÇA encosta na face);
      // nunca abaixo do piso da arena. A travessia é testada pela CABEÇA (pés + bodyHeight): testar pelos pés
      // só detectaria a face quando o corpo já estivesse inteiramente dentro do sólido.
      if (flight.vy > 0) {
        const bodyHeight = C.extras?.visual?.bodyHeight ?? 1.2;
        const underside = getCeilingHeight(f.position, world, prevY + bodyHeight, flight.y + bodyHeight);
        if (underside != null) {
          flight.y = Math.max(underside - bodyHeight, 0);
          flight.vy = 0;
          f.lastCeilingBump = {n: (f.lastCeilingBump?.n ?? 0) + 1, y: flight.y, face: underside, x: f.position.x, z: f.position.z};
        }
      }
      const drag = flight.isNormalJump ? (C.map?.jumpDrag ?? 0.0) : R.launchDrag;
      flight.horizontal = scale(flight.horizontal, Math.exp(-drag * dt));
      const curY = flight.y ?? (f.groundY ?? 0);
      const targetGround = getGroundHeight(f.position, world, curY);
      // Pouso só na descida e CRUZANDO a superfície vindo de cima (prevY ≥ alvo − ε): uma plataforma cruzada por baixo
      // durante a subida nunca é apoio — sem isso o lutador "teleportava" para o topo ao atravessar a faixa de
      // tolerância por baixo. O ε absorve o contato exato (ex.: clamp de teto que parou os pés exatamente no piso);
      // a subida segue bloqueada pelo vy ≤ 0.
      if (flight.vy <= 0 && flight.y <= targetGround && prevY >= targetGround - 1e-6) {
        flight.y = targetGround;
        f.groundY = targetGround;
        // Evento real de colisão com o solo (usado pelos efeitos visuais): velocidade vertical e horizontal no contato.
        f.lastLanding = {n: (f.lastLanding?.n ?? 0) + 1, vertical: Math.max(0, -flight.vy), horizontal: length(flight.horizontal), x: f.position.x, z: f.position.z};
        f.landingSlide = T.enableLandingSkid ? {velocity: scale(flight.horizontal, X.landingSkidFraction)} : null;
        f.flight = null;f.velocity = vec();
        const wasNormalJump = !!f.normalJumpLanding;
        f.knockRecovery = (wasNormalJump || f.hp <= 0) ? 0 : R.landingRecovery; // derrotado não tem recuperação de pouso
        f.recoveryFrom = null;
        f.normalJumpLanding = false;
        f.state = f.hp <= 0 ? 'defeated' : (wasNormalJump ? 'neutral' : 'landing');
        if (f.jumpState) {
          f.jumpState.canJump = false;
          f.jumpState.cooldown = C.map?.jumpInterval ?? 0.25;
        }
        // Recovery rápido: C apertado a tempo no ar e stamina suficiente: ao tocar o chão, a esquiva sai na hora (o controlador a inicia).
        const tech = f.tech;f.tech = null;
        if (T.enableTechRecovery && tech && f.hp > 0 && f.stamina >= R.techCost - 1e-8 && (R.techCost <= 0 || !f.exhausted)) {f.knockRecovery = 0;f.landingSlide = null;f.techDodge = {dir: tech.dir};f.state = 'neutral';}
      } else {f.velocity = {...flight.horizontal};f.state = 'airborne';}
    } else if (f.action?.slam || (f.vaultHeight ?? 0) > 0.05 || f.action?.jump) {
      // Lutador em ação aérea (meteor slam, salto ou esquiva elevada):
      // NÃO aplicar queda espúria de borda de plataforma (evita cancelar o slam no ar)!
      const curAlt = (f.groundY ?? 0) + (f.vaultHeight ?? 0);
      const targetGround = getGroundHeight(f.position, world, curAlt);
      // Se estiver no mergulho do meteor slam e cruzar o solo (plataforma ou arena), aterrissa
      if (f.action?.slam && f.action.slamPrepDone && curAlt <= targetGround + 0.05) {
        f.groundY = targetGround;
        f.vaultHeight = 0;
        f.action.slamLanded = true;
      }
    } else {
      // Lutador no chão: verifica se saiu pela borda de uma plataforma (R7.10)
      const curY = f.groundY ?? 0;
      const targetGround = getGroundHeight(f.position, world, curY);
      f.groundY ??= 0;
      if (f.groundY > targetGround + 0.1) {
        // Entra em queda balística mantendo a velocidade horizontal (R7.10)
        f.flight = {y: f.groundY, vy: 0, horizontal: {...f.velocity}, isEdgeFall: true};
        f.state = 'airborne';
      } else {
        f.groundY = targetGround;
      }
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
      // Obstáculos, plataformas e destrutíveis do mapa (R1.6, R1.8, R7.6, R7.15, R10.7-R10.8)
      if (world?.mapState) {
        collideMapFighter(world.mapState, f, events);
        clampToArena(f);
        // Tackle danifica destrutíveis sólidos (R1.5, R3.4, R5.14, R9.10)
        if (f.action?.kind === 'tackle' && !f.action.neutralized && world.mapState.destructibles) {
          for (const d of world.mapState.destructibles) {
            if (d.state !== 'solid' || f.action.hits?.has(d.id)) continue;
            const fY = (f.groundY ?? 0) + (f.flight?.y ?? f.vaultHeight ?? 0);
            if (fY + C.extras.visual.bodyHeight <= d.pos.y || fY >= d.pos.y + d.size.height) continue;
            const dx = Math.abs(f.position.x - d.pos.x), dz = Math.abs(f.position.z - d.pos.z);
            if (dx <= d.size.hx + C.test.halfExtent && dz <= d.size.hz + C.test.halfExtent) {
              f.action.hits.add(d.id);
              const atkStageMult = 1 + (f.stages?.attack ?? 0) * (C.map?.stageAttackBonus ?? 0.10);
              const dmg = (C.rules?.tackleDamage ?? 10) * (f.action.plDamage ?? 1) * atkStageMult;
              damageDestructible(d, dmg, 'physical', f, world.mapState, events);
            }
          }
        }
      }
    }
    for (let pass = 0; pass < X.contactProjectionPasses; pass++) {
      for (let ai = 0; ai < fighters.length; ai++) for (let bi = ai + 1; bi < fighters.length; bi++) {
        const a = fighters[ai], b = fighters[bi];
        // Sobreposição tridimensional real (R7.11)
        const ya0 = (a.groundY ?? 0) + (a.flight?.y ?? 0) + (a.vaultHeight ?? 0);
        const ya1 = ya0 + C.extras.visual.bodyHeight;
        const yb0 = (b.groundY ?? 0) + (b.flight?.y ?? 0) + (b.vaultHeight ?? 0);
        const yb1 = yb0 + C.extras.visual.bodyHeight;
        if (ya1 < yb0 || yb1 < ya0) continue;
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
        const bound = (C.map?.arenaShape !== 'square' ? (C.map?.arenaRadius ?? 50) : C.test.arenaHalf) - C.test.halfExtent;
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
    w.announced = true;
    const baseDmg = R.wallSplatDamage;
    const attackerId = typeof f.lastAttacker === 'number' ? f.lastAttacker : null;
    let effectiveDmg = baseDmg;
    if (baseDmg > 0 && f.hp > 0) {
      // Autoria real: só um lastAttacker registrado. Sem ele é dano ambiental SEM autor (nunca o índice oposto).
      const attackerF = attackerId != null ? (fighters.find(other => other.id === attackerId) ?? null) : null;
      const res = processDamageWithShieldAndStages(f, baseDmg, attackerF, false);
      effectiveDmg = res.hpDamage;
    }
    events.push({result: 'wallSplat', attacker: attackerId, target: f.id, damage: effectiveDmg, normal: {...w.normal}, duration: w.duration});
  }
  // Impacto do meteor slam no chão: quem estiver embaixo de quem aterrissou é acertado, mesmo sem avanço no instante do pouso.
  for (const a of fighters) {
    const s = a.action;
    if (!s?.slam || !s.slamLanded || s.groundHit || a.hp <= 0) continue;
    s.groundHit = true;
    for (const b of fighters) {
      if (b === a || b.hp <= 0 || b.flight || s.hits.has(b.id)) continue;
      const off = sub(b.position, a.position);if (length(off) > C.rules.slamGroundRadius) continue;
      const n = length(off) > 1e-6 ? normalize(off) : direction(s.heading), ev = resolveHit(a, b, n, scale(n, 6), true);
      if (ev) events.push(ev);
    }
  }
  return events;
}
