// Câmera de combate em terceira pessoa (porto do v6): zona morta no lock-on, recentralização sem alvo,
// elevação durante voos e enquadramento dos dois lutadores.
import {C} from '../sim/config.js';
import {vec, add, scale, sub, length, normalize, clamp, angleOf, direction, angleDelta} from '../sim/math.js';

export class CameraRig {
  constructor() {this.reset(null);this.initialized = false;}
  reset(player) {
    const K = C.camera;this.yaw = K.initialYaw;this.desiredYaw = this.yaw;this.yawVelocity = 0;this.distance = K.distance;this.zoom = K.distance;
    this.anchor = player ? {...player.position} : vec();this.manualLeft = 0;this.airLift = 0;this.idleTime = 0;this.focusOffset = vec();this.initialized = !!player;
  }
  orbit(radians) {this.desiredYaw += radians;this.manualLeft = C.camera.manualHold;}
  zoomBy(amount) {this.zoom = clamp(this.zoom + amount, C.camera.minDistance, C.camera.maxDistance);}
  step(player, target, locked, dt) {
    const K = C.camera, X = C.extras.cameraExtra, T = C.extras.toggles;
    if (!this.initialized) this.reset(player);
    this.manualLeft = Math.max(0, this.manualLeft - dt);
    const toTarget = sub(target.position, player.position), separation = length(toTarget);
    const moving = length(player.desiredMove) > .01 || !!player.action;
    // Com alvo: segue o adversário dentro de uma zona morta conservadora, não a cada strafe.
    if (locked && this.manualLeft === 0 && separation > K.closeRange) {
      const behind = angleOf(toTarget) + Math.PI, diff = angleDelta(this.desiredYaw, behind), dead = moving ? K.movingDeadZone : K.deadZone;
      if (Math.abs(diff) > dead) this.desiredYaw += diff - Math.sign(diff) * dead;
    }
    // Sem alvo: recentraliza atrás do personagem só depois que ele para.
    if (!locked && this.manualLeft === 0) {
      this.idleTime = moving ? 0 : this.idleTime + dt;
      if (T.enableCameraRecenter && this.idleTime > X.idleAlignDelay) {const align = angleDelta(this.desiredYaw, player.facing + Math.PI);this.desiredYaw += align * Math.min(1, dt * X.idleAlignSpeed);}
    } else this.idleTime = 0;
    const yawError = angleDelta(this.yaw, this.desiredYaw), rate = locked ? K.maxTurnRate : K.maxTurnRate * X.unlockedTurnMultiplier;
    this.yawVelocity = clamp(yawError * K.yawResponse, -rate, rate);this.yaw += this.yawVelocity * dt;
    if (T.enableCameraFollow) this.anchor = add(this.anchor, scale(sub(player.position, this.anchor), 1 - Math.exp(-K.followResponse * dt)));
    const lift = Math.max(player.flight?.y ?? 0, target.flight?.y ?? 0, player.vaultHeight ?? 0, target.vaultHeight ?? 0);
    this.airLift += (lift - this.airLift) * (1 - Math.exp(-X.verticalFollow * dt));
    const focus = locked ? scale(normalize(toTarget), Math.min(X.lockBiasLimit, separation * X.lockTargetBias)) : vec();
    this.focusOffset = add(this.focusOffset, scale(sub(focus, this.focusOffset), 1 - Math.exp(-K.followResponse * dt)));
    const base = this.zoom + (locked ? Math.max(0, separation - K.framingRange) * K.distanceScale : 0);
    const framing = locked ? Math.max(base, separation * X.framingSeparationFactor + X.framingPadding) : base;
    const goal = clamp(framing + this.airLift * X.flightZoomFactor, K.minDistance, K.maxDistance);
    this.distance += (goal - this.distance) * (1 - Math.exp(-K.distanceResponse * dt));
  }
  pose() {
    const K = C.camera, X = C.extras.cameraExtra, back = direction(this.yaw), right = vec(back.z, -back.x), shoulder = scale(right, K.shoulder);
    return {position: add(add(this.anchor, scale(back, this.distance)), shoulder), height: K.height + this.airLift * X.flightHeightFactor,
      lookAt: add(add(add(this.anchor, scale(back, -K.lookAhead)), shoulder), this.focusOffset), lookHeight: K.lookHeight + this.airLift * X.flightLookFactor};
  }
  save() {const {yaw, desiredYaw, yawVelocity, distance, zoom, anchor, manualLeft, airLift, idleTime, focusOffset, initialized} = this;return structuredClone({yaw, desiredYaw, yawVelocity, distance, zoom, anchor, manualLeft, airLift, idleTime, focusOffset, initialized});}
  load(s) {Object.assign(this, structuredClone(s));}
  snapshot() {return {...this.save(), ...this.pose()};}
}
