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
import {isInvulnerable, nominalDistance} from './entity.js';
import {sweepBox, segmentHitsVolume} from './geometry.js';
import {solidContact} from './solid-contact.js';
import {noteContact, noteSweep, horizontalOf} from './collision-probe.js';
import {firstContact} from './ccd.js';
import {traceBeam} from './beam.js';
import {stepTrap} from './trap.js';
import {stepSand} from './sand.js';
import {stepBurrow} from './stone.js';
import {getGroundHeight} from './physics.js';
import {solidsOf, segmentClear} from './vision.js';
import {damageDestructible, effectiveArenaRadius} from './map.js';
import {vec, add, sub, scale, dot, length, normalize, direction, angleOf, angleDelta, clamp} from './math.js';
import {DEFAULTS, validateEntity} from './world/world-schema.js';
import {applyHit, closestOnShape} from './world/world-hit.js';

// Fachada: o conteúdo foi dividido em módulos menores (pasta world/); os nomes exportados continuam os mesmos.
export * from './world/world-schema.js';
export * from './world/world-hit.js';

export const createWorld = () => ({entities: [], nextId: 1});const fighterHeight = () => C.extras.visual.bodyHeight;const altOf = f => (f.flight?.y ?? f.groundY ?? 0) + (f.vaultHeight ?? 0);/** Círculo (centro p, raio r) toca a forma? */
const circleTouches = (e, p, r) => closestOnShape(e, p).distance <= r;/** Sobreposição vertical entre [a0, a1] e [b0, b1]. */
const vOverlap = (a0, a1, b0, b1) => a0 <= b1 && b0 <= a1;/**
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
}// ---------- Paredes e barreiras contra lutadores (chamado pela física, a cada subpasso) ----------
/** Empurra o lutador para fora das formas sólidas (paredes; barreiras com blocksFighters). Sem formas, nada acontece. */
export function collideFighter(world, f, events = null) {
  if (!world?.entities.length) return 0;let contacts = 0;
  const r = C.test.halfExtent, alt = altOf(f), h = fighterHeight();
  for (const e of world.entities) {
    if (e.dead) continue;   // destruído neste mesmo passo (ex.: quebrado por tackle num subpasso anterior): não é mais sólido
    const solid = e.kind === 'wall' ? e.blocksFighters : e.kind === 'barrier' && e.blocksFighters && (e.blocksOwner || e.owner !== f.id);
    if (!solid || !vOverlap(alt, alt + h, e.y, e.y + e.height)) continue;
    const contact = solidContact(e, f.position, r);if (!contact) continue;
    if (e.breakableByTackle && f.action?.kind === 'tackle' && !f.action.neutralized) {breakByTackle(e, f, events);continue;}
    // Saída pela menor translação real (solid-contact.js): vale também com o centro já DENTRO da forma.
    const n = contact.normal, v0 = horizontalOf(f);   // (dentro do contato: uma alocação só quando há toque)
    f.position = add(f.position, scale(n, contact.depth));
    const into = dot(f.velocity, n);if (into < 0) f.velocity = sub(f.velocity, scale(n, into));
    if (f.flight) {const hv = dot(f.flight.horizontal, n);if (hv < 0) f.flight.horizontal = sub(f.flight.horizontal, scale(n, (1 + C.rules.wallRestitution) * hv));}
    if (f.locomotionVelocity) {const lv = dot(f.locomotionVelocity, n);if (lv < 0) f.locomotionVelocity = sub(f.locomotionVelocity, scale(n, lv));}
    f.contacts++;contacts++;noteContact(f, e.kind, e.id, n, contact.depth, v0.x, v0.z);
  }
  return contacts;
}// ---------- Passo do mundo ----------
const blocks = (b, p) => (b.kind === 'wall' && b.blocksProjectiles) || (b.kind === 'barrier' && !b.reflect && b.blocksProjectiles && (b.blocksOwner || b.owner !== p.owner));   // barreiras refletoras: ver reflectPass/** Avança as entidades em dt; devolve os eventos (acertos, bloqueios, explosões, expirações). */
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
}/** Modelo derivado de outra entidade (ex.: explosão no ponto do impacto), herdando dono e posição. */
const at = (template, src, pos = src.pos) => {
  const t = {owner: src.owner, ...template, pos: {...pos}, dir: template.dir ?? src.dir};
  if (template.sphere) {t.y = (src.y ?? 0) - template.radius;t.height = 2 * template.radius;}   // esfera centrada no ponto do impacto (Seed Bomb)
  else if (template.inheritY) t.y = Math.max(0, (src.y ?? 0) - (template.height ?? 2) / 2);   // volume centrado na altitude do impacto
  return t;
};/**
 * CCD (Fase 3). Primeiro bloqueador no caminho from → to (menor tempo de impacto) entre barreiras/paredes do mundo e objetos do mapa, com
 * o mesmo critério de elegibilidade dos laços de sobreposição de stepProjectile. Só vale se o toque for confirmado pelo teste exato
 * (`circleTouches`). Devolve {t, point} ou null.
 */
function blockerContact(game, p, from, to) {
  if (from.x === to.x && from.z === to.z) return null;
  const yLo = p.y - p.radius, yHi = p.y + p.radius, solids = [];
  for (const b of game.world.entities) {
    if (b === p || b.dead || !p.blockedBy.includes(b.kind) || !blocks(b, p) || !vOverlap(yLo, yHi, b.y, b.y + b.height)) continue;
    solids.push(b);
  }
  const ms = game.mapState;
  if (ms) {
    for (const d of ms.destructibles) if (d.state === 'solid' && vOverlap(yLo, yHi, d.pos.y, d.pos.y + d.size.height)) solids.push({shape: 'box', pos: {x: d.pos.x, z: d.pos.z}, hx: d.size.hx, hz: d.size.hz, angle: 0, kind: 'destructible', id: d.id});
    for (const o of ms.obstacles) if (vOverlap(yLo, yHi, o.pos.y, o.pos.y + o.height)) solids.push(o.shape === 'cylinder' || o.shape === 'pillar' ? {shape: 'circle', pos: {x: o.pos.x, z: o.pos.z}, radius: o.radius, kind: 'obstacle', id: o.id} : {shape: 'box', pos: {x: o.pos.x, z: o.pos.z}, hx: o.hx, hz: o.hz, angle: 0, kind: 'obstacle', id: o.id});
    for (const pl of ms.platforms) if (vOverlap(yLo, yHi, 0, pl.height)) solids.push({shape: 'box', pos: {x: pl.pos?.x ?? pl.x, z: pl.pos?.z ?? pl.z}, hx: (pl.width ?? 3) / 2, hz: (pl.depth ?? 3) / 2, angle: 0, kind: 'platform', id: pl.id});
  }
  const hit = firstContact(solids, from, to, p.radius);
  if (!hit || hit.t >= 1) return null;
  const len = Math.hypot(to.x - from.x, to.z - from.z), t = Math.min(1, hit.t + 1e-6 / Math.max(len, 1e-9));
  const point = {x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t};
  return circleTouches(hit.solid, point, p.radius) ? {t: hit.t, point, solid: hit.solid} : null;
}/** Menor tempo de impacto de um evento de refletor (reflexão ou neutralização por PL; a face de trás é atravessada, não conta) no caminho from → to; Infinity se não há. */
function reflectorImpactTime(game, p, from, to) {
  let best = Infinity;
  for (const bar of game.world.entities) {
    if (!bar.reflect || bar.dead || p.through?.includes(bar.id) || !vOverlap(p.y - p.radius, p.y + p.radius, bar.y, bar.y + bar.height)) continue;
    const h = sweepBox(bar, from, to, p.radius, bar.captured?.tieTolerance ?? .001);
    if (h && !('inside' in h) && h.face !== 'back' && h.t < best) best = h.t;
  }
  return best;
}/** Início da última perna do subpasso: o ponto de partida, ou o ponto da última reflexão (a corda from→pos de um subpasso refletido não é o caminho percorrido). */
let legStart = null;/** Reposiciona o projétil no primeiro contato da última perna para a checagem de sobreposição seguinte ver justamente esse bloqueador. */
function snapToFirstContact(game, p, from) {
  const c = blockerContact(game, p, legStart ?? from, p.pos);
  if (c) p.pos = c.point;
}function stepProjectile(game, p, dt, events, spawnLater) {
  if (p.homing) homingStep(game, p, dt);
  // Subpassos curtos (sem atravessar alvos finos): mesmo critério da física (contactStep).
  const travel = length(p.vel) * dt, steps = Math.max(1, Math.ceil(travel / C.test.contactStep));
  if (p.gravity) p.vy = (p.vy ?? 0) - p.gravity * dt;
  for (let s = 0; s < steps && !p.dead; s++) {
    const from = {...p.pos};p.pos = add(p.pos, scale(p.vel, dt / steps));if (p.gravity) {p.y = Math.max(0, p.y + (p.vy ?? 0) * dt / steps);if (p.y <= 0 && p.vy < 0) {p.dead = true;events.push({result: 'groundHit', attacker: p.owner ?? null, target: null, damage: 0, entity: p.id, kind: 'projectile'});if (p.onHit) spawnLater.push(at({...p.onHit, groundHit: true}, p));return;}}
    if (!p.gravity && p.vy) {p.y += p.vy * dt / steps;if (p.y <= 0 && p.vy < 0) {p.dead = true;events.push({result: 'groundHit', attacker: p.owner ?? null, target: null, damage: 0, entity: p.id, kind: 'projectile'});return;}}   // voo inclinado sem gravidade (pedras com alvo travado)
    legStart = null;
    // Bloqueador ANTES do refletor no caminho (por tempo de impacto): o projétil para nele e nunca chega a refletir. Empate: o refletor vale primeiro.
    const early = blockerContact(game, p, from, p.pos), reach = {...p.pos};
    const stopsEarly = early && early.t < reflectorImpactTime(game, p, from, p.pos);
    noteSweep(p.id, from, reach, stopsEarly ? early : null);   // sonda de colisão: trecho do subpasso e primeiro contato
    if (stopsEarly) p.pos = early.point;
    if (!reflectPass(game, p, from, events)) return;
    snapToFirstContact(game, p, from);
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
        const obsShape = o.shape === 'cylinder' || o.shape === 'pillar'
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
        const onTop = (p.vy ?? 0) < 0 && p.y - p.radius >= plat.height - .35;   // caiu em cima da plataforma = pouso no chão (Seed Bomb mostra também o efeito provisório)
        if (p.onHit) spawnLater.push(at(onTop ? {...p.onHit, groundHit: true} : p.onHit, p));
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
      if (p.detonateOnly) {p.dead = true;events.push({result: 'detonate', attacker: p.owner ?? null, target: f.id, damage: 0, entity: p.id, kind: 'projectile'});if (p.onHit) spawnLater.push(at(p.onHit, p));return;}   // projétil explosivo (M22.7): o contato só detona; quem causa dano é a explosão, uma vez
      p.hitLog.push(f.id);
      const hit = p.exec != null ? execHit(game.world, p, f) : (p.hit || {});
      const ev = applyHit(game, p.owner, f, hit, normalize(p.vel), {entity: p.id, origin: sub(f.position, scale(normalize(p.vel), 1)), pl: p.pl, contact: 'projectile', move: p.captured?.move});
      if (p.exec != null) execRecord(game.world, p, f, ev, hit);
      if (ev) events.push(ev);
      if (ev && p.counterWon && p.defeated?.includes(f.id) && (ev.result === 'impact' || ev.result === 'partial')) applyCounterStagger(f, p.captured?.counterStagger ?? 0, events, p.owner ?? null);
      if (p.hitLog.length >= p.pierce || ev?.result === 'partial' || ev?.result === 'perfect') {p.dead = true;if (p.onHit) spawnLater.push(at(p.onHit, p));return;}
    }
  }
}/**
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
    const ev = applyHit(game, h.owner, f, hit, dir, {entity: e.id, source: 'laser', origin: seg.a, pl: seg.pl, contact: 'beam', move: 'laser'});
    if (ev) events.push({...ev, seg: h.seg, kind: 'beam'});
  }
}function stepArea(game, a, dt, events) {
  if (a.follow && a.owner != null) a.pos = {...game.fighters[a.owner].position};
  if (a.support && getGroundHeight(a.pos, game.world, a.y + .3) < a.y - .06) {   // Field sobre apoio: perdeu a superfície (plataforma destruída) → some sem efeito, sem flutuar
    a.dead = true;events.push({result: 'fieldLost', attacker: a.owner ?? null, target: null, damage: 0, entity: a.id, kind: 'area'});return;
  }
  if (a.grow > 0) a.radius = a.baseRadius * Math.min(1, a.age / a.grow) + (a.startRadius ?? 0) * Math.max(0, 1 - a.age / a.grow);
  // Pulsos: o primeiro no 1º passo depois do start-up (startup + dt); os seguintes a cada `interval` (0 = um só). Cada alvo é atingido no máximo uma vez por pulso.
  const startup = a.startup ?? 0;
  const due = a.age < startup + dt - 1e-9 ? 0 : Math.min(a.pulses ?? Infinity, a.interval > 0 ? 1 + Math.floor((a.age - startup - dt + 1e-9) / a.interval) : 1);   // o 1º pulso cai no 1º passo depois do start-up; os outros, a cada `interval`
  while (a.pulsesDone < due) {
    a.pulsesDone++;
    const shields = a.explosion ? game.world.entities.filter(e => e.shields && !e.dead) : [];
    const blockers = a.occlusion ? solidsOf(game.world) : null;   // oclusão por paredes/obstáculos no plano XZ (Fire Spin e Seed Bomb): o dano não atravessa sólidos
    if (a.hit) for (const f of game.fighters) {
      if (f.hp <= 0 || f.absent || (f.id === a.owner && !a.affectsOwner)) continue;
      const alt = altOf(f);if (!vOverlap(alt, alt + fighterHeight(), a.y, a.y + a.height)) continue;
      const box = {shape: 'box', pos: f.position, hx: C.test.halfExtent, hz: C.test.halfExtent, angle: 0};
      let dist;
      if (a.sphere) {   // esfera 3D: distância do centro ao paralelepípedo do corpo (explosão com volume esférico de verdade)
        const cy = a.y + a.radius, dx = Math.max(Math.abs(a.pos.x - f.position.x) - C.test.halfExtent, 0), dz = Math.max(Math.abs(a.pos.z - f.position.z) - C.test.halfExtent, 0), dy = Math.max(alt - cy, 0, cy - (alt + fighterHeight()));
        dist = Math.hypot(dx, dy, dz);
      } else {const c = closestOnShape(box, a.pos);dist = Math.max(0, c.inside ? 0 : c.distance);}
      if (dist > a.radius) continue;
      if (blockers && !segmentClear(blockers, a.pos, f.position)) {events.push({result: 'occluded', attacker: a.owner ?? null, target: f.id, damage: 0, entity: a.id, pulse: a.pulsesDone});continue;}
      const shield = shields.length ? shieldedFromBlast(a, f, shields) : null;
      if (shield) {events.push({result: 'shielded', attacker: a.owner ?? null, target: f.id, damage: 0, entity: a.id, by: shield.id, pulse: a.pulsesDone});continue;}
      // Efeito radial: empurra do centro para fora; a intensidade cai com a distância conforme `falloff`.
      const k = a.falloff === 'linear' ? Math.max(0, 1 - dist / Math.max(1e-6, a.radius)) : 1, away = sub(f.position, a.pos);
      const ev = applyHit(game, a.owner, f, a.hit, length(away) > 1e-6 ? normalize(away) : direction(f.facing + Math.PI), {entity: a.id, scale: k, origin: a.pos, contact: 'area', move: a.captured?.move});
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
}// ---------- Power Level: disputas e Counter Stagger ----------
/** PL base do Tackle (M21.1); o Tackle carregado ou o do sprint sobe a `action.pl` (2 ou 3). */
export const TACKLE_PL = 1;export const tacklePL = f => f?.action?.pl ?? TACKLE_PL;/**
 * Counter Stagger (M20.8, M21.4–M21.7): o derrotado fica em stagger de \`seconds\` quando o ataque vencedor atinge o seu CORPO. Não acumula nem
 * reinicia o stagger ativo; interrompe o Charge pela regra comum (recuperação > 0). Devolve true se aplicou.
 */
export function applyCounterStagger(f, seconds, events, by = null) {
  if ((f.counterStagger ?? 0) > 1e-9 || !(seconds > 0)) return false;
  f.counterStagger = seconds;f.knockRecovery = Math.max(f.knockRecovery, seconds);
  events?.push({result: 'counterStagger', attacker: by, target: f.id, damage: 0, seconds});
  return true;
}/**
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
}// ---------- Pedras do Psyshock: homing, acertos por alvo e colisão entre pedras ----------
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
}/** Dados de acerto desta pedra no alvo: dano × fator^n (n acertos anteriores da MESMA execução no mesmo alvo, M6.3) e knockback limitado ao teto por alvo e execução (M30.3). */
function execHit(world, p, f) {
  const x = world.exec?.[p.exec], base = p.hit || {}, n = x?.hits?.[f.id] ?? 0, used = x?.kb?.[f.id] ?? 0, c = p.captured ?? {};
  const out = {...base, damage: (base.damage ?? 0) * (c.successiveFactor ?? 1) ** n};
  if (base.knockback) {
    const room = (c.knockbackCap ?? Infinity) - used, h = room > 1e-9 ? Math.min(base.knockback.horizontal ?? 0, room) : 0;   // tolerância: 0,3 + 0,3 + 0,3 não é exatamente 0,9 em ponto flutuante
    out.knockback = h > 0 ? {...base.knockback, horizontal: h} : undefined;
  }
  return out;
}/** Registra o acerto que causou dano (impacto ou defesa comum): conta para o fator 0,8ⁿ; só o impacto com lançamento consome o teto de knockback. */
function execRecord(world, p, f, ev, hit) {
  const x = world.exec?.[p.exec];
  if (!x || !ev || (ev.result !== 'impact' && ev.result !== 'partial')) return;
  x.hits[f.id] = (x.hits[f.id] ?? 0) + 1;
  if (ev.result === 'impact' && hit.knockback) x.kb[f.id] = (x.kb[f.id] ?? 0) + hit.knockback.horizontal;
}/** Pedras de donos diferentes que se tocam (pedras do MESMO Psyshock nunca colidem entre si, mesmo depois de refletidas, M8.1): PL igual → as duas se destroem; PL superior vence e continua (M8.2, M19.4, M20.1). Só as envolvidas somem. */
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
}/** Descarta as execuções sem nenhuma pedra viva. */
function pruneExecutions(world) {
  if (!world.exec) return;
  const live = new Set(world.entities.filter(e => e.exec != null).map(e => String(e.exec)));
  for (const k of Object.keys(world.exec)) if (!live.has(k)) delete world.exec[k];
}// ---------- Barreiras refletoras (Reflect) ----------
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
    a = add(best.point, scale(n, 1e-7));legStart = a;
    p.vel = nv;p.dir = dir;p.pos = add(a, scale(dir, rest));
    p.origin ??= previous;p.owner = bar.owner;p.hitLog = [];p.homing = null;
    if (p.captured?.attackFraction != null) {const o = game.fighters[bar.owner];if (o) p.hit = {...p.hit, damage: p.captured.attackFraction * o.attributes.attack};}
    if (p.captured?.explosionFraction != null && p.onHit?.hit) {const o = game.fighters[bar.owner];if (o) p.onHit = {...p.onHit, hit: {...p.onHit.hit, damage: p.captured.explosionFraction * o.attributes.attack}};}   // a explosão herda o Ataque de quem refletiu
    events.push({result: 'reflected', attacker: bar.owner ?? null, target: previous ?? null, damage: 0, entity: p.id, by: bar.id, face: best.face, kind: 'projectile', pl: p.pl ?? 1, barrierPl: bar.pl ?? 1});
  }
  return true;
}/** O lutador está protegido desta explosão? O segmento 3D do centro da explosão ao centro do corpo cruza o volume de alguma barreira protetora (M30.7). */
function shieldedFromBlast(a, f, shields) {
  const p0 = {x: a.pos.x, z: a.pos.z, y: a.y + a.height / 2}, p1 = {x: f.position.x, z: f.position.z, y: altOf(f) + fighterHeight() / 2};
  const hit = shields.find(b => segmentHitsVolume(b, b.y, b.height, p0, p1));
  return hit ?? null;
}/** Explosão destrói as barreiras vulneráveis que seu volume alcança (M14.5, M14.7); a proteção já foi avaliada antes (M30.6, item 4). */
function breakBarriers(game, a, events) {
  for (const b of game.world.entities) {
    if (b.dead || !b.breakableByBlast || !vOverlap(a.y, a.y + a.height, b.y, b.y + b.height) || closestOnShape(b, a.pos).distance > a.radius) continue;
    b.dead = true;events.push({result: 'barrierBroken', attacker: a.owner ?? null, target: b.owner ?? null, damage: 0, entity: b.id, kind: 'barrier', by: 'explosion'});
  }
}/** Tackle contra barreira vulnerável: destrói (qualquer PL, frente, verso ou borda, inclusive a própria) e o atacante recua e fica em stagger (M14.3, M14.4, M19.9). */
function breakByTackle(e, f, events) {
  e.dead = true;
  const cap = e.captured ?? {}, away = scale(direction(f.action.heading), -1);
  f.action = null;f.velocity = vec();f.locomotionVelocity = vec();f.blend = null;f.vaultHeight = 0;f.state = 'landing';   // sem ação, o estado não pode seguir como 'tackle'
  f.push = {direction: away, distance: nominalDistance(f, 'tackle') * (cap.tackleRecoil ?? .15), elapsed: 0};
  f.knockRecovery = Math.max(f.knockRecovery, cap.tackleStagger ?? .25);
  events?.push({result: 'barrierBroken', attacker: f.id, target: e.owner ?? null, damage: 0, entity: e.id, kind: 'barrier', by: 'tackle'});
}
