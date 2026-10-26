// Gera src/sim/moves/fichas.generated.js: o índice automático das FICHAS de Moves. Toda arquivo em src/sim/moves/ que exporta `ficha`
// entra sozinho; ninguém edita lista nenhuma para criar um Move. Rodado pelo build (build.mjs) e por `npm run fichas`; o teste
// moves-fichas.test.mjs falha se o arquivo gerado estiver desatualizado. Suporta arquitetura híbrida (arquivos planos ou subpastas src/sim/moves/<id>/)
// e proíbe terminantemente duplicações entre subpasta e raiz.
import {readdirSync, readFileSync, writeFileSync, statSync} from 'node:fs';

const dir = new URL('./src/sim/moves/', import.meta.url);
const OUT = 'fichas.generated.js', OUT_PARAMS = 'params.generated.js';

export function fichaEntries() {
  const entries = readdirSync(dir, {withFileTypes: true});
  /** @type {Map<string, {id: string, file: string, paramsFile: string}>} */ const subMoves = new Map();
  /** @type {Map<string, {id: string, file: string, paramsFile: string}>} */ const flatMoves = new Map();

  for (const ent of entries) {
    if (ent.isDirectory()) {
      const id = ent.name;
      const subJs = `${id}/${id}.js`;
      const subUrl = new URL(subJs, dir);
      try {
        if (statSync(subUrl).isFile()) {
          const content = readFileSync(subUrl, 'utf8');
          if (/^export const ficha\b/m.test(content)) {
            subMoves.set(id, {
              id,
              file: subJs,
              paramsFile: `${id}/${id}.params.js`,
            });
          }
        }
      } catch {}
    } else if (ent.isFile() && ent.name.endsWith('.js') && !ent.name.endsWith('.params.js') && ent.name !== OUT && ent.name !== OUT_PARAMS) {
      const id = ent.name.replace(/\.js$/, '');
      const content = readFileSync(new URL(ent.name, dir), 'utf8');
      if (/^export const ficha\b/m.test(content)) {
        flatMoves.set(id, {
          id,
          file: ent.name,
          paramsFile: `${id}.params.js`,
        });
      }
    }
  }

  // Detecção estrita de duplicatas
  const duplicates = [...subMoves.keys()].filter(id => flatMoves.has(id));
  if (duplicates.length) {
    throw new Error(`Duplicação de Move detectada: ${duplicates.join(', ')} existem simultaneamente na subpasta e na raiz.`);
  }

  const all = [...subMoves.values(), ...flatMoves.values()];
  all.sort((a, b) => a.id.localeCompare(b.id, 'en'));
  return all;
}

export function fichaFiles() {
  return fichaEntries().map(e => e.file);
}

export function renderIndex(entries = fichaEntries()) {
  const list = typeof entries[0] === 'string' ? fichaEntries() : entries;
  const names = list.map(e => 'ficha_' + e.id.replace(/[^a-zA-Z0-9]+/g, '_'));
  return `// GERADO por gen-fichas.mjs (npm run fichas). NÃO edite: crie ou apague um arquivo com \`export const ficha\` em src/sim/moves/.
${list.map((e, i) => `import {ficha as ${names[i]}} from './${e.file}';`).join('\n')}

/** Fichas de Moves, em ordem alfabética do arquivo. */
export const FICHAS = [${names.join(', ')}];
`;
}

/** Índice dos arquivos de parâmetros (módulos puros: o config.js os importa para que C.world tenha os grupos sempre). */
export function renderParamsIndex(entries = fichaEntries()) {
  const list = typeof entries[0] === 'string' ? fichaEntries() : entries;
  const names = list.map(e => 'params_' + e.id.replace(/[^a-zA-Z0-9]+/g, '_'));
  return `// GERADO por gen-fichas.mjs (npm run fichas). NÃO edite. Importa só os módulos PUROS de parâmetros (<id>.params.js) das fichas.
${list.map((e, i) => `import {params as ${names[i]}} from './${e.paramsFile}';`).join('\n')}

export const FICHAS_PARAMS = [${names.join(', ')}];
${dataBlock(list)}`;
}

/** Moves já migrados para «Move como dado» (o <id>.params.js exporta `def`): o Editor de Moves lê daqui (def, params, visual de cada um). */
function dataBlock(list) {
  const asData = list.filter(e => {
    try {
      return /^export const def\b/m.test(readFileSync(new URL(e.paramsFile, dir), 'utf8'));
    } catch {
      return false;
    }
  });
  if (!asData.length) return '';
  const nm = e => 'data_' + e.id.replace(/[^a-zA-Z0-9]+/g, '_');
  return `
// Moves como dado (def + params + visual de cada <id>.params.js), para o Editor de Moves.
${asData.map(e => `import * as ${nm(e)} from './${e.paramsFile}';`).join('\n')}
export const MOVES_DATA = [${asData.map(nm).join(', ')}];
`;
}

export function writeIndex() {
  let changed = false;
  for (const [name, next] of [[OUT, renderIndex()], [OUT_PARAMS, renderParamsIndex()]]) {
    let prev = '';
    try {prev = readFileSync(new URL(name, dir), 'utf8');} catch {/* primeira geração */}
    if (prev !== next) {writeFileSync(new URL(name, dir), next);changed = true;}
  }
  return changed;
}

if (import.meta.url === new URL(process.argv[1], 'file:///').href || process.argv[1]?.endsWith('gen-fichas.mjs')) {
  console.log(writeIndex() ? 'índices das fichas atualizados' : 'índices das fichas já estavam em dia');
}
