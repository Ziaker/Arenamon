// @ts-check
// Teste automatizado no navegador (Playwright, file:// offline):
// Valida o Sistema de Câmera Cinemática de Combate (estilo ZZZ),
// interface modal de configurações, botões de atalho, prévias de efeitos C01 a C12,
// overlays visuais no DOM (Letterbox, Impact Frames, Speedlines Canvas),
// restauração de padrões e estabilidade durante o combate em tempo real.

import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};

let passed = 0;
let failed = 0;

function check(label, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}${detail ? ` (${detail})` : ''}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('\n--- INICIANDO TESTE NO NAVEGADOR: CÂMERA CINEMÁTICA ZZZ ---\n');

const browser = await chromium.launch({...BROWSER, headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.context().setOffline(true);
  await page.goto(labUrl);
  await page.waitForFunction(() => window.__lab && window.__lab.cinematic);

  // 1. Botão de Câmera na barra superior
  const btnTop = await page.$('#cinematic-camera-btn');
  check('Botão de câmera cinemática presente na barra superior', !!btnTop);

  // 2. Abrir o modal cinematográfico pelo botão da barra superior
  await page.click('#cinematic-camera-btn');
  await page.waitForTimeout(100);
  const modalVisible = await page.evaluate(() => {
    const m = document.getElementById('cine-modal');
    return m && !m.hidden;
  });
  check('Modal de configurações cinematográficas abre ao clicar no botão', modalVisible);

  // 3. Checagem dos componentes da interface
  const panelStructure = await page.evaluate(() => {
    const master = document.getElementById('cine-master');
    const intensity = document.getElementById('cine-intensity');
    const toggles = document.querySelectorAll('.cine-panel-box input[type="checkbox"]');
    const previews = document.querySelectorAll('.cine-panel-box [data-preview]');
    return {
      hasMaster: !!master,
      hasIntensity: !!intensity,
      toggleCount: toggles.length,
      previewCount: previews.length
    };
  });
  check('Toggle mestre e slider de intensidade presentes', panelStructure.hasMaster && panelStructure.hasIntensity);
  check('Contém toggles individuais para efeitos C01 a C12', panelStructure.toggleCount >= 12, `${panelStructure.toggleCount} toggles`);
  check('Contém botões de prévia para efeitos', panelStructure.previewCount >= 8, `${panelStructure.previewCount} prévias`);

  // 4. Testar ativação do toggle mestre
  await page.click('#cine-master');
  await page.waitForTimeout(50);
  const isEnabled = await page.evaluate(() => window.__lab.cinematic.config.enabled);
  check('Ativação do toggle mestre atualiza o estado oficial de configuração', isEnabled === true);

  // 5. Testar acionamento de prévia de Letterbox
  await page.locator('[data-preview="letterbox"]').scrollIntoViewIfNeeded();
  await page.click('[data-preview="letterbox"]');
  await page.waitForTimeout(100);
  const letterboxActive = await page.evaluate(() => {
    const lb = document.getElementById('cine-letterbox');
    return lb && lb.style.opacity !== '0' && !!window.__lab.cinematic.letterboxState;
  });
  check('Prévia de Letterbox (C10) aciona barras no DOM', letterboxActive);

  // 6. Testar acionamento de prévia de Impact Frame
  await page.locator('[data-preview="impactFrames"]').scrollIntoViewIfNeeded();
  await page.click('[data-preview="impactFrames"]');
  await page.waitForTimeout(50);
  const impactActive = await page.evaluate(() => {
    const el = document.getElementById('cine-impact-frame');
    return el && !!window.__lab.cinematic.impactState;
  });
  check('Prévia de Impact Frames (C08) aciona overlay de flash visual', impactActive);

  // 7. Testar acionamento de prévia de Speedlines
  await page.locator('[data-preview="speedlines"]').scrollIntoViewIfNeeded();
  await page.click('[data-preview="speedlines"]');
  await page.waitForTimeout(50);
  const speedlinesActive = await page.evaluate(() => {
    const canvas = document.getElementById('cine-speedlines');
    return canvas && !!window.__lab.cinematic.speedlineState;
  });
  check('Prévia de Speedlines (C09) aciona renderização no canvas 2D', speedlinesActive);

  // 8. Testar prévia de Dutch Angle
  await page.locator('[data-preview="dutchDodge"]').scrollIntoViewIfNeeded();
  await page.click('[data-preview="dutchDodge"]');
  await page.waitForTimeout(50);
  const dutchActive = await page.evaluate(() => {
    return Math.abs(window.__lab.cinematic.target.roll) > 0.05;
  });
  check('Prévia de Dutch Angle (C01) altera inclinação (roll) alvo', dutchActive);

  // 9. Testar Restauração de Padrões
  await page.locator('#cine-reset').scrollIntoViewIfNeeded();
  await page.click('#cine-reset');
  await page.waitForTimeout(100);
  const resetOk = await page.evaluate(() => {
    const c = window.__lab.cinematic.config;
    return c.enabled === false && c.dutchDodge.maxRoll === 10;
  });
  check('Botão Restaurar Padrões redefine todos os ajustes para o padrão', resetOk);

  // 10. Fechar modal via tecla Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const modalClosed = await page.evaluate(() => {
    const m = document.getElementById('cine-modal');
    return m && m.hidden;
  });
  check('Modal fecha ao pressionar Escape', modalClosed);

  // 11. Iniciar partida com câmera cinematográfica ativada e verificar estabilidade
  await page.evaluate(() => {
    window.__lab.cinematic.config.enabled = true;
    window.__lab.startMatch();
  });
  await page.waitForTimeout(800);

  const matchStable = await page.evaluate(() => {
    return window.__lab.game.tick > 20 && window.__lab.ui.fps > 25;
  });
  check('Partida executa com fluidez com câmera cinematográfica ativa (estabilidade e FPS)', matchStable);

  check('Nenhum erro de script ou exceção durante a execução', errors.length === 0, errors.join('; '));

} finally {
  await browser.close();
}

console.log('\n==========================================');
console.log(`TESTE NO NAVEGADOR: ${passed} passaram, ${failed} falharam.`);
console.log('==========================================\n');

if (failed > 0) {
  process.exit(1);
}
