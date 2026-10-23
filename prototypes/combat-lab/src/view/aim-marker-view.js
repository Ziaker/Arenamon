// @ts-check
// Marcador de mira dos Moves com destino (Spikes, Emerging Stone, Fire Spin e Seed Bomb): anel no chão no ponto escolhido (verde = válido, vermelho = inválido), coluna de luz.
// O raio do anel mostra o EFEITO REAL da zona/explosão (zoneRadius/explosionRadius) quando o Move os tem.
// Também desenha (22/10/2026): o CÍRCULO DE ALCANCE dos Moves de alvo único (Quick Attack, Bullet Punch) ao redor do lutador enquanto o botão está segurado (azul = há alvo dentro,
// vermelho = não há; pisca vermelho ao soltar sem alvo) e as LINHAS DE VELOCIDADE do sumiço (Bullet Punch e Quick Attack: linhas na ida, outras de cor quente na volta do Quick Attack).
// Só aparência: lê `f.aim`, `f.rangeFlash` e a ação em curso (estado da simulação) e nunca os altera. Criado sob demanda pela View e descartado quando
// ninguém precisa dele (custo zero fora dos Moves). `reduceMotion` desliga a pulsação.
import {C} from '../sim/config.js';
const OK = 0x6dffa8, BAD = 0xff5566, BLUE = 0x59b4ff, LINES_GO = 0xe8f1ff, LINES_BACK = 0xffc27a;
export class AimMarkers {
  /** @param {any} T three @param {any} scene */
  constructor(T, scene) {this.T = T;this.scene = scene;this.group = new T.Group();this.group.renderOrder = 900;scene.add(this.group);this.items = new Map();this.t = 0;}
  /** @param {any[]} fighters @param {number} dt @param {{reduceMotion?: boolean}} o */
  update(fighters, dt, o) {
    this.t += dt;
    const live = new Set(), R = C.display?.rangeRing ?? {rangeOn: 1, flashTime: .7, rangeOpacity: .85, rangeWidth: .2, rangeFill: .12, rangeWall: .35};
    for (const f of fighters) {
      const a = f.aim;if (!a || f.hp <= 0 || a.range) continue;
      if (f.id !== 0 && a.def?.castFirst) continue;   // adversários não enxergam o marcador do Emerging Stone durante a mira (ES)
      live.add(f.id);
      let it = this.items.get(f.id);
      if (!it) {it = this.make();this.items.set(f.id, it);this.group.add(it.root);}
      const col = a.valid ? OK : BAD, r = Math.max(.3, a.params?.zoneRadius ?? a.params?.explosionRadius ?? a.params?.radius ?? .6), pulse = o.reduceMotion ? 1 : 1 + Math.sin(this.t * 8) * .04;
      it.root.position.set(a.pos.x, a.y + .04, a.pos.z);
      it.ring.scale.set(r * pulse, 1, r * pulse);
      it.pillar.scale.set(1, 1.4, 1);it.pillar.position.y = .7;
      for (const m of it.mats) m.color.setHex(col);
    }
    // Círculo de alcance (Moves de alvo único): só o do jogador (azul); o do adversário não é mostrado
    for (const f of fighters) {
      if (f.id !== 0 || f.hp <= 0 || !R.rangeOn) continue;
      const a = f.aim?.range ? f.aim : null, fl = f.rangeFlash;
      if (!a && !fl) continue;
      const key = `r${f.id}`;live.add(key);
      let it = this.items.get(key);
      if (!it) {it = this.makeRange();this.items.set(key, it);this.group.add(it.root);}
      const radius = Math.max(.5, a ? a.rangeValue : fl.range), col = a ? (a.inRange ? BLUE : BAD) : BAD, pulse = o.reduceMotion || !a ? 1 : 1 + Math.sin(this.t * 7) * .012, wallH = R.rangeWall ?? .35;
      if (Math.abs(it.radius - radius) > .005 || it.width !== Math.max(.02, R.rangeWidth) || it.wallH !== wallH) this.rebuildRing(it, radius, Math.max(.02, R.rangeWidth), wallH);
      it.root.position.set(f.position.x, (f.flight?.y ?? f.groundY ?? 0) + (f.vaultHeight ?? 0) + .05, f.position.z);
      it.root.scale.set(pulse, 1, pulse);
      const k = (a ? 1 : Math.max(0, fl.t / Math.max(1e-6, fl.total))) * R.rangeOpacity;
      it.mat.color.setHex(col);it.mat.opacity = k;it.fillMat.color.setHex(col);it.fillMat.opacity = k * (R.rangeFill ?? .12);it.wallMat.color.setHex(col);it.wallMat.opacity = k * .3;
    }
    // Linhas de velocidade do sumiço: Bullet Punch (corrida invisível) e Quick Attack (ida e volta)
    for (const f of fighters) {
      const p = this.pathOf(f);
      const key = `s${f.id}`;
      if (!p) continue;
      live.add(key);
      let it = this.items.get(key);
      if (!it) {it = this.makeLines();this.items.set(key, it);this.group.add(it.root);}
      const dx = p.to.x - p.from.x, dz = p.to.z - p.from.z, len = Math.max(.01, Math.hypot(dx, dz)), yaw = Math.atan2(dx, dz);
      it.root.position.set(p.from.x, p.y + .6, p.from.z);it.root.rotation.y = yaw;
      for (const m of it.mats) m.color.setHex(p.color);
      const seg = Math.min(len, 2.4);
      it.lines.forEach((l, i) => {
        const ph = o.reduceMotion ? .5 : (this.t * 3.2 + i / it.lines.length) % 1;
        l.scale.set(.035, .035, seg * .55);l.position.set((i % 4 - 1.5) * .2, Math.sin(i * 1.7) * .28, ph * Math.max(0, len - seg * .55) + seg * .27);l.material.opacity = .85 * (1 - Math.abs(ph - .5) * 1.5);
      });
    }
    for (const [id, it] of [...this.items]) if (!live.has(id)) {this.group.remove(it.root);it.dispose();this.items.delete(id);}
  }
  /** Trajeto das linhas de velocidade deste lutador agora, ou null. */
  pathOf(/** @type {any} */ f) {
    const a = f.action, P = a?.params;
    if (!a || f.hp <= 0 || !P || P.fxLines === 0) return null;
    const y = f.groundY ?? 0;
    if (f.absent && a.travel) return {from: a.travel.from, to: a.travel.to, y, color: LINES_GO};   // Bullet Punch: do ponto de partida até onde vai reaparecer
    const q = a.qa;
    if (q && q.phase === 'approach') return {from: q.origin, to: f.position, y, color: LINES_GO};         // Quick Attack, ida
    if (q && q.phase === 'return') return {from: f.position, to: q.origin, y, color: LINES_BACK};        // Quick Attack, volta: outras linhas, de cor quente
    return null;
  }
  makeRange() {
    const T = this.T, root = new T.Group(), mk = () => new T.MeshBasicMaterial({color: BLUE, transparent: true, opacity: .75, depthWrite: false, side: T.DoubleSide});
    const mat = mk(), fillMat = mk(), wallMat = mk();
    const ring = new T.Mesh(new T.RingGeometry(.9, 1, 96), mat);ring.rotation.x = -Math.PI / 2;ring.renderOrder = 900;root.add(ring);
    const fill = new T.Mesh(new T.CircleGeometry(1, 64), fillMat);fill.rotation.x = -Math.PI / 2;fill.position.y = -.01;fill.renderOrder = 899;root.add(fill);   // disco translúcido: o alcance também se lê de longe e de lado
    const wall = new T.Mesh(new T.CylinderGeometry(1, 1, .35, 64, 1, true), wallMat);wall.renderOrder = 899;root.add(wall);                                    // parede baixa em volta, para o círculo aparecer mesmo de perfil
    return {root, ring, fill, wall, mat, fillMat, wallMat, radius: 1, width: 0, wallH: 0, dispose: () => {ring.geometry.dispose();fill.geometry.dispose();wall.geometry.dispose();mat.dispose();fillMat.dispose();wallMat.dispose();}};
  }
  /** Anel de largura CONSTANTE em metros: recria a geometria quando o raio muda. */
  rebuildRing(/** @type {any} */ it, /** @type {number} */ radius, /** @type {number} */ width, /** @type {number} */ wallH) {
    const T = this.T, seg = Math.max(48, Math.round(radius * 18));
    it.ring.geometry.dispose();it.ring.geometry = new T.RingGeometry(Math.max(.01, radius - width), radius, seg);
    it.fill.geometry.dispose();it.fill.geometry = new T.CircleGeometry(radius, seg);
    it.wall.geometry.dispose();it.wall.geometry = new T.CylinderGeometry(radius, radius, Math.max(.001, wallH), seg, 1, true);it.wall.position.y = wallH / 2;it.wall.visible = wallH > 0;
    it.radius = radius;it.width = width;it.wallH = wallH;
  }
  makeLines() {
    const T = this.T, root = new T.Group(), geo = new T.BoxGeometry(1, 1, 1), mats = [];
    const lines = [0, 1, 2, 3, 4, 5, 6, 7].map(() => {const m = new T.MeshBasicMaterial({color: LINES_GO, transparent: true, opacity: .6, depthWrite: false});mats.push(m);return new T.Mesh(geo, m);});
    lines.forEach(l => root.add(l));
    return {root, lines, mats, dispose: () => {geo.dispose();mats.forEach(m => m.dispose());}};
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
