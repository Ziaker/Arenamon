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

  // 8b. Testar prévias das Opções A e C
  await page.locator('[data-preview="chromaticAberration"]').scrollIntoViewIfNeeded();
  await page.click('[data-preview="chromaticAberration"]');
  await page.waitForTimeout(50);
  const chromaActive = await page.evaluate(() => {
    const el = document.getElementById('cine-chroma');
    return el && !!window.__lab.cinematic.chromaState;
  });
  check('Prévia de Aberração Cromática RGB ativa overlay ótico', chromaActive);

  await page.locator('[data-preview="combatCallouts"]').scrollIntoViewIfNeeded();
  await page.click('[data-preview="combatCallouts"]');
  await page.waitForTimeout(50);
  const calloutsSpawned = await page.evaluate(() => {
    const popups = document.getElementById('cine-popups');
    return popups && popups.querySelectorAll('.cine-callout').length >= 1;
  });
  check('Prévia de Chamadas de Combate gera callouts no DOM (.cine-callout)', calloutsSpawned);

  await page.locator('[data-preview="damageNumbers"]').scrollIntoViewIfNeeded();
  await page.click('[data-preview="damageNumbers"]');
  await page.waitForTimeout(50);
  const damageSpawned = await page.evaluate(() => {
    const popups = document.getElementById('cine-popups');
    return popups && popups.querySelectorAll('.cine-damage').length >= 1;
  });
  check('Prévia de Números de Dano gera elementos com animação (.cine-damage)', damageSpawned);

  await page.locator('[data-preview="roundIntro"]').scrollIntoViewIfNeeded();
  await page.click('[data-preview="roundIntro"]');
  await page.waitForTimeout(50);
  const introActive = await page.evaluate(() => {
    return !!window.__lab.cinematic.roundIntroState;
  });
  check('Prévia de Intro de Round ativa plano dramático de abertura', introActive);

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

  // 12. Validação profunda de C08 — Materiais WebGL de silhueta e restauração completa
  const c08Robustness = await page.evaluate(() => {
    const lab = window.__lab;
    const view = lab.view;
    const cine = lab.cinematic;

    // Verificar materiais de silhueta dedicados
    const hasSilMats = !!(view.silhouetteWhiteMat && view.silhouetteBlackMat);
    const origFloorVis = view.floor.visible;

    // Forçar disparo de silhueta branca
    cine.triggerImpactFrame({whiteDur: 0.5, invertDur: 0.5, strength: 1.0});
    const phaseWhite = cine.getImpactFramePhase() === 'white';

    // Executa frame de renderização
    view.draw(lab.game.fighters, [], 0.016);

    // Após o frame, a cena DEVE estar restaurada pelo bloco finally
    const floorRestored = view.floor.visible === origFloorVis;
    const bgRestored = !!view.scene.background;

    // Resetar
    cine.reset();
    const phaseAfterReset = cine.getImpactFramePhase() === null;

    return {hasSilMats, phaseWhite, floorRestored, bgRestored, phaseAfterReset};
  });
  check('C08 WebGL: Materiais de silhueta branca/preta existem no renderer', c08Robustness.hasSilMats);
  check('C08 WebGL: Fase de silhueta é reconhecida durante o impacto', c08Robustness.phaseWhite);
  check('C08 WebGL: Cenário e fundo são restaurados após o quadro (proteção try/finally)', c08Robustness.floorRestored && c08Robustness.bgRestored);
  check('C08 WebGL: Reset cancela fase de silhueta imediatamente', c08Robustness.phaseAfterReset);

  // 13. Validação do Letterbox Cinema 2.39:1 com pillarbox em viewport ultrawide
  await page.setViewportSize({width: 3440, height: 1080}); // 3.185:1 aspect ratio (> 2.39)
  await page.evaluate(() => {
    const cine = window.__lab.cinematic;
    cine.config.enabled = true;
    cine.config.letterbox.enabled = true;
    cine.config.letterbox.mode = 'cinema';
    cine.triggerLetterbox({duration: 1.0, mode: 'cinema'});
    cine.clock += 0.5; // meio do ciclo (seno máximo)
    cine.renderOverlays();
  });
  await page.waitForTimeout(50);
  const ultrawideBars = await page.evaluate(() => {
    const lb = document.getElementById('cine-letterbox');
    const left = lb?.querySelector('.cine-bar-left');
    const right = lb?.querySelector('.cine-bar-right');
    const top = lb?.querySelector('.cine-bar-top');
    const wLeft = parseFloat(left?.style.width || '0');
    const wRight = parseFloat(right?.style.width || '0');
    const hTop = parseFloat(top?.style.height || '0');
    return {wLeft, wRight, hTop};
  });
  check('C10 Letterbox: Em ultrawide 3.18:1, barras laterais (pillarbox) são aplicadas (> 0%)', ultrawideBars.wLeft > 0 && ultrawideBars.wRight > 0);
  check('C10 Letterbox: Em ultrawide 3.18:1, barras verticais ficam zeradas (0%)', ultrawideBars.hTop === 0);

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
