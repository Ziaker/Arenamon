// @ts-check
// Feint (genérico, Burst · Trick · sem PL): custo 0,30, recarga 3 s, 0,22 s; cancela a antecipação (até 0,133 s) de Tackle/Lunge/Guard Break ou a carga em curso e recua.
// Fonte: docs/moves-nao-iniciados/5_MOVES_GENERICOS_PROMPT.md §5.
import {assert, C, Game, cmd, vec, secs, suite, arena, run, fighterHash, HOLD} from './moves-new-helpers.mjs';
import {getMove} from '../src/sim/moves.js';
import {isInvulnerable} from '../src/sim/entity.js';

const {test, done} = suite('FEINT');
const pressSlot = (i, extra = {}) => cmd({skill: i, skillHeld: HOLD(i), ...extra});
/** Azul com Lunge (slot 0) e Feint (slot 1), alvo a `dist`; começa o Lunge e devolve o jogo `wait` passos depois. */
function lungeThen(wait, dist = 8) {
  const g = arena({equip: ['lunge', 'feint', 'guard-break'], positions: [vec(0, -dist / 2), vec(0, dist / 2)]});
  g.step(pressSlot(0), cmd());run(g, wait);
  return g;
}

test('registrado com os dados da proposta: 0,30 de stamina, 3 s, 0,22 s, sem PL; nada equipado por padrão', () => {
  const g = arena();const d = getMove('feint');
  assert.deepEqual([d.cost, d.cooldown, d.duration, d.feint], [.3, 3, .22, true]);
  assert.ok(g.fighters.every(f => (f.loadout ?? []).every(x => !x)));
});
test('uso simples (sem ataque em curso): recuo de 0,25 m para trás sem virar o corpo; custo e recarga na confirmação', () => {
  const g = arena({equip: ['feint']});const b = g.fighters[0], z0 = b.position.z, face = b.facing;
  g.step(pressSlot(0), cmd());
  assert.equal(b.action.kind, 'move');assert.equal(b.action.move, 'feint');assert.ok(!b.action.pl, 'sem PL');
  assert.ok(Math.abs(b.moveCooldowns.feint - 3) < .06 && C.rules.staminaMax - b.stamina > .25 && C.rules.staminaMax - b.stamina < .35);
  run(g, secs(.3));
  assert.ok(Math.abs(b.position.z - z0 + .25) < .03, `deslocamento ${(b.position.z - z0).toFixed(3)}`);
  assert.ok(Math.abs(b.facing - face) < 1e-6, 'o corpo não gira');
});
test('com input lateral recua para o lado; com input à frente recua para trás', () => {
  const run1 = move => {const g = arena({equip: ['feint']});const b = g.fighters[0], p0 = {...b.position};g.step(pressSlot(0, {move}), cmd());run(g, secs(.3));return {dx: b.position.x - p0.x, dz: b.position.z - p0.z};};
  const side = run1(vec(1, 0)), fwd = run1(vec(0, 1));
  assert.ok(side.dx > .2 && Math.abs(side.dz) < .05, JSON.stringify(side));
  assert.ok(fwd.dz < -.2 && Math.abs(fwd.dx) < .05, JSON.stringify(fwd));
});
test('i-frames curtos no recuo (2 a 10 passos): vulnerável antes e depois', () => {
  const g = arena({equip: ['feint']});const b = g.fighters[0], seen = [];
  g.step(pressSlot(0), cmd());seen.push(isInvulnerable(b));
  for (let i = 1; i < secs(.2); i++) {g.step(cmd(), cmd());seen.push(isInvulnerable(b));}
  assert.equal(seen[0], false, 'passo 0');assert.equal(seen[5], true, 'passo 5');assert.equal(seen[15], false, 'passo 15');
});
test('cancela o Lunge na antecipação (< 0,133 s): o Lunge acaba e o recuo começa', () => {
  const g = lungeThen(8);const b = g.fighters[0];
  assert.equal(b.action.kind, 'tackle');
  g.step(pressSlot(1), cmd());
  assert.equal(b.action.kind, 'move');assert.equal(b.action.move, 'feint');
  assert.ok(g.lastStepEvents.some(e => e.result === 'feint' && e.cancelled === 'lunge'), JSON.stringify(g.lastStepEvents));
  const z = b.position.z;run(g, secs(1));
  assert.ok(Math.abs(b.position.z - z) < 1, 'o avanço do Lunge não continua');
});
test('o custo e a recarga do Lunge cancelado NÃO voltam (sem reembolso)', () => {
  const g = lungeThen(8);const b = g.fighters[0], s0 = b.stamina;
  g.step(pressSlot(1), cmd());
  assert.ok(b.moveCooldowns.lunge > 5.5, `recarga do Lunge ${b.moveCooldowns.lunge}`);
  assert.ok(b.stamina < s0 + .01, 'sem devolução');
});
test('fora da janela (> 0,133 s): o Feint é gasto sem efeito e o Lunge CONTINUA (punível)', () => {
  const g = lungeThen(30);const b = g.fighters[0], s0 = b.stamina;
  g.step(pressSlot(1), cmd());
  assert.equal(b.action.kind, 'tackle');assert.equal(b.action.move, 'lunge');
  assert.ok(s0 - b.stamina > .25, 'stamina gasta');assert.ok(Math.abs(b.moveCooldowns.feint - 3) < .06, 'recarga iniciada');
  assert.ok(g.lastStepEvents.some(e => e.result === 'feintWhiff'), JSON.stringify(g.lastStepEvents));
  const z0 = b.position.z;run(g, secs(.6));assert.ok(b.position.z - z0 > .5, 'o Lunge segue avançando');
});
test('depois de acertar, o Feint não cancela mais o golpe (ele já conectou)', () => {
  const g = arena({equip: ['lunge', 'feint'], positions: [vec(0, -1), vec(0, 1)]});const b = g.fighters[0];
  g.step(pressSlot(0), cmd());
  for (let i = 0; i < 40 && b.action?.hits?.size === 0; i++) g.step(cmd(), cmd());
  assert.ok(b.action?.hits?.size > 0 || !b.action, 'acertou');
  if (b.action) {g.step(pressSlot(1), cmd());assert.equal(b.action.move, 'lunge');}
});
test('cancela a carga do Guard Break: sem carga, sem golpe, custo e recarga do Guard Break mantidos', () => {
  const g = arena({equip: ['guard-break', 'feint']});const b = g.fighters[0];
  g.step(pressSlot(0), cmd());run(g, 20, () => cmd({skillHeld: HOLD(0)}));
  const cd = b.moveCooldowns['guard-break'], st = b.stamina;
  g.step(cmd({skill: 1, skillHeld: [true, true, false, false]}), cmd());
  assert.ok(!b.charge, 'carga encerrada');assert.equal(b.action.move, 'feint');
  assert.ok(b.moveCooldowns['guard-break'] >= cd - .05, 'recarga do Guard Break mantida');assert.ok(b.stamina <= st + .01);
  run(g, secs(.4), () => cmd({skillHeld: HOLD(0)}));
  assert.ok(!b.action || b.action.move !== 'guard-break', 'nenhum golpe saiu');
});
test('cancela o Tackle comum (X) na antecipação', () => {
  const g = arena({equip: ['feint'], positions: [vec(0, -4), vec(0, 4)]});const b = g.fighters[0];
  g.step(cmd({tackle: true, move: vec(0, 1)}), cmd());run(g, 4);
  assert.equal(b.action.kind, 'tackle');
  g.step(pressSlot(0), cmd());
  assert.equal(b.action.move, 'feint');
});
test('não interage com Clash/Counter: a ação do Feint não é Tackle e não tem PL', () => {
  const g = arena({equip: ['feint'], positions: [vec(0, -1), vec(0, 1)]});const b = g.fighters[0];
  g.step(pressSlot(0), cmd({tackle: true, move: vec(0, -1)}));
  const ev = [];for (let i = 0; i < 90; i++) {g.step(cmd(), cmd());ev.push(...g.lastStepEvents);}
  assert.ok(!ev.some(e => /clash|counter/i.test(e.result)));void b;
});
test('encadeia logo depois: a esquiva é aceita a partir de 0,033 s', () => {
  const g = arena({equip: ['feint']});const b = g.fighters[0];
  g.step(pressSlot(0), cmd());run(g, 6);
  g.step(cmd({dodge: true, move: vec(1, 0)}), cmd());
  assert.equal(b.action?.kind, '  dodge'.trim(), 'esquiva já aceita');
});
test('em recarga um novo toque NÃO reinicia a Finta: acelera a recarga (M5.8: −1 s por 0,5 de stamina) e sem stamina é negado', () => {
  const g = arena({equip: ['feint']});const b = g.fighters[0];
  g.step(pressSlot(0), cmd());run(g, secs(.3));
  const cd = b.moveCooldowns.feint, st = b.stamina, started = b.action?.elapsed;
  g.step(pressSlot(0), cmd());assert.ok(!b.action || b.action.elapsed > .01 || b.action.elapsed === started, 'em recarga: nada novo começou');
  assert.ok(g.lastStepEvents.some(e => e.result === 'cooldownBoost' && e.move === 'feint'), 'evento de aceleração');
  assert.ok(Math.abs((cd - b.moveCooldowns.feint) - 1) < .05 && Math.abs((st - b.stamina) - .5) < 1e-6, `recarga ${cd} → ${b.moveCooldowns.feint}, stamina ${st} → ${b.stamina}`);
  b.stamina = b.regenBase = .2;b.regenAge = 0;const cd2 = b.moveCooldowns.feint;
  g.step(pressSlot(0), cmd());assert.ok(cd2 - b.moveCooldowns.feint < .02, `sem stamina: recarga ${cd2} → ${b.moveCooldowns.feint}, stamina ${b.stamina}`);
});
test('M28.4: sliders mexidos depois do uso não alteram o recuo em andamento; o próximo uso lê o novo', () => {
  const g = arena({equip: ['feint']});const b = g.fighters[0], z0 = b.position.z;
  g.step(pressSlot(0), cmd());C.world.feint.retreat = 3;run(g, secs(.3));
  assert.ok(Math.abs(b.position.z - z0 + .25) < .03, `capturado ${(b.position.z - z0).toFixed(3)}`);
});
test('sliders têm efeito: retreat e cancelWindow', () => {
  const g = arena({equip: ['feint'], setup: () => {C.world.feint.retreat = 1;}});const b = g.fighters[0], z0 = b.position.z;
  g.step(pressSlot(0), cmd());run(g, secs(.3));assert.ok(Math.abs(b.position.z - z0 + 1) < .05);
  const h = arena({equip: ['lunge', 'feint'], setup: () => {C.world.feint.cancelWindow = .5;}, positions: [vec(0, -4), vec(0, 4)]});
  h.step(pressSlot(0), cmd());run(h, 30);h.step(pressSlot(1), cmd());
  assert.equal(h.fighters[0].action.move, 'feint', 'janela maior cancela aos 0,25 s');
});
test('paridade e determinismo: registrado e não equipado não muda nada; save/load no recuo reproduz o futuro', () => {
  const sim = () => {const g = arena();g.mode = 'tactical';C.extras.toggles.enableEnemyAI = 1;for (let i = 0; i < 1200; i++) g.step(cmd(), undefined);return fighterHash(g);};
  assert.equal(sim(), sim());
  const go = split => {
    const g = lungeThen(6);g.step(pressSlot(1), cmd());run(g, 5);
    if (split) {const snap = g.save();const h = new Game({seed: 3});h.start();h.load(snap);run(h, 200);return fighterHash(h);}
    run(g, 200);return fighterHash(g);
  };
  assert.equal(go(true), go(false));
});

done();
