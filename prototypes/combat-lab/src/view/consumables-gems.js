// Consumíveis "Gemas Facetadas" (coleção A escolhida em 21/10/2026 no laboratório prototypes/hud-consumiveis): 7 modelos 3D angulares
// com brilho interno, pedestal hexagonal, indicador flutuante (losango de vidro) e centelhas three.quarks. SÓ APRESENTAÇÃO: a
// simulação (map.js) continua sendo a única dona de tipo, posição, coleta e efeito; aqui só se desenha o item que ela já criou.
import * as T from 'three';
import * as Quarks from 'three.quarks';
import {C} from '../sim/config.js';
import {drawSymbol} from './symbols.js';
import {pruneEmptyBatches} from './quarks/batch-prune.js';
import {visualRandomSeeded} from './visual-random.js';

const TAU = Math.PI * 2, Y = new T.Vector3(0, 1, 0);
/** Tipos de consumível da simulação → identidade visual aprovada (cor, símbolo e geometria próprios, R5.12). */
export const GEM_TYPES = {
  heal_hp: {id: 'hp', color: '#ff3d71', nome: 'Cura de HP'},
  heal_stamina: {id: 'stamRec', color: '#ffd23f', nome: 'Recuperação de Stamina'},
  buff_attack: {id: 'attack', color: '#ff8a1f', nome: 'Evolução de Ataque'},
  buff_defense: {id: 'defense', color: '#3f8cff', nome: 'Evolução de Defesa'},
  buff_stamina_max: {id: 'stamina', color: '#2fe0a0', nome: 'Evolução de Stamina máxima'},
  buff_cooldown: {id: 'cooldown', color: '#b36bff', nome: 'Redução de Cooldown'},
  buff_speed: {id: 'speed', color: '#27d3ff', nome: 'Evolução de Velocidade'},
};
const lighten = (hex, k) => new T.Color(hex).lerp(new T.Color('#ffffff'), k);

// ---------- geometrias ----------
function polyShape(pts) {const s = new T.Shape();pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));s.closePath();return s;}
function extrude(shape, opt = {}) {
  const g = new T.ExtrudeGeometry(shape, {depth: .24, bevelEnabled: true, bevelThickness: .05, bevelSize: .04, bevelSegments: 1, curveSegments: 16, ...opt});
  g.center();return g;
}
const PLUS = [[-.15, .46], [.15, .46], [.15, .15], [.46, .15], [.46, -.15], [.15, -.15], [.15, -.46], [-.15, -.46], [-.15, -.15], [-.46, -.15], [-.46, .15], [-.15, .15]];
const BOLT = [[.12, .52], [-.3, -.06], [-.04, -.06], [-.14, -.52], [.3, .1], [.04, .1]];
const CHEVRON = [[-.3, .42], [-.06, .42], [.26, 0], [-.06, -.42], [-.3, -.42], [.02, 0]];
function shieldShape() {
  const s = new T.Shape();
  s.moveTo(0, .52);s.lineTo(.4, .36);s.lineTo(.4, .02);s.bezierCurveTo(.4, -.3, .2, -.46, 0, -.58);s.bezierCurveTo(-.2, -.46, -.4, -.3, -.4, .02);s.lineTo(-.4, .36);s.closePath();
  return s;
}
const gem = c => new T.MeshStandardMaterial({color: c, flatShading: true, roughness: .2, metalness: .15, emissive: c, emissiveIntensity: .4});
function add(parent, geo, mat, {pos, rot, scale} = {}) {
  const m = new T.Mesh(geo, mat);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) m.scale.setScalar(scale);
  parent.add(m);return m;
}
function edges(parent, geo, color, opacity = .55, scale = 1) {
  const l = new T.LineSegments(new T.EdgesGeometry(geo, 24), new T.LineBasicMaterial({color, transparent: true, opacity}));
  l.scale.setScalar(scale);parent.add(l);return l;
}

/** Os sete modelos (A · Gemas Facetadas): cada um devolve o grupo e os materiais cujo brilho pulsa. */
const BUILD = {
  hp(c) {const g = new T.Group(), m = gem(c), geo = extrude(polyShape(PLUS), {depth: .26, bevelThickness: .07, bevelSize: .05});add(g, geo, m);edges(g, geo, lighten(c, .7));return {g, mats: [m]};},
  stamRec(c) {const g = new T.Group(), m = gem(c), geo = extrude(polyShape(BOLT), {depth: .22, bevelThickness: .06, bevelSize: .04});add(g, geo, m, {scale: 1.08});edges(g, geo, lighten(c, .7), .6, 1.08);return {g, mats: [m]};},
  attack(c) {
    const g = new T.Group(), m = gem(c), ico = new T.IcosahedronGeometry(.27, 0);
    add(g, ico, m);
    const p = ico.attributes.position, seen = new Set();
    for (let i = 0; i < p.count; i++) {
      const k = [p.getX(i), p.getY(i), p.getZ(i)].map(v => v.toFixed(3)).join();if (seen.has(k)) continue;seen.add(k);
      const d = new T.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      add(g, new T.ConeGeometry(.1, .36, 4), m, {pos: d.clone().multiplyScalar(.42).toArray()}).quaternion.setFromUnitVectors(Y, d);
    }
    return {g, mats: [m]};
  },
  defense(c) {
    const g = new T.Group(), m = gem(c), geo = extrude(shieldShape(), {depth: .24, bevelThickness: .07, bevelSize: .05});add(g, geo, m);edges(g, geo, lighten(c, .7));
    const im = gem(lighten(c, .55));im.emissiveIntensity = .7;add(g, extrude(shieldShape(), {depth: .06, bevelEnabled: false}), im, {pos: [0, .02, .17], scale: .62});
    return {g, mats: [m, im]};
  },
  stamina(c) {
    const g = new T.Group(), m = gem(c), body = new T.CylinderGeometry(.24, .24, .5, 6);add(g, body, m);edges(g, body, lighten(c, .7));
    add(g, new T.ConeGeometry(.24, .26, 6), m, {pos: [0, .38, 0]});add(g, new T.ConeGeometry(.24, .26, 6), m, {pos: [0, -.38, 0], rot: [Math.PI, 0, 0]});
    const core = gem(lighten(c, .6));core.emissiveIntensity = .9;add(g, new T.OctahedronGeometry(.1, 0), core);
    return {g, mats: [m, core]};
  },
  cooldown(c) {
    const g = new T.Group(), m = gem(c);
    const pts = [[0, -.52], [.32, -.52], [.32, -.45], [.06, -.03], [.06, .03], [.32, .45], [.32, .52], [0, .52]].map(([x, y]) => new T.Vector2(x, y)), lathe = new T.LatheGeometry(pts, 6);
    add(g, lathe, m);edges(g, lathe, lighten(c, .7));
    const sand = gem(lighten(c, .6));sand.emissiveIntensity = .9;add(g, new T.OctahedronGeometry(.1, 0), sand, {pos: [0, -.3, 0]});
    return {g, mats: [m, sand]};
  },
  speed(c) {
    const g = new T.Group(), m = gem(c), geo = extrude(polyShape(CHEVRON), {depth: .2, bevelThickness: .05, bevelSize: .035});
    for (const x of [-.2, .17]) {add(g, geo, m, {pos: [x, 0, 0]});const e = edges(g, geo, lighten(c, .7));e.position.x = x;}
    return {g, mats: [m]};
  },
};

// ---------- indicador flutuante (losango de vidro) ----------
const TEX = new Map();
function indicatorTexture(type) {
  if (TEX.has(type.id)) return TEX.get(type.id);
  const cv = document.createElement('canvas');cv.width = 192;cv.height = 256;
  const x = cv.getContext('2d'), c = type.color, cx = 96, cy = 92;
  x.lineJoin = x.lineCap = 'round';
  x.strokeStyle = c;x.lineWidth = 3;x.globalAlpha = .75;x.beginPath();x.moveTo(cx, 168);x.lineTo(cx, 252);x.stroke();x.globalAlpha = 1;
  x.fillStyle = c;x.beginPath();x.arc(cx, 250, 5, 0, TAU);x.fill();
  x.save();x.translate(cx, cy);x.rotate(Math.PI / 4);x.shadowColor = c;x.shadowBlur = 22;
  x.fillStyle = 'rgba(9,14,30,.9)';x.fillRect(-58, -58, 116, 116);
  x.shadowBlur = 0;x.strokeStyle = c;x.lineWidth = 9;x.strokeRect(-58, -58, 116, 116);
  x.strokeStyle = 'rgba(255,255,255,.55)';x.lineWidth = 2.5;x.strokeRect(-47, -47, 94, 94);x.restore();
  drawSymbol(x, type.id, cx, cy, 62, '#ffffff', 2.8);
  const tex = new T.CanvasTexture(cv);tex.colorSpace = T.SRGBColorSpace;tex.anisotropy = 4;
  TEX.set(type.id, tex);return tex;
}

/** Um consumível desenhado: raiz na superfície (x, y do chão, z) + pedestal + gema flutuante + indicador. */
export class GemConsumable {
  constructor(simType) {
    this.type = GEM_TYPES[simType] ?? GEM_TYPES.buff_speed;
    this.simType = simType;
    const c = this.type.color, built = BUILD[this.type.id](c);
    this.mats = built.mats;
    this.root = new T.Group();
    this.holder = new T.Group();            // pedestal + gema (recebe gemScale)
    this.spin = new T.Group();this.spin.add(built.g);built.g.scale.setScalar(1.22);
    this.outer = new T.Group();this.outer.add(this.spin);
    const col = new T.Color(c), flat = (geo, o, y) => {
      const m = new T.Mesh(geo, new T.MeshBasicMaterial({color: col, transparent: true, opacity: o, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide}));
      m.rotation.x = -Math.PI / 2;m.position.y = y;return m;
    };
    this.ped = new T.Group();
    this.ped.add(flat(new T.CircleGeometry(.62, 6), .16, .02), flat(new T.RingGeometry(.58, .66, 6), .95, .03));
    this.innerRing = flat(new T.RingGeometry(.36, .4, 6), .7, .035);this.ped.add(this.innerRing);
    this.holder.add(this.ped, this.outer);
    this.sprite = new T.Sprite(new T.SpriteMaterial({map: indicatorTexture(this.type), transparent: true, depthTest: false, depthWrite: false, fog: false}));
    this.sprite.center.set(.5, 0);this.sprite.renderOrder = 20;
    this.root.add(this.holder, this.sprite);
    this.phase = Math.random() * 6;
    this.root.userData.gem = this;
  }

  /** Atualiza movimento, escala e indicador conforme display.consumables (tudo só visual). */
  update(time, camera) {
    const K = C.display.consumables, t = (K.gemAnimate ? time : 0) + (visualRandomSeeded() ? 0 : this.phase),   // captura determinística: fase fixa (visual-random.js)
      sc = Math.max(.1, K.gemScale ?? 1), hover = K.gemHover ?? .9;
    this.holder.scale.setScalar(sc);
    this.ped.visible = !!K.gemPedestal;
    this.spin.rotation.y = t * .9;
    this.outer.position.y = hover + (K.gemAnimate ? Math.sin(t * 1.6) * .07 : 0);
    const k = .4 + (K.gemAnimate ? .22 * Math.sin(t * 2.4) : 0);
    for (const m of this.mats) m.emissiveIntensity = k;
    this.innerRing.rotation.z = t * .6;
    const sp = this.sprite;
    sp.visible = !!K.gemIndicators;
    if (sp.visible && camera) {
      const wp = new T.Vector3();this.root.getWorldPosition(wp);
      const f = Math.min(2.6, Math.max(1, camera.position.distanceTo(wp) / 9)) * (K.gemIndicatorSize ?? 1);
      sp.scale.set(.75 * f * .62, 1.0 * f * .62, 1);
      sp.position.y = (hover + .72) * sc + (K.gemAnimate ? Math.sin(t * 2.0) * .06 : 0) + (f - 1) * .12;
    }
  }
}

// ---------- centelhas three.quarks (uma por gema; ligadas por gemParticles) ----------
let SOFT = null;
function softMaterial() {
  if (SOFT) return SOFT;
  const c = document.createElement('canvas');c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');g.addColorStop(.4, 'rgba(255,255,255,.7)');g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;x.fillRect(0, 0, 64, 64);
  SOFT = new T.MeshBasicMaterial({map: new T.CanvasTexture(c), transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide});
  return SOFT;
}
const iv = (a, b) => new Quarks.IntervalValue(a, b), cv = v => new Quarks.ConstantValue(v);
const v3 = h => {const c = new T.Color(h);return new T.Vector3(c.r, c.g, c.b);};
const v4 = h => {const c = new T.Color(h);return new T.Vector4(c.r, c.g, c.b, 1);};

export class GemSparkles {
  constructor(parent) {
    this.renderer = new Quarks.BatchedRenderer();
    parent.add(this.renderer);
    this.parent = parent;
    this.live = new Map();   // GemConsumable → {system, emitter}
    this.enabled = true;
  }
  _make(color) {
    const white = new T.Color(color).lerp(new T.Color('#ffffff'), .55);
    const system = new Quarks.ParticleSystem({
      duration: 1, looping: true, worldSpace: true, startLife: iv(1.4, 2.2), startSpeed: iv(.12, .3), startSize: iv(.07, .14),
      startColor: new Quarks.ColorRange(v4(color), v4(white)),
      shape: new Quarks.ConeEmitter({radius: .38, angle: .35, direction: new T.Vector3(0, 1, 0)}), material: softMaterial(),
      emissionOverTime: cv(9), emissionBursts: [],
      behaviors: [
        new Quarks.ColorOverLife(new Quarks.Gradient([[v3(color), 0], [v3(color), 1]], [[0, 0], [1, .15], [.7, .6], [0, 1]])),
        new Quarks.SizeOverLife(new Quarks.PiecewiseBezier([[new Quarks.Bezier(1, .9, .5, .1), 1]])),
        new Quarks.ApplyForce(new T.Vector3(0, 1, 0), cv(.1)),
      ],
      renderMode: Quarks.RenderMode.BillBoard,
    });
    return system;
  }
  attach(gemItem) {
    if (this.live.has(gemItem)) return;
    const system = this._make(gemItem.type.color), emitter = system.emitter; // o sistema já cria o próprio emissor (Object3D)
    gemItem.root.add(emitter);
    this.renderer.addSystem(system);
    this.live.set(gemItem, {system, emitter});
  }
  detach(gemItem) {
    const e = this.live.get(gemItem);if (!e) return;
    this.live.delete(gemItem);
    try {this.renderer.deleteSystem(e.system);} catch {/* já removido */}
    e.emitter.parent?.remove(e.emitter);e.system.dispose?.();
    pruneEmptyBatches(this.renderer);   // F5: three.quarks 0.17 deixa o lote vazio depois de deleteSystem (batch-prune.js)
  }
  /** Liga/desliga conforme gemParticles e anda os sistemas. dt = 0 congela (pausa). */
  update(dt, wanted, items) {
    this.enabled = wanted;
    if (!wanted) {for (const g of [...this.live.keys()]) this.detach(g);return;}
    for (const g of items) this.attach(g);
    for (const g of [...this.live.keys()]) if (!items.has(g)) this.detach(g);
    if (dt > 0) this.renderer.update(dt);
  }
  dispose() {for (const g of [...this.live.keys()]) this.detach(g);this.parent.remove(this.renderer);}
}
