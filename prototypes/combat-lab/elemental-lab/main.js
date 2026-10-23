import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {ELEMENTAL_PRESETS,ELEMENTAL_CONTROLS,ELEMENTAL_VARIANTS,FIRE_CONTROLS,CONTROL_HELP,fireDefaults} from '../src/view/quarks/presets.js';
import {ElementalPreview} from '../src/view/quarks/elemental-preview.js';
const $=s=>document.querySelector(s),canvas=$('#c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
const scene=new THREE.Scene();scene.background=new THREE.Color('#171c25');
const camera=new THREE.PerspectiveCamera(42,1,.1,100);camera.position.set(4.8,3.6,8);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(100,100),.45,.45,.85);composer.addPass(bloom);composer.addPass(new OutputPass());
const controls=new OrbitControls(camera,canvas);controls.target.set(0,1.5,0);controls.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xdff5ff,0x42362b,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(2,6,4);scene.add(light);
const grid=new THREE.GridHelper(20,20,0x27313f,0x202632);scene.add(grid);
const fx=new ElementalPreview(scene),saved={};let id='waterPulse',playing=true,variant=0,frozen=false;
$('#reduced').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
for(const [key,p] of Object.entries(ELEMENTAL_PRESETS))$('#move').add(new Option(p.label,key));
function values(){return saved[id+variant]??={...fireDefaults(variant),stretch:1,opening:1.1,contactSize:1,...ELEMENTAL_PRESETS[id],variant};}
function play(){frozen=false;playing=true;fx.play(id,values(),+$('#pl').value,{noFlash:$('#no-flash').checked,reduced:$('#reduced').checked});}
function renderControls(){const p=values();$('#variant-label').hidden=!ELEMENTAL_VARIANTS[id];$('#contact').hidden=!['waterPulse','airSlash'].includes(id);$('#variant').replaceChildren();(ELEMENTAL_VARIANTS[id]??[]).forEach((name,i)=>$('#variant').add(new Option(name,String(i))));$('#variant').value=String(variant);$('#params').replaceChildren();$('#pl-label').hidden=id!=='waterPulse';$('#title').textContent=p.label;$('#bloom').max=id==='waterPulse'?360:1.2;
 for(const [key,label,unit,min,max,step] of [...ELEMENTAL_CONTROLS,...(id==='fireSpin'?FIRE_CONTROLS:[])]){if((key==='stretch'&&id!=='waterPulse')||(key==='opening'&&id!=='fireSpin')||(key==='contactSize'&&!['waterPulse','airSlash'].includes(id)))continue;if((key==='detail'&&id==='seedBomb')||(key==='trail'&&id!=='airSlash'))continue;if((key==='rings'&&id==='seedBomb')||(key==='spread'&&id==='fireSpin'))continue;const l=document.createElement('label'),o=document.createElement('output'),input=document.createElement('input');l.append(`${label} (${unit})`,o,input);input.type='range';input.min=min;input.max=id==='waterPulse'?max*300:max;input.step=step;input.value=p[key];input.id=key;o.value=String(p[key]);const numeric=document.createElement('input');numeric.type='number';numeric.className='param-value';numeric.min=input.min;numeric.max=input.max;numeric.step=input.step;numeric.value=input.value;numeric.setAttribute('aria-label',label+' ('+unit+')');l.insertBefore(numeric,input);o.hidden=true;input.oninput=()=>{p[key]=+input.value;o.value=input.value;numeric.value=input.value;play();};numeric.onchange=()=>{if(!Number.isFinite(numeric.valueAsNumber))return;input.value=String(Math.min(+input.max,Math.max(+input.min,numeric.valueAsNumber)));input.oninput();};const help=document.createElement('small');help.id=key+'-help';help.textContent=CONTROL_HELP[key]??FIRE_CONTROLS.find(c=>c[0]===key)?.[6]??'Ajusta a aparência deste parâmetro.';input.setAttribute('aria-describedby',help.id);input.title=help.textContent;l.append(help);$('#params').append(l);}
 for(const [key,label] of [['color','Cor principal'],['accent','Cor secundária']]){const l=document.createElement('label'),i=document.createElement('input');l.textContent=label;i.type='color';i.value=p[key];i.id=key;i.oninput=()=>{p[key]=i.value;play();};l.append(i);$('#params').append(l);}
}
$('#move').onchange=()=>{id=$('#move').value;variant=0;renderControls();play();};$('#play').onclick=play;$('#variant').onchange=()=>{variant=+$('#variant').value;renderControls();play();};$('#contact').onclick=()=>fx.contact();$('#stop').onclick=()=>{playing=false;fx.clear();};$('#reset').onclick=()=>{delete saved[id+variant];renderControls();play();};
for(const name of ['pl','no-flash','reduced'])$('#'+name).onchange=play;
$('#background').oninput=()=>scene.background.set($('#background').value);
new ResizeObserver(()=>{const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(canvas);
renderControls();play();let last=performance.now();
renderer.setAnimationLoop(now=>{const dt=Math.min(.05,(now-last)/1000);last=now;if(!frozen)fx.update(dt);if(!fx.active&&playing&&$('#loop').checked)play();if($('#follow').checked&&!$('#reduced').checked&&fx.active){const x=fx.core.position.x;camera.position.x+=x-controls.target.x;controls.target.x=x;}controls.update();bloom.enabled=!$('#no-flash').checked;bloom.strength=+$('#bloom').value;composer.render();const d=fx.diagnostics();$('#phase').textContent=d.phase;$('#status').textContent=`${d.particles} partículas · ${d.systems} emissores · ${d.time?.toFixed(1)} s`;});
window.__elementalLab={sampleAt:seconds=>{play();frozen=true;for(let t=0;t<seconds;t+=1/120)fx.update(Math.min(1/120,seconds-t));return fx.diagnostics();},diagnostics:()=>fx.diagnostics(),stop:()=>{playing=false;fx.clear();},advance:seconds=>{for(let t=0;t<seconds;t+=1/60)fx.update(1/60);return fx.diagnostics();}};
