import * as T from 'three';
import {Anatomy} from './anatomy';
export interface Leg {hip:T.Group;knee:T.Group;foot:T.Group;anchor:T.Vector3;upper:number;lower:number;front:boolean;side:number;}
export interface Rig {spec:Anatomy;physical:T.Group;visual:T.Group;chest:T.Group;neck:T.Group;head:T.Group;arms:{shoulder:T.Group;elbow:T.Group;hand:T.Group;side:number}[];legs:Leg[];markers:T.Mesh[];materials:T.MeshStandardMaterial[];meshes:T.Mesh[];}
export function createRig(spec:Anatomy):Rig{
 const physical=new T.Group(),visual=new T.Group();physical.add(visual);
 const main=new T.MeshStandardMaterial({color:spec.color,roughness:.85});
 const materials=[main],meshes:T.Mesh[]=[],markers:T.Mesh[]=[];
 const jointMat=new T.MeshBasicMaterial({color:0xff3d83,depthTest:false});
 function box(parent:T.Object3D,size:[number,number,number],pos:[number,number,number]=[0,0,0]){const m=new T.Mesh(new T.BoxGeometry(...size),main);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);meshes.push(m);return m;}
 function joint(parent:T.Object3D,x=0,y=0,z=0){const g=new T.Group();g.position.set(x,y,z);parent.add(g);const dot=new T.Mesh(new T.BoxGeometry(.065,.065,.065),jointMat);dot.visible=false;dot.renderOrder=10;g.add(dot);markers.push(dot);return g;}
 function segment(parent:T.Object3D,length:number,width:number){box(parent,[width,Math.max(.02,length-.06),width],[0,-length/2,0]);}
 const chest=joint(visual,0,.26,0);
 box(chest,[.55,.85,.38],[0,.29,0]);
 box(visual,[spec.hipWidth*2+.12,.20,.30],[0,.05,0]);
 const neck=joint(chest,0,.70,.04);
 box(neck,[.16,spec.neck,.16],[0,spec.neck/2,0]);
 const head=joint(neck,0,spec.neck,0),headSize=.43;
 box(head,[headSize,headSize,headSize],[0,headSize/2,0]);
 const arms:Rig['arms']=[];
 for(const s of [-1,1]){
  const shoulder=joint(chest,s*(spec.body[0]+.04),.56,0),elbow=joint(shoulder,0,-spec.arm,0),hand=joint(elbow,0,-spec.forearm,0);
  segment(shoulder,spec.arm,.15);
  segment(elbow,spec.forearm,.14);
  box(hand,[.18,.20,.18],[0,-.015,0]);
  arms.push({shoulder,elbow,hand,side:s});
 }
 const legs:Leg[]=[];
 for(const s of [-1,1]){
  const front=false;
  const anchor=new T.Vector3(s*spec.hipWidth,0,0),hip=joint(visual,...anchor.toArray() as [number,number,number]),upper=front?spec.arm:spec.upper,lower=front?spec.forearm:spec.lower;
  const knee=joint(hip,0,-upper,0),foot=joint(knee,0,-lower,0);
  segment(hip,upper,.16);segment(knee,lower,.13);
  box(foot,[.22,.13,.35],[0,-.035,.055]);
  legs.push({hip,knee,foot,anchor,upper,lower,front,side:s});
 }
 physical.name=spec.name;
 return {spec,physical,visual,chest,neck,head,arms,legs,markers,materials,meshes};
}
const down=new T.Vector3(0,-1,0);
// Two-bone IK keeps designated sole targets on the floor; it only writes visual joints.
export function solveLeg(leg:Leg,target:T.Vector3,pole?:T.Vector3,footOrientation?:T.Quaternion){
 const delta=target.clone().sub(leg.anchor),distance=Math.min(delta.length(),leg.upper+leg.lower-.001),axis=delta.clone().normalize();
 const bend=pole?.clone()??new T.Vector3(0,0,leg.front?-1:1);bend.addScaledVector(axis,-bend.dot(axis)).normalize();
 const along=(leg.upper**2-leg.lower**2+distance**2)/(2*Math.max(.001,distance));
 const knee=axis.clone().multiplyScalar(along).addScaledVector(bend,Math.sqrt(Math.max(0,leg.upper**2-along**2)));
 const q1=new T.Quaternion().setFromUnitVectors(down,knee.clone().normalize());
 const q2=new T.Quaternion().setFromUnitVectors(down,delta.sub(knee).normalize());
 leg.hip.quaternion.copy(q1);leg.knee.quaternion.copy(q1.clone().invert().multiply(q2));leg.foot.quaternion.copy(q2.invert());if(footOrientation)leg.foot.quaternion.multiply(footOrientation);
}

