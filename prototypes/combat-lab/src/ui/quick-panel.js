// Paleta rápida (Ctrl+K ou /): busca em TODOS os parâmetros do laboratório (qualquer aba), lista do que foi alterado com
// restauração individual ou geral, aplicação de presets e painel de atalhos (?). Reaproveita os controles do Ajustes
// (tuning.controlFor): editar aqui entra no mesmo histórico de desfazer e atualiza as outras abas.
import {C} from '../sim/config.js';

const MAX_RESULTS = 30;
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const keyName = code => String(code ?? '').replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow', 'Seta ').replace('Space', 'Espaço').replace('Escape', 'Esc');

/** Atalhos mostrados no painel; as teclas de combate acompanham o remapeamento de Controles. */
export function shortcutGroups() {
  const kc = C.extras.keyCodes, b = C.extras.bindings, k = name => keyName(kc[b[name]]);
  return [
    ['Combate (jogador azul)', [[`${k('forward')} ${k('back')} ${k('left')} ${k('right')}`, 'Mover'], [k('tackle'), 'Tackle (X, 8 direções)'], [k('dodge'), 'Esquiva (C)'], [k('defend'), 'Defesa (D)'], [k('lock'), 'Travar / soltar alvo'], [`${k('skill1')} / ${k('skill2')}`, 'Moves equipados (segurar carrega)']]],
    ['Partida', [['Espaço / Esc', 'Pausar ou continuar'], ['R', 'Reiniciar a partida'], ['F4 / Backspace', 'Reposicionar os lutadores'], [', e .', 'Voltar / avançar um passo (pausado)'], ['F5', 'Trocar o comportamento do oponente']]],
    ['Tela', [['F2', 'Modo Arena (tela cheia limpa)'], ['F3', 'Painel de depuração'], ['H', 'Mostrar / ocultar hitboxes'], ['M', 'Som ligado / desligado']]],
    ['Laboratório', [['Ctrl+K ou /', 'Buscar parâmetros, alterados e presets'], ['?', 'Esta lista de atalhos'], ['Ctrl+Z / Ctrl+Y', 'Desfazer / refazer ajustes'], ['Tecla A × B', 'Alternar os dois presets na comparação jogável']]],
  ];
}

export function createQuickPanel({$, tuning, presets, onOpen = () => {}}) {
  const root = $('quick-pal'), input = $('quick-q'), list = $('quick-list'), foot = $('quick-foot');
  let mode = 'params', open = false;

  const changedList = () => tuning.manifest.filter(m => tuning.changed(m));
  function matches(m, terms) {const hay = norm(`${m.label} ${m.path} ${m.section} ${m.help}`);return terms.every(t => hay.includes(t));}
  const terms = () => norm(input.value).split(/\s+/).filter(Boolean);

  function note(text) {const p = document.createElement('p');p.className = 'hint';p.textContent = text;list.append(p);}
  function renderParams() {
    const t = terms();
    if (!t.length) {note('Digite parte do nome (ex.: “guard stun”, “knockback”, “sombra”) ou do caminho do parâmetro. Busca em todas as abas.');return 'Todos os parâmetros do laboratório';}
    const hits = tuning.manifest.filter(m => matches(m, t));
    for (const m of hits.slice(0, MAX_RESULTS)) list.append(group(m));
    if (!hits.length) note('Nenhum parâmetro encontrado.');
    return `${Math.min(hits.length, MAX_RESULTS)} de ${hits.length} resultados` + (hits.length > MAX_RESULTS ? ' — refine a busca' : '');
  }
  function group(m) {
    const box = document.createElement('div');box.className = 'quick-item';
    const sec = document.createElement('small');sec.textContent = m.section;box.append(sec, tuning.controlFor(m.path));return box;
  }
  function renderChanged() {
    const t = terms(), all = changedList(), hits = all.filter(m => !t.length || matches(m, t));
    if (!all.length) note('Nada foi alterado: todos os parâmetros estão nos padrões do laboratório.');
    else if (!hits.length) note('Nenhum alterado corresponde à busca.');
    for (const m of hits.slice(0, 80)) list.append(group(m));
    if (all.length) {
      const bar = document.createElement('div');bar.className = 'quick-actions';
      const reset = document.createElement('button');reset.type = 'button';reset.textContent = `↺ Restaurar ${hits.length === all.length ? 'todos os ' + all.length : hits.length + ' listados'}`;
      reset.title = 'Volta ao padrão do laboratório; entra no histórico (Ctrl+Z desfaz)';
      reset.onclick = () => {tuning.commit(hits.map(m => [m.path, m.initial]), `Restaurar ${hits.length} alterados`);render();};
      bar.append(reset);list.prepend(bar);
    }
    return `${all.length} alterados em relação ao padrão do laboratório`;
  }
  function renderPresets() {
    const t = terms(), items = presets.all().filter(p => !t.length || norm(p.name).includes(t.join(' ')) || t.every(x => norm(p.name).includes(x)));
    if (!items.length) note('Nenhum preset encontrado.');
    for (const p of items) {
      const row = document.createElement('div');row.className = 'quick-item quick-preset';
      const name = document.createElement('b');name.textContent = p.name + (p.builtin ? ' (inicial)' : '');
      const n = presets.plan(p).length, info = document.createElement('small');info.textContent = n ? `muda ${n} parâmetro(s) em relação ao atual` : 'igual ao atual';
      const apply = document.createElement('button');apply.type = 'button';apply.textContent = 'Aplicar';apply.disabled = !n;apply.title = 'Aplica o preset (Ctrl+Z desfaz)';
      apply.onclick = () => {presets.applyPreset(p);render();};
      row.append(name, info, apply);list.append(row);
    }
    return `${items.length} presets · gerencie e compare na aba Ajustes › Presets`;
  }
  function renderKeys() {
    const t = terms();
    for (const [title, rows] of shortcutGroups()) {
      const hits = rows.filter(([k, d]) => !t.length || t.every(x => norm(k + ' ' + d + ' ' + title).includes(x)));if (!hits.length) continue;
      const h = document.createElement('h4');h.textContent = title;
      const dl = document.createElement('dl');dl.className = 'quick-keys';
      for (const [k, d] of hits) {const dt = document.createElement('dt'), kbd = document.createElement('kbd');kbd.textContent = k;dt.append(kbd);const dd = document.createElement('dd');dd.textContent = d;dl.append(dt, dd);}
      list.append(h, dl);
    }
    if (!list.children.length) note('Nenhum atalho encontrado.');
    return 'Teclas de combate acompanham o remapeamento em Controles';
  }
  const RENDER = {params: renderParams, changed: renderChanged, presets: renderPresets, keys: renderKeys};
  function render() {
    list.replaceChildren();
    const text = RENDER[mode]();foot.textContent = text;
    for (const b of root.querySelectorAll('[data-qmode]')) b.setAttribute('aria-pressed', String(b.dataset.qmode === mode));
    input.placeholder = {params: 'Buscar parâmetro…', changed: 'Filtrar alterados…', presets: 'Buscar preset…', keys: 'Buscar atalho…'}[mode];
    updateCount();
  }
  function updateCount() {
    const n = changedList().length, b = $('changed-open');
    if (b) {b.textContent = `≠ ${n} alterado${n === 1 ? '' : 's'}`;b.dataset.n = String(n);b.title = n ? 'Parâmetros diferentes do padrão do laboratório: ver e restaurar' : 'Nada alterado em relação ao padrão do laboratório';}
    const tab = root.querySelector('[data-qmode=changed]');if (tab) tab.textContent = `Alterados · ${n}`;
  }
  function show(next, query = '') {
    if (next) mode = next;
    if (!open) {open = true;root.hidden = false;onOpen();}
    input.value = query;render();input.focus();input.select();
  }
  function hide() {if (!open) return;open = false;root.hidden = true;document.querySelector('canvas')?.focus?.();}
  const isOpen = () => open;

  for (const b of root.querySelectorAll('[data-qmode]')) b.onclick = () => {mode = b.dataset.qmode;render();input.focus();};
  input.addEventListener('input', render);
  $('quick-close').onclick = hide;
  root.addEventListener('pointerdown', e => {if (e.target === root) hide();});
  // Escape fecha só a paleta (não pausa a partida): o listener do dialog roda antes do da janela.
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') {e.preventDefault();e.stopPropagation();hide();}
  });
  // Atualiza listas abertas quando algo muda (desfazer, preset, restaurar), sem recriar enquanto se arrasta um slider.
  tuning.onChange(() => {updateCount();if (open && !(document.activeElement && document.activeElement.matches?.('input[type=range],input[type=color]'))) render();});
  $('quick-open').onclick = () => show('params');
  $('changed-open').onclick = () => show('changed');
  $('shortcuts-open').onclick = () => show('keys');
  updateCount();
  return {show, hide, isOpen, updateCount};
}
