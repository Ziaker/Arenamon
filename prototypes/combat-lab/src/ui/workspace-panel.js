// Interface do workspace persistente: modelos por slot (reabrir/restaurar), animações importadas, armazenamento
// (uso, exclusão explícita, liberar espaço), backup completo em ZIP (exportar/importar com prévia e opções) e o
// histórico de calibrações. A lógica de dados fica em workspace/*.js; aqui só a composição com o laboratório.
import {Character, loadStudioFile, loadAnimationFile} from '../view/characters.js';
import {storeAsset, loadAsset, storageUsage, formatBytes} from '../workspace/store.js';
import {sha256} from '../workspace/hash.js';
import {buildPackage, readPackage, unresolvedRefs, installPackageAssets} from '../workspace/workspace.js';
import {escape} from './tuning.js';
import {validateAnimations, validateModel} from '../view/validate.js';

const SLOT = ['azul', 'vermelho'];
const fileFrom = (bytes, name) => new File([bytes], name, {type: 'model/gltf-binary'});

/**
 * ctx: {ws, store, ui, tuning, $, download, charPanel (definido depois via setPanel), presets: {list, saveAll},
 *       homologation: {exportData, importData}, applyDocUi(doc), collectApp()}
 */
export function createWorkspaceUI(ctx) {
  const {ws, store, ui, tuning, $} = ctx;
  let panel = null;const slotMsg = ['', ''];
  const setMsg = (slot, html) => {slotMsg[slot] = html;panel?.render();};

  // ---------- Estado das associações por modelo ----------
  Character.stateStore = {
    get: ch => ws.modelState(ch.source.assetId, ch.source.name).state,
    set: (ch, data) => ws.setModelState(ch.source.assetId, ch.source.name, data),
  };

  /** Reimporta, na ordem original, as animações registradas para o modelo (os nomes dos clipes dependem da ordem). */
  async function applyImports(slot) {
    const ch = ui.characters[slot], id = ch?.source.assetId;if (!id) return [];
    const problems = [];
    for (const imp of ws.doc.models[id]?.imports || []) {
      if (ch.importedAssets?.has(imp.id)) continue;
      const r = await loadAsset(store, imp.id);
      if (r.error) {problems.push(`${imp.name}: ${r.message}`);continue;}
      try {const anim = await loadAnimationFile(fileFrom(r.bytes, imp.name));(ch.importValidations ??= []).push(validateAnimations(anim, ch, anim.bytes));ch.importClips(anim);(ch.importedAssets ??= new Set()).add(imp.id);} catch (e) {problems.push(`${imp.name}: ${e.message}`);}
    }
    if (problems.length) ch.importProblems = problems;
    ch.warmGround();return problems;
  }
  async function install(slot, source) {
    panel.setCharacter(slot, source);
    const problems = await applyImports(slot);const ch = ui.characters[slot];if (ch) ch.validation = validateModel(ch.source, ch, ch.source.bytes);panel.render();ctx.onCharactersChanged?.();
    return problems;
  }

  /** Arquivo escolhido pelo usuário: valida (parse), persiste pelo SHA-256 e instala no slot. */
  async function loadModel(slot, file) {
    setMsg(slot, `<span class="muted">Carregando ${escape(file.name)}…</span>`);
    let source;try {source = await loadStudioFile(file);} catch (e) {setMsg(slot, `<span class="bad">Arquivo recusado: ${escape(e.message)}</span>`);throw e;}
    const bytes = await file.arrayBuffer();let saved = null, saveError = null;
    try {saved = await storeAsset(store, {name: file.name, kind: 'model', bytes});} catch (e) {saveError = e;}
    source.assetId = saved?.id ?? await sha256(bytes);
    const problems = await install(slot, source);
    ws.setSlot(slot, {modelId: source.assetId, name: file.name, active: 1});
    const persisted = saved && store.binary;
    setMsg(slot, (saveError ? `<span class="bad">Modelo carregado, mas NÃO salvo: ${escape(saveError.message)}</span>` : persisted ? `<span class="ok">${saved.duplicate ? 'Mesmo conteúdo já armazenado (reutilizado)' : saved.repaired ? 'Cópia armazenada estava danificada: regravada e salva neste navegador' : 'Modelo salvo neste navegador'} · SHA-256 ${source.assetId.slice(0, 12)}…</span>` : `<span class="warn">Modelo carregado só nesta aba: ${escape(store.reason)}</span>`)
      + (problems.length ? `<br><span class="warn">Animações importadas não recuperadas: ${problems.map(escape).join(' · ')}</span>` : ''));
    renderStorage();
  }
  /** Reabre o último modelo do slot a partir do armazenamento (com verificação de integridade). */
  async function reopen(slot, {auto = false} = {}) {
    const s = ws.doc.slots[slot];if (!s?.modelId) return {error: 'Nenhum modelo usado antes neste slot.'};
    const r = await loadAsset(store, s.modelId);
    if (r.error) {setMsg(slot, `<span class="bad">${auto ? 'Restauração automática falhou' : 'Não foi possível reabrir'} “${escape(s.name || '?')}”: ${escape(r.message)}</span>${/Selecione/.test(r.message) ? '' : ' Selecione o arquivo de novo acima.'}`);return {error: r.message};}
    let source;try {source = await loadStudioFile(fileFrom(r.bytes, r.meta.name));} catch (e) {setMsg(slot, `<span class="bad">“${escape(s.name)}” não pôde ser lido: ${escape(e.message)}</span>`);return {error: e.message};}
    source.assetId = s.modelId;source.name = s.name || r.meta.name;
    const problems = await install(slot, source);ws.setSlot(slot, {active: 1});
    store.touchAsset(s.modelId, {lastUsedAt: Date.now()}).catch(() => {});
    setMsg(slot, `<span class="ok">${auto ? 'Restaurado automaticamente' : 'Reaberto'}: ${escape(source.name)}${ws.doc.models[s.modelId]?.imports?.length ? ` + ${ws.doc.models[s.modelId].imports.length} arquivo(s) de animação` : ''}.</span>`
      + (problems.length ? `<br><span class="warn">Não recuperadas: ${problems.map(escape).join(' · ')}</span>` : '') + (ws.doc.models[s.modelId]?.migratedFrom ? '<br><span class="muted">Associações migradas do formato antigo (por nome de arquivo).</span>' : ''));
    return {ok: true, problems};
  }
  async function useSame() {
    const src = ui.sources[0];if (!src) return;await install(1, src);
    ws.setSlot(1, {modelId: src.assetId ?? null, name: src.name, active: 1});setMsg(1, '<span class="muted">Mesmo modelo do azul.</span>');
  }
  function remove(slot) {panel.setCharacter(slot, null);ws.setSlot(slot, {active: 0});setMsg(slot, ws.doc.slots[slot].modelId ? '<span class="muted">Removido do slot (continua armazenado; use “Reabrir último modelo”).</span>' : '');}

  /** Animação importada: deduplicada pelo conteúdo, persistida e associada ao modelo (e ao outro slot com o mesmo modelo). */
  async function importAnimation(slot, ch, file) {
    const bytes = await file.arrayBuffer(), id = await sha256(bytes), modelId = ch.source.assetId;
    if (modelId && ws.doc.models[modelId]?.imports?.some(i => i.id === id) && ch.importedAssets?.has(id)) return {report: null, message: `“${file.name}” já foi importado para este modelo (mesmo conteúdo, SHA-256 ${id.slice(0, 10)}…). Nada foi duplicado.`};
    const anim = await loadAnimationFile(file), validation = validateAnimations(anim, ch, anim.bytes);(ch.importValidations ??= []).push(validation);
    const report = ch.importClips(anim);(ch.importedAssets ??= new Set()).add(id);
    // O outro slot com o mesmo modelo recebe os mesmos clipes (mesmos nomes, mesmas associações).
    const other = ui.characters[1 - slot];if (other && other !== ch && modelId && other.source.assetId === modelId && !other.importedAssets?.has(id)) {other.importClips(await loadAnimationFile(fileFrom(bytes, file.name)));(other.importedAssets ??= new Set()).add(id);other.warmGround();}
    let message;
    if (!modelId) message = 'Animação válida só nesta sessão (modelo sem identificação).';
    else {
      try {const s = await storeAsset(store, {name: file.name, kind: 'animation', bytes});ws.addImport(modelId, {id: s.id, name: file.name});message = store.binary ? 'Salva neste navegador.' : `Válida só nesta aba: ${store.reason}`;}
      catch (e) {message = `NÃO salva: ${e.message}`;}
    }
    ch.lastImportReport = report;renderStorage();
    return {report, message: `Validação: ${validation.label}. ${message}`, validation};
  }

  /** Controles extras de cada slot: reabrir último modelo e restauração automática. */
  function slotExtras(slot, el) {
    const s = ws.doc.slots[slot], ch = ui.characters[slot], box = document.createElement('div');box.className = 'ws-slot';
    const loaded = ch?.source.assetId && ch.source.assetId === s.modelId;
    box.innerHTML = `<div class="row">${s.modelId && !loaded ? `<button type="button" data-reopen title="Carrega ${escape(s.name || '')} do armazenamento deste navegador">↺ Reabrir último modelo utilizado</button>` : ''}
      <label class="check"><input type="checkbox" data-autorestore ${s.autoRestore ? 'checked' : ''}> Restaurar automaticamente na próxima sessão</label></div>
      ${s.modelId ? `<p class="hint">Último: <b>${escape(s.name || '?')}</b> · ${s.modelId.slice(0, 12)}…</p>` : ''}<p class="hint ws-slot-msg">${slotMsg[slot]}</p>`;
    box.querySelector('[data-reopen]')?.addEventListener('click', () => reopen(slot));
    box.querySelector('[data-autorestore]').onchange = e => ws.setSlot(slot, {autoRestore: e.target.checked ? 1 : 0});
    el.querySelector('.row')?.after(box);
  }
  function setPanel(p) {panel = p;}

  // ---------- Armazenamento ----------
  async function renderStorage() {
    const box = $('ws-storage');if (!box) return;
    let u, list;try {u = await storageUsage(store);list = await store.listAssets();} catch (e) {box.innerHTML = `<p class="bad">${escape(e.message)}</p>`;return;}
    const refs = ws.referencedAssets();
    const backend = {indexeddb: 'IndexedDB (modelos e animações salvos neste navegador)', localstorage: 'localStorage (só ajustes; modelos apenas nesta aba)', memory: 'memória (nada persiste)'}[u.backend];
    box.innerHTML = `<p><b>Armazenamento:</b> ${backend}${u.persisted ? ' · persistente' : u.persisted === false ? ' · <span class="muted">pode ser limpo pelo navegador sob pouco espaço</span>' : ''}</p>${u.reason ? `<p class="warn">${escape(u.reason)}</p>` : ''}
      <p>${u.assets} arquivo(s) · ${formatBytes(u.assetBytes)}${u.quota ? ` · uso total da origem ${formatBytes(u.usage)} de ${formatBytes(u.quota)}` : ''}</p>
      ${list.length ? `<table><tr><th>Arquivo</th><th>Tipo</th><th>Tamanho</th><th>Uso</th><th></th></tr>${list.sort((a, b) => b.addedAt - a.addedAt).map(a => `<tr data-asset="${a.id}"><td title="SHA-256 ${a.id}">${escape(a.name)}${a.names?.length > 1 ? `<br><small class="muted">também: ${a.names.filter(n => n !== a.name).map(escape).join(', ')}</small>` : ''}</td><td>${a.kind === 'model' ? 'modelo' : 'animação'}</td><td>${formatBytes(a.size)}</td><td>${refs.has(a.id) ? escape(refs.get(a.id).join('; ')) : '<span class="muted">não usado</span>'}</td><td><button type="button" data-del title="Excluir este arquivo do armazenamento">Excluir</button></td></tr>`).join('')}</table>` : '<p class="hint">Nenhum modelo ou animação armazenado.</p>'}
      <div class="row"><button type="button" id="ws-free">Liberar arquivos não usados</button>${navigator.storage?.persist ? '<button type="button" id="ws-persist">Pedir armazenamento persistente</button>' : ''}</div><p class="hint" id="ws-storage-msg"></p>`;
    const msg = t => {const m = $('ws-storage-msg');if (m) m.innerHTML = t;};
    for (const tr of box.querySelectorAll('tr[data-asset]')) tr.querySelector('[data-del]').onclick = async () => {
      const id = tr.dataset.asset, a = list.find(x => x.id === id), used = refs.get(id);
      if (!confirm(`Excluir “${a.name}” (${formatBytes(a.size)}) deste navegador?${used ? `\n\nEm uso: ${used.join('; ')}. As referências ficarão sem arquivo até você selecioná-lo de novo.` : ''}`)) return;
      try {await store.deleteAsset(id);msg(`<span class="ok">“${escape(a.name)}” excluído.</span>`);} catch (e) {msg(`<span class="bad">${escape(e.message)}</span>`);}
      renderStorage();
    };
    $('ws-free').onclick = async () => {
      const unused = list.filter(a => !refs.has(a.id));if (!unused.length) {msg('Nenhum arquivo sem uso.');return;}
      if (!confirm(`Excluir ${unused.length} arquivo(s) não usados (${formatBytes(unused.reduce((n, a) => n + a.size, 0))})?\n\n${unused.map(a => a.name).join('\n')}`)) return;
      let n = 0;for (const a of unused) {try {await store.deleteAsset(a.id);n++;} catch (e) {msg(`<span class="bad">${escape(e.message)}</span>`);}}
      msg(`<span class="ok">${n} arquivo(s) excluído(s).</span>`);renderStorage();
    };
    $('ws-persist')?.addEventListener('click', async () => {let ok = false;try {ok = await navigator.storage.persist();} catch {ok = false;}msg(ok ? '<span class="ok">O navegador concedeu armazenamento persistente.</span>' : '<span class="warn">O navegador recusou (normal em file://; os dados continuam salvos, mas podem ser limpos sob pouco espaço).</span>');renderStorage();});
  }

  // ---------- Backup completo (ZIP) ----------
  async function exportPackage() {
    const out = $('ws-import-result');out.innerHTML = '<p class="muted">Gerando pacote…</p>';
    await ws.saveNow();
    try {
      const {bytes, manifest, missing} = await buildPackage(ws, {presets: ctx.presets.list(), homologation: ctx.homologation.exportData(), app: ctx.collectApp(), includeAll: $('ws-export-all').checked});
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      ctx.download(bytes, `arenamon-workspace-${stamp}.zip`, 'application/zip');
      out.innerHTML = `<p class="ok">Pacote gerado: ${manifest.assets.length} arquivo(s) (${formatBytes(manifest.summary.assetBytes)}), ${manifest.summary.presets} preset(s), ${manifest.summary.calibrations} calibração(ões). O navegador não confirma a gravação em disco: verifique a pasta de downloads.</p>`
        + (missing.length ? `<p class="warn">Referências sem arquivo armazenado (fora do pacote): ${missing.map(m => escape(m.refs.join(', ') || m.id.slice(0, 12))).join(' · ')}</p>` : '');
      ctx.onPackageExported?.(manifest);
    } catch (e) {out.innerHTML = `<p class="bad">Falha ao gerar o pacote: ${escape(e.message)}</p>`;}
  }
  async function previewImport(file) {
    const out = $('ws-import-result');out.innerHTML = `<p class="muted">Validando ${escape(file.name)}…</p>`;
    const pkg = await readPackage(new Uint8Array(await file.arrayBuffer()));
    if (pkg.error) {out.innerHTML = `<p class="bad"><b>Pacote recusado:</b> ${escape(pkg.error)}</p><p class="hint">Nada foi alterado.</p>`;return null;}
    const unresolved = await unresolvedRefs(pkg, store);
    const values = pkg.doc.tuning?.values ? tuning.migrate(pkg.doc.tuning.values).values : {};
    const tuneChanges = tuning.manifest.filter(m => m.path in values && typeof values[m.path] === 'number' && Math.abs(values[m.path] - tuning.snapshotValues()[m.path]) > 1e-9);
    const local = ctx.presets.list(), conflicts = pkg.presets.filter(p => local.some(l => l.name === p.name && JSON.stringify(l.values) !== JSON.stringify(p.values))), fresh = pkg.presets.filter(p => !local.some(l => l.name === p.name));
    const known = new Set(ws.doc.calibrations.map(c => c.id)), newCalib = pkg.doc.calibrations.filter(c => !known.has(c.id));
    const existing = [];for (const id of pkg.assets.keys()) if (await store.getAssetMeta(id).catch(() => null)) existing.push(id);
    const hom = pkg.homologation?.items?.filter(i => i.status !== 'pending').length ?? 0;
    const opt = (name, options) => `<label class="field">${options.label}<select data-opt="${name}">${options.list.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>`;
    out.innerHTML = `<p><b>${escape(file.name)}</b> · pacote v${pkg.manifest.version} de ${escape(pkg.manifest.createdAt?.slice(0, 16).replace('T', ' ') || '?')}</p>
      <table><tr><th>Conteúdo</th><th>No pacote</th></tr>
      <tr><td>Ajustes</td><td>${tuneChanges.length} parâmetro(s) diferentes dos atuais</td></tr>
      <tr><td>Modelos dos slots</td><td>${pkg.doc.slots.map((s, i) => `${SLOT[i]}: ${s.modelId ? escape(s.name || '?') : '—'}`).join('<br>')}</td></tr>
      <tr><td>Arquivos</td><td>${pkg.assets.size} (${existing.length} já existem aqui; idênticos pelo SHA-256)</td></tr>
      <tr><td>Presets</td><td>${pkg.presets.length} (${fresh.length} novos, ${conflicts.length} em conflito${conflicts.length ? ': ' + conflicts.map(p => escape(p.name)).join(', ') : ''})</td></tr>
      <tr><td>Calibrações</td><td>${pkg.doc.calibrations.length} (${newCalib.length} novas; as atuais são mantidas)</td></tr>
      <tr><td>Homologação</td><td>${hom} item(ns) avaliados</td></tr></table>
      ${pkg.warnings.length ? `<p class="warn">${pkg.warnings.map(escape).join('<br>')}</p>` : ''}
      ${unresolved.length ? `<p class="warn"><b>Referências sem arquivo</b> (nem no pacote, nem neste navegador): ${unresolved.map(u => escape(u.why)).join('; ')}. Esses itens precisarão ser selecionados de novo.</p>` : '<p class="ok">Todas as referências entre modelos, clipes e estados foram verificadas.</p>'}
      ${opt('tuning', {label: 'Ajustes', list: [['package', 'Usar os do pacote'], ['keep', 'Manter os atuais']]})}
      ${opt('models', {label: 'Modelos dos slots e associações de animação', list: [['package', 'Usar os do pacote'], ['keep', 'Manter os atuais (só adiciona os arquivos)']]})}
      ${opt('presets', {label: 'Presets em conflito', list: [['both', 'Manter os dois (o importado ganha sufixo)'], ['local', 'Manter os deste navegador'], ['package', 'Usar os do pacote']]})}
      ${opt('ui', {label: 'Preferências de interface e última partida', list: [['package', 'Usar as do pacote'], ['keep', 'Manter as atuais']]})}
      ${opt('homologation', {label: 'Homologação', list: [['keep', 'Manter a atual'], ['package', 'Usar a do pacote']]})}
      <p class="hint">Antes de aplicar, os ajustes atuais viram um ponto no histórico de calibrações (“Antes da importação”) e a mudança de ajustes pode ser desfeita com Ctrl+Z.</p>
      <div class="row"><button type="button" class="primary" id="ws-import-apply">Importar com estas opções</button><button type="button" id="ws-import-cancel">Cancelar</button></div>`;
    $('ws-import-cancel').onclick = () => {out.innerHTML = '<p class="muted">Importação cancelada. Nada foi alterado.</p>';};
    $('ws-import-apply').onclick = () => {const o = Object.fromEntries([...out.querySelectorAll('[data-opt]')].map(s => [s.dataset.opt, s.value]));applyImport(pkg, o, file.name);};
    return {pkg, unresolved, tuneChanges: tuneChanges.length, conflicts: conflicts.map(p => p.name)};
  }
  async function applyImport(pkg, o, fileName) {
    const out = $('ws-import-result');
    try {
      ws.addCalibration({label: `Antes da importação de ${fileName}`, values: tuning.snapshotValues(), kind: 'auto'});
      const installed = await installPackageAssets(pkg, store);
      for (const c of pkg.doc.calibrations) if (!ws.doc.calibrations.some(x => x.id === c.id)) ws.doc.calibrations.push(c);
      // Presets.
      const local = ctx.presets.list(), merged = [...local];
      for (const p of pkg.presets) {
        const i = merged.findIndex(l => l.name === p.name);
        if (i < 0) merged.push(p);
        else if (JSON.stringify(merged[i].values) === JSON.stringify(p.values)) continue;
        else if (o.presets === 'package') merged[i] = p;
        else if (o.presets === 'both') {let n = 2, name = `${p.name} (importado)`;while (merged.some(l => l.name === name)) name = `${p.name} (importado ${n++})`;merged.push({...p, name});}
      }
      ctx.presets.saveAll(merged);
      if (o.homologation === 'package' && pkg.homologation) ctx.homologation.importData(pkg.homologation);
      // Modelos: estado das associações e importações de cada modelo do pacote (mesclados); slots conforme a opção.
      for (const [id, m] of Object.entries(pkg.doc.models)) {
        if (o.models === 'package' || !ws.doc.models[id]) ws.doc.models[id] = structuredClone(m);
        else for (const imp of m.imports || []) ws.addImport(id, imp);
      }
      if (o.ui === 'package') {ws.doc.ui = structuredClone(pkg.doc.ui || {});ws.doc.match = structuredClone(pkg.doc.match);ws.doc.animOptions = structuredClone(pkg.doc.animOptions);ctx.applyDocUi(ws.doc);}
      let tuneN = 0;
      if (o.tuning === 'package' && pkg.doc.tuning?.values) {
        const values = tuning.migrate(pkg.doc.tuning.values).values;
        tuneN = tuning.commit(tuning.manifest.filter(m => typeof values[m.path] === 'number').map(m => [m.path, Math.max(m.min, Math.min(m.max, values[m.path]))]), `Workspace importado (${fileName})`);
        tuning.markSaved('workspace importado');
      }
      const restored = [];
      if (o.models === 'package') {
        for (const slot of [0, 1]) {
          const s = pkg.doc.slots[slot];ws.doc.slots[slot] = {...ws.doc.slots[slot], ...structuredClone(s)};
          if (s.modelId && s.active !== 0) {const r = await reopen(slot);restored.push(`${SLOT[slot]}: ${r.error ? 'falhou — ' + escape(r.error) : 'restaurado'}`);}
          else if (ui.characters[slot]) {panel.setCharacter(slot, null);}
        }
      }
      ws.touch();const saved = await ws.saveNow();
      out.innerHTML = `<p class="ok"><b>Workspace importado.</b> ${installed.length} arquivo(s) (${installed.filter(i => i.duplicate).length} já existiam) · ${tuneN} ajuste(s) aplicados · presets: ${merged.length} no total.</p>${restored.length ? `<p>${restored.join('<br>')}</p>` : ''}`
        + (saved.ok ? '' : `<p class="bad">Atenção: o workspace NÃO foi gravado: ${escape(saved.error)}</p>`);
      renderStorage();ctx.onImported?.();
    } catch (e) {out.innerHTML = `<p class="bad">Importação interrompida: ${escape(e.message)}. O ponto “Antes da importação” no histórico de calibrações guarda os ajustes anteriores.</p>`;}
  }

  // ---------- Histórico de calibrações (aba Ajustes) ----------
  function renderCalibrations() {
    const box = $('calib-list');if (!box) return;const current = tuning.snapshotValues();
    const list = [...ws.doc.calibrations].reverse();
    box.innerHTML = list.length ? list.map(c => {
      const diff = tuning.manifest.filter(m => m.path in c.values && Math.abs(c.values[m.path] - current[m.path]) > 1e-9).length;
      return `<div class="preset" data-calib="${c.id}"><span title="${escape(c.label)}">${escape(c.label)} · ${new Date(c.at).toLocaleString('pt-BR')}${c.kind === 'auto' ? ' · auto' : ''} · <b>${diff}</b> ≠ atual</span><button type="button" data-restore ${diff ? '' : 'disabled'}>Restaurar</button><button type="button" data-del title="Excluir do histórico">×</button></div>`;
    }).join('') : '<p class="hint">Nenhum ponto salvo. Salve um ponto antes de experimentar: dá para voltar a ele a qualquer momento.</p>';
    for (const row of box.querySelectorAll('[data-calib]')) {
      const c = ws.doc.calibrations.find(x => x.id === row.dataset.calib);
      row.querySelector('[data-restore]').onclick = () => {const values = tuning.migrate(c.values).values;tuning.commit(tuning.manifest.filter(m => typeof values[m.path] === 'number').map(m => [m.path, values[m.path]]), 'Calibração: ' + c.label);tuning.markSaved('calibração ' + c.label);renderCalibrations();};
      row.querySelector('[data-del]').onclick = () => {if (confirm(`Excluir o ponto “${c.label}” do histórico?`)) {ws.removeCalibration(c.id);renderCalibrations();}};
    }
  }
  function saveCalibration(label, kind = 'manual') {const e = ws.addCalibration({label, values: tuning.snapshotValues(), kind});renderCalibrations();return e;}

  // ---------- Estado na barra superior e na aba Exportar ----------
  function renderStatus(s = ws.status) {
    const chip = $('ws-chip'), line = $('ws-status-line');
    const label = s.state === 'error' ? 'Workspace: falha ao salvar' : s.state === 'saving' || s.pending ? 'Workspace: salvando…' : s.state === 'memory' ? 'Workspace: só nesta aba' : s.state === 'saved' ? 'Workspace salvo' : 'Workspace';
    if (chip) {chip.dataset.state = s.state === 'error' ? 'error' : s.state === 'memory' ? 'memory' : s.pending || s.state === 'saving' ? 'pending' : 'ok';chip.querySelector('span').textContent = label;chip.title = s.error || (s.at ? `Gravado às ${new Date(s.at).toLocaleTimeString('pt-BR')} (${store.kind})` : `Armazenamento: ${store.kind}`);}
    if (line) line.innerHTML = `${escape(label)}${s.at ? ` · ${new Date(s.at).toLocaleTimeString('pt-BR')}` : ''} · ${escape({indexeddb: 'IndexedDB', localstorage: 'localStorage (sem modelos)', memory: 'memória'}[store.kind])}${s.error ? `<br><span class="bad">${escape(s.error)}</span>` : ''}${store.reason ? `<br><span class="warn">${escape(store.reason)}</span>` : ''}`;
  }
  ws.onStatus(renderStatus);

  function bind() {
    $('ws-export').onclick = exportPackage;
    $('ws-import-file').onchange = async e => {const f = e.target.files[0];e.target.value = '';if (f) ui.lastPackagePreview = await previewImport(f);};
    $('ws-save-now').onclick = async () => {const r = await ws.saveNow();renderStatus();if (!r.ok) $('ws-status-line').insertAdjacentHTML('beforeend', '');};
    $('ws-auto-session').checked = !!ws.doc.prefs.autoRestoreSession;$('ws-auto-session').onchange = e => ws.patch('prefs', {autoRestoreSession: e.target.checked ? 1 : 0});
    $('ws-warn-close').checked = !!ws.doc.prefs.warnOnClose;$('ws-warn-close').onchange = e => ws.patch('prefs', {warnOnClose: e.target.checked ? 1 : 0});
    $('calib-save').onclick = () => {const name = $('calib-name').value.trim() || `Ponto ${ws.doc.calibrations.length + 1}`;saveCalibration(name);$('calib-name').value = '';};
    renderStatus();renderStorage();renderCalibrations();
  }
  return {loadModel, reopen, useSame, remove, importAnimation, slotExtras, setPanel, renderStorage, renderCalibrations, saveCalibration, exportPackage, previewImport, applyImport, bind, applyImports,
    hooks: {loadModel, useSame, remove, importAnimation, slotExtras}};
}
