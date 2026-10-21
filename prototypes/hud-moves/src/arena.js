// Arena de contexto: piso circular, anel de blocos e dois lutadores geométricos. Não é a arena do jogo:
// não tem colisão, física nem regras; serve só para avaliar a leitura do HUD sobre uma cena 3D real.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const R = 13;

export const THEMES = {
  escuro: {bg: 0x0a0f1c, fog: 0x0a0f1c, floorA: '#1b2640', floorB: '#0e1528', line: 'rgba(140,175,255,.22)', ring: 'rgba(95,225,255,.5)', wall: [0x25324f, 0x2a3a5c, 0x1f2a44, 0x33324f], hemi: 0.85, sun: 2.3},
  claro: {bg: 0xdfe8f2, fog: 0xdfe8f2, floorA: '#e8eef6', floorB: '#c9d5e4', line: 'rgba(40,70,120,.22)', ring: 'rgba(30,90,170,.55)', wall: [0xb9c6d8, 0xa9b9cf, 0xc6d0de, 0xb2bdd0], hemi: 1.3, sun: 2.0},
  quente: {bg: 0x2a1410, fog: 0x2a1410, floorA: '#58301f', floorB: '#2c140e', line: 'rgba(255,170,90,.22)', ring: 'rgba(255,190,90,.6)', wall: [0x5a2e22, 0x6b3a2a, 0x4a2419, 0x7a4630], hemi: 0.9, sun: 2.4},
};

function floorTexture(th) {
  const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d'), ppm = S / (R * 2);
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, th.floorA); g.addColorStop(1, th.floorB);
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.strokeStyle = th.line; x.lineWidth = 1.5;
  for (let i = -R; i <= R; i++) {
    x.beginPath(); x.moveTo((i + R) * ppm, 0); x.lineTo((i + R) * ppm, S); x.moveTo(0, (i + R) * ppm); x.lineTo(S, (i + R) * ppm); x.stroke();
  }
  x.strokeStyle = th.ring; x.lineWidth = 4;
  for (const r of [3, 7, 12.5]) { x.beginPath(); x.arc(S / 2, S / 2, r * ppm, 0, Math.PI * 2); x.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function fighter(color, accent, kind) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color, roughness: .5, metalness: .08});
  const acc = new THREE.MeshStandardMaterial({color: accent, roughness: .45, metalness: .1});
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.5, .8, 6, 18), mat); body.position.y = 1.0; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.42, 24, 16), mat); head.position.y = 1.95; head.castShadow = true; g.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(.55, .14, .2), new THREE.MeshBasicMaterial({color: 0xffffff})); visor.position.set(0, 1.98, .34); g.add(visor);
  if (kind === 0) { // jogador: orelhas pontudas
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(.15, .5, 10), acc); e.position.set(s * .27, 2.45, 0); e.rotation.z = -s * .25; e.castShadow = true; g.add(e); }
  } else { // adversário: chifre e cauda
    const h = new THREE.Mesh(new THREE.ConeGeometry(.17, .6, 10), acc); h.position.set(0, 2.55, 0); h.castShadow = true; g.add(h);
    const t = new THREE.Mesh(new THREE.ConeGeometry(.2, .9, 10), acc); t.position.set(0, .8, -.75); t.rotation.x = -1.1; t.castShadow = true; g.add(t);
  }
  for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(.4, .22, .6), acc); f.position.set(s * .27, .12, .08); f.castShadow = true; g.add(f); }
  const ring = new THREE.Mesh(new THREE.RingGeometry(.75, .88, 40), new THREE.MeshBasicMaterial({color: accent, transparent: true, opacity: .6, side: THREE.DoubleSide}));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .03; g.add(ring);
  return g;
}

export function buildArena(scene) {
  const lights = {};
  lights.hemi = new THREE.HemisphereLight(0xcfe0ff, 0x1a2036, .85); scene.add(lights.hemi);
  lights.sun = new THREE.DirectionalLight(0xfff3df, 2.3); lights.sun.position.set(7, 14, 9); lights.sun.castShadow = true;
  lights.sun.shadow.mapSize.set(1024, 1024);
  Object.assign(lights.sun.shadow.camera, {left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 45});
  lights.sun.shadow.bias = -.0005; lights.sun.shadow.normalBias = .03;
  scene.add(lights.sun);
  const rim = new THREE.DirectionalLight(0x6aa8ff, .8); rim.position.set(-9, 6, -10); scene.add(rim);

  const floorMat = new THREE.MeshStandardMaterial({roughness: .82, metalness: .06});
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 96), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const outerMat = new THREE.MeshStandardMaterial({roughness: 1});
  const outer = new THREE.Mesh(new THREE.CircleGeometry(80, 40), outerMat); outer.rotation.x = -Math.PI / 2; outer.position.y = -.02; outer.receiveShadow = true; scene.add(outer);

  const wall = new THREE.Group(), blocks = [];
  const wallGeo = new RoundedBoxGeometry(2.2, 1, 1.5, 2, .06);
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2, h = 1.2 + ((i * 37) % 11) / 11 * 2.6;
    const m = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({roughness: .7, metalness: .15}));
    m.scale.y = h; m.position.set(Math.cos(a) * (R + 1.4), h / 2, Math.sin(a) * (R + 1.4)); m.rotation.y = -a + Math.PI / 2;
    m.castShadow = true; m.receiveShadow = true; wall.add(m); blocks.push(m);
  }
  scene.add(wall);

  const player = fighter(0x3b82f6, 0x9fd0ff, 0), enemy = fighter(0xe5484d, 0xffb4a8, 1);
  scene.add(player, enemy);

  function setTheme(name) {
    const th = THEMES[name] ?? THEMES.escuro;
    scene.background = new THREE.Color(th.bg); scene.fog = new THREE.FogExp2(th.fog, name === 'claro' ? .012 : .014);
    floorMat.map?.dispose(); floorMat.map = floorTexture(th); floorMat.needsUpdate = true;
    outerMat.color.set(th.bg).multiplyScalar(name === 'claro' ? .9 : 1.1);
    blocks.forEach((b, i) => b.material.color.set(th.wall[i % th.wall.length]));
    lights.hemi.intensity = th.hemi; lights.sun.intensity = th.sun;
  }
  setTheme('escuro');

  /** Movimento de demonstração: leve oscilação e, opcionalmente, círculo + investidas (só para avaliar o HUD em movimento). */
  function update(t, demo) {
    const k = demo ? 1 : 0;
    const swirl = t * .35 * k, lunge = Math.max(0, Math.sin(t * 1.6)) ** 3 * 1.3 * k;
    const cx = Math.cos(swirl), sz = Math.sin(swirl);
    player.position.set(-2.6 * cx + lunge * cx, Math.abs(Math.sin(t * 2.2)) * .08, -2.6 * sz + lunge * sz);
    enemy.position.set(2.6 * cx - lunge * .4 * cx, Math.abs(Math.sin(t * 2.2 + 1)) * .08, 2.6 * sz - lunge * .4 * sz);
    player.lookAt(enemy.position.x, 0, enemy.position.z); enemy.lookAt(player.position.x, 0, player.position.z);
    player.children[0].scale.y = enemy.children[0].scale.y = 1 + Math.sin(t * 3) * .015;
  }
  return {player, enemy, setTheme, update, radius: R};
}

export const CAMERA_PRESETS = {
  inicial: {pos: [0, 5.2, 11.5], target: [0, 1.2, 0]},
  frente: {pos: [0, 1.7, 9.5], target: [0, 1.4, 0]},
  lado: {pos: [11, 3, 1], target: [0, 1.3, 0]},
  cima: {pos: [0, 19, 3], target: [0, 0, 0]},
  rente: {pos: [4.5, .6, 6.5], target: [0, 1.2, 0]},
  longe: {pos: [0, 9, 26], target: [0, 1, 0]},
};
