import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import * as T from 'three';
import {Game, FixedClock, CombatCamera, resolveCommand, TEST, CAMERA, LOCOMOTION, direction, vec, dot, delta, angle, unit, sub, add, scale, length, idle} from './validation/simulation.mjs';
const passed=[];
const test=(name,fn)=>{fn();passed.push(name);console.log('PASS',name);};
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const setup=()=>{const g=new Game();g.mode='inactive';g.reset();return g;};
const buttons=(x=0,forward=0,dodge=false)=>({x,forward,dodge,guard:false,guardPressed:false});
const frame=yaw=>{const forward=direction(yaw+Math.PI);return {forward,right:vec(-forward.z,forward.x)};};
function project(camera,position){const p=camera.pose(),c=new T.PerspectiveCamera(48,1366/900,.1,100);c.position.set(p.position.x,p.height,p.position.z);c.lookAt(p.lookAt.x,p.lookHeight,p.lookAt.z);c.updateMatrixWorld();return new T.Vector3(position.x,.65,position.z).project(c);}
test('all arrows and four diagonals agree with camera screen basis at 12 orbit angles',()=>{
 for(let rotation=0;rotation<12;rotation++)for(const locked of [false,true]){
  const g=setup(),[p,e]=g.fighters,yaw=rotation*Math.PI/6,{forward,right}=frame(yaw);e.position=add(p.position,scale(forward,6));
  for(const [x,z] of [[0,1],[0,-1],[-1,0],[1,0],[-1,1],[1,1],[-1,-1],[1,-1]]){
   const c=resolveCommand(buttons(x,z),p,e,yaw,locked);near(length(c.move),1);near(dot(c.move,right),x/Math.hypot(x,z));near(dot(c.move,forward),z/Math.hypot(x,z));
   const rig=new CombatCamera();rig.reset(p);rig.yaw=yaw;const origin=project(rig,p.position),point=project(rig,add(p.position,c.move));
   if(x)assert.equal(Math.sign(point.x-origin.x),Math.sign(x));if(!x)assert.equal(Math.sign(point.y-origin.y),Math.sign(z));
  }
 }
});
test('lock advance/retreat follow target; strafe stays screen lateral as target circles and crosses',()=>{
 const g=setup(),[p,e]=g.fighters,yaw=Math.PI+.2,{right}=frame(yaw);
 for(let i=0;i<360;i++){
  e.position=add(p.position,scale(direction(i*Math.PI/180),4));
  const toward=unit(sub(e.position,p.position));near(dot(resolveCommand(buttons(0,1),p,e,yaw,true).move,toward),1);near(dot(resolveCommand(buttons(0,-1),p,e,yaw,true).move,toward),-1);
  near(dot(resolveCommand(buttons(1,0),p,e,yaw,true).move,right),1);near(dot(resolveCommand(buttons(-1,0),p,e,yaw,true).move,right),-1);
  for(const x of [-1,1])for(const z of [-1,1])near(length(resolveCommand(buttons(x,z),p,e,yaw,true).move),1);
 }
});
test('short acceleration, braking and reversal; no lateral inertia; all diagonals equal speed',()=>{
 for(const [x,z] of [[0,1],[0,-1],[-1,0],[1,0],[-1,1],[1,1],[-1,-1],[1,-1]]){
  const g=setup(),[p,e]=g.fighters,yaw=Math.PI,c=resolveCommand(buttons(x,z),p,e,yaw,false);
  g.step(c);assert.ok(length(p.velocity)>0);assert.ok(length(p.velocity)<p.attributes.speed);
  for(let i=0;i<11;i++)g.step(c);near(length(p.velocity),4);near(dot(unit(p.velocity),c.move),1);
  const stopped={...p.position};for(let i=0;i<6;i++)g.step(idle());near(length(p.velocity),0);assert.ok(length(sub(p.position,stopped))<.09);
  for(let i=0;i<12;i++)g.step(c);const reverse={...c,move:scale(c.move,-1)};for(let i=0;i<4;i++)g.step(reverse);assert.ok(dot(p.velocity,c.move)<=0);for(let i=0;i<8;i++)g.step(reverse);near(length(p.velocity),4);
 }
});
test('diagonals remain continuous when target crosses camera-lateral alignment',()=>{
 const g=setup(),[p,e]=g.fighters;
 for(const x of [-1,1])for(const z of [-1,1]){
  let previous=null;
  for(let i=0;i<=720;i++){
   e.position=add(p.position,scale(direction(i*Math.PI/360),5));
   const c=resolveCommand(buttons(x,z),p,e,Math.PI,true);
   if(previous)assert.ok(Math.abs(delta(angle(previous),angle(c.move)))<.06);
   previous=c.move;
  }
 }
});
test('body turns progressively; lock strafe retains enemy facing instead of velocity heading',()=>{
 let g=setup(),[p,e]=g.fighters;p.facing=0;g.step(resolveCommand(buttons(1,0),p,e,Math.PI,false));assert.ok(Math.abs(p.facing)>0&&Math.abs(p.facing)<Math.PI/2);assert.ok(Math.abs(p.facing)<=LOCOMOTION.turnRate*TEST.step+1e-8);
 g=setup();[p,e]=g.fighters;for(let i=0;i<60;i++){const previous=p.facing;g.step(resolveCommand(buttons(1,0),p,e,Math.PI,true));assert.ok(Math.abs(delta(previous,p.facing))<=LOCOMOTION.turnRate*TEST.step+1e-8);}
 assert.ok(dot(direction(p.facing),unit(sub(e.position,p.position)))>.99);assert.ok(Math.abs(dot(direction(p.facing),unit(p.velocity)))<.5);
});
test('C direction is explicit: front offensive; side/back never tackle; no-arrow deterministic',()=>{
 for(const locked of [false,true])for(const [x,z] of [[0,1],[0,-1],[-1,0],[1,0],[0,0]]){
  const g=setup(),[p,e]=g.fighters,c=resolveCommand(buttons(x,z,true),p,e,Math.PI,locked);g.step(c);assert.equal(p.action.offensive,x===0&&z>=0);near(dot(direction(p.action.startAngle),c.dodgeDirection),1);assert.ok(p.action.elapsed<.01);
 }
});
test('unlocked camera never follows body rotation; target does not move camera anchor to midpoint',()=>{
 const g=setup(),[p,e]=g.fighters,rig=new CombatCamera();rig.reset(p);const yaw=rig.yaw;
 for(let i=0;i<600;i++){p.facing+=.1;e.position=add(p.position,scale(direction(i*.03),8));rig.step(p,e,false,TEST.step);near(rig.yaw,yaw);near(length(sub(rig.anchor,p.position)),0);}
 assert.ok(rig.pose().height<4);assert.ok(rig.distance<8);
});
test('close crossing, dodge and walls: camera stays finite, player visible and yaw bounded',()=>{
 const g=setup(),[p,e]=g.fighters,rig=new CombatCamera();rig.reset(p);let previousYaw=rig.yaw,previousDistance=rig.distance;
 for(let i=0;i<720;i++){
  e.position=add(p.position,scale(direction(i*.03),i<240?1.5:5));const b=buttons(i<360?1:-1,0,i===10||i===400);
  g.step(resolveCommand(b,p,e,rig.yaw,true));rig.step(p,e,true,TEST.step);
  assert.ok(Math.abs(delta(previousYaw,rig.yaw))<=CAMERA.maxTurnRate*TEST.step+1e-8);assert.ok(Math.abs(rig.distance-previousDistance)<.05);
  const screen=project(rig,p.position);assert.ok(Math.abs(screen.x)<1&&Math.abs(screen.y)<1);assert.ok(Number.isFinite(rig.pose().height+rig.yaw));
  assert.ok(Math.abs(p.position.x)<=9.5&&Math.abs(p.position.z)<=9.5);previousYaw=rig.yaw;previousDistance=rig.distance;
 }
});
test('manual orbit cannot invert screen-left/right; command is immutable during camera update',()=>{
 const g=setup(),[p,e]=g.fighters,rig=new CombatCamera();rig.reset(p);rig.orbit(Math.PI);
 for(let i=0;i<480;i++){
  const c=resolveCommand(buttons(1,0),p,e,rig.yaw,false),copy=structuredClone(c),right=frame(rig.yaw).right;
  near(dot(c.move,right),1);rig.step(p,e,false,TEST.step);assert.deepEqual(c,copy);
 }
});
test('lateral path is not constrained to enemy radius and camera does not orbit every strafe',()=>{
 const g=setup(),[p,e]=g.fighters,rig=new CombatCamera();rig.reset(p);const yaw=rig.yaw,startDistance=length(sub(e.position,p.position));
 for(let i=0;i<120;i++){g.step(resolveCommand(buttons(1,0),p,e,rig.yaw,true));rig.step(p,e,true,TEST.step);}
 near(rig.yaw,yaw);assert.ok(Math.abs(length(sub(e.position,p.position))-startDistance)>.3);
});
test('coupled control/camera simulation is identical at 30, 60 and 144 render FPS',()=>{
 const snapshots=[];for(const hz of [30,60,144]){
  const g=setup(),rig=new CombatCamera(),clock=new FixedClock();rig.reset(g.fighters[0]);
  for(let frame=0;frame<hz*3;frame++)clock.advance(1/hz,()=>{const b=buttons(g.tick<120?1:-1,g.tick>=240?1:0,g.tick===130);g.step(resolveCommand(b,...g.fighters,rig.yaw,true));rig.step(...g.fighters,true,TEST.step);});
  snapshots.push({game:g.snapshot(),camera:rig.snapshot()});
 }assert.deepEqual(snapshots[0],snapshots[1]);assert.deepEqual(snapshots[0],snapshots[2]);
});
test('adversary repositioning preserves lock-on navigation, lateral strafe and C-dodge orientation',()=>{
 for(let angleIdx=0;angleIdx<8;angleIdx++){
  const g=setup(),[p,e]=g.fighters,ang=angleIdx*Math.PI/4;
  e.position=add(p.position,scale(direction(ang),5));
  const toward=unit(sub(e.position,p.position));
  const advance=resolveCommand(buttons(0,1),p,e,Math.PI,true);
  near(dot(advance.move,toward),1);
  const retreat=resolveCommand(buttons(0,-1),p,e,Math.PI,true);
  near(dot(retreat.move,toward),-1);
  const tackle=resolveCommand(buttons(0,1,true),p,e,Math.PI,true);
  g.step(tackle);
  assert.equal(p.action.offensive,true);
  near(dot(direction(p.action.startAngle),toward),1);
  const backDodge=resolveCommand(buttons(0,-1,true),p,e,Math.PI,true);
  const g2=setup(),[p2]=g2.fighters;
  g2.step(backDodge);
  assert.equal(p2.action.offensive,false);
  near(dot(direction(p2.action.startAngle),toward),-1);
 }
});
test('lateral transitions preserve direction and continuity across 8 enemy and 8 camera angles',()=>{
 for(let tA=0;tA<8;tA++){
  for(let cA=0;cA<8;cA++){
   const g=setup(),[p,e]=g.fighters;
   const yaw=cA*Math.PI/4,{right}=frame(yaw);
   e.position=add(p.position,scale(direction(tA*Math.PI/4),5));

   // Pure right movement and transitions
   const r=resolveCommand(buttons(1,0),p,e,yaw,true);
   near(dot(r.move,right),1);
   near(length(r.move),1);

   // Transition -> to Up+Right and back
   const ur=resolveCommand(buttons(1,1),p,e,yaw,true);
   near(length(ur.move),1);
   assert.ok(dot(ur.move,right)>=0.55,'Up+Right lateral component must be positive');
   const rBack1=resolveCommand(buttons(1,0),p,e,yaw,true);
   assert.deepEqual(rBack1.move,r.move);

   // Transition -> to Down+Right and back
   const dr=resolveCommand(buttons(1,-1),p,e,yaw,true);
   near(length(dr.move),1);
   assert.ok(dot(dr.move,right)>=0.55,'Down+Right lateral component must be positive');
   const rBack2=resolveCommand(buttons(1,0),p,e,yaw,true);
   assert.deepEqual(rBack2.move,r.move);

   // Pure left movement and transitions
   const l=resolveCommand(buttons(-1,0),p,e,yaw,true);
   near(dot(l.move,scale(right,-1)),1);
   near(length(l.move),1);

   // Transition <- to Up+Left and back
   const ul=resolveCommand(buttons(-1,1),p,e,yaw,true);
   near(length(ul.move),1);
   assert.ok(dot(ul.move,scale(right,-1))>=0.55,'Up+Left lateral component must be positive');
   const lBack1=resolveCommand(buttons(-1,0),p,e,yaw,true);
   assert.deepEqual(lBack1.move,l.move);

   // Transition <- to Down+Left and back
   const dl=resolveCommand(buttons(-1,-1),p,e,yaw,true);
   near(length(dl.move),1);
   assert.ok(dot(dl.move,scale(right,-1))>=0.55,'Down+Left lateral component must be positive');
   const lBack2=resolveCommand(buttons(-1,0),p,e,yaw,true);
   assert.deepEqual(lBack2.move,l.move);

   // Lateral to C+lateral dodge consistency
   const dodgeR=resolveCommand(buttons(1,0,true),p,e,yaw,true);
   near(dot(dodgeR.dodgeDirection,right),1);
   assert.equal(dodgeR.dodgeForward,false);

   const dodgeL=resolveCommand(buttons(-1,0,true),p,e,yaw,true);
   near(dot(dodgeL.dodgeDirection,scale(right,-1)),1);
   assert.equal(dodgeL.dodgeForward,false);
  }
 }
});
test('adversary crossing behind player retains perceptual lateral consistency and smooth diagonal progression',()=>{
 const g=setup(),[p,e]=g.fighters,yaw=Math.PI,{right}=frame(yaw);
 let prevUr=null,prevUl=null;
 for(let i=0;i<=720;i++){
  e.position=add(p.position,scale(direction(i*Math.PI/360),4));

  // Pure lateral never inverts when enemy crosses behind
  const r=resolveCommand(buttons(1,0),p,e,yaw,true);
  near(dot(r.move,right),1);
  const dr=resolveCommand(buttons(1,0,true),p,e,yaw,true);
  near(dot(dr.dodgeDirection,right),1);

  const l=resolveCommand(buttons(-1,0),p,e,yaw,true);
  near(dot(l.move,scale(right,-1)),1);
  const dl=resolveCommand(buttons(-1,0,true),p,e,yaw,true);
  near(dot(dl.dodgeDirection,scale(right,-1)),1);

  // Diagonals remain normalized and lateral dot >= 0.55
  const ur=resolveCommand(buttons(1,1),p,e,yaw,true);
  near(length(ur.move),1);
  assert.ok(dot(ur.move,right)>=0.55);

  const ul=resolveCommand(buttons(-1,1),p,e,yaw,true);
  near(length(ul.move),1);
  assert.ok(dot(ul.move,scale(right,-1))>=0.55);

  // Smooth continuity with no angle jumps
  if(prevUr){
   const d=Math.abs(delta(angle(prevUr),angle(ur.move)));
   assert.ok(d<0.05,`Angle jump ${d} at step ${i}`);
  }
  if(prevUl){
   const d=Math.abs(delta(angle(prevUl),angle(ul.move)));
   assert.ok(d<0.05,`Angle jump ${d} at step ${i}`);
  }
  prevUr=ur.move;prevUl=ul.move;
 }
});
test('diagonal dodges (Up+Left+C, Up+Right+C, Down+Left+C, Down+Right+C) are defensive, match move, and never null or fallback under exact opposition',()=>{
 // 1. Exact geometric opposition cases (k = -1 where F and R cancel in naive sum)
 const exactOppositionCases=[
  {desc:'target directly at screen-left, Up+Right+C',yaw:Math.PI,targetDir:'left',x:1,forward:1},
  {desc:'target directly at screen-right, Up+Left+C',yaw:Math.PI,targetDir:'right',x:-1,forward:1},
  {desc:'target directly at screen-right, Down+Right+C',yaw:Math.PI,targetDir:'right',x:1,forward:-1},
  {desc:'target directly at screen-left, Down+Left+C',yaw:Math.PI,targetDir:'left',x:-1,forward:-1},
 ];
 for(const tc of exactOppositionCases){
  const g=setup(),[p,e]=g.fighters;
  const {right:camRight}=frame(tc.yaw);
  const lateralScreen=tc.targetDir==='left'?scale(camRight,-1):camRight;
  e.position=add(p.position,scale(lateralScreen,4));
  const cmd=resolveCommand(buttons(tc.x,tc.forward,true),p,e,tc.yaw,true);
  near(length(cmd.dodgeDirection),1);
  near(length(cmd.move),1);
  near(dot(cmd.dodgeDirection,cmd.move),1);
  assert.equal(cmd.dodgeForward,false);
  // Lateral component strictly honors the requested arrow (never inverted by enemy position)
  const expectedLateral=scale(camRight,tc.x);
  assert.ok(dot(cmd.dodgeDirection,expectedLateral)>=0.55,`${tc.desc}: lateral dot must be >= 0.55`);
  g.step(cmd);
  assert.equal(p.action.kind,'dodge');
  assert.equal(p.action.offensive,false);
  near(dot(direction(p.action.startAngle),cmd.dodgeDirection),1);
 }

 // 2. Comprehensive diagonal dodge sweep across 8 camera angles and 16 target angles
 for(let cA=0;cA<8;cA++){
  const yaw=cA*Math.PI/4;
  for(let tA=0;tA<16;tA++){
   const g=setup(),[p,e]=g.fighters;
   e.position=add(p.position,scale(direction(tA*Math.PI/8),4.5));
   for(const [x,forward] of [[-1,1],[1,1],[-1,-1],[1,-1]]){
    const cmd=resolveCommand(buttons(x,forward,true),p,e,yaw,true);
    near(length(cmd.dodgeDirection),1);
    near(length(cmd.move),1);
    near(dot(cmd.dodgeDirection,cmd.move),1);
    assert.equal(cmd.dodgeForward,false);
    const gSim=setup(),[pSim,eSim]=gSim.fighters;
    eSim.position={...e.position};
    gSim.step(cmd);
    assert.equal(pSim.action.kind,'dodge');
    assert.equal(pSim.action.offensive,false);
    near(dot(direction(pSim.action.startAngle),cmd.dodgeDirection),1);
   }
  }
 }
});
await writeFile(new URL('validation/locomotion.json',import.meta.url),JSON.stringify({passed},null,2));
console.log(`${passed.length} locomotion/camera scenarios passed`);
