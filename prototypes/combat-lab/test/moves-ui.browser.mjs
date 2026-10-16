// Fase 6 no navegador (Edge real, file://, offline): aba Moves (equipar, parâmetros, emissores, cenários técnicos), HUD dos slots durante a
// carga, prévia da barreira, reflexão com anel de impacto, pedras do Psyshock e aviso de falha. Capturas em validation/moves-ui/.
// Verificação TÉCNICA: a aprovação de jogabilidade e visual é do diretor (M28.9).
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync, writeFileSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'validation/moves-ui/';mkdirSync(out, {recursive: true});
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
const report = [];let failures = 0;
const check = (label, ok, detail = '') => {report.push({label, ok: !!ok, detail: String(detail)});console.log(`${ok ? '✓' : '✗'} ${label}${detail !== '' ? ` — ${detail}` : ''}`);if (!ok) failures++;};
const browser = await chromium.launch({...BROWSER, headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 920}, acceptDownloads: true}), errors = [], network = [];
  page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('request', r => {if (/^https?:/.test(r.url())) network.push(r.url());});page.on('dialog', d => d.accept());
  await page.context().setOffline(true);await page.goto(labUrl);await page.waitForFunction(() => window.__lab);
  const L = (fn, arg) => page.evaluate(fn, arg);
  const tab = t => L(t => {const p = document.getElementById('panel');if (p.hidden || p.dataset.tool !== t) document.querySelector(`button[data-tool="${t}"]`).click();}, t);
  const key = async (code, down) => {await page.locator('canvas').first().focus();await (down ? page.keyboard.down(code) : page.keyboard.up(code));};

  // ---------- Aba Moves ----------
  await tab('moves');
  check('a aba Moves lista equipar, emissores, cenários e parâmetros', await page.locator('#moves-panel [data-equip]').count() === 4 && await page.locator('#moves-panel [data-emit]').count() === 4 && await page.locator('#moves-panel [data-p]').count() >= 30);
  check('os parâmetros distinguem “aprovado” de “provisório”', await page.locator('#moves-panel small.ok').count() > 10 && await page.locator('#moves-panel small.warn').count() >= 3);
  await page.screenshot({path: out + 'aba-moves.png'});
  const slider = page.locator('[data-p="reflect.thickness"]');await slider.evaluate(el => {el.value = '0.2';el.dispatchEvent(new Event('input', {bubbles: true}));});
  check('um parâmetro muda o ajuste (vale para os próximos usos)', await L(() => window.__lab.C.world.reflect.thickness) === 0.2 && /0\.20 m/.test(await page.textContent('[data-o="reflect.thickness"]')));
  await L(() => document.querySelectorAll('#moves-panel details[data-k^="p:"]').forEach(d => {d.open = true;}));
  await page.click('[data-reset="reflect.thickness"]');check('o botão ↺ restaura o padrão', await L(() => window.__lab.C.world.reflect.thickness) === 0.1);
  await page.click('#mvp-run');await page.waitForSelector('#mvp-results details');
  const scen = await L(() => [...document.querySelectorAll('#mvp-results summary')].map(s => [s.textContent.trim(), s.classList.contains('ok')]));
  check('os 10 cenários técnicos passam (esperado × obtido)', scen.length === 10 && scen.every(s => s[1]), scen.filter(s => !s[1]).map(s => s[0]).join(' | '));
  await page.screenshot({path: out + 'cenarios.png'});
  const dl = page.waitForEvent('download');await page.click('#mvp-export');const file = await (await dl).path();check('exporta os cenários em JSON versionado', !!file);

  // ---------- Equipar e jogar ----------
  await page.check('[data-equip="0.reflect"]');await page.check('[data-equip="0.psyshock"]');
  check('equipar pela aba preenche os slots do jogador', JSON.stringify(await L(() => window.__lab.game.fighters[0].loadout)) === JSON.stringify(['reflect', 'psyshock', null, null]));
  await tab('match');await page.selectOption('#mode', 'inactive');await page.click('#start');await page.waitForTimeout(400);
  await tab('moves');await page.click('#panel-close').catch(() => {});await L(() => {document.getElementById('panel').hidden = true;});
  const hud0 = await page.textContent('#moves-hud');
  check('o HUD mostra os dois slots prontos com as teclas A e S', /A.*Reflect.*pronto/s.test(hud0) && /S.*Psyshock.*pronto/s.test(hud0), hud0.replace(/\s+/g, ' ').slice(0, 120));
  await key('KeyA', true);await page.waitForTimeout(900);
  const hud1 = await page.textContent('#moves-hud');
  check('durante a carga o HUD mostra % e PL', /carregando \d+% · PL1/.test(hud1), hud1.replace(/\s+/g, ' ').slice(0, 140));
  const prev = await L(() => window.__lab.view.worldView.preview.visible);check('a prévia da barreira aparece enquanto carrega o Reflect', prev === true);
  await page.screenshot({path: out + 'carregando-reflect.png'});
  await key('KeyA', false);await page.waitForTimeout(350);
  const hud2 = await page.textContent('#moves-hud');
  check('depois de soltar: recuperação e recarga no HUD, barreira no mundo', /recarga|recuperação/.test(hud2) && await L(() => window.__lab.game.world.entities.some(e => e.reflect)), hud2.replace(/\s+/g, ' ').slice(0, 140));
  await page.screenshot({path: out + 'barreira.png'});
  await L(() => {window.__lab.game.fighters[0].moveRecovery = 0;});await tab('moves');await page.click('[data-emit="1"]');await L(() => {document.getElementById('panel').hidden = true;});await page.waitForTimeout(450);
  check('o projétil hostil é refletido (evento e anel de impacto visível)', await L(() => window.__lab.game.events.some(e => e.result === 'reflected')) && await L(() => window.__lab.view.worldView.rings.length > 0));
  await page.screenshot({path: out + 'reflexao.png'});
  await L(() => {const f = window.__lab.game.fighters[0];f.moveRecovery = 0;});
  await key('KeyS', true);await page.waitForTimeout(1700);
  const orbs = await L(() => window.__lab.view.worldView.orbs[0].filter(o => o.visible).length);check('as pedras se formam ao redor de quem carrega o Psyshock (3 + 1 a cada 0,8 s)', orbs >= 4, `${orbs} pedras`);
  await page.screenshot({path: out + 'carregando-psyshock.png'});
  await key('KeyS', false);await page.waitForTimeout(250);
  await page.screenshot({path: out + 'pedras.png'});
  await page.waitForTimeout(1500);
  check('as pedras acertam o adversário', await L(() => window.__lab.game.fighters[1].hp) < 100);
  // falha de espaço: aviso discreto
  await L(() => {const g = window.__lab.game;g.fighters[0].moveCooldowns = {};g.fighters[0].moveRecovery = 0;g.fighters[0].stamina = 3;g.fighters[0].regenBase = 3;g.fighters[0].position = {x: 0, z: 15.4};g.fighters[0].facing = 0;});
  await key('KeyA', true);await page.waitForTimeout(400);await key('KeyA', false);await page.waitForTimeout(250);
  const toast = await page.textContent('#deny-toast');check('a falha de espaço avisa com o motivo e a devolução da stamina', /Reflect: sem espaço/.test(toast), toast);
  await page.screenshot({path: out + 'falha-espaco.png'});
  check('sem requisições de rede e sem erros no console', network.length === 0 && errors.length === 0, [...network, ...errors].join(' | '));
} finally {
  writeFileSync(out + 'report.json', JSON.stringify({date: new Date().toISOString(), failures, report}, null, 1));
  await browser.close();
}
console.log(`\n${report.length - failures} de ${report.length} verificações aprovadas.`);
if (failures) process.exit(1);
