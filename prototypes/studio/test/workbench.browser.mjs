// Rigging Telemetry Workbench no Studio real (Edge, offline), sobre a API OFICIAL de rigging (56b01a5):
// telemetria inspectRig, patch canônico (validatePatch/simulateRigPatch/applyRigPatch), auto-rig oficial.
// Interações reais: cliques e teclado do Playwright, clique no visualizador 3D, área de transferência e download.
// Sem substituir requestAnimationFrame nem devicePixelRatio. WebGL em SwiftShader, como no executor do CI.
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
const root = fileURLToPath(new URL('../', import.meta.url)), out = root + 'validation/';
await mkdir(out, {recursive: true});
let count = 0, t0 = Date.now();const mark = s => {count++;console.log(`✓ ${s} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);t0 = Date.now();};
const browser = await chromium.launch({channel: 'msedge', headless: true, args: ['--use-angle=swiftshader']});
const errors = [], requests = [], evidence = {};
try {
  const context = await browser.newContext({viewport: {width: 1500, height: 940}, acceptDownloads: true});
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage();
  page.on('dialog', d => d.accept());page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});page.on('request', r => {if (/^https?:/i.test(r.url())) requests.push(r.url());});
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(root + 'dist/arenamon-animation-studio.html').href);
  await page.waitForFunction(() => window.__studioWorkbench && window.__studioRig && window.__importer, null, {timeout: 60000});
  const W = (fn, arg) => page.evaluate(fn, arg);
  const state = () => W(() => {const s = window.__studioWorkbench.panel.state;return {step: s.step, selected: s.selected, checked: s.checked, applied: s.applied, ok: s.validation?.ok, t: s.telemetry && {summary: s.telemetry.summary, state: s.telemetry.model.state, joints: s.telemetry.joints.map(j => ({id: j.id, name: j.name, p: j.p, parent: j.parent, sym: j.symmetry?.asymmetryDelta ?? null}))}};});
  const jointBy = (s, name) => s.t.joints.find(j => j.name === name);
  const fp = () => W(() => window.__studioWorkbench.fingerprint()), undoLabel = () => W(() => window.__studioEditor.history.state().undoLabel);
  const waitState = st => page.waitForFunction(x => window.__studioWorkbench.panel.state.telemetry?.model.state === x, st, {timeout: 30000});

  // ---------- Estado vazio e demonstração sintética ----------
  await page.click('[data-panel="workbench"]');assert.match(await page.textContent('[data-panel-step="inspect"]'), /Nenhum modelo/);
  await page.click('#wb-demo');await waitState('vinculado');
  const demo = await W(() => window.__studioWorkbench.panel.state.telemetry.summary);assert.equal(demo.bones, 20);assert.equal(demo.meshes, 6);assert.equal(demo.orphanTracks, 1);
  mark('Estado vazio com “Carregar demonstração”: personagem sintético, telemetria pela API oficial');

  // ---------- Personagem montado pelos botões reais da aba Rigging ----------
  await W(async () => {
    const E = window.__importer, T = E.T, root = new T.Group();root.name = 'WorkbenchCharacter';
    for (const [name, w, h, d, x, y] of [['Torso', .9, 1, .5, 0, 1.45], ['Head', .45, .45, .45, 0, 2.2], ['ArmLeft', .9, .22, .22, .9, 1.8], ['ArmRight', .9, .22, .22, -.9, 1.8], ['LegLeft', .28, .95, .28, .22, .5], ['LegRight', .28, .95, .28, -.22, .5]]) {
      const m = new T.Mesh(new T.BoxGeometry(w, h, d, 3, 6, 3), new T.MeshStandardMaterial({color: 0x7890c8}));m.name = name;m.position.set(x, y, 0);root.add(m);
    }
    await E.install(root, [], 'workbench-character.glb');
  });
  await page.click('[data-panel="rigging"]');await page.waitForFunction(() => window.__studioRig.active);
  await page.click('#rg-template');await page.uncheck('#rg-mirror');
  await W(() => {const r = window.__studioRig, j = r.draft.joints.find(x => x.name === 'RightElbow');r.applyJoint('RightElbow', [j.p[0] - .06, j.p[1] + .12, j.p[2]]);});
  await page.click('#rg-bind');await page.waitForFunction(() => {let s = false;window.__importer.model.traverse(o => {if (o.isSkinnedMesh) s = true;});return s;});
  await W(() => {const E = window.__importer, T = E.T, q = a => new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), a).toArray();
    E.addClip(new T.AnimationClip('Teste · cabeça e cauda', 1, [new T.QuaternionKeyframeTrack('Head.quaternion', [0, .5, 1], [...q(0), ...q(.4), ...q(0)]), new T.QuaternionKeyframeTrack('TailMissing.quaternion', [0, 1], [...q(0), ...q(.2)])]), {select: true});});
  mark('Personagem com 6 malhas independentes: template, assimetria e skin feitos pela aba Rigging');

  // ---------- Inspecionar ----------
  await page.click('[data-panel="workbench"]');await page.waitForFunction(() => window.__studioWorkbench.active && window.__studioWorkbench.panel.state.telemetry?.model.state === 'vinculado' && window.__studioWorkbench.panel.state.telemetry.summary.orphanTracks === 1);
  let s = await state();
  assert.equal(s.t.summary.bones, 20);assert.equal(s.t.summary.meshes, 6);
  const official = await W(() => window.__studioRig.inspectRig());
  assert.equal(s.t.summary.warnings, official.metrics.warningCount, 'contagem de avisos = inspectRig oficial');assert.equal(s.t.summary.maxAsymmetry, official.consistency.symmetry.maxAsymmetryDelta);
  assert.match(await page.textContent('[data-metric="Trilhas órfãs"]'), /1/);assert.match(await page.textContent('#wb-state'), /Rig vinculado/);
  assert.equal(await W(() => window.__importer.playing), false, 'a aba pausa a animação na pose de repouso');
  await W(() => window.__importer.setPlaying(true));await page.waitForFunction(() => !window.__importer.playing);
  await page.screenshot({path: out + 'workbench-painel-padrao.png'});
  mark('Visão geral = inspectRig oficial (20 ossos, 6 malhas, avisos, assimetria máxima, 1 trilha órfã)');
  await page.click('[data-joint] >> text=LeftElbow');
  s = await state();const left = jointBy(s, 'LeftElbow');assert.equal(s.selected, left.id);
  assert.equal(await W(() => window.__studioRig.selectedId), left.id, 'seleção sincronizada com a aba Rigging');
  const detail = await page.textContent('[data-panel-step="inspect"]');assert.ok(detail.includes(left.id) && detail.includes('LeftShoulder') && /assimetria 0\.134/.test(detail), 'detalhe completo do osso');
  await page.click('#wb-wide');await page.waitForTimeout(250);await page.screenshot({path: out + 'workbench-inspecionar.png'});
  assert.equal(await W(() => window.__studioLayout.rightOpen), false, 'ampliar fecha a biblioteca');
  await page.click('#wb-wide');await page.waitForTimeout(250);assert.equal(await W(() => window.__studioLayout.rightOpen), true);
  await page.focus('[data-joint].selected');await page.keyboard.press('ArrowDown');assert.equal((await state()).selected, jointBy(s, 'LeftWrist').id);
  await page.keyboard.press('ArrowUp');assert.equal((await state()).selected, left.id);
  await page.keyboard.press('Space');assert.deepEqual((await state()).checked, [left.id]);
  const headId = jointBy(s, 'Head').id, pt = await W(id => window.__studioWorkbench.viewer.screenPoint(id), headId);assert.ok(pt);
  await page.mouse.click(pt.x, pt.y);await page.waitForFunction(id => window.__studioWorkbench.panel.state.selected === id, headId);
  await page.check('[data-layer="heatmap"]');assert.equal(await W(() => window.__studioWorkbench.viewer.heatmapActive), true);
  const heat = await W(() => {let max = 0;window.__importer.model.traverse(o => {if (o.isSkinnedMesh && o.material.userData.workbenchHeat) {const c = o.geometry.getAttribute('color');for (let i = 0; i < c.count; i++) max = Math.max(max, c.getX(i));}});return max;});
  assert.ok(heat > .5, 'heatmap usa os pesos reais');await page.check('[data-layer="symmetry"]');await page.waitForTimeout(150);await page.screenshot({path: out + 'workbench-heatmap.png'});
  await page.uncheck('[data-layer="heatmap"]');await page.uncheck('[data-layer="symmetry"]');assert.equal(await W(() => window.__studioWorkbench.viewer.heatmapActive), false, 'materiais restaurados');
  mark('Árvore, teclado, clique no visualizador e heatmap real funcionam sobre a telemetria oficial');

  // ---------- Diagnosticar: o JSON copiado é o objeto oficial ----------
  await page.click('[data-step="diagnose"]');
  await page.click('#wb-copy-json');const copied = JSON.parse(await W(() => navigator.clipboard.readText()));
  assert.equal(copied.schema, 'arenamon-rig-telemetry');assert.equal(copied.identification.totalBones, 20);
  const live = await W(() => window.__studioRig.inspectRig());assert.deepEqual(copied.transforms.bones.map(b => [b.id, b.modelRoot.position]), live.transforms.bones.map(b => [b.id, b.modelRoot.position]));
  await page.click('#wb-copy-sel');const sel = JSON.parse(await W(() => navigator.clipboard.readText()));assert.deepEqual(sel.identification.hierarchy.map(h => h.name), ['LeftElbow']);
  await page.click('#wb-copy-ai');const ai = await W(() => navigator.clipboard.readText());assert.match(ai, /"operations"/);assert.doesNotMatch(ai, /"ops":\[/);assert.match(ai, /"arenamon-rig-telemetry"/);
  const dl = page.waitForEvent('download');await page.click('#wb-export');const file = JSON.parse(await readFile(await (await dl).path(), 'utf8'));
  assert.equal(file.identification.totalBones, 20);assert.deepEqual(file.metrics.warnings, live.metrics.warnings);await writeFile(out + 'workbench-telemetria.json', JSON.stringify(file, null, 2));
  mark('Copiar/exportar entregam a telemetria oficial (inspectRig) e o pacote para IA pede o patch canônico');

  // ---------- Corrigir: rejeições com caminho e motivo ----------
  await page.click('[data-step="fix"]');
  const tryPatch = async text => {await page.fill('#wb-patch', text);await page.focus('#wb-patch');await page.keyboard.press('Control+Enter');return (await page.locator('#wb-invalid, #wb-valid').first().textContent());};
  const P = (operations, extra = {}) => JSON.stringify({schema: 'arenamon-rig-patch', version: 1, ...extra, operations}, null, 2);
  assert.match(await tryPatch(P([{op: 'setBonePosition', jointId: 'Head', position: [0, 'x', 0]}])), /operations\[0\]\.position/);
  assert.match(await tryPatch('{"schema": "arenamon-rig-patch", "operations": ['), /JSON inválido/);
  assert.match(await tryPatch(P([{op: 'deleteBone', jointId: 'RightFoot'}])), /Não aplicável hoje[\s\S]*skinIndex/);
  assert.match(await tryPatch(P([{op: 'reparentBone', jointId: 'Hips', newParentJointId: 'Head'}])), /hierarquia[\s\S]*Ciclo/);
  assert.match(await tryPatch(P([{op: 'mirrorBone', jointId: 'Fantasma'}])), /simulateRigPatch[\s\S]*Fantasma/);
  assert.equal(await page.isDisabled('#wb-to-compare'), true);
  mark('Rejeições: campo com caminho, JSON, limite comprovado (deleteBone), ciclo e osso inexistente (simulateRigPatch)');

  // ---------- Comparar: não modifica permanentemente o modelo ----------
  const patch = P([{op: 'mirrorBone', jointId: left.id, note: 'o cotovelo direito está 0,13 fora do espelho'}, {op: 'renameJoint', jointId: headId, newName: 'HeadMain'}], {description: 'Simetria do cotovelo e nome da cabeça'});
  const before = await state(), fpBefore = await fp(), labelBefore = await undoLabel();
  assert.match(await tryPatch(patch), /Patch válido para a API oficial/);
  await page.click('#wb-to-compare');await page.waitForSelector('#wb-changes');
  const changes = await page.textContent('#wb-changes');assert.ok(changes.includes('RightElbow') && /0\.134/.test(changes) && changes.includes('Head → HeadMain'), changes);
  assert.match(await page.textContent('#wb-dry-ok'), /desfeito/);
  assert.equal(await fp(), fpBefore, 'ensaio: ossos, pesos, matrizes de bind e metadados idênticos');assert.equal(await undoLabel(), labelBefore, 'ensaio não entra no histórico');
  await page.screenshot({path: out + 'workbench-comparar.png'});
  await page.click('#wb-cancel');assert.equal(await fp(), fpBefore);assert.deepEqual((await state()).t.joints, before.t.joints);
  await page.click('[data-panel="rigging"]');await page.waitForFunction(() => window.__studioRig.active);await page.click('[data-panel="workbench"]');await page.waitForFunction(() => window.__studioWorkbench.active);
  assert.equal(await fp(), fpBefore, 'trocar de aba (enterRigRest) depois do ensaio não revela mudança');
  mark('Comparar: ensaio real com applyRigPatch mostra RightElbow (0,134) e Head → HeadMain; modelo idêntico depois, inclusive após trocar de aba');

  // ---------- Aplicar: uma transação; Undo/Redo restauram ossos, pesos e metadados ----------
  await page.click('[data-step="fix"]');await tryPatch(patch);await page.click('#wb-to-compare');await page.waitForSelector('#wb-apply');await page.click('#wb-apply');
  await page.waitForSelector('#wb-applied');const applied = await state(), fpApplied = await fp();
  assert.ok(jointBy(applied, 'LeftElbow').sym < 1e-4, 'assimetria corrigida (telemetria nova)');assert.equal(jointBy(applied, 'HeadMain').id, headId, 'ID persistente mantido');
  assert.match(await undoLabel(), /^Rig Patch: Simetria do cotovelo/);
  await page.click('[data-panel="rigging"]');await page.waitForFunction(() => window.__studioRig.active);await page.click('[data-panel="workbench"]');await page.waitForFunction(() => window.__studioWorkbench.active);
  assert.equal(await fp(), fpApplied, 'enterRigRest (troca de aba) mantém a correção: mapa de repouso do Studio sincronizado');
  await page.click('[data-step="apply"]');await page.click('#wb-undo');
  assert.equal(await fp(), fpBefore, 'um Desfazer restaura ossos, pesos, matrizes e metadados exatamente');assert.equal(await undoLabel(), labelBefore, 'o patch inteiro era uma única entrada');
  assert.deepEqual((await state()).t.joints, before.t.joints);
  await page.click('#wb-redo');assert.equal(await fp(), fpApplied, 'Refazer reaplica exatamente');
  const settle = expected => page.waitForFunction(e => window.__studioWorkbench.fingerprint() === e, expected);
  await page.locator('canvas').first().click({position: {x: 5, y: 5}});await page.keyboard.press('Control+z');await settle(fpBefore);assert.equal(await undoLabel(), labelBefore);
  await page.keyboard.press('Control+y');await settle(fpApplied);
  mark('Aplicar: uma entrada no histórico; Desfazer/Refazer (botões e Ctrl+Z/Y) restauram ossos, pesos, matrizes e metadados bit a bit');
  await page.click('[data-step="validate"]');const metricDiff = await page.textContent('[data-panel-step="validate"]');
  assert.ok(/LeftElbow ↔ RightElbow[\s\S]*0\.134[\s\S]*→ 0/.test(metricDiff), 'validação mostra a assimetria antes → depois');
  mark('Validar: nova telemetria oficial comparada à anterior (assimetria 0,134 → 0)');

  // ---------- GLB exportado e reimportado ----------
  const glb = await W(async () => {
    const E = window.__importer, before = window.__studioWorkbench.engine.telemetry(), bytes = await E.exportGLB({unlit: false, noTextures: false});
    const data = await E.parse(new File([bytes], 'workbench.glb', {type: 'model/gltf-binary'}));await E.install(data.scene, data.animations, 'workbench.glb');
    await new Promise(r => setTimeout(r, 300));const after = window.__studioWorkbench.engine.telemetry();
    return {before: before.joints.map(j => [j.id, j.name, j.parent]), after: after.joints.map(j => [j.id, j.name, j.parent]),
      maxMove: Math.max(...after.joints.map(j => {const b = before.joints.find(x => x.id === j.id);return b ? Math.hypot(...j.p.map((v, k) => v - b.p[k])) : 99;})), state: after.model.state, sym: after.joints.find(j => j.name === 'LeftElbow').symmetry.asymmetryDelta};
  });
  assert.deepEqual(glb.after, glb.before, 'IDs, nomes e hierarquia preservados no GLB');assert.ok(glb.maxMove < 1e-4, 'posições: ' + glb.maxMove);assert.equal(glb.state, 'vinculado');assert.ok(glb.sym < 1e-4);
  mark('GLB exportado e reimportado: IDs persistentes, nomes, hierarquia, posições e skin preservados');

  // ---------- Patch anterior (ops) estrutural: migração explícita, criar e reparentar ----------
  await W(() => window.__studioLayout.open('workbench'));await waitState('vinculado');await page.click('[data-step="fix"]');
  const ids = await W(() => Object.fromEntries(window.__studioWorkbench.panel.state.telemetry.joints.map(j => [j.name, j.id])));
  const elbowBefore = jointBy(await state(), 'LeftElbow').p, fpStruct = await fp(), labelStruct = await undoLabel();
  const legacy = JSON.stringify({schema: 'arenamon-rig-patch', version: 1, space: 'model-root', ops: [{op: 'addJoint', name: 'HeadTop', parent: ids.HeadMain, p: [0, 2.42, 0]}, {op: 'reparent', joint: ids.LeftClavicle, parent: ids.Neck}]});
  assert.match(await tryPatch(legacy), /Patch válido/);
  const report = await page.textContent('#wb-migration');assert.ok(/ops\[0\] addJoint[\s\S]*createBone[\s\S]*setBonePosition/.test(report) && /ops\[1\] reparent[\s\S]*reparentBone/.test(report), report);
  await page.click('#wb-to-compare');await page.waitForSelector('#wb-apply');
  const sText = await page.textContent('#wb-changes');assert.ok(sText.includes('HeadTop') && sText.includes('novo') && /pai: Spine → Neck/.test(sText), sText);
  await page.click('#wb-apply');await page.waitForSelector('#wb-applied');let st = await state();
  assert.equal(jointBy(st, 'HeadTop').parent, 'HeadMain');assert.ok(Math.hypot(...jointBy(st, 'HeadTop').p.map((v, k) => v - [0, 2.42, 0][k])) < 1e-4, 'osso novo na posição (raiz) pedida');
  assert.equal(jointBy(st, 'LeftClavicle').parent, 'Neck');assert.ok(Math.hypot(...jointBy(st, 'LeftElbow').p.map((v, k) => v - elbowBefore[k])) < 1e-4, 'reparent migrado preserva a cadeia');
  await page.click('#wb-undo');assert.equal(await fp(), fpStruct, 'desfazer o patch estrutural restaura exatamente');assert.equal(await undoLabel(), labelStruct);
  await page.click('[data-step="fix"]');await page.fill('#wb-patch', legacy);await page.click('#wb-validate');await page.click('#wb-use-migrated');
  assert.match(await page.inputValue('#wb-patch'), /"operations"/);assert.doesNotMatch(await page.inputValue('#wb-patch'), /"ops"/);
  mark('Patch anterior (ops) migrado explicitamente com relatório; criar + reparentar aplicados como uma transação e desfeitos exatamente');

  // ---------- Auto-rig humanoide: proposta → trava → marcos → patch → prévia de pesos → bind → desfazer ----------
  await W(async () => {
    const E = window.__importer, T = E.T, root = new T.Group();root.name = 'HumanoideSemRig';
    for (const [name, w, h, d, x, y] of [['Corpo', .9, 1, .5, 0, 1.45], ['Cabeca', .45, .45, .45, 0, 2.2], ['Bracos', 2.6, .22, .22, 0, 1.8], ['Pernas', .7, .95, .28, 0, .5]]) {
      const m = new T.Mesh(new T.BoxGeometry(w, h, d, 4, 6, 3), new T.MeshStandardMaterial({color: 0x9a8acb}));m.name = name;m.position.set(x, y, 0);root.add(m);
    }
    await E.install(root, [], 'humanoide-sem-rig.glb');
  });
  await W(() => window.__studioLayout.open('workbench'));await waitState('sem-rig');
  await page.click('[data-step="fix"]');
  assert.deepEqual(await W(() => [...document.querySelectorAll('#wb-profile option')].map(o => [o.value, o.disabled])), [['humanoid-20', false], ['quadruped-24', false], ['quadruped-27', false]], 'perfis habilitados');
  assert.equal(await page.isDisabled('#wb-auto-bind'), true);
  await page.selectOption('#wb-profile', 'humanoid-20');await page.click('#wb-auto-template');await waitState('proposta');
  let pr = await state();assert.equal(pr.t.summary.bones, 20);assert.match(await page.textContent('[data-panel-step="fix"]'), /confiança por região[\s\S]*head 0\.9/);
  await page.click('[data-step="inspect"]');await page.click('[data-joint] >> text=Head');await page.click('#wb-lock');
  assert.deepEqual(await W(() => window.__studioWorkbench.engine.autoRig.locked), [jointBy(pr, 'Head').id]);
  await page.click('[data-step="fix"]');assert.equal(await page.textContent('#wb-locked-count'), '1');
  await page.click('#wb-auto-fit');await page.waitForFunction(() => /Ajustar aos marcos/.test(window.__studioEditor.history.state().undoLabel));
  let fitted = await state();assert.deepEqual(jointBy(fitted, 'Head').p, jointBy(pr, 'Head').p, 'Head travado não se move');
  assert.notDeepEqual(jointBy(fitted, 'Neck').p, jointBy(pr, 'Neck').p, 'Neck destravado é ajustado ao marco');
  assert.match(await tryPatch(P([{op: 'moveBone', jointId: jointBy(pr, 'Head').id, delta: [0, .1, 0]}])), /travado/);
  const elbowP = jointBy(fitted, 'LeftElbow').p;
  assert.match(await tryPatch(P([{op: 'setBonePosition', jointId: jointBy(pr, 'LeftElbow').id, position: [elbowP[0] + .05, elbowP[1], elbowP[2]]}])), /Patch válido/);
  await page.click('#wb-to-compare');await page.waitForSelector('#wb-bind-preview');await page.click('#wb-bind-preview');
  assert.match(await page.textContent('#wb-bind-result'), /LeftElbow|Sem diferença/);
  await page.click('#wb-apply');await page.waitForSelector('#wb-applied');
  assert.ok(Math.abs(jointBy(await state(), 'LeftElbow').p[0] - (elbowP[0] + .05)) < 1e-9, 'patch aplicado à proposta');
  await page.click('[data-step="fix"]');await page.click('#wb-auto-bind');await waitState('vinculado');
  const bound = await state();assert.equal(bound.t.summary.skinnedMeshes, 4);assert.equal(bound.t.summary.bones, 20);assert.equal(bound.t.summary.verticesWithoutInfluence, 0);
  assert.equal(await page.isDisabled('#wb-auto-test'), false);
  await page.locator('canvas').first().click({position: {x: 5, y: 5}});await page.keyboard.press('Control+z');await waitState('proposta');
  assert.equal(await W(() => {let n = 0;window.__importer.model.traverse(o => {if (o.isSkinnedMesh) n++;});return n;}), 0, 'desfazer o bind devolve as malhas originais');
  await page.keyboard.press('Control+y');await waitState('vinculado');
  await page.screenshot({path: out + 'workbench-autorig-humanoide.png'});
  mark('Auto-rig humanoide pela interface: proposta, trava, marcos, patch, prévia de pesos, bind sem vértices sem peso, Ctrl+Z/Ctrl+Y');

  // ---------- Auto-rig quadrúpede (24 e 27): proposta → regenerar cauda → bind ----------
  await W(async () => {
    const E = window.__importer, T = E.T, root = new T.Group();root.name = 'QuadrupedeSemRig';
    for (const [name, w, h, d, x, y, z] of [['Tronco', .6, .5, 1.6, 0, 1.0, 0], ['Cabeca', .4, .4, .5, 0, 1.35, 1.0], ['PataDF', .18, .8, .18, .2, .4, .6], ['PataEF', .18, .8, .18, -.2, .4, .6], ['PataDT', .18, .8, .18, .2, .4, -.6], ['PataET', .18, .8, .18, -.2, .4, -.6], ['Cauda', .1, .1, .6, 0, 1.1, -1.1]]) {
      const m = new T.Mesh(new T.BoxGeometry(w, h, d, 3, 4, 4), new T.MeshStandardMaterial({color: 0xb08a5a}));m.name = name;m.position.set(x, y, z);root.add(m);
    }
    await E.install(root, [], 'quadrupede-sem-rig.glb');
  });
  await W(() => window.__studioLayout.open('workbench'));await waitState('sem-rig');await page.click('[data-step="fix"]');
  for (const [profile, bones] of [['quadruped-24', 24], ['quadruped-27', 27]]) {
    await page.selectOption('#wb-profile', profile);await page.click('#wb-auto-template');
    await page.waitForFunction(n => window.__studioWorkbench.panel.state.telemetry?.model.state === 'proposta' && window.__studioWorkbench.panel.state.telemetry.summary.bones === n, bones);
    const tails = (await state()).t.joints.filter(j => j.name.startsWith('Tail'));assert.ok(tails.length >= 3, profile + ': cauda gerada');
    await page.selectOption('#wb-region', 'tail');await page.click('#wb-auto-regen');
    await page.waitForFunction(() => /Regenerar região/.test(window.__studioEditor.history.state().undoLabel));
    const regen = await state(), newTails = regen.t.joints.filter(j => j.name.startsWith('Tail'));
    assert.equal(newTails.length, 3, 'regenerateRegion recria 3 ossos de cauda');assert.notDeepEqual(newTails.map(j => j.id), tails.map(j => j.id));
    assert.equal(await W(() => document.querySelector('#wb-region option[value="leftArm"]').disabled), true, 'regiões não implementadas ficam desabilitadas');
    await page.click('#wb-auto-bind');await waitState('vinculado');
    const qb = await state();assert.equal(qb.t.summary.bones, regen.t.summary.bones);assert.equal(qb.t.summary.skinnedMeshes, 7);assert.equal(qb.t.summary.verticesWithoutInfluence, 0, profile + ': todos os vértices com peso');
    if (profile === 'quadruped-24') {
      await page.click('[data-step="apply"]');await page.click('#wb-undo');await waitState('proposta');
      await page.click('[data-step="fix"]');await page.click('#wb-auto-discard');await waitState('sem-rig');
    }
    evidence[profile] = {bones: qb.t.summary.bones, skinnedMeshes: qb.t.summary.skinnedMeshes, verticesWithoutInfluence: qb.t.summary.verticesWithoutInfluence};
  }
  await page.screenshot({path: out + 'workbench-autorig-quadrupede.png'});
  mark('Auto-rig quadrúpede 24 e 27 pela interface: proposta, regenerar cauda, bind sem vértices sem peso, desfazer e descartar');

  // ---------- Evidência: o wrapper oficial __studioRig.applyPatch não persiste nem entra no histórico ----------
  const wrapper = await W(() => {
    const R = window.__studioRig, E = window.__importer, H = window.__studioEditor.history, wb = window.__studioWorkbench, head = R.inspectRig().transforms.bones.find(b => b.name === 'Head');
    const label = H.state().undoLabel, f0 = wb.fingerprint(), res = R.applyPatch({schema: 'arenamon-rig-patch', version: 1, operations: [{op: 'moveBone', jointId: head.id, delta: [0, .1, 0]}]});
    const after = R.inspectRig().transforms.bones.find(b => b.name === 'Head').modelRoot.position, f1 = JSON.parse(wb.fingerprint()), b0 = JSON.parse(f0);
    return {success: res.success, moved: Math.abs(after[1] - head.modelRoot.position[1]) > 1e-6, historyChanged: H.state().undoLabel !== label, bonesSame: JSON.stringify(b0.bones) === JSON.stringify(f1.bones), inversesSame: JSON.stringify(b0.meshes.map(m => m[4])) === JSON.stringify(f1.meshes.map(m => m[4])), hasStudioHistory: typeof window.__studioHistory};
  });
  evidence.studioRigApplyPatch = wrapper;
  assert.equal(wrapper.success, true);assert.equal(wrapper.historyChanged, true, 'corrigido em 249e34b: a aplicação entra no histórico');assert.equal(wrapper.moved, false, 'ainda em 249e34b: num rig vinculado a mudança some (prepareRig → enterRigRest sem commitRig)');
  await W(() => window.__studioEditor.history.undo());
  mark(`Wrapper oficial (249e34b): entra no histórico, mas num rig vinculado o osso não muda; matrizes de bind ${wrapper.inversesSame ? 'iguais' : 'recalculadas na pose descartada'}`);

  // ---------- Tela pequena ----------
  await page.setViewportSize({width: 390, height: 844});await W(() => window.__studioLayout.open('workbench'));await page.waitForTimeout(200);
  const narrow = await W(() => {const r = document.getElementById('wb-root').getBoundingClientRect(), tree = document.getElementById('wb-tree').getBoundingClientRect();return {w: r.width, tree: tree.width, overflow: document.getElementById('wb-root').scrollWidth - document.getElementById('wb-root').clientWidth};});
  assert.ok(narrow.overflow <= 1 && narrow.tree > 200, JSON.stringify(narrow));await page.screenshot({path: out + 'workbench-celular.png'});
  mark('Celular (390 px): árvore em coluna única, sem rolagem horizontal no painel');
  assert.deepEqual(errors, []);assert.deepEqual(requests, []);
  await writeFile(out + 'workbench-browser.json', JSON.stringify({tests: count, errors, requests, evidence}, null, 2));
  console.log(`\nWorkbench: ${count} verificações de navegador aprovadas (API oficial de rigging).`);
} finally {await browser.close();}
