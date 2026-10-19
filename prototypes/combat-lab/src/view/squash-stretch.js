// Estado exclusivo da apresentação. Nenhuma escrita no lutador, nos ossos ou na física.
// Os interruptores usam 0/1, como os demais controles com histórico do laboratório.
export function createSquashState() {
  return {z: 1, transverse: 1, velocity: 0, heading: 0, active: false};
}

export function resetSquash(s) {
  s.z = s.transverse = 1;s.velocity = 0;s.active = false;
}

function smooth(t) {t = Math.max(0, Math.min(1, t));return t * t * (3 - 2 * t);}

/** Sem objetos, arrays, closures ou matrizes temporárias por quadro. dt em segundos. */
export function updateSquash(s, f, dt, options, motion) {
  if (!options.enableSquashStretch) {resetSquash(s);return;}
  if (!(dt > 0)) return;
  const a = f.action, duration = Math.max(.001, motion.duration);
  const elapsed = a?.elapsed ?? 0;
  const end = duration * (motion.profile === 1 ? Math.max(.02, Math.min(.99, motion.decelStart)) : .8);
  const active = a?.kind === 'tackle' && f.hp > 0 && !a.hits?.size && elapsed < end;
  if (active) {
    s.heading = a.heading;
    const window = Math.min(options.squashWindow / 1000, end * .5);
    const power = options.plScaling ? 1 + .25 * (Math.max(1, Math.min(3, a.pl || 1)) - 1) : 1;
    const compression = Math.max(0, Math.min(.3, options.squashIntensity));
    const stretch = Math.max(0, Math.min(.4, options.stretchIntensity)) * power;
    if (window > 0 && elapsed < window) {
      s.z = 1 - compression * smooth(elapsed / window);
    } else {
      const ramp = Math.max(.001, Math.min(end - window, duration * (motion.profile === 1 ? motion.impulseTime : .18)));
      s.z = 1 + (window > 0 ? -compression : 0) + ((window > 0 ? compression : 0) + stretch) * smooth((elapsed - window) / ramp);
    }
    s.velocity = 0;
  } else {
    // Solução analítica de uma mola criticamente amortecida: estável mesmo em quadros longos.
    const omega = 6 / (Math.max(30, options.settleDuration) / 1000);
    const x = s.z - 1, c = s.velocity + omega * x, decay = Math.exp(-omega * dt);
    s.z = 1 + (x + c * dt) * decay;
    s.velocity = (s.velocity - omega * c * dt) * decay;
    if (Math.abs(s.z - 1) < 1e-5 && Math.abs(s.velocity) < 1e-4) {s.z = 1;s.velocity = 0;}
  }
  s.active = active;
  s.transverse = options.preserveVolume ? 1 / Math.sqrt(s.z) : 1;
}
