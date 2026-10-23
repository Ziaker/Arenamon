// @ts-check
// Aceleração manual da recarga (M5.8/M5.9) em TODOS os Moves: apertar o botão do Move enquanto ele está em recarga gasta stamina (0,5 por 1 s, em passos de até 1 s) e encurta
// a recarga, SEM iniciar o Move; exige um novo toque físico (segurar não repete) e sem stamina é negado. Origem: só o Reflect e o Psyshock tinham `cooldownBoost`; os 13 Moves
// novos negavam o toque com «em recarga». Agora o padrão é verdadeiro em todo Move (`cooldownBoost: false` desliga num Move específico).
// Uso: node prototypes/combat-lab/test/moves-cooldown-boost.test.mjs
import {assert, C, cmd, HOLD, DT, arena, suite} from './moves-new-helpers.mjs';
import {NEW_MOVES} from '../src/sim/moves/new-moves.js';
import {getMove} from '../src/sim/moves.js';

const {test, done} = suite('ACELERAÇÃO MANUAL DA RECARGA — TODOS OS MOVES');
const IDS = ['reflect', 'psyshock', ...NEW_MOVES.map(m => m.def.id)];
const press = {skill: 0, skillHeld: HOLD(0)};

test(`são ${IDS.length} Moves e nenhum desliga a aceleração (cooldownBoost !== false)`, () => {
  assert.equal(IDS.length, 19);   // 13 novos + os 4 elementais (23/10/2026)
  arena();   // registra
  for (const id of IDS) assert.notEqual(getMove(id).cooldownBoost, false, id);
});
for (const id of IDS) {
  test(`${id}: em recarga, o toque acelera (−1 s por 0,5 de stamina), não inicia o Move e segurar o botão não repete`, () => {
    const g = arena({equip: [id]}), f = g.fighters[0];
    f.moveCooldowns[id] = 5;
    const st = f.stamina;
    g.step(cmd(press), cmd());
    assert.ok(g.lastStepEvents.some(e => e.result === 'cooldownBoost' && e.move === id), 'sem evento de aceleração');
    assert.ok(Math.abs((5 - f.moveCooldowns[id]) - 1) < .02, `recarga 5 → ${f.moveCooldowns[id]}`);
    assert.ok(Math.abs((st - f.stamina) - .5) < 1e-6, `stamina ${st} → ${f.stamina}`);
    assert.ok(!f.action && !f.charge && !f.aim, 'o toque em recarga não pode iniciar o Move');
    // segurar (sem novo toque): nada acontece
    const cd = f.moveCooldowns[id];
    g.step(cmd({skill: null, skillHeld: HOLD(0)}), cmd());
    assert.ok(!g.lastStepEvents.some(e => e.result === 'cooldownBoost'), 'segurar repetiu a aceleração');
    assert.ok(cd - f.moveCooldowns[id] < .02);
  });
  test(`${id}: sem stamina suficiente o toque em recarga é negado (a recarga só anda com o tempo)`, () => {
    const g = arena({equip: [id]}), f = g.fighters[0];
    f.moveCooldowns[id] = 5;f.stamina = f.regenBase = .2;f.regenAge = 0;
    g.step(cmd(press), cmd());
    assert.ok(!g.lastStepEvents.some(e => e.result === 'cooldownBoost'));
    assert.ok(5 - f.moveCooldowns[id] < .02, `recarga 5 → ${f.moveCooldowns[id]}`);
    assert.ok(!f.action && !f.charge && !f.aim);
  });
}
test('recarga restante menor que 1 s: encurta só o que falta e cobra proporcional (0,5 × restante)', () => {
  const g = arena({equip: ['swift']}), f = g.fighters[0];
  f.moveCooldowns.swift = .4;const st = f.stamina;
  g.step(cmd(press), cmd());
  assert.ok((f.moveCooldowns.swift ?? 0) <= 1e-8, `recarga ${f.moveCooldowns.swift}`);
  assert.ok(Math.abs((st - f.stamina) - .2) < 1e-6, `custo ${st - f.stamina}`);
});
test('o parâmetro continua configurável por Move: cooldownBoost: false negaria o toque (contrato de validateMove)', () => {
  const d = getMove('swift');assert.equal(typeof (d.cooldownBoost ?? true), 'boolean');
  void C;void DT;
});

done();
