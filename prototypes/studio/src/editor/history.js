// Histórico de edição (undo/redo) baseado em comandos.
// Cada comando guarda referências a estados imutáveis (arrays de tracks nunca são alterados no lugar),
// então desfazer não exige cópias profundas da animação.
export function createHistory({limit = 200, onChange = () => {}} = {}) {
  const undoStack = [], redoStack = [];
  const state = () => ({canUndo: undoStack.length > 0, canRedo: redoStack.length > 0, undoLabel: undoStack.at(-1)?.label || '', redoLabel: redoStack.at(-1)?.label || ''});
  return {
    /** Executa e registra. command = {label, redo(), undo()} */
    run(command) {command.redo();undoStack.push(command);if (undoStack.length > limit) undoStack.shift();redoStack.length = 0;onChange(state());return command;},
    undo() {const c = undoStack.pop();if (!c) return null;c.undo();redoStack.push(c);onChange(state());return c;},
    redo() {const c = redoStack.pop();if (!c) return null;c.redo();undoStack.push(c);onChange(state());return c;},
    clear() {undoStack.length = 0;redoStack.length = 0;onChange(state());},
    state,
  };
}
