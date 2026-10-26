// Índice vivo para agentes e mapa de impacto (#13): gera docs/INDICE_VIVO_MOVES.md a partir do código REAL (registro de Moves, imports, testes e
// documentos que citam cada Move). Nada é escrito à mão: rode `npm run indice` depois de mexer em Moves. O teste moves-indice.test.mjs falha se o
// arquivo estiver desatualizado ou citar caminho que não existe.
import {readdirSync, readFileSync, writeFileSync, statSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const labDir = fileURLToPath(new URL('.', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const repoDir = labDir.replace(/\/prototypes\/combat-lab$/, '');
export const INDEX_PATH = `${repoDir}/docs/INDICE_VIVO_MOVES.md`;

const walk = (dir, ext) => readdirSync(dir).flatMap(f => {
  if (['node_modules', 'dist', 'evidence', '.git'].includes(f)) return [];
  const p = `${dir}/${f}`;
  return statSync(p).isDirectory() ? walk(p, ext) : ext.test(f) ? [p] : [];
});
const rel = p => p.slice(repoDir.length + 1);
const AREAS = [[/\/src\/sim\//, 'sim (regras)'], [/\/src\/ui\//, 'ui (painéis)'], [/\/src\/view\//, 'view (desenho)'], [/\/src\//, 'src (outros)'], [/\/test\//, 'testes'], [/\/docs\//, 'documentos']];
const areaOf = p => (p.endsWith('.md') ? AREAS[5] : AREAS.find(([re]) => re.test(p)))[1];

/** Arquivos versionados ou novos e não ignorados (caminhos absolutos); null se o git não estiver disponível. Evita que um rascunho local mude o índice. */
function trackedOrNew() {
  try {
    const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {cwd: repoDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
    return new Set(out.split('\0').filter(Boolean).map(f => `${repoDir}/${f}`));
  } catch {return null;}
}
export async function buildIndex() {
  const {C} = await import('./src/sim/config.js');
  const {registerStandardMoves} = await import('./src/sim/moves/standard.js');
  const {listMoves} = await import('./src/sim/moves.js');
  const {moveParamGroups} = await import('./src/sim/moves/params-registry.js');
  const metaOf = id => moveParamGroups().find(x => x.id === id)?.meta;
  const {STANDARD_MOVE_IDS} = await import('./src/sim/moves/standard.js');
  registerStandardMoves();
  const moves = listMoves();
  const camel = id => id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const pascal = id => { const c = camel(id); return c[0].toUpperCase() + c.slice(1); };
  const gitFiles = trackedOrNew();
  const files = [...walk(`${labDir}/src`, /\.(js|css|html)$/), ...walk(`${labDir}/test`, /\.mjs$|\.js$/), ...walk(`${repoDir}/docs`, /\.md$/), `${labDir}/MOVIMENTOS.md`].filter(f => existsSync(f) && f !== INDEX_PATH && (!gitFiles || gitFiles.has(f))).sort();
  const text = new Map(files.map(f => [f, readFileSync(f, 'utf8')]));
  const generated = `${labDir}/src/sim/moves/fichas.generated.js`;
  const out = [];
  out.push('# Índice vivo dos Moves e mapa de impacto', '', '> **GERADO** por `npm run indice` (`prototypes/combat-lab/gen-indice.mjs`) a partir do código real. Não edite à mão. Serve para um agente (ou pessoa) saber, antes de mexer em um Move, **quais arquivos, testes e documentos** o citam. O índice só encontra citações textuais (id, grupo de `C.world` ou nome de função); leia o código atual antes de editar.', '');
  out.push(`Moves registrados: **${moves.length}**. Em ficha única (um arquivo): ${moves.filter(m => text.get(generated)?.includes(`./${m.id}.js`)).length}. Veja \`docs/COMO_CRIAR_UM_MOVE.md\`.`, '');
  out.push('| Move | Grupo em `C.world` | Arquivos de regra (sim) | Painéis/visão | Testes | Documentos |', '|---|---|---|---|---|---|');
  const detail = [];
  for (const m of moves) {
    const id = m.id, group = m.group ?? '';
    const names = [id, group, camel(id), pascal(id)].filter(Boolean);
    const re = new RegExp(`(?<![A-Za-z0-9_-])(?:${[...new Set(names)].map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![A-Za-z0-9_-])`);
    const hits = files.filter(f => f !== generated && re.test(text.get(f)));
    const by = {};
    for (const f of hits) (by[areaOf(f)] ??= []).push(rel(f));
    const cell = k => (by[k]?.length ?? 0) ? `${by[k].length}` : '0';
    out.push(`| \`${id}\` | ${group ? `\`${group}\`` : '(sem grupo)'} | ${cell('sim (regras)')} | ${(by['ui (painéis)']?.length ?? 0) + (by['view (desenho)']?.length ?? 0)} | ${cell('testes')} | ${cell('documentos')} |`);
    detail.push(`### \`${id}\`${group ? ` · grupo \`${group}\`` : ''}`, '');
    const mt = metaOf(id);
    if (mt) detail.push(`**Ficha:** ${mt.category} · ${mt.types.join('+')} · ${mt.pl} · ${Object.entries(mt.status).map(([k, v]) => `${k} ${v ? '✓' : '✗'}`).join(' · ')}`, '');
    for (const [, area] of AREAS) if (by[area]) detail.push(`- **${area}:** ${by[area].map(p => `\`${p}\``).join(', ')}`);
    const testRunners = (by['testes'] ?? []).filter(p => /\.test\.mjs$/.test(p)).map(p => `node ${p}`);
    if (testRunners.length) detail.push('', `Testes executáveis: ${testRunners.map(c => `\`${c}\``).join(' · ')}`);
    detail.push('');
  }
  out.push('', '## Detalhe por Move', '', ...detail);

  // Documentos de docs/ que nenhum outro documento nem o portal citam (candidatos a órfãos).
  const portal = existsSync(`${repoDir}/ABRIR_ARENAMON.html`) ? readFileSync(`${repoDir}/ABRIR_ARENAMON.html`, 'utf8') : '';
  const docs = files.filter(f => f.startsWith(`${repoDir}/docs/`) && f.endsWith('.md'));
  const orphans = docs.filter(f => {const name = f.replace(/\\/g, '/').split('/').pop();return !portal.includes(name) && !docs.some(g => g !== f && text.get(g).includes(name));});
  out.push('## Documentos de `docs/` sem nenhuma citação (nem no portal, nem em outro documento)', '', orphans.length ? orphans.map(f => `- \`${rel(f)}\``).join('\n') : '(nenhum)', '');
  out.push('## Como usar', '', '1. Procure o Move na tabela; abra o detalhe.', '2. Leia os arquivos de **sim** e os **testes executáveis** antes de editar; depois rode os testes listados e `npm run indice`.', '3. Documentos normativos prevalecem: `AGENTS.md`, `docs/REGRAS_CRIACAO_MOVES.md`, `docs/MOVES_DECISOES_RODADAS.md`.', '');
  return out.join('\n');
}
export async function writeIndexFile() {
  const next = await buildIndex();
  let prev = '';
  try {prev = readFileSync(INDEX_PATH, 'utf8');} catch {/* primeira geração */}
  if (prev !== next) writeFileSync(INDEX_PATH, next);
  return prev !== next;
}
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('gen-indice.mjs')) {
  console.log((await writeIndexFile()) ? 'docs/INDICE_VIVO_MOVES.md atualizado' : 'docs/INDICE_VIVO_MOVES.md já estava em dia');
}
