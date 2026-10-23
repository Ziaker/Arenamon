// @ts-check
// Fase 3 (Yuka): trajetórias e pontos de navegação no jogo (diagnóstico). Só desenha; não toca na simulação.
// Ligado por extras.nav.enableNav + extras.nav.showDebug; desligado, nada é criado.
import {getNavGraph} from './nav-graph.js';

export class NavDebug {
  constructor(THREE, scene) {
    this.T = THREE;this.scene = scene;this.group = new THREE.Group();this.group.renderOrder = 950;scene.add(this.group);this.items = [];
  }
  clear() {
    for (const o of this.items) {this.group.remove(o);o.geometry.dispose();o.material.dispose();}
    this.items = [];
  }
  update(game) {
    const T = this.T;this.clear();
    const nav = getNavGraph(game.mapState);
    const pairs = [[game.playerBrain, game.fighters[0], 0x6fc9ff], [game.brain, game.fighters[1], 0x7dffb0]];
    for (const [brain, f, color] of pairs) {
      const st = brain.nav;
      if (!st?.path?.length || st.status === 'direct' || f.hp <= 0) continue;
      const pts = [new T.Vector3(f.position.x, (f.groundY ?? 0) + (f.flight?.y ?? 0) + .25, f.position.z)];
      for (let i = st.i; i < st.path.length; i++) {const n = nav.nodes[st.path[i]];pts.push(new T.Vector3(n.x, n.y + .25, n.z));}
      const line = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({color, depthTest: false, transparent: true}));
      line.renderOrder = 951;this.group.add(line);this.items.push(line);
      const g = nav.nodes[st.goal];
      if (g) {
        const m = new T.Mesh(new T.SphereGeometry(.22, 12, 8), new T.MeshBasicMaterial({color: st.status === 'unreachable' ? 0xff9f43 : color, depthTest: false}));
        m.position.set(g.x, g.y + .3, g.z);m.renderOrder = 952;this.group.add(m);this.items.push(m);
      }
    }
  }
  dispose() {this.clear();this.scene.remove(this.group);}
}
