// Arena de apresentação: laboratório técnico minimalista (formas geométricas, cores distintas). Não é a arena
// do jogo: sem colisão, gravidade, spawn ou coleta. Serve apenas para avaliar escala, profundidade e leitura.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const R = 16; // raio do piso (m)

function floorTexture() {
  const S = 2048, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d'), ppm = S / (R * 2);
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#182238'); g.addColorStop(1, '#0d1424');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let i = -R; i <= R; i++) {
    x.strokeStyle = i % 4 === 0 ? 'rgba(130,170,255,.30)' : 'rgba(130,170,255,.11)';
    x.lineWidth = i % 4 === 0 ? 2.4 : 1.2;
    x.beginPath(); x.moveTo((i + R) * ppm, 0); x.lineTo((i + R) * ppm, S); x.moveTo(0, (i + R) * ppm); x.lineTo(S, (i + R) * ppm); x.stroke();
  }
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 30px Consolas, monospace';
  for (const r of [4, 8, 12, 16]) {
    x.strokeStyle = 'rgba(95,225,255,.55)'; x.lineWidth = 3.2; x.setLineDash(r === 16 ? [] : [18, 12]);
    x.beginPath(); x.arc(S / 2, S / 2, r * ppm - 1.5, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const px = S / 2 + dx * (r * ppm - 34), py = S / 2 + dy * (r * ppm - 34);
      if (r === 16 && dy !== 0) continue;
      x.fillStyle = 'rgba(140,235,255,.75)'; x.fillText(`${r} m`, px, py);
    }
  }
  // cruz central e marcações de eixo
  x.strokeStyle = 'rgba(255,255,255,.4)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(S / 2 - 22, S / 2); x.lineTo(S / 2 + 22, S / 2); x.moveTo(S / 2, S / 2 - 22); x.lineTo(S / 2, S / 2 + 22); x.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function buildArena(scene) {
  scene.background = new THREE.Color(0x090d19);
  scene.fog = new THREE.FogExp2(0x090d19, 0.0105);

  // luzes
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x1a2036, 0.85));
  const sun = new THREE.DirectionalLight(0xfff3df, 2.4);
  sun.position.set(7, 15, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -19, right: 19, top: 19, bottom: -19, near: 1, far: 50});
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  scene.add(sun);
  const rimA = new THREE.DirectionalLight(0x6aa8ff, 0.9); rimA.position.set(-9, 6, -10); scene.add(rimA);
  const rimB = new THREE.DirectionalLight(0xff9a6a, 0.55); rimB.position.set(10, 4, -8); scene.add(rimB);

  // piso
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 128), new THREE.MeshStandardMaterial({map: floorTexture(), roughness: .82, metalness: .08}));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const outer = new THREE.Mesh(new THREE.CircleGeometry(80, 48), new THREE.MeshStandardMaterial({color: 0x0a0f1c, roughness: 1}));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; outer.receiveShadow = true; scene.add(outer);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, .09, 8, 128), new THREE.MeshStandardMaterial({color: 0x1b2540, emissive: 0x2aa8c8, emissiveIntensity: 1.1}));
  rim.rotation.x = Math.PI / 2; rim.position.y = .09; scene.add(rim);

  // anel de blocos geométricos (cores distintas, sem competir com as cores dos consumíveis)
  const tones = [0x25324f, 0x2a3a5c, 0x1f2a44, 0x33324f, 0x23394a];
  const accents = [0x4aa3ff, 0x7be0d0, 0x9a8cff, 0x6ec1ff];
  const wall = new THREE.Group();
  const n = 30;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, h = 1.1 + ((i * 37) % 11) / 11 * 2.6, w = 2.1 + ((i * 17) % 5) * .22;
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, 1.5, 2, .06), new THREE.MeshStandardMaterial({color: tones[i % tones.length], roughness: .7, metalness: .2}));
    m.position.set(Math.cos(a) * (R + 1.5), h / 2, Math.sin(a) * (R + 1.5));
    m.rotation.y = -a + Math.PI / 2; m.castShadow = true; m.receiveShadow = true; wall.add(m);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w * .8, .07, .05), new THREE.MeshBasicMaterial({color: accents[i % accents.length]}));
    strip.position.set(0, h / 2 - .22, .78); m.add(strip);
  }
  scene.add(wall);
  // pilares e prismas decorativos dentro do piso (profundidade/escala)
  const deco = [
    {g: new THREE.CylinderGeometry(.45, .55, 1.4, 6), p: [-11.5, .7, 5.2], c: 0x2c3d63},
    {g: new THREE.BoxGeometry(1.1, 2.2, 1.1), p: [12.2, 1.1, 4.2], c: 0x3a3a60},
    {g: new THREE.OctahedronGeometry(.8, 0), p: [-12.8, 1.5, -2.4], c: 0x274a58},
    {g: new THREE.CylinderGeometry(.35, .35, 2.6, 16), p: [13.4, 1.3, -3.6], c: 0x2c3d63},
  ];
  for (const d of deco) {
    const m = new THREE.Mesh(d.g, new THREE.MeshStandardMaterial({color: d.c, roughness: .55, metalness: .3, flatShading: true}));
    m.position.set(...d.p); m.castShadow = true; m.receiveShadow = true; scene.add(m);
  }

  // personagem de referência (1,8 m): geométrico e neutro
  const ref = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color: 0x8d97ad, roughness: .6, metalness: .1});
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.3, .75, 6, 16), mat); body.position.y = .95; body.castShadow = true; ref.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.22, 20, 14), mat); head.position.y = 1.62; head.castShadow = true; ref.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(.3, .07, .1), new THREE.MeshBasicMaterial({color: 0x7fe9ff})); visor.position.set(0, 1.64, .19); ref.add(visor);
  const mark = new THREE.Mesh(new THREE.RingGeometry(.5, .58, 32), new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: .35})); mark.rotation.x = -Math.PI / 2; mark.position.y = .02; ref.add(mark);
  scene.add(ref);

  return {character: ref, radius: R};
}

/** Posições (x, y, z) dos 7 consumíveis, na ordem de ITEM_TYPES. */
export const LAYOUTS = {
  arena: [[-5.0, 0, 0.5], [-2.6, 0, -3.4], [3.0, 0, -3.6], [5.4, 0, 0.8], [-8.2, 0, -7.2], [8.4, 0, -7.4], [0.8, 0, 4.0]],
  vitrine: [-3, -2, -1, 0, 1, 2, 3].map(i => [i * 1.9, 0, 4.5]),
};

export const CAMERA_PRESETS = {
  inicial: {pos: [0, 7.6, 14.2], target: [0, 0.4, -1.2]},
  frente: {pos: [0, 2.0, 14], target: [0, 1.2, 0]},
  lado: {pos: [16, 3.2, 1], target: [0, 1.2, 0]},
  cima: {pos: [0, 24, 2.5], target: [0, 0, 0]},
  vitrine: {pos: [0, 2.7, 13.8], target: [0, 0.45, 4.5]},
};
