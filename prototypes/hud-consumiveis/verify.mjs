// Verificação no navegador do Laboratório HUD & Consumíveis (HTML único, offline, file://).
// Abre dist/hud-consumiveis-laboratorio.html com a rede desligada, testa as 9 combinações, os 5 atributos nos
// estágios 0–4, a persistência de estado ao trocar propostas, câmera, inspeção, legibilidade em 720p/1080p e
// grava capturas em evidence/. Observação: usa WebGL por software (SwiftShader); não mede desempenho de GPU real.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('.', import.meta.url));
const ev = root + 'evidence/';
await mkdir(ev, {recursive: true});
const browser = await chromium.launch({channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']});
const errors = [], external = [], failed = [];
const A = '__ARENAMON_HUD_CONSUMIVEIS__';

// Valores aprovados (R5.5–R5.8, R6.9–R6.13), escritos de forma independente do código-fonte do laboratório.
const EXPECT = {
  attack: s => `+${10 * s}%`,
  defense: s => `−${10 * s} p.p.`,
  stamina: s => `+${s}`,
  cooldown: s => `−${10 * s}%`,
  speed: s => `+${5 * s}%`,
};
const ATTRS = Object.keys(EXPECT);
const ITEM_IDS = ['hp', 'stamRec', 'attack', 'defense', 'stamina', 'cooldown', 'speed'];

try {
  const ctx = await browser.newContext({viewport: {width: 1280, height: 720}});
  await ctx.setOffline(true);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => failed.push(r.url()));
  page.on('request', r => { if (/^https?:/.test(r.url())) external.push(r.url()); });

  const url = pathToFileURL(root + 'dist/hud-consumiveis-laboratorio.html').href;
  assert.ok(url.startsWith('file://'), 'abre por file://');
  await page.goto(url);
  await page.waitForFunction(k => window[k]?.frames > 5, A);
  const E = fn => page.evaluate(`(${fn.toString()})(window.${A})`);
  const frames = () => page.evaluate(k => window[k].frames, A);
  const wait = async n => { const f = await frames(); await page.waitForFunction(([k, t]) => window[k].frames > t, [A, f + n], {timeout: 120000}); };

  // ---- 1. cena 3D e consumíveis ----
  await wait(10);
  let info = await E(a => a.info());
  assert.ok(info.triangles > 5000, 'cenário 3D renderiza (triângulos: ' + info.triangles + ')');
  assert.equal(info.visibleItems, 7, 'sete consumíveis visíveis');
  const counts = await E(a => a.itemMeshCounts());
  for (const s of ['A', 'B', 'C']) {
    assert.equal(counts[s].length, 7, `coleção ${s}: 7 representações`);
    assert.ok(counts[s].every(n => n >= 4), `coleção ${s}: cada item tem malhas próprias ${counts[s]}`);
  }
  const names = await E(a => a.field.items.map(i => i.type.id));
  assert.deepEqual(names, ITEM_IDS, 'os 7 tipos oficiais, na ordem');
  const shot0 = await page.screenshot();
  assert.ok(shot0.length > 60000, 'captura não está em branco (' + shot0.length + ' bytes)');

  // ---- 2. valores dos 5 atributos nos estágios 0–4, nas três propostas de HUD ----
  const read = () => page.evaluate(() => {
    const q = sel => [...document.querySelectorAll(sel)].map(e => e.textContent.trim());
    const on = sel => [...document.querySelectorAll(sel)].map(e => e.classList.contains('on'));
    return {
      A: Object.fromEntries([...document.querySelectorAll('.ha-cell')].map(c => [c.dataset.attr, {val: c.querySelector('.ha-val').textContent, on: [...c.querySelectorAll('.seg')].filter(s => s.classList.contains('on')).length, stage: c.dataset.stage}])),
      B: Object.fromEntries([...document.querySelectorAll('.hb-chip')].map(c => [c.dataset.attr, {val: c.querySelector('em').textContent, stage: c.dataset.stage}])),
      C: Object.fromEntries([...document.querySelectorAll('.hc-card')].map(c => [c.dataset.attr, {val: c.querySelector('.hc-val').textContent, on: [...c.querySelectorAll('.gem')].filter(s => s.classList.contains('on')).length, stage: c.dataset.stage}])),
    };
  });
  for (const attr of ATTRS) {
    for (let s = 0; s <= 4; s++) {
      await page.evaluate(([k, at, n]) => window[k].setStage(at, n), [A, attr, s]);
      const r = await read();
      for (const h of ['A', 'B', 'C']) {
        assert.equal(r[h][attr].val, EXPECT[attr](s), `HUD ${h} · ${attr} estágio ${s}`);
        assert.equal(r[h][attr].stage, String(s));
        if (r[h][attr].on !== undefined) assert.equal(r[h][attr].on, s, `HUD ${h} · ${attr}: ${s} indicadores preenchidos`);
      }
    }
    await page.evaluate(([k, at]) => window[k].setStage(at, 0), [A, attr]);
  }
  // pontos do radar acesos (B)
  await page.evaluate(k => window[k].setStage('attack', 3), A);
  assert.equal(await page.evaluate(() => document.querySelectorAll('.hb-dot.on').length), 3, 'radar: 3 pontos acesos em Ataque');
  await page.evaluate(k => window[k].setStage('attack', 0), A);
  // limites: não passa de 4 nem abaixo de 0
  await page.evaluate(k => { window[k].setStage('speed', 9); }, A);
  assert.equal(await page.evaluate(k => window[k].hud.stages.speed, A), 4, 'estágio limitado a 4');
  await page.evaluate(k => { window[k].setStage('speed', -3); }, A);
  assert.equal(await page.evaluate(k => window[k].hud.stages.speed, A), 0, 'estágio limitado a 0');

  // ---- 3. exemplo do enunciado e 9 combinações ----
  const example = {attack: 3, defense: 2, stamina: 1, cooldown: 4, speed: 0};
  await page.evaluate(([k, ex]) => { for (const [a, n] of Object.entries(ex)) window[k].setStage(a, n); }, [A, example]);
  const posBefore = await E(a => a.field.items.map(i => i.slot.position.toArray().map(v => +v.toFixed(3))));
  for (const hudId of ['A', 'B', 'C']) {
    for (const itemId of ['A', 'B', 'C']) {
      await page.evaluate(([k, h, i]) => { window[k].setHud(h); window[k].setItems(i); }, [A, hudId, itemId]);
      await wait(8);
      const st = await E(a => ({stages: {...a.hud.stages}, hud: a.state.hud, items: a.state.items, vis: a.info().visibleItems, huds: [...document.querySelectorAll('.hud')].filter(e => !e.hidden).map(e => e.dataset.hud), live: a.fx.live.length}));
      assert.deepEqual(st.stages, example, `combinação HUD ${hudId} × itens ${itemId}: estágios preservados`);
      assert.deepEqual(st.huds, [hudId], 'apenas o HUD escolhido aparece');
      assert.equal(st.vis, 7); assert.equal(st.live, 7, 'sete emissores de partículas (quarks)');
      const pos = await E(a => a.field.items.map(i => i.slot.position.toArray().map(v => +v.toFixed(3))));
      assert.deepEqual(pos, posBefore, 'trocar propostas não reposiciona nem reinicializa os itens');
      await page.screenshot({path: `${ev}combo-hud${hudId}-itens${itemId}-720p.png`});
    }
  }
  const partic = await E(a => Math.max(...a.fx.live.map(l => l.system.particleNum)));
  assert.ok(partic > 0, 'partículas three.quarks nascem (máx. vivas: ' + partic + ')');
  // desligar partículas e animações
  await page.evaluate(k => { document.getElementById('chk-part').click(); }, A);
  assert.equal(await E(a => a.fx.live.length), 0, 'partículas desligadas');
  await page.evaluate(k => { document.getElementById('chk-part').click(); }, A);
  assert.equal(await E(a => a.fx.live.length), 7, 'partículas religadas');

  // ---- 4. controles: gaveta, steppers, zerar/máximo, ocultar, escala ----
  await page.click('#btn-panel');
  assert.equal(await page.isVisible('#drawer'), true, 'gaveta abre');
  await page.evaluate(k => window[k].hudAll(0), A);
  await page.click('.arow:nth-child(1) [data-act=inc]');
  assert.equal((await read()).A.attack.val, '+10%', 'botão + do painel aumenta o estágio');
  await page.click('.arow:nth-child(1) [data-act=dec]');
  assert.equal((await read()).A.attack.val, '+0%', 'botão − do painel diminui o estágio');
  await page.click('#btn-max');
  let r = await read();
  assert.ok(ATTRS.every(a => r.C[a].stage === '4' && r.C[a].val === EXPECT[a](4)), 'Todos no máximo');
  await page.click('#btn-zero');
  r = await read();
  assert.ok(ATTRS.every(a => r.C[a].stage === '0' && r.C[a].val === EXPECT[a](0)), 'Zerar todos');
  await page.fill('#hud-scale', '140'); await page.dispatchEvent('#hud-scale', 'input');
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('hud-root')).getPropertyValue('--hud-scale')).then(v => +v), 1.4, 'escala do HUD');
  await page.fill('#hud-scale', '100'); await page.dispatchEvent('#hud-scale', 'input');
  await page.click('#btn-hidehud');
  assert.equal(await page.evaluate(() => document.getElementById('hud-root').hidden), true, 'ocultar HUD');
  await page.click('#btn-hidehud');
  assert.equal(await page.evaluate(() => document.getElementById('hud-root').hidden), false, 'exibir HUD');
  await page.keyboard.press('2');
  assert.equal(await E(a => a.state.hud), 'B', 'tecla 2 = HUD B');
  await page.keyboard.press('6');
  assert.equal(await E(a => a.state.items), 'C', 'tecla 6 = itens C');
  await page.screenshot({path: ev + 'painel-controles-720p.png'});
  await page.click('#btn-panel');

  // ---- 5. inspeção e simulação de coleta (somente demonstração) ----
  await page.evaluate(k => { window[k].hudAll(0); window[k].select(window[k].field.items[2]); }, A);
  assert.equal(await page.isVisible('#inspect'), false, 'cartão de inspeção fica na gaveta fechada');
  await page.click('#btn-panel');
  assert.equal(await page.textContent('#ins-nome'), 'Evolução de Ataque');
  await page.click('#btn-collect');
  assert.equal((await read()).A.attack.stage, '1', 'coleta demonstrativa avança um estágio');
  assert.ok((await page.textContent('#toast')).includes('DEMONSTRAÇÃO'), 'aviso de demonstração');
  await page.evaluate(k => window[k].collectDemo(window[k].field.items[0]), A);
  r = await read();
  assert.ok(ATTRS.filter(a => a !== 'attack').every(a => r.A[a].stage === '0'), 'item de HP não altera estágios');
  await wait(20);
  await page.screenshot({path: ev + 'inspecao-720p.png'});
  await page.click('#btn-panel');
  await page.evaluate(k => window[k].select(null), A);

  // ---- 6. câmera ----
  for (const name of ['frente', 'lado', 'cima', 'vitrine', 'inicial']) {
    await page.evaluate(([k, n]) => window[k].setCameraPreset(n, true), [A, name]);
    const pos = await E(a => a.camera.position.toArray());
    assert.ok(pos.every(Number.isFinite), `câmera ${name} válida`);
  }
  await page.evaluate(k => window[k].setCameraPreset('lado'), A);
  await wait(30);
  const lado = await E(a => a.camera.position.toArray());
  assert.ok(Math.abs(lado[0] - 16) < 0.5 && Math.abs(lado[1] - 3.2) < 0.5, 'câmera anima até o preset Lado: ' + lado);
  await page.evaluate(k => window[k].setCameraPreset('inicial', true), A);
  await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(760, 380, {steps: 4}); await page.mouse.up();
  await wait(6);
  assert.ok(Math.abs((await E(a => a.camera.position.x))) > 0.2, 'arrastar gira a câmera');
  await page.mouse.move(640, 400); await page.mouse.wheel(0, -600);
  await wait(6);
  await page.evaluate(k => window[k].setCameraPreset('inicial', true), A);
  await page.keyboard.press('r');

  // ---- 7. legibilidade e ocupação em 720p e 1080p ----
  for (const [w, h, tag] of [[1280, 720, '720p'], [1920, 1080, '1080p']]) {
    await page.setViewportSize({width: w, height: h});
    await page.evaluate(k => { window[k].setItems('A'); window[k].setLayout('arena'); window[k].setCameraPreset('inicial', true); Object.entries({attack: 3, defense: 2, stamina: 1, cooldown: 4, speed: 0}).forEach(([a, n]) => window[k].setStage(a, n)); }, A);
    for (const hudId of ['A', 'B', 'C']) {
      await page.evaluate(([k, hh]) => window[k].setHud(hh), [A, hudId]);
      await wait(10);
      const m = await page.evaluate(([vw, vh]) => {
        const root = document.querySelector(`.hud[data-hud="${vw.hud}"]`);
        const box = root.getBoundingClientRect();
        let minFont = 99;
        const scale = box.width / root.offsetWidth || 1;
        for (const el of root.querySelectorAll('*')) {
          if (el.children.length === 0 && el.textContent.trim().length && !(el instanceof SVGElement)) minFont = Math.min(minFont, parseFloat(getComputedStyle(el).fontSize) * scale);
        }
        const kids = [...root.querySelectorAll('.ha-cell,.hb-chip,.hc-card,.hb-svg')].map(e => e.getBoundingClientRect());
        const x0 = Math.min(...kids.map(k => k.left)), x1 = Math.max(...kids.map(k => k.right)), y0 = Math.min(...kids.map(k => k.top)), y1 = Math.max(...kids.map(k => k.bottom));
        return {minFont, x0, x1, y0, y1, scale};
      }, [{hud: hudId}, [w, h]]);
      assert.ok(m.minFont >= 10.9, `HUD ${hudId} ${tag}: fonte mínima ${m.minFont.toFixed(1)}px`);
      // não cobre a região central (35–65% × 30–70%)
      const cx0 = w * .35, cx1 = w * .65, cy0 = h * .3, cy1 = h * .7;
      const overlap = m.x0 < cx1 && m.x1 > cx0 && m.y0 < cy1 && m.y1 > cy0;
      assert.equal(overlap, false, `HUD ${hudId} ${tag} não cobre o centro da arena (${JSON.stringify(m)})`);
      assert.ok(m.x0 >= 0 && m.y0 >= 0 && m.x1 <= w && m.y1 <= h, `HUD ${hudId} ${tag} dentro da tela`);
      await page.screenshot({path: `${ev}hud${hudId}-${tag}.png`});
    }
  }
  await page.setViewportSize({width: 1280, height: 720});

  // ---- 8. vitrine: cada coleção em close ----
  for (const s of ['A', 'B', 'C']) {
    await page.evaluate(([k, st]) => { window[k].setItems(st); window[k].setHud('C'); window[k].hudAll(2); window[k].setLayout('vitrine'); window[k].setCameraPreset('vitrine', true); }, [A, s]);
    await wait(60);
    await page.screenshot({path: `${ev}itens${s}-vitrine-720p.png`});
  }
  await page.evaluate(k => { window[k].setLayout('arena'); window[k].setCameraPreset('inicial', true); }, A);

  // ---- 9. saúde geral ----
  await wait(10);
  info = await E(a => a.info());
  assert.deepEqual(errors, [], 'sem erros de JavaScript/console: ' + errors.join(' | '));
  assert.deepEqual(external, [], 'sem requisições externas');
  assert.deepEqual(failed, [], 'sem recursos ausentes: ' + failed.join(' | '));
  console.log('OK · HUD & Consumíveis:', JSON.stringify({drawCalls: info.drawCalls, triangles: info.triangles, geometries: info.geometries, partic}));
} finally {
  await browser.close();
}
