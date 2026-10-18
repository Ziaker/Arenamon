// Fumaça volumétrica por raymarching de campo de distância (SDF): cada "cluster" (um efeito) reúne até 24 esferas que se FUNDEM numa
// massa contínua (união suave + ruído nas bordas), desenhada num cubo proxy. É 3D de verdade (gira com a câmera, escreve profundidade),
// sem sprites nem texturas de imagem: a única textura é a tabela numérica de esferas. O sombreamento é em tons chapados e a massa
// se esfarela por ruído no fim da vida. Só apresentação.
import * as T from 'three';

export const SMOKE_MAX_CLUSTERS = 48, SMOKE_MAX_SPHERES = 24;
const W = 32;

const VERT = `
attribute vec4 iMisc; attribute vec3 iBoxC; attribute vec3 iBoxH; attribute vec2 iAA; attribute vec3 iCol;
varying vec3 vWorld; varying vec4 vMisc; varying vec3 vBC; varying vec3 vBH; varying vec2 vAA; varying vec3 vCol;
void main() {
  vec3 pos = iBoxC + position * iBoxH * 2.0;
  vWorld = pos; vMisc = iMisc; vBC = iBoxC; vBH = iBoxH; vAA = iAA; vCol = iCol;
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}`;
const FRAG = `
uniform sampler2D uData; uniform vec3 uLight; uniform int uSteps; uniform mat4 projectionMatrix;
varying vec3 vWorld; varying vec4 vMisc; varying vec3 vBC; varying vec3 vBH; varying vec2 vAA; varying vec3 vCol;
float hash(vec3 p) { p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float map(vec3 p, int row, int n, float kk, float seed) {
  float d = 1e5;
  for (int i = 0; i < ${SMOKE_MAX_SPHERES}; i++) {
    if (i >= n) break;
    vec4 s = texelFetch(uData, ivec2(i, row), 0);
    vec3 q = p - s.xyz; float far = d + s.w + kk;
    if (d < 1e4 && dot(q, q) > far * far) continue;
    float di = length(q) - s.w;
    float h = clamp(.5 + .5 * (di - d) / kk, 0.0, 1.0);
    d = mix(di, d, h) - kk * h * (1.0 - h);
  }
  return d - .045 * (vnoise(p * 4.5 + seed * 7.0) - .5);
}
void main() {
  vec3 ro = cameraPosition, rd = normalize(vWorld - ro);
  vec3 bmin = vBC - vBH, bmax = vBC + vBH, inv = 1.0 / rd, t0 = (bmin - ro) * inv, t1 = (bmax - ro) * inv, tmn = min(t0, t1), tmx = max(t0, t1);
  float tn = max(max(tmn.x, tmn.y), max(tmn.z, 0.0)), tf = min(min(tmx.x, tmx.y), tmx.z);
  if (tf < tn) discard;
  int row = int(vMisc.x + .5), n = int(vMisc.y + .5); float kk = vMisc.z, seed = vMisc.w, t = tn; bool hit = false;
  for (int i = 0; i < 40; i++) {
    if (i >= uSteps) break;
    float d = map(ro + rd * t, row, n, kk, seed);
    if (d < .006) { hit = true; break; }
    t += max(d * .8, .004); if (t > tf) break;
  }
  if (!hit) discard;
  vec3 p = ro + rd * t;
  if (vnoise(p * 6.5 + seed * 13.0) < smoothstep(.5, 1.0, vAA.y) * 1.05) discard;
  vec2 e = vec2(.014, -.014);
  vec3 nrm = normalize(e.xyy * map(p + e.xyy, row, n, kk, seed) + e.yyx * map(p + e.yyx, row, n, kk, seed) + e.yxy * map(p + e.yxy, row, n, kk, seed) + e.xxx * map(p + e.xxx, row, n, kk, seed));
  float d = dot(nrm, normalize(uLight)) * .5 + .5;
  float band = d > .66 ? 1.0 : (d > .42 ? .78 : .56);
  vec3 col = vCol * band * (d > .66 ? vec3(1.0) : vec3(.93, .96, 1.03));
  gl_FragColor = vec4(col, vAA.x);
  vec4 clip = projectionMatrix * viewMatrix * vec4(p, 1.0);
  gl_FragDepth = (clip.z / clip.w) * .5 + .5;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class SmokeVolume {
  constructor(parent) {
    this.parent = parent; this.clusters = new Map(); this.dropped = 0; this.active = 0; this.maxClusters = 32;
    this.data = new Float32Array(W * SMOKE_MAX_CLUSTERS * 4);
    this.tex = new T.DataTexture(this.data, W, SMOKE_MAX_CLUSTERS, T.RGBAFormat, T.FloatType); this.tex.minFilter = this.tex.magFilter = T.NearestFilter; this.tex.generateMipmaps = false; this.tex.needsUpdate = true;
    this.material = new T.ShaderMaterial({vertexShader: VERT, fragmentShader: FRAG, uniforms: {uData: {value: this.tex}, uLight: {value: new T.Vector3(.3, .85, .45)}, uSteps: {value: 20}},
      transparent: true, depthWrite: true, side: T.BackSide});
    const g = new T.InstancedBufferGeometry(), box = new T.BoxGeometry(1, 1, 1);
    g.index = box.index; g.setAttribute('position', box.attributes.position);
    const attr = (name, size) => { const a = new T.InstancedBufferAttribute(new Float32Array(SMOKE_MAX_CLUSTERS * size), size); a.setUsage(T.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    this.a = {misc: attr('iMisc', 4), boxC: attr('iBoxC', 3), boxH: attr('iBoxH', 3), aa: attr('iAA', 2), col: attr('iCol', 3)};
    g.instanceCount = 0; this.geometry = g;
    this.mesh = new T.Mesh(g, this.material); this.mesh.frustumCulled = false; this.mesh.renderOrder = 5; this.mesh.name = 'smoke-volume'; parent.add(this.mesh);
  }
  /** Qualidade 0/1/2 (C.vfx.solid.quality): passos do raymarching e número de clusters desenhados por quadro. */
  setQuality(q) { this.material.uniforms.uSteps.value = [14, 20, 28][q] ?? 20; this.maxClusters = [16, 32, SMOKE_MAX_CLUSTERS][q] ?? 32; }
  /** Uma esfera do cluster `id` (posição e raio em metros; cor linear; opacidade; idade 0..1; semente). */
  add(id, x, y, z, r, cr, cg, cb, alpha, age, seed) {
    if (r < .004) return;
    let c = this.clusters.get(id); if (!c) { c = {n: 0, s: [], cr: 0, cg: 0, cb: 0, a: 0, age: 0, seed}; this.clusters.set(id, c); }
    if (c.n >= SMOKE_MAX_SPHERES) return;
    c.s.push(x, y, z, r); c.n++; c.cr += cr; c.cg += cg; c.cb += cb; c.a += alpha; c.age += age;
  }
  /** Envia os clusters do quadro para a GPU (uma linha da tabela e uma instância do cubo por cluster). */
  flush() {
    let row = 0; const A = this.a;
    for (const c of this.clusters.values()) {
      if (row >= this.maxClusters) { this.dropped++; continue; }
      let mnx = 1e9, mny = 1e9, mnz = 1e9, mxx = -1e9, mxy = -1e9, mxz = -1e9, rs = 0;
      for (let i = 0; i < c.n; i++) {
        const x = c.s[i * 4], y = c.s[i * 4 + 1], z = c.s[i * 4 + 2], r = c.s[i * 4 + 3], o = (row * W + i) * 4; this.data[o] = x; this.data[o + 1] = y; this.data[o + 2] = z; this.data[o + 3] = r;
        mnx = Math.min(mnx, x - r); mny = Math.min(mny, y - r); mnz = Math.min(mnz, z - r); mxx = Math.max(mxx, x + r); mxy = Math.max(mxy, y + r); mxz = Math.max(mxz, z + r); rs += r;
      }
      const kk = Math.max(.06, rs / c.n * 1.7), m = kk * .3 + .04;
      mnx -= m; mny -= m; mnz -= m; mxx += m; mxy += m; mxz += m;
      A.misc.array.set([row, c.n, kk, c.seed], row * 4); A.boxC.array.set([(mnx + mxx) / 2, (mny + mxy) / 2, (mnz + mxz) / 2], row * 3); A.boxH.array.set([(mxx - mnx) / 2, (mxy - mny) / 2, (mxz - mnz) / 2], row * 3);
      A.aa.array.set([c.a / c.n, c.age / c.n], row * 2); A.col.array.set([c.cr / c.n, c.cg / c.n, c.cb / c.n], row * 3); row++;
    }
    this.active = row; this.geometry.instanceCount = row; this.clusters.clear();
    for (const a of Object.values(A)) a.needsUpdate = true; this.tex.needsUpdate = true;
  }
  clear() { this.clusters.clear(); this.geometry.instanceCount = 0; this.active = 0; }
  dispose() { this.clear(); this.geometry.dispose(); this.material.dispose(); this.tex.dispose(); this.parent.remove(this.mesh); }
}
