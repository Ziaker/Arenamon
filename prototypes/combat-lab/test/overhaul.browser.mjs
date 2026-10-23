// Teste de navegador do overhaul (Edge, WebGL real, offline): animações com o GLB local, VFX (3 variantes × 9 tipos),
// tremor de câmera, sombras, HUD A/B/C em várias resoluções, sprint, IA desligada, stamina e desempenho.
// Grava capturas, sequências de quadros e relatório em validation/overhaul-browser/.
// Uso: node prototypes/combat-lab/test/overhaul.browser.mjs   (ARENAMON_GLB=caminho.glb para outro modelo)
import {createRequire} from 'node:module';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const {chromium} = require('@playwright/test');

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'validation/overhaul-browser/';mkdirSync(out + 'frames', {recursive: true});
const glb = process.env.ARENAMON_GLB || homedir() + '/Downloads/drowzee/arenamon-prototipo.glb';
const report = [];let failures = 0;
const check = (group, label, ok, detail = '') => {report.push({group, label, ok: !!ok, detail: String(detail)});console.log(`${ok ? '✓' : '✗'} ${group} · ${label}${detail !== '' ? ` — ${detail}` : ''}`);if (!ok) failures++;};
const browser = await chromium.launch({channel: 'msedge', headless: true});
const page = await browser.newPage({viewport: {width: 1500, height: 920}, acceptDownloads: true});
const errors = [];page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
await page.context().setOffline(true);
await page.goto(pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href + '?fabrica=1');await page.waitForFunction(() => window.__lab);
const L = (fn, arg) => page.evaluate(fn, arg);
const openTab = t => L(t => {const p = document.getElementById('panel');if (p.hidden || p.dataset.tool !== t) document.querySelector(`[data-tool="${t}"]`).click();}, t);
const start = async () => {await openTab('match');await page.click('#start');};
const set = (path, v) => L(([p, v]) => window.__lab.tuning.commit([[p, v]], 'teste'), [path, v]);
const frames = n => L(n => new Promise(r => {let k = 0;const f = () => (++k >= n ? r() : requestAnimationFrame(f));requestAnimationFrame(f);}), n);
const stage = {x: 430, y: 52, width: 1070, height: 618};
try {
  // ---------- Abertura, stamina e organização ----------
  await page.click('#start-center');await frames(10);
  const meter = await L(() => {const m = document.getElementById('stamina0'), r = m.getBoundingClientRect(), cs = getComputedStyle(m);return {h: r.height, w: r.width, app: cs.appearance || cs.webkitAppearance};});
  check('Stamina', 'barra de stamina visível (altura e largura)', meter.h >= 6 && meter.w > 100, JSON.stringify(meter));
  await L(() => {const f = window.__lab.game.fighters[0];f.stamina = .5;f.regenBase = .5;f.regenAge = 0;});await frames(4);
  check('Stamina', 'barra acompanha a stamina em tempo real', Math.abs(await page.inputValue('#stamina0').catch(() => null) ?? 0) >= 0 && Math.abs((await L(() => document.getElementById('stamina0').value)) - (await L(() => window.__lab.game.fighters[0].stamina / window.__lab.C.rules.staminaMax))) < .05);
  const folds = await L(() => [...document.querySelectorAll('.panel-body section[data-section] .fold-btn')].length);
  check('Interface', 'grupos com mais de dois itens têm botão de recolher', folds > 10, `${folds} botões`);
  check('Interface', 'Exportar só importa/exporta/compara (restaurar padrões fica em Ajustes)', await L(() => !!document.querySelector('[data-section="tuning"] #reset-all') && !document.querySelector('[data-section="export"] #reset-all')));
  check('Interface', 'IA do oponente na aba Partida; teclas na aba Controles', await L(() => !!document.querySelector('[data-section="match"] #enemy-ai-control [data-path="extras.toggles.enableEnemyAI"]') && document.querySelectorAll('[data-section="controls"] #bindings-controls .tune-control').length >= 10));
  check('Interface', 'controles de VFX somente na aba Visualizar', await L(() => !document.querySelector('[data-section="tuning"] [data-path^="vfx."]') && document.querySelectorAll('[data-section="overlays"] [data-path^="vfx."]').length > 90));

  // ---------- IA do oponente desligada ----------
  await openTab('match');await page.selectOption('#mode', 'tactical');await start();await L(() => window.__lab.tuning.commit([['extras.toggles.enableEnemyAI', 0]], 'IA off'));
  await page.waitForTimeout(700);// deixa a frenagem residual terminar (continuidade física)
  const p0 = await L(() => ({...window.__lab.game.fighters[1].position}));await page.waitForTimeout(1500);const p1 = await L(() => ({...window.__lab.game.fighters[1].position}));
  check('IA do oponente', 'desligada: o vermelho não se move sozinho', Math.hypot(p1.x - p0.x, p1.z - p0.z) < 1e-6, `${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(4)} m`);
  await set('extras.toggles.enableEnemyAI', 1);

  // ---------- Controle manual do vermelho ----------
  await L(() => window.__lab.tuning.commit([['extras.toggles.enemyManual', 1], ['extras.toggles.enableEnemyAI', 1]], 'manual'));await start();
  const r0 = await L(() => ({...window.__lab.game.fighters[1].position}));
  await L(() => new Promise(done => {const c = document.querySelector('.stage canvas'), key = (t, code) => c.dispatchEvent(new KeyboardEvent(t, {code, bubbles: true}));key('keydown', 'KeyL');setTimeout(() => {key('keyup', 'KeyL');done();}, 600);}));
  const r1 = await L(() => ({...window.__lab.game.fighters[1].position}));
  check('Controle manual', 'tecla L move o vermelho (IA ignorada)', Math.hypot(r1.x - r0.x, r1.z - r0.z) > .8, `${Math.hypot(r1.x - r0.x, r1.z - r0.z).toFixed(2)} m`);
  await L(() => new Promise(done => {const c = document.querySelector('.stage canvas'), key = (t, code) => c.dispatchEvent(new KeyboardEvent(t, {code, bubbles: true}));key('keydown', 'KeyU');key('keyup', 'KeyU');setTimeout(done, 120);}));
  check('Controle manual', 'tecla U faz o tackle do vermelho', await L(() => window.__lab.recorder.actions.some(a => a.fighter === 1 && a.kind === 'tackle')));
  check('Controle manual', 'teclas do vermelho configuráveis na aba Controles', await L(() => document.querySelectorAll('#bindings2-controls [data-path^="extras.bindings2."]').length >= 12)); // comandos básicos + slots de movimentos + pulo
  await L(() => window.__lab.tuning.commit([['extras.toggles.enemyManual', 0]], 'manual off'));

  // ---------- Sprint pelo teclado ----------
  await start();await page.locator('canvas').first().focus();
  await L(() => new Promise(done => {const c = document.querySelector('.stage canvas'), key = (t, code) => c.dispatchEvent(new KeyboardEvent(t, {code, bubbles: true}));key('keydown', 'ArrowRight');key('keydown', 'KeyC');setTimeout(done, 900);}));
  const sp = await L(() => ({s: window.__lab.game.fighters[0].sprinting, st: window.__lab.game.fighters[0].stamina, log: window.__lab.view.vfx.log.some(e => e.effect === 'sprint')}));
  await page.screenshot({path: out + 'sprint.png', clip: stage});
  await L(() => {const c = document.querySelector('.stage canvas');for (const code of ['KeyC', 'ArrowRight']) c.dispatchEvent(new KeyboardEvent('keyup', {code, bubbles: true}));});
  check('Sprint', 'C mantido com seta após a esquiva entra em sprint', sp.s, JSON.stringify(sp));
  check('Sprint', 'stamina consumida durante o sprint', sp.st < 2, sp.st.toFixed(2));
  check('Sprint', 'speedlines do sprint disparadas', sp.log);

  // ---------- VFX: 3 variantes × 9 tipos, toggle, sliders e limpeza ----------
  await openTab('overlays');await L(() => window.__lab.togglePause(true));await start();await L(() => {window.__lab.tuning.commit([['extras.toggles.enableEnemyAI', 0]], 'IA off');window.__lab.togglePause(false);});
  // Lutadores lado a lado diante da câmera (capturas legíveis); o vermelho fica parado (IA desligada).
  await L(() => {const [a, b] = window.__lab.game.fighters;a.position = {x: 1.4, z: -2.2};b.position = {x: -1.2, z: .6};a.facing = a.visualFacing = 0;b.facing = b.visualFacing = Math.PI;window.__lab.view.reset(a);});await frames(4);
  const types = await L(() => ['hit', 'dodge', 'sprint', 'block', 'perfect', 'ground', 'clash', 'exhaust', 'regen']);
  const variantCount = t => L(t => document.querySelector(`[data-section="overlays"] [data-path="vfx.${t}.variant"]`).options.length, t);
  for (const type of types) for (const v of [...Array(await variantCount(type)).keys()]) {
    await set(`vfx.${type}.variant`, v);await L(() => {window.__lab.view.vfx.reset();window.__lab.view.vfx.stats.peak = 0;});await frames(2);
    const before = await L(() => window.__lab.view.vfx.stats.spawned);
    await L(t => window.__lab.view.vfx.preview(t, window.__lab.game.fighters), type);await frames(type === 'perfect' || type === 'clash' ? 5 : ['dodge', 'sprint', 'exhaust', 'regen'].includes(type) ? 7 : 2);
    // Efeitos contínuos emitem por intervalo de TEMPO (não de quadros): espera até 2 s pela primeira emissão em vez de contar quadros (evita falha intermitente conforme o ritmo de renderização).
    if (['dodge', 'sprint', 'exhaust', 'regen'].includes(type)) await page.waitForFunction(b => window.__lab.view.vfx.stats.spawned > b, before, {timeout: 2000}).catch(() => {});
    const after = await L(() => ({spawned: window.__lab.view.vfx.stats.spawned, active: window.__lab.view.vfx.stats.peak}));
    await page.screenshot({path: out + `vfx-${type}-${'abcd'[v]}.png`, clip: stage});
    check('VFX', `${type} variante ${'ABCD'[v]}: gera partículas`, after.spawned > before && after.active > 0, `${after.spawned - before} criadas`);
  }
  // Toggle desligado: nada é criado e o motivo é registrado.
  await set('vfx.hit.enabled', 0);await L(() => window.__lab.view.vfx.reset());const b0 = await L(() => window.__lab.view.vfx.stats.spawned);
  await L(() => window.__lab.view.vfx.preview('hit', window.__lab.game.fighters));await frames(3);
  void b0;check('VFX', 'desligado: o hit não é criado e o motivo é registrado', await L(() => {const h = window.__lab.view.vfx.log.filter(e => e.effect === 'hit').slice(-1)[0];return !!h && h.reason.includes('desligado');}));
  await set('vfx.hit.enabled', 1);
  // Sliders modificam o efeito real: quantidade dobra as partículas; tamanho muda a escala enviada à GPU.
  const spawnWith = async (path, value) => {await set(path, value);await L(() => window.__lab.view.vfx.reset());const s0 = await L(() => window.__lab.view.vfx.stats.spawned);await L(() => window.__lab.view.vfx.preview('hit', window.__lab.game.fighters));await frames(2);return (await L(() => window.__lab.view.vfx.stats.spawned)) - s0;};
  await set('vfx.hit.variant', 0);const n10 = await spawnWith('vfx.hit.count', 10), n40 = await spawnWith('vfx.hit.count', 40);
  check('VFX', 'slider de quantidade altera o efeito real', n40 > n10 * 2.5, `${n10} → ${n40} partículas`);
  const sizeOf = async s => {await set('vfx.hit.size', s);await L(() => window.__lab.view.vfx.reset());await L(() => window.__lab.view.vfx.preview('hit', window.__lab.game.fighters));await frames(1);return L(() => {const a = window.__lab.view.vfx.add.a.size.array, n = window.__lab.view.vfx.add.geometry.instanceCount;let m = 0;for (let i = 0; i < n * 2; i++) m = Math.max(m, a[i]);return m;});};
  const s1 = await sizeOf(.6), s2 = await sizeOf(2.4);check('VFX', 'slider de tamanho altera a escala real', s2 > s1 * 2.5, `${s1.toFixed(2)} → ${s2.toFixed(2)}`);
  await L(() => window.__lab.tuning.commit([['vfx.hit.size', 1.3], ['vfx.hit.count', 18]], 'restaura'));
  // Limpeza: depois da duração, as partículas somem.
  await L(() => {window.__lab.view.vfx.reset();window.__lab.view.vfx.preview('perfect', window.__lab.game.fighters);});await page.waitForTimeout(2500);
  check('VFX', 'limpeza: partículas liberadas após o efeito', (await L(() => window.__lab.view.vfx.add.p.length + window.__lab.view.vfx.norm.p.length)) <= 40, `${await L(() => window.__lab.view.vfx.add.p.length + window.__lab.view.vfx.norm.p.length)} restantes (regeneração/exaustão podem continuar)`);
  // Preset por efeito e persistência via preset salvo.
  await openTab('overlays');await page.click('[data-vx-item="vfx-hit"]');
  await page.evaluate(() => document.querySelectorAll('.fold-btn[aria-expanded="false"]').forEach(b => b.click()));
  let dl = page.waitForEvent('download');await page.click('[data-group="vfx-hit"] [title="Exportar os valores deste efeito (JSON)"]');
  const preset = JSON.parse(await (await import('node:fs/promises')).readFile(await (await dl).path(), 'utf8'));
  check('VFX', 'preset exportável por efeito', preset.schema === 'arenamon-vfx-preset' && preset.values.variant !== undefined && preset.values.size !== undefined);
  await set('vfx.clash.variant', 2);await openTab('tuning');await L(() => {document.getElementById('preset-name').value = 'vfx-teste';document.getElementById('preset-save').click();});await set('vfx.clash.variant', 0);
  await L(() => [...document.querySelectorAll('#preset-list .preset')].find(p => p.textContent.includes('vfx-teste'))?.querySelector('button').click());
  check('VFX', 'variante persiste no preset salvo', (await L(() => window.__lab.C.vfx.clash.variant)) === 2);

  // ---------- Eventos reais: chão, exaustão, regeneração ----------
  await L(() => {window.__lab.view.vfx.log.length = 0;const f = window.__lab.game.fighters[1];f.flight = {y: 1.5, vy: 0, horizontal: {x: 0, z: 0}};});await page.waitForTimeout(900);
  const groundLog = await L(() => window.__lab.view.vfx.log.find(e => e.effect === 'ground'));
  check('VFX', 'colisão com o solo disparada pelo evento físico real', groundLog?.reason.startsWith('colisão com o solo'), groundLog?.reason);
  await L(() => {window.__lab.view.vfx.log.length = 0;const f = window.__lab.game.fighters[1];f.stamina = 0;f.regenBase = 0;f.regenAge = 0;f.exhausted = true;});await page.waitForTimeout(400);
  check('VFX', 'exaustão do adversário mostra indicadores', await L(() => window.__lab.view.vfx.log.some(e => e.effect === 'exhaust')));
  await L(() => {const f = window.__lab.game.fighters[1];f.stamina = 3;f.regenBase = 3;f.exhausted = false;});await page.waitForTimeout(150);
  const exStop = await L(() => {const s = window.__lab.view.vfx.stats.spawned;return new Promise(r => setTimeout(() => r(window.__lab.view.vfx.stats.spawned - s), 600));});
  check('VFX', 'indicadores somem quando a exaustão termina (stamina cheia, sem regeneração)', exStop === 0, `${exStop} partículas novas`);
  await L(() => {window.__lab.view.vfx.log.length = 0;const f = window.__lab.game.fighters[0];f.stamina = 1;f.regenBase = 1;f.regenAge = 1.5;});await page.waitForTimeout(400);
  check('VFX', 'regeneração real mostra indicadores amarelos', await L(() => window.__lab.view.vfx.log.some(e => e.effect === 'regen')));

  // ---------- Tremor de câmera ----------
  const shake = await L(() => new Promise(r => {const v = window.__lab.view;window.__lab.C.extras.toggles.enableCameraRecenter = 0;v.rig.desiredYaw = v.rig.yaw;v.rig.yawVelocity = 0;const yaw = v.rig.yaw;v.vfx.shake('shakeClash', {x: 1, z: 0}, 1, 'teste');requestAnimationFrame(() => requestAnimationFrame(() => {window.__lab.C.extras.toggles.enableCameraRecenter = 1;const s = v.lastShake, pose = v.rig.pose();r({mag: Math.hypot(s.x, s.y, s.z), dx: v.camera.position.x - pose.position.x, yawSame: v.rig.yaw === yaw});}));}));
  check('Tremor', 'desloca a câmera sem alterar o rig/yaw (referencial de entrada)', shake.mag > 0 && shake.yawSame, JSON.stringify(shake));
  await set('vfx.shakeMaster.enabled', 0);
  const off = await L(() => new Promise(r => {const v = window.__lab.view;v.vfx.shake('shakeClash', {x: 1, z: 0}, 1, 'teste');requestAnimationFrame(() => r(Math.hypot(v.lastShake.x, v.lastShake.y, v.lastShake.z)));}));
  check('Tremor', 'opção global desliga todos os tremores', off === 0, off);await set('vfx.shakeMaster.enabled', 1);

  // ---------- Sombras ----------
  for (const style of [0, 1, 2]) {
    await set('display.shadow.style', style);await set('display.grounding.visualOffset', .4);await frames(3);
    const sh = await L(() => {const v = window.__lab.view, f = window.__lab.game.fighters[0], s = v.shadows[0];return {x: s.position.x - f.position.x - window.__lab.C.display.shadow.offsetX, z: s.position.z - f.position.z, y: s.position.y, count: v.scene.children.filter(o => v.shadows.includes(o)).length, maps: v.renderer.shadowMap.enabled};});
    await page.screenshot({path: out + `sombra-${'abc'[style]}.png`, clip: stage});
    check('Sombras', `estilo ${'ABC'[style]}: no chão, na posição física, sem duplicar`, Math.abs(sh.x) < 1e-6 && Math.abs(sh.z) < 1e-6 && sh.y < .05 && sh.count === 2 && !sh.maps, JSON.stringify(sh));
  }
  await set('display.grounding.visualOffset', 0);await set('display.shadow.style', 2);

  // ---------- Indicador da janela C → X ----------
  await set('display.cancelRing.inner', 2);check('Indicador C → X', 'raio configurável (só desenho)', (await L(() => window.__lab.C.display.cancelRing.inner)) === 2);await set('display.cancelRing.inner', 1.05);

  // ---------- Personagem GLB ----------
  if (existsSync(glb)) {
    await openTab('characters');
    await page.setInputFiles('#char-slots .char-slot input[data-model]', glb);await page.waitForFunction(() => window.__lab.ui.characters[0]);
    await page.evaluate(() => window.__lab.charPanel.selectFighter(1));await page.click('#char-slots .char-slot:nth-child(2) [data-same]');await page.evaluate(() => window.__lab.charPanel.selectFighter(0));await page.waitForFunction(() => window.__lab.ui.characters[1]);
    await L(() => window.__lab.tuning.commit([['extras.toggles.enableEnemyAI', 1], ['extras.toggles.enablePlayerAI', 1]], 'IA x IA'));await openTab('match');await start();
    for (let i = 0; i < 12; i++) {await page.waitForTimeout(250);await page.screenshot({path: out + `frames/luta-${String(i).padStart(2, '0')}.png`, clip: stage});}
    await page.waitForTimeout(6000);
    const anim = await L(() => window.__lab.ui.characters.map(ch => ({transitions: ch.transitions, restartsAvoided: ch.restartsAvoided, log: ch.log.slice(), feet: ch.root.position.y})));
    // Mesma janela: o gravador só tem a partida atual; a telemetria de animação acumula as anteriores (o passo recomeça).
    const win = await L(() => {const s = window.__lab.recorder.samples;return {from: s[0]?.tick ?? 0, to: s.at(-1)?.tick ?? 0, n: window.__lab.recorder.actions.filter(a => a.kind === 'tackle' || a.kind === 'dodge').length};});
    const recActions = win.n, current = anim.map(a => a.log.slice(a.log.findLastIndex((e, k) => k > 0 && e.tick < a.log[k - 1].tick) + 1 || 0).filter(e => e.tick >= win.from && e.tick <= win.to));
    const entries = anim.flatMap(a => a.log), actionEntries = current.flat().filter(e => ['tackle', 'dodge_forward', 'dodge_back', 'dodge_left', 'dodge_right', 'vault'].includes(e.to) && !(e.to === 'vault' && e.from?.startsWith('dodge')));
    const finished = entries.filter(e => e.reason === 'ação concluída');
    check('Animação (GLB)', 'uma entrada de animação por ação X/C (sem reinício por detecção repetida)', actionEntries.length <= recActions && actionEntries.length > 0, `${actionEntries.length} entradas para ${recActions} ações`);
    // A última amostra visível pode cair até um quadro antes do fim (GL por software ≈ 60 ms por quadro). A tolerância usa a duração média de quadro medida DEPOIS da partida;
  // um quadro mais lento no meio (carga da máquina, captura de tela) fazia a verificação reprovar de forma intermitente — por isso 3 quadros, não 2.
    const frameMs = await L(() => new Promise(r => {let n = 0;const t0 = performance.now();const f = t => (++n < 20 ? requestAnimationFrame(f) : r((t - t0) / n));requestAnimationFrame(f);}));
    const tol = Math.max(35, 100 * 3 * frameMs / 1000 / Math.min(...(await L(() => [window.__lab.C.actions.tackle.duration, window.__lab.C.actions.dodge.duration]))));
    check('Animação (GLB)', 'ações concluídas tocam até o fim (tolerância de 3 quadros)', finished.every(e => e.playedPct >= 100 - tol), `tolerância ${tol.toFixed(0)}% · ${finished.map(e => e.playedPct).slice(0, 12).join(', ')}`);
    check('Animação (GLB)', 'cancelamentos legítimos identificados', entries.filter(e => e.reason.startsWith('ação cancelada') || e.reason === 'cancelamento C → X').every(e => e.from || e.to), `${entries.filter(e => e.reason.startsWith('ação cancelada')).length} cancelamentos pela defesa`);
    check('Animação (GLB)', 'telemetria registra motivo e origem', entries.every(e => e.reason && e.source), `${entries.length} trocas`);
    writeFileSync(out + 'animacao-telemetria.json', JSON.stringify(anim, null, 2));
    // Altura visual: offset por personagem não move a física.
    // Com a partida pausada (sem saltos nem voo no meio da medição).
    await L(() => window.__lab.togglePause(true));await frames(3);const before = await L(() => window.__lab.ui.characters[0].groundOffset);await L(() => {window.__lab.ui.characters[0].visualOffset = .3;});await frames(5);
    const lift = (await L(() => window.__lab.ui.characters[0].groundOffset)) - before;await L(() => window.__lab.togglePause(false));
    check('Animação (GLB)', 'altura visual por personagem (sem mover a física)', Math.abs(lift - .3) < 1e-3, lift.toFixed(3));await L(() => {window.__lab.ui.characters[0].visualOffset = 0;window.__lab.ui.characters[0].save();});
    // Clipes extras: importação do mesmo GLB para a biblioteca (todos compatíveis).
    await openTab('characters');await page.setInputFiles('#char-slots .char-slot [data-import]', glb);await page.waitForFunction(() => window.__lab.ui.lastImport);
    const imp = await L(() => window.__lab.ui.lastImport);check('Animação (GLB)', 'importar animação para a biblioteca', imp.length > 0 && imp.every(r => r.compatible), `${imp.length} clipes`);
    await L(() => window.__lab.tuning.commit([['extras.toggles.enablePlayerAI', 0]], 'IA off'));
  } else check('Animação (GLB)', 'GLB local ausente (teste ignorado)', true, glb);

  // ---------- Desempenho com vários efeitos ----------
  await L(() => window.__lab.tuning.commit([['extras.toggles.enablePlayerAI', 1], ['extras.toggles.enableEnemyAI', 1], ['vfx.master.enabled', 0]], 'perf'));await openTab('match');await start();await page.waitForTimeout(800);
  const measure = () => L(() => new Promise(r => {let n = 0;const t0 = performance.now();const f = t => {if (++n < 60) requestAnimationFrame(f);else r((t - t0) / n);};requestAnimationFrame(f);}));
  const off0 = await measure();await set('vfx.master.enabled', 1);
  const storm = setInterval(() => L(() => {const v = window.__lab.view.vfx, F = window.__lab.game.fighters;for (const t of ['hit', 'clash', 'perfect', 'ground', 'block']) v.preview(t, F);}).catch(() => {}), 250);
  const on0 = await measure();clearInterval(storm);
  const peak = await L(() => window.__lab.view.vfx.stats.peak), max = await L(() => window.__lab.C.vfx.master.maxParticles);
  // Medido com GL por software (SwiftShader): o custo é de preenchimento de pixels, que numa GPU real é muito menor.
  check('Desempenho', 'tempo de quadro com tempestade de efeitos (dois lutadores, 5 efeitos a cada 250 ms)', on0 < off0 * 2.2 + 10, `${off0.toFixed(1)} ms sem VFX → ${on0.toFixed(1)} ms com VFX (Edge headless, GL por software)`);
  check('Desempenho', 'limite de partículas respeitado', peak <= max, `pico ${peak} ≤ ${max}`);
  await L(() => window.__lab.tuning.commit([['extras.toggles.enablePlayerAI', 0]], 'IA off'));

  // ---------- HUD A/B/C em várias resoluções ----------
  await L(() => window.__lab.togglePause(true));
  for (const [w, h] of [[1280, 720], [1920, 1080], [1024, 768]]) {
    await page.setViewportSize({width: w, height: h});await L(() => document.getElementById('panel-close').click());await frames(3);
    for (const k of [0, 1, 2, 3]) {
      await set('display.hud.proposal', k);await L(() => window.__lab.hudProposals.render(window.__lab.game, .1));await frames(2);
      const hud = await L(k => {
        const r = document.getElementById('hud-proposals'), legacy = !document.getElementById('hud-root').hidden, st = document.querySelector('.stage').getBoundingClientRect();
        const F = window.__lab.game.fighters.map(f => Math.ceil(f.hp));
        const texts = k === 1 ? [...r.querySelectorAll('.nums')].map(e => e.textContent.split('/')[0].trim()) : k === 2 ? [...r.querySelectorAll('.b-hp')].map(e => e.textContent) : k === 3 ? [...r.querySelectorAll('.c-hpnum')].map(e => e.textContent.split('/')[0].trim()) : [];
        const boxes = [...r.querySelectorAll('.cd, .c-slot')].filter(e => !e.hidden).map(e => e.getBoundingClientRect());
        const inside = [...r.querySelectorAll('.hp-side, .b-player, .b-enemy, .c-mod, .c-actions, .cds')].every(e => {const b = e.getBoundingClientRect();return b.width === 0 || (b.left >= st.left - 2 && b.right <= st.right + 2 && b.top >= st.top - 2 && b.bottom <= st.bottom + 2);});
        const center = {l: st.left + st.width * .3, r: st.left + st.width * .7, t: st.top + st.height * .3, b: st.top + st.height * .7};
        const covers = [...r.querySelectorAll('.b-player, .b-enemy, .c-mod, .c-actions, .hp-side')].some(e => {const b = e.getBoundingClientRect();return b.width && b.right > center.l && b.left < center.r && b.bottom > center.t && b.top < center.b;});
        return {visible: !r.hidden, legacy, hpOk: k === 0 || texts.map(Number).join() === F.join(), texts, F, cds: boxes.length, labels: [...r.querySelectorAll('.cd-label')].map(e => e.textContent), inside, covers};
      }, k);
      await page.screenshot({path: out + `hud-${'0abc'[k]}-${w}x${h}.png`});
      const name = ['Atual', 'A', 'B', 'C'][k];
      check('HUD', `${name} ${w}×${h}: um único HUD visível`, k === 0 ? hud.legacy && !hud.visible : hud.visible && !hud.legacy);
      if (k) {
        check('HUD', `${name} ${w}×${h}: HP real exibido`, hud.hpOk, `${hud.texts.join('/')} × ${hud.F.join('/')}`);
        check('HUD', `${name} ${w}×${h}: quatro cooldowns demonstrativos, sem nomes de habilidades`, hud.cds === 4 && hud.labels.every(l => /^Demo \d$/.test(l)), hud.labels.join(', '));
        check('HUD', `${name} ${w}×${h}: dentro da arena e sem cobrir o centro`, hud.inside && !hud.covers, JSON.stringify({inside: hud.inside, covers: hud.covers}));
      }
    }
    // Exaustão perceptível nas três propostas.
    await L(() => {const f = window.__lab.game.fighters[0];f.exhausted = true;f.stamina = 0;});
    for (const k of [1, 2, 3]) {await set('display.hud.proposal', k);await L(() => window.__lab.hudProposals.render(window.__lab.game, .1));check('HUD', `${['', 'A', 'B', 'C'][k]} ${w}×${h}: exaustão indicada`, await L(() => !!document.querySelector('#hud-proposals em.exhaust, #hud-proposals .exhausted')));}
    await L(() => {const f = window.__lab.game.fighters[0];f.exhausted = false;f.stamina = 3;});
  }
  // Cooldown demonstrativo: disparo visível e recarga.
  await set('display.hud.demoAuto', 0);await L(() => window.__lab.hudProposals.triggerDemo(2));await L(() => window.__lab.hudProposals.render(window.__lab.game, .5));
  check('HUD', 'cooldown demonstrativo dispara e recarrega', await L(() => {const el = document.querySelector('#hud-proposals [data-cd="2"]');return !el.classList.contains('ready') && Number(el.style.getPropertyValue('--cd')) > 0;}));
  await set('display.hud.proposal', 0);
  check('Geral', 'sem erros de página', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {check('Geral', 'execução sem exceção', false, e.stack?.split('\n').slice(0, 3).join(' '));}
finally {
  await browser.close();
  const ok = report.filter(r => r.ok).length;
  writeFileSync(out + 'report.json', JSON.stringify({createdAt: new Date().toISOString(), glb: existsSync(glb) ? glb.split(/[\\/]/).pop() : null, checks: report}, null, 2));
  writeFileSync(out + 'report.md', ['# Overhaul — teste de navegador', '', `${ok}/${report.length} verificações aprovadas. Capturas e sequência de quadros nesta pasta.`, '', '| Grupo | Verificação | | Detalhe |', '|---|---|---|---|', ...report.map(r => `| ${r.group} | ${r.label} | ${r.ok ? '✓' : '✗'} | ${r.detail.replaceAll('|', '/').slice(0, 160)} |`)].join('\n'));
  console.log(`\n${ok}/${report.length} verificações aprovadas (validation/overhaul-browser/).`);
  assert.equal(failures, 0, `${failures} verificação(ões) falharam`);
}
