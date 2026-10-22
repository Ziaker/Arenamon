// Fase 2 do overhaul de colisões — contatos simultâneos (sólido + adversário, vários sólidos) em partidas reais do motor.
// Origem: reprodução da Fase 0 sobre 4634ca2: lutador encostado numa parede/obstáculo e empurrado por um adversário ficava
// penetrando o sólido em 465 de 480 ticks (a separação entre lutadores corrigia a posição DEPOIS dos sólidos e ninguém reavaliava).
// Contrato: ao fim de cada tick, sólidos estáticos são restrições duras (penetração ≤ 1e-6 m); a sobreposição entre lutadores
// é a parte "mole" e é absorvida pelo lutador que NÃO está preso.
// Uso: node prototypes/combat-lab/test/collision-multi.test.mjs
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {spawn} from '../src/sim/world.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {physicsProbe} from '../src/sim/physics.js';

registerStandardMoves();
resetConfig(defaults());
const r = C.test.halfExtent;
let tests = 0;const failures = [];
const check = (name, fn) => {try {resetConfig(defaults());fn();tests++;console.log('✓', name);} catch (error) {failures.push(name);console.log('✗', name, '—', String(error.message).split(/\r?\n/)[0]);}};

/** Partida sem objetos do mapa, com A encostado na face (z = FACE) de um sólido e B vindo por trás. */
const FACE = 1.5;
function squeeze(kind) {
  const g = new Game();g.reset({positions: [vec(0, FACE - r), vec(0, FACE - r - 1.2)]});g.mode = 'inactive';
  Object.assign(g.mapState, {platforms: [], destructibles: [], items: [], obstacles: []});
  if (kind === 'mapa') g.mapState.obstacles = [{shape: 'box', pos: {x: 0, y: 0, z: FACE + 1}, hx: 4, hz: 1, height: 3}];
  else spawn(g.world, {kind: 'wall', pos: vec(0, FACE + .3), hx: 4, hz: .3, y: 0, height: 3, blocksFighters: true}, []);
  return g;
}
function pushAgainst(g, ticks, bCommand) {
  const [A, B] = g.fighters;let maxPen = 0, maxOverlap = 0;physicsProbe.staticConflictsTotal = 0;
  for (let t = 0; t < ticks; t++) {
    g.step(emptyCommand(), bCommand(t));
    maxPen = Math.max(maxPen, A.position.z + r - FACE);
    maxOverlap = Math.max(maxOverlap, 2 * r - Math.hypot(B.position.x - A.position.x, B.position.z - A.position.z));
  }
  assert.equal(physicsProbe.staticConflictsTotal, 0, 'cenário normal não pode registrar conflito de espaço');
  return {maxPen, maxOverlap, A, B};
}

for (const kind of ['mapa', 'wall-de-Move']) {
  check(`${kind}: adversário caminhando contra quem está encostado no sólido não o faz penetrar (4 s)`, () => {
    const {maxPen, maxOverlap} = pushAgainst(squeeze(kind), 480, () => ({...emptyCommand(), move: vec(0, 1)}));
    assert.ok(maxPen <= 1e-6, `penetração no sólido ao fim do tick chegou a ${maxPen.toFixed(5)} m`);
    assert.ok(maxOverlap <= 1e-3, `sobreposição residual entre lutadores ${maxOverlap.toFixed(5)} m`);
  });
  check(`${kind}: posição de quem está preso é estável (sem jitter) enquanto o adversário empurra`, () => {
    const g = squeeze(kind), A = g.fighters[0], zs = [];
    for (let t = 0; t < 240; t++) {g.step(emptyCommand(), {...emptyCommand(), move: vec(0, 1)});if (t > 60) zs.push(A.position.z);}
    const spread = Math.max(...zs) - Math.min(...zs);
    assert.ok(spread <= 1e-6, `A oscilou ${spread.toExponential(2)} m`);
  });
}
check('mapa: tackle do adversário contra quem está encostado no obstáculo não faz penetrar', () => {
  const g = squeeze('mapa'), B = g.fighters[1];
  const {maxPen} = pushAgainst(g, 150, t => ({...emptyCommand(), move: vec(0, 1), tackle: t === 3}));
  assert.ok(B.hp > 0);
  assert.ok(maxPen <= 1e-6, `penetração no obstáculo chegou a ${maxPen.toFixed(5)} m`);
});
check('determinismo: a mesma sequência de comandos repete exatamente as posições', () => {
  const run = () => {const g = squeeze('mapa');pushAgainst(g, 200, () => ({...emptyCommand(), move: vec(0, 1)}));return JSON.stringify(g.fighters.map(f => f.position));};
  assert.equal(run(), run());
});


// ---------- Vários sólidos: corredores, quinas e bolsões (guardas de regressão: já passavam no 4634ca2) ----------
import {closestOnShape} from '../src/sim/world.js';
/** Maior penetração do corpo (disco r) em qualquer parede de Move. */
const penetration = (g, f) => Math.max(0, ...g.world.entities.filter(e => e.kind === 'wall').map(e => r - closestOnShape(e, f.position).distance));
function arena(specs) {
  const g = new Game();g.reset({positions: [vec(0, -6), vec(40, 40)]});g.mode = 'inactive';
  Object.assign(g.mapState, {platforms: [], destructibles: [], items: [], obstacles: []});
  for (const s of specs) spawn(g.world, {kind: 'wall', y: 0, height: 2.2, blocksFighters: true, ...s}, []);
  return g;
}
function walkInto(g, move, ticks) {
  const A = g.fighters[0];let maxPen = 0;
  for (let t = 0; t < ticks; t++) {g.step({...emptyCommand(), move}, emptyCommand());maxPen = Math.max(maxPen, penetration(g, A));}
  return {A, maxPen};
}
for (const gap of [1.4, 0.8]) {
  check(`corredor de ${gap} m (corpo ${2 * r} m): entrar andando nunca penetra nem atravessa as paredes`, () => {
    const specs = [{pos: vec(-(gap / 2 + .15), 0), hx: .15, hz: 4}, {pos: vec(gap / 2 + .15, 0), hx: .15, hz: 4}];
    const {A, maxPen} = walkInto(arena(specs), vec(0, 1), 360);
    assert.ok(maxPen <= 1e-6, `penetração ${maxPen.toFixed(5)} m`);
    assert.ok(Math.abs(A.position.x) <= gap / 2 + .15 + 1e-6, `saiu pelo lado: x=${A.position.x.toFixed(3)}`);
    if (gap < 2 * r) assert.ok(A.position.z < -4 + 1e-6, `não deveria entrar num vão estreito demais: z=${A.position.z.toFixed(3)}`);
    else assert.ok(A.position.z > 4, 'deveria atravessar o corredor');
  });
}
check('bolsão em V (40°): andar para o fundo para no ponto em que o corpo deixa de caber, sem penetrar; ordem das paredes é irrelevante', () => {
  const half = 20 * Math.PI / 180, mk = ang => ({pos: vec(Math.sin(ang) * 3, 8 + Math.cos(ang) * 3 - 3), angle: ang, hx: .15, hz: 3});
  const finals = [false, true].map(reversed => {
    const specs = [mk(half), mk(-half)];if (reversed) specs.reverse();
    const g = arena(specs);g.fighters[0].position = vec(0, 14);   // fora do bolsão, abertura voltada para +z
    const A = g.fighters[0];let maxPen = 0;
    for (let t = 0; t < 360; t++) {g.step({...emptyCommand(), move: vec(0, -1)}, emptyCommand());maxPen = Math.max(maxPen, penetration(g, A));}
    assert.ok(maxPen <= 1e-6, `penetração ${maxPen.toFixed(5)} m (ordem ${reversed ? 'B,A' : 'A,B'})`);
    return A.position;
  });
  assert.ok(Math.abs(finals[0].x - finals[1].x) < 1e-9 && Math.abs(finals[0].z - finals[1].z) < 1e-9, `depende da ordem: ${JSON.stringify(finals)}`);
  assert.ok(Math.abs(finals[0].x) < 1e-6, 'tem de ficar no eixo de simetria');
});
check('dois lutadores contra o mesmo obstáculo: nenhum penetra ao fim de cada tick', () => {
  const g = new Game();g.reset({positions: [vec(-.6, 0), vec(.6, 0)]});g.mode = 'inactive';
  Object.assign(g.mapState, {platforms: [], destructibles: [], items: [], obstacles: [{shape: 'box', pos: {x: 0, y: 0, z: 2.5}, hx: 3, hz: 1, height: 3}]});
  let worst = 0;
  for (let t = 0; t < 360; t++) {
    g.step({...emptyCommand(), move: vec(.3, 1)}, {...emptyCommand(), move: vec(-.3, 1)});
    for (const f of g.fighters) worst = Math.max(worst, f.position.z + r - 1.5);
  }
  assert.ok(worst <= 1e-6, `penetração ${worst.toFixed(5)} m`);
});

check('vão menor que o corpo com o lutador já dentro: sem teletransporte, sem NaN, determinístico e o conflito é registrado', () => {
  const run = () => {
    const g = arena([{pos: vec(-.55, 0), hx: .15, hz: 4}, {pos: vec(.55, 0), hx: .15, hz: 4}]);   // vão de 0,8 m
    g.fighters[0].position = vec(.05, 0);
    physicsProbe.staticConflicts = 0;
    const start = {...g.fighters[0].position};
    for (let t = 0; t < 60; t++) g.step(emptyCommand(), emptyCommand());
    const p = g.fighters[0].position;
    return {x: p.x, z: p.z, moved: Math.hypot(p.x - start.x, p.z - start.z), conflicts: physicsProbe.staticConflicts};
  };
  const a = run(), b = run();
  assert.ok(Number.isFinite(a.x) && Number.isFinite(a.z));
  assert.ok(a.moved < .5, `deslocou ${a.moved.toFixed(3)} m (teletransporte)`);
  assert.ok(a.conflicts > 0, 'o conflito deveria ser contado em physicsProbe.staticConflicts');
  assert.deepEqual(a, b);
});

console.log(`Contatos simultâneos: ${tests} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) process.exit(1);
