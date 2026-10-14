import {chromium} from '@playwright/test';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('.',import.meta.url));
const browser=await chromium.launch({channel:'msedge',headless:true});
const json=bytes=>JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
function values(bytes,doc,index){const a=doc.accessors[index],v=doc.bufferViews[a.bufferView],start=28+bytes.readUInt32LE(12)+v.byteOffset+(a.byteOffset||0),width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],size={5121:1,5123:2,5125:4,5126:4}[a.componentType],read={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'}[a.componentType];return Array.from({length:a.count*width},(_,i)=>bytes[read](start+Math.floor(i/width)*(v.byteStride||width*size)+(i%width)*size));}
try{
 const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.context().setOffline(true);await page.goto(pathToFileURL(root+'dist/importador-prototipo.html').href);await page.waitForFunction(()=>window.__importer);
 await page.evaluate(()=>{
 const {T,install,append}=window.__importer,root=new T.Group(),bone=new T.Bone();bone.name='Hips';root.add(bone);
 const geometry=new T.BoxGeometry(),n=geometry.attributes.position.count;
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(n*4),4));const weights=new Float32Array(n*4);for(let i=0;i<n;i++)weights[i*4]=1;geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
 const tex=new T.DataTexture(new Uint8Array([255,0,0,255]),1,1);tex.needsUpdate=true;
 const material=new T.MeshStandardMaterial({map:tex,normalMap:tex,roughnessMap:tex,metalnessMap:tex,emissiveMap:tex,alphaMap:tex});const mesh=new T.SkinnedMesh(geometry,material);mesh.name='Body';root.add(mesh);mesh.bind(new T.Skeleton([bone]));root.add(new T.PointLight());
 install(root,[new T.AnimationClip('idle',1,[new T.VectorKeyframeTrack('Hips.position',[0,1],[0,0,0,0,1,0])])]);
 append([new T.AnimationClip('walk',1,[new T.QuaternionKeyframeTrack('mixamorigHips.quaternion',[0,1],[0,0,0,1,0,0,0.70710678,0.70710678])])]);
 append([new T.AnimationClip('run',1,[new T.VectorKeyframeTrack('Hips.position',[0,1],[0,0,0,1,0,0])])]);
 let rejected=false;try{append([new T.AnimationClip('invalid',1,[new T.VectorKeyframeTrack('Unknown.position',[0,1],[0,0,0,0,0,0])])]);}catch{rejected=true;}if(!rejected||window.__importer.clips.length!==3)throw Error('Incompatible rig not rejected atomically');
 });
 for(const id of ['textures','lighting']){await page.check('#'+id);await page.uncheck('#'+id);}
 await page.selectOption('#palette','global');await page.selectOption('#palette','palette');
 await mkdir(root+'validation',{recursive:true});
 // Exercise renaming and exported action references through the actual UI.
 await page.selectOption('#clip','1');await page.fill('#clip-name','idle');await page.click('#rename-clip');
 assert.equal(await page.evaluate(()=>window.__importer.clips[1].name),'walk');
 await page.fill('#clip-name','  ');await page.click('#rename-clip');assert.equal(await page.evaluate(()=>window.__importer.clips[1].name),'walk');
 await page.fill('#clip-name','alt tackle');await page.click('#rename-clip');
 await page.selectOption('#action-idle','0');await page.selectOption('#action-tackle','2');await page.selectOption('#action-extra_1','1');
 assert.match(await page.locator('#action-progress').textContent(),/2\/23/);
 await page.fill('#alt-chance','35');
 async function downloadMap(name){const pending=page.waitForEvent('download');await page.click('#export-json');const path=root+'validation/'+name;await(await pending).saveAs(path);return JSON.parse(await readFile(path,'utf8'));}
 let mapping=await downloadMap('actions.json');assert.equal(mapping.actions.idle.clipName,'idle');assert.equal(mapping.extras.extra_1.alternativeFor,'tackle');assert.equal(mapping.randomAlternatives.probability,.35);assert.equal(mapping.missingActions.length,21);assert.deepEqual(mapping.warnings,[]);
 // Exact phrase matching must distinguish directions, block phases and ambiguous names.
 for(const [name,target] of [['alt walk back','walk_back'],['alt dodge left','dodge_left'],['alt block end','block_end'],['alt blocked','blocked'],['alt move 4','move_4'],['alt tackle alt hit',null],['tackle alternative',null]]){
 await page.fill('#clip-name',name);await page.click('#rename-clip');mapping=await downloadMap('variant.json');assert.equal(mapping.extras.extra_1.alternativeFor,target);
 }
 assert.ok(mapping.warnings.length);await page.fill('#clip-name','alt tackle');await page.click('#rename-clip');
 await page.selectOption('#clip','2');await page.fill('#clip-name','Tackle principal');await page.click('#rename-clip');mapping=await downloadMap('actions.json');assert.equal(mapping.actions.tackle.clipName,'Tackle principal');
 async function download(name){const pending=page.waitForEvent('download');await page.click('#export');const d=await pending;const path=root+'validation/'+name;await d.saveAs(path);return {path,doc:json(await readFile(path))};}
 function check(doc,count){assert.equal(doc.animations.length,count);assert.ok(!doc.textures?.length);assert.ok(!doc.images?.length);assert.ok(doc.materials.every(m=>m.extensions?.KHR_materials_unlit));assert.ok(!doc.extensionsUsed?.includes('KHR_lights_punctual'));assert.ok(doc.skins.length);assert.ok(doc.meshes.some(m=>m.primitives.every(p=>p.attributes.JOINTS_0!==undefined&&p.attributes.WEIGHTS_0!==undefined)));}
 const fixture=await download('fixture.glb');check(fixture.doc,3);
 assert.deepEqual(fixture.doc.animations.map(a=>a.name),['idle','alt tackle','Tackle principal']);
 await page.setInputFiles('#model',fixture.path);await page.waitForFunction(()=>window.__importer.clips.length===3&&window.__importer.model.getObjectByName('Body')?.material.isMeshBasicMaterial);
 await page.waitForFunction(()=>document.getElementById('action-extra_1').value==='1');assert.deepEqual(await downloadMap('restored-actions.json'),mapping);
 await page.screenshot({path:root+'validation/actions.png'});
 const deform=await page.evaluate(()=>{const {T,model,clips}=window.__importer,mesh=model.getObjectByName('Body'),mixer=new T.AnimationMixer(model);mixer.clipAction(clips[0]).play();mixer.setTime(0);model.updateMatrixWorld(true);mesh.skeleton.update();const a=mesh.getVertexPosition(0,new T.Vector3()).toArray();mixer.setTime(.5);model.updateMatrixWorld(true);mesh.skeleton.update();const b=mesh.getVertexPosition(0,new T.Vector3()).toArray();return {a,b};});assert.notDeepEqual(deform.a,deform.b);
 const report={synthetic:{animations:3,noTextures:true,unlit:true,skinningDeforms:true},actionEditor:{rename:true,duplicateAndEmptyRejected:true,actions:23,extras:4,jsonReferences:true,alternativeNames:true,glbRoundtrip:true},errors,network};
 if(process.env.ARENAMON_LOCAL_MODEL){const source=process.env.ARENAMON_LOCAL_MODEL,sourceBytes=await readFile(source),original=json(sourceBytes);await page.setInputFiles('#model',source);await page.waitForFunction(n=>window.__importer.clips.length===n,original.animations.length);const result=await download('local-prototype.glb'),resultBytes=await readFile(result.path);check(result.doc,original.animations.length);
 assert.deepEqual(result.doc.animations.map(a=>a.name),original.animations.map(a=>a.name));assert.deepEqual(result.doc.skins.map(s=>s.joints.map(i=>result.doc.nodes[i].name)),original.skins.map(s=>s.joints.map(i=>original.nodes[i].name)));
 const hierarchy=doc=>doc.nodes.filter(n=>doc.skins.some(s=>s.joints.includes(doc.nodes.indexOf(n)))).map(n=>[n.name,(n.children||[]).map(i=>doc.nodes[i].name)]);assert.deepEqual(hierarchy(result.doc),hierarchy(original));
 const sizes=doc=>doc.meshes.flatMap(m=>m.primitives.map(p=>[doc.accessors[p.attributes.POSITION].count,doc.accessors[p.attributes.JOINTS_0]?.count,doc.accessors[p.attributes.WEIGHTS_0]?.count]));assert.deepEqual(sizes(result.doc),sizes(original));
 for(let i=0;i<original.meshes.length;i++)for(let j=0;j<original.meshes[i].primitives.length;j++)for(const attribute of ['POSITION','JOINTS_0','WEIGHTS_0']){const a=original.meshes[i].primitives[j].attributes[attribute],b=result.doc.meshes[i].primitives[j].attributes[attribute];const actual=values(resultBytes,result.doc,b),expected=values(sourceBytes,original,a);assert.equal(actual.length,expected.length);assert.ok(actual.every((v,k)=>Math.abs(v-expected[k])<=(attribute==='WEIGHTS_0'?1e-6:0)),attribute);}
 original.animations.forEach((a,i)=>{assert.equal(result.doc.animations[i].channels.length,a.channels.length);a.samplers.forEach((s,j)=>{for(const key of ['input','output'])assert.deepEqual(values(resultBytes,result.doc,result.doc.animations[i].samplers[j][key]),values(sourceBytes,original,s[key]));});});
 original.skins.forEach((s,i)=>assert.deepEqual(values(resultBytes,result.doc,result.doc.skins[i].inverseBindMatrices),values(sourceBytes,original,s.inverseBindMatrices)));
 report.local={animations:result.doc.animations.length,skins:result.doc.skins.length,noTextures:true,unlit:true,boneHierarchyPreserved:true};}
 await page.screenshot({path:root+'validation/preview.png'});assert.deepEqual(errors,[]);assert.deepEqual(network,[]);await writeFile(root+'validation/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}

