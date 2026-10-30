// Viewport 3D PRÓPRIA do Editor de animações: cena THREE independente (scene, PerspectiveCamera, luz hemisférica +
// direcional, renderer WebGL com canvas próprio e grade de chão) e um personagem de prévia que é uma instância REAL da
// classe Character (view/characters.js) criada com persist:false a partir do MESMO source do lutador — o construtor já
// clona a cena via SkeletonUtils.clone e cria um mixer próprio. O lutador da arena NUNCA é tocado por aqui.
//
// Fidelidade de pipeline: o personagem de prévia é atualizado por Character.update() com um lutador-dummy mínimo
// (parado, sem ação, sem voo) e o ramo `p` de blend(): trims/laço por resolveField, os 15 controles de loopagem por
// loopScheduleOf/scheduleClipTime, a emenda por applyLoopSeam e Reverso pelo espelhamento do tempo — o MESMO código que
// o jogo executa. persist:false garante que nada é gravado (localStorage/stateStore): a prévia não polui save/telemetria.
//
// O módulo tem duas camadas: createPreviewCharacter (pura, sem DOM — testável em Node) e createAnimationPreview
// (câmera, luzes, renderer e laço de renderização com rAF próprio, pausado quando oculto; 1 quadro por frame).
import * as T from 'three';
import {Character} from './characters.js';
import {C} from '../sim/config.js';

/** Quadro de referência do transporte (avançar/voltar 1 quadro e régua do seek). */
export const PREVIEW_FRAME = 1 / 30;

/** Lutador-dummy mínimo para o ramo de prévia de Character.update(): parado no chão, sem ação, sem voo, sem defesa.
 * O ramo `p` de blend() isola a prévia de quase toda a física; estes campos cobrem place()/applyRigLayers()/updateSquash. */
export function previewFighter() {
  return {id: -1, hp: 10, state: 'neutral', flight: null, ledge: null, wallSplat: false, action: null, charge: null,
    tackleCharge: null, guard: false, moveRecovery: 0, hitSerial: 0, __preview: true,
    position: {x: 0, y: 0, z: 0}, velocity: {x: 0, z: 0}, facing: 0, visualFacing: 0, faceGoal: 0,
    attributes: {speed: 3}, groundY: 0, sprinting: false, locoPhase: null, aim: null};
}

/**
 * Núcleo puro da prévia (sem DOM): um Character persist:false + estado de transporte (play/pause/seek/quadro/laço).
 * Os campos do perfil são lidos a cada quadro por blend(), então syncFrom() aplica edições AO VIVO sem reiniciar o clipe.
 * @param {object} source mesmo source do lutador (source.scene + animations, como em loadStudioFile)
 */
export function createPreviewCharacter(source) {
  const character = new Character(source, {persist: false});
  character.warmGround = () => {};   // sem pré-cálculo em segundo plano: a prévia calcula o apoio sob demanda
  if (character.warmTimer) clearTimeout(character.warmTimer);
  const fighter = previewFighter();
  const st = {index: null, action: null, loop: true, paused: false, seek: 0, started: false};
  const clampT = t => Math.min(character.clips[st.index]?.duration || 0, Math.max(0, t));
  const restart = () => {
    if (st.index == null || !character.clips[st.index]) return;
    character.startPreview(st.index, {action: st.action, loop: st.loop, paused: st.paused, seek: st.seek});
  };
  const api = {
    character, fighter, persist: false,
    /** Índice do clipe carregado (null = nenhum). */
    clipIndex: () => st.index,
    duration: () => st.index == null ? 0 : character.clips[st.index]?.duration || 0,
    /** Tempo de clipe exibido: pausado, o transporte (st.seek) é a fonte — a action só reflete o seek no próximo update. */
    time: () => st.paused ? st.seek : (character.preview && character.current?.action ? character.current.action.time : 0),
    playing: () => !!(character.preview && !character.preview.paused),
    /** Carrega o clipe configurado da ação e (re)inicia a prévia com as opções do transporte. */
    load(index, {action = null, loop = true, paused = false, seek = 0} = {}) {
      if (!Number.isInteger(index) || !character.clips[index]) {st.index = null;character.stopPreview();return false;}
      st.index = index;st.action = action;st.loop = !!loop;st.paused = !!paused;st.seek = clampT(seek);st.started = true;
      restart();return true;
    },
    /** Tocar: reproduz do início (mesma semântica do botão «Tocar» do editor no modo arena). */
    play() {st.paused = false;st.seek = 0;st.started = true;restart();},
    /** Pausar no instante atual (o tempo congela; seek/quadro funcionam). */
    pause() {st.seek = api.time();st.paused = true;restart();},
    /** Parar a prévia: o personagem volta a tocar o idle neutro do próprio perfil (viewport segue viva). */
    stop() {st.paused = false;st.started = false;character.stopPreview();},
    /** Ir para um instante (s) do clipe, pausado. */
    seekTo(seconds) {if (st.index == null) return;st.paused = true;st.seek = clampT(seconds);st.started = true;restart();},
    /** Avançar/voltar n quadros de 1/30 s (pausado). */
    stepFrames(n = 1) {api.seekTo(api.time() + n * PREVIEW_FRAME);},
    setLoop(loop) {st.loop = !!loop;if (character.preview) restart();},
    /** Copia do lutador da arena TODO o estado que afeta a reprodução (perfil, velocidades, variantes, clipes
     * importados, travas e escala). Campos novos valem no quadro seguinte; clipes importados são anexados. */
    syncFrom(c) {
      if (c.clips.length > character.clips.length) {
        for (let i = character.clips.length; i < c.clips.length; i++) {character.clips.push(c.clips[i]);character.clipInfo.push({...c.clipInfo[i]});}
      }
      character.animProfile = JSON.parse(JSON.stringify(c.animProfile));
      character.variants = JSON.parse(JSON.stringify(c.variants));
      character.speeds = {...c.speeds};
      character.playback = JSON.parse(JSON.stringify(c.playback));
      character.clipOffsets = {...c.clipOffsets};
      character.moveAnims = JSON.parse(JSON.stringify(c.moveAnims));
      character.lockRootMotion = c.lockRootMotion;character.lockToGround = c.lockToGround;
      character.autoGround = c.autoGround;character.visualOffset = c.visualOffset;
      character.heightScale = c.heightScale;character.widthScale = c.widthScale;
      character.freeVerticalMotion = [...(c.freeVerticalMotion || [])];
      return api;
    },
    /** Avança o relógio da prévia em dt segundos (1 quadro por chamada; quem controla a cadência é o laço de render). */
    step(dt) {character.update(fighter, dt, 0, [], {source: 'prévia', occluded: false, ground: () => fighter.groundY, fighters: []});},
    dispose() {character.dispose();},
  };
  return api;
}

/**
 * Viewport 3D do editor: cena, câmera, luzes, renderer com canvas próprio e laço de renderização (rAF próprio,
 * pausado quando oculto; apenas 1 quadro por frame). Se o WebGL falhar, `available` fica false e o editor oferece o
 * fallback explícito (prévia na arena).
 * @param {{mount: HTMLElement, rendererFactory?: (() => object) | null, maxDt?: number}} opts
 */
export function createAnimationPreview({mount, rendererFactory = null, maxDt = .1}) {
  const scene = new T.Scene();
  scene.background = new T.Color(0x141a22);
  const camera = new T.PerspectiveCamera(38, 1, .05, 120);
  scene.add(new T.HemisphereLight(0xffffff, 0x55606c, 1.05));
  const key = new T.DirectionalLight(0xffffff, 1.6);
  key.position.set(2.4, 4.2, 3.2);
  scene.add(key);
  const rim = new T.DirectionalLight(0x9fc4ff, .7);
  rim.position.set(-2.6, 2.4, -3);
  scene.add(rim);
  const grid = new T.GridHelper(8, 16, 0x2e4a63, 0x1d2c3c);
  scene.add(grid);

  let renderer = null, glFailed = false, width = 0, height = 0;
  const ensureRenderer = () => {
    if (renderer || glFailed || !mount) return renderer;
    try {
      renderer = rendererFactory ? rendererFactory() : new T.WebGLRenderer({antialias: true, alpha: false});
      renderer.setPixelRatio?.(Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2));
      mount.appendChild(renderer.domElement);
    } catch {glFailed = true;renderer = null;}
    return renderer;
  };
  const resize = () => {
    if (!renderer || !mount) return;
    const w = mount.clientWidth || 0, h = mount.clientHeight || 0;
    if (w > 0 && h > 0 && (w !== width || h !== height)) {
      width = w;height = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;camera.updateProjectionMatrix();
    }
  };

  let pc = null, pcSource = null, active = false, rafId = 0, last = 0, frames = 0;
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : cb => setTimeout(() => cb(Date.now()), 16);
  const caf = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout;
  /** Enquadra a câmera pela caixa do modelo (altura com o ajuste visual de escala já aplicado por place()). */
  const frameCamera = () => {
    if (!pc) return;
    pc.step(0);
    const box = new T.Box3().setFromObject(pc.character.root);
    const size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
    const radius = Math.max(.4, size.x, size.y, size.z) * .62;
    camera.position.set(center.x + radius * 1.15, center.y + radius * .5, center.z + radius * 1.55);
    camera.lookAt(center.x, center.y + size.y * .06, center.z);
  };
  const attach = source => {
    if (pc) {scene.remove(pc.character.root);pc.dispose();}
    pc = createPreviewCharacter(source);pcSource = source;
    scene.add(pc.character.root);
    frameCamera();
  };
  const tick = now => {
    if (!active) return;
    const dt = Math.min(maxDt, Math.max(0, (now - last) / 1000));last = now;
    if (pc && dt > 0) pc.step(dt);
    if (renderer) {resize();renderer.render(scene, camera);frames++;if (frames % 30 === 1 && renderer.domElement.dataset) renderer.domElement.dataset.vpFrames = String(frames);}
    rafId = raf(tick);
  };
  const api = {
    /** WebGL disponível? (quando false, o editor deve oferecer o fallback da arena) */
    get available() {return !!ensureRenderer();},
    /** Personagem de prévia atual (para as hitboxes visuais e testes); null antes da primeira carga. */
    character: () => pc?.character ?? null,
    source: () => pcSource,
    frames: () => frames,
    /** Garante que a viewport está espelhando o lutador (modelo + perfil), sem iniciar a prévia. */
    ensure(c) {if (!ensureRenderer() || !c) return false;if (pcSource !== c.source) attach(c.source);pc.syncFrom(c);return true;},
    /** Carrega o clipe configurado e inicia a prévia com as opções do transporte. */
    loadFrom(c, index, opts = {}) {if (!api.ensure(c)) return false;pc.load(index, opts);return true;},
    /** Aplica ao vivo as edições de perfil feitas no editor (campos lidos a cada quadro por blend()). */
    syncFrom(c) {if (pc && c && pcSource === c.source) pc.syncFrom(c);},
    show() {if (active || !ensureRenderer()) return;active = true;last = performance?.now?.() ?? Date.now();rafId = raf(tick);},
    hide() {active = false;if (rafId) caf(rafId);rafId = 0;},
    get active() {return active;},
    play() {pc?.play();}, pause() {pc?.pause();}, stop() {pc?.stop();},
    seekTo(t) {pc?.seekTo(t);}, stepFrames(n) {pc?.stepFrames(n);}, setLoop(b) {pc?.setLoop(b);},
    time: () => pc?.time() ?? 0,
    duration: () => pc?.duration() ?? 0,
    playing: () => !!pc?.playing(),
    /** Renderiza um quadro e lê os pixels (prova de renderização real; usado pelo teste de navegador). */
    sample() {
      if (!ensureRenderer() || !pc) return null;
      resize();renderer.render(scene, camera);
      const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const buf = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const colors = new Set();
      for (let i = 0; i < buf.length; i += 64) colors.add((buf[i] << 16) | (buf[i + 1] << 8) | buf[i + 2]);
      return {width: w, height: h, distinctColors: colors.size};
    },
    dispose() {api.hide();if (pc) {scene.remove(pc.character.root);pc.dispose();pc = null;pcSource = null;}renderer?.dispose?.();if (renderer?.domElement?.parentNode === mount) mount.removeChild(renderer.domElement);renderer = null;},
  };
  return api;
}
