import type {TutorialLesson} from '../academy';

export const ARCANE_CIRCLE_LESSON: TutorialLesson = {
  id: 'arcane-circle', title: 'Círculo arcano', summary: 'Carga, emissão e erupção ritual', icon: '✣',
  steps: [
    {id: 'plane', title: 'Oriente o selo', instruction: 'Crie um plano e posicione-o na superfície de invocação.', commandId: 'frame', validate: project => ({ok: project.nodes.some(node => node.geometry?.kind === 'plane'), message: 'Crie um plano para o selo.'})},
    {id: 'glyph', title: 'Pinte o glifo', instruction: 'Use a textura segura para desenhar anéis e símbolos.', commandId: 'texture', suggested: 'Textura sugerida: 256 × 256 px', validate: project => ({ok: (project.textures?.length ?? 0) > 0, message: 'Crie uma textura para o glifo.', focusCommandId: 'texture'})},
    {id: 'material', title: 'Acenda as linhas', instruction: 'Aplique material luminoso sem perder a leitura do desenho.', commandId: 'material', validate: project => ({ok: (project.materials?.length ?? 0) > 0, message: 'Aplique um material ao selo.', focusCommandId: 'material'})},
    {id: 'charge', title: 'Construa a carga', instruction: 'Anime escala e opacidade para criar antecipação.', commandId: 'keyframe', suggested: 'Carga sugerida: 1,2 s', validate: project => ({ok: project.timeline.tracks.some(track => track.property === 'scale') && project.timeline.tracks.some(track => track.property === 'opacity'), message: 'Anime escala e opacidade da carga.', focusCommandId: 'keyframe'})},
    {id: 'ambient', title: 'Mantenha a energia', instruction: 'Adicione emissão contínua discreta ao redor do círculo.', commandId: 'emitter', validate: project => ({ok: (project.particles ?? []).some(emitter => emitter.emission.mode === 'continuous'), message: 'Adicione um emissor contínuo.', focusCommandId: 'emitter'})},
    {id: 'eruption', title: 'Dispare a erupção', instruction: 'Sobreponha um burst vertical no fim da carga.', commandId: 'emitter', suggested: 'Burst sugerido: 70 partículas', validate: project => ({ok: (project.particles ?? []).some(emitter => emitter.emission.mode === 'burst'), message: 'Adicione um emissor burst para a erupção.', focusCommandId: 'emitter'})},
    {id: 'review', title: 'Finalize o fade', instruction: 'Apague selo e partículas sem corte seco e revise o orçamento.', commandId: 'backend', validate: project => ({ok: project.timeline.tracks.some(track => track.property === 'opacity') && (project.particles?.length ?? 0) >= 2, message: 'Finalize o fade e mantenha dois ritmos de emissão.'})},
  ],
};
