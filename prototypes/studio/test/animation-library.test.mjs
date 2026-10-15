import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {CATALOG,SOURCE} from '../src/library/catalog.js';
import {analyzeMapping,clipHasRootMotion,createRetargetedClip} from '../src/library/retarget.js';

globalThis.ProgressEvent??=class ProgressEvent{};
let tests=0;const test=async(name,fn)=>{await fn();tests++;console.log('✓ '+name);};
const asset=name=>new URL('../assets/animation-library/quaternius-ual1-v3/'+name,import.meta.url);
async function glb(name){const b=await readFile(asset(name));return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
function rig(names){const root=new T.Group(),bones={};for(const [name,parent,pos=[0,1,0],rotation=0] of names){const b=new T.Bone();b.name=name;b.position.fromArray(pos);b.quaternion.setFromAxisAngle(new T.Vector3(0,0,1),rotation);(parent?bones[parent]:root).add(b);bones[name]=b;}root.updateMatrixWorld(true);return {root,bones};}
const sourceNames=[['root',null,[0,0,0]],['pelvis','root'],['spine_01','pelvis'],['Head','spine_01'],['upperarm_l','spine_01'],['lowerarm_l','upperarm_l'],['upperarm_r','spine_01'],['lowerarm_r','upperarm_r'],['thigh_l','pelvis'],['calf_l','thigh_l'],['thigh_r','pelvis'],['calf_r','thigh_r']];
const targetNames=[['Root',null,[0,0,0]],['mixamorigHips','Root'],['mixamorigSpine','mixamorigHips',undefined,.12],['mixamorigHead','mixamorigSpine'],['mixamorigLeftArm','mixamorigSpine'],['mixamorigLeftForeArm','mixamorigLeftArm'],['mixamorigRightArm','mixamorigSpine'],['mixamorigRightForeArm','mixamorigRightArm'],['mixamorigLeftUpLeg','mixamorigHips'],['mixamorigLeftLeg','mixamorigLeftUpLeg'],['mixamorigRightUpLeg','mixamorigHips'],['mixamorigRightLeg','mixamorigRightUpLeg']];

await test('catálogo curado tem 20 movimentos reais distintos e proveniência',()=>{assert.equal(CATALOG.length,20);assert.equal(new Set(CATALOG.map(x=>x.clip)).size,20);assert.equal(SOURCE.license,'CC0 1.0 Universal');assert.ok(CATALOG.every(x=>x.duration>0&&x.frames>1));});
await test('associação automática reconhece Quaternius → Mixamo e requisitos por clipe',()=>{const s=rig(sourceNames),t=rig(targetNames),r=analyzeMapping(s.root,t.root,{},['hips','spine','lUpperLeg','rUpperLeg']);assert.equal(r.compatible,true);assert.ok(r.mapping.size>=10);assert.deepEqual(r.missingRequired,[]);});
await test('falha explícita quando o rig não possui articulações obrigatórias',()=>{const s=rig(sourceNames),t=rig([['Root',null]]),r=analyzeMapping(s.root,t.root,{},['hips','spine']);assert.equal(r.compatible,false);assert.deepEqual(r.missingRequired,['hips','spine']);assert.throws(()=>createRetargetedClip({sourceRoot:s.root,targetRoot:t.root,sourceClip:new T.AnimationClip('x',1,[]),requiredRoles:['hips']}),/Rig incompatível/);});
await test('retarget respeita repousos diferentes, quaternions e não cria tracks órfãos',()=>{const s=rig(sourceNames),t=rig(targetNames),q0=new T.Quaternion(),q1=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.7),clip=new T.AnimationClip('Walk',1,[new T.QuaternionKeyframeTrack('thigh_l.quaternion',[0,1],[...q0.toArray(),...q1.toArray()])]);
  const out=createRetargetedClip({sourceRoot:s.root,targetRoot:t.root,sourceClip:clip,requiredRoles:['lUpperLeg'],fps:30});assert.ok(out.clip.tracks.length>=10);const ids=new Set();t.root.traverse(o=>ids.add(o.uuid));assert.ok(out.clip.tracks.every(x=>ids.has(x.name.split('.')[0])));const mixer=new T.AnimationMixer(t.root),a=mixer.clipAction(out.clip);a.play();mixer.setTime(.5);assert.ok(Math.abs(t.bones.mixamorigLeftUpLeg.quaternion.x)>1e-3);});
await test('root motion é opcional, separado e escalável',()=>{const s=rig(sourceNames),t=rig(targetNames),clip=new T.AnimationClip('Sprint',1,[new T.VectorKeyframeTrack('root.position',[0,1],[0,0,0,0,0,3]),new T.QuaternionKeyframeTrack('pelvis.quaternion',[0,1],[0,0,0,1,0,0,0,1])]);
  const no=createRetargetedClip({sourceRoot:s.root,targetRoot:t.root,sourceClip:clip,requiredRoles:['hips'],includeRootMotion:false}),yes=createRetargetedClip({sourceRoot:s.root,targetRoot:t.root,sourceClip:clip,requiredRoles:['hips'],includeRootMotion:true});assert.equal(no.clip.tracks.some(x=>x.name.endsWith('.position')),false);assert.equal(yes.clip.tracks.filter(x=>x.name.endsWith('.position')).length,1);});
const [plain,rm]=await Promise.all([glb('UAL1_Standard.glb'),glb('UAL1_Standard_RM.glb')]);
await test('GLBs oficiais íntegros: skinning, 65 bones e clipes catalogados',()=>{for(const data of [plain,rm]){let bones=0,skin=0;data.scene.traverse(o=>{bones+=!!o.isBone;skin+=!!o.isSkinnedMesh;});assert.equal(bones,65);assert.equal(skin,2);assert.ok(CATALOG.every(e=>data.animations.some(a=>a.name===e.clip)));}});
await test('variantes in-place e root-motion são realmente diferentes',()=>{const a=plain.animations.find(x=>x.name==='Sprint_Loop'),b=rm.animations.find(x=>x.name==='Sprint_Loop');assert.equal(clipHasRootMotion(a,plain.scene),false);assert.equal(clipHasRootMotion(b,rm.scene),true);});
await test('FBX oficial passa pelo FBXLoader com animações, esqueleto e skinning',async()=>{const packed=await readFile(asset('UAL1_Standard.fbx.gz')),raw=gunzipSync(packed),fbx=new FBXLoader().parse(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');let bones=0,skin=0;fbx.traverse(o=>{bones+=!!o.isBone;skin+=!!o.isSkinnedMesh;});assert.equal(fbx.animations.length,43);assert.equal(bones,65);assert.equal(skin,1);assert.ok(fbx.animations.some(x=>x.name.endsWith('Walk_Loop')));});
console.log(`${tests} testes da biblioteca de animações aprovados.`);
