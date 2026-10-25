// @ts-check
// Navegador (Playwright, file:// offline): Sand Wave e Emerging Stone no JOGO com o renderizador do atelier Areia/Pedra (view/quarks/atelier-game.js).
// Dispara os Moves pela simulação (como a rodada-b), confere que a camada do atelier assume o desenho, que os desenhos provisórios saem de cena e que não há erros.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = process.env.ARENAMON_OUT ?? (root + 'evidence/atelier-jogo/');
mkdirSync(out, {recursive: true});
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {ok ? passed++ : failed++;(ok ? console.log : console.error)(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);};

console.log('\n--- NAVEGADOR: SAND WAVE E EMERGING STONE COM O ATELIER ---\n');
const browser = await chromium.launch({...BROWSER, headless: true, args: process.env.ARENAMON_GL === 'software' ? ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] : []});
try {
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('request', r => {if (!/^(file|data|blob):/.test(r.url())) requests.push(r.url());});
  await page.context().setOffline(true);
  await page.goto(labUrl + '?fabrica=1');
  await page.waitForFunction(() => window.__lab?.moves && window.__lab.game, null, {timeout: 120000});
  const L = (fn, arg) => page.evaluate(fn, arg);
  const frames = n => L(n => new Promise(res => {let i = 0;const f = () => (++i >= n ? res(0) : requestAnimationFrame(f));requestAnimationFrame(f);}), n);
  await L(() => {document.getElementById('moves-close')?.click();window.__lab.startMatch();});
  await L(() => {window.__labRecording.ui.paused = true;});
  const idle = `({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null})`;
  const setup = move => L(([move]) => {
    window.__lab.startMatch();window.__labRecording.ui.paused = true;const g = window.__lab.game, a = g.fighters[0], b = g.fighters[1];g.setLoadout(0, [move, null, null, null]);
    a.position = {x: -4, z: 0};a.groundY = 0;a.flight = null;a.action = null;a.velocity = {x: 0, z: 0};a.stamina = 11;a.moveCooldowns = {};a.facing = Math.PI / 2;b.position = {x: 8, z: 6};
  }, [move]);
  const steps = (n, press) => L(([n, press, idle]) => {
    const g = window.__lab.game, e = () => eval(idle);
    for (let i = 0; i < n; i++) {g.step({...e(), ...(press && i === 0 ? {skill: 0} : {}), skillHeld: [!!press && press !== 'once', false, false, false]}, e());window.__lab.view.worldView.update(g.world, {fighters: g.fighters, events: [], dt: 1 / 60});}
  }, [n, press, idle]);
  const until = (kind, max) => L(([kind, max, idle]) => {const g = window.__lab.game, e = () => eval(idle);for (let i = 0; i < max && !g.world.entities.some(x => x.kind === kind); i++) {g.step(e(), e());window.__lab.view.worldView.update(g.world, {fighters: g.fighters, events: [], dt: 1 / 60});}return g.world.entities.some(x => x.kind === kind);}, [kind, max, idle]);
  const info = () => L(() => {
    const wv = window.__lab.view.worldView, d = wv.atelierFx.diagnostics(), ents = window.__lab.game.world.entities;
    return {atelier: d, kinds: ents.map(e => e.kind), oldSand: ents.filter(e => e.kind === 'sandwave').some(e => !!wv.meshes.get(e.id)), oldBurrow: ents.filter(e => e.kind === 'burrow').some(e => !!wv.meshes.get(e.id))};
  });

  // Sand Wave
  await setup('sand-wave');await frames(6);
  await steps(1, 'once');check('Sand Wave: a barragem nasce na simulação', await until('sandwave', 60));await steps(6);await frames(8);
  let s = await info();
  check('Sand Wave: a camada do atelier desenha a barragem e o desenho provisório saiu de cena', s.kinds.includes('sandwave') && s.atelier.items.some(i => i.kind === 'sandwave') && !s.oldSand, JSON.stringify(s.atelier));
  await steps(20);await frames(8);
  await page.screenshot({path: out + 'sand-wave-jogo.png'});
  s = await info();
  check('Sand Wave: partículas Quarks do atelier vivas durante a barragem', s.atelier.items.some(i => i.kind === 'sandwave' && i.particles > 0), JSON.stringify(s.atelier));
  await steps(400);await frames(30);
  s = await info();
  check('Sand Wave: o efeito do atelier termina e é descartado sem vazar', s.atelier.count === 0, JSON.stringify(s.atelier));

  // Emerging Stone
  await setup('emerging-stone');await frames(6);
  await L(([idle]) => {const g = window.__lab.game, e = () => eval(idle);const vu = () => window.__lab.view.worldView.update(g.world, {fighters: g.fighters, events: [], dt: 1 / 60});g.step({...e(), skill: 0, skillHeld: [true, false, false, false]}, e());for (let i = 0; i < 90; i++) g.step({...e(), skillHeld: [true, false, false, false]}, e());g.step(e(), e());for (let i = 0; i < 40 && !g.world.entities.some(x => x.kind === 'burrow'); i++) {g.step(e(), e());vu();}for (let i = 0; i < 8; i++) {g.step(e(), e());vu();}}, [idle]);
  await frames(8);
  s = await info();
  check('Emerging Stone: o trajeto subterrâneo é desenhado pela camada do atelier (sem o desenho provisório)', s.kinds.includes('burrow') && s.atelier.items.some(i => i.kind === 'burrow') && !s.oldBurrow, JSON.stringify({kinds: s.kinds, ...s.atelier}));
  await page.screenshot({path: out + 'emerging-stone-trajeto-jogo.png'});
  await steps(40);await frames(8);
  await page.screenshot({path: out + 'emerging-stone-erupcao-jogo.png'});
  await steps(500);await frames(40);
  s = await info();
  check('Emerging Stone: o efeito termina e é descartado sem vazar', s.atelier.count === 0, JSON.stringify(s.atelier));

  // Swift e Psyshock: visual aprovado do atelier preso às posições reais dos projéteis (sem a estrela/rocha provisória)
  for (const [move, label, hold] of [['swift', 'Swift', 1], ['psyshock', 'Psyshock', 70]]) {
    await setup(move);await L(() => {const b = window.__lab.game.fighters[1];b.position = {x: 4, z: 0};});await frames(6);
    await steps(hold, hold > 1 ? 'hold' : 'once');await steps(1);
    const has = await L(([idle]) => {const g = window.__lab.game, e = () => eval(idle);for (let i = 0; i < 90 && !g.world.entities.some(x => x.kind === 'projectile'); i++) {g.step(e(), e());window.__lab.view.worldView.update(g.world, {fighters: g.fighters, events: [], dt: 1 / 60});}return g.world.entities.some(x => x.kind === 'projectile');}, [idle]);
    check(`${label}: projéteis nascem na simulação`, has);
    await steps(8);await frames(6);
    const v = await L(() => {
      const wv = window.__lab.view.worldView, d = wv.atelierFx.diagnostics(), ps = window.__lab.game.world.entities.filter(e => e.kind === 'projectile');
      const pos = ps.map(e => {const p = wv.atelierFx.positionOf(e.id);return p ? Math.hypot(p.x - e.pos.x, p.z - e.pos.z) : 99;});
      return {volleys: d.volleys, old: ps.some(e => !!wv.meshes.get(e.id)), maxGap: Math.max(0, ...pos, ...d.volleys.map(x => x.nodeGap)), n: ps.length};
    });
    check(`${label}: a rajada é desenhada pela camada do atelier, sem o desenho provisório`, v.volleys.some(x => x.move === move && x.samples > 0) && !v.old, JSON.stringify(v));
    check(`${label}: o visual acompanha a posição real de cada projétil (≤ 0,6 m)`, v.n > 0 && v.maxGap <= .6, `maior distância ${v.maxGap.toFixed(2)} m`);
    await page.screenshot({path: out + `${move}-aprovado-jogo.png`});
    await L(() => {const g = window.__lab.game;g.world.entities.length = 0;});
    await steps(400);await frames(10);
    const end = await info();
    check(`${label}: o efeito termina e é descartado sem vazar`, !(end.atelier.volleys ?? []).length, JSON.stringify(end.atelier.volleys));
  }

  check('sem erros de página/console', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('sem requisições externas', requests.length === 0, requests.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}
console.log(failed ? `\nFalhou: ${failed} (de ${passed + failed}).` : '\nTudo aprovado.');
process.exit(failed ? 1 : 0);
