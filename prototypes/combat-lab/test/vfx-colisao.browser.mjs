// @ts-check
// Efeito visual × área de colisão com o golpe EM MOVIMENTO (#05 do plano de 15 melhorias): o jogo roda ao vivo (laço real, VFX inclusos), o azul
// dispara cada Move pela tecla do slot 1, e no meio do voo a partida é pausada para fotografar o efeito com o gizmo «Hitbox das entidades dos Moves»
// por cima. Para entidades desenhadas com malha, mede o raio horizontal do visual (caixa envolvente da malha) contra o raio de colisão.
// Usa a GPU real por padrão (ARENAMON_GL=software força SwiftShader). Saída: prototypes/combat-lab/evidence/vfx-colisao/*.png, resultado.json e index.html.
// Uso: node prototypes/combat-lab/test/vfx-colisao.browser.mjs
import {chromium} from '@playwright/test';
import {mkdirSync, writeFileSync} from 'node:fs';
import {pathToFileURL, fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = root + 'evidence/vfx-colisao/';
mkdirSync(out, {recursive: true});
const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : process.env.ARENAMON_BROWSER_PATH ? {executablePath: process.env.ARENAMON_BROWSER_PATH} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};
const GL = process.env.ARENAMON_GL === 'software' ? ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] : ['--ignore-gpu-blocklist', '--enable-gpu'];
/** Moves e quanto tempo segurar a tecla (ms): carga e marcador precisam de segurar; toque, não. `wait` = espera depois de soltar até a foto. */
const MOVES = [
  {id: 'air-slash', hold: 60, wait: 140}, {id: 'swift', hold: 60, wait: 200}, {id: 'water-pulse', hold: 700, wait: 160}, {id: 'psyshock', hold: 60, wait: 260},
  {id: 'sand-wave', hold: 60, wait: 250}, {id: 'seed-bomb', hold: 450, wait: 300}, {id: 'fire-spin', hold: 450, wait: 400}, {id: 'spikes', hold: 900, wait: 700},
];
let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {ok ? passed++ : failed++;(ok ? console.log : console.error)(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);};

console.log('\n--- NAVEGADOR: EFEITO VISUAL × ÁREA DE COLISÃO EM MOVIMENTO ---\n');
const browser = await chromium.launch({...BROWSER, headless: true, args: [...GL, '--no-sandbox']});
const result = {date: new Date().toISOString().slice(0, 10), gl: process.env.ARENAMON_GL === 'software' ? 'software' : 'gpu', moves: /** @type {any[]} */ ([])};
try {
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  const errors = /** @type {string[]} */ ([]);
  page.on('pageerror', e => errors.push(e.message));
  await page.context().setOffline(true);
  await page.goto(labUrl + '?fabrica=1');
  await page.waitForFunction(() => window.__lab?.game && window.__lab.view, null, {timeout: 120000});
  for (const mv of MOVES) {
    const code = await page.evaluate(id => {
      const L = window.__lab, g = L.game, C = L.C;
      C.extras.toggles.enableEnemyAI = 0;L.startMatch();
      Object.assign(g.mapState, {platforms: [], obstacles: [], destructibles: [], items: [], regularSpawnTimer: 1e9});
      g.fighters[0].position = {x: 0, z: -4};g.fighters[1].position = {x: 0, z: 4};g.fighters[0].facing = 0;g.fighters[1].facing = Math.PI;
      g.setLoadout(0, [id]);
      for (const k of Object.keys(L.view.overlays)) L.view.overlays[k] = false;
      Object.assign(L.view.overlays, {moveEntities: true, hurtbox: true});
      if (L.ui.paused) L.togglePause();
      return C.extras.keyCodes[C.extras.bindings.skill1];
    }, mv.id);
    await page.waitForTimeout(400);   // deixa o laço ao vivo assentar a cena e a câmera
    const key = (/** @type {string} */ type) => page.evaluate(([type, code]) => (document.querySelector('.stage canvas') ?? document.body).dispatchEvent(new KeyboardEvent(type, {code, bubbles: true})), [type, code]);
    await key('keydown');await page.waitForTimeout(mv.hold);await key('keyup');
    await page.waitForTimeout(mv.wait);
    const info = await page.evaluate(() => {
      const L = window.__lab, g = L.game, wv = L.view.worldView;
      if (!L.ui.paused) L.togglePause();
      const cam = L.view.camera, canvas = L.view.renderer.domElement, rect = canvas.getBoundingClientRect();
      const live = g.world.entities.filter((/** @type {any} */ e) => !e.dead && e.owner === 0);
      const ents = live.map((/** @type {any} */ e) => {
        const colR = e.radius ?? (e.hx ? Math.hypot(e.hx, e.hz ?? 0) : null);
        const mesh = wv?.meshes?.get(e.id);
        let visR = null;
        if (mesh) {
          mesh.updateWorldMatrix(true, true);
          let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
          mesh.traverse((/** @type {any} */ o) => {
            if (!o.geometry || o.visible === false) return;
            o.geometry.computeBoundingBox?.();const bb = o.geometry.boundingBox;if (!bb) return;
            for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
              const v = o.localToWorld(mesh.position.clone().set(x, y, z));
              minX = Math.min(minX, v.x);maxX = Math.max(maxX, v.x);minZ = Math.min(minZ, v.z);maxZ = Math.max(maxZ, v.z);
            }
          });
          if (Number.isFinite(minX)) visR = Math.max(maxX - minX, maxZ - minZ) / 2;
        }
        const p = cam.position.clone();
        let screen = null;
        {p.set(e.pos.x, e.y ?? .6, e.pos.z).project(cam);screen = {x: rect.left + (p.x + 1) / 2 * rect.width, y: rect.top + (1 - p.y) / 2 * rect.height};}
        return {id: e.id, kind: e.kind, shape: e.shape ?? null, collisionRadius: colR, visualRadius: visR, hasMesh: !!mesh, screen, pos: {x: +e.pos.x.toFixed(2), z: +e.pos.z.toFixed(2)}};
      });
      return {ents, tick: g.tick};
    });
    // Foto: recorte em volta da primeira entidade com posição na tela; sem ela, a tela inteira.
    const s = info.ents.find(e => e.screen)?.screen;
    const clip = s ? {x: Math.max(0, Math.min(1400 - 520, s.x - 260)), y: Math.max(0, Math.min(900 - 400, s.y - 200)), width: 520, height: 400} : undefined;
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({path: out + mv.id + '.png', ...(clip ? {clip} : {})});
    const ratios = info.ents.filter(e => e.collisionRadius && e.visualRadius).map(e => +(e.visualRadius / e.collisionRadius).toFixed(2));
    result.moves.push({move: mv.id, file: `${mv.id}.png`, tick: info.tick, entities: info.ents.map(({screen, ...e}) => ({...e, collisionRadius: e.collisionRadius && +e.collisionRadius.toFixed(3), visualRadius: e.visualRadius && +e.visualRadius.toFixed(3)})), visualOverCollision: ratios});
    check(`${mv.id}: entidade viva fotografada em movimento`, info.ents.length > 0, info.ents.length ? `${info.ents.length} entidade(s)${ratios.length ? ` · visual ÷ colisão ${ratios.join(', ')}` : ' · visual sem malha medível (partículas)'}` : 'nenhuma entidade do azul no instante da foto');
  }
  check('sem erros de página', errors.length === 0, errors.join(' | ').slice(0, 200));
} finally {
  await browser.close();
}
writeFileSync(out + 'resultado.json', JSON.stringify(result, null, 2) + '\n');
const row = (/** @type {any} */ m) => {
  const e = m.entities[0];
  const verdict = !e ? 'sem entidade no instante' : m.visualOverCollision.length ? m.visualOverCollision.map((/** @type {number} */ r) => r > 1.25 ? `visual ${Math.round((r - 1) * 100)}% MAIOR que a colisão` : r < .8 ? `visual ${Math.round((1 - r) * 100)}% MENOR que a colisão` : 'visual ≈ colisão').join(' · ') : 'efeito de partículas: comparar na foto';
  return `<tr><td><b>${m.move}</b></td><td><a href="${m.file}"><img src="${m.file}" alt="${m.move}" loading="lazy"></a></td><td>${e ? `${e.kind}${e.shape ? ` (${e.shape})` : ''}` : '—'}</td><td>${e?.collisionRadius ?? '—'}</td><td>${e?.visualRadius ?? '—'}</td><td>${verdict}</td></tr>`;
};
writeFileSync(out + 'index.html', `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Efeito × colisão</title>
<style>body{font:15px system-ui,sans-serif;margin:16px;background:#10141b;color:#e7ecf3}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #2a3240;padding:8px;vertical-align:top;text-align:left}img{max-width:420px;width:100%;border-radius:6px}a{color:#8ac4ff}.muted{color:#9aa6b8}</style>
<h1>Efeito visual × área de colisão (golpe em movimento)</h1>
<p class="muted">Gerado em ${result.date} (${result.gl === 'gpu' ? 'GPU real' : 'software'}) por <code>prototypes/combat-lab/test/vfx-colisao.browser.mjs</code>. O jogo roda ao vivo; o Move é disparado pela tecla e a partida é pausada no meio do voo. Laranja = esfera/anel de colisão do projétil; vermelho/amarelo = área; azul = barreira; verde = hurtbox dos lutadores. «Raio visual» = metade do maior lado da caixa envolvente da malha (só para efeitos com malha; partículas Quarks não têm malha medível).</p>
<table><tr><th>Move</th><th>Captura</th><th>Entidade</th><th>Raio de colisão (m)</th><th>Raio visual (m)</th><th>Leitura</th></tr>${result.moves.map(row).join('')}</table></html>\n`);
console.log(`\n${passed} passaram, ${failed} falharam · capturas em evidence/vfx-colisao/ (abra index.html)`);
if (failed) process.exit(1);
