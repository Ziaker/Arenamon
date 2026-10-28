// VFX Runtime — orquestrador do novo sistema declarativo.
// Recebe eventos visuais (adaptados da simulação) e produz apenas apresentação.
// Nunca altera a simulação. Trabalha junto ao sistema anterior como fallback.

import * as T from 'three';
import {PoolManager} from './pools.js';
import {Scheduler} from './scheduler.js';
import {Budget, QUALITY_LIMITS} from './budget.js';
import {CameraFeedback} from './camera-feedback.js';
import {VfxTelemetry} from './telemetry.js';
import {adaptSimEvent, freezeVisualEvent, eventSeed, QUALITY} from './contract.js';
import {BeamRenderer} from './beam-renderer.js';
import {C} from '../../sim/config.js';

const VERT = `
attribute vec3 iPos; attribute vec3 iAxis; attribute vec2 iSize; attribute vec4 iColor; attribute vec3 iMisc;
varying vec2 vUv; varying vec4 vColor;
void main() {
  vec2 c = position.xy; float rot = iMisc.x, cellI = iMisc.y, mode = iMisc.z;
  float cs = cos(rot), sn = sin(rot); vec2 r = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);
  vec3 world;
  if (mode < .5) {
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    world = iPos + right * r.x * iSize.x + up * r.y * iSize.y;
  } else if (mode < 1.5) {
    world = iPos + vec3(r.x * iSize.x, 0.0, r.y * iSize.y);
  } else if (mode < 2.5) {
    vec3 dir = normalize(iAxis + vec3(1e-5)), toCam = normalize(cameraPosition - iPos), side = normalize(cross(dir, toCam) + vec3(1e-5));
    world = iPos + side * c.x * iSize.x + dir * c.y * iSize.y;
  } else {
    vec3 n = normalize(iAxis + vec3(1e-5)), side = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(1e-5));
    world = iPos + side * r.x * iSize.x + vec3(0.0, 1.0, 0.0) * r.y * iSize.y;
  }
  vec2 uvv = vec2(uv.x, 1.0 - uv.y);
  vUv = (vec2(mod(cellI, 4.0), floor(cellI / 4.0)) + uvv) / 4.0; vUv.y = 1.0 - vUv.y;
  vColor = iColor;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;
const FRAG = `
uniform sampler2D map; varying vec2 vUv; varying vec4 vColor;
void main() { vec4 t = texture2D(map, vUv); float a = t.a * vColor.a; if (a < .003) discard; gl_FragColor = vec4(vColor.rgb * t.rgb, a); }`;

const CELLS = {dot: 0, streak: 1, star4: 2, ring: 3, arrowDown: 4, diamond: 5, shard: 6, spark: 7, smoke: 8, shock: 9, star: 10, arrowUp: 11, crack: 12, hex: 13, chunk: 14, arc: 15};
const MODES = {billboard: 0, ground: 1, axis: 2, plane: 3};

class ParticleBatch {
  constructor(capacity, blending, atlas, pool = null) {
    this.capacity = capacity; this.p = []; this.pool = pool;
    const quad = new T.PlaneGeometry(1, 1), g = new T.InstancedBufferGeometry();
    g.index = quad.index; g.setAttribute('position', quad.attributes.position); g.setAttribute('uv', quad.attributes.uv);
    const attr = (name, size) => { const a = new T.InstancedBufferAttribute(new Float32Array(capacity * size), size); a.setUsage(T.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    this.a = {pos: attr('iPos', 3), axis: attr('iAxis', 3), size: attr('iSize', 2), color: attr('iColor', 4), misc: attr('iMisc', 3)};
    g.instanceCount = 0; this.geometry = g;
    this.material = new T.ShaderMaterial({vertexShader: VERT, fragmentShader: FRAG, uniforms: {map: {value: atlas}},
      transparent: true, depthWrite: false, depthTest: blending !== T.AdditiveBlending, blending});
    this.mesh = new T.Mesh(g, this.material); this.mesh.frustumCulled = false; this.mesh.renderOrder = 950; this.mesh.visible = !!atlas;
  }
  add(p) { if (this.p.length >= this.capacity) { const dropped = this.p.shift(); if (dropped) this.pool?.releaseParticle(dropped); } this.p.push(p); }
  update(dt) {
    const keep = [];
    for (const p of this.p) {
      p.age += dt; if (p.age < 0) { keep.push(p); continue; } if (p.age >= p.life) { this.pool?.releaseParticle(p); continue; }
      const k = p.age / p.life;
      if (p.follow) { p.x += p.follow.dx; p.z += p.follow.dz; }
      p.vy -= (p.gravity || 0) * dt; const drag = Math.exp(-(p.drag || 0) * dt);
      p.vx *= drag; p.vy *= drag; p.vz *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.floor !== undefined && p.y < p.floor) { p.y = p.floor; p.vy = -p.vy * 0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.rot += (p.spin || 0) * dt; keep.push(p);
    }
    this.p = keep;
    const n = Math.min(this.p.length, this.capacity), A = this.a; let i = 0;
    for (const p of this.p) {
      if (p.age < 0) continue;
      const k = p.age / p.life, grow = p.sizeCurve ? p.sizeCurve(k) : 1 + (p.grow || 0) * k;
      const alpha = p.alpha * (p.alphaCurve ? p.alphaCurve(k) : Math.pow(1 - k, p.fade || 1));
      A.pos.array.set([p.x, p.y, p.z], i * 3); A.axis.array.set([p.ax ?? 0, p.ay ?? 1, p.az ?? 0], i * 3);
      A.size.array.set([p.w * grow, p.h * (p.stretchCurve ? p.stretchCurve(k) : grow)], i * 2);
      A.color.array.set([p.r, p.g, p.b, Math.max(0, alpha)], i * 4);
      A.misc.array.set([p.rot, p.cell, p.mode], i * 3);
      if (++i >= n) break;
    }
    this.geometry.instanceCount = i;
    for (const a of Object.values(A)) { a.clearUpdateRanges?.(); a.addUpdateRange?.(0, Math.max(1, i) * a.itemSize); a.needsUpdate = true; }
    return i;
  }
  clear() { this.p = []; this.geometry.instanceCount = 0; }
}

const colorToArray = (c) => { const col = new T.Color(c); return [col.r, col.g, col.b, 1]; };

function emitParticles(parts, pool, batchAdditive, batchNormal) {
  let produced = 0;
  for (const desc of parts) {
    const p = pool.acquireParticle();
    if (!p) continue;
    const col = colorToArray(desc.color ?? 0xffffff);
    p.age = desc.age ?? 0; p.life = desc.life;
    p.x = desc.x; p.y = desc.y; p.z = desc.z;
    p.vx = desc.vx; p.vy = desc.vy; p.vz = desc.vz;
    p.ax = desc.ax; p.ay = desc.ay; p.az = desc.az;
    p.w = desc.w; p.h = desc.h; p.rot = desc.rot; p.spin = desc.spin;
    p.cell = CELLS[desc.cell ?? 'dot'] ?? 0;
    p.mode = MODES[desc.mode ?? 'billboard'] ?? 0;
    p.color = desc.color ?? 0xffffff; p.alpha = desc.alpha ?? 1;
    p.additive = desc.additive !== undefined ? desc.additive : true;
    p.fade = desc.fade ?? 1.6; p.grow = desc.grow ?? 0;
    p.floor = desc.floor; p.gravity = desc.gravity; p.drag = desc.drag;
    p.sizeCurve = desc.sizeCurve; p.stretchCurve = desc.stretchCurve;
    p.alphaCurve = desc.alphaCurve; p.delay = desc.delay; p.follow = desc.follow;
    (p.additive ? batchAdditive : batchNormal).add(p);
    produced++;
  }
  return produced;
}

function resolveAnchor(anchor, ctx) {
  const {position, fighters} = ctx;
  switch (anchor) {
    case 'contact': return position ? {...position} : {x: 0, y: 0, z: 0};
    case 'ground': return position ? {x: position.x, y: 0, z: position.z} : {x: 0, y: 0, z: 0};
    case 'midpoint': {
      const a = fighters && fighters[0], b = fighters && fighters[1];
      if (a && b) return {x: (a.position.x + b.position.x) / 2, y: 0, z: (a.position.z + b.position.z) / 2};
      return position ? {x: position.x, y: 0, z: position.z} : {x: 0, y: 0, z: 0};
    }
    case 'attacker': {
      const id = ctx.attacker != null ? ctx.attacker : 0; const f = fighters && fighters[id];
      return f ? {...f.position} : (position ? {...position} : {x: 0, y: 0, z: 0});
    }
    case 'target': {
      const id = ctx.target != null ? ctx.target : 1; const f = fighters && fighters[id];
      return f ? {...f.position} : (position ? {...position} : {x: 0, y: 0, z: 0});
    }
    default: return position ? {...position} : {x: 0, y: 0, z: 0};
  }
}

export class VfxRuntime {
  constructor(scene, {camera = null, canvas = null, flashEl = null, quality = 'medium', maxParticles = 1400} = {}) {
    this.scene = scene;
    this.camera = camera;
    this.canvas = canvas;
    this.flashEl = flashEl;
    this.enabled = true;
    this.quality = quality;
    this.time = 0;
    this.atlas = this.makeAtlas();
    this.registry = null;
    this.scheduler = new Scheduler({maxConcurrent: 128});
    this.pools = new PoolManager({maxParticles});
    this.budget = new Budget({quality, limits: QUALITY_LIMITS[quality]});
    this.telemetry = new VfxTelemetry();
    this.cameraFeedback = new CameraFeedback({canvas, flashEl});
    this.add = new ParticleBatch(maxParticles, T.AdditiveBlending, this.atlas, this.pools);
    this.norm = new ParticleBatch(1024, T.NormalBlending, this.atlas, this.pools);
    scene.add(this.add.mesh, this.norm.mesh);
    this.beamRenderer = new BeamRenderer(scene, {quality});
    this.variants = new Map(); // family -> variantIndex
    this.activeEffects = new Map(); // instanceId → {effectDef, ctx, cost, spawned, releaseCb, releaseAt}
    this.stats = {spawned: 0, peak: 0, active: 0, firesByType: {}, byType: {}, beamsActive: 0};
    this.log = [];
    this.debugLog = false;
    this.contAcc = new Map(); // acumulador de efeitos contínuos por lutador/estado
    /** @type {((result: string) => boolean) | null} */ this.ownsParticles = null; // F5: filtro do despachante (null = dono de tudo, uso avulso)
  }
  setRegistry(registry) { this.registry = registry; }
  setQuality(quality) {
    this.quality = quality;
    this.budget.setQuality(quality);
    this.beamRenderer?.setQuality(quality);
  }
  setAccessibility(opts) {
    this.cameraFeedback.setAccessibility(opts);
    this.beamRenderer?.setConfig({
      reduceMotion: opts.preferReducedMotion || opts.reduceMotion,
      noFlash: opts.noFlash,
      highContrast: opts.highContrast,
    });
  }
  // Fonte única da escolha: C.vfx[família].variant (o que o painel mostra e o desfazer/refazer restauram).
  // setVariant só guarda famílias sem entrada em C.vfx e nunca sobrepõe o valor da configuração.
  setVariant(family, variant) {
    if (typeof C !== 'undefined' && C.vfx && C.vfx[family] && C.vfx[family].variant !== undefined) { this.variants.delete(family); return; }
    this.variants.set(family, variant | 0);
  }
  getVariant(family) {
    if (typeof C !== 'undefined' && C.vfx && C.vfx[family] && C.vfx[family].variant !== undefined) return C.vfx[family].variant | 0;
    return this.variants.has(family) ? this.variants.get(family) : 0;
  }
  typeToFamily(t) {
    const map = {hit: 'hit', partial: 'block', perfect: 'perfect', clash: 'clash', ground: 'ground', dodge: 'dodge', sprint: 'sprint', exhaust: 'exhaust', regen: 'regen', wall: 'wall'};
    return map[t] || t;
  }
  triggerCameraFeedback(ev) {
    if (!this.cameraFeedback) return;
    if (ev.type === 'hit') {
      const isHeavy = (ev.damage || 0) > 15;
      this.cameraFeedback.applyProfile(isHeavy ? 'heavyHit' : 'lightHit', {power: Math.min(2, (ev.damage || 10) / 15)});
    } else if (ev.type === 'perfect') {
      this.cameraFeedback.applyProfile('perfectBlock');
    } else if (ev.type === 'clash') {
      this.cameraFeedback.applyProfile('clash');
    } else if (ev.type === 'ground') {
      this.cameraFeedback.applyProfile('landing');
    }
  }
  preview(type, fighters = []) {
    const a = fighters?.[0] || {position: {x: -1, y: 0, z: 0}};
    const o = fighters?.[1] || {position: {x: 1, y: 0, z: 0}};
    if (type === 'laser' || type === 'beam') {
      const seg0 = {a: {x: a.position.x, y: 0.8, z: a.position.z}, b: {x: o.position.x, y: 0.8, z: o.position.z}, pl: this.beamRenderer?.config?.pl || 1};
      const fakeWorld = {
        entities: [{
          id: 9999, kind: 'beam', y: 0.8, pl: this.beamRenderer?.config?.pl || 1, dead: false,
          segments: [seg0]
        }]
      };
      this.beamRenderer?.update(fakeWorld, 0.016, {camera: this.camera, particleBatch: this.add, cameraFeedback: this.cameraFeedback});
      return;
    }
    const pos = {x: (a.position.x + o.position.x) / 2, y: 0, z: (a.position.z + o.position.z) / 2};
    const norm = {x: 0, y: 0, z: 1};
    const tick = Math.floor(this.time * 120);
    const evMap = {
      hit: {type: 'hit', damage: 20, position: {...o.position, y: 0.8}, normal: {x: 0, y: 0, z: 1}},
      block: {type: 'partial', damage: 5, position: {...o.position, y: 0.8}, normal: {x: 0, y: 0, z: 1}},
      perfect: {type: 'perfect', damage: 0, position: {...o.position, y: 0.8}, normal: {x: 0, y: 0, z: 1}},
      clash: {type: 'clash', damage: 10, position: pos, normal: {x: 1, y: 0, z: 0}},
      ground: {type: 'ground', damage: 0, position: {...a.position, y: 0}, normal: {x: 0, y: 1, z: 0}, power: 1.5},
      dodge: {type: 'dodge', damage: 0, position: {...a.position}, direction: {x: 0, y: 0, z: 1}},
      sprint: {type: 'sprint', damage: 0, position: {...a.position}, direction: {x: 0, y: 0, z: 1}, dx: 0, dz: 1},
      exhaust: {type: 'exhaust', damage: 0, position: {...a.position}, normal: {x: 0, y: 1, z: 0}},
      regen: {type: 'regen', damage: 0, position: {...a.position}, normal: {x: 0, y: 1, z: 0}},
    };
    const ev = evMap[type] || {type, damage: 10, position: pos, normal: norm};
    const vis = freezeVisualEvent({
      tick, eventId: `prev:${type}:${this.time}`,
      type: ev.type, position: ev.position, normal: ev.normal || norm, direction: ev.direction || {x: 0, y: 0, z: 1},
      damage: ev.damage, closingSpeed: 0, launch: null, surface: null,
      seed: 0.42, attacker: 0, target: 1, anchor: 'contact',
    });
    this.handleVisualEvent(vis, fighters?.length ? fighters : [a, o], []);
  }
  makeAtlas() {
    if (typeof document === 'undefined') return null;
    const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S * 4; const g = cv.getContext('2d');
    const cell = (i, draw) => { g.save(); g.translate((i % 4) * S, Math.floor(i / 4) * S); g.beginPath(); g.rect(0, 0, S, S); g.clip(); draw(S); g.restore(); };
    const radial = (stops, r = S / 2) => { const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, r); for (const [o, a] of stops) gr.addColorStop(o, `rgba(255,255,255,${a})`); return gr; };
    const star = (pts, inner, outer, jitter = 0) => { g.beginPath(); for (let k = 0; k < pts * 2; k++) { const a = k * Math.PI / pts - Math.PI / 2, r = (k % 2 ? inner : outer) * (1 + (k % 2 ? 0 : jitter * Math.sin(k * 7.3))); g.lineTo(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r); } g.closePath(); };
    cell(CELLS.dot, s => { g.fillStyle = radial([[0, 1], [.35, .55], [1, 0]]); g.fillRect(0, 0, s, s); });
    cell(CELLS.streak, s => { const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.25, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; const w = s * .18; g.beginPath(); g.ellipse(s / 2, s / 2, w, s / 2, 0, 0, Math.PI * 2); g.fill(); });
    cell(CELLS.star4, s => { g.fillStyle = radial([[0, 1], [.15, .9], [1, 0]]); star(4, s * .07, s * .5); g.fill(); });
    cell(CELLS.ring, s => { g.fillStyle = radial([[0, 0], [.68, 0], [.82, 1], [.92, .5], [1, 0]]); g.fillRect(0, 0, s, s); });
    cell(CELLS.shard, s => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(s * .5, s * .04); g.lineTo(s * .82, s * .7); g.lineTo(s * .38, s * .96); g.lineTo(s * .2, s * .42); g.closePath(); g.fill(); });
    cell(CELLS.spark, s => { g.fillStyle = radial([[0, 1], [.12, .8], [.4, .15], [1, 0]]); g.fillRect(0, 0, s, s); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(s * .47, s * .05, s * .06, s * .9); g.fillRect(s * .05, s * .47, s * .9, s * .06); });
    cell(CELLS.smoke, s => { for (let k = 0; k < 7; k++) { const a = k * 2.1, r = s * (.12 + .06 * Math.sin(k * 3.7)); const gr = g.createRadialGradient(s / 2 + Math.cos(a) * s * .14, s / 2 + Math.sin(a) * s * .14, 0, s / 2 + Math.cos(a) * s * .14, s / 2 + Math.sin(a) * s * .14, r * 1.9); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }});
    cell(CELLS.shock, s => { g.fillStyle = radial([[0, .25], [.5, .05], [.78, .15], [.88, 1], [.95, .35], [1, 0]]); g.fillRect(0, 0, s, s); });
    cell(CELLS.star, s => { g.fillStyle = radial([[0, 1], [.25, 1], [1, .2]]); star(7, s * .14, s * .48, .25); g.fill(); });
    cell(CELLS.arrowUp, s => { g.strokeStyle = '#fff'; g.lineWidth = s * .14; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(s * .2, s * .62); g.lineTo(s * .5, s * .3); g.lineTo(s * .8, s * .62); g.stroke(); });
    cell(CELLS.crack, s => { g.strokeStyle = '#fff'; g.lineCap = 'round'; for (let k = 0; k < 9; k++) { const a = k * 0.7 + Math.sin(k) * .4; g.lineWidth = s * (.05 - k * .003); g.beginPath(); g.moveTo(s / 2, s / 2); const m = s * (.22 + .05 * Math.sin(k * 5)); g.lineTo(s / 2 + Math.cos(a) * m, s / 2 + Math.sin(a) * m); g.lineTo(s / 2 + Math.cos(a + .25) * s * .46, s / 2 + Math.sin(a + .25) * s * .46); g.stroke(); }});
    cell(CELLS.hex, s => { g.fillStyle = radial([[0, .15], [.7, .3], [.9, 1], [1, .2]], s * .52); g.beginPath(); for (let k = 0; k < 6; k++) g.lineTo(s / 2 + Math.cos(k * Math.PI / 3) * s * .48, s / 2 + Math.sin(k * Math.PI / 3) * s * .48); g.closePath(); g.fill(); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = s * .04; g.stroke(); });
    cell(CELLS.chunk, s => { g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); for (let k = 0; k < 7; k++) { const a = k * Math.PI * 2 / 7, r = s * (.3 + .12 * Math.sin(k * 2.9)); g.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r); } g.closePath(); g.fill(); });
    cell(CELLS.arc, s => { const gr = g.createRadialGradient(s / 2, s * 1.35, s * .7, s / 2, s * 1.35, s * 1.25); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.55, 'rgba(255,255,255,.35)'); gr.addColorStop(.82, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.generateMipmaps = true; tex.minFilter = T.LinearMipmapLinearFilter;
    return tex;
  }
  update(fighters, simEvents, dt, {characters = [], paused = false, tick = 0, world = null, camera = null} = {}) {
    if (!this.enabled) {
      this.pools.clearAll(); this.activeEffects.clear(); this.scheduler.clear();
      this.add.clear(); this.norm.clear();
      this.budget.reset(); this.cameraFeedback.reset(); this.contAcc.clear();
      this.beamRenderer?.reset();
      return;
    }
    const frameDt = paused ? 0 : Math.min(dt, 0.05);
    this.time += frameDt;
    this.budget.beginFrame();
    // 1. Adaptar eventos da simulação para o contrato visual (somente leitura, nunca modifica a simulação).
    // F5: resultado sem tipo visual (reflected, blocked…) é pulado — antes freezeVisualEvent(null) devolvia null e
    // handleVisualEvent(null) lançava TypeError. ownsParticles (despachante, view/vfx/dispatch.js) diz se este runtime é o
    // dono das partículas do resultado no modo atual (three.quarks ligado assume as explosões que cobre); o feedback de câmera fica.
    const visualEvents = [];
    for (const ev of simEvents || []) {
      const vis = adaptSimEvent(ev, {fighters, tick});
      if (!vis) {this.stats.unmapped = (this.stats.unmapped || 0) + 1;continue;}
      visualEvents.push({vis: freezeVisualEvent(vis), particles: !this.ownsParticles || this.ownsParticles(ev.result)});
    }
    // 2. Disparar efeitos registrados para cada evento visual.
    for (const {vis, particles} of visualEvents) this.handleVisualEvent(vis, fighters, characters, particles);
    // 3. Efeitos contínuos por estado (exaustão, regeneração, invulnerabilidade).
    this.handleContinuous(fighters, characters, frameDt);
    // 4. Executar o scheduler (fases: spawn → sustain → decay → cancel).
    const removed = this.scheduler.tick(frameDt);
    // 5. Processar instâncias do scheduler: emitir partículas no spawn, liberar no done/cancel.
    this.processInstances(fighters, characters, frameDt, removed);
    // 6. Atualizar lotes de partículas.
    const nAdd = this.add.update(frameDt);
    const nNorm = this.norm.update(frameDt);
    this.stats.active = nAdd + nNorm;
    this.stats.peak = Math.max(this.stats.peak, this.stats.active);
    // 6.5. Atualizar feixes e laser dedicados (BeamRenderer).
    if (this.beamRenderer) {
      const activeBeams = this.beamRenderer.update(world, frameDt, {
        camera: this.camera || camera,
        particleBatch: this.add,
        cameraFeedback: this.cameraFeedback,
      });
      this.stats.beamsActive = activeBeams;
    }
    // 7. Feedback de câmera.
    const cam = this.cameraFeedback.update(frameDt, performance.now() / 1000, this.camera || camera);
    this.cameraFeedback.renderFlash();
    this.cameraFeedback.renderFilter();
    // 8. Telemetria: snapshot do quadro.
    const ps = this.pools.stats();
    this.telemetry.recordSnapshot({
      tick, activeObjects: ps.totalActive, peakParticles: this.stats.peak,
      drawCalls: 2, triangles: 0, cpuMs: 0, orphans: 0,
    });
    return {camera: cam, stats: this.stats};
  }
  handleVisualEvent(ev, fighters, characters, particles = true) {
    if (!ev) return;
    this.triggerCameraFeedback(ev);
    if (!particles) return;
    const family = this.typeToFamily(ev.type);
    const desiredVariant = this.getVariant(family);
    const candidates = [];
    for (const def of this.registry.list()) {
      if (def.trigger === ev.type) candidates.push(def);
    }
    const matching = candidates.filter(d => (d.variant ?? 0) === desiredVariant);
    const pool = matching.length > 0 ? matching : candidates;
    pool.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    for (const def of pool) {
      if (!this.shouldSpawn(def, ev, fighters)) continue;
      this.spawnEffect(def, ev, fighters, characters);
      if (def.aggregation === 'none') break;
    }
  }
  shouldSpawn(def, ev, fighters) {
    for (const cond of def.conditions || []) {
      if (cond.state) {
        const f = fighters[ev.target != null ? ev.target : 0];
        if (!f || f.state !== cond.state) return false;
      }
    }
    return true;
  }
  spawnEffect(def, ev, fighters, characters) {
    const anchorPos = resolveAnchor(def.anchor, {position: ev.position, fighters, attacker: ev.attacker, target: ev.target});
    const ctx = {
      tick: ev.tick, eventId: ev.eventId, type: ev.type,
      position: anchorPos, normal: ev.normal, direction: ev.direction,
      damage: ev.damage, closingSpeed: ev.closingSpeed, launch: ev.launch,
      surface: ev.surface, seed: ev.seed, attacker: ev.attacker, target: ev.target,
      fighters, characters, anchor: def.anchor,
    };
    const cost = this.estimateCost(def);
    const res = this.budget.reserve(def.family, cost);
    if (!res.ok) {
      this.telemetry.recordEffect({
        effect: def.id, tick: ev.tick, reason: 'suprimido por orçamento: ' + res.over.join(','),
        position: ev.position, anchor: def.anchor, normal: ev.normal, variant: def.variant,
        seed: ev.seed, duration: def.duration, particlesRequested: cost.particles, particlesProduced: 0, suppressed: true,
      });
      this.budget.suppress({effect: def.id, tick: ev.tick, reason: 'orçamento', position: ev.position,
        anchor: def.anchor, normal: ev.normal, variant: def.variant, seed: ev.seed, duration: def.duration});
      this.recordLog(def, ev, 'suprimido');
      return null;
    }
    const instId = this.scheduler.schedule(def, ctx);
    if (instId === null) { this.budget.release(cost); return null; }
    this.activeEffects.set(instId, {effectDef: def, ctx, cost, spawned: false, onRelease: null, releaseAt: 0});
    this.stats.firesByType[def.id] = (this.stats.firesByType[def.id] || 0) + 1;
    this.recordLog(def, ev, 'disparado');
    return instId;
  }
  estimateCost(def) {
    const lim = def.limits || {};
    return {particles: lim.particles || 16, rings: lim.rings || 0, lights: lim.lights || 0,
      trails: lim.trails || 0, decals: lim.decals || 0, drawCalls: 1};
  }
  handleContinuous(fighters, characters, dt) {
    for (let i = 0; i < fighters.length; i++) {
      const f = fighters[i];
      const states = [];
      if (f.exhausted) states.push('status:exhaust');
      if (f.staminaTrend > 1e-4 && f.stamina < 3 - 1e-6 && !f.sprinting && !f.exhausted && f.hp > 0) states.push('status:regen');
      for (const stateId of states) {
        const desiredVariant = this.getVariant(stateId === 'status:exhaust' ? 'exhaust' : 'regen');
        const def = this.registry.list().find(e => e.id === stateId && (e.variant ?? 0) === desiredVariant) || this.registry.getLatest(stateId);
        if (!def) continue;
        const key = `${stateId}:${i}`;
        const acc = (this.contAcc.get(key) || 0) + dt;
        const interval = stateId === 'status:exhaust' ? 0.14 : 0.2;
        if (acc >= interval) {
          this.contAcc.set(key, 0);
          this.contSeq = (this.contSeq || 0) + 1;
          const tick = Math.floor(this.time * 120);
          const base = Math.floor(eventSeed(tick, i, i, stateId.split(':')[1], f.position) * 4294967296) >>> 0;
          const seed = ((base * 31 + this.contSeq) >>> 0) / 4294967296;
          const ev = {
            tick, eventId: `cont:${stateId}:${i}:${seed}`,
            type: stateId.split(':')[1], position: {...f.position}, normal: {x: 0, y: 1, z: 0},
            direction: {x: 0, y: 1, z: 0}, damage: 0, closingSpeed: 0, launch: null,
            surface: null, seed, attacker: i, target: i, anchor: def.anchor,
          };
          this.spawnEffect(def, ev, fighters, characters);
        } else {
          this.contAcc.set(key, acc);
        }
      }
    }
  }
  processInstances(fighters, characters, dt, removedInstances = []) {
    const removedIds = new Set(removedInstances.map(i => i.instanceId));
    for (const [instId, entry] of this.activeEffects) {
      const inst = this.scheduler.instances.find(x => x.instanceId === instId);
      const removed = removedIds.has(instId);
      if (!inst && !removed) continue;
      // Na primeira vez que a instância é vista, emitir partículas (fase spawn).
      if (!entry.spawned && inst) {
        this.spawnInstanceParticles(entry, inst);
        entry.spawned = true;
      }
      // Liberação diferida (onRelease após 'hold' segundos, ex: Clash C).
      if (entry.onRelease && inst && inst.age >= entry.releaseAt && !entry.released) {
        try { this.emitParts(entry.onRelease(entry.ctx, entry.ctx.seed), entry); } catch (e) {}
        entry.released = true;
      }
      // Instância finalizada/cancelada: libera orçamento, execução onRelease pendente e remove.
      if (removed) {
        this.budget.release(entry.cost);
        if (entry.onRelease && !entry.released) {
          try { this.emitParts(entry.onRelease(entry.ctx, entry.ctx.seed), entry); } catch (e) {}
          entry.released = true;
        }
        this.activeEffects.delete(instId);
      }
    }
  }
  spawnInstanceParticles(entry, inst) {
    const {effectDef: def, ctx} = entry;
    const anchorPos = resolveAnchor(def.anchor, {...ctx, fighters: ctx.fighters, characters: ctx.characters});
    ctx.position = anchorPos;
    let result;
    try { result = def.build ? def.build(ctx, ctx.seed) : []; } catch (e) { result = []; }
    let parts = result; let onRelease = null; let hold = 0;
    if (result && result.parts !== undefined) { parts = result.parts; onRelease = result.onRelease; hold = result.hold || 0; }
    const produced = this.emitParts(parts, entry);
    entry.onRelease = onRelease;
    entry.releaseAt = inst.age + hold;
    entry.released = false;
    this.stats.spawned += produced;
    this.stats.byType[def.id] = (this.stats.byType[def.id] || 0) + produced;
    this.telemetry.recordEffect({
      effect: def.id, tick: ctx.tick, reason: ctx.reason || def.trigger,
      position: ctx.position, anchor: def.anchor, normal: ctx.normal,
      variant: def.variant, seed: ctx.seed, duration: def.duration,
      particlesRequested: parts ? parts.length : 0, particlesProduced: produced, suppressed: false,
    });
  }
  emitParts(parts, entry) {
    if (!parts) return 0;
    const produced = emitParticles(parts, this.pools, this.add, this.norm);
    return produced;
  }
  reset() {
    this.scheduler.clear(); this.activeEffects.clear();
    this.pools.clearAll(); this.add.clear(); this.norm.clear();
    this.budget.reset(); this.contAcc.clear(); this.contSeq = 0; this.time = 0;
    this.cameraFeedback.reset();
    this.beamRenderer?.reset();
    this.stats = {spawned: 0, peak: 0, active: 0, firesByType: {}, byType: {}, beamsActive: 0};
    this.log = [];
  }
  dispose() {
    this.reset();
    this.add.mesh.geometry.dispose(); this.add.mesh.material.dispose();
    this.norm.mesh.geometry.dispose(); this.norm.mesh.material.dispose();
    this.beamRenderer?.dispose();
  }
  recordLog(def, ev, action) {
    if (!this.debugLog) return;
    this.log.push({t: this.time, effect: def.id, variant: def.variant, action, tick: ev.tick, seed: ev.seed});
    if (this.log.length > 120) this.log.shift();
  }
}
