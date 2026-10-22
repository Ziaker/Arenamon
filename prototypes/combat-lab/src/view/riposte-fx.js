// @ts-check
// Efeito visual do Riposte (só aparência; não toca na simulação). Dois momentos:
//   • postura (ativação): disco de aço no chão + lâmina de guarda translucente à frente do lutador durante o cast; mais forte e dourada
//     dentro da janela do contra-golpe (windowStart–windowEnd) e apagada quando a janela fecha (resto = recuperação exposta);
//   • contra-golpe (evento 'riposteStrike'): clarão, anel de choque e corte em X no ponto entre os dois lutadores.
// Controles em C.world.riposte (capturados no uso): fxOn, fxIntensity, fxSize. `reduceMotion` desliga a pulsação; `noFlash` limita o brilho.
// Criada sob demanda pela View e descartada quando não há Riposte em andamento nem clarão ativo (custo zero fora do Move).
import {C} from '../sim/config.js';
const C_RIPOSTE = () => C.world.riposte, k1 = k => Math.min(1, k);
const STEEL = 0xbfe3ff, GOLD = 0xffd36a, FLASH = 0xffffff;
export class RiposteFx {
  /** @param {any} T three @param {any} scene */
  constructor(T, scene) {this.T = T;this.scene = scene;this.group = new T.Group();this.group.renderOrder = 810;scene.add(this.group);this.stances = new Map();this.bursts = [];this.blasts = [];this.t = 0;this.seen = new WeakSet();}
  /** Há algo a desenhar/limpar? */
  get active() {return this.stances.size > 0 || this.bursts.length > 0 || this.blasts.length > 0;}
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
    // Explosão provisória do contra-golpe: quando o golpe do Riposte ACERTA (evento de impacto marcado `riposte`), onda esférica, anéis no chão e em pé, faíscas radiais e clarão.
    for (const e of events) {
      if (e.result !== 'impact' || !e.riposte || this.seen.has(e)) continue;
      this.seen.add(e);
      const me = fighters[e.attacker], foe = fighters[e.target], P = me?.action?.params ?? C_RIPOSTE(), k = P.fxOn === 0 || P.blastOn === 0 ? 0 : (P.fxIntensity ?? 1);
      if (!foe || !k) continue;
      this.blasts.push(this.makeBlast(o, foe.position, (foe.flight?.y ?? foe.groundY ?? 0) + (foe.vaultHeight ?? 0), (P.blastSize ?? 1.5) * (P.fxSize ?? 1), k * cap, e.normal));
    }
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];b.age += dt;
      const u = Math.min(1, b.age / b.life), eo = 1 - (1 - u) * (1 - u) * (1 - u);
      b.sphere.scale.setScalar((.4 + eo * 2.4) * b.size);b.sphere.material.opacity = Math.max(0, 1 - u * 1.8) * .55 * b.k;
      b.ringG.scale.setScalar((.5 + eo * 4.2) * b.size);b.ringG.material.opacity = (1 - u) * .95 * b.k;
      b.ringV.scale.setScalar((.4 + eo * 3.2) * b.size);b.ringV.material.opacity = (1 - u) * .9 * b.k;
      b.core.scale.setScalar((.5 + u * .8) * b.size);b.core.material.opacity = Math.max(0, 1 - u * 2.6) * .95 * b.k;
      for (const s of b.sparks) {const d = (.5 + eo * s.reach) * b.size;s.mesh.position.set(s.dx * d, s.dy * d, s.dz * d);s.mesh.scale.set(.07 * b.size, .07 * b.size, (.25 + (1 - u) * .8) * b.size);s.mesh.material.opacity = Math.max(0, 1 - u * 1.4) * k1(b.k);}
      if (u >= 1) {this.group.remove(b.root);b.dispose();this.blasts.splice(i, 1);}
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
  /** Explosão do contra-golpe: tudo com materiais próprios (liberados no fim). */
  makeBlast(o, pos, base, size, k, normal) {
    const T = this.T, root = new T.Group(), r = o.halfExtent, mats = [], geos = [];
    const mat = (color, op) => {const m = new T.MeshBasicMaterial({color, transparent: true, opacity: op, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending});mats.push(m);return m;};
    const sphere = new T.Mesh(new T.SphereGeometry(r * 1.4, 18, 12), mat(GOLD, .55)), core = new T.Mesh(new T.SphereGeometry(r * 1.1, 14, 10), mat(FLASH, .95));
    const ringG = new T.Mesh(new T.RingGeometry(r * .9, r * 1.2, 56), mat(GOLD, .95)), ringV = new T.Mesh(new T.RingGeometry(r * .9, r * 1.15, 56), mat(FLASH, .9));
    ringG.rotation.x = -Math.PI / 2;ringG.position.y = -o.bodyHeight * .55 + .06;
    const nx = normal?.x ?? 0, nz = normal?.z ?? 1;ringV.rotation.y = Math.atan2(nx, nz);   // anel em pé, de frente para o golpe
    const spGeo = new T.BoxGeometry(1, 1, 1), sparks = [];geos.push(spGeo);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + (i % 2) * .17, up = (((i * 7) % 5) - 1.5) * .35, l = Math.hypot(Math.cos(a), up, Math.sin(a)), dx = Math.cos(a) / l, dy = up / l, dz = Math.sin(a) / l;
      const m = new T.Mesh(spGeo, mat(i % 3 ? GOLD : FLASH, 1));m.lookAt(dx, dy, dz);root.add(m);sparks.push({mesh: m, dx, dy, dz, reach: 2.2 + (i % 4) * .7});
    }
    for (const g of [sphere, core, ringG, ringV]) {geos.push(g.geometry);root.add(g);}
    root.position.set(pos.x, base + o.bodyHeight * .55, pos.z);this.group.add(root);
    return {root, sphere, core, ringG, ringV, sparks, age: 0, life: .55, size, k, dispose() {for (const g of geos) g.dispose();for (const m of mats) m.dispose();}};
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
  dispose() {for (const it of this.stances.values()) it.dispose();for (const b of this.bursts) b.dispose();for (const b of this.blasts) b.dispose();this.stances.clear();this.bursts.length = 0;this.blasts.length = 0;this.scene.remove(this.group);}
}
