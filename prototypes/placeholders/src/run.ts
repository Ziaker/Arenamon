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
const height:Key[]=[[0,1.16,-.7],[.065,1.04,0],[.14,1.13,1.1],[.23,1.24,1.2],[.31,1.30,0],[.37,1.23,-1.2],[.4,1.16,-.7]];
const lean:Key[]=[[0,.46,.4],[.075,.54,0],[.16,.50,-.4],[.245,.48,0],[.315,.43,-.3],[.4,.46,.4]];
const squash:Key[]=[[0,1,-.4],[.07,.85,0],[.17,1.02,.6],[.26,1.10,.4],[.31,1.14,0],[.36,1.04,-.5],[.4,1,-.4]];
const lateral:Key[]=[[0,-.02,-.5],[.085,-.078,0],[.19,-.05,.4],[.30,0,.3],[.4,.02,.5]];
const hipYaw:Key[]=[[0,.22,-.2],[.09,.18,-.8],[.22,-.08,-1.2],[.33,-.20,-.3],[.4,-.22,.2]];
const hipRoll:Key[]=[[0,.03,.15],[.10,.06,0],[.22,.03,-.6],[.32,-.02,-.2],[.4,-.03,-.15]];
const arm:Key[]=[[0,1.15,1.2],[.08,1.25,0],[.22,.35,-7],[.33,-.85,-3.5],[.4,-1.15,0],[.48,-1.25,0],[.62,-.35,7],[.72,.85,3.5],[.8,1.15,1.2]];
const elbow:Key[]=[[0,-1.65,-.3],[.10,-1.75,0],[.25,-1.10,2],[.38,-.55,0],[.48,-.50,0],[.62,-1.05,-2],[.74,-1.55,0],[.8,-1.65,-.3]];
const wrist:Key[]=[[0,.15,.4],[.14,.22,0],[.28,-.08,-.6],[.41,-.12,0],[.60,.04,.6],[.8,.15,.4]];
const headLag:Key[]=[[0,.03,-.2],[.05,.015,-.3],[.11,-.025,0],[.22,.01,.2],[.31,.045,0],[.4,.03,-.2]];
const rollFoot:Key[]=[[0,-.18,0],[.045,0,0],[.14,0,0],[.21,.38,8],[.27,.92,0]];
const sideKeys:Key[]=[[0,0,0],[.27,0,0],[.44,.055,0],[.61,.02,-.2],[.8,0,0]];
const poleKeys:Key[]=[[0,.15,0],[.27,.22,0],[.45,.42,0],[.62,.28,-.8],[.8,.15,0]];
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
  const q=pitchQ(.92),take=new T.Vector3(0,0,toeZ).sub(new T.Vector3(0,-ankleHeight,toeZ).applyQuaternion(q));
  const land=new T.Vector3(0,0,heelZ).sub(new T.Vector3(0,-ankleHeight,heelZ).applyQuaternion(pitchQ(-.18)));
  const z0=runTiming.landing-runTiming.speed*.27+take.z,z1=runTiming.landing+land.z;
  const z=curve([[.27,z0,-runTiming.speed],[.38,-.55,0],[.53,-.15,5.6],[.68,.44,.2],[.8,z1,-runTiming.speed]],u);
  const y=curve([[.27,take.y,0],[.36,.52,2.5],[.46,.74,0],[.59,.42,-3.2],[.70,.18,-1.5],[.8,land.y,0]],u);
  pitch=curve([[.27,.92,0],[.38,1.15,0],[.54,.45,-6],[.68,-.15,-.6],[.8,-.18,0]],u);
  ankle=new T.Vector3(side*(.24+curve(sideKeys,u)),y,z);
 }
 return {ankle,pitch,pole:side*curve(poleKeys,u),contact:u<=.27,age:u,plantZ,contactTime,pivot:pitch<0?'heel':'toe'};
}
export function evaluateRun(t:number,style:Style):RunFrame{
 const half=wrap(t,.4),sign=wrap(t,.8)<.4?1:-1,full=wrap(t,.8);
 const k=style==='contained'?{body:.75,arm:.84,stretch:.55}:style==='expressive'?{body:1.15,arm:1.12,stretch:1.35}:{body:1,arm:1,stretch:1};
 const l=footTrack(t,-1),r=footTrack(t,1),pitch=.055,hip=curve(hipYaw,half)*sign;
 const chestLean=.10+(curve(lean,half)-.10)*k.body;
 return {px:curve(lateral,half)*sign*k.body,py:curve(height,half),pz:0,pitch:.08,yaw:hip*k.body,roll:curve(hipRoll,half)*sign*k.body,
  lean:chestLean,twist:-hip*1.35*k.body,chestRoll:-curve(hipRoll,half)*sign*.8*k.body,squash:1+(curve(squash,half)-1)*k.stretch,
  neck:-.03,head:-(chestLean+.08)*.65+curve(headLag,half),look:hip*.2,headRoll:-curve(hipRoll,half)*sign*.25,
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
