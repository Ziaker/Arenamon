import * as T from 'three';
import {Particles} from './particles.js';
import type {Variant} from './config.ts';
import {TAU,smooth,hue,luminous,addMesh,fadeTree,stageMarkers} from './vfx-shapes.ts';
type Params=Record<string,number>;

// Filled bands with a real hollow centre. No screen/background pattern or legacy aura.
function band(sides:number,width:number,offset=0){
  const shape=new T.Shape(),hole=new T.Path();
  for(let i=0;i<=sides;i++){const a=i/sides*TAU+offset,x=Math.cos(a),y=Math.sin(a);if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);}
  for(let i=sides;i>=0;i--){const a=i/sides*TAU+offset,x=Math.cos(a)*(1-width),y=Math.sin(a)*(1-width);if(i===sides)hole.moveTo(x,y);else hole.lineTo(x,y);}
  shape.holes.push(hole);return new T.ShapeGeometry(shape);
}
function zigzag(){
  const shape=new T.Shape();const points=[[-.7,0],[-.25,.12],[-.4,.32],[.15,.1],[.05,.4],[.65,.02],[.18,-.08],[.29,-.3],[-.22,-.08],[-.1,-.32]];
  points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();return new T.ShapeGeometry(shape);
}
export class PsyshockEffect {
  duration:number;phase='Carga PSI';punch=0;readonly stones:T.Group[]=[];
  private glyphs:T.Mesh[][]=[];private echoes:T.Mesh[][]=[];private impacts:T.Group[]=[];private hit=false;
  private group:T.Group;private particles:Particles;private variant:Variant;private p:Params;private count:number;
  constructor(group:T.Group,particles:Particles,variant:Variant,p:Params,previewCount=5){
    Object.assign(this,{group,particles,variant,p,count:previewCount});this.duration=2.2+1.2*p.impactDecay;
    stageMarkers(group);
    const colors=[hue(p.primaryHue,.58),hue(p.secondaryHue,.64),hue(p.primaryHue+65,.65)];
    for(let i=0;i<previewCount;i++){
      const stone=new T.Group();group.add(stone);this.stones.push(stone);
      const rock=addMesh(stone,new T.IcosahedronGeometry(.25,0),new T.MeshStandardMaterial({color:0x62526f,flatShading:true,roughness:.85,emissive:colors[0],emissiveIntensity:.12*p.fissureGlow,transparent:true}));rock.scale.set(1,.85,1.15);rock.rotation.set(i,i*.7,.3);rock.castShadow=true;
      const glyphs:T.Mesh[]=[],echoes:T.Mesh[]=[];
      for(let j=0;j<p.ringCount;j++){
        const g=addMesh(stone,variant===1?zigzag():band(variant===0?4:6,.08*p.ringThickness,variant===0?Math.PI/2:0),luminous(colors[j%3],.85*p.opacity));g.name='psi-local-glyph';glyphs.push(g);
      }
      for(let j=0;j<5;j++){
        const e=addMesh(group,variant===1?zigzag():band(variant===0?4:6,.07*p.ringThickness,Math.PI/2),luminous(colors[j%3],.65*p.opacity*p.trailGlow));e.name='psi-motion-echo';echoes.push(e);
      }
      const impact=new T.Group();group.add(impact);this.impacts.push(impact);
      for(let j=0;j<6;j++){
        const g=addMesh(impact,variant===1?zigzag():band(variant===0?4:6,.09*p.ringThickness,Math.PI/2),luminous(colors[j%3],p.opacity));g.name='psi-impact-glyph';
      }
      this.glyphs.push(glyphs);this.echoes.push(echoes);
    }
    group.userData.visualSignature=['PSI-local-diamond-compression-and-echoes','PSI-local-zigzag-discharge-and-cuts','PSI-local-hexagonal-bloom-and-petals'][variant];
  }
  private path(t:number,i:number,out:T.Vector3){
    const u=smooth((t-1.15)/.85),a=i-(this.count-1)/2;
    out.set(a*.64*(1-u*.35),1.12+(i%3)*.29+Math.sin(t*3+i)*.06*(1-u),-1.7+4.1*u);
  }
  update(t:number,_dt:number){
    const {p,variant}=this,post=t-2,charge=smooth(t/1.15),fade=1-smooth(post/(.85*p.impactDecay)),step=Math.floor(t*14*p.angularSpeed)/14;
    const active=Math.min(this.count,3+Math.floor((this.count-3)*charge));
    for(let i=0;i<this.count;i++){
      const stone=this.stones[i];this.path(t,i,stone.position);stone.visible=t>.08&&i<active&&post<.35;
      stone.scale.setScalar((.65+.35*charge)*(1-smooth(post/.35)));fadeTree(stone,fade);
      this.glyphs[i].forEach((g,j)=>{
        const phase=(step*p.pulseRate+j/p.ringCount)%1;
        if(variant===0){g.scale.setScalar((.8-phase*.38)*p.auraRadius);g.rotation.set(0,0,Math.PI/4*(j%2));g.position.set(0,0,(j-1)*.09);}
        else if(variant===1){const a=j/p.ringCount*TAU+Math.floor(step*3)*Math.PI/4;g.scale.setScalar((.5+phase*.22)*p.auraRadius);g.position.set(Math.cos(a)*.38,Math.sin(a)*.38,0);g.rotation.set(0,0,a);}
        else {const a=j/p.ringCount*TAU+step*.7*p.spiral;g.scale.setScalar((.32+phase*.4)*p.auraRadius);g.position.set(Math.cos(a)*.22,Math.sin(a)*.22,(phase-.5)*.3);g.rotation.set(0,0,-a);}
        fadeTree(g,p.emissivity*(.5+.5*Math.sin(Math.PI*phase)));
      });
      this.echoes[i].forEach((e,j)=>{
        const lag=(j+1)*.065*p.trailLength;this.path(Math.min(t,2)-lag,i,e.position);e.visible=t>1.15+lag&&post<.3*p.trailLength;
        e.scale.setScalar((variant===1?.55:.55-j*.055)*p.auraRadius);e.rotation.z=variant===1?(j%2?-.4:.4):j*.18*p.spiral;fadeTree(e,(1-j/6)*(1-smooth(post/(.3*p.trailLength))));
      });
      const impact=this.impacts[i];this.path(2,i,impact.position);impact.visible=post>=0&&fade>.001;
      if(post>=0){impact.children.forEach((child,j)=>{const g=child as T.Mesh,q=Math.max(0,post-j*.045),a=j/6*TAU;
        if(variant===0){g.scale.setScalar((.2+q*2.7)*p.auraRadius);g.position.set(0,0,j*.035);g.rotation.z=j%2?Math.PI/4:0;}
        else {const r=q*(variant===1?2.5:1.7);g.position.set(Math.cos(a)*r,Math.sin(a)*r,j*.025);g.rotation.z=a+(variant===2?q*p.spiral:0);g.scale.setScalar((variant===1?.65:.35+q*.5)*p.auraRadius);}
        fadeTree(g,fade*p.emissivity*(1-j*.08));});}
    }
    if(post>=0&&!this.hit){this.particles.create({kind:variant===1?'shard':'orb',color:hue(p.secondaryHue).getHex(),count:Math.round(40*p.particleDensity*p.shards),duration:.05,life:.45*p.impactDecay,size:.045*p.orbSize,speed:2,radius:.3,position:[0,1.4,2.4],opacity:p.opacity});this.hit=true;}
    this.punch=post>=0?Math.exp(-post*10)*.4*p.emissivity:0;
    this.phase=t<1.15?['Compressão em losangos','Acúmulo de descargas','Floração hexagonal'][variant]:post<0?['Ecos em deslocamento','Cortes em deslocamento','Pétalas em deslocamento'][variant]:post<.5?['Expansão dos losangos','Ruptura serrilhada','Explosão em pétalas'][variant]:'Dissipação PSI';
  }
}
