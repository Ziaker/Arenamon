// Cena 3D: arena, blocos (ou personagens), efeitos de impacto e câmera. Porto do v6, mais as sobreposições
// técnicas do laboratório (hitboxes por estado, normais de contato, vetor e arco de lançamento, alcance).
import * as T from 'three';
import {C, rgb} from '../sim/config.js';
import {isInvulnerable, isOffensive, nominalDistance, actionDuration} from '../sim/entity.js';
import {direction} from '../sim/math.js';
import {CameraRig} from './rig.js';

const STATE_COLORS = {invulnerable: 0x58e6ff, tackle: 0xffa040, dodge: 0x61ebba, guard: 0xffe066, guardStun: 0xffb347, recoil: 0xc77dff, airborne: 0x9db4ff, landing: 0x7f93b8, defeated: 0x56616a};
export const OVERLAYS = [
  ['hurtboxes', 'Colisores por estado', 'Caixas reais da física, coloridas pelo estado: ciano invulnerável, laranja tackle, verde esquiva, amarelo defesa, roxo recuo, azul no ar.'],
  ['attackVectors', 'Trajetória de X/C', 'Barra com direção e alcance restante do tackle ou da esquiva.'],
  ['guardArcs', 'Arco de defesa', 'Semicírculo frontal coberto pela defesa (ângulo válido configurável em “Ângulo válido para defesa”).'],
  ['contactNormals', 'Normais de contato', 'Setas no ponto de cada impacto, clash ou bloqueio recentes, na direção da normal usada pela física.'],
  ['launchArcs', 'Arco de lançamento previsto', 'Trajetória balística prevista de quem está no ar, com gravidade, arrasto e rebote nas paredes.'],
  ['reach', 'Alcance de X/C', 'Anel com a distância nominal de tackle/esquiva de cada lutador (2,5 × duração × velocidade).'],
];

export class View {
  constructor(canvas) {
    const X = C.extras;
    this.canvas = canvas;this.scene = new T.Scene();this.camera = new T.PerspectiveCamera(X.cameraExtra.fov, 1, X.cameraExtra.nearClip, X.cameraExtra.farClip);this.rig = new CameraRig();
    this.meshes = [];this.arrows = [];this.shadows = [];this.effects = [];this.seenEvents = new WeakSet();this.airborneSeen = [];this.invulnerableFx = new Map();this.cameraShake = 0;
    this.overlays = Object.fromEntries(OVERLAYS.map(([k]) => [k, false]));this.characters = [];this.debug = [];this.normals = [];
    this.renderer = new T.WebGLRenderer({canvas, antialias: true});this.renderer.setPixelRatio(Math.min(devicePixelRatio, X.visual.renderPixelRatio));
    this.scene.background = new T.Color(rgb('background'));this.ambientLight = new T.HemisphereLight(0xffffff, 0x65707b, X.visual.ambientLightIntensity);this.scene.add(this.ambientLight);
    this.directionalLight = new T.DirectionalLight(0xffffff, X.visual.directionalIntensity);this.directionalLight.position.set(X.visual.lightX, X.visual.lightY, X.visual.lightZ);this.scene.add(this.directionalLight);
    this.floor = new T.Mesh(new T.BoxGeometry(32, X.visual.floorThickness, 32), new T.MeshStandardMaterial({color: rgb('floor'), roughness: 1}));this.floor.position.y = -.06;this.scene.add(this.floor);
    this.grid = new T.GridHelper(32, 32, rgb('gridMajor'), rgb('gridMinor'));this.grid.position.y = .005;this.scene.add(this.grid);this.walls = [];
    for (const [x, z, w, d] of [[-16, 0, .15, 32], [16, 0, .15, 32], [0, -16, 32, .15], [0, 16, 32, .15]]) {
      const wall = new T.Mesh(new T.BoxGeometry(w, X.visual.wallHeight, d), new T.MeshStandardMaterial({color: rgb('wall')}));wall.position.set(x, .175, z);this.scene.add(wall);this.walls.push(wall);
    }
    this.overlayGroup = new T.Group();this.overlayGroup.renderOrder = 900;this.scene.add(this.overlayGroup);
    let dragging = false, previous = 0;
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {if (e.button === 2) {dragging = true;previous = e.clientX;canvas.setPointerCapture(e.pointerId);}});
    canvas.addEventListener('pointermove', e => {if (dragging) {this.rig.orbit(-(e.clientX - previous) * C.extras.cameraExtra.orbitSensitivity);previous = e.clientX;}});
    const end = () => dragging = false;canvas.addEventListener('pointerup', end);canvas.addEventListener('pointercancel', end);window.addEventListener('blur', end);
    canvas.addEventListener('wheel', e => {e.preventDefault();this.rig.zoomBy(e.deltaY * C.extras.cameraExtra.wheelSensitivity);}, {passive: false});
  }
  /** Reaplica tamanho da arena, cores, luzes e câmera depois de mudanças no ajustador. */
  applyConfig() {
    const X = C.extras, V = X.visual, half = C.test.arenaHalf, ratio = half / 16;
    this.floor.scale.set(ratio, V.floorThickness / .1, ratio);this.grid.scale.set(ratio, 1, ratio);
    this.walls.forEach((wall, i) => {wall.position.set(i === 0 ? -half : i === 1 ? half : 0, V.wallHeight / 2, i === 2 ? -half : i === 3 ? half : 0);wall.scale.set(i < 2 ? V.wallThickness / .15 : ratio, V.wallHeight / .35, i < 2 ? ratio : V.wallThickness / .15);});
    this.camera.fov = X.cameraExtra.fov;this.camera.near = X.cameraExtra.nearClip;this.camera.far = X.cameraExtra.farClip;this.camera.updateProjectionMatrix();
    this.scene.background.setHex(rgb('background'));this.floor.material.color.setHex(rgb('floor'));this.walls.forEach(w => w.material.color.setHex(rgb('wall')));
    const gridKey = rgb('gridMajor') + ':' + rgb('gridMinor') + ':' + V.gridDivisions;
    if (this.gridKey !== gridKey) {this.gridKey = gridKey;const fresh = new T.GridHelper(32, V.gridDivisions, rgb('gridMajor'), rgb('gridMinor'));this.grid.geometry.dispose();this.grid.geometry = fresh.geometry;fresh.material.dispose();}
    this.ambientLight.intensity = V.ambientLightIntensity;this.directionalLight.intensity = V.directionalIntensity;this.directionalLight.position.set(V.lightX, V.lightY, V.lightZ);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, V.renderPixelRatio));
  }
  reset(player) {this.rig.reset(player);for (const e of this.effects) {this.scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();}this.effects = [];this.seenEvents = new WeakSet();this.airborneSeen = [];this.invulnerableFx.clear();this.cameraShake = 0;this.normals = [];}
  spawnBurst(pos, type) {
    const F = C.extras.fx;if (!C.extras.hud.fxVisible) return;
    const colors = {perfectDodge: rgb('perfect'), impact: rgb('impact'), clash: rgb('clash'), partial: rgb('partial'), perfect: rgb('perfect'), invulnerable: rgb('invulnerable'), landing: rgb('landing')};
    const color = colors[type] ?? 0xffffff, count = type === 'clash' ? F.clashCount : type === 'landing' ? F.landingCount : F.impactCount;
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count, dx = Math.cos(angle), dz = Math.sin(angle);
      const mesh = new T.Mesh(new T.BoxGeometry(F.particleWidth, F.particleHeight, type === 'clash' ? F.clashParticleLength : F.particleLength), new T.MeshBasicMaterial({color, transparent: true, opacity: F.particleOpacity, depthWrite: false}));
      mesh.rotation.y = angle;mesh.position.set(pos.x, F.particleHeightFromGround, pos.z);this.scene.add(mesh);
      this.effects.push({mesh, age: 0, duration: type === 'clash' ? F.clashDuration : F.impactDuration, dx, dz, x: pos.x, z: pos.z});
    }
  }
  /** Personagem 3D opcional por lutador (characters.js). Quando presente, o bloco fica oculto. */
  setCharacter(id, character) {this.characters[id] = character;}
  draw(fighters, events = [], dt = 1 / 60, {paused = false} = {}) {
    const X = C.extras, V = X.visual, F = X.fx;
    for (const event of events) {
      if (this.seenEvents.has(event)) continue;this.seenEvents.add(event);
      const attacker = fighters[event.attacker], target = fighters[event.target];if (!attacker || !target) continue;
      if (event.normal && (event.result !== 'clash' || event.attacker === 0)) this.normals.push({x: (attacker.position.x + target.position.x) / 2, z: (attacker.position.z + target.position.z) / 2, n: event.normal, result: event.result, age: 0, launch: event.launch});
      if (event.result === 'clash' && event.attacker !== 0) continue;
      if (event.result === 'invulnerable') {const key = `${event.attacker}:${event.target}`, now = performance.now();if (now - (this.invulnerableFx.get(key) ?? -Infinity) < F.invulnRepeatDelay) continue;this.invulnerableFx.set(key, now);}
      if (event.result === 'clash' || event.result === 'impact' || event.result === 'perfect') this.cameraShake = Math.max(this.cameraShake, event.result === 'clash' ? 1 : .45);
      this.spawnBurst(event.result === 'clash' ? {x: (attacker.position.x + target.position.x) / 2, z: (attacker.position.z + target.position.z) / 2} : target.position, event.result);
    }
    for (const f of fighters) {
      const flying = !!f.flight;if (this.airborneSeen[f.id] && !flying && f.state === 'landing') this.spawnBurst(f.position, 'landing');this.airborneSeen[f.id] = flying;
      if (!this.meshes[f.id]) {
        const body = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({color: f.id ? rgb('enemy') : rgb('player')}));this.meshes[f.id] = body;this.scene.add(body);
        const arrow = new T.Mesh(new T.ConeGeometry(.16, .42, 3), new T.MeshBasicMaterial({color: rgb('arrow')}));this.arrows[f.id] = arrow;this.scene.add(arrow);
        const shadow = new T.Mesh(new T.BoxGeometry(1, .015, 1), new T.MeshStandardMaterial({color: rgb('shadow'), roughness: 1}));this.shadows[f.id] = shadow;this.scene.add(shadow);
      }
      const body = this.meshes[f.id], alt = (f.flight?.y ?? 0) + (f.vaultHeight ?? 0), character = this.characters[f.id];
      body.visible = !character;this.arrows[f.id].visible = !character;
      body.position.set(f.position.x, V.bodyHeight / 2 + alt, f.position.z);
      body.scale.set(V.bodyWidth, f.state === 'landing' ? V.bodyHeight * V.landingScale : f.guard ? V.bodyHeight * V.guardScale : V.bodyHeight, V.bodyDepth);
      const shadow = this.shadows[f.id];shadow.position.set(f.position.x, .012, f.position.z);const size = Math.max(V.shadowMin, 1 - alt * V.shadowHeightFade);shadow.scale.set(size, 1, size);shadow.material.color.setHex(rgb('shadow'));
      body.material.color.setHex(f.hp <= 0 ? rgb('defeated') : f.id ? rgb('enemy') : rgb('player'));
      body.material.emissive.setHex(f.guard ? rgb('glowGuard') : isInvulnerable(f) ? rgb('glowInvuln') : f.state === 'recoil' ? rgb('glowRecoil') : isOffensive(f) ? rgb('glowTackle') : 0);
      const arrow = this.arrows[f.id];arrow.position.set(f.position.x + Math.sin(f.visualFacing) * V.arrowOffset, V.arrowHeight + alt, f.position.z + Math.cos(f.visualFacing) * V.arrowOffset);
      arrow.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(Math.sin(f.visualFacing), 0, Math.cos(f.visualFacing)));arrow.scale.set(V.arrowRadius / .16, V.arrowLength / .42, V.arrowRadius / .16);
      arrow.material.color.setHex(f.guard ? rgb('arrowGuard') : rgb('arrow'));
      character?.update(f, paused ? 0 : dt, alt, events);
    }
    if (!paused) for (let j = this.effects.length - 1; j >= 0; j--) {
      const e = this.effects[j];e.age += Math.min(dt, .05);const p = Math.min(1, e.age / e.duration);
      e.mesh.material.opacity = Math.max(0, (1 - p) * F.particleOpacity);
      e.mesh.position.set(e.x + e.dx * (p * F.particleTravel + F.particleInitialTravel), F.particleHeightFromGround + Math.sin(p * Math.PI) * F.particleRise, e.z + e.dz * (p * F.particleTravel + F.particleInitialTravel));
      e.mesh.scale.set(1, 1, 1 + p * F.particleStretch);
      if (p >= 1) {this.scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();this.effects.splice(j, 1);}
    }
    this.drawOverlays(fighters, paused ? 0 : dt);
    if (!this.rig.initialized) this.rig.reset(fighters[0]);
    const pose = this.rig.pose();
    if (!paused) this.cameraShake *= Math.exp(-X.cameraExtra.cameraShakeDecay * Math.min(dt, .05));
    const phase = performance.now() * .045, shake = this.cameraShake * X.cameraExtra.cameraShakeAmount;
    this.camera.position.set(pose.position.x + Math.sin(phase * 2.1) * shake, pose.height + Math.sin(phase * 1.5) * shake * .45, pose.position.z + Math.cos(phase * 1.9) * shake);
    this.camera.lookAt(pose.lookAt.x, pose.lookHeight, pose.lookAt.z);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (w > 0 && h > 0) {this.renderer.setSize(w, h, false);this.camera.aspect = w / h;this.camera.updateProjectionMatrix();this.renderer.render(this.scene, this.camera);}
  }
  // ---------- Sobreposições técnicas (recriadas a cada quadro em um grupo próprio; materiais/geometrias descartados) ----------
  clearOverlays() {for (const o of [...this.overlayGroup.children]) {this.overlayGroup.remove(o);o.geometry?.dispose();o.material?.dispose();}}
  line(points, color, opacity = .9) {
    const g = new T.BufferGeometry().setFromPoints(points.map(p => new T.Vector3(p[0], p[1], p[2])));
    const l = new T.Line(g, new T.LineBasicMaterial({color, transparent: true, opacity, depthTest: false}));l.renderOrder = 900;this.overlayGroup.add(l);return l;
  }
  ring(x, z, radius, color, from = 0, to = Math.PI * 2, y = .03) {const pts = [];for (let i = 0; i <= 48; i++) {const a = from + (to - from) * i / 48;pts.push([x + Math.sin(a) * radius, y, z + Math.cos(a) * radius]);}return this.line(pts, color, .75);}
  drawOverlays(fighters, dt) {
    this.clearOverlays();const O = this.overlays, V = C.extras.visual, half = C.test.halfExtent;
    const legacy = !!C.extras.toggles.showHitboxes;
    for (const f of fighters) {
      const alt = (f.flight?.y ?? 0) + (f.vaultHeight ?? 0);
      if (O.hurtboxes || legacy) {
        const color = f.hp <= 0 ? STATE_COLORS.defeated : isInvulnerable(f) ? STATE_COLORS.invulnerable : STATE_COLORS[f.state] ?? (f.id ? 0xff5670 : 0x45c4ff);
        const box = new T.Mesh(new T.BoxGeometry(half * 2, V.bodyHeight, half * 2), new T.MeshBasicMaterial({color, wireframe: true, transparent: true, opacity: C.extras.fx.hitboxOpacity, depthTest: false, depthWrite: false}));
        box.position.set(f.position.x, V.bodyHeight / 2 + alt, f.position.z);box.renderOrder = 900;this.overlayGroup.add(box);
      }
      const attacking = f.action?.kind === 'tackle' || f.action?.kind === 'dodge';
      if ((O.attackVectors || C.extras.toggles.showAttackVectors) && attacking) {
        const d = direction(f.action.heading), travel = nominalDistance(f, f.action.kind) * (f.action.speedMultiplier ?? 1), left = travel * Math.max(0, 1 - f.action.elapsed / actionDuration(f.action.kind));
        const bar = new T.Mesh(new T.BoxGeometry(C.extras.fx.attackVectorWidth, .04, Math.max(.01, left)), new T.MeshBasicMaterial({color: f.action.kind === 'tackle' ? 0xffb64e : 0x61ebba, transparent: true, opacity: .68, depthTest: false}));
        bar.position.set(f.position.x + d.x * left / 2, .085 + alt, f.position.z + d.z * left / 2);bar.rotation.y = f.action.heading;bar.renderOrder = 900;this.overlayGroup.add(bar);
      }
      if (O.guardArcs && f.guard) {
        // Ângulo válido: dot(frente, direção do atacante) ≥ alinhamento → meia abertura = acos(alinhamento).
        const open = Math.acos(Math.max(-1, Math.min(1, C.extras.combat.guardFrontAlignment)));
        this.ring(f.position.x, f.position.z, 1.1, STATE_COLORS.guard, f.facing - open, f.facing + open, .05);
      }
      if (O.reach && f.hp > 0) this.ring(f.position.x, f.position.z, nominalDistance(f, 'tackle'), f.id ? 0xff8a8a : 0x8ac4ff);
      if (O.launchArcs && f.flight) this.line(predictFlight(f), 0x9db4ff);
    }
    for (let i = this.normals.length - 1; i >= 0; i--) {
      const n = this.normals[i];n.age += dt;if (n.age > 1.6) {this.normals.splice(i, 1);continue;}
      if (!O.contactNormals) continue;
      const color = n.result === 'clash' ? 0xffe58d : n.result === 'impact' ? 0xffb361 : n.result === 'partial' || n.result === 'perfect' ? 0x73caff : 0xc3d7ff;
      this.line([[n.x, .9, n.z], [n.x + n.n.x * 1.4, .9, n.z + n.n.z * 1.4]], color, 1);
      if (n.launch) this.line([[n.x, .9, n.z], [n.x + n.launch.direction.x * n.launch.horizontal * .15, .9 + n.launch.vertical * .15, n.z + n.launch.direction.z * n.launch.horizontal * .15]], 0xff7a3c, 1);
    }
  }
}

/** Trajetória prevista de um lutador em voo (mesmas equações da física, com rebote nas paredes). */
export function predictFlight(f, dt = 1 / 120) {
  const R = C.rules, bound = C.test.arenaHalf - C.test.halfExtent, pts = [];
  let {x, z} = f.position, y = f.flight.y, vy = f.flight.vy, hx = f.flight.horizontal.x, hz = f.flight.horizontal.z;
  for (let i = 0; i < 1200; i++) {
    pts.push([x, y + .65, z]);
    y += vy * dt - .5 * R.launchGravity * dt * dt;vy -= R.launchGravity * dt;const k = Math.exp(-R.launchDrag * dt);hx *= k;hz *= k;
    x += hx * dt;z += hz * dt;
    if (Math.abs(x) > bound) {x = Math.sign(x) * bound;hx = C.extras.toggles.enableWallBounce ? -hx * R.wallRestitution : 0;}
    if (Math.abs(z) > bound) {z = Math.sign(z) * bound;hz = C.extras.toggles.enableWallBounce ? -hz * R.wallRestitution : 0;}
    if (y <= 0) {pts.push([x, .65, z]);break;}
  }
  return pts;
}
