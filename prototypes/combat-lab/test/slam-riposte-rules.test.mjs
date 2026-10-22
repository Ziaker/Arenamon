// @ts-check
// Regras de PL e clash do Meteor Slam e do contra-golpe do Riposte (decisão do responsável, 22/10/2026):
//  • Meteor Slam: PL 2; NUNCA causa clash; a hitbox só existe com o personagem NO CHÃO (no mergulho/preparação não acerta); bloqueado, arrasta o defensor para trás (relativamente alto).
//  • Contra-golpe do Riposte: tratado como PL 4 (vence qualquer PL) e NUNCA causa clash.
// Uso: node prototypes/combat-lab/test/slam-riposte-rules.test.mjs
import {assert, C, vec, arena, suite} from './moves-new-helpers.mjs';
import {Game} from '../src/sim/game.js';
import {clashPossible, mutualTackle, tackleConnects} from '../src/sim/combat.js';
import {SCENARIOS, prepareScenario, runScenario} from '../src/sim/scenarios.js';

const {test, done} = suite('PL E CLASH — METEOR SLAM E CONTRA-GOLPE DO RIPOSTE');
const tackleAction = o => ({kind: 'tackle', heading: 0, pl: 1, elapsed: .2, hits: new Set(), neutralized: false, ...o});
/** Dois lutadores frente a frente (azul olhando +z em (0,0), vermelho olhando −z em (0,1)), com as ações dadas. */
function faceOff(a0, a1) {
  arena();C.extras.toggles.enableClash = 1;
  const g = new Game({seed: 3});g.reset({positions: [vec(0, 0), vec(0, 1)]});
  const [a, b] = g.fighters;a.action = tackleAction({heading: 0, ...a0});b.action = tackleAction({heading: Math.PI, ...a1});
  return {a, b, normal: {x: 0, z: 1}, relative: {x: 0, z: 3}};
}

test('controle: dois Tackles PL1 (ou PL2) frente a frente fazem clash', () => {
  for (const pl of [1, 2, 3]) {const {a, b, normal, relative} = faceOff({pl}, {pl});assert.equal(clashPossible(a, b, normal, relative), true, `PL ${pl}`);}
});
test('Meteor Slam (PL 2) nunca faz clash, nem contra um Tackle de PL 2; contra PL menor o PL dominante neutraliza o rival', () => {
  let {a, b, normal, relative} = faceOff({pl: 2, slam: true, slamPrepDone: true, slamLanded: true}, {pl: 2});
  assert.equal(clashPossible(a, b, normal, relative), false, 'slam × PL2');assert.equal(mutualTackle(a, b, normal, relative), false);
  assert.equal(clashPossible(b, a, {x: 0, z: -1}, {x: 0, z: 3}), false, 'simétrico');
  ({a, b, normal, relative} = faceOff({pl: 2, slam: true, slamPrepDone: true, slamLanded: true}, {pl: 1}));
  assert.equal(clashPossible(a, b, normal, relative), false);assert.equal(b.action.neutralized, true, 'o PL maior neutraliza o Tackle PL1');
});
test('contra-golpe do Riposte (PL 4) nunca faz clash: nem contra PL 4 e vence qualquer PL', () => {
  let {a, b, normal, relative} = faceOff({pl: 4, riposteStrike: true}, {pl: 4, riposteStrike: true});
  assert.equal(clashPossible(a, b, normal, relative), false, 'contra-golpe × contra-golpe');
  for (const pl of [1, 2, 3]) {
    ({a, b, normal, relative} = faceOff({pl: 4, riposteStrike: true}, {pl}));
    assert.equal(clashPossible(a, b, normal, relative), false, `contra-golpe × PL ${pl}`);assert.equal(b.action.neutralized, true, `PL ${pl} neutralizado`);assert.equal(mutualTackle(a, b, normal, relative), false);
  }
});
test('hitbox do Meteor Slam só no chão: sem contato na preparação nem no mergulho; conecta depois de pousar', () => {
  const {a, b, normal, relative} = faceOff({pl: 2, slam: true, slamLanded: false, slamPrepDone: true}, {pl: 1});
  a.vaultHeight = 1.5;
  assert.equal(tackleConnects(a, b, normal, relative), false, 'no mergulho (ainda no ar)');
  a.action.slamLanded = true;a.vaultHeight = 0;
  assert.equal(tackleConnects(a, b, normal, relative), true, 'no chão');
});
test('partida real (cenário «Meteor slam: preparação, mergulho e impacto»): PL 2 durante o slam, nenhum clash e todo impacto só depois de pousar (slamLanded)', () => {
  const def = SCENARIOS.find(s => s.id === 'meteor-hit');assert.ok(def);
  const game = new Game({seed: 3}), run = prepareScenario(def, game);
  let sawPl = new Set(), clashes = 0, impacts = 0, badState = 0;
  while (!run.done) {
    const [c0, c1] = run.commands();game.step(c0, c1);run.observe();
    const f = game.fighters[0];if (f.action?.slam) sawPl.add(f.action.pl);
    for (const e of game.lastStepEvents) {if (e.result === 'clash') clashes++;if (e.slam && ['impact', 'partial', 'perfect'].includes(e.result)) {impacts++;if (!f.action?.slamLanded) badState++;}}
  }
  run.finish();
  assert.deepEqual([...sawPl], [2], `PL durante o slam: ${[...sawPl]}`);
  assert.equal(clashes, 0);assert.ok(impacts >= 1, 'o slam não acertou');assert.equal(badState, 0, 'impacto antes de pousar (no ar)');
});
test('slam bloqueado (cenário «Meteor slam bloqueado»): o defensor é arrastado para trás com folga e todas as verificações do cenário passam', () => {
  const def = SCENARIOS.find(s => s.id === 'meteor-blocked');assert.ok(def);
  const r = runScenario(def);
  const bad = r.checks.filter(c => !c.ok).map(c => `${c.label}: ${c.actual}`);
  assert.equal(bad.length, 0, bad.join(' | '));
  assert.ok(C.rules.slamBlockPushDistance >= 3, `slamBlockPushDistance = ${C.rules.slamBlockPushDistance} m (relativamente alto: ≥ 3)`);
});

done();
