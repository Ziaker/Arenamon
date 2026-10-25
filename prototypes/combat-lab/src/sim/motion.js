// @ts-check
// Curva física em fases das ações X (tackle) e C (esquiva):
//   Preparação → Impulso → Deslocamento → Desaceleração → Recuperação.
// A forma da velocidade s(u) (u = tempo/duração) é normalizada para ∫s du = 1. O deslocamento de cada passo é
// distância · (S(u₁) − S(u₀)), em que S é a integral acumulada: a distância nominal é preservada exatamente e a
// velocidade nunca salta (s é contínua; a entrada usa ainda a mistura com a velocidade anterior).
import {clamp, smoothstep, actionCurve} from './math.js';

/** Fração acumulada da distância de uma ação X/C no instante relativo u (curva em fases ou polinomial da Etapa A). */
export const actionProgress = (p, u) => p.profile === 1 ? phasedCurve(u, p) : actionCurve(u, p.curveStart);

const RES = 1024, cache = new Map();

/** Forma não normalizada da velocidade em u ∈ [0, 1]. */
function shape(u, p) {
  const prep = p.prepTime, imp = p.impulseTime, rec = p.recoveryTime, decel0 = Math.max(prep + imp + .01, p.decelStart), end = Math.max(decel0 + .01, 1 - rec);
  if (u < prep) return p.prepSpeed * smoothstep(u / Math.max(1e-6, prep));
  if (u < prep + imp) return p.prepSpeed + (1 - p.prepSpeed) * smoothstep((u - prep) / Math.max(1e-6, imp));
  if (u < decel0) return 1 + (p.travelEnd - 1) * (u - prep - imp) / Math.max(1e-6, decel0 - prep - imp);
  if (u < end) return p.travelEnd * (1 - smoothstep((u - decel0) / Math.max(1e-6, end - decel0)));
  return 0;
}

/** Tabela da integral acumulada normalizada (uma por conjunto de parâmetros). */
function table(p) {
  const key = [p.prepTime, p.impulseTime, p.decelStart, p.recoveryTime, p.prepSpeed, p.travelEnd].join(',');
  let t = cache.get(key);
  if (!t) {
    t = new Float64Array(RES + 1);let acc = 0;
    for (let i = 1; i <= RES; i++) {const u0 = (i - 1) / RES, u1 = i / RES;acc += (shape(u0, p) + 4 * shape((u0 + u1) / 2, p) + shape(u1, p)) / 6 / RES;t[i] = acc;}
    for (let i = 1; i <= RES; i++) t[i] /= acc || 1;
    if (cache.size > 64) cache.clear();cache.set(key, t);
  }
  return t;
}

/** Fração acumulada da distância em u (0 → 0, 1 → 1). */
export function phasedCurve(u, p) {
  u = clamp(u, 0, 1);const t = table(p), x = u * RES, i = Math.min(RES - 1, Math.floor(x)), f = x - i;
  return t[i] + (t[i + 1] - t[i]) * f;
}

/** Velocidade relativa normalizada em u (para gráficos e animação): a média sobre a ação é 1. */
export function phasedSpeed(u, p) {const t = table(p);return shape(clamp(u, 0, 1), p) / ((t.norm ??= normOf(p)) || 1);}
function normOf(p) {let acc = 0;for (let i = 0; i < RES; i++) acc += shape((i + .5) / RES, p) / RES;return acc;}

/** Fase nominal em u (para telemetria e animação). */
export function phaseAt(u, p) {
  const decel0 = Math.max(p.prepTime + p.impulseTime + .01, p.decelStart), end = Math.max(decel0 + .01, 1 - p.recoveryTime);
  return u < p.prepTime ? 'preparação' : u < p.prepTime + p.impulseTime ? 'impulso' : u < decel0 ? 'deslocamento' : u < end ? 'desaceleração' : 'recuperação';
}
