// Cena 3D: arena, blocos (ou personagens), efeitos de impacto e câmera. Porto do v6, mais as sobreposições
// técnicas do laboratório (hitboxes por estado, normais de contato, vetor e arco de lançamento, alcance).
import * as T from 'three';
import {C, rgb} from '../sim/config.js';
import {isInvulnerable, isOffensive, nominalDistance, actionDuration} from '../sim/entity.js';
import {direction, length, angleOf} from '../sim/math.js';
import {wouldVault, cancelWindow} from '../sim/controller.js';
import {hitShapeOf} from '../sim/combat.js';
import {CameraRig} from './rig.js';
import {VfxSystem} from './vfx.js';
import {SolidFx} from './solid-fx.js';
import {MeteorFx} from './meteor-fx.js';
import {LimbSmear} from './smear-mesh.js';
import {PassiveAbilitySystem} from './passive-abilities.js';
import {createPassiveBanners} from '../ui/passive-banner.js';
import {WorldView} from './world-view.js';
import {phaseAt} from '../sim/motion.js';
// Novo sistema de VFX declarativo (ativado ao lado do legado durante a migração).
import {VfxRuntime, registerAllEffects} from './vfx/index.js';
import {CinematicCamera} from './cinematic-camera.js';
// Camada experimental three.quarks (Fase 2 da integração open source): criada sob
// demanda quando C.vfx.quarks.enabled = 1; consome os mesmos eventos do legado.
import * as Quarks from 'three.quarks';
import {QuarksBridge} from './quarks/bridge.js';
// Diagnóstico da navegação experimental (Fase 3, Yuka): rotas e pontos; criado só com extras.nav.enableNav + showDebug.
import {NavDebug} from '../nav/nav-debug.js';
import {StatusAura} from './status-aura.js';
// Pós-processamento experimental (Fase 4, pmndrs/postprocessing sem React): criado só com C.vfx.post.enabled = 1.
import * as PP from 'postprocessing';
import {PostPipeline} from './post/post-pipeline.js';
import {feedPulses} from './post/post-params.js';

const STATE_COLORS = {invulnerable: 0x58e6ff, tackle: 0xffa040, dodge: 0x61ebba, guard: 0xffe066, guardStun: 0xffb347, recoil: 0xc77dff, airborne: 0x9db4ff, landing: 0x7f93b8, defeated: 0x56616a};
export const OVERLAYS = [
  ['hurtboxes', 'Colisores por estado', 'Caixas reais da física, coloridas pelo estado: ciano invulnerável, laranja tackle, verde esquiva, amarelo defesa, roxo recuo, azul no ar.'],
  ['attackVectors', 'Trajetória de X/C', 'Barra com direção e alcance restante do tackle ou da esquiva.'],
  ['guardArcs', 'Arco de defesa', 'Semicírculo frontal coberto pela defesa (ângulo válido configurável em “Ângulo válido para defesa”).'],
  ['contactNormals', 'Normais de contato', 'Setas no ponto de cada impacto, clash ou bloqueio recentes, na direção da normal usada pela física.'],
  ['launchArcs', 'Arco de lançamento previsto', 'Trajetória balística prevista de quem está no ar, com gravidade, arrasto e rebote nas paredes.'],
  ['cancelWindow', 'Janela do C → X e buffer', 'Durante a esquiva, anel no chão: cinza = janela do cancelamento ainda fechada; verde = X disponível (o arco mostra o tempo restante); vermelho = janela aberta, mas sem stamina para X. Ponto amarelo acima do lutador = comando guardado no buffer.'],
  ['preview', 'Prévia de X e C (azul)', 'Com o azul livre, mostra no chão para onde X (laranja) e C (verde) iriam na direção atual das setas (ou da frente, parado). Um arco sobre a linha verde indica que C saltaria sobre o rival.'],
  ['hitShapes', 'Hitbox espacial do golpe', 'Círculo laranja à frente de quem faz o tackle: o defensor só é atingido se o centro dele estiver dentro (requer “Hitbox espacial” ligada em Ajustes). Mostra a forma da janela ativa.'],
  ['reach', 'Alcance de X/C', 'Anel com a distância nominal de tackle/esquiva de cada lutador (2,5 × duração × velocidade).'],
];

export class View {
  constructor(canvas) {
    const X = C.extras;
    this.canvas = canvas;this.scene = new T.Scene();this.camera = new T.PerspectiveCamera(X.cameraExtra.fov, 1, X.cameraExtra.nearClip, X.cameraExtra.farClip);this.rig = new CameraRig();
    this.meshes = [];this.arrows = [];this.shadows = [];this.effects = [];this.seenEvents = new WeakSet();this.airborneSeen = [];this.invulnerableFx = new Map();this.cameraShake = 0;
    this.overlays = Object.fromEntries(OVERLAYS.map(([k]) => [k, k === 'cancelWindow']));this.characters = [];this.smears = [];this.debug = [];this.normals = [];
    this.renderer = new T.WebGLRenderer({canvas, antialias: true});this.renderer.setPixelRatio(Math.min(devicePixelRatio, X.visual.renderPixelRatio));
    this.scene.background = new T.Color(rgb('background'));this.ambientLight = new T.HemisphereLight(0xffffff, 0x65707b, X.visual.ambientLightIntensity);this.scene.add(this.ambientLight);
    this.directionalLight = new T.DirectionalLight(0xffffff, X.visual.directionalIntensity);this.directionalLight.position.set(X.visual.lightX, X.visual.lightY, X.visual.lightZ);this.scene.add(this.directionalLight);
    this.floor = new T.Mesh(new T.BoxGeometry(32, X.visual.floorThickness, 32), new T.MeshStandardMaterial({color: rgb('floor'), roughness: 1}));this.floor.position.y = -.06;this.scene.add(this.floor);
    this.circleFloor = new T.Mesh(new T.CylinderGeometry(50, 50, X.visual.floorThickness, 64), new T.MeshStandardMaterial({color: rgb('floor'), roughness: 1}));
    this.circleFloor.position.y = -X.visual.floorThickness / 2;
    this.scene.add(this.circleFloor);
    this.circleRing = new T.Mesh(new T.RingGeometry(49.85, 50.15, 96), new T.MeshBasicMaterial({color: 0x59d6e6, side: T.DoubleSide, transparent: true, opacity: 0.45, depthWrite: false}));
    this.circleRing.rotation.x = -Math.PI / 2;
    this.circleRing.position.y = 0.015;
    this.scene.add(this.circleRing);
    this.grid = new T.GridHelper(32, 32, rgb('gridMajor'), rgb('gridMinor'));this.grid.position.y = .005;this.scene.add(this.grid);this.walls = [];
    for (const [x, z, w, d] of [[-16, 0, .15, 32], [16, 0, .15, 32], [0, -16, 32, .15], [0, 16, 32, .15]]) {
      const wall = new T.Mesh(new T.BoxGeometry(w, X.visual.wallHeight, d), new T.MeshStandardMaterial({color: rgb('wall')}));wall.position.set(x, .175, z);this.scene.add(wall);this.walls.push(wall);
    }
    this.legacySeen = new WeakSet();
    this.vfx = new VfxSystem(this.scene, {flashEl: document.getElementById('vfx-flash'), canvas});
    // Novo runtime de VFX declarativo. Registra todas as famílias de efeito.
    // Por enquanto o legado (this.vfx) permanece como renderizador ativo; o novo
    // runtime está disponível em this.vfxRuntime para migração efeito a efeito.
    this.vfxRuntime = new VfxRuntime(this.scene, {camera: this.camera, canvas, flashEl: document.getElementById('vfx-flash'), quality: 'medium'});
    registerAllEffects(this.vfxRuntime);
    this.solid = new SolidFx(this.scene); // malhas 3D sólidas (poeira do dash, esquiva, impactos); independe do renderizador de sprites
    this.meteorFx = new MeteorFx(this.scene); // rastro de fogo do meteor slam (só na queda)
    this.abilityBanners = createPassiveBanners();
    this.passives = new PassiveAbilitySystem(this.scene, {notify: (id, name) => this.abilityBanners.show(id, name)});
    this.navDebug = null; // rotas Yuka (Fase 3), sob demanda
    this.statusAura = null; // aura dos status dos Moves novos (Harden, Second Wind), sob demanda
    this.auraSeen = new WeakSet();this.post = null;this.postSeen = new WeakSet();this.postSize = '';   // pós-processamento (Fase 4), sob demanda
    this.quarks = null; // camada three.quarks (Fase 2): instanciada sob demanda quando C.vfx.quarks.enabled
    this.useNewVfx = false; // trocar para true quando o novo sistema estiver em paridade
    this.overlayGroup = new T.Group();this.overlayGroup.renderOrder = 900;this.scene.add(this.overlayGroup);
    this.worldView = new WorldView(this.scene);
    this.vfx.view = this;
    this.vfxRuntime.view = this;
    this.silhouetteWhiteMat = new T.MeshBasicMaterial({color: 0xffffff});
    this.silhouetteBlackMat = new T.MeshBasicMaterial({color: 0x050505});
    this.cinematic = new CinematicCamera(this, {canvas, overlayContainer: canvas?.parentElement});
    let dragging = false, previous = 0;
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {if (e.button === 2) {dragging = true;previous = e.clientX;canvas.setPointerCapture(e.pointerId);}});
    canvas.addEventListener('pointermove', e => {if (dragging) {this.rig.orbit(-(e.clientX - previous) * C.extras.cameraExtra.orbitSensitivity);previous = e.clientX;}});
    const end = () => dragging = false;canvas.addEventListener('pointerup', end);canvas.addEventListener('pointercancel', end);window.addEventListener('blur', end);
    canvas.addEventListener('wheel', e => {e.preventDefault();this.rig.zoomBy(e.deltaY * C.extras.cameraExtra.wheelSensitivity);}, {passive: false});
  }
  setAccessibility(a = {}) {
    this._a11y = a;
    this.vfx?.setAccessibility?.(a);
    this.vfxRuntime?.setAccessibility?.(a);
    this.solid?.setAccessibility?.(a);
    this.worldView?.setAccessibility?.(a);
    if (this.cinematic) {
      if (a.globalIntensity != null) this.cinematic.config.globalIntensity = a.globalIntensity;
      if (a.noFlash != null) this.cinematic.config.noFlash = a.noFlash;
      if (a.preferReducedMotion != null) this.cinematic.config.reduceMotion = a.preferReducedMotion;
    }
  }
  /** Reaplica tamanho da arena, cores, luzes e câmera depois de mudanças no ajustador. */
  applyConfig() {
    const X = C.extras, V = X.visual, half = C.test.arenaHalf, ratio = half / 16;
    const isCircle = C.map?.arenaShape !== 'square';
    const rad = C.map?.arenaRadius ?? half;

    if (isCircle) {
      this.circleFloor.visible = true;
      this.circleRing.visible = true;
      const cRatio = rad / 50;
      this.circleFloor.scale.set(cRatio, V.floorThickness / 0.1, cRatio);
      this.circleRing.scale.set(cRatio, 1, cRatio);
      this.circleFloor.material.color.setHex(rgb('floor'));
      this.floor.visible = false;
      this.walls.forEach(w => { w.visible = false; });
      this.grid.scale.set(rad / 16, 1, rad / 16);
    } else {
      this.circleFloor.visible = false;
      this.circleRing.visible = false;
      this.floor.visible = true;
      this.floor.scale.set(ratio, V.floorThickness / .1, ratio);
      this.grid.scale.set(ratio, 1, ratio);
      this.walls.forEach((wall, i) => {
        wall.visible = true;
        wall.position.set(i === 0 ? -half : i === 1 ? half : 0, V.wallHeight / 2, i === 2 ? -half : i === 3 ? half : 0);
        wall.scale.set(i < 2 ? V.wallThickness / .15 : ratio, V.wallHeight / .35, i < 2 ? ratio : V.wallThickness / .15);
        wall.material.color.setHex(rgb('wall'));
      });
      this.floor.material.color.setHex(rgb('floor'));
    }
    this.camera.fov = X.cameraExtra.fov;this.camera.near = X.cameraExtra.nearClip;this.camera.far = X.cameraExtra.farClip;this.camera.updateProjectionMatrix();
    this.scene.background.setHex(rgb('background'));
    const gridKey = rgb('gridMajor') + ':' + rgb('gridMinor') + ':' + V.gridDivisions;
    if (this.gridKey !== gridKey) {this.gridKey = gridKey;const fresh = new T.GridHelper(32, V.gridDivisions, rgb('gridMajor'), rgb('gridMinor'));this.grid.geometry.dispose();this.grid.geometry = fresh.geometry;fresh.material.dispose();}
    this.ambientLight.intensity = V.ambientLightIntensity;this.directionalLight.intensity = V.directionalIntensity;this.directionalLight.position.set(V.lightX, V.lightY, V.lightZ);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, V.renderPixelRatio));
  }
  reset(player) {
    this.rig.reset(player);this.seenEvents = new WeakSet();this.legacySeen = new WeakSet();this.cameraShake = 0;for (const e of this.effects) {this.scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();}this.effects = [];this.airborneSeen = [];this.invulnerableFx.clear();this.normals = [];this.vfx.reset();
    if (this.canvas) this.canvas.style.filter = '';
    this.vfxRuntime.reset();
    this.quarks?.reset();this.post?.pulses.reset();
    this.solid.reset();this.meteorFx?.reset();for (const smear of this.smears) smear?.reset();
    this.passives.reset();this.abilityBanners.clear();
    this.cinematic?.clearAll();
    this.cinematic?.triggerRoundIntro();
  }
  /** Efeitos legados do v6 (partículas em caixa e tremor antigo). Só com “Efeitos legados” ligado em Visualizar. */
  spawnBurst(pos, type) {
    const F = C.extras.fx;if (!C.extras.hud.fxVisible) return;
    const colors = {perfectDodge: rgb('perfect'), impact: rgb('impact'), clash: rgb('clash'), partial: rgb('partial'), perfect: rgb('perfect'), invulnerable: rgb('invulnerable'), landing: rgb('landing'), footstool: rgb('impact')};
    const color = colors[type] ?? 0xffffff, count = type === 'clash' ? F.clashCount : type === 'landing' ? F.landingCount : F.impactCount;
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count, dx = Math.cos(angle), dz = Math.sin(angle);
      const mesh = new T.Mesh(new T.BoxGeometry(F.particleWidth, F.particleHeight, type === 'clash' ? F.clashParticleLength : F.particleLength), new T.MeshBasicMaterial({color, transparent: true, opacity: F.particleOpacity, depthWrite: false}));
      mesh.rotation.y = angle;mesh.position.set(pos.x, F.particleHeightFromGround, pos.z);this.scene.add(mesh);
      this.effects.push({mesh, age: 0, duration: type === 'clash' ? F.clashDuration : F.impactDuration, dx, dz, x: pos.x, z: pos.z});
    }
  }
  updateLegacy(fighters, events, dt) {
    const X = C.extras, F = X.fx, on = !!C.vfx.master.legacy;
    for (const event of events) {
      if (!on || this.legacySeen.has(event)) continue;this.legacySeen.add(event);
      const attacker = fighters[event.attacker], target = fighters[event.target];if (!attacker || !target || (event.result === 'clash' && event.attacker !== 0)) continue;
      if (event.result === 'invulnerable') {const key = `${event.attacker}:${event.target}`, now = performance.now();if (now - (this.invulnerableFx.get(key) ?? -Infinity) < F.invulnRepeatDelay) continue;this.invulnerableFx.set(key, now);}
      if (event.result === 'clash' || event.result === 'impact' || event.result === 'perfect' || event.result === 'wallSplat' || event.result === 'footstool') this.cameraShake = Math.max(this.cameraShake, event.result === 'clash' ? 1 : event.slam || event.result === 'wallSplat' ? .8 : event.result === 'footstool' ? .35 : .45);
      this.spawnBurst(event.result === 'clash' ? {x: (attacker.position.x + target.position.x) / 2, z: (attacker.position.z + target.position.z) / 2} : target.position, event.result);
    }
    for (const f of fighters) {const flying = !!f.flight;if (on && this.airborneSeen[f.id] && !flying && f.state === 'landing') this.spawnBurst(f.position, 'landing');this.airborneSeen[f.id] = flying;}
    for (let j = this.effects.length - 1; j >= 0; j--) {
      const e = this.effects[j];e.age += Math.min(dt, .05);const p = Math.min(1, e.age / e.duration);
      e.mesh.material.opacity = Math.max(0, (1 - p) * F.particleOpacity);
      e.mesh.position.set(e.x + e.dx * (p * F.particleTravel + F.particleInitialTravel), F.particleHeightFromGround + Math.sin(p * Math.PI) * F.particleRise, e.z + e.dz * (p * F.particleTravel + F.particleInitialTravel));
      e.mesh.scale.set(1, 1, 1 + p * F.particleStretch);
      if (p >= 1) {this.scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();this.effects.splice(j, 1);}
    }
    this.cameraShake *= Math.exp(-X.cameraExtra.cameraShakeDecay * Math.min(dt, .05));
    const phase = performance.now() * .045, a = on ? this.cameraShake * X.cameraExtra.cameraShakeAmount : 0;
    return {x: Math.sin(phase * 2.1) * a, y: Math.sin(phase * 1.5) * a * .45, z: Math.cos(phase * 1.9) * a};
  }
  /** Personagem 3D opcional por lutador (characters.js). Quando presente, o bloco fica oculto. */
  setCharacter(id, character) {
    if (this.characters[id] !== character) this.isWarmedUp = false;
    this.smears[id]?.dispose();
    this.characters[id] = character;
    this.smears[id] = character ? new LimbSmear(this.scene, character, id) : null;
  }
  /**
   * Pré-aquecimento da cena, modelos e GPU:
   * 1. Pré-calcula curvas de solo das ações de combate essenciais (sem engasgar a CPU na luta).
   * 2. Pré-compila todos os shaders GLSL no WebGL (via compileAsync / compile).
   * 3. Executa um render inicial para carregar texturas e programas na VRAM.
   */
  async warmUp(characters = this.characters, {onProgress = null} = {}) {
    onProgress?.(0.15, 'Preparando geometria dos lutadores…');
    this.scene.updateMatrixWorld(true);
    for (const ch of characters) {
      if (ch?.root) ch.root.updateMatrixWorld(true);
    }
    await new Promise(r => setTimeout(r, 16));

    onProgress?.(0.4, 'Pré-calculando pontos de apoio no solo…');
    for (const ch of characters) {
      if (ch?.warmEssentialGround) {
        try { ch.warmEssentialGround(); } catch (e) { console.warn('warmEssentialGround:', e); }
      }
    }
    await new Promise(r => setTimeout(r, 16));

    onProgress?.(0.7, 'Pré-compilando shaders na GPU (WebGL)…');
    try {
      if (this.renderer && typeof this.renderer.compileAsync === 'function') {
        await this.renderer.compileAsync(this.scene, this.camera);
      } else if (this.renderer && typeof this.renderer.compile === 'function') {
        this.renderer.compile(this.scene, this.camera);
      }
    } catch (e) {
      console.warn('compileAsync fallback:', e);
      if (this.renderer && typeof this.renderer.compile === 'function') {
        this.renderer.compile(this.scene, this.camera);
      }
    }
    await new Promise(r => setTimeout(r, 16));

    onProgress?.(0.95, 'Carregando texturas na VRAM…');
    const w = this.canvas?.clientWidth || 0, h = this.canvas?.clientHeight || 0;
    if (w > 0 && h > 0) {
      this.renderer.setSize(w, h, false);
      this.renderer.render(this.scene, this.camera);
    }
    this.isWarmedUp = true;
    onProgress?.(1.0, 'Pronto!');
  }
  /** Sombra no estilo escolhido (A quadrada, B círculo, C círculo suave). Sempre na posição física, rente ao chão. */
  shadowFor(f) {
    const S = C.display.shadow, style = S.style | 0, key = style === 2 ? `soft${Math.round(S.softness * 20)}` : style === 1 ? 'circle' : 'box';
    let sh = this.shadows[f.id];
    if (!sh || sh.userData.key !== key) {
      if (sh) {this.scene.remove(sh);sh.geometry.dispose();sh.material.dispose();}
      if (style === 0) sh = new T.Mesh(new T.BoxGeometry(1, .015, 1), new T.MeshBasicMaterial({color: rgb('shadow'), transparent: true, depthWrite: false}));
      else {
        const geo = style === 1 ? new T.CircleGeometry(.5, 48) : new T.PlaneGeometry(1, 1);geo.rotateX(-Math.PI / 2);
        sh = new T.Mesh(geo, new T.MeshBasicMaterial({color: rgb('shadow'), transparent: true, depthWrite: false, map: style === 2 ? softShadowTexture(S.softness) : null}));
      }
      sh.userData.key = key;sh.renderOrder = 1;this.shadows[f.id] = sh;this.scene.add(sh);
    }
    return sh;
  }
  draw(fighters, events = [], dt = 1 / 60, {paused = false, tick = 0, sources = [], realDt = dt, world = null, navGame = null} = {}) {
    const X = C.extras, V = X.visual, S = C.display.shadow, G = C.display.grounding, now = () => performance.now(), tm = this.timings = {anim: 0, vfx: 0, render: 0, overlays: 0};let t0;
    const visualScale = this.cinematic?.getVisualTimeScale?.() ?? 1.0;
    const isKoSeq = !!this.cinematic?.koState;
    for (const event of events) {
      if (this.seenEvents.has(event)) continue;this.seenEvents.add(event);
      const attacker = fighters[event.attacker], target = fighters[event.target];if (!attacker || !target) continue;
      if (event.normal && (event.result !== 'clash' || event.attacker === 0)) this.normals.push({x: (attacker.position.x + target.position.x) / 2, z: (attacker.position.z + target.position.z) / 2, n: event.normal, result: event.result, age: 0, launch: event.launch});
    }
    for (const f of fighters) {
      if (!this.meshes[f.id]) {
        const body = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({color: f.id ? rgb('enemy') : rgb('player')}));this.meshes[f.id] = body;this.scene.add(body);
        const arrow = new T.Mesh(new T.ConeGeometry(.16, .42, 3), new T.MeshBasicMaterial({color: rgb('arrow')}));this.arrows[f.id] = arrow;this.scene.add(arrow);
      }
      const baseGroundY = f.groundY ?? 0;
      const currentY = f.flight ? (f.flight.y ?? baseGroundY) : baseGroundY;
      const body = this.meshes[f.id], alt = currentY + (f.vaultHeight ?? 0), character = this.characters[f.id];
      body.visible = !character;this.arrows[f.id].visible = !character;
      // Bloco: compressão e alongamento seguindo as fases físicas de X/C (preparação comprime, impulso alonga).
      let squash = 1;
      if (f.action && (f.action.kind === 'tackle' || f.action.kind === 'dodge')) {
        const p = C.actions[f.action.kind], u = f.action.elapsed / p.duration, phase = p.profile === 1 ? phaseAt(u, p) : '';
        squash = phase === 'preparação' ? .86 : phase === 'impulso' ? 1.08 : phase === 'deslocamento' ? 1.04 : phase === 'desaceleração' ? .96 : 1;
      }
      const vis = G.visualOffset || 0, wide = Math.sqrt(2 - squash);
      body.position.set(f.position.x, V.bodyHeight / 2 * squash + alt + vis, f.position.z);
      body.scale.set(V.bodyWidth * wide, (f.state === 'landing' ? V.bodyHeight * V.landingScale : f.guard ? V.bodyHeight * V.guardScale : V.bodyHeight) * squash, V.bodyDepth * wide);
      // Sombra: posição física (independente da altura visual), atenuada pela altura do lutador.
      const shadow = this.shadowFor(f), fade = Math.max(V.shadowMin, 1 - Math.max(0, currentY - baseGroundY) * V.shadowHeightFade), style = S.style | 0;
      shadow.position.set(f.position.x + S.offsetX, baseGroundY + .012, f.position.z + S.offsetZ);
      const size = (style === 0 ? 1 : S.radius * 2) * fade;
      shadow.scale.set(size * S.scaleX * (style === 0 ? V.bodyWidth : 1), 1, size * S.scaleZ * (style === 0 ? V.bodyDepth : 1));
      shadow.material.color.setHex(rgb('shadow'));shadow.material.opacity = Math.min(1, (style === 0 ? 1 : S.opacity * fade) * S.intensity);
      body.material.color.setHex(f.hp <= 0 ? rgb('defeated') : f.id ? rgb('enemy') : rgb('player'));
      body.material.emissive.setHex(f.guard ? rgb('glowGuard') : isInvulnerable(f) ? rgb('glowInvuln') : f.state === 'recoil' ? rgb('glowRecoil') : isOffensive(f) ? rgb('glowTackle') : 0);
      const arrow = this.arrows[f.id];arrow.position.set(f.position.x + Math.sin(f.visualFacing) * V.arrowOffset, V.arrowHeight + alt + vis, f.position.z + Math.cos(f.visualFacing) * V.arrowOffset);
      arrow.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(Math.sin(f.visualFacing), 0, Math.cos(f.visualFacing)));arrow.scale.set(V.arrowRadius / .16, V.arrowLength / .42, V.arrowRadius / .16);
      arrow.material.color.setHex(f.guard ? rgb('arrowGuard') : rgb('arrow'));
      // A prévia de animação continua tocando com a partida pausada; bullet time visual desacelera apresentação.
      const animDt = (paused && !isKoSeq) ? (character?.preview ? realDt : 0) : ((isKoSeq ? (realDt ?? 0.016) : dt) * visualScale);
      t0 = now();character?.update(f, animDt, alt, events, {tick, source: sources[f.id]});tm.anim += now() - t0;
      t0 = now();this.smears[f.id]?.update(f, paused ? 0 : animDt, V.smear, tick, !!X.hud.fxVisible && !!C.vfx.master.enabled && !C.vfx.master.reduceMotion);tm.vfx += now() - t0;
    }
    t0 = now();this.drawOverlays(fighters, paused ? 0 : dt);this.worldView.update(world, {fighters, events, dt: paused ? 0 : dt, skipBeams: this.useNewVfx, camera: this.camera});tm.overlays = now() - t0;
    if (!this.rig.initialized) this.rig.reset(fighters[0]);
    const basePose = this.rig.pose();
    const cinePose = this.cinematic ? this.cinematic.apply(basePose, fighters, events, dt, {camera: this.camera, paused, tick, realDt}) : basePose;
    this.camera.position.set(cinePose.position.x, cinePose.height, cinePose.position.z);
    this.camera.lookAt(cinePose.lookAt.x, cinePose.lookHeight, cinePose.lookAt.z);
    if (cinePose.roll) this.camera.rotateZ(cinePose.roll);
    if (cinePose.fov && Math.abs(this.camera.fov - cinePose.fov) > 0.05) {
      this.camera.fov = cinePose.fov;
      this.camera.updateProjectionMatrix();
    } else if (!this.cinematic?.config?.enabled && Math.abs(this.camera.fov - C.extras.cameraExtra.fov) > 0.05) {
      this.camera.fov = C.extras.cameraExtra.fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();
    // Efeitos depois da câmera (o flash de tela projeta o ponto do impacto). Pausado: dt = 0, os efeitos congelam (exceto K.O. cinematográfico).
    const vfxDt = (paused && !isKoSeq) ? 0 : Math.min((isKoSeq ? (realDt ?? 0.016) : dt) * visualScale, 0.05);
    let rt = null;
    if (this.useNewVfx) {
      // Novo runtime declarativo (renderizador ativo). O legado fica inativo.
      t0 = now();rt = this.vfxRuntime.update(fighters, events, vfxDt, {characters: this.characters, camera: this.camera, paused, tick, world});tm.vfx += now() - t0;
    } else {
      // Renderizador legado (fallback). O novo runtime permanece inativo.
      t0 = now();this.vfx.update(fighters, events, vfxDt, {characters: this.characters, camera: this.camera});tm.vfx += now() - t0;
      this.vfxRuntime.beamRenderer?.reset();
    }
    // Camada three.quarks experimental (A/B): cria/consome só quando ligada; desligada = custo zero.
    if (C.vfx.quarks?.enabled) {
      if (!this.quarks) {
        this.quarks = new QuarksBridge({THREE: T, Quarks, scene: this.scene, accessibility: {reduceMotion: () => !!(this._a11y?.reduceMotion || C.vfx.master?.reduceMotion || C.vfx.laser?.reduceMotion)}});
      }
      this.quarks.fx.enabled = !!X.hud.fxVisible; // respeita o mestre de VFX da HUD
      t0 = now();this.quarks.update(fighters, events, vfxDt);tm.quarks = now() - t0;
    } else if (this.quarks) {
      this.quarks.dispose();this.quarks = null;
    }
    // Aura dos status dos Moves novos: só existe enquanto algum lutador tem Harden/Second Wind (custo zero fora disso).
    if (fighters.some(f => f.statuses?.some(s => s.id === 'harden' || s.id === 'second-wind'))) {
      const m = C.vfx.master ?? {}, hitIds = new Set(events.filter(e => (e.result === 'impact' || e.result === 'partial') && !this.auraSeen.has(e)).map(e => {this.auraSeen.add(e);return e.target;}));
      (this.statusAura ??= new StatusAura(T, this.scene)).update(fighters, paused ? 0 : dt, {bodyHeight: X.visual.bodyHeight, halfExtent: C.test.halfExtent, reduceMotion: !!(this._a11y?.reduceMotion || m.reduceMotion), noFlash: !!(this._a11y?.noFlash || m.noFlash), hits: hitIds});
    } else if (this.statusAura) {this.statusAura.dispose();this.statusAura = null;}
    // Rotas da navegação experimental (Yuka): só quando ligada e com diagnóstico visível.
    if (navGame && C.extras.nav?.enableNav && C.extras.nav.showDebug) (this.navDebug ??= new NavDebug(T, this.scene)).update(navGame);
    else if (this.navDebug) {this.navDebug.dispose();this.navDebug = null;}
    this.solid.update(fighters, events, vfxDt, {visible: !!X.hud.fxVisible, world});
    this.meteorFx.update(fighters, vfxDt, this.camera, !!X.hud.fxVisible, this.characters);
    t0 = now();this.passives.update(fighters, vfxDt, {characters: this.characters, visible: !!X.hud.fxVisible && !!C.vfx.master.enabled});tm.vfx += now() - t0;
    const legacy = this.updateLegacy(fighters, events, paused ? 0 : dt);
    const fxOn = !!X.hud.fxVisible;
    const legacyOn = fxOn && !this.useNewVfx && !!this.vfx.atlas;
    const newOn = fxOn && this.useNewVfx && !!this.vfxRuntime.atlas;
    this.vfx.add.mesh.visible = legacyOn; this.vfx.norm.mesh.visible = legacyOn;
    this.vfxRuntime.add.mesh.visible = newOn; this.vfxRuntime.norm.mesh.visible = newOn;
    if (this.vfxRuntime.beamRenderer) this.vfxRuntime.beamRenderer.group.visible = newOn;
    // Tremor: vem do sistema ativo (legado ou novo). Nunca altera o rig nem a entrada.
    let sh;
    if (this.useNewVfx && rt && rt.camera) {
      sh = rt.camera;
      sh.x += legacy.x; sh.y += legacy.y; sh.z += legacy.z;
    } else {
      sh = this.vfx.shakeOffset(vfxDt, this.camera);
      sh.x += legacy.x; sh.y += legacy.y; sh.z += legacy.z;
    }
    this.lastShake = sh;
    if (sh.x || sh.y || sh.z || sh.roll) {
      this.camera.position.set(cinePose.position.x + sh.x, cinePose.height + sh.y, cinePose.position.z + sh.z);
      this.camera.lookAt(cinePose.lookAt.x + sh.x * .5, cinePose.lookHeight + sh.y * .5, cinePose.lookAt.z + sh.z * .5);
      this.camera.rotateZ(sh.roll + (cinePose.roll || 0));
    }
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (w > 0 && h > 0) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    // Garante que a matriz de mundo e projeção da câmera estejam 100% atualizadas antes de projetar speedlines
    this.camera.updateMatrixWorld(true);
    // Atualiza overlays de apresentação (speedlines projetadas com a matriz final da câmera)
    this.cinematic?.renderOverlays?.(this.camera);

    if (w > 0 && h > 0) {
      // C08 — Impact Frame com Silhueta Real em WebGL (personagens brancos sobre fundo preto puro)
      const impactPhase = this.cinematic?.getImpactFramePhase?.();
      let origBg = null;
      const hiddenElements = [];
      const swappedMeshes = [];

      if (impactPhase === 'white' || impactPhase === 'invert') {
        origBg = this.scene.background;
        this.scene.background = impactPhase === 'white' ? new T.Color(0x050505) : new T.Color(0xffffff);
        const silMat = impactPhase === 'white' ? this.silhouetteWhiteMat : this.silhouetteBlackMat;

        const toHide = [this.floor, this.circleFloor, this.circleRing, this.grid, ...this.walls, this.worldView?.group, ...this.shadows];
        for (const el of toHide) {
          if (el && el.visible) {
            el.visible = false;
            hiddenElements.push(el);
          }
        }

        const targets = [...this.meshes, ...this.characters.map(c => c?.root)].filter(Boolean);
        for (const root of targets) {
          root.traverse(child => {
            if (child.isMesh && child.visible) {
              swappedMeshes.push({mesh: child, origMat: child.material});
              child.material = silMat;
            }
          });
        }
      }

      try {
        // Tempo de CPU do envio ao WebGL (não é tempo de GPU); o tempo de GPU, quando há suporte, vem da consulta de tempo.
        this.gpuTimer?.begin();t0 = now();
        // Pós-processamento experimental: só com C.vfx.post.enabled; impact frames (silhueta pura) e desligado usam o renderer atual.
        if (!this.renderPost(fighters, events, paused ? 0 : dt, impactPhase, isKoSeq, w, h)) this.renderer.render(this.scene, this.camera);
        tm.render = now() - t0;this.gpuTimer?.end();
      } finally {
        // Restaura cena ao normal imediatamente após a renderização do quadro mesmo se houver erro
        if (impactPhase === 'white' || impactPhase === 'invert') {
          this.scene.background = origBg;
          for (const el of hiddenElements) el.visible = true;
          for (const {mesh, origMat} of swappedMeshes) mesh.material = origMat;
        }
      }
    }
  }
  /** Pós-processamento (Fase 4). Devolve true se o quadro foi desenhado pelo pipeline; false = usar renderer.render(). */
  renderPost(fighters, events, dt, impactPhase, isKoSeq, w, h) {
    const P = C.vfx.post;
    if (!P?.enabled) {if (this.post) {this.post.dispose();this.post = null;}return false;}
    if (impactPhase === 'white' || impactPhase === 'invert') return false;   // C08: silhueta pura, o pós não toca
    if (!this.post) {
      const m = C.vfx.master ?? {}, l = C.vfx.laser ?? {}, a = () => this._a11y ?? {};
      this.post = new PostPipeline({THREE: T, PP, renderer: this.renderer, scene: this.scene, camera: this.camera, params: P, accessibility: () => ({
        noFlash: !!(a().noFlash || m.noFlash || l.noFlash), reduceMotion: !!(a().reduceMotion || m.reduceMotion || l.reduceMotion), highContrast: !!(a().highContrast || m.highContrast || l.highContrast)})});
      this.postSize = '';
    }
    if (`${w}x${h}` !== this.postSize) {this.post.setSize(w, h);this.postSize = `${w}x${h}`;}
    feedPulses(this.post, events, fighters, this.postSeen, (pos, s) => this.post.shock(pos, s), P.distortMinDamage);
    const loser = isKoSeq ? fighters.find(f => f.hp <= 0) : null;
    this.post.setDof(isKoSeq, loser ? {x: loser.position.x, y: (loser.groundY ?? 0) + 1, z: loser.position.z} : null);
    return this.post.render(dt);
  }
  // ---------- Sobreposições técnicas (recriadas a cada quadro em um grupo próprio; materiais/geometrias descartados) ----------
  previewPassive(id, kind) {this.passives.activate(id, kind);}
  clearOverlays() {for (const o of [...this.overlayGroup.children]) {this.overlayGroup.remove(o);o.geometry?.dispose();o.material?.dispose();}}
  line(points, color, opacity = .9) {
    const g = new T.BufferGeometry().setFromPoints(points.map(p => new T.Vector3(p[0], p[1], p[2])));
    const l = new T.Line(g, new T.LineBasicMaterial({color, transparent: true, opacity, depthTest: false}));l.renderOrder = 900;this.overlayGroup.add(l);return l;
  }
  ring(x, z, radius, color, from = 0, to = Math.PI * 2, y = .03) {const pts = [];for (let i = 0; i <= 48; i++) {const a = from + (to - from) * i / 48;pts.push([x + Math.sin(a) * radius, y, z + Math.cos(a) * radius]);}return this.line(pts, color, .75);}
  drawOverlays(fighters, dt) {
    this.clearOverlays();this.lastFighters = fighters;const O = this.overlays, V = C.extras.visual, half = C.test.halfExtent;
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
      if (O.hitShapes && f.action?.kind === 'tackle') {
        const aw = f.action.combatWindows?.activeWindows, step = Math.round((f.action.elapsed ?? 0) / (C.test.step || 1 / 120)), idx = Array.isArray(aw) ? Math.max(0, aw.findIndex(([a, b]) => step >= a && step < b)) : 0;
        const sh = hitShapeOf(f, idx);
        if (sh) {this.ring(sh.x, sh.z, sh.radius + half, 0xffa040, 0, Math.PI * 2, .09 + alt);this.ring(sh.x, sh.z, sh.radius + half, 0xffa040, 0, Math.PI * 2, V.bodyHeight * .6 + alt);}
      }
      if (O.guardArcs && f.guard) {
        // Ângulo válido: dot(frente, direção do atacante) ≥ alinhamento → meia abertura = acos(alinhamento).
        const open = Math.acos(Math.max(-1, Math.min(1, C.extras.combat.guardFrontAlignment)));
        this.ring(f.position.x, f.position.z, 1.1, STATE_COLORS.guard, f.facing - open, f.facing + open, .05);
      }
      if (O.cancelWindow && f.hp > 0) {
        const K = C.actions.cancel;
        if (f.action?.kind === 'dodge' && K.dodgeToTackle) {
          const [w0, w1] = cancelWindow(), t = f.action.elapsed, open = (K.perfectAnytime && f.counterWindow > 0) || (t >= w0 - 1e-8 && t <= w1 + 1e-8), afford = !f.exhausted && f.stamina >= C.actions.tackle.cost - 1e-8;
          const span = Math.max(1e-6, w1 - w0), left = open ? Math.max(0, Math.min(1, (w1 - t) / span)) : 1;
          const color = !open ? 0x8a94a6 : afford ? 0x5dff9a : 0xff5a5a;
          // Faixa plana (RingGeometry no plano XZ), centrada na frente do lutador; o arco encolhe com o tempo restante da janela.
          const band = new T.Mesh(new T.RingGeometry(C.display.cancelRing.inner, C.display.cancelRing.inner + C.display.cancelRing.width, 64, 1, f.facing - Math.PI / 2 - Math.PI * left, Math.PI * 2 * left), new T.MeshBasicMaterial({color, transparent: true, opacity: C.display.cancelRing.opacity, side: T.DoubleSide, depthTest: false, depthWrite: false}));
          band.rotation.x = -Math.PI / 2;band.position.set(f.position.x, .04 + alt, f.position.z);band.renderOrder = 901;this.overlayGroup.add(band);
        }
        if (f.inputBuffer) {
          const dot = new T.Mesh(new T.SphereGeometry(.13, 10, 8), new T.MeshBasicMaterial({color: f.inputBuffer.kind === 'tackle' ? 0xffd34d : 0x9dffd8, transparent: true, opacity: .9, depthTest: false}));
          dot.position.set(f.position.x, V.bodyHeight + .45 + alt, f.position.z);dot.renderOrder = 901;this.overlayGroup.add(dot);
        }
      }
      if (O.preview && f.id === 0 && f.hp > 0 && !f.action && !f.flight && f.knockRecovery <= 0) {
        const heading = length(f.desiredMove ?? {x: 0, z: 0}) > .01 ? angleOf(f.desiredMove) : f.combatHeading ?? f.facing, d = direction(heading);
        const x = nominalDistance(f, 'tackle'), c = nominalDistance(f, 'dodge'), side = {x: -d.z * .12, z: d.x * .12};
        this.line([[f.position.x + side.x, .06, f.position.z + side.z], [f.position.x + side.x + d.x * x, .06, f.position.z + side.z + d.z * x]], 0xffa040, .85);
        const vault = !!C.extras.toggles.enableVault && wouldVault(f, heading, this.lastFighters ?? []);
        if (vault) {const pts = [];for (let i = 0; i <= 24; i++) {const u = i / 24;pts.push([f.position.x - side.x + d.x * c * u, .06 + C.actions.dodge.vaultHeight * Math.sin(Math.PI * u), f.position.z - side.z + d.z * c * u]);}this.line(pts, 0x61ebba, .9);}
        else this.line([[f.position.x - side.x, .06, f.position.z - side.z], [f.position.x - side.x + d.x * c, .06, f.position.z - side.z + d.z * c]], 0x61ebba, .85);
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
    const wb = C.extras.toggles.enableWallBounce;
    if (Math.abs(x) > bound) {x = Math.sign(x) * bound;hx = wb ? -hx * R.wallRestitution : 0;if (wb) vy = vy * R.wallBounceVertical + R.wallBounceUp;}
    if (Math.abs(z) > bound) {z = Math.sign(z) * bound;hz = wb ? -hz * R.wallRestitution : 0;if (wb) vy = vy * R.wallBounceVertical + R.wallBounceUp;}
    if (y <= 0) {pts.push([x, .65, z]);break;}
  }
  return pts;
}

/** Textura radial da sombra suave (C): núcleo opaco e borda que se dissipa conforme a suavidade. */
const softCache = new Map();
function softShadowTexture(softness) {
  const k = Math.round(softness * 20) / 20;if (softCache.has(k)) return softCache.get(k);
  const cv = document.createElement('canvas');cv.width = cv.height = 128;const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  const core = Math.max(0, .75 - k * .7);gr.addColorStop(0, 'rgba(255,255,255,1)');gr.addColorStop(core, 'rgba(255,255,255,.95)');gr.addColorStop(Math.min(.99, core + (1 - core) * .55), 'rgba(255,255,255,.35)');gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;g.fillRect(0, 0, 128, 128);const t = new T.CanvasTexture(cv);softCache.set(k, t);return t;
}
