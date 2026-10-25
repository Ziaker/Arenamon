import * as T from 'three';

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export function rng(seed = 1) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
export function mesh(parent, geometry, material, position = [0, 0, 0]) {
  const m = new T.Mesh(geometry, material); m.position.set(...position); parent.add(m); return m;
}
export function disposeGroup(group) {
  const geometries = new Set(), materials = new Set();
  group.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) for (const m of [].concat(o.material)) materials.add(m); });
  for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); group.clear();
}

// Angular strata, asymmetric rings and per-face color replace recognizable primitives.
export function strataGeometry({radius = 1, height = 3, sides = 9, seed = 1, taper = .73} = {}) {
  const random = rng(seed), rings = [], positions = [], colors = [];
  const angles = Array.from({length:sides}, (_, i) => i / sides * Math.PI * 2 + (random() - .5) * .13);
  const radii = angles.map(() => .78 + random() * .26);
  for (let j = 0; j < 5; j++) {
    const k = j / 4;
    rings.push(angles.map((a, i) => {
      const r = radius * radii[i] * T.MathUtils.lerp(1, taper, k) * (1 + (random() - .5) * .12);
      return new T.Vector3(Math.cos(a) * r + .17 * k, height * k + (j === 0 ? 0 : (random() - .5) * height * .07), Math.sin(a) * r - .11 * k);
    }));
  }
  function face(a, b, c) {
    const shade = .65 + random() * .35;
    for (const v of [a,b,c]) { positions.push(v.x,v.y,v.z); colors.push(shade,shade * .94,shade * .83); }
  }
  for (let j = 0; j < 4; j++) for (let i = 0; i < sides; i++) {
    const n = (i + 1) % sides, a = rings[j][i], b = rings[j][n], c = rings[j+1][n], d = rings[j+1][i];
    face(a,d,b); face(b,d,c);
  }
  const top = new T.Vector3(.1,height,0);
  for (let i = 0; i < sides; i++) face(top,rings[4][(i+1)%sides],rings[4][i]);
  const g = new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.userData.rings=rings;return g;
}

export function rockTexture() {
  const c = document.createElement('canvas'); c.width=c.height=256;
  const ctx=c.getContext('2d'), image=ctx.createImageData(256,256), random=rng(44);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const strata=Math.sin(y*.19+Math.sin(x*.035)*2)*12+Math.sin(y*.043+x*.006)*20;
    const n=135+strata+(random()-.5)*48, i=(y*256+x)*4;
    image.data[i]=n;image.data[i+1]=n;image.data[i+2]=n;image.data[i+3]=255;
  }
  ctx.putImageData(image,0,0);const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;return tex;
}

export function rockModel(variant, texture) {
  const group=new T.Group(), random=rng(101+variant), accent=[0xd29b51,0xff9d39,0x8bd8bc][variant];
  const material=new T.MeshStandardMaterial({color:[0x817568,0x3f4147,0x677a73][variant],roughness:.91,metalness:variant===1?.25:.07,vertexColors:true,flatShading:true});
  const seam=new T.MeshBasicMaterial({color:new T.Color(accent).multiplyScalar(2.2),transparent:true,opacity:.65,toneMapped:false});
  const pieces=[];
  const addRock=(x,z,h,r,seed,taper,tilt=0)=>{
    const m=mesh(group,strataGeometry({radius:r,height:h,sides:variant===1?5:8,seed,taper}),material,[x,0,z]);
    m.rotation.z=tilt;m.rotation.y=seed*.41;m.castShadow=m.receiveShadow=true;pieces.push(m);return m;
  };
  if(variant===0){
    addRock(-.24,.1,3.25,1.05,33,.85,.035);addRock(.76,-.16,2.75,.66,17,.8,-.08);addRock(-.7,-.65,2.2,.6,6,.7,.13);
    for(let i=0;i<7;i++){const a=i*2.4;addRock(Math.sin(a)*1.17,Math.cos(a)*1.17,.3+random()*.6,.27+random()*.2,i+54,.72,(random()-.5)*.3);}
  }else if(variant===1){
    addRock(0,0,3.8,.87,85,.045,-.16);addRock(.82,.2,2.75,.67,13,.01,-.35);addRock(-.8,-.27,2.5,.56,23,.02,.35);addRock(.1,.77,1.65,.47,31,.03,.35);
    for(let i=0;i<5;i++){const a=i*1.26;addRock(Math.sin(a)*1.1,Math.cos(a)*1.1,.7+random()*.4,.3,i+110,.01,(random()-.5)*.55);}
  }else{
    addRock(-.15,0,2.8,1.05,29,.67,.08);addRock(.9,.1,1.65,.65,61,.8,-.2);addRock(-.8,.6,1.4,.67,51,.85,.22);
    const crown=addRock(-.04,-.04,.55,.76,9,.8);crown.position.y=2.9;crown.rotation.y+=.27;crown.userData.floating=true;
    for(let i=0;i<5;i++){const a=i*1.26;const p=addRock(Math.sin(a)*1.18,Math.cos(a)*1.18,.35,.23,70+i,.65);p.position.y=.45+random()*.5;p.userData.floating=true;}
  }
  // Narrow mineral veins follow the silhouette; never cover the whole model in glow.
  for(let j=0;j<(variant===2?4:2);j++){
    const piece=pieces[j%Math.min(3,pieces.length)],rings=piece.geometry.userData.rings,n=rings[0].length,index=(Math.floor(n*.25)+j*2)%n;
    const points=rings.map((ring,k)=>{const p=ring[index].clone().lerp(ring[(index+1)%n],.25+(k%2)*.16);p.x*=1.018;p.z*=1.018;return p;});
    mesh(piece,new T.TubeGeometry(new T.CatmullRomCurve3(points),18,variant===2?.018:.012,4,false),seam);
  }
  if(texture){
    // Strata geometry uses planar UVs derived from its object coordinates.
    group.traverse(o=>{if(o.isMesh&&o.material===material){const p=o.geometry.attributes.position,uv=[];for(let i=0;i<p.count;i++)uv.push((p.getX(i)+p.getZ(i))*.35,p.getY(i)*.4);o.geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));}});
    material.map=texture;material.bumpMap=texture;material.bumpScale=.13;
  }
  group.userData.pieces=pieces;group.userData.accent=accent;return group;
}

const noiseGLSL=`
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.56+noise(p*2.03)*.28+noise(p*4.09)*.14;}
`;

export function sandSurface(width,height,style=0,offset=0,p={}) {
  const pos=[],uv=[],indices=[],nx=72,ny=26;
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    const u=i/nx,v=j/ny,x=(u-.5)*width,end=Math.pow(Math.max(.02,Math.sin(u*Math.PI)),.32);
    let y,z;
    if(style===0){y=Math.sin(v*Math.PI)*height*.62*end;z=(v-.5)*.78+Math.pow((u-.5)*2,2)*.7;}
    else if(style===1){const angle=v*2.4;y=(Math.sin(angle)*1.15+.04)*height*end;z=(1-Math.cos(angle))*.55;}
    else{y=Math.sin(v*Math.PI*.84)*height*end*(.8+.2*Math.cos(u*9*Math.PI));z=(v-.5)*.85+Math.sin(u*Math.PI)*.38;}
    y*=p.crestCurve??1;z=(z*(p.bladeThickness??1))+(v-.5)*Math.tan((p.frontTilt??0)*Math.PI/180)*.35;
    pos.push(x,y,z+offset);uv.push(u,v);
    if(i<nx&&j<ny){const a=j*(nx+1)+i;indices.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
  const gold=new T.Color(style===1?0xc28b49:0xe5b45d);gold.offsetHSL((p.sandHue??0)/360,0,0);
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0},fade:{value:1},style:{value:style},undulation:{value:p.undulation??1},gold:{value:gold},edgeGlow:{value:p.edgeGlow??1}},
    vertexShader:`varying vec2 vUv;varying float vHeight;uniform float time,undulation;void main(){vUv=uv;vec3 p=position;p.y+=sin(uv.x*37.+uv.y*15.-time*12.)*.045*undulation*sin(uv.y*3.14159);p.z+=sin(uv.x*22.-time*8.+uv.y*12.)*.04*undulation;vHeight=p.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`${noiseGLSL} varying vec2 vUv;varying float vHeight;uniform float time,fade,style,edgeGlow;uniform vec3 gold;void main(){vec2 flow=vec2(vUv.x*9.,vUv.y*5.-time*2.);float n=fbm(flow);float fine=noise(vUv*vec2(370.,90.)+vec2(time*15.,-time*26.));float edge=smoothstep(0.,.055,vUv.x)*smoothstep(0.,.055,1.-vUv.x);float band=sin(vUv.y*3.14159);float alpha=smoothstep(.18,.5,n+band*.26)*edge*band*fade*.92;float streak=pow(max(0.,sin(vUv.y*58.+n*10.-time*14.)),13.);vec3 color=mix(gold*.32,gold*1.35,clamp(vHeight*.8+n*.6,0.,1.));color+=gold*(streak*.5*edgeGlow+fine*.12);gl_FragColor=vec4(color,alpha);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`
  });return new T.Mesh(geo,material);
}

export function shockRing(color,radius=1,thickness=.2) {
  const geo=new T.RingGeometry(radius-thickness,radius,112);
  const mat=new T.MeshBasicMaterial({color,transparent:true,opacity:.7,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
  const m=new T.Mesh(geo,mat);m.rotation.x=-Math.PI/2;m.position.y=.035;return m;
}

export function fractures(seed=3,color=0xe6a453,width=1) {
  const group=new T.Group(),random=rng(seed),dark=new T.MeshBasicMaterial({color:0x080a0a,side:T.DoubleSide,transparent:true,opacity:0}),lit=new T.MeshBasicMaterial({color,transparent:true,opacity:0,side:T.DoubleSide,toneMapped:false});
  for(let i=0;i<11;i++){
    const a=i/11*Math.PI*2,points=[];
    for(let k=0;k<5;k++){const r=.45+k*.45;points.push(new T.Vector3(Math.cos(a)*r+Math.sin(a)*(random()-.5)*.3,.018,Math.sin(a)*r+Math.cos(a)*(random()-.5)*.3));}
    const curve=new T.CatmullRomCurve3(points);mesh(group,new T.TubeGeometry(curve,12,.035*width,3,false),dark);mesh(group,new T.TubeGeometry(curve,12,.012*width,3,false),lit,[0,.016,0]);
  }
  group.userData.glow=lit;group.userData.dark=dark;return group;
}

// One instanced draw for tumbling debris. Fixed trajectories let pause/seek remain stable.
export class Debris {
  constructor(parent,{count=65,seed=9,radius=1.3,force=1,color=0x8e765b}={}) {
    const random=rng(seed);this.data=[];this.dummy=new T.Object3D();
    this.mesh=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshStandardMaterial({color,roughness:.95,flatShading:true}),count);this.mesh.castShadow=true;this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);parent.add(this.mesh);this.mesh.frustumCulled=false;
    for(let i=0;i<count;i++){const a=random()*Math.PI*2,r=radius*(.35+random()*.65),speed=(1+random()*3)*force;this.data.push({x:Math.cos(a)*r,z:Math.sin(a)*r,vx:Math.cos(a)*speed,vz:Math.sin(a)*speed,vy:(2+random()*5)*force,size:.035+random()**2*.18,spin:random()*8,delay:random()*.09});}this.update(-1);
  }
  update(time){
    this.mesh.visible=time>=0;if(time<0)return;
    this.data.forEach((p,i)=>{const t=Math.max(0,time-p.delay),flight=Math.max(.1,2*p.vy/13),f=Math.min(t,flight),y=Math.max(0,p.vy*f-6.5*f*f),settle=clamp(1-(t-flight)*.9);this.dummy.position.set(p.x+p.vx*f,p.size+y,p.z+p.vz*f);this.dummy.rotation.set(p.spin*f,p.spin*.7*f,p.spin*.3*f);this.dummy.scale.set(p.size*settle,p.size*.65*settle,p.size*.84*settle);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);});this.mesh.instanceMatrix.needsUpdate=true;
  }
}
