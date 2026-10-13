import {chromium} from '@playwright/test';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('.',import.meta.url)),out=root+'validation/';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const tests=[],errors=[],requests=[],samples=[];
try{
 const page=await browser.newPage({viewport:{width:1500,height:1120},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
 await page.context().setOffline(true);await page.goto(pathToFileURL(root+'dist/criaturas-laboratorio.html').href);await page.waitForFunction(()=>window.__lab?.getState().frame>3);
 const state=()=>page.evaluate(()=>window.__lab.getState());
 const sample=(s,t)=>page.evaluate(([s,t])=>window.__lab.sample(s,t),[s,t]);
 const initial=await state();assert.equal(initial.models.length,3);assert.deepEqual(initial.models.map(m=>m.legs),[2,2,4]);tests.push('Three models and distinct limb hierarchies');
 const durations={idle:3.2,walk:2.4,run:2.4,turn:1.2,guard:1.4,front:.4,side:.4,back:.4,recover:.65,prepare:.8,tackle:.4,hit:1,push:1,blocked:.3};
 for(const style of ['contained','stylized','expressive']){
  await page.selectOption('#style',style);
  for(const [s,d] of Object.entries(durations)){
   await page.click(`[data-state="${s}"]`);assert.equal((await state()).state,s);
   let first,last,maxMovement=0,minFoot=Infinity,minMesh=Infinity;
   for(let i=0;i<=16;i++){
    await sample(s,d*i/16);const v=await state(),probe=await page.evaluate(()=>window.__lab.probe());
    assert.ok(probe.flat(2).every(Number.isFinite),`${s} finite joints`);
    minFoot=Math.min(minFoot,...v.models.flatMap(m=>m.feet.map(f=>f[1])));assert.ok(minFoot>-.002,`${style} ${s} feet ${minFoot}`);
    const floor=await page.evaluate(()=>window.__lab.meshFloor());minMesh=Math.min(minMesh,...floor);const floorDetail=await page.evaluate(()=>window.__lab.floorDetail());assert.ok(minMesh>-.01,`${style} ${s} mesh below floor ${minMesh}: ${JSON.stringify(floorDetail)}`);if(!first)first=probe;last=probe;
    maxMovement=Math.max(maxMovement,...probe.flat(2).map((x,j)=>Math.abs(x-first.flat(2)[j])));
   }
   assert.ok(maxMovement>.003,`${s} movement`);samples.push({style,state:s,maxJointMovement:maxMovement,minFoot,minMesh});
  }
 }
 for(const [s,d] of [['idle',3.2],['walk',2.4],['run',2.4]]){await sample(s,0);const a=(await page.evaluate(()=>window.__lab.probe())).flat(2);await sample(s,d);const b=(await page.evaluate(()=>window.__lab.probe())).flat(2);assert.ok(Math.max(...a.map((v,i)=>Math.abs(v-b[i])))<.01,s+' loop continuity');}tests.push('Continuous idle/walk/run loop endpoints');
 tests.push('14 states × 3 styles × 17 time samples: finite joints, movement, soles above floor');
 await page.selectOption('#style','stylized');
 for(const s of ['front','side','back','tackle']){
  for(const [t,inv,attack] of [[0,true,true],[.199,true,true],[.2,false,true],[.399,false,true],[.4,false,false]]){
   await sample('idle',0);await sample(s,t);const v=(await state()).physical;assert.equal(v.invulnerable,inv);assert.equal(v.offensive,['front','tackle'].includes(s)&&attack);
  }
  const v=(await state()).physical.position;assert.ok(Math.abs(Math.hypot(...v)-1.6)<1e-9);
 }
 await sample('blocked',.3);assert.ok(Math.abs((await state()).physical.position[2]+.24)<1e-9);
 for(const next of ['guard','front','side','back']){await sample('blocked',.15);const before=(await state()).physical.position;await page.click(`[data-state="${next}"]`);await page.waitForTimeout(35);assert.deepEqual((await state()).physical.position,before);}
 tests.push('400 ms dodge, 200 ms invulnerability, full forward offensive window, 15% recoil/300 ms, guard/dodge cancel with position continuity');
 const styles={};for(const style of ['contained','stylized','expressive']){await page.selectOption('#style',style);await sample('tackle',.15);styles[style]=await state();await page.locator('.viewport-wrap').screenshot({path:out+`style-${style}.png`});}
 assert.deepEqual(styles.contained.physical,styles.expressive.physical);assert.notDeepEqual(styles.contained.poses,styles.expressive.poses);tests.push('Style changes poses, not physics');
 await page.selectOption('#style','stylized');await sample('hit',.15);const hit=(await state()).poses;await sample('push',.15);assert.notDeepEqual((await state()).poses,hit);
 for(const id of ['a','b','c','all']){await page.selectOption('#creature',id);assert.equal((await state()).selected,id);assert.equal(await page.locator('#labels>div').count(),id==='all'?3:1);}
 await sample('idle',.5);await page.screenshot({path:out+'comparison.png',fullPage:true});
 await page.click('#silhouette');assert.equal((await state()).silhouette,true);await page.locator('.viewport-wrap').screenshot({path:out+'silhouettes.png'});await page.click('#silhouette');
 await page.click('#joints');assert.equal((await state()).joints,true);await page.locator('.viewport-wrap').screenshot({path:out+'joints.png'});await page.click('#joints');
 for(const yaw of ['0','1.5707963267948966','3.141592653589793']){await page.click(`[data-view="${yaw}"]`);assert.equal((await state()).camera.yaw,Number(yaw));await page.locator('.viewport-wrap').screenshot({path:out+`angle-${yaw}.png`});}
 await page.click('#camera-reset');const yaw=(await state()).camera.yaw;const box=await page.locator('#viewport').boundingBox();await page.mouse.move(box.x+300,box.y+200);await page.mouse.down();await page.mouse.move(box.x+370,box.y+240);await page.mouse.up();assert.notEqual((await state()).camera.yaw,yaw);
 const distance=(await state()).camera.distance;await page.mouse.wheel(0,100);await page.waitForTimeout(100);assert.ok((await state()).camera.distance>distance);await page.click('#zoom-in');await page.click('#zoom-out');await page.click('#camera-reset');
 tests.push('Individual/all selectors; silhouette/joints toggles; camera presets, drag, wheel and zoom');
 await sample('run',.2);await page.click('#play');await page.waitForTimeout(130);assert.ok((await state()).time>.2);await page.click('#play');const paused=(await state()).time;await page.waitForTimeout(100);assert.equal((await state()).time,paused);
 await page.click('#restart');await page.waitForTimeout(35);assert.equal((await state()).time,0);await page.click('#step');assert.ok(Math.abs((await state()).time-1/60)<1e-9);
 await page.locator('#scrub').fill('0.5');await page.locator('#scrub').dispatchEvent('input');assert.equal((await state()).time,1.2);
 await page.selectOption('#speed','0.25');assert.equal((await state()).speed,.25);await page.selectOption('#speed','1');
 await page.locator('#loop').uncheck();await sample('front',.39);await page.click('#play');await page.waitForTimeout(180);assert.equal((await state()).time,.4);assert.equal((await state()).playing,false);
 await page.locator('#loop').check();await sample('front',.39);await page.click('#play');await page.waitForTimeout(900);assert.ok((await state()).time<.4);assert.equal((await state()).playing,true);await page.click('#play');
 await page.click('#rest');assert.equal((await state()).rest,true);assert.equal((await state()).playing,false);
 const download=page.waitForEvent('download');await page.click('#capture');assert.ok((await download).suggestedFilename().endsWith('.png'));
 tests.push('Play/pause/restart/frame step/scrub/speed/loop/end stop/rest/PNG');
 const visual={a:{run:.15,side:.15,recover:.23,tackle:.15},b:{walk:.19,prepare:.45,hit:.08,blocked:.08},c:{idle:1.1,run:.3,front:.15,hit:.12}};
 for(const [id,actions] of Object.entries(visual)){
  await page.selectOption('#creature',id);await page.click('[data-view="1.5707963267948966"]');
  for(const [s,t] of Object.entries(actions)){await sample(s,t);await page.locator('.viewport-wrap').screenshot({path:out+`${id}-${s}.png`});}
 }
 await page.selectOption('#creature','all');await page.click('#camera-reset');await sample('run',.15);await page.locator('.viewport-wrap').screenshot({path:out+'run-comparison.png'});
 await page.setViewportSize({width:390,height:844});await sample('idle',.5);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:out+'mobile.png',fullPage:true});tests.push('390 px layout without horizontal overflow');
 assert.deepEqual(errors,[]);assert.equal(requests.filter(u=>/^https?:/.test(u)).length,0);
 const html=await readFile(root+'dist/criaturas-laboratorio.html','utf8');assert.ok(!/<(?:script|img)[^>]+src\s*=|<link[^>]+href\s*=/i.test(html));
 tests.push('file:// with network offline; no external requests, page errors or console errors; inline bundle');
 await writeFile(out+'report.json',JSON.stringify({browser:'Microsoft Edge / Chromium headless',offline:true,htmlBytes:Buffer.byteLength(html),tests,errors,requests,samples,models:initial.models},null,2));
 console.log('PASS',tests);
}finally{await browser.close();}


