// Pools de objetos do VFX.
// Capacidade fixa, acquire/release, nenhuma alocação no hot path.
// Quando o pool se esgota, acquire retorna null (o orçamento decide suprimir).

// Pool genérico de objetos com criação e destruição customizáveis.
export class Pool {
  constructor({create, reset, capacity = 256, name = 'pool'} = {}) {
    this.create = create;
    this.reset = reset;
    this.capacity = capacity;
    this.name = name;
    this.available = []; // objetos livres (stack LIFO)
    this.active = new Set(); // objetos em uso
    this.created = 0;
    this.acquires = 0;
    this.rejections = 0;
    this.peakActive = 0;
  }
  acquire() {
    this.acquires++;
    let obj;
    if (this.available.length > 0) {
      obj = this.available.pop();
    } else if (this.active.size < this.capacity) {
      obj = this.create ? this.create() : {};
      this.created++;
    } else {
      this.rejections++;
      return null;
    }
    this.active.add(obj);
    this.peakActive = Math.max(this.peakActive, this.active.size);
    if (this.reset) this.reset(obj);
    return obj;
  }
  release(obj) {
    if (!obj || !this.active.has(obj)) return;
    this.active.delete(obj);
    this.available.push(obj);
  }
  releaseAll() {
    for (const obj of this.active) {
      this.available.push(obj);
    }
    this.active.clear();
  }
  clear() {
    this.available = [];
    this.active.clear();
  }
  stats() {
    return {
      name: this.name,
      capacity: this.capacity,
      created: this.created,
      available: this.available.length,
      active: this.active.size,
      peakActive: this.peakActive,
      acquires: this.acquires,
      rejections: this.rejections,
    };
  }
}

// Pool de partículas (dados leves, reutilizados).
export class ParticlePool extends Pool {
  constructor({capacity = 2048} = {}) {
    super({
      capacity,
      name: 'particles',
      create: () => ({age: 0, life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ax: 0, ay: 0, az: 0,
        w: 0, h: 0, rot: 0, spin: 0, cell: 0, mode: 0, color: 0xffffff, alpha: 1,
        additive: false, fade: 1, grow: 0, sizeCurve: null, stretchCurve: null, alphaCurve: null,
        floor: null, gravity: 0, drag: 0, follow: null, tag: null}),
      reset: (p) => {
        p.age = 0; p.life = 0; p.x = 0; p.y = 0; p.z = 0;
        p.vx = 0; p.vy = 0; p.vz = 0; p.ax = 0; p.ay = 0; p.az = 0;
        p.w = 0; p.h = 0; p.rot = 0; p.spin = 0; p.cell = 0; p.mode = 0;
        p.color = 0xffffff; p.alpha = 1; p.additive = false; p.fade = 1; p.grow = 0;
        p.sizeCurve = null; p.stretchCurve = null; p.alphaCurve = null;
        p.floor = null; p.gravity = 0; p.drag = 0; p.follow = null; p.tag = null;
      },
    });
  }
}

// Pool de anéis/decals temporários no chão.
export class RingPool extends Pool {
  constructor({capacity = 64} = {}) {
    super({
      capacity,
      name: 'rings',
      create: () => ({x: 0, y: 0, z: 0, radius: 0, life: 0, age: 0, color: 0xffffff, alpha: 1, mode: 'ground', visible: true}),
      reset: (r) => { r.x = 0; r.y = 0; r.z = 0; r.radius = 0; r.life = 0; r.age = 0; r.color = 0xffffff; r.alpha = 1; r.visible = true; },
    });
  }
}

// Pool de meshes temporários (luzes, decals, ghost).
export class MeshPool extends Pool {
  constructor({create, capacity = 64} = {}) {
    super({create, capacity, name: 'meshes',
      reset: (m) => { if (m.visible !== undefined) m.visible = false; if (m.material) m.material.opacity = 0; },
    });
  }
}

// Pool de luzes temporárias.
export class LightPool extends Pool {
  constructor({capacity = 16} = {}) {
    super({
      capacity,
      name: 'lights',
      create: () => ({x: 0, y: 0, z: 0, intensity: 1, color: 0xffffff, radius: 1, life: 0, age: 0, visible: true}),
      reset: (l) => { l.x = 0; l.y = 0; l.z = 0; l.intensity = 1; l.color = 0xffffff; l.radius = 1; l.life = 0; l.age = 0; l.visible = true; },
    });
  }
}

// Pool de trail segments (para trails de trajetória e afterimages).
export class TrailPool extends Pool {
  constructor({capacity = 512} = {}) {
    super({
      capacity,
      name: 'trails',
      create: () => ({x: 0, y: 0, z: 0, width: 0, color: 0xffffff, alpha: 1, age: 0, life: 0, index: 0}),
      reset: (t) => { t.x = 0; t.y = 0; t.z = 0; t.width = 0; t.color = 0xffffff; t.alpha = 1; t.age = 0; t.life = 0; t.index = 0; },
    });
  }
}

// Gerenciador de todos os pools com limites rígidos de memória.
export class PoolManager {
  constructor({maxParticles = 1400, maxRings = 64, maxMeshes = 64, maxLights = 16, maxTrails = 512} = {}) {
    this.particles = new ParticlePool({capacity: maxParticles});
    this.rings = new RingPool({capacity: maxRings});
    this.meshes = new MeshPool({capacity: maxMeshes});
    this.lights = new LightPool({capacity: maxLights});
    this.trails = new TrailPool({capacity: maxTrails});
    this.maxParticles = maxParticles;
  }
  acquireParticle() { return this.particles.acquire(); }
  releaseParticle(p) { this.particles.release(p); }
  acquireRing() { return this.rings.acquire(); }
  releaseRing(r) { this.rings.release(r); }
  acquireMesh() { return this.meshes.acquire(); }
  releaseMesh(m) { this.meshes.release(m); }
  acquireLight() { return this.lights.acquire(); }
  releaseLight(l) { this.lights.release(l); }
  acquireTrail() { return this.trails.acquire(); }
  releaseTrail(t) { this.trails.release(t); }
  clearAll() {
    this.particles.releaseAll();
    this.rings.releaseAll();
    this.meshes.releaseAll();
    this.lights.releaseAll();
    this.trails.releaseAll();
  }
  stats() {
    return {
      particles: this.particles.stats(),
      rings: this.rings.stats(),
      meshes: this.meshes.stats(),
      lights: this.lights.stats(),
      trails: this.trails.stats(),
      totalActive: this.particles.active.size + this.rings.active.size + this.meshes.active.size + this.lights.active.size + this.trails.active.size,
    };
  }
}
