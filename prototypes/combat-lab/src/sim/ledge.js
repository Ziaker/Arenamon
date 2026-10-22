// @ts-check
// Ledge Grab & Mantle (issue #95, v1.19.0): depois de saltar (ou cair de uma borda) perto da LATERAL de um sólido de topo plano — plataforma, caixa ou destrutível —, o lutador pode
// agarrar a borda, ficar pendurado e subir ao topo (mantle) ou soltar. Todas as decisões que a issue deixava pendentes são parâmetros de `C.ledge` (docs/LEDGE_GRAB.md), com valores
// PROVISÓRIOS; `ledge.mode` 0 desliga tudo.
//
//   f.ledge = {phase: 'snap' | 'hang' | 'climb', t, surf: {kind, id}, n (normal da face, do sólido para fora), top, hangPos, hangY, topPos, from, hp0, hold, dropHold, climbT, blocked, invuln}
//
// Enquanto `f.ledge` existe o corpo é conduzido por aqui (a física pula o lutador); o controlador retorna logo depois de `ledgeUpdate`. Um golpe sofrido, a perda do apoio, a stamina
// zerada, o tempo máximo ou o comando de soltar terminam o estado; sair de um estado nunca deixa o lutador preso (rede de segurança no fim de `ledgeUpdate`).
import {C} from './config.js';
import {getGroundHeight} from './physics.js';
import {effectiveArenaRadius} from './map.js';
import {altitudeOf} from './entity.js';
import {hasFlag} from './status.js';
import {isAirJump} from './air.js';
import {vec, scale, length, dot, clamp, smoothstep, angleOf} from './math.js';

/** @typedef {{kind: 'platform' | 'obstacle' | 'destructible', id: any, cx: number, cz: number, hx: number, hz: number, top: number, base: number}} LedgeSurface */

/** Sólidos de topo plano agarráveis (caixas axiais): plataformas e, se `ledge.objects`, obstáculos em caixa e destrutíveis sólidos. @returns {LedgeSurface[]} */
export function ledgeSurfaces(/** @type {any} */ world) {
  const ms = world?.mapState, out = [];
  if (!ms) return out;
  for (const p of ms.platforms ?? []) out.push({kind: 'platform', id: p.id ?? null, cx: p.pos?.x ?? p.x ?? 0, cz: p.pos?.z ?? p.z ?? 0, hx: (p.width ?? 3) / 2, hz: (p.depth ?? 3) / 2, top: p.height ?? 1, base: p.pos?.y ?? 0});
  if (!C.ledge.objects) return out;
  for (const o of ms.obstacles ?? []) if (o.shape === 'box') out.push({kind: 'obstacle', id: o.id ?? null, cx: o.pos?.x ?? 0, cz: o.pos?.z ?? 0, hx: o.hx ?? 1, hz: o.hz ?? 1, top: (o.pos?.y ?? 0) + (o.height ?? 1.5), base: o.pos?.y ?? 0});
  for (const d of ms.destructibles ?? []) if (d.state === 'solid' && d.size) out.push({kind: 'destructible', id: d.id ?? null, cx: d.pos?.x ?? 0, cz: d.pos?.z ?? 0, hx: d.size.hx ?? .8, hz: d.size.hz ?? .8, top: (d.pos?.y ?? 0) + (d.size.height ?? 1.6), base: d.pos?.y ?? 0});
  return out;
}
const surfaceById = (/** @type {any} */ world, /** @type {any} */ lg) => ledgeSurfaces(world).find(s => s.kind === lg.surf.kind && s.id === lg.surf.id) ?? null;

/**
 * Borda agarrável para um lutador em voo agora (ou null): face mais próxima do corpo, dentro do alcance horizontal e vertical, com a pose pendurada acima do chão.
 * Não olha o comando: quem decide agarrar é `ledgeUpdate` (modo automático ou por botão).
 */
export function findLedge(/** @type {any} */ f, /** @type {any} */ world) {
  const L = C.ledge, he = C.test.halfExtent, feet = f.flight?.y ?? f.groundY ?? 0;
  /** @type {any} */ let best = null;
  for (const s of ledgeSurfaces(world)) {
    const dx = f.position.x - s.cx, dz = f.position.z - s.cz, ex = Math.abs(dx) - s.hx, ez = Math.abs(dz) - s.hz;
    const alongX = ex >= ez, gap = (alongX ? ex : ez) - he, along = alongX ? ez : ex;   // gap: do corpo à face (≈ 0 encostado); along > 0: o centro passou da ponta da face
    if (gap > L.reach || gap < -.05 || along > -.05) continue;
    const up = s.top - feet;
    if (up < L.minUp || up > L.reachUp) continue;
    const hangY = s.top - L.hangDrop;
    if (hangY < getGroundHeight({x: f.position.x, z: f.position.z}, world, hangY) + L.minHangHeight) continue;   // a pose pendurada precisa ficar acima do chão (plataformas muito baixas só se monta)
    const n = alongX ? {x: dx >= 0 ? 1 : -1, z: 0} : {x: 0, z: dz >= 0 ? 1 : -1};
    if (!best || gap < best.gap) {
      const face = alongX ? {x: s.cx + n.x * s.hx, z: clamp(f.position.z, s.cz - s.hz, s.cz + s.hz)} : {x: clamp(f.position.x, s.cx - s.hx, s.cx + s.hx), z: s.cz + n.z * s.hz};
      const inset = Math.max(.05, Math.min(L.climbInset, (alongX ? s.hx : s.hz) - .05));
      best = {gap, surf: {kind: s.kind, id: s.id}, n, top: s.top, hangY, w: 2 * Math.max(s.hx, s.hz), h: s.top - s.base, base: s.base,
        hangPos: {x: face.x + n.x * he, z: face.z + n.z * he}, topPos: {x: face.x - n.x * inset, z: face.z - n.z * inset}, face};
    }
  }
  return best;
}

const moveEvent = (/** @type {any} */ f, /** @type {any} */ e) => (f.moveEvents ??= []).push({attacker: f.id, target: null, damage: 0, ...e});
/** Solta a borda: vira queda de borda (isEdgeFall, com coyote para um salto logo depois) com um empurrão para longe da parede. */
function drop(/** @type {any} */ f, /** @type {string} */ why) {
  const lg = f.ledge, L = C.ledge;
  f.ledge = null;f.ledgeCd = L.cooldown;f.ledgeHint = null;
  f.flight = {y: f.groundY ?? lg.hangY, vy: 0, horizontal: scale(lg.n, L.dropPush), isEdgeFall: true, jumpFeel: !!(C.map?.jumpImprovements ?? 1), jumpHeld: false};
  f.coyoteLeft = C.map?.jumpCoyoteTime ?? .1;f.footstoolDoneWith = null;f.normalJumpLanding = false;
  f.velocity = vec();f.locomotionVelocity = vec();f.vaultHeight = 0;f.state = 'airborne';
  if (f.jumpState) f.jumpState.canJump = true;
  moveEvent(f, {result: 'ledgeDrop', reason: why, x: f.position.x, z: f.position.z});
}
function finishClimb(/** @type {any} */ f, /** @type {any} */ world) {
  const lg = f.ledge, L = C.ledge;
  f.position = {...lg.topPos};f.groundY = getGroundHeight(lg.topPos, world, lg.top);f.vaultHeight = 0;f.flight = null;
  f.ledge = null;f.ledgeCd = L.cooldown;f.ledgeHint = null;f.state = 'neutral';f.velocity = vec();f.locomotionVelocity = vec();
  if (f.jumpState) {f.jumpState.canJump = true;f.jumpState.cooldown = C.map?.jumpInterval ?? .12;}
  moveEvent(f, {result: 'ledgeClimb', x: f.position.x, z: f.position.z});
}
/** Há espaço no topo? Sem outro lutador no ponto, dentro da arena e com o apoio do próprio sólido. */
function topFree(/** @type {any} */ f, /** @type {any} */ lg, /** @type {any} */ fighters, /** @type {any} */ world) {
  const he = C.test.halfExtent;
  if (Math.hypot(lg.topPos.x, lg.topPos.z) > effectiveArenaRadius() - he) return false;
  if (getGroundHeight(lg.topPos, world, lg.top) < lg.top - 1e-6) return false;
  const bodyH = C.extras?.visual?.bodyHeight ?? 1.2;
  return !fighters.some((/** @type {any} */ o) => o !== f && o.hp > 0 && !o.absent && Math.abs(altitudeOf(o) - lg.top) < bodyH && Math.hypot(o.position.x - lg.topPos.x, o.position.z - lg.topPos.z) < 2 * he * .98);
}

/**
 * Passo do Ledge Grab para um lutador (chamado por updateFighter antes do ramo de voo). Devolve true quando o corpo está sob controle do agarre neste passo (o controlador retorna).
 * Detecta a borda quando o lutador salta/cai perto de um sólido, agarra conforme o modo e conduz encaixe, suspensão, subida e soltura.
 */
export function ledgeUpdate(/** @type {any} */ f, /** @type {any} */ cmd, /** @type {any[]} */ fighters, /** @type {any} */ world, /** @type {number} */ dt, /** @type {boolean} */ diag) {
  const L = C.ledge;
  if (f.ledgeCd > 0) f.ledgeCd = Math.max(0, f.ledgeCd - dt);
  if (!f.ledge) {
    f.ledgeHint = null;
    if (!L.mode || f.hp <= 0 || !f.flight || !isAirJump(f) || f.absent || (f.ledgeCd ?? 0) > 0) return false;
    if (f.flight.vy > L.maxRiseSpeed || f.action || f.charge || f.aim || f.tackleCharge || hasFlag(f, 'stunned') || hasFlag(f, 'rooted')) return false;
    const c = findLedge(f, world);
    if (!c) return false;
    f.ledgeHint = {x: c.face.x, z: c.face.z, y: c.top, n: c.n};
    const m = length(cmd.move) > 1 ? scale(cmd.move, 1 / length(cmd.move)) : cmd.move;
    const want = L.mode === 2 ? !!cmd.jump : length(m) > .1 && dot(m, scale(c.n, -1)) >= .5;
    if (!want || f.exhausted || f.stamina < L.grabCost - 1e-8) return false;
    f.stamina = Math.max(0, f.stamina - L.grabCost);f.regenBase = f.stamina;f.regenAge = 0;
    f.ledge = {phase: 'snap', t: 0, surf: c.surf, n: c.n, top: c.top, hangPos: c.hangPos, hangY: c.hangY, topPos: c.topPos, from: {x: f.position.x, z: f.position.z, y: f.flight.y}, hp0: f.hp, hold: 0, dropHold: 0, climbT: 0, blocked: false, invuln: 0};
    f.flight = null;f.velocity = vec();f.locomotionVelocity = vec();f.guard = false;f.sprinting = false;f.jumpBuffered = 0;
    moveEvent(f, {result: 'ledgeGrab', x: c.face.x, z: c.face.z, y: c.hangY + L.hangDrop * .9, n: {...c.n}, w: c.w, h: c.h, base: c.base});
    if (diag) f.ledgeNote = 'agarrou a borda';
  }
  const lg = f.ledge;
  // Fim do estado por causa externa: golpe, lançamento, ação imposta, derrota ou perda do apoio.
  const hurt = !!L.hurtDrops && f.hp < lg.hp0 - 1e-9;
  if (f.flight || f.action || f.hp <= 0 || hurt || f.stun > 1e-8 || f.knockRecovery > 1e-8 || f.push || hasFlag(f, 'stunned')) {
    if (f.flight) {f.ledge = null;f.ledgeCd = L.cooldown;f.ledgeHint = null;return false;}   // um lançamento já criou o próprio voo
    drop(f, f.hp <= 0 ? 'defeated' : 'hit');return true;
  }
  const surf = surfaceById(world, lg);
  if (!surf || Math.abs(surf.top - lg.top) > 1e-6) {drop(f, 'support');return true;}
  if (L.hangDrain > 0 && lg.phase !== 'snap') {f.stamina = Math.max(0, f.stamina - L.hangDrain * dt);f.regenBase = f.stamina;f.regenAge = 0;f.exhausted = f.stamina <= 1e-8;if (f.exhausted) {drop(f, 'exhausted');return true;}}
  lg.t += dt;
  const m = length(cmd.move) > 1 ? scale(cmd.move, 1 / length(cmd.move)) : cmd.move, toward = dot(m, scale(lg.n, -1)), away = dot(m, lg.n);
  let pos = lg.hangPos, y = lg.hangY;
  if (lg.phase === 'snap') {
    const u = smoothstep(clamp(lg.t / Math.max(1e-6, L.snapTime), 0, 1));
    pos = {x: lg.from.x + (lg.hangPos.x - lg.from.x) * u, z: lg.from.z + (lg.hangPos.z - lg.from.z) * u};y = lg.from.y + (lg.hangY - lg.from.y) * u;
    if (lg.t >= L.snapTime - 1e-9) {lg.phase = 'hang';lg.t = 0;}
  } else if (lg.phase === 'hang') {
    lg.hold = L.climbInput !== 0 && toward > .5 ? lg.hold + dt : 0;lg.dropHold = L.dropInput === 1 && away > .5 ? lg.dropHold + dt : 0;
    const dropReq = cmd.guard || cmd.dodge || (L.dropInput === 1 && lg.dropHold >= L.dropHold - 1e-9);
    const climbReq = (L.climbInput !== 1 && !!cmd.jump) || (L.climbInput !== 0 && lg.hold >= L.climbHold - 1e-9);
    if (lg.t >= L.minHang - 1e-9) {
      if (dropReq) {drop(f, 'release');return true;}
      if (climbReq) {
        if (topFree(f, lg, fighters, world)) {lg.phase = 'climb';lg.t = 0;lg.climbT = 0;lg.invuln = L.climbInvuln;moveEvent(f, {result: 'ledgeMantle', x: lg.topPos.x, z: lg.topPos.z});}
        else if (!lg.blocked) {lg.blocked = true;moveEvent(f, {result: 'ledgeBlocked', x: lg.topPos.x, z: lg.topPos.z});}
      }
    }
    if (L.maxHang > 0 && lg.t >= L.maxHang - 1e-9) {drop(f, 'timeout');return true;}
  } else {
    lg.climbT += dt;lg.invuln = Math.max(0, lg.invuln - dt);
    const u = clamp(lg.climbT / Math.max(1e-6, L.climbTime), 0, 1), e = smoothstep(u), h = smoothstep(clamp((u - .35) / .65, 0, 1));
    y = lg.hangY + (lg.top - lg.hangY) * e;pos = {x: lg.hangPos.x + (lg.topPos.x - lg.hangPos.x) * h, z: lg.hangPos.z + (lg.topPos.z - lg.hangPos.z) * h};
    if (u >= 1 - 1e-9) {f.position = pos;f.groundY = y;finishClimb(f, world);return true;}
  }
  f.position = {x: pos.x, z: pos.z};f.groundY = y;f.vaultHeight = 0;f.velocity = vec();f.locomotionVelocity = vec();f.guard = false;f.sprinting = false;f.bufferedTackle = null;
  const face = angleOf(vec(-lg.n.x, -lg.n.z));f.facing = face;f.visualFacing = face;f.state = lg.phase === 'climb' ? 'ledgeClimb' : 'ledgeHang';
  return true;
}
