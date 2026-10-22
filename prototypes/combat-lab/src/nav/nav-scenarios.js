// @ts-check
// Fase 3 (Yuka): cenários de teste de navegação. Cada cenário monta um mapa sólido DETERMINÍSTICO sobre uma
// partida real (Game): obstáculos, corredores, plataformas, rotas alternativas e áreas bloqueadas, com o
// perseguidor (vermelho, IA) e o alvo (azul, parado) em posições diferentes. Usado pelo laboratório e pelos testes.
import {C} from '../sim/config.js';
import {vec} from '../sim/math.js';
import {emptyCommand} from '../sim/entity.js';

const box = (id, x, z, hx, hz, height, y = 0) => ({id, pos: {x, y, z}, shape: 'box', hx, hz, radius: Math.max(hx, hz), height, angle: 0});
const plat = (id, x, z, w, d, height) => ({id, pos: {x, y: 0, z}, width: w, depth: d, height});

/** @type {Record<string, {label:string, hint:string, obstacles:any[], platforms:any[], destructibles?:any[], blocked?:any[], chaser:{x:number,z:number}, target:{x:number,z:number,y?:number}, expect:'reach'|'unreachable'}>} */
export const NAV_SCENARIOS = {
  muro: {
    label: 'Muro entre os lutadores', hint: 'Um muro longo separa vermelho e azul; a rota passa pela ponta.',
    obstacles: [box('muro', 0, 0, 7, .6, 4)], platforms: [], chaser: {x: 0, z: 8}, target: {x: 0, z: -8}, expect: 'reach',
  },
  corredor: {
    label: 'Corredor estreito', hint: 'O alvo está no fim de um corredor (≈1,8 m de largura) cercado por paredes.',
    obstacles: [box('paredeA', -2.2, -6, .6, 6, 3.5), box('paredeB', 2.2, -6, .6, 6, 3.5), box('fundo', 0, -12.6, 3, .6, 3.5)],
    platforms: [], chaser: {x: 0, z: 9}, target: {x: 0, z: -10}, expect: 'reach',
  },
  rotas: {
    label: 'Rotas alternativas + área bloqueada', hint: 'A rota curta passa por uma área bloqueada (nav); a longa contorna os muros.',
    obstacles: [box('m1', -6, 0, .6, 5, 3), box('m2', 6, 0, .6, 5, 3), box('m3', 0, -5.6, 6.6, .6, 3)],
    platforms: [], blocked: [{x: 0, z: 0, r: 2.6}], chaser: {x: 0, z: 9}, target: {x: 0, z: -9}, expect: 'reach',
  },
  plataforma: {
    label: 'Plataforma elevada (salto)', hint: 'O alvo está em uma plataforma de 1,5 m: precisa de salto (degrau de 1,0 m opcional).',
    obstacles: [], platforms: [plat('degrau', -1.8, 4, 3, 3, 1.0), plat('alta', 1.6, 4, 3, 3, 1.5)],
    chaser: {x: -3, z: 12}, target: {x: 1.6, z: 4, y: 1.5}, expect: 'reach',
  },
  torre: {
    label: 'Alvo em altura incompatível', hint: 'O alvo está sobre um bloco de 3,5 m: inalcançável por salto; o perseguidor não deve insistir nem atacar o vazio.',
    obstacles: [box('torre', 0, -4, 2, 2, 3.5)], platforms: [], chaser: {x: 0, z: 8}, target: {x: 0, z: -4, y: 3.5}, expect: 'unreachable',
  },
  completo: {
    label: 'Arena de testes completa', hint: 'Todos os elementos juntos: muros, corredor, plataformas e zona bloqueada.',
    obstacles: [box('muro', -8, 0, 5, .6, 4), box('paredeA', 9, -6, .6, 5, 3.5), box('paredeB', 13, -6, .6, 5, 3.5), box('torre', -10, -10, 2, 2, 3.5)],
    platforms: [plat('degrau', 2, 6, 3, 3, 1.0), plat('alta', 5, 6, 3, 3, 1.5)],
    blocked: [{x: 0, z: -3, r: 2.2}], chaser: {x: -12, z: 10}, target: {x: 11, z: -9}, expect: 'reach',
  },
};
export const NAV_SCENARIO_IDS = Object.keys(NAV_SCENARIOS);

/**
 * Prepara a partida para o cenário: mapa sólido, sem itens, lutadores posicionados, azul parado, vermelho na IA.
 * Retorna as zonas bloqueadas (só para o planejador) e o chão do alvo.
 */
export function setupNavScenario(game, id, {mode = 'offensive'} = {}) {
  const S = NAV_SCENARIOS[id];
  if (!S) throw new Error('cenário de navegação desconhecido: ' + id);
  game.reset();
  const m = game.mapState;
  m.obstacles = structuredClone(S.obstacles);m.platforms = structuredClone(S.platforms);m.destructibles = structuredClone(S.destructibles ?? []);
  m.navBlocked = structuredClone(S.blocked ?? []);   // zonas proibidas só para o planejador (a física não as conhece)
  m.items = [];m.regularSpawnTimer = 1e9;
  const [blue, red] = game.fighters;
  const ty = S.target.y ?? 0;
  red.position = vec(S.chaser.x, S.chaser.z);red.velocity = vec();red.groundY = 0;red.facing = Math.PI;
  blue.position = vec(S.target.x, S.target.z);blue.velocity = vec();blue.groundY = ty;
  game.mode = mode;
  C.extras.toggles.enableEnemyAI = 1;
  return {scenario: S, blocked: S.blocked ?? [], targetY: ty};
}

/**
 * Executa o cenário (sem interface) e mede: chegou? quanto demorou? quanto tempo "empurrou parede"? saltos? ataques no vazio?
 * @param {any} Game classe Game (injetada para não criar dependência circular nos testes)
 */
export function runNavScenario(Game, id, {nav = 1, seconds = 40, seed = 7, mode = 'offensive'} = {}) {
  const prevNav = C.extras.nav.enableNav;
  C.extras.nav.enableNav = nav ? 1 : 0;
  const g = new Game({seed});
  g.start();
  const info = setupNavScenario(g, id, {mode});
  const [blue, red] = g.fighters;
  const dt = C.test.step, steps = Math.round(seconds / dt);
  let wallTicks = 0, jumps = 0, wasAir = false, reachedAt = null, minDist = Infinity, tackles = 0, tacklesOutOfReach = 0, path = 0, last = {x: red.position.x, z: red.position.z}, hitAt = null;
  const trace = [];
  for (let t = 0; t < steps; t++) {
    const before = {x: red.position.x, z: red.position.z};
    const stamina0 = red.action?.kind;
    g.step(emptyCommand(), undefined);
    if (g.phase === 'result') break;
    const cmd = g.lastCommands?.[1];
    const moved = Math.hypot(red.position.x - before.x, red.position.z - before.z) / dt;
    if (cmd && Math.hypot(cmd.move.x, cmd.move.z) > .5 && moved < 1 && !red.flight && !red.action) wallTicks++;
    if (red.flight && !wasAir) jumps++;
    wasAir = !!red.flight;
    if (red.action?.kind === 'tackle' && stamina0 !== 'tackle') {
      tackles++;
      const dh = Math.abs((red.groundY ?? 0) - (blue.groundY ?? 0));
      if (dh > C.extras.nav.attackMaxHeightDiff) tacklesOutOfReach++;
    }
    path += Math.hypot(red.position.x - last.x, red.position.z - last.z);last = {x: red.position.x, z: red.position.z};
    const d = Math.hypot(red.position.x - blue.position.x, red.position.z - blue.position.z), sameLevel = Math.abs((red.groundY ?? 0) + (red.flight?.y ?? 0) - (blue.groundY ?? 0)) < 1.2;
    minDist = Math.min(minDist, d);
    if (reachedAt === null && d <= 2.0 && sameLevel) reachedAt = +(t * dt).toFixed(2);
    if (hitAt === null && g.lastStepEvents?.some(e => e.result === 'impact' || e.result === 'footstool')) hitAt = +(t * dt).toFixed(2);
    if (t % 12 === 0) trace.push([+red.position.x.toFixed(2), +red.position.z.toFixed(2), +((red.groundY ?? 0) + (red.flight?.y ?? 0)).toFixed(2)]);
  }
  C.extras.nav.enableNav = prevNav;
  return {id, nav: !!nav, expect: info.scenario.expect, reachedAt, hitAt, minDist: +minDist.toFixed(2), wallSeconds: +(wallTicks * dt).toFixed(2), jumps, tackles, tacklesOutOfReach, pathLength: +path.toFixed(1), stuckCount: g.brain.nav?.stuckCount ?? 0, plans: g.brain.nav?.plans ?? 0, status: g.brain.nav?.status ?? 'off', finalDistance: +Math.hypot(red.position.x - blue.position.x, red.position.z - blue.position.z).toFixed(2), trace};
}
