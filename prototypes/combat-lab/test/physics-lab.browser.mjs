// @ts-check
// Navegador (Playwright, file:// OFFLINE): laboratório de física Rapier (prova de conceito). Verifica a inicialização do WASM
// embutido sem rede, a execução dos cenários nas duas físicas, a bateria completa e a ausência de erros.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync, statSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const file = root + 'dist/arenamon-fisica-rapier.html';
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {ok ? passed++ : failed++;(ok ? console.log : console.error)(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);};

console.log('\n--- NAVEGADOR: LABORATÓRIO DE FÍSICA RAPIER (offline) ---\n');
const browser = await chromium.launch({...BROWSER, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('request', r => {if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) requests.push(r.url());});
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(file).href);
  await page.waitForFunction(() => window.__physLab?.results, null, {timeout: 60000});
  const init = await page.evaluate(() => ({ms: window.__physLab.initMs, v: window.__physLab.RAPIER.version()}));
  check('WASM do Rapier inicializa offline (embutido em base64)', init.ms > 0, `${init.ms.toFixed(0)} ms · versão ${init.v}`);
  check('nenhuma requisição de rede/CDN', requests.length === 0, requests.slice(0, 2).join(' '));
  check(`HTML autocontido (${(statSync(file).size / 1048576).toFixed(1)} MB)`, statSync(file).size > 3e6);

  // Cenários: teto e pilar (o caso caixa × cilindro)
  const teto = await page.evaluate(() => {window.__physLab.select('teto');const r = window.__physLab.results;return {a: r.arenamon.maxY, b: r.box.maxY, c: r.capsule.maxY};});
  check('teto: cabeça para na laje nas três físicas (pés ≈ 0,3 m)', [teto.a, teto.b, teto.c].every(v => Math.abs(v - .3) < .03), JSON.stringify(teto));
  const pilar = await page.evaluate(() => {window.__physLab.select('pilar');const r = window.__physLab.results;return {a: r.arenamon.final.z, b: r.box.final.z, c: r.capsule.final.z};});
  check('pilar: Arenamon e cápsula contornam; caixa trava de frente (limitação documentada)', pilar.a > 6 && pilar.c > 6 && pilar.b < 3, JSON.stringify(pilar));

  // Controles visuais
  await page.selectOption('#scenario', 'salto_plataforma');
  await page.click('#play');
  await page.waitForTimeout(800);
  const scrub = await page.evaluate(() => Number(document.getElementById('scrub').value));
  check('reprodução anima as trilhas (controle de tempo avança)', scrub > 10, `tick ${scrub}`);
  await page.click('#play');
  const jumpBefore = await page.evaluate(() => window.__physLab.results.arenamon.maxY);
  await page.evaluate(() => {const el = [...document.querySelectorAll('#params .pfield input[type=range]')][0];el.value = '1';el.dispatchEvent(new Event('input'));el.dispatchEvent(new Event('change'));});
  await page.waitForTimeout(500);
  const jumpAfter = await page.evaluate(() => window.__physLab.results.arenamon.maxY);
  check('controle de altura do salto reexecuta as duas físicas', jumpAfter < jumpBefore, `${jumpBefore.toFixed(2)} → ${jumpAfter.toFixed(2)} m`);

  // Bateria completa
  await page.evaluate(() => {const el = [...document.querySelectorAll('#params .pfield input[type=range]')][0];el.value = '2';el.dispatchEvent(new Event('input'));el.dispatchEvent(new Event('change'));});
  await page.click('#battery');
  await page.waitForFunction(() => window.__physLab.lastBattery, null, {timeout: 120000});
  const bat = await page.evaluate(() => window.__physLab.lastBattery);
  check('bateria: Arenamon e Rapier·caixa passam em todos os critérios exceto o esperado', bat.pass.arenamon === bat.total.arenamon && bat.pass.box >= bat.total.box - 1, JSON.stringify(bat.pass) + ' de ' + JSON.stringify(bat.total));
  check('determinismo e save/load/snapshot reproduzem o mesmo futuro nos 7 cenários', bat.det.a === 7 && bat.det.r === 7, JSON.stringify(bat.det));
  check('custo por passo medido', bat.perf.r2 > 0 && bat.perf.arena.fullStepUs > 0, `Arenamon ${bat.perf.arena.fullStepUs.toFixed(0)} µs · Rapier(2) ${bat.perf.r2.toFixed(0)} µs`);

  mkdirSync(root + 'evidence', {recursive: true});
  await page.selectOption('#scenario', 'pilar');
  await page.waitForTimeout(300);
  await page.screenshot({path: root + 'evidence/physics-rapier-lab.png'});
  check('sem erros de console/página', errors.length === 0, errors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
}
console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
