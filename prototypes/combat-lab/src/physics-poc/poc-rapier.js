// @ts-check
// Fase 5: o MESMO cenário em Rapier (API JS/TS direta, sem React). Personagem = KinematicCharacterController com colisor
// de caixa (mesmo volume do Arenamon). Gravidade, salto variável e controle aéreo reproduzem as constantes do jogo (C.map);
// o que se compara é a camada de COLISÃO/GRAVIDADE, não o "feeling" (que continuaria sendo do Arenamon).
import {C} from '../sim/config.js';
import {DT, HALF, BODY_H, commandAt} from './poc-scenarios.js';
import {summarize} from './poc-metrics.js';

/** Parâmetros ajustáveis do experimento (o laboratório expõe todos). */
export const rapierDefaults = () => ({skin: 0.01, snapDistance: .15, autostep: 0, autostepHeight: .25, maxSlope: 60, ccd: 1, shape: 'box'});

export class RapierSim {
  /** @param {any} RAPIER @param {any} sc @param {ReturnType<typeof rapierDefaults>} [opts] */
  constructor(RAPIER, sc, opts = rapierDefaults()) {
    this.R = RAPIER;this.sc = sc;this.opts = opts;this.tick = 0;
    this.world = new RAPIER.World({x: 0, y: 0, z: 0});   // gravidade aplicada à mão (mesma curva assimétrica do Arenamon)
    this.world.timestep = DT;
    this.build();
  }
  build() {
    const R = this.R, w = this.world;
    // chão: laje larga com topo em y = 0
    w.createCollider(R.ColliderDesc.cuboid(60, .5, 60).setTranslation(0, -.5, 0));
    for (const s of this.sc.solids) {
      const h = (s.top - s.base) / 2, cy = s.base + h;
      const d = s.shape === 'cyl' ? R.ColliderDesc.cylinder(h, s.r) : R.ColliderDesc.cuboid(s.hx, h, s.hz);
      w.createCollider(d.setTranslation(s.x, cy, s.z));
    }
    const sy = this.sc.start.y;
    const body = w.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(this.sc.start.x, (this.sc.launch ? .01 : sy) + BODY_H / 2, this.sc.start.z).setCcdEnabled(!!this.opts.ccd));
    // Forma do personagem: caixa (igual ao volume do Arenamon) ou cápsula (raio = meia largura; contorna cilindros sem travar).
    const shape = this.opts.shape === 'capsule' ? R.ColliderDesc.capsule(BODY_H / 2 - HALF, HALF) : R.ColliderDesc.cuboid(HALF, BODY_H / 2, HALF);
    this.body = body;this.collider = w.createCollider(shape, body);
    this.makeController();
    const standing = sy === 0 || this.sc.solids.some(s => Math.abs(s.top - sy) < 1e-6);
    this.st = {vx: 0, vy: 0, vz: 0, grounded: standing && !this.sc.launch, ballistic: false, jumpCool: 0, buf: 0, wasGrounded: true};
    if (this.sc.launch) this.st = {...this.st, vx: this.sc.launch.vx, vz: this.sc.launch.vz, vy: 3, grounded: false, ballistic: true, wasGrounded: true};
  }
  makeController() {
    const o = this.opts, c = this.world.createCharacterController(o.skin);
    c.setUp({x: 0, y: 1, z: 0});c.setMaxSlopeClimbAngle(o.maxSlope * Math.PI / 180);c.setMinSlopeSlideAngle(80 * Math.PI / 180);
    c.setApplyImpulsesToDynamicBodies(false);
    if (o.snapDistance > 0) c.enableSnapToGround(o.snapDistance); else c.disableSnapToGround();
    if (o.autostep) c.enableAutostep(o.autostepHeight, .2, false); else c.disableAutostep();
    this.ctrl = c;
  }
  pos() {const t = this.body.translation();return {x: t.x, y: t.y - BODY_H / 2, z: t.z};}
  /** Um passo de 1/120 s com o comando do tick. */
  step(cmd) {
    const M = C.map, L = C.locomotion, st = this.st, speed = C.test.speed ?? 4.8;
    st.jumpCool = Math.max(0, st.jumpCool - DT);
    if (cmd.jump) st.buf = M.jumpBufferWindow ?? .12;else st.buf = Math.max(0, st.buf - DT);   // jump buffering, como no Arenamon
    if (!st.ballistic) {
      // horizontal: no chão acelera até speed·dir; no ar, aceleração de controle aéreo limitada (mesmas constantes do salto)
      const dx = cmd.move[0], dz = cmd.move[1], mag = Math.hypot(dx, dz), tx = mag > 0 ? dx / mag * speed : 0, tz = mag > 0 ? dz / mag * speed : 0;
      const acc = (st.grounded ? (mag > 0 ? L.acceleration : L.braking) : M.jumpAirAccel) * DT;
      const ex = tx - st.vx, ez = tz - st.vz, el = Math.hypot(ex, ez);
      if (el > 1e-9) {const k = Math.min(1, acc / el);st.vx += ex * k;st.vz += ez * k;}
    }
    // vertical: salto (altura de C.map.jumpHeight), gravidade assimétrica e corte ao soltar
    if (st.buf > 0 && st.grounded && st.jumpCool <= 0 && !st.ballistic) {st.vy = Math.sqrt(2 * M.jumpGravityUp * M.jumpHeight);st.grounded = false;st.buf = 0;}
    if (!st.grounded || st.vy > 0) {
      const g = st.ballistic ? C.rules.launchGravity : st.vy > 0 ? (cmd.held ? M.jumpGravityUp : M.jumpGravityUp * M.jumpReleaseMult) : M.jumpGravityDown;
      st.vy -= g * DT;
      if (!st.ballistic && st.vy < -M.jumpMaxFallSpeed) st.vy = -M.jumpMaxFallSpeed;
    } else st.vy = 0;   // no chão: o snap-to-ground do controlador mantém o contato
    const desired = {x: st.vx * DT, y: st.vy * DT, z: st.vz * DT};
    this.ctrl.computeColliderMovement(this.collider, desired);
    const m = this.ctrl.computedMovement(), p = this.body.translation();
    this.body.setNextKinematicTranslation({x: p.x + m.x, y: p.y + m.y, z: p.z + m.z});
    // reações às colisões do controlador: só zera a velocidade quando o movimento foi realmente barrado (> 5 %)
    const blocked = (a, b) => Math.abs(a - b) > Math.max(1e-4, .05 * Math.abs(b));
    if (blocked(m.x, desired.x)) st.vx = m.x / DT;
    if (blocked(m.z, desired.z)) st.vz = m.z / DT;
    // teto: contato cuja normal (no personagem) aponta para baixo enquanto sobe
    if (desired.y > 0) for (let i = 0, n = this.ctrl.numComputedCollisions(); i < n; i++) if (this.ctrl.computedCollision(i).normal1.y < -.7) {st.vy = 0;break;}
    const grounded = this.ctrl.computedGrounded();
    if (grounded && st.vy <= 0) {
      st.grounded = true;st.vy = 0;st.ballistic = false;
      if (!st.wasGrounded) st.jumpCool = M.jumpInterval ?? .12;
    } else if (!grounded) st.grounded = false;
    st.wasGrounded = st.grounded;
    this.world.step();
    this.tick++;
  }
  snapshot() {return {world: this.world.takeSnapshot(), st: {...this.st}, tick: this.tick, handles: {body: this.body.handle, collider: this.collider.handle}};}
  restore(s) {
    this.ctrl?.free?.();this.world?.free?.();
    this.world = this.R.World.restoreSnapshot(s.world);
    this.world.timestep = DT;
    this.body = this.world.getRigidBody(s.handles.body);this.collider = this.world.getCollider(s.handles.collider);
    this.makeController();this.st = {...s.st};this.tick = s.tick;
  }
  /** Libera a memória WASM (idempotente: chamar duas vezes é seguro). */
  dispose() {this.ctrl?.free?.();this.world?.free?.();this.ctrl = null;this.world = null;}
}

/** @param {any} RAPIER @param {any} sc */
export function runRapier(RAPIER, sc, {opts = rapierDefaults(), snapshotAt = null} = {}) {
  const sim = new RapierSim(RAPIER, sc, opts), trace = [];let snap = null;
  for (let t = 0; t < sc.ticks; t++) {
    if (snapshotAt === t) snap = sim.snapshot();
    sim.step(commandAt(sc, t));
    trace.push(sim.pos());
  }
  return {engine: 'rapier', trace, sim, snap, ...summarize(trace, sc.solids, opts.shape === 'capsule' ? 'capsule' : 'box')};
}
