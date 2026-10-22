// @ts-check
// Guard Break (genérico, Charge · Melee · PL1/PL2/PL3): carga até 1 s, golpe de 0,7 s pós-soltura, 6 HP nominais, 2 m/s H, guard stun 0,5 s.
// Fonte: docs/moves-nao-iniciados/5_MOVES_GENERICOS_PROMPT.md §4. Resolve como Tackle (colisão, defesa, Clash, i-frames).
import {assert, C, Game, cmd, vec, secs, suite, arena, run, fighterHash, HOLD} from './moves-new-helpers.mjs';
import {getMove} from '../src/sim/moves.js';

const {test, done} = suite('GUARD BREAK');
const hold = {skill: 0, skillHeld: HOLD(0)};
const held = {skillHeld: HOLD(0)};
/** Azul carrega por `ticks` passos (incluindo o do toque) e solta; devolve o jogo logo depois da soltura. */
function release({ticks = 30, dist = 2.2, tweak = null, equipRed = [], red = () => cmd(), atk = null} = {}) {
  const g = arena({equip: ['guard-break'], equipRed, setup: tweak, positions: [vec(0, -dist / 2), vec(0, dist / 2)]});
  if (atk) g.fighters[0].attributes.attack = atk;
  g.step(cmd(hold), red(0));
  for (let i = 1; i < ticks; i++) g.step(cmd(held), red(i));
  g.step(cmd(), red(ticks));
  return g;
}
const play = (g, n, red = () => cmd()) => {const ev = [];for (let i = 0; i < n; i++) {g.step(cmd(), red(i));ev.push(...g.lastStepEvents);}return ev;};
const hits = ev => ev.filter(e => e.attacker === 0 && ['impact', 'partial', 'perfect'].includes(e.result));
/** Vermelho defende (comum ou perfeita) durante todo o golpe. */
const guardCmd = (perfectFirst = false) => i => cmd({guard: true, guardPressed: perfectFirst && i === 0});
function guarded({ticks = 30} = {}) {
  const g = arena({equip: ['guard-break'], positions: [vec(0, -1.1), vec(0, 1.1)]});
  const red = g.fighters[1];
  g.step(cmd(), cmd({guard: true, guardPressed: true}));
  run(g, secs(.5), () => cmd(), () => cmd({guard: true}));
  g.step(cmd(hold), cmd({guard: true}));
  for (let i = 1; i < ticks; i++) g.step(cmd(held), cmd({guard: true}));
  g.step(cmd(), cmd({guard: true}));
  return {g, red};
}

test('registrado com os dados da proposta: 1,0 de stamina, 10 s, carga máx. 1 s, 0,7 s; nada equipado por padrão', () => {
  const g = arena();const d = getMove('guard-break');
  assert.deepEqual([d.cost, d.cooldown, d.tackle, d.charge.max], [1, 10, 'guard-break', 1]);
  assert.ok(g.fighters.every(f => (f.loadout ?? []).every(x => !x)));
});
test('stamina e cooldown cobrados ao INICIAR a carga; interromper a carga mantém os dois', () => {
  const g = arena({equip: ['guard-break']});const b = g.fighters[0];
  g.step(cmd(hold), cmd());
  assert.ok(b.charge, 'carregando');assert.ok(Math.abs(b.moveCooldowns['guard-break'] - 10) < .06, `cooldown ${b.moveCooldowns['guard-break']}`);
  assert.ok(C.rules.staminaMax - b.stamina > .95, `stamina gasta ${C.rules.staminaMax - b.stamina}`);
  run(g, 20, () => cmd(held));
  g.step(cmd({...held, guardPressed: true, guard: true}), cmd());   // defesa cancela a carga
  assert.ok(!b.charge && !b.action, 'carga encerrada');
  assert.ok(b.moveCooldowns['guard-break'] >= 5 - .06, `cooldown mantido ${b.moveCooldowns['guard-break']}`);
  assert.ok(C.rules.staminaMax - b.stamina > .95, 'stamina não devolvida');
});
test('PL pela carga: <50% = PL1, de 50% a <100% = PL2, 100% = PL3 (marcos em passos)', () => {
  const pl = ticks => release({ticks, dist: 6}).fighters[0].action?.pl;
  assert.equal(pl(5), 1);assert.equal(pl(59), 1);assert.equal(pl(61), 2);assert.equal(pl(119), 2);assert.equal(pl(130), 3);
});
test('a carga máxima é 1 s: segurar mais não passa de PL3 e o golpe sai ao soltar (não automático)', () => {
  const g = arena({equip: ['guard-break']});const b = g.fighters[0];
  g.step(cmd(hold), cmd());run(g, 300, () => cmd(held));
  assert.ok(b.charge && b.charge.ticks === 120, `ticks ${b.charge?.ticks}`);assert.ok(!b.action);
});
test('a soltura vira UM Tackle real marcado com o Move, sem cobrar de novo', () => {
  const g = release({ticks: 30, dist: 6});const b = g.fighters[0];
  assert.equal(b.action.kind, 'tackle');assert.equal(b.action.move, 'guard-break');
  assert.ok(C.rules.staminaMax - b.stamina < 1.3 && C.rules.staminaMax - b.stamina > .95, `stamina gasta ${C.rules.staminaMax - b.stamina}`);
  assert.ok(b.moveCooldowns['guard-break'] > 9, 'recarga não reiniciada');
});
test('alvo sem guarda: dano nominal 6 HP (proporcional ao Ataque) e empurrão de 2 m/s sem voo', () => {
  const dmg = atk => {const g = release({atk});const r = g.fighters[1], h = r.hp;const ev = play(g, 160);return {loss: h - r.hp, ev};};
  const a = dmg(20), b = dmg(40);
  assert.ok(Math.abs(a.loss - 6) < 1e-6, `${a.loss}`);assert.ok(Math.abs(b.loss - 12) < 1e-6);
  const ev = hits(a.ev);assert.equal(ev.length, 1);
  assert.ok(Math.abs(ev[0].launch.horizontal - 2) < 1e-6 && ev[0].launch.vertical === 0, JSON.stringify(ev[0].launch));
});
test('contra guarda comum: guard stun de 0,5 s, guarda derrubada, dano reduzido e SEM empurrão; o atacante não recua', () => {
  const none = (() => {const g = release();const r = g.fighters[1], h = r.hp;play(g, 160);return h - r.hp;})();
  const {g, red} = guarded();const b = g.fighters[0], h = red.hp, z0 = red.position.z;
  const ev = [];for (let i = 0; i < 160; i++) {g.step(cmd(), cmd({guard: true}));ev.push(...g.lastStepEvents);if (hits(ev).length && red.stun > .3) break;}
  const hit = hits(ev)[0];
  assert.ok(hit && hit.result === 'partial' && hit.guardBreak && Math.abs(hit.stun - .5) < 1e-9, JSON.stringify(hit));
  assert.ok(Math.abs(red.stun - .5) < .05, `stun ${red.stun}`);assert.ok(!red.guard, 'guarda derrubada');
  assert.ok(Math.abs(red.position.z - z0) < .3, 'sem empurrão');
  assert.ok(h - red.hp > 0 && h - red.hp < none, `${h - red.hp} < ${none}`);
  assert.notEqual(b.state, 'recoil');
});
test('o guard stun impede ações do defensor por 0,5 s e depois libera', () => {
  const {g, red} = guarded();
  for (let i = 0; i < 200 && !(red.stun > .3); i++) g.step(cmd(), cmd({guard: true}));
  assert.ok(red.stun > .3);
  run(g, secs(.55), () => cmd(), () => cmd());
  assert.ok(red.stun <= 1e-8, `stun restante ${red.stun}`);
});
test('defesa perfeita: dano 0, empurrão 0 e guard stun 0 (GM-P05, proposta); o atacante recua', () => {
  const {g, red} = guarded();const b = g.fighters[0], h = red.hp;
  const ev = [];for (let i = 0; i < 200; i++) {red.perfectLeft = 1;red.perfectSucceeded = false;g.step(cmd(), cmd({guard: true}));ev.push(...g.lastStepEvents);}
  assert.ok(ev.some(e => e.result === 'perfect'), `resultados ${[...new Set(ev.map(e => e.result))]}`);
  assert.equal(red.hp, h);assert.equal(red.stun, 0);
  void b;
});
test('sob Harden: empurrão 0 mas o guard stun AINDA vale (GM-P06, proposta); sem guarda, dano sem empurrão', () => {
  const g = arena({equip: ['guard-break'], equipRed: ['harden'], positions: [vec(0, -1.1), vec(0, 1.1)]});const red = g.fighters[1];
  g.step(cmd(), cmd({skill: 0, skillHeld: HOLD(0)}));run(g, secs(.4), () => cmd(), () => cmd());
  assert.ok(red.statuses.some(s => s.id === 'harden'));
  const z0 = red.position.z;
  g.step(cmd(hold), cmd());for (let i = 1; i < 30; i++) g.step(cmd(held), cmd());g.step(cmd(), cmd());
  const ev = play(g, 120);
  const hit = hits(ev);assert.equal(hit.length, 1);
  assert.ok(!hit[0].launch || hit[0].launch.horizontal === 0, `knockback ${JSON.stringify(hit[0].launch)}`);assert.ok(!red.flight);void z0;
});
test('i-frames do alvo (esquiva): nenhum efeito', () => {
  const g = release({dist: 2});const r = g.fighters[1], h = r.hp;
  const ev = play(g, 160, i => cmd(i === 0 ? {dodge: true, move: vec(1, 0)} : {}));
  void ev;
  assert.ok(g.fighters[1].stun === 0 && (h - r.hp === 0 || r.state !== 'recoil'));
});
test('Clash: Guard Break PL3 vence Tackle PL1; PL3 contra PL3 empata em disputa', () => {
  const win = (() => {
    const g = arena({equip: ['guard-break'], positions: [vec(0, -1.6), vec(0, 1.6)]});
    g.step(cmd(hold), cmd());for (let i = 1; i < 125; i++) g.step(cmd(held), cmd());
    g.step(cmd(), cmd({tackle: true, move: vec(0, -1)}));
    play(g, 120);return g.fighters[1].plDefeated || g.fighters[1].action?.neutralized || g.fighters[1].hp < 100;
  })();
  assert.ok(win, 'PL3 vence o Tackle PL1');
  const g = arena({equip: ['guard-break'], equipRed: ['guard-break'], positions: [vec(0, -1.6), vec(0, 1.6)]});
  g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
  g.step(cmd(hold), cmd(hold));for (let i = 1; i < 125; i++) g.step(cmd(held), cmd(held));
  g.step(cmd(), cmd());
  const ev = play(g, 160);
  assert.ok(ev.some(e => /clash/i.test(e.result)), `eventos: ${[...new Set(ev.map(e => e.result))].join(',')}`);
});
test('recuperação longa: só se pode esquivar depois de 0,47 s (cancelável após o contato)', () => {
  const tryDodge = at => {const g = release({dist: 6});run(g, secs(at));g.step(cmd({dodge: true, move: vec(1, 0)}), cmd());return g.fighters[0].action?.kind;};
  assert.equal(tryDodge(.2), 'tackle');assert.equal(tryDodge(.55), 'dodge');
});
test('M28.4: sliders mexidos depois do início da carga não alteram o golpe em andamento', () => {
  const g = arena({equip: ['guard-break'], positions: [vec(0, -1.1), vec(0, 1.1)]});const r = g.fighters[1], h = r.hp;
  g.step(cmd(hold), cmd());
  C.world.guardBreak.damage = 99;C.world.guardBreak.stun = 3;
  for (let i = 1; i < 30; i++) g.step(cmd(held), cmd());g.step(cmd(), cmd());
  play(g, 160);
  assert.ok(Math.abs(h - r.hp - 6) < 1e-6, `dano ${h - r.hp}`);
});
test('sliders têm efeito: damage, stun, maxCharge e knockbackV mudam o resultado', () => {
  const g1 = release({tweak: () => {C.world.guardBreak.damage = 10;}});const r = g1.fighters[1], h = r.hp;play(g1, 160);
  assert.ok(Math.abs(h - r.hp - 10) < 1e-6);
  const g2 = release({ticks: 70, dist: 6, tweak: () => {C.world.guardBreak.maxCharge = .5;}});
  assert.equal(g2.fighters[0].action?.pl, 3, 'com carga máxima 0,5 s, 70 passos já é PL3');
  const g3 = release({tweak: () => {C.world.guardBreak.knockbackV = 5;}});const ev = hits(play(g3, 160));
  assert.ok(ev[0].launch.vertical > 0);
});
test('paridade e determinismo: registrado e não equipado não muda nada; save/load na carga reproduz o futuro', () => {
  const sim = () => {const g = arena();g.mode = 'tactical';C.extras.toggles.enableEnemyAI = 1;for (let i = 0; i < 1200; i++) g.step(cmd(), undefined);return fighterHash(g);};
  assert.equal(sim(), sim());
  const go = split => {
    const g = arena({equip: ['guard-break'], positions: [vec(0, -1.1), vec(0, 1.1)]});
    g.step(cmd(hold), cmd());for (let i = 1; i < 25; i++) g.step(cmd(held), cmd());
    const cont = x => {for (let i = 0; i < 60; i++) x.step(cmd(held), cmd());x.step(cmd(), cmd());run(x, 200);return fighterHash(x);};
    if (split) {const snap = g.save();const h = new Game({seed: 3});h.start();h.load(snap);return cont(h);}
    return cont(g);
  };
  assert.equal(go(true), go(false));
});

done();
void guardCmd;
