// @ts-check
// Mundo de combate: entidades criadas por movimentos (projéteis, barreiras, paredes e áreas — explosões, pulsos
// radiais e zonas persistentes). Infraestrutura sem conteúdo: nenhuma entidade existe até um movimento criá-la.
//
// Princípios (os mesmos do resto do motor):
//   • passo fixo e determinístico, ordem estável (criação), sem aleatoriedade própria;
//   • estado em dados simples (`game.world`), clonável por structuredClone: save/load, replay e cenários funcionam;
//   • acertos passam por UMA função (`applyHit`) que respeita invulnerabilidade, defesa frontal, defesa perfeita,
//     guard stun, modificadores de status e lançamento — as mesmas regras do tackle;
//   • sem entidades, nada muda no motor (verificado nos testes de regressão).
//
// Formas: 'circle' (raio) e 'box' (meias-medidas hx, hz, girada por `angle`). Altura: `y` (base) e `height`.
import {C} from './config.js';
import {isInvulnerable, nominalDistance, riposteIntercept} from './entity.js';
import {sweepBox, segmentHitsVolume} from './geometry.js';
import {launch} from './combat.js';
import {traceBeam} from './beam.js';
import {stepTrap} from './trap.js';
import {stepSand} from './sand.js';
import {stepBurrow} from './stone.js';
import {applyStatus, stat} from './status.js';
import {processDamageWithShieldAndStages, damageDestructible, effectiveArenaRadius} from './map.js';
import {knockbackFactor} from './passive-engine.js';
import {vec, add, sub, scale, dot, length, normalize, direction, angleOf, angleDelta, clamp} from './math.js';

export const ENTITY_KINDS = ['projectile', 'barrier', 'wall', 'area', 'beam', 'trap', 'sandwave', 'burrow'];
export const createWorld = () => ({entities: [], nextId: 1});
const fighterHeight = () => C.extras.visual.bodyHeight;
const altOf = f => (f.flight?.y ?? 0) + (f.vaultHeight ?? 0);

// ---------- Geometria ----------
/** Ponto do contorno da forma mais próximo de p (plano XZ) e distância. */
export function closestOnShape(e, p) {
  if (e.shape === 'box') {
    const c = Math.cos(e.angle ?? 0), s = Math.sin(e.angle ?? 0), d = sub(p, e.pos);
    // Eixos locais: x' = (cos, -sin), z' = (sin, cos) — rumo 0 = +Z, como o resto do motor.
    const lx = d.x * c - d.z * s, lz = d.x * s + d.z * c, qx = Math.max(-e.hx, Math.min(e.hx, lx)), qz = Math.max(-e.hz, Math.min(e.hz, lz));
    const inside = Math.abs(lx) <= e.hx && Math.abs(lz) <= e.hz;
    const q = vec(e.pos.x + qx * c + qz * s, e.pos.z - qx * s + qz * c);
    return {point: q, distance: inside ? -Math.min(e.hx - Math.abs(lx), e.hz - Math.abs(lz)) : length(sub(p, q)), inside};
  }
  const d = sub(p, e.pos), l = length(d);
  return {point: l > 1e-9 ? add(e.pos, scale(d, e.radius / l)) : add(e.pos, vec(e.radius, 0)), distance: l - e.radius, inside: l < e.radius};
}
/** Círculo (centro p, raio r) toca a forma? */
const circleTouches = (e, p, r) => closestOnShape(e, p).distance <= r;
/** Sobreposição vertical entre [a0, a1] e [b0, b1]. */
const vOverlap = (a0, a1, b0, b1) => a0 <= b1 && b0 <= a1;

// ---------- Criação ----------
export const DEFAULTS = {
  projectile: {shape: 'circle', radius: .25, y: .65, height: 0, speed: 12, life: 2, pierce: 1, blockedBy: ['barrier', 'wall'], hitsOwner: false},
  barrier: {shape: 'box', hx: .9, hz: .15, y: 0, height: 1.8, life: 3, hp: Infinity, blocksProjectiles: true, blocksFighters: false, blocksOwner: false},
  wall: {shape: 'box', hx: 1.5, hz: .3, y: 0, height: 2.2, life: Infinity, blocksProjectiles: true, blocksFighters: true},
  beam: {y: .9, life: 2, length: 24, width: .04, pl: 1, interval: .25, turn: 0, hitsOwner: false, hit: {damage: 0}},
  area: {shape: 'circle', radius: 2, y: 0, height: 2, life: .3, grow: 0, pulses: 1, interval: 0, falloff: 'none', affectsOwner: false, follow: false},
  burrow: {shape: 'circle', radius: 0, y: 0, height: 0, life: 120},
  sandwave: {shape: 'box', y: 0, height: .35, life: 1.5, active: .75},
  trap: {shape: 'circle', radius: 1.2, y: 0, height: 1.2, life: 8, armDelay: 0, pl: 1, support: true, affectsOwner: false},
};
/** Valida um modelo de entidade (lança erro legível). */
export function validateEntity(t) {
  if (!ENTITY_KINDS.includes(t?.kind)) throw new Error(`entidade de tipo desconhecido (${t?.kind})`);
  if (t.shape && !['circle', 'box'].includes(t.shape)) throw new Error(`forma desconhecida (${t.shape})`);
  if (t.hit && t.hit.damage !== undefined && !(t.hit.damage >= 0)) throw new Error('dano inválido');
  return true;
}
/**
 * Cria uma entidade. `t` traz o tipo e os campos do modelo; posição e direção já resolvidas (ver moves.js, que converte
 * posições relativas ao lutador). Respeita o limite de entidades (C.world.maxEntities): acima dele, recusa com evento.
 */
export function spawn(world, t, events = []) {
  validateEntity(t);
  if (world.entities.length >= C.world.maxEntities) {events.push({result: 'spawnRefused', attacker: t.owner ?? null, target: null, damage: 0, kind: t.kind});return null;}
  const e = structuredClone({...DEFAULTS[t.kind], ...t});
  e.id = world.nextId++;e.age = 0;e.hitLog = [];e.pulsesDone = 0;e.pos = {...(t.pos ?? vec())};e.dir = t.dir ? normalize(t.dir) : direction(t.angle ?? 0);
  if (e.kind === 'projectile') e.vel = scale(e.dir, e.speed);
  if (e.kind === 'beam') {e.nextHit = {};e.segments = [];e.contacts = [];e.maxSegments ??= C.world.beam.maxSegments;}
  if (e.kind === 'area') {e.baseRadius = e.radius;if (e.grow > 0) e.radius = e.startRadius ?? 0;}
  world.entities.push(e);events.push({result: 'spawn', attacker: e.owner ?? null, target: null, damage: 0, entity: e.id, kind: e.kind});
  return e;
}

// ---------- Acerto (função única, regras do tackle) ----------
/**
 * Resolve um acerto de entidade em `target`. hit: {damage, knockback: {horizontal, vertical}, guardable (padrão true),
 * ignoreInvulnerability, statuses: [def], hitstop}. normal: direção do empurrão (da fonte para o alvo).
 * Ordem: invulnerável → defesa frontal (perfeita: sem dano; comum: dano × guardDamageMultiplier e guard stun) → acerto
 * (dano com modificadores, lançamento ou recuperação, status). Devolve o evento.
 */
export function applyHit(game, ownerId, target, hit, normal, info = {}) {
  const R = C.rules, X = C.extras.combat, T = C.extras.toggles, owner = ownerId == null ? null : game.fighters[ownerId];
  const base = {attacker: ownerId, target: target.id, normal: {...normal}, entity: info.entity ?? null, source: info.source ?? 'world', pl: info.pl ?? null};
  if (target.hp <= 0 || target.absent) return null;
  if (!hit.ignoreInvulnerability) {const rip = riposteIntercept(target, ownerId, normal, base);if (rip) return rip;}   // Riposte: janela aberta anula o acerto e dispara o contra-golpe
  if (!hit.ignoreInvulnerability && isInvulnerable(target)) return {...base, result: 'invulnerable', damage: 0};
  const atkStageMult = owner ? (1 + (owner.stages?.attack ?? 0) * (C.map?.stageAttackBonus ?? 0.10)) : 1;
  const attack = (owner ? stat(owner, 'attack', 1) : 1) * atkStageMult, scaleK = info.scale ?? 1;
  const guardable = hit.guardable !== false && T.enableDefense, from = info.origin ?? sub(target.position, scale(normal, 1));
  const protectedFront = guardable && target.guard && dot(direction(target.facing), normalize(sub(from, target.position))) >= X.guardFrontAlignment;
  const perfect = protectedFront && target.perfectLeft > 1e-8;
  const raw = (hit.damage ?? 0) * attack * scaleK * stat(target, 'damageTaken', 1);
  const contact = info.contact ?? hit.contact ?? 'area';
  const dmgResult = processDamageWithShieldAndStages(target, raw, owner, protectedFront, perfect, {category: 'direct', contact});
  const damage = dmgResult.hpDamage;
  /** @type {{direction: import("./types").Vec, horizontal: number, vertical: number} | null} */
  let launchInfo = null;
  if (protectedFront) {
    target.velocity = vec();target.locomotionVelocity = vec();
    if (perfect) {target.perfectSucceeded = true;target.stun = 0;if (T.enableCounterBonus) target.counterWindow = Math.max(target.counterWindow, X.perfectGuardCounterWindow);}
    else if (target.stun <= 1e-8 && hit.guardStun !== 0) target.stun = hit.guardStun ?? R.guardStun;
  } else {
    const kb = hit.knockback, k = stat(target, 'knockbackTaken', 1) * scaleK;
    if (kb && (kb.horizontal > 0 || kb.vertical > 0) && T.enableLaunch) {
      const dir = length(normal) > 1e-7 ? normalize(normal) : vec(0, 1);
      const hKb = (kb.horizontal ?? 0) * k * knockbackFactor(target), vKb = (kb.vertical ?? 0) * k;
      if (vKb > 1e-6 || target.flight) {
        launch(target, dir, hKb, vKb);
        launchInfo = {direction: dir, horizontal: hKb, vertical: vKb};
      } else if (hKb > 0) {
        target.action = null;
        target.flight = null;
        target.blend = null;
        target.guard = false;
        target.guardSuppressed = true;
        target.velocity = vec();
        target.locomotionVelocity = vec();
        target.push = {direction: dir, distance: Math.max(0.45, hKb * 1.5), elapsed: 0};
        target.knockRecovery = Math.max(target.knockRecovery, R.landingRecovery);
        target.state = 'pushed';
        launchInfo = {direction: dir, horizontal: hKb, vertical: 0};
      }
    }
    else if (hit.flinch) {target.action = null;target.knockRecovery = Math.max(target.knockRecovery, hit.flinch);}
    for (const s of hit.statuses || []) applyStatus(target, s, {source: ownerId});
    target.counterWindow = 0;
  }
  if (target.hp === 0) {target.guard = false;target.guardSuppressed = true;}
  return {...base, result: perfect ? 'perfect' : protectedFront ? 'partial' : 'impact', damage, launch: launchInfo, contact, ...(dmgResult.sturdy ? {sturdy: true} : {})};
}

// ---------- Paredes e barreiras contra lutadores (chamado pela física, a cada subpasso) ----------
/** Empurra o lutador para fora das formas sólidas (paredes; barreiras com blocksFighters). Sem formas, nada acontece. */
export function collideFighter(world, f, events = null) {
  if (!world?.entities.length) return 0;let contacts = 0;
  const r = C.test.halfExtent, alt = altOf(f), h = fighterHeight();
  for (const e of world.entities) {
    const solid = e.kind === 'wall' ? e.blocksFighters : e.kind === 'barrier' && e.blocksFighters && (e.blocksOwner || e.owner !== f.id);
    if (!solid || !vOverlap(alt, alt + h, e.y, e.y + e.height)) continue;
    const c = closestOnShape(e, f.position);if (c.distance >= r) continue;
    if (e.breakableByTackle && f.action?.kind === 'tackle' && !f.action.neutralized && !e.dead) {breakByTackle(e, f, events);continue;}
    // Normal de saída: do ponto mais próximo para o centro (dentro da forma, pelo eixo de menor penetração).
    let n = sub(f.position, c.point);if (length(n) < 1e-9 || c.inside) n = sub(f.position, e.pos);if (length(n) < 1e-9) n = vec(0, 1);n = normalize(n);
    f.position = add(c.inside ? c.point : f.position, scale(n, c.inside ? r : r - c.distance));
    const into = dot(f.velocity, n);if (into < 0) f.velocity = sub(f.velocity, scale(n, into));
    if (f.flight) {const hv = dot(f.flight.horizontal, n);if (hv < 0) f.flight.horizontal = sub(f.flight.horizontal, scale(n, (1 + C.rules.wallRestitution) * hv));}
    if (f.locomotionVelocity) {const lv = dot(f.locomotionVelocity, n);if (lv < 0) f.locomotionVelocity = sub(f.locomotionVelocity, scale(n, lv));}
    f.contacts++;contacts++;
  }
  return contacts;
}

// ---------- Passo do mundo ----------
const blocks = (b, p) => (b.kind === 'wall' && b.blocksProjectiles) || (b.kind === 'barrier' && !b.reflect && b.blocksProjectiles && (b.blocksOwner || b.owner !== p.owner));   // barreiras refletoras: ver reflectPass
/** Avança as entidades em dt; devolve os eventos (acertos, bloqueios, explosões, expirações). */
export function stepWorld(game, dt) {
  const world = game.world, events = [];
  if (!world?.entities.length) return events;
  const spawnLater = [];
  for (const e of [...world.entities]) {
    if (e.dead) continue;
    e.age += dt;
    if (e.kind === 'projectile') stepProjectile(game, e, dt, events, spawnLater);
    else if (e.kind === 'area') stepArea(game, e, dt, events);
    else if (e.kind === 'beam') stepBeam(game, e, dt, events);
    else if (e.kind === 'trap') stepTrap(game, e, dt, events);
    else if (e.kind === 'sandwave') stepSand(game, e, dt, events);
    else if (e.kind === 'burrow') stepBurrow(game, e, dt, events);
    if (!e.dead && e.age >= e.life - 1e-9) {e.dead = true;events.push({result: 'expire', attacker: e.owner ?? null, target: null, damage: 0, entity: e.id, kind: e.kind});if (e.onExpire) spawnLater.push(at(e.onExpire, e));}
  }
  clashStones(world, events);
  world.entities = world.entities.filter(e => !e.dead);
  pruneExecutions(world);
  for (const t of spawnLater) spawn(world, t, events);
  return events;
}
/** Modelo derivado de outra entidade (ex.: explosão no ponto do impacto), herdando dono e posição. */
const at = (template, src, pos = src.pos) => ({owner: src.owner, ...template, pos: {...pos}, dir: template.dir ?? src.dir});

function stepProjectile(game, p, dt, events, spawnLater) {
  if (p.homing) homingStep(game, p, dt);
  // Subpassos curtos (sem atravessar alvos finos): mesmo critério da física (contactStep).
  const travel = length(p.vel) * dt, steps = Math.max(1, Math.ceil(travel / C.test.contactStep));
  if (p.gravity) p.vy = (p.vy ?? 0) - p.gravity * dt;
  for (let s = 0; s < steps && !p.dead; s++) {
    const from = {...p.pos};p.pos = add(p.pos, scale(p.vel, dt / steps));if (p.gravity) {p.y = Math.max(0, p.y + (p.vy ?? 0) * dt / steps);if (p.y <= 0 && p.vy < 0) {p.dead = true;events.push({result: 'groundHit', attacker: p.owner ?? null, target: null, damage: 0, entity: p.id, kind: 'projectile'});if (p.onHit) spawnLater.push(at(p.onHit, p));return;}}
    if (!p.gravity && p.vy) {p.y += p.vy * dt / steps;if (p.y <= 0 && p.vy < 0) {p.dead = true;events.push({result: 'groundHit', attacker: p.owner ?? null, target: null, damage: 0, entity: p.id, kind: 'projectile'});return;}}   // voo inclinado sem gravidade (pedras com alvo travado)
    if (!reflectPass(game, p, from, events)) return;
    // Limite quadrado SÓ na arena quadrada: em arena circular o meio-lado legado
    // (C.test.arenaHalf, do protótipo de blocos) não é a borda — o raio é (checado abaixo).
    const half = C.test.arenaHalf;
    if (C.map?.arenaShape === 'square' && (Math.abs(p.pos.x) > half || Math.abs(p.pos.z) > half)) {
      p.dead = true;
      events.push({result: 'arenaHit', attacker: p.owner ?? null, target: null, damage: 0, entity: p.id, kind: 'projectile'});
      if (p.onHit) spawnLater.push(at(p.onHit, p));
      return;
    }
    const isCircle = C.map?.arenaShape !== 'square';
    if (isCircle) {
      const radius = effectiveArenaRadius();
      const d = length(p.pos);
      if (d >= radius - p.radius) {
        // R11.7: Projétil que atinge borda circular ricocheteia conforme propriedades físicas e normal de contato
        const n = normalize(p.pos);
        const vDotN = dot(p.vel, n);
        if (vDotN > 0) {
          p.bounces = (p.bounces ?? 0) + 1;
          const maxBounces = p.maxBounces ?? 2;
          if (p.bounces <= maxBounces) {
            p.vel = sub(p.vel, scale(n, 2 * vDotN));
            p.dir = normalize(p.vel);
            events.push({result: 'arenaBounce', attacker: p.owner ?? null, target: null, damage: 0, entity: p.id, kind: 'projectile'});
          } else {
            p.dead = true;
            events.push({result: 'arenaHit', attacker: p.owner ?? null, target: null, damage: 0, entity: p.id, kind: 'projectile'});
            if (p.onHit) spawnLater.push(at(p.onHit, p));
            return;
          }
        }
      }
    }

    // Mapa: destrutíveis, obstáculos e plataformas (R1.5, R1.8, R3.4, R8.8).
    // Caixas do mapa são alinhadas aos eixos (desenho e colisão dos lutadores); `angle` é só dado legado e NÃO gira a caixa aqui:
    // antes projéteis/áreas colidiam com uma caixa girada invisível.
    if (game.mapState) {
      for (const d of game.mapState.destructibles) {
        if (d.state !== 'solid') continue;
        const box = {shape: 'box', pos: {x: d.pos.x, z: d.pos.z}, hx: d.size.hx, hz: d.size.hz, angle: 0};
        if (!vOverlap(p.y - p.radius, p.y + p.radius, d.pos.y, d.pos.y + d.size.height) || !circleTouches(box, p.pos, p.radius)) continue;
        damageDestructible(d, p.hit?.damage ?? 10, 'projectile', p.owner != null ? game.fighters[p.owner] : null, game.mapState, events);
        events.push({result: 'destructibleHit', attacker: p.owner ?? null, target: d.id, damage: p.hit?.damage ?? 10, entity: p.id, kind: 'projectile'});
        p.dead = true;
        if (p.onHit) spawnLater.push(at(p.onHit, p));
        return;
      }
      for (const o of game.mapState.obstacles) {
        const obsShape = o.shape === 'cylinder'
          ? {shape: 'circle', pos: {x: o.pos.x, z: o.pos.z}, radius: o.radius}
          : {shape: 'box', pos: {x: o.pos.x, z: o.pos.z}, hx: o.hx, hz: o.hz, angle: 0};
        if (!vOverlap(p.y - p.radius, p.y + p.radius, o.pos.y, o.pos.y + o.height) || !circleTouches(obsShape, p.pos, p.radius)) continue;
        events.push({result: 'obstacleHit', attacker: p.owner ?? null, target: o.id, damage: 0, entity: p.id, kind: 'projectile'});
        p.dead = true;
        if (p.onHit) spawnLater.push(at(p.onHit, p));
        return;
      }
      for (const plat of game.mapState.platforms) {
        const pBox = {shape: 'box', pos: {x: plat.pos?.x ?? plat.x, z: plat.pos?.z ?? plat.z}, hx: (plat.width ?? 3) / 2, hz: (plat.depth ?? 3) / 2, angle: 0};
        if (!vOverlap(p.y - p.radius, p.y + p.radius, 0, plat.height) || !circleTouches(pBox, p.pos, p.radius)) continue;
        events.push({result: 'platformHit', attacker: p.owner ?? null, target: plat.id, damage: 0, entity: p.id, kind: 'projectile'});
        p.dead = true;
        if (p.onHit) spawnLater.push(at(p.onHit, p));
        return;
      }
    }
    // Barreiras e paredes primeiro: o que está na frente bloqueia.
    for (const b of game.world.entities) {
      if (b === p || b.dead || !p.blockedBy.includes(b.kind) || !blocks(b, p) || !vOverlap(p.y - p.radius, p.y + p.radius, b.y, b.y + b.height) || !circleTouches(b, p.pos, p.radius)) continue;
      p.dead = true;
      if (b.kind === 'barrier' && Number.isFinite(b.hp)) {b.hp -= p.hit?.damage ?? 0;if (b.hp <= 0) {b.dead = true;events.push({result: 'barrierBroken', attacker: p.owner ?? null, target: b.owner ?? null, damage: 0, entity: b.id, kind: 'barrier'});}}
      events.push({result: 'blocked', attacker: p.owner ?? null, target: b.owner ?? null, damage: 0, entity: p.id, by: b.id, kind: b.kind});
      if (p.onHit) spawnLater.push(at(p.onHit, p));return;
    }
    for (const f of game.fighters) {
      if (f.hp <= 0 || f.absent || (f.id === p.owner && !p.hitsOwner) || p.hitLog.includes(f.id)) continue;
      const alt = altOf(f), box = {shape: 'box', pos: f.position, hx: C.test.halfExtent, hz: C.test.halfExtent, angle: 0};
      if (!vOverlap(p.y - p.radius, p.y + p.radius, alt, alt + fighterHeight()) || !circleTouches(box, p.pos, p.radius)) continue;
      if (p.clashable && f.action?.kind === 'tackle' && !f.action.neutralized && !isInvulnerable(f) && tackleDispute(p, f, events)) return;   // disputa de PL contra o Tackle em curso
      p.hitLog.push(f.id);
      const hit = p.exec != null ? execHit(game.world, p, f) : (p.hit || {});
      const ev = applyHit(game, p.owner, f, hit, normalize(p.vel), {entity: p.id, origin: sub(f.position, scale(normalize(p.vel), 1)), pl: p.pl, contact: 'projectile'});
      if (p.exec != null) execRecord(game.world, p, f, ev, hit);
      if (ev) events.push(ev);
      if (ev && p.counterWon && p.defeated?.includes(f.id) && (ev.result === 'impact' || ev.result === 'partial')) applyCounterStagger(f, p.captured?.counterStagger ?? 0, events, p.owner ?? null);
      if (p.hitLog.length >= p.pierce || ev?.result === 'partial' || ev?.result === 'perfect') {p.dead = true;if (p.onHit) spawnLater.push(at(p.onHit, p));return;}
    }
  }
}
/**
 * Feixe contínuo: recalcula os segmentos (reflexões, troca de dono, barreira que some) e aplica o dano a cada `interval` por alvo, pelo
 * mesmo `applyHit` dos demais acertos. O dano do trecho usa `captured.attackFraction × Ataque do dono do trecho` quando existir (M17.6); senão `hit.damage × Ataque`.
 */
function stepBeam(game, e, dt, events) {
  if (e.turn) {const d = angleOf(e.dir) + e.turn * dt;e.dir = direction(d);}
  const {segments, hits} = traceBeam(game, e, events);e.segments = segments;
  for (const h of hits) {
    if ((e.nextHit[h.target] ?? 0) > e.age + 1e-9) continue;
    e.nextHit[h.target] = e.age + e.interval;
    const f = game.fighters[h.target], seg = segments[h.seg], dir = normalize(sub(seg.b, seg.a)), o = h.owner != null ? game.fighters[h.owner] : null;
    const hit = e.captured?.attackFraction != null && o ? {...e.hit, damage: e.captured.attackFraction * o.attributes.attack} : e.hit;
    const ev = applyHit(game, h.owner, f, hit, dir, {entity: e.id, source: 'laser', origin: seg.a, pl: seg.pl, contact: 'beam'});
    if (ev) events.push({...ev, seg: h.seg, kind: 'beam'});
  }
}
function stepArea(game, a, dt, events) {
  if (a.follow && a.owner != null) a.pos = {...game.fighters[a.owner].position};
  if (a.grow > 0) a.radius = a.baseRadius * Math.min(1, a.age / a.grow) + (a.startRadius ?? 0) * Math.max(0, 1 - a.age / a.grow);
  // Pulsos: o primeiro no instante da criação; os seguintes a cada `interval` (0 = um só). Cada alvo é atingido no máximo uma vez por pulso.
  const due = a.interval > 0 ? Math.min(a.pulses, 1 + Math.floor((a.age - dt + 1e-9) / a.interval)) : Math.min(a.pulses, 1);
  while (a.pulsesDone < due) {
    a.pulsesDone++;
    const shields = a.explosion ? game.world.entities.filter(e => e.shields && !e.dead) : [];
    if (a.hit) for (const f of game.fighters) {
      if (f.hp <= 0 || f.absent || (f.id === a.owner && !a.affectsOwner)) continue;
      const alt = altOf(f);if (!vOverlap(alt, alt + fighterHeight(), a.y, a.y + a.height)) continue;
      const box = {shape: 'box', pos: f.position, hx: C.test.halfExtent, hz: C.test.halfExtent, angle: 0};
      const c = closestOnShape(box, a.pos), dist = Math.max(0, c.inside ? 0 : c.distance);if (dist > a.radius) continue;
      const shield = shields.length ? shieldedFromBlast(a, f, shields) : null;
      if (shield) {events.push({result: 'shielded', attacker: a.owner ?? null, target: f.id, damage: 0, entity: a.id, by: shield.id, pulse: a.pulsesDone});continue;}
      // Efeito radial: empurra do centro para fora; a intensidade cai com a distância conforme `falloff`.
      const k = a.falloff === 'linear' ? Math.max(0, 1 - dist / Math.max(1e-6, a.radius)) : 1, away = sub(f.position, a.pos);
      const ev = applyHit(game, a.owner, f, a.hit, length(away) > 1e-6 ? normalize(away) : direction(f.facing + Math.PI), {entity: a.id, scale: k, origin: a.pos, contact: 'area'});
      if (ev) events.push({...ev, pulse: a.pulsesDone});
    }
    if (a.hit && game.mapState?.destructibles) {
      for (const d of game.mapState.destructibles) {
        if (d.state !== 'solid') continue;
        if (!vOverlap(d.pos.y, d.pos.y + d.size.height, a.y, a.y + a.height)) continue;
        const box = {shape: 'box', pos: {x: d.pos.x, z: d.pos.z}, hx: d.size.hx, hz: d.size.hz, angle: 0};
        const c = closestOnShape(box, a.pos), dist = Math.max(0, c.inside ? 0 : c.distance);
        if (dist > a.radius) continue;
        const k = a.falloff === 'linear' ? Math.max(0, 1 - dist / Math.max(1e-6, a.radius)) : 1;
        const dmg = (a.hit?.damage ?? 10) * k;
        damageDestructible(d, dmg, 'area', a.owner != null ? game.fighters[a.owner] : null, game.mapState, events);
      }
    }
    if (a.explosion) breakBarriers(game, a, events);
  }
}

// ---------- Power Level: disputas e Counter Stagger ----------
/** PL base do Tackle (M21.1); o Tackle carregado ou o do sprint sobe a `action.pl` (2 ou 3). */
export const TACKLE_PL = 1;
export const tacklePL = f => f?.action?.pl ?? TACKLE_PL;
/**
 * Counter Stagger (M20.8, M21.4–M21.7): o derrotado fica em stagger de \`seconds\` quando o ataque vencedor atinge o seu CORPO. Não acumula nem
 * reinicia o stagger ativo; interrompe o Charge pela regra comum (recuperação > 0). Devolve true se aplicou.
 */
export function applyCounterStagger(f, seconds, events, by = null) {
  if ((f.counterStagger ?? 0) > 1e-9 || !(seconds > 0)) return false;
  f.counterStagger = seconds;f.knockRecovery = Math.max(f.knockRecovery, seconds);
  events?.push({result: 'counterStagger', attacker: by, target: f.id, damage: 0, seconds});
  return true;
}
/**
 * Disputa entre uma pedra (PL próprio) e um Tackle em curso (PL1), antes de o corpo ser atingido (M20.2, M21.3). PL igual → Clash: a pedra
 * se despedaça e o Tackle segue. PL superior → Counter: a pedra vence e segue; o Tackle fica neutralizado (não machuca mais ninguém nesta
 * ação) e, ao atingir o corpo do derrotado, o Counter Stagger se aplica. Devolve true se a pedra foi destruída.
 */
function tackleDispute(p, f, events) {
  const pl = p.pl ?? 1, tpl = tacklePL(f);
  if (pl <= tpl) {
    p.dead = true;
    events.push({result: 'tackleClash', attacker: f.id, target: p.owner ?? null, damage: 0, entity: p.id, pl, other: tpl, kind: 'projectile'});
    return true;
  }
  f.action.neutralized = true;p.counterWon = true;(p.defeated ??= []).push(f.id);
  events.push({result: 'counter', attacker: p.owner ?? null, target: f.id, damage: 0, entity: p.id, pl, other: tpl, kind: 'projectile'});
  return false;
}

// ---------- Pedras do Psyshock: homing, acertos por alvo e colisão entre pedras ----------
/** Homing limitado (M10.2, M12.1): nos primeiros 0,3 s a direção horizontal gira no máximo \`rate\` rad/s rumo ao ponto de mira sorteado. Perder o alvo para sempre encerra o homing preservando a direção (M27.5). */
function homingStep(game, p, dt) {
  const h = p.homing, t = game.fighters[h.target];
  if (!t || t.hp <= 0 || h.ticks <= 0) {p.homing = null;return;}
  h.ticks--;
  const dx = t.position.x + h.offset.x - p.pos.x, dz = t.position.z + h.offset.z - p.pos.z, speed = length(p.vel);
  if (speed < 1e-9) return;
  const cur = angleOf(p.vel), turn = clamp(angleDelta(cur, angleOf({x: dx, z: dz})), -h.rate * dt, h.rate * dt), next = cur + turn;
  p.vel = {x: Math.sin(next) * speed, z: Math.cos(next) * speed};p.dir = normalize(p.vel);
  const left = Math.max(dt, Math.hypot(dx, dz) / speed);                       // tempo restante até o ponto de mira: ajusta a subida/descida para chegar à altura sorteada
  p.vy = (altOf(t) + h.offset.y - p.y) / left;
}
/** Dados de acerto desta pedra no alvo: dano × fator^n (n acertos anteriores da MESMA execução no mesmo alvo, M6.3) e knockback limitado ao teto por alvo e execução (M30.3). */
function execHit(world, p, f) {
  const x = world.exec?.[p.exec], base = p.hit || {}, n = x?.hits?.[f.id] ?? 0, used = x?.kb?.[f.id] ?? 0, c = p.captured ?? {};
  const out = {...base, damage: (base.damage ?? 0) * (c.successiveFactor ?? 1) ** n};
  if (base.knockback) {
    const room = (c.knockbackCap ?? Infinity) - used, h = room > 1e-9 ? Math.min(base.knockback.horizontal ?? 0, room) : 0;   // tolerância: 0,3 + 0,3 + 0,3 não é exatamente 0,9 em ponto flutuante
    out.knockback = h > 0 ? {...base.knockback, horizontal: h} : undefined;
  }
  return out;
}
/** Registra o acerto que causou dano (impacto ou defesa comum): conta para o fator 0,8ⁿ; só o impacto com lançamento consome o teto de knockback. */
function execRecord(world, p, f, ev, hit) {
  const x = world.exec?.[p.exec];
  if (!x || !ev || (ev.result !== 'impact' && ev.result !== 'partial')) return;
  x.hits[f.id] = (x.hits[f.id] ?? 0) + 1;
  if (ev.result === 'impact' && hit.knockback) x.kb[f.id] = (x.kb[f.id] ?? 0) + hit.knockback.horizontal;
}
/** Pedras de donos diferentes que se tocam (pedras do MESMO Psyshock nunca colidem entre si, mesmo depois de refletidas, M8.1): PL igual → as duas se destroem; PL superior vence e continua (M8.2, M19.4, M20.1). Só as envolvidas somem. */
function clashStones(world, events) {
  const s = world.entities.filter(e => e.kind === 'projectile' && e.clashable && !e.dead);
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
    const a = s[i], b = s[j];
    if (a.dead || b.dead || a.owner === b.owner || (a.exec != null && a.exec === b.exec) || Math.abs(a.y - b.y) > a.radius + b.radius || length(sub(a.pos, b.pos)) > a.radius + b.radius) continue;
    const pa = a.pl ?? 1, pb = b.pl ?? 1;
    if (pa >= pb) b.dead = true;
    if (pb >= pa) a.dead = true;
    // Counter: a pedra vencedora continua e, se depois atingir o CORPO do dono da derrotada, aplica o Counter Stagger (M20.8, M21.4); disputa distante não machuca ninguém.
    if (pa > pb) {a.counterWon = true;(a.defeated ??= []).push(b.owner);} else if (pb > pa) {b.counterWon = true;(b.defeated ??= []).push(a.owner);}
    events.push({result: pa === pb ? 'stoneClash' : 'counter', attacker: a.owner ?? null, target: b.owner ?? null, damage: 0, entity: a.id, other: b.id, pl: pa, otherPl: pb, winner: pa === pb ? null : pa > pb ? a.id : b.id});
  }
}
/** Descarta as execuções sem nenhuma pedra viva. */
function pruneExecutions(world) {
  if (!world.exec) return;
  const live = new Set(world.entities.filter(e => e.exec != null).map(e => String(e.exec)));
  for (const k of Object.keys(world.exec)) if (!live.has(k)) delete world.exec[k];
}

// ---------- Barreiras refletoras (Reflect) ----------
/**
 * Reflexão especular de projéteis em barreiras com \`reflect\` (Reflect). Varre o segmento do subpasso e resolve os contatos em
 * ORDEM FÍSICA (M30.6; empate: ordem de criação). Superfície: primeira atingida (M7.7); frente e bordas refletem — a borda pela
 * própria normal, mesmo vindo de trás (M13.3, M30.5) —; entrar pelo verso atravessa e ignora essa barreira até sair do volume
 * dela. PL superior destrói a barreira e é neutralizado; PL igual ou inferior é refletido (M18.8, M19.2, M19.3). Quem reflete
 * passa a ser o dono (M2.7), o homing é cancelado (M12.6), o dano é recalculado com o Ataque do refletor (M17.3, M30.1) e o PL é
 * conservado (M19.7). Salvaguarda contra ciclo degenerado (M17.2): acima de \`maxReflections\` por passo a reflexão é suspensa
 * naquele passo e o projétil segue. Devolve false se o projétil foi neutralizado.
 */
function reflectPass(game, p, from, events) {
  const bars = game.world.entities.filter(b => b.reflect && !b.dead);
  if (!bars.length) return true;
  if (p.through?.length) p.through = p.through.filter(id => bars.some(b => b.id === id && circleTouches(b, p.pos, p.radius)));
  let a = from;
  for (let guard = 0; guard < 512; guard++) {
    const end = p.pos;let best = /** @type {any} */ (null);
    for (const bar of bars) {
      if (bar.dead || p.through?.includes(bar.id) || !vOverlap(p.y - p.radius, p.y + p.radius, bar.y, bar.y + bar.height)) continue;
      const h = sweepBox(bar, a, end, p.radius, bar.captured?.tieTolerance ?? .001);
      if (!h) continue;
      if ('inside' in h) {(p.through ??= []).push(bar.id);continue;}     // já dentro do volume: imune a essa barreira até sair
      if (!best || h.t < best.t - 1e-12) best = {...h, bar};
    }
    if (!best) return true;
    const bar = best.bar;
    if (best.face === 'back') {(p.through ??= []).push(bar.id);continue;}
    if ((p.pl ?? 1) > (bar.pl ?? 1)) {
      bar.dead = true;p.dead = true;
      events.push({result: 'barrierBroken', attacker: p.owner ?? null, target: bar.owner ?? null, damage: 0, entity: bar.id, kind: 'barrier', by: 'pl'});
      events.push({result: 'neutralized', attacker: p.owner ?? null, target: bar.owner ?? null, damage: 0, entity: p.id, by: bar.id, kind: 'projectile'});
      return false;
    }
    if (p.reflectTick !== game.tick) {p.reflectTick = game.tick;p.reflectCount = 0;}
    if (++p.reflectCount > (bar.captured?.maxReflections ?? 16)) {
      if (p.reflectCount === (bar.captured?.maxReflections ?? 16) + 1) events.push({result: 'reflectCycle', attacker: p.owner ?? null, target: null, damage: 0, entity: p.id, kind: 'projectile'});
      return true;
    }
    const n = best.normal, nv = sub(p.vel, scale(n, 2 * dot(p.vel, n))), rest = (1 - best.t) * best.len, previous = p.owner;
    const dir = normalize(nv);
    a = add(best.point, scale(n, 1e-7));
    p.vel = nv;p.dir = dir;p.pos = add(a, scale(dir, rest));
    p.origin ??= previous;p.owner = bar.owner;p.hitLog = [];p.homing = null;
    if (p.captured?.attackFraction != null) {const o = game.fighters[bar.owner];if (o) p.hit = {...p.hit, damage: p.captured.attackFraction * o.attributes.attack};}
    events.push({result: 'reflected', attacker: bar.owner ?? null, target: previous ?? null, damage: 0, entity: p.id, by: bar.id, face: best.face, kind: 'projectile', pl: p.pl ?? 1, barrierPl: bar.pl ?? 1});
  }
  return true;
}
/** O lutador está protegido desta explosão? O segmento 3D do centro da explosão ao centro do corpo cruza o volume de alguma barreira protetora (M30.7). */
function shieldedFromBlast(a, f, shields) {
  const p0 = {x: a.pos.x, z: a.pos.z, y: a.y + a.height / 2}, p1 = {x: f.position.x, z: f.position.z, y: altOf(f) + fighterHeight() / 2};
  const hit = shields.find(b => segmentHitsVolume(b, b.y, b.height, p0, p1));
  return hit ?? null;
}
/** Explosão destrói as barreiras vulneráveis que seu volume alcança (M14.5, M14.7); a proteção já foi avaliada antes (M30.6, item 4). */
function breakBarriers(game, a, events) {
  for (const b of game.world.entities) {
    if (b.dead || !b.breakableByBlast || !vOverlap(a.y, a.y + a.height, b.y, b.y + b.height) || closestOnShape(b, a.pos).distance > a.radius) continue;
    b.dead = true;events.push({result: 'barrierBroken', attacker: a.owner ?? null, target: b.owner ?? null, damage: 0, entity: b.id, kind: 'barrier', by: 'explosion'});
  }
}
/** Tackle contra barreira vulnerável: destrói (qualquer PL, frente, verso ou borda, inclusive a própria) e o atacante recua e fica em stagger (M14.3, M14.4, M19.9). */
function breakByTackle(e, f, events) {
  e.dead = true;
  const cap = e.captured ?? {}, away = scale(direction(f.action.heading), -1);
  f.action = null;f.velocity = vec();f.locomotionVelocity = vec();f.blend = null;f.vaultHeight = 0;f.state = 'landing';   // sem ação, o estado não pode seguir como 'tackle'
  f.push = {direction: away, distance: nominalDistance(f, 'tackle') * (cap.tackleRecoil ?? .15), elapsed: 0};
  f.knockRecovery = Math.max(f.knockRecovery, cap.tackleStagger ?? .25);
  events?.push({result: 'barrierBroken', attacker: f.id, target: e.owner ?? null, damage: 0, entity: e.id, kind: 'barrier', by: 'tackle'});
}

