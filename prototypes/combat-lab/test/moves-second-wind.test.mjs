// @ts-check
// Second Wind (genérico adicional, Normal · Status · sem PL): +40% da stamina máxima por segundo e esquiva/sprint 25% mais baratos por 5 s.
// Fonte: docs/moves-nao-iniciados/5_MOVES_GENERICOS_PROMPT.md §7 (proposta; padrões MV-P09).
import {assert, C, Game, cmd, vec, secs, suite, arena, step, run, press, status, redTackle, fighterHash} from './moves-new-helpers.mjs';
import {getMove} from '../src/sim/moves.js';
import {getFighterMaxStamina} from '../src/sim/entity.js';
import {stat} from '../src/sim/status.js';

const {test, done} = suite('SECOND WIND');
const CAST = secs(.35);

/** Esvazia a stamina para `v` (e fixa a base da regeneração). */
const drain = (f, v) => {f.stamina = v;f.regenBase = v;f.regenAge = 0;f.exhausted = false;};

test('registrado com os dados da proposta: 0,8 de stamina, 12 s, cast 0,35 s, sem PL; nada equipado por padrão', () => {
  const g = arena();const d = getMove('second-wind');
  assert.deepEqual([d.cost, d.cooldown, d.duration], [.8, 12, .35]);
  assert.ok(g.fighters.every(f => (f.loadout ?? []).every(x => !x)));
});
test('cobra stamina e cooldown no cast; o buff só começa após 0,35 s e dura 5 s', () => {
  const g = arena({equip: ['second-wind']});const b = g.fighters[0], s0 = b.stamina;
  press(g, 0);
  assert.ok(Math.abs((s0 - b.stamina) - .8) < .02, `stamina gasta ${s0 - b.stamina}`);
  assert.ok(Math.abs(b.moveCooldowns['second-wind'] - 12) < .02);
  run(g, CAST - 4);assert.equal(status(b, 'second-wind'), null);
  run(g, 8);assert.ok(status(b, 'second-wind'));
  run(g, secs(5) - 10);assert.ok(status(b, 'second-wind'), 'ativo perto dos 5 s');
  run(g, 14);assert.equal(status(b, 'second-wind'), null, 'expirou');
});
test('regeneração extra: +40% da stamina MÁXIMA por segundo (medido contra o mesmo cenário sem o Move)', () => {
  const gain = withBuff => {
    const g = arena({equip: withBuff ? ['second-wind'] : []});const b = g.fighters[0];
    if (withBuff) {press(g, 0);run(g, CAST + 2);}
    drain(b, .5);const t0 = b.stamina;
    run(g, secs(1));
    return b.stamina - t0;
  };
  const max = getFighterMaxStamina(arena().fighters[0]), extra = gain(true) - gain(false);
  assert.ok(Math.abs(extra - .4 * max) < .05 * max, `ganho extra ${extra.toFixed(3)} esperado ≈ ${(.4 * max).toFixed(3)} (máx ${max})`);
});
test('esquiva (C) custa 25% menos durante o buff e o custo normal fora dele', () => {
  const cost = withBuff => {
    const g = arena({equip: withBuff ? ['second-wind'] : []});const b = g.fighters[0];
    if (withBuff) {press(g, 0);run(g, CAST + 2);}
    drain(b, 4);run(g, 1);const s0 = b.stamina;
    step(g, cmd({dodge: true, move: vec(1, 0)}));
    return s0 - b.stamina;
  };
  const base = cost(false), buff = cost(true);
  assert.ok(base > .1, `custo base ${base}`);
  assert.ok(Math.abs(buff / base - .75) < .03, `razão ${buff / base}`);
});
test('sprint consome 25% menos stamina por segundo durante o buff', () => {
  const slope = withBuff => {
    // regeneração extra zerada só para ISOLAR o custo do sprint (ela somaria stamina e mascararia o consumo)
    const g = arena({equip: withBuff ? ['second-wind'] : [], setup: () => {C.world.secondWind.regenPctPerSecond = 0;}});const b = g.fighters[0];
    if (withBuff) {press(g, 0);run(g, CAST + 2);}
    drain(b, 6);
    step(g, cmd({dodge: true, dodgeHeld: true, move: vec(0, 1)}));
    run(g, secs(1.2), () => cmd({dodgeHeld: true, move: vec(0, 1)}));
    assert.ok(b.sprinting, 'entrou em sprint');
    const s0 = b.stamina;run(g, secs(.5), () => cmd({dodgeHeld: true, move: vec(0, 1)}));
    assert.ok(b.sprinting, 'continua em sprint');
    return (s0 - b.stamina) / .5;
  };
  const base = slope(false), buff = slope(true);
  assert.ok(base > .3, `consumo base ${base}/s`);
  assert.ok(Math.abs(buff / base - .75) < .05, `razão ${buff / base} (base ${base.toFixed(3)}/s)`);
});
test('não recupera HP, não altera cooldowns de outros Moves e não dá invulnerabilidade', () => {
  const g = arena({equip: ['second-wind']});const b = g.fighters[0];
  b.hp = 50;press(g, 0);run(g, CAST + secs(2));
  assert.equal(b.hp, 50);
  assert.ok(status(b, 'second-wind'));
  assert.equal(stat(b, 'cooldownRate', 1), 1);
});
test('stagger/stun não cancela o buff; coexiste com Harden', () => {
  const g = arena({equip: ['second-wind', 'harden']});const b = g.fighters[0];
  press(g, 0);run(g, CAST + 2);
  b.stun = .5;run(g, 30);
  assert.ok(status(b, 'second-wind'), 'stagger não cancela');
  run(g, 60);   // espera o stagger de 0,5 s acabar para poder usar o segundo Move
  g.step(cmd({skill: 1, skillHeld: [false, true, false, false]}), cmd());run(g, CAST + 2);
  assert.ok(status(b, 'second-wind') && status(b, 'harden'), 'os dois buffs coexistem');
});
test('cast interrompido: stamina e recarga ficam gastas e NÃO há buff (conforme a proposta)', () => {
  const g = arena({equip: ['second-wind'], positions: [vec(0, -3), vec(0, -1.2)]});const b = g.fighters[0];
  press(g, 0);redTackle(g);run(g, 60);
  assert.equal(status(b, 'second-wind'), null);
  assert.ok(b.moveCooldowns['second-wind'] > 10);
});
test('M28.4: sliders mexidos depois do início do uso não alteram o buff em andamento', () => {
  const g = arena({equip: ['second-wind']});const b = g.fighters[0];
  press(g, 0);C.world.secondWind.regenPctPerSecond = 0;C.world.secondWind.mobilityCostPct = .9;C.world.secondWind.duration = 1;
  run(g, CAST + 2);
  const s = status(b, 'second-wind');
  assert.ok(Math.abs(s.mul.mobilityCost - .75) < 1e-9 && s.tick.stamina > 0 && s.remaining > 4.9, 'parâmetros capturados no início do uso');
});
test('sliders têm efeito: mobilityCostPct 0,5 → custo × 0,5; regenPctPerSecond 0 → sem regeneração extra', () => {
  const g = arena({equip: ['second-wind'], setup: () => {C.world.secondWind.mobilityCostPct = .5;C.world.secondWind.regenPctPerSecond = 0;}});const b = g.fighters[0];
  press(g, 0);run(g, CAST + 2);
  const s = status(b, 'second-wind');
  assert.equal(s.mul.mobilityCost, .5);assert.equal(s.tick.stamina, 0);
});
test('paridade: registrado e NÃO equipado, a partida é idêntica (e save/load reproduz o futuro com o buff ativo)', () => {
  const sim = () => {const g = arena();g.mode = 'tactical';C.extras.toggles.enableEnemyAI = 1;for (let i = 0; i < 1200; i++) g.step(cmd(), undefined);return fighterHash(g);};
  assert.equal(sim(), sim());
  const play = split => {
    const g = arena({equip: ['second-wind']});press(g, 0);run(g, CAST + 40);
    if (split) {const snap = g.save();const h = new Game({seed: 3});h.start();h.load(snap);run(h, 300);return fighterHash(h);}
    run(g, 300);return fighterHash(g);
  };
  assert.equal(play(true), play(false));
});

done();
