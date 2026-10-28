// F4 (Task 9): GATE GEOMÉTRICO da fase de colisões/mapa. Cenários determinísticos que provam: nenhuma interseção silenciosa, nenhuma penetração
// acima da tolerância, nenhum pouso falso, nenhum tunelamento e nenhum spawn inválido. Instrumentos (já entregues na F4): physicsProbe
// (staticResidualMax/pinEscapes), staticPenetration (collision-probe.js), spawnLog/isValidSpawnPosition (map-spawn.js).
// Cada cenário imprime UMA linha no stdout com as métricas de penetração: «[gate] nome: residual máx X m · pinEscape N · penetração máx Y m».
// Pouso = incremento de `f.lastLanding.n` (physics.js land()); pouso falso = incremento sem voo no início do passo, vindo de baixo ou fora do apoio real.
// Também cobre o carry-over da revisão da Task 8: resíduo ≤ tolerância não escapa; fallback da arena inteira explícito no evento; busca sem escape
// não se repete a cada subpasso do mesmo passo.
// Uso: node --test prototypes/combat-lab/test/f4-geometry-gate.test.mjs
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {spawn, applyCounterStagger} from '../src/sim/world.js';
import {physicsProbe, getGroundHeight} from '../src/sim/physics.js';
import {pushAway} from '../src/sim/combat.js';
import {staticPenetration} from '../src/sim/collision-probe.js';
import {sweepRoundedBox} from '../src/sim/ccd.js';
import {effectiveArenaRadius} from '../src/sim/map.js';
import {isValidSpawnPosition} from '../src/sim/map/map-spawn.js';
import {validateCombatEvent} from '../src/sim/events/combat-event.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
const TOL = () => C.test.penetrationTolerance ?? .02;
const cmd = (o = {}) => ({...emptyCommand(), ...o});
/** Partida parada com mapa vazio (+ o que for dado); lutadores nas posições dadas. */
function lab(p0, p1, map = {}, cfg = () => {}) {
  resetConfig(defaults());cfg();
  const g = new Game();g.reset({positions: [p0, p1]});g.mode = 'inactive';
  Object.assign(g.mapState, {platforms: [], destructibles: [], items: [], obstacles: [], ...map});
  return g;
}
/** Métricas de penetração acumuladas por cenário; `report` imprime a linha única do stdout. */
const meter = () => ({residual: 0, escapes: 0, pen: 0});
function measure(m, g) {
  m.residual = Math.max(m.residual, physicsProbe.staticResidualMax);m.escapes += physicsProbe.pinEscapes;
  for (const f of g.fighters) m.pen = Math.max(m.pen, staticPenetration(f, g.world));
}
const report = (name, m) => console.log(`[gate] ${name}: residual máx ${m.residual.toFixed(4)} m · pinEscape ${m.escapes} · penetração máx ${m.pen.toFixed(4)} m`);
/** Um passo com vigia de pouso: todo incremento de lastLanding.n tem de vir de um voo real, de cima, sobre o apoio real naquele ponto. */
function stepWatch(g, c0, c1, m) {
  const before = g.fighters.map(f => ({n: f.lastLanding?.n ?? 0, flight: f.flight ? {y: f.flight.y} : null}));
  g.step(c0, c1);measure(m, g);
  const landed = [];
  g.fighters.forEach((f, i) => {
    const b = before[i], L = f.lastLanding;
    if ((L?.n ?? 0) === b.n) return;
    assert.ok(b.flight, `lutador ${i} pousou sem estar em voo (tick ${g.tick})`);
    assert.ok(b.flight.y >= L.y - 1e-3, `lutador ${i} pousou vindo de baixo (y0 ${b.flight.y} < apoio ${L.y})`);
    const ground = getGroundHeight({x: L.x, z: L.z}, g, L.y);
    assert.ok(Math.abs(ground - L.y) < 1e-9, `lutador ${i} pousou em y ${L.y} sem apoio real ali (apoio ${ground})`);
    landed.push(i);
  });
  return landed;
}

// ------------------------------------------------------------------------------------------------ projéteis
/** Projétil a 120 m/s em linha reta com deslocamento lateral `off` do centro do alvo (lutador 1); devolve se acertou e se a geometria diz que deveria. */
function shot({target = vec(0, 0), ang, off, r, y = .65}) {
  const g = lab(vec(-20, -20), target), m = meter();
  const d = vec(Math.cos(ang), Math.sin(ang)), n = vec(-d.z, d.x);
  const start = vec(target.x - d.x * 8 + n.x * off, target.z - d.z * 8 + n.z * off);
  const p = spawn(g.world, {kind: 'projectile', owner: 0, pos: start, angle: Math.atan2(d.x, d.z), radius: r, speed: 120, y, life: 1, hit: {damage: 5}}, []);
  const geo = sweepRoundedBox({pos: target, hx: C.test.halfExtent, hz: C.test.halfExtent, angle: 0}, start, vec(start.x + d.x * 16, start.z + d.z * 16), r);
  let hits = 0;
  for (let t = 0; t < 30 && !p.dead; t++) {stepWatch(g, cmd(), cmd(), m);hits += g.lastStepEvents.filter(e => e.entity === p.id && e.target === 1).length;}
  return {hits, expected: !!geo, m};
}
/** Deslocamentos laterais: varredura uniforme + faixa densa raspando a quina (corda curta dentro do corpo inflado, o caso que o subpasso pula). */
const offsets = r => {
  const edge = C.test.halfExtent * Math.SQRT2 + r, out = [];
  for (let k = -40; k <= 40; k++) out.push(k / 40 * (edge + .01));
  for (let j = 1; j <= 30; j++) out.push(edge - j * .004, -(edge - j * .004));
  return out;
};
test('projétil a 120 m/s contra lutador parado no caminho: SEMPRE acerta (offsets laterais, ângulos, raios, posições; inclusive raspando a quina)', () => {
  const m = meter();let cases = 0, misses = [];
  for (const target of [vec(0, 0), vec(7.3, -4.1)]) for (const r of [.25, .05]) for (const ang of [0, .2, Math.PI / 4, .9, 1.3]) for (const off of offsets(r)) {
    const s = shot({target, ang, off, r});
    for (const key of Object.keys(m)) m[key] = key === 'escapes' ? m[key] + s.m[key] : Math.max(m[key], s.m[key]);
    if (!s.expected) continue;
    cases++;assert.ok(s.hits <= 1, `acertou ${s.hits} vezes`);if (s.hits === 0) misses.push({x: target.x, r, ang: +ang.toFixed(2), off: +off.toFixed(4)});
  }
  report('projétil 120 m/s × lutador parado', m);
  assert.deepEqual(misses, [], `${misses.length} de ${cases} trajetórias que cruzam o corpo passaram sem acertar`);
  assert.ok(cases > 600, `só ${cases} casos com contato geométrico`);
});
test('pierce 2 com dois alvos alcançados no MESMO passo (lado a lado no caminho): os dois tomam exatamente um acerto e o projétil morre', () => {
  // A 120 m/s o projétil anda 1 m por passo; dois corpos em fila sempre ficam a mais de 1 m de distância de acerto. Lado a lado (vão de 0,1 m)
  // com raio 0,6 m, os dois são tocados no mesmo subpasso: o pierce tem de contar os dois e matar o projétil.
  const g = lab(vec(-.55, 0), vec(.55, 0)), m = meter();
  const p = spawn(g.world, {kind: 'projectile', owner: null, pos: vec(0, -3), angle: 0, radius: .6, speed: 120, y: .65, life: 1, pierce: 2, hit: {damage: 5}}, []);
  const hitsBy = {0: [], 1: []};
  for (let t = 0; t < 10 && !p.dead; t++) {stepWatch(g, cmd(), cmd(), m);for (const e of g.lastStepEvents) if (e.entity === p.id && (e.target === 0 || e.target === 1)) hitsBy[e.target].push(g.tick);}
  report('pierce 2 × dois alvos no mesmo passo', m);
  assert.equal(hitsBy[0].length, 1, `alvo 0: ${hitsBy[0].length} acertos`);assert.equal(hitsBy[1].length, 1, `alvo 1: ${hitsBy[1].length} acertos`);
  assert.equal(hitsBy[0][0], hitsBy[1][0], 'os dois acertos deveriam sair no mesmo passo');
  assert.ok(p.dead, 'pierce 2 esgotado: o projétil tem de morrer');
  assert.equal(p.hitLog.length, 2);
});
/** Ricochete radial na borda: sai do centro rumo à borda, quica no máximo `maxBounces` vezes e morre no contato seguinte, sem passar da borda. */
function ricochet(name, cfg = () => {}) {
  const g = lab(vec(-3, 20), vec(3, 20), {}, cfg), m = meter(), R = effectiveArenaRadius();
  const p = spawn(g.world, {kind: 'projectile', owner: 0, pos: vec(0, 0), angle: Math.PI / 2, radius: .25, speed: 120, y: 3, life: 10, bouncesEnabled: true, maxBounces: 2, hit: {damage: 5}}, []);
  let bounces = 0, arenaHits = 0, maxD = 0;
  for (let t = 0; t < 1200 && !p.dead; t++) {
    stepWatch(g, cmd(), cmd(), m);maxD = Math.max(maxD, Math.hypot(p.pos.x, p.pos.z));
    for (const e of g.lastStepEvents) if (e.entity === p.id) {if (e.result === 'arenaBounce') bounces++;if (e.result === 'arenaHit') arenaHits++;}
  }
  report(`${name} (raio ${R} m)`, m);
  assert.ok(p.dead, 'o projétil deveria ter morrido na terceira borda');
  assert.equal(bounces, 2, `${bounces} ricochetes`);assert.equal(arenaHits, 1, 'morre no contato seguinte');
  assert.ok(maxD <= R, `centro do projétil a ${maxD.toFixed(3)} m: passou da borda (${R} m)`);
  return R;
}
test('ricochete radial na borda: ≤ 2 ricochetes e nunca além da borda, no raio configurado e com raio 50 m', () => {
  resetConfig(defaults());const configured = C.map.arenaRadius;
  assert.equal(ricochet('ricochete radial'), configured, 'usa o raio configurado');
  try {assert.equal(ricochet('ricochete radial', () => {C.map.arenaRadius = 50;}), 50);}
  finally {resetConfig(defaults());}   // override temporário: o raio volta ao configurado
  assert.equal(C.map.arenaRadius, configured);
});

// ------------------------------------------------------------------------------------------------ pouso
/** Corre até a plataforma (3×3, centro na origem) e salta: pousa no topo com contato real, e só uma vez. */
function jumpOnto(h) {
  const g = lab(vec(0, -3.2), vec(-20, -20), {platforms: [{id: 'pl', pos: {x: 0, z: 0}, width: 3, depth: 3, height: h}]}), m = meter(), A = g.fighters[0];
  const landings = [];
  for (let t = 0; t < 180; t++) {
    const c = t < 60 ? cmd({move: vec(0, 1), jump: t === 5, jumpHeld: t >= 5 && t < 75}) : cmd();
    if (stepWatch(g, c, cmd(), m).includes(0)) landings.push({tick: g.tick, y: A.lastLanding.y, x: A.lastLanding.x, z: A.lastLanding.z});
  }
  report(`salto sobre plataforma de ${h} m`, m);
  return {g, A, m, landings};
}
for (const h of [1.0, 1.5]) test(`salto sobre plataforma de ${h} m: pousa no topo UMA vez, com contato real, sem penetrar`, () => {
  const {A, m, landings} = jumpOnto(h);
  assert.equal(landings.length, 1, `pousos: ${JSON.stringify(landings)}`);
  assert.ok(Math.abs(landings[0].y - h) < 1e-9, `pousou em y ${landings[0].y}`);
  assert.ok(Math.abs(landings[0].x) <= 1.5 && Math.abs(landings[0].z) <= 1.5, 'pousou fora da pegada da plataforma');
  assert.ok(!A.flight && Math.abs(A.groundY - h) < 1e-9, `terminou em y ${A.groundY}`);
  assert.ok(m.pen <= TOL(), `penetração ${m.pen}`);assert.equal(m.escapes, 0);
});
for (const ledge of [1, 0]) test(`salto curto contra a lateral da plataforma de 1,5 m (ledge grab ${ledge ? 'ligado' : 'desligado'}): nunca «monta» o topo; pousos só reais`, () => {
  const g = lab(vec(0, -3.2), vec(-20, -20), {platforms: [{id: 'pl', pos: {x: 0, z: 0}, width: 3, depth: 3, height: 1.5}]}, () => {C.ledge.mode = ledge;}), m = meter(), A = g.fighters[0];
  const landings = [];let hung = false;
  for (let t = 0; t < 180; t++) {
    const c = t < 90 ? cmd({move: vec(0, 1), jump: t === 5, jumpHeld: t === 5}) : cmd();
    if (stepWatch(g, c, cmd(), m).includes(0)) landings.push(A.lastLanding.y);
    hung ||= !!A.ledge;
  }
  report(`salto curto × lateral de 1,5 m (ledge ${ledge ? 'on' : 'off'})`, m);
  assert.ok(!landings.includes(1.5), `pousou no topo: ${JSON.stringify(landings)}`);
  if (ledge) {assert.ok(hung, 'deveria agarrar a borda');assert.deepEqual(landings, [], 'pendurado não é pouso');}
  else {assert.deepEqual(landings, [0], `pousos em ${JSON.stringify(landings)}`);assert.ok(A.groundY === 0 && A.position.z <= -1.5 - C.test.halfExtent + 1e-6, `terminou em y ${A.groundY}, z ${A.position.z}`);}
  assert.ok(m.pen <= TOL(), `penetração ${m.pen}`);assert.equal(m.escapes, 0);
});
test('sair da borda andando: preserva vx/vz na transição, cai balístico sem pouso até tocar o chão (um pouso, em y = 0)', () => {
  const g = lab(vec(0, 0), vec(-20, -20), {platforms: [{id: 'pl', pos: {x: 0, z: 0}, width: 3, depth: 3, height: 1.0}]}), m = meter(), A = g.fighters[0];
  A.groundY = 1.0;
  let v0 = null, start = null, prev = null, landings = [];
  for (let t = 0; t < 240; t++) {
    const grounded = !A.flight, vBefore = {...A.velocity};
    const landed = stepWatch(g, cmd({move: vec(1, 0)}), cmd(), m).includes(0);
    if (grounded && A.flight && !start) {
      start = {tick: g.tick, h: {...A.flight.horizontal}};v0 = vBefore;
      assert.ok(Math.abs(start.h.x - v0.x) < 1e-9 && Math.abs(start.h.z - v0.z) < 1e-9, `horizontal ${JSON.stringify(start.h)} ≠ velocidade no chão ${JSON.stringify(v0)}`);
      assert.ok(A.flight.isEdgeFall, 'queda de borda');
    }
    if (start && A.flight) {
      const f = A.flight;
      if (prev) {assert.ok(f.y <= prev.y + 1e-12 && f.vy < prev.vy, 'queda balística: altura e vy só descem');}
      assert.ok(f.horizontal.x > 0 && Math.abs(f.horizontal.z) < 1e-9, `rumo mudou: ${JSON.stringify(f.horizontal)}`);
      prev = {y: f.y, vy: f.vy};
    }
    if (landed) landings.push({tick: g.tick, y: A.lastLanding.y});
    if (landings.length && t > start?.tick + 30) break;
  }
  report('queda pela borda', m);
  assert.ok(start, 'não saiu da borda');assert.ok(Math.abs(v0.x) > 1, `velocidade no chão ${v0.x}`);
  assert.equal(landings.length, 1, `pousos: ${JSON.stringify(landings)}`);assert.equal(landings[0].y, 0);
  assert.ok(A.position.x > 1.5 + C.test.halfExtent, 'pousou fora da plataforma');
  assert.ok(m.pen <= TOL());assert.equal(m.escapes, 0);
});
/** O defensor (lutador 1) não pode registrar pouso nem estado/recuperação de pouso durante `ticks` passos. */
function noLanding(name, g, setup, ticks = 150) {
  const m = meter(), B = g.fighters[1], n0 = B.lastLanding?.n ?? 0, landed = [];setup(g);
  for (let t = 0; t < ticks; t++) {
    for (const i of stepWatch(g, cmd(), cmd(), m)) landed.push([i, g.fighters[i].lastLanding.y]);
    assert.ok(B.state !== 'landing' && B.recoveryKind !== 'landing', `${name}: defensor em estado de pouso no tick ${g.tick} (${B.state}/${B.recoveryKind})`);
  }
  report(name, m);
  assert.equal(B.lastLanding?.n ?? 0, n0, `${name}: defensor registrou pouso`);
  assert.ok(m.pen <= TOL());assert.equal(m.escapes, 0);
  return landed;
}
test('stagger, footstool e empurrão no chão: o defensor nunca registra pouso; o pouso do atacante do footstool é real', () => {
  noLanding('stagger (counter stagger 0,6 s)', lab(vec(-6, 0), vec(0, 0)), g => {assert.ok(applyCounterStagger(g.fighters[1], .6, [], 0));});
  noLanding('empurrão (2 m em 0,3 s)', lab(vec(-6, 0), vec(0, 0)), g => {pushAway(g.fighters[1], vec(1, 0), 2, .3);});
  let fs = 0;
  const landed = noLanding('footstool', lab(vec(0, 0), vec(0, 0)), g => {
    const [A, B] = g.fighters;A.position = {...B.position};A.state = 'airborne';A.normalJumpLanding = true;
    A.flight = {y: 1.6, vy: -3, horizontal: vec(), isNormalJump: true, jumpFeel: true, jumpHeld: false};
    const orig = g.step.bind(g);g.step = (a, b) => {orig(a, b);fs += g.lastStepEvents.filter(e => e.contact === 'footstool' && e.target === 1).length;};
  });
  assert.equal(fs, 1, `${fs} footstools`);
  assert.deepEqual(landed.filter(([i]) => i === 1), []);
  assert.ok(landed.some(([i, y]) => i === 0 && y === 0), `o atacante deveria pousar no chão: ${JSON.stringify(landed)}`);
});

// ------------------------------------------------------------------------------------------------ mapa e spawn
/** Revalida na ordem de colocação (o que já existia quando cada objeto nasceu), como o oráculo da Task 7; devolve os inválidos. */
function invalidPlacements(g) {
  const ms = g.mapState, f = g.fighters, part = {platforms: ms.platforms, obstacles: [], destructibles: []}, bad = [];
  for (const o of ms.obstacles) {if (!isValidSpawnPosition(o.pos, 2.0, part, f, 5, o.shape === 'box' ? {hx: o.hx, hz: o.hz} : {r: o.radius})) bad.push(o.id);part.obstacles.push(o);}
  for (const d of ms.destructibles) {if (!isValidSpawnPosition(d.pos, 1.2, part, f, 5, {hx: .8, hz: .8})) bad.push(d.id);part.destructibles.push(d);}
  for (const it of ms.items) if (!isValidSpawnPosition(it.pos, 1.0, part, f, 5)) bad.push('item ' + it.id);
  return bad;
}
test('mapa reembaralhado (reset com outra seed, 40 seeds): nenhum lutador nem objeto nasce em interseção; 1 s parado sem resíduo nem escape', () => {
  resetConfig(defaults());
  const g = new Game({seed: 1}), m = meter();g.mode = 'inactive';let objs = 0;
  for (let seed = 1; seed <= 40; seed++) {
    g.seed = seed;g.reset();g.mode = 'inactive';g.start();objs += g.mapState.obstacles.length + g.mapState.destructibles.length;
    assert.deepEqual(invalidPlacements(g), [], `seed ${seed}`);
    for (const f of g.fighters) {
      assert.equal(staticPenetration(f, g.world), 0, `seed ${seed}: lutador ${f.id} nasceu dentro de sólido`);
      assert.ok(Math.hypot(f.position.x, f.position.z) <= effectiveArenaRadius() - C.test.halfExtent + 1e-9, `seed ${seed}: lutador fora da arena`);
    }
    const layout = JSON.stringify([g.fighters.map(f => f.position), g.mapState.obstacles, g.mapState.destructibles, g.mapState.items]);
    for (let t = 0; t < 120; t++) stepWatch(g, cmd(), cmd(), m);
    g.reset();g.mode = 'inactive';
    assert.equal(JSON.stringify([g.fighters.map(f => f.position), g.mapState.obstacles, g.mapState.destructibles, g.mapState.items]), layout, `seed ${seed}: reset não reproduz o layout`);
  }
  report('mapa reembaralhado × 40 seeds', m);
  assert.ok(objs > 200, `só ${objs} objetos em 40 seeds`);
  assert.equal(m.residual, 0);assert.equal(m.escapes, 0);assert.equal(m.pen, 0);
});

// ------------------------------------------------------------------------------------------------ carry-over da revisão da Task 8
const box = (id, x, z, hx, hz) => ({id, shape: 'box', pos: {x, y: 0, z}, hx, hz, radius: Math.max(hx, hz), height: 3, angle: 0});
const escapes = g => g.lastStepEvents.filter(e => e.result === 'pinEscape');
test('(a) resíduo NÃO convergido mas ≤ tolerância: mede e conta o conflito, sem pinEscape', () => {
  // Vão de 0,6 m (corpo de 1 m): resíduo ≈ 0,2 m. Com a tolerância acima disso, o resíduo é aceito (medido), sem mover o lutador.
  // `test.penetrationTolerance` não está em defaults() (resetConfig não o apaga): o override é desfeito no finally.
  const g = lab(vec(0, 0), vec(-6, -6), {obstacles: [box('a', -1.3, 0, 1, 2), box('b', 1.3, 0, 1, 2)]}, () => {C.test.penetrationTolerance = .5;}), m = meter(), A = g.fighters[0];
  const c0 = physicsProbe.staticConflictsTotal;let n = 0;
  try {for (let t = 0; t < 30; t++) {stepWatch(g, cmd(), cmd(), m);n += escapes(g).length;}}
  finally {delete C.test.penetrationTolerance;}
  report('(a) resíduo ≤ tolerância', m);
  assert.equal(n, 0, `${n} pinEscape com resíduo abaixo da tolerância`);
  assert.ok(m.residual > .02 && m.residual <= .5, `resíduo ${m.residual}`);
  assert.ok(physicsProbe.staticConflictsTotal > c0, 'o conflito tem de continuar contado');
  assert.ok(Math.abs(A.position.z) < 1e-9, 'não pode ter sido movido para fora do vão');
});
test('(b) recinto sem saída a 4 m: o escape usa o fallback da arena inteira e diz isso no evento (fallback: true, distance)', () => {
  // Vão de 0,6 m entre duas caixas de 10 × 10 m: a saída mais próxima (fim do vão) fica a 5,5 m, além dos anéis de 4 m.
  const g = lab(vec(0, 0), vec(-20, -20), {obstacles: [box('a', -5.3, 0, 5, 5), box('b', 5.3, 0, 5, 5)]}), m = meter(), A = g.fighters[0];
  stepWatch(g, cmd(), cmd(), m);
  const [e] = escapes(g);
  report('(b) recinto > 4 m (fallback)', m);
  assert.ok(e, 'sem pinEscape');assert.deepEqual(validateCombatEvent(e), []);
  assert.equal(e.fallback, true, 'fallback da arena inteira tem de ser explícito');
  const moved = Math.hypot(e.to.x - e.from.x, e.to.z - e.from.z);
  assert.ok(Math.abs(e.distance - moved) < 1e-9, `distance ${e.distance} ≠ deslocamento ${moved}`);
  assert.ok(moved > 4, `deslocou ${moved}`);
  assert.equal(staticPenetration(A, g.world), 0);
});
test('(b) escape pelos anéis (≤ 4 m): fallback: false e distance = deslocamento', () => {
  const g = lab(vec(0, 0), vec(-6, -6), {obstacles: [box('a', -1.3, 0, 1, 2), box('b', 1.3, 0, 1, 2)]}), m = meter();
  stepWatch(g, cmd(), cmd(), m);
  const [e] = escapes(g);
  assert.ok(e);assert.equal(e.fallback, false);
  assert.ok(Math.abs(e.distance - Math.hypot(e.to.x - e.from.x, e.to.z - e.from.z)) < 1e-9);assert.ok(e.distance <= 4);
});
test('(c) sem escape possível: a busca roda no máximo UMA vez por lutador por passo (não a cada subpasso/projeção)', () => {
  // Arena de 3 m inteira coberta por duas caixas com vão de 0,6 m: nem os anéis nem o fallback acham posição livre.
  const g = lab(vec(0, 0), vec(0, 2.2), {obstacles: [box('a', -5.3, 0, 5, 5), box('b', 5.3, 0, 5, 5)]}, () => {C.test.circleCap = 3;}), m = meter();
  let worst = 0, total = 0;
  for (let t = 0; t < 20; t++) {
    stepWatch(g, cmd({move: vec(0, 1)}), cmd(), m);   // andando: vários subpassos por passo
    assert.equal(escapes(g).length, 0);
    worst = Math.max(worst, physicsProbe.escapeSearches);total += physicsProbe.escapeSearches;
  }
  report('(c) sem escape (busca limitada)', m);
  assert.ok(m.residual > .02, 'o cenário tem de estar preso');
  assert.ok(worst >= 1 && worst <= g.fighters.length, `${worst} buscas num passo (limite: 1 por lutador)`);
  assert.ok(total <= 20 * g.fighters.length);
});
