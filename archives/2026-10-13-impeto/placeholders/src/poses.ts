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
  rest:p({lean:.12,left:.35,right:-.25,elbowL:-.75,elbowR:-.95,spread:.18,head:-.04}),
  coil:p({drop:-.25,lean:-.20,twist:-.27,left:.8,right:-.65,elbowL:-.5,elbowR:-1.5,head:.15,squash:.92,step:.18}),
  launch:p({drop:-.10,lean:.64,twist:.24,left:1.0,right:-1.25,elbowL:-.30,elbowR:-1.2,head:-.48,squash:1.09,step:.55,lift:.12}),
  land:p({drop:-.27,lean:.36,left:-.5,right:.6,elbowL:-1.0,elbowR:-.8,head:-.2,squash:.92,step:-.2}),
  // Distinct Tackle Poses - violent horizontal ram
  tackleCoil:p({drop:-.28,lean:-.30,twist:-.40,left:-1.2,right:-1.1,elbowL:-1.5,elbowR:-1.4,head:.22,squash:.88,step:.26,reach:-.06}),
  tackleLaunch:p({drop:-.06,lean:.85,twist:.38,left:1.35,right:-1.45,elbowL:-.40,elbowR:-1.1,head:-.58,squash:1.16,step:.72,reach:.14,lift:.16}),
  tackleImpact:p({drop:-.12,lean:.78,twist:.30,left:.95,right:-1.10,elbowL:-.55,elbowR:-.85,head:-.45,squash:1.08,step:.55,lift:.10}),
  tackleBrake:p({drop:-.26,lean:.24,twist:-.16,left:-.75,right:.85,elbowL:-1.25,elbowR:-.80,head:.14,squash:.86,step:-.35}),
  // Distinct Dodge Forward Poses - low evasive slip
  frontDrop:p({drop:-.34,lean:.42,twist:.08,left:-.85,right:-.85,elbowL:-1.65,elbowR:-1.65,head:.30,squash:.80,step:.15}),
  frontSlide:p({drop:-.16,lean:.58,twist:.16,left:.40,right:-.40,elbowL:-.90,elbowR:-.90,head:-.25,squash:1.10,step:.52,lift:.08}),
  // Guard - fortified combat shell
  guard:p({drop:-.18,lean:.20,twist:-.28,left:-1.25,right:-1.05,elbowL:-1.95,elbowR:-1.80,spread:.24,head:-.12,neck:.04,step:.25,squash:.93}),
  // Hit - sharp localized whiplash
  hit:p({drop:-.08,lean:-.58,twist:.72,roll:.30,head:-.45,neck:-.12,left:-1.20,right:1.15,elbowL:-1.95,elbowR:-.20,squash:.88,step:-.38}),
  // Push - wide inertial balance loss
  push:p({drop:-.20,lean:-.45,roll:-.14,twist:-.20,head:.35,neck:.08,left:-.98,right:-.88,elbowL:-.18,elbowR:-.18,spread:.88,step:-.58,lift:.08,squash:.96}),
  // Side dodge - dynamic bank angle
  side:p({drop:-.14,lean:.24,roll:-.52,twist:.34,left:-.75,right:1.40,elbowL:-1.65,elbowR:-.35,spread:.85,head:.16,step:.25,lift:.15,squash:1.08}),
  // Back dodge - acrobatic spring
  back:p({drop:-.06,lean:-.48,twist:-.14,left:-1.25,right:-1.15,elbowL:-1.35,elbowR:-1.25,head:.30,squash:1.14,step:-.52,lift:.22})
 }
};
export const restPose=(id:Species)=>({...vocabulary[id].rest});
export function frames(id:Species,s:State):Frame[]{
 const v=vocabulary[id],r=v.rest,c=v.coil,land=v.land;
 const f=(t:number,p:Pose,curve:Ease='smooth'):Frame=>({t,p,curve});
 const rebound=blend(r,land,-.24),d=duration(s),early=.045;
 if(s==='run')return runCycleFrames();
 if(s==='guard')return [f(0,r),f(.18,v.guard,'snap'),f(d,v.guard)];
 if(s==='prepare')return [f(0,r),f(.32,v.tackleCoil),f(.55,{...v.tackleCoil,head:v.tackleCoil.head-.08}),f(d,v.tackleCoil)];
 if(s==='tackle'){
  return [f(0,r),f(early,v.tackleCoil,'snap'),f(.12,v.tackleLaunch,'snap'),f(.26,v.tackleImpact,'smooth'),f(d,v.tackleBrake,'settle')];
 }
 if(s==='front'){
  return [f(0,r),f(early,v.frontDrop,'snap'),f(.12,v.frontSlide,'snap'),f(.28,v.frontSlide,'smooth'),f(d,land,'settle')];
 }
 if(s==='side'){
  return [f(0,r),f(early,c,'snap'),f(.12,v.side,'snap'),f(.28,{...v.side,head:v.side.head+.1,step:-v.side.step*.5}),f(d,land,'settle')];
 }
 if(s==='back'){
  return [f(0,r),f(early,c,'snap'),f(.12,v.back,'snap'),f(.28,{...v.back,head:v.back.head+.1,step:-v.back.step*.5}),f(d,land,'settle')];
 }
 if(s==='recover')return [f(0,land),f(.09,{...land,drop:land.drop-.02}),f(.23,rebound,'snap'),f(.46,blend(r,land,.16)),f(d,r)];
 if(s==='hit')return [f(0,r),f(.055,v.hit,'snap'),f(.13,{...v.hit,head:v.hit.head-.18}),f(.30,{...v.hit,drop:v.hit.drop-.05,step:-v.hit.step*.6}),f(.60,{...land,twist:-v.hit.twist*.25}),f(.80,rebound),f(d,r)];
 if(s==='push')return [f(0,r),f(.20,v.push,'settle'),f(.38,{...v.push,step:-v.push.step*.6,lift:.06}),f(.62,{...land,neck:0}),f(.84,rebound),f(d,r)];
 if(s==='blocked')return [f(0,v.tackleImpact),f(.055,{...v.hit,twist:-v.tackleImpact.twist,drop:land.drop},'snap'),f(.16,{...v.push,head:v.hit.head*.6}),f(.3,r)];
 if(s==='turn')return [f(0,r),f(.16,{...r,look:-.5,twist:-.2}),f(.48,{...r,twist:-.3,roll:.08,step:.17}),f(.82,{...r,twist:.17,look:.18,step:-.12}),f(d,r)];
 return [f(0,r),f(d,r)];
}
export function sample(keys:Frame[],t:number):Pose{
 let i=0;while(i<keys.length-2&&t>keys[i+1].t)i++;
 const a=keys[i],b=keys[i+1];return blend(p(a.p),p(b.p),ease((t-a.t)/(b.t-a.t),b.curve));
}
