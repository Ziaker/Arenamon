import {build} from 'esbuild';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = new URL('.', import.meta.url);
const entry = fileURLToPath(new URL('src/main.js', root));
const bundle = await build({entryPoints: [entry], bundle: true, write: false, format: 'iife', minify: true, legalComments: 'inline', target: 'es2022'});
const [template, css, threeLicense, quarksLicense] = await Promise.all([
  readFile(new URL('src/template.html', root), 'utf8'),
  readFile(new URL('src/styles.css', root), 'utf8'),
  readFile(new URL('../../node_modules/three/LICENSE', root), 'utf8'),
  readFile(new URL('../../node_modules/three.quarks/LICENSE', root), 'utf8'),
]);
const script = ('/*\n' + threeLicense + '\n' + quarksLicense + '\n*/\n' + bundle.outputFiles[0].text).replace(/<\/script/gi, '<\\/script');
const html = template.replace('/*__CSS__*/', () => css).replace('/*__BUNDLE__*/', () => script);
await mkdir(new URL('dist/', root), {recursive: true});
await writeFile(new URL('dist/arenamon-areia-pedra.html', root), html);
console.log(`Sand Wave / Emerging Stone: ${Math.round(Buffer.byteLength(html) / 1024)} KB, HTML offline único`);
