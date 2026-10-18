// VFX sólidos 3D no navegador (Edge real, file://, offline): painel com seletores, escolha exibida = aplicada, desfazer/refazer pela
// interface real, capturas da poeira (4 opções × 3 ângulos) e das demais famílias (2 ângulos), e medição de desempenho.
// Saídas versionadas em evidence/vfx-solido/ (PNGs, comparacao-poeira.html, desempenho.json). Verificação TÉCNICA: o visual é aprovado pelo diretor.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync, writeFileSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'evidence/vfx-solido/';mkdirSync(out, {recursive: true});
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
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

  // ---------- Painel ----------
  check('o painel lista as 6 famílias 3D com nomes descritivos', await page.locator('[data-solid-family]').count() === 6 && await page.locator('[data-solid-variant^="solidDust:"]').count() === 4);
  const names = await L(() => [...document.querySelectorAll('[data-solid-variant]')].map(b => b.textContent));
  check('cada botão explica a aparência (nome com descrição)', names.length === 4 + 3 * 5 && names.every(n => n.length > 25), names.length + ' botões');
  check('todos os previews existem (dash, arrancada, parada, comparar, 5 prévias)', await page.locator('[data-solid-prev]').count() === 4 + 5);

  // ---------- Escolhido = aplicado, desfazer/refazer pela interface real ----------
  const state = () => L(() => ({c: window.__lab.C.vfx.solidDust.variant, pressed: [...document.querySelectorAll('[data-solid-variant^="solidDust:"]')].findIndex(b => b.getAttribute('aria-pressed') === 'true'),
    last: [...window.__lab.view.solid.log].reverse().find(l => l.effect === 'solidDust')?.variant ?? null}));
  await page.click('[data-solid-variant="solidDust:2"]');await page.waitForTimeout(150);
  let s = await state();check('clicar na opção C: configuração, botão marcado e prévia disparada são a mesma (2)', s.c === 2 && s.pressed === 2 && s.last === 2, JSON.stringify(s));
  await L(() => document.getElementById('tune-undo').click());await page.waitForTimeout(100);s = await state();
  check('Desfazer: configuração e botão voltam para A (0)', s.c === 0 && s.pressed === 0, JSON.stringify(s));
  await L(() => window.__lab.view.solid.preview('solidDust', window.__lab.game.fighters));s = await state();
  check('depois de desfazer, o disparo usa a opção A', s.last === 0, JSON.stringify(s));
  await L(() => document.getElementById('tune-redo').click());await page.waitForTimeout(100);s = await state();
  check('Refazer: volta para C (2) em configuração e botão', s.c === 2 && s.pressed === 2, JSON.stringify(s));
  await L(() => window.__lab.view.solid.preview('solidDust', window.__lab.game.fighters));s = await state();
  check('depois de refazer, o disparo usa a opção C', s.last === 2, JSON.stringify(s));
  // VfxRuntime (novo renderizador): a variante usada é a mesma da configuração, também depois de desfazer
  const rt = await L(() => {const {C, tuning, view} = window.__lab;tuning.commit([['vfx.hit.variant', 2]], 't');const a = view.vfxRuntime.getVariant('hit');tuning.undo();const b = view.vfxRuntime.getVariant('hit');tuning.redo();const c = view.vfxRuntime.getVariant('hit');tuning.undo();return {a, b, c, cfg: C.vfx.hit.variant};});
  check('VfxRuntime acompanha a configuração: escolher 2, desfazer, refazer', rt.a === 2 && rt.b === 0 && rt.c === 2 && rt.cfg === 0, JSON.stringify(rt));
  await L(() => window.__lab.tuning.undo());
  await page.click('[data-solid-master]');await L(() => {window.__lab.view.solid.reset();window.__lab.view.solid.preview('solidImpact', window.__lab.game.fighters);});
  check('desligar os efeitos 3D impede novos objetos', await L(() => window.__lab.view.solid.all.length) === 0);
  await page.click('[data-solid-master]');

  // ---------- Capturas ----------
  const live = window => window;
  await L(() => {const {view, C} = window.__lab;C.extras.hud.fxVisible = 1;});
  await page.keyboard.press('Escape').catch(() => {});await L(() => {document.getElementById('panel').hidden = true;});
  await L(() => window.__lab.togglePause?.());
  const paused = await L(() => window.__lab.game.paused ?? window.__lab.ui.paused ?? null);
  const setup = (yawDelta, zoom, h = 1.5, look = .4) => L(([d, z, h, look]) => {const {view, C} = window.__lab, rig = view.rig;C.camera.height = h;C.camera.lookHeight = look;C.camera.lookAhead = 1.2;rig.manualLeft = 1e9;rig.yaw = rig.desiredYaw = (window.__yaw0 ??= rig.yaw) + d;rig.zoom = rig.distance = z;}, [yawDelta, zoom, h, look]);
  const steps = (n, dt = 1 / 60) => L(([n, dt]) => {const fx = window.__lab.view.solid;for (let i = 0; i < n; i++) fx.update([], [], dt);}, [n, dt]);
  const clip = {x: 330, y: 170, width: 840, height: 560};
  const angles = [['frente', 0], ['lado', Math.PI / 2], ['alto', 0.4]];
  const dustNames = ['A-compacta', 'B-turbulenta', 'C-pesada', 'D-energetica'];
  // Palco limpo: lutadores levados para um canto e blocos/setas reduzidos a quase nada só durante as capturas (restaurados depois).
  const saved = await L(() => {const {game, C} = window.__lab, V = C.extras.visual, keep = {w: V.bodyWidth, h: V.bodyHeight, d: V.bodyDepth, ar: V.arrowRadius, al: V.arrowLength};
    V.bodyWidth = V.bodyDepth = .02;V.bodyHeight = .02;V.arrowRadius = .01;V.arrowLength = .01;
    game.fighters[0].position.x = -9;game.fighters[0].position.z = 5;game.fighters[1].position.x = -5.6;game.fighters[1].position.z = 5;
    window.__stage = game.fighters;return keep;});
  const files = [];
  for (let v = 0; v < 4; v++) {
    for (const [an, yaw] of angles) {
      await L(([v]) => {const {C, view} = window.__lab;C.vfx.solidDust.variant = v;view.solid.reset();view.solid.preview('solidDust', window.__stage, 'dash');}, [v]);
      await (an === 'alto' ? setup(yaw, 2.6, 7, .2) : setup(yaw, 3.4, 1.3, .3));
      await steps(20);await page.waitForTimeout(250);
      const f = `poeira-${dustNames[v]}-${an}.png`;await page.screenshot({path: out + f, clip});files.push(f);
    }
  }
  check('12 capturas da poeira (4 opções × 3 ângulos)', files.length === 12);
  const others = [['solidDodge', 3, 'esquiva'], ['solidLanding', 3, 'aterrissagem'], ['solidImpact', 3, 'impacto'], ['solidBlock', 3, 'bloqueio'], ['solidClash', 3, 'colisao']];
  const sheet = [];
  for (const [key, n, nm] of others) for (let v = 0; v < n; v++) for (const [an, yaw] of [['frente', 0], ['lado', Math.PI / 2]]) {
    await L(([key, v]) => {const {C, view} = window.__lab;C.vfx[key].variant = v;view.solid.reset();view.solid.preview(key, window.__stage);}, [key, v]);
    await setup(yaw, 3.6, 1.6, .6);await steps(key === 'solidLanding' || key === 'solidDodge' ? 10 : 6);await page.waitForTimeout(200);
    const f = `${nm}-${'ABC'[v]}-${an}.png`;await page.screenshot({path: out + f, clip: {x: 400, y: 220, width: 700, height: 460}});sheet.push([nm, v, an, f]);
  }
  check('30 capturas das outras famílias (5 × 3 opções × 2 ângulos)', sheet.length === 30);
  await L(s => {const V = window.__lab.C.extras.visual;V.bodyWidth = s.w;V.bodyDepth = s.d;V.bodyHeight = s.h;V.arrowRadius = s.ar;V.arrowLength = s.al;window.__lab.C.vfx.solidDust.variant = 0;['solidDodge', 'solidLanding', 'solidImpact', 'solidBlock', 'solidClash'].forEach(k => window.__lab.C.vfx[k].variant = 0);}, saved);

  // ---------- Desempenho ----------
  await L(() => window.__lab.togglePause?.());
  const perf = await L(async () => {
    const {view, game, C} = window.__lab, fx = view.solid, R = view.renderer, sample = n => { const a = []; for (let i = 0; i < n; i++) { const t0 = performance.now(); fx.update(game.fighters, [], 1 / 60); a.push(performance.now() - t0); } a.sort((x, y) => x - y); return {avg: a.reduce((s, x) => s + x, 0) / n, p95: a[Math.floor(n * .95)], max: a[n - 1]}; };
    const out = {env: {renderer: (() => { try { const gl = R.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'desconhecido'; } catch { return 'desconhecido'; } })(), ua: navigator.userAgent}, dust: {}};
    for (let v = 0; v < 4; v++) {
      C.vfx.solidDust.variant = v; fx.reset(); const s = {dir: {x: 0, z: 1}, speed: 14, t: 0}, f = {position: {x: 0, z: 0}};
      let peak = 0; const t = []; for (let i = 0; i < 360; i++) { if (i % 18 === 0) fx.dust(f, s, 'start', 0); fx.dust(f, s, 'dash', 0); fx.dust(f, s, 'dash', 0); const t0 = performance.now(); fx.update([], [], 1 / 60); t.push(performance.now() - t0); peak = Math.max(peak, fx.all.length); }
      t.sort((a, b) => a - b); out.dust['ABCD'[v]] = {updateAvgMs: +(t.reduce((a, b) => a + b, 0) / t.length).toFixed(4), updateP95Ms: +t[Math.floor(t.length * .95)].toFixed(4), updateMaxMs: +t.at(-1).toFixed(4), peakActive: peak, rejected: fx.stats.rejected, meshes: fx.meshes.size};
    }
    // Pior caso: todas as famílias ao mesmo tempo, sempre no teto de objetos.
    fx.reset(); fx.stats.rejected = 0; const keys = ['solidDodge', 'solidLanding', 'solidImpact', 'solidBlock', 'solidClash']; let peak = 0; const t = [];
    for (let i = 0; i < 360; i++) { for (const k of keys) fx.fire(k, {pos: {x: (i % 7) - 3, z: 2}, n: {x: 0, z: 1}, dir: {x: 0, z: 1}, power: 1.5}, 'carga'); fx.dust({position: {x: 0, z: 0}}, {dir: {x: 0, z: 1}, speed: 16, t: 0}, 'start', 0); const t0 = performance.now(); fx.update([], [], 1 / 60); t.push(performance.now() - t0); peak = Math.max(peak, fx.all.length); }
    t.sort((a, b) => a - b); out.worstCase = {updateAvgMs: +(t.reduce((a, b) => a + b, 0) / t.length).toFixed(4), updateP95Ms: +t[Math.floor(t.length * .95)].toFixed(4), updateMaxMs: +t.at(-1).toFixed(4), peakActive: peak, cap: fx.cap(), rejected: fx.stats.rejected, meshes: fx.meshes.size};
    // Custo de desenho: chamadas e triângulos com e sem as malhas 3D no teto.
    const draw = vis => { fx.group.visible = vis; R.info.reset(); R.render(view.scene, view.camera); return {calls: R.info.render.calls, triangles: R.info.render.triangles}; };
    const drawMs = vis => { fx.group.visible = vis; const a = []; for (let i = 0; i < 30; i++) { const t0 = performance.now(); R.render(view.scene, view.camera); a.push(performance.now() - t0); } a.sort((x, y) => x - y); return +a[15].toFixed(3); };
    out.draw = {withSolid: draw(true), withoutSolid: draw(false), cpuRenderMedianMsWith: drawMs(true), cpuRenderMedianMsWithout: drawMs(false)}; fx.group.visible = true;
    out.geometries = Object.keys(fx.geometries).length; out.materials = Object.keys(fx.materials).length;
    return out;
  });
  writeFileSync(out + 'desempenho.json', JSON.stringify({generated: new Date().toISOString().slice(0, 10), note: 'Edge headless com SwiftShader (renderização por software): tempos de GPU NÃO são representativos; vale como custo de CPU e contagem de desenhos.', ...perf}, null, 2));
  const w = perf.worstCase;
  check('pior caso respeita o teto de objetos', w.peakActive <= w.cap, `pico ${w.peakActive}/${w.cap}, rejeitados ${w.rejected}`);
  check('malhas instanciadas limitadas (≤ 14 desenhos para os sólidos)', perf.draw.withSolid.calls - perf.draw.withoutSolid.calls <= 14, `+${perf.draw.withSolid.calls - perf.draw.withoutSolid.calls} chamadas, +${perf.draw.withSolid.triangles - perf.draw.withoutSolid.triangles} triângulos`);
  check('custo de CPU da atualização no pior caso < 4 ms por quadro', w.updateP95Ms < 4, `média ${w.updateAvgMs} ms · p95 ${w.updateP95Ms} ms`);

  // ---------- Folha de comparação ----------
  const html = `<!doctype html><meta charset="utf-8"><title>Poeira do dash — comparação 3D</title><style>body{font:14px system-ui;background:#10151c;color:#e6edf3;margin:16px}h1,h2{font-weight:600}table{border-collapse:collapse}td,th{border:1px solid #2b3642;padding:4px;vertical-align:top}img{width:420px;display:block}.n{max-width:420px;color:#9fb0c0;font-size:12px}</style>
<h1>Poeira do dash — quatro estilos em 3D</h1><p>Cada coluna é um ângulo de câmera diferente do mesmo dash (instante ≈ 0,4 s). Todas as partículas são malhas com volume (tetraedros, icosaedros irregulares, caixas, prismas e toroides), sem sprites.</p>
<table><tr><th></th><th>Frente</th><th>Lado</th><th>Alto</th></tr>${['A · Poeira compacta — torrões e grãos lançados para trás', 'B · Rastro turbulento — volumes que giram e se dispersam', 'C · Impacto pesado — blocos grandes no início, depois grãos', 'D · Energético — cacos geométricos e onda baixa'].map((t, v) => `<tr><th>${t}</th>${['frente', 'lado', 'alto'].map(a => `<td><img src="poeira-${dustNames[v]}-${a}.png" alt="${t} (${a})"></td>`).join('')}</tr>`).join('')}</table>
<h2>Esquiva, aterrissagem, impacto, bloqueio e colisão</h2><table><tr><th>Efeito</th><th>Opção</th><th>Frente</th><th>Lado</th></tr>${others.flatMap(([key, n, nm]) => Array.from({length: n}, (_, v) => `<tr><td>${nm}</td><td>${'ABC'[v]}</td>${['frente', 'lado'].map(a => `<td><img src="${nm}-${'ABC'[v]}-${a}.png" alt="${nm} ${'ABC'[v]} ${a}" style="width:340px"></td>`).join('')}</tr>`)).join('')}</table>
<h2>Desempenho</h2><pre>${JSON.stringify(perf, null, 2)}</pre>`;
  writeFileSync(out + 'comparacao-poeira.html', html);
  check('sem erros de console nem requisições externas', errors.length === 0 && network.length === 0, [...errors, ...network].slice(0, 3).join(' | '));
} finally {await browser.close();}
console.log(failures ? `\n${failures} verificações falharam.` : '\nVFX sólidos no navegador: tudo aprovado.');
process.exit(failures ? 1 : 0);
