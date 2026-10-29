// Anel de choque no chão quando o lutador acelera a recarga de um Move pagando stamina (evento `cooldownBoost`).
// Duas ondas concêntricas + clarão curto, na cor do lutador; puramente visual e com pool fixo (custo zero parado).
import * as T from 'three';

const POOL = 8;

export class BoostRings {
  constructor(scene) {
    this.geo = new T.RingGeometry(.62, .8, 56);
    this.geo.rotateX(-Math.PI / 2);
    /** @type {{mesh: any, mat: any, life: number, ttl: number, delay: number}[]} */
    this.items = [];
    for (let i = 0; i < POOL; i++) {
      const mat = new T.MeshBasicMaterial({transparent: true, depthWrite: false, side: T.DoubleSide, opacity: 0});
      const mesh = new T.Mesh(this.geo, mat);
      mesh.visible = false;mesh.renderOrder = 4;
      scene.add(mesh);
      this.items.push({mesh, mat, life: 0, ttl: .55, delay: 0});
    }
    this.cursor = 0;
  }
  /** Dispara o efeito na posição do lutador. `hex` = cor dele (ou dourado quando não há tingimento). */
  fire(x, y, z, hex) {
    for (let wave = 0; wave < 2; wave++) {
      const it = this.items[this.cursor = (this.cursor + 1) % POOL];
      it.life = it.ttl = .58;it.delay = wave * .09;
      it.mesh.position.set(x, (y ?? 0) + .018 + wave * .002, z);
      it.mesh.scale.setScalar(1);
      it.mat.color.set(hex ?? 0xffd23f);
      it.mat.opacity = 0;
      it.mesh.visible = false;
    }
  }
  update(dt) {
    if (dt <= 0) return;
    for (const it of this.items) {
      if (it.life <= 0) continue;
      if (it.delay > 0) {it.delay -= dt;continue;}
      it.life = Math.max(0, it.life - dt);
      const t = 1 - it.life / it.ttl;                       // 0 = nasce, 1 = some
      it.mesh.visible = it.life > 0;
      it.mesh.scale.setScalar(.85 + t * 2.9);
      it.mat.opacity = it.life > 0 ? (1 - t) * .9 : 0;
    }
  }
  reset() {
    for (const it of this.items) {it.life = 0;it.delay = 0;it.mesh.visible = false;it.mat.opacity = 0;}
  }
  dispose() {
    for (const it of this.items) {it.mesh.removeFromParent();it.mat.dispose();}
    this.geo.dispose();this.items = [];
  }
}
