// Desenho genérico das entidades do mundo (projéteis, barreiras, paredes, áreas). É só a representação mínima e
// legível de cada tipo, pela cor do dono: os movimentos futuros podem trocar por modelos e VFX próprios sem mudar a
// simulação (o desenho só lê o estado).
import * as T from 'three';
import {rgb} from '../sim/config.js';

export class WorldView {
  constructor(scene) {this.group = new T.Group();this.group.renderOrder = 800;scene.add(this.group);this.meshes = new Map();}
  colorOf(e) {return e.owner === 0 ? rgb('player') : e.owner === 1 ? rgb('enemy') : 0xffffff;}
  make(e) {
    const color = this.colorOf(e);let mesh;
    if (e.kind === 'projectile') mesh = new T.Mesh(new T.SphereGeometry(1, 16, 12), new T.MeshBasicMaterial({color, transparent: true, opacity: .9}));
    else if (e.kind === 'area') {
      const geo = new T.CircleGeometry(1, 48);geo.rotateX(-Math.PI / 2);
      mesh = new T.Mesh(geo, new T.MeshBasicMaterial({color: 0xffb361, transparent: true, opacity: .35, depthWrite: false, side: T.DoubleSide}));
    } else {
      const geo = e.shape === 'circle' ? new T.CylinderGeometry(1, 1, 1, 32, 1, true) : new T.BoxGeometry(1, 1, 1);
      mesh = new T.Mesh(geo, new T.MeshStandardMaterial({color: e.kind === 'wall' ? 0x9aa7b3 : color, transparent: true, opacity: e.kind === 'wall' ? .95 : .35, depthWrite: e.kind === 'wall', side: T.DoubleSide}));
    }
    mesh.userData.kind = e.kind;this.group.add(mesh);this.meshes.set(e.id, mesh);return mesh;
  }
  update(world) {
    const alive = new Set();
    for (const e of world?.entities ?? []) {
      alive.add(e.id);const m = this.meshes.get(e.id) ?? this.make(e);
      if (e.kind === 'projectile') {m.position.set(e.pos.x, e.y, e.pos.z);m.scale.setScalar(e.radius);}
      else if (e.kind === 'area') {
        m.position.set(e.pos.x, (e.y ?? 0) + .03, e.pos.z);
        if (e.shape === 'box') {m.scale.set(e.hx * 2, 1, e.hz * 2);m.rotation.y = e.angle ?? 0;} else m.scale.set(e.radius, 1, e.radius);
        m.material.opacity = .45 * Math.max(.15, 1 - e.age / Math.max(1e-6, e.life));
      } else {
        m.position.set(e.pos.x, e.y + e.height / 2, e.pos.z);m.rotation.y = e.angle ?? 0;
        if (e.shape === 'circle') m.scale.set(e.radius, e.height, e.radius);else m.scale.set(e.hx * 2, e.height, e.hz * 2);
      }
    }
    for (const [id, m] of this.meshes) if (!alive.has(id)) {this.group.remove(m);m.geometry.dispose();m.material.dispose();this.meshes.delete(id);}
    return alive.size;
  }
}
