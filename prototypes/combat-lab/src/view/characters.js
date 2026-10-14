// Personagens do Animation Studio no laboratório.
// O .glb exportado pelo Studio traz o mapa de ações (extras.arenamonActions) e, em cada animação,
// os eventos de combate (extras.arenamon). Aqui cada estado da simulação escolhe uma ação; o tempo das
// animações com duração definida (tackle, esquiva, recuo, aterrissagem, guard stun, voo) é calculado a
// partir do estado da simulação, então a animação acompanha exatamente a física, inclusive no replay.
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {C} from '../sim/config.js';
import {angleOf, angleDelta, length} from '../sim/math.js';

/** Ordem de preferência por estado (a primeira ação associada no Studio é usada). */
export const STATE_ACTIONS = {
  neutral: ['idle'], walk: ['walk', 'run', 'idle'], run: ['run', 'walk', 'idle'], walk_back: ['walk_back', 'walk', 'idle'],
  walk_left: ['walk_left', 'strafe_left', 'walk', 'idle'], walk_right: ['walk_right', 'strafe_right', 'walk', 'idle'],
  guard: ['block', 'block_start', 'idle'], guardStun: ['guard_impact', 'blocked', 'block', 'idle'], tackle: ['tackle', 'run', 'idle'],
  dodge_forward: ['dodge_forward', 'dodge_left', 'jump', 'idle'], dodge_back: ['dodge_back', 'dodge_forward', 'idle'], dodge_left: ['dodge_left', 'dodge_forward', 'idle'],
  dodge_right: ['dodge_right', 'dodge_forward', 'idle'], vault: ['jump', 'dodge_forward', 'idle'], recoil: ['blocked', 'hit', 'idle'],
  airborne: ['knockback', 'fall', 'hit', 'idle'], landing: ['land', 'recover', 'downed', 'idle'], defeated: ['death', 'downed', 'idle'], pushed: ['hit', 'idle'],
};
const LOOPED = new Set(['neutral', 'walk', 'run', 'walk_back', 'walk_left', 'walk_right', 'guard']);

export async function loadStudioFile(file) {
  const data = await file.arrayBuffer(), gltf = await new GLTFLoader().parseAsync(data, '');
  let manifest = null;gltf.scene.traverse(o => {manifest ??= o.userData?.arenamonActions;});
  let meshes = 0;gltf.scene.traverse(o => {if (o.isMesh) meshes++;});
  if (!meshes) throw Error('O arquivo não contém malha.');
  return {name: file.name, scene: gltf.scene, animations: gltf.animations, manifest, eventsByClip: gltf.animations.map(c => c.userData?.arenamon?.events || [])};
}

export class Character {
  constructor(source, {tint = null} = {}) {
    this.source = source;this.root = clone(source.scene);this.mixer = new T.AnimationMixer(this.root);
    this.clips = source.animations;this.mapping = autoMapping(source);this.current = null;this.previous = null;this.fade = 0;this.timer = 0;this.flightV0 = 0;this.wasFlying = false;
    this.root.traverse(o => {if (o.isMesh) {o.frustumCulled = false;if (tint) {const mats = [].concat(o.material).map(m => {const c = m.clone();c.color?.lerp(new T.Color(tint), .35);return c;});o.material = Array.isArray(o.material) ? mats : mats[0];}}});
    // Osso raiz (para travar o deslocamento) e altura em repouso (para ajustar ao colisor).
    this.root.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(this.root);this.restHeight = Math.max(1e-3, box.max.y - box.min.y);this.restMinY = box.min.y;
    this.hips = null;this.root.traverse(o => {if (!this.hips && o.isBone && /hip|pelvis|root/i.test(o.name)) this.hips = o;});
    if (!this.hips) this.root.traverse(o => {if (!this.hips && o.isBone) this.hips = o;});
    this.hipsRest = this.hips?.position.clone();
  }
  /** Ação do Studio (id) → índice do clip, para cada estado. */
  clipFor(stateKey) {for (const id of STATE_ACTIONS[stateKey] || ['idle']) {const i = this.mapping[id];if (i != null && this.clips[i]) return {id, index: i};}return null;}
  stateKey(f) {
    if (f.hp <= 0 && !f.flight) return 'defeated';
    if (f.flight) return 'airborne';
    if (f.state === 'landing') return 'landing';
    if (f.action?.kind === 'tackle') return 'tackle';
    if (f.action?.kind === 'dodge') {
      if (f.action.vault) return 'vault';
      const rel = angleDelta(f.facing, f.action.heading);return Math.abs(rel) < Math.PI / 4 ? 'dodge_forward' : Math.abs(rel) > 3 * Math.PI / 4 ? 'dodge_back' : rel > 0 ? 'dodge_left' : 'dodge_right';
    }
    if (f.action?.kind === 'recoil') return 'recoil';
    if (f.state === 'guardStun') return 'guardStun';
    if (f.guard) return 'guard';
    const speed = length(f.velocity);if (speed < .15) return 'neutral';
    const rel = angleDelta(f.facing, angleOf(f.velocity));
    if (Math.abs(rel) > 3 * Math.PI / 4) return 'walk_back';
    if (Math.abs(rel) > Math.PI / 4) return rel > 0 ? 'walk_left' : 'walk_right';
    return speed > f.attributes.speed * .6 ? 'run' : 'walk';
  }
  /** Progresso 0..1 dos estados com duração definida (null para estados em loop). */
  progress(f, key) {
    const R = C.rules;
    if (key === 'tackle' || key.startsWith('dodge') || key === 'vault') return f.action ? f.action.elapsed / R.dodge : 1;
    if (key === 'recoil') return f.action ? f.action.elapsed / R.recoil : 1;
    if (key === 'guardStun') return 1 - f.stun / Math.max(1e-6, R.guardStun);
    if (key === 'landing') return 1 - f.knockRecovery / Math.max(1e-6, R.landingRecovery);
    if (key === 'airborne') return this.flightV0 > 0 ? Math.min(1, Math.max(0, (this.flightV0 - f.flight.vy) / (2 * this.flightV0))) : 0;
    if (key === 'defeated') return Math.min(1, this.timer / 1.2);
    return null;
  }
  update(f, dt, alt) {
    const opt = Character.options;
    if (f.flight && !this.wasFlying) this.flightV0 = f.flight.vy + C.rules.launchGravity * C.test.step;
    this.wasFlying = !!f.flight;
    const key = this.stateKey(f), pick = this.clipFor(key);
    if (pick && pick.index !== this.current?.index) {
      this.previous = this.current;this.current = {index: pick.index, action: this.mixer.clipAction(this.clips[pick.index]), key};
      this.current.action.reset().play();this.fade = 0;this.timer = 0;
    } else if (this.current) this.current.key = key;
    this.fade += dt;this.timer += dt;
    const w = opt.fade > 0 ? Math.min(1, this.fade / opt.fade) : 1;
    for (const entry of [this.previous, this.current]) if (entry) entry.action.enabled = true;
    if (this.previous) {this.previous.action.setEffectiveWeight(1 - w);if (w >= 1) {this.previous.action.stop();this.previous = null;}}
    if (this.current) {
      const a = this.current.action, d = a.getClip().duration || 1, p = this.progress(f, key);
      a.setEffectiveWeight(w);a.paused = true;
      a.time = p === null ? (a.time + dt) % d : Math.min(d, Math.max(0, p) * d);
    }
    this.mixer.update(0);
    if (opt.lockRoot && this.hips && this.hipsRest) {this.hips.position.x = this.hipsRest.x;this.hips.position.z = this.hipsRest.z;}
    const s = opt.fit ? C.extras.visual.bodyHeight / this.restHeight : 1;
    this.root.scale.setScalar(s);this.root.position.set(f.position.x, alt - (opt.fit ? this.restMinY * s : 0), f.position.z);this.root.rotation.set(0, f.visualFacing, 0);
  }
  dispose() {this.mixer.stopAllAction();this.mixer.uncacheRoot(this.root);this.root.removeFromParent();}
}
Character.options = {lockRoot: true, fit: true, fade: .1};

/** Mapa ação → clip a partir do manifesto do Studio; sem manifesto, por nome do clip. */
export function autoMapping(source) {
  const map = {}, clips = source.animations, refs = {...(source.manifest?.actions || {})};
  for (const [id, ref] of Object.entries(refs)) if (ref && clips[ref.clipIndex]?.name === ref.clipName) map[id] = ref.clipIndex;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (const id of new Set(Object.values(STATE_ACTIONS).flat())) {
    if (map[id] != null) continue;
    const words = id.replaceAll('_', ' '), i = clips.findIndex(c => norm(c.name) === words) >= 0 ? clips.findIndex(c => norm(c.name) === words) : clips.findIndex(c => ` ${norm(c.name)} `.includes(` ${words} `));
    if (i >= 0) map[id] = i;
  }
  return map;
}

// ---------- Eventos do Studio × janelas da simulação ----------
const pick = (events, type) => events.filter(e => e.type === type).map(e => e.time).sort((a, b) => a - b);
/** Janelas do Studio, em segundos da AÇÃO do jogo (o clip é reescalado para a duração da ação). */
export function studioWindows(character, actionId) {
  const i = character.mapping[actionId];if (i == null) return null;
  const clip = character.clips[i], events = character.source.eventsByClip[i] || [], d = clip.duration || 1, s = C.rules.dodge / d;
  const on = pick(events, 'hitbox_on'), off = pick(events, 'hitbox_off'), inv0 = pick(events, 'invulnerable_start'), inv1 = pick(events, 'invulnerable_end');
  return {clip: clip.name, clipDuration: d, scale: s, events: events.length,
    hitbox: on.length ? [on[0] * s, (off.find(t => t > on[0]) ?? d) * s] : null,
    invulnerable: inv0.length ? [inv0[0] * s, (inv1.find(t => t > inv0[0]) ?? d) * s] : null,
    impact: pick(events, 'impact')[0] != null ? pick(events, 'impact')[0] * s : null,
    recovery: pick(events, 'recovery_start')[0] != null ? pick(events, 'recovery_start')[0] * s : null};
}
/** Janelas reais da simulação para tackle e esquiva. */
export function gameWindows(kind) {
  const R = C.rules, inv = C.extras.toggles.enableInvulnerability ? [0, R.invulnerable] : null;
  return kind === 'tackle' ? {hitbox: [0, R.dodge], invulnerable: inv, recovery: R.invulnerable} : {hitbox: null, invulnerable: inv, recovery: R.invulnerable};
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
    rows.push({action: actionId, clip: st.clip, events: st.events, scale: st.scale, impact: st.impact, rows: out});
  }
  return rows;
}
