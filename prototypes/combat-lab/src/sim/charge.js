// @ts-check
// Movimentos de CARGA (Charge): segurar o botão do slot para carregar, soltar para executar (Reflect e Psyshock, M1–M30).
// Este módulo só tem a parte PURA (parâmetros capturados, níveis de Power Level, penalidades e aceleração de recarga);
// as decisões de permissão e o estado do lutador ficam no controlador (controller.js), como nas demais ações.
//
// Contrato M28.4 (D1): ao APERTAR o botão, o controlador captura `chargeParams(def)` — uma cópia congelada de `C.world.charge`
// (valores provisórios, M30.10) com as substituições da própria definição (`def.charge`). Nada depois lê `C` para esse uso:
// ajustar um slider durante a carga não altera aquele uso, só os próximos.
import {C} from './config.js';

/** Congela um objeto simples recursivamente. */
const deepFreeze = (/** @type {any} */ o) => {for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);return Object.freeze(o);};
/** Campos de `def.charge` que podem substituir os valores compartilhados de `C.world.charge`. */
export const CHARGE_OVERRIDES = ['moveSlow', 'turnSlow', 'dodgeCancelAfter', 'interruptCooldownFactor', 'recovery', 'bufferWindow', 'boostStaminaPerSecond', 'boostStep'];

/**
 * Instantâneo congelado dos parâmetros de um uso. Tempos em segundos e também em PASSOS inteiros (contagem de passos evita
 * erro de arredondamento nos marcos de Power Level: M30.10).
 * @param {import('./types').MoveDef} def
 */
export function chargeParams(def) {
  const base = C.world.charge, over = def.charge ?? {}, step = C.test.step;
  /** @type {Record<string, any>} */
  const p = {};
  for (const k of CHARGE_OVERRIDES) p[k] = over[k] ?? base[k];
  p.max = over.max ?? 4;
  p.min = over.min ?? over.minCharge ?? 0;
  p.step = step;
  p.maxTicks = Math.round(p.max / step);
  p.minTicks = Math.round(p.min / step);
  p.pl2Ticks = Math.round(p.maxTicks / 2);          // PL2 a partir de 50% da carga (M19.1): 2,0 s para a carga de 4 s
  p.dodgeLockTicks = Math.round(p.dodgeCancelAfter / step);
  p.bufferTicks = Math.round(p.bufferWindow / step);
  p.recoveryTicks = Math.round(p.recovery / step);
  // Referências lógicas do corpo (M30.4) e, se a definição nomear um grupo (ex.: 'reflect'), uma cópia congelada dele (M28.4).
  p.body = Object.freeze({halfExtent: C.test.halfExtent, height: C.extras.visual.bodyHeight});
  if (over.group) p.group = deepFreeze(structuredClone(C.world[over.group]));
  return Object.freeze(p);
}

/**
 * Power Level pelo tempo carregado (M18.9/M19.1): PL1 abaixo de 50% da carga; PL2 de 50% até antes de 100%; PL3 na carga máxima.
 * @param {number} ticks passos carregados
 * @param {{maxTicks: number, pl2Ticks: number}} params
 */
export function chargeLevel(ticks, params) {return ticks >= params.maxTicks ? 3 : ticks >= params.pl2Ticks ? 2 : 1;}

/**
 * Recarga aplicada numa interrupção ou cancelamento (M7.3/M16.1): metade da recarga normal. O custo de stamina NÃO é devolvido.
 * @param {import('./types').MoveDef} def
 * @param {{interruptCooldownFactor: number}} params
 */
export const interruptCooldown = (def, params) => (def.cooldown ?? 0) * params.interruptCooldownFactor;

/**
 * Aceleração manual de recarga (M2.3/M5.8/M16.8): cada novo toque gasta stamina para encurtar a recarga em até `boostStep` segundos;
 * custo proporcional quando resta menos que isso (ex.: 0,4 s restantes custam 0,2 de stamina).
 * @param {number} cooldownLeft segundos de recarga restantes
 * @param {{boostStep: number, boostStaminaPerSecond: number}} params
 */
export function boostPlan(cooldownLeft, params) {
  const reduce = Math.min(params.boostStep, cooldownLeft);
  return {reduce, cost: reduce * params.boostStaminaPerSecond};
}
