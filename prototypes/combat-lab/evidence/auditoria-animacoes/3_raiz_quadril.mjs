// O quadril do modelo fica sobre o lutador? (deslocamento horizontal do quadril em relação à posição da física, ao longo do clipe)
import {chromium} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const ROOT = 'C:/Users/zerke/OneDrive/Área de Trabalho/Arenamon/';
const CHARS = [['Eggo', 'chars/Eggo/eggo.glb'], ['Wookada', 'chars/wookada/wookada.glb'], ['Cogumelo', 'chars/mosh/Cogumelo.glb']];
const browser = await chromium.launch({channel: 'msedge', headless: true});
const page = await browser.newPage({viewport: {width: 1280, height: 800}});
await page.goto(pathToFileURL(ROOT + 'prototypes/combat-lab/dist/arenamon-combate-laboratorio.html').href);
await page.waitForFunction(() => window.__lab);
for (const [label, rel] of CHARS) {
  const bytes = readFileSync(ROOT + rel).toString('base64');
  const r = await page.evaluate(async ([encoded, name]) => {
    const L = window.__lab, raw = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    L.setCharacter(0, await L.loadStudioFile(new File([raw], name)));
    const ch = L.ui.characters[0], f = L.game.fighters[0];
    f.groundY = 0;f.flight = null;f.action = null;f.state = 'neutral';f.sprinting = false;f.velocity.x = 0;f.velocity.z = 0;f.position.x = 0;f.position.z = 0;f.facing = 0;f.visualFacing = 0;
    const V = () => new (ch.root.position.constructor)();
    const out = {};
    for (const n of ['walk', 'sprint', 'dodge forward', 'dodge left', 'Mutant Walking', 'Zombie Walk', 'Left Strafe']) {
      const idx = ch.clips.findIndex(c => c.name === n);if (idx < 0) continue;
      ch.startPreview(idx, {loop: true});let mx = 0, mn = 0, prev = null, jump = 0;
      for (let k = 0; k < 150; k++) {
        ch.update(f, 1 / 60, 0, [], {tick: k, fighters: L.game.fighters});ch.model.updateMatrixWorld(true);
        const p = ch.hips.getWorldPosition(V()), d = Math.hypot(p.x - f.position.x, p.z - f.position.z);
        mx = Math.max(mx, d);if (prev) jump = Math.max(jump, Math.hypot(p.x - prev.x, p.z - prev.z));prev = p;
      }
      out[n] = {quadrilLongeDoCorpo_m: +mx.toFixed(2), maiorSaltoPorQuadro_m: +jump.toFixed(2), travaRaiz: ch.lockRootMotion};
    }
    ch.stopPreview();return out;
  }, [bytes, rel.split('/').pop()]);
  console.log(label, JSON.stringify(r));
}
await browser.close();
