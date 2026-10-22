import * as T from 'three';

export const saturate=(x:number)=>Math.min(1,Math.max(0,x));
export const smooth=(x:number)=>{const u=saturate(x);return u*u*(3-2*u);};
export const hue=(h:number,l=.55)=>new T.Color().setHSL(h/360,.9,l);
export const TAU=Math.PI*2;
export function luminous(color:T.Color,opacity=1):T.MeshBasicMaterial {
  const material=new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false});
  material.userData.baseOpacity=opacity;return material;
}
export function addMesh(parent:T.Object3D,geometry:T.BufferGeometry,material:T.Material){const m=new T.Mesh(geometry,material);parent.add(m);return m;}
export function fadeTree(group:T.Object3D,fade:number){group.traverse(o=>{
  const material=(o as T.Mesh).material;
  for(const m of material?(Array.isArray(material)?material:[material]):[]){
    if(m instanceof T.ShaderMaterial&&m.uniforms.opacity)m.uniforms.opacity.value=(m.userData.baseOpacity??1)*fade;
    else if(m.transparent){m.userData.baseOpacity??=m.opacity;m.opacity=m.userData.baseOpacity*fade;}
  }
});}
export function starShape(ratio=1){const shape=new T.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,r=i%2?.39/ratio:1;const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);}shape.closePath();return shape;}
export function linePath(parent:T.Object3D,points:T.Vector3[],color:T.Color,opacity=.7,closed=false){
  const mat=new T.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});mat.userData.baseOpacity=opacity;
  const line=closed?new T.LineLoop(new T.BufferGeometry().setFromPoints(points),mat):new T.Line(new T.BufferGeometry().setFromPoints(points),mat);parent.add(line);return line;
}
export function polygon(parent:T.Object3D,radius:number,sides:number,color:T.Color,opacity=.7){return linePath(parent,Array.from({length:sides},(_,i)=>new T.Vector3(Math.cos(i/sides*TAU)*radius,Math.sin(i/sides*TAU)*radius,0)),color,opacity,true);}
export function arc(parent:T.Object3D,radius:number,width:number,color:T.Color,opacity=.7,length=TAU){return addMesh(parent,new T.TorusGeometry(radius,width,5,96,length),luminous(color,opacity));}

/** Soft procedural radiance: transparent at its rim, with no opaque billboard disc. */
export function halo(parent:T.Object3D,radius:number,color:T.Color,opacity:number,ring=0){
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,
    uniforms:{color:{value:color},opacity:{value:opacity},ring:{value:ring}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 vUv;uniform vec3 color;uniform float opacity,ring;void main(){float r=length(vUv-.5)*2.;float soft=pow(max(0.,1.-r),3.);float band=exp(-pow((r-.62)*26.,2.));float alpha=mix(soft,band,ring)*opacity;gl_FragColor=vec4(color*1.5,alpha);\n#include <colorspace_fragment>\n}'});
  material.userData.baseOpacity=opacity;return addMesh(parent,new T.PlaneGeometry(radius*2,radius*2),material);
}
export function lens(parent:T.Object3D,radius:number,color:T.Color,opacity:number){
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.FrontSide,blending:T.AdditiveBlending,toneMapped:false,
    uniforms:{color:{value:color},opacity:{value:opacity},time:{value:0}},
    vertexShader:'varying vec3 n;varying vec3 v;varying vec3 p;void main(){p=position;vec4 q=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-q.xyz);gl_Position=projectionMatrix*q;}',
    fragmentShader:'varying vec3 n;varying vec3 v;varying vec3 p;uniform vec3 color;uniform float opacity,time;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),3.);float bands=pow(.5+.5*sin(p.y*35.-time*5.),18.);gl_FragColor=vec4(color*1.4,(rim*.65+bands*.12)*opacity);\n#include <colorspace_fragment>\n}'});
  material.userData.baseOpacity=opacity;return addMesh(parent,new T.SphereGeometry(radius,32,20),material);
}

/** A real tapered strip follows sampled motion, so scrub/replay rebuild the same silhouette. */
export class Ribbon {
  mesh:T.Mesh<T.BufferGeometry,T.ShaderMaterial>;segments=40;
  private axis:T.Vector3;
  private center=new T.Vector3();private previous=new T.Vector3();private tangent=new T.Vector3();private side=new T.Vector3();
  constructor(parent:T.Object3D,color:T.Color,opacity:number,axis=new T.Vector3(0,1,0)){
    this.axis=axis;
    const pos=new Float32Array((this.segments+1)*6),uv=new Float32Array((this.segments+1)*4),index:number[]=[];
    for(let i=0;i<=this.segments;i++){uv.set([i/this.segments,0,i/this.segments,1],i*4);if(i<this.segments){const k=i*2;index.push(k,k+1,k+2,k+1,k+3,k+2);}}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.setIndex(index);
    const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,
      uniforms:{color:{value:color},opacity:{value:opacity},time:{value:0}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 vUv;uniform vec3 color;uniform float opacity,time;void main(){float edge=pow(max(0.,1.-abs(vUv.y*2.-1.)),1.3);float tail=pow(1.-vUv.x,.55);float filament=pow(max(0.,1.-abs(vUv.y*2.-1.)),12.);float flow=.8+.2*sin(vUv.x*35.+time*12.);gl_FragColor=vec4(mix(color,color*.4+vec3(.6),filament),edge*tail*flow*opacity);\n#include <colorspace_fragment>\n}'});
    material.userData.baseOpacity=opacity;this.mesh=new T.Mesh(geometry,material);this.mesh.frustumCulled=false;parent.add(this.mesh);
  }
  update(sample:(time:number,out:T.Vector3)=>void,time:number,lag:number,width:number,opacity:number){
    const a=this.mesh.geometry.attributes.position as T.BufferAttribute;
    for(let i=0;i<=this.segments;i++){
      const u=i/this.segments,t=time-lag*u;sample(t,this.center);sample(t-.006,this.previous);
      this.tangent.subVectors(this.center,this.previous).normalize();this.side.crossVectors(this.tangent,this.axis).normalize();if(this.side.lengthSq()<.01)this.side.set(1,0,0);
      const w=width*Math.pow(1-u,.65);a.setXYZ(i*2,this.center.x+this.side.x*w,this.center.y+this.side.y*w,this.center.z+this.side.z*w);a.setXYZ(i*2+1,this.center.x-this.side.x*w,this.center.y-this.side.y*w,this.center.z-this.side.z*w);
    }
    a.needsUpdate=true;this.mesh.material.uniforms.time.value=time;this.mesh.material.uniforms.opacity.value=opacity;
  }
}

/** Low-cost deterministic shards provide a readable silhouette even with particle density at zero. */
export class Shards {
  mesh:T.InstancedMesh;private dummy=new T.Object3D();
  readonly count:number;private seed:number;
  constructor(parent:T.Object3D,count:number,color:T.Color,seed=0){
    this.count=count;this.seed=seed;
    const geometry=new T.OctahedronGeometry(1,0);this.mesh=new T.InstancedMesh(geometry,luminous(color,.7),count);this.mesh.frustumCulled=false;parent.add(this.mesh);
  }
  update(time:number,mode:'orbit'|'burst',radius:number,size:number,fade=1){
    for(let i=0;i<this.count;i++){
      const a=i*2.39996+this.seed,b=Math.sin(i*7.17),r=mode==='orbit'?radius*(.65+(i%7)*.055):radius*(.3+time*(1+(i%5)*.34));
      this.dummy.position.set(Math.cos(a+time)*r,b*r*.65,Math.sin(a+time)*r);
      this.dummy.rotation.set(a+time*2,b+time,a*.7);const s=size*(.5+(i%5)*.18)*fade;
      this.dummy.scale.set(s*.32,s*(mode==='burst'?2.5:1.3),s*.32);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate=true;
  }
}

export function stageMarkers(parent:T.Object3D){
  const caster=new T.Group();parent.add(caster);caster.position.set(0,0,-3.1);
  const body=addMesh(caster,new T.CapsuleGeometry(.23,.65,5,10),new T.MeshStandardMaterial({color:0x536774,roughness:.8}));body.position.y=.6;body.castShadow=true;
  const target=new T.Group();target.position.set(0,0,3.05);parent.add(target);
  const body2=addMesh(target,new T.CapsuleGeometry(.22,.65,5,10),new T.MeshStandardMaterial({color:0x554d62,roughness:.8,transparent:true,opacity:.55}));body2.position.y=.6;
  for(const group of [caster,target]){const ring=arc(group,.42,.012,new T.Color(0x6c8798),.35);ring.rotation.x=-Math.PI/2;ring.position.y=.035;}
}
