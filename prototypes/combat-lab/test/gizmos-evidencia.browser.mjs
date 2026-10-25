// @ts-check
// Evidência visual dos gizmos de colisão (#05): grava capturas da TELA com hitbox das entidades, hurtbox e deslocamento pretendido × real ligados,
// lado a lado com o VFX (Air Slash em voo, Tackle no meio e no fim). Usa a GPU real por padrão (ARENAMON_GL=software força SwiftShader).
// Saída: prototypes/combat-lab/evidence/gizmos/*.png e resultado.json. Uso: node prototypes/combat-lab/test/gizmos-evidencia.browser.mjs
import {chromium} from '@playwright/test';
import {mkdirSync, writeFileSync} from 'node:fs';
import {pathToFileURL, fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = root + 'evidence/gizmos/';
mkdirSync(out, {recursive: true});
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : process.env.ARENAMON_BROWSER_PATH ? {executablePath: process.env.ARENAMON_BROWSER_PATH} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
const GL = process.env.ARENAMON_GL === 'software' ? ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] : ['--ignore-gpu-blocklist', '--enable-gpu'];
let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {ok ? passed++ : failed++;(ok ? console.log : console.error)(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);};

console.log('\n--- NAVEGADOR: EVIDÊNCIA VISUAL DOS GIZMOS DE COLISÃO ---\n');
const browser = await chromium.launch({...BROWSER, headless: true, args: [...GL, '--no-sandbox']});
const result = {date: new Date().toISOString().slice(0, 10), gl: process.env.ARENAMON_GL === 'software' ? 'software' : 'gpu', shots: /** @type {any[]} */ ([])};
try {
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  const errors = /** @type {string[]} */ ([]);
  page.on('pageerror', e => errors.push(e.message));
  await page.context().setOffline(true);
  await page.goto(labUrl + '?fabrica=1');
  await page.waitForFunction(() => window.__lab?.game && window.__lab.view, null, {timeout: 120000});
  /** Prepara a cena: IA desligada, rival a 6 m à frente, overlays ligados. */
  const setup = (/** @type {string[]} */ loadout) => page.evaluate(lo => {
    const L = window.__lab, g = L.game;
    L.C.extras.toggles.enableEnemyAI = 0;L.startMatch();
    Object.assign(g.mapState, {platforms: [], obstacles: [], destructibles: [], items: [], regularSpawnTimer: 1e9});
    g.fighters[0].position = {x: 0, z: -3};g.fighters[1].position = {x: 0, z: 3};g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
    g.setLoadout(0, lo);
    for (const k of Object.keys(L.view.overlays)) L.view.overlays[k] = false;
    Object.assign(L.view.overlays, {moveEntities: true, hurtbox: true, displacement: true});
    if (L.ui.paused) L.togglePause();
  }, loadout);
  /** Dá N passos com o comando do azul e pausa. */
  const steps = (/** @type {number} */ n, /** @type {any} */ first) => page.evaluate(([n, first]) => {
    const L = window.__lab, g = L.game, empty = () => ({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});
    if (!L.ui.paused) L.togglePause();
    for (let t = 0; t < n; t++) g.step(t === 0 ? {...empty(), ...first} : empty(), empty());
  }, [n, first]);
  const shot = async (/** @type {string} */ name, /** @type {string} */ what) => {
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const path = out + name + '.png';
    await page.screenshot({path});
    const info = await page.evaluate(() => {
      const L = window.__lab, g = L.game;
      return {debugLines: L.view.overlayGroup?.children.length ?? null, entities: g.world.entities.filter((/** @type {any} */ e) => !e.dead).map((/** @type {any} */ e) => ({kind: e.kind, radius: e.radius ?? null, hx: e.hx ?? null})), action: g.fighters[0].action?.kind ?? null};
    });
    result.shots.push({file: `evidence/gizmos/${name}.png`, what, ...info});
    return info;
  };

  await setup(['air-slash']);
  await steps(30, {skill: 0, skillHeld: [true, false, false, false]});
  const a = await shot('air-slash-em-voo', 'Air Slash em voo: anel laranja = raio de colisão do projétil, ao lado do VFX; caixas verdes = hurtbox dos lutadores');
  check('Air Slash: há projétil vivo e linhas de gizmo desenhadas', a.entities.some(e => e.kind === 'projectile') && (a.debugLines ?? 0) > 0, JSON.stringify(a).slice(0, 160));

  await setup([]);
  await steps(14, {tackle: true});
  const b = await shot('tackle-meio', 'Tackle no meio: verde = distância pretendida; branco = percorrida até agora');
  check('Tackle no meio: ação ativa e gizmos desenhados', b.action === 'tackle' && (b.debugLines ?? 0) > 0, JSON.stringify(b));
  await steps(80, {});
  await shot('tackle-fim', 'Tackle no fim (até 1,6 s depois): a linha branca mostra o que de fato andou contra a verde pretendida');
  check('sem erros de página', errors.length === 0, errors.join(' | ').slice(0, 200));
} finally {
  await browser.close();
}
writeFileSync(out + 'resultado.json', JSON.stringify(result, null, 2) + '\n');
console.log(`\n${passed} passaram, ${failed} falharam · capturas em evidence/gizmos/`);
if (failed) process.exit(1);
