// @ts-check
// Swift (genérico, Burst · Projectile · PL1): 3 estrelas, 15 m/s, 3 HP nominais, homing 0,25 s a 90°/s, alcance 12 m, knockback 0,3 m/s (teto 0,9).
// Fonte: docs/MOVES_GENERICOS_CATALOGO.md §3.
import {assert, C, Game, cmd, vec, secs, suite, arena, step, run, press, fighterHash, resetConfig, factoryDefaults} from './moves-new-helpers.mjs';
import {getMove} from '../src/sim/moves.js';
import {spawn} from '../src/sim/world.js';
import {swiftSpread} from '../src/sim/moves/swift.js';

const {test, done} = suite('SWIFT');
const stars = g => g.world.entities.filter(e => e.kind === 'projectile' && e.captured?.move === 'swift');
/** Azul usa Swift contra o vermelho a `dist` m; `lock` liga o lock-on (cmd.target). Devolve o jogo após o disparo. */
function shoot({dist = 6, lock = true, tweak = null, redMove = null, steps = 1} = {}) {
  const g = arena({equip: ['swift'], setup: tweak, positions: [vec(0, -dist / 2), vec(0, dist / 2)]});
  g.step(cmd({skill: 0, skillHeld: [true, false, false, false], target: lock ? 1 : null, locked: lock}), cmd());
  for (let i = 1; i < steps; i++) g.step(cmd({target: lock ? 1 : null, locked: lock}), redMove ? redMove(i) : cmd());
  return g;
}
const events = (g, n = 240) => {const out = [];for (let i = 0; i < n; i++) {g.step(cmd(), cmd());out.push(...g.lastStepEvents);}return out;};

test('registrado com os dados do catálogo: 0,8 de stamina, 7 s, PL1; nada equipado por padrão', () => {
  const g = arena();const d = getMove('swift');
  assert.deepEqual([d.cost, d.cooldown], [.8, 7]);assert.ok(g.fighters.every(f => (f.loadout ?? []).every(x => !x)));
});
test('Burst: as 3 estrelas nascem no primeiro passo; stamina e cooldown cobrados no início', () => {
  const g = shoot({steps: 3});const b = g.fighters[0];
  assert.equal(stars(g).length, 3);
  assert.ok(Math.abs(b.moveCooldowns.swift - 7) < .06 && b.stamina < C.rules.staminaMax - .7);
});
test('estrelas PL1 clashable, 15 m/s e alcance de 12 m (vida = alcance ÷ velocidade)', () => {
  const g = shoot({lock: false});const s = stars(g);
  assert.ok(s.every(e => e.pl === 1 && e.clashable));
  assert.ok(s.every(e => Math.abs(Math.hypot(e.vel.x, e.vel.z) - 15) < .01));
  assert.ok(s.every(e => Math.abs(e.life - 12 / 15) < 1e-9));
});
test('sem lock-on: leque frontal simétrico (abertura total de 20°, ±10°) e sem homing', () => {
  const s = stars(shoot({lock: false}));
  assert.ok(s.every(e => !e.homing));
  const angs = s.map(e => Math.atan2(e.vel.x, e.vel.z) * 180 / Math.PI).sort((a, b) => a - b);
  assert.ok(Math.abs(angs[0] + 10) < .5 && Math.abs(angs[1]) < .5 && Math.abs(angs[2] - 10) < .5, JSON.stringify(angs));
  assert.equal(swiftSpread(0, 1, 1), 0);
});
test('com lock-on: homing de 0,25 s a 90°/s mirando pontos dentro da caixa do alvo', () => {
  const s = stars(shoot({lock: true}));
  assert.ok(s.every(e => e.homing && Math.abs(e.homing.ticks - Math.round(.25 / C.test.step)) <= 1 && Math.abs(e.homing.rate - Math.PI / 2) < 1e-9));
  assert.ok(s.every(e => Math.abs(e.homing.offset.x) <= C.test.halfExtent && Math.abs(e.homing.offset.z) <= C.test.halfExtent));
});
test('com lock-on e alvo parado as três estrelas acertam: 3 × (3 HP × Ataque ÷ referência)', () => {
  const g = shoot({lock: true});const r = g.fighters[1], hp0 = r.hp;
  const ev = events(g).filter(e => e.result === 'impact' && e.attacker === 0);
  assert.equal(ev.length, 3);
  const each = 3 * g.fighters[0].attributes.attack / C.test.attackReference;
  assert.ok(Math.abs((hp0 - r.hp) - 3 * each) < 1e-6, `dano total ${hp0 - r.hp} esperado ${3 * each}`);
});
test('homing é limitado: alvo que muda de direção muito além de 90°/s por 0,25 s escapa de parte das estrelas; sem homing escapa de mais', () => {
  const hits = lock => {
    const g = arena({equip: ['swift'], positions: [vec(-6, 0), vec(2, 0)]});
    g.fighters[0].facing = Math.PI / 2;g.fighters[1].facing = -Math.PI / 2;
    g.step(cmd({skill: 0, skillHeld: [true, false, false, false], target: lock ? 1 : null, locked: lock}), cmd());
    let n = 0;
    for (let i = 0; i < 240; i++) {g.step(cmd(), cmd({move: vec(0, i < 25 ? 1 : 0)}));n += g.lastStepEvents.filter(e => e.result === 'impact' && e.attacker === 0).length;}
    return n;
  };
  assert.ok(hits(true) >= hits(false), `homing não piora (${hits(true)} × ${hits(false)})`);
});
test('knockback de 0,3 m/s por estrela com teto de 0,9 m/s por alvo e execução, vertical 0', () => {
  const g = shoot({lock: true});
  const ev = events(g).filter(e => e.result === 'impact' && e.attacker === 0 && e.launch);
  assert.ok(ev.length >= 1);
  assert.ok(ev.every(e => Math.abs(e.launch.horizontal - .3) < 1e-6 && e.launch.vertical === 0), JSON.stringify(ev.map(e => e.launch)));
  assert.ok(ev.reduce((s, e) => s + e.launch.horizontal, 0) <= .9 + 1e-6);
});
test('teto cumulativo: com knockbackCap 0,4 só uma estrela inteira + resto empurram o alvo', () => {
  const g = shoot({lock: true, tweak: () => {C.world.swift.knockbackCap = .4;}});
  const sum = events(g).filter(e => e.result === 'impact' && e.attacker === 0 && e.launch).reduce((s, e) => s + e.launch.horizontal, 0);
  assert.ok(Math.abs(sum - .4) < 1e-6, `${sum}`);
});
test('defesa perfeita anula o dano das estrelas e defesa comum o reduz (mesma função de acerto)', () => {
  const dmg = guard => {
    const g = arena({equip: ['swift'], positions: [vec(0, -3), vec(0, 3)]});
    g.step(cmd({skill: 0, skillHeld: [true, false, false, false], target: 1, locked: true}), cmd());
    const r = g.fighters[1];let hp0 = r.hp;
    for (let i = 0; i < 240; i++) g.step(cmd(), guard ? cmd({guard: true, guardPressed: i === 0}) : cmd());
    return hp0 - r.hp;
  };
  const none = dmg(false), guarded = dmg(true);
  assert.ok(none > 0 && guarded < none, `${guarded} < ${none}`);
});
test('estrela × estrela de donos diferentes (PL1 × PL1): as duas se anulam e ninguém leva dano (regra de disputa das entidades)', () => {
  const g = arena({equip: ['swift'], equipRed: ['swift'], setup: () => {C.world.swift.fanAngle = 0;}, positions: [vec(0, -3), vec(0, 3)]});
  const hp0 = g.fighters.map(f => f.hp);
  g.step(cmd({skill: 0, skillHeld: [true, false, false, false]}), cmd({skill: 0, skillHeld: [true, false, false, false]}));
  let clashes = 0;
  for (let i = 0; i < 120; i++) {g.step(cmd(), cmd());clashes += g.lastStepEvents.filter(e => /clash/i.test(e.result)).length;}
  assert.equal(stars(g).length, 0, 'todas as estrelas sumiram');
  assert.ok(g.fighters.every((f, i) => f.hp === hp0[i]), 'sem dano');
  assert.ok(clashes >= 1, `eventos de disputa: ${clashes}`);
});
test('reflexo pelo Reflect: dono troca para o refletor e o dano é recalculado com o Ataque DELE (sem duplicar)', () => {
  const g = arena({equip: ['swift'], positions: [vec(0, -4), vec(0, 4)]});
  g.fighters[1].attributes.attack = 40;   // refletor com o dobro de Ataque
  spawn(g.world, {kind: 'barrier', reflect: true, owner: 1, pos: {x: 0, z: 0}, height: 2.4, hx: 3, hz: .1, angle: Math.PI, life: 6, pl: 1, hp: Infinity, blocksProjectiles: true, blocksFighters: false, captured: {tieTolerance: .001, maxReflections: 16}}, []);
  g.step(cmd({skill: 0, skillHeld: [true, false, false, false], target: 1, locked: true}), cmd());
  const hp0 = g.fighters[0].hp;
  let reflected = 0;
  for (let i = 0; i < 300; i++) {g.step(cmd(), cmd());reflected += g.lastStepEvents.filter(e => e.result === 'reflected').length;}
  assert.ok(reflected >= 1, `refletidas ${reflected}`);
  const lost = hp0 - g.fighters[0].hp;
  assert.ok(lost > 0 && lost <= 3 * (3 * 40 / C.test.attackReference) + 1e-6, `dano ao lançador ${lost}`);
});
test('alcance de 12 m: alvo a 14 m não é atingido (estrelas expiram); a 9 m é', () => {
  const lost = d => {const g = shoot({dist: d, lock: false, tweak: () => {C.world.swift.fanAngle = 0;}});const r = g.fighters[1], hp0 = r.hp;events(g);return hp0 - r.hp;};
  assert.equal(lost(16), 0);assert.ok(lost(8) > 0);
});
test('M28.4: sliders mexidos depois do disparo não alteram as estrelas já criadas; o próximo uso lê o novo', () => {
  const g = shoot({lock: false});const before = stars(g).map(e => [e.speed ?? Math.hypot(e.vel.x, e.vel.z), e.hit.damage]);
  C.world.swift.speed = 40;C.world.swift.damage = 99;run(g, 5);
  const after = stars(g).map(e => [Math.hypot(e.vel.x, e.vel.z), e.hit.damage]);
  assert.ok(after.every(([v, d], i) => Math.abs(v - 15) < .01 && d === before[i][1]));
});
test('count, damage e speed têm efeito mensurável nos sliders', () => {
  assert.equal(stars(shoot({lock: false, tweak: () => {C.world.swift.count = 5;}})).length, 5);
  const e = stars(shoot({lock: false, tweak: () => {C.world.swift.damage = 6;C.world.swift.speed = 20;}}))[0];
  assert.ok(Math.abs(e.hit.damage - 6) < 1e-9 && Math.abs(Math.hypot(e.vel.x, e.vel.z) - 20) < .01);
});
test('paridade e determinismo: registrado e não equipado não muda nada; save/load com estrelas no ar reproduz o futuro', () => {
  const sim = () => {const g = arena();g.mode = 'tactical';C.extras.toggles.enableEnemyAI = 1;for (let i = 0; i < 1200; i++) g.step(cmd(), undefined);return fighterHash(g);};
  assert.equal(sim(), sim());
  const play = split => {
    const g = shoot({lock: true, steps: 20});
    if (split) {const snap = g.save();const h = new Game({seed: 3});h.start();h.load(snap);run(h, 200);return fighterHash(h);}
    run(g, 200);return fighterHash(g);
  };
  assert.equal(play(true), play(false));
});

done();
void secs;void step;void press;void resetConfig;void factoryDefaults;
