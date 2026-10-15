// Aba Personagens: modelos, blocos de animação (estados) com várias variantes, biblioteca de clipes (com importação),
// prévia, altura visual e telemetria da máquina de estados de animação.
import {Character, loadStudioFile, loadAnimationFile, ACTION_IDS, STATE_LABELS} from '../view/characters.js';
import {escape} from './tuning.js';

const ACTION_LABELS = {idle: 'Parado', turn: 'Girar no lugar', walk: 'Andar', run: 'Correr', sprint: 'Sprint (8 direções)', walk_stop: 'Freio da caminhada', sprint_stop: 'Freio do sprint',
  walk_back: 'Andar para trás', walk_left: 'Lateral esquerda', walk_right: 'Lateral direita', block_start: 'Entrar na defesa', block: 'Defesa', block_end: 'Sair da defesa',
  guard_impact: 'Impacto na defesa', blocked: 'Recuo (bloqueado)', tackle: 'Tackle (X)', dodge_forward: 'Esquiva frontal', dodge_back: 'Esquiva traseira', dodge_left: 'Esquiva esquerda',
  dodge_right: 'Esquiva direita', jump: 'Salto', hit: 'Dano', knockback: 'Lançado', fall: 'Queda', land: 'Aterrissar', recover: 'Levantar', downed: 'Caído', death: 'Derrota'};

/** Seção recolhível com botão ▼ (estado lembrado por chave). */
const openState = new Map();
export function fold(title, key, body, {open = false, count = null} = {}) {
  const box = document.createElement('div');box.className = 'fold';
  const head = document.createElement('div');head.className = 'fold-head';
  const btn = document.createElement('button');btn.type = 'button';btn.className = 'fold-btn';
  const label = document.createElement('span');label.className = 'fold-title';label.textContent = title;
  if (count !== null) {const c = document.createElement('small');c.className = 'fold-count';c.textContent = count;label.append(' ', c);}
  const set = v => {openState.set(key, v);body.hidden = !v;btn.textContent = v ? '▼' : '▶';btn.setAttribute('aria-expanded', String(v));btn.title = (v ? 'Recolher ' : 'Expandir ') + title;};
  btn.onclick = () => set(body.hidden);head.append(btn, label);body.classList.add('fold-body');box.append(head, body);set(openState.has(key) ? openState.get(key) : open);
  box.setOpen = set;return box;
}

export function createCharacterPanel({ui, view, $, onCharactersChanged}) {
  function setCharacter(id, source) {
    ui.characters[id]?.dispose();ui.characters[id] = null;ui.sources[id] = source;
    if (source) {const ch = new Character(source, {tint: id === 1 && (ui.sources[0] === source || ui.sources[0]?.name === source.name) ? '#ff5a4a' : null, slot: id});view.scene.add(ch.root);ui.characters[id] = ch;}
    view.setCharacter(id, ui.characters[id]);render();onCharactersChanged();
  }
  function render() {
    const box = $('char-slots');box.replaceChildren();
    for (const id of [0, 1]) box.append(slot(id));
    renderPreview();
  }
  function slot(id) {
    const el = document.createElement('div');el.className = 'char-slot';const src = ui.sources[id], ch = ui.characters[id];
    el.innerHTML = `<h4>${id ? 'Vermelho' : 'Azul'}</h4><p class="hint">${src ? `${escape(src.name)} · ${ch.clips.length} clipes${src.manifest ? ' · mapa de ações do Studio' : ' · associação por nome'}` : 'Usando bloco.'}</p>
      <div class="row"><label class="wide-file"><input type="file" accept=".glb" data-model aria-label="GLB do ${id ? 'vermelho' : 'azul'}"></label>${id && ui.sources[0] ? '<button type="button" data-same>Usar o do azul</button>' : ''}${src ? '<button type="button" data-remove>Remover</button>' : ''}</div>`;
    el.querySelector('[data-model]').onchange = async e => {const f = e.target.files[0];if (!f) return;try {setCharacter(id, await loadStudioFile(f));} catch (err) {el.querySelector('.hint').textContent = 'Erro: ' + err.message;}};
    el.querySelector('[data-same]')?.addEventListener('click', () => setCharacter(1, ui.sources[0]));
    el.querySelector('[data-remove]')?.addEventListener('click', () => setCharacter(id, null));
    if (!ch) return el;
    // Importar clipes para a biblioteca (não cria blocos novos: os clipes ficam disponíveis para qualquer estado).
    const imp = document.createElement('div');imp.className = 'row';
    imp.innerHTML = `<label class="import-anim">+ Importar animação para biblioteca<input type="file" accept=".glb,.gltf" data-import hidden></label><span class="muted" data-import-result></span>`;
    imp.querySelector('[data-import]').onchange = async e => {
      const f = e.target.files[0];if (!f) return;const out = imp.querySelector('[data-import-result]');
      try {const rep = ch.importClips(await loadAnimationFile(f));render();const ok = rep.filter(r => r.compatible).length;
        ui.lastImport = rep;el.dispatchEvent(new CustomEvent('imported', {bubbles: true, detail: rep}));
        $('char-slots').querySelectorAll('.char-slot')[id].querySelector('[data-import-result]').textContent = `${ok} de ${rep.length} clipe(s) compatível(is) adicionados à biblioteca${rep.length > ok ? ` · ${rep.length - ok} incompatível(is): ${rep.filter(r => !r.compatible).map(r => r.name).join(', ')}` : ''}.`;
      } catch (err) {out.textContent = 'Erro: ' + err.message;}
    };
    el.append(imp);
    const live = document.createElement('p');live.className = 'hint char-live';live.dataset.char = id;el.append(live);
    if (ch.missingAssociations?.length) {const w = document.createElement('p');w.className = 'warn';w.textContent = `Associações salvas sem clipe (reimporte): ${ch.missingAssociations.join(', ')}.`;el.append(w);}
    const missing = ch.missingStates();
    if (missing.length) {const m = document.createElement('p');m.className = 'warn';m.textContent = `Sem animação própria (usa “parado”): ${missing.map(k => STATE_LABELS[k]).join(', ')}.`;el.append(m);}
    el.append(heightBox(id, ch), statesBox(id, ch), libraryBox(id, ch), telemetryBox(id, ch));
    return el;
  }
  function heightBox(id, ch) {
    const body = document.createElement('div');
    body.innerHTML = `<label class="field">Altura visual do ${id ? 'vermelho' : 'azul'} <output data-out>${ch.visualOffset.toFixed(2)} m</output><input type="range" min="-1" max="1" step="0.01" value="${ch.visualOffset}" data-offset></label>
      <label class="check"><input type="checkbox" data-auto ${ch.autoGround ? 'checked' : ''}> Ajuste automático por animação (apoia o ponto mais baixo de cada clipe no chão)</label>
      <p class="hint" data-ground></p><p class="hint">Só visual: o colisor, a sombra e a física não se movem. Compensação extra por clipe: Biblioteca.</p>`;
    const r = body.querySelector('[data-offset]');r.oninput = () => {ch.visualOffset = Number(r.value);body.querySelector('[data-out]').textContent = `${ch.visualOffset.toFixed(2)} m`;};r.onchange = () => ch.save();
    body.querySelector('[data-auto]').onchange = e => {ch.autoGround = e.target.checked;ch.save();};
    return fold('Altura visual e apoio no chão', `h${id}`, body, {open: true});
  }
  function statesBox(id, ch) {
    const body = document.createElement('div');const table = document.createElement('table');table.className = 'variants';
    table.innerHTML = '<tr><th>Estado</th><th>Variantes (sorteadas a cada execução)</th><th>Velocidade</th></tr>';
    const options = ['<option value="">+ adicionar…</option>', ...ch.clips.map((c, i) => `<option value="${i}" ${ch.clipInfo[i].compatible ? '' : 'disabled'}>${escape(c.name)} · ${c.duration.toFixed(2)} s${ch.clipInfo[i].compatible ? '' : ' (incompatível)'}</option>`)].join('');
    for (const action of ACTION_IDS) {
      const tr = document.createElement('tr');tr.dataset.action = action;const list = ch.variantsOf(action);
      tr.innerHTML = `<td title="${action}">${escape(ACTION_LABELS[action] || action)}</td><td><div class="chips"></div><select aria-label="Adicionar variante a ${action}">${options}</select></td><td class="speed"><input type="range" min="0.25" max="3" step="0.05" aria-label="Velocidade de ${action}"><output></output></td>`;
      const chips = tr.querySelector('.chips');
      list.forEach((index, k) => {
        const chip = document.createElement('span');chip.className = 'chip-variant';chip.innerHTML = `<b>${String.fromCharCode(65 + k)}</b> ${escape(ch.clips[index].name)}`;
        const mk = (label, title, fn, dis = false) => {const b = document.createElement('button');b.type = 'button';b.textContent = label;b.title = title;b.disabled = dis;b.onclick = fn;chip.append(b);};
        mk('▶', 'Prévia desta variante', () => {ch.startPreview(index);});mk('▲', 'Subir', () => {ch.moveVariant(action, index, -1);render();}, k === 0);
        mk('▼', 'Descer', () => {ch.moveVariant(action, index, 1);render();}, k === list.length - 1);mk('✕', 'Remover associação', () => {ch.removeVariant(action, index);render();onCharactersChanged();});
        chips.append(chip);
      });
      const sel = tr.querySelector('select');sel.onchange = () => {if (sel.value !== '' && ch.addVariant(action, Number(sel.value))) {render();onCharactersChanged();}};
      const range = tr.querySelector('input'), out = tr.querySelector('output');range.value = ch.speeds[action] ?? 1;out.textContent = `${Number(range.value).toFixed(2)}×`;range.disabled = !list.length;
      range.oninput = () => {ch.speeds[action] = Number(range.value);out.textContent = `${Number(range.value).toFixed(2)}×`;};range.onchange = () => {ch.save();onCharactersChanged();};
      table.append(tr);
    }
    body.append(table);
    const hint = document.createElement('p');hint.className = 'hint';hint.textContent = 'A variante é sorteada na entrada do estado, com semente determinística (o replay repete a escolha), e nunca troca durante a reprodução. Com a sincronização ligada, a primeira variante define a duração da ação; as demais são esticadas para a mesma duração.';
    body.append(hint);
    return fold('Blocos de animação (estados)', `s${id}`, body, {open: true, count: `${ACTION_IDS.length} estados`});
  }
  function libraryBox(id, ch) {
    const body = document.createElement('div');const table = document.createElement('table');
    table.innerHTML = '<tr><th>Clipe</th><th>Origem</th><th>Compatível</th><th>Compensação vertical</th><th></th></tr>';
    ch.clips.forEach((c, i) => {
      const info = ch.clipInfo[i], tr = document.createElement('tr');tr.dataset.clip = i;
      tr.innerHTML = `<td>${escape(c.name)}<br><small class="muted">${c.duration.toFixed(2)} s</small></td><td>${escape(info.origin)}</td><td class="${info.compatible ? 'ok' : 'bad'}">${info.compatible ? '✓' : '✗'} ${(info.coverage * 100).toFixed(0)}%</td>
        <td><input type="range" min="-0.5" max="0.5" step="0.01" value="${ch.clipOffsets[i] ?? 0}" aria-label="Compensação vertical de ${escape(c.name)}"><output>${(ch.clipOffsets[i] ?? 0).toFixed(2)}</output></td><td><button type="button" ${info.compatible ? '' : 'disabled'}>▶</button></td>`;
      const r = tr.querySelector('input'), o = tr.querySelector('output');r.oninput = () => {ch.clipOffsets[i] = Number(r.value);o.textContent = Number(r.value).toFixed(2);};r.onchange = () => ch.save();
      tr.querySelector('button').onclick = () => ch.startPreview(i);table.append(tr);
    });
    body.append(table);
    return fold('Biblioteca de clipes', `l${id}`, body, {count: `${ch.clips.length} clipes`});
  }
  function telemetryBox(id, ch) {
    const body = document.createElement('div');body.dataset.telemetry = id;
    body.innerHTML = `<div class="row"><button type="button" data-export>↓ Exportar telemetria (JSON)</button><button type="button" data-clear>Limpar</button><span class="muted" data-stats></span></div><div class="table-wrap" data-log></div>`;
    body.querySelector('[data-export]').onclick = () => {const a = document.createElement('a');a.href = URL.createObjectURL(new Blob([JSON.stringify({character: ch.source.name, transitions: ch.transitions, restartsAvoided: ch.restartsAvoided, log: ch.log}, null, 2)], {type: 'application/json'}));a.download = `arenamon-animacao-${id ? 'vermelho' : 'azul'}.json`;a.click();};
    body.querySelector('[data-clear]').onclick = () => {ch.log.length = 0;live();};
    return fold('Telemetria de animação', `t${id}`, body, {count: 'trocas, % tocada, motivo e origem'});
  }
  /** Atualização ~10×/s: animação atual e últimas trocas. */
  function live() {
    for (const el of document.querySelectorAll('.char-live')) {
      const ch = ui.characters[Number(el.dataset.char)];if (!ch?.current) {el.textContent = '';continue;}
      const cur = ch.current, d = cur.clip.duration || 1;
      el.innerHTML = `Agora: <b>${escape(STATE_LABELS[cur.key] || cur.key)}</b> → ${escape(cur.id)} (“${escape(ch.clips[cur.index].name)}”, ${(100 * Math.min(1, cur.action.time / d)).toFixed(0)}%, ${ch.speedOf(cur.id).toFixed(2)}×)`;
      for (const tr of el.parentElement.querySelectorAll('tr[data-action]')) tr.classList.toggle('playing', tr.dataset.action === cur.id);
    }
    for (const box of document.querySelectorAll('[data-telemetry]')) {
      const ch = ui.characters[Number(box.dataset.telemetry)];if (!ch || box.hidden || box.closest('[hidden]')) continue;
      box.querySelector('[data-stats]').textContent = `${ch.transitions} trocas · ${ch.restartsAvoided} reinícios evitados · ${ch.log.filter(e => e.interrupted).length} interrupções`;
      const rows = ch.log.slice(-24).reverse();
      box.querySelector('[data-log]').innerHTML = `<table><tr><th>t</th><th>De → para</th><th>Clipe</th><th>Tocado</th><th>Motivo</th><th>Origem</th></tr>${rows.map(e => `<tr class="${e.interrupted ? 'warn' : ''}"><td>${e.t.toFixed(2)}</td><td>${escape(STATE_LABELS[e.from] || e.from || '—')} → ${escape(STATE_LABELS[e.to] || e.to)}</td><td>${escape(e.clipTo)}${e.variants > 1 ? ` (${String.fromCharCode(64 + e.variant)}/${e.variants})` : ''}</td><td>${e.from ? `${e.playedSeconds.toFixed(2)} s · ${e.playedPct}%` : '—'}</td><td>${escape(e.reason)}${e.interrupted ? ' · interrompida' : ''}</td><td>${escape(e.source)}</td></tr>`).join('')}</table>`;
    }
  }
  /** Prévia de qualquer clipe (só visual), do reference corrigido. */
  function renderPreview() {
    const slotSel = $('char-preview-slot'), sel = $('char-preview-clip');if (!slotSel) return;
    const ch = ui.characters[Number(slotSel.value)], prev = sel.value;
    sel.innerHTML = ch ? ch.clips.map((c, n) => `<option value="${n}">${n + 1}. ${escape(c.name)} (${c.duration.toFixed(2)} s)</option>`).join('') : '<option>Carregue o GLB neste personagem</option>';
    if (ch && prev !== '' && Number(prev) < ch.clips.length) sel.value = prev;
    $('char-preview-play').disabled = !ch;$('char-preview-stop').disabled = !ch;
    $('char-preview-info').textContent = ch ? `${ch.clips.length} clipes. A prévia não altera movimento, dano, colisão ou regras.` : 'Carregue um personagem com animações.';
  }
  $('char-preview-slot').onchange = renderPreview;
  $('char-preview-play').onclick = () => {const ch = ui.characters[Number($('char-preview-slot').value)], n = Number($('char-preview-clip').value);if (ch?.startPreview(n)) $('char-preview-info').textContent = `Prévia: ${ch.clips[n].name} (${ch.clips[n].duration.toFixed(2)} s), somente visual.`;};
  $('char-preview-stop').onclick = () => {ui.characters[Number($('char-preview-slot').value)]?.stopPreview();renderPreview();};
  return {render, live, setCharacter};
}
