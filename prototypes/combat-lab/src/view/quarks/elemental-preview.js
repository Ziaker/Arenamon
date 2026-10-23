import * as THREE from 'three';
import * as Q from 'three.quarks';
import {presetToSystemParams} from './adapter.js';
import {elementalSettings} from './presets.js';
import {ElementalSurfaces} from './elemental-surfaces.js';

// Geometrias contínuas são superfícies; toda partícula é simulada por three.quarks.
export class ElementalPreview {
 constructor(scene){this.scene=scene;this.batch=new Q.BatchedRenderer();scene.add(this.batch);this.systems=[];this.materials=[];this.root=new THREE.Group();scene.add(this.root);this.time=0;this.active=false;}
 clear(){for(const s of this.systems){this.batch.deleteSystem(s);s.emitter.removeFromParent();s.dispose();}this.systems=[];this.surfaces=null;this.root.traverse(o=>{o.geometry?.dispose();});this.root.clear();for(const m of this.materials){m.map?.dispose();m.dispose();}this.materials=[];this.active=false;}
 material(color,opacity=1){const m=new THREE.MeshBasicMaterial({color,transparent:true,opacity:Math.min(1,opacity*(this.p?.brightness??1)),depthWrite:false,side:THREE.DoubleSide});this.materials.push(m);return m;}
 mesh(g,color,opacity=1,parent=this.root){const m=new THREE.Mesh(g,this.material(color,opacity));parent.add(m);return m;}
 sprite(kind,color){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
 if(kind==='leaf'){x.fillStyle='white';x.beginPath();x.moveTo(8,52);x.bezierCurveTo(2,13,35,4,58,6);x.bezierCurveTo(57,40,33,62,8,52);x.fill();x.strokeStyle='#8a8a8a';x.lineWidth=3;x.beginPath();x.moveTo(10,51);x.lineTo(52,13);x.stroke();}
 else if(kind==='droplet'){x.fillStyle='white';x.beginPath();x.moveTo(32,3);x.bezierCurveTo(22,29,6,44,23,58);x.bezierCurveTo(55,69,61,40,32,3);x.fill();}
 else if(kind==='flame'){const g=x.createLinearGradient(0,64,0,0);g.addColorStop(0,'#ffffff00');g.addColorStop(.25,'white');g.addColorStop(.65,'#ffffffaa');g.addColorStop(1,'#ffffff00');x.fillStyle=g;x.beginPath();x.moveTo(32,64);x.bezierCurveTo(-5,55,15,30,37,0);x.bezierCurveTo(22,28,72,50,32,64);x.fill();}
 else if(kind==='streak'){const g=x.createLinearGradient(0,0,64,0);g.addColorStop(0,'transparent');g.addColorStop(.6,'white');g.addColorStop(1,'transparent');x.fillStyle=g;x.fillRect(0,28,64,8);}
 else {const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'white');g.addColorStop(kind==='flame'?.35:.12,'#ffffffcc');g.addColorStop(1,'#ffffff00');x.fillStyle=g;x.fillRect(0,0,64,64);}
 const m=this.material(color,this.p.brightness);m.map=new THREE.CanvasTexture(c);m.blending=this.noFlash||kind==='leaf'?THREE.NormalBlending:THREE.AdditiveBlending;return m;}
 particles({kind='soft',rate=0,count=0,radius=.2,speed=1,size=1,life=1,world=true,orbit=0,cone=false,color=this.p.color}={}){
 const p=this.p,k=this.reduced?.35:1;const fadeColor=kind==='leaf'?'#bcf77a':p.accent;
 const preset={duration:p.duration,looping:rate>0,worldSpace:world,shape:{type:cone?'cone':'sphere',radius,angle:9},startLife:[p.life*.65*life,p.life*life],startSpeed:[speed*.65,speed],startSize:[p.particleSize*.5*size,p.particleSize*size],startColor:{a:'#ffffff',b:'#ffffff'},emissionOverTime:rate*k,burst:count?{count:count*k}:undefined,sizeOverLife:[.4,1,.7,0],colorOverLife:{stops:[{t:0,color,alpha:0},{t:.12,color,alpha:Math.min(1,p.brightness)},{t:.7,color:fadeColor,alpha:.6},{t:1,color:fadeColor,alpha:0}]}};
 const params=presetToSystemParams(preset,{Quarks:Q,THREE,material:this.sprite(kind,'#ffffff')});
 params.startColor=new Q.ConstantColor(new Q.Vector4(p.brightness,p.brightness,p.brightness,1));
 if(cone){params.shape=new Q.ConeEmitter({radius,angle:.04,thickness:.08,mode:Q.EmitterMode.Loop,spread:.06,speed:new Q.ConstantValue(Math.abs(orbit)*.2/(Math.PI*2))});}
 if(orbit)params.behaviors.push(new Q.OrbitOverLife(new Q.ConstantValue(orbit*(this.reduced?.2:1)),new Q.Vector3(0,0,1)));
 const s=new Q.ParticleSystem(params);this.scene.add(s.emitter);this.batch.addSystem(s);this.systems.push(s);return s;
 }
 ring(radius,color,parent=this.root){return this.mesh(new THREE.TorusGeometry(radius,.018*this.p.size,8,100),color,.75,parent);}
 play(id,overrides,pl=1,{noFlash=false,reduced=false}={}){
 this.clear();this.id=id;this.p=elementalSettings(id,overrides,pl);this.noFlash=noFlash;this.reduced=reduced;if(noFlash)this.p.brightness=Math.min(.65,this.p.brightness);this.time=0;this.active=true;this.hit=false;this.contactAt=null;this.velocity=0;this.rings=[];this.trails=[];const p=this.p;
 this.core=new THREE.Group();this.root.add(this.core);
 if(id!=='seedBomb'){
 this.surfaces=new ElementalSurfaces(this);
 if(id==='fireSpin'){
 const flame=this.particles({kind:'flame',rate:p.quantity*.45,radius:p.opening+p.size*.5,speed:p.speed*.3,size:.8,world:false,orbit:p.rotation,cone:true});flame.emitter.rotation.x=-Math.PI/2;this.flame=flame;
 const embers=this.particles({kind:'streak',rate:p.quantity*.25,radius:p.opening+p.size*.6,speed:p.speed*.45,size:.25,world:false,orbit:p.rotation*.5,cone:true,color:p.accent});embers.emitter.rotation.x=-Math.PI/2;
 }else{this.trails.push(this.particles({kind:id==='waterPulse'?'droplet':'streak',rate:p.quantity,radius:p.size*.7,speed:p.spread*.35,size:id==='waterPulse'?1.5:2.8,life:id==='airSlash'?p.trail/2:1}));}
 }else{
 const seed=this.mesh(new THREE.SphereGeometry(p.size,24,20),p.accent,1,this.core);const skin=new THREE.MeshPhongMaterial({color:p.accent,shininess:45});this.materials.push(skin);seed.material=skin;seed.scale.set(.72,1.2,.72);
 const seam=this.ring(p.size*.78,p.color,this.core);seam.scale.y=1.3;
 this.trails.push(this.particles({kind:'leaf',rate:p.quantity*.55,radius:p.size*.3,speed:p.spread*.25}));
 }
 this.update(0);
 }
 contact(){
 if(!this.active||this.hit||this.id==='fireSpin')return;
 this.hit=true;this.contactAt=this.time;this.core.visible=false;
 for(const system of this.trails){system.emissionOverTime=new Q.ConstantValue(0);system.looping=false;}
 const p=this.p,motion=this.reduced?.2:1;
 const burst=this.particles({kind:this.id==='seedBomb'?'leaf':this.id==='waterPulse'?'droplet':'streak',count:p.quantity*(this.id==='airSlash'?.6:1.8),radius:p.size*.15,speed:p.spread*2*motion,size:this.id==='airSlash'?3:1.5});burst.emitter.position.copy(this.core.position);
 if(this.id==='seedBomb'){const dust=this.particles({count:p.quantity*.45,radius:p.size,speed:p.spread*.5,size:3,color:'#8b9d58'});dust.emitter.position.copy(this.core.position);}
 }
 update(dt){if(!this.active)return;this.time+=dt;const p=this.p,t=this.time,u=Math.min(1,t/p.duration),motion=this.reduced?.2:1;
 if(this.id==='fireSpin'){
 const envelope=Math.min(1,t/.6,Math.max(0,(p.duration-t)/.8));
 for(const system of this.systems)system.emissionOverTime=new Q.ConstantValue((system===this.flame?p.quantity*.45:p.quantity*.25)*envelope*(this.reduced?.35:1));
 }else if(!this.hit){
 const travel=p.speed*p.duration*.5*motion,progress=this.id==='waterPulse'?u*u:u;
 this.velocity=this.id==='waterPulse'?p.speed*u*motion:p.speed*.5*motion;
 this.core.position.set((progress-.5)*travel,this.id==='seedBomb'?p.size+Math.sin(u*Math.PI)*p.height:p.height,0);
 this.core.rotation.z=this.id==='seedBomb'?t*p.rotation*.12*motion:0;
 for(const system of this.trails)system.emitter.position.copy(this.core.position);
 if(u>=1)this.contact();
 }
 this.surfaces?.update(t);this.scene.updateMatrixWorld(true);this.batch.update(dt);
 if(t>(this.contactAt??p.duration)+p.life*2+1)this.clear();
 }
 diagnostics(){return {variant:this.p?.variant,contactAt:this.contactAt,velocity:this.velocity,stretch:this.core?.scale.x,move:this.id,active:this.active,time:this.time,systems:this.systems.length,particles:this.systems.reduce((n,s)=>n+s.particleNum,0),positiveSizes:this.systems.reduce((n,s)=>n+s.particles.slice(0,s.particleNum).filter(p=>p.size.x>0).length,0),settings:this.p,phase:!this.active?'Pronto':this.hit?'Contato / dissipação':this.time>this.p.duration?'Dissipação':this.time<.6?'Início':this.id==='fireSpin'?'Sustentação':'Trajeto'};}
 dispose(){this.clear();this.batch.removeFromParent();this.root.removeFromParent();}
}
