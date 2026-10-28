// @ts-check
// Captura visual determinística (só para os testes de paridade: moves-vfx-parity.browser.mjs). Causa rastreada da instabilidade da captura:
// o desenho sorteia por Math.random — a fase inicial da gema flutuante de consumível (consumables-gems.js: `phase = Math.random() * 6`, que gira o
// chevron ciano da gema de Velocidade ao lado do lutador Azul) e as gotas/partículas do three.quarks (trilha do Water Pulse) e do VFX legado. Com a
// simulação pausada o laço de desenho não sorteia nada (dt = 0), mas cada passo dirigido pelo teste sorteia, e a sequência muda a cada execução.
// seedVisualRandom(semente) troca Math.random por um PRNG semeado (mulberry32) até seedVisualRandom(null). O jogo normal nunca chama isto:
// a aparência fica idêntica. A simulação não usa Math.random (tem RNG próprio semeado pela partida).

/** @type {(() => number) | null} */
let original = null;

/** Liga (semente numérica) ou desliga (null) o Math.random semeado da captura. Devolve se ficou ligado. @param {number | null} seed */
export function seedVisualRandom(seed) {
  if (seed == null) {if (original) Math.random = original;original = null;return false;}
  original ??= Math.random;
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return true;
}

/** O Math.random semeado da captura está ligado? */
export const visualRandomSeeded = () => original != null;

/**
 * Liga a captura determinística: semeia os sorteios E zera o relógio visual do mundo (WorldView.time, que gira a gema e pulsa barreiras/anéis).
 * Esse relógio acumula o tempo REAL desde que a página abriu (a partida roda sem pausa até o teste pausá-la), então o ângulo do chevron mudava a
 * cada execução mesmo com tudo pausado. Gemas já criadas antes da semente usam fase 0 enquanto a captura está ligada (consumables-gems.js).
 * @param {any} worldView @param {number | null} seed
 */
export function deterministicCapture(worldView, seed) {
  const on = seedVisualRandom(seed);
  if (on && worldView) {worldView.time = 0;worldView.trailTimer = 0;}
  return on;
}
