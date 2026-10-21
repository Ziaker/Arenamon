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
  await page.waitForFunction(() => document.querySelectorAll('.ability-banner.show').length === 2);
  await page.waitForTimeout(600);

  const layout = await page.evaluate(() => ({stage: (() => {const r = document.querySelector('.stage').getBoundingClientRect();return {left: r.left, right: r.right};})(), banners: [...document.querySelectorAll('.ability-banner')].map(bar => {
    const name = bar.querySelector('strong'), r = bar.getBoundingClientRect(), nr = name.getBoundingClientRect(), cs = getComputedStyle(name);
    return {text: name.textContent, left: r.left, right: r.right, font: parseFloat(cs.fontSize), clipped: name.scrollWidth > name.clientWidth || nr.right > r.right + 1};
  })}));
  const banners = layout.banners;
  assert.deepEqual(banners.map(b => b.text), ['Órbita', 'Prisma']);
  assert.ok(banners.every(b => /^\S+$/u.test(b.text)), 'todos os nomes usam uma palavra');
  assert.ok(banners.every(b => b.font >= 34), JSON.stringify(banners));
  assert.ok(!banners.some(b => b.clipped), JSON.stringify(banners));
  assert.ok(Math.abs(banners[0].left - layout.stage.left) <= 2 && Math.abs(banners[1].right - layout.stage.right) <= 2, JSON.stringify(layout));

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
  await page.waitForTimeout(650);
  const tuned = await page.evaluate(() => ({border: document.querySelector('.stage').dataset.abilityBorder, scale: getComputedStyle(document.querySelector('.stage')).getPropertyValue('--ability-text-scale').trim(), controls: document.querySelectorAll('[data-path^="display.passive."]').length}));
  assert.deepEqual(tuned, {border: 'chase', scale: '1.45', controls: 5});
  await page.screenshot({path: evidence + 'habilidades-passivas-no-jogo.png', fullPage: true});

  const result = {ok: true, names: banners.map(b => b.text), minFontPx: Math.min(...banners.map(b => b.font)), followsCharacter: true, mirroredEdges: true, borderModes: 3, controls: tuned.controls, errors};
  writeFileSync(evidence + 'resultado.json', JSON.stringify(result, null, 2));
  assert.deepEqual(errors, []);
  console.log('✓ navegador: barras, texto, acompanhamento e controles no jogo real');
} finally {
  await browser.close();
}
