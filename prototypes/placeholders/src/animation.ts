import * as T from 'three';
import {Rig,solveLeg} from './rig';
import {State,cyclic} from './states';
import {Pose,frames,sample,restPose,blend} from './poses';
import {smooth,mix} from './curves';
export type Style='contained'|'stylized'|'expressive';
export const styles:Record<Style,{body:number;stretch:number;secondary:number;limbs:number}>={contained:{body:.62,stretch:.4,secondary:.35,limbs:.82},stylized:{body:1,stretch:1,secondary:1,limbs:1},expressive:{body:1.28,stretch:1.5,secondary:1.65,limbs:1.12}};
const gaitPeriod=(r:Rig,s:State)=>s==='run'?r.spec.cadence:r.spec.id==='a'?.8:1.2;
export function evaluate(r:Rig,s:State,t:number,style:Style):Pose{
 const id=r.spec.id,rest=restPose(id),keys=frames(id,s);let p=sample(keys,t);
 if(s==='idle'){
  const breath=Math.sin(t*Math.PI*2/3.2),attention=smooth(t/.4)*(1-smooth((t-1.9)/.6));
  p={...rest,drop:rest.drop+.012*breath,head:rest.head+.035*breath,look:id==='c'?.30*attention:.12*attention,neck:rest.neck+(id==='c'?.13:.025)*breath,twist:(id==='b'?.015:.035)*breath,squash:1+.012*breath};
 }
 if(s==='walk'||s==='run'){
  const run=s==='run',cycle=gaitPeriod(r,s),u=(t/cycle)%1;
  // Contact / down / passing / up. These are planned poses, sampled twice per stride.
  const beat=u*2%1,sign=u<.5?1:-1;
  const bounce=sample([{t:0,p:{drop:-.055}},{t:.16,p:{drop:id==='b'?-.12:-.08},curve:'snap'},{t:.55,p:{drop:run&&id==='a'?.05:-.015}},{t:.8,p:{drop:run&&id==='c'?.035:.005}},{t:1,p:{drop:-.055}}],beat).drop;
  p={...rest,drop:bounce,lean:run?(id==='a'?.36:id==='b'?.24:.1):id==='b'?.12:.06,roll:(id==='b'?.065:.035)*Math.cos(u*Math.PI*2),twist:(id==='c'?.055:id==='b'?.1:.17)*Math.sin(u*Math.PI*2),head:run?-.18:rest.head,neck:id==='c'?(run?.48:.25):0,squash:1+bounce*.20};
  const swing=(.5-smooth(beat))*(run?1.5:.75)*sign;
  p.left=swing;p.right=-swing;p.elbowL=run?(id==='b'?-.7:-1.25):-.4;p.elbowR=p.elbowL;
  if(id==='b'){p.left=swing*.46;p.right=-swing*.46;p.spread=.23;}
  if(id==='c'){p.neck+=.14*Math.sin(u*Math.PI*2-.7);p.tail=.25*Math.sin(u*Math.PI*2-1.1);}
 }
 const k=styles[style];
 for(const key of ['lean','roll','twist','neck','look'] as const)p[key]=mix(rest[key],p[key],k.body);
 p.drop=mix(rest.drop,p.drop,Math.min(1.12,k.body));p.squash=1+(p.squash-1)*k.stretch;
 for(const key of ['left','right','elbowL','elbowR','spread'] as const)p[key]=mix(rest[key],p[key],k.limbs);
 // Delayed response is deterministic: scrubbing and frame stepping reproduce exactly.
 const lag=id==='b'?.075:id==='c'?.095:.045,delayed=sample(keys,Math.max(0,t-lag));
 const envelope=cyclic(s)?1:Math.sin(Math.min(1,t/(keys[keys.length-1]?.t||1))*Math.PI);
 p.head+=(delayed.lean-p.lean)*.32*k.secondary;
 p.tail+=(delayed.twist-p.twist)*.9*k.secondary;
 p.head+=Math.sin(t*(cyclic(s)?2*Math.PI/(s==='idle'?3.2:gaitPeriod(r,s)):8.5)-1)*.018*envelope*k.secondary;
 p.left+=(delayed.twist-p.twist)*.35*k.secondary;
 p.right-=(delayed.twist-p.twist)*.35*k.secondary;
 return p;
}
export function apply(r:Rig,p:Pose,s:State,t:number){
 const {spec}=r;
 r.visual.position.set(0,spec.height+p.drop,0);
 r.chest.rotation.set(p.lean,p.twist,p.roll);
 // Volume preservation is localized to torso. Limb lengths and physical root stay unchanged.
 r.chest.scale.set(1/Math.sqrt(p.squash),p.squash,1/Math.sqrt(p.squash));
 r.neck.rotation.set(p.neck,0,0);r.head.rotation.set(p.head,p.look,-p.roll*.4);
 r.tail.rotation.set(Math.max(-.12,p.tail),-p.twist*.7,0);r.tailTip.rotation.set(Math.max(-.05,p.tail*.55),Math.sin(t*2*Math.PI/3.2)*.06*(s==='idle'?1:0),0);
 for(const arm of r.arms){const left=arm.side<0;arm.shoulder.rotation.set(left?p.left:p.right,0,arm.side*p.spread);arm.elbow.rotation.set(left?p.elbowL:p.elbowR,0,0);arm.hand.rotation.set(-(left?p.elbowL:p.elbowR)*.12,0,0);}
 for(const leg of r.legs){
  let z=leg.anchor.z+leg.side*p.step,x=leg.anchor.x+leg.side*p.reach,y=0;
  if(s==='walk'||s==='run'){
   const run=s==='run',period=gaitPeriod(r,s);
   // Bipeds alternate; Vésper uses diagonal walk and paired fore/hind gallop.
   const offset=spec.id==='c'?(run?(leg.front?.10:.61)+(leg.side>0?.06:0):(leg.front?0:.5)+(leg.side>0?.5:0)):(leg.side>0?.5:0);
   const phase=(t/period+offset)%1,stance=run?.48:.64,stride=spec.stride*(run?1:.65);
   if(phase<stance)z+=mix(stride,-stride,phase/stance);
   else{const u=(phase-stance)/(1-stance);z+=mix(-stride,stride,smooth(u));y=Math.sin(Math.PI*u)*(run?(spec.id==='a'?.30:.18):.115);}
  }else{y=Math.max(0,p.lift)*(leg.side<0?1:.35);}
  // Keep both segments reachable even in extreme styles. Foot target is sole height.
  const vertical=spec.height+p.drop-(spec.id==='b'?.16:.10),reach=Math.sqrt(Math.max(.001,(leg.upper+leg.lower-.008)**2-vertical**2));
  const dz=z-leg.anchor.z,dx=x-leg.anchor.x,h=Math.hypot(dx,dz),ratio=Math.min(1,reach/Math.max(.001,h));
  const target=new T.Vector3(leg.anchor.x+dx*ratio,y-vertical,leg.anchor.z+dz*ratio);
  solveLeg(leg,target);
 }
 r.physical.updateMatrixWorld(true);
 // Bulky fists must clear the ground during compression. Adjust the elbow, never the root.
 if(spec.id==='b')for(const arm of r.arms){for(let i=0;i<8;i++){const bottom=new T.Box3().setFromObject(arm.hand).min.y;if(bottom>=.012)break;arm.elbow.rotation.x-=Math.min(.3,(.015-bottom)*3);r.physical.updateMatrixWorld(true);}}
}

