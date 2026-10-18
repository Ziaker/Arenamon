// Studio V4 · inspeção, favoritos, A–B e marcadores (extraído do HTML v6).
// Mantido o mais próximo possível do original; alterações estão marcadas com "Fase 1".
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const E=window.__importer, V3=window.__studioV3, Org=window.__arenamonOrganization;
if(!E||!V3||!Org){console.error('Studio V4: importador ou módulo V3 indisponível');return}
const T=E.T,scene=E.scene,camera=E.camera,controls=E.controls,renderer=E.renderer;
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const state={skeleton:null,bounds:null,meshes:[],originalVisibility:[],favorites:new Set(),onlyFavorites:false,sort:'original',ab:{},markers:{},cameraSlots:[null,null,null],backgroundOriginal:scene.background,refreshBusy:false,lastClip:-1,lastModel:null,lastRender:0,viewSettings:{},clipNames:[]};
const previewUpdate=()=>{const selected=$('v4-mesh').value;state.meshes.forEach((m,i)=>{m.visible=selected==='all'?state.originalVisibility[i]:selected===String(i)&&state.originalVisibility[i]})};
function toast(msg){const e=$('toast');if(!e)return; e.textContent=msg;e.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>e.classList.remove('show'),2700)}
function status(msg){const e=$('v4-stage-status');e.hidden=false;e.textContent=msg;clearTimeout(state.stageTimer);state.stageTimer=setTimeout(()=>e.hidden=true,2400)}
function safeName(value){return String(value||'').slice(0,85)}
function onSceneLoaded(){
 if(state.skeleton){scene.remove(state.skeleton);state.skeleton.geometry?.dispose();state.skeleton.material?.dispose();state.skeleton=null}
 if(state.bounds){scene.remove(state.bounds);state.bounds.geometry?.dispose();state.bounds.material?.dispose();state.bounds=null}
 state.meshes=[];state.originalVisibility=[];
 if(!E.model)return;
 E.model.traverse(obj=>{if(obj.isMesh){state.meshes.push(obj);state.originalVisibility.push(obj.visible)}});
 const select=$('v4-mesh');select.replaceChildren(new Option('Todas as malhas','all'));
 state.meshes.forEach((mesh,i)=>select.add(new Option((i+1)+'. '+safeName(mesh.name||mesh.type||'Malha'),String(i))));
 try{state.skeleton=new T.SkeletonHelper(E.model);state.skeleton.name='Studio V4 · Esqueleto (preview)';state.skeleton.material.depthTest=false;state.skeleton.material.transparent=true;state.skeleton.material.opacity=.9;state.skeleton.visible=$('v4-skeleton').checked;state.skeleton.frustumCulled=false;scene.add(state.skeleton)}catch(e){console.warn('SkeletonHelper:',e)}
 try{state.bounds=new T.Box3Helper(new T.Box3().setFromObject(E.model),0x66ddee);state.bounds.name='Studio V4 · Volume (preview)';state.bounds.visible=$('v4-bounds').checked;state.bounds.frustumCulled=false;scene.add(state.bounds)}catch(e){console.warn('Box3Helper:',e)}
 applyWireframe();previewUpdate();renderMetadata();updateClipOptions();
}
function applyWireframe(){if(!E.model)return;const value=$('v4-wireframe').checked;E.model.traverse(mesh=>{if(mesh.isMesh)for(const m of [].concat(mesh.material||[]))if(m&&'wireframe' in m){m.wireframe=value;m.needsUpdate=true}})}
function updateBounds(){if(state.bounds&&state.bounds.visible&&E.model){E.model.updateMatrixWorld(true);state.bounds.box.setFromObject(E.model)}}
function setBackground(){if($('v4-background-on').checked)scene.background=new T.Color($('v4-background').value);else scene.background=state.backgroundOriginal}
function setFov(value){camera.fov=clamp(Number(value)||40,20,100);camera.updateProjectionMatrix();$('v4-fov-val').textContent=camera.fov+'°'}
function setOrbit(){const on=$('v4-orbit').checked;controls.autoRotate=on;controls.autoRotateSpeed=clamp(Number($('v4-orbit-speed').value)||1.5,.1,6);if(on){V3.setCameraSelect('free');status('Câmera livre em órbita automática')}}
function bookmark(index,save){
 if(save){state.cameraSlots[index]={position:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov};window.__studioProject?.markDirty('câmera salva');status('Câmera '+(index+1)+' salva');toast('Posição da câmera salva no slot '+(index+1))}
 else {const data=state.cameraSlots[index];if(!data)return toast('Nenhuma câmera salva no slot '+(index+1));V3.setCameraSelect('free');camera.position.fromArray(data.position);controls.target.fromArray(data.target);setFov(data.fov);$('v4-fov').value=String(data.fov);controls.update();status('Câmera '+(index+1)+' restaurada')}
 renderCameraSlots()
}
function renderCameraSlots(){const e=$('v4-camera-slots');e.replaceChildren();for(let i=0;i<3;i++){
 const box=document.createElement('div');box.style.display='grid';box.style.gap='5px';
 let a=document.createElement('button');a.className='btn btn-mini';a.textContent='⊕ Salvar '+(i+1);a.title='Salvar posição, alvo e FOV da câmera '+(i+1);a.onclick=()=>bookmark(i,true);
 let b=document.createElement('button');b.className='btn btn-mini';b.textContent='↗ Abrir '+(i+1);b.disabled=!state.cameraSlots[i];b.title='Restaurar câmera '+(i+1);b.onclick=()=>bookmark(i,false);
 box.append(a,b);e.append(box)
}}
function getSelected(){return E.selectedIndex}
function clipEntry(dict,index){return dict[String(index)]||null}
function setSelectedClip(index){if(!E.clips[index])return;$('clip').value=String(index);$('clip').dispatchEvent(new Event('change',{bubbles:true}));renderMetadata();updateAB();renderMarkers();updateClipOptions()}
function renderMetadata(){const el=$('v4-metadata'),c=E.selectedClip;if(!c){el.textContent='Nenhuma animação selecionada.';return}
 const tracks=c.tracks||[],keys=tracks.reduce((acc,t)=>acc+(t.times?.length||0),0),nodes=new Set(tracks.map(t=>t.name.split('.')[0]));let bones=0,meshes=0;E.model?.traverse(o=>{if(o.isBone)bones++;if(o.isMesh)meshes++});const channels={pos:0,rot:0,scale:0,other:0};tracks.forEach(t=>{const k=t.name.split('.').at(-1);if(k==='position')channels.pos++;else if(k==='quaternion')channels.rot++;else if(k==='scale')channels.scale++;else channels.other++});
 const src=c.sourceFile||c.name;el.textContent=`Arquivo: ${safeName(src)}\nClipe: ${safeName(c.name)}\nDuração: ${(c.duration||0).toFixed(3)} s\nTrilhas animadas: ${tracks.length}\nKeyframes totais: ${keys}\nNós animados: ${nodes.size}\nCanais: ${channels.pos} posição · ${channels.rot} rotação · ${channels.scale} escala\nRig: ${bones} ossos · ${meshes} malhas`;
}
function decorateLibrary(){
 const parent=$('clip-library');if(!parent)return;
 const wrappers=[...parent.children].filter(x=>x.querySelector('.clip-card[data-clip]'));
 for(const wrap of wrappers){const card=wrap.querySelector('.clip-card[data-clip]'),i=Number(card.dataset.clip);if(!card.querySelector('.v4-fav')){
  const btn=document.createElement('button');btn.className='v4-fav';btn.type='button';btn.title='Marcar/desmarcar como favorita';btn.setAttribute('aria-label','Favoritar '+safeName(E.clips[i]?.name));btn.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();state.favorites.has(i)?state.favorites.delete(i):state.favorites.add(i);decorateLibrary();window.__studioProject?.markDirty('favoritos')});card.append(btn)
 }
 const star=card.querySelector('.v4-fav');star.textContent=state.favorites.has(i)?'★':'☆';star.setAttribute('aria-pressed',String(state.favorites.has(i)));
 wrap.hidden=!!$('v4-only-favorites').checked&&!state.favorites.has(i)
 }
 const sorting=$('v4-clip-sort').value;
 const list=wrappers.map(w=>({w,i:Number(w.querySelector('.clip-card').dataset.clip)}));
 list.sort((a,b)=>{
  const x=E.clips[a.i],y=E.clips[b.i];if(sorting==='name')return x.name.localeCompare(y.name,'pt')||a.i-b.i;
  if(sorting==='duration')return (y.duration||0)-(x.duration||0)||a.i-b.i;
  if(sorting==='favorites')return Number(state.favorites.has(b.i))-Number(state.favorites.has(a.i))||a.i-b.i;
  return a.i-b.i
 });
 const oldOrder=wrappers.map(w=>Number(w.querySelector('.clip-card').dataset.clip)).join(',');const newOrder=list.map(x=>x.i).join(',');
 if(oldOrder!==newOrder)for(const {w} of list)parent.append(w);
 const msg=$('v4-library-empty');if(msg)msg.hidden=!list.length||list.some(({i})=>!$('v4-only-favorites').checked||state.favorites.has(i));
}
function updateClipOptions(){renderMetadata();updateAB();renderMarkers()}
function currentTime(){return E.selectedAction?.time||0}
function pause(){E.setPlaying(false)}
function seek(t){E.seek(t);}
function currentAB(){return clipEntry(state.ab,getSelected())||{a:null,b:null}}
function updateAB(){const x=currentAB(),on=$('v4-ab-on');on.checked=!!x.active;const n=a=>a==null?'—':a.toFixed(2)+'s';$('v4-ab-label').textContent='A: '+n(x.a)+' · B: '+n(x.b);const d=E.selectedClip?.duration||0;const scrub=$('lab-scrub');if(x.active&&Number.isFinite(x.a)&&Number.isFinite(x.b)&&d>0){const a=clamp(100*x.a/d,0,100),b=clamp(100*x.b/d,0,100);scrub.style.background=`linear-gradient(90deg, #294363 ${a}%, #62c8be ${a}%, #62c8be ${b}%, #294363 ${b}%)`}else scrub.style.background=''}
function setAB(point){const i=getSelected(),clip=E.selectedClip;if(!clip)return toast('Selecione uma animação');let x=state.ab[i]||{a:null,b:null,active:false};const t=clamp(currentTime(),0,clip.duration||0);
 if(point==='a'){x.a=t;if(x.b!=null&&x.b<=x.a)x.b=null}
 if(point==='b'){if(x.a==null){toast('Defina o início A primeiro');return}if(t<=x.a+.001){toast('B deve estar depois de A');return}x.b=t}
 state.ab[i]=x;updateAB();window.__studioProject?.markDirty('loop A–B');status(point.toUpperCase()+' marcado em '+t.toFixed(2)+'s')}
function renderMarkers(){const el=$('v4-markers');el.replaceChildren();const rows=clipEntry(state.markers,getSelected())||[];
 if(!rows.length){const text=document.createElement('span');text.className='v4-loop-note';text.textContent='Sem marcadores';el.append(text);return}
 for(const m of rows){const row=document.createElement('span');row.className='v4-marker';const goto=document.createElement('button');goto.type='button';goto.className='v4-marker-jump';goto.textContent='◇ '+m.time.toFixed(2)+'s · '+m.name;goto.title='Ir para este momento';goto.onclick=()=>{pause();seek(m.time);status('Pose: '+m.name)};
 const del=document.createElement('button');del.type='button';del.className='v4-marker-delete';del.textContent='×';del.title='Excluir marcador';del.onclick=()=>{state.markers[getSelected()]=rows.filter(x=>x!==m);renderMarkers();window.__studioProject?.markDirty('marcador')};row.append(goto,del);el.append(row)}
}
function addMarker(){const c=E.selectedClip;if(!c)return toast('Selecione uma animação para marcar');const key=getSelected();const rows=state.markers[key]||[];const t=clamp(currentTime(),0,c.duration||0),name=$('v4-marker-name').value.trim()||'Pose '+(rows.length+1);
 rows.push({time:t,name:safeName(name)});rows.sort((a,b)=>a.time-b.time);state.markers[key]=rows;$('v4-marker-name').value='';renderMarkers();window.__studioProject?.markDirty('marcador');status('Marcador: '+name)}
function screenshot(){if(!E.model)return toast('Importe um personagem primeiro');try{const r=E.renderer,canvas=r.domElement;if(!canvas.width||!canvas.height)throw Error('Canvas sem tamanho');
 if(!V3.render?.(0))r.render(E.scene,E.camera);const data=canvas.toDataURL('image/png');if(data.length<200)throw Error('Imagem PNG vazia');const a=document.createElement('a');const name=(E.selectedClip?.sourceFile||'arenamon').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]/g,'_');a.download='arenamon-'+name+'-pose.png';a.href=data;a.click();toast('Captura PNG salva');
 }catch(error){console.warn(error);toast('Falha na captura PNG: '+error.message)}}
function focusMode(){window.__studioLayout?.toggleZen?.()}
function serialize(){return {version:1,inspect:{skeleton:$('v4-skeleton').checked,wireframe:$('v4-wireframe').checked,bounds:$('v4-bounds').checked,mesh:$('v4-mesh').value,backgroundOn:$('v4-background-on').checked,background:$('v4-background').value,fov:Number($('v4-fov').value),autoOrbit:$('v4-orbit').checked,orbitSpeed:Number($('v4-orbit-speed').value)},library:{favorites:[...state.favorites],sort:$('v4-clip-sort').value,onlyFavorites:$('v4-only-favorites').checked},ab:state.ab,markers:state.markers,cameraSlots:state.cameraSlots}}
function restore(obj){if(!obj||typeof obj!=='object')return;
 const i=obj.inspect||{},l=obj.library||{};for(let [id,val] of [['v4-skeleton',i.skeleton],['v4-wireframe',i.wireframe],['v4-bounds',i.bounds],['v4-background-on',i.backgroundOn],['v4-orbit',i.autoOrbit],['v4-only-favorites',l.onlyFavorites]])if(typeof val==='boolean')$(id).checked=val;
 if(/^#[0-9a-fA-F]{6}$/.test(i.background||''))$('v4-background').value=i.background;
 for(let [id,val] of [['v4-fov',i.fov],['v4-orbit-speed',i.orbitSpeed]])if(Number.isFinite(val))$(id).value=String(val);
 if(['original','name','duration','favorites'].includes(l.sort))$('v4-clip-sort').value=l.sort;
 if(Array.isArray(l.favorites))state.favorites=new Set(l.favorites.filter(n=>Number.isInteger(n)&&n>=0&&n<E.clips.length));
 const cleanAB={};for(let [idx,x] of Object.entries(obj.ab||{})){const j=+idx;if(!Number.isInteger(j)||j<0||j>=E.clips.length||!x)continue;const d=E.clips[j].duration;if(Number.isFinite(x.a)&&Number.isFinite(x.b)&&x.b>x.a&&x.a>=0&&x.b<=d+.02)cleanAB[j]={a:x.a,b:x.b,active:!!x.active};else if(Number.isFinite(x.a)&&x.a>=0&&x.a<=d)cleanAB[j]={a:x.a,b:null,active:false}}
 state.ab=cleanAB;
 const cleanMarkers={};for(let [idx,arr] of Object.entries(obj.markers||{})){const j=+idx;if(!Number.isInteger(j)||j<0||j>=E.clips.length||!Array.isArray(arr))continue;cleanMarkers[j]=arr.filter(x=>Number.isFinite(x.time)&&x.time>=0&&x.time<=E.clips[j].duration+.001).slice(0,300).map(x=>({time:x.time,name:safeName(x.name)}))}state.markers=cleanMarkers;
 if(Array.isArray(obj.cameraSlots))state.cameraSlots=Array.from({length:3},(_,j)=>{const c=obj.cameraSlots[j];return c&&Array.isArray(c.position)&&c.position.length===3&&c.position.every(Number.isFinite)&&Array.isArray(c.target)&&c.target.length===3&&c.target.every(Number.isFinite)&&Number.isFinite(c.fov)?{position:c.position,target:c.target,fov:clamp(c.fov,20,100)}:null});
 setFov($('v4-fov').value);setBackground();setOrbit();if(state.skeleton)state.skeleton.visible=$('v4-skeleton').checked;if(state.bounds)state.bounds.visible=$('v4-bounds').checked;
 if(state.meshes.length&&state.meshes[Number(i.mesh)])$('v4-mesh').value=i.mesh;else $('v4-mesh').value='all';previewUpdate();applyWireframe();renderCameraSlots();updateClipOptions();decorateLibrary();
}
function afterModel(saved){onSceneLoaded();if(saved?.studioV4)restore(saved.studioV4);else if(!saved){state.favorites.clear();state.markers={};state.ab={};updateClipOptions();decorateLibrary()}}
// Wrap the v3 extension hooks used by the original importer (including GLB export manifest).
const origSerialize=V3.serialize,origRestore=V3.restore,origInstall=V3.onModelInstalled,origChanged=V3.onClipsChanged,origTick=V3.onTick;
V3.serialize=()=>({...origSerialize(),studioV4:serialize()});
V3.restore=data=>{origRestore(data);if(data?.studioV4)restore(data.studioV4)};
V3.onModelInstalled=saved=>{origInstall(saved);afterModel(saved)};
V3.onClipsChanged=()=>{origChanged();updateClipOptions();decorateLibrary()};
let accum=0;
V3.onTick=dt=>{origTick(dt);const idx=getSelected();if(idx!==state.lastClip){state.lastClip=idx;updateClipOptions();decorateLibrary()}
 if(E.playing){const ab=currentAB();if(ab.active&&Number.isFinite(ab.a)&&Number.isFinite(ab.b)&&ab.b>ab.a&&currentTime()>=ab.b){seek(ab.a)}}
 if((accum+=Math.max(0,dt))>.15){accum=0;updateBounds()}
};
for(let id of ['v4-skeleton','v4-bounds'])$(id).addEventListener('change',()=>{if(id==='v4-skeleton'&&state.skeleton)state.skeleton.visible=$(id).checked;if(id==='v4-bounds'&&state.bounds)state.bounds.visible=$(id).checked});
$('v4-wireframe').addEventListener('change',applyWireframe);
for(const id of ['textures','lighting','palette','color'])$(id).addEventListener('change',()=>setTimeout(applyWireframe,0));
$('v4-mesh').addEventListener('change',previewUpdate);
for(const id of ['v4-background-on','v4-background'])$(id).addEventListener('input',setBackground);
$('v4-fov').addEventListener('input',()=>setFov($('v4-fov').value));
for(const id of ['v4-orbit','v4-orbit-speed'])$(id).addEventListener('input',setOrbit);
for(const id of ['v4-clip-sort','v4-only-favorites'])$(id).addEventListener('change',decorateLibrary);
new MutationObserver(()=>queueMicrotask(decorateLibrary)).observe($('clip-library'),{childList:true,subtree:false});
$('clip').addEventListener('change',()=>{state.lastClip=-1;updateClipOptions()});
$('v4-ab-on').addEventListener('change',()=>{const i=getSelected();const ab=state.ab[i]||{a:null,b:null,active:false};if($('v4-ab-on').checked&&!(Number.isFinite(ab.a)&&Number.isFinite(ab.b)&&ab.b>ab.a)){toast('Marque A e B antes de ativar o loop');$('v4-ab-on').checked=false;return}ab.active=$('v4-ab-on').checked;state.ab[i]=ab;updateAB();window.__studioProject?.markDirty('loop A–B')});
$('v4-ab-a').onclick=()=>setAB('a');$('v4-ab-b').onclick=()=>setAB('b');$('v4-ab-clear').onclick=()=>{delete state.ab[getSelected()];updateAB();window.__studioProject?.markDirty('loop A–B')};
$('v4-marker-add').onclick=addMarker;$('v4-marker-name').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addMarker()}});
$('v4-screenshot').onclick=screenshot;$('v4-focus').onclick=focusMode;
window.addEventListener('keydown',e=>{if(window.__studioLayout?.zen)return;const a=document.activeElement;if(a&&['INPUT','SELECT','TEXTAREA'].includes(a.tagName))return;if(e.ctrlKey||e.metaKey||e.altKey)return;
 if(!E.model)return;
 if(e.code==='Space'){e.preventDefault();$('play').click()}
 else if(e.code==='ArrowLeft'||e.code==='ArrowRight'){e.preventDefault();pause();const step=window.__studioEditor?.frameStep?.()||1/30;seek(clamp(currentTime()+(e.code==='ArrowLeft'?-1:1)*step,0,E.selectedClip?.duration||0))}
 else if((e.key==='f'||e.key==='F')&&e.shiftKey){e.preventDefault();$('frame').click()}
});
renderCameraSlots();setFov($('v4-fov').value);setBackground();updateClipOptions();
// Fase 1: favoritos, A–B e marcadores são indexados por posição; remover um clipe derivado desloca os índices.
function onClipRemoved(index){const shift=obj=>{const out={};for(const [k,v] of Object.entries(obj)){const j=+k;if(j<index)out[j]=v;else if(j>index)out[j-1]=v}return out};state.favorites=new Set([...state.favorites].filter(i=>i!==index).map(i=>i>index?i-1:i));state.ab=shift(state.ab);state.markers=shift(state.markers);state.lastClip=-1}
window.__studioV4={onClipRemoved,markers:()=>state.markers,restore,updateClipOptions,onSceneLoaded,decorateLibrary,renderMetadata,bookmark,seek,addMarker,getFavorites:()=>new Set(state.favorites),toggleFavorite:(i)=>{state.favorites.has(i)?state.favorites.delete(i):state.favorites.add(i);decorateLibrary();window.__studioProject?.markDirty('favoritos')}};
})();
