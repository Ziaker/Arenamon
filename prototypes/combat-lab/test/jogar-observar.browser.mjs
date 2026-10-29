// JOGAR → OBSERVAR: abre o jogo compilado no navegador real, usa o teclado de verdade (slot 1 de J1/J2) e mede por quadro o Sand Wave (antes = valores antigos, depois = padrão), as esferas de carga do Water Pulse dos dois lutadores e fotografa o Air Slash. Uso: node prototypes/combat-lab/test/jogar-observar.browser.mjs
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync, writeFileSync} from 'node:fs';
const root = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.env.PLAY_OUT ?? root + 'evidence/jogar-observar'; mkdirSync(OUT, {recursive: true});
const url = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const browser = await chromium.launch({channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox']});
const page = await browser.newPage({viewport: {width: 1400, height: 900}});
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.context().setOffline(true);
await page.goto(url + '?inicial=sim');
await page.waitForFunction(() => window.__lab?.game && window.__lab.view, null, {timeout: 120000});
// modelos importados (Azul = Wookada, Vermelho = Cogumelo) vindos do workspace inicial: espera os dois personagens carregarem de verdade
await page.waitForFunction(() => { const c = window.__lab.ui?.characters; return !!(c?.[0]?.source?.assetId && c?.[1]?.source?.assetId); }, null, {timeout: 90000}).catch(() => console.log('AVISO: modelos não carregaram a tempo'));
console.log('modelos:', JSON.stringify(await page.evaluate(() => window.__lab.ui.characters.map(c => c?.source?.name ?? c?.source?.assetId ?? null))));
await page.waitForTimeout(1500);
const keyOf = async (slot, side) => page.evaluate(([slot, side]) => { const E = window.__lab.C.extras; const b = side ? E.bindings2 : E.bindings; return E.keyCodes[b['skill' + slot]]; }, [slot, side]);
const k1 = await keyOf(1, 0), k2 = await keyOf(1, 1);
console.log('teclas skill1 J1/J2:', k1, k2);

async function setup(move, a = -4, b = 3) {
  await page.evaluate(([move, a, b]) => {
    const L = window.__lab, g = L.game, C = L.C;
    C.extras.toggles.enableEnemyAI = 0; C.extras.toggles.enemyManual = 1; L.startMatch();
    Object.assign(g.mapState, {platforms: [], obstacles: [], destructibles: [], items: [], regularSpawnTimer: 1e9});
    for (const f of g.fighters) { f.stamina = 99; }
    g.setLoadout(0, [move]); g.setLoadout(1, [move]);
    g.fighters[0].position = {x: 0, z: a}; g.fighters[1].position = {x: 0, z: b};
    g.fighters[0].facing = 0; g.fighters[1].facing = Math.PI;
  }, [move, a, b]);
  await page.waitForTimeout(300);
}
const shot = async (n) => page.screenshot({path: `${OUT}/${n}.png`});
const R = {};

// ===== SAND WAVE: J1 lança em J2; amostra por quadro =====
async function sandRun(tag, overrides) {
  await setup('sand-wave', -2, 2);
  await page.evaluate(o => { const W = window.__lab.C.world.sandWave; Object.assign(W, o); window.__lab.sw = []; const g = window.__lab.game;
    const loop = () => { const e = g.world.entities.find(x => x.kind === 'sandwave'); const f = g.fighters[1];
      if (e) window.__lab.sw.push({tick: g.tick, age: +e.age.toFixed(3), x: +f.position.x.toFixed(2), z: +f.position.z.toFixed(2), v: +(f.locomotionVelocity?.z ?? 0).toFixed(2), push: !!f.sandPush, state: f.state, front: +(window.__lab.sandFront?.(e) ?? 0).toFixed?.(2)});
      requestAnimationFrame(loop); }; loop(); }, overrides);
  await page.keyboard.down(k1); await page.waitForTimeout(80); await page.keyboard.up(k1);
  await page.waitForTimeout(250); await shot(`sandwave-${tag}-250ms`);
  await page.waitForTimeout(400); await shot(`sandwave-${tag}-650ms`);
  await page.waitForTimeout(1200);
  const s = await page.evaluate(() => window.__lab.sw);
  const first = s.find(r => r.push), last = [...s].reverse().find(r => r.push), maxV = Math.max(...s.map(r => r.v));
  R['sand-' + tag] = {frames: s.length, primeiroEmpurrao: first, ultimoEmpurrao: last, vMax: maxV, amostras: s.filter((_, i) => i % Math.max(1, Math.floor(s.length / 12)) === 0)};
}
await sandRun('antes-rampa', {pushSpeed: 0, pushMaxSpeed: 0});
await sandRun('depois-constante', {pushSpeed: 13.333333, pushMaxSpeed: 13.333333});
// padrão real do jogo (sem sobrescrever): confere o valor que o usuário recebe
R.padraoSandWave = await page.evaluate(() => { const W = window.__lab.C.world.sandWave; return {pushSpeed: W.pushSpeed, pushMaxSpeed: W.pushMaxSpeed}; });

// ===== WATER PULSE: J1 e J2 carregando juntos =====
await setup('water-pulse', -3, 3);
await page.keyboard.down(k1); await page.keyboard.down(k2);
await page.waitForTimeout(500);
R.waterCarga = {};
for (const ms of [300, 600, 900]) {
  await page.waitForTimeout(ms === 300 ? 0 : 300);
  R.waterCarga[ms] = await page.evaluate(() => { const w = window.__lab.view.worldView, p = w.waterCharge ?? {}; return Object.fromEntries(Object.entries(p).map(([id, x]) => [id, {visivel: x.root.visible, escala: +x.root.scale.x.toFixed(2), sistemas: x.systems.length}])); });
}
await shot('water-carga-J1-e-J2');
await page.keyboard.up(k1); await page.keyboard.up(k2);
await page.waitForTimeout(250); await shot('water-solto');
await page.waitForTimeout(3500);
R.waterDepois = await page.evaluate(() => ({esferas: Object.keys(window.__lab.view.worldView.waterCharge ?? {}).length, entidades: window.__lab.game.world.entities.length}));
await shot('water-fim');

// ===== AIR SLASH: visibilidade =====
await setup('air-slash', -4, 4);
await page.keyboard.down(k1); await page.waitForTimeout(80); await page.keyboard.up(k1);
await page.waitForTimeout(120); await shot('airslash-voo-1'); await page.waitForTimeout(120); await shot('airslash-voo-2');

R.errosDePagina = errs.slice(0, 5);
writeFileSync(OUT + '/resultado.json', JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1).slice(0, 5000));
await browser.close();
