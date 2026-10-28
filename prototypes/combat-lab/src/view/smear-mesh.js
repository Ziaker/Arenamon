import * as T from 'three';

const SLOTS = 64, VERTICES = 8, MAX_ANCHORS = 4;
const vertexShader = `attribute float life; attribute float neon;
varying float vLife; varying float vNeon;
void main(){vLife=life;vNeon=neon;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const fragmentShader = `uniform vec3 tint; uniform float opacity; uniform float outline;
varying float vLife; varying float vNeon;
void main(){float a=vLife*opacity*mix(1.0,vNeon,outline);if(a<0.002)discard;gl_FragColor=vec4(tint,a);
#include <colorspace_fragment>
}`;

/** Resolve âncoras uma vez, sem modificar transformações dos ossos. */
export function smearAnchors(character) {
  const bones = [];character.model.traverse(o => {if (o.isBone) bones.push(o);});
  const normalized = b => b.name.toLowerCase().replace(/^.*[:|]/, '').replace(/^mixamorig/, '').replace(/[^a-z0-9]/g, '');
  const find = pattern => bones.find(b => pattern.test(normalized(b)));
  const hand = side => find(new RegExp(`^(?:${side === 'l' ? 'left|l' : 'right|r'})(?:hand|fist)$|^(?:hand|fist)${side}$`));
  const head = find(/^(?:headtopend|head|crista|crest)$/);
  const bounds = new T.Box3().setFromObject(character.model), size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3());
  const result = [], add = (bone, label, world = null) => {
    if (!bone || result.length >= MAX_ANCHORS) return;
    result.push({bone, label, offset: world ? bone.worldToLocal(world.clone()) : null, current: new T.Vector3(), previous: new T.Vector3()});
  };
  const point = (x, y, z = center.z) => new T.Vector3(center.x + x * size.x, bounds.min.y + y * size.y, z);
  if (/mosh|mush|cogumelo/i.test(character.source.name)) {
    add(head || character.model, 'Chapéu esquerdo', point(-.42, .82));
    add(head || character.model, 'Chapéu direito', point(.42, .82));
  } else if (/vigor/i.test(character.source.name)) {
    add(find(/^(?:left|l).*(?:claw|index4|middle4|fingerend)/) || hand('l'), 'Garra esquerda');
    add(find(/^(?:right|r).*(?:claw|index4|middle4|fingerend)/) || hand('r'), 'Garra direita');
    add(find(/crest|crista/) || head || character.model, 'Topo da crista', point(0, .98));
  } else if (/wookada/i.test(character.source.name)) {
    add(hand('l'), 'Punho esquerdo');
    add(hand('r'), 'Punho direito');
    add(head || character.model, 'Chifre', point(0, .96));
  } else {
    add(hand('l'), 'Punho esquerdo');add(hand('r'), 'Punho direito');
    if (/croagunk/i.test(character.source.name)) {
      const chest = find(/^(?:chest|spine2)$/) || character.model;
      const left = find(/^(?:left|l)shoulder$/), right = find(/^(?:right|r)shoulder$/);
      add(left || chest, 'Dorso esquerdo', left ? null : point(-.25, .65));add(right || chest, 'Dorso direito', right ? null : point(.25, .65));
    } else add(head, 'Cabeça');
  }
  if (result.length < 2) {
    add(character.model, 'Âncora frontal esquerda', point(-.28, .7, bounds.max.z));
    add(character.model, 'Âncora frontal direita', point(.28, .7, bounds.max.z));
  }
  return result;
}

function characterColor(character) {
  let material = null, count = -1;
  character.model.traverse(o => {if (o.isMesh && (o.geometry?.attributes.position?.count ?? 0) > count) {count = o.geometry.attributes.position.count;material = Array.isArray(o.material) ? o.material[0] : o.material;}});
  const color = material?.color?.clone() || new T.Color(0xffffff);
  // A cor base de GLBs texturizados costuma ser branca. Amostra a textura somente na criação.
  const image = material?.map?.image;
  if (image && typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');canvas.width = canvas.height = 16;
      const context = canvas.getContext('2d', {willReadFrequently: true});context.drawImage(image, 0, 0, 16, 16);
      const pixels = context.getImageData(0, 0, 16, 16).data;let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 128) {r += pixels[i];g += pixels[i + 1];b += pixels[i + 2];n++;}
      if (n) color.multiply(new T.Color().setRGB(r / (255 * n), g / (255 * n), b / (255 * n), T.SRGBColorSpace));
    } catch { /* Textura indisponível: usa a cor do material. */ }
  }
  return color;
}

/** Pool fixo: 64 prismas fechados, 768 triângulos, dois draw calls no PL3. */
export class LimbSmear {
  constructor(scene, character, slot = 0) {
    this.character = character;this.anchors = smearAnchors(character);this.scene = scene;
    this.color = characterColor(character);this.accent = new T.Color(slot ? 0xff477e : 0x39ddff);
    this.positions = new Float32Array(SLOTS * VERTICES * 3);
    this.life = new Float32Array(SLOTS * VERTICES);this.neon = new Float32Array(SLOTS * VERTICES);
    this.ages = new Float64Array(SLOTS);this.durations = new Float64Array(SLOTS);this.used = new Uint8Array(SLOTS);
    this.geometry = new T.BufferGeometry();
    this.geometry.setAttribute('position', new T.BufferAttribute(this.positions, 3).setUsage(T.DynamicDrawUsage));
    this.geometry.setAttribute('life', new T.BufferAttribute(this.life, 1).setUsage(T.DynamicDrawUsage));
    this.geometry.setAttribute('neon', new T.BufferAttribute(this.neon, 1).setUsage(T.DynamicDrawUsage));
    const triangles = [], lines = [];
    for (let s = 0; s < SLOTS; s++) {
      const k = s * VERTICES;
      for (let j = 0; j < 4; j++) {const n = (j + 1) % 4;triangles.push(k + j, k + n, k + j + 4, k + n, k + n + 4, k + j + 4);lines.push(k + j, k + n, k + j + 4, k + n + 4, k + j, k + j + 4);}
      triangles.push(k, k + 2, k + 1, k, k + 3, k + 2, k + 4, k + 5, k + 6, k + 4, k + 6, k + 7);
    }
    this.geometry.setIndex(triangles);
    const material = tint => new T.ShaderMaterial({vertexShader, fragmentShader, uniforms: {tint: {value: tint}, opacity: {value: .85}, outline: {value: 0}}, transparent: true, depthWrite: false, side: T.DoubleSide});
    this.material = material(this.color.clone());this.mesh = new T.Mesh(this.geometry, this.material);this.mesh.frustumCulled = false;this.mesh.renderOrder = 4;
    this.edgeGeometry = new T.BufferGeometry();
    this.edgeGeometry.setAttribute('position', this.geometry.attributes.position);this.edgeGeometry.setAttribute('life', this.geometry.attributes.life);this.edgeGeometry.setAttribute('neon', this.geometry.attributes.neon);this.edgeGeometry.setIndex(lines);
    this.edgeMaterial = material(this.accent.clone().multiplyScalar(2));this.edgeMaterial.blending = T.AdditiveBlending;this.edgeMaterial.uniforms.outline.value = 1;
    this.edges = new T.LineSegments(this.edgeGeometry, this.edgeMaterial);this.edges.frustumCulled = false;this.edges.renderOrder = 5;
    scene.add(this.mesh, this.edges);this.reset();
  }
  reset() {
    this.used.fill(0);this.life.fill(0);this.geometry.attributes.life.needsUpdate = true;
    this.mesh.visible = this.edges.visible = false;this.cursor = 0;this.activeCount = 0;this.emitted = 0;
    this.ready = false;this.lastTick = -1;this.fighter = null;
  }
  emit(from, to, width, duration, neon) {
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, length = Math.hypot(dx, dy, dz);
    if (length < 1e-6) return;
    let sx = dz, sy = 0, sz = -dx, sn = Math.hypot(sx, sz);
    if (sn < 1e-6) {sx = 1;sz = 0;sn = 1;}sx /= sn;sz /= sn;
    const bx = (dy * sz - dz * sy) / length, by = (dz * sx - dx * sz) / length, bz = (dx * sy - dy * sx) / length;
    const slot = this.cursor;this.cursor = (slot + 1) % SLOTS;this.used[slot] = 1;this.ages[slot] = 0;this.durations[slot] = duration;this.emitted++;
    for (let j = 0; j < VERTICES; j++) {
      const tail = j < 4, r = width * (tail ? .08 : .5), p = tail ? from : to, corner = j % 4;
      const a = corner === 0 ? r : corner === 2 ? -r : 0, b = corner === 1 ? r * .25 : corner === 3 ? -r * .25 : 0;
      const v = slot * VERTICES + j, k = v * 3;
      this.positions[k] = p.x + sx * a + bx * b;this.positions[k + 1] = p.y + sy * a + by * b;this.positions[k + 2] = p.z + sz * a + bz * b;
      this.life[v] = 1;this.neon[v] = neon ? 1 : 0;
    }
    this.geometry.attributes.position.needsUpdate = true;this.geometry.attributes.neon.needsUpdate = true;
  }
  /** Sem alocação explícita no caminho por quadro. Posições já incluem animação e Squash & Stretch. */
  update(f, dt, options, tick, visible = true) {
    if (!visible || !options.enableSmear) {this.reset();return;}
    if (this.fighter !== f || tick < this.lastTick) this.reset();
    this.fighter = f;this.lastTick = tick;
    if (!(dt > 0)) return;
    if (dt > .1) {this.reset();return;} // Quadro muito atrasado: não desenha uma lâmina atravessando a arena.
    this.material.uniforms.tint.value.copy(options.smearColorMode === 1 ? this.accent : this.color);
    if (options.smearColorMode === 2) this.material.uniforms.tint.value.setHex(0xffffff);
    this.material.uniforms.opacity.value = options.smearOpacity;this.edgeMaterial.uniforms.opacity.value = options.smearOpacity;
    for (let i = 0; i < SLOTS; i++) if (this.used[i]) {
      this.ages[i] += dt;const remaining = Math.max(0, 1 - this.ages[i] / this.durations[i]);
      if (!remaining) this.used[i] = 0;
      for (let j = 0; j < VERTICES; j++) this.life[i * VERTICES + j] = remaining;
    }
    const action = f.action, active = f.hp > 0 && ((action?.kind === 'tackle' && !action.hits?.size) || (action?.kind === 'dodge' && !!options.smearOnDodge));
    const duration = Math.max(1, Math.min(4, options.smearDurationFrames)) / 60;
    const width = options.smearWidth * (options.smearPlBoost && action?.pl === 2 ? 1.25 : 1);
    this.character.root.updateMatrixWorld(true);
    for (let i = 0; i < this.anchors.length; i++) {
      const a = this.anchors[i];a.bone.getWorldPosition(a.current);
      if (a.offset) a.current.copy(a.offset).applyMatrix4(a.bone.matrixWorld);
      const distance = a.current.distanceTo(a.previous);
      if (this.ready && active && distance / dt > options.smearMinVelocity && distance < this.character.restHeight * this.character.root.scale.y * 2) {
        this.emit(a.previous, a.current, width, duration, !!options.smearPlBoost && action.pl === 3);
      }
      a.previous.copy(a.current);
    }
    this.ready = true;this.activeCount = 0;
    let hasNeon = false;
    for (let i = 0; i < SLOTS; i++) {this.activeCount += this.used[i];if (this.used[i] && this.neon[i * VERTICES]) hasNeon = true;}
    this.geometry.attributes.life.needsUpdate = true;
    this.mesh.visible = this.activeCount > 0;this.edges.visible = this.mesh.visible && !!options.smearPlBoost && hasNeon;
  }
  dispose() {
    this.mesh.removeFromParent();this.edges.removeFromParent();this.geometry.dispose();this.edgeGeometry.dispose();this.material.dispose();this.edgeMaterial.dispose();
    this.anchors.length = 0;
  }
}
