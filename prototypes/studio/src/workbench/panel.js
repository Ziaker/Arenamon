// Interface da Rigging Telemetry Workbench. Componente sem dependência do layout do Studio: recebe um contêiner,
// um motor (contrato em WORKBENCH.md) e um visualizador. Pode ser montado no Studio ou na proposta A/B/C escolhida.
// Fluxo por tarefas: Inspecionar → Diagnosticar → Corrigir → Comparar → Aplicar → Validar.
const STEPS = [['inspect', 'Inspecionar'], ['diagnose', 'Diagnosticar'], ['fix', 'Corrigir'], ['compare', 'Comparar'], ['apply', 'Aplicar'], ['validate', 'Validar']];
const STATE_LABEL = {'sem-modelo': 'Nenhum modelo', 'sem-rig': 'Malha sem rig', 'rascunho': 'Rascunho de rig (sem skin)', 'proposta': 'Proposta do auto-rig (sem skin)', 'ossos-sem-skin': 'Ossos sem skin', 'vinculado': 'Rig vinculado (skin)'};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const num = (v, d = 4) => v === null || v === undefined ? '—' : Number(v).toFixed(d).replace(/\.?0+$/, m => m.includes('.') ? '' : m) || '0';
const vec = (a, d = 4) => a ? '[' + a.map(v => num(v, d)).join(', ') + ']' : '—';
const OP_TEXT = {
  setBonePosition: o => `Mover ${o.jointId} para ${vec(o.position)}${o.space === 'local' ? ' (local)' : ''}`, moveBone: o => `Deslocar ${o.jointId} por ${vec(o.delta)}${o.space === 'local' ? ' (local)' : ''}`,
  setBoneQuaternion: o => `Rotação de repouso de ${o.jointId} → ${vec(o.quaternion)}`, renameJoint: o => `Renomear ${o.jointId} para “${o.newName}”`,
  reparentBone: o => `Pai de ${o.jointId} → ${o.newParentJointId ?? 'raiz'} (mantém a posição local)`, createBone: o => `Criar “${o.name}” sob ${o.parent ?? 'raiz'}${o.position ? ' em ' + vec(o.position) : ''}`,
  deleteBone: o => `Excluir ${o.jointId}`, mirrorBone: o => `Espelhar ${o.jointId} no lado oposto`, correctSymmetry: o => `Corrigir simetria a partir do lado ${o.referenceSide || 'Left'}`,
  recomputeBindMatrices: () => 'Recalcular matrizes de bind', normalizeSkinWeights: o => `Normalizar pesos${o.meshName ? ' de ' + o.meshName : ''}`,
  modifyVertexWeights: o => `Pesos do vértice ${o.vertexIndex} de ${o.meshName}`, setRestPose: o => `Pose de repouso de ${o.jointId}`, recomputeSkinningWeights: () => 'Recalcular pesos',
};
export const AI_PROMPT = `Você vai corrigir o esqueleto (rig) de um personagem 3D.
Abaixo está a telemetria oficial gerada pelo Arenamon Studio (inspectRig, schema arenamon-rig-telemetry v1).
Posições de "modelRoot" estão no espaço da raiz do modelo. Refira-se aos ossos pelo "id" (jointId persistente).
Responda SOMENTE com um JSON no formato canônico:
{"schema":"arenamon-rig-patch","version":1,"description":"…","operations":[ … ]}
Operações aceitas:
- {"op":"setBonePosition","jointId":"<id>","position":[x,y,z],"space":"model-root"}
- {"op":"moveBone","jointId":"<id>","delta":[dx,dy,dz],"space":"model-root"}
- {"op":"setBoneQuaternion","jointId":"<id>","quaternion":[x,y,z,w]}  (rotação local de repouso)
- {"op":"mirrorBone","jointId":"<id>"}  (copia a posição para o par Left/Right, espelhada)
- {"op":"correctSymmetry","referenceSide":"Left"}
- {"op":"renameJoint","jointId":"<id>","newName":"NovoNome"}
- {"op":"reparentBone","jointId":"<id>","newParentJointId":"<id do novo pai>"}  (mantém a posição LOCAL)
- {"op":"createBone","name":"Nome","parent":"<id>","position":[x,y,z]}  (num rig com skin, position é LOCAL ao pai)
- {"op":"normalizeSkinWeights"}
Cada operação pode ter um campo "note" explicando o motivo. Não invente ossos que não existem.`;
export const EXAMPLE_PATCH = {schema: 'arenamon-rig-patch', version: 1, description: 'Exemplo: espelhar o cotovelo esquerdo no direito',
  operations: [{op: 'mirrorBone', jointId: 'LeftElbow', note: 'Corrige a assimetria do cotovelo direito'}]};

export function mountWorkbench(container, {engine, viewer, layout = null, loadDemo = null}) {
  const S = {step: 'inspect', telemetry: null, selected: null, mesh: null, filter: '', advanced: false, collapsed: new Set(), patchText: '', validation: null, dry: null, applied: null, baseline: null, checked: new Set(), profile: 'humanoid-20'};
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
  $('wb-refresh').onclick = () => {refresh();toast('Telemetria gerada novamente pela API oficial (inspectRig).');};

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
    const t = S.telemetry, p = panel('inspect');
    if (!t) {
      p.innerHTML = card('Nenhum modelo', `<p>Importe um personagem em <b>Projeto</b> para gerar a telemetria.</p>${loadDemo ? '<p>Ou carregue a demonstração: personagem sintético com 6 malhas independentes, rig humanoide e skin criados pelo motor do Codex, com um cotovelo assimétrico e uma trilha de animação órfã.</p><button type="button" class="btn btn-primary" id="wb-demo">Carregar demonstração</button>' : ''}`);
      if (loadDemo) $('wb-demo').onclick = async () => {$('wb-demo').disabled = true;try {await loadDemo();} catch (e) {toast('Demonstração falhou: ' + e.message, 'warn');}};
      return;
    }
    const s = t.summary, j = joint(S.selected), auto = engine.autoRig, locked = auto?.locked || [];
    const overview = `<div class="wb-metrics">${[['Ossos', s.bones], ['Malhas', `${s.skinnedMeshes}/${s.meshes} com skin`], ['Vértices', s.vertices], ['Ossos citados em avisos', s.jointsWithWarnings, s.jointsWithWarnings ? 'warn' : ''],
      ['Vértices não normalizados', s.unnormalizedVertices, s.unnormalizedVertices ? 'warn' : ''], ['Vértices sem influência', s.verticesWithoutInfluence, s.verticesWithoutInfluence ? 'warn' : ''], ['Trilhas órfãs', s.orphanTracks, s.orphanTracks ? 'warn' : ''],
      ['Assimetria máxima', num(s.maxAsymmetry), s.maxAsymmetry ? 'warn' : ''], ['Fora da geometria', s.outsideBounds, s.outsideBounds ? 'warn' : ''], ['Skinning', STATE_LABEL[t.model.state]]]
      .map(([k, v, c]) => `<div class="wb-metric ${c || ''}" data-metric="${esc(k)}"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
    const detail = j ? kv([['Nome', `<b>${esc(j.name)}</b>${locked.includes(j.id) ? ' <span class="wb-badge">travado</span>' : ''}`], ['ID persistente', `<code>${esc(j.id)}</code>`], ['Osso pai', j.parent ? `<button type="button" class="wb-link" data-go="${esc(j.parentId)}">${esc(j.parent)}</button>` : 'raiz do modelo'],
      ['Filhos', j.children.length ? j.children.map(c => `<button type="button" class="wb-link" data-go="${esc(c)}">${esc(joint(c)?.name)}</button>`).join(' ') : '—'],
      ['Posição local', vec(j.local)], ['Relativa à raiz', vec(j.p)], ['Global (mundo)', vec(j.world)], ['Quaternion local', vec(j.q, 5)], ['Comprimento do segmento', num(j.segmentLength)],
      ['Influência', j.influence ? `${j.influence.vertices} vértices${j.influence.meshes.length ? ' · ' + j.influence.meshes.map(m => `${esc(m.mesh)}: ${m.vertices}`).join(', ') : ''}` : 'sem skin'],
      ['Simetria', j.symmetry ? `${esc(j.symmetry.pairName)} · assimetria ${num(j.symmetry.asymmetryDelta)}${j.symmetry.isSymmetric ? '' : ' <span class="wb-badge warn">assimétrico</span>'}` : '—'],
      ['Fora da geometria', j.outsideBounds ? `excede ${num(j.outsideBounds.distanceExceeded)}` : '—'],
      ['Avisos', j.warnings.length ? `<ul class="wb-warn">${j.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : 'nenhum'],
      ...(S.advanced ? [['Matriz de bind inversa', j.bindInverse ? `<code class="wb-matrix">${j.bindInverse.map(v => num(v, 4)).join(' ')}</code>` : '—']] : [])])
      + (t.model.state === 'proposta' ? `<div class="wb-row"><button type="button" class="btn btn-soft" id="wb-lock" aria-pressed="${locked.includes(j.id)}">${locked.includes(j.id) ? '🔓 Destravar ponto' : '🔒 Travar ponto'}</button></div>` : '') : '<p class="wb-hint">Selecione um osso.</p>';
    const meshes = t.meshes.map((m, i) => `<button type="button" class="wb-mesh${S.mesh === i ? ' selected' : ''}" data-mesh="${i}"><b>${esc(m.name)}</b><span>${m.vertices} vért. · ${m.skinned ? `${m.bones} ossos` : 'sem skin'}${m.zeroWeights ? ` · <em class="warn">${m.zeroWeights} sem influência</em>` : ''}</span></button>`).join('');
    const m = t.meshes[S.mesh];
    const meshDetail = m ? kv([['Vértices', m.vertices], ['Tipo', esc(m.type)], ['Ossos que a influenciam (vértices)', m.influencesPerBone ? Object.entries(m.influencesPerBone).filter(([, v]) => v).sort((a, b) => b[1] - a[1]).map(([n, v]) => `${esc(n)} (${v})`).join(', ') || '—' : '—'],
      ['Pesos', m.weightStats ? `mín. não nulo ${num(m.weightStats.minNonZero)} · máx. ${num(m.weightStats.max)} · influências por vértice ${num(m.weightStats.avgInfluencesPerVertex, 2)} (máx. ${m.weightStats.maxInfluencesPerVertex})` : '—'],
      ['Vértices sem influência', m.zeroWeights ?? '—'], ['Vértices não normalizados', m.unnormalized ?? '—'], ['Ossos da paleta sem uso nesta malha', m.uninfluencedBones.length ? m.uninfluencedBones.map(esc).join(', ') : '—'],
      ['Avisos de deformação', m.deformationWarnings.length ? m.deformationWarnings.map(esc).join('<br>') : '—']]) : '<p class="wb-hint">Escolha uma malha para ver a distribuição de pesos.</p>';
    const o = viewer?.options || {};
    const layers = `<div class="wb-layers">${[['skeleton', 'Esqueleto'], ['axes', 'Eixos do osso'], ['symmetry', 'Simetria'], ['heatmap', 'Heatmap de pesos'], ['problems', 'Regiões problemáticas']]
      .map(([k, l]) => `<label class="wb-check"><input type="checkbox" data-layer="${k}" ${o[k] ? 'checked' : ''}${k === 'heatmap' && t.model.state !== 'vinculado' ? ' disabled' : ''}> ${l}</label>`).join('')}</div>`;
    p.innerHTML = overview + card('Articulação', detail) + card('Malhas independentes', `<div class="wb-meshes">${meshes}</div>${meshDetail}`) + card('Visualização', layers)
      + `<p class="wb-hint">${esc(t.notes || '')}</p>` + (S.advanced ? card('JSON da articulação (telemetria oficial)', pre({hierarchy: t.official.identification.hierarchy.find(h => h.id === j?.id), transforms: t.official.transforms.bones.find(b => b.id === j?.id)})) : '');
    const lock = $('wb-lock');if (lock) lock.onclick = () => {try {auto.toggleLock(j.id);} catch (e) {toast(e.message, 'warn');}refresh();};
  }

  // 2. Diagnosticar: avisos, simetria, animações e saída para a IA.
  function diagnose() {
    const t = S.telemetry, p = panel('diagnose');if (!t) {p.innerHTML = '<p class="wb-hint">Sem telemetria.</p>';return;}
    const asym = t.symmetry.pairs.filter(pr => !pr.isSymmetric).sort((a, b) => b.asymmetryDelta - a.asymmetryDelta);
    p.innerHTML = card('Para a IA', `<p>Copie a telemetria, cole numa conversa com uma IA e peça um <b>Rig Patch JSON</b>. Depois cole a resposta em <b>Corrigir</b>.</p>
      <div class="wb-row"><button type="button" class="btn btn-primary" id="wb-copy-ai">Copiar para IA (instruções + telemetria)</button><button type="button" class="btn btn-soft" id="wb-copy-json">Copiar JSON completo</button>
      <button type="button" class="btn btn-soft" id="wb-copy-sel" ${S.checked.size || S.selected ? '' : 'disabled'}>Copiar seleção (${S.checked.size || (S.selected ? 1 : 0)} ${S.checked.size === 1 || (!S.checked.size && S.selected) ? 'osso' : 'ossos'})</button>
      <button type="button" class="btn btn-soft" id="wb-export">↓ Exportar JSON</button></div>
      <p class="wb-hint">A seleção usa os ossos marcados na árvore (Espaço ou caixa de seleção); sem marcas, o osso selecionado.</p>`)
      + card(`Avisos do motor (${t.warnings.length})`, t.warnings.length ? `<ul class="wb-warn">${t.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : '<p>Nenhum aviso de inspectRig.</p>')
      + card(`Assimetria (inspectRig · plano ${esc(t.symmetry.plane)}, centro x = ${num(t.symmetry.centerPlaneX)})`, asym.length ? `<table class="wb-table" id="wb-asym"><tr><th>Par</th><th>Assimetria</th></tr>${asym.map(pr => `<tr><td><button type="button" class="wb-link" data-go="${esc(pr.leftId)}">${esc(pr.leftName)}</button> ↔ <button type="button" class="wb-link" data-go="${esc(pr.rightId)}">${esc(pr.rightName)}</button></td><td>${num(pr.asymmetryDelta)}</td></tr>`).join('')}</table>` : '<p>Todos os pares Left/Right são simétricos.</p>')
      + card('Compatibilidade com animações', t.animations.length ? `<table class="wb-table"><tr><th>Clipe</th><th>Trilhas</th><th>Órfãs (inspectRig)</th></tr>${t.animations.map(a => `<tr><td>${esc(a.name)}</td><td>${a.tracks}</td><td class="${a.orphanTracks.length ? 'warn' : ''}">${a.orphanTracks.map(esc).join('<br>') || '—'}</td></tr>`).join('')}</table>` : '<p>Nenhuma animação carregada.</p>')
      + (S.advanced ? card('Telemetria oficial completa', pre(t.official)) : '');
    const full = () => JSON.stringify(engine.official(), null, 2);
    $('wb-copy-ai').onclick = () => copy(AI_PROMPT + '\n\n' + full(), 'Instruções e telemetria oficial copiadas.');
    $('wb-copy-json').onclick = () => copy(full(), 'Telemetria oficial completa copiada.');
    $('wb-copy-sel').onclick = () => {const ids = S.checked.size ? [...S.checked] : [S.selected];copy(JSON.stringify(engine.telemetry({select: ids}), null, 2), `Telemetria de ${ids.length} osso(s) copiada.`);};
    $('wb-export').onclick = () => download(full(), `${(t.model.name || 'rig').replace(/[^\w.-]+/g, '_')}.telemetria.json`);
  }
  async function copy(text, msg) {
    S.lastCopy = text;
    try {await navigator.clipboard.writeText(text);toast(msg);}
    catch {const a = document.createElement('textarea');a.value = text;container.append(a);a.select();const ok = document.execCommand?.('copy');a.remove();toast(ok ? msg : 'Não foi possível copiar: o navegador bloqueou a área de transferência.', ok ? 'ok' : 'warn');}
  }
  function download(text, name) {const url = URL.createObjectURL(new Blob([text], {type: 'application/json'})), a = document.createElement('a');a.href = url;a.download = name;a.click();setTimeout(() => URL.revokeObjectURL(url), 2000);toast('Arquivo ' + name + ' gerado.');}

  // 3. Corrigir: auto-rig assistido, editor de patch e importação.
  function fix() {
    const t = S.telemetry, p = panel('fix'), auto = engine.autoRig, st = t?.model.state, prop = st === 'proposta';
    const conf = auto?.regionConfidence, hasTail = !!auto?.proposal?.joints.some(j => j.name.startsWith('Tail'));
    const autoCard = auto ? card('Auto-rig assistido (API oficial)', `<p>Estado: <b>${esc(STATE_LABEL[st] || '—')}</b>${prop && auto.profile ? ` · perfil <code>${esc(auto.profile)}</code>` : ''}.</p>
      <div class="wb-row"><label class="rg-field">Perfil anatômico<select id="wb-profile">${auto.profiles.map(pr => `<option value="${pr.id}" ${pr.available ? '' : 'disabled'} ${S.profile === pr.id ? 'selected' : ''}>${esc(pr.label)}</option>`).join('')}</select></label></div>
      <div class="wb-row"><button type="button" class="btn btn-soft" id="wb-auto-template" ${auto.canPropose() ? '' : 'disabled title="O modelo já tem ossos"'}>${prop ? 'Gerar nova proposta' : 'Gerar proposta de esqueleto'}</button>
      ${st === 'rascunho' ? '<button type="button" class="btn btn-soft" id="wb-auto-adopt">Editar este rascunho na Workbench</button>' : ''}
      <button type="button" class="btn btn-soft" id="wb-auto-import">Importar coordenadas JSON</button>
      <button type="button" class="btn btn-primary" id="wb-auto-bind" ${prop ? '' : 'disabled'}>Aplicar skinning (bind)</button>
      <button type="button" class="btn btn-soft" id="wb-auto-test" ${st === 'vinculado' ? '' : 'disabled'}>Testar deformações</button>
      ${prop ? '<button type="button" class="btn btn-soft" id="wb-auto-discard">Descartar proposta</button>' : ''}</div>
      ${prop ? `<div class="wb-row"><label class="rg-field">Regenerar região<select id="wb-region">${auto.regions.map(r => `<option value="${r.id}" ${r.available ? '' : 'disabled'}>${esc(r.label)}${r.available ? '' : ' — API não implementa'}</option>`).join('')}</select></label>
      <button type="button" class="btn btn-soft" id="wb-auto-regen" ${hasTail ? '' : 'disabled title="A proposta não tem cauda"'}>Regenerar</button>
      <button type="button" class="btn btn-soft" id="wb-auto-fit">Ajustar aos marcos estimados</button>
      <span class="wb-hint">Travados: <b id="wb-locked-count">${auto.locked.length}</b> (selecione um ponto e use “Travar ponto” em Inspecionar).</span></div>` : ''}
      <p class="wb-hint"><b>Incerteza:</b> ${conf ? `a API informa confiança por <b>região</b>, não por ponto — ${conf.map(c => `${esc(c.region)} ${num(c.confidence, 2)}${c.estimated ? ' (estimada)' : ''}`).join(' · ')}` : 'gere uma proposta para ver a confiança por região informada por analyzeGeometry; a API não informa incerteza por ponto'}. Confira os pontos no visualizador.</p>
      <p class="wb-hint">Regenerar só funciona para a cauda (única região implementada por regenerateRegion). Desfazer funciona em todas as etapas.</p>`) : '';
    const v = S.validation;
    const migration = v?.migration ? `<div class="wb-card wb-migration" id="wb-migration"><h4>Migração do formato anterior (ops → operations)</h4><p class="wb-hint">O patch usa o formato anterior da Workbench. Ele foi convertido explicitamente para o contrato canônico; confira antes de comparar.</p>
      <table class="wb-table"><tr><th>Anterior</th><th>Canônico</th><th>Observação</th></tr>${v.migration.report.map(r => `<tr><td><code>${esc(r.from)}</code></td><td>${r.to.map(x => `<code>${esc(x)}</code>`).join('<br>')}</td><td>${esc(r.note || '')}</td></tr>`).join('')}</table>
      ${v.patch ? '<button type="button" class="btn btn-soft" id="wb-use-migrated">Substituir no editor pelo patch canônico</button>' : ''}</div>` : '';
    const validation = !v ? '' : v.ok ? `<div class="wb-ok" id="wb-valid">✓ Patch válido para a API oficial (validatePatch + simulateRigPatch, ${v.patch.operations.length} operações).</div>
      <ol class="wb-ops">${v.patch.operations.map(o => `<li>${esc(OP_TEXT[o.op]?.(o) ?? o.op)}${o.note ? ` <small>— ${esc(o.note)}</small>` : ''}</li>`).join('')}</ol>
      ${v.simulation.warnings.length ? `<ul class="wb-warn">${v.simulation.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`
      : `<div class="wb-error" id="wb-invalid" role="alert"><b>${v.stage === 'pendente' ? 'Não aplicável hoje' : 'Patch inválido'} (${esc(v.stage)}):</b><ul>${v.errors.map(e => `<li><code>${esc(e.path)}</code> ${esc(e.message)}</li>`).join('')}</ul></div>`;
    p.innerHTML = autoCard + card('Rig Patch JSON', `<label class="wb-label" for="wb-patch">Cole a resposta da IA ou importe um arquivo. Ctrl+Enter valida.</label>
      <textarea id="wb-patch" class="wb-editor" spellcheck="false" rows="12" aria-describedby="wb-patch-help">${esc(S.patchText)}</textarea>
      <p class="wb-hint" id="wb-patch-help">Formato canônico: <code>{"schema":"arenamon-rig-patch","version":1,"operations":[…]}</code>. Patches anteriores com <code>"ops"</code> são migrados explicitamente, com relatório.</p>
      <div class="wb-row"><button type="button" class="btn btn-soft" id="wb-validate">Verificar comandos</button><button type="button" class="btn btn-primary" id="wb-to-compare" ${v?.ok ? '' : 'disabled'}>Comparar antes/depois →</button>
      <label class="btn btn-soft wb-file">Importar arquivo<input type="file" id="wb-patch-file" accept=".json,application/json" hidden></label><button type="button" class="btn btn-soft" id="wb-example">Exemplo</button></div>${migration}${validation}`);
    const um = $('wb-use-migrated');if (um) um.onclick = () => {const {patch} = S.validation;S.patchText = $('wb-patch').value = JSON.stringify(patch, null, 2);runValidate();toast('Patch canônico no editor.');};
    const area = $('wb-patch');area.oninput = () => {S.patchText = area.value;if (S.validation) {S.validation = null;fix();area.focus();area.setSelectionRange(area.value.length, area.value.length);}};
    area.onkeydown = e => {if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {e.preventDefault();runValidate();}};
    $('wb-validate').onclick = runValidate;$('wb-to-compare').onclick = () => {goto('compare');runDry();};
    $('wb-example').onclick = () => {S.patchText = JSON.stringify(EXAMPLE_PATCH, null, 2);S.validation = null;fix();};
    $('wb-patch-file').onchange = async e => {const f = e.target.files[0];if (!f) return;await loadPatchText(await f.text());e.target.value = '';};
    if (auto) {
      const act = (fn, ok) => {try {const r = fn();refresh();if (ok) toast(typeof ok === 'function' ? ok(r) : ok);} catch (e) {toast(e.message, 'warn');}};
      $('wb-profile').onchange = e => {S.profile = e.target.value;};
      $('wb-auto-template').onclick = () => {const id = $('wb-profile').value;S.profile = id;act(() => auto.generate(id), d => `Proposta gerada pela API oficial: ${d.joints.length} pontos (${id}). Nada foi vinculado ainda.`);};
      const adopt = $('wb-auto-adopt');if (adopt) adopt.onclick = () => act(() => auto.adoptDraft(), 'Rascunho copiado para a Workbench como proposta.');
      $('wb-auto-bind').onclick = () => act(() => auto.bind(), r => `Skin vinculado: ${r.replacements.length} malhas, ${r.bones.length} ossos. Ctrl+Z desfaz.`);
      $('wb-auto-test').onclick = () => {auto.testDeformation();toast('Teste de deformação: use “Rotação de teste” na aba Rigging (não altera o rig).');};
      const discard = $('wb-auto-discard');if (discard) discard.onclick = () => act(() => auto.discard(), 'Proposta descartada.');
      const regen = $('wb-auto-regen');if (regen) regen.onclick = () => act(() => auto.regenerate($('wb-region').value), 'Região regenerada pela API oficial (pontos travados preservados).');
      const fit = $('wb-auto-fit');if (fit) fit.onclick = () => act(() => auto.fitLandmarks(), r => `Ajuste aos marcos: ${r.modified.length ? r.modified.join(', ') : 'nenhum ponto alterado'} (travados preservados).`);
      $('wb-auto-import').onclick = () => {const i = document.createElement('input');i.type = 'file';i.accept = '.json,application/json';i.onchange = async () => {if (i.files[0]) await loadPatchText(await i.files[0].text());};i.click();};
    }
  }
  /** Aceita Rig Patch (canônico ou anterior) ou JSON de coordenadas do Codex (convertido em setBonePosition). */
  async function loadPatchText(text) {
    let data = null;try {data = JSON.parse(text);} catch {/* a validação mostra a linha do erro */}
    if (data?.schema === 'arenamon-rig') {try {text = JSON.stringify(engine.patchFromRigJSON(data), null, 2);toast('Coordenadas convertidas em patch canônico de setBonePosition.');} catch (e) {toast(e.message, 'warn');}}
    S.patchText = text;S.validation = null;goto('fix');runValidate();
  }
  function runValidate() {S.patchText = $('wb-patch')?.value ?? S.patchText;try {S.validation = engine.validate(S.patchText);} catch (e) {S.validation = {ok: false, stage: 'motor', errors: [{path: '(motor)', message: e.message}]};}fix();}

  // 4. Comparar: ensaio REAL com a API oficial (applyRigPatch, inspectRig, undo da própria transação).
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
    const sim = d.simulation.diff, simList = [['adicionados', sim.bonesAdded], ['removidos', sim.bonesRemoved], ['movidos', sim.bonesMoved], ['rotacionados', sim.bonesRotated], ['renomeados', sim.bonesRenamed], ['com novo pai', sim.bonesReparented]].filter(([, l]) => l.length);
    p.innerHTML = `<p class="wb-ok" id="wb-dry-ok">${d.kind === 'draft' ? 'Ensaio com applyRigPatch oficial numa cópia do rascunho: o rascunho atual não foi alterado.' : 'Ensaio real com applyRigPatch oficial: aplicado, medido com inspectRig e desfeito pela própria entrada de undo; ossos, pesos, matrizes e metadados conferidos — o rig atual não foi alterado.'}</p>`
      + card('Previsão de simulateRigPatch', `<p>${simList.map(([k, l]) => `${l.length} ${k}`).join(' · ') || 'nenhuma mudança estrutural prevista'}${sim.skinningImpacted ? ' · <b>afeta o skinning</b>' : ''}</p>${d.simulation.warnings.length ? `<ul class="wb-warn">${d.simulation.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`)
      + card(`Ossos alterados (${d.changes.length})`, d.changes.length ? `<table class="wb-table" id="wb-changes"><tr><th>Osso</th><th>Δ posição</th><th>Δ rotação</th><th>Nome / hierarquia</th></tr>${rows}</table>` : '<p>O patch não altera nenhum osso.</p>')
      + card('Avisos', `<p><b>Resolvidos (${d.warnings.resolved.length}):</b></p><ul class="wb-ok-list">${d.warnings.resolved.map(w => `<li>${esc(w)}</li>`).join('') || '<li>—</li>'}</ul><p><b>Novos (${d.warnings.added.length}):</b></p><ul class="wb-warn">${d.warnings.added.map(w => `<li>${esc(w)}</li>`).join('') || '<li>—</li>'}</ul>`)
      + card('Pesos', d.influence.length ? `<table class="wb-table"><tr><th>Osso</th><th>Vértices influenciados</th></tr>${d.influence.map(c => `<tr><td>${esc(c.name)}</td><td>${c.before ?? '—'} → ${c.after ?? '—'}</td></tr>`).join('')}</table>` : `<p>${S.telemetry?.model.state === 'vinculado' ? 'O patch não muda os vértices influenciados por osso (inspectRig).' : 'Sem skin ainda.'}</p>${d.kind === 'draft' ? '<button type="button" class="btn btn-soft" id="wb-bind-preview">Prever pesos após o bind (bind oficial em cópias)</button><div id="wb-bind-result"></div>' : ''}`)
      + card('Visualizador', `<div class="wb-layers"><label class="wb-check"><input type="checkbox" data-layer="original" ${o.original ? 'checked' : ''}> Esqueleto original</label><label class="wb-check"><input type="checkbox" data-layer="ghost" ${o.ghost ? 'checked' : ''}> Esqueleto proposto (laranja)</label></div>`)
      + `<div class="wb-row wb-confirm"><button type="button" class="btn btn-primary" id="wb-apply" ${S.telemetry?.model.state === 'rascunho' ? 'disabled' : ''}>Aplicar correção</button>${S.telemetry?.model.state === 'rascunho' ? '<p class="wb-hint">A API oficial não sincroniza o rascunho da aba Rigging: use “Editar este rascunho na Workbench” em Corrigir para aplicar aqui.</p>' : ''}<button type="button" class="btn btn-soft" id="wb-cancel">Cancelar</button></div>`;
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
    const keys = ['bones', 'meshes', 'vertices', 'jointsWithWarnings', 'unnormalizedVertices', 'verticesWithoutInfluence', 'orphanTracks', 'warnings', 'maxAsymmetry', 'outsideBounds'];
    const labels = {bones: 'Ossos', meshes: 'Malhas', vertices: 'Vértices', jointsWithWarnings: 'Ossos citados em avisos', unnormalizedVertices: 'Vértices não normalizados', verticesWithoutInfluence: 'Vértices sem influência', orphanTracks: 'Trilhas órfãs', warnings: 'Avisos', maxAsymmetry: 'Assimetria máxima', outsideBounds: 'Ossos fora da geometria'};
    const wa = new Set(a.warnings), wb = new Set(b.warnings);
    const asymRows = b.symmetry.pairs.map(pr => {const old = a.symmetry.pairs.find(x => x.leftId === pr.leftId && x.rightId === pr.rightId);return old && old.asymmetryDelta !== pr.asymmetryDelta ? `<tr><td>${esc(pr.leftName)} ↔ ${esc(pr.rightName)}</td><td>${num(old.asymmetryDelta)} → ${num(pr.asymmetryDelta)}</td></tr>` : '';}).join('');
    p.innerHTML = `<div class="wb-row"><button type="button" class="btn btn-soft" id="wb-revalidate">↻ Gerar nova telemetria</button></div>`
      + card('Métricas (antes → agora)', `<table class="wb-table" id="wb-metric-diff">${keys.map(k => `<tr class="${a.summary[k] !== b.summary[k] ? 'changed' : ''}"><td>${labels[k]}</td><td>${esc(a.summary[k])} → <b>${esc(b.summary[k])}</b></td></tr>`).join('')}</table>`)
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
