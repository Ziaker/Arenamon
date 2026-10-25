// Fase 6 no navegador (Edge real, file://, offline): aba Moves (equipar, parâmetros, emissores, cenários técnicos), HUD dos slots durante a
// carga, prévia da barreira, reflexão com anel de impacto, pedras do Psyshock e aviso de falha. Capturas em validation/moves-ui/.
// Verificação TÉCNICA: a aprovação de jogabilidade e visual é do diretor (M28.9).
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync, writeFileSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'validation/moves-ui/';mkdirSync(out, {recursive: true});
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
const report = [];let failures = 0;
const check = (label, ok, detail = '') => {report.push({label, ok: !!ok, detail: String(detail)});console.log(`${ok ? '✓' : '✗'} ${label}${detail !== '' ? ` — ${detail}` : ''}`);if (!ok) failures++;};
const browser = await chromium.launch({...BROWSER, headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 920}, acceptDownloads: true}), errors = [], network = [];
  page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('request', r => {if (/^https?:/.test(r.url())) network.push(r.url());});page.on('dialog', d => d.accept());
  await page.context().setOffline(true);await page.goto(labUrl + '?fabrica=1');await page.waitForFunction(() => window.__lab);
  const L = (fn, arg) => page.evaluate(fn, arg);
  await L(() => {window.__lab.C.map.arenaShape = 'square';});
  const tab = t => L(t => {if (t === 'moves') {if (document.getElementById('moves-drawer').hidden) document.getElementById('moves-open').click();return;}const p = document.getElementById('panel');if (p.hidden || p.dataset.tool !== t) document.querySelector(`button[data-tool="${t}"]`).click();}, t);
  const leftMoves = () => L(() => {const p = document.getElementById('panel');if (p.hidden || p.dataset.tool !== 'moves') document.querySelector('button[data-tool="moves"]').click();document.getElementById('moves-tools').open = true;document.querySelector('#moves-panel details[data-k="tools"]').open = true;});
  const key = async (code, down) => {await page.locator('canvas').first().focus();await (down ? page.keyboard.down(code) : page.keyboard.up(code));};

  // ---------- Aba Moves ----------
  await L(() => document.querySelector('button[data-tool="moves"]').click());
  const openMove = id => L(id => {document.querySelector('#moves-showcase .mvs-card[data-move="' + id + '"] .mvs-open').click();}, id);
  await openMove('reflect');
  const nReflect = await page.locator('#editor-mechanics [data-path^="world.reflect."]').count();
  await openMove('psyshock');
  const nPsy = await page.locator('#editor-mechanics [data-path^="world.psyshock."]').count();
  check('a aba Moves (barra esquerda) é a vitrine (sem equipagem) e o Editor traz os sliders de Reflect e de Psyshock', await page.locator('#moves-showcase .mvs-card[data-move]').count() > 10 && nReflect > 15 && nPsy > 20 && await page.locator('#moves-panel [data-slot-move]').count() === 0, nReflect + ' / ' + nPsy);
  await tab('moves');   // gaveta de Ações › Moves: equipagem e botões
  await page.selectOption('#act-moves [data-slot-move="0.0"]', 'reflect');await page.selectOption('#act-moves [data-slot-move="0.1"]', 'psyshock');
  check('equipar na gaveta coloca o Move no slot do azul', await L(() => window.__lab.game.fighters[0].loadout.slice(0, 2).join()) === 'reflect,psyshock');
  await page.selectOption('#act-moves [data-slot-move="0.1"]', '');check('tirar um move do slot esvazia o slot', await L(() => window.__lab.game.fighters[0].loadout[1] ?? null) === null);
  await page.selectOption('#act-moves [data-slot-move="0.1"]', 'psyshock');await page.selectOption('#act-moves [data-slot-key="0.1"]', '13');check('o botão do slot é editável (entra nas teclas do jogador)', await L(() => window.__lab.C.extras.bindings.skill2) === 13);await page.selectOption('#act-moves [data-slot-key="0.1"]', '12');
  await openMove('reflect');
  check('a gaveta lista os 8 slots, a aba Moves os emissores e o Editor os parâmetros', await page.locator('#act-moves [data-slot-move]').count() === 8 && await L(() => document.querySelectorAll('#moves-panel [data-emit]').length) === 4 && await page.locator('#editor-mechanics [data-path]').count() >= 18);
  check('os parâmetros distinguem “aprovado” de “provisório”', await page.locator('#editor-mechanics small.ok').count() >= 8 && await page.locator('#editor-mechanics small.warn').count() >= 3);
  await page.screenshot({path: out + 'aba-moves.png'});
  const slider = page.locator('#editor-mechanics [data-path="world.reflect.thickness"]');await slider.evaluate(el => {el.value = '0.2';el.dispatchEvent(new Event('input', {bubbles: true}));el.dispatchEvent(new Event('change', {bubbles: true}));});
  check('um parâmetro muda o ajuste (vale para os próximos usos)', await L(() => window.__lab.C.world.reflect.thickness) === 0.2 && /0\.2/.test(await page.locator('#editor-mechanics [data-path="world.reflect.thickness"]').evaluate(el => el.closest('label').querySelector('output').textContent)));
  await openMove('reflect');
  await page.locator('#editor-mechanics [data-path="world.reflect.thickness"]').evaluate(el => el.closest('label').querySelector('button.mini').click());check('o botão ↺ restaura o padrão', await L(() => window.__lab.C.world.reflect.thickness) === 0.1);
  await leftMoves();await page.click('#mvp-run');await page.waitForSelector('#mvp-results details');
  const scen = await L(() => [...document.querySelectorAll('#mvp-results summary')].map(s => [s.textContent.trim(), s.classList.contains('ok')]));
  check('os 12 cenários técnicos passam (esperado × obtido)', scen.length === 12 && scen.every(s => s[1]), scen.filter(s => !s[1]).map(s => s[0]).join(' | '));
  await page.screenshot({path: out + 'cenarios.png'});
  const dl = page.waitForEvent('download');await page.click('#mvp-export');const file = await (await dl).path();check('exporta os cenários em JSON versionado', !!file);

  // ---------- Gaveta de Ações: Tackle, Esquiva e Bloqueio ----------
  await tab('moves');   // a gaveta de Ações fecha quando outra gaveta (Editor) abre: reabre aqui
  for (const [t, minControls] of [['tackle', 40], ['dodge', 40], ['block', 12]]) {
    await page.click(`[data-act="${t}"]`);
    check(`a aba ${t} da gaveta traz os sliders do sistema e os seletores de animação`, await page.locator(`#act-${t} .tune-control`).count() >= minControls && await page.locator(`#act-${t} details`).count() >= 3 && await L(t => document.querySelectorAll(`#act-${t} [data-anim], #act-${t} .act-card .hint`).length > 0, t));
  }
  await page.click('[data-act="tackle"]');
  check('o Tackle tem os controles da carga (toggle, tempo, dreno, PL2/PL3 e X no sprint)', await page.locator('#act-tackle [data-path="extras.toggles.enableChargeTackle"]').count() === 1 && await page.locator('#act-tackle [data-path^="rules.chargeTackle"]').count() >= 7 && await page.locator('#act-tackle [data-path="rules.sprintTacklePL"]').count() === 1);
  check('o Tackle tem wall-splat e meteor slam (toggles e sliders)', await page.locator('#act-tackle [data-path="extras.toggles.enableWallSplat"]').count() === 1 && await page.locator('#act-tackle [data-path="extras.toggles.enableMeteorSlam"]').count() === 1 && await page.locator('#act-tackle [data-path^="rules.wallSplat"]').count() === 3 && await page.locator('#act-tackle [data-path="rules.groundBounceForce"]').count() === 1 && await page.locator('#act-tackle [data-path="rules.slamAngle"]').count() === 1);
  check('o Tackle tem a finta (toggle, 5 sliders de parâmetros e 4 de efeitos amarelos)', await page.locator('#act-tackle [data-path="extras.toggles.enableTackleFeint"]').count() === 1 && await page.locator('#act-tackle [data-path^="rules.feint"]').count() === 9);
  check('os controles da IA saíram do Tackle e estão na aba IA (toggles de carga, finta e fuga e 3 sliders)', await page.locator('#act-tackle [data-path^="extras.ai.use"]').count() === 0 && await L(async () => {document.querySelector('#act-tabs [data-act="ai"]').click();await new Promise(r => setTimeout(r, 200));const q = s => document.querySelectorAll('#act-ai ' + s).length;return q('[data-path^="extras.ai.use"]') === 2 && q('[data-path="extras.ai.wallEscape"]') === 1 && q('[data-path="extras.ai.chargeChance"]') === 1;}));
  await page.click('[data-act="moves"]');
  // ---------- Tackle carregado no jogo real ----------
  await tab('match');await page.selectOption('#mode', 'inactive');await page.click('#start');await page.waitForTimeout(400);
  await page.click('#moves-close');await page.locator('canvas').first().focus();await key('KeyX', true);await page.waitForTimeout(700);
  const chg = await L(() => {const f = window.__lab.game.fighters[0];return {lvl: f.tackleCharge?.level, hud: document.getElementById('moves-hud').textContent};});
  check('segurar X carrega o tackle (PL2 em ~0,7 s) e o HUD mostra a barra de carga', chg.lvl === 2 && /Tackle[\s\S]*PL2/.test(chg.hud), JSON.stringify(chg).slice(0, 100));
  await key('KeyX', false);await page.waitForTimeout(150);
  check('soltar X dispara o tackle no PL alcançado', await L(() => window.__lab.game.fighters[0].action?.pl) === 2);
  await L(() => window.__lab.game.reset?.());
  // ---------- Equipar e jogar ----------
  check('equipar pela aba preenche os slots do jogador', JSON.stringify(await L(() => window.__lab.game.fighters[0].loadout)) === JSON.stringify(['reflect', 'psyshock', null, null]));
  await tab('match');await page.selectOption('#mode', 'inactive');await page.click('#start');await page.waitForTimeout(400);
  await tab('moves');await page.click('#panel-close').catch(() => {});await L(() => {document.getElementById('panel').hidden = true;});
  const hud0 = await page.textContent('#moves-hud');
  check('o HUD mostra os dois slots prontos com as teclas A e S', /A.*Reflect.*pronto/s.test(hud0) && /S.*Psyshock.*pronto/s.test(hud0), hud0.replace(/\s+/g, ' ').slice(0, 120));
  await key('KeyA', true);await page.waitForTimeout(900);
  const hud1 = await page.textContent('#moves-hud');
  check('durante a carga o HUD mostra % e PL', /carregando \d+% · PL1/.test(hud1), hud1.replace(/\s+/g, ' ').slice(0, 140));
  const prev = await L(() => window.__lab.view.worldView.preview.visible);check('a prévia da barreira aparece enquanto carrega o Reflect', prev === true);
  await page.screenshot({path: out + 'carregando-reflect.png'});
  await page.waitForTimeout(800);
  await key('KeyA', false);await page.waitForTimeout(350);
  const hud2 = await page.textContent('#moves-hud');
  check('depois de soltar: recuperação e recarga no HUD, barreira no mundo', /recarga|recuperação/.test(hud2) && await L(() => window.__lab.game.world.entities.some(e => e.reflect)), hud2.replace(/\s+/g, ' ').slice(0, 140));
  await page.screenshot({path: out + 'barreira.png'});
  await L(() => {window.__lab.game.fighters[0].moveRecovery = 0;});await leftMoves();await L(() => {document.querySelector('#moves-panel details[data-k="tools"]').open = true;});await page.click('[data-emit="1"]');await L(() => {document.getElementById('panel').hidden = true;});await page.waitForTimeout(450);
  check('o projétil hostil é refletido (evento e anel de impacto visível)', await L(() => window.__lab.game.events.some(e => e.result === 'reflected')) && await L(() => window.__lab.view.worldView.rings.length > 0));
  await page.screenshot({path: out + 'reflexao.png'});
  await leftMoves();await L(() => {document.querySelector('#moves-panel details[data-k="tools"]').open = true;});check('a gaveta tem os emissores de laser (PL1–PL3 e giratório) e os parâmetros do laser', await page.locator('#moves-panel [data-laser]').count() === 4 && await page.locator('#moves-panel [data-p^="beam."]').count() === 4);
  await page.click('[data-laser="2"]');await L(() => {document.getElementById('panel').hidden = true;});await page.waitForTimeout(400);
  const lz = await L(() => {const e = window.__lab.game.world.entities.find(x => x.kind === 'beam'), m = e && window.__lab.view.worldView.meshes.get(e.id);return e ? {segs: e.segments.length, pl: e.pl, shown: m ? m.children.filter(c => c.visible).length : 0} : null;});
  check('o laser técnico nasce no mundo e é desenhado (um paralelepípedo por segmento)', !!lz && lz.segs >= 1 && lz.pl === 2 && lz.shown === lz.segs, JSON.stringify(lz));
  await page.screenshot({path: out + 'laser.png'});
  await L(() => {const w = window.__lab.game.world;w.entities = w.entities.filter(x => x.kind !== 'beam');});
  await L(() => {const f = window.__lab.game.fighters[0];f.moveRecovery = 0;});
  await key('KeyS', true);await page.waitForTimeout(1700);
  const orbs = await L(() => window.__lab.view.worldView.orbs[0].filter(o => o.visible).length);check('as pedras se formam ao redor de quem carrega o Psyshock (3 + 1 a cada 0,8 s)', orbs >= 4, `${orbs} pedras`);
  await page.screenshot({path: out + 'carregando-psyshock.png'});
  await key('KeyS', false);await page.waitForTimeout(250);
  await page.screenshot({path: out + 'pedras.png'});
  await page.waitForTimeout(1500);
  check('as pedras acertam o adversário', await L(() => window.__lab.game.fighters[1].hp) < 100);
  // falha de espaço: aviso discreto
  await L(() => {const g = window.__lab.game;g.fighters[0].moveCooldowns = {};g.fighters[0].moveRecovery = 0;g.fighters[0].stamina = 3;g.fighters[0].regenBase = 3;g.fighters[0].position = {x: 0, z: 15.4};g.fighters[0].facing = 0;});
  await key('KeyA', true);await page.waitForTimeout(1900);await key('KeyA', false);await page.waitForTimeout(250);
  const toast = await page.textContent('#deny-toast');check('a falha de espaço avisa com o motivo e a devolução da stamina', /Reflect: sem espaço/.test(toast), toast);
  await page.screenshot({path: out + 'falha-espaco.png'});
  check('sem requisições de rede e sem erros no console', network.length === 0 && errors.length === 0, [...network, ...errors].join(' | '));
} finally {
  writeFileSync(out + 'report.json', JSON.stringify({date: new Date().toISOString(), failures, report}, null, 1));
  await browser.close();
}
console.log(`\n${report.length - failures} de ${report.length} verificações aprovadas.`);
if (failures) process.exit(1);
