// Ferramentas visuais de colisão (Fase 7 do overhaul). Desenham no grupo de sobreposições técnicas da View (liga/desliga em «Visualizar») e alimentam o painel
// «Dados ao vivo». Só LEEM o estado (mapa, lutadores) e a sonda de colisão; não mudam nada na simulação. Sem Three aqui: usa view.line / view.ring.
import {C} from '../sim/config.js';
import {collisionProbe, bodyPenetration} from '../sim/collision-probe.js';
import {groundSurface} from '../sim/physics.js';
import {solidGap} from '../sim/map.js';
import {collectSolids} from '../nav/nav-graph.js';
import {nominalDistance, isInvulnerable} from '../sim/entity.js';

export const COLLISION_OVERLAYS = [
  ['mapSolids', 'Colisores do cenário', 'Contorno físico real de plataformas (verde), obstáculos (azul), destrutíveis sólidos (laranja) e a prévia de respawn (amarelo tracejado), com a altura de cada um. O que está desenhado é o que colide.'],
  ['support', 'Apoio atual', 'Anel na superfície que segura cada lutador (cinza = chão, verde = plataforma, azul = obstáculo, laranja = destrutível) e linha dos pés até ela; em voo, linha até a superfície que seria o próximo apoio.'],
  ['envContacts', 'Contatos com o ambiente', 'Último contato de cada lutador com parede, obstáculo, plataforma, destrutível ou borda: seta ciano = normal; barra vermelha = profundidade corrigida; seta branca = velocidade antes; seta verde = velocidade depois. Dura 1,6 s.'],
  ['moveEntities', 'Hitbox das entidades dos Moves', 'Geometria REAL de cada entidade criada por um Move (só leitura): projétil = esfera/anel do raio de colisão (laranja) na altura em que voa; área = círculo ou caixa com altura (vermelho; amarelo antes de ativar); barreira/parede = caixa (azul); feixe = segmentos (magenta). É o volume que a física usa, não o desenho do efeito: se o VFX parecer maior ou menor, esta é a medida certa.'],
  ['hurtbox', 'Hurtbox dos lutadores', 'Caixa REAL em que golpes, projéteis e áreas acertam cada lutador (meia largura «halfExtent» × altura do corpo, a partir da altura atual dos pés): verde = pode ser atingido; cinza = invulnerável agora. Compare com o modelo: a caixa é a medida certa.'],
  ['displacement', 'Deslocamento pretendido × real', 'Em Tackle, esquiva e Moves que viram Tackle (Lunge, Quick Attack, Bullet Punch…): linha verde = distância pretendida pela ação (sem colisões), linha branca = o que o lutador andou de fato. A diferença mostra atrito, parede ou corte por colisão. O número fica em «Dados ao vivo».'],
  ['sweeps', 'Varredura dos projéteis', 'Trecho percorrido por cada projétil em cada subpasso (amarelo) e o ponto do primeiro contato (anel vermelho) com o objeto que o barrou.'],
  ['overlaps', 'Sobreposições e vãos', 'Linha vermelha entre dois sólidos do cenário que se sobrepõem, laranja quando o vão é menor que o «Vão mínimo entre objetos»; anel vermelho em lutador penetrando um sólido no chão.'],
];

const KIND_COLOR = {ground: 0x8a94a6, platform: 0x6fe28a, obstacle: 0x8fa8d8, destructible: 0xffa040};
const MAX_AGE_STEPS = Math.round(1.6 / C.test.step);   // 1,6 s em passos do relógio da simulação

/**
 * Deslocamento de uma ação com trajetória (tackle/esquiva, inclusive Moves que viram tackle): pretendido (mesma conta de ctrl-update, sem colisões)
 * × percorrido de fato ao longo da direção da ação. null quando a ação não tem trajetória.
 */
export function dashDisplacement(f) {
  const a = f.action;
  if (!a || (a.kind !== 'tackle' && a.kind !== 'dodge') || a.slam) return null;
  const intended = nominalDistance(f, a.kind) * (a.speedMultiplier ?? 1) * (a.plSpeed ?? 1) * (a.distanceScale ?? 1), traveled = a.traveled ?? 0;
  const h = a.heading ?? f.facing, dir = {x: Math.sin(h), z: Math.cos(h)};
  return {kind: a.move ?? a.kind, intended, traveled, friction: a.fricSkipped ?? 0, dir, origin: {x: f.position.x - dir.x * traveled, z: f.position.z - dir.z * traveled}};
}
/** Último resultado por lutador, para a linha continuar visível 1,6 s depois do fim da ação. */
const lastDash = new Map();

/** Contorno de uma caixa alinhada (3 polilinhas: base, topo e as quatro arestas verticais). */
function box(view, x, z, hx, hz, y0, y1, color, opacity = .8) {
  const c = [[x - hx, z - hz], [x + hx, z - hz], [x + hx, z + hz], [x - hx, z + hz]];
  view.line([...c, c[0]].map(([a, b]) => [a, y0, b]), color, opacity);view.line([...c, c[0]].map(([a, b]) => [a, y1, b]), color, opacity);
  view.line([[c[0][0], y0, c[0][1]], [c[0][0], y1, c[0][1]], [c[1][0], y1, c[1][1]], [c[1][0], y0, c[1][1]], [c[2][0], y0, c[2][1]], [c[2][0], y1, c[2][1]], [c[3][0], y1, c[3][1]], [c[3][0], y0, c[3][1]]], color, opacity);
}
function cylinder(view, x, z, r, y0, y1, color, opacity = .8) {
  view.ring(x, z, r, color, 0, Math.PI * 2, y0);view.ring(x, z, r, color, 0, Math.PI * 2, y1);
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) view.line([[x + Math.sin(a) * r, y0, z + Math.cos(a) * r], [x + Math.sin(a) * r, y1, z + Math.cos(a) * r]], color, opacity);
}
const asShape = s => s.shape === 'cyl' ? {x: s.x, z: s.z, r: s.r} : {x: s.x, z: s.z, hx: s.hx, hz: s.hz};
/** Pares de sólidos do cenário que se sobrepõem ou deixam vão menor que o mínimo: [{a, b, gap}]. */
export function solidPairs(mapState) {
  const S = collectSolids(mapState), need = C.map?.passageClearance ?? 1.2, out = [];
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
    const gap = solidGap(asShape(S[i]), asShape(S[j]));
    if (gap < need) out.push({a: S[i], b: S[j], gap});
  }
  return out;
}
/** Maior penetração (m) do corpo do lutador, no chão, em sólidos do cenário. */
export function groundPenetration(mapState, f) {
  if (f.flight || f.hp <= 0 || f.absent) return 0;
  let m = 0;for (const s of collectSolids(mapState)) m = Math.max(m, bodyPenetration({x: f.position.x, y: f.groundY ?? 0, z: f.position.z}, s));
  return m;
}

export function drawCollisionOverlays(view, fighters, world, O) {
  const ms = world?.mapState, half = C.test.halfExtent, V = C.extras.visual;
  if (O.mapSolids && ms) {
    for (const p of ms.platforms ?? []) box(view, p.pos?.x ?? p.x, p.pos?.z ?? p.z, (p.width ?? 3) / 2, (p.depth ?? 3) / 2, 0, p.height, KIND_COLOR.platform);
    for (const o of ms.obstacles ?? []) {
      const y0 = o.pos?.y ?? 0, y1 = y0 + o.height;
      if (o.shape === 'cylinder' || o.shape === 'pillar') cylinder(view, o.pos.x, o.pos.z, o.radius, y0, y1, KIND_COLOR.obstacle);
      else box(view, o.pos.x, o.pos.z, o.hx, o.hz, y0, y1, KIND_COLOR.obstacle);
    }
    for (const d of ms.destructibles ?? []) {
      if (d.state === 'solid') box(view, d.pos.x, d.pos.z, d.size.hx, d.size.hz, d.pos.y ?? 0, (d.pos.y ?? 0) + d.size.height, KIND_COLOR.destructible);
      else if (d.state === 'ghost') box(view, d.pos.x, d.pos.z, d.size.hx, d.size.hz, 0, .05, 0xffe08a, .55);
    }
  }
  if (O.support) {
    for (const f of fighters) {
      if (f.hp <= 0) continue;
      const feet = (f.flight?.y ?? f.groundY ?? 0) + (f.vaultHeight ?? 0);
      const s = f.flight ? groundSurface(f.position, world, f.flight.y) : f.support ?? groundSurface(f.position, world, f.groundY ?? 0);
      const color = KIND_COLOR[s.kind] ?? KIND_COLOR.ground;
      view.ring(f.position.x, f.position.z, half * 1.1, color, 0, Math.PI * 2, s.y + .02);
      view.line([[f.position.x, feet, f.position.z], [f.position.x, s.y + .02, f.position.z]], color, f.flight ? .5 : .9);
    }
  }
  if (O.envContacts) {
    for (const f of fighters) {
      const r = collisionProbe.byFighter[f.id];if (!r || collisionProbe.step - r.step > MAX_AGE_STEPS) continue;
      const px = r.x - r.normal.x * half, pz = r.z - r.normal.z * half, y = V.bodyHeight * .5, k = .12;
      view.line([[px, y, pz], [px + r.normal.x * 1.2, y, pz + r.normal.z * 1.2]], 0x73caff, 1);
      view.line([[px, y + .08, pz], [px - r.normal.x * Math.max(.08, r.depth * 4), y + .08, pz - r.normal.z * Math.max(.08, r.depth * 4)]], 0xff4a4a, 1);
      view.line([[r.x, y + .25, r.z], [r.x + r.vBefore.x * k, y + .25, r.z + r.vBefore.z * k]], 0xffffff, .95);
      view.line([[r.x, y + .35, r.z], [r.x + r.vAfter.x * k, y + .35, r.z + r.vAfter.z * k]], 0x5dff9a, .95);
    }
  }
  if (O.moveEntities && world?.entities) {
    for (const e of world.entities) {
      if (e.dead) continue;
      const x = e.pos?.x ?? 0, z = e.pos?.z ?? 0, y0 = e.y ?? 0;
      if (e.kind === 'projectile') {view.ring(x, z, e.radius ?? .25, 0xffa040, 0, Math.PI * 2, y0);view.line([[x, y0 - (e.radius ?? .25), z], [x, y0 + (e.radius ?? .25), z]], 0xffa040, .9);}
      else if (e.kind === 'sandwave') {   // retângulo real do acerto (inRect em sand.js) + frente atual (speed × idade); cinza na dissipação (sem hitbox)
        const d = e.dir, sd = {x: d.z, z: -d.x}, w = e.width / 2, at = (u, v) => [e.pos.x + d.x * u + sd.x * v, .05, e.pos.z + d.z * u + sd.z * v];
        const color = e.age <= e.active + 1e-9 ? 0xff4a4a : 0x9aa0a8, front = Math.min(e.length, (e.speed ?? 0) * (e.age ?? 0));
        view.line([at(0, -w), at(e.length, -w), at(e.length, w), at(0, w), at(0, -w)], color, .85);
        view.line([at(front, -w), at(front, w)], 0xffe08a, .95);
      }
      else if (e.kind === 'beam') {for (const seg of e.segments ?? []) view.line([[seg.a.x, e.y ?? .9, seg.a.z], [seg.b.x, e.y ?? .9, seg.b.z]], 0xff5de8, .9);}
      else if (e.shape === 'circle' && (e.radius ?? 0) > 0) cylinder(view, x, z, e.radius, y0, y0 + (e.height ?? 2), e.kind === 'area' || e.kind === 'trap' ? ((e.startup ?? 0) > (e.age ?? 0) ? 0xffe08a : 0xff4a4a) : 0x73caff, .85);
      else if (e.shape === 'box' && e.hx) {
        const a = e.angle ?? 0, c = Math.cos(a), sn = Math.sin(a), corner = (u, v) => [x + u * c + v * sn, z - u * sn + v * c];
        const pts = [corner(-e.hx, -e.hz), corner(e.hx, -e.hz), corner(e.hx, e.hz), corner(-e.hx, e.hz)];
        for (const yy of [y0, y0 + (e.height ?? 1)]) view.line([...pts, pts[0]].map(([px, pz]) => [px, yy, pz]), e.kind === 'area' ? 0xff4a4a : 0x73caff, .85);
        for (const [px, pz] of pts) view.line([[px, y0, pz], [px, y0 + (e.height ?? 1), pz]], e.kind === 'area' ? 0xff4a4a : 0x73caff, .6);
      }
    }
  }
  if (O.hurtbox) {
    for (const f of fighters) {
      if (f.hp <= 0 || f.absent) continue;
      const y0 = (f.flight?.y ?? f.groundY ?? 0) + (f.vaultHeight ?? 0), inv = isInvulnerable(f);
      box(view, f.position.x, f.position.z, half, half, y0, y0 + V.bodyHeight, inv ? 0x9aa0a8 : 0x5dff9a, .85);
    }
  }
  if (O.displacement) {
    for (const f of fighters) {
      const d = dashDisplacement(f), now = collisionProbe.step;
      if (d) lastDash.set(f.id, {...d, step: now});
      const r = d ?? lastDash.get(f.id);if (!r || (!d && now - r.step > MAX_AGE_STEPS)) continue;
      const y = .12, o = r.origin;
      view.line([[o.x, y, o.z], [o.x + r.dir.x * r.intended, y, o.z + r.dir.z * r.intended]], 0x5dff9a, .9);
      view.line([[o.x, y + .05, o.z], [o.x + r.dir.x * r.traveled, y + .05, o.z + r.dir.z * r.traveled]], 0xffffff, .95);
    }
  }
  if (O.sweeps) {
    for (const s of collisionProbe.sweeps) if (collisionProbe.step - s.step <= 30) view.line([[s.a.x, .65, s.a.z], [s.b.x, .65, s.b.z]], 0xffd34d, .85);
    for (const s of collisionProbe.hits) if (collisionProbe.step - s.step <= MAX_AGE_STEPS) {
      view.ring(s.hit.x, s.hit.z, .18, 0xff4a4a, 0, Math.PI * 2, .65);
      view.line([[s.a.x, .65, s.a.z], [s.hit.x, .65, s.hit.z]], 0xff9a4a, .9);
    }
  }
  if (O.overlaps && ms) {
    for (const {a, b, gap} of solidPairs(ms)) view.line([[a.x, .15, a.z], [b.x, .15, b.z]], gap < 0 ? 0xff4a4a : 0xffa040, .95);
    for (const f of fighters) if (groundPenetration(ms, f) > 1e-3) view.ring(f.position.x, f.position.z, .7, 0xff4a4a, 0, Math.PI * 2, .08);
  }
}

/** Linhas do painel «Dados ao vivo» sobre colisão e apoio: [[rótulo, texto]]. */
export function collisionRows(game) {
  const rows = [], names = ['Azul', 'Vermelho'], ms = game.mapState;
  game.fighters.forEach((f, i) => {
    const s = f.support;
    rows.push([`${names[i]} · apoio`, f.flight ? `em voo (alt ${f.flight.y.toFixed(2)} m)` : s ? `${s.kind}${s.id != null ? ` ${s.id}` : ''} a ${s.y.toFixed(2)} m · há ${s.age} passos` : '—']);
    const r = collisionProbe.byFighter[f.id], age = r ? collisionProbe.step - r.step : Infinity;
    rows.push([`${names[i]} · último contato`, r && age <= MAX_AGE_STEPS ? `${r.kind}${r.id != null ? ` ${r.id}` : ''} · prof. ${(r.depth * 100).toFixed(1)} cm · normal (${r.normal.x.toFixed(2)}, ${r.normal.z.toFixed(2)}) · v ${Math.hypot(r.vBefore.x, r.vBefore.z).toFixed(1)} → ${Math.hypot(r.vAfter.x, r.vAfter.z).toFixed(1)} m/s · há ${age} passos` : '—']);
  });
  game.fighters.forEach((f, i) => {
    const d = dashDisplacement(f);
    if (d) rows.push([`${names[i]} · deslocamento`, `${d.kind}: ${d.traveled.toFixed(2)} m de ${d.intended.toFixed(2)} m pretendidos (${d.intended > 0 ? Math.round(100 * d.traveled / d.intended) : 0}%)${d.friction > 1e-3 ? ` · atrito tirou ${d.friction.toFixed(2)} m` : ''}`]);
  });
  const bad = ms ? solidPairs(ms) : [], over = bad.filter(p => p.gap < 0).length;
  rows.push(['Objetos do cenário', `${bad.length} par(es) com vão < ${(C.map?.passageClearance ?? 1.2).toFixed(1)} m (${over} sobrepostos) · ${ms?.placementConflicts ?? 0} sem posição válida`]);
  const pens = ms ? game.fighters.map((f, i) => ({i, p: groundPenetration(ms, f)})).filter(x => x.p > 1e-3) : [];
  rows.push(['Penetração em sólidos', pens.length ? pens.map(x => `${names[x.i]} ${(x.p * 100).toFixed(1)} cm`).join(' · ') : 'nenhuma']);
  return rows;
}
