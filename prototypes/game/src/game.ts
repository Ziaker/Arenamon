import { profiles, RULES, TEST } from './config';
import { Brain, Mode } from './ai';
import { Command, Fighter, fighter, idle } from './entity';
import { ContactEvent } from './combat';
import { prepare, finish } from './controller';
import { integrate } from './physics';
import { vec } from './math';
export class Game {
  fighters: Fighter[] = []; brain = new Brain(); phase: 'menu' | 'playing' | 'paused' | 'result' = 'menu';
  mode: Mode = 'combat'; profile = 'balanced'; tick = 0; events: ContactEvent[] = []; winner: number | null = null;
  constructor() { this.reset(); this.phase = 'menu'; }
  reset() {
    this.fighters = [fighter(0, profiles[this.profile], vec(0, -4)), fighter(1, profiles.balanced, vec(0, 2))];
    this.brain.reset(); this.tick = 0; this.events = []; this.winner = null; this.phase = 'playing';
  }
  pause() { if (this.phase === 'playing') this.phase = 'paused'; else if (this.phase === 'paused') this.phase = 'playing'; }
  step(player: Command = idle(), opponent?: Command) {
    if (this.phase !== 'playing') return;
    const commands = [player, opponent ?? this.brain.command(this.fighters[1], this.fighters[0], this.mode, TEST.step)];
    for (const f of this.fighters) prepare(f, commands[f.id] ?? idle(), this.fighters, TEST.step);
    const actions = this.fighters.map(f => f.action);
    this.events.push(...integrate(this.fighters, TEST.step)); this.events = this.events.slice(-12);
    for (const [index, f] of this.fighters.entries()) if (f.action === actions[index]) finish(f, TEST.step);
    this.tick++;
    if (this.fighters.some(f => f.hp <= 0)) { this.phase = 'result'; this.winner = this.fighters.find(f => f.hp > 0)?.id ?? null; }
  }
  snapshot() {
    return { phase: this.phase, tick: this.tick, winner: this.winner, mode: this.mode, events: this.events,
      fighters: this.fighters.map(f => ({ ...f, action: f.action ? { ...f.action, hits: [...f.action.hits] } : null,
        invulnerable: f.action?.kind === 'dodge' && f.action.elapsed < RULES.invulnerable - 1e-8,
        offensive: f.action?.kind === 'dodge' && f.action.offensive })) };
  }
}
export class FixedClock {
  accumulator = 0;
  reset() { this.accumulator = 0; }
  advance(seconds: number, step: () => void) {
    this.accumulator += Math.max(0, Math.min(seconds, TEST.maxFrame));
    while (this.accumulator >= TEST.step - 1e-10) { step(); this.accumulator -= TEST.step; }
  }
}
