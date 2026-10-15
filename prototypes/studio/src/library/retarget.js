// Retarget não destrutivo: amostra rotações globais da origem e as reconstrói no repouso do destino.
// Posições intermediárias e escalas nunca são copiadas; root motion é uma trilha separada e opcional.
import * as T from 'three';
import {collectBones} from '../rigging/core.js';

export const ROLE_DEFS=Object.freeze([
  {id:'root',label:'Raiz de movimento',aliases:['root','armatureroot','rootbone']},
  {id:'hips',label:'Quadril',aliases:['pelvis','hips','rootpelvis','rootjoint','hipcenter']},
  {id:'spine',label:'Coluna',aliases:['spine','spine01','spine1','torso','abdomen']},
  {id:'neck',label:'Pescoço',aliases:['neck','neck01','neck1']},{id:'head',label:'Cabeça',aliases:['head','headtop','cranium']},
  {id:'lClavicle',label:'Clavícula esquerda',aliases:['claviclel','leftclavicle','leftcollar','lclavicle']},
  {id:'rClavicle',label:'Clavícula direita',aliases:['clavicler','rightclavicle','rightcollar','rclavicle']},
  {id:'lUpperArm',label:'Braço esquerdo',aliases:['upperarml','leftupperarm','leftarm','lupperarm','larm']},
  {id:'rUpperArm',label:'Braço direito',aliases:['upperarmr','rightupperarm','rightarm','rupperarm','rarm']},
  {id:'lElbow',label:'Antebraço esquerdo',aliases:['lowerarml','leftforearm','leftlowerarm','forearml','lelbow']},
  {id:'rElbow',label:'Antebraço direito',aliases:['lowerarmr','rightforearm','rightlowerarm','forearmr','relbow']},
  {id:'lWrist',label:'Mão esquerda',aliases:['handl','leftwrist','lefthand','lwrist','lhand']},
  {id:'rWrist',label:'Mão direita',aliases:['handr','rightwrist','righthand','rwrist','rhand']},
  {id:'lUpperLeg',label:'Coxa esquerda',aliases:['thighl','leftupleg','leftupperleg','leftthigh','lthigh']},
  {id:'rUpperLeg',label:'Coxa direita',aliases:['thighr','rightupleg','rightupperleg','rightthigh','rthigh']},
  {id:'lKnee',label:'Perna esquerda',aliases:['calfl','leftleg','leftlowerleg','leftshin','shinl','lknee']},
  {id:'rKnee',label:'Perna direita',aliases:['calfr','rightleg','rightlowerleg','rightshin','shinr','rknee']},
  {id:'lAnkle',label:'Pé esquerdo',aliases:['footl','leftankle','leftfoot','lfoot']},
  {id:'rAnkle',label:'Pé direito',aliases:['footr','rightankle','rightfoot','rfoot']},
  {id:'lToe',label:'Ponta esquerda',aliases:['balll','lefttoe','lefttoebase','toel','ltoe']},
  {id:'rToe',label:'Ponta direita',aliases:['ballr','righttoe','righttoebase','toer','rtoe']}
]);

export const canon=n=>String(n||'').replace(/[|\\]/g,'/').split('/').at(-1).replace(/^mixamorig/i,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
const uniqueIndex=bones=>{const m=new Map();for(const b of bones){const k=canon(b.name),a=m.get(k)||[];a.push(b);m.set(k,a);}return m;};
const byRoles=(bones,overrides={})=>{
  const index=uniqueIndex(bones),byUuid=new Map(bones.map(b=>[b.uuid,b])),roles={},warnings=[];
  for(const role of ROLE_DEFS){
    if(overrides[role.id]){const b=byUuid.get(overrides[role.id]);if(b)roles[role.id]=b;else warnings.push(role.label+': associação manual não existe mais.');continue;}
    for(const alias of role.aliases){const hits=index.get(alias)||[];if(hits.length===1){roles[role.id]=hits[0];break;}if(hits.length>1)warnings.push(role.label+': nome duplicado.');}
  }
  return {roles,index,byUuid,warnings};
};
const depth=o=>{let n=0;while(o?.parent){n++;o=o.parent;}return n;};
const height=root=>{const b=new T.Box3().setFromObject(root);return b.isEmpty()?1:Math.max(.001,b.max.y-b.min.y);};

export function analyzeMapping(sourceRoot,targetRoot,overrides={},requiredRoles=[]){
  const source=collectBones(sourceRoot),target=collectBones(targetRoot),ti=uniqueIndex(target);
  const sr=byRoles(source),tr=byRoles(target,overrides),mapping=new Map(),methods=new Map(),used=new Set();
  for(const s of source){const hits=ti.get(canon(s.name))||[];if(hits.length===1&&!used.has(hits[0].uuid)){mapping.set(s,hits[0]);methods.set(s,'nome exato');used.add(hits[0].uuid);}}
  for(const role of ROLE_DEFS){const s=sr.roles[role.id],t=tr.roles[role.id];if(s&&t&&!mapping.has(s)&&!used.has(t.uuid)){mapping.set(s,t);methods.set(s,overrides[role.id]?'manual':'papel anatômico');used.add(t.uuid);}}
  const mappedRoles=ROLE_DEFS.filter(r=>sr.roles[r.id]&&mapping.get(sr.roles[r.id])).map(r=>r.id);
  const missingRequired=requiredRoles.filter(id=>!mappedRoles.includes(id));
  const duplicateNames=[...ti].filter(([,a])=>a.length>1).map(([name,a])=>name+' ('+a.length+')');
  const compatible=!missingRequired.length&&mapping.size>=Math.max(3,requiredRoles.length);
  return {sourceBones:source,targetBones:target,mapping,methods,sourceRoles:sr.roles,targetRoles:tr.roles,mappedRoles,
    missingRequired,unmappedSource:source.filter(b=>!mapping.has(b)),duplicateNames,warnings:[...sr.warnings,...tr.warnings],compatible,
    exact:[...methods.values()].filter(x=>x==='nome exato').length};
}

const snapshot=root=>{const m=new Map();root.updateMatrixWorld(true);root.traverse(o=>m.set(o.uuid,{o,p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone(),wq:o.getWorldQuaternion(new T.Quaternion()),wp:o.getWorldPosition(new T.Vector3())}));return m;};
const restore=m=>{for(const x of m.values()){x.o.position.copy(x.p);x.o.quaternion.copy(x.q);x.o.scale.copy(x.s);}const first=m.values().next().value?.o;let root=first;while(root?.parent)root=root.parent;root?.updateMatrixWorld(true);};

export function clipHasRootMotion(clip,sourceRoot){
  const roots=byRoles(collectBones(sourceRoot)).roles,root=roots.root||roots.hips;if(!root)return false;
  const track=clip.tracks.find(t=>canon(T.PropertyBinding.parseTrackName(t.name).nodeName)===canon(root.name)&&/\.position$/.test(t.name));
  if(!track||track.values.length<6)return false;const a=new T.Vector3().fromArray(track.values,0),b=new T.Vector3().fromArray(track.values,track.values.length-3);return a.distanceToSquared(b)>1e-8;
}

export function createRetargetedClip({sourceRoot,targetRoot,sourceClip,overrides={},requiredRoles=[],includeRootMotion=false,fps=30,name=sourceClip?.name}){
  if(!sourceRoot||!targetRoot||!sourceClip)throw Error('Origem, destino e clipe são obrigatórios.');
  if(!Number.isFinite(fps)||fps<12||fps>120)throw Error('FPS de bake fora de 12–120.');
  const report=analyzeMapping(sourceRoot,targetRoot,overrides,requiredRoles);
  if(!report.compatible)throw Error('Rig incompatível. Faltam: '+(report.missingRequired.join(', ')||'correspondências suficientes')+'.');
  const srcRest=snapshot(sourceRoot),dstRest=snapshot(targetRoot),pairs=[...report.mapping].sort((a,b)=>depth(a[1])-depth(b[1]));
  const frames=Math.max(1,Math.ceil(sourceClip.duration*fps)),times=Array.from({length:frames+1},(_,i)=>sourceClip.duration*i/frames);
  const values=new Map(pairs.map(([,t])=>[t,[]])),rootSource=report.sourceRoles.root||report.sourceRoles.hips,
    rootTarget=rootSource?report.mapping.get(rootSource):null,rootValues=[];
  const mixer=new T.AnimationMixer(sourceRoot),action=mixer.clipAction(sourceClip);action.play();
  const scale=height(targetRoot)/height(sourceRoot),inv=new T.Quaternion(),delta=new T.Quaternion(),desired=new T.Quaternion(),parentQ=new T.Quaternion();
  try{
    for(const time of times){
      mixer.setTime(time);sourceRoot.updateMatrixWorld(true);const desiredWorld=new Map();
      for(const [s,t] of pairs){
        const sr=srcRest.get(s.uuid),tr=dstRest.get(t.uuid);if(!sr||!tr)continue;
        const sw=s.getWorldQuaternion(new T.Quaternion());inv.copy(sr.wq).invert();delta.copy(sw).multiply(inv);desired.copy(delta).multiply(tr.wq).normalize();
        const parent=t.parent,computed=parent&&desiredWorld.get(parent.uuid),pr=parent&&dstRest.get(parent.uuid);
        parentQ.copy(computed||pr?.wq||new T.Quaternion()).invert();const local=parentQ.multiply(desired).normalize();
        values.get(t).push(local.x,local.y,local.z,local.w);desiredWorld.set(t.uuid,desired.clone());
      }
      if(includeRootMotion&&rootSource&&rootTarget){const sr=srcRest.get(rootSource.uuid),tr=dstRest.get(rootTarget.uuid),p=rootSource.position.clone().sub(sr.p).multiplyScalar(scale).add(tr.p);rootValues.push(p.x,p.y,p.z);}
    }
  } finally {action.stop();mixer.uncacheRoot(sourceRoot);restore(srcRest);restore(dstRest);}
  const tracks=[];for(const [,t] of pairs){const v=values.get(t);if(v?.length===times.length*4)tracks.push(new T.QuaternionKeyframeTrack(t.uuid+'.quaternion',times,v));}
  if(includeRootMotion&&rootTarget&&rootValues.length===times.length*3)tracks.push(new T.VectorKeyframeTrack(rootTarget.uuid+'.position',times,rootValues));
  if(!tracks.length)throw Error('O retarget não gerou trilhas utilizáveis.');
  const clip=new T.AnimationClip(name||sourceClip.name,sourceClip.duration,tracks);clip.sourceFile='Biblioteca Quaternius UAL1 v3';
  clip.userData={arenamonLibrary:{schemaVersion:1,source:'quaternius-ual1-v3',sourceClip:sourceClip.name,license:'CC0-1.0',
    retargeted:true,bakeFps:fps,rootMotion:!!includeRootMotion,mappedBones:pairs.length,missingBones:report.unmappedSource.map(b=>b.name)}};
  return {clip,report};
}
