// Efeitos visuais do laboratório (overhaul). Separados das regras: só leem o estado e os eventos da simulação e
// nunca alteram física, tempos, cooldowns ou invulnerabilidade. Cada tipo tem três variantes realmente diferentes
// (A/B/C), toggle, parâmetros próprios (C.vfx.<tipo>), prévia e registro do motivo de cada disparo.
//
// Desempenho: todas as partículas usam um único InstancedBufferGeometry por modo de mistura (aditivo e normal),
// com atlas de texturas procedural, buffers reaproveitados e limite global de partículas (master.maxParticles).
import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {C, feintColor} from '../sim/config.js';
import {collisionProbe} from '../sim/collision-probe.js';
import {altitudeOf} from '../sim/entity.js';
import {MOVE_GROUP, MELEE_MOVES, MOVE_ELEMENT} from '../sim/move-hit-map.js';

const CELLS = {dot: 0, streak: 1, star4: 2, ring: 3, arrowDown: 4, diamond: 5, shard: 6, spark: 7, smoke: 8, shock: 9, star: 10, arrowUp: 11, crack: 12, hex: 13, chunk: 14, arc: 15};
const MODE = {billboard: 0, ground: 1, axis: 2, plane: 3};
export const VFX_TYPES = [
  ['hit', 'Impacto (hit)', ['A · Impacto radial', 'B · Estrela estilizada', 'C · Ondas de choque', 'D · Direcional (normal + força real)']],
  ['dodge', 'Speedlines da esquiva', ['A · Rastros direcionais', 'B · Cortes de velocidade', 'C · Fantasmas cinéticos']],
  ['sprint', 'Speedlines do sprint', ['A · Fluxo contínuo', 'B · Trilhas de energia', 'C · Túnel cinético localizado']],
  ['block', 'Bloqueio normal', ['A · Faíscas defensivas', 'B · Escudo translúcido', 'C · Onda de absorção', 'D · Escudo hexagonal']],
  ['perfect', 'Bloqueio perfeito', ['A · Explosão de contra-impacto', 'B · Ruptura temporal', 'C · Deflexão monumental']],
  ['ground', 'Colisão com o chão (knockback)', ['A · Explosão de poeira', 'B · Anel de impacto', 'C · Impacto fragmentado', 'D · Combinado (A + B + C)']],
  ['jumpLanding', 'Pouso do pulo regular', ['A · Onda circular simples']],
  ['wallImpact', 'Impacto vertical em paredes e objetos', ['A · Onda vertical + faísca + poeira']],
  ['clash', 'Clash entre tackles', ['A · Explosão central simétrica', 'B · Cruzamento de energia', 'C · Compressão e liberação']],
  ['exhaust', 'Exaustão (indicadores azuis)', ['A · Cachoeira de setas', 'B · Chuva de fragmentos', 'C · Cascata enfraquecida']],
  ['regen', 'Regeneração de stamina (amarelo)', ['A · Setas ascendentes', 'B · Linhas energéticas', 'C · Pulsos de recuperação']],
  ['rock', 'Rochas telecinéticas (Psyshock)', ['A · Boulder Facetado', 'B · Cristal Psíquico', 'C · Meteorito Runas']],
  ['barrier', 'Barreira de energia (Reflect)', ['A · Hex-Grid Ciclado', 'B · Cristal de Quartzo', 'C · Campo de Força Vibrante']],
];
/**
 * Gancho para o VFX de hit por ELEMENTO (preparado em 23/10/2026, ainda sem efeitos próprios): quando um elemento ganhar um hit dele, registre aqui
 * `HIT_BY_ELEMENT.fire = function (cfg, ctx) {...}` (chamada com o VFX como `this`); enquanto não houver entrada, o Move usa o hit normal do Tackle
 * com a COR do Move (C.vfx.moveHit). Chaves: ver MOVE_ELEMENT em sim/move-hit-map.js.
 * @type {Record<string, ((cfg: any, ctx: any) => void) | null>}
 */
export const HIT_BY_ELEMENT = {water: null, fire: null, air: null, grass: null, psychic: null, ground: null, normal: null};
/** Configuração do hit para um acerto: o hit do Tackle, com a cor do Move quando houver (e estiver ligada). */
function hitConfigFor(move) {
  const group = MOVE_GROUP[move], tint = group ? C.vfx.moveHit?.[group] : null;
  return tint && tint.enabled ? {...C.vfx.hit, color: tint.color, color2: tint.color2} : C.vfx.hit;
}
/** Tremor de câmera do hit: Moves corpo a corpo (e o Tackle) mantêm o padrão; os demais só tremem com o interruptor do Move ligado, com intensidade e duração próprias. */
function hitShakeFor(move) {
  if (!move || MELEE_MOVES.has(move)) return {on: true, power: 1, dur: 1};
  const w = C.world[MOVE_GROUP[move]];
  return w?.hitShakeOn ? {on: true, power: w.hitShakeAmount ?? 1, dur: w.hitShakeDuration ?? 1} : {on: false, power: 0, dur: 1};
}
export const SHAKE_EVENTS = [['shakeGuard', 'Tremor ao defender'], ['shakeHit', 'Tremor ao sofrer hit'], ['shakeGround', 'Tremor ao colidir com o chão'], ['shakePerfect', 'Tremor na defesa perfeita'], ['shakeClash', 'Tremor no clash entre tackles'], ['shakeWall', 'Tremor ao bater em parede ou objeto']];
export const SHAKE_PROFILES = ['A · Impacto seco', 'B · Oscilação amortecida', 'C · Pulso direcional'];

// ---------- Atlas procedural (4 × 4 células de 128 px) ----------
function makeAtlas() {
  if (typeof document === 'undefined') return null;
  const S = 128, cv = document.createElement('canvas');cv.width = cv.height = S * 4;const g = cv.getContext('2d');
  const cell = (i, draw) => {g.save();g.translate((i % 4) * S, Math.floor(i / 4) * S);g.beginPath();g.rect(0, 0, S, S);g.clip();draw(S);g.restore();};
  const radial = (stops, r = S / 2) => {const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, r);for (const [o, a] of stops) gr.addColorStop(o, `rgba(255,255,255,${a})`);return gr;};
  const star = (pts, inner, outer, jitter = 0) => {g.beginPath();for (let k = 0; k < pts * 2; k++) {const a = k * Math.PI / pts - Math.PI / 2, r = (k % 2 ? inner : outer) * (1 + (k % 2 ? 0 : jitter * Math.sin(k * 7.3)));g.lineTo(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r);}g.closePath();};
  cell(CELLS.dot, s => {g.fillStyle = radial([[0, 1], [.35, .55], [1, 0]]);g.fillRect(0, 0, s, s);});
  cell(CELLS.streak, s => {const gr = g.createLinearGradient(0, 0, 0, s);gr.addColorStop(0, 'rgba(255,255,255,0)');gr.addColorStop(.25, 'rgba(255,255,255,.9)');gr.addColorStop(1, 'rgba(255,255,255,0)');g.fillStyle = gr;const w = s * .18;g.beginPath();g.ellipse(s / 2, s / 2, w, s / 2, 0, 0, Math.PI * 2);g.fill();});
  cell(CELLS.star4, s => {g.fillStyle = radial([[0, 1], [.15, .9], [1, 0]]);star(4, s * .07, s * .5);g.fill();});
  cell(CELLS.ring, s => {g.fillStyle = radial([[0, 0], [.68, 0], [.82, 1], [.92, .5], [1, 0]]);g.fillRect(0, 0, s, s);});
  cell(CELLS.arrowDown, s => {g.fillStyle = '#fff';g.beginPath();g.moveTo(s * .5, s * .9);g.lineTo(s * .12, s * .45);g.lineTo(s * .36, s * .45);g.lineTo(s * .36, s * .1);g.lineTo(s * .64, s * .1);g.lineTo(s * .64, s * .45);g.lineTo(s * .88, s * .45);g.closePath();g.fill();});
  cell(CELLS.diamond, s => {g.fillStyle = radial([[0, 1], [.6, .85], [1, .3]]);g.beginPath();g.moveTo(s / 2, s * .05);g.lineTo(s * .8, s / 2);g.lineTo(s / 2, s * .95);g.lineTo(s * .2, s / 2);g.closePath();g.fill();});
  cell(CELLS.shard, s => {g.fillStyle = '#fff';g.beginPath();g.moveTo(s * .5, s * .04);g.lineTo(s * .82, s * .7);g.lineTo(s * .38, s * .96);g.lineTo(s * .2, s * .42);g.closePath();g.fill();});
  cell(CELLS.spark, s => {g.fillStyle = radial([[0, 1], [.12, .8], [.4, .15], [1, 0]]);g.fillRect(0, 0, s, s);g.fillStyle = 'rgba(255,255,255,.85)';g.fillRect(s * .47, s * .05, s * .06, s * .9);g.fillRect(s * .05, s * .47, s * .9, s * .06);});
  cell(CELLS.smoke, s => {for (let k = 0; k < 7; k++) {const a = k * 2.1, r = s * (.12 + .06 * Math.sin(k * 3.7));const gr = g.createRadialGradient(s / 2 + Math.cos(a) * s * .14, s / 2 + Math.sin(a) * s * .14, 0, s / 2 + Math.cos(a) * s * .14, s / 2 + Math.sin(a) * s * .14, r * 1.9);gr.addColorStop(0, 'rgba(255,255,255,.55)');gr.addColorStop(1, 'rgba(255,255,255,0)');g.fillStyle = gr;g.fillRect(0, 0, s, s);}});
  cell(CELLS.shock, s => {g.fillStyle = radial([[0, .25], [.5, .05], [.78, .15], [.88, 1], [.95, .35], [1, 0]]);g.fillRect(0, 0, s, s);});
  cell(CELLS.star, s => {g.fillStyle = radial([[0, 1], [.25, 1], [1, .2]]);star(7, s * .14, s * .48, .25);g.fill();});
  cell(CELLS.arrowUp, s => {g.strokeStyle = '#fff';g.lineWidth = s * .14;g.lineCap = 'round';g.lineJoin = 'round';g.beginPath();g.moveTo(s * .2, s * .62);g.lineTo(s * .5, s * .3);g.lineTo(s * .8, s * .62);g.stroke();});
  cell(CELLS.crack, s => {g.strokeStyle = '#fff';g.lineCap = 'round';for (let k = 0; k < 9; k++) {const a = k * 0.7 + Math.sin(k) * .4;g.lineWidth = s * (.05 - k * .003);g.beginPath();g.moveTo(s / 2, s / 2);const m = s * (.22 + .05 * Math.sin(k * 5));g.lineTo(s / 2 + Math.cos(a) * m, s / 2 + Math.sin(a) * m);g.lineTo(s / 2 + Math.cos(a + .25) * s * .46, s / 2 + Math.sin(a + .25) * s * .46);g.stroke();}});
  cell(CELLS.hex, s => {g.fillStyle = radial([[0, .15], [.7, .3], [.9, 1], [1, .2]], s * .52);g.beginPath();for (let k = 0; k < 6; k++) g.lineTo(s / 2 + Math.cos(k * Math.PI / 3) * s * .48, s / 2 + Math.sin(k * Math.PI / 3) * s * .48);g.closePath();g.fill();g.strokeStyle = 'rgba(255,255,255,.9)';g.lineWidth = s * .04;g.stroke();});
  cell(CELLS.chunk, s => {g.fillStyle = 'rgba(255,255,255,.95)';g.beginPath();for (let k = 0; k < 7; k++) {const a = k * Math.PI * 2 / 7, r = s * (.3 + .12 * Math.sin(k * 2.9));g.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r);}g.closePath();g.fill();});
  cell(CELLS.arc, s => {const gr = g.createRadialGradient(s / 2, s * 1.35, s * .7, s / 2, s * 1.35, s * 1.25);gr.addColorStop(0, 'rgba(255,255,255,0)');gr.addColorStop(.55, 'rgba(255,255,255,.35)');gr.addColorStop(.82, 'rgba(255,255,255,1)');gr.addColorStop(1, 'rgba(255,255,255,0)');g.fillStyle = gr;g.fillRect(0, 0, s, s);});
  const tex = new T.CanvasTexture(cv);tex.colorSpace = T.SRGBColorSpace;tex.generateMipmaps = true;tex.minFilter = T.LinearMipmapLinearFilter;return tex;
}

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

/** Pool de partículas em um único draw call. */
class ParticleBatch {
  constructor(capacity, blending, atlas) {
    this.capacity = capacity;this.count = 0;this.p = [];
    const quad = new T.PlaneGeometry(1, 1), g = new T.InstancedBufferGeometry();
    g.index = quad.index;g.setAttribute('position', quad.attributes.position);g.setAttribute('uv', quad.attributes.uv);
    const attr = (name, size) => {const a = new T.InstancedBufferAttribute(new Float32Array(capacity * size), size);a.setUsage(T.DynamicDrawUsage);g.setAttribute(name, a);return a;};
    this.a = {pos: attr('iPos', 3), axis: attr('iAxis', 3), size: attr('iSize', 2), color: attr('iColor', 4), misc: attr('iMisc', 3)};
    g.instanceCount = 0;this.geometry = g;
    // Brilhos aditivos ficam visíveis através dos corpos (o impacto nunca some atrás do personagem); poeira respeita a profundidade.
    this.material = new T.ShaderMaterial({vertexShader: VERT, fragmentShader: FRAG, uniforms: {map: {value: atlas}}, transparent: true, depthWrite: false, depthTest: blending !== T.AdditiveBlending, blending, side: T.DoubleSide});   // DoubleSide: o quad do modo «ground» (no plano XZ) tem a face de trás voltada para cima e era descartado pelo culling, então anéis e ondas no chão nunca apareciam
    this.mesh = new T.Mesh(g, this.material);this.mesh.frustumCulled = false;this.mesh.renderOrder = 950;this.mesh.visible = !!atlas;
  }
  add(p) {if (this.p.length >= this.capacity) this.p.shift();this.p.push(p);}
  update(dt) {
    const keep = [];
    for (const p of this.p) {
      p.age += dt;if (p.age < 0) {keep.push(p);continue;}if (p.age >= p.life) continue;
      const k = p.age / p.life;
      if (p.follow) {p.x += p.follow.dx;p.z += p.follow.dz;}
      p.vy -= (p.gravity || 0) * dt;const drag = Math.exp(-(p.drag || 0) * dt);p.vx *= drag;p.vy *= drag;p.vz *= drag;
      p.x += p.vx * dt;p.y += p.vy * dt;p.z += p.vz * dt;if (p.floor !== undefined && p.y < p.floor) {p.y = p.floor;p.vy = -p.vy * .3;p.vx *= .6;p.vz *= .6;}
      p.rot += (p.spin || 0) * dt;keep.push(p);
    }
    this.p = keep;const n = Math.min(this.p.length, this.capacity), A = this.a;let i = 0;
    for (const p of this.p) {
      if (p.age < 0) continue;const k = p.age / p.life, grow = p.sizeCurve ? p.sizeCurve(k) : 1 + (p.grow ?? 0) * k;
      const alpha = p.alpha * (p.alphaCurve ? p.alphaCurve(k) : Math.pow(1 - k, p.fade ?? 1));
      A.pos.array.set([p.x, p.y, p.z], i * 3);A.axis.array.set([p.ax ?? 0, p.ay ?? 1, p.az ?? 0], i * 3);A.size.array.set([p.w * grow, p.h * (p.stretchCurve ? p.stretchCurve(k) : grow)], i * 2);
      A.color.array.set([p.r, p.g, p.b, Math.max(0, alpha)], i * 4);A.misc.array.set([p.rot, p.cell, p.mode], i * 3);
      if (++i >= n) break;
    }
    // Envia só a parte usada dos buffers.
    this.geometry.instanceCount = i;for (const a of Object.values(A)) {a.clearUpdateRanges?.();a.addUpdateRange?.(0, Math.max(1, i) * a.itemSize);a.needsUpdate = true;}
    return i;
  }
  clear() {this.p = [];this.geometry.instanceCount = 0;}
}

const rand = (a, b) => a + Math.random() * (b - a);
const ease = {outCubic: k => 1 - Math.pow(1 - k, 3), pop: k => k < .15 ? k / .15 : 1 - .25 * (k - .15) / .85, inOut: k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2};

export class VfxSystem {
  constructor(scene, {flashEl = null, canvas = null} = {}) {
    this.scene = scene;this.atlas = makeAtlas();this.flashEl = flashEl;this.canvas = canvas;
    this.add = new ParticleBatch(4096, T.AdditiveBlending, this.atlas);this.norm = new ParticleBatch(2048, T.NormalBlending, this.atlas);
    scene.add(this.add.mesh, this.norm.mesh);
    this.log = [];this.timers = [];this.emit = new Map();this.shakes = [];this.ghosts = [];this.stats = {spawned: 0, peak: 0};
    this.seenEvents = new WeakSet();this.contactSeen = [];this.wallLastFire = [];this.landings = [];this.brakes = [];this.prevPos = [];this.prevStamina = [];this.flash = null;this.freezeUntil = 0;
    this.accessibility = {noFlash: false, reduceMotion: false, highContrast: false};
    // Custo por tipo (medidor de desempenho e filtro “mais caros”): partículas criadas e disparos.
    this.stats.byType = {};this.stats.firesByType = {};this.emitting = null;
  }
  setAccessibility(a = {}) {
    this.accessibility = {...this.accessibility, ...a};
    if (this.accessibility.reduceMotion) this.shakes = [];
    if (this.accessibility.noFlash && this.flashEl) {this.flash = null;this.flashEl.style.opacity = '0';}
  }
  get cfg() {return C.vfx;}
  enabled(type) {return !!C.vfx.master.enabled && !!C.vfx[type]?.enabled;}
  record(type, reason, extra = {}) {if (!C.vfx.master.debugLog) return;this.log.push({t: +(performance.now() / 1000).toFixed(2), effect: type, variant: 'ABCD'[C.vfx[type]?.variant ?? 0] ?? '-', reason, ...extra});if (this.log.length > 120) this.log.shift();}
  /** Uma partícula. o: {x,y,z, vx,vy,vz, life, w,h, cell, mode, color, alpha, additive, …}. */
  spawn(o) {
    const total = this.add.p.length + this.norm.p.length;if (total >= C.vfx.master.maxParticles) return;
    const c = new T.Color(o.color ?? 0xffffff);let glow = o.glow ?? 1;
    let alpha = o.alpha ?? 1;
    let vx = o.vx || 0, vy = o.vy || 0, vz = o.vz || 0;
    const isReduceMotion = !!(this.accessibility?.reduceMotion || C.vfx.master?.reduceMotion || C.vfx.laser?.reduceMotion);
    const isHighContrast = !!(this.accessibility?.highContrast || C.vfx.master?.highContrast || C.vfx.laser?.highContrast);
    if (isReduceMotion) {vx *= 0.25;vy *= 0.25;vz *= 0.25;}
    if (isHighContrast) {alpha = Math.max(0.85, alpha);glow = Math.max(1.8, glow);}
    const lift = this.lift ?? 0;   // altura do apoio (plataforma, caixa) sob o efeito: tudo que nasce "no chão" nasce NO apoio
    const p = {age: -(o.delay || 0), life: Math.max(.02, o.life ?? .4), x: o.x, y: (o.y ?? 0) + lift, z: o.z, vx, vy, vz, gravity: o.gravity, drag: o.drag, floor: o.floor === undefined ? o.floor : o.floor + (this.floorLift ?? lift),
      w: o.w ?? .3, h: o.h ?? o.w ?? .3, grow: o.grow, sizeCurve: o.sizeCurve, stretchCurve: o.stretchCurve, alphaCurve: o.alphaCurve, fade: o.fade, alpha,
      r: Math.min(4, c.r * glow), g: Math.min(4, c.g * glow), b: Math.min(4, c.b * glow), cell: CELLS[o.cell ?? 'dot'], mode: MODE[o.mode ?? 'billboard'], rot: o.rot ?? 0, spin: o.spin, ax: o.ax, ay: o.ay, az: o.az, follow: o.follow};
    (o.additive === false ? this.norm : this.add).add(p);this.stats.spawned++;if (this.emitting) this.stats.byType[this.emitting] = (this.stats.byType[this.emitting] ?? 0) + 1;
  }
  after(delay, fn) {const lift = this.lift ?? 0, fl = this.floorLift ?? lift;this.timers.push({at: this.time + delay, fn: lift ? () => {const s = this.lift, sf = this.floorLift;this.lift = lift;this.floorLift = fl;try {fn();} finally {this.lift = s;this.floorLift = sf;}} : fn});}
  reset() {this.add.clear();this.norm.clear();this.timers = [];this.shakes = [];this.emit.clear();this.flash = null;for (const g of this.ghosts) g.obj.visible = false;}
  // ---------- Disparo por eventos da simulação ----------
  /**
   * Chamado a cada quadro com os lutadores, os eventos recentes e os personagens (para fantasmas e trilhas).
   * dt = 0 com a partida pausada (os efeitos congelam junto).
   */
  update(fighters, events, dt, {characters = [], camera = null, world = null} = {}) {
    this.time = (this.time ?? 0) + dt;this.camera = camera;this.characters = characters;
    for (const e of events) {
      if (this.seenEvents.has(e)) continue;this.seenEvents.add(e);
      if (e.result === 'ledgeGrab') {this.fire('wallImpact', {pos: {x: e.x, z: e.z}, y: e.y, base: e.base, n: e.n, power: .6, w: e.w, h: e.h, arena: false}, `agarre de borda (${(e.w ?? 0).toFixed(1)} × ${(e.h ?? 0).toFixed(1)} m)`);continue;}   // Ledge Grab: reaproveita o impacto vertical, escalado pelo sólido
      const a = fighters[e.attacker], b = fighters[e.target];
      if (!b && (e.target != null)) continue;
      if (!b && !a) continue;
      if ((e.result === 'wallSplat' || e.result === 'destructibleSplat') && b) {
        const tag = `evento ${e.result} (passo ${e.tick ?? '?'}: impacto no cenário em ${e.target === 0 ? 'azul' : 'vermelho'})`;
        this.fire('hit', {pos: b.position, lift: altitudeOf(b), floorLift: b.groundY ?? 0, n: e.normal, power: 1.4}, tag);
        this.shake('shakeClash', e.normal, 1, tag);
        continue;
      }
      if (!a || !b) continue;
      const tag = `evento ${e.result} (passo ${e.tick ?? '?'}: ${e.attacker === 0 ? 'azul' : 'vermelho'} → ${e.target === 0 ? 'azul' : 'vermelho'})`;
      if (e.result === 'impact') {const hs = hitShakeFor(e.move);this.fire('hit', {pos: b.position, lift: altitudeOf(b), floorLift: b.groundY ?? 0, n: e.normal, power: e.slam ? 1.5 : e.riposte ? 1.9 : 1, damage: e.damage, launch: e.launch, move: e.move}, tag);if (hs.on) this.shake(e.slam ? 'shakeGround' : 'shakeHit', e.normal, (e.slam ? 1.4 : e.riposte ? (C.world.riposte?.shakeMult ?? 1) : 1) * hs.power, tag, hs.dur);}
      else if (e.result === 'wallSplat') {this.fire('hit', {pos: b.position, lift: altitudeOf(b), floorLift: b.groundY ?? 0, n: e.normal, power: 1.4}, tag);this.shake('shakeClash', e.normal, 1, tag);}
      else if (e.result === 'footstool') {const n = e.normal ?? {x: 0, z: 0};this.fire('hit', {pos: {x: b.position.x, z: b.position.z}, lift: altitudeOf(b), floorLift: b.groundY ?? 0, n, power: 0.7}, tag);this.shake('shakeHit', n, 0.6, tag);}
      else if (e.result === 'partial') {this.fire('block', {pos: b.position, lift: altitudeOf(b), floorLift: b.groundY ?? 0, n: e.normal, power: 1}, tag);this.shake('shakeGuard', e.normal, 1, tag);}
      else if (e.result === 'perfect') {this.fire('perfect', {pos: b.position, lift: altitudeOf(b), floorLift: b.groundY ?? 0, n: e.normal, power: 1, fighters}, tag);this.shake('shakePerfect', e.normal, 1, tag);}
      else if (e.result === 'clash' && e.attacker === 0) {const mid = {x: (a.position.x + b.position.x) / 2, z: (a.position.z + b.position.z) / 2};this.fire('clash', {pos: mid, lift: (altitudeOf(a) + altitudeOf(b)) / 2, n: e.normal, power: 1}, tag);this.shake('shakeClash', e.normal, 1, tag);}
    }
    fighters.forEach((f, i) => {
      // Impacto do meteor slam no chão: sempre que o mergulho toca o chão, acertando ou não.
      if (f.action?.slam && f.action.groundHit && !(this.slamSeen ??= new WeakSet()).has(f.action)) {
        this.slamSeen.add(f.action);const tag = 'impacto do meteor slam no chão';
        this.fire('ground', {pos: {x: f.position.x, z: f.position.z}, lift: f.groundY ?? 0, power: C.rules.slamImpactScale}, tag);this.shake('shakeGround', null, C.rules.slamImpactShake, tag);
      }
      // Colisão real com o solo depois do voo (evento físico da simulação, não da animação).
      const L = f.lastLanding;
      if (L && this.landings[i] !== undefined && L.n !== this.landings[i]) {
        const impact = L.vertical, cfg = C.vfx.ground;
        if (L.regular) {   // pulo regular: só a onda circular simples, sem tremor (o efeito de colisão com o chão é de knockback e meteor slam)
          const jl = C.vfx.jumpLanding;
          if (impact >= (jl.minImpact ?? 0)) this.fire('jumpLanding', {pos: {x: L.x, z: L.z}, lift: L.y ?? 0, power: Math.min(2, impact / 7)}, `pouso do pulo regular (vertical ${impact.toFixed(1)} m/s)`);
          else this.record('jumpLanding', `pouso abaixo do mínimo (${impact.toFixed(1)} < ${jl.minImpact} m/s): sem efeito`);
        } else if (impact >= cfg.minImpact) {const power = Math.min(2, impact / 7);const tag = `colisão com o solo (vertical ${impact.toFixed(1)} m/s)`;this.fire('ground', {pos: {x: L.x, z: L.z}, lift: L.y ?? 0, power}, tag);this.shake('shakeGround', null, power, tag);}
        else this.record('ground', `colisão abaixo do mínimo (${impact.toFixed(1)} < ${cfg.minImpact} m/s): sem efeito`);
      }
      this.landings[i] = L?.n ?? 0;
      // Finta (brake slide): poeira nos pés quando o lutador derrapa para cancelar o tackle.
      this.trackWallContact(f, i, world);
      if (f.ledgeHint && C.ledge?.hint && dt > 0) {   // borda agarrável ao alcance: faixa verde sobre a borda, ao longo da face
        const h = f.ledgeHint, t = {x: h.n.z, z: -h.n.x};
        this.spawn({x: h.x, y: h.y + .02, z: h.z, life: .1, w: .07, h: 1.6, cell: 'streak', mode: 'axis', ax: t.x, ay: 0, az: t.z, color: 0x7dffb0, glow: 2.2, alpha: .9, fade: 1});
      }
      const prev = this.prevPos[i] ?? {...f.position};const dx = f.position.x - prev.x, dz = f.position.z - prev.z;this.prevPos[i] = {...f.position};
      if (dt <= 0) return;
      const alt = (f.flight?.y ?? f.groundY ?? 0) + (f.vaultHeight ?? 0);
      if (f.action?.kind === 'dodge') {
        const R = C.rules, tint = !!f.action.feint && !!R.feintFxOn, d = C.vfx.dodge, saved = tint ? {...d} : null;
        if (tint) {d.color = feintColor(R.feintFxColor);d.intensity = (d.intensity ?? 1) * R.feintFxIntensity;d.length = (d.length ?? 1) * R.feintFxSize;d.width = (d.width ?? 1) * R.feintFxSize;}
        try {this.stream('dodge', f, dt, {alt, dx, dz, i});} finally {if (tint) Object.assign(d, saved);}
      }
      else this.emit.delete(`dodge${i}`);
      if (f.sprinting || (this.previewUntil?.sprint > this.time && i === 0)) this.stream('sprint', f, dt, {alt, dx, dz, i});else this.emit.delete('sprint' + i);
      const ex = C.vfx.exhaust, exTarget = ex.target === 1 || (ex.target === 0 ? i === 1 : i === 0);
      if ((f.exhausted && exTarget && f.hp > 0) || (this.previewUntil?.exhaust > this.time && i === 0)) this.stream('exhaust', f, dt, {alt, dx, dz, i});else this.emit.delete('exhaust' + i);
      // Regeneração real: stamina subindo, não cheia, sem sprint (a curva da simulação define a taxa).
      // Durante a exaustão o indicador azul tem prioridade (sem setas amarelas sobrepostas no mesmo lutador).
      const regenRate = f.staminaTrend ?? 0, regenOn = regenRate > 1e-4 && f.stamina < C.rules.staminaMax - 1e-6 && !f.sprinting && !f.exhausted && f.hp > 0;
      if (regenOn || (this.previewUntil?.regen > this.time && i === 0)) this.stream('regen', f, dt, {alt, dx, dz, i, rate: regenOn ? regenRate : C.rules.staminaMax / C.rules.regenTime});
      else this.emit.delete('regen' + i);
    });
    this.syncFollowers(fighters);
    for (const t of this.timers.filter(t => t.at <= this.time)) t.fn();this.timers = this.timers.filter(t => t.at > this.time);
    const n = this.add.update(dt) + this.norm.update(dt);this.stats.peak = Math.max(this.stats.peak, n);this.stats.active = n;
    this.updateGhosts(dt);this.updateFlash(dt);
  }
  /**
   * Contato real com a parede da arena ou com um objeto do cenário (sonda de colisão da física): dispara o impacto vertical só na PRIMEIRA batida depois de um intervalo sem contato
   * e acima da velocidade mínima do choque (andar encostado na parede não repete). O tamanho do objeto vem do mapa (largura e altura).
   */
  trackWallContact(f, i, world) {
    const W = C.vfx.wallImpact, c = collisionProbe.byFighter[f.id], last = this.contactSeen[i];
    if (!W || !c || (last && c.step === last.step)) return;
    const fresh = !last || c.step < last.step || c.step - last.step > 12 || last.kind !== c.kind || last.id !== c.id;
    this.contactSeen[i] = {step: c.step, kind: c.kind, id: c.id};
    if (!fresh) return;
    const arena = c.kind === 'arena';
    if (!(arena ? W.arenaOn : ['platform', 'obstacle', 'destructible'].includes(c.kind) && W.objectsOn)) return;
    const speed = Math.max(0, -(c.vBefore.x * c.normal.x + c.vBefore.z * c.normal.z));
    if (speed < W.minSpeed) {this.record('wallImpact', `contato abaixo da velocidade mínima (${speed.toFixed(1)} < ${W.minSpeed} m/s): sem efeito`);return;}
    if ((this.time ?? 0) - (this.wallLastFire[i] ?? -9) < W.cooldown) return;
    this.wallLastFire[i] = this.time ?? 0;
    const sz = this.contactSize(c, world, W), bodyH = C.extras?.visual?.bodyHeight ?? 1.2, alt = (f.flight?.y ?? f.groundY ?? 0) + (f.vaultHeight ?? 0);
    const y = Math.max(sz.base + .15, Math.min(alt + bodyH * .55, sz.base + sz.h - .1)), he = C.test.halfExtent;
    const tag = `${arena ? 'parede da arena' : c.kind} ${c.id ?? ''} (choque ${speed.toFixed(1)} m/s · ${sz.w.toFixed(1)} × ${sz.h.toFixed(1)} m)`;
    this.fire('wallImpact', {pos: {x: c.x - c.normal.x * he, z: c.z - c.normal.z * he}, y, base: sz.base, n: c.normal, power: Math.min(2.5, speed / 8), w: sz.w, h: sz.h, arena}, tag);
    this.shake('shakeWall', c.normal, Math.min(2, speed / 8), tag);
  }
  /** Largura, altura e base (m) do objeto tocado, lidas do mapa (a parede da arena usa a «altura equivalente» dos controles). */
  contactSize(c, world, W) {
    const ms = world?.mapState, ref = W.refSize, dflt = {w: ref, h: ref, base: 0};
    if (c.kind === 'arena') return {w: W.arenaHeight, h: W.arenaHeight, base: 0};
    if (c.kind === 'platform') {const p = ms?.platforms?.find(o => o.id === c.id);return p ? {w: Math.max(p.width ?? ref, p.depth ?? ref), h: p.height ?? ref, base: p.pos?.y ?? 0} : dflt;}
    if (c.kind === 'obstacle') {const o = ms?.obstacles?.find(q => q.id === c.id);return o ? {w: o.shape === 'box' ? 2 * Math.max(o.hx ?? 1, o.hz ?? 1) : 2 * (o.radius ?? 1), h: o.height ?? ref, base: o.pos?.y ?? 0} : dflt;}
    if (c.kind === 'destructible') {const d = ms?.destructibles?.find(q => q.id === c.id);return d?.size ? {w: 2 * Math.max(d.size.hx ?? 1, d.size.hz ?? 1), h: d.size.height ?? ref, base: d.pos?.y ?? 0} : dflt;}
    return dflt;
  }
  /** Efeito pontual (hit, bloqueios, chão, clash): respeita toggle e variante, registra o motivo. */
  fire(type, ctx, reason) {
    if (!this.enabled(type)) {this.record(type, `${reason} · desligado`);return;}
    this.record(type, reason);const v = C.vfx[type].variant | 0;this.emitting = type;this.lift = ctx?.lift ?? 0;this.floorLift = ctx?.floorLift ?? ctx?.lift ?? 0;this.stats.firesByType[type] = (this.stats.firesByType[type] ?? 0) + 1;
    const handlers = {
      hit: [this.hitA, this.hitB, this.hitC, this.hitD],
      block: [this.blockA, this.blockB, this.blockC, this.blockD],
      perfect: [this.perfectA, this.perfectB, this.perfectC],
      ground: [this.groundA, this.groundB, this.groundC, this.groundD],
      clash: [this.clashA, this.clashB, this.clashC],
      jumpLanding: [this.jumpLandA],
      wallImpact: [this.wallImpactA],
      rock: [this.rockA, this.rockB, this.rockC],
      barrier: [this.barrierA, this.barrierB, this.barrierC]
    };
    try {
      const list = handlers[type];
      const byElement = type === 'hit' && ctx?.move ? HIT_BY_ELEMENT[MOVE_ELEMENT[ctx.move]] : null;   // hit próprio do elemento (futuro); null = hit do Tackle
      if (byElement) byElement.call(this, hitConfigFor(ctx.move), ctx);
      else if (list) (list[v] ?? list[0]).call(this, type === 'hit' ? hitConfigFor(ctx?.move) : C.vfx[type], ctx);
      // Bloqueio: brilho de contato sempre voltado para a câmera, para o feedback nunca sumir (escudos planos podem ficar de perfil).
      if (type === 'block' && v !== 0) {const p = this.frontOf(ctx.pos, ctx.n, .5), c = C.vfx.block;this.spawn({x: p.x, y: .8, z: p.z, life: c.duration * .4, w: .55 * c.size, cell: 'spark', color: c.color, glow: 1.3 * c.intensity, alpha: c.opacity, grow: .6 * c.expansion, fade: 1.5});}

    } finally {this.emitting = null;this.lift = 0;this.floorLift = 0;}
  }
  /** Efeitos contínuos (esquiva, sprint, exaustão, regeneração): emissão por intervalo, por lutador. */
  stream(type, f, dt, ctx) {
    if (!this.enabled(type)) return;const cfg = C.vfx[type], key = type + ctx.i;
    let s = this.emit.get(key);if (!s) {s = {acc: 0, t: 0, n: 0};this.emit.set(key, s);this.record(type, ({dodge: 'esquiva em curso', sprint: 'sprint em curso', exhaust: 'lutador exausto', regen: 'stamina regenerando'})[type] + ` (${ctx.i ? 'vermelho' : 'azul'})`);}
    const interval = type === 'dodge' ? cfg.interval : type === 'sprint' ? 1 / Math.max(.5, cfg.frequency * cfg.density) : type === 'exhaust' ? cfg.interval : 1 / Math.max(.5, cfg.frequency);
    s.acc += dt;s.t += dt;
    while (s.acc >= interval) {s.acc -= interval;s.n++;this.emitting = type;this.stats.firesByType[type] = (this.stats.firesByType[type] ?? 0) + 1;({dodge: [this.dodgeA, this.dodgeB, this.dodgeC], sprint: [this.sprintA, this.sprintB, this.sprintC], exhaust: [this.exhaustA, this.exhaustB, this.exhaustC], regen: [this.regenA, this.regenB, this.regenC]})[type][cfg.variant | 0].call(this, cfg, f, ctx, s);this.emitting = null;}
  }
  // ---------- Prévia ----------
  /** Dispara o efeito perto do lutador azul (ou mostra a emissão contínua por 1,6 s). */
  preview(type, fighters) {
    // Prévia no adversário (de frente para a câmera); a normal aponta do azul (atacante) para ele, como num golpe real.
    const a = fighters[0], o = fighters[1] ?? fighters[0], d = Math.max(1e-6, Math.hypot(o.position.x - a.position.x, o.position.z - a.position.z));
    const n = o === a ? {x: 0, z: 1} : {x: (o.position.x - a.position.x) / d, z: (o.position.z - a.position.z) / d}, f = o;
    const ahead = {x: (a.position.x + o.position.x) / 2, z: (a.position.z + o.position.z) / 2};
    if (['dodge', 'sprint', 'exhaust', 'regen'].includes(type)) {
      this.previewUntil = {...(this.previewUntil || {}), [type]: (this.time ?? 0) + 1.6};this.record(type, 'prévia (1,6 s)');
      if (type === 'dodge') {const fake = {...f, action: {kind: 'dodge', heading: Math.atan2(-n.x, -n.z)}, position: {...f.position}};let t = 0;const tick = () => {if ((t += .016) > 1.6) return;this.stream('dodge', fake, .016, {alt: 0, dx: 0, dz: 0, i: 9});this.after(.016, tick);};tick();}
      return;
    }
    const tag = 'prévia manual';
    if (type === 'clash') this.fire(type, {pos: ahead, n: {x: -n.x, z: -n.z}, power: 1}, tag);
    else if (type === 'ground') this.fire(type, {pos: f.position, power: 1}, tag);
    else if (type === 'rock') {
      this.fire('rock', {pos: f.position, n, power: 1}, tag);
      if (this.view?.worldView?.emitRockShatter) this.view.worldView.emitRockShatter(f.position.x, 0.8, f.position.z, n, 0x59d6e6);
    } else if (type === 'barrier') {
      this.fire('barrier', {pos: f.position, n, power: 1}, tag);
      if (this.view?.worldView?.emitBarrierShatter) this.view.worldView.emitBarrierShatter(f.position.x, 0.8, f.position.z, 0x59d6e6);
    }
    else this.fire(type, {pos: f.position, n, power: 1, fighters}, tag);
    const shakeFor = {hit: 'shakeHit', block: 'shakeGuard', perfect: 'shakePerfect', ground: 'shakeGround', clash: 'shakeClash', wallImpact: 'shakeWall'}[type];if (shakeFor) this.shake(shakeFor, n, 1, tag);
  }
  // ---------- POUSO DO PULO REGULAR ----------
  jumpLandA(c, {pos, power = 1}) { // Só uma onda circular rente ao chão (sem tremor, poeira, fagulhas nem rachadura).
    const k = 1 + (power - 1) * (c.fallScale ?? .5), n = Math.max(1, Math.round(c.rings ?? 1));
    for (let r = 0; r < n; r++) this.spawn({x: pos.x, y: .03, z: pos.z, delay: r * c.duration * .18, life: c.duration, w: .4, mode: 'ground', cell: 'ring', color: c.color, glow: .8 * c.intensity, alpha: c.opacity * (1 - r * .25), fade: c.fade, sizeCurve: t => 1 + ease.outCubic(t) * 4 * c.radius * k * (c.expansion ?? 1)});
  }
  // ---------- IMPACTO VERTICAL EM PAREDES E OBJETOS ----------
  wallImpactA(c, ctx) { // Onda no plano da parede + faixa vertical de luz + faíscas ao longo da parede + poeira que sobe. Tudo escala com o tamanho do objeto e a velocidade do choque.
    const nx = ctx.n?.x ?? 0, nz = ctx.n?.z ?? 1, len = Math.hypot(nx, nz) || 1, n = {x: nx / len, z: nz / len}, t = {x: n.z, z: -n.x};
    const w = ctx.w ?? c.refSize, h = ctx.h ?? c.refSize, sz = Math.max(.4, Math.min(2.5, Math.sqrt(Math.max(.01, w * h)) / Math.max(.1, c.refSize)));
    const S = c.size * c.intensity * (1 + (sz - 1) * c.sizeInfluence) * (ctx.arena ? c.arenaScale : c.objectScale) * (1 + ((ctx.power ?? 1) - 1) * c.speedScale);
    if (!(S > 0)) return;
    const px = ctx.pos.x + n.x * .04, pz = ctx.pos.z + n.z * .04, y = ctx.y ?? .75, base = ctx.base ?? 0, rise = Math.min(h, 4);
    if (c.wallRing && c.wallRingSize > 0) this.spawn({x: px, y, z: pz, life: c.duration * .7, w: .35 * S, mode: 'plane', ax: n.x, ay: 0, az: n.z, cell: 'ring', color: c.color, glow: c.glow, alpha: c.opacity, fade: c.fade, sizeCurve: k => 1 + ease.outCubic(k) * 3 * c.wallRingSize});
    if (c.wallStreak && c.wallStreakLength > 0) this.spawn({x: px, y: y + .1 * rise * c.wallStreakLength, z: pz, life: c.duration * .55, w: .13 * S, h: (.7 + .3 * rise) * S * c.wallStreakLength, cell: 'streak', mode: 'axis', ax: 0, ay: 1, az: 0, color: c.color2, glow: c.glow * 1.2, alpha: c.opacity, fade: c.fade, stretchCurve: k => 1.1 - k * .8});
    if (c.wallSparks && c.wallSparkLength > 0) for (let k = 0, cnt = Math.round(c.wallSparkCount * S); k < cnt; k++) {
      const a = rand(-1, 1) * 1.3, e = rand(-.2, 1), sp = 6 * rand(.6, 1.2) * Math.min(2, S), v = {x: t.x * Math.sin(a) * sp + n.x * rand(.15, .6) * sp, y: e * sp * .9, z: t.z * Math.sin(a) * sp + n.z * rand(.15, .6) * sp}, vl = Math.hypot(v.x, v.y, v.z) || 1;
      this.spawn({x: px, y, z: pz, vx: v.x, vy: v.y, vz: v.z, gravity: 9, drag: 3.2, life: c.duration * rand(.6, 1.1), w: .05 * S, h: .45 * c.wallSparkLength * Math.min(2, S), cell: 'streak', mode: 'axis', ax: v.x / vl, ay: v.y / vl, az: v.z / vl, color: k % 3 ? c.color : c.color2, glow: c.glow, alpha: c.opacity, fade: c.fade, floor: .03});
    }
    if (c.wallDust && c.wallDustAmount > 0) for (let k = 0, cnt = Math.round(5 * c.wallDustAmount * S); k < cnt; k++) this.spawn({x: px + t.x * rand(-.6, .6) * S, y: base + .12, z: pz + t.z * rand(-.6, .6) * S, vx: n.x * rand(.2, .9), vy: rand(.6, 1.6) * c.wallDustRise * Math.min(2, S), vz: n.z * rand(.2, .9), drag: 1.6, life: c.duration * rand(1.8, 3), w: rand(.3, .55) * S, grow: 1.5, cell: 'smoke', color: 0xd9d2c4, glow: .9, alpha: c.opacity * .4, fade: 1.4, rot: rand(0, 6), spin: rand(-1.5, 1.5), additive: false});
  }
  // ---------- HIT ----------
  hitA(c, {pos, n}) { // Impacto radial: linhas radiais curtas + partículas, com núcleo brilhante.
    const y = .75, I = c.intensity, cnt = Math.round(c.count * I);
    this.spawn({x: pos.x, y, z: pos.z, life: c.duration * .5, w: .9 * c.size, cell: 'dot', color: 0xffffff, glow: c.glow, alpha: c.opacity, fade: c.fade, grow: .6});
    for (let k = 0; k < cnt; k++) {
      const a = k / cnt * Math.PI * 2 + rand(-.2, .2), up = rand(-.25, .55), sp = c.speed * rand(.7, 1.2) * I, dir = {x: Math.cos(a), y: up, z: Math.sin(a)};
      this.spawn({x: pos.x, y, z: pos.z, vx: dir.x * sp, vy: dir.y * sp, vz: dir.z * sp, drag: 5, life: c.duration * rand(.6, 1), w: .07 * c.size, h: .55 * c.size, cell: 'streak', mode: 'axis', ax: dir.x, ay: dir.y, az: dir.z, color: c.color, glow: c.glow, alpha: c.opacity, fade: c.fade, stretchCurve: k2 => 1.4 - k2});
      if (k % 2 === 0) this.spawn({x: pos.x, y, z: pos.z, vx: dir.x * sp * .5, vy: dir.y * sp * .5 + 1, vz: dir.z * sp * .5, gravity: 9, life: c.duration * 1.3, w: .08 * c.size, cell: 'spark', color: c.color, glow: c.glow, alpha: c.opacity, fade: c.fade});
    }
  }
  hitB(c, {pos}) { // Estrela irregular + fragmentos geométricos girando.
    const y = .8, I = c.intensity;
    this.spawn({x: pos.x, y, z: pos.z, life: c.duration * .55, w: 1.6 * c.size, cell: 'star', color: c.color, glow: c.glow * 1.3, alpha: c.opacity, fade: c.fade, rot: rand(0, 6), sizeCurve: ease.pop});
    this.spawn({x: pos.x, y, z: pos.z, life: c.duration * .3, w: .9 * c.size, cell: 'star4', color: 0xffffff, glow: c.glow, alpha: c.opacity, rot: rand(0, 6), grow: 1.2, fade: c.fade});
    const cnt = Math.round(c.count * .6 * I);
    for (let k = 0; k < cnt; k++) {const a = rand(0, Math.PI * 2), sp = c.speed * rand(.5, 1) * I;this.spawn({x: pos.x, y, z: pos.z, vx: Math.cos(a) * sp, vy: rand(1, 4) * I, vz: Math.sin(a) * sp, gravity: 12, drag: 2, life: c.duration * rand(1, 1.6), w: rand(.08, .16) * c.size, cell: k % 2 ? 'shard' : 'diamond', color: c.color, glow: c.glow, alpha: c.opacity, fade: c.fade, rot: rand(0, 6), spin: rand(-14, 14)});}
  }
  hitC(c, {pos, n}) { // Ondas de choque: anéis rápidos em sequência + onda no chão + pontos no perímetro.
    const y = .75, I = c.intensity;
    for (let k = 0; k < 3; k++) this.spawn({x: pos.x, y, z: pos.z, delay: k * c.duration * .12, life: c.duration * .7, w: .4 * c.size, cell: k === 1 ? 'shock' : 'ring', color: c.color, glow: c.glow, alpha: c.opacity * (1 - k * .2), fade: c.fade, sizeCurve: k2 => 1 + ease.outCubic(k2) * c.speed * .6 * I});
    this.spawn({x: pos.x, y: .03, z: pos.z, life: c.duration, w: .5 * c.size, mode: 'ground', cell: 'ring', color: c.color, glow: c.glow * .8, alpha: c.opacity * .8, fade: c.fade, sizeCurve: k2 => 1 + ease.outCubic(k2) * c.speed * .8 * I});
    const cnt = Math.round(c.count * .5 * I);
    for (let k = 0; k < cnt; k++) {const a = k / cnt * Math.PI * 2;this.spawn({x: pos.x, y, z: pos.z, vx: Math.cos(a) * c.speed * .8, vy: Math.sin(a) * c.speed * .3, vz: Math.sin(a) * c.speed * .8, drag: 6, life: c.duration * .8, w: .07 * c.size, cell: 'dot', color: 0xffffff, glow: c.glow, alpha: c.opacity, fade: c.fade});}
    void n;
  }
  hitD(c, {pos, n, power = 1, damage, launch}) { // Direcional: tudo nasce da normal real do golpe; a força vem do dano e do lançamento reais.
    const nx = n?.x ?? 0, nz = n?.z ?? 0, len = Math.hypot(nx, nz), d = len > 1e-6 ? {x: nx / len, z: nz / len} : {x: 0, z: 1}, side = {x: d.z, z: -d.x}, y = .8;
    // Força 0,6–1,8: dano relativo ao ataque padrão + empurrão horizontal relativo ao lançamento padrão (byDamage 0 = sempre 1×).
    const real = (damage == null ? 1 : .55 + .45 * Math.min(2, damage / Math.max(1, C.test.attack))) * (launch ? .75 + .25 * Math.min(2, launch.horizontal / Math.max(1, C.rules.launchHorizontal)) : 1);
    const S = c.intensity * power * (1 + (real - 1) * c.byDamage), cnt = Math.max(3, Math.round(c.count * S));
    const hot = c.color2, ahead = {x: pos.x + d.x * .35 * c.size, z: pos.z + d.z * .35 * c.size};
    // Camadas ligáveis e dimensionáveis (valor ausente em ajustes antigos = padrão): o responsável pode remover os círculos (núcleo e anéis) e afinar cada peça.
    const on = (k) => (c[k] ?? 1) !== 0, num = (k, dflt = 1) => c[k] ?? dflt, ringA = num('ringOpacity');
    // Flash curto: núcleo quente + lâmina de luz alongada na direção do golpe.
    if (on('coreOn') && num('coreSize') > 0) this.spawn({x: pos.x, y, z: pos.z, life: c.duration * .32, w: .85 * c.size * S * num('coreSize'), cell: 'dot', color: hot, glow: c.glow * 1.5, alpha: c.opacity, fade: c.fade, grow: .5});
    if (on('bladeOn') && num('bladeLength') > 0 && num('bladeWidth') > 0) this.spawn({x: pos.x, y, z: pos.z, life: c.duration * .4, w: .16 * c.size * num('bladeWidth'), h: 1.9 * c.size * S * num('bladeLength'), cell: 'streak', mode: 'axis', ax: d.x, ay: 0, az: d.z, color: hot, glow: c.glow * 1.3, alpha: c.opacity, fade: c.fade, stretchCurve: k => 1.2 - k * .9});
    // Anel de pressão perpendicular ao golpe (plano vertical com a normal como eixo) + anel rente ao chão.
    if (on('ringPlaneOn') && num('ringPlaneSize') > 0 && ringA > 0) this.spawn({x: ahead.x, y, z: ahead.z, life: c.duration * .65, w: .3 * c.size, mode: 'plane', ax: d.x, ay: 0, az: d.z, cell: 'ring', color: c.color, glow: c.glow, alpha: c.opacity * .85 * ringA, fade: c.fade, sizeCurve: k => 1 + ease.outCubic(k) * c.speed * .45 * S * num('ringPlaneSize')});
    if (on('ringGroundOn') && num('ringGroundSize') > 0 && ringA > 0) this.spawn({x: pos.x, y: .03, z: pos.z, life: c.duration * .85, w: .4 * c.size, mode: 'ground', cell: 'ring', color: c.color, glow: c.glow * .7, alpha: c.opacity * .55 * ringA, fade: c.fade, sizeCurve: k => 1 + ease.outCubic(k) * c.speed * .5 * S * num('ringGroundSize')});
    // Cone de fagulhas: sai para a frente do golpe (atravessando o alvo) com abertura ajustável; menos para trás (respingo).
    for (let k = 0; k < cnt; k++) {
      const fwd = (k * .618034) % 1 >= num('backSplash', .25), a = rand(-1, 1) * c.cone, e = rand(-.15, .45), dir = fwd ? {x: d.x * Math.cos(a) + side.x * Math.sin(a), z: d.z * Math.cos(a) + side.z * Math.sin(a)} : {x: -d.x * Math.cos(a * 1.8) + side.x * Math.sin(a * 1.8), z: -d.z * Math.cos(a * 1.8) + side.z * Math.sin(a * 1.8)};
      const sp = c.speed * rand(.6, 1.25) * S * (fwd ? 1 : .55), v = {x: dir.x * sp, y: e * sp * .6, z: dir.z * sp};
      if (on('sparksOn') && num('sparkLength') > 0 && num('sparkWidth') > 0) this.spawn({x: pos.x, y, z: pos.z, vx: v.x, vy: v.y, vz: v.z, drag: 4.5, life: c.duration * rand(.55, 1), w: .06 * c.size * num('sparkWidth'), h: .5 * c.size * num('sparkLength'), cell: 'streak', mode: 'axis', ax: dir.x, ay: e * .6, az: dir.z, color: k % 3 ? c.color : hot, glow: c.glow, alpha: c.opacity, fade: c.fade, stretchCurve: k2 => 1.4 - k2});
      if (k % 2 === 0 && on('embersOn') && num('emberSize') > 0) this.spawn({x: pos.x, y, z: pos.z, vx: v.x * .55, vy: v.y * .55 + 1.2, vz: v.z * .55, gravity: 10, life: c.duration * rand(1, 1.5), w: .075 * c.size * num('emberSize'), cell: 'spark', color: c.color, glow: c.glow, alpha: c.opacity, fade: c.fade, floor: .03});
    }
    // Detritos: lascas que quicam no chão (não aditivas, para terem corpo).
    const nDeb = Math.round(5 * c.debris * S);
    for (let k = 0; k < nDeb; k++) {
      const a = rand(-1, 1) * c.cone * 1.3, sp = c.speed * rand(.35, .8) * S;
      this.spawn({x: pos.x, y: y - .1, z: pos.z, vx: (d.x * Math.cos(a) + side.x * Math.sin(a)) * sp, vy: rand(1.5, 4.5) * S, vz: (d.z * Math.cos(a) + side.z * Math.sin(a)) * sp, gravity: 14, drag: 1.2, floor: .03, life: c.duration * rand(1.3, 2.2), w: rand(.06, .13) * c.size * num('debrisSize'), cell: k % 2 ? 'chunk' : 'shard', color: 0xb7a58e, glow: .8, alpha: c.opacity, fade: 1.2, rot: rand(0, 6), spin: rand(-12, 12), additive: false});
    }
    // Poeira rente ao chão, empurrada no sentido do golpe.
    const nDust = Math.round(4 * c.dust * S);
    for (let k = 0; k < nDust; k++) this.spawn({x: pos.x, y: .12, z: pos.z, vx: d.x * rand(.6, 1.6) + side.x * rand(-1, 1), vy: rand(.2, .7), vz: d.z * rand(.6, 1.6) + side.z * rand(-1, 1), drag: 2.4, life: c.duration * rand(1.6, 2.6), w: rand(.35, .6) * c.size * num('dustSize'), grow: 1.4, cell: 'smoke', color: 0xd9d2c4, glow: .9, alpha: c.opacity * .4, fade: 1.4, rot: rand(0, 6), spin: rand(-1.5, 1.5), additive: false});
    // Rachadura marcada no chão só em golpes fortes (força ≥ 1,15).
    if (c.crack > 0 && S >= 1.15) this.spawn({x: pos.x, y: .025, z: pos.z, life: c.duration * 3.2, w: .9 * c.size * Math.min(1.6, S) * c.crack, mode: 'ground', cell: 'crack', rot: Math.atan2(d.x, d.z), color: 0xffd9a0, glow: .7, alpha: c.opacity * .5, fade: 2, additive: false});
  }
  // ---------- DODGE ----------
  dodgeA(c, f, {alt}) { // Rastros direcionais longos atrás do personagem, na direção real da esquiva.
    const h = f.action.heading, dir = {x: Math.sin(h), z: Math.cos(h)}, side = {x: dir.z, z: -dir.x};
    for (let k = 0; k < Math.max(1, Math.round(c.count * .35)); k++) {
      const off = rand(-c.spread, c.spread), y = alt + rand(.25, 1.25);
      this.spawn({x: f.position.x - dir.x * c.length * .5 + side.x * off, y, z: f.position.z - dir.z * c.length * .5 + side.z * off, life: c.duration, w: c.width, h: c.length, cell: 'streak', mode: 'axis', ax: dir.x, ay: 0, az: dir.z, color: c.color, glow: c.intensity, alpha: c.opacity, fade: 1.2, stretchCurve: k2 => 1 - .5 * k2});
    }
  }
  dodgeB(c, f, {alt}, s) { // Cortes curtos e angulares nas laterais.
    const h = f.action.heading, dir = {x: Math.sin(h), z: Math.cos(h)}, side = {x: dir.z, z: -dir.x};
    for (let k = 0; k < Math.max(1, Math.round(c.count * .3)); k++) {
      const sgn = (s.n + k) % 2 ? 1 : -1, tilt = sgn * rand(.4, .8), axis = {x: dir.x * Math.cos(tilt) + side.x * Math.sin(tilt), z: dir.z * Math.cos(tilt) + side.z * Math.sin(tilt)};
      const off = sgn * (.45 + rand(0, c.spread)), y = alt + rand(.2, 1.3);
      this.spawn({x: f.position.x + side.x * off - dir.x * rand(0, .6), y, z: f.position.z + side.z * off - dir.z * rand(0, .6), life: c.duration * .6, w: c.width * 1.3, h: c.length * .35, cell: 'shard', mode: 'axis', ax: axis.x, ay: rand(-.3, .3), az: axis.z, color: c.color, glow: c.intensity * 1.2, alpha: c.opacity, fade: 2, stretchCurve: k2 => 1 + k2});
    }
  }
  dodgeC(c, f, ctx, s) { // Fantasmas cinéticos (silhuetas translúcidas em posições anteriores) + rastros discretos.
    if (s.n % Math.max(1, Math.round(3 / Math.max(.3, c.intensity))) === 0) this.ghost(f, c, ctx.alt);
    if (s.n % 2 === 0) {const save = c.opacity;this.dodgeA({...c, opacity: save * .35, count: Math.max(1, c.count * .5)}, f, ctx);}
  }
  // ---------- SPRINT ----------
  sprintA(c, f, {alt, dx, dz}) { // Fluxo contínuo de linhas finas atrás do personagem.
    const h = Math.hypot(dx, dz) > 1e-6 ? Math.atan2(dx, dz) : f.visualFacing, dir = {x: Math.sin(h), z: Math.cos(h)}, side = {x: dir.z, z: -dir.x}, off = rand(-c.spread, c.spread);
    this.spawn({x: f.position.x - dir.x * .4 + side.x * off, y: alt + rand(.3, 1.1), z: f.position.z - dir.z * .4 + side.z * off, vx: -dir.x * c.speed * .4, vz: -dir.z * c.speed * .4, life: .25, w: .03 + .02 * c.intensity, h: c.length, cell: 'streak', mode: 'axis', ax: dir.x, ay: 0, az: dir.z, color: c.color, glow: c.intensity, alpha: c.opacity, fade: 1.4});
  }
  sprintB(c, f, {alt}) { // Trilhas de energia nos pés (ossos do GLB) ou nos cantos inferiores do bloco.
    const feet = this.footPoints(f, alt);
    for (const p of feet) this.spawn({x: p.x + rand(-.03, .03), y: p.y + .04, z: p.z + rand(-.03, .03), life: .18 + .12 * c.length, w: .1 * (1 + c.spread * .5), cell: 'dot', color: c.color, glow: 1.4 * c.intensity, alpha: c.opacity * 1.2, fade: 1.6, grow: -.5, vy: c.speed * .02});
  }
  sprintC(c, f, {alt, dx, dz}) { // Túnel localizado: traços curtos em anel ao redor, alinhados ao deslocamento.
    const h = Math.hypot(dx, dz) > 1e-6 ? Math.atan2(dx, dz) : f.visualFacing, dir = {x: Math.sin(h), z: Math.cos(h)}, side = {x: dir.z, z: -dir.x};
    const a = rand(0, Math.PI * 2), r = .55 + c.spread * .6, lx = Math.cos(a) * r, ly = Math.sin(a) * r * .7;
    this.spawn({x: f.position.x + side.x * lx + dir.x * .6, y: alt + .75 + ly, z: f.position.z + side.z * lx + dir.z * .6, vx: -dir.x * c.speed, vz: -dir.z * c.speed, life: .16, w: .035, h: c.length * .45, cell: 'streak', mode: 'axis', ax: dir.x, ay: 0, az: dir.z, color: c.color, glow: c.intensity * 1.3, alpha: c.opacity, fade: 1});
  }
  // ---------- BLOCK ----------
  frontOf(pos, n, d = .55) {return {x: pos.x - n.x * d, z: pos.z - n.z * d};}
  /** Normal de escudos planos: entre a direção do ataque e a câmera (visível de qualquer ângulo, ainda virado para o golpe). */
  shieldAxis(p, n) {
    let ax = -n.x, az = -n.z;
    if (this.camera) {const cx = this.camera.position.x - p.x, cz = this.camera.position.z - p.z, d = Math.hypot(cx, cz) || 1;ax = ax * .5 + cx / d * .5;az = az * .5 + cz / d * .5;const l = Math.hypot(ax, az) || 1;ax /= l;az /= l;}
    return {ax, ay: 0, az};
  }
  blockA(c, {pos, n}) { // Faíscas no ponto de contato, voltando contra o atacante.
    const p = this.frontOf(pos, n), y = .8, cnt = Math.round(c.count * c.intensity);
    this.spawn({x: p.x, y, z: p.z, life: c.duration * .5, w: .5 * c.size, cell: 'spark', color: c.color, glow: 1.5 * c.intensity, alpha: c.opacity, grow: c.expansion});
    for (let k = 0; k < cnt; k++) {const spread = rand(-1, 1), sp = rand(3, 6) * c.expansion;this.spawn({x: p.x, y, z: p.z, vx: (-n.x + spread * n.z * .9) * sp, vy: rand(.5, 3), vz: (-n.z - spread * n.x * .9) * sp, gravity: 14, drag: 3, life: c.duration * rand(.8, 1.4), w: .05 * c.size, h: .22 * c.size, cell: 'streak', mode: 'axis', ax: -n.x, ay: .3, az: -n.z, color: c.color, glow: 1.3 * c.intensity, alpha: c.opacity, fade: 1.5});}
  }
  blockB(c, {pos, n}) { // Escudo translúcido curvo na frente do defensor, virado para o ataque.
    const p = this.frontOf(pos, n, .5);
    const sa = this.shieldAxis(p, n);
    this.spawn({x: p.x, y: .75, z: p.z, life: c.duration, w: 1.5 * c.size, h: 1.3 * c.size, cell: 'arc', mode: 'plane', ...sa, color: c.color, glow: 1.2 * c.intensity, alpha: c.opacity, alphaCurve: k => k < .15 ? k / .15 : Math.pow(1 - (k - .15) / .85, 1.5), sizeCurve: k => 1 + .15 * c.expansion * k});
    this.spawn({x: p.x, y: .75, z: p.z, life: c.duration * .6, w: 1.1 * c.size, h: 1 * c.size, cell: 'hex', mode: 'plane', ...sa, color: 0xffffff, glow: .8 * c.intensity, alpha: c.opacity * .45, fade: 2});
    for (let k = 0; k < Math.round(c.count * .4); k++) this.spawn({x: p.x + rand(-.4, .4) * n.z, y: rand(.3, 1.2), z: p.z - rand(-.4, .4) * n.x, vx: -n.x * 1.5, vz: -n.z * 1.5, drag: 4, life: c.duration * .8, w: .06, cell: 'dot', color: c.color, glow: 1.5, alpha: c.opacity, fade: 1.5});
  }
  blockC(c, {pos, n}) { // Onda de absorção: ondas curtas propagando sobre uma barreira momentânea.
    const p = this.frontOf(pos, n, .5), sa = this.shieldAxis(p, n);
    this.spawn({x: p.x, y: .75, z: p.z, life: c.duration, w: 1.3 * c.size, h: 1.2 * c.size, cell: 'hex', mode: 'plane', ...sa, color: c.color, glow: c.intensity, alpha: c.opacity * .55, fade: 1.5});
    for (let k = 0; k < 3 + Math.round(c.count / 10); k++) this.spawn({x: p.x, y: .75, z: p.z, delay: k * c.duration * .14, life: c.duration * .7, w: .35 * c.size, cell: 'ring', mode: 'plane', ...sa, color: c.color, glow: 1.4 * c.intensity, alpha: c.opacity, fade: 1.2, sizeCurve: k2 => 1 + ease.outCubic(k2) * 3 * c.expansion});
  }
  blockD(c, {pos, n}) { // Escudo hexagonal: colmeia de células que acendem do ponto de contato para fora.
    const p = this.frontOf(pos, n, .55), sa = this.shieldAxis(p, n), side = {x: sa.az, z: -sa.ax}, s = .26 * c.size, rings = Math.max(1, Math.min(4, Math.round(c.count / 4)));
    for (let q = -rings; q <= rings; q++) for (let r = Math.max(-rings, -q - rings); r <= Math.min(rings, -q + rings); r++) {
      const hx = s * 1.5 * q, hy = s * Math.sqrt(3) * (r + q / 2), dist = (Math.abs(q) + Math.abs(r) + Math.abs(-q - r)) / 2;
      this.spawn({x: p.x + side.x * hx, y: .8 + hy, z: p.z + side.z * hx, delay: dist * .045 / Math.max(.2, c.expansion), life: c.duration * (1 - dist * .08), w: s * 1.9, h: s * 1.9, cell: 'hex', mode: 'plane', ...sa, color: c.color, glow: (1.6 - dist * .25) * c.intensity, alpha: c.opacity, alphaCurve: k => k < .2 ? k / .2 : Math.pow(1 - (k - .2) / .8, 1.3), sizeCurve: k => .7 + .3 * Math.min(1, k * 4)});
    }
    this.spawn({x: p.x, y: .8, z: p.z, life: c.duration * .35, w: .7 * c.size, cell: 'star4', color: 0xffffff, glow: 1.5 * c.intensity, alpha: c.opacity, grow: .8, fade: 1.6});
  }
  // ---------- PERFECT ----------
  perfectA(c, {pos, n}) { // Flash intenso → anel de choque → partículas.
    const p = this.frontOf(pos, n, .45), y = .8, S = c.scale, I = c.intensity;
    this.screenFlash(p, y, c.flash * I, c.color2, c.duration * .35);
    this.spawn({x: p.x, y, z: p.z, life: c.duration * .35, w: 1.4 * S, cell: 'star4', color: c.color2, glow: c.glow * 1.5, alpha: 1, grow: 1.5, fade: c.fade, rot: rand(0, 1)});
    this.spawn({x: p.x, y, z: p.z, life: c.duration, w: .5 * S, cell: 'shock', color: c.color, glow: c.glow, alpha: 1, fade: c.fade, sizeCurve: k => 1 + ease.outCubic(k) * c.wave * 2});
    this.spawn({x: pos.x, y: .03, z: pos.z, life: c.duration * 1.2, w: .6 * S, mode: 'ground', cell: 'ring', color: c.color, glow: c.glow, alpha: .9, fade: c.fade, sizeCurve: k => 1 + ease.outCubic(k) * c.wave * 2.4});
    const cnt = Math.round(c.count * I);
    for (let k = 0; k < cnt; k++) {const a = rand(0, Math.PI * 2), e = rand(-.4, .9), sp = rand(4, 9) * I;this.spawn({x: p.x, y, z: p.z, vx: Math.cos(a) * Math.cos(e) * sp, vy: Math.sin(e) * sp, vz: Math.sin(a) * Math.cos(e) * sp, drag: 3.5, life: c.duration * rand(.7, 1.2), w: .07 * S, h: .4 * S, cell: 'streak', mode: 'axis', ax: Math.cos(a), ay: Math.sin(e), az: Math.sin(a), color: k % 3 ? c.color : c.color2, glow: c.glow, alpha: 1, fade: c.fade});}
  }
  perfectB(c, {pos, n, fighters}) { // Ruptura temporal: congelamento VISUAL curtíssimo (só poses e efeito), depois linhas e expansão.
    const p = this.frontOf(pos, n, .45), y = .8, S = c.scale;
    // A simulação continua normalmente: só as poses dos personagens e o filtro da tela param por `freeze` segundos.
    for (const ch of this.characters || []) if (ch) ch.visualFreeze = Math.max(ch.visualFreeze || 0, c.freeze);
    this.freezeUntil = (this.time ?? 0) + c.freeze;this.canvasFilter(`saturate(.15) contrast(1.4) brightness(${1 + .25 * c.intensity})`, c.freeze + .05);
    this.spawn({x: p.x, y, z: p.z, life: c.freeze + .05, w: 1.1 * S, cell: 'star', color: c.color2, glow: c.glow * 2, alpha: 1, fade: .3});
    this.after(c.freeze, () => {
      const cnt = Math.round(c.count * c.intensity);
      for (let k = 0; k < cnt; k++) {const a = k / cnt * Math.PI * 2, d = {x: Math.cos(a), y: Math.sin(a) * .6, z: Math.sin(a) * Math.cos(a)};this.spawn({x: p.x + d.x * .3, y: y + d.y * .3, z: p.z + d.z * .3, vx: d.x * 10, vy: d.y * 10, vz: d.z * 10, drag: 4, life: c.duration * .6, w: .05 * S, h: .9 * S, cell: 'streak', mode: 'axis', ax: d.x, ay: d.y, az: d.z, color: c.color, glow: c.glow, alpha: 1, fade: c.fade});}
      for (let k = 0; k < 2; k++) this.spawn({x: p.x, y, z: p.z, delay: k * .06, life: c.duration * .8, w: .4 * S, cell: 'ring', color: k ? c.color2 : c.color, glow: c.glow, alpha: .95, fade: c.fade, sizeCurve: k2 => 1 + ease.outCubic(k2) * c.wave * 2.2});
      this.screenFlash(p, y, c.flash * .6 * c.intensity, c.color, c.duration * .25);
    });
    void fighters;
  }
  perfectC(c, {pos, n}) { // Deflexão monumental: escudo angular aparece, comprime e libera uma explosão estilizada.
    const p = this.frontOf(pos, n, .55), y = .8, S = c.scale, D = c.duration, release = D * .38;
    const sa = this.shieldAxis(p, n);
    this.spawn({x: p.x, y, z: p.z, life: release + .05, w: 1.7 * S, h: 1.7 * S, cell: 'hex', mode: 'plane', ...sa, color: c.color, glow: c.glow, alpha: 1, alphaCurve: k => Math.min(1, k * 5), sizeCurve: k => k < .55 ? 1 + .25 * ease.outCubic(k / .55) : 1.25 - .55 * ease.inOut((k - .55) / .45)});
    this.spawn({x: p.x, y, z: p.z, life: release, w: 2 * S, h: 1.6 * S, cell: 'arc', mode: 'plane', ...sa, color: c.color2, glow: c.glow * .8, alpha: .7, fade: .8});
    this.after(release, () => {
      this.screenFlash(p, y, c.flash * c.intensity, c.color2, D * .3);
      this.spawn({x: p.x, y, z: p.z, life: D * .6, w: .6 * S, cell: 'shock', color: c.color2, glow: c.glow * 1.3, alpha: 1, fade: c.fade, sizeCurve: k => 1 + ease.outCubic(k) * c.wave * 2.5});
      const cnt = Math.round(c.count * c.intensity);
      for (let k = 0; k < cnt; k++) {const a = rand(-1.3, 1.3), sp = rand(5, 11), dir = {x: -n.x * Math.cos(a) + n.z * Math.sin(a), z: -n.z * Math.cos(a) - n.x * Math.sin(a)};this.spawn({x: p.x, y, z: p.z, vx: dir.x * sp, vy: rand(-1, 4), vz: dir.z * sp, gravity: 6, drag: 2.5, life: D * rand(.6, 1), w: rand(.1, .2) * S, cell: 'shard', color: k % 2 ? c.color : c.color2, glow: c.glow, alpha: 1, fade: c.fade, rot: rand(0, 6), spin: rand(-12, 12)});}
    });
  }
  // ---------- GROUND ----------
  groundA(c, {pos, power}) { // Explosão de poeira: nuvens circulares rasteiras + fragmentos.
    const I = c.intensity * power, cnt = Math.round(10 * c.density * (.6 + .4 * power));
    for (let k = 0; k < cnt; k++) {const a = k / cnt * Math.PI * 2 + rand(-.2, .2), sp = c.speed * rand(.6, 1.1) * (.6 + .4 * power);this.spawn({x: pos.x, y: .15, z: pos.z, vx: Math.cos(a) * sp, vy: rand(.2, .8) * c.elevation, vz: Math.sin(a) * sp, drag: 3.2, life: c.duration * rand(.8, 1.3), w: c.particleSize * 3 * c.radius, cell: 'smoke', color: c.color, alpha: c.opacity, additive: false, grow: 1.4, fade: 1.3, rot: rand(0, 6), spin: rand(-1, 1)});}
    for (let k = 0; k < Math.round(cnt * .8); k++) {const a = rand(0, Math.PI * 2), sp = c.speed * rand(.4, 1.2);this.spawn({x: pos.x, y: .1, z: pos.z, vx: Math.cos(a) * sp, vy: rand(1, 4) * c.elevation * I, vz: Math.sin(a) * sp, gravity: 14, floor: .03, life: c.duration * 1.4, w: c.particleSize * .5, cell: 'chunk', color: c.color, alpha: c.opacity, additive: false, fade: 2, rot: rand(0, 6), spin: rand(-8, 8)});}
  }
  groundB(c, {pos, power}) { // Anel de impacto rente ao chão + marcas temporárias.
    const I = c.intensity * power;
    for (let k = 0; k < 2; k++) this.spawn({x: pos.x, y: .025 + k * .005, z: pos.z, delay: k * .07, life: c.duration, w: .4 * c.radius, mode: 'ground', cell: k ? 'shock' : 'ring', color: c.color, glow: .9 + .4 * I, alpha: c.opacity, fade: 1.2, sizeCurve: k2 => 1 + ease.outCubic(k2) * c.speed * 1.4 * (.6 + .4 * power)});
    this.spawn({x: pos.x, y: .02, z: pos.z, life: c.duration * 3.5, w: 1.2 * c.radius * (.7 + .3 * power), mode: 'ground', cell: 'crack', color: 0x1a2028, alpha: c.opacity * .8, additive: false, fade: 2.5, rot: rand(0, 6)});
    for (let k = 0; k < Math.round(8 * c.density); k++) {const a = rand(0, Math.PI * 2);this.spawn({x: pos.x, y: .05, z: pos.z, vx: Math.cos(a) * c.speed * 1.2, vy: c.elevation * rand(.5, 1.5), vz: Math.sin(a) * c.speed * 1.2, gravity: 10, drag: 2, life: c.duration, w: c.particleSize * .4, cell: 'dot', color: c.color, glow: 1.2, alpha: c.opacity, fade: 1.4});}
  }
  groundD(c, ctx) { // Combinado: poeira (A), anel (B) e estilhaços (C), cada um com o próprio peso.
    const part = mix => ({...c, intensity: c.intensity * mix, density: c.density * mix, opacity: c.opacity * Math.min(1, mix)});
    if (c.mixA > 0) this.groundA(part(c.mixA), ctx);if (c.mixB > 0) this.groundB(part(c.mixB), ctx);if (c.mixC > 0) this.groundC(part(c.mixC), ctx);
  }
  groundC(c, {pos, power}) { // Impacto fragmentado: estilhaços geométricos + energia concentrada no ponto.
    const I = c.intensity * power;
    this.spawn({x: pos.x, y: .25, z: pos.z, life: c.duration * .45, w: c.radius * 1.2, cell: 'dot', color: c.color, glow: 1.8 * I, alpha: c.opacity, grow: .4, fade: 1.5});
    this.spawn({x: pos.x, y: .03, z: pos.z, life: c.duration * .7, w: c.radius * .9, mode: 'ground', cell: 'star', color: c.color, glow: 1.4 * I, alpha: c.opacity, fade: 1.3, rot: rand(0, 6), sizeCurve: k => 1 + k * c.speed * .3});
    for (let k = 0; k < Math.round(14 * c.density * (.6 + .4 * power)); k++) {const a = rand(0, Math.PI * 2), sp = c.speed * rand(.5, 1.3);this.spawn({x: pos.x, y: .1, z: pos.z, vx: Math.cos(a) * sp, vy: rand(2, 6) * c.elevation * I, vz: Math.sin(a) * sp, gravity: 16, floor: .04, drag: 1, life: c.duration * rand(1, 1.8), w: c.particleSize * rand(.5, 1), cell: k % 3 ? 'shard' : 'diamond', color: c.color, glow: 1.2, alpha: c.opacity, fade: 2, rot: rand(0, 6), spin: rand(-15, 15)});}
  }
  // ---------- CLASH ----------
  clashA(c, {pos, n}) { // Explosão central simétrica: onda circular + partículas em direções opostas.
    const y = .85, S = c.scale, I = c.intensity;
    this.spawn({x: pos.x, y, z: pos.z, life: c.duration * .4, w: 1.2 * S, cell: 'dot', color: 0xffffff, glow: c.glow * 1.5, alpha: 1, grow: 1, fade: 1.5});
    this.spawn({x: pos.x, y, z: pos.z, life: c.duration, w: .5 * S, cell: 'shock', color: c.color, glow: c.glow, alpha: 1, fade: 1.3, sizeCurve: k => 1 + ease.outCubic(k) * c.radius * 2.4});
    this.spawn({x: pos.x, y: .03, z: pos.z, life: c.duration, w: .5 * S, mode: 'ground', cell: 'ring', color: c.color, glow: c.glow, alpha: .9, fade: 1.3, sizeCurve: k => 1 + ease.outCubic(k) * c.radius * 2.6});
    const cnt = Math.round(c.count * I);
    for (let k = 0; k < cnt; k++) {const sgn = k % 2 ? 1 : -1, a = rand(-.9, .9), d = {x: sgn * (n.x * Math.cos(a) - n.z * Math.sin(a)), z: sgn * (n.z * Math.cos(a) + n.x * Math.sin(a))}, sp = c.speed * rand(.6, 1.2);this.spawn({x: pos.x, y, z: pos.z, vx: d.x * sp, vy: rand(-.5, 2.5), vz: d.z * sp, drag: 3, life: c.duration * rand(.6, 1), w: .07 * S, h: .5 * S, cell: 'streak', mode: 'axis', ax: d.x, ay: .1, az: d.z, color: sgn > 0 ? c.color : c.color2, glow: c.glow, alpha: 1, fade: 1.3});}
  }
  clashB(c, {pos, n}) { // Cruzamento de energia: linhas de força em X no ponto de impacto + flash angular.
    const y = .85, S = c.scale, side = {x: n.z, z: -n.x};
    for (const sgn of [1, -1]) {const ax = {x: n.x * .7 + side.x * .7 * sgn, y: .7 * sgn, z: n.z * .7 + side.z * .7 * sgn};this.spawn({x: pos.x, y, z: pos.z, life: c.duration * .7, w: .14 * S, h: c.radius * 2.2 * S, cell: 'streak', mode: 'axis', ax: ax.x, ay: ax.y, az: ax.z, color: sgn > 0 ? c.color : c.color2, glow: c.glow * 1.4, alpha: 1, fade: 1.4, stretchCurve: k => .3 + ease.outCubic(Math.min(1, k * 3)) * .9});}
    this.spawn({x: pos.x, y, z: pos.z, life: c.duration * .4, w: 1.5 * S, cell: 'star4', color: 0xffffff, glow: c.glow * 1.6, alpha: 1, rot: Math.PI / 4, sizeCurve: ease.pop, fade: 1.2});
    const cnt = Math.round(c.count * .7 * c.intensity);
    for (let k = 0; k < cnt; k++) {const a = rand(0, Math.PI * 2), sp = c.speed * rand(.4, 1);this.spawn({x: pos.x, y, z: pos.z, vx: Math.cos(a) * sp, vy: rand(0, 3), vz: Math.sin(a) * sp, gravity: 9, drag: 1.5, life: c.duration, w: .08 * S, cell: 'spark', color: k % 2 ? c.color : c.color2, glow: c.glow, alpha: 1, fade: 1.6});}
  }
  clashC(c, {pos, n}) { // Compressão (energia concentrada encolhendo) e liberação (anéis e fragmentos).
    const y = .85, S = c.scale, hold = c.duration * .3;
    this.spawn({x: pos.x, y, z: pos.z, life: hold, w: 1.3 * S * c.radius * .6, cell: 'dot', color: c.color2, glow: c.glow * 1.8, alpha: 1, alphaCurve: k => .5 + .5 * k, sizeCurve: k => 1 - .7 * ease.inOut(k)});
    for (let k = 0; k < 6; k++) {const a = k / 6 * Math.PI * 2;this.spawn({x: pos.x + Math.cos(a) * c.radius, y: y + Math.sin(a) * .5, z: pos.z + Math.sin(a) * c.radius * .4, vx: -Math.cos(a) * c.radius / hold, vy: -Math.sin(a) * .5 / hold, vz: -Math.sin(a) * c.radius * .4 / hold, life: hold, w: .1 * S, cell: 'spark', color: c.color, glow: c.glow, alpha: 1, alphaCurve: k2 => k2});}
    this.after(hold, () => {
      for (let k = 0; k < 3; k++) this.spawn({x: pos.x, y, z: pos.z, delay: k * .05, life: c.duration * .7, w: .4 * S, cell: k === 0 ? 'shock' : 'ring', color: k % 2 ? c.color2 : c.color, glow: c.glow, alpha: 1, fade: 1.2, sizeCurve: k2 => 1 + ease.outCubic(k2) * c.radius * c.speed * .35});
      const cnt = Math.round(c.count * c.intensity);
      for (let k = 0; k < cnt; k++) {const a = rand(0, Math.PI * 2), sp = c.speed * rand(.6, 1.4);this.spawn({x: pos.x, y, z: pos.z, vx: Math.cos(a) * sp, vy: rand(-1, 4), vz: Math.sin(a) * sp, gravity: 8, drag: 2, life: c.duration * rand(.6, 1), w: rand(.08, .16) * S, cell: k % 2 ? 'shard' : 'diamond', color: k % 2 ? c.color : c.color2, glow: c.glow, alpha: 1, fade: 1.5, rot: rand(0, 6), spin: rand(-12, 12)});}
    });
    void n;
  }
  // ---------- EXAUSTÃO ----------
  exhaustA(c, f, {alt}) { // Cachoeira de setas azuis caindo e sumindo.
    for (let k = 0; k < Math.max(1, Math.round(c.count * .4)); k++) {const a = rand(0, Math.PI * 2), r = rand(.15, c.spread);this.spawn({x: f.position.x + Math.cos(a) * r, y: alt + c.startHeight + rand(-.15, .15), z: f.position.z + Math.sin(a) * r, vy: -c.fallSpeed, life: c.startHeight / Math.max(.2, c.fallSpeed) * .8, w: c.size, cell: 'arrowDown', color: c.color, glow: c.glow, alpha: c.opacity, alphaCurve: k2 => Math.min(1, k2 * 6) * (1 - k2), follow: this.follower(f), additive: false});}
  }
  exhaustB(c, f, {alt}) { // Chuva de pequenos losangos e traços azuis descendo ao redor.
    for (let k = 0; k < Math.max(1, Math.round(c.count * .6)); k++) {const a = rand(0, Math.PI * 2), r = rand(.3, c.spread + .3), diamond = k % 2 === 0;this.spawn({x: f.position.x + Math.cos(a) * r, y: alt + c.startHeight * rand(.7, 1.1), z: f.position.z + Math.sin(a) * r, vy: -c.fallSpeed * rand(1, 1.6), life: .9, w: c.size * (diamond ? .55 : .12), h: c.size * (diamond ? .55 : .9), cell: diamond ? 'diamond' : 'streak', mode: diamond ? 'billboard' : 'axis', ax: 0, ay: 1, az: 0, rot: diamond ? rand(0, 6) : 0, spin: diamond ? rand(-4, 4) : 0, color: c.color, glow: c.glow, alpha: c.opacity, fade: 1.3, follow: this.follower(f), additive: false});}
  }
  exhaustC(c, f, {alt}, s) { // Cascata enfraquecida: filetes verticais + símbolos descendentes, brilho caindo.
    const a = rand(0, Math.PI * 2), r = rand(.1, c.spread);
    this.spawn({x: f.position.x + Math.cos(a) * r, y: alt + c.startHeight * .6, z: f.position.z + Math.sin(a) * r, vy: -c.fallSpeed * .5, life: 1.1, w: c.size * .1, h: c.startHeight * .9, cell: 'streak', mode: 'axis', ax: 0, ay: 1, az: 0, color: c.color, glow: c.glow, alpha: c.opacity * .8, alphaCurve: k => (1 - k) * (1 - k), follow: this.follower(f), additive: false});
    if (s.n % 2 === 0) this.spawn({x: f.position.x + Math.cos(a + 2) * r, y: alt + c.startHeight, z: f.position.z + Math.sin(a + 2) * r, vy: -c.fallSpeed, life: 1, w: c.size * .7, cell: 'arrowDown', color: c.color, glow: c.glow * .7, alpha: c.opacity * .7, alphaCurve: k => (1 - k) * Math.min(1, k * 4), sizeCurve: k => 1 - .4 * k, follow: this.follower(f), additive: false});
  }
  // ---------- REGENERAÇÃO ----------
  regenScale(c, rate) {return c.scaleWithRate ? Math.max(.3, Math.min(2, rate / Math.max(1e-6, C.rules.staminaMax / C.rules.regenTime))) : 1;}
  regenA(c, f, {alt, rate}) { // Setas amarelas subindo continuamente.
    const k = this.regenScale(c, rate);for (let j = 0; j < Math.max(1, Math.round(c.count * .4 * k)); j++) {const a = rand(0, Math.PI * 2), r = rand(.2, c.spread);this.spawn({x: f.position.x + Math.cos(a) * r, y: alt + rand(.1, .5), z: f.position.z + Math.sin(a) * r, vy: c.speed, life: c.height / Math.max(.2, c.speed), w: c.size, cell: 'arrowUp', color: c.color, glow: c.intensity * k, alpha: c.opacity, alphaCurve: q => Math.min(1, q * 5) * (1 - q), follow: this.follower(f), additive: false});}
  }
  regenB(c, f, {alt, rate}) { // Traços amarelos curtos e finos subindo.
    const k = this.regenScale(c, rate);for (let j = 0; j < Math.max(1, Math.round(c.count * .5 * k)); j++) {const a = rand(0, Math.PI * 2), r = rand(.25, c.spread + .2);this.spawn({x: f.position.x + Math.cos(a) * r, y: alt + rand(0, .6), z: f.position.z + Math.sin(a) * r, vy: c.speed * 1.4, life: c.height / Math.max(.2, c.speed * 1.4), w: c.size * .14, h: c.size * 1.6, cell: 'streak', mode: 'axis', ax: 0, ay: 1, az: 0, color: c.color, glow: c.intensity * k, alpha: c.opacity, fade: 1.2, follow: this.follower(f), additive: false});}
  }
  regenC(c, f, {alt, rate}, s) { // Partículas ascendentes + pulsos luminosos junto aos pés.
    const k = this.regenScale(c, rate);
    for (let j = 0; j < Math.max(1, Math.round(c.count * .4 * k)); j++) {const a = rand(0, Math.PI * 2), r = rand(.15, c.spread);this.spawn({x: f.position.x + Math.cos(a) * r, y: alt + .1, z: f.position.z + Math.sin(a) * r, vy: c.speed * rand(.8, 1.3), life: c.height / Math.max(.2, c.speed), w: c.size * .6, cell: 'dot', color: c.color, glow: c.intensity * 1.4 * k, alpha: c.opacity, fade: 1.1, follow: this.follower(f), additive: false});}
    if (s.n % Math.max(2, Math.round(c.frequency * .7)) === 0) this.spawn({x: f.position.x, y: alt + .03, z: f.position.z, life: .55, w: .5, mode: 'ground', cell: 'ring', color: c.color, glow: c.intensity * k, alpha: c.opacity * .8, fade: 1.3, sizeCurve: q => 1 + q * 1.6 * (.5 + c.spread), follow: this.follower(f)});
  }
  // ---------- ROCHAS TELECINÉTICAS ----------
  rockA(c, {pos, n, power = 1}) { // Boulder Facetado: estilhaços rochosos densos + fumaça de impacto + fragmentos angulares
    const y = pos.y ?? 0.8, S = c.scale ?? 1, cnt = Math.round((c.shatterCount ?? 14) * (c.intensity ?? 1) * power);
    this.spawn({x: pos.x, y, z: pos.z, life: 0.35, w: 0.8 * S, cell: 'shock', color: 0x8a9ba8, alpha: 0.7, fade: 1.5});
    for (let k = 0; k < cnt; k++) {
      const a = rand(0, Math.PI * 2), sp = rand(3, 8) * S;
      this.spawn({x: pos.x, y, z: pos.z, vx: Math.cos(a) * sp + (n?.x ?? 0) * 2, vy: rand(1, 5), vz: Math.sin(a) * sp + (n?.z ?? 0) * 2, gravity: 12, floor: 0.04, drag: 2, life: rand(0.4, 0.8), w: rand(0.08, 0.2) * S, cell: k % 2 ? 'chunk' : 'shard', color: k % 3 === 0 ? 0x59d6e6 : 0x47525d, alpha: 0.95, fade: 1.8, rot: rand(0, 6), spin: rand(-10, 10)});
    }
  }
  rockB(c, {pos, n, power = 1}) { // Cristal Psíquico: fragmentos afiados reluzentes de energia + anel etéreo ciano/magenta
    const y = pos.y ?? 0.8, S = c.scale ?? 1, cnt = Math.round((c.shatterCount ?? 16) * (c.intensity ?? 1) * power);
    this.spawn({x: pos.x, y, z: pos.z, life: 0.45, w: 1.1 * S, cell: 'star4', color: 0x59d6e6, glow: 1.8, alpha: 1, rot: Math.PI / 4, fade: 1.4});
    this.spawn({x: pos.x, y, z: pos.z, life: 0.5, w: 0.6 * S, cell: 'shock', color: 0xff6adf, glow: 1.5, alpha: 0.9, fade: 1.2, sizeCurve: ease.outCubic});
    for (let k = 0; k < cnt; k++) {
      const a = rand(0, Math.PI * 2), sp = rand(4, 9) * S;
      this.spawn({x: pos.x, y, z: pos.z, vx: Math.cos(a) * sp + (n?.x ?? 0) * 2.5, vy: rand(0.5, 4.5), vz: Math.sin(a) * sp + (n?.z ?? 0) * 2.5, drag: 2.5, life: rand(0.35, 0.7), w: rand(0.09, 0.18) * S, cell: k % 2 ? 'diamond' : 'shard', color: k % 2 ? 0x59d6e6 : 0xff6adf, glow: 1.6, alpha: 1, fade: 1.5, rot: rand(0, 6), spin: rand(-12, 12)});
    }
  }
  rockC(c, {pos, n, power = 1}) { // Meteorito Runas: brasas incandescentes de alta velocidade + ondas concentradas
    const y = pos.y ?? 0.8, S = c.scale ?? 1, cnt = Math.round((c.shatterCount ?? 18) * (c.intensity ?? 1) * power);
    this.spawn({x: pos.x, y, z: pos.z, life: 0.3, w: 1.3 * S, cell: 'dot', color: 0xffcf6a, glow: 2.0, alpha: 1, grow: 1.2, fade: 1.6});
    this.spawn({x: pos.x, y: 0.03, z: pos.z, life: 0.5, w: 0.9 * S, mode: 'ground', cell: 'crack', color: 0x221a12, alpha: 0.85, additive: false, fade: 2});
    for (let k = 0; k < cnt; k++) {
      const a = rand(0, Math.PI * 2), sp = rand(3.5, 10) * S;
      this.spawn({x: pos.x, y, z: pos.z, vx: Math.cos(a) * sp + (n?.x ?? 0) * 3, vy: rand(1, 6), vz: Math.sin(a) * sp + (n?.z ?? 0) * 3, gravity: 14, floor: 0.04, drag: 1.8, life: rand(0.4, 0.85), w: rand(0.07, 0.16) * S, cell: k % 3 === 0 ? 'spark' : (k % 2 ? 'chunk' : 'streak'), mode: k % 3 === 0 ? 'billboard' : 'axis', ax: Math.cos(a), ay: 0.5, az: Math.sin(a), color: k % 2 ? 0xffcf6a : 0xff7a3c, glow: 1.7, alpha: 1, fade: 1.4});
    }
  }
  // ---------- BARREIRA DE ENERGIA ----------
  barrierA(c, {pos, n, power = 1}) { // Hex-Grid Ciclado: desintegração em colmeia hexagonal cintilante
    const y = pos.y ?? 0.8, S = c.scale ?? 1, p = this.frontOf(pos, n ?? {x: 0, z: 1}, 0.5), sa = this.shieldAxis(p, n ?? {x: 0, z: 1});
    const cnt = Math.round((c.shatterFragments ?? 20) * (c.intensity ?? 1) * power);
    this.spawn({x: p.x, y, z: p.z, life: 0.5, w: 1.6 * S, h: 1.4 * S, cell: 'hex', mode: 'plane', ...sa, color: 0x59d6e6, glow: 1.8 * (c.edgeGlow ?? 1.4), alpha: c.opacity ?? 0.7, fade: 1.5});
    for (let k = 0; k < cnt; k++) {
      const a = rand(0, Math.PI * 2), sp = rand(2, 6);
      this.spawn({x: p.x + (rand(-1, 1)) * 0.6, y: y + rand(-0.5, 0.5), z: p.z + (rand(-1, 1)) * 0.6, vx: Math.cos(a) * sp, vy: rand(0.5, 3), vz: Math.sin(a) * sp, drag: 2.2, life: rand(0.35, 0.7), w: rand(0.12, 0.25) * S, h: rand(0.12, 0.25) * S, cell: 'hex', mode: 'billboard', color: 0x59d6e6, glow: 1.5, alpha: 0.9, fade: 1.6, rot: rand(0, 6), spin: rand(-8, 8)});
    }
  }
  barrierB(c, {pos, n, power = 1}) { // Cristal de Quartzo: estilhaçamento prismático reflexivo
    const y = pos.y ?? 0.8, S = c.scale ?? 1, p = this.frontOf(pos, n ?? {x: 0, z: 1}, 0.5);
    const cnt = Math.round((c.shatterFragments ?? 22) * (c.intensity ?? 1) * power);
    this.spawn({x: p.x, y, z: p.z, life: 0.4, w: 1.4 * S, cell: 'star4', color: 0xffffff, glow: 2.0, alpha: 1, rot: Math.PI / 4, fade: 1.2});
    for (let k = 0; k < cnt; k++) {
      const a = rand(0, Math.PI * 2), sp = rand(3, 7.5);
      this.spawn({x: p.x + (rand(-1, 1)) * 0.5, y: y + rand(-0.4, 0.4), z: p.z + (rand(-1, 1)) * 0.5, vx: Math.cos(a) * sp, vy: rand(1, 4), vz: Math.sin(a) * sp, gravity: 9, drag: 2, life: rand(0.4, 0.75), w: rand(0.1, 0.22) * S, cell: k % 2 ? 'shard' : 'diamond', color: k % 3 === 0 ? 0xffffff : (k % 2 ? 0x9dffd2 : 0x73caff), glow: 1.4, alpha: 0.95, fade: 1.5, rot: rand(0, 6), spin: rand(-12, 12)});
    }
  }
  barrierC(c, {pos, n, power = 1}) { // Campo de Força Vibrante: anéis de sobrecarga e arcos elétricos
    const y = pos.y ?? 0.8, S = c.scale ?? 1, p = this.frontOf(pos, n ?? {x: 0, z: 1}, 0.5), sa = this.shieldAxis(p, n ?? {x: 0, z: 1});
    const cnt = Math.round((c.shatterFragments ?? 18) * (c.intensity ?? 1) * power);
    this.spawn({x: p.x, y, z: p.z, life: 0.5, w: 1.8 * S, h: 1.6 * S, cell: 'arc', mode: 'plane', ...sa, color: 0xffcf6a, glow: 1.7, alpha: 0.85, fade: 1.4});
    for (let k = 0; k < 3; k++) {
      this.spawn({x: p.x, y, z: p.z, delay: k * 0.08, life: 0.5, w: 0.5 * S, cell: 'ring', mode: 'plane', ...sa, color: 0xffcf6a, glow: 1.5, alpha: 0.9, fade: 1.3, sizeCurve: k2 => 1 + ease.outCubic(k2) * 2.8});
    }
    for (let k = 0; k < cnt; k++) {
      this.spawn({x: p.x + (rand(-1, 1)) * 0.6, y: y + rand(-0.5, 0.5), z: p.z + (rand(-1, 1)) * 0.6, vx: (rand(-1, 1)) * 3, vy: rand(0, 3), vz: (rand(-1, 1)) * 3, drag: 3, life: rand(0.3, 0.6), w: rand(0.08, 0.18) * S, cell: 'spark', color: 0xffcf6a, glow: 1.8, alpha: 1, fade: 1.6});
    }
  }
  /** Partículas que acompanham o lutador (exaustão e regeneração seguem o corpo). */
  follower(f) {const key = '__f' + f.id;let o = this[key];if (!o) {o = this[key] = {dx: 0, dz: 0, last: {...f.position}};}return o;}
  syncFollowers(fighters) {for (const f of fighters) {const o = this['__f' + f.id];if (!o) continue;o.dx = f.position.x - o.last.x;o.dz = f.position.z - o.last.z;o.last = {...f.position};}}
  /** Pontos dos pés: ossos do GLB (foot/toe) ou cantos inferiores do bloco. */
  footPoints(f, alt) {
    const ch = this.characters?.[f.id];
    if (ch) {
      ch.feet ??= (() => {const list = [];ch.root.traverse(o => {if (o.isBone && /foot|toe/i.test(o.name) && !/end|top/i.test(o.name)) list.push(o);});return list.filter(b => /foot/i.test(b.name)).slice(0, 2).concat(list.filter(b => /toe/i.test(b.name)).slice(0, 2)).slice(0, 4);})();
      const v = new T.Vector3();return ch.feet.map(b => {b.getWorldPosition(v);return {x: v.x, y: v.y, z: v.z};});
    }
    const s = Math.sin(f.visualFacing), c = Math.cos(f.visualFacing), w = C.extras.visual.bodyWidth * .35;
    return [-1, 1].map(k => ({x: f.position.x + c * w * k - s * .3, y: alt + .02, z: f.position.z - s * w * k - c * .3}));
  }
  // ---------- Fantasmas (silhuetas translúcidas) ----------
  ghost(f, c, alt) {
    const ch = this.characters?.[f.id], key = ch ? ch : 'block' + f.id;
    let g = this.ghosts.find(x => x.key === key && !x.obj.visible);
    if (!g && this.ghosts.filter(x => x.key === key).length < 6) {
      const mat = new T.MeshBasicMaterial({color: c.color, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending});
      let obj;
      if (ch) {obj = clone(ch.source.scene);obj.traverse(o => {if (o.isMesh) {o.material = mat;o.frustumCulled = false;}});}
      else obj = new T.Mesh(new T.BoxGeometry(1, 1, 1), mat);
      obj.visible = false;this.scene.add(obj);g = {key, obj, mat, age: 0, life: 0};this.ghosts.push(g);
    }
    if (!g) return;
    if (ch) {
      // Copia a pose atual nó a nó (o clone tem a mesma estrutura de ossos).
      const src = [], dst = [];ch.root.traverse(o => src.push(o));g.obj.traverse(o => dst.push(o));
      for (let i = 0; i < Math.min(src.length, dst.length); i++) {dst[i].position.copy(src[i].position);dst[i].quaternion.copy(src[i].quaternion);dst[i].scale.copy(src[i].scale);}
    } else {const V = C.extras.visual;g.obj.scale.set(V.bodyWidth, V.bodyHeight, V.bodyDepth);g.obj.position.set(f.position.x, V.bodyHeight / 2 + alt, f.position.z);}
    g.mat.color.set(c.color);g.base = c.opacity * .55 * c.intensity;g.age = 0;g.life = c.duration * 2.2;g.obj.visible = true;
  }
  updateGhosts(dt) {for (const g of this.ghosts) {if (!g.obj.visible) continue;g.age += dt;const k = g.age / Math.max(1e-3, g.life);g.mat.opacity = Math.max(0, g.base * (1 - k));if (k >= 1) g.obj.visible = false;}}
  // ---------- Flash de tela e filtro (só visual) ----------
  screenFlash(p, y, strength, color, duration) {
    if (this.accessibility?.noFlash || C.vfx.master?.noFlash || C.vfx.laser?.noFlash) return;
    if (!this.flashEl || strength <= 0) return;
    const col = new T.Color(color), v = new T.Vector3(p.x, y, p.z);let sx = 50, sy = 50;
    if (this.camera) {v.project(this.camera);sx = (v.x * .5 + .5) * 100;sy = (-v.y * .5 + .5) * 100;}
    this.flash = {t: 0, d: Math.max(.05, duration), s: Math.min(1, strength)};
    this.flashEl.style.background = `radial-gradient(circle at ${sx}% ${sy}%, rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},1) 0%, rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},.35) 22%, rgba(0,0,0,0) 60%)`;
  }
  updateFlash(dt) {
    if (!this.flashEl) return;
    if (this.accessibility?.noFlash || C.vfx.master?.noFlash || C.vfx.laser?.noFlash) {this.flash = null;this.flashEl.style.opacity = '0';return;}
    if (this.flash) {this.flash.t += dt;const k = this.flash.t / this.flash.d;this.flashEl.style.opacity = String(Math.max(0, this.flash.s * (1 - k) * (1 - k)));if (k >= 1) {this.flash = null;this.flashEl.style.opacity = '0';}}
    if (this.filterUntil !== undefined && this.time >= this.filterUntil && this.canvas) {this.canvas.style.filter = '';this.filterUntil = undefined;}
  }
  canvasFilter(css, duration) {if (!this.canvas) return;this.canvas.style.filter = css;this.filterUntil = (this.time ?? 0) + duration;}
  // ---------- Tremor de câmera (transformação visual temporária; nunca toca no rig nem na entrada) ----------
  shake(key, n, power = 1, reason = '', durMult = 1) {
    if (this.accessibility?.reduceMotion || C.vfx.master?.reduceMotion || C.vfx.laser?.reduceMotion) return;
    const s = C.vfx[key];if (!C.vfx.shakeMaster.enabled || !s?.enabled) return;
    this.record(key, `${reason}${power !== 1 ? ` · força ${power.toFixed(2)}` : ''}`, {variant: 'ABC'[s.profile | 0]});
    this.shakes.push({key, t: 0, power, dur: durMult, n: n ? {x: n.x, z: n.z} : null, phase: Math.random() * 100, ax: rand(-1, 1)});
  }
  /** Deslocamento {x,y,z} e rotação (roll) da câmera neste quadro, somando os tremores ativos (limitado). */
  shakeOffset(dt, camera) {
    if (this.accessibility?.reduceMotion || C.vfx.master?.reduceMotion || C.vfx.laser?.reduceMotion || !C.vfx.shakeMaster.enabled) {this.shakes = [];return {x: 0, y: 0, z: 0, roll: 0};}
    let x = 0, y = 0, z = 0, roll = 0, limit = 0;
    for (const s of this.shakes) {
      const c = C.vfx[s.key], D = c.duration * Math.max(.01, s.dur ?? 1);s.t += dt;if (s.t > D) {s.dead = true;continue;}
      const k = s.t / D, A = c.amplitude * c.intensity * s.power, w = c.frequency * Math.PI * 2;limit = Math.max(limit, c.limit);
      let ox = 0, oy = 0, oz = 0, env;
      if ((c.profile | 0) === 0) { // Seco: ruído de alta frequência, recuperação rápida.
        env = Math.pow(1 - k, 2.5);ox = (Math.sin(s.t * w + s.phase) + .5 * Math.sin(s.t * w * 2.3 + s.phase * 2)) * A * env;oy = Math.sin(s.t * w * 1.3 + s.phase * 3) * A * env;oz = Math.cos(s.t * w * .9 + s.phase) * A * env * .6;
      } else if ((c.profile | 0) === 1) { // Amortecido: oscilação senoidal com decaimento exponencial.
        env = Math.exp(-c.damping * s.t);oy = Math.sin(s.t * w * .5) * A * env;ox = Math.sin(s.t * w * .5 + 1.3) * A * env * .5 * s.ax;
      } else { // Pulso direcional: empurra na direção da força e volta suavizado.
        const peak = .18;env = k < peak ? Math.sin(k / peak * Math.PI / 2) : Math.exp(-c.damping * (s.t - peak * D));
        const d = s.n ?? {x: 0, z: 1};ox = d.x * A * env;oz = d.z * A * env;oy = -A * .3 * env;
      }
      x += ox;y += oy;z += oz;roll += c.angular * .25 * (ox + oy);
    }
    this.shakes = this.shakes.filter(s => !s.dead);
    const m = Math.hypot(x, y, z);if (limit > 0 && m > limit) {x *= limit / m;y *= limit / m;z *= limit / m;}
    void camera;return {x, y, z, roll: Math.max(-.08, Math.min(.08, roll))};
  }
}
