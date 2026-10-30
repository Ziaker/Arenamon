// Chaves portáteis de clipe (salvar/restaurar associações sem trocar clipe em silêncio) e conversão do perfil curado em variantes.
/** Chave portátil do clipe i: o nome; a 2ª, 3ª… ocorrência do mesmo nome ganham o sufixo «@@dupN» (ordem do arquivo). */
export function clipKeyOf(clips, i) {
  const c = clips[i];if (!c) return undefined;
  let n = 1;for (let k = 0; k < i; k++) if (clips[k].name === c.name) n++;
  return n === 1 ? c.name : `${c.name}@@dup${n}`;
}
/** Inverso de clipKeyOf: índice do clipe, ou -1 se o arquivo não o tem mais (nunca cai em outro clipe). */
export function clipIndexOfKey(clips, key) {
  const exact = clips.findIndex(c => c.name === key);
  if (exact >= 0) return exact;
  const m = /^(.*)@@dup(\d+)$/.exec(key || '');if (!m) return -1;
  let n = 0;for (let k = 0; k < clips.length; k++) if (clips[k].name === m[1] && ++n === Number(m[2])) return k;
  return -1;
}
/** Converte o perfil (nomes de clipe) em variantes por índice, ignorando clipes que o arquivo não tem. */
export function profileVariants(clips, profile) {
  const byName = new Map(clips.map((c, i) => [c.name, i])), out = {};
  for (const [id, names] of Object.entries(profile.clips)) {
    const list = [...new Set(names.map(n => byName.get(n)).filter(i => i != null))];
    if (list.length) out[id] = list;
  }
  return out;
}
