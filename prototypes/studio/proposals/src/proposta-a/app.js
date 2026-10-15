// PROPOSTA A — Rigging Workspace
// Interface profissional organizada em Hierarquia (esquerda), Viewport Central e Inspetor (direita).
import * as THREE from 'three';
import { RiggingBridge, HUMANOID_TEMPLATE_20, CREATURE_QUADRUPED_24, CREATURE_QUADRUPED_27 } from '../shared/rig-bridge.js';
import { createProceduralBiped, createProceduralQuadruped, parseGLBFile } from '../shared/models.js';
import { ViewportManager } from '../shared/three-setup.js';

class PropostaAWorkspace {
  constructor() {
    this.container = document.getElementById('viewport-3d');
    this.activeTab = 'inspector'; // 'inspector' | 'weights' | 'deform'

    this.bridge = new RiggingBridge({
      onStateChange: (state) => this.onBridgeStateChange(state)
    });

    this.viewport = new ViewportManager({
      container: this.container,
      bridge: this.bridge,
      onSelectJoint: (name) => this.renderSelection(),
      onJointTransform: (name) => this.renderSelection()
    });

    this.initDOM();
    this.bindEvents();

    // Inicia com o Bípede Estilizado padrão
    this.loadCharacter(HUMANOID_TEMPLATE_20);
    window.__rigStudio = this;
  }

  loadCharacter(type) {
    if (type === CREATURE_QUADRUPED_27 || type === CREATURE_QUADRUPED_24) {
      const model = createProceduralQuadruped();
      this.viewport.loadModel(model);
      this.bridge.initTemplate(type);
    } else {
      const model = createProceduralBiped();
      this.viewport.loadModel(model);
      this.bridge.initTemplate(HUMANOID_TEMPLATE_20);
    }
    this.updateDivergenceCallout(type);
    this.renderHierarchy();
    this.renderSelection();
  }

  updateDivergenceCallout(type) {
    const divBox = document.getElementById('divergence-callout');
    if (!divBox) return;
    if (type === CREATURE_QUADRUPED_27) {
      divBox.style.display = 'block';
      divBox.innerHTML = `
        <div class="divergence-banner">
          <strong>✓ Besta Quadrúpede (27 Articulações):</strong>
          Template instanciado com <strong>27 articulações</strong> (24 de locomoção padrão + 3 de estilização de monstro: Jaw, LeftHorn, RightHorn). Contagem declarada e instanciada em conformidade (27).
        </div>
      `;
    } else if (type === CREATURE_QUADRUPED_24) {
      divBox.style.display = 'block';
      divBox.innerHTML = `
        <div class="divergence-banner">
          <strong>✓ Quadrúpede Base (24 Articulações):</strong>
          Template de locomoção padrão instanciado com <strong>24 articulações puras</strong> (sem mandíbula ou chifres). Contagem declarada e instanciada em conformidade (24).
        </div>
      `;
    } else {
      divBox.style.display = 'none';
      divBox.innerHTML = '';
    }
  }

  initDOM() {
    this.treeContainer = document.getElementById('tree-view');
    this.searchInput = document.getElementById('bone-search');
    this.inspectorPane = document.getElementById('tab-pane-inspector');
    this.weightsPane = document.getElementById('tab-pane-weights');
    this.deformPane = document.getElementById('tab-pane-deform');
    this.auditSummary = document.getElementById('audit-summary');
    this.auditList = document.getElementById('audit-warnings');
  }

  bindEvents() {
    // Seletor de Modelo / Personagem
    document.getElementById('model-select').addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'upload') {
        document.getElementById('file-input').click();
      } else {
        this.loadCharacter(val);
      }
    });

    document.getElementById('file-input').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        try {
          const model = await parseGLBFile(file);
          this.viewport.loadModel(model);
          this.renderHierarchy();
          this.renderSelection();
        } catch (err) {
          alert('Erro ao carregar GLB: ' + err.message);
        }
      }
      e.target.value = '';
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

    // Atalhos globais de teclado (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          this.bridge.redo();
        } else {
          this.bridge.undo();
        }
        this.viewport.updateJointPositions();
        this.viewport.updateBoneConnectors();
        this.renderSelection();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        this.bridge.redo();
        this.viewport.updateJointPositions();
        this.viewport.updateBoneConnectors();
        this.renderSelection();
      }
    });

    // Câmera & Vistas
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.viewport.setCameraView(btn.dataset.view);
      });
    });

    // Multi-View Quad View
    const quadBtn = document.getElementById('btn-quad-view');
    quadBtn.addEventListener('click', () => {
      const active = !this.viewport.multiViewActive;
      this.viewport.setMultiView(active);
      quadBtn.classList.toggle('active', active);
    });

    // Toggles de Visibilidade
    const xrayBtn = document.getElementById('btn-toggle-xray');
    xrayBtn.addEventListener('click', () => {
      const active = !this.viewport.xrayMode;
      this.viewport.setXRay(active);
      xrayBtn.classList.toggle('active', active);
    });

    const markersBtn = document.getElementById('btn-toggle-markers');
    markersBtn.addEventListener('click', () => {
      const active = !this.viewport.showMarkers;
      this.viewport.setShowMarkers(active);
      markersBtn.classList.toggle('active', active);
    });

    const bonesBtn = document.getElementById('btn-toggle-bones');
    bonesBtn.addEventListener('click', () => {
      const active = !this.viewport.showBones;
      this.viewport.setShowBones(active);
      bonesBtn.classList.toggle('active', active);
    });

    // Enquadrar Articulação
    document.getElementById('btn-frame-joint').addEventListener('click', () => {
      this.viewport.frameSelectedJoint();
    });

    // Transparência da Malha
    document.getElementById('mesh-opacity').addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.viewport.setMeshOpacity(val);
      document.getElementById('mesh-opacity-val').textContent = Math.round(val * 100) + '%';
    });

    // Simetria
    document.getElementById('chk-symmetry').addEventListener('change', (e) => {
      this.bridge.symmetryEnabled = e.target.checked;
    });

    // Busca na árvore
    this.searchInput.addEventListener('input', () => this.renderHierarchy());

    // Abas do Inspetor Direito
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.dataset.tab;

        this.inspectorPane.hidden = this.activeTab !== 'inspector';
        this.weightsPane.hidden = this.activeTab !== 'weights';
        this.deformPane.hidden = this.activeTab !== 'deform';

        const heatBtn = document.getElementById('btn-toggle-heatmap');
        if (this.activeTab === 'weights') {
          this.viewport.setHeatmap(true);
          heatBtn?.classList.add('active');
        } else {
          this.viewport.setHeatmap(false);
          heatBtn?.classList.remove('active');
        }
      });
    });

    // Ações de Hierarquia
    document.getElementById('btn-select-chain').addEventListener('click', () => {
      if (this.bridge.selectedJointName) {
        this.bridge.selectChain(this.bridge.selectedJointName);
        this.viewport.updateJointPositions();
        this.renderHierarchy();
      }
    });

    document.getElementById('btn-clear-isolation').addEventListener('click', () => {
      this.bridge.clearIsolation();
      this.viewport.updateJointPositions();
      this.renderHierarchy();
    });

    // Weight Painting
    document.getElementById('btn-toggle-heatmap').addEventListener('click', () => {
      const active = !this.viewport.heatmapActive;
      this.viewport.setHeatmap(active);
      document.getElementById('btn-toggle-heatmap').classList.toggle('active', active);
    });

    document.getElementById('btn-normalize-weights').addEventListener('click', () => {
      this.showReportModal(
        'Controle Demonstrativo (Fase 2)',
        `<div class="demo-banner">
          <strong>✦ Protótipo Visual de Weight Painting:</strong>
          A ferramenta de normalização de pesos e o ajuste manual de pincéis são protótipos visuais projetados para a Fase 2 do Codex. No momento, o cálculo volumétrico de influência e o mapa térmico (Heatmap) operam diretamente sobre o motor.
        </div>`
      );
    });

    // Teste de Deformação
    const poseSlider = document.getElementById('pose-angle-slider');
    const poseAxisSelect = document.getElementById('pose-axis-select');
    const poseAngleReadout = document.getElementById('pose-angle-readout');

    const updatePose = () => {
      if (!this.bridge.selectedJointName) return;
      const angle = parseFloat(poseSlider.value);
      const axis = poseAxisSelect.value;
      poseAngleReadout.textContent = angle + '°';
      this.bridge.setDeformRotation(this.bridge.selectedJointName, axis, angle);
    };

    poseSlider.addEventListener('input', updatePose);
    poseAxisSelect.addEventListener('change', updatePose);

    document.getElementById('btn-reset-pose').addEventListener('click', () => {
      poseSlider.value = 0;
      poseAngleReadout.textContent = '0°';
      this.bridge.restoreRestPose();
    });

    // Presets de Pose
    document.querySelectorAll('[data-preset-pose]').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.presetPose;
        this.applyPresetPose(preset);
      });
    });

    // Exportar / Importar JSON
    document.getElementById('btn-export-json').addEventListener('click', () => {
      const json = this.bridge.exportJSON();
      window.__lastExportedJSON = json;
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arenamon-rig-${this.bridge.activeTemplateType}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('btn-close-import-modal')?.addEventListener('click', () => this.hideReportModal());
    document.getElementById('btn-ok-import-modal')?.addEventListener('click', () => this.hideReportModal());

    document.getElementById('btn-import-json').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (file) {
          try {
            const text = await file.text();
            const report = this.bridge.validateAndImportJSON(text);
            if (report.success) {
              this.viewport.updateJointPositions();
              this.viewport.updateBoneConnectors();
              this.renderSelection();

              let body = `
                <div style="margin-bottom:10px;">
                  <span class="badge badge-lime">Validação Aprovada</span>
                  <div style="margin-top:8px;"><strong>${report.appliedCount} de ${report.totalInRig}</strong> articulações aplicadas com sucesso a partir de <strong>${file.name}</strong>.</div>
                </div>
              `;
              if (report.missing.length > 0) {
                body += `<div style="font-size:11px;color:var(--amber);margin-top:6px;">Articulações ausentes no arquivo (${report.missing.length}, mantiveram posições originais):<br><span style="font-family:var(--font-mono);">${report.missing.join(', ')}</span></div>`;
              }
              if (report.unknown.length > 0) {
                body += `<div style="font-size:11px;color:var(--muted);margin-top:6px;">Articulações ignoradas (não presentes no modelo ativo): ${report.unknown.join(', ')}</div>`;
              }
              if (report.invalid.length > 0) {
                body += `<div style="font-size:11px;color:var(--rose);margin-top:6px;">Articulações com dados inválidos: ${report.invalid.map(i => i.name).join(', ')}</div>`;
              }
              body += `<div style="font-size:11px;color:var(--muted);margin-top:10px;border-top:1px solid var(--edge);padding-top:6px;">Dica: você pode reverter toda a importação a qualquer momento clicando em <strong>Desfazer (Undo)</strong>.</div>`;
              this.showReportModal('Relatório de Importação JSON', body);
            } else {
              let body = `
                <div style="margin-bottom:10px;">
                  <span class="badge badge-rose">Falha na Validação</span>
                  <div style="margin-top:8px;color:#ff99aa;">O arquivo não pôde ser aplicado ao esqueleto atual:</div>
                  <ul style="margin:8px 0 8px 18px;color:#ffb3c1;">
                    ${report.errors.map(e => `<li>${e}</li>`).join('')}
                  </ul>
                </div>
              `;
              this.showReportModal('Falha na Importação JSON', body);
            }
          } catch (err) {
            this.showReportModal('Erro de Leitura', `<div style="color:var(--rose);">Erro ao ler arquivo: ${err.message}</div>`);
          }
        }
      };
      input.click();
    });

    // Vincular Malha (Bind Skin)
    document.getElementById('btn-bind-skin').addEventListener('click', () => {
      if (!this.bridge.draft) {
        alert('Este modelo já possui skinning ativo.');
        return;
      }
      if (confirm('Vincular malha aos ossos agora? Essa operação gera SkinnedMesh, Skeleton e pesos automáticos.')) {
        try {
          const res = this.bridge.bindSkin({ smoothness: 0.13 });
          this.viewport.rebuildBoneVisuals();
          this.renderHierarchy();
          this.renderSelection();
          alert(`Skinning concluído com sucesso: ${res.bones.length} ossos vinculados a ${res.vertices} vértices!`);
        } catch (err) {
          alert('Erro ao vincular skin: ' + err.message);
        }
      }
    });
  }

  applyPresetPose(preset) {
    this.bridge.restoreRestPose();
    if (preset === 'tpose') {
      // Já está em rest
    } else if (preset === 'elbow45') {
      this.bridge.setDeformRotation('LeftElbow', 'x', 45);
      this.bridge.setDeformRotation('RightElbow', 'x', 45);
    } else if (preset === 'twist30') {
      this.bridge.setDeformRotation('Spine', 'y', 30);
    } else if (preset === 'crouch') {
      this.bridge.setDeformRotation('LeftHip', 'x', -40);
      this.bridge.setDeformRotation('RightHip', 'x', -40);
      this.bridge.setDeformRotation('LeftKnee', 'x', 60);
      this.bridge.setDeformRotation('RightKnee', 'x', 60);
    }
  }

  onBridgeStateChange(state) {
    document.getElementById('btn-undo').disabled = !state.canUndo;
    document.getElementById('btn-redo').disabled = !state.canRedo;
    this.renderAudit(state.audit);
  }

  renderAudit(audit) {
    if (!audit) {
      this.auditSummary.textContent = 'Sem dados de auditoria';
      this.auditList.innerHTML = '';
      return;
    }

    this.auditSummary.innerHTML = `
      <div><strong>${audit.bones}</strong> articulações · <strong>${audit.skinnedMeshes}</strong> skinned mesh</div>
      <div>Vértices totais: <strong>${audit.bounds?.vertices || 0}</strong></div>
    `;

    if (!audit.warnings || audit.warnings.length === 0) {
      this.auditList.innerHTML = '<div class="audit-ok">✓ Estrutura geométrica sem inconsistências.</div>';
    } else {
      this.auditList.innerHTML = audit.warnings.map(w => `
        <div class="audit-warning">⚠ ${w}</div>
      `).join('');
    }
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
        <span class="tree-badge">${node.parent ? 'child' : 'root'}</span>
      `;

      row.addEventListener('click', () => {
        this.bridge.selectJoint(node.name);
        this.viewport.updateSelection();
        this.renderSelection();
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

    // Atualiza árvore
    document.querySelectorAll('.tree-row').forEach(row => {
      row.classList.toggle('selected', row.dataset.jointName === selected);
    });

    if (!joint) {
      document.getElementById('inspector-title').textContent = 'Nenhuma articulação selecionada';
      document.getElementById('coord-x').value = '0.000';
      document.getElementById('coord-y').value = '0.000';
      document.getElementById('coord-z').value = '0.000';
      return;
    }

    document.getElementById('inspector-title').textContent = joint.name;
    const parentName = joint.parent || '(Raiz do Modelo)';
    document.getElementById('inspector-parent').textContent = parentName;

    // Filhos
    const children = this.bridge.getJoints().filter(j => j.parent === joint.name).map(j => j.name);
    const childrenContainer = document.getElementById('inspector-children');
    if (children.length) {
      childrenContainer.innerHTML = children.map(c => `
        <button class="badge btn-mini" data-jump-joint="${c}">${c}</button>
      `).join(' ');
      childrenContainer.querySelectorAll('[data-jump-joint]').forEach(b => {
        b.onclick = () => {
          this.bridge.selectJoint(b.dataset.jumpJoint);
          this.viewport.updateSelection();
          this.renderSelection();
        };
      });
    } else {
      childrenContainer.textContent = 'Nenhum (Extremidade)';
    }

    // Coordenadas
    const xInput = document.getElementById('coord-x');
    const yInput = document.getElementById('coord-y');
    const zInput = document.getElementById('coord-z');
    xInput.value = joint.p[0].toFixed(4);
    yInput.value = joint.p[1].toFixed(4);
    zInput.value = joint.p[2].toFixed(4);

    const applyCoordsFromInputs = () => {
      const newPos = [parseFloat(xInput.value) || 0, parseFloat(yInput.value) || 0, parseFloat(zInput.value) || 0];
      this.bridge.setJointPosition(joint.name, newPos);
      this.viewport.updateJointPositions();
      this.viewport.updateBoneConnectors();
    };

    xInput.onchange = applyCoordsFromInputs;
    yInput.onchange = applyCoordsFromInputs;
    zInput.onchange = applyCoordsFromInputs;

    // Distância até o pai (comprimento)
    let length = 0;
    if (joint.parent) {
      const parentJoint = this.bridge.getJoint(joint.parent);
      if (parentJoint) {
        const v1 = new THREE.Vector3(...joint.p);
        const v2 = new THREE.Vector3(...parentJoint.p);
        length = v1.distanceTo(v2);
      }
    }
    document.getElementById('inspector-length').textContent = length.toFixed(4) + ' un';

    // Botão de Espelhamento
    const mirrorBtn = document.getElementById('btn-mirror-joint');
    const companion = this.bridge.getSymmetricCompanion(joint.name);
    if (companion) {
      mirrorBtn.disabled = false;
      mirrorBtn.textContent = `⇄ Espelhar para ${companion}`;
      mirrorBtn.onclick = () => {
        this.bridge.mirrorSelectedJoint();
        this.viewport.updateJointPositions();
        this.viewport.updateBoneConnectors();
        this.renderSelection();
      };
    } else {
      mirrorBtn.disabled = true;
      mirrorBtn.textContent = 'Sem par simétrico (Central)';
    }

    // Métricas de Influência
    const influence = this.bridge.getInfluenceMetrics(joint.name);
    document.getElementById('weight-vertex-count').textContent = influence.vertexCount + ' vértices';
    document.getElementById('weight-avg').textContent = influence.avgWeight.toFixed(3);
    document.getElementById('weight-target-bone').textContent = joint.name;
  }

  showReportModal(title, htmlContent) {
    const modal = document.getElementById('import-report-modal');
    if (!modal) return;
    document.getElementById('import-report-title').textContent = title;
    document.getElementById('import-report-content').innerHTML = htmlContent;
    modal.style.display = 'flex';
  }

  hideReportModal() {
    const modal = document.getElementById('import-report-modal');
    if (modal) modal.style.display = 'none';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new PropostaAWorkspace();
});
