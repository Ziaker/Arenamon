// CPU-only verification. Does not launch, inspect or control any browser.
import assert from 'node:assert/strict';
import * as T from 'three';
import {readFile} from 'node:fs/promises';
import {Particles} from './src/particles.js';
import {SandEffect,StoneEffect,RockEffect} from './src/effects.js';
import {disposeGroup} from './src/art.js';

const scene=new T.Scene(),stage=new T.Group();scene.add(stage);
const particles=new Particles(scene,{textures:false});
const options={length:4,width:3.4,height:1.25,density:1,smoke:.8,warning:.7,rise:.4,scale:1,rotation:25,turn:10};
const reports=[];
for(const category of ['sand','stone','rock'])for(let variant=0;variant<3;variant++){
  const effect=category==='sand'?new SandEffect(stage,particles,variant,options):category==='stone'?new StoneEffect(stage,particles,variant,options,null,variant):new RockEffect(stage,variant,options,null);
  let maxParticles=0,peakSystems=0,finite=0;
  for(let tick=0;tick<=Math.ceil(effect.duration*60);tick++){
    effect.update(tick/60,1/60);particles.update(1/60);maxParticles=Math.max(maxParticles,particles.count);peakSystems=Math.max(peakSystems,particles.systems.length);
    for(const {system} of particles.systems)for(let i=0;i<system.particleNum;i++){
      const p=system.particles[i];assert.ok([p.position.x,p.position.y,p.position.z,p.size.x,p.size.y,p.size.z].every(Number.isFinite),'Partícula inválida');finite++;
    }
    stage.updateMatrixWorld(true);
  }
  if(category!=='rock')assert.ok(maxParticles>80,`${category}/${variant}: partículas Quarks não nasceram`);
  stage.traverse(o=>{
    if(o.geometry){for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));}
    if(o.material?.isShaderMaterial){const source=o.material.fragmentShader;assert.ok(!/[^\n\s]#include/.test(source));for(const [,name] of source.matchAll(/#include <(\w+)>/g))assert.ok(T.ShaderChunk[name],name);}
  });
  reports.push({category,variant,maxParticles,peakSystems,finiteSamples:finite});particles.clear();disposeGroup(stage);assert.equal(particles.count,0);
}
// At size/speed extremes, transitions must still emit and finish without NaNs.
for(const density of [.25,2]){
  const fx=new StoneEffect(stage,particles,1,{...options,density,rise:.2,scale:1.5},null,1);
  for(let i=0;i<240;i++){fx.update(i/60,1/60);particles.update(1/60);}particles.clear();disposeGroup(stage);
}
const main=await readFile(new URL('src/main.js',import.meta.url),'utf8'),template=await readFile(new URL('src/template.html',import.meta.url),'utf8');
for(const [,id] of main.matchAll(/\$\('([\w-]+)'\)/g))assert.ok(template.includes(`id="${id}"`),`Controle ausente: ${id}`);
const html=await readFile(new URL('dist/arenamon-areia-pedra.html',import.meta.url),'utf8');assert.ok(!/<script[^>]+src\s*=/.test(html));assert.ok(!/<link[^>]+href\s*=/.test(html));
console.log(JSON.stringify(reports,null,2));console.log('PASS: nove ciclos, partículas reais e finitas, geometrias, controles, cleanup e bundle offline. Renderização GPU NÃO verificada.');
