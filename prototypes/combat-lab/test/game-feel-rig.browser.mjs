// Game feel 8 e 9 num GLB real (Mushroom): as camadas de pé e olhar rodam sem erro, sem NaN, dentro dos limites, e desligadas não mudam a pose.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = new URL('../', import.meta.url);
const browser = await chromium.launch({channel: process.env.ARENAMON_BROWSER || 'msedge', headless: true});
const page = await browser.newPage({viewport: {width: 1280, height: 800}});
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
try {
  await page.goto(pathToFileURL(fileURLToPath(new URL('dist/arenamon-combate-laboratorio.html', root))).href);
  await page.waitForFunction(() => window.__lab);
  const bytes = readFileSync(new URL('../../chars/mosh/Cogumelo.glb', root)).toString('base64');
  const r = await page.evaluate(async encoded => {
    const L = window.__lab, raw = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    L.setCharacter(0, await L.loadStudioFile(new File([raw], 'Cogumelo.glb')));
    const ch = L.ui.characters[0], f = L.game.fighters[0], foe = L.game.fighters[1], G = L.C.extras.gameFeel;
    const bones = () => {const out = {};ch.model.updateMatrixWorld(true);ch.model.traverse(o => {if (o.isBone) {const p = o.getWorldPosition(o.position.clone());out[o.name] = [p.x, p.y, p.z];}});return out;};
    const frames = (n, ctx = {}) => {for (let i = 0; i < n; i++) ch.update(f, 1 / 60, f.groundY ?? 0, [], {tick: i, fighters: L.game.fighters, ...ctx});};
    const drift = (a, b) => Math.max(...Object.keys(a).map(k => Math.hypot(a[k][0] - b[k][0], a[k][1] - b[k][1], a[k][2] - b[k][2])));
    f.groundY = 0;f.flight = null;f.action = null;f.state = 'neutral';f.position.x = 0;f.position.z = 0;
    // 1) desligado: a pose é a mesma de nunca ter existido a camada.
    G.footOn = 0;G.trackOn = 0;frames(20);const base = bones();
    const none = ch.rigLayers ? 'criada' : 'nao-criada';
    // 2) pés ligados num degrau de 0,08 m sob o pé esquerdo/direito: ficam finitos, limitados e mudam a pose.
    G.footOn = 1;G.footMaxCorrection = .12;
    frames(40, {ground: (x, z) => x > 0 ? .08 : 0});
    const feet = bones(), diag = ch.rigDiagnostic(), footDrift = drift(base, feet);
    const finite = Object.values(feet).every(p => p.every(Number.isFinite));
    const lengths = (() => {const lg = ch.rigLayers.legs;const L = s => lg[s] ? [lg[s].up, lg[s].low, lg[s].foot].map(b => b.name) : null;return {l: L('l'), r: L('r')};})();
    // 3) olhar: rival ao lado com um Move travado; o efeito da camada = pose com ela menos a mesma pose sem ela (mesmo instante da animação).
    G.footOn = 0;G.trackOn = 1;G.trackHeadYaw = 45;G.trackTorso = 0;G.trackSmooth = .03;
    foe.position.x = 1.8;foe.position.z = 3;foe.hp = 100;
    f.facing = 0;f.visualFacing = 0;f.action = {kind: 'move', move: 'x', elapsed: 0, lock: foe.id, hits: new Set(), heading: 0};
    frames(60);const tracked = bones(), tw = ch.rigLayers.tw;
    ch.rigLayers.tw = 0;ch.rigLayers.ty = 0;ch.rigLayers.tp = 0;G.trackOn = 0;ch.update(f, 0, 0, [], {tick: 999, fighters: L.game.fighters});
    const plain = bones(), trackEffect = drift(tracked, plain);
    // 4) sem alvo travado a camada solta e some (tw → 0) sem estalo.
    G.trackOn = 1;f.action = {kind: 'move', move: 'x', elapsed: 0, lock: foe.id, hits: new Set(), heading: 0};frames(30);f.action = null;frames(90);
    const twAfter = ch.rigLayers.tw;
    // 5) pausa (dt = 0): repetir o quadro não acumula rotação (paridade de replay e de inspeção quadro a quadro).
    G.footOn = 1;G.trackOn = 1;f.action = {kind: 'move', move: 'x', elapsed: 0, lock: foe.id, hits: new Set(), heading: 0};frames(30);
    const paused = n => {for (let i = 0; i < n; i++) ch.update(f, 0, f.groundY ?? 0, [], {tick: 5000, fighters: L.game.fighters, ground: (x) => x > 0 ? .08 : 0});return bones();};
    const p1 = paused(1), p2 = paused(40), pauseDrift = drift(p1, p2);
    return {none, footDrift, finite, diag, lengths, trackEffect, tw, twAfter, pauseDrift, issues: ch.rigLayers.issues};
  }, bytes);
  console.log(JSON.stringify(r, null, 2));
  assert.equal(r.none, 'nao-criada', 'sem os interruptores a camada nem é criada');
  assert.ok(r.finite, 'nenhum osso com NaN/Infinity');
  assert.ok(r.diag.includes('Pés') && r.diag.includes('Olhar'), 'diagnóstico legível');
  assert.ok(r.footDrift < .3, `os pés se moveram demais: ${r.footDrift}`);
  assert.ok(r.tw > .9, `o olhar deve estar plenamente ativo com alvo travado: ${r.tw}`);
  assert.ok(r.trackEffect > .003 && r.trackEffect < .6, `efeito do olhar fora do esperado: ${r.trackEffect}`);
  assert.ok(r.pauseDrift < 1e-6, `quadro repetido em pausa não pode acumular: ${r.pauseDrift}`);
  assert.ok(r.twAfter < .01, `o olhar deve soltar sem alvo: ${r.twAfter}`);
  assert.deepEqual(errors, [], 'sem erros de página');
  console.log('game-feel-rig browser: ok');
} finally {
  await browser.close();
}
