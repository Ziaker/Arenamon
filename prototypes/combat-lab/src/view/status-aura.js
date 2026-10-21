// @ts-check
// Aura visual dos status dos Moves novos (só aparência; não toca na simulação). Hoje: Harden (casca cristalina branco-prateada, com onda
// quando o golpe é absorvido) e Second Wind (anel dourado ascendente). `reduceMotion` desliga pulsos e ondas; `noFlash` limita o brilho.
// Criada sob demanda pela View e descartada quando nenhum lutador tem aura (custo zero fora dos Moves).
const STYLES = {
  harden: {color: 0xdfe9f5, kind: 'shell', opacity: .22},
  'second-wind': {color: 0xffd36a, kind: 'rings', opacity: .5},
};
export class StatusAura {
  /** @param {any} T three @param {any} scene */
  constructor(T, scene) {this.T = T;this.scene = scene;this.group = new T.Group();this.group.renderOrder = 800;scene.add(this.group);this.items = new Map();this.t = 0;}
  /** @param {any[]} fighters @param {number} dt @param {{bodyHeight:number, halfExtent:number, reduceMotion?:boolean, noFlash?:boolean, hits?:Set<number>}} o */
  update(fighters, dt, o) {
    const T = this.T;this.t += dt;
    const live = new Set();
    for (const f of fighters) {
      for (const st of f.statuses ?? []) {
        const style = STYLES[st.id];if (!style || f.hp <= 0) continue;
        const key = `${f.id}:${st.id}`;live.add(key);
        let it = this.items.get(key);
        if (!it) {it = this.make(style, o);this.items.set(key, it);this.group.add(it.root);}
        const alt = (f.flight?.y ?? (f.groundY ?? 0)) + (f.vaultHeight ?? 0), fade = Math.min(1, st.remaining / .4, (st.duration - st.remaining) / .15 + .2);
        it.root.position.set(f.position.x, alt, f.position.z);
        const pulse = o.reduceMotion ? 0 : Math.sin(this.t * 6) * .03, cap = o.noFlash ? .6 : 1;
        if (style.kind === 'shell') {
          const s = 1.18 + pulse + (o.hits?.has(f.id) && !o.reduceMotion ? .12 : 0);
          it.root.scale.set(s, s, s);
          it.mat.opacity = style.opacity * fade * cap + (o.hits?.has(f.id) && !o.reduceMotion ? .25 * cap : 0);
        } else {
          it.rings.forEach((r, i) => {
            const p = o.reduceMotion ? .5 : ((this.t * .6 + i / it.rings.length) % 1);
            r.position.y = p * o.bodyHeight * 1.05;r.scale.setScalar(1 - .35 * p);r.material.opacity = style.opacity * fade * cap * (1 - p);
          });
        }
      }
    }
    for (const [key, it] of [...this.items]) if (!live.has(key)) {this.group.remove(it.root);it.dispose();this.items.delete(key);}
  }
  make(style, o) {
    const T = this.T, root = new T.Group();
    if (style.kind === 'shell') {
      const geo = new T.BoxGeometry(o.halfExtent * 2, o.bodyHeight, o.halfExtent * 2), mat = new T.MeshBasicMaterial({color: style.color, transparent: true, opacity: style.opacity, depthWrite: false});
      const mesh = new T.Mesh(geo, mat);mesh.position.y = o.bodyHeight / 2;root.add(mesh);
      const edges = new T.LineSegments(new T.EdgesGeometry(geo), new T.LineBasicMaterial({color: 0xffffff, transparent: true, opacity: .55}));edges.position.y = o.bodyHeight / 2;root.add(edges);
      return {root, mat, dispose() {geo.dispose();mat.dispose();edges.geometry.dispose();edges.material.dispose();}};
    }
    const rings = [0, 1, 2].map(() => new T.Mesh(new T.RingGeometry(o.halfExtent * 1.15, o.halfExtent * 1.3, 40), new T.MeshBasicMaterial({color: style.color, transparent: true, opacity: style.opacity, side: T.DoubleSide, depthWrite: false})));
    rings.forEach(r => {r.rotation.x = -Math.PI / 2;root.add(r);});
    return {root, rings, dispose() {rings.forEach(r => {r.geometry.dispose();r.material.dispose();});}};
  }
  dispose() {for (const it of this.items.values()) it.dispose();this.items.clear();this.scene.remove(this.group);}
}
