// Biblioteca de animações genéricas (CC0) no Studio: cartão em Projeto que converte os clipes reais da biblioteca
// para o rig humanoide do personagem carregado (retarget.js) e os adiciona à lista de animações, com desfazer.
import library from './robot-expressive.anim.json';
import {retargetClip, inspectTarget, buildSourceSkeleton} from './retarget.js';

const E = window.__importer, section = document.querySelector('[data-section="project"]');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const CSS = `.lib-list{display:grid;gap:4px;margin:8px 0;max-height:260px;overflow:auto}
.lib-item{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:8px;background:#ffffff08;font-size:12px;cursor:pointer}
.lib-item span{flex:1}.lib-item small{opacity:.7}.lib-badge{font-size:10px;padding:1px 6px;border-radius:999px;background:#5ad1b833;color:#8ff0d8}
.lib-credit{font-size:11px;opacity:.8;line-height:1.45}.lib-state{font-size:12px;margin:6px 0}.lib-state.warn{color:#ffb4a2}.lib-state.ok{color:#8ff0d8}`;

if (E && section) {
  const style = document.createElement('style');style.textContent = CSS;document.head.append(style);
  const card = document.createElement('div');card.className = 'st-card';card.id = 'lib-card';
  const src = library.source, selected = new Set();
  card.innerHTML = `<h3>Biblioteca de animações (CC0)</h3>
    <p class="lib-credit"><b>${library.clips.length} animações reais</b> de <b>${esc(src.title)}</b>, por ${esc(src.author)}. Licença <a href="${esc(src.licenseUrl)}" target="_blank" rel="noopener">${esc(src.license)}</a>: uso e redistribuição livres, inclusive comercial.
    Origem: <a href="${esc(src.url)}" target="_blank" rel="noopener">three.js @ ${esc(src.commit.slice(0, 7))}</a> · SHA-256 ${esc(src.sha256.slice(0, 12))}…</p>
    <p class="lib-state" id="lib-state" role="status">Importe um personagem humanoide com esqueleto.</p>
    <div class="st-row"><button type="button" class="btn btn-soft" id="lib-all">Selecionar todas</button><button type="button" class="btn btn-soft" id="lib-demo">Criar manequim de teste</button></div>
    <div class="lib-list" id="lib-list" role="group" aria-label="Animações da biblioteca">${library.clips.map(c => `<label class="lib-item"><input type="checkbox" data-lib="${esc(c.name)}"><span>${esc(c.name)}</span>${c.loop ? '<span class="lib-badge">ciclo</span>' : ''}<small>${c.duration.toFixed(2)} s</small></label>`).join('')}</div>
    <button type="button" class="btn btn-primary st-wide" id="lib-add" disabled>Adicionar ao personagem</button>
    <p class="st-hint">O retarget gira cada osso do personagem como o osso equivalente da origem (raiz, coluna, pescoço, cabeça, clavículas, braços, antebraços, coxas e canelas), proporcional à altura. Mãos, pés e dedos ficam na pose de repouso.</p>`;
  (section.querySelector('.st-project-info') || section.lastElementChild).after(card);
  const $ = id => card.querySelector('#' + id);
  let target = null;
  function refresh() {
    target = E.model ? inspectTarget(E.model) : null;
    const st = $('lib-state');
    if (!E.model) {st.className = 'lib-state';st.textContent = 'Importe um personagem humanoide com esqueleto, ou crie o manequim de teste.';}
    else if (!target.ok) {st.className = 'lib-state warn';st.textContent = `Este personagem não tem ossos para: ${target.missing.join(', ')}. Crie o rig na aba Rigging (template humanoide) e vincule a malha.`;}
    else {st.className = 'lib-state ok';st.textContent = `Compatível: ${Object.keys(target.roles).length} ossos mapeados (${target.roles.root} → raiz, ${target.roles['upperArm.L']} → braço esquerdo…).`;}
    $('lib-add').disabled = !(target?.ok && selected.size);$('lib-add').textContent = selected.size ? `Adicionar ao personagem (${selected.size})` : 'Adicionar ao personagem';
  }
  $('lib-list').addEventListener('change', e => {const n = e.target.dataset.lib;if (!n) return;e.target.checked ? selected.add(n) : selected.delete(n);refresh();});
  $('lib-all').onclick = () => {const all = selected.size < library.clips.length;for (const i of card.querySelectorAll('[data-lib]')) {i.checked = all;all ? selected.add(i.dataset.lib) : selected.delete(i.dataset.lib);}refresh();};
  /** Converte e anexa as animações escolhidas. Uma entrada no histórico; desfazer remove todas. */
  function add(names = [...selected]) {
    if (!E.model) throw Error('Importe o modelo primeiro.');
    const check = inspectTarget(E.model);if (!check.ok) throw Error('Personagem incompatível: faltam ' + check.missing.join(', '));
    E.enterRigRest();
    const source = buildSourceSkeleton(library), converted = names.map(n => retargetClip(library, n, E.model, {source}));
    let added = null;
    const command = {label: `Biblioteca CC0: ${names.length} animação(ões)`,
      redo() {if (!added) {const before = E.clips.length;E.append(converted, src.title + ' (CC0)');added = E.clips.slice(before);for (const [i, c] of added.entries()) c.userData = {...converted[i].userData};}
        else for (const c of added) E.addClip(c, {select: false});},
      undo() {for (const c of [...added].reverse()) E.removeClip(c);},
    };
    const H = window.__studioEditor?.history;if (H) H.run(command);else command.redo();
    window.__studioProject?.markDirty?.('animações da biblioteca CC0');
    return added;
  }
  $('lib-add').onclick = () => {try {const added = add();$('lib-state').className = 'lib-state ok';$('lib-state').textContent = `${added.length} animação(ões) adicionadas à lista. Ctrl+Z desfaz.`;} catch (e) {$('lib-state').className = 'lib-state warn';$('lib-state').textContent = e.message;}};
  /** Manequim sintético (sem recursos externos) com rig e skin feitos pela aba Rigging, para testar a biblioteca. */
  async function demo() {
    const T = E.T, root = new T.Group();root.name = 'ManequimBiblioteca';
    for (const [name, w, h, d, x, y] of [['Tronco', .9, 1, .5, 0, 1.45], ['Cabeca', .45, .45, .45, 0, 2.2], ['BracoE', .9, .22, .22, .9, 1.8], ['BracoD', .9, .22, .22, -.9, 1.8], ['PernaE', .28, .95, .28, .22, .5], ['PernaD', .28, .95, .28, -.22, .5]]) {
      const m = new T.Mesh(new T.BoxGeometry(w, h, d, 3, 6, 3), new T.MeshStandardMaterial({color: 0x8fb3e8}));m.name = name;m.position.set(x, y, 0);root.add(m);
    }
    if (!(await (window.__studioProject?.guardDiscard?.() ?? true))) return;
    await E.install(root, [], 'manequim-biblioteca.glb');
    const R = window.__studioRig, layout = window.__studioLayout, confirm = window.confirm, frame = () => new Promise(r => requestAnimationFrame(() => r()));
    layout.open('rigging');await frame();await frame();R.createTemplate();
    window.confirm = () => true;try {R.bind();} finally {window.confirm = confirm;}
    layout.open('project');refresh();
  }
  $('lib-demo').onclick = async () => {$('lib-demo').disabled = true;try {await demo();} catch (e) {$('lib-state').textContent = 'Manequim falhou: ' + e.message;} finally {$('lib-demo').disabled = false;}};
  E.on('installed', refresh);E.on('rigChanged', r => {if (r !== 'rest') refresh();});
  refresh();
  window.__studioLibrary = {library, add, demo, refresh, get selected() {return [...selected];}};
}
