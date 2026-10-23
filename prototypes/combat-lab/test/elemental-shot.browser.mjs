import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {SHOT_CONTROLS} from '../src/view/quarks/presets.js';
const dir='prototypes/combat-lab/evidence/elemental-quarks';
const b=await chromium.launch({channel:'msedge',headless:true});
try {
 const p=await b.newPage({viewport:{width:1500,height:1000}}),errors=[],results={};
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.context().setOffline(true);
 await p.goto(pathToFileURL(process.cwd()+'/prototypes/combat-lab/dist/arenamon-elementais-quarks.html').href);
 await p.waitForFunction(()=>window.__elementalLab);
 await p.uncheck('#loop');
 const sample=t=>p.evaluate(t=>window.__elementalLab.sampleAt(t),t);
 const set=async(k,v)=>{await p.locator('#'+k).fill(String(v));await p.locator('#'+k).dispatchEvent('input');};
 for(const move of ['waterPulse','airSlash']){
  await p.selectOption('#move',move);await p.click('#reset');
  for(const [key,,,min,max,step] of SHOT_CONTROLS){
   const cap=key==='shotAngle'?1:move==='waterPulse'?300:5;
   assert.equal(+(await p.locator('#'+key).getAttribute('max')),max*cap,move+' '+key);
   assert((await p.locator('#'+key+'-help').innerText()).length>20,key);
   const value=+(min+step*2).toFixed(4);await set(key,value);
   assert.equal((await sample(.01)).settings[key],value,move+' '+key);
   await p.click('#reset');
  }
  // fase do disparo visível e efeito presente nos primeiros instantes
  const a=await sample(.06);results[move+'-90ms']=a;
  assert.equal(a.phase,'Disparo (impacto)');
  assert(a.shotRings>=1,move+' sem ondas de choque');assert(a.shotFlash>0.3,move+' sem clarão');assert(a.shotKick>0.3,move+' sem impulso');assert(a.shotJet>0,move+' sem jato');
  await p.screenshot({path:dir+'/shot-'+move+'-60ms.png'});
  const mid=await sample(.2);await p.screenshot({path:dir+'/shot-'+move+'-200ms.png'});results[move+'-200ms']=mid;
  const done=await sample(.7);assert.equal(done.shotRings,0,move+' ondas não terminaram');assert(done.shotFlash<.001);
  // zero desliga tudo
  await set('shotDuration',0);const off=await sample(.06);assert.equal(off.shotOn,false);assert(!off.shotJet);await p.click('#reset');
  // sem flash zera clarão e halo, mantém ondas
  await p.check('#no-flash');const nf=await sample(.06);assert.equal(nf.shotFlash,0);assert(nf.shotRings>=1);await p.uncheck('#no-flash');
  // movimento reduzido reduz o jato
  await p.check('#reduced');results[move+'-reduzido']=await sample(.06);await p.uncheck('#reduced');
 }
 // jato vai para trás: partículas nascem à esquerda do ponto de disparo
 await p.selectOption('#move','waterPulse');await p.click('#reset');
 for(const move of ['waterPulse','airSlash']){await p.selectOption('#move',move);await p.click('#reset');const j=await sample(.15);results[move+'-jatoDx']=j.shotJetDx;assert(j.shotJetDx<-.2,move+' jato não vai para trás: '+j.shotJetDx);}
 assert.deepEqual(errors,[]);
 writeFileSync(dir+'/shot-results.json',JSON.stringify(results,null,2));
 console.log('Impacto do disparo (Water Pulse e Air Slash): sliders, fases, limites, flash e reduzido OK');
} finally {await b.close();}
