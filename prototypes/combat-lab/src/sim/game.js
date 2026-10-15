// Ciclo de partida de passo fixo (120 Hz), igual ao v6, mais estado serializável para replay e cenários.
import {C} from './config.js';
import {Brain} from './ai.js';
import {createFighter, emptyCommand, isInvulnerable} from './entity.js';
import {updateFighter, advanceAction, bufferDuringHitstop} from './controller.js';
import {stepPhysics} from './physics.js';
import {vec} from './math.js';

const finishingNow = g => g.phase === 'finishing';
export class Game {
  constructor({seed = 1} = {}) {
    this.brain = new Brain(seed, 'aiRed');this.playerBrain = new Brain(seed + 1, 'aiBlue');
    this.mode = 'combat';this.profile = 'balanced';this.enemyProfile = 'balanced';
    this.reset();this.phase = 'menu';
  }
  reset({positions = [vec(0, -4), vec(0, 2)]} = {}) {
    this.fighters = [createFighter(0, C.profiles[this.profile] || C.profiles.balanced, {...positions[0]}), createFighter(1, C.profiles[this.enemyProfile] || C.profiles.balanced, {...positions[1]})];
    this.brain.reset();this.playerBrain.reset();
    this.tick = 0;this.events = [];this.winner = null;this.hitstop = 0;this.phase = 'playing';this.lastStepEvents = [];
  }
  pause() {if (this.phase === 'playing') this.phase = 'paused';else if (this.phase === 'paused') this.phase = 'playing';}
  /** Um passo de simulação. cmd1 opcional: sem ele, o adversário usa a IA do modo atual. */
  step(cmd0 = emptyCommand(), cmd1) {
    this.lastStepEvents = [];this.frozen = false;
    if (this.phase !== 'playing' && this.phase !== 'finishing') return;
    // Hitstop: o passo conta no relógio, mas a simulação fica congelada.
    if (this.hitstop > 0) {
      // Congelado, mas X/C apertados agora ficam no buffer e saem no primeiro passo depois do hitstop.
      const cmds = finishingNow(this) ? [] : [cmd0, cmd1 ?? emptyCommand()];this.fighters.forEach((f, i) => cmds[i] && bufferDuringHitstop(f, cmds[i]));
      this.hitstop = Math.max(0, this.hitstop - C.test.step);this.tick++;this.frozen = true;return;
    }
    const finishing = this.phase === 'finishing';
    // IA do oponente desligada: o vermelho fica como boneco (recebe dano, colisões e reações físicas, sem decidir nada).
    const enemy = () => C.extras.toggles.enableEnemyAI ? this.brain.command(this.fighters[1], this.fighters[0], this.mode, C.test.step) : emptyCommand();
    const commands = finishing ? [emptyCommand(), emptyCommand()] : [cmd0, cmd1 ?? enemy()];
    this.lastCommands = commands;
    for (const f of this.fighters) updateFighter(f, commands[f.id] ?? emptyCommand(), this.fighters, C.test.step);
    const actions = this.fighters.map(f => f.action);
    const fresh = stepPhysics(this.fighters, C.test.step);
    for (const e of fresh) e.tick = this.tick;
    this.events.push(...fresh);this.events = this.events.slice(-12);this.lastStepEvents = fresh;
    if (C.extras.toggles.enableHitstop) {
      if (fresh.some(e => e.result === 'clash')) this.hitstop = C.extras.combat.clashHitstop;
      else if (fresh.some(e => e.result === 'impact' || e.result === 'perfect' || e.result === 'perfectDodge')) this.hitstop = C.extras.combat.impactHitstop;
    }
    for (const f of this.fighters) if (!f.action && !f.blend && !f.flight) f.locomotionVelocity = {...f.velocity};
    for (let i = 0; i < this.fighters.length; i++) if (this.fighters[i].action === actions[i]) advanceAction(this.fighters[i], C.test.step);
    this.tick++;
    if (this.fighters.some(f => f.hp <= 0)) {
      this.winner = this.fighters.find(f => f.hp > 0)?.id ?? null;
      this.phase = this.fighters.some(f => !!f.flight) ? 'finishing' : 'result';
    }
  }
  /** Visão para o HUD e para testes (mesma forma do v6). */
  snapshot() {
    return {phase: this.phase, tick: this.tick, winner: this.winner, mode: this.mode, hitstop: this.hitstop, events: this.events,
      fighters: this.fighters.map(f => ({...f, action: f.action ? {...f.action, hits: [...f.action.hits]} : null,
        invulnerable: isInvulnerable(f), offensive: f.action?.kind === 'tackle'}))};
  }
  /** Estado completo e independente (structuredClone preserva os Sets de acertos). */
  save() {
    return structuredClone({fighters: this.fighters, tick: this.tick, events: this.events, winner: this.winner, hitstop: this.hitstop, phase: this.phase,
      brain: this.brain.save(), playerBrain: this.playerBrain.save(), lastStepEvents: this.lastStepEvents});
  }
  load(state) {
    const s = structuredClone(state);
    this.fighters = s.fighters;this.tick = s.tick;this.events = s.events;this.winner = s.winner;this.hitstop = s.hitstop;this.phase = s.phase;
    this.brain.load(s.brain);this.playerBrain.load(s.playerBrain);this.lastStepEvents = s.lastStepEvents || [];
  }
}

/** Acumulador de tempo fixo com escala (câmera lenta) e avanço manual de quadros. */
export class FixedClock {
  constructor() {this.accumulator = 0;this.timeScale = 1;}
  reset() {this.accumulator = 0;}
  advance(seconds, stepFn) {
    for (this.accumulator += Math.max(0, Math.min(seconds * this.timeScale, C.test.maxFrame)); this.accumulator >= C.test.step - 1e-10;) {stepFn();this.accumulator -= C.test.step;}
  }
}
