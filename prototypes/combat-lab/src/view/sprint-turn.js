// @ts-check
// Sprint em qualquer direção com um único clipe de sprint para a frente (pedido de 31/10/2026, ideia 3 do brainstorm do Eggo).
// SÓ VISUAL: o corpo (pernas e quadril) gira para onde o personagem corre e o tronco/cabeça torcem de volta para o rival.
// Passando do ângulo de «costas», o tronco solta e só a cabeça olha por cima do ombro. Nada aqui toca a simulação.
// Vale só para quem NÃO tem clipe próprio de sprint para trás/esquerda/direita: quem tem continua como sempre.
import {C} from '../sim/config.js';
import {angleOf, angleDelta, length} from '../sim/math.js';

const D = Math.PI / 180;
const clamp = (/** @type {number} */ v, /** @type {number} */ lo, /** @type {number} */ hi) => Math.max(lo, Math.min(hi, v));
const DIRS = ['sprint_back', 'sprint_left', 'sprint_right'];

/**
 * Divide o giro em corpo, tronco e cabeça (rad). Pura (testável).
 * body: giro do corpo rumo à corrida · torso/head: quanto tronco e cabeça voltam para o rival (somados, desfazem o giro do corpo
 * até os limites). Acima de backAngle o tronco solta em 20° e a cabeça olha para trás até headMax.
 * @param {number} body giro atual do corpo (rad, + = para a esquerda do rosto, convenção de angleDelta)
 * @param {{torsoMax: number, headMax: number, backAngle: number}} lim limites em graus
 */
export function splitSprintTurn(body, lim) {
  const back = clamp((Math.abs(body) - lim.backAngle * D) / (20 * D), 0, 1);
  const torso = clamp(-body, -lim.torsoMax * D, lim.torsoMax * D) * (1 - back);
  const head = clamp(-body - torso, -lim.headMax * D, lim.headMax * D);
  return {body, torso, head};
}

/** O personagem corre em qualquer direção com o clipe de sprint para a frente? (opção ligada, tem sprint e não tem os direcionais) */
export function sprintUsesTurn(/** @type {any} */ char) {
  const S = C.extras.sprintTurn;
  return !!S?.sprintTurnOn && char.variantsOf('sprint').length > 0 && DIRS.every(id => !char.variantsOf(id).length);
}

/**
 * Atualiza o giro do personagem neste quadro e devolve {torso, head} para a camada de pose (ou null quando não há nada a torcer).
 * O giro do corpo fica em char.sprintTurn.body (somado ao giro visual do corpo em characters.js).
 * @param {any} char @param {any} f lutador (só leitura) @param {number} dt
 */
export function updateSprintTurn(char, f, dt) {
  const S = C.extras.sprintTurn, st = char.sprintTurn ??= {body: 0, torso: 0, head: 0};
  const on = !!S?.sprintTurnOn && !!f.sprinting && char.current?.key === 'sprint' && length(f.velocity) > .15 && sprintUsesTurn(char);
  const target = on ? angleDelta(f.visualFacing, angleOf(f.velocity)) : 0;
  // Pernas giram no máximo sprintTurnLegRate °/s (sem estalo ao trocar de direção); pelo caminho mais curto.
  const step = (S?.sprintTurnLegRate ?? 540) * D * Math.max(0, dt), diff = angleDelta(st.body, target);
  st.body = Math.abs(diff) <= step ? target : st.body + Math.sign(diff) * step;
  st.body = Math.atan2(Math.sin(st.body), Math.cos(st.body));
  const sp = splitSprintTurn(st.body, {torsoMax: S?.sprintTurnTorsoMax ?? 60, headMax: S?.sprintTurnHeadMax ?? 45, backAngle: S?.sprintTurnBackAngle ?? 110});
  st.torso = sp.torso;st.head = sp.head;
  return Math.abs(st.body) > 1e-3 ? {torso: st.torso, head: st.head} : null;
}
