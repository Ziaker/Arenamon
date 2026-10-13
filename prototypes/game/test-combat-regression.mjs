// Regressão complementar de combate. Não altera regras; apenas observa a simulação.
// Execução: node prototypes/game/test-combat-regression.mjs
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const root=new URL('.',import.meta.url);
await mkdir(new URL('validation/',root),{recursive:true});
const out=new URL('validation/simulation-regression.mjs',root);
await build({stdin:{contents:`export * from './src/game'; export * from './src/entity'; export * from './src/config'; export * from './src/math'; export * from './src/physics'; export * from './src/combat';`,resolveDir:fileURLToPath(root)},bundle:true,platform:'node',format:'esm',outfile:fileURLToPath(out),logLevel:'silent'});
const {Game,TEST,RULES,idle,vec,length,sub,invulnerable,offensive,contact,nominalDistance}=await import(out);

const passed=[],failed=[];
const test=(name,fn)=>{try{fn();passed.push(name);console.log('PASS',name);}catch(e){failed.push({name,error:String(e.message||e)});console.log('FAIL',name,'\n  ',e.message);}};
const near=(a,b,e=1e-6,m='')=>assert.ok(Math.abs(a-b)<e,`${m} ${a} != ${b}`);
const setup=()=>{const g=new Game();g.mode='inactive';g.reset();g.fighters[1].position=vec(8,8);return g;};
const cmd=(move=vec(),extra={})=>({...idle(),move,...extra});
const run=(g,n,c=idle(),enemy)=>{for(let i=0;i<n;i++)g.step(typeof c==='function'?c(i):c,typeof enemy==='function'?enemy(i):enemy);};
const steps=s=>Math.round(s/TEST.step);
const guardCmd=cmd(vec(),{guard:true,target:0});
const blocked=()=>{const g=setup(),a=g.fighters[0],b=g.fighters[1];a.position=vec(0,0);b.position=vec(0,2);b.guard=true;b.perfectCooldown=2;g.step(cmd(vec(0,1),{dodge:true,target:1}),guardCmd);let n=0;while(a.action?.kind!=='recoil'&&n++<60)g.step(idle(),guardCmd);assert.equal(a.action?.kind,'recoil','tackle não foi bloqueado');return g;};

const DODGE_MS=400,INVULN_MS=200; // valores aprovados; não derivar de RULES
test('dodge lasts exactly 400ms: active on last tick, cleared on the next',()=>{
 const n=steps(DODGE_MS/1000);near(RULES.dodge,DODGE_MS/1000,1e-9,'RULES.dodge diverge de 400ms');
 const g=setup(),f=g.fighters[0];g.step(cmd(vec(0,1),{dodge:true}));run(g,n-2);assert.ok(f.action,'ação terminou antes de 400ms');g.step();assert.equal(f.action,null,'ação persistiu após 400ms');
 for(const v of [vec(1,0),vec(-1,0),vec(0,-1)]){const h=setup(),p=h.fighters[0];h.step(cmd(v,{dodge:true}));run(h,n-2);assert.ok(p.action);h.step();assert.equal(p.action,null);}
});
test('invulnerability boundary: tackle arriving after 200ms hits a dodging target',()=>{
 const n=steps(INVULN_MS/1000);near(RULES.invulnerable,INVULN_MS/1000,1e-9,'RULES.invulnerable diverge de 200ms');
 const g=setup(),a=g.fighters[0],b=g.fighters[1];a.position=vec(0,0);b.position=vec(0,3);
 g.step(idle(),cmd(vec(1,0),{dodge:true,target:0}));run(g,n-2,idle(),idle());assert.ok(invulnerable(b),'invulnerabilidade terminou antes de 200ms');g.step(idle(),idle());assert.ok(!invulnerable(b),'invulnerabilidade passou de 200ms');assert.equal(b.action?.kind,'dodge');
 b.position=vec(0,1.2);b.velocity=vec();g.step(cmd(vec(0,1),{dodge:true,target:1}),idle());run(g,4,idle(),idle());assert.ok(b.hp<100,'alvo vulnerável não foi atingido');
});
test('one hit per target even with sustained contact against a wall',()=>{
 const g=setup(),a=g.fighters[0],b=g.fighters[1];a.position=vec(0,7.6);b.position=vec(0,9.4);g.step(cmd(vec(0,1),{dodge:true,target:1}));
 run(g,steps(RULES.dodge)+5,cmd(vec(0,1),{target:1}));assert.equal(g.events.filter(e=>e.result==='impact').length,1);near(b.hp,80);
 for(const f of g.fighters)assert.ok(Math.abs(f.position.z)<=9.5+1e-9);const c=contact(a,b);assert.ok(!c||c.depth<1e-7);
});
test('a new tackle registers a fresh hit on the same target',()=>{
 const g=setup(),a=g.fighters[0],b=g.fighters[1];a.position=vec(0,0);b.position=vec(0,2);g.step(cmd(vec(0,1),{dodge:true,target:1}));run(g,steps(RULES.dodge)+2);
 a.position=vec(b.position.x,b.position.z-2);a.velocity=vec();g.step(cmd(vec(0,1),{dodge:true,target:1}));run(g,steps(RULES.dodge)+2);assert.equal(g.events.filter(e=>e.result==='impact').length,2);near(b.hp,60);
});
test('blocked tackle ends the dodge immediately and grants no further hits',()=>{
 const g=blocked(),b=g.fighters[1],hp=b.hp;assert.ok(!offensive(g.fighters[0]));run(g,steps(.3)+5,cmd(vec(0,1)),guardCmd);near(b.hp,hp);assert.equal(g.events.filter(e=>e.damage>0).length,1);
});
test('recoil moves away from the defender, 15% nominal over 300ms, ignores movement input',()=>{
 const g=blocked(),a=g.fighters[0],b=g.fighters[1],start={...a.position},n=steps(.3);run(g,n-1,cmd(vec(1,0)),guardCmd);assert.equal(a.action?.kind,'recoil','recuo terminou cedo');g.step(cmd(vec(1,0)),guardCmd);assert.equal(a.action,null);
 const d=sub(a.position,start);near(length(d),nominalDistance(a)*.15,1e-6,'distância');assert.ok(d.z<0,'recuo não se afasta do defensor');near(d.x,0,1e-6,'entrada lateral afetou o recuo');run(g,5);near(length(a.velocity),0);
});
test('recoil not cancelled by movement nor by dodge without stamina',()=>{
 const g=blocked(),a=g.fighters[0];a.stamina=0;a.exhausted=true;g.step(cmd(vec(1,0),{dodge:true}),guardCmd);assert.equal(a.action?.kind,'recoil');
});
test('guard stun uses RULES.guardStun (200ms) and recovers to free control',()=>{
 const rule=RULES.guardStun;assert.equal(typeof rule,'number','RULES.guardStun ausente');assert.ok(Number.isFinite(rule)&&rule>0,'RULES.guardStun inválido');near(rule,.2,1e-9,'RULES.guardStun diverge dos 200ms aprovados');
 const g=blocked(),b=g.fighters[1],n=steps(rule);assert.ok(b.stun>0&&b.stun<=rule+1e-9,'stun inicial inconsistente com a regra');
 let t=0;while(b.stun>1e-8&&t<200){assert.equal(b.state,'guardStun');g.step(idle(),guardCmd);t++;}assert.ok(t>=n-4&&t<=n,`stun durou ${t} ticks, esperado ~${n}`);
 const p={...b.position};run(g,30,idle(),cmd(vec(1,0)));assert.notEqual(b.state,'guardStun');assert.ok(length(sub(b.position,p))>.1,'defensor não recuperou movimento');
});
test('collision outcome is deterministic across repeated runs',()=>{
 const play=()=>{const g=blocked();run(g,60,i=>cmd(vec(i%2,1),{dodge:i===40}),guardCmd);return JSON.stringify(g.snapshot());};assert.equal(play(),play());
});
test('mirrored tackle produces an impact with mirrored result',()=>{
 const res=s=>{const g=setup(),a=g.fighters[0],b=g.fighters[1];a.position=vec(0,0);b.position=vec(s*2,0);g.step(cmd(vec(s,0),{dodge:true,target:1}));run(g,60,cmd(vec(),{target:1}));
  const impacts=g.events.filter(e=>e.result==='impact');assert.equal(impacts.length,1,`lado ${s}: impactos=${impacts.length}`);assert.ok(b.hp<100,`lado ${s}: sem dano`);assert.ok(s*(b.position.x-s*2)>0,`lado ${s}: alvo não foi empurrado para fora`);
  return {ax:a.position.x,az:a.position.z,bx:b.position.x,bz:b.position.z,hp:b.hp,ahp:a.hp,vb:b.velocity.x};};
 const r=res(1),l=res(-1);near(r.ax,-l.ax,1e-9,'ax');near(r.bx,-l.bx,1e-9,'bx');near(r.az,l.az,1e-9,'az');near(r.bz,l.bz,1e-9,'bz');near(r.hp,l.hp,1e-9,'hp');near(r.ahp,l.ahp,1e-9,'ahp');near(r.vb,-l.vb,1e-9,'vb');
});

await writeFile(new URL('validation/combat-regression.json',root),JSON.stringify({passed,failed},null,2));
console.log(`${passed.length} passed, ${failed.length} failed`);
if(failed.length)process.exitCode=1;
