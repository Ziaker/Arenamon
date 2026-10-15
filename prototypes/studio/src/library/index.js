// Biblioteca legal de animações reais, separada dos oito diagnósticos procedurais.
import {CATALOG,SOURCE,categories} from './catalog.js';
import {BUNDLES} from './bundles.js';
import {ROLE_DEFS,analyzeMapping,createRetargetedClip} from './retarget.js';

const $=id=>document.getElementById(id),E=window.__importer;
const state={entry:CATALOG[0],category:'Todas',query:'',overrides:{},source:null,preview:null,bundles:new Map(),model:null};
const status=(text,kind='')=>{const o=$('al-status');o.textContent=text;o.dataset.kind=kind;};
async function fileFromUrl(url,name){const blob=await (await fetch(url)).blob();return new File([blob],name,{type:'model/gltf-binary'});}
async function loadBundle(rootMotion=false,{fresh=false}={}){
  const key=rootMotion?'rm':'inplace';if(!fresh&&state.bundles.has(key))return state.bundles.get(key);
  const task=fileFromUrl(rootMotion?BUNDLES.rootMotionUrl:BUNDLES.inPlaceUrl,rootMotion?'UAL1_Standard_RM.glb':'UAL1_Standard.glb').then(E.parse);
  if(!fresh)state.bundles.set(key,task);return task;
}
const selectedSourceClip=data=>{const c=data.animations.find(x=>x.name===state.entry.clip);if(!c)throw Error('Clipe não encontrado no pacote: '+state.entry.clip);return c;};
function renderList(){
  const q=state.query.trim().toLowerCase(),list=CATALOG.filter(x=>(state.category==='Todas'||x.category===state.category)&&(!q||(x.name+' '+x.clip+' '+x.description).toLowerCase().includes(q)));
  $('al-list').replaceChildren(...list.map(entry=>{const b=document.createElement('button');b.type='button';b.className='al-item'+(entry===state.entry?' active':'');
    b.dataset.entry=entry.id;b.innerHTML='<strong></strong><em></em><small></small>';b.querySelector('strong').textContent=entry.name;b.querySelector('em').textContent=entry.loop?'LOOP':'1×';
    b.querySelector('small').textContent=entry.category+' · '+entry.duration.toFixed(2)+' s';b.onclick=()=>{state.entry=entry;renderList();renderDetails();};return b;}));
  $('al-empty').hidden=!!list.length;
}
function renderDetails(){const x=state.entry;$('al-name').textContent=x.name;$('al-description').textContent=x.description;
  $('al-meta').innerHTML='<dt>Categoria</dt><dd></dd><dt>Fonte</dt><dd></dd><dt>Licença</dt><dd></dd><dt>Duração</dt><dd></dd><dt>Amostras</dt><dd></dd><dt>Loop</dt><dd></dd><dt>Root motion</dt><dd></dd><dt>Esqueleto</dt><dd></dd>';
  const vals=[x.category,SOURCE.name+' · '+SOURCE.version,SOURCE.license,x.duration.toFixed(3)+' s',x.frames+' @ '+SOURCE.fps+' FPS',x.loop?'Sim':'Não',x.rootMotionAvailable?'Disponível em variante separada':'Não',SOURCE.skeleton];
  [...$('al-meta').querySelectorAll('dd')].forEach((d,i)=>d.textContent=vals[i]);$('al-root').disabled=!x.rootMotionAvailable;updateCompatibility();}
function optionLabel(b){return (b.name||'(sem nome)')+' · '+b.uuid.slice(0,8);}
async function sourceData(){const data=await loadBundle(false);state.source=data.scene;return data;}
async function updateCompatibility(){
  if(!E.model){status('Importe um personagem rigado ou abra o projeto de demonstração.','warn');$('al-preview').disabled=$('al-add').disabled=true;$('al-mapping').hidden=true;return;}
  try{await sourceData();const r=analyzeMapping(state.source,E.model,state.overrides,state.entry.requirements);state.report=r;
    const lines=[r.compatible?'Compatível para este clipe.':'Incompatível para este clipe.',r.mapping.size+' / '+r.sourceBones.length+' bones associados ('+r.exact+' por nome exato).',
      r.missingRequired.length?'Papéis obrigatórios ausentes: '+r.missingRequired.join(', '):'Papéis obrigatórios presentes.',
      r.unmappedSource.length?'Bones de origem ignorados: '+r.unmappedSource.length+'.':'Todos os bones de origem associados.',...(r.duplicateNames.length?['Nomes duplicados no destino: '+r.duplicateNames.join(', ')]:[])];
    status(lines.join('\n'),r.compatible?'ok':'warn');$('al-preview').disabled=$('al-add').disabled=!r.compatible;$('al-mapping').hidden=false;renderMapping(r);
  }catch(e){console.error(e);status('Não foi possível analisar o rig: '+e.message,'warn');$('al-preview').disabled=$('al-add').disabled=true;}
}
function renderMapping(report){const box=$('al-map'),wanted=ROLE_DEFS.filter(r=>report.sourceRoles[r.id]);box.replaceChildren(...wanted.map(role=>{
  const label=document.createElement('label'),span=document.createElement('span'),select=document.createElement('select');span.textContent=role.label;select.dataset.role=role.id;select.append(new Option('Automático / sem correspondência',''));
  for(const b of report.targetBones)select.append(new Option(optionLabel(b),b.uuid));select.value=state.overrides[role.id]||'';select.onchange=()=>{state.overrides[role.id]=select.value||null;updateCompatibility();};label.append(span,select);return label;}));}
async function buildClip(){const useRoot=$('al-root').checked,data=await loadBundle(useRoot),sourceClip=selectedSourceClip(data);
  return createRetargetedClip({sourceRoot:data.scene,targetRoot:E.model,sourceClip,overrides:state.overrides,requiredRoles:state.entry.requirements,includeRootMotion:useRoot,fps:SOURCE.fps,name:'UAL · '+state.entry.name});}
function stopPreview(){if(!state.preview||!E.mixer)return;state.preview.stop();E.mixer.uncacheClip(state.preview.getClip());state.preview=null;}
async function preview(){try{stopPreview();E.enterRigRest();const {clip,report}=await buildClip(),a=E.mixer.clipAction(clip);a.reset();a.setLoop(state.entry.loop?E.T.LoopRepeat:E.T.LoopOnce,state.entry.loop?Infinity:1);a.clampWhenFinished=!state.entry.loop;a.play();state.preview=a;E.setPlaying(true);status('Prévia temporária: '+clip.name+' · '+clip.tracks.length+' trilhas · '+report.mapping.size+' bones. O projeto não foi alterado.','ok');}catch(e){console.error(e);status('Prévia recusada: '+e.message,'warn');}}
async function add(){try{stopPreview();E.enterRigRest();const {clip,report}=await buildClip();clip.userData.arenamonLibrary.entryId=state.entry.id;clip.userData.arenamonLibrary.category=state.entry.category;clip.userData.arenamonLibrary.loop=state.entry.loop;
    const command={label:'Adicionar “'+clip.name+'” da biblioteca CC0',clip,redo(){E.addClip(clip,{select:true});},undo(){E.removeClip(clip);}},history=window.__studioEditor?.history;if(history)history.run(command);else command.redo();
    window.__studioProject?.markDirty('adicionar animação CC0 da biblioteca');status('Adicionado ao projeto: '+clip.name+' · '+clip.tracks.length+' trilhas · '+report.mapping.size+' bones. Agora pode ser editado na timeline.','ok');
  }catch(e){console.error(e);status('Não foi possível adicionar: '+e.message,'warn');}}
async function demo(){try{if(!(await (window.__studioProject?.guardDiscard?.()??true)))return;status('Abrindo personagem e movimentos CC0…');const data=await loadBundle(false,{fresh:true}),ids=new Set(CATALOG.map(x=>x.clip)),clips=data.animations.filter(x=>ids.has(x.name));
    data.scene.userData.arenamonLibraryDemo={source:SOURCE.id,license:'CC0-1.0',url:SOURCE.url};await E.install(data.scene,clips,'Quaternius UAL1 v3 · demonstração CC0.glb');window.__studioProject?.markDirty('abrir demonstração CC0');status('Demonstração pronta: personagem legalmente redistribuível e '+clips.length+' animações reais.','ok');
  }catch(e){console.error(e);status('Falha ao abrir demonstração: '+e.message,'warn');}}
function resetForModel(){stopPreview();if(state.model!==E.model){state.model=E.model;state.overrides={};}updateCompatibility();}

$('al-category').replaceChildren(new Option('Todas as categorias','Todas'),...categories().map(x=>new Option(x,x)));$('al-category').onchange=()=>{state.category=$('al-category').value;renderList();};
$('al-search').oninput=()=>{state.query=$('al-search').value;renderList();};$('al-root').onchange=updateCompatibility;$('al-preview').onclick=preview;$('al-add').onclick=add;$('al-demo').onclick=demo;
$('al-reset-map').onclick=()=>{state.overrides={};updateCompatibility();};E.on('installed',resetForModel);E.on('rigChanged',resetForModel);
renderList();renderDetails();
window.__studioAnimationLibrary={catalog:CATALOG,source:SOURCE,get selected(){return state.entry;},get report(){return state.report;},select(id){const e=CATALOG.find(x=>x.id===id);if(!e)throw Error('Entrada desconhecida: '+id);state.entry=e;renderList();renderDetails();},setOverride(role,uuid){state.overrides[role]=uuid||null;return updateCompatibility();},analyze:updateCompatibility,build:buildClip,preview,add,demo};
