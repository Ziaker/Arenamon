// @ts-check
// Sincronia ao vivo entre janelas do laboratório (fase 6 do plano do Editor de Moves): o Estúdio de Moves aberto em janela própria e o jogo
// em outra aba/monitor compartilham os ajustes. Mudou um slider de mecânica (ajustador) ou de visual (parâmetros aprovados do atelier) numa
// janela, a outra aplica na hora. Usa BroadcastChannel e, como reserva, o evento «storage» do localStorage (páginas abertas direto do arquivo,
// file://, não se enxergam pelo BroadcastChannel no Chromium; pelo localStorage sim).
// Nada é gravado em disco por aqui: gravar continua sendo o botão «Gravar» do Editor, com confirmação.

export const SYNC_CHANNEL = 'arenamon-moves';
const STORAGE_KEY = 'arenamon.moves.sync';

/**
 * Liga a sincronia. `tuning` é o ajustador (commit/setTransient); `visualParams` é o objeto vivo dos parâmetros aprovados por categoria.
 * Devolve {sendVisual, close, received}. `onRemote` é chamado depois de aplicar algo que veio de outra janela (para redesenhar o Editor).
 * `snapshot` devolve caminho → valor de tudo que sincroniza (ajustador + parâmetros dos Moves em C.world); `local` são caminhos que NUNCA
 * saem desta janela (ex.: a IA parada do Estúdio não pode desligar a IA do jogo).
 * @param {{tuning: any, visualParams: Record<string, Record<string, number>>, snapshot?: () => Record<string, any>, local?: string[], onRemote?: (msg: any) => void, channel?: any, storage?: any, id?: string}} o
 */
export function createMovesSync({tuning, visualParams, snapshot = () => tuning.snapshotValues(), local = [], onRemote = () => {}, channel, storage, id}) {
  const isLocal = new Set(local);
  const me = id ?? Math.random().toString(36).slice(2);
  const ch = channel !== undefined ? channel : typeof BroadcastChannel === 'function' ? new BroadcastChannel(SYNC_CHANNEL) : null;
  const store = storage !== undefined ? storage : (() => {try {return typeof localStorage !== 'undefined' ? localStorage : null;} catch {return null;}})();
  const stats = {sent: 0, received: 0};
  if (!ch && !store) return {sendVisual: () => {}, close: () => {}, stats, available: false};
  let applying = false, seq = 0;
  const seen = new Set();
  const send = (/** @type {any} */ msg) => {
    const m = {...msg, from: me, n: ++seq};
    try {ch?.postMessage(m);} catch {/* janela fechando */}
    try {store?.setItem(STORAGE_KEY, JSON.stringify(m));} catch {/* sem armazenamento */}
    stats.sent++;
  };
  // Mecânica: toda mudança que o ajustador anuncia (slider, desfazer, refazer, preset, A × B) vai para as outras janelas como caminho → valor.
  // Compara com o último retrato: pega também o que não passa por `commit` (desfazer/refazer).
  let last = snapshot();
  tuning.onChange(() => {
    const now = snapshot(), changes = Object.keys(now).filter(p => !isLocal.has(p) && JSON.stringify(now[p]) !== JSON.stringify(last[p])).map(p => [p, now[p]]);
    last = now;
    if (!applying && changes.length) send({kind: 'tuning', changes});
  });
  const receive = (/** @type {any} */ msg) => {
    if (!msg || msg.from === me || seen.has(`${msg.from}:${msg.n}`)) return;   // a mesma mensagem chega pelos dois caminhos: aplica uma vez
    seen.add(`${msg.from}:${msg.n}`);if (seen.size > 500) seen.clear();
    stats.received++;
    applying = true;
    try {
      if (msg.kind === 'tuning' && Array.isArray(msg.changes)) {const known = snapshot();tuning.setTransient(msg.changes.filter((/** @type {any} */ c) => Array.isArray(c) && typeof c[0] === 'string' && c[0] in known && !isLocal.has(c[0])));}
      else if (msg.kind === 'visual' && visualParams[msg.key] && typeof msg.k === 'string' && Number.isFinite(msg.v)) visualParams[msg.key][msg.k] = msg.v;
      else return;
    } finally {applying = false;last = snapshot();}
    onRemote(msg);
  };
  if (ch) ch.onmessage = (/** @type {MessageEvent} */ ev) => receive(ev.data);
  const onStorage = (/** @type {StorageEvent} */ ev) => {if (ev.key === STORAGE_KEY && ev.newValue) {try {receive(JSON.parse(ev.newValue));} catch {/* mensagem inválida */}}};
  if (store && typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return {
    /** Parâmetro visual (aprovado do atelier) mudou nesta janela. */
    sendVisual: (/** @type {string} */ key, /** @type {string} */ k, /** @type {number} */ v) => send({kind: 'visual', key, k, v}),
    close: () => {ch?.close?.();if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);},
    stats,
    available: true,
  };
}
