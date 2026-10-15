// Gravador de testes de movimento: sequências curtas de comandos (gravadas jogando ou roteirizadas) reexecutadas pelo
// MESMO motor (Game.step) a partir do mesmo estado inicial, com a mesma semente e os parâmetros escolhidos. Não existe
// segunda simulação: este módulo só monta o estado inicial, aplica os comandos e mede o resultado.
// Tempo sempre em passos de simulação (determinístico); segundos = passo × C.test.step.
import {C} from './config.js';
import {Game} from './game.js';
import {emptyCommand} from './entity.js';
import {vec, length, dot, sub} from './math.js';
import {withValues} from './compare.js';
import {packCommands, unpackCommands} from './recording.js';
import {withAttemptSink, describe} from './attempts.js';

export const SEQ_SCHEMA = 'arenamon-movement-sequence', SEQ_VERSION = 1;
const cmd = (o = {}) => ({...emptyCommand(), ...o});

/**
 * Sequência padrão de calibração (roteirizada, sem gravação): caminhar para a direita, inverter para a esquerda,
 * esquiva, sprint (C mantido), tackle e frear até parar. O adversário fica longe e parado (sem colisões).
 */
export function standardSequence() {
  const s = C.test.step, at = sec => Math.round(sec / s), right = vec(1, 0), left = vec(-1, 0), out = [];
  // Limites em passos inteiros (comparações em segundos sofreriam com arredondamento de ponto flutuante).
  const total = at(6.6), [walk, rev, dodge, release, tackle, stop, walk2, brake] = [.25, 1.45, 2.45, 3.85, 3.95, 4.5, 4.7, 5.5].map(at);
  for (let t = 0; t < total; t++) {
    let c = cmd();
    if (t >= walk && t < rev) c = cmd({move: right});
    else if (t >= rev && t < dodge) c = cmd({move: left});
    else if (t >= dodge && t < release) c = cmd({move: left, dodgeHeld: true, dodge: t === dodge, ...(t === dodge ? {dodgeDirection: left} : {})});
    else if (t >= release && t < tackle) c = cmd({move: left});
    else if (t >= tackle && t < stop) c = cmd({move: left, tackle: t === tackle});
    else if (t >= walk2 && t < brake) c = cmd({move: left});
    out.push(c);
  }
  return {schema: SEQ_SCHEMA, version: SEQ_VERSION, id: 'padrao', label: 'Padrão: direita → inverte → C → sprint → X → anda → freia', step: s, seed: 1,
    profile: 'balanced', enemyProfile: 'balanced', positions: [{x: 6, z: -6}, {x: 0, z: 9}], facing: [Math.PI / 2, Math.PI], enemy: 'still', commands: out, commands1: null, ticks: out.length};
}

/** Começa uma gravação a partir do estado atual da partida (ao vivo). */
export function startSequenceRecording(game, {label = 'Gravação', profile, enemyProfile, seed, mode}) {
  return {schema: SEQ_SCHEMA, version: SEQ_VERSION, id: 'rec-' + Date.now().toString(36), label, step: C.test.step, seed, profile, enemyProfile, mode,
    initial: game.save(), startTick: game.tick, enemy: 'recorded', commands: [], commands1: [], ticks: 0, recordedAt: new Date().toISOString()};
}
export function recordSequenceStep(seq, c0, c1) {seq.commands.push(structuredClone(c0));seq.commands1.push(c1 ? structuredClone(c1) : null);seq.ticks = seq.commands.length;}
export const serializeSequence = seq => ({...seq, commands: packCommands(seq.commands), commands1: seq.commands1 ? packCommands(seq.commands1) : null, packed: true});
export function parseSequence(raw) {
  let d;try {d = typeof raw === 'string' ? JSON.parse(raw) : structuredClone(raw);} catch (e) {return {error: 'JSON inválido: ' + e.message};}
  if (d?.schema !== SEQ_SCHEMA) return {error: 'Não é uma sequência de movimento do laboratório.'};
  if ((d.version | 0) > SEQ_VERSION) return {error: `Sequência de versão mais nova (v${d.version}).`};
  if (d.packed) {d.commands = unpackCommands(d.commands);d.commands1 = d.commands1 ? unpackCommands(d.commands1) : null;delete d.packed;}
  if (!Array.isArray(d.commands) || d.commands.length !== d.ticks) return {error: 'Sequência incompleta.'};
  return {seq: d};
}

/** Estado inicial da sequência numa partida nova (perfis lidos dos ajustes ATUAIS, para refletir o preset em teste). */
function prepare(seq) {
  const g = new Game();g.brain.seed = seq.seed;g.playerBrain.seed = seq.seed + 7919;g.brain.reset();g.playerBrain.reset();
  g.profile = seq.profile || 'balanced';g.enemyProfile = seq.enemyProfile || 'balanced';g.mode = 'inactive';
  if (seq.initial) {
    g.load(seq.initial);g.phase = 'playing';g.tick = 0;g.events = [];g.hitstop = seq.initial.hitstop ?? 0;
    for (const f of g.fighters) {const p = C.profiles[f.id ? g.enemyProfile : g.profile];if (p) f.attributes = {...p};}
  } else {
    g.reset({positions: seq.positions.map(p => vec(p.x, p.z))});
    g.fighters.forEach((f, i) => {const a = seq.facing?.[i];if (a !== undefined) {f.facing = a;f.visualFacing = a;f.combatHeading = a;f.faceGoal = a;}});
  }
  return g;
}

/**
 * Executa a sequência com `values` (caminho → valor; só durante a execução) e mede tudo por passo.
 * Determinístico: mesmos comandos + mesmo estado inicial + mesmos valores ⇒ mesmos números.
 */
export function runSequence(seq, {values = {}, fighter = 0, animProbe = null} = {}) {
  const attempts = [];let tickNow = 0;
  // Diagnóstico de comandos da própria execução (mesmo relato do controlador; não altera a simulação).
  return withValues(values, () => withAttemptSink((f, e) => attempts.push({...e, tick: tickNow, t: +(tickNow * C.test.step).toFixed(4), text: describe(e)}), () => {
    const g = prepare(seq), s = C.test.step, f0 = () => g.fighters[fighter];
    const samples = [], markers = [], events = [], actions = [], denied = [];
    let dist = 0, prevPos = {...f0().position}, prevVel = {...f0().velocity}, prevInput = null, lastInput = null, reverse = null, staminaUsed = 0, prevStamina = f0().stamina;
    let prevAction = null, prevSprint = false, prevState = f0().state, stateChanges = 0, open = null, collisions = 0;
    const mark = (t, type, label) => markers.push({tick: t, t: +(t * s).toFixed(4), type, label});
    for (let t = 0; t < seq.commands.length; t++) {
      const c0 = seq.commands[t] ?? emptyCommand(), c1 = seq.enemy === 'still' ? emptyCommand() : seq.commands1?.[t] ?? emptyCommand();
      tickNow = t;const nAttempts = attempts.length;g.step(c0, c1);
      for (const a of attempts.slice(nAttempts)) if (a.fighter === fighter && a.result === 'denied') {denied.push(a);mark(t, 'denied', a.text);}
      const f = f0(), mv = c0.move && length(c0.move) > .01 ? c0.move : null;
      // Comando de inversão: direção pedida oposta à última direção pedida.
      if (mv && lastInput && dot(mv, lastInput) < -.5) {mark(t, 'reverse', 'Comando de inversão');reverse = {tick: t, dir: {...mv}, crossed: null, full: null};}
      if (mv) lastInput = {...mv};
      const step = length(sub(f.position, prevPos));dist += step;
      const acc = {x: (f.velocity.x - prevVel.x) / s, z: (f.velocity.z - prevVel.z) / s};
      if (reverse && reverse.crossed === null && dot(f.velocity, reverse.dir) >= 0) {reverse.crossed = t;mark(t, 'zero', 'Velocidade passa por zero');}
      if (reverse && reverse.crossed !== null && reverse.full === null && dot(f.velocity, reverse.dir) >= .95 * f.attributes.speed) reverse.full = t;
      if (f.stamina < prevStamina - 1e-12) staminaUsed += prevStamina - f.stamina;
      // Ações (início/fim, interrupção) e sprint.
      if (f.action !== prevAction) {
        if (open) {open.end = t;open.duration = (t - open.start) * s;open.distance = length(sub(f.position, open.from));const full = open.kind === 'recoil' ? C.rules.recoil : C.actions[open.kind]?.duration;open.interrupted = full ? open.duration < full - 1.5 * s : false;mark(t, open.kind + 'End', `Fim ${label(open.kind)}${open.interrupted ? ' (interrompido)' : ''}`);if (open.interrupted) mark(t, 'interrupt', `${label(open.kind)} interrompido`);actions.push(open);open = null;}
        if (f.action) {open = {kind: f.action.kind, start: t, from: {...f.position}, fromCancel: !!f.action.fromCancel};mark(t, f.action.kind + 'Start', `Início ${label(f.action.kind)}${f.action.fromCancel ? ' (C → X)' : ''}`);}
        prevAction = f.action;
      } else if (open && f.action) open.distance = length(sub(f.position, open.from));
      if (f.sprinting !== prevSprint) {mark(t, f.sprinting ? 'sprintStart' : 'sprintEnd', f.sprinting ? 'Início do sprint' : 'Fim do sprint');prevSprint = f.sprinting;}
      if (f.state !== prevState) {stateChanges++;prevState = f.state;}
      for (const e of g.lastStepEvents) {events.push({tick: t, result: e.result, attacker: e.attacker, target: e.target});collisions++;mark(t, 'collision', `Contato: ${e.result}`);}
      if (f.contacts > 0 && !g.lastStepEvents.length) {/* contato físico sem evento de combate (parede ou empurrão) */}
      let animKey = null;if (animProbe) animKey = animProbe(f, g, t);
      samples.push({tick: t, t: +(t * s).toFixed(4), x: f.position.x, z: f.position.z, vx: f.velocity.x, vz: f.velocity.z, speed: length(f.velocity), ax: acc.x, az: acc.z, accel: Math.hypot(acc.x, acc.z),
        dist, stamina: f.stamina, state: f.state, action: f.action?.kind ?? null, loco: f.locoPhase, sprint: !!f.sprinting, exhausted: !!f.exhausted, ix: c0.move?.x ?? 0, iz: c0.move?.z ?? 0, anim: animKey});
      prevPos = {...f.position};prevVel = {...f.velocity};prevStamina = f.stamina;void prevInput;
    }
    if (open) {open.end = seq.commands.length;open.duration = (open.end - open.start) * s;actions.push(open);}
    return {samples, markers, events, actions, denied, attempts, metrics: metricsOf(samples, actions, markers, {staminaUsed, collisions, stateChanges, reverse, step: s, walk: g.fighters[fighter].attributes.speed}), finalState: JSON.stringify(g.fighters)};
  }));
}
const label = k => ({tackle: 'do tackle (X)', dodge: 'da esquiva (C)', recoil: 'do recuo'})[k] ?? k;

/** Métricas da execução (todas em unidades físicas; null quando o evento não ocorreu). */
export function metricsOf(samples, actions, markers, {staminaUsed, collisions, stateChanges, reverse, step, walk}) {
  const n = samples.length, dur = n * step, maxSpeed = Math.max(0, ...samples.map(x => x.speed));
  const firstMove = samples.findIndex(x => x.ix || x.iz), reach = firstMove >= 0 ? samples.findIndex((x, i) => i >= firstMove && x.speed >= .95 * walk) : -1;
  // Frenagem: do último comando (soltou tudo) até parar (< 5 cm/s).
  let lastIn = -1;for (let i = n - 1; i >= 0; i--) if (samples[i].ix || samples[i].iz || samples[i].action) {lastIn = i;break;}
  const stop = lastIn >= 0 ? samples.findIndex((x, i) => i > lastIn && x.speed < .05) : -1;
  const first = k => actions.find(a => a.kind === k), sprintOn = markers.filter(m => m.type === 'sprintStart').length;
  // Andando: sem ação, sem sprint e sem a frenagem de excesso que vem do sprint ou de X/C.
  const free = samples.filter(x => !x.action && !x.sprint && x.loco !== 'sprintStop' && x.loco !== 'overspeed'), sprinting = samples.filter(x => x.sprint);
  // Fim do sprint: do fim (soltar C) até voltar à velocidade de caminhada.
  const sEnd = markers.find(m => m.type === 'sprintEnd'), sBack = sEnd ? samples.findIndex(x => x.tick >= sEnd.tick && x.speed <= walk + 1e-3) : -1;
  const r2 = v => v == null ? null : +v.toFixed(3);
  return {
    duration: r2(dur), distance: r2(samples.at(-1)?.dist ?? 0), displacement: r2(n ? Math.hypot(samples.at(-1).x - samples[0].x, samples.at(-1).z - samples[0].z) : 0),
    avgSpeed: r2(dur ? (samples.at(-1)?.dist ?? 0) / dur : 0), maxSpeed: r2(maxSpeed), maxWalkSpeed: r2(Math.max(0, ...free.map(x => x.speed))), maxSprintSpeed: sprinting.length ? r2(Math.max(...sprinting.map(x => x.speed))) : null,
    // Só vale se nenhuma ação começou antes de voltar à caminhada (senão mediria a ação, não o freio do sprint).
    sprintBrakeTime: sBack >= 0 && !actions.some(a => a.start >= sEnd.tick && a.start <= sBack) ? r2((sBack - sEnd.tick) * step) : null,
    timeToWalkSpeed: reach >= 0 ? r2((reach - firstMove) * step) : null,
    brakingTime: stop >= 0 ? r2((stop - lastIn) * step) : null, brakingDistance: stop >= 0 ? r2(samples[stop].dist - samples[lastIn].dist) : null,
    reversalToZero: reverse?.crossed != null ? r2((reverse.crossed - reverse.tick) * step) : null, reversalToSpeed: reverse?.full != null ? r2((reverse.full - reverse.tick) * step) : null,
    dodgeDuration: r2(first('dodge')?.duration ?? null), dodgeDistance: r2(first('dodge')?.distance ?? null),
    tackleDuration: r2(first('tackle')?.duration ?? null), tackleDistance: r2(first('tackle')?.distance ?? null),
    sprints: sprintOn, staminaUsed: r2(staminaUsed), collisions, stateTransitions: stateChanges,
    actions: actions.length, interrupted: actions.filter(a => a.interrupted).length,
  };
}
export const METRIC_LABELS = {
  duration: ['Duração da sequência', 's'], distance: ['Distância percorrida', 'm'], displacement: ['Deslocamento final', 'm'], avgSpeed: ['Velocidade média', 'm/s'], maxSpeed: ['Velocidade máxima (inclui picos de X/C)', 'm/s'], maxWalkSpeed: ['Velocidade máxima andando', 'm/s'], maxSprintSpeed: ['Velocidade máxima no sprint', 'm/s'],
  sprintBrakeTime: ['Fim do sprint: tempo até a velocidade de caminhada', 's'],
  timeToWalkSpeed: ['Tempo até a velocidade de caminhada (95%)', 's'], brakingTime: ['Tempo de frenagem (até < 5 cm/s)', 's'], brakingDistance: ['Distância de frenagem', 'm'],
  reversalToZero: ['Inversão: tempo até velocidade zero', 's'], reversalToSpeed: ['Inversão: tempo até 95% no novo sentido', 's'],
  dodgeDuration: ['Duração da esquiva (C)', 's'], dodgeDistance: ['Distância da esquiva (C)', 'm'], tackleDuration: ['Duração do tackle (X)', 's'], tackleDistance: ['Distância do tackle (X)', 'm'],
  sprints: ['Sprints iniciados', ''], staminaUsed: ['Stamina consumida', ''], collisions: ['Eventos de colisão', ''], stateTransitions: ['Transições de estado (base das animações)', ''],
  actions: ['Ações executadas', ''], interrupted: ['Ações interrompidas', ''],
};

/** Condições de uma comparação: o que difere além dos parâmetros comparados (para não declarar resultados comparáveis à toa). */
export function comparability(seq, valuesA, valuesB) {
  const issues = [];
  for (const path of new Set([...Object.keys(valuesA), ...Object.keys(valuesB)])) if (path.startsWith('test.') && valuesA[path] !== valuesB[path]) issues.push(`${path} difere (${valuesA[path]} × ${valuesB[path]}): o passo/arena muda e a mesma lista de comandos não representa o mesmo tempo.`);
  if (seq.step && Math.abs(seq.step - C.test.step) > 1e-12) issues.push(`A sequência foi gravada com passo ${(seq.step * 1000).toFixed(2)} ms e o atual é ${(C.test.step * 1000).toFixed(2)} ms.`);
  return issues;
}
/** Compara a mesma sequência com A e B (mesmo estado inicial, mesma semente, mesmos comandos). */
export function compareSequence(seq, valuesA, valuesB, opts = {}) {
  const a = runSequence(seq, {...opts, values: valuesA}), b = runSequence(seq, {...opts, values: valuesB});
  return {a, b, issues: comparability(seq, valuesA, valuesB)};
}
/** CSV por passo (um ou mais resultados lado a lado). */
export function samplesCsv(runs) {
  const cols = ['t', 'x', 'z', 'vx', 'vz', 'speed', 'ax', 'az', 'accel', 'dist', 'stamina', 'state', 'action', 'loco', 'sprint', 'anim'];
  const head = ['tick', ...runs.flatMap(r => cols.map(c => `${r.name}:${c}`))];
  const n = Math.max(...runs.map(r => r.result.samples.length)), rows = [head.join(',')];
  const f = v => typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(5)) : v == null ? '' : String(v);
  for (let i = 0; i < n; i++) rows.push([i, ...runs.flatMap(r => {const s = r.result.samples[i];return cols.map(c => s ? f(s[c]) : '');})].join(','));
  return rows.join('\n');
}
