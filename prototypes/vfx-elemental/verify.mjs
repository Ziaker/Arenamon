import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('.', import.meta.url));
const browser = await chromium.launch({channel: 'msedge', headless: true});

try {
  const page = await browser.newPage({viewport: {width: 1440, height: 920}});
  const errors = [];
  const external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (r) => {
    if (/^https?:/.test(r.url())) external.push(r.url());
  });

  await page.context().setOffline(true);
  await page.goto(pathToFileURL(root + 'dist/vfx-elemental-psiquico.html').href);
  await page.waitForFunction(() => window.__ARENAMON_VFX_ELEMENTAL__?.stages?.length === 3);

  await mkdir(root + 'evidence', {recursive: true});

  // --- ABA 3 (Ativa por padrão): FOGO (Pilares, Rajadas, Explosões, Aura & Brasas) ---
  await page.waitForTimeout(220);
  const pillarMeshes = await page.evaluate(() =>
    window.__ARENAMON_VFX_ELEMENTAL__.stages.map((s) => s.activeMeshCount)
  );
  assert.ok(pillarMeshes.every((n) => n > 10), 'Todas as 3 opções devem animar malhas 3D em Pilares de Fogo');
  await page.screenshot({path: root + 'evidence/fogo-pilar-3opcoes.png'});

  await page.click('#tab-fireball');
  await page.waitForTimeout(200);
  const fireballMeshes = await page.evaluate(() =>
    window.__ARENAMON_VFX_ELEMENTAL__.stages.map((s) => s.activeMeshCount)
  );
  assert.ok(fireballMeshes.every((n) => n > 10), 'Todas as 3 opções devem animar malhas 3D em Rajadas & Bolas de Fogo');
  await page.screenshot({path: root + 'evidence/fogo-fireball-3opcoes.png'});

  await page.click('#tab-explosion');
  await page.waitForTimeout(200);
  const explosionMeshes = await page.evaluate(() =>
    window.__ARENAMON_VFX_ELEMENTAL__.stages.map((s) => s.activeMeshCount)
  );
  assert.ok(explosionMeshes.every((n) => n > 10), 'Todas as 3 opções devem animar malhas 3D em Explosões & Erupções');
  await page.screenshot({path: root + 'evidence/fogo-explosao-3opcoes.png'});

  await page.click('#tab-emberaura');
  await page.waitForTimeout(200);
  const emberAuraMeshes = await page.evaluate(() =>
    window.__ARENAMON_VFX_ELEMENTAL__.stages.map((s) => s.activeMeshCount)
  );
  assert.ok(emberAuraMeshes.every((n) => n > 10), 'Todas as 3 opções devem animar malhas 3D em Aura & Brasas');
  await page.screenshot({path: root + 'evidence/fogo-aura-3opcoes.png'});

  // Testa Sliders de Opacidade Total e Redução durante a Duração na aba Fogo
  await page.fill('#sl-0-opacity', '0.7');
  await page.dispatchEvent('#sl-0-opacity', 'input');
  await page.fill('#sl-0-fadeStart', '0.35');
  await page.dispatchEvent('#sl-0-fadeStart', 'input');
  await page.fill('#sl-0-fadeEnd', '0.85');
  await page.dispatchEvent('#sl-0-fadeEnd', 'input');

  const fireExport = await page.evaluate(() => {
    const fn = window.__ARENAMON_VFX_ELEMENTAL__.computeDurationOpacity;
    const p = window.__ARENAMON_VFX_ELEMENTAL__.STATE.elements.fire.emberaura[0];
    const payload = window.__ARENAMON_VFX_ELEMENTAL__.generateExportPayload();
    return {
      opacity: p.opacity,
      fadeStart: p.fadeStart,
      fadeEnd: p.fadeEnd,
      opStart: fn(p, 0.15),
      opMid: fn(p, 0.6),
      opEnd: fn(p, 0.92),
      schema: payload.schema,
      activeElement: payload.activeElement,
    };
  });

  assert.equal(fireExport.opacity, 0.7);
  assert.equal(fireExport.fadeStart, 0.35);
  assert.equal(fireExport.fadeEnd, 0.85);
  assert.ok(fireExport.opStart > fireExport.opMid && fireExport.opMid > fireExport.opEnd);
  assert.equal(fireExport.activeElement, 'fire');
  assert.equal(fireExport.schema, 'arenamon-vfx-elemental-v3');

  // --- ABA 2: VOADOR (Garante que continua 100% funcional) ---
  await page.click('#el-tab-flying');
  await page.waitForTimeout(180);
  const tornadoMeshes = await page.evaluate(() =>
    window.__ARENAMON_VFX_ELEMENTAL__.stages.map((s) => s.activeMeshCount)
  );
  assert.ok(tornadoMeshes.every((n) => n > 10), 'Aba Voador continua animando todas as 3 opções');

  // --- ABA 1: PSÍQUICO (Garante que continua 100% funcional) ---
  await page.click('#el-tab-psychic');
  await page.waitForTimeout(180);
  const summonMeshes = await page.evaluate(() =>
    window.__ARENAMON_VFX_ELEMENTAL__.stages.map((s) => s.activeMeshCount)
  );
  assert.ok(summonMeshes.every((n) => n > 5), 'Aba Psíquico continua animando todas as 3 opções');

  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);

  await writeFile(
    root + 'evidence/relatorio-verificacao.json',
    JSON.stringify(
      {
        offline: true,
        fire: { pillarMeshes, fireballMeshes, explosionMeshes, emberAuraMeshes, opacityTest: fireExport },
        flying: { tornadoMeshes },
        psychic: { summonMeshes },
        errors,
        external,
      },
      null,
      2
    )
  );
  console.log('PASS: Studio VFX 3D (Abas Fogo, Voador e Psíquico, 3 opções animadas, sliders de opacidade/duração e exportador JSON) verificado sem erros.');
} finally {
  await browser.close();
}
