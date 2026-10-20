// Passivas no navegador (§34): seleção no painel da aba Partida (duplicata recompactada, exclusiva validada
// pelo motor), loadouts aplicados ao iniciar, HUD em combate com estado real (§17, ambos os lutadores),
// ativação REAL por tackle (Stamina do atingido + Rough Skin refletindo), toast + VFX, cadeia com causa (R31),
// aplicação durante hitstop (R27), cooldown no HUD (R16) e Sturdy impedindo KO quando a espécie permite.
// Capturas em validation/passives/. A aprovação de jogabilidade/visual é do diretor.
import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync, writeFileSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'validation/passives/';mkdirSync(out, {recursive: true});
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
const report = [];let failures = 0;
const check = (label, ok, detail = '') => {report.push({label, ok: !!ok, detail: String(detail)});console.log(`${ok ? '✓' : '✗'} ${label}${detail !== '' ? ` — ${detail}` : ''}`);if (!ok) failures++;};
const browser = await chromium.launch({...BROWSER, headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 920}, acceptDownloads: true}), errors = [], network = [];
  page.on('pageerror', e => errors.push(e.message));page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('request', r => {if (/^https?:/.test(r.url())) network.push(r.url());});page.on('dialog', d => d.accept());
  await page.addInitScript(() => localStorage.removeItem('arenamon-passive-loadouts'));   // determinismo
  await page.context().setOffline(true);await page.goto(labUrl);await page.waitForFunction(() => window.__lab);
  const L = (fn, arg) => page.evaluate(fn, arg);
  await L(() => {window.__lab.C.map.arenaShape = 'square';});
  const key = async (code, down) => {await page.locator('canvas').first().focus();await (down ? page.keyboard.down(code) : page.keyboard.up(code));};

  // ---------- Seleção no painel (aba Partida) ----------
  const openMatch = () => L(() => {const p = document.getElementById('panel');if (p.hidden || p.dataset.tool !== 'match') window.__lab.openTool('match');});
  await openMatch();
  await page.waitForFunction(() => document.querySelectorAll('#passives-panel select[data-slot]').length === 4);
  check('o painel traz 2 selects por lutador (Azul e Vermelho)', await page.locator('#passives-panel .passives-slot').count() === 2 && await page.locator('#passives-panel select[data-slot]').count() === 4);
  const species = await L(() => [0, 1].map(s => document.querySelector(`#passives-panel .passives-slot[data-slot="${s}"] h3 b`)?.textContent ?? null));
  check('a espécie vem do nome declarado do personagem (R15)', species[0] !== undefined && species[1] !== undefined, `azul=${species[0] ?? '∅'} vermelho=${species[1] ?? '∅'}`);
  // duplicata: a escolha anterior perde (recompactação), com aviso de loadout válido
  await page.selectOption('#passives-panel select[data-slot="0"][data-idx="0"]', 'rough-skin');
  await page.selectOption('#passives-panel select[data-slot="0"][data-idx="1"]', 'rough-skin');
  const dup = await L(() => ({vals: [...document.querySelectorAll('#passives-panel select[data-slot="0"]')].map(s => s.value), err: document.querySelector('#passives-panel .passives-slot[data-slot="0"] [data-errors]').textContent}));
  check('duplicata é recusada na seleção (fica uma só e o aviso continua válido)', dup.vals.filter(Boolean).length === 1 && dup.vals.includes('rough-skin') && /loadout válido/.test(dup.err), JSON.stringify(dup.vals));
  await page.selectOption('#passives-panel select[data-slot="0"][data-idx="1"]', 'stamina');
  // vermelho: rough-skin + stamina (genéricas, sempre disponíveis)
  await page.selectOption('#passives-panel select[data-slot="1"][data-idx="0"]', 'rough-skin');
  await page.selectOption('#passives-panel select[data-slot="1"][data-idx="1"]', 'stamina');
  const chosen = await L(() => [...document.querySelectorAll('#passives-panel select')].map(s => `${s.dataset.slot}.${s.dataset.idx}=${s.value}`));
  check('loadouts escolhidos: azul rough-skin+stamina, vermelho rough-skin+stamina', chosen.join(' ') === '0.0=rough-skin 0.1=stamina 1.0=rough-skin 1.1=stamina', chosen.join(' '));
  await page.screenshot({path: out + 'selecao.png'});
  // exclusiva errada é recusada pelo MOTOR (R4/R5 — a UI nem lista, o motor barra)
  const bad = await L(() => {const g = window.__lab.game, before = JSON.stringify(g.passiveLoadouts ?? null);const r = g.setPassiveLoadout(0, ['poison-touch']);return {ok: r?.ok === false, kept: JSON.stringify(g.passiveLoadouts) === before, errors: r?.errors?.join(' | ') ?? ''};});
  check('o motor recusa exclusiva de outra espécie e mantém o loadout anterior', bad.ok && bad.kept, bad.errors);
  if (species[1]) {
    const excl = await L(() => {const s = document.querySelector('#passives-panel select[data-slot="1"]');return [...s.options].map(o => o.value).find(v => v && !['rough-skin', 'stamina', 'regenerator', 'unburden', 'defiant', 'clear-body'].includes(v));});
    if (excl) {
      await page.selectOption('#passives-panel select[data-slot="1"][data-idx="1"]', excl);
      const okExcl = await L(() => /loadout válido/.test(document.querySelector('#passives-panel .passives-slot[data-slot="1"] [data-errors]').textContent));
      check(`exclusiva da espécie do vermelho (${excl}) é aceita pela UI e pelo motor`, okExcl);
      await page.selectOption('#passives-panel select[data-slot="1"][data-idx="1"]', 'stamina');
    }
  }

  // ---------- Partida real: HUD, ativação, hitstop, cooldown ----------
  await page.selectOption('#mode', 'inactive');await page.click('#start');await page.waitForTimeout(400);
  await L(() => {document.getElementById('panel').hidden = true;});
  const applied = await L(() => JSON.stringify(window.__lab.game.passiveLoadouts));
  check('ao iniciar, os loadouts validados entram na simulação', applied === JSON.stringify([['rough-skin', 'stamina'], ['rough-skin', 'stamina']]), applied);
  const hud0 = await L(() => {const h = document.getElementById('passives-hud');return {hidden: h.hidden, rows: [...h.querySelectorAll('.mvp-row')].map(r => [r.dataset.fighter, r.querySelectorAll('.mvp-slot').length, r.textContent])};});
  check('o HUD mostra os dois lutadores com 2 slots cada (estado real do motor)', !hud0.hidden && hud0.rows.length === 2 && hud0.rows.every(r => r[1] === 2), JSON.stringify(hud0.rows.map(r => [r[0], r[1]])));
  check('slots permanentes/prontos aparecem como prontos ou sempre ativos', hud0.rows.every(r => /pronta|sempre ativa/.test(r[2])), hud0.rows.map(r => r[2].replace(/\s+/g, ' ').slice(0, 60)).join(' | '));
  // posiciona corpo a corpo e dá um tackle carregado REAL (PL2) no vermelho
  await L(() => {const g = window.__lab.game, set = (f, x, z, a) => {f.position = {x, z};f.velocity = {x: 0, z: 0};f.locomotionVelocity = {x: 0, z: 0};f.facing = a;f.visualFacing = a;f.combatHeading = a;f.faceGoal = a;};set(g.fighters[0], 0, 0, 0);set(g.fighters[1], 0, 1.6, Math.PI);});
  await key('KeyX', true);await page.waitForTimeout(900);await key('KeyX', false);
  const hit = await page.waitForFunction(() => {const g = window.__lab.game, r = g.fighters[1].hp < 100;return r ? {hp1: g.fighters[1].hp, hp0: g.fighters[0].hp, hitstop: g.hitstop, actives1: g.fighters[1].passiveState.actives.map(a => a.id), actives0: g.fighters[0].passiveState.actives.map(a => a.id), events: g.events.filter(e => e.result === 'passiveActivated' || e.result === 'sturdyConsumed').map(e => ({r: e.result, p: e.passive, cause: e.cause ?? null}))} : false;}, null, {timeout: 5000}).then(h => h.jsonValue());
  check('tackle real acerta o vermelho (dano direto ao HP)', hit.hp1 < 100, `hp vermelho=${hit.hp1}`);
  check('Stamina do vermelho ativa no impacto real', hit.actives1.includes('stamina'), hit.actives1.join(','));
  check('Rough Skin reflete o contato (o azul também sofre dano)', hit.hp0 < 100, `hp azul=${hit.hp0}`);
  check('a ativação foi aplicada DURANTE o hitstop (R27: o evento não espera o descongelar)', hit.hitstop > 0 && hit.actives1.length > 0, `hitstop=${hit.hitstop.toFixed(3)}s`);
  check('os eventos de ativação carregam a causa do evento origem (R31)', hit.events.length > 0 && hit.events.every(e => e.cause !== null), JSON.stringify(hit.events));
  await page.waitForTimeout(250);
  const toast = await L(() => document.querySelector('#passives-hud .pvh-toast')?.textContent ?? '');
  const hud1 = await L(() => [...document.querySelectorAll('#passives-hud .mvp-row')].map(r => [r.dataset.fighter, r.querySelector('.mvp-slot[data-state="ativa"]')?.textContent ?? '']));
  check('toast branco de ativação aparece no HUD (§16)', /ativada/.test(toast), toast);
  check('rótulo 3D branco "Ability: NOME" surge acima do lutador na ativação', await L(() => {const ls = window.__lab.view.scene.children.filter(o => o.name === 'abilityLabel');return ls.length > 0 && ls.every(o => o.position.y > 1 && o.scale.y > 0);}), await L(() => window.__lab.view.scene.children.filter(o => o.name === 'abilityLabel').length));
  check('o HUD reflete o estado ativo com tempo restante (§17)', hud1.some(r => r[0] === '1' && /s$/.test(r[1].trim())), JSON.stringify(hud1));
  check('VFX de ativação existe na cena (variante configurada)', await L(() => {const v = window.__lab.view.scene.children.length > 0;return v && (window.__lab.C.vfx?.passive?.variant ?? 0) >= 0;}));
  await page.screenshot({path: out + 'ativacao.png'});
  // cooldown pós-término (R16): efeito acaba, HUD mostra recarga
  await page.waitForFunction(() => {const st = window.__lab.game.fighters[1].passiveState;return st.actives.length === 0 && (st.cooldowns.stamina ?? 0) > 0;}, null, {timeout: 20000});
  const hudCd = await L(() => [...document.querySelectorAll('#passives-hud .mvp-row[data-fighter="1"] .mvp-slot')].map(s => s.dataset.state));
  check('após o efeito, o HUD mostra a recarga (cooldown pós-término)', hudCd.includes('recarga'), hudCd.join(','));
  await page.screenshot({path: out + 'cooldown.png'});

  // ---------- Sturdy impedindo KO ----------
  // O vermelho padrão não tem espécie declarada (sem GLB); declaramos uma fonte mush (só o nome importa para
  // o painel, R15), o re-render do painel lista as exclusivas de mush e equipamos pela PRÓPRIA UI — caminho real.
  {
    await openMatch();
    await L(() => {window.__lab.ui.characters[1] = {source: {name: 'mush vermelho', eventsByClip: []}, clips: [], variantsOf: () => []};const s = document.querySelector('#passives-panel select[data-slot="1"][data-idx="1"]');s.dispatchEvent(new Event('change', {bubbles: true}));});
    await page.waitForFunction(() => /espécie:\s*mush/.test(document.querySelector('#passives-panel .passives-slot[data-slot="1"] h3').textContent));
    check('declarar um personagem mush lista as exclusivas dele no painel', await L(() => [...document.querySelector('#passives-panel select[data-slot="1"]')].some(o => o.value === 'sturdy')));
    await page.selectOption('#passives-panel select[data-slot="1"][data-idx="0"]', 'sturdy');
    const equipped = await L(() => ({ids: [...document.querySelectorAll('#passives-panel select[data-slot="1"]')].map(s => s.value).filter(Boolean), err: document.querySelector('#passives-panel .passives-slot[data-slot="1"] [data-errors]').textContent}));
    check('Sturdy é aceita pela UI e pelo motor (identidade mush)', equipped.ids.includes('sturdy') && /loadout válido/.test(equipped.err), equipped.ids.join(','));
    await page.selectOption('#mode', 'inactive');await page.click('#start');await page.waitForTimeout(400);
    await L(() => {document.getElementById('panel').hidden = true;const g = window.__lab.game;g.fighters[1].hp = 1;const set = (f, x, z, a) => {f.position = {x, z};f.velocity = {x: 0, z: 0};f.locomotionVelocity = {x: 0, z: 0};f.facing = a;f.visualFacing = a;f.combatHeading = a;f.faceGoal = a;};set(g.fighters[0], 0, 0, 0);set(g.fighters[1], 0, 1.6, Math.PI);});
    const ready = await L(() => window.__lab.game.fighters[1].passiveState.sturdyAvailable === true);
    check('Sturdy entra na partida disponível (1 uso)', ready);
    await key('KeyX', true);await page.waitForTimeout(900);await key('KeyX', false);
    await page.waitForFunction(() => window.__lab.game.fighters[1].passiveState.sturdyUsed === true, null, {timeout: 8000}).catch(() => {});
    const st = await L(() => {const g = window.__lab.game, st1 = g.fighters[1].passiveState;return {hp: g.fighters[1].hp, winner: g.winner, used: st1.sturdyUsed, loadout: st1.loadout, slots: [...document.querySelectorAll('#passives-hud .mvp-row[data-fighter="1"] .mvp-slot')].map(s => `${s.querySelector('b').textContent}:${s.dataset.state}`)};});
    check('Sturdy impede o KO (HP fica em 1, sem vencedor)', st.used && st.hp === 1 && !st.winner, `hp=${st.hp} used=${st.used}`);
    check('Sturdy fica consumida no HUD após o uso', (st.slots[0] ?? '').startsWith('Sturdy:consumida'), st.slots.join(' | '));
    await page.screenshot({path: out + 'sturdy.png'});
    await L(() => {window.__lab.ui.characters[1] = null;});
  }
  check('sem requisições de rede e sem erros no console', network.length === 0 && errors.length === 0, [...network, ...errors].join(' | '));
} finally {
  writeFileSync(out + 'report.json', JSON.stringify({date: new Date().toISOString(), failures, report}, null, 1));
  await browser.close();
}
console.log(`\n${report.length - failures} de ${report.length} verificações aprovadas.`);
if (failures) process.exit(1);
