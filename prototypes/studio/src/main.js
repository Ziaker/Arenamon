// Ponto de entrada do Arenamon Animation Studio. A ordem reproduz a do HTML v6:
// motor → organização → V3 (cenário/câmeras/comparação) → V4 (inspeção) → V5/V6 (navegação/painel) → editor.
import './editor/mount.js';
import './engine.js';
import './legacy/organization.js';
import './legacy/lab.js';
import './legacy/inspect.js';
import './legacy/ux.js';
import './editor/index.js';
