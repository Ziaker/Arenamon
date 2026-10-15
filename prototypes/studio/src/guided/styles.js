// Estilos do Rigging guiado (Proposta B aprovada), com as cores do Studio.
export const GUIDED_CSS = `
body.gr-wide{--st-left:min(420px,40vw)!important}
.gr{display:flex;flex-direction:column;gap:12px;margin-bottom:12px}
.gr-mode{display:grid;grid-template-columns:1fr 1fr;border:1px solid #63809e55;border-radius:10px;overflow:hidden;background:#0d1626}
.gr-mode button{min-height:36px;border:0;background:transparent;color:#cfe3f7;font-weight:800;font-size:12px;cursor:pointer}
.gr-mode button[aria-pressed=true]{background:#80e5ec;color:#102033}
.gr-steps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}
.gr-step{display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 2px;border-radius:10px;border:1px solid #8cb4dc1f;background:#16243a80;color:#9fb6cc;font-size:10px;font-weight:750;cursor:pointer;text-align:center;line-height:1.15}
.gr-step b{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#172a42;color:#9fb6cc;font-size:11px}
.gr-step[aria-current=step]{border-color:#54d9ee;background:linear-gradient(135deg,#54d9ee38,#1e304ce6);color:#fff;box-shadow:0 0 14px #54d9ee33}
.gr-step[aria-current=step] b{background:#54d9ee;color:#081729}
.gr-step.done b{background:#bff36a;color:#0b2413}
.gr-step.done{border-color:#bff36a66}
.gr-head h3{margin:2px 0!important;font-size:16px;color:#fff}.gr-head p{margin:0;font-size:12px;color:#9fb6cc}
.gr-badge{display:inline-block;font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:#54d9ee26;color:#8ff0ff;border:1px solid #54d9ee55}
.gr-card{background:#0d1626;border:1px solid #63809e40;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px}
.gr-card h4{margin:0;font-size:13px;color:#eaf6ff}
.gr-tip{display:flex;gap:8px;background:#54d9ee14;border:1px solid #54d9ee38;border-radius:9px;padding:9px;font-size:12px;color:#c7def4;line-height:1.45}
.gr-warn{background:#ff896b14;border-color:#ff896b55;color:#ffd6c9}
.gr-ok{background:#bff36a14;border-color:#bff36a55;color:#e3ffc0}
.gr-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.gr-btn{min-height:32px;padding:0 12px;border-radius:9px;border:1px solid #63809e66;background:#172a41;color:#dcecff;font-weight:750;font-size:12px;cursor:pointer}
.gr-btn:hover{background:#1f3756}.gr-btn:disabled{opacity:.45;cursor:not-allowed}
.gr-btn.primary{background:linear-gradient(135deg,#80e5ec,#9ab8ff);color:#0b1a2c;border:0}
.gr-btn.small{min-height:26px;padding:0 8px;font-size:11px}
.gr-btn[aria-pressed=true]{background:#80e5ec;color:#102033}
.gr-list{display:flex;flex-direction:column;gap:4px;max-height:300px;overflow:auto}
.gr-item{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:8px;background:#ffffff08;border:1px solid transparent;font-size:12px;cursor:pointer}
.gr-item.selected{border-color:#ffd17d;background:#ffd17d14}
.gr-item span{flex:1;min-width:0}.gr-item small{display:block;color:#9fb6cc;font-size:10.5px}
.gr-sev{width:8px;height:8px;border-radius:50%;flex:none;background:#ff896b}.gr-sev.low{background:#ffd17d}
.gr-kv{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:12px;margin:0}.gr-kv dt{color:#9fb6cc}.gr-kv dd{margin:0;color:#eaf6ff;font-variant-numeric:tabular-nums}
.gr-xyz{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.gr-xyz label{display:flex;flex-direction:column;gap:2px;font-size:10px;color:#9fb6cc}
.gr-xyz input{width:100%;box-sizing:border-box;min-width:0;min-height:30px;border-radius:7px;border:1px solid #5c789655;background:#0a1324;color:#e6f2ff;padding:0 6px;font:inherit;font-size:12px}
.gr-foot{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.gr-doll{width:100%;height:190px;background:#0a1322;border:1px solid #63809e40;border-radius:12px}
.gr-doll circle{cursor:pointer}.gr-doll circle.sel{fill:#ffd17d;stroke:#fff;stroke-width:2}.gr-doll circle.bad{stroke:#ff896b;stroke-width:2}
.gr-radio{display:flex;flex-direction:column;gap:6px}.gr-radio label{display:flex;gap:8px;align-items:flex-start;padding:8px;border-radius:9px;border:1px solid #63809e40;font-size:12px;cursor:pointer}
.gr-radio label:has(input:checked){border-color:#54d9ee;background:#54d9ee12}.gr-radio small{display:block;color:#9fb6cc}
.gr-report li{font-size:12px;margin:2px 0}.gr-report .ok{color:#bff36a}.gr-report .bad{color:#ff9a8a}
`;
