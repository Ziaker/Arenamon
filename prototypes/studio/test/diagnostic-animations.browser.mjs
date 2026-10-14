// Navegador real e offline: clipes diagnósticos, integração com a biblioteca, histórico e GLB.
// Sem atalhos que mascaram a página: cliques reais do Playwright, requestAnimationFrame e devicePixelRatio originais.
// O WebGL roda em SwiftShader (software), o mesmo renderizador do executor do CI, para reproduzir o ambiente dele.
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const root=fileURLToPath(new URL('../',import.meta.url)),out=root+'validation/';
await mkdir(out,{recursive:true});
const synthetic=await readFile(new URL('./fixture.js',import.meta.url),'utf8');
let count=0,t0=Date.now();const mark=s=>{count++;console.log('✓ '+s+` (${((Date.now()-t0)/1000).toFixed(1)} s)`);t0=Date.now();};
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader']});
const errors=[],requests=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',r=>{if(/^https?:/i.test(r.url()))requests.push(r.url());});
 await page.context().setOffline(true);
 await page.goto(pathToFileURL(root+'dist/arenamon-animation-studio.html').href);
 await page.waitForFunction(()=>window.__studioDiagnostics&&window.__studioRig&&window.__importer,{timeout:60000});
 mark('Studio offline inicializa módulo de diagnóstico sem dependências externas');
 await page.evaluate(async source=>{
   const E=window.__importer;
   const {syntheticRig}=await import('data:text/javascript,'+encodeURIComponent(source));
   const {root,clips}=syntheticRig(E.T);
   await E.install(root,clips,'teste-mixamo.glb');
 },synthetic);
 await page.click('[data-panel="rigging"]');
 await page.waitForFunction(()=>window.__studioRig.active);
 const s=await page.evaluate(()=>({report:window.__studioDiagnostics.currentReport,
   n:window.__importer.clips.length,rig:!!window.__importer.model.getObjectByName('mixamorigHead')}));
 assert.equal(s.n,3);assert.ok(s.rig);assert.ok(s.report.mapped>=3);
 mark('Personagem semi-humanoide com rig Mixamo reconhecido automaticamente');
 assert.equal(await page.locator('#rg-diag-preset option').count(),8,'oito movimentos na lista');
 await page.selectOption('#rg-diag-preset','walk');
 await page.click('#rg-diag-add');
 const data=await page.evaluate(()=>{
   const E=window.__importer, c=E.clips.at(-1);
   return {count:E.clips.length, name:c.name, tracks:c.tracks.length,
      testOnly:c.userData.arenamonDiagnostic.testOnly, noRootMotion:c.userData.arenamonDiagnostic.noRootMotion,
      originals:E.clips.slice(0,3).map(x=>x.name),dirty:window.__studioProject.dirty, selected:E.selectedIndex};
 });
 assert.equal(data.count,4);assert.ok(data.name.includes('Caminhada'));
 assert.ok(data.tracks>0);assert.ok(data.testOnly&&data.noRootMotion);
 assert.deepEqual(data.originals,['teste-mixamo.glb · 1','teste-mixamo.glb · 2','teste-mixamo.glb · 3']);
 assert.equal(data.dirty,true);assert.equal(data.selected,3);
 mark('Caminhada real adicionada à biblioteca sem apagar os três clipes existentes');
 // Histórico: criar um diagnóstico é desfazível e refazível como qualquer criação de clipe.
 const hist=await page.evaluate(()=>{
   const E=window.__importer,H=window.__studioEditor.history,clip=E.clips.at(-1),r={};
   H.undo();r.afterUndo=E.clips.length;r.gone=!E.clips.includes(clip);
   H.redo();r.afterRedo=E.clips.length;r.back=E.clips.at(-1)===clip;return r;
 });
 assert.deepEqual(hist,{afterUndo:3,gone:true,afterRedo:4,back:true});
 mark('Criar diagnóstico entra no histórico: desfazer remove e refazer recria o mesmo clipe');
 // Edição de mapeamento manual e outro preset.
 await page.click('#rg-diag-mapping summary');
 const head=await page.evaluate(()=>{
   const b=window.__importer.model.getObjectByName('mixamorigHead');
   const id=b.uuid;b.name='CabecaCriaturaNaoPadrao';
   window.__studioDiagnostics.refresh();
   return id;
 });
 assert.equal(await page.evaluate(()=>window.__studioDiagnostics.mapping.head),undefined);
 await page.selectOption('[data-role="head"]',head);
 assert.equal(await page.evaluate(()=>window.__studioDiagnostics.mapping.head),head);
 await page.selectOption('#rg-diag-preset','tackle');
 const r=await page.evaluate(()=>window.__studioDiagnostics.currentReport);
 assert.ok(r.available.length>=1);
 mark('Remapeamento manual por UUID com nome atípico e aviso de articulações ausentes');
 await page.evaluate(()=>window.__studioDiagnostics.generate('guard',.4));
 const remains=await page.evaluate(()=>window.__importer.clips.length);
 assert.equal(remains,4,'geração sem adicionar não altera biblioteca');
 mark('Gerador API não adiciona nem modifica clipes até confirmação');
 // Gerar e assistir: entra na área Projeto e reproduz clipe.
 await page.click('#rg-diag-preview');
 await page.waitForFunction(()=>window.__studioLayout.panel==='project' && window.__importer.clips.length===5,{timeout:20000});
 await page.waitForFunction(()=>window.__importer.playing===true,{timeout:10000});
 assert.match(await page.evaluate(()=>window.__importer.selectedClip.name),/Investida/);
 mark('Gerar e assistir exibe o movimento, navega até o player e inicia playback');
 await page.evaluate(()=>window.__importer.setPlaying(false));
 // As oito animações pela interface, cada uma ligada a ossos reais no mixer do Studio.
 await page.click('[data-panel="rigging"]');await page.waitForFunction(()=>window.__studioRig.active);
 const presets=await page.evaluate(()=>window.__studioDiagnostics.presets.map(p=>p.id));
 assert.deepEqual(presets,['isolate','idle','walk','run','squat','tackle','dodge','guard']);
 for(const id of presets){await page.selectOption('#rg-diag-preset',id);await page.click('#rg-diag-add');}
 const eight=await page.evaluate(()=>{
   const E=window.__importer,list=E.clips.filter(c=>c.userData.arenamonDiagnostic).slice(-8);
   return list.map(c=>{const a=E.mixer.clipAction(c);a.play();E.mixer.update(0);const bound=a._propertyBindings.filter(b=>b.binding.node).length;a.stop();
     return {preset:c.userData.arenamonDiagnostic.presetId,tracks:c.tracks.length,bound,duration:c.duration};});
 });
 assert.deepEqual(eight.map(x=>x.preset),presets);
 for(const x of eight){assert.ok(x.tracks>0,x.preset);assert.equal(x.bound,x.tracks,x.preset+': trilha sem osso no Studio');}
 assert.equal(await page.evaluate(()=>window.__importer.clips.length),13);
 mark('As oito animações geradas pela interface, todas as trilhas ligadas a ossos reais');
 const exported=await page.evaluate(async()=>{
   const E=window.__importer, bytes=await E.exportGLB({unlit:false,noTextures:false});
   const parse=await E.parse(new File([bytes],'diagnosticos.arenamon.glb',{type:'model/gltf-binary'}));
   const diag=parse.animations.filter(c=>c.userData?.arenamonDiagnostic);
   return {size:bytes.byteLength,count:parse.animations.length,names:parse.animations.map(c=>c.name),
     diag:diag.map(c=>({preset:c.userData.arenamonDiagnostic.presetId,testOnly:c.userData.arenamonDiagnostic.testOnly,tracks:c.tracks.length})),
     sourceTracks:E.clips.filter(c=>c.userData.arenamonDiagnostic).map(c=>c.tracks.length),
     skins:(()=>{let n=0;parse.scene.traverse(o=>{if(o.isSkinnedMesh)n++;});return n;})()};
 });
 assert.ok(exported.size>1000);assert.equal(exported.count,13);
 assert.ok(exported.names.some(x=>x.includes('Caminhada')));
 assert.ok(exported.names.some(x=>x.includes('Investida')));
 assert.ok(exported.skins>0);
 // Os metadados de teste (testOnly, preset) e o número de trilhas sobrevivem ao GLB.
 assert.equal(exported.diag.length,10);assert.ok(exported.diag.every(d=>d.testOnly===true));
 assert.deepEqual(exported.diag.map(d=>d.tracks),exported.sourceTracks);
 mark('GLB exporta e reimporta as animações de diagnóstico com metadados, trilhas, skinning e clips');
 assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
 await writeFile(out+'diagnostic-animations-browser.json',JSON.stringify({tests:count,requests,errors,exported:{...exported,names:exported.names}},null,2));
 console.log('\nDiagnóstico: '+count+' testes de navegador aprovados.');
}finally{await browser.close();}
