// Gera dist/arenamon-animation-studio.html: um único HTML offline com Three.js, loaders, exportador e editor.
import {build} from 'esbuild';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = new URL('.', import.meta.url);
const bundle = await build({entryPoints: [fileURLToPath(new URL('src/main.js', root))], bundle: true, write: false, format: 'iife', minify: true, legalComments: 'inline', target: 'es2022',loader:{'.glb':'dataurl'}});
const [template, markup, shell, css, layoutCss, rigCss, libraryCss, license] = await Promise.all([
  readFile(new URL('src/template.html', root), 'utf8'),
  readFile(new URL('src/editor/markup.html', root), 'utf8'),
  readFile(new URL('src/ui/shell.html', root), 'utf8'),
  readFile(new URL('src/editor/editor.css', root), 'utf8'),
  readFile(new URL('src/ui/layout.css', root), 'utf8'),
  readFile(new URL('src/rigging/rigging.css', root), 'utf8'),
  readFile(new URL('src/library/library.css', root), 'utf8'),
  readFile(new URL('../../node_modules/three/LICENSE', root), 'utf8'),
]);
const script = ('/*\n' + license + '\n*/' + bundle.outputFiles[0].text).replace(/<\/script/gi, '<\\/script');
const html = template
  .replace('</head>', () => `<style>\n${css}\n${layoutCss}\n${rigCss}\n${libraryCss}</style></head>`)
  .replace('<!--__EDITOR_MARKUP__-->', () => markup + shell)
  .replace('/*__BUNDLE__*/', () => script)
  .replace(/<title>[^<]*<\/title>/, '<title>Arenamon Animation Studio v7 · Editor</title>');
await mkdir(new URL('dist/', root), {recursive: true});
await writeFile(new URL('dist/arenamon-animation-studio.html', root), html);
console.log(`studio: ${(html.length / 1024).toFixed(0)} KB`);
