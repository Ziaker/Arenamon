import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root = new URL('../', import.meta.url), evidence = new URL('evidence/limb-smear/', root);
mkdirSync(evidence, {recursive: true});
const browser = await chromium.launch({channel: process.env.ARENAMON_BROWSER || 'msedge', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}}), errors = [];
page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
try {
  await page.goto(new URL('dist/arenamon-combate-laboratorio.html', root).href);await page.waitForFunction(() => window.__lab);
  await page.evaluate(() => {window.__lab.ui.paused = true;window.__lab.openTool('moves');});
  await page.click('#act-tabs [data-act="tackle"]');
  for (const [key, value] of Object.entries({enableSmear: 0, smearDurationFrames: 4, smearMinVelocity: 20, smearWidth: .3, smearColorMode: 2, smearOpacity: .5, smearPlBoost: 0})) {
    const input = page.locator(`#act-tackle [data-path="extras.visual.smear.${key}"]`).filter({visible: true});
    assert.equal(await input.count(), 1, `controle visível ausente: extras.visual.smear.${key}`);
    const before = await page.evaluate(key => window.__lab.C.extras.visual.smear[key], key);
    await input.evaluate((el, value) => {
      if (el.type === 'checkbox') el.checked = !!value;
      else {el.value = String(value);el.dispatchEvent(new Event('input', {bubbles: true}));}
      el.dispatchEvent(new Event('change', {bubbles: true}));el.blur();
    }, value);
    assert.equal(await page.evaluate(key => window.__lab.C.extras.visual.smear[key], key), value);
    await page.keyboard.press('Control+z');assert.equal(await page.evaluate(key => window.__lab.C.extras.visual.smear[key], key), before);
  }
  const bytes = readFileSync(new URL('../../chars/mosh/Cogumelo.glb', root)).toString('base64');
  const result = await page.evaluate(async bytes => {
    const L = window.__lab, file = new File([Uint8Array.from(atob(bytes), c => c.charCodeAt(0))], 'Cogumelo.glb');
    const source = await L.loadStudioFile(file);L.setCharacter(0, source);L.ui.paused = true;
    const ch = L.ui.characters[0], s = L.view.smears[0], f = L.game.fighters[0], R = L.view.renderer, camera = L.view.camera;
    f.hp = 100;f.state = 'tackle';f.position.x = f.position.z = 0;f.visualFacing = 0;f.action = {kind: 'tackle', elapsed: .16, heading: 0, pl: 3, hits: new Set()};
    const advance = distance => {f.position.x += distance;ch.update(f, 1 / 60, 0, [], {tick: L.game.tick});s.update(f, 1 / 60, L.C.extras.visual.smear, L.game.tick);};
    L.C.extras.visual.smear.smearColorMode = 1;L.C.extras.visual.smear.smearWidth = .3;
    advance(0);advance(.3);const emitted = s.activeCount, neon = s.edges.visible;
    for (const mesh of L.view.meshes) mesh.visible = false;for (const arrow of L.view.arrows) arrow.visible = false;
    camera.position.set(f.position.x, 1.3, 2.6);camera.lookAt(f.position.x, .8, 0);camera.updateMatrixWorld();
    R.render(L.view.scene, camera);const png = R.domElement.toDataURL('image/png');
    const before = {geometries: R.info.memory.geometries, programs: R.info.programs.length, children: L.view.scene.children.length};
    const positions = s.positions, geometry = s.geometry, material = s.material, samples = [];
    for (let i = 0; i < 100; i++) {
      s.reset();f.position.x = 0;advance(0);f.position.x += .3;ch.place(f, 0, 1 / 60);
      const start = performance.now();s.update(f, 1 / 60, L.C.extras.visual.smear, L.game.tick);samples.push(performance.now() - start);
      R.render(L.view.scene, camera);
    }
    const after = {geometries: R.info.memory.geometries, programs: R.info.programs.length, children: L.view.scene.children.length};
    samples.sort((a, b) => a - b);
    const stableBuffers = positions === s.positions && geometry === s.geometry && material === s.material;
    f.action = null;advance(0);advance(0);advance(0);const expired = s.activeCount;
    f.action = {kind: 'tackle', elapsed: .16, heading: 0, pl: 3};advance(.3);
    L.C.vfx.master.enabled = 0;L.view.draw(L.game.fighters, [], 0, {paused: true, tick: L.game.tick});const globalOffClears = s.activeCount === 0;
    L.C.vfx.master.enabled = 1;advance(.3);advance(.3);
    L.C.vfx.master.reduceMotion = 1;L.view.draw(L.game.fighters, [], 0, {paused: true, tick: L.game.tick});const reduceMotionClears = s.activeCount === 0;
    L.C.vfx.master.reduceMotion = 0;advance(.3);advance(.3);L.view.reset(f);const reset = s.activeCount;
    const anchors = s.anchors.map(a => a.label);
    L.setCharacter(0, null);R.render(L.view.scene, camera);const disposed = !s.mesh.parent && !s.edges.parent && L.view.smears[0] === null;
    return {png, emitted, neon, before, after, stableBuffers, expired, reset, disposed, globalOffClears, reduceMotionClears, anchors, updateP95ms: samples[95], updateMaxMs: samples[99]};
  }, bytes);
  assert.ok(result.emitted > 0 && result.neon);assert.deepEqual(result.before, result.after);assert.ok(result.stableBuffers && result.disposed && result.globalOffClears && result.reduceMotionClears);
  assert.equal(result.expired, 0);assert.equal(result.reset, 0);assert.ok(result.updateP95ms < 4, 'Atualização deve caber com folga no orçamento de 16,7 ms');
  await page.evaluate(() => {for (const el of document.querySelectorAll('#act-tackle details')) el.open = el.textContent.includes('Smear de membros no Tackle');});
  await page.locator('#act-tackle details').filter({hasText: 'Smear de membros no Tackle'}).screenshot({path: fileURLToPath(new URL('controles.png', evidence))});
  writeFileSync(new URL('smear-pl3.png', evidence), Buffer.from(result.png.split(',')[1], 'base64'));delete result.png;
  const croagunkBytes = readFileSync(new URL('../../chars/croagunk/croagunk-rigged.glb', root)).toString('base64');
  const croagunk = await page.evaluate(async bytes => {
    const L = window.__lab, source = await L.loadStudioFile(new File([Uint8Array.from(atob(bytes), c => c.charCodeAt(0))], 'croagunk-rigged.glb'));
    L.setCharacter(0, source);const ch = L.ui.characters[0], s = L.view.smears[0], f = L.game.fighters[0];
    f.action = {kind: 'tackle', elapsed: .16, heading: 0, pl: 1};f.hp = 100;
    ch.update(f, 1 / 60, 0, [], {tick: L.game.tick});s.update(f, 1 / 60, L.C.extras.visual.smear, L.game.tick);
    f.position.x += .3;ch.update(f, 1 / 60, 0, [], {tick: L.game.tick});s.update(f, 1 / 60, L.C.extras.visual.smear, L.game.tick);
    for (const mesh of L.view.meshes) mesh.visible = false;for (const arrow of L.view.arrows) arrow.visible = false;
    const camera = L.view.camera;camera.position.set(f.position.x, 1.3, f.position.z + 2.6);camera.lookAt(f.position.x, .8, f.position.z);camera.updateMatrixWorld();
    L.view.renderer.render(L.view.scene, camera);
    const result = {anchors: s.anchors.map(a => a.label), active: s.activeCount, clips: ch.clips.length, png: L.view.renderer.domElement.toDataURL('image/png')};L.setCharacter(0, null);return result;
  }, croagunkBytes);
  assert.equal(croagunk.anchors.length, 4);assert.ok(croagunk.active > 0);writeFileSync(new URL('croagunk.png', evidence), Buffer.from(croagunk.png.split(',')[1], 'base64'));delete croagunk.png;result.croagunk = croagunk;
  result.renderBenchmark = await page.evaluate(async bytes => {
    const L = window.__lab, source = await L.loadStudioFile(new File([Uint8Array.from(atob(bytes), c => c.charCodeAt(0))], 'Cogumelo.glb'));
    L.setCharacter(0, source);L.setCharacter(1, source);L.ui.paused = true;
    // Retira a pré-computação dos clipes do intervalo medido (normalmente ocorre em idle callbacks).
    for (let j = 0; j < 2; j++) {
      const ch = L.ui.characters[j], f = L.game.fighters[j];clearTimeout(ch.warmTimer);
      f.hp = 100;f.action = {kind: 'tackle', elapsed: .16, heading: 0, pl: 3};
      ch.update(f, 1/60, 0, [], {tick: L.game.tick});for (let k = 0; k < ch.clips.length; k++) ch.groundCurve(k);
    }
    const gl = L.view.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'indisponível';
    const measure = async enabled => {
      L.C.extras.visual.smear.enableSmear = enabled ? 1 : 0;
      const times = [];let previous = await new Promise(requestAnimationFrame), activeFrames = 0;
      for (let i = 0; i < 140; i++) {
        const now = await new Promise(requestAnimationFrame), dt = (now - previous) / 1000;previous = now;
        for (let j = 0; j < 2; j++) {
          const f = L.game.fighters[j], ch = L.ui.characters[j];f.hp = 100;f.state = 'tackle';f.position.x = (j ? 1.2 : -1.2) + Math.sin(now * .025) * .8;f.position.z = 0;
          f.action = {kind: 'tackle', elapsed: .16, heading: 0, pl: 3};ch.update(f, dt, 0, [], {tick: L.game.tick});L.view.smears[j].update(f, dt, L.C.extras.visual.smear, L.game.tick);
        }
        if (i >= 20) {times.push(dt * 1000);if (L.view.smears[0].activeCount) activeFrames++;}
      }
      const mean = times.reduce((a,b) => a+b, 0) / times.length;times.sort((a,b) => a-b);
      return {fps: +(1000/mean).toFixed(1), frameP95ms: +times[Math.floor(times.length*.95)].toFixed(2), activeFrames};
    };
    const baseline = await measure(false), smear = await measure(true);L.setCharacter(0, null);L.setCharacter(1, null);
    return {scenario: 'Dois Cogumelos com pose de Tackle e deslocamento oscilante, PL3; Edge headless; 120 intervalos após aquecimento', renderer, baseline, smear};
  }, bytes);
  assert.ok(result.renderBenchmark.smear.activeFrames > 5, 'Benchmark precisa realmente desenhar smears');
  assert.equal(errors.length, 0, errors.join('\n'));
  writeFileSync(new URL('resultado.json', evidence), JSON.stringify({controls: 7, undo: 'Ctrl+Z aprovado', ...result, errors}, null, 2) + '\n');
  console.log('✓ Edge offline: 7 controles + Ctrl+Z, chapéu do Cogumelo, PL3 neon, 100 disparos sem crescimento GPU/cena, reset e descarte. P95 atualização: ' + result.updateP95ms.toFixed(3) + ' ms.');
} finally {await browser.close();}
