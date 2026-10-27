// Contrato imutável de evento visual (VFX).
//
// O VFX recebe snapshots/eventos da simulação e produz apenas apresentação.
// Este módulo adapta eventos da simulação para o contrato visual, SOMENTE LEITURA.
// Nunca modifica o formato dos eventos da simulação nem altera a simulação.
//
// Campos do contrato visual:
//   tick        - passo da simulação (número inteiro)
//   eventId     - identificador único do evento visual (string)
//   type        - família do efeito: 'hit'|'partial'|'perfect'|'perfectDodge'|'invulnerable'|'clash'|'ground'|'wall'|'status'
//   attacker    - id do lutador atacante (0 ou 1)
//   target      - id do lutador alvo (0 ou 1)
//   position    - {x, y, z} ponto real de contato (ou fallback do alvo)
//   normal      - {x, y, z} normal de contato (unitária)
//   direction   - {x, y, z} direção do golpe (unitária, derivada da normal/posição)
//   damage      - dano do evento (número ≥ 0)
//   closingSpeed - velocidade de fechamento no contato (número ≥ 0)
//   launch      - {direction, horizontal, vertical} ou null (informações de lançamento)
//   surface     - 'ground'|'wall'|null (superfície do contato)
//   seed        - semente determinística derivada do evento
//   reason      - motivo legível do disparo (string)

const seq = (() => { let n = 0; return () => String(++n); })();

// Semente determinística a partir dos campos do evento (mesmo evento → mesma semente).
export function eventSeed(tick, attacker, target, type, position) {
  let h = 2166136261 >>> 0;
  const mix = (v) => { h = ((h ^ (v | 0)) * 16777619) >>> 0; };
  mix(tick | 0); mix(attacker | 0); mix(target | 0);
  mix(type.charCodeAt(0));
  for (let i = 0; i < type.length; i++) mix(type.charCodeAt(i));
  if (position) {
    mix(Math.round(position.x * 1000) | 0);
    mix(Math.round(position.y * 1000) | 0);
    mix(Math.round(position.z * 1000) | 0);
  }
  // Devolve um float em [0, 1) estável para a mesma entrada.
  return (h >>> 0) / 4294967296;
}

// Gera um eventId estável e legível.
export function makeEventId(tick, attacker, target, type) {
  return `vfx:${tick}:${attacker}:${target}:${type}`;
}

// Normaliza um vetor {x, y, z} (ausente → {0,1,0}).
function unit(v) {
  if (!v) return {x: 0, y: 1, z: 0};
  const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return {x: v.x / m, y: v.y / m, z: v.z / m};
}

// Direção do golpe a partir da normal e das posições dos lutadores.
function deriveDirection(normal, attackerPos, targetPos) {
  const n = unit(normal);
  if (attackerPos && targetPos) {
    const dx = targetPos.x - attackerPos.x, dz = targetPos.z - attackerPos.z;
    const dm = Math.hypot(dx, dz) || 1;
    // Preferir a direção entre os lutadores quando disponível.
    return {x: dx / dm, y: 0, z: dz / dm};
  }
  return {x: n.x, y: n.y, z: n.z};
}

// Adapta um evento da simulação para o contrato visual (somente leitura).
// O objeto de entrada NÃO é modificado. O resultado é congelado (Object.freeze).
export function adaptSimEvent(simEvent, {fighters = [], tickOverride = null} = {}) {
  const tick = tickOverride !== null ? tickOverride : (simEvent.tick != null ? simEvent.tick : 0);
  const attacker = simEvent.attacker != null ? simEvent.attacker : 0;
  const target = simEvent.target != null ? simEvent.target : 0;
  const type = classifyVisualType(simEvent.result);
  const a = fighters[attacker];
  const b = fighters[target];
  const pos = simEvent.position != null
    ? {x: simEvent.position.x, y: simEvent.position.y, z: simEvent.position.z}
    : (b ? {x: b.position.x, y: (b.flight ? b.flight.y : 0) + (b.vaultHeight ?? 0), z: b.position.z}
       : {x: 0, y: 0, z: 0});
  const normal = unit(simEvent.normal);
  const direction = deriveDirection(simEvent.normal, a ? a.position : null, b ? b.position : null);
  const damage = typeof simEvent.damage === 'number' ? simEvent.damage : 0;
  const closingSpeed = typeof simEvent.closingSpeed === 'number' ? simEvent.closingSpeed : 0;
  const launch = simEvent.launch != null
    ? {direction: unit(simEvent.launch.direction), horizontal: simEvent.launch.horizontal || 0, vertical: simEvent.launch.vertical || 0}
    : null;
  const surface = (simEvent.result === 'ground' || simEvent.surface === 'ground') ? 'ground'
    : (simEvent.surface === 'wall' ? 'wall' : null);
  const seed = eventSeed(tick, attacker, target, type, pos);
  const reason = `${type} (passo ${tick}: ${attacker} → ${target})`;

  return Object.freeze({
    tick,
    eventId: makeEventId(tick, attacker, target, type),
    type,
    attacker,
    target,
    position: Object.freeze(pos),
    normal: Object.freeze(normal),
    direction: Object.freeze(direction),
    damage,
    closingSpeed,
    launch: launch ? Object.freeze(launch) : null,
    surface,
    seed,
    reason,
  });
}

// Classifica o tipo de evento visual a partir do resultado da simulação.
export function classifyVisualType(result) {
  const map = {
    impact: 'hit',
    partial: 'partial',
    perfect: 'perfect',
    perfectDodge: 'perfectDodge',
    invulnerable: 'invulnerable',
    clash: 'clash',
    counter: 'hit',
    stoneClash: 'clash',
    tackleClash: 'clash',
    barrierBroken: 'shatter',
    destructibleDestroyed: 'shatter',
    rockDestroyed: 'shatter',
    destructibleHit: 'hit',
    wallSplat: 'wall',
    destructibleSplat: 'wall',
    neutralized: 'dissipate',
    footstool: 'hit',
    ground: 'ground',
    wall: 'wall',
    groundHit: 'ground',
    bounceLand: 'ground',
    statusApplied: 'status',
  };
  return map[result] || 'hit';
}

// Famílias de efeito reconhecidas pelo runtime.
export const VFX_FAMILIES = Object.freeze(['impact', 'defense', 'clash', 'landing', 'movement', 'status', 'environment']);

// Níveis de qualidade.
export const QUALITY = Object.freeze({low: 'low', medium: 'medium', high: 'high'});

// Verifica se um objeto parece ser um evento de simulação (possui attacker/target/result).
export function isSimEvent(obj) {
  return !!obj && typeof obj.attacker === 'number' && typeof obj.target === 'number' && typeof obj.result === 'string';
}

// Congela profundamente um evento visual para garantir imutabilidade no hot path.
export function freezeVisualEvent(ev) {
  if (Object.isFrozen(ev)) return ev;
  return Object.freeze({
    ...ev,
    position: Object.freeze({...ev.position}),
    normal: Object.freeze({...ev.normal}),
    direction: Object.freeze({...ev.direction}),
    launch: ev.launch ? Object.freeze({...ev.launch, direction: Object.freeze({...ev.launch.direction})}) : null,
  });
}
