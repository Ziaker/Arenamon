// Rastro de fogo do meteor slam: cometa apontando para baixo, visível só enquanto o personagem despenca (estado meteorDive).
// Só aparência: lê o lutador e as regras slamFx*, não altera a simulação. Dois planos cruzados (sempre virados para a câmera
// em torno do eixo vertical), textura de chama gerada por canvas, mistura aditiva e faíscas soltas do rastro.
import * as T from 'three';
import {C} from '../sim/config.js';

const box = new T.Box3(), size3 = new T.Vector3();
/** Tamanho real do personagem na tela (modelo carregado ou bloco): largura e altura em metros. */
function bodySize(character) {
  const V = C.extras.visual;
  if (character?.root) {box.setFromObject(character.root);box.getSize(size3);if (size3.y > .2) return {w: Math.max(size3.x, size3.z, .3), h: size3.y};}
  return {w: Math.max(V.bodyWidth, V.bodyDepth), h: V.bodyHeight};
}

const TEX_W = 256, TEX_H = 512;

/** Textura do cometa: cabeça brilhante embaixo, rastro de chama subindo e sumindo em cima (estrias verticais). */
function flameTexture(heat, seed) {
  const cv = document.createElement('canvas');cv.width = TEX_W;cv.height = TEX_H;
  const g = cv.getContext('2d');g.clearRect(0, 0, TEX_W, TEX_H);
  let s = seed;const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const hot = [255, 255 - 20 * (1 - heat), 230 * heat + 90 * (1 - heat)], mid = [255, 170 + 50 * heat, 60 + 100 * heat], cool = [210 - 40 * heat, 60 + 40 * heat, 20];
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  g.globalCompositeOperation = 'lighter';
  // corpo do rastro: afunila para cima
  for (let i = 0; i < 70; i++) {
    const x = TEX_W / 2 + (rnd() - .5) * TEX_W * .62, w = 3 + rnd() * 14, top = TEX_H * (.04 + rnd() * .55), bottom = TEX_H * (.72 + rnd() * .1);
    const spread = (x - TEX_W / 2) * .55;
    const lg = g.createLinearGradient(0, top, 0, bottom);
    lg.addColorStop(0, rgba(cool, 0));lg.addColorStop(.45, rgba(mid, .16 + rnd() * .18));lg.addColorStop(1, rgba(hot, .55));
    g.fillStyle = lg;g.beginPath();g.moveTo(x - w / 2 + spread, top);g.lineTo(x + w / 2 + spread, top);g.lineTo(x + w * .9, bottom);g.lineTo(x - w * .9, bottom);g.closePath();g.fill();
  }
  // núcleo e cabeça (embaixo): elipse branca quente
  const head = g.createRadialGradient(TEX_W / 2, TEX_H * .8, 2, TEX_W / 2, TEX_H * .8, TEX_W * .46);
  head.addColorStop(0, rgba([255, 255, 255], 1));head.addColorStop(.3, rgba(hot, .95));head.addColorStop(.7, rgba(mid, .45));head.addColorStop(1, rgba(cool, 0));
  g.fillStyle = head;g.save();g.translate(TEX_W / 2, TEX_H * .8);g.scale(1, 1.25);g.translate(-TEX_W / 2, -TEX_H * .8);
  g.beginPath();g.arc(TEX_W / 2, TEX_H * .8, TEX_W * .46, 0, Math.PI * 2);g.fill();g.restore();
  // línguas brancas ao redor da cabeça
  for (let i = 0; i < 9; i++) {
    const x = TEX_W / 2 + (rnd() - .5) * TEX_W * .5, len = TEX_H * (.16 + rnd() * .3);
    const lg = g.createLinearGradient(0, TEX_H * .82 - len, 0, TEX_H * .84);
    lg.addColorStop(0, rgba(mid, 0));lg.addColorStop(1, rgba(hot, .55));
    g.fillStyle = lg;g.beginPath();g.ellipse(x, TEX_H * .84 - len / 2, 5 + rnd() * 9, len / 2, 0, 0, Math.PI * 2);g.fill();
  }
  // faixa inferior some (a ponta do cometa é a cabeça)
  g.globalCompositeOperation = 'destination-out';
  const cut = g.createLinearGradient(0, TEX_H * .93, 0, TEX_H);cut.addColorStop(0, 'rgba(0,0,0,0)');cut.addColorStop(1, 'rgba(0,0,0,1)');g.fillStyle = cut;g.fillRect(0, TEX_H * .93, TEX_W, TEX_H);
  const t = new T.CanvasTexture(cv);t.colorSpace = T.SRGBColorSpace;return t;
}

/** Textura do anel de choque: disco com o miolo vazio e uma faixa de fogo na borda (espessura = fração do raio), com estrias radiais. */
function ringTexture(thick, heat) {
  const S = 512, cv = document.createElement('canvas');cv.width = cv.height = S;const g = cv.getContext('2d'), c = S / 2;
  const inner = Math.max(0, 1 - thick), hot = `rgba(255,${(235 - 20 * (1 - heat)) | 0},${(200 * heat + 80 * (1 - heat)) | 0},`, mid = `rgba(255,${(150 + 70 * heat) | 0},${(40 + 90 * heat) | 0},`, cool = 'rgba(190,50,15,';
  g.globalCompositeOperation = 'lighter';
  // faixa principal: sobe até a borda externa e some depressa fora dela
  const rg = g.createRadialGradient(c, c, c * inner * .98, c, c, c * .985);
  rg.addColorStop(0, cool + '0)');rg.addColorStop(.55, mid + '.35)');rg.addColorStop(.9, hot + '.95)');rg.addColorStop(1, hot + '0)');
  g.fillStyle = rg;g.beginPath();g.arc(c, c, c * .985, 0, Math.PI * 2);g.fill();
  // estrias radiais (línguas de fogo apontando para fora)
  let s = 7;const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2, r0 = c * (inner + (1 - inner) * (.2 + rnd() * .5)), r1 = c * (.9 + rnd() * .09), w = .01 + rnd() * .03;
    const lg = g.createLinearGradient(c + Math.cos(a) * r0, c + Math.sin(a) * r0, c + Math.cos(a) * r1, c + Math.sin(a) * r1);
    lg.addColorStop(0, mid + '0)');lg.addColorStop(1, hot + (.35 + rnd() * .4) + ')');
    g.fillStyle = lg;g.beginPath();g.moveTo(c + Math.cos(a - w) * r0, c + Math.sin(a - w) * r0);g.lineTo(c + Math.cos(a + w) * r0, c + Math.sin(a + w) * r0);g.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);g.closePath();g.fill();
  }
  const t = new T.CanvasTexture(cv);t.colorSpace = T.SRGBColorSpace;return t;
}

export class MeteorFx {
  constructor(scene) {
    this.scene = scene;this.rings = [];this.ringTex = new Map();this.ringSeen = new WeakSet();this.rigs = new Map();this.heatKey = null;this.tex = [];this.time = 0;
    this.sparkGeo = new T.BufferGeometry();this.MAX = 160;
    this.sparkPos = new Float32Array(this.MAX * 3);this.sparkVel = new Float32Array(this.MAX * 3);this.sparkLife = new Float32Array(this.MAX);this.sparkMax = new Float32Array(this.MAX);
    this.sparkGeo.setAttribute('position', new T.BufferAttribute(this.sparkPos, 3));
    this.sparks = new T.Points(this.sparkGeo, new T.PointsMaterial({color: 0xffc060, size: .09, transparent: true, opacity: .95, blending: T.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: true}));
    this.sparks.frustumCulled = false;this.sparks.renderOrder = 960;this.sparks.visible = false;scene.add(this.sparks);this.cursor = 0;
    this.sparkLife.fill(0);for (let i = 0; i < this.MAX; i++) this.sparkPos[i * 3 + 1] = -100;
  }
  ensureTextures() {
    const key = Math.round(C.rules.slamFxHeat * 20);
    if (key === this.heatKey) return;
    this.heatKey = key;for (const t of this.tex) t.dispose();
    this.tex = [flameTexture(key / 20, 11), flameTexture(key / 20, 97)];
    for (const rig of this.rigs.values()) rig.planes.forEach((m, i) => {m.material.map = this.tex[i % 2];m.material.needsUpdate = true;});
  }
  rigFor(id) {
    let rig = this.rigs.get(id);if (rig) return rig;
    const group = new T.Group(), planes = [];
    for (let i = 0; i < 2; i++) {
      const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({map: this.tex[i % 2], transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, depthTest: false, opacity: 0}));
      m.renderOrder = 950;planes.push(m);group.add(m);
    }
    group.visible = false;this.scene.add(group);rig = {group, planes, alpha: 0, on: false};this.rigs.set(id, rig);return rig;
  }
  /** Anel de fogo do impacto no chão (meteorGround): nasce no ponto da aterrissagem e se expande em círculo, sumindo com o tempo. */
  spawnRing(x, z) {
    const R = C.rules, key = Math.round(R.slamRingThickness * 20) + ':' + Math.round(R.slamFxHeat * 20);
    let tex = this.ringTex.get(key);if (!tex) {tex = ringTexture(R.slamRingThickness, R.slamFxHeat);this.ringTex.set(key, tex);if (this.ringTex.size > 24) {const k0 = this.ringTex.keys().next().value;this.ringTex.get(k0).dispose();this.ringTex.delete(k0);}}
    const mesh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({map: tex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2}));
    mesh.rotation.x = -Math.PI / 2;mesh.position.set(x, .05, z);mesh.renderOrder = 940;mesh.scale.setScalar(.01);this.scene.add(mesh);this.rings.push({mesh, t: 0});
  }
  updateRings(dt) {
    const R = C.rules;
    this.rings = this.rings.filter(r => {
      r.t += dt;const u = Math.min(1, r.t / Math.max(.05, R.slamRingDuration)), e = 1 - (1 - u) * (1 - u);
      const radius = R.slamRingStart + (R.slamRingRadius - R.slamRingStart) * e;
      r.mesh.scale.setScalar(Math.max(.01, radius * 2));
      r.mesh.material.opacity = Math.max(0, Math.min(1, R.slamRingOpacity * (1 - R.slamRingFade * u) * R.slamRingIntensity));
      r.mesh.material.color.setScalar(Math.min(2.5, .55 + R.slamRingIntensity * .45));
      if (u >= 1) {this.scene.remove(r.mesh);r.mesh.geometry.dispose();r.mesh.material.dispose();return false;}
      return true;
    });
  }
  emitSpark(x, y, z, k) {
    const i = this.cursor;this.cursor = (this.cursor + 1) % this.MAX;
    this.sparkPos[i * 3] = x + (Math.random() - .5) * k;this.sparkPos[i * 3 + 1] = y;this.sparkPos[i * 3 + 2] = z + (Math.random() - .5) * k;
    this.sparkVel[i * 3] = (Math.random() - .5) * 1.2;this.sparkVel[i * 3 + 1] = 1.5 + Math.random() * 2.5;this.sparkVel[i * 3 + 2] = (Math.random() - .5) * 1.2;
    this.sparkLife[i] = this.sparkMax[i] = .35 + Math.random() * .45;
  }
  /** Chamado a cada quadro com os lutadores da simulação. `visible` desliga tudo quando os efeitos estão ocultos. */
  update(fighters, dt, camera, visible = true, characters = []) {
    const R = C.rules;this.time += dt;this.ensureTextures();
    let anyOn = false;
    for (const f of fighters) if (visible && R.slamRingOn && f.action?.slam && f.action.groundHit && !this.ringSeen.has(f.action)) {this.ringSeen.add(f.action);this.spawnRing(f.position.x, f.position.z);}
    this.updateRings(dt);
    for (const f of fighters) {
      const rig = this.rigFor(f.id), diving = visible && !!R.slamFxOn && f.state === 'meteorDive' && !f.action?.slamLanded;
      const fade = Math.max(.001, R.slamFxFadeOut);
      if (diving) {rig.on = true;rig.alpha = Math.min(1, rig.alpha + dt * 14);}
      else {rig.alpha = Math.max(0, rig.alpha - dt / fade);if (rig.alpha <= 0) rig.on = false;}
      rig.group.visible = rig.on && rig.alpha > .01;
      if (!rig.group.visible) continue;
      const flick = R.slamFxFlicker, wob = 1 + flick * (.12 * Math.sin(this.time * 38 + f.id) + .08 * Math.sin(this.time * 61 + 2));
      // Tamanho relativo ao personagem: 1,00 = tão largo e tão alto quanto ele (a chama ocupa ~60% da largura e ~80% da altura da textura).
      const body = bodySize(characters[f.id]), alt = (f.flight?.y ?? 0) + (f.vaultHeight ?? 0);
      const w = body.w / .6 * R.slamFxSize * (1 + flick * .06 * Math.sin(this.time * 47)), len = body.h / .8 * R.slamFxLength * wob;
      // A cabeça (parte de baixo da chama) fica no tronco do personagem e o rastro sobe a partir dela.
      const headY = alt + body.h * .3;
      rig.group.position.set(f.position.x, headY + len * .5 - len * .16, f.position.z);
      const yaw = camera ? Math.atan2(camera.position.x - f.position.x, camera.position.z - f.position.z) : 0;
      rig.planes.forEach((m, i) => {
        m.scale.set(w, len, 1);m.rotation.set(0, yaw + (i ? Math.PI / 2 : 0), 0);
        m.material.opacity = Math.min(1, rig.alpha * R.slamFxIntensity * (i ? .75 : 1));
        m.material.color.setScalar(Math.min(2.5, .55 + R.slamFxIntensity * .45));
      });
      anyOn = true;
      // faíscas soltas do rastro
      const rate = 60 * R.slamFxSparks * rig.alpha;let n = rate * dt;while (n > 0 && R.slamFxSparks > 0) {if (n >= 1 || Math.random() < n) this.emitSpark(f.position.x, headY + Math.random() * len * .7, f.position.z, body.w);n -= 1;}
    }
    // integra as faíscas
    let live = false;
    for (let i = 0; i < this.MAX; i++) {
      if (this.sparkLife[i] <= 0) {this.sparkPos[i * 3 + 1] = -100;continue;}
      this.sparkLife[i] -= dt;live = true;
      this.sparkPos[i * 3] += this.sparkVel[i * 3] * dt;this.sparkPos[i * 3 + 1] += this.sparkVel[i * 3 + 1] * dt;this.sparkPos[i * 3 + 2] += this.sparkVel[i * 3 + 2] * dt;
    }
    this.sparks.visible = live || anyOn;this.sparkGeo.attributes.position.needsUpdate = true;
    this.sparks.material.opacity = Math.min(1, .5 + R.slamFxIntensity * .45);
  }
  reset() {for (const r of this.rings) {this.scene.remove(r.mesh);r.mesh.geometry.dispose();r.mesh.material.dispose();}this.rings = [];for (const rig of this.rigs.values()) {rig.alpha = 0;rig.on = false;rig.group.visible = false;}this.sparkLife.fill(0);this.sparks.visible = false;}
}
