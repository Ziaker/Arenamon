// @ts-check
// Navegador (Playwright, file:// offline): HUD "Banco de Células", cenário "Laboratório técnico" e consumíveis "Gemas Facetadas" DENTRO
// do jogo principal, com a alternância para o visual clássico e os sliders de cenário. Só apresentação: a simulação não é tocada.
// Usa WebGL por software (SwiftShader): não mede desempenho de GPU real. Grava capturas em evidence/progress-scenery/.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const url = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const evid = root + 'evidence/progress-scenery/';
mkdirSync(evid, {recursive: true});
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {ok ? passed++ : failed++;(ok ? console.log : console.error)(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);};
const TYPES = ['heal_hp', 'heal_stamina', 'buff_attack', 'buff_defense', 'buff_stamina_max', 'buff_cooldown', 'buff_speed'];
const EXPECT = {attack: s => `+${10 * s}%`, defense: s => `−${10 * s} p.p.`, stamina: s => `+${s}`, cooldown: s => `−${10 * s}%`, speed: s => `+${5 * s}%`};

console.log('\n--- NAVEGADOR: HUD de progressão, cenário e consumíveis no jogo ---\n');
const browser = await chromium.launch({...BROWSER, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']});
try {
  const ctx = await browser.newContext({viewport: {width: 1500, height: 920}});
  await ctx.setOffline(true);
  const page = await ctx.newPage();
  const errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('request', r => {if (/^https?:/.test(r.url())) external.push(r.url());});
  await page.goto(url);
  await page.waitForFunction(() => window.__lab?.game && window.__lab?.view, null, {timeout: 60000});
  await page.waitForTimeout(800);
  await page.click('#start');
  await page.waitForFunction(() => window.__lab.game.phase === 'playing', null, {timeout: 30000});
  const L = fn => page.evaluate(fn);
  const frames = async n => {const f = await L(() => window.__lab.ui.frame);await page.waitForFunction(t => window.__lab.ui.frame > t, f + n, {timeout: 120000});};
  const commit = (path, v) => page.evaluate(([p, x]) => window.__lab.tuning.commit([[p, x]], 'teste'), [path, v]);
  await frames(6);

  // ---- 1. HUD de progressão ----
  const hud = async () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#progress-hud .pg-bank[data-fighter="0"] .pg-cell')].map(c => [c.dataset.attr, {val: c.querySelector('.pg-val').textContent, on: c.querySelectorAll('.pg-seg.on').length, count: c.querySelector('small').textContent, max: c.classList.contains('max')}])));
  check('HUD visível com 5 células (jogador)', await L(() => !document.getElementById('progress-hud').hidden && document.querySelectorAll('#progress-hud .pg-bank[data-fighter="0"] .pg-cell').length === 5));
  check('selos clássicos do cabeçalho saem de cena', await L(() => getComputedStyle(document.getElementById('stages0')).display === 'none'));
  for (let s = 0; s <= 4; s++) {
    await page.evaluate(n => {window.__lab.game.fighters[0].stages = {attack: n, defense: n, staminaMax: n, cooldown: n, speed: n};}, s);
    await frames(2);
    const h = await hud();
    const ok = Object.keys(EXPECT).every(k => h[k].val === EXPECT[k](s) && h[k].on === s && h[k].count === (s === 4 ? 'MAX' : `${s}/4`) && h[k].max === (s === 4));
    check(`estágio ${s}: valores, segmentos e ${s === 4 ? '"MAX"' : 'n/4'} corretos nos 5 atributos`, ok, JSON.stringify(h.attack));
  }
  await page.evaluate(() => {window.__lab.game.fighters[0].stages = {attack: 3, defense: 2, staminaMax: 1, cooldown: 4, speed: 0};});
  await commit('map.stageAttackBonus', .2);await frames(2);
  check('o HUD acompanha o slider de Mapa › Progressão (ataque 3 × 20% = +60%)', (await hud()).attack.val === '+60%');
  await commit('map.stageAttackBonus', .1);
  check('padrão: HUD horizontal compacto, um banco para cada lutador', await L(() => document.getElementById('progress-hud').dataset.layout === 'h' && document.querySelectorAll('#progress-hud .pg-bank').length === 2));
  const hh = await L(() => Math.round(document.querySelector('#progress-hud .pg-bank[data-fighter="0"]').getBoundingClientRect().height));
  check('HUD horizontal é compacto (altura do banco ≤ 70 px)', hh <= 70, hh + ' px');
  const sizeOf = id => page.evaluate(i => {const r = document.querySelector(`#progress-hud .pg-bank[data-fighter="${i}"]`).getBoundingClientRect();return Math.round(r.width);}, id);
  const w0 = await sizeOf(0), w1 = await sizeOf(1);
  await commit('display.progress.pgScaleEnemy', .6);await frames(2);
  const w1b = await sizeOf(1), w0b = await sizeOf(0);
  check('tamanho do adversário é independente do jogador', w1b < w1 * .7 && Math.abs(w0b - w0) <= 1, `${w1}→${w1b} · jogador ${w0}→${w0b}`);
  await commit('display.progress.pgScaleEnemy', 1);
  await commit('display.progress.pgScale', 1.5);await frames(2);
  check('tamanho do jogador', (await sizeOf(0)) >= w0 * 1.4);
  await commit('display.progress.pgScale', 1);
  await commit('display.progress.pgLayout', 0);await frames(2);
  check('disposição vertical: cantos inferiores', await L(() => document.getElementById('progress-hud').dataset.layout === 'v' && document.querySelectorAll('#progress-hud .pg-cell').length === 10));
  check('vertical continua mostrando os valores (estágios do jogador)', (await hud()).attack.val === '+30%');
  await page.screenshot({path: evid + 'hud-vertical-1500x920.png'});
  await commit('display.progress.pgLayout', 1);await frames(2);
  await commit('display.progress.pgSubject', 0);await frames(2);
  check('"só o jogador": um banco', await L(() => document.querySelectorAll('#progress-hud .pg-bank').length === 1));
  await commit('display.progress.pgSubject', 1);await frames(2);
  check('"só o adversário": banco do lutador 1', await L(() => document.querySelectorAll('#progress-hud .pg-bank[data-fighter="1"]').length === 1 && document.querySelectorAll('#progress-hud .pg-bank').length === 1));
  await commit('display.progress.pgSubject', 2);await frames(2);

  // ---- 2. consumíveis: 7 tipos como gemas ----
  await page.evaluate(types => {
    const g = window.__lab.game, p = g.fighters[0].position, ms = g.world.mapState;
    ms.items.length = 0;
    types.forEach((t, i) => ms.items.push({id: 9000 + i, type: t, pos: {x: p.x + (i - 3) * 2.2, y: 0, z: p.z + 4}, life: 999, isDrop: false, vy: 0}));
  }, TYPES);
  await frames(8);
  const gems = () => page.evaluate(() => [...window.__lab.view.worldView.gems].map(g => ({id: g.type.id, sim: g.simType, sprite: g.sprite.visible, ped: g.ped.visible, sc: g.holder.scale.x, y: g.outer.position.y})));
  let gm = await gems();
  check('os 7 tipos da simulação viram 7 gemas distintas', gm.length === 7 && new Set(gm.map(g => g.id)).size === 7, gm.map(g => g.id).join(','));
  check('indicador flutuante e pedestal ligados por padrão', gm.every(g => g.sprite && g.ped));
  check('centelhas three.quarks: um emissor por gema', await L(() => window.__lab.view.worldView.gemSparkles.live.size === 7));
  await frames(40);
  check('as centelhas nascem (partículas vivas)', await L(() => Math.max(...[...window.__lab.view.worldView.gemSparkles.live.values()].map(e => e.system.particleNum)) > 0));
  await page.screenshot({path: evid + 'jogo-padrao-1500x920.png'});
  await commit('display.consumables.gemScale', 1.5);await commit('display.consumables.gemHover', 1.4);await commit('display.consumables.gemIndicators', 0);await commit('display.consumables.gemPedestal', 0);await frames(3);
  gm = await gems();
  check('sliders das gemas: escala, altura, indicador e pedestal', gm.every(g => Math.abs(g.sc - 1.5) < 1e-6 && g.y > 1.2 && !g.sprite && !g.ped), JSON.stringify(gm[0]));
  for (const [k, v] of [['gemScale', 1], ['gemHover', .9], ['gemIndicators', 1], ['gemPedestal', 1]]) await commit('display.consumables.' + k, v);
  await commit('display.consumables.gemParticles', 0);await frames(3);
  check('centelhas desligáveis', await L(() => window.__lab.view.worldView.gemSparkles.live.size === 0));
  await commit('display.consumables.gemParticles', 1);await frames(3);
  const snap = () => page.evaluate(() => Object.fromEntries(window.__lab.game.world.mapState.items.map(i => [i.id, [i.type, i.pos.x, i.pos.y, i.pos.z].join()])));
  const sim0 = await snap();

  // ---- 3. cenário do laboratório e volta ao clássico ----
  const sc = () => page.evaluate(() => {const v = window.__lab.view;return {lab: v.scenery.group.visible, grid: v.grid.visible, ring: v.circleRing.visible, key: v.scenery.key, floorScale: v.scenery.floor.scale.x, blocks: v.scenery.blocks?.count ?? 0, bg: v.scene.background.getHex()};});
  let s = await sc();
  const radius = await L(() => window.__lab.C.map.arenaRadius);
  check('cenário do laboratório ligado: grid e anel clássicos saem', s.lab && !s.grid && !s.ring);
  check('piso do laboratório acompanha o raio da arena', Math.abs(s.floorScale - radius) < 1e-6, `${s.floorScale} × ${radius}`);
  check('anel de blocos presente', s.blocks >= 18, String(s.blocks));
  const key0 = s.key, bg0 = s.bg;
  await commit('extras.colors.floorR', 200);await frames(2);s = await sc();
  check('slider de cor do piso redesenha a textura', s.key !== key0);
  await commit('extras.colors.floorR', 96);
  await commit('extras.colors.backgroundR', 120);await frames(2);s = await sc();
  check('slider de cor do fundo muda o fundo do cenário', s.bg !== bg0);
  await commit('extras.colors.backgroundR', 32);
  await commit('map.arenaRadius', 20);await frames(3);s = await sc();
  check('slider do raio da arena redimensiona piso e anel de blocos', Math.abs(s.floorScale - 20) < 1e-6 && s.blocks > 0 && s.blocks < 100, `${s.floorScale} · ${s.blocks}`);
  await commit('map.arenaRadius', radius);await frames(2);
  await commit('extras.visual.gridDivisions', 20);await frames(2);
  check('divisões do grid mudam o espaçamento da régua', (await sc()).key !== key0);
  await commit('extras.visual.gridDivisions', 32);await frames(2);
  await commit('display.scenery.labBlocks', 0);await commit('display.scenery.labProps', 0);await frames(2);
  check('blocos e prismas desligáveis', await L(() => !window.__lab.view.scenery.blocks.visible && !window.__lab.view.scenery.props.visible));
  await commit('display.scenery.labBlocks', 1);await commit('display.scenery.labProps', 1);
  await commit('display.scenery.labTheme', 0);await frames(4);
  s = await sc();
  check('toggle do cenário: volta ao visual clássico (piso, grid e anel originais)', !s.lab && s.grid && s.ring);
  await page.screenshot({path: evid + 'cenario-classico-1500x920.png'});
  await commit('display.scenery.labTheme', 1);await frames(4);
  s = await sc();
  check('toggle do cenário: laboratório de volta', s.lab && !s.grid);

  // ---- 4. volta aos consumíveis clássicos (a IA pode coletar itens durante o teste: compara com os itens que ainda existem) ----
  await commit('display.consumables.gemStyle', 0);await frames(6);
  const classic = await L(() => {const w = window.__lab.view.worldView, n = window.__lab.game.world.mapState.items.length;return {n, gems: w.gems.size, spark: w.gemSparkles.live.size, classic: [...w.mapMeshes.values()].filter(m => m.userData.consStyle === 0).length, gemMeshes: [...w.mapMeshes.values()].filter(m => m.userData.consStyle === 1).length};});
  check('estilo 0: formas clássicas, sem gemas nem centelhas', classic.n >= 1 && classic.gems === 0 && classic.spark === 0 && classic.gemMeshes === 0 && classic.classic === classic.n, JSON.stringify(classic));
  await page.screenshot({path: evid + 'itens-classicos-1500x920.png'});
  await commit('display.consumables.gemStyle', 1);await frames(6);
  const back = await L(() => {const w = window.__lab.view.worldView, n = window.__lab.game.world.mapState.items.length;return {n, gems: w.gems.size, classic: [...w.mapMeshes.values()].filter(m => m.userData.consStyle === 0).length};});
  check('estilo 1: gemas de volta (uma por item da simulação)', back.n >= 1 && back.gems === back.n && back.classic === 0, JSON.stringify(back));
  const sim1 = await snap();
  check('a simulação dos itens não foi tocada (mesmos tipos e posições dos itens que continuam)', Object.entries(sim1).every(([id, v]) => !(id in sim0) || sim0[id] === v));

  // ---- 5. HUD desligável (selos clássicos voltam) e capturas ----
  await commit('display.progress.pgEnabled', 0);await frames(3);
  check('HUD desligado: some e os selos clássicos voltam', await L(() => document.getElementById('progress-hud').hidden && getComputedStyle(document.getElementById('stages0')).display !== 'none'));
  await commit('display.progress.pgEnabled', 1);await frames(3);
  await page.setViewportSize({width: 1280, height: 720});await frames(4);
  await page.screenshot({path: evid + 'jogo-padrao-1280x720.png'});
  await page.setViewportSize({width: 1920, height: 1080});await frames(4);
  await page.screenshot({path: evid + 'jogo-padrao-1920x1080.png'});

  check('sem erros de JavaScript/console', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('sem requisições externas (offline)', external.length === 0, external.slice(0, 2).join(' | '));
} finally {
  await browser.close();
}
console.log(`\n${passed} verificações ok · ${failed} falhas`);
process.exit(failed ? 1 : 0);
