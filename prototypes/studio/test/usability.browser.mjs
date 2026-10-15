// Regressões de usabilidade do visualizador (relatadas em 15/10/2026), no Studio real (Edge, offline):
// 1. nomes dos ossos não cobrem a tela: só o selecionado no Rigging, nenhum fora dele (antes ficavam congelados);
// 2. vistas centralizadas (Frente, Costas, Esq., Dir., Topo, 3D) em qualquer aba;
// 3. o alvo de referência (boneco laranja) não liga sozinho na Visão do jogo e tem botão para ligar/desligar;
// 4. espaço de trabalho: o painel de organização fecha em Rigging/Telemetria e volta ao sair;
// 5. ▶ Ver toca uma animação da biblioteca no personagem na hora;
// e a telemetria não acusa como órfãs as trilhas que o Studio religou por UUID.
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {mkdir, writeFile} from 'node:fs/promises';
const root = fileURLToPath(new URL('../', import.meta.url)), out = root + 'validation/';
await mkdir(out, {recursive: true});
let count = 0;const mark = s => {count++;console.log('✓ ' + s);};
const browser = await chromium.launch({channel: 'msedge', headless: true, args: ['--use-angle=swiftshader']});
const errors = [];
try {
  const page = await browser.newPage({viewport: {width: 1870, height: 940}});
  page.on('dialog', d => d.accept());page.on('pageerror', e => errors.push(e.message));
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(root + 'dist/arenamon-animation-studio.html').href);
  await page.waitForFunction(() => window.__studioLibrary && window.__studioViewBar && window.__studioWorkbench, null, {timeout: 60000});
  const W = (fn, arg) => page.evaluate(fn, arg);
  const labels = () => W(() => [...document.querySelectorAll('.rg-joint-label')].filter(l => !l.hidden).map(l => l.textContent));
  await W(() => window.__studioLibrary.demo());await page.waitForFunction(() => window.__importer.model && /Compatível/.test(document.getElementById('lib-state').textContent));

  // 1. Nomes dos ossos.
  await page.click('[data-panel="rigging"]');await page.waitForFunction(() => window.__studioRig.active);await page.waitForTimeout(200);
  assert.deepEqual(await labels(), [], 'no Assistente (padrão) os nomes do painel avançado não aparecem');
  // Os nomes por osso são do painel completo, no Modo avançado.
  await page.click('[data-mode="advanced"]');await page.waitForTimeout(200);
  let shown = await labels();assert.equal(shown.length, 1, 'só o osso selecionado: ' + shown);assert.equal(shown[0], await W(() => window.__studioRig.selected));
  await page.selectOption('#rg-label-mode', 'all');await page.waitForTimeout(150);assert.equal((await labels()).length, 20);
  await page.selectOption('#rg-label-mode', 'none');await page.waitForTimeout(150);assert.equal((await labels()).length, 0);
  await page.selectOption('#rg-label-mode', 'all');await page.waitForTimeout(150);
  await page.click('[data-panel="workbench"]');await page.waitForTimeout(300);
  await page.mouse.move(900, 450);await page.mouse.down();await page.mouse.move(700, 400, {steps: 8});await page.mouse.up();await page.waitForTimeout(200);
  assert.deepEqual(await labels(), [], 'fora do Rigging nenhum nome fica na tela (antes: 20 congelados)');
  await page.click('[data-panel="project"]');await page.waitForTimeout(200);assert.deepEqual(await labels(), []);
  await W(() => window.__studioLayout.open('rigging'));await page.selectOption('#rg-label-mode', 'selected');await page.click('[data-mode="guided"]');
  mark('Nomes dos ossos: só o selecionado (padrão), todos ou nenhum; ao sair do Rigging nenhum fica na tela');

  // 2. Vistas centralizadas.
  for (const view of ['front', 'back', 'left', 'right', 'top']) {
    await page.click(`[data-vb="${view}"]`);
    const cam = await W(() => {const E = window.__importer, T = E.T, box = new T.Box3().setFromObject(E.model), c = box.getCenter(new T.Vector3()), p = c.clone().project(E.camera);
      return {ortho: E.camera.isOrthographicCamera, screen: [p.x, p.y], pressed: document.querySelector('[data-vb][aria-pressed=true]')?.dataset.vb};});
    assert.equal(cam.ortho, true, view);assert.ok(Math.hypot(...cam.screen) < 1e-3, `${view}: personagem no centro da tela ${cam.screen}`);assert.equal(cam.pressed, view);
  }
  await page.click('[data-vb="front"]');await page.screenshot({path: out + 'usabilidade-rigging-frente.png'});
  await page.click('[data-panel="workbench"]');await page.click('[data-vb="front"]');
  assert.equal(await W(() => window.__importer.camera.isOrthographicCamera), true, 'a vista também funciona na Telemetria');
  await page.click('[data-vb="perspective"]');assert.equal(await W(() => window.__importer.camera.isPerspectiveCamera), true);
  mark('Vistas Frente/Costas/Esq./Dir./Topo: ortográficas e centralizadas no personagem, no Rigging e na Telemetria; 3D volta à perspectiva');

  // 4. Espaço de trabalho (o painel de organização fecha em Rigging/Telemetria e volta).
  await page.click('[data-panel="project"]');await page.waitForTimeout(100);assert.equal(await W(() => window.__studioLayout.rightOpen), true, 'aberto em Projeto');
  await page.click('[data-panel="rigging"]');await page.waitForTimeout(100);assert.equal(await W(() => window.__studioLayout.rightOpen), false, 'fechado no Rigging');
  await page.click('[data-panel="workbench"]');await page.waitForTimeout(100);assert.equal(await W(() => window.__studioLayout.rightOpen), false);
  await page.click('[data-panel="project"]');await page.waitForTimeout(100);assert.equal(await W(() => window.__studioLayout.rightOpen), true, 'volta ao sair');
  mark('Painel de organização fecha sozinho em Rigging/Telemetria (mais espaço para o 3D) e volta ao sair');

  // 3. Alvo de referência.
  await page.click('#view-game-preset');await page.waitForTimeout(200);
  const dummy = () => W(() => ({checked: document.getElementById('lab-dummy').checked, visible: window.__importer.scene.getObjectByName('Arenamon Studio · Alvo técnico').visible, pressed: document.getElementById('vb-dummy').getAttribute('aria-pressed')}));
  assert.deepEqual(await dummy(), {checked: false, visible: false, pressed: 'false'}, 'Visão do jogo não liga o boneco');
  await page.click('#vb-dummy');await page.waitForTimeout(100);assert.deepEqual(await dummy(), {checked: true, visible: true, pressed: 'true'});
  await page.click('#vb-dummy');await page.waitForTimeout(100);assert.deepEqual(await dummy(), {checked: false, visible: false, pressed: 'false'});
  await page.click('[data-vb="front"]');assert.equal(await W(() => window.__importer.camera.isOrthographicCamera), true, 'sai da câmera do jogo para a vista frontal');
  mark('Alvo de referência: não liga com a Visão do jogo; botão “Alvo” liga e desliga; Frente sai da câmera do jogo');

  // 5. Ver uma animação da biblioteca.
  await page.click('[data-play="Walking"]');await page.waitForTimeout(300);
  const playing = await W(async () => {
    const E = window.__importer, hip = E.model.getObjectByName('LeftHip'), a = hip.quaternion.clone();await new Promise(r => setTimeout(r, 350));
    return {playing: E.playing, clip: E.selectedClip?.name, moved: a.angleTo(hip.quaternion) * 180 / Math.PI, pressed: document.querySelector('[data-play][aria-pressed=true]')?.dataset.play};
  });
  assert.equal(playing.playing, true);assert.equal(playing.clip, 'Walking · RobotExpressive (CC0)');assert.ok(playing.moved > 2, 'a perna se move enquanto toca: ' + playing.moved);assert.equal(playing.pressed, 'Walking');
  await page.screenshot({path: out + 'usabilidade-ver-walking.png'});
  await page.click('[data-play="Walking"]');assert.equal(await W(() => window.__importer.clips.length), 1, 'Ver de novo não duplica');
  await page.click('[data-play="Punch"]');await page.waitForTimeout(200);assert.equal(await W(() => window.__importer.selectedClip.name), 'Punch · RobotExpressive (CC0)');
  mark('▶ Ver: um clique toca a animação no personagem (sem duplicar), troca para outra com outro clique');

  // Telemetria: trilhas religadas por UUID não são órfãs; uma trilha realmente órfã é.
  await W(() => {const E = window.__importer, T = E.T;E.addClip(new T.AnimationClip('Órfã de teste', 1, [new T.QuaternionKeyframeTrack('TailMissing.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1])]), {select: false});});
  await page.click('[data-panel="workbench"]');await page.waitForFunction(() => window.__studioWorkbench.panel.state.telemetry?.official.consistency.orphanAnimationTracks.length > 0, null, {timeout: 10000});
  const orphans = await W(() => window.__studioWorkbench.panel.state.telemetry.official.consistency.orphanAnimationTracks.map(o => o.trackName));
  assert.deepEqual(orphans, ['TailMissing.quaternion'], 'só a trilha realmente órfã (as dos clipes da biblioteca estão ligadas por UUID)');
  mark('Telemetria: trilhas religadas por UUID contam como ligadas; só a órfã de verdade aparece');
  assert.deepEqual(errors, []);
  await writeFile(out + 'usability-browser.json', JSON.stringify({tests: count, errors}, null, 2));
  console.log(`\nUsabilidade: ${count} verificações de navegador aprovadas.`);
} finally {await browser.close();}
