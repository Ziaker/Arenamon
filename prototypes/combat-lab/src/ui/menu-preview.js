// Prévia 3D miniatura do lutador na Seleção Rápida do menu: renderizador three.js separado, com o modelo
// CLONADO a partir do Character carregado (geometrias/materiais compartilhados, esqueleto independente),
// animação de “parado” em loop e giro lento. Respeita “movimento reduzido” (vfx.master.reduceMotion):
// sem giro, só a animação. Sem WebGL, o canvas some e sobra o nome do personagem.
import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {C} from '../sim/config.js';

let W0 = 230, H0 = 170;   // tamanho padrão da prévia do menu atual; as telas A/B/C pedem outro por `resize`

export function createMenuPreview(canvas, {tint = null} = {}) {
  let renderer = null, scene = null, camera = null, W = W0, H = H0;
  let obj = null, mixer = null, modelH = 1.2;
  const tickHooks = new Set();   // ganchos por quadro (feedback three.quarks das telas A/B/C)
  try {
    renderer = new T.WebGLRenderer({canvas, antialias: true, alpha: true});
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
  } catch {
    canvas.style.display = 'none';   // WebGL indisponível: a prévia some, o nome do personagem continua
    renderer = null;
  }
  if (renderer) {
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(32, W / H, .05, 100);
    scene.add(new T.HemisphereLight(0xdfeaff, 0x27313d, 1.15));
    const key = new T.DirectionalLight(0xffffff, 1.6);key.position.set(2, 3, 2.5);scene.add(key);
    const fill = new T.DirectionalLight(0x88aaff, .5);fill.position.set(-2, 1, -2);scene.add(fill);
    const disc = new T.Mesh(new T.CircleGeometry(1.15, 40), new T.MeshBasicMaterial({color: 0x9fc4e8, transparent: true, opacity: .1}));
    disc.rotation.x = -Math.PI / 2;scene.add(disc);
  }
  const reduceMotion = () => !!(C.vfx?.master?.reduceMotion);

  /** Troca o personagem exibido. `ch` é a instância Character do lutador (ou null para esvaziar). */
  function setCharacter(ch) {
    if (!renderer) return;
    if (obj) {scene.remove(obj);obj = null;}
    mixer = null;
    if (!ch?.root) return;
    obj = clone(ch.root);
    obj.rotation.set(0, 0, 0);obj.position.set(0, 0, 0);
    if (tint) obj.traverse(o => {if (o.isMesh) {const mats = [].concat(o.material).map(m => {const c = m.clone();c.color?.lerp(new T.Color(tint), .35);return c;});o.material = Array.isArray(o.material) ? mats : mats[0];}});
    scene.add(obj);
    obj.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(obj), size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
    // apoia no disco e centraliza horizontalmente
    obj.position.set(-center.x, -box.min.y, -center.z);
    modelH = size.y;
    const maxDim = Math.max(size.x, size.y, size.z, .4);
    const dist = maxDim * 2.1;
    camera.position.set(dist * .5, size.y * .72 + dist * .18, dist * .82);
    camera.lookAt(0, size.y * .52, 0);
    const idx = ch.variantsOf?.('idle')?.[0] ?? ch.clips.findIndex(c => /idle|parado/i.test(c.name));
    mixer = new T.AnimationMixer(obj);
    if (idx >= 0) mixer.clipAction(ch.clips[idx]).play();
  }
  function tick(dt) {
    if (!renderer) return;
    if (mixer) mixer.update(dt);
    if (obj && !reduceMotion()) obj.rotation.y += dt * .6;
    for (const fn of tickHooks) fn(dt);
    renderer.render(scene, camera);
  }
  /** Muda o tamanho de desenho (px CSS) mantendo a proporção da câmera. */
  function resize(w, h) {
    if (!renderer || (w === W && h === H)) return;
    W = w;H = h;renderer.setSize(W, H, false);camera.aspect = W / H;camera.updateProjectionMatrix();
  }
  return {setCharacter, tick, resize, onTick: fn => {tickHooks.add(fn);return () => tickHooks.delete(fn);}, canvas, get scene() {return scene;}, get camera() {return camera;}, get ok() {return !!renderer;}, get hasModel() {return !!obj;}, get modelHeight() {return modelH;}};
}
