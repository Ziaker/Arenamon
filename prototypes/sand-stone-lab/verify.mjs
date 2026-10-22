import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const browser = await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page = await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(pathToFileURL(resolve('prototypes/sand-stone-lab/dist/arenamon-areia-pedra.html')).href);
await page.waitForTimeout(900);
for(const category of ['sand','stone','rock']){
  await page.locator(`#categories [data-category="${category}"]`).click();
  for(let variant=0;variant<3;variant++){
    await page.locator(`#variants [data-variant="${variant}"]`).click();
    const state=await page.evaluate(()=>window.__labDiagnostics());
    if(state.category!==category||state.variant!==variant||!state.hasQuarks)throw new Error(`Seleção inválida: ${JSON.stringify(state)}`);
  }
}
await page.locator('#categories [data-category="sand"]').click();
await page.waitForTimeout(600);
const sand=await page.evaluate(()=>window.__labDiagnostics());
if(sand.particleSystems<1)throw new Error('Sand Wave não emitiu partículas Quarks');
await page.locator('#categories [data-category="stone"]').click();
await page.waitForTimeout(850);
const stone=await page.evaluate(()=>window.__labDiagnostics());
if(stone.particleSystems<1)throw new Error('Emerging Stone não emitiu partículas Quarks');
await page.locator('#sliders input').first().fill('0.8');
await page.locator('#replay').click();
if(errors.length)throw new Error(errors.join('\n'));
console.log('OK: 9 propostas, sliders, replay e emissões reais de three.quarks no HTML offline');
await browser.close();
