// @ts-check
// Fase 5 (Rapier, prova de conceito): a física principal do Arenamon NÃO é substituída. Aqui o mesmo conjunto de cenários
// roda na física atual e em Rapier (API JS direta, WASM embutido) e comparamos colisão, estabilidade, determinismo e custo.
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {POC_IDS, POC_SCENARIOS} from '../src/physics-poc/poc-scenarios.js';
import {battery, runAll, evaluate, CRITERIA} from '../src/physics-poc/poc-report.js';
import {determinismArenamon, determinismRapier, benchRapier, benchArenamon, median} from '../src/physics-poc/poc-bench.js';
import {penetration} from '../src/physics-poc/poc-metrics.js';
import {rapierDefaults, runRapier} from '../src/physics-poc/poc-rapier.js';

registerStandardMoves();
let passed = 0, failed = 0;
const pending = [];
function test(name, fn) {pending.push([name, fn]);}
console.log('\n--- FASE 5: RAPIER (prova de conceito, física principal intacta) ---\n');

const t0 = performance.now();
await RAPIER.init();
const initMs = performance.now() - t0;

test(`Rapier inicializa em ${initMs.toFixed(0)} ms (WASM embutido, sem rede) — versão ${RAPIER.version()}`, () => {
  assert.ok(RAPIER.version().startsWith('0.'));assert.ok(initMs < 2000);
});
const all = battery(RAPIER);
const get = (id, engine) => all.rows.find(r => r.id === id).checks.filter(c => c.engine === engine);
const res = (id, engine) => all.rows.find(r => r.id === id).results[engine];

test('oráculo de penetração: encostar não é penetrar; sobrepor é', () => {
  const s = {id: 'b', shape: 'box', x: 0, z: 0, hx: 1, hz: 1, r: 0, base: 0, top: 2};
  assert.equal(penetration({x: 1.5, y: 0, z: 0}, s), 0);                  // face a face exata (1 + 0,5)
  assert.ok(Math.abs(penetration({x: 1.4, y: 0, z: 0}, s) - .1) < 1e-9);
  assert.equal(penetration({x: 0, y: 2, z: 0}, s), 0);                    // em cima
  assert.equal(penetration({x: 0, y: -1.3, z: 0}, s), 0);                 // por baixo (cabeça na base)
});
for (const id of POC_IDS) for (const engine of ['arenamon', 'box']) {
  // o encaixe de caixa em cilindro trava de frente — esperado e documentado (cápsula resolve)
  const knownStuck = id === 'pilar' && engine === 'box';
  test(`${id} · ${engine}: ${CRITERIA[id].map(c => c[0]).join(' · ')}${knownStuck ? ' (esperado: TRAVA — caixa × cilindro)' : ''}`, () => {
    const checks = get(id, engine);
    if (knownStuck) assert.ok(checks.some(c => !c.ok), 'a caixa deveria travar de frente no cilindro (limitação conhecida)');
    else for (const c of checks) assert.ok(c.ok, `${c.text} — ${JSON.stringify({final: res(id, engine).final, pen: res(id, engine).penetration, maxY: res(id, engine).maxY})}`);
  });
}
for (const id of POC_IDS) test(`${id} · cápsula: critérios (exceto penetração, que o oráculo de caixa superestima em cantos redondos)`, () => {
  for (const c of get(id, 'capsule')) if (!/penetra/.test(c.text)) assert.ok(c.ok, `${c.text} — ${JSON.stringify(res(id, 'capsule').final)}`);
});
test('tunelamento a 40 m/s: nenhum dos dois atravessa a parede de 0,2 m', () => {
  for (const e of ['arenamon', 'box', 'capsule']) assert.ok(res('tunel', e).final.z <= 5.41, `${e}: z=${res('tunel', e).final.z}`);
});
test('Rapier sem CCD também não atravessa (o controlador cinemático faz shape-cast)', () => {
  const r = runRapier(RAPIER, POC_SCENARIOS.tunel, {opts: {...rapierDefaults(), ccd: 0}});
  assert.ok(r.final.z <= 5.41);r.sim.dispose();
});
test('snap-to-ground: sem ele o personagem termina flutuando ~5,7 cm acima do chão ao descer da plataforma; com ele, rente (1 cm de pele)', () => {
  const a = runRapier(RAPIER, POC_SCENARIOS.borda, {opts: {...rapierDefaults(), snapDistance: 0}}), b = runRapier(RAPIER, POC_SCENARIOS.borda);
  assert.ok(a.final.y > .03 && a.final.y < .1, `sem snap: ${a.final.y}`);assert.ok(b.final.y <= .02, `com snap: ${b.final.y}`);a.sim.dispose();b.sim.dispose();
});
test('autostep ligado sobe degraus sem salto (comportamento que o Arenamon NÃO quer): documentado', () => {
  const sc = {...POC_SCENARIOS.salto_plataforma, script: [{from: 0, to: 200, move: [0, 1]}]};
  const off = runRapier(RAPIER, sc), on = runRapier(RAPIER, sc, {opts: {...rapierDefaults(), autostep: 1, autostepHeight: 1.05}});
  assert.ok(off.final.y < .1, 'sem autostep, sem salto não sobe');assert.ok(on.final.y > .9, 'com autostep sobe a plataforma de 1,0 m sem pular');
  off.sim.dispose();on.sim.dispose();
});

for (const id of POC_IDS) test(`determinismo · ${id}: repetição idêntica e save/load (Arenamon) / snapshot (Rapier) reproduzem o mesmo futuro`, async () => {
  const a = await determinismArenamon(POC_SCENARIOS[id]), r = await determinismRapier(RAPIER, POC_SCENARIOS[id]);
  assert.ok(a.repeat && a.saveLoad, 'Arenamon');assert.ok(r.repeat && r.saveLoad, 'Rapier');
});

test('desempenho: custo por passo (informativo) — Arenamon vs Rapier com 2 lutadores', () => {
  const a = median(() => benchArenamon(300)), r2 = median(() => benchRapier(RAPIER, 2, 300)), r50 = median(() => benchRapier(RAPIER, 50, 200), 3);
  console.log(`      Arenamon: Game.step completo ${a.fullStepUs.toFixed(0)} µs · só física ${a.physicsOnlyUs.toFixed(0)} µs | Rapier: 2 personagens ${r2.toFixed(0)} µs · 50 personagens ${r50.toFixed(0)} µs (orçamento 120 Hz = 8333 µs)`);
  assert.ok(a.fullStepUs < 8333 && r2 < 8333);
});

for (const [name, fn] of pending) {
  try {await fn();passed++;console.log(`  ✓ ${name}`);} catch (e) {failed++;console.error(`  ✗ ${name}: ${e.message}`);}
}
console.log(`\n${passed} passaram, ${failed} falharam`);
void runAll;void evaluate;
if (failed) process.exit(1);
