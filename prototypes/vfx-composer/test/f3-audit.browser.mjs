import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';

const html = fileURLToPath(new URL('../dist/arenamon-vfx-composer.html', import.meta.url));
const evidence = fileURLToPath(new URL('../evidence/f3-audit/', import.meta.url));
const framesDir = path.join(evidence, 'frames');
await mkdir(evidence, {recursive: true});
await mkdir(framesDir, {recursive: true});

/** Decodifica PNG RGBA/RGB de 8 bits sem dependência externa. */
function decodePng(buffer) {
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'assinatura PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const chunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8, 'PNG de 8 bits');
      colorType = data[9];
      assert.equal(data[12], 0, 'PNG sem entrelaçamento');
    } else if (type === 'IDAT') chunks.push(data);
    else if (type === 'IEND') break;
    offset += length + 12;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  assert.ok(channels, `tipo de cor PNG suportado (recebido ${colorType})`);
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(width * height * 4);
  let position = 0;
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[position++];
    const line = Buffer.from(raw.subarray(position, position + stride));
    position += stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? line[x - channels] : 0;
      const up = previous[x];
      const upLeft = x >= channels ? previous[x - channels] : 0;
      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const distanceLeft = Math.abs(estimate - left);
        const distanceUp = Math.abs(estimate - up);
        const distanceUpLeft = Math.abs(estimate - upLeft);
        value += distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft ? left : distanceUp <= distanceUpLeft ? up : upLeft;
      } else assert.equal(filter, 0, 'filtro PNG válido');
      line[x] = value & 255;
    }
    for (let x = 0; x < width; x++) {
      const source = x * channels;
      const target = (y * width + x) * 4;
      pixels[target] = line[source];
      pixels[target + 1] = line[source + 1];
      pixels[target + 2] = line[source + 2];
      pixels[target + 3] = channels === 4 ? line[source + 3] : 255;
    }
    previous = line;
  }
  return {width, height, data: pixels};
}

function diffStats(base, image) {
  assert.equal(base.width, image.width, 'mesma largura de canvas');
  assert.equal(base.height, image.height, 'mesma altura de canvas');
  let changed = 0;
  let warm = 0;
  let cool = 0;
  let magenta = 0;
  let bright = 0;
  for (let index = 0; index < base.data.length; index += 4) {
    const r = image.data[index];
    const g = image.data[index + 1];
    const b = image.data[index + 2];
    const delta = Math.abs(r - base.data[index]) + Math.abs(g - base.data[index + 1]) + Math.abs(b - base.data[index + 2]);
    if (delta < 45) continue;
    changed++;
    if (Math.max(r, g, b) > 170) bright++;
    if (r > g + 18 && r > b + 10 && r > 90) warm++;
    if (b > r + 18 && b > g + 5 && b > 80) cool++;
    if (r > g + 25 && b > g + 15 && r > 100 && b > 100) magenta++;
  }
  return {changed, warm, cool, magenta, bright};
}

async function setNumber(page, selector, value) {
  await page.fill(selector, String(value));
  await page.dispatchEvent(selector, 'input');
}

async function setTime(page, time) {
  await page.click('[data-workspace="animation"]');
  await page.locator('#timeline-scrub').evaluate((element, next) => {
    element.value = String(next);
    element.dispatchEvent(new Event('input', {bubbles: true}));
  }, time);
  await page.waitForTimeout(45);
  const actual = await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.playback.time);
  await page.click('[data-workspace="particles"]');
  await page.waitForTimeout(160);
  return actual;
}

async function addEffect(page, effect) {
  await page.click('#add-emitter');
  await page.waitForFunction(() => document.querySelector('#emitter-select')?.value);
  const id = await page.inputValue('#emitter-select');
  await page.fill('#emitter-name', effect.name);
  await setNumber(page, '#emitter-seed', effect.seed);
  await page.selectOption('#emitter-mode', effect.mode);
  await page.selectOption('#emitter-shape', effect.shape);
  await setNumber(page, '#emitter-origin-x', effect.origin[0]);
  await setNumber(page, '#emitter-origin-y', effect.origin[1]);
  await setNumber(page, '#emitter-origin-z', effect.origin[2]);
  await setNumber(page, '#emitter-count', effect.count);
  await setNumber(page, '#emitter-rate', effect.rate);
  await setNumber(page, '#emitter-interval', effect.interval);
  await setNumber(page, '#emitter-duration', effect.duration);
  await setNumber(page, '#emitter-life-min', effect.life[0]);
  await setNumber(page, '#emitter-life-max', effect.life[1]);
  await setNumber(page, '#emitter-radius', effect.radius);
  await setNumber(page, '#emitter-angle', effect.angle);
  await setNumber(page, '#emitter-speedMin', effect.speed[0]);
  await setNumber(page, '#emitter-speedMax', effect.speed[1]);
  await setNumber(page, '#emitter-spread', effect.spread);
  await setNumber(page, '#emitter-drag', effect.drag);
  await setNumber(page, '#emitter-turbulenceFrequency', effect.turbulence[0]);
  await setNumber(page, '#emitter-turbulenceAmplitude', effect.turbulence[1]);
  await setNumber(page, '#emitter-gravity-x', effect.gravity[0]);
  await setNumber(page, '#emitter-gravity-y', effect.gravity[1]);
  await setNumber(page, '#emitter-gravity-z', effect.gravity[2]);
  await setNumber(page, '#emitter-sizeStart', effect.size[0]);
  await setNumber(page, '#emitter-sizeEnd', effect.size[1]);
  await setNumber(page, '#emitter-opacityStart', effect.opacity[0]);
  await setNumber(page, '#emitter-opacityEnd', effect.opacity[1]);
  await setNumber(page, '#emitter-maxParticles', effect.maxParticles);
  await page.fill('#emitter-color-start', effect.colors[0]);
  await page.dispatchEvent('#emitter-color-start', 'input');
  await page.fill('#emitter-color-end', effect.colors[1]);
  await page.dispatchEvent('#emitter-color-end', 'input');
  await page.selectOption('#emitter-blending', effect.blending);
  await page.click('#apply-emitter');
  await page.waitForFunction(({id, name}) => window.__ARENAMON_VFX_COMPOSER__.project.particles.some(emitter => emitter.id === id && emitter.name === name), {id, name: effect.name});
  return id;
}

async function setEmitterEnabled(page, id, enabled) {
  await page.selectOption('#emitter-select', id);
  if (enabled) await page.check('#emitter-enabled');
  else await page.uncheck('#emitter-enabled');
  await page.click('#apply-emitter');
  await page.waitForFunction(({id, enabled}) => window.__ARENAMON_VFX_COMPOSER__.project.particles.find(emitter => emitter.id === id)?.enabled === enabled, {id, enabled});
}

const browser = await chromium.launch({channel: process.env.ARENAMON_BROWSER || 'msedge', headless: true});
try {
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
  await context.setOffline(true);
  const page = await context.newPage();
  const errors = [];
  const external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  page.on('request', request => {if (/^https?:/.test(request.url())) external.push(request.url());});
  await page.goto(pathToFileURL(html).href);
  await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__?.ready);

  // Abertura real do app: a demonstração dos três efeitos já está carregada, no documento e tocando.
  await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__.particleTelemetry.active > 0);
  const demo = await page.evaluate(() => ({
    loaded: window.__ARENAMON_VFX_COMPOSER__.demoLoaded,
    playing: window.__ARENAMON_VFX_COMPOSER__.demoPlaying,
    loop: window.__ARENAMON_VFX_COMPOSER__.loopPlayback,
    names: window.__ARENAMON_VFX_COMPOSER__.project.particles.map(emitter => emitter.name),
    workspace: document.querySelector('nav.workspace-tabs button.selected')?.dataset.workspace,
    demoBar: Boolean(document.querySelector('#demo-bar')),
    rightTitle: document.querySelector('.right .panel-head h2')?.textContent,
  }));
  assert.equal(demo.loaded, true, 'app abre com a demonstração dos 3 efeitos');
  assert.equal(demo.playing, true, 'demonstração toca sozinha, em tempo real');
  assert.equal(demo.loop, true, 'demonstração fica em loop');
  assert.deepEqual(demo.names, ['Brasa Ascendente', 'Névoa Fria', 'Estilhaço Arcano']);
  assert.equal(demo.workspace, 'particles', 'app abre na aba Partículas, não escondido');
  assert.equal(demo.demoBar, true, 'barra da demonstração visível');
  assert.equal(demo.rightTitle, 'Partículas', 'painel de partículas em primeiro plano');
  const demoFirst = await page.locator('#viewport canvas').screenshot();
  await page.waitForTimeout(500);
  const demoSecond = await page.locator('#viewport canvas').screenshot();
  assert.equal(demoFirst.equals(demoSecond), false, 'canvas da demonstração muda sozinho em tempo real');
  await page.screenshot({path: path.join(evidence, 'app-demo-em-tempo-real.png')});

  // O preset de explosão também é documento real do app: 8 cubos vermelhos + 8 esferas amarelas.
  await page.click('#load-explosion');
  await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__.project.effectId === 'explosao-cubos-esferas');
  await page.waitForTimeout(820);
  const explosion = await page.evaluate(() => ({
    nodes: window.__ARENAMON_VFX_COMPOSER__.project.nodes.length,
    boxes: window.__ARENAMON_VFX_COMPOSER__.project.nodes.filter(node => node.geometry.kind === 'box').length,
    spheres: window.__ARENAMON_VFX_COMPOSER__.project.nodes.filter(node => node.geometry.kind === 'sphere').length,
    colors: [...new Set(window.__ARENAMON_VFX_COMPOSER__.project.nodes.map(node => node.color))].sort(),
    tracks: window.__ARENAMON_VFX_COMPOSER__.project.timeline.tracks.length,
    playing: window.__ARENAMON_VFX_COMPOSER__.playback.playing,
    workspace: document.querySelector('nav.workspace-tabs button.selected')?.dataset.workspace,
  }));
  assert.equal(explosion.nodes, 16, 'explosão tem 16 objetos');
  assert.equal(explosion.boxes, 8, '8 cubos');
  assert.equal(explosion.spheres, 8, '8 esferas');
  assert.deepEqual(explosion.colors, ['#ff2b2b', '#ffd400'], 'cubos vermelhos e esferas amarelas');
  assert.equal(explosion.tracks, 48, '48 tracks de posição (16 objetos × 3 eixos)');
  assert.equal(explosion.playing, true, 'explosão toca sozinha');
  assert.equal(explosion.workspace, 'animation', 'abre na aba Animação, com timeline à vista');
  await page.locator('#viewport').screenshot({path: path.join(evidence, 'explosao-cubos-esferas.png')});

  // Daqui em diante a auditoria cria os três efeitos do zero, pelos mesmos controles do usuário.
  await page.click('#new-empty-project');
  await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__.project.particles.length === 0);
  await page.click('[data-workspace="particles"]');

  const view = await page.locator('#viewport').boundingBox();
  await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2);
  await page.mouse.wheel(0, -250);
  await page.waitForTimeout(650);

  const captureCanvas = async name => {
    await page.waitForTimeout(140);
    const buffer = await page.locator('#viewport canvas').screenshot();
    await writeFile(path.join(evidence, name), buffer);
    return {buffer, png: decodePng(buffer)};
  };

  const baseline = await captureCanvas('baseline.png');
  assert.equal(diffStats(baseline.png, baseline.png).changed, 0, 'baseline não muda contra si mesma');

  const effects = [
    {
      key: 'brasa', name: 'Brasa Ascendente', seed: 20261028, mode: 'burst', shape: 'sphere',
      origin: [0, .9, 0], count: 60, rate: 90, interval: .08, duration: 1.4, life: [.5, 1.8],
      radius: .18, angle: 40, speed: [.8, 2.4], spread: 22, gravity: [0, .85, 0], drag: .9,
      turbulence: [2.2, .22], size: [.09, .012], opacity: [1, 0], colors: ['#ffd166', '#ff4d00'],
      blending: 'additive', maxParticles: 280, time: .55,
    },
    {
      key: 'nevoa', name: 'Névoa Fria', seed: 424242, mode: 'continuous', shape: 'sphere',
      origin: [-1.15, .65, .1], count: 36, rate: 60, interval: .12, duration: 3, life: [1.6, 3.2],
      radius: .55, angle: 35, speed: [.1, .5], spread: 65, gravity: [0, .18, 0], drag: 1.4,
      turbulence: [.9, .12], size: [.35, .7], opacity: [.45, .08], colors: ['#b8f2ff', '#4c7dff'],
      blending: 'normal', maxParticles: 220, time: 1.1,
    },
    {
      key: 'estilhaco', name: 'Estilhaço Arcano', seed: 777001, mode: 'burst', shape: 'ring',
      origin: [1, .85, 0], count: 70, rate: 90, interval: .5, duration: 1.8, life: [.8, 1.3],
      radius: .12, angle: 90, speed: [2, 4.5], spread: 360, gravity: [0, -1.2, 0], drag: 1.4,
      turbulence: [0, 0], size: [.1, .02], opacity: [1, .15], colors: ['#ff7bff', '#6a4dff'],
      blending: 'additive', maxParticles: 260, time: .7,
    },
  ];

  const created = [];
  const individuals = {};
  for (const [index, effect] of effects.entries()) {
    if (index > 0) {
      const previous = created[index - 1];
      await setEmitterEnabled(page, previous.id, false);
      await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__.particleTelemetry.active === 0);
    }
    const id = await addEffect(page, effect);
    const actualTime = await setTime(page, effect.time);
    const {png} = await captureCanvas(`efeito-${index + 1}-${effect.key}.png`);
    const snapshot = await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.particleSnapshot());
    assert.ok(snapshot.length > 5, `${effect.name} precisa materializar partículas`);
    const stats = diffStats(baseline.png, png);
    if (effect.key === 'brasa') assert.ok(stats.warm > 80, `brasa visível no canvas (quentes=${stats.warm}, alterados=${stats.changed})`);
    if (effect.key === 'nevoa') assert.ok(stats.cool > 40, `névoa visível no canvas (frios=${stats.cool}, alterados=${stats.changed})`);
    if (effect.key === 'estilhaco') assert.ok(stats.magenta > 40, `estilhaço visível no canvas (magenta=${stats.magenta}, alterados=${stats.changed})`);
    created.push({id, ...effect, actualTime, snapshot: snapshot.length});
    individuals[effect.key] = stats;
  }

  await setEmitterEnabled(page, created[0].id, true);
  await setEmitterEnabled(page, created[1].id, true);
  const combinedTime = await setTime(page, .7);
  await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__.particleTelemetry.emitters === 3);
  const combined = await captureCanvas('tres-efeitos.png');
  const combinedStats = diffStats(baseline.png, combined.png);
  assert.ok(combinedStats.warm > 40 && combinedStats.cool > 20 && combinedStats.magenta > 20, `três efeitos simultâneos no canvas: ${JSON.stringify(combinedStats)}`);
  const combinedSnapshot = await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.particleSnapshot());
  assert.ok(combinedSnapshot.length > Math.max(...created.map(effect => effect.snapshot)), 'soma dos três efeitos tem mais partículas que qualquer um isolado');
  assert.equal(combinedSnapshot.every(particle => particle.every(Number.isFinite)), true);
  assert.equal(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.particleTelemetry.drawCalls), 3);

  const budget = await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.particleBudget);
  assert.equal(budget.verdict.publishable, true, `orçamento medium publicável: ${JSON.stringify(budget.verdict)}`);
  assert.equal(budget.cost.drawCalls, 3);

  // Playback real e reverse no mesmo canvas.
  await page.click('[data-workspace="animation"]');
  await page.fill('#timeline-duration', '2.5');
  await page.dispatchEvent('#timeline-duration', 'change');
  await page.click('#timeline-play');
  await page.waitForTimeout(450);
  const playing = await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.playback);
  assert.equal(playing.playing, true, 'play avança o relógio');
  assert.ok(playing.time > .2, `play avançou (${playing.time}s)`);
  await page.click('#timeline-stop');
  assert.equal(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.playback.time), 0);
  await page.click('#timeline-reverse');
  await page.waitForTimeout(220);
  const reversed = await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.playback);
  assert.equal(reversed.direction, -1);
  assert.equal(reversed.playing, true);
  await page.click('#timeline-stop');

  // Scrub determinístico nos três efeitos.
  const atFirst = await setTime(page, .7);
  const firstSnapshot = await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.particleSnapshot());
  await setTime(page, 1.3);
  const laterSnapshot = await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.particleSnapshot());
  await setTime(page, .7);
  const againSnapshot = await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.particleSnapshot());
  assert.notDeepEqual(laterSnapshot, firstSnapshot, 'tempos diferentes mudam as partículas');
  assert.deepEqual(againSnapshot, firstSnapshot, 'voltar ao mesmo tempo é determinístico');

  // Sequência de quadros reais para a evidência.
  const frameHashes = [];
  for (const [index, time] of [.15, .45, .95, 1.45].entries()) {
    await setTime(page, time);
    const buffer = await page.locator('#viewport canvas').screenshot();
    await writeFile(path.join(framesDir, `frame-${index}.png`), buffer);
    frameHashes.push(createHash('sha256').update(buffer).digest('hex'));
  }
  assert.equal(new Set(frameHashes).size, frameHashes.length, 'quadros da sequência são distintos');

  // Quarks real e comparação A/B.
  await page.selectOption('#particle-preview-backend', 'quarks');
  await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__.quarksTelemetry.systems === 3 && window.__ARENAMON_VFX_COMPOSER__.quarksTelemetry.active > 0);
  const quarks = await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.quarksTelemetry);
  const visibleQuarks = await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.previewVisibility);
  assert.equal(visibleQuarks.authoring, false);
  assert.equal(visibleQuarks.quarks, true);
  await captureCanvas('quarks-3-efeitos.png');
  await page.selectOption('#particle-preview-backend', 'compare');
  await page.waitForFunction(() => {const state = window.__ARENAMON_VFX_COMPOSER__.previewVisibility; return state.authoring && state.quarks;});
  await captureCanvas('comparacao-ab.png');
  await page.selectOption('#particle-preview-backend', 'authoring');

  await page.locator('#particle-panel').scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await page.screenshot({path: path.join(evidence, 'composer-tres-efeitos.png')});

  // Exportação real por download e reimportação pelo input da UI.
  const downloadPromise = page.waitForEvent('download');
  await page.click('#export-project');
  const download = await downloadPromise;
  const projectFile = path.join(evidence, 'projeto-tres-efeitos.vfx-project.json');
  await download.saveAs(projectFile);
  const exported = JSON.parse(await readFile(projectFile, 'utf8'));
  assert.equal(exported.particles.length, 3);
  assert.deepEqual(exported.particles.map(emitter => emitter.name).sort(), effects.map(effect => effect.name).sort());

  const beforeImport = await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.project.revision);
  await page.setInputFiles('#import-project', projectFile);
  await page.waitForFunction(revision => window.__ARENAMON_VFX_COMPOSER__.project.revision > revision, beforeImport);
  await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__.project.particles?.length === 3);
  await setTime(page, .7);
  const importedSnapshot = await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.particleSnapshot());
  assert.deepEqual(importedSnapshot, firstSnapshot, 'importação preserva a simulação');

  // Recarga normal usa o autosave.
  await page.reload();
  await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__?.ready);
  assert.equal(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.project.particles.length), 3);
  assert.equal(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.recovery.recovered), false);

  // Corrupção do slot principal: o app precisa cair no backup, não começar vazio.
  await page.evaluate(() => {
    const primary = localStorage.getItem('arenamon.vfx.composer-local');
    if (!primary) throw new Error('autosave principal ausente');
    localStorage.setItem('arenamon.vfx.composer-local.backup', primary);
    localStorage.setItem('arenamon.vfx.composer-local', '{ corrompido');
  });
  await page.reload();
  await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__?.ready);
  assert.equal(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.project.particles.length), 3, 'backup recupera os três efeitos');
  assert.equal(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.recovery.recovered), true);
  assert.match(await page.locator('#status').innerText(), /Snapshot anterior recuperado/);
  await setTime(page, .7);
  await page.locator('#status').scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);
  await page.screenshot({path: path.join(evidence, 'recuperacao-autosave.png')});

  // Sem backup: o app continua abrindo e informa o fallback em vez de sumir em silêncio.
  await page.evaluate(() => {
    localStorage.removeItem('arenamon.vfx.composer-local.backup');
    localStorage.setItem('arenamon.vfx.composer-local', '{ corrompido');
  });
  await page.reload();
  await page.waitForFunction(() => window.__ARENAMON_VFX_COMPOSER__?.ready);
  assert.equal(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.project.particles.length), 0);
  assert.match(await page.evaluate(() => window.__ARENAMON_VFX_COMPOSER__.recovery.message), /Autosave inválido/);
  assert.match(await page.locator('#status').innerText(), /Autosave inválido/);

  assert.equal(errors.length, 0, errors.join('\n'));
  assert.equal(external.length, 0, external.join('\n'));

  const result = {
    status: 'approved',
    phase: 'F3.2 auditoria E2E',
    browser: process.env.ARENAMON_BROWSER || 'msedge',
    viewport: {width: 1440, height: 1000},
    offline: true,
    externalRequests: 0,
    effects: created.map(effect => ({id: effect.id, name: effect.name, mode: effect.mode, shape: effect.shape, snapshotAt: effect.actualTime, particles: effect.snapshot, visiblePixels: individuals[effect.key]})),
    combined: {time: combinedTime, particles: combinedSnapshot.length, drawCalls: 3, budget, pixels: combinedStats},
    quarks: {systems: quarks.systems, active: quarks.active, drawCalls: quarks.drawCalls, rebuilds: quarks.rebuilds, rejected: quarks.rejected, approximations: quarks.approximations},
    playback: {advancedTo: playing.time, reverseDirection: reversed.direction},
    persistence: {exportedParticles: exported.particles.length, importedSnapshotMatches: true, normalReloadParticles: 3, backupRecoveredParticles: 3},
    checks: [
      '3 efeitos criados pelos controles da UI, sem injeção de documento',
      'canvas WebGL com pixels quentes, frios e magenta medidos por diferença',
      'play, stop e reverse avançam o relógio real',
      'scrub determinístico: mesmo tempo devolve as mesmas partículas',
      '3 draw calls autorais e orçamento medium publicável',
      'three.quarks real com 3 sistemas e comparação A/B',
      'exportação por download e reimportação pelo input preservam a simulação',
      'autosave normal, recuperação do backup e fallback explícito sem backup',
      'zero requisições externas e zero erros de console',
      'app abre com os 3 efeitos tocando em loop, aba Partículas',
      'preset de explosão com 8 cubos vermelhos e 8 esferas amarelas, 48 tracks de posição',
    ],
    limitations: [
      'A integração no jogo/F4 não foi autorizada nem executada.',
      'FPS e comportamento em GPUs/hardwares diferentes não foram medidos.',
      'Qualidade artística continua sendo julgamento humano.',
      'A sequência de quadros é uma amostra de tempos, não uma captura contínua de vídeo.',
    ],
  };
  await writeFile(path.join(evidence, 'resultado.json'), JSON.stringify(result, null, 2));

  const frameScript = JSON.stringify([0, 1, 2, 3].map(index => `frames/frame-${index}.png`));
  const cards = created.map((effect, index) => `<article><h3>${effect.name}</h3><img src="efeito-${index + 1}-${effect.key}.png" alt="${effect.name} no canvas"><p>${effect.snapshot} partículas · ${effect.mode} · ${effect.shape}</p></article>`).join('');
  const gallery = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>VFX Composer · auditoria E2E</title><style>body{margin:0;background:#07101b;color:#e8f2ff;font:16px/1.55 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:28px}a{color:#7dd3fc}h1{margin:0 0 4px}p{color:#a9c4de}small{color:#7f98b8}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:22px 0}article{background:#0d1828;border:1px solid #27405c;border-radius:14px;padding:14px}img{width:100%;border-radius:9px;border:1px solid #294866;background:#050b14}h3{margin:0 0 10px;font-size:17px}.hero{display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-top:20px}.seq img{image-rendering:auto}.tag{display:inline-block;border:1px solid #2f7d5b;background:#0f2a20;color:#8ef0c0;border-radius:999px;padding:3px 9px;font-size:12px;font-weight:700}ul{color:#b7cde3}@media(max-width:820px){.hero{grid-template-columns:1fr}}</style><main><span class="tag">Aprovado · Edge headless · offline</span><h1>VFX Composer — 3 efeitos reais</h1><p>Auditoria E2E criada dentro do próprio Composer. <a href="../../dist/arenamon-vfx-composer.html">Abrir o app e ver ao vivo</a>.</p><div class="cards">${cards}</div><div class="hero"><section><h3>Cena com os três efeitos</h3><img src="tres-efeitos.png" alt="Três efeitos juntos no canvas"><p>Brasa, névoa e estilhaço simultâneos; ${combinedSnapshot.length} partículas, ${budget.cost.drawCalls} draw calls.</p></section><section class="seq"><h3>Sequência real do canvas</h3><img id="frame" src="frames/frame-0.png" alt="Quadro da animação"><p><small id="frame-label">quadro 1 de 4</small></p><p><a href="comparacao-ab.png">Comparação A/B</a> · <a href="quarks-3-efeitos.png">Quarks</a> · <a href="composer-tres-efeitos.png">App completo</a></p></section></div><h2>No próprio app, ao vivo</h2><div class="cards"><article><h3>Demonstração ao abrir</h3><img src="app-demo-em-tempo-real.png" alt="Três efeitos tocando ao abrir o app"><p>Os 3 efeitos carregam e tocam em loop, na aba Partículas.</p></article><article><h3>Explosão: cubos + esferas</h3><img src="explosao-cubos-esferas.png" alt="8 cubos vermelhos e 8 esferas amarelas explodindo"><p>8 cubos <b>#ff2b2b</b> + 8 esferas <b>#ffd400</b>, 48 tracks de posição, em loop.</p></article></div><h2>O que foi verificado</h2><ul>${result.checks.map(check => `<li>${check}</li>`).join('')}</ul><h2>Limites</h2><ul>${result.limitations.map(limit => `<li>${limit}</li>`).join('')}</ul><p><small>Resultado estruturado: <a href="resultado.json">resultado.json</a>. Relatório: <a href="../../../../docs/VFX_COMPOSER_F3_AUDITORIA.md">docs/VFX_COMPOSER_F3_AUDITORIA.md</a>.</small></p><script>const frames=${frameScript};let index=0;const image=document.querySelector('#frame'),label=document.querySelector('#frame-label');setInterval(()=>{index=(index+1)%frames.length;image.src=frames[index];label.textContent='quadro '+(index+1)+' de '+frames.length;},160);</script></main></html>`;
  await writeFile(path.join(evidence, 'index.html'), gallery);

  console.log(`✓ F3 auditoria E2E: 3 efeitos, ${combinedSnapshot.length} partículas, ${budget.cost.drawCalls} draw calls, backup recuperado e zero erros offline.`);
} finally {
  await browser.close();
}
