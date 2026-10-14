// PROPOSTA B — Guided Rigging
// Assistente visual passo a passo que conduz o usuário pela preparação,
// posicionamento, simetria, skinning e testes de deformação.
import * as THREE from 'three';
import { RiggingBridge, HUMANOID_TEMPLATE_20, CREATURE_QUADRUPED_24 } from '../shared/rig-bridge.js';
import { createProceduralBiped, createProceduralQuadruped, parseGLBFile } from '../shared/models.js';
import { ViewportManager } from '../shared/three-setup.js';

class PropostaBGuided {
  constructor() {
    this.currentStep = 1; // 1 a 5
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
    this.goToStep(1);
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
    this.updatePaperDoll();
    this.updateStepContent();
  }

  initDOM() {
    this.stepCards = document.querySelectorAll('.step-card');
    this.assistantContent = document.getElementById('assistant-step-content');
    this.btnPrevStep = document.getElementById('btn-prev-step');
    this.btnNextStep = document.getElementById('btn-next-step');
    this.stepBadge = document.getElementById('assistant-step-badge');
    this.stepTitle = document.getElementById('assistant-step-title');
    this.stepDesc = document.getElementById('assistant-step-desc');
  }

  bindEvents() {
    // Stepper superior
    this.stepCards.forEach(card => {
      card.addEventListener('click', () => {
        const step = parseInt(card.dataset.step, 10);
        this.goToStep(step);
      });
    });

    this.btnPrevStep.addEventListener('click', () => {
      if (this.currentStep > 1) this.goToStep(this.currentStep - 1);
    });

    this.btnNextStep.addEventListener('click', () => {
      if (this.currentStep < 5) this.goToStep(this.currentStep + 1);
    });

    // Seletor de Modelo no Passo 1
    document.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'step1-model-select') {
        const val = e.target.value;
        if (val === 'upload') {
          document.getElementById('step1-file-input').click();
        } else {
          this.loadCharacter(val);
        }
      }
    });

    document.addEventListener('change', async (e) => {
      if (e.target && e.target.id === 'step1-file-input') {
        const file = e.target.files?.[0];
        if (file) {
          try {
            const model = await parseGLBFile(file);
            this.viewport.loadModel(model);
            this.updatePaperDoll();
            this.updateStepContent();
          } catch (err) {
            alert('Erro ao carregar GLB: ' + err.message);
          }
        }
        e.target.value = '';
      }
    });

    // Vistas e Controles de Câmera
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.viewport.setCameraView(btn.dataset.view);
      });
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

    // Cliques no Paper Doll 2D
    document.querySelectorAll('.doll-joint').forEach(jointElem => {
      jointElem.addEventListener('click', () => {
        const jointName = jointElem.dataset.joint;
        if (jointName) {
          this.bridge.selectJoint(jointName);
          this.viewport.updateSelection();
          this.onJointSelected(jointName);
        }
      });
    });
  }

  goToStep(stepNumber) {
    this.currentStep = stepNumber;

    this.stepCards.forEach(card => {
      const s = parseInt(card.dataset.step, 10);
      card.classList.toggle('active', s === stepNumber);
      card.classList.toggle('completed', s < stepNumber);
    });

    this.btnPrevStep.disabled = stepNumber === 1;
    this.btnNextStep.textContent = stepNumber === 5 ? '✓ Concluir Rig' : 'Próxima Etapa →';

    // Ajusta o comportamento do viewport para cada etapa
    if (stepNumber === 1) {
      this.viewport.setCameraView('persp');
      this.viewport.setHeatmap(false);
    } else if (stepNumber === 2) {
      this.viewport.setCameraView('front');
      this.viewport.setHeatmap(false);
    } else if (stepNumber === 3) {
      this.viewport.setCameraView('front');
      this.viewport.setHeatmap(false);
    } else if (stepNumber === 4) {
      this.viewport.setHeatmap(true);
    } else if (stepNumber === 5) {
      this.viewport.setCameraView('persp');
      this.viewport.setHeatmap(false);
    }

    this.updateStepContent();
  }

  updateStepContent() {
    const s = this.currentStep;

    if (s === 1) {
      this.stepBadge.textContent = 'Etapa 1 de 5';
      this.stepTitle.textContent = 'Preparação & Template';
      this.stepDesc.textContent = 'Defina a anatomia da criatura e configure a malha base.';
      this.renderStep1();
    } else if (s === 2) {
      this.stepBadge.textContent = 'Etapa 2 de 5';
      this.stepTitle.textContent = 'Posicionamento das Articulações';
      this.stepDesc.textContent = 'Ajuste os pontos do esqueleto sobre a malha 3D.';
      this.renderStep2();
    } else if (s === 3) {
      this.stepBadge.textContent = 'Etapa 3 de 5';
      this.stepTitle.textContent = 'Alinhamento & Simetria';
      this.stepDesc.textContent = 'Valide os pares esquerda/direita e audite a estrutura.';
      this.renderStep3();
    } else if (s === 4) {
      this.stepBadge.textContent = 'Etapa 4 de 5';
      this.stepTitle.textContent = 'Skinning & Pesos';
      this.stepDesc.textContent = 'Vincule a malha aos ossos e inspecione o heatmap.';
      this.renderStep4();
    } else if (s === 5) {
      this.stepBadge.textContent = 'Etapa 5 de 5';
      this.stepTitle.textContent = 'Validação de Deformação';
      this.stepDesc.textContent = 'Dobre os membros e certifique-se da integridade visual.';
      this.renderStep5();
    }
  }

  renderStep1() {
    const bounds = this.bridge.getModelBounds();
    this.assistantContent.innerHTML = `
      <div class="guide-step-card">
        <h4 style="margin-bottom:8px;">Tipo de Criatura</h4>
        <select id="step1-model-select" style="width:100%;margin-bottom:10px;">
          <option value="humanoid-20" ${this.bridge.activeTemplateType === HUMANOID_TEMPLATE_20 ? 'selected' : ''}>Bípede Estilizado (Humanoide 20 ossos)</option>
          <option value="creature-quadruped-24" ${this.bridge.activeTemplateType === CREATURE_QUADRUPED_24 ? 'selected' : ''}>Quadrúpede Estilizado (Besta com Cauda 24 ossos)</option>
          <option value="upload">Carregar arquivo GLB do disco...</option>
        </select>
        <input type="file" id="step1-file-input" accept=".glb,.gltf" style="display:none">

        <div style="font-size:11px;color:var(--muted);display:flex;flex-direction:column;gap:4px;">
          <div>Altura calculada: <strong style="color:var(--text);">${bounds.size[1].toFixed(2)}m</strong></div>
          <div>Largura: <strong style="color:var(--text);">${bounds.size[0].toFixed(2)}m</strong></div>
          <div>Profundidade: <strong style="color:var(--text);">${bounds.size[2].toFixed(2)}m</strong></div>
        </div>
      </div>

      <div class="guide-tip">
        <span class="guide-tip-icon">💡</span>
        <div>
          <strong>Dica Arenamon:</strong> Para personagens com membros extras ou cauda, utilize o template quadrúpede ou carregue o GLB diretamente.
        </div>
      </div>

      <div class="guide-step-card">
        <h4 style="margin-bottom:8px;">Checklist de Entrada</h4>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <div class="checklist-item">
            <span>Malha 3D com geometria fechada</span>
            <span class="checklist-check">✓ OK</span>
          </div>
          <div class="checklist-item">
            <span>Origem centrada no chão</span>
            <span class="checklist-check">✓ OK</span>
          </div>
          <div class="checklist-item">
            <span>Template inicial carregado</span>
            <span class="checklist-check">✓ OK</span>
          </div>
        </div>
      </div>
    `;
  }

  renderStep2() {
    const selected = this.bridge.selectedJointName || 'Hips';
    const joint = this.bridge.getJoint(selected);

    this.assistantContent.innerHTML = `
      <div class="guide-step-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <strong style="font-size:14px;color:var(--cyan);">${selected}</strong>
          <span class="badge badge-cyan">${joint?.parent || 'Raiz'}</span>
        </div>
        <p style="font-size:11px;color:var(--muted);margin-bottom:10px;">
          Clique na articulação no modelo 3D ou no mapa anatômico abaixo para ajustar sua posição.
        </p>

        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;margin-bottom:10px;">
          <div>
            <span style="font-size:10px;color:var(--muted);">X (Lateral)</span>
            <input type="number" id="step2-coord-x" step="0.01" value="${joint ? joint.p[0].toFixed(3) : 0}">
          </div>
          <div>
            <span style="font-size:10px;color:var(--muted);">Y (Altura)</span>
            <input type="number" id="step2-coord-y" step="0.01" value="${joint ? joint.p[1].toFixed(3) : 0}">
          </div>
          <div>
            <span style="font-size:10px;color:var(--muted);">Z (Frente/Trás)</span>
            <input type="number" id="step2-coord-z" step="0.01" value="${joint ? joint.p[2].toFixed(3) : 0}">
          </div>
        </div>

        <div style="display:flex;gap:6px;">
          <button class="btn-soft btn-mini" id="step2-btn-prev" style="flex:1;">← Anterior</button>
          <button class="btn-soft btn-mini" id="step2-btn-next" style="flex:1;">Próximo →</button>
        </div>
      </div>

      <div class="paper-doll-container">
        <span style="font-size:10px;text-transform:uppercase;color:var(--muted);margin-bottom:6px;">Mapa Anatômico 2D</span>
        <svg class="paper-doll-svg" viewBox="0 0 200 240">
          <!-- Silhueta Guia -->
          <path d="M100,20 Q112,20 112,35 Q112,50 100,50 Q88,50 88,35 Q88,20 100,20 Z" fill="#1b2a40" stroke="#334b6b"/>
          <path d="M88,52 L112,52 L125,115 L75,115 Z" fill="#1b2a40" stroke="#334b6b"/>
          <!-- Braços -->
          <path d="M75,60 L45,100 L30,140" fill="none" stroke="#334b6b" stroke-width="6" stroke-linecap="round"/>
          <path d="M125,60 L155,100 L170,140" fill="none" stroke="#334b6b" stroke-width="6" stroke-linecap="round"/>
          <!-- Pernas -->
          <path d="M85,115 L75,170 L75,220" fill="none" stroke="#334b6b" stroke-width="8" stroke-linecap="round"/>
          <path d="M115,115 L125,170 L125,220" fill="none" stroke="#334b6b" stroke-width="8" stroke-linecap="round"/>

          <!-- Marcadores Clicáveis -->
          <circle class="doll-joint ${selected === 'Head' ? 'selected' : ''}" data-joint="Head" cx="100" cy="35" r="5" fill="#bff36a"/>
          <circle class="doll-joint ${selected === 'Neck' ? 'selected' : ''}" data-joint="Neck" cx="100" cy="52" r="4" fill="#bff36a"/>
          <circle class="doll-joint ${selected === 'Spine' ? 'selected' : ''}" data-joint="Spine" cx="100" cy="80" r="5" fill="#bff36a"/>
          <circle class="doll-joint ${selected === 'Hips' ? 'selected' : ''}" data-joint="Hips" cx="100" cy="115" r="6" fill="#bff36a"/>

          <circle class="doll-joint ${selected === 'LeftShoulder' ? 'selected' : ''}" data-joint="LeftShoulder" cx="60" cy="75" r="5" fill="#54d9ee"/>
          <circle class="doll-joint ${selected === 'LeftElbow' ? 'selected' : ''}" data-joint="LeftElbow" cx="45" cy="100" r="4" fill="#54d9ee"/>
          <circle class="doll-joint ${selected === 'LeftWrist' ? 'selected' : ''}" data-joint="LeftWrist" cx="30" cy="140" r="4" fill="#54d9ee"/>

          <circle class="doll-joint ${selected === 'RightShoulder' ? 'selected' : ''}" data-joint="RightShoulder" cx="140" cy="75" r="5" fill="#ff7796"/>
          <circle class="doll-joint ${selected === 'RightElbow' ? 'selected' : ''}" data-joint="RightElbow" cx="155" cy="100" r="4" fill="#ff7796"/>
          <circle class="doll-joint ${selected === 'RightWrist' ? 'selected' : ''}" data-joint="RightWrist" cx="170" cy="140" r="4" fill="#ff7796"/>

          <circle class="doll-joint ${selected === 'LeftHip' ? 'selected' : ''}" data-joint="LeftHip" cx="80" cy="125" r="5" fill="#54d9ee"/>
          <circle class="doll-joint ${selected === 'LeftKnee' ? 'selected' : ''}" data-joint="LeftKnee" cx="75" cy="170" r="4" fill="#54d9ee"/>
          <circle class="doll-joint ${selected === 'LeftAnkle' ? 'selected' : ''}" data-joint="LeftAnkle" cx="75" cy="220" r="4" fill="#54d9ee"/>

          <circle class="doll-joint ${selected === 'RightHip' ? 'selected' : ''}" data-joint="RightHip" cx="120" cy="125" r="5" fill="#ff7796"/>
          <circle class="doll-joint ${selected === 'RightKnee' ? 'selected' : ''}" data-joint="RightKnee" cx="125" cy="170" r="4" fill="#ff7796"/>
          <circle class="doll-joint ${selected === 'RightAnkle' ? 'selected' : ''}" data-joint="RightAnkle" cx="125" cy="220" r="4" fill="#ff7796"/>
        </svg>
      </div>
    `;

    // Reanexa eventos aos novos nós do step 2
    this.bindStep2Events();
  }

  bindStep2Events() {
    const selected = this.bridge.selectedJointName;
    const joints = this.bridge.getJoints();
    const currIdx = joints.findIndex(j => j.name === selected);

    document.getElementById('step2-btn-prev')?.addEventListener('click', () => {
      const prevIdx = (currIdx - 1 + joints.length) % joints.length;
      this.bridge.selectJoint(joints[prevIdx].name);
      this.viewport.updateSelection();
      this.onJointSelected(joints[prevIdx].name);
    });

    document.getElementById('step2-btn-next')?.addEventListener('click', () => {
      const nextIdx = (currIdx + 1) % joints.length;
      this.bridge.selectJoint(joints[nextIdx].name);
      this.viewport.updateSelection();
      this.onJointSelected(joints[nextIdx].name);
    });

    const xInput = document.getElementById('step2-coord-x');
    const yInput = document.getElementById('step2-coord-y');
    const zInput = document.getElementById('step2-coord-z');

    const onCoordChange = () => {
      if (!selected) return;
      const pos = [parseFloat(xInput.value) || 0, parseFloat(yInput.value) || 0, parseFloat(zInput.value) || 0];
      this.bridge.setJointPosition(selected, pos);
      this.viewport.updateJointPositions();
      this.viewport.updateBoneConnectors();
    };

    xInput?.addEventListener('change', onCoordChange);
    yInput?.addEventListener('change', onCoordChange);
    zInput?.addEventListener('change', onCoordChange);

    document.querySelectorAll('.doll-joint').forEach(jointElem => {
      jointElem.addEventListener('click', () => {
        const jointName = jointElem.dataset.joint;
        if (jointName) {
          this.bridge.selectJoint(jointName);
          this.viewport.updateSelection();
          this.onJointSelected(jointName);
        }
      });
    });
  }

  renderStep3() {
    this.assistantContent.innerHTML = `
      <div class="guide-step-card">
        <h4 style="margin-bottom:8px;">Espelhamento Automático</h4>
        <p style="font-size:11px;color:var(--muted);margin-bottom:12px;">
          Garante que os braços e pernas esquerdos tenham posições perfeitamente simétricas aos direitos em relação ao eixo sagital.
        </p>

        <button class="btn-primary" id="step3-btn-auto-mirror" style="width:100%;margin-bottom:8px;">
          ⇄ Espelhar Todos os Membros (Left → Right)
        </button>
        <button class="btn-soft" id="step3-btn-auto-mirror-rl" style="width:100%;">
          ⇄ Espelhar Todos os Membros (Right → Left)
        </button>
      </div>

      <div class="guide-step-card">
        <h4 style="margin-bottom:8px;">Auditoria de Simetria e Alinhamento</h4>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <div class="checklist-item">
            <span>Coluna e Cabeça no centro X = 0</span>
            <span class="checklist-check">✓ OK</span>
          </div>
          <div class="checklist-item">
            <span>Ombros equidistantes da espinha</span>
            <span class="checklist-check">✓ OK</span>
          </div>
          <div class="checklist-item">
            <span>Pés no mesmo nível do chão</span>
            <span class="checklist-check">✓ OK</span>
          </div>
        </div>
      </div>
    `;

    document.getElementById('step3-btn-auto-mirror')?.addEventListener('click', () => {
      const joints = this.bridge.getJoints().filter(j => j.name.startsWith('Left'));
      for (const j of joints) {
        this.bridge.selectJoint(j.name);
        this.bridge.mirrorSelectedJoint();
      }
      this.viewport.updateJointPositions();
      this.viewport.updateBoneConnectors();
      alert('Todos os membros esquerdos foram espelhados para o lado direito.');
    });

    document.getElementById('step3-btn-auto-mirror-rl')?.addEventListener('click', () => {
      const joints = this.bridge.getJoints().filter(j => j.name.startsWith('Right'));
      for (const j of joints) {
        this.bridge.selectJoint(j.name);
        this.bridge.mirrorSelectedJoint();
      }
      this.viewport.updateJointPositions();
      this.viewport.updateBoneConnectors();
      alert('Todos os membros direitos foram espelhados para o lado esquerdo.');
    });
  }

  renderStep4() {
    const isSkinned = this.bridge.isSkinned();
    this.assistantContent.innerHTML = `
      <div class="guide-step-card">
        <h4 style="margin-bottom:8px;">Vinculação da Malha (Skinning)</h4>
        <p style="font-size:11px;color:var(--muted);margin-bottom:12px;">
          Calcula a deformação da malha com base na proximidade dos ossos e gera os pesos de influência.
        </p>

        <label style="font-size:11px;display:flex;justify-content:space-between;margin-bottom:12px;">
          <span>Fator de Suavização</span>
          <input type="range" id="step4-smoothness" min="0.05" max="0.35" step="0.01" value="0.13" style="width:140px;">
          <span id="step4-smooth-val" style="color:var(--cyan);font-weight:750;">0.13</span>
        </label>

        <button class="btn-primary" id="step4-btn-bind" style="width:100%;" ${isSkinned ? 'disabled' : ''}>
          ${isSkinned ? '✓ Malha Já Vinculada' : '⚙ Executar Skinning (Auto-Bind)'}
        </button>
      </div>

      <div class="guide-step-card">
        <h4 style="margin-bottom:8px;">Mapa de Calor da Articulação</h4>
        <p style="font-size:11px;color:var(--muted);margin-bottom:10px;">
          Clique em qualquer osso para inspecionar os pesos térmicos na malha.
        </p>
        <div class="heatmap-legend" style="margin-bottom:10px;">
          <span>0%</span>
          <div class="heat-gradient-bar"></div>
          <span>100%</span>
        </div>
        <div style="font-size:12px;color:var(--lime);font-weight:750;">
          Osso Ativo: <span id="step4-active-bone">${this.bridge.selectedJointName || 'Hips'}</span>
        </div>
      </div>
    `;

    const smoothSlider = document.getElementById('step4-smoothness');
    smoothSlider?.addEventListener('input', (e) => {
      document.getElementById('step4-smooth-val').textContent = e.target.value;
    });

    document.getElementById('step4-btn-bind')?.addEventListener('click', () => {
      try {
        const smoothness = parseFloat(smoothSlider.value);
        const res = this.bridge.bindSkin({ smoothness });
        this.viewport.rebuildBoneVisuals();
        this.goToStep(4);
        alert(`Skinning concluído com sucesso: ${res.bones.length} ossos vinculados!`);
      } catch (err) {
        alert('Erro ao vincular: ' + err.message);
      }
    });
  }

  renderStep5() {
    this.assistantContent.innerHTML = `
      <div class="guide-step-card">
        <h4 style="margin-bottom:8px;">Testes de Flexão e Dobra</h4>
        <p style="font-size:11px;color:var(--muted);margin-bottom:12px;">
          Dobre membros isolados para verificar como a malha reage às torções antes de exportar.
        </p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;">
          <button class="btn-soft" id="step5-test-elbow">Flexão Cotovelos</button>
          <button class="btn-soft" id="step5-test-knee">Flexão Joelhos</button>
          <button class="btn-soft" id="step5-test-spine">Giro de Coluna</button>
          <button class="btn-soft" id="step5-test-crouch">Agachamento</button>
        </div>

        <button class="btn-soft" id="step5-btn-rest-pose" style="width:100%;">
          ↺ Restaurar Pose de Repouso
        </button>
      </div>

      <div class="guide-step-card">
        <h4 style="margin-bottom:8px;">Homologação & Exportação</h4>
        <p style="font-size:11px;color:var(--muted);margin-bottom:12px;">
          Salve o arquivo JSON de coordenadas para auditoria ou importação no Studio.
        </p>
        <button class="btn-success" id="step5-btn-export" style="width:100%;">
          ↓ Exportar Coordenadas JSON
        </button>
      </div>
    `;

    document.getElementById('step5-test-elbow')?.addEventListener('click', () => {
      this.bridge.restoreRestPose();
      this.bridge.setDeformRotation('LeftElbow', 'x', 50);
      this.bridge.setDeformRotation('RightElbow', 'x', 50);
    });

    document.getElementById('step5-test-knee')?.addEventListener('click', () => {
      this.bridge.restoreRestPose();
      this.bridge.setDeformRotation('LeftKnee', 'x', 60);
      this.bridge.setDeformRotation('RightKnee', 'x', 60);
    });

    document.getElementById('step5-test-spine')?.addEventListener('click', () => {
      this.bridge.restoreRestPose();
      this.bridge.setDeformRotation('Spine', 'y', 35);
    });

    document.getElementById('step5-test-crouch')?.addEventListener('click', () => {
      this.bridge.restoreRestPose();
      this.bridge.setDeformRotation('LeftHip', 'x', -40);
      this.bridge.setDeformRotation('RightHip', 'x', -40);
      this.bridge.setDeformRotation('LeftKnee', 'x', 60);
      this.bridge.setDeformRotation('RightKnee', 'x', 60);
    });

    document.getElementById('step5-btn-rest-pose')?.addEventListener('click', () => {
      this.bridge.restoreRestPose();
    });

    document.getElementById('step5-btn-export')?.addEventListener('click', () => {
      const json = this.bridge.exportJSON();
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arenamon-guided-rig-${this.bridge.activeTemplateType}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  updatePaperDoll() {
    const selected = this.bridge.selectedJointName;
    document.querySelectorAll('.doll-joint').forEach(jointElem => {
      jointElem.classList.toggle('selected', jointElem.dataset.joint === selected);
    });
  }

  onJointSelected(name) {
    this.updatePaperDoll();
    if (this.currentStep === 2) {
      this.renderStep2();
    } else if (this.currentStep === 4) {
      const boneElem = document.getElementById('step4-active-bone');
      if (boneElem) boneElem.textContent = name;
    }
  }

  onBridgeStateChange(state) {
    this.updatePaperDoll();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new PropostaBGuided();
});
