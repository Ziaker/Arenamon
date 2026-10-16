// Moves no navegador (Edge real, file://, offline): o Reflect é registrado no bootstrap, mas NENHUM slot vem equipado; equipado,
// segurar e soltar a tecla A (padrão do slot 1, D3) pelo teclado real carrega e materializa a barreira. Valida o caminho
// de entrada completo (teclado → comando com skillHeld → controlador → mundo), que os testes sem navegador não cobrem.
// Esta é a verificação TÉCNICA; a aprovação de jogabilidade e visual é do diretor (M28.9). Capturas em validation/moves/.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync, writeFileSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'validation/moves/';mkdirSync(out, {recursive: true});
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
const report = [];let failures = 0;
const check = (label, ok, detail = '') => {report.push({label, ok: !!ok, detail: String(detail)});console.log(`${ok ? '✓' : '✗'} ${label}${detail !== '' ? ` — ${detail}` : ''}`);if (!ok) failures++;};
const browser = await chromium.launch({...BROWSER, headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 920}}), errors = [], network = [];
  page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('request', r => {if (/^https?:/.test(r.url())) network.push(r.url());});page.on('dialog', d => d.accept());
  await page.context().setOffline(true);await page.goto(labUrl);await page.waitForFunction(() => window.__lab);
  const L = (fn, arg) => page.evaluate(fn, arg);
  const reg = await L(() => ({list: window.__lab.moves.listMoves().map(m => m.id), loadout: window.__lab.game.fighters[0].loadout}));
  check('Reflect registrado no bootstrap, sem nenhum slot equipado', reg.list.includes('reflect') && reg.loadout.every(x => !x), JSON.stringify(reg));
  await L(() => {const p = document.getElementById('panel');if (p.hidden || p.dataset.tool !== 'match') document.querySelector('[data-tool="match"]').click();});
  await page.selectOption('#mode', 'inactive');await page.click('#start');await page.waitForTimeout(300);
  const key = async (code, down) => {await page.locator('canvas').first().focus();await (down ? page.keyboard.down(code) : page.keyboard.up(code));};
  await key('KeyA', true);await page.waitForTimeout(200);await key('KeyA', false);await page.waitForTimeout(300);
  check('com o slot vazio, a tecla A não faz nada', await L(() => window.__lab.game.world.entities.length === 0 && !window.__lab.game.fighters[0].charge));
  await L(() => window.__lab.moves.equipStandard(0));
  await key('KeyA', true);await page.waitForTimeout(500);
  const mid = await L(() => {const f = window.__lab.game.fighters[0];return {charging: !!f.charge, ticks: f.charge?.ticks ?? 0, move: f.charge?.move ?? null};});
  check('segurar A (teclado real) carrega o Reflect', mid.charging && mid.move === 'reflect' && mid.ticks > 10, JSON.stringify(mid));
  await page.screenshot({path: out + 'carregando.png'});
  await key('KeyA', false);await page.waitForTimeout(400);
  const after = await L(() => {const g = window.__lab.game, f = g.fighters[0], b = g.world.entities.find(e => e.reflect);
    return {charging: !!f.charge, barrier: b ? {owner: b.owner, pl: b.pl, width: +(b.hx * 2).toFixed(2), height: +b.height.toFixed(2), life: +b.life.toFixed(2)} : null, cooldown: +(f.moveCooldowns.reflect ?? 0).toFixed(2)};});
  check('soltar A materializa a barreira (dono, PL, tamanho e duração) e inicia a recarga', !after.charging && after.barrier && after.barrier.owner === 0 && after.barrier.life > 4 && after.cooldown > 7, JSON.stringify(after));
  await page.screenshot({path: out + 'barreira.png'});
  check('sem requisições de rede e sem erros no console', network.length === 0 && errors.length === 0, [...network, ...errors].join(' | '));
} finally {
  writeFileSync(out + 'report.json', JSON.stringify({date: new Date().toISOString(), failures, report}, null, 1));
  await browser.close();
}
console.log(`\n${report.length - failures} de ${report.length} verificações aprovadas.`);
if (failures) process.exit(1);
