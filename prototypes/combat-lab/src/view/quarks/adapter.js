// Adaptador isolado entre three.quarks e o renderer do Arenamon (Fase 2 do plano
// de integração open source). Nada aqui altera regras da simulação: é uma camada
// visual que consome os mesmos eventos que o VFX legado.
//
// Duas partes:
//   1. Funções puras (testáveis em Node): presetToSystemParams / buildShape /
//      buildBehaviors — convertem o preset declarativo (presets.js) em
//      ParticleSystemParameters da biblioteca.
//   2. Classe QuarksFx (só browser): envolve BatchedRenderer + ParticleEmitter e
//      expõe emitBurst (explosões), attach/detach/setIntensity (efeito contínuo
//      de carga), update/reset/dispose e o respeito a reduceMotion.

import {defaultQuarksPresets, QUARKS_PRESET_ORDER} from './presets.js';

// ---------- parte 1: conversão pura ----------

function numOrRange(Quarks, v) {
  return Array.isArray(v) ? new Quarks.IntervalValue(v[0], v[1]) : new Quarks.ConstantValue(v ?? 0);
}

function hexToV3(THREE, hex) {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}
function hexToV4(THREE, hex, alpha = 1) {
  const c = new THREE.Color(hex);
  return new THREE.Vector4(c.r, c.g, c.b, alpha);
}

function bezierFn(Quarks, p) {
  const {PiecewiseBezier, Bezier} = Quarks;
  return new PiecewiseBezier([[new Bezier(p[0], p[1], p[2], p[3]), 1]]);
}

/** Cria a forma do emissor a partir do preset. */
export function buildShape(preset, Quarks) {
  const s = preset.shape ?? {type: 'point'};
  switch (s.type) {
    case 'sphere': return new Quarks.SphereEmitter({radius: s.radius ?? .2});
    case 'cone': return new Quarks.ConeEmitter({
      radius: s.radius ?? .3, angle: (s.angle ?? 30) * Quarks.DEG2RAD,
      direction: new Quarks.Vector3(s.dir?.x ?? 0, s.dir?.y ?? 1, s.dir?.z ?? 0),
    });
    case 'donut': return new Quarks.DonutEmitter({radius: s.radius ?? .5, thickness: s.thickness ?? .1, arc: s.arc ?? Math.PI * 2});
    case 'circle': return new Quarks.CircleEmitter({radius: s.radius ?? .5, thickness: s.thickness ?? .1, arc: s.arc ?? Math.PI * 2});
    case 'point':
    default: return new Quarks.PointEmitter({});
  }
}

/** Cria os behaviors (curvas sobre a vida da partícula). */
export function buildBehaviors(preset, Quarks, THREE) {
  const list = [];
  if (preset.colorOverLife?.stops?.length) {
    const colors = [], alphas = [];
    for (const st of preset.colorOverLife.stops) {
      colors.push([hexToV3(THREE, st.color), st.t]);
      alphas.push([(st.alpha ?? 1), st.t]);
    }
    list.push(new Quarks.ColorOverLife(new Quarks.Gradient(colors, alphas)));
  }
  if (preset.sizeOverLife) list.push(new Quarks.SizeOverLife(bezierFn(Quarks, preset.sizeOverLife)));
  if (preset.speedOverLife) list.push(new Quarks.SpeedOverLife(bezierFn(Quarks, preset.speedOverLife)));
  if (preset.gravity) {
    list.push(new Quarks.ApplyForce(new THREE.Vector3(0, -1, 0), new Quarks.ConstantValue(-preset.gravity)));
  }
  if (preset.orbit?.speed) {
    list.push(new Quarks.OrbitOverLife(numOrRange(Quarks, preset.orbit.speed)));
  }
  return list;
}

/**
 * Converte um preset declarativo em ParticleSystemParameters do three.quarks.
 * opts:
 *   material      material THREE a usar (obrigatório — a biblioteca exige um)
 *   scale         multiplicador global de tamanho (ex.: power do impacto)
 *   countScale    multiplicador da quantidade emitida
 *   emissionScale multiplicador da taxa de emissão contínua (intensidade da carga)
 */
export function presetToSystemParams(preset, {Quarks, THREE, material, scale = 1, countScale = 1, emissionScale = 1} = {}) {
  const p = preset;
  const g = (v, dflt = 0) => (v === undefined || v === null ? dflt : v);
  const burstCount = Math.max(1, Math.round(g(p.burst?.count, 0) * countScale));
  const sizeArr = Array.isArray(p.startSize) ? p.startSize : [g(p.startSize, .1), g(p.startSize, .1) * 2];
  const params = {
    duration: g(p.duration, 1),
    looping: !!p.looping,
    worldSpace: p.worldSpace !== false,
    startLife: numOrRange(Quarks, g(p.startLife, [.5, .5])),
    startSpeed: numOrRange(Quarks, g(p.startSpeed, [1, 2])),
    startSize: numOrRange(Quarks, sizeArr.map(v => v * scale)),
    startColor: new Quarks.ColorRange(hexToV4(THREE, p.startColor?.a ?? 0xffffff, g(p.opacity, 1)), hexToV4(THREE, p.startColor?.b ?? p.startColor?.a ?? 0xffffff, g(p.opacity, 1))),
    shape: buildShape(p, Quarks),
    material,
    emissionOverTime: new Quarks.ConstantValue(g(p.emissionOverTime, 0) * emissionScale),
    emissionBursts: p.burst ? [{time: g(p.burst.time, 0), count: new Quarks.ConstantValue(burstCount), cycle: 1, interval: .05, probability: 1}] : [],
    behaviors: buildBehaviors(p, Quarks, THREE),
    renderMode: Quarks.RenderMode.BillBoard,
  };
  return params;
}

/** Material padrão: sprite suave (radial) com blending aditivo; sem mapa se não houver DOM (Node). */
export function createDefaultMaterial(THREE, {additive = true} = {}) {
  let map = null;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');grad.addColorStop(.4, 'rgba(255,255,255,.7)');grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;ctx.fillRect(0, 0, 64, 64);
    map = new THREE.CanvasTexture(c);
  }
  return new THREE.MeshBasicMaterial({
    map, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
}

// ---------- parte 2: camada de runtime (browser) ----------

/**
 * Camada three.quarks do Arenamon. Recebe THREE e Quarks (importados pelo
 * chamador — o laboratório e a view passam os mesmos módulos empacotados).
 */
export class QuarksFx {
  constructor({THREE, Quarks, scene, accessibility = null, presets = null} = {}) {
    this.THREE = THREE;this.Quarks = Quarks;this.scene = scene;
    this.accessibility = accessibility;
    this.presets = presets ?? defaultQuarksPresets();
    this.renderer = new Quarks.BatchedRenderer();
    scene.add(this.renderer);
    this.material = createDefaultMaterial(THREE);
    this.bursts = [];        // {system, emitter, age, ttl}
    this.continuous = new Map(); // name -> {system, emitter, baseEmission, parent}
    this.time = 0;
    this.stats = {emitted: 0, active: 0};
    this._motionK = 1;       // fator de redução por acessibilidade
  }

  get enabled() {return this._enabled ?? true;}
  set enabled(v) {this._enabled = !!v;this.renderer.visible = !!v;}

  _motionFactor() {
    const rm = this.accessibility?.reduceMotion;
    return (typeof rm === 'function' ? rm() : rm) ? .35 : 1;
  }

  /** Posição final do emissor = posição dada + offset relativo do preset. */
  _place(emitter, preset, position) {
    emitter.position.set(
      (position.x ?? 0) + (preset.emitterOffset?.x ?? 0),
      (position.y ?? 0) + (preset.emitterOffset?.y ?? 0),
      (position.z ?? 0) + (preset.emitterOffset?.z ?? 0));
  }

  /** Explosão única de um preset na posição dada. power escala tamanho/qtdade. */
  emitBurst(name, position, {power = 1, countScale = 1, scale = null} = {}) {
    const preset = this.presets[name];
    if (!preset) return null;
    if (preset.continuous) return this._emitContinuousBurst(name, position, {power, countScale});
    const k = this._motionFactor();
    const params = presetToSystemParams(preset, {
      Quarks: this.Quarks, THREE: this.THREE, material: this.material,
      scale: (scale ?? 1) * Math.min(2, Math.max(.5, power)), countScale: countScale * k,
    });
    const system = new this.Quarks.ParticleSystem(params);
    const emitter = new this.Quarks.ParticleEmitter(system);
    this._place(emitter, preset, position);
    this.scene.add(emitter);
    this.renderer.addSystem(system);
    const ttl = params.duration + .6; // margem para as últimas partículas morrerem
    this.bursts.push({system, emitter, age: 0, ttl});
    this.stats.emitted++;
    return system;
  }

  /** Uma rajada avulsa de um preset contínuo (ex.: liberação da carga). */
  _emitContinuousBurst(name, position, {power = 1, countScale = 1} = {}) {
    const preset = this.presets[name];
    const oneShot = {...preset, continuous: false, looping: false, burst: {count: Math.round((preset.emissionOverTime ?? 60) * .35), time: 0}, emissionOverTime: 0};
    const k = this._motionFactor();
    const params = presetToSystemParams(oneShot, {
      Quarks: this.Quarks, THREE: this.THREE, material: this.material,
      scale: Math.min(2, Math.max(.5, power)), countScale: countScale * k,
    });
    const system = new this.Quarks.ParticleSystem(params);
    const emitter = new this.Quarks.ParticleEmitter(system);
    this._place(emitter, preset, position);
    this.scene.add(emitter);
    this.renderer.addSystem(system);
    this.bursts.push({system, emitter, age: 0, ttl: params.duration + .6});
    this.stats.emitted++;
    return system;
  }

  /**
   * Anexa um efeito contínuo a um Object3D (ex.: âncora do lutador carregando).
   * `key` permite várias instâncias do mesmo preset (ex.: charge#0 e charge#1).
   * Retorna true se criou; se já existia, só atualiza a intensidade.
   */
  attach(name, object3D, {intensity = 1, key = null} = {}) {
    const preset = this.presets[name];
    if (!preset || !preset.continuous) return false;
    const id = key ?? name;
    let entry = this.continuous.get(id);
    if (!entry) {
      const k = this._motionFactor();
      const params = presetToSystemParams(preset, {
        Quarks: this.Quarks, THREE: this.THREE, material: this.material,
        emissionScale: k,
      });
      const system = new this.Quarks.ParticleSystem(params);
      const emitter = new this.Quarks.ParticleEmitter(system);
      emitter.position.set(preset.emitterOffset?.x ?? 0, preset.emitterOffset?.y ?? 0, preset.emitterOffset?.z ?? 0);
      if (preset.emitterRotation) emitter.rotation.set(preset.emitterRotation.x ?? 0, preset.emitterRotation.y ?? 0, preset.emitterRotation.z ?? 0);
      object3D.add(emitter);
      this.scene.add(object3D); // garante presença na cena
      this.renderer.addSystem(system);
      entry = {system, emitter, baseEmission: preset.emissionOverTime ?? 60, parent: object3D, name};
      this.continuous.set(id, entry);
      this.stats.emitted++;
    }
    this.setIntensity(id, intensity);
    return true;
  }

  /** Escala a emissão contínua (0..1+): é a "intensidade crescente" do efeito A. */
  setIntensity(id, intensity) {
    const entry = this.continuous.get(id);
    if (!entry) return;
    const k = Math.max(0, intensity);
    entry.system.emissionOverTime = new this.Quarks.ConstantValue(entry.baseEmission * k * this._motionFactor());
  }

  /** Encerramento controlado: para de emitir e remove depois que as partículas morrem. */
  detach(id, {graceful = true} = {}) {
    const entry = this.continuous.get(id);
    if (!entry) return false;
    this.continuous.delete(id);
    if (graceful) {
      entry.system.looping = false;
      entry.system.emissionOverTime = new this.Quarks.ConstantValue(0);
      this.bursts.push({system: entry.system, emitter: entry.emitter, age: 0, ttl: entry.system.duration + .8});
    } else {
      this._drop(entry.system, entry.emitter);
    }
    return true;
  }

  _drop(system, emitter) {
    try {this.renderer.deleteSystem(system);} catch {/* já removido */}
    emitter?.parent?.remove(emitter);
    system.dispose?.();
  }

  update(dt) {
    this.time += dt;
    if (!this.enabled) return;
    this.renderer.update(dt);
    for (const b of this.bursts) b.age += dt;
    const dead = this.bursts.filter(b => b.age >= b.ttl);
    for (const b of dead) this._drop(b.system, b.emitter);
    this.bursts = this.bursts.filter(b => b.age < b.ttl);
    this.stats.active = this.bursts.length + this.continuous.size;
  }

  reset() {
    for (const [, entry] of this.continuous) this._drop(entry.system, entry.emitter);
    this.continuous.clear();
    for (const b of this.bursts) this._drop(b.system, b.emitter);
    this.bursts = [];
    this.stats.active = 0;
  }

  dispose() {
    this.reset();
    this.scene?.remove(this.renderer);
    this.material.dispose?.();
  }
}

export {QUARKS_PRESET_ORDER};
