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

// ---- Formas de anime (cel-shading): lâmina em crescente e estrela de 4 pontas -------------------------------------------------------------
const CEL_VERT = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
// núcleo branco no centro, corpo na cor do elemento, borda escura (rastro): três faixas duras, como no desenho de anime
const CEL_FRAG = 'varying vec2 vUv;uniform vec3 core;uniform vec3 body;uniform vec3 rim;uniform float fade;uniform float taper;uniform float time;void main(){float across=abs(vUv.y*2.-1.);float lim=mix(1.,clamp(vUv.x,0.,1.),taper);float a=across/max(lim,.001);if(a>1.)discard;float st=sin(vUv.x*16.-time*34.+vUv.y*4.);vec3 c=a<.3?core:(a<.74?(st>.82?core:body):rim);gl_FragColor=vec4(c,fade*(.3+.7*vUv.x));}';
function celMaterial(core: T.Color, body: T.Color, rim: T.Color, taper: number) {
  return new T.ShaderMaterial({uniforms: {core: {value: core}, body: {value: body}, rim: {value: rim}, fade: {value: 1}, taper: {value: taper}, time: {value: 0}}, vertexShader: CEL_VERT, fragmentShader: CEL_FRAG, transparent: true, depthWrite: false, side: T.DoubleSide});
}
/** Lâmina de vento: arco de círculo (crescente) afinando nas duas pontas; o centro vai à frente e as pontas ficam para trás. uv.x: 0 nas pontas, 1 no centro. */
function crescentGeometry(radius: number, sweep: number, width: number, seg = 20) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const s = i / seg * 2 - 1, a = s * sweep, cx = radius * Math.sin(a), cz = -radius * (1 - Math.cos(a)), nx = Math.sin(a), nz = Math.cos(a);
    const w = width * Math.pow(Math.max(0, 1 - s * s), .75) / 2, x = 1 - Math.abs(s);
    pos.push(cx + nx * w * .12, 0, cz + nz * w * .12, cx - nx * w * 1.88, 0, cz - nz * w * 1.88);uv.push(x, 1, x, 0);
    if (i < seg) {const k = i * 2;idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);}
  }
  const g = new T.BufferGeometry();g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));g.setIndex(idx);return g;
}
/** Estrela de quatro pontas finas (agulhas): pontas em 0°, 90°, 180° e 270° (+rot), cintura fina entre elas. */
function starGeometry(outer: number, inner: number, rot = 0) {
  const sh = new T.Shape();
  for (let i = 0; i < 8; i++) {const a = i * Math.PI / 4 + rot, r = i % 2 ? inner : outer, x = Math.cos(a) * r, y = Math.sin(a) * r;if (i) sh.lineTo(x, y);else sh.moveTo(x, y);}
  sh.closePath();return new T.ShapeGeometry(sh);
}
/** Explosão irregular de espinhos duros (a forma desenhada à mão dos impactos de mangá). */
function jaggedGeometry(spikes: number, inner: number, lo: number, hi: number, seed: number) {
  let q = seed;const rnd = () => (q = (Math.imul(q, 1664525) + 1013904223) >>> 0) / 4294967296;
  const sh = new T.Shape();
  for (let i = 0; i < spikes * 2; i++) {const a = i * Math.PI / spikes, r = i % 2 ? inner * (.8 + rnd() * .4) : lo + (hi - lo) * rnd(), x = Math.cos(a) * r, y = Math.sin(a) * r;if (i) sh.lineTo(x, y);else sh.moveTo(x, y);}
  sh.closePath();return new T.ShapeGeometry(sh);
}
/** Linhas de ação radiais (mangá): fios finos que saem do centro, cada um com comprimento próprio. */
function radialLinesGeometry(n: number, r0: number, r1: number, seed: number) {
  let q = seed;const rnd = () => (q = (Math.imul(q, 1664525) + 1013904223) >>> 0) / 4294967296;
  const pos: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i + rnd() * .6) / n * Math.PI * 2, L = r0 + (r1 - r0) * (.35 + .65 * rnd()), b = r0 * (1 + rnd() * .4), da = .012 + .012 * rnd();
    pos.push(Math.cos(a - da) * b, Math.sin(a - da) * b, 0, Math.cos(a + da) * b, Math.sin(a + da) * b, 0, Math.cos(a) * L, Math.sin(a) * L, 0);
  }
  const g = new T.BufferGeometry();g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));return g;
}
const ease = (k: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
const back = (k: number) => {const c = 1.9, x = Math.max(0, Math.min(1, k)) - 1;return 1 + (c + 1) * x * x * x + c * x * x;};
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
  private flat: T.Group | null = null;
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
    const r = v.shotRadius ?? .4, n = Math.max(3, Math.round(v.shotWindBlades ?? 8)), contour = v.shotContour ?? 2, len = v.shotLength ?? 1.5, rEnd = v.shotRadiusEnd ?? .8;
    const th = this.theme, bodyC = new T.Color(this.body(0xcfeff5)), coreC = new T.Color(th?.core ?? 0xffffff).multiplyScalar(contour), rimC = new T.Color(th?.trail ?? 0x35505c);
    const g = new T.Group();g.name = 'shot-blades';g.position.copy(a);g.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), this.dir);
    const bladeMat = celMaterial(coreC, bodyC, rimC, 0), lineMat = celMaterial(coreC, bodyC, rimC, 1);
    const twist = (v.shotBladeCurve ?? 30) * Math.PI / 180, snap = Math.max(.04, v.shotSnapTime ?? .12);
    const crescent = crescentGeometry(r * 1.5 + .35, 1.1, .26 + .06 * contour), plane = new T.PlaneGeometry(1, 1);
    // lâminas em crescente ao redor do eixo, cada uma com tamanho e atraso próprios
    for (let i = 0; i < n; i++) {
      const pivot = new T.Group(), tw = new T.Group(), m = new T.Mesh(crescent, bladeMat);
      m.rotation.z = Math.PI / 2;tw.rotation.x = twist;tw.add(m);pivot.add(tw);pivot.name = 'blade';
      pivot.userData = {phi: i / n * Math.PI * 2, tw, size: .75 + (i % 3) * .17, lag: (i % 2) * .1};g.add(pivot);
    }
    // linhas de velocidade: faixas finas que afinam para trás, correndo ao longo do eixo
    const lines = n * 2;
    for (let i = 0; i < lines; i++) {
      const pivot = new T.Group(), tw = new T.Group(), m = new T.Mesh(plane, lineMat);
      m.rotation.y = -Math.PI / 2;m.scale.set(len * (.5 + (i % 3) * .22), .018 + .012 * contour, 1);tw.add(m);pivot.add(tw);pivot.name = 'line';
      pivot.userData = {phi: (i + .5) / lines * Math.PI * 2 + .2, tw, mesh: m, rho: .75 + (i % 3) * .25, lag: (i % 3) * .05};g.add(pivot);
    }
    // anel de choque fino e branco
    const ring = new T.Mesh(new T.RingGeometry(.93, 1, 64), new T.MeshBasicMaterial({color: new T.Color(th?.core ?? 0xffffff).multiplyScalar(2), transparent: true, opacity: .85, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false}));
    ring.name = 'ring';g.add(ring);
    g.userData = {r, len, rEnd, life: Math.max(.2, snap * 2.2 + .12), twist, bladeMat, lineMat};
    this.parent.add(g);this.bladesGroup = g;
    // linhas de ação radiais (mangá), sempre voltadas para a câmera
    const flat = new T.Group();flat.name = 'shot-actionlines';flat.position.copy(a);
    const lines3 = new T.Mesh(radialLinesGeometry(n * 3, r * .7, r * 2.2 + len * .6, 7), new T.MeshBasicMaterial({color: new T.Color(th?.core ?? 0xffffff).multiplyScalar(2), transparent: true, opacity: .9, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false}));
    lines3.onBeforeRender = (_r, _s, cam) => {flat.quaternion.copy(cam.quaternion);};
    flat.add(lines3);this.parent.add(flat);this.flat = flat;
    // fagulhas de vento (Quarks)
    this.entries.push(this.particles.create({
      kind: 'streak', color: this.body(0xcfeff5), count: n * 2, duration: snap, life: snap * 1.5,
      size: r * .35, speed: rEnd * 5 + (v.shotImpulseH ?? 0), radius: r * .2, angle: Math.PI / 3,
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
    const arms = v.shotCrossArms ?? .8, glow = v.shotCoreGlow ?? 2.5, th = this.theme;
    const bodyC = new T.Color(this.body(0xfff08a)).multiplyScalar(glow), coreC = new T.Color(th?.core ?? 0xffffff).multiplyScalar(glow);
    const mat = (c: T.Color, o = 1) => new T.MeshBasicMaterial({color: c, transparent: true, opacity: o, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false});
    // grupo que sempre encara a câmera (a estrela é um desenho plano; de lado ela sumiria)
    const g = new T.Group();g.name = 'shot-cross';g.position.copy(a);
    const spin = new T.Group();spin.name = 'spin';spin.rotation.z = (v.shotCrossAngle ?? 0) * Math.PI / 180;g.add(spin);
    const body = new T.Mesh(starGeometry(arms, arms * .17), mat(bodyC));body.name = 'star-body';
    const diag = new T.Mesh(starGeometry(arms * .5, arms * .06, Math.PI / 4), mat(bodyC.clone().multiplyScalar(.8), .9));diag.name = 'star-diag';
    const core = new T.Mesh(starGeometry(arms * .6, arms * .2), mat(coreC));core.name = 'star-core';core.position.z = .002;
    const flash = new T.Mesh(new T.CircleGeometry(arms * .12, 28), mat(coreC));flash.name = 'flash';flash.position.z = .004;
    const jag = new T.Mesh(jaggedGeometry(11, arms * .22, arms * .45, arms * .85, 11), mat(bodyC.clone().multiplyScalar(.55), .7));jag.name = 'jag';jag.position.z = -.002;
    spin.add(jag, body, diag, core, flash);
    const lines = new T.Mesh(radialLinesGeometry(28, arms * .5, arms * 1.9, 3), mat(coreC.clone().multiplyScalar(.7), .85));lines.name = 'lines';lines.position.z = -.004;g.add(lines);
    const ring = new T.Mesh(new T.RingGeometry(.94, 1, 56), mat(bodyC.clone().multiplyScalar(.7), .8));ring.name = 'ring';g.add(ring);
    body.onBeforeRender = (_r, _s, cam) => {g.quaternion.copy(cam.quaternion);};
    g.userData = {spin, arms, angle: (v.shotCrossAngle ?? 0) * Math.PI / 180};
    this.parent.add(g);this.crossMesh = g;
    const sparks = Math.max(1, Math.round(v.shotCrossSparks ?? 24));
    this.entries.push(this.particles.create({
      kind: 'star', color: this.body(0xfff08a), count: sparks, duration: .1, life: .35,
      size: .2, speed: arms * 3.5 + (v.shotImpulseH ?? 0), radius: .1, angle: Math.PI / 4,
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

    // 3. Burst de vento anime: lâminas em crescente que abrem e giram, linhas de velocidade e anel de choque
    if (this.bladesGroup) {
      const g = this.bladesGroup, u = g.userData, k = Math.min(1, t / u.life), imp = v.shotImpulseH ?? 0;
      const base = u.r * .5, far = u.r + u.rEnd * 1.8;
      for (const c of g.children as T.Group[]) {
        const d = c.userData, kk = Math.min(1, Math.max(0, (t - (d.lag ?? 0)) / u.life)), e = ease(kk);
        if (c.name === 'blade') {
          d.tw.position.set(base + (far - base) * e, 0, u.len * .5 * e + imp * t);d.tw.scale.set(d.size * (.5 + .5 * e), d.size * (.5 + .5 * e), d.size * (.6 + 1.6 * e));c.rotation.z = d.phi + u.twist * 1.6 * e;
        } else if (c.name === 'line') {
          d.tw.position.set(u.r * d.rho + u.rEnd * 1.1 * e, 0, 0);d.mesh.position.z = u.len * (.15 + .9 * e) + imp * t;c.rotation.z = d.phi + u.twist * .8 * e;
        } else if (c.name === 'ring') {
          const s = u.r * (.4 + e * (u.rEnd * 1.1 + .5));c.scale.set(s, s, s);(c as unknown as T.Mesh).material = (c as unknown as T.Mesh).material;((c as unknown as T.Mesh).material as T.MeshBasicMaterial).opacity = Math.pow(1 - k, 2) * .5;
        }
      }
      g.position.copy(a).add(new T.Vector3(0, (v.shotImpulseV ?? 0) * t, 0));
      u.bladeMat.uniforms.fade.value = Math.pow(1 - k, 1.2);u.lineMat.uniforms.fade.value = Math.pow(1 - k, 1.2) * .9;
      u.bladeMat.uniforms.time.value = t;u.lineMat.uniforms.time.value = t;
      if (this.flat) {
        const fk = Math.min(1, t / (u.life * .55)), m = (this.flat.children[0] as T.Mesh);
        this.flat.position.copy(g.position);this.flat.scale.setScalar(.55 + ease(fk) * 1.1);(m.material as T.MeshBasicMaterial).opacity = Math.pow(1 - fk, 2) * .9;this.flat.visible = fk < 1;
      }
      g.visible = k < 1;
    }

    // 5. Impacto estelar: estrela de 4 pontas que estoura com leve exagero, estreita e some; núcleo branco e anel
    if (this.crossMesh) {
      const g = this.crossMesh, u = g.userData, k = Math.min(1, t / Math.max(.12, dur));
      const pop = k < .2 ? back(k / .2) * 1.1 : 1.1 - (k - .2) * .45;
      g.position.copy(a).addScaledVector(this.dir, (v.shotImpulseH ?? 0) * t).add(new T.Vector3(0, (v.shotImpulseV ?? 0) * t, 0));
      u.spin.scale.setScalar(Math.max(.01, pop));u.spin.rotation.z = u.angle + k * .35;
      const op = k < .45 ? 1 : Math.max(0, 1 - (k - .45) / .55);
      for (const c of [...u.spin.children, ...g.children] as T.Mesh[]) {
        if (c.name === 'lines') {const s = .5 + ease(k) * .9;c.scale.set(s, s, s);(c.material as T.MeshBasicMaterial).opacity = Math.pow(1 - k, 2) * .85;continue;}
        if (c.name === 'flash') {c.scale.setScalar(1 + (k < .08 ? 5 * (1 - k / .08) : 0));(c.material as T.MeshBasicMaterial).opacity = k < .08 ? 1 : op * .8;continue;}
        if (c.name === 'jag') {c.scale.setScalar(.4 + ease(k * 1.6) * .9);(c.material as T.MeshBasicMaterial).opacity = op * .7;continue;}
        if (c.name === 'ring') {const s = u.arms * (.25 + ease(k) * .8);c.scale.set(s, s, s);(c.material as T.MeshBasicMaterial).opacity = (1 - k) * .8;}
        else if (c.material) (c.material as T.MeshBasicMaterial).opacity = c.name === 'star-diag' ? op * .9 : op;
      }
      g.visible = k < 1;
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
      out.push(['cross', this.crossMesh.position.toArray().map(n => +n.toFixed(4)), this.crossMesh.scale.toArray().map(n => +n.toFixed(4)), +(this.crossMesh.userData.spin.rotation.z).toFixed(4), this.crossMesh.visible]);
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
    for (const grp of [this.bladesGroup, this.crossMesh, this.flat]) {
      if (!grp) continue;
      const geos = new Set<T.BufferGeometry>(), mats = new Set<T.Material>();
      grp.traverse(o => {const m = o as T.Mesh;if (m.geometry) geos.add(m.geometry);for (const x of ([] as T.Material[]).concat(m.material ?? [])) mats.add(x);});
      geos.forEach(x => x.dispose());mats.forEach(x => x.dispose());grp.removeFromParent();
    }
    this.bladesGroup = null;this.crossMesh = null;this.flat = null;
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
