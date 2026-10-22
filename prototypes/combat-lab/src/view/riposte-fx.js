// @ts-check
// Efeito visual do Riposte (só aparência; não toca na simulação). Dois momentos:
//   • postura (ativação): disco de aço no chão + lâmina de guarda translucente à frente do lutador durante o cast; mais forte e dourada
//     dentro da janela do contra-golpe (windowStart–windowEnd) e apagada quando a janela fecha (resto = recuperação exposta);
//   • contra-golpe (evento 'riposteStrike'): clarão, anel de choque e corte em X no ponto entre os dois lutadores.
// Controles em C.world.riposte (capturados no uso): fxOn, fxIntensity, fxSize. `reduceMotion` desliga a pulsação; `noFlash` limita o brilho.
// Criada sob demanda pela View e descartada quando não há Riposte em andamento nem clarão ativo (custo zero fora do Move).
const STEEL = 0xbfe3ff, GOLD = 0xffd36a, FLASH = 0xffffff;
export class RiposteFx {
  /** @param {any} T three @param {any} scene */
  constructor(T, scene) {this.T = T;this.scene = scene;this.group = new T.Group();this.group.renderOrder = 810;scene.add(this.group);this.stances = new Map();this.bursts = [];this.t = 0;this.seen = new WeakSet();}
  /** Há algo a desenhar/limpar? */
  get active() {return this.stances.size > 0 || this.bursts.length > 0;}
  /** @param {any[]} fighters @param {any[]} events @param {number} dt @param {{bodyHeight:number, halfExtent:number, reduceMotion?:boolean, noFlash?:boolean}} o */
  update(fighters, events, dt, o) {
    const T = this.T;this.t += dt;
    const cap = o.noFlash ? .6 : 1, live = new Set();
    for (const f of fighters) {
      const a = f.action;
      if (!a || a.kind !== 'move' || !a.def?.riposte || f.hp <= 0) continue;
      const P = a.params ?? {}, k = P.fxOn === 0 ? 0 : (P.fxIntensity ?? 1), size = P.fxSize ?? 1;
      if (!k) continue;
      live.add(f.id);
      let it = this.stances.get(f.id);
      if (!it) {it = this.makeStance(o);this.stances.set(f.id, it);this.group.add(it.root);}
      const inWindow = a.elapsed >= (P.windowStart ?? 0) - 1e-9 && a.elapsed <= (P.windowEnd ?? .3) + 1e-9, fadeIn = Math.min(1, a.elapsed / .08 + .25);
      const pulse = o.reduceMotion ? 0 : Math.sin(this.t * 22) * .08;
      const alt = (f.flight?.y ?? (f.groundY ?? 0)) + (f.vaultHeight ?? 0), col = inWindow ? GOLD : STEEL;
      it.root.position.set(f.position.x, alt, f.position.z);
      it.root.rotation.y = a.heading ?? f.facing ?? 0;
      it.root.scale.setScalar(size * (1 + pulse));
      it.disc.material.color.setHex(col);it.blade.material.color.setHex(col);it.edge.material.color.setHex(inWindow ? FLASH : col);
      it.disc.material.opacity = (inWindow ? .55 : .2) * k * cap * fadeIn;
      it.blade.material.opacity = (inWindow ? .5 : .16) * k * cap * fadeIn;
      it.edge.material.opacity = (inWindow ? .95 : .4) * Math.min(1, k) * fadeIn;
      it.spin.rotation.y = o.reduceMotion ? 0 : this.t * 3;
    }
    for (const [id, it] of [...this.stances]) if (!live.has(id)) {this.group.remove(it.root);it.dispose();this.stances.delete(id);}
    for (const e of events) {
      if (e.result !== 'riposteStrike' || this.seen.has(e)) continue;
      this.seen.add(e);
      const me = fighters[e.attacker], foe = fighters[e.target], P = me?.action?.params ?? {}, k = P.fxOn === 0 ? 0 : (P.fxIntensity ?? 1);
      if (!me || !k) continue;
      const mid = foe ? {x: (me.position.x + foe.position.x) / 2, z: (me.position.z + foe.position.z) / 2} : me.position;
      this.bursts.push(this.makeBurst(o, mid, (me.groundY ?? 0) + o.bodyHeight * .6, (P.fxSize ?? 1), k * cap));
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];b.age += dt;
      const u = Math.min(1, b.age / b.life);
      b.ring.scale.setScalar(.4 + u * 2.6 * b.size);b.ring.material.opacity = (1 - u) * .9 * b.k;
      b.cross.scale.setScalar((.5 + u * .9) * b.size);b.cross.material.opacity = Math.max(0, 1 - u * 1.6) * b.k;
      b.flash.scale.setScalar((.6 + u * 1.2) * b.size);b.flash.material.opacity = Math.max(0, 1 - u * 3) * .85 * b.k;
      if (u >= 1) {this.group.remove(b.root);b.dispose();this.bursts.splice(i, 1);}
    }
  }
  makeStance(o) {
    const T = this.T, root = new T.Group(), spin = new T.Group(), r = o.halfExtent;
    const disc = new T.Mesh(new T.RingGeometry(r * 1.2, r * 1.75, 48), new T.MeshBasicMaterial({color: STEEL, transparent: true, opacity: .2, depthWrite: false, side: T.DoubleSide}));
    disc.rotation.x = -Math.PI / 2;disc.position.y = .03;
    const blade = new T.Mesh(new T.PlaneGeometry(r * 3.2, o.bodyHeight * 1.05), new T.MeshBasicMaterial({color: STEEL, transparent: true, opacity: .16, depthWrite: false, side: T.DoubleSide}));
    blade.position.set(0, o.bodyHeight * .55, r * 1.9);
    const edge = new T.LineSegments(new T.EdgesGeometry(blade.geometry), new T.LineBasicMaterial({color: STEEL, transparent: true, opacity: .4}));edge.position.copy(blade.position);
    spin.add(disc);root.add(spin, blade, edge);
    return {root, spin, disc, blade, edge, dispose() {disc.geometry.dispose();disc.material.dispose();blade.geometry.dispose();blade.material.dispose();edge.geometry.dispose();edge.material.dispose();}};
  }
  makeBurst(o, pos, y, size, k) {
    const T = this.T, root = new T.Group(), r = o.halfExtent;
    const ring = new T.Mesh(new T.RingGeometry(r * .9, r * 1.1, 48), new T.MeshBasicMaterial({color: GOLD, transparent: true, opacity: .9, depthWrite: false, side: T.DoubleSide}));
    ring.rotation.x = -Math.PI / 2;ring.position.y = -o.bodyHeight * .6 + .05;   // a raiz está a 0,6 do corpo acima do chão; o anel fica rente ao chão
    const cross = new T.Group();
    const bar = new T.PlaneGeometry(r * 5, r * .28), cm = new T.MeshBasicMaterial({color: FLASH, transparent: true, opacity: 1, depthWrite: false, side: T.DoubleSide});
    const b1 = new T.Mesh(bar, cm), b2 = new T.Mesh(bar, cm);b1.rotation.z = Math.PI / 4;b2.rotation.z = -Math.PI / 4;cross.add(b1, b2);
    const flash = new T.Mesh(new T.SphereGeometry(r * 1.1, 14, 10), new T.MeshBasicMaterial({color: FLASH, transparent: true, opacity: .85, depthWrite: false}));
    root.position.set(pos.x, y, pos.z);root.add(ring, cross, flash);this.group.add(root);
    // a cruz e o clarão são billboards simples: olham para a câmera de cima do eixo Y (a mira do corte não depende do ângulo)
    return {root, ring: Object.assign(ring, {material: ring.material}), cross: Object.assign(cross, {material: cm}), flash, age: 0, life: .4, size, k, dispose() {ring.geometry.dispose();ring.material.dispose();bar.dispose();cm.dispose();flash.geometry.dispose();flash.material.dispose();}};
  }
  dispose() {for (const it of this.stances.values()) it.dispose();for (const b of this.bursts) b.dispose();this.stances.clear();this.bursts.length = 0;this.scene.remove(this.group);}
}
