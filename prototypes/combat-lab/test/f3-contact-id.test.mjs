// @ts-check
// F3.3: o contador de contactId vive no Game (world.contactSeq), não no módulo.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {C, factoryDefaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {clash} from '../src/sim/combat.js';

const cmd = (/** @type {any} */ o) => ({...emptyCommand(), ...o});
function arena() {
  resetConfig(factoryDefaults());
  const g = new Game();g.mode = 'inactive';g.reset({positions: [vec(0, -1.6), vec(0, 1.6)]});g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;return g;
}
/** Um passo: ambos avançam e dão X em i === 5 até colidirem. */
const stepClash = (/** @type {Game} */ g, /** @type {number} */ i) => {g.step(cmd({move: vec(0, 1), tackle: i === 5, target: 1}), cmd({move: vec(0, -1), tackle: i === 5, target: 0}));return g.lastStepEvents.filter((/** @type {any} */ e) => e.result === 'clash');};

test('F3.3: dois Game alternando têm contactIds independentes começando em 1', () => {
  const a = arena(), b = arena();
  const ida = [], idb = [];
  for (let i = 0; i < 160; i++) {
    for (const e of stepClash(a, i)) ida.push(e.contactId);
    for (const e of stepClash(b, i)) idb.push(e.contactId);
  }
  assert.ok(ida.length >= 2, 'A produziu clash');
  assert.deepEqual(ida, idb, 'mesma cena → mesmos ids, sem interferência');
  assert.equal(ida[0], 1);
  assert.equal(a.world.contactSeq, b.world.contactSeq);
});

test('F3.3: save/load de A não altera B; reset reinicia em 1', () => {
  const a = arena(), b = arena();
  const nA = vec(0, 1);
  clash(a.fighters[0], a.fighters[1], nA, a.world);clash(a.fighters[0], a.fighters[1], nA, a.world);
  const snap = a.save();
  clash(a.fighters[0], a.fighters[1], nA, a.world);
  assert.equal(b.world.contactSeq, 0, 'B intocado');
  clash(b.fighters[0], b.fighters[1], nA, b.world);
  assert.equal(b.world.contactSeq, 1);
  a.load(snap);
  assert.equal(a.world.contactSeq, 2);
  assert.equal(b.world.contactSeq, 1, 'load de A não mexe em B');
  assert.equal(clash(a.fighters[0], a.fighters[1], nA, a.world)[0].contactId, 3);
  a.reset();
  assert.equal(clash(a.fighters[0], a.fighters[1], nA, a.world)[0].contactId, 1);
});

test('F3.3: save antigo com clashContactSeq no topo hidrata world.contactSeq', () => {
  const a = arena();
  const snap = a.save();
  delete snap.world.contactSeq;snap.clashContactSeq = 7;
  a.load(snap);
  assert.equal(a.world.contactSeq, 7);
  const snap2 = a.save();delete snap2.world.contactSeq;delete snap2.clashContactSeq;
  a.load(snap2);
  assert.equal(a.world.contactSeq, 0);
});

test('F3.3: clash sem world usa contador local documentado e não toca nenhum Game', () => {
  const a = arena();
  const e = clash(a.fighters[0], a.fighters[1], vec(0, 1));
  assert.ok(Number.isInteger(e[0].contactId) && e[0].contactId >= 1);
  assert.equal(a.world.contactSeq, 0);
});
