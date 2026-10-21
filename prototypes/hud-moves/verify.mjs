// Verificação no navegador do Laboratório HUD de Vida, Stamina e Moves (HTML único, offline, file://).
// Abre dist/hud-moves-laboratorio.html com a rede desligada e testa: troca A/B/C sem perder o estado, HP/stamina dos dois
// lutadores, os 4 slots (nome, tecla, ícone), todos os estados nos três HUDs, os 4 cenários, escala/ocultar/resetar,
// animação de recarga/carga, câmeras, fundos, legibilidade em 720p e 1080p e grava capturas em evidence/.
// Observação: WebGL por software (SwiftShader); não mede desempenho de GPU real.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('.', import.meta.url));
const ev = root + 'evidence/';
await mkdir(ev, {recursive: true});
const browser = await chromium.launch({channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']});
const errors = [], external = [], failed = [];
const A = '__ARENAMON_HUD_MOVES__';

// seletores por HUD (independentes entre si, pois cada proposta tem estrutura própria)
const SEL = {
  A: {me: '.a-me', foe: '.a-foe', hp: '.a-hpnum b', st: '.a-st b', slot: '.a-card', name: '.a-mname', key: '.a-key span', ico: '.a-ico svg', blocks: '.a-slab,.a-card'},
  B: {me: '.b-me', foe: '.b-foe', hp: '.b-num b', st: '.b-dot', slot: '.b-mv', name: '.b-mname', key: '.b-key', ico: '.b-ico svg', blocks: '.b-panel,.b-vs,.b-mv'},
  C: {me: '.c-me', foe: '.c-foe', hp: '.c-hpn', st: '.c-st i', slot: '.c-slot', name: '.c-mn', key: '.c-key', ico: '.c-ico svg', blocks: '.c-fighter,.c-mid,.c-bar'},
};
const PRESET_STATES = {
  neutro: ['pronto', 'pronto', 'pronto', 'pronto'],
  avancado: ['pronto', 'recarga', 'recarga', 'pronto'],
  critica: ['semStamina', 'bloqueado', 'recarga', 'semStamina'],
  carga: ['carregando', 'pronto', 'recarga', 'bloqueado'],
};
const ALL_STATES = ['pronto', 'recarga', 'carregando', 'bloqueado', 'semStamina'];

try {
  const ctx = await browser.newContext({viewport: {width: 1280, height: 720}});
  await ctx.setOffline(true);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => failed.push(r.url()));
  page.on('request', r => { if (/^https?:/.test(r.url())) external.push(r.url()); });

  const url = pathToFileURL(root + 'dist/hud-moves-laboratorio.html').href;
  assert.ok(url.startsWith('file://'), 'abre por file://');
  await page.goto(url);
  await page.waitForFunction(k => window[k]?.frames > 5, A);
  const frames = () => page.evaluate(k => window[k].frames, A);
  const wait = async n => { const f = await frames(); await page.waitForFunction(([k, t]) => window[k].frames > t, [A, f + n], {timeout: 120000}); };
  const call = (fn, ...args) => page.evaluate(([k, f, a]) => window[k][f](...a), [A, fn, args]);
  const shown = () => page.evaluate(() => [...document.querySelectorAll('.hud')].filter(e => !e.hidden).map(e => e.dataset.hud));
  const text = (sel) => page.evaluate(s => document.querySelector(s)?.textContent.trim(), sel);
  const states = h => page.evaluate(([s]) => [...document.querySelectorAll(s)].map(e => e.dataset.state), [SEL[h].slot]);
  const stam = (h, who) => page.evaluate(([s]) => [...document.querySelectorAll(s)].map(e => +parseFloat(e.style.getPropertyValue('--f')).toFixed(2)), [`${SEL[h][who]} ${SEL[h].st}`]);

  // ---- 1. cena 3D e HUD inicial ----
  await wait(10);
  const info = await page.evaluate(k => window[k].info(), A);
  assert.ok(info.triangles > 3000, 'arena 3D renderiza (triângulos: ' + info.triangles + ')');
  assert.ok((await page.screenshot()).length > 60000, 'captura não está em branco');
  assert.deepEqual(await shown(), ['A'], 'HUD A inicial');

  // ---- 2. troca A/B/C sem recarregar e sem perder o estado ----
  await call('applyPreset', 'avancado');
  for (const h of ['A', 'B', 'C', 'B', 'A']) {
    await call('setHud', h);
    assert.deepEqual(await shown(), [h], `apenas o HUD ${h} aparece`);
    assert.deepEqual(await states(h), PRESET_STATES.avancado, `HUD ${h}: estados preservados na troca`);
  }
  for (const [key, h] of [['2', 'B'], ['3', 'C'], ['1', 'A']]) { await page.keyboard.press(key); assert.deepEqual(await shown(), [h], `tecla ${key} = HUD ${h}`); }

  // ---- 3. HP e stamina dos dois lutadores (nos três HUDs) ----
  await page.click('#btn-panel');
  assert.equal(await page.isVisible('#drawer'), true, 'painel de controles abre');
  const setRange = async (id, v) => { await page.fill('#' + id, String(v)); await page.dispatchEvent('#' + id, 'input'); };
  await setRange('ui-p-hp', 37); await setRange('ui-e-hp', 81); await setRange('ui-p-st', 1.7); await setRange('ui-e-st', 0.4);
  for (const h of ['A', 'B', 'C']) {
    await call('setHud', h); await wait(3);
    const fmt = v => (h === 'C' ? `${v} / 100` : String(v));
    assert.equal(await text(`${SEL[h].me} ${SEL[h].hp}`), fmt(37), `HUD ${h}: HP do jogador`);
    assert.equal(await text(`${SEL[h].foe} ${SEL[h].hp}`), fmt(81), `HUD ${h}: HP do adversário`);
    assert.deepEqual(await stam(h, 'me'), [1, 0.7, 0], `HUD ${h}: stamina do jogador 1.7`);
    assert.deepEqual(await stam(h, 'foe'), [0.4, 0, 0], `HUD ${h}: stamina do adversário 0.4`);
  }
  await setRange('ui-p-hp', 100); await setRange('ui-e-hp', 100); await setRange('ui-p-st', 3); await setRange('ui-e-st', 3);
  for (const h of ['A', 'B', 'C']) { await call('setHud', h); assert.deepEqual(await stam(h, 'me'), [1, 1, 1], `HUD ${h}: stamina cheia`); }

  // ---- 4. os 4 slots: nome, tecla, ícone ----
  for (let i = 0; i < 4; i++) {
    const box = page.locator(`.mvbox[data-i="${i}"]`);
    await box.locator('[data-f=name]').fill(`Teste ${i + 1}`);
    await box.locator('[data-f=key]').fill(['Z', 'X', 'C', 'V'][i]);
    await box.locator('[data-f=icon]').selectOption(['estrela', 'chama', 'gota', 'pedra'][i]);
  }
  for (const h of ['A', 'B', 'C']) {
    await call('setHud', h); await wait(3);
    const r = await page.evaluate(([S]) => [...document.querySelectorAll(S.slot)].map(e => ({n: e.querySelector(S.name).textContent, k: e.querySelector(S.key).textContent, ico: !!e.querySelector(S.ico)})), [SEL[h]]);
    assert.deepEqual(r.map(x => x.n), ['Teste 1', 'Teste 2', 'Teste 3', 'Teste 4'], `HUD ${h}: nomes dos 4 moves`);
    assert.deepEqual(r.map(x => x.k), ['Z', 'X', 'C', 'V'], `HUD ${h}: teclas dos 4 moves`);
    assert.ok(r.every(x => x.ico), `HUD ${h}: ícones renderizados`);
  }

  // ---- 5. estados de cada slot em cada HUD ----
  for (let i = 0; i < 4; i++) {
    for (const st of ALL_STATES) {
      await page.locator(`.mvbox[data-i="${i}"] [data-f=state]`).selectOption(st);
      for (const h of ['A', 'B', 'C']) {
        await call('setHud', h);
        const got = (await states(h))[i];
        assert.equal(got, st, `HUD ${h} slot ${i + 1}: estado ${st}`);
      }
    }
    await page.locator(`.mvbox[data-i="${i}"] [data-f=state]`).selectOption('pronto');
  }
  // pronto sem stamina suficiente vira "sem stamina" (derivado); bloqueado permanece bloqueado
  await call('applyPreset', 'neutro');
  await setRange('ui-p-st', 0.25);
  for (const h of ['A', 'B', 'C']) { await call('setHud', h); assert.deepEqual(await states(h), ['semStamina', 'semStamina', 'semStamina', 'semStamina'], `HUD ${h}: pronto sem stamina suficiente`); }
  await page.locator('.mvbox[data-i="1"] [data-f=state]').selectOption('bloqueado');
  await page.locator('.mvbox[data-i="1"] [data-f=cost]').fill('0'); await page.dispatchEvent('.mvbox[data-i="1"] [data-f=cost]', 'input');
  for (const h of ['A', 'B', 'C']) { await call('setHud', h); assert.equal((await states(h))[1], 'bloqueado', `HUD ${h}: bloqueado não vira outro estado`); }
  // selecionado
  await call('applyPreset', 'neutro');
  await page.locator('.mvbox[data-i="2"] [data-f=selected]').check();
  for (const h of ['A', 'B', 'C']) { await call('setHud', h); assert.equal(await page.evaluate(([s]) => [...document.querySelectorAll(s)].map(e => e.classList.contains('sel')).join(), [SEL[h].slot]), 'false,false,true,false', `HUD ${h}: slot selecionado`); }
  // recarga e carga ajustáveis: texto e variável CSS acompanham o slider
  await call('applyPreset', 'carga');
  await page.fill('.mvbox[data-i="0"] [data-f=charge]', '0.33'); await page.dispatchEvent('.mvbox[data-i="0"] [data-f=charge]', 'input');
  await page.fill('.mvbox[data-i="2"] [data-f=cd]', '0.25'); await page.dispatchEvent('.mvbox[data-i="2"] [data-f=cd]', 'input');
  for (const h of ['A', 'B', 'C']) {
    await call('setHud', h);
    const r = await page.evaluate(([S]) => { const e = [...document.querySelectorAll(S.slot)]; return {ch: parseFloat(e[0].style.getPropertyValue('--ch') || e[0].querySelector('.a-face')?.style.getPropertyValue('--ch')), cd: parseFloat(e[2].style.getPropertyValue('--cd') || e[2].querySelector('.a-face')?.style.getPropertyValue('--cd')), txt: e[0].textContent, txt2: e[2].textContent}; }, [SEL[h]]);
    assert.ok(Math.abs(r.ch - 0.33) < 0.01, `HUD ${h}: progresso de carga 33%`);
    assert.ok(Math.abs(r.cd - 0.25) < 0.01, `HUD ${h}: recarga restante 25%`);
    assert.ok(r.txt2.includes('1.5'), `HUD ${h}: recarga mostra 1.5 s`);
    if (h !== 'C') assert.ok(r.txt.includes('33%'), `HUD ${h}: carga mostra 33%`); else assert.ok(r.txt.includes('33%'), 'HUD C: carga mostra 33%');
  }

  // ---- 6. cenários (presets) em 720p, com capturas ----
  const nameOf = {neutro: 'neutro', avancado: 'avancado', critica: 'critica', carga: 'carga'};
  for (const h of ['A', 'B', 'C']) {
    for (const [pid, exp] of Object.entries(PRESET_STATES)) {
      await call('setHud', h); await call('applyPreset', pid); await wait(6);
      assert.deepEqual(await states(h), exp, `HUD ${h} · cenário ${pid}`);
      await page.keyboard.press('Escape');
      await page.screenshot({path: `${ev}hud${h}-${nameOf[pid]}-720p.png`});
    }
  }
  await page.keyboard.press('4'); assert.deepEqual(await states(await page.evaluate(k => window[k].state.hud, A)), PRESET_STATES.neutro, 'tecla 4 = cenário neutro');
  await page.keyboard.press('7'); assert.deepEqual(await states(await page.evaluate(k => window[k].state.hud, A)), PRESET_STATES.carga, 'tecla 7 = cenário carga');

  // ---- 7. escala, ocultar, resetar, animação ----
  await call('applyPreset', 'avancado');
  await page.fill('#hud-scale', '140'); await page.dispatchEvent('#hud-scale', 'input');
  assert.equal(+(await page.evaluate(() => getComputedStyle(document.getElementById('hud-root')).getPropertyValue('--hud-scale'))), 1.4, 'escala do HUD 140%');
  await page.fill('#hud-scale', '100'); await page.dispatchEvent('#hud-scale', 'input');
  await page.click('#btn-hidehud'); assert.equal(await page.evaluate(() => document.getElementById('hud-root').hidden), true, 'ocultar HUD');
  await page.click('#btn-hidehud'); assert.equal(await page.evaluate(() => document.getElementById('hud-root').hidden), false, 'exibir HUD');
  const cd0 = await page.evaluate(k => window[k].model.moves[1].cd, A);
  await call('setAnimate', true); await wait(12);
  const cd1 = await page.evaluate(k => window[k].model.moves[1].cd, A);
  assert.ok(cd1 < cd0 - 0.005 || cd1 > cd0 + 0.1, `animação de recarga avança (${cd0.toFixed(2)} → ${cd1.toFixed(2)})`);
  await call('setAnimate', false);
  await call('applyPreset', 'critica'); await call('setHud', 'C');
  await page.click('#btn-reset');
  const after = await page.evaluate(k => ({hud: window[k].state.hud, p: window[k].model.p, st: window[k].model.moves.map(m => m.state), names: window[k].model.moves.map(m => m.name), keys: window[k].model.moves.map(m => m.key)}), A);
  assert.equal(after.hud, 'A', 'reset volta ao HUD A');
  assert.deepEqual(after.p, {name: 'JOGADOR', hp: 100, st: 3}, 'reset restaura vida e stamina');
  assert.deepEqual(after.st, ['pronto', 'pronto', 'pronto', 'pronto'], 'reset restaura estados');
  assert.deepEqual(after.names, ['Quick Attack', 'Psyshock', 'Harden', 'Sand Wave'], 'reset restaura nomes');
  assert.deepEqual(after.keys, ['A', 'S', '3', '4'], 'reset restaura teclas (padrão do jogo)');
  await page.screenshot({path: ev + 'painel-controles-720p.png'});
  await page.click('#btn-panel');
  assert.equal(await page.isVisible('#drawer'), false, 'painel fecha');

  // ---- 8. câmera em várias posições + fundos (legibilidade com cenas diferentes) ----
  for (const cam of ['inicial', 'frente', 'lado', 'cima', 'rente', 'longe']) {
    await page.evaluate(([k, n]) => window[k].setCameraPreset(n, true), [A, cam]);
    const pos = await page.evaluate(k => window[k].camera.position.toArray(), A);
    assert.ok(pos.every(Number.isFinite), `câmera ${cam} válida`);
    for (const h of ['A', 'B', 'C']) {
      await call('setHud', h); await call('applyPreset', 'avancado'); await wait(4);
      assert.deepEqual(await states(h), PRESET_STATES.avancado, `HUD ${h} com câmera ${cam}`);
      if (cam === 'rente') await page.screenshot({path: `${ev}hud${h}-camera-${cam}-720p.png`});
    }
  }
  await page.evaluate(k => window[k].setCameraPreset('inicial', true), A);
  await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(760, 380, {steps: 4}); await page.mouse.up();
  await wait(6);
  assert.ok(Math.abs(await page.evaluate(k => window[k].camera.position.x, A)) > 0.2, 'arrastar gira a câmera');
  for (const theme of ['claro', 'quente']) {
    await call('setTheme', theme); await page.evaluate(k => window[k].setCameraPreset('inicial', true), A);
    for (const h of ['A', 'B', 'C']) { await call('setHud', h); await wait(4); if (theme === 'claro') await page.screenshot({path: `${ev}hud${h}-fundo-${theme}-720p.png`}); }
  }
  await call('setTheme', 'escuro');

  // ---- 9. legibilidade e limites em 720p e 1080p ----
  for (const [w, hgt, tag] of [[1280, 720, '720p'], [1920, 1080, '1080p']]) {
    await page.setViewportSize({width: w, height: hgt});
    await page.evaluate(k => { window[k].setCameraPreset('inicial', true); window[k].applyPreset('avancado'); }, A);
    for (const h of ['A', 'B', 'C']) {
      await call('setHud', h); await wait(6);
      const m = await page.evaluate(([S, hh]) => {
        const root = document.querySelector(`.hud[data-hud="${hh}"]`);
        let minFont = 99;
        for (const el of root.querySelectorAll('*')) {
          if (el.children.length === 0 && el.textContent.trim().length && !(el instanceof SVGElement)) {
            const r = el.getBoundingClientRect(); if (!r.width) continue;
            const scale = r.width / (el.offsetWidth || r.width);
            minFont = Math.min(minFont, parseFloat(getComputedStyle(el).fontSize) * scale);
          }
        }
        const boxes = [...root.querySelectorAll(S.blocks)].map(e => e.getBoundingClientRect());
        return {minFont, x0: Math.min(...boxes.map(b => b.left)), x1: Math.max(...boxes.map(b => b.right)), y1: Math.max(...boxes.map(b => b.bottom)), boxes: boxes.map(b => [b.left, b.top, b.right, b.bottom])};
      }, [SEL[h], h]);
      assert.ok(m.minFont >= 10.9, `HUD ${h} ${tag}: fonte mínima ${m.minFont.toFixed(1)}px`);
      assert.ok(m.x0 >= -1 && m.x1 <= w + 1 && m.y1 <= hgt + 1, `HUD ${h} ${tag}: dentro da tela ${JSON.stringify([m.x0, m.x1, m.y1])}`);
      // nenhum bloco do HUD cobre o miolo da arena (40–60% × 35–65%)
      const cx0 = w * .4, cx1 = w * .6, cy0 = hgt * .35, cy1 = hgt * .65;
      assert.ok(m.boxes.every(([l, t, r, b]) => !(l < cx1 && r > cx0 && t < cy1 && b > cy0)), `HUD ${h} ${tag}: não cobre o centro da arena`);
      if (tag === '1080p') await page.screenshot({path: `${ev}hud${h}-avancado-1080p.png`});
    }
  }
  await page.setViewportSize({width: 1280, height: 720});

  // ---- 10. saúde geral ----
  await wait(10);
  const fin = await page.evaluate(k => window[k].info(), A);
  assert.deepEqual(errors, [], 'sem erros de JavaScript/console: ' + errors.join(' | '));
  assert.deepEqual(external, [], 'sem requisições externas');
  assert.deepEqual(failed, [], 'sem recursos ausentes: ' + failed.join(' | '));
  console.log('OK · HUD Vida/Stamina/Moves:', JSON.stringify({drawCalls: fin.drawCalls, triangles: fin.triangles}));
} finally {
  await browser.close();
}
