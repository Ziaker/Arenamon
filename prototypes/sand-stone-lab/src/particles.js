import * as T from 'three';
import * as Q from 'three.quarks';
import {rng} from './art.js';

export function particleTexture(kind) {
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),random=rng(73);
  if(kind==='dust'){
    for(let i=0;i<35;i++){
      const a=random()*Math.PI*2,r=random()*29,x=64+Math.cos(a)*r,y=64+Math.sin(a)*r,s=13+random()*20;
      const g=ctx.createRadialGradient(x,y,0,x,y,s);g.addColorStop(0,'rgba(255,255,255,.16)');g.addColorStop(.5,'rgba(255,255,255,.09)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
    }
  }else if(kind==='streak'){
    const g=ctx.createLinearGradient(0,0,128,0);g.addColorStop(0,'#fff0');g.addColorStop(.65,'#fffd');g.addColorStop(.92,'#fff');g.addColorStop(1,'#fff0');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,64);ctx.lineTo(106,59);ctx.lineTo(128,64);ctx.lineTo(106,69);ctx.closePath();ctx.fill();
  }else{
    const g=ctx.createRadialGradient(64,64,0,64,64,38);g.addColorStop(0,'#fff');g.addColorStop(.35,'#fff');g.addColorStop(1,'#fff0');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
  }
  return new T.CanvasTexture(c);
}

export class Particles {
  constructor(scene,{textures=true}={}){
    this.scene=scene;this.renderer=new Q.BatchedRenderer();scene.add(this.renderer);this.systems=[];this.materials={};
    for(const kind of ['dust','grain','streak'])this.materials[kind]=new T.MeshBasicMaterial({map:textures?particleTexture(kind):null,transparent:true,depthWrite:false,side:T.DoubleSide,blending:kind==='dust'?T.NormalBlending:T.AdditiveBlending,toneMapped:kind==='dust'});
  }
  create({kind='dust',color=0xc49c68,count=0,rate=0,duration=.5,life=1,size=.4,speed=1,radius=.25,angle=.7,gravity=0,opacity=.5,position=[0,0,0],direction=[0,1,0]}={}){
    const c=new T.Color(color),end=c.clone().multiplyScalar(kind==='dust'?.45:.7);
    const params={duration,looping:false,worldSpace:true,material:this.materials[kind],renderMode:Q.RenderMode.BillBoard,
      startLife:new Q.IntervalValue(life*.7,life),startSpeed:new Q.IntervalValue(speed*.4,speed),startSize:new Q.IntervalValue(size*.6,size),startRotation:new Q.IntervalValue(0,Math.PI*2),
      startColor:new Q.ColorRange(new T.Vector4(c.r,c.g,c.b,opacity),new T.Vector4(c.r*.8,c.g*.8,c.b*.8,opacity)),
      shape:new Q.ConeEmitter({radius,angle,thickness:1}),emissionOverTime:new Q.ConstantValue(rate),
      emissionBursts:count?[{time:0,count:new Q.ConstantValue(count),cycle:1,interval:.01,probability:1}]:[],
      behaviors:[new Q.ColorOverLife(new Q.Gradient([[new T.Vector3(c.r,c.g,c.b),0],[new T.Vector3(end.r,end.g,end.b),1]],[[0,0],[opacity,.08],[opacity*.75,.55],[0,1]])),new Q.SizeOverLife(new Q.PiecewiseBezier([[new Q.Bezier(kind==='dust'?.35:1,.8,kind==='dust'?1.6:.65,kind==='dust'?2:0),0]]))]
    };
    if(gravity)params.behaviors.push(new Q.ApplyForce(new T.Vector3(0,gravity>0?1:-1,0),new Q.ConstantValue(Math.abs(gravity))));
    const system=new Q.ParticleSystem(params),emitter=system.emitter;
    emitter.position.set(...position);emitter.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...direction).normalize());
    this.scene.add(emitter);emitter.updateMatrixWorld(true);this.renderer.addSystem(system);
    const entry={system,emitter,age:0,ttl:duration+life+.15,kind};this.systems.push(entry);return entry;
  }
  update(dt){
    this.scene.updateMatrixWorld(true);this.renderer.update(dt);
    for(let i=this.systems.length-1;i>=0;i--){const p=this.systems[i];p.age+=dt;if(p.age>p.ttl){this.renderer.deleteSystem(p.system);p.emitter.removeFromParent();p.system.dispose();this.systems.splice(i,1);}}
  }
  clear(){for(const p of this.systems){this.renderer.deleteSystem(p.system);p.emitter.removeFromParent();p.system.dispose();}this.systems=[];}
  get count(){return this.systems.reduce((n,p)=>n+p.system.particleNum,0);}
}
