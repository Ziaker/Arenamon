// Ciclo de partida de passo fixo (120 Hz), igual ao v6, mais estado serializável para replay e cenários.
import {C} from './config.js';
import {Brain} from './ai.js';
import {createFighter, emptyCommand, isInvulnerable, isOffensive} from './entity.js';
import {updateFighter, advanceAction, bufferDuringHitstop, tickCooldowns} from './controller.js';
import {createWorld, stepWorld, spawn} from './world.js';
import {tickStatuses, applyStatus} from './status.js';
import {getMove, placeRelative, setLoadout} from './moves.js';
import {stepPhysics} from './physics.js';
import {vec} from './math.js';

const finishingNow = g => g.phase === 'finishing';
export class Game {
  constructor({seed = 1} = {}) {
    this.brain = new Brain(seed, 'aiRed');this.playerBrain = new Brain(seed + 1, 'aiBlue');
    // Movimentos equipados por lutador (ids registrados em moves.js); mantidos entre partidas.
    this.loadouts = [[], []];
    this.combatWindows = [null, null];
    this.mode = 'combat';this.profile = 'balanced';this.enemyProfile = 'balanced';
    this.reset();this.phase = 'menu';
  }
  reset({positions = [vec(0, -4), vec(0, 2)]} = {}) {
    this.fighters = [createFighter(0, C.profiles[this.profile] || C.profiles.balanced, {...positions[0]}), createFighter(1, C.profiles[this.enemyProfile] || C.profiles.balanced, {...positions[1]})];
    this.brain.reset();this.playerBrain.reset();
    this.fighters.forEach((f, i) => {
      f.loadout = [...(this.loadouts[i] || [])];
      if (this.combatWindows?.[i]) f.combatWindows = structuredClone(this.combatWindows[i]);
    });
    this.world = createWorld();
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
    const actions = this.fighters.map(f => f.action), worldEvents = [];
    this.fireMoveEffects(worldEvents);
    const fresh = stepPhysics(this.fighters, C.test.step, this.world);
    // Mundo (projéteis, barreiras, paredes, áreas) e status: depois da física dos lutadores, no mesmo passo.
    fresh.push(...worldEvents, ...stepWorld(this, C.test.step));
    for (const f of this.fighters) {fresh.push(...tickStatuses(f, C.test.step, C.rules.staminaMax));tickCooldowns(f, C.test.step);}
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
  /** Efeitos da linha do tempo dos movimentos que venceram neste passo (entidades, status e golpes corpo a corpo). */
  fireMoveEffects(events) {
    for (const f of this.fighters) {
      if (!f.moveFx?.length) continue;
      for (const fx of f.moveFx.splice(0)) {
        const def = getMove(fx.move), ev = def?.timeline?.[fx.index];if (!ev) continue;
        const other = this.fighters.find(o => o.id !== f.id);
        if (ev.spawn) spawn(this.world, placeRelative(f, fx.heading, ev.spawn), events);
        else if (ev.status) {const who = ev.target === 'opponent' ? other : f;if (who && who.hp > 0) {applyStatus(who, ev.status, {source: f.id});events.push({result: 'statusApplied', attacker: f.id, target: who.id, damage: 0, status: ev.status.id});}}
        else if (ev.hit) {
          // Golpe corpo a corpo: área curta à frente, por um passo, com a mesma função de acerto das entidades.
          const range = ev.hit.range ?? 1.2, width = ev.hit.width ?? 1.2;
          spawn(this.world, placeRelative(f, fx.heading, {kind: 'area', shape: 'box', hx: width / 2, hz: range / 2, offset: {forward: C.test.halfExtent + range / 2}, y: 0, height: ev.hit.height ?? 2, life: C.test.step, pulses: 1, hit: ev.hit}), events);
        }
      }
    }
  }
  /** Equipa movimentos registrados num lutador (vale a partir de agora e nas próximas partidas). */
  setLoadout(id, ids) {this.loadouts[id] = setLoadout(this.fighters[id], ids);return this.loadouts[id];}
  /** Associa janelas de combate da animação ao lutador (tackle, dodge, etc.). */
  setCombatWindows(id, windows) {
    this.combatWindows ??= [null, null];
    this.combatWindows[id] = windows ? structuredClone(windows) : null;
    if (this.fighters?.[id]) this.fighters[id].combatWindows = this.combatWindows[id];
  }
  /** Visão para o HUD e para testes (mesma forma do v6). */
  snapshot() {
    return {phase: this.phase, tick: this.tick, winner: this.winner, mode: this.mode, hitstop: this.hitstop, events: this.events,
      fighters: this.fighters.map(f => ({...f, action: f.action ? {...f.action, hits: [...f.action.hits], hitWindows: f.action.hitWindows ? f.action.hitWindows.map(s => [...s]) : null} : null,
        invulnerable: isInvulnerable(f), offensive: isOffensive(f)}))};
  }
  /** Estado completo e independente (structuredClone preserva os Sets de acertos). */
  save() {
    return structuredClone({fighters: this.fighters, tick: this.tick, events: this.events, winner: this.winner, hitstop: this.hitstop, phase: this.phase, world: this.world ?? createWorld(), loadouts: this.loadouts,
      combatWindows: this.combatWindows, brain: this.brain.save(), playerBrain: this.playerBrain.save(), lastStepEvents: this.lastStepEvents});
  }
  load(state) {
    const s = structuredClone(state);
    this.fighters = s.fighters;this.tick = s.tick;this.events = s.events;this.winner = s.winner;this.hitstop = s.hitstop;this.phase = s.phase;
    this.brain.load(s.brain);this.playerBrain.load(s.playerBrain);this.lastStepEvents = s.lastStepEvents || [];
    this.world = s.world ?? createWorld();if (s.loadouts) this.loadouts = s.loadouts;
    if (s.combatWindows) this.combatWindows = s.combatWindows;
    for (const f of this.fighters) {f.statuses ??= [];f.moveCooldowns ??= {};f.loadout ??= [];f.moveFx ??= [];}
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
