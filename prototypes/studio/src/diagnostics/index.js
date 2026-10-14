// Biblioteca de movimentos genéricos para DIAGNÓSTICO do rig.
import {ROLES, PRESETS, DEFAULT_PRESET, mappedBones, diagnosticReport, generateDiagnosticClip} from './presets.js';

const $=id=>document.getElementById(id),E=window.__importer;
const STATE={root:null,overrides:{},preset:DEFAULT_PRESET,intensity:.65,report:null,errors:[]};
const out=$('rg-diag-report');

$('rg-diag-preset').replaceChildren(...PRESETS.map(p=>new Option(p.name,p.id)));
$('rg-diag-preset').value=DEFAULT_PRESET;

const hasSkinned=()=>{
  let skinned=false;
  E.model?.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton?.bones?.length)skinned=true;});
  return skinned;
};
const status=(message,kind='normal')=>{out.textContent=message;out.dataset.status=kind;};
const optionLabel=b=>b.name+' · '+b.uuid.slice(0,8);
function makeMapper(role,bones,map) {
  const wrap=document.createElement('label');wrap.className='rg-field rg-diag-map-row';
  const name=document.createElement('span');name.textContent=role.label;
  const select=document.createElement('select');select.dataset.role=role.id;
  select.append(new Option('— Sem correspondência —',''));
  for(const b of bones)select.append(new Option(optionLabel(b),b.uuid));
  select.value=map[role.id]||'';
  select.onchange=()=>{
    STATE.overrides[role.id]=select.value||null;
    const analysis=mappedBones(E.model,STATE.overrides);
    // A associação de um osso a dois papéis nunca é aceita silenciosamente.
    if(select.value&&analysis.mapping[role.id]!==select.value){
      select.value='';STATE.overrides[role.id]=null;
      status('O mesmo osso não pode preencher dois papéis. Revise o mapeamento.', 'warn');
    }
    updateReport();
  };
  wrap.append(name,select);return wrap;
}
function renderMapping() {
  const root=E.model, target=$('rg-diag-map-list');
  target.replaceChildren();
  if(!root||!hasSkinned())return;
  const data=mappedBones(root,STATE.overrides);
  for(const role of ROLES)target.append(makeMapper(role,data.bones,data.mapping));
}
function updateReport() {
  const model=E.model,usable=!!model&&hasSkinned();
  $('rg-diag-add').disabled=$('rg-diag-preview').disabled=!usable;
  $('rg-diag-mapping').hidden=!usable;
  $('rg-diag-description').textContent=PRESETS.find(x=>x.id===STATE.preset)?.description||'';
  $('rg-diag-intensity-value').textContent=Math.round(STATE.intensity*100)+'%';
  if(!usable){
    STATE.report=null;
    status(model?'Ainda não há uma malha vinculada a ossos. Finalize o Rigging antes de gerar animações.':
      'Importe um personagem GLB/FBX com esqueleto e skinning para usar os movimentos.', 'warn');
    return;
  }
  try {
    const r=diagnosticReport(model,STATE.overrides,STATE.preset);
    STATE.report=r;
    const lines=[
      r.available.length+' articulações reconhecidas para '+r.preset.name+'.',
      r.missingRequired.length?'Sem correspondência: '+r.missingRequired.map(id=>
        ROLES.find(role=>role.id===id)?.label||id).join(' · '):'Nenhum papel necessário faltando.',
      'Geraremos '+r.generatedTrackCount+' trilhas de rotação. Posição da raiz intacta.',
      ...(r.warnings.length?['Avisos:',...r.warnings.map(x=>'• '+x)]:[])
    ];
    status(lines.join('\n'),r.available.length?'normal':'warn');
    $('rg-diag-add').disabled=$('rg-diag-preview').disabled=!r.available.length;
  } catch(e){STATE.report=null;status('Falha na análise: '+e.message,'warn');}
}
function reload() {
  const model=E.model;
  if(model!==STATE.root){STATE.root=model;STATE.overrides={};}
  renderMapping();updateReport();
}
function produce(preview=false) {
  if(!E.model||!hasSkinned())return updateReport();
  try {
    // O teste temporário de dobra é reversível. Nunca usar a pose de flexão como ponto inicial.
    if($('rg-pose-reset'))$('rg-pose-reset').click();
    E.enterRigRest();
    const {clip,report}=generateDiagnosticClip(E.model,STATE.overrides,STATE.preset,STATE.intensity);
    const before=E.clips.length;
    const index=E.addClip(clip,{select:true});
    if(E.clips.length!==before+1)throw Error('Não foi possível adicionar o clipe.');
    window.__studioProject?.markDirty('adicionar animação genérica de diagnóstico');
    status('Clipe criado: '+clip.name+'. '+clip.tracks.length+
      ' trilhas reais. '+(report.missingRequired.length?
        'Verifique as articulações ausentes no mapeamento.':'Mapeamento completo para este teste.')+
      '\nTeste de deformação: não é animação aprovada para gameplay.', 'ok');
    if(preview){
      window.__studioLayout?.open('project');
      window.__studioLayout?.setLibrary(true);
      // Rigging pausa a prévia ao sair e restaura o estado anterior.
      // Iniciar o playback DEPOIS que o evento de saída da aba foi processado.
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        E.selectIndex(index);E.setPlaying(true);
      }));
    } else E.setPlaying(false);
    return clip;
  } catch(e){console.error('Gerar animação diagnóstica:',e);status('Não foi possível criar o movimento: '+e.message,'warn');return null;}
}
$('rg-diag-preset').onchange=()=>{
  STATE.preset=$('rg-diag-preset').value;updateReport();
};
$('rg-diag-intensity').oninput=()=>{
  STATE.intensity=Number($('rg-diag-intensity').value);updateReport();
};
$('rg-diag-reset-map').onclick=()=>{
  STATE.overrides={};renderMapping();updateReport();
};
$('rg-diag-add').onclick=()=>produce(false);
$('rg-diag-preview').onclick=()=>produce(true);
E.on('installed',reload);
E.on('rigChanged',()=>{if(STATE.root!==E.model)reload();else updateReport();});
E.on('clipsChanged',()=>{if(E.model)updateReport();});
reload();
window.__studioDiagnostics={
  presets:PRESETS.map(p=>({...p})),roles:ROLES.map(r=>({id:r.id,label:r.label})),
  get currentReport(){return STATE.report;},
  get mapping(){return E.model?mappedBones(E.model,STATE.overrides).mapping:{};},
  setOverride(role,uuid){
    if(!ROLES.some(r=>r.id===role))throw Error('Papel desconhecido: '+role);
    STATE.overrides[role]=uuid||null;renderMapping();updateReport();
  },
  generate:(preset=STATE.preset,intensity=STATE.intensity)=>{
    const was=STATE.preset;STATE.preset=preset;
    try{
      if(E.model)E.enterRigRest();
      return generateDiagnosticClip(E.model,STATE.overrides,preset,intensity);
    } finally {STATE.preset=was;}
  },
  add:()=>produce(false),
  preview:()=>produce(true),
  refresh:reload
};
