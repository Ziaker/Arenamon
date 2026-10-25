// @ts-check
// Emerging Stone — mecânica (docs/MUSHROOM_MOVES_DECISOES.md §7, ES-D01…ES-D103; brief em docs/moves-nao-iniciados/EMERGING_STONE_PROMPT_IMPLEMENTACAO.md).
//   • BURROW (entidade 'burrow'): o "projétil subterrâneo". Nasce onde o lutador REALMENTE está no disparo e segue em LINHA RETA 3D virtual a 15 m/s até o marcador
//     confirmado (fixo no mundo), atravessando paredes, buracos e plataformas, sem dano nem contato no trajeto. Persiste se o dono for derrotado; some sem detonar quando a
//     rodada termina (o reset recria o mundo).
//   • DETONAÇÃO: raio HORIZONTAL de 5 m (qualquer altura, através de paredes). Ordem (ES-D…): avalia quem está apoiado → dano 20 nominais (× Ataque ÷ referência, MV-P13)
//     e empurrão radial de 8 m/s a cada adversário apoiado, UMA vez → destrói cenário tocado (inteiro; piso e limites não) → cria a rocha → aplica o limite de 3.
//   • ROCHA: destrutível do mapa (`d.rock`) com prisma 3×3×3 m × escala, 5 HP, que EMERGE em 0,40 s (colisor e topo crescem com a altura exposta). Base integralmente
//     apoiada e sem sobrepor sólidos; senão procura o lugar válido mais próximo (a explosão fica onde foi confirmada); sem lugar, só a explosão. A primeira interseção
//     de cada personagem com a parte exposta lança uma vez (8 m/s H, 14 m/s V), sem dano. Perder o apoio integral destrói a rocha (cascata). Dano à rocha: P0=1, P1=2,
//     P2=3, P3=4 HP por golpe válido (sem PL = P0), em map.js. Três por dono: a quarta destrói a mais antiga que sobrou da explosão.
// Fora deste entrega (declarado): plataformas MÓVEIS (o mapa atual só tem plataformas fixas), rampas/terreno inclinado (as plataformas do motor são planas) e o atraso
// de visibilidade dos adversários na mira são tratados só no que o motor suporta — ver docs/moves-nao-iniciados/fichas/emerging-stone.md.
import {C} from './config.js';
import {applyHit, closestOnShape} from './world/world-hit.js';
import {getGroundHeight} from './physics.js';
import {effectiveArenaRadius} from './map.js';
import {launch} from './combat.js';
import {sub, length, normalize, direction} from './math.js';

const bodyH = () => C.extras?.visual?.bodyHeight ?? 1.2;

// ---------- Burrow ----------
export function stepBurrow(/** @type {any} */ game, /** @type {any} */ e, /** @type {number} */ dt, /** @type {any[]} */ events) {
  e.travelled = Math.min(e.total, e.travelled + e.speed * dt);
  const k = e.total > 1e-9 ? e.travelled / e.total : 1;
  e.pos = {x: e.from.x + (e.to.x - e.from.x) * k, z: e.from.z + (e.to.z - e.from.z) * k};
  e.alt = e.from.y + (e.to.y - e.from.y) * k;
  if (e.travelled >= e.total - 1e-9) {detonate(game, e, events);e.dead = true;}
}

// ---------- Detonação ----------
function detonate(/** @type {any} */ game, /** @type {any} */ e, /** @type {any[]} */ events) {
  const P = e.params, c = e.to, owner = game.fighters[e.owner];
  events.push({result: 'stoneBlast', attacker: e.owner ?? null, target: null, damage: 0, entity: e.id, x: c.x, z: c.z, radius: P.blastRadius});
  // 1. quem está APOIADO agora (antes de qualquer destruição) sofre o dano e o empurrão radial, uma vez
  for (const f of game.fighters) {
    if (f.id === e.owner || f.hp <= 0 || f.absent || f.flight || (f.vaultHeight ?? 0) > 1e-8) continue;
    if (Math.hypot(f.position.x - c.x, f.position.z - c.z) > P.blastRadius + 1e-9) continue;
    const away = sub(f.position, c), normal = length(away) > 1e-6 ? normalize(away) : direction(owner?.facing ?? 0);
    const ev = applyHit(game, e.owner, f, {damage: e.damage, knockback: {horizontal: P.blastKnockback, vertical: P.blastKnockbackV ?? 0}}, normal, {entity: e.id, source: 'stone', contact: 'area', origin: c, move: 'emerging-stone'});
    if (ev) events.push({...ev, phase: 'blast'});
  }
  // 2. cenário tocado pelo círculo horizontal
  const gone = destroyScenery(game, c, P.blastRadius, events);
  // 3. rocha (se houver lugar) e 4. limite de três por dono
  makeRock(game, e, events);
  void gone;
}

/** Caixa XZ de um destrutível/obstáculo/plataforma, para o teste de toque com o círculo da explosão. */
const boxOf = (/** @type {{x: number, z: number}} */ pos, /** @type {number} */ hx, /** @type {number} */ hz, /** @type {number} */ angle = 0) => ({shape: 'box', pos, hx, hz, angle});

function destroyScenery(/** @type {any} */ game, /** @type {{x: number, z: number}} */ c, /** @type {number} */ R, /** @type {any[]} */ events) {
  const ms = game.mapState;let n = 0;
  for (const w of game.world.entities) if (!w.dead && w.kind === 'wall' && closestOnShape(w, c).distance <= R) {w.dead = true;n++;events.push({result: 'sceneryDestroyed', kind: 'wall', entity: w.id, attacker: null, target: null, damage: 0});}
  if (!ms) return n;
  for (const d of ms.destructibles ?? []) {
    if (d.state !== 'solid' || closestOnShape(/** @type {any} */ (boxOf({x: d.pos.x, z: d.pos.z}, d.size.hx, d.size.hz, d.angle ?? 0)), c).distance > R) continue;
    if (d.rock) destroyRock(ms, d, events, 'blast');
    else {d.hp = 0;d.state = 'dead';d.noRespawn = true;d.respawnTimer = Infinity;events.push({result: 'destructibleDestroyed', id: d.id, pos: {...d.pos}, by: 'stone'});}
    n++;
  }
  if (ms.obstacles) ms.obstacles = ms.obstacles.filter((/** @type {any} */ o) => {
    const p = {x: o.pos?.x ?? 0, z: o.pos?.z ?? 0};
    const hit = (o.shape === 'cylinder' || o.shape === 'pillar') ? Math.hypot(p.x - c.x, p.z - c.z) - (o.radius ?? 1) <= R : closestOnShape(/** @type {any} */ (boxOf(p, o.hx ?? 1.5, o.hz ?? 1.5)), c).distance <= R;
    if (hit) {n++;events.push({result: 'sceneryDestroyed', kind: 'obstacle', attacker: null, target: null, damage: 0});}
    return !hit;
  });
  if (ms.platforms) ms.platforms = ms.platforms.filter((/** @type {any} */ p) => {
    const px = p.pos ? p.pos.x : p.x, pz = p.pos ? p.pos.z : p.z;
    const hit = closestOnShape(/** @type {any} */ (boxOf({x: px, z: pz}, (p.width ?? 3) / 2, (p.depth ?? 3) / 2)), c).distance <= R;
    if (hit) {n++;events.push({result: 'sceneryDestroyed', kind: 'platform', attacker: null, target: null, damage: 0});}
    return !hit;
  });
  return n;
}

// ---------- Rocha ----------
/** Blocos sólidos (que sobreviveram) como caixas XZ com faixa vertical, para a checagem de sobreposição do prisma. */
function blockers(/** @type {any} */ game) {
  const out = [];
  for (const w of game.world.entities) if (!w.dead && w.kind === 'wall' && w.shape === 'box') out.push({x: w.pos.x, z: w.pos.z, hx: w.hx, hz: w.hz, y0: w.y ?? 0, y1: (w.y ?? 0) + (w.height ?? 2.2), angle: w.angle ?? 0});
  const ms = game.mapState;
  for (const o of ms?.obstacles ?? []) {
    const r = o.shape === 'cylinder' || o.shape === 'pillar' ? (o.radius ?? 1) : null, y0 = o.pos?.y ?? 0;
    out.push({x: o.pos?.x ?? 0, z: o.pos?.z ?? 0, hx: r ?? o.hx ?? 1.5, hz: r ?? o.hz ?? 1.5, y0, y1: y0 + (o.height ?? 1.5), angle: 0});
  }
  for (const d of ms?.destructibles ?? []) if (d.state === 'solid') out.push({x: d.pos.x, z: d.pos.z, hx: d.size.hx, hz: d.size.hz, y0: d.pos.y, y1: d.pos.y + Math.max(d.size.height, .01), angle: d.angle ?? 0, id: d.id});
  return out;
}
const samples = (/** @type {{x: number, z: number}} */ p, /** @type {number} */ half) => {const s = [];for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) s.push({x: p.x + dx * (half - .05), z: p.z + dz * (half - .05)});return s;};

/** O prisma de base `y0` e lado `half`×2 cabe em `p`? (apoio integral, dentro da arena, sem sobrepor sólidos sobreviventes) */
function rockFits(/** @type {any} */ game, /** @type {{x: number, z: number}} */ p, /** @type {number} */ y0, /** @type {number} */ half, /** @type {number} */ height, /** @type {any[]} */ solid, /** @type {string|null} */ ignoreId = null) {
  const lim = effectiveArenaRadius();
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (Math.hypot(p.x + sx * half, p.z + sz * half) > lim) return false;
  for (const s of samples(p, half)) if (Math.abs(getGroundHeight(s, game.world, y0 + .3) - y0) > .06) return false;
  for (const b of solid) {
    if (ignoreId && b.id === ignoreId) continue;
    if (!(y0 < b.y1 - .02 && y0 + height > b.y0 + .02)) continue;
    const near = Math.abs(b.angle) < 1e-6 ? Math.abs(p.x - b.x) < half + b.hx && Math.abs(p.z - b.z) < half + b.hz : closestOnShape(/** @type {any} */ (boxOf({x: b.x, z: b.z}, b.hx, b.hz, b.angle)), p).distance < half;
    if (near) return false;
  }
  return true;
}
function makeRock(/** @type {any} */ game, /** @type {any} */ e, /** @type {any[]} */ events) {
  const ms = game.mapState;if (!ms) return;
  const P = e.params, half = 1.5 * P.rockScale, height = 3 * P.rockScale, solid = blockers(game), c = e.to;
  /** @returns {{pos: {x: number, z: number}, y: number} | null} */
  const spot = () => {
    const tryAt = (/** @type {{x: number, z: number}} */ p) => {const y0 = getGroundHeight(p, game.world, c.y + .3);return rockFits(game, p, y0, half, height, solid) ? {pos: p, y: y0} : null;};
    const first = tryAt({x: c.x, z: c.z});if (first) return first;
    for (let r = .25; r <= P.rockSearch; r += .25) {
      const n = Math.max(8, Math.round(r * 16));
      for (let i = 0; i < n; i++) {const a = (i / n) * Math.PI * 2, hit = tryAt({x: c.x + Math.sin(a) * r, z: c.z + Math.cos(a) * r});if (hit) return hit;}
    }
    return null;
  };
  const found = spot();
  if (!found) {events.push({result: 'stoneNoRock', attacker: e.owner ?? null, target: null, damage: 0, x: c.x, z: c.z});return;}
  ms.nextEntityId ??= 1;
  const rock = {id: `rock_${ms.nextEntityId++}`, rock: true, owner: e.owner, hp: P.rockHp, maxHp: P.rockHp, pos: {x: found.pos.x, y: found.y, z: found.pos.z}, size: {hx: half, hz: half, height: 0},
    targetHeight: height, rise: P.riseTime, age: 0, launched: [], launchH: P.launchH, launchV: P.launchV, shape: 'box', angle: 0, state: 'solid', seq: (ms.rockSeq = (ms.rockSeq ?? 0) + 1)};
  ms.destructibles.push(rock);
  events.push({result: 'rockCreated', attacker: e.owner ?? null, target: null, damage: 0, id: rock.id, x: rock.pos.x, z: rock.pos.z, y: rock.pos.y});
  const mine = ms.destructibles.filter((/** @type {any} */ d) => d.rock && d.owner === e.owner && d.state === 'solid' && d !== rock).sort((/** @type {any} */ a, /** @type {any} */ b) => a.seq - b.seq);
  while (mine.length + 1 > P.maxRocks) destroyRock(ms, /** @type {any} */ (mine.shift()), events, 'limit');   // a mais antiga que sobrou da explosão
}
export function destroyRock(/** @type {any} */ ms, /** @type {any} */ d, /** @type {any[]} */ events, /** @type {string} */ why) {
  d.state = 'dead';d.hp = 0;
  ms.destructibles = ms.destructibles.filter((/** @type {any} */ x) => x !== d);
  events.push({result: 'rockDestroyed', attacker: null, target: null, damage: 0, id: d.id, owner: d.owner, why, x: d.pos.x, z: d.pos.z});
}

/** Gancho de passo das rochas: emergência progressiva, lançamento único, topo que sustenta e perda de apoio em cascata. */
export function stoneStep(/** @type {any} */ game) {
  const ms = game.mapState;if (!ms?.destructibles?.some((/** @type {any} */ d) => d.rock)) return [];
  /** @type {any[]} */ const events = [], dt = C.test.step, h = C.test.halfExtent;
  for (const d of [...ms.destructibles]) {
    if (!d.rock || d.state !== 'solid') continue;
    const prev = d.size.height;d.age += dt;
    d.size.height = d.targetHeight * Math.min(1, d.age / Math.max(1e-6, d.rise));
    for (const f of game.fighters) {
      if (f.hp <= 0 || f.absent) continue;
      const inside = Math.abs(f.position.x - d.pos.x) <= d.size.hx + h && Math.abs(f.position.z - d.pos.z) <= d.size.hz + h;
      if (!inside) continue;
      const fy = f.flight ? f.flight.y : (f.groundY ?? 0) + (f.vaultHeight ?? 0);
      if (!f.flight && Math.abs((f.groundY ?? 0) - (d.pos.y + prev)) < .06 && prev > .01) {f.groundY = d.pos.y + d.size.height;continue;}   // em cima: o topo o carrega durante a subida
      // Lancamento so durante a emergencia (invocacao): rocha ja totalmente invocada nao derruba mais ninguem.
      if (d.size.height >= d.targetHeight - 1e-6) continue;
      if (d.launched.includes(f.id)) continue;
      if (fy < d.pos.y + d.size.height - .02 && fy + bodyH() > d.pos.y + .02) {   // primeira interseção válida com a parte exposta
        d.launched.push(f.id);
        const away = {x: f.position.x - d.pos.x, z: f.position.z - d.pos.z}, dir = length(away) > 1e-6 ? normalize(away) : direction(f.facing + Math.PI);
        launch(f, dir, d.launchH, d.launchV);
        events.push({result: 'rockLaunch', attacker: d.owner ?? null, target: f.id, damage: 0, id: d.id, horizontal: d.launchH, vertical: d.launchV});
      }
    }
  }
  // perda de apoio integral: destrói e propaga pela pilha (até estabilizar)
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const d of [...ms.destructibles]) {
      if (!d.rock || d.state !== 'solid') continue;
      const ok = samples({x: d.pos.x, z: d.pos.z}, d.size.hx).every(s => getGroundHeight(s, game.world, d.pos.y + .3) >= d.pos.y - .06);
      if (!ok) {destroyRock(ms, d, events, 'support');changed = true;}
    }
    if (!changed) break;
  }
  return events;
}
