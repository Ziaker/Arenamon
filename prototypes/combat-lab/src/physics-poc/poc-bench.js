// @ts-check
// Fase 5: determinismo/reprodutibilidade e desempenho da prova de conceito (módulo usado pelo teste em Node e pelo laboratório).
import {C, defaults, resetConfig} from '../sim/config.js';
import {Game} from '../sim/game.js';
import {emptyCommand} from '../sim/entity.js';
import {stepPhysics} from '../sim/physics.js';
import {vec} from '../sim/math.js';
import {DT, HALF, BODY_H} from './poc-scenarios.js';
import {runArenamon, toMapState} from './poc-arenamon.js';
import {runRapier, rapierDefaults, RapierSim} from './poc-rapier.js';
import {traceHash} from './poc-metrics.js';

/** Dois relógios iguais devem dar a mesma trilha; o Arenamon também deve reproduzir após save/load. */
export function determinismArenamon(sc) {
  const a = runArenamon(sc, {snapshotAt: 100}), b = runArenamon(sc);
  // retoma do estado salvo no tick 100 e compara o resto
  resetConfig(defaults());C.extras.toggles.enableEnemyAI = 0;
  const g = new Game({seed: 1});g.start();g.load(a.saved);
  const f = g.fighters[0], tail = [];
  const y = () => f.flight ? f.flight.y : (f.groundY ?? 0);
  return import('./poc-scenarios.js').then(({commandAt}) => {
    for (let t = 100; t < sc.ticks; t++) {
      const c = commandAt(sc, t);
      g.step({...emptyCommand(), move: vec(c.move[0], c.move[1]), jump: c.jump, jumpHeld: c.held}, emptyCommand());
      tail.push({x: f.position.x, y: y(), z: f.position.z});
    }
    return {repeat: a.hash === b.hash, saveLoad: traceHash(tail) === traceHash(a.trace.slice(100)), hash: a.hash};
  });
}
export function determinismRapier(RAPIER, sc, opts = rapierDefaults()) {
  const a = runRapier(RAPIER, sc, {opts, snapshotAt: 100}), b = runRapier(RAPIER, sc, {opts});
  const sim = a.sim;sim.restore(a.snap);
  const tail = [];
  return import('./poc-scenarios.js').then(({commandAt}) => {
    for (let t = 100; t < sc.ticks; t++) {sim.step(commandAt(sc, t));tail.push(sim.pos());}
    const same = traceHash(tail) === traceHash(a.trace.slice(100));
    a.sim.dispose();b.sim.dispose();
    return {repeat: a.hash === b.hash, saveLoad: same, hash: a.hash};
  });
}

/** Mundo de carga: 16 sólidos espalhados + n personagens andando em círculos determinísticos. */
function benchSolids() {
  const s = [];
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2, r = 6 + (i % 4) * 2;
    s.push({id: i % 5 === 0 ? 'plat' + i : 'obs' + i, shape: /** @type {const} */ (i % 3 === 0 ? 'cyl' : 'box'), x: Math.cos(a) * r, z: Math.sin(a) * r, hx: 1.2, hz: 1.2, r: 1, base: 0, top: 1 + (i % 4) * .6});
  }
  return s;
}
/** Microssegundos por passo de Rapier com n personagens (controlador cinemático + step do mundo). */
export function benchRapier(RAPIER, n, ticks = 600) {
  const sc = {solids: benchSolids(), start: {x: 0, z: 0, y: 0}, ticks, script: [], expect: ''};
  const w = new RAPIER.World({x: 0, y: 0, z: 0});w.timestep = DT;
  w.createCollider(RAPIER.ColliderDesc.cuboid(60, .5, 60).setTranslation(0, -.5, 0));
  for (const s of sc.solids) {
    const h = (s.top - s.base) / 2, d = s.shape === 'cyl' ? RAPIER.ColliderDesc.cylinder(h, s.r) : RAPIER.ColliderDesc.cuboid(s.hx, h, s.hz);
    w.createCollider(d.setTranslation(s.x, s.base + h, s.z));
  }
  const ctrl = w.createCharacterController(.01);ctrl.enableSnapToGround(.15);ctrl.setUp({x: 0, y: 1, z: 0});
  const chars = [];
  for (let i = 0; i < n; i++) {
    const a = i / Math.max(1, n) * Math.PI * 2, body = w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(Math.cos(a) * 14, BODY_H / 2 + .01, Math.sin(a) * 14));
    chars.push({body, col: w.createCollider(RAPIER.ColliderDesc.cuboid(HALF, BODY_H / 2, HALF), body), a});
  }
  const t0 = performance.now();
  for (let t = 0; t < ticks; t++) {
    for (const c of chars) {
      const ang = c.a + t * .012, p = c.body.translation();
      ctrl.computeColliderMovement(c.col, {x: Math.cos(ang) * 4.8 * DT, y: -.01, z: Math.sin(ang) * 4.8 * DT});
      const m = ctrl.computedMovement();
      c.body.setNextKinematicTranslation({x: p.x + m.x, y: p.y + m.y, z: p.z + m.z});
    }
    w.step();
  }
  const us = (performance.now() - t0) / ticks * 1000;
  ctrl.free();w.free();
  return us;
}
/** Microssegundos por passo: Game.step completo (2 lutadores, IA, combate) e stepPhysics isolado (2 lutadores). */
export function benchArenamon(ticks = 600) {
  resetConfig(defaults());
  const g = new Game({seed: 5});g.start();toMapState(g.mapState, benchSolids());
  g.mode = 'tactical';
  let t0 = performance.now();
  for (let t = 0; t < ticks; t++) g.step(emptyCommand());
  const full = (performance.now() - t0) / ticks * 1000;
  const h = new Game({seed: 5});h.start();toMapState(h.mapState, benchSolids());
  const [a, b] = h.fighters;a.position = vec(6, 0);b.position = vec(-6, 0);
  t0 = performance.now();
  for (let t = 0; t < ticks; t++) {
    a.velocity = vec(Math.cos(t * .012) * 4.8, Math.sin(t * .012) * 4.8);b.velocity = vec(-Math.cos(t * .012) * 4.8, Math.sin(t * .012) * 4.8);
    stepPhysics(h.fighters, DT, h.world);
  }
  const physOnly = (performance.now() - t0) / ticks * 1000;
  return {fullStepUs: full, physicsOnlyUs: physOnly};
}
/** Mediana de n execuções (descarta ruído de JIT/GC): 1 aquecimento + n medições. */
export function median(fn, n = 5) {
  fn();
  const runs = Array.from({length: n}, fn);
  if (typeof runs[0] === 'number') return runs.sort((a, b) => a - b)[n >> 1];
  return Object.fromEntries(Object.keys(runs[0]).map(k => [k, runs.map(r => r[k]).sort((a, b) => a - b)[n >> 1]]));
}
export {RapierSim};
