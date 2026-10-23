import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {ELEMENTAL_CONTROLS,WATER_CONTROLS,FIRE_CONTROLS} from '../src/view/quarks/presets.js';
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
 for(const [key,,,min,max,step] of WATER_CONTROLS){
  assert.equal(+(await p.locator('#'+key).getAttribute('max')),max*300,key);
  assert((await p.locator('#'+key+'-help').innerText()).length>20,key);
  const value=+(min+step*2).toFixed(4);await set(key,value);
  assert.equal((await sample(.01)).settings[key],value,key);
  await p.click('#reset');
 }
 await set('launchDelay',.1);await set('launchInterval',.2);await set('launchDuration',.5);
 results.before=await sample(.05);assert.equal(results.before.visibleLaunchRings,0);
 results.first=await sample(.15);assert.equal(results.first.visibleLaunchRings,1);
 results.second=await sample(.35);assert.equal(results.second.visibleLaunchRings,2);
 results.third=await sample(.55);assert.equal(results.third.visibleLaunchRings,3);
 await p.locator('#launchCount').scrollIntoViewIfNeeded();await p.screenshot({path:dir+'/water-ring-controls.png'});
 results.ended=await sample(1.01);assert(!results.ended.launchVisible);
 await p.click('#reset');await set('contactDuration',5);await set('burstLife',3);
 results.contact=await sample(6.5);assert(results.contact.active);assert(Math.abs(results.contact.impactOpacity-.3)<.01);
 await p.locator('#contactDuration').scrollIntoViewIfNeeded();await p.screenshot({path:dir+'/water-contact-controls.png'});
 results.cleaned=await sample(9);assert(!results.cleaned.active);
 for(const move of ['fireSpin','airSlash','seedBomb']){
  await p.selectOption('#move',move);
  for(const [key,,,,max] of [...ELEMENTAL_CONTROLS,...(move==='fireSpin'?FIRE_CONTROLS:[])])if(await p.locator('#'+key).count())assert.equal(+(await p.locator('#'+key).getAttribute('max')),max*5,move+':'+key);
  assert.equal(+(await p.locator('#bloom').getAttribute('max')),6);
 }
 assert.deepEqual(errors,[]);
 writeFileSync(dir+'/water-controls-results.json',JSON.stringify({newWaterControls:WATER_CONTROLS.length,waterMultiplier:300,otherMultiplier:5,results,errors},null,2));
 console.log('40 controles conectados, sequenciamento de argolas, contato prolongado, descarte e máximos 5×: OK');
}finally{await b.close();}
