// Conclusão visual no APLICATIVO REAL — cenários que o teste do tackle (animation-conclusao-visual.browser.mjs) não cobre:
//   1. Move (slot 1 = Swift) e andar depois · 2. esquiva (C) e andar depois · 3. tackle encostado na parede andando contra ela
//   4. tackle em cima de plataforma (quando o mapa tem uma) · 5. INTERRUPÇÃO: esquiva aceita no meio da conclusão visual do tackle.
// Wookada (menu, configuração salva) e Cogumelo (.glb real) como lutador 0, teclado de verdade, renderizador real.
// Prova por execução: registro de transições do Character + amostra por quadro (chave, tempo do clipe, peso, epílogo, posição).
// Capturas em evidence/conclusao-visual/cenarios/: durante, andando no clipe, último quadro do clipe/depois e a interrupção.
// Uso: node test/animation-conclusao-cenarios.browser.mjs (com dist/ recompilado por npm run rapido:build).
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('..', import.meta.url));
const out = root + 'evidence/conclusao-visual/cenarios/';
mkdirSync(out, {recursive: true});
const cogumelo = readFileSync(new URL('../../../chars/mosh/Cogumelo.glb', import.meta.url)).toString('base64');
const browser = await chromium.launch({channel: 'msedge', headless: true});
const results = [], report = [];
const tap = async (page, code, ms = 70) => {await page.keyboard.down(code);await page.waitForTimeout(ms);await page.keyboard.up(code);};

async function openWith(mine, rival) {
  const page = await browser.newPage({viewport: {width: 1400, height: 850}}), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href);
  await page.waitForFunction(() => window.__lab?.quickMenu, null, {timeout: 60000});
  for (const [slot, name] of [[0, mine], [1, rival]]) {
    if (name === 'wookada') {
      await page.waitForFunction(() => [...document.querySelectorAll('#quick-char-0 option')].some(o => /wookada/i.test(o.textContent)), null, {timeout: 30000});
      const id = await page.evaluate(() => [...document.querySelectorAll('#quick-char-0 option')].find(o => /wookada/i.test(o.textContent)).value);
      await page.evaluate(async ([s, i]) => {await window.__lab.quickMenu.selectCharacter(s, i);}, [slot, id]);
    } else await page.evaluate(async ([s, enc]) => {const L = window.__lab, raw = Uint8Array.from(atob(enc), c => c.charCodeAt(0));L.setCharacter(s, await L.loadStudioFile(new File([raw], 'Cogumelo.glb')));}, [slot, cogumelo]);
    await page.waitForFunction(s => window.__lab.ui.characters[s]?.clips?.length > 10, slot, {timeout: 60000});
  }
  return {page, errors};
}

/** Começa uma partida, aplica `setup` (no navegador), instala o amostrador e devolve o cursor do log. */
async function begin(page, setup = '') {
  await page.evaluate(src => {
    const L = window.__lab, {C} = L;C.extras.toggles.enableEnemyAI = 0;
    L.game.setLoadout(0, ['swift']);   // slot 1 (tecla A): Move com clipe próprio (move_1) nos dois modelos
    L.startMatch();
    C.actions.tackle.duration = C.test.step * 10;   // fim mecânico bem antes do fim do clipe: a conclusão visual entra de verdade
    if (src) new Function('L', 'C', src)(L, C);
  }, setup);
  await page.waitForTimeout(900);
  return page.evaluate(() => {
    const L = window.__lab, rows = (window.__rows = []);
    const tick = () => {const ch = L.ui.characters[0], f = L.game.fighters[0];
      if (ch?.current) rows.push({t: performance.now(), key: ch.current.key, id: ch.current.id, time: +ch.current.action.time.toFixed(4), w: +ch.current.weight.toFixed(3), epi: !!ch.epilogue, act: f.action?.kind ?? null, x: +f.position.x.toFixed(3), z: +f.position.z.toFixed(3), gy: +(f.groundY ?? 0).toFixed(3), clip: ch.current.clip.name, entry: ch.current.entry});
      window.__raf = requestAnimationFrame(tick);};
    tick();return L.ui.characters[0].log.length;
  });
}
const collect = (page, n) => page.evaluate(n => {cancelAnimationFrame(window.__raf);const ch = window.__lab.ui.characters[0];
  return {rows: window.__rows, name: ch.source.name, log: ch.log.slice(n).map(e => ({from: e.from, to: e.to, clipFrom: e.clipFrom, playedPct: e.playedPct, reason: e.reason, interrupted: e.interrupted, epilogue: !!e.epilogue, epilogueEnd: !!e.epilogueEnd, execFrom: e.execFrom}))};}, n);

/** Execução de `key` (prefixo) nas amostras: concluiu natural? quanto andou? */
function judge(d, keyTest) {
  const rows = d.rows.filter(r => keyTest(r.key));
  const ep = d.log.filter(e => keyTest(e.from ?? ''));
  const natural = ep.some(e => e.epilogueEnd && e.reason === 'conclusão natural') || ep.some(e => !e.epilogue && e.playedPct >= 95 && !e.interrupted);
  const moved = rows.length ? Math.hypot(rows.at(-1).x - rows[0].x, rows.at(-1).z - rows[0].z) : 0;
  // Maior deslocamento do corpo num único quadro de render durante a CONCLUSÃO VISUAL (o tackle em si é rápido e não entra): teletransporte = salto > 1,5 m.
  const epRows = rows.filter(r => r.epi), maxStep = epRows.slice(1).reduce((m, r, i) => Math.max(m, Math.hypot(r.x - epRows[i].x, r.z - epRows[i].z)), 0);
  return {rows, ep, natural, moved, maxStep, epi: rows.some(r => r.epi), clip: rows[0]?.clip};
}

try {
  for (const [mine, rival] of [['wookada', 'cogumelo'], ['cogumelo', 'wookada']]) {
    const {page, errors} = await openWith(mine, rival), tag = c => `${out}${mine}-${c}.png`;

    // 1. Move (Swift, slot 1) e andar depois
    let n = await begin(page);
    await tap(page, 'KeyA');await page.waitForTimeout(260);await page.screenshot({path: tag('move-1-durante')});
    await page.keyboard.down('ArrowRight');await page.waitForTimeout(400);await page.screenshot({path: tag('move-2-andando-no-clipe')});
    await page.waitForTimeout(1500);await page.keyboard.up('ArrowRight');await page.screenshot({path: tag('move-3-depois')});
    let d = await collect(page, n), j = judge(d, k => k.startsWith('move_'));
    assert.ok(j.rows.length > 5, `${d.name}: Move tocado (${j.rows.length} amostras)`);
    assert.ok(j.natural, `${d.name}: Move concluiu até o fim (${JSON.stringify(j.ep.slice(0, 4))})`);
    assert.ok(!j.ep.some(e => e.interrupted && !['nova ação', 'reação de combate'].includes(e.reason)), `${d.name}: Move sem corte indevido (${JSON.stringify(j.ep)})`);
    results.push(`${d.name}: Move «${j.clip}» concluído (${j.rows.length} amostras, conclusão visual ${j.epi ? 'usada' : 'não precisou'}, andou ${j.moved.toFixed(2)} m)`);report.push({p: d.name, caso: 'Move + andar', clip: j.clip, natural: j.natural, epi: j.epi, andou: +j.moved.toFixed(2)});

    // 2. esquiva (C) e andar depois
    n = await begin(page);
    await tap(page, 'KeyC');await page.waitForTimeout(120);await page.screenshot({path: tag('esquiva-1-durante')});
    await page.keyboard.down('ArrowUp');await page.waitForTimeout(1600);await page.keyboard.up('ArrowUp');await page.screenshot({path: tag('esquiva-2-depois')});
    d = await collect(page, n);j = judge(d, k => k.startsWith('dodge') || k === 'recovery_dodge');
    assert.ok(j.rows.length > 3, `${d.name}: esquiva tocada (${j.rows.length})`);
    assert.ok(j.natural || j.ep.every(e => !e.interrupted), `${d.name}: esquiva sem corte indevido (${JSON.stringify(j.ep.slice(0, 4))})`);
    results.push(`${d.name}: esquiva «${j.clip}» ${j.natural ? 'concluída' : 'trocada por sucessora autorizada'} (andou ${j.moved.toFixed(2)} m)`);report.push({p: d.name, caso: 'esquiva + andar', clip: j.clip, natural: j.natural, epi: j.epi, andou: +j.moved.toFixed(2)});

    // 3. tackle encostado na parede, andando contra ela durante a conclusão visual
    n = await begin(page, `const f = L.game.fighters[0], o = L.game.fighters[1];f.position.x = C.test.arenaHalf - .9;f.position.z = 0;o.position.x = -6;o.position.z = 0;f.facing = Math.PI / 2;`);
    await tap(page, 'KeyX');await page.keyboard.down('ArrowRight');await page.waitForTimeout(300);await page.screenshot({path: tag('parede-1-andando-contra-a-parede')});
    await page.waitForTimeout(1600);await page.keyboard.up('ArrowRight');await page.screenshot({path: tag('parede-2-depois')});
    d = await collect(page, n);j = judge(d, k => k === 'tackle');
    assert.ok(j.rows.length > 3 && j.natural, `${d.name}: tackle na parede concluiu (${JSON.stringify(j.ep.slice(0, 4))})`);
    assert.ok(j.maxStep < 1.5, `${d.name}: sem teletransporte na parede durante a conclusão visual (maior salto num quadro ${j.maxStep.toFixed(3)} m)`);
    results.push(`${d.name}: tackle na parede «${j.clip}» concluído, maior salto do corpo num quadro na conclusão visual ${j.maxStep.toFixed(3)} m`);report.push({p: d.name, caso: 'tackle na parede', clip: j.clip, natural: j.natural, epi: j.epi, maiorSaltoQuadroM: +j.maxStep.toFixed(2)});

    // 4. tackle em cima de plataforma (se o mapa tem)
    const plat = await page.evaluate(() => {const p = window.__lab.game.mapState.platforms?.[0];return p ? {x: p.pos.x, z: p.pos.z, y: p.pos.y ?? 0, h: p.height} : null;});
    if (plat) {
      n = await begin(page, `const p = L.game.mapState.platforms[0], f = L.game.fighters[0];f.position.x = p.pos.x;f.position.z = p.pos.z;f.groundY = (p.pos.y ?? 0) + (p.height ?? 1);C.actions.tackle.distance = .4;`);
      await page.waitForTimeout(300);
      await tap(page, 'KeyX');await page.waitForTimeout(250);await page.screenshot({path: tag('plataforma-1-durante')});
      await page.waitForTimeout(1500);await page.screenshot({path: tag('plataforma-2-depois')});
      d = await collect(page, n);j = judge(d, k => k === 'tackle');
      const high = j.rows.some(r => r.gy > .2);
      assert.ok(j.rows.length > 3 && (j.natural || j.ep.some(e => e.reason === 'reação de combate' || e.to === 'jump_fall' || e.to === 'fall' || e.to === 'airborne')), `${d.name}: tackle na plataforma concluiu ou saiu por queda/reação (${JSON.stringify(j.ep.slice(0, 4))})`);
      results.push(`${d.name}: tackle na plataforma (${high ? 'em cima' : 'no chão — o lutador caiu/saiu da plataforma'}) ${j.natural ? 'concluído' : 'saída por queda'}`);report.push({p: d.name, caso: 'tackle na plataforma', clip: j.clip, natural: j.natural, emCima: high});
    } else results.push(`${mine}: mapa sem plataforma — cenário de plataforma não aplicável`);

    // 5. INTERRUPÇÃO: esquiva aceita no meio da conclusão visual do tackle (clipe do tackle a 0,25× só aqui: janela larga mesmo sem GPU)
    n = await begin(page, `const ch = L.ui.characters[0];ch.speeds = {...ch.speeds, tackle: .25};`);
    await tap(page, 'KeyX');
    await page.waitForFunction(() => !!window.__lab.ui.characters[0].epilogue, null, {timeout: 4000});
    await page.screenshot({path: tag('interrupcao-1-conclusao-visual')});
    await tap(page, 'KeyC', 40);await page.waitForTimeout(60);await page.screenshot({path: tag('interrupcao-2-esquiva-assumiu')});
    await page.waitForTimeout(900);
    d = await collect(page, n);
    const cut = d.log.find(e => e.from === 'tackle' && e.epilogueEnd && e.to?.startsWith('dodge'));
    assert.ok(cut, `${d.name}: a esquiva interrompeu a conclusão visual do tackle (${JSON.stringify(d.log.slice(0, 6))})`);
    assert.ok(!d.log.some(e => e.from === 'tackle' && e.reason === 'conclusão natural'), `${d.name}: o tackle não «concluiu» depois de interrompido`);
    const iCut = d.rows.findIndex(r => r.key.startsWith('dodge')), firstDodge = d.rows[iCut];
    assert.ok(firstDodge && firstDodge.time < .2, `${d.name}: a esquiva começa do início (t=${firstDodge?.time})`);
    results.push(`${d.name}: interrupção — esquiva assumiu a conclusão visual do tackle com ${cut.playedPct} % tocado (motivo «${cut.reason}»)`);report.push({p: d.name, caso: 'interrupção por esquiva', tackleTocado: cut.playedPct, motivo: cut.reason});

    assert.deepEqual(errors, [], 'sem erros de página: ' + errors.join(' | '));
    await page.close();
  }
  writeFileSync(out + 'resultado.json', JSON.stringify(report, null, 1));
  console.log(results.map(r => '✓ ' + r).join('\n'));
  console.log('animation-conclusao-cenarios browser: ok');
} finally {await browser.close();}
