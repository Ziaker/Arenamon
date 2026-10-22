import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir='prototypes/sand-stone-lab/evidence/revision-6';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],reports=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(pathToFileURL(resolve('prototypes/sand-stone-lab/dist/arenamon-areia-pedra.html')).href);await page.waitForFunction(()=>!!window.__labDiagnostics);
 await page.locator('[data-category="riposte"]').click();
 const seek=async t=>{await page.locator('#scrub').evaluate((el,t)=>{el.value=t;el.dispatchEvent(new Event('input',{bubbles:true}));},String(t));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));return page.evaluate(()=>window.__labDiagnostics());};
 const phases={opening:.04,guard:.18,intercept:.32,counter:.52,impact:.76};
 for(let v=0;v<3;v++){
  await page.locator(`[data-variant="${v}"]`).click();await page.locator('#riposte-scenario').selectOption('0');
  for(const [phase,t] of Object.entries(phases)){
   const d=await seek(t);reports.push({...d,phase});assert.equal(d.riposte.guardVisible,t<.3);assert.equal(d.riposte.counterVisible,t>=.3&&t<.9);
   await page.screenshot({path:`${dir}/riposte-${'abc'[v]}-${phase}.png`});
  }
  for(const [scenario,phase] of [[1,'expired'],[2,'late'],[3,'guardbreak']]){
   await page.locator('#riposte-scenario').selectOption(String(scenario));const d=await seek(scenario===3?.36:.64);reports.push({...d,phase});assert.equal(d.riposte.counterVisible,false);assert.equal(d.riposte.success,false);assert.equal(d.particles,0);
   await page.screenshot({path:`${dir}/riposte-${'abc'[v]}-${phase}.png`});
  }
  await page.locator('#riposte-scenario').selectOption('0');console.log(`Riposte ${'ABC'[v]}: abertura, guarda, interceptação, contra-ataque, impacto e 3 falhas.`);
 }
 // New category JSON retains the chosen scenario.
 await page.locator('#riposte-scenario').selectOption('1');const download=page.waitForEvent('download');await page.locator('#export-one').click();const json=JSON.parse(await readFile(await (await download).path(),'utf8'));assert.equal(json.category,'riposte');assert.equal(json.visualParameters.scenario,1);
 await page.locator('#riposte-scenario').selectOption('0');page.once('dialog',d=>d.accept());await page.locator('#import-file').setInputFiles({name:'riposte.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(json))});await page.waitForFunction(()=>document.querySelector('#riposte-scenario').value==='1');
 await page.locator('[data-variant="0"]').click();await page.locator('#riposte-scenario').selectOption('0');const before=await seek(.52);
 for(let round=0;round<2;round++)for(let v=0;v<3;v++){await page.locator(`[data-variant="${v}"]`).click();await page.locator('#riposte-scenario').selectOption('0');await seek(.52);}
 await page.locator('[data-variant="0"]').click();const after=await seek(.52);assert.ok(after.geometries<=before.geometries+3);assert.ok(after.textures<=before.textures+1);assert.deepEqual(errors,[]);
 await writeFile(`${dir}/diagnostics.json`,JSON.stringify({reports,cleanup:{before,after},errors},null,2));
 const names=['Égide de aço','Guarda cruzada','Mola de retorno'];
 await writeFile(`${dir}/index.html`,`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Riposte — guarda e contra-ataque</title><style>body{margin:32px;background:#0b1119;color:#e6e9ef;font:16px system-ui}a{color:#eed49b}nav{display:flex;gap:8px;flex-wrap:wrap;margin:24px 0}button{background:#243444;color:#fff;padding:12px;border:1px solid #718093;border-radius:6px;cursor:pointer}button.active{background:#d8b978;color:#111}main{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}article{background:#17212e;border-radius:10px;overflow:hidden}h2{padding:0 18px}img{width:100%;display:block}@media(max-width:900px){main{grid-template-columns:1fr}}</style><a href="../../../../ABRIR_ARENAMON.html">← Portal</a> · <a href="../../dist/arenamon-areia-pedra.html">Abrir atelier</a><h1>Riposte · abertura da guarda e resposta</h1><p>Janela atual: 0–0,59 s; postura: 0,65 s. Só um acerto elegível dispara o contra-ataque. Capturas Edge/SwiftShader, 1280 × 720.</p><nav>${Object.entries({opening:'Início do bloqueio',guard:'Guarda ativa',intercept:'Interceptação',counter:'Contra-ataque',impact:'Impacto',expired:'Sem acerto',late:'Golpe tardio',guardbreak:'Guard Break'}).map(([key,label])=>`<button data-phase="${key}" class="${key==='opening'?'active':''}">${label}</button>`).join('')}</nav><main>${names.map((name,i)=>`<article><h2>${'ABC'[i]} · ${name}</h2><a href="riposte-${'abc'[i]}-opening.png"><img data-id="${'abc'[i]}" src="riposte-${'abc'[i]}-opening.png" alt="${name}"></a></article>`).join('')}</main><p><a href="diagnostics.json">Diagnóstico dos cenários e descarte de recursos</a></p><script>for(const b of document.querySelectorAll('button'))b.onclick=()=>{for(const q of document.querySelectorAll('button'))q.classList.toggle('active',b===q);for(const img of document.querySelectorAll('img')){img.src='riposte-'+img.dataset.id+'-'+b.dataset.phase+'.png';img.parentElement.href=img.src;}};</script></html>`);
 console.log('PASS: 24 capturas, cenários condicionais, JSON Riposte, ausência de erros WebGL e recursos estáveis.');
}finally{await browser.close();}
