import {Species} from './anatomy';
import {State,duration} from './states';
import {Ease,ease,mix} from './curves';
export const neutral={
  drop:0,lean:0,roll:0,twist:0,neck:0,head:0,look:0,tail:0,squash:1,
  left:0,right:0,elbowL:0,elbowR:0,spread:.12,reach:0,step:0,lift:0,
  pelvisX:0,pelvisZ:0,pelvisPitch:0,pelvisYaw:0,pelvisRoll:0,
  footPitchL:0,footPitchR:0,footRollL:0,footRollR:0
};
export type Pose=typeof neutral;
export type Frame={t:number;p:Partial<Pose>;curve?:Ease};
const p=(v:Partial<Pose>):Pose=>({...neutral,...v});
export const blend=(a:Pose,b:Pose,u:number):Pose=>Object.fromEntries((Object.keys(a) as (keyof Pose)[]).map(k=>[k,mix(a[k],b[k],u)])) as Pose;

export const runCycleFrames = (): Frame[] => [
  { t: 0.00, p: {
    drop: -0.045, squash: 1.00,
    pelvisX: -0.012, pelvisZ: 0.00, pelvisPitch: 0.08, pelvisYaw: 0.20, pelvisRoll: -0.02,
    lean: 0.38, twist: -0.26, roll: 0.04, head: -0.14, neck: 0.02,
    left: -0.85, right: 0.95, elbowL: -0.70, elbowR: -1.35, spread: 0.18,
    footPitchL: 0.05, footPitchR: -0.20
  }, curve: 'smooth' },
  { t: 0.05, p: {
    drop: -0.085, squash: 0.88,
    pelvisX: -0.038, pelvisZ: -0.01, pelvisPitch: 0.10, pelvisYaw: 0.12, pelvisRoll: 0.05,
    lean: 0.42, twist: -0.32, roll: -0.03, head: -0.10, neck: 0.04,
    left: -1.05, right: 1.15, elbowL: -0.85, elbowR: -1.50, spread: 0.20,
    footPitchL: 0.00, footPitchR: -0.12
  }, curve: 'snap' },
  { t: 0.11, p: {
    drop: -0.015, squash: 1.02,
    pelvisX: -0.022, pelvisZ: 0.00, pelvisPitch: 0.06, pelvisYaw: 0.02, pelvisRoll: 0.01,
    lean: 0.36, twist: -0.08, roll: 0.00, head: -0.16, neck: 0.00,
    left: -0.55, right: 0.55, elbowL: -0.95, elbowR: -1.20, spread: 0.17,
    footPitchL: 0.00, footPitchR: 0.05
  }, curve: 'smooth' },
  { t: 0.17, p: {
    drop: 0.035, squash: 1.08,
    pelvisX: -0.005, pelvisZ: 0.01, pelvisPitch: 0.05, pelvisYaw: -0.15, pelvisRoll: -0.03,
    lean: 0.34, twist: 0.15, roll: 0.03, head: -0.18, neck: -0.02,
    left: 0.15, right: -0.15, elbowL: -1.10, elbowR: -0.80, spread: 0.16,
    footPitchL: 0.70, footPitchR: 0.15
  }, curve: 'snap' },
  { t: 0.23, p: {
    drop: 0.068, squash: 1.12,
    pelvisX: 0.008, pelvisZ: 0.02, pelvisPitch: 0.04, pelvisYaw: -0.18, pelvisRoll: -0.02,
    lean: 0.32, twist: 0.22, roll: 0.02, head: -0.16, neck: -0.01,
    left: 0.65, right: -0.65, elbowL: -1.30, elbowR: -0.65, spread: 0.16,
    footPitchL: 0.20, footPitchR: -0.10
  }, curve: 'smooth' },
  { t: 0.27, p: {
    drop: 0.005, squash: 1.02,
    pelvisX: 0.022, pelvisZ: 0.01, pelvisPitch: 0.06, pelvisYaw: -0.20, pelvisRoll: -0.01,
    lean: 0.36, twist: 0.25, roll: -0.02, head: -0.14, neck: 0.01,
    left: 0.80, right: -0.80, elbowL: -1.32, elbowR: -0.62, spread: 0.17,
    footPitchL: -0.15, footPitchR: 0.02
  }, curve: 'smooth' },
  { t: 0.30, p: {
    drop: -0.045, squash: 1.00,
    pelvisX: 0.012, pelvisZ: 0.00, pelvisPitch: 0.08, pelvisYaw: -0.20, pelvisRoll: 0.02,
    lean: 0.38, twist: 0.26, roll: -0.04, head: -0.14, neck: 0.02,
    left: 0.95, right: -0.85, elbowL: -1.35, elbowR: -0.70, spread: 0.18,
    footPitchL: -0.20, footPitchR: 0.05
  }, curve: 'smooth' },
  { t: 0.35, p: {
    drop: -0.085, squash: 0.88,
    pelvisX: 0.038, pelvisZ: -0.01, pelvisPitch: 0.10, pelvisYaw: -0.12, pelvisRoll: -0.05,
    lean: 0.42, twist: 0.32, roll: 0.03, head: -0.10, neck: 0.04,
    left: 1.15, right: -1.05, elbowL: -1.50, elbowR: -0.85, spread: 0.20,
    footPitchL: -0.12, footPitchR: 0.00
  }, curve: 'snap' },
  { t: 0.41, p: {
    drop: -0.015, squash: 1.02,
    pelvisX: 0.022, pelvisZ: 0.00, pelvisPitch: 0.06, pelvisYaw: -0.02, pelvisRoll: -0.01,
    lean: 0.36, twist: 0.08, roll: 0.00, head: -0.16, neck: 0.00,
    left: 0.55, right: -0.55, elbowL: -1.20, elbowR: -0.95, spread: 0.17,
    footPitchL: 0.05, footPitchR: 0.00
  }, curve: 'smooth' },
  { t: 0.47, p: {
    drop: 0.035, squash: 1.08,
    pelvisX: 0.005, pelvisZ: 0.01, pelvisPitch: 0.05, pelvisYaw: 0.15, pelvisRoll: 0.03,
    lean: 0.34, twist: -0.15, roll: -0.03, head: -0.18, neck: -0.02,
    left: -0.15, right: 0.15, elbowL: -0.80, elbowR: -1.10, spread: 0.16,
    footPitchL: 0.15, footPitchR: 0.70
  }, curve: 'snap' },
  { t: 0.53, p: {
    drop: 0.068, squash: 1.12,
    pelvisX: -0.008, pelvisZ: 0.02, pelvisPitch: 0.04, pelvisYaw: 0.18, pelvisRoll: 0.02,
    lean: 0.32, twist: -0.22, roll: -0.02, head: -0.16, neck: -0.01,
    left: -0.65, right: 0.65, elbowL: -0.65, elbowR: -1.30, spread: 0.16,
    footPitchL: -0.10, footPitchR: 0.20
  }, curve: 'smooth' },
  { t: 0.57, p: {
    drop: 0.005, squash: 1.02,
    pelvisX: -0.022, pelvisZ: 0.01, pelvisPitch: 0.06, pelvisYaw: 0.20, pelvisRoll: 0.01,
    lean: 0.36, twist: -0.25, roll: 0.02, head: -0.14, neck: 0.01,
    left: -0.80, right: 0.80, elbowL: -0.62, elbowR: -1.32, spread: 0.17,
    footPitchL: 0.02, footPitchR: -0.15
  }, curve: 'smooth' },
  { t: 0.60, p: {
    drop: -0.045, squash: 1.00,
    pelvisX: -0.012, pelvisZ: 0.00, pelvisPitch: 0.08, pelvisYaw: 0.20, pelvisRoll: -0.02,
    lean: 0.38, twist: -0.26, roll: 0.04, head: -0.14, neck: 0.02,
    left: -0.85, right: 0.95, elbowL: -0.70, elbowR: -1.35, spread: 0.18,
    footPitchL: 0.05, footPitchR: -0.20
  }, curve: 'smooth' }
];

// Authored anatomical pose vocabulary. Numbers are radians / metres, not combat attributes.
const vocabulary:Record<Species,Record<string,Pose>>={
 a:{
  rest:p({lean:.08,left:.2,right:-.15,elbowL:-.48,elbowR:-.7,spread:.15}),
  coil:p({drop:-.25,lean:-.20,twist:-.27,left:.8,right:-.65,elbowL:-.5,elbowR:-1.5,head:.15,squash:.92,step:.18}),
  launch:p({drop:-.10,lean:.64,twist:.24,left:1.0,right:-1.25,elbowL:-.30,elbowR:-1.2,head:-.48,squash:1.09,step:.55,lift:.12}),
  land:p({drop:-.27,lean:.36,left:-.5,right:.6,elbowL:-1.0,elbowR:-.8,head:-.2,squash:.92,step:-.2}),
  guard:p({drop:-.18,lean:.18,twist:-.3,left:-1.1,right:-.85,elbowL:-1.8,elbowR:-1.65,spread:.3,head:-.10,step:.23}),
  hit:p({drop:-.11,lean:-.42,twist:.58,roll:.2,head:-.3,left:-.9,right:.9,elbowL:-1.8,elbowR:-.25,squash:.92,step:-.32}),
  push:p({drop:-.15,lean:-.3,roll:-.07,left:-.8,right:-.65,elbowL:-.3,elbowR:-.3,spread:.6,head:.22,step:-.45}),
  side:p({drop:-.23,lean:.18,roll:-.34,twist:.24,left:-.5,right:1.2,elbowL:-1.5,elbowR:-.4,spread:.7,head:.1,step:.13,lift:.07}),
  back:p({drop:-.22,lean:-.28,left:-1.0,right:-.9,elbowL:-1.2,elbowR:-1.1,head:.18,squash:1.07,step:-.35,lift:.13})
 }
};
export const restPose=(id:Species)=>({...vocabulary[id].rest});
export function frames(id:Species,s:State):Frame[]{
 const v=vocabulary[id],r=v.rest,c=v.coil,l=v.launch,land=v.land;
 const f=(t:number,p:Pose,curve:Ease='smooth'):Frame=>({t,p,curve});
 const rebound=blend(r,land,-.24),d=duration(s),early=.045;
 if(s==='run')return runCycleFrames();
 if(s==='guard')return [f(0,r),f(.22,v.guard,'snap'),f(d,v.guard)];
 if(s==='prepare')return [f(0,r),f(.32,c),f(.55,{...c,head:c.head-.08}),f(d,c)];
 if(s==='front'||s==='tackle'||s==='side'||s==='back'){
  const peak=s==='side'?v.side:s==='back'?v.back:s==='tackle'?{...l,twist:l.twist*1.25}:l;
  return [f(0,r),f(early,c,'snap'),f(.105,peak,'snap'),f(.29,{...peak,head:peak.head+.1,step:-peak.step*.6}),f(.4,land,'settle')];
 }
 if(s==='recover')return [f(0,land),f(.09,{...land,drop:land.drop-.02}),f(.23,rebound,'snap'),f(.46,blend(r,land,.16)),f(d,r)];
 if(s==='hit')return [f(0,r),f(.065,v.hit,'snap'),f(.12,{...v.hit,head:v.hit.head-.17}),f(.3,{...v.hit,drop:v.hit.drop-.04,step:-v.hit.step*.6}),f(.62,{...land,twist:-v.hit.twist*.22}),f(.8,rebound),f(d,r)];
 if(s==='push')return [f(0,r),f(.21,v.push,'settle'),f(.38,{...v.push,step:-v.push.step*.6,lift:.045}),f(.60,{...land,neck:0}),f(.82,rebound),f(d,r)];
 if(s==='blocked')return [f(0,l),f(.055,{...v.hit,twist:-l.twist,drop:land.drop},'snap'),f(.16,{...v.push,head:v.hit.head*.6}),f(.3,r)];
 if(s==='turn')return [f(0,r),f(.16,{...r,look:-.5,twist:-.2}),f(.48,{...r,twist:-.3,roll:.08,step:.17}),f(.82,{...r,twist:.17,look:.18,step:-.12}),f(d,r)];
 return [f(0,r),f(d,r)];
}
export function sample(keys:Frame[],t:number):Pose{
 let i=0;while(i<keys.length-2&&t>keys[i+1].t)i++;
 const a=keys[i],b=keys[i+1];return blend(p(a.p),p(b.p),ease((t-a.t)/(b.t-a.t),b.curve));
}
