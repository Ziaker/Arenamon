import * as T from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
const $=id=>document.getElementById(id),scene=new T.Scene(),view=$('view');
scene.background=new T.Color('#19212c');
const camera=new T.PerspectiveCamera(40,1,.001,100000),renderer=new T.WebGLRenderer({antialias:true});
renderer.toneMapping=T.NoToneMapping;renderer.shadowMap.enabled=false;view.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement),lights=new T.Group();
lights.add(new T.HemisphereLight(0xffffff,0x566477,2));const key=new T.DirectionalLight(0xffffff,2);key.position.set(3,5,4);lights.add(key);
let model,mixer,clips=[],playing=true,originals=new Map(),rest=new Map(),materialIds=new Map(),busy=false;
const palette=['#829bb8','#bc987d','#819f91','#9b8ead','#b6ad7e','#829fa9'];
function status(message){$('status').textContent=message;}
function solid(source,unlit,noTextures){
 const color=noTextures?($('palette').value==='global'?$('color').value:palette[materialIds.get(source)%palette.length]):(source.color||new T.Color('white'));
 const material=unlit?new T.MeshBasicMaterial({color}):new T.MeshStandardMaterial({color,roughness:1,metalness:0});
 material.side=source.side;material.name='Prototype';
 if(!noTextures){material.map=source.map||null;material.alphaMap=source.alphaMap||null;material.opacity=source.opacity;material.transparent=source.transparent;material.alphaTest=source.alphaTest;material.vertexColors=source.vertexColors;
 if(!unlit&&source.isMeshStandardMaterial){material.copy(source);material.envMap=null;}}
 return material;
}
function materials(root,unlit,noTextures){root.traverse(o=>{if(!o.isMesh)return;const src=originals.get(o.uuid)||o.material;o.material=Array.isArray(src)?src.map(m=>solid(m,unlit,noTextures)):solid(src,unlit,noTextures);o.castShadow=false;o.receiveShadow=false;});}
function disposePreview(){if(model)model.traverse(o=>{if(o.isMesh&&o.material!==originals.get(o.uuid)){for(const m of [].concat(o.material))m.dispose();}});}
function refresh(){if(!model)return;disposePreview();materials(model,!$('lighting').checked,!$('textures').checked);if($('lighting').checked)scene.add(lights);else lights.removeFromParent();scene.environment=null;renderer.toneMapping=T.NoToneMapping;}
async function parse(file){
 const manager=new T.LoadingManager();manager.setURLModifier(url=>{if(/^(blob:|data:)/.test(url))return url;return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';});
 const data=await file.arrayBuffer();if(/\.fbx$/i.test(file.name)){const root=new FBXLoader(manager).parse(data,'');return {scene:root,animations:root.animations};}
 if(!/\.glb$/i.test(file.name))throw Error('Use FBX ou GLB.');return new GLTFLoader(manager).parseAsync(data,'');
}
function selectClip(){mixer?.stopAllAction();if(clips[+$('clip').value])mixer.clipAction(clips[+$('clip').value]).reset().play();}
function updateClips(){const selected=$('clip').value;$('clip').replaceChildren(...clips.map((c,i)=>new Option(c.name||`Animação ${i+1}`,String(i))));$('clip').value=selected||'0';if(!$('clip').value&&clips.length)$('clip').value='0';selectClip();}
function install(root,animations){
 mixer?.stopAllAction();disposePreview();if(model){model.removeFromParent();const resources=new Set();model.traverse(o=>{if(o.isMesh){resources.add(o.geometry);for(const m of [].concat(originals.get(o.uuid))){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}}});resources.forEach(r=>r.dispose());}
 model=root;clips=animations;originals=new Map();rest=new Map();materialIds=new Map();const remove=[];
 root.traverse(o=>{if(o.isLight){remove.push(o);return;}rest.set(o.uuid,{position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone(),matrix:o.matrix.clone()});if(o.isMesh){originals.set(o.uuid,o.material);for(const m of [].concat(o.material))if(!materialIds.has(m))materialIds.set(m,materialIds.size);}});remove.forEach(o=>o.removeFromParent());
 scene.add(root);mixer=new T.AnimationMixer(root);refresh();root.updateMatrixWorld(true);
 const box=new T.Box3().setFromObject(root),center=box.getCenter(new T.Vector3()),size=Math.max(box.getSize(new T.Vector3()).length(),.1);controls.target.copy(center);camera.position.copy(center).add(new T.Vector3(size*.7,size*.4,size*1.2));camera.far=Math.max(size*100,1000);camera.updateProjectionMatrix();controls.update();updateClips();$('export').disabled=false;
 status(`Modelo carregado. ${clips.length} animações. Texturas externas não são carregadas; use GLB com recursos embutidos.`);
}
function normalize(name){return name.replace(/^mixamorig[:_]?/i,'').replace(/[^a-z0-9]/gi,'').toLowerCase();}
function append(animations){
 if(!model)throw Error('Importe o modelo primeiro.');const nodes=new Map();model.traverse(o=>{const name=normalize(o.name);if(!nodes.has(name))nodes.set(name,[]);nodes.get(name).push(o);});
 const additions=animations.map(clip=>{const result=clip.clone();result.tracks=result.tracks.map(track=>{const binding=T.PropertyBinding.parseTrackName(track.name);const name=binding.objectName==='bones'?binding.objectIndex:binding.nodeName;let target=T.PropertyBinding.findNode(model,name);if(!target){const matches=nodes.get(normalize(name||''));if(matches?.length===1)target=matches[0];}if(!target)throw Error(`Rig incompatível: não foi possível associar ${name}. Nenhuma animação deste arquivo foi anexada.`);const copy=track.clone();copy.name=target.uuid+'.'+binding.propertyName+(binding.propertyIndex!==undefined?'['+binding.propertyIndex+']':'');return copy;});return result;});
 clips.push(...additions);updateClips();return additions.length;
}
async function exportGLB(){
 if(!model)throw Error('Importe um modelo primeiro.');
 // Clone skeletons and export the original local transforms, never the live animated pose.
 const root=clone(model),source=[],target=[];model.traverse(o=>source.push(o));root.traverse(o=>target.push(o));const uuidMap=new Map();
 source.forEach((o,i)=>{const c=target[i],r=rest.get(o.uuid);uuidMap.set(o.uuid,c.uuid);if(r){c.position.copy(r.position);c.quaternion.copy(r.quaternion);c.scale.copy(r.scale);c.matrix.copy(r.matrix);}if(o.isMesh)c.material=originals.get(o.uuid);});
 const exportedClips=clips.map(clip=>{const c=clip.clone();c.tracks.forEach(t=>{for(const [a,b] of uuidMap)if(t.name.startsWith(a+'.')){t.name=b+t.name.slice(a.length);break;}});return c;});
 materials(root,$('unlit').checked,$('noTextures').checked);root.updateMatrixWorld(true);
 try{return await new GLTFExporter().parseAsync(root,{binary:true,animations:exportedClips,onlyVisible:false});}finally{root.traverse(o=>{if(o.isMesh)[].concat(o.material).forEach(m=>m.dispose());});}
}
async function task(fn){if(busy)return;busy=true;try{await fn();}catch(e){status(e.message);console.error(e);}finally{busy=false;}}
$('model').onchange=()=>task(async()=>{const f=$('model').files[0];if(!f)return;const data=await parse(f);install(data.scene,data.animations);});
$('animations').onchange=()=>task(async()=>{for(const f of $('animations').files){const data=await parse(f);const count=append(data.animations);status(`${count} animações anexadas de ${f.name}. Total: ${clips.length}.`);}});
for(const id of ['textures','lighting','palette','color'])$(id).onchange=()=>{for(const key of ['textures','lighting'])$(key+'Label').textContent=(key==='textures'?'Texturas':'Iluminação')+': '+($(key).checked?'ON':'OFF');refresh();};
$('clip').onchange=selectClip;$('play').onclick=()=>{playing=!playing;};
$('export').onclick=()=>task(async()=>{const data=await exportGLB(),url=URL.createObjectURL(new Blob([data],{type:'model/gltf-binary'})),a=document.createElement('a');a.href=url;a.download='arenamon-prototipo.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status(`GLB exportado · ${clips.length} animações · ${$('noTextures').checked?'sem texturas':'texturas permitidas'} · ${$('unlit').checked?'unlit':'iluminado'}.`);});
new ResizeObserver(()=>{const w=view.clientWidth,h=view.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(view);
const clock=new T.Clock();renderer.setAnimationLoop(()=>{const dt=Math.min(clock.getDelta(),.1);if(playing)mixer?.update(dt);controls.update();renderer.render(scene,camera);});
window.__importer={install,append,exportGLB,parse,get model(){return model;},get clips(){return clips;},T,refresh};
