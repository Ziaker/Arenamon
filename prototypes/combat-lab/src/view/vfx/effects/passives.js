// Efeitos de ativação de habilidades passivas — Propostas A, B, C.
// Todos os efeitos usam malhas instanciadas (sem sprites/billboards) e seguem
// o mesmo padrão de fade/integração do SolidFx.
//
// Proposta A — Orbital Halo: anel de partículas orbitando o lutador
// Proposta B — Celestial Intersections: feixes de luz prismáticos cruzados
// Proposta C — Luminous Resonance: pulso de luz com ondas concêntricas

import * as T from 'three';
import {Pool} from '../pools.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = k => k * k * (3 - 2 * k);

// ─── Material compartilhado com opacidade por instância ───
function makeSolidMaterial(params) {
  const m = new T.MeshStandardMaterial({...params, transparent: true, depthWrite: true});
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float instanceAlpha;\nvarying float vIA;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvIA = instanceAlpha;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vIA;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vIA;');
  };
  m.customProgramCacheKey = () => 'solid-instance-alpha';
  return m;
}

// ─── Geometrias reutilizáveis ───
const GEO = {
  chunk: () => new T.IcosahedronGeometry(.5, 0),
  shard: () => new T.OctahedronGeometry(.5),
  prism: () => new T.CylinderGeometry(.5, .5, 1, 6),
  spike: () => new T.ConeGeometry(.5, 1, 5),
  wave: () => { const g = new T.TorusGeometry(1, .07, 6, 36); g.rotateX(Math.PI / 2); return g; },
  ring: () => new T.TorusGeometry(1, .04, 4, 48),
  star: () => new T.OctahedronGeometry(.5, 1),
  hex: () => new T.CylinderGeometry(.5, .5, .12, 6),
};

const HARD_CAP = 512;

export class PassiveFx {
  constructor(scene) {
    this.scene = scene;
    this.group = new T.Group(); this.group.name = 'passive-fx'; scene.add(this.group);
    this.geometries = {}; for (const [k, f] of Object.entries(GEO)) this.geometries[k] = f();
    this.materials = {
      lit: makeSolidMaterial({color: 0xffffff, roughness: .92, metalness: 0, flatShading: true}),
      glow: makeSolidMaterial({color: 0xffffff, roughness: .35, metalness: .1, flatShading: true, emissive: 0x2f7f78, emissiveIntensity: .8}),
      crystal: makeSolidMaterial({color: 0xffffff, roughness: .15, metalness: .25, flatShading: true, emissive: 0x4466ff, emissiveIntensity: .6}),
    };
    this.meshes = new Map(); this.wrappers = new Map();
    this.all = []; this.free = []; for (let i = 0; i < HARD_CAP; i++) this.free.push({});
    this.timers = []; this.time = 0; this.seq = 1;
    this.dummy = new T.Object3D(); this.q = new T.Quaternion(); this.col = new T.Color(); this.up = new T.Vector3(0, 1, 0);
    this.lights = []; this.lightPool = new Pool({create: () => new T.PointLight(0xffffff, 0, 8), capacity: 8, name: 'passive-lights'});
    for (let i = 0; i < 8; i++) { const l = this.lightPool.create(); l.visible = false; this.group.add(l); this.lights.push(l); }
    this.activePassives = new Map(); // fighterId -> {type, startTime, particles[], light}
    this.stats = {spawned: 0, peak: 0, active: 0, rejected: 0};
  }

  wrapper(shape) {
    const base = this.geometries[shape], g = new T.BufferGeometry();
    g.index = base.index; for (const [k, a] of Object.entries(base.attributes)) g.setAttribute(k, a);
    g.setAttribute('instanceAlpha', new T.InstancedBufferAttribute(new Float32Array(HARD_CAP).fill(1), 1).setUsage(T.DynamicDrawUsage));
    if (!base.boundingSphere) base.computeBoundingSphere(); g.boundingSphere = base.boundingSphere;
    return g;
  }
  meshFor(shape, mat) {
    const id = shape + ':' + mat; let m = this.meshes.get(id);
    if (!m) {
      const g = this.wrapper(shape);
      m = new T.InstancedMesh(g, this.materials[mat], HARD_CAP); m.userData.n = 0;
      m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.count = 0; m.frustumCulled = false;
      m.setColorAt(0, this.col.set(0xffffff)); m.instanceColor.setUsage(T.DynamicDrawUsage);
      this.group.add(m); this.meshes.set(id, m);
    }
    return m;
  }

  put(o) {
    if (this.all.length >= HARD_CAP || !this.free.length) { this.stats.rejected++; return null; }
    const p = this.free.pop();
    Object.assign(p, {
      x: o.x ?? 0, y: o.y ?? 0, z: o.z ?? 0,
      vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0,
      rx: o.rx ?? 0, ry: o.ry ?? 0, rz: o.rz ?? 0,
      wx: o.wx ?? 0, wy: o.wy ?? 0, wz: o.wz ?? 0,
      sx: o.sx ?? o.s ?? .1, sy: o.sy ?? o.s ?? .1, sz: o.sz ?? o.s ?? .1,
      grow: o.grow ?? 0, growY: o.growY ?? 0,
      shape: o.shape ?? 'chunk', mat: o.mat ?? 'lit',
      color: o.color ?? 0xffffff, alpha: o.alpha ?? 1,
      life: Math.max(.05, o.life ?? 1), age: -(o.delay ?? 0),
      fadeStart: clamp(o.fadeStart ?? .6, 0, .98),
      fadeEnd: clamp(o.fadeEnd ?? 1, (o.fadeStart ?? .6) + .02, 1),
      pop: o.pop ?? .12, hold: o.hold ?? .5,
      orbiting: o.orbiting ?? false, orbitRadius: o.orbitRadius ?? 1,
      orbitSpeed: o.orbitSpeed ?? 1, orbitPhase: o.orbitPhase ?? 0,
      orbitAxis: o.orbitAxis ?? 'y', center: o.center ?? {x: 0, y: 0, z: 0},
      pulse: o.pulse ?? false, pulseFreq: o.pulseFreq ?? 1,
      align: !!o.align,
    });
    this.all.push(p); this.stats.spawned++; return p;
  }

  fade(p, k) {
    return k <= p.fadeStart ? 1 : k >= p.fadeEnd ? 0 : 1 - smooth((k - p.fadeStart) / (p.fadeEnd - p.fadeStart));
  }

  // ═══════════════════════════════════════════════════════════════
  //  PROPOSTA A — ORBITAL HALO  (Halo Orbital de Proteção)
  // ═══════════════════════════════════════════════════════════════
  spawnOrbitalHalo(position, opts = {}) {
    const {
      color = 0x4fc3f7, color2 = 0xffffff,
      radius = 1.2, particleCount = 24,
      orbitSpeed = 2.5, opacity = .9,
      duration = 3.5, quality = 1,
    } = opts;
    const id = 'halo_' + (this.seq++);
    const qk = quality === 0 ? .55 : quality === 2 ? 1.4 : 1;
    const cnt = Math.max(8, Math.round(particleCount * qk));
    const particles = [];

    // Anel principal — partículas orbitando
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2;
      const p = this.put({
        shape: i % 3 === 0 ? 'shard' : 'chunk',
        mat: 'glow',
        color: i % 2 === 0 ? color : color2,
        x: position.x + Math.cos(a) * radius,
        y: position.y + 1.1,
        z: position.z + Math.sin(a) * radius,
        s: (.04 + Math.random() * .04) * qk,
        life: duration,
        alpha: opacity,
        orbiting: true,
        orbitRadius: radius,
        orbitSpeed: orbitSpeed * (.8 + Math.random() * .4),
        orbitPhase: a,
        orbitAxis: 'y',
        center: {...position, y: position.y + 1.1},
        fadeStart: .75, fadeEnd: 1,
        pop: .08, hold: .6,
        wy: 3 + Math.random() * 4,
      });
      if (p) particles.push(p);
    }

    // Anel secundário inclinado
    for (let i = 0; i < Math.round(cnt * .6); i++) {
      const a = (i / Math.round(cnt * .6)) * Math.PI * 2;
      const p = this.put({
        shape: 'shard', mat: 'glow',
        color: color2,
        x: position.x + Math.cos(a) * (radius * .7),
        y: position.y + 1.1,
        z: position.z + Math.sin(a) * (radius * .7),
        s: .03 * qk,
        life: duration,
        alpha: opacity * .6,
        orbiting: true,
        orbitRadius: radius * .7,
        orbitSpeed: orbitSpeed * 1.3,
        orbitPhase: a + Math.PI / 4,
        orbitAxis: 'x',
        center: {...position, y: position.y + 1.1},
        fadeStart: .7, fadeEnd: 1,
        pop: .1, hold: .5,
      });
      if (p) particles.push(p);
    }

    // Luz pontual suave
    const light = this.lightPool.acquire();
    if (light) {
      light.color.setHex(color);
      light.intensity = 2.5 * opacity;
      light.distance = radius * 5;
      light.position.set(position.x, position.y + 1.5, position.z);
      light.visible = true;
    }

    this.activePassives.set(id, {type: 'A', startTime: this.time, particles, light, center: {...position}});
    return id;
  }

  // ═══════════════════════════════════════════════════════════════
  //  PROPOSTA B — CELESTIAL INTERSECTIONS  (Interseções Celestiais)
  // ═══════════════════════════════════════════════════════════════
  spawnCelestialIntersections(position, opts = {}) {
    const {
      color = 0xffd54f, color2 = 0xff8a65,
      beamCount = 6, beamLength = 2.5,
      rotationSpeed = 1.2, opacity = .85,
      duration = 2.8, quality = 1,
    } = opts;
    const id = 'celestial_' + (this.seq++);
    const qk = quality === 0 ? .55 : quality === 2 ? 1.4 : 1;
    const cnt = Math.max(4, Math.round(beamCount * qk));
    const particles = [];

    // Feixes principais cruzados
    for (let i = 0; i < cnt; i++) {
      const angle = (i / cnt) * Math.PI;
      const p = this.put({
        shape: 'prism',
        mat: 'crystal',
        color: i % 2 === 0 ? color : color2,
        x: position.x,
        y: position.y + 1.0,
        z: position.z,
        sx: .025 * qk,
        sy: beamLength * .5 * qk,
        sz: .025 * qk,
        rx: angle,
        rz: Math.PI / 3 + (i % 2) * Math.PI / cnt,
        life: duration,
        alpha: opacity,
        fadeStart: .6, fadeEnd: 1,
        pop: .04, hold: .45,
        wy: rotationSpeed * (i % 2 === 0 ? 1 : -1),
        growY: -.3,
      });
      if (p) particles.push(p);
    }

    // Prismas flutuantes nos vértices
    for (let i = 0; i < cnt * 2; i++) {
      const a = (i / (cnt * 2)) * Math.PI * 2;
      const r = beamLength * .6;
      const p = this.put({
        shape: 'star',
        mat: 'glow',
        color: color2,
        x: position.x + Math.cos(a) * r,
        y: position.y + 1.0 + Math.sin(a * 2) * .3,
        z: position.z + Math.sin(a) * r,
        s: .05 * qk,
        life: duration * .8,
        alpha: opacity * .7,
        orbiting: true,
        orbitRadius: r,
        orbitSpeed: rotationSpeed * .5,
        orbitPhase: a,
        orbitAxis: 'y',
        center: {...position, y: position.y + 1.0},
        fadeStart: .65, fadeEnd: 1,
        pop: .12, hold: .4,
        wx: 2, wz: 2,
      });
      if (p) particles.push(p);
    }

    // Luz pontual cristalina
    const light = this.lightPool.acquire();
    if (light) {
      light.color.setHex(color);
      light.intensity = 3 * opacity;
      light.distance = beamCount * 3;
      light.position.set(position.x, position.y + 1.5, position.z);
      light.visible = true;
    }

    this.activePassives.set(id, {type: 'B', startTime: this.time, particles, light, center: {...position}});
    return id;
  }

  // ═══════════════════════════════════════════════════════════════
  //  PROPOSTA C — LUMINOUS RESONANCE  (Ressonância Luminosa)
  // ═══════════════════════════════════════════════════════════════
  spawnLuminousResonance(position, opts = {}) {
    const {
      color = 0xe040fb, color2 = 0x7c4dff,
      waveCount = 4, waveRadius = 2.5,
      pulseSpeed = 2.0, opacity = .9,
      duration = 2.5, quality = 1,
    } = opts;
    const id = 'resonance_' + (this.seq++);
    const qk = quality === 0 ? .55 : quality === 2 ? 1.4 : 1;
    const particles = [];

    // Ondas concêntricas expandindo
    for (let w = 0; w < waveCount; w++) {
      const delay = w * .18;
      const maxR = waveRadius * (1 + w * .3);
      const p = this.put({
        shape: 'wave',
        mat: 'glow',
        color: w % 2 === 0 ? color : color2,
        x: position.x,
        y: position.y + .05,
        z: position.z,
        sx: .15 * qk,
        sy: .6,
        sz: .15 * qk,
        life: duration - delay,
        alpha: opacity * (.8 - w * .12),
        pulse: true,
        pulseFreq: pulseSpeed,
        grow: (maxR / .15 - 1) / (duration - delay),
        growY: -.4,
        fadeStart: .5, fadeEnd: .95,
        pop: .06, hold: .35,
        delay,
      });
      if (p) particles.push(p);
    }

    // Partículas de pulso saindo do centro
    const particleCount = Math.round(16 * qk);
    for (let i = 0; i < particleCount; i++) {
      const a = (i / particleCount) * Math.PI * 2 + Math.random() * .3;
      const sp = 1.5 + Math.random() * 2;
      const p = this.put({
        shape: 'hex',
        mat: 'crystal',
        color: Math.random() > .5 ? color : color2,
        x: position.x,
        y: position.y + .1,
        z: position.z,
        sx: .03 * qk,
        sy: .015 * qk,
        sz: .03 * qk,
        vx: Math.cos(a) * sp,
        vz: Math.sin(a) * sp,
        vy: Math.random() * .8,
        life: duration * .6,
        alpha: opacity * .7,
        fadeStart: .55, fadeEnd: 1,
        pop: .15, hold: .4,
        grow: .5,
        wy: 8,
      });
      if (p) particles.push(p);
    }

    // Núcleo central pulsante
    const core = this.put({
      shape: 'star',
      mat: 'glow',
      color: color2,
      x: position.x,
      y: position.y + .6,
      z: position.z,
      s: .15 * qk,
      life: duration,
      alpha: opacity,
      pulse: true,
      pulseFreq: pulseSpeed * 2,
      fadeStart: .7, fadeEnd: 1,
      pop: .1, hold: .5,
      wy: 5,
      grow: -.4,
    });
    if (core) particles.push(core);

    // Luz pontual intensa
    const light = this.lightPool.acquire();
    if (light) {
      light.color.setHex(color);
      light.intensity = 4 * opacity;
      light.distance = waveRadius * 4;
      light.position.set(position.x, position.y + 1, position.z);
      light.visible = true;
    }

    this.activePassives.set(id, {type: 'C', startTime: this.time, particles, light, center: {...position}});
    return id;
  }

  // ─── Desativa um efeito passivo e libera recursos ───
  deactivate(id) {
    const passive = this.activePassives.get(id);
    if (!passive) return;
    // Partículas são automaticamente limpas pelo sistema de aging
    // Mas aceleramos o fade
    for (const p of passive.particles) {
      p.fadeStart = Math.min(p.fadeStart, .2);
      p.fadeEnd = Math.min(p.fadeEnd, .5);
      p.life = Math.min(p.life, p.age + .5);
    }
    if (passive.light) {
      passive.light.visible = false;
      this.lightPool.release(passive.light);
    }
    this.activePassives.delete(id);
  }

  // ─── Atualização por quadro ───
  update(dt, {visible = true} = {}) {
    this.group.visible = visible;
    this.time += dt;
    if (dt <= 0) return;

    // Atualiza timers
    for (const t of this.timers.filter(t => t.at <= this.time)) t.fn();
    this.timers = this.timers.filter(t => t.at > this.time);

    // Atualiza luzes dos efeitos ativos
    for (const [id, passive] of this.activePassives) {
      const age = this.time - passive.startTime;
      const progress = age / 3; // assume duração típica ~3s
      if (passive.light && passive.light.visible) {
        passive.light.intensity *= Math.max(0, 1 - progress * .3);
      }
      // Se todas as partículas morreram, libera
      const allDead = passive.particles.every(p => p.age >= p.life);
      if (allDead || age > 6) {
        if (passive.light) { passive.light.visible = false; this.lightPool.release(passive.light); }
        this.activePassives.delete(id);
      }
    }

    this.integrate(dt);
  }

  integrate(dt) {
    const keep = []; for (const m of this.meshes.values()) m.userData.n = 0;
    const d = this.dummy, A = this.q;

    for (const p of this.all) {
      p.age += dt;
      if (p.age >= p.life) { this.free.push(p); continue; }
      keep.push(p);
      if (p.age < 0) continue;

      const k = p.age / p.life;

      if (dt > 0) {
        if (p.orbiting) {
          const a = p.orbitPhase + p.orbitSpeed * p.age;
          const r = p.orbitRadius;
          const c = p.center;
          if (p.orbitAxis === 'y') {
            p.x = c.x + Math.cos(a) * r;
            p.z = c.z + Math.sin(a) * r;
            p.y = c.y + Math.sin(a * 3) * .15;
          } else if (p.orbitAxis === 'x') {
            p.x = c.x + Math.cos(a) * r;
            p.y = c.y + Math.sin(a) * .5;
            p.z = c.z;
          }
          p.rx += p.wx * dt; p.ry += p.wy * dt; p.rz += p.wz * dt;
        } else if (p.pulse) {
          const pulse = 1 + Math.sin(p.pulseFreq * p.age * Math.PI * 2) * .15;
          p.sx = (p.sx || .1) * pulse;
          p.sz = (p.sz || .1) * pulse;
          p.ry += p.wy * dt;
        } else {
          p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; p.z += (p.vz || 0) * dt;
          p.rx += (p.wx || 0) * dt; p.ry += (p.wy || 0) * dt; p.rz += (p.wz || 0) * dt;
        }
      }

      const sc = k < p.pop / p.life ? smooth(clamp(k / (p.pop / p.life), 0, 1))
        : (k < p.hold ? 1 : 1 - smooth((k - p.hold) / (1 - p.hold)));
      const gxz = 1 + p.grow * k, gy = 1 + p.growY * k;

      const m = this.meshFor(p.shape, p.mat), idx = m.userData.n++;
      d.position.set(p.x, p.y, p.z);
      d.scale.set(Math.max(1e-4, p.sx * gxz * sc), Math.max(1e-4, p.sy * gy * sc), Math.max(1e-4, p.sz * gxz * sc));
      if (p.align) {
        const v = new T.Vector3(p.vx, p.vy, p.vz);
        if (v.lengthSq() > 1e-6) { A.setFromUnitVectors(this.up, v.normalize()); d.quaternion.copy(A); }
      } else {
        d.rotation.set(p.rx, p.ry, p.rz, 'YXZ');
      }
      d.updateMatrix(); m.setMatrixAt(idx, d.matrix);
      this.col.setHex(p.color); m.setColorAt(idx, this.col);
      m.geometry.attributes.instanceAlpha.array[idx] = p.alpha * this.fade(p, k);
    }

    this.all = keep;
    for (const m of this.meshes.values()) {
      m.count = m.userData.n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.geometry.attributes.instanceAlpha.needsUpdate = true;
    }
    this.stats.active = keep.length;
    this.stats.peak = Math.max(this.stats.peak, keep.length);
  }

  reset() {
    for (const p of this.all) this.free.push(p); this.all.length = 0;
    this.timers = []; this.activePassives.clear();
    for (const l of this.lights) { l.visible = false; }
    this.lightPool.releaseAll();
    for (const m of this.meshes.values()) m.count = 0;
    this.time = 0;
  }

  dispose() {
    this.reset();
    for (const g of Object.values(this.geometries)) g.dispose();
    for (const g of this.wrappers.values()) g.dispose();
    for (const m of Object.values(this.materials)) m.dispose();
    for (const m of this.meshes.values()) m.dispose();
    for (const l of this.lights) { l.dispose(); }
    this.scene.remove(this.group);
  }

  getStats() {
    return {...this.stats, passives: this.activePassives.size};
  }
}
