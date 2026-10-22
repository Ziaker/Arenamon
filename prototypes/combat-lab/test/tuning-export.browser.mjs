// Exportação/importação do Ajustes no navegador (Edge real): parâmetros de ações e Moves alterados (inclusive os sem slider, como world.riposte) saem em
// changedFromLabDefaults e voltam na importação. Uso: node prototypes/combat-lab/test/tuning-export.browser.mjs
import {chromium} from '@playwright/test';
import {startDevServer} from '../dev-server.mjs';

const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
let failures = 0;
const check = (label, ok, detail = '') => {console.log(`${ok ? '✓' : '✗'} ${label}${detail !== '' ? ` — ${detail}` : ''}`);if (!ok) failures++;};
const srv = await startDevServer({port: 0, quiet: true, watchFiles: false}), base = `http://127.0.0.1:${srv.port}`;
const browser = await chromium.launch({...BROWSER, headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 920}}), errors = [];
  page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  await page.goto(base + '/');await page.waitForFunction(() => window.__lab);
  const r = await page.evaluate(() => {
    const {C, tuning} = window.__lab, def = {riposte: C.world.riposte.cooldown, tackle: C.actions.tackle.duration, bp: C.world.bulletPunch.reach};
    C.world.riposte.cooldown = def.riposte + 1.5;C.world.bulletPunch.reach = def.bp + 0.5;C.actions.tackle.duration = def.tackle + 0.1;
    const data = tuning.exportData(), paths = data.changedFromLabDefaults.map(x => x.path);
    // volta ao padrão e importa o arquivo exportado
    C.world.riposte.cooldown = def.riposte;C.world.bulletPunch.reach = def.bp;C.actions.tackle.duration = def.tackle;
    const preview = tuning.preview(JSON.stringify(data)), changes = preview.changes ?? [];
    tuning.applyChanges(changes, 'teste');
    return {paths, inValues: data.values.world.riposte.cooldown, cooldown: C.world.riposte.cooldown, reach: C.world.bulletPunch.reach, dur: C.actions.tackle.duration, def, changed: changes.map(c => c[0]), err: preview.error ?? null};
  });
  check('exportação lista world.riposte.cooldown (sem slider) em changedFromLabDefaults', r.paths.includes('world.riposte.cooldown'), r.paths.slice(0, 5).join(', '));
  check('exportação lista world.bulletPunch.reach e a duração do Tackle', r.paths.includes('world.bulletPunch.reach') && r.paths.includes('actions.tackle.duration'));
  check('importação aceita os parâmetros fora do Ajustes (sem erro) e os aplica de volta', !r.err && Math.abs(r.cooldown - (r.def.riposte + 1.5)) < 1e-9 && Math.abs(r.reach - (r.def.bp + .5)) < 1e-9 && Math.abs(r.dur - (r.def.tackle + .1)) < 1e-9, JSON.stringify({err: r.err, cooldown: r.cooldown, reach: r.reach, dur: r.dur}));
  check('sem erros no console', errors.length === 0, errors.slice(0, 2).join(' | '));
} finally {await browser.close();srv.close?.();}
console.log(failures ? `${failures} falha(s)` : 'Exportação/importação de parâmetros de ações e Moves (navegador): tudo aprovado');
process.exit(failures ? 1 : 0);
