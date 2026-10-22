// Fase 5 do overhaul — colocação de objetos do cenário sem sobreposição com lutadores (R3.13, R9.12, R10.6, R11.9).
// Origem (4634ca2): (1) 12 de 1500 seeds nasciam com um lutador sobre a plataforma (initMap sorteava as plataformas SEM olhar as posições
// iniciais dos lutadores); (2) um destrutível em prévia (ghost) se materializava sobre um lutador na diagonal (287 de 3978 posições testadas,
// até 22 cm), porque a checagem usava só a distância entre centros (1,5 m) e ignorava que o corpo é um quadrado de 1 m e o objeto, 1,6 × 1,6 m.
// Contrato: um objeto sólido nunca é materializado com o corpo de um lutador (na mesma altura) sobreposto ou mais perto que
// `map.spawnClearance` (distância mínima configurável); se não houver posição válida, a materialização é adiada.
// Uso: node prototypes/combat-lab/test/map-placement.test.mjs
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
/** Folga (m) entre o corpo quadrado do lutador e uma caixa alinhada aos eixos; negativa = sobreposição. */
const gapToBox = (p, box) => Math.max(Math.abs(p.x - box.x) - box.hx - C.test.halfExtent, Math.abs(p.z - box.z) - box.hz - C.test.halfExtent);

check('parâmetro configurável: map.spawnClearance existe (padrão 0,6 m), tem rótulo e aparece num grupo do painel', () => {
  assert.equal(C.map.spawnClearance, 0.6);
  assert.ok(NAMES.spawnClearance, 'sem rótulo em NAMES');
  assert.ok(SECTIONS.some(s => Array.isArray(s[2]) && s[2].includes('spawnClearance')), 'fora de todos os grupos do painel');
});
check('geração: em 1500 seeds nenhum lutador nasce sobreposto nem a menos de spawnClearance de uma plataforma, obstáculo ou destrutível', () => {
  const bad = [];
  for (let seed = 1; seed <= 1500; seed++) {
    resetConfig(defaults());
    const g = new Game({seed});g.start();
    const boxes = [
      ...g.mapState.platforms.map(p => ({id: p.id, x: p.pos.x, z: p.pos.z, hx: p.width / 2, hz: p.depth / 2})),
      ...g.mapState.obstacles.map(o => ({id: o.id, x: o.pos.x, z: o.pos.z, hx: o.hx ?? o.radius, hz: o.hz ?? o.radius})),
      ...g.mapState.destructibles.map(d => ({id: d.id, x: d.pos.x, z: d.pos.z, hx: d.size.hx, hz: d.size.hz})),
    ];
    for (const f of g.fighters) for (const b of boxes) if (gapToBox(f.position, b) < C.map.spawnClearance - 1e-9) bad.push(`seed ${seed}: ${b.id} a ${gapToBox(f.position, b).toFixed(2)} m`);
  }
  assert.equal(bad.length, 0, `${bad.length} violações; ex.: ${bad.slice(0, 3).join(' | ')}`);
});
check('geração: com muitos objetos (12 + 12) a regra continua valendo e a geração é determinística por seed', () => {
  const once = seed => {resetConfig(defaults());Object.assign(C.map, {obstacleCount: 12, destructibleCount: 12});const g = new Game({seed});g.start();return g;};
  for (let seed = 1; seed <= 200; seed++) {
    const g = once(seed);
    for (const f of g.fighters) for (const p of g.mapState.platforms) assert.ok(gapToBox(f.position, {x: p.pos.x, z: p.pos.z, hx: p.width / 2, hz: p.depth / 2}) >= C.map.spawnClearance - 1e-9, `seed ${seed}`);
  }
  assert.equal(JSON.stringify(once(7).mapState.platforms), JSON.stringify(once(7).mapState.platforms));
});
check('prévia → sólido: o destrutível só se materializa quando o corpo do lutador está fora do quadrado + spawnClearance (grade de 2 cm)', () => {
  let materialized = 0, waited = 0;
  for (let a = 0; a <= 2.2; a += 0.02) for (let b = 0; b <= 2.2; b += 0.02) {
    const ms = createMapState(1);ms.platforms = [];ms.obstacles = [];ms.items = [];
    const d = {id: 'd', hp: 30, maxHp: 30, pos: {x: 0, y: 0, z: 0}, size: {hx: .8, hz: .8, height: 1.6}, shape: 'box', angle: 0, state: 'ghost', respawnTimer: 0, ghostTimer: 0.001, resistances: {}};
    ms.destructibles = [d];
    const f = {id: 0, hp: 100, position: vec(a, b), groundY: 0, flight: null, vaultHeight: 0};
    stepMap(ms, 1 / 120, [f], []);
    if (d.state === 'solid') {
      materialized++;
      assert.ok(gapToBox(f.position, {x: 0, z: 0, hx: .8, hz: .8}) >= C.map.spawnClearance - 1e-9, `materializou com o lutador em (${a.toFixed(2)}, ${b.toFixed(2)}), folga ${gapToBox(f.position, {x: 0, z: 0, hx: .8, hz: .8}).toFixed(3)} m`);
    } else waited++;
  }
  assert.ok(materialized > 1000 && waited > 100, `materializou ${materialized}, adiou ${waited}`);
});
check('prévia → sólido: lutador em outra altura (no ar acima do objeto) não adia a materialização', () => {
  const ms = createMapState(1);ms.platforms = [];ms.obstacles = [];ms.items = [];
  const d = {id: 'd', hp: 30, maxHp: 30, pos: {x: 0, y: 0, z: 0}, size: {hx: .8, hz: .8, height: 1.6}, shape: 'box', angle: 0, state: 'ghost', respawnTimer: 0, ghostTimer: 0.001, resistances: {}};
  ms.destructibles = [d];
  const f = {id: 0, hp: 100, position: vec(0, 0), groundY: 0, flight: {y: 4}, vaultHeight: 0};
  stepMap(ms, 1 / 120, [f], []);
  assert.equal(d.state, 'solid');
});

console.log(`Colocação de objetos do cenário: ${tests} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) process.exit(1);
