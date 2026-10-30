// Conclusão visual independente (correção central do sistema de animações):
//   • A chave visual deixa de ser projeção 1:1 do estado mecânico: uma execução única (tackle, esquiva, Move,
//     disparo, recuperação, pouso…) NÃO concluída segue tocando até o fim efetivo do clipe quando a simulação
//     já a liberou (f.action zerado, knockRecovery esgotado, pouso com recuperação mecânica zero). A locomoção
//     física continua imediata — o personagem se desloca enquanto o clipe termina.
//   • SOMENTE VISUAL: nunca modifica o estado autoritativo do lutador (`f`); exceção documentada: o marcador
//     `f.__visualEpilogue` (campo inerte que o sim nunca lê) é gravado a cada quadro de epílogo APENAS para que
//     save/load e replays de quadros reconstruam a mesma sequência visual (o Character não viaja no save); ele é
//     apagado no fim/interrupção do epílogo e consumido numa única restauração (resumeEpilogue).
//   • Telemetria: a entrada no epílogo registra «conclusão visual» (epilogue: true); o fim natural registra
//     «conclusão natural» (epilogueEnd: true, playedPct: 100); interrupções por autoridade saem pela transição
//     normal do quadro, marcada com epilogueEnd: true. Conclusões naturais NÃO inflam `interrupted`.
//
// As funções operam sobre a instância Character (`ch`) recebida: leem `current`, `clock`, `playbackOf`,
// `speedOf`, `variantsOf`, `clips`, `log` e mantêm o estado em `ch.epilogue = {key, id, entry, started, cap?, baseElapsed?}`.
import {C} from '../sim/config.js';
import {actionDuration, actionSpec} from '../sim/entity.js';
import {trimOf} from '../sim/animation-profile.js';
import {MOVE_KEYS, TIMED, ONE_SHOT, ACTION_KEYS, COMBAT_KEYS, LOCOMOTION, TRANSIENT} from './characters.js';

/** Chaves novas que são sucessoras legítimas: o clipe dedicado de recuperação assume (fade normal, sem epílogo). */
const SUCCESSORS = new Set(['recovery_tackle', 'recovery_dodge', 'recovery_move']);
/** Estados mecânicos que são autoridade sobre o visual: reagem imediatamente (o epílogo nunca os atrasa). */
const AUTHORITY_STATES = new Set(['hitstun', 'stagger', 'pushed', 'wallSplat', 'defeated', 'guardStun', 'recover']);
/** Execução única elegível: chaves temporizadas pela simulação, one-shot, disparos de Move e recuperações. */
/** Reações e transições de execução única cujo laço padrão é «sim» (não estão em ONE_SHOT/TIMED): empurrão, empurrão lateral e subida
 * da borda tocada por clipe de reserva. Sem isso o clipe era cortado no fim mecânico (ex.: «get hit» com 0,35 s de 1,29 s). Laço explícito
 * do Editor continua valendo (fica de fora, como os demais laços). */
const ONCE_EXTRA = new Set(['pushed', 'pushed_side', 'ledge_climb']);
const epilogueKey = key => ONE_SHOT.has(key) || TIMED.has(key) || ONCE_EXTRA.has(key) || key.startsWith('release_');
/** Laço efetivo para o epílogo: nas ONCE_EXTRA só o laço ligado explicitamente no Editor conta. */
const loops = (ch, id, key) => ONCE_EXTRA.has(key) ? ch.playback?.[id]?.loop === true : ch.playbackOf(id, key).loop;

/** Estado mecânico autoritativo ativo? Enquanto houver autoridade, o epílogo não entra e o ativo o encerra. */
export function epilogueAuthority(f, cur = null) {
  // Fase «apex» de um salto normal: o voo em si NÃO é autoridade (a fase seguinte, jump_fall, é a sucessora natural); pousar ou qualquer outra autoridade encerra.
  const apexFlight = cur?.key === 'jump_apex' && !!f.flight?.isNormalJump;
  if (cur?.key === 'jump_apex' && !f.flight) return true;
  return !!(f.action || f.hp <= 0 || (f.flight && !apexFlight) || f.ledge || f.guard || f.charge || f.tackleCharge
    || (f.knockRecovery ?? 0) > 0 || AUTHORITY_STATES.has(f.state));
}

/** Limpa o estado de epílogo (resetVisual, troca de associações, prévia). */
export function clearEpilogue(ch) {ch.epilogue = null;ch.epilogueInterrupt = false;}
export function epilogueActive(ch) {return !!ch.epilogue;}

/** Cap efetivo do clipe da camada (duração × velocidade, limitado por maxDuration): o fim do epílogo. */
function capOf(ch, layer) {
  const d = layer.clip.duration || 1, s = ch.speedOf(layer.id), playback = ch.playbackOf(layer.id, layer.key);
  return Math.min(d, playback.maxDuration > 0 ? playback.maxDuration * s : d);
}
/**
 * Tempo restante até o fim EFETIVO, no sentido em que o clipe avança: respeita o Fim do recorte (trimEnd) e o
 * Reverso (o tempo exibido vai para o início; o avanço real é cap − tempo). Sem isso o epílogo nunca concluía
 * com recorte ou reverso (o tempo para em trimEnd·d ou em 0, nunca em cap).
 */
function remainingOf(ch, layer, cap = capOf(ch, layer)) {
  const d = layer.clip.duration || 1, fx = ch.profileFx(layer), end = Math.min(cap, (fx ? trimOf(fx)[1] : 1) * d);
  const reversed = !!ch.profileValue(layer.id, 'reverse', layer.clip.name), forward = reversed ? cap - layer.action.time : layer.action.time;
  return end - forward;
}

/**
 * Marcador de save/load: grava no lutador o estado do epílogo em curso (viaja no structuredClone do save;
 * campo inerte para o sim). Atualizado a cada quadro do epílogo; apagado no fim/interrupção.
 */
export function markEpilogue(ch, f) {
  const e = ch.epilogue, cur = ch.current;
  if (!e || !cur || cur.entry !== e.entry || !f || typeof f !== 'object') return;
  f.__visualEpilogue = {key: e.key, id: cur.id, entry: e.entry, index: cur.index, time: cur.action.time, cap: e.cap ?? capOf(ch, cur)};
}
export function clearEpilogueMark(f) {if (f && typeof f === 'object' && f.__visualEpilogue) delete f.__visualEpilogue;}

/**
 * Restaura o epílogo a partir do marcador do save (personagens NOVOS pós-load/replay: o Character é estado
 * puramente visual e não viaja no save). Reconstrói a camada exata — mesma variante, mesmo tempo do clipe,
 * peso pleno, sem fades pendentes — e devolve true; o update segue o passo normal do epílogo no mesmo quadro.
 * O marcador é consumido numa restauração só; entradas inválidas (clipe removido, autoridade ativa, laço
 * autoritário) são descartadas e o fluxo normal assume.
 */
export function resumeEpilogue(ch, f, ctx) {
  const m = f.__visualEpilogue;
  clearEpilogueMark(f);   // consome o marcador: vale uma restauração
  if (!m || typeof m !== 'object' || !m.key || !epilogueKey(m.key)) return false;
  if (loops(ch, m.id, m.key) || epilogueAuthority(f)) return false;
  if (!ch.clips[m.index] || !(ch.variantsOf(m.id) || []).includes(m.index)) return false;
  ch.enter(m.key, m.id, m.index, m.entry, f, ctx);
  const cur = ch.current;
  for (const l of ch.layers) if (l.action !== cur.action) l.action.stop();   // a sequência original já estava sem fades
  ch.layers = [];
  cur.action.time = Math.max(0, Math.min(m.time ?? 0, m.cap ?? (cur.clip.duration || 1)));
  cur.started = ch.clock;
  // O relógio do epílogo recomeça um quadro antes do relógio do Character (já avançado neste update): o quadro da
  // restauração avança como qualquer quadro de continuação (mesma base do caminho normal de reentrada).
  ch.epilogue = {key: m.key, id: m.id, entry: m.entry, started: ch.clock - (ch.lastDt || C.test.step), cap: m.cap ?? capOf(ch, cur), baseElapsed: undefined};
  return true;
}

function pushLog(ch, ev) {ch.log.push(ev);if (ch.log.length > 400) ch.log.shift();}

/**
 * Entrada no epílogo: a mudança de estado iminente (`raw` novo) tentaria cortar uma execução única não concluída.
 * Devolve true se o epílogo assumiu (o clipe atual segue como camada atual; `enter()` NÃO é chamado).
 */
export function tryStartEpilogue(ch, f, raw, dt, ctx) {
  const cur = ch.current;
  if (!cur || !epilogueKey(cur.key)) return false;
  if (ch.profileValue(cur.id, 'visualCompletion', ch.clips[cur.index]?.name) === false) return false;   // Editor › Conclusão visual: desligada para esta ação/variante
  if (loops(ch, cur.id, cur.key)) return false;   // laços autorais sem condição de término ficam de fora por ora
  if (ch.preview || ch.movePreview || ch.transient || epilogueAuthority(f, cur)) return false;
  if (SUCCESSORS.has(raw)) return false;   // recovery_tackle/dodge/move: o clipe dedicado assume com fade normal
  const cap = capOf(ch, cur), s = ch.speedOf(cur.id);
  if (remainingOf(ch, cur, cap) <= (ch.lastDt || dt || C.test.step) * s) return false;   // já concluída (ou a 1 quadro do fim)
  ch.epilogue = {key: cur.key, id: cur.id, entry: cur.entry, started: ch.clock, cap, baseElapsed: undefined};
  // Camadas de fade pendentes encerram na hora (ex.: o blend de ENTRADA da própria ação ainda em curso numa
  // liberação mecânica mais curta que o fade): com o epílogo o clipe corrente é o dono da pose — peso pleno
  // desde o 1º quadro, sem residual fantasma misturando a pose neutra/locomotora durante a conclusão visual.
  for (const l of ch.layers) l.action.stop();
  ch.layers = [];
  markEpilogue(ch, f);
  const d = cur.clip.duration || 1;
  pushLog(ch, {t: +ch.clock.toFixed(3), tick: ctx.tick ?? null, from: cur.key, to: cur.key, clipFrom: ch.clips[cur.index]?.name, clipTo: ch.clips[cur.index]?.name,
    variant: ch.variantsOf(cur.id).indexOf(cur.index) + 1, variants: ch.variantsOf(cur.id).length,
    playedSeconds: +cur.action.time.toFixed(3), playedPct: +(Math.min(1, cur.action.time / d) * 100).toFixed(1),
    reason: 'conclusão visual', epilogue: true, interrupted: false, source: ctx.source || 'sistema'});
  return true;
}

/**
 * Cada quadro com epílogo ativo. Devolve 'continues' (o update usa a chave/entrada do epílogo e segura o clipe)
 * ou 'ended' (epílogo encerrado: o fluxo normal do update segue com `raw` — fade padrão para idle/locomoção).
 */
export function stepEpilogue(ch, f, raw, ctx) {
  const e = ch.epilogue, cur = ch.current;
  if (!e || !cur || cur.entry !== e.entry) {ch.epilogue = null;clearEpilogueMark(f);return 'ended';}
  if (ch.preview || ch.movePreview || ch.transient) {ch.epilogue = null;ch.epilogueInterrupt = true;clearEpilogueMark(f);return 'ended';}
  const cap = capOf(ch, cur), s = ch.speedOf(cur.id), frame = (ch.lastDt || C.test.step) * s;
  if (remainingOf(ch, cur, cap) <= frame) {
    // Fim natural: o clipe alcançou o fim efetivo. O próprio quadro segue o `raw` normal (fade padrão).
    pushLog(ch, {t: +ch.clock.toFixed(3), tick: ctx.tick ?? null, from: cur.key, to: raw, clipFrom: ch.clips[cur.index]?.name, clipTo: null,
      playedSeconds: +cur.action.time.toFixed(3), playedPct: 100, reason: 'conclusão natural', epilogueEnd: true, interrupted: false, source: ctx.source || 'sistema'});
    ch.epilogue = null;
    ch.epilogueNaturalEnd = true;   // Loop avançado: a transição DESTE quadro usa o conclusionBlend do clipe que concluiu
    clearEpilogueMark(f);
    return 'ended';
  }
  if (SUCCESSORS.has(raw) || epilogueAuthority(f, cur)) {
    // Interrupção por autoridade (reação, ação nova, defesa, voo…): a transição normal deste quadro assume;
    // o logTransition marca o evento com epilogueEnd: true para os testes distinguirem.
    ch.epilogue = null;
    ch.epilogueInterrupt = true;
    clearEpilogueMark(f);
    return 'ended';
  }
    return 'continues';
}

/**
 * Síntese do pouso (problema A3): aterrissagem com recuperação mecânica zero. `stateKey` devolveria neutro/
 * locomoção e o clipe «land» nem começava. Entra no estado visual `landing` com identidade própria (serial novo;
 * duas aterrissagens seguidas reiniciam o clipe do zero) e ativa o epílogo sobre ele (relógio livre do início ao
 * fim — o ramo TIMED usaria `progress` baseado em `landingRecovery`, que é zero nesse caso).
 */
export function synthesizeLanding(ch, f, raw, ctx) {
  if (f.hp <= 0 || f.wallSplat || f.ledge || (f.knockRecovery ?? 0) > 0 || f.state === 'landing') return false;
  if (!(raw === 'neutral' || LOCOMOTION.has(raw))) return false;
  const id = ch.actionFor('land');
  if (!id) return false;
  const entry = `landing#${++ch.actionSerial}`;
  const index = ch.pickVariant(id, (ctx.tick ?? Math.round(ch.clock * 120)) + ch.slot * 7349 + ch.actionSerial * 911);
  ch.enter('landing', id, index, entry, f, ctx);
  const cur = ch.current;
  cur.action.time = 0;cur.started = ch.clock;   // mesmo clipe servindo a aterrissagem anterior: recomeça do zero
  ch.epilogue = {key: 'landing', id: cur.id, entry, started: ch.clock, cap: capOf(ch, cur), baseElapsed: undefined};
  markEpilogue(ch, f);
  return true;
}

/** Progresso 0..1 dos estados com duração definida pela simulação (movido de characters.js; `ch` = Character). */
export function progressOf(ch, f, key) {
  const R = C.rules;
  if (key === 'tackle' || key === 'tackle_pl2' || key === 'tackle_pl3') return f.action ? f.action.elapsed / actionDuration('tackle') : 1;
  if (MOVE_KEYS.includes(key)) {
    if (f.action?.kind === 'move') return f.action.elapsed / Math.max(1e-6, actionSpec(f.action).duration || .4);
    const d = ch.current?.clip.duration || .4;
    return Math.min(1, Math.max(0, (ch.clock - (ch.current?.started ?? ch.clock)) / Math.max(1e-4, d / ch.speedOf(ch.current?.id || key))));
  }
  // Pulo físico: o clipe de salto acompanha o tempo de voo balístico (2·impulso ÷ gravidade).
  if (key === 'jump' && f.flight) {
    const g = f.flight.gravity || C.rules.launchGravity;
    const initialVy = Math.sqrt(2 * g * (C.map?.jumpHeight ?? 2.0));
    return Math.min(1, Math.max(0, (initialVy - f.flight.vy) / Math.max(1e-4, 2 * initialVy)));
  }
  if (key === 'vault' && f.action?.jump) return f.action.elapsed / Math.max(.05, 2 * C.actions.dodge.vaultUp / Math.max(.1, C.actions.dodge.vaultGravity));
  if (key.startsWith('dodge') || key === 'vault' || key === 'brake') return f.action ? f.action.elapsed / (actionDuration('dodge') * (f.action.durationScale ?? 1)) : 1;
  if (key === 'ledge_climb') return f.ledge ? Math.min(1, f.ledge.climbT / Math.max(1e-6, C.ledge?.climbTime ?? .5)) : 1;   // acompanha a subida da simulação (a física manda no tempo)
  if (key === 'recoil') return f.action ? f.action.elapsed / R.recoil : 1;
  if (key === 'guardStun') { const max = f.stunMax || R.guardStun || 0.15; return Math.min(1, Math.max(0, 1 - f.stun / Math.max(1e-6, max))); }
  if (key === 'landing') return Math.min(1, Math.max(0, 1 - (f.landingRecovery ?? f.knockRecovery) / Math.max(1e-6, f.landingRecoveryMax ?? R.landingRecovery)));
  if (key === 'recover') return Math.min(1, Math.max(0, 1 - (f.exhaustRecovery ?? f.knockRecovery) / Math.max(1e-6, C.extras.combat.exhaustRecovery)));
  if (key === 'hitstun') return Math.min(1, Math.max(0, 1 - (f.hitstun ?? f.knockRecovery) / Math.max(1e-6, f.hitstunMax || (R.hitstun ?? 0.2))));
  if (key === 'stagger') { const max = f.staggerMax || f.stunMax || 0.25; const cur = (f.stagger ?? f.counterStagger ?? f.stun ?? f.knockRecovery ?? 0); return Math.min(1, Math.max(0, 1 - cur / Math.max(1e-6, max))); }
  if (key === 'airborne' || key === 'airborne_up') return ch.flightV0 > 0 ? Math.min(1, Math.max(0, (ch.flightV0 - f.flight.vy) / (2 * ch.flightV0))) : 0;
  if (key === 'defeated') return Math.min(1, ch.timer / 1.2);
  // recovery_move/recovery_tackle/recovery_dodge são ONE_SHOT (relógio livre a partir da entrada): não usam progress().
  return 0;
}

/**
 * Telemetria da troca de estado (movida de characters.js): animação iniciada/substituída, tempo e porcentagem
 * tocados, motivo, estados anterior e seguinte e origem. Interrupções de epílogo saem marcadas com epilogueEnd.
 */
export function logTransition(ch, prev, key, id, index, f, ctx) {
  const d = prev ? prev.clip.duration || 1 : 1, played = prev ? prev.action.time : 0, pct = prev ? Math.min(1, played / d) : 0;
  const source = key === '__preview' ? 'prévia' : COMBAT_KEYS.has(key) || f.flight ? 'combate' : ACTION_KEYS.has(key) || key === 'guard' || key === 'guard_enter' || LOCOMOTION.has(key) || key === 'sprint' ? (ctx.source || 'jogador') : 'sistema';
  // Fim de X/C: concluída se o último tempo visto + um quadro alcança a duração; senão foi cancelada (defesa, sprint…).
  const seen = ch.lastActionSeen, natural = !!seen && seen.elapsed + (ch.lastDt || 0) * 1.05 + C.test.step >= actionDuration(seen.kind) - 1e-6;
  let reason = key === '__preview' ? 'prévia manual' : COMBAT_KEYS.has(key) ? 'reação de combate' : prev && ACTION_KEYS.has(prev.key) && !ACTION_KEYS.has(key) && !f.action ? (natural ? 'ação concluída' : key === 'sprint' ? 'esquiva → sprint' : 'ação cancelada (defesa)')
    : f.action?.fromCancel && key === 'tackle' ? 'cancelamento C → X' : ACTION_KEYS.has(key) ? (prev?.key === key ? 'nova ação (mesmo estado)' : 'nova ação')
    : COMBAT_KEYS.has(key) ? 'reação de combate' : key === 'sprint' ? 'sprint' : key.endsWith('_stop') ? 'freio físico' : TRANSIENT.has(key) ? 'transição curta' : LOCOMOTION.has(key) ? 'locomoção' : key;
  // Fim natural de ação não conta como interrupção (a última amostra pode cair um quadro antes do fim).
  // Troca do MESMO quadro em que o epílogo concluiu naturalmente: o clipe chegou ao fim efetivo (recorte/duração máxima podem deixá-lo antes
  // da duração bruta) — nunca é interrupção nem «cancelada». Antes saía como «ação cancelada (defesa)» interrompida a 77 % (Cogumelo, Move).
  const afterNatural = !!ch.afterNaturalEnd;ch.afterNaturalEnd = false;
  if (afterNatural && reason === 'ação cancelada (defesa)') reason = 'ação concluída';
  const interrupted = !afterNatural && prev && (TIMED.has(prev.key) || ONE_SHOT.has(prev.key)) && pct < .95 && reason !== 'ação concluída';
  const ev = {t: +ch.clock.toFixed(3), tick: ctx.tick ?? null, from: prev?.key ?? null, to: key, clipFrom: prev ? ch.clips[prev.index]?.name : null, clipTo: ch.clips[index].name,
    variant: ch.variantsOf(id).indexOf(index) + 1, variants: ch.variantsOf(id).length, playedSeconds: +played.toFixed(3), playedPct: afterNatural ? 100 : +(pct * 100).toFixed(1), reason, interrupted: !!interrupted, source,
    execFrom: prev?.entry ?? null, weightFrom: prev ? +prev.weight.toFixed(3) : null};   // identidade da execução que saiu (serial da ação) e o peso visual dela na saída
  if (ch.epilogueInterrupt) {ev.epilogueEnd = true;ch.epilogueInterrupt = false;}   // a transição normal encerra um epílogo interrompido por autoridade
  pushLog(ch, ev);
}
