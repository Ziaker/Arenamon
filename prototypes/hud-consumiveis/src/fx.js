// Partículas localizadas com three.quarks (já usado pelo laboratório de VFX do Arenamon). Camada visual
// isolada deste laboratório: cada coleção tem o seu emissor ao redor do item; o "burst" de coleta é só demonstração.
import * as THREE from 'three';
import * as Quarks from 'three.quarks';

const iv = (a, b) => new Quarks.IntervalValue(a, b);
const cv = v => new Quarks.ConstantValue(v);
const v4 = (hex, a = 1) => { const c = new THREE.Color(hex); return new THREE.Vector4(c.r, c.g, c.b, a); };
const v3 = hex => { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };
const bez = p => new Quarks.PiecewiseBezier([[new Quarks.Bezier(p[0], p[1], p[2], p[3]), 1]]);

function softMaterial() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide});
}

/** Identidade das partículas de cada coleção. */
const LOOK = {
  A: {rate: 9, life: [1.4, 2.2], speed: [.12, .3], size: [.07, .14], shape: () => new Quarks.ConeEmitter({radius: .38, angle: .35, direction: new THREE.Vector3(0, 1, 0)}), lift: .1, mix: .55},
  B: {rate: 7, life: [.7, 1.1], speed: [.8, 1.5], size: [.1, .18], shape: () => new Quarks.ConeEmitter({radius: .12, angle: 1.0, direction: new THREE.Vector3(0, 1, 0)}), gravity: 3.4, mix: .2},
  C: {rate: 16, life: [.35, .75], speed: [.5, 1.3], size: [.035, .07], shape: () => new Quarks.SphereEmitter({radius: .52}), mix: .7},
};

export class ItemFx {
  constructor(scene) {
    this.scene = scene;
    this.renderer = new Quarks.BatchedRenderer();
    scene.add(this.renderer);
    this.material = softMaterial();
    this.live = [];     // emissores contínuos: {system, emitter}
    this.bursts = [];   // rajadas de demonstração: {system, emitter, age, ttl}
    this.enabled = true;
    this.count = 0;
  }

  _params(look, color, extra = {}) {
    const white = '#ffffff';
    const behaviors = [
      new Quarks.ColorOverLife(new Quarks.Gradient([[v3(color), 0], [v3(color), 1]], [[0, 0], [1, .15], [.7, .6], [0, 1]])),
      new Quarks.SizeOverLife(bez([1, .9, .5, .1])),
    ];
    if (look.gravity) behaviors.push(new Quarks.ApplyForce(new THREE.Vector3(0, -1, 0), cv(look.gravity)));
    if (look.lift) behaviors.push(new Quarks.ApplyForce(new THREE.Vector3(0, 1, 0), cv(look.lift)));
    return {
      duration: 1, looping: true, worldSpace: true,
      startLife: iv(...look.life), startSpeed: iv(...look.speed), startSize: iv(...look.size),
      startColor: new Quarks.ColorRange(v4(color, 1), v4(new THREE.Color(color).lerp(new THREE.Color(white), look.mix ?? .4), 1)),
      shape: look.shape(), material: this.material,
      emissionOverTime: cv(look.rate), emissionBursts: [], behaviors,
      renderMode: Quarks.RenderMode.BillBoard,
      ...extra,
    };
  }

  /** Cria os emissores contínuos da coleção ativa em cada slot (Object3D) na altura indicada. */
  attach(slots, style, hover) {
    this.clear();
    if (!this.enabled) return;
    for (const { object, color } of slots) {
      const system = new Quarks.ParticleSystem(this._params(LOOK[style], color));
      const emitter = system.emitter; // o sistema já cria o próprio emissor (Object3D)
      emitter.position.set(0, hover - (style === 'B' ? .2 : .1), 0);
      object.add(emitter);
      this.renderer.addSystem(system);
      this.live.push({system, emitter});
    }
    this.count = this.live.length;
  }

  clear() {
    for (const e of this.live) this._drop(e);
    this.live = [];
    this.count = 0;
  }

  /** Rajada única (demonstração de "coleta"): não representa nenhuma mecânica oficial. */
  burst(position, color, style) {
    if (!this.enabled) return;
    const look = {life: [.55, 1.05], speed: [1.6, 3.6], size: [.09, .18], shape: () => new Quarks.SphereEmitter({radius: .12}), gravity: style === 'B' ? 4.5 : 1.2, mix: .5};
    const params = this._params(look, color, {
      looping: false, duration: .6, emissionOverTime: cv(0),
      emissionBursts: [{time: 0, count: cv(style === 'C' ? 46 : 34), cycle: 1, interval: .05, probability: 1}],
    });
    const system = new Quarks.ParticleSystem(params);
    const emitter = system.emitter; // o sistema já cria o próprio emissor (Object3D)
    emitter.position.copy(position);
    this.scene.add(emitter);
    this.renderer.addSystem(system);
    this.bursts.push({system, emitter, age: 0, ttl: 2.2});
  }

  _drop(e) {
    try { this.renderer.deleteSystem(e.system); } catch { /* já removido */ }
    e.emitter.parent?.remove(e.emitter);
    e.system.dispose?.();
  }

  update(dt) {
    if (!this.enabled) return;
    this.renderer.update(dt);
    for (const b of this.bursts) b.age += dt;
    for (const b of this.bursts.filter(x => x.age >= x.ttl)) this._drop(b);
    this.bursts = this.bursts.filter(b => b.age < b.ttl);
  }
}
