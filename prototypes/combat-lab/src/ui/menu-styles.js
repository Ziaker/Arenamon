// @ts-check
// Telas do pré-jogo em três identidades visuais (A Impacto · B Quadrinhos · C Clássico), sobre o MESMO estado do menu de Seleção Rápida (`quickMenu.state`).
// Esta camada só DESENHA e traduz cliques/teclas em chamadas da API do `quickMenu` (setMove, setPassive, selectCharacter): não guarda loadout, não chama game.reset() e não inicia partida.
// O estilo escolhido é apenas preferência de visão (localStorage); o padrão continua sendo o menu atual («Atual»). Nenhum estilo é o oficial.
import {iconSvg} from '../../../hud-moves/src/data.js';
import {createMenuFx} from './menu-fx.js';
import {moveCatalog, passiveCatalog, invalidReasons, usageLine, PASSIVE_SLOTS, MOVE_CLASSES, PASSIVE_CLASSES} from './menu-styles-model.js';

const STYLES = [
  {id: 'none', rotulo: 'Atual', desc: 'Menu de seleção atual (sem estilo)'},
  {id: 'a', rotulo: 'A · Impacto', desc: 'Angular, vermelho/preto/branco'},
  {id: 'b', rotulo: 'B · Quadrinhos', desc: 'Painéis, halftone e balões'},
  {id: 'c', rotulo: 'C · Clássico', desc: 'Vidro escuro, limpo e profissional'},
];
const KEY = 'arenamon.menuStyle';
const esc = (/** @type {any} */ s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c] ?? c));
const SIDE = [{nome: 'Lutador Azul', marca: 'AZUL'}, {nome: 'Adversário Vermelho', marca: 'VERMELHO'}];

/**
 * @param {{$: (id: string) => any, quickMenu: any, ui: any, info?: Record<string, {hint?: string}>, keys?: (slot: number, i: number) => string}} o
 */
export function createMenuStyles({$, quickMenu, ui, info = {}, keys = (_s, i) => String(i + 1)}) {
  const card = document.querySelector('.quick-start-card'), root = $('menu-styled'), fighters = document.querySelector('.quick-fighters');
  if (!card || !root || !fighters) return {setStyle() {}, get style() {return 'none';}};
  let style = 'none', focusSlot = [0, 0], tip = /** @type {(string | null)[]} */ ([null, null]);   // tip guarda só a CHAVE da carta (o texto é regerado a cada desenho)
  const armed = [false, false];   // slot de Move «armado» por clique: a próxima carta vai para ELE (mesmo se já estiver equipada em outro slot: ela muda de lugar)
  const fxs = [null, null];   // rajadas three.quarks na cena de cada prévia (criadas sob demanda)
  const burst = (/** @type {number} */ s, /** @type {string} */ kind) => {if (style === 'none' || $('menu')?.hidden) return false;fxs[s] ??= createMenuFx(quickMenu.previews[s]);return !!fxs[s]?.burst(style, kind);};
  const parents = [null, null];   // onde os canvases das prévias moravam (voltam ao sair do estilo)

  // ---------- Seletor A/B/C no menu ----------
  const sw = document.createElement('div');
  sw.className = 'qs-switch';sw.setAttribute('role', 'radiogroup');sw.setAttribute('aria-label', 'Estilo visual da tela de seleção');
  sw.innerHTML = '<span class="qs-switch-label">Estilo</span>' + STYLES.map(s => `<button type="button" role="radio" class="qs-sw" data-style="${s.id}" aria-checked="false" title="${esc(s.desc)}">${esc(s.rotulo)}</button>`).join('');
  card.querySelector('.subtitle')?.after(sw);root.setAttribute('role', 'group');
  sw.addEventListener('click', e => {const b = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest('.qs-sw') : null);if (b) setStyle(/** @type {string} */ (b.dataset.style));});
  sw.addEventListener('keydown', e => {   // setas movem entre as opções (grupo de rádio)
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const ids = STYLES.map(s => s.id), at = ids.indexOf(style), next = ids[(at + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + ids.length) % ids.length];
    e.preventDefault();setStyle(next);/** @type {HTMLElement | null} */ (sw.querySelector(`[data-style="${next}"]`))?.focus();
  });

  // ---------- Desenho ----------
  const slotBtn = (/** @type {number} */ s, /** @type {number} */ i, /** @type {any} */ cat) => {
    const id = quickMenu.state.moves[s][i], m = id ? cat.find((/** @type {any} */ c) => c.id === id) : null, on = focusSlot[s] === i;
    return `<div class="qs-slot${m ? '' : ' empty'}${on ? ' on' : ''}" data-kind="move" data-i="${i}" data-k="${m ? m.classe : ''}">
      <button type="button" class="qs-slot-main" data-act="focus-move" data-s="${s}" data-i="${i}" aria-pressed="${on}" aria-label="Slot ${i + 1} (tecla ${esc(keys(s, i))}): ${m ? esc(m.name) : 'vazio'}">
        <span class="qs-key">${esc(keys(s, i))}</span><span class="qs-ico">${m ? iconSvg(m.icon) : ''}</span><span class="qs-sname">${m ? esc(m.name) : '— vazio —'}</span></button>
      ${m ? `<button type="button" class="qs-clear" data-act="clear-move" data-s="${s}" data-i="${i}" aria-label="Esvaziar o slot ${i + 1}" title="Esvaziar">✕</button>` : ''}</div>`;
  };
  const candBtn = (/** @type {number} */ s, /** @type {any} */ m, /** @type {boolean} */ used) => `<button type="button" class="qs-card${used ? ' used' : ''}" data-k="${m.classe}" data-act="pick-move" data-s="${s}" data-id="${esc(m.id)}" data-tip-key="m:${esc(m.id)}" aria-pressed="${used}" aria-label="${esc(m.name)}${used ? ' (já equipado)' : ''}">
      <span class="qs-ico">${iconSvg(m.icon)}</span><span class="qs-cname">${esc(m.name)}</span>${used ? '<span class="qs-mark" aria-hidden="true">✓</span>' : ''}</button>`;
  const pSlot = (/** @type {number} */ s, /** @type {number} */ i, /** @type {any[]} */ all) => {
    const id = quickMenu.state.passives[s][i], p = id ? all.find(x => x.id === id) : null;
    return `<div class="qs-slot qs-pslot${p ? '' : ' empty'}" data-kind="passive" data-i="${i}" data-k="${p ? p.categoria : ''}">
      <span class="qs-key">P${i + 1}</span><span class="qs-ico">${p ? iconSvg(p.icon) : ''}</span><span class="qs-sname">${p ? esc(p.nome) : '— nenhuma —'}</span>
      ${p ? `<button type="button" class="qs-clear" data-act="clear-passive" data-s="${s}" data-i="${i}" aria-label="Remover a passiva ${i + 1}" title="Remover">✕</button>` : ''}</div>`;
  };
  const pCand = (/** @type {number} */ s, /** @type {any} */ p, /** @type {boolean} */ used) => `<button type="button" class="qs-card qs-pcard${used ? ' used' : ''}" data-k="${p.categoria}" data-act="pick-passive" data-s="${s}" data-id="${esc(p.id)}" data-tip-key="p:${esc(p.id)}" aria-pressed="${used}" aria-label="${esc(p.nome)} (${p.origem})${used ? ', equipada' : ''}">
      <span class="qs-ico">${iconSvg(p.icon)}</span><span class="qs-cname">${esc(p.nome)}</span><span class="qs-origin">${p.origem === 'exclusiva' ? 'EXCL.' : 'GEN.'}</span>${used ? '<span class="qs-mark" aria-hidden="true">✓</span>' : ''}</button>`;

  function fighterHtml(/** @type {number} */ s, /** @type {any[]} */ cat) {
    const species = quickMenu.speciesOf(s), ch = quickMenu.characters(s), pc = passiveCatalog(species), allP = [...pc.exclusive, ...pc.generic];
    const usedM = new Set(quickMenu.state.moves[s].filter(Boolean)), usedP = new Set(quickMenu.state.passives[s].filter(Boolean));
    const selChar = quickMenu.state.char[s], errors = invalidReasons(quickMenu.state.passives[s], species);
    const chips = [`<button type="button" class="qs-chip${!selChar ? ' on' : ''}" data-act="char" data-s="${s}" data-id="" aria-pressed="${!selChar}">Carregado${ch.loaded ? `: ${esc(ch.loaded)}` : ''}</button>`,
      ...ch.saved.filter((/** @type {any} */ a) => a.id !== ch.loadedId || selChar === a.id).map((/** @type {any} */ a) => `<button type="button" class="qs-chip${selChar === a.id ? ' on' : ''}" data-act="char" data-s="${s}" data-id="${esc(a.id)}" aria-pressed="${selChar === a.id}">${esc(a.name)}</button>`)].join('');
    const t = tip[s] ? detailOf(s, tip[s] ?? '', cat) : '';
    return `<section class="qs-fighter" data-fighter="${s}" aria-label="${esc(SIDE[s].nome)}">
      <header class="qs-head"><h3 class="qs-title">${esc(SIDE[s].nome)}</h3><span class="qs-species">${species ? `espécie: ${esc(species)}` : 'espécie não identificada'}</span></header>
      <div class="qs-left"><div class="qs-stage"><div class="qs-preview-slot" data-s="${s}"></div><span class="qs-charname">${esc(ui.sources[s]?.name ?? 'Sem modelo carregado')}</span><span class="qs-nomodel" hidden>Prévia 3D indisponível</span></div>
      <div class="qs-chars" role="group" aria-label="Personagem do ${esc(SIDE[s].marca.toLowerCase())}">${chips}</div>
      ${ch.saved.length ? '' : '<p class="qs-note">Nenhum personagem salvo no workspace: usando o carregado.</p>'}
      <div class="qs-detail" aria-live="polite">${t ? t : '<span class="qs-hint">Passe o mouse ou foque uma carta para ver a descrição e o uso.</span>'}</div></div>
      <div class="qs-right"><div class="qs-block"><h4>Moves <small>4 slots</small></h4>
        <div class="qs-slots" role="group" aria-label="Slots de Moves">${[0, 1, 2, 3].map(i => slotBtn(s, i, cat)).join('')}</div>
        <p class="qs-legend" aria-label="Legenda das cores">${Object.entries(MOVE_CLASSES).map(([k, n]) => `<span data-k="${k}"><i></i>${esc(n)}</span>`).join('')}</p>
        <div class="qs-cands" role="group" aria-label="Moves disponíveis (registro do jogo)">${cat.map((/** @type {any} */ m) => candBtn(s, m, usedM.has(m.id))).join('') || '<p class="qs-note">Nenhum Move registrado.</p>'}</div></div>
      <div class="qs-block"><h4>Abilities <small>passivas, até ${PASSIVE_SLOTS} · experimental</small></h4>
        <div class="qs-slots qs-pslots">${Array.from({length: PASSIVE_SLOTS}, (_, i) => pSlot(s, i, allP)).join('')}</div>
        <p class="qs-legend" aria-label="Legenda das cores">${Object.entries(PASSIVE_CLASSES).map(([k, n]) => `<span data-k="${k}"><i></i>${esc(n)}</span>`).join('')}<span class="qs-leg-note">EXCL. = exclusiva da espécie · GEN. = genérica</span></p>
        <div class="qs-cands qs-pcands" role="group" aria-label="Passivas disponíveis">${allP.map(p => pCand(s, p, usedP.has(p.id))).join('')}</div>
        <p class="qs-status ${errors.length ? 'warn' : 'ok'}" role="status">${errors.length ? '⚠ ' + esc(errors.join(' · ')) : '✓ loadout válido'}</p></div></div>
    </section>`;
  }
  /** Texto de detalhe (dados reais) de uma carta. */
  function detailOf(/** @type {number} */ s, /** @type {string} */ key, /** @type {any[]} */ cat) {
    const [k, id] = [key.slice(0, 1), key.slice(2)];
    if (k === 'm') {const m = cat.find(c => c.id === id);return m ? `<b>${esc(m.name)}</b><span>${esc(m.description)}</span><em>${esc(usageLine(m))}</em>` : '';}
    const p = [...passiveCatalog(quickMenu.speciesOf(s)).exclusive, ...passiveCatalog(quickMenu.speciesOf(s)).generic].find(x => x.id === id);
    return p ? `<b>${esc(p.nome)}</b><span><i>Gatilho:</i> ${esc(p.gatilho)}</span><span><i>Efeito:</i> ${esc(p.efeito)}</span><em>${p.origem === 'exclusiva' ? `Exclusiva (${esc(p.especie)})` : 'Genérica'} · ${esc(p.categoria)} · experimental</em>` : '';
  }

  /** Redesenha os dois lutadores preservando o foco (cada botão tem uma chave estável). */
  function render() {
    if (style === 'none') return;
    const cat = moveCatalog(info), active = document.activeElement, fk = active instanceof HTMLElement && root.contains(active) ? focusKeyOf(active) : null;
    for (const p of document.querySelectorAll('.qs-preview-slot canvas')) parentsBack(/** @type {HTMLCanvasElement} */ (p));
    const wrap = root.querySelector('.qs-fighters') ?? root.appendChild(Object.assign(document.createElement('div'), {className: 'qs-fighters'}));
    wrap.innerHTML = [0, 1].map(s => fighterHtml(s, cat)).join('');
    for (const s of [0, 1]) {
      const slot = wrap.querySelector(`.qs-preview-slot[data-s="${s}"]`), cv = document.getElementById(`quick-preview-${s}`);
      if (slot && cv) {if (!parents[s]) parents[s] = cv.parentElement;slot.append(cv);}
      const pv = quickMenu.previews[s];pv?.resize?.(300, 225);
      const nm = wrap.querySelector(`.qs-fighter[data-fighter="${s}"] .qs-nomodel`);if (nm) nm.hidden = !!(pv?.ok && pv?.hasModel);
    }
    if (fk) {   // devolve o foco ao mesmo botão; se ele sumiu (ex.: ✕ de um slot que ficou vazio), vai ao botão do mesmo slot (nunca cai no <body>, onde as teclas do combate voltariam a valer)
      const el = /** @type {HTMLElement | null} */ (wrap.querySelector(fk)), m = fk.match(/data-s="(\d)"\]\[data-i="(\d)"/);
      (el ?? (m ? /** @type {HTMLElement | null} */ (wrap.querySelector(`[data-act="focus-move"][data-s="${m[1]}"][data-i="${m[2]}"]`)) : null) ?? /** @type {HTMLElement | null} */ (wrap.querySelector('.qs-card')))?.focus();
    }
  }
  const focusKeyOf = (/** @type {HTMLElement} */ el) => {const d = el.dataset;return d.act ? `[data-act="${d.act}"][data-s="${d.s}"]${d.i !== undefined ? `[data-i="${d.i}"]` : ''}${d.id !== undefined ? `[data-id="${CSS.escape(d.id)}"]` : ''}` : null;};
  const parentsBack = (/** @type {HTMLCanvasElement} */ _cv) => {   // devolve os canvases ao lugar original antes de recriar o HTML (senão o innerHTML os destruiria)
    const s = Number(_cv.id.slice(-1));if (parents[s] && _cv.parentElement !== parents[s]) parents[s].append(_cv);
  };

  // ---------- Ações (cliques e teclado) ----------
  root.addEventListener('click', e => {
    const b = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest('[data-act]') : null);if (!b) return;
    const s = Number(b.dataset.s), i = Number(b.dataset.i), id = b.dataset.id ?? '';
    switch (b.dataset.act) {
      case 'focus-move': focusSlot[s] = i;armed[s] = true;render();break;
      case 'clear-move': armed[s] = false;quickMenu.setMove(s, i, null);break;
      case 'pick-move': {   // vai para o slot em foco; se já estava equipado em outro slot, ele sai de lá (regra do menu)
        const cur = quickMenu.state.moves[s];
        if (armed[s]) {armed[s] = false;if (quickMenu.setMove(s, focusSlot[s], id)) focusSlot[s] = Math.min(3, focusSlot[s] + 1);break;}   // slot armado: a carta vai para ele (o antigo lugar esvazia)
        if (cur.includes(id)) {quickMenu.setMove(s, cur.indexOf(id), null);break;}   // sem slot armado, clicar numa carta já equipada a desequipa
        let target = focusSlot[s];if (cur[target]) {const free = cur.findIndex((/** @type {any} */ x) => !x);if (free >= 0) target = free;}
        if (quickMenu.setMove(s, target, id)) focusSlot[s] = Math.min(3, target + 1);
        break;
      }
      case 'clear-passive': quickMenu.setPassive(s, i, null);break;
      case 'pick-passive': {
        const cur = quickMenu.state.passives[s];
        if (cur.includes(id)) {quickMenu.setPassive(s, cur.indexOf(id), null);break;}
        const free = cur.findIndex((/** @type {any} */ x) => !x);
        quickMenu.setPassive(s, free >= 0 ? free : PASSIVE_SLOTS - 1, id);break;   // sem espaço livre: a última escolha cede (mesma regra do painel)
      }
      case 'char': quickMenu.selectCharacter(s, id || null);break;
    }
  });
  const showTip = (/** @type {Event} */ e) => {
    const c = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest('[data-tip-key]') : null);if (!c) return;
    const s = Number(c.closest('.qs-fighter')?.getAttribute('data-fighter') ?? 0), html = detailOf(s, c.dataset.tipKey ?? '', moveCatalog(info));
    const el = root.querySelector(`.qs-fighter[data-fighter="${s}"] .qs-detail`);
    if (el && html) {tip[s] = c.dataset.tipKey ?? null;el.innerHTML = html;}
  };
  root.addEventListener('mouseover', showTip);root.addEventListener('focusin', showTip);
  root.addEventListener('keydown', e => {   // setas percorrem as cartas da mesma lista (foco rotativo)
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || !(e.target instanceof HTMLElement) || !e.target.matches('.qs-card, .qs-chip')) return;
    const list = [.../** @type {NodeListOf<HTMLElement>} */ (e.target.parentElement?.querySelectorAll('.qs-card, .qs-chip') ?? [])], at = list.indexOf(e.target);
    if (at < 0) return;e.preventDefault();list[(at + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length].focus();
  });

  // ---------- Estilo ----------
  function applyStyle(/** @type {string} */ next) {
    // devolve os canvases (menu atual) antes de trocar
    if (style !== 'none') for (const s of [0, 1]) {const cv = document.getElementById(`quick-preview-${s}`);if (cv && parents[s]) parents[s].append(cv);}
    style = next;root.dataset.ready = '1';armed.fill(false);
    root.className = `qs qs-${style === 'none' ? 'a' : style}`;root.hidden = style === 'none';fighters.toggleAttribute('hidden', style !== 'none');
    card.classList.toggle('qs-on', style !== 'none');card.dataset.qsStyle = style;
    if (style === 'none') for (const s of [0, 1]) quickMenu.previews[s]?.resize?.(230, 170);   // o menu atual já está atualizado (os seletores usam os mesmos setters): só devolve o tamanho
    else {render();burst(0, 'style');burst(1, 'style');}
  }
  function setStyle(/** @type {string} */ id) {
    const next = STYLES.some(s => s.id === id) ? id : 'none';
    if (next === style && root.dataset.ready) {syncSwitch();return;}
    try {applyStyle(next);} catch (e) {   // falha ao desenhar/ligar efeitos: volta ao menu atual em vez de deixar o menu vazio
      console.error('menu-styles: falha ao aplicar o estilo; voltando ao menu atual', e);
      try {applyStyle('none');} catch (e2) {console.error('menu-styles: falha ao voltar ao menu atual', e2);}
    }
    syncSwitch();
    try {localStorage.setItem(KEY, style);} catch {/* preferência opcional */}
  }
  function syncSwitch() {for (const b of /** @type {NodeListOf<HTMLElement>} */ (sw.querySelectorAll('.qs-sw'))) {const on = b.dataset.style === style;b.setAttribute('aria-checked', String(on));b.tabIndex = on ? 0 : -1;}}   // roving tabindex do grupo de rádio

  quickMenu.onChange(ev => {if (ev.type === 'char') armed.fill(false);render();if (ev.slot >= 0 && ev.type !== 'init') burst(ev.slot, ev.type);})   // feedback de seleção (three.quarks)
  let saved = 'none';try {saved = localStorage.getItem(KEY) ?? 'none';} catch {/* sem armazenamento */}
  setStyle(saved);
  return {setStyle, get style() {return style;}, render, get fxStats() {return fxs.map(f => f?.stats ?? null);}};
}
