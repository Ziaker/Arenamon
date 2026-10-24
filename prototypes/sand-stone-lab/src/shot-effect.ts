import * as T from 'three';

// Camada de DISPARO reutilizável (docs/PADRAO_ATELIES_VFX.md):
// shotKind:
//   0 = Nenhum (padrão)
//   1 = Argola
//   2 = Tiro em cone (com afunilamento métrico: raio inicial × raio final sobre distância focal)
//   3 = Burst de vento anime (disco de vácuo, lâminas de ar, speedlines, snap rápido e contorno anime)
//   4 = Jato pressurizado perfurante (feixe em agulha, estrias de cavitação, alta velocidade de ejeção)
//   5 = Impacto estelar em cruz (cruz ortogonal / diamante, núcleo emissivo, centelhas axiais)
//
// O interruptor da fase Disparo (launchOn = 0) desliga tudo.
// Deslocamentos, impulsos e ângulos têm sinal: positivo vai à frente / para cima / para a direita; negativo, o contrário.
type Vec3 = [number, number, number];
type Options = {origin: Vec3; direction: Vec3; follow?: () => Vec3; color?: number; element?: string};
// Tema por elemento (PADRAO §7.3 e anti-«carimbo»): gradiente de 3 níveis (núcleo claro, corpo saturado, rastro escuro) e o tipo de partícula do próprio Move.
// Sem `element` o disparo mantém as cores de quem o chamou.
const THEMES: Record<string, {core: number; body: number; trail: number; particle: string}> = {
  earth: {core: 0xfff0c8, body: 0xd9a05b, trail: 0x4a3826, particle: 'grain'},
  psychic: {core: 0xffe6ff, body: 0xd46ee6, trail: 0x3a1c5a, particle: 'orb'},
  steel: {core: 0xffffff, body: 0xb8c4d6, trail: 0x2b3442, particle: 'streak'},
  star: {core: 0xffffff, body: 0xffd75a, trail: 0x5a3a12, particle: 'star'},
  wind: {core: 0xffffff, body: 0xcfeff5, trail: 0x35505c, particle: 'streak'},
  fighting: {core: 0xfff1d6, body: 0xe86a3c, trail: 0x3a1a14, particle: 'orb'},
};
type Values = Record<string, number>;

export class ShotEffect {
  private ring: T.Mesh | null = null;
  private bladesGroup: T.Group | null = null;
  private crossMesh: T.Group | null = null;
  private recoil: T.Group | null = null;
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

  /** 0 = Nenhum, 1 = Argola, 2 = Cone, 3 = Burst anime, 4 = Jato pressurizado, 5 = Impacto estelar. */
  private get kind() { return Math.max(0, Math.min(5, Math.round(this.values.shotKind ?? 0))); }
  private get enabled() { return this.values.launchOn !== 0; }
  private get theme() { return this.opts.element ? THEMES[this.opts.element] ?? null : null; }
  /** Cor do corpo do disparo: a do tema, senão a de quem chamou, senão o padrão da opção. */
  private body(def: number) { return this.theme?.body ?? this.opts.color ?? def; }
  private get recoilOn() { const v = this.values; return (v.shotRecoilFlash ?? 0) > 0 || (v.shotRecoilHalo ?? 0) > 0 || (v.shotRecoilKick ?? 0) > 0 || (v.shotRecoilWaves ?? 0) >= 1 || (v.shotRecoilPlume ?? 0) >= 1; }
  private anchor(): T.Vector3 {
    return this.base.clone()
      .addScaledVector(this.dir, this.values.shotHorizontal ?? 0)
      .add(new T.Vector3(0, this.values.shotVertical ?? 0, 0));
  }

  /** Dispara no começo da fase Disparo. Fase desligada: não cria nada. */
  fire() {
    if (!this.enabled || this.fired || (this.kind === 0 && !this.recoilOn)) return;
    this.fired = true;this.age = 0;
    if (this.recoilOn) this.fireRecoil();
    if (this.kind === 0) return;
    switch (this.kind) {
      case 1: this.fireRing(); break;
      case 2: this.fireCone(); break;
      case 3: this.fireWindBurst(); break;
      case 4: this.firePiercingJet(); break;
      case 5: this.fireStarburst(); break;
    }
  }

  /** Camada Recoil & Flash (PADRAO §4.6): soma ao disparo escolhido, inclusive com «Nenhum». Tudo nasce desligado (0). */
  private fireRecoil() {
    const v = this.values, a = this.anchor(), g = new T.Group(), core = new T.Color(this.theme?.core ?? 0xffffff), body = new T.Color(this.body(0xffd58a));
    g.name = 'shot-recoil';g.position.copy(a);g.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), this.dir);
    const add = (m: T.Mesh, id: string) => {m.userData.id = id;g.add(m);return m;};
    const basic = (c: T.Color, o: number, mult = 2) => new T.MeshBasicMaterial({color: c.clone().multiplyScalar(mult), transparent: true, opacity: o, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false});
    if ((v.shotRecoilFlash ?? 0) > 0) add(new T.Mesh(new T.SphereGeometry(.12, 12, 8), basic(core, .9, 3)), 'flash');
    if ((v.shotRecoilHalo ?? 0) > 0) add(new T.Mesh(new T.CircleGeometry(Math.max(.02, v.shotRecoilHalo) / 2, 32), basic(body, .4, 1.5)), 'halo');
    if ((v.shotRecoilKick ?? 0) > 0) add(new T.Mesh(new T.SphereGeometry(.1, 12, 8), basic(body, .9)), 'kick');
    for (let i = 0; i < Math.round(v.shotRecoilWaves ?? 0); i++) add(new T.Mesh(new T.TorusGeometry(.15, .012, 6, 40), basic(i % 2 ? body : core, .7)), 'wave' + i);
    this.parent.add(g);this.recoil = g;
    const plume = Math.round(v.shotRecoilPlume ?? 0);
    if (plume >= 1) this.entries.push(this.particles.create({
      kind: this.theme?.particle ?? 'dust', color: this.theme?.body ?? this.opts.color ?? 0xd8c8a8, count: plume, duration: .08, life: .5, size: .12, speed: 2.6, radius: .08, angle: .7, opacity: .8,
      position: [a.x, a.y, a.z], direction: [-this.dir.x, -this.dir.y, -this.dir.z]
    }));
  }

  private updateRecoil(t: number) {
    const g = this.recoil;if (!g) return;
    const v = this.values, a = this.anchor();g.position.copy(a);
    let alive = false;
    for (const m of g.children as T.Mesh[]) {
      const id = m.userData.id as string, mat = m.material as T.MeshBasicMaterial;
      if (id === 'flash') {const k = Math.min(1, t / .18);m.scale.setScalar((.6 + k * 3) * v.shotRecoilFlash);mat.opacity = (1 - k) * Math.min(1, v.shotRecoilFlash) * .9;if (k < 1) alive = true;}
      else if (id === 'halo') {const k = Math.min(1, t / .5);m.scale.setScalar(1 + k * .3);mat.opacity = (1 - k) * .4;if (k < 1) alive = true;}
      else if (id === 'kick') {const k = Math.min(1, t / .35);m.position.z = -v.shotRecoilKick * Math.sin(k * Math.PI);mat.opacity = (1 - k * .6) * .9;if (k < 1) alive = true;}
      else {const q = t - Number(id.slice(4)) * .07, k = Math.max(0, Math.min(1, q / .4));m.visible = q >= 0 && k < 1;m.scale.setScalar(1 + k * 6);mat.opacity = (1 - k) * .7;if (k < 1) alive = true;}
    }
    g.visible = alive;
  }

  private fireRing() {
    const v = this.values, color = this.body(0xffd58a);
    const geo = new T.TorusGeometry(v.shotRadius ?? .4, v.shotThickness ?? .025, 8, 56);
    const mat = new T.MeshBasicMaterial({color: new T.Color(color).multiplyScalar(2), transparent: true, opacity: .9, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false});
    const ring = new T.Mesh(geo, mat);ring.name = 'shot-ring';
    ring.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), this.dir);
    ring.scale.set(1, 1, v.shotSquash ?? 1);
    ring.position.copy(this.anchor());
    if (this.theme) {   // fio interno claro: núcleo / borda incandescente
      const inner = new T.Mesh(new T.TorusGeometry((v.shotRadius ?? .4) * .82, (v.shotThickness ?? .025) * .45, 6, 56), new T.MeshBasicMaterial({color: new T.Color(this.theme.core).multiplyScalar(2), transparent: true, opacity: .9, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false}));
      ring.add(inner);
    }
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
    // Afunilamento métrico: raio inicial v.shotRadius -> raio final v.shotRadiusEnd sobre v.shotFocalDist
    const r0 = v.shotRadius ?? .4, r1 = v.shotRadiusEnd ?? .8, focal = Math.max(.1, v.shotFocalDist ?? 1.5);
    const chokeAngle = Math.max(.05, Math.atan2(Math.abs(r1 - r0), focal));
    const dur = Math.max(.05, v.shotTime ?? .35), n = Math.max(1, Math.round(v.shotCount ?? 60));
    this.entries.push(this.particles.create({
      kind: this.theme?.particle ?? 'orb', color: this.body(0xffd58a), rate: Math.max(1, Math.round(n / dur)), duration: dur, life,
      size: v.shotParticleSize ?? .18, speed, radius: r0 * .25, angle: chokeAngle, opacity: 1, position: [a.x, a.y, a.z], direction: [d.x, d.y, d.z]
    }));
    if (this.theme) this.entries.push(this.particles.create({   // rastro escuro: lê contra fundo claro
      kind: 'dust', color: this.theme.trail, rate: Math.max(1, Math.round(n / dur / 3)), duration: dur, life: life * 1.4,
      size: (v.shotParticleSize ?? .18) * 1.6, speed: speed * .6, radius: r0 * .25, angle: chokeAngle, opacity: .5, position: [a.x, a.y, a.z], direction: [d.x, d.y, d.z]
    }));
  }

  private fireWindBurst() {
    const v = this.values, a = this.anchor();
    const r = v.shotRadius ?? .4, blades = Math.max(3, Math.round(v.shotWindBlades ?? 8));
    const contour = v.shotContour ?? 2, bladeLen = (v.shotLength ?? 1.5) * .7;
    const color = new T.Color(this.body(0xe0f7fa)).multiplyScalar(contour);

    this.bladesGroup = new T.Group();
    this.bladesGroup.name = 'shot-blades';
    this.bladesGroup.position.copy(a);
    this.bladesGroup.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), this.dir);

    // Fitas radiais de vácuo / lâminas curvas
    const curveRad = (v.shotBladeCurve ?? 30) * Math.PI / 180;
    const mat = new T.MeshBasicMaterial({color, transparent: true, opacity: .9, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false});
    for (let i = 0; i < blades; i++) {
      const geo = new T.PlaneGeometry(bladeLen, .05);
      geo.translate(bladeLen * .5, 0, 0);
      const m = new T.Mesh(geo, mat);
      const angle = (i / blades) * Math.PI * 2 + curveRad;
      m.rotation.z = angle;
      this.bladesGroup.add(m);
    }
    if (this.theme) {   // contorno escuro do vácuo atrás das lâminas
      const dark = new T.Mesh(new T.RingGeometry(r * .85, r, 48), new T.MeshBasicMaterial({color: this.theme.trail, transparent: true, opacity: .6, side: T.DoubleSide, depthWrite: false}));
      this.bladesGroup.add(dark);
    }
    this.parent.add(this.bladesGroup);

    // Speedlines e centelhas de vento com Three.quarks
    const snap = Math.max(.04, v.shotSnapTime ?? .12);
    this.entries.push(this.particles.create({
      kind: 'streak', color: this.body(0xe0f7fa), count: blades * 2, duration: snap, life: snap * 1.5,
      size: r * .35, speed: (v.shotRadiusEnd ?? .8) * 5 + (v.shotImpulseH ?? 0), radius: r * .2, angle: Math.PI / 3,
      opacity: 1, position: [a.x, a.y, a.z], direction: [this.dir.x, this.dir.y, this.dir.z]
    }));
  }

  private firePiercingJet() {
    const v = this.values, a = this.anchor();
    const dur = Math.max(.05, v.shotTime ?? .35);
    const r0 = v.shotRadius ?? .4, r1 = v.shotRadiusEnd ?? .1, focal = Math.max(.1, v.shotFocalDist ?? 1.5);
    const speed = (v.shotLength ?? 2.2) * 3 + (v.shotJetPressure ?? 10) + (v.shotImpulseH ?? 0);
    const chokeAngle = Math.max(.02, Math.atan2(Math.abs(r1 - r0), focal));

    // Jato central denso em alta velocidade
    this.entries.push(this.particles.create({
      kind: this.theme?.particle === 'grain' ? 'grain' : 'orb', color: this.body(0x73caff), rate: 70, duration: dur, life: .3,
      size: r1 * .8 + .05, speed, radius: r0 * .15, angle: chokeAngle * .3, opacity: 1,
      position: [a.x, a.y, a.z], direction: [this.dir.x, this.dir.y, this.dir.z]
    }));

    // Estrias axiais de cavitação (streak Quarks)
    const cav = Math.max(1, Math.round(v.shotCavitation ?? 8));
    this.entries.push(this.particles.create({
      kind: 'streak', color: this.theme?.core ?? 0xffffff, rate: cav * 4, duration: dur, life: .25,
      size: .15, speed: speed * 1.25, radius: r0 * .1, angle: .04, opacity: .9,
      position: [a.x, a.y, a.z], direction: [this.dir.x, this.dir.y, this.dir.z]
    }));
  }

  private fireStarburst() {
    const v = this.values, a = this.anchor();
    const armsLen = v.shotCrossArms ?? .8;
    const angleRad = (v.shotCrossAngle ?? 0) * Math.PI / 180;
    const glow = v.shotCoreGlow ?? 2.5;
    const color = new T.Color(this.body(0xfff08a)).multiplyScalar(glow);

    this.crossMesh = new T.Group();
    this.crossMesh.name = 'shot-cross';
    this.crossMesh.position.copy(a);
    this.crossMesh.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), this.dir);
    this.crossMesh.rotation.z = angleRad;

    const mat = new T.MeshBasicMaterial({color, transparent: true, opacity: .95, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false});
    const hArm = new T.Mesh(new T.PlaneGeometry(armsLen * 2, .05), mat);
    const vArm = new T.Mesh(new T.PlaneGeometry(.05, armsLen * 2), mat);
    this.crossMesh.add(hArm, vArm);
    if (this.theme) {   // diamante central claro
      const core = new T.Mesh(new T.PlaneGeometry(.22, .22), new T.MeshBasicMaterial({color: new T.Color(this.theme.core).multiplyScalar(glow), transparent: true, opacity: .95, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false}));
      core.rotation.z = Math.PI / 4;this.crossMesh.add(core);
    }
    this.parent.add(this.crossMesh);

    // Centelhas estelares ortogonais em cruz
    const sparks = Math.max(1, Math.round(v.shotCrossSparks ?? 24));
    this.entries.push(this.particles.create({
      kind: 'star', color: this.body(0xfff08a), count: sparks, duration: .1, life: .35,
      size: .2, speed: armsLen * 3.5 + (v.shotImpulseH ?? 0), radius: .1, angle: Math.PI / 4,
      opacity: 1, position: [a.x, a.y, a.z], direction: [this.dir.x, this.dir.y, this.dir.z]
    }));
  }

  update(dt: number) {
    if (!this.fired) return;
    this.age += dt;
    const v = this.values, follow = v.shotFollow ?? 0;
    if (follow > 0 && this.age <= follow && this.opts.follow) this.base.set(...this.opts.follow());

    const a = this.anchor(), t = this.age;
    const dur = Math.max(.01, v.shotTime ?? .25);

    // Atualização dos emissores Quarks enquanto durar o seguimento
    if (follow > 0 && this.age <= follow && this.opts.follow) {
      for (const e of this.entries) e.emitter.position.copy(a);
    }

    this.updateRecoil(t);

    // 1. Argola
    if (this.ring) {
      const k = Math.min(1, t / dur);
      this.ring.position.copy(a)
        .addScaledVector(this.dir, (v.shotImpulseH ?? 0) * t)
        .add(new T.Vector3(0, (v.shotImpulseV ?? 0) * t, 0));
      const s = 1 + k * .6;this.ring.scale.set(s, s, (v.shotSquash ?? 1));
      (this.ring.material as T.MeshBasicMaterial).opacity = Math.max(0, 1 - k) * .9;
      for (const c of this.ring.children as T.Mesh[]) (c.material as T.MeshBasicMaterial).opacity = Math.max(0, 1 - k) * .9;
      this.ring.visible = k < 1;
    }

    // 3. Burst de vento anime (snap rápido de vácuo)
    if (this.bladesGroup) {
      const snapDur = Math.max(.02, v.shotSnapTime ?? .12);
      const kSnap = Math.min(1, t / snapDur);
      const sSnap = 1 + Math.sin(kSnap * Math.PI * .5) * (v.shotRadiusEnd ?? .8);
      this.bladesGroup.scale.set(sSnap, sSnap, sSnap);
      this.bladesGroup.position.copy(a)
        .addScaledVector(this.dir, (v.shotImpulseH ?? 0) * t)
        .add(new T.Vector3(0, (v.shotImpulseV ?? 0) * t, 0));
      const op = Math.max(0, 1 - kSnap) * .9;
      for (const child of this.bladesGroup.children as T.Mesh[]) {
        if (child.material) (child.material as T.MeshBasicMaterial).opacity = op;
      }
      this.bladesGroup.visible = kSnap < 1;
    }

    // 5. Impacto estelar em cruz
    if (this.crossMesh) {
      const k = Math.min(1, t / dur);
      const s = 1 + k * .8;
      this.crossMesh.scale.set(s, s, s);
      this.crossMesh.position.copy(a)
        .addScaledVector(this.dir, (v.shotImpulseH ?? 0) * t)
        .add(new T.Vector3(0, (v.shotImpulseV ?? 0) * t, 0));
      const op = Math.max(0, 1 - k) * .95;
      for (const child of this.crossMesh.children as T.Mesh[]) {
        if (child.material) (child.material as T.MeshBasicMaterial).opacity = op;
      }
      this.crossMesh.visible = k < 1;
    }
  }

  /** Resultado MEDIDO do disparo (para testes de asserção de sliders). */
  signature(): string {
    const out: unknown[] = [];
    if (this.ring) {
      out.push(['ring', this.ring.position.toArray().map(n => +n.toFixed(4)), this.ring.scale.toArray().map(n => +n.toFixed(4)), +(this.ring.geometry as T.TorusGeometry).parameters.radius.toFixed(4), +(this.ring.geometry as T.TorusGeometry).parameters.tube.toFixed(4), +(this.ring.material as T.MeshBasicMaterial).opacity.toFixed(4), this.ring.visible]);
    }
    if (this.bladesGroup) {
      out.push(['blades', this.bladesGroup.position.toArray().map(n => +n.toFixed(4)), this.bladesGroup.scale.toArray().map(n => +n.toFixed(4)), this.bladesGroup.children.length, this.bladesGroup.visible]);
    }
    if (this.crossMesh) {
      out.push(['cross', this.crossMesh.position.toArray().map(n => +n.toFixed(4)), this.crossMesh.scale.toArray().map(n => +n.toFixed(4)), +this.crossMesh.rotation.z.toFixed(4), this.crossMesh.visible]);
    }
    if (this.recoil) {
      out.push(['recoil', this.recoil.visible, this.recoil.children.map(c => [c.userData.id, ...c.position.toArray().map(n => +n.toFixed(4)), ...c.scale.toArray().map(n => +n.toFixed(4)), +((c as T.Mesh).material as T.MeshBasicMaterial).opacity.toFixed(4), +((c as T.Mesh).geometry as any).boundingSphere?.radius?.toFixed?.(4) ?? 0, c.visible])]);
    }
    for (const e of this.entries) {
      const sys = e.system, dir = new T.Vector3(0, 0, 1).applyQuaternion(e.emitter.quaternion);
      out.push([e.kind ?? 'cone', e.emitter.position.toArray().map((n: number) => +n.toFixed(4)), dir.toArray().map(n => +n.toFixed(4)), +sys.duration.toFixed(4), sys.emissionOverTime?.value ?? 0, +(sys.startSize?.a ?? 0).toFixed(4), +(sys.startSpeed?.b ?? 0).toFixed(4), +(sys.startLife?.b ?? 0).toFixed(4), +(sys.emitterShape?.radius ?? 0).toFixed(4), +(sys.emitterShape?.angle ?? 0).toFixed(4)]);
    }
    return JSON.stringify(out);
  }

  dispose() {
    if (this.recoil) {
      for (const c of this.recoil.children as T.Mesh[]) {c.geometry?.dispose();(c.material as T.Material)?.dispose();}
      this.recoil.removeFromParent();this.recoil = null;
    }
    if (this.ring) {
      this.ring.removeFromParent();
      this.ring.geometry.dispose();
      (this.ring.material as T.Material).dispose();
      this.ring = null;
    }
    if (this.bladesGroup) {
      for (const c of this.bladesGroup.children as T.Mesh[]) {
        c.geometry?.dispose();
        (c.material as T.Material)?.dispose();
      }
      this.bladesGroup.removeFromParent();
      this.bladesGroup = null;
    }
    if (this.crossMesh) {
      for (const c of this.crossMesh.children as T.Mesh[]) {
        c.geometry?.dispose();
        (c.material as T.Material)?.dispose();
      }
      this.crossMesh.removeFromParent();
      this.crossMesh = null;
    }
    for (const e of this.entries) {
      this.particles.renderer.deleteSystem(e.system);
      e.emitter.removeFromParent();
      e.system.dispose();
      const i = this.particles.systems.indexOf(e);
      if (i >= 0) this.particles.systems.splice(i, 1);
    }
    this.entries.length = 0;
  }
}
