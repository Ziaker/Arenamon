// Física de passo fixo: voo balístico, deslizamento ao aterrissar, subpassos, limites da arena com rebote
// e separação de colisores AABB. Detecta clash/impacto no primeiro passe de contato.
import {C} from './config.js';
import {clashPossible, mutualTackle, clash, resolveHit, resolveFootstool} from './combat.js';
import {collideFighter} from './world.js';
import {ageSurfaces} from './solid-contact.js';
import {collisionProbe, noteContact, horizontalOf} from './collision-probe.js';
import {collideMapFighter, damageDestructible, processDamageWithShieldAndStages, effectiveArenaRadius} from './map.js';
import {passiveCost, hitStunFactor} from './passive-engine.js';
import {altitudeOf} from './entity.js';
import {stat} from './status.js';
import {vec, add, scale, sub, dot, length, normalize, clamp, direction, smoothstep} from './math.js';

/** Sonda de diagnóstico (auditoria externa §64): subpassos e contatos do último passo físico.
 * Leitura externa apenas — não entra no estado da simulação, no save nem no replay. */
export const physicsProbe = {substeps: 0, contacts: 0, staticConflicts: 0, staticConflictsTotal: 0};
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
const GROUND = Object.freeze({y: 0, kind: 'ground', id: null, normal: Object.freeze({x: 0, y: 1, z: 0})});
/**
 * Superfície de APOIO na posição XZ (contrato da Fase 4): a mais alta entre plataformas, obstáculos e destrutíveis sólidos que apoiam um
 * lutador na altura `currentY` (null = qualquer altura), ou o piso. `y` é a altura real do topo; `normal` aponta para cima (as superfícies de
 * apoio são topos horizontais). Só considera superfícies válidas para a altura vertical atual do lutador (currentY).
 * @returns {{y: number, kind: 'ground' | 'platform' | 'obstacle' | 'destructible', id: any, normal: {x: number, y: number, z: number}}}
 */
export function groundSurface(pos, world, currentY = null) {
  const mapState = world?.mapState;
  const platforms = mapState?.platforms ?? world?.platforms ?? C.map?.platforms;
  const obstacles = mapState?.obstacles ?? world?.obstacles ?? C.map?.obstacles;
  const destructibles = mapState?.destructibles ?? world?.destructibles;
  if (!platforms && !obstacles && !destructibles) return GROUND;
  let best = GROUND;
  const footMargin = (C.test?.halfExtent ?? 0.35) * 0.5;
  const support = (C.map?.mountTolerance ?? 0.25) + 0.10;   // apoio no topo: tolerância de montagem + 10 cm
  const consider = (h, kind, id) => {
    if ((currentY === null || currentY >= h - support) && h > best.y) best = {y: h, kind, id, normal: GROUND.normal};
  };
  if (platforms) {
    for (const p of platforms) {
      const px = p.pos ? p.pos.x : p.x;
      const pz = p.pos ? p.pos.z : p.z;
      const hx = ((p.width ?? 3) / 2) + footMargin;
      const hz = ((p.depth ?? 3) / 2) + footMargin;
      if (Math.abs(pos.x - px) <= hx && Math.abs(pos.z - pz) <= hz) consider(p.height, 'platform', p.id ?? null);
    }
  }
  if (obstacles) {
    for (const o of obstacles) {
      const ox = o.pos?.x ?? 0, oz = o.pos?.z ?? 0;
      const h = (o.pos?.y ?? 0) + (o.height ?? 1.5);
      if (o.shape === 'cylinder' || o.shape === 'pillar') {
        const r = (o.radius ?? 1) + footMargin;
        const dx = pos.x - ox, dz = pos.z - oz;
        if (dx * dx + dz * dz <= r * r) consider(h, 'obstacle', o.id ?? null);
      } else {
        const hx = (o.hx ?? 1.5) + footMargin;
        const hz = (o.hz ?? 1.5) + footMargin;
        if (Math.abs(pos.x - ox) <= hx && Math.abs(pos.z - oz) <= hz) consider(h, 'obstacle', o.id ?? null);
      }
    }
  }
  if (destructibles) {
    for (const d of destructibles) {
      if (d.state !== 'solid') continue;
      const h = (d.pos?.y ?? 0) + (d.size?.height ?? 1.6);
      const hx = (d.size?.hx ?? 0.8) + footMargin;
      const hz = (d.size?.hz ?? 0.8) + footMargin;
      if (Math.abs(pos.x - d.pos.x) <= hx && Math.abs(pos.z - d.pos.z) <= hz) consider(h, 'destructible', d.id ?? null);
    }
  }
  return best;
}
/**
 * Altura do piso/plataforma na posição XZ (ver `groundSurface`).
 * @param {any} pos @param {any} world @param {number | null} [currentY]
 */
export function getGroundHeight(pos, world, currentY = null) {
  return groundSurface(pos, world, currentY).y;
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
    // O raio efetivo é o MESMO que posiciona o piso/anél visíveis (effectiveArenaRadius):
    // a parede física coincide exatamente com a parede visível — sem "paredes invisíveis".
    // C.test.arenaHalf (arena quadrada legada) NUNCA limita a arena circular.
    const effRadius = effectiveArenaRadius();
    const bound = effRadius - C.test.halfExtent;
    const d = length(f.position);
    if (d > bound + 1e-9) {   // tolerância de 1 nm: o reposicionamento em `bound` pode sobrar 1 ulp e não conta como novo contato
      f.contacts++;
      const nOut = d > 1e-7 ? scale(f.position, 1 / d) : vec(1, 0);
      const nIn = scale(nOut, -1), v0 = horizontalOf(f), depth = d - bound;   // (só no toque com a borda)
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
      noteContact(f, 'arena', null, nIn, depth, v0.x, v0.z);
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
/**
 * Sobreposição entre dois colisores: normal de a para b e profundidade.
 * test.contactShape = 0: pegada quadrada (legado); 1: pegada circular (alcance igual em todos os ângulos; normal na linha dos centros).
 */
export function overlap(a, b) {
  const T = C.test, dx = b.position.x - a.position.x, dz = b.position.z - a.position.z;
  if ((T.contactShape | 0) === 1) {
    const d = Math.hypot(dx, dz), r = 2 * T.halfExtent;
    if (d > r + T.epsilon) return null;
    return {normal: d > 1e-9 ? vec(dx / d, dz / d) : vec(1, 0), depth: Math.max(0, r - d)};
  }
  const sx = 2 * T.halfExtent - Math.abs(dx), sz = 2 * T.halfExtent - Math.abs(dz);
  return sx < -T.epsilon || sz < -T.epsilon ? null : sx < sz ? {normal: vec(dx >= 0 ? 1 : -1, 0), depth: Math.max(0, sx)} : {normal: vec(0, dz >= 0 ? 1 : -1), depth: Math.max(0, sz)};
}
/**
 * Sólidos estáticos (paredes/barreiras de Moves, objetos do mapa, borda da arena) são restrições DURAS. Alterna as projeções
 * até convergir (várias paredes, quinas agudas e corredores não deixam resíduo de penetração) e devolve se moveu o lutador.
 * Sem posição válida (vão menor que o corpo, geometria sobreposta): após STATIC_ROUNDS rodadas mantém o último estado, sem
 * teletransporte, e conta o conflito em physicsProbe.staticConflicts / staticConflictsTotal (linha «Subpassos físicos» do diagnóstico do laboratório).
 */
const STATIC_ROUNDS = 12;
function settleStatics(f, world, events) {
  for (let round = 0; round < STATIC_ROUNDS; round++) {
    // Convergiu = uma rodada inteira sem NENHUM contato penetrante (medir só o deslocamento líquido enganaria: dois sólidos
    // opostos podem se anular na rodada e deixar o lutador penetrando em ambos).
    const contacts = f.contacts;
    if (world.entities?.length) collideFighter(world, f, events);
    if (world.mapState) collideMapFighter(world.mapState, f, events);
    clampToArena(f);
    if (f.contacts === contacts) return round > 0;
  }
  physicsProbe.staticConflicts++;physicsProbe.staticConflictsTotal++;
  return true;
}
export function stepPhysics(fighters, dt, world = null) {
  const R = C.rules, X = C.extras.combat, T = C.extras.toggles, events = [], pushVel = new Map(), startY = new Map();
  collisionProbe.step++;
  /** Pouso de um voo: cruzou o topo vindo de cima. Compartilhado pelo teste do início do passo e pela reconferência depois do deslocamento horizontal. */
  const land = (f, flight, targetGround) => {
    startY.delete(f.id);   // o voo acabou: um relançamento no mesmo passo não pode ser «pousado» de novo pela reconferência
    flight.y = targetGround;
    f.groundY = targetGround;
    // Evento real de colisão com o solo (usado pelos efeitos visuais): velocidade vertical e horizontal no contato.
    f.lastLanding = {n: (f.lastLanding?.n ?? 0) + 1, vertical: Math.max(0, -flight.vy), horizontal: length(flight.horizontal), x: f.position.x, z: f.position.z, y: targetGround, regular: !!(flight.isNormalJump || flight.isEdgeFall) && !flight.bounce};   // regular: pulo/queda voluntária, sem golpe (o visual do pouso é só uma onda simples)
    f.landingSlide = T.enableLandingSkid ? {velocity: scale(flight.horizontal, X.landingSkidFraction)} : null;
    f.flight = null;f.velocity = vec();
    const wasNormalJump = !!f.normalJumpLanding;
    // Inner Focus: hit stun reduzido em 20% quando o lançamento veio de um golpe (launch(); edge-fall/jump não marca).
    const stunFactor = f.launchedByHit ? hitStunFactor(f) : 1;
    f.launchedByHit = false;
    const rec = flight.bounce ? (f.hp <= 0 ? 0 : flight.bounce.recovery) : (wasNormalJump || f.hp <= 0) ? 0 : R.landingRecovery * stunFactor; // derrotado não tem recuperação de pouso; Bounce: recuperação própria
    f.knockRecovery = rec;
    f.landingRecovery = rec;
    f.recoveryKind = rec > 0 ? 'landing' : null;
    f.recoveryFrom = null;
    f.normalJumpLanding = false;
    f.state = f.hp <= 0 ? 'defeated' : (wasNormalJump ? 'neutral' : (rec > 0 ? 'landing' : 'neutral'));
    if (f.jumpState) {
      f.jumpState.canJump = false;
      f.jumpState.cooldown = C.map?.jumpInterval ?? 0.25;
    }
    f.coyoteLeft = 0;f.footstoolDoneWith = null;f.airMoveDir = null;
    // Recovery rápido: C apertado a tempo no ar e stamina suficiente: ao tocar o chão, a esquiva sai na hora (o controlador a inicia).
    const tech = f.tech;f.tech = null;
    if (T.enableTechRecovery && tech && f.hp > 0 && f.stamina >= passiveCost(f, 'tech', R.techCost) - 1e-8 && (R.techCost <= 0 || !f.exhausted)) {f.knockRecovery = 0;f.landingRecovery = 0;f.recoveryKind = null;f.landingSlide = null;f.techDodge = {dir: tech.dir};f.state = 'neutral';}
  };
  for (const f of fighters) {
    f.contacts = 0;ageSurfaces(f);   // normais de contato (deslize na locomoção): renovadas pelos toques deste passo; o controlador as lê no próximo tick
    // Preso na parede: suspenso (sem gravidade nem movimento) até acabar a janela; depois volta a cair.
    if (f.wallSplat) {
      const w = f.wallSplat;
      if (w.fresh) {w.fresh = false;f.velocity = vec();pushVel.set(f.id, vec());continue;}   // o passo em que gruda só registra; o tempo corre a partir do próximo
      w.t += dt;f.velocity = vec();f.state = 'wallSplat';pushVel.set(f.id, vec());
      if (w.t >= w.duration - 1e-8) {f.wallSplat = null;if (f.flight) f.state = f.hp <= 0 ? 'defeated' : 'airborne';}
      continue;
    }
    if (f.ledge) {f.velocity = vec();pushVel.set(f.id, vec());continue;}   // Ledge Grab: posição e altura conduzidas por ledge.js (sem gravidade nem queda de borda)
    if (f.flight) {
      const flight = f.flight;
      flight.y ??= f.groundY ?? 0;
      let g = flight.gravity ?? R.launchGravity;
      // Plano D (salto): voos "feel" — salto normal/coyote e queda natural de borda — usam gravidade assimétrica
      // (subida leve, descida firme), corte de subida ao SOLTAR o botão (altura variável) e velocidade terminal.
      // Voos de lançamento por golpe e voos sem a marca continuam no balístico legado de gravidade única.
      const M = C.map ?? {}, feel = !!flight.jumpFeel && !!(M.jumpImprovements ?? 1);
      if (feel) {
        const gUp = M.jumpGravityUp ?? g, gDown = M.jumpGravityDown ?? gUp;
        g = flight.vy > 0 ? (flight.jumpHeld !== false ? gUp : gUp * (M.jumpReleaseMult ?? 1)) : gDown;
        const term = M.jumpMaxFallSpeed ?? 0;
        if (term > 0 && flight.vy < -term) flight.vy = -term;
        // Controle aéreo por aceleração (2.4): soma aceleração na direção pedida (airMoveDir, do controlador).
        // O teto é o MAIOR entre o momento atual e a velocidade aérea máxima — assim a inércia da corrida é
        // preservada (o vetor gira, não encolhe) e inverter exige desaceleração real ao longo de vários passos.
        const acc = flight.airAccel ?? M.jumpAirAccel ?? 0;   // após o rebote do footstool: mais aceleração e velocidade aérea
        if (acc > 0 && f.airMoveDir) {
          const maxAir = flight.airMaxSpeed ?? M.jumpAirMaxSpeed ?? 0, maxSpd = maxAir > 0 ? maxAir : stat(f, 'speed', f.attributes.speed);
          const cap = Math.max(length(flight.horizontal), maxSpd);
          const nh = add(flight.horizontal, scale(f.airMoveDir, acc * dt));
          const nlen = length(nh);
          flight.horizontal = nlen > cap ? scale(nh, cap / nlen) : nh;
        }
      }
      if (flight.isEdgeFall) f.coyoteLeft = Math.max(0, (f.coyoteLeft ?? 0) - dt);   // coyote só em queda natural
      f.footstoolCooldownT = Math.max(0, (f.footstoolCooldownT ?? 0) - dt);
      // Voo balístico de passo fixo: gravidade na altura e arrasto exponencial no plano.
      const prevY = flight.y;startY.set(f.id, prevY);
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
      const drag = flight.bounce ? 0 : flight.isNormalJump ? (C.map?.jumpDrag ?? 0.0) : R.launchDrag;   // Bounce: arco sem arrasto (a distância é a pedida)
      flight.horizontal = scale(flight.horizontal, Math.exp(-drag * dt));
      const curY = flight.y ?? (f.groundY ?? 0);
      const targetGround = getGroundHeight(f.position, world, curY);
      // Pouso só na descida e CRUZANDO a superfície vindo de cima (prevY ≥ alvo − ε): uma plataforma cruzada por baixo
      // durante a subida nunca é apoio — sem isso o lutador "teleportava" para o topo ao atravessar a faixa de
      // tolerância por baixo. O ε absorve o contato exato (ex.: clamp de teto que parou os pés exatamente no piso);
      // a subida segue bloqueada pelo vy ≤ 0.
      // ε de 1 mm (não 1e-6): o integrador Euler discreto pica ~8,4e-5 m ABAIXO da altura analítica do salto
      // (pico discreto 1,999916 m para jumpHeight 2,0 m). Com ε = 1e-6, uma superfície exatamente na altura do
      // pico do salto nunca era apoio: prevY ficava 84 μm abaixo de alvo−ε e o lutador atravessava a faixa do
      // topo em queda livre (ex.: obstáculo de 2,0 m com salto de 2,0 m). 1 mm absorve a discretização sem
      // permitir pouso vindo de baixo (quem sobe tem vy > 0; quem desliza pela lateral já está descendo).
      if (flight.vy <= 0 && flight.y <= targetGround && prevY >= targetGround - 1e-3) {
        land(f, flight, targetGround);
      } else {f.velocity = {...flight.horizontal};f.state = f.hp <= 0 ? 'defeated' : 'airborne';}
      // Footstool (Plano D, Etapa 3): ataque de contato superior do salto normal. Só vale com salto voluntário
      // (isNormalJump — inclui o salto de coyote, que converte o voo): quem apenas caiu da borda de uma plataforma
      // não footstoola, o que preserva o invariante "dano só com ação" nas partidas de IA (a IA não salta).
      // Os pés cruzam o topo do colisor físico do defensor VINDO DE CIMA, com sobreposição horizontal real.
      // O Meteor Slam tem prioridade: X no ar converte o voo em mergulho no controlador, antes da física — nunca
      // há dano duplo na mesma colisão.
      if (f.flight && (M.footstoolEnabled ?? 1) && flight.isNormalJump
        && (f.footstoolCooldownT ?? 0) <= 0 && f.hp > 0 && !f.wallSplat) {
        const bodyH = C.extras?.visual?.bodyHeight ?? 1.2, tol = M.footstoolTolerance ?? 0.12;
        const reach = 2 * C.test.halfExtent + tol;
        for (const b of fighters) {
          if (b === f || b.hp <= 0 || b.absent || b.wallSplat || f.footstoolDoneWith === b.id) continue;   // ausente (Bullet Punch): sem corpo, não pode ser pisado
          if (Math.abs(f.position.x - b.position.x) > reach || Math.abs(f.position.z - b.position.z) > reach) continue;
          const bTop = altitudeOf(b) + bodyH;
          if (flight.vy > -(M.footstoolMinFallSpeed ?? 1.0)) continue;          // só queda real e suficiente
          if (!(prevY >= bTop - tol && flight.y <= bTop + tol)) continue;       // os pés cruzam o topo vindo de cima
          events.push(resolveFootstool(f, b));
          f.footstoolDoneWith = b.id;                                          // um footstool por contato/trajetória
          f.footstoolCooldownT = M.footstoolCooldown ?? 0.5;
          flight.vy = M.footstoolBounce ?? 3.7;                                // rebote vertical do atacante
          flight.y = Math.max(flight.y, bTop + 0.02);                          // pés apoiados no topo: sem separação lateral no subpasso
          flight.horizontal = scale(flight.horizontal, 0.8);                     // conserva parte do horizontal
          flight.airAccel = M.footstoolAirAccel ?? 20;flight.airMaxSpeed = M.footstoolAirMaxSpeed ?? 7.5;   // controle aéreo maior até pousar
          break;
        }
      }
    } else if (f.action?.slam || (f.vaultHeight ?? 0) > 0.05 || f.action?.jump) {
      // Lutador em ação aérea (meteor slam, salto ou esquiva elevada):
      // NÃO aplicar queda espúria de borda de plataforma (evita cancelar o slam no ar)!
      const curAlt = (f.groundY ?? 0) + (f.vaultHeight ?? 0);
      const targetGround = getGroundHeight(f.position, world, curAlt);
      // Meteor Slam que sai da borda da superfície onde começou: o vault é relativo a groundY, então a base passa a seguir o piso REAL (a altitude dos pés é
      // preservada: a diferença vira altura de mergulho). Sem isso o lutador ficava suspenso na altura da plataforma até o fim da ação.
      if (f.action?.slam && f.action.slamPrepDone && !f.action.slamLanded && targetGround < (f.groundY ?? 0) - 0.05) {
        f.vaultHeight = (f.vaultHeight ?? 0) + ((f.groundY ?? 0) - targetGround);f.groundY = targetGround;
      }
      // Footstool pela ESQUIVA (C) por cima do rival: na descida do arco do vault, com os pés acima de (topo − footstoolVaultMargin) e sobre o rival, pisa nele; o vault vira um
      // salto normal com o rebote e o controle aéreo do footstool. Mesmas regras de dano, stagger, invulnerável e recarga do footstool do salto.
      const M = C.map ?? {}, J = f.action?.kind === 'dodge' ? f.action.jump : null;
      if (J && !J.landed && (M.footstoolEnabled ?? 1) && (M.footstoolVault ?? 1) && (f.footstoolCooldownT ?? 0) <= 0 && f.hp > 0 && J.vy < -(M.footstoolMinFallSpeed ?? 1.0)) {
        const bodyH = C.extras?.visual?.bodyHeight ?? 1.2, tol = M.footstoolTolerance ?? 0.12, reach = 2 * C.test.halfExtent + tol, margin = M.footstoolVaultMargin ?? .35;
        const feetNow = (f.groundY ?? 0) + J.y, feetPrev = (f.groundY ?? 0) + (J.prevY ?? J.y);
        for (const b of fighters) {
          if (b === f || b.hp <= 0 || b.absent || b.wallSplat || f.footstoolDoneWith === b.id) continue;   // ausente (Bullet Punch): sem corpo, não pode ser pisado
          if (Math.abs(f.position.x - b.position.x) > reach || Math.abs(f.position.z - b.position.z) > reach) continue;
          const bTop = altitudeOf(b) + bodyH, eff = bTop - margin;
          if (!(feetPrev >= eff - tol && feetNow <= eff + tol)) continue;
          events.push(resolveFootstool(f, b));
          const hz = scale(f.velocity, 0.8);
          f.action = null;f.vaultHeight = 0;f.blend = null;f.guard = false;
          f.flight = {y: bTop + 0.02, vy: M.footstoolBounce ?? 6.5, horizontal: hz, isNormalJump: true, jumpFeel: !!(M.jumpImprovements ?? 1), jumpHeld: true, airAccel: M.footstoolAirAccel ?? 20, airMaxSpeed: M.footstoolAirMaxSpeed ?? 7.5};
          f.normalJumpLanding = true;f.footstoolDoneWith = b.id;f.footstoolCooldownT = M.footstoolCooldown ?? 0.5;f.coyoteLeft = 0;f.state = 'airborne';
          break;
        }
      }
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
      if (f.absent) {   // ausente (Bullet Punch): sem corpo, não cai da borda; só acompanha a altura do apoio sob a viagem invisível
        f.groundY = targetGround;f.coyoteLeft = 0;
      } else if (f.groundY > targetGround + 0.1) {
        // Entra em queda balística mantendo a velocidade horizontal (R7.10). Queda natural de borda:
        // recebe coyote time (salto logo após a borda) e participa do pacote de sensação do salto.
        // Nunca acontece após knockback/lançamento (esses já entram em voo pelo launch()).
        const feelFall = !!(C.map?.jumpImprovements ?? 1);
        f.flight = {y: f.groundY, vy: 0, horizontal: {...f.velocity}, isEdgeFall: true, jumpFeel: feelFall, jumpHeld: false};
        if (feelFall) f.coyoteLeft = C.map?.jumpCoyoteTime ?? 0.10;
        f.state = f.hp <= 0 ? 'defeated' : 'airborne';
      } else {
        f.groundY = targetGround;
        f.coyoteLeft = 0;
      }
    }
    // Contrato de suporte (observacional; nada na simulação lê f.support): superfície que segura o lutador agora e há quantos passos.
    if (f.flight) f.support = null;
    else {
      const surf = groundSurface(f.position, world, f.groundY ?? 0), cur = f.support;
      f.support = cur && cur.kind === surf.kind && cur.id === surf.id ? {...cur, y: surf.y, age: cur.age + 1} : {kind: surf.kind, id: surf.id, y: surf.y, age: 0};
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
  physicsProbe.substeps = steps;physicsProbe.staticConflicts = 0;   // conflitos de espaço do ÚLTIMO passo (o acumulado fica em staticConflictsTotal)
  for (let s = 0; s < steps; s++) {
    for (const f of fighters) {
      if ((f.hp <= 0 && !f.flight) || f.absent) continue;   // ausente (Bullet Punch): sem corpo, não se move nem colide
      f.position = add(f.position, scale(add(f.velocity, pushVel.get(f.id)), dt / steps));
      clampToArena(f);
      // Paredes e barreiras de movimentos, obstáculos, plataformas e destrutíveis do mapa (R1.6, R1.8, R7.6, R7.15, R10.7-R10.8); sem eles, nada muda.
      if (world?.entities.length || world?.mapState) settleStatics(f, world, events);
      if (world?.mapState) {
        // Tackle danifica destrutíveis sólidos (R1.5, R3.4, R5.14, R9.10)
        if (f.action?.kind === 'tackle' && !f.action.neutralized && world.mapState.destructibles) {
          for (const d of world.mapState.destructibles) {
            if (d.state !== 'solid' || f.action.hits?.has(d.id)) continue;
            const fY = altitudeOf(f);
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
    // Lutadores que um sólido (parede de Move, objeto do mapa) devolveu à posição DEPOIS da separação entre lutadores:
    // estão presos e não podem absorver a sobreposição; o adversário livre absorve o resto (restrição dura × mole).
    const pinned = new Set();
    for (let pass = 0; pass < X.contactProjectionPasses; pass++) {
      for (let ai = 0; ai < fighters.length; ai++) for (let bi = ai + 1; bi < fighters.length; bi++) {
        const a = fighters[ai], b = fighters[bi];
        if (a.absent || b.absent) continue;   // ausência física: nenhum contato
        // Sobreposição tridimensional real (R7.11)
        const ya0 = altitudeOf(a);
        const ya1 = ya0 + C.extras.visual.bodyHeight;
        const yb0 = altitudeOf(b);
        const yb1 = yb0 + C.extras.visual.bodyHeight;
        if (ya1 < yb0 || yb1 < ya0) continue;
        // Pulo físico por cima do rival: os dois não se tocam até o pouso.
        if ((a.action?.jump?.over ?? a.flight?.over) === b.id || (b.action?.jump?.over ?? b.flight?.over) === a.id) continue;
        const contact = overlap(a, b);
        if (!contact) continue;
        if (pass === 0) {
          a.contacts++;b.contacts++;
          const airHit = (a.action?.antiAir && b.flight) || (b.action?.antiAir && a.flight);   // anti-aéreo: o corpo em voo também é acertável
          if ((!a.flight || a.wallSplat || airHit) && (!b.flight || b.wallSplat || airHit) && a.hp > 0 && b.hp > 0) {
            const rel = sub(add(a.velocity, pushVel.get(a.id)), add(b.velocity, pushVel.get(b.id)));
            if (clashPossible(a, b, contact.normal, rel) || mutualTackle(a, b, contact.normal, rel)) events.push(...clash(a, b, contact.normal));
            else {
              const hitA = resolveHit(a, b, contact.normal, rel), hitB = resolveHit(b, a, scale(contact.normal, -1), scale(rel, -1));
              if (hitA) events.push(hitA);if (hitB) events.push(hitB);
            }
          }
        }
        const bound = (C.map?.arenaShape !== 'square' ? effectiveArenaRadius() : C.test.arenaHalf) - C.test.halfExtent;
        const room = (f, n) => (C.test.contactShape | 0) === 1 ? bound - (f.position.x * n.x + f.position.z * n.z) : Math.abs(n.x) > .5 ? bound - f.position.x * n.x : bound - f.position.z * n.z;   // com normal diagonal, folga ao longo da normal
        const bGuards = a.action?.kind === 'recoil' && b.guard && dot(direction(b.facing), normalize(sub(a.position, b.position))) >= -1e-8;
        const aGuards = b.action?.kind === 'recoil' && a.guard && dot(direction(a.facing), normalize(sub(b.position, a.position))) >= -1e-8;
        let da, db;
        const aPinned = pinned.has(a.id), bPinned = pinned.has(b.id);
        if (aPinned !== bPinned) {
          if (aPinned) {da = 0;db = Math.min(contact.depth, room(b, contact.normal));}
          else {db = 0;da = Math.min(contact.depth, room(a, scale(contact.normal, -1)));}
        } else if (bGuards && !aGuards) {da = Math.min(contact.depth, room(a, scale(contact.normal, -1)));db = Math.min(contact.depth - da, room(b, contact.normal));}
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
      // Sólidos são restrições duras: a separação entre lutadores nunca pode deixar alguém dentro deles ao fim do subpasso.
      if (world?.entities.length || world?.mapState) for (const f of fighters) {
        if (!f.absent && settleStatics(f, world, events)) pinned.add(f.id);
      }
    }
  }
  // Pouso pela lateral: o teste do início do passo consulta o apoio na posição ANTERIOR ao deslocamento horizontal. Um voo descendo que entra na
  // faixa de apoio de um topo neste mesmo passo (pés a milímetros acima dele no início) não pousava; afundava até a ejeção lateral. Reconfere com a posição final.
  for (const f of fighters) {
    const flight = f.flight, was = startY.get(f.id);
    if (!flight || was === undefined || f.wallSplat || flight.vy > 0 || f.absent) continue;
    const target = getGroundHeight(f.position, world, flight.y);
    if (flight.y <= target && was >= target - 1e-3) land(f, flight, target);
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
      const res = processDamageWithShieldAndStages(f, baseDmg, attackerF, false, false, {category: 'environmental'});
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
  physicsProbe.contacts = fighters.reduce((n, f) => n + f.contacts, 0);
  return events;
}
