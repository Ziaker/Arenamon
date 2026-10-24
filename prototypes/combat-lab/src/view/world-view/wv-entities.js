// Dividido de world-view.js (comportamento idêntico): métodos de WorldView — wv-entities.
// Mixin: Object.assign(WorldView.prototype, wvEntities) no arquivo original.

import * as T from 'three';
import {C, rgb} from '../../sim/config.js';
import {makeElemental} from '../elemental-fx.js';
import {PL_HEX, buildForceFieldGeometry, buildHexGridGeometry, buildQuartzGeometry} from './wv-geometry.js';


export const wvEntities = {
createChargeRing() {
    const geo = new T.RingGeometry(0.65, 0.85, 32);
    geo.rotateX(-Math.PI / 2);
    const mat = new T.MeshBasicMaterial({
      color: 0x59d6e6,
      transparent: true,
      opacity: 0,
      side: T.DoubleSide,
      depthWrite: false,
    });
    const mesh = new T.Mesh(geo, mat);
    mesh.visible = false;
    mesh.renderOrder = 805;
    this.group.add(mesh);
    return mesh;
  },

getRockGeo(style = 0) {
    const s = Math.max(0, Math.min(2, style | 0));
    return this.rockGeos[s] ?? this.rockGeos[0];
  },

colorOf(e) {
    if (e.pl != null && (e.reflect || e.clashable)) return PL_HEX[Math.min(3, e.pl)];
    return e.owner === 0 ? rgb('player') : e.owner === 1 ? rgb('enemy') : 0xffffff;
  },

make(e) {
    const color = this.colorOf(e);
    let mesh;

    const elemental = makeElemental(e);   // Water Pulse, Fire Spin, Air Slash e Seed Bomb (elemental-fx.js)
    if (elemental) {
      mesh = elemental;
    } else if (e.kind === 'projectile' && e.visual === 'star') {
      // Estrela do Swift: duas pirâmides cruzadas branco-douradas com núcleo luminoso e giro individual (só aparência; colisão é o raio da entidade).
      mesh = new T.Group();
      const geo = new T.OctahedronGeometry(.9, 0);geo.scale(1, 1, .45);
      const bodyMat = new T.MeshBasicMaterial({color: 0xfff1c2});
      const a = new T.Mesh(geo, bodyMat), b = new T.Mesh(geo, bodyMat);b.rotation.z = Math.PI / 4;
      const core = new T.Mesh(new T.SphereGeometry(.38, 10, 8), new T.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: .9}));core.name = 'starCore';
      mesh.add(a, b, core);
      mesh.userData.rotSpeed = {x: 0, y: 0, z: (4 + (e.id % 3)) * (e.id % 2 ? 1 : -1)};
      mesh.material = bodyMat;
    } else if (e.kind === 'projectile') {
      // Projétil de rocha (Psyshock ou projétil padrão)
      mesh = new T.Group();
      const style = C.vfx?.rock?.variant ?? 0;
      const rockGeo = this.getRockGeo(style);

      // Corpo rochoso principal facetado
      const rockMat = new T.MeshStandardMaterial({
        color: 0x323842,
        roughness: 0.84,
        metalness: 0.16,
        flatShading: true,
      });
      const body = new T.Mesh(rockGeo, rockMat);
      body.name = 'rockBody';
      mesh.add(body);

      // Veias / Cristais luminosos de Power Level
      const glowMat = new T.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity: C.vfx?.rock?.cracksEmissive ? 0.72 : 0.28,
      });
      const glow = new T.Mesh(rockGeo, glowMat);
      glow.name = 'rockGlow';
      glow.scale.setScalar(1.02);
      mesh.add(glow);

      // Núcleo interno emissivo que brilha na cor do PL
      const coreMat = new T.MeshBasicMaterial({color, transparent: true, opacity: 0.5});
      const core = new T.Mesh(new T.DodecahedronGeometry(0.5, 0), coreMat);
      core.name = 'rockCore';
      mesh.add(core);

      // Velocidade de rotação angular em voo
      const rotBase = (C.vfx?.rock?.rotSpeed ?? 3.5);
      mesh.userData.rotSpeed = {
        x: (Math.sin(e.id * 3.7) * 2 + 1) * rotBase,
        y: (Math.cos(e.id * 2.3) * 2 - 1) * rotBase,
        z: (Math.sin(e.id * 5.1) * 2 + 0.5) * rotBase,
      };

      // Compatibilidade para testes que acessam mesh.material
      mesh.material = rockMat;
    } else if (e.kind === 'beam') {
      // Feixe: paralelepípedos por segmento (até maxSegments)
      mesh = new T.Group();
      const geo = new T.BoxGeometry(1, 1, 1);
      for (let i = 0; i < (e.maxSegments ?? 8); i++) {
        const s = new T.Mesh(geo, new T.MeshBasicMaterial({color, transparent: true, opacity: .85}));
        s.visible = false;
        mesh.add(s);
      }
    } else if (e.kind === 'burrow') {
      // Projétil subterrâneo: montículo de terra que corre em linha reta + anel do destino (visível através de paredes até detonar). Arte provisória.
      mesh = new T.Group();
      const dirt = new T.MeshStandardMaterial({color: 0x6b4f2a, roughness: 1, emissive: 0x2a1a08, emissiveIntensity: .5});
      const mound = new T.Mesh(new T.ConeGeometry(.45, .5, 7), dirt);mound.name = 'mound';mound.position.y = .25;mesh.add(mound);
      const trail = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({color: 0x7a5a30, roughness: 1, emissive: 0x2a1a08, emissiveIntensity: .45}));trail.name = 'burrowTrail';mesh.add(trail);   // sulco de terra revirada atrás do montículo
      const clodGeo = new T.BoxGeometry(1, 1, 1);
      for (let i = 0; i < 16; i++) {const c = new T.Mesh(clodGeo, dirt);c.name = 'burrowClod';c.userData.k = i;mesh.add(c);}   // torrões saltando
      const ringGeo = new T.RingGeometry(.9, 1, 48);ringGeo.rotateX(-Math.PI / 2);
      const ring = new T.Mesh(ringGeo, new T.MeshBasicMaterial({color: 0xffb35a, transparent: true, opacity: .8, depthTest: false, depthWrite: false, side: T.DoubleSide}));ring.name = 'burrowTarget';ring.renderOrder = 950;mesh.add(ring);
    } else if (e.kind === 'sandwave') {
      // Barragem de areia: retângulo no chão (o real, fixado no disparo), frente da onda que avança e grãos subindo; forma PROVISÓRIA (arte não aprovada, SW-P07).
      mesh = new T.Group();
      const planeGeo = new T.PlaneGeometry(1, 1);planeGeo.rotateX(-Math.PI / 2);
      const plane = new T.Mesh(planeGeo, new T.MeshBasicMaterial({color: 0xd8bd7a, transparent: true, opacity: .28, depthWrite: false, side: T.DoubleSide}));plane.name = 'sandPlane';mesh.add(plane);
      const front = new T.Mesh(new T.BoxGeometry(1, .5, .25), new T.MeshBasicMaterial({color: 0xe7cf92, transparent: true, opacity: .55, depthWrite: false}));front.name = 'sandFront';mesh.add(front);
      const grainGeo = new T.BoxGeometry(.07, .07, .07);
      for (let i = 0; i < 40; i++) {const g = new T.Mesh(grainGeo, new T.MeshBasicMaterial({color: 0xe3c98a, transparent: true, opacity: .8, depthWrite: false}));g.name = 'sandGrain';g.userData.k = i;mesh.add(g);}
    } else if (e.kind === 'trap') {
      // Armadilha de espinhos: 5 a 7 cones cristalinos em anel + um central; o raio visual é o raio real do campo (a física manda, o desenho acompanha).
      mesh = new T.Group();
      const n = 6, spikeMat = new T.MeshStandardMaterial({color: 0xd7e6ff, emissive: 0x4f7bff, emissiveIntensity: .55, roughness: .35, metalness: .2, transparent: true, opacity: .95});
      const coneGeo = new T.ConeGeometry(.16, 1, 6);coneGeo.translate(0, .5, 0);
      for (let i = 0; i <= n; i++) {
        const c = new T.Mesh(coneGeo, spikeMat), a = (i / n) * Math.PI * 2, rr = i === n ? 0 : e.radius * .62;
        c.position.set(Math.sin(a) * rr, 0, Math.cos(a) * rr);c.userData.h = i === n ? 1 : .75 + .2 * Math.sin(i * 2.3);c.name = 'spike';
        mesh.add(c);
      }
      const ringGeo = new T.RingGeometry(.9, 1, 48);ringGeo.rotateX(-Math.PI / 2);
      const ring = new T.Mesh(ringGeo, new T.MeshBasicMaterial({color: 0x7da8ff, transparent: true, opacity: .45, depthWrite: false, side: T.DoubleSide}));
      ring.name = 'trapRing';ring.scale.set(e.radius, 1, e.radius);ring.position.y = .02;mesh.add(ring);
    } else if (e.kind === 'area') {
      const geo = new T.CircleGeometry(1, 48);
      geo.rotateX(-Math.PI / 2);
      mesh = new T.Mesh(geo, new T.MeshBasicMaterial({color: e.explosion ? 0xff8a5a : 0xffb361, transparent: true, opacity: .35, depthWrite: false, side: T.DoubleSide}));
    } else {
      // Barreira (Reflect) ou Paredes
      const isReflect = !!e.reflect;
      const barrierStyle = isReflect ? Math.max(0, Math.min(2, C.vfx?.barrier?.variant ?? 0)) : 0;
      let geo;
      if (!isReflect) {
        geo = e.shape === 'circle' ? new T.CylinderGeometry(1, 1, 1, 32, 1, true) : new T.BoxGeometry(1, 1, 1);
        mesh = new T.Mesh(geo, new T.MeshStandardMaterial({
          color: e.kind === 'wall' ? 0x9aa7b3 : color,
          transparent: true,
          opacity: e.kind === 'wall' ? 0.95 : 0.35,
          roughness: 0.8,
          metalness: 0.1,
          depthWrite: e.kind === 'wall',
          side: T.DoubleSide
        }));
      } else {
        // Três estilos 3D reais para o Reflect
        const isHighContrast = !!(this.accessibility?.highContrast || C.vfx.master?.highContrast || C.vfx.laser?.highContrast);
        const opacity = isHighContrast ? 0.95 : (C.vfx?.barrier?.opacity ?? 0.65);
        const edgeGlow = C.vfx?.barrier?.edgeGlow ?? 1.2;
        if (barrierStyle === 1) {
          // Estilo 1: Cristal de Quartzo (Placa facetada com arestas diamantadas e brilho vítreo)
          geo = buildQuartzGeometry();
          const mat = new T.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: edgeGlow * 0.9,
            transparent: true,
            opacity: Math.max(0.72, opacity),
            roughness: 0.05,
            metalness: 0.95,
            side: T.DoubleSide,
            depthWrite: false,
          });
          mesh = new T.Mesh(geo, mat);
          // Facetas internas do cristal (clivagem cristalina)
          const cleavage = new T.LineSegments(new T.WireframeGeometry(geo), new T.LineBasicMaterial({color: 0xffffff, transparent: true, opacity: isHighContrast ? 0.8 : 0.45, linewidth: 2}));
          cleavage.name = 'cleavage';
          mesh.add(cleavage);
          mesh.material = mat;
        } else if (barrierStyle === 2) {
          // Estilo 2: Campo de Força Puro (Escudo curvo de plasma com camadas de onda de choque)
          geo = buildForceFieldGeometry();
          const mat = new T.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: edgeGlow * 1.4,
            transparent: true,
            opacity: opacity * 0.9,
            roughness: 0.1,
            metalness: 0.3,
            side: T.DoubleSide,
            depthWrite: false,
          });
          mesh = new T.Mesh(geo, mat);
          // Onda interna de plasma
          const innerGeo = buildForceFieldGeometry(16);
          const innerMat = new T.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: isHighContrast ? 0.6 : 0.35, side: T.DoubleSide});
          const inner = new T.Mesh(innerGeo, innerMat);
          inner.name = 'innerWave';
          inner.scale.set(0.96, 0.96, 0.92);
          mesh.add(inner);
          mesh.material = mat;
        } else {
          // Estilo 0 (Padrão): Hex-Grid Ciclado (Placa tecnológica com malha hexagonal e moldura reforçada)
          geo = new T.BoxGeometry(1, 1, 1);
          const mat = new T.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: edgeGlow * 0.8,
            transparent: true,
            opacity,
            roughness: 0.18,
            metalness: 0.85,
            side: T.DoubleSide,
            depthWrite: false,
          });
          mesh = new T.Mesh(geo, mat);
          // Bordas reforçadas
          const edges = new T.LineSegments(new T.EdgesGeometry(geo), new T.LineBasicMaterial({color, linewidth: 2}));
          edges.name = 'edges';
          mesh.add(edges);
          // Grelha hexagonal
          const hexGeo = buildHexGridGeometry();
          const subGrid = new T.LineSegments(hexGeo, new T.LineBasicMaterial({color, transparent: true, opacity: isHighContrast ? 0.8 : 0.45}));
          subGrid.name = 'subGrid';
          mesh.add(subGrid);
          mesh.material = mat;
        }
        mesh.userData.style = barrierStyle;
      }
    }

    mesh.userData.kind = e.kind;
    this.group.add(mesh);
    this.meshes.set(e.id, mesh);
    return mesh;
  },

/** Cria orbe facetado para a prévia da carga do Psyshock. */
  makeChargingRockOrb() {
    const group = new T.Group();
    const style = C.vfx?.rock?.variant ?? 0;
    const rockGeo = this.getRockGeo(style);

    const rockMat = new T.MeshStandardMaterial({
      color: 0x363d48,
      roughness: 0.82,
      metalness: 0.18,
      flatShading: true,
    });
    const body = new T.Mesh(rockGeo, rockMat);
    group.add(body);

    const glowMat = new T.MeshBasicMaterial({color: 0xffffff, wireframe: true, transparent: true, opacity: 0.7});
    const glow = new T.Mesh(rockGeo, glowMat);
    glow.scale.setScalar(1.04);
    glow.name = 'orbGlow';
    group.add(glow);

    const coreMat = new T.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.5});
    const core = new T.Mesh(new T.DodecahedronGeometry(0.5, 0), coreMat);
    core.name = 'orbCore';
    group.add(core);

    group.userData.glow = glow;
    group.userData.core = core;
    group.material = rockMat; // compatibilidade
    return group;
  }
};
