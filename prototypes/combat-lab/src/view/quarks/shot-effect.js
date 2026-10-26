// @ts-check
// Efeitos de disparo SELECIONÁVEIS do Ateliê Elemental — módulo reutilizável.
//
// Dois efeitos independentes, escolhidos por `shotEffect`:
//   'ring'  Argola: anéis que saem da origem do disparo e avançam no eixo do trajeto.
//   'cone'  Tiro em cone: jato de partículas com direção (horizontal/vertical),
//           abertura, impulsos com sinal e atraso.
//   'none'  Desligado.
//
// Os valores de cada efeito vivem em `settings.shotRing` e `settings.shotCone`,
// então trocar de efeito nunca apaga os ajustes do outro. Nada aqui decide regra
// de jogo: é só desenho. Respeita `noFlash` e `reduced` do preview.
//
// Uso (hoje só o Seed Bomb):
//   const shot = new ShotEffect(fx);          // fx = ElementalPreview
//   shot.start(settings.shotEffect, settings);
//   shot.update(t);                            // a cada quadro
//   shot.diagnostics();                        // testes
// Para reaproveitar em Water Pulse/Air Slash basta chamar start/update com os
// mesmos settings; nenhum nome de Move está fixado neste arquivo.

import * as T from 'three';
import * as Q from 'three.quarks';
import {presetToSystemParams} from './adapter.js';

/** Anéis do disparo: geometria única (raio 1) reutilizada por todas as argolas. */
function ringGeometry(thickness) {
  const g = new T.TorusGeometry(1, Math.max(.004, thickness), 10, 72);
  g.rotateY(Math.PI / 2);   // o anel passa a ficar perpendicular ao eixo X (o trajeto)
  return g;
}

const deg = d => d * Math.PI / 180;

/** Direção unitária a partir dos ângulos horizontais/verticais (0° = +X, o trajeto). */
function coneDirection(h, v) {
  return new T.Vector3(Math.cos(v) * Math.cos(h), Math.sin(v), Math.cos(v) * Math.sin(h));
}

export class ShotEffect {
  /** @param {any} fx ElementalPreview (fornece root, materiais, partículas e acessibilidade) */
  constructor(fx) {
    this.fx = fx;
    this.group = new T.Group();
    fx.root.add(this.group);
    this.effect = 'none';
    /** @type {any} */
    this.p = null;
    /** @type {T.Mesh[]} */
    this.rings = [];
    /** @type {any} */
    this.cone = null;
    /** @type {T.BufferGeometry | null} */
    this.geo = null;
    this.origin = new T.Vector3();
    this.anchorWorld = null;
    this.localAnchor = new T.Vector3();
    this.emitterAnchor = new T.Vector3();
    this.spawned = false;
  }

  /**
   * Cria o efeito escolhido na origem do disparo.
   * @param {string} effect 'none' | 'ring' | 'cone'
   * @param {any} settings parâmetros do Move (com shotRing/shotCone)
   */
  start(effect, settings) {
    this.effect = effect === 'ring' || effect === 'cone' ? effect : 'none';
    this.p = settings;
    this.anchorWorld = null;
    this.origin.copy(this.fx.core.position);
    this.group.position.copy(this.origin);
    if (this.effect === 'ring') this.buildRings();
  }

  buildRings() {
    const p = this.p, r = p.shotRing, fx = this.fx;
    this.geo = ringGeometry(r.ringThickness);
    const count = Math.max(1, Math.round(r.ringCount));
    for (let i = 0; i < count; i++) {
      const color = new T.Color(r.ringColor).multiplyScalar(r.ringBrightness);
      const mat = new T.MeshBasicMaterial({
        color, transparent: true, opacity: r.ringOpacity, depthWrite: false,
        side: T.DoubleSide, blending: fx.noFlash ? T.NormalBlending : T.AdditiveBlending,
      });
      fx.materials.push(mat);
      const mesh = new T.Mesh(this.geo, mat);
      mesh.rotation.z = deg(r.ringTilt);
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push(mesh);
    }
  }

  buildCone() {
    const c = this.p.shotCone, fx = this.fx;
    const life = Math.max(.05, this.p.life * c.coneLife);
    // Comprimento vira velocidade; os impulsos entram como vetor somado.
    const base = coneDirection(deg(c.coneAngleH), deg(c.coneAngleV));
    const motion = fx.reduced ? .2 : 1;
    const vel = base.clone().multiplyScalar(c.coneLength / life)
      .add(new T.Vector3(c.coneImpulseH, c.coneImpulseV, 0).multiplyScalar(motion));
    const speed = Math.max(.02, vel.length());
    const dir = vel.lengthSq() > 1e-6 ? vel.clone().normalize() : base;
    const emission = Math.max(.02, c.coneDuration);
    const count = Math.max(1, Math.round(c.coneCount * (fx.reduced ? .6 : 1)));
    const tint = new T.Color(c.coneColor).multiplyScalar(c.coneBrightness);
    const preset = {
      duration: emission,
      looping: false,
      worldSpace: true,
      shape: {type: 'cone', radius: c.coneRadius, angle: c.coneSpread, dir: {x: dir.x, y: dir.y, z: dir.z}},
      startLife: [life * .7, life],
      startSpeed: [speed * (1 - .3 * c.coneDispersion), speed * (1 + .3 * c.coneDispersion)],
      startSize: [this.p.particleSize * .5 * c.coneSize, this.p.particleSize * c.coneSize],
      startColor: {a: '#ffffff', b: '#ffffff'},
      emissionOverTime: count / emission,
      sizeOverLife: [.4, 1, .7, 0],
      colorOverLife: {stops: [
        {t: 0, color: tint, alpha: 0},
        {t: .12, color: tint, alpha: Math.min(1, this.p.brightness)},
        {t: .7, color: tint, alpha: .6},
        {t: 1, color: tint, alpha: 0},
      ]},
      gravity: c.coneGravity ? -c.coneGravity : 0,
    };
    const params = presetToSystemParams(preset, /** @type {any} */ ({Quarks: Q, THREE: T, material: fx.sprite('leaf', '#ffffff')}));
    params.startColor = new Q.ConstantColor(new Q.Vector4(this.p.brightness, this.p.brightness, this.p.brightness, 1));
    const system = new Q.ParticleSystem(params);
    this.group.updateWorldMatrix(true, false);
    this.group.getWorldPosition(this.emitterAnchor);
    system.emitter.position.copy(this.fx.scene.worldToLocal(this.emitterAnchor));
    // Nesta versão do three.quarks o ConeEmitter emite no +Z local e ignora
    // `direction`; giramos o emissor para o +Z apontar na direção calculada.
    system.emitter.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), dir);
    fx.scene.add(system.emitter);
    fx.batch.addSystem(system);
    fx.systems.push(system);
    this.cone = system;
    this.coneSpeed = speed;
    this.coneDir = dir;
    this.coneTint = tint;
    this.spawned = true;
  }

  /**
   * Atualiza o efeito. `t` é o tempo desde o disparo (segundos).
   * @param {number} t
   */
  update(t) {
    if (this.effect === 'none' || !this.p) return;
    const followTime = Math.max(0, this.p.shotFollowTime ?? .3);
    if (t >= followTime) {
      if (!this.anchorWorld) {this.group.updateWorldMatrix(true, false);this.anchorWorld = this.group.getWorldPosition(new T.Vector3());}
      this.localAnchor.copy(this.anchorWorld);
      this.fx.root.worldToLocal(this.localAnchor);
      this.group.position.copy(this.localAnchor);
    }
    if (this.cone && t < followTime) {
      this.group.updateWorldMatrix(true, false);
      this.group.getWorldPosition(this.emitterAnchor);
      this.cone.emitter.position.copy(this.fx.scene.worldToLocal(this.emitterAnchor));
    }
    const motion = this.fx.reduced ? .2 : 1;
    if (this.effect === 'ring') {
      const r = this.p.shotRing;
      for (let i = 0; i < this.rings.length; i++) {
        const mesh = this.rings[i];
        const age = t - i * r.ringInterval;
        const alive = age >= 0 && age < r.ringDuration;
        mesh.visible = alive;
        if (!alive) continue;
        const grow = Math.max(.01, 1 + age * r.ringExpansion * motion);
        const fadeIn = r.ringFadeIn > 0 ? Math.min(1, age / r.ringFadeIn) : 1;
        mesh.scale.set(r.ringSquash, r.ringRadius * grow, r.ringRadius * grow);
        mesh.position.set(r.ringHorizontal + r.ringImpulse * age * motion, r.ringVertical, 0);
        /** @type {any} */ (mesh.material).opacity = r.ringOpacity * fadeIn * Math.max(0, 1 - age / r.ringDuration);
      }
    } else if (this.effect === 'cone') {
      // O atraso é respeitado criando o sistema só quando ele termina.
      if (!this.spawned && t >= this.p.shotCone.coneDelay) this.buildCone();
    }
  }

  diagnostics() {
    const visible = this.rings.filter(m => m.visible);
    const first = visible[0];
    const cone = this.cone;
    /** @type {number | null} */
    let dx = null;
    /** @type {number | null} */
    let dy = null;
    if (cone && cone.particleNum > 0) {
      let sx = 0, sy = 0;
      const n = cone.particleNum;
      for (let i = 0; i < n; i++) { sx += cone.particles[i].position.x; sy += cone.particles[i].position.y; }
      dx = sx / n - cone.emitter.position.x;
      dy = sy / n - cone.emitter.position.y;
    }
    const p0 = cone && cone.particleNum > 0 ? cone.particles[0] : null;
    return {
      shotEffect: this.effect,
      shotConeSpeed: this.coneSpeed ?? null,
      shotConeDir: this.coneDir ? [this.coneDir.x, this.coneDir.y, this.coneDir.z] : null,
      shotConeSample: p0 ? {x: p0.position.x, y: p0.position.y, vx: p0.velocity?.x, vy: p0.velocity?.y} : null,
      shotRingCount: this.rings.length,
      shotRingVisible: visible.length,
      shotRingX: first ? first.position.x : null,
      shotRingY: first ? first.position.y : null,
      shotRingScaleX: first ? first.scale.x : null,
      shotRingScaleY: first ? first.scale.y : null,
      shotRingOpacity: first ? /** @type {any} */ (first.material).opacity : null,
      shotRingColor: first ? [/** @type {any} */ (first.material).color.r, /** @type {any} */ (first.material).color.g, /** @type {any} */ (first.material).color.b] : null,
      shotConeTint: this.coneTint ? [this.coneTint.r, this.coneTint.g, this.coneTint.b] : null,
      shotConeParticles: cone ? cone.particleNum : 0,
      shotConeDx: dx,
      shotConeDy: dy,
    };
  }
}
