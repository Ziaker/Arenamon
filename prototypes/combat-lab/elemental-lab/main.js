import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {ELEMENTAL_PRESETS,ELEMENTAL_CONTROLS} from '../src/view/quarks/presets.js';
import {ElementalPreview} from '../src/view/quarks/elemental-preview.js';
const $=s=>document.querySelector(s),canvas=$('#c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene();scene.background=new THREE.Color('#171c25');
const camera=new THREE.PerspectiveCamera(42,1,.1,100);camera.position.set(7,4.5,10);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,1.5,0);controls.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xdff5ff,0x42362b,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(2,6,4);scene.add(light);
const grid=new THREE.GridHelper(20,40,0x3a4655,0x252d39);scene.add(grid);
const fx=new ElementalPreview(scene),saved={};let id='waterPulse',playing=true;
$('#reduced').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
for(const [key,p] of Object.entries(ELEMENTAL_PRESETS))$('#move').add(new Option(p.label,key));
function values(){return saved[id]??={...ELEMENTAL_PRESETS[id]};}
function play(){playing=true;fx.play(id,values(),+$('#pl').value,{noFlash:$('#no-flash').checked,reduced:$('#reduced').checked});}
function renderControls(){const p=values();$('#params').replaceChildren();$('#pl-label').hidden=id!=='waterPulse';$('#title').textContent=p.label;
 for(const [key,label,unit,min,max,step] of ELEMENTAL_CONTROLS){if((key==='rings'&&id==='seedBomb')||(key==='spread'&&id==='fireSpin'))continue;const l=document.createElement('label'),o=document.createElement('output'),input=document.createElement('input');l.append(`${label} (${unit})`,o,input);input.type='range';input.min=min;input.max=max;input.step=step;input.value=p[key];input.id=key;o.value=String(p[key]);input.oninput=()=>{p[key]=+input.value;o.value=input.value;play();};$('#params').append(l);}
 for(const [key,label] of [['color','Cor principal'],['accent','Cor secundária']]){const l=document.createElement('label'),i=document.createElement('input');l.textContent=label;i.type='color';i.value=p[key];i.id=key;i.oninput=()=>{p[key]=i.value;play();};l.append(i);$('#params').append(l);}
}
$('#move').onchange=()=>{id=$('#move').value;renderControls();play();};$('#play').onclick=play;$('#stop').onclick=()=>{playing=false;fx.clear();};$('#reset').onclick=()=>{delete saved[id];renderControls();play();};
for(const name of ['pl','no-flash','reduced'])$('#'+name).onchange=play;
$('#background').oninput=()=>scene.background.set($('#background').value);
new ResizeObserver(()=>{const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(canvas);
renderControls();play();let last=performance.now();
renderer.setAnimationLoop(now=>{const dt=Math.min(.05,(now-last)/1000);last=now;fx.update(dt);if(!fx.active&&playing&&$('#loop').checked)play();controls.update();renderer.render(scene,camera);const d=fx.diagnostics();$('#phase').textContent=d.phase;$('#status').textContent=`${d.particles} partículas · ${d.systems} emissores · ${d.time?.toFixed(1)} s`;});
window.__elementalLab={diagnostics:()=>fx.diagnostics(),stop:()=>{playing=false;fx.clear();},advance:seconds=>{for(let t=0;t<seconds;t+=1/60)fx.update(1/60);return fx.diagnostics();}};
