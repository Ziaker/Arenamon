// Anchors do VFX: resolvem onde um efeito aparece no mundo.
// Nunca lêem ossos diretamente; usam fallback para centro/direção física quando um socket não existe.
// Os personagens (GLB) podem expor pontos de socket (ex: pés) através de ctx.characters.

// Resolve a posição do anchor para o mundo.
// ctx: {position, normal, direction, fighters, characters, camera, surface, launch, attacker, target}
export function resolveAnchor(anchor, ctx) {
  const {position, fighters, characters} = ctx;
  switch (anchor) {
    case 'contact':
      return position ? {...position} : {x: 0, y: 0, z: 0};
    case 'ground':
      return position ? {x: position.x, y: 0, z: position.z} : {x: 0, y: 0, z: 0};
    case 'midpoint': {
      const a = fighters && fighters[0];
      const b = fighters && fighters[1];
      if (a && b) return {x: (a.position.x + b.position.x) / 2, y: 0, z: (a.position.z + b.position.z) / 2};
      return position ? {x: position.x, y: 0, z: position.z} : {x: 0, y: 0, z: 0};
    }
    case 'attacker': {
      const id = ctx.attacker != null ? ctx.attacker : 0;
      const f = fighters && fighters[id];
      return f ? {...f.position} : (position ? {...position} : {x: 0, y: 0, z: 0});
    }
    case 'target': {
      const id = ctx.target != null ? ctx.target : 1;
      const f = fighters && fighters[id];
      return f ? {...f.position} : (position ? {...position} : {x: 0, y: 0, z: 0});
    }
    case 'socket':
    case 'foot':
    case 'hand': {
      // Tentar socket do personagem (GLB). Fallback: centro do alvo.
      const ch = characters && characters[ctx.target != null ? ctx.target : 1];
      if (ch && ch.feet && ch.feet.length) {
        const foot = ch.feet[0];
        // feet já são posições mundiais {x, y, z} quando fornecidos por characters.js.
        return {x: foot.x, y: foot.y, z: foot.z};
      }
      return position ? {...position} : {x: 0, y: 0, z: 0};
    }
    case 'center':
    default:
      return position ? {...position} : {x: 0, y: 0, z: 0};
  }
}

// Desvio determinístico em torno de um ponto (para espalhar partículas de impacto).
// Mesma seed → mesmo desvio. Não consome estado global.
export function jitterAround(point, seed, radius) {
  let s = ((seed * 1664525 + 1013904223) >>> 0) | 0;
  const next = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 0) / 4294967296; };
  const r1 = next(), r2 = next();
  const angle = r1 * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, r2)) * radius;
  return {x: point.x + Math.cos(angle) * r, y: point.y, z: point.z + Math.sin(angle) * r};
}
