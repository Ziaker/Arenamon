import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const dir='prototypes/combat-lab/evidence/elemental-quarks';mkdirSync(dir,{recursive:true});
const url=pathToFileURL(process.cwd()+'/prototypes/combat-lab/dist/arenamon-elementais-quarks.html').href;
const b=await chromium.launch({channel:'msedge',headless:true});
try {
 const ctx=await b.newContext({viewport:{width:1500,height:1000},acceptDownloads:true}),p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const open=async()=>{await p.goto(url);await p.waitForFunction(()=>window.__elementalLab);};
 const set=async(k,v)=>{await p.locator('#'+k).fill(String(v));await p.locator('#'+k).dispatchEvent('input');};
 const cur=()=>p.evaluate(()=>window.__elementalLab.diagnostics().settings);
 await open();await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForFunction(()=>window.__elementalLab);
 // ajustes em Moves e opções diferentes
 await set('size',1.3);await set('shotFlash',2.2);
 await p.selectOption('#variant','2');await set('rotation',5.5);
 await p.selectOption('#move','airSlash');await set('shotKick',3.1);await set('shotShockCount',5);
 await p.selectOption('#move','fireSpin');await set('fireArms',9);
 // 1) salvamento automático sobrevive a recarregar a página
 await p.reload();await p.waitForFunction(()=>window.__elementalLab);
 let s=await cur();assert.equal(s.move??'fireSpin','fireSpin');assert.equal(s.fireArms,9,'fireArms não voltou');
 await p.selectOption('#move','airSlash');s=await cur();assert.equal(s.shotKick,3.1);assert.equal(s.shotShockCount,5);
 await p.selectOption('#move','waterPulse');s=await cur();assert.equal(s.size,1.3);assert.equal(s.shotFlash,2.2);
 await p.selectOption('#variant','2');s=await cur();assert.equal(s.rotation,5.5);
 // 2) exportar baixa um arquivo .json válido
 const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#export')]);
 assert(/^arenamon-elementais-.*\.json$/.test(dl.suggestedFilename()),dl.suggestedFilename());
 const file=process.cwd()+'/prototypes/combat-lab/evidence/elemental-quarks/config-exemplo.json';await dl.saveAs(file);
 const data=JSON.parse(readFileSync(file,'utf8'));assert.equal(data.format,'arenamon-elementais-config');assert(data.entries.length>=4);
 assert(data.entries.some(e=>e.move==='airSlash'&&e.values.shotKick===3.1));
 // 3) apagar tudo e importar devolve os valores
 await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForFunction(()=>window.__elementalLab);
 s=await cur();assert.notEqual(s.size,1.3);
 await p.setInputFiles('#import-file',file);await p.waitForFunction(()=>/Importado/.test(document.querySelector('#save-note').textContent));
 await p.selectOption('#move','airSlash');s=await cur();assert.equal(s.shotKick,3.1);
 await p.selectOption('#move','fireSpin');s=await cur();assert.equal(s.fireArms,9);
 await p.selectOption('#move','waterPulse');s=await cur();assert.equal(s.size,1.3);assert.equal(s.shotFlash,2.2);await p.selectOption('#variant','2');s=await cur();assert.equal(s.rotation,5.5);
 // 4) arquivo inválido é recusado sem quebrar nada
 const bad=tmpdir()+'/arenamon-config-invalida.json';writeFileSync(bad,'{"nada":1}');
 await p.setInputFiles('#import-file',bad);
 await p.waitForFunction(()=>/falhou/.test(document.querySelector('#save-note').textContent));
 s=await cur();assert.equal(s.rotation,5.5);
 await p.locator('#export').scrollIntoViewIfNeeded();await p.screenshot({path:dir+'/export-config.png'});
 assert.deepEqual(errors,[]);
 console.log('Exportar/importar/salvamento automático: OK');
} finally {await b.close();}
