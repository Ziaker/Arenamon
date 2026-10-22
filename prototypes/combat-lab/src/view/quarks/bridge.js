// Ponte entre a simulação e a camada three.quarks (Fase 2). Consome os MESMOS
// eventos que o VFX legado (view/vfx.js) — impacto, footstool, clash, carga,
// pouso e meteor slam — e os traduz em explosões/emissões contínuas do QuarksFx.
// Compartilhada pelo jogo (view/view.js) e pelo laboratório (quarks-lab/main.js).
// Não altera regras: só lê o estado da simulação.

import {C} from '../../sim/config.js';
import {altitudeOf} from '../../sim/entity.js';
import {QuarksFx} from './adapter.js';

/** Nível da carga (1..3), igual ao cálculo do som em main.js. */
export function chargeLevel(f) {
  return f.charge.pl ?? (f.charge.ticks >= (f.charge.params?.maxTicks ?? 180) ? 3 : f.charge.ticks >= (f.charge.params?.pl2Ticks ?? 90) ? 2 : 1);
}

export class QuarksBridge {
  constructor({THREE, Quarks, scene, presets = null, accessibility = null} = {}) {
    this.THREE = THREE;
    this.fx = new QuarksFx({THREE, Quarks, scene, accessibility, presets});
    this.anchors = [new THREE.Object3D(), new THREE.Object3D()];
    for (const a of this.anchors) scene.add(a);
    this._freshState();
    this.enabled = true;
  }

  _freshState() {
    this.state = {chargeOn: [false, false], chargePl: [1, 1], lastLanding: [0, 0], slamSeen: new WeakSet(), seen: new WeakSet()};
  }

  /** Posição no chão do lutador (o preset adiciona a altura do torso). */
  static groundPos(f) {
    return {x: f.position.x, y: f.groundY ?? 0, z: f.position.z};
  }

  /**
   * fighters: array da simulação; events: eventos do último passo; dt: segundos
   * (0 quando pausado — os efeitos congelam junto com o legado).
   */
  update(fighters, events, dt) {
    fighters.forEach((f, i) => {
      this.anchors[i].position.set(f.position.x, altitudeOf(f), f.position.z);
    });
    for (const e of events) {
      if (this.state.seen.has(e)) continue;
      this.state.seen.add(e);
      const a = fighters[e.attacker], b = fighters[e.target];
      if (e.result === 'impact' && b) {
        this.fx.emitBurst('impact', QuarksBridge.groundPos(b), {power: e.slam ? 1.5 : 1 + Math.min(1, (e.damage ?? 0) / 40)});
      } else if (e.result === 'footstool' && b) {
        this.fx.emitBurst('footstool', QuarksBridge.groundPos(b));
      } else if ((e.result === 'clash' || e.result === 'tackleClash' || e.result === 'stoneClash') && a && b) {
        const pa = QuarksBridge.groundPos(a), pb = QuarksBridge.groundPos(b);
        this.fx.emitBurst('impact', {x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 + .9, z: (pa.z + pb.z) / 2}, {power: .9, scale: .8});
      } else if (e.result === 'wallSplat' && b) {
        this.fx.emitBurst('impact', QuarksBridge.groundPos(b), {power: 1.3});
      }
    }
    fighters.forEach((f, i) => {
      // Efeito A: carga contínua com intensidade crescente e encerramento controlado.
      const key = `charge#${i}`;
      if (f.charge) {
        const pl = chargeLevel(f);
        this.fx.attach('charge', this.anchors[i], {key, intensity: .25 + .75 * (pl / 3)});
        this.state.chargeOn[i] = true;
        this.state.chargePl[i] = pl;
      } else if (this.state.chargeOn[i]) {
        this.state.chargeOn[i] = false;
        this.fx.detach(key);
        this.fx.emitBurst('charge', this.anchors[i].position, {power: 1 + .2 * (this.state.chargePl[i] ?? 1)});
      }
      // Efeito C + meteor slam: poeira proporcional à intensidade do contato.
      if (f.action?.slam && f.action.groundHit && !this.state.slamSeen.has(f.action)) {
        this.state.slamSeen.add(f.action);
        this.fx.emitBurst('landing', {x: f.position.x, y: f.groundY ?? 0, z: f.position.z}, {power: Math.min(2, C.rules.slamImpactScale ?? 1.5)});
      }
      const L = f.lastLanding;
      if (L && this.state.lastLanding[i] !== undefined && L.n !== this.state.lastLanding[i]) {
        const impact = L.vertical;
        if (impact >= C.vfx.ground.minImpact) {
          this.fx.emitBurst('landing', {x: L.x, y: 0, z: L.z}, {power: Math.min(2, impact / 7)});
        }
      }
      this.state.lastLanding[i] = L?.n ?? 0;
    });
    this.fx.update(dt);
  }

  reset() {
    this._freshState();
    for (let i = 0; i < 2; i++) this.fx.detach(`charge#${i}`, {graceful: false});
    this.fx.reset();
  }

  dispose() {
    for (const a of this.anchors) a.parent?.remove(a);
    this.fx.dispose();
  }
}
