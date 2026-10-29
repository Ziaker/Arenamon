// @ts-check
// F9 (revisão final, I2): o alcance livre do Sand Wave (freeReachOf) era remarchado a cada quadro em passos de ¼ de célula, cada passo com um
// segmentClear desde a origem (custo quadrático, ~1,3–2,5 ms por onda por quadro, inclusive pausado e na dissipação). Agora o resultado fica em
// cache por entidade, chaveado pelo registro do campo da simulação (troca a cada replanSteps ou quando os sólidos mudam) e pela geometria da onda.
// Prova: a cada passo e em quadros repetidos sem passo (pausa), o valor é IDÊNTICO ao da implementação antiga (cópia abaixo, oráculo), nos
// mesmos casos de obstáculo ao lado, bloqueio no eixo, diagonal e destrutível removido do f5-vfx-coords; e o custo por chamada é medido.
import assert from 'node:assert/strict';
import {test} from 'node:test';
// DOM mínimo (ElementalPreview e a areia do ateliê criam texturas em canvas 2D).
const ctx2d = /** @type {any} */ (new Proxy(function () {}, {get: (t, k) => k === 'canvas' ? null : (k in t ? /** @type {any} */ (t)[k] : ctx2d), set: () => true, apply: () => ctx2d}));
const el = () => ({style: {}, classList: {add() {}, remove() {}, toggle() {}, contains: () => false}, children: /** @type {any[]} */ ([]), appendChild(/** @type {any} */ c) {this.children.push(c);return c;}, removeChild() {}, remove() {}, setAttribute() {}, addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getContext: () => ctx2d, getBoundingClientRect: () => ({width: 0, height: 0, left: 0, top: 0}), clientWidth: 0, clientHeight: 0, width: 0, height: 0, dataset: {}});
const G = /** @type {any} */ (globalThis);
G.document ??= {getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, body: el(), documentElement: el()};
const sandVfx = await import('../src/sim/moves/sand-wave/sand-wave.vfx.js');
const {sandFieldOf, sandPathDistance} = await import('../src/sim/sand.js');
const {arena, cmd, vec, secs, HOLD, resetConfig, factoryDefaults} = await import('./moves-new-helpers.mjs');

/** ORÁCULO: freeReachOf como estava antes da F9 (sem cache), copiado literalmente. @param {any} e */
function oldFreeReachOf(e, pathDist = (/** @type {{x: number, z: number}} */ p) => sandPathDistance(e, p)) {
  const len = e?.length ?? 4, field = e ? sandFieldOf(e) : null;
  if (!field || !e?.pos || !e?.dir) return len;
  const ds = field.cs / 4, tol = (/** @type {number} */ u) => 1.5 * field.cs + .09 * u;
  for (let u = ds; u <= len + 1e-9; u += ds) {
    const d = pathDist({x: e.pos.x + e.dir.x * u, z: e.pos.z + e.dir.z * u});
    if (d == null) return len;
    if (!Number.isFinite(d) || d - u > tol(u)) return Math.min(len, u - ds);
  }
  return len;
}

/** Sand Wave real (mesmo arranjo do f5-vfx-coords); a cada passo compara novo × oráculo e chama 3× sem passo (quadros pausados). */
function compare({deg = 0, redU = 3.7, obstacles = /** @type {any[]} */ ([]), destructibles = /** @type {any[]} */ ([]), each = /** @type {(g: any, i: number) => void} */ (() => {}), steps = secs(2.5)} = {}) {
  const a = deg * Math.PI / 180, d = {x: Math.sin(a), z: Math.cos(a)};
  const g = arena({equip: ['sand-wave'], positions: [vec(0, 0), vec(d.x * redU, d.z * redU)]});
  g.mapState.obstacles = obstacles;g.mapState.destructibles = destructibles;g.fighters[0].facing = a;
  g.step(cmd({skill: 0, skillHeld: HOLD(0)}), cmd());
  let w = /** @type {any} */ (null), frames = 0;
  const diffs = /** @type {string[]} */ ([]), seen = new Set();
  for (let i = 0; i < steps; i++) {
    each(g, i);g.step(cmd(), cmd());
    w ??= g.world.entities.find((/** @type {any} */ e) => e.kind === 'sandwave') ?? null;
    if (!w) continue;
    for (let k = 0; k < 3; k++) {   // 3 quadros de render por passo (o 2º e o 3º são "pausados": o campo não mudou)
      const n = sandVfx.freeReachOf(w), o = oldFreeReachOf(w);frames++;seen.add(o);
      if (n !== o) diffs.push(`passo ${i} quadro ${k}: novo ${n} × antigo ${o}`);
    }
  }
  return {diffs, frames, seen, w};
}

test('freeReachOf com cache = implementação antiga, quadro a quadro (lado, eixo, diagonal, destrutível removido, dissipação)', () => {
  try {
    const cases = /** @type {{name: string, opts: any}[]} */ ([]);
    for (const deg of [0, 22.5, 45, 67.5]) for (const gap of [.15, .3, 1.2]) for (const shape of ['pillar', 'box', 'circle']) {
      const a = deg * Math.PI / 180, d = {x: Math.sin(a), z: Math.cos(a)}, side = {x: d.z, z: -d.x}, r = .5;
      const off = gap + (shape === 'box' ? r * (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a))) : r), c = {x: d.x * 2 + side.x * off, z: d.z * 2 + side.z * off};
      const ob = shape === 'circle' ? {id: 'o', shape, pos: {x: c.x, y: 0, z: c.z}, radius: r, height: 2} : {id: 'o', shape, pos: {x: c.x, y: 0, z: c.z}, hx: r, hz: r, radius: r, height: 2, angle: 0};
      cases.push({name: `lado ${deg}° ${gap} ${shape}`, opts: {deg, obstacles: [ob]}});
    }
    for (const deg of [0, 30]) {const a = deg * Math.PI / 180, d = {x: Math.sin(a), z: Math.cos(a)};cases.push({name: `parede no eixo ${deg}°`, opts: {deg, redU: 9, obstacles: [{id: 'w', shape: 'box', pos: {x: d.x * 2.4, y: 0, z: d.z * 2.4}, hx: 6, hz: .4, radius: 6, height: 2, angle: 0}]}});}
    const rock = () => ({id: 'd1', hp: 30, maxHp: 30, pos: {x: 0, y: 0, z: 2}, size: {hx: 1.5, hz: .4, height: 1.6}, hx: 1.5, hz: .4, height: 1.6, shape: 'box', angle: 0, state: 'solid', respawnTimer: 0, ghostTimer: 0});
    cases.push({name: 'rocha removida no passo 40', opts: {redU: 9, destructibles: [rock()], each: (/** @type {any} */ g, /** @type {number} */ i) => {if (i === 40) g.mapState.destructibles = [];}}});
    cases.push({name: 'sem obstáculo', opts: {}});
    const bad = [];let frames = 0, cut = 0;
    for (const c of cases) {const r = compare(c.opts);frames += r.frames;if ([...r.seen].some(v => v < r.w.length)) cut++;if (r.diffs.length) bad.push(`${c.name}: ${r.diffs.slice(0, 3).join('; ')}`);}
    assert.deepEqual(bad, [], bad.join('\n'));
    assert.ok(frames > 5000, `quadros comparados: ${frames}`);
    assert.ok(cut >= 3, `casos com corte real no eixo: ${cut}`);
    console.log(`[f9] ${cases.length} casos · ${frames} quadros idênticos ao oráculo · ${cut} com corte`);
  } finally {resetConfig(factoryDefaults());}
});

test('custo: chamada com cache num mapa com 13 obstáculos é ≪ a marcha antiga (orçamento 0,3 ms por update)', () => {
  try {
    const g = arena({equip: ['sand-wave'], positions: [vec(0, 0), vec(0, 3.7)]});
    // 12 obstáculos espalhados (caixas e pilares) + uma pedra ao lado do eixo: segmentClear deixa de ser trivial
    g.mapState.obstacles = Array.from({length: 12}, (_, k) => ({id: 'o' + k, shape: k % 2 ? 'pillar' : 'box', pos: {x: (k % 4 - 1.5) * 3.1, y: 0, z: Math.floor(k / 4) * 3 - 6}, hx: .5, hz: .5, radius: .5, height: 2, angle: 0}));
    g.mapState.obstacles.push({id: 'lado', shape: 'box', pos: {x: 1, y: 0, z: 2}, hx: .4, hz: .4, radius: .4, height: 2, angle: 0});
    g.fighters[0].facing = 0;g.step(cmd({skill: 0, skillHeld: HOLD(0)}), cmd());
    /** @type {any} */ let w = null;
    for (let i = 0; i < secs(1) && !(w && sandFieldOf(w)); i++) {g.step(cmd(), cmd());w = g.world.entities.find((/** @type {any} */ e) => e.kind === 'sandwave') ?? null;}
    assert.ok(w && sandFieldOf(w), 'onda viva com campo');
    const N = 2000, time = (/** @type {() => any} */ f) => {const t0 = performance.now();for (let i = 0; i < N; i++) f();return (performance.now() - t0) / N;};
    sandVfx.freeReachOf(w);
    const novo = time(() => sandVfx.freeReachOf(w)), antigo = time(() => oldFreeReachOf(w));
    console.log(`[f9] freeReachOf: com cache ${(novo * 1000).toFixed(2)} µs/chamada · marcha antiga ${(antigo * 1000).toFixed(1)} µs/chamada`);
    assert.ok(novo < .3, `com cache ${novo} ms ≥ 0,3 ms`);
    assert.ok(novo < antigo, 'o cache tem de ser mais barato que a marcha');
  } finally {resetConfig(factoryDefaults());}
});
