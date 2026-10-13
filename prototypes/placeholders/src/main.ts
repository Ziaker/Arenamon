import * as T from 'three';
import {anatomies} from './anatomy';
import {createRig} from './rig';
import {State,states,duration,descriptions,cyclic} from './states';
import {evaluate,apply,Style} from './animation';
import {restPose,blend,Pose} from './poses';
import {motion,rules} from './motion';
import {stage,Orbit} from './stage';
import {smooth} from './curves';
import {runTelemetry} from './run';
import {runTiming} from './run-motion';
const $=<E extends HTMLElement>(id:string)=>document.getElementById(id) as E;
function boot(){
 const canvas=$<HTMLCanvasElement>('viewport'),renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;
 const ringGeo=new T.RingGeometry(.07,.14,24);ringGeo.rotateX(-Math.PI/2);
 const entries=anatomies.map(spec=>{
  const rig=createRig(spec),scene=stage();scene.add(rig.physical);
  const matL=new T.MeshBasicMaterial({color:0x41d9c5,transparent:true,opacity:.85,depthWrite:false});
  const matR=new T.MeshBasicMaterial({color:0x41d9c5,transparent:true,opacity:.85,depthWrite:false});
  const ringL=new T.Mesh(ringGeo,matL),ringR=new T.Mesh(ringGeo,matR);
  ringL.position.y=.003;ringR.position.y=.003;ringL.renderOrder=5;ringR.renderOrder=5;
  scene.add(ringL);scene.add(ringR);
  return {rig,scene,ringL,ringR,matL,matR};
 });
 const camera=new T.PerspectiveCamera(38,.6,.05,200),orbit=new Orbit(canvas),black=new T.MeshBasicMaterial({color:0x080b10});
 let state:State='idle',time=0,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,loop=true,speed=1,style:Style='stylized',selected='a',silhouette=false,joints=false,rest=false,wait=0,frame=0,last=performance.now(),transition=1;
 let locomotionMode:'treadmill'|'travel'='treadmill',showContacts=true;
 let poses=entries.map(e=>restPose(e.rig.spec.id)),from:Pose[]=poses;
 let origin=new T.Vector3();
 function physicalState(){
  const result=motion(state,time);
  if(state==='run'&&locomotionMode==='travel')result.position=[0,0,runTiming.speed*time];
  else result.position=new T.Vector3(...result.position).add(origin).toArray() as [number,number,number];
  return result;
 }
 function sync(){
  $('play').textContent=playing?'Ⅱ Pausar':'▶ Executar';$('play').setAttribute('aria-pressed',String(playing));
  $<HTMLSelectElement>('animation').value=state;$('action-title').textContent=states.find(v=>v[0]===state)![1];$('description').textContent=descriptions[state];
  document.querySelectorAll<HTMLButtonElement>('[data-state]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.state===state)));
  $('labels').innerHTML=anatomies.map((a)=>`<div><strong><span class="dot ${a.id}"></span>${a.name}</strong><small>${a.role}</small></div>`).join('');
  $('view-label').textContent=locomotionMode==='travel'&&state==='run'?'ÍMPETO · DESLOCAMENTO REAL NO ESPAÇO':'ÍMPETO · INSPEÇÃO DO MOVIMENTO';
 }
 function choose(next:State){const cancelling=state==='blocked'&&time<.3&&['guard','front','side','back'].includes(next);origin=cancelling?new T.Vector3(...physicalState().position):new T.Vector3();from=poses.map(p=>({...p}));state=next;time=0;wait=0;rest=false;transition=['idle','walk','run','guard','prepare'].includes(next)?0:1;sync();}
 states.forEach(([id,label])=>{const option=document.createElement('option');option.value=id;option.textContent=label;$('animation').append(option);const button=document.createElement('button');button.dataset.state=id;button.textContent=label.split(' · ')[1];button.onclick=()=>choose(id);$('actions').append(button);});
 $('animation').onchange=()=>choose($<HTMLSelectElement>('animation').value as State);
 $('play').onclick=()=>{if(!playing&&time>=duration(state)){time=0;wait=0;}rest=false;playing=!playing;sync();};
 $('restart').onclick=()=>{time=0;wait=0;transition=1;rest=false;};
 $('step').onclick=()=>{playing=false;rest=false;transition=1;time=Math.min(duration(state),time+1/60);sync();};
 $('rest').onclick=()=>{choose('idle');playing=false;rest=true;transition=1;sync();};
 $('loop').onchange=()=>loop=$<HTMLInputElement>('loop').checked;
 $('speed').onchange=()=>speed=Number($<HTMLSelectElement>('speed').value);
 $('style').onchange=()=>style=$<HTMLSelectElement>('style').value as Style;
 $('scrub').oninput=()=>{time=Number($<HTMLInputElement>('scrub').value)*duration(state);playing=false;transition=1;rest=false;wait=0;sync();};
 // Silhouette overrides only creature materials so the scale reference remains legible.
 const original=entries.map(e=>e.rig.meshes.map(m=>m.material));
 $('silhouette').onclick=()=>{silhouette=!silhouette;$('silhouette').setAttribute('aria-pressed',String(silhouette));entries.forEach((e,i)=>e.rig.meshes.forEach((m,j)=>m.material=silhouette?black:original[i][j]));};
 $('joints').onclick=()=>{joints=!joints;entries.forEach(e=>e.rig.markers.forEach(m=>m.visible=joints));$('joints').setAttribute('aria-pressed',String(joints));};
 const btnContacts=$('contacts-toggle'),btnLocomotion=$('locomotion-mode');
 if(btnContacts)btnContacts.onclick=()=>{showContacts=!showContacts;btnContacts.setAttribute('aria-pressed',String(showContacts));};
 if(btnLocomotion)btnLocomotion.onclick=()=>{locomotionMode=locomotionMode==='treadmill'?'travel':'treadmill';btnLocomotion.textContent=locomotionMode==='treadmill'?'Modo: Esteira':'Modo: Desloc. real';btnLocomotion.setAttribute('aria-pressed',String(locomotionMode==='travel'));sync();};
 document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.onclick=()=>{orbit.yaw=Number(b.dataset.view);orbit.pitch=.12;});
 $('camera-reset').onclick=()=>orbit.reset();$('zoom-in').onclick=()=>orbit.zoom(.9);$('zoom-out').onclick=()=>orbit.zoom(1.1);
 $('capture').onclick=()=>{draw();const a=document.createElement('a');a.download=`impeto-${state}-${style}.png`;a.href=canvas.toDataURL('image/png');a.click();};
 document.addEventListener('keydown',e=>{if((e.target as HTMLElement).matches('input,select,button'))return;if(e.code==='Space'){e.preventDefault();$('play').click();}if(e.code==='ArrowRight'){e.preventDefault();$('step').click();}});
 function update(dt:number){
  if(playing){transition=Math.min(1,transition+dt/.12);if(time>=duration(state)){if(loop){wait+=dt*speed;if(wait>(cyclic(state)?0:.65)){time=0;wait=0;}}else{playing=false;sync();}}else time=Math.min(duration(state),time+dt*speed);}
  const physical=physicalState();
  entries.forEach((e,i)=>{
   const p=rest?restPose(e.rig.spec.id):evaluate(e.rig,state,time,style);
   poses[i]=transition<1?blend(from[i],p,smooth(transition)):p;
   e.rig.physical.position.set(...physical.position);
   e.rig.physical.rotation.y=physical.yaw;
   apply(e.rig,poses[i],state,time,style);
   const footL=e.rig.legs[0].foot.getWorldPosition(new T.Vector3());
   const footR=e.rig.legs[1].foot.getWorldPosition(new T.Vector3());
   e.ringL.position.set(footL.x,.003,footL.z);
   e.ringR.position.set(footR.x,.003,footR.z);
   if(state==='run'){
    const tinfo=runTelemetry(time);
    e.ringL.visible=showContacts&&tinfo.leftContact;
    e.ringR.visible=showContacts&&tinfo.rightContact;
    e.matL.opacity=tinfo.leftContact?.85:.08;
    e.matR.opacity=tinfo.rightContact?.85:.08;
    e.matL.color.setHex(tinfo.leftContact?0x41d9c5:0x809099);
    e.matR.color.setHex(tinfo.rightContact?0x41d9c5:0x809099);
   }else{
    const lOn=footL.y<.02,rOn=footR.y<.02;
    e.ringL.visible=showContacts&&lOn;
    e.ringR.visible=showContacts&&rOn;
    e.matL.opacity=lOn?.85:.08;
    e.matR.opacity=rOn?.85:.08;
   }
  });
  $('clock').textContent=`${Math.round(time*1000).toString().padStart(3,'0')} / ${Math.round(duration(state)*1000)} ms`;
  $<HTMLInputElement>('scrub').value=String(time/duration(state));
  if(state==='run'){
   const info=runTelemetry(time);
   $('phase').textContent=info.phase+' · '+info.support;
   const elL=$('foot-l'),elR=$('foot-r');
   if(elL)elL.textContent=info.leftDesc;
   if(elR)elR.textContent=info.rightDesc;
  }else{
   $('phase').textContent=rest?'Pose inicial · apoios neutros':wait>0?'Fim da ação · intervalo para repetição':physical.phase;
   const footL=entries[0].rig.legs[0].foot.getWorldPosition(new T.Vector3());
   const footR=entries[0].rig.legs[1].foot.getWorldPosition(new T.Vector3());
   const elL=$('foot-l'),elR=$('foot-r');
   if(elL)elL.textContent=footL.y<.02?'APOIADO':'NO AR';
   if(elR)elR.textContent=footR.y<.02?'APOIADO':'NO AR';
  }
  $('invuln').textContent=physical.invulnerable?'ATIVA':'—';
  $('offensive').textContent=physical.offensive?'ELEGÍVEL':'—';
  $('distance').textContent=`${new T.Vector3(...physical.position).length().toFixed(2)} m`;
 }
 function draw(){const width=canvas.clientWidth,height=canvas.clientHeight;if(canvas.width!==Math.round(width*renderer.getPixelRatio())||canvas.height!==Math.round(height*renderer.getPixelRatio()))renderer.setSize(width,height,false);
  const visible=entries,count=1;
  const stacked=false;
  renderer.setScissorTest(true);visible.forEach((e,i)=>{const w=stacked?width:width/count,h=stacked?height/count:height,x=stacked?0:i*w,y=stacked?height-(i+1)*h:0;renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);const target=e.rig.physical.position.clone();target.y=1.1;orbit.apply(camera,target,w/h);renderer.render(e.scene,camera);});renderer.setScissorTest(false);frame++;
 }
 function tick(now:number){const dt=Math.min(.05,(now-last)/1000);last=now;update(dt);draw();requestAnimationFrame(tick);}
 (window as any).__lab={
  sample:(s:State,t:number)=>{choose(s);time=Math.max(0,Math.min(duration(s),t));playing=false;transition=1;sync();update(0);draw();},
  getState:()=>({state,time,playing,loop,speed,style,selected,silhouette,joints,rest,frame,transition,poses,physical:physicalState(),camera:{yaw:orbit.yaw,pitch:orbit.pitch,distance:orbit.distance},models:entries.map(e=>({name:e.rig.spec.name,legs:e.rig.legs.length,joints:e.rig.markers.length,meshes:e.rig.meshes.length,position:e.rig.physical.position.toArray(),feet:e.rig.legs.map(l=>l.foot.getWorldPosition(new T.Vector3()).toArray()),vertices:e.rig.meshes.reduce((n,m)=>n+m.geometry.getAttribute('position').count,0)}))}),
  probe:()=>entries.map(e=>e.rig.markers.map(m=>m.getWorldPosition(new T.Vector3()).toArray())),rules
  ,meshFloor:()=>entries.map(e=>{let min=Infinity;const v=new T.Vector3();for(const m of e.rig.meshes){const a=m.geometry.getAttribute('position');for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld);min=Math.min(min,v.y);}}return min;})
  ,floorDetail:()=>entries.map(e=>e.rig.meshes.map((m,index)=>{let min=Infinity;const v=new T.Vector3(),a=m.geometry.getAttribute('position');for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld);min=Math.min(min,v.y);}return {index,type:m.geometry.type,min};}).filter(m=>m.min<-.01))
 };
 $('loading').hidden=true;sync();update(0);requestAnimationFrame(tick);
}
try{boot();}catch(error){$('loading').textContent='Não foi possível iniciar o 3D. '+String(error);console.error(error);}
