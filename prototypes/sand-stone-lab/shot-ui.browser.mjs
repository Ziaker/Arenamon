// Cada slider de DISPARO, mexido na interface real (Edge), tem que mudar o disparo medido do efeito ao vivo — em TODAS as categorias que atacam.
// Prova a ligação inteira: slider → valores → efeito → camada de disparo. Controle morto = ✗.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const browser = await chromium.launch({channel: process.env.ARENAMON_BROWSER || 'msedge', headless: true, args: process.env.ARENAMON_GL === 'software' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []});
let failures = 0, total = 0;
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}}), errors = [];
  page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  await page.goto(pathToFileURL(root + 'dist/arenamon-areia-pedra.html').href);await page.waitForFunction(() => window.__labDiagnostics);
  const categories = ['sand', 'stone', 'swift', 'psyshock', 'bulletpunch', 'quickattack', 'riposte'];
  const KEYS = ['shotRadius', 'shotHorizontal', 'shotVertical', 'shotImpulseH', 'shotImpulseV', 'shotTime', 'shotFollow', 'shotSquash', 'shotThickness', 'shotAngleH', 'shotAngleV', 'shotCount', 'shotLength', 'shotParticleSize', 'shotParticleLife'];
  const RING = ['shotSquash', 'shotThickness'], CONE = ['shotAngleH', 'shotAngleV', 'shotCount', 'shotLength', 'shotParticleSize', 'shotParticleLife'];
  const dead = [];
  for (const c of categories) {
    await page.locator(`#categories [data-category="${c}"]`).click();await page.waitForTimeout(150);
    for (const kind of [1, 2]) {
      await page.evaluate(() => document.querySelectorAll('#sliders .phase-group').forEach(g => {g.open = true;}));
      await page.locator('#sliders [data-key="shotKind"] select').selectOption(String(kind));
      for (const key of KEYS) {
        if (kind === 1 && CONE.includes(key) || kind === 2 && RING.includes(key)) continue;
        const sample = async which => {
          await page.evaluate(() => document.querySelectorAll('#sliders .phase-group').forEach(g => {g.open = true;}));
          const f = page.locator(`#sliders [data-key="${key}"]`);
          const limits = await f.locator('input[type=range]').evaluate(el => ({min: Number(el.min), max: Number(el.max), v: Number(el.value)}));
          const alt = Math.abs(limits.max - limits.v) >= Math.abs(limits.v - limits.min) ? limits.v + (limits.max - limits.v) * .65 : limits.v - (limits.v - limits.min) * .65;
          await f.locator('input[type=number]').fill(String(which === 'a' ? limits.v : alt));await f.locator('input[type=number]').dispatchEvent('change');
          await page.waitForTimeout(120);
          // roda até 0,12 s depois do disparo e mede
          const total = await page.evaluate(() => Number(document.getElementById('scrub').max));
          let sig = null;
          for (let t = .05; t <= total && !sig; t += .05) {
            await page.locator('#scrub').evaluate((el, v) => {el.value = String(v);el.dispatchEvent(new Event('input', {bubbles: true}));}, t);
            const s = await page.evaluate(() => window.__labShotSignature());
            if (s && s !== '[]') {await page.locator('#scrub').evaluate((el, v) => {el.value = String(v);el.dispatchEvent(new Event('input', {bubbles: true}));}, t + .12);sig = await page.evaluate(() => window.__labShotSignature());}
          }
          return {sig, v: limits.v, alt};
        };
        // volta ao padrão antes de medir A
        const a = await sample('a');
        const before = a.sig, b = await sample('b');total++;
        if (before === null || b.sig === null) {dead.push(`${c}/${kind === 1 ? 'Argola' : 'Cone'}/${key}: disparo nem apareceu`);continue;}
        if (before === b.sig) dead.push(`${c}/${kind === 1 ? 'Argola' : 'Cone'}/${key}: ${a.v} → ${b.alt.toFixed(2)} não mudou nada`);
        // restaura
        await page.locator(`#sliders [data-key="${key}"] input[type=number]`).fill(String(a.v));await page.locator(`#sliders [data-key="${key}"] input[type=number]`).dispatchEvent('change');
      }
    }
    await page.locator('#sliders [data-key="shotKind"] select').selectOption('0');
  }
  if (dead.length) {console.log('✗ sliders de disparo sem efeito na interface:\n  ' + dead.join('\n  '));failures++;} else console.log(`✓ ${total} combinações slider × tipo × categoria mudam o disparo medido`);
  console.log(errors.length ? '✗ erros: ' + errors.slice(0, 3).join(' | ') : '✓ sem erros de página/console');if (errors.length) failures++;
} finally {await browser.close();}
console.log(failures ? '\nFalhou.' : '\nTudo aprovado.');process.exit(failures ? 1 : 0);
