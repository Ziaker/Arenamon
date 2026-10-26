// Sincronia entre janelas do Estúdio de Moves (fase 6): duas «janelas» falsas ligadas por um canal em memória.
// Uso: node prototypes/combat-lab/test/moves-sync.test.mjs
import assert from 'node:assert/strict';
import {createMovesSync} from '../src/editor/moves-sync.js';

let tests = 0;const failures = [];
const check = (name, fn) => {try {fn();tests++;console.log('✓', name);} catch (e) {failures.push(name);console.log('✗', name, '—', String(e.message).split('\n')[0]);}};

/** Barramento em memória que imita o BroadcastChannel (entrega síncrona a todos os outros). */
function bus() {
  const members = [];
  return () => {const me = {onmessage: null, postMessage: m => {for (const o of members) if (o !== me) o.onmessage?.({data: structuredClone(m)});}, close() {}};members.push(me);return me;};
}
/** Ajustador mínimo: valores, onChange e setTransient, como o de ui/tuning.js. */
function fakeTuning(values) {
  const listeners = new Set(), v = {...values};
  const emit = () => {for (const fn of listeners) fn();};
  return {v, onChange: fn => listeners.add(fn), snapshotValues: () => ({...v}), setTransient: ch => {let n = 0;for (const [p, x] of ch) if (v[p] !== x) {v[p] = x;n++;}if (n) emit();return n;}, set(p, x) {v[p] = x;emit();}};
}
const pair = (opts = {}) => {
  const join = bus(), remote = [];
  const A = fakeTuning({'world.swift.damage': 3, 'extras.toggles.enableEnemyAI': 1}), B = fakeTuning({'world.swift.damage': 3, 'extras.toggles.enableEnemyAI': 1});
  const va = {swift: {starScale: 1}}, vb = {swift: {starScale: 1}};
  const sa = createMovesSync({tuning: A, visualParams: va, channel: join(), storage: null, local: opts.local ?? [], id: 'a'});
  const sb = createMovesSync({tuning: B, visualParams: vb, channel: join(), storage: null, local: opts.local ?? [], id: 'b', onRemote: m => remote.push(m.kind)});
  return {A, B, va, vb, sa, sb, remote};
};

check('mudança de mecânica numa janela vale na outra', () => {
  const {A, B, remote} = pair();
  A.set('world.swift.damage', 7);
  assert.equal(B.v['world.swift.damage'], 7);assert.deepEqual(remote, ['tuning']);
});
check('aplicar o que veio de fora não ecoa de volta (sem laço)', () => {
  const {A, B, sa, sb} = pair();
  A.set('world.swift.damage', 7);
  assert.equal(sa.stats.sent, 1);assert.equal(sb.stats.sent, 0, 'B não reenviou');assert.equal(sb.stats.received, 1);
  B.set('world.swift.damage', 9);assert.equal(A.v['world.swift.damage'], 9);
});
check('caminhos locais (IA parada do Estúdio) nunca saem da janela', () => {
  const {A, B} = pair({local: ['extras.toggles.enableEnemyAI']});
  A.set('extras.toggles.enableEnemyAI', 0);
  assert.equal(B.v['extras.toggles.enableEnemyAI'], 1);
});
check('caminho desconhecido na outra janela é ignorado', () => {
  const {B, sa} = pair();void sa;
  const join = bus(), ch = join(), other = join();
  createMovesSync({tuning: B, visualParams: {}, channel: ch, storage: null, id: 'x'});
  other.postMessage({kind: 'tuning', changes: [['world.inexistente.x', 1]], from: 'y', n: 1});
  assert.equal('world.inexistente.x' in B.v, false);
});
check('parâmetro visual (aprovado do atelier) vai para a outra janela', () => {
  const {sa, vb, remote} = pair();
  sa.sendVisual('swift', 'starScale', 1.4);
  assert.equal(vb.swift.starScale, 1.4);assert.deepEqual(remote, ['visual']);
});
check('a mesma mensagem por dois caminhos (canal e localStorage) é aplicada uma vez', () => {
  const join = bus(), T = fakeTuning({'world.swift.damage': 3});let applied = 0;
  const ch = join(), sender = join();
  createMovesSync({tuning: T, visualParams: {}, channel: ch, storage: null, id: 'r', onRemote: () => applied++});
  const m = {kind: 'tuning', changes: [['world.swift.damage', 5]], from: 's', n: 1};
  sender.postMessage(m);sender.postMessage(m);
  assert.equal(applied, 1);
});

console.log(`Sincronia do Estúdio de Moves: ${tests} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) process.exit(1);
