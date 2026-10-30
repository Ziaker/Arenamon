// Matriz dinâmica de animações no runtime: personagem | ação | gatilho real | clipe configurado | clipe executado | frames | parâmetros | fallback | resultado.
// Tudo vem do que o Character TOCOU durante as partidas dos cenários (animation-runtime-scenarios.mjs); nada é declarado à mão exceto a lista de reservas.
import {loadRealSource, configurableActions, makeMatch} from './animation-runtime-harness.mjs';
import {SCENARIOS} from './animation-runtime-scenarios.mjs';

/** Ações que só tocam quando o clipe primário do estado NÃO está configurado (cadeia de reserva documentada em STATE_ACTIONS): provadas no personagem sintético por cenários com `omit`. */
export const RESERVA = new Set(['hit', 'fall', 'downed', 'move_1', 'move_2', 'move_3', 'move_4']);

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

/** Linhas da matriz de UM personagem. `chars` = {ch, name}. */
export function rowsFor(name, ch, run, synthetic, who = 0) {
  return run.actions.map(a => {
    // sintético: os dois lutadores têm os mesmos clipes (vale quem tocou); real: só o lutador `who` (cada modelo tem os seus clipes)
    const r0 = run.reached.get(`${who}:${a.id}`), r1 = synthetic ? run.reached.get(`${1 - who}:${a.id}`) : null, r = r0 && r1 ? {...r0, frames: r0.frames + r1.frames, keys: new Set([...r0.keys, ...r1.keys]), clips: new Set([...r0.clips, ...r1.clips]), maxWeight: Math.max(r0.maxWeight, r1.maxWeight)} : r0 ?? r1;
    const cfgs = configuredClips(ch, a), cfg = cfgs[0] ?? null;
    const gatilho = r ? r.scenario : '—';
    const exec = r ? r.clip : '—';
    const fallbackKeys = r ? [...r.keys] : [];
    let resultado, fallback = 'não';
    if (!cfg) {resultado = synthetic ? 'FALHA: sem clipe configurado no personagem de teste' : 'sem clipe configurado (nada a provar)';}
    else if (!r) resultado = RESERVA.has(a.id) && !synthetic ? 'reserva (primário presente)' : 'FALHA: configurada e nunca tocada no gameplay';
    else if (![...(r.clips ?? [r.clip])].every(c => cfgs.includes(c))) {resultado = `FALHA: tocou «${r.clip}» no lugar de «${cfg}»`;fallback = r.clip;}
    else if (r.frames < 1 || !(r.maxWeight > .05)) resultado = 'FALHA: tocou sem efeito no mixer (' + r.frames + ' quadros, peso ' + r.maxWeight.toFixed(2) + ')';
    else resultado = 'OK';
    return {personagem: name, acao: a.id, gatilho, configurado: cfg ?? '—', executado: exec, frames: r?.frames ?? 0, params: r ? `tempo ${r.minTime.toFixed(2)}–${r.maxTime.toFixed(2)} s · peso ${r.maxWeight.toFixed(2)}` : '—', fallback, resultado, estados: fallbackKeys.join(',')};
  });
}

export const toMarkdown = rows => ['| personagem | ação | gatilho real | clipe configurado | clipe executado | frames | parâmetros aplicados | fallback | resultado |', '|---|---|---|---|---|---|---|---|---|', ...rows.map(r => `| ${r.personagem} | \`${r.acao}\` | ${r.gatilho} | ${r.configurado} | ${r.executado} | ${r.frames} | ${r.params} | ${r.fallback} | ${r.resultado} |`)].join('\n');
