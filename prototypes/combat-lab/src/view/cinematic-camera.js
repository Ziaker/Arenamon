// Câmera Cinemática de Combate — Estilo Anime / Zenless Zone Zero (ZZZ)
// Atua exclusivamente como camada visual de apresentação sobre o CameraRig.
// NUNCA altera o yaw do rig funcional, garantindo que o controle direcional do jogador permaneça 100% íntegro.
import * as T from 'three';
import {C} from '../sim/config.js';
import {vec, add, scale, sub, length, normalize, clamp, angleOf, direction, angleDelta, dot} from '../sim/math.js';

// Utilitários de vetor 3D com preservação de altura (Y)
const v3 = (x = 0, y = 0, z = 0) => ({x, y, z});
const add3 = (a, b) => ({x: a.x + b.x, y: (a.y ?? 0) + (b.y ?? 0), z: a.z + b.z});
const sub3 = (a, b) => ({x: a.x - b.x, y: (a.y ?? 0) - (b.y ?? 0), z: a.z - b.z});
const scale3 = (a, s) => ({x: a.x * s, y: (a.y ?? 0) * s, z: a.z * s});
const len3 = a => Math.hypot(a.x, a.y ?? 0, a.z);
const norm3 = a => {
  const l = len3(a);
  return l > 1e-8 ? scale3(a, 1 / l) : v3();
};

export const CINEMATIC_DEFAULTS = Object.freeze({
  enabled: false,           // Toggle mestre (inicia desativado por padrão)
  globalIntensity: 1.0,     // Intensidade cinematográfica global (0..2)
  reduceMotion: false,      // Acessibilidade: suaviza/suprime rotações bruscas
  noFlash: false,           // Acessibilidade: suprime flashes intensos e inversão
  // C01 — Dutch angle dinâmico na esquiva
  dutchDodge: {enabled: true, maxRoll: 10, duration: 0.28, returnSpeed: 8.0},
  // C02 — Câmera baixa em Sprint e Tackle (Worm's-eye view suave)
  lowSpeed: {enabled: true, dropHeight: 0.42, zoomIn: 0.35, pitchUp: 0.18, smoothSpeed: 6.0},
  // C03 — Snap lateral na Defesa Perfeita e no Clash
  snapParry: {enabled: true, angle: 80, distance: 3.2, duration: 0.18, returnSpeed: 9.0},
  // C04 — Respiração do FOV durante cargas
  chargeFov: {enabled: true, maxCompression: 10, curve: 'easeInOut'},
  // C05 — Explosão do FOV no disparo (FOV punch)
  releaseFov: {enabled: true, punchFov: 16, attackFrames: 2, duration: 0.22},
  // C06 — Câmera de Meteor Slam
  meteorSlam: {enabled: true, fallPitch: 0.35, impactDrop: 0.5, impactFov: 12, duration: 0.35},
  // C07 — Câmera de K.O. e Finalização
  koCamera: {enabled: true, roll: 12, orbitArc: 24, dropHeight: 0.55, slowDuration: 0.6},
  // C08 — Impact Frames estilizados
  impactFrames: {enabled: true, whiteDuration: 0.035, invertDuration: 0.035, flashStrength: 0.8},
  // C09 — Speedlines radiais
  speedlines: {enabled: true, count: 28, length: 0.35, width: 2.5, opacity: 0.65, duration: 0.18},
  // C10 — Letterbox dinâmico
  letterbox: {enabled: true, mode: 'subtle', barPct: 6, duration: 0.42},
  // C11 — Câmera lenta visual (apresentação sem alterar regras lógicas)
  slowMotion: {enabled: true, scale: 0.25, duration: 0.2},
  // C12 — Inércia cinematográfica e recuperação
  springInertia: {enabled: true, stiffness: 180, damping: 24, maxDisplacement: 1.5, maxRollRad: 0.26},
});

export class CinematicCamera {
  constructor(view, {canvas = null, overlayContainer = null} = {}) {
    this.view = view;
    this.canvas = canvas;
    this.overlayContainer = overlayContainer;
    this.config = JSON.parse(JSON.stringify(CINEMATIC_DEFAULTS));
    this.activeEffect = 'none';
    this.time = 0;
    this.clock = 0;

    // Estado da mola de inércia (offset e velocidade)
    this.spring = {
      pos: {x: 0, y: 0, z: 0},
      velPos: {x: 0, y: 0, z: 0},
      look: {x: 0, y: 0, z: 0},
      velLook: {x: 0, y: 0, z: 0},
      roll: 0,
      velRoll: 0,
      fovOffset: 0,
      velFov: 0,
    };

    // Alvos transitórios instantâneos
    this.target = {
      posOffset: {x: 0, y: 0, z: 0},
      lookOffset: {x: 0, y: 0, z: 0},
      roll: 0,
      fovOffset: 0,
    };

    // Estados de eventos transitórios
    this.snap = null;        // {startedAt, duration, pos, look, roll, returnSpeed}
    this.fovPunch = null;    // {startedAt, duration, punchFov}
    this.impactState = null; // {phase: 'white'|'invert'|'decay', startedAt, duration, strength}
    this.speedlineState = null; // {startedAt, duration, x, y}
    this.letterboxState = null; // {startedAt, duration, mode, pct}
    this.koState = null;     // {startedAt, duration, roll, arc, center, radius}
    this.lastEventsSeen = new WeakSet();
    this.previewActive = null;
    this.previewTimer = null;

    // Criar elementos de overlay DOM se disponíveis
    this.initDomOverlays();
  }

  initDomOverlays() {
    if (typeof document === 'undefined') return;
    let root = this.overlayContainer || document.querySelector('.stage') || document.body;

    // Letterbox: barras superior e inferior
    this.letterboxEl = document.getElementById('cine-letterbox');
    if (!this.letterboxEl) {
      this.letterboxEl = document.createElement('div');
      this.letterboxEl.id = 'cine-letterbox';
      this.letterboxEl.className = 'cine-letterbox';
      this.letterboxEl.innerHTML = '<div class="cine-bar cine-bar-top"></div><div class="cine-bar cine-bar-bottom"></div>';
      root.appendChild(this.letterboxEl);
    }

    // Impact Frame: overlay de flash de alto contraste / inversão
    this.impactFrameEl = document.getElementById('cine-impact-frame');
    if (!this.impactFrameEl) {
      this.impactFrameEl = document.createElement('div');
      this.impactFrameEl.id = 'cine-impact-frame';
      this.impactFrameEl.className = 'cine-impact-frame';
      root.appendChild(this.impactFrameEl);
    }

    // Speedlines: canvas 2D sobreposto
    this.speedlinesCanvas = document.getElementById('cine-speedlines');
    if (!this.speedlinesCanvas) {
      this.speedlinesCanvas = document.createElement('canvas');
      this.speedlinesCanvas.id = 'cine-speedlines';
      this.speedlinesCanvas.className = 'cine-speedlines';
      root.appendChild(this.speedlinesCanvas);
    }
    this.speedlinesCtx = this.speedlinesCanvas.getContext('2d');
  }

  setConfig(newConf) {
    if (!newConf) return;
    Object.assign(this.config, newConf);
  }

  setOption(path, value) {
    const parts = path.split('.');
    let curr = this.config;
    for (let i = 0; i < parts.length - 1; i++) {
      curr = curr[parts[i]] ??= {};
    }
    curr[parts[parts.length - 1]] = value;
  }

  getOption(path) {
    const parts = path.split('.');
    let curr = this.config;
    for (const p of parts) {
      if (curr == null) return undefined;
      curr = curr[p];
    }
    return curr;
  }

  resetDefaults() {
    this.config = JSON.parse(JSON.stringify(CINEMATIC_DEFAULTS));
    this.clearAll();
  }

  clearAll() {
    this.snap = null;
    this.fovPunch = null;
    this.impactState = null;
    this.speedlineState = null;
    this.letterboxState = null;
    this.koState = null;
    this.previewActive = null;
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.spring.pos = {x: 0, y: 0, z: 0};
    this.spring.velPos = {x: 0, y: 0, z: 0};
    this.spring.look = {x: 0, y: 0, z: 0};
    this.spring.velLook = {x: 0, y: 0, z: 0};
    this.spring.roll = 0;
    this.spring.velRoll = 0;
    this.spring.fovOffset = 0;
    this.spring.velFov = 0;
    this.target = {posOffset: {x: 0, y: 0, z: 0}, lookOffset: {x: 0, y: 0, z: 0}, roll: 0, fovOffset: 0};
    this.activeEffect = 'none';
    this.renderOverlays();
  }

  // ---------- Processamento de Eventos e Gatilhos ----------

  triggerSnap(posA, posB, normal, {duration = null, angle = null, isClash = false} = {}) {
    if (!this.config.enabled || !this.config.snapParry.enabled) return;
    const dur = duration ?? this.config.snapParry.duration;
    const angDeg = angle ?? this.config.snapParry.angle;
    const dist = this.config.snapParry.distance;
    const mid = scale(add(posA, posB), 0.5);
    const impactPoint = {x: mid.x, y: (posA.y || 0.9) * 0.5 + (posB.y || 0.9) * 0.5, z: mid.z};

    // Vetor lateral a 80-90 graus em relação à normal de choque
    const n = length(normal) > 1e-4 ? normalize(normal) : {x: 1, z: 0};
    const rad = (angDeg * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    let sideDir = {x: n.x * cos - n.z * sin, z: n.x * sin + n.z * cos};

    // Checagem de segurança contra paredes da arena (fallback)
    const arenaBound = (C.test?.arenaHalf ?? 16) - 1.2;
    let testX = impactPoint.x + sideDir.x * dist;
    let testZ = impactPoint.z + sideDir.z * dist;
    if (Math.abs(testX) > arenaBound || Math.abs(testZ) > arenaBound) {
      // Inverte o lado para enquadrar pelo lado livre
      sideDir = scale(sideDir, -1);
      testX = impactPoint.x + sideDir.x * dist;
      testZ = impactPoint.z + sideDir.z * dist;
    }

    const camPos = {
      x: clamp(testX, -arenaBound, arenaBound),
      y: Math.max(0.4, (impactPoint.y || 0.9) + 0.35),
      z: clamp(testZ, -arenaBound, arenaBound)
    };

    this.snap = {
      startedAt: this.clock,
      duration: dur,
      pos: camPos,
      look: impactPoint,
      roll: (isClash ? 0.04 : -0.05) * (this.config.reduceMotion ? 0.2 : 1),
      returnSpeed: this.config.snapParry.returnSpeed,
    };
    this.activeEffect = isClash ? 'clash_snap' : 'parry_snap';
  }

  triggerFovPunch(amount = null, duration = null) {
    if (!this.config.enabled || !this.config.releaseFov.enabled) return;
    this.fovPunch = {
      startedAt: this.clock,
      duration: duration ?? this.config.releaseFov.duration,
      punchFov: (amount ?? this.config.releaseFov.punchFov) * this.config.globalIntensity,
    };
    this.activeEffect = 'fov_punch';
  }

  triggerImpactFrame({whiteDur = null, invertDur = null, strength = null} = {}) {
    if (!this.config.enabled || !this.config.impactFrames.enabled || this.config.noFlash) return;
    this.impactState = {
      phase: 'white',
      startedAt: this.clock,
      whiteDuration: whiteDur ?? this.config.impactFrames.whiteDuration,
      invertDuration: invertDur ?? this.config.impactFrames.invertDuration,
      strength: (strength ?? this.config.impactFrames.flashStrength) * this.config.globalIntensity,
    };
  }

  triggerSpeedlines({duration = null, screenPos = null} = {}) {
    if (!this.config.enabled || !this.config.speedlines.enabled) return;
    this.speedlineState = {
      startedAt: this.clock,
      duration: duration ?? this.config.speedlines.duration,
      x: screenPos?.x ?? 0.5,
      y: screenPos?.y ?? 0.5,
    };
  }

  triggerLetterbox({duration = null, mode = null, pct = null} = {}) {
    if (!this.config.enabled || !this.config.letterbox.enabled) return;
    this.letterboxState = {
      startedAt: this.clock,
      duration: duration ?? this.config.letterbox.duration,
      mode: mode ?? this.config.letterbox.mode,
      pct: pct ?? this.config.letterbox.barPct,
    };
  }

  triggerKoFinish(winnerPos, loserPos) {
    if (!this.config.enabled || !this.config.koCamera.enabled) return;
    const p1 = winnerPos || {x: -1, y: 0.9, z: 0};
    const p2 = loserPos || {x: 1, y: 0.9, z: 0};
    const mid = scale(add(p1, p2), 0.5);
    this.koState = {
      startedAt: this.clock,
      duration: this.config.koCamera.slowDuration * 1.5,
      center: mid,
      roll: (this.config.koCamera.roll * Math.PI) / 180,
      arc: (this.config.koCamera.orbitArc * Math.PI) / 180,
    };
    this.activeEffect = 'ko_finish';
    this.triggerLetterbox({duration: 0.8, pct: 8});
    this.triggerImpactFrame({whiteDur: 0.05, invertDur: 0.05, strength: 0.9});
  }

  triggerKoFinisher(winnerPos, loserPos) {
    return this.triggerKoFinish(winnerPos, loserPos);
  }

  triggerDodgeAngle({dir = 'left', amount = null, duration = 0.28} = {}) {
    if (!this.config.enabled || !this.config.dutchDodge.enabled) return;
    const maxRoll = amount ?? ((this.config.dutchDodge.maxRoll * Math.PI) / 180);
    const sign = dir === 'left' ? -1 : 1;
    this.target.roll = sign * maxRoll * (this.config.reduceMotion ? 0.25 : 1);
    this.activeEffect = 'dutchAngle';
    this.previewActive = 'dutchDodge';
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => {
      this.target.roll = 0;
      this.previewActive = null;
    }, duration * 1000);
  }

  triggerLowSpeed({duration = 0.5, dropHeight = null, zoomIn = null} = {}) {
    if (!this.config.enabled || !this.config.lowSpeed.enabled) return;
    const drop = dropHeight ?? this.config.lowSpeed.dropHeight;
    this.target.posOffset.y = -drop;
    this.activeEffect = 'lowSpeed';
    this.previewActive = 'lowSpeed';
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => {
      this.target.posOffset.y = 0;
      this.previewActive = null;
    }, duration * 1000);
  }

  triggerLateralSnap({targetHeading = 0, isClash = false, duration = null} = {}) {
    const dummyA = {x: -1, y: 0.9, z: 0};
    const dummyB = {x: 1, y: 0.9, z: 0};
    const normal = {x: Math.cos(targetHeading), z: Math.sin(targetHeading)};
    this.triggerSnap(dummyA, dummyB, normal, {isClash, duration});
  }

  triggerChargeBreathing({level = 1, maxCompression = null} = {}) {
    if (!this.config.enabled || !this.config.chargeFov.enabled) return;
    const comp = (maxCompression ?? this.config.chargeFov.maxCompression) * (level >= 2 ? 1.2 : 0.8);
    this.target.fovOffset = -comp;
    this.activeEffect = 'chargeBreathing';
    this.previewActive = 'chargeFov';
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => {
      this.target.fovOffset = 0;
      this.previewActive = null;
    }, 600);
  }

  triggerMeteorContraplongee({impactDrop = null, duration = 0.35} = {}) {
    if (!this.config.enabled || !this.config.meteorSlam.enabled) return;
    const drop = impactDrop ?? this.config.meteorSlam.impactDrop;
    this.target.posOffset.y = -drop;
    this.triggerFovPunch(this.config.meteorSlam.impactFov, duration);
    this.triggerSpeedlines({duration});
    this.activeEffect = 'meteorContraplongee';
    this.previewActive = 'meteorSlam';
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => {
      this.target.posOffset.y = 0;
      this.previewActive = null;
    }, duration * 1000);
  }

  triggerVisualSlowmo({scale = 0.25, duration = 0.2} = {}) {
    if (!this.config.enabled || !this.config.slowMotion.enabled) return;
    this.slowMoState = {
      startedAt: this.clock,
      duration,
      scale: Math.max(0.05, Math.min(1.0, scale))
    };
    this.activeEffect = 'slowMotion';
  }

  getVisualTimeScale() {
    if (!this.config.enabled || !this.slowMoState) return 1.0;
    const elapsed = this.clock - this.slowMoState.startedAt;
    if (elapsed >= this.slowMoState.duration) {
      this.slowMoState = null;
      return 1.0;
    }
    return this.slowMoState.scale;
  }

  setAccessibility({cameraShake = true, flashReduce = false, reduceMotion = false} = {}) {
    if (flashReduce !== undefined) this.config.noFlash = !!flashReduce;
    if (reduceMotion !== undefined) this.config.reduceMotion = !!reduceMotion;
  }

  reset() {
    this.clearAll();
  }

  update(dt = 1 / 60, events = [], fighters = []) {
    const dummyPose = {
      position: {x: 0, y: 3, z: 8},
      height: 3,
      lookAt: {x: 0, y: 1, z: 0},
      lookHeight: 1,
      roll: 0,
      fov: 48,
      yaw: 0,
      pitch: 0,
      dist: 8
    };
    return this.apply(dummyPose, fighters, events, dt);
  }

  // ---------- Prévia de Efeitos Individuais na Interface ----------

  previewEffect(id) {
    this.clearAll();
    const prevEnabled = this.config.enabled;
    this.config.enabled = true;
    this.previewActive = id;

    const dummyPlayer = {position: {x: -1.2, y: 0, z: 0}, desiredMove: {x: 1, z: 0}, action: null};
    const dummyEnemy = {position: {x: 1.2, y: 0, z: 0}, desiredMove: {x: -1, z: 0}, action: null};

    switch (id) {
      case 'dutchDodge':
        this.target.roll = (this.config.dutchDodge.maxRoll * Math.PI) / 180;
        this.previewTimer = setTimeout(() => { this.target.roll = 0; }, (this.config.dutchDodge.duration * 1000) || 300);
        break;
      case 'lowSpeed':
        this.target.posOffset.y = -this.config.lowSpeed.dropHeight;
        this.previewTimer = setTimeout(() => { this.target.posOffset.y = 0; }, 600);
        break;
      case 'snapParry':
        this.triggerSnap(dummyPlayer.position, dummyEnemy.position, {x: 1, z: 0}, {isClash: false});
        this.triggerLetterbox({duration: 0.35});
        break;
      case 'chargeFov':
        this.target.fovOffset = -this.config.chargeFov.maxCompression;
        this.previewTimer = setTimeout(() => { this.target.fovOffset = 0; }, 800);
        break;
      case 'releaseFov':
        this.triggerFovPunch();
        this.triggerSpeedlines();
        break;
      case 'meteorSlam':
        this.target.posOffset.y = -this.config.meteorSlam.impactDrop;
        this.triggerFovPunch(this.config.meteorSlam.impactFov, 0.3);
        this.triggerSpeedlines();
        this.previewTimer = setTimeout(() => { this.target.posOffset.y = 0; }, 400);
        break;
      case 'koCamera':
        this.triggerKoFinish(dummyPlayer.position, dummyEnemy.position);
        break;
      case 'impactFrames':
        this.triggerImpactFrame({whiteDur: 0.06, invertDur: 0.06, strength: 1.0});
        break;
      case 'speedlines':
        this.triggerSpeedlines({duration: 0.45});
        break;
      case 'letterbox':
        this.triggerLetterbox({duration: 0.6});
        break;
      case 'slowMotion':
        this.triggerSnap(dummyPlayer.position, dummyEnemy.position, {x: 1, z: 0});
        this.triggerLetterbox({duration: 0.4});
        break;
    }

    if (this.previewTimer) {
      const origTimer = this.previewTimer;
      this.previewTimer = setTimeout(() => {
        this.previewActive = null;
        this.config.enabled = prevEnabled;
      }, 1000);
    }
  }

  // ---------- Aplicação por Quadro (Camada de Apresentação) ----------

  apply(basePose, fighters = [], events = [], dt = 1 / 60, {camera = null, paused = false, tick = 0} = {}) {
    this.clock += paused ? 0 : dt;
    this.time += dt;

    if (!this.config.enabled) {
      this.clearAll();
      return basePose;
    }

    if (!this.initialized && basePose?.position) {
      this.spring.pos = {x: basePose.position.x, y: basePose.height ?? basePose.position.y ?? 3, z: basePose.position.z};
      this.spring.look = {x: basePose.lookAt.x, y: basePose.lookHeight ?? basePose.lookAt.y ?? 1, z: basePose.lookAt.z};
      this.initialized = true;
    }

    const p1 = fighters[0], p2 = fighters[1];
    const gi = Math.max(0, this.config.globalIntensity);

    // 1. Escanear eventos reais da simulação
    if (!paused && events?.length) {
      for (const ev of events) {
        if (this.lastEventsSeen.has(ev)) continue;
        this.lastEventsSeen.add(ev);

        const atk = fighters[ev.attacker], tgt = fighters[ev.target];
        const hasBoth = atk && tgt;

        if (ev.result === 'perfect') {
          // Defesa Perfeita (Parry)
          if (hasBoth) this.triggerSnap(atk.position, tgt.position, ev.normal || sub(tgt.position, atk.position), {isClash: false});
          this.triggerLetterbox({duration: 0.35});
          this.triggerImpactFrame({whiteDur: 0.035, invertDur: 0.035, strength: 0.85});
          this.triggerSpeedlines({duration: 0.22});
        } else if (ev.result === 'clash' || ev.result === 'tackleClash' || ev.result === 'stoneClash') {
          // Clash entre tackles
          if (hasBoth) this.triggerSnap(atk.position, tgt.position, ev.normal || sub(tgt.position, atk.position), {isClash: true});
          this.triggerLetterbox({duration: 0.42});
          this.triggerImpactFrame({whiteDur: 0.04, invertDur: 0.04, strength: 0.95});
          this.triggerSpeedlines({duration: 0.25});
        } else if (ev.result === 'impact') {
          // Impacto pesado / Meteor Slam
          const isHeavy = (ev.damage ?? 0) >= 15 || !!ev.slam || (ev.pl ?? 1) >= 3;
          if (isHeavy) {
            this.triggerFovPunch(this.config.releaseFov.punchFov * 0.8, 0.2);
            this.triggerLetterbox({duration: 0.3});
            this.triggerImpactFrame({whiteDur: 0.03, invertDur: 0.03, strength: 0.7});
            this.triggerSpeedlines({duration: 0.18});
          }
        } else if (ev.result === 'chargeRelease') {
          // Disparo de golpe carregado
          this.triggerFovPunch();
          this.triggerSpeedlines();
        }
      }
    }

    // 2. Escanear K.O. e Finalização
    if (p1 && p2 && (p1.hp <= 0 || p2.hp <= 0) && !this.koState) {
      const winner = p1.hp > 0 ? p1 : p2;
      const loser = p1.hp <= 0 ? p1 : p2;
      this.triggerKoFinish(winner.position, loser.position);
    }

    // 3. Resetar alvos instantâneos da cena
    let targetPos = {x: basePose.position.x, y: basePose.height, z: basePose.position.z};
    let targetLook = {x: basePose.lookAt.x, y: basePose.lookHeight, z: basePose.lookAt.z};
    let targetRoll = 0;
    let targetFovOffset = 0;
    let currentPriority = 0; // 0=normal, 10=dodge, 20=speed, 30=charge, 40=fovPunch, 50=snap, 60=ko

    // C01 — Dutch Angle na esquiva do jogador
    if (this.config.dutchDodge.enabled && p1?.action?.kind === 'dodge' && !this.previewActive) {
      currentPriority = Math.max(currentPriority, 10);
      const camYaw = this.view?.rig?.yaw ?? 0;
      const heading = p1.action.heading ?? p1.facing ?? 0;
      const moveRel = angleDelta(camYaw + Math.PI, heading);
      // Componente lateral em relação ao ângulo da câmera
      const side = Math.sin(moveRel);
      const maxRoll = (this.config.dutchDodge.maxRoll * Math.PI) / 180;
      targetRoll = -side * maxRoll * (this.config.reduceMotion ? 0.25 : 1) * gi;
      this.activeEffect = 'dodge_tilt';
    }

    // C02 — Câmera baixa de velocidade em Sprint e Tackle
    if (this.config.lowSpeed.enabled && p1 && !this.previewActive) {
      const isSprint = p1.state === 'sprint' || !!p1.sprintActive;
      const isTackle = p1.action?.kind === 'tackle' && p1.action.elapsed < (p1.action.duration || 0.4) * 0.7;
      if (isSprint || isTackle) {
        currentPriority = Math.max(currentPriority, 20);
        const drop = this.config.lowSpeed.dropHeight * gi;
        const zoom = this.config.lowSpeed.zoomIn * gi;
        targetPos.y = Math.max(0.35, targetPos.y - drop);
        targetLook.y += this.config.lowSpeed.pitchUp * gi;
        // Aproximação suave ao longo da linha de visão
        const toLook = norm3(sub3(targetLook, targetPos));
        targetPos = add3(targetPos, scale3(toLook, zoom));
        this.activeEffect = isSprint ? 'sprint_low' : 'tackle_low';
      }
    }

    // C04 — Respiração de FOV na carga
    if (this.config.chargeFov.enabled && p1?.charge && !this.previewActive) {
      currentPriority = Math.max(currentPriority, 30);
      const maxTicks = p1.charge.params?.maxTicks ?? 180;
      const progress = clamp((p1.charge.ticks ?? 0) / Math.max(1, maxTicks), 0, 1);
      const ease = progress * progress * (3 - 2 * progress); // smoothstep
      targetFovOffset -= this.config.chargeFov.maxCompression * ease * gi;
      this.activeEffect = 'charge_breath';
    }

    // C05 — FOV Punch no Disparo
    if (this.fovPunch) {
      const elapsed = this.clock - this.fovPunch.startedAt;
      if (elapsed >= this.fovPunch.duration) {
        this.fovPunch = null;
      } else {
        currentPriority = Math.max(currentPriority, 40);
        const k = elapsed / Math.max(1e-4, this.fovPunch.duration);
        const envelope = Math.pow(1 - k, 2.2);
        targetFovOffset += this.fovPunch.punchFov * envelope;
      }
    }

    // C03 — Snap lateral na Defesa Perfeita / Clash
    if (this.snap) {
      const elapsed = this.clock - this.snap.startedAt;
      if (elapsed >= this.snap.duration) {
        this.snap = null;
      } else {
        currentPriority = Math.max(currentPriority, 50);
        const k = elapsed / Math.max(1e-4, this.snap.duration);
        const hold = k < 0.65 ? 1 : Math.cos((k - 0.65) / 0.35 * Math.PI * 0.5);
        targetPos = add3(targetPos, scale3(sub3(this.snap.pos, targetPos), hold));
        targetLook = add3(targetLook, scale3(sub3(this.snap.look, targetLook), hold));
        targetRoll = this.snap.roll * hold * gi;
      }
    }

    // C07 — K.O. e Finalização
    if (this.koState) {
      const elapsed = this.clock - this.koState.startedAt;
      if (elapsed >= this.koState.duration) {
        this.koState = null;
      } else {
        currentPriority = Math.max(currentPriority, 60);
        const k = elapsed / Math.max(1e-4, this.koState.duration);
        const angle = this.koState.arc * Math.sin(k * Math.PI * 0.5);
        targetRoll = this.koState.roll * (1 - k * 0.5) * gi;
        targetPos.y = Math.max(0.3, targetPos.y - this.config.koCamera.dropHeight * (1 - k * 0.3));
      }
    }

    // Se estiver em prévia manual
    if (this.previewActive) {
      targetRoll = this.target.roll;
      targetPos.y += this.target.posOffset.y;
      targetFovOffset += this.target.fovOffset;
    }

    // 4. Integração da Mola de Inércia (C12 — Inércia e Amortecimento)
    const kStiff = this.config.springInertia.stiffness;
    const kDamp = this.config.springInertia.damping;
    const stepDt = Math.min(dt, 0.05);

    // Mola de posição
    const posDiff = sub3(targetPos, this.spring.pos);
    this.spring.velPos.x += (posDiff.x * kStiff - this.spring.velPos.x * kDamp) * stepDt;
    this.spring.velPos.y += (posDiff.y * kStiff - this.spring.velPos.y * kDamp) * stepDt;
    this.spring.velPos.z += (posDiff.z * kStiff - this.spring.velPos.z * kDamp) * stepDt;
    this.spring.pos.x += this.spring.velPos.x * stepDt;
    this.spring.pos.y += this.spring.velPos.y * stepDt;
    this.spring.pos.z += this.spring.velPos.z * stepDt;

    // Mola de ponto focal
    const lookDiff = sub3(targetLook, this.spring.look);
    this.spring.velLook.x += (lookDiff.x * kStiff - this.spring.velLook.x * kDamp) * stepDt;
    this.spring.velLook.y += (lookDiff.y * kStiff - this.spring.velLook.y * kDamp) * stepDt;
    this.spring.velLook.z += (lookDiff.z * kStiff - this.spring.velLook.z * kDamp) * stepDt;
    this.spring.look.x += this.spring.velLook.x * stepDt;
    this.spring.look.y += this.spring.velLook.y * stepDt;
    this.spring.look.z += this.spring.velLook.z * stepDt;

    // Mola de Roll
    const rollDiff = targetRoll - this.spring.roll;
    this.spring.velRoll += (rollDiff * (kStiff * 0.8) - this.spring.velRoll * kDamp) * stepDt;
    this.spring.roll += this.spring.velRoll * stepDt;
    const maxRollLimit = this.config.springInertia.maxRollRad;
    this.spring.roll = clamp(this.spring.roll, -maxRollLimit, maxRollLimit);

    // Mola de FOV
    const fovDiff = targetFovOffset - this.spring.fovOffset;
    this.spring.velFov += (fovDiff * (kStiff * 1.2) - this.spring.velFov * kDamp) * stepDt;
    this.spring.fovOffset += this.spring.velFov * stepDt;

    // Efeito de chão seguro: a câmera nunca deve penetrar o solo
    const safeY = Math.max(0.2, this.spring.pos.y);

    // 5. Renderizar sobreposições visuais (Impact Frames, Speedlines, Letterbox)
    this.renderOverlays(camera);

    if (currentPriority === 0 && !this.previewActive && !this.snap && !this.koState) {
      this.activeEffect = 'normal';
    }

    const baseFov = C.extras?.cameraExtra?.fov ?? 48;
    return {
      position: {x: this.spring.pos.x, y: safeY, z: this.spring.pos.z},
      height: safeY,
      lookAt: {x: this.spring.look.x, y: this.spring.look.y, z: this.spring.look.z},
      lookHeight: this.spring.look.y,
      roll: this.spring.roll,
      fov: clamp(baseFov + this.spring.fovOffset, 25, 85),
    };
  }

  // ---------- Renderização de Overlays de Apresentação (2D) ----------

  renderOverlays(camera = null) {
    if (typeof document === 'undefined') return;

    // A. Letterbox
    if (this.letterboxEl) {
      if (this.config.enabled && this.letterboxState) {
        const elapsed = this.clock - this.letterboxState.startedAt;
        if (elapsed >= this.letterboxState.duration) {
          this.letterboxState = null;
          this.letterboxEl.style.opacity = '0';
        } else {
          const k = elapsed / Math.max(1e-4, this.letterboxState.duration);
          const env = Math.sin(k * Math.PI);
          const pct = this.letterboxState.mode === 'cinema' ? 12 : (this.letterboxState.pct || 6);
          this.letterboxEl.style.opacity = '1';
          const topBar = this.letterboxEl.querySelector('.cine-bar-top');
          const botBar = this.letterboxEl.querySelector('.cine-bar-bottom');
          const curH = pct * env;
          if (topBar) topBar.style.height = `${curH}%`;
          if (botBar) botBar.style.height = `${curH}%`;
        }
      } else {
        this.letterboxEl.style.opacity = '0';
      }
    }

    // B. Impact Frames
    if (this.impactFrameEl) {
      if (this.config.enabled && !this.config.noFlash && this.impactState) {
        const elapsed = this.clock - this.impactState.startedAt;
        const totalDur = this.impactState.whiteDuration + this.impactState.invertDuration + 0.08;
        if (elapsed >= totalDur) {
          this.impactState = null;
          this.impactFrameEl.style.opacity = '0';
          if (this.canvas) this.canvas.style.filter = '';
        } else if (elapsed < this.impactState.whiteDuration) {
          // Fase 1: Silhueta branca
          this.impactFrameEl.style.opacity = String(this.impactState.strength);
          this.impactFrameEl.style.background = '#ffffff';
          if (this.canvas) this.canvas.style.filter = 'contrast(2.5) brightness(1.8)';
        } else if (elapsed < this.impactState.whiteDuration + this.impactState.invertDuration) {
          // Fase 2: Inversão negativa
          this.impactFrameEl.style.opacity = String(this.impactState.strength * 0.7);
          this.impactFrameEl.style.background = '#000000';
          if (this.canvas) this.canvas.style.filter = 'invert(1) hue-rotate(180deg) contrast(2)';
        } else {
          // Fase 3: Decaimento
          const decay = 1 - (elapsed - this.impactState.whiteDuration - this.impactState.invertDuration) / 0.08;
          this.impactFrameEl.style.opacity = String(Math.max(0, this.impactState.strength * decay * 0.4));
          this.impactFrameEl.style.background = '#ffffff';
          if (this.canvas) this.canvas.style.filter = '';
        }
      } else {
        this.impactFrameEl.style.opacity = '0';
        if (this.canvas && !this.canvas.style.filter?.includes('blur')) {
          this.canvas.style.filter = '';
        }
      }
    }

    // C. Speedlines radiais (Canvas 2D)
    if (this.speedlinesCanvas && this.speedlinesCtx) {
      const cv = this.speedlinesCanvas;
      const w = cv.clientWidth || 300, h = cv.clientHeight || 200;
      if (cv.width !== w || cv.height !== h) {
        cv.width = w; cv.height = h;
      }
      this.speedlinesCtx.clearRect(0, 0, w, h);

      if (this.config.enabled && this.speedlineState) {
        const elapsed = this.clock - this.speedlineState.startedAt;
        if (elapsed >= this.speedlineState.duration) {
          this.speedlineState = null;
        } else {
          const k = elapsed / Math.max(1e-4, this.speedlineState.duration);
          const alpha = Math.sin(k * Math.PI) * (this.config.speedlines.opacity || 0.65);
          const cx = (this.speedlineState.x || 0.5) * w;
          const cy = (this.speedlineState.y || 0.5) * h;
          const count = this.config.speedlines.count || 28;
          const maxR = Math.hypot(w, h);
          const innerR = Math.min(w, h) * 0.22;

          this.speedlinesCtx.save();
          this.speedlinesCtx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          this.speedlinesCtx.lineWidth = this.config.speedlines.width || 2;
          for (let i = 0; i < count; i++) {
            const angle = (i * Math.PI * 2) / count + (i % 2 ? 0.08 : -0.05);
            const r1 = innerR + (Math.sin(i * 3.7 + this.clock * 20) * 0.5 + 0.5) * 60;
            const r2 = maxR;
            const x1 = cx + Math.cos(angle) * r1, y1 = cy + Math.sin(angle) * r1;
            const x2 = cx + Math.cos(angle) * r2, y2 = cy + Math.sin(angle) * r2;
            this.speedlinesCtx.beginPath();
            this.speedlinesCtx.moveTo(x1, y1);
            this.speedlinesCtx.lineTo(x2, y2);
            this.speedlinesCtx.stroke();
          }
          this.speedlinesCtx.restore();
        }
      }
    }
  }
}
