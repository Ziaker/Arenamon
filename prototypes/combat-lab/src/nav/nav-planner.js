// @ts-check
// Fase 3 (Yuka): planejamento e orientação de deslocamento. NÃO move ninguém: devolve apenas uma intenção
// (direção desejada + pedido de salto) que o controlador do Arenamon executa pelas mesmas regras de física.
// Estado do planejador é JSON puro (vai no save/replay da Brain, sem referências ao grafo).
import {C} from '../sim/config.js';
import {getNavGraph} from './nav-graph.js';

export const NAV_STATE0 = () => ({path: [], i: 0, goal: -1, status: 'idle', age: 0, replanIn: 0, lastX: 0, lastZ: 0, stuckT: 0, stuckCount: 0, jumpCool: 0, plans: 0, hold: false});

const cfg = () => Object.assign({replan: .4, arrival: .55, launch: 1.5, stuckTime: .8, stuckDistance: .12, attackMaxHeightDiff: .8}, C.extras.nav ?? {});
const supportY = f => f.groundY ?? 0;

/** Há linha reta caminhável de a até b, no mesmo nível, sem sólidos no caminho? */
export function directlyReachable(nav, a, b) {
  const ya = supportY(a), yb = supportY(b);
  if (Math.abs(ya - yb) > nav.p.stepTol + .1) return false;
  return nav.clearLine(a.position.x, a.position.z, b.position.x, b.position.z, ya, null, .75, .95);
}

/**
 * Passo de navegação de um lutador.
 * @param {{self:any,target:any,mapState:any,state:any,dt:number}} a
 * @returns {{move:{x:number,z:number}|null, jump:boolean, jumpHeld:boolean, status:string, blockAttack:boolean, hold:boolean, nextNode:number}}
 */
export function navStep({self, target, mapState, state, dt}) {
  const K = cfg(), nav = getNavGraph(mapState);
  const px = self.position.x, pz = self.position.z, py = supportY(self);
  state.age += dt;state.replanIn -= dt;state.jumpCool = Math.max(0, state.jumpCool - dt);
  const airborne = !!self.flight;
  const dh = Math.abs(supportY(target) - py);
  const direct = directlyReachable(nav, self, target);
  // Caminho livre e alturas compatíveis: a IA atual decide sozinha (nenhuma interferência).
  if (direct && !airborne) {
    state.status = 'direct';state.path = [];state.i = 0;state.stuckT = 0;state.hold = false;
    return {move: null, jump: false, jumpHeld: false, status: 'direct', blockAttack: false, hold: false, nextNode: -1};
  }
  // Replanejamento periódico (nunca no meio do salto, para não trocar de alvo no ar).
  if (!airborne && (state.replanIn <= 0 || !state.path.length)) replan(nav, state, self, target, K);
  const path = state.path;
  if (!path.length) {
    state.status = 'noPath';
    return {move: null, jump: false, jumpHeld: false, status: 'noPath', blockAttack: dh > K.attackMaxHeightDiff || !direct, hold: false, nextNode: -1};
  }
  // Avança pelos nós já alcançados. Nó de salto/queda só conta como alcançado quando o lutador já está no nível dele.
  while (state.i < path.length - 1) {
    const n = nav.nodes[path[state.i]], info = state.i > 0 ? nav.edgeInfo(path[state.i - 1], path[state.i]) : null;
    const reached = Math.hypot(n.x - px, n.z - pz) <= K.arrival && (!info || info.type === 'walk' || (!airborne && Math.abs(py - n.y) <= .3));
    if (reached) state.i++; else break;
  }
  // Suavização de caminho (só em trechos de caminhada): se o próximo nó está em linha livre, corta o canto.
  if (!airborne && state.i < path.length - 1) {
    const nxt = nav.nodes[path[state.i + 1]], e = nav.edgeInfo(path[state.i], path[state.i + 1]), cur = nav.nodes[path[state.i]];
    if (e?.type === 'walk' && Math.abs(py - nxt.y) <= .3 && Math.abs(py - cur.y) <= .3 && nav.clearLine(px, pz, nxt.x, nxt.z, py, cur.surface === 'ground' ? null : cur.surface)) state.i++;
  }
  const node = nav.nodes[path[state.i]], edge = state.i > 0 ? nav.edgeInfo(path[state.i - 1], path[state.i]) : nav.edgeInfo(nav.nearest(px, pz, py).index, path[state.i]);
  const dx = node.x - px, dz = node.z - pz, dist = Math.hypot(dx, dz);
  const atGoal = state.i === path.length - 1 && dist <= K.arrival;
  let move = dist > 1e-4 ? {x: dx / dist, z: dz / dist} : {x: 0, z: 0}, jump = false, jumpHeld = false;
  // Salto explícito: aresta de subida, lutador no chão e perto o bastante do ponto de decolagem.
  const jumpEdge = edge?.type === 'jump';
  if (jumpEdge) {
    jumpHeld = airborne || dist < K.launch + .5;
    if (!airborne && !self.action && dist <= K.launch && Math.abs(py - node.y) > .25 && state.jumpCool <= 0) {jump = true;jumpHeld = true;state.jumpCool = .5;}
  }
  // Detecção de travamento: quer andar mas o corpo não sai do lugar (parede/quina) → penaliza a aresta e replaneja.
  if (!airborne) {
    state.stuckT += dt;
    if (state.stuckT >= K.stuckTime) {
      const moved = Math.hypot(px - state.lastX, pz - state.lastZ);
      if (moved < K.stuckDistance && !atGoal && !self.action && self.knockRecovery <= 0) {
        const cur = path[state.i], prev = state.i > 0 ? path[state.i - 1] : nav.nearest(px, pz, py).index;
        nav.penalize(prev, cur);state.stuckCount++;state.replanIn = 0;
      }
      state.stuckT = 0;state.lastX = px;state.lastZ = pz;
    }
  }
  const unreachable = state.status === 'unreachable';
  state.hold = unreachable && atGoal;
  // Alvo fora de alcance (altura incompatível ou sem rota): não ataca no vazio.
  const blockAttack = dh > K.attackMaxHeightDiff || !direct;
  return {move: state.hold ? {x: 0, z: 0} : move, jump, jumpHeld, status: state.status, blockAttack, hold: state.hold, nextNode: path[state.i]};
}

/** Planeja uma rota até o alvo; se o alvo for inalcançável vai ao ponto alcançável mais próximo dele. */
function replan(nav, state, self, target, K) {
  const src = nav.nearest(self.position.x, self.position.z, supportY(self)).index, dstNode = nav.nearest(target.position.x, target.position.z, supportY(target)).index;
  const reach = nav.reachableFrom(src);
  let goal = dstNode, status = 'path';
  if (!reach.has(dstNode)) {
    // Ponto alcançável que mais se aproxima do alvo (a diferença de altura pesa: não vale ficar embaixo de uma plataforma alta?
    // vale — é o mais perto possível — mas 3D evita escolher outra superfície alta sem relação).
    let best = Infinity;
    for (const i of reach) {
      const n = nav.nodes[i], d = (n.x - target.position.x) ** 2 + (n.z - target.position.z) ** 2 + ((n.y - supportY(target)) * 1.5) ** 2;
      if (d < best) {best = d;goal = i;}
    }
    status = 'unreachable';
  }
  const p = nav.path(src, goal);
  state.path = p ?? [];state.i = 0;state.goal = goal;state.status = p ? status : 'noPath';state.replanIn = K.replan;state.plans++;
  state.lastX = self.position.x;state.lastZ = self.position.z;state.stuckT = 0;
  if (p && p.length > 1) state.i = 1;   // o nó 0 é onde já estamos
}
