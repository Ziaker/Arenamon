// Auditoria: quanto o relógio do clipe avança por segundo real em cada estado de uma partida (1,0 = velocidade do Blender).
import {chromium} from '@playwright/test';
import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const ROOT = 'C:/Users/zerke/OneDrive/Área de Trabalho/Arenamon/';
const [GLB, OUT] = process.argv.slice(2);
const browser = await chromium.launch({channel: 'msedge', headless: true});
const page = await browser.newPage({viewport: {width: 1280, height: 800}});
await page.goto(pathToFileURL(ROOT + 'prototypes/combat-lab/dist/arenamon-combate-laboratorio.html').href);
await page.waitForFunction(() => window.__lab);
const bytes = readFileSync(GLB).toString('base64');
const res = await page.evaluate(async ([encoded, name]) => {
  const L = window.__lab, raw = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  L.setCharacter(0, await L.loadStudioFile(new File([raw], name)));
  L.C.extras.toggles.enablePlayerAI = 1;L.C.extras.toggles.enableEnemyAI = 1;L.startMatch();
  const ch = L.ui.characters[0], f = L.game.fighters[0];
  const samples = [];
  await new Promise(done => {
    let n = 0;const tick = () => {
      const c = ch.current;
      samples.push({t: performance.now() / 1000, key: c?.key, clip: c?.clip?.name, time: c?.action?.time ?? 0, dur: c?.clip?.duration ?? 0, state: f.state, act: f.action?.kind ?? null, elapsed: f.action?.elapsed ?? null, w: c?.weight ?? 1, layers: ch.layers.length, speed: Math.hypot(f.velocity.x, f.velocity.z), sprint: !!f.sprinting});
      if (++n < 900) requestAnimationFrame(tick);else done();
    };requestAnimationFrame(tick);
  });
  return samples;
}, [bytes, GLB.split(/[\\/]/).pop()]);
// taxa por estado: soma do avanço do clipe (sem contar voltas de loop/trocas) ÷ soma do tempo real
const by = {};
for (let i = 1; i < res.length; i++) {
  const a = res[i - 1], b = res[i];if (a.key !== b.key || a.clip !== b.clip) continue;
  const dReal = b.t - a.t, dClip = b.time - a.time;if (dReal <= 0 || dClip < -1e-6) continue;   // volta de loop: descarta
  const k = `${b.key} [${b.clip}]`;(by[k] ??= {real: 0, clip: 0, n: 0, dur: b.dur, vel: 0});by[k].real += dReal;by[k].clip += dClip;by[k].n++;by[k].vel += b.speed;
}
const table = Object.entries(by).map(([k, v]) => ({estado: k, quadros: v.n, taxa: +(v.clip / v.real).toFixed(2), duracaoClipe: +v.dur.toFixed(2), velCorpo: +(v.vel / v.n).toFixed(2)})).sort((a, b) => b.quadros - a.quadros);
writeFileSync(OUT, JSON.stringify({table, samples: res}, null, 0));
for (const r of table) console.log(JSON.stringify(r));
await browser.close();
