// Biblioteca de animações CC0 no Studio real (Edge, offline): cartão em Projeto, manequim pela aba Rigging,
// retarget, reprodução, desfazer/refazer, GLB exportado e reimportado, personagem incompatível.
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {mkdir, writeFile} from 'node:fs/promises';
const root = fileURLToPath(new URL('../', import.meta.url)), out = root + 'validation/';
await mkdir(out, {recursive: true});
let count = 0, t0 = Date.now();const mark = s => {count++;console.log(`✓ ${s} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);t0 = Date.now();};
const browser = await chromium.launch({channel: 'msedge', headless: true, args: ['--use-angle=swiftshader']});
const errors = [], requests = [];
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 940}});
  page.on('dialog', d => d.accept());page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});page.on('request', r => {if (/^https?:/i.test(r.url())) requests.push(r.url());});
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(root + 'dist/arenamon-animation-studio.html').href);
  await page.waitForFunction(() => window.__studioLibrary && window.__importer, null, {timeout: 60000});
  const W = (fn, arg) => page.evaluate(fn, arg);

  await W(() => window.__studioLayout.open('project'));
  assert.equal(await page.locator('#lib-card [data-lib]').count(), 14);
  const credit = await page.textContent('#lib-card .lib-credit');assert.match(credit, /14 animações reais[\s\S]*Tomás Laulhé[\s\S]*CC0 1\.0[\s\S]*b924f0c/);
  assert.equal(await page.isDisabled('#lib-add'), true);
  mark('Cartão em Projeto: 14 animações, autor, licença CC0 e origem com commit; adicionar desabilitado sem personagem');

  await page.click('#lib-demo');await page.waitForFunction(() => /Compatível/.test(document.getElementById('lib-state').textContent), null, {timeout: 30000});
  assert.match(await page.textContent('#lib-state'), /Hips → raiz[\s\S]*LeftShoulder → braço esquerdo/);
  mark('Manequim de teste com rig e skin feitos pela aba Rigging: compatível, papéis mapeados');

  for (const n of ['Walking', 'Punch', 'Death']) await page.check(`[data-lib="${n}"]`);
  assert.match(await page.textContent('#lib-add'), /\(3\)/);
  const labelBefore = await W(() => window.__studioEditor.history.state().undoLabel);
  await page.click('#lib-add');await page.waitForFunction(() => /adicionadas/.test(document.getElementById('lib-state').textContent));
  const added = await W(() => {const E = window.__importer, uuids = new Set();E.model.traverse(o => uuids.add(o.uuid));
    return E.clips.map(c => ({name: c.name, duration: c.duration, tracks: c.tracks.length, bound: c.tracks.every(t => uuids.has(t.name.split('.')[0])), license: c.userData?.license}));});
  assert.deepEqual(added.map(c => c.name), ['Walking · RobotExpressive (CC0)', 'Punch · RobotExpressive (CC0)', 'Death · RobotExpressive (CC0)']);
  assert.ok(added.every(c => c.bound && c.tracks >= 10), 'todas as trilhas ligadas a ossos do personagem');assert.ok(added.every(c => /CC0/.test(c.license)));
  assert.match(await W(() => window.__studioEditor.history.state().undoLabel), /Biblioteca CC0: 3/);
  mark('Adicionar: 3 clipes convertidos, todas as trilhas ligadas ao rig do personagem, licença no clipe, uma entrada no histórico');

  const motion = await W(async () => {
    const E = window.__importer, hip = E.model.getObjectByName('LeftHip'), elbow = E.model.getObjectByName('RightElbow'), sample = [];
    E.selectIndex(0);for (const t of [0, .24, .48, .72]) {E.seek(t);await new Promise(r => requestAnimationFrame(r));sample.push([hip.quaternion.toArray(), elbow.quaternion.toArray()]);}
    const ang = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.reduce((s, v, i) => s + v * b[i], 0)))) * 180 / Math.PI;
    return {hip: Math.max(...sample.map(s => ang(s[0], sample[0][0]))), elbow: Math.max(...sample.map(s => ang(s[1], sample[0][1])))};
  });
  assert.ok(motion.hip > 15, 'a perna anda: ' + motion.hip);assert.ok(motion.elbow > 3, 'o braço balança: ' + motion.elbow);
  await W(() => {window.__importer.seek(.3);});await page.waitForTimeout(150);await page.screenshot({path: out + 'library-walking.png'});
  mark(`Reprodução real no viewer: coxa varia ${motion.hip.toFixed(0)}° e cotovelo ${motion.elbow.toFixed(0)}° durante Walking`);

  await W(() => window.__studioEditor.history.undo());assert.equal(await W(() => window.__importer.clips.length), 0);
  assert.equal(await W(() => window.__studioEditor.history.state().undoLabel), labelBefore);
  await W(() => window.__studioEditor.history.redo());assert.deepEqual(await W(() => window.__importer.clips.map(c => c.name)), added.map(c => c.name));
  mark('Desfazer remove os 3 clipes de uma vez; refazer devolve os mesmos');

  const glb = await W(async () => {
    const E = window.__importer, bytes = await E.exportGLB({unlit: false, noTextures: false});
    const data = await E.parse(new File([bytes], 'biblioteca.glb', {type: 'model/gltf-binary'}));await E.install(data.scene, data.animations, 'biblioteca.glb');
    return E.clips.map(c => ({name: c.name, duration: +c.duration.toFixed(3)}));
  });
  assert.deepEqual(glb.map(c => c.name), added.map(c => c.name));assert.deepEqual(glb.map(c => c.duration), added.map(c => +c.duration.toFixed(3)));
  mark('GLB exportado e reimportado: os 3 clipes voltam com nomes e durações');

  await W(() => window.__studioLibrary.add(window.__studioLibrary.library.clips.map(c => c.name)));
  const all = await W(() => window.__importer.clips.length);assert.equal(all, 17);
  await W(() => window.__studioLayout.open('project'));await page.waitForTimeout(100);await page.screenshot({path: out + 'library-card.png'});
  mark('As 14 animações convertidas de uma vez para o personagem reimportado');

  await W(async () => {const E = window.__importer, T = E.T, g = new T.Group(), m = new T.Mesh(new T.BoxGeometry(1, 2, 1), new T.MeshStandardMaterial());g.add(m);await E.install(g, [], 'sem-rig.glb');});
  await page.waitForFunction(() => /não tem ossos/.test(document.getElementById('lib-state').textContent));
  await page.check('[data-lib="Idle"]');assert.equal(await page.isDisabled('#lib-add'), true);
  assert.rejects ? await assert.rejects(W(() => window.__studioLibrary.add(['Idle'])), /incompatível/) : null;
  mark('Personagem sem rig: incompatibilidade explicada, botão desabilitado e API recusa');
  assert.deepEqual(errors, []);assert.deepEqual(requests, []);
  await writeFile(out + 'library-browser.json', JSON.stringify({tests: count, errors, requests}, null, 2));
  console.log(`\nBiblioteca CC0: ${count} verificações de navegador aprovadas.`);
} finally {await browser.close();}
