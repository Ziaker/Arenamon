// VFX sólidos 3D no navegador (Edge real, file://, offline): painel com seletores e sliders, escolha exibida = aplicada em partida
// (renderizador legado e VfxRuntime), desfazer/refazer pela interface real, exportação/importação, capturas de todas as variantes em
// vários ângulos, clipes curtos em movimento (comparação lado a lado) e medição de desempenho identificando o renderizador usado.
// Saídas versionadas em evidence/vfx-solido/ (PNGs, movimento/*.mp4, comparacao-poeira.html, desempenho.json).
// Verificação TÉCNICA: a aprovação do visual é do diretor.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync, writeFileSync, rmSync, readdirSync, existsSync, mkdtempSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'evidence/vfx-solido/', clips = out + 'movimento/';
rmSync(out, {recursive: true, force: true});mkdirSync(clips, {recursive: true});
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
const ffmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
let failures = 0;
const check = (label, ok, detail = '') => {console.log(`${ok ? '✓' : '✗'} ${label}${detail !== '' ? ` — ${detail}` : ''}`);if (!ok) failures++;};
const browser = await chromium.launch({...BROWSER, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 920}}), errors = [], network = [];
  page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('request', r => {if (/^https?:/.test(r.url())) network.push(r.url());});
  await page.context().setOffline(true);await page.goto(labUrl);await page.waitForFunction(() => window.__lab);
  const L = (fn, arg) => page.evaluate(fn, arg);
  const tab = t => L(t => {const p = document.getElementById('panel');if (p.hidden || p.dataset.tool !== t) document.querySelector(`[data-tool="${t}"]`).click();}, t);
  await tab('match');await page.selectOption('#mode', 'inactive');await page.click('#start');await page.waitForTimeout(500);
  await tab('overlays');

  // ---------- Painel: estrutura ----------
  const FAM = await L(() => [...document.querySelectorAll('[data-solid-family]')].map(d => ({key: d.dataset.solidFamily, variants: d.querySelectorAll('[data-solid-variant]').length, previews: d.querySelectorAll('[data-solid-prev]').length, rows: d.querySelectorAll('[data-solid-rows] [data-path]').length})));
  check('o painel lista as 9 famílias 3D', FAM.length === 9 && FAM.map(f => f.key).join() === 'solidDust,solidWind,solidRunDust,solidRunWind,solidDodge,solidLanding,solidImpact,solidBlock,solidClash', FAM.map(f => f.key).join());
  check('poeira tem 8 estilos; vento do dash 4; poeira e vento da corrida 3 cada; demais 3', FAM.map(f => f.variants).join() === '8,4,3,3,3,3,3,3,3', FAM.map(f => f.variants).join());
  check('cada família tem 9 sliders + cor (poeira também cor secundária)', FAM.every(f => f.rows === (f.key === 'solidDust' ? 11 : 10)), FAM.map(f => f.rows).join());
  const names = await L(() => [...document.querySelectorAll('[data-solid-variant]')].map(b => b.textContent));
  check('cada botão explica a aparência (nome com descrição)', names.length === 33 && names.every(n => n.length > 25), names.length + ' botões');
  check('prévias: dash, arrancada, corrida, curva, parada e comparação nas famílias de movimento', FAM.slice(0, 2).every(f => f.previews === 6) && FAM.slice(2, 4).every(f => f.previews === 4) && await page.locator('[data-solid-combo-prev]').count() === 5);
  check('controles globais de limite de objetos e qualidade presentes', await page.locator('[data-solid-global] [data-path="vfx.solid.maxObjects"]').count() === 1 && await page.locator('[data-solid-global] [data-path="vfx.solid.quality"]').count() === 1);

  // ---------- Sliders reais ----------
  await L(() => document.querySelectorAll('[data-solid-sliders]').forEach(d => {d.open = true;}));
  const setSlider = (path, value) => L(([p, v]) => {const el = document.querySelector(`[data-solid-rows] [data-path="${p}"]`);el.value = String(v);el.dispatchEvent(new Event('input', {bubbles: true}));el.dispatchEvent(new Event('change', {bubbles: true}));return window.__lab.C.vfx[p.split('.')[1]][p.split('.')[2]];}, [path, value]);
  const stuck = [];
  for (const f of FAM) for (const [p, v] of [['intensity', 1.7], ['amount', 1.6], ['size', 1.4], ['duration', 1.5], ['velocity', 1.5], ['scatter', 1.6], ['lift', 1.5], ['turbulence', 1.8], ['opacity', .6]]) {const got = await setSlider(`vfx.${f.key}.${p}`, v);if (Math.abs(got - v) > .02) stuck.push(`${f.key}.${p}=${got}`);}
  check('os 81 sliders gravam o valor em C.vfx', stuck.length === 0, stuck.join(' | '));
  await L(() => window.__lab.tuning.resetAll());
  const count = async amount => {await setSlider('vfx.solidWind.amount', amount);return L(() => {const fx = window.__lab.view.solid;fx.reset();fx.rnd = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(7);fx.preview('solidWind', window.__lab.game.fighters, 'dash');for (let i = 0; i < 30; i++) fx.update([], [], 1 / 60);return fx.stats.spawned;});};
  const lo = await count(.4), hi = await count(2.5);check('um slider mexido na interface muda o efeito (quantidade do vento)', hi > lo * 1.8, `${lo} → ${hi}`);
  await L(() => window.__lab.tuning.resetAll());

  // ---------- Escolhido = aplicado ----------
  const state = key => L(key => ({c: window.__lab.C.vfx[key].variant, pressed: [...document.querySelectorAll(`[data-solid-variant^="${key}:"]`)].findIndex(b => b.getAttribute('aria-pressed') === 'true'),
    last: [...window.__lab.view.solid.log].reverse().find(l => l.effect === key)?.variant ?? null}), key);
  const settle = () => L(() => {const fx = window.__lab.view.solid;for (let i = 0; i < 40; i++) fx.update([], [], 1 / 60);});
  const again = (k, w) => L(([k, w]) => {const fx = window.__lab.view.solid;fx.reset();fx.preview(k, window.__lab.game.fighters, w);}, [k, w]);
  for (const [key, v] of [['solidDust', 6], ['solidWind', 3], ['solidRunDust', 2], ['solidRunWind', 1]]) {
    await L(() => window.__lab.view.solid.reset());
    await page.click(`[data-solid-variant="${key}:${v}"]`);await settle();let s = await state(key);
    check(`${key}: clicar no estilo ${'ABCDEFGH'[v]} → configuração, botão marcado e prévia são o mesmo (${v})`, s.c === v && s.pressed === v && s.last === v, JSON.stringify(s));
    await L(() => document.getElementById('tune-undo').click());await again(key, 'run');await settle();s = await state(key);
    check(`${key}: Desfazer volta ao estilo A em configuração, botão e disparo`, s.c === 0 && s.pressed === 0 && s.last === 0, JSON.stringify(s));
    await L(() => document.getElementById('tune-redo').click());await again(key, 'run');await settle();s = await state(key);
    check(`${key}: Refazer volta ao estilo ${'ABCDEFGH'[v]} em configuração, botão e disparo`, s.c === v && s.pressed === v && s.last === v, JSON.stringify(s));
  }
  await L(() => window.__lab.tuning.resetAll());

  // ---------- Exportação / importação ----------
  const exp = await L(() => {const {C, tuning} = window.__lab;tuning.commit([['vfx.solidDust.variant', 5], ['vfx.solidWind.variant', 2], ['vfx.solidRunDust.variant', 1], ['vfx.solidRunWind.variant', 2], ['vfx.solidWind.intensity', 1.9], ['vfx.solidRunDust.color', 0x336699]], 'combinação');
    const json = JSON.stringify(tuning.exportData());tuning.resetAll();const before = [C.vfx.solidDust.variant, C.vfx.solidWind.variant];const pv = tuning.preview(json);tuning.applyChanges(pv.changes, 'importar');
    return {before, after: [C.vfx.solidDust.variant, C.vfx.solidWind.variant, C.vfx.solidRunDust.variant, C.vfx.solidRunWind.variant, C.vfx.solidWind.intensity, C.vfx.solidRunDust.color], error: pv.error ?? null, n: pv.changes?.length};});
  check('exportar → restaurar padrões → importar conserva estilos, intensidade e cores', !exp.error && JSON.stringify(exp.before) === '[0,0]' && JSON.stringify(exp.after) === JSON.stringify([5, 2, 1, 2, 1.9, 0x336699]), JSON.stringify(exp));
  const snap = await L(() => {const s = window.__lab.tuning.snapshotValues();return ['vfx.solidDust.variant', 'vfx.solidWind.variant', 'vfx.solidRunWind.variant', 'vfx.solidWind.amount', 'vfx.solidRunDust.color'].every(p => p in s);});
  check('os valores novos entram no instantâneo usado por presets e A × B (snapshotValues)', snap);
  await L(() => window.__lab.tuning.resetAll());

  // ---------- Na luta: sprint real, os dois renderizadores ----------
  const key = (c, d) => page.keyboard[d ? 'down' : 'up'](c);
  for (const mode of [false, true]) {
    await L(m => {const {view, tuning, startMatch} = window.__lab;tuning.resetAll();view.useNewVfx = m;tuning.commit([['vfx.solidDust.variant', 4], ['vfx.solidWind.variant', 1], ['vfx.solidRunDust.variant', 2], ['vfx.solidRunWind.variant', 2]], 'luta');view.solid.reset();startMatch?.();}, mode);
    await tab('match');await L(() => {document.getElementById('panel').hidden = true;});await page.locator('canvas').first().focus();
    await key('ArrowUp', true);await key('KeyC', true);await page.waitForTimeout(1800);await key('KeyC', false);await key('ArrowUp', false);await page.waitForTimeout(900);
    const used = await L(() => {const L2 = window.__lab.view.solid.log, v = k => [...new Set(L2.filter(l => l.effect === k).map(l => l.variant))].join(), why = [...new Set(L2.map(l => l.reason))];return {dust: v('solidDust'), wind: v('solidWind'), rd: v('solidRunDust'), rw: v('solidRunWind'), why, newVfx: window.__lab.view.useNewVfx};});
    check(`na luta (${mode ? 'VfxRuntime' : 'renderizador legado'}): sprint real usa os estilos escolhidos`, used.rd === '2' && used.rw === '2' && used.dust === '4' && used.wind === '1' && used.why.includes('corrida') && used.why.includes('arrancada'), JSON.stringify(used));
  }
  await L(() => {window.__lab.view.useNewVfx = false;window.__lab.tuning.resetAll();});

  // ---------- Vazamento no navegador ----------
  const leak = await L(() => {const {C, view} = window.__lab, fx = view.solid, info = view.renderer.info, N = {solidDust: 8, solidWind: 4, solidRunDust: 3, solidRunWind: 3}, ks = Object.keys(N);view.renderer.render(view.scene, view.camera);const g0 = info.memory.geometries, p0 = info.programs?.length ?? 0;
    for (let i = 0; i < 200; i++) {for (const k of ks) C.vfx[k].variant = i % N[k];fx.preview(ks[i % 4], window.__lab.game.fighters, ['dash', 'run', 'turn', 'stop', 'start'][i % 5]);for (let j = 0; j < 6; j++) fx.update([], [], 1 / 30);if (i % 9 === 0) fx.reset();view.renderer.render(view.scene, view.camera);}
    const mid = fx.meshes.size;
    for (const k of ks) for (let v = 0; v < N[k]; v++) {C.vfx[k].variant = v;fx.preview(k, window.__lab.game.fighters, 'run');for (let j = 0; j < 6; j++) fx.update([], [], 1 / 30);}
    view.renderer.render(view.scene, view.camera);fx.reset();view.renderer.render(view.scene, view.camera);
    return {g: [g0, info.memory.geometries], programs: [p0, info.programs?.length ?? 0], meshes: [mid, fx.meshes.size], materials: Object.keys(fx.materials).length, shapes: Object.keys(fx.geometries).length, children: fx.group.children.length};});
  check('trocar estilos/prévias 200 vezes e resetar não acumula malhas, geometrias de GPU, programas nem materiais', leak.children === leak.meshes[1] && leak.meshes[1] <= leak.shapes * leak.materials && leak.programs[1] - leak.programs[0] <= 4 && leak.g[1] - leak.g[0] <= leak.shapes && leak.materials === 4, JSON.stringify(leak));
  await L(() => window.__lab.tuning.resetAll());

  // ---------- Palco limpo para capturas ----------
  // Partida nova e limpa (a luta acima pode ter terminado em derrota, com a tela de resultado por cima).
  await L(() => {window.__lab.view.useNewVfx = false;window.__lab.startMatch?.();});await page.waitForTimeout(400);
  await page.keyboard.press('Escape').catch(() => {});await L(() => {document.getElementById('panel').hidden = true;window.__lab.C.extras.hud.fxVisible = 1;window.__lab.togglePause?.();});
  const saved = await L(() => {const {game, C} = window.__lab, V = C.extras.visual, keep = {w: V.bodyWidth, h: V.bodyHeight, d: V.bodyDepth, ar: V.arrowRadius, al: V.arrowLength, ch: C.camera.height, cl: C.camera.lookHeight, ca: C.camera.lookAhead};
    V.bodyWidth = V.bodyDepth = .02;V.bodyHeight = .02;V.arrowRadius = .01;V.arrowLength = .01;game.fighters[0].position.x = -9;game.fighters[0].position.z = 5;game.fighters[1].position.x = -5.6;game.fighters[1].position.z = 5;return keep;});
  const setup = (yawDelta, zoom, h = 1.5, look = .4) => L(([d, z, h, look]) => {const {view, C} = window.__lab, rig = view.rig;C.camera.height = h;C.camera.lookHeight = look;C.camera.lookAhead = 1.2;rig.manualLeft = 1e9;rig.yaw = rig.desiredYaw = (window.__yaw0 ??= rig.yaw) + d;rig.zoom = rig.distance = z;}, [yawDelta, zoom, h, look]);
  const frame = () => L(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const stepFx = n => L(n => {const fx = window.__lab.view.solid;for (let i = 0; i < n; i++) fx.update([], [], 1 / 60);}, n);
  const clip = {x: 330, y: 190, width: 840, height: 520};
  const ANGLES = [['frente', 0, 1.3, .3, 4.4], ['lado', Math.PI / 2, 1.3, .3, 4.4], ['alto', 0.4, 7, .2, 3.4]];
  const files = [];
  const start = (k, v, what, extra = {}) => L(([k, v, what, extra]) => {const {C, view, game} = window.__lab;for (const f of ['solidDust', 'solidWind', 'solidRunDust', 'solidRunWind']) C.vfx[f].enabled = f === k ? 1 : 0;C.vfx[k].variant = v;view.solid.reset();view.solid.preview(k, game.fighters, what, extra);}, [k, v, what, extra]);
  const DUSTN = ['A-compacta', 'B-turbulenta', 'C-pesada', 'D-energetica', 'E-camadas', 'F-rolante', 'G-anel', 'H-espiral'], WINDN = ['A-fitas', 'B-espirais', 'C-ganchos', 'D-cunha'], RDN = ['A-pegadas', 'B-nuvem', 'C-sulcos'], RWN = ['A-fitas', 'B-espirais', 'C-arcos'];
  const GROUPS = [['solidDust', 'poeira-dash', DUSTN, 'dash', 14], ['solidWind', 'vento-dash', WINDN, 'dash', 14], ['solidRunDust', 'poeira-corrida', RDN, 'run', 70], ['solidRunWind', 'vento-corrida', RWN, 'run', 70]];
  for (const [k, pre, nm, what, steps] of GROUPS) for (let v = 0; v < nm.length; v++) for (const [an, yaw, h, look, zoom] of ANGLES) {
    await start(k, v, what);await setup(yaw, k.startsWith('solidRun') ? zoom + 2 : zoom, h, look);await stepFx(steps);await frame();
    const f = `${pre}-${nm[v]}-${an}.png`;await page.screenshot({path: out + f, clip});files.push(f);
  }
  check(`capturas por estilo e ângulo (${files.length} PNGs: poeira 8, vento 4, corrida 3+3, × frente/lado/alto)`, files.length === (8 + 4 + 3 + 3) * 3);
  const turns = [];
  for (const [k, nm] of [['solidRunDust', RDN], ['solidRunWind', RWN]]) for (let v = 0; v < 3; v++) {
    await start(k, v, 'turn');await setup(0.4, 9, 6, .2);await stepFx(80);await frame();const f = `curva-${k === 'solidRunDust' ? 'poeira' : 'vento'}-${nm[v]}-alto.png`;await page.screenshot({path: out + f, clip});turns.push(f);
  }
  const others = [['solidDodge', 'esquiva'], ['solidLanding', 'aterrissagem'], ['solidImpact', 'impacto'], ['solidBlock', 'bloqueio'], ['solidClash', 'colisao']], sheet = [];
  for (const [k, nm] of others) for (let v = 0; v < 3; v++) for (const [an, yaw] of [['frente', 0], ['lado', Math.PI / 2]]) {
    await L(([k, v]) => {const {C, view, game} = window.__lab;for (const f of ['solidDodge', 'solidLanding', 'solidImpact', 'solidBlock', 'solidClash']) C.vfx[f].variant = f === k ? v : 0;view.solid.reset();view.solid.preview(k, game.fighters);}, [k, v]);
    await setup(yaw, 3.6, 1.6, .6);await stepFx(k === 'solidLanding' || k === 'solidDodge' ? 10 : 6);await frame();const f = `${nm}-${'ABC'[v]}-${an}.png`;await page.screenshot({path: out + f, clip: {x: 400, y: 220, width: 700, height: 460}});sheet.push(f);
  }
  check('capturas das curvas (6) e das demais famílias (30)', turns.length === 6 && sheet.length === 30);

  // ---------- Clipes em movimento (comparação lado a lado) ----------
  const clipList = [];
  if (!ffmpeg) console.log('· ffmpeg ausente: clipes em movimento não gerados (registrado)');
  else {
    const tmp = mkdtempSync(tmpdir() + '/solidclip-');
    const CL = [['comparar-poeira-dash', 'solidDust', 'dash', 5.6, 1.8], ['comparar-vento-dash', 'solidWind', 'dash', 5, 1.8], ['comparar-poeira-corrida', 'solidRunDust', 'run', 9, 2.6], ['comparar-vento-corrida', 'solidRunWind', 'run', 9, 2.6], ['comparar-poeira-curva', 'solidRunDust', 'turn', 10, 5], ['comparar-vento-curva', 'solidRunWind', 'turn', 10, 5], ['comparar-poeira-parada', 'solidDust', 'stop', 5.6, 1.8], ['comparar-vento-parada', 'solidWind', 'stop', 5, 1.8]];
    for (const [name, k, what, zoom, hgt] of CL) {
      await L(([k, what]) => {const {C, view, game} = window.__lab;for (const f of ['solidDust', 'solidWind', 'solidRunDust', 'solidRunWind']) C.vfx[f].enabled = f === k ? 1 : 0;view.solid.reset();view.solid.compare(k, game.fighters, what);}, [k, what]);
      await setup(0.55, zoom + 1, hgt, .3);const dir = tmp + '/' + name;mkdirSync(dir);
      for (let i = 0; i < 45; i++) {await stepFx(2);await frame();await page.screenshot({path: `${dir}/f${String(i).padStart(3, '0')}.png`, clip: {x: 250, y: 200, width: 1000, height: 500}});}
      const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '15', '-i', `${dir}/f%03d.png`, '-vf', 'scale=720:-2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '30', '-movflags', '+faststart', `${clips}${name}.mp4`]);
      if (r.status === 0 && existsSync(`${clips}${name}.mp4`)) clipList.push(name); else console.log('· falha no ffmpeg:', String(r.stderr).slice(0, 200));
    }
    rmSync(tmp, {recursive: true, force: true});
  }
  check(ffmpeg ? 'clipes curtos de comparação em movimento (8 clipes)' : 'clipes em movimento (ffmpeg ausente: não gerados)', !ffmpeg || clipList.length === 8, clipList.join(', '));
  await L(s => {const {C} = window.__lab, V = C.extras.visual;V.bodyWidth = s.w;V.bodyDepth = s.d;V.bodyHeight = s.h;V.arrowRadius = s.ar;V.arrowLength = s.al;C.camera.height = s.ch;C.camera.lookHeight = s.cl;C.camera.lookAhead = s.ca;window.__lab.tuning.resetAll();window.__lab.togglePause?.();}, saved);

  // ---------- Desempenho (identifica o renderizador) ----------
  const perf = await L(async () => {
    const {view, game, C} = window.__lab, fx = view.solid, R = view.renderer, gl = R.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    const stats = a => {a.sort((x, y) => x - y);return {avg: +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(4), p95: +a[Math.floor(a.length * .95)].toFixed(4), max: +a.at(-1).toFixed(4)};};
    const glr = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'desconhecido';
    const out = {env: {glRenderer: glr, glVendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : 'desconhecido', ua: navigator.userAgent, software: /swiftshader|llvmpipe|software/i.test(glr), webgl2: R.capabilities.isWebGL2}, families: {}};
    const fighters = game.fighters, seed = () => { fx.rnd = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(3); };
    const runFam = (k, v, what) => {C.vfx[k].variant = v;fx.reset();seed();for (let i = 0; i < 4; i++) fx.preview(k, fighters, what, {lane: i * .5 - .75});const t = [];let peak = 0;for (let i = 0; i < 150; i++) {const t0 = performance.now();fx.update([], [], 1 / 60);t.push(performance.now() - t0);peak = Math.max(peak, fx.all.length);}return {...stats(t), peakActive: peak, spawned: fx.stats.spawned};};
    for (const [k, n, what] of [['solidDust', 8, 'run'], ['solidWind', 4, 'run'], ['solidRunDust', 3, 'run'], ['solidRunWind', 3, 'run']]) {out.families[k] = {};for (let v = 0; v < n; v++) out.families[k][v] = runFam(k, v, what);}
    for (const k of ['solidDust', 'solidWind', 'solidRunDust', 'solidRunWind']) {C.vfx[k].amount = 3;C.vfx[k].enabled = 1;}fx.reset();fx.stats.rejected = 0;let peak = 0;const t = [];
    for (let i = 0; i < 300; i++) {if (i % 12 === 0) fx.preview('all', fighters, ['dash', 'run', 'turn', 'stop'][(i / 12) % 4 | 0], {lane: (i % 5) * .4});if (i % 5 === 0) for (const k of ['solidImpact', 'solidClash', 'solidLanding']) fx.fire(k, {pos: {x: -7, z: 5}, n: {x: 0, z: 1}, power: 1.5}, 'carga');const t0 = performance.now();fx.update([], [], 1 / 60);t.push(performance.now() - t0);peak = Math.max(peak, fx.all.length);}
    out.worstCase = {...stats(t), peakActive: peak, cap: fx.cap(), rejected: fx.stats.rejected, meshes: fx.meshes.size};
    out.draw = {};
    for (const mode of [false, true]) {view.useNewVfx = mode;const m = {};for (const vis of [true, false]) {fx.group.visible = vis;R.info.reset();R.render(view.scene, view.camera);const calls = R.info.render.calls, tris = R.info.render.triangles, a = [];for (let i = 0; i < 40; i++) {const t0 = performance.now();R.render(view.scene, view.camera);a.push(performance.now() - t0);}a.sort((x, y) => x - y);m[vis ? 'withSolid' : 'withoutSolid'] = {calls, triangles: tris, cpuRenderMedianMs: +a[20].toFixed(3)};}out.draw[mode ? 'VfxRuntime' : 'legado'] = m;}
    fx.group.visible = true;view.useNewVfx = false;
    out.shapes = Object.keys(fx.geometries).length;out.materials = Object.keys(fx.materials).length;out.instancedMeshes = fx.meshes.size;
    return out;
  });
  writeFileSync(out + 'desempenho.json', JSON.stringify({generated: new Date().toISOString().slice(0, 10), note: 'Tempos são de CPU (atualização das partículas e envio do desenho). Se env.software for true, o WebGL roda por software (SwiftShader) e NENHUM tempo de GPU é representativo.', ...perf}, null, 2));
  const w = perf.worstCase, dl = perf.draw.legado, dn = perf.draw.VfxRuntime;
  console.log(`· renderizador WebGL: ${perf.env.glRenderer} (${perf.env.software ? 'software' : 'GPU'}) · WebGL${perf.env.webgl2 ? '2' : '1'}`);
  check('pior caso respeita o teto de objetos', w.peakActive <= w.cap, `pico ${w.peakActive}/${w.cap}, rejeitados ${w.rejected}`);
  check('chamadas de desenho dos sólidos limitadas (≤ 24 a mais, em qualquer renderizador de sprites)', dl.withSolid.calls - dl.withoutSolid.calls <= 24 && dn.withSolid.calls - dn.withoutSolid.calls <= 24, `legado +${dl.withSolid.calls - dl.withoutSolid.calls} · VfxRuntime +${dn.withSolid.calls - dn.withoutSolid.calls}`);
  check('custo de CPU da atualização no pior caso < 4 ms por quadro', w.p95 < 4, `média ${w.avg} ms · p95 ${w.p95} ms · máx ${w.max} ms`);

  // ---------- Folha de comparação ----------
  const img = (f, wd = 300) => `<img src="${f}" alt="${f}" style="width:${wd}px" loading="lazy">`;
  const grp = (title, pre, nm, descr) => `<h2>${title}</h2><table><tr><th>Estilo</th><th>Frente</th><th>Lado</th><th>Alto</th></tr>${nm.map((n, v) => `<tr><th>${descr[v]}</th>${['frente', 'lado', 'alto'].map(a => `<td>${img(`${pre}-${n}-${a}.png`)}</td>`).join('')}</tr>`).join('')}</table>`;
  const html = `<!doctype html><meta charset="utf-8"><title>VFX de movimento 3D — comparação</title><style>body{font:14px system-ui;background:#10151c;color:#e6edf3;margin:16px}h1,h2{font-weight:600}table{border-collapse:collapse;margin-bottom:18px}td,th{border:1px solid #2b3642;padding:4px;vertical-align:top;text-align:left;max-width:260px}img{display:block}video{width:520px;margin:4px}</style>
<h1>Poeira e vento 3D — dash, esquiva e corrida</h1><p>Malhas com volume real (icosaedros deformados, faixas extrudadas, meios-toros, tubos afilados), sem sprites. Clipes: cada faixa é uma opção do mesmo movimento.</p>
${grp('Poeira do dash (8 estilos)', 'poeira-dash', DUSTN, ['A · compacta', 'B · turbulenta', 'C · impacto pesado', 'D · energética', 'E · ondas em camadas', 'F · nuvem rolante', 'G · anel de nuvem', 'H · coluna em espiral'])}
${grp('Vento do dash (4 estilos)', 'vento-dash', WINDN, ['A · fitas em S', 'B · espirais', 'C · ganchos rentes ao chão', 'D · cunha de rajadas'])}
${grp('Poeira da corrida (3 estilos)', 'poeira-corrida', RDN, ['A · pegadas', 'B · nuvem contínua', 'C · sulcos rolantes'])}
${grp('Vento da corrida (3 estilos)', 'vento-corrida', RWN, ['A · fitas laterais', 'B · espirais de esteira', 'C · arcos de corrente'])}
<h2>Curvas (vista de cima)</h2>${turns.map(f => img(f, 300)).join('')}
<h2>Clipes em movimento (comparação lado a lado)</h2>${clipList.map(c => `<figure style="display:inline-block"><video src="movimento/${c}.mp4" controls loop muted></video><figcaption>${c}</figcaption></figure>`).join('')}
<h2>Esquiva, aterrissagem, impacto, bloqueio e colisão</h2><table><tr><th>Efeito</th><th>Opção</th><th>Frente</th><th>Lado</th></tr>${others.flatMap(([, nm]) => [0, 1, 2].map(v => `<tr><td>${nm}</td><td>${'ABC'[v]}</td>${['frente', 'lado'].map(a => `<td>${img(`${nm}-${'ABC'[v]}-${a}.png`, 300)}</td>`).join('')}</tr>`)).join('')}</table>
<h2>Desempenho</h2><pre>${JSON.stringify(perf, null, 2)}</pre>`;
  writeFileSync(out + 'comparacao-poeira.html', html);
  const total = readdirSync(out, {recursive: true}).filter(f => /\.(png|mp4)$/.test(String(f))).reduce((s, f) => s + statSync(out + f).size, 0);
  console.log(`· evidências: ${files.length + turns.length + sheet.length} PNGs + ${clipList.length} clipes, ${(total / 1048576).toFixed(1)} MB em evidence/vfx-solido/`);
  check('sem erros de console nem requisições externas', errors.length === 0 && network.length === 0, [...errors, ...network].slice(0, 3).join(' | '));
} finally {await browser.close();}
console.log(failures ? `\n${failures} verificações falharam.` : '\nVFX sólidos no navegador: tudo aprovado.');
process.exit(failures ? 1 : 0);
