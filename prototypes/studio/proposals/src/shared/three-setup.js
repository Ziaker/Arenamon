// Gerenciador do Viewport 3D Three.js compartilhado entre as propostas de rigging.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export class ViewportManager {
  constructor({ container, bridge, onSelectJoint, onJointTransform = null }) {
    this.container = container;
    this.bridge = bridge;
    this.onSelectJoint = onSelectJoint;
    this.onJointTransform = onJointTransform;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1424);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(2.4, 2.0, 3.2);

    // Câmera ortográfica dedicada para projeções técnicas ortogonais (Quad-View)
    this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);

    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const glQuery = urlParams?.get('gl');
    let isSoftware = glQuery === 'lite';
    if (!isSoftware && glQuery !== 'full' && typeof document !== 'undefined') {
      try {
        const testCanvas = document.createElement('canvas');
        const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
        const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
        const rdr = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
        isSoftware = /swiftshader|llvmpipe|softpipe|microsoft basic render|\bwarp\b/i.test(rdr);
      } catch {}
    }
    this.isSoftwareGL = isSoftware;
    if (this.isSoftwareGL && typeof document !== 'undefined') {
      document.documentElement.classList.add('gl-lite');
    }

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGL,
      alpha: false,
      powerPreference: this.isSoftwareGL ? 'low-power' : 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGL ? 0.5 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGL;
    if (!this.isSoftwareGL) {
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    container.appendChild(this.renderer.domElement);

    // Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 1.0, 0);
    this.controls.maxDistance = 25;
    this.controls.minDistance = 0.2;

    // Transform Controls (Gizmo)
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.setMode('translate');
    this.transformControls.size = 0.75;
    this.transformHelper = this.transformControls.getHelper();
    this.scene.add(this.transformHelper);
    this.transformHelper.visible = false;

    // Grupos da cena
    this.modelGroup = new THREE.Group();
    this.modelGroup.name = 'ModelContainer';
    this.scene.add(this.modelGroup);

    this.bonesGroup = new THREE.Group();
    this.bonesGroup.name = 'RigVisuals';
    this.scene.add(this.bonesGroup);

    // Estado visual
    this.markersMap = new Map(); // jointName -> THREE.Mesh
    this.boneConnectors = [];
    this.xrayMode = true;
    this.showMarkers = true;
    this.showBones = true;
    this.meshOpacity = 0.92;
    this.heatmapActive = false;
    this.multiViewActive = false;

    // Raycasting para seleção com mouse
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.setupLighting();
    this.setupGrid();
    this.setupEvents();

    this.render = this.render.bind(this);
    this.animId = requestAnimationFrame(this.render);
  }

  setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0xdbe9ff, 0x111c30, 0.7);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight.position.set(4, 7, 5);
    if (!this.isSoftwareGL) {
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.bias = -0.0005;
    }
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x54d9ee, 0.55);
    fillLight.position.set(-5, 3, -4);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x9b84ff, 0.65);
    rimLight.position.set(0, 6, -6);
    this.scene.add(rimLight);
  }

  setupGrid() {
    const grid = new THREE.GridHelper(12, 24, 0x54d9ee, 0x223550);
    grid.position.y = -0.001;
    this.scene.add(grid);

    const floorGeo = new THREE.PlaneGeometry(24, 24);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x09101d,
      roughness: 0.85,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.002;
    if (!this.isSoftwareGL) {
      floor.receiveShadow = true;
    }
    this.scene.add(floor);
  }

  setupEvents() {
    window.addEventListener('resize', () => this.resize());

    // Bloqueia órbita ao arrastar gizmo e registra início/fim para Undo/Redo
    this.transformControls.addEventListener('dragging-changed', (e) => {
      this.controls.enabled = !e.value;
      const selected = this.bridge.selectedJointName;
      if (e.value) {
        // Início do arrasto: grava estado inicial do osso e par simétrico
        if (selected) {
          this.bridge.beginDrag(selected);
        }
      } else {
        // Fim do arrasto: sincroniza posição final e gera comando de histórico
        if (selected) {
          const marker = this.markersMap.get(selected);
          if (marker && this.bridge.model) {
            const localPos = this.bridge.model.worldToLocal(marker.position.clone());
            this.bridge.setJointPosition(selected, [localPos.x, localPos.y, localPos.z], { recordHistory: false });
          }
          this.bridge.commitDrag(selected);
          this.updateJointPositions();
          this.updateBoneConnectors();
          if (typeof this.onJointTransform === 'function') {
            this.onJointTransform(selected);
          }
        }
      }
    });

    this.transformControls.addEventListener('objectChange', () => {
      const selected = this.bridge.selectedJointName;
      const marker = this.markersMap.get(selected);
      if (selected && marker && this.bridge.model) {
        const localPos = this.bridge.model.worldToLocal(marker.position.clone());
        this.bridge.setJointPosition(selected, [localPos.x, localPos.y, localPos.z], { recordHistory: false });

        // Se simetria estiver ativa, sincroniza a posição do companheiro no 3D em tempo real
        const companion = this.bridge.getSymmetricCompanion(selected);
        if (this.bridge.symmetryEnabled && companion && this.markersMap.has(companion)) {
          const compJoint = this.bridge.getJoint(companion);
          if (compJoint) {
            const compLocal = new THREE.Vector3(...compJoint.p);
            const compWorld = this.bridge.model.localToWorld(compLocal.clone());
            this.markersMap.get(companion).position.copy(compWorld);
          }
        }

        this.updateBoneConnectors();
        if (typeof this.onJointTransform === 'function') {
          this.onJointTransform(selected);
        }
      }
    });

    // Clique direto no 3D
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      if (this.transformControls.dragging) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const visibleMarkers = Array.from(this.markersMap.values()).filter(m => m.visible);
      const hits = this.raycaster.intersectObjects(visibleMarkers, false);

      if (hits.length > 0) {
        const jointName = hits[0].object.userData.jointName;
        if (jointName) {
          this.bridge.selectJoint(jointName);
          if (typeof this.onSelectJoint === 'function') {
            this.onSelectJoint(jointName);
          }
        }
      }
    });
  }

  resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  loadModel(model) {
    this.modelGroup.clear();
    this.modelGroup.add(model);
    this.bridge.setModel(model);

    // Ajusta câmera para o centro do modelo
    const bounds = this.bridge.getModelBounds();
    const center = new THREE.Vector3(...bounds.center);
    this.controls.target.copy(center);
    this.camera.position.set(center.x + bounds.size[0] * 1.5, center.y + bounds.size[1] * 0.7, center.z + bounds.size[2] * 2.2);
    this.controls.update();

    this.rebuildBoneVisuals();
    this.updateMeshTransparency();
  }

  rebuildBoneVisuals() {
    this.transformControls.detach();
    this.transformHelper.visible = false;

    // Limpa marcadores e conectores anteriores
    this.markersMap.forEach(m => {
      m.geometry.dispose();
      m.material.dispose();
      this.bonesGroup.remove(m);
    });
    this.markersMap.clear();

    this.boneConnectors.forEach(c => {
      c.geometry.dispose();
      c.material.dispose();
      this.bonesGroup.remove(c);
    });
    this.boneConnectors = [];

    const joints = this.bridge.getJoints();
    if (!joints.length) return;

    const bounds = this.bridge.getModelBounds();
    const radius = Math.max(0.015, Math.max(...bounds.size) * 0.018);
    const sphereGeo = new THREE.SphereGeometry(1, 16, 12);

    for (const j of joints) {
      const mat = new THREE.MeshBasicMaterial({
        color: this.getJointColor(j.name),
        depthTest: !this.xrayMode,
        transparent: true,
        opacity: 0.95
      });
      const marker = new THREE.Mesh(sphereGeo, mat);
      marker.name = 'Marker_' + j.name;
      marker.userData.jointName = j.name;
      marker.userData.baseRadius = radius;
      marker.scale.setScalar(radius);
      marker.renderOrder = 999;
      this.bonesGroup.add(marker);
      this.markersMap.set(j.name, marker);
    }

    this.updateJointPositions();
    this.rebuildBoneConnectors();
    this.updateSelection();
  }

  getJointColor(name) {
    if (name === this.bridge.selectedJointName) return 0xffd17d;
    if (name.startsWith('Left') || name.endsWith('Left')) return 0x54d9ee;
    if (name.startsWith('Right') || name.endsWith('Right')) return 0xff7796;
    if (name.includes('Tail') || name.includes('Horn')) return 0xffd18c;
    return 0xbff36a;
  }

  updateJointPositions() {
    if (!this.bridge.model) return;
    this.bridge.model.updateMatrixWorld(true);

    for (const [name, marker] of this.markersMap.entries()) {
      const j = this.bridge.getJoint(name);
      if (j) {
        const local = new THREE.Vector3(...j.p);
        const worldPos = this.bridge.model.localToWorld(local.clone());
        marker.position.copy(worldPos);

        const isIsolated = this.bridge.isolatedJointChain && !this.bridge.isolatedJointChain.has(name);
        marker.visible = this.showMarkers && !isIsolated;
      }
    }

    // Garante que o gizmo do TransformControls acompanhe o marcador após atualização de posição (ex: Undo / Redo / Inputs)
    if (this.bridge.selectedJointName && this.markersMap.has(this.bridge.selectedJointName)) {
      const selMarker = this.markersMap.get(this.bridge.selectedJointName);
      if (this.transformControls.object === selMarker && this.transformHelper) {
        this.transformHelper.updateMatrixWorld(true);
      }
    }
  }

  rebuildBoneConnectors() {
    this.boneConnectors.forEach(c => {
      c.geometry.dispose();
      c.material.dispose();
      this.bonesGroup.remove(c);
    });
    this.boneConnectors = [];

    const joints = this.bridge.getJoints();
    const bounds = this.bridge.getModelBounds();
    const maxDim = Math.max(...bounds.size);

    for (const j of joints) {
      if (!j.parent) continue;
      const parentJoint = this.bridge.getJoint(j.parent);
      if (!parentJoint) continue;

      // Cria cone/osso octaédrico entre pai e filho
      const connGeo = new THREE.ConeGeometry(maxDim * 0.018, 1, 6);
      connGeo.translate(0, 0.5, 0);
      connGeo.rotateX(Math.PI / 2);

      const connMat = new THREE.MeshBasicMaterial({
        color: 0x3d709e,
        wireframe: true,
        transparent: true,
        opacity: 0.65,
        depthTest: !this.xrayMode
      });

      const connector = new THREE.Mesh(connGeo, connMat);
      connector.renderOrder = 998;
      connector.userData = { parentName: j.parent, childName: j.name };
      this.bonesGroup.add(connector);
      this.boneConnectors.push(connector);
    }
    this.updateBoneConnectors();
  }

  updateBoneConnectors() {
    if (!this.bridge.model) return;
    for (const conn of this.boneConnectors) {
      const parentMarker = this.markersMap.get(conn.userData.parentName);
      const childMarker = this.markersMap.get(conn.userData.childName);
      if (!parentMarker || !childMarker) continue;

      const p1 = parentMarker.position;
      const p2 = childMarker.position;
      const dist = p1.distanceTo(p2);

      if (dist < 1e-4) {
        conn.visible = false;
        continue;
      }

      conn.visible = this.showBones && parentMarker.visible && childMarker.visible;
      conn.position.copy(p1);
      conn.lookAt(p2);
      conn.scale.set(1, 1, dist);

      const isSelectedBranch = conn.userData.childName === this.bridge.selectedJointName ||
                               conn.userData.parentName === this.bridge.selectedJointName;
      conn.material.color.set(isSelectedBranch ? 0xffd17d : 0x4a82b8);
      conn.material.opacity = isSelectedBranch ? 0.9 : 0.5;
    }
  }

  updateSelection() {
    const selected = this.bridge.selectedJointName;
    for (const [name, marker] of this.markersMap.entries()) {
      const isSelected = name === selected;
      marker.material.color.set(this.getJointColor(name));
      marker.scale.setScalar(marker.userData.baseRadius * (isSelected ? 1.6 : 1.0));
      marker.material.depthTest = !this.xrayMode;
    }

    if (selected && this.markersMap.has(selected) && this.showMarkers) {
      const marker = this.markersMap.get(selected);
      this.transformControls.attach(marker);
      this.transformHelper.visible = true;
    } else {
      this.transformControls.detach();
      this.transformHelper.visible = false;
    }

    this.updateBoneConnectors();
    if (this.heatmapActive) {
      this.updateHeatmap();
    }
  }

  setMeshOpacity(opacity) {
    this.meshOpacity = opacity;
    this.updateMeshTransparency();
  }

  setXRay(enabled) {
    this.xrayMode = enabled;
    for (const marker of this.markersMap.values()) {
      marker.material.depthTest = !enabled;
    }
    for (const conn of this.boneConnectors) {
      conn.material.depthTest = !enabled;
    }
  }

  setShowMarkers(show) {
    this.showMarkers = show;
    this.updateJointPositions();
    this.updateSelection();
  }

  setShowBones(show) {
    this.showBones = show;
    this.updateBoneConnectors();
  }

  updateMeshTransparency() {
    if (!this.bridge.model) return;
    this.bridge.model.traverse(o => {
      if (o.isMesh && o.material) {
        o.material.transparent = this.meshOpacity < 0.99;
        o.material.opacity = this.meshOpacity;
        o.material.needsUpdate = true;
      }
    });
  }

  setHeatmap(active) {
    this.heatmapActive = active;
    if (!this.bridge.model) return;

    if (active) {
      this.updateHeatmap();
    } else {
      // Restaura cor original de todas as malhas sem destruir cores de vértices pré-existentes no GLB
      this.bridge.model.traverse(o => {
        if (o.isMesh) {
          if (o.userData.__hasOriginalVertexColors) {
            if (o.userData.__origVertexColorAttribute) {
              o.geometry.setAttribute('color', o.userData.__origVertexColorAttribute.clone());
              o.geometry.attributes.color.needsUpdate = true;
            }
          } else {
            if (o.geometry?.attributes?.color) {
              o.geometry.deleteAttribute('color');
            }
          }

          if (o.material) {
            const restoreMat = m => {
              if (m) {
                if (m.userData.__origVertexColors !== undefined) {
                  m.vertexColors = m.userData.__origVertexColors;
                  delete m.userData.__origVertexColors;
                } else if (!o.userData.__hasOriginalVertexColors) {
                  m.vertexColors = false;
                }
                m.needsUpdate = true;
              }
            };
            if (Array.isArray(o.material)) o.material.forEach(restoreMat);
            else restoreMat(o.material);
          }

          delete o.userData.__hasOriginalVertexColors;
          delete o.userData.__origVertexColorAttribute;
        }
      });
    }
  }

  updateHeatmap() {
    if (!this.bridge.model || !this.bridge.selectedJointName) return;
    this.bridge.model.updateMatrixWorld(true);

    this.bridge.model.traverse(o => {
      if (o.isMesh && o.geometry?.attributes?.position) {
        // Se ainda não salvou o estado original dos vértices desta malha, salva agora antes de mutar
        if (o.userData.__hasOriginalVertexColors === undefined) {
          if (o.geometry.attributes.color) {
            o.userData.__hasOriginalVertexColors = true;
            o.userData.__origVertexColorAttribute = o.geometry.attributes.color.clone();
          } else {
            o.userData.__hasOriginalVertexColors = false;
            o.userData.__origVertexColorAttribute = null;
          }

          if (o.material) {
            const cacheMat = m => {
              if (m && m.userData.__origVertexColors === undefined) {
                m.userData.__origVertexColors = !!m.vertexColors;
              }
            };
            if (Array.isArray(o.material)) o.material.forEach(cacheMat);
            else cacheMat(o.material);
          }
        }

        const colors = this.bridge.getMeshHeatmapColors(o, this.bridge.selectedJointName);
        if (colors) {
          o.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          if (o.material) {
            const setMat = m => { if (m) { m.vertexColors = true; m.needsUpdate = true; } };
            if (Array.isArray(o.material)) o.material.forEach(setMat);
            else setMat(o.material);
          }
        }
      }
    });
  }

  setCameraView(viewName) {
    const bounds = this.bridge.getModelBounds();
    const center = new THREE.Vector3(...bounds.center);
    const maxDim = Math.max(...bounds.size);
    const dist = maxDim * 2.1;

    this.controls.target.copy(center);

    switch (viewName) {
      case 'front':
        this.camera.position.set(center.x, center.y, center.z + dist);
        break;
      case 'side':
      case 'right':
        this.camera.position.set(center.x + dist, center.y, center.z);
        break;
      case 'left':
        this.camera.position.set(center.x - dist, center.y, center.z);
        break;
      case 'top':
        this.camera.position.set(center.x, center.y + dist, center.z + 0.001);
        break;
      case 'back':
        this.camera.position.set(center.x, center.y, center.z - dist);
        break;
      case 'persp':
      default:
        this.camera.position.set(center.x + dist * 0.7, center.y + dist * 0.45, center.z + dist * 0.85);
        break;
    }
    this.controls.update();
  }

  frameSelectedJoint() {
    const selected = this.bridge.selectedJointName;
    if (!selected) return;
    const marker = this.markersMap.get(selected);
    if (!marker) return;

    const targetPos = marker.position.clone();
    this.controls.target.copy(targetPos);

    const dir = new THREE.Vector3().subVectors(this.camera.position, targetPos).normalize();
    const bounds = this.bridge.getModelBounds();
    const zoomDist = Math.max(...bounds.size) * 0.75;

    this.camera.position.copy(targetPos).addScaledVector(dir, zoomDist);
    this.controls.update();
  }

  setMultiView(enabled) {
    this.multiViewActive = enabled;
  }

  render(now) {
    const minFrameDelta = this.multiViewActive ? 66 : 50;
    if (this.isSoftwareGL && now && now - (this.lastDrawTime || 0) < minFrameDelta) {
      this.animId = requestAnimationFrame(this.render);
      return;
    }
    this.lastDrawTime = now;

    this.controls.update();

    if (!this.multiViewActive) {
      this.renderer.setViewport(0, 0, this.container.clientWidth, this.container.clientHeight);
      this.renderer.setScissorTest(false);
      this.renderer.render(this.scene, this.camera);
    } else {
      // Modo Quad-View: renderiza 4 quadrantes
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      const halfW = Math.floor(w / 2);
      const halfH = Math.floor(h / 2);

      this.renderer.setScissorTest(true);

      // Quadrante 1 (Top-Left): Perspectiva Orbital
      this.renderer.setViewport(0, halfH, halfW, halfH);
      this.renderer.setScissor(0, halfH, halfW, halfH);
      this.renderer.render(this.scene, this.camera);

      // Câmera ortográfica técnica para vistas ortográficas puras (Frontal, Lateral, Superior)
      const bounds = this.bridge.getModelBounds();
      const center = new THREE.Vector3(...bounds.center);
      const maxDim = Math.max(...bounds.size, 1);
      const dist = maxDim * 2.5;

      const aspect = halfW / halfH;
      const frustumHeight = maxDim * 1.5;
      const frustumWidth = frustumHeight * aspect;

      if (!this.orthoCam || !this.orthoCam.isOrthographicCamera) {
        this.orthoCam = new THREE.OrthographicCamera();
      }
      this.orthoCam.left = -frustumWidth / 2;
      this.orthoCam.right = frustumWidth / 2;
      this.orthoCam.top = frustumHeight / 2;
      this.orthoCam.bottom = -frustumHeight / 2;
      this.orthoCam.near = 0.01;
      this.orthoCam.far = dist * 4;
      this.orthoCam.updateProjectionMatrix();

      // Quadrante 2 (Top-Right): Frontal (+Z para -Z)
      this.orthoCam.up.set(0, 1, 0);
      this.orthoCam.position.set(center.x, center.y, center.z + dist);
      this.orthoCam.lookAt(center);
      this.renderer.setViewport(halfW, halfH, halfW, halfH);
      this.renderer.setScissor(halfW, halfH, halfW, halfH);
      this.renderer.render(this.scene, this.orthoCam);

      // Quadrante 3 (Bottom-Left): Lateral (+X para -X)
      this.orthoCam.up.set(0, 1, 0);
      this.orthoCam.position.set(center.x + dist, center.y, center.z);
      this.orthoCam.lookAt(center);
      this.renderer.setViewport(0, 0, halfW, halfH);
      this.renderer.setScissor(0, 0, halfW, halfH);
      this.renderer.render(this.scene, this.orthoCam);

      // Quadrante 4 (Bottom-Right): Superior (+Y para -Y, olhando de cima com up = (0, 0, -1))
      this.orthoCam.up.set(0, 0, -1);
      this.orthoCam.position.set(center.x, center.y + dist, center.z);
      this.orthoCam.lookAt(center);
      this.renderer.setViewport(halfW, 0, halfW, halfH);
      this.renderer.setScissor(halfW, 0, halfW, halfH);
      this.renderer.render(this.scene, this.orthoCam);
    }

    this.animId = requestAnimationFrame(this.render);
  }

  dispose() {
    cancelAnimationFrame(this.animId);
    this.renderer.dispose();
  }
}
