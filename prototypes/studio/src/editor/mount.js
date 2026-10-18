// Reorganiza o DOM antes dos módulos legados serem inicializados (eles localizam elementos por id,
// então mover nós não altera seus handlers). Nenhum controle é duplicado: play fica na pílula da timeline,
// seletor de clipe, velocidade e loop ficam na barra da timeline expandida.
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
document.querySelector('.lab-transport.timeline-main')?.setAttribute('hidden', '');
document.querySelector('.stage-bottom .transport')?.setAttribute('hidden', '');
const compareType = $('lab-compare-type');
compareType.append(new Option('Animação A × animação B', 'clips'), new Option('Original × editada', 'original'));
compareType.closest('.lab-transport')?.setAttribute('hidden', '');
$('ed-cmp-type-slot').append(compareType);
