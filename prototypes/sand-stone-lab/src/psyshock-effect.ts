import * as T from 'three';
import {psiPattern} from './psi-pattern.ts';
import {Particles} from './particles.js';
import {rng} from './art.js';
import type {Variant} from './config.ts';
import {TAU,saturate,smooth,hue,luminous,addMesh,fadeTree,polygon,arc,halo,lens,Ribbon,Shards,stageMarkers,linePath} from './vfx-shapes.ts';
type Params=Record<string,number>;
type Stream=ReturnType<Particles['create']>;

function mineral(seed:number){
  const random=rng(seed),g=new T.IcosahedronGeometry(.29,1),p=g.attributes.position;
  // Deform by coordinates, not by vertex index: duplicate vertices stay welded visually.
  const phase=random()*10;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=1+Math.sin(x*23+y*17+z*31+phase)*.15;p.setXYZ(i,x*k,y*k*.86,z*k);}
  g.computeVertexNormals();return g;
}

/** Rock silhouettes stay solid. Orbital, fracture and dimensional layers are separate constructions. */
export class PsyshockEffect {
  duration:number;phase='Carga psíquica';punch=0;readonly stones:T.Group[]=[];
  private gyros:T.Object3D[][]=[];private chunks:T.Mesh[][]=[];private satellites:T.Mesh[][]=[];private ribbons:Ribbon[]=[];private streams:(Stream|undefined)[]=[];
  private source=new T.Group();private tunnel=new T.Group();private impact=new T.Group();private sourceRings:T.Object3D[]=[];private tunnelRings:T.Object3D[]=[];private shockRings:T.Object3D[]=[];
  private shell:T.Mesh|null=null;private tunnelSkin:T.Mesh<T.CylinderGeometry,T.ShaderMaterial>|null=null;private shards:Shards;private bolts:T.Line[]=[];private impactRays:T.Mesh[]=[];private hit=false;
  private graphic:ReturnType<typeof psiPattern>;private p:Params;private variant:Variant;private particles:Particles;private previewCount:number;
  private readonly launch=1.15;private readonly travel=.85;
  constructor(group:T.Group,particles:Particles,variant:Variant,p:Params,previewCount=5){
    Object.assign(this,{p,variant,particles,previewCount});this.duration=2.2+1.2*p.impactDecay;
    const primary=hue(p.primaryHue,.48),secondary=hue(p.secondaryHue,.62),white=new T.Color(0xe8dfff);
    this.graphic=psiPattern(variant,primary,secondary);group.add(this.graphic);this.graphic.position.set(0,1.55,-2.35);
    stageMarkers(group);group.add(this.source,this.tunnel,this.impact);this.source.position.set(0,.05,-1.7);this.impact.position.set(0,1.35,2.4);
    this.source.name=['psy-armillary-seal','psy-fracture-mandala','psy-dimensional-aperture'][variant];
    for(let i=0;i<previewCount;i++){
      const node=new T.Group();node.name=`psyshock-stone-${i}`;group.add(node);this.stones.push(node);
      const geo=mineral(100+i),rock=addMesh(node,geo,new T.MeshStandardMaterial({color:variant===1?0x38313f:0x555366,roughness:.7,metalness:.22,flatShading:true,emissive:primary,emissiveIntensity:.08*p.fissureGlow,transparent:true,opacity:1}));rock.castShadow=true;rock.rotation.set(i,.3*i,i*.7);rock.userData.rock=true;
      const gyros:T.Object3D[]=[],chunks:T.Mesh[]=[],satellites:T.Mesh[]=[];
      if(variant===0){
        for(let j=0;j<p.ringCount;j++){const ring=arc(node,(.43+j*.09)*p.auraRadius,.012*p.ringThickness,j%2?secondary:primary,.75*p.opacity,TAU*.83);ring.rotation.set(j*.9,.4+j*.6,j);gyros.push(ring);}
        const core=halo(node,.8*p.auraRadius,primary,.4*p.emissivity);core.rotation.y=.5;
        for(let j=0;j<3;j++){const orb=addMesh(node,new T.SphereGeometry(.045*p.orbSize,10,8),luminous(j%2?secondary:white,.9*p.opacity));satellites.push(orb);}
      }else if(variant===1){
        const edge=new T.LineSegments(new T.EdgesGeometry(geo,18),new T.LineBasicMaterial({color:secondary,transparent:true,opacity:.8*p.fissureGlow,blending:T.AdditiveBlending,toneMapped:false}));node.add(edge);
        for(let j=0;j<4;j++){const shard=addMesh(node,new T.TetrahedronGeometry(.13,0),new T.MeshStandardMaterial({color:0x514260,emissive:primary,emissiveIntensity:.65*p.emissivity,roughness:.35,flatShading:true,transparent:true,opacity:1}));chunks.push(shard);}
        for(let j=0;j<p.ringCount;j++){const cage=polygon(node,(.46+j*.08)*p.auraRadius,3,primary,.6*p.opacity);cage.rotation.set(j*.55,j*.7,i+j);gyros.push(cage);}
        for(let j=0;j<3;j++){const a=j/3*TAU,points=Array.from({length:7},(_,k)=>new T.Vector3(Math.cos(a)*(.18+k*.09),(k%2?.07:-.07),Math.sin(a)*(.18+k*.09)));const bolt=addMesh(node,new T.TubeGeometry(new T.CatmullRomCurve3(points),18,.009*p.fissureGlow,4,false),luminous(secondary,.8*p.opacity));gyros.push(bolt);}
      }else{
        const globe=lens(node,.5*p.auraRadius,primary,.5*p.opacity);globe.scale.set(1,.8,1.25);gyros.push(globe);
        for(let j=0;j<2;j++){const ring=arc(node,(.38+j*.16)*p.auraRadius,.015*p.ringThickness,j?primary:secondary,.7*p.opacity,TAU*.65);ring.rotation.set(.8+j,.3+j*.9,j);gyros.push(ring);}
        const orb=addMesh(node,new T.SphereGeometry(.04*p.orbSize,8,6),luminous(white,.9));satellites.push(orb);
      }
      this.gyros.push(gyros);this.chunks.push(chunks);this.satellites.push(satellites);
      this.ribbons.push(new Ribbon(group,variant===1?secondary:primary,.65,new T.Vector3(0,1,.25)));node.visible=false;
    }
    if(variant===0){
      for(let j=0;j<3;j++){const ring=arc(this.source,.8+j*.24,.018, j===1?secondary:primary,.65,TAU*(j===1?.8:1));ring.rotation.x=-Math.PI/2;this.sourceRings.push(ring);}
      for(let j=0;j<18;j++){const a=j/18*TAU,mark=addMesh(this.source,new T.PlaneGeometry(.04,.12+(j%3)*.04),luminous(secondary,.6));mark.rotation.set(-Math.PI/2,0,a);mark.position.set(Math.cos(a)*1.45,0,Math.sin(a)*1.45);}
    }else if(variant===1){
      for(let j=0;j<3;j++){const cage=polygon(this.source,.85+j*.3,3,primary,.75);cage.rotation.set(-Math.PI/2,0,j*Math.PI/3);this.sourceRings.push(cage);}
      for(let j=0;j<9;j++){const a=j/9*TAU,points=Array.from({length:7},(_,k)=>new T.Vector3(Math.cos(a)*k*.27,.01,Math.sin(a)*k*.27+(k%2?.08:-.08)));this.bolts.push(linePath(this.source,points,j%2?primary:secondary,.7));}
    }else{
      this.source.position.set(0,1.3,-2.15);this.shell=lens(this.source,1.1,primary,.45*p.opacity);this.shell.scale.set(1.3,1,.15);
      for(let j=0;j<p.ringCount+2;j++){const ring=arc(this.source,.65+j*.16,.02*p.ringThickness,j%2?secondary:primary,.7*p.opacity,TAU*.78);ring.rotation.z=j*.7;this.sourceRings.push(ring);}
      for(let j=0;j<p.ringCount*2;j++){const ring=arc(this.tunnel,.75+(j%2)*.2,.014*p.ringThickness,j%2?primary:secondary,.45*p.opacity,TAU*.86);ring.position.set(0,1.3,-1.7+j*.68);ring.rotation.z=j*.7;this.tunnelRings.push(ring);}
      const skin=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,uniforms:{primary:{value:primary},secondary:{value:secondary},time:{value:0},opacity:{value:.35*p.opacity},twist:{value:p.spiral}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform vec3 primary,secondary;uniform float time,opacity,twist;void main(){float spiral=.5+.5*sin(vUv.x*18.8496+vUv.y*10.*twist-time*5.);float edges=smoothstep(0.,.18,vUv.y)*smoothstep(0.,.18,1.-vUv.y);float beam=pow(spiral,10.);gl_FragColor=vec4(mix(primary,secondary,spiral),(.045+beam*.5)*edges*opacity);\n#include <colorspace_fragment>\n}'});skin.userData.baseOpacity=.35*p.opacity;
      this.tunnelSkin=new T.Mesh(new T.CylinderGeometry(.9*p.auraRadius,.9*p.auraRadius,4.2,64,1,true),skin);this.tunnelSkin.rotation.x=Math.PI/2;this.tunnelSkin.position.set(0,1.3,.3);this.tunnel.add(this.tunnelSkin);
    }
    // Impact geometry differs by family, not only color.
    for(let j=0;j<(variant===0?4:variant===1?2:6);j++){
      const ring=variant===1?polygon(this.impact,.65+j*.4,3,secondary,.85):arc(this.impact,.4+j*.16,variant===2?.026:.014,j%2?secondary:primary,.75*p.opacity,variant===0?TAU*.9:TAU);
      if(variant===0)ring.rotation.y=(j-1.5)*.35;this.shockRings.push(ring);
    }
    if(variant===1){for(let j=0;j<18;j++){const ray=addMesh(this.impact,new T.ConeGeometry(.035,.8,3),luminous(j%3?primary:secondary,.85));ray.rotation.z=j/18*TAU;this.impactRays.push(ray);}}
    if(variant===2){const sphere=lens(this.impact,1,secondary,.65);sphere.scale.set(1,1,.35);this.shockRings.push(sphere);halo(this.impact,2,primary,.45,1);}
    else halo(this.impact,1.4,primary,.65*p.emissivity);
    this.shards=new Shards(this.impact,variant===1?64:32,secondary,59);this.impact.visible=false;
    group.userData.visualSignature=['pixel-diamonds+armillary-stones','zigzag-checkers+fracture-shards','warped-chromatic-bands+spatial-tunnel'][variant];
  }
  private path(t:number,i:number,out:T.Vector3){
    const u=smooth((t-this.launch)/this.travel),a=(i-(this.previewCount-1)/2),width=.58;
    out.set(a*width*(1-u*.42),1.1+(i%3)*.24+Math.sin(Math.min(t,this.launch)*2.5+i)*.045*(1-u),-1.7+u*4.1+(i%2)*.08);
  }
  update(t:number,_dt:number){
    const {p,variant}=this,post=t-2,charge=smooth(t/this.launch),fade=1-smooth(post/(.85*p.impactDecay)),charged=Math.min(this.previewCount,3+Math.floor((this.previewCount-3)*saturate(t/this.launch)));
    this.graphic.position.z=-2.35+smooth((t-this.launch)/this.travel)*4.1;this.graphic.material.uniforms.time.value=t;this.graphic.material.uniforms.pulse.value=p.pulseRate;this.graphic.material.uniforms.opacity.value=p.opacity*Math.min(1,p.emissivity)*(.2+.65*charge)*fade;this.graphic.visible=t>.08&&fade>.001;this.graphic.scale.setScalar(post>=0?1+post*.5:.85+.15*charge);
    this.source.visible=t<1.65;fadeTree(this.source,(.18+.82*charge)*(1-smooth((t-this.launch)/.5))*p.opacity);this.source.scale.setScalar(.65+.35*charge);
    this.sourceRings.forEach((r,i)=>{if(variant===2)r.rotation.z=t*(i%2?1:-1)*p.angularSpeed;else r.rotation.z=t*(i%2?.3:-.3)*p.angularSpeed;});
    if(this.shell&&(this.shell.material as T.ShaderMaterial).uniforms)(this.shell.material as T.ShaderMaterial).uniforms.time.value=t;
    this.bolts.forEach((b,i)=>{b.visible=Math.sin(t*17+i)>-.3;b.scale.setScalar(.8+.2*Math.sin(t*9+i)*p.spiral);});
    this.tunnel.visible=t>.3&&t<2.6;this.tunnelRings.forEach((r,i)=>{const pulse=1+Math.sin(t*7-i)*.08*p.pulseRate;r.scale.setScalar(pulse*p.auraRadius);r.rotation.z=t*p.angularSpeed*(i%2?1:-1);fadeTree(r,(.25+.75*charge)*fade);});
    if(this.tunnelSkin){this.tunnelSkin.material.uniforms.time.value=t;this.tunnelSkin.material.uniforms.opacity.value=.5*p.opacity*charge*fade*p.emissivity;}
    for(let i=0;i<this.previewCount;i++){
      const node=this.stones[i];this.path(t,i,node.position);node.visible=t>.08&&i<charged&&post<.65*p.impactDecay;
      const presence=(.75+.25*charge)*(1-smooth(post/(.65*p.impactDecay)));node.scale.setScalar(presence*(1+Math.sin(t*7*p.pulseRate+i)*.035*p.emissivity));fadeTree(node,fade);
      const rock=node.children.find(o=>o.userData.rock);if(rock){rock.rotation.y=t*.4+i;rock.rotation.z=Math.sin(t*3+i)*.12;}
      this.gyros[i].forEach((r,j)=>{r.rotation.x=t*p.angularSpeed*(j%2?.7:-.5)+j*.8;r.rotation.y=t*p.angularSpeed*(j%2?-.6:.8)+i*.3;r.rotation.z=t*.3*p.angularSpeed+j;const mat=(r as T.Mesh).material;if(mat instanceof T.ShaderMaterial&&mat.uniforms.time)mat.uniforms.time.value=t;});
      this.chunks[i].forEach((chunk,j)=>{const a=j/4*TAU+t*.4,r=.33+(1-charge)*.16+Math.sin(t*11+i)*.025;chunk.position.set(Math.cos(a)*r,Math.sin(a)*r,.07*Math.sin(j));chunk.rotation.set(j+t,j,-t);});
      this.satellites[i].forEach((orb,j)=>{const a=t*3*p.angularSpeed+j/3*TAU+i,r=.48*p.auraRadius;orb.position.set(Math.cos(a)*r,Math.sin(a)*r,Math.sin(a*.7)*.18*p.spiral);});
      if(node.visible&&!this.streams[i]&&t<2){this.streams[i]=this.particles.create({kind:variant===1?'shard':'orb',color:hue(variant===1?p.secondaryHue:p.primaryHue).getHex(),rate:Math.round((variant===1?28:22)*p.particleDensity),duration:Math.max(.1,2-t),life:.55*p.trailLength,size:.065*p.orbSize,speed:.5+.3*p.spiral,radius:.25*p.auraRadius,angle:1.5,position:node.position.toArray(),opacity:.6*p.opacity});}
      if(this.streams[i])this.streams[i]!.emitter.position.copy(node.position);
      const ribbon=this.ribbons[i];ribbon.mesh.visible=t>=this.launch&&post<.4*p.trailLength;
      ribbon.update((at,v)=>{this.path(at,i,v);if(variant===0){v.x+=Math.sin(at*16+i)*.06*p.spiral;v.y+=Math.cos(at*16+i)*.06*p.spiral;}},Math.min(t,2),.42*p.trailLength,(variant===1?.055:variant===2?.14:.09)*p.trailGlow,p.opacity*(1-smooth(post/(.4*p.trailLength)))*.7);
    }
    if(post>=0&&!this.hit){this.particles.create({kind:variant===1?'shard':'orb',color:hue(p.secondaryHue).getHex(),count:Math.round((variant===1?180:95)*p.shards),duration:.05,life:.8*p.impactDecay,size:variant===1?.14:.085,speed:variant===1?4.5:2.8,radius:.3,angle:1.6,position:[0,1.35,2.4],opacity:.85*p.opacity});this.hit=true;}
    this.impact.visible=post>=0&&fade>.001;if(post>=0){fadeTree(this.impact,fade);this.shockRings.forEach((r,i)=>{const q=Math.max(0,post-i*.035),scale=variant===2?(.3+q*4):(.4+q*2.8);r.scale.setScalar(scale);r.rotation.z=post*(i%2?-1:1);});this.impactRays.forEach((r,i)=>{const a=i/18*TAU,d=.3+post*(1+(i%3)*.5);r.position.set(Math.sin(-a)*d,Math.cos(a)*d,Math.sin(i)*post*.6);r.scale.set(1,1+post*2,1);});this.shards.update(post,'burst',.55,variant===1?.15:.075,fade*Math.min(1,p.shards));}
    this.punch=post>=0?Math.exp(-post*12)*(variant===1?.8:.55)*Math.min(1.5,p.emissivity):0;
    this.phase=t<this.launch?['Ressonância em losangos','Onda serrilhada','Espiral cromática'][variant]:post<0?['Pedras em órbita','Fragmentos sob tensão','Travessia do túnel'][variant]:post<.45?['Ruptura orbital','Colapso angular','Frentes de pressão'][variant]:'Decaimento psíquico';
  }
}
