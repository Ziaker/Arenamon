import * as T from 'three';

// Superfícies de energia contínuas, desenhadas para a silhueta de cada elemento.
// Gotas, brasas e poeira continuam exclusivamente nos ParticleSystems do Quarks.
const vertex = `
 varying vec2 vUv; varying vec3 vN; varying vec3 vEye;
 uniform float time; uniform float warp; uniform float elongation; uniform float bodyRadius; uniform vec3 stretchAxis;
 void main(){vUv=uv;vec3 p=position;
 p-=stretchAxis*elongation*bodyRadius*(1.-smoothstep(-bodyRadius,bodyRadius,dot(p,stretchAxis)));
 p+=normal*warp*(sin(position.y*8.0+time*2.0)+sin(position.x*11.0-position.z*7.0-time*1.4))*.025;
 vec4 view=modelViewMatrix*vec4(p,1.0);vEye=-view.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*view;}`;
const common=`
 uniform float time,opacity,brightness,detail,bandCount;uniform vec3 color,accent;
 varying vec2 vUv;varying vec3 vN,vEye;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 float fbm(vec2 p){return noise(p)*.57+noise(p*2.03)*.28+noise(p*4.01)*.15;}
 void emit(vec3 c,float a){gl_FragColor=vec4(c*brightness,a*opacity);}
`;
const water=common+`
 void main(){vec2 p=vec2(vUv.x*8.-time*.65,vUv.y*12.);
 float n=fbm(p*1.8+vec2(time*.18,-time*.4));
 float w=sin(p.y*3.2+p.x*.8+n*5.+sin(p.x*1.8+time)*.9);
 float foam=smoothstep(.82,.96,w)*smoothstep(.28,.54,n);
 float vein=smoothstep(.94,.985,sin(p.y*5.+p.x*2.+n*7.));
 float rim=pow(1.-abs(dot(normalize(vN),normalize(vEye))),2.3);
 float light=.12+.5*max(0.,dot(normalize(vN),normalize(vec3(-.4,.8,1.))));
 vec3 c=mix(color*.12,color*1.05,light);c=mix(c,color*1.7,smoothstep(.15,.7,n)*.35);
 c=mix(c,accent*1.35,clamp(foam*detail+vein*.32*detail+rim*.65,0.,1.));emit(c,.98);}`;
const fire=common+`
 void main(){vec2 uv=vUv;float n=fbm(vec2(uv.x*12.+uv.y*5.-time*.8,uv.y*7.-time*1.5));
 float lanes=sin(uv.y*(12.+bandCount*7.)-uv.x*12.566+time*2.5+n*3.2);
 float cut=.12+uv.y*.38;float body=smoothstep(cut,cut+.18,n+lanes*.2);
 float top=1.-smoothstep(.64+n*.33,1.,uv.y);float bottom=smoothstep(0.,.09,uv.y);
 float hot=smoothstep(.6,.94,n+lanes*.25);
 vec3 c=mix(color*.12,color*1.6,smoothstep(.17,.48,n));c=mix(c,accent*2.,hot);
 c=mix(c,vec3(1.8,1.4,.45),smoothstep(.76,.95,n+lanes*.2));emit(c,body*top*bottom);}`;
const ribbon=common+`
 void main(){float n=fbm(vec2(vUv.x*22.-time*2.,vUv.y*5.));
 float edge=sin(vUv.x*3.14159);float width=edge*(.8+n*.2);float across=abs(vUv.y-.5)*2.;
 float a=(1.-smoothstep(width-.18,width,across))*smoothstep(0.,.04,vUv.x)*(1.-smoothstep(.88,1.,vUv.x));
 float str=sin(vUv.y*37.+n*7.+vUv.x*17.-time*3.);
 vec3 c=mix(color,accent,smoothstep(.1,.7,str)*detail);c=mix(c,accent*1.6,smoothstep(width-.25,width-.1,across));emit(c,a);}`;
const fireRibbon=common+`
 void main(){float n=fbm(vec2(vUv.x*14.-time*1.4,vUv.y*3.+time*.2));float taper=pow(sin(vUv.x*3.14159),.45);float edge=abs(vUv.y-.5)*2.;
 float a=(1.-smoothstep(taper-.16,taper,edge))*smoothstep(.15,.32,n+(.5-edge)*.35);
 float hot=smoothstep(.58,.82,n+(.5-vUv.y)*.45);vec3 c=mix(color*.12,color*1.1,smoothstep(.12,.4,n));
 c=mix(c,accent*1.35,clamp(hot*detail,0.,1.));emit(c,a);}`;
const wind=common+`
 void main(){float ends=pow(max(0.,sin(vUv.x*3.14159)),.65);float edge=1.-smoothstep(.04,.85,vUv.y);float a=ends*edge;
 emit(mix(vec3(.8),vec3(1.5),edge),a);}`;
const splash=common+`
 void main(){float n=fbm(vec2(vUv.x*28.+time*.6,vUv.y*7.-time));float foam=smoothstep(.5,.75,n+vUv.y*.12);float a=(1.-smoothstep(.65+n*.3,1.,vUv.y))*smoothstep(0.,.12,vUv.y);
 emit(mix(color*.6,accent*1.2,foam),a*(.45+foam*.55));}`;
const ring=common+`
 void main(){float n=fbm(vec2(vUv.x*24.-time*.7,vUv.y*6.));float cut=sin(vUv.x*90.+n*7.)*.09;
 float a=smoothstep(cut,cut+.16,vUv.y)*(1.-smoothstep(.65+n*.3,1.,vUv.y));
 float bands=pow(.5+.5*sin(vUv.y*10.+n*8.-time*3.),6.);emit(mix(color,accent,bands)*1.3,a*(.2+bands*.7));}`;
function surface(fn,segments=160,cross=12){const pos=[],uv=[],idx=[];for(let i=0;i<=segments;i++)for(let j=0;j<=cross;j++){const v=fn(i/segments,j/cross);pos.push(...v);uv.push(i/segments,j/cross);}for(let i=0;i<segments;i++)for(let j=0;j<cross;j++){let k=i*(cross+1)+j;idx.push(k,k+1,k+cross+1,k+1,k+cross+2,k+cross+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;}
export class ElementalSurfaces {
 constructor(fx){this.fx=fx;this.p=fx.p;this.id=fx.id;this.parts=[];this.uniforms=[];this.impact=new T.Group();fx.root.add(this.impact);this.impact.visible=false;this.core=fx.core;this.launch=new T.Group();fx.root.add(this.launch);this.build();}
 material(shader,opacity=1,warp=0){const p=this.p;const m=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:shader,transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0},opacity:{value:opacity},brightness:{value:p.brightness},detail:{value:p.detail??1},warp:{value:warp},elongation:{value:0},bodyRadius:{value:p.size},stretchAxis:{value:new T.Vector3(1,0,0)},bandCount:{value:p.rings},color:{value:new T.Color(p.color)},accent:{value:new T.Color(p.accent)}}});this.fx.materials.push(m);this.uniforms.push(m.uniforms);return m;}
 add(g,shader,parent=this.core,opacity=1,warp=0){const m=new T.Mesh(g,this.material(shader,opacity,warp));parent.add(m);return m;}
 build(){const p=this.p,s=p.size;
 if(this.id==='waterPulse'){
 for(let i=0;i<3;i++)this.add(surface((u,v)=>{const a=u*Math.PI*2,rad=s*(.8+i*.18+v*.12);return [-i*s*.3,Math.cos(a)*rad,Math.sin(a)*rad];},96,4),splash,this.launch,.9);
 const geo=new T.SphereGeometry(s,96,64);const pos=geo.attributes.position;
 for(let i=0;i<pos.count;i++){const x=pos.getX(i)/s;pos.setX(i,pos.getX(i)+s*Math.pow(Math.max(0,x),3)*(.65+p.variant*.4));}geo.computeVertexNormals();
 const ball=this.add(geo,water,this.core,1,1);ball.material.depthWrite=true;
 if(p.variant===2){for(let i=0;i<3;i++){const jet=this.add(surface((u,v)=>{const a=u*8+i*2.094,r=s*(.6+u*.3);return [-s*(.5+u*2.5),Math.cos(a)*r+(v-.5)*.13,Math.sin(a)*r];}),ribbon);this.parts.push(jet);}}

 for(let i=0;i<p.rings;i++){const phase=i*2.399;const r=this.add(surface((u,v)=>{const a=u*Math.PI*2.5+phase,lat=(u-.5)*2.2+(v-.5)*.12*Math.sin(u*Math.PI);const rr=s*1.025;return [Math.cos(a)*Math.cos(lat)*rr,Math.sin(lat)*rr,Math.sin(a)*Math.cos(lat)*rr];},Math.max(12,Math.floor(480/Math.max(1,p.rings))),2),ribbon);r.rotation.z=.25+i*.5;this.parts.push(r);}
 // Ruptura perpendicular ao disparo: compressão, explosão e spray no contato.
 this.impact.rotation.z=Math.PI/2;
 this.add(surface((u,v)=>{const a=u*Math.PI*2;const r=s*(.6+v*1.2);const crest=(.25+Math.pow(.5+.5*Math.sin(a*7.+Math.sin(a*3.)),3)*.55)*v;return [Math.cos(a)*r,crest*s,Math.sin(a)*r];}),splash,this.impact,1);
 this.add(surface((u,v)=>{const a=u*Math.PI*2,r=s*(1+v*1.5);return [Math.cos(a)*r,.02,Math.sin(a)*r];}),ring,this.impact,.9);
 }else if(this.id==='fireSpin'){
 const inner=p.opening,outer=inner+s*.8;
 // Todas as superfícies ficam fora do raio interno: o chão permanece visível no centro.
 const arms=p.fireArms;
 for(let i=0;i<arms;i++){const r=this.add(surface((u,v)=>{const a=i*Math.PI*2/arms+u*p.fireArc;const rad=inner+s*.15+v*s*.65*p.fireWidth+u*p.fireRadial;const y=.1+(Math.sin(u*Math.PI)*p.height*.18+v*p.height*.12)*p.fireLift;return [Math.cos(a)*rad,y,Math.sin(a)*rad];}),fireRibbon);this.parts.push(r);}
 for(let i=0;i<p.fireRings;i++){this.add(surface((u,v)=>{const a=u*Math.PI*2,r=inner+i*p.fireSpacing+v*s*.55*p.fireWidth;return [Math.cos(a)*r,.035+v*.12,Math.sin(a)*r];}),fire);}
 }else if(this.id==='airSlash'){
 this.core.rotation.x=-Math.PI/2;
 this.add(surface((u,v)=>{const a=(u-.5)*Math.PI*1.5,r=s*(.5+v*.2);return [Math.cos(a)*r,0,Math.sin(a)*r];}),wind,this.launch);
 const cuts=p.variant===1?3:1;
 for(let i=0;i<cuts;i++){const blade=this.add(surface((u,v)=>{const a=(u-.5)*Math.PI*1.15,r=s*(1.5-v*.22*Math.sin(u*Math.PI));return [Math.cos(a)*r-i*.28,Math.sin(a)*r,0];}),wind);blade.position.z=i*.16;}
 const trails=p.variant===2?5:2;
 for(let i=0;i<trails;i++){this.add(surface((u,v)=>{const a=(u-.5)*Math.PI*1.12,r=s*(1.46-i*.08);return [Math.cos(a)*r-u*p.trail*(p.variant===2?.65:.3)-v*.04,Math.sin(a)*r,i*.04];}),wind,this.core,.18);}
 // Contact de corte: raios tangenciais e arcos abertos; nenhuma onda no chão.
 for(let i=0;i<(p.variant===1?9:6);i++){const theta=i*Math.PI*2/6;const cut=this.add(surface((u,v)=>{const r=s*(.15+u*1.8),w=Math.sin(u*Math.PI)*.075;return [0,Math.cos(theta)*r-Math.sin(theta)*(v-.5)*w,Math.sin(theta)*r+Math.cos(theta)*(v-.5)*w];},48,2),wind,this.impact);cut.rotation.y=.4;}
 for(let i=0;i<2;i++)this.add(surface((u,v)=>{const a=(u-.5)*Math.PI*1.3,r=s*(.5+i*.35+v*.045);return [0,Math.cos(a)*r,Math.sin(a)*r];}),wind,this.impact,.7);

 }
 }
 update(t){const p=this.p,motion=this.fx.reduced?.18:1;const envelope=Math.min(1,t/(p.fireRise??.35),Math.max(0,(p.duration-t)/(p.fireFade??.7)));
 if(t===0)this.launch.position.copy(this.core.position);this.launch.visible=t<.3&&this.fx.contactAt===null;this.launch.scale.setScalar(.6+t*4);this.launch.traverse(o=>{if(o.material?.uniforms)o.material.uniforms.opacity.value=Math.max(0,1-t/.3);});
 for(const u of this.uniforms)u.time.value=t*p.rotation*.25*motion;
 if(this.id==='fireSpin'){this.core.scale.set(1,Math.max(.001,envelope),1);this.core.rotation.y=t*p.rotation*.5*motion;for(const u of this.uniforms)u.opacity.value=envelope;}
 else if(this.id==='waterPulse'){const amount=this.fx.velocity*p.stretch*(p.variant===1?.3:.17);this.fx.smearAmount=amount;this.core.scale.set(1,1/Math.sqrt(1+amount*.3),1/Math.sqrt(1+amount*.3));this.core.traverse(o=>{if(o.material?.uniforms){o.material.uniforms.elongation.value=amount;o.material.uniforms.stretchAxis.value.set(1,0,0).applyQuaternion(o.quaternion.clone().invert());}});for(let i=0;i<this.parts.length;i++)this.parts[i].rotation.y=t*p.rotation*(i%2?-.35:.4)*motion;}
 if(this.id==='airSlash'&&this.fx.contactAt===null){const birth=Math.min(1,t/.22),ease=1-Math.pow(1-birth,3);this.core.scale.setScalar(.05+.95*ease);this.core.traverse(o=>{if(o.material?.uniforms)o.material.uniforms.opacity.value=birth;});}
 if(this.fx.contactAt!==null){const age=t-this.fx.contactAt;
 if(!this.impact.visible){this.impact.position.copy(this.core.position);this.impact.visible=this.id!=='fireSpin';}
 const gain=p.contactSize*(this.id==='waterPulse'?.65:1)*(.3+Math.min(1,age*5)*(1+age*p.spread*.3*motion));this.impact.scale.setScalar(gain);
 if(this.id==='waterPulse'){this.core.visible=age<.12;this.core.scale.x*=Math.max(.1,1-age*8);this.core.scale.y*=1+Math.min(.8,age*8);}
 this.impact.traverse(o=>{if(o.material?.uniforms)o.material.uniforms.opacity.value=Math.max(0,1-age/(this.id==='airSlash'?.65:1.3));});}
 }
}
