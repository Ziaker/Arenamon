import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile,mkdir} from 'node:fs/promises';

const browser = await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page = await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'&&/shader|webgl|compile/i.test(m.text()))errors.push(m.text());});
await page.goto(pathToFileURL(resolve('prototypes/sand-stone-lab/dist/arenamon-areia-pedra.html')).href);
await page.waitForTimeout(900);
for(const category of ['sand','stone','rock','swift','psyshock','bulletpunch','quickattack']){
  await page.locator(`#categories [data-category="${category}"]`).click();
  for(let variant=0;variant<3;variant++){
    await page.locator(`#variants [data-variant="${variant}"]`).click();
    const state=await page.evaluate(()=>window.__labDiagnostics());
    if(state.category!==category||state.variant!==variant||!state.hasQuarks)throw new Error(`Seleção inválida: ${JSON.stringify(state)}`);
  }
}
await page.locator('#categories [data-category="sand"]').click();
await page.waitForFunction(()=>window.__labDiagnostics().particles>80);
const sand=await page.evaluate(()=>window.__labDiagnostics());
if(sand.particles<1)throw new Error('Sand Wave não emitiu partículas Quarks');
await page.locator('#categories [data-category="stone"]').click();
await page.waitForFunction(()=>window.__labDiagnostics().particles>80);
const stone=await page.evaluate(()=>window.__labDiagnostics());
if(stone.particles<1)throw new Error('Emerging Stone não emitiu partículas Quarks');
await page.locator('#sliders input').first().fill('0.8');
await page.locator('#replay').click();
await page.locator('#categories [data-category="swift"]').click();
await page.waitForFunction(()=>window.__labDiagnostics().particles>0);
await page.locator('#categories [data-category="psyshock"]').click();
await page.waitForFunction(()=>window.__labDiagnostics().particles>0);
await page.locator('#variants [data-variant="1"]').click();
await page.locator('#sliders input').first().fill('1.35');
const singlePromise=page.waitForEvent('download');await page.locator('#export-one').click();const single=JSON.parse(await readFile(await (await singlePromise).path(),'utf8'));
if(single.category!=='psyshock'||single.variant!=='B'||single.visualParameters.auraRadius!==1.35)throw Error('Exportação individual incorreta');
await page.locator('#sliders input').first().fill('1.7');page.once('dialog',d=>d.accept());
await page.locator('#import-file').setInputFiles({name:'preset.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(single))});
await page.waitForFunction(()=>document.querySelector('#sliders input').value==='1.35');
const allPromise=page.waitForEvent('download');await page.locator('#export-all').click();const all=JSON.parse(await readFile(await (await allPromise).path(),'utf8'));
if(Object.keys(all.presets).length!==7)throw Error('Exportação total incorreta');
if(errors.length)throw new Error(errors.join('\n'));
await mkdir('prototypes/sand-stone-lab/evidence',{recursive:true});await page.setViewportSize({width:1280,height:720});
await page.locator('#categories [data-category="swift"]').click();await page.locator('#variants [data-variant="2"]').click();await page.locator('#scrub').evaluate(el=>{el.value='0.9';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.screenshot({path:'prototypes/sand-stone-lab/evidence/swift-c-720p.png'});
await page.locator('#categories [data-category="psyshock"]').click();await page.locator('#variants [data-variant="2"]').click();await page.locator('#scrub').evaluate(el=>{el.value='1.55';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.screenshot({path:'prototypes/sand-stone-lab/evidence/psyshock-c-720p.png'});
console.log('OK: 21 propostas, sliders, replay e emissões reais de three.quarks no HTML offline');
await browser.close();
