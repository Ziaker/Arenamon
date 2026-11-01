// Diagnóstico: Blender x GLB cru (three) x pose final do jogo, para os mesmos frames.
import {chromium} from '@playwright/test';
import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const ROOT = 'C:/Users/zerke/OneDrive/Área de Trabalho/Arenamon/';
const [GLB, BPOSE, OUT] = process.argv.slice(2);
const browser = await chromium.launch({channel: 'msedge', headless: true});
const page = await browser.newPage({viewport: {width: 1280, height: 800}});
const errors = [];page.on('pageerror', e => errors.push(String(e)));
await page.goto(pathToFileURL(ROOT + 'prototypes/combat-lab/dist/arenamon-combate-laboratorio.html').href);
await page.waitForFunction(() => window.__lab);
const bytes = readFileSync(GLB).toString('base64'), bpose = BPOSE ? JSON.parse(readFileSync(BPOSE, 'utf8')) : null;
const res = await page.evaluate(async ([encoded, bpose, name]) => {
  const L = window.__lab, raw = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  L.setCharacter(0, await L.loadStudioFile(new File([raw], name)));
  const ch = L.ui.characters[0], f = L.game.fighters[0];
  ch.groundCurve(0);const probe = ch.probe;   // cópia crua do GLB + mixer próprio (sem nenhuma camada do jogo)
  const bonesOf = root => {const m = new Map();root.traverse(o => {if (o.isBone) m.set(o.name, o);});return m;};
  const rawBones = bonesOf(probe.root), gameBones = bonesOf(ch.model);
  const V = () => new (ch.root.position.constructor)();
  const rel = (bones, ref) => {const out = {}, h = bones.get(ref).getWorldPosition(V());const pr = bones.get(ref).parent;for (const [n, b] of bones) {const p = b.getWorldPosition(V()).sub(h);out[n] = [p.x, p.y, p.z];}return out;};
  const report = {clips: {}, scale: ch.root.scale.y, errors: []};
  f.groundY = 0;f.flight = null;f.action = null;f.state = 'neutral';f.sprinting = false;f.velocity.x = 0;f.velocity.z = 0;f.position.x = 0;f.position.z = 0;f.facing = 0;f.visualFacing = 0;
  for (let i = 0; i < ch.clips.length; i++) {
    const clip = ch.clips[i], rows = [];
    for (const frame of [1, 5, 9]) {
      const t = Math.min(clip.duration, frame / 24);   // o GLB do Blender começa em 1/24 (frame 1)
      // cru
      probe.mixer.stopAllAction();const a = probe.mixer.clipAction(probe.mixer._root ? clip : clip);a.reset();a.play();a.time = t;probe.mixer.update(0);probe.root.updateMatrixWorld(true);
      const R = rel(rawBones, 'Hips');
      // jogo (prévia pausada no instante t, com todas as camadas)
      ch.startPreview(i, {paused: true, seek: t});for (let k = 0; k < 90; k++) ch.update(f, 1 / 60, 0, [], {tick: k, fighters: L.game.fighters});
      ch.model.updateMatrixWorld(true);
      const G = rel(gameBones, 'Hips'), s = ch.root.scale.y;
      let worst = 0, wb = '';for (const n of Object.keys(R)) {if (!G[n]) continue;const d = Math.hypot(R[n][0] - G[n][0] / s, R[n][1] - G[n][1] / s, R[n][2] - G[n][2] / s);if (d > worst) {worst = d;wb = n;}}
      // Blender (Z-up) -> three (Y-up): (x, z, -y)
      let bw = null;
      if (bpose?.[clip.name]?.[frame]) {const B = bpose[clip.name][frame], h = B.Hips;bw = 0;let bb = '';for (const n of Object.keys(R)) {if (!B[n]) continue;const p = [B[n][0] - h[0], B[n][2] - h[2], -(B[n][1] - h[1])];const d = Math.hypot(R[n][0] - p[0], R[n][1] - p[1], R[n][2] - p[2]);if (d > bw) {bw = d;bb = n;}}bw = [+(bw * 100).toFixed(1), bb];}
      rows.push({frame, cru_vs_jogo_cm: +(worst * 100).toFixed(1), osso: wb, blender_vs_cru: bw});
    }
    report.clips[clip.name] = rows;
  }
  ch.stopPreview();
  return report;
}, [bytes, bpose, GLB.split(/[\\/]/).pop()]);
writeFileSync(OUT, JSON.stringify({...res, pageErrors: errors}, null, 1));
console.log(JSON.stringify(res.clips, null, 0).slice(0, 4000));
console.log('erros', errors.slice(0, 5));
await browser.close();
