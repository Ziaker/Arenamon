import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const root=new URL('.',import.meta.url);
await mkdir(new URL('validation/',root),{recursive:true});
await build({stdin:{contents:`export * from './src/game'; export * from './src/entity'; export * from './src/config'; export * from './src/math'; export * from './src/physics'; export * from './src/combat'; export * from './src/commands'; export * from './src/camera'; export * from './src/locomotion';`,resolveDir:fileURLToPath(root)},bundle:true,platform:'node',format:'esm',outfile:fileURLToPath(new URL('validation/simulation.mjs',root))});
const {Game,FixedClock,TEST,RULES,idle,vec,length,sub,scale,unit,dot,direction,invulnerable,offensive,contact,pushDistance,contactDirection,nominalDistance,strike}=await import(new URL('validation/simulation.mjs',root));
const passed=[];
const test=(name,fn)=>{fn();passed.push(name);console.log('PASS',name);};
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const setup=()=>{const g=new Game();g.mode='inactive';g.reset();g.fighters[1].position=vec(8,8);return g;};
const cmd=(move=vec(),extra={})=>({...idle(),move,...extra});
const run=(g,n,c=idle(),enemy)=>{for(let i=0;i<n;i++)g.step(typeof c==='function'?c(i):c,enemy);};
test('movement forward/lateral/diagonal normalized and release/reverse',()=>{
 const distances=[];
 for(const v of [vec(0,1),vec(1,0),vec(1,1)]){const g=setup(),p={...g.fighters[0].position};run(g,120,cmd(v));distances.push(length(sub(g.fighters[0].position,p)));assert.ok(distances.at(-1)>3.85&&distances.at(-1)<4);const stop={...g.fighters[0].position};run(g,12);assert.ok(length(sub(g.fighters[0].position,stop))<.09);near(length(g.fighters[0].velocity),0);run(g,12,cmd(vec(-v.x,-v.z)));assert.ok(length(sub(g.fighters[0].position,stop))>.2);}
 near(distances[0],distances[1]);near(distances[0],distances[2]);
});
test('400ms dodge, 200ms immunity, 70/30 distance and no residual',()=>{
 const g=setup(),f=g.fighters[0],start={...f.position};g.step(cmd(vec(0,1),{dodge:true}));assert.ok(invulnerable(f));run(g,22);assert.ok(invulnerable(f));g.step();assert.ok(!invulnerable(f));near(length(sub(f.position,start)),nominalDistance(f)*.7);run(g,24);assert.equal(f.action,null);near(length(sub(f.position,start)),nominalDistance(f));const end={...f.position};run(g,10);near(length(sub(f.position,end)),0);
});
test('Etapa A: C never offensive, X always offensive; both steer at most 30 degrees and 180/s',()=>{
 for(const v of [vec(1,0),vec(0,-1)]){const g=setup();g.step(cmd(v,{dodge:true}));assert.ok(!offensive(g.fighters[0]));assert.equal(g.fighters[0].action.kind,'dodge');
  const x=setup();x.step(cmd(v,{tackle:true}));assert.ok(offensive(x.fighters[0]));assert.equal(x.fighters[0].action.kind,'tackle');}
 for(const kind of ['dodge','tackle']){const g=setup();g.step(cmd(vec(0,1),{[kind]:true}));const f=g.fighters[0];let last=f.action.heading;for(let i=0;i<40;i++){g.step(cmd(vec(1,0)));if(f.action){assert.ok(Math.abs(f.action.heading-last)<=Math.PI*TEST.step+1e-8);assert.ok(Math.abs(f.action.heading)<=Math.PI/6+1e-8);last=f.action.heading;}}}
});
test('dodge chains only after 200ms and smooth reversal without added impulses',()=>{
 const g=setup(),f=g.fighters[0];g.step(cmd(vec(0,1),{dodge:true}));run(g,10);g.step(cmd(vec(0,-1),{dodge:true}));near(f.regenBase,2);run(g,12);g.step(cmd(vec(0,-1),{dodge:true}));near(f.regenBase,1);assert.ok(f.velocity.z>0);assert.ok(invulnerable(f));run(g,12);assert.ok(f.velocity.z<0);
});
test('three dodges exhaust; cubic regen waits 1s then takes 5s; defense stacks speed',()=>{
 const g=setup(),f=g.fighters[0];for(let i=0;i<3;i++){g.step(cmd(vec(1,0),{dodge:true}));run(g,47);}assert.ok(f.exhausted);g.step(cmd(vec(0,1),{dodge:true}));assert.equal(f.action,null);run(g,8,cmd(vec(0,1),{guard:true}));near(length(f.velocity),4*.42);run(g,182);assert.ok(f.stamina>0&&f.stamina<1);run(g,600);near(f.stamina,3);assert.ok(!f.exhausted);
});
test('walls slide and stable body contact: no penetration, tunnel or invalid velocity',()=>{
 const g=setup(),f=g.fighters[0];f.position=vec(9.4,-4);g.step(cmd(vec(1,1),{dodge:true}));run(g,47,cmd(vec(1,1)));near(f.position.x,9.5);assert.ok(f.position.z>-3);
 g.fighters[0].position=vec(0,8.5);g.fighters[1].position=vec(0,9.5);for(let i=0;i<1200;i++){g.step(cmd(vec(0,1)));const c=contact(...g.fighters);assert.ok(!c||c.depth<1e-7);for(const b of g.fighters){assert.ok(Number.isFinite(b.velocity.x+b.velocity.z));assert.ok(Math.abs(b.position.x)<=9.5&&Math.abs(b.position.z)<=9.5);}}
});
test('box volumes: corner contact differs from center-radius approximation',()=>{
 const g=setup();g.fighters[0].position=vec(0,0);g.fighters[1].position=vec(.9,.9);assert.ok(contact(...g.fighters));g.fighters[1].position=vec(1.01,0);assert.equal(contact(...g.fighters),null);
});
test('tackle requires contact and applies one damage per target with physical push',()=>{
 const g=setup(),a=g.fighters[0],b=g.fighters[1];a.position=vec(0,0);b.position=vec(0,2);g.step(cmd(vec(0,1),{tackle:true,target:1}));run(g,47);near(b.hp,80);assert.ok(b.position.z>2);assert.equal(g.events.filter(e=>e.result==='impact').length,1);
 const miss=setup();miss.step(cmd(vec(0,1),{tackle:true}));run(miss,48);near(miss.fighters[1].hp,100);
});
test('partial defense: half damage, 200ms guard stun and 15% recoil over 300ms',()=>{
 const g=setup(),a=g.fighters[0],b=g.fighters[1];a.position=vec(0,0);b.position=vec(0,2);b.guard=true;b.perfectCooldown=2;
 const guard=cmd(vec(),{guard:true,target:0});g.step(cmd(vec(0,1),{tackle:true,target:1}),guard);while(a.action?.kind!=='recoil')g.step(idle(),guard);
 near(b.hp,90);near(b.stun,.2);near(a.action.elapsed,0);const start={...a.position};run(g,35,idle(),guard);assert.equal(a.action.kind,'recoil');g.step(idle(),guard);assert.equal(a.action,null);near(length(sub(a.position,start)),nominalDistance(a)*.15);assert.equal(a.hp,100);
});
test('perfect guard blocks damage/push and failure imposes 2s cooldown',()=>{
 const g=setup(),a=g.fighters[0],b=g.fighters[1];a.position=vec(0,0);b.position=vec(0,1.15);const before={...b.position};g.step(cmd(vec(0,1),{tackle:true,target:1}),cmd(vec(),{guard:true,guardPressed:true,target:0}));run(g,3,idle(),cmd(vec(),{guard:true,target:0}));near(b.hp,100);assert.equal(b.push,null);assert.ok(g.events.some(e=>e.result==='perfect'));assert.ok(b.perfectSucceeded);
 const fail=setup();fail.step(cmd(vec(),{guard:true,guardPressed:true}));run(fail,24,cmd(vec(),{guard:true}));assert.ok(fail.fighters[0].perfectCooldown>1.98);
});
test('back attacks bypass guard; dodge invulnerability turns an incoming tackle into a perfect dodge',()=>{
 const g=setup(),a=g.fighters[0],b=g.fighters[1];a.position=vec(0,0);b.position=vec(0,1.2);b.facing=0;g.step(cmd(vec(0,1),{tackle:true,target:1}),cmd(vec(),{guard:true,guardPressed:true}));run(g,4,idle(),cmd(vec(),{guard:true}));near(b.hp,80);
 const d=setup();d.fighters[0].position=vec(0,0);d.fighters[1].position=vec(0,1.1);d.step(cmd(vec(0,1),{tackle:true,target:1}),cmd(vec(0,-1),{dodge:true,target:0}));near(d.fighters[0].hp,100);near(d.fighters[1].hp,100);assert.ok(d.events.some(e=>e.result==='perfectDodge'&&e.target===1));
});
test('recoil cancels immediately into defense or blends into fresh dodge',()=>{
 const blocked=()=>{const g=setup();g.fighters[0].position=vec(0,0);g.fighters[1].position=vec(0,1.2);g.step(cmd(vec(0,1),{tackle:true,target:1}),cmd(vec(),{guard:true,guardPressed:true,target:0}));run(g,3,idle(),cmd(vec(),{guard:true,target:0}));return g;};
 let g=blocked(),f=g.fighters[0];assert.equal(f.action.kind,'recoil');g.step(cmd(vec(),{guard:true,guardPressed:true}));assert.equal(f.action,null);near(length(f.velocity),0);assert.equal(f.guard,true);
 g=blocked();f=g.fighters[0];g.step(cmd(vec(1,0),{dodge:true}));assert.equal(f.action.kind,'dodge');assert.ok(f.action.from);assert.ok(invulnerable(f));
});
test('push uses attack/speed 60/40, asymptotic defense resistance and normal fallback',()=>{
 near(pushDistance(20,10,50),1.5);assert.ok(pushDistance(20,10,1e9)>1);near(pushDistance(40,20,50),3);
 const g=setup();g.fighters[0].position=vec(0,0);g.fighters[1].position=vec(0,2);assert.deepEqual(contactDirection([{normal:vec(1,0),approach:1},{normal:vec(-1,0),approach:1}],...g.fighters),vec(0,1));
});
test('fixed clock gives identical outcomes at 30/60/144Hz; long frame bounded',()=>{
 const results=[];for(const hz of [30,60,144]){const g=setup(),clock=new FixedClock();for(let i=0;i<hz*2;i++)clock.advance(1/hz,()=>g.step(cmd(vec(0,1),{dodge:g.tick===0})));results.push(g.snapshot());}assert.deepEqual(results[0],results[1]);assert.deepEqual(results[0],results[2]);let steps=0;new FixedClock().advance(30,()=>steps++);assert.equal(steps,12);
});
test('AI inactive/defensive/offensive/combat act and recover over a repeatable match',()=>{
 for(const mode of ['inactive','defensive','offensive','combat']){const g=new Game();g.reset();g.mode=mode;const start={...g.fighters[1].position};run(g,2400);if(mode==='inactive')assert.deepEqual(g.fighters[1].position,start);if(mode==='defensive')assert.ok(g.fighters[1].guard);if(mode==='offensive'||mode==='combat'){assert.equal(g.phase,'result');assert.equal(g.winner,1);assert.ok(g.events.some(e=>e.damage>0));}}
});
test('guard movement/rotation obey limits; dodge guard cancel only after 200ms',()=>{
 const g=setup(),f=g.fighters[0];g.fighters[1].position=vec(8,-4);const start=f.facing;g.step(cmd(vec(0,1),{guard:true,guardPressed:true,target:1}));assert.ok(length(f.velocity)>0&&length(f.velocity)<2.4);assert.ok(Math.abs(f.facing-start)<=RULES.guardAcceleration*TEST.step**2+1e-8);run(g,8,cmd(vec(0,1),{guard:true,target:1}));near(length(f.velocity),2.4);
 const d=setup(),p=d.fighters[0];d.step(cmd(vec(0,1),{dodge:true}));run(d,10,cmd(vec(),{guard:true}));assert.ok(p.action);run(d,14,cmd(vec(),{guard:true}));assert.equal(p.action,null);assert.ok(p.guard);assert.ok(p.blend);run(d,12,cmd(vec(),{guard:true}));near(length(p.velocity),0);
});
test('partial hits do not extend guard stun; release removes protection; dodge cancels stun',()=>{
 const g=setup(),a=g.fighters[0],b=g.fighters[1];a.position=vec(0,0);b.position=vec(0,1.1);b.guard=true;b.stun=.1;
 a.action={kind:'tackle',elapsed:.25,startAngle:0,heading:0,offensive:true,hits:new Set(),from:null};strike(a,b,vec(0,1),vec(0,10));near(b.stun,.1);
 g.step(idle(),idle());assert.ok(!b.guard);assert.ok(b.stun>0);g.step(idle(),cmd(vec(1,0),{dodge:true}));near(b.stun,0);assert.equal(b.action.kind,'dodge');
});
test('combat AI selects lateral evasion against an incoming tackle and recovers',()=>{
 const g=setup();g.mode='combat';g.fighters[0].position=vec(0,0);g.fighters[1].position=vec(0,3);g.brain.phase=2;g.brain.cooldown=.01;
 g.step(cmd(vec(0,1),{tackle:true,target:1}));g.step();assert.equal(g.fighters[1].action.kind,'dodge');assert.equal(g.fighters[1].action.offensive,false);run(g,60);assert.ok(g.fighters[1].hp>0);assert.notEqual(g.fighters[1].state,'defeated');
});
test('match menu/start/pause/result/reset preserve simulation boundaries',()=>{
 const g=new Game();assert.equal(g.phase,'menu');g.step();near(g.tick,0);g.reset();g.pause();run(g,50);near(g.tick,0);g.pause();g.step();near(g.tick,1);g.fighters[0].hp=0;g.step();assert.equal(g.phase,'result');near(g.winner,1);g.reset();near(g.fighters[0].hp,100);near(g.tick,0);
});
test('directional X tackle mechanics: all 8 directions hit on contact; miss/retreat safe; oblique hits valid; body facing independent',()=>{
 // 1. Real collisions in all 4 cardinal and 4 diagonal directions produce impact
 const directions=[vec(0,1),vec(0,-1),vec(1,0),vec(-1,0),vec(1,1),vec(-1,1),vec(1,-1),vec(-1,-1)];
 for(const d of directions){
  const dir=length(d)>1?scale(d,1/Math.SQRT2):d;
  const g=setup(),a=g.fighters[0],b=g.fighters[1];
  a.position=vec(0,0);
  b.position=scale(dir,1.8);
  g.step(cmd(d,{tackle:true,target:1}));
  run(g,47);
  near(b.hp,80);
  assert.equal(g.events.filter(e=>e.result==='impact').length,1);
 }

 // 2. Enemy outside trajectory receives no impact
 const gMiss=setup(),aM=gMiss.fighters[0],bM=gMiss.fighters[1];
 aM.position=vec(0,0);bM.position=vec(3,0);
 gMiss.step(cmd(vec(0,1),{tackle:true,target:1}));
 run(gMiss,47);
 near(bM.hp,100);
 assert.equal(gMiss.events.filter(e=>e.result==='impact').length,0);

 // 3. Dodging away from close enemy produces no impact
 const gAway=setup(),aA=gAway.fighters[0],bA=gAway.fighters[1];
 aA.position=vec(0,0);bA.position=vec(0,1.05);
 gAway.step(cmd(vec(0,-1),{tackle:true,target:1}));
 run(gAway,47);
 near(bA.hp,100);
 assert.equal(gAway.events.filter(e=>e.result==='impact').length,0);

 // 4. Oblique contact is legitimate and applies impact
 const gObl=setup(),aO=gObl.fighters[0],bO=gObl.fighters[1];
 aO.position=vec(0,0);bO.position=vec(.5,1.5);
 gObl.step(cmd(vec(0,1),{tackle:true,target:1}));
 run(gObl,47);
 near(bO.hp,80);
 assert.equal(gObl.events.filter(e=>e.result==='impact').length,1);

 // 5. Enemy behind player without lock-on; facing opposite to dodge heading
 const gBack=setup(),aB=gBack.fighters[0],bB=gBack.fighters[1];
 aB.position=vec(0,0);aB.facing=0;
 bB.position=vec(0,-1.8);
 gBack.step(cmd(vec(0,-1),{tackle:true,target:null}));
 run(gBack,47);
 near(bB.hp,80);
 assert.equal(gBack.events.filter(e=>e.result==='impact').length,1);

 // 6. Single damage per target per dodge action (no duplicated damage)
 const gOnce=setup(),a1=gOnce.fighters[0],b1=gOnce.fighters[1];
 a1.position=vec(0,0);b1.position=vec(0,1.5);
 gOnce.step(cmd(vec(0,1),{tackle:true,target:1}));
 for(let step=0;step<47;step++){
  gOnce.step(cmd(vec(0,1)));
  const impacts=gOnce.events.filter(e=>e.result==='impact');
  assert.ok(impacts.length<=1,'Tackle must never hit more than once per action');
 }
 near(b1.hp,80);

 // 7. AI recognizes incoming tackle threats regardless of front direction
 const gAi=setup();gAi.mode='combat';
 const aiF=gAi.fighters[1],plF=gAi.fighters[0];
 plF.position=vec(0,-2.5);plF.facing=Math.PI;
 aiF.position=vec(0,0);aiF.facing=0;
 gAi.step(cmd(vec(0,1),{tackle:true,target:1}));
 const aiCommand=gAi.brain.command(aiF,plF,'combat',1/120);
 assert.ok(aiCommand.guard||aiCommand.dodge,'AI must detect incoming threat from behind and defend/evade');
});
await writeFile(new URL('validation/mechanics.json',root),JSON.stringify({passed},null,2));
console.log(`${passed.length} mechanical scenarios passed`);
