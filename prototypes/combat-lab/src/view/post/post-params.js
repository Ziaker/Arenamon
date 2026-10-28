// @ts-check
// Fase 4 (postprocessing pmndrs, sem React): parâmetros, acessibilidade e pulsos de evento. Módulo puro (sem WebGL),
// testável em Node. O pipeline (post-pipeline.js) lê daqui; o jogo e o laboratório usam os MESMOS valores.
// Chaves planas em C.vfx.post para que o painel de Ajustes gere os controles automaticamente.
import {vfxDefaults} from '../../sim/config.js';


/** Valores padrão (vivem em config.js, C.vfx.post): tudo aparência, nada de regras. enabled = 0 → renderer atual, custo zero. */
export const postDefaults = () => structuredClone(vfxDefaults().post);

/**
 * Parâmetros efetivos depois das opções de acessibilidade do jogo (as mesmas de C.vfx.master/laser):
 *  - noFlash: sem pulsos de brilho (bloom não "estoura" no ataque) e bloom limitado;
 *  - reduceMotion: sem distorção, sem pulso de aberração, sem profundidade de campo;
 *  - highContrast: sem vinheta, grading, bloom, aberração nem distorção (legibilidade máxima).
 * @param {ReturnType<typeof postDefaults>} P
 * @param {{noFlash?:boolean, reduceMotion?:boolean, highContrast?:boolean}} [a11y]
 */
export function effectiveParams(P, a11y = {}) {
  const E = {...P};
  if (a11y.noFlash) {E.bloomAttackBoost = 1;E.bloomIntensity = Math.min(E.bloomIntensity, .8);}
  if (a11y.reduceMotion) {E.distortOn = 0;E.chromaImpact = E.chromaOffset;E.dofOn = 0;}
  if (a11y.highContrast) {E.vignetteOn = 0;E.gradeOn = 0;E.bloomOn = 0;E.chromaOn = 0;E.distortOn = 0;}
  return E;
}

/** Pulsos de evento com decaimento exponencial (impacto, ataque energético). Determinístico: depende só de dt. */
export class PostPulses {
  constructor() {this.v = {impact: 0, attack: 0};this.tau = {impact: .32, attack: .55};}
  /** @param {'impact'|'attack'} kind @param {number} strength 0..1 (o maior vence) */
  trigger(kind, strength = 1) {this.v[kind] = Math.max(this.v[kind] ?? 0, Math.min(1, strength));}
  tick(dt) {for (const k of Object.keys(this.v)) this.v[k] *= Math.exp(-Math.max(0, dt) / this.tau[k]);if (this.v.impact < .001) this.v.impact = 0;if (this.v.attack < .001) this.v.attack = 0;}
  get(kind) {return this.v[kind] ?? 0;}
  reset() {this.v.impact = this.v.attack = 0;}
}

/** Intensidade final do bloom: base + reforço durante ataques energéticos. */
export const bloomNow = (E, pulses) => E.bloomOn ? E.bloomIntensity * (1 + (E.bloomAttackBoost - 1) * pulses.get('attack')) : 0;
/** Deslocamento da aberração cromática: base + pulso de impacto. */
export const chromaNow = (E, pulses) => E.chromaOn ? E.chromaOffset + (E.chromaImpact - E.chromaOffset) * pulses.get('impact') : 0;

/**
 * Traduz eventos da simulação em pulsos (mesmos eventos do VFX legado e da ponte three.quarks).
 * @param {{trigger:(k:string,s:number)=>void}} sink  pipeline ou PostPulses
 * @param {any[]} events @param {any[]} fighters @param {WeakSet<object> | null} seen  null = events já são só os novos (despachante F5)
 * @param {(pos:{x:number,y:number,z:number}, strength:number)=>void} [shock] chamado em impactos fortes com a posição do alvo
 * @param {number} [minDamage]
 */
/** O pós alimenta os pulsos neste quadro? Mesmas condições do View.renderPost: ligado, canvas com tamanho e fora do impact frame
 * em silhueta (C08). Fora disso os eventos esperam (VfxDispatch.take('post', …)), como fazia o antigo postSeen. */
export function postFeedsThisFrame(/** @type {any} */ P, /** @type {any} */ impactPhase, /** @type {number} */ w, /** @type {number} */ h) {
  return !!P?.enabled && w > 0 && h > 0 && impactPhase !== 'white' && impactPhase !== 'invert';
}

/** F5: o que fazer com os eventos do 'post' neste quadro. 'feed' = alimenta os pulsos; 'defer' = espera (ligado, mas silhueta do
 * impact frame ou canvas 0×0); 'drop' = pós desligado: descarta — adiar acumulava o atraso a cada quadro (painel «adiados
 * descartados» subindo sem parar) e, ao ligar o pós depois, disparava até 32 pulsos velhos de uma vez.
 * @returns {'feed'|'defer'|'drop'} */
export function postBacklogMode(/** @type {any} */ P, /** @type {any} */ impactPhase, /** @type {number} */ w, /** @type {number} */ h) {
  return !P?.enabled ? 'drop' : postFeedsThisFrame(P, impactPhase, w, h) ? 'feed' : 'defer';
}

/** Eventos do 'post' para este quadro segundo postBacklogMode (uma vez por quadro, depois de dispatch()). @param {any} dispatch VfxDispatch */
export function takePostEvents(dispatch, /** @type {any} */ P, /** @type {any} */ impactPhase, /** @type {number} */ w, /** @type {number} */ h) {
  const mode = postBacklogMode(P, impactPhase, w, h);
  return mode === 'drop' ? dispatch.drop('post') : dispatch.take('post', mode === 'feed');
}

export function feedPulses(sink, events, fighters, seen, shock, minDamage = 12) {
  for (const e of events) {
    if (seen) {if (seen.has(e)) continue;seen.add(e);}
    const target = fighters[e.target];
    const dmg = e.damage ?? 0;
    if (e.result === 'impact' || e.result === 'perfect' || e.result === 'footstool' || e.result === 'wallSplat') {
      const s = Math.min(1, .35 + dmg / 40);
      sink.trigger('impact', s);sink.trigger('attack', Math.min(1, s * 1.1));
      if (shock && target && dmg >= minDamage) shock({x: target.position.x, y: (target.groundY ?? 0) + 1, z: target.position.z}, s);
    } else if (e.result === 'clash' || e.result === 'tackleClash' || e.result === 'stoneClash') {
      sink.trigger('impact', .6);sink.trigger('attack', .8);
      const a = fighters[e.attacker];
      if (shock && a && target) shock({x: (a.position.x + target.position.x) / 2, y: 1, z: (a.position.z + target.position.z) / 2}, .6);
    }
  }
  // Carga energética em curso: mantém o bloom reforçado enquanto durar.
  if (fighters.some(f => f.charge)) sink.trigger('attack', .55);
}
