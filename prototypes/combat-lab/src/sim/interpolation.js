// @ts-check
// Interpolação de render (skill physics-tuning: "física no passo fixo, desenho interpolado"). A simulação roda a 120 Hz; o desenho
// acontece na taxa do monitor. Sem interpolação cada quadro mostra o último passo inteiro e, em 144/165 Hz (ou 60 Hz com 2 passos
// por quadro), o movimento "bate" contra o relógio da simulação. Aqui o DESENHO usa a pose entre o passo anterior e o atual
// (alpha = fração do passo em acúmulo). A simulação NÃO é tocada: as poses são restauradas logo depois de desenhar.

/** Pose visual de um lutador no fim de um passo. */
export const poseOf = f => ({x: f.position.x, z: f.position.z, gy: f.groundY ?? 0, fy: f.flight ? (f.flight.y ?? null) : null, vault: f.vaultHeight ?? 0});

const mix = (a, b, t) => a + (b - a) * t;

/** Pose interpolada; teletransportes (distância > maxJump m: reinício, esquiva sobre o rival, spawn) não são suavizados. */
export function lerpPose(prev, cur, alpha, maxJump = 1.5) {
  if (!prev || alpha >= 1) return cur;
  if (Math.hypot(cur.x - prev.x, cur.z - prev.z) > maxJump || Math.abs(cur.gy - prev.gy) > maxJump) return cur;
  return {
    x: mix(prev.x, cur.x, alpha), z: mix(prev.z, cur.z, alpha), gy: mix(prev.gy, cur.gy, alpha),
    fy: prev.fy !== null && cur.fy !== null ? mix(prev.fy, cur.fy, alpha) : cur.fy, vault: mix(prev.vault, cur.vault, alpha),
  };
}

/**
 * Aplica a interpolação nos lutadores (in place) e devolve a função que restaura o estado exato da simulação.
 * Sempre chame o restore (try/finally) depois de desenhar.
 * @param {any[]} fighters @param {({x:number,z:number,gy:number,fy:number|null,vault:number}|null)[]|null} prevPose
 * @param {number} alpha 0..1 @param {number} [maxJump]
 */
export function applyInterpolation(fighters, prevPose, alpha, maxJump = 1.5) {
  if (!prevPose || !(alpha > 0) || alpha >= 1) return null;
  const saved = fighters.map(f => ({position: f.position, groundY: f.groundY, flightY: f.flight ? f.flight.y : undefined, vaultHeight: f.vaultHeight}));
  fighters.forEach((f, i) => {
    const p = lerpPose(prevPose[i], poseOf(f), alpha, maxJump);
    f.position = {x: p.x, z: p.z};f.groundY = p.gy;
    if (f.flight && p.fy !== null) f.flight.y = p.fy;
    if (f.vaultHeight !== undefined) f.vaultHeight = p.vault;
  });
  return () => fighters.forEach((f, i) => {
    f.position = saved[i].position;f.groundY = saved[i].groundY;
    if (f.flight && saved[i].flightY !== undefined) f.flight.y = saved[i].flightY;
    f.vaultHeight = saved[i].vaultHeight;
  });
}
