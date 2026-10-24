// @ts-check
// Altitude de um lutador acima do chão (m): voo, ou apoio, mais a altura do vault. Módulo folha (sem imports) para que entity.js e moves.js
// não precisem importar um ao outro.
export const altitudeOf = (/** @type {any} */ f) => (f.flight?.y ?? f.groundY ?? 0) + (f.vaultHeight ?? 0);
