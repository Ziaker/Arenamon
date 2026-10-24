import * as T from 'three';

// Camada de DISPARO reutilizável (docs/PADRAO_ATELIES_VFX.md §3): «Argola» (anel que sai da origem) ou «Tiro em cone» (jato de partículas Quarks).
// shotKind: 0 Nenhum (padrão, não muda o visual atual), 1 Argola, 2 Tiro em cone; o interruptor da fase Disparo (launchOn = 0) desliga tudo. A camada só LÊ os valores: os dois tipos guardam os próprios números ao trocar de opção.
// Deslocamentos, impulsos e ângulos têm sinal: positivo vai à frente / para cima / para a direita; negativo, o contrário.
type Vec3 = [number, number, number];
type Options = {origin: Vec3; direction: Vec3; follow?: () => Vec3; color?: number};
type Values = Record<string, number>;

export class ShotEffect {
  private ring: T.Mesh | null = null;
  private age = 0;
  private fired = false;
  private readonly entries: any[] = [];
  private readonly dir: T.Vector3;
  private base: T.Vector3;
  private readonly parent: T.Object3D;
  private readonly particles: any;
  private readonly values: Values;
  private readonly opts: Options;
  constructor(parent: T.Object3D, particles: any, values: Values, opts: Options) {
    this.parent = parent;this.particles = particles;this.values = values;this.opts = opts;
    this.dir = new T.Vector3(...opts.direction).normalize();
    this.base = new T.Vector3(...opts.origin);
  }
  /** 0 = Nenhum, 1 = Argola, 2 = Tiro em cone. */
  private get kind() { return Math.max(0, Math.min(2, Math.round(this.values.shotKind ?? 0))); }
  private get enabled() { return this.values.launchOn !== 0; }
  private anchor(): T.Vector3 { return this.base.clone().addScaledVector(this.dir, this.values.shotHorizontal ?? 0).add(new T.Vector3(0, this.values.shotVertical ?? 0, 0)); }

  /** Dispara no começo da fase Disparo. Fase desligada: não cria nada. */
  fire() {
    if (!this.enabled || this.kind === 0 || this.fired) return;
    this.fired = true;this.age = 0;
    if (this.kind === 1) this.fireRing();else this.fireCone();
  }
  private fireRing() {
    const v = this.values, color = this.opts.color ?? 0xffd58a;
    const geo = new T.TorusGeometry(v.shotRadius ?? .4, v.shotThickness ?? .025, 8, 56);
    const mat = new T.MeshBasicMaterial({color: new T.Color(color).multiplyScalar(2), transparent: true, opacity: .9, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false});
    const ring = new T.Mesh(geo, mat);ring.name = 'shot-ring';
    ring.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), this.dir);
    ring.scale.set(1, 1, v.shotSquash ?? 1);
    ring.position.copy(this.anchor());
    this.parent.add(ring);this.ring = ring;
  }
  private fireCone() {
    const v = this.values, life = v.shotParticleLife ?? .4;
    const yaw0 = Math.atan2(this.dir.x, this.dir.z), pitch0 = Math.asin(Math.max(-1, Math.min(1, this.dir.y)));
    let speed = (v.shotLength ?? 1) / life + (v.shotImpulseH ?? 0);
    const tilt = Math.atan2(v.shotImpulseV ?? 0, Math.max(.1, Math.abs(speed)));
    const yaw = yaw0 + (v.shotAngleH ?? 0) * Math.PI / 180, pitch = pitch0 + (v.shotAngleV ?? 0) * Math.PI / 180 + tilt;
    const d = new T.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    if (speed < 0) {d.negate();speed = -speed;}
    const a = this.anchor();
    this.entries.push(this.particles.create({kind: 'grain', color: this.opts.color ?? 0xffd58a, count: Math.round(v.shotCount ?? 35), duration: .05, life,
      size: v.shotParticleSize ?? .07, speed, radius: (v.shotRadius ?? .4) * .25, angle: .35, opacity: .85, position: [a.x, a.y, a.z], direction: [d.x, d.y, d.z]}));
  }
  update(dt: number) {
    if (!this.fired) return;
    this.age += dt;
    const v = this.values, follow = v.shotFollow ?? 0;
    if (follow > 0 && this.age <= follow && this.opts.follow) this.base.set(...this.opts.follow());
    if (!this.ring) return;
    const t = this.age, dur = Math.max(.01, v.shotTime ?? .25), k = Math.min(1, t / dur);
    this.ring.position.copy(this.anchor()).addScaledVector(this.dir, (v.shotImpulseH ?? 0) * t).add(new T.Vector3(0, (v.shotImpulseV ?? 0) * t, 0));
    const s = 1 + k * .6;this.ring.scale.set(s, s, (v.shotSquash ?? 1));
    (this.ring.material as T.MeshBasicMaterial).opacity = Math.max(0, 1 - k) * .9;
    this.ring.visible = k < 1;
  }
  dispose() {
    if (this.ring) {this.ring.removeFromParent();this.ring.geometry.dispose();(this.ring.material as T.Material).dispose();this.ring = null;}
    for (const e of this.entries) {
      this.particles.renderer.deleteSystem(e.system);e.emitter.removeFromParent();e.system.dispose();
      const i = this.particles.systems.indexOf(e);if (i >= 0) this.particles.systems.splice(i, 1);
    }
    this.entries.length = 0;
  }
}
