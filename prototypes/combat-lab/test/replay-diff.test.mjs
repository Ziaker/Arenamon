// @ts-check
// Replay diferencial (#12): execução repetida é idêntica; mutações provocadas acusam o tick e o campo; a configuração é restaurada.
import {assert, C, suite, arena, cmd, vec, resetConfig, factoryDefaults} from './moves-new-helpers.mjs';
import {runRecording, firstDivergence, diffRecording, configHash, normalizeState, hashText} from '../src/sim/replay-diff.js';

const {test, done} = suite('REPLAY DIFERENCIAL');
const meta = {seed: 11, profile: 'tactical', enemyProfile: 'aggressive', mode: 'inactive', moveLoadouts: [['quick-attack'], []]};
/** Tackle em 0, Quick Attack em 90 e guarda em 200: cobre golpe, Move e defesa. */
function makeRec(n = 360) {
  const commands = Array.from({length: n}, (_, t) => cmd({tackle: t === 0, skill: t === 90 ? 0 : -1, skillHeld: [t >= 90 && t < 92, false, false, false], guard: t >= 200 && t < 260, guardPressed: t === 200}));
  return {meta, commands, commands1: null};
}
const prep = () => {arena();C.extras.toggles.enableEnemyAI = 1;};

test('duas execuções da mesma gravação não divergem', () => {
  prep();const rec = makeRec();
  const a = runRecording(rec), b = runRecording(rec);
  assert.equal(a.length, rec.commands.length);
  assert.deepEqual(firstDivergence(a, b), {identical: true, ticks: a.length});
});
test('mudar um valor de regra acusa o primeiro tick, o campo e o contexto', () => {
  prep();const rec = makeRec();
  const { divergence } = diffRecording(rec, {}, {values: {'actions.tackle.cost': C.actions.tackle.cost + .5}});
  assert.equal(divergence.identical, false);
  if (divergence.identical) return;
  assert.ok(divergence.tick <= 3, 'o custo do Tackle aparece no primeiro tick em que o Tackle começa (tick ' + divergence.tick + ')');
  assert.match(divergence.field, /stamina/, 'campo: ' + divergence.field);
  assert.ok(divergence.a !== divergence.b);
});
test('mutação provocada no meio (empurrar o azul) acusa o tick exato', () => {
  prep();const rec = makeRec(200);
  const { divergence } = diffRecording(rec, {}, {mutate: (t, g) => {if (t === 50) g.fighters[0].position.x += .01;}});
  assert.equal(divergence.identical, false);
  if (!divergence.identical) assert.ok(divergence.tick >= 50 && divergence.tick <= 52, 'tick ' + divergence.tick);
});
test('a configuração é restaurada depois da comparação', () => {
  prep();const before = configHash(), guard = C.rules.guardStun;
  diffRecording(makeRec(60), {}, {values: {'rules.guardStun': 3}});
  assert.equal(C.rules.guardStun, guard);assert.equal(configHash(), before);
});
test('configHash muda com a configuração e normalizeState é estável', () => {
  prep();const h = configHash();
  C.rules.guardStun += .1;assert.notEqual(configHash(), h);resetConfig(factoryDefaults());
  const g = arena();assert.deepEqual(normalizeState(g), normalizeState(g));
  assert.equal(hashText('arenamon'), hashText('arenamon'));assert.notEqual(hashText('a'), hashText('b'));
});
test('comprimentos diferentes também são divergência', () => {
  prep();const a = runRecording(makeRec(40)), b = runRecording(makeRec(60));
  const d = firstDivergence(a, b);
  assert.equal(d.identical, false);if (!d.identical) assert.equal(d.field, 'comprimento');
});

done();
