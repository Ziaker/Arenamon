import {chromium} from '@playwright/test';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('.',import.meta.url));
const browser=await chromium.launch({channel:'msedge',headless:true});
const tests=[],errors=[],external=[];
try {
 const context=await browser.newContext({viewport:{width:1366,height:900},offline:true});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
 const state=()=>page.evaluate(()=>window.__arenamon.snapshot());
 const until=fn=>page.waitForFunction(fn,null,{timeout:15000});
 const ticks=async n=>{const t=(await state()).tick;await page.waitForFunction(t=>window.__arenamon.snapshot().tick>=t,t+n,{timeout:15000});};
 const key=async(code,n=12)=>{await page.keyboard.down(code);await ticks(n);await page.keyboard.up(code);};
 const start=async mode=>{await page.selectOption('#mode',mode);await page.click('#start');await ticks(3);assert.equal((await state()).locked,false);await page.keyboard.press('Tab');};
 const menu=async()=>{if((await state()).phase==='playing')await page.keyboard.press('Escape');await page.click('#back');};
 await page.goto(pathToFileURL(root+'dist/arenamon-jogavel.html').href);
 await until(()=>window.__arenamon?.snapshot().frame>2);assert.equal((await state()).phase,'menu');
 await mkdir(root+'validation',{recursive:true});await page.screenshot({path:root+'validation/menu.png'});
 await start('inactive');tests.push('file:// offline boot and menu start');
 for(const reserved of ['a','s','d','z','w','Space']){
   const before=await state();await key(reserved,10);const after=await state();assert.deepEqual(after.fighters[0].position,before.fighters[0].position);assert.equal(after.fighters[0].action,null);
 }tests.push('reserved letters (A/S/D/Z/W/Space) cannot move or attack; X is now the tackle');
 let initial=await state();await key('ArrowUp',45);let moved=await state();assert.ok(moved.fighters[0].position.z>initial.fighters[0].position.z+1);await ticks(10);let stopped=await state();assert.ok(Math.abs(stopped.fighters[0].position.z-moved.fighters[0].position.z)<.1);
 await key('ArrowRight',15);await key('ArrowLeft',15);await key('ArrowDown',15);tests.push('keyboard move, strafe, reverse and release');
 await page.keyboard.down('f');await ticks(8);assert.ok((await state()).fighters[0].guard);await page.keyboard.up('f');await ticks(3);assert.ok(!(await state()).fighters[0].guard);tests.push('defense held/released');
 await page.keyboard.press('Tab');await ticks(3);assert.equal((await state()).locked,false);await page.keyboard.press('Tab');tests.push('hybrid lock toggle');
 await page.keyboard.press('Tab');
 for(const [horizontal,vertical] of [['ArrowRight',null],['ArrowLeft',null],[null,'ArrowUp'],[null,'ArrowDown'],['ArrowRight','ArrowUp'],['ArrowLeft','ArrowUp'],['ArrowRight','ArrowDown'],['ArrowLeft','ArrowDown']]){
   await ticks(8);const before=await state();if(horizontal)await page.keyboard.down(horizontal);if(vertical)await page.keyboard.down(vertical);await ticks(12);if(horizontal)await page.keyboard.up(horizontal);if(vertical)await page.keyboard.up(vertical);
   const after=await state(),dx=after.fighters[0].position.x-before.fighters[0].position.x,dz=after.fighters[0].position.z-before.fighters[0].position.z,yaw=before.camera.yaw;
   const right=dx*Math.cos(yaw)-dz*Math.sin(yaw),forward=-dx*Math.sin(yaw)-dz*Math.cos(yaw);
   if(horizontal)assert.equal(Math.sign(right),horizontal==='ArrowRight'?1:-1);if(vertical)assert.equal(Math.sign(forward),vertical==='ArrowUp'?1:-1);
 }await ticks(8);await page.keyboard.press('Tab');tests.push('all eight arrow directions match screen reference');
 await page.click('#debug-toggle');await page.waitForSelector('#debug:visible');assert.ok((await page.textContent('#debug')).includes('120 Hz'));tests.push('debug panel');
 const yaw=(await state()).camera.yaw;await page.mouse.move(700,400);await page.mouse.down({button:'right'});await page.mouse.move(810,400);await page.mouse.up({button:'right'});assert.notEqual((await state()).camera.yaw,yaw);
 await page.mouse.wheel(0,200);await ticks(3);assert.ok((await state()).camera.distance>6.2);await page.click('#camera-reset');assert.equal((await state()).camera.yaw,Math.PI+.2);tests.push('camera drag, zoom and reset');
 await page.keyboard.press('r');await ticks(3);await page.keyboard.press('Tab');
 // Up+X performs an actual tackle from range; no test mutation of entities.
 await key('ArrowUp',65);await page.keyboard.down('ArrowUp');await page.keyboard.press('x');await page.keyboard.up('ArrowUp');
 await until(()=>window.__arenamon.snapshot().events.some(e=>e.result==='impact'));
 assert.ok((await state()).fighters[1].hp<100);await page.screenshot({path:root+'validation/impact.png'});tests.push('player tackle contact and HUD damage');
 await page.keyboard.press('Escape');let paused=await state();await page.waitForTimeout(150);assert.equal((await state()).tick,paused.tick);await page.click('#resume');await ticks(5);tests.push('pause/resume stops logical time');
 await menu();await start('defensive');await ticks(28);await key('ArrowUp',65);await page.keyboard.down('ArrowUp');await page.keyboard.press('x');await page.keyboard.up('ArrowUp');
 await until(()=>window.__arenamon.snapshot().events.some(e=>e.result==='partial'));
 await page.screenshot({path:root+'validation/block.png'});assert.equal((await state()).fighters[1].hp,90);tests.push('tackle blocked by defensive AI');
 await menu();await start('offensive');await page.keyboard.down('f');
 await until(()=>window.__arenamon.snapshot().events.some(e=>e.target===0&&['partial','perfect'].includes(e.result)));
 await page.keyboard.up('f');tests.push('player blocks incoming AI tackle');
 await until(()=>window.__arenamon.snapshot().events.some(e=>e.target===0&&e.result==='impact'));tests.push('player receives real AI impact');
 await until(()=>window.__arenamon.snapshot().phase==='result');assert.equal((await state()).winner,1);await page.screenshot({path:root+'validation/result.png'});tests.push('AI complete match and defeat result');
 await page.click('#restart');await ticks(3);assert.equal((await state()).fighters[0].hp,100);tests.push('result restart resets HP');
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await state()).phase,'paused');await page.click('#back');tests.push('focus loss pauses; return to menu');
 await start('inactive');
 for(let attack=0;attack<5;attack++){
   await until(()=>window.__arenamon.snapshot().fighters[0].stamina>=1&&!window.__arenamon.snapshot().fighters[0].exhausted);
   let current=await state(),a=current.fighters[0].position,b=current.fighters[1].position;
   if(Math.hypot(a.x-b.x,a.z-b.z)>2.6){await page.keyboard.down('ArrowUp');await until(()=>{const [a,b]=window.__arenamon.snapshot().fighters;return Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)<2.6;});await page.keyboard.up('ArrowUp');}
   const hp=(await state()).fighters[1].hp;await page.keyboard.press('x');
   await page.waitForFunction(hp=>window.__arenamon.snapshot().fighters[1].hp<hp,hp,{timeout:15000});
   if((await state()).phase==='playing')await ticks(55);
 }
 assert.equal((await state()).phase,'result');assert.equal((await state()).winner,0);assert.ok((await page.textContent('#overlay-title')).includes('Vitória'));tests.push('human controls win a complete match');await page.click('#back');
 // ---------- Etapa A pelo teclado ----------
 const fresh=async()=>{if((await state()).phase!=='menu')await menu();await start('inactive');await page.keyboard.press('Tab');await ticks(3);};
 const rested=()=>until(()=>{const f=window.__arenamon.snapshot().fighters[0];return f.stamina>=2.99&&!f.action;});
 // X nas 8 direções (sem alvo fixado): a investida segue as setas na referência da câmera.
 await fresh();
 for(const [horizontal,vertical] of [['ArrowRight',null],['ArrowLeft',null],[null,'ArrowUp'],[null,'ArrowDown'],['ArrowRight','ArrowUp'],['ArrowLeft','ArrowUp'],['ArrowRight','ArrowDown'],['ArrowLeft','ArrowDown']]){
   await rested();const before=await state();if(horizontal)await page.keyboard.down(horizontal);if(vertical)await page.keyboard.down(vertical);await page.keyboard.press('x');
   await until(()=>window.__arenamon.snapshot().fighters[0].action?.kind==='tackle');if(horizontal)await page.keyboard.up(horizontal);if(vertical)await page.keyboard.up(vertical);
   await until(()=>!window.__arenamon.snapshot().fighters[0].action);const after=await state();
   const dx=after.fighters[0].position.x-before.fighters[0].position.x,dz=after.fighters[0].position.z-before.fighters[0].position.z,yaw=before.camera.yaw;
   const right=dx*Math.cos(yaw)-dz*Math.sin(yaw),forward=-dx*Math.sin(yaw)-dz*Math.cos(yaw);assert.ok(Math.hypot(dx,dz)>2,'X percorreu distância');
   if(horizontal)assert.equal(Math.sign(right),horizontal==='ArrowRight'?1:-1);if(vertical)assert.equal(Math.sign(forward),vertical==='ArrowUp'?1:-1);
   await page.keyboard.press('r');await ticks(3);await page.keyboard.press('Tab');await ticks(2);
 }tests.push('X tackle in all eight arrow directions');
 // C contra o rival (alvo fixado): salta por cima e não causa dano.
 await fresh();await page.keyboard.press('Tab');await ticks(2);
 await page.keyboard.down('ArrowUp');await until(()=>{const [a,b]=window.__arenamon.snapshot().fighters;return Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)<2.6;});await page.keyboard.up('ArrowUp');
 let peak=0;await page.keyboard.down('ArrowUp');await page.keyboard.press('c');await page.keyboard.up('ArrowUp');
 for(let i=0;i<40;i++){peak=Math.max(peak,(await state()).fighters[0].vaultHeight);if(!(await state()).fighters[0].action&&i>3)break;}
 assert.ok(peak>1,'C saltou sobre o rival ('+peak.toFixed(2)+' m)');assert.equal((await state()).fighters[1].hp,100);assert.ok(!(await state()).events.some(e=>e.damage>0));
 tests.push('C dodge vaults over the rival and never damages');
 // C → X pelo teclado: X durante C cancela a esquiva; stamina 3 − 1 − 1.
 await fresh();await rested();await page.keyboard.down('ArrowRight');await page.keyboard.press('c');await ticks(6);await page.keyboard.up('ArrowRight');
 await page.keyboard.down('ArrowUp');await page.keyboard.press('x');await page.keyboard.up('ArrowUp');
 await until(()=>window.__arenamon.snapshot().fighters[0].action?.kind==='tackle');const cx=(await state()).fighters[0];
 assert.ok(cx.action.fromCancel,'X veio do cancelamento C → X');assert.ok(Math.abs(cx.stamina-1)<1e-6,'stamina '+cx.stamina);
 tests.push('C → X cancel by keyboard: X starts from the dodge and charges its own cost');
 if((await state()).phase!=='menu')await menu();
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:root+'validation/narrow.png'});tests.push('narrow layout');
 const html=await readFile(root+'dist/arenamon-jogavel.html','utf8');assert.ok(!/<script[^>]+src=/i.test(html));assert.ok(!/<(?:img|link)[^>]+(?:src|href)=["']https?:/i.test(html));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await writeFile(root+'validation/browser.json',JSON.stringify({tests,errors,external,offline:true},null,2));console.log(`PASS: ${tests.length} browser scenarios, file:// offline, no errors or external requests.`);
} finally {await browser.close();}
