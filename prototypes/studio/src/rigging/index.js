// Ferramenta Rigging — UI do Studio, manipulação no visualizador, simetria e JSON de diagnóstico.
// O skinning é real e exportável via GLB. O resultado é uma base inicial para revisão manual.
import * as T from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {modelBounds, makeTemplate, collectBones, currentJoints, auditRig,
  validateDraft, applyMirror, bindDraftToModel, exportCoordinates} from './core.js';

const $=id=>document.getElementById(id), E=window.__importer;
const S={draft:null,selected:null,markers:new Map(),rigBones:new Map(),lastAudit:null,
  lastModel:null,wasActive:false,playBefore:false,dragging:false,dragBefore:null,poseBone:null,poseBase:null,
  poseAngle:0,suppress:false};
const geo=new T.SphereGeometry(1,12,8);
const ray=new T.Raycaster(),mouse=new T.Vector2(),world=new T.Vector3();
const TC=new TransformControls(E.camera,E.renderer.domElement);
TC.setMode('translate');TC.setSize(.7);
const helper=TC.getHelper();helper.name='Arenamon Rigging · Manipulador (somente visualização)';
E.scene.add(helper);helper.visible=false;

const active=()=>!!E.model&&window.__studioLayout?.panel==='rigging'&&window.__studioLayout?.leftOpen;
const fmt=n=>Number(n).toFixed(5);
const vector=a=>new T.Vector3(a[0],a[1],a[2]);
const array=p=>[p.x,p.y,p.z];
const near=(a,b)=>a?.length===b?.length&&a.every((n,i)=>Math.abs(n-b[i])<1e-7);
const safe=(s)=>String(s??'').slice(0,200);
const skinned=()=>{let n=0;E.model?.traverse(o=>{if(o.isSkinnedMesh)n++;});return n;};
function status(message,severity='normal'){const box=$('rg-state');box.textContent=message;box.dataset.status=severity;E.status(message.replace(/\n/g,' · '));}
function mark(reason){E.model && window.__studioProject?.markDirty(reason);}
function hideMarkers() {TC.detach();helper.visible=false;for(const m of S.markers.values())m.visible=false;}
function disposeMarkers() {
  TC.detach();for(const m of S.markers.values()){m.removeFromParent();m.material.dispose();}
  S.markers.clear();
}
function clearPose() {
  if(S.poseBone&&S.poseBase){S.poseBone.quaternion.copy(S.poseBase);S.poseBone.updateMatrixWorld(true);}
  S.poseBone=null;S.poseBase=null;S.poseAngle=0;$('rg-pose').value='0';$('rg-pose-out').textContent='0°';
}
function joints() {
  if(S.draft)return S.draft.joints;
  return currentJoints(E.model);
}
function findBone(name) {return S.rigBones.get(name)||null;}
function joint(name){return joints().find(j=>j.name===name)||null;}
function selectedPoint(){return joint(S.selected)?.p||null;}
function rootPointFromWorld(w){return array(E.model.worldToLocal(w.clone()));}
function worldFromRoot(p){return E.model.localToWorld(vector(p));}
// Um GLB reimportado pode conter os metadados no primeiro nó, não na Scene do GLTFLoader.
function restoredDraft(root) {
  let hit=null;
  root.traverse(o=>{if(!hit&&o.userData?.arenamonRigDraft?.schema==='arenamon-rig')hit={node:o,draft:o.userData.arenamonRigDraft};});
  if(!hit)return null;
  const copy=structuredClone(hit.draft);
  // As coordenadas são do nó onde foram salvas; converte para a raiz atual do modelo.
  root.updateMatrixWorld(true);
  copy.joints=copy.joints.map(j=>{
    const local=vector(j.p), world=hit.node.localToWorld(local);
    return {...j,p:array(root.worldToLocal(world))};
  });
  const b=modelBounds(root);
  copy.bounds={min:b.min,max:b.max,size:b.size};
  validateDraft(copy,b);
  return copy;
}

function prepareRig() {
  if(!E.model)return;
  E.enterRigRest();
  S.rigBones=new Map(collectBones(E.model).map(b=>[b.name,b]));
  if(skinned())S.draft=null;
  else if(!S.draft) {
    try {S.draft=restoredDraft(E.model);} catch(e){console.warn('Rig em rascunho ignorado:',e.message);}
  }
  if(S.draft?.joints.length)S.selected=S.draft.joints.some(j=>j.name===S.selected)?S.selected:S.draft.joints[0].name;
  else {const bones=collectBones(E.model);S.selected=bones.some(b=>b.name===S.selected)?S.selected:(bones[0]?.name||null);}
  rebuildMarkers();render();
}
function resetOnInstall(){
  clearPose();disposeMarkers();S.rigBones.clear();S.draft=null;S.selected=null;
  S.lastAudit=null;S.lastModel=E.model;S.wasActive=false;
  if(E.model){
    if(active()){S.playBefore=E.playing;prepareRig();S.wasActive=true;}
    else {
      S.rigBones=new Map(collectBones(E.model).map(b=>[b.name,b]));
      if(!skinned()){try{S.draft=restoredDraft(E.model);}catch(e){console.warn(e);}}
      S.selected=S.draft?.joints[0]?.name||collectBones(E.model)[0]?.name||null;
      render();
    }
  }
}

function updateMarkers() {
  if(!E.model)return;
  E.model.updateMatrixWorld(true);
  for(const [name,m] of S.markers) {
    if(S.dragging&&S.selected===name)continue;
    const j=joint(name);
    if(j)m.position.copy(worldFromRoot(j.p));
    const selected=name===S.selected;
    m.material.color.set(selected?0xffd17d:name.startsWith('Left')?0x54d9ee:name.startsWith('Right')?0xff7796:0xbff36a);
    m.scale.setScalar(selected?1.45:1);
    m.visible=active()&&$('rg-markers').checked;
  }
  helper.visible=active()&&$('rg-markers').checked&&!!S.selected;
  if(!helper.visible)TC.detach();
}
function rebuildMarkers() {
  disposeMarkers();if(!E.model)return;
  const bounds=modelBounds(E.model), radius=Math.max(.01,Math.max(...bounds.size)*.016);
  for(const j of joints()) {
    const mat=new T.MeshBasicMaterial({color:0x54d9ee,depthTest:false,transparent:true,opacity:.95});
    const m=new T.Mesh(geo,mat);m.name='RigMarker_'+j.name;m.userData.rigJoint=j.name;
    m.scale.setScalar(radius);m.renderOrder=9999;m.frustumCulled=false;
    E.scene.add(m);S.markers.set(j.name,m);
  }
  updateMarkers();attach();
}
function attach() {
  TC.detach();const marker=S.markers.get(S.selected);
  if(marker&&active()&&$('rg-markers').checked){TC.attach(marker);helper.visible=true;}
}
function select(name) {
  if(!name||!joint(name))return;
  clearPose();S.selected=name;
  $('rg-bone').value=name;const q=joint(name);
  for(const [id,v] of [['rg-x',q.p[0]],['rg-y',q.p[1]],['rg-z',q.p[2]]])$(id).value=fmt(v);
  $('rg-parent').textContent=q.parent||'raiz do modelo';
  updateMarkers();attach();renderTelemetry();
}
function renderTelemetry() {
  if(!E.model||!S.selected){$('rg-telemetry').textContent='Nenhum osso selecionado.';return;}
  E.model.updateMatrixWorld(true);
  const j=joint(S.selected), p=vector(j.p);
  const parent=j.parent?joint(j.parent):null, len=parent?p.distanceTo(vector(parent.p)):0;
  const w=worldFromRoot(j.p);
  const bone=findBone(j.name);
  let inv='—',quat='—',skinnedInfluence='—';
  if(bone) {
    quat=[bone.quaternion.x,bone.quaternion.y,bone.quaternion.z,bone.quaternion.w].map(fmt).join(', ');
    let count=0;
    E.model.traverse(o => {if(o.isSkinnedMesh){
      const i=o.skeleton.bones.indexOf(bone), ids=o.geometry.getAttribute('skinIndex'), ws=o.geometry.getAttribute('skinWeight');
      if(i>=0&&ids&&ws) for(let k=0;k<ids.count;k++)for(let n=0;n<4;n++)if(ids.getComponent(k,n)===i&&ws.getComponent(k,n)>.001){count++;break;}
    }});
    skinnedInfluence=count;
    E.model.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton.bones.includes(bone)){
      const idx=o.skeleton.bones.indexOf(bone);
      inv=o.skeleton.boneInverses[idx].elements.map(fmt).join(', ');}});
  }
  const lines=['Articulação: '+j.name, 'Pai: '+(j.parent||'(raiz)'),
    'Raiz local X/Y/Z: '+j.p.map(fmt).join(' / '),
    'Mundo X/Y/Z: '+array(w).map(fmt).join(' / '),
    'Posição local do próprio osso: '+(bone?array(bone.position).map(fmt).join(' / '):'rascunho'),
    'Comprimento até o pai: '+fmt(len),
    'Quaternion local XYZW: '+quat,
    'Vértices influenciados (>0.001): '+skinnedInfluence,
    'Estado: '+(S.draft?'pontos guiados — ainda sem pesos':'esqueleto existente'),
    'Unidade: original do modelo (não presumir metros)',
    'Bind inverse: '+inv];
  $('rg-telemetry').textContent=lines.join('\n');
}
function render() {
  if(!E.model){status('Importe um FBX ou GLB em Projeto para começar.');return;}
  const list=joints(), search=$('rg-search').value.trim().toLowerCase();
  const visible=list.filter(j=>!search||(j.name+' '+(j.parent||'')).toLowerCase().includes(search));
  $('rg-bone').replaceChildren(...visible.map(j=>new Option(j.name,j.name)));
  if(!visible.some(j=>j.name===S.selected))S.selected=visible[0]?.name||null;
  const nSkin=skinned(), nBones=collectBones(E.model).length;
  $('rg-build').hidden=nSkin>0;
  $('rg-bind').disabled=!S.draft?.joints.length||nSkin>0;
  $('rg-template').disabled=nSkin>0;
  $('rg-pose-card').hidden=nSkin===0;
  $('rg-apply').disabled=!S.selected;
  $('rg-reset-joint').disabled=!S.selected;
  $('rg-rest').disabled=!nBones;
  if(nSkin)status(nSkin+' malha(s) com skin · '+nBones+' ossos. Edite as posições no espaço da raiz e teste a dobra.');
  else if(S.draft)status('Rascunho com '+S.draft.joints.length+' pontos · sem skinning. Ajuste e depois clique em Vincular malha.','warn');
  else if(nBones)status(nBones+' ossos soltos, sem skin. Para evitar destruir a hierarquia, faça cópia antes de gerar novo rig.','warn');
  else status('Malha sem rig. Crie os 20 pontos guiados, ajuste por vista e depois gere o skin.','warn');
  if(S.selected)select(S.selected);else {TC.detach();$('rg-telemetry').textContent='—';}
  if(S.lastAudit)renderAudit(S.lastAudit);
}
function renderAudit(a) {
  const head='Ossos: '+a.bones+' · Malhas skinned: '+a.skinnedMeshes+'/'+a.meshes.length+
    ' · Vértices: '+a.bounds.vertices;
  const detail=a.meshes.map(m=>'- '+m.name+': '+m.vertices+' vértices; '+(m.skinned?m.bones+' ossos':'sem skin')+
    '; pesos inválidos '+m.invalidWeights+'; sem influência '+m.zeroWeights+'; sem uso '+m.unused);
  $('rg-report').textContent=head+'\n'+detail.join('\n')+'\n'+
    (a.warnings.length?'AVISOS ('+a.warnings.length+'):\n'+a.warnings.map(w=>'⚠ '+w).join('\n'):'✓ Sem inconsistências estruturais detectadas.')+
    '\nA checagem é geométrica; deformação/anatomia exigem inspeção visual.';
}
function refreshAudit() {if(!E.model)return;try{S.lastAudit=auditRig(E.model);renderAudit(S.lastAudit);}catch(e){$('rg-report').textContent='Erro na auditoria: '+e.message;}}
function selectedSnapshot() {
  const names=[S.selected];
  const pair=S.selected?.startsWith('Left')?'Right'+S.selected.slice(4):S.selected?.startsWith('Right')?'Left'+S.selected.slice(5):null;
  if(pair&&$('rg-mirror').checked&&joint(pair))names.push(pair);
  return Object.fromEntries(names.map(n=>[n,[...joint(n).p]]));
}
function applyPositions(positions,{emit=true}={}) {
  if(!E.model)return;
  E.model.updateMatrixWorld(true);
  for(const [name,p] of Object.entries(positions)) {
    const j=joint(name);if(!j)continue;
    if(S.draft)j.p=[...p];
    else {
      const bone=findBone(name);if(!bone)continue;
      const world=worldFromRoot(p), newLocal=bone.parent.worldToLocal(world);
      bone.position.copy(newLocal);bone.updateMatrixWorld(true);
    }
  }
  if(S.draft)E.model.userData.arenamonRigDraft=structuredClone(S.draft);
  if(!S.draft&&emit)E.commitRig({reason:'editar posições do rig',emitDirty:false});
  updateMarkers();
  if(S.selected){const point=selectedPoint();for(const [id,v] of [['rg-x',point[0]],['rg-y',point[1]],['rg-z',point[2]]])$(id).value=fmt(v);renderTelemetry();}
}
function commitPosition(p,before=selectedSnapshot(),label='Mover articulação') {
  if(!S.selected||p.some(n=>!Number.isFinite(n)||Math.abs(n)>1e6)){status('Coordenada inválida: use números finitos.','warn');return;}
  const after={[S.selected]:p};
  const companion=S.selected.startsWith('Left')?'Right'+S.selected.slice(4):S.selected.startsWith('Right')?'Left'+S.selected.slice(5):null;
  if($('rg-mirror').checked&&companion&&joint(companion)) {
    const bounds=modelBounds(E.model);
    after[companion]=[2*bounds.center[0]-p[0],p[1],p[2]];
  }
  const changed=Object.keys(after).some(k=>!near(after[k],before[k]));
  if(!changed){applyPositions(before,{emit:false});return;}
  const history=window.__studioEditor?.history;
  const command={label:label+' · '+S.selected,
    redo(){clearPose();applyPositions(after);},undo(){clearPose();applyPositions(before);}};
  if(history)history.run(command);else {command.redo();mark(label);}
  refreshAudit();
}
function onNumeric() {
  if(!S.selected)return;
  const p=['rg-x','rg-y','rg-z'].map(id=>Number($(id).value));
  if(['rg-x','rg-y','rg-z'].some(id=>$(id).value.trim()==='')){status('Preencha X, Y e Z.','warn');return;}
  const before=selectedSnapshot();
  commitPosition(p,before,'Definir coordenadas');
}
function onTemplate() {
  if(!E.model||skinned())return;
  if(collectBones(E.model).length){
    status('Este modelo contém ossos existentes sem skin. A ferramenta automática não substitui sua hierarquia; importe uma malha limpa ou vincule no software de origem.','warn');return;
  }
  clearPose();
  const draft=makeTemplate(modelBounds(E.model));
  S.draft=draft;E.model.userData.arenamonRigDraft=structuredClone(draft);
  S.selected=draft.joints[0].name;rebuildMarkers();render();mark('criar pontos de rigging');
}
function onBind() {
  if(!E.model||!S.draft)return;
  const message='Vincular agora '+S.draft.joints.length+' ossos às malhas usando pesos iniciais automáticos?\n\nO skinning é real e exportável, mas os pesos podem precisar de correções. A operação é estrutural e limpará o histórico de desfazer. Salve uma cópia do GLB original antes.';
  if(!window.confirm(message))return;
  clearPose();E.enterRigRest();
  try{
    const result=bindDraftToModel(E.model,S.draft,{smoothness:Number($('rg-smooth').value)});
    // Não permitir que Undo de pontos anteriores seja aplicado incorretamente a um skin já vinculado.
    window.__studioEditor?.history?.clear();
    delete E.model.userData.arenamonRigDraft;
    E.commitRig({replacements:result.replacements,reason:'criar rig com skinning e '+result.bones.length+' ossos'});
    S.draft=null;S.rigBones=new Map(collectBones(E.model).map(b=>[b.name,b]));S.selected=result.bones[0]?.name||null;
    rebuildMarkers();refreshAudit();render();
    status('Rig vinculado: '+result.bones.length+' ossos, '+result.vertices+' vértices. Salve projeto e teste articulações/GLB.','ok');
  }catch(e){console.error(e);status('Falha ao vincular: '+e.message,'warn');}
}
function exportJSON() {
  if(!E.model)return;
  try{
    const obj=exportCoordinates(E.model,S.draft);
    obj.modelName=E.model.name;
    const json=JSON.stringify(obj,null,2),url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='arenamon-rig-coordenadas.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
    status('JSON de coordenadas enviado ao navegador. Compartilhe esse arquivo para revisão osso por osso.','ok');
  }catch(e){status('Erro ao exportar: '+e.message,'warn');}
}
async function importJSON(file) {
  if(!E.model)return;
  let data;try{data=JSON.parse(await file.text());validateDraft(data,modelBounds(E.model));}
  catch(e){status('JSON recusado: '+e.message,'warn');return;}
  clearPose();
  if(skinned()) {
    const unknown=data.joints.filter(j=>!findBone(j.name));
    if(unknown.length){status('JSON não corresponde a este rig. Ossos ausentes: '+unknown.map(j=>j.name).join(', '),'warn');return;}
    // Importação de coordenadas não muda nomes, pais ou pesos; apenas posições dos bones existentes.
    const before=Object.fromEntries(data.joints.map(j=>[j.name,[...joint(j.name).p]]));
    const after=Object.fromEntries(data.joints.map(j=>[j.name,[...j.p]]));
    const history=window.__studioEditor?.history,command={label:'Importar posições do rig',
      redo(){applyPositions(after);},undo(){applyPositions(before);}};
    if(history)history.run(command);else{command.redo();mark('importar rig');}
    rebuildMarkers();refreshAudit();render();
    status('Coordenadas importadas e aplicadas a '+data.joints.length+' ossos. Verifique deformações.','ok');
  }else if(!collectBones(E.model).length){
    S.draft={schema:'arenamon-rig',version:1,space:'model-root',mode:'draft',
      joints:data.joints.map(j=>({name:j.name,parent:j.parent,p:[...j.p]})),
      bounds:data.bounds?.min?{min:data.bounds.min,max:data.bounds.max,size:data.bounds.size}:modelBounds(E.model)};
    E.model.userData.arenamonRigDraft=structuredClone(S.draft);
    S.selected=S.draft.joints[0].name;rebuildMarkers();render();mark('importar coordenadas rig');
    status('Rascunho de '+S.draft.joints.length+' pontos carregado; ainda precisa vincular os pesos.','ok');
  }else status('Este modelo já tem ossos não vinculados. Importar não pode substituir sua hierarquia.','warn');
}
function pose() {
  if(!active()||S.draft||!S.selected)return;
  const b=findBone(S.selected);if(!b)return;
  if(S.poseBone!==b){if(S.poseBone&&S.poseBase)S.poseBone.quaternion.copy(S.poseBase);S.poseBone=b;S.poseBase=b.quaternion.clone();S.poseAngle=0;}
  const a=T.MathUtils.degToRad(Number($('rg-pose').value)||0);
  const axis=new T.Vector3(...(['x','y','z'].map(k=>k===$('rg-pose-axis').value?1:0)));
  b.quaternion.copy(S.poseBase).multiply(new T.Quaternion().setFromAxisAngle(axis,a));
  b.updateMatrixWorld(true);S.poseAngle=a;$('rg-pose-out').textContent=Number($('rg-pose').value)+'°';
}
// ---------- Eventos ----------
E.on('installed',resetOnInstall);
E.on('rigChanged',()=>{if(active()&&!S.dragging)updateMarkers();});
$('rg-audit').onclick=refreshAudit;
$('rg-rest').onclick=()=>{clearPose();E.enterRigRest();updateMarkers();renderTelemetry();};
$('rg-template').onclick=onTemplate;
$('rg-bind').onclick=onBind;
$('rg-export').onclick=exportJSON;
$('rg-import').onclick=()=>$('rg-file').click();
$('rg-file').onchange=async()=>{const f=$('rg-file').files?.[0];$('rg-file').value='';if(f)await importJSON(f);};
$('rg-bone').onchange=()=>select($('rg-bone').value);
$('rg-search').oninput=()=>render();
$('rg-apply').onclick=onNumeric;
$('rg-reset-joint').onclick=()=>S.selected&&select(S.selected);
$('rg-markers').onchange=()=>{updateMarkers();attach();};
$('rg-smooth').oninput=()=>$('rg-smooth-out').textContent=Number($('rg-smooth').value).toFixed(2);
$('rg-pose').oninput=pose;
$('rg-pose-axis').onchange=pose;
$('rg-pose-reset').onclick=()=>{clearPose();E.model?.updateMatrixWorld(true);updateMarkers();};
E.renderer.domElement.addEventListener('pointerdown',e=>{
  if(!active()||!$('rg-markers').checked||S.dragging)return;
  const rect=E.renderer.domElement.getBoundingClientRect();
  mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
  ray.setFromCamera(mouse,E.camera);
  const picked=ray.intersectObjects([...S.markers.values()].filter(m=>m.visible),false)[0];
  if(picked?.object?.userData.rigJoint)select(picked.object.userData.rigJoint);
});
TC.addEventListener('dragging-changed',e=>{
  S.dragging=!!e.value;E.controls.enabled=!e.value;
  if(S.dragging){clearPose();S.dragBefore=selectedSnapshot();}
  else if(S.dragBefore){
    const p=selectedPoint();
    const final=S.markers.get(S.selected)?.position.clone();
    if(final&&p)commitPosition(rootPointFromWorld(final),S.dragBefore,'Arrastar marcador');
    S.dragBefore=null;updateMarkers();attach();
  }
});
TC.addEventListener('objectChange',()=>{
  if(!S.dragging||!S.selected)return;
  const marker=S.markers.get(S.selected);if(!marker)return;
  const p=rootPointFromWorld(marker.position);
  // Atualiza visualmente, mas não grava histórico até soltar o manipulador.
  const after={[S.selected]:p};
  const pair=S.selected.startsWith('Left')?'Right'+S.selected.slice(4):S.selected.startsWith('Right')?'Left'+S.selected.slice(5):null;
  if(pair&&$('rg-mirror').checked&&joint(pair)){const c=modelBounds(E.model).center[0];after[pair]=[2*c-p[0],p[1],p[2]];}
  applyPositions(after,{emit:false});updateMarkers();renderTelemetry();
});
// Ativação da aba: pausa animações para editar bind rest, sem alterar clipes/keys.
E.on('tick',()=>{
  const now=active();
  if(now&&!S.wasActive&&E.model){S.playBefore=E.playing;S.wasActive=true;prepareRig();}
  else if(!now&&S.wasActive){S.wasActive=false;clearPose();hideMarkers();E.controls.enabled=true;if(E.clips.length){E.selectIndex(E.selectedIndex);E.setPlaying(S.playBefore);}}
  if(now&&!S.dragging&&E.model){updateMarkers();}
});
$('rg-pose-card').hidden=true;
window.__studioRig={
  get active(){return active();},get draft(){return S.draft;},
  get selected(){return S.selected;},select,refreshAudit,exportCoordinates:()=>exportCoordinates(E.model,S.draft),
  applyJoint(name,p){if(!joint(name))throw Error('Osso não encontrado: '+name);select(name);commitPosition(p,selectedSnapshot(),'Editar coordenada via API');},
  createTemplate:onTemplate,bind:onBind,render,
};
