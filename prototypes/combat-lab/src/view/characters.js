// Personagens do Animation Studio no laboratório.
// O .glb exportado pelo Studio traz o mapa de ações (extras.arenamonActions) e, em cada animação, os eventos
// de combate (extras.arenamon). Sem mapa, as animações são associadas por nome (com sinônimos em inglês e
// português). Cada estado da simulação escolhe uma ação; transições curtas (entrar/sair da defesa, impacto na
// defesa) tocam por cima. O tempo das animações com duração definida (tackle, esquiva, recuo, guard stun,
// voo, aterrissagem) vem do estado da simulação, então acompanha a física inclusive no replay.
//
// Velocidade: cada ação tem um multiplicador (e há um global). Com “durações das animações definem as regras”
// ligado, a duração das ações no jogo passa a ser duração do clip ÷ velocidade (ver ruleDurations).
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {C} from '../sim/config.js';
import {actionDuration} from '../sim/entity.js';
import {angleOf, angleDelta, length} from '../sim/math.js';

/** Ordem de preferência por estado (a primeira ação associada é usada). */
export const STATE_ACTIONS = {
  neutral: ['idle'], turn: ['turn', 'idle'], walk: ['walk', 'run', 'idle'], run: ['run', 'walk', 'idle'], walk_back: ['walk_back', 'walk', 'idle'],
  walk_left: ['walk_left', 'strafe_left', 'walk', 'idle'], walk_right: ['walk_right', 'strafe_right', 'walk', 'idle'],
  guard_enter: ['block_start', 'block', 'idle'], guard: ['block', 'block_start', 'idle'], guard_exit: ['block_end', 'idle'], guard_hit: ['guard_impact', 'blocked', 'block', 'idle'],
  guardStun: ['guard_impact', 'blocked', 'block', 'idle'], tackle: ['tackle', 'run', 'idle'],
  dodge_forward: ['dodge_forward', 'dodge_left', 'jump', 'idle'], dodge_back: ['dodge_back', 'dodge_forward', 'idle'], dodge_left: ['dodge_left', 'dodge_forward', 'idle'],
  dodge_right: ['dodge_right', 'dodge_left', 'dodge_forward', 'idle'], vault: ['jump', 'dodge_forward', 'idle'], recoil: ['blocked', 'hit', 'idle'],
  airborne: ['knockback', 'fall', 'hit', 'idle'], landing: ['land', 'recover', 'downed', 'idle'], recover: ['recover', 'land', 'idle'], defeated: ['death', 'downed', 'idle'], pushed: ['hit', 'idle'],
};
export const STATE_LABELS = {neutral: 'Parado', turn: 'Girando no lugar', walk: 'Andando', run: 'Correndo', walk_back: 'Recuando', walk_left: 'Lateral esquerda', walk_right: 'Lateral direita',
  guard_enter: 'Entrando na defesa', guard: 'Defendendo', guard_exit: 'Saindo da defesa', guard_hit: 'Defesa perfeita', guardStun: 'Guard stun', tackle: 'Tackle', dodge_forward: 'Esquiva frontal',
  dodge_back: 'Esquiva traseira', dodge_left: 'Esquiva esquerda', dodge_right: 'Esquiva direita', vault: 'Salto sobre o rival', recoil: 'Recuo (bloqueado)', airborne: 'Lançado',
  landing: 'Aterrissando', recover: 'Recuperando (exausto)', defeated: 'Derrotado', pushed: 'Empurrado'};
/** Ações listadas no painel (uma linha por ação; cada uma serve a um ou mais estados). */
export const ACTION_IDS = ['idle', 'turn', 'walk', 'run', 'walk_back', 'walk_left', 'walk_right', 'block_start', 'block', 'block_end', 'guard_impact', 'blocked', 'tackle',
  'dodge_forward', 'dodge_back', 'dodge_left', 'dodge_right', 'jump', 'hit', 'knockback', 'fall', 'land', 'recover', 'downed', 'death'];
// Sinônimos para associar por nome quando o arquivo não traz o mapa do Studio.
const ALIASES = {
  idle: ['idle', 'parado', 'stand', 'breathing idle', 'breath'], turn: ['turn', 'girar', 'turn in place'], walk: ['walk', 'walking', 'andar', 'caminhar'], run: ['run', 'running', 'correr', 'sprint'],
  walk_back: ['walk back', 'walking backward', 'backward walk', 'back walk', 'recuar'], walk_left: ['walk left', 'left strafe', 'strafe left', 'left walk'], walk_right: ['walk right', 'right strafe', 'strafe right', 'right walk'],
  block_start: ['block start', 'guard start', 'block idle start'], block: ['block', 'guard', 'defend', 'defesa', 'blocking'], block_end: ['block end', 'guard end'],
  guard_impact: ['guard impact', 'block hit', 'block impact', 'guard hit'], blocked: ['blocked', 'recoil', 'bounce', 'rebote'],
  tackle: ['tackle', 'dash attack', 'charge', 'attack', 'investida'], dodge_forward: ['dodge forward', 'dodge', 'front', 'roll forward', 'forward roll', 'esquiva'],
  dodge_back: ['dodge back', 'back', 'backstep', 'roll back'], dodge_left: ['dodge left', 'side', 'left', 'roll left'], dodge_right: ['dodge right', 'side', 'right', 'roll right'],
  jump: ['jump', 'vault', 'salto', 'pulo'], hit: ['hit', 'hurt', 'damage', 'impact', 'dano'], knockback: ['knockback', 'knock back', 'push', 'launched', 'fly', 'lancado'],
  fall: ['fall', 'falling', 'queda'], land: ['land', 'landing', 'aterrissar'], recover: ['recover', 'get up', 'getup', 'stand up', 'levantar'], downed: ['downed', 'down', 'caido'],
  death: ['death', 'die', 'dying', 'dead', 'ko', 'derrota'],
};
const TIMED = new Set(['tackle', 'dodge_forward', 'dodge_back', 'dodge_left', 'dodge_right', 'vault', 'recoil', 'guardStun', 'airborne', 'landing', 'recover', 'defeated']);
const TRANSIENT = new Set(['guard_enter', 'guard_exit', 'guard_hit']);

export async function loadStudioFile(file) {
  const data = await file.arrayBuffer(), gltf = await new GLTFLoader().parseAsync(data, '');
  let manifest = null;gltf.scene.traverse(o => {manifest ??= o.userData?.arenamonActions;});
  let meshes = 0;gltf.scene.traverse(o => {if (o.isMesh) meshes++;});
  if (!meshes) throw Error('O arquivo não contém malha.');
  if (!gltf.animations.length) throw Error('O arquivo não contém animações.');
  return {name: file.name, scene: gltf.scene, animations: gltf.animations, manifest, eventsByClip: gltf.animations.map(c => c.userData?.arenamon?.events || [])};
}

export class Character {
  constructor(source, {tint = null} = {}) {
    this.source = source;this.root = clone(source.scene);this.mixer = new T.AnimationMixer(this.root);
    this.clips = source.animations;this.mapping = autoMapping(source);this.speeds = {};
    this.current = null;this.previous = null;this.fade = 0;this.timer = 0;this.clock = 0;this.flightV0 = 0;this.wasFlying = false;this.lastFlight = -Infinity;
    this.transient = null;this.wasGuard = false;this.seenEvents = new WeakSet();this.statesSeen = new Set();
    this.root.traverse(o => {if (o.isMesh) {o.frustumCulled = false;if (tint) {const mats = [].concat(o.material).map(m => {const c = m.clone();c.color?.lerp(new T.Color(tint), .35);return c;});o.material = Array.isArray(o.material) ? mats : mats[0];}}});
    this.root.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(this.root);this.restHeight = Math.max(1e-3, box.max.y - box.min.y);this.restMinY = box.min.y;
    this.hips = null;this.root.traverse(o => {if (!this.hips && o.isBone && /hip|pelvis|root/i.test(o.name)) this.hips = o;});
    if (!this.hips) this.root.traverse(o => {if (!this.hips && o.isBone) this.hips = o;});
    this.hipsRest = this.hips?.position.clone();
  }
  speedOf(id) {return (Character.options.speed || 1) * (this.speeds[id] ?? 1);}
  /** Ação e clip para um estado (null se nem o idle estiver associado). */
  clipFor(stateKey) {for (const id of STATE_ACTIONS[stateKey] || ['idle']) {const i = this.mapping[id];if (i != null && this.clips[i]) return {id, index: i};}return null;}
  /** Estados que caem no idle (ou em nada) por falta de animação própria. */
  missingStates() {return Object.keys(STATE_ACTIONS).filter(k => k !== 'neutral' && !TRANSIENT.has(k) && (this.clipFor(k)?.id ?? 'idle') === 'idle');}
  stateKey(f) {
    if (f.hp <= 0 && !f.flight) return 'defeated';
    if (f.flight) return 'airborne';
    if (f.state === 'landing') return this.clock - this.lastFlight < 1.5 ? 'landing' : 'recover';
    if (f.action?.kind === 'tackle') return 'tackle';
    if (f.action?.kind === 'dodge') {
      if (f.action.vault) return 'vault';
      const rel = angleDelta(f.facing, f.action.heading);return Math.abs(rel) < Math.PI / 4 ? 'dodge_forward' : Math.abs(rel) > 3 * Math.PI / 4 ? 'dodge_back' : rel > 0 ? 'dodge_left' : 'dodge_right';
    }
    if (f.action?.kind === 'recoil') return 'recoil';
    if (f.state === 'guardStun') return 'guardStun';
    if (f.guard) return 'guard';
    const speed = length(f.velocity);
    if (speed < .15) return Math.abs(angleDelta(f.visualFacing, f.facing)) > .2 ? 'turn' : 'neutral';
    const rel = angleDelta(f.facing, angleOf(f.velocity));
    if (Math.abs(rel) > 3 * Math.PI / 4) return 'walk_back';
    if (Math.abs(rel) > Math.PI / 4) return rel > 0 ? 'walk_left' : 'walk_right';
    return speed > f.attributes.speed * .6 ? 'run' : 'walk';
  }
  /** Progresso 0..1 dos estados com duração definida pela simulação. */
  progress(f, key) {
    const R = C.rules;
    if (key === 'tackle') return f.action ? f.action.elapsed / actionDuration('tackle') : 1;
    if (key.startsWith('dodge') || key === 'vault') return f.action ? f.action.elapsed / actionDuration('dodge') : 1;
    if (key === 'recoil') return f.action ? f.action.elapsed / R.recoil : 1;
    if (key === 'guardStun') return 1 - f.stun / Math.max(1e-6, R.guardStun);
    if (key === 'landing') return 1 - f.knockRecovery / Math.max(1e-6, R.landingRecovery);
    if (key === 'recover') return 1 - f.knockRecovery / Math.max(1e-6, C.extras.combat.exhaustRecovery);
    if (key === 'airborne') return this.flightV0 > 0 ? Math.min(1, Math.max(0, (this.flightV0 - f.flight.vy) / (2 * this.flightV0))) : 0;
    if (key === 'defeated') return Math.min(1, this.timer / 1.2);
    return 0;
  }
  /** Transições curtas: entrar/sair da defesa e defesa perfeita. */
  transients(f, events) {
    for (const e of events) if (!this.seenEvents.has(e)) {this.seenEvents.add(e);if (e.target === f.id && e.result === 'perfect') this.startTransient('guard_hit');}
    if (f.guard && !this.wasGuard && !f.action) this.startTransient('guard_enter');
    if (!f.guard && this.wasGuard && !f.action && f.state !== 'guardStun') this.startTransient('guard_exit');
    this.wasGuard = f.guard;
    // Ações, voo, stun e derrota têm prioridade sobre a transição.
    if (this.transient && (f.action || f.flight || f.state === 'guardStun' || f.state === 'landing' || f.hp <= 0 || this.clock >= this.transient.until)) this.transient = null;
  }
  startTransient(key) {
    const pick = this.clipFor(key);if (!pick || pick.id !== STATE_ACTIONS[key][0]) return; // só com animação própria
    this.transient = {key, until: this.clock + (this.clips[pick.index].duration || .2) / this.speedOf(pick.id)};
  }
  update(f, dt, alt, events = []) {
    const opt = Character.options;this.clock += dt;
    if (f.flight && !this.wasFlying) this.flightV0 = f.flight.vy + C.rules.launchGravity * C.test.step;
    if (f.flight) this.lastFlight = this.clock;this.wasFlying = !!f.flight;
    this.transients(f, events);
    const key = this.transient?.key ?? this.stateKey(f), pick = this.clipFor(key);this.statesSeen.add(key);
    if (pick && (pick.index !== this.current?.index || (TRANSIENT.has(key) && this.current?.key !== key))) {
      this.previous = this.current;this.current = {index: pick.index, id: pick.id, action: this.mixer.clipAction(this.clips[pick.index]), key, started: this.clock};
      if (this.previous?.action === this.current.action) this.previous = null;
      this.current.action.reset().play();this.fade = 0;this.timer = 0;
    } else if (this.current) {this.current.key = key;this.current.id = pick?.id ?? this.current.id;}
    this.fade += dt;this.timer += dt;
    const w = opt.fade > 0 ? Math.min(1, this.fade / opt.fade) : 1;
    if (this.previous) {this.previous.action.enabled = true;this.previous.action.setEffectiveWeight(1 - w);if (w >= 1) {this.previous.action.stop();this.previous = null;}}
    if (this.current) {
      const a = this.current.action, d = a.getClip().duration || 1, s = this.speedOf(this.current.id);
      a.enabled = true;a.setEffectiveWeight(w);a.paused = true;
      if (TRANSIENT.has(key)) a.time = Math.min(d, (this.clock - this.current.started) * s);
      else if (TIMED.has(key)) {
        // Sincronizado com as regras: o clip ocupa exatamente a ação. Sem sincronia: a velocidade acelera/desacelera
        // o clip dentro da ação (com velocidade maior ele termina antes e segura a última pose).
        const p = Math.max(0, this.progress(f, key));a.time = Math.min(d, (opt.syncRules ? p : p * s) * d);
      } else a.time = (a.time + dt * s) % d;
    }
    this.mixer.update(0);
    if (opt.lockRoot && this.hips && this.hipsRest) {this.hips.position.x = this.hipsRest.x;this.hips.position.z = this.hipsRest.z;}
    const scale = opt.fit ? C.extras.visual.bodyHeight / this.restHeight : 1;
    this.root.scale.setScalar(scale);this.root.position.set(f.position.x, alt - (opt.fit ? this.restMinY * scale : 0), f.position.z);this.root.rotation.set(0, f.visualFacing, 0);
  }
  /** Durações das regras derivadas dos clips associados (duração ÷ velocidade). Só ações com animação própria. */
  ruleDurations() {
    const out = {}, own = id => this.mapping[id] != null ? this.clips[this.mapping[id]].duration / this.speedOf(id) : null;
    const set = (path, v, from) => {if (v && Number.isFinite(v)) out[path] = {value: Math.round(v * 1000) / 1000, from};};
    set('actions.tackle.duration', own('tackle'), 'tackle');set('actions.dodge.duration', own('dodge_forward'), 'dodge_forward');
    set('rules.recoil', own('blocked'), 'blocked');set('rules.guardStun', own('guard_impact'), 'guard_impact');
    set('rules.landingRecovery', own('land') ?? own('recover'), this.mapping.land != null ? 'land' : 'recover');
    // As janelas marcadas no Studio (hitbox, invulnerabilidade) servem só para comparação: nunca alteram as regras.
    return out;
  }
  dispose() {this.mixer.stopAllAction();this.mixer.uncacheRoot(this.root);this.root.removeFromParent();}
}
Character.options = {lockRoot: true, fit: true, fade: .1, speed: 1, syncRules: false};

/** Mapa ação → clip: primeiro o manifesto do Studio; depois nomes exatos; depois palavras contidas no nome. */
export function autoMapping(source) {
  const map = {}, clips = source.animations, norm = s => ` ${s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;
  for (const [id, ref] of Object.entries(source.manifest?.actions || {})) if (ref && clips[ref.clipIndex]?.name === ref.clipName) map[id] = ref.clipIndex;
  const names = clips.map(c => norm(c.name));
  for (const pass of ['exact', 'contains']) for (const id of ACTION_IDS) {
    if (map[id] != null) continue;
    for (const alias of ALIASES[id] || [id.replaceAll('_', ' ')]) {
      // Nome exato pode servir a várias ações (ex.: “side” → esquivas laterais); por palavra contida, só clips ainda livres.
      const a = ` ${alias} `, used = new Set(Object.values(map)), i = names.findIndex((n, k) => pass === 'exact' ? n === a : n.includes(a) && !used.has(k));
      if (i >= 0) {map[id] = i;break;}
    }
  }
  return map;
}

// ---------- Eventos do Studio × janelas da simulação ----------
const pick = (events, type) => events.filter(e => e.type === type).map(e => e.time).sort((a, b) => a - b);
/** Janelas do Studio, em segundos da AÇÃO do jogo (o clip é reescalado para a duração da ação). */
export function studioWindows(character, actionId) {
  const i = character.mapping[actionId];if (i == null) return null;
  const clip = character.clips[i], events = character.source.eventsByClip[i] || [], d = clip.duration || 1, s = actionDuration(actionId === 'tackle' ? 'tackle' : 'dodge') / d;
  const on = pick(events, 'hitbox_on'), off = pick(events, 'hitbox_off'), inv0 = pick(events, 'invulnerable_start'), inv1 = pick(events, 'invulnerable_end');
  return {clip: clip.name, clipDuration: d, scale: s, events: events.length,
    hitbox: on.length ? [on[0] * s, (off.find(t => t > on[0]) ?? d) * s] : null,
    invulnerable: inv0.length ? [inv0[0] * s, (inv1.find(t => t > inv0[0]) ?? d) * s] : null,
    impact: pick(events, 'impact')[0] != null ? pick(events, 'impact')[0] * s : null,
    recovery: pick(events, 'recovery_start')[0] != null ? pick(events, 'recovery_start')[0] * s : null};
}
/** Janelas reais da simulação para tackle e esquiva. */
export function gameWindows(kind) {
  const p = C.actions[kind], inv = C.extras.toggles.enableInvulnerability && p.invulnerable > 0 ? [0, p.invulnerable] : null;
  return {hitbox: kind === 'tackle' ? [0, p.duration] : null, invulnerable: inv, recovery: p.chainAfter};
}
export function compareWindows(character) {
  const rows = [];const ms = s => (s * 1000).toFixed(0);
  for (const [actionId, kind] of [['tackle', 'tackle'], ['dodge_forward', 'dodge']]) {
    const st = studioWindows(character, actionId);if (!st) {rows.push({action: actionId, missing: true});continue;}
    const g = gameWindows(kind);
    const cmp = (label, a, b) => {
      if (!a && !b) return null;
      if (!a) return {label, studio: 'não marcado', game: `${ms(b[0])}–${ms(b[1])} ms`, ok: false, note: 'O Studio não marca esta janela.'};
      if (!b) return {label, studio: `${ms(a[0])}–${ms(a[1])} ms`, game: 'não existe', ok: false, note: 'O jogo não tem esta janela nesta ação.'};
      const d0 = a[0] - b[0], d1 = a[1] - b[1], tol = C.test.step * 1.01;
      return {label, studio: `${ms(a[0])}–${ms(a[1])} ms`, game: `${ms(b[0])}–${ms(b[1])} ms`, ok: Math.abs(d0) <= tol && Math.abs(d1) <= tol, note: `início ${d0 >= 0 ? '+' : ''}${ms(d0)} ms · fim ${d1 >= 0 ? '+' : ''}${ms(d1)} ms`};
    };
    const out = [cmp('Hitbox ativa', st.hitbox, g.hitbox), cmp('Invulnerabilidade', st.invulnerable, g.invulnerable)].filter(Boolean);
    if (st.recovery != null) out.push({label: 'Início da recuperação', studio: `${ms(st.recovery)} ms`, game: `cancelável aos ${ms(g.recovery)} ms`, ok: Math.abs(st.recovery - g.recovery) <= C.test.step * 1.01, note: ''});
    rows.push({action: actionId, clip: st.clip, events: st.events, scale: st.scale, impact: st.impact, rows: out, duration: actionDuration(kind)});
  }
  return rows;
}
