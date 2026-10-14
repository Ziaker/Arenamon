// Ferramenta Rigging — UI do Studio, manipulação no visualizador, simetria e JSON de diagnóstico.
// O skinning é real e exportável via GLB. O resultado é uma base inicial para revisão manual.
import * as T from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {modelBounds, makeTemplate, collectBones, currentJoints, auditRig,
  validateDraft, applyMirror, bindDraftToModel, exportCoordinates, ensureJointIds,
  addDraftJoint, renameDraftJoint, reparentDraftJoint, removeDraftJoint, uniqueJointName,
  syncRigMetadata} from './core.js';

const $=id=>document.getElementById(id), E=window.__importer;
const S={draft:null,selected:null,markers:new Map(),rigBones:new Map(),lastAudit:null,
  lastModel:null,wasActive:false,playBefore:false,dragging:false,dragBefore:null,poseBone:null,poseBase:null,
  poseAngle:0,suppress:false,mode:'translate',materialState:new Map(),labels:new Map(),view:'perspective'};
const geo=new T.SphereGeometry(1,12,8);
const ray=new T.Raycaster(),mouse=new T.Vector2(),world=new T.Vector3();
const TC=new TransformControls(E.camera,E.renderer.domElement);
TC.setMode('translate');TC.setSize(.7);
const helper=TC.getHelper();helper.name='Arenamon Rigging · Manipulador (somente visualização)';
E.scene.add(helper);helper.visible=false;

const active=()=>!!E.model&&window.__studioLayout?.panel==='rigging'&&window.__studioLayout?.leftOpen;
const fmt=n=>Number(n).toFixed(Number($('rg-precision')?.value)||5);
const vector=a=>new T.Vector3(a[0],a[1],a[2]);
const array=p=>[p.x,p.y,p.z];
const near=(a,b)=>a?.length===b?.length&&a.every((n,i)=>Math.abs(n-b[i])<1e-7);
const safe=(s)=>String(s??'').slice(0,200);
const skinned=()=>{let n=0;E.model?.traverse(o=>{if(o.isSkinnedMesh)n++;});return n;};
function status(message,severity='normal'){const box=$('rg-state');box.textContent=message;box.dataset.status=severity;}
function mark(reason){E.model && window.__studioProject?.markDirty(reason);}
function hideMarkers() {TC.detach();helper.visible=false;for(const m of S.markers.values())m.visible=false;}
function disposeMarkers() {
  TC.detach();for(const m of S.markers.values()){m.removeFromParent();m.material.dispose();}
  S.markers.clear();for(const label of S.labels.values())label.remove();S.labels.clear();
}
function clearPose() {
  if(S.poseBone&&S.poseBase){S.poseBone.quaternion.copy(S.poseBase);S.poseBone.updateMatrixWorld(true);}
  S.poseBone=null;S.poseBase=null;S.poseAngle=0;$('rg-pose').value='0';$('rg-pose-out').textContent='0°';
}
function joints() {
  if(S.draft)return ensureJointIds(S.draft).joints;
  return currentJoints(E.model);
}
function indexBones(){S.rigBones=new Map();for(const b of collectBones(E.model)){S.rigBones.set(b.uuid,b);S.rigBones.set(b.name,b);if(b.userData.arenamonJointId)S.rigBones.set(b.userData.arenamonJointId,b);}}
function findBone(ref) {return S.rigBones.get(ref)||S.rigBones.get(joint(ref)?.name)||null;}
function joint(ref){return joints().find(j=>j.id===ref||j.name===ref||j.uuid===ref)||null;}
function selectedJoint(){return joint(S.selected);}
function selectedPoint(){return selectedJoint()?.p||null;}
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
  validateDraft(copy,b);copy.version=2;
  return copy;
}

function prepareRig() {
  if(!E.model)return;
  E.enterRigRest();
  indexBones();
  if(skinned())S.draft=null;
  else if(!S.draft) {
    try {S.draft=restoredDraft(E.model);} catch(e){console.warn('Rig em rascunho ignorado:',e.message);}
  }
  if(S.draft?.joints.length)S.selected=joint(S.selected)?.id||S.draft.joints[0].id;
  else {const list=currentJoints(E.model);S.selected=joint(S.selected)?.id||(list[0]?.id||null);}
  rebuildMarkers();render();setView(S.view);updateRigMaterials();
}
function resetOnInstall(){
  clearPose();disposeMarkers();S.rigBones.clear();S.draft=null;S.selected=null;S.materialState.clear();
  S.lastAudit=null;S.lastModel=E.model;S.wasActive=false;
  if(E.model){
    if(active()){S.playBefore=E.playing;prepareRig();S.wasActive=true;}
    else {
      indexBones();
      if(!skinned()){try{S.draft=restoredDraft(E.model);}catch(e){console.warn(e);}}
      S.selected=S.draft?.joints[0]?.id||collectBones(E.model)[0]?.uuid||null;
      render();
    }
  }
}

function updateMarkers() {
  if(!E.model)return;
  E.model.updateMatrixWorld(true);
  for(const [id,m] of S.markers) {
    if(S.dragging&&S.selected===id)continue;
    const j=joint(id);
    if(!j){m.visible=false;const stale=S.labels.get(id);if(stale)stale.hidden=true;continue;}
    m.position.copy(worldFromRoot(j.p));const bone=findBone(j.id);if(S.draft)m.quaternion.copy(E.model.getWorldQuaternion(new T.Quaternion())).multiply(new T.Quaternion().fromArray(j.q||[0,0,0,1]));else if(bone)bone.getWorldQuaternion(m.quaternion);
    const selected=id===S.selected,name=j?.name||'';
    m.material.color.set(selected?0xffd17d:name.startsWith('Left')?0x54d9ee:name.startsWith('Right')?0xff7796:0xbff36a);
    const distance=E.camera.position.distanceTo(m.position),constant=Math.max(.5,Math.min(2.5,distance/(m.userData.baseDistance||distance)));
    m.scale.setScalar((m.userData.markerRadius || 0.025) * constant * (selected ? 1.45 : 1));
    m.visible=active()&&$('rg-markers').checked;
    const label=S.labels.get(id);if(label){const projected=m.position.clone().project(E.camera),rect=E.renderer.domElement.getBoundingClientRect(),inside=projected.z>-1&&projected.z<1&&m.visible;label.hidden=!inside;if(inside){label.style.left=((projected.x+1)*.5*rect.width)+'px';label.style.top=((-projected.y+1)*.5*rect.height)+'px';label.textContent=j.name;}}
  }
  helper.visible=active()&&$('rg-markers').checked&&!!S.selected;
  if(!helper.visible)TC.detach();
}
function rebuildMarkers() {
  disposeMarkers();if(!E.model)return;
  const bounds=modelBounds(E.model), radius=Math.max(.01,Math.max(...bounds.size)*.016);
  for(const j of joints()) {
    const mat=new T.MeshBasicMaterial({color:0x54d9ee,depthTest:!$('rg-xray').checked,transparent:true,opacity:.95});
    const m=new T.Mesh(geo,mat);m.name='RigMarker_'+j.name;m.userData.rigJoint=j.id;m.userData.markerRadius=radius;
    m.scale.setScalar(radius);m.renderOrder=9999;m.frustumCulled=false;
    E.scene.add(m);m.position.copy(worldFromRoot(j.p));m.userData.baseDistance=E.camera.position.distanceTo(m.position)||1;S.markers.set(j.id,m);
    const label=document.createElement('span');label.className='rg-joint-label';label.textContent=j.name;$('view').append(label);S.labels.set(j.id,label);
  }
  updateMarkers();attach();
}
function attach() {
  TC.detach();const marker=S.markers.get(S.selected);
  if(marker&&active()&&$('rg-markers').checked){TC.attach(marker);helper.visible=true;}
}
function select(ref) {
  const q=joint(ref);if(!q)return;
  clearPose();S.selected=q.id;
  $('rg-bone').value=q.id;
  for(const [id,v] of [['rg-x',q.p[0]],['rg-y',q.p[1]],['rg-z',q.p[2]]])$(id).value=fmt(v);
  $('rg-name').value=q.name;$('rg-parent').textContent=q.parent||'raiz do modelo';
  $('rg-parent-select').value=joint(q.parent)?.id||'';
  updateMarkers();attach();renderTelemetry();renderTree();
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
function renderTree(){
  const root=$('rg-tree');if(!root)return;const list=joints(),byParent=new Map();
  for(const j of list){const key=j.parent||'';if(!byParent.has(key))byParent.set(key,[]);byParent.get(key).push(j);}
  const rows=[];const visit=(parent,depth)=>{for(const j of byParent.get(parent)||[]){
    const row=document.createElement('div');row.className='rg-tree-row';row.role='treeitem';row.tabIndex=0;row.dataset.id=j.id;
    row.dataset.side=j.name.startsWith('Left')?'left':j.name.startsWith('Right')?'right':'center';row.ariaSelected=String(j.id===S.selected);row.style.paddingLeft=(6+depth*14)+'px';
    const dot=document.createElement('span');dot.className='rg-tree-dot';const name=document.createElement('span');name.textContent=j.name;const kids=document.createElement('small');kids.textContent=(byParent.get(j.name)||[]).length||'';
    row.append(dot,name,kids);row.onclick=()=>select(j.id);row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(j.id);}};rows.push(row);visit(j.name,depth+1);
  }};visit('',0);root.replaceChildren(...rows);
}
function render() {
  if(!E.model){status('Importe um FBX ou GLB em Projeto para começar.');return;}
  const list=joints(), search=$('rg-search').value.trim().toLowerCase();
  const visible=list.filter(j=>!search||(j.name+' '+(j.parent||'')).toLowerCase().includes(search));
  $('rg-bone').replaceChildren(...visible.map(j=>new Option(j.name,j.id)));
  if(!visible.some(j=>j.id===S.selected))S.selected=visible[0]?.id||null;
  const chosen=selectedJoint();$('rg-parent-select').replaceChildren(new Option('Raiz do modelo',''),...list.filter(j=>j.id!==S.selected).map(j=>new Option(j.name,j.id)));
  $('rg-parent-select').value=joint(chosen?.parent)?.id||'';renderTree();
  const nSkin=skinned(), nBones=collectBones(E.model).length;
  $('rg-build').hidden=nSkin>0;
  $('rg-bind').disabled=!S.draft?.joints.length||nSkin>0||E.clips.length>0;
  $('rg-template').disabled=nSkin>0;
  $('rg-pose-card').hidden=nSkin===0;
  $('rg-apply').disabled=!S.selected;
  $('rg-reset-joint').disabled=!S.selected;
  $('rg-rest').disabled=!nBones;
  if(nSkin)status(nSkin+' malha(s) com skin · '+nBones+' ossos. Edite as posições no espaço da raiz e teste a dobra.');
  else if(S.draft)status('Rascunho com '+S.draft.joints.length+' pontos · sem skinning. Ajuste e depois clique em Vincular malha.','warn');
  else if(nBones)status(nBones+' ossos soltos, sem skin. Para evitar destruir a hierarquia, faça cópia antes de gerar novo rig.','warn');
  else status('Malha sem rig. Crie os 20 pontos guiados, ajuste por vista e depois gere o skin.','warn');
  if(S.selected)select(S.selected);else {TC.detach();$('rg-telemetry').textContent='—';renderTree();}
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
  const selected=selectedJoint(),ids=[selected?.id].filter(Boolean),name=selected?.name||'';
  const pair=name.startsWith('Left')?'Right'+name.slice(4):name.startsWith('Right')?'Left'+name.slice(5):null;
  if(pair&&$('rg-mirror').checked&&joint(pair))ids.push(joint(pair).id);
  return Object.fromEntries(ids.map(id=>[id,[...joint(id).p]]));
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
  if(!S.draft&&emit){E.commitRig({reason:'editar posições do rig',emitDirty:false});syncRigMetadata(E.model);}
  updateMarkers();
  if(S.selected){const point=selectedPoint();for(const [id,v] of [['rg-x',point[0]],['rg-y',point[1]],['rg-z',point[2]]])$(id).value=fmt(v);renderTelemetry();}
}
function commitPosition(p,before=selectedSnapshot(),label='Mover articulação') {
  if(!S.selected||p.some(n=>!Number.isFinite(n)||Math.abs(n)>1e6)){status('Coordenada inválida: use números finitos.','warn');return;}
  const after={[S.selected]:p};
  const selected=selectedJoint(),name=selected?.name||'';
  const companion=name.startsWith('Left')?'Right'+name.slice(4):name.startsWith('Right')?'Left'+name.slice(5):null;
  if($('rg-mirror').checked&&companion&&joint(companion)) {
    const bounds=modelBounds(E.model);
    after[joint(companion).id]=[2*bounds.center[0]-p[0],p[1],p[2]];
  }
  const changed=Object.keys(after).some(k=>!near(after[k],before[k]));
  if(!changed){applyPositions(before,{emit:false});return;}
  const history=window.__studioEditor?.history;
  const command={label:label+' · '+(selected?.name||''),
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
function orientationSnapshot(){const j=selectedJoint(),bone=findBone(j?.id);return j?{[j.id]:S.draft?[...(j.q||[0,0,0,1])]:bone.quaternion.toArray()}:{};}
function applyOrientations(values,{emit=true}={}){for(const [id,q] of Object.entries(values)){const j=joint(id);if(!j)continue;if(S.draft)j.q=[...q];else findBone(id)?.quaternion.fromArray(q);}if(S.draft)E.model.userData.arenamonRigDraft=structuredClone(S.draft);else if(emit){E.commitRig({reason:'rotacionar osso',emitDirty:false});syncRigMetadata(E.model);}E.model.updateMatrixWorld(true);updateMarkers();renderTelemetry();}
function commitOrientation(q,before){const j=selectedJoint(),after={[j.id]:q};if(near(after[j.id],before[j.id])){applyOrientations(before);return;}const command={label:'Rotacionar osso · '+j.name,redo(){applyOrientations(after);},undo(){applyOrientations(before);}};const history=window.__studioEditor?.history;if(history)history.run(command);else{command.redo();mark(command.label);}}
function applyDraftState(state,selectedId){S.draft=structuredClone(state);ensureJointIds(S.draft);E.model.userData.arenamonRigDraft=structuredClone(S.draft);S.selected=joint(selectedId)?.id||S.draft.joints[0]?.id;rebuildMarkers();render();refreshAudit();}
function draftTransaction(label,mutate){
  const before=structuredClone(S.draft),beforeSelected=S.selected,after=structuredClone(S.draft);const selected=mutate(after)||beforeSelected;validateDraft(after,modelBounds(E.model));
  const command={label,redo(){applyDraftState(after,selected);},undo(){applyDraftState(before,beforeSelected);}};
  const history=window.__studioEditor?.history;if(history)history.run(command);else{command.redo();mark(label);}
}
function commitBound(label,redo,undo){
  const command={label,redo(){clearPose();redo();indexBones();E.commitRig({reason:label,emitDirty:false});syncRigMetadata(E.model);rebuildMarkers();render();refreshAudit();},undo(){clearPose();undo();indexBones();E.commitRig({reason:'desfazer '+label,emitDirty:false});syncRigMetadata(E.model);rebuildMarkers();render();refreshAudit();}};
  const history=window.__studioEditor?.history;if(history)history.run(command);else{command.redo();mark(label);}
}
function addBoneToSkeletons(bone,add){
  const seen=new Set();E.model.traverse(o=>{if(!o.isSkinnedMesh||!o.skeleton||seen.has(o.skeleton))return;seen.add(o.skeleton);const s=o.skeleton,i=s.bones.indexOf(bone);if(add&&i<0){s.bones.push(bone);s.boneInverses.push(new T.Matrix4());}else if(!add&&i>=0){s.bones.splice(i,1);s.boneInverses.splice(i,1);}s.calculateInverses();});
}
function createStructuralBone({duplicate=false}={}){
  const selected=selectedJoint();if(!selected)return;
  if(S.draft){draftTransaction(duplicate?'Duplicar osso':'Criar osso',draft=>{const src=draft.joints.find(j=>j.id===selected.id),parent=duplicate?(src.parent?draft.joints.find(j=>j.name===src.parent)?.id:null):src.id;const made=addDraftJoint(draft,{name:duplicate?src.name:'Bone',parent,p:duplicate?[src.p[0]+.05,src.p[1],src.p[2]]:null,q:src.q});return made.id;});return;}
  const source=findBone(selected.id),parent=duplicate?(source.parent?.isBone?source.parent:E.model):source,bone=new T.Bone();bone.name=uniqueJointName({joints:joints()},duplicate?source.name:'Bone');bone.userData.arenamonJointId=`joint-${T.MathUtils.generateUUID()}`;bone.position.set(duplicate ? .05 : 0,.1,0);
  commitBound(duplicate?'Duplicar osso':'Criar osso',()=>{parent.add(bone);addBoneToSkeletons(bone,true);S.selected=bone.userData.arenamonJointId;},()=>{bone.removeFromParent();addBoneToSkeletons(bone,false);S.selected=selected.id;});
}
function renameSelected(){
  const selected=selectedJoint(),next=$('rg-name').value.trim();if(!selected||!next)return;
  if(S.draft){try{draftTransaction('Renomear osso',draft=>{renameDraftJoint(draft,selected.id,next);return selected.id;});}catch(e){status(e.message,'warn');}return;}
  const bone=findBone(selected.id),before=bone.name;if(before===next)return;if(collectBones(E.model).some(b=>b!==bone&&b.name.toLowerCase()===next.toLowerCase())){status('Já existe um osso chamado '+next+'.','warn');return;}
  commitBound('Renomear osso',()=>{bone.name=next;S.selected=selected.id;},()=>{bone.name=before;S.selected=selected.id;});
}
function reparentSelected(){
  const selected=selectedJoint(),targetId=$('rg-parent-select').value,target=targetId?joint(targetId):null;if(!selected)return;
  if(S.draft){try{draftTransaction('Alterar hierarquia',draft=>{reparentDraftJoint(draft,selected.id,targetId||null);return selected.id;});}catch(e){status(e.message,'warn');}return;}
  const bone=findBone(selected.id),parent=target?findBone(target.id):E.model,old=bone.parent;if(parent===bone||function(){let p=parent;while(p){if(p===bone)return true;p=p.parent;}return false;}()){status('Essa hierarquia criaria um ciclo.','warn');return;}
  commitBound('Alterar hierarquia',()=>parent.attach(bone),()=>old.attach(bone));
}
function deleteSelected(){
  const selected=selectedJoint();if(!selected)return;if(!window.confirm('Excluir “'+selected.name+'”? Os filhos serão ligados ao pai anterior.'))return;
  if(S.draft){try{draftTransaction('Excluir osso',draft=>{const j=draft.joints.find(x=>x.id===selected.id),fallback=j.parent?draft.joints.find(x=>x.name===j.parent)?.id:null;removeDraftJoint(draft,selected.id);return fallback||draft.joints[0].id;});}catch(e){status(e.message,'warn');}return;}
  const bone=findBone(selected.id),oldParent=bone.parent,parent=oldParent?.isBone?oldParent:E.model,children=bone.children.filter(c=>c.isBone),meshStates=[],skeletonStates=[];
  E.model.traverse(o=>{if(!o.isSkinnedMesh||!o.skeleton)return;const idx=o.skeleton.bones.indexOf(bone);if(idx<0)return;const originalParentIndex=Math.max(0,o.skeleton.bones.indexOf(parent)),parentIndex=originalParentIndex>idx?originalParentIndex-1:originalParentIndex;meshStates.push({mesh:o,idx,parentIndex,skinIndex:o.geometry.getAttribute('skinIndex').clone(),skinWeight:o.geometry.getAttribute('skinWeight').clone()});if(!skeletonStates.some(x=>x.s===o.skeleton))skeletonStates.push({s:o.skeleton,idx,inverse:o.skeleton.boneInverses[idx]});});
  if(!skeletonStates.length){status('O osso não pertence a nenhuma skin.','warn');return;}
  const redo=()=>{for(const c of children)parent.attach(c);bone.removeFromParent();for(const x of meshStates){const a=x.mesh.geometry.getAttribute('skinIndex');for(let i=0;i<a.count;i++)for(let k=0;k<4;k++){const v=a.getComponent(i,k);a.setComponent(i,k,v===x.idx?x.parentIndex:v>x.idx?v-1:v);}a.needsUpdate=true;}for(const x of skeletonStates){x.s.bones.splice(x.idx,1);x.s.boneInverses.splice(x.idx,1);x.s.calculateInverses();}S.selected=parent.userData.arenamonJointId||parent.uuid;};
  const undo=()=>{oldParent.add(bone);for(const c of children)bone.attach(c);for(const x of skeletonStates){x.s.bones.splice(x.idx,0,bone);x.s.boneInverses.splice(x.idx,0,x.inverse);x.s.calculateInverses();}for(const x of meshStates){x.mesh.geometry.setAttribute('skinIndex',x.skinIndex.clone());x.mesh.geometry.setAttribute('skinWeight',x.skinWeight.clone());}S.selected=bone.userData.arenamonJointId||bone.uuid;};
  commitBound('Excluir osso',redo,undo);
}
function onTemplate() {
  if(!E.model||skinned())return;
  if(collectBones(E.model).length){
    status('Este modelo contém ossos existentes sem skin. A ferramenta automática não substitui sua hierarquia; importe uma malha limpa ou vincule no software de origem.','warn');return;
  }
  clearPose();const next=makeTemplate(modelBounds(E.model)),previous=S.draft?structuredClone(S.draft):null,previousSelected=S.selected;
  const command={label:S.draft?'Renovar template de rigging':'Criar template de rigging',redo(){applyDraftState(next,next.joints[0].id);},undo(){if(previous)applyDraftState(previous,previousSelected);else{S.draft=null;delete E.model.userData.arenamonRigDraft;S.selected=null;rebuildMarkers();render();}}};
  const history=window.__studioEditor?.history;if(history)history.run(command);else{command.redo();mark(command.label);}
}
function onBind() {
  if(!E.model||!S.draft)return;
  if(E.clips.length){status('Vinculação bloqueada: remova as animações do arquivo sem rig primeiro. Converter malhas em SkinnedMesh mudaria UUIDs e quebraria os tracks existentes.','warn');return;}
  const message='Vincular agora '+S.draft.joints.length+' ossos às malhas usando pesos iniciais automáticos?\n\nO skinning é real e exportável, mas os pesos podem precisar de correções. A operação entra no histórico e pode ser desfeita com segurança.';
  if(!window.confirm(message))return;
  clearPose();E.enterRigRest();
  try{
    const draft=structuredClone(S.draft),smoothness=Number($('rg-smooth').value),previousRig=E.model.userData.arenamonRig?structuredClone(E.model.userData.arenamonRig):null;let result=null,boundMetadata=null;
    const redo=()=>{if(!result)result=bindDraftToModel(E.model,draft,{smoothness});else{for(const p of result.replacements){p.parent.add(p.mesh);p.old.removeFromParent();}for(const b of result.bones.filter(b=>!b.parent))E.model.add(b);E.model.userData.arenamonRig=structuredClone(boundMetadata);}delete E.model.userData.arenamonRigDraft;E.commitRig({replacements:result.replacements,reason:'vincular rig',emitDirty:false});boundMetadata=structuredClone(syncRigMetadata(E.model,E.model.userData.arenamonRig));S.draft=null;indexBones();S.selected=result.bones[0]?.userData.arenamonJointId||result.bones[0]?.uuid;rebuildMarkers();refreshAudit();render();};
    const undo=()=>{for(const p of result.replacements){p.parent.add(p.old);p.mesh.removeFromParent();}for(const b of result.bones)if(b.parent===E.model)b.removeFromParent();E.commitRig({replacements:result.replacements.map(p=>({old:p.mesh,mesh:p.old})),reason:'desfazer vínculo',emitDirty:false});if(previousRig)E.model.userData.arenamonRig=structuredClone(previousRig);else delete E.model.userData.arenamonRig;S.draft=structuredClone(draft);E.model.userData.arenamonRigDraft=structuredClone(draft);indexBones();S.selected=draft.joints[0].id;rebuildMarkers();refreshAudit();render();};
    const command={label:'Vincular malha ao rig',redo,undo},history=window.__studioEditor?.history;if(history)history.run(command);else{redo();mark(command.label);}
    status('Rig vinculado: '+result.bones.length+' ossos, '+result.vertices+' vértices. A operação pode ser desfeita/refeita.','ok');
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
    S.draft=ensureJointIds({schema:'arenamon-rig',version:2,space:'model-root',mode:'draft',
      joints:data.joints.map(j=>({id:j.id,name:j.name,parent:j.parent,p:[...j.p],q:[...(j.q||[0,0,0,1])]})),
      bounds:data.bounds?.min?{min:data.bounds.min,max:data.bounds.max,size:data.bounds.size}:modelBounds(E.model)});
    E.model.userData.arenamonRigDraft=structuredClone(S.draft);
    S.selected=S.draft.joints[0].id;rebuildMarkers();render();mark('importar coordenadas rig');
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
function setTransformMode(mode){S.mode=mode;TC.setMode(mode);$('rg-mode-move').ariaPressed=String(mode==='translate');$('rg-mode-rotate').ariaPressed=String(mode==='rotate');}
function updateTransformSettings(){TC.setSpace($('rg-space').value);const move=Number($('rg-snap-move').value),rotate=Number($('rg-snap-rotate').value);TC.setTranslationSnap(move>0?move:null);TC.setRotationSnap(rotate>0?T.MathUtils.degToRad(rotate):null);TC.showX=$('rg-axis-x').checked;TC.showY=$('rg-axis-y').checked;TC.showZ=$('rg-axis-z').checked;for(const id of ['rg-x','rg-y','rg-z'])$(id).step=10**-(Number($('rg-precision').value)||3);}
function updateRigMaterials(){
  if(!E.model)return;const transparent=$('rg-transparent').checked,xray=$('rg-xray').checked;
  E.model.traverse(o=>{if(!o.isMesh)return;for(const m of [].concat(o.material)){if(!S.materialState.has(m))S.materialState.set(m,{transparent:m.transparent,opacity:m.opacity,depthTest:m.depthTest});const base=S.materialState.get(m);m.transparent=transparent||base.transparent;m.opacity=transparent ? .24 : base.opacity;m.depthTest=xray?false:base.depthTest;m.needsUpdate=true;}});
  for(const marker of S.markers.values()){marker.material.depthTest=!xray;marker.material.needsUpdate=true;}
  $('view').classList.toggle('rg-xray-active',xray);
}
function restoreRigMaterials(){for(const [m,base] of S.materialState){m.transparent=base.transparent;m.opacity=base.opacity;m.depthTest=base.depthTest;m.needsUpdate=true;}S.materialState.clear();$('view').classList.remove('rg-xray-active');}
function setView(name){S.view=name;E.setRigView(name);TC.camera=E.camera;for(const b of document.querySelectorAll('[data-rg-view]'))b.ariaPressed=String(b.dataset.rgView===name);updateMarkers();}
function focusSelected(){const p=selectedPoint();if(!p)return;const target=worldFromRoot(p),offset=E.camera.position.clone().sub(E.controls.target);E.controls.target.copy(target);if(E.camera.isPerspectiveCamera)E.camera.position.copy(target).add(offset.setLength(Math.max(offset.length()*.45,.1)));E.controls.update();}
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
$('rg-add').onclick=()=>createStructuralBone();$('rg-duplicate').onclick=()=>createStructuralBone({duplicate:true});$('rg-rename').onclick=renameSelected;$('rg-delete').onclick=deleteSelected;$('rg-parent-select').onchange=reparentSelected;
$('rg-mode-move').onclick=()=>setTransformMode('translate');$('rg-mode-rotate').onclick=()=>setTransformMode('rotate');
for(const id of ['rg-space','rg-snap-move','rg-snap-rotate','rg-axis-x','rg-axis-y','rg-axis-z'])$(id).onchange=updateTransformSettings;
$('rg-precision').onchange=()=>{updateTransformSettings();S.selected&&select(S.selected);};
for(const b of document.querySelectorAll('[data-rg-view]'))b.onclick=()=>setView(b.dataset.rgView);$('rg-focus').onclick=focusSelected;
$('rg-xray').onchange=updateRigMaterials;$('rg-transparent').onchange=updateRigMaterials;
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
  if(S.dragging){clearPose();S.dragBefore=S.mode==='rotate'?{kind:'rotate',value:orientationSnapshot()}:{kind:'translate',value:selectedSnapshot()};}
  else if(S.dragBefore){
    const marker=S.markers.get(S.selected);
    if(S.dragBefore.kind==='rotate'&&marker){const parentQ=(S.draft?E.model:findBone(S.selected)?.parent).getWorldQuaternion(new T.Quaternion());const local=parentQ.invert().multiply(marker.quaternion).normalize().toArray();commitOrientation(local,S.dragBefore.value);}
    else {const p=selectedPoint(),final=marker?.position.clone();if(final&&p)commitPosition(rootPointFromWorld(final),S.dragBefore.value,'Arrastar marcador');}
    S.dragBefore=null;updateMarkers();attach();
  }
});
TC.addEventListener('objectChange',()=>{
  if(!S.dragging||!S.selected)return;
  const marker=S.markers.get(S.selected);if(!marker)return;
  if(S.mode==='rotate'){const parentQ=(S.draft?E.model:findBone(S.selected)?.parent).getWorldQuaternion(new T.Quaternion());applyOrientations({[S.selected]:parentQ.invert().multiply(marker.quaternion).normalize().toArray()},{emit:false});return;}
  const p=rootPointFromWorld(marker.position);
  // Atualiza visualmente, mas não grava histórico até soltar o manipulador.
  const after={[S.selected]:p};
  const name=selectedJoint()?.name||'',pair=name.startsWith('Left')?'Right'+name.slice(4):name.startsWith('Right')?'Left'+name.slice(5):null;
  if(pair&&$('rg-mirror').checked&&joint(pair)){const c=modelBounds(E.model).center[0];after[joint(pair).id]=[2*c-p[0],p[1],p[2]];}
  applyPositions(after,{emit:false});updateMarkers();renderTelemetry();
});
// Ativação da aba: pausa animações para editar bind rest, sem alterar clipes/keys.
E.on('tick',()=>{
  const now=active();
  if(now&&!S.wasActive&&E.model){S.playBefore=E.playing;S.wasActive=true;prepareRig();}
  else if(!now&&S.wasActive){S.wasActive=false;clearPose();hideMarkers();restoreRigMaterials();E.setRigView('perspective');TC.camera=E.camera;E.controls.enabled=true;if(E.clips.length){E.selectIndex(E.selectedIndex);E.setPlaying(S.playBefore);}}
  if(now&&!S.dragging&&E.model){updateMarkers();}
});
$('rg-pose-card').hidden=true;
window.__studioRig={
  get active(){return active();},get draft(){return S.draft;},
  get selected(){return selectedJoint()?.name||null;},get selectedId(){return S.selected;},select,refreshAudit,exportCoordinates:()=>exportCoordinates(E.model,S.draft),
  applyJoint(name,p){if(!joint(name))throw Error('Osso não encontrado: '+name);select(name);commitPosition(p,selectedSnapshot(),'Editar coordenada via API');},
  createTemplate:onTemplate,bind:onBind,render,addBone:()=>createStructuralBone(),duplicateBone:()=>createStructuralBone({duplicate:true}),renameBone:renameSelected,reparentBone:reparentSelected,deleteBone:deleteSelected,setView,
};
