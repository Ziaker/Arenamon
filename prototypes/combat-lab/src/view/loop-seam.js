// Emenda do laço (Loop avançado do editor de animações — ver clip-scheduler.js e characters.js/blend).
// Durante a janela loopCrossfade no fim do ciclo, uma SEGUNDA action do MESMO clipe toca num mixer dedicado ao
// personagem, com peso rampando por loopCrossfadeWeight, misturando o fim do ciclo com o início — em vez do
// reinício duro do tempo. Decisão técnica: o three.js cacheia uma action por (clipe, raiz, mixer), então NÃO é
// possível duas instâncias do mesmo clipe no MESMO mixer; `.clone()` do clipe copiaria todos os keyframes (custo e
// cache interno do mixer sem limite). A forma limpa é um segundo AnimationMixer no mesmo modelo, só para a pose de
// emenda: as ligações (bindings) são por mixer, as duas instâncias coexistem e o custo só existe enquanto a janela
// está ativa. O ciclo efetivo da action principal começa em loopStart + loopCrossfade (definido no scheduler), de
// modo que, no instante exato do laço, a pose da action principal (que recomeça ali) é a MESMA pose em que a segunda
// action acabou de parar — a mistura é contínua, sem salto, para qualquer peso da emenda. Fora da janela a segunda
// action para e o caminho clássico não paga esse custo.
import * as T from 'three';

/**
 * Aplica a mistura da emenda do laço num quadro (chamado de blend() quando o scheduler reporta janela de emenda).
 * @param {import('./characters.js').Character} ch personagem (estado da emenda fica nele: seamMixer/seamAction)
 * @param {{clip: object, action: object}} layer camada atual
 * @param {import('./clip-scheduler.js').LoopCfg} cfg configuração resolvida do loop avançado
 * @param {{seam: number|null}} res resultado do scheduleClipTime deste quadro
 */
export function applyLoopSeam(ch, layer, cfg, res) {
  if (res.seam == null || !cfg.loopCrossfade) {if (ch.seamAction?.isRunning()) {ch.seamAction.stop();ch.seamAction = null;}return;}
  ch.seamMixer ??= new T.AnimationMixer(ch.model);
  if (ch.seamAction && ch.seamAction.getClip() !== layer.clip) {ch.seamAction.stop();ch.seamAction = null;}
  const a2 = ch.seamAction ??= ch.seamMixer.clipAction(layer.clip);
  if (!a2.isRunning()) {a2.reset().play();a2.paused = true;}
  const Lc = Math.max(.005, cfg.cycleLen + cfg.loopCrossfade), k = res.seam;   // ciclo conceitual inteiro [loopStart..loopEnd]
  // Pose de ENTRADA do ciclo (o trecho [loopStart..loopStart+loopCrossfade] que a action principal não toca): no fim da
  // janela (k=1) ela chega exatamente em cycleStart+phase = a pose de onde a action principal recomeça após o laço.
  a2.time = cfg.loopStart + (((cfg.cyclePhaseOffset + k * cfg.loopCrossfade) % Lc) + Lc) % Lc;
  const w = layer.action.getEffectiveWeight(), m = Math.min(1, k * (cfg.loopCrossfadeWeight ?? 1));
  a2.setEffectiveWeight(m * w);
  layer.action.setEffectiveWeight(w * (1 - m));
  ch.seamMixer.update(0);
}

/** Para e descarta a action de emenda (troca de clipe, reset visual, dispose do personagem). */
export function stopLoopSeam(ch) {if (ch.seamAction) {ch.seamAction.stop();ch.seamAction = null;}}
