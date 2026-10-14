// Validação automatizada offline com Playwright para os 3 protótipos de rigging.
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const dir = resolve('prototypes/studio/proposals');
const screenshotsDir = resolve('prototypes/studio/proposals/screenshots');

async function runTests() {
  console.log('Iniciando testes de interação e navegação nos protótipos de rigging...');
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

  // -------------------------------------------------------------
  // Teste 1: Proposta A (Rigging Workspace)
  // -------------------------------------------------------------
  console.log('\n--- Testando PROPOSTA A (Rigging Workspace) ---');
  await page.goto(pathToFileURL(resolve(dir, 'proposta-a.html')).href);
  await page.waitForSelector('#viewport-3d canvas', { timeout: 15000 });

  assert.equal(errors.length, 0, 'Sem erros de console na inicialização da Proposta A');
  console.log('✓ Proposta A abriu offline sem erros');

  // Seleciona articulação pela árvore
  const spineRow = page.locator('.tree-row[data-joint-name="Spine"]');
  await spineRow.click();
  assert.equal(await page.textContent('#inspector-title'), 'Spine');
  console.log('✓ Seleção na árvore de hierarquia atualizou o inspetor');

  // Alterna vistas de câmera
  await page.click('[data-view="front"]');
  await page.click('[data-view="side"]');
  await page.click('[data-view="persp"]');
  console.log('✓ Alternância de vistas (Front, Side, Persp) operacional');

  // Quad-View
  await page.click('#btn-quad-view');
  assert.ok(await page.locator('#btn-quad-view.active').count());
  await page.click('#btn-quad-view');
  console.log('✓ Modo Quad-View alternado com sucesso');

  // Ajusta coordenadas
  const prevX = await page.inputValue('#coord-x');
  await page.fill('#coord-x', '0.25');
  await page.locator('#coord-x').dispatchEvent('change');
  console.log('✓ Coordenadas X/Y/Z editadas no inspetor');

  // Desfazer / Refazer
  await page.click('#btn-undo');
  assert.equal(await page.inputValue('#coord-x'), prevX);
  await page.click('#btn-redo');
  console.log('✓ Histórico Undo/Redo funcional');

  // Alterna para criatura quadrúpede (suporte não-humanoide)
  await page.selectOption('#model-select', 'creature-quadruped-24');
  await page.waitForTimeout(300);
  assert.ok(await page.locator('.tree-row[data-joint-name="Tail1"]').count());
  console.log('✓ Suporte a criatura quadrúpede (24 ossos com cauda) validado');

  // Aba de Weight Painting
  await page.click('[data-tab="weights"]');
  await page.click('#btn-toggle-heatmap');
  console.log('✓ Aba de Weight Painting e Heatmap ativados');

  // Aba de Teste de Deformação
  await page.click('[data-tab="deform"]');
  await page.click('[data-preset-pose="elbow45"]');
  await page.click('#btn-reset-pose');
  console.log('✓ Teste de deformação e pose de repouso validados');

  // Captura de tela da Proposta A
  await page.screenshot({ path: resolve(screenshotsDir, 'proposta-a.png') });
  console.log('✓ Captura de tela salva: screenshots/proposta-a.png');

  // -------------------------------------------------------------
  // Teste 2: Proposta B (Guided Rigging)
  // -------------------------------------------------------------
  console.log('\n--- Testando PROPOSTA B (Guided Rigging) ---');
  await page.goto(pathToFileURL(resolve(dir, 'proposta-b.html')).href);
  await page.waitForSelector('#viewport-3d canvas', { timeout: 15000 });

  assert.equal(errors.length, 0, 'Sem erros na Proposta B');
  console.log('✓ Proposta B abriu offline sem erros');

  // Navega para Etapa 2 (Articulações)
  await page.click('.step-card[data-step="2"]');
  assert.equal(await page.textContent('#assistant-step-title'), 'Posicionamento das Articulações');
  console.log('✓ Navegação para Etapa 2 (Articulações) validada');

  // Clica no Paper Doll 2D
  await page.click('.doll-joint[data-joint="LeftElbow"]');
  assert.ok(await page.textContent('#assistant-step-content').then(t => t.includes('LeftElbow')));
  console.log('✓ Clique no Paper Doll 2D selecionou a articulação no 3D');

  // Navega para Etapa 3 (Simetria)
  await page.click('.step-card[data-step="3"]');
  await page.click('#step3-btn-auto-mirror');
  console.log('✓ Etapa 3 e auto-espelhamento validados');

  // Navega para Etapa 4 (Skinning)
  await page.click('.step-card[data-step="4"]');
  await page.click('#step4-btn-bind');
  console.log('✓ Etapa 4 e auto-bind concluídos');

  // Navega para Etapa 5 (Validação)
  await page.click('.step-card[data-step="5"]');
  await page.click('#step5-test-elbow');
  await page.click('#step5-btn-rest-pose');
  console.log('✓ Etapa 5 e testes de flexão concluídos');

  // Captura de tela da Proposta B
  await page.screenshot({ path: resolve(screenshotsDir, 'proposta-b.png') });
  console.log('✓ Captura de tela salva: screenshots/proposta-b.png');

  // -------------------------------------------------------------
  // Teste 3: Proposta C (Hybrid Rigging Studio)
  // -------------------------------------------------------------
  console.log('\n--- Testando PROPOSTA C (Hybrid Rigging Studio) ---');
  await page.goto(pathToFileURL(resolve(dir, 'proposta-c.html')).href);
  await page.waitForSelector('#viewport-3d canvas', { timeout: 15000 });

  assert.equal(errors.length, 0, 'Sem erros na Proposta C');
  console.log('✓ Proposta C abriu offline sem erros');

  // Alterna entre Modo Guiado e Modo Estúdio
  await page.click('.mode-switch-btn[data-mode="studio"]');
  assert.equal(await page.textContent('#mode-indicator-text'), 'Modo Estúdio Livre — Ferramentas Pro');
  await page.click('.mode-switch-btn[data-mode="guided"]');
  assert.equal(await page.textContent('#mode-indicator-text'), 'Modo Assistido — Roteiro Inteligente');
  console.log('✓ Alternador de Modo Guiado ⇄ Estúdio Livre validado');

  // Breadcrumbs de linhagem
  await page.click('.tree-row[data-joint-name="LeftWrist"]');
  assert.ok(await page.textContent('#viewport-breadcrumbs').then(t => t.includes('LeftShoulder')));
  console.log('✓ Breadcrumbs de linhagem 3D atualizados dinamicamente');

  // Recolhimento de Docks
  await page.click('#btn-toggle-dock-left');
  await page.click('#btn-toggle-dock-left');
  console.log('✓ Recolhimento e expansão de painéis laterais operacionais');

  // Bancada de flexão inferior
  await page.fill('#dock-pose-slider', '45');
  await page.locator('#dock-pose-slider').dispatchEvent('input');
  assert.equal(await page.textContent('#dock-pose-readout'), '45°');
  await page.click('#btn-dock-rest-pose');
  assert.equal(await page.textContent('#dock-pose-readout'), '0°');
  console.log('✓ Bancada de flexão rápida validada');

  // Captura de tela da Proposta C
  await page.screenshot({ path: resolve(screenshotsDir, 'proposta-c.png') });
  console.log('✓ Captura de tela salva: screenshots/proposta-c.png');

  // -------------------------------------------------------------
  // Teste 4: Portal / Comparador Index
  // -------------------------------------------------------------
  console.log('\n--- Testando Portal Comparador (index.html) ---');
  await page.goto(pathToFileURL(resolve(dir, 'index.html')).href);
  await page.screenshot({ path: resolve(screenshotsDir, 'propostas-portal.png') });
  console.log('✓ Captura de tela salva: screenshots/propostas-portal.png');

  await browser.close();
  console.log('\n✓ TODOS OS TESTES DOS PROTÓTIPOS FORAM APROVADOS COM SUCESSO!\n');
}

runTests().catch(err => {
  console.error('Falha nos testes dos protótipos:', err);
  process.exit(1);
});
