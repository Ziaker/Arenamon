// Câmera e feedback de tela — perfis declarativos.
// Combina shake translacional, angular, zoom punch, freeze exclusivamente visual,
// flash, vinheta, saturação e blur (quando suportados). Nunca afeta a simulação.

// Perfis declarativos por tipo de evento.
// Cada perfil especifica quais efeitos aplicar e com que intensidade (0..1).
export const CAMERA_PROFILES = Object.freeze({
  lightHit: {
    shake: {translational: 0.35, angular: 0.1, duration: 0.12, frequency: 26},
    zoomPunch: 0.06,
    flash: {strength: 0.15, duration: 0.08},
    vignette: 0.05,
    saturation: 0,
    blur: 0,
    freeze: 0,
  },
  heavyHit: {
    shake: {translational: 0.7, angular: 0.25, duration: 0.22, frequency: 22},
    zoomPunch: 0.12,
    flash: {strength: 0.35, duration: 0.14},
    vignette: 0.12,
    saturation: -0.15,
    blur: 0,
    freeze: 0.04,
  },
  perfectBlock: {
    shake: {translational: 0.2, angular: 0.05, duration: 0.1, frequency: 30},
    zoomPunch: 0.04,
    flash: {strength: 0.5, duration: 0.1},
    vignette: 0,
    saturation: 0.2,
    blur: 0,
    freeze: 0.07,
  },
  clash: {
    shake: {translational: 0.9, angular: 0.35, duration: 0.3, frequency: 18},
    zoomPunch: 0.16,
    flash: {strength: 0.6, duration: 0.18},
    vignette: 0.18,
    saturation: 0,
    blur: 0.1,
    freeze: 0.08,
  },
  landing: {
    shake: {translational: 0.25, angular: 0.05, duration: 0.14, frequency: 20},
    zoomPunch: 0.05,
    flash: {strength: 0.1, duration: 0.06},
    vignette: 0.03,
    saturation: 0,
    blur: 0,
    freeze: 0,
  },
  wall: {
    shake: {translational: 0.4, angular: 0.15, duration: 0.18, frequency: 24},
    zoomPunch: 0.08,
    flash: {strength: 0.2, duration: 0.1},
    vignette: 0.08,
    saturation: 0,
    blur: 0,
    freeze: 0.03,
  },
  finisher: {
    shake: {translational: 1.1, angular: 0.5, duration: 0.4, frequency: 14},
    zoomPunch: 0.2,
    flash: {strength: 0.8, duration: 0.25},
    vignette: 0.3,
    saturation: -0.3,
    blur: 0.2,
    freeze: 0.12,
  },
});

// Estado de feedback de câmera (somente apresentação).
export class CameraFeedback {
  constructor({canvas = null, flashEl = null, enabled = true} = {}) {
    this.canvas = canvas;
    this.flashEl = flashEl;
    this.enabled = enabled;
    this.shakes = []; // {t, power, dir, phase, profile}
    this.flash = null; // {t, d, strength, color, x, y}
    this.filterUntil = 0;
    this.filterCss = '';
    this.freezeUntil = 0;
    this.zoomPunch = 0; // multiplicador de FOV visual temporário
    this.vignette = 0;
    this.accessibility = {
      globalIntensity: 1.0,
      noFlash: false,
      noShake: false,
      noBlur: false,
      preferReducedMotion: false,
    };
    // Limites de brilho/frequência de flashes (acessibilidade).
    this.flashHistory = []; // {time, strength}
    this.maxFlashLuminance = 1.0;
    this.maxFlashesPerSecond = 3;
  }
  setAccessibility({globalIntensity, noFlash, noShake, noBlur, preferReducedMotion} = {}) {
    if (globalIntensity != null) this.accessibility.globalIntensity = Math.max(0, Math.min(2, globalIntensity));
    if (noFlash != null) this.accessibility.noFlash = noFlash;
    if (noShake != null) this.accessibility.noShake = noShake;
    if (noBlur != null) this.accessibility.noBlur = noBlur;
    if (preferReducedMotion != null) this.accessibility.preferReducedMotion = preferReducedMotion;
  }
  // Aplica um perfil de câmera para um tipo de evento.
  applyProfile(name, {power = 1, time = performance.now() / 1000} = {}) {
    if (!this.enabled) return;
    const profile = CAMERA_PROFILES[name];
    if (!profile) return;
    const gi = this.accessibility.globalIntensity;
    const p = Math.max(0, Math.min(2, power * gi));
    // Reduzido de movimento: desligar tremor e intensificar leitura estática.
    if (this.accessibility.preferReducedMotion) {
      // sem shake, sem freeze, sem blur
    } else {
      if (!this.accessibility.noShake && profile.shake) {
        this.shakes.push({
          t: 0, power: p * profile.shake.translational,
          angular: p * profile.shake.angular, duration: profile.shake.duration,
          frequency: profile.shake.frequency, phase: Math.random() * 100,
        });
      }
      if (profile.freeze && profile.freeze > 0) this.freezeUntil = time + profile.freeze * p;
    }
    if (!this.accessibility.noFlash && profile.flash && profile.flash.strength > 0) {
      if (this.canFlash(time)) {
        this.flash = {
          t: 0, d: profile.flash.duration * p,
          strength: Math.min(this.maxFlashLuminance, profile.flash.strength * p),
          color: 0xffffff, x: 50, y: 50,
        };
        this.recordFlash(time, this.flash.strength);
      }
    }
    if (profile.zoomPunch && profile.zoomPunch > 0) this.zoomPunch = p * profile.zoomPunch;
    this.vignette = Math.max(this.vignette, p * (profile.vignette || 0));
    if (!this.accessibility.noBlur && profile.blur && profile.blur > 0) {
      this.filterCss = `blur(${p * profile.blur * 2}px)`;
      this.filterUntil = time + 0.15 * p;
    }
    if (profile.saturation !== 0) {
      const sat = 1 + p * profile.saturation;
      this.filterCss = (this.filterCss ? this.filterCss + ' ' : '') + `saturate(${Math.max(0, sat)})`;
      this.filterUntil = time + 0.3 * p;
    }
  }
  canFlash(time) {
    // Limitar frequência e luminância de flashes.
    const cutoff = time - 1;
    this.flashHistory = this.flashHistory.filter(f => f.time > cutoff);
    const recent = this.flashHistory.reduce((sum, f) => sum + f.strength, 0);
    if (recent >= this.maxFlashesPerSecond) return false;
    return true;
  }
  recordFlash(time, strength) {
    this.flashHistory.push({time, strength});
    if (this.flashHistory.length > 50) this.flashHistory.shift();
  }
  // Atualiza o estado de feedback a cada quadro. Retorna o deslocamento de câmera.
  update(dt, time = performance.now() / 1000, camera = null) {
    if (!this.enabled) return {x: 0, y: 0, z: 0, roll: 0, zoomPunch: 0, vignette: 0, freeze: 0, filter: ''};
    let x = 0, y = 0, z = 0, roll = 0;
    for (const s of this.shakes) {
      s.t += dt;
      if (s.t > s.duration) { s.dead = true; continue; }
      const k = s.t / Math.max(1e-6, s.duration);
      const env = Math.pow(1 - k, 2.5);
      const w = s.frequency * Math.PI * 2;
      const A = s.power;
      let ox = 0, oy = 0, oz = 0;
      ox = (Math.sin(s.t * w + s.phase) + 0.5 * Math.sin(s.t * w * 2.3 + s.phase * 2)) * A * env;
      oy = Math.sin(s.t * w * 1.3 + s.phase * 3) * A * env;
      oz = Math.cos(s.t * w * 0.9 + s.phase) * A * env * 0.6;
      x += ox; y += oy; z += oz;
      roll += s.angular * 0.25 * (ox + oy);
    }
    this.shakes = this.shakes.filter(s => !s.dead);
    // Limitar tremor.
    const m = Math.hypot(x, y, z);
    if (m > 0.45) { x *= 0.45 / m; y *= 0.45 / m; z *= 0.45 / m; }
    roll = Math.max(-0.08, Math.min(0.08, roll));
    // Flash.
    if (this.flash) {
      this.flash.t += dt;
      const k = this.flash.t / Math.max(1e-6, this.flash.d);
      if (k >= 1) this.flash = null;
    }
    // Filtro de tela.
    if (this.filterUntil !== 0 && time >= this.filterUntil) {
      this.filterCss = '';
      this.filterUntil = 0;
    }
    // Decaimento de vinheta.
    this.vignette = Math.max(0, this.vignette - dt * 2);
    // Decaimento de zoom punch.
    this.zoomPunch = Math.max(0, this.zoomPunch - dt * 4);
    return {
      x, y, z, roll,
      zoomPunch: this.zoomPunch,
      vignette: this.vignette,
      freeze: this.freezeUntil > time ? Math.min(1, (this.freezeUntil - time) / 0.15) : 0,
      flash: this.flash ? {strength: this.flash.strength * (1 - this.flash.t / Math.max(1e-6, this.flash.d)), x: this.flash.x, y: this.flash.y} : null,
      filter: this.filterCss,
    };
  }
  // Desenha o flash no elemento DOM (se houver).
  renderFlash() {
    if (!this.flashEl || this.accessibility.noFlash || !this.flash) {
      if (this.flashEl) this.flashEl.style.opacity = '0';
      return;
    }
    const k = this.flash.t / Math.max(1e-6, this.flash.d);
    this.flashEl.style.opacity = String(Math.max(0, this.flash.strength * (1 - k) * (1 - k)));
    this.flashEl.style.background = `radial-gradient(circle at ${this.flash.x}% ${this.flash.y}%, rgba(255,255,255,1) 0%, rgba(255,255,255,0.35) 22%, rgba(0,0,0,0) 60%)`;
  }
  // Aplicar filtro de tela (canvas).
  renderFilter() {
    if (!this.canvas) return;
    if (this.filterUntil !== 0 && performance.now() / 1000 < this.filterUntil) {
      this.canvas.style.filter = this.filterCss;
    } else {
      this.canvas.style.filter = '';
    }
  }
  reset() {
    this.shakes = [];
    this.flash = null;
    this.filterCss = '';
    this.filterUntil = 0;
    this.freezeUntil = 0;
    this.zoomPunch = 0;
    this.vignette = 0;
    if (this.canvas) this.canvas.style.filter = '';
    if (this.flashEl) this.flashEl.style.opacity = '0';
  }
}
