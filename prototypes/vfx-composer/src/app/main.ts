import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {DocumentStore} from '../editor/document-store';
import {AutosaveManager} from '../editor/autosave';
import type {AuthoringSettings, VfxProject, VisualNode} from '../core/types';
import {createAssistedPaths, createPathGeometry} from '../editor/geometry';
import {openProjectText, saveProjectFile} from '../editor/file-io';

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

let recovered = initialProject();
try {
  const saved = localStorage.getItem('arenamon.vfx.composer-local');
  if (saved) recovered = JSON.parse(saved) as VfxProject;
} catch { /* file:// pode negar storage; o editor continua em memória */ }
const store = new DocumentStore(recovered);
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
function expose(): void {(window as unknown as {__ARENAMON_VFX_COMPOSER__: unknown}).__ARENAMON_VFX_COMPOSER__ = {ready: true, get project() {return store.project;}, get selectedIds() {return [...selectedIds];}, get transformAttached() {return transformControls.object !== undefined;}, get drawing() {return drawing;}, get selectedBoundsCenter() {const object = authored.children.find(child => child.userData.nodeId === selectedId); return object ? new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).toArray() : null;}, nodeScreenPoint(id: string) {const object = authored.children.find(child => child.userData.nodeId === id); if (!object) return null; const point = object.position.clone().project(camera), bounds = renderer.domElement.getBoundingClientRect(); return [bounds.left + (point.x + 1) * bounds.width / 2, bounds.top + (1 - point.y) * bounds.height / 2];}};}

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
const resize = () => {const {clientWidth: width, clientHeight: height} = viewport; camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix(); renderer.setSize(width, height, false);};
new ResizeObserver(resize).observe(viewport); resize(); syncAuthoringFields(); updateDrawingPlane();
renderer.setAnimationLoop(() => {controls.update(); renderer.render(scene, camera);});
rebuild(); $('#status').textContent = 'Projeto local · autosave por revisão';
