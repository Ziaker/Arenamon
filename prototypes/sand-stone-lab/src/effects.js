import * as T from 'three';
import {clamp,mesh,sandSurface,shockRing,fractures,rockModel,Debris,rng} from './art.js';

const easeOut=t=>1-(1-clamp(t))**3;
const energyColor=(h,variant)=>new T.Color(variant===2?0xb4e1ba:0xffc780).offsetHSL(h/360,0,0);
const glow=color=>new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(2),transparent:true,opacity:.75,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});

export class SandEffect {
  constructor(group,particles,variant,p){
    Object.assign(this,{group,particles,variant,p});this.streams=[];this.started=false;this.hit=false;this.ended=false;
    this.cast=.25;this.travel=.75;this.duration=this.cast+this.travel+1.65;
    this.fronts=[];const styles=Array.from({length:Math.max(1,(variant===0?2:3)+Math.round(p.crestCount)-3)},()=>variant===2?2:variant===1?1:0);
    styles.forEach((style,i)=>{
      const head=new T.Group();group.add(head);head.visible=false;
      const width=p.width*(variant===1?1-i*.09:variant===2?1-i*.13:1-i*.06);
      const height=p.height*(variant===1?1.85-i*.32:variant===2?1.05-i*.12:1-i*.16);
      const surface=sandSurface(width,height,style,0,p);head.add(surface);
      if(variant===0){
        const points=[];for(let j=0;j<=36;j++){const u=j/36;points.push(new T.Vector3((u-.5)*width,Math.sin(u*Math.PI)*height*.56,((u-.5)*2)**2*.7));}
        const rim=mesh(head,new T.TubeGeometry(new T.CatmullRomCurve3(points),60,.018*p.edgeGlow,4,false),glow(0xffcf7a));rim.userData.rim=true;
      }
      this.fronts.push({head,surface,index:i});
    });
    this.warning=shockRing(0xa9854b,.65,.04);this.warning.position.z=-p.length/2;group.add(this.warning);
    this.shocks=[shockRing(0xf5bc61,1,.09),shockRing(0xb17d40,1,.25)];for(const s of this.shocks){s.visible=false;group.add(s);}
    this.rubble=new T.Group();this.rubble.position.z=p.length/2;group.add(this.rubble);this.debris=new Debris(this.rubble,{count:variant===2?65:35,seed:variant+14,radius:p.width*.32*p.lateralSpread,force:.55*p.particleSpeed,color:0xaf8c57});this.debris.mesh.scale.setScalar(p.debrisSize);
    this.phase='Concentração';this.punch=0;
  }
  launch(){
    const {p,particles,variant}=this,n=7;
    for(let i=0;i<n;i++){
      const x=(i/(n-1)-.5)*p.width*.95;
      const dust=particles.create({kind:'dust',color:variant===1?0xc09561:0xe0b77b,rate:Math.round((variant===1?36:18)*p.density),duration:this.travel,life:(variant===1?1.1:.75)*p.dustPersistence,size:variant===1?.78:.42,speed:(variant===1?1.7:1)*p.particleSpeed,opacity:p.smoke*.7*p.dustOpacity,radius:.18*p.lateralSpread,angle:1.1*p.turbulence,position:[x,.13,-p.length/2],direction:[0,.6,-.7],gravity:.35});
      const grain=particles.create({kind:'grain',color:0xf3cb82,rate:Math.round(65*p.density),duration:this.travel,life:.45,size:.035*p.grainSize,speed:3*p.particleSpeed,opacity:.8,radius:.18*p.lateralSpread,angle:.6*p.turbulence,position:[x,.15,-p.length/2],direction:[0,.25,1],gravity:-3*p.visualGravity});
      this.streams.push({dust,grain,x});
    }
    particles.create({kind:'dust',count:Math.round(30*p.density),duration:.05,life:.7,size:.5,speed:1.7,opacity:.4,radius:p.width*.3,position:[0,.1,-p.length/2],direction:[0,.15,-1],angle:1});
    this.started=true;
  }
  impact(){
    const {p,particles}=this;
    particles.create({kind:'grain',count:Math.round(145*p.density*p.impactIntensity),duration:.05,life:.65,size:.048*p.grainSize,speed:5*p.particleSpeed,gravity:-7*p.visualGravity,radius:p.width*.32*p.lateralSpread,angle:1.2*p.turbulence,position:[0,.2,p.length/2],direction:[0,1,.7],opacity:.85});
    particles.create({kind:'dust',count:Math.round(35*p.density*p.impactIntensity),duration:.05,life:1.3*p.dustPersistence,size:.7,speed:2.2*p.particleSpeed,radius:p.width*.36*p.lateralSpread,angle:1.3*p.turbulence,position:[0,.15,p.length/2],opacity:.5*p.smoke*p.dustOpacity});this.hit=true;
  }
  update(t,dt){
    const {p,variant}=this,active=t-this.cast,u=clamp(active/this.travel),fade=1-clamp((active-this.travel)/.65);
    if(active>=0&&!this.started)this.launch();if(active>=this.travel&&!this.hit)this.impact();
    this.fronts.forEach(({head,surface,index:i})=>{
      const delay=variant===2?i*.14:variant===1?i*.055:i*.09;
      const progress=clamp((active-delay)/this.travel);
      head.visible=active>=delay&&fade>0;
      head.position.set(0,variant===1?.02+i*.015:.03,-p.length/2+progress*p.length-(variant===1?i*.23:0));
      head.scale.y=(.35+.65*easeOut(active*8))*Math.max(.08,fade);
      surface.material.uniforms.time.value=t+i*.2;surface.material.uniforms.fade.value=fade*(variant===1?1-i*.17:1);
      for(const child of head.children)if(child.userData.rim)child.material.opacity=fade*.65;
    });
    for(const {dust,grain,x} of this.streams){const z=-p.length/2+u*p.length;dust.emitter.position.set(x,.15+Math.sin(t*8+x)*.06,z-.15);grain.emitter.position.set(x,.25,z);}
    this.warning.material.opacity=t<this.cast?(.25+t/this.cast*.6):Math.max(0,.7-active*4);this.warning.scale.setScalar(.65+clamp(t/this.cast)*.7);
    const post=active-this.travel;this.shocks.forEach((s,i)=>{const q=post-i*.08;s.visible=q>=0&&q<.55;s.position.z=p.length/2;s.scale.setScalar(.25+Math.max(0,q)*5);s.material.opacity=clamp(1-q/.55)*.4;});
    this.debris.update(post);this.punch=post>=0?Math.exp(-post*16)*.6*p.impactIntensity:0;
    this.phase=t<this.cast?'Concentração':active<this.travel?'Déferlante':post<.4?'Impacto':'Areia assentando';
  }
}

export class StoneEffect {
  constructor(group,particles,variant,p,texture,model){
    Object.assign(this,{group,particles,variant,p});this.started=false;this.endDust=false;this.phase='Pressão subterrânea';this.punch=0;
    this.duration=p.warning+p.rise+2.4;
    this.rock=rockModel(model,texture);this.rock.scale.setScalar(p.scale);this.rock.visible=false;group.add(this.rock);this.rock.traverse(o=>{if(o.material?.isMeshBasicMaterial&&o.material.toneMapped===false)o.material.opacity*=p.veinGlow;});
    const energy=new T.Color(variant===2?0x91d4b1:0xf0a443).offsetHSL(p.energyHue/360,0,0);this.cracks=fractures(24+variant,energy,p.crackWidth);group.add(this.cracks);
    this.rings=[];
    for(let i=0;i<Math.max(1,(variant===2?4:2)+p.shockCount-3);i++){
      const ring=shockRing(energy,(1.15+i*.28)*p.warningRadius,.016+(i===0?.025:0));group.add(ring);this.rings.push(ring);
    }
    this.shocks=[shockRing(0xeac085,1,.1),shockRing(0xa98b64,1,.3),shockRing(0x9fcfba,1,.035)];for(const s of this.shocks){s.visible=false;group.add(s);}
    this.rubble=new Debris(group,{count:variant===1?100:65,seed:variant+211,radius:1.15*p.radialSpread,force:(variant===1?1.3:.8)*p.fragmentSpeed,color:variant===1?0x6a5750:0x8b7960});this.rubble.mesh.scale.setScalar(p.fragmentSize);
    this.runes=new T.Group();group.add(this.runes);
    if(variant===2){
      const m=glow(0xb3d9b9);for(let i=0;i<18;i++){
        const a=i/18*Math.PI*2,r=1.88;
        const rune=mesh(this.runes,new T.PlaneGeometry(.045,.14+(i%3)*.07),m,[Math.cos(a)*r,.034,Math.sin(a)*r]);rune.rotation.set(-Math.PI/2,0,-a);
        if(i%2===0){const cross=mesh(this.runes,new T.PlaneGeometry(.12,.025),m,[Math.cos(a)*r,.035,Math.sin(a)*r]);cross.rotation.set(-Math.PI/2,0,-a);}
      }
    }
  }
  erupt(){
    const {particles,p,variant}=this,color=variant===1?0xd0a071:0xc6b18a;
    for(let i=0;i<12;i++){
      const a=i/12*Math.PI*2;
      particles.create({kind:'dust',color,count:Math.round((variant===1?7:5)*p.density),duration:.06,life:1.4*p.dustPersistence,size:.75,speed:(variant===1?4.2:2.4)*p.fragmentSpeed,radius:.22*p.radialSpread,angle:.3*p.turbulence,opacity:p.smoke*.65,position:[Math.cos(a)*.9,.15,Math.sin(a)*.9],direction:[Math.cos(a),.16*p.verticalImpulse,Math.sin(a)],gravity:.35});
    }
    particles.create({kind:'grain',color:energyColor(p.energyHue,variant),count:Math.round((variant===1?210:115)*p.density),duration:.06,life:1.2,size:(variant===1?.055:.035)*p.fragmentSize,speed:(variant===1?7:4)*p.fragmentSpeed,gravity:-7,angle:1.15*p.turbulence,radius:1.15*p.radialSpread,position:[0,.2,0],direction:[0,p.verticalImpulse,0],opacity:.9});
    if(variant===1)particles.create({kind:'streak',color:0xffae49,count:Math.round(42*p.density),duration:.05,life:.45,size:.3,speed:8,angle:.65,radius:.5,position:[0,.8,0],opacity:1});
    if(variant===2)particles.create({kind:'grain',color:0xaadcbc,rate:Math.round(70*p.density),duration:1.8,life:1.2,size:.035,speed:1.1,angle:.25,radius:1.3,position:[0,.2,0],opacity:.75});
    this.started=true;
  }
  update(t,dt){
    const {p,variant}=this,post=t-p.warning,u=clamp(post/p.rise),end=clamp((t-(this.duration-.55))/.55);
    if(post>=0&&!this.started)this.erupt();
    this.rock.visible=post>=0;this.rock.position.y=-4.3*p.scale*(1-easeOut(u))-end*end*4.3*p.scale;
    this.rock.rotation.z=variant===1?Math.sin(post*22)*Math.exp(-Math.max(0,post)*9)*.035:0;
    for(const piece of this.rock.userData.pieces){if(piece.userData.floating){if(piece.userData.baseY===undefined)piece.userData.baseY=piece.position.y;piece.position.y=piece.userData.baseY+Math.sin(t*2+piece.id)*.06;}}
    this.cracks.userData.glow.opacity=(post<0?clamp(t/p.warning)**2*.85:Math.exp(-post*1.4)*.8)*p.crackIntensity;
    this.rings.forEach((r,i)=>{r.material.opacity=(post<0?clamp(t/p.warning)*.5:(variant===2?.4:.1)*Math.exp(-post))*(1-end)*p.emissivity;r.rotation.z=t*(i%2?.1:-.1)*p.shockSpeed;r.scale.setScalar(1+Math.sin(t*5*p.shockSpeed+i)*.015);});
    this.runes.rotation.y=t*.16;this.runes.visible=t<this.duration-.2;
    this.shocks.forEach((s,i)=>{const q=post-i*.08;s.visible=q>=0&&q<.7&&(i<2||variant===2);s.scale.setScalar(.85+Math.max(0,q)*(variant===1?7.5:5)*p.shockSpeed);s.material.opacity=clamp(1-q/.7)*(i===1?.28:.65)*p.flash;});
    this.rubble.update(post);
    this.punch=post>=0?Math.exp(-post*15*p.settling)*(variant===1?1:.65)*p.flash:0;
    this.phase=post<0?'Pressão subterrânea':post<p.rise?'Ruptura do solo':end>0?'Fim da demonstração':'Rocha estabelecida';
  }
}

export class RockEffect {
  constructor(group,variant,p,texture){this.rock=rockModel(variant,texture);this.rock.scale.setScalar(p.scale);group.add(this.rock);this.p=p;this.duration=12;this.phase='Inspeção do modelo';this.punch=0;this.rock.traverse(o=>{if(o.isMesh&&o.material.isMeshStandardMaterial)o.material.wireframe=!!p.wire;});}
  update(t){this.rock.rotation.y=this.p.rotation*Math.PI/180+t*this.p.turn*Math.PI/180;for(const m of this.rock.userData.pieces)if(m.userData.floating){if(m.userData.baseY===undefined)m.userData.baseY=m.position.y;m.position.y=m.userData.baseY+Math.sin(t*2+m.id)*.06;}}
}
