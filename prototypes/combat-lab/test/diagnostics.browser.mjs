// Fase 3 no navegador (Edge real, file://): aviso de comando negado na arena e histórico (mesmo motivo do motor),
// indicadores de janelas acima dos lutadores (tempos da simulação), treino de defesa perfeita pela interface e
// validador de modelos/animações (compatível, com ressalvas, incompatível, formato recusado). Capturas em validation/diag/.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'validation/diag/';mkdirSync(out, {recursive: true});
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href, glb = root + 'validation/personagem-studio.glb';
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
const report = [];let failures = 0;
const check = (group, label, ok, detail = '') => {report.push({group, label, ok: !!ok, detail: String(detail)});console.log(`${ok ? '✓' : '✗'} ${group} · ${label}${detail !== '' ? ` — ${detail}` : ''}`);if (!ok) failures++;};
/** GLB com os nomes dos nós trocados (rig diferente) ou das animações (arquivo extra). */
function rewrite(buf, fn) {
  const len = buf.readUInt32LE(12), json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8')), rest = buf.subarray(20 + len);fn(json);
  let text = Buffer.from(JSON.stringify(json), 'utf8');text = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 0x20)]);
  const head = Buffer.alloc(20);head.writeUInt32LE(0x46546c67, 0);head.writeUInt32LE(2, 4);head.writeUInt32LE(20 + text.length + rest.length, 8);head.writeUInt32LE(text.length, 12);head.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([head, text, rest]);
}
const base = readFileSync(glb);
writeFileSync(out + 'rig-diferente.glb', rewrite(base, j => {j.nodes.forEach((n, i) => {if (n.name) n.name = 'Outro_' + i;});j.animations.forEach(a => {a.name = 'alheia_' + a.name;});}));
writeFileSync(out + 'extra-ok.glb', rewrite(base, j => {j.animations.forEach(a => {a.name = 'extra_' + a.name;});}));
writeFileSync(out + 'falso.fbx', Buffer.from('Kaydara FBX Binary  \u0000\u001a\u0000 conteúdo qualquer'));

const browser = await chromium.launch({...BROWSER, headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 920}, acceptDownloads: true}), errors = [];
  page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});page.on('dialog', d => d.accept());
  await page.context().setOffline(true);await page.goto(labUrl);await page.waitForFunction(() => window.__lab);
  const L = (fn, arg) => page.evaluate(fn, arg), tab = t => L(t => {const p = document.getElementById('panel');if (p.hidden || p.dataset.tool !== t) document.querySelector(`[data-tool="${t}"]`).click();}, t);
  const key = async (code, ms = 0) => {await page.locator('canvas').first().focus();await page.keyboard.down(code);if (ms) await page.waitForTimeout(ms);await page.keyboard.up(code);};

  // ================= Comandos negados =================
  await tab('match');await page.selectOption('#mode', 'inactive');await page.click('#start');await page.waitForTimeout(200);
  await page.evaluate(() => {window.__lab.C.display.diagnostics.toast = 1;});
  await L(() => {const f = window.__lab.game.fighters[0];f.stamina = .4;f.regenBase = .4;f.regenAge = 0;});
  await key('KeyX');
  // Espera o aviso aparecer (em vez de um intervalo fixo de 60 ms). Com quadros lentos o buffer de 100 ms pode expirar dentro de um só quadro: o aviso final é “buffer expirou”, com o mesmo motivo do motor.
  await page.waitForFunction(() => /^X /.test(document.getElementById('deny-toast')?.textContent ?? ''), null, {timeout: 3000}).catch(() => {});
  const toast = await page.textContent('#deny-toast');
  check('Negados', 'aviso curto na arena com o motivo do motor', /^X (guardado no buffer|ignorado|buffer expirou): stamina insuficiente \(0,4\d \/ 1,00\)/.test(toast) && await page.isVisible('#deny-toast'), toast);
  await page.waitForTimeout(1700);check('Negados', 'o aviso some sozinho', !(await page.isVisible('#deny-toast')));
  await key('KeyC');await page.waitForTimeout(40);
  await L(() => {const f = window.__lab.game.fighters[0];f.stamina = 3;f.regenBase = 3;f.exhausted = false;});
  await key('KeyC', 30);await page.waitForTimeout(30);await key('KeyX');await page.waitForTimeout(60);
  await tab('overlays');await page.waitForTimeout(250);
  const rows = await L(() => [...document.querySelectorAll('#diag-log tr')].slice(1).map(r => r.textContent));
  check('Negados', 'histórico detalhado na aba Visualizar (comando, motivo, estado, atual × exigido)', rows.length >= 2 && rows.some(r => /stamina insuficiente/.test(r) && /0\.4\d \/ 1\.00|0,4\d \/ 1,00/.test(r)), rows.slice(0, 3).join(' | '));
  const exported = await L(() => window.__lab.diagnostics.exportData());
  check('Negados', 'dados exportáveis em relatório versionado', exported.schema === 'arenamon-lab-report' && exported.kind === 'command-diagnostics' && exported.entries.every(e => e.reason || e.result === 'executed'));
  check('Negados', 'reexecuções sem renderização não poluem o histórico', await L(() => {const n = window.__lab.diagnostics.log.length;document.getElementById('scenario-all').click();return window.__lab.diagnostics.log.length === n;}));

  // ================= Janelas de combate =================
  await tab('match');await page.click('#start');await L(() => window.__lab.tuning.commit([['display.windows.mode', 2]], 'janelas'));
  await key('KeyC');await page.waitForTimeout(40);
  // DOM e estado lidos na mesma avaliação (nenhum passo entre os dois).
  const {win, st} = await L(() => {const f = window.__lab.game.fighters[0];return {win: [...document.querySelectorAll('.win-stack[data-fighter="0"] .win-row')].map(r => [r.dataset.win, r.querySelector('b').textContent]), st: {elapsed: f.action?.elapsed, inv: window.__lab.C.actions.dodge.invulnerable}};});
  check('Janelas', 'durante a esquiva: invulnerabilidade, C → X e encadear com o tempo real restante', ['invulnerable', 'cancel', 'chain'].every(k => win.some(w => w[0] === k)) && Math.abs(Number(win.find(w => w[0] === 'invulnerable')?.[1]) - Math.round((st.inv - st.elapsed) * 1000)) <= 1, JSON.stringify({win, st}));
  // Evidência em câmera lenta (0,1×), com os dois lutadores e os indicadores visíveis.
  await L(() => {window.__arenaLive.clock.timeScale = .1;window.__lab.game.fighters[1].position = {x: 3, z: 2};});await page.waitForTimeout(400);await key('KeyC');await page.waitForTimeout(250);
  await page.screenshot({path: out + 'janelas.png', clip: {x: 430, y: 52, width: 1070, height: 618}});await L(() => {window.__arenaLive.clock.timeScale = 1;});await page.waitForTimeout(600);
  await L(() => window.__lab.tuning.commit([['display.windows.invulnerable', 0], ['display.windows.scale', 1.4], ['display.windows.opacity', .5]], 'janelas'));await key('KeyC');await page.waitForTimeout(40);
  const win2 = await L(() => ({rows: [...document.querySelectorAll('.win-stack[data-fighter="0"] .win-row')].map(r => r.dataset.win), op: document.querySelector('.win-stack[data-fighter="0"]').style.opacity, sc: document.querySelector('.win-stack[data-fighter="0"]').style.getPropertyValue('--win-scale')}));
  check('Janelas', 'selecionar janelas, escala e opacidade', !win2.rows.includes('invulnerable') && win2.op === '0.5' && win2.sc === '1.4', JSON.stringify(win2));
  await L(() => window.__lab.tuning.commit([['display.windows.mode', 1]], 'só jogador'));
  check('Janelas', 'mostrar só o jogador', await L(() => document.querySelector('.win-stack[data-fighter="1"]').hidden));
  await L(() => window.__lab.tuning.commit([['display.windows.mode', 0]], 'off'));await page.waitForTimeout(40);
  check('Janelas', 'ocultar tudo', await L(() => [...document.querySelectorAll('.win-stack')].every(b => b.hidden)));

  // ================= Treino de defesa perfeita =================
  await tab('scenarios');await page.selectOption('#train-mode', 'guard');await page.fill('#train-interval', '3');
  // Jogador “robô” que aperta D a 10 passos do impacto previsto e depois 40 passos antes (cedo demais), alternando.
  await L(() => {const live = window.__arenaLive, orig = live.input.command.bind(live.input);let n = 0;window.__trainPlan = [10, 40, 10];
    live.input.command = (...a) => {const c = orig(...a), cur = window.__lab.ui.training?.cur, g = window.__lab.game;
      if (cur?.predictedTick != null) {const k = window.__trainPlan[cur.n - 1] ?? 10;if (g.tick === cur.predictedTick - k) {c.guard = true;c.guardPressed = true;n++;} else if (g.tick > cur.predictedTick - k && g.tick < cur.predictedTick + 20) c.guard = true;}
      return c;};});
  await page.click('#train-start');
  await page.waitForFunction(() => (window.__lab.training.trainer?.attempts.length ?? 0) >= 3, null, {timeout: 30000});
  const tr = await L(() => window.__lab.training.trainer.attempts.slice(0, 3).map(a => ({result: a.result, timing: a.timing, text: a.text, success: a.success})));
  check('Treino', 'D a 10 passos do impacto: defesa perfeita, “dentro da janela”', tr[0].success && tr[0].timing === 'inside' && tr[2].success, JSON.stringify(tr[0]));
  check('Treino', 'D 40 passos antes: defesa comum, “N ms antes da janela perfeita”', !tr[1].success && tr[1].timing === 'early' && /ms antes da janela perfeita/.test(tr[1].text), tr[1].text);
  const board = await page.textContent('#train-report');
  check('Treino', 'placar, precisão média e histórico de tentativas', /2 de 3/.test(board) && /erro médio/.test(board) && await page.locator('#train-report tr').count() === 4, board.slice(0, 90));
  await page.screenshot({path: out + 'treino.png'});
  const dl = page.waitForEvent('download');await page.click('#train-export');const tj = JSON.parse(readFileSync(await (await dl).path(), 'utf8'));
  check('Treino', 'histórico exportável (relatório versionado)', tj.kind === 'perfect-training' && tj.attempts.length >= 3 && tj.window === .2);
  await page.click('#train-start');check('Treino', 'encerrar treino', await L(() => !window.__lab.ui.training));

  // ================= Validador =================
  await tab('characters');await page.locator('.char-slot').nth(0).locator('input[data-model]').setInputFiles(glb);await page.waitForFunction(() => window.__lab.ui.characters[0]?.validation);
  const v1 = await L(() => window.__lab.ui.characters[0].validation);
  check('Validador', 'modelo do Studio: veredito e itens verificados (formato, malhas, skinning, clipes)', v1.verdict <= 1 && v1.issues.some(i => /GLB 2\.0/.test(i.text)) && v1.issues.some(i => /skinning/.test(i.text)) && v1.clips.length === 3, `${v1.label}: ${v1.issues.map(i => i.text).join(' | ')}`);
  await page.locator('.char-slot').nth(0).locator('[data-import]').setInputFiles(out + 'extra-ok.glb');await page.waitForFunction(() => window.__lab.ui.characters[0].importValidations?.length === 1);
  const v2 = await L(() => window.__lab.ui.characters[0].importValidations[0]);
  check('Validador', 'animações do mesmo rig: Compatível', v2.verdict === 0 && v2.label === 'Compatível' && v2.issues.some(i => /3 de 3 ossos|100%/.test(i.text)), `${v2.label}: ${v2.issues.map(i => i.text).join(' | ')}`);
  await L(() => {window.__lab.ui.lastImport = null;});await page.locator('.char-slot').nth(0).locator('[data-import]').setInputFiles(out + 'rig-diferente.glb');await page.waitForFunction(() => window.__lab.ui.characters[0].importValidations?.length === 2);
  const v3 = await L(() => ({v: window.__lab.ui.characters[0].importValidations[1], lib: window.__lab.ui.characters[0].clipInfo.filter(c => c.name.startsWith('alheia_')).map(c => c.compatible)}));
  check('Validador', 'rig diferente: Incompatível, com ossos ausentes listados', v3.v.verdict === 2 && v3.v.label === 'Incompatível' && v3.v.clips.some(c => c.issues.some(i => /ausente/.test(i.text))), v3.v.issues.map(i => i.text).join(' | '));
  check('Validador', 'nada descartado: clipes incompatíveis ficam na biblioteca, desabilitados', v3.lib.length === 3 && v3.lib.every(c => c === false));
  await page.waitForFunction(() => /Incompatível/.test(document.querySelector('.char-slot .validation')?.textContent ?? ''), null, {timeout: 3000}).catch(() => {});
  const panelText = await page.textContent('.char-slot .validation');
  check('Validador', 'relatórios visíveis no slot, com prévia por clipe', /Compatível/.test(panelText) && /Incompatível/.test(panelText) && await page.locator('.char-slot .validation [data-val-preview]').count() > 0);
  await L(() => document.querySelectorAll('.char-slot .validation details').forEach(d => d.open = true));await page.screenshot({path: out + 'validador.png'});
  await page.locator('.char-slot').nth(0).locator('[data-import]').setInputFiles(out + 'falso.fbx');await page.waitForTimeout(300);
  const fbx = await page.textContent('.char-slot [data-import-result]');
  check('Validador', 'formato não suportado recusado com motivo claro (FBX)', /FBX não é suportado/.test(fbx), fbx);
  check('Geral', 'sem erros no console', errors.length === 0, errors.join(' | '));
} finally {
  writeFileSync(out + 'report.json', JSON.stringify({date: new Date().toISOString(), failures, report}, null, 1));
  await browser.close();
}
console.log(`\n${report.length - failures} de ${report.length} verificações aprovadas.`);
if (failures) process.exit(1);
