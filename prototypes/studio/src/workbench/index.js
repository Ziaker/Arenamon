// Montagem da Rigging Telemetry Workbench no Animation Studio (aba “Telemetria”).
// O componente (panel.js + viewer.js) não depende do layout do Studio; aqui só o ligamos à API oficial de rigging
// (engine-official.js), ao visualizador 3D e à ativação da aba.
import {mountWorkbench} from './panel.js';
import {createWorkbenchViewer} from './viewer.js';
import {createOfficialEngine, rigFingerprint} from './engine-official.js';
import {injectWorkbenchStyles} from './styles.js';

const E = window.__importer, host = document.getElementById('wb-host');
const frame = () => new Promise(r => requestAnimationFrame(() => r()));
/**
 * Demonstração: personagem sintético (sem recursos proprietários) montado pelo fluxo REAL do Codex:
 * template humanoide, cotovelo direito fora do espelho, skin (bind) e um clipe com uma trilha órfã.
 */
async function loadDemo() {
  const T = E.T, root = new T.Group();root.name = 'DemonstracaoWorkbench';
  for (const [name, w, h, d, x, y] of [['Torso', .9, 1, .5, 0, 1.45], ['Head', .45, .45, .45, 0, 2.2], ['ArmLeft', .9, .22, .22, .9, 1.8], ['ArmRight', .9, .22, .22, -.9, 1.8], ['LegLeft', .28, .95, .28, .22, .5], ['LegRight', .28, .95, .28, -.22, .5]]) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d, 3, 6, 3), new T.MeshStandardMaterial({color: 0x7890c8}));m.name = name;m.position.set(x, y, 0);root.add(m);
  }
  if (!(await (window.__studioProject?.guardDiscard?.() ?? true))) return;
  await E.install(root, [], 'demonstracao-workbench.glb');
  const R = window.__studioRig, mirror = document.getElementById('rg-mirror'), confirm = window.confirm;
  window.__studioLayout.open('rigging');await frame();await frame();
  R.createTemplate();
  const j = R.draft.joints.find(x => x.name === 'RightElbow'), was = mirror.checked;mirror.checked = false;
  R.applyJoint('RightElbow', [j.p[0] - .06, j.p[1] + .12, j.p[2]]);mirror.checked = was;
  window.confirm = () => true;try {R.bind();} finally {window.confirm = confirm;}
  const q = a => new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), a).toArray();
  E.addClip(new T.AnimationClip('Demonstração · cabeça e cauda', 1, [new T.QuaternionKeyframeTrack('Head.quaternion', [0, .5, 1], [...q(0), ...q(.4), ...q(0)]), new T.QuaternionKeyframeTrack('TailMissing.quaternion', [0, 1], [...q(0), ...q(.2)])]), {select: true});
  window.__studioLayout.open('workbench');
}
if (E && host) {
  injectWorkbenchStyles();
  let panel = null;
  // Mudanças na proposta do auto-rig (que ainda não é rig do modelo) também geram telemetria nova.
  const engine = createOfficialEngine({onChange: () => later()});
  const viewer = createWorkbenchViewer({onPick: id => panel?.pickFromViewer(id)});
  panel = mountWorkbench(host, {engine, viewer, layout: window.__studioLayout, loadDemo});
  const active = () => window.__studioLayout?.panel === 'workbench' && window.__studioLayout?.leftOpen && !!E.model;
  // Como no Rigging do Codex: ao abrir, pausa a animação na pose de repouso; ao sair, restaura o playback.
  let wasActive = false, playBefore = false, pending = 0;
  E.on('tick', () => {
    const now = active();
    if (now && !wasActive) {wasActive = true;playBefore = E.playing;E.enterRigRest();viewer.setActive(true);panel.refresh({keepBaseline: false});}
    // A telemetria é sempre da pose de repouso: enquanto a aba está aberta, a animação fica pausada (como no Rigging do Codex).
    else if (now && E.playing) E.enterRigRest();
    else if (!now && wasActive) {wasActive = false;viewer.setActive(false);if (E.clips.length) {E.selectIndex(E.selectedIndex);E.setPlaying(playBefore);}}
  });
  // Mudanças no rig (patch, desfazer, edições na aba Rigging) geram telemetria nova, uma vez por quadro.
  const later = () => {if (!wasActive || pending) return;pending = requestAnimationFrame(() => {pending = 0;panel.refresh();});};
  E.on('rigChanged', reason => {if (reason !== 'rest') later();});E.on('installed', () => {engine.reset();if (wasActive) panel.refresh({keepBaseline: false});});
  // fingerprint: ossos, pesos, matrizes de bind e metadados do modelo (usado pelos testes de ponta a ponta).
  window.__studioWorkbench = {panel, engine, viewer, loadDemo, fingerprint: () => E.model ? rigFingerprint(E.model) : null, get active() {return active();}};
}
