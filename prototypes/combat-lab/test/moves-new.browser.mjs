// @ts-check
// Navegador (Playwright, file:// offline): os Moves NOVOS no jogo real — equipar pela aba Moves/API, acionar pelo teclado como o jogador,
// ver estado no HUD dos slots, aura/VFX, parâmetros na interface e ausência de erros. Cresce a cada Move entregue.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {ok ? passed++ : failed++;(ok ? console.log : console.error)(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);};

console.log('\n--- NAVEGADOR: MOVES NOVOS ---\n');
const browser = await chromium.launch({...BROWSER, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('request', r => {if (!/^(file|data|blob):/.test(r.url())) requests.push(r.url());});
  await page.context().setOffline(true);
  await page.goto(labUrl + '?fabrica=1');
  await page.waitForFunction(() => window.__lab?.moves && window.__lab.game, null, {timeout: 120000});

  const L = (fn, arg) => page.evaluate(fn, arg);
  const openDrawer = () => L(() => {if (document.getElementById('moves-drawer').hidden) document.getElementById('moves-open').click();});
  const key = async code => {await page.locator('canvas').first().focus();await page.keyboard.down(code);await page.waitForTimeout(80);await page.keyboard.up(code);};
  await openDrawer();
  check('a aba Moves existe e lista os Moves novos nos slots', await page.locator('[data-slot-move="0.0"] option[value="harden"]').count() === 1 && await page.locator('[data-slot-move="0.0"] option[value="second-wind"]').count() === 1);
  await page.selectOption('[data-slot-move="0.0"]', 'harden');await page.selectOption('[data-slot-move="0.1"]', 'second-wind');await page.selectOption('[data-slot-move="0.2"]', 'swift');
  const lo = await L(() => window.__lab.game.fighters[0].loadout);
  check('Harden e Second Wind equipam pela interface (slots 1 e 2)', lo[0] === 'harden' && lo[1] === 'second-wind', JSON.stringify(lo));
  const panel = await L(() => {const t = document.getElementById('moves-panel');return {harden: !!t.querySelector('[data-p="harden.defensePct"]'), cost: !!t.querySelector('[data-p="harden.cost"]'), sw: !!t.querySelector('[data-p="secondWind.regenPctPerSecond"]'), swCost: !!t.querySelector('[data-p="secondWind.mobilityCostPct"]')};});
  check('a aba mostra os sliders de Harden e Second Wind (custo, cooldown, cast, duração, parâmetros próprios)', Object.values(panel).every(Boolean), JSON.stringify(panel));
  check('o painel mostra os sliders do Swift', await L(() => !!document.querySelector('#moves-panel [data-p="swift.homingRate"]') && !!document.querySelector('#moves-panel [data-p="swift.knockbackCap"]')));
  await L(() => {document.getElementById('moves-close').click();window.__lab.startMatch();});

  // Teclado como jogador: A = slot 1, S = slot 2 (a simulação em renderização por software é mais lenta que o tempo real: espera por condição)
  await key('KeyA');
  await page.waitForFunction(() => window.__lab.game.fighters[0].statuses.some(s => s.id === 'harden'), null, {timeout: 30000});
  const hard = await L(() => {const f = window.__lab.game.fighters[0];return {cd: f.moveCooldowns?.harden ?? 0, aura: !!window.__lab.view.statusAura, def: f.statuses.find(s => s.id === 'harden').mul};});
  check('tecla A aciona Harden: status ativo (dano × 1/1,3, knockback 0), cooldown correndo e aura visível', hard.cd > 5 && hard.aura && hard.def.knockbackTaken === 0 && Math.abs(hard.def.damageTaken - 1 / 1.3) < 1e-9, JSON.stringify(hard));
  check('o HUD dos slots mostra o Harden', /Harden/i.test(await L(() => document.getElementById('moves-hud').textContent)));
  await key('KeyS');
  await page.waitForFunction(() => window.__lab.game.fighters[0].statuses.some(s => s.id === 'second-wind'), null, {timeout: 30000});
  const sw = await L(() => window.__lab.game.fighters[0].statuses.map(s => s.id));
  check('tecla S aciona Second Wind e os dois status coexistem', sw.includes('second-wind') && sw.includes('harden'), sw.join(','));

  // Swift (tecla 3 = slot 3): três estrelas reais, com malha 3D própria
  await key('Digit3');
  await page.waitForFunction(() => window.__lab.game.world.entities.filter(e => e.visual === 'star').length === 3, null, {timeout: 30000});
  const star = await L(() => ({n: window.__lab.game.world.entities.filter(e => e.visual === 'star').length, pl: window.__lab.game.world.entities.find(e => e.visual === 'star').pl, mesh: Object.values(window.__lab.view.worldView).filter(v => v instanceof Map).some(m => [...m.values()].some(x => x?.getObjectByName?.('starCore')))}));
  check('tecla 3 dispara 3 estrelas PL1 com a malha própria no desenho', star.n === 3 && star.pl === 1 && star.mesh, JSON.stringify(star));

  // Os 17 Moves novos: todos listados nos slots e com seus sliders na aba Moves
  const GROUPS = {harden: 'harden', 'second-wind': 'secondWind', swift: 'swift', lunge: 'lunge', 'quick-attack': 'quickAttack', 'guard-break': 'guardBreak', feint: 'feint', riposte: 'riposte', bounce: 'bounce', spikes: 'spikes', 'sand-wave': 'sandWave', 'bullet-punch': 'bulletPunch', 'emerging-stone': 'emergingStone', 'water-pulse': 'waterPulse', 'fire-spin': 'fireSpin', 'air-slash': 'airSlash', 'seed-bomb': 'seedBomb'};
  await L(() => {window.__lab.game.setLoadout(0, []);window.__lab.startMatch();});
  await L(() => {document.getElementById('moves-drawer').hidden || document.getElementById('moves-close').click();});
  await openDrawer();
  const missing = [];
  for (const [id, group] of Object.entries(GROUPS)) {
    if (await page.locator(`[data-slot-move="0.0"] option[value="${id}"]`).count() !== 1) {missing.push(`slot:${id}`);continue;}
    await page.selectOption('[data-slot-move="0.0"]', id);
    if (!await L(g => !!document.querySelector(`#moves-panel [data-p="${g}.cost"]`), group)) missing.push(`slider:${id}`);
  }
  check('os 17 Moves novos aparecem nos slots e cada um tem seus sliders na aba Moves', missing.length === 0, missing.join(','));
  await L(() => document.getElementById('moves-close').click());
  // Lunge pelo teclado como jogador: vira um Tackle real marcado com o Move
  await L(() => {window.__lab.game.setLoadout(0, ['lunge', 'spikes']);window.__lab.startMatch();});
  await key('KeyA');
  await page.waitForFunction(() => window.__lab.game.fighters[0].action?.move === 'lunge' || window.__lab.game.fighters[0].moveCooldowns?.lunge > 0, null, {timeout: 30000});
  check('tecla A aciona o Lunge (ação de Tackle real com cooldown)', await L(() => (window.__lab.game.fighters[0].moveCooldowns?.lunge ?? 0) > 5));
  // Spikes: segurar abre o marcador (verde/vermelho) sem cobrar nada
  await L(() => {window.__lab.startMatch();});
  await page.locator('canvas').first().focus();await page.keyboard.down('KeyS');
  await page.waitForFunction(() => !!window.__lab.game.fighters[0].aim, null, {timeout: 30000});
  const aimOpen = await L(() => ({stamina: window.__lab.game.fighters[0].stamina, cooldown: window.__lab.game.fighters[0].moveCooldowns?.spikes ?? 0, ring: !!window.__lab.view.aimMarkers}));
  await page.keyboard.up('KeyS');
  check('segurar o botão do Spikes abre o marcador visível sem cobrar stamina nem recarga', aimOpen.ring && aimOpen.cooldown === 0 && aimOpen.stamina >= 2.99, JSON.stringify(aimOpen));

  // Desligar (tirar do slot): sem aura e sem custo
  await L(() => {window.__lab.game.setLoadout(0, []);window.__lab.startMatch();});
  await page.waitForTimeout(800);
  check('sem Moves equipados a aura é descartada (custo zero)', await L(() => window.__lab.view.statusAura === null));
  check('nenhuma requisição de rede e nenhum erro de console', requests.length === 0 && errors.length === 0, `${requests.length} req · ${errors.slice(0, 2).join(' | ')}`);
} finally {
  await browser.close();
}
console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exit(1);
