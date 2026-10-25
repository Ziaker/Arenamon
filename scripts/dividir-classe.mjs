// Divide uma classe grande em arquivos de MÉTODOS (mixins) sem alterar o corpo de nenhum método.
//   node scripts/dividir-classe.mjs <plano.json> [--seco]
// plano.json: {"arquivo": ".../world-view.js", "classe": "WorldView", "pasta": ".../world-view",
//              "modulos": {"wv-map": {"metodos": ["drawMap", "_removeMapMesh"], "declaracoes": []}}}
// Cada módulo exporta um objeto com os métodos; a classe original recebe `Object.assign(Classe.prototype, ...)` logo depois da declaração.
// Fica no original: constructor e o que não for listado. "declaracoes" move variáveis/funções de topo que SÓ aqueles métodos usam
// (necessário para `let` reatribuído dentro de método). Recusa getters, setters, estáticos e `super`.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {parse} from 'acorn';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dry = process.argv.includes('--seco');
const plan = JSON.parse(readFileSync(path.resolve(process.argv[2]), 'utf8'));
const srcPath = path.resolve(root, plan.arquivo), src = readFileSync(srcPath, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
const ast = parse(src, {ecmaVersion: 'latest', sourceType: 'module'});
const dir = path.resolve(root, plan.pasta);
const rel = (from, to) => { const r = path.relative(path.dirname(from), to).replaceAll('\\', '/'); return r.startsWith('.') ? r : './' + r; };

const imports = ast.body.filter(s => s.type === 'ImportDeclaration');
const importOf = new Map(); for (const imp of imports) for (const sp of imp.specifiers) importOf.set(sp.local.name, imp);
const topDecl = new Map();   // nome -> statement (declarações de topo que não são a classe)
const names = d => d.type === 'VariableDeclaration' ? d.declarations.flatMap(x => collect(x.id)) : d.id ? [d.id.name] : [];
function collect(p) { if (p.type === 'Identifier') return [p.name]; if (p.type === 'ObjectPattern') return p.properties.flatMap(x => collect(x.value ?? x.argument)); if (p.type === 'ArrayPattern') return p.elements.filter(Boolean).flatMap(collect); if (p.type === 'AssignmentPattern') return collect(p.left); return []; }
let clsStmt = null, cls = null;
for (const st of ast.body) {
  const d = st.type === 'ExportNamedDeclaration' ? st.declaration : st;
  if (!d || st.type === 'ImportDeclaration') continue;
  if (d.type === 'ClassDeclaration' && d.id.name === plan.classe) {clsStmt = st; cls = d; continue;}
  for (const n of names(d)) topDecl.set(n, st);
}
if (!cls) throw new Error(`classe ${plan.classe} não encontrada`);
const members = cls.body.body;
for (const m of members) if (m.type !== 'MethodDefinition' || m.static || m.kind === 'get' || m.kind === 'set') { if (!(m.type === 'MethodDefinition' && m.kind === 'constructor')) throw new Error(`membro não suportado (${m.type}/${m.kind}) em ${src.slice(m.start, m.start + 40)}`); }
function idents(node, out = new Set()) { if (!node || typeof node.type !== 'string') return out; if (node.type === 'Identifier') out.add(node.name); if (node.type === 'Super') throw new Error('super não suportado'); for (const k of Object.keys(node)) { if (k === 'type') continue; const v = node[k]; if (Array.isArray(v)) v.forEach(x => x && typeof x === 'object' && idents(x, out)); else if (v && typeof v === 'object') idents(v, out); } return out; }

// texto de cada membro, incluindo os comentários que o antecedem
const text = new Map(), startOf = new Map(); let prev = cls.body.start + 1;
for (const m of members) {text.set(m, src.slice(prev, m.end).replace(/^\s+/, '')); startOf.set(m, prev); prev = m.end;}
const byName = new Map(members.map(m => [m.key.name, m]));
const moved = new Set(), outFiles = {};
const movedDecl = new Set();
const mixinNames = [];
for (const [mod, spec] of Object.entries(plan.modulos)) {
  const ms = spec.metodos.map(n => { const m = byName.get(n); if (!m) throw new Error(`método ${n} não existe`); if (moved.has(m)) throw new Error(`${n} em dois módulos`); moved.add(m); return m; });
  const decls = (spec.declaracoes ?? []).map(n => { const st = topDecl.get(n); if (!st) throw new Error(`declaração ${n} não existe`); return st; });
  const uniqDecls = [...new Set(decls)]; for (const st of uniqDecls) movedDecl.add(st);
  const used = new Set(); for (const m of ms) idents(m, used); for (const st of uniqDecls) idents(st, used);
  const ownNames = new Set(uniqDecls.flatMap(st => names(st.type === 'ExportNamedDeclaration' ? st.declaration : st)));
  const file = path.join(dir, mod + '.js');
  const lines = [];
  for (const imp of imports) {
    const spec2 = imp.specifiers.filter(sp => used.has(sp.local.name));
    if (!spec2.length) continue;
    const abs = path.resolve(path.dirname(srcPath), imp.source.value);
    const from = imp.source.value.startsWith('.') ? rel(file, abs) : imp.source.value;
    const def = spec2.find(s => s.type === 'ImportDefaultSpecifier'), ns = spec2.find(s => s.type === 'ImportNamespaceSpecifier'), named = spec2.filter(s => s.type === 'ImportSpecifier');
    const parts = []; if (def) parts.push(def.local.name); if (ns) parts.push('* as ' + ns.local.name);
    if (named.length) parts.push('{' + named.map(s => s.imported.name === s.local.name ? s.local.name : `${s.imported.name} as ${s.local.name}`).join(', ') + '}');
    lines.push(`import ${parts.join(', ')} from '${from}';`);
  }
  // declarações de topo usadas e que NÃO foram movidas para este módulo: ficam no original e são importadas dele
  const fromOriginal = [...used].filter(n => topDecl.has(n) && !ownNames.has(n) && !importOf.has(n));
  if (fromOriginal.length) lines.push(`import {${fromOriginal.sort().join(', ')}} from '${rel(file, srcPath)}';   // declarado no arquivo original (precisa de export)`);
  const declText = uniqDecls.map(st => src.slice(st.start, st.end)).join(eol);
  const body = ms.map(m => text.get(m).trimEnd()).join(',' + eol + eol);
  outFiles[file] = [`// Dividido de ${path.basename(plan.arquivo)} (comportamento idêntico): métodos de ${plan.classe} — ${mod}.`, '// Mixin: Object.assign(' + plan.classe + '.prototype, ' + mod.replace(/-(.)/g, (_, c) => c.toUpperCase()) + ') no arquivo original.', '', ...lines, '', declText ? declText + eol : '', `export const ${mod.replace(/-(.)/g, (_, c) => c.toUpperCase())} = {`, body, '};', ''].join(eol);
  mixinNames.push({mod, id: mod.replace(/-(.)/g, (_, c) => c.toUpperCase())});
}
// original: remove os métodos e as declarações movidas, adiciona imports e o Object.assign
let out = src; const cuts = [];
for (const m of moved) cuts.push([startOf.get(m), m.end]);
for (const st of movedDecl) cuts.push([st.start, st.end]);
cuts.sort((a, b) => b[0] - a[0]);
for (const [a, b] of cuts) out = out.slice(0, a) + out.slice(b);
const clsEndMarker = out.indexOf('\n}', out.indexOf('class ' + plan.classe)) ;   // fim do corpo da classe (primeira chave na coluna 0 após a classe)
const mixImports = mixinNames.map(({mod, id}) => `import {${id}} from './${path.basename(plan.pasta)}/${mod}.js';`).join(eol);
const assign = `${eol}${eol}// Métodos divididos em módulos menores (pasta ${path.basename(plan.pasta)}/): mesmos corpos, agora anexados ao protótipo.${eol}Object.assign(${plan.classe}.prototype, ${mixinNames.map(m => m.id).join(', ')});`;
// ponto de inserção do Object.assign: fim do statement da classe no texto novo
const reAst = parse(out, {ecmaVersion: 'latest', sourceType: 'module'});
const reCls = reAst.body.find(st => (st.type === 'ExportNamedDeclaration' ? st.declaration : st)?.id?.name === plan.classe && (st.type === 'ExportNamedDeclaration' ? st.declaration : st).type === 'ClassDeclaration');
out = out.slice(0, reCls.end) + assign + out.slice(reCls.end);
const firstImportEnd = reAst.body.filter(s => s.type === 'ImportDeclaration').at(-1).end;
out = out.slice(0, firstImportEnd) + eol + mixImports + out.slice(firstImportEnd);
// tira dos imports originais o que deixou de ser usado
const reAst2 = parse(out, {ecmaVersion: 'latest', sourceType: 'module'});
const nonImport = reAst2.body.filter(s => s.type !== 'ImportDeclaration').map(s => out.slice(s.start, s.end)).join('\n');
const redo = [];
for (const imp of reAst2.body.filter(s => s.type === 'ImportDeclaration')) {
  const keep = imp.specifiers.filter(sp => new RegExp('(^|[^A-Za-z0-9_$.])' + sp.local.name.replace(/\$/g, '\\$') + '($|[^A-Za-z0-9_$])').test(nonImport));
  redo.push([imp, keep]);
}
for (const [imp, keep] of redo.reverse()) {
  let repl = '';
  if (keep.length) {
    const def = keep.find(s => s.type === 'ImportDefaultSpecifier'), ns = keep.find(s => s.type === 'ImportNamespaceSpecifier'), named = keep.filter(s => s.type === 'ImportSpecifier');
    const parts = []; if (def) parts.push(def.local.name); if (ns) parts.push('* as ' + ns.local.name);
    if (named.length) parts.push('{' + named.map(s => s.imported.name === s.local.name ? s.local.name : `${s.imported.name} as ${s.local.name}`).join(', ') + '}');
    repl = `import ${parts.join(', ')} from '${imp.source.value}';`;
  }
  out = out.slice(0, imp.start) + repl + out.slice(imp.end);
}
outFiles[srcPath] = out;
for (const [f, t] of Object.entries(outFiles)) console.log(`${dry ? '[seco] ' : ''}${path.relative(root, f)}: ${t.split('\n').length} linhas`);
if (!dry) { mkdirSync(dir, {recursive: true}); for (const [f, t] of Object.entries(outFiles)) writeFileSync(f, t); }
