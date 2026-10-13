import * as T from 'three';
import {Rig,solveLeg} from './rig';
import {State,cyclic} from './states';
import {Pose,frames,sample,restPose,blend} from './poses';
import {smooth,mix} from './curves';
import {evaluateRun,applyRun} from './run';
export type Style='contained'|'stylized'|'expressive';
export const styles:Record<Style,{body:number;stretch:number;secondary:number;limbs:number}>={contained:{body:.62,stretch:.4,secondary:.35,limbs:.82},stylized:{body:1,stretch:1,secondary:1,limbs:1},expressive:{body:1.28,stretch:1.5,secondary:1.65,limbs:1.12}};
const gaitPeriod=(r:Rig,s:State)=>s==='run'?r.spec.cadence:.8;
export function evaluate(r:Rig,s:State,t:number,style:Style):Pose{
 if(s==='run'){const f=evaluateRun(t,style);return {...restPose(r.spec.id),drop:f.py-r.spec.height,lean:f.lean,twist:f.twist,roll:f.chestRoll,head:f.head,left:f.left,right:f.right,elbowL:f.elbowL,elbowR:f.elbowR,squash:f.squash};}
 const id=r.spec.id,rest=restPose(id),keys=frames(id,s);let p=sample(keys,t);
 if(s==='idle'){
  const breath=Math.sin(t*Math.PI*2/3.2),attention=smooth(t/.4)*(1-smooth((t-1.9)/.6));
  p={...rest,drop:rest.drop+.012*breath,head:rest.head+.035*breath,look:.12*attention,neck:rest.neck+.025*breath,twist:.035*breath,squash:1+.012*breath};
 }
 if(s==='walk'){
  const run=false,cycle=gaitPeriod(r,s),u=(t/cycle)%1;
  // Contact / down / passing / up. These are planned poses, sampled twice per stride.
  const beat=u*2%1,sign=u<.5?1:-1;
  const bounce=sample([{t:0,p:{drop:-.055}},{t:.16,p:{drop:-.08},curve:'snap'},{t:.55,p:{drop:run?.05:-.015}},{t:.8,p:{drop:.005}},{t:1,p:{drop:-.055}}],beat).drop;
  p={...rest,drop:bounce,lean:run?.36:.06,roll:.035*Math.cos(u*Math.PI*2),twist:.17*Math.sin(u*Math.PI*2),head:run?-.18:rest.head,neck:0,squash:1+bounce*.20};
  const swing=(.5-smooth(beat))*(run?1.5:.75)*sign;
  p.left=swing;p.right=-swing;p.elbowL=run?-1.25:-.4;p.elbowR=p.elbowL;
 }
 const k=styles[style];
 for(const key of ['lean','roll','twist','neck','look'] as const)p[key]=mix(rest[key],p[key],k.body);
 p.drop=mix(rest.drop,p.drop,Math.min(1.12,k.body));p.squash=1+(p.squash-1)*k.stretch;
 for(const key of ['left','right','elbowL','elbowR','spread'] as const)p[key]=mix(rest[key],p[key],k.limbs);
 // Delayed response is deterministic: scrubbing and frame stepping reproduce exactly.
 const lag=.045,delayed=sample(keys,Math.max(0,t-lag));
 const envelope=cyclic(s)?1:Math.sin(Math.min(1,t/(keys[keys.length-1]?.t||1))*Math.PI);
 p.head+=(delayed.lean-p.lean)*.32*k.secondary;
 p.head+=Math.sin(t*(cyclic(s)?2*Math.PI/(s==='idle'?3.2:gaitPeriod(r,s)):8.5)-1)*.018*envelope*k.secondary;
 p.left+=(delayed.twist-p.twist)*.35*k.secondary;
 p.right-=(delayed.twist-p.twist)*.35*k.secondary;
 return p;
}
export function apply(r:Rig,p:Pose,s:State,t:number,style:Style='stylized'){
 if(s==='run'){applyRun(r,evaluateRun(t,style));return;}
 const {spec}=r;
 r.visual.rotation.set(0,0,0);
 r.visual.position.set(0,spec.height+p.drop,0);
 r.chest.rotation.set(p.lean,p.twist,p.roll);
 // Volume preservation is localized to torso. Limb lengths and physical root stay unchanged.
 r.chest.scale.set(1/Math.sqrt(p.squash),p.squash,1/Math.sqrt(p.squash));
 r.neck.rotation.set(p.neck,0,0);r.head.rotation.set(p.head,p.look,-p.roll*.4);
 for(const arm of r.arms){const left=arm.side<0;arm.shoulder.rotation.set(left?p.left:p.right,0,arm.side*p.spread);arm.elbow.rotation.set(left?p.elbowL:p.elbowR,0,0);arm.hand.rotation.set(-(left?p.elbowL:p.elbowR)*.12,0,0);}
 for(const leg of r.legs){
  let z=leg.anchor.z+leg.side*p.step,x=leg.anchor.x+leg.side*p.reach,y=0;
  if(s==='walk'){
   const run=false,period=gaitPeriod(r,s);
   // Alternate left and right foot support.
   const offset=(leg.side>0?.5:0);
   const phase=(t/period+offset)%1,stance=run?.48:.64,stride=spec.stride*(run?1:.65);
   if(phase<stance)z+=mix(stride,-stride,phase/stance);
   else{const u=(phase-stance)/(1-stance);z+=mix(-stride,stride,smooth(u));y=Math.sin(Math.PI*u)*(run?.30:.115);}
  }else{y=Math.max(0,p.lift)*(leg.side<0?1:.35);}
  // Keep both segments reachable even in extreme styles. Foot target is sole height.
  const vertical=spec.height+p.drop-.10,reach=Math.sqrt(Math.max(.001,(leg.upper+leg.lower-.008)**2-vertical**2));
  const dz=z-leg.anchor.z,dx=x-leg.anchor.x,h=Math.hypot(dx,dz),ratio=Math.min(1,reach/Math.max(.001,h));
  const target=new T.Vector3(leg.anchor.x+dx*ratio,y-vertical,leg.anchor.z+dz*ratio);
  solveLeg(leg,target);
 }
 r.physical.updateMatrixWorld(true);
}

