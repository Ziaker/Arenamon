// Rodada de 22/10/2026 no navegador (Edge real, file://, offline): botões de IA na barra superior, atalho «término do movimento pela duração da animação» na gaveta Ações,
// tooltips de Moves, bloco do Riposte, blocos novos de VFX (variante D, pouso do pulo regular, impacto em paredes e objetos) e os efeitos disparando de verdade na arena.
// Gera capturas em evidence/ui-22-10/ (versionáveis). Verificação TÉCNICA: a aprovação visual é do responsável.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync, writeFileSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'evidence/ui-22-10/';mkdirSync(out, {recursive: true});
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
const report = [];let failures = 0;
const check = (label, ok, detail = '') => {report.push({label, ok: !!ok, detail: String(detail)});console.log(`${ok ? '✓' : '✗'} ${label}${detail !== '' ? ` — ${detail}` : ''}`);if (!ok) failures++;};
const browser = await chromium.launch({...BROWSER, headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 920}}), errors = [], network = [];
  page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('request', r => {if (/^https?:/.test(r.url())) network.push(r.url());});page.on('dialog', d => d.accept());
  await page.context().setOffline(true);await page.goto(labUrl);await page.waitForFunction(() => window.__lab);await page.waitForTimeout(1500);
  const L = (fn, arg) => page.evaluate(fn, arg);
  const shot = (name, opts = {}) => page.screenshot({path: out + name, ...opts});

  // ---------- 5. Botões de IA na barra superior, ao lado da busca ----------
  const box = id => L(id => {const el = document.getElementById(id);if (!el) return null;const r = el.getBoundingClientRect(), s = getComputedStyle(el);return {x: r.x, y: r.y, w: r.width, h: r.height, visible: s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0, inPop: !!el.closest('#tools-pop')};}, id);
  const bo = await box('arena-enemy-ai-toggle'), bp = await box('arena-autoplay-toggle'), bs = await box('quick-open');
  check('os dois botões de IA estão visíveis na barra superior (fora do menu Ferramentas)', bo?.visible && bp?.visible && !bo.inPop && !bp.inPop, JSON.stringify({bo, bp}));
  check('ficam ao lado da busca (mesma linha, perto)', Math.abs(bo.y - bs.y) < 30 && Math.abs(bp.x - bs.x) < 400, `busca x=${bs.x.toFixed(0)}, IA jogador x=${bp.x.toFixed(0)}, IA oponente x=${bo.x.toFixed(0)}`);
  await shot('barra-superior.png', {clip: {x: 0, y: 0, width: 1500, height: 130}});
  const ai0 = await L(() => ({e: window.__lab.C.extras.toggles.enableEnemyAI, p: window.__lab.C.extras.toggles.enablePlayerAI}));
  await page.click('#arena-enemy-ai-toggle');await page.click('#arena-autoplay-toggle');
  const ai1 = await L(() => ({e: window.__lab.C.extras.toggles.enableEnemyAI, p: window.__lab.C.extras.toggles.enablePlayerAI, ce: document.getElementById('arena-enemy-ai-toggle').getAttribute('aria-checked'), cp: document.getElementById('arena-autoplay-toggle').getAttribute('aria-checked')}));
  check('clicar liga/desliga a IA do oponente e a do jogador e o estado ON/OFF acompanha', ai1.e !== ai0.e && ai1.p !== ai0.p && ai1.ce === String(!!ai1.e) && ai1.cp === String(!!ai1.p), JSON.stringify({ai0, ai1}));
  await page.click('#arena-enemy-ai-toggle');await page.click('#arena-autoplay-toggle');
  const ai2 = await L(() => ({e: window.__lab.C.extras.toggles.enableEnemyAI, p: window.__lab.C.extras.toggles.enablePlayerAI}));
  check('clicar de novo volta ao estado anterior', ai2.e === ai0.e && ai2.p === ai0.p);

  // ---------- 4. Atalho da duração da animação na gaveta Ações ----------
  await page.click('#moves-open');await page.waitForTimeout(300);
  const syncVis = await L(() => {const el = document.getElementById('act-sync');if (!el) return false;const r = el.getBoundingClientRect();return r.width > 0 && r.height > 0;});
  check('a gaveta Ações mostra «Término do movimento trava outras ações pela duração da animação»', syncVis);
  await page.check('#act-sync');
  check('marcar o atalho liga a mesma opção de Personagens › avançado', await L(() => document.getElementById('char-sync').checked === true));
  await page.uncheck('#act-sync');
  check('desmarcar desliga as duas', await L(() => document.getElementById('char-sync').checked === false));

  // ---------- 6. Tooltips de Moves ----------
  await page.selectOption('[data-slot-move="0.0"]', 'riposte');await page.selectOption('[data-slot-move="0.1"]', 'bullet-punch');await page.waitForTimeout(250);
  await page.hover('[data-slot-move="0.0"]');await page.waitForTimeout(250);
  const tip = await L(() => {const t = document.getElementById('hover-tip');return t && !t.hidden ? t.textContent : null;});
  check('passar o mouse no seletor do Move mostra descrição e uso (custo, recarga, botão)', !!tip && /Custo/.test(tip) && /recarga/.test(tip) && /Riposte/.test(tip), tip);
  const lines = await page.locator('#moves-panel .tip-line').count();
  check('há uma linha de descrição visível sob cada Move escolhido', lines >= 2, lines);
  await shot('gaveta-acoes-tooltip.png');
  check('as opções da lista têm title com a descrição', await L(() => [...document.querySelectorAll('[data-slot-move="0.0"] option')].filter(o => o.value && o.title.length > 20).length >= 10));
  await page.mouse.move(5, 5);

  // ---------- 2. Riposte: bloco de controles + visual da postura ----------
  const rip = await L(() => ['fxOn', 'fxIntensity', 'fxSize'].every(k => document.querySelector(`#moves-panel [data-p="riposte.${k}"]`)));
  check('o Riposte tem os 3 controles do efeito visual (ligado, intensidade, tamanho)', rip);
  await L(() => document.getElementById('moves-close')?.click());
  await L(() => {const L = window.__lab;L.C.extras.toggles.enableEnemyAI = 0;if (L.game.phase !== 'playing') L.game.start();L.game.setLoadout(0, ['riposte', null, null, null]);});await page.waitForTimeout(400);
  await page.locator('canvas').first().focus();await page.keyboard.press('KeyA');await page.waitForTimeout(110);
  const stance = await L(() => ({action: window.__lab.game.fighters[0].action?.move ?? null, fx: !!window.__lab.view.riposteFx, stances: window.__lab.view.riposteFx?.stances.size ?? 0}));
  check('apertar o botão do Riposte inicia a postura e o efeito visual dela existe', stance.action === 'riposte' && stance.fx && stance.stances === 1, JSON.stringify(stance));
  await shot('riposte-postura.png');
  await page.waitForTimeout(900);

  // ---------- 1/3 VFX: variante D e blocos novos ----------
  const blocks = await L(() => {
    const T = window.__lab.tuning;const sections = [...document.querySelectorAll('[data-group^="vfx-"]')].map(e => e.dataset.group);
    return {sections, hasWall: !!T?.byPath?.get('vfx.wallImpact.arenaOn'), hasLand: !!T?.byPath?.get('vfx.jumpLanding.radius'), hasD: !!T?.byPath?.get('vfx.hit.ringPlaneOn'), shake: !!T?.byPath?.get('vfx.shakeWall.enabled')};
  });
  check('os parâmetros novos existem no ajustador (variante D, pouso do pulo, impacto em paredes, tremor de parede)', blocks.hasWall && blocks.hasLand && blocks.hasD && blocks.shake, JSON.stringify(blocks));
  check('os blocos «Pouso do pulo regular» e «Impacto vertical…» aparecem em Visualizar', blocks.sections.includes('vfx-jumpLanding') && blocks.sections.includes('vfx-wallImpact'), blocks.sections.join(','));
  await L(() => {window.__lab.C.vfx.hit.variant = 3;});
  // Dispara cada efeito perto do lutador azul e fotografa a arena
  const fire = async (name, fn, wait = 140) => {await page.waitForTimeout(1300);await L(fn);await page.waitForTimeout(wait);await shot(name);};
  // o vermelho vai para a frente do azul (dentro do quadro) para as capturas mostrarem os efeitos de perto
  await L(() => {const g = window.__lab.game, a = g.fighters[0], b = g.fighters[1];b.position = {x: a.position.x + Math.cos(a.facing) * 3.2 + Math.sin(a.facing) * 1.2, z: a.position.z - Math.sin(a.facing) * 3.2 + Math.cos(a.facing) * 1.2};b.velocity = {x: 0, z: 0};});
  await page.waitForTimeout(300);
  await fire('vfx-impacto-D.png', () => {const f = window.__lab.game.fighters;window.__lab.view.vfx.preview('hit', f);}, 60);
  await L(() => {Object.assign(window.__lab.C.vfx.hit, {coreOn: 0, ringPlaneOn: 0, ringGroundOn: 0});});
  await fire('vfx-impacto-D-sem-circulos.png', () => {window.__lab.view.vfx.preview('hit', window.__lab.game.fighters);}, 60);
  await fire('vfx-pouso-pulo-regular.png', () => {window.__lab.view.vfx.preview('jumpLanding', window.__lab.game.fighters);}, 170);
  await fire('vfx-impacto-parede.png', () => {const f = window.__lab.game.fighters[1];const a = window.__lab.game.fighters[0], dx = a.position.x - f.position.x, dz = a.position.z - f.position.z, dl = Math.hypot(dx, dz) || 1, n = {x: dx / dl, z: dz / dl};window.__lab.view.vfx.fire('wallImpact', {pos: {x: f.position.x, z: f.position.z}, y: 1, base: 0, n, power: 1.2, w: 3, h: 4, arena: false}, 'teste');}, 70);
  const counts = await L(() => window.__lab.view.vfx.stats.firesByType);
  check('os efeitos novos dispararam de verdade na arena', counts.wallImpact >= 1 && counts.jumpLanding >= 1 && counts.hit >= 2, JSON.stringify(counts));

  check('sem erros de página e sem rede externa', errors.length === 0 && network.length === 0, errors.concat(network).join(' | '));
  writeFileSync(out + 'resultado.json', JSON.stringify({report, failures, errors}, null, 2) + '\n');
  console.log(failures ? `\n${failures} falha(s)` : `\n${report.length} verificações aprovadas (evidence/ui-22-10/).`);
  if (failures) process.exitCode = 1;
} finally {await browser.close();}
