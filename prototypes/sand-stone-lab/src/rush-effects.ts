import * as T from 'three';
import {outcomeOf} from './outcome.ts';
import {ShotEffect} from './shot-effect.ts';
import {Particles} from './particles.js';
import type {Variant} from './config.ts';
import {TAU,saturate,smooth,hue,luminous,addMesh,fadeTree,arc,Ribbon,Shards} from './vfx-shapes.ts';
type Params=Record<string,number>;
type Kind='bulletpunch'|'quickattack';

function fist(parent:T.Object3D,color:T.Color,ghost=false){
  const root=new T.Group();parent.add(root);root.name='metal-fist';
  const mat=ghost?luminous(color,.32):new T.MeshStandardMaterial({color:0xbccbd8,metalness:.85,roughness:.24,emissive:color,emissiveIntensity:.17,transparent:true});
  addMesh(root,new T.BoxGeometry(.54,.38,.48),mat);
  for(let i=0;i<4;i++){const knuckle=addMesh(root,new T.BoxGeometry(.125,.23,.23),mat);knuckle.position.set((i-1.5)*.14,.1,.28);}
  const thumb=addMesh(root,new T.BoxGeometry(.18,.24,.35),mat);thumb.position.set(.32,-.12,.04);thumb.rotation.z=-.25;
  const wrist=addMesh(root,new T.CylinderGeometry(.19,.23,.5,8),mat);wrist.rotation.x=Math.PI/2;wrist.position.z=-.45;
  const seam=addMesh(root,new T.BoxGeometry(.55,.035,.03),luminous(color,.9));seam.position.set(0,.21,.15);
  root.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=!ghost;});return root;
}
function runner(parent:T.Object3D,color:T.Color,ghost=false){
  const root=new T.Group();parent.add(root);root.name=ghost?'speed-afterimage':'runner';
  const mat=ghost?luminous(color,.3):new T.MeshStandardMaterial({color:0xc3d4e0,metalness:.3,roughness:.45,transparent:true});
  const body=addMesh(root,new T.CapsuleGeometry(.21,.48,5,10),mat);body.rotation.x=.6;body.position.y=.05;
  const head=addMesh(root,new T.SphereGeometry(.18,12,10),mat);head.position.set(0,.48,.18);
  for(const sign of [-1,1]){const limb=addMesh(root,new T.BoxGeometry(.12,.42,.14),mat);limb.position.set(sign*.26,-.15,sign*.15);limb.rotation.x=sign*.9;}
  return root;
}
/** Visual studies only. The moving fist/body is the source of every trail and impact. */
export class RushEffect {
  duration:number;phase='Preparação';punch=0;readonly actor:T.Group;
  caster:T.Group|null=null;private holdT=0;private out=outcomeOf({});private hold=0;private tail=0;private fin=0;private shot:ShotEffect;
  private p:Params;private kind:Kind;private variant:Variant;private particles:Particles;
  private ghosts:T.Group[]=[];private trails:Ribbon[]=[];private fins:T.Mesh[]=[];
  private impact=new T.Group();private launch=new T.Group();private rings:T.Mesh[]=[];private rays:T.Mesh[]=[];private debris:Shards;
  private fired=false;private hit=false;private charge:number;private travel:number;private arrival:number;
  constructor(group:T.Group,particles:Particles,kind:Kind,variant:Variant,p:Params){
    Object.assign(this,{p,kind,variant,particles});this.out=outcomeOf(p);this.holdT=p.holdTime??0;this.charge=p.chargeTime;this.travel=Math.max(.01,p.travelTime*this.out.reach);this.arrival=this.charge+this.travel;this.hold=0;this.tail=.85*p.decay;this.fin=Math.min(p.finishTime??.45,this.tail);this.duration=this.arrival+this.hold+this.tail;
    this.shot=new ShotEffect(group,particles,p,{origin:[0,.4,-2.4],direction:[0,0,1],element:kind==='quickattack'?'wind':'steel'});
    const color=hue(p.primaryHue,.62),white=new T.Color(0xe8faff),gold=new T.Color(0xffc46d),quick=kind==='quickattack';
    const target=addMesh(group,new T.CapsuleGeometry(.23,.65,5,10),new T.MeshStandardMaterial({color:0x556371,roughness:.8}));target.position.set(0,.6,2.7);
    const marker=arc(group,.43,.012,new T.Color(0x69818c),.4);marker.rotation.x=-Math.PI/2;marker.position.set(0,.025,2.7);
    this.actor=quick?runner(group,color):fist(group,color);this.actor.name=kind+'-actor';
    if(!quick){const caster=runner(group,new T.Color(0x64717e));caster.position.set(0,.7,-2.7);caster.scale.setScalar(.8);this.caster=caster;}
    group.add(this.launch,this.impact);this.launch.position.set(0,.04,-2.4);this.impact.position.set(0,quick?.8:1.05,2.35);
    if(!quick&&variant===1){
      for(let i=0;i<3;i++){const points=Array.from({length:48},(_,k)=>{const a=k/47*TAU*1.3+i/3*TAU;return new T.Vector3(Math.cos(a)*(.35+k*.003),Math.sin(a)*(.35+k*.003),.3-k*.027);});const fin=addMesh(this.actor,new T.TubeGeometry(new T.CatmullRomCurve3(points),64,.035*p.width,5,false),luminous(i%2?white:color,.75));this.fins.push(fin);}
    }
    const ghosts=quick?(variant===0?5:variant===1?4:8):(variant===2?7:2);
    for(let i=0;i<ghosts;i++){const ghost=quick?runner(group,i%2?color:white,true):fist(group,i%2?color:gold,true);this.ghosts.push(ghost);}
    const count=quick?(variant===0?7:variant===1?2:0):(variant===0?4:variant===1?3:1);
    for(let i=0;i<count;i++)this.trails.push(new Ribbon(group,i%2?white:color,.65,new T.Vector3(0,1,0)));
    for(let i=0;i<(variant===0?2:variant===1?3:1);i++){const r=arc(this.impact,.35+i*.14,.025*p.width,i%2?white:color,.85,variant===1?TAU*.72:TAU);if(quick&&variant===1)r.rotation.y=Math.PI/3;this.rings.push(r);}
    for(let i=0;i<(variant===2?18:12);i++){const ray=addMesh(this.impact,new T.ConeGeometry((variant===1?.055:.025)*p.width,1,3),luminous(!quick&&variant===2?gold:i%2?color:white,.85));this.rays.push(ray);}
    const launchRing=arc(this.launch,.4,.025,color,.55);launchRing.rotation.x=-Math.PI/2;
    this.debris=new Shards(this.impact,quick?20:36,quick?white:gold,variant*19);this.impact.visible=false;
    group.userData.visualSignature=(quick?['body-dash+parallel-speed-ribbons','zigzag-body+corner-echoes','blink-body+discrete-afterimages']:['steel-piston+axial-impact','helical-fist+rotating-pressure','fist-barrage+multiple-strikes'])[variant];
  }
  private path(t:number,out:T.Vector3){
    const u=saturate((t-this.charge)/this.travel),quick=this.kind==='quickattack';
    const z=-2.35+4.7*this.out.reach*(quick&&this.variant===2?Math.min(1,Math.floor(u*5)/4):smooth(u));
    const lateral=quick&&this.variant===1?Math.sin(u*TAU*1.5)*Math.sin(u*Math.PI)*this.p.spread:0;
    out.set(lateral,quick?.68:1.05,z);if(t<this.charge&&this.p.startOn!==0)out.z-=Math.sin(t/this.charge*Math.PI)*.25;
  }
  /** Janelas das fases sequenciais no tempo do efeito (a permanência de tamanho zero não entra). Disparo e contato são camadas de evento. */
  timeline(){const a=this.arrival,h=this.holdT,f=this.fin,hit=this.out.hits;return [{id:'start',from:0,to:this.charge},{id:'body',from:this.charge,to:a},{id:'hold',from:a,to:a,freeze:h},{id:'finish',from:a,to:hit?a+f:this.duration},{id:'impact',from:a+f,to:hit?this.duration:a+f}].filter(x=>x.to>x.from||(x.freeze??0)>0) as {id:'start'|'body'|'hold'|'finish'|'impact';from:number;to:number;freeze?:number}[];}
  update(t:number,_dt:number){
    this.shot.update(_dt);
    const {p,kind,variant}=this,quick=kind==='quickattack',post=t-this.arrival,u=saturate((t-this.charge)/this.travel),fade=1-smooth((post-this.hold)/((p.impactTime??.7)*p.decay));
    this.path(t,this.actor.position);
    // Quick Attack: depois do contato o corpo VOLTA à origem (sem segundo hit); fase de finalização desligada = comportamento antigo (some no alvo)
    const travelling=t>=this.charge&&t<this.arrival,ret=quick&&p.finishOn!==0;
    this.actor.visible=!(p.bodyOn===0&&travelling)&&(ret?t<this.arrival+this.hold+this.fin:t<this.arrival+(p.finishTime??.3)*p.decay);
    if(ret&&post>this.hold){const r=smooth(saturate((post-this.hold)/Math.max(.001,this.fin)));this.actor.position.z+=(-2.35-this.actor.position.z)*r;}
    // Bullet Punch: o corpo some durante a corrida e reaparece perto do alvo no golpe
    if(this.caster){this.caster.visible=!travelling;this.caster.position.z=t>=this.arrival?1.55:-2.7;}
    this.actor.scale.setScalar(p.scale);if(quick)this.actor.scale.z*=1+Math.sin(u*Math.PI)*p.stretch*.65;
    this.actor.rotation.z=!quick&&variant===1?t*12*p.twist:quick&&variant===1?-Math.sin(u*TAU*1.5)*.35:0;
    if(quick&&variant===2&&u>0&&u<1)this.actor.visible=p.bodyOn!==0&&(u*5)%1<.62;
    fadeTree(this.actor,fade);this.launch.visible=p.startOn!==0&&t<this.charge+.25;this.launch.scale.setScalar(.5+smooth(t/this.charge)*1.2);fadeTree(this.launch,1-smooth((t-this.charge)/.25));
    this.ghosts.forEach((g,i)=>{
      const lag=(i+1)*this.travel/(this.ghosts.length+1)*p.trailLength;
      this.path(Math.min(t,this.arrival)-lag,g.position);
      if(!quick&&variant===2){g.position.x+=Math.sin(i*2.4)*.6*p.spread;g.position.y+=Math.cos(i*2.4)*.4*p.spread;g.position.z+=Math.sin(t*22+i)*.22;}
      g.visible=p.bodyOn!==0&&t>this.charge+lag&&post<.35*p.decay;g.scale.setScalar(p.scale*(quick?1:variant===2?.8:.65));
      if(quick)g.scale.z=1+(variant===0?1.5:0)*p.stretch;
      fadeTree(g,(1-i/(this.ghosts.length+1))*fade*p.opacity);
    });
    this.trails.forEach((r,i)=>{
      r.mesh.visible=p.bodyOn!==0&&t>=this.charge&&post<.35*p.decay;
      r.update((at,out)=>{this.path(at,out);const a=i/Math.max(1,this.trails.length)*TAU;if(!quick&&variant===1){out.x+=Math.cos(at*20*p.twist+a)*.4;out.y+=Math.sin(at*20*p.twist+a)*.4;}else{out.x+=Math.cos(a)*.3*p.spread;out.y+=Math.sin(a)*.32*p.spread;}},Math.min(t,this.arrival),this.travel*.7*p.trailLength,(quick&&variant===1?.12:.035)*p.width,p.opacity*fade);
    });
    if(t>=this.charge&&!this.fired){this.shot.fire();if(p.launchOn!==0)this.particles.create({kind:quick?'grain':'streak',color:hue(p.primaryHue).getHex(),count:Math.round(35*p.particleDensity),duration:.05,life:.4,size:.08,speed:2,radius:.3,position:[0,.12,-2.4],opacity:p.opacity});this.fired=true;}
    this.impact.visible=p.impactOn!==0&&this.out.hits&&post>=0&&fade>.001;this.impact.scale.setScalar(p.impactSize??1);
    if(post>=0){fadeTree(this.impact,fade*p.flash);this.rings.forEach((r,i)=>{r.scale.setScalar(.2+post*(quick?4:3)+i*.18);r.rotation.z=post*(variant===1?8:1)*(i%2?1:-1);});
      this.rays.forEach((r,i)=>{const a=i/this.rays.length*TAU,d=.15+post*(variant===2?2:1.1);r.position.set(Math.sin(a)*d,Math.cos(a)*d,variant===1?Math.sin(a*3)*post:0);r.rotation.z=-a;r.scale.set(1,(.4+(i%3)*.3)*(1+post*2),1);});this.debris.update(post,'burst',.6,quick?.05:.1,fade);
      if(!this.hit){if(p.impactOn!==0&&this.out.hits)this.particles.create({kind:quick?'streak':'shard',color:hue(p.primaryHue).getHex(),count:Math.round((quick?50:85)*p.particleDensity*(p.impactParticles??1)),duration:.05,life:.5*p.decay,size:quick?.1:.15,speed:quick?3:4,radius:.2,position:[0,quick?.8:1.05,2.35],opacity:p.opacity});this.hit=true;}
    }
    this.punch=p.impactOn!==0&&this.out.hits&&post>=0?Math.exp(-post*13)*p.flash*(quick?.4:.75):0;
    this.phase=t<this.charge?'Antecipação':post<0?(quick?['Arrancada','Mudanças de direção','Passos instantâneos'][variant]:['Disparo do pistão','Perfuração helicoidal','Rajada de punhos'][variant]):post<.3?'Impacto':'Dissipação';
  }
}
