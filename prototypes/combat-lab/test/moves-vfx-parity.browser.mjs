// @ts-check
// Suíte de Teste de Navegador Dedicada: Paridade Visual, Ciclo de Vida e Resiliência dos 3 Pilotos (Documento 02).
// Valida visualmente e estruturalmente em ambiente WebGL real (Playwright, offline file://):
//   1. Sand Wave: nascimento, propagação, partículas Quarks, transição dying, cauda de 0.4s e descarte limpo.
//   2. Bullet Punch: rush exclusivo, f.absent (invisibilidade do boneco), linha de trajeto, impacto e descarte.
//   3. Water Pulse: scaling de PL1/PL2/PL3, anel projectilePlBorder dinâmico, variantes A/B/C,
//      explosão de contato splash, cauda dying de 2.4s e retenção da posição de impacto.
//   4. Interruptores visuais e Acessibilidade: testes específicos de noFlash, reduceMotion,
//      elemental.enabled = 0 e alteração dinâmica de parâmetros/sliders durante o voo.
//   5. Proteção contra Reutilização de IDs: reinício de partida durante dying e reciclagem limpa de IDs.
//   6. Comparação Visual Automatizada: pixel a pixel contra baselines, com ROI do efeito (caixa projetada da posição 3D pela
//      câmera do jogo): similaridade global, dentro e fora da ROI, dono no despachante F5 e página A/B (AB_PARIDADE.html).
//      Baselines protegidas: --update-baselines só grava baselines-candidatas/; aceitar = --aceitar=<efeito> (explícito).
//   7. Isolamento estrito: manipuladores legados (atelierFx e elementalFx) NÃO duplicam os 3 pilotos.

import {chromium} from '@playwright/test';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync} from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = root + 'evidence/moves-vfx-parity/';
const baseDir = out + 'baselines/';
mkdirSync(out, {recursive: true});
mkdirSync(baseDir, {recursive: true});

const labUrl = pathToFileURL(root + 'dist/arenamon-combate-laboratorio.html').href;
const BROWSER = process.env.ARENAMON_BROWSER === 'chromium' ? {} : {channel: process.env.ARENAMON_BROWSER || 'msedge'};

let passed = 0, failed = 0;
const results = [];

function check(label, ok, detail = '') {
  if (ok) passed++; else failed++;
  const msg = `  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`;
  (ok ? console.log : console.error)(msg);
  results.push({label, ok, detail});
}

// F5 (Task 12) — baseline PROTEGIDO: nada aqui escreve em baselines/. `--update-baselines` (ou UPDATE_BASELINES=1) grava a captura
// atual em baselines-candidatas/ e regenera AB_PARIDADE.html (baseline | atual | calor, com as métricas); quem aceita é o usuário,
// à mão (copiar a candidata sobre a baseline) ou pelo comando explícito `--aceitar=<efeito>` (só aquele efeito, sem abrir navegador).
const UPDATE_BASELINES = process.argv.includes('--update-baselines') || process.env.UPDATE_BASELINES === '1';
const candDir = out + 'baselines-candidatas/';
const EFEITOS = ['sand-wave-ativo', 'bullet-punch-vanish', 'bullet-punch-impacto', 'water-pulse-voo', 'water-pulse-splash'];
const aceitarArg = process.argv.find(a => a.startsWith('--aceitar='));
if (aceitarArg) {
  const ef = aceitarArg.slice('--aceitar='.length), src = candDir + ef + '.png';
  if (!EFEITOS.includes(ef)) {console.error(`Efeito desconhecido: "${ef}". Use um de: ${EFEITOS.join(', ')}`);process.exit(2);}
  if (!existsSync(src)) {console.error(`Sem candidata para ${ef}: rode antes com --update-baselines (${src}).`);process.exit(2);}
  copyFileSync(src, baseDir + ef + '.png');
  console.log(`Baseline de ${ef} ACEITA pelo usuário: ${src} -> ${baseDir}${ef}.png (confira com git diff e faça o commit).`);
  process.exit(0);
}
if (UPDATE_BASELINES) mkdirSync(candDir, {recursive: true});

/** Escrita com novas tentativas: a pasta oficial fica no OneDrive, que trava por instantes um PNG recém-gravado (EBUSY/UNKNOWN). */
function escrever(/** @type {string} */ path, /** @type {any} */ data) {
  for (let i = 0; ; i++) {
    try {writeFileSync(path, data);return;} catch (e) {if (i >= 8) throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);}
  }
}

/** Análise humana por efeito (texto datado, escrito por quem investigou; entra em `explicacao` junto da leitura automática). */
const analisePath = out + 'analise-paridade.json';
const ANALISE = existsSync(analisePath) ? JSON.parse(readFileSync(analisePath, 'utf8')) : {};

/** Uma entrada por efeito comparado (vai para o JSON e para a página A/B). @type {any[]} */
const paridade = [];

/** Leitura automática da diferença pela ROI: dentro = o efeito mudou; fora = câmera/cena/HUD/layout/tempo. @param {any} r */
function lerDiferenca(r) {
  if (!r.ok) return `Comparação indisponível: ${r.error}`;
  const inD = r.pixelsIn ? r.diffIn / r.pixelsIn : 0, outD = r.pixelsOut ? r.diffOut / r.pixelsOut : 0;
  const share = r.diffCount ? r.diffIn / r.diffCount : 0;
  // Fora da ROI só deveria mudar por câmera/cena/HUD/layout/instante: acima de 5% fora, a ROI sozinha não isola o efeito.
  const onde = r.similarity >= 98 ? (inD > 0.1 ? 'Dentro da tolerância global, mas a ROI mudou mais de 10% — conferir o efeito.' : 'Dentro da tolerância global.')
    : outD > 0.05 ? `Diferença relevante FORA da ROI (${(outD * 100).toFixed(1)}% dos pixels de fora): câmera, cena, HUD, layout ou instante mudaram — a ROI sozinha não isola o efeito${inD > outD * 2 ? ', e dentro dela a mudança é ainda maior' : ''}.`
    : inD > outD * 2 ? 'Diferença concentrada DENTRO da ROI com o resto da tela estável — o efeito em si mudou.' : 'Diferença mista dentro e fora da ROI.';
  return `${onde} ROI ${r.roiSimilarity}% (${r.diffIn}/${r.pixelsIn} px diferentes), fora ${r.outSimilarity}% (${r.diffOut}/${r.pixelsOut} px); ${(share * 100).toFixed(1)}% de todos os pixels diferentes estão na ROI.`;
}

/**
 * Compara duas imagens PNG pixel a pixel no contexto da página e gera imagem composta lado a lado (com a ROI desenhada) e um mapa
 * de calor separado (diffHeatPath). Com `roi` mede a semelhança dentro (roiSimilarity) e fora (outSimilarity) da caixa do efeito.
 * REJEITA explicitamente se o baseline ou a imagem atual não existirem (sem falsos positivos). Nunca escreve em baselines/.
 * @param {any} page
 * @param {string} baselinePath
 * @param {string} currentPath
 * @param {string} diffOutputPath composta baseline | atual | diferença
 * @param {{minX: number, maxX: number, minY: number, maxY: number} | null} [roi]
 * @param {string} [diffHeatPath] só o mapa de calor (página A/B)
 * @returns {Promise<{similarity: number, roiSimilarity?: number, outSimilarity?: number, diffCount: number, diffIn?: number, diffOut?: number, pixelsIn?: number, pixelsOut?: number, ok: boolean, error?: string, totalPixels?: number, size?: any}>}
 */
async function compareImages(page, baselinePath, currentPath, diffOutputPath, roi = null, diffHeatPath = '') {
  if (!existsSync(baselinePath)) return {similarity: 0, diffCount: -1, ok: false, error: `Imagem de referência (baseline) inexistente: ${baselinePath}`};
  if (!existsSync(currentPath)) return {similarity: 0, diffCount: -1, ok: false, error: `Imagem atual não gerada: ${currentPath}`};
  const b64Base = readFileSync(baselinePath).toString('base64');
  const b64Curr = readFileSync(currentPath).toString('base64');
  const res = await page.evaluate(async ([b64Base, b64Curr, roi]) => {
    /** @type {(b64: string) => Promise<HTMLImageElement>} */
    const loadImg = b64 => new Promise((resolve, reject) => {const img = new Image();img.onload = () => resolve(img);img.onerror = reject;img.src = 'data:image/png;base64,' + b64;});
    const [imgA, imgB] = await Promise.all([loadImg(b64Base), loadImg(b64Curr)]);
    const w = Math.min(imgA.width, imgB.width), h = Math.min(imgA.height, imgB.height);
    const canvas = document.createElement('canvas');canvas.width = w * 3;canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return {similarity: 0, diffCount: -1, ok: false, error: 'Contexto 2d indisponível'};
    ctx.drawImage(imgA, 0, 0, w, h);ctx.drawImage(imgB, w, 0, w, h);
    const dA = ctx.getImageData(0, 0, w, h).data, dB = ctx.getImageData(w, 0, w, h).data;
    const diffImg = ctx.createImageData(w, h), dDiff = diffImg.data, heat = ctx.createImageData(w, h), dHeat = heat.data;
    const r = roi ?? {minX: 0, maxX: -1, minY: 0, maxY: -1};
    let diffCount = 0, diffIn = 0, pixelsIn = 0;
    for (let i = 0, p = 0; i < dA.length; i += 4, p++) {
      const x = p % w, y = (p / w) | 0, inside = x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY;
      if (inside) pixelsIn++;
      const sum = Math.abs(dA[i] - dB[i]) + Math.abs(dA[i + 1] - dB[i + 1]) + Math.abs(dA[i + 2] - dB[i + 2]) + Math.abs(dA[i + 3] - dB[i + 3]);
      if (sum > 25) {
        diffCount++;if (inside) diffIn++;
        dDiff[i] = 255;dDiff[i + 1] = 0;dDiff[i + 2] = 255;dDiff[i + 3] = 255;
        const v = Math.min(1, sum / 300);   // calor: vermelho escuro (pouca diferença) → amarelo → branco (muita)
        dHeat[i] = 120 + 135 * Math.min(1, v * 2);dHeat[i + 1] = 255 * Math.max(0, v * 2 - 0.6) / 1.4;dHeat[i + 2] = 255 * Math.max(0, v - 0.8) * 5;dHeat[i + 3] = 255;
      } else {
        const g = Math.floor((dA[i] + dA[i + 1] + dA[i + 2]) / 3 * 0.3);
        dDiff[i] = Math.floor(dA[i] * 0.35);dDiff[i + 1] = Math.floor(dA[i + 1] * 0.35);dDiff[i + 2] = Math.floor(dA[i + 2] * 0.35);dDiff[i + 3] = 255;
        dHeat[i] = g;dHeat[i + 1] = g;dHeat[i + 2] = g;dHeat[i + 3] = 255;
      }
    }
    ctx.putImageData(diffImg, w * 2, 0);
    const totalPixels = w * h, pixelsOut = totalPixels - pixelsIn, diffOut = diffCount - diffIn;
    const box = (/** @type {CanvasRenderingContext2D} */ c, ox) => {if (!roi) return;c.strokeStyle = '#ffd400';c.lineWidth = 3;c.setLineDash([10, 6]);c.strokeRect(ox + r.minX, r.minY, r.maxX - r.minX, r.maxY - r.minY);c.setLineDash([]);};
    box(ctx, 0);box(ctx, w);box(ctx, w * 2);
    ctx.font = 'bold 22px Segoe UI, sans-serif';ctx.fillStyle = '#00ffcc';
    ctx.fillText('1. Baseline Aprovado', 20, 36);ctx.fillText('2. Atual Renderizado', w + 20, 36);ctx.fillText('3. Diferença (Calor) · ROI tracejada', w * 2 + 20, 36);
    const hc = document.createElement('canvas');hc.width = w;hc.height = h;const hctx = hc.getContext('2d');
    if (hctx) {hctx.putImageData(heat, 0, 0);box(hctx, 0);}
    const pct = (/** @type {number} */ d, /** @type {number} */ n) => n > 0 ? +(Math.max(0, 1 - d / n) * 100).toFixed(2) : null;
    return {
      totalPixels, diffCount, similarity: pct(diffCount, totalPixels),
      roiSimilarity: roi ? pct(diffIn, pixelsIn) : null, outSimilarity: roi ? pct(diffOut, pixelsOut) : null,
      diffIn, diffOut, pixelsIn, pixelsOut, size: {w, h, baseline: [imgA.width, imgA.height], atual: [imgB.width, imgB.height]},
      compositeDataUrl: canvas.toDataURL('image/png'), heatDataUrl: hctx ? hc.toDataURL('image/png') : null, ok: true
    };
  }, [b64Base, b64Curr, roi]);
  const save = (/** @type {string} */ url, /** @type {string} */ path) => {if (url && path) escrever(path, Buffer.from(url.replace(/^data:image\/png;base64,/, ''), 'base64'));};
  save(res.compositeDataUrl, diffOutputPath);save(res.heatDataUrl, diffHeatPath);
  delete res.compositeDataUrl;delete res.heatDataUrl;
  return res;
}

/**
 * Captura + ROI + comparação + registro de um efeito. A captura atual vai para evidence/moves-vfx-parity/<efeito>.png; com
 * --update-baselines também para baselines-candidatas/ (NUNCA para baselines/).
 * @param {any} page @param {string} efeito @param {any} roiInfo saída de roiOf (caixa em px da captura + pontos 3D projetados)
 * @param {any} donos saída de donosDe (dono do efeito no despachante F5)
 */
async function compararEfeito(page, efeito, roiInfo, donos) {
  const atual = out + efeito + '.png';
  if (UPDATE_BASELINES && existsSync(atual)) escrever(candDir + efeito + ".png", readFileSync(atual));
  const roi = roiInfo?.box ?? null;
  const comp = await compareImages(page, baseDir + efeito + '.png', atual, out + 'fidelidade-' + efeito.replace(/-ativo$/, '') + '.png', roi, out + 'diff-' + efeito + '.png');
  const auto = lerDiferenca(comp), manual = ANALISE[efeito];
  paridade.push({
    efeito, ok: comp.ok && comp.similarity >= 98,
    similarity: comp.similarity, roiSimilarity: comp.roiSimilarity ?? null, outSimilarity: comp.outSimilarity ?? null,
    diffCount: comp.diffCount, diffIn: comp.diffIn ?? null, diffOut: comp.diffOut ?? null, pixelsIn: comp.pixelsIn ?? null, pixelsOut: comp.pixelsOut ?? null, totalPixels: comp.totalPixels ?? null,
    roi: roiInfo, dono: donos?.dono ?? null, donosPorResultado: donos?.donosPorResultado ?? null, eventosRecentes: donos?.eventos ?? [], dispatch: donos?.dispatch ?? null,
    explicacao: manual ? `${auto} Análise (${manual.data}): ${manual.texto}` : auto,
    imagens: {baseline: `baselines/${efeito}.png`, atual: `${efeito}.png`, diff: `diff-${efeito}.png`, candidata: existsSync(candDir + efeito + '.png') ? `baselines-candidatas/${efeito}.png` : null},
    error: comp.error ?? null
  });
  return comp;
}

/** Página A/B autocontida (caminhos relativos) para aceite humano. Regenerada a cada execução. */
function gerarPaginaAB() {
  const esc = (/** @type {any} */ s) => String(s ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n = (/** @type {any} */ v) => v == null ? '—' : `${v}%`;
  const cards = paridade.map(p => `
  <section class="card ${p.ok ? 'ok' : 'falha'}" id="${esc(p.efeito)}">
    <header><h2>${esc(p.efeito)}</h2><span class="tag">${p.ok ? 'dentro da tolerância (≥ 98%)' : 'abaixo de 98% — precisa de decisão humana'}</span></header>
    <dl class="metricas">
      <div><dt>Semelhança global</dt><dd>${n(p.similarity)}</dd></div>
      <div><dt>Dentro da ROI</dt><dd>${n(p.roiSimilarity)}</dd></div>
      <div><dt>Fora da ROI</dt><dd>${n(p.outSimilarity)}</dd></div>
      <div><dt>Pixels diferentes (ROI / fora)</dt><dd>${esc(p.diffIn)} / ${esc(p.diffOut)}</dd></div>
      <div><dt>Caixa ROI (px)</dt><dd>${p.roi?.box ? `x ${p.roi.box.minX}–${p.roi.box.maxX}, y ${p.roi.box.minY}–${p.roi.box.maxY}` : '—'}</dd></div>
      <div><dt>Dono (despachante F5)</dt><dd>${esc(p.dono?.modulo)} · canal ${esc(p.dono?.canal)}</dd></div>
    </dl>
    <div class="trio">
      <figure><a href="${esc(p.imagens.baseline)}"><img src="${esc(p.imagens.baseline)}" alt="Baseline aprovada de ${esc(p.efeito)}" loading="lazy"></a><figcaption>Baseline aprovada</figcaption></figure>
      <figure><a href="${esc(p.imagens.atual)}"><img src="${esc(p.imagens.atual)}" alt="Captura atual de ${esc(p.efeito)}" loading="lazy"></a><figcaption>Atual</figcaption></figure>
      <figure><a href="${esc(p.imagens.diff)}"><img src="${esc(p.imagens.diff)}" alt="Mapa de calor da diferença de ${esc(p.efeito)}" loading="lazy"></a><figcaption>Calor da diferença (ROI tracejada em amarelo)</figcaption></figure>
    </div>
    <p class="explica">${esc(p.explicacao)}</p>
    <p class="aceite">${p.imagens.candidata ? `Candidata: <a href="${esc(p.imagens.candidata)}">${esc(p.imagens.candidata)}</a> · aceitar: <code>node prototypes/combat-lab/test/moves-vfx-parity.browser.mjs --aceitar=${esc(p.efeito)}</code>` : 'Sem candidata gerada (rode o teste com <code>--update-baselines</code> para criar).'}</p>
  </section>`).join('\n');
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Paridade VFX A/B</title>
<style>
:root{--bg:#f6f7f9;--fg:#15181d;--card:#fff;--muted:#5b6472;--line:#d8dde5;--ok:#1a7f4b;--bad:#b42318;--code:#eef1f5}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f1216;--fg:#e8ebf0;--card:#171b21;--muted:#9aa4b2;--line:#2a313b;--ok:#4cc38a;--bad:#ff7b6b;--code:#222833}}
:root[data-theme="dark"]{--bg:#0f1216;--fg:#e8ebf0;--card:#171b21;--muted:#9aa4b2;--line:#2a313b;--ok:#4cc38a;--bad:#ff7b6b;--code:#222833}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 "Segoe UI",system-ui,sans-serif}
main{max-width:1500px;margin:0 auto;padding:24px 16px}h1{margin:0 0 4px;font-size:24px}.sub{color:var(--muted);margin:0 0 20px}
.instr{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 20px;margin-bottom:24px}
.instr li{margin:4px 0}code{background:var(--code);padding:1px 6px;border-radius:4px;font-size:13px;word-break:break-all}
.card{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--ok);border-radius:10px;padding:16px 20px;margin-bottom:24px}
.card.falha{border-left-color:var(--bad)}.card header{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}.card h2{margin:0;font-size:19px}
.tag{font-size:13px;color:var(--muted)}.metricas{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px 16px;margin:12px 0}
.metricas dt{font-size:12px;color:var(--muted)}.metricas dd{margin:0;font-weight:600;font-variant-numeric:tabular-nums}
.trio{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}@media (max-width:900px){.trio{grid-template-columns:1fr}}
figure{margin:0}img{width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:6px}figcaption{font-size:13px;color:var(--muted);margin-top:4px}
.explica{margin:12px 0 4px}.aceite{font-size:13px;color:var(--muted);margin:4px 0 0}
</style></head><body><main>
<h1>Paridade visual dos 3 pilotos — A/B para aceite</h1>
<p class="sub">Gerado por <code>test/moves-vfx-parity.browser.mjs</code> em ${esc(new Date().toISOString())}. A ROI é a caixa do efeito na tela, projetada da posição 3D do evento/entidade com a câmera do jogo (mais um raio e uma margem).</p>
<div class="instr"><strong>Como aceitar uma nova referência (só você decide):</strong>
<ol>
<li>Compare as três imagens de cada efeito abaixo. <em>Dentro da ROI</em> mostra se o efeito mudou; <em>Fora da ROI</em> mostra mudança de câmera, cenário, painéis ou instante.</li>
<li>O teste <strong>nunca</strong> escreve em <code>baselines/</code>. Rodar com <code>--update-baselines</code> só grava candidatas em <code>baselines-candidatas/</code> e refaz esta página.</li>
<li>Para aceitar um efeito: copie <code>baselines-candidatas/&lt;efeito&gt;.png</code> por cima de <code>baselines/&lt;efeito&gt;.png</code> à mão, <em>ou</em> rode na raiz do projeto <code>node prototypes/combat-lab/test/moves-vfx-parity.browser.mjs --aceitar=&lt;efeito&gt;</code> (um efeito por vez).</li>
<li>Depois confira com <code>git diff --stat</code> e faça o commit da baseline aceita.</li>
</ol></div>
${cards}
</main></body></html>
`;
  escrever(out + 'AB_PARIDADE.html', html);
}

/**
 * Caixa do efeito na captura: projeta pontos 3D (cada um expandido por um raio nos 3 eixos) com a câmera do View
 * (Vector3.project → NDC → pixels do canvas, skill threejs-scene-setup), soma margem e corta no retângulo do canvas.
 * @param {any} page @param {{fonte: string, pontos: Array<{x: number, y: number, z: number, r: number}>}} spec
 */
const roiOf = (page, spec, pad = 24) => page.evaluate(([spec, pad]) => {
  const v = window.__lab.view, cam = v.camera, V = cam.position.constructor, rect = v.canvas.getBoundingClientRect();
  cam.updateMatrixWorld();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, atras = 0;
  for (const p of spec.pontos) for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
    const q = new V(p.x + dx * p.r, p.y + dy * p.r, p.z + dz * p.r).project(cam);
    if (q.z > 1) {atras++;continue;}
    const x = rect.left + (q.x + 1) / 2 * rect.width, y = rect.top + (1 - q.y) / 2 * rect.height;
    minX = Math.min(minX, x);maxX = Math.max(maxX, x);minY = Math.min(minY, y);maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) return {fonte: spec.fonte, pontos: spec.pontos, box: null, atras};
  const box = {minX: Math.max(Math.floor(rect.left), Math.floor(minX - pad)), maxX: Math.min(Math.ceil(rect.right) - 1, Math.ceil(maxX + pad)),
    minY: Math.max(Math.floor(rect.top), Math.floor(minY - pad)), maxY: Math.min(Math.ceil(rect.bottom) - 1, Math.ceil(maxY + pad))};
  const r3 = (/** @type {number} */ n) => +n.toFixed(3);
  return {fonte: spec.fonte, pontos: spec.pontos.map(p => ({x: r3(p.x), y: r3(p.y), z: r3(p.z), r: p.r})), pad, box, atras,
    canvas: {left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height)},
    camera: {pos: cam.position.toArray().map(r3), fov: cam.fov, aspect: r3(cam.aspect)}};
}, [spec, pad]);

/**
 * Dono do efeito no despachante F5 (view/vfx/dispatch.js): módulo/canal que desenha + donos por resultado dos eventos recentes.
 * @param {any} page @param {{canal: string, modulo: string, via: string}} dono @param {string[]} resultados
 */
const donosDe = (page, dono, resultados) => page.evaluate(([dono, resultados]) => {
  const v = window.__lab.view, d = v.dispatch, evs = (window.__lab.game.events ?? []).slice(-12);
  const all = [...new Set([...resultados, ...evs.map(e => e.result)])];
  return {dono, eventos: evs.map(e => ({result: e.result, eventId: e.eventId ?? null, entity: e.entity ?? null})),
    donosPorResultado: Object.fromEntries(all.map(r => [r, d.owners[r] ?? (d.semVisual.has(r) ? 'SEM_VISUAL' : 'desconhecido')])), dispatch: d.diagnostics()};
}, [dono, resultados]);

console.log('\n--- NAVEGADOR: PARIDADE E CICLO DE VIDA VISUAL DOS 3 PILOTOS (DOC 02) ---\n');

const browser = await chromium.launch({
  ...BROWSER,
  headless: true,
  args: process.env.ARENAMON_GL === 'software'
    ? ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']
    : []
});

try {
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('request', r => {if (!/^(file|data|blob):/.test(r.url())) requests.push(r.url());});

  await page.context().setOffline(true);
  await page.goto(labUrl + '?fabrica=1');
  await page.waitForFunction(() => window.__lab?.moves && window.__lab.game, null, {timeout: 60000});

  const L = (fn, arg) => page.evaluate(fn, arg);
  const frames = n => L(n => new Promise(res => {let i = 0;const f = () => (++i >= n ? res(0) : requestAnimationFrame(f));requestAnimationFrame(f);}), n);

  // Diagnóstico opt-in (Task 12): PARIDADE_PAINEL=aberto reabre o painel lateral "Partida" como no layout das baselines de
  // 26/10 (antes de 2566aad iniciar o laboratório com o painel recolhido). Não muda limiares; só isola layout × efeito.
  const PAINEL_ABERTO = process.env.PARIDADE_PAINEL === 'aberto';
  if (PAINEL_ABERTO) {await L(() => window.__lab.openTool('match'));await frames(4);}

  // Inicializa o combate pausado para avanço determinístico frame a frame
  await L(() => {
    document.getElementById('moves-close')?.click();
    window.__lab.startMatch();
    window.__labRecording.ui.paused = true;
  });

  const idle = `({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null})`;

  const setupFighters = (move, dist = 5) => L(([move, dist]) => {
    window.__lab.startMatch();
    window.__labRecording.ui.paused = true;
    const g = window.__lab.game;
    const a = g.fighters[0], b = g.fighters[1];
    a.ai = false; b.ai = false;
    g.setLoadout(0, [move, null, null, null]);
    a.position = {x: 0, z: 0};
    a.groundY = 0;
    a.flight = null;
    a.action = null;
    a.velocity = {x: 0, z: 0};
    a.stamina = 12;
    a.moveCooldowns = {};
    a.facing = 0;
    b.position = {x: 0, z: dist};
    b.groundY = 0;
    b.flight = null;
    b.action = null;
    b.hp = 100;
  }, [move, dist]);

  const stepGame = (n, press) => L(([n, press, idle]) => {
    const g = window.__lab.game;
    const e = () => eval(idle);
    for (let i = 0; i < n; i++) {
      g.step({...e(), ...(press && i === 0 ? {skill: 0} : {}), skillHeld: [!!press && press !== 'once', false, false, false]}, e());
      window.__lab.view.worldView.update(g.world, {fighters: g.fighters, events: g.events ?? [], dt: 1 / 60});
    }
  }, [n, press, idle]);

  // =========================================================================
  // 1. TESTE DO SAND WAVE
  // =========================================================================
  console.log('\n[1/5] Sand Wave: nascimento, propagação, cauda e descarte modular');
  await setupFighters('sand-wave', 6);
  await frames(6);
  await stepGame(1, 'once');

  // Aguarda barragem nascer na simulação (após preparação de 0.25s = ~30 steps)
  let waveSpawned = false;
  for (let i = 0; i < 40; i++) {
    await stepGame(1);
    waveSpawned = await L(() => window.__lab.game.world.entities.some(e => e.kind === 'sandwave'));
    if (waveSpawned) break;
  }

  let swDiag = await L(() => {
    const wv = window.__lab.view.worldView;
    const mv = wv.movesVfx.diagnostics();
    const at = wv.atelierFx.diagnostics();
    const waveEnt = window.__lab.game.world.entities.find(e => e.kind === 'sandwave');
    const inst = waveEnt ? wv.movesVfx.activeInstances.get(waveEnt.id) : null;
    return {
      mv,
      at,
      hasWaveEnt: !!waveEnt,
      instHandled: !!inst,
      wavePos: inst ? wv.movesVfx.positionOf(waveEnt.id) : null,
      atelierCount: at.items.filter(x => x.kind === 'sandwave').length
    };
  });

  check('Sand Wave: barragem nasce na simulação', swDiag.hasWaveEnt);
  check('Sand Wave: gerenciado exclusivamente pelo MovesVfxRegistry (Doc 02)', swDiag.instHandled);
  check('Sand Wave: isolamento garantido (atelierFx não duplica a entidade)', swDiag.atelierCount === 0);
  check('Sand Wave: posição 3D calculada no centro da onda', swDiag.wavePos != null && swDiag.wavePos.z >= 0);

  const swActivePng = out + 'sand-wave-ativo.png';
  escrever(swActivePng, await page.screenshot());

  // Comparação visual automatizada contra baseline
  // ROI = faixa da barragem (origem → origem + dir·len, largura do Move) projetada pela câmera do jogo
  const swRoi = await roiOf(page, await L(() => {
    const wv = window.__lab.view.worldView, ent = window.__lab.game.world.entities.find(e => e.kind === 'sandwave');
    const st = ent ? wv.movesVfx.activeInstances.get(ent.id)?.state : null;
    if (!st?.pos) return {fonte: 'sandwave (sem estado)', pontos: []};
    const r = (st.p?.width ?? ent.width ?? 3) / 2 + .3, y = (st.y ?? 0) + .8;
    return {fonte: 'entidade sandwave: state.pos/dir/len (sand-wave.vfx.js)', pontos: [0, .5, 1].map(k => ({x: st.pos.x + st.dir.x * st.len * k, y, z: st.pos.z + st.dir.z * st.len * k, r}))};
  }));
  const swComp = await compararEfeito(page, 'sand-wave-ativo', swRoi, await donosDe(page, {canal: 'move', modulo: 'movesVfx (moves-vfx-registry → sand-wave.vfx.js)', via: 'estado da entidade sandwave'}, ['impact', 'sandStagger', 'expire']));
  check('Sand Wave: ROI do efeito projetada e medida', swRoi.box != null && Number.isFinite(swComp.roiSimilarity) && Number.isFinite(swComp.outSimilarity), JSON.stringify(swRoi.box));
  check('Sand Wave: fidelidade visual automatizada contra baseline (≥ 98%)', swComp.ok && swComp.similarity >= 98, swComp.error || `${swComp.similarity}% global · ROI ${swComp.roiSimilarity}% · fora ${swComp.outSimilarity}%`);

  // Avança até o fim da vida ativa na simulação -> entra na cauda de dissipação (+0.4s)
  for (let i = 0; i < 200; i++) {
    await stepGame(1);
    const waveAlive = await L(() => window.__lab.game.world.entities.some(e => e.kind === 'sandwave'));
    if (!waveAlive) break;
  }
  await frames(4);

  let swTail = await L(() => {
    const wv = window.__lab.view.worldView;
    const waveEnt = window.__lab.game.world.entities.find(e => e.kind === 'sandwave');
    const dyingInst = [...wv.movesVfx.activeInstances.values()].find(x => x.module.id === 'sand-wave');
    return {
      entExpired: !waveEnt,
      isDying: dyingInst?.dying === true,
      age: dyingInst?.age ?? 0,
      tailPosValid: dyingInst ? wv.movesVfx.positionOf(dyingInst.entity.id) != null : false
    };
  });

  check('Sand Wave: entidade expira na simulação e transiciona para fase dying', swTail.entExpired && swTail.isDying);
  check('Sand Wave: posição de dissipação retida durante a cauda', swTail.tailPosValid);

  // Avança até a dissipação total (> 0.4s = 35 frames)
  for (let i = 0; i < 50; i++) {
    await stepGame(1);
    const stillActive = await L(() => [...window.__lab.view.worldView.movesVfx.activeInstances.values()].some(x => x.module.id === 'sand-wave'));
    if (!stillActive) break;
  }
  await frames(6);

  let swClean = await L(() => {
    const wv = window.__lab.view.worldView;
    return {
      activeInstances: wv.movesVfx.activeInstances.size,
      sandActive: [...wv.movesVfx.activeInstances.values()].some(x => x.module.id === 'sand-wave')
    };
  });

  check('Sand Wave: efeito dissipado e descartado limpo sem vazamento', !swClean.sandActive);

  // =========================================================================
  // 2. TESTE DO BULLET PUNCH
  // =========================================================================
  console.log('\n[2/5] Bullet Punch: avanço rush, f.absent, impacto e descarte');
  await setupFighters('bullet-punch', 4);
  await frames(6);
  await stepGame(1, 'once');

  // Preparação de 0.75s (~90 steps) antes do vanish
  for (let i = 0; i < 95; i++) {
    await stepGame(1);
    const vanished = await L(() => window.__lab.game.fighters[0].absent);
    if (vanished) break;
  }

  let bpVanish = await L(() => {
    const wv = window.__lab.view.worldView;
    const f0 = window.__lab.game.fighters[0];
    const mv = wv.movesVfx.diagnostics();
    const rush = mv.rushes.find(r => r.move === 'bullet-punch');
    const f0Obj = wv.meshes.get(f0.id) ?? wv.characters?.[0]?.root;
    return {
      absent: f0.absent,
      rushActive: !!rush,
      rushAge: rush?.age ?? 0,
      bodyHidden: f0Obj ? f0Obj.visible === false : true
    };
  });

  check('Bullet Punch: lutador entra em vanish (f.absent = true)', bpVanish.absent);
  check('Bullet Punch: modelo 3D do personagem ocultado durante vanish', bpVanish.bodyHidden);
  check('Bullet Punch: rush visual gerenciado exclusivamente pelo MovesVfxRegistry', bpVanish.rushActive);

  const bpVanishPng = out + 'bullet-punch-vanish.png';
  escrever(bpVanishPng, await page.screenshot());

  // Comparação visual automatizada durante o vanish
  // ROI = trajeto do rush: grupo do rush (mundo) + atacante + alvo, na altura do golpe (y 1.05)
  const bpVanishRoi = await roiOf(page, await L(() => {
    const wv = window.__lab.view.worldView, g = window.__lab.game, r = wv.movesVfx.rushes.find(x => x.module.id === 'bullet-punch')?.rush;
    const pts = g.fighters.map(f => ({x: f.position.x, y: (f.groundY ?? 0) + 1.05, z: f.position.z, r: 1.2}));
    if (r?.group) {const w = r.group.getWorldPosition(r.group.position.clone());pts.push({x: w.x, y: w.y + 1.05, z: w.z, r: 1.2});}
    return {fonte: 'rush bullet-punch: group (mundo) + lutadores (bullet-punch.vfx.js)', pontos: pts};
  }));
  const bpVanishComp = await compararEfeito(page, 'bullet-punch-vanish', bpVanishRoi, await donosDe(page, {canal: 'move', modulo: 'movesVfx (moves-vfx-registry → bullet-punch.vfx.js, rush)', via: 'rush do lutador (f.absent)'}, ['bulletVanish']));
  check('Bullet Punch: ROI do vanish projetada e medida', bpVanishRoi.box != null && Number.isFinite(bpVanishComp.roiSimilarity) && Number.isFinite(bpVanishComp.outSimilarity), JSON.stringify(bpVanishRoi.box));
  check('Bullet Punch: fidelidade visual do vanish contra baseline (≥ 98%)', bpVanishComp.ok && bpVanishComp.similarity >= 98, bpVanishComp.error || `${bpVanishComp.similarity}% global · ROI ${bpVanishComp.roiSimilarity}% · fora ${bpVanishComp.outSimilarity}%`);

  // Avança vanish (0.2s = ~25 steps) até a chegada / bulletReturn / impacto
  for (let i = 0; i < 30; i++) {
    await stepGame(1);
    const reappeared = await L(() => !window.__lab.game.fighters[0].absent);
    if (reappeared) break;
  }
  await frames(6);

  let bpImpact = await L(() => {
    const wv = window.__lab.view.worldView;
    const f0 = window.__lab.game.fighters[0];
    const mv = wv.movesVfx.diagnostics();
    const rush = wv.movesVfx.rushes.find(r => r.module.id === 'bullet-punch')?.rush;
    return {
      reappeared: !f0.absent,
      rushDone: rush?.done === true,
      impactValid: rush?.impact != null,
      impactZ: rush?.impact?.z ?? 0
    };
  });

  check('Bullet Punch: reaparece perto do alvo (f.absent = false)', bpImpact.reappeared);
  check('Bullet Punch: evento de impacto acionado na chegada', bpImpact.rushDone && bpImpact.impactValid);

  const bpImpactPng = out + 'bullet-punch-impacto.png';
  escrever(bpImpactPng, await page.screenshot());

  // Comparação visual automatizada do impacto
  // ROI = ponto de impacto do rush (fx.impact no mundo) + alvo
  const bpImpactRoi = await roiOf(page, await L(() => {
    const wv = window.__lab.view.worldView, g = window.__lab.game, r = wv.movesVfx.rushes.find(x => x.module.id === 'bullet-punch')?.rush;
    const t = g.fighters[1], pts = [{x: t.position.x, y: (t.groundY ?? 0) + 1.05, z: t.position.z, r: 1.2}];
    const imp = r?.fx?.impact;if (imp?.getWorldPosition) {const w = imp.getWorldPosition(imp.position.clone());pts.push({x: w.x, y: w.y, z: w.z, r: 1.5});}
    return {fonte: 'rush bullet-punch: fx.impact (mundo) + alvo', pontos: pts};
  }));
  const bpImpactComp = await compararEfeito(page, 'bullet-punch-impacto', bpImpactRoi, await donosDe(page, {canal: 'move', modulo: 'movesVfx (moves-vfx-registry → bullet-punch.vfx.js, rush)', via: 'eventos bulletReturn/impact do lutador'}, ['bulletReturn', 'impact']));
  check('Bullet Punch: ROI do impacto projetada e medida', bpImpactRoi.box != null && Number.isFinite(bpImpactComp.roiSimilarity) && Number.isFinite(bpImpactComp.outSimilarity), JSON.stringify(bpImpactRoi.box));
  check('Bullet Punch: fidelidade visual do impacto contra baseline (≥ 98%)', bpImpactComp.ok && bpImpactComp.similarity >= 98, bpImpactComp.error || `${bpImpactComp.similarity}% global · ROI ${bpImpactComp.roiSimilarity}% · fora ${bpImpactComp.outSimilarity}%`);

  // Avança até o fim da cauda de dissipação (+0.4s)
  for (let i = 0; i < 150; i++) {
    await stepGame(1);
    const bpActive = await L(() => window.__lab.view.worldView.movesVfx.rushes.some(r => r.module.id === 'bullet-punch'));
    if (!bpActive) break;
  }
  await frames(6);

  let bpClean = await L(() => {
    const wv = window.__lab.view.worldView;
    return {
      rushesCount: wv.movesVfx.rushes.length,
      bpActive: wv.movesVfx.rushes.some(r => r.module.id === 'bullet-punch')
    };
  });

  check('Bullet Punch: rush descartado limpo após a dissipação', !bpClean.bpActive);

  // =========================================================================
  // 3. TESTE DO WATER PULSE
  // =========================================================================
  console.log('\n[3/5] Water Pulse: PL scaling, border toggle, contato splash e cauda 2.4s');
  await setupFighters('water-pulse', 8);
  await frames(6);

  // Carrega por 95 passos (PL2) e solta
  await L(() => {
    const g = window.__lab.game;
    const e = () => ({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: 0, skillHeld: [true, false, false, false]});
    for (let i = 0; i < 95; i++) {
      g.step(e(), {move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});
      window.__lab.view.worldView.update(g.world, {fighters: g.fighters, events: g.events ?? [], dt: 1 / 60});
    }
    // Solta
    g.step({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: [false, false, false, false]}, {move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});
    window.__lab.view.worldView.update(g.world, {fighters: g.fighters, events: g.events ?? [], dt: 1 / 60});
  });

  await frames(4);

  let wpSpawn = await L(() => {
    const wv = window.__lab.view.worldView;
    const proj = window.__lab.game.world.entities.find(e => e.kind === 'projectile' && e.visual === 'waterorb');
    const inst = proj ? wv.movesVfx.activeInstances.get(proj.id) : null;
    const elemProj = wv.elementalFx.items.get(proj?.id);
    return {
      hasProj: !!proj,
      pl: proj?.pl,
      instActive: !!inst,
      previewActive: inst?.state?.preview?.active === true,
      scale: inst?.state?.preview?.root?.scale?.x ?? 0,
      elementalDuplicated: !!elemProj
    };
  });

  check('Water Pulse: projétil PL2 gerado na simulação', wpSpawn.hasProj && wpSpawn.pl === 2);
  check('Water Pulse: gerenciado exclusivamente pelo MovesVfxRegistry', wpSpawn.instActive && wpSpawn.previewActive);
  check('Water Pulse: isolamento garantido (elementalFx não processa Water Pulse)', !wpSpawn.elementalDuplicated);
  check('Water Pulse: escala proporcional ao PL2 aplicada na malha', wpSpawn.scale > 0.3);

  // Teste dinâmico de toggle do anel projectilePlBorder
  await L(() => {
    window.__lab.C.vfx.projectilePlBorder = true;
  });
  await stepGame(2);
  await frames(2);

  let borderOn = await L(() => {
    const wv = window.__lab.view.worldView;
    const proj = window.__lab.game.world.entities.find(e => e.kind === 'projectile' && e.visual === 'waterorb');
    const inst = proj ? wv.movesVfx.activeInstances.get(proj.id) : null;
    const ring = inst?.state?.preview?.root?.getObjectByName('plBorder');
    return {hasBorder: !!ring, visible: ring?.visible !== false};
  });

  check('Water Pulse: anel projectilePlBorder dinâmico criado e visível', borderOn.hasBorder && borderOn.visible);

  await L(() => {
    window.__lab.C.vfx.projectilePlBorder = false;
  });
  await stepGame(2);
  await frames(2);

  let borderOff = await L(() => {
    const wv = window.__lab.view.worldView;
    const proj = window.__lab.game.world.entities.find(e => e.kind === 'projectile' && e.visual === 'waterorb');
    const inst = proj ? wv.movesVfx.activeInstances.get(proj.id) : null;
    const ring = inst?.state?.preview?.root?.getObjectByName('plBorder');
    return {hasBorder: !!ring};
  });

  check('Water Pulse: anel projectilePlBorder dinamicamente removido ao desligar', !borderOff.hasBorder);

  // Teste de troca de variante visual em tempo real (variante B = 1)
  await L(() => {
    window.__lab.C.vfx.elemental.waterVariant = 1;
  });
  await stepGame(2);
  await frames(2);

  let varB = await L(() => {
    const wv = window.__lab.view.worldView;
    const proj = window.__lab.game.world.entities.find(e => e.kind === 'projectile' && e.visual === 'waterorb');
    const inst = proj ? wv.movesVfx.activeInstances.get(proj.id) : null;
    return {
      variant: inst?.state?.preview?.p?.variant
    };
  });

  check('Water Pulse: troca de variante A/B/C reconstruída em tempo real', varB.variant === 1);

  const wpVooPng = out + 'water-pulse-voo.png';
  escrever(wpVooPng, await page.screenshot());

  // Comparação visual automatizada do voo
  // ROI = esfera do projétil (positionOf do preview) com raio pela escala do PL
  const wpVooRoi = await roiOf(page, await L(() => {
    const wv = window.__lab.view.worldView, proj = window.__lab.game.world.entities.find(e => e.kind === 'projectile' && e.visual === 'waterorb');
    const pos = proj ? wv.movesVfx.positionOf(proj.id) : null, sc = proj ? wv.movesVfx.activeInstances.get(proj.id)?.state?.preview?.root?.scale?.x ?? 1 : 1;
    return {fonte: 'projétil waterorb: movesVfx.positionOf (water-pulse.vfx.js)', pontos: pos ? [{x: pos.x, y: pos.y, z: pos.z, r: .9 + sc}] : []};
  }));
  const wpVooComp = await compararEfeito(page, 'water-pulse-voo', wpVooRoi, await donosDe(page, {canal: 'move', modulo: 'movesVfx (moves-vfx-registry → water-pulse.vfx.js)', via: 'estado da entidade projectile/waterorb'}, ['chargeRelease']));
  check('Water Pulse: ROI do voo projetada e medida', wpVooRoi.box != null && Number.isFinite(wpVooComp.roiSimilarity) && Number.isFinite(wpVooComp.outSimilarity), JSON.stringify(wpVooRoi.box));
  check('Water Pulse: fidelidade visual do projétil em voo contra baseline (≥ 98%)', wpVooComp.ok && wpVooComp.similarity >= 98, wpVooComp.error || `${wpVooComp.similarity}% global · ROI ${wpVooComp.roiSimilarity}% · fora ${wpVooComp.outSimilarity}%`);

  // Avança até o impacto com o alvo em z = 8
  for (let i = 0; i < 50; i++) {
    await stepGame(1);
    const projExists = await L(() => window.__lab.game.world.entities.some(e => e.kind === 'projectile' && e.visual === 'waterorb'));
    if (!projExists) break;
  }
  await frames(4);

  let wpImpact = await L(() => {
    const wv = window.__lab.view.worldView;
    const dyingInst = [...wv.movesVfx.activeInstances.values()].find(x => x.module.id === 'water-pulse');
    return {
      isDying: dyingInst?.dying === true,
      age: dyingInst?.age ?? 0,
      contactPos: dyingInst ? wv.movesVfx.positionOf(dyingInst.entity.id) : null
    };
  });

  check('Water Pulse: impacto ativa animação splash e transiciona para cauda dying', wpImpact.isDying);
  check('Water Pulse: posição do ponto de contato retida durante todo o splash', wpImpact.contactPos != null && wpImpact.contactPos.z > 5);

  const wpSplashPng = out + 'water-pulse-splash.png';
  escrever(wpSplashPng, await page.screenshot());

  // Comparação visual automatizada do splash
  // ROI = ponto de contato retido pelo splash (positionOf na fase dying) com o raio da explosão
  const wpSplashRoi = await roiOf(page, await L(() => {
    const wv = window.__lab.view.worldView, inst = [...wv.movesVfx.activeInstances.values()].find(x => x.module.id === 'water-pulse');
    const pos = inst ? wv.movesVfx.positionOf(inst.entity.id) : null;
    return {fonte: 'splash water-pulse: movesVfx.positionOf na fase dying', pontos: pos ? [{x: pos.x, y: pos.y, z: pos.z, r: 2.2}] : []};
  }));
  const wpSplashComp = await compararEfeito(page, 'water-pulse-splash', wpSplashRoi, await donosDe(page, {canal: 'move', modulo: 'movesVfx (moves-vfx-registry → water-pulse.vfx.js, splash)', via: 'evento de contato roteado por ev.entity + fase dying'}, ['impact', 'expire']));
  check('Water Pulse: ROI do splash projetada e medida', wpSplashRoi.box != null && Number.isFinite(wpSplashComp.roiSimilarity) && Number.isFinite(wpSplashComp.outSimilarity), JSON.stringify(wpSplashRoi.box));
  check('Water Pulse: fidelidade visual do splash contra baseline (≥ 98%)', wpSplashComp.ok && wpSplashComp.similarity >= 98, wpSplashComp.error || `${wpSplashComp.similarity}% global · ROI ${wpSplashComp.roiSimilarity}% · fora ${wpSplashComp.outSimilarity}%`);

  // Avança parcialmente na cauda (1.0s de 2.4s) -> ainda deve estar vivo no splash
  await stepGame(60);
  await frames(4);

  let wpMidTail = await L(() => {
    const wv = window.__lab.view.worldView;
    const dyingInst = [...wv.movesVfx.activeInstances.values()].find(x => x.module.id === 'water-pulse');
    return {
      stillDying: dyingInst?.dying === true,
      age: dyingInst?.age ?? 0
    };
  });

  check('Water Pulse: partículas de splash sustentadas durante a cauda de 2.4s', wpMidTail.stillDying && wpMidTail.age > 0.5);

  // Avança até o término completo da cauda de 2.4s (mais 120 frames)
  await stepGame(120);
  await frames(6);

  let wpClean = await L(() => {
    const wv = window.__lab.view.worldView;
    return {
      wpActive: [...wv.movesVfx.activeInstances.values()].some(x => x.module.id === 'water-pulse')
    };
  });

  check('Water Pulse: descarte e liberação total de memória após 2.4s', !wpClean.wpActive);

  // =========================================================================
  // 4. TESTES DE INTERRUPTORES VISUAIS, ACESSIBILIDADE E SLIDERS EM TEMPO REAL
  // =========================================================================
  console.log('\n[4/5] Interruptores visuais, acessibilidade e alteração dinâmica de sliders');
  await setupFighters('water-pulse', 8);
  await frames(4);
  // Dispara novo projétil
  await stepGame(1, 'once');
  await stepGame(2);

  // 4.1 Acessibilidade: noFlash
  let noFlashOk = await L(() => {
    window.__lab.C.vfx.master.noFlash = true;
    const g = window.__lab.game;
    g.step({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null}, {move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});
    window.__lab.view.worldView.update(g.world, {fighters: g.fighters, events: g.events ?? [], dt: 1 / 60});
    const proj = g.world.entities.find(e => e.kind === 'projectile' && e.visual === 'waterorb');
    const inst = proj ? window.__lab.view.worldView.movesVfx.activeInstances.get(proj.id) : null;
    const activeNoFlash = inst?.state?.preview?.noFlash;
    window.__lab.C.vfx.master.noFlash = false;
    return activeNoFlash === true;
  });
  check('Interruptores: noFlash aplicado dinamicamente aos previews ativos', noFlashOk);

  // 4.2 Acessibilidade: reduceMotion
  let reduceMotionOk = await L(() => {
    window.__lab.C.vfx.master.reduceMotion = true;
    const g = window.__lab.game;
    g.step({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null}, {move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});
    window.__lab.view.worldView.update(g.world, {fighters: g.fighters, events: g.events ?? [], dt: 1 / 60});
    const proj = g.world.entities.find(e => e.kind === 'projectile' && e.visual === 'waterorb');
    const inst = proj ? window.__lab.view.worldView.movesVfx.activeInstances.get(proj.id) : null;
    const activeReduced = inst?.state?.preview?.reduced;
    window.__lab.C.vfx.master.reduceMotion = false;
    return activeReduced === true;
  });
  check('Interruptores: reduceMotion aplicado dinamicamente aos previews ativos', reduceMotionOk);

  // 4.3 Mudança dinâmica de sliders / parâmetros de presets visuais durante o voo
  let dynamicParamsOk = await L(() => {
    const wv = window.__lab.view.worldView;
    const proj = window.__lab.game.world.entities.find(e => e.kind === 'projectile' && e.visual === 'waterorb');
    const instBefore = proj ? wv.movesVfx.activeInstances.get(proj.id) : null;
    const sigBefore = instBefore?.signature;

    // Altera o slider de tamanho do preset visual em tempo de execução
    const variant = Math.max(0, Math.min(2, Math.round(window.__lab.C.vfx?.elemental?.waterVariant ?? 0)));
    const k = 'waterPulse' + variant;
    window.__lab.C.vfx.elemental = window.__lab.C.vfx.elemental || {};
    window.__lab.C.vfx.elemental.visual = window.__lab.C.vfx.elemental.visual || {};
    window.__lab.C.vfx.elemental.visual[k] = Object.assign({}, window.__lab.C.vfx.elemental.visual[k] || { size: 1.0 });
    const origSize = window.__lab.C.vfx.elemental.visual[k].size ?? 1.0;
    window.__lab.C.vfx.elemental.visual[k].size = origSize + 0.85;

    const g = window.__lab.game;
    g.step({move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null}, {move: {x: 0, z: 0}, dodge: false, dodgeHeld: false, tackle: false, tackleHeld: false, guard: false, guardPressed: false, jump: false, jumpHeld: false, target: null, skill: null, skillHeld: null});
    wv.update(g.world, {fighters: g.fighters, events: g.events ?? [], dt: 1 / 60});

    const instAfter = proj ? wv.movesVfx.activeInstances.get(proj.id) : null;
    const sigAfter = instAfter?.signature;

    // Restaura parâmetro
    window.__lab.C.vfx.elemental.visual[k].size = origSize;
    return sigBefore !== sigAfter && !!instAfter;
  });
  check('Interruptores: alteração de sliders visuais reconstruída suavemente em tempo real', dynamicParamsOk);

  // 4.4 Desligamento completo via elemental.enabled = 0
  let disableVfxOk = await L(() => {
    window.__lab.C.vfx.elemental.enabled = 0;
    const wv = window.__lab.view.worldView;
    const g = window.__lab.game;
    // O handles(e) agora deve retornar falso com enabled = 0
    const proj = g.world.entities.find(e => e.kind === 'projectile' && e.visual === 'waterorb');
    const handlesWhenOff = wv.movesVfx.handles(proj);
    window.__lab.C.vfx.elemental.enabled = 1;
    return handlesWhenOff === false;
  });
  check('Interruptores: C.vfx.elemental.enabled = 0 desativa o manipulador visual', disableVfxOk);

  // =========================================================================
  // 5. TESTE DE RESILIÊNCIA CONTRA REUTILIZAÇÃO DE IDS E REINÍCIO EM DYING
  // =========================================================================
  console.log('\n[5/5] Resiliência: reutilização de IDs e reinício de combate durante fase dying');
  await setupFighters('water-pulse', 4);
  await stepGame(1, 'once');
  // Avança até o impacto para entrar em dying
  for (let i = 0; i < 40; i++) {
    await stepGame(1);
    const hasDying = await L(() => [...window.__lab.view.worldView.movesVfx.activeInstances.values()].some(x => x.dying));
    if (hasDying) break;
  }

  let dyingBeforeReset = await L(() => {
    const wv = window.__lab.view.worldView;
    return [...wv.movesVfx.activeInstances.values()].some(x => x.dying);
  });
  check('Resiliência: Water Pulse colocado propositalmente em fase dying (splash ativo)', dyingBeforeReset);

  // Reinicia a partida IMEDIATAMENTE enquanto o splash está vivo
  await L(() => {
    window.__lab.startMatch();
    window.__labRecording.ui.paused = true;
    const g = window.__lab.game;
    g.setLoadout(0, ['water-pulse', null, null, null]);
    g.fighters[0].stamina = 12;
    g.fighters[0].moveCooldowns = {};
  });

  let clearedOnReset = await L(() => {
    const wv = window.__lab.view.worldView;
    return wv.movesVfx.activeInstances.size === 0 && wv.movesVfx.rushes.length === 0;
  });
  check('Resiliência: startMatch() limpa imediatamente instâncias dying anteriores', clearedOnReset);

  // Dispara novo Water Pulse na nova partida: o simulador reutiliza o ID = 1
  await stepGame(1, 'once');
  await stepGame(2);

  let newProjReusedId = await L(() => {
    const wv = window.__lab.view.worldView;
    const proj = window.__lab.game.world.entities.find(e => e.kind === 'projectile' && e.visual === 'waterorb');
    const inst = proj ? wv.movesVfx.activeInstances.get(proj.id) : null;
    return {
      hasProj: !!proj,
      projId: proj?.id,
      instActive: !!inst,
      instDying: inst?.dying,
      sameEntity: inst?.entity === proj
    };
  });

  check('Resiliência: novo projétil com ID reciclado é instanciado vivo (dying = false)', newProjReusedId.hasProj && newProjReusedId.instActive && newProjReusedId.instDying === false && newProjReusedId.sameEntity);

  // =========================================================================
  // 6. SANIDADE DO SISTEMA
  // =========================================================================
  check('sem erros de console ou página WebGL', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('sem requisições externas não autorizadas', requests.length === 0, requests.slice(0, 3).join(' | '));

  escrever(out + 'resultado-paridade-vfx.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    passed,
    failed,
    layout: PAINEL_ABERTO ? 'painel lateral aberto (diagnóstico PARIDADE_PAINEL=aberto)' : 'padrão do laboratório (painel recolhido)',
    modo: UPDATE_BASELINES ? 'update-baselines (candidatas gravadas; baselines/ intocada)' : 'comparação',
    paridade,
    results,
    errors
  }, null, 2));
  gerarPaginaAB();

} finally {
  await browser.close();
}

console.log(failed ? `\n✗ Falhou: ${failed} (de ${passed + failed}).` : `\n✓ Todos os ${passed} testes de paridade visual, fidelidade e resiliência APROVADOS.`);
process.exit(failed ? 1 : 0);
