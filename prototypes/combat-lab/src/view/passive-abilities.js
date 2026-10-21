import * as T from 'three';
import {C} from '../sim/config.js';

export const PASSIVE_ABILITIES = [
  {name: 'Órbita', color: 0x4fc3f7, accent: 0xffffff, duration: 3.5},
  {name: 'Prisma', color: 0xffd54f, accent: 0xff8a65, duration: 2.8},
  {name: 'Ressonância', color: 0xe040fb, accent: 0x7c4dff, duration: 2.5},
];

const mat = (color, emissive = color) => new T.MeshStandardMaterial({
  color, emissive, emissiveIntensity: .8, roughness: .35, metalness: .12,
  transparent: true, opacity: 0, depthWrite: false, flatShading: true,
});

class FighterPassive {
  constructor(scene, id) {
    this.id = id;this.root = new T.Group();this.root.name = `passive-ability-${id}`;scene.add(this.root);
    this.age = 0;this.kind = -1;this.active = false;
    this.orbit = new T.Group();this.prism = new T.Group();this.resonance = new T.Group();this.root.add(this.orbit, this.prism, this.resonance);
    const orbGeo = new T.IcosahedronGeometry(.07, 0), shardGeo = new T.OctahedronGeometry(.065, 0);
    this.orbs = Array.from({length: 24}, (_, i) => {
      const mesh = new T.Mesh(i % 3 ? orbGeo : shardGeo, mat(i % 2 ? 0xffffff : 0x4fc3f7));mesh.userData.phase = i / 24 * Math.PI * 2;this.orbit.add(mesh);return mesh;
    });
    const beamGeo = new T.CylinderGeometry(.025, .025, 2.5, 6);
    this.beams = Array.from({length: 6}, (_, i) => {
      const mesh = new T.Mesh(beamGeo, mat(i % 2 ? 0xff8a65 : 0xffd54f));mesh.rotation.z = Math.PI / 3 + i * Math.PI / 10;mesh.rotation.x = i * Math.PI / 6;this.prism.add(mesh);return mesh;
    });
    const starGeo = new T.OctahedronGeometry(.055, 1);
    this.stars = Array.from({length: 12}, (_, i) => {
      const mesh = new T.Mesh(starGeo, mat(i % 2 ? 0xff8a65 : 0xffd54f));mesh.userData.phase = i / 12 * Math.PI * 2;this.prism.add(mesh);return mesh;
    });
    this.rings = Array.from({length: 4}, (_, i) => {
      const geo = new T.TorusGeometry(1, .045, 6, 36);geo.rotateX(Math.PI / 2);const mesh = new T.Mesh(geo, mat(i % 2 ? 0x7c4dff : 0xe040fb));mesh.userData.delay = i * .18;this.resonance.add(mesh);return mesh;
    });
    this.core = new T.Mesh(new T.OctahedronGeometry(.18, 1), mat(0x7c4dff));this.core.position.y = .75;this.resonance.add(this.core);
    this.light = new T.PointLight(0xffffff, 0, 7);this.light.position.y = 1.15;this.root.add(this.light);
    this.reset();
  }
  reset() {this.age = 0;this.kind = -1;this.active = false;this.orbit.visible = this.prism.visible = this.resonance.visible = false;this.light.intensity = 0;}
  activate(kind) {
    this.reset();this.kind = Math.max(0, Math.min(2, kind | 0));this.active = true;this.age = 0;
    this.orbit.visible = this.kind === 0;this.prism.visible = this.kind === 1;this.resonance.visible = this.kind === 2;
    const def = PASSIVE_ABILITIES[this.kind];this.light.color.setHex(def.color);this.light.intensity = 2.6;
  }
  place(f, character) {
    const alt = (f.flight?.y ?? 0) + (f.vaultHeight ?? 0), base = character?.groundOffset ?? C.display.grounding.visualOffset;
    this.root.position.set(f.position.x, alt + base, f.position.z);this.root.rotation.y = f.visualFacing ?? f.facing ?? 0;
  }
  update(f, character, dt, visible) {
    this.place(f, character);this.root.visible = !!visible && f.hp > 0;
    if (!this.active || dt <= 0) return;
    this.age += dt;const def = PASSIVE_ABILITIES[this.kind], k = Math.min(1, this.age / def.duration), fade = k < .08 ? k / .08 : k > .72 ? (1 - k) / .28 : 1;
    this.light.intensity = 2.6 * Math.max(0, fade);
    if (this.kind === 0) {
      for (let i = 0; i < this.orbs.length; i++) {const m = this.orbs[i], a = m.userData.phase + this.age * (2.1 + i % 3 * .16), r = i % 3 === 0 ? .82 : 1.18;m.position.set(Math.cos(a) * r, 1.05 + Math.sin(a * 3) * .15, Math.sin(a) * r);m.rotation.set(a * .6, a * 1.4, a);m.scale.setScalar(.75 + fade * .45);m.material.opacity = .9 * fade;}
    } else if (this.kind === 1) {
      this.prism.rotation.y = this.age * .72;
      for (let i = 0; i < this.beams.length; i++) {const m = this.beams[i];m.position.y = 1;m.scale.y = .55 + fade * .45;m.material.opacity = .78 * fade;}
      for (const m of this.stars) {const a = m.userData.phase + this.age * .55;m.position.set(Math.cos(a) * 1.45, 1 + Math.sin(a * 2) * .3, Math.sin(a) * 1.45);m.rotation.set(a, a * 1.7, a * .6);m.material.opacity = .75 * fade;}
    } else {
      for (const m of this.rings) {const local = Math.max(0, this.age - m.userData.delay), u = Math.min(1, local / Math.max(.1, def.duration - m.userData.delay)), scale = .12 + u * 3.2;m.scale.setScalar(scale);m.position.y = .055;m.material.opacity = Math.max(0, (1 - u) * .82);}
      const pulse = 1 + Math.sin(this.age * Math.PI * 4) * .16;this.core.scale.setScalar(pulse * Math.max(.01, fade));this.core.rotation.y += dt * 4;this.core.material.opacity = fade;
    }
    if (k >= 1) this.reset();
  }
  dispose(scene) {scene.remove(this.root);this.root.traverse(o => {o.geometry?.dispose?.();if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());else o.material?.dispose?.();});}
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
