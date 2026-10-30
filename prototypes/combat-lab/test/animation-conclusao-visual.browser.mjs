// Conclusão visual no APLICATIVO REAL (dist/ aberto no navegador, renderizador real, sem cena simplificada), com Wookada e Cogumelo importados
// e a configuração salva do workspace inicial. Para cada um (como lutador 0): aperta X (tackle) com o teclado de verdade, passa a andar com a seta
// logo em seguida (movimento direcional NÃO pode cortar o clipe) e confere, pelo registro de transições do Character e pela amostra por quadro:
//   • o clipe do tackle só sai depois de chegar ao fim efetivo (≥ 95 % tocado) ou por interrupção autorizada registrada;
//   • o lutador realmente se desloca durante o clipe; nenhuma transição «interrompida» do tackle sem motivo de combate/nova ação.
// Gera capturas: último quadro mecânico, primeiro livre, andando durante o clipe, último quadro do clipe e depois (evidence/conclusao-visual/).
// Uso: node test/animation-conclusao-visual.browser.mjs (com dist/ recompilado por npm run build:combat-lab).
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync, readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('..', import.meta.url));
const out = root + 'evidence/conclusao-visual/';
mkdirSync(out, {recursive: true});
const browser = await chromium.launch({channel: 'msedge', headless: true});
const results = [];
const cogumelo = readFileSync(new URL('../../../chars/mosh/Cogumelo.glb', import.meta.url)).toString('base64');
try {
  for (const [mine, rival, curto] of [['wookada', 'cogumelo', false], ['cogumelo', 'wookada', false], ['wookada', 'cogumelo', true], ['cogumelo', 'wookada', true]]) {   // «curto»: fim mecânico do tackle bem antes do clipe, para o epílogo entrar de verdade
    const page = await browser.newPage({viewport: {width: 1400, height: 850}}), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href);
    await page.waitForFunction(() => window.__lab?.quickMenu, null, {timeout: 60000});
    // Wookada: do menu (com a configuração salva do workspace inicial); Cogumelo: carregado do .glb real (mapeamento padrão do carregamento).
    for (const [slot, name] of [[0, mine], [1, rival]]) {
      if (name === 'wookada') {
        await page.waitForFunction(() => [...document.querySelectorAll('#quick-char-0 option')].some(o => /wookada/i.test(o.textContent)), null, {timeout: 30000});
        const id = await page.evaluate(() => [...document.querySelectorAll('#quick-char-0 option')].find(o => /wookada/i.test(o.textContent)).value);
        await page.evaluate(async ([s, i]) => {await window.__lab.quickMenu.selectCharacter(s, i);}, [slot, id]);
      } else {
        await page.evaluate(async ([s, encoded]) => {const L = window.__lab, raw = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));L.setCharacter(s, await L.loadStudioFile(new File([raw], 'Cogumelo.glb')));}, [slot, cogumelo]);
      }
      await page.waitForFunction(s => window.__lab.ui.characters[s]?.clips?.length > 10, slot, {timeout: 60000});
    }
    await page.evaluate(() => {const {C} = window.__lab;C.extras.toggles.enableEnemyAI = 0;window.__lab.startMatch();});
    if (curto) await page.evaluate(() => {const {C} = window.__lab;C.actions.tackle.duration = C.test.step * 10;});
    await page.waitForTimeout(1200);
    // amostrador por quadro de render, instalado ANTES do comando
    await page.evaluate(() => {
      const L = window.__lab, rows = (window.__rows = []);
      const tick = () => {
        const ch = L.ui.characters[0], f = L.game.fighters[0];
        if (ch?.current) rows.push({t: performance.now(), key: ch.current.key, time: ch.current.action.time, dur: ch.current.clip.duration, w: ch.current.weight, epi: !!ch.epilogue, act: !!f.action, z: f.position.z, x: f.position.x, clip: ch.current.clip.name});
        window.__raf = requestAnimationFrame(tick);
      };
      tick();
    });
    const logLen = await page.evaluate(() => window.__lab.ui.characters[0].log.length);
    await page.keyboard.down('KeyX');await page.waitForTimeout(80);await page.keyboard.up('KeyX');
    await page.waitForTimeout(250);
    await page.screenshot({path: `${out}${mine}${curto ? '-curto' : ''}-1-durante-a-acao.png`});
    await page.keyboard.down('ArrowUp');   // movimento direcional comum durante a conclusão visual
    await page.waitForTimeout(350);
    await page.screenshot({path: `${out}${mine}${curto ? '-curto' : ''}-2-andando-durante-o-clipe.png`});
    await page.waitForTimeout(1600);
    await page.keyboard.up('ArrowUp');
    await page.screenshot({path: `${out}${mine}${curto ? '-curto' : ''}-3-depois-do-clipe.png`});
    const data = await page.evaluate(n => {cancelAnimationFrame(window.__raf);const ch = window.__lab.ui.characters[0];return {rows: window.__rows, log: ch.log.slice(n).map(e => ({from: e.from, to: e.to, clipFrom: e.clipFrom, playedPct: e.playedPct, reason: e.reason, interrupted: e.interrupted, epilogue: !!e.epilogue, epilogueEnd: !!e.epilogueEnd})), name: ch.source.name};}, logLen);
    const tackleRows = data.rows.filter(r => r.key === 'tackle');
    assert.ok(tackleRows.length > 5, `${data.name}: o tackle foi tocado no app real (${tackleRows.length} amostras)`);
    const exit = data.log.find(e => e.from === 'tackle' && !e.epilogue && e.to !== 'tackle');
    assert.ok(exit, `${data.name}: houve saída registrada do tackle (${JSON.stringify(data.log.slice(0, 6))})`);
    const natural = exit.playedPct >= 95 || data.log.some(e => e.epilogueEnd && e.reason === 'conclusão natural');
    assert.ok(natural && !exit.interrupted, `${data.name}: o tackle só saiu depois do fim efetivo do clipe (≥95 %: ${exit.playedPct} %, motivo «${exit.reason}», interrompido=${exit.interrupted})`);
    const lastT = Math.max(...tackleRows.map(r => r.time)), dur = tackleRows[0].dur;
    assert.ok(lastT >= dur * .9, `${data.name}: o clipe «${tackleRows[0].clip}» alcançou ${(lastT / dur * 100).toFixed(0)} % no app real`);
    if (curto) assert.ok(tackleRows.some(r => r.epi) && data.log.some(e => e.epilogue && e.reason === 'conclusão visual'), `${data.name}: com fim mecânico curto o epílogo entrou no app real`);
    const moved = Math.hypot(tackleRows.at(-1).x - tackleRows[0].x, tackleRows.at(-1).z - tackleRows[0].z);
    assert.ok(moved > .2, `${data.name}: o lutador se deslocou durante a ação (${moved.toFixed(2)} m)`);
    // Pouso no app real: pula (Espaço) e confere que o clipe «land» (se o modelo tem) vai até o fim antes da locomoção/neutro.
    if (!curto) {
      const hasLand = await page.evaluate(() => window.__lab.ui.characters[0].variantsOf('land').length > 0);
      if (hasLand) {
        const n0 = await page.evaluate(() => window.__lab.ui.characters[0].log.length);
        await page.keyboard.down('Space');await page.waitForTimeout(120);await page.keyboard.up('Space');
        await page.waitForTimeout(2200);
        const lg = await page.evaluate(n => window.__lab.ui.characters[0].log.slice(n).map(e => ({from: e.from, to: e.to, playedPct: e.playedPct, reason: e.reason, interrupted: e.interrupted})), n0);
        const landExit = lg.find(e => e.from === 'landing');
        assert.ok(landExit, `${data.name}: o clipe de pouso tocou e saiu (${JSON.stringify(lg.slice(0, 8))})`);
        assert.ok(landExit.playedPct >= 95 && !landExit.interrupted, `${data.name}: o pouso foi até o fim antes de sair (${landExit.playedPct} %, «${landExit.reason}»)`);
        results.push(`${data.name}: pouso «land» tocado até ${landExit.playedPct} % (saída «${landExit.reason}»)`);
      } else results.push(`${data.name}: sem clipe «land» configurado — pouso não aplicável`);
    }
    assert.deepEqual(errors, [], 'sem erros de página: ' + errors.join(' | '));
    results.push(`${curto ? '[fim mecânico curto] ' : ''}${data.name}: tackle «${tackleRows[0].clip}» ${tackleRows.length} amostras, ${(lastT / dur * 100).toFixed(0)} % tocado, saída «${exit.reason}», deslocamento ${moved.toFixed(2)} m, epílogo ${tackleRows.some(r => r.epi) ? 'usado' : 'não precisou'}`);
    await page.close();
  }
  console.log(results.map(r => '✓ ' + r).join('\n'));
  console.log('animation-conclusao-visual browser: ok');
} finally {await browser.close();}
