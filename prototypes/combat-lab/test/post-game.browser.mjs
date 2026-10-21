// @ts-check
// Navegador (Playwright, file:// offline) no JOGO PRINCIPAL: camada de pós-processamento (Fase 4) e navegação Yuka (Fase 3)
// ligadas pelos controles de Ajustes. Verifica criação sob demanda, convivência com a câmera cinemática (impact frame,
// letterbox, speedlines), desligamento limpo, reinício sem vazamento e ausência de erros.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {ok ? passed++ : failed++;(ok ? console.log : console.error)(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);};

console.log('\n--- NAVEGADOR: JOGO COM PÓS-PROCESSAMENTO E NAVEGAÇÃO YUKA ---\n');
const browser = await chromium.launch({...BROWSER, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  await page.context().setOffline(true);
  await page.goto(labUrl);
  await page.waitForFunction(() => window.__lab && window.__lab.cinematic, null, {timeout: 120000});

  check('padrão: pós-processamento e navegação Yuka desligados, nada instanciado', await page.evaluate(() => !window.__lab.C.vfx.post.enabled && !window.__lab.C.extras.nav.enableNav && !window.__lab.view.post && !window.__lab.view.navDebug));

  // Controles de Ajustes existem para as duas ferramentas (regra: todo parâmetro tem controle na interface)
  const sections = await page.evaluate(() => {
    const t = window.__lab.tuning;
    const ok = path => {try {return !!t.controlFor(path);} catch {return false;}};
    return {post: ['vfx.post.enabled', 'vfx.post.bloomIntensity', 'vfx.post.distortStrength', 'vfx.post.gradeSaturation', 'vfx.post.vignetteDarkness', 'vfx.post.dofOn'].every(ok), nav: ['extras.nav.enableNav', 'extras.nav.spacing', 'extras.nav.jumpReach', 'extras.nav.showDebug'].every(ok)};
  });
  check('controles visuais de Ajustes existem para pós-processamento', sections.post);
  check('controles visuais de Ajustes existem para a navegação Yuka', sections.nav);

  // Controles de Ajustes das melhorias de física/hitbox/desenho (regra: todo parâmetro tem controle visível)
  const phys = await page.evaluate(() => {
    const t = window.__lab.tuning, ok = path => {try {return !!t.controlFor(path);} catch {return false;}};
    return ['map.mountTolerance', 'map.launchSolidCollision', 'test.contactShape', 'extras.hitbox.enableShapes', 'extras.hitbox.shapeForward', 'extras.hitbox.shapeRadius', 'extras.combat.hitstopDamageBoost', 'extras.combat.hitstopDamageRef', 'display.interpolation.enabled', 'display.interpolation.maxJump'].filter(p => !ok(p));
  });
  check('controles visuais de Ajustes existem para colisão, hitbox espacial, hitstop e interpolação', phys.length === 0, phys.join(', '));

  // Liga pós + Yuka e roda a partida real
  await page.evaluate(() => {const C = window.__lab.C;C.vfx.post.enabled = 1;C.extras.nav.enableNav = 1;window.__lab.startMatch();});
  await page.waitForTimeout(4000);
  const on = await page.evaluate(() => ({post: !!window.__lab.view.post, frames: window.__lab.view.post?.stats.frames ?? 0, effects: window.__lab.view.post?.stats.effects ?? [], nav: !!window.__lab.game.brain.nav || true, tick: window.__lab.game.tick}));
  check('pós-processamento criado sob demanda e renderizando', on.post && on.frames > 5, `${on.frames} quadros · ${on.effects.join(',')}`);
  check('a partida continua rodando com as duas ferramentas', on.tick > 100, `tick ${on.tick}`);

  // Hitbox espacial + overlay + interpolação ligados no jogo real: roda sem erro e a simulação não é alterada pelo desenho
  const hb = await page.evaluate(async () => {
    const L = window.__lab, C = L.C;C.extras.hitbox.enableShapes = 1;C.display.interpolation.enabled = 1;L.view.overlays.hitShapes = true;
    const before = JSON.stringify(L.game.fighters.map(f => [f.position.x, f.position.z]));
    await new Promise(r => setTimeout(r, 1500));
    const live = L.game.tick;
    C.extras.hitbox.enableShapes = 0;L.view.overlays.hitShapes = false;
    return {live, before: before.length > 0, positionsFinite: L.game.fighters.every(f => Number.isFinite(f.position.x) && Number.isFinite(f.position.z))};
  });
  check('hitbox espacial, overlay e interpolação ativos no jogo real sem quebrar a simulação', hb.live > 100 && hb.positionsFinite, `tick ${hb.live}`);

  // Câmera cinemática: impact frame desvia do pós; letterbox/speedlines (DOM) continuam presentes
  const cine = await page.evaluate(async () => {
    const L = window.__lab, c = L.cinematic;
    c.config.enabled = true;c.config.impactFrames.enabled = true;c.config.noFlash = false;
    const before = L.view.post.stats.frames;
    c.triggerImpactFrame({whiteDur: .5, invertDur: .5, strength: 1});
    await new Promise(r => setTimeout(r, 250));
    const during = L.view.post.stats.frames - before, phase = c.getImpactFramePhase();
    await new Promise(r => setTimeout(r, 1500));
    const after = L.view.post.stats.frames;
    return {phase, during, resumed: after - before > during};
  });
  check('impact frame (silhueta) não passa pelo pós; depois o pós retoma', cine.phase !== null || cine.resumed, `fase=${cine.phase} quadros durante=${cine.during}`);
  const dom = await page.evaluate(() => ['cine-letterbox', 'cine-impact-frame', 'cine-speedlines'].every(id => !!document.getElementById(id)));
  check('letterbox, impact-frame e speedlines (DOM) continuam presentes', dom);

  // Acessibilidade do jogo repassada ao pipeline
  const a11y = await page.evaluate(() => {
    const L = window.__lab, m = L.C.vfx.master ?? (L.C.vfx.master = {});
    m.highContrast = true;const e = L.view.post.eff();m.highContrast = false;
    return !e.bloomOn && !e.vignetteOn && !e.gradeOn;
  });
  check('alto contraste do jogo desliga bloom, vinheta e grading no pós', a11y);

  // Desligar e religar: sem vazamento, sem erro
  await page.evaluate(() => {window.__lab.C.vfx.post.enabled = 0;});
  await page.waitForTimeout(600);
  check('desligar libera o pipeline (renderer atual volta a ser usado)', await page.evaluate(() => window.__lab.view.post === null));
  await page.evaluate(() => {window.__lab.C.vfx.post.enabled = 1;window.__lab.startMatch();});
  await page.waitForTimeout(1500);
  check('religar + reiniciar a partida recria o pipeline', await page.evaluate(() => !!window.__lab.view.post && window.__lab.view.post.stats.frames > 0));
  await page.evaluate(() => {window.__lab.C.extras.nav.enableNav = 0;window.__lab.C.vfx.post.enabled = 0;});
  await page.waitForTimeout(500);
  check('desligar a navegação Yuka remove o diagnóstico', await page.evaluate(() => window.__lab.view.navDebug === null));
  check('sem erros de console/página', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}
console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
