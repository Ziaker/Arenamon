// @ts-check
// Reflect — Move de carga (categoria Charge, tipo Field), tecla padrão A (M1–M30). Ao SOLTAR, materializa uma barreira fina,
// vertical e refletora diante do personagem. Este arquivo tem a definição (dados) e o efeito de materialização; a reflexão,
// a destruição por Tackle/explosão e a proteção contra explosões estão em world.js (reflectPass, breakByTackle, breakBarriers,
// shieldedFromBlast). Valores numéricos: C.world.reflect — PROVISÓRIOS (M30.10), capturados ao apertar o botão (M28.4, D1).
import {C} from '../config.js';
import {spawn} from '../world.js';
import {rectsOverlap} from '../geometry.js';
import {add, scale, direction} from '../math.js';

/** Definição do movimento (dados puros, clonável). */
export const reflectDef = Object.freeze({
  id: 'reflect', name: 'Reflect',
  description: 'Carregue por no mínimo 1,5 s e solte para criar uma barreira que reflete projéteis. Quanto mais carga, maior e mais duradoura; ela é sólida para os dois lutadores.',
  cost: 1, cooldown: 8, cooldownBoost: true,
  charge: {max: 4, min: 1.5, group: 'reflect'},
  timeline: [{effect: 'reflect'}],
});

/**
 * A caixa cabe? Dentro da arena e sem sobrepor paredes, barreiras sólidas não refletoras nem lutadores (M13.6, M26s.3, M8.7).
 * @param {any} game @param {any} rect @param {{halfExtent: number}} body
 */
function fits(game, rect, body) {
  const bound = C.test.arenaHalf;
  const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
    const c = Math.cos(rect.angle), s = Math.sin(rect.angle), u = a * rect.hx, v = b * rect.hz;
    return {x: rect.pos.x + u * c + v * s, z: rect.pos.z - u * s + v * c};
  });
  if (cs.some(p => Math.abs(p.x) > bound + 1e-9 || Math.abs(p.z) > bound + 1e-9)) return false;
  for (const e of game.world.entities) {
    if (e.dead || e.shape !== 'box' || e.reflect) continue;
    if ((e.kind === 'wall' || (e.kind === 'barrier' && e.blocksFighters)) && rectsOverlap(rect, e)) return false;
  }
  for (const o of game.fighters) {
    if (o.hp <= 0) continue;
    if (rectsOverlap(rect, {pos: o.position, angle: 0, hx: body.halfExtent, hz: body.halfExtent})) return false;
  }
  return true;
}

/**
 * Onde e com que tamanho a barreira nasce (também serve à prévia). Largura 1,5×–3× e altura 1,5×–2,5× das dimensões LÓGICAS do motor
 * (M30.4), crescendo LINEARMENTE com a carga (curva não aprovada: provisória); distância livre de 50% da profundidade; base na
 * superfície de apoio. Se o tamanho desejado não cabe, usa o maior retângulo válido sem passar do mínimo; sem espaço, falha.
 * @param {any} game @param {any} f @param {Record<string, any>} P parâmetros capturados do uso @param {number} fraction carga de 0 a 1 @param {number} heading
 */
export function reflectPlacement(game, f, P, fraction, heading) {
  const G = P.group, B = P.body, t = Math.max(0, Math.min(1, fraction));
  const widthRef = 2 * B.halfExtent, depthRef = 2 * B.halfExtent, heightRef = B.height;
  const wantW = (G.widthMin + (G.widthMax - G.widthMin) * t) * widthRef, minW = G.widthMin * widthRef;
  const height = (G.heightMin + (G.heightMax - G.heightMin) * t) * heightRef;
  const center = add(f.position, scale(direction(heading), B.halfExtent + G.gapFraction * depthRef + G.thickness / 2));
  const rectOf = (/** @type {number} */ w) => ({pos: center, angle: heading, hx: w / 2, hz: G.thickness / 2});
  const ok = (/** @type {number} */ w) => fits(game, rectOf(w), B);
  let width = wantW;
  if (!ok(wantW)) {
    if (!ok(minW)) return {ok: false, reason: 'semEspaco'};
    let lo = minW, hi = wantW;
    for (let i = 0; i < 32; i++) {const mid = (lo + hi) / 2;if (ok(mid)) lo = mid;else hi = mid;}
    width = lo;
  }
  return {ok: true, center, width, height, base: f.flight?.y ?? 0, thickness: G.thickness, heading};
}

/** Efeito de materialização (soltar o botão): cria a barreira ou falha com motivo (o jogo devolve a stamina). */
export function reflectEffect(/** @type {any} */ game, /** @type {any} */ f, /** @type {any} */ def, /** @type {any} */ fx) {
  const ch = fx.charge;
  if (!ch) return {ok: false, reason: 'semCarga'};
  const P = ch.params, G = P.group;
  if (ch.seconds < (G?.minCharge ?? def?.charge?.min ?? 1.5) - 1e-4) return {ok: false, reason: 'semCargaMinima'};
  const place = /** @type {any} */ (reflectPlacement(game, f, P, ch.ticks / P.maxTicks, fx.heading));
  if (!place.ok) return {ok: false, reason: place.reason};
  const duration = G.durationBase + ch.seconds;                      // 4 s + tempo carregado (M4.3): 4 a 8 s
  const e = spawn(game.world, {
    kind: 'barrier', owner: f.id, shape: 'box', pos: place.center, angle: fx.heading, hx: place.width / 2, hz: G.thickness / 2, y: place.base, height: place.height,
    life: duration, hp: Infinity, blocksProjectiles: true, blocksFighters: true, blocksOwner: true,
    reflect: true, shields: true, breakableByTackle: true, breakableByBlast: true, pl: ch.level,
    // Parâmetros capturados (M28.4): a barreira não lê mais C.world.reflect depois de criada.
    captured: {tieTolerance: G.tieTolerance, maxReflections: G.maxReflections, tackleRecoil: G.tackleRecoil, tackleStagger: G.tackleStagger, width: place.width, height: place.height, thickness: G.thickness, duration, level: ch.level, move: def.id},
  }, fx.events ?? []);
  return e ? {ok: true} : {ok: false, reason: 'limiteDeEntidades'};
}
