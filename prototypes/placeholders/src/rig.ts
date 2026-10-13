import * as T from 'three';
import {Anatomy} from './anatomy';
export interface Leg {hip:T.Group;knee:T.Group;foot:T.Group;anchor:T.Vector3;upper:number;lower:number;front:boolean;side:number;}
export interface Rig {spec:Anatomy;physical:T.Group;visual:T.Group;chest:T.Group;neck:T.Group;head:T.Group;tail:T.Group;tailTip:T.Group;arms:{shoulder:T.Group;elbow:T.Group;hand:T.Group;side:number}[];legs:Leg[];markers:T.Mesh[];materials:T.MeshStandardMaterial[];meshes:T.Mesh[];}
export function createRig(spec:Anatomy):Rig{
 const physical=new T.Group(),visual=new T.Group();physical.add(visual);
 const main=new T.MeshStandardMaterial({color:spec.color,roughness:.67}),dark=new T.MeshStandardMaterial({color:spec.dark,roughness:.8}),pale=new T.MeshStandardMaterial({color:0xf1eee3,roughness:.6}),eye=new T.MeshStandardMaterial({color:0x10242d,roughness:.6});
 const materials=[main,dark,pale,eye],meshes:T.Mesh[]=[],markers:T.Mesh[]=[];
 const jointMat=new T.MeshBasicMaterial({color:0xff3d83,depthTest:false});
 function mesh(parent:T.Object3D,geo:T.BufferGeometry,mat:T.MeshStandardMaterial,pos:[number,number,number]=[0,0,0],scale:[number,number,number]=[1,1,1]){const m=new T.Mesh(geo,mat);m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);meshes.push(m);return m;}
 const sphere=()=>new T.SphereGeometry(1,16,12);
 function joint(parent:T.Object3D,x=0,y=0,z=0){const g=new T.Group();g.position.set(x,y,z);parent.add(g);const dot=new T.Mesh(new T.SphereGeometry(.043,8,6),jointMat);dot.visible=false;dot.renderOrder=10;g.add(dot);markers.push(dot);return g;}
 function segment(parent:T.Object3D,length:number,width:number,mat=main){mesh(parent,new T.CapsuleGeometry(width,Math.max(.01,length-2*width),4,10),mat,[0,-length/2,0]);}
 const chest=joint(visual,0,spec.id==='c'?0:.26,0);
 mesh(chest,sphere(),main,[0,spec.id==='c'?0:.29,0],spec.body);
 // Distinct core shapes: tapered leaper, broad wedge, horizontal segmented animal.
 if(spec.id==='a')mesh(visual,new T.ConeGeometry(.32,.43,5),dark,[0,.04,0]);
 if(spec.id==='b')mesh(chest,new T.BoxGeometry(1.22,.44,.7),dark,[0,.05,0]);
 const neck=joint(chest,0,spec.id==='c'?.13:.70,spec.id==='c'?.62:.04);
 mesh(neck,sphere(),main,[0,spec.neck/2,0],[spec.id==='c'?.14:.19,spec.neck/2+.06,spec.id==='c'?.18:.2]);
 const head=joint(neck,0,spec.neck,0);
 mesh(head,spec.id==='a'?new T.DodecahedronGeometry(1):sphere(),main,[0,.10,.08],spec.head);
 mesh(head,new T.BoxGeometry(spec.head[0]*1.5,.075,.08),dark,[0,.14,spec.head[2]+.03]);
 for(const s of [-1,1]){mesh(head,new T.BoxGeometry(.075,.062,.038),pale,[s*spec.head[0]*.48,.145,spec.head[2]+.077]);mesh(head,new T.BoxGeometry(.028,.045,.025),eye,[s*spec.head[0]*.48,.145,spec.head[2]+.104]);}
 const tail=joint(chest,0,-.04,-spec.body[2]*.88),tailTip=joint(tail,0,0,spec.id==='c'?-.48:-.2);
 if(spec.id==='c'){mesh(tail,sphere(),main,[0,0,-.23],[.18,.17,.39]);mesh(tailTip,new T.ConeGeometry(.18,.72,5),dark,[0,0,-.27]).rotation.x=-Math.PI/2;}
 const arms:Rig['arms']=[];
 if(spec.id!=='c')for(const s of [-1,1]){
  const shoulder=joint(chest,s*(spec.body[0]+.04),.56,0),elbow=joint(shoulder,0,-spec.arm,0),hand=joint(elbow,0,-spec.forearm,0);
  segment(shoulder,spec.arm,spec.id==='b'?.25:.105);mesh(shoulder,sphere(),main,[0,-.045,0],spec.id==='b'?[.36,.31,.32]:[.14,.16,.14]);
  mesh(elbow,sphere(),dark,[0,0,0],spec.id==='b'?[.21,.21,.21]:[.09,.09,.09]);segment(elbow,spec.forearm,spec.id==='b'?.26:.09,dark);mesh(hand,spec.id==='b'?new T.BoxGeometry(.47,.37,.45):sphere(),main,[0,-.035,.045],spec.id==='b'?[1,1,1]:[.13,.18,.15]);arms.push({shoulder,elbow,hand,side:s});
 }
 const legs:Leg[]=[];
 for(const front of spec.id==='c'?[false,true]:[false])for(const s of [-1,1]){
  const anchor=new T.Vector3(s*spec.hipWidth,0,spec.id==='c'?(front?.61:-.60):0),hip=joint(visual,...anchor.toArray() as [number,number,number]),upper=front?spec.arm:spec.upper,lower=front?spec.forearm:spec.lower;
  const knee=joint(hip,0,-upper,0),foot=joint(knee,0,-lower,0);
  segment(hip,upper,spec.id==='b'?.22:spec.id==='a'?.115:.105);const radius=spec.id==='b'?.17:.085;mesh(knee,sphere(),dark,[0,0,0],[radius,radius,radius]);segment(knee,lower,spec.id==='b'?.095:.08,dark);
  // Ankle clearance matches the calf thickness; the heavy creature has a deeper foot.
  mesh(foot,new T.BoxGeometry(spec.id==='b'?.42:.23,spec.id==='b'?.20:.13,spec.id==='a'?.40:.32),main,[0,spec.id==='b'?-.06:-.035,.055]);
  legs.push({hip,knee,foot,anchor,upper,lower,front,side:s});
 }
 physical.name=spec.name;
 return {spec,physical,visual,chest,neck,head,tail,tailTip,arms,legs,markers,materials,meshes};
}
const down=new T.Vector3(0,-1,0);
// Two-bone IK keeps designated sole targets on the floor; it only writes visual joints.
export function solveLeg(leg:Leg,target:T.Vector3){
 const delta=target.clone().sub(leg.anchor),distance=Math.min(delta.length(),leg.upper+leg.lower-.001),axis=delta.clone().normalize();
 const bend=new T.Vector3(0,0,leg.front?-1:1);bend.addScaledVector(axis,-bend.dot(axis)).normalize();
 const along=(leg.upper**2-leg.lower**2+distance**2)/(2*Math.max(.001,distance));
 const knee=axis.clone().multiplyScalar(along).addScaledVector(bend,Math.sqrt(Math.max(0,leg.upper**2-along**2)));
 const q1=new T.Quaternion().setFromUnitVectors(down,knee.clone().normalize());
 const q2=new T.Quaternion().setFromUnitVectors(down,delta.sub(knee).normalize());
 leg.hip.quaternion.copy(q1);leg.knee.quaternion.copy(q1.clone().invert().multiply(q2));leg.foot.quaternion.copy(q2.invert());
}
