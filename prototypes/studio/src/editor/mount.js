// Reorganiza o DOM da v6 antes dos módulos legados serem inicializados (eles localizam elementos por id,
// então mover nós não altera seus handlers). Nenhum controle é duplicado: play, animação, velocidade e loop
// passam a morar na barra da timeline; o antigo slider de tempo é substituído pela timeline.
const $ = id => document.getElementById(id);
const stage = document.querySelector('.stage'), dock = $('ed-dock');
stage.append(dock);
document.querySelector('.header-actions')?.prepend($('ed-history'));
$('ed-play-slot').replaceWith($('play'));
const clipLabel = document.querySelector('label[for="clip"]');
$('ed-clip-slot').append(...[clipLabel, $('clip')].filter(Boolean));
for (const id of ['lab-speed', 'lab-loop']) {
  const label = document.querySelector(`label[for="${id}"]`), wrap = document.createElement('label');
  wrap.className = 'ed-inline';wrap.title = id === 'lab-speed' ? 'Velocidade da prévia (não altera a animação)' : 'Repetir a animação na prévia';
  wrap.append(label?.textContent === 'Vel.' ? 'Prévia' : (label?.textContent || ''), $(id));label?.remove();$('ed-opts').append(wrap);
}
// O antigo slider (lab-scrub), os botões ‹ › e o relógio permanecem no DOM (ocultos) para compatibilidade.
document.querySelector('.lab-transport.timeline-main')?.setAttribute('hidden', '');
document.querySelector('.stage-bottom .transport')?.setAttribute('hidden', '');
// O seletor de tipo de comparação passa a ficar na ferramenta Comparar.
const compareType = $('lab-compare-type');
compareType.append(new Option('Animação A × animação B', 'clips'), new Option('Original × editada', 'original'));
compareType.closest('.lab-transport')?.setAttribute('hidden', '');
$('ed-cmp-type-slot').append(compareType);
// Etapa “Editar” no fluxo principal.
const steps = document.querySelector('.workflow'), preview = steps?.querySelector('[data-workflow="preview"]');
if (preview) {
  const edit = document.createElement('button');edit.type = 'button';edit.className = 'workflow-step';edit.dataset.workflow = 'edit';
  edit.title = 'Recortar, ajustar tempo, marcar eventos e editar root motion';edit.innerHTML = '<span class="step-num">✎</span><span>Editar</span>';
  preview.after(edit);
}
const help = document.querySelector('.stage-bottom .help-inline');
if (help) help.textContent = 'Arraste para girar · Roda: zoom · F enquadra · Espaço reproduz · ←/→ quadro · I/O marcam trecho · Ctrl+Z desfaz';
