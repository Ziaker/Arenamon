// Gera dist/hud-consumiveis-laboratorio.html: HTML único, offline, sem CDN (three + three.quarks embutidos).
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
const template = await readFile(root + 'src/template.html', 'utf8');
const license = await readFile(new URL('../../node_modules/three/LICENSE', import.meta.url), 'utf8');
const html = template.replace(
  '/*__BUNDLE__*/',
  () => ('/*\n' + license + '\n*/' + bundle.outputFiles[0].text).replace(/<\/script/gi, '<\/script')
);
await mkdir(root + 'dist', {recursive: true});
await writeFile(root + 'dist/hud-consumiveis-laboratorio.html', html);
console.log('HTML HUD & Consumíveis gerado: ' + Buffer.byteLength(html) + ' bytes');
