import {Species} from './anatomy';
import {State,duration} from './states';
import {Ease,ease,mix} from './curves';
export const neutral={drop:0,lean:0,roll:0,twist:0,neck:0,head:0,look:0,tail:0,squash:1,left:0,right:0,elbowL:0,elbowR:0,spread:.12,reach:0,step:0,lift:0};
export type Pose=typeof neutral;
export type Frame={t:number;p:Partial<Pose>;curve?:Ease};
const p=(v:Partial<Pose>):Pose=>({...neutral,...v});
export const blend=(a:Pose,b:Pose,u:number):Pose=>Object.fromEntries((Object.keys(a) as (keyof Pose)[]).map(k=>[k,mix(a[k],b[k],u)])) as Pose;
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
 },
 b:{
  rest:p({drop:-.04,lean:.04,left:-.12,right:.05,elbowL:-.25,elbowR:-.3,spread:.17}),
  coil:p({drop:-.18,lean:-.23,twist:-.34,left:.4,right:-.5,elbowL:-.7,elbowR:-1.2,head:.18,squash:.91,step:.09}),
  launch:p({drop:-.15,lean:.45,twist:.38,left:.35,right:-.95,elbowL:-.7,elbowR:-1.6,head:-.32,squash:1.04,step:.24}),
  land:p({drop:-.21,lean:.3,left:-.3,right:-.5,elbowL:-.5,elbowR:-.7,head:.13,squash:.9,step:-.1}),
  guard:p({drop:-.13,lean:.23,left:-.85,right:-.9,elbowL:-1.5,elbowR:-1.55,spread:.3,head:-.18,step:.12}),
  hit:p({drop:-.16,lean:-.2,twist:-.3,roll:-.12,head:-.29,left:-.6,right:.3,elbowL:-1.2,elbowR:-.5,squash:.88,step:-.12}),
  push:p({drop:-.15,lean:-.18,left:-.32,right:-.3,elbowL:-.2,elbowR:-.2,spread:.35,head:.18,step:-.23}),
  side:p({drop:-.19,lean:.2,roll:-.23,twist:-.12,left:.25,right:-.7,elbowL:-.6,elbowR:-1.1,spread:.32,step:.11}),
  back:p({drop:-.2,lean:-.19,left:-.5,right:-.55,elbowL:-.8,elbowR:-.8,head:.15,step:-.2})
 },
 c:{
  rest:p({lean:-.04,neck:.18,head:-.10,tail:.1}),
  coil:p({drop:-.13,lean:-.12,neck:-.8,head:.55,tail:-.6,twist:.16,squash:.93,step:.1}),
  launch:p({drop:-.1,lean:.2,neck:.85,head:-.6,tail:.43,twist:-.15,squash:1.06,step:.28,lift:.07}),
  land:p({drop:-.19,lean:.12,neck:-.5,head:.32,tail:-.32,squash:.94,step:-.12}),
  guard:p({drop:-.17,lean:.06,neck:-1.0,head:.77,tail:-.35,reach:.10,step:.12}),
  hit:p({drop:-.14,lean:-.1,roll:.14,twist:.3,neck:-.55,head:-.4,look:.5,tail:-.5,squash:.93,step:-.2}),
  push:p({drop:-.12,lean:-.20,neck:-.45,head:.1,tail:.6,reach:.14,step:-.28}),
  side:p({drop:-.15,lean:.03,roll:-.16,twist:.24,neck:-.5,head:.3,look:-.5,tail:.45,step:.22,reach:.12,lift:.06}),
  back:p({drop:-.17,lean:-.16,neck:-.65,head:.4,tail:-.3,step:-.25,lift:.07})
 }
};
export const restPose=(id:Species)=>({...vocabulary[id].rest});
export function frames(id:Species,s:State):Frame[]{
 const v=vocabulary[id],r=v.rest,c=v.coil,l=v.launch,land=v.land;
 const f=(t:number,p:Pose,curve:Ease='smooth'):Frame=>({t,p,curve});
 const rebound=blend(r,land,-.24),d=duration(s),early=id==='a'?.045:id==='b'?.08:.06;
 if(s==='guard')return [f(0,r),f(.22,v.guard,'snap'),f(d,v.guard)];
 if(s==='prepare')return [f(0,r),f(.32,c),f(.55,{...c,head:c.head-.08}),f(d,c)];
 if(s==='front'||s==='tackle'||s==='side'||s==='back'){
  const peak=s==='side'?v.side:s==='back'?v.back:s==='tackle'?{...l,twist:l.twist*1.25}:l;
  return [f(0,r),f(early,c,'snap'),f(id==='a'?.105:.15,peak,'snap'),f(.29,{...peak,head:peak.head+.1,step:-peak.step*.6}),f(.4,land,'settle')];
 }
 if(s==='recover')return [f(0,land),f(.09,{...land,drop:land.drop-.02}),f(id==='b'?.36:.23,rebound,'snap'),f(.46,blend(r,land,.16)),f(d,r)];
 if(s==='hit')return [f(0,r),f(.065,v.hit,'snap'),f(.12,{...v.hit,head:v.hit.head-.17}),f(id==='b'?.40:.3,{...v.hit,drop:v.hit.drop-.04,step:-v.hit.step*.6}),f(.62,{...land,twist:-v.hit.twist*.22}),f(.8,rebound),f(d,r)];
 if(s==='push')return [f(0,r),f(.21,v.push,'settle'),f(.38,{...v.push,step:-v.push.step*.6,lift:.045}),f(.60,{...land,neck:id==='c'?.35:0}),f(.82,rebound),f(d,r)];
 if(s==='blocked')return [f(0,l),f(.055,{...v.hit,twist:-l.twist,drop:land.drop},'snap'),f(.16,{...v.push,head:v.hit.head*.6}),f(.3,r)];
 if(s==='turn')return [f(0,r),f(.16,{...r,look:-.5,twist:-.2}),f(.48,{...r,twist:-.3,roll:.08,step:.17}),f(.82,{...r,twist:.17,look:.18,step:-.12}),f(d,r)];
 return [f(0,r),f(d,r)];
}
export function sample(keys:Frame[],t:number):Pose{
 let i=0;while(i<keys.length-2&&t>keys[i+1].t)i++;
 const a=keys[i],b=keys[i+1];return blend(p(a.p),p(b.p),ease((t-a.t)/(b.t-a.t),b.curve));
}
