import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync, writeFileSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = root + 'evidence/collision-regression/';
mkdirSync(out, {recursive: true});
const browser = await chromium.launch({channel: process.env.ARENAMON_BROWSER || 'msedge', headless: true});
const report = {date: new Date().toISOString(), checks: []};
const check = (label, ok, detail) => {
  report.checks.push({label, ok: !!ok, detail});
  console.log(`${ok ? '✓' : '✗'} ${label} — ${detail}`);
  assert.ok(ok, `${label}: ${detail}`);
};

try {
  const page = await browser.newPage({viewport: {width: 1500, height: 920}});
  const errors = [], network = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  page.on('request', request => {if (/^https?:/.test(request.url())) network.push(request.url());});
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href);
  await page.waitForFunction(() => window.__lab);
  await page.click('#start-center');
  const values = await page.evaluate(() => {
    const lab = window.__lab, fighter = lab.game.fighters[0];
    const platform = lab.game.mapState.platforms.find(p => (p.height ?? 0) >= 1) ?? lab.game.mapState.platforms[0];
    lab.togglePause(true);
    fighter.position = {x: platform.pos.x, z: platform.pos.z};
    fighter.groundY = (platform.pos.y ?? 0) + platform.height;
    fighter.flight = null;fighter.vaultHeight = 0;
    lab.view.overlays.hurtboxes = true;
    lab.view.reset(fighter);
    lab.view.drawOverlays(lab.game.fighters, 0);
    const bodyHeight = lab.C.extras.visual.bodyHeight;
    const hitbox = lab.view.overlayGroup.children.find(object => object.isMesh && object.material?.wireframe && Math.abs((object.geometry.parameters?.height ?? 0) - bodyHeight) < 1e-6);
    document.getElementById('panel').hidden = true;
    return {
      groundY: fighter.groundY,
      bodyHeight,
      hitboxY: hitbox?.position.y ?? null,
      expectedY: fighter.groundY + bodyHeight / 2,
      fighterX: fighter.position.x,
      fighterZ: fighter.position.z,
      platformHeight: platform.height,
    };
  });
  check('hitbox acompanha a plataforma', Math.abs(values.hitboxY - values.expectedY) < 1e-8, JSON.stringify(values));
  await page.waitForTimeout(120);
  await page.screenshot({path: out + 'hitbox-sobre-plataforma.png'});
  check('execução offline sem erros', network.length === 0 && errors.length === 0, [...network, ...errors].join(' | ') || 'sem erros');
} finally {
  writeFileSync(out + 'resultado.json', JSON.stringify(report, null, 2));
  await browser.close();
}
