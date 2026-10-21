// @ts-check
// Desenho das entidades do mundo (projéteis, barreiras, paredes, áreas) e dos Moves:
// - Barreira do Reflect: grelha cristalina/hexagonal, pulsação de energia e estilhaçamento ao quebrar;
// - Pedras do Psyshock: modelos 3D rochosos facetados (Boulder, Cristal Psíquico, Meteorito), rotação física em voo,
//   núcleos luminosos de Power Level (PL1 ciano, PL2 âmbar, PL3 magenta), rastro de partículas e estilhaços ao impacto;
// - Prévia da barreira (com indicação de carga mínima de 1,5 s) e pedras levitantes facetadas ao redor do lutador;
// - Anéis de impacto e fragmentos físicos reativos para disputas, reflexões e destruições.
// É só representação: o desenho lê o estado e os eventos da simulação e nunca decide nada.
import * as T from 'three';
import {C, rgb} from '../sim/config.js';
import {reflectPlacement} from '../sim/moves/reflect.js';
import {stoneCount} from '../sim/moves/psyshock.js';

export const PL_HEX = [0xffffff, 0x59d6e6, 0xffcf6a, 0xff6adf];
const RING = {
  reflected: [null, 1.4],
  barrierBroken: [0xff8a5a, 2.5],
  stoneClash: [0xb59cff, 1.1],
  counter: [0xffd24a, 1.3],
  tackleClash: [0xffffff, .95],
  counterStagger: [0xffd24a, 1.5],
  shielded: [0x59d6e6, 1.3],
  neutralized: [0xffffff, 1]
};
const FIGHTER_EVENTS = new Set(['counterStagger', 'shielded']);

/** Gera geometria 3D facetada procedural para as rochas telecinéticas. */
function buildRockGeometry(style = 0) {
  let geo;
  if (style === 1) {
    // Estilo 1: Cristal Psíquico (Cone duplo hexagonal facetado / bipirâmide afiada de 12 faces)
    const verts = [];
    const r = 0.88, h = 1.35;
    const equator = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      equator.push(new T.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const apex = new T.Vector3(0, h, 0);
    const nadir = new T.Vector3(0, -h, 0);
    for (let i = 0; i < 6; i++) {
      const next = (i + 1) % 6;
      // Pirâmide superior
      verts.push(apex.x, apex.y, apex.z, equator[i].x, equator[i].y, equator[i].z, equator[next].x, equator[next].y, equator[next].z);
      // Pirâmide inferior
      verts.push(nadir.x, nadir.y, nadir.z, equator[next].x, equator[next].y, equator[next].z, equator[i].x, equator[i].y, equator[i].z);
    }
    geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
  } else if (style === 2) {
    // Estilo 2: Meteorito Runas (Icosaedro com blocos esculpidos)
    geo = new T.IcosahedronGeometry(1, 0);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const k = 0.82 + 0.34 * Math.sin(x * 4.2 + y * 2.8) * Math.cos(z * 3.6);
      pos.setXYZ(i, x * k, y * k, z * k);
    }
  } else {
    // Estilo 0 (Padrão): Boulder Facetado (Dodecaedro deformado com facetas de rocha natural)
    geo = new T.DodecahedronGeometry(1, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const angle = Math.atan2(z, x);
      const perturb = 0.78 + 0.38 * Math.sin(angle * 3 + y * 4.8) + 0.14 * Math.cos(x * 6.5 + z * 3.2);
      pos.setXYZ(i, x * perturb, y * perturb, z * perturb);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/** Gera grelha hexagonal para a barreira estilo 0 (Hex-Grid Ciclado). */
function buildHexGridGeometry(cols = 4, rows = 4) {
  const pts = [];
  const dx = 1 / cols, dy = 1 / rows;
  for (let r = 0; r < rows; r++) {
    const y0 = -0.5 + r * dy, y1 = y0 + dy;
    for (let c = 0; c < cols; c++) {
      const x0 = -0.5 + c * dx, x1 = x0 + dx;
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      pts.push(new T.Vector3(x0, my, 0.51), new T.Vector3(mx, y1, 0.51));
      pts.push(new T.Vector3(mx, y1, 0.51), new T.Vector3(x1, my, 0.51));
      pts.push(new T.Vector3(x1, my, 0.51), new T.Vector3(mx, y0, 0.51));
      pts.push(new T.Vector3(mx, y0, 0.51), new T.Vector3(x0, my, 0.51));
      pts.push(new T.Vector3(x0, my, -0.51), new T.Vector3(mx, y1, -0.51));
      pts.push(new T.Vector3(mx, y1, -0.51), new T.Vector3(x1, my, -0.51));
      pts.push(new T.Vector3(x1, my, -0.51), new T.Vector3(mx, y0, -0.51));
      pts.push(new T.Vector3(mx, y0, -0.51), new T.Vector3(x0, my, -0.51));
    }
  }
  return new T.BufferGeometry().setFromPoints(pts);
}

/** Gera placa facetada de cristal para a barreira estilo 1 (Cristal de Quartzo). */
function buildQuartzGeometry() {
  const verts = [];
  const p = [
    [-0.5, -0.4], [-0.5, 0.4], [-0.4, 0.5], [0.4, 0.5],
    [0.5, 0.4], [0.5, -0.4], [0.4, -0.5], [-0.4, -0.5]
  ];
  const frontZ = 0.45, backZ = -0.45, midZ = 0;
  for (let i = 0; i < 8; i++) {
    const next = (i + 1) % 8;
    verts.push(0, 0, frontZ, p[i][0], p[i][1], midZ, p[next][0], p[next][1], midZ);
    verts.push(0, 0, backZ, p[next][0], p[next][1], midZ, p[i][0], p[i][1], midZ);
    verts.push(p[i][0], p[i][1], midZ, p[next][0], p[next][1], midZ, p[next][0], p[next][1], -0.15);
    verts.push(p[i][0], p[i][1], midZ, p[next][0], p[next][1], -0.15, p[i][0], p[i][1], -0.15);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Gera escudo curvo de plasma para a barreira estilo 2 (Campo de Força Puro). */
function buildForceFieldGeometry(segments = 24) {
  const verts = [];
  for (let i = 0; i < segments; i++) {
    const u0 = i / segments, u1 = (i + 1) / segments;
    const x0 = -0.5 + u0, x1 = -0.5 + u1;
    const z0 = Math.sin(u0 * Math.PI) * 0.35 - 0.17;
    const z1 = Math.sin(u1 * Math.PI) * 0.35 - 0.17;
    verts.push(x0, -0.5, z0, x1, -0.5, z1, x1, 0.5, z1);
    verts.push(x0, -0.5, z0, x1, 0.5, z1, x0, 0.5, z0);
    verts.push(x1, -0.5, z1, x0, -0.5, z0, x1, 0.5, z1);
    verts.push(x1, 0.5, z1, x0, -0.5, z0, x0, 0.5, z0);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

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
  }

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
  }

  setAccessibility(a = {}) {
    this.accessibility = {...this.accessibility, ...a};
  }

  getRockGeo(style = 0) {
    const s = Math.max(0, Math.min(2, style | 0));
    return this.rockGeos[s] ?? this.rockGeos[0];
  }

  colorOf(e) {
    if (e.pl != null && (e.reflect || e.clashable)) return PL_HEX[Math.min(3, e.pl)];
    return e.owner === 0 ? rgb('player') : e.owner === 1 ? rgb('enemy') : 0xffffff;
  }

  make(e) {
    const color = this.colorOf(e);
    let mesh;

    if (e.kind === 'projectile' && e.visual === 'star') {
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
  }

  /** Anel que se expande e some (VFX de evento). */
  ring(x, y, z, color, size, life = .55) {
    const isNoFlash = !!(this.accessibility?.noFlash || C.vfx.master?.noFlash || C.vfx.laser?.noFlash);
    const isHighContrast = !!(this.accessibility?.highContrast || C.vfx.master?.highContrast || C.vfx.laser?.highContrast);
    const opacity = isNoFlash ? 0.45 : isHighContrast ? 1.0 : 0.85;
    const geo = new T.RingGeometry(.82, 1, 40);
    geo.rotateX(-Math.PI / 2);
    const mesh = new T.Mesh(geo, new T.MeshBasicMaterial({color, transparent: true, opacity, depthWrite: false, side: T.DoubleSide}));
    mesh.position.set(x, y, z);
    mesh.renderOrder = 802;
    this.group.add(mesh);
    this.rings.push({mesh, age: 0, life, size});
  }

  /** Emite partículas de rastro em voo para as pedras. */
  emitRockTrail(x, y, z, vel, color, scaleVal) {
    const geo = new T.BoxGeometry(0.06 * scaleVal, 0.06 * scaleVal, 0.06 * scaleVal);
    const mat = new T.MeshBasicMaterial({color, transparent: true, opacity: 0.8, depthWrite: false});
    const mesh = new T.Mesh(geo, mat);
    mesh.position.set(
      x + (Math.random() - 0.5) * 0.15,
      y + (Math.random() - 0.5) * 0.15,
      z + (Math.random() - 0.5) * 0.15
    );
    this.group.add(mesh);
    this.particles.push({
      mesh,
      age: 0,
      life: 0.28,
      vel: {x: (Math.random() - 0.5) * 0.6, y: Math.random() * 0.5, z: (Math.random() - 0.5) * 0.6},
      rotVel: {x: Math.random() * 8, y: Math.random() * 8, z: Math.random() * 8},
      startScale: scaleVal * 0.9,
    });
  }

  /** Emite fragmentos/estilhaços físicos quando uma rocha colide ou se quebra. */
  emitRockShatter(x, y, z, normal, color) {
    const isReduceMotion = !!(this.accessibility?.reduceMotion || C.vfx.master?.reduceMotion || C.vfx.laser?.reduceMotion);
    const motionScale = isReduceMotion ? 0.25 : 1.0;
    const count = isReduceMotion ? 6 : (C.vfx?.rock?.shatterCount ?? 14);
    const nx = normal?.x ?? 0, nz = normal?.z ?? 0;
    const rc = C.vfx?.rock ?? {}, spdK = rc.shatterSpeed ?? 1, lifeK = rc.shatterLife ?? 1, sizeK = rc.shatterSize ?? 1;
    for (let i = 0; i < count; i++) {
      const geo = new T.DodecahedronGeometry((0.08 + Math.random() * 0.08) * sizeK, 0);
      const isGlowing = Math.random() < 0.45;
      const mat = new T.MeshBasicMaterial({
        color: isGlowing ? color : 0x3a424e,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      });
      const mesh = new T.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      this.group.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = (2.5 + Math.random() * 5.5) * motionScale * spdK;
      const up = (1.5 + Math.random() * 5.0) * motionScale * spdK;
      this.particles.push({
        mesh,
        age: 0,
        life: (0.42 + Math.random() * 0.22) * lifeK,
        vel: {
          x: Math.cos(angle) * speed + nx * 2.5 * motionScale,
          y: up,
          z: Math.sin(angle) * speed + nz * 2.5 * motionScale,
        },
        rotVel: {x: (Math.random() - 0.5) * 16 * motionScale, y: (Math.random() - 0.5) * 16 * motionScale, z: (Math.random() - 0.5) * 16 * motionScale},
        startScale: 1.0,
      });
    }
  }

  /** Emite estilhaços cristalinos quando uma barreira é destruída. */
  emitBarrierShatter(x, y, z, color) {
    const isReduceMotion = !!(this.accessibility?.reduceMotion || C.vfx.master?.reduceMotion || C.vfx.laser?.reduceMotion);
    const motionScale = isReduceMotion ? 0.25 : 1.0;
    const count = isReduceMotion ? 8 : (C.vfx?.barrier?.shatterFragments ?? 20);
    const bc = C.vfx?.barrier ?? {}, spdK = bc.shatterSpeed ?? 1, lifeK = bc.shatterLife ?? 1, sizeK = bc.shatterSize ?? 1;
    for (let i = 0; i < count; i++) {
      const geo = new T.BoxGeometry((0.12 + Math.random() * 0.15) * sizeK, (0.12 + Math.random() * 0.15) * sizeK, 0.02);
      const mat = new T.MeshBasicMaterial({color, transparent: true, opacity: 0.85, side: T.DoubleSide, depthWrite: false});
      const mesh = new T.Mesh(geo, mat);
      mesh.position.set(x + (Math.random() - 0.5) * 1.5, y + (Math.random() - 0.5) * 1.2, z + (Math.random() - 0.5) * 0.2);
      this.group.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = (2.0 + Math.random() * 4.5) * motionScale * spdK;
      this.particles.push({
        mesh,
        age: 0,
        life: (0.5 + Math.random() * 0.25) * lifeK,
        vel: {x: Math.cos(angle) * speed, y: (1.0 + Math.random() * 4.0) * motionScale * spdK, z: Math.sin(angle) * speed},
        rotVel: {x: (Math.random() - 0.5) * 18 * motionScale, y: (Math.random() - 0.5) * 18 * motionScale, z: (Math.random() - 0.5) * 18 * motionScale},
        startScale: 1.0,
      });
    }
  }

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

  update(world, {fighters = [], events = [], dt = 0, skipBeams = false, camera = null} = {}) {
    this.time += dt;
    this.trailTimer += dt;
    const emitTrailsNow = this.trailTimer >= 0.04;
    if (emitTrailsNow) this.trailTimer = 0;

    const alive = new Set();
    for (const e of world?.entities ?? []) {
      alive.add(e.id);
      let m = this.meshes.get(e.id) ?? this.make(e);

      if (e.kind === 'beam') {
        if (skipBeams) {
          m.children.forEach(s => { s.visible = false; });
          continue;
        }
        m.children.forEach((s, i) => {
          const g = e.segments?.[i];s.visible = !!g;if (!g) return;
          const dx = g.b.x - g.a.x, dz = g.b.z - g.a.z, len = Math.hypot(dx, dz), w = Math.max(.05, (e.width ?? .04) * 2);
          s.position.set((g.a.x + g.b.x) / 2, e.y, (g.a.z + g.b.z) / 2);s.rotation.y = Math.atan2(dx, dz);s.scale.set(w, w, Math.max(1e-3, len));
          s.material.color.setHex(g.neutralized ? 0xffffff : PL_HEX[Math.min(3, g.pl ?? 1)]);s.material.opacity = g.neutralized ? .35 : .85;
        });
      } else if (e.kind === 'projectile') {
        m.position.set(e.pos.x, e.y, e.pos.z);
        const rockScale = (C.vfx?.rock?.scale ?? 1.0);
        const scaleVal = e.visual === 'star' ? e.radius * 2.2 : e.radius * (e.visualScale ?? 1) * (e.exec != null ? 1.15 : 1) * rockScale;
        m.scale.setScalar(scaleVal);
        const col = this.colorOf(e);

        if (m.isGroup) {
          const glow = m.getObjectByName('rockGlow');
          const core = m.getObjectByName('rockCore');
          if (glow) glow.material.color.setHex(col);
          if (core) core.material.color.setHex(col);

          // Rotação física da rocha em voo
          const rs = m.userData.rotSpeed;
          if (rs && dt > 0) {
            m.rotation.x += rs.x * dt;
            m.rotation.y += rs.y * dt;
            m.rotation.z += rs.z * dt;
          }
        } else if (m.material) {
          m.material.color.setHex(col);
        }

        // Rastro de poeira e partículas telecinéticas
        if (emitTrailsNow && C.vfx?.rock?.trail && dt > 0) {
          this.emitRockTrail(e.pos.x, e.y, e.pos.z, e.vel ?? e.dir, col, scaleVal);
        }
      } else if (e.kind === 'trap') {
        // Brotam em sequência rápida (0,25 s), pulsam de leve e piscam no último segundo; antes de armar ficam translúcidos.
        m.position.set(e.pos.x, e.y ?? 0, e.pos.z);
        const grow = Math.min(1, e.age / .25), armed = e.age >= (e.armDelay ?? 0), left = e.life - e.age, blink = left < 1 ? (.5 + .5 * Math.abs(Math.sin(this.time * 24))) : 1;
        let i = 0;
        for (const c of m.children) {
          if (c.name === 'spike') {const k = Math.max(0, Math.min(1, grow * 1.4 - i * .06));c.scale.set(1, (c.userData.h ?? 1) * 1.05 * k, 1);c.material.opacity = (armed ? .95 : .55) * blink;c.material.emissiveIntensity = (armed ? .55 + .2 * Math.sin(this.time * 5 + i) : .25);i++;}
          else if (c.name === 'trapRing') c.material.opacity = (armed ? .45 : .2) * blink;
        }
      } else if (e.kind === 'area') {
        m.position.set(e.pos.x, (e.y ?? 0) + .03, e.pos.z);
        if (e.shape === 'box') {m.scale.set(e.hx * 2, 1, e.hz * 2);m.rotation.y = e.angle ?? 0;} else m.scale.set(e.radius, 1, e.radius);
        m.material.opacity = .45 * Math.max(.15, 1 - e.age / Math.max(1e-6, e.life));
      } else {
        m.position.set(e.pos.x, e.y + e.height / 2, e.pos.z);m.rotation.y = e.angle ?? 0;
        if (e.shape === 'circle') m.scale.set(e.radius, e.height, e.radius);else m.scale.set(e.hx * 2, e.height, e.hz * 2);
        if (e.reflect) {
          const currentStyle = Math.max(0, Math.min(2, C.vfx?.barrier?.variant ?? 0));
          if (m.userData.style !== currentStyle) {
            this.group.remove(m);
            m.traverse(o => {if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose();});
            this.meshes.delete(e.id);
            m = this.make(e);
            m.position.set(e.pos.x, e.y + e.height / 2, e.pos.z);
            m.rotation.y = e.angle ?? 0;
            if (e.shape === 'circle') m.scale.set(e.radius, e.height, e.radius);
            else m.scale.set(e.hx * 2, e.height, e.hz * 2);
          }
          // Pulsação suave e enfraquecimento no fim da vida
          const left = e.life - e.age;
          const pulse = 0.88 + 0.12 * Math.sin(this.time * (C.vfx?.barrier?.pulseFreq ?? 2.2) * Math.PI * 2);
          const weak = left < 1 ? (.45 + .55 * Math.abs(Math.sin(this.time * 30))) : 1;
          const isHighContrast = !!(this.accessibility?.highContrast || C.vfx.master?.highContrast || C.vfx.laser?.highContrast);
          const baseOp = isHighContrast ? 0.95 : (C.vfx?.barrier?.opacity ?? 0.65);
          if (m.material) {
            m.material.opacity = baseOp * weak * pulse;
            m.material.emissiveIntensity = (C.vfx?.barrier?.edgeGlow ?? 0.8) * weak * pulse;
          }
          if (m.userData.style === 0) {
            const subGrid = m.getObjectByName('subGrid');
            if (subGrid?.material) subGrid.material.opacity = (isHighContrast ? 0.8 : (0.3 + 0.25 * Math.sin(this.time * 5))) * weak;
          } else if (m.userData.style === 2) {
            const inner = m.getObjectByName('innerWave');
            if (inner?.material) {
              inner.material.opacity = (isHighContrast ? 0.6 : (0.2 + 0.2 * Math.cos(this.time * 6))) * weak;
              inner.scale.z = 0.92 + 0.08 * Math.sin(this.time * 4);
            }
          }
        }
      }
    }

    // Eventos novos viram anéis e geram estilhaços/shatter de rochas e barreiras
    for (const ev of events) {
      if (this.seen.has(ev)) continue;
      this.seen.add(ev);
      const spec = RING[ev.result];
      const m = this.meshes.get(ev.entity), f = FIGHTER_EVENTS.has(ev.result) ? fighters[ev.target] : null;
      const be = ev.kind === 'beam' && ev.seg != null ? world?.entities.find(x => x.id === ev.entity) : null, bp = be?.segments?.[ev.seg]?.b;
      const pos = bp ? {x: bp.x, y: be.y, z: bp.z} : f ? {x: f.position.x, y: .6, z: f.position.z} : m ? m.position : null;
      if (!pos) continue;

      const evColor = spec ? (spec[0] ?? PL_HEX[Math.min(3, ev.barrierPl ?? ev.pl ?? 1)]) : 0xffffff;
      if (spec) {
        this.ring(pos.x, pos.y ?? .6, pos.z, evColor, spec[1]);
      }

      // Estilhaçamento de rochas no impacto, choque entre pedras ou reflexão
      if (C.vfx?.rock?.shatter && (ev.result === 'impact' || ev.result === 'stoneClash' || ev.result === 'counter' || ev.result === 'tackleClash' || ev.result === 'reflected')) {
        this.emitRockShatter(pos.x, pos.y ?? 0.6, pos.z, ev.normal, evColor);
      }

      // Estilhaçamento de barreira ao ser destruída
      if (ev.result === 'barrierBroken') {
        this.emitBarrierShatter(pos.x, pos.y ?? 1.0, pos.z, evColor);
      }
    }

    // Remoção de entidades mortas
    for (const [id, m] of this.meshes) {
      if (!alive.has(id)) {
        this.group.remove(m);
        m.traverse(o => {
          o.geometry?.dispose();
          if (Array.isArray(o.material)) o.material.forEach(mat => mat.dispose());
          else o.material?.dispose();
        });
        this.meshes.delete(id);
      }
    }

    // Atualização dos anéis
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      const k = Math.min(1, r.age / r.life);
      r.mesh.scale.setScalar(.25 + r.size * k);
      r.mesh.material.opacity = .85 * (1 - k);
      if (k >= 1) {
        this.group.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        this.rings.splice(i, 1);
      }
    }

    // Atualização das partículas de rastro e estilhaços físicos
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      const prog = Math.min(1, p.age / p.life);

      // Integração física (gravidade e arrasto)
      p.vel.y -= 14 * dt;
      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.y += p.vel.y * dt;
      p.mesh.position.z += p.vel.z * dt;

      // Colisão simples no chão (y = 0.04)
      if (p.mesh.position.y < 0.04) {
        p.mesh.position.y = 0.04;
        p.vel.y = -p.vel.y * 0.35;
        p.vel.x *= 0.7;
        p.vel.z *= 0.7;
      }

      p.mesh.rotation.x += p.rotVel.x * dt;
      p.mesh.rotation.y += p.rotVel.y * dt;
      p.mesh.rotation.z += p.rotVel.z * dt;

      p.mesh.scale.setScalar(p.startScale * (1 - prog * 0.8));
      p.mesh.material.opacity = Math.max(0, 0.9 * (1 - prog));

      if (prog >= 1) {
        this.group.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    this.drawCharging(world, fighters, dt);
    this.drawMap(world?.mapState, fighters, dt, camera);
    return alive.size;
  }

  /** Prévia da barreira (com indicação de carga mínima de 1,5 s) e pedras que se formam ao redor do lutador. */
  drawCharging(world, fighters, dt = 0) {
    let showPreview = false;
    for (const f of fighters) {
      const ring = this.chargeRings?.[f.id];
      const ch = f.charge, tc = f.tackleCharge;
      if (ring) {
        if (ch || tc) {
          ring.visible = true;
          ring.position.set(f.position.x, 0.04, f.position.z);
          const ratio = tc ? tc.t / Math.max(1e-6, C.rules.chargeTackleMaxTime) : (ch.ratio ?? (ch.ticks / (ch.params?.maxTicks || 180)));
          const scale = 0.6 + Math.min(1.2, ratio * 0.8);
          ring.scale.set(scale, scale, scale);
          const plIdx = tc ? tc.level : ch.ticks >= (ch.params?.maxTicks ?? 180) ? 3 : ch.ticks >= (ch.params?.pl2Ticks ?? 90) ? 2 : 1;
          ring.material.color.setHex(PL_HEX[plIdx]);
          ring.material.opacity = 0.35 + 0.25 * Math.sin(this.time * 9);
        } else {
          ring.visible = false;
        }
      }
      const orbs = this.orbs[f.id] ??= [];
      let want = 0;

      if (ch && ch.move === 'reflect') {
        const P = ch.params, place = reflectPlacement({world, fighters}, f, P, ch.ticks / P.maxTicks, f.facing), p = this.preview;
        showPreview = true;
        p.visible = true;

        // Com carga mínima de 1,5 s (180 passos): indica se já está carregada ou ainda acumulando
        const minTicks = P.minTicks ?? 180;
        const hasMinCharge = ch.ticks >= minTicks;

        if (place.ok) {
          p.position.set(place.center.x, place.base + place.height / 2, place.center.z);
          p.scale.set(place.width, place.height, place.thickness);
          // Verde firme quando pronta (>= 1,5s); ciano pulsante quando carregando os 1,5s iniciais
          if (hasMinCharge) {
            p.material.color.setHex(0x59e68a);
            p.material.opacity = 0.38;
          } else {
            const shimmer = 0.2 + 0.18 * Math.sin(this.time * 8);
            p.material.color.setHex(0x59d6e6);
            p.material.opacity = shimmer;
          }
        } else {
          const w = P.group.widthMin * 2 * P.body.halfExtent;
          p.position.set(f.position.x + Math.sin(f.facing) * 1.05, P.body.height, f.position.z + Math.cos(f.facing) * 1.05);
          p.scale.set(w, P.group.heightMin * P.body.height, P.group.thickness);
          p.material.color.setHex(0xff5a5a);
          p.material.opacity = 0.3;
        }
        p.rotation.y = f.facing;
      } else if (ch && ch.move === 'psyshock') {
        want = stoneCount(ch.ticks, ch.params);
      }

      while (orbs.length < 16) {
        const o = this.makeChargingRockOrb();
        o.visible = false;
        this.group.add(o);
        orbs.push(o);
      }

      for (let i = 0; i < orbs.length; i++) {
        const o = orbs[i];
        o.visible = i < want;
        if (i >= want) continue;

        const arc = 2.1;
        const a = f.facing + (want === 1 ? 0 : (i / (want - 1) - .5) * arc) + Math.sin(this.time * 1.7 + i) * .06;
        const r = .95 + .12 * Math.sin(this.time * 2.3 + i * 1.7);
        const lev = Math.sin(this.time * 3.4 + i * 1.9) * 0.08;

        o.position.set(
          f.position.x + Math.sin(a) * r,
          .45 + .55 * (.5 + .5 * Math.sin(this.time * 2 + i * 2.1)) + (i % 3) * .1 + lev,
          f.position.z + Math.cos(a) * r
        );

        const plIdx = ch.ticks >= ch.params.maxTicks ? 3 : ch.ticks >= ch.params.pl2Ticks ? 2 : 1;
        const plColor = PL_HEX[plIdx];
        const rockScale = (C.vfx?.rock?.scale ?? 1.0);
        o.scale.setScalar((.14 + .07 * ((i * 7) % 5) / 4) * rockScale);

        // Rotação suave das pedras levitando
        o.rotation.x += 1.4 * (dt || 0.016);
        o.rotation.y += 2.1 * (dt || 0.016);

        if (o.userData.glow) o.userData.glow.material.color.setHex(plColor);
        if (o.userData.core) o.userData.core.material.color.setHex(plColor);
      }
    }
    if (!showPreview) this.preview.visible = false;
  }

  drawMap(mapState, fighters = [], dt = 0, camera = null) {
    if (!mapState) return;
    this.mapGroup ??= new T.Group();
    if (!this.mapGroup.parent) this.group.add(this.mapGroup);
    this.mapMeshes ??= new Map();
    this.shieldBubbles ??= [null, null];

    // 1. Escudos esféricos dos lutadores (R9.3-R9.7, R10.2)
    for (let i = 0; i < fighters.length; i++) {
      const f = fighters[i];
      let bubble = this.shieldBubbles[i];
      if (!bubble) {
        const geo = new T.SphereGeometry(0.9, 24, 24);
        const mat = new T.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.35,
          roughness: 0.1,
          metalness: 0.2,
          side: T.DoubleSide,
          depthWrite: false,
        });
        bubble = new T.Mesh(geo, mat);
        bubble.renderOrder = 850;
        this.group.add(bubble);
        this.shieldBubbles[i] = bubble;
      }
      if (f.shield && f.shield.hp > 0 && f.hp > 0) {
        bubble.visible = true;
        const fY = (f.groundY ?? 0) + (f.flight?.y ?? f.vaultHeight ?? 0);
        bubble.position.set(f.position.x, fY + 0.6, f.position.z);
        const ratio = Math.min(1, f.shield.hp / (f.shield.maxHp || 80));
        bubble.material.opacity = 0.22 + 0.28 * ratio + 0.08 * Math.sin(this.time * 5);
        const pulse = 1.0 + 0.03 * Math.sin(this.time * 6);
        bubble.scale.set(1.1 * pulse, 1.35 * pulse, 1.1 * pulse);
      } else {
        bubble.visible = false;
      }
    }

    const aliveMapIds = new Set();

    // 2. Plataformas (2 plataformas: 3x3m a 1.0m e 1.5m)
    for (const p of mapState.platforms ?? []) {
      aliveMapIds.add(p.id);
      let m = this.mapMeshes.get(p.id);
      if (!m) {
        const geo = new T.BoxGeometry(p.width ?? 3, p.height, p.depth ?? 3);
        const mat = new T.MeshStandardMaterial({
          color: 0x475569,
          roughness: 0.8,
          metalness: 0.15,
        });
        m = new T.Mesh(geo, mat);
        m.name = `platform_${p.id}`;
        const edgeGeo = new T.EdgesGeometry(geo);
        const edgeMat = new T.LineBasicMaterial({color: 0x94a3b8, transparent: true, opacity: 0.7});
        m.add(new T.LineSegments(edgeGeo, edgeMat));
        this.mapGroup.add(m);
        this.mapMeshes.set(p.id, m);
      }
      m.position.set(p.pos?.x ?? p.x, p.height / 2, p.pos?.z ?? p.z);
      this.checkOcclusion(m, camera, fighters);
    }

    // 3. Obstáculos indestrutíveis (4 obstáculos)
    for (const o of mapState.obstacles ?? []) {
      aliveMapIds.add(o.id);
      let m = this.mapMeshes.get(o.id);
      if (!m) {
        let geo;
        if (o.shape === 'cylinder') {
          geo = new T.CylinderGeometry(o.radius, o.radius, o.height, 24);
        } else {
          geo = new T.BoxGeometry(o.hx * 2, o.height, o.hz * 2);
        }
        const mat = new T.MeshStandardMaterial({
          color: 0x334155,
          roughness: 0.65,
          metalness: 0.35,
        });
        m = new T.Mesh(geo, mat);
        m.name = `obstacle_${o.id}`;
        const edgeGeo = new T.EdgesGeometry(geo);
        const edgeMat = new T.LineBasicMaterial({color: 0x64748b, transparent: true, opacity: 0.6});
        m.add(new T.LineSegments(edgeGeo, edgeMat));
        this.mapGroup.add(m);
        this.mapMeshes.set(o.id, m);
      }
      m.position.set(o.pos.x, o.pos.y + o.height / 2, o.pos.z);
      this.checkOcclusion(m, camera, fighters);
    }

    // 4. Objetos Destrutíveis (4 destrutíveis) com prévia ghost (R11.9)
    for (const d of mapState.destructibles ?? []) {
      aliveMapIds.add(d.id);
      let m = this.mapMeshes.get(d.id);
      if (!m) {
        const geo = new T.BoxGeometry(d.size.hx * 2, d.size.height, d.size.hz * 2);
        const mat = new T.MeshStandardMaterial({
          color: 0xd97706,
          roughness: 0.7,
          metalness: 0.1,
          transparent: true,
          opacity: 1.0,
        });
        m = new T.Mesh(geo, mat);
        m.name = `destructible_${d.id}`;
        const edgeGeo = new T.EdgesGeometry(geo);
        const edgeMat = new T.LineBasicMaterial({color: 0xfbbf24, transparent: true, opacity: 0.8});
        m.add(new T.LineSegments(edgeGeo, edgeMat));

        // Barra de HP simples flutuante
        const hpBarGeo = new T.PlaneGeometry(0.8, 0.08);
        const hpBarMat = new T.MeshBasicMaterial({color: 0x22c55e, side: T.DoubleSide, depthTest: false});
        const hpBar = new T.Mesh(hpBarGeo, hpBarMat);
        hpBar.name = 'hpBar';
        hpBar.position.set(0, d.size.height / 2 + 0.25, 0);
        m.add(hpBar);

        this.mapGroup.add(m);
        this.mapMeshes.set(d.id, m);
      }
      m.position.set(d.pos.x, d.pos.y + d.size.height / 2, d.pos.z);

      const hpBar = m.getObjectByName('hpBar');
      if (d.state === 'solid') {
        m.visible = true;
        m.material.color.setHex(0xd97706);
        m.material.opacity = 1.0;
        m.material.depthWrite = true;
        if (hpBar) {
          hpBar.visible = true;
          const hpRatio = Math.max(0, d.hp / (d.maxHp || 30));
          hpBar.scale.x = hpRatio;
          hpBar.material.color.setHex(hpRatio > 0.5 ? 0x22c55e : hpRatio > 0.25 ? 0xfacc15 : 0xef4444);
          if (camera) hpBar.quaternion.copy(camera.quaternion);
        }
        this.checkOcclusion(m, camera, fighters);
      } else if (d.state === 'ghost') {
        // Prévia translúcida antes de tornar sólido (R11.9)
        m.visible = true;
        m.material.color.setHex(0xfef08a);
        m.material.opacity = 0.32 + 0.22 * Math.sin(this.time * 8);
        m.material.depthWrite = false;
        if (hpBar) hpBar.visible = false;
      } else {
        m.visible = false;
        if (hpBar) hpBar.visible = false;
      }
    }

    // 5. Consumíveis (7 tipos com cores e geometrias únicas, R4.7, R11.5)
    for (const it of mapState.items ?? []) {
      aliveMapIds.add(it.id);
      let m = this.mapMeshes.get(it.id);
      if (!m) {
        m = this.createConsumableMesh(it.type);
        this.mapGroup.add(m);
        this.mapMeshes.set(it.id, m);
      }
      const bob = 0.12 * Math.sin(this.time * 3.5 + it.id);
      m.position.set(it.pos.x, it.pos.y + 0.45 + bob, it.pos.z);
      m.rotation.y += 1.8 * dt;

      const ring = m.getObjectByName('pickupRing');
      if (ring) {
        ring.position.y = -0.4 - bob;
        const pScale = 0.9 + 0.15 * Math.sin(this.time * 5 + it.id);
        ring.scale.set(pScale, pScale, pScale);
      }
    }

    // Limpeza de entidades removidas do mapa
    for (const [id, m] of this.mapMeshes) {
      if (!aliveMapIds.has(id)) {
        this.mapGroup.remove(m);
        m.traverse(o => {
          o.geometry?.dispose();
          if (Array.isArray(o.material)) o.material.forEach(mat => mat.dispose());
          else o.material?.dispose();
        });
        this.mapMeshes.delete(id);
      }
    }
  }

  createConsumableMesh(type) {
    const group = new T.Group();
    let geo, color;
    switch (type) {
      case 'heal_hp':
        geo = new T.DodecahedronGeometry(0.3, 0);
        color = 0xef4444;
        break;
      case 'heal_stamina':
        geo = new T.OctahedronGeometry(0.3, 0);
        geo.scale(0.8, 1.4, 0.8);
        color = 0xeab308;
        break;
      case 'buff_attack':
        geo = new T.TetrahedronGeometry(0.32, 0);
        color = 0xf97316;
        break;
      case 'buff_defense':
        geo = new T.IcosahedronGeometry(0.3, 0);
        color = 0x3b82f6;
        break;
      case 'buff_stamina_max':
        geo = new T.TorusGeometry(0.24, 0.09, 12, 24);
        geo.rotateX(Math.PI / 3);
        color = 0xf59e0b;
        break;
      case 'buff_cooldown':
        geo = new T.OctahedronGeometry(0.28, 0);
        geo.scale(1.2, 0.6, 1.2);
        color = 0xa855f7;
        break;
      case 'buff_speed':
      default:
        geo = new T.ConeGeometry(0.24, 0.5, 5);
        geo.rotateZ(-Math.PI / 6);
        color = 0x22c55e;
        break;
    }

    const mat = new T.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.3,
    });
    const core = new T.Mesh(geo, mat);
    group.add(core);

    const ringGeo = new T.RingGeometry(0.35, 0.55, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new T.MeshBasicMaterial({color, transparent: true, opacity: 0.5, side: T.DoubleSide, depthWrite: false});
    const ring = new T.Mesh(ringGeo, ringMat);
    ring.name = 'pickupRing';
    group.add(ring);

    return group;
  }

  checkOcclusion(mesh, camera, fighters) {
    if (!camera || !fighters?.length) return;
    const camPos = camera.position;
    let occludes = false;

    for (const f of fighters) {
      if (f.hp <= 0) continue;
      const fPos = {x: f.position.x, y: (f.groundY ?? 0) + 0.8, z: f.position.z};
      const dx = fPos.x - camPos.x, dy = fPos.y - camPos.y, dz = fPos.z - camPos.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 1e-4) continue;
      const rayDir = {x: dx / dist, y: dy / dist, z: dz / dist};

      const mPos = mesh.position;
      const cx = mPos.x - camPos.x, cy = mPos.y - camPos.y, cz = mPos.z - camPos.z;
      const t = cx * rayDir.x + cy * rayDir.y + cz * rayDir.z;
      if (t > 0.8 && t < dist - 0.8) {
        const perpX = cx - t * rayDir.x, perpY = cy - t * rayDir.y, perpZ = cz - t * rayDir.z;
        const perpDist = Math.hypot(perpX, perpY, perpZ);
        if (perpDist < 1.6) {
          occludes = true;
          break;
        }
      }
    }

    if (occludes) {
      mesh.material.transparent = true;
      mesh.material.opacity = 0.25;
      mesh.material.depthWrite = false;
    } else {
      mesh.material.transparent = false;
      mesh.material.opacity = 1.0;
      mesh.material.depthWrite = true;
    }
  }
}
