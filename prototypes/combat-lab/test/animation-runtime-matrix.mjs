// Matriz dinâmica de animações no runtime: personagem | ação | gatilho real | clipe configurado | clipe executado | frames | parâmetros | fallback | classificação | resultado.
// Tudo vem do que o Character TOCOU durante as partidas dos cenários (animation-runtime-scenarios.mjs); nada é declarado à mão exceto a lista de reservas.
// Critério de aprovação POR EXECUÇÃO (sem falsos positivos): cada exercício do clipe é segmentado em execuções e classificado
// (CONCLUIDA_NATURALMENTE / INTERROMPIDA_POR_NOVA_ACAO / INTERROMPIDA_POR_REACAO / CORTADA_INDEVIDAMENTE / FALLBACK / SEM_CLIPE / NAO_ALCANCADA);
// aprovação exige classificação positiva + duração mínima + peso máximo — um clipe de 1–4 frames ou peso 0,05 NUNCA é aprovado.
import {loadRealSource, configurableActions, makeMatch} from './animation-runtime-harness.mjs';
import {SCENARIOS} from './animation-runtime-scenarios.mjs';

/** Ações que só tocam quando o clipe primário do estado NÃO está configurado (cadeia de reserva documentada em STATE_ACTIONS): provadas no personagem sintético por cenários com `omit`. */
export const RESERVA = new Set(['hit', 'fall', 'downed', 'move_1', 'move_2', 'move_3', 'move_4']);

/** Classificações exatas de uma execução (contrato). */
export const CLASSIFICACOES = ['CONCLUIDA_NATURALMENTE', 'INTERROMPIDA_POR_NOVA_ACAO', 'INTERROMPIDA_POR_REACAO', 'CORTADA_INDEVIDAMENTE', 'FALLBACK', 'SEM_CLIPE', 'NAO_ALCANCADA'];

/** Ações de laço/estado contínuo: não têm «fim natural»; para elas, CONCLUIDA_NATURALMENTE significa «mantida pelo tempo mínimo de prova». */
export const LOOPING_IDS = new Set(['idle', 'turn', 'walk', 'walk_back', 'walk_left', 'walk_right', 'sprint', 'sprint_back', 'sprint_left', 'sprint_right', 'block', 'tackle_charge', 'charge_reflect', 'charge_psyshock']);
/** Estados de reação/dano: uma transição para qualquer um deles é INTERROMPIDA_POR_REACAO. */
const REACTION_TO = new Set(['hitstun', 'stagger', 'stagger_crush', 'pushed', 'pushed_side', 'airborne', 'airborne_up', 'wallSplat', 'landing', 'recover', 'defeated', 'guardStun', 'recoil', 'guard_hit', 'actionRecovery']);
/** Reasons que autorizam a troca para a ação que realmente nasceu. */
const NOVA_ACAO_REASONS = new Set(['nova ação', 'nova ação (mesmo estado)', 'cancelamento C → X', 'esquiva → sprint']);
/** Estados de locomoção/neutralidade/parada: troca para eles é o corte indevido quando nada autorizou. */
const LOCO_TO = new Set(['neutral', 'turn', 'walk', 'walk_back', 'walk_left', 'walk_right', 'sprint', 'sprint_back', 'sprint_left', 'sprint_right', 'walk_stop', 'sprint_stop', 'guard_exit']);
/** Destinos de frenagem física real com clipe de parada dedicado: sucessores autorizados (decisão do responsável). */
const STOP_TO = new Set(['walk_stop', 'sprint_stop']);

const STEP = 1 / 120;

function union(builds) {
  const all = new Map();
  for (const m of builds) for (const [k, v] of m.rec.reached) {const cur = all.get(k);if (!cur) all.set(k, {...v, keys: new Set(v.keys), clips: new Set(v.clips), cenarios: new Set([v.scenario])});else {for (const c of v.clips) cur.clips.add(c);cur.frames += v.frames;cur.cenarios.add(v.scenario);cur.maxTime = Math.max(cur.maxTime, v.maxTime);cur.minTime = Math.min(cur.minTime, v.minTime);cur.maxWeight = Math.max(cur.maxWeight, v.maxWeight);for (const x of v.keys) cur.keys.add(x);}}
  return all;
}

/** Roda todos os cenários com os personagens dados (sources = GLBs reais, ou null = sintético com um clipe por ação). */
export function runAll(sources = null) {
  const builds = SCENARIOS.map(s => s.build(sources ? {sources} : {}));
  return {builds, reached: union(builds), actions: configurableActions()};
}

/** Clipe CONFIGURADO de uma ação, como o Editor o grava (variants; charge_/release_ em moveAnims). null = nenhum. */
export function configuredClips(ch, a) {
  if (a.kind === 'charge' || a.kind === 'release') {const conf = ch.moveAnims?.[a.move], i = a.kind === 'charge' ? conf?.chargeClip : conf?.releaseClip;return i != null && ch.clips[i] ? [ch.clips[i].name] : [];}
  return (ch.variants[a.id] || []).filter(i => ch.clips[i]).map(i => ch.clips[i].name);   // várias variantes: a entrada sorteia uma (determinística)
}

/**
 * Segmenta o fluxo de frames de uma partida em EXECUÇÕES: uma execução = sequência contínua de frames do mesmo (lutador, id de ação).
 * Nova execução quando o id muda, quando a entrada (`key#serial`) muda ou quando o tempo do clipe reinicia no meio (reentrada).
 * Fecha cada execução com a PRÓXIMA entrada do log de transições que sai dela (entries com reason 'conclusão visual' não fecham: marcam o início do epílogo).
 */
export function executions(run) {
  const exs = [], open = new Map(), byWhoKey = new Map();
  for (const f of run.rec.frames) {
    const kk = `${f.who}|${f.key}`;
    let e = open.get(kk);
    if (e) {
      const dur = f.duration || e.duration || 1, regress = e.lastTime - f.time;
      const restarted = f.id !== e.id || (f.entry && e.lastEntry && f.entry !== e.lastEntry) || (regress > 1e-3 && e.lastTime < 0.5 * dur);   // laço legítimo recomeça do ~cap; reentrada reinicia do meio
      if (restarted) e = null;
    }
    if (!e) {
      e = {who: f.who, id: f.id, key: f.key, clip: f.clip, firstTick: f.tick, lastTick: f.tick, frames: 0, minTime: Infinity, maxTime: -Infinity, maxWeight: 0, duration: f.duration ?? null, keys: new Set(), lastTime: 0, lastEntry: f.entry, endLog: null, entry: f.entry, index: f.index, firstTime: f.time, weights: [], epTimes: [], releaseTick: null};
      open.set(kk, e);exs.push(e);
      let l = byWhoKey.get(kk);if (!l) byWhoKey.set(kk, l = []);l.push(e);
    }
    e.frames++;e.minTime = Math.min(e.minTime, f.time);e.maxTime = Math.max(e.maxTime, f.time);
    e.maxWeight = Math.max(e.maxWeight, f.weight);e.keys.add(f.key);e.weights.push(f.weight);if (f.epilogue) {e.epTimes.push(f.time);e.releaseTick ??= f.tick;}e.lastTick = f.tick;e.lastTime = f.time;e.lastEntry = f.entry;e.duration = f.duration ?? e.duration;
  }
  const logs = run.rec.logs;
  for (const [kk, list] of byWhoKey) {
    const who = list[0].who, key = list[0].key;
    const cand = logs.filter(l => l.who === who && l.from === key && l.reason !== 'conclusão visual');
    let ci = 0;
    for (const [xi, e] of list.entries()) {
      while (ci < cand.length && cand[ci].tick < e.firstTick) ci++;
      e.endLog = ci < cand.length && cand[ci].tick <= e.lastTick + 1 ? cand[ci] : null;   // +1 tick: o enter do próximo estado ocorre no passo seguinte ao último frame
      if (e.endLog) ci++;
      // Reentrada pelo mesmo clipe (nova execução da mesma ação nascendo em cima da anterior): o caminho de reuso não
      // gera entrada de log — a interrupção é autorizada (nova ação) e fica evidenciada pela execução seguinte imediata.
      const nxt = list[xi + 1];
      e.restartedBySameAction = !e.endLog && !!nxt && nxt.firstTick <= e.lastTick + 3;
    }
  }
  return exs;
}

/** Percentual do clipe efetivamente tocado numa execução (do log de fechamento, ou do último tempo observado). */
export function playedPct(e) {
  if (e.endLog && typeof e.endLog.playedPct === 'number') return e.endLog.playedPct;
  return e.duration ? +(100 * e.maxTime / e.duration).toFixed(1) : 0;
}

/** Classifica UMA execução numa das strings exatas do contrato. `cfgs` = nomes dos clipes configurados para a ação. */
export function classifyExecution(e, cfgs, {looping = false} = {}) {
  if (e.clip && cfgs.length && !cfgs.includes(e.clip)) return 'FALLBACK';
  const log = e.endLog, reason = log?.reason ?? null, to = log?.to ?? null, pct = playedPct(e);
  if (reason === 'reação de combate' || REACTION_TO.has(to)) return 'INTERROMPIDA_POR_REACAO';
  if (NOVA_ACAO_REASONS.has(reason)) return 'INTERROMPIDA_POR_NOVA_ACAO';
  const full = pct >= 95 || (e.duration && e.maxTime >= e.duration - STEP * 1.5 && !log);
  if (reason === 'conclusão natural' || full) return 'CONCLUIDA_NATURALMENTE';
  if (!log && e.restartedBySameAction) return 'INTERROMPIDA_POR_NOVA_ACAO';   // reentrada pelo mesmo clipe: nova execução nasceu
  // DECISÃO do responsável: frenagem física real com clipe de parada dedicado (walk_stop/sprint_stop) é SUCESSORA
  // AUTORIZADA — não é corte indevido. Usa a classe das interrupções autorizadas (as strings do contrato se mantêm).
  if (reason === 'freio físico' && STOP_TO.has(to)) return 'INTERROMPIDA_POR_NOVA_ACAO';
  // Liberação mecânica («ação concluída»/«ação cancelada (defesa)»/início de epílogo) antes do fim do clipe:
  // troca para locomoção/neutral/idle SEM ação que nasceu = o falso positivo que este critério elimina (pós-correção do epílogo, raro/zero).
  // Cancela de verdade (defesa, esquiva) tem destino que não é locomoção e permanece troca autorizada.
  if (reason === 'ação concluída' || reason === 'ação cancelada (defesa)' || reason === 'conclusão visual') {
    if (LOCO_TO.has(to) || !to) return 'CORTADA_INDEVIDAMENTE';
    return 'INTERROMPIDA_POR_NOVA_ACAO';
  }
  // Progressão de fase/estado (o reason caiu no fallback = nome da chave de destino: jump_start→jump_rise, charge→release,
  // ledge_grab→ledge_hang…): o sucessor é o estado que realmente nasceu — troca autorizada, não corte.
  if (to && (reason === to || reason === 'transição curta')) return 'INTERROMPIDA_POR_NOVA_ACAO';
  if (looping && e.frames >= minFrames(e)) return 'CONCLUIDA_NATURALMENTE';
  return 'CORTADA_INDEVIDAMENTE';
}

/** Duração mínima de prova: ≥ 8 frames OU ≥ 25% do clipe, o que for MENOR. */
export function minFrames(e, step = STEP) {
  const clipFrames = e.duration ? Math.round(e.duration / step) : 0;
  return Math.max(1, Math.min(8, Math.ceil(clipFrames * 0.25)));
}

/** Aprovação de UMA execução: classificação positiva + duração mínima + peso máximo ≥ 0,3; clipe de 1–4 frames NUNCA. */
export function approvedExecution(e, classificacao, step = STEP) {
  if (!['CONCLUIDA_NATURALMENTE', 'INTERROMPIDA_POR_NOVA_ACAO', 'INTERROMPIDA_POR_REACAO'].includes(classificacao)) return false;
  const clipFrames = e.duration ? Math.round(e.duration / step) : 0;
  if (clipFrames > 0 && clipFrames < 5) return false;
  if (e.frames < minFrames(e, step)) return false;
  if (!(e.maxWeight >= 0.3)) return false;
  return true;
}

/** Motivo da não aprovação (texto curto para a coluna resultado). */
function motive(e, classificacao, step = STEP) {
  if (classificacao === 'FALLBACK') return `tocou «${e.clip}» fora da lista configurada`;
  if (classificacao === 'CORTADA_INDEVIDAMENTE') return `cortada para «${e.endLog?.to ?? '?'}» (${e.endLog?.reason ?? 'sem log'}) com ${playedPct(e)}% do clipe`;
  const clipFrames = e.duration ? Math.round(e.duration / step) : 0;
  if (clipFrames > 0 && clipFrames < 5) return `clipe de ${clipFrames} frame(s) (muito curto para provar execução)`;
  if (e.frames < minFrames(e, step)) return `só ${e.frames} frame(s) (mínimo ${minFrames(e, step)})`;
  if (!(e.maxWeight >= 0.3)) return `peso máximo ${e.maxWeight.toFixed(2)} (< 0,3)`;
  return '';
}

/** Contagens por classificação das linhas de UM personagem. */
export function countByClassificacao(rows) {
  const c = Object.fromEntries(CLASSIFICACOES.map(k => [k, 0]));
  for (const r of rows) if (r.classificacao) c[r.classificacao]++;
  return c;
}

/** Linhas da matriz de UM personagem. `chars` = {ch, name}. Cada ação agrega TODAS as suas execuções nos cenários. */
export function rowsFor(name, ch, run, synthetic, who = 0) {
  const all = run.builds.flatMap(b => executions(b)).filter(e => synthetic || e.who === who);
  return run.actions.map(a => {
    // sintético: os dois lutadores têm os mesmos clipes (vale quem tocou); real: só o lutador `who` (cada modelo tem os seus clipes)
    const mine = all.filter(e => e.id === a.id);
    const cfgs = configuredClips(ch, a), cfg = cfgs[0] ?? null;
    const looping = LOOPING_IDS.has(a.id);
    const detalhes = mine.map(e => ({e, cls: classifyExecution(e, cfgs, {looping})}));
    const aprovadas = detalhes.filter(d => approvedExecution(d.e, d.cls));
    const aprovada = aprovadas.length > 0 && aprovadas.some(d => d.cls !== 'FALLBACK');
    let classificacao = null;
    if (!cfg) classificacao = 'SEM_CLIPE';
    else if (!mine.length) classificacao = RESERVA.has(a.id) && !synthetic ? null : 'NAO_ALCANCADA';   // reserva: primário presente, nada a provar
    else if (aprovada) classificacao = aprovadas[0].cls;
    else classificacao = [...detalhes].sort((x, y) => y.e.frames - x.e.frames)[0].cls;
    const r0 = run.reached.get(`${who}:${a.id}`), r1 = synthetic ? run.reached.get(`${1 - who}:${a.id}`) : null;
    const frames = (r0?.frames ?? 0) + (r1?.frames ?? 0), maxWeight = Math.max(r0?.maxWeight ?? 0, r1?.maxWeight ?? 0);
    const minTime = Math.min(r0?.minTime ?? Infinity, r1?.minTime ?? Infinity), maxTime = Math.max(r0?.maxTime ?? -Infinity, r1?.maxTime ?? -Infinity);
    const gatilho = (r0 ?? r1)?.scenario ?? '—';
    const exec = detalhes[0]?.e.clip ?? '—';
    const fallbackKeys = [...new Set(mine.flatMap(e => [...e.keys]))];
    const fallback = detalhes.find(d => d.cls === 'FALLBACK')?.e.clip ?? 'não';
    let resultado;
    if (!cfg) resultado = synthetic ? 'FALHA: sem clipe configurado no personagem de teste' : 'sem clipe configurado (nada a provar)';
    else if (!mine.length) resultado = RESERVA.has(a.id) && !synthetic ? 'reserva (primário presente)' : 'FALHA: configurada e nunca tocada no gameplay';
    else if (aprovada) resultado = `aprovada por execução (${aprovadas.length}× ${aprovadas[0].cls})`;
    else resultado = `não aprovada: ${motive([...detalhes].sort((x, y) => y.e.frames - x.e.frames)[0].e, classificacao)}`;
    return {personagem: name, acao: a.id, gatilho, configurado: cfg ?? '—', executado: exec, frames, params: mine.length ? `tempo ${minTime.toFixed(2)}–${maxTime.toFixed(2)} s · peso ${maxWeight.toFixed(2)}` : '—', fallback, classificacao: classificacao ?? '—', resultado, estados: fallbackKeys.join(',')};
  });
}

export const toMarkdown = rows => ['| personagem | ação | gatilho real | clipe configurado | clipe executado | frames | parâmetros aplicados | fallback | classificação | resultado |', '|---|---|---|---|---|---|---|---|---|---|', ...rows.map(r => `| ${r.personagem} | \`${r.acao}\` | ${r.gatilho} | ${r.configurado} | ${r.executado} | ${r.frames} | ${r.params} | ${r.fallback} | ${r.classificacao} | ${r.resultado} |`)].join('\n');
