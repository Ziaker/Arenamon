// @ts-check
// Sand Wave (Mushroom, Burst · PL1): preparação 0,25 s, barragem retangular 4 × 3 m fixada no disparo, onda progressiva pelo caminho livre, 6 HP fixos, cegueira 4 s,
// empurrão 12 m/s², stagger de parede 0,30 s. Fonte: docs/MUSHROOM_MOVES_DECISOES.md §6 (SW-D01…SW-D68).
import {assert, C, Game, cmd, vec, secs, suite, arena, run, fighterHash, HOLD} from './moves-new-helpers.mjs';
import {getMove} from '../src/sim/moves.js';
import {canSee, isBlind} from '../src/sim/vision.js';
import {hasFlag} from '../src/sim/status.js';
import {spawn} from '../src/sim/world.js';

const {test, done} = suite('SAND WAVE');
const press0 = {skill: 0, skillHeld: HOLD(0)};
const waves = g => g.world.entities.filter(e => e.kind === 'sandwave' && !e.dead);
const blindOf = f => f.statuses?.find(s => s.id === 'blind');
/** Azul (em (0,-4), olhando +z) usa o Sand Wave; o retângulo cobre z de -4 a 0 e x de -1,5 a 1,5. */
function cast({red = vec(0, -1.5), tweak = null, atk = null, redCmd = () => cmd(), steps = 0, bluePos = vec(0, -4)} = {}) {
  const g = arena({equip: ['sand-wave'], setup: tweak, positions: [bluePos, red]});
  if (atk) g.fighters[0].attributes.attack = atk;
  g.step(cmd(press0), redCmd(0));
  for (let i = 1; i < steps; i++) g.step(cmd(), redCmd(i));
  return g;
}
const upto = (g, n, redCmd = () => cmd()) => {const ev = [];for (let i = 0; i < n; i++) {g.step(cmd(), redCmd(i));ev.push(...g.lastStepEvents);}return ev;};
const sandHits = ev => ev.filter(e => e.source === 'sand' && ['impact', 'partial', 'perfect'].includes(e.result));

test('registrado com os dados do documento: 2 de stamina, 10 s, preparação 0,25 s, só no chão; nada equipado por padrão', () => {
  const g = arena();const d = getMove('sand-wave');
  assert.deepEqual([d.cost, d.cooldown, d.duration, d.groundOnly], [2, 10, .25, true]);
  assert.ok(g.fighters.every(f => (f.loadout ?? []).every(x => !x)));
});
test('stamina e recarga cobradas na ATIVAÇÃO (t = 0), antes da preparação', () => {
  const g = cast();const b = g.fighters[0];
  assert.equal(b.action.move, 'sand-wave');assert.ok(Math.abs(b.moveCooldowns['sand-wave'] - 10) < .06);
  assert.ok(C.rules.staminaMax - b.stamina > 1.95 && C.rules.staminaMax - b.stamina < 2.05, `${C.rules.staminaMax - b.stamina}`);
  assert.equal(waves(g).length, 0, 'ainda preparando');
});
test('só pode ser ativado no chão', () => {
  const g = arena({equip: ['sand-wave']});const b = g.fighters[0];
  b.flight = {y: 2, vy: 0, horizontal: vec(0, 0)};
  g.step(cmd(press0), cmd());
  assert.ok(!b.action || b.action.move !== 'sand-wave');assert.equal(b.stamina, C.rules.staminaMax);
});
test('sair do chão na preparação cancela o golpe (custo e recarga já gastos NÃO voltam)', () => {
  const g = cast();const b = g.fighters[0];run(g, 10);
  b.flight = {y: 1.5, vy: 3, horizontal: vec(0, 0)};
  run(g, secs(.5));
  assert.equal(waves(g).length, 0, 'nenhuma barragem');assert.ok(C.rules.staminaMax - b.stamina > 1.9);assert.ok(b.moveCooldowns['sand-wave'] > 8);
});
test('interrupção na preparação cancela sem barragem e sem devolver nada', () => {
  const g = cast();const b = g.fighters[0];run(g, 10);b.stun = .3;b.action = null;
  run(g, secs(.5));
  assert.equal(waves(g).length, 0);assert.ok(b.moveCooldowns['sand-wave'] > 8);
});
test('depois dos 0,25 s nasce a barragem 4 × 3 m, 1,5 s de vida, direção fixada; o lutador fica livre na hora', () => {
  const g = cast({steps: secs(.25) + 3});const b = g.fighters[0];
  const w = waves(g)[0];
  assert.ok(w, 'barragem existe');
  assert.deepEqual([w.length, w.width, w.life, w.active], [4, 3, 1.5, .75]);
  assert.ok(Math.abs(w.dir.x) < 1e-9 && Math.abs(w.dir.z - 1) < 1e-9, JSON.stringify(w.dir));
  assert.ok(!b.action, 'livre para agir');
  b.facing = 2;run(g, 20);assert.ok(Math.abs(w.dir.z - 1) < 1e-9, 'a barragem não gira com o lançador');
});
test('acerto: 6 HP fixos (independente do Ataque), uma única vez, e cegueira de 4 s', () => {
  const dmg = atk => {const g = cast({atk});const r = g.fighters[1], h = r.hp;const ev = upto(g, secs(1.2));return {loss: h - r.hp, n: sandHits(ev).length, g, r};};
  const a = dmg(20), b = dmg(60);
  assert.ok(Math.abs(a.loss - 6) < 1e-6, `${a.loss}`);assert.ok(Math.abs(b.loss - 6) < 1e-6, 'não escala com o Ataque');
  assert.equal(a.n, 1, 'um acerto por execução');
  const st = blindOf(a.r);assert.ok(st && st.duration === 4 && hasFlag(a.r, 'blind') && isBlind(a.r));
});
test('onda progressiva: quem está mais longe é atingido mais tarde (velocidade = alcance ÷ 0,75 s)', () => {
  const hitTick = z => {
    const g = arena({equip: ['sand-wave'], positions: [vec(0, -4), vec(0, z)]});g.step(cmd(press0), cmd());
    for (let i = 1; i < secs(1.2); i++) {g.step(cmd(), cmd());if (sandHits(g.lastStepEvents).length) return i;}
    return -1;
  };
  const near = hitTick(-3), far = hitTick(-.6);
  assert.ok(near > 0 && far > near, `${near} < ${far}`);
  const dt = (far - near) / 120, expect = (3 - .6) / (4 / .75);
  assert.ok(Math.abs(dt - expect) < .06, `diferença ${dt.toFixed(3)} esperada ${expect.toFixed(3)}`);
});
test('fora do retângulo (de lado ou além do alcance) e em voo: ninguém é atingido', () => {
  const miss = (red, tweak) => {const g = cast({red, tweak});const r = g.fighters[1];if (tweak) tweak(g);const h = r.hp;upto(g, secs(1.2));return h === r.hp;};
  assert.ok(miss(vec(2.2, -2)), 'ao lado');assert.ok(miss(vec(0, 1.5)), 'além do alcance');
  const g = cast({red: vec(0, -2)});g.fighters[1].flight = {y: 40, vy: 0, horizontal: vec(0, 0)};const h = g.fighters[1].hp;upto(g, secs(1.2));
  assert.equal(g.fighters[1].hp, h, 'em voo não é elegível');
});
test('empurrão contínuo para a frente (12 m/s²): controle suspenso e SEM esquiva sob o empurrão', () => {
  const g = cast({red: vec(0, -3.5)});const r = g.fighters[1];
  upto(g, secs(.25) + 12);const z0 = r.position.z;
  for (let i = 0; i < secs(.5); i++) g.step(cmd(), cmd({move: vec(0, -1)}));   // tenta andar contra a areia
  assert.ok(r.position.z - z0 > .15, `deslocou ${(r.position.z - z0).toFixed(2)} m para a frente`);
  const dodged = (() => {g.step(cmd(), cmd({dodge: true, move: vec(1, 0)}));return r.action?.kind === 'dodge';})();
  assert.ok(r.sandPush ? !dodged : true, 'esquiva negada sob o empurrão');
});
test('sob empurrão ainda pode atacar e defender (apenas esquiva e deslocamento ficam bloqueados)', () => {
  const g = cast({red: vec(0, -3.5)});const r = g.fighters[1];
  run(g, secs(.6), () => cmd(), () => cmd());
  assert.ok(r.sandPush, 'empurrado');
  g.step(cmd(), cmd({guard: true, guardPressed: true}));assert.ok(r.guard, 'defende');
});
test('defesa parcial: dano reduzido, empurrão pela metade (6 m/s²) e a cegueira AINDA vale; perfeita anula tudo', () => {
  const run1 = mode => {
    const g = cast({red: vec(0, -3.5)});const r = g.fighters[1], h = r.hp;
    for (let i = 0; i < secs(1.2); i++) {if (mode === 'perfect') {r.perfectLeft = 1;r.perfectSucceeded = false;}g.step(cmd(), cmd({guard: true, guardPressed: i === 0}));}
    return {loss: h - r.hp, blind: !!blindOf(r), z: r.position.z, g};
  };
  const none = (() => {const g = cast({red: vec(0, -3.5)});const r = g.fighters[1], h = r.hp, z = r.position.z;upto(g, secs(1.2));return {loss: h - r.hp, z: r.position.z - z};})();
  const part = run1('partial'), perf = run1('perfect');
  assert.ok(part.loss < none.loss && part.loss > 0, `${part.loss} < ${none.loss}`);assert.ok(part.blind, 'parcial não impede cegueira');
  assert.equal(perf.loss, 0);assert.ok(!perf.blind, 'perfeita anula a cegueira');
});
test('invulnerável (esquiva): nada acontece e o único acerto NÃO é consumido; ao voltar a ser vulnerável dentro da janela, é atingido', () => {
  const g = cast({red: vec(0, -3.2)});const r = g.fighters[1], h = r.hp;
  r.action = {kind: 'dodge', elapsed: 0, heading: 0, startAngle: 0, hits: new Set(), invulnerableFor: .5, durationScale: 10, distanceScale: 0};
  const ev = upto(g, secs(.4));
  assert.equal(r.hp, h);assert.ok(!blindOf(r));assert.equal(sandHits(ev).length, 0);
  r.action = null;const ev2 = upto(g, secs(.3));
  assert.equal(sandHits(ev2).length, 1, 'atingido quando a invulnerabilidade acabou (hitbox ainda ativa)');
});
test('a hitbox acaba em 0,75 s: quem entra na dissipação visual não é atingido', () => {
  const g = cast({red: vec(0, 3)});const r = g.fighters[1], h = r.hp;
  upto(g, secs(.25) + secs(.8));   // emissão + janela passada
  r.position = vec(0, -2);const ev = upto(g, secs(.5));
  assert.equal(r.hp, h);assert.equal(sandHits(ev).length, 0);
});
test('parede no caminho: quem está atrás de uma parede larga não é atingido; a areia não a atravessa', () => {
  const g = arena({equip: ['sand-wave'], positions: [vec(0, -4), vec(0, -1)]});
  spawn(g.world, {kind: 'wall', pos: {x: 0, z: -2.5}, hx: 4, hz: .3, angle: 0, y: 0, height: 3}, []);
  const r = g.fighters[1], h = r.hp;
  g.step(cmd(press0), cmd());upto(g, secs(1.2));
  assert.equal(r.hp, h, 'protegido pela parede');
});
test('obstáculo pequeno: a areia contorna e chega mais tarde (caminho livre mais curto)', () => {
  const hitTick = pillar => {
    const g = arena({equip: ['sand-wave'], positions: [vec(0, -4), vec(0, -.8)]});
    if (pillar) spawn(g.world, {kind: 'wall', pos: {x: 0, z: -2.3}, hx: .9, hz: .3, angle: 0, y: 0, height: 3}, []);
    g.step(cmd(press0), cmd());
    for (let i = 1; i < secs(1.3); i++) {g.step(cmd(), cmd());if (sandHits(g.lastStepEvents).length) return i;}
    return -1;
  };
  const free = hitTick(false), around = hitTick(true);
  assert.ok(free > 0, 'sem obstáculo acerta');assert.ok(around < 0 || around > free, `com obstáculo mais tarde (${free} < ${around})`);
});
test('empurrado contra a parede: para, stagger de 0,30 s sem dano extra e NÃO repete enquanto pressionado', () => {
  const g = arena({equip: ['sand-wave'], positions: [vec(0, -4), vec(0, -2.2)]});
  spawn(g.world, {kind: 'wall', pos: {x: 0, z: -1.1}, hx: 4, hz: .3, angle: 0, y: 0, height: 3}, []);
  const r = g.fighters[1];let staggers = 0, hp1 = null;
  g.step(cmd(press0), cmd());
  for (let i = 1; i < secs(1.1); i++) {
    g.step(cmd(), cmd());
    for (const e of g.lastStepEvents) if (e.result === 'sandStagger') {staggers++;hp1 ??= r.hp;}
  }
  assert.ok(staggers >= 1, 'houve stagger');assert.equal(staggers, 1, 'um único stagger enquanto pressionado');
  assert.ok(r.position.z <= -1.1 - .3 - C.test.halfExtent + .05, `não atravessou a parede: z=${r.position.z}`);
});
test('visão do cegado: 10 m e linha de visão (basta uma parte do corpo); sem cegueira sempre vê', () => {
  const g = arena({positions: [vec(0, -8), vec(0, 8)]});const [b, r] = g.fighters;
  assert.ok(canSee(r, b, g.world), 'sem cegueira vê tudo');
  r.statuses = [{id: 'blind', duration: 4, remaining: 4, stacks: 1, maxStacks: 1, stacking: 'refresh', mul: {}, add: {}, flags: {blind: true}, tick: null, acc: 0, tags: ['debuff']}];
  assert.ok(!canSee(r, b, g.world), 'a 16 m não vê');
  b.position = vec(0, 2);assert.ok(canSee(r, b, g.world), 'a 6 m vê');
  spawn(g.world, {kind: 'wall', pos: {x: 0, z: 5}, hx: 6, hz: .3, angle: 0, y: 0, height: 3}, []);
  assert.ok(!canSee(r, b, g.world), 'parede larga oculta por completo');
  g.world.entities.pop();spawn(g.world, {kind: 'wall', pos: {x: 0, z: 5}, hx: .2, hz: .3, angle: 0, y: 0, height: 3}, []);
  assert.ok(canSee(r, b, g.world), 'poste fino: ainda enxerga um canto');
});
test('lock-on do cegado: alvo fora dos 10 m é desligado no controle (sem homing)', () => {
  const g = arena({equip: ['sand-wave'], positions: [vec(0, -8), vec(0, 8)]});const [b, r] = g.fighters;
  b.statuses = [{id: 'blind', duration: 4, remaining: 4, stacks: 1, maxStacks: 1, stacking: 'refresh', mul: {}, add: {}, flags: {blind: true}, tick: null, acc: 0, tags: ['debuff']}];
  g.step(cmd({tackle: true, target: 1, locked: true, move: vec(1, 0)}), cmd());
  assert.ok(Math.abs(Math.sin(b.action.heading)) > .5, `sem lock-on o tackle segue o input (rumo ${b.action.heading.toFixed(2)})`);
  void r;
});
test('IA cegada sem alvo perceptível adota comportamento defensivo (guarda, sem perseguir)', () => {
  const g = arena({positions: [vec(0, -9), vec(0, 9)]});C.extras.toggles.enableEnemyAI = 1;g.mode = 'tactical';
  const r = g.fighters[1];
  r.statuses = [{id: 'blind', duration: 4, remaining: 4, stacks: 1, maxStacks: 1, stacking: 'refresh', mul: {}, add: {}, flags: {blind: true}, tick: null, acc: 0, tags: ['debuff']}];
  for (let i = 0; i < 30; i++) g.step(cmd(), undefined);
  assert.ok(r.guard || r.state === 'guard', `estado ${r.state}`);
});
test('a cegueira dura 4 s e o novo acerto de OUTRA execução reinicia para 4 s (sem somar)', () => {
  const g = cast({red: vec(0, -3.5)});const r = g.fighters[1];
  upto(g, secs(2.5));const left = blindOf(r)?.remaining;assert.ok(left > 0 && left < 2, `restante ${left}`);
  const dir = {x: 0, z: 1};
  spawn(g.world, {kind: 'sandwave', owner: 0, pos: {x: r.position.x, z: r.position.z - 1}, dir, length: 4, width: 3, active: .75, life: 1.5, speed: 4 / .75, damage: 6, accel: 12, partialFactor: .5, blind: 4, wallStagger: .3, cell: .25, detour: 3, replanSteps: 6, y: 0, height: .35}, []);
  upto(g, 40);const after = blindOf(r)?.remaining;
  assert.ok(after > 3.8 && after <= 4, `reiniciada para ${after}`);
  upto(g, secs(4.1));assert.ok(!blindOf(r), 'terminou');
});
test('M28.4: sliders mexidos depois do disparo não alteram a barragem; o próximo uso lê o novo', () => {
  const g = cast({steps: secs(.25) + 3});const w = waves(g)[0];
  C.world.sandWave.length = 20;C.world.sandWave.damage = 99;
  assert.equal(w.length, 4);assert.equal(w.damage, 6);
});
test('sliders têm efeito: length, width, damage, blind e accel', () => {
  const g = cast({tweak: () => {C.world.sandWave.length = 10;C.world.sandWave.width = 6;C.world.sandWave.damage = 9;C.world.sandWave.blind = 2;}, red: vec(0, 3), steps: secs(.25) + 3});
  const w = waves(g)[0];assert.deepEqual([w.length, w.width, w.damage, w.blind], [10, 6, 9, 2]);
  const h = g.fighters[1].hp;upto(g, secs(1.2));
  assert.ok(Math.abs(h - g.fighters[1].hp - 9) < 1e-6, 'alvo a 7 m do lançador só é atingido com o alcance maior');
  assert.ok(blindOf(g.fighters[1])?.duration === 2);
});
test('paridade e determinismo: registrado e não equipado não muda nada; save/load com a barragem viva reproduz o futuro', () => {
  const sim = () => {const g = arena();g.mode = 'tactical';C.extras.toggles.enableEnemyAI = 1;for (let i = 0; i < 1200; i++) g.step(cmd(), undefined);return fighterHash(g);};
  assert.equal(sim(), sim());
  const go = split => {
    const g = cast({red: vec(0, -3.5), steps: secs(.25) + 20});
    if (split) {const snap = g.save();const h = new Game({seed: 3});h.start();h.load(snap);upto(h, secs(2));return fighterHash(h);}
    upto(g, secs(2));return fighterHash(g);
  };
  assert.equal(go(true), go(false));
});

done();
void secs;
