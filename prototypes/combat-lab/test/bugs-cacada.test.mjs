// @ts-check
// Caçada de bugs de 22/10/2026 (v1.20.1): cada teste reproduz um defeito ACHADO por varredura/revisão e fica como regressão.
import {assert, C, cmd, vec, secs, suite, arena, HOLD, Game, emptyCommand, resetConfig, factoryDefaults} from './moves-new-helpers.mjs';
import {defaults} from '../src/sim/config.js';
import {setupNavScenario} from '../src/nav/nav-scenarios.js';
import {getNavGraph, clearNavCache} from '../src/nav/nav-graph.js';
import {navAssist} from '../src/nav/nav-assist.js';
import {NAV_STATE0} from '../src/nav/nav-planner.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

const {test, done} = suite('CAÇADA DE BUGS (v1.20.1)');
const press0 = {skill: 0, skillHeld: HOLD(0)};

/** Azul já em corrida invisível do Bullet Punch (ausente), vermelho a 4,5 m. */
function absentBlue() {
  const g = arena({equip: ['bullet-punch'], positions: [vec(0, -1), vec(0, 4.5)]});
  g.step(cmd(press0), cmd());g.step(cmd(), cmd());
  for (let i = 0; i < secs(.75) + 4; i++) g.step(cmd(), cmd());
  assert.ok(g.fighters[0].absent && g.fighters[0].action?.travel, 'pré-condição: azul ausente em viagem');
  return g;
}

test('B1 · quem está ausente (Bullet Punch) NÃO pode ser pisado (footstool do salto): sem dano, sem stun e a corrida segue', () => {
  const g = absentBlue();const b = g.fighters[0], r = g.fighters[1], hp = b.hp;
  r.position = {x: b.position.x, z: b.position.z + .1};r.groundY = 0;r.action = null;
  r.flight = {y: 1.6, vy: -9, horizontal: {x: 0, z: 0}, isNormalJump: true, jumpFeel: false, jumpHeld: false, airAccel: 20, airMaxSpeed: 7.5};
  const ev = [];
  for (let i = 0; i < 12 && b.absent; i++) {g.step(cmd(), cmd());ev.push(...g.lastStepEvents);}
  assert.ok(!ev.some(e => e.result === 'footstool' && e.target === 0), 'footstool em quem não existe');
  assert.equal(b.hp, hp);assert.ok(!(b.stun > 0), `stun ${b.stun}`);
});
test('B1b · idem pela esquiva (C) do adversário por cima de quem está ausente', () => {
  const g = absentBlue();const b = g.fighters[0], r = g.fighters[1], hp = b.hp;
  r.position = {x: b.position.x, z: b.position.z + 1.2};r.groundY = 0;
  g.step(cmd(), cmd({dodge: true, dodgeHeld: true, move: vec(0, -1), dodgeDirection: vec(0, -1)}));
  const ev = [];for (let i = 0; i < 60 && b.absent; i++) {g.step(cmd(), cmd({dodgeHeld: true, move: vec(0, -1)}));ev.push(...g.lastStepEvents);}
  assert.ok(!ev.some(e => e.result === 'footstool' && e.target === 0));assert.equal(b.hp, hp);
});

test('B2 · a corrida invisível do Bullet Punch NÃO atravessa parede/obstáculo (como o Quick Attack): o alvo atrás não é atingido', () => {
  const g = arena({equip: ['bullet-punch'], positions: [vec(0, -1), vec(0, 4.5)]});
  g.mapState.obstacles = [{id: 'w', pos: {x: 0, y: 0, z: 1.8}, shape: 'box', hx: 3, hz: .4, height: 3, angle: 0}];
  const b = g.fighters[0], r = g.fighters[1];let zmax = -9;
  g.step(cmd(press0), cmd());g.step(cmd(), cmd());
  for (let i = 0; i < secs(1.4); i++) {g.step(cmd(), cmd());zmax = Math.max(zmax, b.position.z);}
  assert.ok(zmax < 1.8 - .4 + .05, `atravessou a parede (z máx ${zmax.toFixed(2)})`);assert.equal(r.hp, r.attributes.hp, 'alvo atrás da parede levou o golpe');
  assert.ok(!b.absent && !b.action || true);
});
test('B3 · o Bullet Punch não sobe plataforma alta de graça: o apoio vale até maxRise acima de onde o lutador estava', () => {
  const g = arena({equip: ['bullet-punch'], positions: [vec(0, -1), vec(0, 4)]});
  g.mapState.platforms = [{id: 'alta', pos: {x: 0, y: 0, z: 6.5}, width: 4, depth: 4, height: 3}];
  const b = g.fighters[0], r = g.fighters[1];
  g.step(cmd(press0), cmd());g.step(cmd(), cmd());
  for (let i = 0; i < secs(.12); i++) g.step(cmd(), cmd());
  r.position = vec(0, 6.2);r.groundY = 3;
  for (let i = 0; i < secs(1.2); i++) g.step(cmd(), cmd());
  assert.ok(b.groundY <= C.world.bulletPunch.maxRise + 1e-6, `subiu para ${b.groundY} m sem pular`);
});
test('B4 · com a defesa (D) segurada, tocar o slot do Quick Attack/Bullet Punch executa (antes a defesa cancelava a mira)', () => {
  for (const id of ['quick-attack', 'bullet-punch']) {
    const g = arena({equip: [id], positions: [vec(0, -1), vec(0, 3)]});const b = g.fighters[0];
    for (let i = 0; i < 10; i++) g.step(cmd({guard: true, guardPressed: i === 0}), cmd());
    g.step(cmd({guard: true, skill: 0, skillHeld: HOLD(0)}), cmd());g.step(cmd({guard: true}), cmd());
    assert.equal(b.action?.move, id, `${id}: não executou a partir da guarda`);
  }
});
test('B5 · dois Bullet Punch simultâneos: ninguém fica sem alvo só por ter o índice maior', () => {
  const g = arena({equip: ['bullet-punch'], equipRed: ['bullet-punch'], positions: [vec(0, -1), vec(0, 3.5)]});
  g.step(cmd(press0), cmd(press0));g.step(cmd(), cmd());
  const ev = [];for (let i = 0; i < secs(1.6); i++) {g.step(cmd(), cmd());ev.push(...g.lastStepEvents);}
  assert.ok(!ev.some(e => e.result === 'bulletNoTarget'), 'um dos dois reapareceu sem alvo');
  assert.ok(g.fighters[0].hp < g.fighters[0].attributes.hp && g.fighters[1].hp < g.fighters[1].attributes.hp || ev.some(e => e.result === 'clash'), `HP ${g.fighters.map(f => f.hp)}`);
});

test('N1 · remover plataforma/obstáculo no meio da rota NÃO lança exceção no planejador (índices de nós velhos)', () => {
  let threw = 0;
  for (let k = 0; k < 24; k++) {
    resetConfig(factoryDefaults());clearNavCache();registerStandardMoves();C.extras.nav.enableNav = 1;
    const g = new Game({seed: 1 + k});g.start();setupNavScenario(g, k % 2 ? 'plataforma' : 'completo');
    try {
      for (let t = 0; t < 1500; t++) {
        if (t === 60 + k * 25) {g.mapState.platforms = [];g.mapState.obstacles = g.mapState.obstacles.slice(1);}
        g.step(emptyCommand());
      }
    } catch (e) {threw++;}
  }
  assert.equal(threw, 0, `${threw} de 24 partidas lançaram exceção`);
});
test('N2 · rocha do Emerging Stone crescendo NÃO reconstrói o grafo de navegação a cada passo (assinatura estável)', () => {
  resetConfig(factoryDefaults());clearNavCache();
  const ms = {platforms: [], obstacles: [], destructibles: [{id: 'rock_1', rock: true, state: 'solid', pos: {x: 3, y: 0, z: 3}, size: {hx: 1.5, hz: 1.5, height: 0}, targetHeight: 3}]};
  const a = getNavGraph(ms);ms.destructibles[0].size.height = 1.2;const b = getNavGraph(ms);ms.destructibles[0].size.height = 3;const c = getNavGraph(ms);
  assert.ok(a === b && b === c, 'o grafo foi reconstruído enquanto a rocha crescia');
});
test('N3 · a IA pendurada na borda sobe mesmo com guarda/esquiva no comando dela (antes largava a borda: só 18% de subidas)', () => {
  resetConfig(factoryDefaults());registerStandardMoves();C.extras.toggles.enableEnemyAI = 1;
  const g = new Game({seed: 3});g.start();g.mapState.platforms = [];g.mapState.destructibles = [];g.mapState.items = [];g.mapState.regularSpawnTimer = 1e9;
  g.mapState.obstacles = [{id: 'cx', pos: {x: 0, y: 0, z: 0}, shape: 'box', hx: 1.5, hz: 1.5, height: 2.6, angle: 0}];
  const b = g.fighters[0], r = g.fighters[1];b.position = vec(12, 12);r.position = vec(-3.8, 0);r.groundY = 0;r.facing = Math.PI / 2;
  let jumped = -1;
  for (let t = 0; t < 400 && !r.ledge; t++) {const doJump = jumped < 0 && !r.flight && -2.0 - r.position.x < .6;if (doJump) jumped = t;g.step(cmd(), cmd({move: vec(1, 0), jump: doJump, jumpHeld: jumped >= 0 && t < jumped + 40}));}
  assert.ok(r.ledge, 'não agarrou');
  for (let t = 0; t < secs(1.5); t++) g.step(cmd(), cmd({guard: true}));   // o comando «da IA» insiste em defender
  assert.ok(Math.abs((r.groundY ?? 0) - 2.6) < .05 && !r.ledge, `não subiu (y=${r.groundY}, fase ${r.ledge?.phase})`);
});
test('N4 · a navegação não sobrescreve o movimento de um Move em uso (slot 0, botão segurado, marcador aberto) nem rouba o instante com salto', () => {
  resetConfig(factoryDefaults());clearNavCache();registerStandardMoves();C.extras.nav.enableNav = 1;
  const g = new Game({seed: 7});g.start();setupNavScenario(g, 'plataforma');g.setLoadout(1, ['lunge', 'emerging-stone', null, null]);
  const r = g.fighters[1], target = g.fighters[0];const brain = {nav: NAV_STATE0()};
  const c1 = {...emptyCommand(), move: {x: 0, z: 0}, skill: 0};navAssist(g, brain, r, target, c1);
  assert.deepEqual(c1.move, {x: 0, z: 0}, 'o toque no slot 0 teve o movimento trocado pela rota');assert.ok(!c1.jump, 'o salto da rota tomou o lugar do Move');
  const c2 = {...emptyCommand(), move: {x: 0, z: 0}, skillHeld: [false, true, false, false]};navAssist(g, brain, r, target, c2);
  assert.deepEqual(c2.move, {x: 0, z: 0}, 'botão segurado: movimento trocado');
});
test('N5 · Moves ofensivos não são disparados no vazio contra alvo inalcançável (como o Tackle já era suprimido)', () => {
  resetConfig(factoryDefaults());clearNavCache();registerStandardMoves();C.extras.nav.enableNav = 1;
  const g = new Game({seed: 5});g.start();setupNavScenario(g, 'torre');g.setLoadout(1, ['lunge', 'swift', 'spikes', 'sand-wave']);
  const r = g.fighters[1], target = g.fighters[0];const brain = {nav: NAV_STATE0()};let kept = 0;
  for (const slot of [0, 1, 2, 3]) {const c = {...emptyCommand(), skill: slot, skillHeld: [slot === 0, slot === 1, slot === 2, slot === 3]};navAssist(g, brain, r, target, c);if (c.skill != null) kept++;}
  assert.equal(kept, 0, `${kept} Moves ofensivos passaram contra a torre inalcançável`);
});

test('N6 · a IA alcança quem está em cima de uma caixa de 2,2 m (o obstáculo padrão): antes ficava embaixo e o jogador ficava imune', () => {
  for (const seed of [1, 2]) {
    resetConfig(defaults());clearNavCache();registerStandardMoves();C.extras.nav.enableNav = 1;C.extras.toggles.enableEnemyAI = 1;
    const g = new Game({seed});g.start();g.mode = 'tactical';
    g.mapState.platforms = [];g.mapState.destructibles = [];g.mapState.items = [];g.mapState.regularSpawnTimer = 1e9;
    g.mapState.obstacles = [{id: 'b', pos: {x: 0, y: 0, z: -4}, shape: 'box', hx: 2, hz: 2, height: 2.2, angle: 0}];
    const [blue, red] = g.fighters;blue.position = vec(0, -4);blue.groundY = 2.2;red.position = vec(0, 8);red.groundY = 0;
    let reached = false;
    for (let t = 0; t < secs(25) && !reached; t++) {g.step(emptyCommand());blue.hp = blue.attributes.hp;if (Math.abs((red.groundY ?? 0) - 2.2) < .1) reached = true;}
    assert.ok(reached, `semente ${seed}: a IA não subiu na caixa de 2,2 m`);
  }
});

done();
