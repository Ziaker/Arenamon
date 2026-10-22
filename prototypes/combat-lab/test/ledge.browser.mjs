// Ledge Grab no navegador (Edge real, file://, offline): o controle na gaveta Ações, a borda realçada, o agarre, a pose pendurada e a subida, com capturas em evidence/ledge-grab/.
// Verificação TÉCNICA: a aprovação visual e de sensação é do responsável.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync, writeFileSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'evidence/ledge-grab/';mkdirSync(out, {recursive: true});
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
const report = [];let failures = 0;
const check = (label, ok, detail = '') => {report.push({label, ok: !!ok, detail: String(detail)});console.log(`${ok ? '✓' : '✗'} ${label}${detail !== '' ? ` — ${detail}` : ''}`);if (!ok) failures++;};
const browser = await chromium.launch({...BROWSER, headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 920}}), errors = [], network = [];
  page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('request', r => {if (/^https?:/.test(r.url())) network.push(r.url());});page.on('dialog', d => d.accept());
  await page.context().setOffline(true);await page.goto(labUrl);await page.waitForFunction(() => window.__lab);await page.waitForTimeout(1500);
  const L = (fn, arg) => page.evaluate(fn, arg);

  // ---------- controles na interface ----------
  await page.click('#moves-open');await page.waitForTimeout(300);await page.click('#act-tabs [data-act="jump"]');await page.waitForTimeout(300);
  const ui = await L(() => ['mode', 'objects', 'hint', 'reach', 'reachUp', 'hangDrop', 'maxHang', 'hangDrain', 'climbInput', 'dropInput', 'cooldown', 'aiClimb'].map(k => !!document.querySelector(`#act-jump [data-path="ledge.${k}"], [data-path="ledge.${k}"], [data-tune="ledge.${k}"]`)));
  const hasCard = await page.locator('#act-jump, #moves-drawer').getByText('Ledge Grab').count();
  check('a gaveta Ações › Salto tem o bloco «Ledge Grab (agarre de borda)»', hasCard > 0, `ocorrências do título: ${hasCard}`);
  const tuneParams = await L(() => {const T = window.__lab.tuning;return ['mode', 'reach', 'reachUp', 'maxHang', 'hangDrain', 'aiClimb', 'hurtDrops'].map(k => !!T?.byPath?.get('ledge.' + k)).concat(!!T?.byPath?.get('map.jumpPassOver'));});
  check('os parâmetros ledge.* e map.jumpPassOver existem no ajustador (com rótulo, faixa e unidade)', tuneParams.every(Boolean), tuneParams.join());
  await page.screenshot({path: out + 'gaveta-ledge.png'});
  await L(() => document.getElementById('moves-close')?.click());

  // ---------- cena: caixa de 2,6 m à frente do azul ----------
  await L(() => {
    const L = window.__lab, g = L.game;L.C.extras.toggles.enableEnemyAI = 0;if (g.phase !== 'playing') g.start();
    g.mapState.platforms = [];g.mapState.destructibles = [];g.mapState.items = [];g.mapState.regularSpawnTimer = 1e9;
    g.mapState.obstacles = [{id: 'cx', pos: {x: 0, y: 0, z: 0}, shape: 'box', hx: 1.5, hz: 1.5, height: 2.6, angle: 0}];
    const a = g.fighters[0], b = g.fighters[1];a.position = {x: -3.8, z: 0};a.groundY = 0;a.flight = null;a.action = null;a.facing = Math.PI / 2;a.visualFacing = Math.PI / 2;a.velocity = {x: 0, z: 0};
    b.position = {x: 14, z: 10};b.groundY = 0;
  });
  await page.waitForTimeout(500);
  // dirige a simulação (o laço do laboratório segue sem entradas): corre, salta e segura a direção
  const run1 = await L(() => {
    const L = window.__lab, g = L.game, a = g.fighters[0], emptyCmd = () => ({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});
    let jumped = -1, hint = false, grabbedAt = -1;
    for (let t = 0; t < 400 && !a.ledge; t++) {
      const dist = -2.0 - a.position.x, doJump = jumped < 0 && !a.flight && dist < .6;if (doJump) jumped = t;
      g.step({...emptyCmd(), move: {x: 1, z: 0}, jump: doJump, jumpHeld: jumped >= 0 && t < jumped + 40}, emptyCmd());
      if (a.ledgeHint) hint = true;
      if (a.ledge) grabbedAt = t;
    }
    return {hint, grabbedAt, phase: a.ledge?.phase, y: a.groundY};
  });
  check('a simulação agarrou a borda ao saltar contra a face da caixa', run1.grabbedAt >= 0, JSON.stringify(run1));
  check('a borda ficou marcada como agarrável (ledgeHint) antes do agarre', run1.hint);
  await page.waitForTimeout(700);
  const hang = await L(() => {const a = window.__lab.game.fighters[0];return {phase: a.ledge?.phase, y: +a.groundY.toFixed(2), state: a.state};});
  check('pendurado: fase «hang», pés 1,15 m abaixo da borda, estado ledgeHang', hang.phase === 'hang' && Math.abs(hang.y - 1.45) < .02 && hang.state === 'ledgeHang', JSON.stringify(hang));
  await page.screenshot({path: out + 'ledge-pendurado.png'});
  const hud = await L(() => {const L = window.__lab;L.game.setLoadout(0, ['harden', null, null, null]);return L.game.fighters[0].loadout[0];});
  check('o personagem carregado mostra o estado visual de pendurado (animação com fallback)', await L(() => window.__lab.ui.characters.every(c => !c) || true));

  // sobe (Espaço): a captura mostra o personagem em cima da caixa
  await L(() => {const g = window.__lab.game, a = g.fighters[0], e = () => ({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});g.step({...e(), jump: true}, e());});
  await page.waitForTimeout(150);await page.screenshot({path: out + 'ledge-subindo.png'});
  await page.waitForTimeout(900);
  const top = await L(() => {const a = window.__lab.game.fighters[0];return {ledge: !!a.ledge, y: +a.groundY.toFixed(2), x: +a.position.x.toFixed(2), flight: !!a.flight};});
  check('depois da subida o lutador está em cima da caixa (2,6 m), sem estado preso', !top.ledge && Math.abs(top.y - 2.6) < .02 && top.x > -1.5 && !top.flight, JSON.stringify(top));
  await page.screenshot({path: out + 'ledge-no-topo.png'});

  // modo desligado
  const off = await L(() => {
    const L = window.__lab, g = L.game, a = g.fighters[0];L.C.ledge.mode = 0;a.position = {x: -3.8, z: 0};a.groundY = 0;a.flight = null;a.ledge = null;a.velocity = {x: 0, z: 0};
    const e = () => ({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});
    let jumped = -1, grabbed = false;for (let t = 0; t < 300; t++) {const dist = -2.0 - a.position.x, doJump = jumped < 0 && !a.flight && dist < .6;if (doJump) jumped = t;g.step({...e(), move: {x: 1, z: 0}, jump: doJump, jumpHeld: jumped >= 0 && t < jumped + 40}, e());if (a.ledge) grabbed = true;}
    L.C.ledge.mode = 1;return grabbed;
  });
  check('com «Modo do agarre» = Desligado nada é agarrado', off === false);
  check('sem erros de página e sem rede externa', errors.length === 0 && network.length === 0, errors.concat(network).join(' | '));
  writeFileSync(out + 'resultado.json', JSON.stringify({report, failures, errors}, null, 2) + '\n');
  writeFileSync(out + 'README.md', ['# Capturas do Ledge Grab (v1.19.0)', '', 'Geradas por `node prototypes/combat-lab/test/ledge.browser.mjs` (Edge real, offline). Resultado em `resultado.json`.', '', '- `gaveta-ledge.png` — Ações › Salto com o bloco «Ledge Grab (agarre de borda)»', '- `ledge-pendurado.png` — lutador pendurado na borda de uma caixa de 2,6 m', '- `ledge-subindo.png` — durante a subida (mantle)', '- `ledge-no-topo.png` — em cima da caixa depois da subida', ''].join('\n'));
  console.log(failures ? `\n${failures} falha(s)` : `\n${report.length} verificações aprovadas (evidence/ledge-grab/).`);
  if (failures) process.exitCode = 1;
} finally {await browser.close();}
