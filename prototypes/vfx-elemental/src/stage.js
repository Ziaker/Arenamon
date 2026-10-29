import * as THREE from 'three';
import {FireEffects} from './effects/fire.js';
import {FlyingEffects} from './effects/flying.js';
import {PsychicEffects} from './effects/psychic.js';
import {createEarthboundMaterial, createFireMaterial, createParasiteBioMaterial, createPersonaGraphicMaterial, createWindFunnelMaterial} from './materials.js';
import {SHARED_GEOS, createFighterDummy} from './scene-assets.js';

// ============================================================================
// 5. PALCO 3D POR OPÇÃO (A, B, C) COM SUPORTE A PSÍQUICO, VOADOR E FOGO
// ============================================================================

export class OptionStage {
  constructor(optionIndex) {
    this.index = optionIndex;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(optionIndex === 0 ? 0x0b070c : optionIndex === 1 ? 0x09080c : 0x070612);

    const amb = new THREE.AmbientLight(0xdbeafe, 0.8);
    const dir = new THREE.DirectionalLight(0xffffff, 1.45);
    dir.position.set(4, 8, 5);
    const point = new THREE.PointLight(0xffffff, 2.2, 14);
    point.position.set(0, 2.2, 0);
    this.pointLight = point;
    this.scene.add(amb, dir, point);

    const floorMat = new THREE.MeshStandardMaterial({
      color: optionIndex === 0 ? 0x130d18 : optionIndex === 1 ? 0x121016 : 0x0e0c1e,
      roughness: 0.88,
      metalness: 0.15,
    });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 5.8, 0.12, 48), floorMat);
    floor.position.y = -0.06;
    this.scene.add(floor);

    const grid = new THREE.PolarGridHelper(5.4, 12, 6, 48, 0x2a243b, 0x1a1829);
    grid.position.y = 0.005;
    this.scene.add(grid);

    this.caster = createFighterDummy(0x2563eb, true);
    this.target = createFighterDummy(0xe11d48, false);
    this.caster.rotation.y = Math.PI / 2;
    this.target.rotation.y = -Math.PI / 2;
    this.scene.add(this.caster, this.target);

    this.fxRoot = new THREE.Group();
    this.scene.add(this.fxRoot);

    this.psychicShaderMat =
      optionIndex === 0
        ? createEarthboundMaterial()
        : optionIndex === 1
        ? createPersonaGraphicMaterial()
        : createParasiteBioMaterial();

    this.windFunnelMat = createWindFunnelMaterial(optionIndex);
    this.fireShaderMat = createFireMaterial(optionIndex);

    this.activeMeshCount = 0;
    this.lastAlpha = 1.0;
    this.buildReusableNodes();
  }

  buildReusableNodes() {
    this.nodes = {
      summonCore: new THREE.Group(),
      shaderShells: [],
      funnels: [],
      fireColumns: [],
      fireOrbs: [],
      crescents: [],
      dustPuffs: [],
      rings: [],
      shards: [],
      spikes: [],
      helixNodes: [],
      wireframes: [],
    };

    // Objeto central invocado (Psíquico)
    this.summonedMeshes = {
      boulder: new THREE.Mesh(
        SHARED_GEOS.boulder,
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.25, flatShading: true, transparent: true })
      ),
      monolith: new THREE.Mesh(
        SHARED_GEOS.monolith,
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.6, flatShading: true, transparent: true })
      ),
      polyhedron: new THREE.Group(),
      biocore: new THREE.Mesh(SHARED_GEOS.sphere, this.psychicShaderMat.clone()),
    };

    const m1 = new THREE.Mesh(
      SHARED_GEOS.octa,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.7, flatShading: true, transparent: true })
    );
    const m2 = new THREE.Mesh(
      SHARED_GEOS.octa,
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true })
    );
    m2.scale.setScalar(1.25);
    this.summonedMeshes.polyhedron.add(m1, m2);

    this.summonCage = new THREE.Mesh(
      SHARED_GEOS.icosaWire,
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true })
    );
    this.nodes.summonCore.add(this.summonCage);
    for (const m of Object.values(this.summonedMeshes)) {
      this.nodes.summonCore.add(m);
    }
    this.fxRoot.add(this.nodes.summonCore);

    // 4 Esferas com Shader Psíquico
    for (let i = 0; i < 4; i++) {
      const mat = this.psychicShaderMat.clone();
      const mesh = new THREE.Mesh(SHARED_GEOS.sphere, mat);
      this.fxRoot.add(mesh);
      this.nodes.shaderShells.push(mesh);
    }

    // 5 Funis de Tornado / Tufão 3D com Shader de Vento
    for (let i = 0; i < 5; i++) {
      const mat = this.windFunnelMat.clone();
      const mesh = new THREE.Mesh(SHARED_GEOS.funnel, mat);
      this.fxRoot.add(mesh);
      this.nodes.funnels.push(mesh);
    }

    // 5 Colunas / Línguas de Fogo 3D com Shader de Fogo (Mitológico / Sumi-e / Arcano)
    for (let i = 0; i < 5; i++) {
      const mat = this.fireShaderMat.clone();
      const mesh = new THREE.Mesh(SHARED_GEOS.flameColumn, mat);
      this.fxRoot.add(mesh);
      this.nodes.fireColumns.push(mesh);
    }

    // 4 Orbes / Domos de Fogo 3D com Shader de Fogo
    for (let i = 0; i < 4; i++) {
      const mat = this.fireShaderMat.clone();
      const mesh = new THREE.Mesh(SHARED_GEOS.sphere, mat);
      this.fxRoot.add(mesh);
      this.nodes.fireOrbs.push(mesh);
    }

    // 24 Lâminas Crescentes / Volutas Kaen / Pinceladas em Arco
    for (let i = 0; i < 24; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        blending: this.index === 1 ? THREE.NormalBlending : THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(this.index === 0 ? SHARED_GEOS.kaenScroll : SHARED_GEOS.crescentBlade, mat);
      this.fxRoot.add(mesh);
      this.nodes.crescents.push(mesh);
    }

    // 42 Volumes 3D de Poeira / Fumaça / Respingos de Tinta (Sumi-e)
    for (let i = 0; i < 42; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.85,
        metalness: 0.05,
        flatShading: this.index === 1,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(SHARED_GEOS.dustPuff, mat);
      this.fxRoot.add(mesh);
      this.nodes.dustPuffs.push(mesh);
    }

    // 16 Anéis Torus 3D
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        blending: this.index === 1 ? THREE.NormalBlending : THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(i % 2 === 0 ? SHARED_GEOS.ring : SHARED_GEOS.thinRing, mat);
      this.fxRoot.add(mesh);
      this.nodes.rings.push(mesh);
    }

    // 36 Fragmentos / Pétalas de Brasa / Cristais Arcanos 3D
    for (let i = 0; i < 36; i++) {
      const geo = i % 3 === 0 ? SHARED_GEOS.octa : i % 3 === 1 ? SHARED_GEOS.shardGlass : SHARED_GEOS.boulder;
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.65,
        roughness: 0.3,
        metalness: 0.25,
        flatShading: true,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.fxRoot.add(mesh);
      this.nodes.shards.push(mesh);
    }

    // 24 Pontas / Lanças de Chama & Nanquim
    for (let i = 0; i < 24; i++) {
      const group = new THREE.Group();
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
      const hullMat = new THREE.MeshBasicMaterial({
        color: 0x06040b,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
      });
      const core = new THREE.Mesh(SHARED_GEOS.needle, coreMat);
      const hull = new THREE.Mesh(SHARED_GEOS.needle, hullMat);
      hull.scale.set(1.34, 1.08, 1.34);
      group.add(core, hull);
      group.userData = { core, hull };
      this.fxRoot.add(group);
      this.nodes.spikes.push(group);
    }

    // 48 Fagulhas / Brasas / Wisps
    for (let i = 0; i < 48; i++) {
      const geo = this.index === 2 ? SHARED_GEOS.octa : SHARED_GEOS.sphere;
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.fxRoot.add(mesh);
      this.nodes.helixNodes.push(mesh);
    }

    // 6 Gaiolas / Selos Rúnicos / Polígonos Arcanos
    for (let i = 0; i < 6; i++) {
      const geo = this.index === 2 ? SHARED_GEOS.octa : SHARED_GEOS.icosaWire;
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.fxRoot.add(mesh);
      this.nodes.wireframes.push(mesh);
    }
  }

  hideAllPool() {
    this.nodes.summonCore.visible = false;
    for (const s of this.nodes.shaderShells) s.visible = false;
    for (const f of this.nodes.funnels) f.visible = false;
    for (const fc of this.nodes.fireColumns) fc.visible = false;
    for (const fo of this.nodes.fireOrbs) fo.visible = false;
    for (const c of this.nodes.crescents) c.visible = false;
    for (const d of this.nodes.dustPuffs) d.visible = false;
    for (const r of this.nodes.rings) r.visible = false;
    for (const s of this.nodes.shards) s.visible = false;
    for (const sp of this.nodes.spikes) sp.visible = false;
    for (const h of this.nodes.helixNodes) h.visible = false;
    for (const w of this.nodes.wireframes) w.visible = false;
    this.activeMeshCount = 0;
  }

  syncShaderUniforms(mat, params, alpha, time) {
    if (!mat.uniforms) return;
    mat.uniforms.uTime.value = time * params.velocity;
    mat.uniforms.uAlpha.value = alpha;
    mat.uniforms.uColor1.value.set(params.color);
    mat.uniforms.uColor2.value.set(params.color2);
    mat.uniforms.uColor3.value.set(params.color3);
    mat.uniforms.uFreq.value = params.pulseFreq;
    if (mat.uniforms.uTurbulence) mat.uniforms.uTurbulence.value = params.turbulence;
    if (mat.uniforms.uGlow) mat.uniforms.uGlow.value = params.glow * params.intensity;
  }

  update(elementKey, catKey, u, absTime) {
    this.hideAllPool();
    this.caster.position.set(-1.95, 0, 0);
    this.caster.rotation.set(0, Math.PI / 2, 0);
    this.target.position.set(1.95, 0, 0);
    this.target.rotation.set(0, -Math.PI / 2, 0);

    if (elementKey === 'fire') {
      this.updateFire(catKey, u, absTime);
    } else if (elementKey === 'flying') {
      this.updateFlying(catKey, u, absTime);
    } else {
      this.updatePsychic(catKey, u, absTime);
    }
  }

  // ==========================================================================
  // ABA 3: EFEITOS 3D DO TIPO FOGO (MITOLÓGICO JAPONÊS, TINTA SUMI-E, FOGO MÁGICO)
  // ==========================================================================
}

// Famílias de efeitos (um arquivo por família): copiadas para o protótipo de OptionStage; a API pública do palco não muda.
for (const Family of [FireEffects, FlyingEffects, PsychicEffects]) {
  for (const k of Object.getOwnPropertyNames(Family.prototype)) if (k !== 'constructor') Object.defineProperty(OptionStage.prototype, k, Object.getOwnPropertyDescriptor(Family.prototype, k));
}
