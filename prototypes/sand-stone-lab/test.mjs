// CPU-only verification. Does not launch, inspect or control any browser.
import {RushEffect} from './src/rush-effects.ts';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readFile} from 'node:fs/promises';
import {Particles} from './src/particles.js';
import {SandEffect,StoneEffect,RockEffect} from './src/effects.js';
import {disposeGroup} from './src/art.js';
import {defaults} from './src/config.ts';
import {SwiftEffect,PsyshockEffect} from './src/new-effects.ts';

const scene=new T.Scene(),stage=new T.Group();scene.add(stage);
const particles=new Particles(scene,{textures:false});
const options={...defaults.sand,...defaults.stone,...defaults.rock};
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
for(const category of ['swift','psyshock'])for(let variant=0;variant<3;variant++){
  const effect=category==='swift'?new SwiftEffect(stage,particles,variant,defaults.swift):new PsyshockEffect(stage,particles,variant,defaults.psyshock,5);
  if(category==='psyshock'){
    const legacy=[];stage.traverse(o=>{if(['PlaneGeometry','TorusGeometry','CylinderGeometry'].includes(o.geometry?.type))legacy.push(o.geometry.type);});
    // Stage markers have two torus foot rings; PSI itself must have no legacy aura or backdrop.
    assert.deepEqual(legacy,['TorusGeometry','TorusGeometry'],'PSI não pode reintroduzir fundo, túnel ou giroscópios');
    assert.equal(effect.stones.length,5);
    for(const stone of effect.stones)assert.ok(stone.children.some(o=>o.name==='psi-local-glyph'),'Glifo precisa acompanhar cada pedra');
  }
  let peak=0;for(let tick=0;tick<=Math.ceil(effect.duration*60);tick++){effect.update(tick/60,1/60);particles.update(1/60);peak=Math.max(peak,particles.count);}
  assert.ok(peak>0,`${category}/${variant}: sem partículas Quarks`);reports.push({category,variant,peak});particles.clear();disposeGroup(stage);assert.equal(particles.count,0);
}
for(const kind of ['bulletpunch','quickattack'])for(let variant=0;variant<3;variant++){
 const fx=new RushEffect(stage,particles,kind,variant,defaults[kind]);
 fx.update(0,0);const start=fx.actor.position.clone();fx.update(defaults[kind].chargeTime+defaults[kind].travelTime,0);
 assert.ok(fx.actor.position.z>start.z+4,'O ator precisa percorrer o trajeto');
 let peak=0;for(let i=0;i<=Math.ceil(fx.duration*60);i++){fx.update(i/60,1/60);particles.update(1/60);peak=Math.max(peak,particles.count);stage.traverse(o=>{assert.ok([o.position.x,o.position.y,o.position.z,o.scale.x,o.scale.y,o.scale.z].every(Number.isFinite));if(o.geometry)for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));});}
 assert.ok(peak>0);assert.ok(fx.punch<.01,'Tremor deve decair');assert.equal(fx.actor.visible,false);particles.clear();disposeGroup(stage);
}
const fadeEffect=new SwiftEffect(stage,particles,0,defaults.swift);fadeEffect.update(1.46,0);const star=fadeEffect.stars[0].children.find(o=>o.geometry?.type==='ShapeGeometry'),before=star.material.opacity;fadeEffect.update(1.75,0);assert.ok(star.material.opacity<before,'Dissipação do Swift deve alterar opacidade visível');particles.clear();disposeGroup(stage);
const narrow=new StoneEffect(stage,particles,0,{...defaults.stone,crackWidth:.4},null,0);const narrowSize=narrow.cracks.children[0].geometry.boundingSphere?.radius??(narrow.cracks.children[0].geometry.computeBoundingSphere(),narrow.cracks.children[0].geometry.boundingSphere.radius);particles.clear();disposeGroup(stage);
const wide=new StoneEffect(stage,particles,0,{...defaults.stone,crackWidth:2},null,0);wide.cracks.children[0].geometry.computeBoundingSphere();assert.ok(wide.cracks.children[0].geometry.boundingSphere.radius>narrowSize,'Largura das rachaduras deve alterar geometria');particles.clear();disposeGroup(stage);
// At size/speed extremes, transitions must still emit and finish without NaNs.
for(const density of [.25,2]){
  const fx=new StoneEffect(stage,particles,1,{...options,density,rise:.2,scale:1.5},null,1);
  for(let i=0;i<240;i++){fx.update(i/60,1/60);particles.update(1/60);}particles.clear();disposeGroup(stage);
}
const main=await readFile(new URL('src/main.js',import.meta.url),'utf8'),template=await readFile(new URL('src/template.html',import.meta.url),'utf8');
for(const [,id] of main.matchAll(/\$\('([\w-]+)'\)/g))assert.ok(template.includes(`id="${id}"`),`Controle ausente: ${id}`);
const html=await readFile(new URL('dist/arenamon-areia-pedra.html',import.meta.url),'utf8');assert.ok(!/<script[^>]+src\s*=/.test(html));assert.ok(!/<link[^>]+href\s*=/.test(html));
console.log(JSON.stringify(reports,null,2));console.log('PASS: 21 ciclos, partículas Quarks, geometrias, controles, cleanup e bundle offline. Renderização GPU verificada separadamente.');
