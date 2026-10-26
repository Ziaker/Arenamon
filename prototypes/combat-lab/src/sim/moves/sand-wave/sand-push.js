// @ts-check
// Política do EMPURRÃO do Sand Wave, isolada da onda e do VFX.
// A duração do empurrão é POR ALVO: começa no primeiro contato e, por padrão, termina com a BARRAGEM
// (`active + dissipate`), não no fim da janela de dano. O alvo também precisa continuar dentro do retângulo:
// sair da área encerra a força imediatamente (política oficial). Modos alternativos permitem experimentar
// duração fixa, contato contínuo ou a janela de dano legada.
// Este módulo é PURO (só matemática): o `sand.js` aplica a política na simulação, o controlador integra a
// velocidade com `applySandPushStep` e o Editor usa as mesmas funções nos gráficos A/B.
import {dot} from '../../math.js';

/** Modos de duração (o valor numérico é o que mora no JSON/C.world). */
export const PUSH_DURATION_MODES = Object.freeze([
  {value: 0, label: 'Fim da barragem (active + dissipate)', short: 'barragem'},
  {value: 1, label: 'Tempo desde o contato', short: 'desde-contato'},
  {value: 2, label: 'Enquanto houver contato', short: 'contato'},
  {value: 3, label: 'Janela de dano (legado)', short: 'legado'},
]);
/** Modos de aceleração. */
export const PUSH_ACCEL_MODES = Object.freeze([
  {value: 0, label: 'Aceleração constante', short: 'constante'},
  {value: 1, label: 'Curva temporal (desacelerando)', short: 'curva'},
  {value: 2, label: 'Velocidade-alvo', short: 'alvo'},
]);

/** Motivos de início/fim do empurrão (texto curto para a interface e para os testes). */
export const PUSH_REASON_LABELS = Object.freeze({
  barrageEnded: 'Fim da barragem (active + dissipate)',
  activeWindowEnded: 'Fim da janela de dano (active, modo legado)',
  durationElapsed: 'Duração configurada cumprida',
  leftContact: 'Saiu do contato enquanto a onda pedia contato',
  leftArea: 'Saiu do retângulo e a tolerância expirou',
  releaseGrace: 'Tolerância de perda de contato',
  airborne: 'Alvo saiu do chão (sem alvos aéreos)',
  verticalOut: 'Alvo saiu da faixa vertical da onda',
  wallStagger: 'Stagger de parede interrompeu',
  recovery: 'Recuperação/stun interrompeu',
  targetGone: 'Alvo morreu ou saiu',
  perfectGuard: 'Defesa perfeita/counter anulou',
  superseded: 'Outra onda mais forte assumiu o alvo',
  waveGone: 'Onda encerrada',
  inactive: 'Empurrão inativo',
});

/** Normaliza o modo de duração (0..3). */
export function pushDurationModeOf(/** @type {any} */ e) {
  return Math.max(0, Math.min(3, Math.round(e.pushDurationMode ?? 0)));
}
/** Normaliza o modo de aceleração (0..2). */
export function pushAccelModeOf(/** @type {any} */ e) {
  return Math.max(0, Math.min(2, Math.round(e.pushAccelerationMode ?? 0)));
}

/**
 * Duração-alvo do empurrão a partir do primeiro contato, em segundos.
 * Infinity = sem limite próprio (a política de contato/janela decide).
 * @param {any} e entidade sandwave (parâmetros capturados no disparo)
 * @param {number} firstAt idade do primeiro contato
 * @returns {number}
 */
export function pushDurationFor(/** @type {any} */ e, /** @type {number} */ firstAt) {
  const configured = Math.max(0, e.pushDuration ?? 0);
  const mode = pushDurationModeOf(e);
  const untilActive = Math.max(0, (e.active ?? 0) - firstAt);
  const life = Number.isFinite(e.life) ? e.life : (e.active ?? 0) + (e.dissipate ?? 0);
  const untilBarrage = Math.max(0, life - firstAt);
  const continueAfter = (e.pushContinueAfterActive ?? 0) !== 0;
  // 0 (PADRÃO OFICIAL): a força acompanha a existência da barragem. `pushDuration` só a antecipa (limite máximo);
  // nunca a prolonga além de `life`, porque o alvo também precisa estar dentro do retângulo.
  if (mode === 0) return configured > 0 ? Math.min(configured, untilBarrage) : untilBarrage;
  // 1: duração fixa desde o contato; se 0, acompanha o resto da barragem.
  if (mode === 1) return configured > 0 ? configured : untilBarrage;
  // 2: enquanto houver contato; `pushDuration` é apenas um teto opcional.
  if (mode === 2) return configured > 0 ? configured : Infinity;
  // 3 (LEGADO): janela de dano. `pushContinueAfterActive` libera a força depois de `active` (e a vida é estendida).
  return configured > 0 ? configured : (continueAfter ? Infinity : untilActive);
}

/**
 * Calcula a janela do empurrão na idade atual.
 * `flags` vem do passo real (contato, ar, parede, recuperação) e `t` é o estado POR ALVO.
 * @param {any} e
 * @param {any} t
 * @param {number} age
 * @param {{contact?: boolean, airborne?: boolean, verticalOut?: boolean, pinned?: boolean, recovering?: boolean, alive?: boolean}} [flags]
 * @returns {{on: boolean, reason: string | null, mode: number, duration: number, elapsed: number, remaining: number, lostFor: number}}
 */
export function pushWindowState(/** @type {any} */ e, /** @type {any} */ t, /** @type {number} */ age, /** @type {Record<string, any>} */ flags = {}) {
  const mode = pushDurationModeOf(e);
  const first = t.firstAt ?? age;
  const duration = pushDurationFor(e, first);
  const elapsed = Math.max(0, age - first);
  const lostFor = Math.max(0, age - (t.lastContactAt ?? first));
  const base = {on: false, reason: /** @type {string | null} */ (null), mode, duration, elapsed, remaining: Number.isFinite(duration) ? Math.max(0, duration - elapsed) : Infinity, lostFor};
  if (flags.alive === false) return {...base, reason: 'targetGone'};
  if (t.perfect || t.riposte) return {...base, reason: 'perfectGuard'};
  // PADRÃO OFICIAL: a barragem existe até `life` (active + dissipate). O empurrão termina nesse instante,
  // mesmo que a janela de dano (`active`) já tenha acabado. Modos 1/2 são independentes de `active`; o modo 3
  // reproduz a política legada que parava em `active`.
  if (mode === 0 && age >= (Number.isFinite(e.life) ? e.life : ((e.active ?? 0) + (e.dissipate ?? 0))) - 1e-9) return {...base, reason: 'barrageEnded'};
  if (mode === 3 && !(e.pushContinueAfterActive ?? 0) && age > (e.active ?? 0) + 1e-9) return {...base, reason: 'activeWindowEnded'};
  if (Number.isFinite(duration) && elapsed > duration + 1e-9) return {...base, reason: 'durationElapsed'};
  if (flags.airborne) return {...base, reason: 'airborne'};
  if (flags.verticalOut) return {...base, reason: 'verticalOut'};
  const inside = flags.inside ?? (flags.contact !== false);
  // No modo oficial (0), depois do primeiro acerto basta o alvo continuar DENTRO do retângulo. Não exigimos que a
  // frente da onda esteja atrás dele: o alvo empurrado pode ultrapassar a frente e ainda estar na área.
  const contact = mode === 0 ? inside : flags.contact !== false;
  if (!contact) {
    const grace = Math.max(0, e.pushReleaseDelay ?? 0);
    const outside = !inside;
    // `pushContinuesOutsideArea` só vale para SAIR do retângulo. Ficar dentro, mas à frente da frente da onda,
    // é perda de contato nos modos 1/2 e não deve ser mascarado por essa política.
    const keeps = (outside && (e.pushContinuesOutsideArea ?? 0) !== 0) || lostFor <= grace + 1e-9;
    if (!keeps) return {...base, reason: mode === 2 || !outside ? 'leftContact' : 'leftArea'};
  }
  if (flags.pinned && !(e.pushContinuesDuringStagger ?? 1)) return {...base, reason: 'wallStagger'};
  if (flags.recovering && !(e.pushContinuesDuringStagger ?? 1)) return {...base, reason: 'recovery'};
  return {...base, on: true, reason: contact ? null : 'releaseGrace'};
}

/**
 * Aceleração efetiva deste passo. A defesa parcial multiplica SÓ o empurrão; modos alternativos
 * (curva/velocidade-alvo) são experimentais e ficam explícitos na ficha.
 * @param {any} e
 * @param {any} t
 * @param {any} f alvo (para ler a velocidade atual no modo velocidade-alvo)
 * @param {number} age
 * @returns {number}
 */
export function pushAccelNow(/** @type {any} */ e, /** @type {any} */ t, /** @type {any} */ f, /** @type {number} */ age) {
  const base = Math.max(0, e.accel ?? 0) * (t.partial ? (e.partialFactor ?? 0.5) : 1);
  const mode = pushAccelModeOf(e);
  if (base <= 0) return 0;
  if (mode === 1) {
    const first = t.firstAt ?? age;
    const duration = pushDurationFor(e, first);
    const span = Number.isFinite(duration) && duration > 1e-9 ? duration : Math.max(1e-9, e.active ?? 0);
    const u = Math.min(1, Math.max(0, (age - first) / span));
    const power = Math.max(0, e.pushCurvePower ?? 1);
    return base * Math.pow(1 - u, power);
  }
  if (mode === 2) {
    const target = Math.max(0, e.pushTargetSpeed ?? 0);
    const ramp = Math.max(1e-3, e.pushRampTime ?? 0.2);
    const along = dot(f.locomotionVelocity ?? {x: 0, z: 0}, e.dir);
    return Math.max(-base, Math.min(base, (target - along) / ramp));
  }
  return base;
}

/**
 * Integra UM passo de empurrão na velocidade de locomoção. Usado pelo controlador real e pelo
 * simulador do Editor, para que gráfico e jogo não divirjam.
 * @param {any} f
 * @param {number} dt
 * @returns {boolean}
 */
export function applySandPushStep(/** @type {any} */ f, /** @type {number} */ dt) {
  const p = f.sandPush;
  if (!p) return false;
  const dir = p.dir ?? {x: 0, z: 1};
  const lv = f.locomotionVelocity ?? {x: 0, z: 0};
  let v = {x: lv.x + dir.x * (p.accel ?? 0) * dt, z: lv.z + dir.z * (p.accel ?? 0) * dt};
  const max = Math.max(0, p.maxSpeed ?? 0);
  if (max > 0) {
    const along = dot(v, dir);
    if (along > max) v = {x: v.x - dir.x * (along - max), z: v.z - dir.z * (along - max)};
  }
  f.locomotionVelocity = v;
  return true;
}

/** Rótulo legível de um motivo (a interface nunca mostra a chave crua). */
export function pushReasonLabel(/** @type {string | null} */ reason) {
  if (!reason) return '—';
  const labels = /** @type {Record<string, string>} */ (PUSH_REASON_LABELS);
  return labels[reason] ?? reason;
}
