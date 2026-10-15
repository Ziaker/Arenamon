// Barra de vistas do visualizador, em todas as abas: Frente, Costas, Esquerda, Direita e Topo (ortográficas,
// centralizadas e enquadrando o personagem inteiro) e 3D (perspectiva enquadrada). Também liga/desliga o alvo de
// referência (boneco laranja da Visão do jogo), que antes só tinha controle escondido nas opções de cenário.
const E = window.__importer, bar = document.querySelector('.lab-view-toolbar');
const VIEWS = [['front', 'Frente'], ['back', 'Costas'], ['left', 'Esq.'], ['right', 'Dir.'], ['top', 'Topo'], ['perspective', '3D']];
const CSS = `.vb-group{display:inline-flex;border:1px solid #63809e55;border-radius:10px;overflow:hidden;background:#0d1626}
.vb-group button{min-height:34px;padding:0 10px;border:0;border-right:1px solid #63809e33;background:transparent;color:#dcecff;font-size:12px;font-weight:700;cursor:pointer}
.vb-group button:last-child{border-right:0}.vb-group button:hover{background:#1c3149}
.vb-group button[aria-pressed=true]{background:#80e5ec;color:#102033}
.vb-dummy[aria-pressed=true]{background:#ff896b!important;color:#2a0f08!important}`;

if (E && bar) {
  const style = document.createElement('style');style.textContent = CSS;document.head.append(style);
  const group = document.createElement('div');group.className = 'vb-group';group.setAttribute('role', 'group');group.setAttribute('aria-label', 'Vista da câmera');
  group.innerHTML = VIEWS.map(([id, label]) => `<button type="button" data-vb="${id}" aria-pressed="false" title="Vista ${label === '3D' ? 'em perspectiva' : label.toLowerCase()} enquadrando o personagem">${label}</button>`).join('')
    + '<button type="button" class="vb-dummy" id="vb-dummy" aria-pressed="false" title="Mostrar ou esconder o alvo de referência (boneco da Visão do jogo)">Alvo</button>';
  bar.querySelector('#lab-quick-camera')?.after(group);
  const quick = document.getElementById('lab-quick-camera'), dummy = document.getElementById('lab-dummy');
  let current = 'perspective';
  const mark = id => {current = id;for (const b of group.querySelectorAll('[data-vb]')) b.setAttribute('aria-pressed', String(b.dataset.vb === id));};
  /** Vista centralizada: o lab sai do modo de câmera automática (que reposiciona a câmera a cada quadro). */
  function setView(id) {
    if (!E.model) return;
    if (quick && quick.value !== 'free') {quick.value = 'free';quick.dispatchEvent(new Event('change'));}
    E.setRigView(id);mark(id);
    document.querySelectorAll('[data-rg-view]').forEach(b => b.ariaPressed = String(b.dataset.rgView === id));
  }
  group.addEventListener('click', e => {const b = e.target.closest('[data-vb]');if (b) setView(b.dataset.vb);});
  // Presets da câmera do lab e a Visão do jogo usam a câmera em perspectiva: volta a ela antes.
  const toPerspective = () => {if (current !== 'perspective' && E.model) {E.setRigView('perspective');mark('perspective');}};
  quick?.addEventListener('change', e => {if (e.isTrusted) toPerspective();}, true);
  document.getElementById('view-game-preset')?.addEventListener('click', toPerspective, true);
  document.querySelectorAll('[data-rg-view]').forEach(b => b.addEventListener('click', () => mark(b.dataset.rgView)));
  const syncDummy = () => document.getElementById('vb-dummy').setAttribute('aria-pressed', String(!!dummy?.checked));
  document.getElementById('vb-dummy').onclick = () => {if (!dummy) return;dummy.checked = !dummy.checked;dummy.dispatchEvent(new Event('input'));syncDummy();};
  dummy?.addEventListener('input', syncDummy);dummy?.addEventListener('change', syncDummy);
  document.getElementById('view-game-preset')?.addEventListener('click', () => setTimeout(syncDummy));
  E.on('installed', () => mark('perspective'));
  syncDummy();
  window.__studioViewBar = {setView, get view() {return current;}};
}

// Espaço de trabalho: em Rigging e Telemetria o painel de organização de animações (direita) fecha para o visualizador
// ganhar largura, e volta ao sair dessas abas — só se foi fechado aqui (se você o reabrir, ele fica aberto).
if (E && window.__studioLayout) {
  const L = window.__studioLayout, FOCUS = new Set(['rigging', 'workbench']);
  let last = L.panel, closedByUs = false;
  E.on('tick', () => {
    const now = L.leftOpen ? L.panel : null;if (now === last) return;
    const was = FOCUS.has(last), is = FOCUS.has(now);last = now;
    if (is && !was && L.rightOpen && E.model) {closedByUs = true;L.setLibrary(false);}
    else if (!is && was && closedByUs) {closedByUs = false;if (!L.rightOpen) L.setLibrary(true);}
  });
}
