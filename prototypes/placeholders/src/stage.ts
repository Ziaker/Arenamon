import * as T from 'three';
export function stage(){
 const scene=new T.Scene();scene.background=new T.Color(0xdce3e7);
 scene.add(new T.HemisphereLight(0xffffff,0x74777a,2.2));
 const sun=new T.DirectionalLight(0xfff4df,3.0);sun.position.set(-3,7,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-4,right:4,top:5,bottom:-4,near:.1,far:20});sun.shadow.normalBias=.018;sun.shadow.bias=-.0001;scene.add(sun);
 const fill=new T.DirectionalLight(0xd7e8ff,1.5);fill.position.set(4,3,-3);scene.add(fill);
 const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0xdce3e7,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.006;floor.receiveShadow=true;scene.add(floor);
 const grid=new T.GridHelper(12,24,0x9eacb4,0xc0cbd1);grid.position.y=.001;scene.add(grid);
 const ruler=new T.Group();for(let i=0;i<=4;i++){const mark=new T.Mesh(new T.BoxGeometry(i%2===0?.12:.07,.008,.014),new T.MeshBasicMaterial({color:0x596c79}));mark.position.set(-1.65,.004,i*.25-.5);ruler.add(mark);}scene.add(ruler);
 return scene;
}
export class Orbit {
 yaw=.32;pitch=.18;distance=6.6;private dragging=false;private x=0;private y=0;
 constructor(canvas:HTMLCanvasElement){canvas.addEventListener('pointerdown',e=>{this.dragging=true;this.x=e.clientX;this.y=e.clientY;canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointerup',()=>this.dragging=false);canvas.addEventListener('pointercancel',()=>this.dragging=false);canvas.addEventListener('pointermove',e=>{if(!this.dragging)return;this.yaw-=(e.clientX-this.x)*.008;this.pitch=T.MathUtils.clamp(this.pitch+(e.clientY-this.y)*.006,-.08,1.2);this.x=e.clientX;this.y=e.clientY;});canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom(e.deltaY>0?1.08:.92);},{passive:false});}
 zoom(f:number){this.distance=T.MathUtils.clamp(this.distance*f,3.6,11);}
 reset(){this.yaw=.32;this.pitch=.18;this.distance=6.6;}
 apply(camera:T.PerspectiveCamera,target:T.Vector3,aspect:number){camera.aspect=aspect;camera.position.set(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch)).multiplyScalar(this.distance).add(target);camera.lookAt(target);camera.updateProjectionMatrix();}
}
