// Exportação/importação dos parâmetros numéricos que NÃO têm controle no Ajustes (manifesto): os dos Moves (`world.*`) e outros. Funções puras (testadas em
// tuning-io.test.mjs). Origem: o JSON exportado trazia esses valores em `values`, mas `changedFromLabDefaults` só listava o que o Ajustes mostra, então Moves/ações
// alterados «não eram exportados» na lista de mudanças e, na importação, eram ignorados em silêncio.
import {flatten} from './actions-meta.js';

const same = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
/** [{path, lab, value}] de todo parâmetro numérico alterado em relação ao padrão e fora do manifesto. */
export function changedOutsideManifest(currentRoots, baseRoots, manifestPaths) {
  const cur = flatten(currentRoots), lab = flatten(baseRoots), out = [];
  for (const [path, value] of Object.entries(cur)) if (!manifestPaths.has(path) && path in lab && !same(value, lab[path])) out.push({path, lab: lab[path], value});
  return out;
}
/** Importação dos números fora do manifesto: {changes: [[path, valor]], invalid: [texto]}; só aceita caminhos que existem no padrão. */
export function importOutsideManifest(values, baseRoots, currentRoots, manifestPaths) {
  const baseFlat = flatten(baseRoots), cur = flatten(currentRoots), changes = [], invalid = [];
  for (const [path, v] of Object.entries(values)) {
    if (manifestPaths.has(path) || !(path in baseFlat)) continue;
    if (typeof v !== 'number' || !Number.isFinite(v)) {invalid.push(`${path} = ${v}`);continue;}
    if (!same(v, cur[path])) changes.push([path, v]);
  }
  return {changes, invalid};
}
