// Eggo no jogo (chars/Eggo/eggo.glb): as animações aprovadas são reconhecidas pelo nome e o sprint em qualquer direção gira o corpo
// (pernas para a corrida, tronco/cabeça de volta para o rival). Uso: node prototypes/combat-lab/test/eggo-sprint-turn.browser.mjs
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = new URL('../', import.meta.url);
const browser = await chromium.launch({channel: process.env.ARENAMON_BROWSER || 'msedge', headless: true});
const page = await browser.newPage({viewport: {width: 1280, height: 800}});
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
try {
  await page.goto(pathToFileURL(fileURLToPath(new URL('dist/arenamon-combate-laboratorio.html', root))).href);
  await page.waitForFunction(() => window.__lab);
  const bytes = readFileSync(new URL('../../chars/Eggo/eggo.glb', root)).toString('base64');
  const r = await page.evaluate(async encoded => {
    const L = window.__lab, raw = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    L.setCharacter(0, await L.loadStudioFile(new File([raw], 'eggo.glb')));
    const ch = L.ui.characters[0], f = L.game.fighters[0], D = Math.PI / 180;
    const mapped = {};for (const id of ['idle', 'walk', 'sprint', 'dodge_forward', 'dodge_back', 'dodge_left', 'dodge_right', 'jump', 'jump_start', 'jump_rise', 'jump_apex', 'jump_fall', 'land']) mapped[id] = ch.variantsOf(id).map(i => ch.clips[i].name);
    const frames = n => {for (let i = 0; i < n; i++) ch.update(f, 1 / 60, f.groundY ?? 0, [], {tick: i, fighters: L.game.fighters});};
    const headYaw = () => {const b = ch.rigLayers?.head;if (!b) return null;ch.model.updateMatrixWorld(true);const q = b.getWorldQuaternion(b.quaternion.clone()), e = new (b.position.constructor)(0, 0, 1).applyQuaternion(q);return Math.atan2(e.x, e.z);};
    f.groundY = 0;f.flight = null;f.action = null;f.state = 'neutral';f.facing = 0;f.visualFacing = 0;f.faceGoal = 0;
    const res = {mapped, usesTurn: null, side: null, back: null};
    // correndo para o lado (+X = 90° à esquerda do rosto) e de costas
    for (const [name, vx, vz] of [['side', 5, 0], ['back', 0, -5]]) {
      f.sprinting = true;f.velocity.x = vx;f.velocity.z = vz;f.locoPhase = null;
      frames(90);
      res[name] = {key: ch.current?.key, body: ch.sprintTurn?.body / D, torso: ch.sprintTurn?.torso / D, head: ch.sprintTurn?.head / D, headWorldYaw: headYaw() / D, presentationYaw: ch.presentation.rotation.y / D};
    }
    res.usesTurn = !!ch.sprintTurn;
    f.sprinting = false;f.velocity.x = 0;f.velocity.z = 0;frames(90);res.after = {key: ch.current?.key, body: ch.sprintTurn?.body / D};
    return res;
  }, bytes);
  console.log(JSON.stringify(r, null, 2));
  for (const [id, names] of Object.entries(r.mapped)) assert.ok(names.length, `animação «${id}» do Eggo não reconhecida`);
  assert.equal(r.side.key, 'sprint', 'correndo para o lado toca o sprint para a frente');
  assert.ok(Math.abs(r.side.body - 90) < 2, `corpo deveria girar ~90°: ${r.side.body}`);
  assert.ok(Math.abs(r.side.body + r.side.torso + r.side.head) < 2, 'tronco + cabeça desfazem o giro (rosto no rival)');
  assert.ok(Math.abs(Math.abs(r.back.body) - 180) < 3, `de costas o corpo gira ~180°: ${r.back.body}`);
  assert.ok(Math.abs(r.back.torso) < 1 && Math.abs(Math.abs(r.back.head) - 45) < 2, 'de costas: tronco solto e cabeça no limite');
  assert.ok(Math.abs(r.after.body) < 1, 'sem sprint o corpo volta');
  assert.deepEqual(errors, [], 'sem erros de página');
  console.log('eggo-sprint-turn browser: ok');
} finally {await browser.close();}
