// @ts-check
// Síntese procedural de áudio 100% offline via Web Audio API nativa (zero KB baixados, zero dependências externas).
// Produz efeitos táteis e responsivos para golpes, bloqueios, parries, cargas de Moves, estilhaços e K.O.

class SoundFX {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;

      // Restaura preferência salva
      try {
        const saved = localStorage.getItem('arenamon-sound-enabled');
        if (saved !== null) this.enabled = saved === 'true';
      } catch {}
    } catch (e) {
      console.warn('Web Audio indisponível:', e);
    }
  }

  ensureContext() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggle() {
    this.ensureContext();
    this.enabled = !this.enabled;
    try {
      localStorage.setItem('arenamon-sound-enabled', String(this.enabled));
    } catch {}
    return this.enabled;
  }

  /**
   * Impacto de golpe (hit normal, bloqueio, parry metálico ou clash).
   */
  playHit({blocked = false, parry = false, clash = false, heavy = false} = {}) {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    if (parry) {
      // Parry metálico brilhante (duplo oscilador harmônico agudo + decaimento de sino)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(1480, t);
      osc2.frequency.setValueAtTime(2220, t);

      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.45);
      osc2.stop(t + 0.45);
      return;
    }

    if (clash) {
      // Clash de corpos/tackle: estalo de faísca + corpo metálico
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.15);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.2);
      return;
    }

    if (blocked) {
      // Bloqueio abafado (low-pass filter pesado + tom grave)
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, t);

      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.22);
      return;
    }

    // Impacto normal / pesado de golpe (punchy sine + ruído percussivo)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const startFreq = heavy ? 180 : 260;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.18);

    gain.gain.setValueAtTime(heavy ? 0.6 : 0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  /**
   * Zunido de esquiva ágil (whoosh descendente).
   */
  playDodge() {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.14);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, t);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.14);
  }

  /**
   * Ativação de passiva (§16): sino curto 100% procedural com 3 variações de pitch (variantes A/B/C do VFX).
   */
  playPassive(variant = 0) {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const base = [740, 880, 990][((variant % 3) + 3) % 3] || 820;
    const osc = this.ctx.createOscillator(), osc2 = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = 'sine';osc.frequency.setValueAtTime(base, t);
    osc2.type = 'sine';osc2.frequency.setValueAtTime(base * 1.5, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);osc2.connect(gain);gain.connect(this.masterGain);
    osc.start(t);osc.stop(t + 0.35);osc2.start(t);osc2.stop(t + 0.35);
  }

  /**
   * Carga de Move subindo de nível (PL1 -> PL2 -> PL3).
   */
  playCharge(pl = 1) {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    const freqs = [0, 480, 680, 920];
    const freq = freqs[Math.min(3, pl)] || 520;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.8, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.12);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.2);
  }

  /**
   * Som de barreira quebrando / fragmentando.
   */
  playBarrierShatter() {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    // Dois pulsos de frequência alta descendente simulando vidro/cristal estilhaçando
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(900 + i * 350, t + i * 0.03);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.22 + i * 0.04);

      gain.gain.setValueAtTime(0.2, t + i * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25 + i * 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + i * 0.03);
      osc.stop(t + 0.3);
    }
  }

  /**
   * Som de exaustão de stamina.
   */
  playExhaust() {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.35);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.4);
  }

  /**
   * Efeito dramático de K.O. (baixo profundo + eco).
   */
  playKo() {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.7);

    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.85);
  }

  playChargeLevel(pl = 1) { this.playCharge(pl); }
  playChargeRelease(level = 1) { this.playCharge(level); }
  playHeavyHit() { this.playHit({heavy: true}); }
  playBlock() { this.playHit({blocked: true}); }
  playParry() { this.playHit({parry: true}); }
  playClash() { this.playHit({clash: true}); }
  playBarrierBreak() { this.playBarrierShatter(); }
  playExhaustion() { this.playExhaust(); }
}

export const soundFx = new SoundFX();
