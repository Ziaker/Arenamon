import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const dir='prototypes/sand-stone-lab/evidence/revision-5';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],reports=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(pathToFileURL(resolve('prototypes/sand-stone-lab/dist/arenamon-areia-pedra.html')).href);await page.waitForFunction(()=>!!window.__labDiagnostics);
 const names={bulletpunch:['Pistão de aço','Broca helicoidal','Rajada de punhos'],quickattack:['Arrancada supersônica','Passo em zigue-zague','Salto de imagem']};
 const seek=async time=>{await page.locator('#scrub').evaluate((el,t)=>{el.value=String(t);el.dispatchEvent(new Event('input',{bubbles:true}));},time);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));};
 for(const category of ['bulletpunch','quickattack'])for(let variant=0;variant<3;variant++){
  await page.locator(`[data-category="${category}"]`).click();await page.locator(`[data-variant="${variant}"]`).click();
  const phases=category==='bulletpunch'?{charge:.2,flight:.62,impact:1.02}:{charge:.2,flight:.65,impact:1.1};
  for(const [phase,time] of Object.entries(phases)){
   await seek(time);const report=await page.evaluate(()=>window.__labDiagnostics());reports.push({...report,phase});assert.ok(report.drawCalls>5,'Contagem de draw calls deve incluir a cena');
   await page.screenshot({path:`${dir}/${category}-${'abc'[variant]}-${phase}.png`});
  }
  console.log(`Capturado ${category} ${'ABC'[variant]}: carga, voo e impacto`);
 }
 // Check resources after cycling all six visual constructions twice, returning to the same scene.
 await page.locator('[data-category="bulletpunch"]').click();await page.locator('[data-variant="0"]').click();await seek(.62);const before=await page.evaluate(()=>window.__labDiagnostics());
 for(let round=0;round<2;round++)for(const c of ['bulletpunch','quickattack'])for(let v=0;v<3;v++){await page.locator(`[data-category="${c}"]`).click();await page.locator(`[data-variant="${v}"]`).click();await seek(c==='bulletpunch'?.62:.65);}
 await page.locator('[data-category="bulletpunch"]').click();await page.locator('[data-variant="0"]').click();await seek(.62);const after=await page.evaluate(()=>window.__labDiagnostics());
 assert.ok(after.geometries<=before.geometries+3,`Geometrias acumulando: ${before.geometries} -> ${after.geometries}`);assert.ok(after.textures<=before.textures+1,'Texturas acumulando');assert.equal(errors.length,0,errors.join('\n'));
 await writeFile(`${dir}/diagnostics.json`,JSON.stringify({viewport:'1280x720',renderer:'Edge / ANGLE SwiftShader',reports,cleanup:{before,after},errors},null,2));
 const cards=Object.entries(names).flatMap(([category,list])=>list.map((name,i)=>`<article><p>${category.toUpperCase()} · ${'ABC'[i]}</p><h2>${name}</h2><a class="shot" href="${category}-${'abc'[i]}-flight.png"><img data-prefix="${category}-${'abc'[i]}" src="${category}-${'abc'[i]}-flight.png" alt="${name}"></a></article>`)).join('');
 await writeFile(`${dir}/index.html`,`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atelier VFX · revisão 5</title><style>*{box-sizing:border-box}body{margin:0;background:#0b1119;color:#e5e8ed;font:15px system-ui;padding:32px}header{max-width:1600px;margin:auto}a{color:#e5c480}h1{font-size:34px}p{color:#99aabd}nav{display:flex;gap:12px;margin:24px 0}button{padding:12px 22px;background:#202e3d;color:#f3dfb5;border:1px solid #566474;border-radius:6px;cursor:pointer}button.active{background:#d8b978;color:#111}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;max-width:1600px;margin:auto}article{background:#141e29;border:1px solid #2b3d50;border-radius:12px;overflow:hidden}article p,article h2{padding:0 18px}h2{font-size:21px}img{width:100%;display:block}@media(max-width:950px){main{grid-template-columns:1fr}}footer{max-width:1600px;margin:24px auto}</style><header><a href="../../../../ABRIR_ARENAMON.html">← Portal Arenamon</a> · <a href="../../dist/arenamon-areia-pedra.html">Abrir atelier animado</a><h1>Bullet Punch e Quick Attack · VOL. 05</h1><p>Capturas reais a 720p, com o mesmo enquadramento. Selecione uma fase e clique na imagem para ampliar. Prévia artística, sem mudança nas regras de combate.</p><nav>${['charge','flight','impact'].map((p,i)=>`<button data-phase="${p}" class="${i===1?'active':''}">${['Carga','Voo','Impacto'][i]}</button>`).join('')}</nav></header><main>${cards}</main><footer>Verificação no Edge / SwiftShader. <a href="diagnostics.json">Contagem de partículas, draw calls e recursos</a></footer><script>for(const button of document.querySelectorAll('button'))button.onclick=()=>{for(const b of document.querySelectorAll('button'))b.classList.toggle('active',b===button);for(const img of document.querySelectorAll('img')){const src=img.dataset.prefix+'-'+button.dataset.phase+'.png';img.src=src;img.parentElement.href=src;}};</script></html>`);
 console.log('PASS: 18 capturas, seis construções distintas, shaders/WebGL sem erros e recursos estáveis após trocas.');
}finally{await browser.close();}
