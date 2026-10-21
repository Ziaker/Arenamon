// @ts-check
// Fase 4 (postprocessing pmndrs, SEM React): pipeline cinematográfico sobre o MESMO renderer/cena/câmera do Arenamon.
// Ligar/desligar não toca no renderer atual: desligado, quem chama usa renderer.render() como sempre e nada é criado.
// Biblioteca injetada (PP) para o mesmo módulo servir ao jogo e ao laboratório e para evitar import duplicado.
//
// Cadeia (cada passe só existe se o efeito estiver ligado; reconstruída quando o conjunto muda):
//   RenderPass → [Distorção (ShockWave)] → [Profundidade de campo] → [Bloom limiar|seleção] → [Aberração + Vinheta + Grading]
// HUD, letterbox, speedlines e impact-frame são camadas DOM: ficam por cima do canvas e não são afetadas.
import {effectiveParams, PostPulses, bloomNow, chromaNow} from './post-params.js';

export class PostPipeline {
  /** @param {{THREE:any, PP:any, renderer:any, scene:any, camera:any, params:any, accessibility?:any}} o */
  constructor({THREE, PP, renderer, scene, camera, params, accessibility = null}) {
    this.T = THREE;this.PP = PP;this.renderer = renderer;this.scene = scene;this.camera = camera;
    this.params = params;this.a11y = accessibility;this.pulses = new PostPulses();
    this.composer = null;this.fx = {};this.signature = '';this.selection = new Set();this.dofTarget = null;this.dofActive = false;
    this.stats = {renderMs: 0, passes: 0, effects: [], frames: 0};
    this.shockActive = 0;this.size = {w: 0, h: 0};
  }
  /** Parâmetros efetivos (acessibilidade aplicada). */
  eff() {return effectiveParams(this.params, typeof this.a11y === 'function' ? this.a11y() : (this.a11y ?? {}));}
  /** Quais efeitos devem existir agora. */
  plan(E) {
    const dof = !!E.dofOn && (!E.dofKoOnly || this.dofActive);
    return {shock: !!E.distortOn, dof, bloom: !!E.bloomOn, chroma: !!E.chromaOn, vig: !!E.vignetteOn, grade: !!E.gradeOn, bloomMode: E.bloomMode | 0};
  }
  signatureOf(p) {return `${+p.shock}${+p.dof}${+p.bloom}${+p.chroma}${+p.vig}${+p.grade}${p.bloomMode}`;}
  /** (Re)constrói a cadeia de passes só quando o conjunto de efeitos muda. */
  rebuild(plan) {
    const {PP, T} = this;
    this.disposePasses();
    const composer = this.composer ??= new PP.EffectComposer(this.renderer, {frameBufferType: T.HalfFloatType});
    composer.addPass(new PP.RenderPass(this.scene, this.camera));
    const fx = this.fx = {}, add = (...effects) => composer.addPass(new PP.EffectPass(this.camera, ...effects));
    if (plan.shock) {
      fx.shock = new PP.ShockWaveEffect(this.camera, new T.Vector3(), {speed: 1.4, maxRadius: .5, waveSize: .3, amplitude: .04});
      add(fx.shock);
    }
    if (plan.dof) {
      fx.dof = new PP.DepthOfFieldEffect(this.camera, {bokehScale: 2.5, worldFocusRange: 6});
      if (this.dofTarget) fx.dof.target = this.dofTarget;
      add(fx.dof);
    }
    if (plan.bloom) {
      const opts = {mipmapBlur: true, intensity: 1, luminanceThreshold: .8, luminanceSmoothing: .25, radius: .7};
      if (plan.bloomMode === 1) {
        fx.bloom = new PP.SelectiveBloomEffect(this.scene, this.camera, opts);
        for (const o of this.selection) fx.bloom.selection.add(o);
      } else fx.bloom = new PP.BloomEffect(opts);
      add(fx.bloom);
    }
    const last = [];
    if (plan.grade) {
      fx.hue = new PP.HueSaturationEffect({hue: 0, saturation: 0});
      fx.bc = new PP.BrightnessContrastEffect({brightness: 0, contrast: 0});
      last.push(fx.hue, fx.bc);
    }
    if (plan.vig) {fx.vignette = new PP.VignetteEffect({darkness: .4, offset: .3});last.push(fx.vignette);}
    if (plan.chroma) {fx.chroma = new PP.ChromaticAberrationEffect({offset: new T.Vector2(.0008, .0008), radialModulation: true, modulationOffset: .35});last.push(fx.chroma);}
    if (last.length) add(...last);   // últimos efeitos juntos em UM passe (grading, vinheta, aberração)
    this.signature = this.signatureOf(plan);
    if (this.size.w) composer.setSize(this.size.w, this.size.h, false);
    this.stats.passes = composer.passes.length;
    this.stats.effects = Object.keys(fx);
  }
  disposePasses() {
    if (!this.composer) return;
    for (const p of [...this.composer.passes]) {this.composer.removePass(p);p.dispose?.();}
    for (const e of Object.values(this.fx)) e.dispose?.();
    this.fx = {};
  }
  /** Aplica valores correntes (inclui pulsos) nos efeitos existentes. */
  apply(E) {
    const {fx} = this, T = this.T;
    if (fx.bloom) {
      fx.bloom.intensity = bloomNow(E, this.pulses);
      fx.bloom.luminanceMaterial.threshold = E.bloomThreshold;fx.bloom.luminanceMaterial.smoothing = E.bloomSmoothing;
      if (fx.bloom.mipmapBlurPass) fx.bloom.mipmapBlurPass.radius = E.bloomRadius;
    }
    if (fx.chroma) {const c = chromaNow(E, this.pulses);fx.chroma.offset.set(c, c);}
    if (fx.vignette) {fx.vignette.darkness = E.vignetteOn ? E.vignetteDarkness : 0;fx.vignette.offset = E.vignetteOffset;}
    if (fx.hue) {fx.hue.saturation = E.gradeOn ? E.gradeSaturation : 0;fx.hue.hue = E.gradeOn ? E.gradeHue * Math.PI / 180 : 0;}
    if (fx.bc) {fx.bc.contrast = E.gradeOn ? E.gradeContrast : 0;fx.bc.brightness = E.gradeOn ? E.gradeBrightness : 0;}
    if (fx.shock) {fx.shock.amplitude = .04 * E.distortStrength;fx.shock.waveSize = E.distortSize;}
    if (fx.dof) fx.dof.bokehScale = E.dofBokeh;
    void T;
  }
  setSize(w, h) {this.size = {w, h};this.composer?.setSize(w, h, false);}
  /** Registra um objeto no bloom por seleção (modo 1). */
  select(obj) {this.selection.add(obj);this.fx.bloom?.selection?.add?.(obj);}
  deselect(obj) {this.selection.delete(obj);this.fx.bloom?.selection?.delete?.(obj);}
  trigger(kind, strength) {this.pulses.trigger(kind, strength);}
  /** Onda de choque na posição de mundo (só se distorção ligada e sem reduzir movimento). */
  shock(pos, strength = 1) {
    const s = this.fx.shock;
    if (!s || strength <= 0) return;
    s.position.set(pos.x, pos.y, pos.z);s.explode();this.shockActive = 1;
  }
  /** Foco da profundidade de campo (K.O./cinemático). null desliga o alvo. */
  setDof(active, target = null) {
    this.dofActive = !!active;
    if (target) {this.dofTarget ??= new this.T.Vector3();this.dofTarget.set(target.x, target.y, target.z);if (this.fx.dof) this.fx.dof.target = this.dofTarget;}
  }
  /** Renderiza o quadro pelo pipeline. Devolve false (e não desenha nada) se não houver efeito: quem chama usa o renderer direto. */
  render(dt) {
    const E = this.eff(), plan = this.plan(E);
    if (!(plan.shock || plan.dof || plan.bloom || plan.chroma || plan.vig || plan.grade)) {
      if (this.signature) {this.disposePasses();this.signature = '';this.stats.effects = [];this.stats.passes = 0;}   // sem efeitos: libera os passes
      return false;
    }
    if (this.signatureOf(plan) !== this.signature || !this.composer) this.rebuild(plan);
    this.pulses.tick(dt);
    this.apply(E);
    const t0 = performance.now();
    this.composer.render(Math.max(dt, 1e-4));
    this.stats.renderMs = performance.now() - t0;this.stats.frames++;
    return true;
  }
  dispose() {
    this.disposePasses();
    this.composer?.dispose();this.composer = null;
  }
}
