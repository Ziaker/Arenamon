// Gera dist/arenamon-combate-laboratorio.html: um único HTML offline (Three.js + laboratório).
import {build} from 'esbuild';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = new URL('.', import.meta.url);
const bundle = await build({entryPoints: [fileURLToPath(new URL('src/main.js', root))], bundle: true, write: false, format: 'iife', minify: true, legalComments: 'inline', target: 'es2022'});
const [template, css, license] = await Promise.all([readFile(new URL('src/template.html', root), 'utf8'), readFile(new URL('src/styles.css', root), 'utf8'), readFile(new URL('../../node_modules/three/LICENSE', root), 'utf8')]);
// O aviso “modelo-fonte” só aparece se alguém abrir src/template.html diretamente; o build o remove.
const html = template.replace(/<!--DEV-->[\s\S]*?<!--\/DEV-->\n?/, '').replace('/*__CSS__*/', () => css).replace('/*__BUNDLE__*/', () => ('/*\n' + license + '\n*/' + bundle.outputFiles[0].text).replace(/<\/script/gi, '<\\/script'));
await mkdir(new URL('dist/', root), {recursive: true});
await writeFile(new URL('dist/arenamon-combate-laboratorio.html', root), html);
console.log(`laboratório: ${(html.length / 1024).toFixed(0)} KB`);
