// Fase 3 do overhaul de colisões — detecção contínua (primeiro contato) para projéteis rápidos contra barreiras/paredes finas.
// Origem: fuzz da Fase 0 sobre 4634ca2: com espessura efetiva 2·(hz + raio) < test.contactStep (0,1 m) o subpasso de 0,1 m pulava a barreira
// (32 de 222 tentativas atravessaram); com espessura ≥ 0,1 m, 0 de 378. Lutadores lançados até 60 m/s: 0 de 400 atravessaram a parede fina.
// Contrato: o projétil nunca termina além de uma barreira que bloqueia, e entre vários bloqueadores vale o PRIMEIRO no caminho (menor tempo
// de impacto), com dano aplicado uma única vez.
// Uso: node prototypes/combat-lab/test/collision-ccd.test.mjs
import assert from 'node:assert/strict';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {emptyCommand} from '../src/sim/entity.js';
import {vec} from '../src/sim/math.js';
import {spawn} from '../src/sim/world.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
let tests = 0;const failures = [];
const check = (name, fn) => {try {resetConfig(defaults());fn();tests++;console.log('✓', name);} catch (error) {failures.push(name);console.log('✗', name, '—', String(error.message).split(/\r?\n/)[0]);}};

/** Partida sem objetos do mapa, lutadores longe, para isolar o mundo de entidades. */
function lab() {
  const g = new Game();g.reset({positions: [vec(-30, -30), vec(30, 30)]});g.mode = 'inactive';
  Object.assign(g.mapState, {platforms: [], destructibles: [], items: [], obstacles: []});
  return g;
}
const run = (g, ticks) => {for (let t = 0; t < ticks; t++) g.step(emptyCommand(), emptyCommand());};

// Espessura efetiva menor que o subpasso: o caso que o 4634ca2 deixava atravessar.
for (const speed of [30, 80, 150, 200]) for (const angle of [0, .3, -.45]) {
  check(`projétil de ${speed} m/s (rumo ${angle} rad) contra barreira de 0,03 m + raio 0,02 não atravessa`, () => {
    const g = lab();
    spawn(g.world, {kind: 'barrier', owner: 1, pos: vec(0, 0), hx: 30, hz: .015, y: 0, height: 3, life: 99}, []);
    const p = spawn(g.world, {kind: 'projectile', owner: 0, pos: vec(0, -3), angle, radius: .02, speed, y: 1, life: 5}, []);
    let maxZ = -Infinity;
    for (let t = 0; t < 120 && !p.dead; t++) {g.step(emptyCommand(), emptyCommand());maxZ = Math.max(maxZ, p.pos.z);}
    assert.ok(p.dead, 'projétil deveria ter sido bloqueado');
    assert.ok(maxZ <= .015 + .02 + 1e-6, `foi até z=${maxZ.toFixed(4)}, além da barreira`);
  });
}
// Velocidades em que o 4634ca2 atingia a barreira de TRÁS (ou nenhuma): 72 de 221 velocidades entre 40 e 260 m/s falhavam (fuzz da Fase 0).
for (const speed of [43, 47, 52, 54, 57, 59, 61, 71, 90, 130, 200]) {
  check(`${speed} m/s, duas barreiras a 6 cm: vale a primeira no caminho, não a primeira da lista`, () => {
    const g = lab();
    // A barreira de trás é criada ANTES da da frente: a ordem da lista não pode decidir quem é atingido.
    const far = spawn(g.world, {kind: 'barrier', owner: 1, pos: vec(0, .06), hx: 30, hz: .01, y: 0, height: 3, life: 99, hp: 100}, []);
    const near = spawn(g.world, {kind: 'barrier', owner: 1, pos: vec(0, 0), hx: 30, hz: .01, y: 0, height: 3, life: 99, hp: 100}, []);
    const p = spawn(g.world, {kind: 'projectile', owner: 0, pos: vec(0, -3), angle: 0, radius: .02, speed, y: 1, life: 5, hit: {damage: 10}}, []);
    for (let t = 0; t < 60 && !p.dead; t++) g.step(emptyCommand(), emptyCommand());
    assert.ok(p.dead);
    assert.equal(near.hp, 90, 'a barreira mais próxima tem de receber o dano');
    assert.equal(far.hp, 100, 'a barreira de trás não pode ser atingida');
  });
}
check('dano em barreira com hp é aplicado uma única vez por projétil', () => {
  const g = lab();
  const b = spawn(g.world, {kind: 'barrier', owner: 1, pos: vec(0, 0), hx: 30, hz: .2, y: 0, height: 3, life: 99, hp: 100}, []);
  const p = spawn(g.world, {kind: 'projectile', owner: 0, pos: vec(0, -3), angle: 0, radius: .1, speed: 60, y: 1, life: 5, hit: {damage: 10}}, []);
  for (let t = 0; t < 60 && !p.dead; t++) g.step(emptyCommand(), emptyCommand());
  assert.ok(p.dead);
  assert.equal(b.hp, 90);
});
check('regressão: projétil lento e grosso continua bloqueado na face (posição de parada igual ao método anterior ±1 subpasso)', () => {
  const g = lab();
  spawn(g.world, {kind: 'barrier', owner: 1, pos: vec(0, 0), hx: 30, hz: .3, y: 0, height: 3, life: 99}, []);
  const p = spawn(g.world, {kind: 'projectile', owner: 0, pos: vec(0, -3), angle: 0, radius: .25, speed: 12, y: 1, life: 5}, []);
  run(g, 120);
  assert.ok(p.dead);
  assert.ok(Math.abs(p.pos.z - (-.55)) <= 1e-4, `parou em z=${p.pos.z.toFixed(5)} (esperado -0,55: a face menos o raio)`);
});


/** Desfecho de um projétil contra um conjunto de bloqueadores com um passo de contato dado (0,002 m ≈ referência exata). */
function outcome(build, projSpec, step) {
  resetConfig(defaults());C.test.contactStep = step;
  const g = lab();build(g);
  const p = spawn(g.world, {kind: 'projectile', owner: 0, y: 1, life: 5, hit: {damage: 10}, ...projSpec}, []), sig = [];
  for (let t = 0; t < 90 && !p.dead; t++) {
    g.step(emptyCommand(), emptyCommand());
    for (const e of g.lastStepEvents) if (e.entity === p.id || e.by === p.id) if (e.result !== 'arenaBounce') sig.push(`${e.result}:${e.by ?? ''}:${e.target ?? ''}`);
  }
  return {sig: sig.join('|'), dead: p.dead, pos: p.pos};
}
const DEFAULT_STEP = defaults().test.contactStep;   // fixo: `outcome` altera C.test.contactStep e a configuração é recarregada a cada chamada
const agrees = (build, projSpec) => {const a = outcome(build, projSpec, DEFAULT_STEP), ref = outcome(build, projSpec, .002);return {a, ref, ok: a.sig === ref.sig && a.dead === ref.dead};};

check('ponta da barreira fina (canto): projétil que passa a menos de um raio da ponta é bloqueado como na referência exata', () => {
  let bad = 0, total = 0;
  for (const speed of [40, 60, 80, 120, 160, 200]) for (let dz = -3; dz <= -1; dz += .25) for (const dx of [.012, .02, .03, .04]) {
    const build = g => spawn(g.world, {kind: 'barrier', owner: 1, pos: vec(0, 0), hx: 1, hz: .01, y: 0, height: 3, life: 99}, []);
    const r = agrees(build, {pos: vec(1 + dx, dz), angle: 0, radius: .035, speed});
    total++;if (!r.ok) bad++;
  }
  assert.equal(bad, 0, `${bad} de ${total} divergem da referência exata`);
});
check('barreira fina ROTACIONADA: não atravessa e acerta como a referência exata', () => {
  let bad = 0, total = 0;
  for (const ang of [.3, .7, -.5, 1.2]) for (const speed of [45, 90, 180]) for (const off of [-1, 0, 1.5]) {
    const build = g => spawn(g.world, {kind: 'barrier', owner: 1, pos: vec(0, 0), angle: ang, hx: 6, hz: .01, y: 0, height: 3, life: 99}, []);
    const r = agrees(build, {pos: vec(off, -3), angle: .1, radius: .02, speed});
    total++;if (!r.ok) bad++;
  }
  assert.equal(bad, 0, `${bad} de ${total} divergem`);
});
check('objetos do mapa finos (obstáculo caixa, pilar de raio mínimo, plataforma, destrutível): não atravessam e acertam como a referência', () => {
  const builds = {
    obstáculo: g => g.mapState.obstacles.push({id: 'o', shape: 'box', pos: {x: 0, y: 0, z: 0}, hx: 6, hz: .01, height: 3}),
    pilar: g => g.mapState.obstacles.push({id: 'o', shape: 'cylinder', pos: {x: 0, y: 0, z: 0}, radius: .015, height: 3}),
    plataforma: g => g.mapState.platforms.push({id: 'pl', pos: {x: 0, z: 0}, width: .02, depth: 6, height: 3}),
    destrutível: g => g.mapState.destructibles.push({id: 'd', hp: 30, maxHp: 30, pos: {x: 0, y: 0, z: 0}, size: {hx: 6, hz: .01, height: 3}, shape: 'box', angle: 0, state: 'solid', respawnTimer: 0}),
  };
  for (const [name, build] of Object.entries(builds)) for (const speed of [45, 90, 180]) {
    const r = agrees(build, {pos: vec(name === 'plataforma' ? -3 : 0, name === 'plataforma' ? 0 : -3), angle: name === 'plataforma' ? Math.PI / 2 : 0, radius: .02, speed});
    assert.ok(r.ok, `${name} a ${speed} m/s diverge da referência: novo=${r.a.sig} ref=${r.ref.sig}`);
    if (name !== 'pilar') assert.ok(r.a.dead, `${name} a ${speed} m/s não bloqueou`);
  }
});
check('reflexão seguida de bloqueador no mesmo subpasso: o desfecho coincide com a referência (a corda varrida é a da perna refletida)', () => {
  let bad = 0, total = 0;
  for (let cx = -.05; cx <= .15; cx += .01) for (let cz = .04; cz <= .16; cz += .01) {
    const build = g => {
      spawn(g.world, {kind: 'barrier', owner: 1, pos: vec(0, 0), angle: 0, hx: 3, hz: .01, y: 0, height: 3, life: 99, hp: 100, reflect: true, shields: true, pl: 1, captured: {tieTolerance: .001, maxReflections: 16}}, []);
      spawn(g.world, {kind: 'wall', owner: 1, pos: vec(cx, cz), hx: .005, hz: .01, y: 0, height: 3, life: 99}, []);
    };
    const r = agrees(build, {pos: vec(-.2, .28), angle: Math.PI * 3 / 4, radius: .02, speed: 12});
    total++;if (!r.ok) bad++;
  }
  assert.equal(bad, 0, `${bad} de ${total} posições de parede divergem (acerto fantasma da corda errada)`);
});

console.log(`Detecção contínua de projéteis: ${tests} verificações aprovadas, ${failures.length} falhas.`);
if (failures.length) process.exit(1);
