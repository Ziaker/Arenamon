import * as THREE from 'three';
import * as Q from 'three.quarks';
import {presetToSystemParams} from './adapter.js';
import {elementalSettings} from './presets.js';
import {ElementalSurfaces} from './elemental-surfaces.js';
import {ShotEffect} from './shot-effect.js';

// Geometrias contínuas são superfícies; toda partícula é simulada por three.quarks.
export class ElementalPreview {
 // `batch`/`parent` permitem ao jogo compartilhar um único BatchedRenderer entre vários efeitos
 // (o ateliê continua criando o próprio batch e o próprio root, como antes).
 constructor(scene,{batch=null,parent=null}={}){this.scene=scene;this.batch=batch??new Q.BatchedRenderer();this.ownsBatch=!batch;if(!batch)scene.add(this.batch);this.systems=[];this.materials=[];this.root=new THREE.Group();(parent??scene).add(this.root);this.time=0;this.active=false;this.follow=false;this.followPos=new THREE.Vector3();}
 clear(){for(const s of this.systems){this.batch.deleteSystem(s);s.emitter.removeFromParent();s.dispose();}this.systems=[];this.surfaces=null;this.shotFx=null;this.spawnFx=null;this.flashFx=null;this.seedMesh=null;this.groundWave=null;this.root.traverse(o=>{o.geometry?.dispose();});this.root.clear();for(const m of this.materials){m.map?.dispose();m.dispose();}this.materials=[];this.active=false;}
 material(color,opacity=1){const m=new THREE.MeshBasicMaterial({color,transparent:true,opacity:Math.min(1,opacity*(this.p?.brightness??1)),depthWrite:false,side:THREE.DoubleSide});this.materials.push(m);return m;}
 mesh(g,color,opacity=1,parent=this.root){const m=new THREE.Mesh(g,this.material(color,opacity));parent.add(m);return m;}
 sprite(kind,color){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
 if(kind==='leaf'){x.fillStyle='white';x.beginPath();x.moveTo(8,52);x.bezierCurveTo(2,13,35,4,58,6);x.bezierCurveTo(57,40,33,62,8,52);x.fill();x.strokeStyle='#8a8a8a';x.lineWidth=3;x.beginPath();x.moveTo(10,51);x.lineTo(52,13);x.stroke();}
 else if(kind==='droplet'){x.fillStyle='white';x.beginPath();x.moveTo(32,3);x.bezierCurveTo(22,29,6,44,23,58);x.bezierCurveTo(55,69,61,40,32,3);x.fill();}
 else if(kind==='flame'){const g=x.createLinearGradient(0,64,0,0);g.addColorStop(0,'#ffffff00');g.addColorStop(.25,'white');g.addColorStop(.65,'#ffffffaa');g.addColorStop(1,'#ffffff00');x.fillStyle=g;x.beginPath();x.moveTo(32,64);x.bezierCurveTo(-5,55,15,30,37,0);x.bezierCurveTo(22,28,72,50,32,64);x.fill();}
 else if(kind==='streak'){const g=x.createLinearGradient(0,0,64,0);g.addColorStop(0,'transparent');g.addColorStop(.6,'white');g.addColorStop(1,'transparent');x.fillStyle=g;x.fillRect(0,28,64,8);}
 else {const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'white');g.addColorStop(kind==='flame'?.35:.12,'#ffffffcc');g.addColorStop(1,'#ffffff00');x.fillStyle=g;x.fillRect(0,0,64,64);}
 const m=this.material(color,this.p.brightness);m.map=new THREE.CanvasTexture(c);m.blending=this.noFlash||kind==='leaf'?THREE.NormalBlending:THREE.AdditiveBlending;return m;}
 particles({kind='soft',rate=0,count=0,radius=.2,speed=1,size=1,life=1,world=true,orbit=0,cone=false,jet=null,color=this.p.color}={}){
 const p=this.p,k=this.reduced?.35:1;const fadeColor=kind==='leaf'?'#bcf77a':p.accent;
 const preset={duration:p.duration,looping:rate>0,worldSpace:world,shape:{type:cone||jet!==null?'cone':'sphere',radius,angle:jet??9},startLife:[p.life*.65*life,p.life*life],startSpeed:[speed*.65,speed],startSize:[p.particleSize*.5*size,p.particleSize*size],startColor:{a:'#ffffff',b:'#ffffff'},emissionOverTime:rate*k,burst:count?{count:count*k}:undefined,sizeOverLife:[.4,1,.7,0],colorOverLife:{stops:[{t:0,color,alpha:0},{t:.12,color,alpha:Math.min(1,p.brightness)},{t:.7,color:fadeColor,alpha:.6},{t:1,color:fadeColor,alpha:0}]}};
 const params=presetToSystemParams(preset,{Quarks:Q,THREE,material:this.sprite(kind,'#ffffff')});
 params.startColor=new Q.ConstantColor(new Q.Vector4(p.brightness,p.brightness,p.brightness,1));
 if(cone){params.shape=new Q.ConeEmitter({radius,angle:.04,thickness:.08,mode:Q.EmitterMode.Loop,spread:.06,speed:new Q.ConstantValue(Math.abs(orbit)*.2/(Math.PI*2))});}
 if(orbit)params.behaviors.push(new Q.OrbitOverLife(new Q.ConstantValue(orbit*(this.reduced?.2:1)),new Q.Vector3(0,0,1)));
 const s=new Q.ParticleSystem(params);this.root.add(s.emitter);this.batch.addSystem(s);this.systems.push(s);return s;
 }
 ring(radius,color,parent=this.root){return this.mesh(new THREE.TorusGeometry(radius,.018*this.p.size,8,100),color,.75,parent);}
 play(id,overrides,pl=1,{noFlash=false,reduced=false,follow=false}={}){
 this.clear();this.id=id;this.p=elementalSettings(id,overrides,pl);this.noFlash=noFlash;this.reduced=reduced;this.follow=!!follow;this.followPos.set(0,0,0);if(noFlash)this.p.brightness=Math.min(.65,this.p.brightness);this.time=0;this.active=true;this.hit=false;this.contactAt=null;this.velocity=0;this.smearAmount=0;this.rings=[];this.trails=[];const p=this.p;this.shotJet=null;this.shotOn=['waterPulse','airSlash'].includes(id)&&p.shotDuration>0;
 this.core=new THREE.Group();this.root.add(this.core);
 if(id!=='seedBomb'){
 this.surfaces=new ElementalSurfaces(this);
 if(id==='fireSpin'){
 const flame=this.particles({kind:'flame',rate:p.quantity*.45,radius:p.opening+p.size*.5,speed:p.speed*.3,size:.8,world:false,orbit:p.rotation,cone:true});flame.emitter.rotation.x=-Math.PI/2;this.flame=flame;
 const embers=this.particles({kind:'streak',rate:p.quantity*.25,radius:p.opening+p.size*.6,speed:p.speed*.45,size:.25,world:false,orbit:p.rotation*.5,cone:true,color:p.accent});embers.emitter.rotation.x=-Math.PI/2;
 }else{this.trails.push(this.particles({kind:id==='waterPulse'?'droplet':'streak',rate:p.quantity*(id==='waterPulse'?p.trailRate:1),radius:p.size*(id==='waterPulse'?p.trailRadius:.7),speed:p.spread*(id==='waterPulse'?p.trailSpeed:.35),size:id==='waterPulse'?p.trailSize:2.8,life:id==='airSlash'?p.trail/2:p.trailLife}));}
 }else{
 // Semente: comprimento/largura/formato, costura com espessura e brilho próprios,
 // rastro de folhas e o efeito de disparo escolhido (módulo ShotEffect).
 const seedGeo=new THREE.SphereGeometry(p.size,24,20);
 if(p.seedShape>0){const pos=seedGeo.attributes.position;for(let i=0;i<pos.count;i++){const x=Math.max(0,pos.getX(i)/p.size);const k=1-p.seedShape*.85*x*x;pos.setY(i,pos.getY(i)*k);pos.setZ(i,pos.getZ(i)*k);}seedGeo.computeVertexNormals();}
 const seed=this.mesh(seedGeo,p.accent,1,this.core);const skin=new THREE.MeshPhongMaterial({color:p.accent,shininess:45});this.materials.push(skin);seed.material=skin;seed.scale.set(p.seedWidth,p.seedLength,p.seedWidth);this.seedMesh=seed;
 const seam=this.mesh(new THREE.TorusGeometry(p.size*.78,Math.max(.002,.018*p.size*p.seamThickness),8,100),p.seamColor,.75,this.core);seam.material.color.multiplyScalar(p.seamBrightness);seam.scale.y=1.3;
 if(p.spawnCount>0)this.spawnFx=this.particles({kind:'leaf',count:p.spawnCount,radius:p.spawnRadius,speed:p.spawnSpeed,size:p.spawnSize,life:p.spawnLife/Math.max(.05,p.life),color:p.spawnColor});
 this.trails.push(this.particles({kind:'leaf',rate:p.quantity*.55*p.leafRate,radius:p.size*p.leafRadius,speed:p.spread*p.leafSpeed,size:p.leafSize,life:p.leafLife,color:p.leafColor,orbit:p.leafSpin}));
 this.shotFx=new ShotEffect(this);
 }
 this.update(0);this.shotStart();
 if(this.id==='seedBomb'){
  this.shotFx.start(p.shotEffect,p);
  // Clarão do disparo: um único ponto luminoso no lugar da semente; desligado em "Sem flash".
  if(p.launchFlash>0&&!this.noFlash){const glow=this.particles({kind:'soft',count:1,radius:.02,speed:0,size:p.launchFlash*3,life:p.launchFlashTime/Math.max(.05,p.life)});glow.emitter.position.copy(this.core.position);this.flashFx=glow;}
 }
 }
 // Impacto do disparo: jato de partículas para trás e halo; anéis e clarão vivem em ElementalSurfaces.
 shotStart(){
 if(!this.shotOn)return;const p=this.p,water=this.id==='waterPulse',motion=this.reduced?.2:1,at=this.core.position;
 if(p.shotBurst>0){const jet=this.particles({kind:water?'droplet':'streak',count:p.shotBurst,radius:p.size*.2,speed:p.shotBurstSpeed*motion,size:p.shotBurstSize,life:p.shotBurstLife,jet:Math.min(180,p.shotAngle)});jet.emitter.position.copy(at);jet.emitter.rotation.y=-Math.PI/2;this.shotJet=jet;}
 if(p.shotGlow>0&&!this.noFlash){const glow=this.particles({kind:'soft',count:3,radius:.02,speed:0,size:p.shotGlow/Math.max(.02,p.particleSize),life:p.shotDuration/p.life});glow.emitter.position.copy(at);}
 }
 contact(){
 if(!this.active||this.hit||this.id==='fireSpin')return;
 this.hit=true;this.contactAt=this.time;this.core.visible=false;
 for(const system of this.trails){system.emissionOverTime=new Q.ConstantValue(0);system.looping=false;}
 const p=this.p,motion=this.reduced?.2:1;
 if(this.id==='seedBomb'){
 // Explosão da semente: folhas, poeira e (opcional) anel no chão — todos com controle próprio.
 const burst=this.particles({kind:'leaf',count:p.quantity*p.burstCount,radius:p.size*p.burstRadius,speed:p.spread*p.burstSpeed*motion,size:p.burstSize,life:p.burstLife,color:p.burstColor});
 burst.emitter.position.copy(this.core.position);
 const dust=this.particles({kind:'soft',count:p.quantity*p.dustCount,radius:p.size,speed:p.spread*p.dustSpeed*motion,size:p.dustSize,life:p.dustLife,color:p.dustColor});
 dust.emitter.position.copy(this.core.position);
 if(p.groundWave>0){const wave=this.mesh(new THREE.TorusGeometry(1,Math.max(.005,p.groundWaveThickness),8,64),p.groundWaveColor,1);wave.rotation.x=-Math.PI/2;wave.position.copy(this.core.position);wave.position.y=.02;this.groundWave=wave;}
 return;
 }
 const burst=this.particles({kind:this.id==='waterPulse'?'droplet':'streak',count:p.quantity*(this.id==='waterPulse'?p.burstCount:.6),radius:p.size*(this.id==='waterPulse'?p.burstRadius:.15),speed:p.spread*(this.id==='waterPulse'?p.burstSpeed:2)*motion,size:this.id==='waterPulse'?p.burstSize:3,life:this.id==='waterPulse'?p.burstLife:1});burst.emitter.position.copy(this.core.position);
 }
 update(dt){if(!this.active)return;this.time+=dt;const p=this.p,t=this.time,u=Math.min(1,t/p.duration),motion=this.reduced?.2:1;
 // Modo "seguir entidade" (jogo): o root fica na posição da entidade e o núcleo em (0,0,0);
 // a trajetória e o contato automático do ateliê ficam desligados (o chamador decide quando contatar).
 if(this.follow)this.core.position.copy(this.followPos);
 if(this.id==='fireSpin'){
 const envelope=Math.min(1,t/p.fireRise,Math.max(0,(p.duration-t)/p.fireFade));
 for(const system of this.systems)system.emissionOverTime=new Q.ConstantValue((system===this.flame?p.quantity*.45:p.quantity*.25*p.fireEmbers)*envelope*(this.reduced?.35:1));
 }else if(!this.hit&&this.id==='seedBomb'){
 this.updateSeed(t,p,motion);
 }else if(!this.hit){
 if(!this.follow){
 const travel=p.speed*p.duration*.5*motion,progress=this.id==='waterPulse'?u*u:u;
 this.velocity=this.id==='waterPulse'?p.speed*u*motion:p.speed*.5*motion;
 this.core.position.set((progress-.5)*travel,this.id==='waterPulse'?p.height:p.height,0);
 if(u>=1)this.contact();
 }
 for(const system of this.trails)system.emitter.position.copy(this.core.position);
 }
 this.shotFx?.update(Math.max(0,t-(p.seedRise??0)));
 this.surfaces?.update(t);
 if(this.id==='seedBomb'&&this.contactAt!==null){
 // Compressão da semente e anel no chão, ambos com o tempo de vida do contato.
 const age=t-this.contactAt;
 this.core.visible=age<p.squashDuration;
 if(this.core.visible){const k=Math.min(1,age/Math.max(.01,p.squashDuration));this.core.scale.set(Math.max(.01,1-k*p.squashAmount),1+k*p.squashAmount*.5,1+k*p.squashAmount*.5);}
 if(this.groundWave){const open=Math.min(1,age/Math.max(.01,p.contactOpening)),scale=Math.max(.01,p.size*p.groundWave*(p.contactInitial+open*(1+age*p.groundWaveSpeed*motion)));this.groundWave.scale.setScalar(scale);this.groundWave.material.opacity=Math.max(0,1-age/Math.max(.01,p.contactDuration));}
 }
 this.root.updateWorldMatrix(true,true);if(this.ownsBatch)this.batch.update(dt);
 const tail=this.id==='waterPulse'?Math.max(p.contactDuration,p.squashDuration,p.life*Math.max(p.trailLife,p.burstLife)+1):this.id==='seedBomb'?Math.max(p.contactDuration,p.squashDuration,p.life*Math.max(p.leafLife,p.burstLife,p.dustLife)+1):p.life*2+1;const launchEnd=this.id==='waterPulse'&&p.launchCount>0?p.launchDelay+(p.launchCount-1)*p.launchInterval+p.launchDuration:0,shotEnd=this.shotOn?p.shotDuration+p.shotShockStagger*p.shotShockCount+p.life*p.shotBurstLife+.2:0;
 if(!this.follow&&t>Math.max((this.contactAt??p.duration)+tail,launchEnd,shotEnd))this.clear();
 }
 // Semente em voo: surgimento, arco, giro, coice do disparo e rastro de folhas.
 updateSeed(t,p,motion){
 const rise=Math.max(0,p.seedRise),tFly=Math.max(0,t-rise),u=Math.min(1,tFly/Math.max(.01,p.duration));
 const travel=(p.speed*.5+p.launchSpeed)*p.duration*motion;
 const peak=Math.min(.95,Math.max(.05,p.arcPeak)),s=u<=peak?u/peak:(1-u)/(1-peak);
 const arch=Math.sin(s*Math.PI/2);
 const tilt=(u-.5)*travel*Math.tan(Math.min(89,Math.max(-89,p.launchAngle))*Math.PI/180);
 const kickT=Math.max(0,p.launchFlashTime),kick=p.launchKick>0&&kickT>0?p.launchKick*motion*(1-Math.min(1,tFly/kickT)):0;
 const born=rise>0?Math.min(1,t/rise):1,ease=born*born*(3-2*born);
 const grow=p.seedStartScale+(1-p.seedStartScale)*ease;
 this.velocity=p.speed*motion;
 this.core.position.set((u-.5)*travel-kick*p.size*1.2,p.size+arch*p.arcHeight+tilt,0);
 this.core.scale.set(grow*(1+kick*.5),grow*Math.max(.01,1-kick*.25),grow*Math.max(.01,1-kick*.25));
 const w=p.spinSpeed*motion;
 if(p.spinAxis==='X')this.core.rotation.set(tFly*w,0,0);
 else if(p.spinAxis==='Y')this.core.rotation.set(0,tFly*w,0);
 else if(p.spinAxis==='Diagonal')this.core.rotation.set(tFly*w*.6,tFly*w*.8,tFly*w*.4);
 else this.core.rotation.set(0,0,tFly*w);
 for(const system of this.trails)system.emitter.position.copy(this.core.position);
 if(u>=1)this.contact();
 }
 diagnostics(){return {...(this.shotFx?.diagnostics()??{}),seedScale:this.seedMesh?this.seedMesh.scale.toArray():null,flashParticles:this.flashFx?.particleNum??0,leafTrailParticles:this.trails.reduce((n,s)=>n+s.particleNum,0),spawnParticles:this.spawnFx?.particleNum??0,groundWave:this.groundWave?{scale:this.groundWave.scale.x,opacity:this.groundWave.material.opacity}:null,seedPhase:this.phase(),coreX:this.core?.position.x,coreY:this.core?.position.y,coreZ:this.core?.position.z,coreRotationY:this.core?.rotation.y,coreRotationZ:this.core?.rotation.z,variant:this.p?.variant,contactAt:this.contactAt,velocity:this.velocity,stretch:1+(this.smearAmount??0),launchVisible:this.surfaces?.launch.visible,visibleLaunchRings:this.surfaces?.launch.children.filter(r=>r.visible).length,impactOpacity:this.surfaces?.impact.children[0]?.material.uniforms.opacity.value,launchMeshes:this.surfaces?.launch.children.length,shotOn:this.shotOn,shotRings:this.surfaces?.shot?.children.filter(r=>r.visible).length,shotFlash:this.surfaces?.shotFlashNow,shotKick:this.surfaces?.shotKickNow,shotJet:this.shotJet?.particleNum,shotJetDx:this.shotJet?.particleNum?this.shotJet.particles.slice(0,this.shotJet.particleNum).reduce((n,q)=>n+q.position.x,0)/this.shotJet.particleNum-this.shotJet.emitter.position.x:null,coreRotationX:this.core?.rotation.x,coreScale:this.core?.scale.x,move:this.id,active:this.active,time:this.time,systems:this.systems.length,particles:this.systems.reduce((n,s)=>n+s.particleNum,0),positiveSizes:this.systems.reduce((n,s)=>n+s.particles.slice(0,s.particleNum).filter(p=>p.size.x>0).length,0),settings:this.p,phase:this.phase()};}
 /** Fase exibida na legenda do ateliê. O Seed Bomb usa as quatro fases pedidas. */
 phase(){const p=this.p;if(!this.active||!p)return 'Pronto';
 if(this.id==='seedBomb')return this.hit?'Contato':this.time<p.seedRise?'Surgimento':this.time<p.seedRise+p.launchFlashTime?'Disparo':'Voo';
 if(this.hit)return 'Contato / dissipação';
 if(this.time>p.duration)return 'Dissipação';
 if(this.shotOn&&this.time<p.shotDuration+p.shotShockStagger*p.shotShockCount)return 'Disparo (impacto)';
 if(this.time<.6)return 'Início';
 return this.id==='fireSpin'?'Sustentação':'Trajeto';
 }
 dispose(){this.clear();if(this.ownsBatch)this.batch.removeFromParent();this.root.removeFromParent();}
}
