// Comparação A × B. Estende o comparador da V3 (mesmo botão, mesmo seletor de tipo e mesma divisão de
// tela) com dois tipos novos:
//   'clips'    — animação A (seleção principal) × animação B (qualquer clip da biblioteca)
//   'original' — clip atual editado × sua fonte original preservada
// B é reproduzida em uma cópia do personagem (SkeletonUtils.clone) com mixer próprio; a cópia não entra
// na exportação nem nos cálculos de enquadramento, e só fica visível durante a renderização comparativa.
import * as T from 'three';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';

export function createCompare({engine, store}) {
  const $ = id => document.getElementById(id);
  const s = {ghost: null, mixer: null, uuidMap: new Map(), cache: new WeakMap(), clipB: null, action: null, playing: true, speed: 1, layout: 'side', sync: 'time', overlay: new Map(), originalClips: new WeakMap(), rootNode: null};
  const TYPES = {clips: ['Animação A', 'Animação B'], original: ['Editada (atual)', 'Original importada']};

  function dispose() {
    if (s.ghost) {s.mixer?.stopAllAction();s.ghost.removeFromParent();s.ghost.traverse(o => {if (o.isSkinnedMesh) o.skeleton.dispose?.();});}
    for (const m of s.overlay.values()) [].concat(m).forEach(x => x.dispose());
    s.ghost = null;s.mixer = null;s.uuidMap = new Map();s.cache = new WeakMap();s.overlay = new Map();s.action = null;
  }
  function build() {
    dispose();const model = engine.model;if (!model) return;
    s.ghost = cloneSkinned(model);s.ghost.name = 'Comparação · animação B (preview)';s.ghost.visible = false;
    const a = [], b = [];model.traverse(o => a.push(o));s.ghost.traverse(o => b.push(o));a.forEach((o, i) => s.uuidMap.set(o.uuid, b[i]));
    engine.scene.add(s.ghost);s.mixer = new T.AnimationMixer(s.ghost);
  }
  // Clip remapeado para os nós da cópia; refeito quando os tracks do clip mudam (edições).
  function ghostClip(clip) {
    const hit = s.cache.get(clip);if (hit && hit.tracks === clip.tracks[0] && hit.count === clip.tracks.length && hit.duration === clip.duration) return hit.clip;
    const tracks = clip.tracks.map(t => {const dot = t.name.indexOf('.'), node = s.uuidMap.get(t.name.slice(0, dot));const c = t.clone();if (node) c.name = node.uuid + t.name.slice(dot);return c;});
    const result = new T.AnimationClip(clip.name + ' (B)', clip.duration, tracks);
    if (hit) s.mixer.uncacheClip(hit.clip);
    s.cache.set(clip, {clip: result, tracks: clip.tracks[0], count: clip.tracks.length, duration: clip.duration});return result;
  }
  function sourceClip(clip) {
    const src = store.source(clip);if (!src) return null;
    let entry = s.originalClips.get(clip);
    if (!entry || entry.tracks !== src.tracks[0]) {entry = {tracks: src.tracks[0], clip: new T.AnimationClip(src.name + ' · original', src.duration, src.tracks.slice())};s.originalClips.set(clip, entry);}
    return entry.clip;
  }
  function bClip(type) {
    if (type === 'original') return engine.selectedClip ? sourceClip(engine.selectedClip) : null;
    return engine.clips[Number($('ed-cmp-b').value)] || null;
  }
  function ensureAction(type) {
    if (!s.ghost) build();if (!s.ghost) return null;
    const clip = bClip(type);if (!clip) return null;const g = ghostClip(clip);
    if (!s.action || s.action.getClip() !== g) {s.mixer.stopAllAction();s.action = s.mixer.clipAction(g);s.action.play();s.clipB = clip;}
    s.action.setLoop($('lab-loop')?.checked === false ? T.LoopOnce : T.LoopRepeat, Infinity);s.action.clampWhenFinished = true;
    return s.action;
  }
  function syncTime(type, dt) {
    const action = ensureAction(type);if (!action) return;const a = engine.selectedAction, dA = engine.selectedClip?.duration || 0, dB = action.getClip().duration || 0;
    if (type === 'original' || s.sync !== 'free') {
      const tA = a?.time || 0;let t = s.sync === 'phase' && type !== 'original' && dA > 0 ? tA / dA * dB : tA;
      if (t > dB) t = $('lab-loop')?.checked === false ? dB : t % Math.max(dB, 1e-6);
      action.time = t;s.mixer.update(0);
    } else {
      action.timeScale = s.speed;s.mixer.update(s.playing ? dt : 0);
    }
    lockRoot();
  }
  // Mesma prévia de root motion da V3 aplicada à cópia (travar deslocamento horizontal da raiz).
  function lockRoot() {
    const mode = window.__studioV3?.rootMode, info = window.__studioV3?.rootState?.();if (!info?.track || mode === 'original') return;
    const node = s.uuidMap.get(info.track.node.uuid);if (!node) return;const t = info.track.track;
    // Valor inicial do track equivalente na animação B (pode diferir da A).
    const bTrack = s.action?.getClip().tracks.find(x => x.name === node.uuid + '.position');const v = bTrack?.values || t.values;
    node.position.x = v[0];node.position.z = v[2];if (mode === 'fixed') node.position.y = v[1];
  }
  function overlayMaterials() {
    s.ghost.traverse(o => {
      if (!o.isMesh) return;
      if (!s.overlay.has(o)) s.overlay.set(o, [].concat(o.material).map(() => new T.MeshBasicMaterial({color: '#ff9e6b', transparent: true, opacity: .42, depthWrite: false})));
    });
  }
  function render(dt) {
    const type = window.__studioV3.compareType, renderer = engine.renderer, scene = engine.scene, camera = engine.camera, model = engine.model;
    if (!model) return false;syncTime(type, dt);if (!s.ghost) return false;
    const size = renderer.getDrawingBufferSize(new T.Vector2()), W = Math.max(1, Math.round(size.x)), H = Math.max(1, Math.round(size.y));
    const oldAspect = camera.aspect;
    try {
      if (s.layout === 'overlay' && type === 'clips' || type === 'original' && s.layout === 'overlay') {
        overlayMaterials();const saved = new Map();s.ghost.traverse(o => {if (o.isMesh) {saved.set(o, o.material);const m = s.overlay.get(o);o.material = Array.isArray(o.material) ? m : m[0];o.renderOrder = 10;}});
        s.ghost.visible = true;renderer.setViewport(0, 0, W, H);renderer.render(scene, camera);
        for (const [o, m] of saved) o.material = m;
      } else {
        const half = Math.floor(W / 2);renderer.setScissorTest(true);
        const pass = (left, showA) => {const x = left ? 0 : half, w = left ? half : W - half;renderer.setViewport(x, 0, w, H);renderer.setScissor(x, 0, w, H);camera.aspect = w / H;camera.updateProjectionMatrix();model.visible = showA;s.ghost.visible = !showA;renderer.render(scene, camera);};
        pass(true, true);pass(false, false);
      }
    } finally {
      s.ghost.visible = false;model.visible = true;renderer.setScissorTest(false);renderer.setViewport(0, 0, W, H);camera.aspect = oldAspect;camera.updateProjectionMatrix();
    }
    return true;
  }
  function refreshOptions() {
    const select = $('ed-cmp-b');if (!select) return;const value = select.value;
    select.replaceChildren(...engine.clips.map((c, i) => new Option(c.name, String(i))));
    select.value = engine.clips[Number(value)] ? value : String(Math.min(1, engine.clips.length - 1));
  }
  engine.on('modelInstalled', () => {dispose();});
  engine.on('clipsChanged', refreshOptions);engine.on('clipEdited', refreshOptions);
  return {
    handles: type => type === 'clips' || type === 'original',
    labels: type => TYPES[type] || null,
    render, refreshOptions, dispose,
    set layout(v) {s.layout = v;}, set sync(v) {s.sync = v;}, set speed(v) {s.speed = v;},
    get playing() {return s.playing;}, set playing(v) {s.playing = !!v;},
    get timeB() {return s.action?.time || 0;}, get clipB() {return s.clipB;},
    restartB() {if (s.action) {s.action.reset().play();}},
  };
}
