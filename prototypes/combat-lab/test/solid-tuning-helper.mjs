// Máquina de histórico idêntica à de src/ui/tuning.js (commit/undo/redo sobre caminhos de C), sem DOM, para testes em Node.
const pathGet = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
const pathSet = (o, p, v) => { const parts = p.split('.'), last = parts.pop(), t = parts.reduce((a, k) => a?.[k], o); if (t) { t[last] = v; return true; } return false; };
const same = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
export function createMockTuningFor(C) {
  const undo = [], redo = [];
  return {
    commit(changes, label) {
      const real = changes.filter(([p, v]) => !same(pathGet(C, p), v)).map(([p, v]) => [p, pathGet(C, p), v]); if (!real.length) return 0;
      for (const [p, , v] of real) pathSet(C, p, v); undo.push({label, changes: real}); redo.length = 0; return real.length;
    },
    undo() { const e = undo.pop(); if (!e) return; for (const [p, before] of e.changes) pathSet(C, p, before); redo.push(e); },
    redo() { const e = redo.pop(); if (!e) return; for (const [p, , after] of e.changes) pathSet(C, p, after); undo.push(e); },
  };
}
