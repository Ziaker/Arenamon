// @ts-check
// VFX de ativação de passivas (§16): três variantes reproduzíveis A/B/C, 0,60 s de duração base, círculos
// brancos 3D + sparkles. Só aparência: nenhum valor aqui altera regras, tempos da simulação ou cooldowns.
//   A (variant 0) "Orbital Halo": dois anéis brancos orbitando o lutador.
//   B (variant 1) "Celestial Intersections": três círculos grandes em planos inclinados que se cruzam nele.
//   C (variant 2) "Luminous Resonance": anel de solo que expande + coluna de sparkles ascendentes.
// Respeita C.vfx.passive (enabled, variant, intensity, size, opacity, duration, sparkles) e o mestre de
// acessibilidade (reduceMotion/noFlash). Sliders em Ajustes › VFX · Passivas.
import * as T from 'three';
import {C} from '../sim/config.js';

const BASE_DURATION = .6;

export class PassiveVfx {
  /** @param {T.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    /** @type {Array<{group: T.Group, age: number, life: number, kind: string, spin: number, rise: number}>} */
    this.live = [];
  }
  /**
   * Dispara efeitos para eventos de passivas deste passo.
   * @param {Array<any>} events eventos do passo (game.lastStepEvents)
   * @param {Array<any>} fighters lutadores (posição atual)
   */
  onEvents(events, fighters) {
    const V = C.vfx?.passive;
    if (!V?.enabled || !events?.length) return;
    for (const e of events) {
      if (e.result !== 'passiveActivated' || e.attacker == null) continue;
      const f = fighters[e.attacker];
      if (f) this.spawn(f);
    }
  }
  /** Cria a variante configurada em volta do lutador. */
  spawn(f) {
    const V = C.vfx.passive, M = C.vfx.master;
    if (M?.reduceMotion && V.variant !== 2) return;         // movimento reduzido: só a variante mais estática (C) permanece
    const life = BASE_DURATION * (V.duration ?? 1);
    const size = (V.size ?? 1), opacity = (V.opacity ?? 1) * (M?.noFlash ? .55 : 1);
    const intensity = V.intensity ?? 1;
    const group = new T.Group();
    group.position.set(f.position.x, (f.groundY ?? 0), f.position.z);
    const white = new T.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity, depthWrite: false});
    const kind = ['halo', 'intersections', 'resonance'][V.variant ?? 0] ?? 'halo';
    const add = (mesh) => {mesh.userData.baseOpacity = opacity;group.add(mesh);return mesh;};
    if (kind === 'halo') {
      for (const [r, tilt, speed] of [[1.0, 0, 1], [1.35, Math.PI / 2.2, -1.4]]) {
        const ring = new T.Mesh(new T.TorusGeometry(r * size, .02 * size, 8, 48), white.clone());
        ring.rotation.x = Math.PI / 2 + tilt;ring.position.y = 1.1;
        ring.userData.spin = speed * intensity;add(ring);
      }
    } else if (kind === 'intersections') {
      for (let i = 0; i < 3; i++) {
        const ring = new T.Mesh(new T.TorusGeometry(1.5 * size, .018 * size, 8, 64), white.clone());
        ring.rotation.set(Math.PI / 2 + i * .55, i * (Math.PI / 3), 0);ring.position.y = 1.1;
        ring.userData.spin = (i % 2 ? -1 : 1) * .8 * intensity;add(ring);
      }
    } else {
      const ground = new T.Mesh(new T.RingGeometry(.7 * size, .82 * size, 48), white.clone());
      ground.rotation.x = -Math.PI / 2;ground.position.y = .06;ground.userData.expand = 2.2 * intensity;add(ground);
      if (V.sparkles !== 0 && !M?.noFlash) {
        const n = Math.round(10 * intensity * (V.sparkles ?? 1));
        const geo = new T.BufferGeometry(), pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {const a = Math.random() * Math.PI * 2, r = .3 + Math.random() * .7;pos[i * 3] = Math.cos(a) * r * size;pos[i * 3 + 1] = Math.random() * .4;pos[i * 3 + 2] = Math.sin(a) * r * size;}
        geo.setAttribute('position', new T.BufferAttribute(pos, 3));
        const pts = new T.Points(geo, new T.PointsMaterial({color: 0xffffff, size: .09 * size, transparent: true, opacity, depthWrite: false}));
        pts.userData.rise = 2.4 * intensity;add(pts);
      }
    }
    this.scene.add(group);
    this.live.push({group, age: 0, life, kind, spin: intensity, rise: 0});
  }
  /** Avança os efeitos vivos (chamar a cada quadro renderizado). */
  update(dt) {
    if (!this.live.length) return;
    const keep = [];
    for (const fx of this.live) {
      fx.age += dt;
      const k = Math.min(1, fx.age / fx.life), fade = 1 - k;
      for (const child of fx.group.children) {
        const m = /** @type {any} */ (child).material;
        if (m?.opacity !== undefined) m.opacity = (child.userData.baseOpacity ?? 1) * fade;
        if (child.userData.spin) child.rotation.z += child.userData.spin * dt;
        if (child.userData.expand) {const s = 1 + child.userData.expand * k;child.scale.set(s, s, s);}
        if (child.userData.rise) child.position.y += child.userData.rise * dt;
      }
      if (fx.age >= fx.life) {this.scene.remove(fx.group);fx.group.traverse(o => {const m = /** @type {any} */ (o).material, g = /** @type {any} */ (o).geometry;g?.dispose?.();m?.dispose?.();});}
      else keep.push(fx);
    }
    this.live = keep;
  }
  clear() {for (const fx of this.live) this.scene.remove(fx.group);this.live = [];}
}
