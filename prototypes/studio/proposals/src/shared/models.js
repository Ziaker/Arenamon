// Modelos 3D estilizados gerados proceduralmente para avaliação offline,
// livres de dependências externas ou assets proprietários.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Cria o personagem bípede estilizado "Golem Campeão"
 * Altura ~2.0m, proporções ideais para rig de 20 ossos.
 */
export function createProceduralBiped() {
  const root = new THREE.Group();
  root.name = 'Arenamon_Biped_Golem';

  const parts = [];

  // Cabeça estilizada com queixo e orelhas mecânicas
  const headGeo = new THREE.BoxGeometry(0.36, 0.42, 0.38, 4, 4, 4);
  const headMesh = new THREE.Mesh(headGeo);
  headMesh.position.set(0, 1.95, 0.04);
  parts.push(headMesh);

  // Pescoço
  const neckGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.22, 12, 3);
  const neckMesh = new THREE.Mesh(neckGeo);
  neckMesh.position.set(0, 1.72, 0);
  parts.push(neckMesh);

  // Tronco / Peito
  const chestGeo = new THREE.BoxGeometry(0.82, 0.60, 0.46, 5, 4, 4);
  const chestMesh = new THREE.Mesh(chestGeo);
  chestMesh.position.set(0, 1.48, 0);
  parts.push(chestMesh);

  // Abdômen / Coluna inferior
  const spineGeo = new THREE.CylinderGeometry(0.28, 0.32, 0.35, 12, 3);
  const spineMesh = new THREE.Mesh(spineGeo);
  spineMesh.position.set(0, 1.15, 0);
  parts.push(spineMesh);

  // Bacia / Pélvis
  const pelvisGeo = new THREE.BoxGeometry(0.68, 0.34, 0.42, 4, 3, 4);
  const pelvisMesh = new THREE.Mesh(pelvisGeo);
  pelvisMesh.position.set(0, 0.98, 0);
  parts.push(pelvisMesh);

  // Membros superiores (Esquerdo e Direito)
  for (const [side, mult] of [['Left', -1], ['Right', 1]]) {
    // Clavícula / Ombreira
    const clavGeo = new THREE.SphereGeometry(0.18, 10, 8);
    const clavMesh = new THREE.Mesh(clavGeo);
    clavMesh.position.set(mult * 0.42, 1.62, 0);
    parts.push(clavMesh);

    // Braço superior
    const armGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.48, 10, 4);
    const armMesh = new THREE.Mesh(armGeo);
    armMesh.position.set(mult * 0.58, 1.42, 0);
    armMesh.rotation.z = mult * 0.22;
    parts.push(armMesh);

    // Cotovelo
    const elbowGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const elbowMesh = new THREE.Mesh(elbowGeo);
    elbowMesh.position.set(mult * 0.69, 1.18, 0);
    parts.push(elbowMesh);

    // Antebraço
    const forearmGeo = new THREE.CylinderGeometry(0.11, 0.14, 0.44, 10, 4);
    const forearmMesh = new THREE.Mesh(forearmGeo);
    forearmMesh.position.set(mult * 0.76, 0.96, 0);
    forearmMesh.rotation.z = mult * 0.15;
    parts.push(forearmMesh);

    // Punho e mão
    const handGeo = new THREE.BoxGeometry(0.16, 0.22, 0.12, 3, 3, 2);
    const handMesh = new THREE.Mesh(handGeo);
    handMesh.position.set(mult * 0.82, 0.72, 0);
    parts.push(handMesh);
  }

  // Membros inferiores (Esquerdo e Direito)
  for (const [side, mult] of [['Left', -1], ['Right', 1]]) {
    // Coxa
    const thighGeo = new THREE.CylinderGeometry(0.17, 0.14, 0.56, 12, 4);
    const thighMesh = new THREE.Mesh(thighGeo);
    thighMesh.position.set(mult * 0.26, 0.74, 0.02);
    parts.push(thighMesh);

    // Joelho
    const kneeGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const kneeMesh = new THREE.Mesh(kneeGeo);
    kneeMesh.position.set(mult * 0.26, 0.48, 0.04);
    parts.push(kneeMesh);

    // Canela / Perna inferior
    const shinGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.52, 12, 4);
    const shinMesh = new THREE.Mesh(shinGeo);
    shinMesh.position.set(mult * 0.26, 0.24, 0.01);
    parts.push(shinMesh);

    // Tornozelo
    const ankleGeo = new THREE.SphereGeometry(0.11, 8, 8);
    const ankleMesh = new THREE.Mesh(ankleGeo);
    ankleMesh.position.set(mult * 0.26, 0.08, 0.01);
    parts.push(ankleMesh);

    // Pé
    const footGeo = new THREE.BoxGeometry(0.22, 0.12, 0.38, 3, 2, 4);
    const footMesh = new THREE.Mesh(footGeo);
    footMesh.position.set(mult * 0.26, 0.05, 0.10);
    parts.push(footMesh);
  }

  // Funde as partes em uma única malha contínua
  const mergedGeom = mergeGeometries(parts);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x486b99,
    roughness: 0.35,
    metalness: 0.15,
    flatShading: false
  });

  const body = new THREE.Mesh(mergedGeom, mat);
  body.name = 'Golem_BodyMesh';
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  return root;
}

/**
 * Cria a criatura quadrúpede estilizada com cauda e chifres
 * para demonstrar esqueletos de animais e monstros.
 */
export function createProceduralQuadruped() {
  const root = new THREE.Group();
  root.name = 'Arenamon_Quadruped_Beast';

  const parts = [];

  // Tronco torácico anterior
  const frontTorsoGeo = new THREE.BoxGeometry(0.70, 0.65, 0.75, 4, 4, 4);
  const frontTorsoMesh = new THREE.Mesh(frontTorsoGeo);
  frontTorsoMesh.position.set(0, 0.95, 0.28);
  parts.push(frontTorsoMesh);

  // Abdômen e lombo
  const backTorsoGeo = new THREE.BoxGeometry(0.62, 0.58, 0.85, 4, 4, 4);
  const backTorsoMesh = new THREE.Mesh(backTorsoGeo);
  backTorsoMesh.position.set(0, 0.92, -0.40);
  parts.push(backTorsoMesh);

  // Pescoço oblíquo
  const neckGeo = new THREE.CylinderGeometry(0.18, 0.26, 0.45, 10, 3);
  const neckMesh = new THREE.Mesh(neckGeo);
  neckMesh.position.set(0, 1.25, 0.62);
  neckMesh.rotation.x = 0.55;
  parts.push(neckMesh);

  // Cabeça predatória
  const headGeo = new THREE.BoxGeometry(0.40, 0.38, 0.62, 4, 3, 5);
  const headMesh = new THREE.Mesh(headGeo);
  headMesh.position.set(0, 1.45, 0.92);
  parts.push(headMesh);

  // Focinho / Mandíbula
  const jawGeo = new THREE.BoxGeometry(0.28, 0.22, 0.34, 3, 2, 3);
  const jawMesh = new THREE.Mesh(jawGeo);
  jawMesh.position.set(0, 1.34, 1.22);
  parts.push(jawMesh);

  // Chifres curvos
  for (const mult of [-1, 1]) {
    const hornGeo = new THREE.ConeGeometry(0.08, 0.42, 8, 3);
    const hornMesh = new THREE.Mesh(hornGeo);
    hornMesh.position.set(mult * 0.22, 1.74, 0.85);
    hornMesh.rotation.x = -0.3;
    hornMesh.rotation.z = -mult * 0.35;
    parts.push(hornMesh);
  }

  // Cauda segmentada (3 partes)
  const tailBaseGeo = new THREE.CylinderGeometry(0.14, 0.10, 0.45, 8, 3);
  const tailBaseMesh = new THREE.Mesh(tailBaseGeo);
  tailBaseMesh.position.set(0, 0.88, -0.92);
  tailBaseMesh.rotation.x = -0.85;
  parts.push(tailBaseMesh);

  const tailMidGeo = new THREE.CylinderGeometry(0.10, 0.07, 0.42, 8, 3);
  const tailMidMesh = new THREE.Mesh(tailMidGeo);
  tailMidMesh.position.set(0, 0.74, -1.24);
  tailMidMesh.rotation.x = -1.1;
  parts.push(tailMidMesh);

  const tailTipGeo = new THREE.ConeGeometry(0.09, 0.40, 8, 3);
  const tailTipMesh = new THREE.Mesh(tailTipGeo);
  tailTipMesh.position.set(0, 0.62, -1.52);
  tailTipMesh.rotation.x = -1.3;
  parts.push(tailTipMesh);

  // Patas dianteiras
  for (const mult of [-1, 1]) {
    const shoulderGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const shoulderMesh = new THREE.Mesh(shoulderGeo);
    shoulderMesh.position.set(mult * 0.38, 0.95, 0.38);
    parts.push(shoulderMesh);

    const fLegGeo = new THREE.CylinderGeometry(0.12, 0.10, 0.48, 8, 3);
    const fLegMesh = new THREE.Mesh(fLegGeo);
    fLegMesh.position.set(mult * 0.40, 0.65, 0.40);
    parts.push(fLegMesh);

    const fKneeGeo = new THREE.SphereGeometry(0.11, 8, 8);
    const fKneeMesh = new THREE.Mesh(fKneeGeo);
    fKneeMesh.position.set(mult * 0.40, 0.42, 0.42);
    parts.push(fKneeMesh);

    const fLowerGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.42, 8, 3);
    const fLowerMesh = new THREE.Mesh(fLowerGeo);
    fLowerMesh.position.set(mult * 0.40, 0.22, 0.38);
    parts.push(fLowerMesh);

    const fPawGeo = new THREE.BoxGeometry(0.22, 0.10, 0.26, 3, 2, 3);
    const fPawMesh = new THREE.Mesh(fPawGeo);
    fPawMesh.position.set(mult * 0.40, 0.05, 0.42);
    parts.push(fPawMesh);
  }

  // Patas traseiras
  for (const mult of [-1, 1]) {
    const hipGeo = new THREE.SphereGeometry(0.19, 8, 8);
    const hipMesh = new THREE.Mesh(hipGeo);
    hipMesh.position.set(mult * 0.36, 0.90, -0.42);
    parts.push(hipMesh);

    const bThighGeo = new THREE.CylinderGeometry(0.15, 0.12, 0.52, 8, 3);
    const bThighMesh = new THREE.Mesh(bThighGeo);
    bThighMesh.position.set(mult * 0.38, 0.62, -0.48);
    bThighMesh.rotation.x = 0.25;
    parts.push(bThighMesh);

    const bKneeGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const bKneeMesh = new THREE.Mesh(bKneeGeo);
    bKneeMesh.position.set(mult * 0.38, 0.38, -0.56);
    parts.push(bKneeMesh);

    const bLowerGeo = new THREE.CylinderGeometry(0.10, 0.11, 0.44, 8, 3);
    const bLowerMesh = new THREE.Mesh(bLowerGeo);
    bLowerMesh.position.set(mult * 0.38, 0.20, -0.48);
    bLowerMesh.rotation.x = -0.25;
    parts.push(bLowerMesh);

    const bPawGeo = new THREE.BoxGeometry(0.24, 0.10, 0.28, 3, 2, 3);
    const bPawMesh = new THREE.Mesh(bPawGeo);
    bPawMesh.position.set(mult * 0.38, 0.05, -0.44);
    parts.push(bPawMesh);
  }

  const mergedGeom = mergeGeometries(parts);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x9e5842,
    roughness: 0.42,
    metalness: 0.12,
    flatShading: false
  });

  const body = new THREE.Mesh(mergedGeom, mat);
  body.name = 'Beast_BodyMesh';
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  return root;
}

/**
 * Utilitário de mesclagem geométrica sem dependências extras.
 */
function mergeGeometries(meshList) {
  let totalVertices = 0;
  let totalIndices = 0;

  for (const m of meshList) {
    m.updateMatrix();
    const g = m.geometry;
    totalVertices += g.attributes.position.count;
    totalIndices += g.index ? g.index.count : g.attributes.position.count;
  }

  const posArr = new Float32Array(totalVertices * 3);
  const normArr = new Float32Array(totalVertices * 3);
  const idxArr = totalVertices > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;

  for (const m of meshList) {
    const g = m.geometry.clone();
    g.applyMatrix4(m.matrix);
    g.computeVertexNormals();

    const pos = g.attributes.position;
    const norm = g.attributes.normal;
    const n = pos.count;

    for (let i = 0; i < n; i++) {
      posArr[(vOffset + i) * 3] = pos.getX(i);
      posArr[(vOffset + i) * 3 + 1] = pos.getY(i);
      posArr[(vOffset + i) * 3 + 2] = pos.getZ(i);

      if (norm) {
        normArr[(vOffset + i) * 3] = norm.getX(i);
        normArr[(vOffset + i) * 3 + 1] = norm.getY(i);
        normArr[(vOffset + i) * 3 + 2] = norm.getZ(i);
      }
    }

    if (g.index) {
      for (let i = 0; i < g.index.count; i++) {
        idxArr[iOffset + i] = g.index.getX(i) + vOffset;
      }
      iOffset += g.index.count;
    } else {
      for (let i = 0; i < n; i++) {
        idxArr[iOffset + i] = vOffset + i;
      }
      iOffset += n;
    }

    vOffset += n;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
  merged.setIndex(new THREE.BufferAttribute(idxArr, 1));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

export async function parseGLBFile(file) {
  const buffer = await file.arrayBuffer();
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(buffer, '', gltf => {
      resolve(gltf.scene);
    }, reject);
  });
}
