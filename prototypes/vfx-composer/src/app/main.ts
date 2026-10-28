import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {DocumentStore} from '../editor/document-store';
import {AutosaveManager} from '../editor/autosave';
import type {AuthoringSettings, VfxProject, VisualNode} from '../core/types';
import {createAssistedPaths, createPathGeometry} from '../editor/geometry';
import {openProjectText, saveProjectFile} from '../editor/file-io';
import {advancePlayback, evaluateNumericTrack, evaluatePathTrack, quantizeTime} from '../animation/timeline';
import {createTextureDocument, decodeTexturePixels, paintTextureStroke} from '../textures/texture-document';
import {compileMaterialRecipe, validateMaterialGraph} from '../materials/material-graph';
import type {AuthoringFps, MaterialGraph, NumericTrackProperty, TextureDocument, VisualTrack} from '../core/types';
import {ParticlePreview} from './particle-preview';
import {QuarksParticlePreview} from './quarks-particle-preview';
import {defaultEmitter, evaluateParticleBudget, simulateEmitter, type BlendMode, type EmissionMode, type ParticleEmitter} from '../particles/particles';
import type {QualityProfile} from '../core/budget';

const phase = (duration: number) => ({enabled: true, duration, tracks: []});
const initialProject = (): VfxProject => ({
  schema: 'arenamon.vfx-project', schemaVersion: 1, projectId: 'composer-local', revision: 1, effectId: 'novo-efeito',
  phases: {start: phase(.1), launch: phase(.1), body: phase(.2), hold: phase(.3), finish: phase(.15), impact: phase(.08)},
  nodes: [], assets: [], subeffects: [], timeline: {fps: 30, tracks: []}, qualityProfiles: {},
  accessibility: {noFlash: false, reduceMotion: false}, pinnedComponents: [],
});
const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector); if (!element) throw new Error(`Elemento ausente: ${selector}`); return element;
};

document.querySelector('.brand small')!.textContent = 'F3.2 · autoria determinística + preview three.quarks';
document.querySelector('.top')!.insertAdjacentHTML('beforeend', `<nav class="workspace-tabs" aria-label="Workspaces"><button data-workspace="drawing" class="selected">Desenho</button><button data-workspace="animation">Animação</button><button data-workspace="textures">Texturas</button><button data-workspace="materials">Materiais</button><button data-workspace="particles">Partículas</button><button disabled title="F4">Integração · F4</button></nav>`);
document.querySelector('.right')!.insertAdjacentHTML('beforeend', `<section id="f2-panel">
  <div class="workspace-panel" data-panel="animation" hidden><h2>Timeline</h2><label class="field wide">FPS<select id="timeline-fps"><option>24</option><option selected>30</option><option>60</option></select><span>fps</span></label><label class="field wide">Duração<input id="timeline-duration" type="number" min="0.1" max="60" step="0.1" value="2"><span>s</span></label><div class="inline-actions"><button id="timeline-reverse">◀ Reverse</button><button id="timeline-play">▶ Play</button><button id="timeline-stop">■ Stop</button></div><label class="field wide">Tempo<input id="timeline-scrub" type="range" min="0" max="2" step="0.033333" value="0"><span id="timeline-readout">0.000 s · 0 f</span></label><label class="field wide">Propriedade<select id="track-property"><option value="position.x">Posição X</option><option value="position.y">Posição Y</option><option value="position.z">Posição Z</option><option value="scale">Escala</option><option value="opacity">Opacidade</option><option value="visible">Visível</option></select><span></span></label><label class="field wide">Interpolação<select id="key-interpolation"><option value="linear">Linear</option><option value="step">Step</option><option value="bezier">Bézier</option></select><span></span></label><button id="add-keyframe">+ Keyframe no tempo</button><label><input id="onion-enabled" type="checkbox"> Onion skin anterior/próximo</label><label class="field wide">Opacidade<input id="onion-opacity" type="range" min="0" max="100" step="1" value="25"><span>%</span></label></div>
  <div class="workspace-panel" data-panel="textures" hidden><h2>Pintura de textura</h2><canvas id="texture-canvas" width="256" height="256"></canvas><label class="field wide">Pincel<input id="brush-size" type="range" min="1" max="128" step="1" value="24"><span>px</span></label><label class="field wide">Opacidade<input id="brush-opacity" type="range" min="0" max="100" step="1" value="100"><span>%</span></label><label class="field wide">Cor<input id="brush-color" type="color" value="#ffffff"><span></span></label><div class="inline-actions"><button id="new-texture">Nova 256×256</button><label class="file-button">Importar PNG<input id="import-texture" type="file" accept="image/png" hidden></label><button id="clear-texture">Limpar</button></div><h2>Spritesheet</h2><label class="field wide">Colunas<input id="sprite-columns" type="number" min="1" max="64" step="1" value="1"><span>×</span></label><label class="field wide">Linhas<input id="sprite-rows" type="number" min="1" max="64" step="1" value="1"><span>×</span></label><label class="field wide">FPS<input id="sprite-fps" type="number" min="1" max="60" step="1" value="24"><span>fps</span></label><button id="apply-spritesheet">Aplicar spritesheet</button></div>
  <div class="workspace-panel" data-panel="materials" hidden><h2>Material seguro</h2><p class="hint">Grafo declarativo; nenhum código de shader é aceito.</p><label class="field wide">Cor<input id="material-color" type="color" value="#44aaff"><span></span></label><label class="field wide">Roughness<input id="material-roughness" type="range" min="0" max="1" step="0.01" value="0.35"><span></span></label><label class="field wide">Metalness<input id="material-metalness" type="range" min="0" max="1" step="0.01" value="0"><span></span></label><label class="field wide">Nó<select id="material-node-type"><option>color</option><option>texture</option><option>gradient</option><option>noise</option><option>fresnel</option><option>dissolve</option><option>multiply</option></select><span></span></label><div class="inline-actions"><button id="apply-material">Aplicar material</button><button id="add-material-node">+ Nó seguro</button></div><ol id="material-nodes"></ol><p id="material-validation"></p></div>
</section>`);

const PARTICLE_FIELDS = [
  {path: 'seed', label: 'Seed', min: 0, max: 4294967295, step: 1, unit: '#'},
  {path: 'emission.count', label: 'Burst', min: 1, max: 400, step: 1, unit: 'part.'},
  {path: 'emission.rate', label: 'Taxa', min: 0.1, max: 400, step: 0.1, unit: 'part./s'},
  {path: 'emission.interval', label: 'Intervalo', min: 0.01, max: 60, step: 0.01, unit: 's'},
  {path: 'emission.duration', label: 'Duração', min: 0.01, max: 60, step: 0.01, unit: 's'},
  {path: 'lifetime.min', label: 'Vida mín.', min: 0.01, max: 30, step: 0.01, unit: 's'},
  {path: 'lifetime.max', label: 'Vida máx.', min: 0.01, max: 30, step: 0.01, unit: 's'},
  {path: 'shape.radius', label: 'Raio', min: 0, max: 50, step: 0.01, unit: 'm'},
  {path: 'shape.angle', label: 'Cone', min: 0, max: 180, step: 1, unit: '°'},
  {path: 'velocity.speedMin', label: 'Vel. mín.', min: 0, max: 50, step: 0.1, unit: 'm/s'},
  {path: 'velocity.speedMax', label: 'Vel. máx.', min: 0, max: 50, step: 0.1, unit: 'm/s'},
  {path: 'velocity.spread', label: 'Abertura', min: 0, max: 360, step: 1, unit: '°'},
  {path: 'forces.drag', label: 'Arrasto', min: 0, max: 20, step: 0.01, unit: ''},
  {path: 'forces.turbulenceFrequency', label: 'Turb. Hz', min: 0, max: 20, step: 0.1, unit: 'Hz'},
  {path: 'forces.turbulenceAmplitude', label: 'Turb. amp.', min: 0, max: 20, step: 0.01, unit: 'm'},
  {path: 'look.sizeStart', label: 'Tam. início', min: 0.001, max: 5, step: 0.001, unit: 'm'},
  {path: 'look.sizeEnd', label: 'Tam. fim', min: 0.001, max: 5, step: 0.001, unit: 'm'},
  {path: 'look.opacityStart', label: 'Alpha início', min: 0, max: 1, step: 0.01, unit: ''},
  {path: 'look.opacityEnd', label: 'Alpha fim', min: 0, max: 1, step: 0.01, unit: ''},
  {path: 'maxParticles', label: 'Máx. vivas', min: 1, max: 1400, step: 1, unit: 'part.'},
] as const;
const fieldId = (path: string): string => `emitter-${path.replace('emission.', '').replace('lifetime.', 'life-').replace('shape.', '').replace('velocity.', '').replace('forces.', '').replace('look.', '')}`;
const particleRows = PARTICLE_FIELDS.map(field => `<label class="paired"><span>${field.label}</span><input id="${fieldId(field.path)}-range" type="range" min="${field.min}" max="${field.max}" step="${field.step}"><input id="${fieldId(field.path)}" type="number" min="${field.min}" max="${field.max}" step="${field.step}"><span class="unit">${field.unit}</span></label>`).join('');
document.querySelector('.right')!.insertAdjacentHTML('beforeend', `<section id="particle-panel" class="workspace-panel" data-panel="particles" hidden>
  <h2>Emissor de partículas</h2>
  <p class="hint">Contrato F3.1: simulação pura e semeada. Mesmo seed + tempo + perfil = mesmas partículas. O Composer não decide dano, acerto nem colisão.</p>
  <div class="inline-actions"><button id="add-emitter">+ Emissor</button><button id="remove-emitter">Remover</button><label class="field wide" style="margin:0">Emissor<select id="emitter-select"></select><span></span></label></div>
  <div id="emitter-form">
    <label class="field wide">Ativo<input id="emitter-enabled" type="checkbox" checked><span></span></label>
    <label class="field wide">Nome<input id="emitter-name" type="text" maxlength="64"><span></span></label>
    <label class="field wide">Modo<select id="emitter-mode"><option value="burst">Burst</option><option value="continuous">Contínuo</option></select><span></span></label>
    <label class="field wide">Forma<select id="emitter-shape"><option value="point">Ponto</option><option value="sphere">Esfera</option><option value="ring">Anel</option><option value="cone">Cone</option></select><span></span></label>
    <div class="axis-grid"><label>Origem X<input id="emitter-origin-x" type="number" min="-100" max="100" step="0.1"></label><label>Y<input id="emitter-origin-y" type="number" min="-100" max="100" step="0.1"></label><label>Z<input id="emitter-origin-z" type="number" min="-100" max="100" step="0.1"></label></div>
    ${particleRows}
    <div class="axis-grid"><label>Grav. X<input id="emitter-gravity-x" type="number" min="-50" max="50" step="0.1"></label><label>Y<input id="emitter-gravity-y" type="number" min="-50" max="50" step="0.1"></label><label>Z<input id="emitter-gravity-z" type="number" min="-50" max="50" step="0.1"></label></div>
    <label class="field wide">Cor inicial<input id="emitter-color-start" type="color" value="#ffd166"><span></span></label>
    <label class="field wide">Cor final<input id="emitter-color-end" type="color" value="#ff5a3c"><span></span></label>
    <label class="field wide">Blending<select id="emitter-blending"><option value="additive">Additive</option><option value="normal">Normal</option></select><span></span></label>
    <label><input id="emitter-depth-write" type="checkbox"> depthWrite (teste de profundidade)</label>
    <div class="inline-actions"><button id="apply-emitter">Aplicar emissor</button><button id="reset-emitter-peak">Zerar pico</button></div>
  </div>
  <h2>Custo e telemetria</h2>
  <label class="field wide">Preview<select id="particle-preview-backend"><option value="authoring">Autoral</option><option value="quarks">Quarks</option><option value="compare">Comparar A/B</option></select><span></span></label>
  <label class="field wide">Perfil<select id="quality-profile"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select><span></span></label>
  <div id="particle-telemetry" class="telemetry">Sem emissor.</div>
  <div id="particle-budget" class="badge">—</div>
  <label><input id="access-reduce-motion" type="checkbox"> Reduce motion (35% das partículas)</label>
  <label><input id="access-no-flash" type="checkbox"> No flash (opacidade ≤ 85%)</label>
</section>`);

let recovered = initialProject();
try {
  const saved = localStorage.getItem('arenamon.vfx.composer-local');
  if (saved) recovered = JSON.parse(saved) as VfxProject;
} catch { /* file:// pode negar storage; o editor continua em memória */ }
const store = new DocumentStore(recovered);
let playback = {time: 0, duration: store.project.timeline.duration ?? 2, direction: 1 as 1 | -1, playing: false};
let activeTexture: TextureDocument = store.project.textures?.[0] ?? createTextureDocument({id: 'mask-main', name: 'Máscara principal'});
let materialGraph: MaterialGraph = store.project.materials?.[0] ?? {id: 'material-main', name: 'Material principal', outputNodeId: 'material-output', nodes: [{id: 'material-color', type: 'color', params: {color: '#44aaff'}}, {id: 'material-output', type: 'output', params: {roughness: .35, metalness: 0}}], connections: [{fromNodeId: 'material-color', fromPort: 'color', toNodeId: 'material-output', toPort: 'color'}]};
let selectedId: string | null = store.selectedId;
let selectedIds = new Set<string>(selectedId ? [selectedId] : []);
let isolated = false;
let serial = store.project.nodes.length;
let autosave: AutosaveManager | null = null;
try { autosave = new AutosaveManager(localStorage, store.project.projectId); } catch { autosave = null; }

const viewport = $('#viewport');
const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x07111f);
const camera = new THREE.PerspectiveCamera(50, 1, .05, 200); camera.position.set(5, 4, 7);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.target.set(0, .6, 0);
const transformControls = new TransformControls(camera, renderer.domElement);
scene.add(transformControls.getHelper());
transformControls.addEventListener('dragging-changed', event => {controls.enabled = !event.value;});
transformControls.addEventListener('mouseUp', () => {
  const object = transformControls.object;
  if (!object || !selectedId) return;
  const node = selected();
  if (!node || node.locked) {rebuild(); return;}
  const rotation: [number, number, number] = [object.rotation.x, object.rotation.y, object.rotation.z];
  const scale = object.scale.toArray();
  const position = object.position.clone().sub(pivotWorldOffset(node?.pivot ?? [0, 0, 0], rotation, scale)).toArray();
  const previous = node.transform?.position ?? [0, 0, 0];
  const delta = position.map((value, axis) => value - previous[axis]) as [number, number, number];
  store.transaction('Transformar seleção', () => {
    store.setTransform(selectedId!, {position, rotation, scale});
    for (const id of selectedIds) if (id !== selectedId) {
      const other = store.project.nodes.find(candidate => candidate.id === id);
      if (!other || other.locked) continue;
      const current = other.transform?.position ?? [0, 0, 0];
      store.setTransform(id, {position: current.map((value, axis) => value + delta[axis]) as [number, number, number]});
    }
  });
  rebuild();
});
scene.add(new THREE.HemisphereLight(0xbddcff, 0x1d2430, 1.6));
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(5, 8, 6); scene.add(key);
scene.add(new THREE.GridHelper(20, 20, 0x3b82f6, 0x263447));
const authored = new THREE.Group(); scene.add(authored);
const onionGroup = new THREE.Group(); onionGroup.name = 'onion-skin'; scene.add(onionGroup);
const drawingPreview = new THREE.Group(); scene.add(drawingPreview);
const drawingPlane = new THREE.Plane();
const drawingRaycaster = new THREE.Raycaster();
let drawing = false;
let drawingPoints: [number, number, number][] = [];

const defaultAuthoring = (): AuthoringSettings => ({drawingPlane: {origin: [0, 0, 0], rotation: [0, 0, 0]}, mirrorX: false, radialCopies: 1});
const authoring = (): AuthoringSettings => store.project.authoring ?? defaultAuthoring();
function updateDrawingPlane(): void {
  const settings = authoring().drawingPlane;
  const normal = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...settings.rotation, 'XYZ')).normalize();
  drawingPlane.setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(...settings.origin));
}

function clearDrawingPreview(): void {
  for (const child of [...drawingPreview.children]) {
    drawingPreview.remove(child);
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {child.geometry.dispose(); (child.material as THREE.Material).dispose();}
  }
}
function refreshDrawingPreview(): void {
  clearDrawingPreview();
  if (drawingPoints.length > 1) drawingPreview.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(drawingPoints.map(point => new THREE.Vector3(...point))),
    new THREE.LineBasicMaterial({color: 0xffd166}),
  ));
  for (const point of drawingPoints) {
    const marker = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), new THREE.MeshBasicMaterial({color: 0xffd166}));
    marker.position.fromArray(point); drawingPreview.add(marker);
  }
}
function setDrawing(active: boolean): void {
  drawing = active; controls.enabled = !active; drawingPoints = []; clearDrawingPreview();
  ($('#finish-drawing') as HTMLButtonElement).disabled = !active;
  ($('#cancel-drawing') as HTMLButtonElement).disabled = !active;
  const target = ($('#drawing-target') as HTMLSelectElement).value;
  $('#status').textContent = active ? `Desenho em ${target === 'surface' ? 'superfície 3D' : 'plano XZ'} · clique e finalize com 2+ pontos` : 'Projeto local · autosave por revisão';
}

function pivotWorldOffset(pivot: [number, number, number], rotation: [number, number, number], scale: [number, number, number]): THREE.Vector3 {
  return new THREE.Vector3(...pivot).multiply(new THREE.Vector3(...scale)).applyEuler(new THREE.Euler(...rotation, 'XYZ'));
}

function ribbonGeometry(curve: THREE.CatmullRomCurve3, width: number, endWidth: number, extrusion: number, closed: boolean): THREE.BufferGeometry {
  const steps = Math.max(16, curve.points.length * 8), frames = curve.computeFrenetFrames(steps, closed);
  const vertices: number[] = [], indices: number[] = [];
  for (let index = 0; index <= steps; index++) {
    const center = curve.getPointAt(index / steps), halfWidth = THREE.MathUtils.lerp(width, endWidth, index / steps) / 2, halfDepth = extrusion / 2;
    const normal = frames.normals[index], binormal = frames.binormals[index];
    for (const [side, depth] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const point = center.clone().addScaledVector(normal, side * halfWidth).addScaledVector(binormal, depth * halfDepth); vertices.push(...point.toArray());
    }
  }
  for (let index = 0; index < steps; index++) for (let face = 0; face < 4; face++) {
    const a = index * 4 + face, b = index * 4 + (face + 1) % 4, c = (index + 1) * 4 + (face + 1) % 4, d = (index + 1) * 4 + face;
    indices.push(a, b, d, b, c, d);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function nodeMesh(node: VisualNode): THREE.Object3D {
  const pivot = node.pivot ?? [0, 0, 0];
  const transform = node.transform ?? {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]};
  let geometry: THREE.BufferGeometry;
  let material: THREE.Material;
  if (node.geometry && ['stroke', 'curve', 'ribbon'].includes(node.geometry.kind)) {
    const path = node.geometry as Extract<NonNullable<VisualNode['geometry']>, {kind: 'stroke' | 'curve' | 'ribbon'}>;
    const points = path.points.map(point => new THREE.Vector3(...point));
    const curve = new THREE.CatmullRomCurve3(points, path.closed, 'centripetal');
    if (path.kind === 'ribbon') geometry = ribbonGeometry(curve, path.width, path.endWidth ?? path.width, path.extrusion ?? path.width * .15, path.closed);
    else geometry = new THREE.TubeGeometry(curve, Math.max(8, points.length * 8), path.width / 2, 8, path.closed);
    material = new THREE.MeshStandardMaterial({color: selectedIds.has(node.id) ? 0xffd166 : 0x46d7c7, roughness: .3, metalness: .05, side: THREE.DoubleSide});
  } else {
    if (node.geometry?.kind === 'sphere') geometry = new THREE.SphereGeometry(node.geometry.radius, 24, 16);
    else if (node.geometry?.kind === 'plane') geometry = new THREE.PlaneGeometry(...node.geometry.size);
    else {const size = node.geometry?.kind === 'box' ? node.geometry.size : [1, 1, 1]; geometry = new THREE.BoxGeometry(...size);}
    material = new THREE.MeshStandardMaterial({color: selectedIds.has(node.id) ? 0x55c7ff : 0x7a8ba8, roughness: .35, metalness: .12, side: THREE.DoubleSide});
  }
  geometry.translate(-pivot[0], -pivot[1], -pivot[2]);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.fromArray(transform.position).add(pivotWorldOffset(pivot, transform.rotation, transform.scale)); mesh.rotation.fromArray([...transform.rotation, 'XYZ']); mesh.scale.fromArray(transform.scale);
  mesh.userData.nodeId = node.id; return mesh;
}
function rebuild(): void {
  transformControls.detach();
  for (const child of [...authored.children]) {
    authored.remove(child);
    if (child instanceof THREE.Mesh) {child.geometry.dispose(); (child.material as THREE.Material).dispose();}
  }
  for (const node of store.project.nodes) {
    const object = nodeMesh(node); object.visible = !isolated || selectedIds.has(node.id); authored.add(object);
  }
  const selectedObject = authored.children.find(child => child.userData.nodeId === selectedId);
  if (selectedObject && !selected()?.locked) transformControls.attach(selectedObject);
  const hierarchy = $('#hierarchy'); hierarchy.replaceChildren();
  for (const node of store.project.nodes) {
    const row = document.createElement('div'); row.className = `node-row${selectedIds.has(node.id) ? ' multi' : ''}`;
    const button = document.createElement('button'); button.dataset.nodeId = node.id; button.textContent = `${node.locked ? '🔒' : '◈'} ${node.id}`;
    button.className = node.id === selectedId ? 'selected' : '';
    button.onclick = event => {
      if (event.ctrlKey || event.shiftKey) {
        if (selectedIds.has(node.id)) selectedIds.delete(node.id); else selectedIds.add(node.id);
        selectedId = selectedIds.has(node.id) ? node.id : [...selectedIds].at(-1) ?? null;
      } else {selectedId = node.id; selectedIds = new Set([node.id]);}
      rebuild();
    };
    row.append(button); hierarchy.append(row);
  }
  syncInspector();
  syncParticlePanel();
  try { autosave?.save(store.project); } catch (error) { $('#status').textContent = `Autosave: ${error instanceof Error ? error.message : 'falhou'}`; }
  expose();
}
function selected(): VisualNode | undefined { return store.project.nodes.find(node => node.id === selectedId); }
function syncVertexFields(): void {
  const node = selected();
  const editor = $('#vertex-editor');
  const indexInput = $('#vertex-index') as HTMLSelectElement;
  const geometry = node?.geometry;
  if (!geometry || geometry.kind === 'box' || geometry.kind === 'sphere' || geometry.kind === 'plane') {editor.hidden = true; indexInput.replaceChildren(); return;}
  editor.hidden = false;
  const previousIndex = Number(indexInput.value);
  indexInput.replaceChildren(...geometry.points.map((_, index) => {
    const option = document.createElement('option'); option.value = String(index); option.textContent = `Ponto ${index + 1}`; return option;
  }));
  indexInput.value = String(Number.isSafeInteger(previousIndex) && previousIndex < geometry.points.length ? previousIndex : 0);
  const point = geometry.points[Number(indexInput.value)] ?? geometry.points[0];
  (['x', 'y', 'z'] as const).forEach((axis, index) => {($('#vertex-' + axis) as HTMLInputElement).value = String(point[index]);});
}
function syncInspector(): void {
  const node = selected();
  $('#selection').textContent = node ? node.id : 'Nenhum objeto selecionado';
  const position = node?.transform?.position ?? [0, 0, 0];
  (['x', 'y', 'z'] as const).forEach((axis, index) => {($('#position-' + axis) as HTMLInputElement).value = String(position[index]);});
  const pivot = node?.pivot ?? [0, 0, 0];
  (['x', 'y', 'z'] as const).forEach((axis, index) => {($('#pivot-' + axis) as HTMLInputElement).value = String(pivot[index]);});
  if (node?.geometry?.kind === 'ribbon') ($('#path-extrusion') as HTMLInputElement).value = String(node.geometry.extrusion ?? node.geometry.width * .15);
  if (node?.geometry?.kind === 'ribbon') ($('#path-end-width') as HTMLInputElement).value = String(node.geometry.endWidth ?? node.geometry.width);
  $('#toggle-lock').textContent = node?.locked ? '🔒 Destravar' : '🔓 Travar';
  syncVertexFields();
}
function syncAuthoringFields(): void {
  const settings = authoring();
  (['x', 'y', 'z'] as const).forEach((axis, index) => {
    ($('#plane-origin-' + axis) as HTMLInputElement).value = String(settings.drawingPlane.origin[index]);
    ($('#plane-rotation-' + axis) as HTMLInputElement).value = String(Math.round(THREE.MathUtils.radToDeg(settings.drawingPlane.rotation[index]) * 1000) / 1000);
  });
  ($('#mirror-x') as HTMLInputElement).checked = settings.mirrorX;
  ($('#radial-copies') as HTMLInputElement).value = String(settings.radialCopies);
  ($('#radial-copies-range') as HTMLInputElement).value = String(settings.radialCopies);
}
function editPosition(axis: 0 | 1 | 2, value: number): void {
  if (!selectedId || !Number.isFinite(value)) return;
  const active = selected(); if (!active || active.locked) {$('#status').textContent = 'Nó travado: destrave para editar'; return;}
  const previous = active.transform?.position ?? [0, 0, 0], delta = value - previous[axis];
  store.transaction('Mover seleção', () => {for (const id of selectedIds) {
    const node = store.project.nodes.find(candidate => candidate.id === id); if (!node || node.locked) continue;
    const position = [...(node.transform?.position ?? [0, 0, 0])] as [number, number, number]; position[axis] += delta; store.setTransform(id, {position});
  }}); rebuild();
}
function expose(): void {(window as unknown as {__ARENAMON_VFX_COMPOSER__: unknown}).__ARENAMON_VFX_COMPOSER__ = {ready: true, get project() {return store.project;}, get playback() {return {...playback};}, get onionCount() {return onionGroup.children.length;}, get materialRecipe() {try {return compileMaterialRecipe(materialGraph, store.project.textures ?? [activeTexture]);} catch {return null;}}, get selectedIds() {return [...selectedIds];}, get transformAttached() {return transformControls.object !== undefined;}, get drawing() {return drawing;}, get emitters() {return store.project.particles ?? [];}, get qualityProfile() {return qualityProfile;}, get particleTelemetry() {return particlePreview.report;}, get quarksTelemetry() {return quarksPreview.report;}, get previewBackend() {return previewBackend;}, get previewVisibility() {return {authoring: particlePreview.group.visible, quarks: quarksPreview.group.visible};}, get rendererGeometries() {return renderer.info.memory.geometries;}, get particleBudget() {return evaluateParticleBudget(currentEmitters(), qualityProfile, store.project.accessibility);}, particleSnapshot() {const options = particleOptions(); return (store.project.particles ?? []).flatMap(emitter => simulateEmitter(emitter, playback.time, options).map(particle => [Number(particle.x.toFixed(5)), Number(particle.y.toFixed(5)), Number(particle.z.toFixed(5)), Number(particle.size.toFixed(5)), Number(particle.opacity.toFixed(5))]));}, get selectedBoundsCenter() {const object = authored.children.find(child => child.userData.nodeId === selectedId); return object ? new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).toArray() : null;}, nodeScreenPoint(id: string) {const object = authored.children.find(child => child.userData.nodeId === id); if (!object) return null; const point = object.position.clone().project(camera), bounds = renderer.domElement.getBoundingClientRect(); return [bounds.left + (point.x + 1) * bounds.width / 2, bounds.top + (1 - point.y) * bounds.height / 2];}};}

$('#add-box').onclick = () => {
  const id = `box-${++serial}`; selectedId = id;
  selectedIds = new Set([id]); store.addNode({id, kind: 'mesh', parentId: null, assetIds: [], transform: {position: [0, .5, 0], rotation: [0, 0, 0], scale: [1, 1, 1]}, geometry: {kind: 'box', size: [1, 1, 1]}}); rebuild();
};
function addPrimitive(kind: 'sphere' | 'plane'): void {
  const id = `${kind}-${++serial}`; selectedId = id; selectedIds = new Set([id]);
  const geometry = kind === 'sphere' ? {kind, radius: .5} as const : {kind, size: [1.5, 1.5] as [number, number]} as const;
  store.addNode({id, kind: 'mesh', parentId: null, assetIds: [], transform: {position: [0, kind === 'sphere' ? .5 : .02, 0], rotation: kind === 'plane' ? [-Math.PI / 2, 0, 0] : [0, 0, 0], scale: [1, 1, 1]}, geometry}); rebuild();
}
$('#add-sphere').onclick = () => addPrimitive('sphere');
$('#add-plane').onclick = () => addPrimitive('plane');
type PathKind = 'stroke' | 'curve' | 'ribbon';
const pathPoints: Record<PathKind, [number, number, number][]> = {
  stroke: [[-1, .2, 0], [-.4, 1.1, .25], [.4, .8, -.2], [1.1, 1.5, 0]],
  curve: [[-1, 0, 0], [-.5, 1, .4], [.4, .4, -.3], [1.2, 1.2, 0]],
  ribbon: [[-1, .1, 0], [-.3, .8, .2], [.4, .7, -.2], [1.1, 1.4, 0]],
};
function addPath(kind: PathKind): void {
  const width = Number(($('#path-width') as HTMLInputElement).value);
  const snap = Number(($('#path-snap') as HTMLInputElement).value);
  const extrusion = kind === 'ribbon' ? Number(($('#path-extrusion') as HTMLInputElement).value) : undefined;
  const endWidth = kind === 'ribbon' ? Number(($('#path-end-width') as HTMLInputElement).value) : undefined;
  const id = `${kind}-${++serial}`; selectedId = id;
  selectedIds = new Set([id]); store.addNode({id, kind: 'stroke', parentId: null, assetIds: [], transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]}, geometry: createPathGeometry(kind, pathPoints[kind], {width, endWidth, extrusion, snap})}); rebuild();
}
$('#add-stroke').onclick = () => addPath('stroke');
$('#add-curve').onclick = () => addPath('curve');
$('#add-ribbon').onclick = () => addPath('ribbon');
$('#draw-stroke').onclick = () => {transformControls.detach(); setDrawing(true);};
$('#cancel-drawing').onclick = () => setDrawing(false);
$('#finish-drawing').onclick = () => {
  if (!drawing || drawingPoints.length < 2) {$('#status').textContent = 'Adicione ao menos 2 pontos antes de finalizar'; return;}
  const width = Number(($('#path-width') as HTMLInputElement).value);
  const paths = createAssistedPaths(drawingPoints, {...authoring().drawingPlane, mirrorX: authoring().mirrorX, radialCopies: authoring().radialCopies});
  const ids: string[] = [];
  store.transaction('Finalizar desenho assistido', () => {for (const points of paths) {
    const id = `stroke-livre-${++serial}`; ids.push(id);
    store.addNode({id, kind: 'stroke', parentId: null, assetIds: [], transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]}, geometry: createPathGeometry('stroke', points, {width})});
  }});
  selectedId = ids.at(-1) ?? null; selectedIds = new Set(ids);
  setDrawing(false); rebuild();
};
renderer.domElement.addEventListener('pointerdown', event => {
  if (!drawing || event.button !== 0) return;
  const bounds = renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
  drawingRaycaster.setFromCamera(pointer, camera);
  const hit = new THREE.Vector3();
  if (($('#drawing-target') as HTMLSelectElement).value === 'surface') {
    const intersection = drawingRaycaster.intersectObjects(authored.children, false)[0];
    if (!intersection) {$('#status').textContent = 'Nenhuma superfície autoral sob o cursor'; return;}
    hit.copy(intersection.point);
  } else {updateDrawingPlane(); if (!drawingRaycaster.ray.intersectPlane(drawingPlane, hit)) return;}
  const snap = Number(($('#path-snap') as HTMLInputElement).value);
  const point = hit.toArray().map(value => Math.round(value / snap) * snap) as [number, number, number];
  if (!drawingPoints.some(existing => existing.every((value, index) => value === point[index]))) {drawingPoints.push(point); refreshDrawingPreview();}
});
($('#vertex-index') as HTMLSelectElement).onchange = () => syncVertexFields();
const vertexIndex = (): number => Number(($('#vertex-index') as HTMLSelectElement).value);
const vertexPoint = (): [number, number, number] => (['x', 'y', 'z'] as const).map(axis => Number(($('#vertex-' + axis) as HTMLInputElement).value)) as [number, number, number];
$('#apply-vertex').onclick = () => {
  if (!selectedId) return;
  const snap = Number(($('#path-snap') as HTMLInputElement).value);
  store.setPathPoint(selectedId, vertexIndex(), vertexPoint(), snap); rebuild();
};
$('#insert-vertex').onclick = () => {
  if (!selectedId) return;
  const snap = Number(($('#path-snap') as HTMLInputElement).value);
  store.insertPathPoint(selectedId, vertexIndex(), vertexPoint(), snap); rebuild();
};
$('#remove-vertex').onclick = () => {if (selectedId) {store.removePathPoint(selectedId, vertexIndex()); rebuild();}};
$('#apply-pivot').onclick = () => {
  if (!selectedId) return;
  const pivot = (['x', 'y', 'z'] as const).map(axis => Number(($('#pivot-' + axis) as HTMLInputElement).value)) as [number, number, number];
  store.setPivot(selectedId, pivot); rebuild();
};
$('#apply-extrusion').onclick = () => {
  if (!selectedId) return;
  store.setPathExtrusion(selectedId, Number(($('#path-extrusion') as HTMLInputElement).value)); rebuild();
};
$('#apply-taper').onclick = () => {
  if (!selectedId) return;
  store.setPathTaper(selectedId, Number(($('#path-end-width') as HTMLInputElement).value)); rebuild();
};
$('#toggle-lock').onclick = () => {if (selectedId) {store.setLocked(selectedId, !selected()?.locked); rebuild();}};
$('#toggle-isolate').onclick = () => {isolated = !isolated; $('#toggle-isolate').classList.toggle('selected', isolated); rebuild();};
($('#gizmo-space') as HTMLSelectElement).onchange = event => transformControls.setSpace((event.target as HTMLSelectElement).value as 'world' | 'local');
const app = $('.app');
$('#toggle-left-panel').onclick = () => {app.classList.toggle('left-collapsed'); setTimeout(resize, 220);};
$('#toggle-right-panel').onclick = () => {app.classList.toggle('right-collapsed'); setTimeout(resize, 220);};
function setView(kind: 'perspective' | 'front' | 'side'): void {
  if (kind === 'front') camera.position.set(0, 2, 8);
  else if (kind === 'side') camera.position.set(8, 2, 0);
  else camera.position.set(5, 4, 7);
  controls.target.set(0, .6, 0); camera.lookAt(controls.target); controls.update();
}
$('#view-perspective').onclick = () => setView('perspective');
$('#view-front').onclick = () => setView('front');
$('#view-side').onclick = () => setView('side');
function bindPair(rangeId: string, numberId: string): void {
  const range = $(rangeId) as HTMLInputElement, number = $(numberId) as HTMLInputElement;
  range.oninput = () => {number.value = range.value;};
  number.oninput = () => {range.value = String(Math.min(Number(range.max), Math.max(Number(range.min), Number(number.value))));};
}
bindPair('#path-width-range', '#path-width');
bindPair('#path-end-width-range', '#path-end-width');
bindPair('#path-snap-range', '#path-snap');
bindPair('#path-extrusion-range', '#path-extrusion');
bindPair('#radial-copies-range', '#radial-copies');
function readAuthoringSettings(): AuthoringSettings {
  const origin = (['x', 'y', 'z'] as const).map(axis => Number(($('#plane-origin-' + axis) as HTMLInputElement).value)) as [number, number, number];
  const rotation = (['x', 'y', 'z'] as const).map(axis => THREE.MathUtils.degToRad(Number(($('#plane-rotation-' + axis) as HTMLInputElement).value))) as [number, number, number];
  return {drawingPlane: {origin, rotation}, mirrorX: ($('#mirror-x') as HTMLInputElement).checked, radialCopies: Number(($('#radial-copies') as HTMLInputElement).value)};
}
function commitAuthoring(): void {try {store.setAuthoringSettings(readAuthoringSettings()); updateDrawingPlane(); rebuild();} catch (error) {$('#status').textContent = error instanceof Error ? error.message : 'Configuração autoral inválida';}}
for (const id of ['#plane-origin-x', '#plane-origin-y', '#plane-origin-z', '#plane-rotation-x', '#plane-rotation-y', '#plane-rotation-z', '#radial-copies']) ($(id) as HTMLInputElement).onchange = commitAuthoring;
($('#mirror-x') as HTMLInputElement).onchange = commitAuthoring;
$('#export-project').onclick = async () => {
  const useFileSystem = ($('#use-file-system') as HTMLInputElement).checked;
  const picker = (window as unknown as {showSaveFilePicker?: (options: unknown) => Promise<{createWritable(): Promise<{write(text: string): Promise<void>; close(): Promise<void>}>}>}).showSaveFilePicker;
  const result = await saveProjectFile(store.project, {
    writeFile: picker ? async (name, text) => {
      const handle = await picker({suggestedName: name, types: [{description: 'Projeto Arenamon VFX', accept: {'application/json': ['.json']}}]});
      const writable = await handle.createWritable(); await writable.write(text); await writable.close();
    } : undefined,
    download: (name, text) => {
      const url = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
    },
  }, {useFileSystem});
  $('#status').textContent = result === 'file-system' ? 'Projeto salvo no arquivo escolhido' : 'Projeto exportado por download';
};
($('#import-project') as HTMLInputElement).onchange = async event => {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
  try {
    const project = openProjectText(await file.text());
    store.replaceProject(project); selectedId = null; selectedIds.clear(); serial = store.project.nodes.length;
    try {autosave = new AutosaveManager(localStorage, project.projectId);} catch {autosave = null;}
    rebuild(); $('#status').textContent = `Projeto importado: ${project.projectId}`;
  } catch (error) {$('#status').textContent = `Importação recusada: ${error instanceof Error ? error.message : 'arquivo inválido'}`;}
  input.value = '';
};
$('#undo').onclick = () => {if (store.undo()) {selectedId = store.selectedId; selectedIds = new Set(selectedId ? [selectedId] : []); rebuild();}};
$('#redo').onclick = () => {if (store.redo()) {selectedId = store.selectedId; selectedIds = new Set(selectedId ? [selectedId] : []); rebuild();}};
(['x', 'y', 'z'] as const).forEach((axis, index) => {($('#position-' + axis) as HTMLInputElement).onchange = event => editPosition(index as 0 | 1 | 2, Number((event.target as HTMLInputElement).value));});
const workspaceButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-workspace]')];
function setWorkspace(name: string): void {workspaceButtons.forEach(button => button.classList.toggle('selected', button.dataset.workspace === name)); document.querySelectorAll<HTMLElement>('[data-panel]').forEach(panel => panel.hidden = panel.dataset.panel !== name); document.body.dataset.workspace = name;}
workspaceButtons.forEach(button => button.onclick = () => setWorkspace(button.dataset.workspace!));
const timelineFps = $('#timeline-fps') as HTMLSelectElement, timelineDuration = $('#timeline-duration') as HTMLInputElement, timelineScrub = $('#timeline-scrub') as HTMLInputElement;
function syncTimeline(): void {const fps = Number(timelineFps.value) as AuthoringFps; timelineScrub.max = String(playback.duration); timelineScrub.step = String(1 / fps); timelineScrub.value = String(playback.time); $('#timeline-readout').textContent = `${playback.time.toFixed(3)} s · ${Math.round(playback.time * fps)} f`; expose();}
timelineFps.value = String(store.project.timeline.fps); timelineDuration.value = String(playback.duration);
timelineFps.onchange = () => {store.setTimelineFps(Number(timelineFps.value) as AuthoringFps); playback.time = quantizeTime(playback.time, store.project.timeline.fps, playback.duration); syncTimeline(); rebuild();};
timelineDuration.onchange = () => {const duration = Number(timelineDuration.value); store.setTimelineDuration(duration); playback.duration = duration; playback.time = Math.min(playback.time, duration); syncTimeline(); rebuild();};
timelineScrub.oninput = () => {playback.time = quantizeTime(Number(timelineScrub.value), store.project.timeline.fps, playback.duration); playback.playing = false; syncTimeline();};
$('#timeline-play').onclick = () => {if (playback.time >= playback.duration) playback.time = 0; playback.direction = 1; playback.playing = true; syncTimeline();};
$('#timeline-reverse').onclick = () => {if (playback.time <= 0) playback.time = playback.duration; playback.direction = -1; playback.playing = true; syncTimeline();};
$('#timeline-stop').onclick = () => {playback = {...playback, time: 0, playing: false}; syncTimeline();};
$('#add-keyframe').onclick = () => {const node = selected(); if (!node) {$('#status').textContent = 'Selecione um objeto para adicionar keyframe'; return;} const property = ($('#track-property') as HTMLSelectElement).value as NumericTrackProperty; const interpolation = ($('#key-interpolation') as HTMLSelectElement).value as 'linear' | 'step' | 'bezier'; const transform = node.transform ?? {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]}; const values: Record<NumericTrackProperty, number> = {opacity: 1, scale: transform.scale[0], visible: 1, 'position.x': transform.position[0], 'position.y': transform.position[1], 'position.z': transform.position[2], 'rotation.x': transform.rotation[0], 'rotation.y': transform.rotation[1], 'rotation.z': transform.rotation[2]}; const id = `track-${node.id}-${property.replace('.', '-')}`; const existing = store.project.timeline.tracks.find(track => track.id === id && track.property !== 'path.points') as Extract<VisualTrack, {property: NumericTrackProperty}> | undefined; const keyframes = [...(existing?.keyframes ?? []).filter(frame => Math.abs(frame.time - playback.time) > 1e-6), {time: playback.time, value: values[property], interpolation}].sort((a, b) => a.time - b.time); store.upsertTrack({id, targetId: node.id, property, keyframes}); rebuild(); $('#status').textContent = `Keyframe ${property} em ${playback.time.toFixed(3)} s`;};
function applyTrackAt(object: THREE.Object3D, track: Exclude<VisualTrack, {property: 'path.points'}>, time: number): void {const value = evaluateNumericTrack(track, time); if (track.property === 'position.x') object.position.x = value; else if (track.property === 'position.y') object.position.y = value; else if (track.property === 'position.z') object.position.z = value; else if (track.property === 'scale') object.scale.setScalar(value); else if (track.property === 'visible') object.visible = value >= .5; else if (track.property === 'opacity' && object instanceof THREE.Mesh) {(object.material as THREE.Material).transparent = value < 1; (object.material as THREE.Material).opacity = value;} else if (track.property.startsWith('rotation.')) object.rotation[track.property.at(-1) as 'x' | 'y' | 'z'] = value;}
function timelineObject(node: VisualNode, time: number): THREE.Object3D {const morph = store.project.timeline.tracks.find(track => track.targetId === node.id && track.property === 'path.points') as Extract<VisualTrack, {property: 'path.points'}> | undefined; let animated = node; const geometry = node.geometry; if (morph && geometry && (geometry.kind === 'stroke' || geometry.kind === 'curve' || geometry.kind === 'ribbon')) animated = {...node, geometry: {...geometry, points: evaluatePathTrack(morph, time)}}; const object = nodeMesh(animated); for (const track of store.project.timeline.tracks) if (track.targetId === node.id && track.property !== 'path.points') applyTrackAt(object, track, time); return object;}
function applyTimelinePreview(): void {
  for (const node of store.project.nodes) {const current = authored.children.find(child => child.userData.nodeId === node.id); if (!current) continue; const preview = timelineObject(node, playback.time); if (current instanceof THREE.Mesh && preview instanceof THREE.Mesh) {current.geometry.dispose(); current.geometry = preview.geometry; (preview.material as THREE.Material).dispose();} for (const track of store.project.timeline.tracks) if (track.targetId === node.id && track.property !== 'path.points') applyTrackAt(current, track, playback.time);}
  for (const child of [...onionGroup.children]) {onionGroup.remove(child); if (child instanceof THREE.Mesh) {child.geometry.dispose(); (child.material as THREE.Material).dispose();}}
  if (($('#onion-enabled') as HTMLInputElement).checked) {const opacity = Number(($('#onion-opacity') as HTMLInputElement).value) / 100; for (const time of [Math.max(0, playback.time - 1 / store.project.timeline.fps), Math.min(playback.duration, playback.time + 1 / store.project.timeline.fps)]) for (const node of store.project.nodes) {const ghost = timelineObject(node, time); if (ghost instanceof THREE.Mesh) {const material = (ghost.material as THREE.Material).clone(); material.transparent = true; material.opacity = opacity; material.depthWrite = false; ghost.material = material;} ghost.userData.onionTime = time; onionGroup.add(ghost);}}
}
const textureCanvas = $('#texture-canvas') as HTMLCanvasElement, textureContext = textureCanvas.getContext('2d')!;
function renderTexture(): void {textureCanvas.width = activeTexture.width; textureCanvas.height = activeTexture.height; textureContext.putImageData(new ImageData(new Uint8ClampedArray(decodeTexturePixels(activeTexture)), activeTexture.width, activeTexture.height), 0, 0);}
function saveTexture(): void {store.upsertTexture(activeTexture); renderTexture(); expose();}
$('#new-texture').onclick = () => {activeTexture = createTextureDocument({id: `mask-${++textureSerial}`, name: 'Máscara pintada'}); saveTexture();};
$('#clear-texture').onclick = () => {activeTexture = createTextureDocument({id: activeTexture.id, name: activeTexture.name, width: activeTexture.width, height: activeTexture.height, spriteSheet: activeTexture.spriteSheet}); saveTexture();};
let painting = false, textureSerial = store.project.textures?.length ?? 0;
const paintAt = (event: PointerEvent): void => {const bounds = textureCanvas.getBoundingClientRect(); activeTexture = paintTextureStroke(activeTexture, {x: (event.clientX - bounds.left) * activeTexture.width / bounds.width, y: (event.clientY - bounds.top) * activeTexture.height / bounds.height, radius: Number(($('#brush-size') as HTMLInputElement).value), color: ($('#brush-color') as HTMLInputElement).value, opacity: Number(($('#brush-opacity') as HTMLInputElement).value) / 100}); saveTexture();};
textureCanvas.onpointerdown = event => {painting = true; textureCanvas.setPointerCapture(event.pointerId); paintAt(event);}; textureCanvas.onpointermove = event => {if (painting) paintAt(event);}; textureCanvas.onpointerup = textureCanvas.onpointercancel = () => {painting = false;};
($('#import-texture') as HTMLInputElement).onchange = async event => {const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer()); if (file.type !== 'image/png' || ![137,80,78,71,13,10,26,10].every((value, index) => signature[index] === value)) {$('#status').textContent = 'Importação recusada: somente PNG válido'; return;} const bitmap = await createImageBitmap(file); if (bitmap.width > 1024 || bitmap.height > 1024) {$('#status').textContent = 'PNG excede 1024×1024'; return;} const scratch = document.createElement('canvas'); scratch.width = bitmap.width; scratch.height = bitmap.height; const context = scratch.getContext('2d')!; context.drawImage(bitmap, 0, 0); const bytes = context.getImageData(0, 0, bitmap.width, bitmap.height).data; let binary = ''; for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.slice(offset, offset + 0x8000)); activeTexture = {id: `png-${++textureSerial}`, name: file.name, width: bitmap.width, height: bitmap.height, rgbaBase64: btoa(binary)}; saveTexture();};
$('#apply-spritesheet').onclick = () => {const raw = Number(($('#sprite-fps') as HTMLInputElement).value), fps = ([24, 30, 60].includes(raw) ? raw : 24) as AuthoringFps; ($('#sprite-fps') as HTMLInputElement).value = String(fps); activeTexture = {...activeTexture, spriteSheet: {columns: Number(($('#sprite-columns') as HTMLInputElement).value), rows: Number(($('#sprite-rows') as HTMLInputElement).value), fps}}; saveTexture();};
function syncMaterial(): void {$('#material-nodes').innerHTML = materialGraph.nodes.map(node => `<li>${node.id} · ${node.type}</li>`).join(''); const checked = validateMaterialGraph(materialGraph, store.project.textures ?? [activeTexture]); $('#material-validation').textContent = checked.ok ? 'Grafo válido · receita determinística' : `Rejeitado: ${checked.issues[0].message}`;}
function applyMaterialPreview(): void {const recipe = compileMaterialRecipe(materialGraph, store.project.textures ?? [activeTexture]); const types = new Set(recipe.operations.map(operation => operation.type)); for (const object of authored.children) if (object instanceof THREE.Mesh) {const material = object.material as THREE.MeshStandardMaterial; material.color.set(recipe.color); material.roughness = types.has('noise') ? Math.min(1, recipe.roughness + .25) : recipe.roughness; material.metalness = recipe.metalness; material.opacity = types.has('dissolve') ? .55 : recipe.opacity; material.transparent = material.opacity < 1; if (types.has('fresnel')) {material.emissive.set(recipe.color); material.emissiveIntensity = .45;}}}
function buildMaterialPreset(type: string): MaterialGraph {const colorValue = ($('#material-color') as HTMLInputElement).value, output = {id: 'material-output', type: 'output' as const, params: {roughness: Number(($('#material-roughness') as HTMLInputElement).value), metalness: Number(($('#material-metalness') as HTMLInputElement).value)}}; const base = {id: 'material-color', type: 'color' as const, params: {color: colorValue}}; if (type === 'color') return {id: 'material-main', name: 'Cor', outputNodeId: output.id, nodes: [base, output], connections: [{fromNodeId: base.id, fromPort: 'color', toNodeId: output.id, toPort: 'color'}]}; if (type === 'gradient') {const gradient = {id: 'gradient-1', type: 'gradient' as const, params: {startColor: colorValue, endColor: '#ffffff'}}; return {id: 'material-main', name: 'Gradiente', outputNodeId: output.id, nodes: [gradient, output], connections: [{fromNodeId: gradient.id, fromPort: 'color', toNodeId: output.id, toPort: 'color'}]};} if (type === 'texture') {const texture = {id: 'texture-1', type: 'texture' as const, params: {textureId: activeTexture.id}}; return {id: 'material-main', name: 'Textura', outputNodeId: output.id, nodes: [texture, output], connections: [{fromNodeId: texture.id, fromPort: 'color', toNodeId: output.id, toPort: 'color'}]};} const scalar = {id: type === 'dissolve' ? 'noise-1' : `${type}-1`, type: (type === 'fresnel' ? 'fresnel' : 'noise') as 'fresnel' | 'noise', params: (type === 'fresnel' ? {power: 3} : {scale: 4}) as Record<string, string | number>}; if (type === 'dissolve') {const cut = {id: 'dissolve-1', type: 'dissolve' as const, params: {threshold: .45, edgeWidth: .08, edgeColor: '#ffcc55'}}; return {id: 'material-main', name: 'Dissolve', outputNodeId: output.id, nodes: [base, scalar, cut, output], connections: [{fromNodeId: base.id, fromPort: 'color', toNodeId: cut.id, toPort: 'source'}, {fromNodeId: scalar.id, fromPort: 'value', toNodeId: cut.id, toPort: 'mask'}, {fromNodeId: cut.id, fromPort: 'color', toNodeId: output.id, toPort: 'color'}]};} const multiply = {id: 'multiply-1', type: 'multiply' as const, params: {}}; return {id: 'material-main', name: type === 'fresnel' ? 'Fresnel' : 'Ruído', outputNodeId: output.id, nodes: [base, scalar, multiply, output], connections: [{fromNodeId: base.id, fromPort: 'color', toNodeId: multiply.id, toPort: 'a'}, {fromNodeId: scalar.id, fromPort: 'value', toNodeId: multiply.id, toPort: 'b'}, {fromNodeId: multiply.id, fromPort: 'color', toNodeId: output.id, toPort: 'color'}]};}
$('#apply-material').onclick = () => {const type = ($('#material-node-type') as HTMLSelectElement).value; if (type === 'texture' && !(store.project.textures ?? []).some(texture => texture.id === activeTexture.id)) saveTexture(); materialGraph = buildMaterialPreset(type); const checked = validateMaterialGraph(materialGraph, store.project.textures ?? [activeTexture]); if (!checked.ok) {syncMaterial(); return;} store.upsertMaterial(materialGraph); rebuild(); applyMaterialPreview(); syncMaterial(); expose();};
$('#add-material-node').textContent = 'Montar preset seguro'; $('#add-material-node').onclick = () => {materialGraph = buildMaterialPreset(($('#material-node-type') as HTMLSelectElement).value); syncMaterial();};
// ---- F3.1: emissores declarativos, telemetria e prévia determinística ----
let qualityProfile: QualityProfile = 'medium';
let emitterDraft: ParticleEmitter | null = null;
let activeEmitterId: string | null = (store.project.particles ?? [])[0]?.id ?? null;
let emitterSerial = (store.project.particles ?? []).length;
let draftRevision = -1;
let readoutFrame = 0;
type PreviewBackend = 'authoring' | 'quarks' | 'compare';
let previewBackend: PreviewBackend = 'authoring';
const particlePreview = new ParticlePreview(() => Math.min(devicePixelRatio, 2));
scene.add(particlePreview.group);
const quarksPreview = new QuarksParticlePreview(scene);
function applyPreviewBackend(): void {
  const compare = previewBackend === 'compare';
  particlePreview.group.visible = previewBackend !== 'quarks';
  quarksPreview.group.visible = previewBackend !== 'authoring';
  particlePreview.group.position.x = compare ? -1.25 : 0;
  quarksPreview.group.position.x = compare ? 1.25 : 0;
  if (previewBackend === 'authoring') quarksPreview.reset();
  refreshParticleReadout();
}

const particleOptions = (): {profile: QualityProfile; reduceMotion: boolean; noFlash: boolean} => ({profile: qualityProfile, reduceMotion: store.project.accessibility.reduceMotion, noFlash: store.project.accessibility.noFlash});
function currentEmitters(): ParticleEmitter[] {
  const list = store.project.particles ?? [];
  const draft = emitterDraft;
  return draft ? list.map(emitter => emitter.id === draft.id ? draft : emitter) : list;
}
const readPath = (source: unknown, path: string): number => path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], source) as number;
function writePath(target: object, path: string, value: number): void {
  const keys = path.split('.'); const last = keys.pop()!;
  const parent = keys.reduce<Record<string, unknown>>((node, key) => node[key] as Record<string, unknown>, target as Record<string, unknown>);
  parent[last] = value;
}
function fillEmitterForm(): void {
  const draft = emitterDraft;
  $('#emitter-form').hidden = !draft;
  $('#remove-emitter').toggleAttribute('disabled', !draft);
  if (!draft) return;
  for (const field of PARTICLE_FIELDS) {
    const value = String(readPath(draft, field.path));
    ($(`#${fieldId(field.path)}-range`) as HTMLInputElement).value = value;
    ($(`#${fieldId(field.path)}`) as HTMLInputElement).value = value;
  }
  ($('#emitter-enabled') as HTMLInputElement).checked = draft.enabled;
  ($('#emitter-name') as HTMLInputElement).value = draft.name;
  ($('#emitter-mode') as HTMLSelectElement).value = draft.emission.mode;
  ($('#emitter-shape') as HTMLSelectElement).value = draft.shape.kind;
  (['x', 'y', 'z'] as const).forEach((axis, index) => {
    ($(`#emitter-origin-${axis}`) as HTMLInputElement).value = String(draft.origin[index]);
    ($(`#emitter-gravity-${axis}`) as HTMLInputElement).value = String(draft.forces.gravity[index]);
  });
  ($('#emitter-color-start') as HTMLInputElement).value = draft.look.colorStart;
  ($('#emitter-color-end') as HTMLInputElement).value = draft.look.colorEnd;
  ($('#emitter-blending') as HTMLSelectElement).value = draft.look.blending;
  ($('#emitter-depth-write') as HTMLInputElement).checked = draft.look.depthWrite;
}
function updateDraftFromForm(): void {
  if (!emitterDraft) return;
  const draft = JSON.parse(JSON.stringify(emitterDraft)) as ParticleEmitter;
  for (const field of PARTICLE_FIELDS) {
    const value = Number(($(`#${fieldId(field.path)}`) as HTMLInputElement).value);
    if (Number.isFinite(value)) writePath(draft, field.path, value);
  }
  draft.name = ($('#emitter-name') as HTMLInputElement).value;
  draft.enabled = ($('#emitter-enabled') as HTMLInputElement).checked;
  draft.emission.mode = ($('#emitter-mode') as HTMLSelectElement).value as EmissionMode;
  draft.shape.kind = ($('#emitter-shape') as HTMLSelectElement).value as ParticleEmitter['shape']['kind'];
  const origin = (['x', 'y', 'z'] as const).map(axis => Number(($(`#emitter-origin-${axis}`) as HTMLInputElement).value));
  const gravity = (['x', 'y', 'z'] as const).map(axis => Number(($(`#emitter-gravity-${axis}`) as HTMLInputElement).value));
  if (origin.every(Number.isFinite)) draft.origin = origin as [number, number, number];
  if (gravity.every(Number.isFinite)) draft.forces.gravity = gravity as [number, number, number];
  draft.look.colorStart = ($('#emitter-color-start') as HTMLInputElement).value;
  draft.look.colorEnd = ($('#emitter-color-end') as HTMLInputElement).value;
  draft.look.blending = ($('#emitter-blending') as HTMLSelectElement).value as BlendMode;
  draft.look.depthWrite = ($('#emitter-depth-write') as HTMLInputElement).checked;
  emitterDraft = draft;
  refreshParticleReadout();
}
function refreshParticleReadout(): void {
  const emitters = currentEmitters();
  const budget = evaluateParticleBudget(emitters, qualityProfile, store.project.accessibility);
  const live = particlePreview.report;
  const quarks = quarksPreview.report;
  const plural = budget.cost.particles === 1 ? 'partícula' : 'partículas';
  const backendText = previewBackend === 'authoring'
    ? `Autoral: ${live.active} ${plural} · pico ${live.peakThisFrame} · ${live.drawCalls} draw call(s)`
    : previewBackend === 'quarks'
      ? `Quarks: ${quarks.active} ${plural} · ${quarks.systems} sistema(s) · ${quarks.drawCalls} draw call(s)${quarks.rejected ? ` · ${quarks.rejected} emissor rejeitado` : ''}`
      : `A/B — Autoral ${live.active} | Quarks ${quarks.active} · ${live.drawCalls + quarks.drawCalls} draw call(s)${quarks.rejected ? ` · ${quarks.rejected} emissor rejeitado` : ''}`;
  $('#particle-telemetry').textContent = emitters.length
    ? `${backendText} · pico estimado ${budget.peak}${quarks.approximations.length && previewBackend !== 'authoring' ? ` · aproximações: ${quarks.approximations.join(', ')}` : ''}`
    : 'Sem emissor. Adicione um para ver a telemetria.';
  const badge = $('#particle-budget');
  const over = budget.verdict.over;
  badge.className = `badge ${over.length ? 'warn' : 'ok'}`;
  badge.textContent = over.length
    ? `Orçamento ${qualityProfile}: ${budget.cost.particles}/${budget.verdict.limits.particles} ${plural} — excede ${over.join(', ')}`
    : `Orçamento ${qualityProfile}: ${budget.cost.particles}/${budget.verdict.limits.particles} ${plural} · ${budget.cost.drawCalls} draw call(s) · publicável`;
  if (budget.suppressed > 0) badge.textContent += ` · supressão visível: ${budget.suppressed} ${plural}`;
}
function syncParticlePanel(): void {
  const emitters = store.project.particles ?? [];
  const select = $('#emitter-select') as HTMLSelectElement;
  select.replaceChildren(...emitters.map(emitter => {const option = document.createElement('option'); option.value = emitter.id; option.textContent = `${emitter.name} · ${emitter.id}`; return option;}));
  if (!emitters.some(emitter => emitter.id === activeEmitterId)) activeEmitterId = emitters[0]?.id ?? null;
  const source = emitters.find(emitter => emitter.id === activeEmitterId) ?? null;
  if (!source) {emitterDraft = null; draftRevision = store.project.revision;}
  else if (!emitterDraft || emitterDraft.id !== source.id || draftRevision !== store.project.revision) {emitterDraft = JSON.parse(JSON.stringify(source)) as ParticleEmitter; draftRevision = store.project.revision;}
  select.value = activeEmitterId ?? '';
  ($('#access-reduce-motion') as HTMLInputElement).checked = store.project.accessibility.reduceMotion;
  ($('#access-no-flash') as HTMLInputElement).checked = store.project.accessibility.noFlash;
  fillEmitterForm();
  refreshParticleReadout();
}
$('#add-emitter').onclick = () => {
  if ((store.project.particles ?? []).length >= 12) {$('#status').textContent = 'Limite de 12 emissores atingido'; return;}
  const id = `emissor-${++emitterSerial}`;
  const emitter = defaultEmitter(id);
  emitter.seed = 1337 + emitterSerial * 7;
  store.upsertEmitter(emitter);
  activeEmitterId = id; draftRevision = -1;
  rebuild();
  $('#status').textContent = `Emissor criado: ${id}`;
};
$('#remove-emitter').onclick = () => {
  if (!activeEmitterId) return;
  const id = activeEmitterId;
  try {store.removeEmitter(id);} catch (error) {$('#status').textContent = `Remoção recusada: ${error instanceof Error ? error.message : 'erro'}`; return;}
  activeEmitterId = null; draftRevision = -1;
  rebuild();
  $('#status').textContent = `Emissor removido: ${id}`;
};
($('#emitter-select') as HTMLSelectElement).onchange = () => {activeEmitterId = ($('#emitter-select') as HTMLSelectElement).value || null; draftRevision = -1; syncParticlePanel();};
$('#apply-emitter').onclick = () => {
  if (!emitterDraft) return;
  try {store.upsertEmitter(emitterDraft); draftRevision = -1; rebuild(); $('#status').textContent = `Emissor aplicado: ${emitterDraft.id}`;}
  catch (error) {$('#status').textContent = `Emissor recusado: ${error instanceof Error ? error.message : 'inválido'}`;}
};
$('#reset-emitter-peak').onclick = () => {particlePreview.resetPeak(); refreshParticleReadout();};
($('#quality-profile') as HTMLSelectElement).onchange = () => {qualityProfile = ($('#quality-profile') as HTMLSelectElement).value as QualityProfile; refreshParticleReadout();};
($('#particle-preview-backend') as HTMLSelectElement).onchange = () => {previewBackend = ($('#particle-preview-backend') as HTMLSelectElement).value as PreviewBackend; applyPreviewBackend(); expose();};
($('#access-reduce-motion') as HTMLInputElement).onchange = event => {store.setAccessibility({reduceMotion: (event.target as HTMLInputElement).checked}); rebuild();};
($('#access-no-flash') as HTMLInputElement).onchange = event => {store.setAccessibility({noFlash: (event.target as HTMLInputElement).checked}); rebuild();};
for (const field of PARTICLE_FIELDS) {
  const range = $(`#${fieldId(field.path)}-range`) as HTMLInputElement;
  const number = $(`#${fieldId(field.path)}`) as HTMLInputElement;
  range.oninput = () => {number.value = range.value; updateDraftFromForm();};
  number.oninput = () => {
    const value = Number(number.value);
    if (Number.isFinite(value)) range.value = String(Math.min(Number(number.max), Math.max(Number(number.min), value)));
    updateDraftFromForm();
  };
}
for (const id of ['#emitter-enabled', '#emitter-name', '#emitter-mode', '#emitter-shape', '#emitter-color-start', '#emitter-color-end', '#emitter-blending', '#emitter-depth-write', '#emitter-origin-x', '#emitter-origin-y', '#emitter-origin-z', '#emitter-gravity-x', '#emitter-gravity-y', '#emitter-gravity-z']) ($(id) as HTMLInputElement).addEventListener('input', updateDraftFromForm);

applyPreviewBackend();
renderTexture(); syncMaterial(); syncTimeline();
$('#add-keyframe').insertAdjacentHTML('afterend', '<button id="add-morph-keyframe">+ Morph do caminho</button>');
$('#add-morph-keyframe').onclick = () => {const node = selected(); const geometry = node?.geometry; if (!node || !geometry || geometry.kind === 'box' || geometry.kind === 'sphere' || geometry.kind === 'plane') {$('#status').textContent = 'Selecione um Stroke, Curva ou Ribbon'; return;} const id = `track-${node.id}-path-points`; const existing = store.project.timeline.tracks.find(track => track.id === id && track.property === 'path.points') as Extract<VisualTrack, {property: 'path.points'}> | undefined; const keyframes = [...(existing?.keyframes ?? []).filter(frame => Math.abs(frame.time - playback.time) > 1e-6), {time: playback.time, value: geometry.points, interpolation: 'linear' as const}].sort((a, b) => a.time - b.time); store.upsertTrack({id, targetId: node.id, property: 'path.points', keyframes}); rebuild();};
const resize = () => {const {clientWidth: width, clientHeight: height} = viewport; camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix(); renderer.setSize(width, height, false);};
new ResizeObserver(resize).observe(viewport); resize(); syncAuthoringFields(); updateDrawingPlane();
let previousFrame = performance.now(); renderer.setAnimationLoop(now => {const delta = Math.min(.1, (now - previousFrame) / 1000); previousFrame = now; if (playback.playing) {playback = advancePlayback(playback, delta); syncTimeline();} applyTimelinePreview(); const emitters = currentEmitters(), options = particleOptions(); particlePreview.update(previewBackend === 'quarks' ? [] : emitters, playback.time, options); quarksPreview.update(previewBackend === 'authoring' ? [] : emitters, playback.time, options); if ((readoutFrame++ % 6) === 0) refreshParticleReadout(); controls.update(); renderer.render(scene, camera);});
rebuild(); $('#status').textContent = 'Projeto local · autosave por revisão';
