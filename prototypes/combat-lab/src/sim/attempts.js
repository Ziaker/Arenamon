// Diagnóstico de comandos: cada tentativa de X, C, defesa, defesa perfeita e sprint é relatada pelo PRÓPRIO controlador
// no ponto em que decide (mesmo objeto de permissão, mesma condição de stamina). Não existe um segundo conjunto de
// regras: este módulo só recebe o resultado e o descreve. Sem ouvinte instalado, nada é registrado (custo zero).
// O relato nunca altera o estado do lutador.
import {C} from './config.js';

let sink = null;
/** Instala um ouvinte (fighter, entrada) — ou null para desligar. */
export function setAttemptSink(fn) {sink = fn;}
/** Executa `body` com um ouvinte temporário (usado pelas reexecuções sem renderização). */
export function withAttemptSink(fn, body) {const prev = sink;sink = fn;try {return body();} finally {sink = prev;}}
export const attemptsActive = () => !!sink;
export function report(f, entry) {
  if (!sink) return;
  const a = f.action;
  sink(f, {fighter: f.id, state: f.state, action: a?.kind ?? null, actionElapsed: a ? +a.elapsed.toFixed(4) : null, stamina: +f.stamina.toFixed(4), ...entry});
}

const KIND = {tackle: 'X', dodge: 'C', guard: 'Defesa', perfectGuard: 'Defesa perfeita', sprint: 'Sprint', cancel: 'C → X'};
const ms = s => `${Math.round(s * 1000)} ms`, n2 = v => Number(v).toFixed(2).replace('.', ',');
/** Motivos (código → frase). Cada código corresponde a uma condição avaliada no controlador. */
export const REASONS = {
  disabled: () => 'sistema desligado (Ajustes › Sistemas)',
  airborne: () => 'personagem no ar (lançado)',
  recovery: d => `recuperação ativa (${ms(d.left)} restantes)`,
  defeated: () => 'personagem derrotado',
  stamina: d => `stamina insuficiente (${n2(d.value)} / ${n2(d.required)})`,
  exhausted: d => `exausto até recuperar toda a stamina (${n2(d.value)} / ${n2(d.refill)})`,
  guardBlocks: () => 'indisponível durante a defesa',
  cancelWindow: d => d.elapsed < d.open[0] ? `fora da janela de cancelamento (abre em ${ms(d.open[0] - d.elapsed)})` : `fora da janela de cancelamento (fechou há ${ms(d.elapsed - d.open[1])})`,
  cancelDisabled: () => 'cancelamento C → X desligado',
  selfCancelX: () => 'X não cancela o próprio X',
  selfCancelC: d => `C só cancela C nos últimos ${ms(d.window)} da esquiva (faltam ${ms(d.from - d.elapsed)})`,
  recoil: d => `recuo ativo (${ms(d.left)} restantes)`,
  chain: d => `ação em curso ainda não pode ser substituída (${ms(d.left)} restantes)`,
  guardStun: d => `guard stun ativo (${ms(d.left)} restantes)`,
  hitstop: () => 'congelamento de impacto (hitstop)',
  tackleNoGuard: () => 'a defesa não cancela o tackle (só um toque de defesa perfeita disponível)',
  perfectCooldown: d => `defesa perfeita em recarga (${ms(d.left)} restantes)`,
  sprintStamina: d => `stamina abaixo do mínimo do sprint (${n2(d.value)} / ${n2(d.required)})`,
};
const RESULT = {denied: 'ignorado', buffered: 'guardado no buffer', expired: 'buffer expirou', executed: 'executado', partial: 'executado'};
/** Frase curta: “X ignorado: stamina insuficiente (0,60 / 1,00)”. */
export function describe(e) {
  const k = e.kind === 'tackle' && e.viaCancel ? KIND.cancel : KIND[e.kind] ?? e.kind;
  if (e.result === 'executed') return `${k} executado${e.fromBuffer ? ' (do buffer)' : ''}${e.viaCancel && e.kind === 'tackle' ? '' : ''}${e.note ? ` · ${e.note}` : ''}`;
  const why = e.reason ? (REASONS[e.reason]?.(e.detail || {}) ?? e.reason) : '';
  if (e.kind === 'tackle' && e.viaCancel && e.result === 'denied') return `C → X negado: ${why}`;
  return `${k} ${RESULT[e.result] ?? e.result}${why ? ': ' + why : ''}`;
}
/** Valor atual × exigido, quando a condição for numérica (para tabelas e relatórios). */
export function condition(e) {
  const d = e.detail || {};
  if ('value' in d && 'required' in d) return {current: d.value, required: d.required};
  if ('left' in d) return {current: d.left, required: 0, unit: 's'};
  if (e.reason === 'cancelWindow') return {current: d.elapsed, required: d.open, unit: 's'};
  return null;
}
export const bufferWindow = () => C.actions.buffer.window;
