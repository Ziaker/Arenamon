// Pré-jogo com as três identidades (A Impacto · B Quadrinhos · C Clássico) no navegador (Edge real, file://, offline), sobre o menu REAL: dados do registro, estado único, troca de estilo sem
// perder escolhas, prévia 3D com modelos reais, partida com o loadout visível, teclado, movimento reduzido, estados vazios/sem WebGL e capturas em 1280×720 e 1920×1080
// (evidence/prejogo/), com comparação lado a lado contra as capturas originais dos três HUDs. Verificação TÉCNICA: a aprovação visual é do responsável.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'evidence/prejogo/';mkdirSync(out, {recursive: true});
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const hudDir = fileURLToPath(new URL('../hud-moves/evidence/', pathToFileURL(root)));
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
const report = [];let failures = 0;
const check = (label, ok, detail = '') => {report.push({label, ok: !!ok, detail: String(detail)});console.log(`${ok ? '✓' : '✗'} ${label}${detail !== '' ? ` — ${detail}` : ''}`);if (!ok) failures++;};
const b64 = f => readFileSync(new URL('../../chars/' + f, pathToFileURL(root + 'x'))).toString('base64');
const MODELS = [[0, 'mosh/Cogumelo.glb'], [1, 'drowzee/drowzee-knockback.glb']];
const browser = await chromium.launch({...BROWSER, headless: true});
const newPage = async (opts = {}, init = null) => {
  const ctx = await browser.newContext({viewport: {width: 1920, height: 1080}, ...opts});
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage(), errors = [], network = [];
  page.on('pageerror', e => errors.push(e.message + ' @ ' + String(e.stack).split(String.fromCharCode(10)).slice(1, 4).join(' | ').slice(0, 400)));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('request', r => {if (/^https?:/.test(r.url())) network.push(r.url());});page.on('dialog', d => d.accept());
  await ctx.setOffline(true);await page.goto(labUrl);await page.waitForFunction(() => window.__lab);await page.waitForTimeout(1200);
  return {page, errors, network, ctx};
};
const loadModels = async page => {
  for (const [slot, f] of MODELS) await page.evaluate(async ([slot, bytes, name]) => {const L = window.__lab, raw = Uint8Array.from(atob(bytes), c => c.charCodeAt(0));L.setCharacter(slot, await L.loadStudioFile(new File([raw], name)));}, [slot, b64(f), f.split('/')[1]]);
  await page.evaluate(() => window.__lab.quickMenu.refresh());await page.waitForTimeout(700);
};
try {
  // ======================= menu com modelos reais =======================
  const {page, errors, network, ctx} = await newPage();
  const L = (fn, arg) => page.evaluate(fn, arg);
  await loadModels(page);
  const state = () => L(() => JSON.parse(JSON.stringify(window.__lab.quickMenu.state)));
  const registry = await L(() => window.__lab.moves.listMoves?.().map(m => m.id) ?? null);
  check('o registro real de Moves está acessível e tem os 15 Moves', Array.isArray(registry) && registry.length >= 15, registry?.length);

  const sw = await L(() => [...document.querySelectorAll('.qs-sw')].map(b => ({s: b.dataset.style, role: b.getAttribute('role'), checked: b.getAttribute('aria-checked')})));
  check('o menu tem o seletor Atual · A · B · C (radiogroup) e o padrão é «Atual» (nenhum estilo oficial)', sw.length === 4 && sw.every(b => b.role === 'radio') && sw[0].checked === 'true' && sw.slice(1).every(b => b.checked === 'false'), JSON.stringify(sw.map(b => b.s + ':' + b.checked)));

  for (const st of ['a', 'b', 'c']) {
    await L(s => window.__lab.menuStyles.setStyle(s), st);await page.waitForTimeout(800);
    const r = await L(reg => {
      const root = document.getElementById('menu-styled'), q = s => [...root.querySelectorAll(s)];
      const ids = f => q(`.qs-fighter[data-fighter="${f}"] .qs-card[data-act="pick-move"]`).map(c => c.dataset.id);
      const canv = [0, 1].map(s => !!root.querySelector(`.qs-preview-slot[data-s="${s}"] #quick-preview-${s}`));
      const sp = [0, 1].map(s => q(`.qs-fighter[data-fighter="${s}"] .qs-pcard`).filter(c => c.querySelector('.qs-origin')?.textContent === 'EXCL.').map(c => c.dataset.id));
      return {visible: !root.hidden, classic: document.querySelector('.quick-fighters').hidden, ids0: ids(0).join() === reg.join(), ids1: ids(1).join() === reg.join(), canv, sp, species: [window.__lab.quickMenu.speciesOf(0), window.__lab.quickMenu.speciesOf(1)], cls: root.className};
    }, registry);
    check(`estilo ${st.toUpperCase()}: tela visível, menu atual escondido, candidatos = registro executável (azul e vermelho), canvases das prévias reparentados`, r.visible && r.classic && r.ids0 && r.ids1 && r.canv.every(Boolean), JSON.stringify(r));
    const kc = await L(() => {const col = sel => new Set([...document.querySelectorAll(`.qs-fighter[data-fighter="0"] ${sel}`)].map(c => getComputedStyle(c).getPropertyValue('--kc').trim()));return {moves: [...col('.qs-card[data-act="pick-move"]')], passives: [...col('.qs-pcard')]};});
    check(`estilo ${st.toUpperCase()}: Moves em 4 cores (Normal · Burst · Charge · Destino) e passivas em 2 (Permanente · Gatilho), todas diferentes entre si`, kc.moves.length === 4 && kc.passives.length === 2 && kc.moves.every(Boolean) && kc.passives.every(Boolean), JSON.stringify(kc));
    check(`estilo ${st.toUpperCase()}: passivas exclusivas só da espécie atual (azul ${r.species[0]}, vermelho ${r.species[1]}) e genéricas sempre`, r.species[0] === 'mush' && r.species[1] === 'drowzee' && r.sp[0].length === 2 && r.sp[1].length === 2, JSON.stringify(r.sp));
  }

  // ======================= seleção por clique no estilo A (estado único) =======================
  await L(s => window.__lab.menuStyles.setStyle(s), 'a');await page.waitForTimeout(500);
  const card = (s, id) => `.qs-fighter[data-fighter="${s}"] .qs-card[data-id="${id}"]`;
  await page.click('.qs-fighter[data-fighter="0"] .qs-slot-main[data-i="0"] ~ .qs-clear');await page.click('.qs-fighter[data-fighter="0"] .qs-slot-main[data-i="1"] ~ .qs-clear');   // esvazia reflect e psyshock
  await page.click(card(0, 'quick-attack'));await page.click(card(0, 'harden'));
  let s1 = await state();
  const lo = await L(() => window.__lab.game.loadouts?.[0] ?? window.__lab.game.fighters[0].loadout);
  check('clicar nas cartas põe os Moves nos slots (estado único) e o loadout do jogo acompanha', s1.moves[0][0] === 'quick-attack' && s1.moves[0][1] === 'harden' && lo[0] === 'quick-attack' && lo[1] === 'harden', JSON.stringify({estado: s1.moves[0], jogo: lo}));
  await page.click('.qs-fighter[data-fighter="0"] .qs-slot-main[data-i="3"]');await page.click(card(0, 'harden'));   // o mesmo Move noutro slot: sai do anterior
  s1 = await state();
  check('o mesmo Move não ocupa dois slots do mesmo lutador (o antigo esvazia)', s1.moves[0].filter(x => x === 'harden').length === 1, JSON.stringify(s1.moves[0]));
  const bad = await L(() => [window.__lab.quickMenu.setMove(0, 2, 'move-inexistente'), window.__lab.quickMenu.setPassive(0, 0, 'passiva-inexistente'), window.__lab.quickMenu.setMove(0, 9, 'harden')]);
  check('ids inválidos (Move/passiva inexistente, slot fora da faixa) são recusados', bad.every(x => x === false), JSON.stringify(bad));
  await page.click('.qs-fighter[data-fighter="0"] .qs-pcard[data-id="effect-spore"]');await page.click('.qs-fighter[data-fighter="0"] .qs-pcard[data-id="sturdy"]');
  await page.click('.qs-fighter[data-fighter="0"] .qs-pcard:not([data-id="effect-spore"]):not([data-id="sturdy"]) >> nth=0');
  s1 = await state();
  check('passivas: no máximo 2, distintas, a mais antiga cede quando não há espaço', s1.passives[0].filter(Boolean).length === 2 && new Set(s1.passives[0]).size === 2, JSON.stringify(s1.passives[0]));
  await page.hover(card(0, 'quick-attack'));
  const det = await L(() => document.querySelector('.qs-fighter[data-fighter="0"] .qs-detail')?.textContent ?? '');
  check('a caixa de detalhe mostra a descrição REAL e o uso (custo e recarga do Move efetivo)', /Custo \d+\.\d{2} de stamina · recarga \d+\.\d s/.test(det) && det.length > 60, det.slice(0, 140));
  const hoverP = await (async () => {await page.hover('.qs-fighter[data-fighter="0"] .qs-pcard[data-id="effect-spore"]');return L(() => document.querySelector('.qs-fighter[data-fighter="0"] .qs-detail')?.textContent ?? '');})();
  check('a passiva mostra gatilho, efeito, origem (exclusiva/genérica) e «experimental»', /Gatilho:/.test(hoverP) && /Efeito:/.test(hoverP) && /Exclusiva \(mush\)/.test(hoverP) && /experimental/.test(hoverP), hoverP.slice(0, 120));
  const fx0 = await L(() => window.__lab.menuStyles.fxStats);
  check('three.quarks: cada seleção dispara rajadas na cena da prévia (contagem emitida > 0)', (fx0[0]?.emitted ?? 0) >= 3, JSON.stringify(fx0));

  // ======================= troca A→B→C→A não altera nada =======================
  const snap = () => L(() => ({collect: window.__lab.quickMenu.collect(), tick: window.__lab.game.tick, phase: window.__lab.game.phase, lo: [0, 1].map(i => [...(window.__lab.game.fighters[i].loadout ?? [])]), hp: window.__lab.game.fighters.map(f => f.hp), srcs: window.__lab.ui?.sources?.map(s => s?.name ?? null)}));
  const before = await snap();
  for (const st of ['b', 'c', 'a', 'none', 'c', 'b', 'a']) {await L(s => window.__lab.menuStyles.setStyle(s), st);await page.waitForTimeout(250);}
  const after = await snap();
  check('A→B→C→A (e passando por «Atual»): seleções, loadout do jogo, tick, fase e vida idênticos — nenhum reset, nenhuma partida iniciada', JSON.stringify(before) === JSON.stringify(after) && after.phase === 'menu', JSON.stringify({fase: after.phase, tick: after.tick}));
  const stored = await L(() => localStorage.getItem('arenamon.menuStyle'));
  check('só a preferência de estilo é guardada (nenhum loadout por tema)', stored === 'a' && !(await L(() => Object.keys(localStorage).some(k => /menuStyle.*(moves|passives)|loadout.*tema/i.test(k)))), stored);

  // ======================= teclado =======================
  await page.focus(card(1, 'harden'));await page.keyboard.press('ArrowRight');
  const focusedId = await L(() => document.activeElement?.dataset?.id ?? null);
  check('teclado: setas percorrem as cartas (foco rotativo) e o foco é visível', focusedId && focusedId !== 'harden', focusedId);
  await page.keyboard.press('Enter');
  const kb = await state();
  check('teclado: Enter na carta focada atribui ao slot do lutador vermelho (estado único)', !!focusedId && kb.moves[1].includes(focusedId), JSON.stringify(kb.moves[1]));
  const outline = await L(() => {const cs = getComputedStyle(document.activeElement);return cs.outlineStyle + '|' + cs.backgroundColor;});
  check('o foco do teclado é visível (contorno; no estilo A, onde o recorte corta o contorno, fundo amarelo)', !outline.startsWith('none') || outline.endsWith('rgb(255, 212, 0)'), outline);
  await page.focus('.qs-sw[data-style="a"]');await page.keyboard.press('ArrowRight');
  check('teclado: setas no seletor de estilo trocam A → B (grupo de rádio)', (await L(() => window.__lab.menuStyles.style)) === 'b');
  await L(s => window.__lab.menuStyles.setStyle(s), 'a');

  // ======================= robustez (revisão de código) =======================
  const rob = await L(async () => {
    const q = window.__lab.quickMenu, evs = [];const off = q.onChange(e => evs.push(e.type + ':' + e.slot));
    await q.selectCharacter(0, null);off();
    let n = 0;const p = q.previews[0];p.onTick(() => {throw new Error('gancho de teste');});p.onTick(() => {n++;});
    await new Promise(r => setTimeout(r, 400));
    return {evs, sel: document.getElementById('quick-char-0').value, ticks: n};
  });
  check('«Carregado» (selectCharacter null) emite a mudança e mantém o <select> nativo em sincronia; um gancho que lança não para a prévia', rob.evs.includes('char:0') && rob.sel === '' && rob.ticks >= 3, JSON.stringify(rob));
  await page.click('.qs-fighter[data-fighter="0"] .qs-slot-main[data-i="0"]');   // arma o slot 1 (sai do «armado» ao esvaziar)
  const clearSel = '.qs-fighter[data-fighter="0"] .qs-slot:has(.qs-slot-main[data-i="0"]) .qs-clear';
  if (await page.locator(clearSel).count()) {await page.focus(clearSel);await page.keyboard.press('Enter');}
  const foc = await L(() => ({inMenu: !!document.activeElement?.closest?.('#menu-styled'), tag: document.activeElement?.className}));
  check('esvaziar um slot pelo teclado não joga o foco para fora do menu (o foco volta ao botão do mesmo slot)', foc.inMenu, JSON.stringify(foc));
  await L(() => {window.__lab.quickMenu.setMove(0, 0, 'reflect');});

  // ======================= partida integrada =======================
  const chosen = await state();
  await page.click('#start-center');await page.waitForTimeout(5000);
  const play = await L(() => ({phase: window.__lab.game.phase, lo: [0, 1].map(i => [...(window.__lab.game.fighters[i].loadout ?? [])]), pas: window.__lab.game.fighters.map(f => (f.passiveState?.loadout ?? f.passives ?? null))}));
  check('Iniciar combate usa EXATAMENTE as escolhas visíveis (Moves dos dois lutadores no motor)', play.phase === 'playing' && JSON.stringify(play.lo[0]) === JSON.stringify(chosen.moves[0]) && JSON.stringify(play.lo[1]) === JSON.stringify(chosen.moves[1]), JSON.stringify(play.lo));
  const pcheck = await L(() => window.__lab.game.fighters.map(f => JSON.stringify(f.passiveState?.loadout ?? f.passives ?? null)));
  check('as passivas escolhidas chegam ao motor (mesmo conjunto)', JSON.stringify(JSON.parse(pcheck[0] ?? '[]')?.slice?.().sort?.() ?? []) === JSON.stringify([...chosen.passives[0].filter(Boolean)].sort()), pcheck[0]);
  await page.keyboard.press('Escape');await page.waitForTimeout(200);
  await L(() => {document.getElementById('back')?.click();});await page.waitForTimeout(500);
  const back = await L(() => ({phase: window.__lab.game.phase, style: window.__lab.menuStyles.style, vis: !document.getElementById('menu-styled').hidden, st: window.__lab.quickMenu.collect()}));
  check('voltar ao menu mantém o estilo e a seleção; a tela reflete o estado atual', back.phase === 'menu' && back.style === 'a' && back.vis && JSON.stringify(back.st.moves) === JSON.stringify(chosen.moves), JSON.stringify({fase: back.phase, estilo: back.style}));
  await page.waitForTimeout(300);

  // ======================= movimento reduzido =======================
  await page.emulateMedia({reducedMotion: 'reduce'});await page.waitForTimeout(200);
  const rm = await L(() => {const st = document.querySelector('.qs-status'), before = (window.__lab.menuStyles.fxStats[0]?.emitted ?? 0);window.__lab.quickMenu.setMove(0, 2, 'bounce');return {anim: getComputedStyle(st).animationName, before, after: window.__lab.menuStyles.fxStats[0]?.emitted ?? 0};});
  check('prefers-reduced-motion: sem animações CSS e sem rajadas three.quarks (a seleção segue legível por forma, cor e texto)', (rm.anim === 'none' || rm.anim === '') && rm.after === rm.before, JSON.stringify(rm));
  await page.emulateMedia({reducedMotion: 'no-preference'});

  // ======================= capturas, responsividade e fidelidade =======================
  await L(() => {window.__lab.quickMenu.setMove(0, 2, null);});
  for (const [w, h] of [[1280, 720], [1920, 1080]]) {
    await page.setViewportSize({width: w, height: h});await page.waitForTimeout(400);
    for (const st of ['a', 'b', 'c']) {
      await L(s => window.__lab.menuStyles.setStyle(s), st);await page.waitForTimeout(900);
      await page.screenshot({path: `${out}pre-jogo-${st.toUpperCase()}-${w}x${h}.png`});
      if (w === 1920) await page.locator('.quick-start-card').screenshot({path: `${out}pre-jogo-${st.toUpperCase()}-cartao-1920.png`});
      const ov = await L(() => {const c = document.querySelector('.quick-start-card'), r = c.getBoundingClientRect(), m = document.getElementById('menu').getBoundingClientRect();return {over: c.scrollWidth - c.clientWidth, inside: r.left >= m.left - 1 && r.right <= m.right + 1, btn: (() => {const b = document.getElementById('start-center').getBoundingClientRect();return b.width > 0 && b.height > 0 ? true : JSON.stringify([b.width, b.height, document.getElementById('menu').hidden, getComputedStyle(document.getElementById('start-center')).display, window.__lab.game.phase]);})()};});
      check(`${w}×${h} estilo ${st.toUpperCase()}: sem rolagem horizontal, dentro da área do menu, botão Iniciar acessível`, ov.over <= 1 && ov.inside && ov.btn === true, JSON.stringify(ov));
    }
  }
  await page.setViewportSize({width: 960, height: 640});await page.waitForTimeout(400);
  await L(s => window.__lab.menuStyles.setStyle(s), 'b');await page.waitForTimeout(700);
  const small = await L(() => {const c = document.querySelector('.quick-start-card');return {over: c.scrollWidth - c.clientWidth, cols: getComputedStyle(document.querySelector('.qs-fighters')).gridTemplateColumns.split(' ').length, tpl: getComputedStyle(document.querySelector('.qs-fighters')).gridTemplateColumns, w: document.getElementById('menu-styled').getBoundingClientRect().width};});
  await page.screenshot({path: `${out}pre-jogo-B-viewport-reduzida-960x640.png`});
  check('viewport reduzida (960×640): um lutador por linha, sem rolagem horizontal', small.cols === 1 && small.over <= 1, JSON.stringify(small));
  await page.setViewportSize({width: 1920, height: 1080});

  // lado a lado com as capturas originais
  const cmp = await ctx.newPage();
  for (const [st, orig] of [['A', 'hudA-neutro-720p.png'], ['B', 'hudB-neutro-720p.png'], ['C', 'hudC-neutro-720p.png']]) {
    const o = readFileSync(hudDir + orig).toString('base64'), n = readFileSync(`${out}pre-jogo-${st}-cartao-1920.png`).toString('base64');
    await cmp.setViewportSize({width: 1900, height: 700});
    await cmp.setContent(`<body style="margin:0;background:#070b16;color:#eef3ff;font:13px Segoe UI"><div style="display:flex;gap:10px;padding:8px;align-items:flex-start"><figure style="margin:0"><figcaption style="padding:4px 0">Original: HUD ${st} (prototypes/hud-moves/evidence/${orig})</figcaption><img style="width:820px" src="data:image/png;base64,${o}"></figure><figure style="margin:0"><figcaption style="padding:4px 0">Novo: tela de seleção ${st} (1920×1080, cartão do menu)</figcaption><img style="width:1050px" src="data:image/png;base64,${n}"></figure></div></body>`);
    await cmp.waitForTimeout(300);await cmp.screenshot({path: `${out}fidelidade-${st}-original-x-novo.png`});
  }
  await cmp.close();
  check('capturas 720p/1080p das três telas e as três comparações lado a lado com os HUDs originais foram geradas', ['A', 'B', 'C'].every(s => existsSync(`${out}pre-jogo-${s}-1280x720.png`) && existsSync(`${out}pre-jogo-${s}-1920x1080.png`) && existsSync(`${out}fidelidade-${s}-original-x-novo.png`)));
  const realErrors = errors.filter(e => !/gancho de teste/.test(e));   // o gancho que lança é proposital (teste de robustez)
  check('sem erros de página e sem rede externa (menu com modelos, partida de 5 s incluída)', realErrors.length === 0 && network.length === 0, realErrors.concat(network).join(' | '));
  await ctx.close();

  // ======================= sem modelo salvo / carregado =======================
  const e2 = await newPage();
  await e2.page.evaluate(() => window.__lab.menuStyles.setStyle('c'));await e2.page.waitForTimeout(600);
  const empty = await e2.page.evaluate(() => ({visible: !document.getElementById('menu-styled').hidden, noModel: [...document.querySelectorAll('.qs-nomodel')].map(n => !n.hidden), note: document.querySelector('.qs-note')?.textContent, name: document.querySelector('.qs-charname')?.textContent, cards: document.querySelectorAll('.qs-card').length}));
  check('sem personagem carregado nem salvo: a tela abre, avisa «prévia indisponível» e não fabrica modelo nem seleção', empty.visible && empty.noModel.every(Boolean) && /Nenhum personagem salvo/.test(empty.note) && /Sem modelo/.test(empty.name) && empty.cards > 20, JSON.stringify(empty));
  check('sem modelo: sem erros de página', e2.errors.length === 0, e2.errors.join(' | '));
  await e2.ctx.close();

  // ======================= WebGL indisponível nas prévias =======================
  const e3 = await newPage({}, () => {const g = HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext = function(t, ...a) {if (/^quick-preview/.test(this.id) && /webgl/.test(t)) return null;return g.call(this, t, ...a);};});
  await e3.page.evaluate(() => window.__lab.menuStyles.setStyle('b'));await e3.page.waitForTimeout(600);
  const nogl = await e3.page.evaluate(() => {window.__lab.quickMenu.setMove(0, 2, 'swift');return {ok: window.__lab.quickMenu.previews.map(p => p.ok), noModel: [...document.querySelectorAll('.qs-nomodel')].map(n => !n.hidden), move: window.__lab.quickMenu.state.moves[0][2], fx: window.__lab.menuStyles.fxStats};});
  check('WebGL indisponível nas prévias: o menu segue funcional (seleção por clique/estado) e mostra «prévia 3D indisponível»', nogl.ok.every(x => !x) && nogl.noModel.every(Boolean) && nogl.move === 'swift' && nogl.fx.every(x => x === null), JSON.stringify(nogl));
  check('WebGL indisponível: sem exceções de página', e3.errors.filter(e => !/WebGL|context/i.test(e)).length === 0, e3.errors.join(' | '));
  await e3.ctx.close();

  writeFileSync(out + 'resultado.json', JSON.stringify({report, failures}, null, 2) + '\n');
  console.log(failures ? `\n${failures} falha(s)` : `\n${report.length} verificações aprovadas (evidence/prejogo/).`);
  if (failures) process.exitCode = 1;
} finally {await browser.close();}
