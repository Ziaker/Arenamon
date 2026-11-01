// Velocidade da locomoção por personagem (view/loco-speed.js): o Eggo anda/corre na velocidade dos próprios clipes; o Wookada
// (clipes no lugar) segue a regra do jogo; o painel mostra o bloco; numa partida os pés do Eggo não patinam.
// Uso: node prototypes/combat-lab/test/loco-speed.browser.mjs
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = new URL('../', import.meta.url);
const browser = await chromium.launch({channel: process.env.ARENAMON_BROWSER || 'msedge', headless: true});
const page = await browser.newPage({viewport: {width: 1280, height: 800}});
const errors = [];page.on('pageerror', e => errors.push(String(e)));
try {
  await page.goto(pathToFileURL(fileURLToPath(new URL('dist/arenamon-combate-laboratorio.html', root))).href);
  await page.waitForFunction(() => window.__lab);
  const load = async (file, name) => page.evaluate(async ([encoded, n]) => {
    const L = window.__lab, raw = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    L.setCharacter(0, await L.loadStudioFile(new File([raw], n)));
    const ch = L.ui.characters[0];return {mode: ch.locoSpeed?.mode, speeds: L.game.locomotion?.[0] ?? null, fighter: L.game.fighters[0].locoSpeeds ?? null, panel: !!document.querySelector('[data-loco-mode]')};
  }, [readFileSync(new URL(file, root)).toString('base64'), name]);
  const eggo = await load('../../chars/Eggo/eggo.glb', 'eggo.glb');
  const wook = await load('../../chars/wookada/wookada.glb', 'wookada.glb');
  const eggo2 = await load('../../chars/Eggo/eggo.glb', 'eggo.glb');
  // partida IA × IA com o Eggo: velocidade do corpo no estado walk e taxa do clipe
  const play = await page.evaluate(async () => {
    const L = window.__lab;L.C.extras.toggles.enablePlayerAI = 1;L.C.extras.toggles.enableEnemyAI = 1;L.startMatch();
    const ch = L.ui.characters[0], f = L.game.fighters[0], s = [];
    await new Promise(done => {let n = 0;const t = () => {s.push({key: ch.current?.key, v: Math.hypot(f.velocity.x, f.velocity.z), sprint: !!f.sprinting, ls: f.locoSpeeds});if (++n < 600) requestAnimationFrame(t);else done();};requestAnimationFrame(t);});
    const walk = s.filter(x => x.key === 'walk' && x.v > .05), sprint = s.filter(x => x.key === 'sprint' && x.v > .05);
    return {walkMax: Math.max(0, ...walk.map(x => x.v)), sprintMax: Math.max(0, ...sprint.map(x => x.v)), nWalk: walk.length, nSprint: sprint.length, ls: s.at(-1).ls};
  });
  console.log(JSON.stringify({eggo, wook, eggo2, play}, null, 1));
  assert.equal(eggo.mode, 'animacao', 'Eggo: velocidade vem da animação por padrão');
  assert.ok(Math.abs(eggo.fighter.walk - .72) < .03 && Math.abs(eggo.fighter.sprint - 2.4) < .05, 'Eggo: andar ≈ 0,72 m/s e sprint ≈ 2,40 m/s (medidos no clipe)');
  assert.equal(wook.mode, 'jogo', 'Wookada: regra do jogo');assert.equal(wook.fighter, null, 'Wookada: sem velocidade própria');
  assert.ok(eggo.panel, 'bloco «Velocidade da locomoção» no painel');
  if (play.nWalk) assert.ok(play.walkMax <= eggo.fighter.walk * 1.05, `Eggo andando no máximo na velocidade do clipe (${play.walkMax.toFixed(2)} m/s)`);
  if (play.nSprint) assert.ok(play.sprintMax <= eggo.fighter.sprint * 1.05, `Eggo correndo no máximo na velocidade do clipe (${play.sprintMax.toFixed(2)} m/s)`);
  assert.deepEqual(errors, [], 'sem erros de página');
  console.log('loco-speed browser: ok');
} finally {await browser.close();}
