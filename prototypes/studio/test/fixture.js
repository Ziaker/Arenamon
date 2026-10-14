// Personagem sintético (sem recursos proprietários) usado nos testes de navegador.
// Executado dentro da página: recebe o namespace THREE e devolve {root, clips}.
export function syntheticRig(T) {
  const root = new T.Group();root.name = 'SyntheticRoot';
  const armature = new T.Object3D();armature.name = 'Armature';armature.scale.setScalar(.01);root.add(armature); // escala Mixamo (cm)
  const hips = new T.Bone();hips.name = 'mixamorigHips';hips.position.set(0, 100, 0);armature.add(hips);
  const spine = new T.Bone();spine.name = 'mixamorigSpine';spine.position.set(0, 30, 0);hips.add(spine);
  const head = new T.Bone();head.name = 'mixamorigHead';head.position.set(0, 30, 0);spine.add(head);
  const foot = new T.Bone();foot.name = 'mixamorigLeftFoot';foot.position.set(10, -95, 0);hips.add(foot);
  const geometry = new T.BoxGeometry(.5, 1.6, .3, 2, 8, 2);geometry.translate(0, .8, 0);
  const n = geometry.attributes.position.count, idx = new Uint16Array(n * 4), w = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {const y = geometry.attributes.position.getY(i);idx[i * 4] = y < .5 ? 3 : y < 1.1 ? 0 : y < 1.4 ? 1 : 2;w[i * 4] = 1;}
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(idx, 4));geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(w, 4));
  const mesh = new T.SkinnedMesh(geometry, new T.MeshStandardMaterial({color: '#cc7744'}));mesh.name = 'Body';root.add(mesh);
  root.updateMatrixWorld(true);mesh.bind(new T.Skeleton([hips, spine, head, foot]));
  const Q = (axis, deg) => new T.Quaternion().setFromAxisAngle(new T.Vector3(...axis), deg * Math.PI / 180).toArray();
  const frames = (d, fps = 30) => Array.from({length: Math.round(d * fps) + 1}, (_, i) => i / fps);
  // Corrida: avança 300 cm em Z (3 m no modelo), balança em X, sobe e desce, gira 90° no total.
  const runT = frames(1);
  const run = new T.AnimationClip('mixamo.com', 1, [
    new T.VectorKeyframeTrack('mixamorigHips.position', runT, runT.flatMap(t => [Math.sin(t * Math.PI * 4) * 5, 100 + Math.abs(Math.sin(t * Math.PI * 2)) * 4, t * 300])),
    new T.QuaternionKeyframeTrack('mixamorigHips.quaternion', runT, runT.flatMap(t => Q([0, 1, 0], 90 * t))),
    new T.QuaternionKeyframeTrack('mixamorigSpine.quaternion', runT, runT.flatMap(t => Q([1, 0, 0], 20 * Math.sin(t * Math.PI * 2)))),
  ]);
  // Tackle de 3 s: cabeça gira de 0° a 90° linearmente em X (permite verificar a interpolação no corte).
  const tackleT = [0, 1.5, 3];
  const tackle = new T.AnimationClip('mixamo.com', 3, [
    new T.QuaternionKeyframeTrack('mixamorigHead.quaternion', [0, 3], [...Q([1, 0, 0], 0), ...Q([1, 0, 0], 90)]),
    new T.VectorKeyframeTrack('mixamorigHips.position', tackleT, [0, 100, 0, 0, 90, 60, 0, 100, 120]),
  ]);
  const idle = new T.AnimationClip('mixamo.com', 2, [new T.QuaternionKeyframeTrack('mixamorigSpine.quaternion', [0, 1, 2], [...Q([0, 0, 1], 0), ...Q([0, 0, 1], 10), ...Q([0, 0, 1], 0)])]);
  return {root, clips: [idle, run, tackle]};
}
