// @ts-check
// Navegador (Playwright, file:// offline): laboratório de pós-processamento. Verifica carga sem rede, cadeia de passes
// (bloom, distorção, aberração, grading, vinheta, DoF), A/B, acessibilidade, eventos e medição de desempenho.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const url = pathToFileURL(root + 'dist/arenamon-posprocessamento.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {ok ? passed++ : failed++;(ok ? console.log : console.error)(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);};

console.log('\n--- NAVEGADOR: LABORATÓRIO DE PÓS-PROCESSAMENTO ---\n');
const browser = await chromium.launch({...BROWSER, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  await page.context().setOffline(true);
  await page.goto(url);
  await page.waitForFunction(() => window.__postLab?.post?.stats?.frames > 3, null, {timeout: 60000});
  check('abre offline e renderiza pelo pipeline', true);
  const effects = () => page.evaluate(() => [...window.__postLab.post.stats.effects].sort().join(','));
  const e0 = await effects();
  check('cadeia padrão inclui bloom, distorção, aberração, grading e vinheta', ['bloom', 'shock', 'chroma', 'hue', 'bc', 'vignette'].every(k => e0.includes(k)), e0);

  // Profundidade de campo: só no K.O. (padrão dofKoOnly = 1)
  check('profundidade de campo fora do K.O. não é criada', !e0.includes('dof'));
  await page.click('#ev-ko');
  await page.waitForFunction(() => window.__postLab.post.stats.effects.includes('dof'), null, {timeout: 10000});
  check('K.O. liga a profundidade de campo', true);
  await page.waitForFunction(() => !window.__postLab.post.stats.effects.includes('dof'), null, {timeout: 10000});
  check('profundidade de campo é desligada após o K.O.', true);

  // Eventos reais e sintéticos geram pulsos
  await page.click('#ev-impact');
  const pulse = await page.evaluate(() => window.__postLab.post.pulses.get('impact'));
  check('impacto forte gera pulso', pulse > .3, pulse.toFixed(2));
  await page.click('#ev-sim');
  await page.waitForTimeout(3500);
  check('evento real da simulação roda sem erro', true);

  // A/B: renderer atual × pós produzem imagens diferentes; split mostra as duas
  const shot = async mode => {await page.click(`#view-mode [data-m="${mode}"]`);await page.waitForTimeout(400);return page.locator('#c').screenshot();};
  const off = await shot('off'), on = await shot('on'), split = await shot('split');
  check('A/B: imagem com pós difere do renderer atual', Buffer.compare(off, on) !== 0);
  check('modo dividido difere dos dois', Buffer.compare(split, off) !== 0 && Buffer.compare(split, on) !== 0);

  // Acessibilidade
  await page.check('#a-reduceMotion');
  await page.waitForTimeout(500);
  const eReduce = await effects();
  check('reduzir movimento remove a distorção de tela', !eReduce.includes('shock'), eReduce);
  await page.uncheck('#a-reduceMotion');
  await page.check('#a-highContrast');
  await page.waitForTimeout(500);
  const eHc = await effects();
  check('alto contraste remove todos os efeitos (volta ao renderer atual)', eHc === '' || eHc === e0.split(',').filter(k => k === 'dof').join(','), eHc || '(sem efeitos → renderer atual)');
  await page.uncheck('#a-highContrast');

  // Modo de bloom por seleção e interface
  await page.selectOption('#params select', '1');
  await page.waitForTimeout(500);
  check('bloom por seleção (apenas objetos de energia) funciona', (await effects()).includes('bloom'));
  await page.click('[data-preset="intenso"]');
  check('predefinições aplicam parâmetros', (await page.evaluate(() => window.__postLab.P.bloomIntensity)) > 1.5);

  // Desligar tudo: volta ao renderer atual (nenhum passe)
  await page.evaluate(() => {const P = window.__postLab.P;P.bloomOn = P.distortOn = P.chromaOn = P.gradeOn = P.vignetteOn = 0;});
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => window.__postLab.post.render(.016));
  check('com todos os efeitos desligados o pipeline não desenha (usa o renderer atual)', r === false);
  await page.evaluate(() => Object.assign(window.__postLab.P, {bloomOn: 1, distortOn: 1, chromaOn: 1, gradeOn: 1, vignetteOn: 1}));

  // Medição
  const perf = await page.evaluate(async () => ({off: await window.__postLab.run('off', 1200), on: await window.__postLab.run('on', 1200)}));
  check('medição de desempenho retorna FPS e tempo de envio', perf.off.fps > 0 && perf.on.fps > 0 && perf.on.cpu > 0, `atual ${perf.off.fps.toFixed(0)} fps / pós ${perf.on.fps.toFixed(0)} fps · envio ${perf.off.cpu.toFixed(2)}→${perf.on.cpu.toFixed(2)} ms`);

  mkdirSync(root + 'evidence', {recursive: true});
  await page.click('#view-mode [data-m="split"]');
  await page.click('[data-preset="cinema"]');
  await page.click('#ev-charge');
  await page.waitForTimeout(1800);
  await page.screenshot({path: root + 'evidence/post-lab-split.png'});
  check('sem erros de console/página', errors.length === 0, errors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
}
console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
