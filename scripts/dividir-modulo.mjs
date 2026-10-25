// Divide um módulo ES em vários SEM mudar o código das declarações: só as move de lugar.
//   node scripts/dividir-modulo.mjs <plano.json>            -> aplica
//   node scripts/dividir-modulo.mjs <plano.json> --seco     -> só mostra o que faria
// plano.json: { "arquivo": "prototypes/.../map.js", "pasta": "prototypes/.../map", "modulos": { "map-config": ["MAP_DEFAULTS", ...], ... } }
// O arquivo original vira uma FACHADA (`export * from` dos módulos novos + o que sobrou), então nenhum import externo muda.
// Declarações não listadas ficam no original. Cada módulo novo importa o que usa dos irmãos e dos imports originais.
// Recusa-se a dividir quando uma variável `let` de módulo é reatribuída fora do módulo onde mora.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {parse} from 'acorn';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const planFile = process.argv[2], dry = process.argv.includes('--seco');
const plan = JSON.parse(readFileSync(path.resolve(planFile), 'utf8'));
const srcPath = path.resolve(root, plan.arquivo), src = readFileSync(srcPath, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
const ast = parse(src, {ecmaVersion: 'latest', sourceType: 'module', locations: true, onComment: [] });

// Comentários: o acorn não os anexa; tratamos o texto entre o fim do statement anterior e o início deste como "cabeçalho" que acompanha a declaração.
const body = ast.body;
const declNames = st => {
  const d = st.type === 'ExportNamedDeclaration' || st.type === 'ExportDefaultDeclaration' ? st.declaration : st;
  if (!d) return [];
  if (d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') return [d.id.name];
  if (d.type === 'VariableDeclaration') return d.declarations.flatMap(x => collect(x.id));
  return [];
};
function collect(p) {
  if (p.type === 'Identifier') return [p.name];
  if (p.type === 'ObjectPattern') return p.properties.flatMap(x => collect(x.value ?? x.argument));
  if (p.type === 'ArrayPattern') return p.elements.filter(Boolean).flatMap(collect);
  if (p.type === 'AssignmentPattern') return collect(p.left);
  if (p.type === 'RestElement') return collect(p.argument);
  return [];
}
const imports = body.filter(s => s.type === 'ImportDeclaration');
const importedNames = new Map();   // nome local -> statement de import
for (const imp of imports) for (const sp of imp.specifiers) importedNames.set(sp.local.name, imp);
const items = [];   // {names, start, end, node, exported}
let prevEnd = 0;
// o comentário que fecha a MESMA linha do statement vai com ele (não com o próximo)
const lineEnd = pos => { const nl = src.indexOf('\n', pos), stop = nl < 0 ? src.length : nl; return /^[ \t]*(\/\/[^\n]*)?\r?$/.test(src.slice(pos, stop)) ? stop : pos; };
for (const st of body) {
  if (st.type === 'ImportDeclaration') {prevEnd = lineEnd(st.end); continue;}
  const end = lineEnd(st.end);
  items.push({names: declNames(st), start: prevEnd, end, node: st, exported: st.type === 'ExportNamedDeclaration'});
  prevEnd = end;
}
// Identificadores referenciados (aproximação segura: todo Identifier/JSXIdentifier no trecho; sobrar import não faz mal, faltar sim)
function identsIn(node, out = new Set()) {
  if (!node || typeof node.type !== 'string') return out;
  if (node.type === 'Identifier') out.add(node.name);
  for (const k of Object.keys(node)) {
    if (k === 'type' || k === 'loc' || k === 'start' || k === 'end') continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach(x => x && typeof x === 'object' && identsIn(x, out));
    else if (v && typeof v === 'object') identsIn(v, out);
  }
  return out;
}
const owner = new Map();   // nome de declaração -> módulo
const where = new Map();   // item -> módulo
for (const [mod, names] of Object.entries(plan.modulos)) for (const n of names) {
  const it = items.find(i => i.names.includes(n));
  if (!it) throw new Error(`"${n}" não é uma declaração de topo de ${plan.arquivo}`);
  if (where.has(it) && where.get(it) !== mod) throw new Error(`"${n}" está em dois módulos`);
  where.set(it, mod);
}
for (const it of items) if (where.get(it)) for (const n of it.names) owner.set(n, where.get(it));
const MAIN = '(original)';
for (const it of items) if (!where.has(it)) {where.set(it, MAIN); for (const n of it.names) owner.set(n, MAIN);}

// `let` de módulo reatribuído em outro módulo = ilegal ao dividir
const lets = new Set(items.filter(i => i.node.type === 'VariableDeclaration' || i.node.declaration?.type === 'VariableDeclaration').filter(i => (i.node.declaration ?? i.node).kind === 'let').flatMap(i => i.names));
function assignedIn(node, found = new Set()) {
  if (!node || typeof node.type !== 'string') return found;
  if ((node.type === 'AssignmentExpression') && node.left.type === 'Identifier') found.add(node.left.name);
  if (node.type === 'UpdateExpression' && node.argument.type === 'Identifier') found.add(node.argument.name);
  for (const k of Object.keys(node)) { if (k === 'loc') continue; const v = node[k]; if (Array.isArray(v)) v.forEach(x => x && typeof x === 'object' && assignedIn(x, found)); else if (v && typeof v === 'object') assignedIn(v, found); }
  return found;
}
for (const it of items) for (const n of assignedIn(it.node)) if (lets.has(n) && owner.get(n) !== where.get(it)) throw new Error(`"${n}" é uma variável let de módulo reatribuída fora do módulo onde mora (${owner.get(n)} × ${where.get(it)}); deixe-os juntos no plano.`);

const header = src.slice(0, imports.length ? imports[0].start : 0);
const piece = it => src.slice(it.start, it.end).replace(/^[\r\n]+/, '');
const out = new Map();   // módulo -> {items:[]}
for (const it of items) { const m = where.get(it); if (!out.has(m)) out.set(m, []); out.get(m).push(it); }

const dir = path.resolve(root, plan.pasta), rel = (from, to) => { let r = path.relative(path.dirname(from), to).replaceAll('\\', '/'); return r.startsWith('.') ? r : './' + r; };
function importsFor(used, own, file) {
  const impLines = [];
  for (const imp of imports) {   // conserva a forma original do import, filtrando os nomes usados
    const spec = imp.specifiers.filter(sp => used.has(sp.local.name) && !own.has(sp.local.name));
    if (!spec.length) continue;
    const abs = path.resolve(path.dirname(srcPath), imp.source.value);
    const from = imp.source.value.startsWith('.') ? rel(file, abs) : imp.source.value;
    const def = spec.find(s => s.type === 'ImportDefaultSpecifier'), ns = spec.find(s => s.type === 'ImportNamespaceSpecifier'), named = spec.filter(s => s.type === 'ImportSpecifier');
    const parts = [];
    if (def) parts.push(def.local.name);
    if (ns) parts.push('* as ' + ns.local.name);
    if (named.length) parts.push('{' + named.map(s => s.imported.name === s.local.name ? s.local.name : `${s.imported.name} as ${s.local.name}`).join(', ') + '}');
    impLines.push(`import ${parts.join(', ')} from '${from}';`);
  }
  return impLines;
}
const files = [];
for (const [mod, its] of out) {
  if (mod === MAIN) continue;
  const file = path.join(dir, mod + '.js');
  const used = new Set(); for (const it of its) identsIn(it.node, used);
  const own = new Set(its.flatMap(i => i.names));
  const lines = [];
  const bySource = new Map();   // origem -> nomes
  const srcOf = n => { // origem de um nome importado/irmão
    if (importedNames.has(n)) return {kind: 'imp', imp: importedNames.get(n)};
    const o = owner.get(n); if (o && o !== mod) return {kind: 'sib', mod: o};
    return null;
  };
  const impLines = importsFor(used, own, file);
  const sib = new Map();
  for (const n of used) { if (own.has(n)) continue; const o = owner.get(n); if (o && o !== mod && !importedNames.has(n)) { const f = o === MAIN ? srcPath : path.join(dir, o + '.js'); if (!sib.has(f)) sib.set(f, new Set()); sib.get(f).add(n); } }
  for (const [f, names] of sib) impLines.push(`import {${[...names].sort().join(', ')}} from '${rel(file, f.replace(/\.js$/, '') + '.js')}';`);
  // declarações usadas por irmãos precisam ser exportadas
  files.push({file, mod, its, impLines});
}
// nomes de módulos novos usados por outros módulos ou pelo original => precisam de `export`
const needExport = new Set();
for (const [mod, its] of out) {
  const used = new Set(); for (const it of its) identsIn(it.node, used);
  for (const n of used) { const o = owner.get(n); if (o && o !== mod && !importedNames.has(n)) needExport.add(n); }
}
const exportize = (text, it) => {
  if (it.exported) return text;
  const mine = it.names.filter(n => needExport.has(n));
  if (!mine.length) return text;
  return text.replace(/^(\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*)((?:async\s+)?function|class|const|let|var)\b/, (m, pre, kw) => `${pre}export ${kw}`);
};
const result = {};
for (const f of files) {
  const text = [header.trimEnd() && header.trimEnd().split(/\r?\n/).filter(l => /@ts-check/.test(l)).join(eol), `// Dividido de ${path.basename(plan.arquivo)} (comportamento idêntico): ${f.mod}.`, '', ...f.impLines, '', ...f.its.map(it => exportize(piece(it), it))].filter((x, i) => i > 1 || x !== undefined).join(eol).replace(/^\r?\n/, '') + eol;
  result[f.file] = text;
}
// original: imports originais + imports dos irmãos usados + fachada
const keep = out.get(MAIN) ?? [];
const usedMain = new Set(); for (const it of keep) identsIn(it.node, usedMain);
const reexports = [], mainSib = new Map();
for (const f of files) {
  const exported = f.its.flatMap(i => i.names).filter(n => items.find(i => i.names.includes(n)).exported);
  reexports.push(`export * from './${path.basename(plan.pasta)}/${f.mod}.js';`);
  const need = f.its.flatMap(i => i.names).filter(n => usedMain.has(n));
  if (need.length) mainSib.set(f.mod, need);
}
let mainText = src.slice(0, imports.length ? imports[0].start : 0).trimEnd() + eol + eol + importsFor(usedMain, new Set(keep.flatMap(i => i.names)), srcPath).join(eol);
const importsText = [];
for (const [m, names] of mainSib) importsText.push(`import {${names.sort().join(', ')}} from './${path.basename(plan.pasta)}/${m}.js';`);
const keepText = keep.map(it => piece(it)).join('');
result[srcPath] = mainText + eol + importsText.join(eol) + (importsText.length ? eol : '') + eol + '// Fachada: o conteúdo foi dividido em módulos menores (pasta ' + path.basename(plan.pasta) + '/); os nomes exportados continuam os mesmos.' + eol + reexports.join(eol) + eol + (keepText.trim() ? eol + keepText.replace(/^[\r\n]+/, '') : '') + eol;

for (const [f, text] of Object.entries(result)) console.log(`${dry ? '[seco] ' : ''}${path.relative(root, f)}: ${text.split('\n').length} linhas`);
if (!dry) { mkdirSync(dir, {recursive: true}); for (const [f, text] of Object.entries(result)) writeFileSync(f, text); }
