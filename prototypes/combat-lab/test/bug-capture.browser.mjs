// @ts-check
// Navegador: captura de bug com um clique e reabertura do pacote (#11) + primeiro tick divergente no comparador (#12).
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : process.env.ARENAMON_BROWSER_PATH ? {executablePath: process.env.ARENAMON_BROWSER_PATH} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {ok ? passed++ : failed++;(ok ? console.log : console.error)(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);};

console.log('\n--- NAVEGADOR: CAPTURA DE BUG ---\n');
const browser = await chromium.launch({...BROWSER, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox']});
try {
  const page = await browser.newPage({viewport: {width: 1400, height: 900}, acceptDownloads: true});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.context().setOffline(true);
  await page.goto(labUrl + '?fabrica=1');
  await page.waitForFunction(() => window.__lab?.moves && window.__lab.game, null, {timeout: 120000});
  await page.evaluate(() => {const {C, game} = window.__lab;C.extras.toggles.enableEnemyAI = 0;game.setLoadout(0, ['harden']);window.__lab.startMatch();});
  await page.locator('canvas').first().focus();
  await page.keyboard.down('KeyA');await page.waitForTimeout(150);await page.keyboard.up('KeyA');
  await page.waitForTimeout(900);
  await page.evaluate(() => {const p = document.getElementById('panel');if (p.hidden || p.dataset.tool !== 'match') document.querySelector('button[data-tool="match"]').click();});
  await page.evaluate(() => document.querySelector('#bug-capture').scrollIntoView());
  const btn = page.locator('#bug-capture');
  check('o botão Capturar bug fica ativo depois de jogar', await btn.isEnabled());
  await page.fill('#bug-note', 'teste automático da captura');
  const [dl] = await Promise.all([page.waitForEvent('download'), btn.click()]);
  const path = await dl.path();
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  check('o pacote baixado tem esquema, versão, semente, snapshot e a nota', pkg.schema === 'arenamon-bug' && pkg.version === 1 && typeof pkg.seed === 'number' && pkg.snapshot?.fighters?.length === 2 && pkg.note === 'teste automático da captura', JSON.stringify({s: pkg.schema, v: pkg.version, tick: pkg.tick}));
  check('o pacote traz o equipamento de Moves e a versão do laboratório', pkg.moveLoadouts?.[0]?.[0] === 'harden' && /v\d+\.\d+\.\d+/.test(pkg.appVersion), String(pkg.appVersion));
  check('sem a opção marcada, o pacote não leva imagem', !('screenshot' in pkg));
  await page.check('#bug-image');
  const [dl2] = await Promise.all([page.waitForEvent('download'), btn.click()]);
  const shot = JSON.parse(readFileSync(await dl2.path(), 'utf8')).screenshot ?? '';
  check('com «Incluir imagem da tela», o pacote leva um JPEG da cena (não vazio)', /^data:image\/jpeg;base64,/.test(shot) && shot.length > 5000, `tamanho ${shot.length}`);
  await page.uncheck('#bug-image');
  await page.evaluate(() => {window.__lab.game.fighters[0].hp = 1;});   // estrago o estado para provar que a abertura restaura o capturado
  await page.setInputFiles('#bug-file', path);
  await page.waitForFunction(() => /Captura aberta/.test(document.getElementById('bug-result')?.textContent ?? ''), null, {timeout: 20000});
  const after = await page.evaluate(() => ({hp: window.__lab.game.fighters[0].hp, tick: window.__lab.game.tick, text: document.getElementById('bug-result').textContent}));
  check('abrir a captura restaura o estado e pausa nesse passo', after.hp > 1 && after.tick === pkg.tick && /pausado/.test(after.text), JSON.stringify({hp: after.hp, tick: after.tick}));
  await page.setInputFiles('#bug-file', {name: 'ruim.json', mimeType: 'application/json', buffer: Buffer.from('{"schema":"outra","version":1}')});
  await page.waitForFunction(() => /Não é uma captura/.test(document.getElementById('bug-result')?.textContent ?? ''), null, {timeout: 20000});
  check('um arquivo que não é captura é recusado com a causa', true);
  check('sem erros de página', errors.length === 0, errors.join(' | ').slice(0, 200));
} finally {
  await browser.close();
}
console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
