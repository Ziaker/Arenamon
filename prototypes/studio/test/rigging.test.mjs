import assert from 'node:assert/strict';
import * as T from 'three';
import {modelBounds,makeTemplate,validateDraft,applyMirror,bindDraftToModel,
  collectBones,currentJoints,auditRig,exportCoordinates,addDraftJoint,renameDraftJoint,
  reparentDraftJoint,removeDraftJoint} from '../src/rigging/core.js';
let pass=0;
const test=(name,run)=>{run();pass++;console.log('✓ '+name);};
function fixture(){
  const root=new T.Group();root.name='StudioRigTest';root.position.set(1,2,-3);root.scale.setScalar(.5);
  const geo=new T.BoxGeometry(2,3,.9,4,6,3),mesh=new T.Mesh(geo,new T.MeshStandardMaterial());
  mesh.name='CreatureBody';mesh.position.y=1.5;root.add(mesh);return root;
}
test('bounding no espaço da raiz independe de offset/escala do modelo',()=>{
  const b=modelBounds(fixture());assert.ok(Math.abs(b.size[0]-2)<1e-8);
  assert.ok(Math.abs(b.size[1]-3)<1e-8);assert.ok(b.vertices>0);
});
test('20 joints e quatro por braço sem marcador de peito inventado',()=>{
  const d=makeTemplate(modelBounds(fixture()));validateDraft(d);
  assert.equal(d.joints.length,20);
  for(const side of ['Left','Right'])for(const j of ['Clavicle','Shoulder','Elbow','Wrist'])
    assert.ok(d.joints.some(x=>x.name===side+j));
  assert.equal(d.joints.filter(x=>x.name==='Chest').length,0);
});
test('simetria reflete X conservando Y/Z',()=>{
  const d=makeTemplate(modelBounds(fixture())), l=d.joints.find(x=>x.name==='LeftElbow');
  l.p[0]-=.17;l.p[1]+=.23;
  const r=applyMirror(d,'LeftElbow'),cx=(d.bounds.min[0]+d.bounds.max[0])/2;
  assert.ok(Math.abs(r.p[0]-(2*cx-l.p[0]))<1e-8);
  assert.equal(r.p[1],l.p[1]);assert.equal(r.p[2],l.p[2]);
});
test('edição estrutural mantém IDs estáveis e hierarquia válida',()=>{
  const d=makeTemplate(modelBounds(fixture())),hips=d.joints.find(j=>j.name==='Hips'),id=hips.id;
  const tail=addDraftJoint(d,{name:'Tail',parent:id});assert.ok(tail.id);assert.equal(tail.parent,'Hips');
  renameDraftJoint(d,id,'Pelvis');assert.equal(hips.id,id);assert.equal(tail.parent,'Pelvis');
  reparentDraftJoint(d,tail.id,d.joints.find(j=>j.name==='Spine').id);assert.equal(tail.parent,'Spine');
  removeDraftJoint(d,tail.id);assert.equal(d.joints.some(j=>j.id===tail.id),false);validateDraft(d);
});
test('detecta ossos duplicados, valores não finitos, pai ausente e ciclos',()=>{
  const b=modelBounds(fixture()),d=makeTemplate(b);
  assert.throws(()=>validateDraft({...d,joints:[...d.joints,{...d.joints[0]}]},b),/duplicado/);
  assert.throws(()=>validateDraft({...d,joints:d.joints.map((j,i)=>i?j:{...j,p:[NaN,0,0]})},b),/inválido/);
  assert.throws(()=>validateDraft({...d,joints:d.joints.map((j,i)=>i?j:{...j,parent:'Head'})},b),/Ciclo/);
});
test('geração cria SkinnedMesh real com 20 bones, index/pesos normalizados',()=>{
  const root=fixture(),d=makeTemplate(modelBounds(root)),r=bindDraftToModel(root,d);
  assert.equal(r.bones.length,20);assert.equal(r.replacements.length,1);
  const m=r.replacements[0].mesh;
  assert.ok(m.isSkinnedMesh);assert.equal(m.skeleton.bones.length,20);
  const idx=m.geometry.getAttribute('skinIndex'),w=m.geometry.getAttribute('skinWeight');
  assert.equal(idx.count,m.geometry.getAttribute('position').count);
  for(let i=0;i<w.count;i++){
    let sum=0;for(let k=0;k<4;k++){assert.ok(idx.getComponent(i,k)<20);sum+=w.getComponent(i,k);}
    assert.ok(Math.abs(sum-1)<1e-5,'pesos normalizados');
  }
  const audit=auditRig(root);assert.equal(audit.skinnedMeshes,1);
  assert.equal(audit.meshes[0].invalidWeights,0);
  assert.equal(audit.meshes[0].zeroWeights,0);
  assert.equal(collectBones(root).length,20);
  assert.equal(currentJoints(root).length,20);
  assert.equal(exportCoordinates(root).joints.length,20);
});
test('skin reage a rotação do cotovelo sem deslocar a hierarquia',()=>{
  const root=fixture(),r=bindDraftToModel(root,makeTemplate(modelBounds(root)));
  const m=r.replacements[0].mesh,b=r.bones.find(x=>x.name==='LeftElbow');
  m.updateMatrixWorld(true);
  const attr=m.geometry.getAttribute('position');let start=[];
  for(let i=0;i<attr.count;i++){const v=new T.Vector3().fromBufferAttribute(attr,i);start.push(m.applyBoneTransform(i,v).clone());}
  b.rotation.z=.8;root.updateMatrixWorld(true);
  const differences=start.reduce((n,v,i)=>n+(v.distanceTo(m.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(attr,i)))>1e-5?1:0),0);
  assert.ok(differences>0,'articulação deve de fato deformar a malha');
});
test('não re-skin malha já vinculada',()=>{
  const root=fixture(),d=makeTemplate(modelBounds(root));bindDraftToModel(root,d);
  assert.throws(()=>bindDraftToModel(root,d),/Já existe skinning/);
});
console.log('\nRigging: '+pass+' testes unitários aprovados.');
