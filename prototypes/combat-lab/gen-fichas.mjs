// Gera src/sim/moves/fichas.generated.js: o índice automático das FICHAS de Moves. Toda arquivo em src/sim/moves/ que exporta `ficha`
// entra sozinho; ninguém edita lista nenhuma para criar um Move. Rodado pelo build (build.mjs) e por `npm run fichas`; o teste
// moves-fichas.test.mjs falha se o arquivo gerado estiver desatualizado.
import {readdirSync, readFileSync, writeFileSync} from 'node:fs';

const dir = new URL('./src/sim/moves/', import.meta.url);
const OUT = 'fichas.generated.js', OUT_PARAMS = 'params.generated.js';

export function fichaFiles() {
  return readdirSync(dir).filter(f => f.endsWith('.js') && !f.endsWith('.params.js') && f !== OUT && f !== OUT_PARAMS && /^export const ficha\b/m.test(readFileSync(new URL(f, dir), 'utf8'))).sort();
}
export function renderIndex(files = fichaFiles()) {
  const names = files.map(f => 'ficha_' + f.replace(/\.js$/, '').replace(/[^a-zA-Z0-9]+/g, '_'));
  return `// GERADO por gen-fichas.mjs (npm run fichas). NÃO edite: crie ou apague um arquivo com \`export const ficha\` em src/sim/moves/.
${files.map((f, i) => `import {ficha as ${names[i]}} from './${f}';`).join('\n')}

/** Fichas de Moves, em ordem alfabética do arquivo. */
export const FICHAS = [${names.join(', ')}];
`;
}
/** Índice dos arquivos de parâmetros (módulos puros: o config.js os importa para que C.world tenha os grupos sempre). */
export function renderParamsIndex(files = fichaFiles()) {
  const names = files.map(f => 'params_' + f.replace(/\.js$/, '').replace(/[^a-zA-Z0-9]+/g, '_'));
  return `// GERADO por gen-fichas.mjs (npm run fichas). NÃO edite. Importa só os módulos PUROS de parâmetros (<id>.params.js) das fichas.
${files.map((f, i) => `import {params as ${names[i]}} from './${f.replace(/\.js$/, '.params.js')}';`).join('\n')}

export const FICHAS_PARAMS = [${names.join(', ')}];
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
