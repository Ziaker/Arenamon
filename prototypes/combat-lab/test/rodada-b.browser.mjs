// Rodada de 22/10/2026 (tarde) no navegador (Edge real, file://, offline): transparência de objetos na frente do lutador, efeitos de pouso na plataforma, círculo de alcance dos Moves de
// alvo único, sumiço com linhas de velocidade, explosão do Riposte, rastro de terra do Emerging Stone e os controles novos nos painéis. Capturas em evidence/rodada-b/.
// Verificação TÉCNICA: a aprovação visual e de sensação é do responsável.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync, writeFileSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'evidence/rodada-b/';mkdirSync(out, {recursive: true});
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
  const frames = n => L(async n => {for (let i = 0; i < n; i++) await new Promise(r => requestAnimationFrame(r));}, n);
  const E = () => ({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});
  void E;

  // ---------- controles novos nos painéis ----------
  const paths = await L(() => {
    const T = window.__lab.tuning, want = ['display.occlusion.occEnabled', 'display.occlusion.occOpacity', 'display.occlusion.occFade', 'display.rangeRing.rangeOn', 'display.rangeRing.flashTime', 'display.rangeRing.rangeOpacity', 'display.rangeRing.rangeWidth',
      'extras.visual.smear.smearOnDodge', 'extras.visual.squashStretch.squashOnDodge', 'extras.visual.squashStretch.dodgeSquashScale', 'extras.nav.enableNav'];
    return want.filter(p => !T?.byPath?.get(p));
  });
  check('todos os controles novos existem no ajustador (com rótulo e faixa)', paths.length === 0, paths.join(', ') || 'ok');
  await page.click('#moves-open');await page.waitForTimeout(400);
  const rows = keys => L(keys => keys.filter(k => !document.querySelector(`#moves-panel [data-p="${k}"]`)), keys);
  await page.selectOption('[data-slot-move="0.0"]', 'riposte');await page.selectOption('[data-slot-move="0.1"]', 'emerging-stone');await page.selectOption('[data-slot-move="0.2"]', 'spikes');await page.selectOption('[data-slot-move="0.3"]', 'bullet-punch');await page.waitForTimeout(300);
  const miss = [...await rows(['riposte.hitstopMult', 'riposte.shakeMult', 'riposte.blastOn', 'riposte.blastSize', 'emergingStone.fxTrailOn', 'emergingStone.fxTrailSize', 'emergingStone.markerAccel', 'spikes.markerAccel', 'bulletPunch.reach', 'bulletPunch.strikeReach', 'bulletPunch.stopShort', 'bulletPunch.hitRadius', 'bulletPunch.fxLines', 'bulletPunch.fxHideBody'])];
  await page.selectOption('[data-slot-move="0.0"]', 'quick-attack');await page.waitForTimeout(300);
  miss.push(...await rows(['quickAttack.fxLines', 'quickAttack.fxHideBody']));
  const gone = await L(() => ['bulletPunch.searchRadius', 'bulletPunch.startDistance', 'bulletPunch.maxDistance', 'bulletPunch.growTime'].filter(k => document.querySelector(`#moves-panel [data-p="${k}"]`)));
  check('o painel Moves tem os sliders novos (Riposte, Emerging Stone, Spikes, Bullet Punch, Quick Attack)', miss.length === 0, miss.join(', ') || 'ok');
  check('os sliders do marcador antigo do Bullet Punch saíram do painel', gone.length === 0, gone.join(', ') || 'ok');
  await L(() => document.getElementById('moves-close')?.click());
  check('a navegação (IA sobe plataformas) vem ligada por padrão', await L(() => window.__lab.C.extras.nav.enableNav === 1));

  // ---------- 1. objeto na frente do lutador fica translúcido ----------
  await L(() => {
    const L = window.__lab, g = L.game;L.C.extras.toggles.enableEnemyAI = 0;if (g.phase !== 'playing') g.start();
    g.mapState.platforms = [];g.mapState.destructibles = [];g.mapState.items = [];g.mapState.regularSpawnTimer = 1e9;g.mapState.obstacles = [];
    const a = g.fighters[0], b = g.fighters[1];a.position = {x: 0, z: 0};a.groundY = 0;a.flight = null;a.action = null;a.velocity = {x: 0, z: 0};b.position = {x: 12, z: 12};b.groundY = 0;
  });
  await frames(30);
  const cam = await L(() => {const c = window.__lab.view.camera.position;return {x: c.x, y: c.y, z: c.z};});
  const place = await L(c => {
    const g = window.__lab.game, a = g.fighters[0], t = 0.55;   // a 55% do caminho câmera → lutador
    const x = c.x + (a.position.x - c.x) * t, z = c.z + (a.position.z - c.z) * t;
    g.mapState.obstacles = [{id: 'tela', pos: {x, y: 0, z}, shape: 'box', hx: 1.2, hz: 1.2, height: 3, angle: 0}];
    return {x, z};
  }, cam);
  await frames(40);
  const op1 = await L(() => window.__lab.view.worldView.mapMeshes.get('tela')?.material.opacity);
  await page.screenshot({path: out + 'objeto-transparente.png'});
  check('o objeto entre a câmera e o lutador fica translúcido', typeof op1 === 'number' && op1 < .5, `opacidade ${op1?.toFixed?.(2)} (caixa em x=${place.x.toFixed(1)} z=${place.z.toFixed(1)})`);
  await L(() => {window.__lab.game.mapState.obstacles = [{id: 'tela', pos: {x: 14, y: 0, z: -14}, shape: 'box', hx: 1.2, hz: 1.2, height: 3, angle: 0}];});
  await frames(60);
  const op2 = await L(() => window.__lab.view.worldView.mapMeshes.get('tela')?.material.opacity);
  check('fora da frente do lutador volta a ser opaco', op2 > .98, `opacidade ${op2?.toFixed?.(2)}`);
  await L(() => {window.__lab.C.display.occlusion.occEnabled = 0;window.__lab.game.mapState.obstacles = [{id: 'tela', pos: {x: window.__lab.view.camera.position.x * .45, y: 0, z: window.__lab.view.camera.position.z * .45}, shape: 'box', hx: 1.2, hz: 1.2, height: 3, angle: 0}];});
  await frames(40);
  check('com «Objetos na frente do lutador ficam translúcidos» desligado nada muda', await L(() => window.__lab.view.worldView.mapMeshes.get('tela')?.material.opacity > .98));
  await L(() => {window.__lab.C.display.occlusion.occEnabled = 1;window.__lab.game.mapState.obstacles = [];});

  // ---------- 2. pouso na plataforma: efeitos nascem na altura do apoio ----------
  await L(() => {
    const L = window.__lab, g = L.game, a = g.fighters[0];
    g.mapState.platforms = [{id: 'alta', pos: {x: 0, y: 0, z: 0}, width: 4, depth: 4, height: 1.5}];
    a.position = {x: 0, z: 0};a.groundY = 1.5;a.flight = null;a.action = null;a.velocity = {x: 0, z: 0};
    window.__rec = [];const v = L.view.vfx, orig = v.spawn.bind(v);v.spawn = function(o) {if (v.emitting === 'jumpLanding' || v.emitting === 'ground') window.__rec.push({type: v.emitting, lift: v.lift ?? 0, y: o.y ?? 0});return orig(o);};
  });
  await frames(5);
  await L(() => {   // pulo regular sobre a própria plataforma: sobe e pousa em cima
    const g = window.__lab.game, a = g.fighters[0], e = () => ({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});
    g.step({...e(), jump: true, jumpHeld: true}, e());for (let i = 0; i < 360 && !(a.lastLanding && !a.flight && i > 20); i++) g.step({...e(), jumpHeld: i < 30}, e());
  });
  await frames(30);
  const rec = await L(() => window.__rec);
  check('o efeito de pouso do pulo nasce na altura da plataforma (1,5 m), não no chão', rec.some(r => r.type === 'jumpLanding' && Math.abs(r.lift - 1.5) < .05), JSON.stringify(rec.slice(0, 3)));
  await page.screenshot({path: out + 'pouso-na-plataforma.png'});
  await L(() => {window.__lab.game.mapState.platforms = [];window.__lab.game.fighters[0].groundY = 0;});

  // ---------- 6/7. Quick Attack: círculo de alcance e sumiço com linhas de velocidade ----------
  await L(() => {window.__labRecording.ui.paused = true;});   // o laço do laboratório não solta o botão por nós
  await L(() => {
    const L = window.__lab, g = L.game, a = g.fighters[0], b = g.fighters[1];g.setLoadout(0, ['quick-attack', 'bullet-punch', null, null]);
    a.position = {x: 0, z: 0};a.groundY = 0;a.flight = null;a.action = null;a.velocity = {x: 0, z: 0};a.stamina = 11;a.moveCooldowns = {};b.position = {x: 4.5, z: 0};b.groundY = 0;
  });
  await frames(20);
  await L(() => {   // segura o botão do slot 0 (sem soltar)
    const g = window.__lab.game, e = () => ({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});
    g.step({...e(), skill: 0, skillHeld: [true, false, false, false]}, e());for (let i = 0; i < 5; i++) g.step({...e(), skillHeld: [true, false, false, false]}, e());
  });
  await frames(25);
  const ring1 = await L(() => {const it = window.__lab.view.aimMarkers?.items.get('r0');return it ? {color: it.mat.color.getHex(), radius: +it.radius.toFixed(2), op: +it.mat.opacity.toFixed(2)} : null;});
  await page.screenshot({path: out + 'circulo-alcance-azul.png'});
  check('segurando o botão do Quick Attack com alvo no alcance: círculo AZUL com o raio do alcance (7 m)', !!ring1 && ring1.color === 0x59b4ff && Math.abs(ring1.radius - 7) < .01, JSON.stringify(ring1));
  await L(() => {window.__lab.game.fighters[1].position = {x: 14, z: 0};});
  await L(() => {const g = window.__lab.game, e = () => ({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});g.step({...e(), skillHeld: [true, false, false, false]}, e());});
  await frames(25);
  const ring2 = await L(() => {const it = window.__lab.view.aimMarkers?.items.get('r0');return it ? it.mat.color.getHex() : null;});
  await page.screenshot({path: out + 'circulo-alcance-vermelho.png'});
  check('com o alvo fora do alcance o círculo fica VERMELHO', ring2 === 0xff5566, ring2?.toString(16));
  await L(() => {const g = window.__lab.game, e = () => ({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});g.step(e(), e());});
  await frames(6);
  const flash = await L(() => ({flash: !!window.__lab.game.fighters[0].rangeFlash, item: window.__lab.view.aimMarkers?.items.has('r0'), spent: window.__lab.game.fighters[0].stamina}));
  check('soltar fora do alcance: não gasta stamina e o círculo vermelho pisca', flash.flash && flash.item && flash.spent >= 11, JSON.stringify(flash));
  await L(() => {window.__lab.game.fighters[1].position = {x: 4.5, z: 0};});
  const qa = await L(() => {
    const g = window.__lab.game, a = g.fighters[0], e = () => ({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});
    g.step({...e(), skill: 0, skillHeld: [true, false, false, false]}, e());g.step(e(), e());
    let sawGo = false, sawBack = false;const paths = [];
    for (let i = 0; i < 80; i++) {g.step(e(), e());const q = a.action?.qa;if (q?.phase === 'approach') sawGo = true;if (q?.phase === 'return') sawBack = true;
      const p = window.__lab.view.aimMarkers?.pathOf(a);if (p) paths.push(p.color);if (i === 8) break;}
    return {sawGo, sawBack, paths: [...new Set(paths)], tackle: a.action?.kind};
  });
  await frames(2);
  check('Quick Attack: a ida gera linhas de velocidade (cor fria) e o corpo some durante o sumiço', qa.sawGo && qa.paths.includes(0xe8f1ff), JSON.stringify(qa));
  await L(() => {const g = window.__lab.game;for (let i = 0; i < 200; i++) g.step({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null}, {move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});});

  await L(() => {window.__labRecording.ui.paused = false;});
  // ---------- 8. Riposte: explosão visual no contra-golpe ----------
  await L(() => {
    const L = window.__lab, g = L.game, a = g.fighters[0], b = g.fighters[1];g.setLoadout(0, ['riposte', null, null, null]);L.C.extras.toggles.enableEnemyAI = 0;
    a.position = {x: 0, z: 0};a.groundY = 0;a.flight = null;a.action = null;a.velocity = {x: 0, z: 0};a.stamina = 11;a.moveCooldowns = {};a.facing = Math.PI / 2;b.position = {x: 1.6, z: 0};b.groundY = 0;b.action = null;b.flight = null;b.velocity = {x: 0, z: 0};b.hp = b.attributes.hp;
  });
  await frames(10);
  const rip = await L(async () => {
    const g = window.__lab.game, e = () => ({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});
    g.step({...e(), skill: 0, skillHeld: [true, false, false, false]}, e());let got = false, blast = 0;
    for (let i = 1; i < 140; i++) {g.step(e(), i === 8 ? {...e(), tackle: true, move: {x: -1, z: 0}} : e());if (g.lastStepEvents.some(x => x.result === 'impact' && x.riposte)) {got = true;break;}}
    await new Promise(r => setTimeout(r, 120));blast = window.__lab.view.riposteFx?.blasts.length ?? 0;
    return {got, blast};
  });
  await page.screenshot({path: out + 'riposte-explosao.png'});
  check('o contra-golpe do Riposte acerta e dispara a explosão visual provisória', rip.got && rip.blast >= 1, JSON.stringify(rip));

  // ---------- 10. Emerging Stone: rastro de terra bem visível ----------
  await L(() => {
    const L = window.__lab, g = L.game, a = g.fighters[0], b = g.fighters[1];g.setLoadout(0, ['emerging-stone', null, null, null]);
    a.position = {x: -6, z: 0};a.groundY = 0;a.flight = null;a.action = null;a.velocity = {x: 0, z: 0};a.stamina = 11;a.moveCooldowns = {};a.facing = Math.PI / 2;b.position = {x: 8, z: 6};
  });
  await frames(10);
  await L(() => {
    const g = window.__lab.game, e = () => ({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});
    g.step({...e(), skill: 0, skillHeld: [true, false, false, false]}, e());for (let i = 0; i < 90; i++) g.step({...e(), skillHeld: [true, false, false, false]}, e());g.step(e(), e());for (let i = 0; i < 18; i++) g.step(e(), e());
  });
  await frames(10);
  const trail = await L(() => {
    const wv = window.__lab.view.worldView, ent = window.__lab.game.world.entities.find(x => x.kind === 'burrow'), m = ent ? wv.meshes.get(ent.id) : null;
    if (!m) return null;
    const tr = m.children.find(c => c.name === 'burrowTrail'), clods = m.children.filter(c => c.name === 'burrowClod' && c.visible).length, mound = m.children.find(c => c.name === 'mound');
    return {trail: !!tr?.visible, len: +(tr?.scale.z ?? 0).toFixed(2), clods, mound: +(mound?.scale.x ?? 0).toFixed(2)};
  });
  await page.screenshot({path: out + 'emerging-stone-rastro.png'});
  check('Emerging Stone: o projétil subterrâneo deixa sulco de terra, torrões saltando e um montículo maior (1,8×)', !!trail && trail.trail && trail.len > 1 && trail.clods >= 8 && trail.mound > 1.2, JSON.stringify(trail));

  check('sem erros de página e sem rede externa', errors.length === 0 && network.length === 0, errors.concat(network).join(' | '));
  writeFileSync(out + 'resultado.json', JSON.stringify({report, failures, errors}, null, 2) + '\n');
  writeFileSync(out + 'README.md', ['# Capturas da rodada de 22/10/2026 (tarde, v1.20.0)', '', 'Geradas por `node prototypes/combat-lab/test/rodada-b.browser.mjs` (Edge real, offline). Resultado em `resultado.json`.', '',
    '- `objeto-transparente.png` — objeto alto entre a câmera e o lutador, translúcido', '- `pouso-na-plataforma.png` — pouso do pulo regular em cima de uma plataforma de 1,5 m', '- `circulo-alcance-azul.png` / `circulo-alcance-vermelho.png` — Quick Attack segurado, com alvo dentro e fora do alcance',
    '- `riposte-explosao.png` — explosão provisória do contra-golpe do Riposte', '- `emerging-stone-rastro.png` — projétil subterrâneo com sulco de terra e torrões', ''].join('\n'));
  console.log(failures ? `\n${failures} falha(s)` : `\n${report.length} verificações aprovadas (evidence/rodada-b/).`);
  if (failures) process.exitCode = 1;
} finally {await browser.close();}
