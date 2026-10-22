import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {clamp,mesh,disposeGroup,rockTexture,shockRing} from './art.js';
import {Particles} from './particles.js';
import {SandEffect,StoneEffect,RockEffect} from './effects.js';
import {SwiftEffect,PsyshockEffect} from './new-effects.ts';
import {controls as definitions,defaults,categories} from './config.ts';
import {initialPresets,exportSingle,exportAll,parsePreset,migrateLocal} from './presets.ts';

const $=id=>document.getElementById(id);
const descriptions={
 sand:[['Foice do deserto','Uma lâmina de areia em crescente, com borda afiada, rastro de grãos e corte seco no final.','CORTE / VELOCIDADE'],['Muralha de siroco','A frente de areia se enrola em camadas altas. Poeira baixa, volume e detritos dão peso à passagem.','MASSA / TURBULÊNCIA'],['Marcha das dunas','Três cristas dentadas avançam em sequência, como uma barragem que cresce e ocupa o chão.','RITMO / PRESSÃO']],
 stone:[['Falha tectônica','O chão acende pelas fraturas, abre em uma pancada e expulsa uma coroa de pedra e poeira.','PESO / RUPTURA'],['Coroa de obsidiana','Uma erupção vertical lança lascas, partículas quentes e duas ondas de choque rápidas.','EXPLOSÃO / AGRESSIVIDADE'],['Selo de Gaia','Um círculo mineral se forma antes da subida; veios verdes e fragmentos suspensos sustentam a presença da rocha.','RITUAL / PODER']],
 rock:[['Bastião de basalto','Colunas de estratos irregulares, cortes de alturas diferentes e base quebrada.','VOLUME / DEFESA'],['Presa de obsidiana','Lâminas assimétricas, pontas inclinadas e veios quentes entre faces escuras.','SILHUETA / AMEAÇA'],['Relíquia telúrica','Um núcleo mineral antigo com coroa separada, veios frios e fragmentos suspensos.','IDENTIDADE / MISTÉRIO']],
 swift:[['Estrelas clássicas','Três estrelas douradas de recorte nítido, caudas estreitas e impacto breve. Prévia visual do Burst.','SILHUETA / PRECISÃO'],['Chuva de cometas','Três estrelas em profundidades diferentes, caudas alongadas e microfaíscas.','VELOCIDADE / CAMADAS'],['Constelação cinética','Estrelas escalonadas em sequência com órbitas gráficas efêmeras.','RITMO / LEITURA']],
 psyshock:[['Órbita psíquica','Pedras cercadas de anéis finos e orbes magenta.','ÓRBITA / PEDRA'],['Fratura mental','Pedras facetadas com fendas ciano e fragmentos de energia.','TENSÃO / FRATURA'],['Pressão dimensional','Anéis em camadas e pulsos em torno de cada pedra.','PRESSÃO / CAMADAS']]
};
const state={category:'sand',variant:0,model:'match',presets:initialPresets(),time:0,playing:true,rate:.7,exposure:1.1,shake:.35,bloom:.48,reduce:false,loop:true,previewCount:5};
const values=()=>state.presets[state.category]['ABC'[state.variant]];
const canvas=$('scene');let renderer;
try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(error){$('fatal').hidden=false;$('fatal').textContent='Não foi possível iniciar o 3D. Ative a aceleração gráfica do navegador.';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=state.exposure;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
const scene=new T.Scene();scene.background=new T.Color(0x0c141d);scene.fog=new T.FogExp2(0x0c141d,.028);
const camera=new T.PerspectiveCamera(43,1,.1,80);
const orbit=new OrbitControls(camera,canvas);orbit.enableDamping=true;orbit.minDistance=4;orbit.maxDistance=19;orbit.maxPolarAngle=Math.PI*.48;
function frameCamera(kind='three'){
 const rock=state.category==='stone'||state.category==='rock';orbit.target.set(...(rock?[0,1.35,0]:[0,.65,.1]));
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
 const p={...values()};if(state.reduce){p.density=(p.density??1)*.45;p.particleDensity=(p.particleDensity??1)*.45;p.sparks=(p.sparks??1)*.45;p.flash=(p.flash??1)*.45;p.impactIntensity=(p.impactIntensity??1)*.7;}
 effect=state.category==='sand'?new SandEffect(stage,particles,state.variant,p):state.category==='stone'?new StoneEffect(stage,particles,state.variant,p,texture,state.model==='match'?state.variant:Number(state.model)):state.category==='rock'?new RockEffect(stage,state.variant,{...p,wire:$('wire').checked},texture):state.category==='swift'?new SwiftEffect(stage,particles,state.variant,p):new PsyshockEffect(stage,particles,state.variant,p,state.previewCount);
 effect.update(0,0);$('scrub').max=effect.duration.toFixed(2);
}
function replay(){construct();state.playing=true;updatePlay();}
function updatePlay(){$('pause').textContent=state.playing?'Ⅱ Pausar':'▶ Continuar';$('pause').setAttribute('aria-pressed',String(!state.playing));}
function refreshSelection(){
 const c=state.category,v=state.variant,[title,desc,tags]=descriptions[c][v];
 $('proposal-title').textContent=title;$('proposal-desc').textContent=desc;$('tags').textContent=tags;$('hero-title').textContent=title;$('hero-category').textContent=({sand:'SAND WAVE',stone:'EMERGING STONE',rock:'ROCHA',swift:'SWIFT',psyshock:'PSYSHOCK'}[c])+' / PROPOSTA '+['A','B','C'][v];
 document.querySelectorAll('#categories button').forEach(b=>{b.classList.toggle('active',b.dataset.category===c);b.setAttribute('aria-pressed',String(b.dataset.category===c));});
 document.querySelectorAll('#variants button').forEach((b,i)=>{b.classList.toggle('active',i===v);b.setAttribute('aria-pressed',String(i===v));b.querySelector('small').textContent=descriptions[c][i][0];});
 $('model-field').hidden=c!=='stone';$('wire-field').hidden=c!=='rock';$('preview-field').hidden=c!=='psyshock';
 const fields=definitions[c].map(([key,label,unit,min,max,step])=>{
  const wrap=document.createElement('label');wrap.className='field';const row=document.createElement('span'),caption=document.createElement('span'),out=document.createElement('output'),input=document.createElement('input');
  caption.textContent=label;out.textContent=values()[key]+' '+unit;row.append(caption,out);input.type='range';Object.assign(input,{min,max,step,value:values()[key]});input.setAttribute('aria-label',label+' ('+unit+')');
  input.oninput=()=>{values()[key]=Number(input.value);out.textContent=input.value+' '+unit;replay();};wrap.append(row,input);return wrap;
 });
 const base=c==='sand'||c==='stone'?5:c==='rock'?3:5;
 const groups=[...fields.slice(0,base)];for(let i=base;i<fields.length;i+=5){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=['Forma e fluxo','Partículas','Dissipação e cor'][Math.floor((i-base)/5)]||'Mais controles';details.append(summary,...fields.slice(i,i+5));groups.push(details);}$('sliders').replaceChildren(...groups);
}
for(const b of document.querySelectorAll('#categories button'))b.onclick=()=>{state.category=b.dataset.category;refreshSelection();replay();frameCamera();};
for(const b of document.querySelectorAll('#variants button'))b.onclick=()=>{state.variant=Number(b.dataset.variant);refreshSelection();replay();};
$('replay').onclick=replay;$('pause').onclick=()=>{state.playing=!state.playing;updatePlay();};
$('loop').onchange=e=>state.loop=e.target.checked;$('reduced').onchange=e=>{state.reduce=e.target.checked;replay();};
$('model').onchange=e=>{state.model=e.target.value;replay();};$('wire').onchange=replay;$('grid').onchange=e=>grid.visible=e.target.checked;
$('reset').onclick=()=>{state.presets[state.category]['ABC'[state.variant]]={...defaults[state.category]};refreshSelection();replay();};
$('preview-count').onchange=e=>{state.previewCount=Number(e.target.value);replay();};
for(const [id,key] of [['rate','rate'],['bloom','bloom'],['shake','shake'],['exposure','exposure']])$(id).oninput=e=>{state[key]=Number(e.target.value);$(id+'-value').textContent=state[key].toFixed(2)+'×';};
$('camera').onchange=e=>frameCamera(e.target.value);
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('viewport').requestFullscreen();}catch{$('save-status').textContent='Tela cheia indisponível neste navegador.';}};
$('scrub').oninput=e=>{
 const target=Number(e.target.value);construct();state.playing=false;updatePlay();
 while(state.time+fixedStep<target){state.time+=fixedStep;effect.update(state.time,fixedStep);particles.update(fixedStep);}
 const rest=target-state.time;state.time=target;effect.update(target,rest);if(rest>0)particles.update(rest);
};
$('save').onclick=()=>{try{localStorage.setItem('arenamon.sand-stone.v3',JSON.stringify({presets:state.presets,category:state.category,variant:state.variant,model:state.model}));$('save-status').textContent='Configuração salva neste navegador.';}catch{$('save-status').textContent='O navegador não permitiu salvar.';}};
$('load').onclick=()=>{
 try{const data=JSON.parse(localStorage.getItem('arenamon.sand-stone.v3')||localStorage.getItem('arenamon.sand-stone.v2'));if(!data)throw Error();
  state.presets=migrateLocal(data);
  if(descriptions[data.category])state.category=data.category;if(Number.isInteger(data.variant))state.variant=clamp(data.variant,0,2);if(['match','0','1','2'].includes(data.model))state.model=data.model;
  $('model').value=state.model;refreshSelection();replay();frameCamera();$('save-status').textContent='Configuração carregada.';
 }catch{$('save-status').textContent='Nenhuma configuração válida salva.';}
};
function presentation(){return {bloom:state.bloom,exposure:state.exposure,shake:state.shake,rate:state.rate,reduce:state.reduce,loop:state.loop,model:state.model,previewCount:state.previewCount,camera:$('camera').value,wire:$('wire').checked,grid:grid.visible};}
function download(data,name){const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-one').onclick=()=>download(exportSingle(state.presets,state.category,state.variant,presentation()),`arenamon-${state.category}-${'ABC'[state.variant]}.json`);
$('export-all').onclick=()=>download(exportAll(state.presets,presentation()),'arenamon-vfx-todas.json');
$('import').onclick=()=>$('import-file').click();
$('import-file').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>512000)throw Error('Arquivo acima de 500 KB');const parsed=parsePreset(await file.text());const label=parsed.scope==='single'?`${parsed.category} ${parsed.variant}`:'todas as 15 opções';if(!confirm(`Importar ${label}? Os ajustes locais correspondentes serão substituídos.`))return;
 if(parsed.scope==='single'){state.presets[parsed.category][parsed.variant]={...parsed.values};state.category=parsed.category;state.variant='ABC'.indexOf(parsed.variant);}else state.presets=parsed.presets;
 Object.assign(state,parsed.presentation);for(const id of ['rate','bloom','shake','exposure']){$(id).value=state[id];$(id+'-value').textContent=state[id].toFixed(2)+'×';}$('reduced').checked=state.reduce;$('loop').checked=state.loop;$('model').value=state.model;$('preview-count').value=state.previewCount;$('camera').value=parsed.presentation.camera;$('wire').checked=parsed.presentation.wire;$('grid').checked=parsed.presentation.grid;grid.visible=parsed.presentation.grid;refreshSelection();replay();frameCamera(parsed.presentation.camera);$('save-status').textContent=`Importado: ${label}.`;
 }catch(error){$('save-status').textContent='Importação recusada: '+error.message;}};
document.addEventListener('keydown',e=>{if(e.target.matches('input,select,button'))return;if(['1','2','3'].includes(e.key)){state.variant=Number(e.key)-1;refreshSelection();replay();}if(e.code==='Space'){e.preventDefault();state.playing=!state.playing;updatePlay();}if(e.key.toLowerCase()==='r')replay();});
function resize(){const {width,height}=canvas.getBoundingClientRect(),w=Math.max(1,Math.floor(width)),h=Math.max(1,Math.floor(height));if(w===lastWidth&&h===lastHeight)return;lastWidth=w;lastHeight=h;renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
renderer.setAnimationLoop(now=>{
 resize();const elapsed=Math.min(.08,Math.max(0,(now-last)/1000));last=now;
 if(state.playing){accumulator+=elapsed*state.rate*(state.reduce?.65:1);while(accumulator>=fixedStep){accumulator-=fixedStep;state.time+=fixedStep;effect.update(state.time,fixedStep);particles.update(fixedStep);if(state.time>=effect.duration){if(state.loop)construct();else{state.time=effect.duration;state.playing=false;updatePlay();break;}}}}
 orbit.update();renderer.toneMappingExposure=state.exposure;bloomPass.strength=state.bloom;
 const punch=effect.punch??0;blast.intensity=punch*24;blast.position.z=state.category==='sand'?state.presets.sand['ABC'[state.variant]].length/2:0;
 const shift=state.reduce?0:punch*state.shake*.075,save=camera.position.clone();camera.position.x+=Math.sin(state.time*151)*shift;camera.position.y+=Math.cos(state.time*127)*shift;
 composer.render();camera.position.copy(save);
 $('phase').textContent=effect.phase;$('time').textContent=state.time.toFixed(2)+' / '+effect.duration.toFixed(2)+' s';$('scrub').value=state.time;$('quarks-status').textContent=particles.count+' partículas · '+renderer.info.render.calls+' draw calls · three.quarks';
});
window.__labDiagnostics=()=>({category:state.category,variant:state.variant,particleSystems:particles.systems.length,particles:particles.count,time:state.time,hasQuarks:typeof particles.renderer.addSystem==='function',version:3,drawCalls:renderer.info.render.calls});
refreshSelection();construct();frameCamera();
