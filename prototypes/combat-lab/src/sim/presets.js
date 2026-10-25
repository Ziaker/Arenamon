// @ts-check
// Presets de sensação: categorias de parâmetros, segurança da troca durante a partida e presets iniciais.
// Um preset tem nome, versão, descrição, datas, escopo (completo ou por categorias) e valores. Aplicar um preset por
// categorias muda SÓ os caminhos dessas categorias (aplicar locomoção nunca mexe em VFX, HUD ou câmera).
// Os presets iniciais são propostas para avaliação: não são valores aprovados e não substituem os oficiais.

const has = (path, prefixes) => prefixes.some(p => path === p || path.startsWith(p + '.'));
const key = path => path.split('.').at(-1);
const LOCO_FEEL = ['acceleration', 'braking', 'reversal', 'accelCurve', 'brakeCurve', 'friction', 'turnGrip', 'residualSpeed', 'turnRate', 'visualTurnRate', 'turnAcceleration'];
const SPRINT_FEEL = ['speedMultiplier', 'acceleration', 'braking', 'turnGrip'];
const CURVE = ['prepTime', 'impulseTime', 'decelStart', 'recoveryTime', 'prepSpeed', 'travelEnd', 'blend'];

/** Categorias, na ordem da interface. `feel`: categorias que os presets de sensação alteram. */
export const CATEGORIES = [
  {id: 'locomotion', label: 'Locomoção (aceleração, frenagem, inércia, giro)', feel: true, test: p => p.startsWith('locomotion.') && LOCO_FEEL.includes(key(p))},
  {id: 'sprint', label: 'Sensação do sprint', feel: true, test: p => p.startsWith('actions.sprint.') && SPRINT_FEEL.includes(key(p))},
  {id: 'actionCurve', label: 'Curva de movimento de X e C (impulso, desaceleração)', feel: true, test: p => /^actions\.(dodge|tackle)\./.test(p) && CURVE.includes(key(p))},
  {id: 'animation', label: 'Transições das animações', feel: true, test: p => p.startsWith('display.animation.') && key(p) !== 'speed'},
  {id: 'control', label: 'Esquema de controle (lock-on, referencial)', test: p => p.startsWith('locomotion.')},
  {id: 'actionRules', label: 'Regras de X, C, sprint e cancelamento (durações, distâncias, custos, janelas)', test: p => p.startsWith('actions.')},
  {id: 'combat', label: 'Combate, defesa e stamina', test: p => has(p, ['rules', 'extras.combat'])},
  {id: 'attributes', label: 'Atributos dos perfis', test: p => p.startsWith('profiles.')},
  {id: 'ai', label: 'IA', test: p => has(p, ['extras.ai', 'extras.aiRed', 'extras.aiBlue', 'extras.gameModes'])},
  {id: 'camera', label: 'Câmera', test: p => has(p, ['camera', 'extras.cameraExtra'])},
  {id: 'vfx', label: 'Efeitos visuais e tremores', test: p => p.startsWith('vfx.')},
  {id: 'display', label: 'HUD, sombras, cores e apresentação', test: p => has(p, ['display', 'extras.visual', 'extras.colors', 'extras.fx', 'extras.hud'])},
  {id: 'bindings', label: 'Teclas', test: p => has(p, ['extras.bindings', 'extras.bindings2'])},
  {id: 'systems', label: 'Sistemas ligados/desligados', test: p => p.startsWith('extras.toggles.')},
  {id: 'simulation', label: 'Arena e simulação', test: p => p.startsWith('test.')},
];
export const FEEL_CATEGORIES = CATEGORIES.filter(c => c.feel).map(c => c.id);
export const categoryOf = path => (CATEGORIES.find(c => c.test(path)) ?? {id: 'other'}).id;
export const categoryLabel = id => CATEGORIES.find(c => c.id === id)?.label ?? id;

/**
 * Segurança da troca durante a partida (auditoria da seção 6.1):
 *  • live — lidos a cada passo, sem estado acumulado que dependa deles: a troca muda a aceleração a partir do próximo
 *    passo; posição e velocidade continuam contínuas (sem teletransporte nem mudança retroativa).
 *  • boundary — afetam ações em curso (duração, distância nominal e curva de X/C, recuo, stun, regras): trocar no meio
 *    mudaria a fração já percorrida e o restante da trajetória. Aplicados só quando nenhum lutador está em ação,
 *    recuo, stun, voo, recuperação, empurrão ou hitstop.
 *  • restart — mudam o próprio estado da partida (passo da simulação, arena, vida e stamina máximas): nunca trocados
 *    durante a partida; exigem reiniciar.
 */
export function switchClass(path) {
  if (path.startsWith('test.') || /^profiles\.[a-z]+\.hp$/.test(path) || path === 'rules.staminaMax') return 'restart';
  if (path.startsWith('map.')) {
    const k = path.split('.')[1];
    if (['arenaRadius', 'arenaShape', 'destructibleCount', 'destructibleHp', 'obstacleCount', 'platformCount', 'platforms', 'itemInitialCount'].includes(k)) {
      return 'restart';
    }
    return 'boundary';
  }
  const c = categoryOf(path);
  if (['locomotion', 'control', 'sprint', 'animation', 'camera', 'vfx', 'display', 'bindings', 'ai'].includes(c)) {
    // Parâmetros de sprint ligados à stamina continuam válidos a qualquer momento (lidos por passo, sem reescrever stamina).
    return 'live';
  }
  return 'boundary';
}
/** Pode aplicar parâmetros “boundary” agora? (nenhum lutador com ação, recuo, stun, voo, recuperação, empurrão ou hitstop). */
export function safeBoundary(game) {
  return game.hitstop <= 0 && game.fighters.every(f => !f.action && !f.flight && f.knockRecovery <= 0 && f.stun <= 1e-8 && !f.push && !f.blend && !f.inputBuffer && !f.bufferedTackle);
}

const TAU = 2 * Math.PI;
const curve = (dodge, tackle) => Object.fromEntries([...Object.entries(dodge).map(([k, v]) => [`actions.dodge.${k}`, v]), ...Object.entries(tackle).map(([k, v]) => [`actions.tackle.${k}`, v])]);
const loco = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [`locomotion.${k}`, v]));
const sprint = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [`actions.sprint.${k}`, v]));
const anim = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [`display.animation.${k}`, v]));
const DATE = '2026-10-15T12:00:00.000Z';

/**
 * Presets iniciais (só categorias de sensação). Fundamentação e métricas medidas: OVERHAUL.md › Calibração.
 * Referência: padrão do laboratório = aceleração 26, frenagem 22, inversão 38, curvas 0,45/0,35, aderência 34.
 */
export const BUILTIN_PRESETS = [
  {id: 'builtin:storm', name: 'Storm-like', builtin: true, version: 1, createdAt: DATE, updatedAt: DATE, scope: 'partial', categories: [...FEEL_CATEGORIES],
    description: 'Experimental, inspirado na fluidez de Naruto Ultimate Ninja Storm: arrancada forte que suaviza perto do máximo, boa resposta direcional (inversão e aderência altas), frenagem convincente com deslizamento curto, sprint mais rápido, X/C com impulso imediato e transições de animação curtas.',
    values: {...loco({acceleration: 40, braking: 34, reversal: 62, accelCurve: .55, brakeCurve: .5, friction: 1.1, turnGrip: 52, residualSpeed: .35, turnRate: 3 * TAU, visualTurnRate: 3.5 * TAU, turnAcceleration: 160}),
      ...sprint({speedMultiplier: 1.8, acceleration: 26, braking: 15, turnGrip: 28}),
      ...curve({prepTime: .03, impulseTime: .1, decelStart: .6, recoveryTime: .1, prepSpeed: .6, travelEnd: .78, blend: .06}, {prepTime: .04, impulseTime: .08, decelStart: .55, recoveryTime: .08, prepSpeed: .55, travelEnd: .62, blend: .06}),
      ...anim({fade: .14, actionFade: .05, locomotionHold: .08})}},
  {id: 'builtin:etapa-a', name: 'Etapa A', builtin: true, version: 1, createdAt: DATE, updatedAt: DATE, scope: 'partial', categories: [...FEEL_CATEGORIES],
    description: 'Experimental, equilibrado e previsível, para servir de referência de calibração: aceleração e frenagem quase constantes (curvas baixas), pouco deslizamento residual, inversão firme, sprint e curvas de X/C iguais ao padrão do laboratório.',
    values: {...loco({acceleration: 30, braking: 30, reversal: 48, accelCurve: .2, brakeCurve: .15, friction: .6, turnGrip: 40, residualSpeed: .15, turnRate: 2 * TAU, visualTurnRate: 2.5 * TAU, turnAcceleration: 120}),
      ...sprint({speedMultiplier: 1.55, acceleration: 18, braking: 14, turnGrip: 22}),
      ...curve({prepTime: .06, impulseTime: .14, decelStart: .55, recoveryTime: .12, prepSpeed: .45, travelEnd: .7, blend: .1}, {prepTime: .06, impulseTime: .1, decelStart: .5, recoveryTime: .08, prepSpeed: .5, travelEnd: .55, blend: .1}),
      ...anim({fade: .18, actionFade: .07, locomotionHold: .1})}},
  {id: 'builtin:pesado', name: 'Pesado', builtin: true, version: 1, createdAt: DATE, updatedAt: DATE, scope: 'partial', categories: [...FEEL_CATEGORIES],
    description: 'Experimental, com mais massa: aceleração menos imediata, frenagem longa com deslizamento, inversões bem perceptíveis (inversão e aderência baixas), giro lento, sprint pesado e X/C com preparação mais longa e impulso mais lento.',
    values: {...loco({acceleration: 15, braking: 13, reversal: 22, accelCurve: .2, brakeCurve: .2, friction: .45, turnGrip: 18, residualSpeed: .4, turnRate: 1.25 * TAU, visualTurnRate: 1.5 * TAU, turnAcceleration: 40}),
      ...sprint({speedMultiplier: 1.45, acceleration: 10, braking: 8, turnGrip: 12}),
      ...curve({prepTime: .1, impulseTime: .18, decelStart: .5, recoveryTime: .14, prepSpeed: .3, travelEnd: .62, blend: .14}, {prepTime: .1, impulseTime: .15, decelStart: .48, recoveryTime: .1, prepSpeed: .32, travelEnd: .5, blend: .14}),
      ...anim({fade: .24, actionFade: .09, locomotionHold: .14})}},
];

/** Valores efetivos de um preset: só caminhos conhecidos e, no escopo parcial, só os das categorias escolhidas. */
export function presetValues(preset, known) {
  const cats = preset.scope === 'partial' ? new Set(preset.categories || []) : null;
  return Object.fromEntries(Object.entries(preset.values || {}).filter(([p, v]) => typeof v === 'number' && (!known || known.has(p)) && (!cats || cats.has(categoryOf(p)))));
}
/** O que mudaria ao aplicar: [{path, from, to, category, cls}]. */
export function applyPlan(preset, current, known) {
  const vals = presetValues(preset, known);
  return Object.entries(vals).filter(([p, v]) => Math.abs((current[p] ?? NaN) - v) > 1e-9 || !(p in current)).map(([path, to]) => ({path, from: current[path], to, category: categoryOf(path), cls: switchClass(path)}));
}
/** Presets antigos ({name, savedAt, values}) → formato atual (completo, versão 1). */
export function migrateLegacyPreset(p) {
  const at = new Date(p.savedAt || Date.now()).toISOString();
  return {id: 'user:' + (p.id || slug(p.name) + '-' + (p.savedAt || 0).toString(36)), name: p.name, version: p.version ?? 1, description: p.description ?? '', createdAt: p.createdAt ?? at, updatedAt: p.updatedAt ?? at,
    scope: p.scope ?? 'full', categories: p.categories ?? [], values: {...(p.values || {})}, migratedFrom: p.migratedFrom ?? (p.id ? undefined : 'v7')};
}
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'preset';
export const newPresetId = name => `user:${slug(name)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
