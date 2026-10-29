import * as THREE from 'three';

// ============================================================================
// 4. GEOMETRIAS 3D COMPARTILHADAS (PSÍQUICO + VOADOR + FOGO)
// ============================================================================

export const SHARED_GEOS = {
  octa: new THREE.OctahedronGeometry(0.5, 0),
  icosa: new THREE.IcosahedronGeometry(0.55, 1),
  icosaWire: new THREE.IcosahedronGeometry(0.62, 1),
  tetra: new THREE.TetrahedronGeometry(0.4, 0),
  sphere: new THREE.SphereGeometry(0.5, 24, 18),
  box: new THREE.BoxGeometry(0.5, 0.5, 0.5),
  monolith: new THREE.BoxGeometry(0.55, 1.35, 0.32),
  cone: new THREE.ConeGeometry(0.18, 1.0, 4),
  needle: new THREE.ConeGeometry(0.11, 1.35, 4),
  prism: new THREE.CylinderGeometry(0.45, 0.45, 0.12, 6),
  ring: new THREE.TorusGeometry(1.0, 0.055, 10, 48),
  thinRing: new THREE.TorusGeometry(1.0, 0.025, 8, 48),
  crescentBlade: new THREE.TorusGeometry(0.75, 0.065, 8, 32, Math.PI * 1.15),
  kaenScroll: new THREE.TorusGeometry(0.62, 0.075, 10, 36, Math.PI * 1.45),
  shardGlass: new THREE.CylinderGeometry(0.35, 0.1, 0.03, 3),
  boulder: (() => {
    const g = new THREE.DodecahedronGeometry(0.55, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const n = 1 + 0.22 * Math.sin(vx * 5.1 + vy * 3.7) * Math.cos(vz * 4.3);
      pos.setXYZ(i, vx * n, vy * n * 0.9, vz * n);
    }
    g.computeVertexNormals();
    return g;
  })(),
  dustPuff: (() => {
    const g = new THREE.IcosahedronGeometry(0.42, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const n = 1 + 0.18 * Math.sin(i * 4.7 + vx * 6.0);
      pos.setXYZ(i, vx * n * 1.15, vy * n * 0.78, vz * n * 1.15);
    }
    g.computeVertexNormals();
    return g;
  })(),
  funnel: (() => {
    const g = new THREE.CylinderGeometry(1.18, 0.24, 2.6, 40, 28, true);
    g.translate(0, 1.3, 0);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 2.6;
      const flare = 0.72 + 0.55 * Math.pow(y, 1.7);
      pos.setX(i, pos.getX(i) * flare);
      pos.setZ(i, pos.getZ(i) * flare);
    }
    g.computeVertexNormals();
    return g;
  })(),
  flameColumn: (() => {
    // Coluna/língua de fogo 3D esculpida: base larga em brasa que ondula e afila em chama no topo
    const g = new THREE.CylinderGeometry(0.32, 0.88, 2.6, 36, 28, true);
    g.translate(0, 1.3, 0);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 2.6;
      const profile = Math.sin(y * Math.PI * 0.88) * (1.15 - 0.55 * y) + 0.22;
      pos.setX(i, pos.getX(i) * profile);
      pos.setZ(i, pos.getZ(i) * profile);
    }
    g.computeVertexNormals();
    return g;
  })(),
};

export function createFighterDummy(colorHex, isCaster) {
  const group = new THREE.Group();
  const matBody = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.55,
    metalness: 0.2,
    flatShading: true,
  });
  const matVisor = new THREE.MeshBasicMaterial({ color: isCaster ? 0x7dd3fc : 0xfda4af });

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.65, 0.08, 20),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 })
  );
  base.position.y = 0.04;
  group.add(base);

  const legGeo = new THREE.CapsuleGeometry(0.13, 0.45, 4, 8);
  const legL = new THREE.Mesh(legGeo, matBody);
  legL.position.set(-0.18, 0.42, 0);
  const legR = new THREE.Mesh(legGeo, matBody);
  legR.position.set(0.18, 0.42, 0);
  group.add(legL, legR);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.52, 6, 12), matBody);
  torso.position.y = 1.05;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), matBody);
  head.position.y = 1.65;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.16), matVisor);
  visor.position.set(0, 1.66, isCaster ? 0.18 : -0.18);
  group.add(head, visor);

  const armGeo = new THREE.CapsuleGeometry(0.1, 0.42, 4, 8);
  const armL = new THREE.Mesh(armGeo, matBody);
  armL.position.set(-0.4, 1.12, isCaster ? 0.15 : 0);
  armL.rotation.x = isCaster ? -0.6 : 0.15;
  const armR = new THREE.Mesh(armGeo, matBody);
  armR.position.set(0.4, 1.12, isCaster ? 0.15 : 0);
  armR.rotation.x = isCaster ? -0.6 : 0.15;
  group.add(armL, armR);

  group.userData = { torso, head, armL, armR, baseY: 0 };
  return group;
}
