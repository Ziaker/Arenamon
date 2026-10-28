// Cor do lutador: automática (vermelho quando os dois usam o mesmo modelo) + azul/vermelho/amarelo/roxo
// aplicadas na prévia E no Character da partida, sem os dois lutadores compartilharem material.
// Uso: node test/character-colors.browser.mjs (com dist/ recompilado por npm run build:combat-lab).
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('..', import.meta.url));
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 920}}), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href);
  await page.waitForFunction(() => window.__lab?.quickMenu, null, {timeout: 60000});
  await page.waitForFunction(() => [...document.querySelectorAll('#quick-char-0 option')].some(o => /wookada/i.test(o.textContent)), null, {timeout: 30000});

  const id = await page.evaluate(() => [...document.querySelectorAll('#quick-char-0 option')].find(o => /wookada/i.test(o.textContent)).value);
  assert.ok(id, 'Wookada disponível no seletor');
  await page.evaluate(async id => {await window.__lab.quickMenu.selectCharacter(0, id);}, id);
  await page.waitForFunction(() => /wookada/i.test(window.__lab.ui.sources[0]?.name ?? ''), null, {timeout: 60000});
  await page.evaluate(async id => {await window.__lab.quickMenu.selectCharacter(1, id);}, id);
  await page.waitForFunction(() => /wookada/i.test(window.__lab.ui.sources[1]?.name ?? ''), null, {timeout: 60000});

  const auto = await page.evaluate(() => ({
    picks: [0, 1].map(s => window.__lab.quickMenu.colorPick(s)),
    effective: [0, 1].map(s => window.__lab.quickMenu.colorOf(s)),
    tint: [0, 1].map(s => window.__lab.ui.characters[s]?.tintHex ?? null),
    preview: [0, 1].map(s => window.__lab.quickMenu.previews[s]?.tint ?? null),
    selects: [0, 1].map(s => document.querySelector(`#quick-color-${s}`)?.value),
  }));
  assert.deepEqual(auto.picks, ['auto', 'auto'], 'padrão é automática nos dois');
  assert.deepEqual(auto.effective, [null, 'red'], 'mesmo modelo: só o segundo fica vermelho');
  assert.deepEqual(auto.tint, [null, '#ff4d47'], 'cor aplicada no Character do jogo');
  assert.deepEqual(auto.preview, [null, '#ff4d47'], 'cor aplicada na prévia');
  assert.deepEqual(auto.selects, ['auto', 'auto'], 'selects do menu acompanham o estado');

  const materials = await page.evaluate(() => {
    const mats = s => {const out = [];window.__lab.ui.characters[s].root.traverse(o => {if (o.isMesh) out.push(...[].concat(o.material));});return out;};
    const a = mats(0), b = mats(1), setA = new Set(a);
    const first = s => {let m = null;window.__lab.ui.characters[s].root.traverse(o => {if (!m && o.isMesh) m = [].concat(o.material)[0];});return m?.color.getHexString() ?? null;};
    return {shared: b.some(m => setA.has(m)), colors: [first(0), first(1)]};
  });
  assert.equal(materials.shared, false, 'lutadores não compartilham material (tingir um não tinge o outro)');
  assert.notEqual(materials.colors[0], materials.colors[1], 'cores diferentes entre os lutadores');

  const explicit = await page.evaluate(() => {
    const q = window.__lab.quickMenu;
    q.setColor(0, 'yellow');q.setColor(1, 'purple');
    return {effective: [q.colorOf(0), q.colorOf(1)], tint: [window.__lab.ui.characters[0].tintHex, window.__lab.ui.characters[1].tintHex], preview: [q.previews[0].tint, q.previews[1].tint], selects: [document.querySelector('#quick-color-0').value, document.querySelector('#quick-color-1').value], saved: q.collect().color};
  });
  assert.deepEqual(explicit.effective, ['yellow', 'purple'], 'escolha explícita vence a automática');
  assert.deepEqual(explicit.tint, ['#ffd23f', '#a45cff'], 'cores explícitas no Character');
  assert.deepEqual(explicit.preview, ['#ffd23f', '#a45cff'], 'cores explícitas na prévia');
  assert.deepEqual(explicit.selects, ['yellow', 'purple'], 'selects refletem a escolha');
  assert.deepEqual(explicit.saved, ['yellow', 'purple'], 'cor entra na persistência do workspace');

  const restored = await page.evaluate(() => {
    const q = window.__lab.quickMenu, saved = q.collect();
    q.setColor(0, 'auto');q.setColor(1, 'auto');
    q.apply(saved);
    return {effective: [q.colorOf(0), q.colorOf(1)], selects: [document.querySelector('#quick-color-0').value, document.querySelector('#quick-color-1').value]};
  });
  assert.deepEqual(restored.effective, ['yellow', 'purple'], 'apply() restaura as cores salvas');
  assert.deepEqual(restored.selects, ['yellow', 'purple'], 'selects restaurados junto');

  const styled = await page.evaluate(() => {window.__lab.menuStyles.setStyle('a');return document.querySelectorAll('#menu-styled .qs-color').length;});
  assert.equal(styled, 10, '5 cores visíveis em cada lutador nas telas A/B/C');
  await page.locator('#menu-styled .qs-fighter[data-fighter="0"] .qs-color[data-id="blue"]').click();
  await page.waitForFunction(() => window.__lab.quickMenu.colorPick(0) === 'blue');
  const clicked = await page.evaluate(() => ({
    pick: window.__lab.quickMenu.colorPick(0),
    pressed: document.querySelector('#menu-styled .qs-fighter[data-fighter="0"] .qs-color[data-id="blue"]')?.getAttribute('aria-pressed'),
    tint: window.__lab.ui.characters[0].tintHex,
  }));
  assert.equal(clicked.pick, 'blue', 'clique na tela estilizada troca a cor');
  assert.equal(clicked.pressed, 'true', 'botão da cor fica marcado');
  assert.equal(clicked.tint, '#3f7cff', 'cor do clique chega ao Character');
  await page.evaluate(() => window.__lab.menuStyles.setStyle('none'));

  const restoreBase = await page.evaluate(() => {
    const ch = window.__lab.ui.characters[0];
    const first = () => {let m = null;ch.root.traverse(o => {if (!m && o.isMesh) m = [].concat(o.material)[0];});return m?.color.getHexString() ?? null;};
    ch.setTint(null);const base = first();   // cor original do GLB (o menu pode estar com cor aplicada)
    ch.setTint('#3f7cff');const tinted = first();
    ch.setTint(null);const back = first();
    return {base, tinted, back};
  });
  assert.notEqual(restoreBase.tinted, restoreBase.base, 'setTint muda a cor do material');
  assert.equal(restoreBase.back, restoreBase.base, 'setTint(null) devolve a cor original');

  assert.deepEqual(errors, [], 'Sem erros de página');
  console.log('ok: automática vermelha no mesmo modelo, 4 cores explícitas na prévia/jogo, materiais separados e persistência');
} finally {
  await browser.close();
}
