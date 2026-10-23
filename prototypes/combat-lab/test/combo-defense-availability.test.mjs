// Contrato de respostas defensivas (D, C e X) do defensor em cada estado, como o código VALE hoje. Caracterização: base do contador de combos.
import {assert, arena, cmd, vec, secs, suite} from './moves-new-helpers.mjs';

const {test, done} = suite('COMBOS — DISPONIBILIDADE DE DEFESA/ESQUIVA/CONTRA-ATAQUE');
const INPUTS = {D: () => cmd({guard: true, guardPressed: true}), C: () => cmd({dodge: true}), X: () => cmd({tackle: true})};
const accepted = {D: f => f.guard, C: f => f.action?.kind === 'dodge', X: f => f.action?.kind === 'tackle' || !!f.bufferedTackle};
/** Aplica `prepare` no azul, aperta o botão e diz se o comando foi aceito neste passo. */
function responds(prepare, key) {
  const g = arena({positions: [vec(0, -3), vec(0, 3)]});
  prepare(g.fighters[0]);
  g.step(INPUTS[key](), cmd());
  return accepted[key](g.fighters[0]);
}
const recoil = f => {f.action = {kind: 'recoil', elapsed: 0, heading: 0, startAngle: 0, offensive: false, hits: new Set(), from: null};};

test('livre: D, C e X são aceitos', () => {
  for (const k of ['D', 'C', 'X']) assert.equal(responds(() => {}, k), true, k);
});
test('recuperação de knockback: nada é aceito', () => {
  for (const k of ['D', 'C', 'X']) assert.equal(responds(f => {f.knockRecovery = .3;}, k), false, k);
});
test('atordoamento (guard stun): D e C são aceitos; X só fica no buffer', () => {
  assert.equal(responds(f => {f.stun = .3;}, 'D'), true);
  assert.equal(responds(f => {f.stun = .3;}, 'C'), true);
  const g = arena({positions: [vec(0, -3), vec(0, 3)]});
  g.fighters[0].stun = .3;g.step(cmd({tackle: true}), cmd());
  assert.notEqual(g.fighters[0].action?.kind, 'tackle', 'X não sai durante o stun (fica no buffer)');
});
test('recuo (recoil): D e C cancelam; X não', () => {
  assert.equal(responds(recoil, 'D'), true);
  assert.equal(responds(recoil, 'C'), true);
  assert.equal(responds(recoil, 'X'), false);
});
test('a esquiva C encerra o stun (descoberta: C escapa do guard stun)', () => {
  const g = arena({positions: [vec(0, -3), vec(0, 3)]});
  g.fighters[0].stun = .3;g.step(cmd({dodge: true}), cmd());
  assert.equal(g.fighters[0].stun, 0);
});
test('depois de um Tackle que acerta, o defensor só responde depois do voo e da recuperação', () => {
  const g = arena({positions: [vec(0, -.9), vec(0, .9)]});
  let hit = -1;
  for (let i = 0; i < secs(3) && hit < 0; i++) {g.step(cmd({tackle: i === 0}), cmd());if (g.lastStepEvents.some(e => e.result === 'impact' && e.damage > 0)) hit = g.tick;}
  assert.ok(hit > 0, 'o Tackle precisa acertar');
  let firstAny = -1, firstAll = -1;
  for (let n = 0; n < secs(2.5) && firstAll < 0; n++) {
    const state = g.save(), ok = {};
    for (const k of ['D', 'C', 'X']) {g.load(structuredClone(state));g.step(cmd(), INPUTS[k]());ok[k] = accepted[k](g.fighters[1]);}
    g.load(structuredClone(state));
    if (firstAny < 0 && (ok.D || ok.C || ok.X)) firstAny = g.tick - hit;
    if (ok.D && ok.C && ok.X) firstAll = g.tick - hit;
    g.step(cmd(), cmd());
  }
  console.log(`    primeira resposta aceita: +${firstAny} passos; todas: +${firstAll} passos`);
  assert.ok(firstAny > secs(.5), 'sem resposta durante o voo');
  assert.ok(firstAll >= firstAny && firstAll - firstAny <= 2, 'D, C e X abrem juntos (no máximo 1 passo de diferença)');
});

done();
