// Desenho das entidades do mundo (projéteis, barreiras, paredes, áreas) e dos Moves: barreira do Reflect e pedras do Psyshock coloridas pelo
// Power Level (PL1 ciano, PL2 âmbar, PL3 magenta), prévia da barreira e das pedras durante a carga e anéis de impacto para os eventos
// (reflexão, destruição, disputa de PL, stagger, proteção). É só representação: o desenho lê o estado e os eventos da simulação e nunca decide nada.
import * as T from 'three';
import {rgb} from '../sim/config.js';
import {reflectPlacement} from '../sim/moves/reflect.js';
import {stoneCount} from '../sim/moves/psyshock.js';

export const PL_HEX = [0xffffff, 0x59d6e6, 0xffcf6a, 0xff6adf];
const RING = {reflected: [null, 1.3], barrierBroken: [0xff8a5a, 2.4], stoneClash: [0xb59cff, 1], counter: [0xffd24a, 1.2], tackleClash: [0xffffff, .9], counterStagger: [0xffd24a, 1.5], shielded: [0x59d6e6, 1.3], neutralized: [0xffffff, 1]};
const FIGHTER_EVENTS = new Set(['counterStagger', 'shielded']);

export class WorldView {
  constructor(scene) {
    this.group = new T.Group();this.group.renderOrder = 800;scene.add(this.group);this.meshes = new Map();
    this.time = 0;this.seen = new WeakSet();this.rings = [];this.orbs = [[], []];
    this.preview = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({color: 0x59e68a, transparent: true, opacity: .26, depthWrite: false, side: T.DoubleSide}));
    this.preview.visible = false;this.preview.renderOrder = 801;this.group.add(this.preview);
  }
  colorOf(e) {
    if (e.pl != null && (e.reflect || e.clashable)) return PL_HEX[Math.min(3, e.pl)];
    return e.owner === 0 ? rgb('player') : e.owner === 1 ? rgb('enemy') : 0xffffff;
  }
  make(e) {
    const color = this.colorOf(e);let mesh;
    if (e.kind === 'projectile') mesh = new T.Mesh(new T.SphereGeometry(1, 16, 12), new T.MeshBasicMaterial({color, transparent: true, opacity: .9}));
    else if (e.kind === 'beam') {
      // Feixe: um paralelepípedo fino por segmento (até `maxSegments`), reposicionado a cada quadro conforme `e.segments`.
      mesh = new T.Group();const geo = new T.BoxGeometry(1, 1, 1);
      for (let i = 0; i < (e.maxSegments ?? 8); i++) {const s = new T.Mesh(geo, new T.MeshBasicMaterial({color, transparent: true, opacity: .85}));s.visible = false;mesh.add(s);}
    } else if (e.kind === 'area') {
      const geo = new T.CircleGeometry(1, 48);geo.rotateX(-Math.PI / 2);
      mesh = new T.Mesh(geo, new T.MeshBasicMaterial({color: e.explosion ? 0xff8a5a : 0xffb361, transparent: true, opacity: .35, depthWrite: false, side: T.DoubleSide}));
    } else {
      const geo = e.shape === 'circle' ? new T.CylinderGeometry(1, 1, 1, 32, 1, true) : new T.BoxGeometry(1, 1, 1);
      mesh = new T.Mesh(geo, new T.MeshStandardMaterial({color: e.kind === 'wall' ? 0x9aa7b3 : color, emissive: e.reflect ? color : 0, emissiveIntensity: e.reflect ? .55 : 0, transparent: true, opacity: e.kind === 'wall' ? .95 : e.reflect ? .34 : .35, depthWrite: e.kind === 'wall', side: T.DoubleSide}));
      if (e.reflect) {const edges = new T.LineSegments(new T.EdgesGeometry(geo), new T.LineBasicMaterial({color}));edges.name = 'edges';mesh.add(edges);}
    }
    mesh.userData.kind = e.kind;this.group.add(mesh);this.meshes.set(e.id, mesh);return mesh;
  }
  /** Anel que se expande e some (VFX de evento). */
  ring(x, y, z, color, size, life = .38) {
    const geo = new T.RingGeometry(.82, 1, 40);geo.rotateX(-Math.PI / 2);
    const mesh = new T.Mesh(geo, new T.MeshBasicMaterial({color, transparent: true, opacity: .85, depthWrite: false, side: T.DoubleSide}));
    mesh.position.set(x, y, z);mesh.renderOrder = 802;this.group.add(mesh);this.rings.push({mesh, age: 0, life, size});
  }
  update(world, {fighters = [], events = [], dt = 0} = {}) {
    this.time += dt;
    const alive = new Set();
    for (const e of world?.entities ?? []) {
      alive.add(e.id);const m = this.meshes.get(e.id) ?? this.make(e);
      if (e.kind === 'beam') {
        m.children.forEach((s, i) => {
          const g = e.segments?.[i];s.visible = !!g;if (!g) return;
          const dx = g.b.x - g.a.x, dz = g.b.z - g.a.z, len = Math.hypot(dx, dz), w = Math.max(.05, (e.width ?? .04) * 2);
          s.position.set((g.a.x + g.b.x) / 2, e.y, (g.a.z + g.b.z) / 2);s.rotation.y = Math.atan2(dx, dz);s.scale.set(w, w, Math.max(1e-3, len));
          s.material.color.setHex(g.neutralized ? 0xffffff : PL_HEX[Math.min(3, g.pl ?? 1)]);s.material.opacity = g.neutralized ? .35 : .85;
        });
      } else if (e.kind === 'projectile') {m.position.set(e.pos.x, e.y, e.pos.z);m.scale.setScalar(e.radius * (e.visualScale ?? 1) * (e.exec != null ? 1.15 : 1));m.material.color.setHex(this.colorOf(e));}
      else if (e.kind === 'area') {
        m.position.set(e.pos.x, (e.y ?? 0) + .03, e.pos.z);
        if (e.shape === 'box') {m.scale.set(e.hx * 2, 1, e.hz * 2);m.rotation.y = e.angle ?? 0;} else m.scale.set(e.radius, 1, e.radius);
        m.material.opacity = .45 * Math.max(.15, 1 - e.age / Math.max(1e-6, e.life));
      } else {
        m.position.set(e.pos.x, e.y + e.height / 2, e.pos.z);m.rotation.y = e.angle ?? 0;
        if (e.shape === 'circle') m.scale.set(e.radius, e.height, e.radius);else m.scale.set(e.hx * 2, e.height, e.hz * 2);
        if (e.reflect) {
          // Perto do fim a barreira “falha”: pisca e perde força (M10.7); a cor segue o PL.
          const left = e.life - e.age, weak = left < 1 ? .45 + .55 * Math.abs(Math.sin(this.time * 30)) : 1;
          m.material.opacity = .34 * weak;m.material.emissiveIntensity = .55 * weak;
        }
      }
    }
    // Eventos novos viram anéis (a posição vem da malha da entidade, que ainda existe neste quadro, ou do lutador alvo).
    for (const ev of events) {
      if (this.seen.has(ev)) continue;this.seen.add(ev);
      const spec = RING[ev.result];if (!spec) continue;
      const m = this.meshes.get(ev.entity), f = FIGHTER_EVENTS.has(ev.result) ? fighters[ev.target] : null;
      const be = ev.kind === 'beam' && ev.seg != null ? world?.entities.find(x => x.id === ev.entity) : null, bp = be?.segments?.[ev.seg]?.b;   // eventos do feixe: o anel nasce no ponto do contato
      const pos = bp ? {x: bp.x, y: be.y, z: bp.z} : f ? {x: f.position.x, y: .6, z: f.position.z} : m ? m.position : null;if (!pos) continue;
      this.ring(pos.x, pos.y ?? .6, pos.z, spec[0] ?? PL_HEX[Math.min(3, ev.barrierPl ?? ev.pl ?? 1)], spec[1]);
    }
    for (const [id, m] of this.meshes) if (!alive.has(id)) {this.group.remove(m);m.traverse(o => {o.geometry?.dispose();o.material?.dispose();});this.meshes.delete(id);}
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];r.age += dt;const k = Math.min(1, r.age / r.life);
      r.mesh.scale.setScalar(.25 + r.size * k);r.mesh.material.opacity = .85 * (1 - k);
      if (k >= 1) {this.group.remove(r.mesh);r.mesh.geometry.dispose();r.mesh.material.dispose();this.rings.splice(i, 1);}
    }
    this.drawCharging(world, fighters);
    return alive.size;
  }
  /** Prévia da barreira (verde se cabe, vermelha se faltar espaço) e pedras que se formam ao redor de quem está carregando. */
  drawCharging(world, fighters) {
    let showPreview = false;
    for (const f of fighters) {
      const orbs = this.orbs[f.id] ??= [], ch = f.charge;
      let want = 0;
      if (ch && ch.move === 'reflect') {
        const P = ch.params, place = reflectPlacement({world, fighters}, f, P, ch.ticks / P.maxTicks, f.facing), p = this.preview;
        showPreview = true;p.visible = true;
        if (place.ok) {p.position.set(place.center.x, place.base + place.height / 2, place.center.z);p.scale.set(place.width, place.height, place.thickness);p.material.color.setHex(0x59e68a);}
        else {const w = P.group.widthMin * 2 * P.body.halfExtent;p.position.set(f.position.x + Math.sin(f.facing) * 1.05, P.body.height, f.position.z + Math.cos(f.facing) * 1.05);p.scale.set(w, P.group.heightMin * P.body.height, P.group.thickness);p.material.color.setHex(0xff5a5a);}
        p.rotation.y = f.facing;
      } else if (ch && ch.move === 'psyshock') want = stoneCount(ch.ticks, ch.params);
      while (orbs.length < 16) {const o = new T.Mesh(new T.SphereGeometry(1, 12, 8), new T.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: .85}));o.visible = false;this.group.add(o);orbs.push(o);}
      for (let i = 0; i < orbs.length; i++) {
        const o = orbs[i];o.visible = i < want;if (i >= want) continue;
        const arc = 2.1, a = f.facing + (want === 1 ? 0 : (i / (want - 1) - .5) * arc) + Math.sin(this.time * 1.7 + i) * .06, r = .95 + .12 * Math.sin(this.time * 2.3 + i * 1.7);
        o.position.set(f.position.x + Math.sin(a) * r, .45 + .55 * (.5 + .5 * Math.sin(this.time * 2 + i * 2.1)) + (i % 3) * .1, f.position.z + Math.cos(a) * r);
        o.scale.setScalar(.12 + .06 * ((i * 7) % 5) / 4);o.material.color.setHex(PL_HEX[Math.min(3, ch.ticks >= ch.params.maxTicks ? 3 : ch.ticks >= ch.params.pl2Ticks ? 2 : 1)]);
      }
    }
    if (!showPreview) this.preview.visible = false;
  }
}
