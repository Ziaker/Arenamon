// Cenas dirigidas no jogo real com o Wookada (azul, modelo pesado 1,85×) e o Cogumelo: golpe no vazio, borda (agarrar/subir/soltar), pés num degrau e olhar.
// A simulação é conduzida por game.step (comandos reais) e o quadro é desenhado pelo jogo compilado; capturas em evidence/game-feel-5-9/.
// Uso: node test/game-feel-cenas.browser.mjs [pasta]
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
const root = fileURLToPath(new URL('..', import.meta.url)), out = process.argv[2] || root + 'evidence/game-feel-5-9/';
mkdirSync(out, {recursive: true});
const browser = await chromium.launch({channel: process.env.ARENAMON_BROWSER || 'msedge', headless: true});
const R = {};
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 920}}), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  await page.goto(pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href + '?inicial=sim');
  await page.waitForFunction(() => window.__lab?.game && window.__lab.view, null, {timeout: 120000});
  await page.waitForFunction(() => {const c = window.__lab.ui?.characters;return !!(c?.[0]?.source?.assetId && c?.[1]?.source?.assetId);}, null, {timeout: 90000});
  await page.waitForTimeout(1500);
  const shot = n => page.screenshot({path: out + n + '.png'});
  // Câmera de lado e mais perto (a de combate fica atrás do Wookada e ele cobre o resto da cena).
  const side = async () => {await page.evaluate(() => {const r = window.__lab.view.rig;r.orbit(Math.PI / 2);r.zoomBy(-2.5);});await page.waitForTimeout(1300);};
  const scene = (fn, arg) => page.evaluate(fn, arg);
  // Base comum: sem IA, mapa limpo (o cenário põe o que precisa), os dois recursos novos ligados.
  await scene(() => {
    const L = window.__lab, g = L.game, T = L.C.extras.toggles, G = L.C.extras.gameFeel;
    T.enableEnemyAI = 0;T.enablePlayerAI = 0;T.enemyManual = 1;L.startMatch();
    Object.assign(G, {whiffOn: 1, footOn: 1, trackOn: 1, trackSmooth: .06});
    Object.assign(g.mapState, {platforms: [], obstacles: [], destructibles: [], items: [], regularSpawnTimer: 1e9});
    window.__cmd = () => ({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});
    window.__run = (n, a = {}, b = {}) => {for (let i = 0; i < n; i++) window.__lab.game.step({...window.__cmd(), ...a}, {...window.__cmd(), ...b});};
    window.__runDraw = async (n, a = {}, b = {}) => {for (let i = 0; i < n; i += 2) {window.__run(2, a, b);await new Promise(r => requestAnimationFrame(r));}};
  });

  // ===== 5 · GOLPE NO VAZIO =====
  await scene(() => {
    const g = window.__lab.game, a = g.fighters[0], b = g.fighters[1];
    a.position = {x: -4, z: 0};a.facing = Math.PI / 2;a.visualFacing = Math.PI / 2;a.groundY = 0;a.flight = null;a.action = null;a.stamina = 99;
    b.position = {x: 3, z: 12};b.groundY = 0;
  });
  await page.waitForTimeout(400);
  await side();
  R.whiff = await scene(async () => {
    const L = window.__lab, g = L.game, v = L.view, a = g.fighters[0];
    await window.__runDraw(2, {tackle: true, tackleHeld: false});
    const started = a.action?.kind;
    let frames = 0;
    while (a.action && frames++ < 400) await window.__runDraw(2);   // até o tackle terminar sozinho (com desenho a cada 2 passos)
    await window.__runDraw(6);
    return {started, ended: !a.action, state: a.state, stats: {...(v.whiffFx?.stats ?? {})}, active: v.whiffFx?.active, fx: v.whiffFx?.fx.length ?? 0};
  });
  await shot('whiff-wookada-1');
  await page.waitForTimeout(160);
  await shot('whiff-wookada-2');
  assert.ok(R.whiff.stats.whiffs >= 1, 'golpe no vazio detectado: ' + JSON.stringify(R.whiff));
  // contraprova: golpe que ACERTA não gera whiff
  R.hit = await scene(async () => {
    const L = window.__lab, g = L.game, v = L.view, a = g.fighters[0], b = g.fighters[1], before = v.whiffFx.stats.whiffs;
    a.position = {x: -1.4, z: 0};a.facing = Math.PI / 2;a.visualFacing = Math.PI / 2;b.position = {x: 0, z: 0};b.groundY = 0;b.hp = 100;a.stamina = 99;a.action = null;
    await window.__runDraw(2, {tackle: true});let n = 0;while (a.action && n++ < 400) await window.__runDraw(2);await window.__runDraw(10);
    return {whiffsBefore: before, whiffsAfter: v.whiffFx.stats.whiffs, bHp: b.hp};
  });
  assert.equal(R.hit.whiffsAfter, R.hit.whiffsBefore, 'golpe que acerta não é whiff: ' + JSON.stringify(R.hit));

  // ===== 7 · BORDA (Wookada pesado) =====
  await scene(() => {
    const L = window.__lab, g = L.game;
    g.mapState.obstacles = [{id: 'cx', pos: {x: 0, y: 0, z: 0}, shape: 'box', hx: 1.5, hz: 1.5, height: 2.6, angle: 0}];
    const a = g.fighters[0], b = g.fighters[1];
    a.position = {x: -3.8, z: 0};a.groundY = 0;a.flight = null;a.action = null;a.ledge = null;a.facing = Math.PI / 2;a.visualFacing = Math.PI / 2;a.velocity = {x: 0, z: 0};a.stamina = 99;a.hp = 100;
    b.position = {x: 14, z: 10};b.groundY = 0;
  });
  await page.waitForTimeout(500);
  R.ledge = await scene(() => {
    const g = window.__lab.game, a = g.fighters[0], out = {phases: []};
    let jumped = -1;
    for (let t = 0; t < 400 && !a.ledge; t++) {
      const dist = -2.0 - a.position.x, doJump = jumped < 0 && !a.flight && dist < .6;if (doJump) jumped = t;
      window.__run(1, {move: {x: 1, z: 0}, jump: doJump, jumpHeld: jumped >= 0 && t < jumped + 40});
    }
    out.grabbed = !!a.ledge;return out;
  });
  await scene(() => window.__runDraw(80));   // quadros de verdade: encaixe termina e a pose de pendurado assenta
  await page.waitForTimeout(300);
  R.ledgeHang = await scene(() => {const a = window.__lab.game.fighters[0], c = window.__lab.ui.characters[0];return {phase: a.ledge?.phase, key: c.current?.key, id: c.current?.id, clip: c.clips[c.current?.index]?.name};});
  await side();
  await shot('borda-wookada-pendurado');
  // sobe e captura no meio da subida e no topo
  await scene(() => window.__run(1, {jump: true}));
  await page.waitForTimeout(40);
  R.ledgeClimb = await scene(() => {const a = window.__lab.game.fighters[0], c = window.__lab.ui.characters[0];return {phase: a.ledge?.phase, key: c.current?.key, id: c.current?.id};});
  await scene(() => window.__run(30));
  await page.waitForTimeout(120);
  await shot('borda-wookada-subindo');
  await scene(() => window.__run(200));
  await page.waitForTimeout(400);
  R.ledgeTop = await scene(() => {const a = window.__lab.game.fighters[0];return {ledge: !!a.ledge, y: a.groundY, state: a.state};});
  await shot('borda-wookada-topo');
  assert.ok(R.ledge.grabbed, 'o Wookada agarrou a borda');
  assert.equal(R.ledgeHang.phase, 'hang');

  // ===== 8 · PÉS NUM DEGRAU =====
  await scene(() => {
    const g = window.__lab.game, a = g.fighters[0];
    g.mapState.obstacles = [];g.mapState.platforms = [{id: 'p1', pos: {x: 3.0, z: 0}, width: 6, depth: 6, height: .15}];
    a.facing = 0;a.visualFacing = 0;a.position = {x: -0.05, z: 0};a.groundY = 0;a.flight = null;a.ledge = null;a.action = null;a.velocity = {x: 0, z: 0};
  });
  await page.waitForTimeout(900);
  R.feet = await scene(() => {const c = window.__lab.ui.characters[0], rl = c.rigLayers;return {fw: rl?.fw, pelvis: rl?.pelvis, lw: [rl?.legs.l?.s, rl?.legs.r?.s], ankle: rl?.restFootH};});
  await side();
  await shot('pes-wookada-degrau');

  // ===== 9 · OLHAR (Move com alvo travado) =====
  await scene(() => {
    const g = window.__lab.game, a = g.fighters[0], b = g.fighters[1];
    g.mapState.platforms = [];a.position = {x: -3, z: 0};a.groundY = 0;a.facing = 0.0;a.visualFacing = 0.0;a.action = null;a.velocity = {x: 0, z: 0};
    b.position = {x: 0.5, z: 6};b.groundY = 0;b.hp = 100;
    const hold = () => {if (!a.action) a.action = {kind: 'move', move: 'swift', slot: 0, elapsed: 0, startAngle: 0, heading: 0, offensive: false, hits: new Set(), fired: [], from: {x: 0, z: 0}, lock: b.id};};
    window.__hold = setInterval(hold, 1);
  });
  await page.waitForTimeout(700);
  R.track = await scene(() => {const rl = window.__lab.ui.characters[0].rigLayers;const f = window.__lab.game.fighters[0], b = window.__lab.game.fighters[1], T = window.__lab.view.constructor;return {dbg: {wall: !!f.wallSplat, foe: {hp: b.hp, absent: b.absent, id: b.id, pos: b.position}, me: f.position, fac: f.visualFacing, ex: window.__lab.ui.characters[0].extraYaw}, tw: rl?.tw, yaw: rl?.ty, pitch: rl?.tp, phase: window.__lab.game.phase, state: f.state, hp: f.hp, flight: !!f.flight, ledge: !!f.ledge, action: f.action?.kind, lock: f.action?.lock, track: !!window.__lab.C.extras.gameFeel.trackOn, ok: rl?.trackOk, issues: rl?.issues};});
  await side();
  await shot('olhar-wookada');
  // perfis de olhar por Move: «só cabeça» × «cabeça + membro de mira» (a mão do braço direito se afasta da pose base só no segundo)
  const hand = async mode => scene(m => {const L = window.__lab, c = L.ui.characters[0], f = L.game.fighters[0];c.trackProfile.swift = m;
    for (let i = 0; i < 3; i++) c.update(f, 0, f.groundY ?? 0, [], {tick: 9000, fighters: L.game.fighters});   // dt = 0: o mesmo instante da animação, só muda o perfil
    const h = c.rigLayers?.arm?.hand;if (!h) return null;c.root.updateMatrixWorld(true);const p = h.getWorldPosition(h.position.clone()), r = c.root.position;return [p.x - r.x, p.y - r.y, p.z - r.z];}, mode);
  const handHead = await hand('head'), handAim = await hand('aim'), handOff = null;
  await scene(() => {window.__lab.ui.characters[0].trackProfile.swift = 'off';});await page.waitForTimeout(900);   // «desligado»: o olhar solta em tempo real
  R.aim = {head: handHead, aim: handAim, off: handOff, hd: handHead && handOff ? Math.hypot(...handHead.map((v, i) => v - handOff[i])) : null, moved: handHead && handAim ? Math.hypot(...handHead.map((v, i) => v - handAim[i])) : null, twOff: await scene(() => window.__lab.ui.characters[0].rigLayers.tw)};
  await scene(() => clearInterval(window.__hold));
  // ===== 6 · FASES DA ANIMAÇÃO (ponta a ponta no jogo real: edição na timeline → contrato → hit do combate) =====
  const firstHit = () => scene(async () => {
    const L = window.__lab;
    if (L.game.phase !== 'playing') {L.startMatch();L.syncCharacterCombatWindows();window.__run(1);}   // a partida pode ter acabado (o golpe da cena do olhar derrubou o rival)
    const g = L.game, a = g.fighters[0], b = g.fighters[1];
    g.mapState.platforms = [];g.mapState.obstacles = [];a.ledge = null;a.flight = null;a.action = null;a.groundY = 0;a.position = {x: -3, z: 0};a.facing = Math.PI / 2;a.visualFacing = Math.PI / 2;a.stamina = 99;a.velocity = {x: 0, z: 0};a.state = 'neutral';a.stun = 0;a.knockRecovery = 0;a.actionRecovery = 0;a.moveRecovery = 0;a.exhaustRecovery = 0;a.landingRecovery = 0;a.hitstun = 0;a.stagger = 0;a.counterStagger = 0;a.recoveryFrom = null;a.charge = null;a.aim = null;a.guard = false;a.exhausted = false;a.moveCooldowns = {};
    b.position = {x: -1.2, z: 0};b.groundY = 0;b.hp = 100;b.flight = null;b.action = null;b.state = 'neutral';b.stun = 0;b.knockRecovery = 0;b.velocity = {x: 0, z: 0};
    window.__run(2);window.__run(1, {tackle: true});
    const info = {started: a.action?.kind, applied: a.action?.combatWindows?.phaseContract?.applied ?? null, windows: a.action?.combatWindows?.activeWindows ?? null, hitAt: null};
    for (let i = 0; i < 400 && a.action; i++) {window.__run(1);if (a.action?.hits?.size && info.hitAt === null) info.hitAt = +a.action.elapsed.toFixed(3);}
    if (info.hitAt === null && b.hp < 100) info.hitAt = 'depois';
    return info;
  });
  await scene(() => {const G = window.__lab.C.extras.gameFeel;Object.assign(G, {phaseMode: 0, phaseActive: 0, phaseCancel: 0, phaseInvuln: 0});window.__lab.syncCharacterCombatWindows();});
  R.phaseBase = await firstHit();
  await scene(() => {
    const L = window.__lab, G = L.C.extras.gameFeel, ch = L.ui.characters[0];
    ch.animProfile.entries.tackle = {...(ch.animProfile.entries.tackle ?? {}), activeStart: 55, activeEnd: 90};   // editado como no editor de animações (% do clipe)
    Object.assign(G, {phaseMode: 1, phaseActive: 1});L.syncCharacterCombatWindows();
  });
  R.phaseApproved = await firstHit();
  R.phaseReport = await scene(() => {const G = window.__lab.C.extras.gameFeel;G.phaseMode = 0;window.__lab.syncCharacterCombatWindows();return {modeBack: G.phaseMode};});
  R.phaseBack = await firstHit();
  await scene(() => {const ch = window.__lab.ui.characters[0];delete ch.animProfile.entries.tackle;window.__lab.syncCharacterCombatWindows();});

  // ===== POUSO DO SALTO NORMAL (recuperação de 0,25 s): jogo real, Wookada =====
  R.landing = await scene(async () => {
    const L = window.__lab, g = L.game, a = g.fighters[0], C = L.C;
    if (g.phase !== 'playing') {L.startMatch();L.syncCharacterCombatWindows();window.__run(1);}
    g.mapState.platforms = [];g.mapState.obstacles = [];a.ledge = null;a.flight = null;a.action = null;a.charge = null;a.aim = null;a.groundY = 0;a.position = {x: 0, z: 0};a.state = 'neutral';a.stun = 0;a.knockRecovery = 0;a.landingRecovery = 0;a.actionRecovery = 0;a.velocity = {x: 0, z: 0};a.jumpBuffered = 0;
    g.fighters[1].position = {x: 9, z: 9};
    const out = {recoveryCfg: C.map.jumpLandingRecovery};
    window.__run(2);window.__run(1, {jump: true, jumpHeld: true});
    let n = 0;while (!a.flight && n++ < 60) window.__run(1, {jumpHeld: true});
    n = 0;while (a.flight && n++ < 600) await window.__runDraw(2);
    out.landedState = a.state;out.recovery = +(a.landingRecovery ?? 0).toFixed(3);out.visualKey = L.ui.characters[0].stateKey(a);
    // durante a recuperação o tackle é negado; depois dela sai
    window.__run(1, {tackle: true});out.tackleDuring = a.action?.kind ?? null;
    let t = 0;while ((a.landingRecovery ?? 0) > 0 && t++ < 400) await window.__runDraw(2);
    out.ticksLocked = t;window.__run(2);window.__run(1, {tackle: true});out.tackleAfter = a.action?.kind ?? null;
    return out;
  });
  console.log(JSON.stringify(R, null, 1));
  writeFileSync(out + 'resultado.json', JSON.stringify(R, null, 2));
  assert.deepEqual(errors, [], 'sem erros de página');
  assert.ok(R.phaseApproved.applied?.active, 'contrato aplicado no jogo real: ' + JSON.stringify(R.phaseApproved));
  assert.ok(typeof R.phaseBase.hitAt === 'number' && R.phaseApproved.hitAt !== null, 'houve acerto nos dois modos: ' + JSON.stringify([R.phaseBase, R.phaseApproved]));
  const tAct = 0.55 * R.phaseApproved.windows?.[0]?.[0] / 55 * 0 + R.phaseApproved.windows[0][0] * 0.008333333333333333;
  assert.ok(R.phaseApproved.hitAt === 'depois' || R.phaseApproved.hitAt >= tAct - 0.02, `com a fase aprovada o acerto não vem antes da janela ativa (${tAct.toFixed(3)} s): ${R.phaseApproved.hitAt}`);
  assert.ok(R.phaseBack.applied == null || !R.phaseBack.applied.active, 'voltando ao modo Definição o contrato some: ' + JSON.stringify(R.phaseBack));
  assert.ok(R.aim.moved == null || R.aim.moved > 0.02, 'o membro de mira move a mão (ou o rig não tem braço): ' + JSON.stringify(R.aim));
  assert.ok(R.aim.twOff < .08, 'perfil «desligado» solta o olhar: ' + R.aim.twOff);
  assert.ok(R.landing.recovery > .2 && R.landing.landedState === 'landing', 'pouso normal entra em recuperação: ' + JSON.stringify(R.landing));
  assert.equal(R.landing.tackleDuring, null, 'sem ações durante a recuperação do pouso');
  assert.equal(R.landing.tackleAfter, 'tackle', 'depois da recuperação a ação sai: ' + JSON.stringify(R.landing));
  assert.ok(R.track.tw > .5, 'olhar ativo no Wookada: ' + JSON.stringify(R.track));
  assert.ok(Math.abs(R.track.yaw) <= Math.PI, 'yaw finito');
  assert.deepEqual(errors, [], 'sem erros de página');
  console.log('game-feel-cenas browser: ok');
} finally {
  await browser.close();
}
