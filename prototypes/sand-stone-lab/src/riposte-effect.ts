import * as T from 'three';
import {Particles} from './particles.js';
import type {Variant} from './config.ts';
import {TAU,smooth,hue,luminous,addMesh,fadeTree,arc,Ribbon,Shards} from './vfx-shapes.ts';
type Params=Record<string,number>;
// Snapshot of origin/main calibration + controller, inspected on GitHub 2026-10-22.
export const RIPOSTE_TIMING={cast:.65,windowStart:0,windowEnd:.59,strikeRange:3.8};
function wedge(){const s=new T.Shape();s.moveTo(-.12,0);s.lineTo(-.3,.65);s.lineTo(0,1);s.lineTo(.3,.65);s.lineTo(.12,0);s.closePath();return new T.ShapeGeometry(s);}
function fighter(parent:T.Object3D,color:number){const g=new T.Group();parent.add(g);const m=new T.MeshStandardMaterial({color,roughness:.6,metalness:.2});const body=addMesh(g,new T.CapsuleGeometry(.24,.5,5,12),m);body.position.y=.65;body.castShadow=true;for(const sign of [-1,1]){const arm=addMesh(g,new T.BoxGeometry(.12,.4,.15),m);arm.position.set(sign*.27,.65,.2);arm.rotation.z=sign*.6;}return g;}
export class RiposteEffect {
 duration:number;phase='Início da guarda';punch=0;readonly defender:T.Group;readonly guard=new T.Group();readonly counter=new T.Group();readonly success:boolean;readonly contact:number;
 private p:Params;private variant:Variant;private particles:Particles;private attacker:T.Group;private incoming:T.Mesh;private petals:T.Mesh[]=[];private cuts:T.Mesh[]=[];private impacts:T.Mesh[]=[];private impact=new T.Group();private ribbons:Ribbon[]=[];private debris:Shards;private blocked=false;private hit=false;private floor:T.Mesh;private color:T.Color;private failed:T.Color;
 constructor(group:T.Group,particles:Particles,variant:Variant,p:Params){
  Object.assign(this,{p,variant,particles});this.contact=p.scenario===2?.62:p.contactTime;this.success=p.scenario===0;this.duration=RIPOSTE_TIMING.cast+.75*p.decay;
  this.color=hue(p.primaryHue,.65);this.failed=new T.Color(0xf56c65);const white=new T.Color(0xf5f5dd),steel=new T.Color(0x96bed9);
  this.defender=fighter(group,0xa2b4c3);this.defender.position.z=-1.9;this.attacker=fighter(group,0x785959);this.attacker.position.z=1.9;this.attacker.rotation.y=Math.PI;
  group.add(this.guard,this.counter,this.impact);this.guard.position.set(0,.9,-1.45);this.counter.position.set(0,.9,-1.9);this.impact.position.set(0,.9,1.9);
  this.floor=arc(group,.6,.025,steel,.6);this.floor.rotation.x=-Math.PI/2;this.floor.position.set(0,.035,-1.9);
  if(variant===0){
   for(let i=0;i<6;i++){const petal=addMesh(this.guard,wedge(),luminous(this.color,.65*p.opacity));petal.rotation.z=i/6*TAU;this.petals.push(petal);}
   const boss=addMesh(this.guard,new T.OctahedronGeometry(.18),luminous(white,.65));this.petals.push(boss);
   for(let i=0;i<4;i++){const blade=addMesh(this.counter,wedge(),luminous(i%2?white:this.color,.8*p.opacity));blade.rotation.z=i/4*TAU;blade.scale.set(.35,1,1);this.cuts.push(blade);}
  }else if(variant===1){
   for(let i=0;i<2;i++){const blade=addMesh(this.guard,new T.BoxGeometry(.11,1.65,.055),luminous(i?white:this.color,.9*p.opacity));blade.rotation.z=(i?1:-1)*Math.PI/4;this.petals.push(blade);}
   for(let i=0;i<2;i++){const cut=arc(this.counter,.8+i*.12,.065*p.width,i?white:this.color,.9,Math.PI*1.3);cut.rotation.set(0,(i?1:-1)*.3,(i?1:-1)*Math.PI/4);this.cuts.push(cut);}
  }else{
   for(let i=0;i<3;i++){const crescent=arc(this.guard,.55+i*.18,.06*p.width,i%2?white:this.color,.8,Math.PI*1.4);crescent.rotation.z=i/3*TAU;this.petals.push(crescent);}
   for(let i=0;i<3;i++){const points=Array.from({length:48},(_,j)=>{const a=j/47*TAU+i/3*TAU;return new T.Vector3(Math.cos(a)*.5,Math.sin(a)*.5,-j/47*1.2);});this.cuts.push(addMesh(this.counter,new T.TubeGeometry(new T.CatmullRomCurve3(points),56,.045*p.width,5,false),luminous(i%2?white:this.color,.8)));}
  }
  for(let i=0;i<(variant===1?2:3);i++)this.ribbons.push(new Ribbon(group,i%2?white:this.color,.7));
  for(let i=0;i<(variant===0?8:variant===1?4:3);i++){
   const g=variant===2?arc(this.impact,.4+i*.2,.035*p.width,this.color,.85):addMesh(this.impact,wedge(),luminous(i%2?white:this.color,.85));g.rotation.z=i/(variant===0?8:4)*TAU+(variant===1?Math.PI/4:0);this.impacts.push(g);
  }
  this.debris=new Shards(this.impact,32,this.color,71);this.incoming=addMesh(group,new T.ConeGeometry(.13,.6,4),luminous(this.failed,.8));this.incoming.rotation.x=-Math.PI/2;
  this.counter.visible=false;this.impact.visible=false;this.guard.name='riposte-opening-guard';this.counter.name='riposte-triggered-counter';
  group.userData.visualSignature=['six-petal-shield+axial-reversal','crossed-guard+twin-sweeping-cuts','crescent-guard+helical-return'][variant];
 }
 private strikePath(t:number,out:T.Vector3){const u=smooth((t-this.contact)/Math.max(.1,RIPOSTE_TIMING.cast-this.contact));out.set(0,.9,-1.9+RIPOSTE_TIMING.strikeRange*u);}
 update(t:number,_dt:number){
  const {p,variant,contact,success}=this,cast=RIPOSTE_TIMING.cast,post=t-cast,triggered=success&&t>=contact,window=t<RIPOSTE_TIMING.windowEnd;
  const fade=1-smooth(post/(.6*p.decay)),opening=.25+.75*smooth(t/.1),guardEnd=p.scenario!==1?contact:cast;
  this.guard.visible=t<guardEnd;this.guard.scale.setScalar(p.guardSize*opening);
  fadeTree(this.guard,p.opacity*(window?1:.18));this.petals.forEach((g,i)=>{
   if(variant===0){const a=i/6*TAU,r=(1-opening)*.55;g.position.set(Math.sin(-a)*r,Math.cos(a)*r,0);}
   if(variant===1)g.rotation.z=(i?1:-1)*(Math.PI/4+(1-opening)*.7);
   if(variant===2)g.rotation.z=i/3*TAU+t*2*p.rotation;
   const m=g.material as T.MeshBasicMaterial;m.color.copy(window?this.color:new T.Color(0x70838b));
  });
  this.floor.visible=t<guardEnd;this.floor.scale.setScalar(p.guardSize*(.8+.2*opening));fadeTree(this.floor,window?.75:.15);
  this.defender.position.set(0,0,-1.9);this.defender.scale.y=1-.13*opening*(t<guardEnd?1:0);
  this.incoming.visible=p.scenario!==1&&t>=Math.max(0,contact-.22)&&t<contact;
  this.incoming.position.set(0,.9,1.9-3.35*smooth((t-contact+.22)/.22));this.incoming.scale.setScalar(p.scenario===3?1.8:1);
  if(triggered){const pos=new T.Vector3();this.strikePath(t,pos);this.defender.position.z=pos.z;this.counter.position.copy(pos);}
  if(!success&&p.scenario!==1&&t>=contact){this.defender.position.z-=smooth((t-contact)/.2)*.3;this.defender.rotation.x=-Math.sin(smooth((t-contact)/.3)*Math.PI)*.25;}
  this.counter.visible=triggered&&post<.25*p.decay;this.counter.scale.setScalar(p.counterSize);this.counter.rotation.z=variant===2?Math.max(0,t-contact)*12*p.rotation:0;fadeTree(this.counter,fade*p.opacity);
  if(variant===1)this.cuts.forEach((g,i)=>g.rotation.z=(i?1:-1)*(Math.PI/4+Math.max(0,t-contact)*5*p.rotation));
  this.ribbons.forEach((r,i)=>{r.mesh.visible=triggered&&post<.25*p.decay;r.update((at,out)=>{this.strikePath(at,out);const a=i/this.ribbons.length*TAU;out.x+=Math.cos(a)*.22*p.counterSize;out.y+=Math.sin(a)*.22*p.counterSize;},Math.min(t,cast),.2*p.trailLength,.045*p.width,fade*p.opacity);});
  if(triggered&&!this.blocked){this.particles.create({kind:'shard',color:this.color.getHex(),count:Math.round(35*p.particleDensity),duration:.05,life:.28,size:.09,speed:2,radius:.15,position:[0,.9,-1.45],opacity:p.opacity});this.blocked=true;}
  this.impact.visible=success&&post>=0&&fade>.001;
  if(success&&post>=0){fadeTree(this.impact,fade*p.flash);this.impacts.forEach((g,i)=>{if(variant===2){g.scale.setScalar(.3+post*4+i*.2);g.position.z=-post*i*.4;}else{g.scale.set(p.width*(variant===1?.7:.3),(.45+post*2)*p.counterSize,1);g.position.set(Math.sin(-g.rotation.z)*post,Math.cos(g.rotation.z)*post,0);}});this.debris.update(post,'burst',.5,.08,fade);
   if(!this.hit){this.particles.create({kind:'streak',color:this.color.getHex(),count:Math.round(65*p.particleDensity),duration:.05,life:.45*p.decay,size:.12,speed:4,radius:.2,position:[0,.9,1.9],opacity:p.opacity});this.hit=true;}
  }
  this.punch=success&&post>=0?Math.exp(-post*13)*.65*p.flash:triggered?Math.exp(-(t-contact)*22)*.2*p.flash:0;
  this.phase=t<.1?'Abertura da guarda · janela ativa':triggered?(t<cast?'Acerto anulado → contra-ataque PL4':'Impacto do contra-ataque · sem clash'):!success&&p.scenario!==1&&t>=contact?(p.scenario===3?'Guard Break atravessa · sem contra-ataque':'Golpe tardio · sem proteção'):window?'Janela de interceptação ativa':t<cast?'Janela encerrada · recuperação exposta':'Sem acerto elegível · encerrado';
 }
}
