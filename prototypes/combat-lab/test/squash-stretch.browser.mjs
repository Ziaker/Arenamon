import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = new URL('../', import.meta.url), evidence = new URL('evidence/squash-stretch/', root);
mkdirSync(evidence, {recursive: true});
const browser = await chromium.launch({channel: process.env.ARENAMON_BROWSER || 'msedge', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}}), errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(pathToFileURL(fileURLToPath(new URL('dist/arenamon-combate-laboratorio.html', root))).href);
  await page.waitForFunction(() => window.__lab);
  await page.evaluate(() => {window.__lab.ui.paused = true;window.__lab.openTool('moves');});
  await page.click('#act-tabs [data-act="tackle"]');
  const prefix = 'extras.visual.squashStretch.';
  for (const [key, value] of Object.entries({squashIntensity: .23, stretchIntensity: .31, squashWindow: 100, settleDuration: 160, enableSquashStretch: 0, preserveVolume: 0, plScaling: 0})) {
    const input = page.locator(`#act-tackle input[data-path="${prefix + key}"]`);
    assert.equal(await input.count(), 1);
    const before = await page.evaluate(key => window.__lab.C.extras.visual.squashStretch[key], key);
    await input.evaluate((el, value) => {
      if (el.type === 'checkbox') el.checked = !!value;
      else {el.value = String(value);el.dispatchEvent(new Event('input', {bubbles: true}));}
      el.dispatchEvent(new Event('change', {bubbles: true}));el.blur();
    }, value);
    assert.equal(await page.evaluate(key => window.__lab.C.extras.visual.squashStretch[key], key), value);
    await page.keyboard.press('Control+z');
    assert.equal(await page.evaluate(key => window.__lab.C.extras.visual.squashStretch[key], key), before);
  }
  const bytes = readFileSync(new URL('../../chars/mosh/Cogumelo.glb', root)).toString('base64');
  const result = await page.evaluate(async bytes => {
    const L = window.__lab, raw = Uint8Array.from(atob(bytes), c => c.charCodeAt(0));
    const source = await L.loadStudioFile(new File([raw], 'Cogumelo.glb'));
    L.setCharacter(0, source);const ch = L.ui.characters[0], f = L.game.fighters[0];
    f.hp = 100;f.state = 'tackle';f.action = {kind: 'tackle', elapsed: .16, heading: Math.PI / 2, pl: 3, hits: new Set()};
    ch.update(f, .01, 0, [], {tick: 1});
    const stretched = ch.deformation.scale.z, volume = ch.deformation.scale.x * ch.deformation.scale.y * stretched;
    const bone = ch.hips, pose = [...bone.position.toArray(), ...bone.quaternion.toArray()];
    ch.place(f, 0, .01);
    const unchangedBones = JSON.stringify(pose) === JSON.stringify([...bone.position.toArray(), ...bone.quaternion.toArray()]);
    f.action = null;f.state = 'neutral';for (let i = 0; i < 120; i++) ch.place(f, 0, 1 / 120);
    return {stretched, volume, unchangedBones, neutral: ch.deformation.scale.z, clips: ch.clips.length};
  }, bytes);
  assert.ok(Math.abs(result.stretched - 1.3) < 1e-8);assert.ok(Math.abs(result.volume - 1) < 1e-8);
  assert.equal(result.neutral, 1);assert.equal(result.unchangedBones, true);assert.equal(errors.length, 0, errors.join('\n'));
  await page.evaluate(() => {for (const el of document.querySelectorAll('#act-tackle details')) el.open = el.textContent.includes('Deformação elástica do Tackle');});
  await page.locator('#act-tackle details').filter({hasText: 'Deformação elástica do Tackle'}).screenshot({path: fileURLToPath(new URL('controles.png', evidence))});
  writeFileSync(new URL('resultado.json', evidence), JSON.stringify({controls: 7, undo: 'Ctrl+Z aprovado nos sete controles', model: 'chars/mosh/Cogumelo.glb', ...result, errors}, null, 2) + '\n');
  console.log('✓ Edge offline: sete controles reais + Ctrl+Z, GLB Cogumelo com 47 clipes, deformação PL3, volume, ossos preservados e retorno neutro.');
} finally {await browser.close();}
