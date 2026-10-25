// Divide um script "raiz de composição" (como combat-lab/src/main.js) em módulos, sem alterar o texto das declarações.
//   node scripts/dividir-raiz.mjs <plano.json> [--seco]
// Plano:
//  { "arquivo": ".../main.js", "pasta": ".../app",
//    "modulos": { "match-flow": ["startMatch", "togglePause", ...] },      // declarações de topo (function/const/let/class) movidas
//    "fios":   [ { "modulo": "wire-recording", "funcao": "wireRecording", "de": "$('rec-save').onclick", "ate": "window.__labRecording" } ] }
// - "modulos": cada nome vira declaração do módulo (com `export`); o original passa a importá-los.
// - "fios": uma faixa CONTÍGUA de statements (do que começa com "de" ao que começa com "ate", inclusive) vira o corpo de uma função
//   exportada, chamada no MESMO ponto do original (a ordem de execução se mantém). Nomes declarados dentro da faixa ficam locais:
//   a ferramenta recusa se algo fora da faixa os usar.
// O que não foi listado fica no original, que passa a EXPORTAR as declarações que os módulos usam. Os módulos importam do original
// (ciclo permitido: eles só definem funções, nada executa na carga). `let` reatribuído fora do módulo onde mora é recusado.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {parse} from 'acorn';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dry = process.argv.includes('--seco');
const plan = JSON.parse(readFileSync(path.resolve(process.argv[2]), 'utf8'));
const srcPath = path.resolve(root, plan.arquivo), srcRaw = readFileSync(srcPath, 'utf8');
const src = srcRaw.replace(/\r\n/g, '\n'), eol = '\n';
const ast = parse(src, {ecmaVersion: 'latest', sourceType: 'module'});
const dir = path.resolve(root, plan.pasta), folder = path.basename(plan.pasta);
const rel = (from, to) => { const r = path.relative(path.dirname(from), to).replaceAll('\\', '/'); return r.startsWith('.') ? r : './' + r; };

function collect(p) { if (!p) return []; if (p.type === 'Identifier') return [p.name]; if (p.type === 'ObjectPattern') return p.properties.flatMap(x => collect(x.value ?? x.argument)); if (p.type === 'ArrayPattern') return p.elements.filter(Boolean).flatMap(collect); if (p.type === 'AssignmentPattern') return collect(p.left); if (p.type === 'RestElement') return collect(p.argument); return []; }
const declNames = st => { const d = st.type === 'ExportNamedDeclaration' ? st.declaration : st; if (!d) return []; if (d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') return [d.id.name]; if (d.type === 'VariableDeclaration') return d.declarations.flatMap(x => collect(x.id)); return []; };
const kindOf = st => { const d = st.type === 'ExportNamedDeclaration' ? st.declaration : st; return d?.type === 'VariableDeclaration' ? d.kind : null; };
function idents(node, out = new Set()) { if (!node || typeof node.type !== 'string') return out; if (node.type === 'Identifier') out.add(node.name); for (const k of Object.keys(node)) { if (k === 'type') continue; const v = node[k]; if (Array.isArray(v)) v.forEach(x => x && typeof x === 'object' && idents(x, out)); else if (v && typeof v === 'object') idents(v, out); } return out; }
function assigned(node, out = new Set()) { if (!node || typeof node.type !== 'string') return out; if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier') out.add(node.left.name); if (node.type === 'UpdateExpression' && node.argument.type === 'Identifier') out.add(node.argument.name); for (const k of Object.keys(node)) { const v = node[k]; if (Array.isArray(v)) v.forEach(x => x && typeof x === 'object' && assigned(x, out)); else if (v && typeof v === 'object') assigned(v, out); } return out; }

const imports = ast.body.filter(s => s.type === 'ImportDeclaration');
const importOf = new Map(); for (const imp of imports) for (const sp of imp.specifiers) importOf.set(sp.local.name, imp);
// comentário na mesma linha do fim do statement acompanha o statement
const lineEnd = pos => { const nl = src.indexOf('\n', pos), stop = nl < 0 ? src.length : nl; return /^[ \t]*(\/\/[^\n]*)?$/.test(src.slice(pos, stop)) ? stop : pos; };
const items = []; let prevEnd = 0;
for (const st of ast.body) {
  const end = lineEnd(st.end);
  if (st.type === 'ImportDeclaration') { prevEnd = end; continue; }
  items.push({st, names: declNames(st), kind: kindOf(st), start: prevEnd, end, text: null});
  prevEnd = end;
}
// Faixas "fios"
const startsWith = (it, s) => src.slice(it.st.start, it.st.start + s.length) === s;
const where = new Map();   // item -> {mod}
const owner = new Map();   // nome -> módulo ('(raiz)' = original)
const wires = [];
for (const f of plan.fios ?? []) {
  const a = items.findIndex(it => startsWith(it, f.de)), b = items.findIndex((it, i) => i >= a && startsWith(it, f.ate));
  if (a < 0 || b < 0) throw new Error(`fio ${f.funcao}: marcador não encontrado (${a < 0 ? f.de : f.ate})`);
  const range = items.slice(a, b + 1);
  for (const it of range) if (where.has(it)) throw new Error(`fio ${f.funcao}: statement já usado`);
  for (const it of range) where.set(it, {wire: f});
  wires.push({...f, range, a});
}
for (const [mod, names] of Object.entries(plan.modulos ?? {})) for (const n of names) {
  const it = items.find(i => i.names.includes(n));
  if (!it) throw new Error(`"${n}" não é declaração de topo`);
  if (where.has(it) && where.get(it).mod !== mod) throw new Error(`"${n}" duplicado/em fio`);
  where.set(it, {mod});
}
for (const it of items) if (!where.has(it)) where.set(it, {mod: '(raiz)'});
for (const it of items) { const w = where.get(it); if (w.mod) for (const n of it.names) owner.set(n, w.mod); }
// nomes declarados dentro de fios: locais; não podem ser usados fora
const wireLocal = new Map();
for (const w of wires) for (const it of w.range) for (const n of it.names) wireLocal.set(n, w.funcao);
for (const it of items) {
  const w = where.get(it); const used = idents(it.st);
  for (const [n, fn] of wireLocal) if (used.has(n) && !(w.wire && w.wire.funcao === fn) && !(it.names.includes(n))) throw new Error(`"${n}" é local do fio ${fn} mas é usado fora dele (${src.slice(it.st.start, it.st.start + 60).replace(/\n/g, ' ')}…)`);
}
// let reatribuído fora do módulo onde mora
const lets = new Set(items.filter(i => i.kind === 'let').flatMap(i => i.names));
function localDecls(node, out = new Set()) { if (!node || typeof node.type !== 'string') return out; if (node.type === 'VariableDeclarator') collect(node.id).forEach(n => out.add(n)); if (/Function/.test(node.type)) for (const pa of node.params ?? []) collect(pa).forEach(n => out.add(n)); if (node.type === 'CatchClause' && node.param) collect(node.param).forEach(n => out.add(n)); for (const k of Object.keys(node)) { const v = node[k]; if (Array.isArray(v)) v.forEach(x => x && typeof x === 'object' && localDecls(x, out)); else if (v && typeof v === 'object') localDecls(v, out); } return out; }
for (const it of items) { const w = where.get(it); const loc = it.names.length ? new Set() : localDecls(it.st); const inner = localDecls(it.st); for (const n of it.names) inner.delete(n); const asg = [...assigned(it.st)].filter(n => !inner.has(n)); for (const n of asg) if (lets.has(n)) { const o = owner.get(n); const here = w.wire ? '(fio ' + w.wire.funcao + ')' : w.mod; if (o && o !== here && !(w.wire && wireLocal.get(n) === w.wire.funcao)) throw new Error(`let "${n}" mora em ${o} mas é reatribuído em ${here}`); } }

const text = it => src.slice(it.start, it.end).replace(/^\n+/, '').replace(/\s+$/, '') + '\n';
// nomes da raiz usados por módulos/fios => export
const needExport = new Set();
const buckets = new Map();   // arquivo (mod) -> {items:[], wires:[]}
const bucket = m => { if (!buckets.has(m)) buckets.set(m, {items: [], wires: []}); return buckets.get(m); };
for (const it of items) { const w = where.get(it); if (w.mod && w.mod !== '(raiz)') bucket(w.mod).items.push(it); }
for (const w of wires) bucket(w.modulo).wires.push(w);

function importsFor(used, ownNames, file) {
  const lines = [], sib = new Map();
  for (const imp of imports) {
    const spec = imp.specifiers.filter(sp => used.has(sp.local.name) && !ownNames.has(sp.local.name));
    if (!spec.length) continue;
    const abs = path.resolve(path.dirname(srcPath), imp.source.value);
    const from = imp.source.value.startsWith('.') ? rel(file, abs) : imp.source.value;
    const def = spec.find(s => s.type === 'ImportDefaultSpecifier'), ns = spec.find(s => s.type === 'ImportNamespaceSpecifier'), named = spec.filter(s => s.type === 'ImportSpecifier');
    const parts = []; if (def) parts.push(def.local.name); if (ns) parts.push('* as ' + ns.local.name);
    if (named.length) parts.push('{' + named.map(s => s.imported.name === s.local.name ? s.local.name : `${s.imported.name} as ${s.local.name}`).join(', ') + '}');
    lines.push(`import ${parts.join(', ')} from '${from}';`);
  }
  for (const n of used) {
    if (ownNames.has(n) || importOf.has(n)) continue;
    const o = owner.get(n); if (!o) continue;
    const f = o === '(raiz)' ? srcPath : path.join(dir, o + '.js');
    if (f === file) continue;
    if (o === '(raiz)') needExport.add(n);
    if (!sib.has(f)) sib.set(f, new Set()); sib.get(f).add(n);
  }
  for (const [f, names] of sib) lines.push(`import {${[...names].sort().join(', ')}} from '${rel(file, f)}';`);
  return lines;
}
const out = {};
const head = '// @ts-check';
for (const [mod, b] of buckets) {
  const file = path.join(dir, mod + '.js');
  const used = new Set(), own = new Set();
  for (const it of b.items) { idents(it.st, used); it.names.forEach(n => own.add(n)); }
  for (const w of b.wires) for (const it of w.range) { idents(it.st, used); it.names.forEach(n => own.add(n)); }
  const parts = [];
  for (const it of b.items) parts.push(text(it));
  const body = parts.join('\n');
  const wireText = b.wires.map(w => `export function ${w.funcao}() {\n${w.range.map(text).join('')}}\n`).join('\n');
  out[file] = {mod, used, own, body, wireText, b};
}
const outputs = {};
for (const [file, o] of Object.entries(out)) {
  const lines = importsFor(o.used, o.own, file);
  // exporta tudo que o módulo declara (os irmãos e a raiz podem precisar)
  let body = o.body.replace(/^(\s*(?:\/\*\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*)(async function|function|class|const|let|var)\b/gm, (m, pre, kw) => `${pre}export ${kw}`);
  // só declarações de topo ganham export: a regex acima é aplicada por statement abaixo (evita atingir blocos internos)
  body = o.b.items.map(it => { const t = text(it); return /^(\s*(?:\/\*\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*)(async function|function|class|const|let|var)\b/.test(t) && it.st.type !== 'ExportNamedDeclaration' ? t.replace(/^(\s*(?:\/\*\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*)(async function|function|class|const|let|var)\b/, (m, pre, kw) => `${pre}export ${kw}`) : t; }).join('\n');
  outputs[file] = [head, `// Dividido de ${path.basename(plan.arquivo)} (comportamento idêntico): ${o.mod}.`, '', ...lines, '', body, o.wireText].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
// raiz: remove o que saiu, troca fios por chamadas, importa módulos, exporta o que for preciso
const cuts = [];
for (const it of items) { const w = where.get(it); if (w.mod && w.mod !== '(raiz)') cuts.push({a: it.start, b: it.end, repl: ''}); }
for (const w of wires) { const first = w.range[0], last = w.range.at(-1); cuts.push({a: first.start, b: last.end, repl: `\n${w.funcao}();\n`}); }
cuts.sort((x, y) => y.a - x.a);
let root2 = src;
for (const c of cuts) root2 = root2.slice(0, c.a) + c.repl + root2.slice(c.b);
// exports na raiz
const rootAst = parse(root2, {ecmaVersion: 'latest', sourceType: 'module'});
const exp = [];
for (const st of rootAst.body) { if (st.type === 'ImportDeclaration') continue; const d = st.declaration ?? st; const ns = declNames(st); if (st.type !== 'ExportNamedDeclaration' && ns.some(n => needExport.has(n))) exp.push(st); }
// declarações com várias variáveis (const a = .., b = ..): export const a, b é válido
exp.sort((x, y) => y.start - x.start);
for (const st of exp) { const d = st; const m = /^(\s*(?:\/\*\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*)(async function|function|class|const|let|var)\b/.exec(root2.slice(st.start, st.end)); if (!m) continue; root2 = root2.slice(0, st.start) + root2.slice(st.start, st.end).replace(m[0], m[1] + 'export ' + m[2]) + root2.slice(st.end); }
// imports de módulos na raiz (nomes que a raiz ainda usa + funções de fio)
const rootAst2 = parse(root2, {ecmaVersion: 'latest', sourceType: 'module'});
const usedRoot = new Set(); for (const st of rootAst2.body) if (st.type !== 'ImportDeclaration') idents(st, usedRoot);
const modImports = new Map();
for (const [file, o] of Object.entries(out)) {
  const names = [...[...o.own].filter(n => usedRoot.has(n) && owner.get(n) === o.mod), ...o.b.wires.map(w => w.funcao)];
  if (names.length) modImports.set(o.mod, names);
}
const lastImp = rootAst2.body.filter(s => s.type === 'ImportDeclaration').at(-1);
const addImports = [...modImports].map(([m, names]) => `import {${[...new Set(names)].sort().join(', ')}} from './${folder}/${m}.js';`).join('\n');
root2 = root2.slice(0, lastImp.end) + '\n' + addImports + root2.slice(lastImp.end);
// remove do original imports que ninguém mais usa
const rootAst3 = parse(root2, {ecmaVersion: 'latest', sourceType: 'module'});
const body3 = rootAst3.body.filter(s => s.type !== 'ImportDeclaration').map(s => root2.slice(s.start, s.end)).join('\n');
const idRe = n => new RegExp(String.raw`(?:^|[^\w$.]|\.\.\.)` + n.replace(/\$/g, String.raw`\$`) + String.raw`(?![\w$])`);
const impEdits = [];
for (const imp of rootAst3.body.filter(s => s.type === 'ImportDeclaration')) {
  if (imp.source.value.startsWith('./' + folder + '/')) continue;
  const keep = imp.specifiers.filter(sp => idRe(sp.local.name).test(body3));
  if (keep.length === imp.specifiers.length) continue;
  let repl = '';
  if (keep.length) { const def = keep.find(s => s.type === 'ImportDefaultSpecifier'), ns = keep.find(s => s.type === 'ImportNamespaceSpecifier'), named = keep.filter(s => s.type === 'ImportSpecifier'); const parts = []; if (def) parts.push(def.local.name); if (ns) parts.push('* as ' + ns.local.name); if (named.length) parts.push('{' + named.map(s => s.imported.name === s.local.name ? s.local.name : `${s.imported.name} as ${s.local.name}`).join(', ') + '}'); repl = `import ${parts.join(', ')} from '${imp.source.value}';`; }
  impEdits.push([imp.start, imp.end, repl]);
}
impEdits.sort((a, b) => b[0] - a[0]);
for (const [a, b, r] of impEdits) root2 = root2.slice(0, a) + r + root2.slice(b);
root2 = root2.replace(/\n{4,}/g, '\n\n\n');
outputs[srcPath] = root2;

for (const [f, t] of Object.entries(outputs)) console.log(`${dry ? '[seco] ' : ''}${path.relative(root, f)}: ${t.split('\n').length} linhas`);
if (!dry) { mkdirSync(dir, {recursive: true}); for (const [f, t] of Object.entries(outputs)) writeFileSync(f, srcRaw.includes('\r\n') && f === srcPath ? t.replace(/\n/g, '\r\n') : t); }
