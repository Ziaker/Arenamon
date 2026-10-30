// (config = defaults(): a base de calibração que o jogo REALMENTE usa, não os valores de fábrica)
// Harness da matriz de animações no RUNTIME (sem navegador): simulação real (Game) + Character real (stateKey → actionFor → enter → AnimationMixer)
// com UM clipe distinto por ação do Editor e por identidade de Move. Nada aqui chama stateKey() diretamente nem associa clipe genérico: o que
// vale é o que o Character TOCA durante o jogo (current.key/id/clip, tempo e peso do mixer) a cada passo, nos dois lutadores.
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const {syntheticRig} = await import('data:text/javascript,' + encodeURIComponent(readFileSync(new URL('../../studio/test/fixture.js', import.meta.url), 'utf8')));
import {Character, ACTION_IDS} from '../src/view/characters.js';
Character.prototype.warmGround = () => {};   // o pré-cálculo de apoio ao chão agenda timers longos e não faz parte da seleção/reprodução de animação
import {ANIMATION_GROUPS} from '../src/sim/animation-profile.js';
import {Game} from '../src/sim/game.js';
import {C, resetConfig, defaults} from '../src/sim/config.js';
import {vec} from '../src/sim/math.js';
import {emptyCommand} from '../src/sim/entity.js';
import {registerStandardMoves} from '../src/sim/moves/standard.js';
import {clearMoves, listMoves} from '../src/sim/moves.js';
import {clearEffects} from '../src/sim/move-effects.js';

export const cmd = (o = {}) => ({...emptyCommand(), ...o});
export const EDITOR_IDS = ANIMATION_GROUPS.flatMap(g => g[2]);

/** Clipe sintético com nome = identidade da ação (duração e amplitude próprias para o mixer ter o que reproduzir). */
function clip(name, duration, amp) {
  const times = [0, duration / 2, duration], q = a => new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), a * Math.PI / 180).toArray();
  return new T.AnimationClip(name, duration, [new T.QuaternionKeyframeTrack('mixamorigSpine.quaternion', times, [...q(0), ...q(amp), ...q(0)]),
    new T.VectorKeyframeTrack('mixamorigHips.position', times, [0, 100, 0, 3, 100 - amp / 5, 40, 0, 100, 0])]);
}

/** Ações configuráveis: as 65 entradas fixas do Editor + move_<id> de cada Move + charge_/release_ de cada Move (fases declaradas na apresentação). */
export function configurableActions() {
  const moves = listMoves(), out = EDITOR_IDS.map(id => {const m = /^(charge|release)_(.+)$/.exec(id);return m ? {id, kind: m[1], move: m[2]} : {id, kind: 'editor'};});
  for (const m of moves) out.push({id: `move_${m.id}`, kind: 'move', move: m.id});
  // charge_/release_: fases DECLARADAS só pelos Moves de carga (def.charge); os demais não declaram essas fases
  for (const m of moves.filter(x => x.charge)) for (const ph of ['charge', 'release']) {const id = `${ph}_${m.id}`;if (!out.some(a => a.id === id)) out.push({id, kind: ph, move: m.id});}
  return out;
}

/** Carrega um GLB importado de verdade (Wookada, Cogumelo…) como o laboratório faz (loadStudioFile): clipes, manifesto do Studio e eventos. */
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export async function loadRealSource(file, name) {
  const buf = readFileSync(file), data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), gltf = await new GLTFLoader().parseAsync(data, '');
  let manifest = null;gltf.scene.traverse(o => {manifest ??= o.userData?.arenamonActions;});
  return {name, scene: gltf.scene, animations: gltf.animations, manifest, eventsByClip: gltf.animations.map(c => c.userData?.arenamon?.events || [])};
}

/**
 * Configuração REAL do usuário: o workspace inicial (inicial/workspace-inicial.zip = o que o jogo importa na primeira abertura) guarda por modelo as associações de clipe,
 * velocidades, reprodução, escala e Moves (models[sha].state). Sem isto a matriz provaria só os padrões automáticos, não o que o jogador realmente tem configurado.
 */
import {unzipSync, strFromU8} from 'fflate';
export function loadWorkspaceStates() {
  const zip = unzipSync(new Uint8Array(readFileSync(fileURLToPath(new URL('../inicial/workspace-inicial.zip', import.meta.url))))), ws = JSON.parse(strFromU8(zip['workspace.json']));
  const byName = {};for (const [sha, m] of Object.entries(ws.models)) byName[m.name] = {sha, state: m.state};
  return {byName, anim: ws.animOptions, tuning: ws.tuning};
}
/** Carrega um GLB importado COM a configuração salva do workspace (assetId + stateStore), como o jogo faz ao abrir. */
export async function loadConfiguredSource(file, name) {
  const src = await loadRealSource(file, name), {byName} = loadWorkspaceStates(), saved = byName[name];
  if (saved) {src.assetId = saved.sha;(Character.stateStore ??= {get: c => stores[c.source.assetId] ? structuredClone(stores[c.source.assetId]) : null, set() {}});stores[saved.sha] = saved.state;}
  return src;
}
const stores = {};

export function setupRegistry() {
  resetConfig(defaults());clearMoves();clearEffects();registerStandardMoves();
  C.extras.toggles.enableEnemyAI = 0;
}

/** Cria um Character com todas as ações associadas a um clipe próprio (como o Editor faria) e a velocidade/recorte DISTINTOS por ação para provar a aplicação. */
export function makeCharacter(actions = configurableActions(), name = 'sintetico.glb', omit = []) {
  const {root} = syntheticRig(T);
  const animations = actions.map((a, i) => clip('act:' + a.id, .5 + (i % 7) * .13, 12 + (i % 9) * 4));
  const source = {name, scene: root, animations, manifest: null, eventsByClip: animations.map(() => [])};
  const ch = new Character(source, {persist: false});
  ch.variants = {};
  // charge_/release_ são configurados como o Editor faz: moveAnims[move].chargeClip/releaseClip (setMoveAnim); o resto, em variants
  ch.moveAnims = {};
  actions.forEach((a, i) => {
    if (a.kind === 'charge' || a.kind === 'release') {const conf = ch.moveAnims[a.move] ??= {chargeClip: null, chargeLoopStart: 0, chargeLoopEnd: null, releaseClip: null};if (!omit.includes(a.id)) conf[a.kind === 'charge' ? 'chargeClip' : 'releaseClip'] = i;return;}
    if (!omit.includes(a.id)) ch.variants[a.id] = [i];
  });
  ch.autoGround = false;
  ch.refreshVisual();
  return ch;
}

/** Uma partida com dois lutadores e dois Characters (um por lutador); `step` avança a simulação e anima os dois, registrando o que cada um TOCA. */
export function makeMatch({equip = [[], []], positions = [vec(0, -3), vec(0, 3)], tweak = null, omit = [], cfg = null, sources = null} = {}) {
  setupRegistry();cfg?.();
  const g = new Game({seed: 3});g.start();g.reset({positions});
  g.mapState.platforms = [];g.mapState.obstacles = [];g.mapState.destructibles = [];g.mapState.items = [];g.mapState.regularSpawnTimer = 1e9;
  g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
  equip.forEach((ids, i) => {if (ids.length) g.setLoadout(i, ids);});
  const actions = configurableActions(), chars = sources ? sources.map(src => new Character(src, {persist: !!src.assetId})) : [makeCharacter(actions, 'azul.glb', omit), makeCharacter(actions, 'vermelho.glb', omit)];
  for (const ch of chars) ch.autoGround = false;
  const rec = {frames: [], reached: new Map()};
  const m = {g, chars, rec, actions, scenario: 'cenario',
    step(a = cmd(), b = cmd()) {
      g.step(a, b);
      for (let i = 0; i < 2; i++) {
        const f = g.fighters[i], ch = chars[i], alt = (f.flight?.y ?? f.groundY ?? 0) + (f.vaultHeight ?? 0);
        ch.update(f, C.test.step, alt, g.lastStepEvents, {tick: g.tick, source: i ? 'IA' : 'jogador', fighters: g.fighters});
        const cur = ch.current;
        if (!cur) continue;
        const act = cur.action, snap = {tick: g.tick, who: i, key: cur.key, id: cur.id, clip: cur.clip?.name, time: act.time, weight: act.getEffectiveWeight(), running: act.isRunning(), duration: cur.clip?.duration, state: f.state};
        const k = `${i}:${cur.id}`;   // por lutador: o Wookada e o Cogumelo têm clipes diferentes
        let r = rec.reached.get(k);if (!r) {r = {id: cur.id, firstTick: g.tick, scenario: m.scenario, who: i, key: cur.key, frames: 0, clip: snap.clip, minTime: Infinity, maxTime: -Infinity, maxWeight: 0, keys: new Set(), clips: new Set()};rec.reached.set(k, r);}
        r.clips.add(snap.clip);
        r.frames++;r.keys.add(cur.key);r.minTime = Math.min(r.minTime, act.time);r.maxTime = Math.max(r.maxTime, act.time);r.maxWeight = Math.max(r.maxWeight, snap.weight);
        rec.frames.push(snap);
      }
    },
    run(n, a = () => cmd(), b = () => cmd()) {for (let i = 0; i < n; i++) m.step(a(i), b(i));},
  };
  tweak?.(m);
  return m;
}
export {Game, C, vec, listMoves, ACTION_IDS};
