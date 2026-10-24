import * as T from 'three';
import {ShotEffect} from './shot-effect.ts';
import {Particles} from './particles.js';
import type {Variant} from './config.ts';
import {TAU,saturate,smooth,hue,luminous,addMesh,fadeTree,starShape,polygon,arc,halo,Ribbon,Shards,stageMarkers} from './vfx-shapes.ts';
type Params=Record<string,number>;
type Stream=ReturnType<Particles['create']>;

/** Three presentation anchors; the simulation remains the authority for gameplay. */
export class SwiftEffect {
  duration:number;phase='Concentração';punch=0;readonly stars:T.Group[]=[];
  private ribbons:Ribbon[][]=[];private streams:Stream[]=[];private source=new T.Group();private impact=new T.Group();private echo:T.Mesh;
  private rays:T.Mesh[]=[];private impactRings:T.Object3D[]=[];private debris:Shards;private constellation:T.Line|null=null;private satellites:T.Mesh[]=[];
  private launched=false;private hit=false;private point=new T.Vector3();private p:Params;private variant:Variant;private particles:Particles;
  private cast=.42;private flight=.95;private fin=0;private shot:ShotEffect;
  constructor(group:T.Group,particles:Particles,variant:Variant,p:Params){
    Object.assign(this,{p,variant,particles});this.cast=p.startTime??.42;this.flight=Math.max(.01,p.flightTime??.95);this.duration=this.cast+this.flight+(.73+.8*p.dissipation);this.fin=Math.min(p.finishTime??.45,.73+.8*p.dissipation);
    this.shot=new ShotEffect(group,particles,p,{origin:[0,1.2,-2.45],direction:[0,0,1]});
    const primary=hue(p.primaryHue),secondary=hue(p.secondaryHue,.7),white=new T.Color(0xfff6d8),star=starShape(p.pointRatio);
    stageMarkers(group);group.add(this.source,this.impact);this.source.position.set(0,1.2,-2.45);this.impact.position.set(0,1.3,2.55);
    this.source.name=['swift-solar-aperture','swift-comet-vortex','swift-stellar-map'][variant];
    for(let i=0;i<3;i++){
      const node=new T.Group();node.name=`swift-primary-${i}`;group.add(node);this.stars.push(node);const scale=(variant===1?.29:.44)*p.starScale*(1+(i-1)*.24*p.sizeVariation);
      if(variant<2){
        const body=addMesh(node,new T.ExtrudeGeometry(star,{depth:.12,bevelEnabled:true,bevelThickness:.045,bevelSize:.035,bevelSegments:2,steps:1}),new T.MeshStandardMaterial({color:primary,emissive:primary,emissiveIntensity:.55*p.coreGlow,roughness:.24,metalness:.6,transparent:true,opacity:p.opacity}));body.scale.setScalar(scale);body.rotation.y=.12;body.castShadow=true;
        const face=addMesh(node,new T.ShapeGeometry(star),luminous(white,.8*p.opacity));face.position.z=.09;face.scale.setScalar(scale*.64);
        halo(node,(variant===1?.6:.9)*p.halo,variant===1?hue(p.primaryHue-18):primary,.6*p.opacity).position.z=-.08;
        if(variant===0){for(let j=0;j<5;j++){const a=j/5*TAU+Math.PI/2,ray=addMesh(node,new T.PlaneGeometry(.026,.34),luminous(secondary,.7));ray.position.set(Math.cos(a)*scale*.7,Math.sin(a)*scale*.7,.1);ray.rotation.z=a-Math.PI/2;}}
        else {for(let j=0;j<3;j++){const fin=addMesh(node,new T.TetrahedronGeometry(1,0),luminous(hue(p.primaryHue-18),.25*p.opacity));fin.scale.set(.11*p.trailWidth,.11,.8*p.tailLength);fin.position.set(Math.sin(j*TAU/3)*.12,Math.cos(j*TAU/3)*.12,-.5);fin.rotation.z=j*TAU/3;fin.name='comet-flame-facet';}}
      }else{
        const outline=star.getPoints(10).map(v=>new T.Vector3(v.x*scale,v.y*scale,0));node.add(new T.LineLoop(new T.BufferGeometry().setFromPoints(outline),new T.LineBasicMaterial({color:primary,transparent:true,opacity:p.opacity,toneMapped:false,blending:T.AdditiveBlending})));
        const face=addMesh(node,new T.ShapeGeometry(star),luminous(primary,.27*p.opacity));face.scale.setScalar(scale*.85);
        const inner=addMesh(node,new T.ShapeGeometry(star),luminous(white,.9*p.opacity));inner.scale.setScalar(scale*.25*p.coreGlow);inner.position.z=.02;
        polygon(node,scale*1.4,5,secondary,.6).rotation.z=Math.PI/2;arc(node,scale*1.65,.009,primary,.5,Math.PI*1.3).rotation.z=i;halo(node,.6*p.halo,secondary,.35);
      }
      node.visible=false;const trails:Ribbon[]=[];for(let j=0;j<(variant===0?2:variant===1?3:1);j++)trails.push(new Ribbon(group,j===0?(variant===1?hue(p.primaryHue-18):primary):j===1?white:secondary,.7,new T.Vector3(j===2?1:0,1,j===2?0:.35)));this.ribbons.push(trails);
    }
    if(variant===0){for(let i=0;i<3;i++)arc(this.source,.35+i*.15,.018,primary,.65,TAU*.72).rotation.z=i*2;}
    else if(variant===1){for(let i=0;i<5;i++)arc(this.source,.25+i*.12,.025,primary,.6,Math.PI*1.2).rotation.set(i*.2,.5,i*1.4);}
    else {
      for(const r of [.5,.82,1.05])polygon(this.source,r,r===.82?3:6,primary,.6);
      this.constellation=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:secondary,transparent:true,opacity:.8,blending:T.AdditiveBlending,toneMapped:false}));this.constellation.geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(18),3));this.constellation.frustumCulled=false;group.add(this.constellation);
      for(let i=0;i<12;i++){const marker=addMesh(group,new T.ShapeGeometry(star),luminous(i%2?primary:secondary,.65));marker.scale.setScalar(.035+(i%3)*.012);this.satellites.push(marker);}
    }
    const rays=variant===0?12:variant===1?22:10;
    for(let i=0;i<rays;i++){const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(.035,.34);shape.lineTo(0,1);shape.lineTo(-.035,.34);shape.closePath();const ray=addMesh(this.impact,new T.ShapeGeometry(shape),luminous(i%3?primary:white,.8));ray.rotation.z=i/rays*TAU;this.rays.push(ray);}
    for(let i=0;i<(variant===0?2:3);i++)this.impactRings.push(variant===2?polygon(this.impact,.55+i*.25,i===1?3:5,primary,.85):arc(this.impact,.55+i*.25,variant===1?.035:.016,secondary,.65,variant===1?Math.PI*1.7:TAU));
    if(variant===2)addMesh(this.impact,new T.ShapeGeometry(star),luminous(primary,.14)).scale.setScalar(1.3);
    halo(this.impact,variant===1?1.8:1.2,primary,.7*p.flash);this.debris=new Shards(this.impact,variant===1?36:18,secondary,17);this.impact.visible=false;
    this.echo=arc(group,.55,.02,primary,.4);this.echo.rotation.x=-Math.PI/2;this.echo.position.set(0,.045,2.55);this.echo.visible=false;
    group.userData.visualSignature=['beveled-stars+solar-blade-ribbons','comet-flame-facets+wide-amber-tails','wire-stars+constellation-network'][variant];
  }
  private arrival(i:number){return this.cast+this.flight+(this.variant===0?i*.055:0);}
  private path(t:number,i:number,out:T.Vector3){
    const delay=this.variant===0?i*.055:0,u=saturate((t-this.cast-delay)/this.flight),s=smooth(u);
    out.set((i-1)*(this.variant===2?.8:.52)*(1-s*.4)+Math.sin(u*Math.PI)*(i-1)*(this.variant===1?.65:.25)*this.p.dispersion,1.2+(i===1?(this.variant===2?.6:.22):0)+Math.sin(u*Math.PI)*(this.variant===1?.65:this.variant===2?.18:.3),-2.45+s*5);
  }
  /** Janelas das fases sequenciais (Burst: o surgimento NÃO é carga). Disparo e contato são camadas de evento. */
  timeline(){const a=this.cast+this.flight;return [{id:'start',from:0,to:this.cast},{id:'body',from:this.cast,to:a},{id:'finish',from:a,to:a+this.fin},{id:'impact',from:a+this.fin,to:this.duration}].filter(x=>x.to>x.from) as {id:'start'|'body'|'finish'|'impact';from:number;to:number}[];}
  update(t:number,_dt:number){
    this.shot.update(_dt);
    const {p,variant}=this,post=t-(this.cast+this.flight),fade=1-smooth((t-(this.cast+this.flight+.18))/(.6*p.dissipation));
    this.source.visible=p.startOn!==0&&t<this.cast+.22;this.source.scale.setScalar(.12+.88*smooth(t/this.cast));this.source.rotation.z=t*(variant===1?3:-1.2);fadeTree(this.source,(1-smooth((t-this.cast)/.22))*p.opacity);
    if(t>=this.cast&&!this.launched){this.shot.fire();for(let i=0;i<(p.launchOn===0?0:3);i++){this.path(this.cast,i,this.point);this.streams.push(this.particles.create({kind:variant===1?'streak':'star',color:hue(p.secondaryHue).getHex(),rate:Math.round((variant===1?85:40)*p.sparks),duration:this.flight,life:p.trailDuration,size:variant===1?.15:.07,speed:.8,radius:.09,angle:.5,position:this.point.toArray(),direction:[0,.25,-1],opacity:.8*p.opacity}));}this.particles.create({kind:'star',color:hue(p.primaryHue).getHex(),count:Math.round(28*p.sparks),duration:.05,life:.45,size:.12,speed:2.5,radius:.35,position:[0,1.2,-2.45],opacity:.9});this.launched=true;}
    for(let i=0;i<3;i++){
      const star=this.stars[i],arrival=this.arrival(i);this.path(t,i,star.position);star.visible=!(p.bodyOn===0&&t<arrival)&&!(p.finishOn===0&&t>=arrival)&&t>=.05&&fade>.005;star.scale.setScalar((.15+.85*smooth(t/this.cast))*(1-smooth((t-arrival)/(.55*p.dissipation))*.9));star.rotation.z=(variant===2?-.2:1)*t*p.rotation*Math.PI/180+(i-1)*.18;star.rotation.y=variant===1?Math.sin(t*9+i)*.22:.1;fadeTree(star,fade);
      if(this.streams[i])this.streams[i].emitter.position.copy(star.position);
      this.ribbons[i].forEach((r,j)=>{r.mesh.visible=p.bodyOn!==0&&t>=this.cast&&t<arrival+p.trailDuration;r.update((at,v)=>{this.path(at,i,v);if(variant===1&&j>0){const coil=Math.sin(saturate((at-this.cast)/this.flight)*Math.PI)*.18*p.dispersion;v.x+=Math.cos(at*21+j*Math.PI)*coil;v.y+=Math.sin(at*21+j*Math.PI)*coil;}},Math.min(t,arrival),(variant===1?.85:variant===2?.3:.48)*p.tailLength,(variant===0?(j===0?.13:.025):variant===1?(j===0?.32:.055):.035)*p.trailWidth,(1-smooth((t-arrival)/p.trailDuration))*p.opacity*(j===0?.8:.65));});
    }
    if(this.constellation){this.constellation.visible=t>.12&&post<.3;const a=this.constellation.geometry.attributes.position as T.BufferAttribute;[0,1,2,0,2,1].forEach((n,j)=>{const s=this.stars[n].position;a.setXYZ(j,s.x,s.y,s.z);});a.needsUpdate=true;this.satellites.forEach((s,i)=>{s.visible=t>.12&&post<.4;s.position.copy(this.stars[i%3].position);const r=(.55+(i%4)*.1)*p.halo;s.position.x+=Math.cos(t*2+i)*r;s.position.y+=Math.sin(t*2+i)*r;s.position.z+=Math.sin(i*2)*.15;s.rotation.z=-t*2;});}
    if(post>=0&&!this.hit){if(p.impactOn!==0)this.particles.create({kind:'star',color:hue(p.primaryHue).getHex(),count:Math.round((variant===1?130:70)*p.flash*p.sparks),duration:.05,life:.75*p.dissipation,size:variant===1?.14:.1,speed:variant===1?5.2:3.4,radius:.2,angle:1.6,position:[0,1.3,2.55],opacity:.9*p.opacity});this.hit=true;}
    const impactFade=1-smooth(post/(.85*p.dissipation));this.impact.visible=p.impactOn!==0&&post>=0&&impactFade>.001;
    if(post>=0){fadeTree(this.impact,impactFade*p.flash);const swell=1+smooth(post/.28)*.8;this.rays.forEach((ray,i)=>{ray.scale.set(variant===1?1.6:1,(.5+(i%4)*.18)*swell,1);ray.position.set(Math.sin(-ray.rotation.z)*post*.35,Math.cos(ray.rotation.z)*post*.35,0);});this.impactRings.forEach((r,i)=>{r.scale.setScalar(.3+post*(variant===1?4:2.4)+i*.07);r.rotation.z=post*(i%2?-1:1);});this.debris.update(post,'burst',.65,variant===1?.11:.06,impactFade);}
    this.echo.visible=p.impactOn!==0&&post>=0&&post<.65;this.echo.scale.setScalar(1+Math.max(0,post)*5);fadeTree(this.echo,impactFade*.6);this.punch=p.impactOn!==0&&post>=0?Math.exp(-post*14)*(variant===1?.85:.55)*p.flash:0;
    this.phase=t<this.cast?['Abertura solar','Vórtice de cometas','Montagem do atlas'][variant]:post<0?['Lâminas em voo','Caudas helicoidais','Constelação em deslocamento'][variant]:post<.4?['Coroa de impacto','Explosão meteórica','Ruptura da constelação'][variant]:'Dissipação';
  }
}
