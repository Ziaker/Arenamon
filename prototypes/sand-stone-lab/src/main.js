import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {clamp,mesh,disposeGroup,rockTexture,shockRing} from './art.js';
import {Particles} from './particles.js';
import {SandEffect,StoneEffect,RockEffect} from './effects.js';

const $=id=>document.getElementById(id);
const descriptions={
 sand:[['Foice do deserto','Uma lâmina de areia em crescente, com borda afiada, rastro de grãos e corte seco no final.','CORTE / VELOCIDADE'],['Muralha de siroco','A frente de areia se enrola em camadas altas. Poeira baixa, volume e detritos dão peso à passagem.','MASSA / TURBULÊNCIA'],['Marcha das dunas','Três cristas dentadas avançam em sequência, como uma barragem que cresce e ocupa o chão.','RITMO / PRESSÃO']],
 stone:[['Falha tectônica','O chão acende pelas fraturas, abre em uma pancada e expulsa uma coroa de pedra e poeira.','PESO / RUPTURA'],['Coroa de obsidiana','Uma erupção vertical lança lascas, partículas quentes e duas ondas de choque rápidas.','EXPLOSÃO / AGRESSIVIDADE'],['Selo de Gaia','Um círculo mineral se forma antes da subida; veios verdes e fragmentos suspensos sustentam a presença da rocha.','RITUAL / PODER']],
 rock:[['Bastião de basalto','Colunas de estratos irregulares, cortes de alturas diferentes e base quebrada.','VOLUME / DEFESA'],['Presa de obsidiana','Lâminas assimétricas, pontas inclinadas e veios quentes entre faces escuras.','SILHUETA / AMEAÇA'],['Relíquia telúrica','Um núcleo mineral antigo com coroa separada, veios frios e fragmentos suspensos.','IDENTIDADE / MISTÉRIO']]
};
const definitions={
 sand:[['length','Alcance','m',2,7,.1,4],['width','Largura','m',1.5,5,.1,3.4],['height','Altura da onda','m',.5,2.5,.05,1.25],['density','Grãos e detritos','×',.25,2,.05,1],['smoke','Densidade da poeira','×',0,1.5,.05,.8]],
 stone:[['warning','Antecipação','s',.2,1.5,.05,.7],['rise','Tempo de subida','s',.2,1.2,.05,.4],['scale','Escala da rocha','×',.6,1.5,.05,1],['density','Grãos e estilhaços','×',.25,2,.05,1],['smoke','Densidade da poeira','×',0,1.5,.05,.8]],
 rock:[['scale','Escala da rocha','×',.6,1.5,.05,1],['rotation','Ângulo inicial','°',0,360,1,25],['turn','Giro de inspeção','°/s',0,30,1,10]]
};
const defaults=Object.fromEntries(Object.entries(definitions).map(([c,defs])=>[c,Object.fromEntries(defs.map(d=>[d[0],d[6]]))]));
const state={category:'sand',variant:0,model:'match',values:structuredClone(defaults),time:0,playing:true,rate:.7,exposure:1.1,shake:.35,bloom:.48,reduce:false,loop:true};
const canvas=$('scene');let renderer;
try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(error){$('fatal').hidden=false;$('fatal').textContent='Não foi possível iniciar o 3D. Ative a aceleração gráfica do navegador.';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=state.exposure;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
const scene=new T.Scene();scene.background=new T.Color(0x0c141d);scene.fog=new T.FogExp2(0x0c141d,.028);
const camera=new T.PerspectiveCamera(43,1,.1,80);
const orbit=new OrbitControls(camera,canvas);orbit.enableDamping=true;orbit.minDistance=4;orbit.maxDistance=19;orbit.maxPolarAngle=Math.PI*.48;
function frameCamera(kind='three'){
 const rock=state.category!=='sand';orbit.target.set(...(rock?[0,1.35,0]:[0,.65,.1]));
 camera.position.set(...(kind==='top'?[.01,11,.01]:kind==='low'?[6,2.8,7]:rock?[6.5,4.5,7]:[6.4,4.4,7.8]));camera.lookAt(orbit.target);orbit.update();
}
scene.add(new T.HemisphereLight(0xb6d0eb,0x30251d,.65));
const key=new T.DirectionalLight(0xffdda8,3.1);key.position.set(-4,9,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:1,far:30});key.shadow.normalBias=.035;scene.add(key);
const rim=new T.DirectionalLight(0x8bb4d5,2.2);rim.position.set(4,6,-5);scene.add(rim);
const blast=new T.PointLight(0xffbb60,0,12,2);blast.position.set(0,1.3,0);scene.add(blast);
const texture=rockTexture();
const floor=mesh(scene,new T.CylinderGeometry(7.5,7.6,.28,96),new T.MeshStandardMaterial({color:0x33383a,roughness:.96,map:texture,bumpMap:texture,bumpScale:.08}),[0,-.17,0]);floor.receiveShadow=true;
const ground=mesh(scene,new T.PlaneGeometry(140,140),new T.MeshStandardMaterial({color:0x101820,roughness:1}),[0,-.32,0]);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;
for(const radius of [6.55,6.64,7.15]){const ring=shockRing(0x65716e,radius,.014);ring.material.blending=T.NormalBlending;ring.material.opacity=.35;ring.position.y=-.024;scene.add(ring);}
for(let i=0;i<48;i++){const a=i/48*Math.PI*2;const tick=mesh(scene,new T.PlaneGeometry(.035,i%4===0?.24:.1),new T.MeshBasicMaterial({color:0x8c8b78,transparent:true,opacity:.35}),[Math.cos(a)*6.85,-.022,Math.sin(a)*6.85]);tick.rotation.set(-Math.PI/2,0,-a);}
const grid=new T.GridHelper(12,12,0x3e565c,0x293c44);grid.position.y=.002;grid.visible=false;scene.add(grid);
const stage=new T.Group();scene.add(stage);const particles=new Particles(scene);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
const bloomPass=new UnrealBloomPass(new T.Vector2(1,1),state.bloom,.4,1.05);composer.addPass(bloomPass);composer.addPass(new OutputPass());
let effect=null,last=0,accumulator=0,lastWidth=0,lastHeight=0;
const fixedStep=1/60;
function construct(){
 particles.clear();disposeGroup(stage);state.time=0;accumulator=0;
 const p={...state.values[state.category]};if(state.reduce)p.density=(p.density??1)*.45;
 effect=state.category==='sand'?new SandEffect(stage,particles,state.variant,p):state.category==='stone'?new StoneEffect(stage,particles,state.variant,p,texture,state.model==='match'?state.variant:Number(state.model)):new RockEffect(stage,state.variant,{...p,wire:$('wire').checked},texture);
 effect.update(0,0);$('scrub').max=effect.duration.toFixed(2);
}
function replay(){construct();state.playing=true;updatePlay();}
function updatePlay(){$('pause').textContent=state.playing?'Ⅱ Pausar':'▶ Continuar';$('pause').setAttribute('aria-pressed',String(!state.playing));}
function refreshSelection(){
 const c=state.category,v=state.variant,[title,desc,tags]=descriptions[c][v];
 $('proposal-title').textContent=title;$('proposal-desc').textContent=desc;$('tags').textContent=tags;$('hero-title').textContent=title;$('hero-category').textContent=(c==='sand'?'SAND WAVE':c==='stone'?'EMERGING STONE':'ROCHA')+' / PROPOSTA '+['A','B','C'][v];
 document.querySelectorAll('#categories button').forEach(b=>{b.classList.toggle('active',b.dataset.category===c);b.setAttribute('aria-pressed',String(b.dataset.category===c));});
 document.querySelectorAll('#variants button').forEach((b,i)=>{b.classList.toggle('active',i===v);b.setAttribute('aria-pressed',String(i===v));b.querySelector('small').textContent=descriptions[c][i][0];});
 $('model-field').hidden=c!=='stone';$('wire-field').hidden=c!=='rock';
 $('sliders').replaceChildren(...definitions[c].map(([key,label,unit,min,max,step])=>{
  const wrap=document.createElement('label');wrap.className='field';const row=document.createElement('span'),caption=document.createElement('span'),out=document.createElement('output'),input=document.createElement('input');
  caption.textContent=label;out.textContent=state.values[c][key]+' '+unit;row.append(caption,out);input.type='range';Object.assign(input,{min,max,step,value:state.values[c][key]});input.setAttribute('aria-label',label+' ('+unit+')');
  input.oninput=()=>{state.values[c][key]=Number(input.value);out.textContent=input.value+' '+unit;};input.onchange=replay;wrap.append(row,input);return wrap;
 }));
}
for(const b of document.querySelectorAll('#categories button'))b.onclick=()=>{state.category=b.dataset.category;refreshSelection();replay();frameCamera();};
for(const b of document.querySelectorAll('#variants button'))b.onclick=()=>{state.variant=Number(b.dataset.variant);refreshSelection();replay();};
$('replay').onclick=replay;$('pause').onclick=()=>{state.playing=!state.playing;updatePlay();};
$('loop').onchange=e=>state.loop=e.target.checked;$('reduced').onchange=e=>{state.reduce=e.target.checked;replay();};
$('model').onchange=e=>{state.model=e.target.value;replay();};$('wire').onchange=replay;$('grid').onchange=e=>grid.visible=e.target.checked;
$('reset').onclick=()=>{state.values[state.category]=structuredClone(defaults[state.category]);refreshSelection();replay();};
for(const [id,key] of [['rate','rate'],['bloom','bloom'],['shake','shake'],['exposure','exposure']])$(id).oninput=e=>{state[key]=Number(e.target.value);$(id+'-value').textContent=state[key].toFixed(2)+'×';};
$('camera').onchange=e=>frameCamera(e.target.value);
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('viewport').requestFullscreen();}catch{$('save-status').textContent='Tela cheia indisponível neste navegador.';}};
$('scrub').oninput=e=>{
 const target=Number(e.target.value);construct();state.playing=false;updatePlay();
 while(state.time+fixedStep<target){state.time+=fixedStep;effect.update(state.time,fixedStep);particles.update(fixedStep);}
 const rest=target-state.time;state.time=target;effect.update(target,rest);if(rest>0)particles.update(rest);
};
$('save').onclick=()=>{try{localStorage.setItem('arenamon.sand-stone.v2',JSON.stringify({values:state.values,category:state.category,variant:state.variant,model:state.model}));$('save-status').textContent='Configuração salva neste navegador.';}catch{$('save-status').textContent='O navegador não permitiu salvar.';}};
$('load').onclick=()=>{
 try{const data=JSON.parse(localStorage.getItem('arenamon.sand-stone.v2'));if(!data)throw Error();
  for(const [c,defs] of Object.entries(definitions))for(const [k,,,min,max] of defs){const v=Number(data.values?.[c]?.[k]);if(Number.isFinite(v))state.values[c][k]=clamp(v,min,max);}
  if(descriptions[data.category])state.category=data.category;if(Number.isInteger(data.variant))state.variant=clamp(data.variant,0,2);if(['match','0','1','2'].includes(data.model))state.model=data.model;
  $('model').value=state.model;refreshSelection();replay();frameCamera();$('save-status').textContent='Configuração carregada.';
 }catch{$('save-status').textContent='Nenhuma configuração válida salva.';}
};
document.addEventListener('keydown',e=>{if(e.target.matches('input,select,button'))return;if(['1','2','3'].includes(e.key)){state.variant=Number(e.key)-1;refreshSelection();replay();}if(e.code==='Space'){e.preventDefault();state.playing=!state.playing;updatePlay();}if(e.key.toLowerCase()==='r')replay();});
function resize(){const {width,height}=canvas.getBoundingClientRect(),w=Math.max(1,Math.floor(width)),h=Math.max(1,Math.floor(height));if(w===lastWidth&&h===lastHeight)return;lastWidth=w;lastHeight=h;renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
renderer.setAnimationLoop(now=>{
 resize();const elapsed=Math.min(.08,Math.max(0,(now-last)/1000));last=now;
 if(state.playing){accumulator+=elapsed*state.rate*(state.reduce?.65:1);while(accumulator>=fixedStep){accumulator-=fixedStep;state.time+=fixedStep;effect.update(state.time,fixedStep);particles.update(fixedStep);if(state.time>=effect.duration){if(state.loop)construct();else{state.time=effect.duration;state.playing=false;updatePlay();break;}}}}
 orbit.update();renderer.toneMappingExposure=state.exposure;bloomPass.strength=state.bloom;
 const punch=effect.punch??0;blast.intensity=punch*24;blast.position.z=state.category==='sand'?state.values.sand.length/2:0;
 const shift=state.reduce?0:punch*state.shake*.075,save=camera.position.clone();camera.position.x+=Math.sin(state.time*151)*shift;camera.position.y+=Math.cos(state.time*127)*shift;
 composer.render();camera.position.copy(save);
 $('phase').textContent=effect.phase;$('time').textContent=state.time.toFixed(2)+' / '+effect.duration.toFixed(2)+' s';$('scrub').value=state.time;$('quarks-status').textContent=particles.count+' partículas · three.quarks';
});
window.__labDiagnostics=()=>({category:state.category,variant:state.variant,particleSystems:particles.systems.length,particles:particles.count,time:state.time,hasQuarks:true,version:2,drawCalls:renderer.info.render.calls});
refreshSelection();construct();frameCamera();
