// Personagem sintético complexo para a Rigging Telemetry Workbench (sem recursos proprietários).
// Seis malhas independentes (tronco, cabeça, braços e pernas), esqueleto humanoide de 20 ossos gerado pelo motor do
// Codex (makeTemplate) e skin real (bindDraftToModel). Defeitos propositais para a demonstração:
// - assimetria: RightElbow deslocado 0,12 no eixo Y e 0,06 no eixo X antes do bind;
// - uma trilha de animação órfã (osso inexistente) num clipe de teste.
// Funciona em Node (testes unitários) e no navegador (recebe o namespace THREE e o núcleo do Codex).
export function buildWorkbenchCharacter(T, core, {bind = true} = {}) {
  const root = new T.Group();root.name = 'WorkbenchCharacter';
  const add = (name, w, h, d, x, y, z, color) => {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d, 3, 6, 3), new T.MeshStandardMaterial({color}));
    m.name = name;m.position.set(x, y, z);root.add(m);return m;
  };
  add('Torso', .9, 1.0, .5, 0, 1.45, 0, 0x6f8fd8);
  add('Head', .45, .45, .45, 0, 2.2, 0, 0xe0b48a);
  add('ArmLeft', .9, .22, .22, .9, 1.8, 0, 0x6f8fd8);
  add('ArmRight', .9, .22, .22, -.9, 1.8, 0, 0x6f8fd8);
  add('LegLeft', .28, .95, .28, .22, .5, 0, 0x3d4a66);
  add('LegRight', .28, .95, .28, -.22, .5, 0, 0x3d4a66);
  const draft = core.makeTemplate(core.modelBounds(root));
  const elbow = draft.joints.find(j => j.name === 'RightElbow');elbow.p = [elbow.p[0] - .06, elbow.p[1] + .12, elbow.p[2]];
  if (!bind) return {root, draft, clips: []};
  core.bindDraftToModel(root, draft);root.updateMatrixWorld(true);
  const head = root.getObjectByName('Head'), headBone = (() => {let b = null;root.traverse(o => {if (o.isBone && o.name === 'Head') b = o;});return b;})();
  void head;
  const t = [0, .5, 1], q = a => new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), a).toArray();
  const clip = new T.AnimationClip('Teste · cabeça e cauda', 1, [
    new T.QuaternionKeyframeTrack('Head.quaternion', t, [...q(0), ...q(.4), ...q(0)]),
    new T.QuaternionKeyframeTrack('TailMissing.quaternion', t, [...q(0), ...q(.2), ...q(0)]),
  ]);
  void headBone;
  return {root, draft, clips: [clip]};
}
