// Auditoria: quantas vezes o personagem é atualizado por quadro, com que dt, e quanto o clipe anda dentro de cada chamada.
import {chromium} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const ROOT = 'C:/Users/zerke/OneDrive/Área de Trabalho/Arenamon/';
const [GLB] = process.argv.slice(2);
const browser = await chromium.launch({channel: 'msedge', headless: true});
const page = await browser.newPage({viewport: {width: 1280, height: 800}});
await page.goto(pathToFileURL(ROOT + 'prototypes/combat-lab/dist/arenamon-combate-laboratorio.html').href);
await page.waitForFunction(() => window.__lab);
const bytes = readFileSync(GLB).toString('base64');
const r = await page.evaluate(async ([encoded, name]) => {
  const L = window.__lab, raw = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  L.setCharacter(0, await L.loadStudioFile(new File([raw], name)));
  L.C.extras.toggles.enablePlayerAI = 1;L.C.extras.toggles.enableEnemyAI = 1;L.startMatch();
  const ch = L.ui.characters[0], orig = ch.update.bind(ch), calls = [];
  let rafId = 0;
  ch.update = (f, dt, ...rest) => {
    const before = ch.current?.action?.time ?? 0, key0 = ch.current?.key, mixT0 = ch.mixer?.time;
    const out = orig(f, dt, ...rest);
    calls.push({raf: rafId, dt, key: ch.current?.key, key0, adv: (ch.current?.action?.time ?? 0) - before, mixAdv: (ch.mixer?.time ?? 0) - mixT0, ts: ch.current?.action?.timeScale, paused: ch.current?.action?.paused, enabled: ch.current?.action?.enabled, src: rest[2]?.source ?? rest[1]?.source});
    return out;
  };
  await new Promise(done => {let n = 0;const t = () => {rafId++;if (++n < 240) requestAnimationFrame(t);else done();};requestAnimationFrame(t);});
  ch.update = orig;
  return {calls: calls.slice(-60), perRaf: calls.length / 240, opts: L.C.display?.animation, timeScale: null, speeds: ch.speeds, optsSpeed: ch.constructor.options};
}, [bytes, GLB.split(/[\\/]/).pop()]);
console.log('chamadas por quadro', r.perRaf, 'opcoes', JSON.stringify(r.optsSpeed), 'speeds', JSON.stringify(r.speeds));
for (const c of r.calls.slice(-25)) console.log(JSON.stringify(c));
await browser.close();
