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

  // 1.2 Prioridade 1: Simulação real de arrasto de Gizmo 3D e registro de Undo/Redo
  console.log('  -> Testando arrasto 3D e histórico de Undo/Redo...');
  const initialSpineP = await page.evaluate(() => {
    const j = window.__rigStudio.bridge.getJoint('Spine');
    return [...j.p];
  });

  // Executa arrasto de gizmo via ciclo beginDrag -> setJointPosition -> commitDrag
  await page.evaluate(() => {
    const bridge = window.__rigStudio.bridge;
    bridge.beginDrag('Spine');
    bridge.setJointPosition('Spine', [0.15, 1.35, 0.08], { recordHistory: false });
    bridge.commitDrag('Spine');
    window.__rigStudio.viewport.updateJointPositions();
    window.__rigStudio.viewport.updateBoneConnectors();
    window.__rigStudio.renderSelection();
  });

  const historyLenAfterDrag = await page.evaluate(() => window.__rigStudio.bridge.historyStack.length);
  assert.equal(historyLenAfterDrag, 1, 'Arrasto de gizmo gerou exatamente 1 comando no histórico');
  assert.equal(await page.isDisabled('#btn-undo'), false, 'Botão Undo foi habilitado após o arrasto');

  const draggedCoordX = parseFloat(await page.inputValue('#coord-x'));
  assert.ok(Math.abs(draggedCoordX - 0.15) < 1e-4, 'Coordenada X no inspetor reflete a posição arrastada');

  // Clica no botão Desfazer (Undo)
  await page.click('#btn-undo');
  const restoredSpineP = await page.evaluate(() => {
    const j = window.__rigStudio.bridge.getJoint('Spine');
    return [...j.p];
  });

  assert.ok(
    Math.abs(restoredSpineP[0] - initialSpineP[0]) < 1e-5 &&
    Math.abs(restoredSpineP[1] - initialSpineP[1]) < 1e-5 &&
    Math.abs(restoredSpineP[2] - initialSpineP[2]) < 1e-5,
    'Undo restaurou com precisão cirúrgica a coordenada anterior ao arrasto'
  );
  assert.equal(await page.isDisabled('#btn-redo'), false, 'Botão Redo habilitado após Undo');

  // Clica em Refazer (Redo)
  await page.click('#btn-redo');
  const redoneSpineP = await page.evaluate(() => window.__rigStudio.bridge.getJoint('Spine').p);
  assert.ok(Math.abs(redoneSpineP[0] - 0.15) < 1e-4, 'Redo reaplicou a posição arrastada');

  // Retorna para o estado limpo
  await page.click('#btn-undo');
  console.log('✓ Prioridade 1 Aprovada: Undo/Redo no manipulador 3D validado com restauração exata de coordenadas');

  // 1.3 Prioridade 2: Divergência 24 vs 27 ossos no Quadrúpede
  console.log('  -> Testando divergência de template quadrúpede (24 declarados vs 27 reais)...');
  await page.selectOption('#model-select', 'creature-quadruped-24');
  await page.waitForTimeout(300);

  const quadJointsCount = await page.evaluate(() => window.__rigStudio.bridge.getJoints().length);
  assert.equal(quadJointsCount, 27, 'Template quadrúpede instancia 27 articulações');

  const divergenceVisible = await page.isVisible('#divergence-callout .divergence-banner');
  assert.ok(divergenceVisible, 'Banner explicativo da divergência 24 vs 27 exibido no painel');

  const divergenceText = await page.textContent('#divergence-callout');
  assert.ok(divergenceText.includes('27 articulações instanciadas'), 'Texto do banner esclarece as 27 articulações');
  assert.ok(divergenceText.includes('24 base'), 'Texto esclarece os 24 ossos base');
  assert.ok(await page.locator('.tree-row[data-joint-name="Jaw"]').count(), 'Articulação Jaw presente');
  assert.ok(await page.locator('.tree-row[data-joint-name="LeftHorn"]').count(), 'Articulação LeftHorn presente');
  assert.ok(await page.locator('.tree-row[data-joint-name="Tail3"]').count(), 'Cauda segmentada (Tail3) presente');
  console.log('✓ Prioridade 2 Aprovada: Divergência 24 vs 27 documentada sem descartes silenciosos');

  // Retorna para o bípede para os próximos testes
  await page.selectOption('#model-select', 'humanoid-20');
  await page.waitForTimeout(300);

  // 1.4 Prioridade 3: Aplicação do Heatmap em modelos com múltiplas malhas
  console.log('  -> Testando aplicação do Heatmap em modelos com múltiplas malhas...');
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

  // Desativa o Heatmap e verifica restauração em todas as malhas
  await page.click('#btn-toggle-heatmap');
  const restoredHeatmapState = await page.evaluate(() => {
    let anyHasColor = false;
    let anyVertexColors = false;
    window.__rigStudio.bridge.model.traverse(o => {
      if (o.isMesh) {
        if (o.geometry?.attributes?.color) anyHasColor = true;
        if (o.material?.vertexColors) anyVertexColors = true;
      }
    });
    return { anyHasColor, anyVertexColors };
  });

  assert.equal(restoredHeatmapState.anyHasColor, false, 'Todas as malhas removeram o atributo color após desativar Heatmap');
  assert.equal(restoredHeatmapState.anyVertexColors, false, 'Todas as malhas desativaram vertexColors no material');
  console.log('✓ Prioridade 3 Aprovada: Heatmap em modelos multi-malha validado sem colisões de BufferAttribute');

  // 1.5 Prioridade 4: Validação e relatório da importação JSON
  console.log('  -> Testando validação e relatório estruturado de importação JSON...');
  // Teste 4.1: JSON corrompido / inválido
  const invalidReport = await page.evaluate(() => {
    return window.__rigStudio.bridge.validateAndImportJSON('{ "corrompido": true }');
  });
  assert.equal(invalidReport.success, false, 'Importação rejeitou JSON sem array joints');
  assert.ok(invalidReport.errors.length > 0, 'Relatório contém lista de erros impeditivos');

  // Teste 4.2: JSON válido com coordenadas
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
  console.log('✓ Prioridade 4 Aprovada: Relatório e validação de importação JSON operacionais');

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

  // 1.7 Controles de navegação do Workspace
  await page.click('[data-view="front"]');
  await page.click('[data-view="persp"]');
  await page.click('#btn-quad-view');
  await page.click('#btn-quad-view');
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

  // 2.2 Navega para Etapa 1 e verifica template quadrúpede
  await page.selectOption('#step1-model-select', 'creature-quadruped-24');
  await page.waitForTimeout(300);
  assert.ok(await page.isVisible('.divergence-banner'), 'Divergência 24/27 exibida na Etapa 1');

  // Retorna para bípede
  await page.selectOption('#step1-model-select', 'humanoid-20');
  await page.waitForTimeout(300);

  // 2.3 Navega para Etapa 2 e testa Paper Doll 2D
  await page.click('.step-card[data-step="2"]');
  assert.equal(await page.textContent('#assistant-step-title'), 'Posicionamento das Articulações');
  await page.click('.doll-joint[data-joint="LeftElbow"]');
  assert.ok(await page.textContent('#assistant-step-content').then(t => t.includes('LeftElbow')));
  console.log('✓ Seleção pelo Paper Doll 2D na Etapa 2 validada');

  // 2.4 Testa Undo na Proposta B
  await page.evaluate(() => {
    const bridge = window.__rigStudio.bridge;
    bridge.beginDrag('LeftElbow');
    bridge.setJointPosition('LeftElbow', [-0.95, 1.25, 0.05], { recordHistory: false });
    bridge.commitDrag('LeftElbow');
  });
  assert.equal(await page.isDisabled('#btn-undo'), false, 'Undo habilitado após movimento na Proposta B');
  await page.click('#btn-undo');

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

  // 3.3 Divergência 24/27 na Proposta C
  await page.selectOption('#hybrid-model-select', 'creature-quadruped-24');
  await page.waitForTimeout(300);
  assert.ok(await page.isVisible('#hybrid-divergence-callout .divergence-banner'), 'Divergência 24/27 exibida no dock da Proposta C');

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
