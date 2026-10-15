// Locomoção contínua (caminhada, sprint e frenagem) por passo fixo.
//
// A velocidade nunca é trocada de uma vez: cada passo aplica uma aceleração limitada, decomposta em
//   • componente paralela à direção pedida: acelera (com curva progressiva), freia ao passar do alvo
//     ou inverte (atravessando zero) com a aceleração de reversão;
//   • componente perpendicular: dissipada pela aderência lateral (resistência à mudança de direção).
// Sem comando, a velocidade cai pela frenagem (com curva) mais um atrito proporcional à velocidade.
//
// Garantia verificada nos testes: sem colisões ou impulsos externos, |Δv| por passo ≤ accelerationLimit(P, vMax) · dt.
// O modelo 0 (v6) mantém a aproximação linear original para o teste de paridade.
import {vec, add, scale, sub, dot, length} from './math.js';

/** Aproximação linear do v6 (aceleração, frenagem e reversão constantes, sem componente lateral). */
export function legacyApproach(current, desired, P, dt) {
  const delta = sub(desired, current), dist = length(delta);
  const rate = length(desired) < 1e-8 ? P.braking : dot(current, desired) < 0 ? P.reversal : P.acceleration;
  return dist <= rate * dt ? {...desired} : add(current, scale(delta, rate * dt / dist));
}

/** Aceleração efetiva para sair de `speed` rumo a `target` (curva progressiva: forte no início, suave perto do máximo). */
const accelAt = (P, speed, target) => P.acceleration * Math.max(.2, 1 - P.accelCurve * Math.min(1, Math.max(0, speed / Math.max(1e-6, target))));
/** Frenagem efetiva (curva: perto de parar, a frenagem cai e sobra um deslizamento residual curto) + atrito viscoso. */
const brakeAt = (P, speed, reference) => P.braking * (1 - P.brakeCurve * (1 - Math.min(1, speed / Math.max(1e-6, reference)))) + P.friction * speed;

/** Maior |aceleração| que o controlador pode aplicar (limite usado pelos testes de continuidade). */
export function accelerationLimit(P, vMax) {
  const parallel = Math.max(P.acceleration, P.reversal, P.braking + P.friction * vMax, P.overspeedBraking ?? 0);
  return Math.hypot(parallel, P.turnGrip);
}

/**
 * Um passo de locomoção.
 * @param v velocidade atual (m/s), move comando normalizado (|move| ≤ 1), vMax velocidade máxima deste modo.
 * @returns {velocity, desired, accel, phase} — accel = Δv/dt efetivamente aplicada; phase descreve a fase para animação/telemetria.
 */
export function locomotionStep(v, move, vMax, P, dt) {
  const input = length(move), speed = length(v);
  let next, phase;
  if (input < 1e-6) {
    // Frenagem: mesma direção, módulo diminuindo até zero (nunca inverte por frenagem).
    // Abaixo da velocidade residual a curva de frenagem deixa de suavizar: o deslizamento final termina sem salto.
    const decel = speed < P.residualSpeed ? P.braking + P.friction * speed : brakeAt(P, speed, vMax), s = Math.max(0, speed - decel * dt);
    next = speed > 1e-9 && s > 1e-9 ? scale(v, s / speed) : vec();
    phase = length(next) > 1e-6 ? 'brake' : 'idle';
    return {velocity: next, desired: vec(), accel: scale(sub(next, v), 1 / dt), phase};
  }
  const d = scale(move, 1 / input), target = vMax * input;
  let par = dot(v, d);
  const perp = sub(v, scale(d, par)), perpSpeed = length(perp);
  // Lateral: a componente fora da direção pedida se dissipa pela aderência (curvas e mudanças de 90° graduais).
  const perpNext = perpSpeed > 1e-9 ? scale(perp, Math.max(0, perpSpeed - P.turnGrip * dt) / perpSpeed) : vec();
  if (par < 0) {
    // Reversão: desacelera até zero e só então acelera no novo sentido, dentro do mesmo passo se sobrar tempo.
    const toZero = -par / P.reversal;
    if (toZero >= dt) {par += P.reversal * dt;phase = 'reverse';}
    else {par = accelAt(P, 0, target) * (dt - toZero);phase = 'reverse';}
  } else if (par < target) {
    par = Math.min(target, par + accelAt(P, par, target) * dt);phase = perpSpeed > .35 * Math.max(par, 1e-6) ? 'turn' : par >= target - 1e-6 ? 'cruise' : 'accel';
  } else {
    // Acima do alvo (fim do sprint, defesa, comando parcial): reduz com a frenagem de excesso.
    const decel = P.overspeedBraking ?? P.braking;par = Math.max(target, par - decel * dt);phase = par > target + 1e-6 ? 'overspeed' : 'cruise';
  }
  next = add(scale(d, par), perpNext);
  return {velocity: next, desired: scale(d, target), accel: scale(sub(next, v), 1 / dt), phase};
}
