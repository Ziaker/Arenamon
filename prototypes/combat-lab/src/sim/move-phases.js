// @ts-check
// Projeção somente-leitura das fases que a simulação já declara. Não inventa
// hitbox, dano ou recovery: ausência de informação permanece explicitamente vazia.

const clamp = (/** @type {number} */ v, /** @type {number} */ duration) => Math.max(0, Math.min(duration, Number.isFinite(v) ? v : 0));

/**
 * @param {any} def definição efetiva do Move
 * @param {Record<string, any>|null} [group]
 */
export function effectiveMovePhases(def, group = null) {
  const duration = Math.max(0, Number(def?.duration) || 0), charge = !!def?.charge;
  const impacts = (def?.timeline ?? []).map((ev) => {
    const kind = ev.spawn ? 'spawn' : ev.status ? 'status' : ev.hit ? 'hit' : 'effect';
    const name = ev.spawn?.kind ?? ev.status?.id ?? ev.effect ?? 'golpe';
    return {at: charge ? 0 : clamp(Number(ev.at) || 0, duration), kind, name};
  });
  const active = [];
  if (def?.tackle && group && Number.isFinite(group.hitStart) && Number.isFinite(group.hitEnd)) {
    const start = clamp(group.hitStart, duration), end = clamp(group.hitEnd, duration);
    active.push([start, Math.max(start, end)]);
  }
  const firstDanger = active[0]?.[0] ?? impacts[0]?.at ?? duration;
  const activeEnd = active.length ? active.at(-1)[1] : firstDanger;
  const cancelSource = def?.tackle ? group?.chainAfter : def?.cancelAfter;
  const cancelAt = Number.isFinite(cancelSource)
    ? clamp(cancelSource, duration)
    : null;
  const invulnerable = Array.isArray(def?.invulnerable) && def.invulnerable[1] > def.invulnerable[0]
    ? [[clamp(def.invulnerable[0], duration), clamp(def.invulnerable[1], duration)]]
    : [];
  return {
    duration,
    startup: [0, firstDanger],
    active,
    recovery: [activeEnd, duration],
    cancel: cancelAt !== null && cancelAt < duration ? [cancelAt, duration] : null,
    invulnerable,
    impacts,
  };
}

