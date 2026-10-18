// VFX sólidos: partículas e formas 3D com volume real (malhas instanciadas, sem sprites, billboards nem planos com textura).
// Só apresentação: lê o estado da simulação, nunca escreve nela. Independe do renderizador de sprites (legado ou VfxRuntime).
// Geometrias e materiais são criados uma vez e reutilizados; o número de objetos ativos tem teto rígido (C.vfx.solid.maxObjects).
import * as T from 'three';
import {C} from '../sim/config.js';
import {MOTION_SHAPES, DUST_NEW, WIND, RUN_DUST, RUN_WIND} from './solid-motion.js';
import {SmokeVolume, SMOKE_MAX_SPHERES} from './smoke-volume.js';

/** Famílias com seletor 3D. `names` descreve a aparência de cada opção (índice = vfx.<chave>.variant). `previews`: botões de prévia. */
const MOVE_PREVIEWS = [['dash', 'Dash'], ['start', 'Arrancada'], ['run', 'Corrida'], ['turn', 'Curva'], ['stop', 'Parada']];
export const SOLID_FAMILIES = [
  {key: 'solidDust', label: 'Poeira do dash e da arrancada (3D)', trigger: 'dash/esquiva, arrancada e parada', previews: MOVE_PREVIEWS, colors: 2, names: [
    'A · Poeira compacta: torrões e grãos lançados para trás pelos pés',
    'B · Rastro turbulento: volumes irregulares que giram e se dispersam',
    'C · Impacto pesado: blocos grandes no início, depois grãos pequenos',
    'D · Energético: cacos geométricos e onda baixa que se expande',
    'E · Ondas em camadas: faixas de fumaça empilhadas que sobem e se abrem',
    'F · Nuvem rolante: volumes de fumaça que rolam rente ao chão, com cauda enrolada',
    'G · Anel de nuvem: coroa de fumaça que se abre ao redor dos pés',
    'H · Coluna em espiral: fumaça sobe em hélice com a ponta enrolada']},
  {key: 'solidWind', label: 'Vento do dash e da arrancada (3D)', trigger: 'dash/esquiva, arrancada e parada', previews: MOVE_PREVIEWS, names: [
    'A · Rajada em S: caudas de vento que varrem curvas atrás do corpo e se dissolvem',
    'B · Redemoinho: coluna de vento em hélice que gira e sobe atrás dos pés, com poeira',
    'C · Caracol rasteiro: caracóis de vento deitados junto aos pés, abrindo para fora',
    'D · Onda de pressão: arcos largos de ar que se abrem atrás do corpo']},
  {key: 'solidRunDust', label: 'Poeira da corrida (3D)', trigger: 'sprint contínuo, curvas e desaceleração', previews: MOVE_PREVIEWS.slice(2), names: [
    'A · Pegadas de poeira: cada passada levanta volumes e grãos (mais no pé de fora da curva)',
    'B · Nuvem contínua: fio de volumes largos e baixos; a cauda cresce com a velocidade',
    'C · Sulcos rolantes: pequenas ondas curvas se abrem no chão a cada passada']},
  {key: 'solidRunWind', label: 'Vento da corrida (3D)', trigger: 'sprint contínuo, curvas e desaceleração', previews: MOVE_PREVIEWS.slice(2), names: [
    'A · Fitas contínuas: caudas em S saem dos ombros e varrem para trás; a curvatura segue o giro',
    'B · Esteira helicoidal: faixa em hélice que gira atrás do corredor, maior com a velocidade',
    'C · Arcos de pressão: arcos de ar em pé que se alargam atrás do tronco']},
  {key: 'solidDodge', label: 'Esquiva (3D)', trigger: 'esquiva (C)', names: [
    'A · Lâminas de vento: barras finas que cortam o ar ao lado do corpo',
    'B · Cristais fantasma: prismas luminosos deixados para trás, afundando',
    'C · Anéis de ar: argolas verticais que se afastam e crescem']},
  {key: 'solidLanding', label: 'Aterrissagem e colisão com o chão (3D)', trigger: 'queda e colisão com o solo', names: [
    'A · Cratera de torrões: anel de blocos que sobe em arco e volta ao chão',
    'B · Coroa de estacas: cones afiados que irrompem em círculo',
    'C · Onda e lascas: duas ondas baixas com lascas prismáticas']},
  {key: 'solidImpact', label: 'Impacto do golpe (3D)', trigger: 'tackle que acerta', names: [
    'A · Estilhaços cúbicos: cubos girando em leque a partir do contato',
    'B · Lanças de cristal: lâminas alongadas apontadas para fora',
    'C · Núcleo e argola: bloco central pulsando com argola vertical']},
  {key: 'solidBlock', label: 'Bloqueio e defesa perfeita (3D)', trigger: 'defesa parcial e perfeita', names: [
    'A · Placas de escudo: placas hexagonais em arco diante do defensor',
    'B · Lascas defletidas: cacos rebatidos na direção do golpe',
    'C · Anel de contenção: argola vertical com estacas de apoio']},
  {key: 'solidClash', label: 'Colisão entre tackles (3D)', trigger: 'clash', names: [
    'A · Cruz de lâminas: duas barras cruzadas que crescem e somem',
    'B · Argolas duplas: duas ondas baixas e fagulhas tetraédricas',
    'C · Núcleo prismático: prisma central com coroa de estacas']},
];
export const SOLID_KEYS = SOLID_FAMILIES.map(f => f.key);
/** Controles de cada família (chaves em C.vfx.<família>): uniformes, aplicados em SolidFx.spawn(). */
export const SOLID_PARAMS = ['intensity', 'amount', 'size', 'duration', 'velocity', 'scatter', 'lift', 'turbulence', 'opacity', 'fadeStart', 'fadeEnd'];

const HARD_CAP = 512;
const SHAPES = {
  chunk: () => { const g = new T.IcosahedronGeometry(.5, 0), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const s = 1 + .22 * Math.sin(i * 12.9898 + p.getX(i) * 78.233); p.setXYZ(i, p.getX(i) * s, p.getY(i) * (2 - s), p.getZ(i) * s); } g.computeVertexNormals(); return g; },
  grain: () => new T.TetrahedronGeometry(.5),
  shard: () => new T.OctahedronGeometry(.5),
  slab: () => new T.BoxGeometry(1, 1, 1),
  spike: () => new T.ConeGeometry(.5, 1, 5),
  prism: () => new T.CylinderGeometry(.5, .5, 1, 6),
  // Toroide deitado no chão (plano XZ); com `rx` fica vertical.
  wave: () => { const g = new T.TorusGeometry(1, .07, 6, 36); g.rotateX(Math.PI / 2); return g; },
  ...MOTION_SHAPES,
};
const mulberry = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = k => k * k * (3 - 2 * k);
const angDelta = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const PROFILE = {
  dash: t => ({v: t < .3 ? 9 : 0, dodge: t < .3, sprint: false, w: 0, T: .9}),
  start: t => ({v: t < .5 ? 6.2 * Math.min(1, t / .3) : 0, sprint: t < .5, w: 0, T: .9}),
  run: t => ({v: t < 1 ? 6.2 * Math.min(1, t / .35) : 0, sprint: t < 1, w: 0, T: 1.8}),
  turn: t => ({v: t < 1.4 ? 6.2 * Math.min(1, t / .35) : 0, sprint: t < 1.4, w: t > .4 && t < 1.4 ? 1.7 : 0, T: 2.2}),
  stop: t => ({v: t < .5 ? 6.2 * Math.min(1, t / .25) : 0, sprint: t < .5, w: 0, T: 1.3}),
};

/** Material com opacidade por instância (atributo instanceAlpha): o mesmo material serve todas as malhas do tipo. */
function solidMaterial(params) {
  const m = new T.MeshStandardMaterial({...params, transparent: true, depthWrite: true});
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float instanceAlpha;\nvarying float vIA;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvIA = instanceAlpha;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vIA;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vIA;');
  };
  m.customProgramCacheKey = () => 'solid-instance-alpha';
  return m;
}


export class SolidFx {
  constructor(scene) {
    this.scene = scene;
    this.group = new T.Group(); this.group.name = 'solid-fx'; scene.add(this.group);
    this.geometries = {}; for (const [k, f] of Object.entries(SHAPES)) this.geometries[k] = f();
    // Poucos materiais para todo o sistema (terra facetada, energia luminosa, poeira macia, vento); nenhum usa textura ou sprite.
    this.materials = {
      lit: solidMaterial({color: 0xffffff, roughness: .92, metalness: 0, flatShading: true}),
      glow: solidMaterial({color: 0xffffff, roughness: .35, metalness: .1, flatShading: true, emissive: 0x2f7f78, emissiveIntensity: .8}),
    };
    // Fumaça/poeira/vento: esferas agrupadas em clusters e desenhadas como UMA massa contínua por raymarching (smoke-volume.js).
    this.smoke = new SmokeVolume(this.group); this.materials.smoke = this.smoke.material; this.cur = null; this.cid = 0;
    this.meshes = new Map(); this.wrappers = new Map();
    this.all = []; this.free = []; for (let i = 0; i < HARD_CAP; i++) this.free.push({});
    this.timers = []; this.scripts = []; this.time = 0; this.seq = 1; this.rnd = mulberry(0x51ED);
    this.state = {}; this.seen = new WeakSet(); this.landings = []; this.fam = null; this.origin = null;
    this.accessibility = {noFlash: false, reduceMotion: false, highContrast: false};
    this.stats = {spawned: 0, peak: 0, active: 0, rejected: 0, byFamily: {}, byVariant: {}};
    this.log = []; this.white = new T.Color(0xffffff); this.dummy = new T.Object3D(); this.q = new T.Quaternion(); this.col = new T.Color(); this.up = new T.Vector3(0, 1, 0); this.v = new T.Vector3();
  }
  setAccessibility(a = {}) { this.accessibility = {...this.accessibility, ...a}; }
  get cfg() { return C.vfx; }
  cap() { return clamp(Math.round(C.vfx.solid?.maxObjects ?? 220), 8, HARD_CAP); }
  on(key) { return !!C.vfx.master?.enabled && !!C.vfx.solid?.enabled && !!C.vfx[key]?.enabled; }
  /** Geometria da malha: reaproveita os mesmos buffers da forma base e só acrescenta o atributo de opacidade por instância. */
  wrapper(shape) {
    const base = this.geometries[shape], g = new T.BufferGeometry();
    g.index = base.index; for (const [k, a] of Object.entries(base.attributes)) g.setAttribute(k, a);
    g.setAttribute('instanceAlpha', new T.InstancedBufferAttribute(new Float32Array(HARD_CAP).fill(1), 1).setUsage(T.DynamicDrawUsage));
    g.setAttribute('instanceFx', new T.InstancedBufferAttribute(new Float32Array(HARD_CAP * 3), 3).setUsage(T.DynamicDrawUsage));   // idade 0..1, semente, modo (0 volume, 1 faixa)
    if (!base.boundingSphere) base.computeBoundingSphere(); g.boundingSphere = base.boundingSphere;
    return g;
  }
  meshFor(shape, mat) {
    const id = shape + ':' + mat; let m = this.meshes.get(id);
    if (!m) {
      const g = this.wrapper(shape); this.wrappers.set(id, g);
      m = new T.InstancedMesh(g, this.materials[mat], HARD_CAP); m.userData.n = 0;
      m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false;
      m.setColorAt(0, this.col.set(0xffffff)); m.instanceColor.setUsage(T.DynamicDrawUsage);
      this.group.add(m); this.meshes.set(id, m);
    }
    return m;
  }
  record(family, variant, reason) {
    this.log.push({t: +this.time.toFixed(3), effect: family, variant, reason}); if (this.log.length > 120) this.log.shift();
    this.stats.byFamily[family] = (this.stats.byFamily[family] ?? 0) + 1;
    const k = `${family}:${variant}`; this.stats.byVariant[k] = (this.stats.byVariant[k] ?? 0) + 1;
  }
  /**
   * Uma partícula/forma 3D. Os controles da família em disparo (this.fam = C.vfx.<chave>) valem para todos os construtores:
   * amount (quantidade/taxa), velocity, scatter (dispersão), lift (altura), turbulence (rotação e ruído) e opacity.
   * Peças estruturais (ondas, núcleos) não são repetidas nem sumidas pela quantidade (shape 'wave' ou fixed: true).
   */
  spawn(o) {
    const F = this.fam, m = F && !o.fixed && o.shape !== 'wave' ? (F.amount ?? 1) : 1;
    if (m < 1 && this.rnd() > m) return false;
    const ok = this.put(o, F);
    if (m > 1) { const extra = Math.floor(m) - 1 + (this.rnd() < m - Math.floor(m) ? 1 : 0); for (let k = 0; k < extra; k++) this.put(o, F, true); }
    return ok;
  }
  put(o, F, clone = false) {
    if (this.all.length >= this.cap() || !this.free.length) { this.stats.rejected++; return false; }
    const reduce = this.accessibility.reduceMotion || C.vfx.master?.reduceMotion, hc = this.accessibility.highContrast || C.vfx.master?.highContrast;
    const kr = reduce ? .25 : 1, vel = (F?.velocity ?? 1) * kr, sc = F?.scatter ?? 1, lift = F?.lift ?? 1, tb = F?.turbulence ?? 1, op = F?.opacity ?? 1, org = this.origin, p = this.free.pop();
    const col = this.col.set(o.color ?? 0xffffff); if (hc) col.lerp(this.white, .35);
    const jit = clone ? .35 : 0, j = () => (this.rnd() - .5) * 2 * jit;
    let x = o.x, z = o.z; if (org) { x = org.x + (x - org.x) * sc; z = org.z + (z - org.z) * sc; }
    let vx = (o.vx || 0) * vel, vy = (o.vy || 0) * vel * lift, vz = (o.vz || 0) * vel;
    const hv = sc < 1 ? .5 + .5 * sc : 1; vx *= hv; vz *= hv; const sp = Math.hypot(vx, vz), spread = Math.max(0, sc - 1) * .8 + jit;
    vx += (this.rnd() - .5) * 2 * spread * sp; vz += (this.rnd() - .5) * 2 * spread * sp; if (clone) { x += j() * .15; z += j() * .15; vy *= 1 + j(); }
    let orb = null; if (o.orb) { const b = o.orb; orb = {cx: b.cx, cz: b.cz, vx: b.vx * vel, vz: b.vz * vel, a0: b.a0, w: b.w * tb, r0: b.r0 * sc, r1: b.r1 * sc, y0: b.y0 * lift, rise: b.rise * lift * kr}; }
    const alpha = Math.max(hc && op > 0 ? .85 : 0, (o.alpha ?? 1) * op), blob = (o.shape === 'lump' && o.mat === 'smoke'), squash = blob;
    let cluster = 0; if (blob) { let cl = this.cur; if (!cl || cl.n >= SMOKE_MAX_SPHERES || Math.hypot(x - cl.x, z - cl.z) > 1.8) cl = this.cur = {id: ++this.cid, n: 0, x, z}; cl.n++; cluster = cl.id; }
    const fs0 = clamp(F?.fadeStart ?? .6, 0, .98), fe0 = clamp(F?.fadeEnd ?? 1, fs0 + .02, 1);
    Object.assign(p, {fadeStart: fs0, fadeEnd: fe0, blob, cluster, shape: o.shape ?? 'chunk', mat: (o.mat === 'smoke' && !blob) ? 'lit' : (o.mat ?? 'lit'), x, y: (o.y ?? 0) * lift, z, vx, vy, vz, orb, tbAmp: Math.max(0, tb - 1) * 5,
      gx: o.gx || 0, gy: o.gy ?? 0, drag: o.drag ?? 0, swirl: (o.swirl || 0) * tb, life: Math.max(.05, o.life ?? .6), age: -(o.delay || 0),
      sx: (o.sx ?? o.s ?? .1) * (squash ? .95 + this.rnd() * .15 : 1), sy: (o.sy ?? o.s ?? .1) * (squash ? .82 + this.rnd() * .14 : 1), sz: (o.sz ?? o.s ?? .1) * (squash ? .95 + this.rnd() * .15 : 1), grow: o.grow || 0, growY: o.growY ?? o.grow ?? 0, growL: o.growL || 0,
      rx: o.rx || 0, ry: o.ry ?? (squash ? this.rnd() * 6.28 : 0), rz: o.rz || 0, wx: (o.wx || 0) * kr * tb, wy: (o.wy || 0) * kr * tb, wz: (o.wz || 0) * kr * tb, align: !!o.align, floor: o.floor ?? null,
      pop: o.pop ?? .12, hold: o.hold ?? .5, mode: o.mode || 0, seed: this.rnd(), r: col.r, g: col.g, b: col.b, alpha, bounce: o.bounce ?? .28, rest: false});
    this.all.push(p); this.stats.spawned++; return true;
  }
  /** Agenda uma ação com os mesmos controles de família que estavam ativos no disparo. */
  after(delay, fn) { const fam = this.fam, origin = this.origin; this.timers.push({at: this.time + delay, fn: () => { const f0 = this.fam, o0 = this.origin; this.fam = fam; this.origin = origin; try { fn(); } finally { this.fam = f0; this.origin = o0; } }}); }
  r(a, b) { return a + this.rnd() * (b - a); }
  reset() { for (const p of this.all) this.free.push(p); this.all.length = 0; this.timers = []; this.scripts = []; this.state = {}; this.landings = []; this.log = []; this.fam = null; this.origin = null; this.cur = null; this.smoke.clear(); this.group.visible = true; for (const m of this.meshes.values()) m.count = 0; }
  dispose() { this.reset(); for (const g of Object.values(this.geometries)) g.dispose(); for (const g of this.wrappers.values()) g.dispose(); for (const m of Object.values(this.materials)) m.dispose(); for (const m of this.meshes.values()) m.dispose(); this.smoke.dispose(); this.scene.remove(this.group); }

  // ---------- Atualização por quadro ----------
  update(fighters, events, dt, {visible = true} = {}) {
    this.group.visible = visible;
    this.time += dt;
    if (dt > 0) {
      for (const e of events || []) {
        if (this.seen.has(e)) continue; this.seen.add(e);
        const a = fighters[e.attacker], b = fighters[e.target]; if (!a || !b) continue;
        const n = e.normal ? this.unit(e.normal.x, e.normal.z) : this.unit(b.position.x - a.position.x, b.position.z - a.position.z);
        if (e.result === 'impact') this.fire('solidImpact', {pos: b.position, n, power: 1}, `golpe ${e.attacker}→${e.target}`);
        else if (e.result === 'partial') this.fire('solidBlock', {pos: b.position, n, power: 1}, 'defesa parcial');
        else if (e.result === 'perfect') this.fire('solidBlock', {pos: b.position, n, power: 1.7}, 'defesa perfeita');
        else if (e.result === 'clash' && e.attacker === 0) this.fire('solidClash', {pos: {x: (a.position.x + b.position.x) / 2, z: (a.position.z + b.position.z) / 2}, n, power: 1}, 'clash');
      }
      fighters.forEach((f, i) => {
        const L = f.lastLanding;
        if (L && this.landings[i] !== undefined && L.n !== this.landings[i]) {
          const minI = C.vfx.ground?.minImpact ?? 2;
          if (L.vertical >= minI) this.fire('solidLanding', {pos: {x: L.x, z: L.z}, power: Math.min(2, L.vertical / 7)}, `colisão com o solo (${L.vertical.toFixed(1)} m/s)`);
        }
        this.landings[i] = L?.n ?? 0;
        this.trackDash(f, i, dt);
      });
      this.runScripts(dt);
    }
    for (const t of this.timers.filter(t => t.at <= this.time)) t.fn();
    this.timers = this.timers.filter(t => t.at > this.time);
    this.integrate(dt);
  }
  unit(x, z) { const m = Math.hypot(x, z) || 1; return {x: x / m, z: z / m}; }
  /**
   * Dash comum (esquiva), arrancada, corrida contínua, curva e parada: o estado vem do lutador real (ou de um lutador virtual nas
   * prévias, pelo MESMO caminho). Esquiva: rajadas de poeira e vento. Sprint: arrancada (rajada), emissão contínua proporcional à
   * velocidade e à curva, desaceleração (`coast`) e parada (rajada). Nada aqui altera a simulação.
   */
  trackDash(f, key, dt) {
    const s = this.state[key] ??= {prev: {...f.position}, kind: null, t: 0, acc: 0, speed: 0, dir: {x: 0, z: 1}, turn: 0, hd: 0, n: 0, foot: 0, peak: 0};
    s.solo = f.solo ?? null; s.ov = f.ov ?? null;
    const dx = f.position.x - s.prev.x, dz = f.position.z - s.prev.z; s.prev = {...f.position};
    const sp = Math.hypot(dx, dz) / dt; s.speed += (sp - s.speed) * Math.min(1, dt * 18);
    if (sp > .05) { s.dir = this.unit(dx, dz); const hd = Math.atan2(s.dir.x, s.dir.z); s.turn += (angDelta(hd, s.hd) / dt - s.turn) * Math.min(1, dt * 10); s.hd = hd; }
    else { if (f.action?.heading != null) s.dir = {x: Math.sin(f.action.heading), z: Math.cos(f.action.heading)}; s.turn *= Math.max(0, 1 - dt * 10); }
    const was = s.kind, kind = f.action?.kind === 'dodge' ? 'dodge' : f.sprinting ? 'sprint' : ((was === 'sprint' || was === 'coast') && s.speed > 1.2 ? 'coast' : null);
    if (kind !== was) {
      if (!was && kind) { s.t = 0; s.acc = 0; s.peak = 0; this.burst(f, s, 'start', key); if (kind === 'dodge') this.dodgeFx(f, s, key); }
      else if (was && !kind && s.peak > 2.2) this.burst(f, s, 'stop', key);
      else if (was === 'dodge' && kind === 'sprint') s.t = 0;
      s.kind = kind;
    }
    if (!kind) return;
    s.t += dt; s.peak = Math.max(s.peak, s.speed);
    const sp1 = clamp(s.speed / 9, .3, 1.8), rate = kind === 'dodge' ? 34 : 10 + 14 * sp1; s.acc += dt;
    while (s.acc >= 1 / rate) {
      s.acc -= 1 / rate; s.n++; s.foot ^= 1;
      if (kind === 'dodge') this.burst(f, s, 'dash', key); else this.runTick(f, s, kind === 'coast' ? clamp((s.speed - 1.2) / 4, 0, 1) : 1);
    }
  }
  dodgeFx(f, s, key) { if (!s.solo || s.solo === 'solidDodge') this.fire('solidDodge', {pos: f.position, dir: s.dir, power: 1}, `esquiva ${key === 1 ? 'vermelho' : 'azul'}`); }
  /** Rajada de dash/arrancada/parada: poeira e vento (cada família com o seu estilo, intensidade e cores). */
  burst(f, s, phase, i) { this.dust(f, s, phase, i); this.wind(f, s, phase, i); }

  /** Opacidade ao longo da vida (0..1): cheia até fadeStart, cai suavemente e chega a zero em fadeEnd (frações da vida do objeto). */
  fade(p, k) { return k <= p.fadeStart ? 1 : k >= p.fadeEnd ? 0 : 1 - smooth((k - p.fadeStart) / (p.fadeEnd - p.fadeStart)); }

  integrate(dt) {
    const keep = []; for (const m of this.meshes.values()) m.userData.n = 0;
    const d = this.dummy, A = this.q;
    for (const p of this.all) {
      p.age += dt;
      if (p.age >= p.life) { this.free.push(p); continue; }
      keep.push(p);
      if (p.age < 0) continue;
      const k = p.age / p.life;
      if (dt > 0 && !p.rest) {
        if (p.orb) { const o = p.orb, a = o.a0 + o.w * p.age, rad = o.r0 + (o.r1 - o.r0) * k; p.x = o.cx + o.vx * p.age + Math.cos(a) * rad; p.z = o.cz + o.vz * p.age + Math.sin(a) * rad; p.y = o.y0 + o.rise * p.age; p.ry += 3 * dt; }
        else {
          if (p.swirl) { const c = Math.cos(p.swirl * dt), s = Math.sin(p.swirl * dt), vx = p.vx * c - p.vz * s; p.vz = p.vx * s + p.vz * c; p.vx = vx; }
          if (p.tbAmp) { p.vx += (this.rnd() - .5) * p.tbAmp * dt * 8; p.vz += (this.rnd() - .5) * p.tbAmp * dt * 8; p.vy += (this.rnd() - .5) * p.tbAmp * dt * 5; }
          p.vy -= p.gy * dt; p.vx -= p.gx * dt; const dr = Math.exp(-p.drag * dt); p.vx *= dr; p.vy *= dr; p.vz *= dr;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          if (p.floor !== null && p.y < p.floor) { p.y = p.floor; if (Math.abs(p.vy) < 1) { p.rest = true; p.vx = p.vy = p.vz = 0; p.wx = p.wy = p.wz = 0; } else { p.vy = -p.vy * p.bounce; p.vx *= .55; p.vz *= .55; p.wx *= .5; p.wz *= .5; } }
        }
        p.rx += p.wx * dt; p.ry += p.wy * dt; p.rz += p.wz * dt;
      }
      const sc = k < p.pop / p.life ? smooth(clamp(k / (p.pop / p.life), 0, 1)) : (k < p.hold ? 1 : 1 - smooth((k - p.hold) / (1 - p.hold)));
      const gxz = 1 + p.grow * k, gy = 1 + p.growY * k, gl = 1 + p.growL * k;
      if (p.blob) { this.smoke.add(p.cluster, p.x, p.y, p.z, .5 * Math.cbrt(p.sx * gxz * p.sy * gy * p.sz * gxz) * sc, p.r, p.g, p.b, p.alpha * this.fade(p, k), k, p.seed); continue; }
      const m = this.meshFor(p.shape, p.mat), idx = m.userData.n++;
      d.position.set(p.x, p.y, p.z); d.scale.set(Math.max(1e-4, p.sx * gxz * sc), Math.max(1e-4, p.sy * gy * sc), Math.max(1e-4, p.sz * gxz * gl * sc));
      if (p.align) { this.v.set(p.vx, p.vy, p.vz); if (this.v.lengthSq() > 1e-6) { A.setFromUnitVectors(this.up, this.v.normalize()); d.quaternion.copy(A); } }
      else d.rotation.set(p.rx, p.ry, p.rz, 'YXZ');
      d.updateMatrix(); m.setMatrixAt(idx, d.matrix); this.col.setRGB(p.r, p.g, p.b); m.setColorAt(idx, this.col);
      m.geometry.attributes.instanceAlpha.array[idx] = p.alpha * this.fade(p, k);
      const fx = m.geometry.attributes.instanceFx.array;fx[idx * 3] = k;fx[idx * 3 + 1] = p.seed;fx[idx * 3 + 2] = p.mode;
    }
    this.all = keep; this.smoke.setQuality(C.vfx.solid?.quality ?? 1); this.smoke.flush();
    for (const m of this.meshes.values()) { m.count = m.userData.n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.geometry.attributes.instanceAlpha.needsUpdate = true; m.geometry.attributes.instanceFx.needsUpdate = true; }
    this.stats.clusters = this.smoke.active; this.stats.active = keep.length; this.stats.peak = Math.max(this.stats.peak, keep.length);
  }

  // ---------- Disparo pontual ----------
  fire(key, ctx, reason) {
    if (!this.on(key)) { return; }
    const c = C.vfx[key], v = c.variant | 0, fam = SOLID_FAMILIES.find(f => f.key === key), variant = clamp(v, 0, fam.names.length - 1);
    this.record(key, variant, reason);
    const q = C.vfx.solid.quality ?? 1, I = (c.intensity ?? 1) * (ctx.power ?? 1), S = c.size ?? 1, D = c.duration ?? 1, cnt = n => Math.max(1, Math.round(n * (q === 0 ? .55 : q === 2 ? 1.4 : 1) * Math.min(1.6, .6 + .4 * I)));
    const o = {c, I, S, D, cnt, ...ctx};
    this.fam = c; this.cur = null; this.origin = ctx.pos;
    try { BUILD[key][variant].call(this, o); } finally { this.fam = null; this.origin = null; }
  }

  // ---------- Prévias e comparação ----------
  /**
   * Prévia. Famílias de movimento (poeira/vento do dash e da corrida): `what` = dash | start | run | turn | stop, rodando o MESMO caminho
   * da luta com um lutador virtual que cruza a tela; só a família pedida aparece (solo), salvo opts.solo === null ou key 'all'.
   * opts.variant força uma opção (comparação); opts.lane afasta a faixa em profundidade.
   */
  preview(key, fighters, what = 'dash', opts = {}) {
    const a = fighters[0], o = fighters[1] ?? fighters[0], n = this.unit(o.position.x - a.position.x, o.position.z - a.position.z), tag = 'prévia manual';
    if (['solidDust', 'solidWind', 'solidRunDust', 'solidRunWind', 'all'].includes(key)) { this.script(key, fighters, what, opts); return; }
    if (key === 'solidDodge') { this.fire(key, {pos: o.position, dir: this.unit(o.position.x - a.position.x, o.position.z - a.position.z), power: 1}, tag); return; }
    if (key === 'solidLanding') { this.fire(key, {pos: o.position, power: 1.4}, tag); return; }
    if (key === 'solidClash') { this.fire(key, {pos: {x: (a.position.x + o.position.x) / 2, z: (a.position.z + o.position.z) / 2}, n, power: 1}, tag); return; }
    this.fire(key, {pos: o.position, n, power: 1}, tag);
  }
  /** Lutador virtual com perfil de velocidade/curva; chama trackDash como a luta faz. */
  script(key, fighters, what, opts) {
    const a = fighters[0], o = fighters[1] ?? fighters[0], same = a === o, toO = same ? {x: 0, z: 1} : this.unit(o.position.x - a.position.x, o.position.z - a.position.z), side = {x: toO.z, z: -toO.x}, lane = opts.lane ?? 0;
    const prof = PROFILE[what] ?? PROFILE.dash, vf = {position: {x: a.position.x + toO.x * lane - side.x * 2.2, z: a.position.z + toO.z * lane - side.z * 2.2}, sprinting: false, action: null, solo: opts.solo === null ? null : (opts.solo ?? (key === 'all' ? null : key)), ov: opts.variant != null ? {[key]: opts.variant} : (opts.ov ?? null)};
    this.scripts.push({key: 'pv' + (this.seq++), vf, t: 0, T: prof(0).T, prof, hd: Math.atan2(side.x, side.z), side});
  }
  runScripts(dt) {
    this.scripts = this.scripts.filter(sc => {
      sc.t += dt; const st = sc.prof(sc.t), on = sc.t < sc.T;
      sc.hd += st.w * dt; const dir = {x: Math.sin(sc.hd), z: Math.cos(sc.hd)};
      sc.vf.position.x += dir.x * st.v * dt; sc.vf.position.z += dir.z * st.v * dt; sc.vf.sprinting = !!st.sprint; sc.vf.action = st.dodge ? {kind: 'dodge', heading: sc.hd} : null;
      this.trackDash(sc.vf, sc.key, dt);
      const alive = on || this.state[sc.key]?.kind; if (!alive) delete this.state[sc.key]; return alive && sc.t < sc.T + 1.5;
    });
  }
  /** Compara todas as opções de uma família lado a lado (uma faixa por opção, mesmo movimento). */
  compare(key, fighters, what = 'dash') {
    const n = SOLID_FAMILIES.find(f => f.key === key).names.length;
    for (let v = 0; v < n; v++) this.preview(key, fighters, what, {variant: v, lane: (v - (n - 1) / 2) * 1.05});
  }
  compareDust(fighters, what = 'dash') { this.compare('solidDust', fighters, what); }

  // ---------- Poeira, vento e corrida ----------
  muted(s, key) { return !!s.solo && s.solo !== key; }
  footsOf(f, dir) { const side = {x: dir.z, z: -dir.x}; return {side, feet: [-1, 1].map(k => ({x: f.position.x + side.x * .2 * k - dir.x * .08, z: f.position.z + side.z * .2 * k - dir.z * .08}))}; }
  motionCtx(key, f, s, phase) {
    const c = C.vfx[key], dir = s.dir, {side, feet} = this.footsOf(f, dir), sp = clamp((s.speed || 8) / 9, .4, 1.8) * (key.startsWith('solidRun') ? (c.intensity ?? 1) : 1), q = C.vfx.solid.quality ?? 1;
    return {c, f, s, phase, dir, side, feet, sp, I: (c.intensity ?? 1) * sp, S: (c.size ?? 1) * (key === 'solidDust' ? 1.6 : 1), D: c.duration ?? 1, qk: q === 0 ? .55 : q === 2 ? 1.4 : 1, t: s.t || 0, col: c.color, col2: c.color2, n: s.n || 0, foot: s.foot || 0, turn: s.turn || 0, taper: 1};
  }
  /** Poeira (dash, arrancada, parada). */
  dust(f, s, phase, i) {
    if (!this.on('solidDust') || this.muted(s, 'solidDust')) return;
    const c = C.vfx.solidDust, v = s.ov?.solidDust ?? clamp(c.variant | 0, 0, BUILD_DUST.length - 1), ctx = this.motionCtx('solidDust', f, s, phase);
    this.logMotion('solidDust', v, phase, s);
    this.fam = c; this.cur = null; this.origin = f.position;
    try { BUILD_DUST[v].call(this, ctx); } finally { this.fam = null; this.origin = null; }
  }
  /** Vento (dash, arrancada, parada). */
  wind(f, s, phase, i) {
    if (!this.on('solidWind') || this.muted(s, 'solidWind')) return;
    const c = C.vfx.solidWind, v = s.ov?.solidWind ?? clamp(c.variant | 0, 0, WIND.length - 1), ctx = this.motionCtx('solidWind', f, s, phase);
    this.logMotion('solidWind', v, phase, s);
    this.fam = c; this.cur = null; this.origin = f.position;
    try { WIND[v].call(this, ctx); } finally { this.fam = null; this.origin = null; }
  }
  /** Emissão contínua da corrida (um tick): poeira e vento próprios do sprint; `taper` < 1 na desaceleração. */
  runTick(f, s, taper) {
    for (const [key, list] of [['solidRunDust', RUN_DUST], ['solidRunWind', RUN_WIND]]) {
      if (!this.on(key) || this.muted(s, key)) continue;
      const c = C.vfx[key], v = s.ov?.[key] ?? clamp(c.variant | 0, 0, list.length - 1), ctx = {...this.motionCtx(key, f, s, 'run'), taper};
      this.logMotion(key, v, taper < 1 ? 'desaceleração' : 'corrida', s);
      this.fam = c; this.cur = null; this.origin = f.position;
      try { list[v].call(this, ctx); } finally { this.fam = null; this.origin = null; }
    }
  }
  logMotion(key, v, phase, s) {
    const label = phase === 'start' ? 'arrancada' : phase === 'stop' ? 'parada' : phase;
    if (phase === 'start' || phase === 'stop') { this.record(key, v, label); return; }
    const m = s.logged ??= {}; if (!m[key] || this.time - m[key] > .25) { m[key] = this.time; this.record(key, v, label); }
  }
}

// ---- helpers de cor ----
const shade = (hex, k) => { const c = new T.Color(hex); c.multiplyScalar(k); return c.getHex(); };
const mixc = (a, b, k) => new T.Color(a).lerp(new T.Color(b), k).getHex();

// ---- Poeira: quatro estilos ----
const BUILD_DUST = [
  // A · Poeira compacta: torrões e grãos pequenos, lançados para trás pelos pés.
  function ({phase, dir, side, feet, I, S, D, qk, col}) {
    const burst = phase === 'start' ? 2.4 : phase === 'stop' ? 1.6 : 1, back = phase === 'stop' ? 1 : -1;
    for (const ft of feet) {
      const n = Math.max(1, Math.round((phase === 'dash' ? 1.3 : 4) * burst * I * qk));
      for (let k = 0; k < n; k++) {
        const sp = this.r(2, 4.4) * I * (phase === 'stop' ? .7 : 1), lat = this.r(-1, 1) * 1.1, big = k % 3 === 0;
        this.spawn({shape: big ? 'chunk' : 'grain', mat: 'lit', color: shade(col, this.r(.75, 1.15)), x: ft.x, y: .02, z: ft.z, s: (big ? this.r(.07, .11) : this.r(.03, .055)) * S,
          vx: dir.x * back * sp + side.x * lat, vz: dir.z * back * sp + side.z * lat, vy: this.r(.8, 2.1) * I, gy: 15, drag: 1.4, floor: .03, life: this.r(.45, .75) * D,
          wx: this.r(-14, 14), wy: this.r(-14, 14), wz: this.r(-14, 14), hold: .55});
      }
    }
  },
  // B · Rastro turbulento: volumes irregulares grandes que giram e se dispersam ao longo do deslocamento.
  function ({phase, dir, side, feet, I, S, D, qk, col}) {
    const burst = phase === 'start' ? 2 : phase === 'stop' ? 1.8 : 1;
    for (const ft of feet) {
      const n = Math.max(1, Math.round((phase === 'dash' ? .8 : 2.6) * burst * I * qk));
      for (let k = 0; k < n; k++) {
        const sw = (this.rnd() < .5 ? -1 : 1) * this.r(3, 7), sp = this.r(.7, 2) * I, sz = this.r(.12, .22) * S;
        this.spawn({shape: 'chunk', mat: 'lit', color: shade(col, this.r(.9, 1.25)), x: ft.x + this.r(-.1, .1), y: .07, z: ft.z + this.r(-.1, .1), sx: sz, sy: sz * this.r(.6, 1), sz: sz * this.r(.8, 1.2),
          vx: -dir.x * sp * (phase === 'stop' ? -.4 : 1) + side.x * this.r(-.8, .8), vz: -dir.z * sp * (phase === 'stop' ? -.4 : 1) + side.z * this.r(-.8, .8), vy: this.r(.3, 1.1), gy: 1.2, drag: 2.4, swirl: sw,
          wx: this.r(-5, 5), wy: sw, wz: this.r(-5, 5), grow: .9, growY: .6, life: this.r(.75, 1.15) * D, pop: .18, hold: .35, floor: .05, bounce: .1});
      }
    }
  },
  // C · Impacto pesado: fragmentos grandes de terra no início, depois só partículas pequenas.
  function ({phase, dir, side, feet, I, S, D, qk, t, col}) {
    const heavy = phase === 'start' || (phase === 'dash' && t < .1), back = phase === 'stop' ? 1 : -1;
    for (const ft of feet) {
      if (heavy) {
        const n = Math.max(2, Math.round((phase === 'start' ? 3.2 : 1.4) * I * qk));
        for (let k = 0; k < n; k++) {
          const lat = this.r(-1.6, 1.6), sz = this.r(.14, .26) * S, sp = this.r(3, 6) * I;
          this.spawn({shape: k % 2 ? 'slab' : 'chunk', mat: 'lit', color: shade(col, this.r(.6, .95)), x: ft.x, y: .05, z: ft.z, sx: sz, sy: sz * this.r(.6, 1), sz: sz * this.r(.8, 1.3),
            vx: dir.x * back * sp + side.x * lat, vz: dir.z * back * sp + side.z * lat, vy: this.r(2.8, 5) * I, gy: 24, drag: .5, floor: sz * .4, life: this.r(.7, 1) * D,
            wx: this.r(-9, 9), wy: this.r(-9, 9), wz: this.r(-9, 9), bounce: .2, hold: .6});
        }
      } else {
        const n = Math.max(1, Math.round((phase === 'stop' ? 4 : 1.2) * I * qk));
        for (let k = 0; k < n; k++) this.spawn({shape: 'grain', mat: 'lit', color: shade(col, this.r(.7, 1.1)), x: ft.x, y: .02, z: ft.z, s: this.r(.025, .045) * S,
          vx: dir.x * back * this.r(1.4, 3) + side.x * this.r(-1, 1), vz: dir.z * back * this.r(1.4, 3) + side.z * this.r(-1, 1), vy: this.r(.6, 1.6), gy: 14, drag: 1.2, floor: .03, life: this.r(.35, .6) * D,
          wx: this.r(-12, 12), wy: this.r(-12, 12), wz: this.r(-12, 12)});
      }
    }
  },
  // D · Energético: cacos geométricos luminosos e uma onda baixa que se expande pelo chão.
  function ({phase, f, dir, side, feet, I, S, D, qk, col2, t, s}) {
    const wave = (x, z, r, life) => this.spawn({shape: 'wave', mat: 'glow', color: col2, x, y: .05, z, sx: r * S, sy: .55, sz: r * S, grow: 3.4 * I, growY: -.5, life: life * D, pop: .06, hold: .2});
    if (phase === 'start' || phase === 'stop') wave(f.position.x, f.position.z, .35, .5);
    else if (Math.round(t * 30) % 4 === 0) wave(f.position.x - dir.x * .25, f.position.z - dir.z * .25, .2, .38);
    const burst = phase === 'start' ? 2.2 : phase === 'stop' ? 1.5 : 1, back = phase === 'stop' ? 1 : -1;
    for (const ft of feet) {
      const n = Math.max(1, Math.round((phase === 'dash' ? 1.1 : 3) * burst * I * qk));
      for (let k = 0; k < n; k++) {
        const sp = this.r(2, 5) * I, sz = this.r(.05, .1) * S;
        this.spawn({shape: k % 3 === 0 ? 'prism' : k % 3 === 1 ? 'shard' : 'grain', mat: 'glow', color: mixc(col2, 0xffffff, this.r(0, .4)), x: ft.x, y: .05, z: ft.z, sx: sz, sy: sz * (k % 3 === 0 ? 1.6 : 1), sz,
          vx: dir.x * back * sp + side.x * this.r(-1.4, 1.4), vz: dir.z * back * sp + side.z * this.r(-1.4, 1.4), vy: this.r(.4, 1.5), gy: 7, drag: 1.1, floor: .04, life: this.r(.4, .7) * D,
          wx: this.r(-10, 10), wy: this.r(-10, 10), wz: this.r(-10, 10), bounce: .45, hold: .5});
      }
    }
  },
];

BUILD_DUST.push(...DUST_NEW); // estilos E–H (solid-motion.js)

// ---- Outras famílias: três variantes cada, com formas e movimento próprios ----
const yawOf = (dir) => Math.atan2(dir.x, dir.z);
const BUILD = {
  solidDodge: [
    // A · Lâminas de vento
    function ({pos, dir, I, S, D, c}) {
      const side = {x: dir.z, z: -dir.x};
      for (let k = 0; k < 6; k++) { const off = this.r(-.7, .7);
        this.spawn({shape: 'slab', mat: 'glow', color: mixc(c.color, 0xffffff, this.r(0, .3)), x: pos.x - dir.x * .5 + side.x * off, y: .25 + this.r(0, 1), z: pos.z - dir.z * .5 + side.z * off, sx: .035 * S, sy: .035 * S, sz: this.r(.7, 1.3) * S,
          vx: -dir.x * this.r(6, 10) * I, vz: -dir.z * this.r(6, 10) * I, ry: yawOf(dir), drag: 3, life: .32 * D, pop: .04, hold: .3, delay: k * .012}); }
    },
    // B · Cristais fantasma
    function ({pos, dir, I, S, D, c}) {
      for (let k = 1; k <= 3; k++)
        this.spawn({shape: 'shard', mat: 'glow', color: mixc(c.color, 0xffffff, .15 * k), x: pos.x - dir.x * (.4 + k * .5), y: .8, z: pos.z - dir.z * (.4 + k * .5), sx: .38 * S, sy: 1.05 * S, sz: .38 * S, ry: yawOf(dir) + k,
          wy: 2.2, vy: -.5, life: (.5 - k * .05) * D, pop: .05, hold: .25, delay: k * .02});
    },
    // C · Anéis de ar
    function ({pos, dir, I, S, D, c}) {
      for (let k = 0; k < 3; k++)
        this.spawn({shape: 'wave', mat: 'glow', color: c.color, x: pos.x - dir.x * (.3 + k * .35), y: .85, z: pos.z - dir.z * (.3 + k * .35), s: .55 * S, sy: .55 * S, rx: Math.PI / 2, ry: yawOf(dir), grow: 1.6, growY: 1.6,
          vx: -dir.x * 2.2 * I, vz: -dir.z * 2.2 * I, life: .42 * D, pop: .05, hold: .25, delay: k * .05});
    },
  ],
  solidLanding: [
    // A · Cratera de torrões
    function ({pos, I, S, D, c, cnt}) {
      const n = cnt(14);
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + this.r(-.15, .15), sp = this.r(2.5, 5) * I, sz = this.r(.1, .2) * S;
        this.spawn({shape: k % 2 ? 'chunk' : 'slab', mat: 'lit', color: shade(c.color, this.r(.6, 1)), x: pos.x + Math.cos(a) * .3, y: .05, z: pos.z + Math.sin(a) * .3, s: sz, sy: sz * .8,
          vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: this.r(2.5, 5) * I, gy: 22, drag: .6, floor: sz * .4, life: this.r(.7, 1.05) * D, wx: this.r(-8, 8), wy: this.r(-8, 8), wz: this.r(-8, 8), bounce: .2, hold: .6}); }
      this.spawn({shape: 'wave', mat: 'lit', color: shade(c.color, .8), x: pos.x, y: .06, z: pos.z, s: .5 * S, sy: 1.6, grow: 4.2 * I, growY: -.6, life: .5 * D, pop: .05, hold: .3});
    },
    // B · Coroa de estacas
    function ({pos, I, S, D, c, cnt}) {
      const n = cnt(12);
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + this.r(-.1, .1), rr = this.r(.45, .9) * S, h = this.r(.5, 1.1) * I * S;
        this.spawn({shape: 'spike', mat: 'lit', color: shade(c.color, this.r(.7, 1)), x: pos.x + Math.cos(a) * rr, y: h * .5 * .3, z: pos.z + Math.sin(a) * rr, sx: .16 * S, sy: h, sz: .16 * S, rx: Math.sin(a) * .35, rz: -Math.cos(a) * .35,
          vy: 1.2, drag: 4, life: this.r(.55, .8) * D, pop: .06, hold: .55, delay: k * .008}); }
      for (let k = 0; k < cnt(8); k++) this.spawn({shape: 'grain', mat: 'lit', color: shade(c.color, .9), x: pos.x, y: .05, z: pos.z, s: this.r(.04, .07) * S, vx: this.r(-3, 3), vz: this.r(-3, 3), vy: this.r(2, 4), gy: 18, floor: .03, life: .6 * D, wx: this.r(-9, 9), wz: this.r(-9, 9)});
    },
    // C · Onda e lascas
    function ({pos, I, S, D, c, cnt}) {
      for (let k = 0; k < 2; k++) this.spawn({shape: 'wave', mat: 'glow', color: mixc(c.color, 0xffffff, .3 * k), x: pos.x, y: .05 + k * .02, z: pos.z, s: (.4 + k * .1) * S, sy: .6, grow: (4 + k) * I, growY: -.4, life: (.55 + k * .12) * D, pop: .05, hold: .25, delay: k * .08});
      const n = cnt(9);
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, sp = this.r(1.2, 3) * I;
        this.spawn({shape: 'prism', mat: 'glow', color: mixc(c.color, 0xffffff, .2), x: pos.x, y: .1, z: pos.z, sx: .07 * S, sy: this.r(.22, .4) * S, sz: .07 * S, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: this.r(3, 5.5) * I, gy: 14, align: true, life: .6 * D, hold: .45}); }
    },
  ],
  solidImpact: [
    // A · Estilhaços cúbicos
    function ({pos, n, I, S, D, c, cnt}) {
      const cx = pos.x, cz = pos.z, N = cnt(14);
      for (let k = 0; k < N; k++) { const a = Math.atan2(n.x, n.z) + this.r(-1.1, 1.1), sp = this.r(3, 7.5) * I, sz = this.r(.05, .11) * S;
        this.spawn({shape: 'slab', mat: 'glow', color: mixc(c.color, 0xffffff, this.r(0, .35)), x: cx, y: .75 + this.r(-.1, .2), z: cz, s: sz, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp, vy: this.r(.5, 3), gy: 14, drag: .9, floor: .03,
          life: this.r(.4, .65) * D, wx: this.r(-16, 16), wy: this.r(-16, 16), wz: this.r(-16, 16), hold: .5}); }
    },
    // B · Lanças de cristal
    function ({pos, n, I, S, D, c, cnt}) {
      const N = cnt(9);
      for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2 + this.r(-.2, .2), sp = this.r(4, 8) * I, up = this.r(-.3, .8);
        this.spawn({shape: 'shard', mat: 'glow', color: mixc(c.color, 0xffffff, this.r(0, .3)), x: pos.x, y: .8, z: pos.z, sx: .06 * S, sy: this.r(.3, .55) * S, sz: .06 * S, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: up * sp * .5, drag: 3.2, align: true, life: .38 * D, pop: .04, hold: .35}); }
    },
    // C · Núcleo e argola
    function ({pos, n, I, S, D, c, cnt}) {
      this.spawn({shape: 'chunk', mat: 'glow', color: mixc(c.color, 0xffffff, .5), x: pos.x, y: .8, z: pos.z, s: .35 * S, grow: .8, wy: 6, wx: 4, life: .3 * D, pop: .05, hold: .3});
      this.spawn({shape: 'wave', mat: 'glow', color: c.color, x: pos.x, y: .8, z: pos.z, s: .35 * S, sy: .35 * S, rx: Math.PI / 2, ry: yawOf(n), grow: 3.6 * I, growY: 3.6 * I, life: .42 * D, pop: .05, hold: .3});
      for (let k = 0; k < cnt(6); k++) this.spawn({shape: 'grain', mat: 'glow', color: c.color, x: pos.x, y: .8, z: pos.z, s: this.r(.05, .09) * S, vx: this.r(-4, 4), vz: this.r(-4, 4), vy: this.r(-1, 3), gy: 12, floor: .03, life: .5 * D, wx: this.r(-14, 14), wz: this.r(-14, 14)});
    },
  ],
  solidBlock: [
    // A · Placas de escudo
    function ({pos, n, I, S, D, c}) {
      const side = {x: n.z, z: -n.x};
      for (let k = -2; k <= 2; k++) { const arc = k * .34, px = pos.x - n.x * .55 + side.x * Math.sin(arc) * .8, pz = pos.z - n.z * .55 + side.z * Math.sin(arc) * .8;
        this.spawn({shape: 'prism', mat: 'glow', color: mixc(c.color, 0xffffff, .12 * Math.abs(k)), x: px, y: .8 + (k % 2) * .18, z: pz, sx: .42 * S, sy: .06 * S, sz: .42 * S, rx: Math.PI / 2, ry: yawOf(n) + arc,
          vx: -n.x * .9 * I, vz: -n.z * .9 * I, drag: 1.5, life: .36 * D * Math.min(1.4, I), pop: .06, hold: .45, delay: Math.abs(k) * .02}); }
    },
    // B · Lascas defletidas
    function ({pos, n, I, S, D, c, cnt}) {
      for (let k = 0; k < cnt(9); k++) { const a = Math.atan2(-n.x, -n.z) + this.r(-.8, .8), sp = this.r(3, 6.5) * I;
        this.spawn({shape: 'shard', mat: 'glow', color: mixc(c.color, 0xffffff, this.r(0, .4)), x: pos.x - n.x * .5, y: .8 + this.r(-.25, .25), z: pos.z - n.z * .5, sx: .05 * S, sy: this.r(.18, .34) * S, sz: .05 * S, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp, vy: this.r(-.5, 1.5), gy: 6, drag: 2, align: true, life: .42 * D, hold: .4}); }
    },
    // C · Anel de contenção
    function ({pos, n, I, S, D, c}) {
      const px = pos.x - n.x * .5, pz = pos.z - n.z * .5;
      this.spawn({shape: 'wave', mat: 'glow', color: c.color, x: px, y: .8, z: pz, s: .45 * S, sy: .45 * S, rx: Math.PI / 2, ry: yawOf(n), grow: 1.5 * I, growY: 1.5 * I, life: .44 * D, pop: .06, hold: .35});
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4, sd = {x: n.z, z: -n.x};
        this.spawn({shape: 'spike', mat: 'glow', color: mixc(c.color, 0xffffff, .3), x: px + sd.x * Math.cos(a) * .5, y: .8 + Math.sin(a) * .5, z: pz + sd.z * Math.cos(a) * .5, sx: .08 * S, sy: .3 * S, sz: .08 * S,
          vx: sd.x * Math.cos(a) * 1.5 - n.x * .4, vy: Math.sin(a) * 1.5, vz: sd.z * Math.cos(a) * 1.5 - n.z * .4, align: true, life: .36 * D, hold: .35}); }
    },
  ],
  solidClash: [
    // A · Cruz de lâminas
    function ({pos, I, S, D, c}) {
      for (let k = 0; k < 2; k++) this.spawn({shape: 'slab', mat: 'glow', color: mixc(c.color, 0xffffff, .25 * k), x: pos.x, y: .85, z: pos.z, sx: .09 * S, sy: .09 * S, sz: 1.5 * S, ry: k ? Math.PI / 4 : -Math.PI / 4, rx: k ? .2 : -.2, grow: 1.1 * I, growY: .3, wy: k ? 1.6 : -1.6, life: .5 * D, pop: .05, hold: .3});
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; this.spawn({shape: 'grain', mat: 'glow', color: c.color, x: pos.x, y: .85, z: pos.z, s: .07 * S, vx: Math.cos(a) * 5 * I, vz: Math.sin(a) * 5 * I, vy: this.r(.5, 2), gy: 9, floor: .03, life: .5 * D, wx: this.r(-12, 12), wz: this.r(-12, 12)}); }
    },
    // B · Argolas duplas
    function ({pos, I, S, D, c, cnt}) {
      for (let k = 0; k < 2; k++) this.spawn({shape: 'wave', mat: 'glow', color: mixc(c.color, 0xffffff, .3 * k), x: pos.x, y: .06 + k * .02, z: pos.z, s: (.45 + k * .15) * S, sy: .7, grow: (4.2 + k) * I, growY: -.5, life: (.55 + k * .15) * D, pop: .05, hold: .25, delay: k * .09});
      for (let k = 0; k < cnt(10); k++) this.spawn({shape: 'grain', mat: 'glow', color: c.color, x: pos.x, y: .6, z: pos.z, s: this.r(.05, .1) * S, vx: this.r(-6, 6) * I, vz: this.r(-6, 6) * I, vy: this.r(1, 4), gy: 12, floor: .03, life: .55 * D, wx: this.r(-14, 14), wy: this.r(-14, 14), wz: this.r(-14, 14), bounce: .4});
    },
    // C · Núcleo prismático
    function ({pos, I, S, D, c, cnt}) {
      this.spawn({shape: 'prism', mat: 'glow', color: mixc(c.color, 0xffffff, .5), x: pos.x, y: .9, z: pos.z, sx: .45 * S, sy: .8 * S, sz: .45 * S, grow: .9, growY: .4, wy: 5, life: .46 * D, pop: .06, hold: .3});
      const N = cnt(10);
      for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2; this.spawn({shape: 'spike', mat: 'glow', color: c.color, x: pos.x, y: .9, z: pos.z, sx: .09 * S, sy: .38 * S, sz: .09 * S, vx: Math.cos(a) * 5 * I, vz: Math.sin(a) * 5 * I, vy: this.r(-.5, 1), drag: 2.4, align: true, life: .42 * D, hold: .35}); }
    },
  ],
};
