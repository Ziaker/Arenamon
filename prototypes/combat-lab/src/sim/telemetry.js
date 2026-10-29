// Telemetria por passo e dados de quadros (frame data).
// Unidade: passo de simulação (120 Hz por padrão; 1 passo = 8,33 ms). Os relatórios mostram passos e ms.
import {C} from './config.js';
import {actionPermissions, canAct, canMove, isInvulnerable, isOffensive, invulnerableWindow} from './entity.js';
import {length} from './math.js';
import {cancelWindow} from './controller.js';

export const ms = ticks => ticks * C.test.step * 1000;

export class Recorder {
  constructor(capacity = 120 * 30) {this.capacity = capacity;this.clear();}
  clear() {this.samples = [];this.actions = [];this.hits = [];this.open = [null, null];this.pending = [];}
  /** Chamado depois de cada passo da simulação. */
  record(game) {
    const tick = game.tick;
    const sample = {tick, hitstop: game.hitstop > 0, f: game.fighters.map(f => {const p = actionPermissions(f);return {
      state: f.state, hp: f.hp, stamina: f.stamina, speed: length(f.velocity), x: f.position.x, z: f.position.z, alt: (f.flight?.y ?? f.groundY ?? 0) + (f.vaultHeight ?? 0),
      action: f.action?.kind || null, invulnerable: isInvulnerable(f), offensive: isOffensive(f), guard: f.guard, perfect: f.perfectLeft > 1e-8,
      canAct: p.canAttack, canMove: p.canMove, exhausted: f.exhausted, counter: f.counterWindow > 0,
      // Locomoção: velocidade, velocidade desejada, aceleração aplicada, direção de entrada, orientação e fase.
      vx: f.velocity.x, vz: f.velocity.z, dvx: f.desiredVelocity?.x ?? 0, dvz: f.desiredVelocity?.z ?? 0, ax: f.appliedAccel?.x ?? 0, az: f.appliedAccel?.z ?? 0,
      ix: f.inputDir?.x ?? 0, iz: f.inputDir?.z ?? 0, facing: f.facing, visualFacing: f.visualFacing, loco: f.locoPhase, sprint: !!f.sprinting,
    };})};
    this.samples.push(sample);if (this.samples.length > this.capacity) this.samples.shift();
    // Eventos primeiro: o segmento aberto ainda é a ação que causou o contato (antes de virar recuo).
    for (const e of game.lastStepEvents || []) {
      if (e.target == null || !game.fighters?.[e.target] || !game.fighters?.[e.attacker]) continue;   // eventos do mundo e contatos que não são entre lutadores não entram na régua de vantagem
      const seg = this.open[e.attacker];
      const hit = {tick: e.tick ?? tick - 1, result: e.result, attacker: e.attacker, target: e.target, damage: e.damage, actionTick: seg ? (e.tick ?? tick - 1) - seg.start : null,
        attackerFree: null, targetFree: null, advantage: null, attackerMove: null, targetMove: null, moveAdvantage: null, launch: e.launch || null};
      if (seg && !seg.hit) seg.hit = hit.tick;
      this.hits.push(hit);this.pending.push(hit);if (this.hits.length > 200) this.hits.shift();
    }
    // Segmentos de ação (para a timeline e para comparar com os eventos do Studio).
    game.fighters.forEach((f, id) => {
      const open = this.open[id], action = f.action;
      if (open && open.ref !== action) {open.end = tick;this.open[id] = null;}
      if (action && (!this.open[id])) {
        const seg = {fighter: id, kind: action.kind, start: tick - 1, end: null, ref: action, vault: !!action.vault, counter: (action.speedMultiplier ?? 1) > 1, invulnerableUntil: action.kind === 'recoil' ? null : tick - 1 + Math.round(invulnerableWindow(action) / C.test.step), hit: null, fromCancel: !!action.fromCancel};
        this.actions.push(seg);this.open[id] = seg;if (this.actions.length > 400) this.actions.shift();
      }
    });
    // Vantagem: passos até cada lutador poder agir de novo, a partir do contato.
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const h = this.pending[i], a = game.fighters?.[h.attacker], t = game.fighters?.[h.target];
      if (!a || !t) {this.pending.splice(i, 1);continue;}
      if (h.attackerFree === null && canAct(a) && tick > h.tick + 1) h.attackerFree = tick - h.tick;
      if (h.targetFree === null && canAct(t) && tick > h.tick + 1) h.targetFree = tick - h.tick;
      if (h.attackerMove === null && canMove(a) && tick > h.tick + 1) h.attackerMove = tick - h.tick;
      if (h.targetMove === null && canMove(t) && tick > h.tick + 1) h.targetMove = tick - h.tick;
      if (h.attackerFree !== null && h.targetFree !== null && h.advantage === null) h.advantage = h.targetFree - h.attackerFree;
      if (h.attackerMove !== null && h.targetMove !== null) h.moveAdvantage = h.targetMove - h.attackerMove;
      if (h.advantage !== null && h.moveAdvantage !== null) this.pending.splice(i, 1);
      else if (tick - h.tick > 600) {this.pending.splice(i, 1);}
    }
  }
  /** Remove tudo depois de um passo (ao retomar a partir de um ponto do replay). */
  truncate(tick) {
    this.samples = this.samples.filter(s => s.tick <= tick);this.actions = this.actions.filter(a => a.start < tick);
    for (const a of this.actions) if (a.end === null || a.end > tick) a.end = null;
    this.hits = this.hits.filter(h => h.tick < tick);this.pending = this.pending.filter(h => h.tick < tick);this.open = [null, null];
  }
}

/** Quadros nominais de cada ação a partir da configuração atual (independem da partida). */
export function frameTable() {
  const s = C.test.step, R = C.rules, A = C.actions, n = x => Math.round(x / s), on = C.extras.toggles.enableInvulnerability;
  const row = (label, p, active) => ({action: label, total: n(p.duration), active, invulnerable: on && p.invulnerable > 0 ? `1–${n(p.invulnerable)}` : '—', cancel: `a partir de ${n(p.chainAfter) + 1}`, cost: p.cost});
  const c = A.cancel;
  return [
    row('Tackle (X)', A.tackle, `1–${n(A.tackle.duration)}`),
    row('Esquiva (C)', A.dodge, '—'),
    {action: 'Cancelamento C → X', total: '—', active: '—', invulnerable: ['resto de C', 'nenhuma', 'janela de X'][c.invulnerability] ?? '—', cancel: c.dodgeToTackle ? `passos ${n(cancelWindow()[0]) + 1}–${n(cancelWindow()[1])} de C` : 'desligado', cost: A.tackle.cost},
    {action: 'Recuo (bloqueado)', total: n(R.recoil), active: '—', invulnerable: '—', cancel: A.tackle.fromRecoil ? 'X, C e defesa' : 'C e defesa (X não)', cost: 0},
    {action: 'Guard stun', total: n(R.guardStun), active: '—', invulnerable: '—', cancel: A.tackle.fromGuardStun ? 'C, X e defesa perfeita' : 'C e defesa perfeita; X fica guardado', cost: 0},
    {action: 'Defesa perfeita (janela)', total: n(R.perfect), active: '—', invulnerable: '—', cancel: '—', cost: 0},
    {action: 'Recuperação ao aterrissar', total: n(R.landingRecovery), active: '—', invulnerable: '—', cancel: '—', cost: 0},
    {action: 'Tempo no ar (lançamento)', total: n(2 * R.launchUp / R.launchGravity), active: '—', invulnerable: '—', cancel: '—', cost: 0},
    {action: 'Tempo no ar (clash)', total: n(2 * R.clashUp / R.launchGravity), active: '—', invulnerable: '—', cancel: '—', cost: 0},
  ];
}
