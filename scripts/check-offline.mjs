// Varredura ESTÁTICA de dependências externas nos HTMLs finais (dist/*.html e propostas de rigging).
// Complementa — não substitui — os testes de execução offline dos protótipos (que abrem o HTML com a rede desligada).
// Falha quando um HTML carrega algo de fora por elemento (<script src>, <link href>, <img src>, <iframe src>, <source>,
// <video>, <audio>, <embed>, <object>), por CSS (@import, url()) ou por código (fetch, import(), Worker, XHR, WebSocket,
// EventSource, importScripts, sendBeacon) com endereço http(s):// ou protocolo-relativo (//). Textos, comentários, namespaces
// XML e links <a href> não carregam nada e não são tratados como violação (links <a> aparecem só como aviso informativo).
// Uso: node scripts/check-offline.mjs [arquivo.html ...]   (sem argumentos: varre os HTMLs finais do repositório)
import {readFileSync, readdirSync, statSync, existsSync} from 'node:fs';
import {resolve, relative, join, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const REMOTE = String.raw`(?:https?:)?\/\/(?!\/)`; // http://, https:// ou //host (não conta file:///)
const ATTR = ['script', 'link', 'img', 'iframe', 'source', 'video', 'audio', 'embed', 'object', 'track', 'input', 'image', 'use'];
const RULES = [
  {id: 'elemento', re: new RegExp(String.raw`<(?:${ATTR.join('|')})\b[^>]*?\b(?:src|href|data|poster|xlink:href)\s*=\s*["']?\s*${REMOTE}`, 'gi'), desc: 'elemento HTML que carrega recurso remoto'},
  {id: 'css-import', re: new RegExp(String.raw`@import\s+(?:url\(\s*)?["']?\s*${REMOTE}`, 'gi'), desc: '@import remoto'},
  {id: 'css-url', re: new RegExp(String.raw`url\(\s*["']?\s*${REMOTE}`, 'gi'), desc: 'url() remoto em CSS'},
  {id: 'js-chamada', re: new RegExp(String.raw`\b(?:fetch|importScripts|sendBeacon)\s*\(\s*["'\x60]\s*${REMOTE}`, 'gi'), desc: 'fetch/importScripts/sendBeacon com endereço remoto'},
  {id: 'js-import', re: new RegExp(String.raw`\bimport\s*\(\s*["'\x60]\s*${REMOTE}|\bfrom\s*["']\s*${REMOTE}`, 'g'), desc: 'import remoto'},
  {id: 'js-construtor', re: new RegExp(String.raw`\bnew\s+(?:Worker|SharedWorker|EventSource|WebSocket)\s*\(\s*["'\x60]\s*(?:wss?:|${REMOTE})`, 'g'), desc: 'Worker/WebSocket/EventSource remoto'},
  {id: 'js-xhr', re: new RegExp(String.raw`\.open\(\s*["'][A-Za-z]+["']\s*,\s*["'\x60]\s*${REMOTE}`, 'g'), desc: 'XMLHttpRequest remoto'},
];

/** Devolve as violações de um texto HTML: [{regra, descricao, linha, trecho}]. */
export function findExternalRefs(html) {
  const out = [];
  for (const r of RULES) {
    for (const m of html.matchAll(r.re)) {
      const line = html.slice(0, m.index).split('\n').length;
      out.push({regra: r.id, descricao: r.desc, linha: line, trecho: m[0].replace(/\s+/g, ' ').slice(0, 120)});
    }
  }
  return out;
}
/** Links <a href> externos (informativo: não carregam recursos automaticamente). */
export function findExternalLinks(html) {
  return [...html.matchAll(new RegExp(String.raw`<a\b[^>]*?\bhref\s*=\s*["']\s*(${REMOTE}[^"'\s>]*)`, 'gi'))].map(m => m[1]);
}

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
/** HTMLs finais: os .html de pastas `dist` em prototypes e as propostas de rigging. Ignora croagunk (fora do Git), node_modules e .worktrees. */
export function defaultTargets() {
  const found = [];
  const skip = new Set(['node_modules', '.git', '.worktrees', 'croagunk', 'validation', 'evidence', 'archives', 'Nova pasta']);
  (function walk(dir, depth) {
    if (depth > 5) return;
    let entries;
    try {entries = readdirSync(dir, {withFileTypes: true});} catch {return;}
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {if (!skip.has(e.name)) walk(p, depth + 1);}
      else if (e.name.endsWith('.html') && (relative(root, dir).split(sep).at(-1) === 'dist' || /prototypes[\\/]studio[\\/]proposals$/.test(relative(root, dir)))) found.push(p);
    }
  })(join(root, 'prototypes'), 0);
  return found.sort();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2).map(a => resolve(a));
  const targets = args.length ? args : defaultTargets();
  if (!targets.length) {console.error('Nenhum HTML final encontrado. Execute `npm run build` antes.');process.exit(1);}
  let failed = 0;
  console.log('[Varredura estática de dependências externas]');
  for (const file of targets) {
    if (!existsSync(file)) {console.error(`  ✖ ${file}: arquivo não encontrado`);failed++;continue;}
    const html = readFileSync(file, 'utf8'), kb = (statSync(file).size / 1024).toFixed(0), rel = relative(root, file).split(sep).join('/');
    const bad = findExternalRefs(html), links = findExternalLinks(html);
    if (bad.length) {
      failed++;
      console.error(`  ✖ ${rel} (${kb} KB): ${bad.length} referência(s) externa(s)`);
      for (const b of bad.slice(0, 10)) console.error(`      linha ${b.linha} [${b.regra}] ${b.trecho}`);
    } else console.log(`  ✓ ${rel} (${kb} KB)${links.length ? ` — ${links.length} link(s) <a> externo(s), informativo` : ''}`);
  }
  if (failed) {console.error(`\nFALHA: ${failed} arquivo(s) com dependência externa. Isso NÃO substitui os testes de execução offline.`);process.exit(1);}
  console.log(`\n✓ ${targets.length} HTML(s) sem dependências externas estáticas (complementa os testes de execução offline).`);
}
