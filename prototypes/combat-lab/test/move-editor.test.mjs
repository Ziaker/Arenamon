// Editor de Moves (fase 2): o cenário do palco roda o Move de verdade e os sliders de mecânica mudam o resultado.
// Uso: node prototypes/combat-lab/test/move-editor.test.mjs
import assert from 'node:assert/strict';
import {runScenario} from '../src/sim/scenarios.js';
import {C, resetConfig, defaults} from '../src/sim/config.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {EDITABLE_MOVES, editableMove} from '../src/editor/editable-moves.js';
import {makeMoveScenario, currentMoveJson, observeSeconds, needsHold, suggestedHold, DISTANCE_RANGE} from '../src/editor/move-editor-model.js';
import {validateMoveData} from '../src/sim/moves/move-data.js';

registerStandardMoves();
const sand = editableMove('sand-wave');
let n = 0;
const ok = (name, fn) => {try {fn();n++;console.log('  ✓ ' + name);} catch (e) {console.log('  ✗ ' + name + '\n' + (e.stack || e.message).split('\n').slice(0, 4).join('\n'));process.exitCode = 1;}};
const run = stage => { resetConfig(defaults()); return runScenario(makeMoveScenario(sand, stage)); };
const val = (r, label) => r.checks.find(c => c.label === label).actual;

ok('todos os Moves migrados estão na lista do editor (17)', () => { assert.ok(sand); assert.equal(sand.group, 'sandWave'); assert.ok(EDITABLE_MOVES.length >= 17, String(EDITABLE_MOVES.length)); });
ok('executar com o alvo perto: acerta, causa o dano do slider e cega', () => {
  const r = run({distance: 3});
  assert.equal(val(r, 'Acertou o alvo').startsWith('sim'), true);
  assert.equal(val(r, 'Dano causado ao alvo'), `${C.world.sandWave.damage.toFixed(1)} HP`);
  assert.equal(val(r, 'Cegueira aplicada'), 'sim');
});
ok('executar com o alvo fora do alcance: não acerta', () => {
  const r = run({distance: 12});
  assert.equal(val(r, 'Acertou o alvo'), 'não');
  assert.equal(val(r, 'Dano causado ao alvo'), '0.0 HP');
});
ok('mudar o slider de dano muda o resultado do play', () => {
  resetConfig(defaults());C.world.sandWave.damage = 15;
  const r = runScenario(makeMoveScenario(sand, {distance: 3}));
  assert.equal(val(r, 'Dano causado ao alvo'), '15.0 HP');
});
ok('mudar o alcance (length) deixa o mesmo alvo de fora', () => {
  resetConfig(defaults());C.world.sandWave.length = 1.5;
  const r = runScenario(makeMoveScenario(sand, {distance: 3}));
  assert.equal(val(r, 'Acertou o alvo'), 'não');
});
ok('o custo de stamina e a recarga aparecem', () => {
  const r = run({distance: 3});
  assert.equal(val(r, 'Custo de stamina do Move'), '2.00');
  assert.ok(parseFloat(val(r, 'Stamina líquida gasta pelo azul (com a regeneração)')) > 1.5);
  assert.ok(parseFloat(val(r, 'Recarga restante do Move (azul)')) > 0);
});
ok('a distância é limitada à faixa do palco', () => {
  const s = makeMoveScenario(sand, {distance: 99});
  assert.equal(s.positions[1].z - s.positions[0].z, DISTANCE_RANGE.max);
});
ok('o tempo observado cobre preparação + janela ativa + dissipação', () => {
  resetConfig(defaults());
  assert.ok(observeSeconds(sand) >= C.world.sandWave.cast + C.world.sandWave.active + C.world.sandWave.dissipate);
});
ok('o move.json exportado é válido e carrega os valores atuais dos sliders', () => {
  resetConfig(defaults());C.world.sandWave.damage = 11;C.world.sandWave.cooldown = 7;
  const doc = currentMoveJson(sand);
  assert.deepEqual(validateMoveData(doc), []);
  assert.equal(doc.params.rows.find(r => r.key === 'damage').value, 11);
  assert.equal(doc.def.cooldown, 7);
  resetConfig(defaults());
});

// ---- Todos os Moves no palco ----
const val2 = (r, label) => r.checks.find(c => c.label === label)?.actual;
ok('cada Move migrado roda no palco sem erro, com o resumo completo e custo igual ao slider', () => {
  for (const m of EDITABLE_MOVES) {
    resetConfig(defaults());
    const r = runScenario(makeMoveScenario(m, {distance: 3}));
    assert.ok(r.checks.length >= 9, m.id);
    const cost = (C.world[m.group]?.cost ?? m.def.cost ?? 0).toFixed(2);
    assert.equal(val2(r, 'Custo de stamina do Move'), cost, m.id);
  }
});
ok('golpes e projéteis acertam o alvo a 3 m (Sand Wave, Air Slash, Lunge, Quick Attack, Swift, Water Pulse)', () => {
  for (const id of ['sand-wave', 'air-slash', 'lunge', 'quick-attack', 'swift', 'water-pulse']) {
    resetConfig(defaults());
    const r = runScenario(makeMoveScenario(editableMove(id), {distance: 3}));
    assert.ok(val2(r, 'Acertou o alvo').startsWith('sim'), id + ': ' + val2(r, 'Acertou o alvo'));
    assert.ok(parseFloat(val2(r, 'Dano causado ao alvo')) > 0, id);
  }
});
ok('buffs mostram o status no azul (Harden, Second Wind)', () => {
  for (const [id, st] of [['harden', 'harden'], ['second-wind', 'second-wind']]) {
    resetConfig(defaults());
    const r = runScenario(makeMoveScenario(editableMove(id), {distance: 3}));
    assert.ok(val2(r, 'Status no azul').includes(st), id + ': ' + val2(r, 'Status no azul'));
  }
});
ok('campos e projéteis mostram as entidades criadas (Fire Spin, Seed Bomb, Emerging Stone, Air Slash)', () => {
  const want = {'fire-spin': 'area', 'seed-bomb': 'projectile', 'emerging-stone': 'burrow', 'air-slash': 'projectile'};
  for (const [id, kind] of Object.entries(want)) {
    resetConfig(defaults());
    const r = runScenario(makeMoveScenario(editableMove(id), {distance: 3}));
    assert.ok(val2(r, 'Entidades criadas').includes(kind), id + ': ' + val2(r, 'Entidades criadas'));
  }
});
ok('Spikes avisa o motivo quando o marcador cai em cima do alvo e arma quando o alvo está longe', () => {
  resetConfig(defaults());
  const perto = runScenario(makeMoveScenario(editableMove('spikes'), {distance: 3}));
  assert.ok(val2(perto, 'Falha ao usar o Move').includes('marcador inválido'), val2(perto, 'Falha ao usar o Move'));
  resetConfig(defaults());
  const longe = runScenario(makeMoveScenario(editableMove('spikes'), {distance: 12}));
  assert.ok(val2(longe, 'Entidades criadas').includes('trap'), val2(longe, 'Entidades criadas'));
});
ok('Moves de carga/mira têm tempo de botão segurado e os demais não', () => {
  assert.equal(needsHold(editableMove('water-pulse')), true);
  assert.equal(needsHold(editableMove('spikes')), true);
  assert.equal(needsHold(editableMove('sand-wave')), false);
  assert.ok(suggestedHold(editableMove('water-pulse')) > 0);
  assert.equal(makeMoveScenario(editableMove('sand-wave'), {hold: 2}).name.includes('botão'), false);
});
console.log(`${n} verificações do Editor de Moves.`);
