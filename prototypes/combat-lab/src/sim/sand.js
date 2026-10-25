// @ts-check
// Entidade 'sandwave' (Sand Wave): retângulo lógico horizontal FIXADO no disparo (comprimento `length` à frente × `width` de lado, origem no centro da borda
// traseira), onda progressiva que avança `length ÷ active` m/s ao longo do CAMINHO LIVRE MAIS CURTO (contorna sólidos, nunca os atravessa), hitbox nos
// primeiros `active` s e dissipação visual até `life`. Por passo, para cada adversário:
//   • elegível = vivo, em terra, com os PÉS dentro do retângulo original e alcançado pela frente da onda; invulnerável não sofre nada nem gasta o acerto;
//   • primeiro contato válido (UM por alvo por execução): 6 HP fixos (independem do Ataque) pela função de acerto das entidades, cegueira de 4 s (a defesa
//     perfeita anula; a parcial não) e empurrão; os contatos seguintes só mantêm o empurrão;
//   • EMPURRÃO: aceleração horizontal 12 m/s² (6 sob defesa parcial) para a frente da direção fixada, enquanto houver contato na janela; suspende o controle de
//     deslocamento e a esquiva (controller.js lê `f.sandPush`), e a velocidade ganha se mantém depois e decai pelo atrito normal;
//   • PAREDE: pressionado contra um sólido, para e fica em stagger de `wallStagger` s sem dano; só repete depois de se soltar e bater de novo.
// Obstáculos móveis: o campo de distâncias é recalculado a cada `replanSteps` passos (SW-D67). Valores: parâmetros capturados no disparo (M28.4).
import {applyHit} from './world/world-hit.js';
import {applyStatus} from './status.js';
import {solidsOf, insideSolid, segmentClear} from './vision.js';
import {dot} from './math.js';

const SQ2 = Math.SQRT2;
/** @type {WeakMap<object, {at: number, sig: string, field: any}>} */
const FIELDS = new WeakMap();
/** Retângulo → coordenadas locais (u à frente, v lateral) de um ponto. */
const localOf = (/** @type {any} */ e, /** @type {{x: number, z: number}} */ p) => {
  const d = e.dir, dx = p.x - e.pos.x, dz = p.z - e.pos.z;
  return {u: dx * d.x + dz * d.z, v: dx * d.z - dz * d.x};
};
export const inRect = (/** @type {any} */ e, /** @type {{x: number, z: number}} */ p) => {const l = localOf(e, p);return l.u >= 0 && l.u <= e.length && Math.abs(l.v) <= e.width / 2;};

/** Campo de distâncias mais curtas (m) a partir da origem, em grade, sem atravessar sólidos; só dentro da região do retângulo + `detour`. */
function distanceField(/** @type {any} */ e, /** @type {import('./vision.js').Solid[]} */ solids) {
  const cs = e.cell, d = e.dir, side = {x: d.z, z: -d.x}, reach = e.detour;
  const corners = [[0, -e.width / 2], [0, e.width / 2], [e.length, -e.width / 2], [e.length, e.width / 2]].map(([u, v]) => ({x: e.pos.x + d.x * u + side.x * v, z: e.pos.z + d.z * u + side.z * v}));
  const minX = Math.min(...corners.map(c => c.x)) - reach, maxX = Math.max(...corners.map(c => c.x)) + reach, minZ = Math.min(...corners.map(c => c.z)) - reach, maxZ = Math.max(...corners.map(c => c.z)) + reach;
  const nx = Math.ceil((maxX - minX) / cs) + 1, nz = Math.ceil((maxZ - minZ) / cs) + 1;
  const blocked = new Uint8Array(nx * nz), dist = new Float32Array(nx * nz).fill(Infinity);
  const cellPos = (/** @type {number} */ ix, /** @type {number} */ iz) => ({x: minX + (ix + .5) * cs, z: minZ + (iz + .5) * cs});
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) if (insideSolid(solids, cellPos(ix, iz), .02)) blocked[iz * nx + ix] = 1;
  const sx = Math.min(nx - 1, Math.max(0, Math.floor((e.pos.x - minX) / cs))), sz = Math.min(nz - 1, Math.max(0, Math.floor((e.pos.z - minZ) / cs)));
  blocked[sz * nx + sx] = 0;dist[sz * nx + sx] = 0;
  // Dijkstra com fila binária simples.
  /** @type {number[]} */ const heap = [sz * nx + sx];
  const push = (/** @type {number} */ i) => {heap.push(i);let k = heap.length - 1;while (k > 0) {const p = (k - 1) >> 1;if (dist[heap[p]] <= dist[heap[k]]) break;[heap[p], heap[k]] = [heap[k], heap[p]];k = p;}};
  const pop = () => {const top = heap[0], last = heap.pop();if (heap.length && last !== undefined) {heap[0] = last;let k = 0;for (;;) {let m = k;const l = 2 * k + 1, r = l + 1;if (l < heap.length && dist[heap[l]] < dist[heap[m]]) m = l;if (r < heap.length && dist[heap[r]] < dist[heap[m]]) m = r;if (m === k) break;[heap[m], heap[k]] = [heap[k], heap[m]];k = m;}}return top;};
  while (heap.length) {
    const i = pop(), ix = i % nx, iz = (i - ix) / nx, di = dist[i];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const jx = ix + dx, jz = iz + dz;if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
      const j = jz * nx + jx;if (blocked[j]) continue;
      if (dx && dz && (blocked[iz * nx + jx] || blocked[jz * nx + ix])) continue;   // sem cortar quinas de sólidos
      const nd = di + cs * (dx && dz ? SQ2 : 1);
      if (nd < dist[j] - 1e-9) {dist[j] = nd;push(j);}
    }
  }
  return {minX, minZ, nx, nz, cs, dist, blocked};
}
/** Distância de caminho livre da origem até o ponto (reta quando livre; senão pela grade). Infinity = inalcançável. */
function pathDistance(/** @type {any} */ e, /** @type {any} */ field, /** @type {import('./vision.js').Solid[]} */ solids, /** @type {{x: number, z: number}} */ p) {
  if (segmentClear(solids, e.pos, p)) return Math.hypot(p.x - e.pos.x, p.z - e.pos.z);
  const ix = Math.floor((p.x - field.minX) / field.cs), iz = Math.floor((p.z - field.minZ) / field.cs);
  if (ix < 0 || iz < 0 || ix >= field.nx || iz >= field.nz) return Infinity;
  return field.dist[iz * field.nx + ix] + field.cs * .5;
}

export function stepSand(/** @type {any} */ game, /** @type {any} */ e, /** @type {number} */ dt, /** @type {any[]} */ events) {
  const solids = solidsOf(game.world), active = e.age <= e.active + 1e-9;
  if (!active) {   // dissipação visual: sem hitbox, sem empurrão
    if (e.pushed?.length) {for (const id of e.pushed) {const f = game.fighters[id];if (f?.sandPush?.by === e.id) f.sandPush = null;}e.pushed = [];}
    return;
  }
  const sig = solids.map(s => `${s.pos.x.toFixed(2)},${s.pos.z.toFixed(2)},${s.hx ?? s.radius}`).join('|');
  const stepNo = Math.round(e.age / dt);
  let cache = FIELDS.get(e);   // o campo de distâncias é só um cache derivado (fora do estado salvo): depois de carregar um save ele é recalculado
  if (!cache || stepNo - cache.at >= e.replanSteps || cache.sig !== sig) {cache = {at: stepNo, sig, field: distanceField(e, solids)};FIELDS.set(e, cache);}
  const front = e.speed * e.age, still = new Set();
  e.targets ??= {};e.pushed ??= [];
  for (const f of game.fighters) {
    if (f.id === e.owner || f.hp <= 0 || f.absent || f.flight || (f.vaultHeight ?? 0) > 1e-8) continue;
    const st = e.targets[f.id];
    const inside = inRect(e, f.position);
    if (!inside) {if (st) st.pinned = false;continue;}
    if (pathDistance(e, cache.field, solids, f.position) > front + 1e-9) continue;   // a frente ainda não chegou
    if (!st) {   // primeiro contato: tenta o acerto (invulnerável não gasta nada)
       // Limpa a velocidade propria (caminhada/corrida/esquiva) para o empurrao sobrepujar o movimento.
       f.locomotionVelocity = {x: 0, z: 0};f.velocity = {x: 0, z: 0};
      const ev = applyHit(game, e.owner, f, {damage: e.damage, knockback: (e.knockbackH > 0 || e.knockbackV > 0) ? {horizontal: e.knockbackH ?? 0, vertical: e.knockbackV ?? 0} : null}, {x: e.dir.x, z: e.dir.z}, {entity: e.id, source: 'sand', origin: {x: e.pos.x, z: e.pos.z}, pl: 1, contact: 'area', move: 'sand-wave'});
      if (!ev || ev.result === 'invulnerable') continue;
      events.push(ev);
      e.targets[f.id] = {partial: ev.result === 'partial', perfect: ev.result === 'perfect', pinned: false, last: {x: f.position.x, z: f.position.z}, riposte: ev.result === 'riposte'};
      if (ev.result !== 'perfect' && ev.result !== 'riposte') {applyStatus(f, {id: 'blind', duration: e.blind, stacking: 'refresh', tags: ['debuff', 'blind'], flags: {blind: true}}, {source: e.owner});events.push({result: 'blinded', attacker: e.owner ?? null, target: f.id, damage: 0, entity: e.id, duration: e.blind});}
      if (ev.result === 'perfect' || ev.result === 'riposte') continue;
    }
    const t = e.targets[f.id];if (t.perfect || t.riposte) continue;
    // O empurrao sobrepuja qualquer movimentacao (caminhada, corrida, esquiva): cancela esquiva em andamento.
    if (f.action && f.action.kind === 'dodge') { if (!f.sandPush) f.locomotionVelocity = {x: 0, z: 0}; f.action = null; }
    // empurrão contínuo para a frente da direção fixada
    const accel = e.accel * (t.partial ? e.partialFactor : 1);
    f.sandPush = {by: e.id, dir: {x: e.dir.x, z: e.dir.z}, accel};still.add(f.id);
    // parede: pressionado (queria andar e não andou) → para e fica em stagger; só repete depois de se soltar
    const moved = (f.position.x - t.last.x) * e.dir.x + (f.position.z - t.last.z) * e.dir.z, want = t.prevWant ?? 0;
    const wantNow = Math.max(0, dot(f.locomotionVelocity ?? {x: 0, z: 0}, e.dir));
    const pressed = want > .6 && (moved < .25 * want * dt || wantNow < .3 * want);   // vinha andando (velocidade do passo anterior) e a colisão o parou
    if (pressed && !t.pinned && f.knockRecovery <= 1e-8) {
      t.pinned = true;f.locomotionVelocity = {x: 0, z: 0};f.velocity = {x: 0, z: 0};f.knockRecovery = Math.max(f.knockRecovery, e.wallStagger);
      events.push({result: 'sandStagger', attacker: e.owner ?? null, target: f.id, damage: 0, entity: e.id, seconds: e.wallStagger});
    } else if (!pressed && moved > .01) t.pinned = false;
    t.prevWant = wantNow;
    t.last = {x: f.position.x, z: f.position.z};
  }
  for (const id of e.pushed) if (!still.has(id)) {const f = game.fighters[id];if (f?.sandPush?.by === e.id) f.sandPush = null;}
  e.pushed = [...still];
}
