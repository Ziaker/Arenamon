// @ts-check
// Entidade 'sandwave' (Sand Wave): retângulo lógico horizontal FIXADO no disparo (comprimento `length` à frente × `width` de lado, origem no centro da borda
// traseira), onda progressiva que avança `length ÷ active` m/s ao longo do CAMINHO LIVRE MAIS CURTO (contorna sólidos, nunca os atravessa), hitbox nos
// primeiros `active` s e dissipação visual até `life`. Por passo, para cada adversário:
//   • elegível = vivo, em terra, com os PÉS dentro do retângulo original e alcançado pela frente da onda; invulnerável não sofre nada nem gasta o acerto;
//   • primeiro contato válido (UM por alvo por execução): 6 HP fixos (independem do Ataque) pela função de acerto das entidades, cegueira de 4 s (a defesa
//     perfeita anula; a parcial não) e empurrão;
//   • EMPURRÃO: a janela é POR ALVO e definida pela política `pushDurationMode` (sand-push.js). Por PADRÃO começa no primeiro contato e dura até o fim da
//     barragem (`active + dissipate`), enquanto o alvo continuar DENTRO do retângulo. Sair da área encerra a força. Modos experimentais podem usar tempo fixo,
//     contato contínuo ou a janela de dano legada (aí sim a vida pode ser estendida). A defesa parcial multiplica a aceleração; a perfeita anula;
//   • PAREDE: pressionado contra um sólido, para e fica em stagger de `wallStagger` s sem dano; só repete depois de se soltar e bater de novo.
// Obstáculos móveis: o campo de distâncias é recalculado a cada `replanSteps` passos (SW-D67). Valores: parâmetros capturados no disparo (M28.4).
import {applyHit} from './world/world-hit.js';
import {applyStatus} from './status.js';
import {blockingSolids, pointInSolid, segmentClear} from './collision/queries.js';
import {dot, scale, clamp} from './math.js';
import {altitudeOf} from './altitude.js';
import {pushAccelNow, pushDurationModeOf, pushWindowState} from './moves/sand-wave/sand-push.js';

const SQ2 = Math.SQRT2;
/** @type {WeakMap<object, {at: number, sig: string, field: any, solids: any[]}>} */
const FIELDS = new WeakMap();
/** F5 (só leitura, para o VFX): campo de distâncias em cache da onda ({minX, minZ, nx, nz, cs, dist, blocked}) ou null se ainda não calculado. */
export const sandFieldOf = (/** @type {any} */ e) => FIELDS.get(e)?.field ?? null;
/** F9 (só leitura, para o VFX): registro do cache do campo ({at, sig, field, solids}); troca de identidade a cada recálculo (replanSteps ou sólidos mudaram). */
export const sandFieldCacheOf = (/** @type {any} */ e) => FIELDS.get(e) ?? null;
/** F5 (só leitura, para o VFX): distância de caminho livre da origem até `p` pela MESMA regra da simulação (reta quando livre; senão a grade),
 * com os sólidos do último cálculo do campo; null se o campo ainda não existe. */
export function sandPathDistance(/** @type {any} */ e, /** @type {{x: number, z: number}} */ p) {
  const c = FIELDS.get(e);
  return c ? pathDistance(e, c.field, c.solids, p) : null;
}
/** Retângulo → coordenadas locais (u à frente, v lateral) de um ponto. */
const localOf = (/** @type {any} */ e, /** @type {{x: number, z: number}} */ p) => {
  const d = e.dir, dx = p.x - e.pos.x, dz = p.z - e.pos.z;
  return {u: dx * d.x + dz * d.z, v: dx * d.z - dz * d.x};
};
export const inRect = (/** @type {any} */ e, /** @type {{x: number, z: number}} */ p) => {const l = localOf(e, p);return l.u >= 0 && l.u <= e.length && Math.abs(l.v) <= e.width / 2;};
/** Distância percorrida pela frente da onda no tempo `age` (m): v₀·t + ½·a·t², com v₀ e a capturados no disparo. */
export function sandFrontAt(/** @type {any} */ e, /** @type {number} */ age) {
  const v0 = (e.speedFromReach === 1) ? (e.length / Math.max(0.01, e.active)) : (e.speed0 ?? e.speed ?? e.waveSpeed ?? 13.333333);
  const a = e.waveAccel ?? 0;
  return Math.max(0, v0 * age + 0.5 * a * age * age);
}

/** Campo de distâncias mais curtas (m) a partir da origem, em grade, sem atravessar sólidos; só dentro da região do retângulo + `detour`. */
function distanceField(/** @type {any} */ e, /** @type {import('./collision/queries.js').Solid[]} */ solids) {
  const cs = e.cell, d = e.dir, side = {x: d.z, z: -d.x}, reach = e.detour;
  const corners = [[0, -e.width / 2], [0, e.width / 2], [e.length, -e.width / 2], [e.length, e.width / 2]].map(([u, v]) => ({x: e.pos.x + d.x * u + side.x * v, z: e.pos.z + d.z * u + side.z * v}));
  const minX = Math.min(...corners.map(c => c.x)) - reach, maxX = Math.max(...corners.map(c => c.x)) + reach, minZ = Math.min(...corners.map(c => c.z)) - reach, maxZ = Math.max(...corners.map(c => c.z)) + reach;
  const nx = Math.ceil((maxX - minX) / cs) + 1, nz = Math.ceil((maxZ - minZ) / cs) + 1;
  const blocked = new Uint8Array(nx * nz), dist = new Float32Array(nx * nz).fill(Infinity);
  const cellPos = (/** @type {number} */ ix, /** @type {number} */ iz) => ({x: minX + (ix + .5) * cs, z: minZ + (iz + .5) * cs});
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) if (pointInSolid(cellPos(ix, iz), solids, {margin: .02})) blocked[iz * nx + ix] = 1;
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
function pathDistance(/** @type {any} */ e, /** @type {any} */ field, /** @type {import('./collision/queries.js').Solid[]} */ solids, /** @type {{x: number, z: number}} */ p) {
  if (segmentClear(e.pos, p, solids)) return Math.hypot(p.x - e.pos.x, p.z - e.pos.z);
  const ix = Math.floor((p.x - field.minX) / field.cs), iz = Math.floor((p.z - field.minZ) / field.cs);
  if (ix < 0 || iz < 0 || ix >= field.nx || iz >= field.nz) return Infinity;
  return field.dist[iz * field.nx + ix] + field.cs * .5;
}

/** Política de deslocamento do evento do Sand Wave: 'force' (sandPush contínuo) só quando o applyHit não deslocou; perfeito/riposte não é empurrado ('none'). */
export const sandDisplacementPolicy = (/** @type {any} */ ev) => ev.result === 'perfect' || ev.result === 'riposte' ? (ev.displacementPolicy ?? 'none')
  : ev.displacementPolicy == null || ev.displacementPolicy === 'none' ? 'force' : ev.displacementPolicy;
/** Limita a componente do empurrão (maxSpeed=0 significa sem limite). */
function capPushSpeed(/** @type {any} */ f, /** @type {{x: number, z: number}} */ dir, /** @type {number} */ max) {
  if (!(max > 0)) return;
  const lv = f.locomotionVelocity ?? {x: 0, z: 0};
  const along = dot(lv, dir);
  if (along > max) f.locomotionVelocity = {x: lv.x - dir.x * (along - max), z: lv.z - dir.z * (along - max)};
}

export function stepSand(/** @type {any} */ game, /** @type {any} */ e, /** @type {number} */ dt, /** @type {any[]} */ events) {
  const solids = blockingSolids(game.world);
  // A frente é avaliada em ticks de 120 Hz: um alvo exatamente no fim do alcance pode ser alcançado entre dois ticks.
  // Damos UM tick de tolerância para o PRIMEIRO contato; depois disso, a política do empurrão decide (no modo 0,
  // basta o alvo permanecer dentro do retângulo até o fim da barragem).
  const hitWindow = e.age <= e.active + dt + 1e-9;
  e.targets ??= {};e.pushed ??= [];
  // Depois de `active` a hitbox acabou, mas um empurrão já iniciado pode continuar (política por alvo). Só encerra cedo
  // quando não há nenhum empurrão em curso, preservando o custo zero da dissipação visual.
  if (!hitWindow && e.pushed.length === 0) return;
  const sig = solids.map(s => `${s.pos.x.toFixed(2)},${s.pos.z.toFixed(2)},${s.hx ?? s.radius}`).join('|');
  const stepNo = Math.round(e.age / dt);
  let cache = FIELDS.get(e);   // o campo de distâncias é só um cache derivado (fora do estado salvo): depois de carregar um save ele é recalculado
  if (!cache || stepNo - cache.at >= e.replanSteps || cache.sig !== sig) {cache = {at: stepNo, sig, field: distanceField(e, solids), solids};FIELDS.set(e, cache);}
  const front = sandFrontAt(e, e.age), still = new Set();
  const minPressSpeed = e.wallPressMinSpeed ?? .6, moveRatio = e.wallPressMoveRatio ?? .25;
  const maxTargets = e.maxTargets ?? 16;
  for (const f of game.fighters) {
    if (f.id === e.owner) continue;
    const st = e.targets[f.id];
    if (f.hp <= 0 || f.absent) {   // alvo saiu: encerra o empurrão e registra o motivo
      if (f.sandPush?.by === e.id) f.sandPush = null;
      if (st) {st.reason = 'targetGone';st.pushStopReason = 'targetGone';}
      continue;
    }
    const airborne = !!(f.flight || (f.vaultHeight ?? 0) > 1e-8);
    const airborneBlocked = airborne && !(e.hitsAirborne ?? 0);
    const targetAlt = altitudeOf(f);
    const botTol = e.waveBottomTolerance ?? 0.2;
    const waveBottom = e.y ?? 0, waveTop = waveBottom + (e.height ?? .35);
    const verticalOut = targetAlt < waveBottom - botTol || targetAlt > waveTop + 1e-6;
    // P0-04 PRISÃO MÓVEL: quem já está sendo empurrado por esta onda NÃO escapa pela frente nem pelo fundo do retângulo — fica retido na frente da onda
    // (e no fim do alcance) até a barragem acabar. Antes o alvo ultrapassava o retângulo no mesmo passo e o empurrão terminava em «leftArea» muito antes da barragem.
    let held = false;
    if (st && f.sandPush?.by === e.id && !st.pinned && (f.knockRecovery ?? 0) <= 1e-8) {
      const cur = localOf(e, f.position), maxU = e.length - 0.1;   // só o FIM do retângulo; a retenção atrás da frente continua no bloco antigo mais abaixo
      if (cur.u >= 0 && Math.abs(cur.v) <= e.width / 2 && cur.u > maxU && cur.u <= e.length + 4 * 0.1) {
        const side = {x: e.dir.z, z: -e.dir.x};
        f.position.x = e.pos.x + e.dir.x * maxU + side.x * cur.v;f.position.z = e.pos.z + e.dir.z * maxU + side.z * cur.v;held = true;
      }
    }
    const inside = inRect(e, f.position);
    const reached = inside && pathDistance(e, cache.field, solids, f.position) <= front + 1e-9;
    const contact = inside && reached && !airborneBlocked && !verticalOut;
    // No modo oficial (0), depois do primeiro acerto a força depende de continuar DENTRO do retângulo, não de a frente
    // da onda continuar atrás do alvo. Renovamos a tolerância de saída enquanto ele estiver elegível na área.
    const insideForPush = inside && !airborneBlocked && !verticalOut;
    if (st && (contact || (pushDurationModeOf(e) === 0 && insideForPush))) st.lastContactAt = e.age;
    if (!st) {   // primeiro contato: só dentro da janela de dano
      if (!hitWindow || !contact) continue;
      if (Object.keys(e.targets).length >= maxTargets) continue;   // limite de alvos por execução
      const at = {x: f.position.x, z: f.position.z};   // F5: ponto de contato (pés do alvo no retângulo) — o VFX nasce aqui, não no meio/extremo da onda
      const ev = applyHit(game, e.owner, f, {damage: e.damage, knockback: (e.knockbackH > 0 || e.knockbackV > 0) ? {horizontal: e.knockbackH ?? 0, vertical: e.knockbackV ?? 0} : null}, {x: e.dir.x, z: e.dir.z}, {entity: e.id, source: 'sand', origin: {x: e.pos.x, z: e.pos.z}, pl: 1, contact: 'area', move: 'sand-wave'});
      if (!ev || ev.result === 'invulnerable') continue;
      events.push({...ev, x: at.x, z: at.z, displacementPolicy: sandDisplacementPolicy(ev)});   // F3.2: o deslocamento do Sand Wave é a força contínua sandPush (não impulso nem empurrão coreografado)
      e.targets[f.id] = {partial: ev.result === 'partial', perfect: ev.result === 'perfect', pinned: false, last: {x: f.position.x, z: f.position.z}, riposte: ev.result === 'riposte', firstAt: e.age, lastContactAt: e.age, pushStartedAt: null, pushActiveFor: 0, pushStopReason: ev.result === 'perfect' || ev.result === 'riposte' ? 'perfectGuard' : null, reason: ev.result === 'perfect' || ev.result === 'riposte' ? 'perfectGuard' : null};
      // Impulso inicial (m/s): soma à velocidade própria sobrevivente. A limpeza do movimento é uma política
      // separada (`pushClearsLocomotion`/`pushPreserveVelocity`); a defesa parcial multiplica o impulso.
      const dir = {x: e.dir.x, z: e.dir.z};
      const preserve = (e.pushClearsLocomotion ?? 1) ? clamp(e.pushPreserveVelocity ?? 0, 0, 1) : 1;
      const preserved = scale(f.locomotionVelocity ?? {x: 0, z: 0}, preserve);
      f.locomotionVelocity = {x: preserved.x || 0, z: preserved.z || 0};
      const ps = (ev.result === 'perfect' || ev.result === 'riposte') ? 0 : (ev.result === 'partial') ? (e.pushSpeed ?? 0) * (e.partialFactor ?? .5) : (e.pushSpeed ?? 0);
      if (ps > 0) f.locomotionVelocity = {x: f.locomotionVelocity.x + dir.x * ps, z: f.locomotionVelocity.z + dir.z * ps};
      capPushSpeed(f, dir, e.pushMaxSpeed ?? 0);
      // P0-04: Game.step copia f.velocity para locomotionVelocity no fim do passo; sem gravar a velocidade também, o impulso do contato era apagado no MESMO tick e o empurrão só nascia de uma rampa de aceleração.
      f.velocity = {x: f.locomotionVelocity.x, z: f.locomotionVelocity.z};
      // F7: cegueira 0 s (mínimo do slider) = não cega; antes lançava «duração deve ser > 0» no applyStatus. No padrão (> 0) nada muda.
      const canBlind = (e.blind ?? 0) > 0 && ev.result !== 'perfect' && ev.result !== 'riposte' && (ev.result !== 'partial' || (e.blindOnPartial ?? 1));
      if (canBlind) {applyStatus(f, {id: 'blind', duration: e.blind, stacking: 'refresh', tags: ['debuff', 'blind'], flags: {blind: true}}, {source: e.owner});events.push({result: 'blinded', attacker: e.owner ?? null, target: f.id, damage: 0, entity: e.id, duration: e.blind});}
      if (ev.result === 'perfect' || ev.result === 'riposte') continue;
    }
    const t = e.targets[f.id];if (!t || t.perfect || t.riposte) {if (t) t.reason = 'perfectGuard';continue;}
    // Distância de soltura da parede: medida mesmo quando o empurrão está pausado por recuperação/stagger.
    const moved = (f.position.x - t.last.x) * e.dir.x + (f.position.z - t.last.z) * e.dir.z;
    if (t.pinned && moved > (e.wallUnpinDistance ?? .01)) t.pinned = false;
    const state = pushWindowState(e, t, e.age, {contact, inside, airborne: airborneBlocked, verticalOut, pinned: !!t.pinned, recovering: (f.knockRecovery ?? 0) > 1e-8, alive: true});
    if (!state.on) {
      if (f.sandPush?.by === e.id) f.sandPush = null;
      t.reason = state.reason;
      if (state.reason && state.reason !== 'releaseGrace') t.pushStopReason = state.reason;
      t.last = {x: f.position.x, z: f.position.z};t.prevWant = 0;
      continue;
    }
    // O empurrão sobrepuja o controle de deslocamento. A esquiva em andamento só é cancelada se a política permitir;
    // negar uma NOVA esquiva é `pushCancelsDodge` (ctrl-basico.js).
    if ((e.pushCancelsExistingDodge ?? e.pushCancelsDodge ?? 1) && f.action && f.action.kind === 'dodge') {
      if (!f.sandPush && (e.pushClearsLocomotion ?? 1)) f.locomotionVelocity = {x: 0, z: 0};
      f.action = null;
    }
    // Duas ondas no mesmo alvo: a de maior aceleração base assume; a outra registra `superseded` (determinístico).
    const existing = f.sandPush;
    if (existing && existing.by !== e.id) {
      const other = /** @type {any[]} */ (game.world.entities ?? []).find((x) => x.id === existing.by && x.kind === 'sandwave' && !x.dead);
      if (other && (e.accel ?? 0) <= (other.accel ?? 0)) {
        t.reason = 'superseded';t.pushStopReason = 'superseded';
        t.last = {x: f.position.x, z: f.position.z};
        continue;
      }
    }
    const waveSpd = (e.speedFromReach === 1) ? (e.length / Math.max(0.01, e.active)) : (e.speed0 ?? e.speed ?? e.waveSpeed ?? 13.333333);
    const accel = pushAccelNow(e, t, f, e.age);
    f.sandPush = {by: e.id, dir: {x: e.dir.x, z: e.dir.z}, accel, maxSpeed: e.pushMaxSpeed ?? 0, cancelsDodge: e.pushCancelsDodge ?? 1, continuesDuringStagger: e.pushContinuesDuringStagger ?? 1, mode: state.mode, elapsed: state.elapsed, duration: state.duration};

    // Prisão móvel: se o alvo estiver dentro da onda e avançar além da crista frontal da onda,
    // ele é retido na frente da onda para não escapar do raio do move.
    if (inside && accel > 0 && !t.pinned && (f.knockRecovery ?? 0) <= 1e-8) {
      const curLoc = localOf(e, f.position);
      const maxU = Math.min(e.length - 0.1, front - 0.05);
      if (curLoc.u > maxU && maxU > 0.1) {
        const side = {x: e.dir.z, z: -e.dir.x};
        f.position.x = e.pos.x + e.dir.x * maxU + side.x * curLoc.v;
        f.position.z = e.pos.z + e.dir.z * maxU + side.z * curLoc.v;
      }
    }

    if (f.hp > 0 && !f.flight && f.state !== 'guardStun' && f.state !== 'stagger') {
      f.state = 'pushed';
      f.recoveryKind = 'pushed';
    }
    still.add(f.id);
    if (t.pushStartedAt === null || t.pushStartedAt === undefined) t.pushStartedAt = e.age;
    t.pushActiveFor = (t.pushActiveFor ?? 0) + dt;
    t.reason = state.reason;
    // parede: pressionado (queria andar e não andou) → para e fica em stagger; só repete depois de se soltar
    const want = t.prevWant ?? 0;
    const wantNow = Math.max(0, dot(f.locomotionVelocity ?? {x: 0, z: 0}, e.dir));
    const pressed = !held && want > minPressSpeed && (moved < moveRatio * want * dt || wantNow < (e.wallPressStopRatio ?? .3) * want);   // vinha andando (velocidade do passo anterior) e a colisão o parou
    if ((e.wallStaggerOn ?? 1) && pressed && !t.pinned && f.knockRecovery <= 1e-8) {
      t.pinned = true;f.locomotionVelocity = {x: 0, z: 0};f.velocity = {x: 0, z: 0};f.knockRecovery = Math.max(f.knockRecovery, e.wallStagger);f.stagger = Math.max(f.stagger ?? 0, e.wallStagger);f.staggerMax = Math.max(f.staggerMax ?? 0, e.wallStagger);f.recoveryKind = 'stagger';f.state = 'stagger';f.hitSerial = (f.hitSerial ?? 0) + 1;
      events.push({result: 'sandStagger', attacker: e.owner ?? null, target: f.id, damage: 0, entity: e.id, seconds: e.wallStagger, x: f.position.x, z: f.position.z});
    }
    t.prevWant = wantNow;
    t.last = {x: f.position.x, z: f.position.z};
  }
  for (const id of e.pushed) if (!still.has(id)) {const f = game.fighters[id];if (f?.sandPush?.by === e.id) f.sandPush = null;}
  e.pushed = [...still];
  // Modos experimentais (1/2/3) podem manter a entidade viva enquanto houver empurrão ativo. O PADRÃO OFICIAL (0) NÃO
  // estende a vida: o empurrão termina exatamente com a barragem, e o mundo remove a onda no mesmo passo.
  if (still.size > 0 && pushDurationModeOf(e) !== 0) e.life = Math.max(e.life, e.age + dt * 2);
}
