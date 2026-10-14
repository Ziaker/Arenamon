// Interface da Rigging Telemetry Workbench. Componente sem dependência do layout do Studio: recebe um contêiner,
// um motor (contrato em WORKBENCH.md) e um visualizador. Pode ser montado no Studio ou na proposta A/B/C escolhida.
// Fluxo por tarefas: Inspecionar → Diagnosticar → Corrigir → Comparar → Aplicar → Validar.
const STEPS = [['inspect', 'Inspecionar'], ['diagnose', 'Diagnosticar'], ['fix', 'Corrigir'], ['compare', 'Comparar'], ['apply', 'Aplicar'], ['validate', 'Validar']];
const STATE_LABEL = {'sem-modelo': 'Nenhum modelo', 'sem-rig': 'Malha sem rig', 'rascunho': 'Rascunho de rig (sem skin)', 'ossos-sem-skin': 'Ossos sem skin', 'vinculado': 'Rig vinculado (skin)'};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const num = (v, d = 4) => v === null || v === undefined ? '—' : Number(v).toFixed(d).replace(/\.?0+$/, m => m.includes('.') ? '' : m) || '0';
const vec = (a, d = 4) => a ? '[' + a.map(v => num(v, d)).join(', ') + ']' : '—';
const OP_TEXT = {
  setPosition: o => `Mover ${o.joint} para ${vec(o.p)}`, translate: o => `Deslocar ${o.joint} por ${vec(o.delta)}`, setRotation: o => `Rotação de ${o.joint} → ${vec(o.q)}`,
  rename: o => `Renomear ${o.joint} para “${o.name}”`, reparent: o => `Pai de ${o.joint} → ${o.parent ?? 'raiz'}`, addJoint: o => `Criar “${o.name}” sob ${o.parent ?? 'raiz'} em ${vec(o.p)}`,
  removeJoint: o => `Excluir ${o.joint}`, mirror: o => `Espelhar ${o.joint} no lado oposto`,
};
export const AI_PROMPT = `Você vai corrigir o esqueleto (rig) de um personagem 3D.
Abaixo está a telemetria completa gerada pelo Arenamon Studio (schema arenamon-rig-telemetry).
Coordenadas estão no espaço da raiz do modelo (model-root). Refira-se aos ossos pelo "id".
Responda SOMENTE com um JSON no formato:
{"schema":"arenamon-rig-patch","version":1,"space":"model-root","description":"…","ops":[ … ]}
Operações aceitas:
- {"op":"setPosition","joint":"<id>","p":[x,y,z]}
- {"op":"translate","joint":"<id>","delta":[dx,dy,dz]}
- {"op":"mirror","joint":"<id do lado Left>"}  (copia para o lado Right, espelhado)
- {"op":"rename","joint":"<id>","name":"NovoNome"}
- {"op":"reparent","joint":"<id>","parent":"<id do novo pai>"}
- {"op":"addJoint","name":"Nome","parent":"<id>","p":[x,y,z]}
- {"op":"removeJoint","joint":"<id>"}
Cada operação pode ter um campo "note" explicando o motivo. Não invente ossos que não existem.`;
export const EXAMPLE_PATCH = {schema: 'arenamon-rig-patch', version: 1, space: 'model-root', description: 'Exemplo: espelhar o cotovelo esquerdo no direito',
  ops: [{op: 'mirror', joint: 'LeftElbow', note: 'Corrige a assimetria do cotovelo direito'}]};

export function mountWorkbench(container, {engine, viewer, layout = null}) {
  const S = {step: 'inspect', telemetry: null, selected: null, mesh: null, filter: '', advanced: false, collapsed: new Set(), patchText: '', validation: null, dry: null, applied: null, baseline: null, checked: new Set()};
  container.innerHTML = `<div class="wb" id="wb-root">
    <header class="wb-head">
      <div class="wb-head-row"><span class="wb-chip" id="wb-state" role="status">—</span>
        <span class="wb-tools"><label class="wb-check"><input type="checkbox" id="wb-advanced"> Avançado</label>
        <button type="button" class="wb-btn" id="wb-wide" aria-pressed="false" title="Ampliar o painel">⇔ Ampliar</button>
        <button type="button" class="wb-btn" id="wb-refresh" title="Gerar a telemetria novamente">↻ Telemetria</button></span></div>
      <nav class="wb-steps" role="tablist" aria-label="Fluxo de trabalho">${STEPS.map(([id, label], i) => `<button type="button" role="tab" data-step="${id}" aria-selected="false"><b>${i + 1}</b>${label}</button>`).join('')}</nav>
    </header>
    <div class="wb-body">
      <aside class="wb-tree-pane" aria-label="Hierarquia de ossos">
        <input type="search" id="wb-search" placeholder="Procurar osso ou ID" aria-label="Procurar osso">
        <div class="wb-tree" id="wb-tree" role="tree" tabindex="0" aria-label="Árvore de ossos"></div>
        <p class="wb-hint">Clique num osso aqui ou no visualizador. ↑↓ navegam, ←→ recolhem/expandem, Espaço marca para a seleção da IA.</p>
      </aside>
      <div class="wb-main">
        <section data-panel-step="inspect"></section><section data-panel-step="diagnose" hidden></section><section data-panel-step="fix" hidden></section>
        <section data-panel-step="compare" hidden></section><section data-panel-step="apply" hidden></section><section data-panel-step="validate" hidden></section>
      </div>
    </div>
    <div class="wb-toast" id="wb-toast" role="status" aria-live="polite" hidden></div>
  </div>`;
  const $ = id => container.querySelector('#' + id), panel = step => container.querySelector(`[data-panel-step="${step}"]`);
  const toast = (msg, kind = 'ok') => {const t = $('wb-toast');t.textContent = msg;t.dataset.kind = kind;t.hidden = false;clearTimeout(toast.t);toast.t = setTimeout(() => {t.hidden = true;}, 4200);};
  const joint = id => S.telemetry?.joints.find(j => j.id === id) || null;

  // ---------- Telemetria e seleção ----------
  function refresh({keepBaseline = true} = {}) {
    if (!engine.available()) {S.telemetry = null;render();return null;}
    try {S.telemetry = engine.telemetry();} catch (e) {S.telemetry = null;toast('Falha ao gerar telemetria: ' + e.message, 'warn');}
    if (!keepBaseline || !S.baseline) S.baseline = S.telemetry;
    if (S.selected && !joint(S.selected)) S.selected = null;
    if (!S.selected && S.telemetry?.joints.length) S.selected = engine.selectedId?.() && joint(engine.selectedId()) ? engine.selectedId() : S.telemetry.joints[0].id;
    viewer?.setTelemetry(S.telemetry);viewer?.setSelected(S.selected);render();return S.telemetry;
  }
  function select(id, {focusTree = false, fromViewer = false} = {}) {
    if (!joint(id)) return;S.selected = id;
    try {engine.select?.(id);} catch {/* o motor pode estar sem rig */}
    viewer?.setSelected(id);renderTree();renderStep();
    if (focusTree || fromViewer) container.querySelector(`[data-joint="${CSS.escape(id)}"]`)?.scrollIntoView({block: 'nearest'});
    if (focusTree) container.querySelector(`[data-joint="${CSS.escape(id)}"]`)?.focus();
  }

  // ---------- Árvore ----------
  function visibleOrder() {
    const t = S.telemetry;if (!t) return [];const out = [], f = S.filter.toLowerCase();
    const byParent = new Map();for (const j of t.joints) {const k = j.parentId || '';(byParent.get(k) || byParent.set(k, []).get(k)).push(j);}
    const walk = (j, depth) => {
      const kids = byParent.get(j.id) || [], match = !f || j.name.toLowerCase().includes(f) || j.id.toLowerCase().includes(f);
      if (match || f) {if (match) out.push({j, depth, kids: kids.length});}
      if (!S.collapsed.has(j.id) || f) for (const k of kids) walk(k, depth + 1);
    };
    for (const r of t.joints.filter(j => !j.parentId)) walk(r, 0);
    return out;
  }
  function renderTree() {
    const tree = $('wb-tree'), rows = visibleOrder();
    tree.innerHTML = rows.length ? rows.map(({j, depth, kids}) => `<div class="wb-node${j.id === S.selected ? ' selected' : ''}${j.warnings.length ? ' warn' : ''}" role="treeitem" tabindex="-1" data-joint="${esc(j.id)}" aria-level="${depth + 1}" aria-selected="${j.id === S.selected}"${kids ? ` aria-expanded="${!S.collapsed.has(j.id)}"` : ''} style="--depth:${depth}">
      <span class="wb-twisty" data-toggle="${esc(j.id)}">${kids ? (S.collapsed.has(j.id) ? '▸' : '▾') : '·'}</span>
      <input type="checkbox" class="wb-pick" data-pick="${esc(j.id)}" ${S.checked.has(j.id) ? 'checked' : ''} aria-label="Incluir ${esc(j.name)} na seleção para a IA" tabindex="-1">
      <span class="wb-name">${esc(j.name)}</span>${j.warnings.length ? `<span class="wb-badge warn" title="${esc(j.warnings.join('\n'))}">${j.warnings.length}</span>` : ''}</div>`).join('')
      : `<p class="wb-hint">${S.telemetry ? 'Nenhum osso corresponde à busca.' : 'Carregue um modelo em Projeto.'}</p>`;
  }
  $('wb-tree').addEventListener('click', e => {
    const tog = e.target.closest('[data-toggle]'), pick = e.target.closest('[data-pick]'), row = e.target.closest('[data-joint]');
    if (pick) {pick.checked ? S.checked.add(pick.dataset.pick) : S.checked.delete(pick.dataset.pick);renderStep();return;}
    if (tog && S.telemetry.joints.some(j => j.parentId === tog.dataset.toggle)) {S.collapsed.has(tog.dataset.toggle) ? S.collapsed.delete(tog.dataset.toggle) : S.collapsed.add(tog.dataset.toggle);renderTree();return;}
    if (row) select(row.dataset.joint, {focusTree: true});
  });
  $('wb-tree').addEventListener('keydown', e => {
    const rows = visibleOrder(), i = rows.findIndex(r => r.j.id === S.selected);if (!rows.length) return;
    const go = k => {e.preventDefault();select(rows[Math.max(0, Math.min(rows.length - 1, k))].j.id, {focusTree: true});};
    if (e.key === 'ArrowDown') go(i + 1);else if (e.key === 'ArrowUp') go(i - 1);else if (e.key === 'Home') go(0);else if (e.key === 'End') go(rows.length - 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {e.preventDefault();const j = rows[i]?.j;if (!j) return;if (e.key === 'ArrowLeft') {if (!S.collapsed.has(j.id) && rows[i].kids) S.collapsed.add(j.id);else if (j.parentId) {select(j.parentId, {focusTree: true});return;}} else S.collapsed.delete(j.id);renderTree();container.querySelector(`[data-joint="${CSS.escape(j.id)}"]`)?.focus();}
    else if (e.key === ' ') {e.preventDefault();S.checked.has(S.selected) ? S.checked.delete(S.selected) : S.checked.add(S.selected);renderTree();renderStep();container.querySelector(`[data-joint="${CSS.escape(S.selected)}"]`)?.focus();}
  });
  $('wb-search').addEventListener('input', e => {S.filter = e.target.value.trim();renderTree();});

  // ---------- Etapas ----------
  function goto(step) {S.step = step;render();}
  container.querySelector('.wb-steps').addEventListener('click', e => {const b = e.target.closest('[data-step]');if (b) goto(b.dataset.step);});
  $('wb-advanced').onchange = e => {S.advanced = e.target.checked;renderStep();};
  // Ampliar: o painel ganha largura e a biblioteca de animações (direita) fecha para o visualizador 3D continuar útil.
  let libraryBefore = null;
  $('wb-wide').onclick = () => {
    const on = !document.body.classList.contains('wb-wide');document.body.classList.toggle('wb-wide', on);$('wb-wide').setAttribute('aria-pressed', String(on));
    if (layout?.setLibrary) {if (on) {libraryBefore = layout.rightOpen;layout.setLibrary(false);} else if (libraryBefore) layout.setLibrary(true);}
    layout?.render?.();
  };
  $('wb-refresh').onclick = () => {refresh();toast('Telemetria gerada novamente pelo motor do Codex.');};

  function render() {
    const t = S.telemetry;$('wb-state').textContent = t ? `${STATE_LABEL[t.model.state] || t.model.state} · ${t.summary.bones} ossos · ${t.summary.meshes} malhas` : STATE_LABEL['sem-modelo'];
    $('wb-state').dataset.state = t?.model.state || 'sem-modelo';
    for (const b of container.querySelectorAll('[data-step]')) b.setAttribute('aria-selected', String(b.dataset.step === S.step));
    for (const s of container.querySelectorAll('[data-panel-step]')) s.hidden = s.dataset.panelStep !== S.step;
    renderTree();renderStep();
  }
  function renderStep() {({inspect, diagnose, fix, compare, apply, validate})[S.step]?.();}
  const card = (title, body, cls = '') => `<div class="wb-card ${cls}"><h4>${title}</h4>${body}</div>`;
  const kv = rows => `<dl class="wb-kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  const pre = obj => `<pre class="wb-json">${esc(JSON.stringify(obj, null, 2))}</pre>`;

  // 1. Inspecionar: visão geral, articulação selecionada, malhas e camadas visuais.
  function inspect() {
    const t = S.telemetry, p = panel('inspect');if (!t) {p.innerHTML = '<p class="wb-hint">Carregue um modelo em Projeto para gerar a telemetria.</p>';return;}
    const s = t.summary, j = joint(S.selected);
    const overview = `<div class="wb-metrics">${[['Ossos', s.bones], ['Malhas', `${s.skinnedMeshes}/${s.meshes} com skin`], ['Vértices', s.vertices], ['Articulações com aviso', s.jointsWithWarnings, s.jointsWithWarnings ? 'warn' : ''],
      ['Pesos inválidos', s.invalidWeights, s.invalidWeights ? 'warn' : ''], ['Vértices sem influência', s.verticesWithoutInfluence, s.verticesWithoutInfluence ? 'warn' : ''], ['Trilhas órfãs', s.orphanTracks, s.orphanTracks ? 'warn' : ''], ['Skinning', STATE_LABEL[t.model.state]]]
      .map(([k, v, c]) => `<div class="wb-metric ${c || ''}" data-metric="${esc(k)}"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
    const detail = j ? kv([['Nome', `<b>${esc(j.name)}</b>`], ['ID persistente', `<code>${esc(j.id)}</code>`], ['Osso pai', j.parent ? `<button type="button" class="wb-link" data-go="${esc(j.parentId)}">${esc(j.parent)}</button>` : 'raiz do modelo'],
      ['Filhos', j.children.length ? j.children.map(c => `<button type="button" class="wb-link" data-go="${esc(c)}">${esc(joint(c)?.name)}</button>`).join(' ') : '—'],
      ['Posição local', vec(j.local)], ['Relativa à raiz', vec(j.p)], ['Global (mundo)', vec(j.world)], ['Quaternion', vec(j.q, 5)], ['Comprimento do segmento', num(j.segmentLength)],
      ['Influência', j.influence ? `${j.influence.vertices ?? 0} vértices${j.influence.meshes.length ? ' · ' + j.influence.meshes.map(m => `${esc(m.mesh)}: ${m.vertices} (máx. ${num(m.maxWeight, 3)})`).join(', ') : ''}` : 'sem skin'],
      ['Simetria', j.symmetry ? `${esc(j.symmetry.pairName)}${j.symmetry.mirrorDistance !== null ? ` · diferença ao espelho ${num(j.symmetry.mirrorDistance)}` : ''}` : '—'],
      ['Avisos', j.warnings.length ? `<ul class="wb-warn">${j.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : 'nenhum'],
      ...(S.advanced ? [['UUID', `<code>${esc(j.uuid ?? '—')}</code>`], ['Matriz de bind inversa', j.bindInverse ? `<code class="wb-matrix">${j.bindInverse.map(v => num(v, 4)).join(' ')}</code>` : '—']] : [])]) : '<p class="wb-hint">Selecione um osso.</p>';
    const meshes = t.meshes.map((m, i) => `<button type="button" class="wb-mesh${S.mesh === i ? ' selected' : ''}" data-mesh="${i}"><b>${esc(m.name)}</b><span>${m.vertices} vért. · ${m.skinned ? `${m.bones} ossos` : 'sem skin'}${m.zeroWeights ? ` · <em class="warn">${m.zeroWeights} sem influência</em>` : ''}</span></button>`).join('');
    const m = t.meshes[S.mesh];
    const meshDetail = m ? kv([['Vértices', m.vertices], ['Skin', m.skinned ? 'sim' : 'não'], ['Ossos que a influenciam', m.influencingBones?.length ? m.influencingBones.slice().sort((a, b) => b.vertices - a.vertices).map(b => {const jj = t.joints.find(x => x.uuid === b.uuid);return `${esc(jj?.name || b.uuid)} (${b.vertices})`;}).join(', ') : '—'],
      ['Influências por vértice (0–4)', m.influencesPerVertex ? m.influencesPerVertex.join(' / ') : '—'], ['Peso dominante por vértice (0–1, 10 faixas)', m.dominantWeightHistogram ? histogram(m.dominantWeightHistogram) : '—'],
      ['Vértices sem influência', m.zeroWeights], ['Pesos inválidos', m.invalidWeights], ['Ossos sem uso nesta malha', m.unused]]) : '<p class="wb-hint">Escolha uma malha para ver a distribuição de pesos.</p>';
    const o = viewer?.options || {};
    const layers = `<div class="wb-layers">${[['skeleton', 'Esqueleto'], ['axes', 'Eixos do osso'], ['symmetry', 'Simetria'], ['heatmap', 'Heatmap de pesos'], ['problems', 'Regiões problemáticas']]
      .map(([k, l]) => `<label class="wb-check"><input type="checkbox" data-layer="${k}" ${o[k] ? 'checked' : ''}${k === 'heatmap' && t.model.state !== 'vinculado' ? ' disabled' : ''}> ${l}</label>`).join('')}</div>`;
    p.innerHTML = overview + card('Articulação', detail) + card('Malhas independentes', `<div class="wb-meshes">${meshes}</div>${meshDetail}`) + card('Visualização', layers)
      + (S.advanced ? card('JSON da articulação', pre(j)) : '');
  }
  const histogram = h => {const max = Math.max(1, ...h);return `<span class="wb-hist" role="img" aria-label="${h.join(', ')}">${h.map((v, i) => `<i style="--h:${(v / max * 100).toFixed(1)}%" title="${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}: ${v}"></i>`).join('')}</span>`;};

  // 2. Diagnosticar: avisos, simetria, animações e saída para a IA.
  function diagnose() {
    const t = S.telemetry, p = panel('diagnose');if (!t) {p.innerHTML = '<p class="wb-hint">Sem telemetria.</p>';return;}
    const asym = t.joints.filter(j => j.symmetry?.mirrorDistance > 0).sort((a, b) => b.symmetry.mirrorDistance - a.symmetry.mirrorDistance);
    p.innerHTML = card('Para a IA', `<p>Copie a telemetria, cole numa conversa com uma IA e peça um <b>Rig Patch JSON</b>. Depois cole a resposta em <b>Corrigir</b>.</p>
      <div class="wb-row"><button type="button" class="btn btn-primary" id="wb-copy-ai">Copiar para IA (instruções + telemetria)</button><button type="button" class="btn btn-soft" id="wb-copy-json">Copiar JSON completo</button>
      <button type="button" class="btn btn-soft" id="wb-copy-sel" ${S.checked.size || S.selected ? '' : 'disabled'}>Copiar seleção (${S.checked.size || (S.selected ? 1 : 0)} ${S.checked.size === 1 || (!S.checked.size && S.selected) ? 'osso' : 'ossos'})</button>
      <button type="button" class="btn btn-soft" id="wb-export">↓ Exportar JSON</button></div>
      <p class="wb-hint">A seleção usa os ossos marcados na árvore (Espaço ou caixa de seleção); sem marcas, o osso selecionado.</p>`)
      + card(`Avisos do motor (${t.warnings.length})`, t.warnings.length ? `<ul class="wb-warn">${t.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : '<p>Nenhum aviso do auditRig.</p>')
      + card('Assimetria (diferença ao espelho, medida com applyMirror do Codex)', asym.length ? `<table class="wb-table"><tr><th>Par</th><th>Diferença</th></tr>${asym.map(j => `<tr><td><button type="button" class="wb-link" data-go="${esc(j.id)}">${esc(j.name)}</button> ↔ ${esc(j.symmetry.pairName)}</td><td>${num(j.symmetry.mirrorDistance)}</td></tr>`).join('')}</table>` : '<p>Todos os pares Left/Right coincidem com o espelho.</p>')
      + card('Compatibilidade com animações', t.animations.length ? `<table class="wb-table"><tr><th>Clipe</th><th>Trilhas ligadas</th><th>Órfãs</th></tr>${t.animations.map(a => `<tr><td>${esc(a.name)}</td><td>${a.boundTracks}/${a.tracks}</td><td class="${a.orphanTracks.length ? 'warn' : ''}">${a.orphanTracks.map(esc).join('<br>') || '—'}</td></tr>`).join('')}</table>` : '<p>Nenhuma animação carregada.</p>')
      + (S.advanced ? card('Telemetria completa', pre(t)) : '');
    $('wb-copy-ai').onclick = () => copy(AI_PROMPT + '\n\n' + JSON.stringify(t, null, 2), 'Instruções e telemetria copiadas.');
    $('wb-copy-json').onclick = () => copy(JSON.stringify(t, null, 2), 'Telemetria completa copiada.');
    $('wb-copy-sel').onclick = () => {const ids = S.checked.size ? [...S.checked] : [S.selected];copy(JSON.stringify(engine.telemetry({select: ids}), null, 2), `Telemetria de ${ids.length} osso(s) copiada.`);};
    $('wb-export').onclick = () => download(JSON.stringify(engine.telemetry(), null, 2), `${(t.model.name || 'rig').replace(/[^\w.-]+/g, '_')}.telemetria.json`);
  }
  async function copy(text, msg) {
    S.lastCopy = text;
    try {await navigator.clipboard.writeText(text);toast(msg);}
    catch {const a = document.createElement('textarea');a.value = text;container.append(a);a.select();const ok = document.execCommand?.('copy');a.remove();toast(ok ? msg : 'Não foi possível copiar: o navegador bloqueou a área de transferência.', ok ? 'ok' : 'warn');}
  }
  function download(text, name) {const url = URL.createObjectURL(new Blob([text], {type: 'application/json'})), a = document.createElement('a');a.href = url;a.download = name;a.click();setTimeout(() => URL.revokeObjectURL(url), 2000);toast('Arquivo ' + name + ' gerado.');}

  // 3. Corrigir: auto-rig assistido, editor de patch e importação.
  function fix() {
    const t = S.telemetry, p = panel('fix'), auto = engine.autoRig, st = t?.model.state;
    const autoCard = auto ? card('Auto-rig assistido', `<p>Estado: <b>${esc(STATE_LABEL[st] || '—')}</b>.</p>
      <div class="wb-row"><label class="rg-field">Perfil anatômico<select id="wb-profile">${auto.profiles.map(pr => `<option value="${pr.id}" ${pr.available ? '' : 'disabled'}>${esc(pr.label)}${pr.available ? '' : ' — aguarda o Codex'}</option>`).join('')}</select></label></div>
      <div class="wb-row"><button type="button" class="btn btn-soft" id="wb-auto-template" ${st === 'vinculado' ? 'disabled title="O modelo já tem skin"' : ''}>Gerar proposta de esqueleto</button>
      <button type="button" class="btn btn-soft" id="wb-auto-import">Importar coordenadas JSON</button>
      <button type="button" class="btn btn-primary" id="wb-auto-bind" ${st === 'rascunho' ? '' : 'disabled'}>Aplicar skinning (bind)</button>
      <button type="button" class="btn btn-soft" id="wb-auto-test" ${st === 'vinculado' ? '' : 'disabled'}>Testar deformações</button></div>
      <p class="wb-hint"><b>Incerteza do posicionamento:</b> o motor atual (template humanoide do Codex) <b>não informa a incerteza de cada ponto</b>; trate todos os pontos como aproximados e confira-os no visualizador.</p>
      <div class="wb-row wb-experimental"><button type="button" class="btn btn-soft" disabled>Regenerar região</button><button type="button" class="btn btn-soft" disabled>Fixar ossos</button>
      <span class="wb-badge">Experimental · aguarda API do auto-rig aprimorado do Codex</span></div>
      <p class="wb-hint">Corrija pontos selecionando o osso na árvore e usando um patch (abaixo) ou os controles manuais da aba Rigging. Desfazer funciona em todas as etapas.</p>`) : '';
    const v = S.validation;
    const validation = !v ? '' : v.ok ? `<div class="wb-ok" id="wb-valid">✓ Patch válido para o motor do Codex (${v.patch.ops.length} operações).${v.preexisting ? `<br><small>Observação: o rig atual já não passa na validação de rascunho do Codex (${esc(v.preexisting)}); o ensaio real em Comparar decide.</small>` : ''}</div>
      <ol class="wb-ops">${v.patch.ops.map((o, i) => `<li>${esc(OP_TEXT[o.op](o))}${o.note ? ` <small>— ${esc(o.note)}</small>` : ''}</li>`).join('')}</ol>`
      : `<div class="wb-error" id="wb-invalid" role="alert"><b>${v.stage === 'pendente' ? 'Não aplicável hoje' : 'Patch inválido'} (${esc(v.stage)}):</b><ul>${v.errors.map(e => `<li><code>${esc(e.path)}</code> ${esc(e.message)}</li>`).join('')}</ul></div>`;
    p.innerHTML = autoCard + card('Rig Patch JSON', `<label class="wb-label" for="wb-patch">Cole a resposta da IA ou importe um arquivo. Ctrl+Enter valida.</label>
      <textarea id="wb-patch" class="wb-editor" spellcheck="false" rows="12" aria-describedby="wb-patch-help">${esc(S.patchText)}</textarea>
      <p class="wb-hint" id="wb-patch-help">Formato: <code>{"schema":"arenamon-rig-patch","version":1,"space":"model-root","ops":[…]}</code>. Rotação de repouso (<code>setRotation</code>) aparece como pendente: o motor do Codex ainda não a expõe.</p>
      <div class="wb-row"><button type="button" class="btn btn-soft" id="wb-validate">Verificar comandos</button><button type="button" class="btn btn-primary" id="wb-to-compare" ${v?.ok ? '' : 'disabled'}>Comparar antes/depois →</button>
      <label class="btn btn-soft wb-file">Importar arquivo<input type="file" id="wb-patch-file" accept=".json,application/json" hidden></label><button type="button" class="btn btn-soft" id="wb-example">Exemplo</button></div>${validation}`);
    const area = $('wb-patch');area.oninput = () => {S.patchText = area.value;if (S.validation) {S.validation = null;fix();area.focus();area.setSelectionRange(area.value.length, area.value.length);}};
    area.onkeydown = e => {if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {e.preventDefault();runValidate();}};
    $('wb-validate').onclick = runValidate;$('wb-to-compare').onclick = () => {goto('compare');runDry();};
    $('wb-example').onclick = () => {S.patchText = JSON.stringify(EXAMPLE_PATCH, null, 2);S.validation = null;fix();};
    $('wb-patch-file').onchange = async e => {const f = e.target.files[0];if (!f) return;await loadPatchText(await f.text());e.target.value = '';};
    if (auto) {
      $('wb-auto-template').onclick = () => {auto.createTemplate();refresh();toast('Proposta de esqueleto gerada pelo motor do Codex (humanoide, 20 pontos).');};
      $('wb-auto-bind').onclick = () => {auto.bind();refresh();};
      $('wb-auto-test').onclick = () => {layout?.open('rigging');toast('Teste de deformação: use “Rotação de teste” na aba Rigging (não altera o rig).');};
      $('wb-auto-import').onclick = () => {const i = document.createElement('input');i.type = 'file';i.accept = '.json,application/json';i.onchange = async () => {if (i.files[0]) await loadPatchText(await i.files[0].text());};i.click();};
    }
  }
  /** Aceita Rig Patch ou JSON de coordenadas do Codex (convertido em setPosition). */
  async function loadPatchText(text) {
    let data = null;try {data = JSON.parse(text);} catch {/* a validação mostra a linha do erro */}
    if (data?.schema === 'arenamon-rig') {try {text = JSON.stringify(engine.patchFromRigJSON(data), null, 2);toast('Coordenadas convertidas em patch de setPosition.');} catch (e) {toast(e.message, 'warn');}}
    S.patchText = text;S.validation = null;goto('fix');runValidate();
  }
  function runValidate() {S.patchText = $('wb-patch')?.value ?? S.patchText;try {S.validation = engine.validate(S.patchText);} catch (e) {S.validation = {ok: false, stage: 'motor', errors: [{path: '(motor)', message: e.message}]};}fix();}

  // 4. Comparar: ensaio REAL com o motor do Codex (aplica, mede, desfaz).
  function runDry() {
    try {S.dry = engine.dryRun(S.patchText);} catch (e) {S.dry = {ok: false, stage: 'ensaio', errors: [{path: '(ensaio)', message: e.message}]};}
    if (S.dry.ok) {viewer?.setTelemetry(S.telemetry);viewer?.setComparison(S.dry.after, S.dry.changes.map(c => c.id));}
    renderStep();
  }
  function compare() {
    const p = panel('compare'), d = S.dry;
    if (!d) {p.innerHTML = '<p class="wb-hint">Verifique um patch em Corrigir e clique em “Comparar antes/depois”.</p>';return;}
    if (!d.ok) {p.innerHTML = `<div class="wb-error" role="alert"><b>Não foi possível comparar (${esc(d.stage)}):</b><ul>${d.errors.map(e => `<li><code>${esc(e.path)}</code> ${esc(e.message)}</li>`).join('')}</ul></div><button type="button" class="btn btn-soft" data-goto-step="fix">← Voltar a Corrigir</button>`;bindGoto(p);return;}
    const rows = d.changes.map(c => `<tr data-change="${esc(c.id)}"><td><button type="button" class="wb-link" data-go="${esc(c.id)}">${esc(c.name)}</button>${c.kind === 'added' ? ' <span class="wb-badge ok">novo</span>' : c.kind === 'removed' ? ' <span class="wb-badge warn">removido</span>' : ''}</td>
      <td>${c.moved !== undefined ? `${num(c.moved)}<br><small>${vec(c.pBefore, 3)} → ${vec(c.pAfter, 3)}</small>` : '—'}</td><td>${c.rotatedDeg !== undefined ? num(c.rotatedDeg, 2) + '°' : '—'}</td>
      <td>${c.nameBefore ? `${esc(c.nameBefore)} → ${esc(c.name)}` : ''}${c.parentAfter !== undefined && c.kind === 'changed' ? `pai: ${esc(c.parentBefore ?? 'raiz')} → ${esc(c.parentAfter ?? 'raiz')}` : ''}</td></tr>`).join('');
    const o = viewer?.options || {};
    p.innerHTML = `<p class="wb-ok">Ensaio real com o motor do Codex: aplicado, medido e desfeito; o rig atual não foi alterado.</p>`
      + card(`Ossos alterados (${d.changes.length})`, d.changes.length ? `<table class="wb-table" id="wb-changes"><tr><th>Osso</th><th>Δ posição</th><th>Δ rotação</th><th>Nome / hierarquia</th></tr>${rows}</table>` : '<p>O patch não altera nenhum osso.</p>')
      + card('Avisos', `<p><b>Resolvidos (${d.warnings.resolved.length}):</b></p><ul class="wb-ok-list">${d.warnings.resolved.map(w => `<li>${esc(w)}</li>`).join('') || '<li>—</li>'}</ul><p><b>Novos (${d.warnings.added.length}):</b></p><ul class="wb-warn">${d.warnings.added.map(w => `<li>${esc(w)}</li>`).join('') || '<li>—</li>'}</ul>`)
      + card('Pesos', d.influence.length ? `<table class="wb-table"><tr><th>Osso</th><th>Vértices influenciados</th></tr>${d.influence.map(c => `<tr><td>${esc(c.name)}</td><td>${c.before ?? '—'} → ${c.after ?? '—'}</td></tr>`).join('')}</table>` : `<p>${S.telemetry?.model.state === 'vinculado' ? 'O patch não muda os pesos do skin (o motor recalcula só o bind).' : 'Sem skin ainda.'}</p>${S.telemetry?.model.state === 'rascunho' ? '<button type="button" class="btn btn-soft" id="wb-bind-preview">Prever pesos após o bind (bind real em cópias)</button><div id="wb-bind-result"></div>' : ''}`)
      + card('Visualizador', `<div class="wb-layers"><label class="wb-check"><input type="checkbox" data-layer="original" ${o.original ? 'checked' : ''}> Esqueleto original</label><label class="wb-check"><input type="checkbox" data-layer="ghost" ${o.ghost ? 'checked' : ''}> Esqueleto proposto (laranja)</label></div>`)
      + `<div class="wb-row wb-confirm"><button type="button" class="btn btn-primary" id="wb-apply">Aplicar correção</button><button type="button" class="btn btn-soft" id="wb-cancel">Cancelar</button></div>`;
    $('wb-apply').onclick = applyPatch;$('wb-cancel').onclick = () => {S.dry = null;viewer?.setComparison(null);goto('fix');toast('Comparação cancelada; nada foi alterado.');};
    const bp = $('wb-bind-preview');if (bp) bp.onclick = () => {const r = engine.bindPreview(S.patchText);$('wb-bind-result').innerHTML = r.ok ? `<table class="wb-table"><tr><th>Osso</th><th>Vértices (bind atual → bind corrigido)</th></tr>${r.influence.map(c => `<tr><td>${esc(c.name)}</td><td>${c.before} → ${c.after}</td></tr>`).join('') || '<tr><td colspan=2>Sem diferença</td></tr>'}</table><p>Avisos novos: ${r.warnings.added.length} · resolvidos: ${r.warnings.resolved.length}</p>` : `<p class="wb-error">${esc(r.errors[0].message)}</p>`;};
  }
  function applyPatch() {
    const before = S.telemetry;let r;
    try {r = engine.apply(S.patchText);} catch (e) {r = {ok: false, errors: [{path: '(motor)', message: e.message}]};}
    if (!r.ok) {toast('Falha ao aplicar: ' + r.errors[0].message, 'warn');return;}
    S.applied = {label: r.label, before};S.baseline = before;S.dry = null;viewer?.setComparison(null);refresh();goto('apply');toast('Correção aplicada. Ctrl+Z ou “Desfazer” revertem.');
  }

  // 5. Aplicar: resultado, desfazer e refazer.
  function apply() {
    const p = panel('apply'), h = engine.historyState?.() || {};
    p.innerHTML = (S.applied ? `<p class="wb-ok" id="wb-applied">✓ ${esc(S.applied.label)}</p>` : '<p class="wb-hint">Nenhuma correção aplicada nesta sessão.</p>')
      + `<div class="wb-row"><button type="button" class="btn btn-soft" id="wb-undo" ${h.canUndo ? '' : 'disabled'}>↶ Desfazer${h.undoLabel ? ': ' + esc(h.undoLabel) : ''}</button><button type="button" class="btn btn-soft" id="wb-redo" ${h.canRedo ? '' : 'disabled'}>↷ Refazer${h.redoLabel ? ': ' + esc(h.redoLabel) : ''}</button></div>
      <button type="button" class="btn btn-primary" data-goto-step="validate">Validar com nova telemetria →</button>`;
    $('wb-undo').onclick = () => {engine.undo();refresh();};$('wb-redo').onclick = () => {engine.redo();refresh();};bindGoto(p);
  }
  // 6. Validar: nova telemetria comparada à de antes da correção.
  function validate() {
    const p = panel('validate'), a = S.applied?.before || S.baseline, b = S.telemetry;
    if (!a || !b) {p.innerHTML = '<p class="wb-hint">Gere a telemetria e aplique uma correção para validar.</p>';return;}
    const keys = ['bones', 'meshes', 'vertices', 'jointsWithWarnings', 'invalidWeights', 'verticesWithoutInfluence', 'orphanTracks', 'warnings'];
    const labels = {bones: 'Ossos', meshes: 'Malhas', vertices: 'Vértices', jointsWithWarnings: 'Articulações com aviso', invalidWeights: 'Pesos inválidos', verticesWithoutInfluence: 'Vértices sem influência', orphanTracks: 'Trilhas órfãs', warnings: 'Avisos'};
    const wa = new Set(a.warnings), wb = new Set(b.warnings);
    const asym = j => j.symmetry?.mirrorDistance ?? null, asymRows = b.joints.filter(j => asym(j) !== null).map(j => {const old = a.joints.find(x => x.id === j.id);return old && asym(old) !== asym(j) ? `<tr><td>${esc(j.name)}</td><td>${num(asym(old))} → ${num(asym(j))}</td></tr>` : '';}).join('');
    p.innerHTML = `<div class="wb-row"><button type="button" class="btn btn-soft" id="wb-revalidate">↻ Gerar nova telemetria</button></div>`
      + card('Métricas (antes → agora)', `<table class="wb-table" id="wb-metric-diff">${keys.map(k => `<tr class="${a.summary[k] !== b.summary[k] ? 'changed' : ''}"><td>${labels[k]}</td><td>${a.summary[k]} → <b>${b.summary[k]}</b></td></tr>`).join('')}</table>`)
      + card('Assimetria alterada', asymRows ? `<table class="wb-table">${asymRows}</table>` : '<p>Sem mudança.</p>')
      + card('Avisos', `<p>Resolvidos: ${[...wa].filter(w => !wb.has(w)).map(esc).join('; ') || '—'}</p><p>Novos: ${[...wb].filter(w => !wa.has(w)).map(esc).join('; ') || '—'}</p>`);
    $('wb-revalidate').onclick = () => {refresh();toast('Nova telemetria gerada.');};
  }
  const bindGoto = root => {for (const b of root.querySelectorAll('[data-goto-step]')) b.onclick = () => goto(b.dataset.gotoStep);};
  // Delegação comum: links para ossos, malhas e camadas.
  container.querySelector('.wb-main').addEventListener('click', e => {
    const go = e.target.closest('[data-go]'), mesh = e.target.closest('[data-mesh]'), gs = e.target.closest('[data-goto-step]');
    if (go) select(go.dataset.go, {focusTree: false});else if (mesh) {S.mesh = Number(mesh.dataset.mesh);renderStep();} else if (gs) goto(gs.dataset.gotoStep);
  });
  container.querySelector('.wb-main').addEventListener('change', e => {const l = e.target.closest('[data-layer]');if (l) viewer?.setOption(l.dataset.layer, l.checked);});

  render();
  return {
    refresh, select, goto, render, loadPatchText, runValidate, runDry,
    get state() {return {step: S.step, selected: S.selected, checked: [...S.checked], validation: S.validation, dry: S.dry, applied: S.applied, telemetry: S.telemetry, lastCopy: S.lastCopy};},
    pickFromViewer: id => select(id, {fromViewer: true}),
  };
}
