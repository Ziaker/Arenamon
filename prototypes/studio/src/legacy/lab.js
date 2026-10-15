// Studio V3 · cenário, câmeras, root motion de preview e comparação (extraído do HTML v6).
// Mantido o mais próximo possível do original; alterações estão marcadas com "Fase 1".
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const E=window.__importer;
if(!E){console.error('Studio V3: motor indisponível');return}
const T=E.T,scene=E.scene,camera=E.camera,controls=E.controls,renderer=E.renderer;
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const read=(id,fallback=0)=>{const n=Number($(id)?.value);return Number.isFinite(n)?n:fallback};
const check=id=>!!$(id)?.checked;
const st={rootMode:'rotation',camera:'free',compare:false,compareType:'motion',gridSize:20,gridDiv:20,scale:1,modelSize:V(1,1.5,1),modelCenter:V(),grid:null,ground:null,axes:null,dummy:null,track:null,trajectory:null,footObjects:[],footNodes:[],origRoot:null,lastIdx:-1,footLast:[],motionLength:0,ready:false,dirtyCam:true,hasFirstCam:false,storedPreview:null,visualRoot:V(),touched:false};
const dummyGroup=new T.Group();dummyGroup.name='Arenamon Studio · Alvo técnico';scene.add(dummyGroup);
const dummyMaterial=new T.MeshStandardMaterial({color:'#ff896b',metalness:0,roughness:.88,transparent:true,opacity:.78});
const dummyFace=new T.MeshBasicMaterial({color:'#f8eed7'});
const dummyBody=new T.Mesh(new T.CylinderGeometry(.38,.44,1.12,12),dummyMaterial);
const dummyHead=new T.Mesh(new T.SphereGeometry(.28,16,12),dummyMaterial);
const dummyEye=new T.Mesh(new T.SphereGeometry(.038,8,7),dummyFace);
dummyGroup.add(dummyBody,dummyHead,dummyEye);
dummyGroup.visible=false;
const footMat=[new T.MeshBasicMaterial({color:'#8ef2b9',depthTest:false}),new T.MeshBasicMaterial({color:'#ffcc88',depthTest:false})];
for(let i=0;i<2;i++){const mesh=new T.Mesh(new T.SphereGeometry(.055,10,8),footMat[i]);mesh.renderOrder=500;mesh.visible=false;mesh.name='Indicador pé '+i;scene.add(mesh);st.footObjects.push(mesh)}
const pathMaterial=new T.LineBasicMaterial({color:'#62e6eb',transparent:true,opacity:.92,depthTest:false});
let flatMaterial=new T.MeshBasicMaterial({color:'#a4c9dd',side:T.DoubleSide});
const cmpCamera=camera.clone();
function updateScene(){
 const size=clamp(read('lab-grid-size',20),.1,10000),div=Math.round(clamp(read('lab-grid-div',20),2,200));
 if(!st.grid||size!==st.gridSize||div!==st.gridDiv){
  if(st.grid){scene.remove(st.grid);st.grid.geometry.dispose();[].concat(st.grid.material).forEach(m=>m.dispose())}
  if(st.ground){scene.remove(st.ground);st.ground.geometry.dispose();st.ground.material.dispose()}
  if(st.axes){scene.remove(st.axes);st.axes.geometry.dispose();st.axes.material.dispose()}
  st.grid=new T.GridHelper(size,div,'#567b9c','#324b68');st.grid.name='Grid de referência';scene.add(st.grid);
  st.ground=new T.Mesh(new T.PlaneGeometry(size,size),new T.MeshBasicMaterial({color:'#2b4b65',transparent:true,opacity:.24,side:T.DoubleSide,depthWrite:false}));st.ground.rotation.x=-Math.PI/2;st.ground.name='Plano técnico';scene.add(st.ground);
  st.axes=new T.AxesHelper(Math.min(size/3,3*st.scale));scene.add(st.axes);
  st.gridSize=size;st.gridDiv=div;
 }
 const p=V(read('lab-grid-x'),read('lab-grid-y'),read('lab-grid-z'));
 st.grid.position.copy(p);st.grid.rotation.y=read('lab-grid-yaw')*Math.PI/180;st.grid.visible=check('lab-grid');
 st.ground.position.copy(p).add(V(0,-.012*Math.max(st.scale,.01),0));st.ground.rotation.set(-Math.PI/2,0,-read('lab-grid-yaw')*Math.PI/180);st.ground.visible=check('lab-floor');
 st.ground.material.opacity=read('lab-floor-opacity',.24);
 st.axes.position.copy(p);st.axes.rotation.y=st.grid.rotation.y;st.axes.visible=check('lab-axes');
 st.dummy=dummyGroup;
 const s=st.scale;dummyBody.scale.setScalar(s);dummyHead.scale.setScalar(s);dummyEye.scale.setScalar(s);
 dummyHead.position.set(0,.85*s,0);dummyBody.position.set(0,.13*s,0);dummyEye.position.set(0,.9*s,.28*s);
 dummyGroup.position.copy(st.modelCenter).add(V(read('lab-dummy-x')*s,read('lab-dummy-y')*s,read('lab-dummy-z')*s));dummyGroup.position.y=read('lab-grid-y')+(.62+read('lab-dummy-y'))*s;dummyGroup.visible=check('lab-dummy');
 $('lab-quick-grid').setAttribute('aria-pressed',String(check('lab-grid')));
 st.footObjects.forEach(m=>m.visible=check('lab-feet')&&st.ready);
 if(st.trajectory)st.trajectory.visible=check('lab-trajectory');
}
function bounds(){if(!E.model)return null;E.model.updateMatrixWorld(true);const b=new T.Box3().setFromObject(E.model);return b.isEmpty()?null:b}
function setGridGroundY(y){$('lab-grid-y').value=Number(y.toFixed(3));updateScene();updatePath()}
function fitGrid(){let b=bounds();if(!b)return;setGridGroundY(b.min.y)}
function centerGrid(){let b=bounds();let x=b?b.getCenter(V()).x:0,z=b?b.getCenter(V()).z:0;$('lab-grid-x').value=x.toFixed(3);$('lab-grid-z').value=z.toFixed(3);updateScene();updatePath()}
function frameModel(){let b=bounds();if(!b)return;st.modelSize=b.getSize(V());st.modelCenter=b.getCenter(V());st.scale=clamp(st.modelSize.y/1.5,.02,1000);st.ready=true;const len=Math.max(st.modelSize.length(),.05);$('lab-dummy-z').value=(Math.max(st.modelSize.z*2.3,3.5*st.scale)/st.scale).toFixed(2);$('lab-grid-size').value=Math.ceil(len*3);st.gridSize=-1;updateScene();fitGrid();centerGrid();captureFeet();st.dirtyCam=true;st.hasFirstCam=false}
function captureFeet(){st.footNodes=[];E.model?.traverse(obj=>{if(obj.isBone&&/(LeftFoot|RightFoot|footL|footR|l_foot|r_foot)/i.test(obj.name))st.footNodes.push(obj)});st.footNodes.sort((a,b)=>a.name.localeCompare(b.name));if(st.footNodes.length>2)st.footNodes=st.footNodes.filter(obj=>/(LeftFoot|RightFoot)/i.test(obj.name)).slice(0,2);st.footNodes=st.footNodes.slice(0,2);st.footLast=[]}
function footTick(dt){if(!st.ready)return;let result=[];
 if(!check('lab-feet')){$('lab-foot-status').textContent='Marcadores de pés desativados.';st.footObjects.forEach(m=>m.visible=false);return}
 for(let i=0;i<2;i++){
  const obj=st.footNodes[i],marker=st.footObjects[i];if(!obj){marker.visible=false;continue}
  let p=obj.getWorldPosition(V());marker.position.copy(p);marker.visible=true;
  const distance=p.y-read('lab-grid-y');const contact=Math.abs(distance)<Math.max(.065*st.scale,.015);let sliding=false;
  if(st.footLast[i]&&dt>0){const speed=Math.hypot(p.x-st.footLast[i].x,p.z-st.footLast[i].z)/dt;sliding=contact&&speed>.35*st.scale}
  st.footLast[i]=p.clone();marker.material.color.set(sliding?'#ff777e':contact?'#7df2ae':'#ffcc88');
  result.push(`${i?'Direito':'Esquerdo'}: ${contact?'apoio':'no ar'}${sliding?' · possível deslize':''}`)
 }
 $('lab-foot-status').textContent=result.length?result.join('  |  ')+' · diagnóstico aproximado, não detector de contato físico':'Não foram encontrados ossos de pés reconhecíveis neste rig.';
}
function clipAndTrack(){
 const clip=E.selectedClip;if(!clip||!E.model)return null;
 const lookup=new Map();E.model.traverse(o=>lookup.set(o.uuid,o));
 let candidates=[];
 for(const tr of clip.tracks){if(!tr.name.endsWith('.position')||!tr.values?.length||!tr.times?.length)continue;let name=tr.name.slice(0,-'.position'.length);let node=lookup.get(name);if(!node)continue;let score=(node.isBone?50:0)+(/hip|pelvis|root/i.test(node.name)?70:0)+(!node.parent?.isBone?10:0);
  candidates.push({node,track:tr,score})}
 candidates.sort((a,b)=>b.score-a.score);
 if(!candidates.length)return null;
 let root=candidates[0],quatTrack=clip.tracks.find(tr=>tr.name===root.node.uuid+'.quaternion');
 return {...root,quatTrack,clip,initial:V(root.track.values[0]||0,root.track.values[1]||0,root.track.values[2]||0)}
}
function findCurrentClip(){let i=E.selectedIndex;if(i===st.lastIdx)return;st.lastIdx=i;st.track=clipAndTrack();updatePath();applyLoop();st.origRoot=null;st.footLast=[]}
function buildPathPoints(){const d=st.track;if(!d)return [];
 let points=[],tr=d.track,count=tr.times.length,stride=tr.getValueSize?tr.getValueSize():3;const countLimit=180;
 for(let i=0;i<count;i+=Math.max(1,Math.ceil(count/countLimit))){const j=i*stride,dx=tr.values[j]-d.initial.x,dz=tr.values[j+2]-d.initial.z;
  if(!Number.isFinite(dx)||!Number.isFinite(dz))continue;
  points.push(V(st.modelCenter.x+dx,read('lab-grid-y')+.018*st.scale,st.modelCenter.z+dz))
 }
 return points
}
function updatePath(){if(st.trajectory){scene.remove(st.trajectory);st.trajectory.geometry.dispose();st.trajectory=null}
 const p=buildPathPoints();if(p.length>=2){st.trajectory=new T.Line(new T.BufferGeometry().setFromPoints(p),pathMaterial);st.trajectory.name='Trajetória root motion';st.trajectory.frustumCulled=false;scene.add(st.trajectory);st.trajectory.visible=check('lab-trajectory')}
 const m=$('lab-trajectory-metrics');m.replaceChildren();if(!st.track||p.length<2){m.innerHTML='<span class="lab-chip">Sem trajetória root detectada</span>';return}
 let distance=0;for(let i=1;i<p.length;i++)distance+=p[i].distanceTo(p[i-1]);const d=st.track.track,v=d.values,n=v.length,s=d.getValueSize?.()||3;
 const deltaX=v[n-s]-v[0],deltaY=v[n-s+1]-v[1],deltaZ=v[n-s+2]-v[2];
 for(let [label,val] of [['Percurso',distance],['ΔX',deltaX],['ΔY',deltaY],['ΔZ',deltaZ]]){let tag=document.createElement('span');tag.className='lab-chip';tag.textContent=label+' '+val.toFixed(2);m.append(tag)}
}
function applyRoot(mode,original){let d=st.track;if(!d||!original)return;if(mode==='original')return;
 // Preview-only correction on the actual animated root track; do not mutate KeyframeTrack values.
 const o=d.node;o.position.x=d.initial.x;o.position.z=d.initial.z;
 if(mode==='fixed'){o.position.y=d.initial.y;if(d.quatTrack){let q=d.quatTrack.values;o.quaternion.set(q[0],q[1],q[2],q[3]).normalize()}}
}
function restoreRoot(){if(!st.track||!st.origRoot)return;st.track.node.position.copy(st.origRoot.position);st.track.node.quaternion.copy(st.origRoot.quaternion);st.track.node.updateMatrixWorld(true)}
function originalFromMixer(){if(!E.mixer||!E.selectedClip||!st.track)return;
 // Always recompute from the untouched source clip so pausing/seeking does not stack in-place corrections.
 E.mixer.update(0);
 st.origRoot={position:st.track.node.position.clone(),quaternion:st.track.node.quaternion.clone()};
 applyRoot(st.rootMode,st.origRoot);E.model.updateMatrixWorld(true)
}
function targetPoint(){return st.modelCenter.clone()}
function cameraPose(kind,out=camera){if(!st.ready)return null;
 const p=targetPoint(),s=st.scale,d=read('lab-cam-distance',6.2)*s,h=read('lab-cam-height',2.2)*s,sh=read('lab-cam-shoulder',.45)*s;
 const tgt=p.clone().add(V(0,.2*st.modelSize.y,0));let dest;
 switch(kind){
 case 'front':dest=p.clone().add(V(0,h,d));break;
 case 'back':dest=p.clone().add(V(0,h,-d));break;
 case 'side':dest=p.clone().add(V(d,h,0));break;
 case 'close':dest=p.clone().add(V(.14*d,.18*d,.37*d));break;
 case 'top':dest=p.clone().add(V(0,Math.max(d,.7*s),.015*s));break;
 case 'arena':dest=p.clone().add(V(.75*d,.87*d,1.05*d));break;
 case 'lock':{
  const opponent=dummyGroup.position.clone();if(!check('lab-dummy'))opponent.copy(p).add(V(0,0,4*s));
  tgt.lerp(opponent,.38);tgt.y=p.y+.05*st.modelSize.y;
  const dir=opponent.clone().sub(p);dir.y=0;if(dir.lengthSq()<.001)dir.set(0,0,1);dir.normalize();
  dest=p.clone().addScaledVector(dir,-d).add(V(sh,h,0));break}
 case 'game':dest=p.clone().add(V(sh,h,-d));tgt.add(V(0,.05*st.modelSize.y,1.8*s));break;
 default:dest=p.clone().add(V(.7*d,.4*d,1.2*d));
 }
 return {pos:dest,target:tgt}
}
function setCamera(kind,instant=false,dt=1/60){if(!st.ready)return;if(kind==='free'){
  if(!controls.enabled){controls.enabled=true;controls.target.copy(targetPoint());controls.update()}
  return}
 controls.enabled=false;let pose=cameraPose(kind);if(!pose)return;
 const weight=instant||!st.hasFirstCam?1:1-Math.exp(-clamp(read('lab-cam-smooth',12),.1,40)*Math.max(.001,dt));
 camera.position.lerp(pose.pos,weight);const target=controls.target.clone().lerp(pose.target,weight);controls.target.copy(target);camera.lookAt(target);st.hasFirstCam=true;
}
function setCameraSelect(value){const modes=['free','front','back','side','close','top','game','lock','arena'];if(!modes.includes(value))value='free';st.camera=value;$('lab-camera').value=value;$('lab-quick-camera').value=value;st.dirtyCam=true;st.hasFirstCam=false;controls.enabled=value==='free';if(value!=='free')setCamera(value,true);else controls.update()}
function setupCompare(){st.compare=check('lab-compare-button')||false;}
function setCompare(enabled){st.compare=!!enabled;$('lab-compare-button').setAttribute('aria-pressed',String(st.compare));$('lab-compare-button').textContent=st.compare?'▣ Comparando':'▥ Comparar';document.querySelector('.stage').classList.toggle('comparing',st.compare)}
function compareLabels(){let kind=st.compareType;let names=window.__studioCompare?.labels?.(kind)||(kind==='motion'?['Movimento original','Movimento no lugar']:kind==='camera'?['Câmera Studio','Câmera do jogo']:['Material original','Cor sólida']);$('lab-compare-left-label').textContent=names[0];$('lab-compare-right-label').textContent=names[1]}
function setClipTime(t){E.seek(t);originalFromMixer();updateTime()}
function applyLoop(){const action=E.selectedAction;if(action){action.setLoop(check('lab-loop')?T.LoopRepeat:T.LoopOnce,check('lab-loop')?Infinity:0);action.clampWhenFinished=!check('lab-loop');action.timeScale=read('lab-speed',1)}}
function updateTime(){const clip=E.selectedClip,act=E.selectedAction;const d=clip?.duration||0,time=clamp(act?.time||0,0,d);const format=s=>{let m=Math.floor(s/60),v=(s%60).toFixed(2).padStart(5,'0');return String(m).padStart(2,'0')+':'+v};$('lab-time').textContent=format(time)+' / '+format(d);$('lab-scrub').max=d||1;if(document.activeElement!==$('lab-scrub'))$('lab-scrub').value=time}
function togglePreview(){const on=st.camera==='game'||st.camera==='lock'&&check('lab-grid');$('lab-preset').classList.toggle('active',on)}
function serialize(){return {schemaVersion:1,ground:{visible:check('lab-grid'),floor:check('lab-floor'),axes:check('lab-axes'),size:read('lab-grid-size'),divisions:read('lab-grid-div'),x:read('lab-grid-x'),y:read('lab-grid-y'),z:read('lab-grid-z'),rotationY:read('lab-grid-yaw'),opacity:read('lab-floor-opacity')},motion:{mode:st.rootMode,path:check('lab-trajectory'),feet:check('lab-feet'),loop:check('lab-loop'),speed:read('lab-speed',1)},view:{camera:st.camera,distance:read('lab-cam-distance'),height:read('lab-cam-height'),shoulder:read('lab-cam-shoulder'),smoothing:read('lab-cam-smooth'),dummy:check('lab-dummy'),dummyX:read('lab-dummy-x'),dummyY:read('lab-dummy-y'),dummyZ:read('lab-dummy-z'),compare:st.compare,compareType:st.compareType}}}
function restore(data){if(!data||typeof data!=='object')return;
 const g=data.ground||{},m=data.motion||{},v=data.view||{};
 for(let [id,x] of [['lab-grid',g.visible],['lab-floor',g.floor],['lab-axes',g.axes],['lab-trajectory',m.path],['lab-feet',m.feet],['lab-loop',m.loop],['lab-dummy',v.dummy]])if(typeof x==='boolean')$(id).checked=x;
 for(let [id,x] of [['lab-grid-size',g.size],['lab-grid-div',g.divisions],['lab-grid-x',g.x],['lab-grid-y',g.y],['lab-grid-z',g.z],['lab-grid-yaw',g.rotationY],['lab-floor-opacity',g.opacity],['lab-cam-distance',v.distance],['lab-cam-height',v.height],['lab-cam-shoulder',v.shoulder],['lab-cam-smooth',v.smoothing],['lab-dummy-x',v.dummyX],['lab-dummy-y',v.dummyY],['lab-dummy-z',v.dummyZ]])if(Number.isFinite(x))$(id).value=x;
 if(['original','fixed','rotation'].includes(m.mode))st.rootMode=$('lab-root-mode').value=m.mode;
 if([.25,.5,1,1.5,2].includes(m.speed))$('lab-speed').value=String(m.speed);
 if(['motion','camera','materials','clips','original'].includes(v.compareType))st.compareType=$('lab-compare-type').value=v.compareType;
 setCompare(!!v.compare);setCameraSelect(v.camera||'free');st.gridSize=-1;updateScene();applyLoop();updatePath();compareLabels();
}
function onModelInstalled(saved){$('lab-compare-button').disabled=false;frameModel();restore(saved||st.storedPreview);st.storedPreview=null;st.lastIdx=-1;findCurrentClip();originalFromMixer();updateTime();}
function onClipsChanged(){st.lastIdx=-1;findCurrentClip();updateTime()}
let elapsedUi=0;
function onTick(dt){
 if(E.model){if(st.lastIdx!==E.selectedIndex)findCurrentClip();originalFromMixer()}
 setCamera(st.camera,false,dt);
 updateScene();
 if(E.model)footTick(dt);
 if((elapsedUi+=dt)>.08){elapsedUi=0;updateTime()}
}
function presetOn(){
 $('lab-grid').checked=true;$('lab-floor').checked=true;$('lab-axes').checked=false;$('lab-root-mode').value='rotation';st.rootMode='rotation';
 $('textures').checked=true;$('lighting').checked=true;$('textures').dispatchEvent(new Event('change'));
 $('lab-dummy').checked=true;setCameraSelect('game');setCompare(false);updateScene();$('lab-preset').classList.add('active')
}
function compareRender(dt){if(!st.compare||!st.ready)return false;
 if(window.__studioCompare?.handles(st.compareType))return window.__studioCompare.render(dt);
 let dw=new T.Vector2();renderer.getDrawingBufferSize(dw);const W=Math.max(1,Math.round(dw.x)),H=Math.max(1,Math.round(dw.y)),half=Math.floor(W/2);if(!half)return false;
 renderer.setScissorTest(true);
 const oldAspect=camera.aspect;const oldOver=scene.overrideMaterial;
 const doPass=(left,cam,override)=>{
   const x=left?0:half,w=left?half:W-half;
   renderer.setViewport(x,0,w,H);renderer.setScissor(x,0,w,H);
   cam.aspect=w/H;cam.updateProjectionMatrix();scene.overrideMaterial=override||null;renderer.render(scene,cam)
 };
 try{
  if(st.compareType==='motion'){
   restoreRoot();doPass(true,camera,null);if(st.origRoot)applyRoot('rotation',st.origRoot);E.model.updateMatrixWorld(true);doPass(false,camera,null)
  }else if(st.compareType==='materials'){
   doPass(true,camera,null);doPass(false,camera,flatMaterial)
  }else{
   // Camera comparison: left tracks the free orbital camera, right reproduces Arenamon game view.
   cmpCamera.copy(camera);let pose=cameraPose('game');if(pose){cmpCamera.position.copy(pose.pos);cmpCamera.lookAt(pose.target)}
   doPass(true,camera,null);doPass(false,cmpCamera,null)
  }
 }finally{scene.overrideMaterial=oldOver;restoreRoot();if(st.origRoot)applyRoot(st.rootMode,st.origRoot);E.model.updateMatrixWorld(true);renderer.setScissorTest(false);renderer.setViewport(0,0,W,H);camera.aspect=oldAspect;camera.updateProjectionMatrix()}
 return true
}

for(let id of ['lab-grid','lab-floor','lab-axes','lab-grid-size','lab-grid-div','lab-grid-x','lab-grid-y','lab-grid-z','lab-grid-yaw','lab-floor-opacity','lab-dummy','lab-dummy-x','lab-dummy-y','lab-dummy-z','lab-feet','lab-trajectory'])$(id).addEventListener('input',()=>{updateScene();if(['lab-grid-y','lab-grid-x','lab-grid-z','lab-trajectory'].includes(id))updatePath()});
$('lab-grid-feet').onclick=()=>{fitGrid()};$('lab-grid-center').onclick=centerGrid;$('lab-grid-reset').onclick=()=>{for(let [id,value] of [['lab-grid-size','20'],['lab-grid-div','20'],['lab-grid-x','0'],['lab-grid-y','0'],['lab-grid-z','0'],['lab-grid-yaw','0'],['lab-floor-opacity','.24']])$(id).value=value;st.gridSize=-1;updateScene();updatePath()};
$('lab-root-mode').onchange=()=>{st.rootMode=$('lab-root-mode').value;originalFromMixer()};
$('lab-camera').onchange=()=>setCameraSelect($('lab-camera').value);$('lab-quick-camera').onchange=()=>setCameraSelect($('lab-quick-camera').value);
for(let id of ['lab-cam-distance','lab-cam-height','lab-cam-shoulder','lab-cam-smooth'])$(id).addEventListener('input',()=>{if(st.camera!=='free')setCamera(st.camera,true)});
$('lab-quick-grid').onclick=()=>{$('lab-grid').checked=!check('lab-grid');updateScene()};
$('lab-compare-button').onclick=()=>setCompare(!st.compare);$('lab-compare-type').onchange=()=>{st.compareType=$('lab-compare-type').value;compareLabels()};
$('lab-preset').onclick=presetOn;
$('lab-speed').onchange=applyLoop;$('lab-loop').onchange=applyLoop;
$('lab-prev-frame').onclick=()=>{E.setPlaying(false);setClipTime((E.selectedAction?.time||0)-(window.__studioEditor?.frameStep?.()||1/30))};
$('lab-next-frame').onclick=()=>{E.setPlaying(false);setClipTime((E.selectedAction?.time||0)+(window.__studioEditor?.frameStep?.()||1/30))};
$('lab-scrub').addEventListener('input',()=>{E.setPlaying(false);setClipTime(Number($('lab-scrub').value)||0)});
$('clip').addEventListener('change',()=>{st.lastIdx=-1;findCurrentClip();applyLoop();updateTime()});
// Initialize only after DOM and engine; original importer remains the sole owner of FBX/GLB IO.
$('lab-compare-button').disabled=true;updateScene();compareLabels();
window.__studioV3={setCompare,compareLabels,get compare(){return st.compare},get compareType(){return st.compareType},get rootMode(){return st.rootMode},rootState:()=>({track:st.track,orig:st.origRoot}),onTick,render:compareRender,onModelInstalled,onClipsChanged,serialize,restore,frameModel,updatePath,applyRoot,setCameraSelect,selectedRoot:()=>st.track};
})();
