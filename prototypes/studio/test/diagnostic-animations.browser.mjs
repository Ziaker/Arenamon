// Navegador real e offline: clipes diagnósticos, integração com a biblioteca e GLB.
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const root=fileURLToPath(new URL('../',import.meta.url)),out=root+'validation/';
await mkdir(out,{recursive:true});
const synthetic=await readFile(new URL('./fixture.js',import.meta.url),'utf8');
let count=0;const mark=s=>{count++;console.log('✓ '+s);};
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu-sandbox','--use-angle=swiftshader']});
const errors=[],requests=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',r=>{if(/^https?:/i.test(r.url()))requests.push(r.url());});
 await page.addInitScript(()=>{
   Object.defineProperty(window,'devicePixelRatio',{configurable:true,get:()=>.6});
   window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),45);
 });
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
 await page.locator('[data-panel="rigging"]').evaluate(el=>el.click());
 await page.waitForFunction(()=>window.__studioRig.active);
 const s=await page.evaluate(()=>({report:window.__studioDiagnostics.currentReport,
   n:window.__importer.clips.length,rig:!!window.__importer.model.getObjectByName('mixamorigHead')}));
 assert.equal(s.n,3);assert.ok(s.rig);assert.ok(s.report.mapped>=3);
 mark('Personagem semi-humanoide com rig Mixamo reconhecido automaticamente');
 const n=await page.locator('#rg-diag-preset option').count();
 assert.ok(n>=7);
 await page.selectOption('#rg-diag-preset','walk');
 await page.locator('#rg-diag-add').evaluate(el=>el.click());
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
 // Edição de mapeamento manual e outro preset.
 await page.locator('#rg-diag-mapping summary').evaluate(el=>el.click());
 const before=await page.evaluate(()=>window.__studioDiagnostics.mapping.lElbow);
 assert.ok(before);
 await page.evaluate(uuid=>{
   const select=document.querySelector('[data-role="lElbow"]');select.value=uuid;select.dispatchEvent(new Event('change',{bubbles:true}));
 },before);
 await page.selectOption('#rg-diag-preset','tackle');
 const r=await page.evaluate(()=>window.__studioDiagnostics.currentReport);
 assert.ok(r.available.length>=1);
 mark('Remapeamento por UUID e detecção das articulações ausentes');
 await page.evaluate(()=>window.__studioDiagnostics.generate('guard',.4));
 const remains=await page.evaluate(()=>window.__importer.clips.length);
 assert.equal(remains,4,'geração sem adicionar não altera biblioteca');
 mark('Gerador API não adiciona nem modifica clipes até confirmação');
 // Gerar e assistir: entra na área Projeto e reproduz clipe.
 await page.locator('#rg-diag-preview').evaluate(el=>el.click());
 await page.waitForFunction(()=>window.__studioLayout.panel==='project' && window.__importer.clips.length===5,{timeout:20000});
 await page.waitForFunction(()=>window.__importer.playing===true,{timeout:10000});
 assert.match(await page.evaluate(()=>window.__importer.selectedClip.name),/Investida/);
 mark('Gerar e assistir exibe o movimento, navega até o player e inicia playback');
 await page.evaluate(()=>window.__importer.setPlaying(false));
 const exported=await page.evaluate(async()=>{
   const E=window.__importer, bytes=await E.exportGLB({unlit:false,noTextures:false});
   const parse=await E.parse(new File([bytes],'diagnosticos.arenamon.glb',{type:'model/gltf-binary'}));
   return {size:bytes.byteLength,count:parse.animations.length,
     names:parse.animations.map(c=>c.name),skins:(()=>{let n=0;parse.scene.traverse(o=>{if(o.isSkinnedMesh)n++;});return n;})()};
 });
 assert.ok(exported.size>1000);assert.equal(exported.count,5);
 assert.ok(exported.names.some(x=>x.includes('Caminhada')));
 assert.ok(exported.names.some(x=>x.includes('Investida')));
 assert.ok(exported.skins>0);
 mark('GLB exporta e reimporta animações de diagnóstico sem perder skinning ou clips');
 assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
 await writeFile(out+'diagnostic-animations-browser.json',JSON.stringify({tests:count,requests,errors,exported},null,2));
 console.log('\nDiagnóstico: '+count+' testes de navegador aprovados.');
}finally{await browser.close();}
