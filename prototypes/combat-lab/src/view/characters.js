// Personagens do Animation Studio no laboratório: máquina de estados de animação.
//
// O .glb exportado pelo Studio traz o mapa de ações (extras.arenamonActions) e, em cada animação, os eventos de
// combate (extras.arenamon). Sem mapa, as animações são associadas por nome (sinônimos em inglês e português).
//
// Regras da máquina de estados (auditoria do overhaul):
//   • Um clipe só (re)começa ao ENTRAR num estado: troca de estado, nova ação (tackle/esquiva novos, detectados
//     pelo tempo da ação que recomeça) ou transição curta. Detectar o mesmo estado em quadros seguidos nunca reinicia.
//   • Cada estado aceita várias animações (variantes). Na entrada, uma variante é sorteada com semente
//     determinística (lutador, estado, passo da simulação): o replay repete a mesma escolha.
//   • Transições usam camadas com fade; ações (X/C) têm fade próprio, curto, para prevalecerem visualmente.
//   • Locomoção tem histerese (parado/andar/correr/laterais) contra oscilações de poucos quadros.
//   • A posição vem só da física: o deslocamento horizontal da raiz do GLB é descartado (sem root motion).
//   • O tempo das animações com duração definida (tackle, esquiva, recuo, guard stun, voo, aterrissagem) vem do
//     estado da simulação (o clipe é esticado para a duração da ação), inclusive no replay.
//   • Telemetria: cada entrada registra animação iniciada/substituída, tempo e porcentagem tocados, motivo,
//     estados anterior e seguinte e origem (jogador, IA, combate ou sistema).
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {C} from '../sim/config.js';
import {actionDuration, actionSpec} from '../sim/entity.js';
import {angleOf, angleDelta, length} from '../sim/math.js';
import {mulberry} from '../sim/ai.js';
import {fromGlbEvents, extractClipDuration} from '../sim/animation-combat-windows.js';
import {sniffFormat} from './validate.js';

/** Ordem de preferência por estado (a primeira ação com animação associada é usada). */
export const STATE_ACTIONS = {
  neutral: ['idle'], turn: ['turn', 'idle'], walk: ['walk', 'run', 'idle'], run: ['run', 'walk', 'idle'],
  walk_back: ['walk_back', 'walk', 'idle'], walk_left: ['walk_left', 'walk', 'idle'], walk_right: ['walk_right', 'walk', 'idle'],
  run_back: ['run_back', 'walk_back', 'run', 'idle'], run_left: ['run_left', 'walk_left', 'run', 'idle'], run_right: ['run_right', 'walk_right', 'run', 'idle'],
  sprint: ['sprint', 'run', 'walk', 'idle'], sprint_back: ['sprint_back', 'run_back', 'walk_back', 'sprint', 'idle'], sprint_left: ['sprint_left', 'run_left', 'walk_left', 'sprint', 'idle'], sprint_right: ['sprint_right', 'run_right', 'walk_right', 'sprint', 'idle'],
  walk_stop: ['walk_stop'], sprint_stop: ['sprint_stop', 'walk_stop'],
  guard_enter: ['block_start', 'block', 'idle'], guard: ['block', 'block_start', 'idle'], guard_exit: ['block_end', 'idle'], guard_hit: ['guard_impact', 'blocked', 'block', 'idle'],
  guardStun: ['guard_impact', 'blocked', 'block', 'idle'], tackle: ['tackle', 'run', 'idle'],
  // Tackle carregado: sem clipe próprio cada nível cai para o clipe do tackle (PL3 → PL2 → tackle); a carga sem clipe usa a pose parada.
  wallSplat: ['wall_splat', 'hit', 'knockback', 'idle'],
  meteor_prep: ['meteor_prep', 'knockback', 'fall', 'idle'], meteor_dive: ['meteor_dive', 'tackle', 'fall', 'run', 'idle'], meteor_ground: ['meteor_ground', 'tackle', 'fall', 'idle'],
  tackle_charge: ['tackle_charge', 'idle'], tackle_pl2: ['tackle_pl2', 'tackle', 'run', 'idle'], tackle_pl3: ['tackle_pl3', 'tackle_pl2', 'tackle', 'run', 'idle'], brake: ['brake', 'sprint_stop', 'walk_stop', 'idle'],
  dodge_forward: ['dodge_forward', 'dodge_left', 'jump', 'idle'], dodge_back: ['dodge_back', 'dodge_forward', 'idle'], dodge_left: ['dodge_left', 'dodge_forward', 'idle'],
  dodge_right: ['dodge_right', 'dodge_left', 'dodge_forward', 'idle'], vault: ['jump', 'dodge_forward', 'idle'], recoil: ['blocked', 'hit', 'idle'],
  // Movimentos especiais por slot (o Studio já exporta move_1…move_4 no mapa de ações); sem clipe próprio, usa o do tackle.
  move_1: ['move_1', 'tackle', 'idle'], move_2: ['move_2', 'tackle', 'idle'], move_3: ['move_3', 'tackle', 'idle'], move_4: ['move_4', 'tackle', 'idle'],
  charge_reflect: ['reflect_charge', 'idle'], release_reflect: ['reflect_release', 'move_1', 'tackle'],
  charge_psyshock: ['psyshock_charge', 'idle'], release_psyshock: ['psyshock_release', 'move_2', 'tackle'],
  jump: ['jump', 'vault', 'fall', 'idle'],
  airborne: ['knockback', 'fall', 'hit', 'idle'], landing: ['land', 'recover', 'downed', 'idle'], recover: ['recover', 'land', 'idle'], defeated: ['death', 'downed', 'idle'], pushed: ['hit', 'idle'],
};
export const STATE_LABELS = {neutral: 'Parado', turn: 'Girando no lugar', walk: 'Andando para frente', walk_back: 'Andando para trás', walk_left: 'Andando à esquerda', walk_right: 'Andando à direita',
  run: 'Correndo para frente', run_back: 'Correndo para trás', run_left: 'Correndo à esquerda', run_right: 'Correndo à direita', sprint: 'Sprint para frente', sprint_back: 'Sprint para trás', sprint_left: 'Sprint à esquerda', sprint_right: 'Sprint à direita', walk_stop: 'Freio da caminhada', sprint_stop: 'Freio do sprint',
  guard_enter: 'Entrando na defesa', guard: 'Defendendo', guard_exit: 'Saindo da defesa', guard_hit: 'Defesa perfeita', guardStun: 'Guard stun', tackle: 'Tackle', meteor_prep: 'Meteor: preparação no ar', meteor_dive: 'Meteor: mergulho', meteor_ground: 'Meteor: no chão', wallSplat: 'Preso na parede (wall-splat)', tackle_charge: 'Carregando tackle', tackle_pl2: 'Tackle PL2', tackle_pl3: 'Tackle PL3', brake: 'Freio do tackle (finta)', dodge_forward: 'Esquiva frontal',
  dodge_back: 'Esquiva traseira', dodge_left: 'Esquiva esquerda', dodge_right: 'Esquiva direita', vault: 'Salto sobre o rival', jump: 'Pulo', recoil: 'Recuo (bloqueado)', airborne: 'Lançado',
  landing: 'Aterrissando', recover: 'Recuperando (exausto)', defeated: 'Derrotado', pushed: 'Empurrado', __preview: 'Prévia',
  move_1: 'Movimento 1', move_2: 'Movimento 2', move_3: 'Movimento 3', move_4: 'Movimento 4',
  charge_reflect: 'Carregando Reflect', release_reflect: 'Disparo do Reflect',
  charge_psyshock: 'Carregando Psyshock', release_psyshock: 'Disparo do Psyshock'};
/** Blocos de animação listados no painel (cada um serve a um ou mais estados e aceita várias variantes). */
export const ACTION_IDS = ['idle', 'turn', 'walk', 'walk_back', 'walk_left', 'walk_right', 'run', 'run_back', 'run_left', 'run_right', 'sprint', 'sprint_back', 'sprint_left', 'sprint_right', 'walk_stop', 'sprint_stop', 'block_start', 'block', 'block_end', 'guard_impact', 'blocked', 'tackle', 'tackle_charge', 'tackle_pl2', 'tackle_pl3', 'brake', 'wall_splat', 'meteor_prep', 'meteor_dive', 'meteor_ground',
  'dodge_forward', 'dodge_back', 'dodge_left', 'dodge_right', 'jump', 'hit', 'knockback', 'fall', 'land', 'recover', 'downed', 'death', 'move_1', 'move_2', 'move_3', 'move_4'];
// Sinônimos para associar por nome quando o arquivo não traz o mapa do Studio.
const ALIASES = {
  idle: ['idle', 'parado', 'stand', 'breathing idle', 'breath'], turn: ['turn', 'girar', 'turn in place'], walk: ['walk', 'walking', 'andar', 'caminhar'], run: ['run', 'running', 'correr'],
  sprint: ['sprint', 'sprinting', 'fast run', 'dash run'], sprint_back: ['sprint back', 'sprint backward'], sprint_left: ['sprint left', 'sprint strafe left'], sprint_right: ['sprint right', 'sprint strafe right'],
  run_back: ['run back', 'running backward'], run_left: ['run left', 'running left', 'run strafe left'], run_right: ['run right', 'running right', 'run strafe right'], walk_stop: ['walk stop', 'walking stop', 'walk to stop', 'stop walking', 'freio'], sprint_stop: ['run stop', 'sprint stop', 'run to stop', 'running stop'],
  walk_back: ['walk back', 'walking backward', 'walk backward', 'backward walk', 'back walk', 'recuar'], walk_left: ['walk left', 'left strafe', 'strafe left', 'left walk'], walk_right: ['walk right', 'right strafe', 'strafe right', 'right walk'],
  block_start: ['block start', 'guard start', 'block idle start'], block: ['block', 'guard', 'defend', 'defesa', 'blocking'], block_end: ['block end', 'guard end'],
  guard_impact: ['guard impact', 'block hit', 'block impact', 'guard hit'], blocked: ['blocked', 'recoil', 'bounce', 'rebote'],
  tackle: ['tackle', 'dash attack', 'charge', 'attack', 'investida'],
  meteor_prep: ['meteor prep', 'meteor_prep', 'meteor windup', 'slam prep', 'slam windup', 'preparacao meteor'], meteor_ground: ['meteor ground', 'meteor_ground', 'meteor impact', 'slam impact', 'slam ground'], meteor_dive: ['meteor dive', 'meteor_dive', 'meteor slam', 'slam dive', 'meteor', 'mergulho'],
  tackle_charge: ['tackle charge', 'tackle_charge', 'charge up', 'wind up', 'windup', 'power up'], tackle_pl2: ['tackle pl2', 'tackle_pl2', 'tackle 2', 'tackle medium', 'dash attack 2'],
  wall_splat: ['wall splat', 'wall_splat', 'pinned', 'wall hit', 'wall stick'],
  tackle_pl3: ['tackle pl3', 'tackle_pl3', 'tackle 3', 'tackle heavy', 'heavy tackle', 'tackle max'], brake: ['brake', 'skid', 'slide stop', 'brake slide', 'stop slide'], dodge_forward: ['dodge forward', 'dodge', 'front', 'roll forward', 'forward roll', 'esquiva'],
  dodge_back: ['dodge back', 'back', 'backstep', 'roll back'], dodge_left: ['dodge left', 'side', 'left', 'roll left'], dodge_right: ['dodge right', 'side', 'right', 'roll right'],
  jump: ['jump', 'vault', 'salto', 'pulo'], hit: ['hit', 'hurt', 'damage', 'impact', 'dano'], knockback: ['knockback', 'knock back', 'push', 'launched', 'fly', 'lancado'],
  fall: ['fall', 'falling', 'queda'], land: ['land', 'landing', 'aterrissar'], recover: ['recover', 'get up', 'getup', 'stand up', 'levantar'], downed: ['downed', 'down', 'caido'],
  death: ['death', 'die', 'dying', 'dead', 'ko', 'derrota'],
  move_1: ['move 1', 'golpe 1', 'special 1', 'skill 1'], move_2: ['move 2', 'golpe 2', 'special 2', 'skill 2'], move_3: ['move 3', 'golpe 3', 'special 3', 'skill 3'], move_4: ['move 4', 'golpe 4', 'special 4', 'skill 4'],
  reflect_charge: ['reflect charge', 'reflect_charge', 'barrier charge', 'shield charge', 'channel', 'cast start', 'cast_start'],
  reflect_release: ['reflect release', 'reflect_release', 'barrier release', 'barrier', 'cast release', 'cast_release', 'reflect'],
  psyshock_charge: ['psyshock charge', 'psyshock_charge', 'psychic charge', 'stone charge', 'channel', 'cast start', 'cast_start'],
  psyshock_release: ['psyshock release', 'psyshock_release', 'psychic release', 'psyshock', 'throw', 'cast release', 'cast_release'],
};
const MOVE_KEYS = ['move_1', 'move_2', 'move_3', 'move_4'];
const TIMED = new Set(['tackle', 'tackle_pl2', 'tackle_pl3', 'dodge_forward', 'dodge_back', 'dodge_left', 'dodge_right', 'vault', 'jump', 'recoil', 'guardStun', 'airborne', 'landing', 'recover', 'defeated', ...MOVE_KEYS]);
const TRANSIENT = new Set(['guard_enter', 'guard_exit', 'guard_hit']);
/** Tocam uma vez a partir da entrada e seguram a última pose (não repetem em laço). */
const ONE_SHOT = new Set(['meteor_prep', 'meteor_dive', 'meteor_ground', ...TRANSIENT, 'walk_stop', 'sprint_stop', '__preview', 'release_reflect', 'release_psyshock', ...MOVE_KEYS]);
const LOCOMOTION = new Set(['neutral', 'turn', 'walk', 'walk_back', 'walk_left', 'walk_right', 'run', 'run_back', 'run_left', 'run_right', 'sprint', 'sprint_back', 'sprint_left', 'sprint_right']);
const ACTION_KEYS = new Set(['meteor_prep', 'meteor_dive', 'meteor_ground', 'tackle', 'tackle_pl2', 'tackle_pl3', 'dodge_forward', 'dodge_back', 'dodge_left', 'dodge_right', 'vault', ...MOVE_KEYS]);
const COMBAT_KEYS = new Set(['wallSplat', 'airborne', 'landing', 'recover', 'guardStun', 'recoil', 'defeated', 'pushed', 'guard_hit']);

/** Recusa cedo (com motivo legível) o que não é GLB 2.0/glTF, antes de entregar ao carregador. */
async function readGltf(file) {
  const data = await file.arrayBuffer(), fmt = sniffFormat(data);
  if (!fmt.ok) throw Error(`Formato não suportado: ${fmt.text}.`);
  if (fmt.truncated) throw Error('Arquivo GLB truncado (tamanho declarado maior que o arquivo).');
  return {data, gltf: await new GLTFLoader().parseAsync(data, '')};
}
export async function loadStudioFile(file) {
  const {data, gltf} = await readGltf(file);
  let manifest = null;gltf.scene.traverse(o => {manifest ??= o.userData?.arenamonActions;});
  let meshes = 0;gltf.scene.traverse(o => {if (o.isMesh) meshes++;});
  if (!meshes) throw Error('O arquivo não contém malha.');
  if (!gltf.animations.length) throw Error('O arquivo não contém animações.');
  return {name: file.name, scene: gltf.scene, animations: gltf.animations, manifest, eventsByClip: gltf.animations.map(c => c.userData?.arenamon?.events || []), bytes: data};
}
/** Lê só as animações de um .glb (importação para a biblioteca). */
export async function loadAnimationFile(file) {
  const {data: bytes, gltf} = await readGltf(file);
  if (!gltf.animations.length) throw Error('O arquivo não contém animações.');
  return {name: file.name, animations: gltf.animations, scene: gltf.scene, bytes};
}

/** Nome de osso normalizado (sem prefixos de exportador como “mixamorig:”), para compatibilidade entre arquivos. */
export const boneKey = name => String(name).toLowerCase().replace(/^.*[:|]/, '').replace(/^mixamorig\d*/, '').replace(/^(armature|rig|skeleton)[_.]?/, '').replace(/[^a-z0-9]/g, '');
const hash = (...parts) => {let h = 2166136261;for (const ch of parts.join('|')) {h ^= ch.charCodeAt(0);h = Math.imul(h, 16777619);}return h >>> 0;};
const STORE = 'arenamon-lab-anim-v1:';

import {createSquashState, resetSquash, updateSquash} from './squash-stretch.js';

export class Character {
  constructor(source, {tint = null, slot = 0, persist = true} = {}) {
    this.source = source;this.slot = slot;this.persist = persist;
    this.root = clone(source.scene);this.mixer = new T.AnimationMixer(this.root);
    this.clips = source.animations.slice();this.clipInfo = this.clips.map(c => ({name: c.name, origin: 'glb', compatible: true, coverage: 1}));
    this.variants = autoVariants(source);this.speeds = {};this.playback = {};this.clipOffsets = {};this.visualOffset = 0;this.autoGround = true;
    this.moveAnims = {
      reflect: {chargeClip: null, chargeLoopStart: 0, chargeLoopEnd: null, releaseClip: null},
      psyshock: {chargeClip: null, chargeLoopStart: 0, chargeLoopEnd: null, releaseClip: null}
    };
    this.movePreview = null;
    this.autoAssignMoveAnims();
    this.current = null;this.layers = [];this.fade = 0;this.timer = 0;this.clock = 0;this.flightV0 = 0;this.wasFlying = false;this.lastFlight = -Infinity;
    this.transient = null;this.wasGuard = false;this.seenEvents = new WeakSet();this.statesSeen = new Set();this.preview = null;this.visualFreeze = 0;
    this.stableLoco = null;this.locoCandidate = null;this.locoCandidateAt = 0;this.prevAction = null;this.actionSerial = 0;this.log = [];this.transitions = 0;this.restartsAvoided = 0;
    this.groundCache = new Map();this.groundOffset = 0;
    this.root.traverse(o => {if (o.isMesh) {o.frustumCulled = false;o.castShadow = false;if (tint) {const mats = [].concat(o.material).map(m => {const c = m.clone();c.color?.lerp(new T.Color(tint), .35);return c;});o.material = Array.isArray(o.material) ? mats : mats[0];}}});
    this.root.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(this.root);this.restHeight = Math.max(1e-3, box.max.y - box.min.y);this.restMinY = box.min.y;
    this.hips = null;this.root.traverse(o => {if (!this.hips && o.isBone && /hip|pelvis|root/i.test(o.name)) this.hips = o;});
    if (!this.hips) this.root.traverse(o => {if (!this.hips && o.isBone) this.hips = o;});
    this.hipsRest = this.hips?.position.clone();
    this.bones = new Map();this.root.traverse(o => {if (o.isBone) this.bones.set(boneKey(o.name), o.name);});
    // O mixer mantém a raiz GLB; somente os wrappers recebem a deformação.
    this.model = this.root;
    this.root = new T.Group();this.deformation = new T.Group();this.presentation = new T.Group();
    this.root.add(this.deformation);this.deformation.add(this.presentation);this.presentation.add(this.model);
    this.model.position.set(0, 0, 0);this.model.rotation.set(0, 0, 0);this.model.scale.setScalar(1);
    this.squash = createSquashState();this.squashTick = -1;this.squashFighter = null;
    this.restore();
    this.warmGround();
  }
  // ---------- Associações (persistidas por nome de clipe neste navegador) ----------
  /** Compatibilidade com o v7: primeira variante de cada ação. */
  get mapping() {return Object.fromEntries(Object.entries(this.variants).filter(([, v]) => v.length).map(([id, v]) => [id, v[0]]));}
  autoAssignMoveAnims() {
    for (const moveId of ['reflect', 'psyshock']) {
      const conf = this.moveAnims[moveId] ??= {chargeClip: null, chargeLoopStart: 0, chargeLoopEnd: null, releaseClip: null};
      if (conf.chargeClip == null) {
        const kws = moveId === 'reflect' ? ALIASES.reflect_charge : ALIASES.psyshock_charge;
        conf.chargeClip = this.findClipByKeywords(kws);
      }
      if (conf.releaseClip == null) {
        const legacyIdx = this.variants[moveId === 'reflect' ? 'move_1' : 'move_2']?.[0];
        if (legacyIdx != null && this.clips[legacyIdx]) {
          conf.releaseClip = legacyIdx;
        } else {
          const kws = moveId === 'reflect' ? ALIASES.reflect_release : ALIASES.psyshock_release;
          conf.releaseClip = this.findClipByKeywords(kws);
        }
      }
    }
  }
  findClipByKeywords(keywords) {
    if (!keywords || !this.clips?.length) return null;
    for (const kw of keywords) {
      const lower = kw.toLowerCase();
      const idx = this.clips.findIndex(c => c.name.toLowerCase().includes(lower));
      if (idx >= 0 && (this.clipInfo?.[idx]?.compatible ?? true)) return idx;
    }
    return null;
  }
  getMoveAnimConfig(moveId) {
    this.moveAnims ??= {};
    if (!this.moveAnims[moveId]) {
      this.moveAnims[moveId] = {chargeClip: null, chargeLoopStart: 0, chargeLoopEnd: null, releaseClip: null};
    }
    return this.moveAnims[moveId];
  }
  setMoveAnim(moveId, type, clipIndex) {
    const conf = this.getMoveAnimConfig(moveId);
    const idx = clipIndex == null || clipIndex === '' ? null : Number(clipIndex);
    if (type === 'charge') {
      conf.chargeClip = idx;
    } else if (type === 'release') {
      conf.releaseClip = idx;
      const legacyKey = moveId === 'reflect' ? 'move_1' : 'move_2';
      if (idx != null) this.variants[legacyKey] = [idx];
      else delete this.variants[legacyKey];
    }
    this.resetVisual();
    this.save();
  }
  setMoveChargeLoopStart(moveId, seconds) {
    const conf = this.getMoveAnimConfig(moveId);
    const duration = this.clips[conf.chargeClip]?.duration || 1;
    const end = Math.min(duration, conf.chargeLoopEnd ?? duration);
    conf.chargeLoopStart = Math.min(Math.max(0, Number(seconds) || 0), Math.max(0, end - 0.02));
    this.save();
  }
  setMoveChargeLoopEnd(moveId, seconds) {
    const conf = this.getMoveAnimConfig(moveId);
    const duration = this.clips[conf.chargeClip]?.duration || 1;
    conf.chargeLoopEnd = Math.min(duration, Math.max(0.02, Number(seconds) || duration));
    conf.chargeLoopStart = Math.min(conf.chargeLoopStart || 0, Math.max(0, conf.chargeLoopEnd - 0.02));
    this.save();
  }
  startMovePreview(moveId, onEnd = null) {
    this.stopPreview();
    this.stopMovePreview();
    const conf = this.getMoveAnimConfig(moveId);
    const chargeIdx = conf.chargeClip ?? this.variantsOf('idle')[0] ?? 0;
    const releaseIdx = conf.releaseClip ?? this.variantsOf(moveId === 'reflect' ? 'move_1' : 'move_2')[0] ?? this.variantsOf('tackle')[0] ?? 0;
    this.movePreview = {
      moveId,
      phase: 'charge',
      chargeIdx,
      releaseIdx,
      started: this.clock,
      chargeDuration: 2.2,
      onEnd,
      serial: ++this.actionSerial
    };
    return true;
  }
  stopMovePreview() {
    if (this.movePreview?.onEnd) this.movePreview.onEnd();
    this.movePreview = null;
    this.resetVisual();
  }
  variantsOf(id) {
    if (id?.startsWith?.('charge_')) {
      const moveId = id.slice(7);
      const conf = this.moveAnims?.[moveId];
      if (conf?.chargeClip != null && this.clips[conf.chargeClip]) return [conf.chargeClip];
      return this.variantsOf('idle');
    }
    if (id?.startsWith?.('release_')) {
      const moveId = id.slice(8);
      const conf = this.moveAnims?.[moveId];
      if (conf?.releaseClip != null && this.clips[conf.releaseClip]) return [conf.releaseClip];
      const legacyKey = moveId === 'reflect' ? 'move_1' : 'move_2';
      const legList = this.variants[legacyKey];
      if (legList?.length) return legList;
      return this.variantsOf('tackle');
    }
    return (this.variants[id] || []).filter(i => this.clips[i] && this.clipInfo[i]?.compatible);
  }
  refreshVisual() {if (this.current) this.current.entry = '__mapping_changed__';}
  addVariant(id, index) {if (!this.clipInfo[index]?.compatible) return false;const list = this.variants[id] ??= [];if (!list.includes(index)) list.push(index);this.refreshVisual();this.save();return true;}
  removeVariant(id, index) {this.variants[id] = (this.variants[id] || []).filter(i => i !== index);if (!this.variants[id].length) delete this.variants[id];this.refreshVisual();this.save();}
  /** Troca a variante principal (posição 0) de um estado. */
  setPrimary(id, index) {if (index === null) {delete this.variants[id];} else {if (!this.clipInfo[index]?.compatible) return false;const extras = (this.variants[id] || []).slice(1).filter(i => i !== index);this.variants[id] = [index, ...extras];}this.refreshVisual();this.save();return true;}
  /**
   * Para e descarta todas as ações do mixer (atual e camadas). Antes, trocar uma associação só esquecia a ação atual,
   * que continuava tocando com peso 1 misturada a todas as outras (“forçando” uma pose).
   */
  resetVisual() {for (const l of [...this.layers, this.current].filter(Boolean)) {l.action.stop();this.mixer.uncacheAction(l.clip);}this.layers = [];this.current = null;this.stableLoco = null;}
  moveVariant(id, index, delta) {const l = this.variants[id] || [], i = l.indexOf(index), j = i + delta;if (i < 0 || j < 0 || j >= l.length) return;[l[i], l[j]] = [l[j], l[i]];this.refreshVisual();this.save();}
  storeKey() {return STORE + (this.source.name || 'sem-nome');}
  /** Associações, velocidades e offsets em formato portátil (clipes por nome). */
  stateData() {
    const byName = i => this.clips[i]?.name;
    const moveAnimsData = {};
    for (const [m, conf] of Object.entries(this.moveAnims || {})) {
      moveAnimsData[m] = {
        chargeClip: conf.chargeClip != null ? byName(conf.chargeClip) : null,
        chargeLoopStart: conf.chargeLoopStart || 0,
        chargeLoopEnd: conf.chargeLoopEnd ?? null,
        releaseClip: conf.releaseClip != null ? byName(conf.releaseClip) : null
      };
    }
    return {variants: Object.fromEntries(Object.entries(this.variants).map(([id, l]) => [id, l.map(byName).filter(Boolean)])), speeds: {...this.speeds}, playback: JSON.parse(JSON.stringify(this.playback)),
      clipOffsets: Object.fromEntries(Object.entries(this.clipOffsets).map(([i, v]) => [byName(i), v]).filter(([k]) => k)), visualOffset: this.visualOffset, autoGround: this.autoGround, moveAnims: moveAnimsData};
  }
  save() {
    if (!this.persist) return;
    const data = this.stateData();
    // Com workspace: estado por modelo (SHA-256 do GLB). Sem ele (testes, navegador sem armazenamento): por nome, como antes.
    if (Character.stateStore && this.source.assetId) {Character.stateStore.set(this, data);return;}
    try {localStorage.setItem(this.storeKey(), JSON.stringify(data));} catch {/* armazenamento indisponível: associações valem só nesta sessão */}
  }
  restore() {
    if (!this.persist) return;let data = null;
    if (Character.stateStore && this.source.assetId) data = Character.stateStore.get(this);
    else try {data = JSON.parse(localStorage.getItem(this.storeKey()) || 'null');} catch {data = null;}
    if (!data) return;
    const idx = name => this.clips.findIndex(c => c.name === name);
    this.missingAssociations = [];
    for (const [id, names] of Object.entries(data.variants || {})) {
      const list = names.map(n => {const i = idx(n);if (i < 0) this.missingAssociations.push(`${id}: ${n}`);return i;}).filter(i => i >= 0);
      if (list.length) this.variants[id] = list;else if (names.length === 0) delete this.variants[id];
    }
    Object.assign(this.speeds, data.speeds || {});Object.assign(this.playback, data.playback || {});
    for (const [n, v] of Object.entries(data.clipOffsets || {})) {const i = idx(n);if (i >= 0) this.clipOffsets[i] = v;}
    if (typeof data.visualOffset === 'number') this.visualOffset = data.visualOffset;if (typeof data.autoGround === 'boolean') this.autoGround = data.autoGround;
    if (data.moveAnims) {
      for (const [m, conf] of Object.entries(data.moveAnims)) {
        this.moveAnims[m] = {
          chargeClip: conf.chargeClip ? idx(conf.chargeClip) : null,
          chargeLoopStart: Number(conf.chargeLoopStart) || 0,
          chargeLoopEnd: Number.isFinite(Number(conf.chargeLoopEnd)) && conf.chargeLoopEnd != null ? Number(conf.chargeLoopEnd) : null,
          releaseClip: conf.releaseClip ? idx(conf.releaseClip) : null
        };
      }
    }
    this.autoAssignMoveAnims();
  }
  /** Importa clipes para a biblioteca, verificando os ossos referenciados. Devolve o relatório por clipe. */
  importClips(file) {
    const report = [];
    for (const clip of file.animations) {
      const c = clip.clone();let found = 0, total = 0;const renamed = [];
      c.tracks = c.tracks.filter(tr => {
        const dot = tr.name.lastIndexOf('.'), node = tr.name.slice(0, dot), prop = tr.name.slice(dot);total++;
        const target = this.root.getObjectByName(node) ? node : this.bones.get(boneKey(node));
        if (!target) return false;found++;if (target !== node) renamed.push(node);tr.name = target + prop;return true;
      });
      const coverage = total ? found / total : 0, compatible = coverage >= .6 && c.tracks.length > 0;
      let name = `${c.name || 'clip'} [${file.name}]`, n = 2;while (this.clips.some(x => x.name === name)) name = `${c.name} [${file.name}] (${n++})`;c.name = name;
      this.clips.push(c);this.clipInfo.push({name, origin: file.name, compatible, coverage, renamed: renamed.length});
      report.push({name, compatible, coverage, tracks: c.tracks.length, renamed: renamed.length});
    }
    this.restore();return report;
  }
  speedOf(id) {return (Character.options.speed || 1) * (this.speeds[id] ?? 1);}
  playbackOf(id, key = id) {const o = this.playback[id] || {};return {loop: o.loop ?? !(ONE_SHOT.has(key) || TIMED.has(key)), maxDuration: Math.max(0, Number(o.maxDuration) || 0)};}
  /** Ação associada a um estado (primeira da ordem de preferência com variantes). */
  actionFor(stateKey) {
    if (stateKey?.startsWith?.('charge_')) {
      const moveId = stateKey.slice(7);
      const conf = this.moveAnims?.[moveId];
      if (conf?.chargeClip != null && this.clips[conf.chargeClip]) return stateKey;
      return this.actionFor('idle') || 'idle';
    }
    if (stateKey?.startsWith?.('release_')) {
      if (this.variantsOf(stateKey).length) return stateKey;
      return this.actionFor('tackle') || 'tackle';
    }
    for (const id of STATE_ACTIONS[stateKey] || ['idle']) if (this.variantsOf(id).length) return id;
    return null;
  }
  /** Compatibilidade: primeira variante do estado. */
  clipFor(stateKey) {const id = this.actionFor(stateKey);return id ? {id, index: this.variantsOf(id)[0]} : null;}
  /** Sorteio determinístico da variante na entrada do estado (mesmo lutador, estado e passo → mesma escolha). */
  pickVariant(id, seed) {const list = this.variantsOf(id);if (list.length <= 1) return list[0];const [r] = mulberry(seed);return list[Math.floor(r * list.length)];}
  missingStates() {return Object.keys(STATE_ACTIONS).filter(k => k !== 'neutral' && !['meteor_prep', 'meteor_dive', 'meteor_ground', 'tackle_charge', 'tackle_pl2', 'tackle_pl3', 'brake', 'wallSplat'].includes(k) && !TRANSIENT.has(k) && !['walk_stop', 'sprint_stop'].includes(k) && (this.actionFor(k) ?? 'idle') === 'idle');}
  // ---------- Estado visual ----------
  stateKey(f) {
    if (f.hp <= 0 && !f.flight) return 'defeated';
    if (f.flight) {
      if (f.wallSplat) return 'wallSplat';
      if (f.flight.isNormalJump) return 'jump';
      return 'airborne';
    }
    if (f.state === 'landing' && f.recoveryFrom && this.current && ACTION_KEYS.has(this.current.key)) return this.current.key;
    if (f.state === 'landing' && f.recoveryFrom === 'tackle') return 'tackle';   // recuperação do tackle/mergulho: segura a pose do golpe, sem a animação de aterrissagem
    if (f.state === 'landing') {
      if (f.normalJumpLanding) return this.actionFor('land') ? 'landing' : 'neutral';
      return this.clock - this.lastFlight < 1.5 ? 'landing' : 'recover';
    }
    if (f.charge) {
      const moveId = f.charge.move || (f.charge.slot === 0 ? 'reflect' : 'psyshock');
      return 'charge_' + moveId;
    }
    if (f.state === 'brake') return 'brake';
    if (f.tackleCharge) return 'tackle_charge';
    if (f.action?.slam) return !f.action.slamPrepDone ? 'meteor_prep' : f.action.slamLanded ? 'meteor_ground' : 'meteor_dive';
    if (f.action?.kind === 'tackle') return f.action.pl === 3 ? 'tackle_pl3' : f.action.pl === 2 ? 'tackle_pl2' : 'tackle';
    if (f.action?.kind === 'move') return MOVE_KEYS[Math.max(0, Math.min(3, f.action.slot ?? 0))];
    if (f.action?.kind === 'dodge') {
      if (f.action.vault) return 'vault';
      // Direção da esquiva decidida na entrada e mantida até o fim (o corpo pode girar durante a esquiva).
      if (this.dodgeAction !== this.actionSerial) {const rel = angleDelta(f.facing, f.action.heading);this.dodgeAction = this.actionSerial;this.dodgeKey = Math.abs(rel) < Math.PI / 4 ? 'dodge_forward' : Math.abs(rel) > 3 * Math.PI / 4 ? 'dodge_back' : rel > 0 ? 'dodge_left' : 'dodge_right';}
      return this.dodgeKey;
    }
    if (f.action?.kind === 'recoil') return 'recoil';
    if (f.state === 'guardStun') return 'guardStun';
    if (f.guard) {this.guardSeenAt = this.clock;return 'guard';}
    if (this.current?.key === 'guard' && this.clock - (this.guardSeenAt ?? -Infinity) < Character.options.guardHold * .6 && !f.action) return 'guard';
    const speed = length(f.velocity), walk = f.attributes.speed;
    // Freios: só quando a física está realmente desacelerando (e só se houver animação própria; senão, locomoção normal).
    if (f.locoPhase === 'sprintStop' && speed > walk * .5 && this.actionFor('sprint_stop')) return 'sprint_stop';
    if ((f.locoPhase === 'brake' || f.locoPhase === 'reverse') && speed > walk * C.locomotion.stopThreshold && this.actionFor('walk_stop')) return 'walk_stop';
    if (this.current?.key === 'walk_stop' || this.current?.key === 'sprint_stop') {
      // Mantém o freio até a desaceleração acabar (evita trocar no meio da animação por oscilação da fase).
      if ((f.locoPhase === 'brake' || f.locoPhase === 'reverse' || f.locoPhase === 'sprintStop') && speed > .3) return this.current.key;
    }
    if (speed < .15) {
      const diff = Math.abs(angleDelta(f.visualFacing, f.facing));
      const turning = this.current?.key === 'turn';
      return diff > (turning ? .08 : .22) ? 'turn' : 'neutral';
    }
    const rel = angleDelta(f.faceGoal ?? f.facing, angleOf(f.velocity));
    const direction = Math.abs(rel) > 3 * Math.PI / 4 ? 'back' : Math.abs(rel) > Math.PI / 4 ? (rel > 0 ? 'left' : 'right') : '';
    if (f.sprinting) return direction ? `sprint_${direction}` : 'sprint';
    // Histerese andar/correr: sobe aos 62% da velocidade, desce aos 52%.
    const wasRun = this.stableLoco?.startsWith('run');const gait = speed > walk * (wasRun ? .52 : .62) ? 'run' : 'walk';return direction ? `${gait}_${direction}` : gait;
  }
  /** Histerese da locomoção: um estado de locomoção novo só vale depois de estável por locomotionHold segundos. */
  smoothLocomotion(key) {
    if (!LOCOMOTION.has(key)) {this.locoCandidate = null;this.stableLoco = null;return key;}
    if (this.stableLoco === null || !LOCOMOTION.has(this.current?.key)) {this.stableLoco = key;this.locoCandidate = key;this.locoCandidateAt = this.clock;return key;}
    if (this.locoCandidate !== key) {this.locoCandidate = key;this.locoCandidateAt = this.clock;}
    // Sair do repouso ou parar é imediato; a histerese vale só entre estados em movimento (andar, correr, laterais).
    if ((this.stableLoco === 'neutral' || this.stableLoco === 'turn') !== (key === 'neutral' || key === 'turn')) {this.stableLoco = key;return key;}
    if (key !== this.stableLoco && this.clock - this.locoCandidateAt >= Character.options.locomotionHold) this.stableLoco = key;
    return this.stableLoco;
  }
  /** Progresso 0..1 dos estados com duração definida pela simulação. */
  progress(f, key) {
    const R = C.rules;
    if (key === 'tackle' || key === 'tackle_pl2' || key === 'tackle_pl3') return f.action ? f.action.elapsed / actionDuration('tackle') : 1;
    if (MOVE_KEYS.includes(key)) {
      if (f.action?.kind === 'move') return f.action.elapsed / Math.max(1e-6, actionSpec(f.action).duration || .4);
      const d = this.current?.clip.duration || .4;
      return Math.min(1, Math.max(0, (this.clock - (this.current?.started ?? this.clock)) / Math.max(1e-4, d / this.speedOf(this.current?.id || key))));
    }
    // Pulo físico: o clipe de salto acompanha o tempo de voo balístico (2·impulso ÷ gravidade).
    if (key === 'jump' && f.flight) {
      const g = f.flight.gravity || C.rules.launchGravity;
      const initialVy = Math.sqrt(2 * g * (C.map?.jumpHeight ?? 2.0));
      return Math.min(1, Math.max(0, (initialVy - f.flight.vy) / Math.max(1e-4, 2 * initialVy)));
    }
    if (key === 'vault' && f.action?.jump) return f.action.elapsed / Math.max(.05, 2 * C.actions.dodge.vaultUp / Math.max(.1, C.actions.dodge.vaultGravity));
    if (key.startsWith('dodge') || key === 'vault') return f.action ? f.action.elapsed / (actionDuration('dodge') * (f.action.durationScale ?? 1)) : 1;
    if (key === 'recoil') return f.action ? f.action.elapsed / R.recoil : 1;
    if (key === 'guardStun') return 1 - f.stun / Math.max(1e-6, R.guardStun);
    if (key === 'landing') return 1 - f.knockRecovery / Math.max(1e-6, R.landingRecovery);
    if (key === 'recover') return 1 - f.knockRecovery / Math.max(1e-6, C.extras.combat.exhaustRecovery);
    if (key === 'airborne') return this.flightV0 > 0 ? Math.min(1, Math.max(0, (this.flightV0 - f.flight.vy) / (2 * this.flightV0))) : 0;
    if (key === 'defeated') return Math.min(1, this.timer / 1.2);
    return 0;
  }
  /** Transições curtas: entrar/sair da defesa, defesa perfeita e disparo de movimentos. */
  transients(f, events) {
    for (const e of events) if (!this.seenEvents.has(e)) {
      this.seenEvents.add(e);
      if (e.target === f.id && e.result === 'perfect') this.startTransient('guard_hit');
      if (e.attacker === f.id && (e.result === 'chargeRelease' || e.result === 'move') && e.slot != null) {
        const moveId = e.move || (e.slot === 0 ? 'reflect' : 'psyshock');
        this.startTransient('release_' + moveId);
      }
    }
    // Defesa ligada/desligada em poucos quadros (comum na IA) não reinicia entrar/sair da defesa:
    // entrada logo depois de uma saída (ou saída de uma defesa curta) segue direto, só com o fade.
    const hold = Character.options.guardHold;
    if (f.guard && !this.wasGuard && !f.action) {if (this.clock - (this.guardOffAt ?? -Infinity) >= hold) this.startTransient('guard_enter');else if (this.transient?.key === 'guard_exit') this.transient = null;this.guardOnAt = this.clock;}
    if (!f.guard && this.wasGuard && !f.action && f.state !== 'guardStun') {if (this.clock - (this.guardOnAt ?? -Infinity) >= hold) this.startTransient('guard_exit');else if (this.transient?.key === 'guard_enter') this.transient = null;this.guardOffAt = this.clock;}
    this.wasGuard = f.guard;
    if (this.transient && (f.action || (f.guard && !this.transient.key.startsWith('guard_')) || f.flight || f.state === 'guardStun' || f.state === 'landing' || f.hp <= 0 || this.clock >= this.transient.until)) this.transient = null;
  }
  startTransient(key) {
    const id = this.actionFor(key);if (!id || (id !== key && id !== STATE_ACTIONS[key]?.[0] && id !== 'tackle')) return;
    const variants = this.variantsOf(id);if (!variants?.length) return;
    const clipIdx = variants[0], clipDur = this.clips[clipIdx]?.duration || .4, speed = this.speedOf(id);
    this.transient = {key, until: this.clock + (clipDur / speed), serial: ++this.actionSerial};
  }
  // ---------- Prévia (só visual) ----------
  startPreview(index) {if (!Number.isInteger(index) || !this.clips[index]) return false;this.preview = {index, started: this.clock, serial: ++this.actionSerial};return true;}
  stopPreview() {this.preview = null;}
  /** Ação X/C nova? (o tempo da ação recomeça ou o tipo muda; robusto a replays que clonam o estado). */
  trackAction(f) {
    const a = f.action, p = this.prevAction;
    if (a && (!p || p.kind !== a.kind || a.elapsed < p.elapsed - 1e-9 || (a.fromCancel && !p.fromCancel))) this.actionSerial++;
    this.prevAction = a ? {kind: a.kind, elapsed: a.elapsed, fromCancel: !!a.fromCancel} : null;
    if (a && (a.kind === 'tackle' || a.kind === 'dodge')) this.lastActionSeen = {kind: a.kind, elapsed: a.elapsed};
  }
  /** Extrai e valida o contrato AnimationCombatWindows para a ação a partir dos eventos do clipe. */
  getCombatWindows(actionId) {
    const variants = this.variantsOf(actionId);
    if (!variants?.length) return null;
    const clipIdx = variants[0];
    const clip = this.clips[clipIdx];
    const rawEvents = this.source?.eventsByClip?.[clipIdx] || [];
    const clipDuration = extractClipDuration(clip);
    const actionDur = actionDuration(actionId === 'tackle' ? 'tackle' : 'dodge');
    return fromGlbEvents(rawEvents, {
      clipDurationSeconds: clipDuration,
      actionDurationSeconds: actionDur,
      actionId,
      clipName: clip?.name,
      characterId: this.source?.name || 'character'
    });
  }
  /** Extrai o mapa de janelas de combate para todas as ações suportadas do personagem. */
  getAllCombatWindows() {
    return {
      tackle: this.getCombatWindows('tackle'),
      dodge: this.getCombatWindows('dodge_forward')
    };
  }
  /**
   * Atualiza a pose. ctx: {tick, source: 'jogador'|'IA'} para o sorteio determinístico e a telemetria.
   * dt = 0 (pausa) mantém a pose.
   * SOMENTE VISUAL: nunca modifica o estado autoritativo do lutador.
   */
  update(f, dt, alt, events = [], ctx = {}) {
    if (this.squashFighter !== f || (ctx.tick != null && ctx.tick < this.squashTick)) resetSquash(this.squash);
    this.squashFighter = f;this.squashTick = ctx.tick ?? this.squashTick;
    const opt = Character.options;this.clock += dt;if (dt > 0) this.lastDt = dt;
    if (this.visualFreeze > 0) {this.visualFreeze = Math.max(0, this.visualFreeze - dt);dt = 0;}
    if (f.flight && !this.wasFlying) this.flightV0 = f.flight.vy + C.rules.launchGravity * C.test.step;
    if (f.flight) this.lastFlight = this.clock;this.wasFlying = !!f.flight;
    this.trackAction(f);this.transients(f, events);
    let p = this.preview;if (p && this.clock - p.started >= (this.clips[p.index]?.duration || 0) / Math.max(.05, opt.speed)) {this.preview = null;p = null;}
    let mp = this.movePreview;
    if (mp) {
      if (mp.phase === 'charge') {
        if (this.clock - mp.started >= mp.chargeDuration) {
          mp.phase = 'release';
          mp.started = this.clock;
          mp.serial = ++this.actionSerial;
        }
      } else if (mp.phase === 'release') {
        const relDur = (this.clips[mp.releaseIdx]?.duration || .6) / Math.max(.05, opt.speed);
        if (this.clock - mp.started >= relDur) {
          this.stopMovePreview();
          mp = null;
        }
      }
    }
    const raw = p ? '__preview' : mp ? (mp.phase === 'charge' ? 'charge_' + mp.moveId : 'release_' + mp.moveId) : this.transient?.key ?? this.stateKey(f);
    const key = (p || mp) ? raw : this.smoothLocomotion(raw);
    this.statesSeen.add(key);
    // Identidade da entrada: estado + número da ação/transição (X, C, transição curta ou prévia).
    const serial = p ? p.serial : mp ? mp.serial : this.transient ? this.transient.serial : ACTION_KEYS.has(key) ? this.actionSerial : 0;
    const entry = `${key}#${serial}`;
    if (!this.current || this.current.entry !== entry) {
      const id = p ? 'preview' : this.actionFor(key);
      if (id) {
        const index = p ? p.index : (mp ? (mp.phase === 'charge' ? mp.chargeIdx : mp.releaseIdx) : this.pickVariant(id, hash(this.slot, key, ctx.tick ?? Math.round(this.clock * 120), serial)));
        this.enter(key, id, index, entry, f, ctx);
      } else if (this.current) this.current.entry = entry;
      else {
        // Um modelo nunca deve cair na bind pose/T-pose por falta de associação. Na primeira exibição usa o
        // primeiro clipe compatível e continua nele até existir uma troca válida.
        const index = this.clipInfo.findIndex(info => info.compatible);
        if (index >= 0) this.enter(key, '__fallback', index, entry, f, ctx);
      }
    } else if (this.current.key !== key) this.current.key = key;
    this.blend(f, dt, key, p);
    this.place(f, alt, dt);
  }
  /** Entra num estado: a animação atual vira camada de fade e a nova começa do zero (registro na telemetria). */
  enter(key, id, index, entry, f, ctx) {
    const prev = this.current;
    if (prev && prev.index === index) {
      // Mesmo clipe servindo a outro estado (locomoção, ação renascida com outro serial, transição curta): continua de
      // onde está, sem reiniciar e sem criar camada — o tempo das ações temporais é imposto pela simulação em blend().
      prev.entry = entry;prev.key = key;prev.id = id;this.restartsAvoided++;return;
    }
    if (prev) {prev.fadeStart = this.clock;prev.fadeFrom = prev.weight;this.layers.push(prev);}
    // Sem clone: o mixer cacheia a ação por (clipe, raiz) e o tempo é por ação. Clonar copiava todos os keyframes de
    // todas as tracks a cada troca de estado e fazia o cache interno do mixer crescer sem limite (uma entrada por troca).
    const clip = this.clips[index], action = this.mixer.clipAction(clip);
    action.reset().play();action.paused = true;action.enabled = true;action.setEffectiveWeight(prev ? 0 : 1);
    this.current = {key, id, index, clip, action, entry, started: this.clock, weight: prev ? 0 : 1, fade: ACTION_KEYS.has(key) || COMBAT_KEYS.has(key) ? Character.options.actionFade : Character.options.fade};
    this.fade = 0;this.timer = 0;this.transitions++;
    // Telemetria da troca.
    const d = prev ? prev.clip.duration || 1 : 1, played = prev ? prev.action.time : 0, pct = prev ? Math.min(1, played / d) : 0;
    const source = key === '__preview' ? 'prévia' : COMBAT_KEYS.has(key) || f.flight ? 'combate' : ACTION_KEYS.has(key) || key === 'guard' || key === 'guard_enter' || LOCOMOTION.has(key) || key === 'sprint' ? (ctx.source || 'jogador') : 'sistema';
    // Fim de X/C: concluída se o último tempo visto + um quadro alcança a duração; senão foi cancelada (defesa, sprint…).
    const seen = this.lastActionSeen, natural = !!seen && seen.elapsed + (this.lastDt || 0) * 1.05 + C.test.step >= actionDuration(seen.kind) - 1e-6;
    const reason = key === '__preview' ? 'prévia manual' : COMBAT_KEYS.has(key) ? 'reação de combate' : prev && ACTION_KEYS.has(prev.key) && !ACTION_KEYS.has(key) && !f.action ? (natural ? 'ação concluída' : key === 'sprint' ? 'esquiva → sprint' : 'ação cancelada (defesa)')
      : f.action?.fromCancel && key === 'tackle' ? 'cancelamento C → X' : ACTION_KEYS.has(key) ? (prev?.key === key ? 'nova ação (mesmo estado)' : 'nova ação')
      : COMBAT_KEYS.has(key) ? 'reação de combate' : key === 'sprint' ? 'sprint' : key.endsWith('_stop') ? 'freio físico' : TRANSIENT.has(key) ? 'transição curta' : LOCOMOTION.has(key) ? 'locomoção' : key;
    // Fim natural de ação não conta como interrupção (a última amostra pode cair um quadro antes do fim).
    const interrupted = prev && (TIMED.has(prev.key) || ONE_SHOT.has(prev.key)) && pct < .95 && reason !== 'ação concluída';
    this.log.push({t: +this.clock.toFixed(3), tick: ctx.tick ?? null, from: prev?.key ?? null, to: key, clipFrom: prev ? this.clips[prev.index]?.name : null, clipTo: this.clips[index].name,
      variant: this.variantsOf(id).indexOf(index) + 1, variants: this.variantsOf(id).length, playedSeconds: +played.toFixed(3), playedPct: +(pct * 100).toFixed(1), reason, interrupted: !!interrupted, source});
    if (this.log.length > 400) this.log.shift();
  }
  /** Tempo das camadas e da animação atual; fade por peso. */
  blend(f, dt, key, p) {
    const fadeOf = layer => Math.max(.02, layer?.fade ?? Character.options.fade);
    let old = 0;
    for (const layer of this.layers) {
      const k = Math.max(0, Math.min(1, (this.clock - layer.fadeStart) / fadeOf(this.current)));layer.weight = layer.fadeFrom * (1 - k);
      if (layer.weight <= 1e-4) {layer.action.stop();layer.dead = true;continue;}
      const a = layer.action, d = layer.clip.duration || 1, s = this.speedOf(layer.id), playback = this.playbackOf(layer.id, layer.key), cap = Math.min(d, playback.maxDuration > 0 ? playback.maxDuration * s : d), next = a.time + dt * s;
      a.time = playback.loop ? next % Math.max(.001, cap) : Math.min(cap, next);
      a.setEffectiveWeight(layer.weight);old += layer.weight;
    }
    this.layers = this.layers.filter(l => !l.dead);
    this.fade += dt;this.timer += dt;
    if (this.current) {
      const a = this.current.action, d = this.current.clip.duration || 1, s = this.speedOf(this.current.id), playback = this.playbackOf(this.current.id, this.current.key), cap = Math.min(d, playback.maxDuration > 0 ? playback.maxDuration * s : d);
      this.current.weight = Math.max(0, 1 - Math.min(1, old));a.setEffectiveWeight(this.current.weight);
      if (p) {
        a.time = Math.min(cap, (this.clock - p.started) * Character.options.speed);
      } else if (this.current.key.startsWith('charge_')) {
        const moveId = this.current.key.slice(7);
        const conf = this.moveAnims?.[moveId];
        const loopEnd = Math.min(d, Math.max(0.02, conf?.chargeLoopEnd ?? d));
        const loopStart = Math.min(Math.max(0, conf?.chargeLoopStart ?? 0), Math.max(0, loopEnd - 0.02));
        const elapsed = (this.clock - this.current.started) * s;
        if (elapsed < loopEnd) {
          a.time = elapsed;
        } else {
          const loopLen = Math.max(0.02, loopEnd - loopStart);
          a.time = loopStart + ((elapsed - loopEnd) % loopLen);
        }
      } else if (ONE_SHOT.has(this.current.key) || this.current.key.startsWith('release_')) {
        const elapsed = (this.clock - this.current.started) * s;a.time = playback.loop ? elapsed % Math.max(.001, cap) : Math.min(cap, elapsed);
      } else if (TIMED.has(this.current.key)) {
        const timed = Math.max(0, this.progress(f, this.current.key)) * cap;a.time = playback.loop ? timed % Math.max(.001, cap) : Math.min(cap, timed);
      } else {
        const next = a.time + dt * s;a.time = playback.loop ? next % Math.max(.001, cap) : Math.min(cap, next);
      }
    }
    this.mixer.update(0);
    // Sem root motion: o deslocamento horizontal da raiz do GLB é descartado (a posição vem da física).
    if (this.hips && this.hipsRest) {this.hips.position.x = this.hipsRest.x;this.hips.position.z = this.hipsRest.z;}
  }
  /**
   * Curva do ponto mais baixo da malha ao longo do clipe (17 amostras, espaço da raiz sem escala), com cache.
   * Usada pelo apoio no chão: em cada instante, a pose daquele momento fica apoiada no solo.
   */
  groundCurve(index) {
    if (this.groundCache.has(index)) return this.groundCache.get(index);
    const probe = this.probe ??= (() => {const r = clone(this.source.scene);const m = [];r.traverse(o => {if (o.isSkinnedMesh) m.push(o);});return {root: r, mixer: new T.AnimationMixer(r), meshes: m};})();
    const N = 16, curve = new Float64Array(N + 1).fill(this.restMinY);
    if (probe.meshes.length) {
      const clip = this.clips[index], action = probe.mixer.clipAction(clip);action.play();const box = new T.Box3();
      for (let i = 0; i <= N; i++) {
        action.time = (clip.duration || 0) * i / N;probe.mixer.update(0);probe.root.updateMatrixWorld(true);let min = Infinity;
        for (const m of probe.meshes) {m.computeBoundingBox();box.copy(m.boundingBox).applyMatrix4(m.matrixWorld);min = Math.min(min, box.min.y);}
        if (Number.isFinite(min)) curve[i] = min;
      }
      action.stop();probe.mixer.uncacheAction(clip);
    }
    this.groundCache.set(index, curve);return curve;
  }
  /** Pré-calcula imediatamente as curvas de solo das ações de combate essenciais para evitar engasgos na partida. */
  warmEssentialGround() {
    const priority = [
      'idle', 'turn', 'walk', 'run', 'sprint', 'walk_back', 'walk_left', 'walk_right',
      'tackle', 'tackle_pl2', 'tackle_pl3', 'tackle_charge', 'brake',
      'block_start', 'block', 'guard_impact', 'blocked',
      'dodge_forward', 'dodge_back', 'dodge_left', 'dodge_right', 'jump',
      'hit', 'knockback', 'fall', 'land', 'recover'
    ];
    for (const act of priority) {
      const list = this.variants[act] || [];
      for (const idx of list) {
        if (!this.groundCache.has(idx) && this.clips[idx]) {
          this.groundCurve(idx);
        }
      }
    }
  }
  /** Pré-calcula as curvas de apoio em segundo plano (um clipe por vez), para a luta nunca pagar esse custo. */
  warmGround(delay = 60) {
    // Só os clipes associados a estados (os demais calculam na primeira vez que tocarem), em momentos ociosos do navegador.
    const queue = [...new Set(Object.values(this.variants).flat())].filter(i => !this.groundCache.has(i));
    const idle = typeof requestIdleCallback === 'function' ? fn => requestIdleCallback(fn, {timeout: Character.isLiveCombat ? 4000 : 1500}) : fn => setTimeout(fn, Character.isLiveCombat ? 350 : delay);
    const next = () => {
      if (this.disposed || !queue.length) return;
      // Se houver combate intenso em tempo real, espaça o processamento para não disputar o orçamento de 16ms
      const actualDelay = Character.isLiveCombat ? 300 : delay;
      this.groundCurve(queue.shift());
      this.warmTimer = setTimeout(() => idle(next), actualDelay);
    };
    this.warmTimer = setTimeout(() => idle(next), delay);
  }
  /** Ponto mais baixo do clipe no instante t (interpolado); clipGround(index) = mínimo do clipe inteiro. */
  groundAt(index, t) {const c = this.groundCurve(index), d = this.clips[index].duration || 1, x = Math.max(0, Math.min(1, t / d)) * (c.length - 1), i = Math.min(c.length - 2, Math.floor(x));return c[i] + (c[i + 1] - c[i]) * (x - i);}
  clipGround(index) {return Math.min(...this.groundCurve(index));}
  /**
   * Versão para o quadro: se a curva do clipe ainda não foi calculada, usa a pose de repouso e agenda o cálculo fora do
   * quadro (antes era síncrono e travava a luta por dezenas a centenas de ms na primeira vez que um clipe tocava;
   * medido pelo medidor de desempenho). A altura converge suavemente quando a curva fica pronta.
   */
  groundAtFrame(index, t) {
    if (this.groundCache.has(index)) return this.groundAt(index, t);
    this.groundPending ??= new Set();
    if (!this.groundPending.has(index)) {
      this.groundPending.add(index);
      const run = () => {if (this.disposed) return;this.groundCurve(index);this.groundPending.delete(index);};
      typeof requestIdleCallback === 'function' ? requestIdleCallback(run, {timeout: Character.isLiveCombat ? 2000 : 400}) : setTimeout(run, 0);
    }
    return this.restMinY;
  }
  /** Posição, escala e orientação. Altura visual independente da física: o colisor e a sombra não se movem. */
  place(f, alt, dt) {
    const opt = Character.options, scale = opt.fit ? C.extras.visual.bodyHeight / this.restHeight : 1;
    let ground = this.restMinY;
    if (this.autoGround && C.display.grounding.autoGround && this.current) {
      // Média ponderada pelos pesos das camadas: sem saltos de altura nas transições.
      let w = this.current.weight, acc = this.groundAtFrame(this.current.index, this.current.action.time) * w;
      for (const l of this.layers) {acc += this.groundAtFrame(l.index, l.action.time) * l.weight;w += l.weight;}
      ground = w > 0 ? acc / w : ground;
    }
    const manual = (this.current ? this.clipOffsets[this.current.index] ?? 0 : 0) + this.visualOffset + (C.display.grounding.visualOffset || 0);
    updateSquash(this.squash, f, dt, C.extras.visual.squashStretch, C.actions.tackle);
    const target = -ground * scale + manual;
    this.groundOffset += (target - this.groundOffset) * (dt > 0 ? 1 - Math.exp(-dt / .06) : 1);
    // Como antes de criar os wrappers, descarta transformações animadas da raiz de apresentação.
    this.model.position.set(0, 0, 0);this.model.rotation.set(0, 0, 0);this.model.scale.setScalar(1);
    this.root.scale.setScalar(scale);
    // Corrige somente o deslocamento causado pela deformação; mantém o amortecimento do apoio original.
    this.root.position.set(f.position.x, alt + this.groundOffset - ground * scale * (this.squash.transverse - 1), f.position.z);
    this.root.rotation.set(0, this.squash.heading, 0);
    this.deformation.scale.set(this.squash.transverse, this.squash.transverse, this.squash.z);
    this.presentation.rotation.set(0, f.visualFacing - this.squash.heading, 0);
  }
  /** Durações das regras derivadas dos clipes (primeira variante ÷ velocidade). Só ações com animação própria. */
  ruleDurations() {
    const out = {}, own = id => {const i = this.variantsOf(id)[0];return i != null ? this.clips[i].duration / this.speedOf(id) : null;};
    const set = (path, v, from) => {if (v && Number.isFinite(v)) out[path] = {value: Math.round(v * 1000) / 1000, from};};
    set('actions.tackle.duration', own('tackle'), 'tackle');set('actions.dodge.duration', own('dodge_forward'), 'dodge_forward');
    set('rules.recoil', own('blocked'), 'blocked');set('rules.guardStun', own('guard_impact'), 'guard_impact');
    set('rules.landingRecovery', own('land') ?? own('recover'), this.variantsOf('land').length ? 'land' : 'recover');
    // As janelas marcadas no Studio (hitbox, invulnerabilidade) servem só para comparação: nunca alteram as regras.
    return out;
  }
  dispose() {this.disposed = true;clearTimeout(this.warmTimer);this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model);this.root.removeFromParent();}
}
// fade: transição entre estados comuns; actionFade: entrada em X/C e reações de combate (curta, para prevalecer).
// fade, actionFade, locomotionHold e speed são os parâmetros oficiais C.display.animation (ajustador, presets, desfazer).
Character.options = {lockRoot: true, fit: true, syncRules: false, guardHold: .25};
Character.isLiveCombat = false;
for (const key of ['fade', 'actionFade', 'locomotionHold', 'speed']) Object.defineProperty(Character.options, key, {enumerable: true, get: () => C.display.animation[key], set: v => {C.display.animation[key] = v;}});
/** Armazenamento das associações por modelo (instalado pelo workspace): {get(character), set(character, data)}. */
Character.stateStore = null;

/** Variantes iniciais: manifesto do Studio; depois nomes exatos; depois palavras contidas no nome. */
export function autoVariants(source) {
  const map = autoMapping(source);return Object.fromEntries(Object.entries(map).map(([id, i]) => [id, [i]]));
}
export function autoMapping(source) {
  const map = {}, clips = source.animations, norm = s => ` ${s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\.fbx\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;
  for (const [id, ref] of Object.entries(source.manifest?.actions || {})) if (ref && clips[ref.clipIndex]?.name === ref.clipName) map[id] = ref.clipIndex;
  const names = clips.map(c => norm(c.name));
  for (const pass of ['exact', 'contains']) for (const id of ACTION_IDS) {
    if (map[id] != null) continue;
    for (const alias of ALIASES[id] || [id.replaceAll('_', ' ')]) {
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
  const i = character.variantsOf(actionId)[0];if (i == null) return null;
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
