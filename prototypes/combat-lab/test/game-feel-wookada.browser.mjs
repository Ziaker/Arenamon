// Jogo real com o Wookada (modelo pesado, 2×) contra o Mushroom: game feel 5–9 ligados, IA × IA em tempo real, capturas e verificações.
// Uso: node test/game-feel-wookada.browser.mjs [pasta-de-capturas]
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const root = fileURLToPath(new URL('..', import.meta.url)), out = process.argv[2] || root + 'evidence/game-feel-5-9/';
mkdirSync(out, {recursive: true});
const browser = await chromium.launch({channel: process.env.ARENAMON_BROWSER || 'msedge', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 920}}), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  await page.goto(pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href + '?inicial=sim');
  await page.waitForFunction(() => window.__lab?.game && window.__lab.view, null, {timeout: 120000});
  // Azul = Wookada, Vermelho = Cogumelo (workspace inicial): espera os dois modelos de verdade.
  await page.waitForFunction(() => {const c = window.__lab.ui?.characters;return !!(c?.[0]?.source?.assetId && c?.[1]?.source?.assetId);}, null, {timeout: 90000});
  await page.waitForTimeout(1500);
  const setup = await page.evaluate(() => {
    const L = window.__lab, G = L.C.extras.gameFeel, T = L.C.extras.toggles;
    Object.assign(G, {whiffOn: 1, footOn: 1, trackOn: 1, trackSmooth: .08});
    T.enablePlayerAI = 1;T.enableEnemyAI = 1;T.enableAIAttack = 1;
    L.startMatch();
    const info = i => {const c = L.ui.characters[i];return c ? {name: L.ui.sources[i]?.name ?? c.source?.name, hs: c.heightScale, ws: c.widthScale, foot: c.footEnabled, track: c.trackEnabled} : null;};
    return {a: info(0), b: info(1)};
  });
  console.log(JSON.stringify(setup));
  await page.screenshot({path: out + 'wookada-inicio.png'});
  // Jogo real: deixa rodar e coleta amostras do estado visual a cada 500 ms.
  const samples = [];
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(500);
    samples.push(await page.evaluate(() => {
      const L = window.__lab, v = L.view, ch = L.ui.characters[0], f = L.game.fighters[0], rl = ch?.rigLayers;
      let bad = 0;ch?.model.traverse(o => {if (o.isBone && !o.position.toArray().concat(o.quaternion.toArray()).every(Number.isFinite)) bad++;});
      return {tick: L.game.tick, state: f.state, action: f.action?.kind ?? null, ledge: f.ledge?.phase ?? null, whiff: v.whiffFx?.stats ?? null, fw: rl?.fw ?? null, tw: rl?.tw ?? null, pelvis: rl?.pelvis ?? null, bad, y: f.groundY, ey: ch?.extraYaw};
    }));
    if (i === 5) await page.screenshot({path: out + 'wookada-meio.png'});
  }
  await page.screenshot({path: out + 'wookada-fim.png'});
  // Desempenho (brief, p. 8): dois personagens animados com TODAS as camadas ligadas × desligadas, mesmo cenário, quadros de tela medidos por rAF.
  const frames = on => page.evaluate(async on => {
    const G = window.__lab.C.extras.gameFeel;Object.assign(G, {whiffOn: on, footOn: on, trackOn: on});
    await new Promise(r => setTimeout(r, 400));
    const t = [];let last = performance.now();
    await new Promise(res => {let n = 0;const loop = () => {const now = performance.now();t.push(now - last);last = now;if (++n < 240) requestAnimationFrame(loop);else res();};requestAnimationFrame(loop);});
    t.sort((a, b) => a - b);const avg = t.reduce((s, v) => s + v, 0) / t.length;
    return {avg: +avg.toFixed(2), p95: +t[Math.floor(t.length * .95)].toFixed(2), max: +t.at(-1).toFixed(2), anim: +(window.__lab.view.timings?.anim ?? 0).toFixed(3)};
  }, on);
  const perfOff = await frames(0), perfOn = await frames(1);
  console.log(JSON.stringify({perfOff, perfOn}));
  const diag = await page.evaluate(() => ({a: window.__lab.ui.characters[0]?.rigDiagnostic?.(), b: window.__lab.ui.characters[1]?.rigDiagnostic?.()}));
  const last = samples.at(-1), ticks = samples.at(-1).tick - samples[0].tick;
  const maxFw = Math.max(...samples.map(s => s.fw ?? 0)), maxTw = Math.max(...samples.map(s => s.tw ?? 0)), maxPelvis = Math.max(...samples.map(s => Math.abs(s.pelvis ?? 0)));
  console.log(JSON.stringify({ticks, whiff: last.whiff, maxFw, maxTw, maxPelvis, bad: Math.max(...samples.map(s => s.bad)), diag}, null, 1));
  assert.ok(ticks > 200, 'a simulação avançou em tempo real: ' + ticks);
  assert.equal(Math.max(...samples.map(s => s.bad)), 0, 'nenhum osso com NaN');
  assert.ok(maxFw > .5, 'o apoio dos pés ficou ativo no Wookada: ' + maxFw);
  assert.ok(maxPelvis <= .06 + 1e-6, 'pelve dentro do limite: ' + maxPelvis);
  assert.ok(perfOn.avg < perfOff.avg + 4 && perfOn.p95 < perfOff.p95 + 8, 'as camadas não custam mais que o orçamento de quadro: ' + JSON.stringify({perfOff, perfOn}));
  assert.deepEqual(errors, [], 'sem erros de página');
  console.log('game-feel-wookada browser: ok');
} finally {
  await browser.close();
}
