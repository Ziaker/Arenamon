import * as THREE from 'three';
import {forEachParticle, type ParticleEmitter, type SimulationOptions} from '../particles/particles';

// Prévia F3.1 — um THREE.Points por emissor, com todos os atributos atualizados in-place.
// Um draw call por emissor, sem alocar por partícula e sem estado entre quadros: o visual
// é função pura de (emissor, tempo, perfil, acessibilidade), igual à simulação testada.

const VERTEX = `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    float distance = max(0.001, -view.z);
    gl_PointSize = clamp(aSize * uScale / distance, 1.0, 96.0);
    vAlpha = aAlpha;
    vColor = aColor;
  }
`;
const FRAGMENT = `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 offset = gl_PointCoord - vec2(0.5);
    float radius = length(offset);
    if (radius > 0.5) discard;
    float soft = smoothstep(0.5, 0.06, radius);
    gl_FragColor = vec4(vColor, vAlpha * soft);
  }
`;

interface Entry {
  points: THREE.Points;
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  alphas: Float32Array;
  capacity: number;
  count: number;
  blending: string;
  depthWrite: boolean;
}

export interface ParticlePreviewReport {
  active: number;
  emitters: number;
  drawCalls: number;
  peakThisFrame: number;
}

/** Renderiza a simulação autoral; não decide eventos, colisão ou mecânica. */
export class ParticlePreview {
  readonly group = new THREE.Group();
  #entries = new Map<string, Entry>();
  #active = 0;
  #peak = 0;

  constructor(private readonly pixelRatio: () => number) {
    this.group.name = 'particles-preview';
  }

  update(emitters: readonly ParticleEmitter[], time: number, options: SimulationOptions = {}): ParticlePreviewReport {
    const seen = new Set<string>();
    let active = 0;
    for (const emitter of emitters) {
      if (!emitter.enabled) continue;
      seen.add(emitter.id);
      const entry = this.#entryFor(emitter);
      entry.count = 0;
      forEachParticle(emitter, time, particle => {
        if (entry.count >= entry.capacity) return;
        const index = entry.count++;
        const offset = index * 3;
        entry.positions[offset] = particle.x;
        entry.positions[offset + 1] = particle.y;
        entry.positions[offset + 2] = particle.z;
        entry.colors[offset] = particle.r;
        entry.colors[offset + 1] = particle.g;
        entry.colors[offset + 2] = particle.b;
        entry.sizes[index] = particle.size;
        entry.alphas[index] = particle.opacity;
      }, options);
      this.#applyMaterial(entry, emitter);
      entry.geometry.setDrawRange(0, entry.count);
      for (const name of ['position', 'aColor', 'aSize', 'aAlpha'] as const) entry.geometry.attributes[name].needsUpdate = entry.count > 0;
      active += entry.count;
    }
    for (const [id, entry] of [...this.#entries]) {
      if (seen.has(id)) continue;
      this.#disposeEntry(entry);
      this.#entries.delete(id);
    }
    this.#active = active;
    this.#peak = Math.max(this.#peak, active);
    return this.report;
  }

  resetPeak(): void { this.#peak = this.#active; }

  get report(): ParticlePreviewReport {
    return {active: this.#active, emitters: this.#entries.size, drawCalls: this.#entries.size, peakThisFrame: this.#peak};
  }

  dispose(): void {
    for (const entry of this.#entries.values()) this.#disposeEntry(entry);
    this.#entries.clear();
    this.group.removeFromParent();
    this.#active = 0;
    this.#peak = 0;
  }

  #entryFor(emitter: ParticleEmitter): Entry {
    const existing = this.#entries.get(emitter.id);
    // A capacidade só cresce: recriar garante que aumentar "Máx. vivas" apareça de verdade.
    if (existing && existing.capacity >= emitter.maxParticles) return existing;
    if (existing) {
      this.#disposeEntry(existing);
      this.#entries.delete(emitter.id);
    }
    const capacity = emitter.maxParticles;
    const positions = new Float32Array(capacity * 3);
    const colors = new Float32Array(capacity * 3);
    const sizes = new Float32Array(capacity);
    const alphas = new Float32Array(capacity);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {uScale: {value: 520}},
      transparent: true,
      depthWrite: emitter.look.depthWrite,
      depthTest: true,
      blending: emitter.look.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.userData.emitterId = emitter.id;
    this.group.add(points);
    const entry: Entry = {points, geometry, material, positions, colors, sizes, alphas, capacity, count: 0, blending: emitter.look.blending, depthWrite: emitter.look.depthWrite};
    this.#entries.set(emitter.id, entry);
    return entry;
  }

  #applyMaterial(entry: Entry, emitter: ParticleEmitter): void {
    entry.material.uniforms.uScale.value = 520 * this.pixelRatio();
    if (entry.blending !== emitter.look.blending) {
      entry.blending = emitter.look.blending;
      entry.material.blending = emitter.look.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending;
      entry.material.needsUpdate = true;
    }
    if (entry.depthWrite !== emitter.look.depthWrite) {
      entry.depthWrite = emitter.look.depthWrite;
      entry.material.depthWrite = emitter.look.depthWrite;
      entry.material.needsUpdate = true;
    }
  }

  #disposeEntry(entry: Entry): void {
    entry.points.removeFromParent();
    entry.geometry.dispose();
    entry.material.dispose();
  }
}
