import * as T from 'three';
import {C} from '../sim/config.js';

export const PASSIVE_ABILITIES = [
  {name: 'Órbita', duration: .5},
  {name: 'Prisma', duration: .5},
  {name: 'Ressonância', duration: .5},
];

const SPARKLE_COUNT = 28;

class FighterPassive {
  constructor(scene, id) {
    this.id = id;this.root = new T.Group();this.root.name = `passive-ability-${id}`;scene.add(this.root);
    this.age = 0;this.kind = -1;this.active = false;
    this.sparkles = new T.Group();this.sparkles.name = 'white-sparkles';this.root.add(this.sparkles);
    this.geometry = new T.OctahedronGeometry(.045, 0);
    this.material = new T.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending});
    this.particles = Array.from({length: SPARKLE_COUNT}, (_, i) => {
      const mesh = new T.Mesh(this.geometry, this.material);
      mesh.userData.phase = i / SPARKLE_COUNT * Math.PI * 2;
      mesh.userData.radius = .48 + (i % 4) * .16;
      mesh.userData.height = .12 + (i % 7) / 6 * 1.45;
      mesh.userData.delay = (i % 5) * .018;
      this.sparkles.add(mesh);return mesh;
    });
    this.light = new T.PointLight(0xffffff, 0, 4.5);this.light.position.y = .85;this.root.add(this.light);
    this.reset();
  }
  reset() {
    this.age = 0;this.kind = -1;this.active = false;this.sparkles.visible = false;this.material.opacity = 0;this.light.intensity = 0;
    for (const particle of this.particles) particle.visible = false;
  }
  activate(kind) {
    this.reset();this.kind = Math.max(0, Math.min(2, kind | 0));this.active = true;this.sparkles.visible = true;
    for (const particle of this.particles) particle.visible = true;
  }
  place(f, character) {
    const alt = (f.flight?.y ?? f.groundY ?? 0) + (f.vaultHeight ?? 0), base = character?.groundOffset ?? C.display.grounding.visualOffset;
    this.root.position.set(f.position.x, alt + base, f.position.z);this.root.rotation.y = f.visualFacing ?? f.facing ?? 0;
  }
  update(f, character, dt, visible) {
    this.place(f, character);this.root.visible = !!visible && f.hp > 0;
    if (!this.active || dt <= 0) return;
    this.age += dt;const duration = .5, k = Math.min(1, this.age / duration), fade = Math.sin(Math.PI * k);
    this.material.opacity = .95 * Math.max(0, fade);this.light.intensity = 1.35 * Math.max(0, fade);
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i], local = Math.max(0, (this.age - particle.userData.delay) / (duration - particle.userData.delay));
      const a = particle.userData.phase + local * (.55 + (i % 3) * .18), radius = particle.userData.radius + local * .18;
      particle.position.set(Math.cos(a) * radius, particle.userData.height + Math.sin(local * Math.PI) * .1, Math.sin(a) * radius);
      particle.rotation.set(a * 1.7, a * .8, this.age * 7 + i);particle.scale.setScalar(Math.max(.02, Math.sin(Math.PI * Math.min(1, local))) * (i % 3 === 0 ? 1.35 : .9));
    }
    if (k >= 1) this.reset();
  }
  dispose(scene) {scene.remove(this.root);this.geometry.dispose();this.material.dispose();this.light.dispose?.();}
}

export class PassiveAbilitySystem {
  constructor(scene, {notify = () => {}} = {}) {this.scene = scene;this.notify = notify;this.fighters = [new FighterPassive(scene, 0), new FighterPassive(scene, 1)];this.started = false;}
  reset() {this.started = false;for (const f of this.fighters) f.reset();}
  activate(id, kind) {const fx = this.fighters[id];if (!fx || !C.display.passive.enabled) return;fx.activate(kind);this.notify(id, PASSIVE_ABILITIES[fx.kind].name);}
  update(fighters, dt, {characters = [], visible = true} = {}) {
    if (!this.started && C.display.passive.enabled) {this.started = true;this.activate(0, C.display.passive.playerAbility);this.activate(1, C.display.passive.enemyAbility);}
    for (const f of fighters) this.fighters[f.id]?.update(f, characters[f.id], dt, visible && !!C.display.passive.enabled);
  }
  dispose() {for (const f of this.fighters) f.dispose(this.scene);}
}
