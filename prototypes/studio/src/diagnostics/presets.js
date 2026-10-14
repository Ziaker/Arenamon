// Movimentos de DIAGNÓSTICO, não animações definitivas de gameplay.
// Compatíveis com qualquer rig que exponha ao menos algumas articulações identificáveis.
// Gera apenas trilhas de QUATERNION, sem root motion, sem dano/hitboxes, sem alterar clipes existentes.
import * as T from 'three';
import {collectBones} from '../rigging/core.js';

export const ROLES = [
  {id:'hips',label:'Quadril / raiz corporal',aliases:['hips','pelvis','rootpelvis','rootjoint','hipcenter']},
  {id:'spine',label:'Tronco / coluna',aliases:['spine','spine1','spine01','spine2','spine02','torso','abdomen']},
  {id:'neck',label:'Pescoço',aliases:['neck','neck1']},
  {id:'head',label:'Cabeça',aliases:['head','headtop','cranium']},
  {id:'lClavicle',label:'Clavícula esquerda',aliases:['leftclavicle','leftcollar','claviclel','lclavicle']},
  {id:'rClavicle',label:'Clavícula direita',aliases:['rightclavicle','rightcollar','clavicler','rclavicle']},
  {id:'lUpperArm',label:'Ombro / braço esquerdo',aliases:['leftshoulder','leftupperarm','leftarm','upperarml','lupperarm','larm']},
  {id:'rUpperArm',label:'Ombro / braço direito',aliases:['rightshoulder','rightupperarm','rightarm','upperarmr','rupperarm','rarm']},
  {id:'lElbow',label:'Cotovelo / antebraço esquerdo',aliases:['leftelbow','leftforearm','leftlowerarm','forearml','lforearm','lelbow']},
  {id:'rElbow',label:'Cotovelo / antebraço direito',aliases:['rightelbow','rightforearm','rightlowerarm','forearmr','rforearm','relbow']},
  {id:'lWrist',label:'Punho / mão esquerda',aliases:['leftwrist','lefthand','handl','lwrist','lhand']},
  {id:'rWrist',label:'Punho / mão direita',aliases:['rightwrist','righthand','handr','rwrist','rhand']},
  {id:'lUpperLeg',label:'Quadril / coxa esquerda',aliases:['lefthip','leftupleg','leftupperleg','leftthigh','thighl','lthigh']},
  {id:'rUpperLeg',label:'Quadril / coxa direita',aliases:['righthip','rightupleg','rightupperleg','rightthigh','thighr','rthigh']},
  {id:'lKnee',label:'Joelho / perna esquerda',aliases:['leftknee','leftleg','leftlowerleg','leftshin','shinl','lknee','lshin']},
  {id:'rKnee',label:'Joelho / perna direita',aliases:['rightknee','rightleg','rightlowerleg','rightshin','shinr','rknee','rshin']},
  {id:'lAnkle',label:'Tornozelo esquerdo',aliases:['leftankle','leftfoot','footl','lfoot']},
  {id:'rAnkle',label:'Tornozelo direito',aliases:['rightankle','rightfoot','footr','rfoot']},
  {id:'lToe',label:'Ponta do pé esquerdo',aliases:['lefttoe','lefttoebase','lefttoes','toel','ltoe']},
  {id:'rToe',label:'Ponta do pé direito',aliases:['righttoe','righttoebase','righttoes','toer','rtoe']}
];

export const PRESETS = [
  {id:'isolate',name:'Inspeção osso por osso',duration:12,description:'Flexiona articulações isoladamente para localizar defeitos de pesos. Não move o personagem no espaço.'},
  {id:'idle',name:'Respiração e balanço (idle)',duration:2.4,description:'Movimentação leve de tronco e cabeça. Útil para verificar skin estável em repouso.'},
  {id:'walk',name:'Caminhada no lugar',duration:1.6,description:'Alterna pernas e braços sem deslocamento da raiz.'},
  {id:'run',name:'Corrida no lugar',duration:1.1,description:'Passadas rápidas e flexões maiores. É um teste, não uma corrida final.'},
  {id:'squat',name:'Agachamento e recuperação',duration:2.4,description:'Flexiona quadris, joelhos e tornozelos para verificar deformações.'},
  {id:'tackle',name:'Investida de combate (teste)',duration:1.5,description:'Inclinação frontal, ombros e braços. Não gera ataque, física nem deslocamento real.'},
  {id:'dodge',name:'Esquiva lateral (teste)',duration:1.4,description:'Inclinação lateral, torção e compensação das pernas. Sem invulnerabilidade ou deslocamento.'},
  {id:'guard',name:'Postura defensiva (teste)',duration:1.8,description:'Ergue e flexiona os braços para identificar problemas nos ombros e cotovelos.'}
];
export const DEFAULT_PRESET = 'isolate';
export const roleById = id => ROLES.find(x=>x.id===id);
const canon = n => String(n||'').replace(/[|\\]/g,'/').split('/').at(-1).replace(/mixamorig/ig,'').replace(/[^a-z0-9]/gi,'').toLowerCase();

// Nomes únicos: nunca supor correspondência quando há duplicatas.
export function automaticMapping(bones) {
  const used=new Set(),mapping={},warnings=[];
  const names=new Map();
  for(const b of bones){
    const key=canon(b.name);const bucket=names.get(key)||[];bucket.push(b);names.set(key,bucket);
  }
  for(const r of ROLES) {
    for(const alias of r.aliases) {
      const hits=names.get(alias)||[];
      if(hits.length===1&&!used.has(hits[0].uuid)){
        mapping[r.id]=hits[0].uuid;used.add(hits[0].uuid);break;
      }
      if(hits.length>1)warnings.push(r.label+': nome duplicado, escolha manualmente.');
    }
  }
  return {mapping,warnings};
}

export function mappedBones(root,overrides={}) {
  const bones=collectBones(root);
  const initial=automaticMapping(bones);
  const byId=new Map(bones.map(b=>[b.uuid,b]));
  const result={...initial.mapping},warnings=[...initial.warnings];
  for(const [role,value] of Object.entries(overrides)) {
    if(!roleById(role))continue;
    if(value===null||value===''){delete result[role];continue;}
    if(byId.has(value))result[role]=value;
    else warnings.push(role+': bone selecionado não existe mais.');
  }
  const duplicates=new Map();
  for(const [role,uuid] of Object.entries(result)) {
    if(duplicates.has(uuid)){warnings.push('O mesmo osso foi associado a '+duplicates.get(uuid)+' e '+role+'.');delete result[role];}
    else duplicates.set(uuid,role);
  }
  return {bones, mapping:result, byId, warnings,
    mapped:Object.keys(result).length,
    missing:ROLES.filter(r=>!result[r.id]).map(r=>r.label)};
}
const PI=Math.PI, deg=v=>v*PI/180, clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const smooth=x=>{const u=clamp(x,0,1);return u*u*(3-2*u);};
const pulse=(t,a,b,c,d)=>smooth((t-a)/Math.max(b-a,.001))*(1-smooth((t-c)/Math.max(d-c,.001)));
function sampleAngles(id,t,duration) {
  const a={};const put=(role,x=0,y=0,z=0)=>{a[role]=[x,y,z];};
  const phase=t/duration, cyc=2*PI*phase, sin=Math.sin, abs=Math.abs;
  if(id==='isolate'){
    const chain=['head','neck','spine','lClavicle','rClavicle','lUpperArm','rUpperArm','lElbow','rElbow','lUpperLeg','rUpperLeg','lKnee','rKnee','lAnkle','rAnkle','lWrist','rWrist','lToe','rToe','hips'];
    // Duração 12 s dividida por 20: somente um osso por vez.
    const u=t/(duration/chain.length),idx=Math.min(chain.length-1,Math.floor(u));
    const amp=Math.pow(Math.sin(PI*(u-idx)),2);
    if(amp>0) {
      const target=chain[idx],sign=target.startsWith('r')?-1:1;
      put(target, (target.includes('UpperLeg')||target.includes('Knee')||target.includes('Elbow')||target.includes('UpperArm'))?30*amp:0,
        target==='head'||target==='neck'?22*amp:0, target==='spine'||target==='hips'||target.includes('Clavicle')||target.includes('Wrist')?sign*18*amp:0);
    }
  } else if(id==='idle'){
    const amp=sin(cyc),breath=(1-Math.cos(cyc))/2;
    put('spine',1.8*amp,0,2.2*amp);put('hips',0,0,-1.1*amp);put('head',-1.8*amp,2.4*amp,0);
    put('lUpperArm',2.5*breath,0,-1*amp);put('rUpperArm',2.5*breath,0,1*amp);
  } else if(id==='walk'||id==='run'){
    const intensity=id==='run'?1.55:1,leg=sin(cyc),arm=sin(cyc),bend=x=>Math.max(0,x);
    put('lUpperLeg',28*intensity*leg);put('rUpperLeg',-28*intensity*leg);
    put('lKnee',32*intensity*bend(-leg));put('rKnee',32*intensity*bend(leg));
    put('lAnkle',-12*intensity*leg);put('rAnkle',12*intensity*leg);
    put('lUpperArm',-21*intensity*arm,0,-2);put('rUpperArm',21*intensity*arm,0,2);
    put('lElbow',12*intensity*bend(arm));put('rElbow',12*intensity*bend(-arm));
    put('hips',3.5*intensity*Math.sin(cyc*2),3*intensity*leg,3.5*intensity*Math.sin(cyc));
    put('spine',-3*intensity*Math.sin(cyc*2),-2.5*intensity*leg,-3*intensity*Math.sin(cyc));
    put('head',-1.5*intensity*Math.sin(cyc*2));
  } else if(id==='squat'){
    const w=pulse(t,.2,.75,1.45,2.05);
    put('lUpperLeg',-35*w);put('rUpperLeg',-35*w);
    put('lKnee',55*w);put('rKnee',55*w);
    put('lAnkle',-15*w);put('rAnkle',-15*w);
    put('hips',12*w);put('spine',-12*w);
    put('lUpperArm',-18*w);put('rUpperArm',-18*w);
  } else if(id==='tackle'){
    const w=pulse(t,.18,.5,.72,1.25),w2=pulse(t,.35,.6,.82,1.35);
    put('hips',18*w);put('spine',27*w);put('neck',-12*w);put('head',-6*w);
    put('lUpperArm',-45*w2,0,-10*w2);put('rUpperArm',-45*w2,0,10*w2);
    put('lElbow',24*w2);put('rElbow',24*w2);
    put('lUpperLeg',-15*w);put('rUpperLeg',12*w);put('lKnee',15*w);
  } else if(id==='dodge'){
    const w=pulse(t,.15,.4,.73,1.18);
    put('hips',-6*w,18*w,18*w);put('spine',8*w,-20*w,-29*w);put('head',-3*w,5*w,14*w);
    put('lUpperLeg',15*w,0,12*w);put('rUpperLeg',-10*w,0,-9*w);
    put('lKnee',16*w);put('rKnee',13*w);put('lUpperArm',8*w,0,-18*w);put('rUpperArm',10*w,0,22*w);
  } else if(id==='guard'){
    const w=pulse(t,.15,.45,1.15,1.65);
    put('spine',-9*w);put('head',9*w);
    put('lClavicle',0,0,9*w);put('rClavicle',0,0,-9*w);
    put('lUpperArm',-36*w,0,-26*w);put('rUpperArm',-36*w,0,26*w);
    put('lElbow',75*w);put('rElbow',75*w);
    put('lWrist',-10*w);put('rWrist',-10*w);
    put('lUpperLeg',-10*w);put('rUpperLeg',-10*w);
    put('lKnee',15*w);put('rKnee',15*w);
  } else throw Error('Preset de diagnóstico desconhecido: '+id);
  return a;
}

export function diagnosticReport(root,overrides={},preset=DEFAULT_PRESET) {
  const data=mappedBones(root,overrides);
  const requested=new Set();
  const d=PRESETS.find(x=>x.id===preset);if(!d)throw Error('Preset desconhecido');
  for(let i=0;i<=60;i++) for(const role of Object.keys(sampleAngles(preset,d.duration*i/60,d.duration)))requested.add(role);
  const available=[...requested].filter(id=>data.mapping[id]),missing=[...requested].filter(id=>!data.mapping[id]);
  return {...data,preset: d, available, missingRequired:missing,generatedTrackCount:available.length};
}

export function generateDiagnosticClip(root,overrides={},preset=DEFAULT_PRESET,intensity=.65,{fps=24}={}) {
  if(!root)throw Error('Importe um personagem rigado.');
  const power=Number(intensity);
  if(!Number.isFinite(power)||power<.1||power>1.5)throw Error('Intensidade fora de 0,1–1,5.');
  if(!Number.isFinite(fps)||fps<10||fps>60)throw Error('FPS fora de 10–60.');
  const report=diagnosticReport(root,overrides,preset);
  const roles=report.available;
  if(!roles.length)throw Error('Não há articulações reconhecidas para '+report.preset.name+'. Ajuste o mapeamento manual.');
  const duration=report.preset.duration,frameCount=Math.max(2,Math.round(duration*fps));
  const times=Array.from({length:frameCount+1},(_,i)=>duration*i/frameCount),tracks=[];
  // Nunca alterar os quaternions reais; a captura exige que o Studio esteja na pose de repouso.
  for(const role of roles){
    const bone=report.byId.get(report.mapping[role]);
    if(!bone)continue;
    const rest=bone.quaternion.clone(),values=[];
    for(const t of times) {
      const [x,y,z]=sampleAngles(preset,t,duration)[role]||[0,0,0];
      const q=rest.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(deg(x*power),deg(y*power),deg(z*power),'XYZ'))).normalize();
      values.push(q.x,q.y,q.z,q.w);
    }
    tracks.push(new T.QuaternionKeyframeTrack(bone.uuid+'.quaternion',times,values));
  }
  const clip=new T.AnimationClip('DIAGNÓSTICO · '+report.preset.name,duration,tracks);
  clip.sourceFile='Gerado localmente no Arenamon Studio';
  clip.userData={arenamonDiagnostic:{version:1,presetId:preset,testOnly:true,noRootMotion:true,
    intensity:power,createdAt:new Date().toISOString(),
    mappedRoles:roles.map(role=>({role,boneName:report.byId.get(report.mapping[role])?.name})),
    missingRoles:report.missingRequired,notes:'Animação demonstrativa, não homologada para gameplay.'}};
  return {clip,report};
}
