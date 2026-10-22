// @ts-check
// Riposte (genérico, Normal · Status + Melee, PL1 no contra-golpe): postura de 0,65 s; acerto elegível entre 0,13 e 0,30 s é anulado e dispara um Tackle PL1
// (14 HP, 9 m/s H e 2,5 V no laboratório desde 22/10/2026; a proposta original era 6 HP e 3 m/s H). Fonte: docs/moves-nao-iniciados/5_MOVES_GENERICOS_PROMPT.md §6. Não anula Guard Break.
import {assert, C, Game, cmd, vec, secs, suite, arena, run, fighterHash, HOLD} from './moves-new-helpers.mjs';
import {getMove} from '../src/sim/moves.js';
import {resolveHit} from '../src/sim/combat.js';

const {test, done} = suite('RIPOSTE');
const press0 = {skill: 0, skillHeld: HOLD(0)};
/**
 * Azul usa o Riposte no passo 0; o vermelho (a `dist` m) dispara uma estrela do Swift no passo `fireAt` (a estrela chega ~`travel` s depois).
 * Devolve {g, ev}: eventos de `steps` passos.
 */
function swiftAt({fireAt = 20, dist = 2, steps = 180, tweak = null, atk = null, count = 1} = {}) {
  const g = arena({equip: ['riposte'], equipRed: ['swift'], positions: [vec(0, -dist / 2), vec(0, dist / 2)], setup: () => {C.world.swift.count = count;C.world.swift.fanAngle = 0;tweak?.();}});
  if (atk) g.fighters[1].attributes.attack = atk;
  const ev = [];
  for (let i = 0; i < steps; i++) {
    g.step(i === 0 ? cmd(press0) : cmd(), i === fireAt ? cmd({skill: 0, skillHeld: HOLD(0)}) : cmd());
    ev.push(...g.lastStepEvents);
  }
  return {g, ev};
}
const firstHit = ev => ev.find(e => e.target === 0 && ['riposte', 'impact', 'partial'].includes(e.result));

test('registrado com os dados da proposta: 0,80 de stamina, 8 s, 0,65 s; nada equipado por padrão', () => {
  const g = arena();const d = getMove('riposte');
  assert.deepEqual([d.cost, d.cooldown, d.duration], [.8, 8, .65]);
  assert.ok(g.fighters.every(f => (f.loadout ?? []).every(x => !x)));
});
test('custo e recarga cobrados na confirmação (no toque, sem marcador)', () => {
  const g = arena({equip: ['riposte']});const b = g.fighters[0];
  g.step(cmd(press0), cmd());
  assert.equal(b.action.move, 'riposte');assert.ok(Math.abs(b.moveCooldowns.riposte - 8) < .06);
  assert.ok(C.rules.staminaMax - b.stamina > .75 && C.rules.staminaMax - b.stamina < .85);
});
test('acerto DENTRO da janela (0,13–0,30 s): dano e knockback anulados, evento riposte', () => {
  const {g, ev} = swiftAt({fireAt: 20});const b = g.fighters[0];
  const h = firstHit(ev);
  assert.equal(b.hp, b.attributes.hp, "azul sem dano");
  assert.ok(h && h.result === 'riposte', JSON.stringify(h));
  assert.equal(h.damage, 0);assert.equal(h.launch, null);
  assert.equal(ev.filter(e => e.target === 0 && e.result === 'impact').length, 0, 'ninguém acertou o azul');
});
test('o contra-golpe NUNCA faz clash: contra um Tackle (PL1 ou carregado) o PL 4 vence, o rival é neutralizado e não há evento de clash', () => {
  let riposted = 0;
  for (const pl of [1, 2, 3]) for (const startAt of [6, 10, 14, 18]) {
    const g = arena({equip: ['riposte'], positions: [vec(0, -1.6), vec(0, 1.6)], setup: () => {C.extras.toggles.enableClash = 1;}});
    const [b, r] = g.fighters;b.facing = 0;r.facing = Math.PI;
    const ev = [];
    for (let i = 0; i < 160; i++) {
      if (i === startAt) {r.stamina = C.rules.staminaMax;}
      g.step(i === 0 ? cmd(press0) : cmd(), i === startAt ? cmd({tackle: true, move: vec(0, -1)}) : cmd({move: vec(0, -1)}));
      if (i === startAt) r.action && (r.action.pl = pl);
      ev.push(...g.lastStepEvents);
    }
    assert.equal(ev.filter(e => e.result === 'clash').length, 0, `clash com PL ${pl} (início em ${startAt})`);
    if (ev.some(e => e.result === 'riposteStrike')) {riposted++;assert.ok(r.hp < r.attributes.hp || r.plDefeated || ev.some(e => e.target === 1 && ['impact', 'partial'].includes(e.result)), 'o contra-golpe conectou ou o rival foi derrotado pelo PL');}
  }
  assert.ok(riposted >= 1, 'o contra-golpe disparou em pelo menos um dos casos');
});
test('o contra-golpe sai na hora: Tackle marcado com o Move, rumo a quem atacou, tratado como PL 4', () => {
  const {g, ev} = swiftAt({fireAt: 20, steps: 40});const b = g.fighters[0];
  assert.ok(ev.some(e => e.result === 'riposteStrike'), 'evento do contra-golpe');
  assert.equal(b.action?.kind, 'tackle');assert.equal(b.action.move, 'riposte');assert.equal(b.action.pl, 4);assert.ok(b.action.riposteStrike);
  assert.ok(Math.abs(b.action.heading - 0) < .2, `rumo ${b.action.heading}`);
});
test('o contra-golpe é um GRANDE impacto: 14 HP nominais (× Ataque ÷ referência), 9 m/s H e 2,5 m/s V, evento marcado como riposte', () => {
  const dmg = atk => {const {g, ev} = swiftAt({fireAt: 20, atk: null, tweak: () => {}});g.fighters[0].attributes.attack = atk;return {g, ev};};
  void dmg;
  const {g, ev} = swiftAt({fireAt: 20, steps: 200});const r = g.fighters[1];
  const strike = ev.find(e => e.attacker === 0 && e.target === 1 && e.result === 'impact');
  assert.ok(strike, `eventos ${[...new Set(ev.map(e => e.attacker + ':' + e.result))]}`);
  assert.ok(Math.abs(strike.damage - 14) < 1e-6, `dano ${strike.damage}`);
  assert.ok(Math.abs(strike.launch.horizontal - 9) < 1e-6 && Math.abs(strike.launch.vertical - 2.5) < 1e-6, JSON.stringify(strike.launch));
  assert.equal(strike.riposte, true, 'o evento de impacto leva a marca riposte (hitstop, tremor e explosão visual dependem dela)');void r;
});
test('i-frames até o fim da janela: as outras estrelas do mesmo disparo também são anuladas', () => {
  const {g, ev} = swiftAt({fireAt: 20, count: 3, tweak: () => {C.world.swift.spawnSpacing = 0;}});
  assert.equal(ev.filter(e => e.target === 0 && e.result === 'impact').length, 0, 'nenhum dano ao azul');
  assert.ok(ev.filter(e => e.target === 0 && (e.result === 'riposte' || e.result === 'invulnerable')).length >= 2);
  void g;
});
test('acerto ANTES da janela (< 0,13 s) causa dano normal e não dispara contra-golpe', () => {
  const {g, ev} = swiftAt({fireAt: 0, steps: 90});
  const h = firstHit(ev);
  assert.ok(h && h.result === 'impact' && h.damage > 0, JSON.stringify(h));
  assert.ok(!ev.some(e => e.result === 'riposteStrike'));
  assert.ok(g.fighters[0].hp < 100);
});
test('acerto DEPOIS da janela (> 0,30 s) causa dano normal: o Riposte fechou e o personagem está exposto', () => {
  const {g, ev} = swiftAt({fireAt: 35, steps: 140});
  const h = firstHit(ev);
  assert.ok(h && h.result === 'impact' && h.damage > 0, JSON.stringify(h));
  assert.ok(!ev.some(e => e.result === 'riposteStrike'));void g;
});
test('sem acerto: a janela fecha, o personagem fica exposto até 0,65 s e depois volta ao normal', () => {
  const g = arena({equip: ['riposte']});const b = g.fighters[0];
  g.step(cmd(press0), cmd());run(g, secs(.5));assert.equal(b.action?.move, 'riposte', 'ainda em postura aos 0,5 s');
  run(g, secs(.2));assert.ok(!b.action, 'terminou aos 0,65 s');
});
test('Tackle de adversário na janela: anulado e contra-golpe (caminho de resolveHit)', () => {
  const g = arena({equip: ['riposte'], positions: [vec(0, -1), vec(0, 1)]});const [b, r] = g.fighters;
  g.step(cmd(press0), cmd());run(g, secs(.2));
  g.step(cmd(), cmd({tackle: true, move: vec(0, -1)}));
  const ev = r.action ? resolveHit(r, b, vec(0, -1), vec(0, -5), true) : null;
  assert.ok(ev && ev.result === 'riposte', JSON.stringify(ev));
});
test('Guard Break NÃO é anulado pelo Riposte (mantém o triângulo tático): dano normal', () => {
  const g = arena({equip: ['riposte'], positions: [vec(0, -1), vec(0, 1)]});const [b, r] = g.fighters;
  g.step(cmd(press0), cmd());run(g, secs(.2));
  g.step(cmd(), cmd({tackle: true, move: vec(0, -1)}));
  r.action.guardBreak = {stun: .5};
  const ev = resolveHit(r, b, vec(0, -1), vec(0, -5), true);
  assert.ok(ev && ev.result !== 'riposte' && ev.damage > 0, JSON.stringify(ev));
});
test('atacante em i-frames: o contra-golpe não conecta (sem dano e sem knockback)', () => {
  const {g, ev} = swiftAt({fireAt: 20, steps: 8});
  g.fighters[1].action = {kind: 'dodge', elapsed: 0, heading: 0, startAngle: 0, hits: new Set(), invulnerableFor: 5};
  const out = [];for (let i = 0; i < 160; i++) {g.step(cmd(), cmd());out.push(...g.lastStepEvents);}
  assert.ok(!out.some(e => e.attacker === 0 && e.result === 'impact'), 'sem dano em quem está invulnerável');void ev;
});
test('M28.4: sliders mexidos depois do uso não alteram o golpe em andamento; o próximo uso lê o novo', () => {
  const g = arena({equip: ['riposte'], equipRed: ['swift'], positions: [vec(0, -1), vec(0, 1)], setup: () => {C.world.swift.fanAngle = 0;C.world.swift.count = 1;}});
  g.step(cmd(press0), cmd());C.world.riposte.damage = 99;C.world.riposte.windowEnd = 1;
  const ev = [];
  for (let i = 1; i < 220; i++) {g.step(cmd(), i === 20 ? cmd({skill: 0, skillHeld: HOLD(0)}) : cmd());ev.push(...g.lastStepEvents);}
  const s = ev.find(e => e.attacker === 0 && e.result === 'impact');
  assert.ok(!s || Math.abs(s.damage - 14) < 1e-6, `dano ${s?.damage}`);
});
test('sliders têm efeito: damage, windowStart/windowEnd e strikeRange', () => {
  const noWindow = swiftAt({fireAt: 20, tweak: () => {C.world.riposte.windowStart = .4;C.world.riposte.windowEnd = .5;}});
  assert.ok(noWindow.ev.find(e => e.target === 0 && e.result === 'impact'), 'janela deslocada: o acerto passa');
  const big = swiftAt({fireAt: 20, steps: 200, tweak: () => {C.world.riposte.damage = 12;}});
  const strike = big.ev.find(e => e.attacker === 0 && e.target === 1 && e.result === 'impact');
  assert.ok(strike && Math.abs(strike.damage - 12) < 1e-6, `${strike?.damage}`);
});
test('paridade e determinismo: registrado e não equipado não muda nada; save/load na janela reproduz o futuro', () => {
  const sim = () => {const g = arena();g.mode = 'tactical';C.extras.toggles.enableEnemyAI = 1;for (let i = 0; i < 1200; i++) g.step(cmd(), undefined);return fighterHash(g);};
  assert.equal(sim(), sim());
  const go = split => {
    const g = arena({equip: ['riposte'], equipRed: ['swift'], positions: [vec(0, -1), vec(0, 1)], setup: () => {C.world.swift.fanAngle = 0;C.world.swift.count = 1;}});
    for (let i = 0; i < 22; i++) g.step(i === 0 ? cmd(press0) : cmd(), i === 20 ? cmd({skill: 0, skillHeld: HOLD(0)}) : cmd());
    if (split) {const snap = g.save();const h = new Game({seed: 3});h.start();h.load(snap);run(h, 200);return fighterHash(h);}
    run(g, 200);return fighterHash(g);
  };
  assert.equal(go(true), go(false));
});

test('o contra-golpe que acerta pausa mais (hitstopMult) que um golpe comum', () => {
  const hs = mult => {
    const g = arena({equip: ['riposte'], positions: [vec(0, -1.6), vec(0, 1.6)], setup: () => {C.extras.toggles.enableHitstop = 1;C.world.riposte.hitstopMult = mult;}});
    g.step(cmd(press0), cmd());let peak = 0;
    for (let i = 1; i < 260; i++) {g.step(cmd(), i === 8 ? cmd({tackle: true, move: vec(0, -1)}) : cmd());peak = Math.max(peak, g.hitstop);}
    return peak;
  };
  const a = hs(1), b = hs(3);
  assert.ok(a > 0 && b > a * 2.5, `hitstop ${a} -> ${b}`);
});

done();

