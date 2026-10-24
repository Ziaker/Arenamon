// Migra UM Move antigo (parâmetros em config.js + tabela em ui/moves-panel.js + entrada em moves/new-moves.js) para a FICHA única
// (src/sim/moves/<id>.params.js + `export const ficha` no próprio <id>.js). Uso: `node prototypes/combat-lab/migrar-ficha.mjs <id> [--dry]`.
// Plano: docs/plans/2026-10-23-melhorias-restantes.md (Tarefa 2). Cada Move é um commit; depois rode `npm run fichas` e os testes do Move.
// Aborta SEM escrever nada se algo fugir do formato esperado (a lista dos motivos sai na tela). Preserva o fim de linha de cada arquivo.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const lab = fileURLToPath(new URL('.', import.meta.url));
const id = process.argv[2], dry = process.argv.includes('--dry');
if (!id) {console.error('uso: node migrar-ficha.mjs <id> [--dry]');process.exit(2);}
const P = {
  cfg: lab + 'src/sim/config.js', panel: lab + 'src/ui/moves-panel.js', nm: lab + 'src/sim/moves/new-moves.js',
  mv: lab + `src/sim/moves/${id}.js`, prm: lab + `src/sim/moves/${id}.params.js`, test: lab + 'test/moves-revisao.test.mjs',
};
const fail = m => {console.error('ABORTADO: ' + m);process.exit(1);};
if (!existsSync(P.mv)) fail(`falta ${P.mv}`);
if (existsSync(P.prm)) fail(`${id} já tem ficha (${id}.params.js existe)`);

const raw = {}, eol = {};
for (const k of ['cfg', 'panel', 'nm', 'mv', 'test']) {
  raw[k] = readFileSync(P[k], 'utf8');
  eol[k] = raw[k].includes('\r\n') ? '\r\n' : '\n';
  raw[k] = raw[k].replace(/\r\n/g, '\n');
}

// 1) entrada em new-moves.js
const nmLines = raw.nm.split('\n');
const entryIdx = nmLines.findIndex(l => l.startsWith(`  {def: ${camel(id)}Def`) && /},?$/.test(l));
function camel(s) {return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());}
if (entryIdx < 0) fail(`entrada de ${id} não encontrada em new-moves.js (esperava uma linha "{def: ${camel(id)}Def, ...}")`);
const entryLine = nmLines[entryIdx];
const group = camel(id);   // por convenção o grupo em C.world é o id em camelCase; confirmado abaixo pelas linhas do painel
const defName = camel(id) + 'Def';
const entryFields = entryLine.trim().replace(/^\{/, '').replace(/\},?$/, '').trim();    // "def: xDef, tackle: [...]"
const restFields = entryFields.replace(new RegExp(`^def: ${defName}\\s*,?\\s*`), '').trim();

// 2) entrada em MOVE_INFO e bloco em PARAMS (painel)
const pLines = raw.panel.split('\n');
const infoIdx = pLines.findIndex(l => new RegExp(`^  (?:'${id}'|${id}): \\{group: `).test(l));
if (infoIdx < 0) fail(`MOVE_INFO de ${id} não encontrado no painel`);
const info = new Function('return ' + pLines[infoIdx].trim().replace(/^[^:]+:\s*/, '').replace(/,$/, ''))();
const title = info.group;
const blkStart = pLines.findIndex(l => l === `  [${JSON.stringify(title).replace(/"/g, "'")}, [`);
if (blkStart < 0) fail(`bloco PARAMS "${title}" não encontrado no painel`);
let blkEnd = blkStart + 1;
while (blkEnd < pLines.length && pLines[blkEnd] !== '  ]],') blkEnd++;
if (blkEnd >= pLines.length) fail('fim do bloco PARAMS não encontrado');
const FMT = ['num', 'int', 'sec', 'pct', 'm', 'ms', 'ms2', 'deg', 'x', 'yesno'];
const rowsRaw = new Function(...FMT.map(f => f), 'return [' + pLines.slice(blkStart + 1, blkEnd).join('\n') + '\n]')(...FMT);   // cada formatador vira a própria string
const rows = rowsRaw.map(r => ({group: r[0], key: r[1], label: r[2], tip: r[3], min: r[4], max: r[5], step: r[6], unit: r[7], approved: !!r[8]}));
if (!rows.length) fail('bloco sem linhas');
if (new Set(rows.map(r => r.group)).size !== 1) fail('o bloco mistura grupos de C.world: ' + [...new Set(rows.map(r => r.group))].join(', '));
if (rows[0].group !== group) fail(`grupo do painel (${rows[0].group}) difere do esperado pelo id (${group}); ajuste o script ou renomeie`);
for (const r of rows) if (!FMT.includes(r.unit)) fail(`unidade inválida em ${r.key}: ${r.unit}`);

// 3) padrões de fábrica ANTES de qualquer mudança
const {factoryDefaults} = await import('./src/sim/config.js');
const before = JSON.parse(JSON.stringify(factoryDefaults().world[group] ?? null));
if (!before) fail(`C.world.${group} não existe nos padrões de fábrica`);
const SHAKE = {hitShakeOn: 0, hitShakeAmount: 1, hitShakeDuration: 1};
const extra = Object.keys(before).filter(k => !rows.some(r => r.key === k));
const shakeKeys = Object.keys(SHAKE);
const withShake = extra.length === 3 && shakeKeys.every(k => extra.includes(k) && before[k] === SHAKE[k]);
if (extra.length && !withShake) fail(`chaves nos padrões sem slider no painel: ${extra.join(', ')}`);
const missing = rows.filter(r => !(r.key in before)).map(r => r.key);
if (missing.length) fail(`sliders sem valor nos padrões: ${missing.join(', ')}`);
for (const r of rows) {r.value = before[r.key];if (typeof r.value !== 'number') fail(`${r.key}: valor não numérico`);}

// 4) metadados a partir do texto de apoio ("Burst · Melee · PL1. ...")
// Os tipos (Melee/Projectile/Status/Field/Trick) só entram se o texto de apoio os traz; NÃO invento tipo: sem eles a ficha fica sem `meta` (como antes, sem etiqueta).
const T = '(?:Melee|Projectile|Status|Field|Trick)';
const mm = new RegExp(`^(Normal|Burst|Charge) · (${T}(?: \\+ ${T})*)(?: · (PL\\d(?:–PL\\d)?|SEM PL))?`).exec(info.hint ?? '');
const meta = mm ? {category: mm[1], types: mm[2].split(' + '), pl: mm[3] ?? 'SEM PL'} : null;
if (!meta) console.log(`aviso: ${id} sem tipos no texto de apoio; a ficha fica sem meta (decisão pendente do responsável)`);

// 5) comentário que precedia a entrada em config.js e a própria entrada (pode ocupar várias linhas)
const cLines = raw.cfg.split('\n');
const cStart = cLines.findIndex(l => new RegExp(`^    ${group}: \\{`).test(l));
if (cStart < 0) fail(`entrada ${group} não encontrada em config.js`);
if (cLines.filter(l => new RegExp(`^    ${group}: \\{`).test(l)).length !== 1) fail(`entrada ${group} aparece mais de uma vez em config.js`);
let depth = 0, cEnd = cStart;
for (; cEnd < cLines.length; cEnd++) {
  for (const ch of cLines[cEnd].replace(/\/\/.*$/, '').replace(/'[^']*'/g, '')) {if (ch === '{') depth++;else if (ch === '}') depth--;}
  if (depth === 0) break;
}
if (!/\},\s*(\/\/.*)?$/.test(cLines[cEnd])) fail('a entrada de config.js não termina em "},"');
let cFrom = cStart;
while (cFrom > 0 && /^    \/\//.test(cLines[cFrom - 1])) cFrom--;
// só o comentário DESTE Move (começa em "// <Título>:" ou "// <id>:"); comentários órfãos de Moves já migrados ficam onde estão
const own = cLines.slice(cFrom, cStart).findIndex(l => new RegExp(`^    //\\s*(${title}|${id})\\b`, 'i').test(l));
cFrom = own >= 0 ? cFrom + own : cStart;
const cfgComment = cLines.slice(cFrom, cStart).map(l => l.trim().replace(/^\/\/\s?/, ''));

// ---- montagem dos arquivos novos ----
const q = s => JSON.stringify(s);
const rowSrc = r => `      paramRow({key: ${q(r.key)}, label: ${q(r.label)}, tip: ${q(r.tip)}, min: ${r.min}, max: ${r.max}, step: ${r.step}, unit: '${r.unit}', value: ${r.value}${r.approved ? ', approved: true' : ''}}),`;
const prm = [
  '// @ts-check',
  `// Parâmetros do Move "${id}" (declarativo): padrão em C.world.${group}, faixa, unidade, rótulo e dica de cada slider da aba Moves.`,
  `// Módulo PURO (só importa params-registry.js): o config.js o carrega, então C.world.${group} existe sempre, com ou sem os Moves registrados.`,
  ...cfgComment.map(c => `// ${c}`.trimEnd()),
  `import {defineMoveParams, paramRow${withShake ? ', hitShakeRows' : ''}} from './params-registry.js';`,
  '',
  ...(meta ? ['/** Estado de governança dos valores do catálogo: implementado e testado, mas ainda NÃO aprovado nem homologado pelo diretor. */', 'const PROPOSTO = {proposto: true, aprovado: false, implementado: true, homologado: false};', ''] : []),
  `export const params = defineMoveParams('${group}', {`,
  `    id: ${q(id)}, title: ${q(title)},`,
  ...(meta ? [`    meta: {category: '${meta.category}', types: [${meta.types.map(t => `'${t}'`).join(', ')}], pl: ${q(meta.pl)}, status: PROPOSTO},`] : []),
  `    hint: ${q(info.hint ?? '')},`,
  '    rows: [',
  ...rows.map(rowSrc),
  ...(withShake ? ['      ...hitShakeRows(),'] : []),
  '    ],',
  '  });',
  '',
].join('\n');

// <id>.js: imports + ficha
const mvText = raw.mv;
const mvLines = mvText.split('\n');
let lastImport = -1;
mvLines.forEach((l, i) => {if (/^import .* from .*;$/.test(l)) lastImport = i;});
let insertBlank = false;
if (lastImport < 0) {   // arquivo sem imports: entram depois do comentário de cabeçalho
  lastImport = mvLines.findIndex(l => l.trim() !== '' && !l.startsWith('//')) - 1;
  while (lastImport >= 0 && mvLines[lastImport].trim() === '') lastImport--;
  insertBlank = true;
}
if (/^(export )?(const|let|function) params\b/m.test(mvText)) fail(`${id}.js já declara "params"`);
if (/^export const ficha\b/m.test(mvText)) fail(`${id}.js já exporta ficha`);
// nomes usados na entrada que vêm de OUTROS módulos (importados em new-moves.js) precisam ser importados também em <id>.js
const nmImports = [...raw.nm.matchAll(/^import \{([^}]+)\} from '([^']+)';$/gm)].map(m => ({line: m[0], names: m[1].split(',').map(s => s.trim()), from: m[2]}));
const needImports = [];
for (const imp of nmImports) {
  if (imp.from === './fichas.generated.js') continue;
  const used = imp.names.filter(n => new RegExp(`\\b${n}\\b`).test(restFields));
  if (used.length && imp.from !== `./${id}.js`) needImports.push({names: used, from: imp.from});
}
const importAdds = [`import {defineFicha} from './params-registry.js';`, `import {params} from './${id}.params.js';`];
for (const n of needImports) if (!mvLines.some(l => new RegExp(`from '${n.from.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}';$`).test(l) && n.names.every(x => new RegExp(`\\b${x}\\b`).test(l)))) importAdds.push(`import {${n.names.join(', ')}} from '${n.from}';`);
mvLines.splice(lastImport + 1, 0, ...(insertBlank ? [''] : []), ...importAdds);
const fichaBlock = [
  '',
  `/** FICHA do Move (ver docs/COMO_CRIAR_UM_MOVE.md): \`params\` gera o padrão em C.world.${group} e os sliders da aba Moves; \`def\` e os manipuladores são registrados sozinhos. */`,
  'export const ficha = defineFicha({',
  `  def: ${defName}${restFields ? ', ' + restFields.replace(/,$/, '') : ''},`,
  '  params,',
  '});',
  '',
];
let mvOut = mvLines.join('\n').replace(/\n*$/, '\n') + fichaBlock.join('\n');
// os nomes usados na ficha precisam existir no arquivo (declarados ou importados)
for (const n of restFields.match(/\b[a-zA-Z_]\w*(?=[,\]\s}]|$)/g) ?? []) {
  if (['tackle', 'effect', 'steps', 'hooks', 'effects', 'ai', 'def'].includes(n)) continue;
  if (!new RegExp(`\\b${n}\\b`).test(mvOut.replace(fichaBlock.join('\n'), ''))) fail(`o nome ${n} da entrada não existe em ${id}.js`);
}

// new-moves.js: remove a entrada e os imports que ficaram sem uso
const nmNew = nmLines.filter((_, i) => i !== entryIdx);
let nmOut = nmNew.join('\n');
for (const imp of nmImports) {
  if (imp.from === './fichas.generated.js') continue;
  const stillUsed = imp.names.filter(n => new RegExp(`\\b${n}\\b`).test(nmOut.replace(imp.line, '')));
  if (stillUsed.length === imp.names.length) continue;
  const repl = stillUsed.length ? `import {${stillUsed.join(', ')}} from '${imp.from}';` : null;
  nmOut = nmOut.replace(imp.line + '\n', repl ? repl + '\n' : '');
}

// config.js e moves-panel.js: remover
const cfgOut = [...cLines.slice(0, cFrom), ...cLines.slice(cEnd + 1)].join('\n');
const panelOut = pLines.filter((_, i) => i !== infoIdx && !(i >= blkStart && i <= blkEnd)).join('\n');

// teste de paridade: acrescenta os valores de antes
const fmt = v => String(v);
const snap = `    ${group}: {${Object.entries(before).map(([k, v]) => `${k}: ${fmt(v)}`).join(', ')}},`;
let testOut = raw.test;
if (new RegExp(`^    ${group}: \\{`, 'm').test(testOut)) fail(`o teste de paridade já tem ${group}`);
testOut = testOut.replace('  };\n  const hoje = factoryDefaults().world;', snap + '\n  };\n  const hoje = factoryDefaults().world;');
if (testOut === raw.test) fail('não achei o ponto de inserção no teste de paridade');
testOut = testOut.replace(/PARIDADE: os \d+ Moves migrados/, 'PARIDADE: os Moves migrados').replace(/paridade dos \d+ Moves migrados/, 'paridade dos Moves migrados');

const out = {
  [P.prm]: prm, [P.mv]: mvOut, [P.nm]: nmOut, [P.cfg]: cfgOut, [P.panel]: panelOut, [P.test]: testOut,
};
const eolOf = {[P.prm]: '\n', [P.mv]: eol.mv, [P.nm]: eol.nm, [P.cfg]: eol.cfg, [P.panel]: eol.panel, [P.test]: eol.test};
console.log(`${id}: grupo ${group} · ${rows.length} sliders${withShake ? ' + tremor' : ''} · ${meta ? `${meta.category} · ${meta.types.join('+')} · ${meta.pl}` : 'sem meta'} · antes: ${JSON.stringify(before)}`);
if (dry) {console.log('--dry: nada escrito');process.exit(0);}
for (const [f, text] of Object.entries(out)) writeFileSync(f, text.replace(/\n/g, eolOf[f]));
console.log('escrito. Rode: npm run fichas · testes do Move · commit.');
