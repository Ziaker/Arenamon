// Estilos da Workbench, injetados pelo próprio componente (funciona no Studio e em qualquer proposta A/B/C).
// Usa as variáveis do Studio quando existem e tem valores próprios como alternativa.
export const WORKBENCH_CSS = `
.wb{--wb-bg:var(--panel,#121c2b);--wb-line:var(--edge,#2a3a52);--wb-text:var(--text,#e6eef8);--wb-muted:var(--muted,#9fb1c9);--wb-accent:#6ec3ff;--wb-warn:#ff6d7a;--wb-ok:#5fd39a;
  display:flex;flex-direction:column;gap:10px;color:var(--wb-text);font-size:13px;min-width:0;container-type:inline-size;container-name:wb}
.wb-head{display:flex;flex-direction:column;gap:8px;position:sticky;top:0;z-index:4;background:var(--wb-bg);padding-bottom:6px;border-bottom:1px solid var(--wb-line)}
.wb-head-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px}.wb-head-row>*{flex:0 1 auto}
.wb-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.wb-chip{display:inline-block;padding:3px 9px;border-radius:999px;border:1px solid var(--wb-line);font-size:12px}
.wb-chip[data-state=vinculado]{border-color:var(--wb-ok);color:var(--wb-ok)}.wb-chip[data-state=rascunho]{border-color:#ffc857;color:#ffc857}
.wb-steps{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px}
.wb-steps button{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;border:1px solid var(--wb-line);border-radius:9px;background:transparent;color:var(--wb-muted);font-size:11px;cursor:pointer;min-width:0}
.wb-steps button b{font-size:12px}.wb-steps button[aria-selected=true]{background:var(--wb-accent);color:#08121f;border-color:var(--wb-accent);font-weight:600}
.wb-steps button:focus-visible,.wb-node:focus-visible,.wb-link:focus-visible{outline:2px solid var(--wb-accent);outline-offset:1px}
.wb-body{display:grid;grid-template-columns:minmax(150px,38%) minmax(0,1fr);gap:10px;min-width:0}
.wb-tree-pane{display:flex;flex-direction:column;gap:6px;min-width:0}
.wb-tree{border:1px solid var(--wb-line);border-radius:9px;max-height:min(56vh,520px);overflow:auto;padding:4px 0}
.wb-node{display:flex;align-items:center;gap:4px;padding:3px 6px 3px calc(6px + var(--depth)*12px);cursor:pointer;white-space:nowrap;border-left:3px solid transparent}
.wb-node:hover{background:#ffffff0d}.wb-node.selected{background:#6ec3ff26;border-left-color:var(--wb-accent)}.wb-node.warn .wb-name{color:#ffb3ba}
.wb-twisty{width:12px;text-align:center;color:var(--wb-muted)}.wb-name{overflow:hidden;text-overflow:ellipsis}
.wb-pick{margin:0}
.wb-badge{display:inline-block;padding:0 6px;border-radius:999px;font-size:10px;border:1px solid var(--wb-line);color:var(--wb-muted)}
.wb-badge.warn{border-color:var(--wb-warn);color:var(--wb-warn)}.wb-badge.ok{border-color:var(--wb-ok);color:var(--wb-ok)}
.wb-main{min-width:0;display:flex;flex-direction:column;gap:10px}
.wb-card{border:1px solid var(--wb-line);border-radius:11px;padding:10px;min-width:0}.wb-card h4{margin:0 0 8px;font-size:13px}
.wb-metrics{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:6px}
.wb-metric{border:1px solid var(--wb-line);border-radius:9px;padding:6px 8px;display:flex;flex-direction:column}.wb-metric span{font-size:11px;color:var(--wb-muted)}.wb-metric b{font-size:16px}
.wb-metric.warn{border-color:var(--wb-warn)}.wb-metric.warn b{color:var(--wb-warn)}
.wb-kv{display:grid;grid-template-columns:minmax(96px,34%) minmax(0,1fr);gap:4px 10px;margin:0}.wb-kv dt{color:var(--wb-muted)}.wb-kv dd{margin:0;overflow-wrap:anywhere}
.wb-matrix{font-size:11px;word-spacing:4px}
.wb-link{background:none;border:0;padding:0;color:var(--wb-accent);cursor:pointer;text-decoration:underline;font:inherit}
.wb-meshes{display:flex;flex-direction:column;gap:4px;margin-bottom:8px}
.wb-mesh{display:flex;justify-content:space-between;gap:8px;border:1px solid var(--wb-line);border-radius:8px;padding:5px 8px;background:transparent;color:inherit;text-align:left;cursor:pointer}
.wb-mesh.selected{border-color:var(--wb-accent)}.wb-mesh span{color:var(--wb-muted);font-size:11px}
.wb-hist{display:inline-flex;align-items:flex-end;gap:2px;height:34px}.wb-hist i{width:9px;height:var(--h);min-height:1px;background:var(--wb-accent);border-radius:2px 2px 0 0}
.wb-layers{display:flex;flex-wrap:wrap;gap:8px 14px}.wb-check{display:inline-flex;gap:5px;align-items:center}
.wb-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}
.wb-small{padding:4px 8px;font-size:12px}
.wb-btn{border:1px solid var(--wb-line);background:transparent;color:var(--wb-text);border-radius:8px;padding:4px 9px;font-size:12px;cursor:pointer;white-space:nowrap}.wb-btn:hover{border-color:var(--wb-accent)}.wb-btn[aria-pressed=true]{background:var(--wb-accent);color:#08121f}
.wb-tools .wb-check{font-size:12px;color:var(--wb-muted)}
.wb-editor{width:100%;box-sizing:border-box;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;background:#0a121d;color:#dbe7f5;border:1px solid var(--wb-line);border-radius:9px;padding:8px;resize:vertical}
.wb-label{display:block;margin-bottom:4px;color:var(--wb-muted)}
.wb-json{max-height:300px;overflow:auto;font-size:11px;background:#0a121d;border-radius:8px;padding:8px;margin:0}
.wb-table{width:100%;border-collapse:collapse;font-size:12px}.wb-table th,.wb-table td{text-align:left;padding:4px;border-bottom:1px solid var(--wb-line);vertical-align:top}
.wb-table tr.changed td{color:#ffd34d}.warn{color:var(--wb-warn)}
.wb-warn{margin:0;padding-left:18px;color:#ffc2c8}.wb-ok-list{margin:0;padding-left:18px;color:#bff0d6}
.wb-ok{color:var(--wb-ok)}.wb-error{border:1px solid var(--wb-warn);border-radius:9px;padding:8px;color:#ffd5d9}.wb-error ul{margin:4px 0 0;padding-left:18px}
.wb-ops{margin:6px 0 0;padding-left:20px}
.wb-experimental{opacity:.8}.wb-hint{color:var(--wb-muted);font-size:12px;margin:4px 0}
.wb-file{cursor:pointer}
.wb-confirm{position:sticky;bottom:0;background:var(--wb-bg);padding:8px 0;border-top:1px solid var(--wb-line)}
.wb-toast{position:sticky;bottom:6px;align-self:center;background:#14324a;border:1px solid var(--wb-accent);border-radius:9px;padding:6px 10px;font-size:12px}
.wb-toast[data-kind=warn]{background:#3d1820;border-color:var(--wb-warn)}
body.wb-wide{--st-left:min(780px,64vw)!important}
/* Adapta-se à largura do PAINEL (estreito no Studio, largo ao ampliar ou numa proposta), não só da tela. */
@container wb (max-width:600px){.wb-body{grid-template-columns:minmax(0,1fr)}.wb-tree{max-height:min(34vh,300px)}.wb-steps{grid-template-columns:repeat(3,minmax(0,1fr))}.wb-steps button{flex-direction:row;justify-content:center;gap:4px;font-size:11px;padding:5px 2px}}
@container wb (max-width:420px){.wb-kv{grid-template-columns:minmax(0,1fr)}.wb-kv dt{margin-top:4px}.wb-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
.wb-steps button{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;
export function injectWorkbenchStyles(doc = document) {
  if (doc.getElementById('wb-styles')) return;const s = doc.createElement('style');s.id = 'wb-styles';s.textContent = WORKBENCH_CSS;doc.head.append(s);
}
