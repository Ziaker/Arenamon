// Autoteste da varredura estática: casos que DEVEM falhar e casos que NÃO devem (namespaces, comentários, links <a>).
import assert from 'node:assert/strict';
import {findExternalRefs, findExternalLinks} from './check-offline.mjs';

const bad = {
  'script src': '<script src="https://cdn.example.com/a.js"></script>',
  'script src protocolo-relativo': '<script src=//cdn.example.com/a.js></script>',
  'link css': '<link rel="stylesheet" href="http://x.test/a.css">',
  'img src': '<img alt="" src="https://x.test/a.png">',
  'iframe': "<iframe src='https://x.test/'></iframe>",
  'css @import': '<style>@import url("https://fonts.example/css");</style>',
  'css @import sem url()': '<style>@import "https://fonts.example/css";</style>',
  'css url()': '<style>body{background:url(https://x.test/bg.png)}</style>',
  'fetch': '<script>fetch("https://api.example.com/x")</script>',
  'fetch template': '<script>fetch(`https://api.example.com/x`)</script>',
  'import()': '<script>import("https://esm.sh/three")</script>',
  'import from': '<script type="module">import * as T from "https://esm.sh/three"</script>',
  'Worker': '<script>new Worker("https://x.test/w.js")</script>',
  'WebSocket': '<script>new WebSocket("wss://x.test/s")</script>',
  'XHR': '<script>x.open("GET","https://x.test/a")</script>',
  'importScripts': '<script>importScripts("https://x.test/a.js")</script>',
};
for (const [name, html] of Object.entries(bad)) assert.ok(findExternalRefs(html).length > 0, `deveria detectar: ${name}`);

const good = {
  'namespace svg': '<svg xmlns="http://www.w3.org/2000/svg"><use href="#a"/></svg>',
  'comentário de licença': '<script>/* ver https://jcgt.org/published/0007/04/01/ */var a=1</script>',
  'texto com endereço': '<script>var dica="abre em http://127.0.0.1:5173";</script>',
  'script inline': '<script>var a=fetch("./dados.json")</script>',
  'script relativo': '<script src="./app.js"></script>',
  'blob/data': '<img src="data:image/png;base64,AAAA"><script>fetch("blob:x")</script>',
  'file local': '<a href="file:///C:/x.html">x</a><img src="file:///C:/a.png">',
  'link <a> externo': '<a href="https://github.com/Ziaker/Arenamon">repo</a>',
  'barra dupla em caminho relativo': '<script>var u="a//b"</script>',
};
for (const [name, html] of Object.entries(good)) assert.deepEqual(findExternalRefs(html), [], `não deveria detectar: ${name}`);
assert.deepEqual(findExternalLinks(good['link <a> externo']), ['https://github.com/Ziaker/Arenamon']);

console.log(`✓ check-offline: ${Object.keys(bad).length} casos que devem falhar e ${Object.keys(good).length} que não devem — OK`);
