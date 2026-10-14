// Núcleo do Arenamon Animation Studio.
// Fonte legível reconstruída a partir do importador (prototypes/importer/src/main.js) e das
// alterações aplicadas manualmente no bundle do HTML v6 (pintura global, sourceFile, ganchos V3).
// A Fase 1 acrescenta uma API de edição (addClip/removeClip/clipChanged/seek/setPlaying/on).
import * as T from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {createActionEditor} from './actions.js';

const $ = id => document.getElementById(id), scene = new T.Scene(), view = $('view');
scene.background = new T.Color('#19212c');
const camera = new T.PerspectiveCamera(40, 1, .001, 100000), renderer = new T.WebGLRenderer({antialias: true});
renderer.toneMapping = T.NoToneMapping;renderer.shadowMap.enabled = false;view.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement), lights = new T.Group();
lights.add(new T.HemisphereLight(0xffffff, 0x566477, 2));const key = new T.DirectionalLight(0xffffff, 2);key.position.set(3, 5, 4);lights.add(key);
let model, mixer, clips = [], playing = true, originals = new Map(), rest = new Map(), materialIds = new Map(), busy = false;
const palette = ['#829bb8', '#bc987d', '#819f91', '#9b8ead', '#b6ad7e', '#829fa9'];
const listeners = {clipsChanged: new Set(), clipEdited: new Set(), modelInstalled: new Set(), installed: new Set(), selected: new Set(), tick: new Set(), playing: new Set(), dirty: new Set(), rigChanged: new Set()};
const emit = (name, ...args) => {for (const fn of listeners[name]) fn(...args);};
function status(message) {$('status').textContent = message;}
const actionEditor = createActionEditor({
  getClips: () => clips, onRename: () => {updateClips();emit('dirty', 'renomear animação');}, onChange: reason => emit('dirty', reason), status,
  extra: () => ({
    organization: window.__arenamonOrganization?.manifest() || null,
    preview: window.__studioV3?.serialize?.() || null,
    animationEditor: window.__studioEditor?.manifest?.() || null,
  }),
});
const MAPS = ['map', 'alphaMap', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'displacementMap'];
function solid(source, unlit, noTextures) {
  const global = $('palette').value === 'global';
  const color = global ? new T.Color($('color').value) : noTextures ? new T.Color(palette[materialIds.get(source) % palette.length]) : source.color?.clone() || new T.Color('white');
  const material = unlit ? new T.MeshBasicMaterial({color}) : (!noTextures && source.isMeshStandardMaterial ? source.clone() : new T.MeshStandardMaterial({color, roughness: 1, metalness: 0}));
  material.side = source.side;material.name = global ? 'Arenamon Global Paint' : 'Arenamon Material';
  if (!noTextures && !global) {
    for (const p of MAPS) if (p in material && p in source) material[p] = source[p] || null;
    material.opacity = source.opacity;material.transparent = source.transparent;material.alphaTest = source.alphaTest;material.vertexColors = !!source.vertexColors;
    if (material.envMap) material.envMap = null;
  }
  if (global) {
    // A pintura global substitui os mapas de cor para aplicar uma tonalidade uniforme, mesmo com Texturas ON.
    for (const p of [...MAPS, 'lightMap']) if (p in material) material[p] = null;
    material.color.set($('color').value);material.vertexColors = false;material.opacity = 1;material.transparent = false;material.alphaTest = 0;
    if (material.emissive) material.emissive.set(0);
  }
  return material;
}
function materials(root, unlit, noTextures) {root.traverse(o => {if (!o.isMesh) return;const src = originals.get(o.uuid) || o.material;o.material = Array.isArray(src) ? src.map(m => solid(m, unlit, noTextures)) : solid(src, unlit, noTextures);o.castShadow = false;o.receiveShadow = false;});}
function disposePreview() {if (model) model.traverse(o => {if (o.isMesh && o.material !== originals.get(o.uuid)) {for (const m of [].concat(o.material)) m.dispose();}});}
function refresh() {if (!model) return;disposePreview();materials(model, !$('lighting').checked, !$('textures').checked);if ($('lighting').checked) scene.add(lights);else lights.removeFromParent();scene.environment = null;renderer.toneMapping = T.NoToneMapping;}
async function parse(file) {
  const manager = new T.LoadingManager();manager.setURLModifier(url => {if (/^(blob:|data:)/.test(url)) return url;return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';});
  const data = await file.arrayBuffer();if (/\.fbx$/i.test(file.name)) {const root = new FBXLoader(manager).parse(data, '');return {scene: root, animations: root.animations};}
  if (!/\.glb$/i.test(file.name)) throw Error('Use FBX ou GLB.');return new GLTFLoader(manager).parseAsync(data, '');
}
const selectedIndex = () => Number($('clip').value) || 0;
function currentAction() {const clip = clips[selectedIndex()];return clip && mixer ? mixer.clipAction(clip) : null;}
function selectClip() {mixer?.stopAllAction();if (clips[selectedIndex()]) mixer.clipAction(clips[selectedIndex()]).reset().play();actionEditor.selected();emit('selected', selectedIndex());}
function updateClips() {const selected = $('clip').value;$('clip').replaceChildren(...clips.map((c, i) => new Option(c.name || `Animação ${i + 1}`, String(i))));$('clip').value = selected || '0';if (!$('clip').value && clips.length) $('clip').value = '0';selectClip();window.__arenamonOrganization?.refresh();emit('clipsChanged');}
function frameModel() {
  if (!model) return;
  model.updateMatrixWorld(true);
  model.traverse(o => {if (o.isSkinnedMesh) {o.skeleton.update();o.computeBoundingBox();o.computeBoundingSphere();}});
  const box = new T.Box3().setFromObject(model), center = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3());
  if (box.isEmpty() || !Number.isFinite(size.length())) throw Error('Não foi possível enquadrar a malha deste arquivo.');
  const radius = Math.max(size.length() / 2, .001), angle = Math.atan(Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * Math.min(camera.aspect, 1)), distance = radius / Math.sin(angle) * 1.15;
  controls.target.copy(center);camera.position.copy(center).add(new T.Vector3(.7, .4, 1.2).normalize().multiplyScalar(distance));
  camera.near = Math.max(radius / 1000, .00001);camera.far = distance + radius * 100;camera.updateProjectionMatrix();controls.update();
}
// Nomes genéricos (Mixamo “mixamo.com”, “Take 001”, “animation_0”…) são trocados pelo nome do arquivo; nomes reais são mantidos.
const GENERIC = /^(mixamo\.com|take[ _]?\d*|animation([ _]?\d+)?|clip([ _]?\d+)?|default|anim|armature\|.*|)$/i;
function clipName(clip, sourceFile, index, total) {if (!sourceFile || !GENERIC.test(clip.name.trim())) return clip.name;return total === 1 ? sourceFile : sourceFile + ' · ' + (index + 1);}
function findManifest(root) {let saved = root.userData?.arenamonActions;root.traverse(node => {saved ??= node.userData?.arenamonActions;});return saved;}
async function install(root, animations, sourceFile) {
  const savedManifest = findManifest(root);
  let meshCount = 0;root.traverse(o => {if (o.isMesh && o.geometry.attributes.position?.count) meshCount++;});
  if (!meshCount) throw Error('Este arquivo não contém malha. Importe primeiro o personagem com “With Skin”; use “Anexar animações” para arquivos “Without Skin”.');
  status('Preparando o preview…');$('export').disabled = true;$('frame').disabled = true;
  mixer?.stopAllAction();disposePreview();if (model) {model.removeFromParent();const resources = new Set();model.traverse(o => {if (o.isMesh) {resources.add(o.geometry);for (const m of [].concat(originals.get(o.uuid))) {resources.add(m);for (const v of Object.values(m)) if (v?.isTexture) resources.add(v);}}});resources.forEach(r => r.dispose());}
  model = root;
  const nodes = nodeIndex(root);
  clips = animations.map((clip, index) => {
    const c = clip.clone();c.tracks = c.tracks.map(track => bindTrack(track, nodes, false));
    if (savedManifest?.clips?.[index]) {c.name = savedManifest.clips[index].clipName || c.name;c.sourceFile = savedManifest.clips[index].sourceFile || sourceFile || c.name;}
    else {c.sourceFile = sourceFile || '';c.name = clipName(clip, sourceFile, index, animations.length);}
    return c;
  });
  originals = new Map();rest = new Map();materialIds = new Map();const remove = [];
  root.traverse(o => {if (o.isLight) {remove.push(o);return;}rest.set(o.uuid, {position: o.position.clone(), quaternion: o.quaternion.clone(), scale: o.scale.clone(), matrix: o.matrix.clone()});if (o.isMesh) {originals.set(o.uuid, o.material);for (const m of [].concat(o.material)) if (!materialIds.has(m)) materialIds.set(m, materialIds.size);}});remove.forEach(o => o.removeFromParent());
  actionEditor.reset(savedManifest);window.__arenamonOrganization?.restore(savedManifest);scene.add(root);mixer = new T.AnimationMixer(root);refresh();root.updateMatrixWorld(true);
  emit('modelInstalled', savedManifest || null);
  updateClips();mixer.update(0);frameModel();
  window.__studioV3?.onModelInstalled?.(savedManifest?.preview || null);
  await renderer.compileAsync(scene, camera);
  await new Promise(resolve => requestAnimationFrame(() => {renderer.render(scene, camera);requestAnimationFrame(resolve);}));
  $('export').disabled = false;$('frame').disabled = false;setPlaying(playing);
  status(`Modelo carregado. ${clips.length} animações. Texturas externas não são carregadas; use GLB com recursos embutidos.`);
  emit('installed', savedManifest || null, sourceFile);
}
function normalize(name) {return name.replace(/^mixamorig[:_]?/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();}
function nodeIndex(root) {const nodes = new Map();root.traverse(o => {const name = normalize(o.name);if (!nodes.has(name)) nodes.set(name, []);nodes.get(name).push(o);});return nodes;}
// Liga o track ao nó por uuid (inclui a variação de prefixo mixamorig). Com strict, um alvo desconhecido rejeita o arquivo.
function bindTrack(track, nodes, strict) {
  const binding = T.PropertyBinding.parseTrackName(track.name), name = binding.objectName === 'bones' ? binding.objectIndex : binding.nodeName;
  let target = T.PropertyBinding.findNode(model, name);if (!target) {const matches = nodes.get(normalize(name || ''));if (matches?.length === 1) target = matches[0];}
  if (!target) {if (strict) throw Error(`Rig incompatível: não foi possível associar ${name}. Nenhuma animação deste arquivo foi anexada.`);return track;}
  const copy = track.clone();copy.name = target.uuid + '.' + binding.propertyName + (binding.propertyIndex !== undefined ? '[' + binding.propertyIndex + ']' : '');return copy;
}
function append(animations, sourceFile) {
  if (!model) throw Error('Importe o modelo primeiro.');const nodes = nodeIndex(model);
  const additions = animations.map(clip => {const result = clip.clone();result.tracks = result.tracks.map(track => bindTrack(track, nodes, true));return result;});
  additions.forEach((clip, index) => {if (sourceFile) {clip.name = clipName(clip, sourceFile, index, animations.length);clip.sourceFile = sourceFile;}});
  clips.push(...additions);actionEditor.uniqueNames();updateClips();$('clip').value = String(clips.length - additions.length);selectClip();actionEditor.refresh();
  window.__arenamonOrganization?.refresh();window.__studioV3?.onClipsChanged?.();emit('clipsChanged');emit('dirty', 'animações adicionadas');return additions.length;
}

// ---------- Rigging: API do motor para preservar exportação e materiais ----------
function enterRigRest() {
  if (!model) return;
  setPlaying(false);mixer?.stopAllAction();
  model.traverse(o => {
    if (!o.isBone) return;
    const r=rest.get(o.uuid);if (!r) return;
    o.position.copy(r.position);o.quaternion.copy(r.quaternion);o.scale.copy(r.scale);
    o.updateMatrix();
  });
  model.updateMatrixWorld(true);
  emit('rigChanged', 'rest');
}
function commitRig({replacements=[],reason='posicionamento dos ossos',emitDirty=true}={}) {
  if(!model)return;
  // A malha previamente exibida usa material temporário de visualização.
  for(const pair of replacements) {
    const material=originals.get(pair.old.uuid)||pair.old.material;
    originals.delete(pair.old.uuid);rest.delete(pair.old.uuid);
    originals.set(pair.mesh.uuid,material);
    for(const m of [].concat(material||[])) if(!materialIds.has(m))materialIds.set(m,materialIds.size);
  }
  model.updateMatrixWorld(true);
  const unique = new Set();
  model.traverse(o => {
    if(o.isBone || o.isSkinnedMesh || replacements.some(p=>p.mesh===o)) {
      o.updateMatrix();rest.set(o.uuid,{position:o.position.clone(),quaternion:o.quaternion.clone(),
        scale:o.scale.clone(),matrix:o.matrix.clone()});
    }
    if(o.isSkinnedMesh && o.skeleton && !unique.has(o.skeleton)){
      unique.add(o.skeleton);o.skeleton.calculateInverses();o.skeleton.update();
    }
  });
  refresh();model.updateMatrixWorld(true);
  window.__studioV4?.onSceneLoaded?.();emit('rigChanged',reason);
  if(emitDirty)emit('dirty',reason);
}

// ---- API de edição (Fase 1) ----
function uniqueName(base) {const used = new Set(clips.map(c => c.name.toLowerCase()));let name = base, n = 2;while (used.has(name.toLowerCase())) name = `${base} (${n++})`;return name;}
function addClip(clip, {select = true} = {}) {
  clip.name = uniqueName(clip.name || 'Animação');clips.push(clip);
  const previous = $('clip').value;updateClips();$('clip').value = select ? String(clips.length - 1) : previous;selectClip();actionEditor.refresh();
  window.__arenamonOrganization?.refresh();window.__studioV3?.onClipsChanged?.();emit('clipsChanged');return clips.length - 1;
}
function removeClip(clip) {
  const index = clips.indexOf(clip);if (index < 0) return -1;
  mixer?.uncacheClip(clip);const selected = selectedIndex();clips.splice(index, 1);
  window.__arenamonOrganization?.onClipRemoved?.(index);window.__studioV4?.onClipRemoved?.(index);
  const next = selected > index ? selected - 1 : selected === index ? Math.max(0, index - 1) : selected;
  updateClips();$('clip').value = String(Math.min(next, Math.max(0, clips.length - 1)));
  selectClip();actionEditor.refresh();window.__arenamonOrganization?.refresh();window.__studioV3?.onClipsChanged?.();emit('clipsChanged');return index;
}
// Depois de substituir tracks/duração de um clip: reconstrói os interpolantes do mixer mantendo o tempo atual.
function clipChanged(clip) {
  if (!mixer) return;const index = clips.indexOf(clip), isSelected = index === selectedIndex(), previous = isSelected ? currentAction() : null;
  const time = previous?.time || 0, loop = previous?.loop, scale = previous?.timeScale ?? 1, clampEnd = previous?.clampWhenFinished;
  mixer.uncacheClip(clip);
  if (isSelected) {const action = mixer.clipAction(clip);if (loop !== undefined) {action.setLoop(loop, loop === T.LoopOnce ? 0 : Infinity);action.clampWhenFinished = clampEnd;}action.timeScale = scale;action.play();action.time = Math.min(time, clip.duration);mixer.update(0);}
  if ($('clip').options[index]) $('clip').options[index].text = clip.name;
  actionEditor.refresh();window.__arenamonOrganization?.refresh();window.__studioV3?.onClipsChanged?.();window.__studioV4?.updateClipOptions?.();
  emit('clipEdited', clip);
}
function seek(t) {const clip = clips[selectedIndex()];if (!clip || !mixer) return;const action = mixer.clipAction(clip);action.enabled = true;action.paused = false;if (!action.isRunning()) action.play();action.time = Math.max(0, Math.min(clip.duration, Number(t) || 0));mixer.update(0);}
function setPlaying(value) {
  playing = !!value;const b = $('play');if (b && clips.length) {b.disabled = false;b.textContent = playing ? '❚❚ Pausar' : '▶ Reproduzir';b.setAttribute('aria-pressed', String(playing));}
  // Ao retomar um clip LoopOnce que terminou, recomeça do início.
  const action = currentAction();if (playing && action && action.loop === T.LoopOnce && action.time >= action.getClip().duration - 1e-4) action.reset().play();
  emit('playing', playing);
}
// Opções explícitas: o projeto salva sempre com materiais originais; o GLB final usa as opções de Exportar.
async function exportGLB({unlit = $('unlit').checked, noTextures = $('noTextures').checked} = {}) {
  if (!model) throw Error('Importe um modelo primeiro.');
  // Clone skeletons and export the original local transforms, never the live animated pose.
  const root = clone(model), source = [], target = [];model.traverse(o => source.push(o));root.traverse(o => target.push(o));const uuidMap = new Map();
  source.forEach((o, i) => {const c = target[i], r = rest.get(o.uuid);uuidMap.set(o.uuid, c.uuid);if (r) {c.position.copy(r.position);c.quaternion.copy(r.quaternion);c.scale.copy(r.scale);c.matrix.copy(r.matrix);}if (o.isMesh) c.material = originals.get(o.uuid);});
  window.__studioEditor?.beforeExport?.();
  const exportedClips = clips.map(clip => {const c = clip.clone();c.tracks.forEach(t => {const dot = t.name.indexOf('.'), id = t.name.slice(0, dot);if (uuidMap.has(id)) t.name = uuidMap.get(id) + t.name.slice(dot);});return c;});
  root.userData.arenamonActions = actionEditor.manifest();materials(root, unlit, noTextures);root.updateMatrixWorld(true);
  try {return await new GLTFExporter().parseAsync(root, {binary: true, animations: exportedClips, onlyVisible: false});} finally {root.traverse(o => {if (o.isMesh) [].concat(o.material).forEach(m => m.dispose());});}
}
async function task(fn) {if (busy) return;busy = true;try {await fn();} catch (e) {status(e.message);console.error(e);} finally {busy = false;}}
$('model').onclick = () => {$('model').value = '';};
// Substituir o modelo descarta o projeto atual: pergunta antes quando há alterações não salvas.
$('model').onchange = () => task(async () => {const f = $('model').files[0];if (!f) return;if (!(await (window.__studioProject?.guardDiscard?.() ?? true))) {status('Importação cancelada. O projeto atual foi mantido.');$('model').value = '';return;}status(`Lendo ${f.name}…`);const data = await parse(f);await install(data.scene, data.animations, f.name);});
$('animations').onchange = () => task(async () => {for (const f of $('animations').files) {const data = await parse(f);const count = append(data.animations, f.name);status(`${count} animações anexadas de ${f.name}. Total: ${clips.length}.`);}});
for (const id of ['textures', 'lighting', 'palette', 'color']) $(id).onchange = () => {for (const k of ['textures', 'lighting']) $(k + 'Label').textContent = (k === 'textures' ? 'Texturas' : 'Iluminação') + ': ' + ($(k).checked ? 'ON' : 'OFF');refresh();};
$('color').addEventListener('input', () => {$('palette').value = 'global';refresh();window.__arenamonOrganization?.updateAppearance();});
$('clip').onchange = selectClip;$('play').onclick = () => setPlaying(!playing);
$('frame').onclick = () => task(async () => {frameModel();renderer.render(scene, camera);});
new ResizeObserver(() => {const w = view.clientWidth, h = view.clientHeight;if (w < 1 || h < 1) return;renderer.setSize(w, h, false);camera.aspect = w / h;camera.updateProjectionMatrix();}).observe(view);
const clock = new T.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), .1);if (playing) mixer?.update(dt);controls.update();
  emit('tick', dt);window.__studioV3?.onTick?.(dt);
  if (!window.__studioV3?.render?.(dt)) renderer.render(scene, camera);
});
const on = (name, fn) => {listeners[name].add(fn);return () => listeners[name].delete(fn);};
window.__importer = {
  install, append, exportGLB, parse, T, refresh, enterRigRest, commitRig, manifest: () => actionEditor.manifest(), addClip, removeClip, clipChanged, seek, setPlaying, on, status, frameModel,
  get model() {return model;}, get clips() {return clips;}, get mixer() {return mixer;}, get scene() {return scene;}, get camera() {return camera;},
  get controls() {return controls;}, get renderer() {return renderer;}, get playing() {return playing;},
  get selectedIndex() {return selectedIndex();}, get selectedClip() {return clips[selectedIndex()] || null;}, get selectedAction() {return currentAction();},
  selectIndex(i) {if (!clips[i]) return;$('clip').value = String(i);selectClip();window.__studioV3?.onClipsChanged?.();},
};
