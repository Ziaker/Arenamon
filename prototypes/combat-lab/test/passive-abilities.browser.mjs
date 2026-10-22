import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {mkdirSync, writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const {chromium} = require('@playwright/test');
const root = fileURLToPath(new URL('..', import.meta.url));
const evidence = fileURLToPath(new URL('../evidence/passive-abilities/', import.meta.url));
mkdirSync(evidence, {recursive: true});
const browser = await chromium.launch({channel: process.env.ARENAMON_BROWSER || 'msedge', headless: true});
const page = await browser.newPage({viewport: {width: 1600, height: 920}});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});

try {
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href);
  await page.waitForFunction(() => window.__lab);
  await page.click('#start-center');
  await page.evaluate(() => {window.__lab.view.previewPassive(0, 0);window.__lab.view.previewPassive(1, 1);});
  await page.waitForFunction(() => document.querySelectorAll('.ability-banner.show').length === 2);
  await page.waitForFunction(() => [...document.querySelectorAll('.ability-banner.show')].every(bar => getComputedStyle(bar).transform === 'none'));

  const layout = await page.evaluate(() => ({oldSystem: !!document.getElementById('ability-notices'), stage: (() => {const r = document.querySelector('.stage').getBoundingClientRect();return {left: r.left, top: r.top, right: r.right, width: r.width, height: r.height};})(), banners: [...document.querySelectorAll('.ability-banner')].map(bar => {
    const prefix = bar.querySelector('span'), name = bar.querySelector('strong'), r = bar.getBoundingClientRect(), nr = name.getBoundingClientRect(), cs = getComputedStyle(name);
    return {text: name.textContent, prefixFont: parseFloat(getComputedStyle(prefix).fontSize), top: r.top, left: r.left, right: r.right, width: r.width, height: r.height, font: parseFloat(cs.fontSize), clipped: name.scrollWidth > name.clientWidth || nr.right > r.right + 1};
  })}));
  const banners = layout.banners;
  assert.equal(layout.oldSystem, false, 'o sistema antigo foi removido do DOM');
  assert.deepEqual(banners.map(b => b.text), ['Órbita', 'Prisma']);
  assert.ok(banners.every(b => /^\S+$/u.test(b.text)), 'todos os nomes usam uma palavra');
  assert.ok(banners.every(b => b.font >= 15), JSON.stringify(banners));
  assert.ok(banners.every(b => b.prefixFont >= 10), JSON.stringify(banners));
  assert.ok(!banners.some(b => b.clipped), JSON.stringify(banners));
  assert.ok(Math.abs(banners[0].left - layout.stage.left) <= 2 && Math.abs(banners[1].right - layout.stage.right) <= 2, JSON.stringify(layout));
  assert.ok(banners.every(b => b.width >= 210 && b.width <= 270 && b.height === 46), JSON.stringify(banners));
  assert.ok(banners.every(b => Math.abs(b.top - (layout.stage.top + layout.stage.height * .34)) <= 2), JSON.stringify(layout));
  const occupied = banners.reduce((sum, b) => sum + b.width * b.height, 0) / (layout.stage.width * layout.stage.height);
  assert.ok(occupied <= .1, `as duas notificações ocupam ${(occupied * 100).toFixed(2)}% da área visível`);

  const following = await page.evaluate(async () => {
    window.__lab.togglePause(true);
    const fighter = window.__lab.game.fighters[0], fx = window.__lab.view.passives.fighters[0];
    fighter.position.x = 6.75;fighter.position.z = -3.25;fighter.visualFacing = 1.35;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {fighter: {...fighter.position, facing: fighter.visualFacing}, effect: {x: fx.root.position.x, y: fx.root.position.y, z: fx.root.position.z, facing: fx.root.rotation.y}, age: fx.age};
  });
  assert.equal(following.effect.x, following.fighter.x);
  assert.equal(following.effect.z, following.fighter.z);
  assert.equal(following.effect.facing, following.fighter.facing);

  await page.evaluate(() => {
    window.__lab.tuning.commit([['display.passive.borderMotion', 2], ['display.passive.textScale', 1.45]], 'teste passivas');
    window.__lab.togglePause(false);
    window.__lab.view.previewPassive(0, 2);window.__lab.view.previewPassive(1, 2);
  });
  await page.waitForFunction(() => document.querySelector('.stage').dataset.abilityBorder === 'chase');
  await page.waitForTimeout(220);
  const tuned = await page.evaluate(() => ({border: document.querySelector('.stage').dataset.abilityBorder, scale: getComputedStyle(document.querySelector('.stage')).getPropertyValue('--ability-text-scale').trim(), controls: document.querySelectorAll('[data-path^="display.passive."]').length, names: [...document.querySelectorAll('.ability-banner strong')].map(name => ({text: name.textContent, scroll: name.scrollWidth, client: name.clientWidth})), sparkles: window.__lab.view.passives.fighters.map(fx => ({active: fx.active, count: fx.particles.filter(p => p.visible).length, white: fx.particles.every(p => p.material.color.getHex() === 0xffffff)}))}));
  assert.equal(tuned.border, 'chase');assert.equal(tuned.scale, '1.45');assert.equal(tuned.controls, 5);
  assert.ok(tuned.names.every(name => name.scroll <= name.client), JSON.stringify(tuned.names));
  assert.ok(tuned.sparkles.every(fx => fx.active && fx.count === 28 && fx.white), JSON.stringify(tuned.sparkles));
  await page.screenshot({path: evidence + 'habilidades-passivas-no-jogo.png', fullPage: true});
  await page.waitForTimeout(360);
  assert.ok(await page.evaluate(() => window.__lab.view.passives.fighters.every(fx => !fx.active)), 'sparkles encerram após 0,5 s');

  const result = {ok: true, names: banners.map(b => b.text), minFontPx: Math.min(...banners.map(b => b.font)), bannerPx: {minWidth: 210, maxWidth: 270, height: 46}, position: 'top 34%, extrema esquerda/direita', occupiedArenaPct: +(occupied * 100).toFixed(2), fullNameAtScale145: tuned.names.every(name => name.scroll <= name.client), sparkleColor: '#ffffff', sparkleDurationSeconds: .5, sparkleCountPerFighter: 28, followsCharacter: true, mirroredEdges: true, borderModes: 3, controls: tuned.controls, errors};
  writeFileSync(evidence + 'resultado.json', JSON.stringify(result, null, 2));
  assert.deepEqual(errors, []);
  console.log('✓ navegador: barras, texto, acompanhamento e controles no jogo real');
} finally {
  await browser.close();
}
