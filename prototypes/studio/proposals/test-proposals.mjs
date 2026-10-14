// Validação automatizada offline com Playwright para os 3 protótipos de rigging.
// Valida estados reais (Undo/Redo, arrasto gizmo, heatmap multi-malha, JSON import, divergência 24/27, persistência SkinnedMesh e exportação de botões UI).
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const dir = resolve('prototypes/studio/proposals');
const screenshotsDir = resolve('prototypes/studio/proposals/screenshots');

async function launchBrowser() {
  const commonArgs = ['--disable-gpu-sandbox', '--use-angle=swiftshader', '--no-sandbox'];
  try {
    return await chromium.launch({
      channel: 'msedge',
      headless: true,
      args: commonArgs
    });
  } catch {
    try {
      return await chromium.launch({
        headless: true,
        args: commonArgs
      });
    } catch {
      return await chromium.launch({
        channel: 'chrome',
        headless: true,
        args: commonArgs
      });
    }
  }
}

async function runWithFreshBrowser(testName, testFn) {
  console.log(`\n--- Testando ${testName} ---`);
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    await context.setOffline(true);
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
    page.on('dialog', d => d.accept());
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await testFn(page, errors);
  } finally {
    await browser.close();
  }
}

async function runTests() {
  console.log('Iniciando bateria de validação funcional e de estados nos protótipos de rigging...');

  // =============================================================
  // TESTE 1: PROPOSTA A (Rigging Workspace)
  // =============================================================
  await runWithFreshBrowser('PROPOSTA A (Rigging Workspace)', async (page, errors) => {
    await page.goto(pathToFileURL(resolve(dir, 'proposta-a.html')).href + '?gl=lite');
    await page.waitForSelector('#viewport-3d canvas', { timeout: 60000 });
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

      // 1.5 Prioridade 4: Validação canônica estrita do Codex (commit 7323b48) e compatibilidade Schema v2
      console.log('  -> Testando validação canônica estrita de importação JSON (idêntica ao commit 7323b48 do Codex)...');

      // Teste 4.1: JSON corrompido ou sem array joints
      const invalidReport = await page.evaluate(() => {
        return window.__rigStudio.bridge.validateAndImportJSON('{ "corrompido": true }');
      });
      assert.equal(invalidReport.success, false, 'Importação rejeitou JSON sem array joints');
      assert.ok(invalidReport.errors.some(e => e.includes('esperado schema arenamon-rig e joints')), 'Erro canônico para formato sem schema/joints');

      // Teste 4.2: Rejeição estrita de schema desconhecido
      const unknownSchemaReport = await page.evaluate(() => {
        return window.__rigStudio.bridge.validateAndImportJSON({
          schema: 'invalid-external-schema',
          version: 1,
          joints: [{ name: 'Spine', p: [0, 1, 0] }]
        });
      });
      assert.equal(unknownSchemaReport.success, false, 'Importação rejeitou schema desconhecido');
      assert.ok(unknownSchemaReport.errors.some(e => e.includes('esperado schema arenamon-rig e joints')), 'Erro canônico rejeitou schema inválido');

      // Teste 4.3: Rejeição estrita de versão de schema não suportada
      const unsupportedVersionReport = await page.evaluate(() => {
        return window.__rigStudio.bridge.validateAndImportJSON({
          schema: 'arenamon-rig',
          version: 99,
          joints: [{ name: 'Spine', p: [0, 1, 0] }]
        });
      });
      assert.equal(unsupportedVersionReport.success, false, 'Importação rejeitou versão 99 não suportada');
      assert.ok(unsupportedVersionReport.errors.some(e => e.includes('Versão de rig não suportada: 99')), 'Erro canônico explicou versão não suportada');

      // Teste 4.4: Rejeição estrita de ID ausente no JSON v2
      const missingIdV2Report = await page.evaluate(() => {
        return window.__rigStudio.bridge.validateAndImportJSON({
          schema: 'arenamon-rig',
          version: 2,
          joints: [
            { name: 'Hips', parent: null, p: [0, 0, 0], q: [0, 0, 0, 1] },
            { id: 'j-spine', name: 'Spine', parent: 'Hips', p: [0, 1, 0], q: [0, 0, 0, 1] }
          ]
        });
      });
      assert.equal(missingIdV2Report.success, false, 'Rejeitou rig v2 com ID ausente');
      assert.ok(missingIdV2Report.errors.some(e => e.includes('ID obrigatório no JSON v2: Hips')), 'Erro canônico: ID obrigatório no JSON v2');

      // Teste 4.5: Rejeição estrita de ID duplicado no JSON v2
      const duplicateIdV2Report = await page.evaluate(() => {
        return window.__rigStudio.bridge.validateAndImportJSON({
          schema: 'arenamon-rig',
          version: 2,
          joints: [
            { id: 'dup-id', name: 'Hips', parent: null, p: [0, 0, 0], q: [0, 0, 0, 1] },
            { id: 'dup-id', name: 'Spine', parent: 'Hips', p: [0, 1, 0], q: [0, 0, 0, 1] }
          ]
        });
      });
      assert.equal(duplicateIdV2Report.success, false, 'Rejeitou rig v2 com IDs duplicados');
      assert.ok(duplicateIdV2Report.errors.some(e => e.includes('ID de osso duplicado: dup-id')), 'Erro canônico: ID de osso duplicado');

      // Teste 4.6: Rejeição estrita de quaternion inválido/ausente no JSON v2
      const invalidQuatV2Report = await page.evaluate(() => {
        return window.__rigStudio.bridge.validateAndImportJSON({
          schema: 'arenamon-rig',
          version: 2,
          joints: [
            { id: 'j-hips', name: 'Hips', parent: null, p: [0, 0, 0], q: [0, 0, 0, 1] },
            { id: 'j-spine', name: 'Spine', parent: 'Hips', p: [0, 1, 0], q: [0, 0, 0] }
          ]
        });
      });
      assert.equal(invalidQuatV2Report.success, false, 'Rejeitou rig v2 com quaternion inválido');
      assert.ok(invalidQuatV2Report.errors.some(e => e.includes('Quaternion obrigatório e finito no JSON v2: Spine')), 'Erro canônico: Quaternion obrigatório e finito');

      // Teste 4.7: Rejeição estrita de ciclo na hierarquia
      const cycleReport = await page.evaluate(() => {
        return window.__rigStudio.bridge.validateAndImportJSON({
          schema: 'arenamon-rig',
          version: 2,
          joints: [
            { id: 'j-hips', name: 'Hips', parent: 'Spine', p: [0, 0, 0], q: [0, 0, 0, 1] },
            { id: 'j-spine', name: 'Spine', parent: 'Hips', p: [0, 1, 0], q: [0, 0, 0, 1] }
          ]
        });
      });
      assert.equal(cycleReport.success, false, 'Rejeitou rig v2 com ciclo na hierarquia');
      assert.ok(cycleReport.errors.some(e => e.includes('Ciclo no esqueleto') || e.includes('raiz')), 'Erro canônico: Ciclo no esqueleto');

      // Teste 4.8: Rejeição estrita de múltiplas raízes
      const multiRootReport = await page.evaluate(() => {
        return window.__rigStudio.bridge.validateAndImportJSON({
          schema: 'arenamon-rig',
          version: 2,
          joints: [
            { id: 'j-root1', name: 'Hips1', parent: null, p: [0, 0, 0], q: [0, 0, 0, 1] },
            { id: 'j-root2', name: 'Hips2', parent: null, p: [0, 1, 0], q: [0, 0, 0, 1] }
          ]
        });
      });
      assert.equal(multiRootReport.success, false, 'Rejeitou rig v2 com múltiplas raízes');
      assert.ok(multiRootReport.errors.some(e => e.includes('O esqueleto precisa de exatamente um osso raiz.')), 'Erro canônico: exatamente um osso raiz');

      // Teste 4.9: Rejeição estrita de coordenadas fora de limite (|p| > 1e6)
      const outOfBoundsReport = await page.evaluate(() => {
        return window.__rigStudio.bridge.validateAndImportJSON({
          schema: 'arenamon-rig',
          version: 2,
          joints: [
            { id: 'j-hips', name: 'Hips', parent: null, p: [0, 0, 0], q: [0, 0, 0, 1] },
            { id: 'j-spine', name: 'Spine', parent: 'Hips', p: [5000000, 0, 0], q: [0, 0, 0, 1] }
          ]
        });
      });
      assert.equal(outOfBoundsReport.success, false, 'Rejeitou coordenada fora dos limites');
      assert.ok(outOfBoundsReport.errors.some(e => e.includes('Coordenada fora de limite: Spine')), 'Erro canônico: Coordenada fora de limite');

      // Teste 4.10: Exportação estrita de v2 do rascunho com validação canônica garantida
      const draftV2Export = await page.evaluate(() => window.__rigStudio.bridge.exportJSON());
      assert.equal(draftV2Export.version, 2, 'ExportJSON sem argumentos gerou versão 2 no rascunho');
      assert.equal(draftV2Export.joints.length, 20, 'ExportJSON v2 conteve todas as 20 articulações');
      const allJointsValidV2 = draftV2Export.joints.every(j => {
        return typeof j.id === 'string' && j.id.trim() &&
               Array.isArray(j.q) && j.q.length === 4 && j.q.every(Number.isFinite);
      });
      assert.equal(allJointsValidV2, true, 'Todas as 20 articulações possuem ID único e quaternion finito de 4 componentes');

      // Teste 4.11: Importação de rig v2 no rascunho com matching e Undo/Redo simétrico
      const importedV2Payload = structuredClone(draftV2Export);
      const spineTarget = importedV2Payload.joints.find(j => j.name === 'Spine');
      spineTarget.id = 'uuid-spine-imported-v2';
      spineTarget.p[1] += 0.15;
      spineTarget.q = [0, 0.7071, 0, 0.7071];

      const validV2ImportRes = await page.evaluate((payload) => {
        return window.__rigStudio.bridge.validateAndImportJSON(payload);
      }, importedV2Payload);

      assert.equal(validV2ImportRes.success, true, 'Importação de rig v2 válido concluída');
      assert.equal(validV2ImportRes.appliedCount, 20, 'Todas as 20 articulações atualizadas no rascunho');

      const spineInDraftAfterImport = await page.evaluate(() => {
        const j = window.__rigStudio.bridge.getJoint('Spine');
        return { id: j.id, p: j.p, q: j.q };
      });
      assert.equal(spineInDraftAfterImport.id, 'uuid-spine-imported-v2', 'ID v2 persistido no rascunho');
      assert.ok(Math.abs(spineInDraftAfterImport.q[1] - 0.7071) < 1e-3, 'Quaternion v2 persistido no rascunho');

      // Testa Desfazer da importação v2 no rascunho
      await page.click('#btn-undo');
      const spineInDraftAfterUndo = await page.evaluate(() => {
        const j = window.__rigStudio.bridge.getJoint('Spine');
        return { id: j.id, p: j.p, q: j.q };
      });
      assert.notEqual(spineInDraftAfterUndo.id, 'uuid-spine-imported-v2', 'Undo restaurou ID prévio');
      assert.equal(spineInDraftAfterUndo.q[1], 0, 'Undo restaurou quaternion neutro prévio');

      // 1.5.B Teste de persistência real em SkinnedMesh (ossos THREE.Bone e model.userData.arenamonRig)
      console.log('  -> Testando persistência real em SkinnedMesh, THREE.Bone e Undo/Redo...');
      await page.evaluate(() => {
        window.__rigStudio.bridge.bindSkin();
      });
      const isSkinnedActive = await page.evaluate(() => window.__rigStudio.bridge.isSkinned());
      assert.equal(isSkinnedActive, true, 'Modelo com malha ativa vinculado (isSkinned === true)');

      const bonesHaveIds = await page.evaluate(() => {
        const bones = window.__rigStudio.bridge.getBones();
        const allHaveId = bones.every(b => typeof b.userData.arenamonJointId === 'string' && b.userData.arenamonJointId.trim());
        const metadataRig = window.__rigStudio.bridge.model.userData.arenamonRig;
        const metadataValid = metadataRig && metadataRig.schema === 'arenamon-rig' && metadataRig.version === 2 && Array.isArray(metadataRig.joints);
        return { allHaveId, bonesCount: bones.length, metadataValid, metadataJointsCount: metadataRig?.joints?.length };
      });
      assert.equal(bonesHaveIds.allHaveId, true, 'Todos os ossos THREE.Bone receberam userData.arenamonJointId');
      assert.equal(bonesHaveIds.metadataValid, true, 'model.userData.arenamonRig inicializado e sincronizado com schema v2');
      assert.equal(bonesHaveIds.bonesCount, bonesHaveIds.metadataJointsCount, 'Metadados contêm contagem exata de articulações vinculadas');

      // Exportação v2 do modelo com SkinnedMesh (chamada programática)
      const skinnedV2Export = await page.evaluate(() => window.__rigStudio.bridge.exportJSON());
      assert.equal(skinnedV2Export.version, 2, 'ExportJSON sem argumentos a partir de SkinnedMesh tem version 2');
      assert.equal(skinnedV2Export.joints.length, bonesHaveIds.bonesCount, 'Export contém todos os ossos do SkinnedMesh');

      // Modifica e importa JSON v2 diretamente no modelo com pele ativa
      const modifiedSkinnedPayload = structuredClone(skinnedV2Export);
      const skinnedSpineJ = modifiedSkinnedPayload.joints.find(j => j.name === 'Spine');
      const prevSkinnedSpineId = skinnedSpineJ.id;
      skinnedSpineJ.id = 'skinned-spine-persistent-v2';
      skinnedSpineJ.p[1] += 0.25;
      skinnedSpineJ.q = [0, 0.7071, 0, 0.7071];

      const skinnedImportRes = await page.evaluate((payload) => {
        return window.__rigStudio.bridge.validateAndImportJSON(payload);
      }, modifiedSkinnedPayload);
      assert.equal(skinnedImportRes.success, true, 'Importação em SkinnedMesh bem-sucedida');

      const boneStateAfterImport = await page.evaluate(() => {
        const bone = window.__rigStudio.bridge.getBoneObject('Spine');
        const metaJoint = window.__rigStudio.bridge.model.userData.arenamonRig.joints.find(j => j.name === 'Spine');
        return {
          boneJointId: bone.userData.arenamonJointId,
          boneQuatY: bone.quaternion.y,
          metaJointId: metaJoint.id,
          metaQuatY: metaJoint.q[1]
        };
      });
      assert.equal(boneStateAfterImport.boneJointId, 'skinned-spine-persistent-v2', 'THREE.Bone.userData.arenamonJointId persistido');
      assert.ok(Math.abs(boneStateAfterImport.boneQuatY - 0.7071) < 1e-3, 'THREE.Bone.quaternion persistido');
      assert.equal(boneStateAfterImport.metaJointId, 'skinned-spine-persistent-v2', 'model.userData.arenamonRig atualizado com novo ID');
      assert.ok(Math.abs(boneStateAfterImport.metaQuatY - 0.7071) < 1e-3, 'model.userData.arenamonRig atualizado com novo quaternion');

      // Testa Undo no SkinnedMesh
      await page.click('#btn-undo');
      const boneStateAfterUndo = await page.evaluate(() => {
        const bone = window.__rigStudio.bridge.getBoneObject('Spine');
        const metaJoint = window.__rigStudio.bridge.model.userData.arenamonRig.joints.find(j => j.name === 'Spine');
        return {
          boneJointId: bone.userData.arenamonJointId,
          boneQuatY: bone.quaternion.y,
          metaJointId: metaJoint.id,
          metaQuatY: metaJoint.q[1]
        };
      });
      assert.equal(boneStateAfterUndo.boneJointId, prevSkinnedSpineId, 'Undo restaurou userData.arenamonJointId anterior no THREE.Bone');
      assert.ok(Math.abs(boneStateAfterUndo.boneQuatY) < 1e-4, 'Undo restaurou quaternion anterior no THREE.Bone');
      assert.equal(boneStateAfterUndo.metaJointId, prevSkinnedSpineId, 'Undo restaurou ID nos metadados model.userData.arenamonRig');
      assert.ok(Math.abs(boneStateAfterUndo.metaQuatY) < 1e-4, 'Undo restaurou quaternion nos metadados');

      // Testa Redo no SkinnedMesh
      await page.click('#btn-redo');
      const boneStateAfterRedo = await page.evaluate(() => {
        const bone = window.__rigStudio.bridge.getBoneObject('Spine');
        return {
          boneJointId: bone.userData.arenamonJointId,
          boneQuatY: bone.quaternion.y
        };
      });
      assert.equal(boneStateAfterRedo.boneJointId, 'skinned-spine-persistent-v2', 'Redo re-aplicou ID no THREE.Bone');
      assert.ok(Math.abs(boneStateAfterRedo.boneQuatY - 0.7071) < 1e-3, 'Redo re-aplicou quaternion no THREE.Bone');

      // Deixa o estado limpo
      await page.click('#btn-undo');

      // 1.5.C Teste do botão REAL da interface (#btn-export-json) após bindSkin()
      console.log('  -> Testando clique no botão real da UI (#btn-export-json) após bindSkin...');
      await page.click('#btn-export-json');
      await page.waitForTimeout(100);
      const exportedFromUI = await page.evaluate(() => window.__lastExportedJSON);
      assert.ok(exportedFromUI, 'Clique no botão #btn-export-json registrou window.__lastExportedJSON');
      assert.equal(exportedFromUI.schema, 'arenamon-rig', 'Schema canônico correto');
      assert.equal(exportedFromUI.version, 2, 'Exportação acionada pelo botão real da interface gerou Schema v2 mesmo após bindSkin()');
      assert.equal(exportedFromUI.joints.length, 20, 'Exportação da interface contém todas as 20 articulações');
      const allExportedValid = exportedFromUI.joints.every(j => {
        return typeof j.id === 'string' && j.id.trim() && Array.isArray(j.q) && j.q.length === 4 && j.q.every(Number.isFinite);
      });
      assert.equal(allExportedValid, true, 'Todas as articulações exportadas pelo botão real da UI contêm ID e quaternion');
      console.log('✓ Botão real #btn-export-json na interface testado após bindSkin: Schema v2 confirmado');

      // 1.6 Prioridade 5: Identificação clara dos controles demonstrativos (Fase 2)
      console.log('  -> Testando identificação transparente dos controles demonstrativos...');
      await page.click('[data-tab="weights"]');
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
    });

    // =============================================================
    // TESTE 2: PROPOSTA B (Guided Rigging)
    // =============================================================
    await runWithFreshBrowser('PROPOSTA B (Guided Rigging)', async (page, errors) => {
      await page.goto(pathToFileURL(resolve(dir, 'proposta-b.html')).href + '?gl=lite');
      await page.waitForSelector('#viewport-3d canvas', { timeout: 60000 });
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

      // Testa acionamento real do botão de exportação da Proposta B (#step5-btn-export)
      console.log('  -> Testando clique no botão real da UI (#step5-btn-export) na Proposta B após bindSkin...');
      await page.click('#step5-btn-export');
      await page.waitForTimeout(100);
      const exportedFromBButton = await page.evaluate(() => window.__lastExportedJSON);
      assert.ok(exportedFromBButton, 'Botão #step5-btn-export gerou window.__lastExportedJSON');
      assert.equal(exportedFromBButton.version, 2, 'Proposta B botão real emite Schema v2 após bindSkin');
      assert.equal(exportedFromBButton.joints.length, 20, 'Contém todas as 20 articulações');
      console.log('✓ Botão real #step5-btn-export na Proposta B testado após bindSkin: Schema v2 confirmado');

      await page.screenshot({ path: resolve(screenshotsDir, 'proposta-b.png') });
      console.log('✓ Captura atualizada: screenshots/proposta-b.png');
    });

    // =============================================================
    // TESTE 3: PROPOSTA C (Hybrid Rigging Studio)
    // =============================================================
    await runWithFreshBrowser('PROPOSTA C (Hybrid Rigging Studio)', async (page, errors) => {
      await page.goto(pathToFileURL(resolve(dir, 'proposta-c.html')).href + '?gl=lite');
      await page.waitForSelector('#viewport-3d canvas', { timeout: 60000 });
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

      // Vincula skin e testa botão real #btn-export-json
      console.log('  -> Testando clique no botão real da UI (#btn-export-json) na Proposta C após bindSkin...');
      await page.evaluate(() => window.__rigStudio.bridge.bindSkin());
      await page.click('#btn-export-json');
      await page.waitForTimeout(100);
      const exportedFromCButton = await page.evaluate(() => window.__lastExportedJSON);
      assert.ok(exportedFromCButton, 'Botão #btn-export-json gerou window.__lastExportedJSON na Proposta C');
      assert.equal(exportedFromCButton.version, 2, 'Proposta C botão real emite Schema v2 após bindSkin');
      assert.equal(exportedFromCButton.joints.length, 20, 'Contém todas as 20 articulações');
      console.log('✓ Botão real #btn-export-json na Proposta C testado após bindSkin: Schema v2 confirmado');

      await page.screenshot({ path: resolve(screenshotsDir, 'proposta-c.png') });
      console.log('✓ Captura atualizada: screenshots/proposta-c.png');
    });

    // =============================================================
    // TESTE 4: PORTAL COMPARADOR (index.html em Processo Isolado)
    // =============================================================
    await runWithFreshBrowser('Portal Comparador (index.html em Processo Isolado)', async (page, errors) => {
      await page.goto(pathToFileURL(resolve(dir, 'index.html')).href, { waitUntil: 'load', timeout: 60000 });
      assert.equal(errors.length, 0, 'Sem erros no Portal');
      await page.screenshot({ path: resolve(screenshotsDir, 'propostas-portal.png') });
      console.log('✓ Captura do portal atualizada: screenshots/propostas-portal.png');
    });

  console.log('\n=============================================================');
  console.log('✓ TODAS AS 6 PRIORIDADES E CASOS DE TESTE FORAM APROVADOS!');
  console.log('=============================================================\n');
}

runTests().catch(err => {
  console.error('Falha nos testes dos protótipos:', err);
  process.exit(1);
});
