import * as T from 'three';
import {stage,Orbit} from './stage';
const canvas=document.querySelector('canvas')!;
const renderer=new T.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
const scene=stage(),camera=new T.PerspectiveCamera(42,1,.1,100),orbit=new Orbit(canvas);
const blocks=[{name:'Jogador',color:0x1769ff,x:-1.25},{name:'Inimigo',color:0xef3038,x:1.25}].map(spec=>{
 const mesh=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:spec.color,roughness:.8}));
 mesh.name=spec.name;mesh.position.set(spec.x,.5,0);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;
});
let frame=0;
document.getElementById('reset')!.onclick=()=>orbit.reset();
function draw(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);orbit.apply(camera,new T.Vector3(0,.5,0),w/h);if(w/h<1){camera.position.sub(new T.Vector3(0,.5,0)).multiplyScalar(1.2).add(new T.Vector3(0,.5,0));}renderer.render(scene,camera);frame++;requestAnimationFrame(draw);}
(window as any).__lab={getState:()=>({frame,blocks:blocks.map(m=>({name:m.name,color:(m.material as T.MeshStandardMaterial).color.getHex(),geometry:m.geometry.type,position:m.position.toArray()})),camera:{yaw:orbit.yaw,distance:orbit.distance}})};
draw();
