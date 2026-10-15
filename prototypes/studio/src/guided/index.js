// Rigging guiado (Proposta B aprovada em 15/10/2026): interface padrão da aba Rigging, em cinco etapas, sobre o
// motor oficial (adaptador da Workbench, rigging/core.js, auto-rig, telemetria) e a biblioteca CC0.
//
// O assistente não refaz nenhuma ferramenta: o Auto-Rig gera e ajusta o esqueleto sozinho; as etapas supervisionam,
// corrigem e validam. “Modo avançado” devolve o painel completo da aba Rigging (hierarquia, coordenadas, estrutura,
// skin) e o acesso à Telemetria / Rig Patch.
//   1 Anatomia     — detecta o rig existente (preservado) ou gera o Auto-Rig com o perfil sugerido pela análise.
//   2 Articulações — primeiro os ossos que a telemetria aponta; os demais ficam acessíveis sem confirmação.
//   3 Simetria     — por par, respeitando travas e só em massa quando a malha é bilateral.
//   4 Skinning     — dois algoritmos, prévia de deformação numa cópia, bind desfazível; rig vinculado é preservado.
//   5 Validação    — flexão, animações CC0 (só em humanoides compatíveis), exportar GLB e conferir a reimportação.
import * as T from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {bindDraftToModel, collectBones, WEIGHT_ALGORITHMS} from '../rigging/core.js';
import {inspectRig} from '../rigging/telemetry.js';
import {inspectTarget} from '../library/retarget.js';
import {createWorkbenchViewer} from '../workbench/viewer.js';
import {GUIDED_CSS} from './styles.js';

const E = window.__importer, WB = window.__studioWorkbench, section = document.querySelector('[data-section="rigging"]');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const num = (v, d = 3) => v === null || v === undefined || !Number.isFinite(v) ? '—' : Number(v).toFixed(d);
const STEPS = [['Anatomia', 'Auto-Rig'], ['Articulações', 'Revisão'], ['Simetria', 'Pares L/R'], ['Skinning', 'Pesos'], ['Validação', 'Teste e GLB']];
const WEIGHT_TEXT = {'segment-proximity': ['Proximidade de segmento', 'Pesos pelo inverso da distância a cada osso. Transições mais suaves e largas.'],
  'capsule-falloff': ['Cápsula com decaimento gaussiano', 'Cada vértice segue o osso mais próximo, com queda gaussiana. Membros mais rígidos e definidos.']};
const CC0_TESTS = ['Idle', 'Walking', 'Running', 'Jump', 'Punch', 'Wave'];
const storage = {get: k => {try {return localStorage.getItem(k);} catch {return null;}}, set: (k, v) => {try {localStorage.setItem(k, v);} catch {/* sem armazenamento */}}};

if (E && WB && section) {
  const engine = WB.engine, L = window.__studioLayout, R = () => window.__studioRig;
  const style = document.createElement('style');style.textContent = GUIDED_CSS;document.head.append(style);
  // O painel completo da aba Rigging continua inteiro, só passa a ficar atrás do “Modo avançado”.
  const advanced = document.createElement('div');advanced.id = 'gr-advanced';
  while (section.firstChild) advanced.append(section.firstChild);
  const root = document.createElement('div');root.className = 'gr';root.id = 'gr-root';
  section.append(root, advanced);
  const G = {mode: storage.get('arenamon.rigging.mode') === 'advanced' ? 'advanced' : 'guided', step: 1, selected: null, view: null, reviewed: false, symmetryAccepted: false,
    weights: WEIGHT_ALGORITHMS[0], smoothness: .13, preview: null, flex: null, validation: null, showAll: false, profile: null, message: null};
  const viewer = createWorkbenchViewer({onPick: id => select(id, {focus: false})});
  // Gizmo próprio do assistente (o do painel avançado continua com o painel avançado).
  const proxy = new T.Object3D();proxy.name = 'Rigging guiado · alvo do gizmo';E.scene.add(proxy);
  const gizmo = new TransformControls(E.camera, E.renderer.domElement);gizmo.setSize(.8);
  const gizmoHelper = gizmo.getHelper();gizmoHelper.name = 'Rigging guiado · gizmo';E.scene.add(gizmoHelper);
  gizmo.addEventListener('dragging-changed', e => {E.controls.enabled = !e.value;if (!e.value) commitDrag();});

  const active = () => L?.panel === 'rigging' && L?.leftOpen && !!E.model;
  const guidedOn = () => active() && G.mode === 'guided';
  const state = () => engine.available() ? engine.state() : 'sem-modelo';
  const joint = id => G.view?.joints.find(j => j.id === id) || null;
  const locked = () => new Set(engine.autoRig.locked);
  const msg = (text, kind = 'ok') => {G.message = {text, kind};render();};

  // ---------- Telemetria e problemas ----------
  function refresh() {
    G.view = engine.available() && ['proposta', 'vinculado', 'ossos-sem-skin', 'rascunho'].includes(state()) ? engine.telemetry() : null;
    if (G.selected && !joint(G.selected)) G.selected = null;
    viewer.setTelemetry(G.view);viewer.setSelected(G.selected);syncGizmo();render();
  }
  /** Ossos com problema apontados pela telemetria oficial, do mais grave para o mais leve. */
  function problems() {
    const v = G.view;if (!v) return [];const out = new Map(), add = (j, reason, score) => {const p = out.get(j.id) || {j, reasons: [], score: 0};p.reasons.push(reason);p.score = Math.max(p.score, score);out.set(j.id, p);};
    for (const j of v.joints) {
      if (j.outsideBounds) add(j, `fora da malha (${num(j.outsideBounds.distanceExceeded)})`, 3 + j.outsideBounds.distanceExceeded);
      if (j.symmetry && !j.symmetry.isSymmetric && j.name.startsWith('Right')) add(j, `assimétrico com ${j.symmetry.pairName} (${num(j.symmetry.asymmetryDelta)})`, 2 + j.symmetry.asymmetryDelta);
      if (v.state === 'vinculado' && j.influence && j.influence.vertices === 0 && j.children.length) add(j, 'não move nenhum vértice', 1);
      for (const w of j.warnings) if (!/fora da geometria|Track órfão/i.test(w)) add(j, w, 1);
    }
    for (const c of v.official.consistency.coincidentSegments || []) {const j = v.joints.find(x => x.id === c.id || x.name === c.name);if (j) add(j, 'segmento de comprimento quase zero', 2);}
    return [...out.values()].sort((a, b) => b.score - a.score);
  }

  // ---------- Seleção, câmera e gizmo ----------
  function select(id, {focus = true} = {}) {
    if (!joint(id)) return;G.selected = id;viewer.setSelected(id);
    try {if (state() !== 'proposta') engine.select(id);} catch {/* sem rig no painel avançado */}
    if (focus) focusJoint(id);syncGizmo();render();
  }
  /** Enquadra a articulação: vista ortográfica atual (ou frontal), centralizada nela e aproximada. */
  function focusJoint(id) {
    const j = joint(id);if (!j?.p) return;
    if (!E.camera.isOrthographicCamera) window.__studioViewBar?.setView(bestView());
    const target = E.model.localToWorld(new T.Vector3(...j.p)), cam = E.camera, offset = cam.position.clone().sub(E.controls.target);
    E.controls.target.copy(target);cam.position.copy(target).add(offset);cam.zoom = 1.5;cam.updateProjectionMatrix();E.controls.update();
  }
  function syncGizmo() {
    const j = joint(G.selected), show = guidedOn() && G.step <= 3 && j && !locked().has(j.id) && !G.flex && !G.preview;
    gizmo.camera = E.camera;
    if (show) {proxy.position.copy(E.model.localToWorld(new T.Vector3(...j.p)));if (gizmo.object !== proxy) gizmo.attach(proxy);}
    else if (gizmo.object) gizmo.detach();
    gizmoHelper.visible = !!show;
  }
  function commitDrag() {
    const j = joint(G.selected);if (!j) return;
    const p = E.model.worldToLocal(proxy.position.clone()).toArray();
    if (Math.hypot(...p.map((v, k) => v - j.p[k])) < 1e-6) return;
    applyOps([{op: 'setBonePosition', jointId: j.id, position: p, space: 'model-root'}], `Mover ${j.name}`);
  }
  /** Toda correção do assistente passa pelo motor oficial: uma entrada no histórico, travas respeitadas. */
  function applyOps(operations, description) {
    const r = engine.apply({schema: 'arenamon-rig-patch', version: 1, description, operations});
    if (!r.ok) {msg(r.errors.map(e => e.message).join(' · '), 'warn');refresh();return false;}
    G.message = {text: `${description}: aplicado. Ctrl+Z desfaz.`, kind: 'ok'};refresh();return true;
  }

  // ---------- Etapas ----------
  const done = n => {
    const st = state();
    if (n === 1) return ['proposta', 'vinculado', 'ossos-sem-skin'].includes(st);
    if (n === 2) return done(1) && (G.reviewed || !problems().some(p => p.score >= 2));
    if (n === 3) return done(1) && (G.symmetryAccepted || !(G.view?.symmetry.pairs || []).some(p => !p.isSymmetric));
    if (n === 4) return st === 'vinculado';
    return G.validation?.ok === true;
  };
  /** Vista que mostra o corpo inteiro de lado a lado: frontal para bípedes, lateral para corpos longitudinais (quadrúpedes). */
  const bestView = () => {const s = new T.Box3().setFromObject(E.model).getSize(new T.Vector3());return s.z > s.x * 1.2 ? 'right' : 'front';};
  /** Trocar de etapa volta ao enquadramento do corpo inteiro. */
  function goto(n) {stopFlex();stopPreview();G.step = n;G.message = null;if (E.model && active()) window.__studioViewBar?.setView(bestView());syncGizmo();render();}

  function stepAnatomy() {
    const st = state(), v = G.view, s = engine.available() ? engine.autoRig.suggestProfile() : null;
    if (!E.model) return `<div class="gr-tip">Importe um personagem em <b>Projeto</b>. O assistente detecta se ele já tem rig ou gera um automaticamente.</div>`;
    G.profile ??= s?.profile;
    const meshInfo = (() => {let meshes = 0, vertices = 0, skinned = 0;E.model.traverse(o => {if (o.isMesh) {meshes++;vertices += o.geometry.attributes.position?.count || 0;if (o.isSkinnedMesh) skinned++;}});return {meshes, vertices, skinned};})();
    const head = `<dl class="gr-kv"><dt>Malhas</dt><dd>${meshInfo.meshes} (${meshInfo.skinned} com skin)</dd><dt>Vértices</dt><dd>${meshInfo.vertices}</dd><dt>Forma</dt><dd>${s?.quadruped ? 'quadrúpede (proporção longitudinal)' : 'bípede'}</dd><dt>Simetria da malha</dt><dd>${s?.symmetry ? `${s.symmetry.isBilateral ? 'bilateral' : 'assimétrica'} (${num(s.symmetry.score, 2)})` : '—'}</dd></dl>`;
    if (st === 'vinculado' || st === 'ossos-sem-skin') return `<div class="gr-card"><h4>Rig existente detectado</h4>${head}<div class="gr-tip gr-ok">✓ ${v?.summary.bones ?? 0} ossos ${st === 'vinculado' ? 'e skin' : ''} já existentes. Nada será recriado nem sobrescrito: as próximas etapas só revisam e corrigem.</div></div>`;
    const profiles = engine.autoRig.profiles.map(p => `<label><input type="radio" name="gr-profile" value="${p.id}" ${G.profile === p.id ? 'checked' : ''}><span><b>${esc(p.label)}</b>${p.id === s?.profile ? ' <span class="gr-badge">sugerido</span>' : ''}</span></label>`).join('');
    return `<div class="gr-card"><h4>Personagem</h4>${head}</div>
      <div class="gr-card"><h4>Auto-Rig</h4><p class="st-hint">O esqueleto é gerado e ajustado aos marcos do corpo automaticamente. Você só revisa nas próximas etapas.</p>
      <div class="gr-radio">${profiles}</div>
      <button type="button" class="gr-btn primary" id="gr-autorig">${st === 'proposta' ? '↻ Gerar de novo' : '⚙ Gerar rig automaticamente'}</button>
      ${st === 'proposta' ? `<div class="gr-tip gr-ok">✓ Proposta com ${v.summary.bones} ossos (${esc(engine.autoRig.profile)}). Ainda não altera a malha: o skin só acontece na etapa 4.</div>` : ''}
      ${st === 'rascunho' ? '<div class="gr-tip">Há um rascunho criado no painel avançado. <button type="button" class="gr-btn small" id="gr-adopt">Usar este rascunho</button></div>' : ''}</div>`;
  }
  function jointEditor() {
    const j = joint(G.selected);if (!j) return '<p class="st-hint">Clique num osso da lista, do mini-mapa ou do visualizador.</p>';
    const isLocked = locked().has(j.id), prob = problems().find(p => p.j.id === j.id);
    return `<div class="gr-card"><h4>${esc(j.name)} ${isLocked ? '<span class="gr-badge">travado</span>' : ''}</h4>
      ${prob ? `<div class="gr-tip gr-warn">${prob.reasons.map(esc).join('<br>')}</div>` : ''}
      <div class="gr-xyz">${['X', 'Y', 'Z'].map((a, k) => `<label>${a}<input type="number" step="0.01" data-axis="${k}" value="${num(j.p[k], 4)}" ${isLocked ? 'disabled' : ''}></label>`).join('')}</div>
      <div class="gr-row"><button type="button" class="gr-btn small" id="gr-lock">${isLocked ? '🔓 Destravar' : '🔒 Travar'}</button>
      ${j.outsideBounds && !isLocked ? '<button type="button" class="gr-btn small" id="gr-inside">↘ Trazer para dentro da malha</button>' : ''}
      <button type="button" class="gr-btn small" id="gr-focus">⌖ Enquadrar</button></div>
      <p class="st-hint">Arraste as setas no visualizador ou digite as coordenadas (espaço da raiz do modelo).</p></div>`;
  }
  /** Mini-mapa 2D (vista frontal) com todos os ossos; os problemáticos têm contorno laranja. */
  function doll() {
    const v = G.view;if (!v) return '';const b = v.model.bounds, w = 220, h = 180, pad = 12, bad = new Set(problems().map(p => p.j.id));
    const sx = (b.size[0] || 1), sy = (b.size[1] || 1), s = Math.min((w - 2 * pad) / sx, (h - 2 * pad) / sy);
    const P = p => [w / 2 + (p[0] - b.center[0]) * s, h - pad - (p[1] - b.min[1]) * s];
    const lines = v.joints.filter(j => j.parentId).map(j => {const a = P(j.p), c = P(joint(j.parentId).p);return `<line x1="${c[0]}" y1="${c[1]}" x2="${a[0]}" y2="${a[1]}" stroke="#54d9ee66" stroke-width="2"/>`;}).join('');
    const dots = v.joints.map(j => {const [x, y] = P(j.p);return `<circle data-doll="${esc(j.id)}" cx="${x}" cy="${y}" r="${j.id === G.selected ? 7 : 5}" fill="${j.name.startsWith('Left') ? '#54d9ee' : j.name.startsWith('Right') ? '#ff7796' : '#bff36a'}" class="${j.id === G.selected ? 'sel' : ''} ${bad.has(j.id) ? 'bad' : ''}"><title>${esc(j.name)}</title></circle>`;}).join('');
    return `<svg class="gr-doll" viewBox="0 0 ${w} ${h}" role="img" aria-label="Mini-mapa frontal dos ossos">${lines}${dots}</svg>`;
  }
  function stepJoints() {
    if (!G.view) return '<div class="gr-tip">Gere o rig na etapa 1.</div>';
    const list = problems(), others = G.view.joints.filter(j => !list.some(p => p.j.id === j.id)), lk = locked();
    const row = (j, reasons, sev) => `<div class="gr-item ${j.id === G.selected ? 'selected' : ''}" data-joint="${esc(j.id)}">${sev !== undefined ? `<i class="gr-sev ${sev < 2 ? 'low' : ''}"></i>` : ''}<span>${esc(j.name)}${lk.has(j.id) ? ' 🔒' : ''}${reasons ? `<small>${reasons}</small>` : ''}</span></div>`;
    const outside = list.filter(p => p.j.outsideBounds && !lk.has(p.j.id));
    return `${doll()}
      <div class="gr-card"><h4>Precisam de atenção (${list.length})</h4>
      ${list.length ? `<div class="gr-list">${list.map(p => row(p.j, p.reasons.map(esc).join(' · '), p.score)).join('')}</div>` : '<div class="gr-tip gr-ok">✓ A telemetria não aponta problemas nas articulações.</div>'}
      ${outside.length > 1 ? `<button type="button" class="gr-btn" id="gr-inside-all">↘ Trazer os ${outside.length} pontos fora da malha para dentro</button>` : ''}</div>
      ${jointEditor()}
      <details class="gr-card" ${G.showAll ? 'open' : ''} id="gr-all"><summary>Todos os ossos (${G.view.joints.length}) — opcionais</summary><div class="gr-list">${others.map(j => row(j, '')).join('')}</div></details>
      <label class="gr-row"><input type="checkbox" id="gr-reviewed" ${G.reviewed ? 'checked' : ''}> Revisei as articulações</label>`;
  }
  function stepSymmetry() {
    if (!G.view) return '<div class="gr-tip">Gere o rig na etapa 1.</div>';
    const s = engine.autoRig.suggestProfile().symmetry, pairs = G.view.symmetry.pairs.filter(p => !p.isSymmetric).sort((a, b) => b.asymmetryDelta - a.asymmetryDelta), lk = locked();
    const bilateral = !!s?.isBilateral;
    const rows = pairs.map(p => `<div class="gr-item" data-joint="${esc(p.rightId)}"><span>${esc(p.leftName)} ↔ ${esc(p.rightName)}<small>diferença ${num(p.asymmetryDelta)}</small></span>
      <button type="button" class="gr-btn small" data-mirror="${esc(p.leftId)}|${esc(p.rightId)}" ${lk.has(p.rightId) ? 'disabled title="Direito travado"' : ''}>Esq → Dir</button>
      <button type="button" class="gr-btn small" data-mirror="${esc(p.rightId)}|${esc(p.leftId)}" ${lk.has(p.leftId) ? 'disabled title="Esquerdo travado"' : ''}>Dir → Esq</button></div>`).join('');
    return `<div class="gr-card"><h4>Malha</h4>${bilateral ? `<div class="gr-tip gr-ok">A malha é bilateral (${num(s.score, 2)}): corrigir pares em conjunto é seguro.</div>` : `<div class="gr-tip gr-warn">A malha <b>não</b> é simétrica (${num(s?.score, 2)}). O espelhamento em massa está desativado: corrija só os pares que devem ser iguais.</div>`}</div>
      <div class="gr-card"><h4>Pares assimétricos (${pairs.length})</h4>${pairs.length ? `<div class="gr-list">${rows}</div>` : '<div class="gr-tip gr-ok">✓ Todos os pares Left/Right estão simétricos.</div>'}
      ${bilateral && pairs.length > 1 ? '<div class="gr-row"><button type="button" class="gr-btn" id="gr-sym-all-lr">Corrigir todos (Esq → Dir)</button><button type="button" class="gr-btn" id="gr-sym-all-rl">Corrigir todos (Dir → Esq)</button></div><p class="st-hint">Pontos travados nunca são movidos.</p>' : ''}</div>
      ${pairs.length ? `<label class="gr-row"><input type="checkbox" id="gr-sym-ok" ${G.symmetryAccepted ? 'checked' : ''}> A assimetria restante é intencional (anatomia do personagem)</label>` : ''}`;
  }
  function stepSkin() {
    const st = state(), v = G.view;
    if (st === 'vinculado') return `<div class="gr-card"><h4>Skin existente preservado</h4><dl class="gr-kv"><dt>Malhas com skin</dt><dd>${v.summary.skinnedMeshes}/${v.summary.meshes}</dd><dt>Vértices sem influência</dt><dd>${v.summary.verticesWithoutInfluence}</dd><dt>Vértices não normalizados</dt><dd>${v.summary.unnormalizedVertices}</dd></dl>
      <div class="gr-tip gr-ok">Os pesos atuais não são recalculados. Para refazer o skin, desfaça o vínculo (Ctrl+Z) ou use o Modo avançado.</div>
      <label class="gr-row"><input type="checkbox" id="gr-heat" ${viewer.options.heatmap ? 'checked' : ''}> Mapa de calor do osso selecionado</label></div>`;
    if (st !== 'proposta') return '<div class="gr-tip">Gere o rig na etapa 1.</div>';
    const clips = E.clips.length;
    return `<div class="gr-card"><h4>Algoritmo de pesos</h4><div class="gr-radio">${WEIGHT_ALGORITHMS.map(a => `<label><input type="radio" name="gr-weights" value="${a}" ${G.weights === a ? 'checked' : ''}><span><b>${WEIGHT_TEXT[a][0]}</b><small>${WEIGHT_TEXT[a][1]}</small></span></label>`).join('')}</div>
      <label class="rg-field">Suavização <input type="range" id="gr-smooth" min="0.03" max="0.5" step="0.01" value="${G.smoothness}"> <output>${G.smoothness.toFixed(2)}</output></label></div>
      <div class="gr-card"><h4>Prévia de deformação</h4><p class="st-hint">Vincula uma <b>cópia</b> do personagem e dobra cotovelos, joelhos e coluna. O modelo não muda.</p>
      <div class="gr-row"><button type="button" class="gr-btn" id="gr-preview" aria-pressed="${!!G.preview}">${G.preview ? '■ Encerrar prévia' : '▶ Ver prévia'}</button></div>
      ${G.preview ? `<dl class="gr-kv"><dt>Algoritmo</dt><dd>${WEIGHT_TEXT[G.preview.weights][0]}</dd><dt>Vértices sem influência</dt><dd>${G.preview.zero}</dd></dl>` : ''}</div>
      ${clips ? `<div class="gr-tip gr-warn">O personagem tem ${clips} animação(ões); o vínculo exige uma malha sem animações (mesma regra do painel avançado).</div>` : ''}
      <button type="button" class="gr-btn primary" id="gr-bind" ${clips ? 'disabled' : ''}>⚙ Aplicar skinning</button>`;
  }
  function stepValidate() {
    const st = state();if (st !== 'vinculado') return '<div class="gr-tip">Conclua o skinning na etapa 4.</div>';
    const target = inspectTarget(E.model), lib = window.__studioLibrary, quad = /Hind|Front/.test(G.view.joints.map(j => j.name).join(' '));
    const flexes = [['elbows', 'Cotovelos'], ['knees', 'Joelhos'], ['spine', 'Coluna'], ['squat', 'Agachamento'], ...(G.view.joints.some(j => /^Tail/.test(j.name)) ? [['tail', 'Cauda']] : [])];
    const r = G.validation;
    return `<div class="gr-card"><h4>Testes de flexão</h4><div class="gr-row">${flexes.map(([id, l]) => `<button type="button" class="gr-btn small" data-flex="${id}" aria-pressed="${G.flex?.id === id}">${l}</button>`).join('')}</div>
      <button type="button" class="gr-btn small" id="gr-rest">↺ Pose de repouso</button></div>
      <div class="gr-card"><h4>Animações CC0</h4>${target.ok && !quad && lib ? `<p class="st-hint">Tocam no personagem para conferir a deformação em movimento.</p><div class="gr-row">${CC0_TESTS.map(n => `<button type="button" class="gr-btn small" data-anim="${n}">▶ ${n}</button>`).join('')}</div>`
        : `<div class="gr-tip">${quad ? 'Rig quadrúpede: as animações da biblioteca são humanoides e não se aplicam. Use os testes de flexão.' : `Animações humanoides não se aplicam a este rig (faltam: ${esc(target.missing.join(', '))}). Use os testes de flexão.`}</div>`}</div>
      <div class="gr-card"><h4>Exportar e conferir</h4><div class="gr-row"><button type="button" class="gr-btn primary" id="gr-check">✔ Exportar GLB e conferir a reimportação</button><button type="button" class="gr-btn" id="gr-download">↓ Baixar GLB</button></div>
      ${r ? `<ul class="gr-report">${r.items.map(i => `<li class="${i.ok ? 'ok' : 'bad'}">${i.ok ? '✓' : '✗'} ${esc(i.text)}</li>`).join('')}</ul>` : ''}</div>`;
  }

  function render() {
    const guided = G.mode === 'guided';
    advanced.hidden = guided;document.body.classList.toggle('gr-wide', guided && active());
    const body = guided ? [stepAnatomy, stepJoints, stepSymmetry, stepSkin, stepValidate][G.step - 1]() : '';
    root.innerHTML = `<div class="gr-mode" role="group" aria-label="Modo do Rigging"><button type="button" data-mode="guided" aria-pressed="${guided}">Assistente</button><button type="button" data-mode="advanced" aria-pressed="${!guided}">Modo avançado</button></div>
      ${guided ? `<nav class="gr-steps" aria-label="Etapas do rigging">${STEPS.map(([t, d], i) => `<button type="button" class="gr-step ${done(i + 1) ? 'done' : ''}" data-step="${i + 1}" ${G.step === i + 1 ? 'aria-current="step"' : ''} title="${d}"><b>${done(i + 1) && G.step !== i + 1 ? '✓' : i + 1}</b>${t}</button>`).join('')}</nav>
      <div class="gr-head"><span class="gr-badge">Etapa ${G.step} de 5</span><h3>${STEPS[G.step - 1][0]}</h3><p>${['O Auto-Rig gera o esqueleto; você confirma.', 'Primeiro o que a telemetria aponta; o resto é opcional.', 'Pares Left/Right, respeitando a anatomia e as travas.', 'Pesos da malha, com prévia antes de aplicar.', 'Deformação em movimento e exportação conferida.'][G.step - 1]}</p></div>
      ${G.message ? `<div class="gr-tip ${G.message.kind === 'warn' ? 'gr-warn' : 'gr-ok'}" role="status">${esc(G.message.text)}</div>` : ''}
      ${body}
      <div class="gr-foot"><button type="button" class="gr-btn" id="gr-prev" ${G.step === 1 ? 'disabled' : ''}>← Voltar</button><button type="button" class="gr-btn primary" id="gr-next" ${G.step === 5 ? 'disabled' : ''}>Próxima →</button></div>`
      : `<div class="gr-tip">Todas as ferramentas técnicas do Rigging estão abaixo. A Telemetria (Rig Patch, diagnóstico, IA) fica na aba própria.</div><button type="button" class="gr-btn" id="gr-open-telemetry">Abrir Telemetria e Rig Patch →</button>`}`;
    // O esqueleto sobreposto é o de repouso: só aparece onde ele é editado (etapas 1–3 e skin sem prévia).
    viewer.setActive(guidedOn() && (G.step <= 3 || (G.step === 4 && !G.preview)));
  }

  // ---------- Ações ----------
  root.addEventListener('click', e => {
    const t = e.target.closest('button, [data-joint], circle[data-doll]');if (!t) return;
    try {
      if (t.dataset.mode) {G.mode = t.dataset.mode;storage.set('arenamon.rigging.mode', G.mode);stopFlex();stopPreview();setCodexMarkers();syncGizmo();render();}
      else if (t.dataset.step) goto(Number(t.dataset.step));
      else if (t.id === 'gr-prev') goto(G.step - 1);else if (t.id === 'gr-next') goto(G.step + 1);
      else if (t.id === 'gr-open-telemetry') L.open('workbench');
      else if (t.id === 'gr-autorig') {const p = root.querySelector('[name=gr-profile]:checked')?.value || G.profile;G.profile = p;engine.autoRig.generate(p, {fit: true});G.reviewed = false;G.symmetryAccepted = false;refresh();msg(`Rig gerado automaticamente (${p}). Revise nas próximas etapas.`);}
      else if (t.id === 'gr-adopt') {engine.autoRig.adoptDraft();refresh();}
      else if (t.dataset.joint && !e.target.closest('button')) select(t.dataset.joint);
      else if (t.dataset.doll) select(t.dataset.doll);
      else if (t.id === 'gr-lock') {engine.autoRig.toggleLock(G.selected);refresh();}
      else if (t.id === 'gr-focus') focusJoint(G.selected);
      else if (t.id === 'gr-inside') bringInside([joint(G.selected)]);
      else if (t.id === 'gr-inside-all') bringInside(problems().filter(p => p.j.outsideBounds && !locked().has(p.j.id)).map(p => p.j));
      else if (t.dataset.mirror) {const [from, to] = t.dataset.mirror.split('|');mirror([[from, to]]);}
      else if (t.id === 'gr-sym-all-lr' || t.id === 'gr-sym-all-rl') mirrorAll(t.id.endsWith('lr'));
      else if (t.id === 'gr-preview') G.preview ? stopPreview() : startPreview();
      else if (t.id === 'gr-bind') {stopPreview();const r = engine.autoRig.bind({weights: G.weights, smoothness: G.smoothness});refresh();msg(`Skin aplicado (${WEIGHT_TEXT[G.weights][0]}): ${r.replacements.length} malhas. Ctrl+Z desfaz.`);}
      else if (t.dataset.flex) G.flex?.id === t.dataset.flex ? stopFlex() : startFlex(t.dataset.flex);
      else if (t.id === 'gr-rest') stopFlex();
      else if (t.dataset.anim) {stopFlex();window.__studioLibrary.play(t.dataset.anim);msg(`Tocando ${t.dataset.anim} no personagem.`);}
      else if (t.id === 'gr-check') check();
      else if (t.id === 'gr-download') download();
    } catch (err) {msg(err.message, 'warn');}
  });
  root.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'gr-profile') G.profile = t.value;
    else if (t.name === 'gr-weights') {G.weights = t.value;if (G.preview) startPreview();else render();}
    else if (t.id === 'gr-smooth') {G.smoothness = Number(t.value);if (G.preview) startPreview();else render();}
    else if (t.id === 'gr-reviewed') {G.reviewed = t.checked;render();}
    else if (t.id === 'gr-sym-ok') {G.symmetryAccepted = t.checked;render();}
    else if (t.id === 'gr-heat') {viewer.setOption('heatmap', t.checked);}
    else if (t.dataset.axis !== undefined) {
      const j = joint(G.selected), p = [...j.p];p[Number(t.dataset.axis)] = Number(t.value);
      if (Number.isFinite(p[Number(t.dataset.axis)])) applyOps([{op: 'setBonePosition', jointId: j.id, position: p, space: 'model-root'}], `Coordenada de ${j.name}`);
    }
  });
  root.addEventListener('toggle', e => {if (e.target.id === 'gr-all') G.showAll = e.target.open;}, true);

  /** Pontos fora da malha: puxados para dentro da caixa do modelo (2% de margem), numa única correção. */
  function bringInside(list) {
    const b = G.view.model.bounds, m = b.size.map(s => s * .02);
    const ops = list.filter(Boolean).map(j => ({op: 'setBonePosition', jointId: j.id, space: 'model-root', position: j.p.map((v, k) => Math.min(b.max[k] - m[k], Math.max(b.min[k] + m[k], v)))}));
    if (ops.length) applyOps(ops, `Trazer ${ops.length} ponto(s) para dentro da malha`);
  }
  /** Espelha a posição de cada origem no destino (plano de simetria da telemetria); destinos travados são ignorados. */
  function mirror(pairs, label) {
    const c = G.view.symmetry.centerPlaneX ?? G.view.model.bounds.center[0], lk = locked();
    const depth = id => joint(id)?.depth ?? 0, ops = [], skipped = [];
    for (const [from, to] of [...pairs].sort((a, b) => depth(a[1]) - depth(b[1]))) {
      if (lk.has(to)) {skipped.push(joint(to).name);continue;}
      const s = joint(from).p;ops.push({op: 'setBonePosition', jointId: to, space: 'model-root', position: [2 * c - s[0], s[1], s[2]]});
    }
    if (ops.length) applyOps(ops, label || `Espelhar ${joint(pairs[0][0]).name} → ${joint(pairs[0][1]).name}`);
    if (skipped.length) msg(`Travados e mantidos: ${skipped.join(', ')}.`, 'warn');
  }
  function mirrorAll(leftToRight) {
    const pairs = G.view.symmetry.pairs.filter(p => !p.isSymmetric).map(p => leftToRight ? [p.leftId, p.rightId] : [p.rightId, p.leftId]);
    mirror(pairs, `Corrigir simetria (${leftToRight ? 'Esq → Dir' : 'Dir → Esq'}, ${pairs.length} pares)`);
  }

  // ---------- Prévia de deformação (cópia) ----------
  function startPreview() {
    stopPreview(false);const draft = engine.autoRig.proposal;if (!draft) return;
    const clone = E.model.clone(true);clone.traverse(o => {if (o.isMesh) {o.geometry = o.geometry.clone();o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();}});
    clone.name = 'Rigging guiado · prévia de deformação';E.model.parent.add(clone);clone.position.copy(E.model.position);clone.quaternion.copy(E.model.quaternion);clone.scale.copy(E.model.scale);
    bindDraftToModel(clone, structuredClone(draft), {weights: G.weights, smoothness: G.smoothness});
    const zero = inspectRig(clone).skinning.meshes.reduce((s, m) => s + m.zeroWeightVertices, 0);
    E.model.visible = false;G.preview = {clone, weights: G.weights, zero, t0: performance.now(), rest: new Map(collectBones(clone).map(b => [b, b.quaternion.clone()]))};
    syncGizmo();render();
  }
  function stopPreview(doRender = true) {
    if (!G.preview) return;const {clone} = G.preview;clone.removeFromParent();clone.traverse(o => {if (o.isMesh) {o.geometry.dispose();[].concat(o.material).forEach(m => m.dispose());}});
    E.model.visible = true;G.preview = null;syncGizmo();if (doRender) render();
  }
  // ---------- Testes de flexão (temporários) ----------
  const FLEX = {elbows: /Elbow|ForeArm|LowerArm/i, knees: /Knee|LowerLeg|(Left|Right)Leg$/i, spine: /^(mixamorig)?(Spine|Chest|Torso)/i, squat: /Knee|LowerLeg|(Left|Right)Leg$|UpLeg|(Left|Right)(Hind)?Hip$/i, tail: /^Tail/};
  function bendSet(bones, id) {
    const list = bones.filter(b => FLEX[id].test(b.name)), Z = new T.Vector3(0, 0, 1);
    return list.map(b => {const child = b.children.find(c => c.isBone), seg = child ? child.getWorldPosition(new T.Vector3()).sub(b.getWorldPosition(new T.Vector3())) : new T.Vector3(0, -1, 0);
      let axis = new T.Vector3().crossVectors(seg.normalize(), Z);if (axis.lengthSq() < 1e-4) axis = new T.Vector3(1, 0, 0);if (id === 'spine') axis = new T.Vector3(0, 1, 0);
      return {b, axis: axis.normalize(), rest: b.quaternion.clone(), max: id === 'spine' ? .6 : id === 'tail' ? .5 : 1.1};});
  }
  function startFlex(id) {stopFlex(false);E.setPlaying(false);E.enterRigRest();G.flex = {id, set: bendSet(collectBones(E.model), id), t0: performance.now()};syncGizmo();render();}
  function stopFlex(doRender = true) {if (!G.flex) return;G.flex = null;E.enterRigRest();syncGizmo();if (doRender) render();}
  function animateBends(set, k) {
    for (const s of set) {const pw = s.b.parent.getWorldQuaternion(new T.Quaternion()), bw = pw.clone().multiply(s.rest), r = new T.Quaternion().setFromAxisAngle(s.axis, s.max * k);
      s.b.quaternion.copy(pw.invert().multiply(r.multiply(bw)));}
  }
  E.on('tick', () => {
    const k = t0 => (1 - Math.cos((performance.now() - t0) / 1000 * Math.PI)) / 2;
    if (G.flex) {const set = G.flex.set;if (G.flex.id === 'squat') {/* agachamento: pernas dobram juntas */}animateBends(set, k(G.flex.t0));E.model.updateMatrixWorld(true);}
    if (G.preview) {const bones = collectBones(G.preview.clone);G.preview.set ??= ['elbows', 'knees', 'spine'].flatMap(id => bendSet(bones, id));animateBends(G.preview.set, k(G.preview.t0));}
  });

  // ---------- Exportar e conferir ----------
  async function exportBytes() {stopFlex(false);stopPreview(false);E.setPlaying(false);E.enterRigRest();return E.exportGLB({unlit: false, noTextures: false});}
  async function check() {
    E.setPlaying(false);E.enterRigRest();
    const before = engine.official(), bytes = await exportBytes(), data = await E.parse(new File([bytes], 'conferencia.glb', {type: 'model/gltf-binary'}));
    const after = inspectRig(data.scene, {clips: data.animations}), items = [];
    const ids = t => t.identification.hierarchy.map(h => [h.id, h.name, h.parent]).sort((a, b) => a[0] < b[0] ? -1 : 1);
    items.push({ok: JSON.stringify(ids(after)) === JSON.stringify(ids(before)), text: `ossos, IDs e hierarquia (${after.identification.totalBones})`});
    const pos = t => new Map(t.transforms.bones.map(b => [b.id, b.modelRoot.position]));const pa = pos(before), pb = pos(after);
    const move = Math.max(0, ...[...pa].map(([id, p]) => pb.has(id) ? Math.hypot(...p.map((v, k) => v - pb.get(id)[k])) : 99));
    items.push({ok: move < 1e-3, text: `posições de repouso (maior diferença ${num(move, 5)})`});
    items.push({ok: after.identification.skinnedMeshCount === before.identification.skinnedMeshCount, text: `malhas com skin (${after.identification.skinnedMeshCount})`});
    const zero = t => t.skinning.meshes.reduce((s, m) => s + m.zeroWeightVertices, 0);items.push({ok: zero(after) === zero(before), text: `vértices sem influência (${zero(after)})`});
    items.push({ok: data.animations.length === E.clips.length, text: `animações (${data.animations.length})`});
    G.validation = {ok: items.every(i => i.ok), items, bytes: bytes.byteLength};render();
    return G.validation;
  }
  async function download() {
    const bytes = await exportBytes(), url = URL.createObjectURL(new Blob([bytes], {type: 'model/gltf-binary'})), a = document.createElement('a');
    a.href = url;a.download = (E.model.name || 'personagem').replace(/[^\w.-]+/g, '_') + '.rig.glb';a.click();setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  // ---------- Integração com o Studio ----------
  let markersBefore = null;
  /** No assistente, os marcadores e nomes do painel avançado ficam ocultos (o assistente desenha os seus). */
  function setCodexMarkers() {
    const box = document.getElementById('rg-markers');if (!box) return;
    if (guidedOn()) {if (markersBefore === null) markersBefore = box.checked;if (box.checked) {box.checked = false;box.dispatchEvent(new Event('change'));}}
    else if (markersBefore !== null) {if (box.checked !== markersBefore) {box.checked = markersBefore;box.dispatchEvent(new Event('change'));}markersBefore = null;}
  }
  let wasActive = false, pending = 0;
  const later = () => {if (pending) return;pending = requestAnimationFrame(() => {pending = 0;if (active()) refresh();});};
  E.on('tick', () => {
    const now = active();
    if (now !== wasActive) {wasActive = now;if (!now) {stopFlex(false);stopPreview(false);}setCodexMarkers();refresh();}
    if (now && G.mode === 'guided') {if (gizmo.camera !== E.camera) syncGizmo();if (!gizmo.dragging && G.selected && !G.flex) {const j = joint(G.selected);if (j && gizmo.object) proxy.position.copy(E.model.localToWorld(new T.Vector3(...j.p)));}}
  });
  E.on('rigChanged', r => {if (r !== 'rest') later();});
  E.on('installed', () => {G.selected = null;G.validation = null;G.reviewed = false;G.symmetryAccepted = false;G.profile = null;G.step = 1;stopPreview(false);stopFlex(false);later();});
  engine.subscribe(() => later());
  render();
  window.__studioGuided = {get state() {return {mode: G.mode, step: G.step, selected: G.selected, problems: problems().map(p => ({id: p.j.id, name: p.j.name, reasons: p.reasons})), validation: G.validation, preview: G.preview ? {weights: G.preview.weights, zero: G.preview.zero} : null, flex: G.flex?.id || null};},
    goto, select, refresh, check, setMode: m => {G.mode = m;setCodexMarkers();render();}, get gizmo() {return gizmo;}, get proxy() {return proxy;}, commitDrag};
}
