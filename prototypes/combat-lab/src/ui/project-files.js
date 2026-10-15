// Exportar › Pastas do projeto. Três modos, conforme o que estiver disponível (nunca serviços remotos):
//   1. servidor local de desenvolvimento (http://127.0.0.1, API /api/files com áreas e extensões controladas);
//   2. acesso a arquivos do navegador (showDirectoryPicker), numa pasta escolhida e autorizada por você;
//   3. nenhum (HTML aberto por file:// sem essa API): o painel explica e o workspace/backup ZIP continuam valendo.
// Não há leitura automática de arquivos locais a partir de file://.
import {escape} from './tuning.js';
import {formatBytes} from '../workspace/store.js';

const AREA_LABELS = {presets: 'Presets (JSON)', characters: 'Modelos', animations: 'Animações', reports: 'Relatórios', benchmarks: 'Benchmarks'};
const enc = new TextEncoder();

function devAdapter(api, info) {
  return {kind: 'dev', label: `Servidor local (${location.host})`, areas: info.areas,
    async list(area) {const r = await fetch(`${api}/files/${area}`);if (!r.ok) throw new Error((await r.json()).error);return (await r.json()).files;},
    async read(area, name) {const r = await fetch(`${api}/files/${area}/${name.split('/').map(encodeURIComponent).join('/')}`);if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);return r.arrayBuffer();},
    async write(area, name, data) {const r = await fetch(`${api}/files/${area}/${encodeURIComponent(name)}`, {method: 'PUT', body: typeof data === 'string' ? enc.encode(data) : data});const j = await r.json();if (!r.ok) throw new Error(j.error);return j;},
  };
}
function fsAdapter(root) {
  const EXT = {presets: ['.json'], characters: ['.glb', '.gltf'], animations: ['.glb', '.gltf'], reports: ['.json', '.csv'], benchmarks: ['.json']};
  const dir = async (area, create) => root.getDirectoryHandle(area, {create});
  return {kind: 'fs', label: `Pasta escolhida: ${root.name}/ (subpastas presets, characters, animations, reports, benchmarks)`, root,
    async list(area) {let d;try {d = await dir(area, false);} catch {return [];}const out = [];for await (const [name, h] of d.entries()) if (h.kind === 'file' && EXT[area].some(e => name.toLowerCase().endsWith(e))) {const f = await h.getFile();out.push({name, size: f.size, mtime: f.lastModified});}return out.sort((a, b) => b.mtime - a.mtime);},
    async read(area, name) {return (await (await (await dir(area, false)).getFileHandle(name)).getFile()).arrayBuffer();},
    async write(area, name, data) {const h = await (await dir(area, true)).getFileHandle(name, {create: true}), w = await h.createWritable();await w.write(data);await w.close();return {ok: true, name};},
  };
}

/** ctx: {$, presets, wsUI, ws(), download, reportsOf: () => [{name, data}]} */
export function createProjectFiles(ctx) {
  const {$} = ctx;let adapter = null;
  const dev = typeof window !== 'undefined' && window.__ARENAMON_DEV__;
  async function detect() {
    if (dev?.api) {try {const r = await fetch(dev.api + '/health');if (r.ok) adapter = devAdapter(dev.api, await r.json());} catch {adapter = null;}}
    render();
  }
  async function pick() {
    try {const root = await window.showDirectoryPicker({id: 'arenamon-projeto', mode: 'readwrite'});adapter = fsAdapter(root);render();}
    catch (e) {if (e.name !== 'AbortError') msg(`<span class="bad">${escape(e.message)}</span>`);}
  }
  // A última mensagem sobrevive à atualização das listas (que redesenha o painel).
  let lastMsg = '';const msg = h => {lastMsg = h;const m = $('pf-msg');if (m) m.innerHTML = h;};
  async function render() {
    const box = $('pf-panel');if (!box) return;
    if (!adapter) {
      box.innerHTML = `<p class="hint">Indisponível neste modo: o HTML aberto por arquivo não lê pastas sozinho. Use o servidor local opcional (<code>npm run dev:combat-lab</code>, abre em http://127.0.0.1:5173) ${'showDirectoryPicker' in window ? 'ou escolha uma pasta abaixo (o navegador pede sua autorização)' : '(este navegador não oferece acesso a pastas)'}. O workspace e o backup ZIP continuam funcionando sem isso.</p>
        ${'showDirectoryPicker' in window ? '<button type="button" id="pf-pick">Escolher pasta…</button>' : ''}<p class="hint" id="pf-msg"></p>`;
      $('pf-pick')?.addEventListener('click', pick);return;
    }
    box.innerHTML = `<p class="ok">${escape(adapter.label)}</p><div class="row"><button type="button" id="pf-refresh">Atualizar listas</button><button type="button" id="pf-save-presets">Salvar meus presets aqui</button><button type="button" id="pf-save-reports">Salvar relatórios atuais</button></div><p class="hint" id="pf-msg"></p><div id="pf-areas"></div>`;
    $('pf-refresh').onclick = () => {lastMsg = '';render();};$('pf-save-presets').onclick = savePresets;$('pf-save-reports').onclick = saveReports;$('pf-msg').innerHTML = lastMsg;
    const areas = $('pf-areas');
    for (const area of Object.keys(AREA_LABELS)) {
      let files = [];try {files = await adapter.list(area);} catch (e) {msg(`<span class="bad">${escape(area)}: ${escape(e.message)}</span>`);}
      const sec = document.createElement('div');sec.className = 'pf-area';sec.dataset.area = area;
      sec.innerHTML = `<h4>${AREA_LABELS[area]} <small class="muted">${files.length} arquivo(s)${adapter.areas?.[area] ? ` · ${escape(adapter.areas[area].dir)}/` : ''}</small></h4>${files.length ? `<table>${files.slice(0, 30).map(f => `<tr data-file="${escape(f.name)}"><td>${escape(f.name)}<br><small class="muted">${formatBytes(f.size)} · ${new Date(f.mtime).toLocaleString('pt-BR')}</small></td><td>${actions(area)}</td></tr>`).join('')}</table>` : '<p class="hint">Vazia.</p>'}`;
      for (const tr of sec.querySelectorAll('tr[data-file]')) for (const b of tr.querySelectorAll('button')) b.onclick = () => act(area, tr.dataset.file, b.dataset.act);
      areas.append(sec);
    }
  }
  const actions = area => ({presets: '<button type="button" data-act="load">Carregar</button>', characters: '<button type="button" data-act="blue">Azul</button><button type="button" data-act="red">Vermelho</button>', animations: '<button type="button" data-act="anim0">Importar no azul</button>', reports: '', benchmarks: ''})[area];
  async function act(area, name, what) {
    try {
      const bytes = await adapter.read(area, name), base = name.split('/').at(-1);
      if (area === 'presets') {
        const d = JSON.parse(new TextDecoder().decode(bytes)), p = d.schema === 'arenamon-lab-preset' ? d.preset : d;if (!p?.name || !p.values) throw new Error('não é um preset do laboratório');
        const list = ctx.presets.list().filter(x => x.name !== p.name);list.push(p);ctx.presets.saveAll(list);msg(`<span class="ok">Preset “${escape(p.name)}” carregado na biblioteca (Ajustes › Presets).</span>`);
      } else if (area === 'characters') {await ctx.wsUI.loadModel(what === 'red' ? 1 : 0, new File([bytes], base));msg(`<span class="ok">${escape(base)} carregado no ${what === 'red' ? 'vermelho' : 'azul'} (e salvo no workspace).</span>`);}
      else if (area === 'animations') {
        const ch = ctx.ui.characters[0];if (!ch) throw new Error('carregue um modelo no azul primeiro');
        const r = await ctx.wsUI.importAnimation(0, ch, new File([bytes], base));ctx.charPanel.render();msg(`<span class="ok">${escape(base)}: ${r.report ? `${r.report.filter(x => x.compatible).length} de ${r.report.length} clipe(s) compatível(is)` : escape(r.message)}.</span>`);
      }
    } catch (e) {msg(`<span class="bad">${escape(name)}: ${escape(e.message)}</span>`);}
  }
  const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'preset';
  async function savePresets() {
    const list = ctx.presets.list();if (!list.length) {msg('Nenhum preset do usuário para salvar (os iniciais vivem no código).');return;}
    let n = 0;for (const p of list) {await adapter.write('presets', `${slug(p.name)}.json`, JSON.stringify({schema: 'arenamon-lab-preset', version: 1, preset: p}, null, 1));n++;}
    msg(`<span class="ok">${n} preset(s) gravado(s) em presets/.</span>`);render();
  }
  async function saveReports() {
    const reps = ctx.reportsOf();if (!reps.length) {msg('Nenhum relatório gerado nesta sessão ainda (gravador, diagnóstico, treino, benchmark ou avaliação da IA).');return;}
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');let n = 0;
    for (const r of reps) {await adapter.write(r.kind === 'performance-benchmark' ? 'benchmarks' : 'reports', `${r.name}-${stamp}.json`, JSON.stringify(r.data));n++;}
    msg(`<span class="ok">${n} relatório(s) gravado(s).</span>`);render();
  }
  detect();
  return {detect, render, pick, get adapter() {return adapter;}, savePresets, saveReports};
}
