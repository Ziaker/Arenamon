// @ts-check
// F8 (Task 16) — BATERIA DE HOMOLOGAÇÃO da simulação (spec §15), com partidas reais (IA × IA, mapa padrão, Moves e passivas equipados), sem mocks:
//  1. Replay e múltiplos jogos: dois Game alternados passo a passo = cada um sozinho (estado completo + eventos, inclusive eventId/contactId);
//     save/load no meio (no mesmo Game e num Game novo) e continuar = execução sem interrupção, bit a bit (hash do save() inteiro + eventos).
//  2. Reset: 100 ciclos Game.reset() + partida curta sem crescimento de arrays/Map/Set (eventos, entidades, listas do mapa, spawnLog com teto,
//     passiveProcessed, registros globais de Moves/efeitos) e com o MESMO estado final em todo ciclo (o reset é completo).
//  3. Partida inteira: sessões de 180 s de simulação por semente (rodadas em sequência, melhor de três nas 3 primeiras) com invariantes a CADA passo:
//     sem NaN/Infinity, lutador dentro da arena, HP em [0, máx], conservação de HP (livro damageLedger do DamageResolver + curas com evento),
//     resíduo do solver ≤ tolerância ou pinEscape emitido, sem pouso falso (vigia de test/f4-geometry-gate.test.mjs), hitstop não avança a
//     física, validateCombatEvent em todo evento, eventId único e crescente.
//  4. Tempo por passo (skill performance-optimization: medir primeiro, depois fixar orçamento ≥ 3× o medido): p50/p95/máx por passo.
// Uso: node prototypes/combat-lab/test/f8-homologacao.test.mjs          → variante curta (entra no `npm run rapido`, alguns segundos)
//      node prototypes/combat-lab/test/f8-homologacao.test.mjs --lento  → 4 sementes × sessão de 180 s (21.600 passos cada), alternância/replay longos,
//      100 resets × 600 passos, bench:moves e grava prototypes/combat-lab/evidence/homologacao-f8/resultado.json (seção "sim").
//      (também: variável de ambiente F8_LENTO=1)
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {execSync} from 'node:child_process';
import {cpus} from 'node:os';
import {fileURLToPath} from 'node:url';
import {C, defaults, resetConfig} from '../src/sim/config.js';
import {Game} from '../src/sim/game.js';
import {getFighterMaxStamina} from '../src/sim/entity.js';
import {listMoves} from '../src/sim/moves.js';
import {stepHooks} from '../src/sim/move-effects.js';
import {physicsProbe, getGroundHeight, groundSurface} from '../src/sim/physics.js';
import {effectiveArenaRadius} from '../src/sim/map.js';
import {validateCombatEvent} from '../src/sim/events/combat-event.js';
import {damageLedger} from '../src/sim/resolvers/damage-resolver.js';
import {hashText} from '../src/sim/replay-diff.js';
import {PASSIVES} from '../src/sim/passives.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';

registerStandardMoves();
const LENTO = process.argv.includes('--lento') || process.env.F8_LENTO === '1';
const EVID = fileURLToPath(new URL('../evidence/homologacao-f8/', import.meta.url));
const TOL = () => C.test.penetrationTolerance ?? .02;
const SPS = Math.round(1 / (1 / 120));   // passos por segundo (C.test.step = 1/120; conferido abaixo)

// ------------------------------------------------------------------------------------------------ montagem da partida
/** PRNG determinístico só para escolher loadouts (não toca o RNG da partida). */
const lcg = (/** @type {number} */ s) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
const SPECIES = ['croagunk', 'drowzee', 'mush', 'vigoroth'];
/** Configuração da partida por semente: 4 Moves por lutador e 2 passivas válidas (uma pode ser exclusiva da espécie). */
function loadoutsFor(/** @type {number} */ seed) {
  const rnd = lcg(seed * 7919 + 13), ids = listMoves().map(m => m.id);
  const pick = (/** @type {string[]} */ pool, /** @type {number} */ n) => {const a = [...pool], out = [];while (out.length < n && a.length) out.push(a.splice(Math.floor(rnd() * a.length), 1)[0]);return out;};
  const species = [SPECIES[Math.floor(rnd() * 4)], SPECIES[Math.floor(rnd() * 4)]];
  const passives = species.map(sp => {
    const excl = PASSIVES.filter(p => p.species === sp).map(p => p.id), gen = PASSIVES.filter(p => p.species === null).map(p => p.id);
    return [...pick(excl, 1), ...pick(gen, 1)];
  });
  return {moves: [pick(ids, 4), pick(ids, 4)], species, passives};
}
/** Configuração padrão do jogo, IA nos dois lados (azul pela playerBrain, vermelho pela IA interna do Game), modo tático. */
function prepConfig() {resetConfig(defaults());C.extras.toggles.enablePlayerAI = 1;C.extras.toggles.enableEnemyAI = 1;}
function newMatch(/** @type {number} */ seed) {
  const L = loadoutsFor(seed), g = new Game({seed});
  g.mode = 'tactical';g.passiveIdentity = [...L.species];
  for (const i of [0, 1]) {const r = g.setPassiveLoadout(i, L.passives[i]);assert.ok(r.ok, `passivas ${L.passives[i]} recusadas para ${L.species[i]}: ${JSON.stringify(r)}`);}
  g.reset();for (const i of [0, 1]) g.setLoadout(i, L.moves[i]);g.start();
  return {g, L};
}
/** Reinicia a rodada no mesmo Game (o que o «Iniciar» faz no jogo: reset + loadouts mantidos). */
function nextRound(/** @type {any} */ g) {g.reset();g.start();}
/** Comando do azul pela IA (o mesmo caminho de app/match-flow.js playerCommand com «IA do azul» ligada). */
const blueCmd = (/** @type {any} */ g) => {const [p, e] = g.fighters;return g.assistNav(g.playerBrain, p, e, g.playerBrain.command(p, e, g.mode, C.test.step));};

// ------------------------------------------------------------------------------------------------ hash e serialização exatos
/** Serialização exata: números pela forma mais curta que volta ao mesmo double (JSON), −0/NaN/Infinity marcados, Set/Map preservados. */
const ser = (/** @type {any} */ v) => JSON.stringify(v, (_, x) => x instanceof Set ? {$set: [...x]} : x instanceof Map ? {$map: [...x]} : typeof x === 'number' && !Number.isFinite(x) ? `$${x}` : Object.is(x, -0) ? '$-0' : x);
/** Rastro de um passo: hash do estado completo (save() inteiro: lutadores, mundo, mapa, cérebros, contadores) + eventos do passo na íntegra. */
const trace = (/** @type {any} */ g) => ({tick: g.tick, state: hashText(ser(g.save())), events: ser(g.lastStepEvents)});
/** Primeira divergência entre dois rastros (null = idênticos). */
function firstDiff(/** @type {any[]} */ a, /** @type {any[]} */ b) {
  if (a.length !== b.length) return {why: `comprimentos ${a.length} ≠ ${b.length}`};
  for (let i = 0; i < a.length; i++) if (a[i].state !== b[i].state || a[i].events !== b[i].events || a[i].tick !== b[i].tick) return {i, tick: a[i].tick, a: a[i], b: b[i]};
  return null;
}
/** Roda N passos de um Game sozinho e devolve o rastro. */
function runSolo(/** @type {number} */ seed, /** @type {number} */ n) {
  prepConfig();const {g} = newMatch(seed), out = [];
  for (let t = 0; t < n; t++) {if (g.phase === 'result') nextRound(g);g.step(blueCmd(g));out.push(trace(g));}
  return out;
}

// ------------------------------------------------------------------------------------------------ 1. replay e múltiplos jogos
/** Dois Game (sementes e loadouts diferentes) alternados passo a passo, comparados com cada um rodando sozinho. */
export function alternation(/** @type {number} */ n, seeds = [11, 12]) {
  const soloA = runSolo(seeds[0], n), soloB = runSolo(seeds[1], n);
  prepConfig();const A = newMatch(seeds[0]).g, B = newMatch(seeds[1]).g, ta = [], tb = [];
  for (let t = 0; t < n; t++) for (const [g, tr] of /** @type {const} */ ([[A, ta], [B, tb]])) {if (g.phase === 'result') nextRound(g);g.step(blueCmd(g));tr.push(trace(g));}
  const events = (/** @type {any[]} */ tr) => tr.reduce((s, x) => s + JSON.parse(x.events).length, 0), contacts = (/** @type {any[]} */ tr) => tr.reduce((s, x) => s + JSON.parse(x.events).filter((/** @type {any} */ e) => e.contactId != null).length, 0);
  return {n, seeds, diffA: firstDiff(soloA, ta), diffB: firstDiff(soloB, tb), eventsA: events(ta), eventsB: events(tb), contactEvents: contacts(ta) + contacts(tb)};
}
/** Save no tick k e continuação: (a) no MESMO Game (como o replay do laboratório volta no tempo) e (b) num Game NOVO; comparados bit a bit. */
export function saveLoad(/** @type {number} */ seed, /** @type {number} */ n, /** @type {number[]} */ cuts) {
  const ref = runSolo(seed, n), out = [];
  for (const k of cuts) for (const fresh of [false, true]) {
    prepConfig();let {g} = newMatch(seed);const tr = [];
    for (let t = 0; t < k; t++) {if (g.phase === 'result') nextRound(g);g.step(blueCmd(g));tr.push(trace(g));}
    const saved = g.save();
    if (fresh) {const h = new Game({seed});h.mode = g.mode;h.load(saved);g = h;}
    else {for (let t = 0; t < 37 && g.phase !== 'result'; t++) g.step(blueCmd(g));g.load(saved);}   // anda um pouco e volta: o load tem de apagar o desvio
    assert.equal(hashText(ser(g.save())), hashText(ser(saved)), `load não restaura o próprio save (k ${k})`);
    for (let t = k; t < n; t++) {if (g.phase === 'result') nextRound(g);g.step(blueCmd(g));tr.push(trace(g));}
    out.push({cut: k, fresh, diff: firstDiff(ref, tr)});
  }
  return out;
}
test('dois Game alternados passo a passo produzem exatamente o mesmo estado e os mesmos eventos (eventId/contactId) que cada um sozinho', () => {
  const r = alternation(LENTO ? 3000 : 900);
  assert.equal(r.diffA, null, `Game A divergiu: ${JSON.stringify(r.diffA)?.slice(0, 600)}`);
  assert.equal(r.diffB, null, `Game B divergiu: ${JSON.stringify(r.diffB)?.slice(0, 600)}`);
  assert.ok(r.eventsA > 5 && r.eventsB > 5,`poucos eventos para a prova valer (${r.eventsA}/${r.eventsB})`);
});
test('save/load no meio (mesmo Game e Game novo) e continuar = execução sem interrupção, bit a bit', () => {
  const n = LENTO ? 3600 : 900, rows = saveLoad(21, n, LENTO ? [1, 600, 1777, 3000] : [1, 450]);
  for (const r of rows) assert.equal(r.diff, null, `corte ${r.cut} (${r.fresh ? 'Game novo' : 'mesmo Game'}): ${JSON.stringify(r.diff)?.slice(0, 600)}`);
});

// ------------------------------------------------------------------------------------------------ 2. resets
/** Tamanhos de todo array/Map/Set alcançável a partir do Game (até `depth` níveis), fora os cérebros (medidos à parte pelo hash). */
function sizes(/** @type {any} */ g, depth = 4) {
  const out = /** @type {Record<string, number>} */ ({}), seen = new Set();
  const walk = (/** @type {any} */ o, /** @type {string} */ path, /** @type {number} */ d) => {
    if (!o || typeof o !== 'object' || seen.has(o) || ArrayBuffer.isView(o)) return;
    seen.add(o);
    for (const [k, v] of o instanceof Map ? o.entries() : Object.entries(o)) {
      const p = `${path}.${k}`;
      if (Array.isArray(v)) out[p] = v.length;else if (v instanceof Map || v instanceof Set) out[p] = v.size;
      if (d > 0 && v && typeof v === 'object') walk(v, p, d - 1);
    }
  };
  walk(g, 'game', depth);
  out['global.moves'] = listMoves().length;out['global.stepHooks'] = stepHooks().length;out['global.damageLedger.entries'] = damageLedger.entries?.length ?? 0;
  return out;
}
/** Hash do estado para comparar rodadas: tudo do save() menos o contador LEGADO eventSeq e o que deriva dele (e.id e e.cause), que por
 * contrato é monotônico por Game e atravessa rodadas (R31: só identidade/igualdade; o eventId canônico reinicia a cada reset e entra no hash). */
const roundKey = (/** @type {any} */ g) => {
  const s = g.save(), strip = (/** @type {any[]} */ es) => es.map(e => ({...e, id: null, cause: e.cause === undefined ? undefined : null}));
  return hashText(ser({...s, eventSeq: null, events: strip(s.events), lastStepEvents: strip(s.lastStepEvents)}));
};
/** 100 ciclos: reset + loadouts + `ticks` passos de IA × IA. Mede tamanhos e hash do estado no fim de cada ciclo. */
export function resetCycles(/** @type {number} */ cycles, /** @type {number} */ ticks, seed = 31) {
  prepConfig();const {g, L} = newMatch(seed);
  let first = null, warm = null, maxSizes = /** @type {Record<string, number>} */ ({});
  const hashes = new Set(), spawnLogMax = [];
  for (let i = 0; i < cycles; i++) {
    if (i) {g.reset();for (const k of [0, 1]) g.setLoadout(k, L.moves[k]);g.start();}
    for (let t = 0; t < ticks && g.phase !== 'result'; t++) g.step(blueCmd(g));
    const s = sizes(g);hashes.add(roundKey(g));spawnLogMax.push(g.mapState.spawnLog?.length ?? 0);
    if (i === 0) first = s;
    if (i === 9) warm = s;
    for (const [k, v] of Object.entries(s)) maxSizes[k] = Math.max(maxSizes[k] ?? 0, v);
  }
  const end = sizes(g), grew = Object.keys(end).filter(k => end[k] > (warm?.[k] ?? 0)).map(k => `${k}: ${warm?.[k] ?? 0} → ${end[k]}`);
  return {cycles, ticks, distinctFinalStates: hashes.size, grew, first, end, events: end['game.events'], entities: end['game.world.entities'], passiveProcessed: end['game.passiveProcessed'], spawnLogMax: Math.max(...spawnLogMax),
    largest: Object.entries(maxSizes).sort((a, b) => b[1] - a[1]).slice(0, 8)};
}
test('100 resets com partida IA × IA: nenhuma coleção cresce e todo ciclo termina no MESMO estado (reset completo)', () => {
  const r = resetCycles(100, LENTO ? 600 : 90);
  assert.deepEqual(r.grew, [], 'coleções que cresceram entre o 10º e o 100º ciclo');
  assert.equal(r.distinctFinalStates, 1, `o mesmo roteiro depois de reset terminou em ${r.distinctFinalStates} estados diferentes: o reset deixa estado vazar entre partidas`);
  assert.ok(r.events <= 12, `game.events ${r.events} (teto 12)`);
  assert.equal(r.passiveProcessed, 0, 'passiveProcessed limpo ao fim do passo');
});

// ------------------------------------------------------------------------------------------------ 3. partida inteira com invariantes
const HEAL = (/** @type {any} */ e, /** @type {number} */ id) => e.result === 'healedHp' && e.fighter === id ? e.amount : (e.result === 'passiveHeal' || e.result === 'statusTick') && e.target === id ? (e.heal ?? 0) : 0;
const fin = (/** @type {any} */ v) => typeof v === 'number' && Number.isFinite(v);
const bodyKey = (/** @type {any} */ g) => ser({f: g.fighters.map((/** @type {any} */ f) => [f.position, f.velocity, f.flight, f.groundY, f.hp, f.stamina, f.action?.t ?? null]), e: g.world.entities.map((/** @type {any} */ e) => [e.id, e.pos, e.y, e.dead])});

/**
 * Um passo vigiado. Devolve a lista de violações (vazia = ok) e o tempo do passo (comando do azul + Game.step, que inclui a IA do vermelho).
 * Vigia de pouso: a mesma de test/f4-geometry-gate.test.mjs (todo incremento de lastLanding.n vem de voo real, de cima, sobre o apoio real).
 * @param {any} g @param {{lastEventId: number, ids: Set<number>, counts: any}} st
 */
function watchedStep(g, st) {
  const v = /** @type {string[]} */ ([]);
  const before = g.fighters.map((/** @type {any} */ f) => ({n: f.lastLanding?.n ?? 0, flight: f.flight ? {y: f.flight.y} : null, hp: f.hp}));
  const tops = new Map(g.mapState.destructibles.map((/** @type {any} */ d) => [d.id, (d.pos.y ?? 0) + (d.size?.height ?? 0)]));   // topo de cada destrutível/rocha antes do passo
  const frozenBefore = g.hitstop > 0, keyBefore = frozenBefore ? bodyKey(g) : null, mark = damageLedger.entries.length;
  const t0 = performance.now();
  g.step(blueCmd(g));
  const ms = performance.now() - t0, tag = `tick ${g.tick}`;
  // hitstop: o passo conta no relógio, mas nada se move nem perde HP
  if (g.frozen) {st.counts.frozen++;if (bodyKey(g) !== keyBefore) v.push(`${tag}: hitstop avançou a física/estado`);if (!frozenBefore) v.push(`${tag}: congelou sem hitstop`);}
  const R = effectiveArenaRadius() - C.test.halfExtent;
  g.fighters.forEach((/** @type {any} */ f, /** @type {number} */ i) => {
    for (const [k, x] of Object.entries({x: f.position.x, z: f.position.z, vx: f.velocity.x, vz: f.velocity.z, hp: f.hp, stamina: f.stamina, groundY: f.groundY ?? 0, fy: f.flight ? f.flight.y : 0, fvy: f.flight ? f.flight.vy : 0}))
      if (!fin(x)) v.push(`${tag} f${i}: ${k} não finito (${x})`);
    if (C.map.arenaShape !== 'square' && Math.hypot(f.position.x, f.position.z) > R + 1e-6) v.push(`${tag} f${i}: fora da arena (${Math.hypot(f.position.x, f.position.z).toFixed(4)} > ${R})`);
    if (f.hp < 0 || f.hp > f.attributes.hp) v.push(`${tag} f${i}: HP ${f.hp} fora de [0, ${f.attributes.hp}]`);
    if ((f.shield?.hp ?? 0) < 0) v.push(`${tag} f${i}: escudo negativo`);
    if (f.stamina < -1e-9 || f.stamina > getFighterMaxStamina(f) + 1e-6) v.push(`${tag} f${i}: stamina ${f.stamina} fora de [0, ${getFighterMaxStamina(f)}]`);
    // conservação: ΔHP = −Σ transações do resolvedor + Σ curas com evento
    const L = damageLedger.entries.slice(mark).filter((/** @type {any} */ x) => x.targetId === f.id);
    const lost = L.reduce((/** @type {number} */ a, /** @type {any} */ x) => a + (x.hpBefore - x.hpAfter), 0), healed = g.lastStepEvents.reduce((/** @type {number} */ a, /** @type {any} */ e) => a + HEAL(e, f.id), 0);
    if (Math.abs((before[i].hp - f.hp) - (lost - healed)) > 1e-9) v.push(`${tag} f${i}: HP ${before[i].hp} → ${f.hp}, resolvedor −${lost}, curas +${healed} (HP mudou fora do resolvedor)`);
    // pouso falso
    const Ld = f.lastLanding;
    if ((Ld?.n ?? 0) !== before[i].n) {
      st.counts.landings++;
      if (!before[i].flight) v.push(`${tag} f${i}: pousou sem estar em voo`);
      else if (before[i].flight.y < Ld.y - 1e-3) v.push(`${tag} f${i}: pousou vindo de baixo (y0 ${before[i].flight.y} < apoio ${Ld.y})`);
      const ground = getGroundHeight({x: Ld.x, z: Ld.z}, g, Ld.y);
      // Apoio que SOBE no mesmo passo (rocha do Emerging Stone crescendo depois da física): o pouso foi no topo da rocha no instante da física
      // (topo antes ≤ y do pouso ≤ topo depois) e a rocha carregou o lutador até o topo novo no mesmo passo — pouso real, contado à parte.
      const sup = groundSurface({x: Ld.x, z: Ld.z}, g, Ld.y), top0 = sup?.kind === 'destructible' ? tops.get(sup.id) : undefined;
      const rising = top0 !== undefined && ground > top0 + 1e-9 && Ld.y >= top0 - 1e-9 && Ld.y <= ground + 1e-9 && (!!f.flight || Math.abs((f.groundY ?? 0) - ground) < 1e-9);
      if (rising) st.counts.risingLandings++;
      else if (Math.abs(ground - Ld.y) >= 1e-9) v.push(`${tag} f${i}: pousou em y ${Ld.y} sem apoio real ali (apoio ${ground})`);
    }
  });
  // solver: resíduo ≤ tolerância, ou o escape foi emitido
  st.counts.residualMax = Math.max(st.counts.residualMax, physicsProbe.staticResidualMax);
  if (physicsProbe.staticResidualMax > TOL() + 1e-12 && !g.lastStepEvents.some((/** @type {any} */ e) => e.result === 'pinEscape')) v.push(`${tag}: resíduo ${physicsProbe.staticResidualMax} > ${TOL()} sem pinEscape`);
  st.counts.pinEscapes += g.lastStepEvents.filter((/** @type {any} */ e) => e.result === 'pinEscape').length;
  for (const e of g.world.entities) if (!e.dead && e.pos && !(fin(e.pos.x) && fin(e.pos.z) && (e.y === undefined || fin(e.y)))) v.push(`${tag}: entidade ${e.kind}#${e.id} com posição não finita`);
  // eventos: contrato canônico, eventId único e crescente na rodada
  for (const e of g.lastStepEvents) {
    for (const err of validateCombatEvent(e)) v.push(`${tag} ${e.result}#${e.eventId}: ${err}`);
    if (st.ids.has(e.eventId)) v.push(`${tag}: eventId ${e.eventId} repetido`);
    if (!(e.eventId > st.lastEventId)) v.push(`${tag}: eventId ${e.eventId} não cresce (último ${st.lastEventId})`);
    st.ids.add(e.eventId);st.lastEventId = e.eventId;st.counts.events++;
    if (e.result === 'impact') st.counts.impacts++;
    if (e.hpDamage > 0 && e.targetId != null) st.counts.damage += e.hpDamage;
  }
  return {v, ms};
}

/**
 * Sessão de `seconds` s de simulação IA × IA: rodadas em sequência (o jogo não tem relógio de rodada; KO encerra a rodada e o harness reinicia o
 * Game como o «Iniciar» do laboratório, com sementes novas nas IAs como applySeed de app/match-flow.js) até somar `seconds` s de passos.
 * O placar de melhor de três sai das três primeiras rodadas. Intervalos de 45 s e preparação de 90 s NÃO existem no jogo (não simulados).
 */
export function session(/** @type {number} */ seed, /** @type {number} */ seconds, {timings = null} = /** @type {{timings?: number[] | null}} */ ({})) {
  prepConfig();const {g, L} = newMatch(seed);
  const rounds = [], violations = /** @type {string[]} */ ([]), budget = seconds * SPS;
  let total = 0;
  damageLedger.entries = [];
  try {
    for (let r = 0; total < budget && violations.length <= 30; r++) {
      if (r) {const s = seed * 1000 + r;g.brain.seed = s;g.playerBrain.seed = s + 7919;nextRound(g);}
      const st = {lastEventId: 0, ids: new Set(), counts: {frozen: 0, landings: 0, risingLandings: 0, residualMax: 0, pinEscapes: 0, events: 0, impacts: 0, damage: 0}};
      let t = 0;
      for (; total < budget && (g.phase === 'playing' || g.phase === 'finishing'); t++, total++) {
        const {v, ms} = watchedStep(g, st);timings?.push(ms);
        if (v.length) violations.push(...v.map(x => `semente ${seed} rodada ${r + 1} ${x}`));
        if (damageLedger.entries.length > 4096) damageLedger.entries.length = 0;   // o livro só precisa do passo corrente
        if (violations.length > 30) break;
      }
      const winner = g.phase === 'result' ? g.winner : null;
      rounds.push({round: r + 1, steps: t, seconds: +(t / SPS).toFixed(2), end: g.phase === 'result' ? 'KO' : 'fim da sessão', winner, hp: g.fighters.map((/** @type {any} */ f) => f.hp), ...st.counts, residualMax: +st.counts.residualMax.toExponential(3)});
    }
  } finally {damageLedger.entries = null;}
  const wins = [0, 0];let bo3 = null;
  for (const r of rounds.slice(0, 3)) {if (r.winner === 0 || r.winner === 1) wins[r.winner]++;if (bo3 == null && (wins[0] === 2 || wins[1] === 2)) bo3 = wins[0] === 2 ? 0 : 1;}
  return {seed, loadouts: L, rounds, simSeconds: +(total / SPS).toFixed(2), bestOfThree: {wins, winner: bo3}, violations};
}
test(`partida IA × IA com invariantes em todo passo (${LENTO ? '4 sementes × sessão de 180 s (melhor de três nas 3 primeiras rodadas)' : 'fumaça: 1 semente × 25 s'})`, () => {
  assert.equal(SPS, Math.round(1 / C.test.step), 'passo fixo de 120 Hz');
  const seeds = LENTO ? [1, 2, 3, 4] : [5], secs = LENTO ? 180 : 25, timings = /** @type {number[]} */ ([]);
  const t0 = performance.now(), matches = seeds.map(s => session(s, secs, {timings}));
  const wall = performance.now() - t0, all = matches.flatMap(m => m.violations);
  assert.deepEqual(all.slice(0, 30), [], `${all.length} violações`);
  const tot = matches.flatMap(m => m.rounds).reduce((a, r) => ({events: a.events + r.events, impacts: a.impacts + r.impacts, frozen: a.frozen + r.frozen, landings: a.landings + r.landings, risingLandings: a.risingLandings + r.risingLandings, pinEscapes: a.pinEscapes + r.pinEscapes, rounds: a.rounds + 1}), {events: 0, impacts: 0, frozen: 0, landings: 0, risingLandings: 0, pinEscapes: 0, rounds: 0});
  assert.ok(tot.impacts > 0 && tot.frozen > 0, `a partida precisa ter golpes e hitstop para a prova valer (${JSON.stringify(tot)})`);
  const perf = stats(timings);
  // Orçamento de regressão: medido primeiro nesta máquina (i5-12450H: p50 0,075 · p95 0,17 · p99 0,34 ms em 86.400 passos; evidence/homologacao-f8/resultado.json) e fixado em
  // 2 ms (≈ 12× o medido; 24% do passo de 8,33 ms). Máximo isolado não entra (GC/escalonador do SO); p95 e p50 sim.
  assert.ok(perf.p95 < 2, `p95 por passo ${perf.p95.toFixed(3)} ms ≥ orçamento de 2 ms`);
  assert.ok(perf.p50 < 1, `p50 por passo ${perf.p50.toFixed(3)} ms ≥ 1 ms`);
  if (LENTO) record('partidas', {seeds, secondsPerSession: secs, wallSeconds: +(wall / 1000).toFixed(1), totals: tot, stepTimeMs: perf, budgetMs: {p95: 2, p50: 1},
    matches: matches.map(m => ({seed: m.seed, simSeconds: m.simSeconds, bestOfThree: m.bestOfThree, loadouts: m.loadouts, rounds: m.rounds, violations: m.violations.length}))});
});

// ------------------------------------------------------------------------------------------------ evidência (só --lento)
function stats(/** @type {number[]} */ xs) {
  const a = [...xs].sort((p, q) => p - q), q = (/** @type {number} */ p) => a[Math.min(a.length - 1, Math.floor(p * a.length))] ?? 0;
  return {steps: a.length, p50: +q(.5).toFixed(4), p95: +q(.95).toFixed(4), p99: +q(.99).toFixed(4), max: +(a[a.length - 1] ?? 0).toFixed(4), mean: +(a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)).toFixed(4)};
}
/** @type {Record<string, any>} */
const sim = {};
function record(/** @type {string} */ k, /** @type {any} */ v) {sim[k] = v;}
if (LENTO) {
  test('evidência: replay, resets, bench:moves e gravação de resultado.json (seção sim)', async () => {
    const t0 = performance.now();
    const alt = alternation(3000), sl = saveLoad(21, 3600, [1, 600, 1777, 3000]), rc = resetCycles(100, 600);
    record('replay', {alternation: {steps: alt.n, seeds: alt.seeds, identicalA: alt.diffA === null, identicalB: alt.diffB === null, eventsA: alt.eventsA, eventsB: alt.eventsB, contactEvents: alt.contactEvents},
      saveLoad: {seed: 21, steps: 3600, cuts: sl.map(r => ({cut: r.cut, target: r.fresh ? 'Game novo' : 'mesmo Game', identical: r.diff === null}))}});
    record('resets', {cycles: rc.cycles, ticksPerCycle: rc.ticks, distinctFinalStates: rc.distinctFinalStates, grew: rc.grew, eventsCap: rc.events, entities: rc.entities, passiveProcessed: rc.passiveProcessed, spawnLogMax: rc.spawnLogMax, largestCollections: rc.largest});
    const {runBench, toMarkdown} = await import('../bench-moves.mjs');
    const b = runBench({repeats: 3, ticks: 1800});
    mkdirSync(EVID, {recursive: true});writeFileSync(EVID + 'bench-moves.md', toMarkdown(b));
    record('benchMoves', {command: 'runBench({repeats: 3, ticks: 1800}) — o mesmo de `npm run bench:moves`, sem --write (relatório completo em bench-moves.md)', budgetUsPerStep: b.budgetUsPerStep,
      rows: b.rows.map((/** @type {any} */ x) => ({id: x.id, p50us: x.p50, p95us: x.p95, p99us: x.p99, maxUs: x.max, budgetPctP95: x.budgetPctP95, maxEntities: x.maxEntities, noisy: x.noisy}))});
    let commit = 'desconhecido';try {commit = execSync('git rev-parse --short HEAD', {cwd: EVID}).toString().trim();} catch {}
    const file = EVID + 'resultado.json', prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    writeFileSync(file, JSON.stringify({...prev, geradoEm: new Date().toISOString(), commitBase: commit, maquina: {cpu: cpus()[0]?.model, nucleos: cpus().length, node: process.version, plataforma: process.platform},
      sim: {...sim, extraWallSeconds: +((performance.now() - t0) / 1000).toFixed(1)}}, null, 1) + '\n');
    assert.ok(alt.diffA === null && alt.diffB === null && sl.every(r => r.diff === null) && rc.grew.length === 0 && rc.distinctFinalStates === 1);
  });
}
