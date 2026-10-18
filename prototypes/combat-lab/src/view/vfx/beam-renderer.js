// @ts-check
// BeamRenderer — renderizador dedicado, desacoplado e contínuo para lasers (Fase 7 e M17/M20).
// Consome snapshot read-only da simulação (world.entities com kind === 'beam' e seus segmentos).
// Não altera física, colisores, regras ou dano do laser.
//
// Camadas por segmento:
//   1. Núcleo (Core): geometria clara contínua, alta legibilidade, NUNCA suprimido (mesmo em Low).
//   2. Halo (Glow): camada aditiva difusa externa com cor do Power Level (PL1 ciano, PL2 âmbar, PL3 magenta).
//   3. Compensação Frontal: alarga o halo quando o feixe se alinha com a linha de visada da câmera.
//   4. Muzzle: billboard emissor na origem seg[0].a.
//   5. Contato Contínuo: flare focal e spray de centelhas orientado pela normal no ponto de impacto seg[i].b.
//   6. Nó de Reflexão: flash na face da barreira refletora com transição para o novo dono.
//   7. Neutralização: colapso desbotado quando PL feixe > PL barreira.

import * as T from 'three';

export const BEAM_PL_COLORS = Object.freeze({
  1: {core: 0xffffff, halo: 0x59d6e6, spark: 0x8cedf8}, // PL1: ciano elétrico
  2: {core: 0xfffcf0, halo: 0xffcf6a, spark: 0xffdf88}, // PL2: âmbar / dourado
  3: {core: 0xffffff, halo: 0xff6adf, spark: 0xff99ea}, // PL3: magenta / caótico
});

export const BEAM_DEFAULTS = Object.freeze({
  enabled: true,
  pl: 1,
  // Núcleo
  coreWidth1: 0.04,
  coreWidth2: 0.065,
  coreWidth3: 0.095,
  coreOpacity: 0.95,
  // Halo
  haloWidth1: 0.15,
  haloWidth2: 0.24,
  haloWidth3: 0.38,
  haloOpacity: 0.65,
  // Dinâmica
  intensity: 1.2,
  pulseFreq: 2.0, // 1-3 Hz (seguro contra fotossensibilidade)
  flowSpeed: 24,  // velocidade visual de fluxo UV (m/s)
  muzzleSize: 0.28,
  contactSize: 0.35,
  sparksPerSecond: 20,
  // Acessibilidade
  reduceMotion: false,
  noFlash: false,
  highContrast: false,
});

export class BeamRenderer {
  /**
   * @param {T.Scene} scene
   * @param {object} [opts]
   */
  constructor(scene, {maxBeams = 4, maxSegments = 8, quality = 'medium'} = {}) {
    this.scene = scene;
    this.maxBeams = maxBeams;
    this.maxSegments = maxSegments;
    this.quality = quality;
    this.enabled = true;
    this.time = 0;
    this.sparkAcc = 0;

    this.group = new T.Group();
    this.group.name = 'beam-renderer-group';
    this.group.renderOrder = 860;
    scene.add(this.group);

    // Geometrias reutilizáveis base (cilindro orientado ao longo do eixo Z)
    const coreGeo = new T.CylinderGeometry(1, 1, 1, 8, 1, false);
    coreGeo.rotateX(Math.PI / 2);
    const haloGeo = new T.CylinderGeometry(1, 1, 1, 12, 1, true);
    haloGeo.rotateX(Math.PI / 2);

    // Geometria de billboard para muzzle e pontos de contato
    const planeGeo = new T.PlaneGeometry(1, 1);

    // Pools pré-alocados por feixe e por segmento
    this.beams = [];
    for (let b = 0; b < maxBeams; b++) {
      const beamGroup = new T.Group();
      beamGroup.visible = false;
      this.group.add(beamGroup);

      // Muzzle na origem
      const muzzleMat = new T.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        blending: T.AdditiveBlending,
        depthWrite: false,
      });
      const muzzleMesh = new T.Mesh(planeGeo, muzzleMat);
      muzzleMesh.visible = false;
      muzzleMesh.renderOrder = 865;
      beamGroup.add(muzzleMesh);

      const segments = [];
      for (let s = 0; s < maxSegments; s++) {
        // Núcleo
        const coreMat = new T.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
        });
        const coreMesh = new T.Mesh(coreGeo, coreMat);
        coreMesh.visible = false;
        coreMesh.renderOrder = 862;
        beamGroup.add(coreMesh);

        // Halo aditivo
        const haloMat = new T.MeshBasicMaterial({
          color: 0x59d6e6,
          transparent: true,
          opacity: 0.65,
          blending: T.AdditiveBlending,
          depthWrite: false,
          side: T.DoubleSide,
        });
        const haloMesh = new T.Mesh(haloGeo, haloMat);
        haloMesh.visible = false;
        haloMesh.renderOrder = 861;
        beamGroup.add(haloMesh);

        // Flare no ponto final do segmento (contato ou reflexão)
        const flareMat = new T.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.9,
          blending: T.AdditiveBlending,
          depthWrite: false,
          side: T.DoubleSide,
        });
        const flareMesh = new T.Mesh(planeGeo, flareMat);
        flareMesh.visible = false;
        flareMesh.renderOrder = 866;
        beamGroup.add(flareMesh);

        segments.push({coreMesh, haloMesh, flareMesh, coreMat, haloMat, flareMat});
      }

      this.beams.push({beamGroup, muzzleMesh, muzzleMat, segments, entityId: null});
    }

    this.config = {...BEAM_DEFAULTS};
  }

  setQuality(q) {
    this.quality = q;
  }

  setConfig(cfg) {
    Object.assign(this.config, cfg);
  }

  reset() {
    for (const b of this.beams) {
      b.entityId = null;
      b.beamGroup.visible = false;
      b.muzzleMesh.visible = false;
      for (const s of b.segments) {
        s.coreMesh.visible = false;
        s.haloMesh.visible = false;
        s.flareMesh.visible = false;
      }
    }
    this.time = 0;
    this.sparkAcc = 0;
  }

  /**
   * Atualiza e projeta os feixes a partir do mundo da simulação.
   * @param {any} world - game.world (lido de forma estritamente somente leitura)
   * @param {number} dt - delta time em segundos
   * @param {object} [ctx] - {camera, particleBatch, cameraFeedback}
   */
  update(world, dt, {camera = null, particleBatch = null, cameraFeedback = null} = {}) {
    if (!this.enabled || !this.config.enabled) {
      this.reset();
      return 0;
    }

    const frameDt = Math.min(dt, 0.05);
    this.time += frameDt;
    const cfg = this.config;

    // Coletar entidades do tipo beam da simulação
    const beamEntities = (world?.entities || []).filter((/** @type {any} */ e) => e.kind === 'beam' && !e.dead);
    const activeCount = Math.min(beamEntities.length, this.maxBeams);

    // Ocultar feixes extras
    for (let b = activeCount; b < this.maxBeams; b++) {
      this.beams[b].entityId = null;
      this.beams[b].beamGroup.visible = false;
    }

    if (activeCount === 0) return 0;

    const camPos = camera?.position || new T.Vector3(0, 10, 15);
    const pulseTime = cfg.reduceMotion ? 0 : this.time;
    // Pulsação suave limitada a 1-3 Hz
    const pulseFactor = 1.0 + 0.08 * Math.sin(pulseTime * Math.PI * 2 * cfg.pulseFreq);

    for (let bIdx = 0; bIdx < activeCount; bIdx++) {
      const e = beamEntities[bIdx];
      const slot = this.beams[bIdx];
      slot.entityId = e.id;
      slot.beamGroup.visible = true;

      const segments = e.segments || [];
      const pl = Math.max(1, Math.min(3, e.pl ?? cfg.pl ?? 1));
      const col = BEAM_PL_COLORS[pl] || BEAM_PL_COLORS[1];

      // Configurações por PL
      let coreW = pl === 1 ? cfg.coreWidth1 : pl === 2 ? cfg.coreWidth2 : cfg.coreWidth3;
      let haloW = pl === 1 ? cfg.haloWidth1 : pl === 2 ? cfg.haloWidth2 : cfg.haloWidth3;
      if (cfg.highContrast) {
        coreW *= 1.25;
        haloW *= 1.15;
      }

      // 1. Muzzle Flash na origem do feixe (seg[0].a)
      if (segments.length > 0) {
        const seg0 = segments[0];
        const mPos = seg0.a;
        slot.muzzleMesh.visible = !cfg.noFlash;
        if (slot.muzzleMesh.visible) {
          slot.muzzleMesh.position.set(mPos.x, e.y, mPos.z);
          slot.muzzleMesh.lookAt(camPos);
          const mSize = cfg.muzzleSize * (pl === 1 ? 1.0 : pl === 2 ? 1.3 : 1.7) * pulseFactor;
          slot.muzzleMesh.scale.set(mSize, mSize, 1);
          slot.muzzleMat.color.setHex(col.core);
          slot.muzzleMat.opacity = cfg.coreOpacity * (pl === 3 ? 1.0 : 0.85);
        }
      } else {
        slot.muzzleMesh.visible = false;
      }

      // 2. Segmentos
      const maxSeg = Math.min(segments.length, this.maxSegments);
      for (let sIdx = 0; sIdx < this.maxSegments; sIdx++) {
        const sSlot = slot.segments[sIdx];
        if (sIdx >= maxSeg) {
          sSlot.coreMesh.visible = false;
          sSlot.haloMesh.visible = false;
          sSlot.flareMesh.visible = false;
          continue;
        }

        const seg = segments[sIdx];
        const a = seg.a;
        const b = seg.b;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz);

        if (len < 1e-4) {
          sSlot.coreMesh.visible = false;
          sSlot.haloMesh.visible = false;
          sSlot.flareMesh.visible = false;
          continue;
        }

        // Posição central e orientação do segmento
        const midX = (a.x + b.x) / 2;
        const midZ = (a.z + b.z) / 2;
        const dirX = dx / len;
        const dirZ = dz / len;

        // Ângulo em relação à câmera para compensação frontal (visada direta)
        const toCamX = camPos.x - midX;
        const toCamZ = camPos.z - midZ;
        const toCamDist = Math.hypot(toCamX, toCamZ) || 1;
        const dotCam = Math.abs((dirX * toCamX + dirZ * toCamZ) / toCamDist);

        // Fator de alargamento radial para nunca sumir em visão frontal
        let cameraComp = 1.0;
        if (dotCam > 0.70) {
          cameraComp += 2.8 * Math.pow(dotCam - 0.70, 2);
        }

        // --- Núcleo (Core): sempre visível ---
        sSlot.coreMesh.visible = true;
        sSlot.coreMesh.position.set(midX, e.y, midZ);
        sSlot.coreMesh.rotation.y = Math.atan2(dx, dz);
        const curCoreW = coreW * cameraComp;
        sSlot.coreMesh.scale.set(curCoreW, curCoreW, len);

        if (seg.neutralized) {
          if (cfg.neutralizeActive === 0) {
            sSlot.coreMesh.visible = false;
            sSlot.haloMesh.visible = false;
            sSlot.flareMesh.visible = false;
            continue;
          }
          sSlot.coreMat.color.setHex(0xd0d0d0);
          sSlot.coreMat.opacity = 0.35;
        } else {
          sSlot.coreMat.color.setHex(col.core);
          sSlot.coreMat.opacity = cfg.coreOpacity;
        }

        // --- Halo (Glow): desativado somente em Low extremo ou suprimido ---
        const isLow = this.quality === 'low' || cfg.quality === 0;
        const allowHalo = !isLow || sIdx === 0;
        sSlot.haloMesh.visible = allowHalo;
        if (allowHalo) {
          sSlot.haloMesh.position.set(midX, e.y, midZ);
          sSlot.haloMesh.rotation.y = Math.atan2(dx, dz);
          const curHaloW = haloW * pulseFactor * cameraComp * (cfg.intensity || 1.0);
          sSlot.haloMesh.scale.set(curHaloW, curHaloW, len);

          if (seg.neutralized) {
            sSlot.haloMat.color.setHex(0x888888);
            sSlot.haloMat.opacity = 0.15;
          } else {
            // Se o trecho tiver dono próprio (reflexão), usar a cor do dono
            const segOwnerCol = seg.pl ? (BEAM_PL_COLORS[Math.min(3, seg.pl)] || col) : col;
            sSlot.haloMat.color.setHex(segOwnerCol.halo);
            sSlot.haloMat.opacity = cfg.haloOpacity * (pl === 3 ? 0.8 : 0.6);
          }
        }

        // --- Ponto de Contato / Flare Final / Reflexão ---
        const isLastSegment = sIdx === maxSeg - 1;
        const isReflectionNode = seg.by != null;
        let showFlare = false;
        if (isLastSegment || seg.neutralized) {
          showFlare = true;
        } else if (isReflectionNode) {
          showFlare = cfg.reflectionActive !== 0;
        }
        sSlot.flareMesh.visible = showFlare && !cfg.noFlash;

        if (sSlot.flareMesh.visible) {
          sSlot.flareMesh.position.set(b.x, e.y, b.z);
          sSlot.flareMesh.lookAt(camPos);
          const flareS = cfg.contactSize * (pl === 1 ? 1.0 : pl === 2 ? 1.4 : 1.9) * pulseFactor;
          sSlot.flareMesh.scale.set(flareS, flareS, 1);
          sSlot.flareMat.color.setHex(seg.neutralized ? 0xffffff : col.spark);
          sSlot.flareMat.opacity = seg.neutralized ? 0.5 : 0.85;

          // Spray contínuo de centelhas no ponto de impacto
          if (particleBatch && !cfg.reduceMotion && !isLow && (cfg.sparksPerSecond || 0) > 0) {
            this.sparkAcc += frameDt * cfg.sparksPerSecond;
            while (this.sparkAcc >= 1.0) {
              this.sparkAcc -= 1.0;
              const spAngle = Math.random() * Math.PI * 2;
              const spSpeed = 2.5 + Math.random() * 3.5;
              particleBatch.add({
                cell: 7, // spark
                mode: 0, // billboard
                x: b.x,
                y: e.y + (Math.random() - 0.5) * 0.1,
                z: b.z,
                vx: Math.cos(spAngle) * spSpeed,
                vy: 0.5 + Math.random() * 2.0,
                vz: Math.sin(spAngle) * spSpeed,
                drag: 4.0,
                gravity: 10,
                life: 0.22,
                age: 0,
                w: 0.08 * (pl === 3 ? 1.4 : 1.0),
                h: 0.08 * (pl === 3 ? 1.4 : 1.0),
                color: col.spark,
                alpha: 0.9,
                fade: 1.8,
                additive: true,
              });
            }
          }
        }
      }
    }

    return activeCount;
  }

  dispose() {
    this.scene.remove(this.group);
    for (const b of this.beams) {
      b.muzzleMesh.geometry?.dispose();
      b.muzzleMat?.dispose();
      for (const s of b.segments) {
        s.coreMesh.geometry?.dispose();
        s.coreMat?.dispose();
        s.haloMesh.geometry?.dispose();
        s.haloMat?.dispose();
        s.flareMesh.geometry?.dispose();
        s.flareMat?.dispose();
      }
    }
    this.beams = [];
  }
}
