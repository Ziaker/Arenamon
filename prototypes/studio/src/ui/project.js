// Estado do projeto: alterações não salvas, salvar/exportar com confirmação real, aviso de saída e
// cópia local de recuperação.
//
// Salvar e exportar usam a File System Access API (showSaveFilePicker) quando disponível: o estado
// “salvo” só é mostrado depois que o arquivo foi gravado; cancelar o seletor não altera nada. Sem essa
// API (ex.: Firefox), o arquivo é entregue ao gerenciador de downloads e o estado indica “baixado — não
// verificado”, porque a página não consegue confirmar a gravação.
//
// Recuperação: com alterações pendentes, após alguns segundos sem novas edições, o projeto completo é
// exportado como GLB para o IndexedDB deste navegador (somente local, nunca enviado). A cópia só é
// anunciada depois que a transação termina; arquivos acima do limite ou sem cota livre não são gravados.
const $ = id => document.getElementById(id);
const E = window.__importer;
const RECOVERY_LIMIT = 80 * 1024 * 1024, RECOVERY_DELAY = 4000;
const time = d => d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
const mb = n => (n / 1048576).toLocaleString('pt-BR', {maximumFractionDigits: 1}) + ' MB';
const toast = msg => {const n = $('toast');if (!n) return;n.textContent = msg;n.classList.add('show');clearTimeout(toast.t);toast.t = setTimeout(() => n.classList.remove('show'), 3000);};

const P = {dirty: false, state: 'clean', savedAt: null, recoveryTimer: 0, recovering: false, busy: false, name: 'arenamon'};
const LABELS = {
  clean: () => E.model ? 'Sem alterações' : 'Nenhum projeto',
  dirty: () => 'Alterações não salvas',
  saving: () => 'Salvando…',
  saved: () => `Projeto salvo às ${time(P.savedAt)}`,
  downloaded: () => `Projeto baixado às ${time(P.savedAt)} · não verificado`,
  error: () => 'Falha ao salvar',
};
function setState(state, detail) {
  P.state = state;const text = LABELS[state]();
  $('st-save').dataset.state = state;$('st-save-text').textContent = text;$('st-save').title = detail || text;
  $('st-info-state').textContent = detail ? `${text} · ${detail}` : text;
  $('st-save-project').disabled = $('st-top-save').disabled = !E.model || P.busy;
}
function markDirty(reason) {
  if (!E.model || P.recovering) return;
  P.dirty = true;if (P.state !== 'saving') setState('dirty', reason ? `última: ${reason}` : '');
  scheduleRecovery();
}
function markClean(state = 'clean') {P.dirty = false;setState(state);}

// ---------- Gravação de arquivos ----------
/** Pede o destino primeiro (enquanto há gesto do usuário), depois gera o conteúdo e grava. */
async function saveFile({name, description, mime, ext}, produce) {
  if (typeof window.showSaveFilePicker === 'function') {
    let handle;
    try {handle = await window.showSaveFilePicker({suggestedName: name, types: [{description, accept: {[mime]: [ext]}}]});}
    catch (e) {if (e?.name === 'AbortError') return {ok: false, canceled: true};return {ok: false, error: e};}
    try {const data = await produce();const w = await handle.createWritable();await w.write(new Blob([data], {type: mime}));await w.close();return {ok: true, verified: true, name: handle.name, size: data.byteLength ?? data.length};}
    catch (e) {return {ok: false, error: e};}
  }
  try {
    const data = await produce(), url = URL.createObjectURL(new Blob([data], {type: mime})), a = document.createElement('a');
    a.href = url;a.download = name;a.click();setTimeout(() => URL.revokeObjectURL(url), 2000);
    return {ok: true, verified: false, name, size: data.byteLength ?? data.length};
  } catch (e) {return {ok: false, error: e};}
}
const baseName = () => (P.name || 'arenamon').replace(/\.arenamon$/i, '');
async function saveProject() {
  if (!E.model || P.busy) return false;P.busy = true;const wasDirty = P.dirty;setState('saving');
  try {
    const r = await saveFile({name: baseName() + '.arenamon.glb', description: 'Projeto Arenamon (GLB)', mime: 'model/gltf-binary', ext: '.glb'}, () => E.exportGLB({unlit: false, noTextures: false}));
    P.busy = false;
    if (r.canceled) {setState(wasDirty ? 'dirty' : 'clean', 'salvamento cancelado');toast('Salvamento cancelado. Nada foi alterado.');return false;}
    if (!r.ok) {setState('error', r.error?.message || String(r.error));toast('Falha ao salvar o projeto: ' + (r.error?.message || r.error));console.warn(r.error);return false;}
    P.savedAt = new Date();P.dirty = false;setState(r.verified ? 'saved' : 'downloaded', `${r.name} · ${mb(r.size)}`);await clearRecovery();
    toast(r.verified ? `Projeto salvo: ${r.name}` : 'Projeto enviado para Downloads. Confirme o arquivo no navegador.');return true;
  } finally {P.busy = false;$('st-save-project').disabled = $('st-top-save').disabled = !E.model;}
}
async function exportFinal(kind) {
  if (!E.model) return;const out = $('st-export-result');out.dataset.state = 'busy';out.textContent = 'Gerando arquivo…';
  const r = kind === 'json'
    ? await saveFile({name: baseName() + '-acoes.json', description: 'Ações Arenamon (JSON)', mime: 'application/json', ext: '.json'}, async () => JSON.stringify(E.manifest(), null, 2))
    : await saveFile({name: baseName() + '.glb', description: 'GLB final', mime: 'model/gltf-binary', ext: '.glb'}, () => E.exportGLB());
  const what = kind === 'json' ? 'JSON de ações' : 'GLB final';
  if (r.canceled) {out.dataset.state = 'canceled';out.textContent = `Exportação do ${what} cancelada.`;return r;}
  if (!r.ok) {out.dataset.state = 'error';out.textContent = `Falha ao exportar o ${what}: ${r.error?.message || r.error}`;console.warn(r.error);return r;}
  out.dataset.state = 'ok';
  out.textContent = `${what} ${r.verified ? 'gravado' : 'enviado para Downloads (não verificado)'} às ${time(new Date())}: ${r.name} · ${mb(r.size)}.` + (P.dirty ? ' O projeto continua com alterações não salvas: use Salvar para poder continuar a edição depois.' : '');
  E.status(out.textContent);return r;
}

// ---------- Confirmação ----------
function confirmDialog() {
  const modal = $('st-confirm');modal.hidden = false;const last = document.activeElement;q('[data-answer="cancel"]', modal).focus();
  return new Promise(resolve => {
    const done = answer => {modal.hidden = true;modal.removeEventListener('click', onClick);modal.removeEventListener('keydown', onKey);last?.focus?.();resolve(answer);};
    const onClick = e => {const a = e.target.closest('[data-answer]')?.dataset.answer;if (a) done(a);else if (e.target === modal) done('cancel');};
    const onKey = e => {if (e.key === 'Escape') {e.preventDefault();done('cancel');}};
    modal.addEventListener('click', onClick);modal.addEventListener('keydown', onKey);
  });
}
function q(sel, root) {return root.querySelector(sel);}
/** Antes de descartar o trabalho atual (substituir o modelo, recuperar outra sessão). */
async function guardDiscard() {
  if (!P.dirty) return true;
  const answer = await confirmDialog();
  if (answer === 'cancel') return false;
  if (answer === 'save') return saveProject();
  await clearRecovery();P.dirty = false;return true;
}
window.addEventListener('beforeunload', e => {if (P.dirty) {e.preventDefault();e.returnValue = '';}});

// ---------- Recuperação local (IndexedDB) ----------
function db() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(Error('IndexedDB indisponível'));
    const r = indexedDB.open('arenamon-studio', 1);r.onupgradeneeded = () => r.result.createObjectStore('recovery');
    r.onsuccess = () => resolve(r.result);r.onerror = () => reject(r.error);
  });
}
async function tx(mode, fn) {const d = await db();return new Promise((resolve, reject) => {const t = d.transaction('recovery', mode), s = t.objectStore('recovery'), req = fn(s);t.oncomplete = () => {d.close();resolve(req?.result);};t.onerror = t.onabort = () => {d.close();reject(t.error || Error('transação abortada'));};});}
const readRecovery = () => tx('readonly', s => s.get('last')).catch(() => null);
async function clearRecovery() {clearTimeout(P.recoveryTimer);try {await tx('readwrite', s => s.delete('last'));} catch {}$('st-info-recovery').textContent = '—';}
function scheduleRecovery() {clearTimeout(P.recoveryTimer);P.recoveryTimer = setTimeout(writeRecovery, RECOVERY_DELAY);}
async function writeRecovery() {
  if (!P.dirty || !E.model || P.busy) return;
  const info = $('st-info-recovery');
  try {
    const bytes = await E.exportGLB({unlit: false, noTextures: false});
    if (!P.dirty) return;
    if (bytes.byteLength > RECOVERY_LIMIT) {info.textContent = `não gravada: projeto com ${mb(bytes.byteLength)} (limite ${mb(RECOVERY_LIMIT)})`;return;}
    const est = await navigator.storage?.estimate?.().catch(() => null);
    if (est && est.quota - est.usage < bytes.byteLength * 1.2) {info.textContent = 'não gravada: sem espaço livre no navegador';return;}
    const record = {bytes, name: P.name, savedAt: Date.now(), clips: E.clips.length, size: bytes.byteLength};
    await tx('readwrite', s => s.put(record, 'last'));
    info.textContent = `cópia neste navegador às ${time(new Date(record.savedAt))} (${mb(record.size)})`;
  } catch (e) {info.textContent = 'não gravada: ' + (e?.message || e);}
}
async function offerRecovery() {
  const r = await readRecovery();if (!r?.bytes) return;
  $('st-recovery-text').textContent = `${r.name || 'Projeto'} · ${r.clips} animações · ${mb(r.size)} · ${new Date(r.savedAt).toLocaleString('pt-BR')}. A cópia fica só neste navegador.`;
  $('st-recovery').hidden = false;window.__studioLayout?.open('project');
}
$('st-recovery-open').onclick = async () => {
  const r = await readRecovery();if (!r?.bytes) {$('st-recovery').hidden = true;return;}
  if (!(await guardDiscard())) return;
  try {
    P.recovering = true;const file = new File([r.bytes], (r.name || 'recuperado') + '.arenamon.glb');const data = await E.parse(file);
    await E.install(data.scene, data.animations, file.name);
  } catch (e) {E.status('Não foi possível recuperar: ' + e.message);P.recovering = false;return;}
  P.recovering = false;P.name = r.name || P.name;$('st-recovery').hidden = true;
  // A sessão recuperada ainda não foi gravada em arquivo: continua marcada como não salva.
  P.dirty = true;setState('dirty', 'sessão recuperada');scheduleRecovery();updateInfo();
};
$('st-recovery-discard').onclick = async () => {await clearRecovery();$('st-recovery').hidden = true;toast('Cópia de recuperação descartada.');};

// ---------- Integração ----------
function updateInfo() {
  $('st-info-model').textContent = E.model ? P.name : '—';$('st-info-clips').textContent = String(E.clips.length);
  const c = E.selectedClip;$('st-clip-chip').textContent = c ? `▶ ${c.name}` : 'Nenhuma animação';$('st-clip-chip').title = c ? `Animação selecionada: ${c.name} · ${c.duration.toFixed(2)} s` : 'Nenhuma animação';
}
E.on('installed', (saved, sourceFile) => {
  P.name = (sourceFile || 'arenamon').replace(/\.(glb|fbx)$/i, '').replace(/\.arenamon$/i, '');
  if (P.recovering) return;
  if (saved) {P.savedAt = null;markClean('clean');setState('clean', 'projeto aberto de arquivo');}
  else {P.dirty = true;setState('dirty', 'novo personagem importado');scheduleRecovery();}
  window.__studioLayout?.render();updateInfo();
});
E.on('dirty', reason => markDirty(reason));
for (const ev of ['selected', 'clipsChanged', 'clipEdited']) E.on(ev, updateInfo);
$('st-save-project').onclick = saveProject;$('st-top-save').onclick = saveProject;
$('export').onclick = () => exportFinal('glb');$('export-json').onclick = () => exportFinal('json');
window.addEventListener('keydown', e => {if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {e.preventDefault();if (E.model) saveProject();}});
setState('clean');updateInfo();offerRecovery();
window.__studioProject = {markDirty, guardDiscard, saveProject, exportFinal, writeRecovery, clearRecovery, readRecovery, get dirty() {return P.dirty;}, get state() {return P.state;}};
