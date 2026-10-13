import * as T from 'three';
import { TEST } from './config';
import { Fighter, invulnerable, offensive } from './entity';
export class View {
  renderer: T.WebGLRenderer; scene = new T.Scene(); camera = new T.PerspectiveCamera(48, 1, .1, 100);
  yaw = TEST.cameraYaw; distance: number = TEST.cameraDistance; height: number = TEST.cameraHeight;
  target = new T.Vector3(); meshes: T.Mesh[] = []; arrows: T.Mesh[] = []; initialized = false;
  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene.background = new T.Color(0x202b35);
    this.scene.add(new T.HemisphereLight(0xffffff, 0x65717b, 2.5));
    const light = new T.DirectionalLight(0xffffff, 2); light.position.set(4, 12, -8); this.scene.add(light);
    const floor = new T.Mesh(new T.BoxGeometry(20, .1, 20), new T.MeshStandardMaterial({ color: 0x606d74, roughness: 1 }));
    floor.position.y = -.06; this.scene.add(floor);
    const grid = new T.GridHelper(20, 20, 0xc4d1d9, 0x85939c); grid.position.y = .005; this.scene.add(grid);
    for (const [x, z, w, d] of [[-10, 0, .15, 20], [10, 0, .15, 20], [0, -10, 20, .15], [0, 10, 20, .15]]) {
      const wall = new T.Mesh(new T.BoxGeometry(w, .35, d), new T.MeshStandardMaterial({ color: 0xcad4db }));
      wall.position.set(x, .175, z); this.scene.add(wall);
    }
    let drag = false, previous = 0;
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => { if (e.button === 2) { drag = true; previous = e.clientX; canvas.setPointerCapture(e.pointerId); } });
    canvas.addEventListener('pointermove', e => { if (drag) { this.yaw -= (e.clientX - previous) * .006; previous = e.clientX; } });
    const end = () => { drag = false; }; canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end); window.addEventListener('blur', end);
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.distance = T.MathUtils.clamp(this.distance + e.deltaY * .01, 7, 22); }, { passive: false });
  }
  reset() { this.yaw = TEST.cameraYaw; this.distance = TEST.cameraDistance; this.initialized = false; }
  draw(fighters: Fighter[], dt: number) {
    for (const f of fighters) {
      if (!this.meshes[f.id]) {
        const body = new T.Mesh(new T.BoxGeometry(1, 1.3, 1), new T.MeshStandardMaterial({ color: f.id ? 0xf2514b : 0x3589ff }));
        this.meshes[f.id] = body; this.scene.add(body);
        const arrow = new T.Mesh(new T.ConeGeometry(.16, .42, 3), new T.MeshBasicMaterial({ color: 0xffffff }));
        this.arrows[f.id] = arrow; this.scene.add(arrow);
      }
      const mesh = this.meshes[f.id], material = mesh.material as T.MeshStandardMaterial;
      mesh.position.set(f.position.x, .65, f.position.z);
      material.color.setHex(f.hp <= 0 ? 0x56616a : f.id ? 0xf2514b : 0x3589ff);
      material.emissive.setHex(invulnerable(f) ? 0x385b55 : f.guard ? 0x585126 : f.state === 'recoil' ? 0x603047 : offensive(f) ? 0x522600 : 0);
      const arrow = this.arrows[f.id]; arrow.position.set(f.position.x + Math.sin(f.facing) * .2, 1.48, f.position.z + Math.cos(f.facing) * .2);
      arrow.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(Math.sin(f.facing), 0, Math.cos(f.facing)));
      (arrow.material as T.MeshBasicMaterial).color.setHex(f.guard ? 0xffe064 : 0xffffff);
    }
    const player = fighters[0], enemy = fighters[1];
    const desired = new T.Vector3((player.position.x * 2 + enemy.position.x) / 3, .5, (player.position.z * 2 + enemy.position.z) / 3);
    if (!this.initialized) { this.target.copy(desired); this.initialized = true; }
    else this.target.lerp(desired, 1 - Math.exp(-TEST.cameraResponse * dt));
    const separation = Math.hypot(player.position.x - enemy.position.x, player.position.z - enemy.position.z);
    const distance = Math.max(this.distance, separation * 1.15);
    this.camera.position.set(this.target.x + Math.sin(this.yaw) * distance, this.height + distance * .12, this.target.z + Math.cos(this.yaw) * distance);
    this.camera.lookAt(this.target);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.render(this.scene, this.camera);
  }
}
