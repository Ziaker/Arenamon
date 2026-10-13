import {chromium} from '@playwright/test';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('.',import.meta.url));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
 await page.context().setOffline(true);await page.goto(pathToFileURL(root+'dist/criaturas-laboratorio.html').href);await page.waitForFunction(()=>window.__lab?.getState().frame>2);
 const state=()=>page.evaluate(()=>window.__lab.getState());const initial=await state();
 assert.equal(initial.blocks.length,2);assert.deepEqual(initial.blocks.map(b=>b.color),[0x1769ff,0xef3038]);assert.ok(initial.blocks.every(b=>b.geometry==='BoxGeometry'&&b.position[1]===.5));
 const canvas=page.locator('canvas'),box=await canvas.boundingBox();await page.mouse.move(box.x+300,box.y+200);await page.mouse.down();await page.mouse.move(box.x+400,box.y+220);await page.mouse.up();assert.notEqual((await state()).camera.yaw,initial.camera.yaw);await page.click('#reset');assert.equal((await state()).camera.yaw,initial.camera.yaw);
 await mkdir(root+'validation',{recursive:true});await page.screenshot({path:root+'validation/blocks.png'});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const html=await readFile(root+'dist/criaturas-laboratorio.html','utf8');assert.ok(!/<script[^>]+src=/i.test(html));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await writeFile(root+'validation/report.json',JSON.stringify({offline:true,blocks:initial.blocks,errors,external,tests:['two solid boxes','blue player/red enemy','orbit/reset','mobile layout','file:// offline']},null,2));console.log('PASS: dois blocos, cores, câmera, layout, file:// offline, sem erros.');
}finally{await browser.close();}
