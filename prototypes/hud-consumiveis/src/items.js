// 3 coleções × 7 consumíveis = 21 modelos 3D reais + 3 linguagens de indicador flutuante (R8.12).
// Coleção A "Gemas Facetadas" (angular, flat shading, brilho interno) · B "Vinil Cartoon" (toon + contorno,
// formas gordinhas, saltitar elástico) · C "Módulos Tech" (metal PBR + faixas luminosas + peças giratórias).
// Cada tipo tem cor, geometria e símbolo próprios dentro de cada coleção (R5.12). Tudo é visual de demonstração.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {ITEM_TYPES, drawSymbol} from './data.js';

const {Group, Mesh, Shape, Vector3} = THREE;
const TAU = Math.PI * 2;
const Y = new Vector3(0, 1, 0);

// ---------- utilidades de geometria / material ----------
const lighten = (hex, k) => new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), k);
const darken = (hex, k) => new THREE.Color(hex).lerp(new THREE.Color('#05070d'), k);

function polyShape(pts) {
  const s = new Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}
function extrude(shape, opt = {}) {
  const g = new THREE.ExtrudeGeometry(shape, {depth: .24, bevelEnabled: true, bevelThickness: .05, bevelSize: .04, bevelSegments: 1, curveSegments: 16, ...opt});
  g.center();
  return g;
}
const PLUS = [[-.15, .46], [.15, .46], [.15, .15], [.46, .15], [.46, -.15], [.15, -.15], [.15, -.46], [-.15, -.46], [-.15, -.15], [-.46, -.15], [-.46, .15], [-.15, .15]];
const BOLT = [[.12, .52], [-.3, -.06], [-.04, -.06], [-.14, -.52], [.3, .1], [.04, .1]];
const CHEVRON = [[-.3, .42], [-.06, .42], [.26, 0], [-.06, -.42], [-.3, -.42], [.02, 0]];
function shieldShape() {
  const s = new Shape();
  s.moveTo(0, .52); s.lineTo(.4, .36); s.lineTo(.4, .02);
  s.bezierCurveTo(.4, -.3, .2, -.46, 0, -.58);
  s.bezierCurveTo(-.2, -.46, -.4, -.3, -.4, .02);
  s.lineTo(-.4, .36); s.closePath();
  return s;
}
function heartShape() {
  const s = new Shape();
  s.moveTo(0, -.5);
  s.bezierCurveTo(-.15, -.35, -.55, -.1, -.55, .15);
  s.bezierCurveTo(-.55, .42, -.2, .5, 0, .28);
  s.bezierCurveTo(.2, .5, .55, .42, .55, .15);
  s.bezierCurveTo(.55, -.1, .15, -.35, 0, -.5);
  return s;
}
function starShape(points = 5, ro = .52, ri = .27) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const a = Math.PI / 2 + i * Math.PI / points, r = i % 2 ? ri : ro;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return polyShape(pts);
}

const toonGradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
})();
const OUTLINE_MAT = new THREE.MeshBasicMaterial({color: 0x0b0e1a, side: THREE.BackSide});

const mats = {
  gem: c => new THREE.MeshStandardMaterial({color: c, flatShading: true, roughness: .2, metalness: .15, emissive: c, emissiveIntensity: .4}),
  toon: c => new THREE.MeshToonMaterial({color: c, gradientMap: toonGradient}),
  metal: (c, r = .34, m = .85) => new THREE.MeshStandardMaterial({color: c, metalness: m, roughness: r}),
  glow: c => new THREE.MeshStandardMaterial({color: darken(c, .6), emissive: c, emissiveIntensity: 1.8, roughness: .5}),
};

function add(parent, geo, mat, {pos, rot, scale, cast = true} = {}) {
  const m = new Mesh(geo, mat);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) typeof scale === 'number' ? m.scale.setScalar(scale) : m.scale.set(...scale);
  m.castShadow = cast;
  parent.add(m);
  return m;
}
function edges(parent, geo, color, opacity = .5, opts = {}) {
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 24), new THREE.LineBasicMaterial({color, transparent: true, opacity}));
  if (opts.pos) l.position.set(...opts.pos);
  if (opts.rot) l.rotation.set(...opts.rot);
  if (opts.scale) l.scale.set(...(typeof opts.scale === 'number' ? [opts.scale, opts.scale, opts.scale] : opts.scale));
  parent.add(l);
  return l;
}
/** Peça toon com contorno de casco invertido (espessura em metros). */
function toon(parent, geo, color, {pos, rot, scale, line = .035} = {}) {
  const wrap = new Group();
  if (pos) wrap.position.set(...pos);
  if (rot) wrap.rotation.set(...rot);
  if (scale) typeof scale === 'number' ? wrap.scale.setScalar(scale) : wrap.scale.set(...scale);
  geo.computeBoundingSphere();
  const r = Math.max(.08, geo.boundingSphere.radius);
  const body = new Mesh(geo, mats.toon(color)); body.castShadow = true; wrap.add(body);
  if (line > 0) { const o = new Mesh(geo, OUTLINE_MAT); o.scale.setScalar(1 + line / r); wrap.add(o); }
  parent.add(wrap);
  return wrap;
}

// ============================================================================
// COLEÇÃO A · GEMAS FACETADAS
// ============================================================================
const A = {
  hp(c) {
    const g = new Group(), mat = mats.gem(c), geo = extrude(polyShape(PLUS), {depth: .26, bevelThickness: .07, bevelSize: .05});
    add(g, geo, mat); edges(g, geo, lighten(c, .7), .6);
    return {g, mats: [mat]};
  },
  stamRec(c) {
    const g = new Group(), mat = mats.gem(c), geo = extrude(polyShape(BOLT), {depth: .22, bevelThickness: .06, bevelSize: .04});
    add(g, geo, mat, {scale: 1.08}); edges(g, geo, lighten(c, .7), .6, {scale: 1.08});
    return {g, mats: [mat]};
  },
  attack(c) {
    const g = new Group(), mat = mats.gem(c);
    const ico = new THREE.IcosahedronGeometry(.27, 0);
    add(g, ico, mat);
    const p = ico.attributes.position, seen = new Set();
    for (let i = 0; i < p.count; i++) {
      const k = [p.getX(i), p.getY(i), p.getZ(i)].map(v => v.toFixed(3)).join();
      if (seen.has(k)) continue;
      seen.add(k);
      const d = new Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      const cone = add(g, new THREE.ConeGeometry(.1, .36, 4), mat, {pos: d.clone().multiplyScalar(.42).toArray()});
      cone.quaternion.setFromUnitVectors(Y, d);
    }
    return {g, mats: [mat]};
  },
  defense(c) {
    const g = new Group(), mat = mats.gem(c), geo = extrude(shieldShape(), {depth: .24, bevelThickness: .07, bevelSize: .05});
    add(g, geo, mat); edges(g, geo, lighten(c, .7), .6);
    const inner = extrude(shieldShape(), {depth: .06, bevelEnabled: false});
    const im = mats.gem(lighten(c, .55)); im.emissiveIntensity = .7;
    add(g, inner, im, {pos: [0, .02, .17], scale: .62, cast: false});
    return {g, mats: [mat, im]};
  },
  stamina(c) {
    const g = new Group(), mat = mats.gem(c);
    const body = new THREE.CylinderGeometry(.24, .24, .5, 6);
    add(g, body, mat); edges(g, body, lighten(c, .7), .6);
    add(g, new THREE.ConeGeometry(.24, .26, 6), mat, {pos: [0, .38, 0]});
    add(g, new THREE.ConeGeometry(.24, .26, 6), mat, {pos: [0, -.38, 0], rot: [Math.PI, 0, 0]});
    const core = mats.gem(lighten(c, .6)); core.emissiveIntensity = .9;
    add(g, new THREE.OctahedronGeometry(.1, 0), core, {cast: false});
    return {g, mats: [mat, core]};
  },
  cooldown(c) {
    const g = new Group(), mat = mats.gem(c);
    const pts = [[0, -.52], [.32, -.52], [.32, -.45], [.06, -.03], [.06, .03], [.32, .45], [.32, .52], [0, .52]].map(([x, y]) => new THREE.Vector2(x, y));
    const lathe = new THREE.LatheGeometry(pts, 6);
    add(g, lathe, mat); edges(g, lathe, lighten(c, .7), .55);
    const sand = mats.gem(lighten(c, .6)); sand.emissiveIntensity = .9;
    add(g, new THREE.OctahedronGeometry(.1, 0), sand, {pos: [0, -.3, 0], cast: false});
    return {g, mats: [mat, sand]};
  },
  speed(c) {
    const g = new Group(), mat = mats.gem(c), geo = extrude(polyShape(CHEVRON), {depth: .2, bevelThickness: .05, bevelSize: .035});
    add(g, geo, mat, {pos: [-.2, 0, 0]}); edges(g, geo, lighten(c, .7), .6, {pos: [-.2, 0, 0]});
    add(g, geo, mat, {pos: [.17, 0, 0]}); edges(g, geo, lighten(c, .7), .6, {pos: [.17, 0, 0]});
    return {g, mats: [mat]};
  },
};

// ============================================================================
// COLEÇÃO B · VINIL CARTOON (toon + contorno)
// ============================================================================
const B = {
  hp(c) {
    const g = new Group();
    const geo = extrude(heartShape(), {depth: .2, bevelThickness: .13, bevelSize: .1, bevelSegments: 6, curveSegments: 26});
    toon(g, geo, c, {scale: .86});
    toon(g, new THREE.SphereGeometry(.09, 12, 10), '#ffffff', {pos: [-.28, .22, .3], scale: [1, 1.5, .6], line: 0});
    return {g};
  },
  stamRec(c) {
    const g = new Group(), can = new Group();
    can.rotation.z = -.22; g.add(can);
    toon(can, new THREE.CylinderGeometry(.23, .23, .6, 28), c);
    toon(can, new THREE.CylinderGeometry(.236, .236, .24, 28), '#1b2142', {line: 0});
    toon(can, new THREE.TorusGeometry(.225, .035, 10, 28), '#fff6d0', {pos: [0, .3, 0], rot: [Math.PI / 2, 0, 0]});
    toon(can, new THREE.TorusGeometry(.225, .035, 10, 28), '#fff6d0', {pos: [0, -.3, 0], rot: [Math.PI / 2, 0, 0]});
    const bolt = extrude(polyShape(BOLT), {depth: .02, bevelThickness: .015, bevelSize: .01, bevelSegments: 2});
    for (const s of [1, -1]) toon(can, bolt.clone(), c, {pos: [0, 0, s * .245], rot: [0, s > 0 ? 0 : Math.PI, 0], scale: .34, line: 0});
    toon(can, new THREE.CylinderGeometry(.07, .07, .05, 12), '#fff6d0', {pos: [0, .35, 0], line: .02});
    return {g};
  },
  attack(c) {
    const g = new Group();
    const geo = extrude(starShape(5, .56, .29), {depth: .2, bevelThickness: .14, bevelSize: .09, bevelSegments: 6});
    toon(g, geo, c);
    toon(g, new THREE.SphereGeometry(.08, 12, 10), '#ffffff', {pos: [-.12, .2, .34], scale: [1.3, 1, .5], line: 0});
    return {g};
  },
  defense(c) {
    const g = new Group();
    toon(g, new THREE.CylinderGeometry(.43, .43, .14, 36), c, {rot: [Math.PI / 2, 0, 0]});
    toon(g, new THREE.TorusGeometry(.43, .07, 14, 36), lighten(c, .55), {pos: [0, 0, 0]});
    toon(g, new THREE.TorusGeometry(.27, .04, 10, 32), '#ffffff', {pos: [0, 0, .08], line: 0});
    toon(g, new THREE.SphereGeometry(.15, 20, 14), '#ffffff', {pos: [0, 0, .08], scale: [1, 1, .85]});
    return {g};
  },
  stamina(c) {
    const g = new Group();
    const pts = [[0, -.42], [.2, -.4], [.33, -.26], [.36, -.06], [.28, .12], [.13, .21], [.12, .36], [.17, .38], [.17, .46], [0, .46]].map(([x, y]) => new THREE.Vector2(x, y));
    toon(g, new THREE.LatheGeometry(pts, 26), c);
    toon(g, new THREE.CylinderGeometry(.115, .1, .12, 14), '#b9824a', {pos: [0, .52, 0], line: .025});
    toon(g, new THREE.SphereGeometry(.07, 10, 8), '#ffffff', {pos: [-.17, -.1, .27], scale: [.8, 1.7, .5], line: 0});
    toon(g, new THREE.SphereGeometry(.05, 10, 8), '#ffffff', {pos: [.12, .06, .3], line: 0});
    return {g, tilt: .18};
  },
  cooldown(c) {
    const g = new Group(), clock = new Group();
    g.add(clock);
    toon(clock, new THREE.CylinderGeometry(.34, .34, .22, 34), c, {rot: [Math.PI / 2, 0, 0]});
    toon(clock, new THREE.CylinderGeometry(.27, .27, .05, 34), '#fffaf0', {pos: [0, 0, .12], rot: [Math.PI / 2, 0, 0], line: 0});
    for (const s of [-1, 1]) toon(clock, new THREE.SphereGeometry(.14, 16, 10, 0, TAU, 0, Math.PI / 2), lighten(c, .45), {pos: [s * .25, .3, 0], rot: [0, 0, -s * .62]});
    for (const s of [-1, 1]) toon(clock, new THREE.SphereGeometry(.07, 10, 8), lighten(c, .2), {pos: [s * .2, -.33, 0]});
    const hour = new Group(), minute = new Group();
    hour.position.z = .16; minute.position.z = .175;
    clock.add(hour, minute);
    add(hour, new THREE.BoxGeometry(.045, .15, .03), mats.toon('#1d2340'), {pos: [0, .07, 0], cast: false});
    add(minute, new THREE.BoxGeometry(.035, .22, .03), mats.toon('#1d2340'), {pos: [0, .1, 0], cast: false});
    add(clock, new THREE.SphereGeometry(.035, 8, 6), mats.toon('#1d2340'), {pos: [0, 0, .17], cast: false});
    return {g, clock, hour, minute};
  },
  speed(c) {
    const g = new Group(), rocket = new Group();
    rocket.rotation.z = -.42; g.add(rocket);
    toon(rocket, new THREE.CapsuleGeometry(.18, .36, 6, 18), c);
    toon(rocket, new THREE.ConeGeometry(.18, .32, 24), '#ffffff', {pos: [0, .43, 0]});
    toon(rocket, new THREE.SphereGeometry(.085, 14, 10), '#1d2340', {pos: [0, .08, .16], line: .02});
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3;
      toon(rocket, new THREE.ConeGeometry(.1, .3, 3), lighten(c, .5), {pos: [Math.sin(a) * .2, -.28, Math.cos(a) * .2], rot: [Math.cos(a) * .35, 0, -Math.sin(a) * .35], scale: [1, 1, .4], line: .02});
    }
    const flame = toon(rocket, new THREE.ConeGeometry(.1, .34, 16), '#ffb02e', {pos: [0, -.62, 0], rot: [Math.PI, 0, 0], line: .02});
    return {g, flame};
  },
};

// ============================================================================
// COLEÇÃO C · MÓDULOS TECH (metal PBR + faixas emissivas)
// ============================================================================
const STEEL = '#465270', PLATE = '#c4ccdc', WHITE = '#f0f3fa';
const C = {
  hp(c) {
    const g = new Group(), glow = mats.glow(c);
    add(g, new THREE.CapsuleGeometry(.2, .34, 8, 28), mats.metal(WHITE, .38, .3));
    for (const y of [.22, -.22]) add(g, new THREE.TorusGeometry(.205, .028, 10, 32), mats.metal(STEEL), {pos: [0, y, 0], rot: [Math.PI / 2, 0, 0]});
    for (const s of [1, -1]) {
      add(g, new THREE.BoxGeometry(.19, .065, .035), glow, {pos: [0, 0, s * .2], cast: false});
      add(g, new THREE.BoxGeometry(.065, .19, .035), glow, {pos: [0, 0, s * .2], cast: false});
    }
    add(g, new THREE.CylinderGeometry(.1, .13, .08, 20), mats.metal(STEEL), {pos: [0, .44, 0]});
    add(g, new THREE.CylinderGeometry(.13, .1, .08, 20), mats.metal(STEEL), {pos: [0, -.44, 0]});
    return {g, glows: [glow]};
  },
  stamRec(c) {
    const g = new Group(), cell = new Group(), glow = mats.glow(c), bands = [];
    cell.rotation.z = -.25; g.add(cell);
    add(cell, new THREE.CylinderGeometry(.22, .22, .66, 28), mats.metal(STEEL, .4, .8));
    add(cell, new THREE.CylinderGeometry(.09, .09, .1, 16), mats.metal(PLATE, .25), {pos: [0, .38, 0]});
    add(cell, new THREE.CylinderGeometry(.24, .24, .05, 28), mats.metal(PLATE, .3), {pos: [0, -.33, 0]});
    [-.15, 0, .15].forEach(y => { const m = mats.glow(c); bands.push(m); add(cell, new THREE.TorusGeometry(.224, .032, 10, 32), m, {pos: [0, y, 0], rot: [Math.PI / 2, 0, 0], cast: false}); });
    return {g, glows: [glow, ...bands], bands};
  },
  attack(c) {
    const g = new Group(), blade = new Group(), glow = mats.glow(c);
    g.add(blade); blade.position.y = -.05;
    add(blade, new THREE.ConeGeometry(.14, .74, 4), mats.metal('#c8d0de', .18, .95), {pos: [0, .43, 0], rot: [0, Math.PI / 4, 0], scale: [1, 1, .38]});
    add(blade, new THREE.BoxGeometry(.03, .6, .09), glow, {pos: [0, .38, 0], cast: false});
    add(blade, new THREE.BoxGeometry(.44, .06, .11), mats.metal(STEEL), {pos: [0, .03, 0]});
    add(blade, new THREE.CylinderGeometry(.04, .045, .26, 12), mats.metal('#1a1f2b', .6, .4), {pos: [0, -.13, 0]});
    add(blade, new THREE.SphereGeometry(.07, 14, 10), glow, {pos: [0, -.3, 0], cast: false});
    return {g, glows: [glow]};
  },
  defense(c) {
    const g = new Group(), glow = mats.glow(c), plate = new Group();
    g.add(plate); // cilindro girado: vértices do hexágono em ±Y (ponta para cima)
    const hex = (r, h) => new THREE.CylinderGeometry(r, r, h, 6);
    add(plate, hex(.45, .1), mats.metal(STEEL, .42, .8), {rot: [Math.PI / 2, 0, 0]});
    add(plate, hex(.34, .14), mats.metal(PLATE, .3, .7), {rot: [Math.PI / 2, 0, 0]});
    add(plate, new THREE.RingGeometry(.37, .415, 6), glow, {pos: [0, 0, .056], rot: [0, 0, Math.PI / 6], cast: false});
    add(plate, hex(.14, .18), glow, {rot: [Math.PI / 2, 0, 0], cast: false});
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i * TAU / 6;
      add(plate, new THREE.SphereGeometry(.03, 8, 6), mats.metal(PLATE), {pos: [Math.cos(a) * .405, Math.sin(a) * .405, .055], cast: false});
    }
    return {g, glows: [glow]};
  },
  stamina(c) {
    const g = new Group(), glow = mats.glow(c), tank = new Group(), segs = [];
    tank.rotation.y = Math.PI / 6; g.add(tank);
    add(tank, new THREE.CylinderGeometry(.27, .27, .64, 6), mats.metal(STEEL, .4, .8));
    for (const y of [.36, -.36]) add(tank, new THREE.CylinderGeometry(.31, .31, .08, 6), mats.metal(PLATE, .28));
    tank.children[1].position.y = .36; tank.children[2].position.y = -.36;
    const gauge = new Group(); g.add(gauge);
    [-.21, -.07, .07, .21].forEach(y => { const m = mats.glow(c); segs.push(m); add(gauge, new THREE.BoxGeometry(.11, .1, .035), m, {pos: [0, y, .245], cast: false}); });
    add(g, new THREE.BoxGeometry(.2, .05, .05), glow, {pos: [0, .5, 0], cast: false});
    add(g, new THREE.BoxGeometry(.05, .2, .05), glow, {pos: [0, .5, 0], cast: false});
    return {g, glows: [glow, ...segs], segs};
  },
  cooldown(c) {
    const g = new Group(), glow = mats.glow(c), rings = [];
    [[.44, mats.metal(STEEL, .35, .85)], [.34, glow], [.24, mats.metal(PLATE, .3, .8)]].forEach(([r, m]) => {
      const ring = new Group(); add(ring, new THREE.TorusGeometry(r, .032, 10, 56), m, {cast: true}); g.add(ring); rings.push(ring);
    });
    const pts = [[0, -.14], [.09, -.14], [.09, -.1], [.02, 0], [.09, .1], [.09, .14], [0, .14]].map(([x, y]) => new THREE.Vector2(x, y));
    add(g, new THREE.LatheGeometry(pts, 12), glow, {cast: false});
    return {g, glows: [glow], rings};
  },
  speed(c) {
    const g = new Group(), glow = mats.glow(c), fins = new Group();
    const unit = new Group(); unit.rotation.x = .28; g.add(unit);
    add(unit, new THREE.TorusGeometry(.4, .05, 12, 40), mats.metal(STEEL, .35, .85));
    add(unit, new THREE.TorusGeometry(.31, .014, 8, 40), glow, {cast: false});
    unit.add(fins);
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8;
      add(fins, new THREE.BoxGeometry(.19, .05, .02), mats.metal(PLATE, .3, .8), {pos: [Math.cos(a) * .17, Math.sin(a) * .17, 0], rot: [0, 0, a + .35]});
    }
    add(unit, new THREE.CylinderGeometry(.09, .09, .12, 16), mats.metal(STEEL), {rot: [Math.PI / 2, 0, 0]});
    add(unit, new THREE.ConeGeometry(.085, .24, 16), glow, {pos: [0, 0, .17], rot: [Math.PI / 2, 0, 0], cast: false});
    return {g, glows: [glow], fins};
  },
};
const BUILDERS = {A, B, C};

// ============================================================================
// PEDESTAIS (cada coleção tem o seu) e INDICADORES FLUTUANTES (cada coleção tem o seu)
// ============================================================================
function pedestal(style, color) {
  const g = new Group(), col = new THREE.Color(color);
  const flat = (geo, mat, y = .02, rot = -Math.PI / 2) => { const m = new Mesh(geo, mat); m.rotation.x = rot; m.position.y = y; m.receiveShadow = false; g.add(m); return m; };
  const add3 = o => new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide});
  const out = {g, spin: [], shadow: null, beam: null};
  if (style === 'A') {
    flat(new THREE.CircleGeometry(.62, 6), add3(.16));
    flat(new THREE.RingGeometry(.58, .66, 6), add3(.95), .03);
    const inner = flat(new THREE.RingGeometry(.36, .4, 6), add3(.7), .035);
    out.spin.push([inner, .6]);
  } else if (style === 'B') {
    out.shadow = flat(new THREE.CircleGeometry(.46, 32), new THREE.MeshBasicMaterial({color: 0x000000, transparent: true, opacity: .38, depthWrite: false}), .015);
    flat(new THREE.RingGeometry(.5, .66, 40), new THREE.MeshToonMaterial({color: col, gradientMap: toonGradient}), .03);
    flat(new THREE.RingGeometry(.66, .72, 40), OUTLINE_MAT.clone(), .028).material.side = THREE.DoubleSide;
  } else {
    const pad = new Mesh(new THREE.BoxGeometry(1.15, .07, 1.15), mats.metal(STEEL, .5, .7)); pad.position.y = .035; pad.castShadow = false; pad.receiveShadow = true; g.add(pad);
    const glow = mats.glow(color);
    for (const [x, z, w, d] of [[0, .55, 1.1, .03], [0, -.55, 1.1, .03], [.55, 0, .03, 1.1], [-.55, 0, .03, 1.1]]) {
      const b = new Mesh(new THREE.BoxGeometry(w, .02, d), glow); b.position.set(x, .075, z); g.add(b);
    }
    out.glow = glow;
    const beam = new Mesh(new THREE.CylinderGeometry(.5, .5, 1.9, 28, 1, true), add3(.06)); beam.position.y = .95; g.add(beam);
    out.beam = beam;
  }
  return out;
}

/** Textura do indicador flutuante (192×256): distintivo no topo + haste até o item. */
function indicatorTexture(style, type) {
  const cv = document.createElement('canvas'); cv.width = 192; cv.height = 256;
  const x = cv.getContext('2d'), c = type.color, cx = 96, cy = 92;
  x.lineJoin = x.lineCap = 'round';
  if (style === 'A') { // losango de vidro com brilho
    x.strokeStyle = c; x.lineWidth = 3; x.globalAlpha = .75; x.beginPath(); x.moveTo(cx, 168); x.lineTo(cx, 252); x.stroke(); x.globalAlpha = 1;
    x.fillStyle = c; x.beginPath(); x.arc(cx, 250, 5, 0, TAU); x.fill();
    x.save(); x.translate(cx, cy); x.rotate(Math.PI / 4);
    x.shadowColor = c; x.shadowBlur = 22;
    x.fillStyle = 'rgba(9,14,30,.9)'; x.fillRect(-58, -58, 116, 116);
    x.shadowBlur = 0; x.strokeStyle = c; x.lineWidth = 9; x.strokeRect(-58, -58, 116, 116);
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2.5; x.strokeRect(-47, -47, 94, 94);
    x.restore();
    drawSymbol(x, type.id, cx, cy, 62, '#ffffff', 2.8);
  } else if (style === 'B') { // alfinete de mapa com contorno grosso
    x.fillStyle = '#0b0e1a'; x.strokeStyle = '#0b0e1a'; x.lineWidth = 22;
    const pin = () => { x.beginPath(); x.arc(cx, cy, 60, Math.PI * .78, Math.PI * .22, false); x.lineTo(cx, 250); x.closePath(); };
    pin(); x.stroke(); x.fill();
    x.fillStyle = '#ffffff'; x.strokeStyle = '#ffffff'; x.lineWidth = 12; pin(); x.stroke(); x.fill();
    x.fillStyle = c; x.beginPath(); x.arc(cx, cy, 50, 0, TAU); x.fill();
    drawSymbol(x, type.id, cx, cy, 60, '#0b0e1a', 3.2);
  } else { // quadro holográfico hexagonal com marcas
    x.strokeStyle = c; x.lineWidth = 3; x.setLineDash([6, 7]); x.beginPath(); x.moveTo(cx, 168); x.lineTo(cx, 252); x.stroke(); x.setLineDash([]);
    x.fillStyle = c; x.fillRect(cx - 14, 247, 28, 4);
    const hex = (r) => { x.beginPath(); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * TAU / 6; x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); };
    x.shadowColor = c; x.shadowBlur = 18; x.fillStyle = 'rgba(4,14,26,.88)'; hex(72); x.fill();
    x.shadowBlur = 0; x.strokeStyle = c; x.lineWidth = 6; hex(72); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.4)'; x.lineWidth = 1.6; hex(60); x.stroke();
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * TAU / 6; x.fillStyle = '#fff'; x.fillRect(cx + Math.cos(a) * 72 - 3, cy + Math.sin(a) * 72 - 3, 6, 6); }
    x.globalAlpha = .12; x.fillStyle = '#fff'; for (let yy = 30; yy < 160; yy += 6) x.fillRect(cx - 55, yy, 110, 2); x.globalAlpha = 1;
    drawSymbol(x, type.id, cx, cy, 58, c, 2.9);
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

export const HOVER = {A: 1.05, B: 0.98, C: 1.02};

/** Um consumível no campo: três versões (A/B/C) no mesmo ponto, só a coleção ativa fica visível. */
class Item {
  constructor(type, index) {
    this.type = type; this.index = index;
    this.slot = new Group();
    this.styles = {};
    for (const s of ['A', 'B', 'C']) {
      const built = BUILDERS[s][type.id](type.color);
      const spin = new Group(); spin.add(built.g); built.g.scale.setScalar(1.22);
      const outer = new Group(); outer.add(spin);
      outer.position.y = HOVER[s];
      const ped = pedestal(s, type.color);
      const holder = new Group(); holder.add(ped.g, outer);
      holder.visible = false;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: indicatorTexture(s, type), transparent: true, depthTest: false, depthWrite: false, fog: false}));
      sprite.center.set(.5, 0); sprite.renderOrder = 20;
      sprite.position.y = HOVER[s] + 0.7;
      holder.add(sprite);
      this.slot.add(holder);
      this.styles[s] = {...built, spin, outer, ped, holder, sprite};
    }
    this.slot.userData.item = this;
    this.phase = index * 1.7;
    this.pulse = 0;      // realce de seleção (0..1)
    this.target = new Vector3();
  }
  get names() { return this.type.nome; }
}

export class ItemField {
  constructor(scene) {
    this.scene = scene;
    this.items = ITEM_TYPES.map((t, i) => new Item(t, i));
    this.root = new Group();
    for (const it of this.items) this.root.add(it.slot);
    scene.add(this.root);
    this.style = 'A';
    this.animate = true;
    this.showIndicators = true;
    this.indicatorSize = 1;
    this.selected = null;
    this.clock = 0;
    this.setStyle('A');
  }
  setStyle(id) {
    this.style = id;
    for (const it of this.items) for (const [k, s] of Object.entries(it.styles)) s.holder.visible = k === id;
  }
  setPositions(list, snap = false) {
    this.items.forEach((it, i) => { it.target.set(...list[i]); if (snap) it.slot.position.copy(it.target); });
  }
  /** Retorna os meshes clicáveis (uma caixa invisível por item). */
  pickables() {
    if (!this._pick) {
      this._pick = this.items.map(it => {
        const m = new Mesh(new THREE.SphereGeometry(.8, 10, 8), new THREE.MeshBasicMaterial({visible: false}));
        m.position.y = 1.05; m.userData.item = it; it.slot.add(m); return m;
      });
    }
    return this._pick;
  }
  update(dt, camera) {
    this.clock += this.animate ? dt : 0;
    const t = this.clock;
    for (const it of this.items) {
      it.slot.position.lerp(it.target, 1 - Math.exp(-dt * 6));
      const s = it.styles[this.style], ph = t + it.phase, st = this.style;
      // movimento por coleção
      if (st === 'A') {
        s.spin.rotation.y = ph * .9;
        s.outer.position.y = HOVER.A + Math.sin(ph * 1.6) * .07;
        const k = .4 + .22 * Math.sin(ph * 2.4);
        for (const m of s.mats || []) m.emissiveIntensity = k;
        const innerRing = s.ped.spin[0]; if (innerRing) innerRing[0].rotation.z = ph * innerRing[1];
      } else if (st === 'B') {
        const hop = Math.abs(Math.sin(ph * 2.3)), sq = Math.cos(ph * 2.3 * 2) * .5 + .5; // 0 no ar, 1 no chão
        s.outer.position.y = HOVER.B - .08 + hop * .22;
        const stretch = 1 + (1 - sq) * .06 - sq * .05;
        s.outer.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
        s.spin.rotation.y = ph * .7; s.outer.rotation.z = Math.sin(ph * 2.3) * .07;
        if (s.ped.shadow) { const k = 1 - hop * .28; s.ped.shadow.scale.set(k, k, k); s.ped.shadow.material.opacity = .38 - hop * .14; }
        if (s.hour) { s.hour.rotation.z = -ph * .5; s.minute.rotation.z = -ph * 4; s.clock.rotation.z = Math.sin(ph * 14) * .05 * (1 + Math.sin(ph * 2.3)); }
        if (s.flame) s.flame.scale.set(1, .8 + .35 * Math.sin(ph * 20), 1);
        if (s.tilt) s.spin.rotation.z = s.tilt;
      } else {
        s.spin.rotation.y = ph * .55;
        s.outer.position.y = HOVER.C + Math.sin(ph * 1.3) * .05;
        const k = 1.5 + .7 * Math.sin(ph * 3);
        for (const m of s.glows || []) m.emissiveIntensity = k;
        if (s.bands) s.bands.forEach((m, i) => { m.emissiveIntensity = 0.6 + 2.4 * Math.max(0, Math.sin(ph * 4 - i * 0.9)); });
        if (s.segs) s.segs.forEach((m, i) => { m.emissiveIntensity = 0.5 + 2.4 * Math.max(0, Math.sin(ph * 3.4 - i * 0.8)); });
        if (s.rings) { s.rings[0].rotation.x = ph * 1.1; s.rings[1].rotation.y = ph * 1.5; s.rings[1].rotation.x = 1.0; s.rings[2].rotation.z = ph * 2.1; s.rings[2].rotation.y = ph * .8; }
        if (s.fins) s.fins.rotation.z = ph * 7;
        if (s.ped.beam) s.ped.beam.material.opacity = .05 + .025 * Math.sin(ph * 2);
      }
      // indicador flutuante: tamanho cresce com a distância para continuar legível (R8.12)
      const sp = s.sprite;
      sp.visible = this.showIndicators;
      if (sp.visible && camera) {
        const d = camera.position.distanceTo(it.slot.position);
        const f = THREE.MathUtils.clamp(d / 9, 1, 2.6) * this.indicatorSize;
        const bob = this.animate ? Math.sin(ph * 2.0) * .06 : 0;
        sp.scale.set(.75 * f * .62, 1.0 * f * .62, 1);
        sp.position.y = HOVER[st] + .72 + bob + (f - 1) * .12;
      }
      // realce de seleção
      const want = this.selected === it ? 1 : 0;
      it.pulse += (want - it.pulse) * (1 - Math.exp(-dt * 8));
      s.ped.g.scale.setScalar(1 + it.pulse * (.12 + .05 * Math.sin(this.clock * 6)));
    }
  }
}
