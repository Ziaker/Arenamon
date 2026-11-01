// Melee G1 — MotionState (registro) + observador IASA. SOMENTE LEITURA.
//
//   • MotionState: projeção dos conjuntos de estados que o Character JÁ usa (ACTION_KEYS, COMBAT_KEYS, LOCOMOTION, TIMED,
//     ONE_SHOT, TRANSIENT). Não é um segundo catálogo: nada aqui é cadastrado à mão, o descritor não guarda duração, hitbox
//     nem janela mecânica (isso é de Game) e não decide transição nenhuma. Serve para nomear o tipo e a autoridade de cada
//     chave de animação e para anotar o log de transições.
//   • Motivo de transição: `reasonCodeOf` converte os textos em português da telemetria em códigos estáveis (IDs de replay/teste).
//   • IASA observável: `snapshotBefore` + `commandOutcome` comparam o lutador ANTES e DEPOIS do passo do Game e dizem, a partir
//     do resultado autoritativo, se cada comando pedido foi aceito, bufferizado ou recusado. Nunca aceita nada por conta
//     própria e nunca escreve no lutador.
//
// Quem consome: view/visual-epilogue.js (anota o log) e os testes. A física, a mecânica e a escolha de clipe continuam
// onde sempre estiveram (sim/controller e view/characters.js).
import {ACTION_KEYS, COMBAT_KEYS, LOCOMOTION, TIMED, ONE_SHOT, TRANSIENT} from './characters.js';

/** @typedef {{key: string, kind: string, authority: 'simulation'|'presentation', timing: 'timed'|'one-shot'|'loop', registered: boolean}} MotionStateInfo */

/** Tipo do estado: ação mecânica, reação de combate, locomoção ou apoio visual. */
function kindOf(key) {
  if (COMBAT_KEYS.has(key)) return 'reaction';
  if (ACTION_KEYS.has(key)) return 'action';
  if (LOCOMOTION.has(key)) return 'locomotion';
  if (/^(charge|release)_/.test(key)) return 'move-phase';
  if (/^recovery_/.test(key)) return 'recovery';
  if (/^jump/.test(key)) return 'jump-phase';
  if (/^ledge_/.test(key)) return 'ledge';
  if (TRANSIENT.has(key) || /^guard/.test(key)) return 'guard';
  if (key === '__preview') return 'preview';
  if (/_stop$/.test(key)) return 'locomotion';
  return 'unknown';
}

/** Descritor read-only de uma chave de animação. `registered: false` = chave que o registro não conhece (nunca é inventada). */
export function motionStateOf(/** @type {string} */ key) {
  const kind = kindOf(key), registered = kind !== 'unknown';
  const authority = kind === 'action' || kind === 'reaction' || kind === 'move-phase' || kind === 'jump-phase' || kind === 'ledge' || kind === 'guard' ? 'simulation' : 'presentation';
  const timing = TIMED.has(key) ? 'timed' : ONE_SHOT.has(key) ? 'one-shot' : 'loop';
  return /** @type {MotionStateInfo} */ ({key, kind, authority, timing, registered});
}

/** Todos os estados conhecidos (união dos conjuntos do Character), chave → descritor. */
export function listMotionStates() {
  const out = new Map();
  for (const set of [ACTION_KEYS, COMBAT_KEYS, LOCOMOTION, TIMED, ONE_SHOT, TRANSIENT]) for (const k of set) if (!out.has(k)) out.set(k, motionStateOf(k));
  return out;
}

/** Código estável do motivo de uma transição do log (`reason` em português + marcas `epilogue`/`epilogueEnd`). */
export function reasonCodeOf(/** @type {{reason?: string, to?: string, epilogue?: boolean, epilogueEnd?: boolean}} */ ev) {
  const r = ev.reason ?? '';
  if (r === 'conclusão visual') return 'epilogue-start';
  if (r === 'conclusão natural') return 'epilogue-end-natural';
  if (ev.epilogueEnd && ev.to && LOCOMOTION.has(ev.to)) return 'locomotion-cancel';   // andar/correr cortou a conclusão visual (v1.49.19)
  if (r === 'nova ação') return 'action-accepted';
  if (r === 'nova ação (mesmo estado)') return 'action-accepted-same-state';
  if (r === 'cancelamento C → X') return 'action-cancel-chain';
  if (r === 'reação de combate') return 'combat-reaction';
  if (r === 'ação concluída') return 'action-completed';
  if (r === 'ação cancelada (defesa)') return 'action-canceled';
  if (r === 'locomoção' || r === 'sprint' || r === 'esquiva → sprint') return 'locomotion';
  if (r === 'freio físico') return 'physical-brake';
  if (r === 'transição curta') return 'transient';
  if (r === 'prévia manual') return 'preview';
  if (ev.epilogueEnd) return 'epilogue-interrupted';
  return 'other';
}

/** Foto do lutador ANTES do passo do Game (referências, nada é copiado fundo nem alterado). */
export function snapshotBefore(/** @type {any} */ f) {
  return {action: f.action ?? null, flight: !!f.flight, charge: f.charge ?? null, tackleCharge: f.tackleCharge ?? null, buffer: f.inputBuffer?.kind ?? null};
}

/**
 * Resultado autoritativo de cada comando pedido no passo: ACEITO (o Game criou a ação/voo/carga correspondente), BUFFERIZADO
 * (não aceito agora, mas o pedido ficou guardado em `inputBuffer`) ou RECUSADO. O pedido em si (tecla) não prova nada.
 * @returns {{requested: string[], accepted: string[], buffered: string[], refused: string[]}}
 */
export function commandOutcome(/** @type {ReturnType<typeof snapshotBefore>} */ before, /** @type {any} */ c, /** @type {any} */ f) {
  const requested = [];
  if (c.tackle) requested.push('tackle');
  if (c.dodge) requested.push('dodge');
  if (c.jump) requested.push('jump');
  if (c.skill != null) requested.push('skill');
  const created = f.action && f.action !== before.action ? f.action : null;
  const isAccepted = {
    tackle: created?.kind === 'tackle' || (!!created && created.kind === 'move' && !c.skill) || (!!f.tackleCharge && f.tackleCharge !== before.tackleCharge),   // X segurado começa a CARREGAR (f.tackleCharge): também é aceito
    dodge: created?.kind === 'dodge',
    jump: !!f.flight && !before.flight,
    skill: (created?.kind === 'move') || (!!f.charge && f.charge !== before.charge),
  };
  const out = {requested, accepted: [], buffered: [], refused: []};
  for (const k of requested) {
    if (isAccepted[k]) out.accepted.push(k);
    else if (f.inputBuffer?.kind === k) out.buffered.push(k);
    else out.refused.push(k);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Melee G2 — eventos visuais tipados do Anim. Derivados do MESMO log de transições (nenhuma segunda fonte de verdade).
//   state-enter / state-exit : entrada e saída de um estado de animação (identidade = serial da execução, ex. «tackle#1»);
//   epilogue-start / epilogue-end : início e fim NATURAL da conclusão visual;
//   epilogue-interrupted : a conclusão foi cortada (cause = reasonCode: locomotion-cancel, action-accepted, combat-reaction…).
// eventId = «<executionId>@<tick>#<tipo>»: sai no máximo UMA vez por Character (o tick separa reentradas de estados sem serial, como neutral#0); a prévia do Editor não gera evento; a restauração de
// save/load (resumeEpilogue) fica muda, então carregar uma partida não repete enter/start. Só apresentação: nada aqui escreve
// no lutador nem decide combate (efeitos mecânicos continuam sendo de Game).
// ---------------------------------------------------------------------------------------------------------------------
/** Eventos tipados de UMA entrada do log (0 a 3 eventos). */
export function animEventsOf(/** @type {any} */ ev) {
  const base = {tick: ev.tick ?? null, from: ev.from ?? null, to: ev.to ?? null, reasonCode: ev.reasonCode ?? reasonCodeOf(ev)};
  const when = ev.tick ?? `t${ev.t}`;   // estados sem serial próprio (neutral#0, walk#0) reentram: o tick distingue as visitas
  const mk = (type, executionId, state, extra = {}) => executionId ? [{type, executionId, eventId: `${executionId}@${when}#${type}`, state, ...base, ...extra}] : [];
  if (ev.reason === 'conclusão visual') return mk('epilogue-start', ev.execTo, ev.to);
  if (ev.reason === 'conclusão natural') return mk('epilogue-end', ev.execFrom, ev.from);
  const out = [];
  if (ev.epilogueEnd) out.push(...mk('epilogue-interrupted', ev.execFrom, ev.from, {cause: base.reasonCode}));
  out.push(...mk('state-exit', ev.execFrom, ev.from));
  out.push(...mk('state-enter', ev.execTo, ev.to));
  return out;
}

/** Registra os eventos de uma entrada do log no Character (`animEvents`) e avisa o ouvinte `onAnimEvent`. Idempotente por eventId. */
export function emitAnimEvents(/** @type {any} */ ch, /** @type {any} */ ev) {
  if (ch.muteAnimEvents || ch.preview || ch.movePreview || ev.to === '__preview' || ev.from === '__preview') return;
  const list = ch.animEvents ??= [], ids = ch.animEventIds ??= new Set();
  if (ev.tick != null) {if (ch.animLastTick != null && ev.tick < ch.animLastTick) ids.clear();ch.animLastTick = ev.tick;}   // linha do tempo recomeçou (reinício da partida, load de um save mais antigo): ids antigos não suprimem a nova
  for (const e of animEventsOf(ev)) {
    if (ids.has(e.eventId)) continue;
    ids.add(e.eventId);list.push(e);
    if (list.length > 400) ids.delete(list.shift().eventId);
    try {ch.onAnimEvent?.(e);} catch (err) {ch.animEventErrors = (ch.animEventErrors ?? 0) + 1;}   // erro num ouvinte visual nunca derruba a animação nem o jogo
  }
}
