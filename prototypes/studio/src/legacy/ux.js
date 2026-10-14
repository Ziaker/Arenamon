// Studio V5/V6 · navegação, diálogos e painel redimensionável (extraído do HTML v6).
// Mantido o mais próximo possível do original; alterações estão marcadas com "Fase 1".
/* V5 usability layer. This controller only navigates existing V4 systems. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const steps=[...document.querySelectorAll('.workflow-step')];
const settings=$('studio-tools'), settingsBackdrop=$('settings-backdrop');
const exportDialog=$('studio-export'),exportBackdrop=$('export-backdrop');
const toolsButton=$('open-tools'),exportButton=$('open-export');
const pages=[...document.querySelectorAll('[data-tool-panel]')];
let current='import',lastFocus=null;
const isMobile=()=>matchMedia('(max-width:690px)').matches;
function announce(text){const el=$('guide-description');if(el&&text)el.textContent=text;}
function toolPage(name){
 for(const p of pages){const selected=p.dataset.toolPanel===name;p.classList.toggle('selected',selected);p.setAttribute('aria-selected',String(selected));}
 for(const n of ['visual','scene','camera','inspect'])$('tools-'+n).hidden=n!==name;
}
function showTools(tab='visual'){
 closeExport(false);toolPage(tab);lastFocus=document.activeElement;settings.hidden=false;settingsBackdrop.hidden=false;
 toolsButton.setAttribute('aria-expanded','true');document.body.classList.add('dialog-open');$('close-tools').focus();
}
function closeTools(focus=true){if(settings.hidden)return;settings.hidden=true;settingsBackdrop.hidden=true;toolsButton.setAttribute('aria-expanded','false');document.body.classList.remove('dialog-open');if(focus)(lastFocus||toolsButton).focus();}
function showExport(){
 closeTools(false);lastFocus=document.activeElement;exportDialog.hidden=false;exportBackdrop.hidden=false;
 document.body.classList.add('dialog-open');navigate('export',{scroll:false});$('close-export').focus();
}
function closeExport(focus=true){if(exportDialog.hidden)return;exportDialog.hidden=true;exportBackdrop.hidden=true;document.body.classList.remove('dialog-open');if(focus)(lastFocus||exportButton).focus();}
function navigate(name,{scroll=true}={}){
 if(name==='export'){for(const b of steps)b.classList.toggle('current',b.dataset.workflow==='export');current='export';return}
 current=name;for(const b of steps)b.classList.toggle('current',b.dataset.workflow===name);
 
 
 const target=name==='import'?document.querySelector('.rail'):name==='organize'?document.querySelector('.organizer'):document.querySelector('.stage');
 if(scroll&&target&&isMobile())target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});
}
steps.forEach(b=>b.addEventListener('click',()=>{if(b.dataset.workflow==='export')return showExport();navigate(b.dataset.workflow);if(b.dataset.workflow==='edit')window.__studioEditor?.openTool?.('trim')}));
toolsButton.addEventListener('click',()=>settings.hidden?showTools():closeTools());
$('close-tools').addEventListener('click',()=>closeTools());$('tools-done').addEventListener('click',()=>closeTools());settingsBackdrop.addEventListener('click',()=>closeTools());
exportButton.addEventListener('click',showExport);$('close-export').addEventListener('click',()=>closeExport());exportBackdrop.addEventListener('click',()=>closeExport());
pages.forEach(b=>b.addEventListener('click',()=>toolPage(b.dataset.toolPanel)));
$('simple-help').addEventListener('click',()=>{$('shortcut-help').click()});
$('view-game-preset').addEventListener('click',()=>{ $('lab-preset').click();$('view-game-preset').classList.add('is-active');});
function syncQuick(){
 for(const [input,btn] of [['textures','quick-textures'],['lighting','quick-lighting']]){
  const on=$(input).checked,b=$(btn);b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));b.querySelector('b').textContent=on?'ON':'OFF';
 }
}
for(const [input,btn] of [['textures','quick-textures'],['lighting','quick-lighting']]){
 $(btn).addEventListener('click',()=>{$(input).click();syncQuick()});$(input).addEventListener('change',syncQuick);
}
syncQuick();
function updateGuide(){
 const model=!!window.__importer?.model;
 const clips=window.__importer?.clips?.length||0;
 const title=$('guide-title');
 if(!model){title.textContent='Primeiro, importe um modelo';announce('Selecione um FBX ou GLB com esqueleto. Depois adicione suas animações.');}
 else if(!clips){title.textContent='Modelo pronto! Adicione animações';announce('Importe os FBX de movimento. Você poderá testar cada clipe no palco.');}
 else{title.textContent=clips===1?'1 animação disponível':clips+' animações disponíveis';announce('Clique ▶ para visualizar; arraste uma animação para a ação desejada à direita.');}
 const classifications=(window.__arenamonOrganization?.manifest?.()?.clips||[]).filter(c=>c.category).length;
 const done={import:model,preview:clips>0,organize:classifications>0};
 const play=$('play');if(play){if(!clips){play.disabled=true;play.textContent='▶ Reproduzir';}else if(play.disabled){play.disabled=false;play.textContent='❚❚ Pausar';}}
 steps.forEach(b=>{b.classList.toggle('complete',!!done[b.dataset.workflow]);const num=b.querySelector('.step-num');if(num&&b.dataset.workflow!=='export'&&b.dataset.workflow!=='edit')num.textContent=done[b.dataset.workflow]?'✓':{import:'1',preview:'2',organize:'3'}[b.dataset.workflow];});
}
const badge=$('model-badge');if(badge)new MutationObserver(updateGuide).observe(badge,{childList:true,characterData:true,subtree:true});
const clipSelect=$('clip');if(clipSelect)new MutationObserver(updateGuide).observe(clipSelect,{childList:true});
const assigned=$('clip-assigned');if(assigned)new MutationObserver(updateGuide).observe(assigned,{childList:true});
for(const id of ['model','animations'])$(id).addEventListener('change',()=>{
 updateGuide(); // The source parser runs asynchronously; badge/clip observers update again when ready.
});
$('welcome-import')?.setAttribute('title','Carregar personagem FBX ou GLB');
// Keep the menu small: clicking outside it closes the native disclosure without changing its controls.
document.addEventListener('click',e=>{const pop=document.querySelector('.view-more');if(pop?.open&&!pop.contains(e.target))pop.open=false;});
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'){if(!exportDialog.hidden){e.stopPropagation();closeExport();return}if(!settings.hidden){e.stopPropagation();closeTools();return}}
 // Focus containment only for the topmost custom dialog.
 if(e.key!=='Tab')return;const dlg=!exportDialog.hidden?exportDialog:!settings.hidden?settings:null;
 if(!dlg)return;const focusables=[...dlg.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')].filter(el=>el.getClientRects().length);
 if(!focusables.length)return;const first=focusables[0],last=focusables[focusables.length-1];
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
 else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
},true);
updateGuide();
window.__arenamonStudioUX={navigate,showTools,showExport,closeTools,closeExport};
})();

(()=>{
'use strict';
const grip=document.querySelector('.v6-resize'),expand=document.getElementById('v6-wide-toggle');if(!grip||!expand)return;
const root=document.documentElement;
let width=560,drag=false,raf=0;
const limits=()=>({min:400,max:Math.max(400,Math.min(830,innerWidth-620))});
const enable=()=>innerWidth>1200;
function resize(w,persist=true){const {min,max}=limits();width=Math.min(max,Math.max(min,Math.round(w)));root.style.setProperty('--v6-organizer',width+'px');grip.setAttribute('aria-valuenow',String(width));grip.setAttribute('aria-valuetext',width+' pixels');expand.textContent=width>=690?'↔ Reduzir':'↔ Ampliar';expand.title='Alternar entre uma coluna mais compacta e uma mais larga';if(persist)try{localStorage.setItem('arenamon-studio-panel-width-v6',String(width))}catch{}
 if(!raf)raf=requestAnimationFrame(()=>{raf=0;window.dispatchEvent(new Event('resize'))})
}
try{const stored=Number(localStorage.getItem('arenamon-studio-panel-width-v6'));if(Number.isFinite(stored)&&stored>0)width=stored}catch{}
resize(width,false);
grip.addEventListener('pointerdown',e=>{if(!enable())return;e.preventDefault();drag=true;grip.classList.add('dragging');document.body.classList.add('v6-resizing');grip.setPointerCapture(e.pointerId)});
grip.addEventListener('pointermove',e=>{if(!drag)return;resize(window.innerWidth-e.clientX)});
function end(){drag=false;grip.classList.remove('dragging');document.body.classList.remove('v6-resizing')}
grip.addEventListener('pointerup',end);grip.addEventListener('pointercancel',end);
grip.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();resize(width+(e.key==='ArrowLeft'?-30:30))}else if(e.key==='Home'){e.preventDefault();resize(400)}else if(e.key==='End'){e.preventDefault();resize(limits().max)}});
expand.addEventListener('click',()=>resize(width>=690?500:750));
window.addEventListener('resize',()=>{if(enable())resize(width,false)});
})();
