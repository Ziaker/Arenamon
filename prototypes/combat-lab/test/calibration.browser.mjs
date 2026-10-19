// Fase 2 no navegador (Edge real, file://): presets pela interface, calibração simplificada, modo simples/avançado,
// comparação jogável A × B (troca por tecla durante a partida, inclusive no meio de uma ação) e gravador de movimento
// (gravar jogando, medir A × B, gráficos, CSV/JSON, reproduzir na arena). Capturas em validation/calib/.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'validation/calib/';mkdirSync(out, {recursive: true});
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href, glb = root + 'validation/personagem-studio.glb';
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
const report = [];let failures = 0;
const check = (group, label, ok, detail = '') => {report.push({group, label, ok: !!ok, detail: String(detail)});console.log(`${ok ? '✓' : '✗'} ${group} · ${label}${detail !== '' ? ` — ${detail}` : ''}`);if (!ok) failures++;};
const dir = mkdtempSync(join(tmpdir(), 'arenamon-calib-'));
async function open() {
  const ctx = await chromium.launchPersistentContext(dir, {...BROWSER, headless: true, viewport: {width: 1500, height: 920}, acceptDownloads: true});
  const page = ctx.pages()[0] ?? await ctx.newPage(), errors = [];page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('dialog', d => d.accept());await ctx.setOffline(true);await page.goto(labUrl);await page.waitForFunction(() => window.__lab, null, {timeout: 30000});
  const L = (fn, arg) => page.evaluate(fn, arg), tab = t => L(t => {const p = document.getElementById('panel');if (p.hidden || p.dataset.tool !== t) document.querySelector(`[data-tool="${t}"]`).click();}, t);
  const key = async (code, ms = 0) => {await page.locator('canvas').first().focus();await page.keyboard.down(code);if (ms) await page.waitForTimeout(ms);await page.keyboard.up(code);};
  return {ctx, page, L, tab, errors, key};
}
const values = L => L(() => window.__lab.tuning.snapshotValues());
const diff = (a, b) => Object.keys(a).filter(k => Math.abs(a[k] - b[k]) > 1e-12);
try {
  let s = await open();
  // ================= Calibração simplificada =================
  await s.tab('tuning');
  check('Simples', 'modo simples é o padrão e mostra 10–20 controles', await s.L(() => document.querySelectorAll('#simple-controls [data-simple]').length) === 16 && !(await s.page.isVisible('#tune-list')));
  const v0 = await values(s.L);
  const acc = s.page.locator('#simple-accel');await acc.fill('40');
  let v1 = await values(s.L);
  check('Simples', '“Aceleração” edita o parâmetro oficial (sem cópia)', v1['locomotion.acceleration'] === 40 && diff(v0, v1).join() === 'locomotion.acceleration', diff(v0, v1).join());
  await s.page.locator('#simple-inertia').fill('0.8');v1 = await values(s.L);
  const inertia = diff(v0, v1).filter(k => k !== 'locomotion.acceleration').sort();
  check('Simples', 'controle de conjunto edita exatamente os parâmetros que lista', inertia.join() === 'locomotion.accelCurve,locomotion.brakeCurve,locomotion.residualSpeed' && /accelCurve/.test(await s.page.textContent('[data-simple="inertia"] [data-affects]')), inertia.join());
  await s.L(() => {window.__lab.tuning.undo();window.__lab.tuning.undo();});
  check('Simples', 'desfazer (Ctrl+Z) volta os valores', diff(v0, await values(s.L)).length === 0);
  await s.page.click('[data-tune-mode-btn="advanced"]');await s.page.selectOption('#tune-level', 'technical');
  check('Avançado', 'modo avançado mostra todos os parâmetros (nível Tudo)', await s.page.isVisible('#tune-list') && await s.L(() => document.querySelectorAll('#tune-list .tune-control').length) > 20);
  await s.L(() => window.__lab.tuning.commit([['locomotion.turnRate', 3 * Math.PI]], 'x'));await s.page.click('[data-tune-mode-btn="simple"]');
  check('Simples', 'ajuste individual no avançado aparece no controle de conjunto como divergente (sem estado próprio)', await s.page.isVisible('[data-simple="turn"] [data-div]') && !(await s.page.isVisible('[data-simple="inertia"] [data-div]')));
  await s.L(() => window.__lab.tuning.undo());
  await s.page.screenshot({path: out + 'ajustes-simples.png'});

  // ================= Presets =================
  await s.page.selectOption('#preset-select', {label: 'Pesado (inicial)'});await s.page.click('#preset-apply');
  const planText = await s.page.textContent('#preset-plan'), planN = Number(planText.match(/(\d+)\s*parâmetro/)?.[1]);
  check('Presets', 'mostra quantos parâmetros mudarão antes de aplicar', planN > 20 && await s.L(() => window.__lab.C.locomotion.acceleration) === 26, planText.slice(0, 80));
  await s.page.click('#preset-confirm');const vH = await values(s.L), changed = diff(v0, vH);
  check('Presets', 'aplicar “Pesado” muda só locomoção, sprint, curvas de X/C e transições (nunca VFX/HUD/câmera/regras)', changed.length === planN && changed.every(k => /^(locomotion\.|actions\.sprint\.|actions\.(dodge|tackle)\.(prepTime|impulseTime|decelStart|recoveryTime|prepSpeed|travelEnd|blend)|display\.animation\.)/.test(k)), `${changed.length} parâmetros`);
  await s.page.click('#preset-revert');check('Presets', '“Restaurar estado anterior” volta tudo', diff(v0, await values(s.L)).length === 0);
  await s.page.selectOption('#preset-select', {label: 'Storm-like (inicial)'});await s.page.click('#preset-dup');
  check('Presets', 'duplicar cria um preset editável', await s.page.locator('#preset-edit-name').inputValue() === 'Storm-like (cópia)');
  await s.page.fill('#preset-edit-name', 'Storm mais leve');await s.page.click('#preset-rename');
  check('Presets', 'renomear', await s.L(() => window.__lab.presets.all().some(p => p.name === 'Storm mais leve' && !p.builtin)));
  await s.L(() => window.__lab.tuning.commit([['locomotion.acceleration', 33], ['vfx.hit.size', 2]], 'x'));
  await s.page.locator('details.save-preset summary').click();await s.page.fill('#preset-name', 'Só locomoção');await s.page.check('input[name="preset-scope"][value="partial"]');
  await s.L(() => {for (const i of document.querySelectorAll('#preset-cats input')) i.checked = i.value === 'locomotion';});await s.page.click('#preset-save');
  const loc = await s.L(() => window.__lab.presets.all().find(p => p.name === 'Só locomoção'));
  check('Presets', 'salvar como novo preset por categoria (nome, versão, data, só a categoria escolhida)', loc && loc.scope === 'partial' && loc.version === 1 && Object.keys(loc.values).every(k => k.startsWith('locomotion.')) && !('vfx.hit.size' in loc.values) && loc.createdAt);
  await s.L(() => window.__lab.tuning.resetAll());
  await s.page.selectOption('#preset-a', {label: 'Storm-like (inicial)'});await s.page.selectOption('#preset-b', {label: 'Pesado (inicial)'});await s.page.click('#preset-compare');
  check('Presets', 'comparar dois presets', await s.page.locator('#preset-diff tr').count() > 20);
  await s.page.click('#preset-measure');const meas = await s.page.textContent('#preset-diff');
  check('Presets', 'medir a sensação (sequência padrão) de A e B', /Inversão: tempo até 95%/.test(meas), meas.match(/Tempo até a velocidade de caminhada \(95%\)[^T]*/)?.[0]);

  // ================= A × B jogável =================
  await s.tab('characters');await s.page.locator('.char-slot').nth(0).locator('input[data-model]').setInputFiles(glb);await s.page.waitForFunction(() => window.__lab.ui.characters[0]);
  await s.tab('match');await s.page.selectOption('#mode', 'inactive');await s.page.click('#start');
  await s.tab('tuning');await s.page.selectOption('#ab-a', {label: 'Storm-like (inicial)'});await s.page.selectOption('#ab-b', {label: 'Pesado (inicial)'});await s.page.click('#ab-start');
  check('A × B', 'indicador discreto na arena: PRESET A', /PRESET A/.test(await s.page.textContent('#ab-badge')) && await s.L(() => window.__lab.C.locomotion.acceleration) === 40);
  await s.key('ArrowRight', 500);
  const t0 = await s.L(() => {const g = window.__lab.game, f = g.fighters[0], ch = window.__lab.ui.characters[0];return {tick: g.tick, stamina: f.stamina, hp: f.hp, pos: {...f.position}, transitions: ch.transitions, entry: ch.current?.entry};});
  await s.key('KeyB');
  const t1 = await s.L(() => {const g = window.__lab.game, f = g.fighters[0], ch = window.__lab.ui.characters[0];return {tick: g.tick, stamina: f.stamina, hp: f.hp, pos: {...f.position}, transitions: ch.transitions, entry: ch.current?.entry, acc: window.__lab.C.locomotion.acceleration, phase: g.phase};});
  check('A × B', 'tecla B troca para o preset B sem reiniciar a partida', t1.acc === 15 && t1.phase === 'playing' && t1.tick >= t0.tick && /PRESET B/.test(await s.page.textContent('#ab-badge')), JSON.stringify({acc: t1.acc, ticks: t1.tick - t0.tick}));
  check('A × B', 'sem teletransporte, sem mudar stamina/vida, sem reiniciar animação', Math.hypot(t1.pos.x - t0.pos.x, t1.pos.z - t0.pos.z) <= 7 * (t1.tick - t0.tick + 1) / 120 && t1.stamina >= t0.stamina - 1e-9 && t1.hp === t0.hp && t1.transitions === t0.transitions, JSON.stringify({dpos: Math.hypot(t1.pos.x - t0.pos.x, t1.pos.z - t0.pos.z).toFixed(3), transições: [t0.transitions, t1.transitions]}));
  // No meio do tackle: a curva de X não muda até a ação terminar.
  await s.L(() => {window.__lab.togglePause(true);});
  const mid = await s.L(() => {const lab = window.__lab, f = lab.game.fighters[0];f.stamina = 3;f.regenBase = 3;f.exhausted = false;
    lab.togglePause(false);return null;});void mid;
  await s.key('KeyX');await s.page.waitForFunction(() => window.__lab.game.fighters[0].action?.kind === 'tackle' && window.__lab.game.fighters[0].action.elapsed > .05);
  const during = await s.L(() => {const lab = window.__lab, before = lab.C.actions.tackle.prepTime, st = lab.game.fighters[0].stamina;lab.presets.toggleAB();return {before, after: lab.C.actions.tackle.prepTime, pending: lab.presets.ab.pending.length, acc: lab.C.locomotion.acceleration, stamina: [st, lab.game.fighters[0].stamina], badge: document.getElementById('ab-badge').textContent};});
  check('A × B', 'troca no meio do tackle: locomoção muda na hora, curva de X fica para o fim da ação', during.acc === 40 && during.after === during.before && during.pending > 0 && /aguardam/.test(during.badge), JSON.stringify(during));
  await s.page.waitForFunction(() => !window.__lab.game.fighters[0].action && window.__lab.presets.ab.pending.length === 0, null, {timeout: 5000});
  check('A × B', 'parâmetros adiados aplicados no primeiro passo seguro', await s.L(() => window.__lab.C.actions.tackle.prepTime) === .04 && await s.L(() => window.__lab.presets.ab.log.at(-1).appliedTick > window.__lab.presets.ab.log.at(-1).tick));
  check('A × B', 'stamina não é escrita pela troca', during.stamina[0] === during.stamina[1]);
  await s.page.screenshot({path: out + 'ab-jogavel.png'});
  const undoBefore = await s.L(() => window.__lab.tuning.snapshotValues()['locomotion.acceleration']);void undoBefore;
  await s.page.click('[data-ab-keep="B"]');
  check('A × B', 'encerrar mantendo B (com desfazer)', await s.L(() => window.__lab.C.locomotion.acceleration) === 15 && !(await s.page.isVisible('#ab-badge')));
  await s.L(() => window.__lab.tuning.undo());check('A × B', 'Ctrl+Z volta ao estado anterior à comparação', await s.L(() => window.__lab.C.locomotion.acceleration) === 26);

  // ================= Gravador de movimento =================
  await s.tab('match');await s.page.click('#start');await s.tab('scenarios');
  await s.page.click('#mv-rec');
  await s.key('ArrowRight', 600);await s.key('ArrowLeft', 500);await s.key('KeyC', 80);await s.page.waitForTimeout(300);await s.key('KeyX');await s.page.waitForTimeout(700);
  await s.page.click('#mv-rec');
  const seqInfo = await s.L(() => {const seqs = window.__lab.movement.list();return {n: seqs.length, last: seqs.at(-1)?.ticks, sel: document.getElementById('mv-seq').value};});
  check('Gravador', 'grava comandos no tempo de simulação', seqInfo.n === 2 && seqInfo.last > 150 && seqInfo.sel.startsWith('rec-'), JSON.stringify(seqInfo));
  await s.page.selectOption('#mv-a', {label: 'Storm-like (inicial)'});await s.page.selectOption('#mv-b', {label: 'Pesado (inicial)'});await s.page.click('#mv-run');
  const rep = await s.page.textContent('#mv-report');
  check('Gravador', 'reexecução determinística e condições equivalentes declaradas', /reexecução idêntica/.test(rep) && /Condições equivalentes/.test(rep), rep.slice(0, 140));
  check('Gravador', 'medidas: distância, velocidades, frenagem, inversão, X/C, stamina, colisões, transições de animação', ['Distância percorrida', 'Velocidade média', 'Velocidade máxima', 'Tempo até a velocidade', 'Tempo de frenagem', 'Inversão', 'Duração do tackle', 'Distância do tackle', 'Distância da esquiva', 'Stamina consumida', 'Eventos de colisão', 'Transições de animação'].every(t => rep.includes(t)));
  await s.page.click('#mv-graphs');await s.page.waitForTimeout(400);
  check('Gráficos', '6 gráficos + faixa de estados, com legenda e marcadores', await s.L(() => document.querySelectorAll('#graphs-body figure.chart').length) === 7);
  const box = await s.page.locator('#graphs-body figure[data-panel="speed"] canvas').boundingBox();await s.page.mouse.move(box.x + box.width * .4, box.y + 60);
  check('Gráficos', 'hover com cruz e tooltip (valores de A e B)', await s.page.isVisible('.chart-tip') && /A ·/.test(await s.page.textContent('.chart-tip')));
  await s.page.screenshot({path: out + 'graficos.png'});await s.page.click('#graphs-close');
  let dl = s.page.waitForEvent('download');await s.page.click('#mv-csv');const csv = readFileSync(await (await dl).path(), 'utf8');
  check('Exportação', 'CSV por passo com A e B', /A:speed/.test(csv.split('\n')[0]) && /B:speed/.test(csv.split('\n')[0]) && csv.split('\n').length > 150);
  dl = s.page.waitForEvent('download');await s.page.click('#mv-json');const json = JSON.parse(readFileSync(await (await dl).path(), 'utf8'));
  check('Exportação', 'relatório JSON versionado (schema, versão, métricas, marcadores, amostras)', json.schema === 'arenamon-lab-report' && json.version === 1 && json.runs.length === 2 && json.runs[0].samples.length > 150 && json.comparable === true);
  writeFileSync(out + 'relatorio-movimento.json', JSON.stringify(json));
  await s.page.selectOption('#mv-seq', 'padrao');await s.page.click('#mv-play');
  await s.page.waitForFunction(() => window.__labRecording.ui.playback?.ended, null, {timeout: 20000});
  check('Gravador', 'reprodução na arena com o preset A e volta dos valores ao terminar', await s.L(() => window.__lab.C.locomotion.acceleration) === 26);
  check('Geral', 'sem erros no console', s.errors.length === 0, s.errors.join(' | '));
  await s.L(() => window.__lab.ws.saveNow());await s.ctx.close();

  // ================= Persistência da fase 2 =================
  s = await open();
  check('Persistência', 'presets do usuário, sequências gravadas e modo do ajustador restaurados', await s.L(() => window.__lab.presets.all().some(p => p.name === 'Só locomoção') && window.__lab.movement.list().length === 2 && window.__lab.presets.mode === 'simple'));
  await s.ctx.close();
} finally {
  writeFileSync(out + 'report.json', JSON.stringify({date: new Date().toISOString(), failures, report}, null, 1));
  try {rmSync(dir, {recursive: true, force: true});} catch {/* em uso */}
}
console.log(`\n${report.length - failures} de ${report.length} verificações aprovadas.`);
if (failures) process.exit(1);
