// @ts-check
// Efeitos de movimento com código próprio (por exemplo, a barreira do Reflect e as pedras do Psyshock). Uma definição de movimento
// é DADO (clonável por structuredClone); quando um evento da linha do tempo precisa de lógica — dimensões que dependem da carga,
// número de pedras, busca de espaço —, ele aponta por nome (`{at, effect: 'reflect'}`) para um manipulador registrado aqui.
//
// Contrato do manipulador: `(game, fighter, def, fx) => {ok: boolean, reason?: string, detail?: object} | void`. `fx` traz o
// instante e os dados da execução (para Charge: `fx.charge = {ticks, seconds, level, params}` com os PARÂMETROS CAPTURADOS no
// início do uso — M28.4). Falha (`ok: false`): o jogo devolve a stamina, remove a recarga e a recuperação e emite `moveFailed`
// (M13.7, M29.3). Registrar não é feito pelo núcleo do laboratório: quem registra Moves registra seus efeitos (D2).
/** @type {Map<string, Function>} */
const EFFECTS = new Map();
/** @param {string} name @param {Function} fn */
export const registerEffect = (name, fn) => {EFFECTS.set(name, fn);return name;};
/** @param {string} name */
export const getEffect = name => EFFECTS.get(name) ?? null;
export const unregisterEffect = (/** @type {string} */ name) => EFFECTS.delete(name);
/**
 * Ganchos de passo: `(game) => evento[] | void`, chamados pelo jogo logo depois da física dos lutadores em TODO passo normal. Servem a Moves cujo efeito
 * continua depois do disparo e depende do estado físico (ex.: o Bounce confere o contato na descida e no pouso). Sem Move equipado, não fazem nada.
 * @type {Map<string, Function>}
 */
const STEP_HOOKS = new Map();
export const registerStepHook = (/** @type {string} */ name, /** @type {Function} */ fn) => {STEP_HOOKS.set(name, fn);return name;};
export const stepHooks = () => [...STEP_HOOKS.values()];
/** Esvazia os manipuladores e ganchos (testes). */
export const clearEffects = () => {EFFECTS.clear();STEP_HOOKS.clear();};
export const listEffects = () => [...EFFECTS.keys()];
