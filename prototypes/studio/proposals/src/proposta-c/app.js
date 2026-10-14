// PROPOSTA C — Hybrid Rigging Studio
// Combinação inteligente de fluxo guiado para iniciantes e ferramentas avançadas sob demanda.
import * as THREE from 'three';
import { RiggingBridge, HUMANOID_TEMPLATE_20, CREATURE_QUADRUPED_24 } from '../shared/rig-bridge.js';
import { createProceduralBiped, createProceduralQuadruped, parseGLBFile } from '../shared/models.js';
import { ViewportManager } from '../shared/three-setup.js';

class PropostaCHybrid {
  constructor() {
    this.mode = 'guided'; // 'guided' | 'studio'
    this.container = document.getElementById('viewport-3d');

    this.bridge = new RiggingBridge({
      onStateChange: (state) => this.onBridgeStateChange(state)
    });

    this.viewport = new ViewportManager({
      container: this.container,
      bridge: this.bridge,
      onSelectJoint: (name) => this.onJointSelected(name)
    });

    this.initDOM();
    this.bindEvents();

    this.loadCharacter(HUMANOID_TEMPLATE_20);
    this.setMode('guided');
  }

  loadCharacter(type) {
    if (type === CREATURE_QUADRUPED_24) {
      const model = createProceduralQuadruped();
      this.viewport.loadModel(model);
      this.bridge.initTemplate(CREATURE_QUADRUPED_24);
    } else {
      const model = createProceduralBiped();
      this.viewport.loadModel(model);
      this.bridge.initTemplate(HUMANOID_TEMPLATE_20);
    }
    this.renderHierarchy();
    this.renderSelection();
    this.renderBreadcrumbs();
  }

  initDOM() {
    this.modeBtns = document.querySelectorAll('.mode-switch-btn');
    this.dockLeft = document.getElementById('dock-left');
    this.dockRight = document.getElementById('dock-right');
    this.dockBottom = document.getElementById('dock-bottom');
    this.breadcrumbsContainer = document.getElementById('viewport-breadcrumbs');
    this.treeContainer = document.getElementById('hybrid-tree');
    this.searchInput = document.getElementById('hybrid-search');
  }

  bindEvents() {
    // Mode Switcher
    this.modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetMode = btn.dataset.mode;
        this.setMode(targetMode);
      });
    });

    // Seletor de Personagem
    document.getElementById('hybrid-model-select').addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'upload') {
        document.getElementById('hybrid-file-input').click();
      } else {
        this.loadCharacter(val);
      }
    });

    document.getElementById('hybrid-file-input').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        try {
          const model = await parseGLBFile(file);
          this.viewport.loadModel(model);
          this.renderHierarchy();
          this.renderSelection();
          this.renderBreadcrumbs();
        } catch (err) {
          alert('Erro ao carregar GLB: ' + err.message);
        }
      }
      e.target.value = '';
    });

    // Toggles de Dock
    document.getElementById('btn-toggle-dock-left').addEventListener('click', () => {
      this.dockLeft.classList.toggle('collapsed');
      this.updateBottomDockLayout();
    });

    document.getElementById('btn-toggle-dock-right').addEventListener('click', () => {
      this.dockRight.classList.toggle('collapsed');
      this.updateBottomDockLayout();
    });

    // Câmera & Vistas
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.viewport.setCameraView(btn.dataset.view);
      });
    });

    document.getElementById('btn-quad-view')?.addEventListener('click', (e) => {
      const active = !this.viewport.multiViewActive;
      this.viewport.setMultiView(active);
      e.target.classList.toggle('active', active);
    });

    document.getElementById('btn-toggle-xray')?.addEventListener('click', (e) => {
      const active = !this.viewport.xrayMode;
      this.viewport.setXRay(active);
      e.target.classList.toggle('active', active);
    });

    document.getElementById('btn-frame-joint')?.addEventListener('click', () => {
      this.viewport.frameSelectedJoint();
    });

    document.getElementById('mesh-opacity')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.viewport.setMeshOpacity(val);
      const readout = document.getElementById('mesh-opacity-val');
      if (readout) readout.textContent = Math.round(val * 100) + '%';
    });

    // Heatmap Toggle na Bancada Inferior
    const heatmapBtn = document.getElementById('btn-dock-heatmap');
    heatmapBtn.addEventListener('click', () => {
      const active = !this.viewport.heatmapActive;
      this.viewport.setHeatmap(active);
      heatmapBtn.classList.toggle('active', active);
    });

    // Slider de Rotação / Deformação na Bancada Inferior
    const angleSlider = document.getElementById('dock-pose-slider');
    const angleReadout = document.getElementById('dock-pose-readout');
    angleSlider.addEventListener('input', () => {
      if (!this.bridge.selectedJointName) return;
      const deg = parseFloat(angleSlider.value);
      angleReadout.textContent = deg + '°';
      this.bridge.setDeformRotation(this.bridge.selectedJointName, 'x', deg);
    });

    document.getElementById('btn-dock-rest-pose').addEventListener('click', () => {
      angleSlider.value = 0;
      angleReadout.textContent = '0°';
      this.bridge.restoreRestPose();
    });

    // Undo / Redo
    document.getElementById('btn-undo').addEventListener('click', () => {
      this.bridge.undo();
      this.viewport.updateJointPositions();
      this.viewport.updateBoneConnectors();
      this.renderSelection();
    });

    document.getElementById('btn-redo').addEventListener('click', () => {
      this.bridge.redo();
      this.viewport.updateJointPositions();
      this.viewport.updateBoneConnectors();
      this.renderSelection();
    });

    // Busca
    this.searchInput.addEventListener('input', () => this.renderHierarchy());

    // Exportar / Importar JSON
    document.getElementById('btn-export-json').addEventListener('click', () => {
      const json = this.bridge.exportJSON();
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arenamon-hybrid-rig-${this.bridge.activeTemplateType}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('btn-bind-skin').addEventListener('click', () => {
      if (!this.bridge.draft) {
        alert('Este modelo já possui skinning ativo.');
        return;
      }
      if (confirm('Vincular skin agora?')) {
        try {
          const res = this.bridge.bindSkin({ smoothness: 0.13 });
          this.viewport.rebuildBoneVisuals();
          this.renderHierarchy();
          this.renderSelection();
          alert(`Skinning concluído com sucesso: ${res.bones.length} ossos vinculados!`);
        } catch (err) {
          alert('Erro ao vincular skin: ' + err.message);
        }
      }
    });
  }

  setMode(mode) {
    this.mode = mode;
    this.modeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));

    const guidedCards = document.querySelectorAll('.guided-only');
    const studioCards = document.querySelectorAll('.studio-only');

    if (mode === 'guided') {
      guidedCards.forEach(c => c.style.display = 'block');
      studioCards.forEach(c => c.style.display = 'none');
      document.getElementById('mode-indicator-text').textContent = 'Modo Assistido — Roteiro Inteligente';
    } else {
      guidedCards.forEach(c => c.style.display = 'none');
      studioCards.forEach(c => c.style.display = 'block');
      document.getElementById('mode-indicator-text').textContent = 'Modo Estúdio Livre — Ferramentas Pro';
    }
    this.renderSelection();
  }

  updateBottomDockLayout() {
    const leftCollapsed = this.dockLeft.classList.contains('collapsed');
    const rightCollapsed = this.dockRight.classList.contains('collapsed');

    this.dockBottom.style.left = leftCollapsed ? '14px' : '334px';
    this.dockBottom.style.right = rightCollapsed ? '14px' : '344px';
  }

  renderBreadcrumbs() {
    const selected = this.bridge.selectedJointName;
    if (!selected) {
      this.breadcrumbsContainer.innerHTML = '<span class="crumb-item active">Nenhum osso selecionado</span>';
      return;
    }

    // Constrói linhagem da raiz até o nó selecionado
    const chain = [selected];
    let curr = this.bridge.getJoint(selected);
    while (curr && curr.parent) {
      chain.unshift(curr.parent);
      curr = this.bridge.getJoint(curr.parent);
    }
    chain.unshift('Arenamon');

    this.breadcrumbsContainer.innerHTML = chain.map((name, idx) => {
      const isLast = idx === chain.length - 1;
      return `<span class="crumb-item ${isLast ? 'active' : ''}" data-crumb-joint="${name}">${name}</span>` +
             (!isLast ? '<span style="color:var(--dim)">›</span>' : '');
    }).join(' ');

    this.breadcrumbsContainer.querySelectorAll('[data-crumb-joint]').forEach(item => {
      item.onclick = () => {
        const jName = item.dataset.crumbJoint;
        if (jName !== 'Arenamon') {
          this.bridge.selectJoint(jName);
          this.viewport.updateSelection();
          this.renderSelection();
          this.renderBreadcrumbs();
        }
      };
    });
  }

  renderHierarchy() {
    const query = this.searchInput.value.toLowerCase().trim();
    const roots = this.bridge.getHierarchyTree();
    this.treeContainer.innerHTML = '';

    const buildNode = (node) => {
      const matches = !query || node.name.toLowerCase().includes(query);
      const row = document.createElement('div');
      row.className = 'tree-row' + (node.name === this.bridge.selectedJointName ? ' selected' : '');
      row.dataset.jointName = node.name;

      const isLeft = node.name.startsWith('Left');
      const isRight = node.name.startsWith('Right');
      const sideDot = isLeft ? '●' : isRight ? '●' : '◆';
      const sideColor = isLeft ? 'var(--cyan)' : isRight ? 'var(--rose)' : 'var(--lime)';

      row.innerHTML = `
        <span class="tree-expander">${node.children.length ? '▾' : '·'}</span>
        <span class="tree-icon" style="color: ${sideColor}">${sideDot}</span>
        <span class="tree-name">${node.name}</span>
      `;

      row.addEventListener('click', () => {
        this.bridge.selectJoint(node.name);
        this.viewport.updateSelection();
        this.renderSelection();
        this.renderBreadcrumbs();
      });

      const wrapper = document.createElement('div');
      wrapper.className = 'tree-node';
      if (matches || this.hasMatchingChild(node, query)) {
        wrapper.appendChild(row);
      }

      if (node.children.length > 0) {
        const childContainer = document.createElement('div');
        childContainer.className = 'tree-children';
        for (const child of node.children) {
          const childElem = buildNode(child);
          if (childElem) childContainer.appendChild(childElem);
        }
        if (childContainer.children.length > 0) {
          wrapper.appendChild(childContainer);
        }
      }
      return wrapper;
    };

    for (const r of roots) {
      this.treeContainer.appendChild(buildNode(r));
    }
  }

  hasMatchingChild(node, query) {
    if (!query) return true;
    for (const child of node.children) {
      if (child.name.toLowerCase().includes(query) || this.hasMatchingChild(child, query)) return true;
    }
    return false;
  }

  renderSelection() {
    const selected = this.bridge.selectedJointName;
    const joint = this.bridge.getJoint(selected);

    document.querySelectorAll('.tree-row').forEach(row => {
      row.classList.toggle('selected', row.dataset.jointName === selected);
    });

    if (!joint) return;

    document.getElementById('hybrid-joint-title').textContent = joint.name;
    document.getElementById('hybrid-joint-parent').textContent = joint.parent || '(Raiz)';

    // Coordenadas
    const xInput = document.getElementById('hybrid-coord-x');
    const yInput = document.getElementById('hybrid-coord-y');
    const zInput = document.getElementById('hybrid-coord-z');
    xInput.value = joint.p[0].toFixed(3);
    yInput.value = joint.p[1].toFixed(3);
    zInput.value = joint.p[2].toFixed(3);

    const applyCoords = () => {
      const pos = [parseFloat(xInput.value) || 0, parseFloat(yInput.value) || 0, parseFloat(zInput.value) || 0];
      this.bridge.setJointPosition(joint.name, pos);
      this.viewport.updateJointPositions();
      this.viewport.updateBoneConnectors();
    };

    xInput.onchange = applyCoords;
    yInput.onchange = applyCoords;
    zInput.onchange = applyCoords;

    // Quick-Fix Inteligente
    const quickFixBox = document.getElementById('quick-fix-area');
    const companion = this.bridge.getSymmetricCompanion(joint.name);

    if (companion && this.bridge.getJoint(companion)) {
      quickFixBox.innerHTML = `
        <div class="quick-fix-card">
          <h5>⚡ Ação Rápida de Simetria</h5>
          <p style="font-size:10px;color:var(--muted);margin-bottom:6px;">
            Espelhe a posição atual diretamente para <strong>${companion}</strong>.
          </p>
          <button class="btn-mini btn-primary" id="btn-quick-fix-mirror" style="width:100%;">
            Espelhar para ${companion}
          </button>
        </div>
      `;
      document.getElementById('btn-quick-fix-mirror').onclick = () => {
        this.bridge.mirrorSelectedJoint();
        this.viewport.updateJointPositions();
        this.viewport.updateBoneConnectors();
        this.renderSelection();
      };
    } else {
      quickFixBox.innerHTML = `
        <div style="font-size:11px;color:var(--dim);text-align:center;padding:8px 0;">
          Sem correções automáticas pendentes para este osso.
        </div>
      `;
    }
  }

  onJointSelected(name) {
    this.renderSelection();
    this.renderBreadcrumbs();
  }

  onBridgeStateChange(state) {
    document.getElementById('btn-undo').disabled = !state.canUndo;
    document.getElementById('btn-redo').disabled = !state.canRedo;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new PropostaCHybrid();
});
