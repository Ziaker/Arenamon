// Fase 7 do overhaul — os 15 cenários de um clique de colisão (src/sim/scenarios-collision.js) rodam sem interface e passam em todas as verificações.
// Eles também aparecem na lista «Cenários» do laboratório (SCENARIOS), onde o usuário os executa com um clique.
// Uso: node prototypes/combat-lab/test/collision-scenarios.test.mjs
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {SCENARIOS, runScenario} from '../src/sim/scenarios.js';
import {COLLISION_SCENARIOS} from '../src/sim/scenarios-collision.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
let tests = 0;const failures = [];
const check = (name, fn) => {try {resetConfig(defaults());fn();tests++;console.log('✓', name);} catch (error) {failures.push(name);console.log('✗', name, '—', String(error.message).split(/\r?\n/)[0]);}};

check('são 15 cenários, com ids únicos «col-…» e todos listados na interface (SCENARIOS)', () => {
  assert.equal(COLLISION_SCENARIOS.length, 15);
  assert.equal(new Set(COLLISION_SCENARIOS.map(s => s.id)).size, 15);
  for (const s of COLLISION_SCENARIOS) assert.ok(s.id.startsWith('col-') && s.name && s.description && SCENARIOS.includes(s), s.id);
});
for (const def of COLLISION_SCENARIOS) {
  check(`${def.id}: ${def.name}`, () => {
    const r = runScenario(def);
    const bad = r.checks.filter(c => !c.ok).map(c => `${c.label} (esperado ${c.expected}, obtido ${c.actual})`);
    assert.equal(bad.length, 0, bad.join(' | '));
    assert.ok(r.checks.length >= 2, 'poucas verificações');
  });
}
check('os cenários restauram a configuração (overrides não vazam)', () => {
  const before = JSON.stringify([C.map.arenaShape, C.map.arenaRadius, C.map.destructibleRespawnMin, C.map.destructibleRespawnMax, C.map.destructibleGhostPreview]);
  for (const def of COLLISION_SCENARIOS) runScenario(def);
  assert.equal(JSON.stringify([C.map.arenaShape, C.map.arenaRadius, C.map.destructibleRespawnMin, C.map.destructibleRespawnMax, C.map.destructibleGhostPreview]), before);
});

console.log(`Cenários de colisão: ${tests} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) process.exit(1);
