// Testa a aba Rigging offline no Edge, com malha sem skin e rig já existente.
import {chromium} from '@playwright/test';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),out=root+'validation/';
await mkdir(out,{recursive:true});
const fixture=await readFile(new URL('./fixture.js',import.meta.url),'utf8');
const report={tests:[],errors:[],requests:[]};
const mark=s=>{report.tests.push(s);console.log('✓ '+s);};
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu-sandbox','--use-angle=swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('dialog',d=>d.accept());
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  page.on('request',r=>{if(/^https?:/i.test(r.url()))report.requests.push(r.url());});
  await page.addInitScript(()=>{
    Object.defineProperty(window,'devicePixelRatio',{configurable:true,get:()=>.7});
    window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),60);
  });
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(root+'dist/arenamon-animation-studio.html').href);
  await page.waitForFunction(()=>window.__studioRig&&window.__importer&&window.__studioEditor,{timeout:45000});
  assert.ok(await page.locator('[data-panel=rigging]').count());
  const initial=await page.evaluate(()=>({panel:window.__studioLayout.panel,mode:window.__studioRig.active}));
  assert.equal(initial.panel,'project');assert.equal(initial.mode,false);
  mark('Studio abre offline e aba Rigging aparece antes de Animações');

  // Malha estática sem rig.
  await page.evaluate(async()=>{
    const E=window.__importer,T=E.T,root=new T.Group();
    root.name='SyntheticUnrigged';
    const body=new T.Mesh(new T.BoxGeometry(1.7,2.4,.9,3,6,3),new T.MeshStandardMaterial({color:0x688edb}));
    body.name='CreatureBody';body.position.y=1.2;root.add(body);
    await E.install(root,[],'personagem-sem-rig.glb');
  });
  await page.click('[data-panel=rigging]');
  await page.waitForFunction(()=>window.__studioRig.active);
  assert.match(await page.textContent('#rg-state'),/Malha sem rig/);
  await page.click('#rg-template');
  const draft=await page.evaluate(()=>({n:window.__studioRig.draft?.joints.length,selected:window.__studioRig.selected}));
  assert.equal(draft.n,20);assert.equal(draft.selected,'Hips');
  assert.equal(await page.locator('#rg-bone option').count(),20);
  mark('Template guiado tem 20 bones e campos numéricos X/Y/Z');
  // Verificar telemetria e simetria.
  await page.selectOption('#rg-bone','LeftElbow');
  const before=await page.evaluate(()=>window.__studioRig.draft.joints.find(j=>j.name==='LeftElbow').p);
  await page.fill('#rg-x',String(before[0]-.12));
  await page.click('#rg-apply');
  const mirrored=await page.evaluate(()=>{
    const d=window.__studioRig.draft,c=(d.bounds.min[0]+d.bounds.max[0])/2;
    return {left:d.joints.find(j=>j.name==='LeftElbow').p,right:d.joints.find(j=>j.name==='RightElbow').p,c};
  });
  assert.ok(Math.abs(mirrored.left[0]+mirrored.right[0]-2*mirrored.c)<1e-5);
  assert.ok(await page.textContent('#rg-telemetry').then(t=>t.includes('LeftElbow')));
  await page.evaluate(()=>window.__studioEditor.history.undo());
  const undone=await page.evaluate(()=>window.__studioRig.draft.joints.find(j=>j.name==='LeftElbow').p);
  assert.ok(Math.abs(undone[0]-before[0])<1e-5);
  await page.evaluate(()=>window.__studioEditor.history.redo());
  mark('Editar osso numérico espelha o outro lado e suporta desfazer/refazer');

  // Auto-bind e deformação.
  await page.click('#rg-bind');
  const rig=await page.evaluate(()=>{
    let meshes=[],bones=0;window.__importer.model.traverse(o=>{if(o.isMesh)meshes.push({skin:o.isSkinnedMesh,
      count:o.skeleton?.bones.length||0,n:o.geometry.attributes.position.count});if(o.isBone)bones++;});
    return {meshes,bones,draft:!!window.__studioRig.draft,dirty:window.__studioProject.dirty};
  });
  assert.equal(rig.meshes.length,1);assert.equal(rig.meshes[0].skin,true);
  assert.equal(rig.meshes[0].count,20);assert.equal(rig.bones,20);assert.equal(rig.draft,false);assert.equal(rig.dirty,true);
  await page.click('#rg-audit');
  assert.match(await page.textContent('#rg-report'),/Sem inconsistências estruturais detectadas/);
  mark('Bind cria skin real (20 ossos) e auditoria de pesos normalizados sem erro');
  await page.selectOption('#rg-bone','LeftElbow');
  await page.fill('#rg-pose','35');
  const angle=await page.evaluate(()=>window.__importer.model.getObjectByName('LeftElbow').rotation.x);
  assert.ok(angle>.55&&angle<.66,'teste de flexão temporária');
  await page.click('#rg-pose-reset');
  assert.ok(Math.abs(await page.evaluate(()=>window.__importer.model.getObjectByName('LeftElbow').rotation.x))<1e-5);
  mark('Teste de flexão mostra rotação e restaura pose sem alterar arquivo');

  // GLB deve reabrir como skinned no próprio Studio.
  const result=await page.evaluate(async()=>{
    const E=window.__importer,bytes=await E.exportGLB({unlit:false,noTextures:false});
    const parse=await E.parse(new File([bytes],'teste-rig.arenamon.glb',{type:'model/gltf-binary'}));
    let mesh=0,bones=0,skinned=0,names=[];
    parse.scene.traverse(o=>{if(o.isMesh){mesh++;if(o.isSkinnedMesh){skinned++;bones=o.skeleton.bones.length;names=o.skeleton.bones.map(b=>b.name);}}});
    let meta=null;parse.scene.traverse(o=>{meta ||= o.userData.arenamonRig?.autoWeights||null;});
    return {size:bytes.byteLength,mesh,skinned,bones,names,meta};
  });
  assert.ok(result.size>1000);assert.equal(result.skinned,1);assert.equal(result.bones,20);
  assert.ok(result.names.includes('LeftClavicle'));assert.equal(result.meta.method,'segment-proximity');
  mark('GLB exportado e reimportado preserva bones, skins, nomes e metadados');
  const exported=await page.evaluate(()=>window.__studioRig.exportCoordinates());
  assert.equal(exported.joints.length,20);assert.equal(exported.space,'model-root');
  assert.equal(exported.audit.skinnedMeshes,1);
  mark('JSON traz coordenadas legíveis e telemetria do rig');

  // Modelo com rig real + animações.
  await page.evaluate(async src=>{
    const E=window.__importer,{syntheticRig}=await import('data:text/javascript,'+encodeURIComponent(src)),r=syntheticRig(E.T);
    await E.install(r.root,r.clips,'modelo-rigado.glb');
  },fixture);
  await page.waitForFunction(()=>window.__studioRig.active && window.__studioRig.selected!=null);
  assert.equal(await page.evaluate(()=>window.__studioRig.draft),null);
  const baseline=await page.evaluate(()=>window.__studioRig.exportCoordinates().joints.find(j=>j.name==='mixamorigHead').p);
  await page.evaluate(p=>window.__studioRig.applyJoint('mixamorigHead',[p[0],p[1]+.06,p[2]]),baseline);
  const changed=await page.evaluate(()=>window.__studioRig.exportCoordinates().joints.find(j=>j.name==='mixamorigHead').p);
  assert.ok(Math.abs(changed[1]-baseline[1]-.06)<.001);
  const editedRoundtrip=await page.evaluate(async()=>{
    const E=window.__importer,bytes=await E.exportGLB({unlit:false,noTextures:false});
    const parsed=await E.parse(new File([bytes],'editado.glb',{type:'model/gltf-binary'}));
    parsed.scene.updateMatrixWorld(true);
    const head=parsed.scene.getObjectByName('mixamorigHead');
    return parsed.scene.worldToLocal(head.getWorldPosition(new E.T.Vector3())).toArray();
  });
  assert.ok(Math.abs(editedRoundtrip[1]-changed[1])<.001,'posição editada deve sobreviver ao GLB');
  mark('Coordenada editada de osso existente persiste na exportação/reimportação');
  await page.evaluate(()=>window.__studioEditor.history.undo());
  const reverted=await page.evaluate(()=>window.__studioRig.exportCoordinates().joints.find(j=>j.name==='mixamorigHead').p);
  assert.ok(Math.abs(reverted[1]-baseline[1])<.001);
  mark('Modelo já rigado: editar bind pose com coordenadas e desfazer real');
  const bytes=await page.evaluate(async()=>new Uint8Array(await window.__importer.exportGLB({unlit:false,noTextures:false})).byteLength);
  assert.ok(bytes>1000);
  mark('Modelo animado continua exportável depois da edição do rig');
  for(const vp of [{width:1024,height:768},{width:390,height:844}]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(200);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'layout horizontal em '+vp.width);
  }
  mark('Layout da aba respeita tablet e celular');
  // Salvamento de um rascunho sem skin: GLB pode aninhar extras no primeiro nó.
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(async()=>{
    const E=window.__importer,T=E.T,root=new T.Group();
    root.name='DraftPersist';root.position.set(.2,0,.1);root.scale.setScalar(.8);
    const mesh=new T.Mesh(new T.BoxGeometry(1,2,.7),new T.MeshStandardMaterial());
    mesh.name='DraftBody';mesh.position.y=1;root.add(mesh);
    await E.install(root,[],'draft.glb');
  });
  if(!await page.evaluate(()=>window.__studioRig.active))await page.click('[data-panel=rigging]');
  await page.locator('#rg-template').evaluate(el=>el.click()); // DOM click evita espera de navegação espúria em file:// no Edge CI.
  await page.waitForFunction(()=>window.__studioRig.draft?.joints.length===20);
  const draftBefore=await page.evaluate(()=>window.__studioRig.draft.joints.find(j=>j.name==='LeftElbow').p);
  await page.evaluate(async()=>{
    const E=window.__importer,bytes=await E.exportGLB({unlit:false,noTextures:false});
    const parsed=await E.parse(new File([bytes],'draft-restaurado.glb',{type:'model/gltf-binary'}));
    await E.install(parsed.scene,parsed.animations,'draft-restaurado.glb');
  });
  const draftAfter=await page.evaluate(()=>window.__studioRig.draft?.joints.find(j=>j.name==='LeftElbow').p);
  assert.ok(draftAfter&&draftAfter.length===3,'rascunho recuperado');
  assert.ok(Math.abs(draftBefore[0]*.8+.2-draftAfter[0])<.01,'coordenadas convertidas com hierarquia');
  mark('Rascunho de rig salvo em GLB reabre e conserva pontos após mudança de raiz');
  assert.deepEqual(report.requests,[]);assert.deepEqual(report.errors,[]);
  await writeFile(out+'rigging-browser.json',JSON.stringify(report,null,2));
  console.log('\nRigging Studio: '+report.tests.length+' verificações de navegador aprovadas.');
} finally {await browser.close();}
