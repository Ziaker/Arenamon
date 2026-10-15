// Aba Personagens: modelos, blocos de animação (estados) com várias variantes, biblioteca de clipes (com importação),
// prévia, altura visual e telemetria da máquina de estados de animação.
import {Character, loadStudioFile, loadAnimationFile, ACTION_IDS, STATE_LABELS} from '../view/characters.js';
import {escape} from './tuning.js';
import {validateModel, validateAnimations} from '../view/validate.js';

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

/**
 * hooks (opcionais, instalados pelo workspace): loadModel(id, file) → carrega e persiste o GLB; useSame(); remove(id);
 * importAnimation(id, ch, file) → {report, message}; slotExtras(id, el) → acrescenta controles ao slot.
 */
export function createCharacterPanel({ui, view, $, onCharactersChanged, hooks = {}}) {
  function setCharacter(id, source) {
    ui.characters[id]?.dispose();ui.characters[id] = null;ui.sources[id] = source;
    if (source) {const ch = new Character(source, {tint: id === 1 && (ui.sources[0] === source || ui.sources[0]?.name === source.name) ? '#ff5a4a' : null, slot: id});view.scene.add(ch.root);ui.characters[id] = ch;ch.warmGround();ch.validation = validateModel(source, ch, source.bytes);ch.importValidations = [];}
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
    el.querySelector('[data-model]').onchange = async e => {
      const f = e.target.files[0];if (!f) return;e.target.value = '';
      try {if (hooks.loadModel) await hooks.loadModel(id, f);else setCharacter(id, await loadStudioFile(f));} catch (err) {const h = $('char-slots').querySelectorAll('.char-slot')[id]?.querySelector('.hint');if (h) h.textContent = 'Erro: ' + err.message;}
    };
    el.querySelector('[data-same]')?.addEventListener('click', () => hooks.useSame ? hooks.useSame() : setCharacter(1, ui.sources[0]));
    el.querySelector('[data-remove]')?.addEventListener('click', () => hooks.remove ? hooks.remove(id) : setCharacter(id, null));
    hooks.slotExtras?.(id, el);
    if (!ch) return el;
    // Importar clipes para a biblioteca (não cria blocos novos: os clipes ficam disponíveis para qualquer estado).
    const imp = document.createElement('div');imp.className = 'row';
    imp.innerHTML = `<label class="import-anim">+ Importar animação para biblioteca<input type="file" accept=".glb,.gltf" data-import hidden></label><span class="muted" data-import-result></span>`;
    imp.querySelector('[data-import]').onchange = async e => {
      const f = e.target.files[0];if (!f) return;e.target.value = '';const out = imp.querySelector('[data-import-result]');
      try {
        const done = hooks.importAnimation ? await hooks.importAnimation(id, ch, f) : await (async () => {const anim = await loadAnimationFile(f), validation = validateAnimations(anim, ch, anim.bytes);(ch.importValidations ??= []).push(validation);return {report: ch.importClips(anim), validation};})();
        const rep = done.report;if (!rep) {out.textContent = done.message || '';return;}
        ch.warmGround();render();const ok = rep.filter(r => r.compatible).length;
        ui.lastImport = rep;el.dispatchEvent(new CustomEvent('imported', {bubbles: true, detail: rep}));
        $('char-slots').querySelectorAll('.char-slot')[id].querySelector('[data-import-result]').textContent = `${ok} de ${rep.length} clipe(s) compatível(is) adicionados à biblioteca${rep.length > ok ? ` · ${rep.length - ok} incompatível(is): ${rep.filter(r => !r.compatible).map(r => r.name).join(', ')}` : ''}.${done.message ? ' ' + done.message : ''}`;
      } catch (err) {out.textContent = 'Erro: ' + err.message;}
    };
    el.append(imp);
    const live = document.createElement('p');live.className = 'hint char-live';live.dataset.char = id;el.append(live);
    if (ch.missingAssociations?.length) {const w = document.createElement('p');w.className = 'warn';w.textContent = `Associações salvas sem clipe (reimporte): ${ch.missingAssociations.join(', ')}.`;el.append(w);}
    const missing = ch.missingStates();
    if (missing.length) {const m = document.createElement('p');m.className = 'warn';m.textContent = `Sem animação própria (usa “parado”): ${missing.map(k => STATE_LABELS[k]).join(', ')}.`;el.append(m);}
    el.append(validationBox(id, ch), heightBox(id, ch), statesBox(id, ch), libraryBox(id, ch), telemetryBox(id, ch));
    return el;
  }
  /** Validação do modelo e das animações importadas: veredito, ressalvas e detalhe por clipe (com prévia). */
  function validationBox(id, ch) {
    const body = document.createElement('div');body.className = 'validation';
    const reportHtml = (r, open) => {
      const cls = ['ok', 'warn', 'bad'][r.verdict];
      return `<div class="val-report" data-kind="${r.kind}"><p><span class="badge val-${cls}">${r.label}</span> <b>${escape(r.name)}</b>${r.kind === 'animations' ? ' (importação)' : ''}</p>
        <ul class="val-issues">${r.issues.filter(i => i.level !== 'ok' || r.kind === 'model').map(i => `<li class="${i.level === 'bad' ? 'bad' : i.level === 'warn' ? 'warn' : 'muted'}">${escape(i.text)}</li>`).join('')}</ul>
        <details${open ? ' open' : ''}><summary>${r.clips.length} clipe(s)</summary><table>${r.clips.map(c => {const idx = ch.clips.findIndex(x => x.name === c.name || x.name.startsWith(c.name + ' ['));return `<tr><td><span class="badge val-${['ok', 'warn', 'bad'][c.verdict]}">${['ok', '!', '✗'][c.verdict]}</span> ${escape(c.name)}<br><small class="muted">${c.duration.toFixed(2)} s · ${c.tracks} trilhas · ${(c.coverage * 100).toFixed(0)}%${c.issues.length ? ' · ' + c.issues.map(i => escape(i.text)).join(' · ') : ''}</small></td><td>${idx >= 0 ? `<button type="button" data-val-preview="${idx}" title="Prévia antes de associar">▶</button>` : ''}</td></tr>`;}).join('')}</table></details></div>`;
    };
    const reps = [...(ch.importValidations || [])].reverse();
    body.innerHTML = (ch.validation ? reportHtml(ch.validation, false) : '') + reps.map(r => reportHtml(r, false)).join('');
    for (const b of body.querySelectorAll('[data-val-preview]')) b.onclick = () => ch.startPreview(Number(b.dataset.valPreview));
    const v = Math.max(ch.validation?.verdict ?? 0, ...reps.slice(0, 1).map(r => r.verdict));
    return fold('Validação do modelo e das animações', `v${id}`, body, {open: v > 0, count: ['Compatível', 'com ressalvas', 'Incompatível'][v]});
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
    // Uma linha por estado: clipe principal (menu) e prévia. Variantes extras e velocidade só abrem em “▸”.
    const body = document.createElement('div');body.className = 'state-list';
    const clipOptions = sel => ['<option value="">— sem animação própria —</option>', ...ch.clips.map((c, i) => `<option value="${i}" ${ch.clipInfo[i].compatible ? '' : 'disabled'} ${i === sel ? 'selected' : ''}>${escape(c.name)} · ${c.duration.toFixed(2)} s</option>`)].join('');
    for (const action of ACTION_IDS) {
      const list = ch.variantsOf(action), row = document.createElement('div');row.className = 'state-row';row.dataset.action = action;
      const extra = list.length > 1 ? ` +${list.length - 1}` : '';
      row.innerHTML = `<div class="state-line"><b title="${action}">${escape(ACTION_LABELS[action] || action)}</b><select data-primary aria-label="Animação de ${action}">${clipOptions(list[0] ?? -1)}</select><button type="button" data-play title="Prévia" ${list.length ? '' : 'disabled'}>▶</button><button type="button" data-more title="Variantes e velocidade" aria-expanded="false">▸${extra}</button></div><div class="state-more" hidden></div>`;
      row.querySelector('[data-primary]').onchange = e => {ch.setPrimary(action, e.target.value === '' ? null : Number(e.target.value));render();onCharactersChanged();};
      row.querySelector('[data-play]').onclick = () => {if (list.length) ch.startPreview(list[0]);};
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
      body.append(row);
    }
    return fold('Animação de cada estado', `s${id}`, body, {open: true, count: `${ACTION_IDS.length} estados`});
  }
  function libraryBox(id, ch) {
    const body = document.createElement('div');body.className = 'clip-list';
    ch.clips.forEach((c, i) => {
      const info = ch.clipInfo[i], row = document.createElement('div');row.className = 'clip-row';row.dataset.clip = i;
      row.innerHTML = `<div class="clip-head"><span class="chip-name" title="${escape(c.name)}">${escape(c.name)}</span><button type="button" ${info.compatible ? '' : 'disabled'} title="Prévia">▶</button></div>
        <div class="clip-meta muted">${c.duration.toFixed(2)} s · ${escape(info.origin)} · <span class="${info.compatible ? 'ok' : 'bad'}">${info.compatible ? '✓ compatível' : '✗ incompatível'} (${(info.coverage * 100).toFixed(0)}%)</span></div>
        <label class="clip-offset">Compensação vertical <output>${(ch.clipOffsets[i] ?? 0).toFixed(2)} m</output><input type="range" min="-0.5" max="0.5" step="0.01" value="${ch.clipOffsets[i] ?? 0}" aria-label="Compensação vertical de ${escape(c.name)}"></label>`;
      const r = row.querySelector('input'), o = row.querySelector('output');r.oninput = () => {ch.clipOffsets[i] = Number(r.value);o.textContent = `${Number(r.value).toFixed(2)} m`;};r.onchange = () => ch.save();
      row.querySelector('button').onclick = () => ch.startPreview(i);body.append(row);
    });
    return fold('Biblioteca de clipes', `l${id}`, body, {count: `${ch.clips.length} clipes`});
  }
  function telemetryBox(id, ch) {
    const body = document.createElement('div');body.dataset.telemetry = id;
    body.innerHTML = `<div class="row"><button type="button" data-export>↓ Exportar telemetria (JSON)</button><button type="button" data-clear>Limpar</button><span class="muted" data-stats></span></div><div class="anim-log report" data-log></div>`;
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
      for (const row of el.parentElement.querySelectorAll('.state-row')) row.classList.toggle('playing', row.dataset.action === cur.id);
    }
    for (const box of document.querySelectorAll('[data-telemetry]')) {
      const ch = ui.characters[Number(box.dataset.telemetry)];if (!ch || box.hidden || box.closest('[hidden]')) continue;
      box.querySelector('[data-stats]').textContent = `${ch.transitions} trocas · ${ch.restartsAvoided} reinícios evitados · ${ch.log.filter(e => e.interrupted).length} interrupções`;
      const rows = ch.log.slice(-24).reverse();
      // Lista compacta: uma linha por troca (cabe no painel estreito).
      box.querySelector('[data-log]').innerHTML = rows.map(e => `<div class="log-row${e.interrupted ? ' warn' : ''}"><span class="log-t">${e.t.toFixed(2)}</span><span class="log-main"><b>${escape(STATE_LABELS[e.from] || e.from || '—')} → ${escape(STATE_LABELS[e.to] || e.to)}</b><small>${escape(e.clipTo)}${e.variants > 1 ? ` (${String.fromCharCode(64 + e.variant)}/${e.variants})` : ''}${e.from ? ` · tocou ${e.playedSeconds.toFixed(2)} s (${e.playedPct}%)` : ''} · ${escape(e.reason)}${e.interrupted ? ' · interrompida' : ''} · ${escape(e.source)}</small></span></div>`).join('') || '<p class="hint">Nenhuma troca ainda.</p>';
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
