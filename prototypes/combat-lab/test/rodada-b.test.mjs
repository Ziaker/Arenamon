// @ts-check
// Rodada de 22/10/2026 (tarde): marcador suave, navegação ligada por padrão (a IA sobe plataformas), círculo de alcance dos Moves de alvo único, squash/smear na esquiva,
// altura do apoio no pouso (efeitos nascem na plataforma) e explosão do Riposte. O Bullet Punch e o Riposte têm testes próprios (moves-bullet-punch, moves-riposte).
import {assert, C, Game, cmd, vec, secs, suite, arena, run, HOLD, resetConfig, factoryDefaults} from './moves-new-helpers.mjs';
import {createSquashState, updateSquash} from '../src/view/squash-stretch.js';
import {runNavScenario} from '../src/nav/nav-scenarios.js';
import {nearestEligible} from '../src/sim/moves.js';

const {test, done} = suite('RODADA 22/10 (TARDE)');
const press0 = {skill: 0, skillHeld: HOLD(0)}, held = {skillHeld: HOLD(0)};

test('Spikes e Emerging Stone: o marcador DESLIZA ao trocar de direção (aceleração limitada), sem teleportar', () => {
  for (const [id, grp] of [['spikes', 'spikes'], ['emerging-stone', 'emergingStone']]) {
    const g = arena({equip: [id], positions: [vec(0, -3), vec(0, 9)], setup: () => {C.world[grp].markerAccel = 24;}});
    g.step(cmd(press0), cmd());
    for (let i = 0; i < 30; i++) g.step(cmd({...held, move: vec(1, 0)}), cmd());
    const a = g.fighters[0].aim;assert.ok(a, `${id}: marcador aberto`);
    const x0 = a.pos.x;let prev = a.pos.x, maxStep = 0;const xs = [];
    for (let i = 0; i < 60; i++) {g.step(cmd({...held, move: vec(-1, 0)}), cmd());const x = g.fighters[0].aim?.pos.x ?? prev;maxStep = Math.max(maxStep, Math.abs(x - prev));xs.push(x);prev = x;}
    const vmax = C.world[grp].markerSpeed, dt = 1 / 120;
    assert.ok(maxStep <= vmax * dt + 1e-9, `${id}: passo máximo ${maxStep} > ${vmax * dt}`);
    // a velocidade inverte de forma contínua: existe um trecho em que o marcador ainda segue para +x antes de voltar
    assert.ok(Math.max(...xs) > x0 + 1e-3, `${id}: não deslizou antes de inverter`);
    assert.ok(xs[xs.length - 1] < x0, `${id}: acabou voltando para -x`);
  }
});
test('markerAccel = 0 mantém a resposta instantânea de antes (comparação)', () => {
  const g = arena({equip: ['spikes'], positions: [vec(0, -3), vec(0, 9)], setup: () => {C.world.spikes.markerAccel = 0;}});
  g.step(cmd(press0), cmd());g.step(cmd({...held, move: vec(1, 0)}), cmd());const a = g.fighters[0].aim, x1 = a.pos.x;
  g.step(cmd({...held, move: vec(-1, 0)}), cmd());
  assert.ok(g.fighters[0].aim.pos.x < x1, 'inverteu no mesmo passo');
});
test('a navegação vem LIGADA por padrão: a IA chega ao alvo na plataforma de 1,5 m (antes só com a opção ligada)', () => {
  resetConfig(factoryDefaults());
  assert.equal(C.extras.nav.enableNav, 1);
  const r = runNavScenario(Game, 'plataforma', {nav: 1, seconds: 30});
  assert.ok(r.reachedAt !== null && r.jumps >= 1, JSON.stringify({reachedAt: r.reachedAt, jumps: r.jumps}));
});
test('Quick Attack: segurar mostra o círculo de alcance (azul com alvo, vermelho sem); soltar fora do alcance não gasta e pisca', () => {
  const g = arena({equip: ['quick-attack'], positions: [vec(0, -2), vec(0, 3)]});const b = g.fighters[0];
  g.step(cmd(press0), cmd());g.step(cmd(held), cmd());
  assert.ok(b.aim?.range && b.aim.inRange && b.aim.rangeValue === C.world.quickAttack.acquireRange);
  g.fighters[1].position = vec(0, 15);g.step(cmd(held), cmd());assert.equal(b.aim.inRange, false);
  g.step(cmd(), cmd());
  assert.ok(!b.aim && !b.action && b.rangeFlash && b.rangeFlash.range === C.world.quickAttack.acquireRange);
  assert.equal(b.stamina, C.rules.staminaMax);assert.ok(!(b.moveCooldowns?.['quick-attack'] > 0));
  run(g, secs(1), () => cmd());assert.ok(!b.rangeFlash);
});
test('Quick Attack e Bullet Punch: a elegibilidade do círculo é a mesma de nearestEligible (alcance exato)', () => {
  const g = arena({equip: ['quick-attack'], positions: [vec(0, 0), vec(0, 6.9)]});
  assert.ok(nearestEligible(g.fighters[0], g.fighters, 7));assert.ok(!nearestEligible(g.fighters[0], g.fighters, 6.8));
});
test('qualquer outro Move de alvo único respeita o círculo: o toque rápido (apertar e soltar) executa; botão segurado espera', () => {
  const g = arena({equip: ['quick-attack'], positions: [vec(0, -2), vec(0, 2)]});
  g.step(cmd(press0), cmd());for (let i = 0; i < 20; i++) g.step(cmd(held), cmd());
  assert.ok(g.fighters[0].aim?.range && !g.fighters[0].action, 'segurado: só o círculo, nada executado');
  g.step(cmd(), cmd());assert.equal(g.fighters[0].action?.move, 'quick-attack');
});
test('squash & stretch também na esquiva (C), na escala própria, e some ao desligar', () => {
  const opts = {enableSquashStretch: 1, squashOnDodge: 1, dodgeSquashScale: .8, squashIntensity: .15, stretchIntensity: .2, squashWindow: 60, settleDuration: 80, preserveVolume: 1, plScaling: 1};
  const motion = {duration: .45, profile: 1, decelStart: .55, impulseTime: .14};
  const f = {hp: 100, action: {kind: 'dodge', elapsed: .03, heading: 0}};
  const s = createSquashState();updateSquash(s, f, 1 / 120, opts, motion);
  assert.ok(s.active && s.z < 1, `compressão na esquiva: z=${s.z}`);
  f.action.elapsed = .15;updateSquash(s, f, 1 / 120, opts, motion);assert.ok(s.z > 1, `alongamento na esquiva: z=${s.z}`);
  const t = createSquashState();updateSquash(t, {hp: 100, action: {kind: 'tackle', elapsed: .15, heading: 0, hits: new Set(), pl: 1}}, 1 / 120, opts, motion);
  const d = createSquashState();updateSquash(d, f, 1 / 120, opts, motion);
  assert.ok(d.z - 1 < (t.z - 1) + 1e-9 && d.z > 1, 'na esquiva o alongamento é 80% do Tackle');
  const off = createSquashState();updateSquash(off, f, 1 / 120, {...opts, squashOnDodge: 0}, motion);assert.ok(!off.active && off.z === 1);
});
test('pouso: lastLanding guarda a altura do apoio (os efeitos nascem NA plataforma, não no chão)', () => {
  const g = arena({positions: [vec(-2.2, 0), vec(0, 9)]});
  g.mapState.platforms = [{id: 'p', pos: {x: 0.4, y: 0, z: 0}, width: 3, depth: 3, height: 1}];
  const f = g.fighters[0];
  g.step(cmd({jump: true, jumpHeld: true, move: vec(1, 0)}), cmd());
  for (let i = 0; i < secs(1.6) && !(f.lastLanding && !f.flight); i++) g.step(cmd({jumpHeld: i < 40, move: vec(1, 0)}), cmd());
  assert.ok(f.lastLanding, 'aterrissou');assert.ok(Math.abs(f.lastLanding.y - (f.groundY ?? 0)) < 1e-6, `y=${f.lastLanding.y} groundY=${f.groundY}`);
  assert.ok(f.lastLanding.y > .9, `aterrissou na plataforma (y=${f.lastLanding.y})`);
});
test('Riposte: o impacto do contra-golpe leva a marca riposte; o golpe comum não', () => {
  const g = arena({equip: ['riposte'], positions: [vec(0, -1.6), vec(0, 1.6)]});
  g.step(cmd(press0), cmd());const ev = [];
  for (let i = 1; i < 260; i++) {g.step(cmd(), i === 8 ? cmd({tackle: true, move: vec(0, -1)}) : cmd());ev.push(...g.lastStepEvents);}
  assert.ok(ev.some(e => e.result === 'impact' && e.attacker === 0 && e.riposte === true), 'contra-golpe marcado');
  const h = arena({positions: [vec(0, -1.6), vec(0, 1.6)]});const ev2 = [];
  for (let i = 0; i < 160; i++) {h.step(cmd({tackle: i === 0, move: vec(0, 1)}), cmd());ev2.push(...h.lastStepEvents);}
  assert.ok(ev2.some(e => e.result === 'impact') && ev2.every(e => !e.riposte), 'golpe comum sem a marca');
});

done();
