import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import * as Q from 'three.quarks';
import {presetToSystemParams} from '../../combat-lab/src/view/quarks/adapter.js';

const $ = id => document.getElementById(id);
const canvas = $('scene');
const renderer = new T.WebGLRenderer({canvas, antialias: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
const scene = new T.Scene();scene.background = new T.Color(0x14212b);scene.fog = new T.Fog(0x14212b, 13, 28);
const camera = new T.PerspectiveCamera(48, 1, .1, 80);camera.position.set(6.8, 5.8, 8.2);camera.lookAt(0, .8, 0);
const orbit = new OrbitControls(camera, canvas);orbit.enableDamping = true;orbit.target.set(0, .6, 0);orbit.minDistance = 4;orbit.maxDistance = 20;
scene.add(new T.HemisphereLight(0xe5e4ce, 0x314456, 1.8));
const sun = new T.DirectionalLight(0xffe4b2, 2.3);sun.position.set(-4, 9, 6);scene.add(sun);
const floor = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshStandardMaterial({color:0x293b42,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.05;scene.add(floor);
const grid = new T.GridHelper(16, 16, 0x657679, 0x475b5d);grid.position.y=-.04;scene.add(grid);
const stage = new T.Group();scene.add(stage);
const particleRenderer = new Q.BatchedRenderer();scene.add(particleRenderer);
const particleMaterial = new T.MeshBasicMaterial({color:0xffffff,transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.NormalBlending});
const particles = [];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.88,flatShading:true,...extra});
const add=(parent,geo,material,x=0,y=0,z=0)=>{const m=new T.Mesh(geo,material);m.position.set(x,y,z);parent.add(m);return m;};
const sandColors=[0xd5ac67,0xbe8a50,0xf0c078];
const descriptions={
 sand:[['A · Lâmina rasteira','Onda baixa, veloz e cortante; crista contínua com jatos finos de areia.'],['B · Frente turbulenta','Massa larga e pesada em camadas, com poeira abundante e avanço marcado.'],['C · Cristas fragmentadas','Três frentes dentadas e detritos angulares; leitura estilizada da direção.']],
 stone:[['A · Ruptura pesada','Aviso circular, rachaduras, rocha que sobe com peso e poeira baixa.'],['B · Erupção agressiva','Fenda luminosa, estilhaços altos e emergência explosiva.'],['C · Ascensão telúrica','Anéis concêntricos, fragmentos orbitais e brilho mineral contido.']],
 rock:[['A · Monólito bruto','Bloco facetado de topo largo e base sólida, com silhueta maciça.'],['B · Obelisco fraturado','Lâminas minerais inclinadas com ponta alta e perfil agressivo.'],['C · Aglomerado natural','Volumes rochosos de tamanhos desiguais e contorno irregular.']]
};
const sliderDefs={
 sand:[['length','Alcance visual','m',2,7,.1,4],['width','Largura visual','m',1.5,5,.1,3],['speed','Velocidade','×',.5,2,.05,1],['density','Partículas','×',.25,2,.05,1],['height','Altura da crista','m',.2,1.5,.05,.7]],
 stone:[['rise','Tempo de subida','s',.2,1.2,.05,.4],['scale','Escala da rocha','×',.6,1.5,.05,1],['density','Partículas','×',.25,2,.05,1],['warning','Aviso prévio','s',.2,1.3,.05,.55]],
 rock:[['scale','Escala da rocha','×',.6,1.5,.05,1],['rotation','Rotação','°',0,360,1,25]]
};
const state={category:'sand',variant:0,playing:true,time:0,last:0,values:{sand:{},stone:{},rock:{}}};
for(const [category,defs] of Object.entries(sliderDefs))for(const [key,,,,,,value] of defs)state.values[category][key]=value;

function clearStage(){for(const child of [...stage.children]){stage.remove(child);child.traverse(o=>{o.geometry?.dispose?.();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose?.());}});}for(const p of particles.splice(0)){particleRenderer.deleteSystem(p.system);p.emitter.parent?.remove(p.emitter);p.system.dispose?.();}}
function spriteTexture(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');const g=x.createRadialGradient(32,32,0,32,32,30);g.addColorStop(0,'#fff');g.addColorStop(.45,'#fff');g.addColorStop(1,'#0000');x.fillStyle=g;x.fillRect(0,0,64,64);return new T.CanvasTexture(c);}
particleMaterial.map=spriteTexture();particleMaterial.needsUpdate=true;
function burst(position,{count=24,color=0xd5ac67,life=.65,size=.13,speed=1.8,shape='sphere',radius=.2,up=false}={}){
 const n=Math.max(1,Math.round(count*state.values[state.category].density*( $('reduced').checked?.35:1)));
 const preset={duration:.12,looping:false,worldSpace:true,startLife:[life*.75,life*1.3],startSpeed:[speed*.35,speed],startSize:[size*.55,size*1.4],startColor:{a:color,b:color},opacity:.8,shape:{type:shape,radius},burst:{count:n,time:0},emissionOverTime:0,sizeOverLife:[1,.85,.3,0],gravity:-2.6};
 const params=presetToSystemParams(preset,{Quarks:Q,THREE:T,material:particleMaterial});
 if(up)params.shape=new Q.ConeEmitter({radius,angle:.5,direction:new T.Vector3(0,1,0)});
 const system=new Q.ParticleSystem(params),emitter=system.emitter;emitter.position.copy(position);scene.add(emitter);particleRenderer.addSystem(system);particles.push({system,emitter,age:0,ttl:life*1.4+.35});
}
function line(points,color=0x8a613a,width=1){const geo=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p)));const l=new T.Line(geo,new T.LineBasicMaterial({color,linewidth:width}));stage.add(l);return l;}
function ring(r,color,y=.01,opacity=.6){const m=add(stage,new T.RingGeometry(r-.035,r,72),new T.MeshBasicMaterial({color,transparent:true,opacity,side:T.DoubleSide,depthWrite:false}),0,y,0);m.rotation.x=-Math.PI/2;return m;}
function rockModel(v){const g=new T.Group();const dark=mat([0x74675a,0x655b54,0x6f665b][v]),light=mat([0xa29378,0x9b7c67,0x9c8d70][v]);
 if(v===0){const body=add(g,new T.CylinderGeometry(1.32,1.5,2.75,6,1),dark,0,1.38,0);body.rotation.y=.18;add(g,new T.BoxGeometry(1.7,.3,1.65),light,-.1,2.78,0).rotation.y=.25;for(const [x,z] of [[-1,-.7],[1,.9],[.8,-1]])add(g,new T.DodecahedronGeometry(.43,0),dark,x,.31,z);}
 else if(v===1){for(const [x,z,h,a] of [[0,0,3.35,0],[-.88,.12,2.3,-.28],[.85,-.25,2.55,.26],[.2,.88,1.6,.38]]){const m=add(g,new T.CylinderGeometry(.05,.72,h,5,1),x>0?light:dark,x,h/2,z);m.rotation.z=a;m.rotation.y=x*.4;}for(let i=0;i<7;i++)add(g,new T.TetrahedronGeometry(.18+i%3*.07),light,Math.sin(i*2.4)*1.1,.1,Math.cos(i*2.4)*1.1);}
 else{for(const [x,y,z,r] of [[0,1,0,1.25],[-.8,.8,.4,.9],[.9,.7,-.15,.92],[-.2,2.1,-.2,.88],[.45,1.8,.72,.72],[-1.1,1.55,-.35,.56]]){const m=add(g,new T.DodecahedronGeometry(r,0),y>1.5?light:dark,x,y,z);m.rotation.set(x*.25,z*.18,x*.3);m.scale.set(1,.85,1.1);}}
 return g;
}
let wave=null,rock=null,warning=null,shards=[],emitAt=0;
function makeSand(){const p=state.values.sand,v=state.variant;const w=p.width;line([[-w/2,.02,-2],[w/2,.02,-2],[w/2,.02,-2+p.length],[-w/2,.02,-2+p.length],[-w/2,.02,-2]],0x7b8b86);
 wave=new T.Group();stage.add(wave);
 if(v===0){const m=add(wave,new T.CylinderGeometry(.05,.3,w,3,1),mat(sandColors[v]));m.rotation.z=Math.PI/2;m.position.y=p.height*.65;m.scale.z=.65;for(let i=0;i<8;i++){const x=(i/7-.5)*w;add(wave,new T.ConeGeometry(.13,p.height*.55,3),mat(0xe9c585),x,p.height*.29,.12);}}
 else if(v===1){for(let j=0;j<3;j++){const m=add(wave,new T.CylinderGeometry(.26+j*.07,.42+j*.1,w*(1-j*.14),9,1),mat(j===0?0xa37949:0xc8a16b,{transparent:true,opacity:.88}));m.rotation.z=Math.PI/2;m.position.set(0,p.height*(.5+j*.28),j*.3);}}
 else{for(let i=0;i<9;i++){const x=(i/8-.5)*w,high=p.height*(.65+(i%3)*.22);const m=add(wave,new T.ConeGeometry(.21,high,4),mat(i%2?0xb48248:0xe7bc73),x,high/2,(i%2)*.22);m.rotation.z=(i%2?.28:-.22);}for(let i=0;i<4;i++)line([[(-.5+i/3)*w,.07,-.36],[(-.5+i/3)*w,.2,.3]],0xe4bb77);}
 wave.position.z=-2;const arrow=add(stage,new T.ConeGeometry(.15,.5,3),new T.MeshBasicMaterial({color:0xe8d29f}),0,.1,-2+p.length+.35);arrow.rotation.x=Math.PI/2;
}
function makeStone(){const p=state.values.stone,v=state.variant;warning=ring(v===2?1.45:1.2,[0xd8ae72,0xd88963,0xa7c3a2][v]);
 for(let i=0;i<(v===1?9:6);i++){const a=i*Math.PI*2/(v===1?9:6),r=1.2+(i%2)*.22;line([[Math.cos(a)*.2,.015,Math.sin(a)*.2],[Math.cos(a)*r,.018,Math.sin(a)*r],[Math.cos(a+.16)*(r+.35),.018,Math.sin(a+.16)*(r+.35)]],v===2?0x9aa88e:0x594235);}
 if(v===2){ring(1.75,0x9ab28a,.02,.45);for(let i=0;i<8;i++){const a=i*Math.PI/4;const m=add(stage,new T.OctahedronGeometry(.12),new T.MeshBasicMaterial({color:0xa9c19b}),Math.cos(a)*1.7,.28,Math.sin(a)*1.7);shards.push(m);}}
 if(v===1)for(let i=0;i<8;i++){const a=i*2.4;const m=add(stage,new T.TetrahedronGeometry(.12+i%3*.06),mat(0xb58a64),Math.cos(a)*(.7+i*.12),-.2,Math.sin(a)*(.7+i*.12));shards.push(m);}
 rock=rockModel(v===0?0:v===1?1:2);rock.scale.setScalar(p.scale);stage.add(rock);rock.position.y=-3.6*p.scale;
}
function makeRock(){rock=rockModel(state.variant);rock.scale.setScalar(state.values.rock.scale);rock.rotation.y=state.values.rock.rotation*Math.PI/180;stage.add(rock);ring(1.65,0x9a825f,.01,.4);}
function rebuild(){clearStage();wave=rock=warning=null;shards=[];emitAt=0;state.time=0;state.playing=true;$('pause').textContent='⏸ Pausar';if(state.category==='sand')makeSand();else if(state.category==='stone')makeStone();else makeRock();updateLabels();}
function duration(){if(state.category==='sand')return .25+1.5/state.values.sand.speed;if(state.category==='stone')return state.values.stone.warning+state.values.stone.rise+1.2;return 8;}
function updateVisual(dt){const c=state.category,v=state.variant,t=state.time;
 if(c==='sand'){const p=state.values.sand,prep=.25,travel=.75/p.speed,move=clamp((t-prep)/travel,0,1);wave.position.z=-2+p.length*move;wave.visible=t>=prep;wave.scale.y=t>prep+travel?clamp(1-(t-prep-travel)/(.75/p.speed),0,1):1;
  if(t>=prep&&t<prep+travel&&t-emitAt>.065){emitAt=t;const count=[18,31,20][v];burst(new T.Vector3(0,.16,wave.position.z),{count,color:sandColors[v],life:v===1?.85:.5,size:v===1?.24:.13,speed:v===0?2.5:1.6,shape:'circle',radius:p.width*.37});}
  if(t>=prep+travel&&t-dt<prep+travel)burst(new T.Vector3(0,.2,wave.position.z),{count:80,color:sandColors[v],life:.7,size:.23,speed:2.5,shape:'circle',radius:p.width*.4});
 }else if(c==='stone'){const p=state.values.stone,hit=p.warning,rise=p.rise;warning.material.opacity=t<hit?.4+Math.sin(t*13)*.2:.08;warning.scale.setScalar(1+Math.sin(t*9)*.07);
  const u=clamp((t-hit)/rise,0,1);rock.position.y=-3.6*p.scale*(1-(1-(1-u)**3));rock.visible=t>=hit;rock.rotation.y+=dt*(v===2?.42:.07);
  if(t>=hit&&t-dt<hit)burst(new T.Vector3(0,.16,0),{count:[80,110,65][v],color:[0xb4946a,0xd19a6a,0xb7bd9a][v],life:v===1?.9:.65,size:v===1?.22:.17,speed:v===1?4:2.1,shape:'circle',radius:1.05,up:v===1});
  if(t>=hit&&t<hit+rise&&t-emitAt>.09){emitAt=t;burst(new T.Vector3(0,.2,0),{count:[15,25,13][v],color:v===2?0xb2c5a1:0xb18e65,life:.55,size:.12,speed:1.4,shape:'circle',radius:.9});}
  shards.forEach((s,i)=>{if(v===1){s.position.y=t<hit?-.2:Math.max(-.2,Math.sin((t-hit)*2+i)*.9)*(1-u*.65);s.rotation.y+=dt*1.4;}else{s.position.y=.25+Math.sin(t*2+i)*.18;s.rotation.y+=dt;}});
 }else{rock.rotation.y+=dt*.25;}}
function updateLabels(){const c=state.category,v=state.variant;const [title,desc]=descriptions[c][v];$('proposal-title').textContent=title;$('proposal-desc').textContent=desc;$('badge').textContent=(c==='sand'?'SAND WAVE':c==='stone'?'EMERGING STONE · VFX':'EMERGING STONE · ROCHA')+'  /  '+['A','B','C'][v];
 document.querySelectorAll('#categories button').forEach(b=>b.classList.toggle('active',b.dataset.category===c));document.querySelectorAll('#variants button').forEach(b=>b.classList.toggle('active',Number(b.dataset.variant)===v));
 $('sliders').replaceChildren(...sliderDefs[c].map(([key,label,unit,min,max,step])=>{const wrap=document.createElement('label');wrap.className='field';const row=document.createElement('span'),caption=document.createElement('span'),out=document.createElement('output'),input=document.createElement('input');caption.textContent=label;out.textContent=`${state.values[c][key]} ${unit}`;row.append(caption,out);input.type='range';input.min=min;input.max=max;input.step=step;input.value=state.values[c][key];input.setAttribute('aria-label',`${label} (${unit})`);input.oninput=()=>{state.values[c][key]=Number(input.value);out.textContent=`${input.value} ${unit}`;};input.onchange=rebuild;wrap.append(row,input);return wrap;}));}
document.querySelectorAll('#categories button').forEach(b=>b.onclick=()=>{state.category=b.dataset.category;rebuild();});
document.querySelectorAll('#variants button').forEach(b=>b.onclick=()=>{state.variant=Number(b.dataset.variant);rebuild();});
$('replay').onclick=rebuild;$('pause').onclick=()=>{state.playing=!state.playing;$('pause').textContent=state.playing?'⏸ Pausar':'▶ Continuar';};
document.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement)return;if(['1','2','3'].includes(e.key)){state.variant=Number(e.key)-1;rebuild();}if(e.code==='Space'){e.preventDefault();rebuild();}});
function resize(){const r=canvas.getBoundingClientRect();const w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height));if(canvas.width!==w||canvas.height!==h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}}
function animate(now){requestAnimationFrame(animate);resize();let dt=clamp((now-state.last)/1000,0,.05);state.last=now;if(state.playing){const factor=$('reduced').checked?.55:1;dt*=factor;state.time+=dt;if(state.time>duration()){if($('loop').checked)rebuild();else{state.time=duration();state.playing=false;$('pause').textContent='▶ Continuar';}}updateVisual(dt);particleRenderer.update(dt);for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.age+=dt;if(p.age>p.ttl){particleRenderer.deleteSystem(p.system);p.emitter.parent?.remove(p.emitter);p.system.dispose?.();particles.splice(i,1);}}}
 const t=state.time,d=duration();$('progress').style.width=`${clamp(t/d,0,1)*100}%`;$('time').textContent=`${t.toFixed(1)} s`;$('phase').textContent=state.category==='rock'?'Modelo 3D':state.category==='sand'?(t<.25?'Preparação':t<.25+.75/state.values.sand.speed?'Avanço':'Dissipação'):(t<state.values.stone.warning?'Aviso':t<state.values.stone.warning+state.values.stone.rise?'Emergência':'Assentamento');
 orbit.update();renderer.render(scene,camera);}
window.__labDiagnostics=()=>({category:state.category,variant:state.variant,particleSystems:particles.length,time:state.time,hasQuarks:particleRenderer instanceof Q.BatchedRenderer});
rebuild();requestAnimationFrame(animate);
