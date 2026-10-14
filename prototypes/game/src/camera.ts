import { CAMERA } from './config';
import { Fighter } from './entity';
import { Vec, add, angle, clamp, delta, direction, length, scale, sub, vec } from './math';

// Fixed-step camera rig. Rendering consumes this state; it never feeds back mesh yaw.
export class CombatCamera {
  yaw = CAMERA.initialYaw; desiredYaw = this.yaw; yawVelocity = 0;
  distance: number = CAMERA.distance; zoom: number = CAMERA.distance;
  anchor: Vec = vec(); manualLeft = 0; initialized = false;
  reset(player: Fighter) {
    this.yaw = CAMERA.initialYaw; this.desiredYaw = this.yaw; this.yawVelocity = 0;
    this.distance = CAMERA.distance; this.zoom = CAMERA.distance;
    this.anchor = { ...player.position }; this.manualLeft = 0; this.initialized = true;
  }
  orbit(radians: number) { this.desiredYaw += radians; this.manualLeft = CAMERA.manualHold; }
  zoomBy(amount: number) { this.zoom = clamp(this.zoom + amount, CAMERA.minDistance, CAMERA.maxDistance); }
  step(player: Fighter, target: Fighter, locked: boolean, dt: number) {
    if (!this.initialized) this.reset(player);
    this.manualLeft = Math.max(0, this.manualLeft - dt);
    const offset = sub(target.position, player.position), separation = length(offset);
    const locomoting = length(player.desiredMove) > .01 || !!player.action;
    if (locked && this.manualLeft === 0 && separation > CAMERA.closeRange) {
      const behindTarget = angle(offset) + Math.PI;
      const difference = delta(this.desiredYaw, behindTarget);
      // Lateral movement has a wide dead zone: no camera orbit for every strafe.
      const deadZone = locomoting ? CAMERA.movingDeadZone : CAMERA.deadZone;
      if (Math.abs(difference) > deadZone) this.desiredYaw += difference - Math.sign(difference) * deadZone;
    }
    const error = delta(this.yaw, this.desiredYaw);
    this.yawVelocity = clamp(error * CAMERA.yawResponse, -CAMERA.maxTurnRate, CAMERA.maxTurnRate);
    this.yaw += this.yawVelocity * dt;
    const follow = 1 - Math.exp(-CAMERA.followResponse * dt);
    this.anchor = add(this.anchor, scale(sub(player.position, this.anchor), follow));
    const desiredDistance = clamp(this.zoom + (locked ? Math.max(0, separation - CAMERA.framingRange) * CAMERA.distanceScale : 0), CAMERA.minDistance, CAMERA.maxDistance);
    this.distance += (desiredDistance - this.distance) * (1 - Math.exp(-CAMERA.distanceResponse * dt));
  }
  pose() {
    const back = direction(this.yaw), right = vec(back.z, -back.x);
    const shoulder = scale(right, CAMERA.shoulder);
    return {
      position: add(add(this.anchor, scale(back, this.distance)), shoulder), height: CAMERA.height,
      lookAt: add(add(this.anchor, scale(back, -CAMERA.lookAhead)), shoulder), lookHeight: CAMERA.lookHeight,
    };
  }
  snapshot() { return { yaw: this.yaw, desiredYaw: this.desiredYaw, yawVelocity: this.yawVelocity,
    distance: this.distance, zoom: this.zoom, anchor: { ...this.anchor }, ...this.pose() }; }
}
