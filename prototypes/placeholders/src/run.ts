import * as T from 'three';
import {Rig,solveLeg} from './rig';
import {Key,curve,wrap,hermite} from './run-curves';
import {runTiming} from './run-motion';
import type {Style} from './animation';

export interface RunFrame {
 px:number;py:number;pz:number;pitch:number;yaw:number;roll:number;
 lean:number;twist:number;chestRoll:number;squash:number;head:number;look:number;headRoll:number;neck:number;
 left:number;right:number;elbowL:number;elbowR:number;spreadL:number;spreadR:number;handL:number;handR:number;
 lx:number;ly:number;lz:number;lp:number;lk:number;rx:number;ry:number;rz:number;rp:number;rk:number;
}
export const phaseNames=['Primeiro contato','Absorção do peso','Passagem sobre o apoio','Impulso · calcanhar elevado','Suspensão','Preparação do contato'] as const;
export const phaseStarts=[0,.045,.115,.195,.27,.345];
export function runPhase(t:number){const u=wrap(t,runTiming.step);let index=0;while(index<5&&u>=phaseStarts[index+1])index++;return {index,name:phaseNames[index],support:wrap(t,.8)<.4?'E':'D',time:u};}

// One explicitly directed half-stride, mirrored for the opposite support.
// Non-uniform keys describe compression, travel over the support, toe-off and flight.
const height:Key[]=[[0,1.17,-.65],[.065,1.055,0],[.135,1.105,.95],[.23,1.215,1.05],[.295,1.28,0],[.355,1.23,-1.1],[.4,1.17,-.65]];
const lean:Key[]=[[0,.27,.30],[.075,.32,0],[.16,.285,-.4],[.245,.25,0],[.315,.24,0],[.4,.27,.30]];
const squash:Key[]=[[0,1,-.3],[.07,.957,0],[.18,1.01,.3],[.26,1.032,0],[.34,1.015,-.2],[.4,1,-.3]];
const lateral:Key[]=[[0,-.012,-.35],[.09,-.070,0],[.19,-.045,.35],[.30,0,.2],[.4,.012,.35]];
const hipYaw:Key[]=[[0,.12,-.1],[.09,.10,-.5],[.22,-.04,-.9],[.33,-.11,-.2],[.4,-.12,.1]];
const hipRoll:Key[]=[[0,.018,.1],[.10,.045,0],[.22,.02,-.4],[.32,-.015,-.12],[.4,-.018,-.1]];
const arm:Key[]=[[0,.68,.9],[.075,.76,0],[.19,.12,-6],[.29,-.70,-3],[.35,-.88,0],[.4,-.88,.6],[.48,-.73,3],[.59,-.14,5],[.70,.53,3],[.8,.68,.9]];
const elbow:Key[]=[[0,-1.15,-.4],[.14,-.83,0],[.29,-1.39,-1],[.38,-1.47,0],[.53,-1.16,1],[.69,-1.05,0],[.8,-1.15,-.4]];
const wrist:Key[]=[[0,.08,.3],[.14,.12,0],[.28,-.05,-.5],[.41,-.08,0],[.60,.01,.5],[.8,.08,.3]];
const headLag:Key[]=[[0,.022,-.12],[.045,.014,-.25],[.105,-.018,0],[.22,.005,.16],[.31,.035,0],[.4,.022,-.12]];
const rollFoot:Key[]=[[0,-.15,0],[.05,0,0],[.145,0,0],[.215,.30,7],[.27,.78,0]];
const sideKeys:Key[]=[[0,0,0],[.27,0,0],[.44,.045,0],[.61,.015,-.2],[.8,0,0]];
const poleKeys:Key[]=[[0,.12,0],[.27,.16,0],[.45,.32,0],[.62,.22,-.7],[.8,.12,0]];
const pitchQ=(angle:number)=>new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),angle);
const ankleHeight=.10,heelZ=-.12,toeZ=.23;
/** Relative to the physical root; planted reference is fixed in world/material coordinates. */
export function footTrack(t:number,side:number){
 const offset=side<0?0:.4,u=wrap(t-offset,.8),contactTime=t-u,plantZ=runTiming.speed*contactTime+runTiming.landing;
 let pitch:number,ankle:T.Vector3;
 if(u<=.27){
  pitch=curve(rollFoot,u);const pivot=pitch<0?heelZ:toeZ;
  ankle=new T.Vector3(side*.24,0,plantZ).add(new T.Vector3(0,0,pivot)).sub(new T.Vector3(0,-ankleHeight,pivot).applyQuaternion(pitchQ(pitch)));
  ankle.z-=runTiming.speed*t;
 }else{
  // The toe-off and landing tangents match the planted foot in world space.
  const q=pitchQ(.78),take=new T.Vector3(0,0,toeZ).sub(new T.Vector3(0,-ankleHeight,toeZ).applyQuaternion(q));
  const land=new T.Vector3(0,0,heelZ).sub(new T.Vector3(0,-ankleHeight,heelZ).applyQuaternion(pitchQ(-.15)));
  const z0=runTiming.landing-runTiming.speed*.27+take.z,z1=runTiming.landing+land.z;
  const z=curve([[.27,z0,-runTiming.speed],[.39,-.60,0],[.53,-.20,5.2],[.68,.48,.2],[.8,z1,-runTiming.speed]],u);
  const y=curve([[.27,take.y,0],[.37,.48,2.2],[.45,.68,0],[.59,.39,-2.8],[.70,.18,-1.4],[.8,land.y,0]],u);
  pitch=curve([[.27,.78,0],[.39,1.05,0],[.54,.42,-5],[.68,-.13,-.5],[.8,-.15,0]],u);
  ankle=new T.Vector3(side*(.24+curve(sideKeys,u)),y,z);
 }
 return {ankle,pitch,pole:side*curve(poleKeys,u),contact:u<=.27,age:u,plantZ,contactTime,pivot:pitch<0?'heel':'toe'};
}
export function evaluateRun(t:number,style:Style):RunFrame{
 const half=wrap(t,.4),sign=wrap(t,.8)<.4?1:-1,full=wrap(t,.8);
 const k=style==='contained'?{body:.75,arm:.84,stretch:.55}:style==='expressive'?{body:1.15,arm:1.12,stretch:1.35}:{body:1,arm:1,stretch:1};
 const l=footTrack(t,-1),r=footTrack(t,1),pitch=.055,hip=curve(hipYaw,half)*sign;
 const chestLean=.10+(curve(lean,half)-.10)*k.body;
 return {px:curve(lateral,half)*sign,py:curve(height,half),pz:0,pitch,yaw:hip,roll:curve(hipRoll,half)*sign,
  lean:chestLean,twist:-hip*1.25,chestRoll:-curve(hipRoll,half)*sign*.7,squash:1+(curve(squash,half)-1)*k.stretch,
  neck:-.025,head:-(chestLean+pitch)*.70+curve(headLag,half),look:hip*.18,headRoll:-curve(hipRoll,half)*sign*.2,
  left:curve(arm,full)*k.arm,right:curve(arm,wrap(t+.4,.8))*k.arm,elbowL:curve(elbow,full),elbowR:curve(elbow,wrap(t+.4,.8)),
  spreadL:-.14,spreadR:.14,handL:curve(wrist,wrap(t-.025,.8)),handR:curve(wrist,wrap(t+.375,.8)),
  lx:l.ankle.x,ly:l.ankle.y,lz:l.ankle.z,lp:l.pitch,lk:l.pole,rx:r.ankle.x,ry:r.ankle.y,rz:r.ankle.z,rp:r.pitch,rk:r.pole};
}

export function runTelemetry(t:number){
 const l=footTrack(t,-1),r=footTrack(t,1);
 const phase=runPhase(t);
 const inFlight=!l.contact&&!r.contact;
 const phaseDetail=`${phase.index+1}/6 · ${phase.name}`;
 const lDesc=!l.contact?'Livre (no ar)':l.pitch<-.05?'Calcanhar (impacto)':l.pitch>.2?'Ponta (impulso)':'Planta (apoio)';
 const rDesc=!r.contact?'Livre (no ar)':r.pitch<-.05?'Calcanhar (impacto)':r.pitch>.2?'Ponta (impulso)':'Planta (apoio)';
 return {
  phase: phaseDetail,
  support: inFlight?'Ambos no ar (fase aérea)':phase.support==='E'?'Pé Esquerdo':'Pé Direito',
  leftContact: l.contact,
  rightContact: r.contact,
  leftDesc: lDesc,
  rightDesc: rDesc,
  inFlight,
  lPitch: l.pitch,
  rPitch: r.pitch,
  lPlantZ: l.plantZ,
  rPlantZ: r.plantZ
 };
}


export function applyRun(r:Rig,f:RunFrame){
 r.visual.position.set(f.px,f.py,f.pz);r.visual.rotation.set(f.pitch,f.yaw,f.roll);
 r.chest.rotation.set(f.lean,f.twist,f.chestRoll);r.chest.scale.set(1/Math.sqrt(f.squash),f.squash,1/Math.sqrt(f.squash));
 r.neck.rotation.set(f.neck,0,0);r.head.rotation.set(f.head,f.look,f.headRoll);
 for(const a of r.arms){const left=a.side<0;a.shoulder.rotation.set(left?f.left:f.right,0,left?f.spreadL:f.spreadR);a.elbow.rotation.set(left?f.elbowL:f.elbowR,0,0);a.hand.rotation.set(left?f.handL:f.handR,0,0);}
 const inv=r.visual.quaternion.clone().invert();
 for(const leg of r.legs){const l=leg.side<0,pitch=l?f.lp:f.rp,target=new T.Vector3(l?f.lx:f.rx,l?f.ly:f.ry,l?f.lz:f.rz);
  target.sub(r.visual.position).applyQuaternion(inv);
  const pole=new T.Vector3(l?f.lk:f.rk,.05,1).applyQuaternion(inv);
  solveLeg(leg,target,pole,inv.clone().multiply(pitchQ(pitch)));
 }
 r.physical.updateMatrixWorld(true);
}

/** Capture task-space controls from the unchanged legacy idle pose for entry/exit. */
export function captureFrame(r:Rig):RunFrame{
 const f=evaluateRun(0,'stylized');
 Object.assign(f,{px:r.visual.position.x,py:r.visual.position.y,pz:r.visual.position.z,pitch:r.visual.rotation.x,yaw:r.visual.rotation.y,roll:r.visual.rotation.z,lean:r.chest.rotation.x,twist:r.chest.rotation.y,chestRoll:r.chest.rotation.z,squash:r.chest.scale.y,neck:r.neck.rotation.x,head:r.head.rotation.x,look:r.head.rotation.y,headRoll:r.head.rotation.z});
 for(const a of r.arms){if(a.side<0){f.left=a.shoulder.rotation.x;f.spreadL=a.shoulder.rotation.z;f.elbowL=a.elbow.rotation.x;f.handL=a.hand.rotation.x;}else{f.right=a.shoulder.rotation.x;f.spreadR=a.shoulder.rotation.z;f.elbowR=a.elbow.rotation.x;f.handR=a.hand.rotation.x;}}
 r.physical.updateMatrixWorld(true);
 for(const leg of r.legs){const v=r.physical.worldToLocal(leg.foot.getWorldPosition(new T.Vector3()));if(leg.side<0){f.lx=v.x;f.ly=v.y;f.lz=v.z;f.lp=0;f.lk=0;}else{f.rx=v.x;f.ry=v.y;f.rz=v.z;f.rp=0;f.rk=0;}}
 return f;
}
export const frameKeys=Object.keys(evaluateRun(0,'stylized')) as (keyof RunFrame)[];
export function frameVelocity(a:RunFrame,b:RunFrame,dt:number){return Object.fromEntries(frameKeys.map(k=>[k,(b[k]-a[k])/dt])) as unknown as RunFrame;}
/** Inertial residual matches value AND derivative, unlike a time-only crossfade. */
export class RunTransition {
 duration=.40;elapsed=1;delta={} as RunFrame;velocity={} as RunFrame;
 start(current:RunFrame,currentV:RunFrame,target:RunFrame,targetV:RunFrame,duration=.40){this.duration=duration;this.elapsed=0;for(const k of frameKeys){this.delta[k]=current[k]-target[k];this.velocity[k]=currentV[k]-targetV[k];}}
 apply(target:RunFrame,dt:number){this.elapsed=Math.min(this.duration,this.elapsed+dt);const u=this.elapsed/this.duration,out={...target};for(const k of frameKeys)out[k]+=hermite(this.delta[k],0,this.velocity[k],0,u,this.duration);return out;}
 get active(){return this.elapsed<this.duration;}
 clear(){this.elapsed=this.duration;}
}
