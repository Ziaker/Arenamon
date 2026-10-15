// Proposta de patch para prototypes/game/src/config.ts a partir dos ajustes do laboratório. Só gera texto para
// revisão (diff unificado aplicável com `git apply`); nunca altera o jogo. Conflitos (dois parâmetros do
// laboratório que caem no mesmo valor do jogo com valores diferentes, como as durações de X e C, que no jogo ainda
// são uma só) e parâmetros sem equivalente no jogo são listados e ficam de fora.
const OBJECTS = {rules: 'RULES', test: 'TEST', locomotion: 'LOCOMOTION', camera: 'CAMERA'};

/** Número em TypeScript legível: múltiplos simples de π viram `Math.PI / n` ou `k * Math.PI`. */
export function formatNumber(v) {
  if (!Number.isFinite(v)) return String(v);
  for (const d of [1, 2, 3, 4, 6, 8, 9, 12]) {
    const k = v * d / Math.PI;
    if (Math.abs(k - Math.round(k)) < 1e-9 && Math.round(k) !== 0 && Math.abs(v) > 1e-6) {
      const n = Math.round(k), num = n === 1 ? 'Math.PI' : n === -1 ? '-Math.PI' : `${n} * Math.PI`;
      return d === 1 ? num : `${num} / ${d}`;
    }
  }
  const s = String(+v.toFixed(6));return s.startsWith('0.') ? s.slice(1) : s.startsWith('-0.') ? '-' + s.slice(2) : s;
}

/** Localiza o trecho de texto de um objeto do config.ts: [início, fim) do corpo entre chaves. */
function block(source, gamePath) {
  const [root, a, b] = gamePath.split('.');
  if (OBJECTS[root]) {
    const head = source.indexOf(`export const ${OBJECTS[root]} = {`);if (head < 0) return null;
    const start = source.indexOf('{', head) + 1, end = source.indexOf('};', start);return end < 0 ? null : {start, end, key: a};
  }
  if (root === 'profiles') {
    const m = new RegExp(`\\n(\\s*)${a}: \\{([^}]*)\\}`).exec(source);if (!m) return null;
    const start = m.index + m[0].indexOf('{') + 1;return {start, end: start + m[2].length, key: b};
  }
  return null;
}

/**
 * changes: [{gamePath, value, from}] → {text, applied: [{gamePath, before, after, from}], skipped: [{gamePath, reason}]}.
 * `from` lista os parâmetros do laboratório de origem.
 */
export function patchConfigTs(source, changes) {
  let text = source;const applied = [], skipped = [];
  for (const c of changes) {
    const b = block(text, c.gamePath);
    if (!b) {skipped.push({gamePath: c.gamePath, reason: 'não existe no config.ts'});continue;}
    const body = text.slice(b.start, b.end), re = new RegExp(`(^|[\\s{,])(${b.key}): ([^,\\n}]+)`), m = re.exec(body);
    if (!m) {skipped.push({gamePath: c.gamePath, reason: 'chave não encontrada no objeto'});continue;}
    const before = m[3].trim(), after = formatNumber(c.value);
    if (before === after) continue;
    const at = b.start + m.index + m[1].length + m[2].length + 2;
    text = text.slice(0, at) + after + text.slice(at + m[3].trimEnd().length);
    applied.push({gamePath: c.gamePath, before, after, from: c.from});
  }
  return {text, applied, skipped};
}

/** Diff unificado (mesma quantidade de linhas; 3 linhas de contexto) aplicável com `git apply`. */
export function unifiedDiff(before, after, file = 'prototypes/game/src/config.ts') {
  // A quebra de linha final não é uma linha: sem isto, o contexto incluiria uma linha vazia inexistente.
  const lines = t => {const l = t.split('\n');if (l.at(-1) === '') l.pop();return l;}, a = lines(before), b = lines(after);if (a.length !== b.length) throw new Error('diff só para substituições na mesma linha');
  const changed = a.map((l, i) => l !== b[i] ? i : -1).filter(i => i >= 0);if (!changed.length) return '';
  const hunks = [];
  for (const i of changed) {const s = Math.max(0, i - 3), e = Math.min(a.length, i + 4), last = hunks.at(-1);if (last && s <= last.e) last.e = e;else hunks.push({s, e});}
  const out = [`diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`];
  for (const {s, e} of hunks) {
    out.push(`@@ -${s + 1},${e - s} +${s + 1},${e - s} @@`);
    for (let i = s; i < e; i++) if (a[i] === b[i]) out.push(' ' + a[i]);else out.push('-' + a[i], '+' + b[i]);
  }
  return out.join('\n') + '\n';
}

/**
 * Agrupa os parâmetros do laboratório pelo caminho do jogo. entries: [{path, gamePath, value, official}].
 * Devolve {changes, conflicts}; grupos com valores divergentes viram conflito (ficam de fora).
 */
export function collectChanges(entries) {
  const groups = new Map();
  for (const e of entries) {if (!e.gamePath) continue;if (!groups.has(e.gamePath)) groups.set(e.gamePath, []);groups.get(e.gamePath).push(e);}
  const changes = [], conflicts = [];
  for (const [gamePath, list] of groups) {
    const values = [...new Set(list.map(e => e.value))];
    if (values.length > 1) {conflicts.push({gamePath, list});continue;}
    if (list.every(e => e.official !== undefined && Math.abs(e.value - e.official) < 1e-12)) continue;
    changes.push({gamePath, value: values[0], from: list.map(e => e.path)});
  }
  return {changes, conflicts};
}
