// @ts-check
// Fase 5: executa um cenário na física ATUAL do Arenamon (Game.step real, sem alterar nada) e devolve a trilha.
import {C, defaults, resetConfig} from '../sim/config.js';
import {Game} from '../sim/game.js';
import {emptyCommand} from '../sim/entity.js';
import {vec} from '../sim/math.js';
import {commandAt} from './poc-scenarios.js';
import {summarize} from './poc-metrics.js';

// (Moves padrão: registrados pelo chamador — teste ou laboratório —, como manda o teste de arquitetura de moves.test.mjs.)

/** Converte os sólidos declarativos para o mapState do Arenamon. */
export function toMapState(mapState, solids) {
  mapState.obstacles = [];mapState.platforms = [];mapState.destructibles = [];mapState.items = [];mapState.regularSpawnTimer = 1e9;
  for (const s of solids) {
    if (s.id.startsWith('plat')) mapState.platforms.push({id: s.id, pos: {x: s.x, y: 0, z: s.z}, width: s.hx * 2, depth: s.hz * 2, height: s.top});
    else mapState.obstacles.push({id: s.id, pos: {x: s.x, y: s.base, z: s.z}, shape: s.shape === 'cyl' ? 'cylinder' : 'box', hx: s.hx, hz: s.hz, radius: s.shape === 'cyl' ? s.r : Math.max(s.hx, s.hz), height: s.top - s.base, angle: 0});
  }
}

/** @param {any} sc cenário de poc-scenarios.js */
export function runArenamon(sc, {seed = 1, snapshotAt = null, tweak = null} = {}) {
  resetConfig(defaults());
  tweak?.(C);   // ajustes do laboratório (altura do salto, gravidades): valem para as DUAS físicas
  C.extras.toggles.enableEnemyAI = 0;
  const g = new Game({seed});g.start();
  toMapState(g.mapState, sc.solids);
  const f = g.fighters[0], other = g.fighters[1];
  other.position = vec(-30, -30);other.groundY = 0;
  f.position = vec(sc.start.x, sc.start.z);f.velocity = vec();
  const onSolid = sc.solids.some(s => Math.abs(s.top - sc.start.y) < 1e-6);
  f.groundY = onSolid ? sc.start.y : 0;
  if (!onSolid && sc.start.y > 0) f.flight = {y: sc.start.y, vy: 0, horizontal: vec(), isNormalJump: true, jumpFeel: true, jumpHeld: false};
  if (sc.launch) f.flight = {y: 0.01, vy: 3, horizontal: vec(sc.launch.vx, sc.launch.vz)};
  const trace = [];let saved = null;
  const y = () => f.flight ? f.flight.y : (f.groundY ?? 0);
  for (let t = 0; t < sc.ticks; t++) {
    if (snapshotAt === t) saved = g.save();
    const c = commandAt(sc, t);
    g.step({...emptyCommand(), move: vec(c.move[0], c.move[1]), jump: c.jump, jumpHeld: c.held}, emptyCommand());
    trace.push({x: f.position.x, y: y(), z: f.position.z});
  }
  return {engine: 'arenamon', trace, saved, game: g, ...summarize(trace, sc.solids)};
}
