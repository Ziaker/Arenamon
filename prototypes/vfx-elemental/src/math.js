// ============================================================================
// 2. MATEMÁTICA DE OPACIDADE TOTAL & REDUÇÃO AO LONGO DA DURAÇÃO
// ============================================================================

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / Math.max(1e-5, b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function computeDurationOpacity(params, u) {
  const totalOp = clamp(params.opacity ?? 1, 0, 1);
  const fs = clamp(params.fadeStart ?? 0.6, 0, 0.98);
  const fe = clamp(params.fadeEnd ?? 1.0, fs + 0.02, 1.0);
  const fp = clamp(params.fadePower ?? 1.0, 0.2, 4.0);
  const endOp = clamp(params.endOpacity ?? 0.0, 0, 1);

  const entry = u < 0.04 ? smoothstep(0, 0.04, u) : 1.0;

  let decay = 1.0;
  if (u <= fs) {
    decay = 1.0;
  } else if (u >= fe) {
    decay = endOp;
  } else {
    const raw = clamp((u - fs) / Math.max(0.01, fe - fs), 0, 1);
    const curved = Math.pow(raw, fp);
    const s = curved * curved * (3 - 2 * curved);
    decay = 1.0 - s * (1.0 - endOp);
  }
  return clamp(totalOp * entry * decay, 0, 1);
}
