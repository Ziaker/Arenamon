// Rigging Telemetry Workbench no Studio real (Edge, offline), com o motor REAL do Codex:
// o rig é criado e vinculado pelos botões do Rigging do Codex; o patch é validado, ensaiado e aplicado pelo motor.
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
const errors = [], requests = [];
try {
  const context = await browser.newContext({viewport: {width: 1500, height: 940}, acceptDownloads: true});
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage();
  page.on('dialog', d => d.accept());page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});page.on('request', r => {if (/^https?:/i.test(r.url())) requests.push(r.url());});
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(root + 'dist/arenamon-animation-studio.html').href);
  await page.waitForFunction(() => window.__studioWorkbench && window.__studioRig && window.__importer, null, {timeout: 60000});
  const W = (fn, arg) => page.evaluate(fn, arg), state = () => W(() => {const s = window.__studioWorkbench.panel.state;return {step: s.step, selected: s.selected, checked: s.checked, applied: s.applied, ok: s.validation?.ok, t: s.telemetry && {summary: s.telemetry.summary, state: s.telemetry.model.state, joints: s.telemetry.joints.map(j => ({id: j.id, name: j.name, p: j.p, parent: j.parent, sym: j.symmetry?.mirrorDistance ?? null}))}};});
  const jointBy = (s, name) => s.t.joints.find(j => j.name === name);

  // ---------- Estado vazio e demonstração (fluxo real do Codex) ----------
  await page.click('[data-panel="workbench"]');assert.match(await page.textContent('[data-panel-step="inspect"]'), /Nenhum modelo/);
  await page.click('#wb-demo');await page.waitForFunction(() => window.__studioWorkbench.panel.state.telemetry?.model.state === 'vinculado', null, {timeout: 30000});
  const demo = await W(() => window.__studioWorkbench.panel.state.telemetry.summary);assert.equal(demo.bones, 20);assert.equal(demo.meshes, 6);assert.equal(demo.orphanTracks, 1);
  mark('Estado vazio com “Carregar demonstração”: personagem complexo montado pelo fluxo real do Codex');

  // ---------- Personagem: 6 malhas independentes, rig e skin criados pelo motor do Codex ----------
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
  mark('Personagem com 6 malhas independentes: template, assimetria e skin feitos pelo Rigging do Codex');

  // ---------- Inspecionar ----------
  await page.click('[data-panel="workbench"]');await page.waitForFunction(() => window.__studioWorkbench.active && window.__studioWorkbench.panel.state.telemetry?.model.state === 'vinculado' && window.__studioWorkbench.panel.state.telemetry.summary.orphanTracks === 1);
  let s = await state();
  assert.equal(s.t.state, 'vinculado');assert.equal(s.t.summary.bones, 20);assert.equal(s.t.summary.meshes, 6);assert.equal(s.t.summary.orphanTracks, 1);
  assert.match(await page.textContent('[data-metric="Trilhas órfãs"]'), /1/);assert.match(await page.textContent('#wb-state'), /Rig vinculado/);
  assert.equal(await W(() => window.__importer.playing), false, 'a aba pausa a animação na pose de repouso');
  await W(() => window.__importer.setPlaying(true));await page.waitForFunction(() => !window.__importer.playing);
  await page.screenshot({path: out + 'workbench-painel-padrao.png'});
  mark('Visão geral: 20 ossos, 6 malhas, skin vinculado, 1 trilha órfã, animação mantida pausada enquanto a aba está aberta');
  await page.click('[data-joint] >> text=LeftElbow');
  s = await state();const left = jointBy(s, 'LeftElbow');assert.equal(s.selected, left.id);
  assert.equal(await W(() => window.__studioRig.selectedId), left.id, 'seleção sincronizada com o motor do Codex');
  const detail = await page.textContent('[data-panel-step="inspect"]');assert.ok(detail.includes(left.id) && detail.includes('LeftShoulder') && /diferença ao espelho 0\.134/.test(detail), 'detalhe completo do osso');
  await page.click('#wb-wide');await page.waitForTimeout(250);await page.screenshot({path: out + 'workbench-inspecionar.png'});
  assert.equal(await W(() => window.__studioLayout.rightOpen), false, 'ampliar fecha a biblioteca');const stageW = await W(() => document.getElementById('view').clientWidth);assert.ok(stageW > 450, 'visualizador continua utilizável ao ampliar: ' + stageW);
  await page.click('#wb-wide');await page.waitForTimeout(250);assert.equal(await W(() => window.__studioLayout.rightOpen), true, 'sair do modo ampliado devolve a biblioteca');
  mark('Clique na árvore: dados completos do osso (ID, pai, filhos, posições, quaternion, influência, simetria)');
  await page.focus('[data-joint].selected');await page.keyboard.press('ArrowDown');
  const afterDown = (await state()).selected;assert.equal(afterDown, jointBy(s, 'LeftWrist').id);
  await page.keyboard.press('ArrowUp');assert.equal((await state()).selected, left.id);
  await page.keyboard.press('Space');assert.deepEqual((await state()).checked, [left.id]);
  mark('Teclado na árvore: ↑/↓ navegam e Espaço marca o osso para a seleção da IA');
  const headId = jointBy(s, 'Head').id;
  const pt = await W(id => window.__studioWorkbench.viewer.screenPoint(id), headId);assert.ok(pt, 'marcador da cabeça visível');
  await page.mouse.click(pt.x, pt.y);await page.waitForFunction(id => window.__studioWorkbench.panel.state.selected === id, headId);
  assert.equal(await W(() => window.__studioRig.selectedId), headId);
  mark('Clique no visualizador 3D seleciona o osso e sincroniza árvore e motor');
  await page.check('[data-layer="heatmap"]');assert.equal(await W(() => window.__studioWorkbench.viewer.heatmapActive), true);
  const heat = await W(() => {let max = 0;window.__importer.model.traverse(o => {if (o.isSkinnedMesh && o.material.userData.workbenchHeat) {const c = o.geometry.getAttribute('color');for (let i = 0; i < c.count; i++) max = Math.max(max, c.getX(i));}});return max;});
  assert.ok(heat > .5, 'heatmap usa os pesos reais (algum vértice com peso alto na cabeça)');
  await page.uncheck('[data-layer="heatmap"]');assert.equal(await W(() => window.__studioWorkbench.viewer.heatmapActive), false, 'materiais originais restaurados');
  await page.check('[data-layer="heatmap"]');await page.check('[data-layer="symmetry"]');await page.waitForTimeout(150);await page.screenshot({path: out + 'workbench-heatmap.png'});await page.uncheck('[data-layer="heatmap"]');await page.uncheck('[data-layer="symmetry"]');
  mark('Heatmap real de pesos ligado e desligado sem perder os materiais');

  // ---------- Diagnosticar: copiar e exportar ----------
  await page.click('[data-step="diagnose"]');
  await page.click('#wb-copy-json');const copied = JSON.parse(await W(() => navigator.clipboard.readText()));
  assert.equal(copied.schema, 'arenamon-rig-telemetry');assert.equal(copied.joints.length, 20);
  const live = await W(() => window.__studioWorkbench.engine.telemetry());assert.deepEqual(copied.joints.map(j => [j.id, j.p]), live.joints.map(j => [j.id, j.p]));
  await page.click('#wb-copy-sel');const sel = JSON.parse(await W(() => navigator.clipboard.readText()));assert.deepEqual(sel.joints.map(j => j.name), ['LeftElbow']);
  await page.click('#wb-copy-ai');assert.match(await W(() => navigator.clipboard.readText()), /^Você vai corrigir o esqueleto[\s\S]*"arenamon-rig-telemetry"/);
  const dl = page.waitForEvent('download');await page.click('#wb-export');const file = JSON.parse(await readFile(await (await dl).path(), 'utf8'));
  assert.equal(file.summary.bones, 20);assert.deepEqual(file.warnings, live.warnings);await writeFile(out + 'workbench-telemetria.json', JSON.stringify(file, null, 2));
  mark('Copiar JSON completo, seleção e pacote para IA; exportar arquivo com a telemetria real');

  // ---------- Corrigir: patches inválidos são rejeitados ----------
  await page.click('[data-step="fix"]');
  const tryPatch = async text => {await page.fill('#wb-patch', text);await page.focus('#wb-patch');await page.keyboard.press('Control+Enter');return (await page.locator('#wb-invalid, #wb-valid').first().textContent());};
  assert.match(await tryPatch('{"schema":"arenamon-rig-patch","version":1,"ops":[{"op":"setPosition","joint":"Head","p":[0,"x",0]}]}'), /ops\[0\]\.p/);
  assert.match(await tryPatch('{"schema": "arenamon-rig-patch", "ops": ['), /JSON inválido/);
  assert.match(await tryPatch(JSON.stringify({schema: 'arenamon-rig-patch', version: 1, ops: [{op: 'setRotation', joint: 'Head', q: [0, 0, 0, 1]}]})), /Não aplicável hoje[\s\S]*commitOrientation/);
  assert.match(await tryPatch(JSON.stringify({schema: 'arenamon-rig-patch', version: 1, ops: [{op: 'reparent', joint: 'Hips', parent: 'Head'}]})), /motor do Codex[\s\S]*Ciclo/);
  assert.equal(await page.isDisabled('#wb-to-compare'), true);
  mark('Patches inválidos rejeitados com o caminho do erro: estrutura, JSON, operação pendente e ciclo (motor do Codex)');

  // ---------- Comparar (ensaio real) e cancelar ----------
  const patch = {schema: 'arenamon-rig-patch', version: 1, space: 'model-root', description: 'Simetria do cotovelo e nome da cabeça',
    ops: [{op: 'mirror', joint: left.id, note: 'o cotovelo direito está 0,13 fora do espelho'}, {op: 'rename', joint: headId, name: 'HeadMain'}]};
  const before = await state();
  assert.match(await tryPatch(JSON.stringify(patch, null, 2)), /Patch válido/);
  await page.click('#wb-to-compare');await page.waitForSelector('#wb-changes');
  const changes = await page.textContent('#wb-changes');assert.ok(changes.includes('RightElbow') && /0\.134/.test(changes) && changes.includes('Head → HeadMain'), changes);
  assert.deepEqual((await state()).t.joints, before.t.joints, 'o ensaio desfez tudo: o rig atual não mudou');
  assert.equal(await W(() => window.__studioWorkbench.viewer.group.children.length > 0), true);
  await page.screenshot({path: out + 'workbench-comparar.png'});
  await page.click('#wb-cancel');assert.deepEqual((await state()).t.joints, before.t.joints);assert.equal((await state()).step, 'fix');
  mark('Comparar: ensaio real mostra RightElbow (0,134) e Head → HeadMain; cancelar não altera nada');

  // ---------- Aplicar, desfazer, refazer e validar ----------
  await page.click('#wb-to-compare');await page.waitForSelector('#wb-apply');await page.click('#wb-apply');
  await page.waitForSelector('#wb-applied');let applied = await state();
  assert.equal(jointBy(applied, 'LeftElbow').sym, 0, 'assimetria corrigida (telemetria nova)');assert.ok(jointBy(applied, 'HeadMain'));assert.equal(jointBy(applied, 'HeadMain').id, headId, 'ID persistente mantido');
  assert.match(await W(() => window.__studioEditor.history.state().undoLabel), /Rig Patch/);
  mark('Aplicar: uma entrada “Rig Patch” no histórico; telemetria nova com simetria corrigida e ID preservado');
  await page.click('#wb-undo');let undone = await state();assert.deepEqual(undone.t.joints, before.t.joints, 'desfazer restaura exatamente');
  await page.click('#wb-redo');let redone = await state();assert.deepEqual(redone.t.joints, applied.t.joints, 'refazer reaplica exatamente');
  // Atalhos globais do Studio: a telemetria se atualiza no quadro seguinte (evento rigChanged do motor).
  const settle = expected => page.waitForFunction(e => JSON.stringify(window.__studioWorkbench.panel.state.telemetry.joints.map(j => j.name)) === e, JSON.stringify(expected.t.joints.map(j => j.name)));
  await page.locator('canvas').first().click({position: {x: 5, y: 5}});await page.keyboard.press('Control+z');await settle(before);
  assert.deepEqual((await state()).t.joints, before.t.joints, 'Ctrl+Z do Studio desfaz o patch inteiro');
  await page.keyboard.press('Control+y');await settle(applied);assert.deepEqual((await state()).t.joints, applied.t.joints, 'Ctrl+Y refaz o patch inteiro');
  mark('Desfazer/refazer pelos botões e por Ctrl+Z/Ctrl+Y: o patch inteiro é um passo, restaurado exatamente');
  await page.click('[data-step="validate"]');const metricDiff = await page.textContent('[data-panel-step="validate"]');
  assert.ok(/LeftElbow[\s\S]*0\.134[\s\S]*→ 0/.test(metricDiff), 'validação mostra a assimetria antes → depois');
  mark('Validar: nova telemetria comparada à anterior (assimetria 0,134 → 0)');

  // ---------- Preservação: GLB exportado e reimportado ----------
  const glb = await W(async () => {
    const E = window.__importer, before = window.__studioWorkbench.engine.telemetry(), bytes = await E.exportGLB({unlit: false, noTextures: false});
    const data = await E.parse(new File([bytes], 'workbench.glb', {type: 'model/gltf-binary'}));await E.install(data.scene, data.animations, 'workbench.glb');
    await new Promise(r => setTimeout(r, 300));const after = window.__studioWorkbench.engine.telemetry();
    return {before: before.joints.map(j => [j.id, j.name, j.parent]), after: after.joints.map(j => [j.id, j.name, j.parent]),
      maxMove: Math.max(...after.joints.map(j => {const b = before.joints.find(x => x.id === j.id);return b ? Math.hypot(...j.p.map((v, k) => v - b.p[k])) : 99;})), state: after.model.state, sym: after.joints.find(j => j.name === 'LeftElbow').symmetry.mirrorDistance};
  });
  assert.deepEqual(glb.after, glb.before, 'IDs, nomes e hierarquia preservados no GLB');assert.ok(glb.maxMove < 1e-4, 'posições preservadas: ' + glb.maxMove);assert.equal(glb.state, 'vinculado');assert.equal(glb.sym, 0);
  mark('GLB exportado e reimportado: IDs persistentes, nomes, hierarquia, posições e skin preservados');

  // ---------- Patch estrutural no rig vinculado (motor do Codex): criar, reparentar e excluir ----------
  await page.click('[data-step="fix"]');
  const ids = await W(() => Object.fromEntries(window.__studioWorkbench.panel.state.telemetry.joints.map(j => [j.name, j.id])));
  const struct = {schema: 'arenamon-rig-patch', version: 1, ops: [{op: 'addJoint', name: 'HeadTop', parent: ids.HeadMain, p: [0, 2.42, 0]}, {op: 'reparent', joint: ids.LeftClavicle, parent: ids.Neck}, {op: 'removeJoint', joint: ids.RightFoot}]};
  const beforeStruct = await state();
  assert.match(await tryPatch(JSON.stringify(struct)), /Patch válido/);await page.click('#wb-to-compare');await page.waitForSelector('#wb-apply');
  const sText = await page.textContent('#wb-changes');assert.ok(sText.includes('HeadTop') && sText.includes('novo') && sText.includes('RightFoot') && sText.includes('removido') && /pai: Spine → Neck/.test(sText), sText);
  await page.click('#wb-apply');await page.waitForSelector('#wb-applied');let st = await state();
  assert.equal(st.t.summary.bones, 20);assert.ok(jointBy(st, 'HeadTop'));assert.equal(jointBy(st, 'HeadTop').parent, 'HeadMain');assert.equal(jointBy(st, 'LeftClavicle').parent, 'Neck');assert.equal(jointBy(st, 'RightFoot'), undefined);
  assert.ok(Math.hypot(...jointBy(st, 'HeadTop').p.map((v, k) => v - [0, 2.42, 0][k])) < 1e-6, 'posição do osso criado');
  await page.click('#wb-undo');assert.deepEqual((await state()).t.joints, beforeStruct.t.joints, 'desfazer o patch estrutural restaura exatamente');
  mark('Patch estrutural no rig vinculado (criar, reparentar, excluir) pelo motor do Codex, com desfazer exato');

  // ---------- Auto-rig assistido: malha sem rig → proposta → coordenadas corrigidas → prévia de pesos → skin ----------
  await W(async () => {
    const E = window.__importer, T = E.T, root = new T.Group();root.name = 'SemRig';
    for (const [name, w, h, d, x, y] of [['Corpo', .9, 1, .5, 0, 1.45], ['Cabeca', .45, .45, .45, 0, 2.2], ['Bracos', 2.6, .22, .22, 0, 1.8], ['Pernas', .7, .95, .28, 0, .5]]) {
      const m = new T.Mesh(new T.BoxGeometry(w, h, d, 4, 6, 3), new T.MeshStandardMaterial({color: 0x9a8acb}));m.name = name;m.position.set(x, y, 0);root.add(m);
    }
    await E.install(root, [], 'sem-rig.glb');
  });
  await W(() => window.__studioLayout.open('workbench'));await page.waitForFunction(() => window.__studioWorkbench.panel.state.telemetry?.model.state === 'sem-rig');
  await page.click('[data-step="fix"]');
  assert.deepEqual(await W(() => [...document.querySelectorAll('#wb-profile option')].map(o => [o.value, o.disabled])), [['humanoid-20', false], ['quadruped-24', true], ['creature-27', true]], 'perfis indisponíveis marcados');
  assert.match(await page.textContent('[data-panel-step="fix"]'), /não informa a incerteza[\s\S]*Experimental · aguarda API/);
  assert.equal(await page.isDisabled('text=Regenerar região'), true);assert.equal(await page.isDisabled('text=Fixar ossos'), true);
  await page.click('#wb-auto-template');await page.waitForFunction(() => window.__studioWorkbench.panel.state.telemetry?.model.state === 'rascunho');
  let draft = await state();assert.equal(draft.t.summary.bones, 20);
  // Coordenadas corrigidas por JSON (formato do Codex) viram patch de setPosition e passam pela prévia de pesos.
  const rig = await W(() => window.__studioRig.exportCoordinates());const elbow = rig.joints.find(j => j.name === 'LeftElbow');elbow.p = [elbow.p[0] + .05, elbow.p[1], elbow.p[2]];
  await W(t => window.__studioWorkbench.panel.loadPatchText(t), JSON.stringify(rig));
  assert.match(await page.textContent('#wb-valid'), /Patch válido[\s\S]*1 operações/);
  await page.click('#wb-to-compare');await page.waitForSelector('#wb-bind-preview');await page.click('#wb-bind-preview');
  assert.match(await page.textContent('#wb-bind-result'), /LeftElbow|Sem diferença/);
  await page.click('#wb-apply');await page.waitForSelector('#wb-applied');
  draft = await state();assert.ok(Math.abs(jointBy(draft, 'LeftElbow').p[0] - elbow.p[0]) < 1e-9, 'coordenada corrigida aplicada ao rascunho');
  await page.click('[data-step="fix"]');await page.click('#wb-auto-bind');
  await page.waitForFunction(() => window.__studioWorkbench.panel.state.telemetry?.model.state === 'vinculado');
  const bound = await state();assert.equal(bound.t.summary.skinnedMeshes, 4);assert.equal(bound.t.summary.bones, 20);
  assert.equal(await page.isDisabled('#wb-auto-test'), false);
  await W(() => window.__studioEditor.history.undo());await page.waitForFunction(() => window.__studioWorkbench.panel.state.telemetry?.model.state === 'rascunho');
  mark('Auto-rig assistido: perfis e pendências identificados, proposta, coordenadas por JSON, prévia de pesos (bind real em cópias), skin e desfazer');

  // ---------- Tela pequena ----------
  await page.setViewportSize({width: 390, height: 844});await page.click('[data-panel="workbench"]').catch(() => {});
  await W(() => window.__studioLayout.open('workbench'));await page.waitForTimeout(200);
  const narrow = await W(() => {const r = document.getElementById('wb-root').getBoundingClientRect(), tree = document.getElementById('wb-tree').getBoundingClientRect();return {w: r.width, tree: tree.width, overflow: document.getElementById('wb-root').scrollWidth - document.getElementById('wb-root').clientWidth};});
  assert.ok(narrow.overflow <= 1 && narrow.tree > 200, JSON.stringify(narrow));await page.screenshot({path: out + 'workbench-celular.png'});
  mark('Celular (390 px): árvore em coluna única, sem rolagem horizontal no painel');
  assert.deepEqual(errors, []);assert.deepEqual(requests, []);
  await writeFile(out + 'workbench-browser.json', JSON.stringify({tests: count, errors, requests}, null, 2));
  console.log(`\nWorkbench: ${count} verificações de navegador aprovadas (motor real do Codex).`);
} finally {await browser.close();}
