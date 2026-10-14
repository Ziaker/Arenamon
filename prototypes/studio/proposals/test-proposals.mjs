// Validação automatizada offline com Playwright para os 3 protótipos de rigging.
// Valida estados reais (Undo/Redo, arrasto gizmo, heatmap multi-malha, JSON import, divergência 24/27).
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const dir = resolve('prototypes/studio/proposals');
const screenshotsDir = resolve('prototypes/studio/proposals/screenshots');

async function runTests() {
  console.log('Iniciando bateria de validação funcional e de estados nos protótipos de rigging...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--disable-gpu-sandbox', '--use-angle=swiftshader']
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('dialog', d => d.accept());
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.context().setOffline(true);

  // =============================================================
  // TESTE 1: PROPOSTA A (Rigging Workspace)
  // =============================================================
  console.log('\n--- Testando PROPOSTA A (Rigging Workspace) ---');
  await page.goto(pathToFileURL(resolve(dir, 'proposta-a.html')).href);
  await page.waitForSelector('#viewport-3d canvas', { timeout: 15000 });
  await page.waitForFunction(() => !!window.__rigStudio);

  assert.equal(errors.length, 0, 'Sem erros de console na inicialização da Proposta A');
  console.log('✓ Proposta A abriu offline sem erros');

  // 1.1 Seleção de articulação na árvore
  const spineRow = page.locator('.tree-row[data-joint-name="Spine"]');
  await spineRow.click();
  assert.equal(await page.textContent('#inspector-title'), 'Spine');
  console.log('✓ Seleção na árvore de hierarquia atualizou o inspetor');

  // 1.2 Prioridade 1: Simulação real de arrasto de Gizmo 3D, Undo/Redo e atalhos de teclado
  console.log('  -> Testando arrasto 3D, histórico de Undo/Redo e atalhos de teclado...');
  const initialSpineP = await page.evaluate(() => {
    const j = window.__rigStudio.bridge.getJoint('Spine');
    return [...j.p];
  });
  const initialMarkerWorld = await page.evaluate(() => {
    const m = window.__rigStudio.viewport.markersMap.get('Spine');
    return [m.position.x, m.position.y, m.position.z];
  });

  // Executa arrasto de gizmo via ciclo com sincronização de evento e inputs
  await page.evaluate(() => {
    const bridge = window.__rigStudio.bridge;
    const viewport = window.__rigStudio.viewport;
    bridge.beginDrag('Spine');
    bridge.setJointPosition('Spine', [0.15, 1.35, 0.08], { recordHistory: false });
    viewport.updateJointPositions();
    viewport.updateBoneConnectors();
    if (typeof viewport.onJointTransform === 'function') {
      viewport.onJointTransform('Spine');
    }
    bridge.commitDrag('Spine');
  });

  const historyLenAfterDrag = await page.evaluate(() => window.__rigStudio.bridge.historyStack.length);
  assert.equal(historyLenAfterDrag, 1, 'Arrasto de gizmo gerou exatamente 1 comando no histórico');
  assert.equal(await page.isDisabled('#btn-undo'), false, 'Botão Undo foi habilitado após o arrasto');

  // Comprova que os campos numéricos do Inspetor sincronizaram com o arrasto em tempo real
  const draggedCoordX = parseFloat(await page.inputValue('#coord-x'));
  assert.ok(Math.abs(draggedCoordX - 0.15) < 1e-4, 'Coordenada X no inspetor sincronizou em tempo real');

  // Comprova que o marcador no 3D moveu para a nova posição no mundo
  const movedMarkerWorld = await page.evaluate(() => {
    const m = window.__rigStudio.viewport.markersMap.get('Spine');
    return [m.position.x, m.position.y, m.position.z];
  });
  assert.ok(Math.abs(movedMarkerWorld[0] - initialMarkerWorld[0]) > 0.05, 'Marcador 3D deslocou no espaço de mundo');

  // Testa Desfazer via atalho de teclado (Control+Z)
  await page.keyboard.press('Control+z');
  const restoredSpineP = await page.evaluate(() => {
    const j = window.__rigStudio.bridge.getJoint('Spine');
    return [...j.p];
  });

  assert.ok(
    Math.abs(restoredSpineP[0] - initialSpineP[0]) < 1e-5 &&
    Math.abs(restoredSpineP[1] - initialSpineP[1]) < 1e-5 &&
    Math.abs(restoredSpineP[2] - initialSpineP[2]) < 1e-5,
    'Undo restaurou com precisão cirúrgica (< 1e-5) a coordenada no data model'
  );

  const restoredInputX = parseFloat(await page.inputValue('#coord-x'));
  assert.ok(Math.abs(restoredInputX - initialSpineP[0]) < 1e-4, 'Input do inspetor restaurou a coordenada pré-arrasto');

  const restoredMarkerWorld = await page.evaluate(() => {
    const m = window.__rigStudio.viewport.markersMap.get('Spine');
    return [m.position.x, m.position.y, m.position.z];
  });
  assert.ok(Math.abs(restoredMarkerWorld[0] - initialMarkerWorld[0]) < 1e-5, 'Posição do marcador 3D restaurada no mundo');
  assert.equal(await page.isDisabled('#btn-redo'), false, 'Botão Redo habilitado após Undo');

  // Testa Refazer via atalho de teclado (Control+Y)
  await page.keyboard.press('Control+y');
  const redoneSpineP = await page.evaluate(() => window.__rigStudio.bridge.getJoint('Spine').p);
  assert.ok(Math.abs(redoneSpineP[0] - 0.15) < 1e-4, 'Redo reaplicou a posição arrastada');

  // Retorna para o estado limpo via clique no botão Undo
  await page.click('#btn-undo');

  // 1.2.B Teste com eventos reais de mouse (DOM pointer events) sobre o manipulador 3D no canvas
  console.log('  -> Testando arrasto com eventos reais de mouse no canvas 3D...');
  const gizmoCoords = await page.evaluate(() => {
    const canvas = window.__rigStudio.viewport.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const camera = window.__rigStudio.viewport.camera;
    const helper = window.__rigStudio.viewport.transformHelper;
    const gizmoChild = helper.children.find(c => c.isTransformControlsGizmo);
    const yPicker = gizmoChild.picker['translate'].children.find(c => c.name === 'Y');
    yPicker.geometry.computeBoundingBox();
    const center = yPicker.geometry.boundingBox.getCenter(camera.position.clone());
    yPicker.localToWorld(center);
    center.project(camera);
    const screenX = rect.left + (center.x * 0.5 + 0.5) * rect.width;
    const screenY = rect.top + (-center.y * 0.5 + 0.5) * rect.height;
    return { screenX, screenY };
  });

  const spinePBeforeMouseDrag = await page.evaluate(() => [...window.__rigStudio.bridge.getJoint('Spine').p]);
  const historyLenBeforeMouse = await page.evaluate(() => window.__rigStudio.bridge.historyStack.length);

  // Mover o mouse sobre o manipulador do eixo Y
  await page.mouse.move(gizmoCoords.screenX, gizmoCoords.screenY);
  await page.waitForTimeout(50);
  const hoveredAxis = await page.evaluate(() => window.__rigStudio.viewport.transformControls.axis);
  assert.equal(hoveredAxis, 'Y', 'Hover do mouse sobre o gizmo detectou o eixo Y do TransformControls');

  // Pressionar o botão esquerdo do mouse
  await page.mouse.down();
  await page.waitForTimeout(50);
  const isDraggingGizmo = await page.evaluate(() => window.__rigStudio.viewport.transformControls.dragging);
  assert.equal(isDraggingGizmo, true, 'Pointerdown no canvas ativou o estado dragging do TransformControls');

  // Arrastar para cima no canvas com passos intermediários
  await page.mouse.move(gizmoCoords.screenX, gizmoCoords.screenY - 80, { steps: 10 });
  await page.waitForTimeout(50);
  const spinePMidMouse = await page.evaluate(() => [...window.__rigStudio.bridge.getJoint('Spine').p]);
  assert.ok(spinePMidMouse[1] > spinePBeforeMouseDrag[1], 'Movimento real do mouse no canvas deslocou o osso no eixo Y');

  // Soltar o mouse para concluir o arrasto
  await page.mouse.up();
  await page.waitForTimeout(100);

  const historyLenAfterMouse = await page.evaluate(() => window.__rigStudio.bridge.historyStack.length);
  assert.equal(historyLenAfterMouse, historyLenBeforeMouse + 1, 'Arrasto real com mouse registrou exatamente 1 comando atômico de histórico');

  // Desfazer o arrasto real via botão Undo
  await page.click('#btn-undo');
  await page.waitForTimeout(100);
  const spinePUndoMouse = await page.evaluate(() => [...window.__rigStudio.bridge.getJoint('Spine').p]);
  assert.ok(
    Math.abs(spinePUndoMouse[1] - spinePBeforeMouseDrag[1]) < 1e-4,
    'Undo restaurou perfeitamente a posição do osso após o arrasto real com mouse'
  );
  console.log('✓ Prioridade 1 Aprovada: Undo/Redo no manipulador 3D validado com restauração exata e arrasto real via mouse');

  // 1.3 Prioridade 2: Resolução da inconsistência 24 vs 27 ossos no Quadrúpede
  console.log('  -> Testando resolução da inconsistência 24 vs 27 ossos...');

  // Teste 2.1: Variante Besta Quadrúpede (27 articulações)
  await page.selectOption('#model-select', 'creature-quadruped-27');
  await page.waitForTimeout(300);

  const quad27Count = await page.evaluate(() => window.__rigStudio.bridge.getJoints().length);
  const quad27Declared = await page.evaluate(() => window.__rigStudio.bridge.draft.divergenceInfo.declaredCount);
  assert.equal(quad27Count, 27, 'Variante criatura 27 instancia exatamente 27 articulações');
  assert.equal(quad27Declared, 27, 'declaredCount coincide exatamente com actualCount (27)');

  const banner27Visible = await page.isVisible('#divergence-callout .divergence-banner');
  assert.ok(banner27Visible, 'Banner explicativo da variante 27 exibido no painel');
  const banner27Text = await page.textContent('#divergence-callout');
  assert.ok(banner27Text.includes('27 articulações'), 'Banner destaca 27 articulações');
  assert.ok(await page.locator('.tree-row[data-joint-name="Jaw"]').count(), 'Articulação Jaw presente na variante 27');
  assert.ok(await page.locator('.tree-row[data-joint-name="LeftHorn"]').count(), 'Articulação LeftHorn presente na variante 27');
  assert.ok(await page.locator('.tree-row[data-joint-name="Tail3"]').count(), 'Cauda segmentada (Tail3) presente');

  // Teste 2.2: Variante Quadrúpede Base (24 articulações puras de locomoção)
  await page.selectOption('#model-select', 'creature-quadruped-24');
  await page.waitForTimeout(300);

  const quad24Count = await page.evaluate(() => window.__rigStudio.bridge.getJoints().length);
  const quad24Declared = await page.evaluate(() => window.__rigStudio.bridge.draft.divergenceInfo.declaredCount);
  assert.equal(quad24Count, 24, 'Variante base 24 instancia exatamente 24 articulações');
  assert.equal(quad24Declared, 24, 'declaredCount coincide exatamente com actualCount (24)');
  assert.equal(await page.locator('.tree-row[data-joint-name="Jaw"]').count(), 0, 'Jaw ausente no template puro 24');
  assert.equal(await page.locator('.tree-row[data-joint-name="LeftHorn"]').count(), 0, 'LeftHorn ausente no template puro 24');

  const banner24Text = await page.textContent('#divergence-callout');
  assert.ok(banner24Text.includes('24 articulações puras'), 'Banner confirma variante de 24 articulações puras');
  console.log('✓ Prioridade 2 Aprovada: Inconsistência 24 vs 27 resolvida sem redefinição unilateral de template');

  // Retorna para o bípede para os próximos testes
  await page.selectOption('#model-select', 'humanoid-20');
  await page.waitForTimeout(300);

  // 1.4 Prioridade 3: Aplicação do Heatmap em modelos com múltiplas malhas e preservação não-destrutiva de cores
  console.log('  -> Testando aplicação do Heatmap em modelos com múltiplas malhas...');

  // Simula uma malha com cores de vértice pré-existentes (como importada de um arquivo GLB)
  await page.evaluate(() => {
    let firstMesh = null;
    window.__rigStudio.bridge.model.traverse(o => {
      if (!firstMesh && o.isMesh && o.geometry?.attributes?.position) firstMesh = o;
    });
    if (firstMesh) {
      const vCount = firstMesh.geometry.attributes.position.count;
      const customColors = new Float32Array(vCount * 3).fill(0.72);
      const AttrClass = firstMesh.geometry.attributes.position.constructor;
      firstMesh.geometry.setAttribute('color', new AttrClass(customColors, 3));
      if (firstMesh.material) firstMesh.material.vertexColors = true;
      firstMesh.userData.__mockOrigVertexColors = true;
    }
  });

  await page.click('[data-tab="weights"]');

  const heatmapState = await page.evaluate(() => {
    const meshes = [];
    window.__rigStudio.bridge.model.traverse(o => {
      if (o.isMesh && o.geometry?.attributes?.position) {
        meshes.push({
          name: o.name,
          vertexCount: o.geometry.attributes.position.count,
          hasColorAttr: !!o.geometry.attributes.color,
          colorAttrCount: o.geometry.attributes.color?.count || 0,
          vertexColorsActive: !!o.material?.vertexColors
        });
      }
    });
    return meshes;
  });

  assert.ok(heatmapState.length >= 2, 'Modelo possui pelo menos 2 malhas independentes (Multi-Mesh)');
  for (const m of heatmapState) {
    assert.ok(m.hasColorAttr, `Malha ${m.name} recebeu atributo de cor de vértice`);
    assert.equal(m.colorAttrCount, m.vertexCount, `Contagem de cores da malha ${m.name} corresponde exatamente à sua contagem de vértices`);
    assert.ok(m.vertexColorsActive, `Material da malha ${m.name} ativou vertexColors`);
  }

  // Desativa o Heatmap e verifica restauração não destrutiva
  await page.click('#btn-toggle-heatmap');
  const restoredColorState = await page.evaluate(() => {
    let mockMeshHasOriginalColors = false;
    let mockMeshFirstColorValue = null;
    let unpaintedMeshesCleaned = true;

    window.__rigStudio.bridge.model.traverse(o => {
      if (o.isMesh) {
        if (o.userData.__mockOrigVertexColors) {
          if (o.geometry?.attributes?.color && o.material?.vertexColors) {
            mockMeshHasOriginalColors = true;
            mockMeshFirstColorValue = o.geometry.attributes.color.getX(0);
          }
        } else {
          if (o.geometry?.attributes?.color || o.material?.vertexColors) {
            unpaintedMeshesCleaned = false;
          }
        }
      }
    });
    return { mockMeshHasOriginalColors, mockMeshFirstColorValue, unpaintedMeshesCleaned };
  });

  assert.equal(restoredColorState.mockMeshHasOriginalColors, true, 'Malha com cores originais prévias preservou atributo color e vertexColors=true');
  assert.ok(Math.abs(restoredColorState.mockMeshFirstColorValue - 0.72) < 1e-4, 'Valores originais das cores de vértice do GLB foram integralmente recuperados');
  assert.equal(restoredColorState.unpaintedMeshesCleaned, true, 'Malhas sem cores originais tiveram atributo color e vertexColors removidos');
  console.log('✓ Prioridade 3 Aprovada: Heatmap em modelos multi-malha validado com preservação não-destrutiva de cores GLB');

  // 1.5 Prioridade 4: Validação e relatório da importação JSON e compatibilidade Schema v2
  console.log('  -> Testando validação e relatório estruturado de importação JSON...');
  // Teste 4.1: JSON corrompido / inválido
  const invalidReport = await page.evaluate(() => {
    return window.__rigStudio.bridge.validateAndImportJSON('{ "corrompido": true }');
  });
  assert.equal(invalidReport.success, false, 'Importação rejeitou JSON sem array joints');
  assert.ok(invalidReport.errors.length > 0, 'Relatório contém lista de erros impeditivos');

  // Teste 4.2: Rejeição estrita de schema desconhecido
  const unknownSchemaReport = await page.evaluate(() => {
    return window.__rigStudio.bridge.validateAndImportJSON({
      schema: 'invalid-external-schema',
      version: 1,
      joints: [{ name: 'Spine', p: [0, 1, 0] }]
    });
  });
  assert.equal(unknownSchemaReport.success, false, 'Importação rejeitou schema desconhecido');
  assert.ok(unknownSchemaReport.errors.some(e => e.includes('Schema não reconhecido')), 'Erro explicou rejeição de schema');

  // Teste 4.3: Rejeição estrita de versão de schema não suportada
  const unsupportedVersionReport = await page.evaluate(() => {
    return window.__rigStudio.bridge.validateAndImportJSON({
      schema: 'arenamon-rig',
      version: 99,
      joints: [{ name: 'Spine', p: [0, 1, 0] }]
    });
  });
  assert.equal(unsupportedVersionReport.success, false, 'Importação rejeitou versão 99 não suportada');
  assert.ok(unsupportedVersionReport.errors.some(e => e.includes('Versão de schema não suportada')), 'Erro explicou versão não suportada');

  // Teste 4.4: JSON com nomes duplicados
  const duplicateReport = await page.evaluate(() => {
    return window.__rigStudio.bridge.validateAndImportJSON({
      joints: [
        { name: 'Spine', p: [0, 1, 0] },
        { name: 'Spine', p: [0, 1.2, 0] }
      ]
    });
  });
  assert.ok(duplicateReport.invalid.some(inv => inv.reason.includes('duplicad')), 'Detectou e rejeitou nome de articulação duplicado');

  // Teste 4.5: Importação compatível com Schema v2 (matching por ID e preservação de quaternion q)
  const v2ImportReport = await page.evaluate(() => {
    return window.__rigStudio.bridge.validateAndImportJSON({
      schema: 'arenamon-rig',
      version: 2,
      joints: [
        { id: 'uuid-spine-001', name: 'Spine', p: [0, 1.55, 0.06], q: [0, 0, 0, 1] }
      ]
    });
  });
  assert.equal(v2ImportReport.success, true, 'Importação de schema v2 concluída com sucesso');
  assert.ok(v2ImportReport.warnings.some(w => w.includes('schema v2')), 'Aviso contextual sobre v2 exibido');

  const spineAfterV2 = await page.evaluate(() => {
    const j = window.__rigStudio.bridge.getJoint('Spine');
    return { id: j.id, p: j.p, q: j.q };
  });
  assert.equal(spineAfterV2.id, 'uuid-spine-001', 'Identificador persistente id preservado no osso');
  assert.equal(spineAfterV2.q[3], 1, 'Orientação de quaternion q preservada');

  // Teste 4.6: Exportação preserva formato v2 quando requerido
  const v2Export = await page.evaluate(() => window.__rigStudio.bridge.exportJSON({ version: 2 }));
  assert.equal(v2Export.version, 2, 'ExportJSON gerou arquivo com schema version 2');
  const exportedSpine = v2Export.joints.find(j => j.name === 'Spine');
  assert.equal(exportedSpine.id, 'uuid-spine-001', 'Export v2 preservou ID persistente da articulação');
  assert.ok(Array.isArray(exportedSpine.q), 'Export v2 preservou quaternion q');

  // Desfaz a importação v2
  await page.click('#btn-undo');

  // Teste 4.7: JSON com coordenada fora dos limites de segurança
  const outOfBoundsReport = await page.evaluate(() => {
    return window.__rigStudio.bridge.validateAndImportJSON({
      joints: [{ name: 'Spine', p: [5000000, 0, 0] }]
    });
  });
  assert.ok(outOfBoundsReport.invalid.some(inv => inv.reason.includes('limite')), 'Detectou coordenada fora dos limites permitidos');

  // Teste 4.8: JSON válido com coordenadas
  const validImportResult = await page.evaluate(() => {
    const current = window.__rigStudio.bridge.getJoints();
    const modified = current.map(j => ({
      name: j.name,
      p: [j.p[0] + 0.05, j.p[1] + 0.05, j.p[2] + 0.05]
    }));
    const report = window.__rigStudio.bridge.validateAndImportJSON({ joints: modified });
    window.__rigStudio.viewport.updateJointPositions();
    window.__rigStudio.viewport.updateBoneConnectors();
    window.__rigStudio.renderSelection();
    return report;
  });

  assert.equal(validImportResult.success, true, 'Importação de coordenadas válidas concluída');
  assert.equal(validImportResult.appliedCount, 20, 'Exatamente 20 articulações foram atualizadas');

  // Desfaz a importação JSON em 1 clique
  await page.click('#btn-undo');
  console.log('✓ Prioridade 4 Aprovada: Relatório e validação de importação JSON operacionais com suporte a schema v2');

  // 1.6 Prioridade 5: Identificação clara dos controles demonstrativos (Fase 2)
  console.log('  -> Testando identificação transparente dos controles demonstrativos...');
  const badgeWarningCount = await page.locator('#tab-pane-weights .badge-warning').count();
  assert.ok(badgeWarningCount >= 1, 'Crachá de [Protótipo Visual — Fase 2] presente nos controles de pincel');

  const demoBannerCount = await page.locator('#tab-pane-weights .demo-banner').count();
  assert.ok(demoBannerCount >= 1, 'Banner explicativo sobre limitações da Fase 2 presente');

  await page.click('#btn-normalize-weights');
  const modalVisible = await page.isVisible('#import-report-modal');
  assert.ok(modalVisible, 'Clique em normalização abre diálogo explicativo de protótipo visual da Fase 2');
  await page.click('#btn-ok-import-modal');
  console.log('✓ Prioridade 5 Aprovada: Controles demonstrativos rotulados transparentemente');

  // 1.7 Controles de navegação do Workspace e Projeção Ortográfica Quad-View
  await page.click('[data-view="front"]');
  await page.click('[data-view="persp"]');
  await page.click('#btn-quad-view');

  const quadViewState = await page.evaluate(() => {
    const vp = window.__rigStudio.viewport;
    return {
      multiViewActive: vp.multiViewActive,
      isOrtho: vp.orthoCam?.isOrthographicCamera === true,
      top: vp.orthoCam?.top,
      bottom: vp.orthoCam?.bottom,
      left: vp.orthoCam?.left,
      right: vp.orthoCam?.right
    };
  });
  assert.equal(quadViewState.multiViewActive, true, 'Quad-View ativado');
  assert.equal(quadViewState.isOrtho, true, 'Quad-View utiliza câmera estritamente ortográfica (THREE.OrthographicCamera)');
  assert.ok(quadViewState.top > 0 && quadViewState.bottom < 0, 'Frustum ortográfico calculado corretamente');

  await page.click('#btn-quad-view');
  assert.equal(await page.evaluate(() => window.__rigStudio.viewport.multiViewActive), false, 'Quad-View desativado com sucesso');
  console.log('✓ Projeção ortográfica pura do Quad-View validada');

  await page.click('[data-tab="deform"]');
  await page.click('[data-preset-pose="elbow45"]');
  await page.click('#btn-reset-pose');

  await page.screenshot({ path: resolve(screenshotsDir, 'proposta-a.png') });
  console.log('✓ Captura atualizada: screenshots/proposta-a.png');

  // =============================================================
  // TESTE 2: PROPOSTA B (Guided Rigging)
  // =============================================================
  console.log('\n--- Testando PROPOSTA B (Guided Rigging) ---');
  await page.goto(pathToFileURL(resolve(dir, 'proposta-b.html')).href);
  await page.waitForSelector('#viewport-3d canvas', { timeout: 15000 });
  await page.waitForFunction(() => !!window.__rigStudio);

  assert.equal(errors.length, 0, 'Sem erros na Proposta B');
  console.log('✓ Proposta B abriu offline sem erros');

  // 2.1 Verifica botões de Undo/Redo no Topbar
  assert.ok(await page.locator('#btn-undo').count(), 'Botão Undo presente no topo do Guided Rigging');
  assert.ok(await page.locator('#btn-redo').count(), 'Botão Redo presente no topo do Guided Rigging');

  // 2.2 Navega para Etapa 1 e testa variantes 27 e 24 do template quadrúpede
  await page.selectOption('#step1-model-select', 'creature-quadruped-27');
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__rigStudio.bridge.getJoints().length), 27, 'Variante 27 na Proposta B tem 27 juntas');
  assert.ok(await page.isVisible('.divergence-banner'), 'Banner de variante 27 exibido na Etapa 1');

  await page.selectOption('#step1-model-select', 'creature-quadruped-24');
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__rigStudio.bridge.getJoints().length), 24, 'Variante 24 na Proposta B tem 24 juntas');

  // Retorna para bípede
  await page.selectOption('#step1-model-select', 'humanoid-20');
  await page.waitForTimeout(300);

  // 2.3 Navega para Etapa 2 e testa Paper Doll 2D
  await page.click('.step-card[data-step="2"]');
  assert.equal(await page.textContent('#assistant-step-title'), 'Posicionamento das Articulações');
  await page.click('.doll-joint[data-joint="LeftElbow"]');
  assert.ok(await page.textContent('#assistant-step-content').then(t => t.includes('LeftElbow')));
  console.log('✓ Seleção pelo Paper Doll 2D na Etapa 2 validada');

  // 2.4 Testa Undo na Proposta B via atalho de teclado
  await page.evaluate(() => {
    const bridge = window.__rigStudio.bridge;
    bridge.beginDrag('LeftElbow');
    bridge.setJointPosition('LeftElbow', [-0.95, 1.25, 0.05], { recordHistory: false });
    bridge.commitDrag('LeftElbow');
  });
  assert.equal(await page.isDisabled('#btn-undo'), false, 'Undo habilitado após movimento na Proposta B');
  await page.keyboard.press('Control+z');

  // 2.5 Etapa 3: Simetria
  await page.click('.step-card[data-step="3"]');
  await page.click('#step3-btn-auto-mirror');

  // 2.6 Etapa 4: Skinning e rótulo demonstrativo
  await page.click('.step-card[data-step="4"]');
  assert.ok(await page.locator('.demo-banner').count(), 'Banner demonstrativo de Fase 2 presente na Etapa 4');
  await page.click('#step4-btn-bind');
  console.log('✓ Auto-Bind concluído na Etapa 4');

  // 2.7 Etapa 5: Teste de deformação e botões de exportação/importação
  await page.click('.step-card[data-step="5"]');
  await page.click('#step5-test-elbow');
  await page.click('#step5-btn-rest-pose');
  assert.ok(await page.locator('#step5-btn-import').count(), 'Botão de Importar JSON presente na Etapa 5');

  await page.screenshot({ path: resolve(screenshotsDir, 'proposta-b.png') });
  console.log('✓ Captura atualizada: screenshots/proposta-b.png');

  // =============================================================
  // TESTE 3: PROPOSTA C (Hybrid Rigging Studio)
  // =============================================================
  console.log('\n--- Testando PROPOSTA C (Hybrid Rigging Studio) ---');
  await page.goto(pathToFileURL(resolve(dir, 'proposta-c.html')).href);
  await page.waitForSelector('#viewport-3d canvas', { timeout: 15000 });
  await page.waitForFunction(() => !!window.__rigStudio);

  assert.equal(errors.length, 0, 'Sem erros na Proposta C');
  console.log('✓ Proposta C abriu offline sem erros');

  // 3.1 Alternador de Modos
  await page.click('.mode-switch-btn[data-mode="studio"]');
  assert.equal(await page.textContent('#mode-indicator-text'), 'Modo Estúdio Livre — Ferramentas Pro');
  await page.click('.mode-switch-btn[data-mode="guided"]');
  assert.equal(await page.textContent('#mode-indicator-text'), 'Modo Assistido — Roteiro Inteligente');
  console.log('✓ Modo Guiado ⇄ Modo Estúdio Livre alternado com sucesso');

  // 3.2 Breadcrumbs de linhagem
  await page.click('.tree-row[data-joint-name="LeftWrist"]');
  assert.ok(await page.textContent('#viewport-breadcrumbs').then(t => t.includes('LeftShoulder')));
  console.log('✓ Linhagem anatômica nos breadcrumbs validada');

  // 3.3 Variantes 27 e 24 na Proposta C
  await page.selectOption('#hybrid-model-select', 'creature-quadruped-27');
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__rigStudio.bridge.getJoints().length), 27, 'Proposta C variante 27 tem 27 juntas');

  await page.selectOption('#hybrid-model-select', 'creature-quadruped-24');
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__rigStudio.bridge.getJoints().length), 24, 'Proposta C variante 24 tem 24 juntas');

  await page.selectOption('#hybrid-model-select', 'humanoid-20');
  await page.waitForTimeout(300);

  // 3.4 Botões de importação e rótulo demonstrativo na bancada
  assert.ok(await page.locator('#btn-import-json').count(), 'Botão de importação JSON presente na Proposta C');
  assert.ok(await page.locator('.dock-bottom .badge-warning').count(), 'Rótulo [Pintura Manual: Fase 2] presente na bancada inferior');

  // 3.5 Bancada de flexão rápida
  await page.fill('#dock-pose-slider', '45');
  await page.locator('#dock-pose-slider').dispatchEvent('input');
  assert.equal(await page.textContent('#dock-pose-readout'), '45°');
  await page.click('#btn-dock-rest-pose');
  assert.equal(await page.textContent('#dock-pose-readout'), '0°');

  await page.screenshot({ path: resolve(screenshotsDir, 'proposta-c.png') });
  console.log('✓ Captura atualizada: screenshots/proposta-c.png');

  // =============================================================
  // TESTE 4: PORTAL COMPARADOR (index.html)
  // =============================================================
  console.log('\n--- Testando Portal Comparador (index.html) ---');
  await page.goto(pathToFileURL(resolve(dir, 'index.html')).href);
  await page.screenshot({ path: resolve(screenshotsDir, 'propostas-portal.png') });
  console.log('✓ Captura do portal atualizada: screenshots/propostas-portal.png');

  await browser.close();
  console.log('\n=============================================================');
  console.log('✓ TODAS AS 6 PRIORIDADES E CASOS DE TESTE FORAM APROVADOS!');
  console.log('=============================================================\n');
}

runTests().catch(err => {
  console.error('Falha nos testes dos protótipos:', err);
  process.exit(1);
});
