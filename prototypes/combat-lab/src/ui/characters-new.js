/** Novo núcleo do painel de personagens (substitui render/slot/statesBox/libraryBox do painel antigo). */

// Grupos da lista de estados (cada estado do combate aponta para um bloco de animação).
const GROUPS = [
  ['loco', '🏃', 'Locomoção', ['idle', 'turn', 'walk', 'run', 'sprint', 'walk_stop', 'sprint_stop', 'walk_back', 'walk_left', 'walk_right']],
  ['tackle', '💥', 'Tackle e carga', ['tackle', 'tackle_charge', 'tackle_pl2', 'tackle_pl3', 'brake']],
  ['dodge', '💨', 'Esquiva e salto', ['dodge_forward', 'dodge_back', 'dodge_left', 'dodge_right', 'jump']],
  ['guard', '🛡', 'Defesa', ['block_start', 'block', 'block_end', 'guard_impact', 'blocked']],
  ['react', '💫', 'Reações', ['hit', 'knockback', 'wall_splat', 'fall', 'land', 'recover', 'downed', 'death']],
  ['moves', '✦', 'Moves', ['move_1', 'move_2', 'move_3', 'move_4']],
];
const groupOf = id => GROUPS.find(g => g[3].includes(id))?.[0] ?? 'react';
const FIGHTER = ['Azul', 'Vermelho'], FIGHTER_ICON = ['🔵', '🔴'];

export function installNewPanel(ctx) {
  const {ui, $, hooks, onCharactersChanged, setCharacter, escape, loadStudioFile, loadAnimationFile, validateAnimations, ACTION_IDS, ACTION_LABELS, STATE_LABELS, fold, openState, validationBox, heightBox, telemetryBox} = ctx;
  const view = {fighter: 0, filter: 'all', group: 'all', text: '', hover: true, dragClip: null, open: new Set(GROUPS.map(g => g[0])), libText: ''};

  function render() {
    const box = $('char-slots');if (!box) return;
    box.replaceChildren();
    for (const id of [0, 1]) {const el = slot(id);el.hidden = id !== view.fighter;box.append(el);}
    for (const b of document.querySelectorAll('[data-fighter-tab]')) b.setAttribute('aria-pressed', String(Number(b.dataset.fighterTab) === view.fighter));
    renderPreview();
  }
  const selectFighter = id => {view.fighter = id;render();};
  for (const b of document.querySelectorAll('[data-fighter-tab]')) b.onclick = () => selectFighter(Number(b.dataset.fighterTab));

  function slot(id) {
    const el = document.createElement('div');el.className = 'char-slot';el.dataset.fighter = id;
    const src = ui.sources[id], ch = ui.characters[id];
    el.innerHTML = `<div class="cs-model"><div class="cs-title"><h4>${FIGHTER_ICON[id]} ${FIGHTER[id]}</h4><span class="hint">${src ? `<b>${escape(src.name)}</b> · ${ch.clips.length} clipes${src.manifest ? ' · mapa de ações do Studio' : ' · associação por nome'}` : 'Nenhum modelo carregado.'}</span></div>
      <div class="row"><label class="wide-file"><input type="file" accept=".glb" data-model aria-label="GLB do ${id ? 'vermelho' : 'azul'}"></label>${id && ui.sources[0] ? '<button type="button" data-same>Usar o do azul</button>' : ''}${src ? '<button type="button" data-remove>Remover</button>' : ''}</div></div>`;
    el.querySelector('[data-model]').onchange = async e => {
      const f = e.target.files[0];if (!f) return;e.target.value = '';
      try {if (hooks.loadModel) await hooks.loadModel(id, f);else setCharacter(id, await loadStudioFile(f));} catch (err) {const h = el.querySelector('.hint');if (h) h.textContent = 'Erro: ' + err.message;}
    };
    el.querySelector('[data-same]')?.addEventListener('click', () => hooks.useSame ? hooks.useSame() : setCharacter(1, ui.sources[0]));
    el.querySelector('[data-remove]')?.addEventListener('click', () => hooks.remove ? hooks.remove(id) : setCharacter(id, null));
    hooks.slotExtras?.(id, el);
    // Modelos salvos e restauração automática ficam recolhidos quando já há um modelo carregado (o foco é a lista de estados).
    const saved = el.querySelector('.ws-slot');
    if (saved) {const d = document.createElement('details');d.className = 'cs-saved';d.open = !ch;d.innerHTML = '<summary>💾 Modelos salvos e restauração automática</summary>';saved.replaceWith(d);d.append(saved);}
    if (!ch) {
      const empty = document.createElement('div');empty.className = 'cs-empty';
      empty.innerHTML = `<b>Carregue um .glb para começar</b><p class="hint">Use o botão acima ou escolha um personagem salvo. Depois arraste os clipes da biblioteca para os estados, ou escolha no seletor de cada linha.</p>`;
      el.append(empty);return el;
    }
    // Importar clipes para a biblioteca (os clipes ficam disponíveis para qualquer estado).
    const imp = document.createElement('div');imp.className = 'row cs-import';
    imp.innerHTML = `<label class="import-anim">+ Importar animação para a biblioteca<input type="file" accept=".glb,.gltf" data-import hidden></label><span class="muted" data-import-result></span>`;
    imp.querySelector('[data-import]').onchange = async e => {
      const f = e.target.files[0];if (!f) return;e.target.value = '';const out = el.querySelector('[data-import-result]');
      try {
        const done = hooks.importAnimation ? await hooks.importAnimation(id, ch, f) : await (async () => {const anim = await loadAnimationFile(f), validation = validateAnimations(anim, ch, anim.bytes);(ch.importValidations ??= []).push(validation);return {report: ch.importClips(anim), validation};})();
        const rep = done.report;if (!rep) {out.textContent = done.message || '';return;}
        ch.warmGround();render();const ok = rep.filter(r => r.compatible).length;ui.lastImport = rep;
        const out2 = document.querySelectorAll('.char-slot')[id].querySelector('[data-import-result]');
        out2.textContent = `${ok} de ${rep.length} clipe(s) compatível(is) adicionados à biblioteca${rep.length > ok ? ` · ${rep.length - ok} incompatível(is): ${rep.filter(r => !r.compatible).map(r => r.name).join(', ')}` : ''}.${done.message ? ' ' + done.message : ''}`;
      } catch (err) {out.textContent = 'Erro: ' + err.message;}
    };
    el.querySelector('.cs-model .row').append(...imp.childNodes);   // importar fica na mesma linha do modelo
    if (ch.missingAssociations?.length) {const w = document.createElement('p');w.className = 'warn';w.textContent = `Associações salvas sem clipe (reimporte): ${ch.missingAssociations.join(', ')}.`;el.append(w);}
    const live = document.createElement('p');live.className = 'hint char-live';live.dataset.char = id;el.append(live);
    el.append(summaryBar(id, ch));
    const grid = document.createElement('div');grid.className = 'cs-grid';
    grid.append(statesList(id, ch), libraryPane(id, ch));
    el.append(grid);
    const adv = document.createElement('div');adv.className = 'cs-adv';
    adv.append(validationBox(id, ch), heightBox(id, ch), telemetryBox(id, ch));
    el.append(fold('Avançado do personagem', `adv${id}`, adv, {count: 'validação, altura visual e telemetria'}));
    return el;
  }

  /** Resumo: quantos estados têm clipe próprio, filtros por situação e grupo, busca. */
  function summaryBar(id, ch) {
    const own = ACTION_IDS.filter(a => ch.variantsOf(a).length), missing = ACTION_IDS.length - own.length;
    const bar = document.createElement('div');bar.className = 'cs-summary';
    bar.innerHTML = `<div class="cs-count"><b>${own.length} de ${ACTION_IDS.length}</b> estados com animação própria · <span class="${missing ? 'warn' : 'ok'}">${missing} usam o clipe de reserva (“parado” ou o do tackle)</span></div>
      <div class="cs-filters" role="group" aria-label="Filtro por situação">${[['all', 'Todos'], ['missing', 'Sem animação'], ['own', 'Com animação']].map(([k, t]) => `<button type="button" data-flt="${k}" aria-pressed="${view.filter === k}">${t}</button>`).join('')}</div>
      <div class="cs-groups" role="group" aria-label="Grupo">${[['all', 'Todos os grupos'], ...GROUPS.map(g => [g[0], `${g[1]} ${g[2]}`])].map(([k, t]) => `<button type="button" data-grp="${k}" aria-pressed="${view.group === k}">${t}</button>`).join('')}</div>
      <input type="search" class="state-search" data-q value="${escape(view.text)}" placeholder="🔍 Buscar estado ou clipe…" aria-label="Buscar estado ou clipe">`;
    for (const b of bar.querySelectorAll('[data-flt]')) b.onclick = () => {view.filter = b.dataset.flt;render();};
    for (const b of bar.querySelectorAll('[data-grp]')) b.onclick = () => {view.group = b.dataset.grp;render();};
    bar.querySelector('[data-q]').oninput = e => {view.text = e.target.value.trim().toLowerCase();applyFilters(e.target.closest('.char-slot'));};
    return bar;
  }
  function applyFilters(el) {
    for (const row of el.querySelectorAll('.state-row')) {
      const act = row.dataset.action, sel = row.querySelector('[data-primary]'), has = sel.value !== '';
      const clip = sel.selectedIndex > 0 ? sel.options[sel.selectedIndex].text.toLowerCase() : '';
      const ok = (view.filter === 'all' || (view.filter === 'missing' ? !has : has)) && (view.group === 'all' || groupOf(act) === view.group)
        && (!view.text || (ACTION_LABELS[act] || act).toLowerCase().includes(view.text) || act.includes(view.text) || clip.includes(view.text));
      row.hidden = !ok;
    }
    for (const g of el.querySelectorAll('.cs-group')) g.hidden = ![...g.querySelectorAll('.state-row')].some(r => !r.hidden);
  }

  /** Lista de estados por grupos recolhíveis; cada linha aceita um clipe arrastado da biblioteca. */
  function statesList(id, ch) {
    const wrap = document.createElement('div');wrap.className = 'cs-states state-list';
    const clipOptions = sel => ['<option value="">— sem animação própria —</option>', ...ch.clips.map((c, i) => `<option value="${i}" ${ch.clipInfo[i].compatible ? '' : 'disabled'} ${i === sel ? 'selected' : ''}>${escape(c.name)} · ${c.duration.toFixed(2)} s</option>`)].join('');
    for (const [gk, icon, title, ids] of GROUPS) {
      const group = document.createElement('section');group.className = 'cs-group';group.dataset.group = gk;
      const have = ids.filter(a => ch.variantsOf(a).length).length;
      const head = document.createElement('button');head.type = 'button';head.className = 'cs-group-head';head.setAttribute('aria-expanded', String(view.open.has(gk)));
      head.innerHTML = `<span>${view.open.has(gk) ? '▼' : '▶'}</span><b>${icon} ${title}</b><small class="${have === ids.length ? 'ok' : ''}">${have}/${ids.length}</small>`;
      const body = document.createElement('div');body.className = 'cs-group-body';body.hidden = !view.open.has(gk);
      head.onclick = () => {view.open.has(gk) ? view.open.delete(gk) : view.open.add(gk);const o = view.open.has(gk);body.hidden = !o;head.setAttribute('aria-expanded', String(o));head.firstChild.textContent = o ? '▼' : '▶';};
      for (const action of ids.filter(a => ACTION_IDS.includes(a))) body.append(stateRow(id, ch, action, clipOptions));
      group.append(head, body);wrap.append(group);
    }
    queueMicrotask(() => applyFilters(wrap.closest('.char-slot') ?? wrap));
    return wrap;
  }
  function stateRow(id, ch, action, clipOptions) {
    const list = ch.variantsOf(action), row = document.createElement('div');row.className = 'state-row' + (list.length ? ' has-clip' : '');row.dataset.action = action;
    const extra = list.length > 1 ? ` +${list.length - 1}` : '';
    row.innerHTML = `<div class="state-line"><span class="dot ${list.length ? 'on' : ''}" title="${list.length ? 'Tem animação própria' : 'Usa o clipe de reserva'}"></span><b title="${action}">${escape(ACTION_LABELS[action] || action)}</b>
      <select data-primary aria-label="Animação de ${escape(ACTION_LABELS[action] || action)}">${clipOptions(list[0] ?? -1)}</select>
      <button type="button" data-play title="Prévia" ${list.length ? '' : 'disabled'}>▶</button><button type="button" data-clear title="Limpar" ${list.length ? '' : 'disabled'}>✕</button><button type="button" data-more title="Variantes e velocidade" aria-expanded="false">▸${extra}</button></div><div class="state-more" hidden></div>`;
    row.querySelector('[data-primary]').onchange = e => {ch.setPrimary(action, e.target.value === '' ? null : Number(e.target.value));render();onCharactersChanged();};
    row.querySelector('[data-clear]').onclick = () => {ch.setPrimary(action, null);render();onCharactersChanged();};
    row.querySelector('[data-play]').onclick = () => {if (list.length) ch.startPreview(list[0]);};
    // Soltar um clipe da biblioteca nesta linha.
    row.addEventListener('dragover', e => {if (view.dragClip != null) {e.preventDefault();row.classList.add('drop');}});
    row.addEventListener('dragleave', () => row.classList.remove('drop'));
    row.addEventListener('drop', e => {
      e.preventDefault();row.classList.remove('drop');const i = view.dragClip;view.dragClip = null;if (i == null) return;
      if (ch.setPrimary(action, i) === false) return;render();onCharactersChanged();
    });
    const more = row.querySelector('.state-more'), btn = row.querySelector('[data-more]'), key = `${id}:${action}`;
    const fill = () => {
      more.innerHTML = `<p class="hint">Variantes sorteadas a cada execução (a principal é a A). O sorteio é feito na entrada do estado e o replay repete a escolha.</p><div class="chips"></div><select data-add aria-label="Adicionar variante">${['<option value="">+ adicionar variante…</option>', ...ch.clips.map((c, i) => `<option value="${i}" ${ch.clipInfo[i].compatible && !list.includes(i) ? '' : 'disabled'}>${escape(c.name)}</option>`)].join('')}</select><label class="state-speed">Velocidade <input type="range" min="0.25" max="3" step="0.05" value="${ch.speeds[action] ?? 1}" ${list.length ? '' : 'disabled'} aria-label="Velocidade de ${action}"><output>${(ch.speeds[action] ?? 1).toFixed(2)}×</output></label>`;
      const chips = more.querySelector('.chips');
      list.forEach((index, k) => {
        const chip = document.createElement('div');chip.className = 'chip-variant';
        const name = document.createElement('span');name.className = 'chip-name';name.innerHTML = `<b>${String.fromCharCode(65 + k)}</b> ${escape(ch.clips[index].name)}`;name.title = ch.clips[index].name;chip.append(name);
        const mk = (label, title, fn, dis = false) => {const b = document.createElement('button');b.type = 'button';b.textContent = label;b.title = title;b.disabled = dis;b.onclick = fn;chip.append(b);};
        mk('▶', 'Prévia', () => ch.startPreview(index));mk('▲', 'Subir (A = principal)', () => {ch.moveVariant(action, index, -1);render();onCharactersChanged();}, k === 0);
        mk('▼', 'Descer', () => {ch.moveVariant(action, index, 1);render();onCharactersChanged();}, k === list.length - 1);mk('✕', 'Remover', () => {ch.removeVariant(action, index);render();onCharactersChanged();});
        chips.append(chip);
      });
      more.querySelector('[data-add]').onchange = e => {if (e.target.value !== '' && ch.addVariant(action, Number(e.target.value))) {render();onCharactersChanged();}};
      const r = more.querySelector('input'), o = more.querySelector('output');r.oninput = () => {ch.speeds[action] = Number(r.value);o.textContent = `${Number(r.value).toFixed(2)}×`;};r.onchange = () => {ch.save();onCharactersChanged();};
    };
    const set = open => {openState.set(key, open);more.hidden = !open;btn.setAttribute('aria-expanded', String(open));btn.textContent = (open ? '▾' : '▸') + extra;if (open) fill();};
    btn.onclick = () => set(more.hidden);if (openState.get(key)) set(true);
    return row;
  }

  /** Biblioteca de clipes ao lado: busca, arrastar para um estado, prévia (botão ou passando o mouse) e compensação vertical. */
  function libraryPane(id, ch) {
    const pane = document.createElement('aside');pane.className = 'cs-library';
    pane.innerHTML = `<div class="cs-lib-head"><b>🎞 Biblioteca <small>${ch.clips.length} clipes</small></b><label class="check" title="Toca o clipe no personagem ao passar o mouse"><input type="checkbox" data-hover ${view.hover ? 'checked' : ''}> prévia ao passar o mouse</label></div>
      <input type="search" data-libq value="${escape(view.libText)}" placeholder="🔍 Buscar clipe…" aria-label="Buscar clipe"><p class="hint">Arraste um clipe para um estado ao lado.</p><div class="clip-list"></div>`;
    const list = pane.querySelector('.clip-list');
    ch.clips.forEach((c, i) => {
      const info = ch.clipInfo[i], using = ACTION_IDS.filter(a => ch.variantsOf(a).includes(i)), row = document.createElement('div');
      row.className = 'clip-row' + (info.compatible ? '' : ' bad');row.dataset.clip = i;row.draggable = info.compatible;row.dataset.name = c.name.toLowerCase();
      row.innerHTML = `<div class="clip-head"><span class="grip" aria-hidden="true">⋮⋮</span><span class="chip-name" title="${escape(c.name)}">${escape(c.name)}</span><button type="button" ${info.compatible ? '' : 'disabled'} title="Prévia">▶</button></div>
        <div class="clip-meta muted">${c.duration.toFixed(2)} s · ${escape(info.origin)} · <span class="${info.compatible ? 'ok' : 'bad'}">${info.compatible ? '✓' : '✗ incompatível'} ${(info.coverage * 100).toFixed(0)}%</span>${using.length ? ` · usado em ${using.slice(0, 2).map(a => escape(ACTION_LABELS[a] || a)).join(', ')}${using.length > 2 ? ` +${using.length - 2}` : ''}` : ''}</div>
        <details class="clip-adv"><summary>Compensação vertical</summary><label class="clip-offset"><output>${(ch.clipOffsets[i] ?? 0).toFixed(2)} m</output><input type="range" min="-0.5" max="0.5" step="0.01" value="${ch.clipOffsets[i] ?? 0}" aria-label="Compensação vertical de ${escape(c.name)}"></label></details>`;
      const r = row.querySelector('input'), o = row.querySelector('output');r.oninput = () => {ch.clipOffsets[i] = Number(r.value);o.textContent = `${Number(r.value).toFixed(2)} m`;};r.onchange = () => ch.save();
      row.querySelector('button').onclick = () => ch.startPreview(i);
      row.addEventListener('dragstart', e => {view.dragClip = i;e.dataTransfer.effectAllowed = 'copy';e.dataTransfer.setData('text/plain', c.name);row.classList.add('dragging');});
      row.addEventListener('dragend', () => {view.dragClip = null;row.classList.remove('dragging');});
      let t = null;
      row.addEventListener('mouseenter', () => {if (view.hover && info.compatible && !view.dragClip) t = setTimeout(() => ch.startPreview(i), 450);});
      row.addEventListener('mouseleave', () => {clearTimeout(t);t = null;});
      list.append(row);
    });
    const filter = () => {for (const r of list.children) r.hidden = !!view.libText && !r.dataset.name.includes(view.libText);};
    pane.querySelector('[data-libq]').oninput = e => {view.libText = e.target.value.trim().toLowerCase();filter();};
    pane.querySelector('[data-hover]').onchange = e => {view.hover = e.target.checked;};
    filter();return pane;
  }
  function renderPreview() {
    const slotSel = $('char-preview-slot'), sel = $('char-preview-clip');if (!slotSel) return;
    const ch = ui.characters[Number(slotSel.value)], prev = sel.value;
    sel.innerHTML = ch ? ch.clips.map((c, n) => `<option value="${n}">${n + 1}. ${escape(c.name)} (${c.duration.toFixed(2)} s)</option>`).join('') : '<option>Carregue o GLB neste personagem</option>';
    if (ch && prev !== '' && Number(prev) < ch.clips.length) sel.value = prev;
    $('char-preview-play').disabled = !ch;$('char-preview-stop').disabled = !ch;
    $('char-preview-info').textContent = ch ? `${ch.clips.length} clipes. A prévia não altera movimento, dano, colisão ou regras.` : 'Carregue um personagem com animações.';
  }
  return {render, renderPreview, selectFighter, get fighter() {return view.fighter;}};
}
