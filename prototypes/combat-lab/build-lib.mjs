// Montagem dos HTMLs únicos e offline do laboratório (usada pelo build e pelo servidor local de desenvolvimento).
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = new URL('.', import.meta.url);
const read = p => readFile(new URL(p, root), 'utf8');
import {execFileSync} from 'node:child_process';
/** Versão mostrada no laboratório: package.json (suba a cada entrega) + commit e data da compilação. */
async function versionInfo() {
  const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  let commit = '';
  try {commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {cwd: fileURLToPath(new URL('../../', import.meta.url))}).toString().trim();} catch {/* sem git */}
  const d = new Date(), pad = n => String(n).padStart(2, '0'), when = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return {label: 'v' + pkg.version, detail: `Versão ${pkg.version} · compilado em ${when}${commit ? ' · commit ' + commit : ''}`};
}
/** Pacote de workspace embutido (inicial/workspace-inicial.zip) como texto base64 num script inerte; o laboratório o importa na primeira abertura. */
async function initialWorkspaceTag() {
  try {
    const bytes = await readFile(new URL('inicial/workspace-inicial.zip', root));
    return `<script type="application/octet-stream" id="initial-workspace" data-bytes="${bytes.length}">${bytes.toString('base64')}</script>`;
  } catch {return '';}
}
const inline = js => js.replace(/<\/script/gi, '<\\/script');

/** Laboratório de combate: um único HTML (Three.js + laboratório). */
export async function buildLab({minify = true} = {}) {
  // O texto do config.ts do jogo entra no bundle só para gerar a proposta de patch (comparação; nunca é alterado).
  const gameConfig = await read('../game/src/config.ts');
  const bundle = await build({entryPoints: [fileURLToPath(new URL('src/main.js', root))], bundle: true, write: false, format: 'iife', minify, legalComments: 'inline', target: 'es2022', define: {__GAME_CONFIG_TS__: JSON.stringify(gameConfig)}, logLevel: 'silent'});
  const [template, css, license] = await Promise.all([read('src/template.html'), read('src/styles.css'), read('../../node_modules/three/LICENSE')]);
  // O aviso “modelo-fonte” só aparece se alguém abrir src/template.html diretamente; o build o remove.
  const version = await versionInfo();
  return template.replace(/<!--DEV-->[\s\S]*?<!--\/DEV-->\n?/, '').replaceAll('<!--INITIAL_WORKSPACE-->', await initialWorkspaceTag()).replaceAll('__VERSION_DETAIL__', version.detail).replaceAll('__VERSION__', version.label).replace('/*__CSS__*/', () => css).replace('/*__BUNDLE__*/', () => inline('/*\n' + license + '\n*/' + bundle.outputFiles[0].text));
}
/** Painel externo de relatórios: HTML único e offline que lê relatórios exportados (não acessa a partida). */
export async function buildReportsPanel({minify = true} = {}) {
  const bundle = await build({entryPoints: [fileURLToPath(new URL('reports/main.js', root))], bundle: true, write: false, format: 'iife', minify, target: 'es2022', logLevel: 'silent'});
  const [template, css] = await Promise.all([read('reports/template.html'), read('reports/styles.css')]);
  return template.replace('/*__CSS__*/', () => css).replace('/*__BUNDLE__*/', () => inline(bundle.outputFiles[0].text));
}
/** Texto de licença de um pacote npm (LICENSE, LICENSE.md ou LICENSE.txt): avisos obrigatórios seguem dentro do HTML. */
async function licenseOf(pkg) {
  for (const f of ['LICENSE', 'LICENSE.md', 'LICENSE.txt']) {
    try {return pkg + '\n' + await read('../../node_modules/' + pkg + '/' + f);} catch {/* tenta o próximo */}
  }
  return pkg + ": licença não encontrada em node_modules";
}
/** Laboratório de uma ferramenta open source: HTML único e offline (esbuild + template + CSS + licenças embutidas). */
async function buildToolLab(dir, packages, {minify = true} = {}) {
  const bundle = await build({entryPoints: [fileURLToPath(new URL(dir + '/main.js', root))], bundle: true, write: false, format: 'iife', minify, legalComments: 'inline', target: 'es2022', logLevel: 'silent', loader: {'.wasm': 'binary'}});
  const [template, css, ...licenses] = await Promise.all([read(dir + '/template.html'), read(dir + '/styles.css'), ...packages.map(licenseOf)]);
  const version = await versionInfo();
  const banner = '/*\n' + licenses.join('\n----\n') + '\n*/';
  return template.replaceAll('__VERSION_DETAIL__', version.detail).replace('/*__CSS__*/', () => css).replace('/*__BUNDLE__*/', () => inline(banner + bundle.outputFiles[0].text));
}
/** Laboratório three.quarks: HTML único e offline de VFX com gatilho por eventos reais da simulação. */
export const buildQuarksLab = o => buildToolLab('quarks-lab', ['three', 'three.quarks'], o);
/** Laboratório de navegação Yuka (Fase 3): cenários sólidos, rotas com salto e comparação A/B. */
export const buildNavLab = o => buildToolLab('nav-lab', ['three', 'yuka'], o);
export const OUTPUTS = {lab: 'dist/arenamon-combate-laboratorio.html', reports: 'dist/arenamon-painel-relatorios.html', quarks: 'dist/arenamon-vfx-quarks.html', nav: 'dist/arenamon-navegacao-yuka.html'};
