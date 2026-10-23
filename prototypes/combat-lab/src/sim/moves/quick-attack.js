// @ts-check
// Quick Attack (Ataque Rápido) — Burst · Melee · PL1 (catálogo de genéricos §2). Escolhe o adversário elegível mais próximo a até 7 m (vivo, no chão e ao
// alcance vertical do corpo), avança em altíssima velocidade aplicando um Tackle curto e RETORNA imediatamente ao ponto de onde saiu, tenha acertado ou errado.
// Como o Lunge, vira uma ação de Tackle real (colisão, defesa, Clash/Counter, i-frames do alvo): o contato é resolvido pela física existente. Diferenças:
//   • movimento próprio por fases (`quickAttackStep`): aproximação → retorno → recuperação; a ida termina no 1º contato (acertando, bloqueado ou i-frames), ao
//     chegar ao ponto capturado, ao esgotar o tempo máximo ou ao ser barrada por um sólido; a volta NÃO é um segundo ataque (a ação fica `neutralized`: não acerta
//     de novo nem quebra Reflect);
//   • a defesa do alvo não faz o atacante recuar (`keepOnBlock`): o retorno acontece sempre;
//   • sem adversário elegível o Move nem começa (motivo `noTarget`, sem custo — MV-P17 provisório).
// Origem inacessível ou retorno barrado: o corpo para onde parar, sem teletransporte (MV-P02). Valores: C.world.quickAttack, capturados no uso (M28.4).
// Anti-aéreo (23/10/2026): alvos em voo dentro de `airReach` m contam no alcance e o corpo sobe até a altura deles na ida (volta ao chão no retorno).
import {C} from '../config.js';
import {nearestEligible, targetReachOf} from '../moves.js';
import {altitudeOf} from '../entity.js';
import {sub, length, normalize, angleOf, direction, scale} from '../math.js';

export const quickAttackDef = Object.freeze({
  id: 'quick-attack', name: 'Quick Attack', air: 'descend', group: 'quickAttack', tackle: 'quick-attack', needsTarget: 'acquireRange', antiAir: true,
  description: 'Burst. Acha o adversário mais próximo a até 7 m (inclusive em voo baixo), investe em altíssima velocidade com um Tackle curto (PL1) e volta na hora ao ponto de partida.',
  cost: .75, cooldown: 6, duration: .42, aim: 'target',
});

/** Preparação da ação (captura alvo, origem e velocidades). */
export function quickAttackSetup(/** @type {any} */ f, /** @type {any} */ a, /** @type {Record<string, any>} */ P, /** @type {{fighters: any[], def: any}} */ ctx) {
  const p = C.actions.tackle, target = nearestEligible(f, ctx.fighters, P.acquireRange, targetReachOf(ctx.def));
  const ahead = direction(f.facing);
  const tpos = target ? {x: target.position.x, z: target.position.z} : {x: f.position.x + ahead.x * P.acquireRange, z: f.position.z + ahead.z * P.acquireRange};
  a.heading = a.startAngle = angleOf(sub(tpos, f.position));
  a.fixedHeading = true;a.keepOnBlock = true;
  a.plDamage = P.damage / C.test.attackReference;                 // MV-P13
  a.kb = {horizontal: P.knockbackH, vertical: P.knockbackV};
  a.invulnerableFor = P.invulnerableSeconds;
  a.durationScale = (P.approachMax + P.returnMax + P.recovery + .05) / p.duration;
  a.chainAfter = P.approachMax + P.returnMax + P.recovery;         // só depois da sequência completa pode encadear
  a.qa = {phase: 'approach', origin: {x: f.position.x, z: f.position.z}, target: tpos, last: {x: f.position.x, z: f.position.z}, stuck: 0, speedA: P.acquireRange / P.approachMax, speedR: P.acquireRange / P.returnMax, returnAt: null, targetId: target?.id ?? null};
  // Anti-aéreo: sobe até os pés do alvo durante a ida e desce de volta durante o retorno (sem teletransporte vertical).
  const ground = f.groundY ?? 0, from = f.vaultHeight ?? 0, to = target ? Math.max(0, altitudeOf(target) - ground) : 0;
  if (to > from + .05) a.airCurve = {from, to, up: P.approachMax, hold: 0, down: P.returnMax};
  a.stepper = 'quick-attack:step';
  a.from = null;   // sem mistura com a velocidade anterior: a ida começa na velocidade própria
}

const STUCK_TICKS = 3;
/** Velocidade do passo (substitui a curva do Tackle). Devolve o vetor de velocidade horizontal. */
export function quickAttackStep(/** @type {any} */ f, /** @type {any} */ a, /** @type {number} */ dt) {
  const q = a.qa, P = a.params, dtp = C.actions.tackle.duration;
  if (!q || q.phase === 'done') return {x: 0, z: 0};
  const moved = Math.hypot(f.position.x - q.last.x, f.position.z - q.last.z) / Math.max(dt, 1e-9);
  q.last = {x: f.position.x, z: f.position.z};
  const speed = q.phase === 'approach' ? q.speedA : q.speedR;
  if (a.elapsed > 2 * dt && moved < speed * .3) q.stuck++;else q.stuck = 0;
  if (q.phase === 'approach') {
    const toT = sub(q.target, f.position), d = length(toT);
    if (a.hits.size > 0 || a.elapsed >= P.approachMax - 1e-9 || d <= .15 || q.stuck >= STUCK_TICKS) {q.phase = 'return';q.returnAt = a.elapsed;q.stuck = 0;a.neutralized = true;}   // a volta não é um segundo ataque
    else return scale(direction(a.heading), speed);
  }
  if (q.phase === 'return') {
    const toO = sub(q.origin, f.position), d = length(toO);
    if (d <= .08 || a.elapsed - q.returnAt >= P.returnMax - 1e-9 || q.stuck >= STUCK_TICKS) {
      q.phase = 'done';a.durationScale = (a.elapsed + P.recovery) / dtp;   // recuperação de 0,12 s a partir daqui
      return {x: 0, z: 0};
    }
    return scale(normalize(toO), Math.min(q.speedR, d / dt));
  }
  return {x: 0, z: 0};
}
