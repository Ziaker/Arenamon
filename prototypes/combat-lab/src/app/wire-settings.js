// @ts-check
// Dividido de main.js (comportamento idêntico): wire-settings.

import {C} from '../sim/config.js';
import {OVERLAYS} from '../view/view.js';
import {escape, pathGet} from '../ui/tuning.js';
import {download, syncTuneState} from './tuning-sync.js';
import {store} from './live-panels.js';
import {$, homologation, tuning, ui, view, wsRef} from '../main.js';

export function wireTuningPersistence() {
tuning.onChange(syncTuneState);
// Aviso ao fechar: sempre que o workspace não conseguiu salvar (ou só existe na memória); com a preferência ligada,
// também quando há ajustes não exportados em JSON (comportamento anterior).
window.addEventListener('beforeunload', e => {
  const ws = wsRef.ws, unsafe = !ws || ws.status.state === 'error' || ws.store.kind === 'memory';
  if (ws?.status.pending) ws.saveNow();
  if (tuning.dirty() && (unsafe || ws.doc.prefs.warnOnClose)) {e.preventDefault();e.returnValue = '';}
});
for (const ev of ['pagehide', 'visibilitychange']) window.addEventListener(ev, () => {if ((ev === 'pagehide' || document.hidden) && wsRef.ws?.status.pending) wsRef.ws.saveNow();});
}

export function wireExport() {
const exportAll = () => ({...tuning.exportData(), homologation: homologation.exportData()});
$('export-json').onclick = () => {download(JSON.stringify(exportAll(), null, 2), 'arenamon-calibracao-v8.json');tuning.markSaved('JSON exportado');wsRef.ui?.saveCalibration('JSON exportado', 'auto');$('import-result').innerHTML = '<p class="ok">JSON enviado para Downloads. O navegador não confirma a gravação: verifique o arquivo.</p>';};
$('copy-json').onclick = async () => {try {await navigator.clipboard.writeText(JSON.stringify(exportAll(), null, 2));$('import-result').innerHTML = '<p class="ok">JSON copiado.</p>';} catch {$('import-text').value = JSON.stringify(exportAll(), null, 2);$('import-text').select();$('import-result').innerHTML = '<p class="warn">Sem acesso à área de transferência: o JSON está na caixa abaixo, selecionado.</p>';}};
$('import-file').onchange = async () => {const f = $('import-file').files[0];if (f) $('import-text').value = await f.text();$('import-preview').click();};
$('import-preview').onclick = () => {
  const p = tuning.preview($('import-text').value);
  if (p.error) {$('import-result').innerHTML = `<p class="bad">${escape(p.error)}</p>`;return;}
  if (!p.changes.length) {$('import-result').innerHTML = (p.converted.length ? `<p class="warn">${p.converted.length} campo(s) de formato antigo convertido(s).</p>` : '') + '<p class="ok">O JSON é igual aos ajustes atuais.</p>';return;}
  const migration = (p.converted.length ? `<p class="warn"><b>Migração de formato antigo:</b> ${p.converted.length} campo(s) convertido(s).</p><table><tr><th>Campo antigo</th><th>Novo</th><th>Valor</th></tr>${p.converted.map(c => `<tr><td><code>${escape(c.from)}</code></td><td><code>${escape(c.to)}</code></td><td>${c.value}</td></tr>`).join('')}</table>` : '') + (p.ignored.length ? `<p class="warn"><b>Campos não reconhecidos</b> (não aplicados): ${p.ignored.map(i => `<code>${escape(i.path)}</code>`).join(', ')}</p>` : '');
  $('import-result').innerHTML = migration + `<p>${p.changes.length} parâmetros mudariam (schema ${escape(p.schema)}, versão ${escape(p.version)}):</p><table><tr><th>Parâmetro</th><th>Atual</th><th>JSON</th></tr>${p.changes.slice(0, 40).map(([path, v]) => {const m = tuning.byPath.get(path);return `<tr><td title="${path}">${escape(m.label)}</td><td>${m.fmt(pathGet(C, path))}</td><td>${m.fmt(v)}</td></tr>`;}).join('')}</table>${p.changes.length > 40 ? '<p class="hint">…</p>' : ''}<button type="button" class="primary" id="import-apply">Aplicar ${p.changes.length} ajustes</button>`;
  $('import-apply').onclick = () => {const n = tuning.applyChanges(p.changes, 'JSON importado');$('import-result').innerHTML = `<p class="ok">${n} ajustes aplicados (Ctrl+Z desfaz).</p>`;};
};
$('reset-all').onclick = () => tuning.resetAll();
}

export function wireOverlays() {
// ---------- Visualizar ----------
for (const [key, label, help] of OVERLAYS) {
  const row = document.createElement('label');row.className = 'check';row.title = help;
  row.innerHTML = `<input type="checkbox" data-overlay="${key}"><span><b>${escape(label)}</b><br><small class="muted">${escape(help)}</small></span>`;
  row.querySelector('input').onchange = e => {view.overlays[key] = e.target.checked;};$('overlay-list').append(row);
}
}
