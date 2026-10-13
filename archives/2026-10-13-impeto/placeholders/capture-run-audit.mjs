import {chromium} from '@playwright/test';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';

const root=fileURLToPath(new URL('.',import.meta.url));
const evidenceDir='C:/Users/zerke/.gemini/antigravity/brain/b8bff631-9205-4a9a-a56d-64cfc522555e/evidence/';
await mkdir(evidenceDir,{recursive:true});

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1050},deviceScaleFactor:1});
 await page.context().setOffline(true);
 await page.goto(pathToFileURL(root+'dist/criaturas-laboratorio.html').href);
 await page.waitForFunction(()=>window.__lab?.getState().frame>3);

 const sample=(s,t)=>page.evaluate(([s,t])=>window.__lab.sample(s,t),[s,t]);
 const setCamera=(yaw,pitch=0.12)=>page.evaluate(([y,p])=>{
  const canvas=document.querySelector('#viewport');
  // Trigger internal camera orientation via orbit controls or events
 },[yaw,pitch]);

 console.log('Starting captures...');

 // 1. Run key phases - Side view (yaw = 1.5707963)
 await page.click('[data-state="run"]');
 await page.click('[data-view="1.5707963267948966"]'); // Side view

 const phases=[
  {name:'01-run-contato-inicial',t:0.00,desc:'Primeiro contato (t = 0 ms)'},
  {name:'02-run-absorcao-squash',t:0.05,desc:'Absorção do peso / Squash (t = 50 ms)'},
  {name:'03-run-passagem-apoio',t:0.115,desc:'Passagem sobre o apoio (t = 115 ms)'},
  {name:'04-run-impulso-calcanhar',t:0.22,desc:'Impulso com calcanhar elevado 45° (t = 220 ms)'},
  {name:'05-run-suspensao-aerea',t:0.30,desc:'Suspensão real - ambos os pés no ar (t = 300 ms)'},
  {name:'06-run-preparacao-contato',t:0.36,desc:'Preparação do contato seguinte (t = 360 ms)'}
 ];

 for(const p of phases){
  await sample('run',p.t);
  await page.waitForTimeout(50);
  await page.locator('.viewport-wrap').screenshot({path:`${evidenceDir}impeto-${p.name}-side.png`});
 }

 // 2. Run key phases - Front view (yaw = 0)
 await page.click('[data-view="0"]'); // Front view
 for(const p of phases){
  await sample('run',p.t);
  await page.waitForTimeout(50);
  await page.locator('.viewport-wrap').screenshot({path:`${evidenceDir}impeto-${p.name}-front.png`});
 }

 // 3. Heel lift close-up
 await page.click('[data-view="1.5707963267948966"]');
 await sample('run',0.22);
 await page.click('#zoom-in');
 await page.click('#zoom-in');
 await page.click('#zoom-in');
 await page.waitForTimeout(50);
 await page.locator('.viewport-wrap').screenshot({path:`${evidenceDir}impeto-07-calcanhar-elevado-zoom.png`});
 await page.click('#camera-reset');

 // 4. Suspension (flight) phase zoom
 await page.click('[data-view="1.5707963267948966"]');
 await sample('run',0.30);
 await page.click('#zoom-in');
 await page.click('#zoom-in');
 await page.waitForTimeout(50);
 await page.locator('.viewport-wrap').screenshot({path:`${evidenceDir}impeto-08-suspensao-ambos-pes-zoom.png`});
 await page.click('#camera-reset');

 // 5. Locomotion mode comparison: Treadmill vs Real displacement
 await page.click('#locomotion-mode'); // Switch to travel mode
 await sample('run',0.50);
 await page.waitForTimeout(50);
 await page.locator('.viewport-wrap').screenshot({path:`${evidenceDir}impeto-09-deslocamento-real.png`});

 await page.click('#locomotion-mode'); // Switch back to treadmill
 await sample('run',0.50);
 await page.waitForTimeout(50);
 await page.locator('.viewport-wrap').screenshot({path:`${evidenceDir}impeto-10-esteira-modo.png`});

 // 6. Full UI view with telemetry and contact badges
 await sample('run',0.22);
 await page.screenshot({path:`${evidenceDir}impeto-11-laboratorio-completo-hud.png`,fullPage:true});

 console.log('Captures completed successfully in:', evidenceDir);
}finally{
 await browser.close();
}
