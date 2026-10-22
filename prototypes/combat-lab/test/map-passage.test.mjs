// Fase 5 do overhaul (continuação, achada pelo fuzz de partidas da Fase 6) — passagem entre objetos do cenário e correspondência físico × visual.
// Origem (4634ca2, 1500 seeds, padrão 2 plataformas + 4 + 4): 304 layouts (20 %) tinham pelo menos um vão ENTRE sólidos menor que o corpo do lutador
// (mín. 0,31 m): o lutador entra, não cabe e fica espremido (staticConflicts), a IA não consegue sair e o corpo penetra até 7 cm. Além disso, as caixas eram
// sorteadas com ângulo qualquer e DESENHADAS giradas, mas a física sempre as tratou como alinhadas aos eixos (visual ≠ físico).
// Contrato: (1) toda caixa do mapa é alinhada aos eixos (o que se vê é o que colide); (2) o vão entre quaisquer dois sólidos do mapa é ≥ `map.passageClearance`
// (corpo do lutador + folga); sem posição que cumpra isso o objeto mantém a sorteada e conta em mapState.placementConflicts.
// Uso: node prototypes/combat-lab/test/map-passage.test.mjs
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {createMapState, stepMap} from '../src/sim/map.js';
import {vec} from '../src/sim/math.js';
import {NAMES, SECTIONS} from '../src/ui/tuning-meta.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
let tests = 0;const failures = [];
const check = (name, fn) => {try {resetConfig(defaults());fn();tests++;console.log('✓', name);} catch (error) {failures.push(name);console.log('✗', name, '—', String(error.message).split(/\r?\n/)[0]);}};
/** Sólidos do mapa como caixa alinhada (hx, hz) ou círculo (r), em XZ. */
const solidsOf = ms => [
  ...ms.platforms.map(p => ({id: p.id, x: p.pos.x, z: p.pos.z, hx: p.width / 2, hz: p.depth / 2})),
  ...ms.obstacles.map(o => o.shape === 'box' ? {id: o.id, x: o.pos.x, z: o.pos.z, hx: o.hx, hz: o.hz} : {id: o.id, x: o.pos.x, z: o.pos.z, r: o.radius}),
  ...ms.destructibles.filter(d => d.state === 'solid' || d.state === 'ghost').map(d => ({id: d.id, x: d.pos.x, z: d.pos.z, hx: d.size.hx, hz: d.size.hz})),
];
/** Vão exato entre duas formas; negativo = sobreposição. */
const gap = (a, b) => {
  if (a.r != null && b.r != null) return Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r;
  if (a.r != null || b.r != null) {
    const [c, k] = a.r != null ? [a, b] : [b, a], dx = Math.max(Math.abs(c.x - k.x) - k.hx, 0), dz = Math.max(Math.abs(c.z - k.z) - k.hz, 0);
    return dx === 0 && dz === 0 ? -(c.r + Math.min(k.hx - Math.abs(c.x - k.x), k.hz - Math.abs(c.z - k.z))) : Math.hypot(dx, dz) - c.r;
  }
  const dx = Math.abs(a.x - b.x) - a.hx - b.hx, dz = Math.abs(a.z - b.z) - a.hz - b.hz;
  return dx > 0 && dz > 0 ? Math.hypot(dx, dz) : Math.max(dx, dz);
};
const PASSAGE = 1.2;   // corpo do lutador (2 × 0,5) + folga 0,2; o parâmetro map.passageClearance deve valer isto por padrão
const worst = (ms) => {
  const S = solidsOf(ms);let min = Infinity, pair = '';
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {const g = gap(S[i], S[j]);if (g < min) {min = g;pair = `${S[i].id}×${S[j].id}`;}}
  return {min, pair};
};

check('parâmetro configurável: map.passageClearance existe (padrão 1,2 m = corpo 1,0 + folga 0,2), tem rótulo e aparece num grupo do painel', () => {
  assert.equal(C.map.passageClearance, 1.2);
  assert.ok(NAMES.passageClearance, 'sem rótulo em NAMES');
  assert.ok(SECTIONS.some(s => Array.isArray(s[2]) && s[2].includes('passageClearance')), 'fora de todos os grupos do painel');
});
check('visual = físico: toda caixa do mapa (obstáculo ou destrutível) nasce alinhada aos eixos (a física não gira caixas)', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const g = new Game({seed});g.start();
    for (const o of g.mapState.obstacles) if (o.shape === 'box') assert.equal(o.angle, 0, `seed ${seed} ${o.id}: ângulo ${o.angle}`);
    for (const d of g.mapState.destructibles) assert.equal(d.angle, 0, `seed ${seed} ${d.id}: ângulo ${d.angle}`);
  }
});
check('geração padrão (1500 seeds): nenhum vão entre sólidos menor que passageClearance e nenhum conflito de colocação', () => {
  const bad = [];
  for (let seed = 1; seed <= 1500; seed++) {
    resetConfig(defaults());
    const g = new Game({seed});g.start();
    const w = worst(g.mapState);
    if (w.min < PASSAGE - 1e-9 || g.mapState.placementConflicts > 0) bad.push(`seed ${seed}: ${w.pair} a ${w.min.toFixed(2)} m, conflitos ${g.mapState.placementConflicts}`);
  }
  assert.equal(bad.length, 0, `${bad.length} layouts; ex.: ${bad.slice(0, 3).join(' | ')}`);
});
check('geração densa (8 + 8): a regra vale em todo layout sem conflito registrado; os com conflito são contados, nunca silenciosos', () => {
  let conflicts = 0;const bad = [];
  for (let seed = 1; seed <= 400; seed++) {
    resetConfig(defaults());Object.assign(C.map, {obstacleCount: 8, destructibleCount: 8});
    const g = new Game({seed});g.start();
    if (g.mapState.placementConflicts > 0) {conflicts++;continue;}
    const w = worst(g.mapState);
    if (w.min < PASSAGE - 1e-9) bad.push(`seed ${seed}: ${w.pair} a ${w.min.toFixed(2)} m`);
  }
  assert.equal(bad.length, 0, `${bad.length} layouts; ex.: ${bad.slice(0, 3).join(' | ')}`);
  assert.ok(conflicts < 400 * 0.25, `${conflicts} de 400 layouts densos sem posição válida`);
});
check('RNG do mapa: o estado final da RNG por seed é IDÊNTICO ao do baseline 4634ca2 (a regra de vão e o ângulo 0 não consomem nem pulam sorteios)', () => {
  const baseline = {1: 2001984000, 2: 1385973981, 3: 769963962, 7: 2600891182, 99: 1762544282, 1234: 2670841965};   // medido no 4634ca2
  for (const [seed, rng] of Object.entries(baseline)) {resetConfig(defaults());const g = new Game({seed: +seed});g.start();assert.equal(g.mapState.rngState, rng, `seed ${seed}`);}
  const once = seed => {resetConfig(defaults());const g = new Game({seed});g.start();return JSON.stringify([g.mapState.platforms, g.mapState.obstacles, g.mapState.destructibles, g.mapState.items]);};
  for (const seed of [1, 7, 99]) assert.equal(once(seed), once(seed));
});
check('respawn: o destrutível que volta (prévia) também respeita a passagem em relação aos demais sólidos', () => {
  for (let seed = 1; seed <= 150; seed++) {
    resetConfig(defaults());
    const g = new Game({seed});g.start();
    const ms = g.mapState, d = ms.destructibles[0];
    d.state = 'dead';d.hp = 0;d.respawnTimer = 1.5;   // abaixo da janela da prévia: sorteia posição já neste passo
    stepMap(ms, 1 / 120, g.fighters, []);
    assert.equal(d.state, 'ghost', `seed ${seed}`);
    const S = solidsOf(ms), me = S.find(s => s.id === d.id);
    for (const o of S) if (o !== me) assert.ok(gap(me, o) >= PASSAGE - 1e-9, `seed ${seed}: ${d.id}×${o.id} a ${gap(me, o).toFixed(2)} m`);
  }
});

console.log(`Passagem entre objetos do cenário: ${tests} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) process.exit(1);
