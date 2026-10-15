// Treino de defesa perfeita e de esquiva perfeita. O adversário repete um ataque conhecido (tackle) em intervalos
// configuráveis com semente; o jogador responde com D ou C. Tudo é medido em PASSOS de simulação (não em tempo de tela):
//   • início do ataque: passo em que o tackle do vermelho começa;
//   • impacto: passo do contato real; sem contato (ex.: o jogador saiu do caminho), o impacto PREVISTO é obtido pelo
//     mesmo motor, reexecutando a partir do início do ataque sem a resposta do jogador;
//   • comando: passo do toque em D (defesa) ou do início da esquiva (C).
// O resultado é sempre o do motor (evento 'perfect' / 'perfectDodge'); a cronometragem só explica a diferença:
//   defesa perfeita ⇔ (impacto − toque) × passo < janela perfeita (rules.perfect) — a janela é aberta no toque;
//   esquiva perfeita ⇔ (impacto − início da esquiva) × passo < invulnerabilidade de C (actions.dodge.invulnerable).
import {C} from './config.js';
import {Game} from './game.js';
import {emptyCommand} from './entity.js';
import {vec, sub, normalize, length} from './math.js';

export const TRAIN_MODES = [['guard', 'Defesa perfeita (D)'], ['dodge', 'Esquiva perfeita (C)']];
export const TRAIN_ATTACKS = [['front', 'Tackle frontal'], ['diagonal', 'Tackle em diagonal'], ['approach', 'Aproxima e investe'], ['random', 'Sorteado pela semente']];
const lcg = seed => {let s = (seed >>> 0) || 1;return () => {s = (Math.imul(s, 1664525) + 1013904223) >>> 0;return s / 4294967296;};};
const free = f => !f.action && !f.flight && f.knockRecovery <= 0 && f.stun <= 1e-8 && f.hp > 0;

/** Cronometragem de uma tentativa (puro; usado pelo treino e pelos testes). */
export function evaluate({mode, impactTick, commandTick, step = C.test.step}) {
  const window = mode === 'guard' ? C.rules.perfect : C.actions.dodge.invulnerable;
  if (commandTick == null) return {timing: 'none', text: mode === 'guard' ? 'Sem defesa' : 'Sem esquiva', offset: null, error: null, window};
  if (impactTick == null) return {timing: 'unknown', text: 'Impacto não determinado', offset: null, error: null, window};
  const d = (impactTick - commandTick) * step, ms = v => `${Math.round(v * 1000)} ms`, act = mode === 'guard' ? 'Defesa executada' : 'Esquiva executada';
  if (commandTick > impactTick) return {timing: 'late', offset: d, error: -d, window, text: `${act} ${ms(-d)} depois do impacto.`};
  if (d >= window - 1e-9) return {timing: 'early', offset: d, error: d - window + step, window, text: `${act} ${ms(d - window + step)} antes da janela ${mode === 'guard' ? 'perfeita' : 'de invulnerabilidade'}.`};
  return {timing: 'inside', offset: d, error: 0, margin: window - d, window, text: `${act} dentro da janela (impacto ${ms(d)} depois do comando; margem ${ms(window - d)}).`};
}

export class Trainer {
  constructor({mode = 'guard', interval = 2, seed = 1, attack = 'front', distance = 3.6} = {}) {
    Object.assign(this, {mode, interval, seed, attack, distance});this.attempts = [];this.rng = lcg(seed);this.cur = null;this.phase = 'idle';
  }
  /** Prepara a partida: posições de treino, jogador livre, adversário sem IA (comandos do treino). */
  start(game) {
    this.rng = lcg(this.seed);this.attempts = [];this.phase = 'setup';game.mode = 'inactive';game.reset({positions: [vec(0, -2), vec(0, 2)]});this.nextAt = game.tick + Math.round(.8 / C.test.step);return this;
  }
  /** Comando do adversário neste passo (chamado antes de game.step). */
  enemyCommand(game) {
    const [p, e] = game.fighters, t = game.tick;
    if (this.phase === 'setup') {
      if (t < this.nextAt || !free(p) || !free(e)) return emptyCommand();
      // Reposiciona a dupla (corte de treino) e sorteia o ataque desta tentativa.
      const kind = this.attack === 'random' ? ['front', 'diagonal', 'approach'][Math.floor(this.rng() * 3)] : this.attack;
      const ang = kind === 'diagonal' ? (this.rng() < .5 ? -1 : 1) * (Math.PI / 5) : 0, dist = kind === 'approach' ? this.distance + 2.2 : this.distance;
      const pp = vec(0, -2), ep = vec(pp.x + Math.sin(ang) * dist, pp.z + Math.cos(ang) * dist);
      for (const [f, pos, face] of [[p, pp, ang], [e, ep, ang + Math.PI]]) {f.position = {...pos};f.velocity = vec();f.locomotionVelocity = vec();f.facing = face;f.visualFacing = face;f.combatHeading = face;f.faceGoal = face;f.guard = false;f.perfectLeft = 0;f.stamina = C.rules.staminaMax;f.regenBase = C.rules.staminaMax;f.exhausted = false;f.counterWindow = 0;f.inputBuffer = null;f.bufferedTackle = null;}
      const windup = Math.round((.45 + this.rng() * .35) / C.test.step);
      this.cur = {n: this.attempts.length + 1, kind, setupTick: t, fireAt: t + windup + (kind === 'approach' ? Math.round(.45 / C.test.step) : 0), approachFrom: kind === 'approach' ? t + windup : null, attackTick: null, impactTick: null, predictedTick: null, result: null, presses: [], dodgeStart: null};
      // Impacto previsto pelo motor, a partir deste instante, sem nenhuma resposta do jogador (vale mesmo se ele reagir cedo).
      this.cur.predictedTick = predictImpact(game, this.cur);
      this.phase = 'windup';return emptyCommand();
    }
    if (this.phase === 'windup') {const c = scriptedEnemy(this.cur, game, t);if (c.tackle) this.phase = 'attack';return c;}
    return emptyCommand();
  }
  /** Depois de cada passo: comandos do jogador, início do ataque, contato e fim da tentativa. */
  observe(game, cmd0) {
    const c = this.cur;if (!c) return null;const [p, e] = game.fighters, stepTick = game.tick - 1;
    // Toque registrado com o que o motor fez com ele (a defesa perfeita pode estar em recarga).
    if (this.mode === 'guard' ? cmd0?.guardPressed : cmd0?.dodge) c.presses.push({tick: stepTick, opened: this.mode === 'guard' ? p.perfectLeft > 1e-8 || p.perfectSucceeded : true, cooldown: p.perfectCooldown});
    if (this.mode === 'dodge' && p.action?.kind === 'dodge' && p.action.elapsed <= C.test.step + 1e-9 && c.dodgeStart == null) c.dodgeStart = stepTick;
    if (c.attackTick == null && e.action?.kind === 'tackle') c.attackTick = stepTick;
    for (const ev of game.lastStepEvents) if (ev.attacker === 1 && ev.target === 0 && c.impactTick == null) {c.impactTick = ev.tick;c.result = ev.result;}
    if (this.phase === 'attack' && c.attackTick != null && !e.action && (c.result || stepTick - c.attackTick > Math.round(1.2 / C.test.step)) && !p.flight) return this.finish(game);
    return null;
  }
  finish(game) {
    const c = this.cur, impact = c.impactTick ?? c.predictedTick;
    // Vale o último toque antes do impacto (o que abriu a janela em uso); sem nenhum antes, o primeiro depois.
    const press = [...c.presses].reverse().find(x => impact == null || x.tick <= impact) ?? c.presses[0] ?? null, command = press?.tick ?? null;
    // Esquiva: a invulnerabilidade começa quando a esquiva começa de fato (pode sair depois do toque, ex.: buffer).
    const start = this.mode === 'dodge' && c.dodgeStart != null && command != null && c.dodgeStart >= command ? c.dodgeStart : command;
    let timing = evaluate({mode: this.mode, impactTick: impact, commandTick: start});
    if (this.mode === 'guard' && press && !press.opened && timing.timing !== 'late') timing = {...timing, timing: 'cooldown', error: null, text: `Defesa perfeita em recarga no toque (faltavam ${Math.round(press.cooldown * 1000)} ms): a janela não abriu.`};
    const success = this.mode === 'guard' ? c.result === 'perfect' : c.result === 'perfectDodge';
    const entry = {...c, commandTick: command, impactUsed: impact, impactSource: c.impactTick != null ? 'real' : c.predictedTick != null ? 'previsto' : null, success, ...timing,
      resultLabel: {perfect: 'Defesa perfeita', partial: 'Defesa comum', impact: 'Atingido', perfectDodge: 'Esquiva perfeita', invulnerable: 'Invulnerável (sem bônus)', clash: 'Clash'}[c.result] ?? (c.result ? c.result : 'Sem contato')};
    this.attempts.push(entry);this.cur = null;this.phase = 'setup';
    this.nextAt = game.tick + Math.round(this.interval * (.85 + this.rng() * .3) / C.test.step);
    return entry;
  }
  get stats() {
    const a = this.attempts, hits = a.filter(x => x.success).length, timed = a.filter(x => x.error != null);
    return {total: a.length, hits, rate: a.length ? hits / a.length : 0, meanError: timed.length ? timed.reduce((s, x) => s + Math.abs(x.error), 0) / timed.length : null,
      meanOffset: timed.length ? timed.reduce((s, x) => s + x.offset, 0) / timed.length : null};
  }
}
/** Comando do adversário roteirizado na fase de preparação (aproximação opcional e tackle no passo marcado). */
export function scriptedEnemy(cur, game, t) {
  const [p, e] = game.fighters, toward = normalize(sub(p.position, e.position));
  if (t >= cur.fireAt) return {...emptyCommand(), move: toward, tackle: t === cur.fireAt, target: 0};
  if (cur.approachFrom != null && t >= cur.approachFrom) return {...emptyCommand(), move: toward, target: 0};
  return emptyCommand();
}
/** Impacto previsto: mesmo motor, do estado atual, com o roteiro do adversário e o jogador sem responder. */
export function predictImpact(game, cur = null, maxTicks = Math.round(3 / C.test.step)) {
  const g = new Game();g.load(game.save());g.mode = 'inactive';let started = false;
  for (let i = 0; i < maxTicks && (g.phase === 'playing' || g.phase === 'finishing'); i++) {
    g.step(emptyCommand(), cur ? scriptedEnemy(cur, g, g.tick) : emptyCommand());
    const ev = g.lastStepEvents.find(e => e.attacker === 1 && e.target === 0);if (ev) return ev.tick;
    if (g.fighters[1].action?.kind === 'tackle') started = true;else if (started || !cur) return null;
  }
  return null;
}
void length;
