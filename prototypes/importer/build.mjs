import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('.',import.meta.url);
const bundle=await build({entryPoints:[fileURLToPath(new URL('src/main.js',root))],bundle:true,write:false,format:'iife',minify:true,legalComments:'inline'});
const template=await readFile(new URL('src/template.html',root),'utf8');
const license=await readFile(new URL('../../node_modules/three/LICENSE',root),'utf8');
await mkdir(new URL('dist/',root),{recursive:true});
await writeFile(new URL('dist/importador-prototipo.html',root),template.replace('/*__BUNDLE__*/',()=>('/*\n'+license+'\n*/'+bundle.outputFiles[0].text).replace(/<\/script/gi,'<\\/script')));
