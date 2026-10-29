// F8 (Task 16) — homologação no NAVEGADOR (Edge real, WebGL, offline, dist compilado): acessibilidade e ciclo de vida da UI.
//  · IA × IA com Sem Flash + Reduzir Movimento (vfx.master.noFlash/reduceMotion) ligados: nenhum flash de tela nem tremor de câmera do VFX
//    (view.vfx.screenFlash/shake instrumentados e estado amostrado a cada quadro); controle com os dois desligados para a prova valer.
//  · Pausa, perda de foco (blur/visibilitychange) e reinício não lançam erro.
//  · 100 reinícios de partida (startMatch, o botão Iniciar): renderer.info.memory (geometrias/texturas) e programas não crescem.
// Capturas e números em prototypes/combat-lab/evidence/homologacao-f8/ (seção "browser" do resultado.json).
// Uso: node prototypes/combat-lab/test/f8-homologacao.browser.mjs   (compile antes: npm run rapido:build)
import {createRequire} from 'node:module';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
const require = createRequire(import.meta.url);
const {chromium} = require('@playwright/test');

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'evidence/homologacao-f8/';mkdirSync(out, {recursive: true});
const report = [];let failures = 0;
const check = (label, ok, detail = '') => {report.push({label, ok: !!ok, detail: String(detail)});console.log(`${ok ? '✓' : '✗'} ${label}${detail !== '' ? ` — ${detail}` : ''}`);if (!ok) failures++;};
const browser = await chromium.launch({channel: process.env.ARENAMON_BROWSER || 'msedge', headless: true});
const page = await browser.newPage({viewport: {width: 1500, height: 920}});
const errors = [];page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
await page.context().setOffline(true);
await page.goto(pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href + '?fabrica=1');await page.waitForFunction(() => window.__lab);
const L = (fn, arg) => page.evaluate(fn, arg);
const frames = n => L(n => new Promise(r => {let k = 0;const f = () => (++k >= n ? r() : requestAnimationFrame(f));requestAnimationFrame(f);}), n);
const result = {};
try {
  // Instrumentação: conta flashes/tremores que de fato entram no VFX legado (o renderizador padrão) e amostra o estado a cada quadro.
  await L(() => {
    const v = window.__lab.view.vfx, W = window.__f8 = {flash: 0, shake: 0, flashFrames: 0, shakeFrames: 0, frames: 0};
    const sf = v.screenFlash.bind(v), sh = v.shake.bind(v);
    v.screenFlash = (...a) => {const b = v.flash;sf(...a);if (v.flash && v.flash !== b) W.flash++;};
    v.shake = (...a) => {const n = v.shakes.length;sh(...a);if (v.shakes.length > n) W.shake++;};
    const g = window.__lab.game, st = g.step.bind(g);
    g.step = (...a) => {st(...a);for (const e of g.lastStepEvents) if (['impact', 'clash', 'perfect', 'partial', 'wallSplat', 'footstool'].includes(e.result)) W.hits = (W.hits ?? 0) + 1;};   // golpes reais da simulação (só contagem)
    const tick = () => {W.frames++;if (v.flash) W.flashFrames++;if (v.shakes.length) W.shakeFrames++;requestAnimationFrame(tick);};requestAnimationFrame(tick);
  });
  const phase = async (noFlash, reduce, label) => {
    await L(([nf, rm]) => {const lab = window.__lab;lab.tuning.commit([['extras.toggles.enablePlayerAI', 1], ['vfx.master.noFlash', nf], ['vfx.master.reduceMotion', rm]], 'F8');
      lab.moves.equipStandard(0);lab.moves.equipStandard(1);lab.startMatch();Object.assign(window.__f8, {flash: 0, shake: 0, flashFrames: 0, shakeFrames: 0, frames: 0, hits: 0});
      window.__f8d0 = lab.view.dispatch.diagnostics().delivered;}, [noFlash, reduce]);
    await page.waitForTimeout(30000);
    const r = await L(() => ({...window.__f8, delivered: window.__lab.view.dispatch.diagnostics().delivered - window.__f8d0, tick: window.__lab.game.tick, events: window.__lab.game.eventIdSeq}));
    await page.screenshot({path: out + `acessibilidade-${label}.png`});
    return r;
  };
  const ctrl = await phase(0, 0, 'controle');
  check('controle (Sem Flash e Reduzir Movimento desligados): a partida IA × IA gera eventos e o VFX dispara tremor/flash', ctrl.hits > 0 && ctrl.shake + ctrl.flash > 0, JSON.stringify(ctrl));
  const acc = await phase(1, 1, 'sem-flash-reduzir-movimento');
  check('Sem Flash + Reduzir Movimento: nenhum flash de tela e nenhum tremor de câmera em nenhum quadro', acc.hits > 0 && acc.flash === 0 && acc.shake === 0 && acc.flashFrames === 0 && acc.shakeFrames === 0, JSON.stringify(acc));
  result.acessibilidade = {controle: ctrl, semFlashReduzirMovimento: acc, janelaSegundos: 30};

  // Pausa, perda de foco e reinício
  const e0 = errors.length;
  await L(() => {const lab = window.__lab;lab.togglePause(true);lab.togglePause(false);window.dispatchEvent(new Event('blur'));document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));lab.togglePause(true);lab.stepFrames(1);lab.stepFrames(-1);lab.goLive();lab.startMatch();});
  await frames(30);
  check('pausa, avanço/recuo de quadro, perda de foco e reinício sem erro', errors.length === e0, errors.slice(e0).join(' | '));

  // 100 reinícios: memória da GPU (geometrias/texturas vivas no three) e programas
  await L(() => window.__lab.tuning.commit([['vfx.master.noFlash', 0], ['vfx.master.reduceMotion', 0]], 'F8'));
  const mem = [];
  for (let i = 1; i <= 100; i++) {
    await L(() => window.__lab.startMatch());await frames(4);
    if ([1, 10, 50, 100].includes(i)) mem.push(await L(i => {const r = window.__lab.view.renderer.info;return {reset: i, geometries: r.memory.geometries, textures: r.memory.textures, programs: r.programs?.length ?? null};}, i));
  }
  const m10 = mem.find(x => x.reset === 10), m100 = mem.find(x => x.reset === 100);
  check('100 reinícios: geometrias, texturas e programas estáveis entre o 10º e o 100º', m100.geometries <= m10.geometries && m100.textures <= m10.textures && (m100.programs ?? 0) <= (m10.programs ?? 0), JSON.stringify(mem));
  await page.screenshot({path: out + 'apos-100-reinicios.png'});
  result.reinicios = mem;
  check('sem erros de página no teste inteiro', errors.length === 0, errors.join(' | '));
  result.renderer = await L(() => {const gl = window.__lab.view.renderer.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info');return x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : 'desconhecido';});
} catch (e) {check('execução', false, e.stack);}
finally {
  await browser.close();
  const file = out + 'resultado.json', prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  writeFileSync(file, JSON.stringify({...prev, browser: {geradoEm: new Date().toISOString(), ...result, checks: report, falhas: failures}}, null, 1) + '\n');
  console.log(`\n${report.length - failures}/${report.length} verificações ok`);
  if (failures) process.exit(1);
}
