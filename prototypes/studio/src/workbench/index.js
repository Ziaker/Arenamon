// Montagem da Rigging Telemetry Workbench no Animation Studio (aba “Telemetria”).
// O componente (panel.js + viewer.js) não depende do layout do Studio; aqui só o ligamos ao motor real do Codex
// (engine-codex.js), ao visualizador 3D e à ativação da aba.
import {mountWorkbench} from './panel.js';
import {createWorkbenchViewer} from './viewer.js';
import {createCodexEngine} from './engine-codex.js';
import {injectWorkbenchStyles} from './styles.js';

const E = window.__importer, host = document.getElementById('wb-host');
if (E && host) {
  injectWorkbenchStyles();
  const engine = createCodexEngine();
  let panel = null;
  const viewer = createWorkbenchViewer({onPick: id => panel?.pickFromViewer(id)});
  panel = mountWorkbench(host, {engine, viewer, layout: window.__studioLayout});
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
  E.on('rigChanged', reason => {if (reason !== 'rest') later();});E.on('installed', () => {if (wasActive) panel.refresh({keepBaseline: false});});
  window.__studioWorkbench = {panel, engine, viewer, get active() {return active();}};
}
