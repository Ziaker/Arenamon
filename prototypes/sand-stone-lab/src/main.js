import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {clamp,mesh,disposeGroup,rockTexture,shockRing} from './art.js';
import {Particles} from './particles.js';
import {SandEffect,StoneEffect,RockEffect} from './effects.js';
import {RiposteEffect} from './riposte-effect.ts';
import {RushEffect} from './rush-effects.ts';
import {SwiftEffect,PsyshockEffect} from './new-effects.ts';
import {controls as definitions,defaults,categories,help,phaseNames} from './config.ts';
import {PhaseClock} from './phases.ts';
import {buildPanel,shotKeyVisible,selectorLabels,notApplicable} from './panel-model.ts';
import {initialPresets,exportSingle,exportAll,parsePreset,migrateLocal,exportFileName,serializeLocal,restoreLocal} from './presets.ts';

const $=id=>document.getElementById(id);
const descriptions={
 riposte:[['Égide de aço','Seis placas se fecham na abertura da guarda; a interceptação converte o escudo em uma estocada radial. Janela: 0–0,59 s.','PLACAS / INTERCEPTAÇÃO / ESTOCADA'],['Guarda cruzada','Duas lâminas formam a guarda em X. Um acerto válido solta dois cortes cruzados que acompanham o contra-ataque.','X / DESVIO / CORTES'],['Mola de retorno','Três crescentes armam a guarda; a interceptação libera uma hélice de energia rumo ao atacante.','CRESCENTES / TENSÃO / RETORNO']],
 bulletpunch:[['Pistão de aço','Um punho metálico recua, dispara com rastros axiais e abre uma coroa de faíscas no contato.','METAL / PISTÃO / PERFURAÇÃO'],['Broca helicoidal','O punho gira entre três hélices de energia. A perfuração termina em arcos de pressão e lascas.','HÉLICES / GIRO / PRESSÃO'],['Rajada de punhos','Ecos de punhos atacam em posições alternadas e convergem numa explosão angular de metal.','RAJADA / ECOS / ESTILHAÇOS']],
 quickattack:[['Arrancada supersônica','O corpo se alonga na arrancada, deixa pós-imagens e linhas paralelas, e freia num choque de ar.','ARRANCADA / RASTROS / FREIO'],['Passo em zigue-zague','O corpo muda de direção num caminho serrilhado; fitas desenham o percurso até o corte final.','CURVAS / FITAS / CORTE'],['Salto de imagem','O corpo aparece em passos descontínuos, deixando silhuetas separadas. O contato se abre em raios finos.','PASSOS / PÓS-IMAGENS / ESTALO']],
 sand:[['Foice do deserto','Uma lâmina de areia em crescente, com borda afiada, rastro de grãos e corte seco no final.','CORTE / VELOCIDADE'],['Muralha de siroco','A frente de areia se enrola em camadas altas. Poeira baixa, volume e detritos dão peso à passagem.','MASSA / TURBULÊNCIA'],['Marcha das dunas','Três cristas dentadas avançam em sequência, como uma barragem que cresce e ocupa o chão.','RITMO / PRESSÃO']],
 stone:[['Falha tectônica','O chão acende pelas fraturas, abre em uma pancada e expulsa uma coroa de pedra e poeira.','PESO / RUPTURA'],['Coroa de obsidiana','Uma erupção vertical lança lascas, partículas quentes e duas ondas de choque rápidas.','EXPLOSÃO / AGRESSIVIDADE'],['Selo de Gaia','Um círculo mineral se forma antes da subida; veios verdes e fragmentos suspensos sustentam a presença da rocha.','RITUAL / PODER']],
 rock:[['Bastião de basalto','Colunas de estratos irregulares, cortes de alturas diferentes e base quebrada.','VOLUME / DEFESA'],['Presa de obsidiana','Lâminas assimétricas, pontas inclinadas e veios quentes entre faces escuras.','SILHUETA / AMEAÇA'],['Relíquia telúrica','Um núcleo mineral antigo com coroa separada, veios frios e fragmentos suspensos.','IDENTIDADE / MISTÉRIO']],
 swift:[['Lâminas solares','Estrelas de ouro com volume, fitas de luz e uma coroa cortante que se abre no impacto.','OURO / CORTE / COROA'],['Tempestade de cometas','Três núcleos estelares puxam caudas helicoidais, dispersam brasas e explodem em uma chuva de fragmentos.','HÉLICES / MASSA / EXPLOSÃO'],['Atlas estelar','Estrelas vazadas, órbitas e satélites compõem um mapa vivo. A constelação se rompe em um selo geométrico.','MAPA / GEOMETRIA / SELO']],
 psyshock:[['Ressonância PSI','Losangos comprimem cada pedra, deixam ecos no trajeto e se expandem no impacto. Animação PSI integrada aos projéteis.','LOSANGOS / COMPRESSÃO / ECOS'],['Ruptura PSI','Descargas serrilhadas se acumulam junto às pedras, riscam o trajeto e se abrem em cortes radiais no impacto.','DESCARGAS / CORTES / RUPTURA'],['Floração PSI','Hexágonos crescem e se alternam ao redor de cada pedra, deixam ecos e se abrem em pétalas cromáticas no impacto.','HEXÁGONOS / ECOS / PÉTALAS']]
};
const state={category:'sand',variant:0,model:'match',presets:initialPresets(),time:0,playing:true,rate:.7,exposure:1.1,shake:.35,bloom:.48,reduce:matchMedia('(prefers-reduced-motion: reduce)').matches,noFlash:false,loop:true,previewCount:5};
const values=()=>state.presets[state.category]['ABC'[state.variant]];
const canvas=$('scene');let renderer;
try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(error){$('fatal').hidden=false;$('fatal').textContent='Não foi possível iniciar o 3D. Ative a aceleração gráfica do navegador.';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=state.exposure;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
renderer.info.autoReset=false;
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
let clock=null;const fxDur=()=>clock?clock.duration:effect.duration,fxTime=t=>clock?clock.map(t):t;
let effect=null,last=0,accumulator=0,lastWidth=0,lastHeight=0;
const fixedStep=1/60;
function construct(){
 particles.clear();disposeGroup(stage);delete stage.userData.visualSignature;state.time=0;accumulator=0;
 const p={...values()};if(state.reduce){p.density=(p.density??1)*.45;p.particleDensity=(p.particleDensity??1)*.45;p.sparks=(p.sparks??1)*.45;p.flash=(p.flash??1)*.45;p.impactIntensity=(p.impactIntensity??1)*.7;p.emissivity=(p.emissivity??1)*.45;p.shards=(p.shards??1)*.45;}
 if(state.noFlash){for(const k of ['flash','halo','shotRecoilFlash'])if(k in p)p[k]=0;for(const k of ['coreGlow','edgeGlow','veinGlow','emissivity','glow'])if(k in p)p[k]*=.4;if('pulseRate' in p)p.pulseRate=0;}
 if(state.reduce){for(const k of ['turn','angularSpeed','twist','spiral','undulation'])if(k in p)p[k]*=.3;}
 effect=state.category==='riposte'?new RiposteEffect(stage,particles,state.variant,p):['bulletpunch','quickattack'].includes(state.category)?new RushEffect(stage,particles,state.category,state.variant,p):state.category==='sand'?new SandEffect(stage,particles,state.variant,p):state.category==='stone'?new StoneEffect(stage,particles,state.variant,p,texture,state.model==='match'?state.variant:Number(state.model)):state.category==='rock'?new RockEffect(stage,state.variant,{...p,wire:$('wire').checked},texture):state.category==='swift'?new SwiftEffect(stage,particles,state.variant,p):new PsyshockEffect(stage,particles,state.variant,p,state.previewCount);
 clock=effect.timeline?new PhaseClock(effect.timeline(),p):null;
 effect.update(fxTime(0),0);$('scrub').max=fxDur().toFixed(2);showPhaseNote();
}
function showPhaseNote(){const n=$('phase-warning');n.hidden=false;if(clock&&clock.nothingToShow)n.textContent='Nenhuma fase visual ligada: não há nada para mostrar. Ligue ao menos uma fase.';else if(!clock)n.textContent='Esta proposta ainda não obedece aos interruptores das fases.';else n.hidden=true;}
function replay(){scheduleSave();construct();state.playing=true;updatePlay();}
function updatePlay(){$('pause').textContent=state.playing?'Ⅱ Pausar':'▶ Continuar';$('pause').setAttribute('aria-pressed',String(!state.playing));}
function buildGroups(c){
 const shotFields=[],kindOf=()=>Math.round(values().shotKind??0);
 const fmt=(v,unit)=>String(v)+(unit?' '+unit:'');
 const sync=()=>{for(const {key,el} of shotFields)el.hidden=!shotKeyVisible(key,kindOf());};
 const field=([key,label,unit,min,max,step,initial])=>{
  const v=values();if(v[key]===undefined)v[key]=initial;
  const wrap=document.createElement('div');wrap.className='field phase-field';wrap.dataset.key=key;
  const note=document.createElement('small');note.className='help';note.textContent=help[key]??'';
  if(selectorLabels[key]){
   wrap.classList.replace('field','select-field');const caption=document.createElement('span');caption.textContent=label;
   const select=document.createElement('select');select.setAttribute('aria-label',label);if(key==='scenario')select.id='riposte-scenario';
   selectorLabels[key].forEach((name,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=name;select.append(o);});select.value=String(v[key]);
   select.onchange=()=>{v[key]=Number(select.value);if(key==='shotKind')sync();replay();};wrap.append(caption,select,note);
  }else{
   const row=document.createElement('span'),caption=document.createElement('span'),out=document.createElement('output'),range=document.createElement('input'),num=document.createElement('input');
   caption.textContent=label+(unit?' ('+unit+')':'');out.textContent=fmt(v[key],unit);row.append(caption,out);
   Object.assign(range,{type:'range',min,max,step,value:v[key]});range.setAttribute('aria-label',label+(unit?' ('+unit+')':''));
   Object.assign(num,{type:'number',min,max,step,value:v[key]});num.className='num';num.setAttribute('aria-label',label+' — valor numérico');
   const set=x=>{const n=clamp(Number(x),min,max);if(!Number.isFinite(n))return;v[key]=n;range.value=String(n);num.value=String(n);out.textContent=fmt(n,unit);replay();};
   range.oninput=()=>set(range.value);num.onchange=()=>set(num.value);wrap.append(row,range,num,note);
  }
  if(key.startsWith('shot')&&key!=='shotKind')shotFields.push({key,el:wrap});
  return wrap;
 };
 const groups=buildPanel(definitions[c],c,state.variant).map(g=>{
  const box=document.createElement('details');box.className='phase-group';box.dataset.phase=g.phase;box.open=g.phase==='start'||g.phase==='body';
  const summary=document.createElement('summary');summary.textContent=g.title;box.append(summary);
  const on=values()[g.phase+'On']!==0;
  const body=document.createElement('div');body.className='phase-body';
  const tog=document.createElement('label');tog.className='check phase-toggle';const cb=document.createElement('input');cb.type='checkbox';cb.id='phase-'+g.phase+'-on';cb.checked=on;cb.dataset.phaseToggle=g.phase;
  tog.append(cb,document.createTextNode(' Ligar esta fase'));
  const na=notApplicable[c]?.phases.includes(g.phase)?notApplicable[c].reason:'';
  if(na){cb.disabled=true;tog.title=na;const why=document.createElement('small');why.className='help';why.textContent=na;tog.append(why);box.classList.add('na');}
  cb.onchange=()=>{values()[g.phase+'On']=cb.checked?1:0;box.classList.toggle('off',!cb.checked);replay();};
  box.classList.toggle('off',!on);
  body.append(tog,...g.controls.map(field));box.append(body);return box;
 });
 sync();return groups;
}

function refreshSelection(){
 const c=state.category,v=state.variant,[title,desc,tags]=descriptions[c][v];
 $('proposal-title').textContent=title;$('proposal-desc').textContent=desc;$('tags').textContent=tags;$('hero-title').textContent=title;$('hero-category').textContent=({sand:'SAND WAVE',stone:'EMERGING STONE',rock:'ROCHA',swift:'SWIFT',psyshock:'PSYSHOCK',bulletpunch:'BULLET PUNCH',quickattack:'QUICK ATTACK',riposte:'RIPOSTE'}[c])+' / PROPOSTA '+['A','B','C'][v];
 document.querySelectorAll('#categories button').forEach(b=>{b.classList.toggle('active',b.dataset.category===c);b.setAttribute('aria-pressed',String(b.dataset.category===c));});
 document.querySelectorAll('#variants button').forEach((b,i)=>{b.classList.toggle('active',i===v);b.setAttribute('aria-pressed',String(i===v));b.querySelector('small').textContent=descriptions[c][i][0];});
 $('model-field').hidden=c!=='stone';$('wire-field').hidden=c!=='rock';$('preview-field').hidden=c!=='psyshock';
 $('sliders').replaceChildren(...buildGroups(c));
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
 while(state.time+fixedStep<target){state.time+=fixedStep;effect.update(fxTime(state.time),fixedStep);particles.update(fixedStep);}
 const rest=target-state.time;state.time=target;effect.update(fxTime(target),rest);if(rest>0)particles.update(rest);
};
const SAVE_KEY='arenamon.sand-stone.v4',today=()=>new Date().toLocaleDateString('sv-SE');let saveTimer=0;
function autosave(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(serializeLocal({presets:state.presets,category:state.category,variant:state.variant,model:state.model,presentation:presentation()})));$('save-status').textContent='Salvo automaticamente neste navegador (vale só para este navegador e este arquivo HTML; o .json exportado é a cópia segura).';}catch{$('save-status').textContent='O navegador não permitiu salvar automaticamente; use Exportar.';}}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(autosave,300);}
function syncPresentation(pr){Object.assign(state,pr);for(const id of ['rate','bloom','shake','exposure']){$(id).value=state[id];$(id+'-value').textContent=state[id].toFixed(2)+'×';}$('reduced').checked=state.reduce;$('noflash').checked=!!state.noFlash;$('loop').checked=state.loop;$('model').value=state.model;$('preview-count').value=state.previewCount;$('camera').value=pr.camera;$('wire').checked=pr.wire;$('grid').checked=pr.grid;grid.visible=pr.grid;}
function applySaved(data){const r=restoreLocal(data);if(!r)return false;state.presets=r.presets;state.category=r.category;state.variant=r.variant;state.model=r.model;if(r.presentation)syncPresentation(r.presentation);else $('model').value=state.model;return true;}
const readSaved=()=>JSON.parse(localStorage.getItem(SAVE_KEY)||localStorage.getItem('arenamon.sand-stone.v3')||localStorage.getItem('arenamon.sand-stone.v2')||'null');
$('save').onclick=()=>{clearTimeout(saveTimer);autosave();};
$('load').onclick=()=>{try{if(!applySaved(readSaved()))throw Error();refreshSelection();replay();frameCamera();$('save-status').textContent='Configuração salva recarregada.';}catch{$('save-status').textContent='Nenhuma configuração válida salva.';}};
document.addEventListener('input',scheduleSave);document.addEventListener('change',scheduleSave);
$('noflash').onchange=e=>{state.noFlash=e.target.checked;replay();};
function presentation(){return {bloom:state.bloom,exposure:state.exposure,shake:state.shake,rate:state.rate,reduce:state.reduce,loop:state.loop,model:state.model,previewCount:state.previewCount,camera:$('camera').value,wire:$('wire').checked,grid:grid.visible,noFlash:!!state.noFlash};}
function download(data,name){const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-one').onclick=()=>download(exportSingle(state.presets,state.category,state.variant,presentation()),exportFileName({scope:'single',category:state.category,variant:state.variant},today()));
$('export-all').onclick=()=>download(exportAll(state.presets,presentation()),exportFileName({scope:'all'},today()));
$('import').onclick=()=>$('import-file').click();
$('import-file').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>512000)throw Error('Arquivo acima de 500 KB');const parsed=parsePreset(await file.text());const label=parsed.scope==='single'?`${parsed.category} ${parsed.variant}`:'todas as 24 opções';if(!confirm(`Importar ${label}? Os ajustes locais correspondentes serão substituídos.`))return;
 if(parsed.scope==='single'){state.presets[parsed.category][parsed.variant]={...parsed.values};state.category=parsed.category;state.variant='ABC'.indexOf(parsed.variant);}else state.presets=parsed.presets;
 syncPresentation(parsed.presentation);refreshSelection();replay();frameCamera(parsed.presentation.camera);$('save-status').textContent=`Importado: ${label}.${parsed.ignored?` ${parsed.ignored} campo(s) desconhecido(s) ignorado(s).`:''}${parsed.filled?` ${parsed.filled} valor(es) ausente(s) completado(s) com o padrão.`:''}`;
 }catch(error){$('save-status').textContent='Importação recusada: '+error.message;}};
document.addEventListener('keydown',e=>{if(e.target.matches('input,select,button'))return;if(['1','2','3'].includes(e.key)){state.variant=Number(e.key)-1;refreshSelection();replay();}if(e.code==='Space'){e.preventDefault();state.playing=!state.playing;updatePlay();}if(e.key.toLowerCase()==='r')replay();});
function resize(){const {width,height}=canvas.getBoundingClientRect(),w=Math.max(1,Math.floor(width)),h=Math.max(1,Math.floor(height));if(w===lastWidth&&h===lastHeight)return;lastWidth=w;lastHeight=h;renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
renderer.setAnimationLoop(now=>{
 resize();const elapsed=Math.min(.08,Math.max(0,(now-last)/1000));last=now;
 if(state.playing&&clock?.nothingToShow){state.playing=false;updatePlay();}
 if(state.playing){accumulator+=elapsed*state.rate*(state.reduce?.65:1);while(accumulator>=fixedStep){accumulator-=fixedStep;state.time+=fixedStep;effect.update(fxTime(state.time),fixedStep);particles.update(fixedStep);if(state.time>=fxDur()){if(state.loop)construct();else{state.time=fxDur();state.playing=false;updatePlay();break;}}}}
 orbit.update();renderer.toneMappingExposure=state.exposure;bloomPass.strength=state.noFlash?Math.min(state.bloom,.25):state.bloom;
 const punch=effect.punch??0;blast.intensity=state.noFlash?0:punch*24;blast.position.z=state.category==='sand'?state.presets.sand['ABC'[state.variant]].length/2:state.category==='swift'?2.55:state.category==='psyshock'?2.4:state.category==='riposte'?1.9:['bulletpunch','quickattack'].includes(state.category)?2.35:0;
 if(['swift','psyshock','bulletpunch','quickattack','riposte'].includes(state.category))blast.color.setHSL(values().primaryHue/360,.8,.62);else blast.color.setHex(0xffbb60);
 const shift=state.reduce?0:punch*state.shake*.075,save=camera.position.clone();camera.position.x+=Math.sin(state.time*151)*shift;camera.position.y+=Math.cos(state.time*127)*shift;
 renderer.info.reset();composer.render();camera.position.copy(save);
 $('phase').textContent=clock?(clock.nothingToShow?'—':phaseNames[clock.phaseAt(state.time)]??'—'):effect.phase;$('time').textContent=state.time.toFixed(2)+' / '+fxDur().toFixed(2)+' s';$('scrub').value=state.time;$('quarks-status').textContent=particles.count+' partículas · '+renderer.info.render.calls+' draw calls · three.quarks';
});
window.__labShotSignature=()=>effect?.shot?.signature?.()??null;
window.__labDiagnostics=()=>({noFlash:state.noFlash,reduce:state.reduce,startOn:values().startOn,shotKind:values().shotKind,category:state.category,variant:state.variant,particleSystems:particles.systems.length,particles:particles.count,time:state.time,hasQuarks:typeof particles.renderer.addSystem==='function',version:3,visualRevision:6,drawCalls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,visualSignature:stage.userData.visualSignature??'legacy',riposte:state.category==='riposte'?{guardVisible:effect.guard.visible,counterVisible:effect.counter.visible,success:effect.success,contact:effect.contact,scenario:values().scenario}:null});
try{applySaved(readSaved());}catch{}
$('reduced').checked=state.reduce;$('noflash').checked=!!state.noFlash;
refreshSelection();construct();frameCamera();
