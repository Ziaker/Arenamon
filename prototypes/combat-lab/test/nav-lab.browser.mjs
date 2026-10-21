// @ts-check
// Navegador (Playwright, file:// offline): laboratório de navegação Yuka — carrega sem rede, troca de cenário e de modo,
// roda a simulação real com Yuka (chega ao alvo atrás do muro), A/B pela interface, e limpa sem erros de console.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const url = pathToFileURL(root + 'dist/arenamon-navegacao-yuka.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {ok ? passed++ : failed++;(ok ? console.log : console.error)(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);};

console.log('\n--- NAVEGADOR: LABORATÓRIO DE NAVEGAÇÃO YUKA ---\n');
const browser = await chromium.launch({...BROWSER, headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  await page.context().setOffline(true);
  await page.goto(url);
  await page.waitForFunction(() => !!window.__navLab?.game);
  check('abre offline e cria a partida real', true);
  check('seletor lista os 6 cenários', (await page.locator('#scenario option').count()) === 6);

  // Navegação atual: não chega atrás do muro. Yuka: chega.
  const run = (id, nav, secs) => page.evaluate(([id, nav, secs]) => window.__navLab.runNavScenario(id, {nav, seconds: secs}), [id, nav, secs]);
  const legacy = await run('muro', 0, 20), yuka = await run('muro', 1, 20);
  check('muro: navegação atual NÃO chega ao alvo', legacy.reachedAt === null, `menor distância ${legacy.minDist} m`);
  check('muro: Yuka chega ao alvo', yuka.reachedAt !== null, `${yuka.reachedAt} s`);
  const plat = await run('plataforma', 1, 20);
  check('plataforma: Yuka salta para alcançar o alvo elevado', plat.reachedAt !== null && plat.jumps >= 1, `${plat.jumps} salto(s)`);
  const tower = await run('torre', 1, 20);
  check('torre: não ataca o vazio nem insiste na parede', tower.tacklesOutOfReach === 0 && tower.reachedAt === null, `ataques no vazio ${tower.tacklesOutOfReach}`);

  // Interface: modo Yuka, iniciar, avançar a simulação pela interface.
  await page.selectOption('#scenario', 'muro');
  await page.click('#nav-mode [data-nav="1"]');
  await page.click('#run');
  await page.waitForTimeout(2500);
  const live = await page.locator('#live').innerText();
  check('painel ao vivo mostra o estado da rota', /Estado da rota/.test(live), live.split('\n')[2] ?? '');
  await page.click('#show-nodes');
  await page.click('#show-edges');
  await page.click('#ab');
  await page.waitForSelector('#ab-result table', {timeout: 30000});
  check('comparação A/B preenche a tabela', (await page.locator('#ab-result tr').count()) >= 6);

  mkdirSync(root + 'evidence', {recursive: true});
  await page.screenshot({path: root + 'evidence/nav-yuka-lab.png'});
  check('sem erros de console/página', errors.length === 0, errors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
}
console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
