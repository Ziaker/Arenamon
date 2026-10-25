// @ts-check
// Dividido de world-view.js (comportamento idêntico): wv-geometry.

import * as T from 'three';

export const PL_HEX = [0xffffff, 0x59d6e6, 0xffcf6a, 0xff6adf];
export const RING = {
  reflected: [null, 1.4],
  barrierBroken: [0xff8a5a, 2.5],
  stoneClash: [0xb59cff, 1.1],
  counter: [0xffd24a, 1.3],
  tackleClash: [0xffffff, .95],
  counterStagger: [0xffd24a, 1.5],
  shielded: [0x59d6e6, 1.3],
  neutralized: [0xffffff, 1]
};
export const FIGHTER_EVENTS = new Set(['counterStagger', 'shielded']);
/** Gera geometria 3D facetada procedural para as rochas telecinéticas. */
export function buildRockGeometry(style = 0) {
  let geo;
  if (style === 1) {
    // Estilo 1: Cristal Psíquico (Cone duplo hexagonal facetado / bipirâmide afiada de 12 faces)
    const verts = [];
    const r = 0.88, h = 1.35;
    const equator = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      equator.push(new T.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const apex = new T.Vector3(0, h, 0);
    const nadir = new T.Vector3(0, -h, 0);
    for (let i = 0; i < 6; i++) {
      const next = (i + 1) % 6;
      // Pirâmide superior
      verts.push(apex.x, apex.y, apex.z, equator[i].x, equator[i].y, equator[i].z, equator[next].x, equator[next].y, equator[next].z);
      // Pirâmide inferior
      verts.push(nadir.x, nadir.y, nadir.z, equator[next].x, equator[next].y, equator[next].z, equator[i].x, equator[i].y, equator[i].z);
    }
    geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
  } else if (style === 2) {
    // Estilo 2: Meteorito Runas (Icosaedro com blocos esculpidos)
    geo = new T.IcosahedronGeometry(1, 0);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const k = 0.82 + 0.34 * Math.sin(x * 4.2 + y * 2.8) * Math.cos(z * 3.6);
      pos.setXYZ(i, x * k, y * k, z * k);
    }
  } else {
    // Estilo 0 (Padrão): Boulder Facetado (Dodecaedro deformado com facetas de rocha natural)
    geo = new T.DodecahedronGeometry(1, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const angle = Math.atan2(z, x);
      const perturb = 0.78 + 0.38 * Math.sin(angle * 3 + y * 4.8) + 0.14 * Math.cos(x * 6.5 + z * 3.2);
      pos.setXYZ(i, x * perturb, y * perturb, z * perturb);
    }
  }
  geo.computeVertexNormals();
  return geo;
}
/** Gera grelha hexagonal para a barreira estilo 0 (Hex-Grid Ciclado). */
export function buildHexGridGeometry(cols = 4, rows = 4) {
  const pts = [];
  const dx = 1 / cols, dy = 1 / rows;
  for (let r = 0; r < rows; r++) {
    const y0 = -0.5 + r * dy, y1 = y0 + dy;
    for (let c = 0; c < cols; c++) {
      const x0 = -0.5 + c * dx, x1 = x0 + dx;
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      pts.push(new T.Vector3(x0, my, 0.51), new T.Vector3(mx, y1, 0.51));
      pts.push(new T.Vector3(mx, y1, 0.51), new T.Vector3(x1, my, 0.51));
      pts.push(new T.Vector3(x1, my, 0.51), new T.Vector3(mx, y0, 0.51));
      pts.push(new T.Vector3(mx, y0, 0.51), new T.Vector3(x0, my, 0.51));
      pts.push(new T.Vector3(x0, my, -0.51), new T.Vector3(mx, y1, -0.51));
      pts.push(new T.Vector3(mx, y1, -0.51), new T.Vector3(x1, my, -0.51));
      pts.push(new T.Vector3(x1, my, -0.51), new T.Vector3(mx, y0, -0.51));
      pts.push(new T.Vector3(mx, y0, -0.51), new T.Vector3(x0, my, -0.51));
    }
  }
  return new T.BufferGeometry().setFromPoints(pts);
}
/** Gera placa facetada de cristal para a barreira estilo 1 (Cristal de Quartzo). */
export function buildQuartzGeometry() {
  const verts = [];
  const p = [
    [-0.5, -0.4], [-0.5, 0.4], [-0.4, 0.5], [0.4, 0.5],
    [0.5, 0.4], [0.5, -0.4], [0.4, -0.5], [-0.4, -0.5]
  ];
  const frontZ = 0.45, backZ = -0.45, midZ = 0;
  for (let i = 0; i < 8; i++) {
    const next = (i + 1) % 8;
    verts.push(0, 0, frontZ, p[i][0], p[i][1], midZ, p[next][0], p[next][1], midZ);
    verts.push(0, 0, backZ, p[next][0], p[next][1], midZ, p[i][0], p[i][1], midZ);
    verts.push(p[i][0], p[i][1], midZ, p[next][0], p[next][1], midZ, p[next][0], p[next][1], -0.15);
    verts.push(p[i][0], p[i][1], midZ, p[next][0], p[next][1], -0.15, p[i][0], p[i][1], -0.15);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}
/** Gera escudo curvo de plasma para a barreira estilo 2 (Campo de Força Puro). */
export function buildForceFieldGeometry(segments = 24) {
  const verts = [];
  for (let i = 0; i < segments; i++) {
    const u0 = i / segments, u1 = (i + 1) / segments;
    const x0 = -0.5 + u0, x1 = -0.5 + u1;
    const z0 = Math.sin(u0 * Math.PI) * 0.35 - 0.17;
    const z1 = Math.sin(u1 * Math.PI) * 0.35 - 0.17;
    verts.push(x0, -0.5, z0, x1, -0.5, z1, x1, 0.5, z1);
    verts.push(x0, -0.5, z0, x1, 0.5, z1, x0, 0.5, z0);
    verts.push(x1, -0.5, z1, x0, -0.5, z0, x1, 0.5, z1);
    verts.push(x1, 0.5, z1, x0, -0.5, z0, x0, 0.5, z0);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}
export const OCCLUSION_HEIGHTS = [.25, .8, 1.35];   // pés, meio e cabeça do lutador (m acima do apoio)
