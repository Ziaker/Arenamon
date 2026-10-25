// @ts-check
// Comparador A/B de variantes de UM Move (#07 do plano de 23/10/2026): dois conjuntos de valores, o MESMO cenário (semente, posições, entradas e
// estado inicial idênticos), métricas lado a lado e primeiro tick em que os estados se separam. Roda na simulação, sem renderização: custo de
// desenho, FPS e P95 de render NÃO são medidos aqui e dependem do hardware (use o benchmark do painel de desempenho, no mesmo computador).
// Diferenças só cosméticas (cores, VFX) não entram na simulação, então não contaminam o resultado.
import {C} from './config.js';
import {Game} from './game.js';
import {emptyCommand} from './entity.js';
import {getMove} from './moves.js';
import {withValues} from './compare.js';
import {usageOf} from './move-matrix.js';
import {normalizeState, firstDivergence, configHash, hashText, r6} from './replay-diff.js';
import {listMoves} from './moves.js';

/** Hash da configuração SEM os caminhos comparados: muda só quando o resto do ambiente (outros ajustes, Moves registrados) mudou. */
export function baseHash(/** @type {string[]} */ paths) {
  const skip = new Set(paths);
  /** @type {(o: any, pre: string) => any} */ const strip = (o, pre) => Object.fromEntries(Object.entries(o).filter(([k]) => !skip.has(pre + k)).map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? strip(v, pre + k + '.') : typeof v === 'number' ? r6(v) : v]));
  return hashText(JSON.stringify(strip(C, '')) + '|' + listMoves().map(m => m.id).join(','));
}

/**
 * Avisos ao pôr dois resultados de comparação lado a lado (por exemplo, o anterior e o atual): outro Move, outra versão do laboratório ou
 * outro ambiente (ajustes fora do grupo comparado, Moves registrados) tornam os números não comparáveis.
 * @param {any} prev @param {any} next
 */
export function comparabilityWarnings(prev, next) {
  if (!prev || !next) return [];
  /** @type {string[]} */ const w = [];
  if (prev.moveId !== next.moveId) w.push(`Comparação anterior era de outro Move (${prev.moveId}).`);
  if (prev.appVersion && next.appVersion && prev.appVersion !== next.appVersion) w.push(`Versão do laboratório mudou desde a comparação anterior (${prev.appVersion} → ${next.appVersion}).`);
  if (prev.baseHash !== next.baseHash) w.push('O ambiente mudou desde a comparação anterior (ajustes fora deste Move ou Moves registrados): os números não são comparáveis com ela.');
  if (prev.seed !== next.seed || prev.ticks !== next.ticks) w.push('Cenário diferente da comparação anterior (semente ou duração).');
  return w;
}

/**
 * Roda o Move uma vez com `values` aplicados e devolve métricas e estados.
 * @param {string} moveId @param {Record<string, any>} values caminho → valor (ex.: {'world.swift.damage': 5})
 * @param {{seed?: number, ticks?: number, distance?: number}} [o]
 */
export function runMoveVariant(moveId, values, o = {}) {
  const seed = o.seed ?? 7, ticks = o.ticks ?? 480, distance = o.distance ?? 4;
  return withValues({...values, 'extras.toggles.enableEnemyAI': 0}, () => {   // restaurado no fim: a partida ao vivo não perde a IA do rival
    const def = getMove(moveId);
    if (!def) throw new Error('Move não registrado: ' + moveId);
    const g = new Game({seed});g.start();
    g.reset({positions: [{x: 0, z: -distance / 2}, {x: 0, z: distance / 2}]});
    g.mapState.platforms = [];g.mapState.obstacles = [];g.mapState.destructibles = [];g.mapState.items = [];g.mapState.regularSpawnTimer = 1e9;
    g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
    g.setLoadout(0, [moveId]);
    const [me, foe] = g.fighters, u = usageOf(def), held = Array.from({length: C.world.slots}, (_, i) => i === 0);
    const hp0 = foe.hp, st0 = me.stamina, p0 = {x: me.position.x, z: me.position.z};
    const m = {damage: 0, hits: 0, blocked: 0, firstImpactTick: /** @type {number | null} */ (null), entities: 0, actionTicks: /** @type {number | null} */ (null), maxDisplacement: 0};
    const seen = new Set(), states = [];
    /** @type {number | null} */ let actionStart = null;
    for (let t = 0; t < ticks && g.phase !== 'result'; t++) {
      g.step(/** @type {any} */ ({...emptyCommand(), ...(t < u.hold ? {skill: t === 0 ? 0 : null, skillHeld: held} : {})}), emptyCommand());
      states.push(normalizeState(g));
      if (actionStart === null && me.action?.kind === 'move') actionStart = t;
      if (actionStart !== null && m.actionTicks === null && !me.action) m.actionTicks = t - actionStart;
      for (const e of g.world.entities) if (!seen.has(e.id) && e.owner === 0) {seen.add(e.id);m.entities++;}
      for (const ev of g.lastStepEvents) if (ev.attacker === 0 && typeof ev.damage === 'number') {
        if (ev.result === 'impact') {m.hits++;m.damage += ev.damage;m.firstImpactTick ??= t;}
        else if (ev.result === 'partial' || ev.result === 'perfect') m.blocked++;
      }
      m.maxDisplacement = Math.max(m.maxDisplacement, Math.hypot(me.position.x - p0.x, me.position.z - p0.z));
    }
    return {metrics: {...m, damage: +m.damage.toFixed(3), maxDisplacement: +m.maxDisplacement.toFixed(3), foeHpLoss: +(hp0 - foe.hp).toFixed(3), staminaSpent: +(st0 - me.stamina).toFixed(3), cooldown: +(me.moveCooldowns?.[moveId] ?? 0).toFixed(3)}, states, configHash: configHash(), values};
  });
}

/**
 * Compara duas variantes do mesmo Move.
 * @param {string} moveId @param {Record<string, any>} valuesA @param {Record<string, any>} valuesB
 * @param {{seed?: number, ticks?: number, distance?: number, appVersion?: string}} [o]
 */
export function compareMoveVariants(moveId, valuesA, valuesB, o = {}) {
  const paths = [...new Set([...Object.keys(valuesA), ...Object.keys(valuesB)])];
  const baseA = withValues(valuesA, () => baseHash(paths)), baseB = withValues(valuesB, () => baseHash(paths));
  const a = runMoveVariant(moveId, valuesA, o), b = runMoveVariant(moveId, valuesB, o);
  const keys = Object.keys(a.metrics);
  const rows = keys.map(k => ({metric: k, a: /** @type {any} */ (a.metrics)[k], b: /** @type {any} */ (b.metrics)[k], same: /** @type {any} */ (a.metrics)[k] === /** @type {any} */ (b.metrics)[k]}));
  /** @type {string[]} */ const warnings = [];
  if (JSON.stringify(valuesA) === JSON.stringify(valuesB)) warnings.push('A e B têm os mesmos valores: nenhuma diferença esperada.');
  if (baseA !== baseB) warnings.push('A e B rodaram em ambientes diferentes (ajustes fora do Move mudaram entre as execuções).');
  warnings.push('Custo de render, FPS e P95 não são medidos na simulação; comparar só no mesmo computador, com o benchmark do painel de desempenho.');
  return {moveId, seed: o.seed ?? 7, ticks: o.ticks ?? 480, rows, divergence: firstDivergence(a.states, b.states), versions: {a: a.configHash, b: b.configHash}, baseHash: baseA, appVersion: o.appVersion ?? null, report: hashText(JSON.stringify({moveId, valuesA, valuesB, rows})), warnings};
}

/** Valores de fábrica do grupo de um Move como pares caminho → valor (variante "padrão" para comparar com o estado atual). */
export function groupValues(/** @type {string} */ group, /** @type {Record<string, any>} */ source) {
  return Object.fromEntries(Object.entries(source.world?.[group] ?? {}).map(([k, v]) => [`world.${group}.${k}`, v]));
}
