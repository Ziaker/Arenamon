// Perfil de animação por ação e por variante (editor de animações). Camada ADITIVA sobre o que já existe:
//   • valores globais (velocidade, laço e duração máxima por ação, root motion, trava ao chão) continuam sendo o padrão;
//   • cada campo do perfil herda o global ou tem uma sobrescrita local (nunca apaga o global);
//   • faixas da timeline ficam em FRAÇÃO do clipe (0–1): a conversão para segundos é determinística e acompanha
//     velocidade e duração; eventos importados do GLB nunca são alterados — edições locais são uma camada à parte.
// Módulo puro (sem DOM nem three.js) para poder ser testado em Node.

export const PROFILE_SCHEMA = 1;

/** Fases do salto (ações novas, aditivas; sem clipe próprio o jogo continua usando o clipe «jump» como antes). */
export const JUMP_PHASES = ['jump_start', 'jump_rise', 'jump_apex', 'jump_fall'];
export const JUMP_PHASE_DEFAULTS = {startTime: .12, apexBand: .6};

/**
 * Fase do salto a partir da velocidade vertical e do tempo desde o impulso.
 * @param {{vy: number, sinceLaunch: number, startTime?: number, apexBand?: number}} p
 */
export function jumpPhaseFor({vy, sinceLaunch, startTime = JUMP_PHASE_DEFAULTS.startTime, apexBand = JUMP_PHASE_DEFAULTS.apexBand}) {
  if (sinceLaunch < startTime && vy > apexBand) return 'jump_start';
  if (vy > apexBand) return 'jump_rise';
  if (vy < -apexBand) return 'jump_fall';
  return 'jump_apex';
}

/** Grupos exibidos na lista do editor: [id, rótulo, ações]. A ordem reflete o inventário atual + fases novas. */
export const ANIMATION_GROUPS = [
  ['locomotion', 'Locomoção', ['idle', 'turn', 'walk', 'walk_back', 'walk_left', 'walk_right', 'sprint', 'sprint_back', 'sprint_left', 'sprint_right', 'walk_stop', 'sprint_stop']],
  ['defense', 'Defesa e reação', ['block_start', 'block', 'block_end', 'guard_impact', 'perfect_guard', 'blocked', 'hit', 'hit_light', 'hit_heavy', 'push', 'push_side', 'hit_up', 'hit_crush', 'knockback', 'fall', 'recover', 'downed', 'death']],
  ['recovery', 'Recuperação de ataques', ['recovery_tackle', 'recovery_dodge', 'recovery_move']],
  ['tackle', 'Tackle', ['tackle', 'tackle_charge', 'tackle_pl2', 'tackle_pl3', 'brake', 'meteor_prep', 'meteor_dive', 'meteor_ground']],
  ['dodge', 'Esquivas', ['dodge_forward', 'dodge_back', 'dodge_left', 'dodge_right']],
  ['jump', 'Salto', ['jump', 'jump_start', 'jump_rise', 'jump_apex', 'jump_fall', 'land']],
  ['wall', 'Parede', ['wall_splat']],
  ['moves', 'Moves', ['move_1', 'move_2', 'move_3', 'move_4', 'charge_reflect', 'release_reflect', 'charge_psyshock', 'release_psyshock']],
];

export const GROUP_OF = Object.fromEntries(ANIMATION_GROUPS.flatMap(([g, , ids]) => ids.map(id => [id, g])));

/**
 * Campos editáveis. `applied` = o jogo já usa o valor; `false` = fica salvo e validado no perfil (registro
 * do que o usuário quer), sem alterar a simulação ainda.
 * `store`: campo cujo valor global já existe em outro lugar (velocidade etc.) — o editor lê e grava lá, sem duplicar.
 */
export const FIELDS = [
  {id: 'enabled', group: 'Reprodução', label: 'Habilitada', type: 'bool', def: true, applied: false, tip: 'Desligada, o estado ignora este clipe e usa a reserva.'},
  {id: 'speed', group: 'Reprodução', label: 'Velocidade', unit: '×', min: .1, max: 4, step: .05, def: 1, applied: true, store: 'speeds', tip: 'Multiplica a velocidade do clipe. Em ações com duração definida pela simulação (tackle, esquiva…) o clipe é esticado para a duração da ação.'},
  {id: 'loop', group: 'Reprodução', label: 'Em laço', type: 'bool', def: null, applied: true, store: 'playback', tip: 'Repete o clipe sem parar. Desligado, segura a última pose.'},
  {id: 'maxDuration', group: 'Reprodução', label: 'Duração máxima', unit: 's', min: 0, max: 10, step: .01, def: 0, applied: true, store: 'playback', tip: '0 = o clipe inteiro. Corta o clipe nesse tempo (em segundos de jogo).'},
  {id: 'trimStart', group: 'Reprodução', label: 'Início do recorte', unit: '%', min: 0, max: 99, step: 1, def: 0, applied: true, tip: 'Começa o clipe neste ponto (porcentagem da duração original).'},
  {id: 'trimEnd', group: 'Reprodução', label: 'Fim do recorte', unit: '%', min: 1, max: 100, step: 1, def: 100, applied: true, tip: 'Termina o clipe neste ponto (porcentagem da duração original).'},
  {id: 'blendIn', group: 'Mistura', label: 'Blend de entrada', unit: 's', min: 0, max: 1, step: .01, def: null, applied: true, tip: 'Fade ao entrar neste clipe. Vazio = o fade global (Personagens › avançado).'},
  {id: 'blendOut', group: 'Mistura', label: 'Blend de saída', unit: 's', min: 0, max: 1, step: .01, def: null, applied: false, tip: 'Fade ao sair do clipe (registrado; o jogo usa o blend de entrada do próximo).'},
  {id: 'layerWeight', group: 'Mistura', label: 'Peso da camada', unit: '', min: 0, max: 1, step: .05, def: 1, applied: false, tip: 'Peso máximo do clipe na mistura.'},
  {id: 'loopStart', group: 'Loop', label: 'Início do laço central', unit: '%', min: 0, max: 99, step: 1, def: 0, applied: true, tip: 'Com laço ligado, ao chegar no fim o clipe volta para este ponto (trecho inicial toca uma vez).'},
  {id: 'loopEnd', group: 'Loop', label: 'Fim do laço central', unit: '%', min: 1, max: 100, step: 1, def: 100, applied: true, tip: 'Com laço ligado, o laço central termina aqui e volta ao início do laço.'},
  {id: 'startup', group: 'Combate', label: 'Startup', unit: '%', min: 0, max: 100, step: 1, def: null, applied: false, tip: 'Fim da antecipação (antes do trecho ativo).'},
  {id: 'activeStart', group: 'Combate', label: 'Ativo: início', unit: '%', min: 0, max: 100, step: 1, def: null, applied: false, tip: 'Início da janela em que o golpe é perigoso.'},
  {id: 'activeEnd', group: 'Combate', label: 'Ativo: fim', unit: '%', min: 0, max: 100, step: 1, def: null, applied: false, tip: 'Fim da janela em que o golpe é perigoso.'},
  {id: 'cancelStart', group: 'Combate', label: 'Janela de cancelamento', unit: '%', min: 0, max: 100, step: 1, def: null, applied: false, tip: 'A partir daqui a ação pode ser cancelada em outra.'},
  {id: 'invulnStart', group: 'Combate', label: 'Invencível: início', unit: '%', min: 0, max: 100, step: 1, def: null, applied: false, tip: 'Início da janela de invencibilidade.'},
  {id: 'invulnEnd', group: 'Combate', label: 'Invencível: fim', unit: '%', min: 0, max: 100, step: 1, def: null, applied: false, tip: 'Fim da janela de invencibilidade.'},
  {id: 'freezeAt', group: 'Combate', label: 'Congelamento em', unit: '%', min: 0, max: 100, step: 1, def: null, applied: false, tip: 'Ponto do clipe em que o quadro congela (hit-stop visual).'},
  {id: 'freezeFor', group: 'Combate', label: 'Congelamento: duração', unit: 's', min: 0, max: .5, step: .01, def: 0, applied: false, tip: 'Quanto tempo o quadro fica congelado.'},
  {id: 'rootMotion', group: 'Movimento', label: 'Root motion habilitado', type: 'bool', def: null, applied: true, tip: 'Ligado, esta animação pode deslocar a raiz horizontalmente (vale por animação; o global do personagem fica na aba Movimento). Desligado, a posição vem só da física.'},
  {id: 'lockToGround', group: 'Movimento', label: 'Trava ao chão', type: 'bool', def: null, applied: true, tip: 'Mantém os pés apoiados no solo, ignorando o sobe/desce do clipe. Vale só para esta animação; o global fica na aba Movimento.'},
  {id: 'verticalOffset', group: 'Movimento', label: 'Compensação vertical', unit: 'm', min: -2, max: 2, step: .01, def: 0, applied: true, store: 'clipOffsets', tip: 'Sobe ou desce o personagem enquanto este clipe toca.'},
  {id: 'reverse', group: 'Reprodução', label: 'Direção (invertida)', type: 'bool', def: false, applied: false, tip: 'Toca o clipe de trás para frente (registrado).'},
  {id: 'blendCurve', group: 'Mistura', label: 'Curva do blend', type: 'select', options: ['linear', 'ease-in', 'ease-out', 'ease-in-out'], def: 'linear', applied: true, tip: 'Forma do fade ao entrar neste clipe (slow in / slow out): linear, começa devagar, termina devagar ou os dois.'},
  {id: 'priority', group: 'Mistura', label: 'Prioridade da camada', unit: '', min: 0, max: 10, step: 1, def: 0, applied: false, tip: 'Maior prioridade vence quando dois clipes disputam a mesma camada (registrado).'},
  {id: 'repeats', group: 'Loop', label: 'Repetições do laço', unit: '×', min: 0, max: 20, step: 1, def: 0, applied: false, tip: '0 = repete até o estado terminar. Outro valor limita as voltas do laço central (registrado).'},
  {id: 'exitCondition', group: 'Loop', label: 'Condição de saída do laço', type: 'select', options: ['fim do estado', 'ao soltar o comando', 'ao tocar o chão', 'após as repetições'], def: 'fim do estado', applied: false, tip: 'O que encerra o laço central e leva ao trecho final (registrado).'},
  {id: 'armor', group: 'Combate', label: 'Armadura (redução de dano)', unit: '%', min: 0, max: 100, step: 5, def: 0, applied: false, tip: 'Reduz o dano e ignora o stun durante a janela ativa (registrado).'},
  {id: 'bufferWindow', group: 'Combate', label: 'Buffer de entrada', unit: 's', min: 0, max: .5, step: .01, def: 0, applied: false, tip: 'Tempo antes do fim em que o próximo comando já é guardado (registrado).'},
  {id: 'hitstopMult', group: 'Combate', label: 'Hit-stop (×)', unit: '×', min: 0, max: 3, step: .05, def: 1, applied: false, tip: 'Multiplica a pausa de impacto desta animação (registrado; o valor global fica em Parâmetros do jogo).'},
  {id: 'interruptible', group: 'Combate', label: 'Interrompível', type: 'bool', def: true, applied: false, tip: 'Se a animação pode ser interrompida por reações (registrado).'},
  {id: 'combatPriority', group: 'Combate', label: 'Prioridade de combate', unit: '', min: 0, max: 10, step: 1, def: 0, applied: false, tip: 'Maior prioridade vence um empate entre ações (registrado).'},
  {id: 'rootAllowX', group: 'Movimento', label: 'Liberar root motion em X', type: 'bool', def: false, applied: true, tip: 'Com o root motion desta animação ligado, deixa o clipe deslocar o corpo lateralmente.'},
  {id: 'rootAllowZ', group: 'Movimento', label: 'Liberar root motion em Z', type: 'bool', def: false, applied: true, tip: 'Com o root motion desta animação ligado, deixa o clipe deslocar o corpo para frente/trás.'},
  {id: 'motionScale', group: 'Movimento', label: 'Escala do deslocamento', unit: '×', min: 0, max: 3, step: .05, def: 1, applied: false, tip: 'Multiplica o deslocamento do root motion (registrado).'},
  {id: 'displacement', group: 'Movimento', label: 'Deslocamento total', unit: 'm', min: 0, max: 10, step: .05, def: 0, applied: false, tip: 'Distância total desejada ao longo da animação (registrado; a física decide o movimento real).'},
  {id: 'verticalSpeed', group: 'Movimento', label: 'Velocidade vertical', unit: 'm/s', min: -20, max: 20, step: .1, def: 0, applied: false, tip: 'Velocidade vertical associada à animação (registrado; salto físico em Parâmetros do jogo).'},
  {id: 'minTime', group: 'Transições', label: 'Tempo mínimo no estado', unit: 's', min: 0, max: 2, step: .01, def: 0, applied: false, tip: 'Tempo mínimo antes de poder sair desta animação (registrado).'},
  {id: 'autoNext', group: 'Transições', label: 'Transição automática para', type: 'select', options: 'actions', def: '', applied: false, tip: 'Animação seguinte ao terminar (registrado).'},
  {id: 'fallback', group: 'Transições', label: 'Reserva (fallback) se faltar clipe', type: 'select', options: 'actions', def: '', applied: true, tip: 'Se esta animação não tiver clipe, usa a escolhida aqui antes das reservas padrão do jogo.'},
  {id: 'squashScale', group: 'Princípios', label: 'Squash & stretch (×)', unit: '×', min: 0, max: 3, step: .05, def: 1, applied: true, tip: 'Multiplica a deformação de squash & stretch enquanto esta animação toca (1 = o global).'},
  {id: 'jumpApexFreeze', group: 'Salto', label: 'Congelamento no pico', unit: 's', min: 0, max: .3, step: .01, def: 0, applied: true, only: ['jump_apex'], tip: 'Segura a pose por este tempo ao entrar no pico do salto (hang time visual).'},
  {id: 'jumpStartTime', group: 'Salto', label: 'Duração do início do pulo', unit: 's', min: .02, max: .6, step: .01, def: JUMP_PHASE_DEFAULTS.startTime, applied: true, only: ['jump_start'], tip: 'Tempo desde o impulso em que vale a fase «Início do pulo».'},
  {id: 'jumpApexBand', group: 'Salto', label: 'Faixa do pico', unit: 'm/s', min: .1, max: 3, step: .05, def: JUMP_PHASE_DEFAULTS.apexBand, applied: true, only: ['jump_apex'], tip: 'Velocidade vertical (±) em que o personagem está no pico do salto.'},
];
export const FIELD_BY_ID = Object.fromEntries(FIELDS.map(f => [f.id, f]));

/** Faixas coloridas da timeline (id → rótulo, cor). */
export const TRACK_KINDS = {
  clip: {label: 'Duração', color: '#8b97ab'}, startup: {label: 'Startup', color: '#5aa7ff'}, active: {label: 'Ativo', color: '#ff6a5a'},
  recovery: {label: 'Recovery', color: '#f5c04a'}, cancel: {label: 'Cancelável', color: '#7ed957'}, invuln: {label: 'Invencibilidade', color: '#c78bff'},
  freeze: {label: 'Congelamento', color: '#4de1e1'}, movement: {label: 'Movimento', color: '#ff9f43'}, hitbox: {label: 'Hitbox', color: '#ff4d8d'},
  loop: {label: 'Laço', color: '#59d6a0'}, event: {label: 'Evento', color: '#ffffff'},
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);

export const entryKey = (action, clipName = null) => clipName ? `${action}@${clipName}` : action;

export function emptyProfile() {return {schema: PROFILE_SCHEMA, entries: {}, hitboxes: {}, markers: {}};}

/**
 * Migração idempotente de qualquer dado salvo para o schema atual. Dados antigos (sem `animProfile`) viram um perfil
 * vazio: nada é perdido porque variantes, velocidades, offsets e move animations continuam nos campos antigos.
 */
export function migrateProfile(data) {
  const src = data && typeof data === 'object' ? data : {};
  const out = emptyProfile();
  for (const [k, v] of Object.entries(src.entries || {})) {
    if (!v || typeof v !== 'object') continue;
    const clean = {};
    for (const [fid, val] of Object.entries(v)) if (FIELD_BY_ID[fid] && val !== undefined) clean[fid] = FIELD_BY_ID[fid].type === 'bool' ? (val === null ? null : !!val) : FIELD_BY_ID[fid].type === 'select' ? (val === null ? null : String(val)) : (val === null ? null : num(val, FIELD_BY_ID[fid].def ?? 0));
    if (Object.keys(clean).length) out.entries[k] = clean;
  }
  for (const [k, list] of Object.entries(src.hitboxes || {})) if (Array.isArray(list)) out.hitboxes[k] = list.map(normalizeHitbox);
  for (const [k, list] of Object.entries(src.markers || {})) if (Array.isArray(list)) out.markers[k] = list.map(normalizeMarker).filter(Boolean);
  return out;
}

export function normalizeHitbox(h = {}) {
  const v = (x, d) => Array.isArray(x) ? [num(x[0], d), num(x[1], d), num(x[2], d)] : [d, d, d];
  return {
    id: String(h.id || 'hb-' + Math.random().toString(36).slice(2, 7)), shape: ['box', 'sphere', 'capsule'].includes(h.shape) ? h.shape : 'sphere',
    size: v(h.size, .5), position: v(h.position, 0), rotation: v(h.rotation, 0), bone: h.bone ? String(h.bone) : '',
    start: clamp(num(h.start, 0), 0, 1), end: clamp(num(h.end, 1), 0, 1), damage: num(h.damage, 0), reaction: h.reaction ? String(h.reaction) : '', target: h.target ? String(h.target) : 'rival',
  };
}
export function normalizeMarker(m = {}) {
  if (!m || typeof m !== 'object') return null;
  const kind = ['vfx', 'audio', 'camera', 'shake', 'freeze', 'spawn', 'contact', 'callback', 'marker'].includes(m.kind) ? m.kind : 'marker';
  return {id: String(m.id || 'ev-' + Math.random().toString(36).slice(2, 7)), kind, at: clamp(num(m.at, 0), 0, 1), name: String(m.name || ''), data: m.data ?? null};
}

/** Perfil + herança: devolve `{value, from}` por campo, onde `global` é o valor lido dos armazenamentos antigos. */
export function resolveField(profile, fieldId, action, clipName, globals = {}) {
  const f = FIELD_BY_ID[fieldId];
  for (const key of [entryKey(action, clipName), entryKey(action)]) {
    const e = profile.entries[key];
    if (e && e[fieldId] !== undefined && e[fieldId] !== null) return {value: e[fieldId], from: key === action ? 'ação' : 'variante', overridden: true};
  }
  const g = globals[fieldId];
  if (g !== undefined && g !== null) return {value: g, from: 'global', overridden: false};
  return {value: f.def, from: 'padrão', overridden: false};
}

/** Sobrescreve um campo (valor validado e limitado). Devolve um perfil novo. */
export function setField(profile, key, fieldId, value) {
  const f = FIELD_BY_ID[fieldId];
  if (!f) return profile;
  const next = {...profile, entries: {...profile.entries}};
  const cur = {...(next.entries[key] || {})};
  if (value === null || value === undefined) delete cur[fieldId];
  else cur[fieldId] = f.type === 'bool' ? !!value : f.type === 'select' ? String(value) : clamp(num(value, f.def ?? 0), f.min ?? -Infinity, f.max ?? Infinity);
  if (Object.keys(cur).length) next.entries[key] = cur;else delete next.entries[key];
  return next;
}

export function setHitboxes(profile, key, list) {return {...profile, hitboxes: {...profile.hitboxes, [key]: list.map(normalizeHitbox)}};}
export function setMarkers(profile, key, list) {return {...profile, markers: {...profile.markers, [key]: list.map(normalizeMarker).filter(Boolean)}};}

/** Recorte efetivo do clipe em fração (0–1). */
export function trimOf(values) {
  const a = clamp(num(values.trimStart, 0) / 100, 0, .99), b = clamp(num(values.trimEnd, 100) / 100, a + .01, 1);
  return [a, b];
}
export function loopRange(values) {
  const [t0, t1] = trimOf(values);
  const a = clamp(num(values.loopStart, 0) / 100, t0, t1 - .01), b = clamp(num(values.loopEnd, 100) / 100, a + .01, t1);
  return [a, b];
}

/**
 * Tempo do clipe (segundos) para o tempo bruto decorrido, respeitando recorte, laço e fim sem laço.
 * @param {{elapsed: number, duration: number, loop: boolean, trim: number[], loopRange: number[]}} p
 */
export function clipTimeAt({elapsed, duration, loop, trim, loopRange: lr}) {
  const t0 = trim[0] * duration, t1 = trim[1] * duration, at = t0 + Math.max(0, elapsed);
  if (!loop) return Math.min(t1, at);
  const l0 = lr[0] * duration, l1 = lr[1] * duration;
  if (at < l1) return at;
  return l0 + ((at - l1) % Math.max(.001, l1 - l0));
}

/**
 * Faixas da timeline de uma animação. Entrada: duração (s), velocidade, eventos do GLB (somente leitura), campos
 * resolvidos, hitboxes e marcadores locais. Saída: faixas {kind,start,end} em fração + valor em segundos de jogo.
 */
export function buildTimeline({duration, speed = 1, glbEvents = [], values = {}, hitboxes = [], markers = [], gameTracks = []}) {
  const d = Math.max(1e-3, duration), play = d / Math.max(.05, speed);
  const frac = t => clamp(t / d, 0, 1);
  const seg = (kind, a, b, origin, label = TRACK_KINDS[kind].label) => ({kind, start: clamp(a, 0, 1), end: clamp(b, 0, 1), seconds: [clamp(a, 0, 1) * play, clamp(b, 0, 1) * play], origin, label});
  const tracks = [seg('clip', 0, 1, 'clipe', 'Clipe')];
  const pickT = type => glbEvents.filter(e => e.type === type).map(e => e.time).sort((x, y) => x - y);
  // Ativo
  const aOn = pickT('hitbox_on')[0], aOff = pickT('hitbox_off')[0];
  const aStart = values.activeStart != null ? values.activeStart / 100 : aOn != null ? frac(aOn) : null;
  const aEnd = values.activeEnd != null ? values.activeEnd / 100 : aOff != null ? frac(aOff) : aStart != null ? 1 : null;
  const origin = k => values[k] != null ? 'local' : 'glb';
  if (aStart != null) {
    tracks.push(seg('startup', 0, values.startup != null ? values.startup / 100 : aStart, values.startup != null ? 'local' : origin('activeStart')));
    tracks.push(seg('active', aStart, aEnd, values.activeStart != null || values.activeEnd != null ? 'local' : 'glb'));
    const rec = values.cancelStart != null ? values.cancelStart / 100 : pickT('recovery_start')[0] != null ? frac(pickT('recovery_start')[0]) : aEnd;
    tracks.push(seg('recovery', aEnd, 1, values.cancelStart != null ? 'local' : 'glb'));
    if (values.cancelStart != null || pickT('recovery_start')[0] != null) tracks.push(seg('cancel', rec, 1, values.cancelStart != null ? 'local' : 'glb'));
  }
  const iOn = pickT('invulnerable_start')[0], iOff = pickT('invulnerable_end')[0];
  if (values.invulnStart != null || iOn != null) tracks.push(seg('invuln', values.invulnStart != null ? values.invulnStart / 100 : frac(iOn), values.invulnEnd != null ? values.invulnEnd / 100 : iOff != null ? frac(iOff) : 1, values.invulnStart != null ? 'local' : 'glb'));
  if (values.freezeAt != null && values.freezeFor > 0) tracks.push(seg('freeze', values.freezeAt / 100, values.freezeAt / 100 + values.freezeFor / play, 'local'));
  const [l0, l1] = loopRange(values);
  if (values.loop) tracks.push(seg('loop', l0, l1, 'local'));
  for (const h of hitboxes) tracks.push({...seg('hitbox', h.start, h.end, 'local', `Hitbox ${h.shape}`), id: h.id});
  for (const g of gameTracks) tracks.push(seg(g.kind, g.start, g.end, 'jogo', g.label || 'Regra: ' + TRACK_KINDS[g.kind].label));
  const events = [];
  for (const e of glbEvents) events.push({kind: 'event', at: frac(e.time), seconds: frac(e.time) * play, label: e.type, origin: 'glb'});
  for (const m of markers) events.push({kind: 'event', sub: m.kind, at: m.at, seconds: m.at * play, label: m.name || m.kind, origin: 'local', id: m.id});
  return {tracks, events, duration: d, playSeconds: play};
}

/**
 * Validação do perfil de uma animação (sobreposição, duração inválida, evento fora do clipe, osso ausente).
 * @returns {{level: 'erro'|'aviso', text: string}[]}
 */
export function validateEntry({duration, values = {}, hitboxes = [], markers = [], bones = null, hasClip = true}) {
  const out = [];
  const add = (level, text) => out.push({level, text});
  if (!hasClip) add('aviso', 'Sem clipe associado: o estado usa a animação de reserva.');
  if (duration <= 0 && hasClip) add('erro', 'Duração do clipe inválida (zero ou negativa).');
  const [t0, t1] = trimOf(values);
  if (t1 - t0 < .02) add('erro', 'Recorte curto demais (menos de 2% do clipe).');
  if (values.activeStart != null && values.activeEnd != null && values.activeEnd <= values.activeStart) add('erro', 'O fim do trecho ativo vem antes do início.');
  if (values.invulnStart != null && values.invulnEnd != null && values.invulnEnd <= values.invulnStart) add('erro', 'O fim da invencibilidade vem antes do início.');
  if (values.activeStart != null && values.startup != null && values.startup > values.activeStart) add('aviso', 'O startup termina depois do início do trecho ativo (sobreposição).');
  if (values.cancelStart != null && values.activeEnd != null && values.cancelStart < values.activeStart) add('aviso', 'A janela de cancelamento começa antes do trecho ativo.');
  hitboxes.forEach((h, i) => {
    if (h.end <= h.start) add('erro', `Hitbox ${i + 1}: o fim vem antes do início.`);
    if (h.size.some(s => s <= 0)) add('erro', `Hitbox ${i + 1}: tamanho inválido.`);
    if (h.bone && bones && !bones.has(h.bone)) add('aviso', `Hitbox ${i + 1}: osso «${h.bone}» não existe neste modelo.`);
  });
  for (const m of markers) if (m.at < 0 || m.at > 1) add('erro', `Evento «${m.name || m.kind}» fora do clipe.`);
  return out;
}

/** Conjunto de ações listadas no editor (todas as existentes + fases novas). */
export const ALL_EDITOR_ACTIONS = ANIMATION_GROUPS.flatMap(([, , ids]) => ids);

/** Curva de suavização do blend (0–1 → 0–1). */
export function easeCurve(name, k) {
  const t = Math.min(1, Math.max(0, k));
  if (name === 'ease-in') return t * t;
  if (name === 'ease-out') return 1 - (1 - t) * (1 - t);
  if (name === 'ease-in-out') return t * t * (3 - 2 * t);
  return t;
}

/** Princípios da animação → sliders globais já existentes no jogo + campos do perfil (editor, aba Princípios). */
export const PRINCIPLES = [
  {id: 'squash', n: 1, name: 'Compressão e extensão (squash & stretch)', tip: 'Dá peso e elasticidade: o corpo comprime antes do impulso e estica na velocidade, preservando o volume.',
    paths: ['extras.visual.squashStretch.enableSquashStretch', 'extras.visual.squashStretch.squashIntensity', 'extras.visual.squashStretch.stretchIntensity', 'extras.visual.squashStretch.squashWindow', 'extras.visual.squashStretch.settleDuration', 'extras.visual.squashStretch.preserveVolume', 'extras.visual.squashStretch.plScaling', 'extras.visual.squashStretch.squashOnDodge', 'extras.visual.squashStretch.dodgeSquashScale'], fields: ['squashScale']},
  {id: 'anticipation', n: 2, name: 'Antecipação', tip: 'O movimento de preparação que avisa o que vem: agachar antes de pular, recuar antes do golpe.',
    paths: ['rules.slamPrepTime', 'rules.feintWindow', 'rules.feintDuration', 'actions.tackle.curveStart', 'actions.dodge.curveStart'], fields: ['startup', 'jumpStartTime']},
  {id: 'staging', n: 3, name: 'Encenação (staging)', tip: 'Deixar a ação legível: câmera, enquadramento e destaque do golpe.',
    paths: ['extras.cameraExtra.cameraShakeAmount', 'extras.cameraExtra.cameraShakeDecay', 'extras.cameraExtra.framingPadding', 'extras.cameraExtra.lockTargetBias', 'extras.cameraExtra.framingSeparationFactor'], fields: []},
  {id: 'posetopose', n: 4, name: 'Ação direta e pose a pose', tip: 'Como o clipe foi animado. No jogo você controla o recorte, o laço e as fases do clipe (aba Visão geral).',
    paths: [], fields: ['trimStart', 'trimEnd', 'loopStart', 'loopEnd']},
  {id: 'followthrough', n: 5, name: 'Continuidade e sobreposição (follow through)', tip: 'Partes do corpo que continuam depois do golpe e a transição suave para a próxima pose.',
    paths: ['display.animation.fade', 'display.animation.actionFade', 'extras.combat.landingSkidFraction', 'extras.combat.landingSkidDrag', 'extras.combat.landingSkidMin', 'rules.slamRecovery', 'rules.landingRecovery'], fields: ['blendIn', 'blendOut']},
  {id: 'slowinout', n: 6, name: 'Aceleração e desaceleração (slow in / slow out)', tip: 'Começar e terminar devagar, ganhando velocidade no meio.',
    paths: ['locomotion.accelCurve', 'locomotion.brakeCurve', 'display.animation.locomotionHold'], fields: ['blendCurve']},
  {id: 'arcs', n: 7, name: 'Arcos', tip: 'Trajetórias curvas naturais. No jogo vêm do clipe; o salto usa gravidade de subida e queda ajustáveis.',
    paths: ['map.jumpGravityUp', 'map.jumpGravityDown', 'map.jumpHeight', 'actions.dodge.vaultUp', 'actions.dodge.vaultGravity'], fields: []},
  {id: 'secondary', n: 8, name: 'Ação secundária', tip: 'Movimentos que reforçam a ação principal: rastro (smear), poeira, som.',
    paths: ['extras.visual.smear.enableSmear', 'extras.visual.smear.smearDurationFrames', 'extras.visual.smear.smearMinVelocity', 'extras.visual.smear.smearWidth', 'extras.visual.smear.smearOpacity', 'extras.visual.smear.smearPlBoost', 'extras.visual.smear.smearOnDodge'], fields: []},
  {id: 'timing', n: 9, name: 'Temporização (timing)', tip: 'Velocidade e duração: quanto tempo cada fase dura e quanto a pausa do impacto segura o golpe.',
    paths: ['display.animation.speed', 'extras.combat.impactHitstop', 'extras.combat.clashHitstop', 'extras.combat.hitstopDamageBoost', 'extras.combat.hitstopDamageRef', 'extras.toggles.enableHitstop'], fields: ['speed', 'maxDuration', 'hitstopMult']},
  {id: 'exaggeration', n: 10, name: 'Exagero', tip: 'Levar a pose e o impacto além do realista para dar força.',
    paths: ['rules.slamImpactScale', 'rules.slamImpactShake', 'vfx.shakeHit.amplitude', 'vfx.shakeGround.amplitude', 'vfx.shakeClash.amplitude', 'vfx.shakeMaster.enabled'], fields: ['squashScale']},
  {id: 'solid', n: 11, name: 'Volume e desenho sólido', tip: 'Manter o personagem com volume coerente: tamanho visual, largura e profundidade.',
    paths: ['extras.visual.bodyHeight', 'extras.visual.bodyWidth', 'extras.visual.bodyDepth', 'display.grounding.autoGround', 'display.grounding.visualOffset'], fields: ['verticalOffset'], char: ['heightScale', 'widthScale']},
  {id: 'appeal', n: 12, name: 'Apelo (appeal)', tip: 'Personalidade e leitura visual: cor do lutador, escala e identidade. Cor e tamanho ficam no menu rápido e em Personagens.',
    paths: [], fields: [], char: ['heightScale', 'widthScale']},
];

/**
 * Fases que a SIMULAÇÃO declara (saída de effectiveMovePhases, em segundos da ação) → faixas de referência da timeline.
 * O clipe é esticado para a duração da ação, então a fração é segundos ÷ duração. Somente leitura: não inventa nada.
 */
export function gameTracksFromPhases(phases) {
  const out = [];
  if (!phases || !phases.duration) return out;
  const f = s => s / phases.duration;
  if (phases.startup && phases.startup[1] > phases.startup[0]) out.push({kind: 'startup', start: f(phases.startup[0]), end: f(phases.startup[1])});
  for (const a of phases.active || []) out.push({kind: 'active', start: f(a[0]), end: f(a[1])});
  if (phases.recovery && phases.recovery[1] > phases.recovery[0]) out.push({kind: 'recovery', start: f(phases.recovery[0]), end: f(phases.recovery[1])});
  if (phases.cancel) out.push({kind: 'cancel', start: f(phases.cancel[0]), end: f(phases.cancel[1])});
  for (const v of phases.invulnerable || []) out.push({kind: 'invuln', start: f(v[0]), end: f(v[1])});
  return out;
}
