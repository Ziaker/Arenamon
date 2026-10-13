import {chromium} from '@playwright/test';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';

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

 console.log('Capturing redesigned animations...');

 // 1. RUN: Side view at push-off (t = 0.22s) and flight (t = 0.31s)
 await page.click('[data-state="run"]');
 await page.click('[data-view="1.5707963267948966"]'); // Side view
 await sample('run', 0.22);
 await page.locator('.viewport-wrap').screenshot({path:`${evidenceDir}redesign-run-impulso-extensao-side.png`});

 await sample('run', 0.31);
 await page.locator('.viewport-wrap').screenshot({path:`${evidenceDir}redesign-run-suspensao-aerea-side.png`});

 // 2. RUN: Front view at sprint drive
 await page.click('[data-view="0"]'); // Front view
 await sample('run', 0.22);
 await page.locator('.viewport-wrap').screenshot({path:`${evidenceDir}redesign-run-impulso-front.png`});

 // 3. TACKLE (Investida) vs ESQUIVA FRONTAL (Front Dodge):
 // Tackle coil
 await page.click('[data-view="1.5707963267948966"]');
 await sample('tackle', 0.05);
 await page.locator('.viewport-wrap').screenshot({path:`${evidenceDir}redesign-tackle-01-coil.png`});

 // Tackle explosive torpedo thrust
 await sample('tackle', 0.14);
 await page.locator('.viewport-wrap').screenshot({path:`${evidenceDir}redesign-tackle-02-torpedo-launch.png`});

 // Front dodge low evasive slip
 await sample('front', 0.05);
 await page.locator('.viewport-wrap').screenshot({path:`${evidenceDir}redesign-front-01-evasive-drop.png`});

 await sample('front', 0.14);
 await page.locator('.viewport-wrap').screenshot({path:`${evidenceDir}redesign-front-02-low-slide.png`});

 // 4. WALK: Foot roll & weight shift
 await sample('walk', 0.15);
 await page.locator('.viewport-wrap').screenshot({path:`${evidenceDir}redesign-walk-down-side.png`});
 await sample('walk', 0.50);
 await page.locator('.viewport-wrap').screenshot({path:`${evidenceDir}redesign-walk-passing-side.png`});

 // 5. IDLE: Fighting stance presence
 await page.click('[data-view="0"]');
 await sample('idle', 0.80);
 await page.locator('.viewport-wrap').screenshot({path:`${evidenceDir}redesign-idle-front.png`});

 console.log('Redesign captures completed!');
}finally{
 await browser.close();
}
