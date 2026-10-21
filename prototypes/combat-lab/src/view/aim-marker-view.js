// @ts-check
// Marcador de mira dos Moves com destino (Spikes, Bullet Punch, Emerging Stone, Sand Wave): anel no chão no ponto escolhido (verde = válido, vermelho = inválido),
// coluna de luz. Só aparência: lê `f.aim` (estado da simulação) e nunca o altera. Criado sob demanda pela View e descartado quando
// ninguém está mirando (custo zero fora dos Moves). `reduceMotion` desliga a pulsação.
const OK = 0x6dffa8, BAD = 0xff5566;
export class AimMarkers {
  /** @param {any} T three @param {any} scene */
  constructor(T, scene) {this.T = T;this.scene = scene;this.group = new T.Group();this.group.renderOrder = 900;scene.add(this.group);this.items = new Map();this.t = 0;}
  /** @param {any[]} fighters @param {number} dt @param {{reduceMotion?: boolean}} o */
  update(fighters, dt, o) {
    this.t += dt;
    const live = new Set();
    for (const f of fighters) {
      const a = f.aim;if (!a || f.hp <= 0) continue;
      live.add(f.id);
      let it = this.items.get(f.id);
      if (!it) {it = this.make();this.items.set(f.id, it);this.group.add(it.root);}
      const col = a.valid ? OK : BAD, r = Math.max(.3, a.params?.radius ?? .6), pulse = o.reduceMotion ? 1 : 1 + Math.sin(this.t * 8) * .04;
      it.root.position.set(a.pos.x, a.y + .04, a.pos.z);
      it.ring.scale.set(r * pulse, 1, r * pulse);
      it.pillar.scale.set(1, 1.4, 1);it.pillar.position.y = .7;
      for (const m of it.mats) m.color.setHex(col);
    }
    for (const [id, it] of [...this.items]) if (!live.has(id)) {this.group.remove(it.root);it.dispose();this.items.delete(id);}
  }
  make() {
    const T = this.T, root = new T.Group();
    const ringGeo = new T.RingGeometry(.88, 1, 40);ringGeo.rotateX(-Math.PI / 2);
    const m1 = new T.MeshBasicMaterial({color: OK, transparent: true, opacity: .85, depthWrite: false, side: T.DoubleSide});
    const ring = new T.Mesh(ringGeo, m1);root.add(ring);
    const pillarGeo = new T.CylinderGeometry(.06, .06, 1, 8, 1, true);
    const m2 = new T.MeshBasicMaterial({color: OK, transparent: true, opacity: .35, depthWrite: false});
    const pillar = new T.Mesh(pillarGeo, m2);root.add(pillar);
    return {root, ring, pillar, mats: [m1, m2], dispose: () => {ringGeo.dispose();pillarGeo.dispose();m1.dispose();m2.dispose();}};
  }
  dispose() {for (const it of this.items.values()) it.dispose();this.items.clear();this.scene.remove(this.group);}
}
