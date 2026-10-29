// @ts-check
// Game feel 6 em Moves reais rodando no motor: Lunge (Move que vira Tackle), Swift (Move de efeito sem hitStart/hitEnd) e um Move comum;
// contrato aplicado capturado no uso, restauração por personagem/ação, save/load e perfil de olhar de Move-Tackle.
import {assert, C, Game, cmd, vec, secs, suite, arena, step, run} from './moves-new-helpers.mjs';
import {getMove, moveSpec} from '../src/sim/moves.js';
import {createAnimationCombatWindows} from '../src/sim/animation-combat-windows.js';
import {resolveAllPhases} from '../src/sim/phase-contract.js';
import {trackModeOf} from '../src/view/characters.js';

const {test, done} = suite('GAME FEEL 6 · FASES EM MOVES REAIS');
const lock = {target: 1, locked: true}, press0 = {skill: 0, skillHeld: [true, false, false, false]};
const contractFor = (id, over = {}) => {const d = getMove(id);return createAnimationCombatWindows({characterId: 't', actionId: 'move_' + id, clipName: 'c', clipDurationSeconds: 1, actionDurationSeconds: d.duration, ...over});};
const G = (o = {}) => ({phaseMode: 1, phaseActive: 1, phaseCancel: 1, phaseInvuln: 1, ...o});
const resolve = (id, over, g = G(), off = {}) => resolveAllPhases({tackle: null, dodge: null, moves: {[id]: contractFor(id, over)}}, C, g, {getMove, off}).windows;

test('Lunge (Move-Tackle): cancelamento e janela ativa aprovados entram na ação de tackle; sem contrato nada muda', () => {
  const base = arena({equip: ['lunge'], positions: [vec(0, -6), vec(0, 6)]});
  base.step(cmd({...press0, ...lock}), cmd());
  const a0 = base.fighters[0].action, chain0 = a0.chainAfter, hitStart0 = a0.params?.hitStart;
  assert.equal(a0.kind, 'tackle');assert.equal(a0.move, 'lunge');assert.equal(a0.phase, undefined, 'sem contrato aplicado a ação não carrega fases');
  const d = getMove('lunge'), n = Math.round(d.duration / C.test.step);
  const g = arena({equip: ['lunge'], positions: [vec(0, -6), vec(0, 6)]});
  const w = resolve('lunge', {cancelWindows: [[Math.round(n * .3), n]], activeWindows: [[Math.round(n * .2), Math.round(n * .5)]]});g.setCombatWindows(0, w);
  g.step(cmd({...press0, ...lock}), cmd());
  const a = g.fighters[0].action;
  assert.deepEqual(a.phase.applied, {active: true, cancel: true, invuln: false});
  assert.ok(Math.abs(a.chainAfter - Math.round(n * .3) * C.test.step) < 1e-3, `chainAfter ${a.chainAfter}`);
  assert.notEqual(a.chainAfter, chain0);
  if (Number.isFinite(hitStart0)) assert.ok(Math.abs(a.params.hitStart - Math.round(n * .2) * C.test.step) < 1e-6, 'hitStart aprovado');
});
test('Swift (efeito sem hitStart/hitEnd): a janela ativa aprovada desliza a linha do tempo; a duração e o custo não mudam', () => {
  const d = getMove('swift'), n = Math.round(d.duration / C.test.step), at0 = Math.min(...d.timeline.map(e => e.at ?? 0));
  const w = resolve('swift', {activeWindows: [[Math.round(n * .4), Math.round(n * .6)]]}, G({phaseCancel: 0, phaseInvuln: 0}));
  const g = arena({equip: ['swift']});g.setCombatWindows(0, w);
  const before = g.fighters[0].stamina;
  g.step(cmd({...press0, ...lock}), cmd());
  const a = g.fighters[0].action;
  const first = Math.min(...a.def.timeline.map(e => e.at));
  assert.ok(Math.abs(first - Math.round(n * .4) * C.test.step) < 1e-6, `primeiro disparo ${first} (era ${at0})`);
  assert.equal(a.def.duration, d.duration);assert.equal(moveSpec(a).duration, d.duration);
  assert.ok(g.fighters[0].stamina <= before, 'custo cobrado normalmente');
  assert.equal(getMove('swift').timeline[0].at, d.timeline[0].at, 'a definição registrada não foi alterada');
});
test('restaurar por personagem e ação: o outro lutador e as outras ações continuam aprovados', () => {
  const d = getMove('lunge'), n = Math.round(d.duration / C.test.step), over = {cancelWindows: [[Math.round(n * .85), n]]};
  const wOff = resolve('lunge', over, G(), {move_lunge: {cancel: true}}), wOn = resolve('lunge', over);
  const g = arena({equip: ['lunge'], equipRed: ['lunge'], positions: [vec(0, -6), vec(0, 6)]});g.setCombatWindows(0, wOff);g.setCombatWindows(1, wOn);
  g.step(cmd({...press0, ...lock}), cmd({skill: 0, skillHeld: [true, false, false, false], target: 0, locked: true}));
  assert.equal(g.fighters[0].action.phase?.applied?.cancel ?? false, false, 'azul restaurado: definição');
  const ra = g.fighters[1].action;
  assert.equal(ra?.phase?.applied?.cancel, true, 'vermelho segue aprovado: ' + JSON.stringify({kind: ra?.kind, move: ra?.move, cw: !!g.fighters[1].combatWindows?.moves?.lunge, loadout: g.fighters[1].loadout}));
});
test('save/load no meio do Move: o contrato capturado e o resultado não dependem do modo global', () => {
  const d = getMove('swift'), n = Math.round(d.duration / C.test.step);
  const w = resolve('swift', {cancelWindows: [[Math.round(n * .5), n]]}, G({phaseActive: 0, phaseInvuln: 0}));
  const g = arena({equip: ['swift']});g.setCombatWindows(0, w);
  g.step(cmd({...press0, ...lock}), cmd());run(g, 5);
  const snap = g.save();C.extras.gameFeel.phaseMode = 2;
  const h = new Game({seed: 1});h.reset();h.load(snap);
  assert.equal(moveSpec(h.fighters[0].action).chainAfter, moveSpec(g.fighters[0].action).chainAfter);
  run(g, 80);run(h, 80);
  assert.equal(JSON.stringify(g.fighters.map(f => [f.position, f.hp, f.stamina])), JSON.stringify(h.fighters.map(f => [f.position, f.hp, f.stamina])), 'mesmo futuro depois do load');
});
test('Move comum sem contrato: ação idêntica (paridade com o modo Definição)', () => {
  const a = arena({equip: ['swift']}), b = arena({equip: ['swift']});b.setCombatWindows(0, {tackle: null, dodge: null});
  for (const g of [a, b]) {g.step(cmd({...press0, ...lock}), cmd());run(g, 60);}
  assert.equal(JSON.stringify(a.fighters.map(f => [f.position, f.hp, f.stamina, f.state])), JSON.stringify(b.fighters.map(f => [f.position, f.hp, f.stamina, f.state])));
});
test('olhar: o perfil de um Move-Tackle (action.move) é encontrado e o padrão vale sem perfil', () => {
  const tackleMove = {action: {kind: 'tackle', move: 'quick-attack'}}, plain = {action: {kind: 'tackle'}}, normal = {action: {kind: 'move', move: 'swift'}};
  assert.equal(trackModeOf(tackleMove, {'quick-attack': 'off'}), 'off');
  assert.equal(trackModeOf(tackleMove, {}), 'headTorso');
  assert.equal(trackModeOf(plain, {'quick-attack': 'off'}), 'headTorso');
  assert.equal(trackModeOf(normal, {swift: 'aim'}), 'aim');
});
done();
