// Gera dist/hud-moves-laboratorio.html: HTML único, offline, sem CDN (three embutido; CSS inline).
import {build} from 'esbuild';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const bundle = await build({
  entryPoints: [root + 'src/main.js'],
  bundle: true,
  write: false,
  format: 'iife',
  target: 'es2020',
  minify: true,
  legalComments: 'inline',
});
const css = (await Promise.all(['base', 'hud-a', 'hud-b', 'hud-c'].map(n => readFile(root + `src/css/${n}.css`, 'utf8')))).join('\n');
const template = await readFile(root + 'src/template.html', 'utf8');
const license = await readFile(new URL('../../node_modules/three/LICENSE', import.meta.url), 'utf8');
const html = template
  .replace('/*__STYLES__*/', () => css)
  .replace('/*__BUNDLE__*/', () => ('/*\n' + license + '\n*/' + bundle.outputFiles[0].text).replace(/<\/script/gi, '<\/script'));
await mkdir(root + 'dist', {recursive: true});
await writeFile(root + 'dist/hud-moves-laboratorio.html', html);
console.log('HTML HUD Vida/Stamina/Moves gerado: ' + Buffer.byteLength(html) + ' bytes');
