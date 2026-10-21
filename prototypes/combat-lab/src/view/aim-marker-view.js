// @ts-check
// Marcador de mira dos Moves com destino (Spikes, Bullet Punch, Emerging Stone, Sand Wave): anel no chão no ponto escolhido (verde = válido, vermelho = inválido),
// coluna de luz. Só aparência: lê `f.aim` (estado da simulação) e nunca o altera. Criado sob demanda pela View e descartado quando
// ninguém está mirando (custo zero fora dos Moves). `reduceMotion` desliga a pulsação.
const OK = 0x6dffa8, BAD = 0xff5566, GRAY = 0xb4bcc6;
export class AimMarkers {
  /** @param {any} T three @param {any} scene */
  constructor(T, scene) {this.T = T;this.scene = scene;this.group = new T.Group();this.group.renderOrder = 900;scene.add(this.group);this.items = new Map();this.t = 0;}
  /** @param {any[]} fighters @param {number} dt @param {{reduceMotion?: boolean}} o */
  update(fighters, dt, o) {
    this.t += dt;
    const live = new Set();
    for (const f of fighters) {
      const a = f.aim;if (!a || f.hp <= 0) continue;
      if (f.id !== 0 && a.def?.castFirst) continue;   // adversários não enxergam o marcador do Emerging Stone durante a mira (ES)
      live.add(f.id);
      let it = this.items.get(f.id);
      if (!it) {it = this.make();this.items.set(f.id, it);this.group.add(it.root);}
      // follow (Bullet Punch): círculo = alcance físico da investida; cinza normalmente, vermelho com adversário dentro dele (não garante alvo nem acerto)
      const col = a.follow ? (a.enemyNear ? BAD : GRAY) : a.valid ? OK : BAD, r = Math.max(.3, a.follow ? a.params.reach : a.params?.radius ?? .6), pulse = o.reduceMotion ? 1 : 1 + Math.sin(this.t * 8) * .04;
      it.root.position.set(a.pos.x, a.y + .04, a.pos.z);
      it.ring.scale.set(r * pulse, 1, r * pulse);
      it.pillar.scale.set(1, 1.4, 1);it.pillar.position.y = .7;
      for (const m of it.mats) m.color.setHex(col);
    }
    // Speedlines do Bullet Punch: do ponto onde o lutador sumiu até o marcador, enquanto ausente.
    for (const f of fighters) {
      const m = f.absent ? f.action?.marker : null, key = `s${f.id}`;
      if (!m) continue;
      live.add(key);
      let it = this.items.get(key);
      if (!it) {it = this.makeLines();this.items.set(key, it);this.group.add(it.root);}
      const dx = m.pos.x - f.position.x, dz = m.pos.z - f.position.z, len = Math.max(.01, Math.hypot(dx, dz)), yaw = Math.atan2(dx, dz);
      it.root.position.set(f.position.x, (f.groundY ?? 0) + .6, f.position.z);it.root.rotation.y = yaw;
      it.lines.forEach((l, i) => {
        const ph = o.reduceMotion ? .5 : (this.t * 2.2 + i / it.lines.length) % 1;
        l.scale.set(.04, .04, Math.min(len, 1.6));l.position.set((i - 2) * .22, Math.sin(i * 1.7) * .25, ph * len);l.material.opacity = .7 * (1 - Math.abs(ph - .5) * 1.6);
      });
    }
    for (const [id, it] of [...this.items]) if (!live.has(id)) {this.group.remove(it.root);it.dispose();this.items.delete(id);}
  }
  makeLines() {
    const T = this.T, root = new T.Group(), geo = new T.BoxGeometry(1, 1, 1);
    const lines = [0, 1, 2, 3, 4].map(() => new T.Mesh(geo, new T.MeshBasicMaterial({color: 0xe8f1ff, transparent: true, opacity: .6, depthWrite: false})));
    lines.forEach(l => root.add(l));
    return {root, lines, dispose: () => {geo.dispose();lines.forEach(l => l.material.dispose());}};
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
