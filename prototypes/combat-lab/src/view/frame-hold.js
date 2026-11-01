// Segurar quadro (editor de animações › Segurar quadro): conversões quadro ↔ segundo. Módulo PURO (sem DOM, sem three.js),
// testado em Node. O tempo do clipe sempre vale em segundos; o editor mostra e grava o NÚMERO DO QUADRO (1 = primeiro, como no Blender).

/** Campos do «Segurar quadro» (FIELDS em animation-profile.js). Entram no relógio do agendador (clip-scheduler.js). */
export const HOLD_FIELD_IDS = ['holdFrame', 'holdFor'];

const COMMON_FPS = [12, 15, 24, 25, 30, 48, 50, 60, 120];

/**
 * Taxa de quadros do clipe a partir dos tempos das trilhas (menor passo entre chaves). Clipes exportados do Blender
 * (Eggo 24 fps) e os do Z-A (60 fps) caem numa taxa comum; sem chaves, 30 fps.
 * @param {ArrayLike<number>[]} timesList tempos de cada trilha
 */
export function frameRateOf(timesList) {
  let min = Infinity;
  for (const t of timesList || []) for (let i = 1; i < t.length; i++) {const d = t[i] - t[i - 1];if (d > 1e-5 && d < min) min = d;}
  if (!Number.isFinite(min)) return 30;
  const raw = 1 / min;
  for (const f of COMMON_FPS) if (Math.abs(raw - f) <= f * .02) return f;
  return Math.max(1, Math.round(raw));
}

/** Segundo do clipe em que o quadro (1 = primeiro) aparece. */
export const frameTime = (frame, fps) => Math.max(0, (Math.round(frame) - 1) / fps);
/** Quadro (1 = primeiro) mais próximo de um segundo do clipe. */
export const timeFrame = (seconds, fps) => Math.max(1, Math.round(seconds * fps) + 1);
/** Quantidade de quadros de um clipe (inclui o primeiro e o último). */
export const frameCount = (duration, fps) => Math.max(1, Math.round(duration * fps) + 1);

const FPS_CACHE = new WeakMap();
/** fps de um AnimationClip (tracks[].times), guardado por clipe. */
export function clipFps(clip) {
  if (!clip) return 30;
  let v = FPS_CACHE.get(clip);
  if (v === undefined) {v = frameRateOf((clip.tracks || []).map(t => t.times));FPS_CACHE.set(clip, v);}
  return v;
}
