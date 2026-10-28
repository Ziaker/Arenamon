import type {TutorialLesson} from '../academy';

export const ENERGY_SLASH_LESSON: TutorialLesson = {
  id: 'energy-slash', title: 'Corte de energia', summary: 'Traço, ribbon, brilho e faíscas', icon: '╱',
  steps: [
    {id: 'stroke', title: 'Desenhe o gesto', instruction: 'Trace uma curva clara com começo, ápice e saída.', commandId: 'draw', validate: project => ({ok: project.nodes.some(node => node.geometry?.kind === 'stroke' || node.geometry?.kind === 'curve'), message: 'Desenhe um stroke ou uma curva.', focusCommandId: 'draw'})},
    {id: 'ribbon', title: 'Dê corpo ao corte', instruction: 'Converta o gesto em ribbon para ganhar superfície.', commandId: 'ribbon', validate: project => ({ok: project.nodes.some(node => node.geometry?.kind === 'ribbon'), message: 'O corte precisa de um ribbon.', focusCommandId: 'ribbon'})},
    {id: 'taper', title: 'Afine a saída', instruction: 'Ajuste largura e taper para concentrar o peso no centro.', commandId: 'ribbon', suggested: 'Largura sugerida: 0,18 m', validate: project => ({ok: project.nodes.some(node => node.geometry?.kind === 'ribbon' && node.geometry.width > 0), message: 'Defina uma largura visível para o ribbon.'})},
    {id: 'trail', title: 'Anime o rastro', instruction: 'Use keyframes para revelar e apagar o corte rapidamente.', commandId: 'keyframe', suggested: 'Leitura sugerida: 0,35 s', validate: project => ({ok: project.timeline.tracks.some(track => track.property === 'opacity' && track.keyframes.length >= 2), message: 'Anime a opacidade do rastro.', focusCommandId: 'keyframe'})},
    {id: 'glow', title: 'Acenda o material', instruction: 'Escolha um material luminoso que preserve o contorno.', commandId: 'material', validate: project => ({ok: (project.materials?.length ?? 0) > 0, message: 'Aplique um material ao corte.', focusCommandId: 'material'})},
    {id: 'sparks', title: 'Adicione faíscas', instruction: 'Use um burst curto acompanhando a direção do gesto.', commandId: 'emitter', suggested: 'Burst sugerido: 36 partículas', validate: project => ({ok: (project.particles?.length ?? 0) > 0, message: 'Adicione um emissor curto.', focusCommandId: 'emitter'})},
    {id: 'review', title: 'Revise o ritmo', instruction: 'Confirme silhueta, fade e orçamento no preview.', commandId: 'backend', validate: project => ({ok: project.timeline.tracks.length > 0 && (project.particles?.length ?? 0) > 0, message: 'O corte precisa de animação e faíscas.'})},
  ],
};
