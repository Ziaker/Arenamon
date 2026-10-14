export const ACTIONS = [
  ['idle', 'idle'], ['hit', 'hit'], ['knockback', 'knockback'], ['death', 'death'],
  ['downed', 'downed · recuperação no chão'], ['walk', 'walk'], ['walk_back', 'walk back'],
  ['walk_left', 'walk left'], ['walk_right', 'walk right'], ['jump', 'jump'],
  ['dodge_forward', 'dodge (forward)'], ['dodge_back', 'dodge back'],
  ['dodge_left', 'dodge left'], ['dodge_right', 'dodge right'], ['tackle', 'tackle'],
  ...[1, 2, 3, 4].map(i => [`move_${i}`, `move ${i}`]),
  ['block_start', 'block start'], ['block', 'block'], ['blocked', 'blocked'], ['block_end', 'block end'],
];
export const EXTRAS = [1, 2, 3, 4].map(i => `extra_${i}`);
const normalize = name => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function alternativeTarget(name) {
  const text = ` ${normalize(name)} `;
  const matches = ACTIONS.filter(([id]) => {
    const aliases = [id.replaceAll('_', ' ')];
    if (id === 'dodge_forward') aliases.push('dodge', 'dodge foward');
    return aliases.some(alias => text.includes(` alt ${alias} `));
  }).map(([id]) => id);
  // Prefer the directional/phase action over its shorter prefix.
  const specific = matches.filter(id => !matches.some(other => other !== id && other.startsWith(id + '_')));
  if (specific.includes('dodge_forward') && specific.some(id => id.startsWith('dodge_') && id !== 'dodge_forward')) {
    specific.splice(specific.indexOf('dodge_forward'), 1);
  }
  return specific.length === 1 ? specific[0] : null;
}

export function createActionEditor({getClips, onRename, status}) {
  const $ = id => document.getElementById(id);
  let assignments = new Map();
  const rows = new Map();
  for (const [id, label] of [...ACTIONS, ...EXTRAS.map(id => [id, id.replace('_', ' ')])]) {
    const row = document.createElement('label');
    const title = document.createElement('span');title.textContent = label;
    const select = document.createElement('select');select.id = `action-${id}`;
    const hint = document.createElement('small');
    row.append(title, select, hint);$('action-list').append(row);rows.set(id, {select, hint});
    select.onchange = () => {assignments.set(id, getClips()[Number(select.value)] || null);refresh();};
  }
  function reference(clip) {
    const index = getClips().indexOf(clip);
    return index < 0 ? null : {clipIndex: index, clipName: clip.name};
  }
  function manifest() {
    const actions = Object.fromEntries(ACTIONS.map(([id]) => [id, reference(assignments.get(id))]));
    const extras = Object.fromEntries(EXTRAS.map(id => {
      const clip = assignments.get(id), ref = reference(clip);
      return [id, ref ? {...ref, alternativeFor: alternativeTarget(clip.name)} : null];
    }));
    const warnings = [];
    for (const [slot, extra] of Object.entries(extras)) {
      if (extra && !extra.alternativeFor) warnings.push(`${slot}: nome sem uma ação alternativa válida. Use, por exemplo, "alt tackle".`);
      else if (extra && !actions[extra.alternativeFor]) warnings.push(`${slot}: a ação principal ${extra.alternativeFor} ainda não foi preenchida.`);
    }
    return {
      schemaVersion: 1, modelFile: 'arenamon-prototipo.glb',
      clips: getClips().map((clip, clipIndex) => ({clipIndex, clipName: clip.name, duration: clip.duration})),
      actions, extras,
      randomAlternatives: {
        probability: Math.max(0, Math.min(100, Number($('alt-chance').value) || 0)) / 100,
        selection: 'uniform-among-distinct-matching-extra-clips',
        fallback: 'primary-action', trigger: 'once-on-action-start',
      },
      missingActions: ACTIONS.filter(([id]) => !actions[id]).map(([id]) => id), warnings,
    };
  }
  function refresh() {
    const clips = getClips();
    for (const [id, {select, hint}] of rows) {
      const clip = assignments.get(id), index = clips.indexOf(clip);
      select.replaceChildren(new Option('— Pendente / sem animação —', '-1'), ...clips.map((c, i) => new Option(c.name, String(i))));
      select.value = String(index);select.disabled = !clips.length;
      hint.textContent = index < 0 ? '○ Pendente' : EXTRAS.includes(id)
        ? (alternativeTarget(clip.name) ? `✓ Alternativa de ${alternativeTarget(clip.name)}` : '⚠ Renomeie: alt + ação (ex.: alt tackle)')
        : '✓ Associada';
    }
    const data = manifest();
    $('action-progress').textContent = `${ACTIONS.length - data.missingActions.length}/${ACTIONS.length} ações associadas · extras opcionais`;
    $('action-warnings').textContent = data.warnings.join('\n');
    $('export-json').disabled = !clips.length;
    selected();
  }
  function selected() {
    const clip = getClips()[Number($('clip').value)];
    $('clip-name').value = clip?.name || '';
    $('clip-name').disabled = !clip;$('rename-clip').disabled = !clip;
  }
  $('rename-clip').onclick = () => {
    const clips = getClips(), clip = clips[Number($('clip').value)], name = $('clip-name').value.trim();
    if (!clip) return;
    if (!name) return status('Digite um nome para a animação.');
    if (clips.some(c => c !== clip && c.name.toLowerCase() === name.toLowerCase())) return status('Esse nome já está em uso. Escolha um nome único.');
    clip.name = name;onRename();refresh();status(`Animação renomeada para “${name}”. Exporte novamente o GLB e o JSON juntos.`);
  };
  $('clip-name').onkeydown = event => {if (event.key === 'Enter') $('rename-clip').click();};
  function uniqueNames() {
    const used = new Set();
    getClips().forEach(clip => {const base = clip.name.trim() || 'Animação';let name = base, suffix = 2;while (used.has(name.toLowerCase())) name = `${base} (${suffix++})`;clip.name = name;used.add(name.toLowerCase());});
  }
  function reset(saved) {
    assignments = new Map();uniqueNames();$('alt-chance').value = '20';
    if (saved?.schemaVersion === 1) {
      for (const id of [...ACTIONS.map(([id]) => id), ...EXTRAS]) {
        const ref = saved.actions?.[id] || saved.extras?.[id];
        if (ref && getClips()[ref.clipIndex]?.name === ref.clipName) assignments.set(id, getClips()[ref.clipIndex]);
      }
      if (Number.isFinite(saved.randomAlternatives?.probability)) $('alt-chance').value = String(Math.max(0, Math.min(1, saved.randomAlternatives.probability)) * 100);
    }
    refresh();
  }
  refresh();return {manifest, refresh, selected, uniqueNames, reset};
}
