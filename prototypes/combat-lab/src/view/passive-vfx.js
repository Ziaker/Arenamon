// @ts-check
// VFX de ativação de passivas (§16) — reutiliza o PassiveFx das Propostas A/B/C já desenvolvido
// (branch feature/hud-ativacao-passivas-propostas-abc: malhas instanciadas, anéis orbitais, feixes
// prismáticos, ondas concêntricas, luzes com pool e estatísticas). Este wrapper conecta o sistema
// existente ao contrato do jogo: evento `passiveActivated` → variante configurada em C.vfx.passive
// (0=A Orbital Halo · 1=B Celestial Intersections · 2=C Luminous Resonance), sliders de
// intensidade/tamanho/opacidade/duração/sparkles e o mestre de acessibilidade (reduceMotion/noFlash).
// Só aparência: nada aqui altera regras, tempos da simulação ou cooldowns.
import {C} from '../sim/config.js';
import {PassiveFx} from './vfx/effects/passives.js';

export class PassiveVfx {
  /** @param {import('three').Scene} scene */
  constructor(scene) {
    this.fx = new PassiveFx(scene);
  }
  /**
   * Dispara efeitos para eventos de passivas deste passo.
   * @param {Array<any>} events eventos do passo (game.lastStepEvents)
   * @param {Array<any>} fighters lutadores (posição atual)
   */
  onEvents(events, fighters) {
    const V = C.vfx?.passive, M = C.vfx?.master;
    if (!V?.enabled || !events?.length) return;
    for (const e of events) {
      if (e.result !== 'passiveActivated' || e.attacker == null) continue;
      const f = fighters[e.attacker];
      if (f) this.spawn(f);
    }
  }
  /** Cria a variante configurada em volta do lutador. */
  spawn(f) {
    const V = C.vfx.passive, M = C.vfx.master;
    const variant = V.variant ?? 0;
    const reduce = !!M?.reduceMotion;
    if (reduce && variant !== 2) return;                 // movimento reduzido: só a variante mais estática (C) permanece
    const size = V.size ?? 1, intensity = V.intensity ?? 1;
    const opacity = Math.min(1, (V.opacity ?? 1) * intensity * (M?.noFlash ? .45 : 1));
    const dur = (V.duration ?? 1) * (reduce ? .5 : 1);
    const quality = (V.sparkles ?? 1) > 0 ? 1 : 0;         // sparkles 0 ⇒ partículas mínimas
    const pos = {x: f.position.x, y: f.groundY ?? 0, z: f.position.z};
    const kind = variant === 1 ? 'B' : variant === 2 ? 'C' : 'A';
    if (kind === 'A') this.fx.spawnOrbitalHalo(pos, {radius: 1.2 * size, opacity, duration: 3.5 * dur, quality, orbitSpeed: reduce ? .8 : 2.5});
    else if (kind === 'B') this.fx.spawnCelestialIntersections(pos, {beamLength: 2.5 * size, opacity, duration: 2.8 * dur, quality, rotationSpeed: reduce ? .4 : 1.2});
    else this.fx.spawnLuminousResonance(pos, {waveRadius: 2.5 * size, opacity, duration: 2.5 * dur, quality, pulseSpeed: reduce ? .5 : 2, waveCount: reduce ? 2 : 4});
  }
  /** Avança os efeitos vivos (chamar a cada quadro renderizado). */
  update(dt) {this.fx.update(dt);}
  clear() {this.fx.reset();}
}
