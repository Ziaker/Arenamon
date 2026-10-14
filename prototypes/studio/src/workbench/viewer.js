// Camada visual da Workbench no visualizador 3D do Studio: esqueleto sobreposto, eixos do osso selecionado, simetria,
// heatmap REAL de pesos (atributos skinIndex/skinWeight), vértices sem influência, esqueleto proposto (antes/depois)
// e seleção de ossos por clique. Só desenha dados recebidos da telemetria; não calcula indicadores próprios.
import * as T from 'three';

const COLORS = {bone: 0x6ec3ff, selected: 0xffd34d, warning: 0xff5d6c, modified: 0xff9a3d, ghost: 0xff9a3d, symmetry: 0x9aa7b8, unweighted: 0xff3355};

export function createWorkbenchViewer({importer = () => window.__importer, onPick = () => {}} = {}) {
  const E = () => importer(), group = new T.Group();group.name = 'workbench-overlay';group.renderOrder = 950;
  const S = {telemetry: null, selected: null, after: null, modified: new Set(), options: {skeleton: true, axes: true, symmetry: false, heatmap: false, problems: true, ghost: true, original: true},
    spheres: new Map(), heat: new Map(), attached: false};
  const material = (color, opacity = 1) => new T.MeshBasicMaterial({color, transparent: opacity < 1, opacity, depthTest: false, depthWrite: false});
  const lineMaterial = (color, opacity = .9) => new T.LineBasicMaterial({color, transparent: true, opacity, depthTest: false});
  const toWorld = p => E().model.localToWorld(new T.Vector3(...p));
  function clear() {for (const o of [...group.children]) {group.remove(o);o.traverse(x => {x.geometry?.dispose();if (x.material && !x.material.userData.shared) x.material.dispose();});}S.spheres.clear();}
  function ensureAttached() {if (!S.attached && E()?.scene) {E().scene.add(group);S.attached = true;}}
  function radius() {const s = S.telemetry?.model.bounds.size || [1, 1, 1];return Math.max(.004, Math.hypot(...s) * .011);}
  function skeleton(joints, color, opacity, pickable) {
    const pts = [], byName = new Map(joints.map(j => [j.name, j]));
    for (const j of joints) if (j.parent && byName.get(j.parent)) pts.push(toWorld(byName.get(j.parent).p), toWorld(j.p));
    const lines = new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), lineMaterial(color, opacity));lines.renderOrder = 951;group.add(lines);
    const geo = new T.SphereGeometry(radius(), 12, 8);
    for (const j of joints) {
      const c = j.id === S.selected ? COLORS.selected : S.modified.has(j.id) && pickable ? COLORS.modified : j.warnings?.length && pickable ? COLORS.warning : color;
      const m = new T.Mesh(geo, material(c, opacity));m.position.copy(toWorld(j.p));m.renderOrder = 952;m.userData.jointId = j.id;
      if (j.id === S.selected && pickable) m.scale.setScalar(1.6);
      group.add(m);if (pickable) S.spheres.set(j.id, m);
    }
  }
  function render() {
    ensureAttached();clear();const t = S.telemetry;if (!t || !E()?.model) return;
    E().model.updateMatrixWorld(true);
    if (S.options.skeleton && S.options.original) skeleton(t.joints, COLORS.bone, S.after && S.options.ghost ? .45 : 1, true);
    if (S.after && S.options.ghost) skeleton(S.after.joints, COLORS.ghost, 1, false);
    const sel = t.joints.find(j => j.id === S.selected);
    if (sel && S.options.axes) {
      // Eixos de orientação: matriz mundial real do osso (rig vinculado) ou rotação do rascunho na raiz.
      const axes = new T.AxesHelper(radius() * 7);axes.material.depthTest = false;axes.renderOrder = 953;
      const bone = sel.uuid ? E().model.getObjectByProperty('uuid', sel.uuid) : null;
      if (bone) {bone.updateMatrixWorld(true);bone.matrixWorld.decompose(axes.position, axes.quaternion, axes.scale);axes.scale.setScalar(1);}
      else {axes.position.copy(toWorld(sel.p));axes.quaternion.copy(E().model.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion(...sel.q)));}
      group.add(axes);
    }
    if (S.options.symmetry) {
      const pts = [];
      for (const j of t.joints) if (j.symmetry && j.name.startsWith('Left')) {const pair = t.joints.find(x => x.id === j.symmetry.pair);if (pair) pts.push(toWorld(j.p), toWorld(pair.p));}
      const l = new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), lineMaterial(COLORS.symmetry, .7));l.renderOrder = 951;group.add(l);
    }
    if (S.options.problems) {
      // Vértices sem influência (amostra informada pela telemetria, por malha).
      const pts = [];
      for (const m of t.meshes) {
        const mesh = m.uuid && E().model.getObjectByProperty('uuid', m.uuid);if (!mesh || !m.unweightedVertexSample?.length) continue;
        const pos = mesh.geometry.getAttribute('position');mesh.updateMatrixWorld(true);
        for (const i of m.unweightedVertexSample) pts.push(new T.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
      }
      if (pts.length) {const p = new T.Points(new T.BufferGeometry().setFromPoints(pts), new T.PointsMaterial({color: COLORS.unweighted, size: radius() * 1.4, depthTest: false}));p.renderOrder = 954;group.add(p);}
    }
    applyHeatmap();
  }
  /** Heatmap real: peso do osso selecionado em cada vértice (preto 0 → vermelho → amarelo 1). Materiais originais restaurados. */
  function applyHeatmap() {
    const want = S.options.heatmap && S.selected && S.telemetry?.model.state === 'vinculado';
    E().model?.traverse(o => {
      if (!o.isSkinnedMesh || !o.skeleton) return;
      if (!want) {const h = S.heat.get(o);if (h) {o.material = h.material;o.geometry.deleteAttribute('color');if (h.color) o.geometry.setAttribute('color', h.color);S.heat.delete(o);}return;}
      const sel = S.telemetry.joints.find(j => j.id === S.selected), index = o.skeleton.bones.findIndex(b => b.uuid === sel?.uuid);
      if (!S.heat.has(o)) S.heat.set(o, {material: o.material, color: o.geometry.getAttribute('color') || null});
      const ids = o.geometry.getAttribute('skinIndex'), ws = o.geometry.getAttribute('skinWeight'), n = o.geometry.getAttribute('position').count, c = new Float32Array(n * 3);
      for (let v = 0; v < n; v++) {
        let w = 0;if (index >= 0) for (let k = 0; k < 4; k++) if (ids.getComponent(v, k) === index) w += ws.getComponent(v, k);
        c[v * 3] = Math.min(1, w * 2);c[v * 3 + 1] = Math.max(0, w * 2 - 1);c[v * 3 + 2] = w > 0 ? .08 : .22;
      }
      o.geometry.setAttribute('color', new T.BufferAttribute(c, 3));
      if (!(o.material?.userData?.workbenchHeat)) {const m = new T.MeshBasicMaterial({vertexColors: true});m.userData.workbenchHeat = true;o.material = m;}
    });
  }
  // Seleção por clique (sem arrastar) nos marcadores das articulações.
  let down = null;const ray = new T.Raycaster(), ndc = new T.Vector2();
  function onDown(e) {down = [e.clientX, e.clientY];}
  function onUp(e) {
    if (!down || !S.spheres.size) return;const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]);down = null;if (moved > 5) return;
    const canvas = E().renderer.domElement, r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);ray.setFromCamera(ndc, E().camera);
    const hit = ray.intersectObjects([...S.spheres.values()], false)[0];if (hit) onPick(hit.object.userData.jointId);
  }
  let listening = false;
  function setActive(on) {
    ensureAttached();group.visible = on;const canvas = E()?.renderer?.domElement;if (!canvas) return;
    if (on && !listening) {canvas.addEventListener('pointerdown', onDown);canvas.addEventListener('pointerup', onUp);listening = true;}
    if (!on && listening) {canvas.removeEventListener('pointerdown', onDown);canvas.removeEventListener('pointerup', onUp);listening = false;}
    if (!on) {const keep = S.options.heatmap;S.options.heatmap = false;applyHeatmap();S.options.heatmap = keep;}
    else render();
  }
  /** Coordenada de tela de uma articulação (para testes de clique reais e foco). */
  function screenPoint(id) {
    const m = S.spheres.get(id);if (!m) return null;const p = m.getWorldPosition(new T.Vector3()).project(E().camera), r = E().renderer.domElement.getBoundingClientRect();
    return {x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height};
  }
  return {
    group, setActive, render, screenPoint,
    setTelemetry(t) {S.telemetry = t;render();},
    setSelected(id) {S.selected = id;render();},
    setComparison(after, modifiedIds = []) {S.after = after;S.modified = new Set(modifiedIds);render();},
    setOption(key, value) {S.options[key] = value;render();},
    get options() {return {...S.options};}, get heatmapActive() {return S.heat.size > 0;}, get markerIds() {return [...S.spheres.keys()];},
  };
}
