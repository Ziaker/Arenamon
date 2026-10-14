// Paridade com o laboratório v6: executa a simulação original (dentro do HTML v6) e a deste laboratório na
// mesma página, com os mesmos comandos, e compara o estado completo a cada passo (igualdade exata).
// Uso: ARENAMON_LAB_V6=caminho/arenamon-combate-laboratorio-v6.html node prototypes/combat-lab/test/parity.mjs
// O HTML v6 é um arquivo local do usuário (não versionado); sem ele o teste é ignorado.
import {chromium} from '@playwright/test';
import {build} from 'esbuild';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import {homedir} from 'node:os';

const v6 = process.env.ARENAMON_LAB_V6 || `${homedir()}/Downloads/arenamon-combate-laboratorio-v6.html`;
if (!existsSync(v6)) {console.log('Paridade v6: arquivo não encontrado; teste ignorado (' + v6 + ').');process.exit(0);}
const entry = fileURLToPath(new URL('./parity-entry.js', import.meta.url));
const bundle = (await build({entryPoints: [entry], bundle: true, write: false, format: 'iife'})).outputFiles[0].text;
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
  const page = await browser.newPage();const errors = [];page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(v6).href);await page.waitForFunction(() => window.__arenaLive);
  await page.addScriptTag({content: bundle});
  const result = await page.evaluate(() => {
    const live = window.__arenaLive, lab = window.__labSim, report = [];
    const fields = ['position', 'velocity', 'hp', 'stamina', 'state', 'facing', 'visualFacing', 'exhausted', 'guard', 'stun', 'knockRecovery', 'vaultHeight', 'counterWindow', 'flight', 'landingSlide', 'perfectLeft', 'perfectCooldown'];
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    function run(seed, ticks, {enemyAI = false, mode = 'combat', profile = 'balanced'} = {}) {
      let s = seed >>> 0;const rand = () => {s = (s * 1664525 + 1013904223) >>> 0;return s / 4294967296;};
      live.game.profile = profile;live.game.mode = mode;live.game.reset();live.game.brain.reset();
      const g = new lab.Game();g.profile = profile;g.mode = mode;g.reset();
      const hold = [null, null];
      const command = id => {
        // Comandos orientados ao adversário: aproximação, órbita, defesa, X e C perto do alvo.
        const me = live.game.fighters[id], other = live.game.fighters[1 - id];
        const dx = other.position.x - me.position.x, dz = other.position.z - me.position.z, d = Math.hypot(dx, dz) || 1, fx = dx / d, fz = dz / d;
        const r = rand(), kind = rand();
        if (!hold[id] || rand() < .08) hold[id] = {kind: kind < .55 ? 'toward' : kind < .75 ? 'side' : kind < .9 ? 'free' : 'stop', a: rand() * Math.PI * 2, guard: rand() < .15, sign: rand() < .5 ? -1 : 1};
        const h = hold[id];
        const move = h.kind === 'toward' ? {x: fx, z: fz} : h.kind === 'side' ? {x: fz * h.sign, z: -fx * h.sign} : h.kind === 'free' ? {x: Math.sin(h.a), z: Math.cos(h.a)} : {x: 0, z: 0};
        const near = d < 3.6;
        const c = {move, dodge: near ? r < .03 : r < .004, tackle: near ? r > .93 : r > .997, guard: h.guard, guardPressed: false, target: rand() < .85 ? 1 - id : null};
        if (c.tackle) c.move = {x: fx, z: fz};
        if (c.dodge && rand() < .5) c.dodgeDirection = rand() < .5 ? {x: fx, z: fz} : {x: fz, z: -fx};
        c.guardPressed = c.guard && rand() < .3;return c;
      };
      const counts = {};
      for (let t = 0; t < ticks; t++) {
        live.game.phase = live.game.phase === 'result' || live.game.phase === 'finishing' ? live.game.phase : 'playing';
        const c0 = command(0), c1 = enemyAI ? undefined : command(1);
        live.game.step(structuredClone(c0), c1 && structuredClone(c1));g.step(structuredClone(c0), c1 && structuredClone(c1));
        for (const e of g.lastStepEvents) counts[e.result] = (counts[e.result] || 0) + 1;
        if (live.game.tick !== g.tick || live.game.phase !== g.phase || live.game.hitstop !== g.hitstop) return {seed, t, diff: 'game', a: [live.game.tick, live.game.phase, live.game.hitstop], b: [g.tick, g.phase, g.hitstop]};
        for (let id = 0; id < 2; id++) for (const k of fields) if (!same(live.game.fighters[id][k], g.fighters[id][k])) return {seed, t, id, diff: k, a: live.game.fighters[id][k], b: g.fighters[id][k]};
        if (!same(live.game.events.map(e => [e.attacker, e.target, e.result, e.damage]), g.events.map(e => [e.attacker, e.target, e.result, e.damage]))) return {seed, t, diff: 'events'};
        if (g.phase === 'result') {live.game.reset();g.reset();}
      }
      return {seed, ok: true, ticks, counts};
    }
    for (let seed = 1; seed <= 12; seed++) report.push(run(seed * 7919, 4800, {profile: ['balanced', 'agile', 'resistant'][seed % 3]}));
    for (const mode of ['combat', 'offensive', 'defensive', 'inactive']) report.push({mode, ...run(4242, 4800, {enemyAI: true, mode})});
    live.game.phase = 'menu';
    return report;
  });
  let failed = 0;
  for (const r of result) {if (r.ok) console.log('✓ paridade', r.mode ? `IA ${r.mode}` : `semente ${r.seed}`, r.ticks, 'passos', JSON.stringify(r.counts));else {failed++;console.log('✗ divergência', JSON.stringify(r));}}
  if (errors.length) {console.log(errors);failed++;}
  if (failed) process.exit(1);
  const total = {};for (const r of result) for (const [k, v] of Object.entries(r.counts)) total[k] = (total[k] || 0) + v;
  for (const kind of ['impact', 'partial', 'clash', 'invulnerable']) if (!total[kind]) {console.log('✗ cobertura insuficiente: nenhum evento', kind);process.exit(1);}
  console.log(`\nParidade com o v6: ${result.length} execuções idênticas passo a passo. Eventos cobertos: ${JSON.stringify(total)}`);
} finally {await browser.close();}
