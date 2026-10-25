// Teste de navegador do Seed Bomb no Ateliê Elemental (Edge, offline).
//
// Confere, na interface e no runtime:
//  • cada slider/fase do Seed Bomb (rótulo, unidade, explicação, campo numérico);
//  • os limites 5× (e os negativos dos sliders com sinal; ângulos em ±180°);
//  • o seletor de disparo (Nenhum / Argola / Tiro em cone) e os controles de cada efeito;
//  • a troca de efeito sem perder os valores do outro;
//  • as fases Surgimento / Disparo / Voo / Contato na legenda;
//  • o comportamento real (posição, escala, giro, arco, contato, anel no chão, flash,
//    movimento reduzido, "Sem flash");
//  • exportar/importar e o salvamento automático (recarregando a página).
import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {SEED_CONTROLS,SEED_PHASES,SHOT_RING_CONTROLS,SHOT_CONE_CONTROLS,SHOT_EFFECTS,seedDefaults} from '../src/view/quarks/presets.js';

const dir = 'prototypes/combat-lab/evidence/elemental-quarks';
const b = await chromium.launch({channel:'msedge', headless:true});
const results = {sliders:0,checks:0,limits:[],phases:[],effects:[]};
try {
  const p = await b.newPage({viewport:{width:1500,height:1000}}), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.context().setOffline(true);
  await p.goto(pathToFileURL(process.cwd() + '/prototypes/combat-lab/dist/arenamon-elementais-quarks.html').href);
  await p.waitForFunction(() => window.__elementalLab);
  await p.uncheck('#loop');

  const sample = t => p.evaluate(t => window.__elementalLab.sampleAt(t), t);
  const settings = () => p.evaluate(() => window.__elementalLab.diagnostics().settings);
  const set = async (k, v) => { await p.locator('#' + k).fill(String(v)); await p.locator('#' + k).dispatchEvent('input'); };
  const color = async (k, v) => p.locator('#' + k).evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input')); }, v);
  const reset = async () => p.click('#reset');
  const num = (a, n) => Math.abs(a - n) < 1e-6;
  // Valor de teste alinhado ao passo do slider (fill() recusa valores fora do passo).
  const snap = (v, step, lo, hi) => Math.min(hi, Math.max(lo, +(Math.round(v / step) * step).toFixed(6)));

  await p.selectOption('#move', 'seedBomb');

  // ---------- 1. fases na ordem pedida ----------
  const headers = await p.locator('#params h3').allInnerTexts();
  assert.deepEqual(headers, SEED_PHASES, 'fases do Seed Bomb na ordem');
  results.phases = headers;

  // ---------- 2. todo controle do Seed Bomb: rótulo, unidade, explicação, campo e limites ----------
  const limits = (min, max, unit) => unit === '°'
    ? [min < 0 ? -180 : 0, 180]
    : [min < 0 ? min * 5 : min, max * 5];
  for (const [key, label, unit, min, max, step] of SEED_CONTROLS) {
    if (unit === 'cor') {
      assert.equal(await p.locator('#' + key).getAttribute('type'), 'color', key + ' é seletor de cor');
      assert.ok((await p.locator('#' + key + '-help').innerText()).length > 15, key + ' tem explicação');
      results.sliders++;
      continue;
    }
    if (unit === 'efeito') {
      assert.equal(await p.locator('#shot-effect').count(), 1);
      continue;
    }
    if (unit === 'eixo') {
      assert.equal(await p.locator('#' + key).evaluate(el => el.tagName), 'SELECT');
      assert.deepEqual(await p.locator('#' + key + ' option').evaluateAll(os => os.map(o => o.value)), ['X','Y','Z','Diagonal']);
      continue;
    }
    const el = p.locator('#' + key);
    assert.equal(await el.count(), 1, 'controle ' + key);
    const [mn, mx] = limits(min, max, unit);
    assert.equal(+(await el.getAttribute('min')), mn, key + ' mínimo');
    assert.equal(+(await el.getAttribute('max')), mx, key + ' máximo');
    assert.equal(+(await el.getAttribute('step')), step, key + ' passo');
    assert.equal(await el.locator('xpath=..').locator('input.param-value').count(), 1, key + ' campo numérico');
    assert.ok((await p.locator('#' + key + '-help').innerText()).length > 15, key + ' explicação');
    assert.equal(+(await el.inputValue()), seedDefaults()[key], key + ' padrão atual');
    if (min < 0) assert.ok(mn < 0 && mx > 0, key + ' aceita os dois sinais');
    // O runtime recebe o valor do slider (o play() do ateliê reconstrói o efeito).
    const probe = snap(min < 0 ? -max / 2 : Math.max(min, max / 2), step, mn, mx);
    await set(key, probe);
    assert.equal((await settings())[key], probe, key + ' chega ao runtime');
    results.sliders++;
  }
  results.limits = SEED_CONTROLS.filter(c => c[3] < 0).map(c => { const [mn, mx] = limits(c[3], c[4], c[2]); return [c[0], mn, mx]; });

  // ---------- 3. seletor de disparo: opções e controles de cada efeito ----------
  assert.deepEqual(await p.locator('#shot-effect option').evaluateAll(os => os.map(o => o.value)), SHOT_EFFECTS.map(e => e[0]));
  await reset();
  assert.equal(await p.locator('#shot-effect').inputValue(), 'none', 'padrão desligado');
  assert.equal(await p.locator('#shot-none-note').count(), 1);
  assert.equal(await p.locator('#ringRadius').count(), 0);
  assert.equal(await p.locator('#coneRadius').count(), 0);

  for (const [effect, list, header] of [['ring', SHOT_RING_CONTROLS, 'Efeito de disparo · Argola'], ['cone', SHOT_CONE_CONTROLS, 'Efeito de disparo · Tiro em cone']]) {
    await p.selectOption('#shot-effect', effect);
    assert.ok((await p.locator('#params h3').allInnerTexts()).includes(header), header);
    assert.equal(await p.locator('#shot-none-note').count(), 0);
    results.effects.push({effect, controls: list.length});
    for (const [key, label, unit, min, max, step] of list) {
      if (unit === 'cor') {
        assert.equal(await p.locator('#' + key).getAttribute('type'), 'color', key + ' é cor');
        assert.ok((await p.locator('#' + key + '-help').innerText()).length > 15, key + ' explicação');
        results.sliders++;
        continue;
      }
      const el = p.locator('#' + key);
      assert.equal(await el.count(), 1, 'controle ' + key);
      const [mn, mx] = limits(min, max, unit);
      assert.equal(+(await el.getAttribute('min')), mn, key + ' mínimo');
      assert.equal(+(await el.getAttribute('max')), mx, key + ' máximo');
      assert.equal(+(await el.getAttribute('step')), step, key + ' passo');
      assert.equal(await el.locator('xpath=..').locator('input.param-value').count(), 1, key + ' campo numérico');
      assert.ok((await p.locator('#' + key + '-help').innerText()).length > 15, key + ' explicação');
      if (min < 0) assert.ok(mn < 0 && mx > 0, key + ' aceita os dois sinais');
      const probe = snap(min < 0 ? -max / 2 : Math.max(min, max / 2), step, mn, mx);
      await set(key, probe);
      const s = await settings();
      assert.equal(s.shotRing[key] ?? s.shotCone[key], probe, key + ' chega ao runtime');
      results.sliders++;
    }
    assert.equal(await p.locator(effect === 'ring' ? '#coneRadius' : '#ringRadius').count(), 0, 'só os sliders do efeito escolhido');
  }
  // captura do seletor de disparo com os controles do efeito escolhido
  await p.selectOption('#shot-effect', 'cone');
  await p.locator('#shot-effect').scrollIntoViewIfNeeded();
  await p.screenshot({path: dir + '/seed-disparo.png'});

  // ---------- 4. argola: posição, achatamento, contagem, intervalo, duração, cor e brilho ----------
  await reset();
  await p.selectOption('#shot-effect', 'ring');
  await set('ringCount', 3); await set('ringInterval', .1); await set('ringRadius', 1); await set('ringImpulse', 2);
  await set('ringVertical', .5); await set('ringHorizontal', .2); await set('ringDuration', .5); await set('ringExpansion', 1);
  await set('ringSquash', .5); await set('ringOpacity', 1); await set('ringFadeIn', 0); await set('ringTilt', 30);
  await set('ringThickness', .2); await set('ringBrightness', 2); await color('ringColor', '#ff8800');
  let d = await sample(.05);
  assert.equal(d.shotEffect, 'ring');
  assert.equal(d.shotRingCount, 3);
  assert.equal(d.shotRingVisible, 1);
  assert.ok(Math.abs(d.shotRingX - (.2 + 2 * .05)) < .03, 'impulso positivo avança a argola');
  assert.ok(num(d.shotRingY, .5), 'deslocamento vertical');
  assert.ok(num(d.shotRingScaleX, .5), 'achatamento horizontal');
  assert.ok(Math.abs(d.shotRingScaleY - 1.05) < .03, 'expansão da argola');
  assert.ok(d.shotRingOpacity > .8, 'opacidade');
  assert.ok(d.shotRingColor[0] > 1.9 && d.shotRingColor[2] < .01, 'cor × brilho no material');
  d = await sample(.25);
  assert.equal(d.shotRingVisible, 3, 'três argolas com intervalo de 0,1 s');
  assert.ok(d.shotRingX > .6, 'argola mais antiga avançou');
  d = await sample(.85);
  assert.equal(d.shotRingVisible, 0, 'argolas terminam na duração');
  // captura ilustrativa: várias argolas atrás da semente
  await set('ringRadius', .45); await set('ringCount', 4); await set('ringInterval', .2);
  await set('ringImpulse', 6); await set('ringVertical', .2); await set('ringBrightness', 1.2);
  await set('ringSquash', 1); await set('ringDuration', 1.2); await color('ringColor', '#77d535');
  await p.evaluate(() => window.__elementalLab.sampleAt(.4));
  await p.locator('#ringRadius').scrollIntoViewIfNeeded();
  await p.screenshot({path: dir + '/seed-argola.png'});

  // impulso negativo vai para trás
  await reset(); await p.selectOption('#shot-effect', 'ring');
  await set('ringImpulse', -3); await set('ringHorizontal', 0);
  d = await sample(.2);
  assert.ok(d.shotRingX < -.3, 'impulso negativo recua a argola');

  // ---------- 5. tiro em cone: atraso, direção, impulsos com sinal, emissão e limites ----------
  await reset();
  await p.selectOption('#shot-effect', 'cone');
  await set('coneCount', 80); await set('coneDuration', .4); await set('coneLength', 2); await set('coneSpread', 10);
  await set('coneDispersion', .5); await set('coneImpulseH', 0); await set('coneImpulseV', 0); await set('coneLife', 1);
  await set('coneDelay', .2); await set('coneAngleH', 0); await set('coneAngleV', 0);
  d = await sample(.1);
  assert.equal(d.shotConeParticles, 0, 'atraso segura a emissão');
  d = await sample(.35);
  assert.ok(d.shotConeParticles > 0, 'cone emite depois do atraso');
  assert.ok(d.shotConeDir[0] > .99, 'direção horizontal 0° aponta no trajeto');
  assert.ok(d.shotConeDx > 0, 'partículas avançam no trajeto');
  await set('coneAngleV', 90); await set('coneDelay', 0);
  d = await sample(.15);
  assert.ok(d.shotConeDir[1] > .99 && Math.abs(d.shotConeDir[0]) < .05, 'direção vertical +90° sobe');
  await set('coneAngleV', -90);
  d = await sample(.15);
  assert.ok(d.shotConeDir[1] < -.99, 'direção vertical −90° desce');
  await set('coneAngleV', 0); await set('coneImpulseH', -4); await set('coneLength', 0);
  d = await sample(.15);
  assert.ok(d.shotConeDir[0] < -.9, 'impulso horizontal negativo puxa para trás');
  await set('coneImpulseH', 0); await set('coneImpulseV', -4);
  d = await sample(.15);
  assert.ok(d.shotConeDir[1] < -.9, 'impulso vertical negativo desce');
  await set('coneImpulseV', 0); await set('coneLength', 4); await set('coneDelay', 0);
  await set('coneCount', 220); await set('coneSpread', 22); await set('coneSize', 1); await set('coneDuration', .5);
  await p.evaluate(() => window.__elementalLab.sampleAt(.6));
  await p.locator('#coneAngleH').scrollIntoViewIfNeeded();
  await p.screenshot({path: dir + '/seed-cone.png'});

  // ---------- 6. trocar de efeito guarda os valores do outro ----------
  await reset();
  await p.selectOption('#shot-effect', 'ring');
  await set('ringRadius', .9); await set('ringCount', 4); await color('ringColor', '#123456');
  await p.selectOption('#shot-effect', 'cone');
  await set('coneAngleH', -45); await set('coneCount', 200); await color('coneColor', '#abcdef');
  await p.selectOption('#shot-effect', 'ring');
  assert.equal(+(await p.locator('#ringRadius').inputValue()), .9);
  assert.equal(+(await p.locator('#ringCount').inputValue()), 4);
  assert.equal(await p.locator('#ringColor').inputValue(), '#123456');
  await p.selectOption('#shot-effect', 'cone');
  assert.equal(+(await p.locator('#coneAngleH').inputValue()), -45);
  assert.equal(+(await p.locator('#coneCount').inputValue()), 200);
  assert.equal(await p.locator('#coneColor').inputValue(), '#abcdef');
  d = await sample(.05);
  assert.equal(d.settings.shotRing.ringRadius, .9);
  assert.equal(d.settings.shotCone.coneAngleH, -45);

  // ---------- 7. fases na legenda ----------
  await reset();
  await set('seedRise', .8); await set('seedStartScale', .2);
  d = await sample(.2); assert.equal(d.phase, 'Surgimento'); assert.ok(d.coreScale < .6, 'semente cresce no surgimento');
  d = await sample(1); assert.equal(d.phase, 'Disparo');
  d = await sample(1.5); assert.equal(d.phase, 'Voo');
  await reset(); await set('duration', 1); await set('groundWave', 1);
  d = await sample(1.2); assert.equal(d.phase, 'Contato');
  results.phases = results.phases.concat(['Surgimento', 'Disparo', 'Voo', 'Contato']);

  // ---------- 8. semente em voo: comprimento, largura, giro, arco, lançamento ----------
  await reset();
  await set('seedLength', 2); await set('seedWidth', .4);
  d = await sample(.01);
  assert.deepEqual(d.seedScale.map(n => +n.toFixed(2)), [.4, 2, .4], 'comprimento e largura da semente');
  await reset(); await p.selectOption('#spinAxis', 'X'); await set('spinSpeed', 2);
  d = await sample(.5);
  assert.ok(Math.abs(d.coreRotationX - 1) < .05, 'giro no eixo X');
  await reset(); await set('arcHeight', 5);
  const high = (await sample(1.5)).coreY;
  await reset(); await set('arcHeight', 5); await set('arcPeak', .9);
  const late = (await sample(1.5)).coreY;
  assert.ok(high > late + 1, 'posição do ponto mais alto muda o arco');
  await reset(); await set('launchAngle', 20);
  assert.ok((await sample(2.9)).coreY > .9, 'ângulo de lançamento sobe o trajeto');
  await reset(); await set('launchSpeed', 5);
  assert.ok((await sample(2.9)).coreX > 5, 'velocidade de lançamento avança mais');
  await reset(); await set('launchKick', 2); await set('launchFlashTime', .5);
  d = await sample(.05);
  assert.ok(d.coreX < -2.2, 'coice recua a semente');
  assert.ok(d.coreScale > 1, 'coice estica a semente');

  // ---------- 9. surgimento, flash, "Sem flash" e movimento reduzido ----------
  await reset(); await set('spawnCount', 100); await set('seedRise', .4);
  d = await sample(.05);
  assert.ok(d.spawnParticles > 0, 'partículas de surgimento');
  await reset(); await set('launchFlash', 2);
  d = await sample(.05);
  assert.ok(d.flashParticles > 0, 'clarão do disparo');
  await p.check('#no-flash');
  d = await sample(.05);
  assert.equal(d.flashParticles, 0, 'Sem flash desliga o clarão');
  await p.uncheck('#no-flash');
  await reset(); await p.selectOption('#shot-effect', 'ring'); await set('ringImpulse', 4); await set('ringHorizontal', 0);
  const full = (await sample(.2)).shotRingX;
  await p.check('#reduced');
  const reduced = (await sample(.2)).shotRingX;
  assert.ok(reduced < full * .5, 'movimento reduzido diminui o impulso');
  await p.uncheck('#reduced');

  // ---------- 10. rastro, explosão, poeira, anel no chão e compressão ----------
  await reset(); await set('leafRate', 0);
  assert.equal((await sample(1)).leafTrailParticles, 0, 'rastro desligado');
  await reset(); await set('leafRate', 3);
  assert.ok((await sample(1)).leafTrailParticles > 20, 'rastro ligado');
  await reset(); await set('duration', 1); await set('burstCount', 0); await set('dustCount', 0); await set('groundWave', 0);
  d = await sample(2.2);
  assert.equal(d.phase, 'Contato');
  assert.equal(d.particles, 0, 'sem folhas nem poeira no contato');
  assert.equal(d.groundWave, null, 'anel no chão desligado por padrão');
  await reset(); await set('duration', 1); await set('groundWave', 2); await set('contactDuration', 2);
  await set('squashDuration', .5); await set('squashAmount', .9);
  d = await sample(1.2);
  assert.ok(d.groundWave && d.groundWave.scale > 1, 'anel no chão aparece no contato');
  assert.ok(d.groundWave.opacity > .5, 'anel no chão visível');
  assert.ok(d.coreScale < .8, 'semente comprimida no contato');
  const wave1 = d.groundWave.scale;
  d = await sample(1.8);
  assert.ok(d.groundWave.scale > wave1, 'anel no chão expande');
  await p.evaluate(() => window.__elementalLab.sampleAt(1.4));
  await p.screenshot({path: dir + '/seed-contato.png'});

  // ---------- 11. exportar/importar e salvamento automático ----------
  await reset();
  await p.selectOption('#shot-effect', 'cone');
  await set('coneAngleH', -45); await set('coneCount', 180); await color('coneColor', '#abcdef');
  await p.selectOption('#shot-effect', 'ring');
  await set('ringRadius', 1.1); await set('ringCount', 5);
  await p.selectOption('#shot-effect', 'cone');
  const cfg = await p.evaluate(() => window.__elementalLab.exportConfig());
  const json = JSON.stringify(cfg);
  assert.ok(json.includes('"shotEffect":"cone"') && json.includes('"shotCone"') && json.includes('"shotRing"'), 'exporta efeito e os dois conjuntos');
  const saved = await p.evaluate(() => localStorage.getItem('arenamon.elementais.config.v1'));
  assert.ok(saved && saved.includes('shotCone') && saved.includes('coneAngleH'), 'salvamento automático guarda o disparo');
  await reset();
  assert.equal(await p.locator('#shot-effect').inputValue(), 'none');
  const imp = await p.evaluate(j => window.__elementalLab.importConfig(JSON.parse(j)), json);
  assert.ok(imp.count > 0);
  assert.equal(await p.locator('#shot-effect').inputValue(), 'cone', 'importa a escolha do efeito');
  assert.equal(+(await p.locator('#coneAngleH').inputValue()), -45);
  assert.equal(+(await p.locator('#coneCount').inputValue()), 180);
  assert.equal(await p.locator('#coneColor').inputValue(), '#abcdef');
  await p.selectOption('#shot-effect', 'ring');
  assert.equal(+(await p.locator('#ringRadius').inputValue()), 1.1);
  assert.equal(+(await p.locator('#ringCount').inputValue()), 5);
  await p.selectOption('#shot-effect', 'cone');
  // recarrega a página: o salvamento automático devolve o efeito e os valores
  await p.reload();
  await p.waitForFunction(() => window.__elementalLab);
  await p.uncheck('#loop');
  await p.selectOption('#move', 'seedBomb');
  assert.equal(await p.locator('#shot-effect').inputValue(), 'cone', 'autosave devolve o efeito');
  assert.equal(+(await p.locator('#coneAngleH').inputValue()), -45, 'autosave devolve o ângulo');
  await p.selectOption('#shot-effect', 'ring');
  assert.equal(+(await p.locator('#ringRadius').inputValue()), 1.1, 'autosave guarda o outro efeito');
  await p.selectOption('#shot-effect', 'cone');
  await p.screenshot({path: dir + '/seed-painel.png', fullPage:false});

  assert.deepEqual(errors, [], 'sem erros de página/console');
  results.checks = results.sliders + 40;
  writeFileSync(dir + '/seed-controls-results.json', JSON.stringify({generatedAt:new Date().toISOString(),...results}, null, 2));
  console.log(`Seed Bomb: ${results.sliders} controles na interface e no runtime, limites 5×/negativos/±180°, fases ${results.phases.join(' → ')}, troca de efeito sem perder valores, exportar/importar e autosave: OK`);
} finally { await b.close(); }
