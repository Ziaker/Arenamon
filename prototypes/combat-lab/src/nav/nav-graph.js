// @ts-check
// Fase 3 (Yuka): grafo de navegação do mapa. A física do Arenamon NÃO muda: aqui só se descreve,
// a partir do mapState, onde dá para andar, saltar e cair. O Yuka (Graph/NavNode/NavEdge/AStar)
// guarda o grafo e busca o caminho; as transições verticais são arestas EXPLÍCITAS ('walk' | 'jump' | 'drop'),
// porque o Yuka não resolve salto nem navegação vertical sozinho.
//
// Modelo: cada sólido (plataforma, obstáculo, destrutível) tem topo; o topo é uma superfície caminhável.
// O chão é a superfície 'ground'. Nós ficam numa grade; arestas ligam nós vizinhos da mesma superfície (walk),
// de uma superfície baixa para uma mais alta que cabe no salto (jump) e de uma alta para uma baixa (drop).
import * as YUKA from 'yuka';
import {C} from '../sim/config.js';

/** Parâmetros do grafo lidos de C (alturas e tamanhos reais da física) + C.extras.nav. */
export function navParams(overrides = {}) {
  const N = C.extras.nav ?? {};
  const jumpHeight = C.map?.jumpHeight ?? 2;
  return {
    spacing: N.spacing ?? 1.5,
    radius: (C.test?.halfExtent ?? .5) + .12,           // folga do colisor do lutador
    bodyHeight: C.extras?.visual?.bodyHeight ?? 1.3,
    stepTol: C.map?.mountTolerance ?? .25,              // diferença de altura que a física sobe sem salto (map.mountTolerance)
    jumpMax: Math.max(0, jumpHeight - (N.jumpMargin ?? .35)),
    jumpReach: N.jumpReach ?? 2.4,
    maxDrop: N.maxDrop ?? 6,
    jumpPenalty: N.jumpPenalty ?? 1,                    // multiplica o custo das arestas de salto (>1 prefere contornar pelo chão)
    dropPenalty: N.dropPenalty ?? 1,                    // idem para quedas
    arena: /** @type {any} */ (arenaOf()),
    blocked: [],                                        // zonas proibidas extras: {x,z,r} ou {x,z,hx,hz}
    ...overrides,
  };
}
function arenaOf() {
  const square = (C.map?.arenaShape ?? 'circle') === 'square';
  return square ? {shape: 'square', half: C.test?.arenaHalf ?? 10.4} : {shape: 'circle', radius: C.map?.arenaRadius ?? 32.5};
}

/** Sólidos do mapa em forma única: footprint (caixa ou cilindro) + base/topo. */
export function collectSolids(mapState) {
  const out = [];
  for (const p of mapState?.platforms ?? []) {
    out.push({id: p.id, kind: 'platform', shape: 'box', x: p.pos ? p.pos.x : p.x, z: p.pos ? p.pos.z : p.z, hx: (p.width ?? 3) / 2, hz: (p.depth ?? 3) / 2, r: 0, base: 0, top: p.height});
  }
  for (const o of mapState?.obstacles ?? []) {
    const base = o.pos?.y ?? 0, cyl = o.shape === 'cylinder' || o.shape === 'pillar';
    out.push({id: o.id, kind: 'obstacle', shape: cyl ? 'cyl' : 'box', x: o.pos.x, z: o.pos.z, hx: o.hx ?? o.radius ?? 1.5, hz: o.hz ?? o.radius ?? 1.5, r: o.radius ?? 1, base, top: base + (o.height ?? 1.5)});
  }
  for (const d of mapState?.destructibles ?? []) {
    if (d.state !== 'solid') continue;   // quebrado/fantasma não bloqueia
    const base = d.pos?.y ?? 0;
    out.push({id: d.id, kind: 'destructible', shape: 'box', x: d.pos.x, z: d.pos.z, hx: d.size?.hx ?? .8, hz: d.size?.hz ?? .8, r: 0, base, top: base + (d.size?.height ?? 1.6)});
  }
  return out;
}
/** O ponto (x,z) está dentro do footprint do sólido, expandido por pad? */
export function insideSolid(s, x, z, pad = 0) {
  if (s.shape === 'cyl') return Math.hypot(x - s.x, z - s.z) <= s.r + pad;
  return Math.abs(x - s.x) <= s.hx + pad && Math.abs(z - s.z) <= s.hz + pad;
}
function insideBlockedZone(zones, x, z, pad) {
  for (const b of zones) {
    if (b.r != null ? Math.hypot(x - b.x, z - b.z) <= b.r + pad : Math.abs(x - b.x) <= b.hx + pad && Math.abs(z - b.z) <= b.hz + pad) return true;
  }
  return false;
}
function insideArena(a, x, z, pad) {
  return a.shape === 'square' ? Math.abs(x) <= a.half - pad && Math.abs(z) <= a.half - pad : Math.hypot(x, z) <= a.radius - pad;
}

/** Assinatura do layout: muda quando o mapa muda (destrutível quebrado, parâmetros) e o grafo precisa ser reconstruído. */
export function layoutSignature(solids, p) {
  return JSON.stringify([solids.map(s => [s.id, s.shape, +s.x.toFixed(2), +s.z.toFixed(2), +s.hx.toFixed(2), +s.hz.toFixed(2), +s.r.toFixed(2), s.base, s.top]), p.spacing, p.jumpMax, p.jumpReach, p.jumpPenalty, p.dropPenalty, p.arena, p.blocked]);
}

export class NavGraph {
  /** @param {any[]} solids @param {ReturnType<typeof navParams>} params */
  constructor(solids, params) {
    this.solids = solids;this.p = params;this.signature = layoutSignature(solids, params);
    this.graph = new YUKA.Graph();this.graph.digraph = true;   // arestas direcionais: subir ≠ descer
    /** @type {{index:number,x:number,z:number,y:number,surface:string}[]} */ this.nodes = [];
    /** @type {Map<string, {type:string, from:number, to:number, edge:any, base:number}>} */ this.edges = new Map();
    this.build();
  }
  /**
   * Alguma coisa sólida ocupa o corpo de um lutador em (x,z) apoiado em y? (ignora o sólido `ignoreId`)
   * @param {number} x @param {number} z @param {number} y @param {string|null} [ignoreId]
   */
  blockedAt(x, z, y, ignoreId = null) {
    const {radius, stepTol, bodyHeight} = this.p;
    for (const s of this.solids) {
      if (s.id === ignoreId) continue;
      if (s.top <= y + stepTol || s.base >= y + bodyHeight) continue;   // abaixo dos pés (sobe sem pular) ou acima da cabeça
      if (insideSolid(s, x, z, radius)) return true;
    }
    return insideBlockedZone(this.p.blocked, x, z, radius);
  }
  /**
   * Linha reta livre para caminhar no nível y? Amostra a cada ~0,35 m.
   * slackA/slackB: trechos iniciais/finais (m) ignorados — um lutador encostado numa parede está legitimamente
   * dentro da folga da parede e não deve ser tratado como "bloqueado".
   */
  clearLine(ax, az, bx, bz, y, /** @type {string|null} */ ignoreId = null, slackA = 0, slackB = 0) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / .35));
    for (let i = 0; i <= n; i++) {
      const t = i / n, along = d * t;
      if (along < slackA || d - along < slackB) continue;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (this.blockedAt(x, z, y, ignoreId) || !insideArena(this.p.arena, x, z, this.p.radius * .6)) return false;
    }
    return true;
  }
  addNode(x, z, y, surface) {
    const index = this.nodes.length;
    this.nodes.push({index, x, z, y, surface});
    this.graph.addNode(new YUKA.NavNode(index, new YUKA.Vector3(x, y, z), {surface}));
    return index;
  }
  link(a, b, type, cost) {
    const e = new YUKA.NavEdge(a, b, cost);
    this.graph.addEdge(e);
    this.edges.set(a + '>' + b, {type, from: a, to: b, edge: e, base: cost});
  }
  build() {
    const {spacing, radius, arena, jumpMax, jumpReach, maxDrop, stepTol} = this.p;
    const R = Number(arena.shape === 'square' ? arena.half : arena.radius);
    // 1) Nós do chão (grade global).
    for (let x = -R; x <= R + 1e-6; x += spacing) for (let z = -R; z <= R + 1e-6; z += spacing) {
      if (insideArena(arena, x, z, radius) && !this.blockedAt(x, z, 0)) this.addNode(+x.toFixed(3), +z.toFixed(3), 0, 'ground');
    }
    // 2) Nós dos topos (grade local de cada sólido que dá para pisar em cima).
    for (const s of this.solids) {
      if (s.top <= stepTol) continue;
      const m = .25, step = Math.min(spacing, 1.2);
      const ex = s.shape === 'cyl' ? s.r : s.hx, ez = s.shape === 'cyl' ? s.r : s.hz;
      const nx = Math.max(1, Math.round((ex * 2 - 2 * m) / step) + 1), nz = Math.max(1, Math.round((ez * 2 - 2 * m) / step) + 1);
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const x = nx === 1 ? s.x : s.x - ex + m + i * (ex * 2 - 2 * m) / (nx - 1), z = nz === 1 ? s.z : s.z - ez + m + j * (ez * 2 - 2 * m) / (nz - 1);
        if (!insideSolid(s, x, z, -m + .001) && !(nx === 1 && nz === 1)) continue;
        if (this.blockedAt(x, z, s.top, s.id)) continue;   // outro sólido ocupa o corpo em cima deste topo
        this.addNode(+x.toFixed(3), +z.toFixed(3), s.top, s.id);
      }
    }
    // 3) Arestas. Índice espacial simples para não comparar todos contra todos.
    const cell = Math.max(spacing, jumpReach) + .01, key = (x, z) => Math.floor(x / cell) + ',' + Math.floor(z / cell), grid = new Map();
    for (const n of this.nodes) {const k = key(n.x, n.z);(grid.get(k) ?? grid.set(k, []).get(k)).push(n);}
    for (const a of this.nodes) {
      const cx = Math.floor(a.x / cell), cz = Math.floor(a.z / cell);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const b of grid.get((cx + i) + ',' + (cz + j)) ?? []) {
        if (a === b) continue;
        const d = Math.hypot(b.x - a.x, b.z - a.z), dy = b.y - a.y;
        if (a.surface === b.surface) {
          if (d <= spacing * 1.5 + .01 && this.clearLine(a.x, a.z, b.x, b.z, a.y, a.surface === 'ground' ? null : a.surface)) this.link(a.index, b.index, 'walk', d);
          continue;
        }
        if (d > jumpReach || d < 1e-6) continue;
        const toSolid = b.surface === 'ground' ? null : b.surface;
        if (Math.abs(dy) <= stepTol) {   // superfícies na mesma altura (plataformas encostadas): anda
          if (d <= spacing * 1.5 + .01 && this.clearLine(a.x, a.z, b.x, b.z, a.y, toSolid)) this.link(a.index, b.index, 'walk', d);
        } else if (dy > 0) {              // sobe: salto
          if (dy <= jumpMax && this.clearLine(a.x, a.z, b.x, b.z, a.y, toSolid)) this.link(a.index, b.index, 'jump', (d + 1.2 + dy) * this.p.jumpPenalty);
        } else if (-dy <= maxDrop && this.clearLine(a.x, a.z, b.x, b.z, b.y, a.surface === 'ground' ? null : a.surface)) {
          this.link(a.index, b.index, 'drop', (d + .4 + .25 * -dy) * this.p.dropPenalty);   // desce: queda
        }
      }
    }
    this.byCell = grid;this.cell = cell;
  }
  /** Nó mais próximo da posição, no nível de altura y (±tol); sem nó no nível, cai para o mais próximo em 3D. */
  nearest(x, z, y, tol = .4) {
    /** @type {any} */ let best = null, bestAny = null;
    let bd = Infinity, bad = Infinity;
    for (const n of /** @type {any[]} */ (this.nodes)) {
      const dd = (n.x - x) ** 2 + (n.z - z) ** 2, dy = Math.abs(n.y - y);
      if (dy <= tol && dd < bd) {bd = dd;best = n;}
      const d3 = dd + (dy * 2) ** 2;
      if (d3 < bad) {bad = d3;bestAny = n;}
    }
    return best ?? bestAny;
  }
  edgeInfo(a, b) {return this.edges.get(a + '>' + b) ?? null;}
  /** Conjunto de nós alcançáveis a partir de src (busca em largura nas arestas direcionais). */
  reachableFrom(src) {
    const seen = new Set([src]), q = [src], out = [];
    while (q.length) {
      const i = q.pop();
      this.graph.getEdgesOfNode(i, out);
      for (const e of out) if (!seen.has(e.to)) {seen.add(e.to);q.push(e.to);}
    }
    return seen;
  }
  /** Caminho de menor custo entre dois nós (A* do Yuka). Devolve índices de nós ou null. */
  path(src, dst) {
    if (src === dst) return [src];
    const star = new YUKA.AStar(this.graph, src, dst).search();
    return star.found ? star.getPath() : null;
  }
  /** Penaliza uma aresta (travou nela): o próximo plano tende a evitá-la. */
  penalize(a, b, factor = 4) {
    const e = this.edges.get(a + '>' + b);
    if (e) e.edge.cost = Math.min(e.edge.cost * factor, e.base * 64);
  }
  resetPenalties() {for (const e of this.edges.values()) e.edge.cost = e.base;}
  stats() {
    const t = {walk: 0, jump: 0, drop: 0};
    for (const e of this.edges.values()) t[e.type]++;
    return {nodes: this.nodes.length, ...t};
  }
}

/** @type {NavGraph|null} */ let cache = null;
/**
 * Grafo em cache: reconstrói só quando o layout muda (determinístico: depende apenas do mapState e dos parâmetros).
 * @param {any} mapState @param {any} [overrides]
 * @returns {NavGraph}
 */
export function getNavGraph(mapState, overrides = {}) {
  const solids = collectSolids(mapState), p = navParams({blocked: mapState?.navBlocked ?? [], ...overrides}), sig = layoutSignature(solids, p);
  if (cache && cache.signature === sig) return cache;
  cache = new NavGraph(solids, p);
  return cache;
}
export function clearNavCache() {cache = null;}
