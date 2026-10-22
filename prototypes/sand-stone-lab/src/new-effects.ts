import * as T from 'three';
import {Particles} from './particles.js';
import {rng, shockRing, mesh} from './art.js';
import type {Variant} from './config.js';

type FxParams = Record<string, number>;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const tint = (h: number) => new T.Color().setHSL(h / 360, .95, .62);
const glow = (color: T.Color, opacity: number) => new T.MeshBasicMaterial({color, transparent:true, opacity, blending:T.AdditiveBlending, depthWrite:false, toneMapped:false, side:T.DoubleSide});
function starGeometry(pointsRatio: number) {
  const s = new T.Shape();
  for(let i=0;i<10;i++) {
    const a=i*Math.PI/5-Math.PI/2, r=i%2 ? .42/pointsRatio : 1;
    if(i===0)s.moveTo(Math.cos(a)*r,Math.sin(a)*r);else s.lineTo(Math.cos(a)*r,Math.sin(a)*r);
  }
  s.closePath();return new T.ShapeGeometry(s);
}

/** Visual preview only. The combat simulation owns spawn count, trajectory and hits. */
export class SwiftEffect {
  duration=2.4;phase='Preparação';punch=0;private stars:T.Group[]=[];private tails:T.Mesh[]=[];private links:T.Line|null=null;private sent=false;private hit=false;
  private group:T.Group;private particles:Particles;private variant:Variant;private p:FxParams;
  constructor(group:T.Group,particles:Particles,variant:Variant,p:FxParams){
    Object.assign(this,{group,particles,variant,p});
    const color=tint(p.primaryHue), second=tint(p.secondaryHue);
    const geometry=starGeometry(p.pointRatio), random=rng(913);
    for(let i=0;i<3;i++){
      const g=new T.Group();group.add(g);this.stars.push(g);
      const scale=p.starScale*(1+(random()-.5)*p.sizeVariation*.55)*(variant===1?.8+i*.15:1);
      const halo=mesh(g,new T.CircleGeometry(.47*p.halo,24),glow(second,.18*p.opacity));halo.position.z=-.012;
      const face=mesh(g,geometry,glow(color,p.opacity));face.scale.setScalar(.28*scale);
      const core=mesh(g,new T.CircleGeometry(.08*p.coreGlow,16),glow(new T.Color(0xffffff),.7*p.opacity));core.position.z=.014;
      g.traverse(o=>{const material=(o as T.Mesh).material;if(material instanceof T.MeshBasicMaterial)material.userData.baseOpacity=material.opacity;});
      g.scale.setScalar(scale);g.visible=false;
      const tail=mesh(group,new T.PlaneGeometry(.11*p.trailWidth,.8*p.tailLength),glow(second,.45*p.opacity));this.tails.push(tail);tail.visible=false;
    }
    if(variant===2){const line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3(),new T.Vector3()]),new T.LineBasicMaterial({color:second,transparent:true,opacity:.45*p.opacity}));group.add(line);this.links=line;}
    // Visible orientation: source, target and shot direction are presentation marks.
    mesh(group,new T.ConeGeometry(.12,.32,8),new T.MeshBasicMaterial({color:0x879fa6}),[0,.12,-2.6]).rotation.x=Math.PI/2;
    const target=mesh(group,new T.TorusGeometry(.48,.018,5,32),glow(new T.Color(0xd1dce5),.35),[0,1,2.8]);target.rotation.y=Math.PI/2;
  }
  update(t:number,_dt:number){
    const flight=clamp((t-.32)/1.02), fade=1-clamp((t-1.45)/(.52*this.p.dissipation));
    if(t>=.32&&!this.sent){this.particles.create({kind:'star',color:tint(this.p.secondaryHue).getHex(),count:Math.round(30*this.p.sparks),duration:.1,life:.35,speed:2,position:[0,1,-2.4],direction:[0,0,1],opacity:.75});this.sent=true;}
    if(t>=1.35&&!this.hit){this.particles.create({kind:'star',color:tint(this.p.primaryHue).getHex(),count:Math.round((this.variant===1?65:35)*this.p.flash),duration:.08,life:.42,speed:4,position:[0,1,2.7],opacity:.8});this.hit=true;}
    for(let i=0;i<3;i++){
      const delay=this.variant===0?i*.085:this.variant===1?i*.035:i*.14;
      const u=clamp((t-.32-delay)/1.02), x=(i-1)*(.42*this.p.dispersion)+(this.variant===1?Math.sin(i*3)*.18:0);
      const g=this.stars[i], tail=this.tails[i];g.visible=t>=.32+delay&&t<1.85;g.position.set(x+(this.variant===2?Math.sin(u*8+i)*.18:0),1+(i%2)*.2+(this.variant===1?Math.sin(u*11+i)*.16:0),-2.4+u*5.1);g.rotation.z=t*this.p.rotation*Math.PI/180*(i%2?-1:1);g.traverse(o=>{const material=(o as T.Mesh).material;if(material instanceof T.MeshBasicMaterial)material.opacity=material.userData.baseOpacity*fade;});
      tail.visible=g.visible&&t<1.35+this.p.trailDuration;tail.position.set(g.position.x,g.position.y,g.position.z-.35*this.p.tailLength);tail.rotation.x=-Math.PI/2;tail.scale.y=.6+u*.4;
    }
    if(this.links){this.links.visible=t>=.6&&t<1.45;const a=this.links.geometry.attributes.position as T.BufferAttribute;this.stars.forEach((s,i)=>a.setXYZ(i,s.position.x,s.position.y,s.position.z));a.needsUpdate=true;}
    this.punch=t>=1.35?Math.exp(-(t-1.35)*20)*.55*this.p.flash:0;
    this.phase=t<.32?'Preparação':t<1.35?'Estrelas em voo':t<1.7?'Impacto visual':'Dissipação';
  }
}

/** Three.js draws stones and orbital hardware; Quarks emits aura and impact particles. */
export class PsyshockEffect {
  duration=3.2;phase='Carga visual';punch=0;private stones:T.Group[]=[];private rings:T.Mesh[][]=[];private tails:T.Mesh[]=[];private emitted=false;private hit=false;
  private group:T.Group;private particles:Particles;private variant:Variant;private p:FxParams;private previewCount:number;
  constructor(group:T.Group,particles:Particles,variant:Variant,p:FxParams,previewCount=5){
    Object.assign(this,{group,particles,variant,p,previewCount});
    const primary=tint(p.primaryHue), secondary=tint(p.secondaryHue);
    const caster=mesh(group,new T.CapsuleGeometry(.28,.75,5,8),new T.MeshStandardMaterial({color:0x627581,roughness:.8}),[0,.7,-2.3]);caster.castShadow=true;
    for(let i=0;i<previewCount;i++){
      const node=new T.Group();group.add(node);this.stones.push(node);
      const rock=mesh(node,new T.IcosahedronGeometry(.18*(.8+(i%3)*.15),1),new T.MeshStandardMaterial({color:0x70687b,flatShading:true,roughness:.75,emissive:variant===1?primary:secondary,emissiveIntensity:.15*p.fissureGlow}));rock.castShadow=true;
      if(variant===1){const edge=new T.LineSegments(new T.EdgesGeometry(rock.geometry),new T.LineBasicMaterial({color:primary,transparent:true,opacity:.6*p.fissureGlow}));node.add(edge);}
      const ringSet:T.Mesh[]=[];
      for(let r=0;r<p.ringCount;r++){const ring=shockRing(r%2?secondary:primary,p.auraRadius*(.25+r*.09),.008*p.ringThickness);ring.material.opacity=p.opacity*(variant===0?.45:variant===2?.65:.22);node.add(ring);ringSet.push(ring);}
      this.rings.push(ringSet);
      if(variant===2){const arc=mesh(node,new T.TorusGeometry(.42*p.auraRadius,.012*p.ringThickness,5,48,Math.PI*1.45),glow(secondary,.45*p.opacity));arc.rotation.set(.8,.5,i*.3);}
      const orb=mesh(node,new T.SphereGeometry(.035*p.orbSize,8,6),glow(primary,.7*p.opacity),[.24,.08,0]);orb.userData.orb=true;
      const tail=mesh(group,new T.PlaneGeometry(.08*p.trailGlow,.55*p.trailLength),glow(primary,.3*p.opacity));tail.visible=false;this.tails.push(tail);
      node.visible=false;
    }
  }
  update(t:number,_dt:number){
    const launch=1.15, flight=clamp((t-launch)/.85), fade=1-clamp((t-2.05)/(.65*this.p.impactDecay));
    if(t>=.1&&!this.emitted){for(let i=0;i<this.previewCount;i++)this.particles.create({kind:this.variant===1?'shard':'orb',color:tint(this.p.primaryHue).getHex(),rate:Math.round(9*this.p.particleDensity),duration:1.95,life:.55,size:.05*this.p.orbSize,speed:.55+this.p.spiral*.35,radius:.15*this.p.auraRadius,position:[(i-(this.previewCount-1)/2)*.42,.7+(i%3)*.19,-1.65],opacity:.7*this.p.opacity});this.emitted=true;}
    if(t>=2&&!this.hit){this.particles.create({kind:'shard',color:tint(this.p.secondaryHue).getHex(),count:Math.round(70*this.p.shards),duration:.08,life:.65,speed:3,position:[0,1,2.4],opacity:.8});this.hit=true;}
    for(let i=0;i<this.previewCount;i++){
      const node=this.stones[i], a=(i-(this.previewCount-1)/2),charged=3+Math.floor((this.previewCount-3)*clamp(t/launch));node.visible=t>=.1&&i<charged&&t<2.7;
      node.position.set(a*.42*(1-flight*.45)+Math.sin(t*3+i)*.04*this.p.spiral,.75+(i%3)*.22+Math.sin(t*4+i)*.045,-1.65+flight*4.05);
      const tail=this.tails[i];tail.visible=t>=launch&&t<2.2;tail.position.set(node.position.x,node.position.y,node.position.z-.25*this.p.trailLength);tail.rotation.x=-Math.PI/2;
      const pulse=1+Math.sin(t*8*this.p.pulseRate+i)*.08*this.p.emissivity;node.scale.setScalar(pulse*fade);
      this.rings[i].forEach((r,j)=>{r.rotation.x=t*this.p.angularSpeed*(j%2?1:-1);r.rotation.y=t*this.p.angularSpeed*(j%2?-1:1);});
      const orb=node.children.find(o=>o.userData.orb);if(orb)orb.position.set(Math.cos(t*5+i)*.25*this.p.auraRadius,.08+Math.sin(t*5+i)*.16,0);
    }
    this.punch=t>=2?Math.exp(-(t-2)*12)*.6*this.p.trailGlow:0;
    this.phase=t<launch?'Carga: '+this.previewCount+' pedras (prévia)':t<2?'Disparo simultâneo':t<2.4?'Impacto visual':'Dissipação';
  }
}
