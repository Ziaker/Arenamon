// Agendador de tempo do clipe (Loop avançado do editor de animações): módulo PURO (sem DOM, sem three.js) para ser
// testado em Node. Recebe o tempo decorrido (em segundos de clipe já multiplicados pela velocidade base) e a
// configuração resolvida (recorte e laço central em SEGUNDOS, velocidades por trecho, pausas, intervalo entre
// repetições, easings e fase) e devolve o tempo do clipe, se está travado numa pausa/intervalo, se a execução única
// terminou e o progresso da janela de emenda do laço.
//
// Modelo: o clipe é dividido em introdução [trimStart..loopStart), ciclo [loopStart..loopEnd] e saída (loopEnd..trimEnd].
// Sem laço central configurado (o laço cobre o recorte inteiro) NÃO há trechos separados: o clipe inteiro é um único
// ciclo à velocidade normal (degenera no comportamento clássico) — mas pausas, intervalo, fase e emenda continuam valendo.
//
// Emenda do laço (loopCrossfade): os primeiros `loopCrossfade` segundos do ciclo [loopStart..loopStart+loopCrossfade]
// são tocados por uma SEGUNDA action do mesmo clipe (mixer dedicado em characters.js) durante a janela de emenda, com
// peso rampando; a action principal toca o ciclo deslocado [loopStart+loopCrossfade..loopEnd]. Assim, no instante do
// laço, a pose da action principal (que recomeça em loopStart+loopCrossfade) é EXATAMENTE a pose em que a segunda
// action parou — a mistura é contínua (sem salto), para qualquer peso da emenda.
import {trimOf, loopRange, easeCurve} from '../sim/animation-profile.js';

/** Campos novos de loopagem (FIELDS em animation-profile.js). */
export const LOOP_FIELD_IDS = ['loopStartTime', 'loopEndTime', 'introSpeed', 'cycleSpeed', 'outroSpeed',
  'cyclePauseStart', 'cyclePauseEnd', 'repeatGap', 'loopCrossfade', 'loopCrossfadeWeight',
  'entrySmooth', 'exitSmooth', 'conclusionBlend', 'loopExitDelay', 'cyclePhaseOffset'];
/** Só estes alteram o mapeamento de tempo (conclusionBlend e loopExitDelay agem fora do relógio do clipe). */
export const TIME_FIELD_IDS = LOOP_FIELD_IDS.filter(id => id !== 'conclusionBlend' && id !== 'loopExitDelay');

/**
 * Configuração resolvida do agendador para um clipe.
 * @typedef {Object} LoopCfg
 * @property {number} trimStart   Início do recorte (s, absoluto no clipe)
 * @property {number} trimEnd     Fim do recorte/cap (s)
 * @property {number} loopStart   Início do laço central (s)
 * @property {number} loopEnd     Fim do laço central (s)
 * @property {number} cycleStart  Início do ciclo EFETIVO da action principal (= loopStart + loopCrossfade)
 * @property {number} cycleLen    Duração do ciclo efetivo (= loopEnd - cycleStart)
 * @property {boolean} loop       Repetir o ciclo
 * @property {number} introSpeed  Multiplicador do trecho de introdução (1 = velocidade base)
 * @property {number} cycleSpeed  Multiplicador do ciclo
 * @property {number} outroSpeed  Multiplicador da saída
 * @property {number} cyclePauseStart  Pausa (s de jogo) travada na primeira pose do ciclo
 * @property {number} cyclePauseEnd    Pausa (s de jogo) travada na última pose do ciclo
 * @property {number} repeatGap        Intervalo (s de jogo) congelado na última pose entre repetições * @property {number} loopCrossfade    Duração (s de clipe) da janela de emenda do laço
 * @property {number} loopCrossfadeWeight  Peso da mistura da emenda (0–1)
 * @property {string} entrySmooth   Curva de easing do avanço na introdução (mesmas do blendCurve)
 * @property {string} exitSmooth    Curva de easing do avanço na saída
 * @property {number} cyclePhaseOffset  Deslocamento de fase (s de clipe) dentro do ciclo
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Monta a configuração do agendador para uma camada do Character (resolve o perfil: variante → ação; campos vazios
 * herdam). Devolve null quando nenhum campo de tempo novo está configurado (o chamador segue o caminho antigo,
 * byte a byte). `ctx` traz duration/cap/speed/loop e o modo de relógio (prévia/epílogo).
 * @param {import('./characters.js').Character} ch
 * @param {{id: string, index: number, action: object, started: number}} layer camada atual
 * @param {{duration: number, cap: number, speed: number, loop: boolean, preview: object|null, previewSpeed: number}} ctx
 */
export function loopScheduleOf(ch, layer, {duration: d, cap, speed: s, loop, preview: p, previewSpeed}) {
  const name = ch.clips[layer.index]?.name, values = {};
  // Na prévia do editor a camada tem id 'preview': os campos valem pela AÇÃO em prévia (p.action), como em profileFx — sem
  // isto os 15 controles de loopagem liam o perfil de 'preview' (inexistente) e a prévia caía no caminho clássico.
  const action = p?.action ?? layer.id;
  for (const fid of TIME_FIELD_IDS) {const v = ch.profileValue(action, fid, name);if (v !== undefined && v !== null) values[fid] = v;}
  if (!Object.keys(values).length) return null;
  const fx = ch.profileFx(layer, action), trim = fx ? trimOf(fx) : [0, 1], lrf = fx ? loopRange(fx) : trim;
  const t0 = trim[0] * d, t1 = Math.min(trim[1] * d, cap);
  let c0 = values.loopStartTime != null ? values.loopStartTime : lrf[0] * d, c1 = values.loopEndTime != null ? values.loopEndTime : lrf[1] * d;
  c0 = clamp(c0, t0, t1 - .01);c1 = clamp(c1, c0 + .01, t1);
  // Sem laço central configurado não há trechos separados: um único ciclo à velocidade normal (comportamento clássico).
  const segmented = c0 > t0 + 1e-4 || c1 < t1 - 1e-4;
  const xf = clamp(values.loopCrossfade || 0, 0, Math.max(.005, (c1 - c0) * .5));
  const cfg = {
    trimStart: t0, trimEnd: t1, loopStart: c0, loopEnd: c1, cycleStart: c0 + xf, cycleLen: c1 - c0 - xf, loop,
    introSpeed: segmented && values.introSpeed ? values.introSpeed : 1, cycleSpeed: segmented && values.cycleSpeed ? values.cycleSpeed : 1,
    outroSpeed: segmented && values.outroSpeed ? values.outroSpeed : 1,
    cyclePauseStart: values.cyclePauseStart || 0, cyclePauseEnd: values.cyclePauseEnd || 0, repeatGap: values.repeatGap || 0,
    loopCrossfade: xf, loopCrossfadeWeight: values.loopCrossfadeWeight ?? 1,
    entrySmooth: segmented ? (values.entrySmooth ?? 'linear') : 'linear', exitSmooth: segmented ? (values.exitSmooth ?? 'linear') : 'linear',
    cyclePhaseOffset: values.cyclePhaseOffset || 0,
  };
  let elapsed, rateMul;
  if (ch.epilogue) {const e = ch.epilogue;e.baseElapsed ??= Math.max(0, layer.action.time - t0);elapsed = e.baseElapsed + (ch.clock - e.started) * s;rateMul = s;}   // relógio livre do ponto onde o clipe está
  else if (p) {rateMul = previewSpeed * (ch.speeds[p.action] ?? 1);elapsed = (ch.clock - p.started) * rateMul;}
  else {rateMul = s;elapsed = (ch.clock - layer.started) * s;}
  // Pausas e intervalo são digitados em SEGUNDOS DE JOGO: o orçamento decorre na velocidade efetiva, então convertemos.
  cfg.cyclePauseStart *= rateMul;cfg.cyclePauseEnd *= rateMul;cfg.repeatGap *= rateMul;
  return {cfg, elapsed};
}

/**
 * Tempo do clipe para o orçamento decorrido. O orçamento é consumido por segmento: cada trecho consome
 * (duração em segundos de clipe ÷ velocidade do trecho) e as pausas/intervalos consomem sem avançar.
 * @param {{elapsed: number, duration: number, cfg: LoopCfg}} p
 * @returns {{time: number, hold: boolean, done: boolean, seam: number|null}} seam = progresso 0–1 da janela de emenda (null fora dela)
 */
export function scheduleClipTime({elapsed, duration: d, cfg}) {
  const {trimStart: t0, trimEnd: t1, cycleStart: cs, loopEnd: c1} = cfg;
  const Lm = Math.max(.005, cfg.cycleLen), xf = Math.min(cfg.loopCrossfade || 0, Lm * .9);
  const phase = ((cfg.cyclePhaseOffset % Lm) + Lm) % Lm;
  const rate = {intro: Math.max(.05, cfg.introSpeed || 1), cycle: Math.max(.05, cfg.cycleSpeed || 1), outro: Math.max(.05, cfg.outroSpeed || 1)};
  const b = Math.max(0, elapsed);
  const outroLen = t1 - c1;
  // Orçamentos por trecho (em segundos de jogo à velocidade base): o easing redistui a posição DENTRO do trecho.
  const B = {intro: (cs - t0) / rate.intro, cycle: Lm / rate.cycle, outro: outroLen / rate.outro};
  const pose = u => cs + ((u * Lm + phase) % Lm);   // posição u∈[0,1) no ciclo efetivo → tempo do clipe
  const seamOf = u => {const x = u * Lm;return x >= Lm - xf ? Math.min(1, (x - (Lm - xf)) / Math.max(.001, xf)) : null;};
  if (b < B.intro) {
    const k = B.intro > 0 ? b / B.intro : 1;
    return {time: t0 + easeCurve(cfg.entrySmooth, k) * (cs - t0), hold: false, done: false, seam: null};
  }
  const bc = b - B.intro, freezeEnd = pose(1 - 1e-9);
  if (cfg.loop) {
    const pass = cfg.cyclePauseStart + B.cycle + cfg.cyclePauseEnd + cfg.repeatGap;
    if (pass <= 0) return {time: cs + phase, hold: false, done: false, seam: null};
    const k0 = bc % pass;
    if (k0 < cfg.cyclePauseStart) return {time: pose(0), hold: true, done: false, seam: null};   // pausa na primeira pose
    if (k0 < cfg.cyclePauseStart + B.cycle) {
      const u = (k0 - cfg.cyclePauseStart) / B.cycle;
      return {time: pose(u), hold: false, done: false, seam: seamOf(u)};
    }
    return {time: freezeEnd, hold: true, done: false, seam: null};   // pausa na última pose / intervalo entre repetições
  }
  if (bc < cfg.cyclePauseStart) return {time: pose(0), hold: true, done: false, seam: null};
  if (bc < cfg.cyclePauseStart + B.cycle) {
    const u = (bc - cfg.cyclePauseStart) / B.cycle;
    return {time: pose(u), hold: false, done: false, seam: seamOf(u)};
  }
  const bo = bc - cfg.cyclePauseStart - B.cycle;
  if (bo < cfg.cyclePauseEnd) return {time: freezeEnd, hold: true, done: false, seam: null};
  if (bo < cfg.cyclePauseEnd + B.outro) {
    const k = B.outro > 0 ? (bo - cfg.cyclePauseEnd) / B.outro : 1;
    return {time: c1 + easeCurve(cfg.exitSmooth, k) * outroLen, hold: false, done: false, seam: null};
  }
  return {time: t1, hold: true, done: true, seam: null};   // execução única concluída: segura a última pose
}
