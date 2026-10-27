// @ts-check
// Desenho das entidades do mundo (projéteis, barreiras, paredes, áreas) e dos Moves:
// - Barreira do Reflect: grelha cristalina/hexagonal, pulsação de energia e estilhaçamento ao quebrar;
// - Pedras do Psyshock: modelos 3D rochosos facetados (Boulder, Cristal Psíquico, Meteorito), rotação física em voo,
//   núcleos luminosos de Power Level (PL1 ciano, PL2 âmbar, PL3 magenta), rastro de partículas e estilhaços ao impacto;
// - Prévia da barreira (com indicação de carga mínima de 1,5 s) e pedras levitantes facetadas ao redor do lutador;
// - Anéis de impacto e fragmentos físicos reativos para disputas, reflexões e destruições.
// É só representação: o desenho lê o estado e os eventos da simulação e nunca decide nada.

import * as T from 'three';






import {ElementalGameFx} from './quarks/elemental-game.js';
import {AtelierGameFx} from './quarks/atelier-game.js';
import {MovesVfxRegistry} from './moves-vfx-registry.js';


import {buildRockGeometry} from './world-view/wv-geometry.js';
import {wvEntities} from './world-view/wv-entities.js';
import {wvParticles} from './world-view/wv-particles.js';
import {wvUpdate} from './world-view/wv-update.js';
import {wvMap} from './world-view/wv-map.js';

// Fachada: o conteúdo foi dividido em módulos menores (pasta world-view/); os nomes exportados continuam os mesmos.
export * from './world-view/wv-geometry.js';

/** Um eixo do teste raio × caixa (sem alocar): estreita [slabT0, slabT1]; false se o raio paralelo está fora da caixa. */
export class WorldView {
  constructor(scene) {
    this.group = new T.Group();
    this.group.renderOrder = 800;
    scene.add(this.group);
    this.meshes = new Map();
    this.time = 0;
    this.seen = new WeakSet();
    this.rings = [];
    this.particles = [];
    this.orbs = [[], []];
    this.waterOrbs = [null, null];   // esfera de água que cresce na mão durante a carga do Water Pulse
    this.preview = new T.Mesh(
      new T.BoxGeometry(1, 1, 1),
      new T.MeshBasicMaterial({color: 0x59e68a, transparent: true, opacity: .26, depthWrite: false, side: T.DoubleSide})
    );
    this.preview.visible = false;
    this.preview.renderOrder = 801;
    this.group.add(this.preview);

    // Anéis de carga 3D no chão para cada lutador (QoL 5)
    this.chargeRings = [this.createChargeRing(), this.createChargeRing()];

    // Cache de geometrias de rocha
    this.rockGeos = [buildRockGeometry(0), buildRockGeometry(1), buildRockGeometry(2)];
    this.trailTimer = 0;
    this.accessibility = {noFlash: false, reduceMotion: false, highContrast: false};
    // Água, Fogo e Vento com o renderizador do Ateliê Elemental (three.quarks). O Seed Bomb não entra aqui.
    this.elementalFx = new ElementalGameFx(this.group);
    this.atelierFx = new AtelierGameFx(this.group);   // Sand Wave e Emerging Stone com o renderizador do atelier Areia/Pedra
    this.movesVfx = new MovesVfxRegistry(this);       // Registro modular de VFX dos Moves (Doc 02)
    this.fighters = [];
    // Esfera de carga do Water Pulse (visual do ateliê, cresce com a carga/PL).
    this.waterChargePreview = null;this.waterChargeLevel = 0;
  }

  setAccessibility(a = {}) {
    this.accessibility = {...this.accessibility, ...a};
  }

  reset() {
    this.elementalFx?.clear();
    this.atelierFx?.clear();
    this.movesVfx?.disposeAll();
    this.seen = new Set();
    if (this.rings) {
      for (const r of this.rings) {
        if (r.mesh) {
          this.group.remove(r.mesh);
          r.mesh.geometry?.dispose();
          r.mesh.material?.dispose();
        }
      }
      this.rings = [];
    }
    if (this.particles) {
      for (const p of this.particles) {
        if (p.mesh) {
          this.group.remove(p.mesh);
          p.mesh.geometry?.dispose();
          p.mesh.material?.dispose();
        }
      }
      this.particles = [];
    }
    if (this.meshes) {
      for (const [id, m] of this.meshes) {
        this.group.remove(m);
        m.traverse(o => {
          o.geometry?.dispose();
          if (Array.isArray(o.material)) o.material.forEach(mat => mat.dispose());
          else o.material?.dispose();
        });
      }
      this.meshes.clear();
    }
  }
}

// Métodos divididos em módulos menores (pasta world-view/): mesmos corpos, agora anexados ao protótipo.
Object.assign(WorldView.prototype, wvEntities, wvParticles, wvUpdate, wvMap);
