// Montagem dos HTMLs únicos e offline do laboratório (usada pelo build e pelo servidor local de desenvolvimento).
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = new URL('.', import.meta.url);
const read = p => readFile(new URL(p, root), 'utf8');
const inline = js => js.replace(/<\/script/gi, '<\\/script');

/** Laboratório de combate: um único HTML (Three.js + laboratório). */
export async function buildLab({minify = true} = {}) {
  // O texto do config.ts do jogo entra no bundle só para gerar a proposta de patch (comparação; nunca é alterado).
  const gameConfig = await read('../game/src/config.ts');
  const bundle = await build({entryPoints: [fileURLToPath(new URL('src/main.js', root))], bundle: true, write: false, format: 'iife', minify, legalComments: 'inline', target: 'es2022', define: {__GAME_CONFIG_TS__: JSON.stringify(gameConfig)}, logLevel: 'silent'});
  const [template, css, license] = await Promise.all([read('src/template.html'), read('src/styles.css'), read('../../node_modules/three/LICENSE')]);
  // O aviso “modelo-fonte” só aparece se alguém abrir src/template.html diretamente; o build o remove.
  return template.replace(/<!--DEV-->[\s\S]*?<!--\/DEV-->\n?/, '').replace('/*__CSS__*/', () => css).replace('/*__BUNDLE__*/', () => inline('/*\n' + license + '\n*/' + bundle.outputFiles[0].text));
}
/** Painel externo de relatórios: HTML único e offline que lê relatórios exportados (não acessa a partida). */
export async function buildReportsPanel({minify = true} = {}) {
  const bundle = await build({entryPoints: [fileURLToPath(new URL('reports/main.js', root))], bundle: true, write: false, format: 'iife', minify, target: 'es2022', logLevel: 'silent'});
  const [template, css] = await Promise.all([read('reports/template.html'), read('reports/styles.css')]);
  return template.replace('/*__CSS__*/', () => css).replace('/*__BUNDLE__*/', () => inline(bundle.outputFiles[0].text));
}
export const OUTPUTS = {lab: 'dist/arenamon-combate-laboratorio.html', reports: 'dist/arenamon-painel-relatorios.html'};
