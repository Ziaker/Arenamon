// Prévia 3D miniatura do lutador na Seleção Rápida do menu: renderizador three.js separado, com o modelo
// CLONADO a partir do Character carregado (geometria compartilhada, materiais próprios e esqueleto independente),
// animação de “parado” em loop e giro lento. Respeita “movimento reduzido” (vfx.master.reduceMotion):
// sem giro, só a animação. Sem WebGL, o canvas some e sobra o nome do personagem.
//
// O apoio no chão é recalculado A CADA QUADRO com a mesma curva do jogo (`Character.groundAtFrame`), e não
// com a pose de repouso: clipes como o “idle” do Wookada têm o ponto mais baixo bem acima do bind pose, o
// que fazia o modelo flutuar sobre o disco. O buffer de desenho acompanha o tamanho real do canvas (×2 de
// supersampling), então a prévia não fica borrada quando o CSS a estica. Disco e sombra de contato
// acompanham a largura do modelo para o personagem parecer apoiado, mesmo com escala 2×.
import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {C} from '../sim/config.js';
import {tintColor} from '../view/character-colors.js';

let W0 = 230, H0 = 170;   // tamanho padrão da prévia do menu atual; as telas A/B/C pedem outro por `resize`

/** Sombra de contato: gradiente radial em canvas (barato e sem shadow map). */
function shadowTexture() {
  const c = document.createElement('canvas');c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) return null;
  const grd = g.createRadialGradient(64, 64, 3, 64, 64, 63);
  grd.addColorStop(0, 'rgba(0,0,0,.62)');grd.addColorStop(.55, 'rgba(0,0,0,.3)');grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;g.fillRect(0, 0, 128, 128);
  const tex = new T.CanvasTexture(c);tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

export function createMenuPreview(canvas, {tint = null} = {}) {
  let renderer = null, scene = null, camera = null, W = W0, H = H0;
  let holder = null, obj = null, mixer = null, action = null, source = null, idleIdx = -1;
  let disc = null, ring = null, shadow = null;
  let tintHex = tint || null;   // cor do lutador (hex) aplicada só nos materiais DESTA prévia
  let modelH = 1.2;
  const size = new T.Vector3(1, 1, 1), look = new T.Vector3(0, .6, 0);
  const tickHooks = new Set();   // ganchos por quadro (feedback three.quarks das telas A/B/C)
  try {
    renderer = new T.WebGLRenderer({canvas, antialias: true, alpha: true});
    // Canvas pequeno: desenhar em 2× e reduzir no CSS custa quase nada e mantém o modelo nítido.
    renderer.setPixelRatio(2);
    renderer.setSize(W, H, false);
  } catch {
    canvas.style.display = 'none';   // WebGL indisponível: a prévia some, o nome do personagem continua
    renderer = null;
  }
  if (renderer) {
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(32, W / H, .05, 100);
    // Luz parecida com a da arena (hemisférica forte + uma direcional), mas vinda da frente para o rosto e o
    // relevo do modelo aparecerem. Materiais metálicos (Wookada) só respondem a luz direta: nada de ambiente
    // com PMREM, que deixava o modelo branco e chapado.
    scene.add(new T.HemisphereLight(0xffffff, 0x65707b, 2));
    const key = new T.DirectionalLight(0xffffff, 2.2);key.position.set(4, 10, 7);scene.add(key);
    const fill = new T.DirectionalLight(0x88aaff, .35);fill.position.set(-4, 3, -5);scene.add(fill);
    // Base do personagem: disco macio + aro discreto para o “chão” ficar legível em qualquer escala.
    disc = new T.Mesh(new T.CircleGeometry(1, 56), new T.MeshBasicMaterial({color: 0x9fc4e8, transparent: true, opacity: .14, depthWrite: false}));
    disc.rotation.x = -Math.PI / 2;disc.renderOrder = -1;scene.add(disc);
    ring = new T.Mesh(new T.RingGeometry(.94, 1, 64), new T.MeshBasicMaterial({color: 0x9fc4e8, transparent: true, opacity: .34, depthWrite: false}));
    ring.rotation.x = -Math.PI / 2;ring.position.y = .001;ring.renderOrder = -1;scene.add(ring);
    const st = shadowTexture();
    if (st) {
      shadow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({map: st, transparent: true, depthWrite: false, opacity: .85, toneMapped: false}));
      shadow.rotation.x = -Math.PI / 2;shadow.position.y = .004;shadow.renderOrder = -1;scene.add(shadow);
    }
  }
  const reduceMotion = () => !!(C.vfx?.master?.reduceMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches));

  /** Deslocamento vertical que apoia o ponto mais baixo da pose atual no disco (mesma conta do `place` do jogo). */
  function groundY(time) {
    if (!obj || !source || idleIdx < 0) return 0;
    const g = source.groundAtFrame ? source.groundAtFrame(idleIdx, time) : source.restMinY;
    return -g * obj.scale.y;
  }

  /** Enquadramento que sempre cabe inteiro (altura, largura e disco), inclusive com o Wookada em 2×. */
  function frameCamera() {
    if (!camera) return;
    const vfov = camera.fov * Math.PI / 180, tanV = Math.tan(vfov / 2), tanH = tanV * Math.max(.3, camera.aspect);
    // Margem vertical maior porque a câmera olha de cima e o disco se abre para o primeiro plano.
    const distV = (size.y * .5) / tanV * 1.32, distW = Math.max(size.x, size.z) * .5 / tanH * 1.12;
    const dist = Math.max(distV, distW, .9) + size.y * .06;
    look.set(0, Math.max(.32, size.y * .5), 0);
    const dir = new T.Vector3(.45, .34, .85).normalize().multiplyScalar(dist);
    camera.position.set(dir.x, look.y + dir.y, dir.z);
    camera.lookAt(look);
    camera.near = Math.max(.02, dist * .01);camera.far = Math.max(20, dist * 12);
    camera.updateProjectionMatrix();
  }

  /** Disco, aro e sombra acompanham a largura do modelo (senão o 2× do Wookada “vaza” da base). */
  function fitGround() {
    const r = Math.max(.34, Math.max(size.x, size.z) * .5);
    if (disc) disc.scale.setScalar(r);
    if (ring) ring.scale.setScalar(r);
    if (shadow) shadow.scale.set(r * 1.24, r * .92, 1);
  }

  function applySize(w, h) {
    if (!renderer || !(w > 8 && h > 8)) return;
    if (w === W && h === H) return;
    W = Math.round(w);H = Math.round(h);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    frameCamera();
  }
  /** Usa o tamanho real do canvas no layout; `w`/`h` explícitos ficam só como reserva (canvas oculto). */
  function resize(w, h) {
    if (!renderer) return;
    const cw = Math.round(canvas.clientWidth || 0), chh = Math.round(canvas.clientHeight || 0);
    if (cw > 8 && chh > 8) applySize(cw, chh);
    else applySize(w || W, h || H);
  }
  if (renderer && typeof ResizeObserver === 'function') {
    try {new ResizeObserver(() => resize()).observe(canvas);} catch { /* sem observador: o tick confere o tamanho */ }
  }

  /** Aplica a cor escolhida só nos materiais DESTA prévia (o personagem do jogo pode estar tingido com outra). */
  function applyTint() {
    if (!obj) return;
    obj.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const paint = m => {if (m?.color) m.color.copy(tintColor(m.userData?.baseColor, tintHex, !!m.map));return m;};
      o.material = Array.isArray(o.material) ? o.material.map(paint) : paint(o.material);
    });
  }
  /** Troca a cor do lutador na prévia (`null` devolve a cor original do modelo). */
  function setTint(hex) {
    tintHex = hex || null;
    applyTint();
  }

  /** Troca o personagem exibido. `ch` é a instância Character do lutador (ou null para esvaziar). */
  function setCharacter(ch) {
    if (!renderer) return;
    if (holder) {scene.remove(holder);holder = null;}
    obj = null;mixer = null;action = null;source = null;idleIdx = -1;
    if (!ch?.root) {modelH = 1.2;size.set(1, 1.2, 1);fitGround();frameCamera();return;}
    source = ch;
    obj = clone(ch.root);
    obj.rotation.set(0, 0, 0);obj.position.set(0, 0, 0);
    // Materiais próprios da prévia: o Character em partida e a prévia compartilham o material do GLB, então
    // tingir a prévia mudaria o jogo (e vice-versa). A cor original vem de `userData.baseColor` quando o
    // personagem do jogo já está tingido.
    obj.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const own = m => {
        if (!m?.color) return m;
        const c = m.clone();
        c.userData = {...(c.userData || {}), previewColor: true, baseColor: m.userData?.baseColor ?? m.color.getHex()};
        return c;
      };
      o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
    });
    applyTint();
    // O giro lento fica no agrupador, com o modelo centrado na origem: ele roda no lugar em vez de orbitar.
    holder = new T.Group();holder.add(obj);scene.add(holder);
    // Toca o “idle” ANTES de medir: a pose animada é a que precisa tocar o disco.
    const idx = ch.variantsOf?.('idle')?.[0] ?? ch.clips.findIndex(c => /idle|parado/i.test(c.name));
    idleIdx = Number.isInteger(idx) && idx >= 0 ? idx : -1;
    if (idleIdx >= 0) {
      mixer = new T.AnimationMixer(obj);
      action = mixer.clipAction(ch.clips[idleIdx]);
      action.play();
      mixer.update(0);
    }
    obj.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(obj), center = box.getCenter(new T.Vector3());
    box.getSize(size);
    modelH = Math.max(1e-3, size.y);
    // Garante a curva de apoio do clipe já no primeiro quadro (o jogo a pré-calcula no carregamento); sem
    // isso, o modelo apareceria alto por um instante e depois “cairia” para o disco.
    if (idleIdx >= 0 && typeof source.groundCurve === 'function') {try {source.groundCurve(idleIdx);} catch { /* usa restMinY */ }}
    // Centraliza no eixo vertical e apoia o ponto mais baixo da pose no disco (y = 0).
    obj.position.set(-center.x, groundY(action?.time ?? 0), -center.z);
    fitGround();frameCamera();
  }

  function tick(dt) {
    if (!renderer) return;
    if (typeof ResizeObserver !== 'function') resize();
    if (mixer) mixer.update(dt);
    if (obj) {
      // Reapoia a cada quadro: o clipe muda o ponto mais baixo da malha o tempo todo.
      obj.position.y = groundY(action?.time ?? 0);
      if (holder && !reduceMotion()) holder.rotation.y += dt * .6;
    }
    for (const fn of [...tickHooks]) {try {fn(dt);} catch (e) {tickHooks.delete(fn);console.error('menu-preview: gancho de tick removido após falha', e);}}
    renderer.render(scene, camera);
  }
  return {setCharacter, setTint, tick, resize, onTick: fn => {tickHooks.add(fn);return () => tickHooks.delete(fn);}, canvas, get scene() {return scene;}, get camera() {return camera;}, get renderer() {return renderer;}, get ok() {return !!renderer;}, get hasModel() {return !!obj;}, get modelHeight() {return modelH;}, get tint() {return tintHex;}};
}
