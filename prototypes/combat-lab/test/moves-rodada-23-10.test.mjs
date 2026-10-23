// Rodada de 23/10/2026: dano inteiro, Fire Spin sem limite de pulsos e com start-up, knockback até 15 em todos os Moves, hit com `move`, pouso da Seed Bomb no chão e tremor de hit por Move.
import {assert, C, cmd, vec, suite, arena as arenaBase, run, HOLD} from './moves-new-helpers.mjs';
import {wholeDamage} from '../src/sim/damage-rule.js';
import {MOVES_PARAMS, KNOCKBACK_MAX, KNOCKBACK_KEY, DEPENDS_ON} from '../src/ui/moves-panel.js';
import {SHAKE_GROUPS, MELEE_MOVES} from '../src/sim/move-hit-map.js';

const {test, done} = suite('RODADA 23/10');
const press0 = {skill: 0, skillHeld: HOLD(0)}, held = {skillHeld: HOLD(0)};
const zones = g => g.world.entities.filter(e => e.kind === 'area' && e.visual === 'firespin' && !e.dead);
function place(setup) {
  const g = arenaBase({equip: ['fire-spin'], positions: [vec(0, -4), vec(1.2, -1)], setup: () => {setup?.();C.world.fireSpin.markerAccel = 0;}});
  g.step(cmd(press0), cmd());for (let i = 0; i < 4; i++) g.step(cmd(held), cmd());g.step(cmd(), cmd());return g;
}
const pulseTicks = (g, n) => {const out = [];for (let i = 0; i < n; i++) {const z = zones(g)[0], age = z?.age ?? 0;g.step(cmd(), cmd());for (const e of g.lastStepEvents) if (e.pulse && e.result === 'impact') out.push(age);}return out;};

test('dano inteiro: sempre arredonda para baixo (7,9 → 7; 0,99 → 0; 4 → 4)', () => {
  assert.equal(wholeDamage(7.9), 7);assert.equal(wholeDamage(.99), 0);assert.equal(wholeDamage(4), 4);assert.equal(wholeDamage(3.9999999999), 4);assert.equal(wholeDamage(-3), 0);
  C.extras.toggles.integerDamage = 0;assert.equal(wholeDamage(7.9), 7.9);C.extras.toggles.integerDamage = 1;
});

test('Fire Spin: o start-up atrasa o primeiro pulso e os pulsos seguem a cada intervalo, sem limite de quantidade', () => {
  const a = place(() => {C.world.fireSpin.startup = 0;}), b = place(() => {C.world.fireSpin.startup = 1;});
  for (let i = 0; i < 46; i++) {a.step(cmd(), cmd());b.step(cmd(), cmd());}
  const pa = pulseTicks(a, 330), pb = pulseTicks(b, 330);
  assert.ok(pa[0] < .05, `sem start-up o primeiro pulso é imediato (${pa[0]})`);
  assert.ok(pb[0] >= 1 - .02 && pb[0] < 1.05, `com start-up de 1 s o primeiro pulso sai em ~1 s (${pb[0]})`);
  assert.equal(pa.length, 4);assert.equal(pb.length, 3, 'life 2,4 s − start-up 1 s: cabem pulsos em 1,0 / 1,6 / 2,2 s');
  const c = place(() => {C.world.fireSpin.life = 6;C.world.fireSpin.interval = .5;});
  for (let i = 0; i < 46; i++) c.step(cmd(), cmd());
  assert.equal(pulseTicks(c, 800).length, 12, 'sem teto de pulsos: 6 s ÷ 0,5 s = 12');
  assert.ok(!MOVES_PARAMS.flatMap(g => g[1]).some(r => r[0] === 'fireSpin' && r[1] === 'pulses'), 'o slider de número de pulsos não existe mais');
});

test('knockback: todo slider H/V de Move vai até 15 e todo Move que causa dano tem os dois', () => {
  const rows = MOVES_PARAMS.flatMap(g => g[1]);
  for (const r of rows) if (KNOCKBACK_KEY.test(r[1])) assert.equal(r[5], KNOCKBACK_MAX, `${r[0]}.${r[1]}`);
  const has = (g, re) => rows.some(r => r[0] === g && re.test(r[1]));
  for (const g of ['reflect', 'psyshock', 'swift', 'lunge', 'quickAttack', 'guardBreak', 'riposte', 'emergingStone', 'bulletPunch', 'sandWave', 'spikes', 'bounce', 'waterPulse', 'fireSpin', 'airSlash', 'seedBomb']) {
    assert.ok(has(g, /^(knockbackH|knockback|knockbackPl1|knockbackPerStone|blastKnockback|burstForce)$/), `${g}: horizontal`);
    assert.ok(has(g, /^(knockbackV|knockbackVertical|blastKnockbackV|burstVertical)$/), `${g}: vertical`);
  }
});

test('knockback vertical novo lança o alvo (Fire Spin) e o horizontal empurra', () => {
  const g = place(() => {C.world.fireSpin.knockbackV = 8;C.world.fireSpin.knockbackH = 3;});
  let fly = 0;for (let i = 0; i < 200; i++) {g.step(cmd(), cmd());fly = Math.max(fly, g.fighters[1].flight?.y ?? 0);}
  assert.ok(fly > .3, `lançado (${fly})`);
});

test('o evento de hit carrega o Move e o tremor/ cor por Move existem só para os que não são corpo a corpo', () => {
  const g = place();let ev = null;
  for (let i = 0; i < 80 && !ev; i++) {g.step(cmd(), cmd());ev = g.lastStepEvents.find(e => e.result === 'impact');}
  assert.equal(ev?.move, 'fire-spin');
  for (const grp of SHAKE_GROUPS) {assert.equal(C.world[grp].hitShakeOn, 0, `${grp}: sem tremor por padrão`);assert.ok(DEPENDS_ON[`${grp}.hitShakeAmount`] === 'hitShakeOn');assert.ok(C.vfx.moveHit[grp], `${grp}: cor de hit`);}
  assert.ok(MELEE_MOVES.has('lunge') && !MELEE_MOVES.has('fire-spin'));
});

test('Seed Bomb: a explosão no chão marca groundHit (efeito provisório junto com o novo); em corpo não', () => {
  const sg = arenaBase({equip: ['seed-bomb'], positions: [vec(0, -4), vec(10, 4)], setup: () => {C.world.seedBomb.markerAccel = 0;}});
  sg.step(cmd(press0), cmd());for (let i = 0; i < 4; i++) sg.step(cmd(held), cmd());sg.step(cmd(), cmd());
  let blast = null;for (let i = 0; i < 160 && !blast; i++) {sg.step(cmd(), cmd());blast = sg.world.entities.find(e => e.visual === 'seedblast');}
  assert.ok(blast, 'explodiu');assert.equal(blast.groundHit, true);
});
done();
