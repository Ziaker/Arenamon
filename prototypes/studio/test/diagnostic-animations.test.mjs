// Movimentos diagnósticos: testes determinísticos sem modelos proprietários.
import assert from 'node:assert/strict';
import * as T from 'three';
import {modelBounds,makeTemplate,bindDraftToModel} from '../src/rigging/core.js';
import {ROLES,PRESETS,automaticMapping,mappedBones,diagnosticReport,generateDiagnosticClip} from '../src/diagnostics/presets.js';
let n=0;function test(name,fn){fn();n++;console.log('✓ '+name);}
function createRoot(){
  const root=new T.Group();root.name='DiagnosticCreature';
  const mesh=new T.Mesh(new T.BoxGeometry(2,2.8,1,4,7,4),new T.MeshStandardMaterial());mesh.position.y=1.4;root.add(mesh);
  const data=bindDraftToModel(root,makeTemplate(modelBounds(root)));
  root.updateMatrixWorld(true);
  return {root,bones:data.bones};
}
const approx=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps;

test('presets únicos e biblioteca de pelo menos 7 movimentos',()=>{
  assert.ok(PRESETS.length>=7);assert.equal(new Set(PRESETS.map(p=>p.id)).size,PRESETS.length);
  assert.equal(new Set(ROLES.map(r=>r.id)).size,ROLES.length);
});
test('rig padrão: reconhece clavículas, cotovelos, joelhos e cabeça',()=>{
  const {root}=createRoot(),data=mappedBones(root);
  for(const role of ['head','spine','lClavicle','rClavicle','lUpperArm','rUpperArm','lElbow','rElbow','lUpperLeg','rUpperLeg','lKnee','rKnee'])
    assert.ok(data.mapping[role],role+' sem osso');
});
test('rig Mixamo: mapeamento por nomes sem exigir ossos adicionais',()=>{
  const ids=['mixamorig:Hips','mixamorigSpine','mixamorigHead','mixamorigLeftArm',
    'mixamorigRightArm','mixamorigLeftForeArm','mixamorigRightForeArm',
    'mixamorigLeftUpLeg','mixamorigRightUpLeg','mixamorigLeftLeg','mixamorigRightLeg'];
  const bones=ids.map(name=>{const b=new T.Bone();b.name=name;return b;});
  const data=automaticMapping(bones);
  for(const role of ['hips','spine','head','lUpperArm','rUpperArm','lElbow','rElbow','lUpperLeg','rUpperLeg','lKnee','rKnee'])
    assert.ok(data.mapping[role],role+' sem osso');
});
test('nomes duplicados não recebem mapeamento automático arbitrário',()=>{
  const bones=[new T.Bone(),new T.Bone()];
  bones[0].name=bones[1].name='LeftArm';
  const data=automaticMapping(bones);
  assert.equal(data.mapping.lUpperArm,undefined);
  assert.ok(data.warnings.some(x=>x.includes('duplicado')));
});
test('todos os movimentos geram QuaternionKeyframeTrack válidos, sem posição/root motion',()=>{
  const {root,bones}=createRoot();
  const before=bones.map(b=>b.quaternion.toArray());
  for(const p of PRESETS){
    const {clip,report}=generateDiagnosticClip(root,{},p.id,.65);
    assert.ok(report.available.length>=1,p.id+' sem roles');
    assert.ok(clip.tracks.length>0,p.id+' sem tracks');
    assert.equal(clip.tracks.length,new Set(clip.tracks.map(t=>t.name)).size,'tracks duplicados');
    assert.equal(clip.duration,p.duration);
    assert.equal(clip.userData.arenamonDiagnostic.testOnly,true);
    assert.equal(clip.userData.arenamonDiagnostic.noRootMotion,true);
    for(const track of clip.tracks){
      assert.ok(track instanceof T.QuaternionKeyframeTrack);
      assert.match(track.name,/^[0-9a-f-]{36}\.quaternion$/);
      assert.equal(track.times[0],0);assert.ok(approx(track.times.at(-1),p.duration));
      for(let i=1;i<track.times.length;i++)assert.ok(track.times[i]>track.times[i-1],'tempo duplicado');
      for(let i=0;i<track.values.length;i+=4){
        const vals=Array.from(track.values.slice(i,i+4));
        assert.ok(vals.every(Number.isFinite),'NaN quaternion');
        assert.ok(approx(Math.hypot(...vals),1,2e-5),'quaternion não normalizado');
      }
    }
  }
  assert.deepEqual(bones.map(b=>b.quaternion.toArray()),before,'criação alterou os bones reais');
});
test('walk/run/idle fecham ciclo sem salto na primeira/última pose',()=>{
  const {root}=createRoot();
  for(const id of ['walk','run','idle']){
    const {clip}=generateDiagnosticClip(root,{},id,.8);
    for(const tr of clip.tracks){
      const first=Array.from(tr.values.slice(0,4)),last=Array.from(tr.values.slice(-4));
      assert.ok(first.every((x,i)=>approx(x,last[i],5e-5)),id+' não fecha '+tr.name);
    }
  }
});
test('intensidade reduz amplitude mantendo pose original',()=>{
  const {root}=createRoot();
  const lower=generateDiagnosticClip(root,{},'squat',.25).clip;
  const upper=generateDiagnosticClip(root,{},'squat',1).clip;
  const name=lower.tracks[0].name;
  const low=lower.tracks.find(t=>t.name===name),high=upper.tracks.find(t=>t.name===name);
  const idx=Math.floor(low.times.length*.5)*4;
  const val=t=>Math.hypot(t.values[idx],t.values[idx+1],t.values[idx+2]);
  assert.ok(val(high)>val(low)+1e-3,'controle de intensidade não altera movimento');
});
test('omissões no rig são relatadas, sem fabricar bones',()=>{
  const root=new T.Group(),h=new T.Bone();h.name='Head';root.add(h);
  const b=new T.Bone();b.name='Hips';root.add(b);
  const a=diagnosticReport(root,{},'walk');
  assert.ok(a.missingRequired.length>0);
  assert.equal(a.mapping.lKnee,undefined);
});
test('mapeamento manual por UUID pode recuperar nomes inventados sem modificar o original',()=>{
  const {root,bones}=createRoot(),l=bones.find(b=>b.name==='LeftElbow'),old=l.name;
  l.name='Membro_Incomum_123';
  const before=diagnosticReport(root,{},'guard');
  assert.ok(before.missingRequired.includes('lElbow'));
  const after=diagnosticReport(root,{lElbow:l.uuid},'guard');
  assert.ok(after.available.includes('lElbow'));
  const {clip}=generateDiagnosticClip(root,{lElbow:l.uuid},'guard',.65);
  assert.ok(clip.tracks.some(t=>t.name===l.uuid+'.quaternion'));
  assert.equal(l.name,'Membro_Incomum_123');l.name=old;
});
test('mapas duplicados não aplicam duas trilhas ao mesmo osso',()=>{
  const {root,bones}=createRoot(),l=bones.find(b=>b.name==='LeftElbow');
  const a=diagnosticReport(root,{lElbow:l.uuid,rElbow:l.uuid},'guard');
  assert.ok(a.warnings.some(x=>x.includes('mesmo osso')));
  const {clip}=generateDiagnosticClip(root,{lElbow:l.uuid,rElbow:l.uuid},'guard',.65);
  assert.equal(new Set(clip.tracks.map(x=>x.name)).size,clip.tracks.length);
});
test('parâmetros e presets inválidos são rejeitados',()=>{
  const {root}=createRoot();
  assert.throws(()=>generateDiagnosticClip(root,{},'walk',-1),/Intensidade/);
  assert.throws(()=>generateDiagnosticClip(root,{},'walk',2),/Intensidade/);
  assert.throws(()=>generateDiagnosticClip(root,{},'inexistente',.5),/Preset/);
  assert.throws(()=>generateDiagnosticClip(root,{},'walk',.5,{fps:120}),/FPS/);
});
console.log('\nDiagnósticos: '+n+' testes unitários aprovados.');
