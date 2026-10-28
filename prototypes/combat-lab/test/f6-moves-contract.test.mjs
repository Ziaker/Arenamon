// @ts-check
// F6 (Task 14) — Matriz executável dos Moves: todo Move do registro passa pelos contratos compartilhados de dano, reação e evento.
// Cenários e verificações em f6-moves-contract-lib.mjs; a matriz gerada é docs/MATRIZ_MIGRACAO_MOVES_F6.md (node scripts/gen-matriz-moves-f6.mjs).
import {existsSync, readFileSync} from 'node:fs';
import {assert, suite} from './moves-new-helpers.mjs';
import {scenarios, runScenario, checkScenario, registryIds, staticScan, HP_WRITE, HP_WRITE_ALLOW, DEFENSE_MATH, DEFENSE_MATH_ALLOW, buildMatrix, MATRIX_PATH, MOVE_GROUPS} from './f6-moves-contract-lib.mjs';
import {damageLedger, resolveDamage} from '../src/sim/resolvers/damage-resolver.js';

const {test, done} = suite('F6 — MATRIZ EXECUTÁVEL DOS MOVES (contratos de dano, reação e evento)');

test('o resolvedor expõe o livro de transações (damageLedger): conta toda chamada e registra HP/escudo antes e depois', () => {
  assert.ok(damageLedger && typeof damageLedger.count === 'number', 'damageLedger exportado por damage-resolver.js');
  const t = {id: 1, hp: 50, shield: {hp: 3, duration: 5, maxHp: 80}}, n0 = damageLedger.count;
  damageLedger.entries = [];
  /** @type {any[]} */ let got = [];
  try {resolveDamage({target: t, rawDamage: 10, sourceKind: 'direct'});got = damageLedger.entries;} finally {damageLedger.entries = null;}
  assert.equal(damageLedger.count, n0 + 1);
  assert.equal(got.length, 1);
  assert.deepEqual([got[0].targetId, got[0].hpBefore, got[0].hpAfter, got[0].shieldBefore, got[0].shieldAfter, got[0].hpDamage, got[0].shieldAbsorbed], [1, 50, 43, 3, 0, 7, 3]);
});

const ids = registryIds();
test(`registro real com ${ids.length} Moves, todos num grupo do DOCX §13 e com cenário`, () => {
  assert.ok(ids.length >= 19, `registro com ${ids.length}`);
  const grouped = Object.values(MOVE_GROUPS).flat();
  assert.deepEqual(ids.filter(id => !grouped.includes(id)), [], 'Move sem grupo');
  assert.deepEqual(scenarios().filter(s => s.registry).map(s => s.id), ids);
});

for (const sc of scenarios()) {
  test(`${sc.id}: ${sc.how}`, () => {
    const {violations} = checkScenario(sc, runScenario(sc));
    assert.deepEqual(violations.slice(0, 12), [], `${violations.length} violação(ões)`);
  });
}

test('(b) nenhuma escrita de HP/escudo em src/sim fora de resolvers/ e da lista justificada (e nenhuma entrada ociosa)', () => {
  const {fora, ociosas} = staticScan(HP_WRITE, HP_WRITE_ALLOW);
  assert.deepEqual(fora, []);assert.deepEqual(ociosas, []);
});
test('(c) nenhum Move/sistema reimplementa guarda ou estágio de Defesa (guardDamageMultiplier/stageDefenseReduction fora do resolvedor só com justificativa)', () => {
  const {fora, ociosas} = staticScan(DEFENSE_MATH, DEFENSE_MATH_ALLOW);
  assert.deepEqual(fora, []);assert.deepEqual(ociosas, []);
});
test('docs/MATRIZ_MIGRACAO_MOVES_F6.md em dia (rode node scripts/gen-matriz-moves-f6.mjs se falhar)', () => {
  assert.ok(existsSync(MATRIX_PATH), 'matriz não gerada');
  assert.equal(readFileSync(MATRIX_PATH, 'utf8'), buildMatrix());
});

done();
