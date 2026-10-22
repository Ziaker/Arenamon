// Validador de personagens e animações (importação). Só inspeciona: nada é descartado nem alterado. O veredito é
// “Compatível”, “Compatível com ressalvas” ou “Incompatível”, com a lista de ressalvas e o detalhe por clipe.
import * as T from 'three';
import {boneKey, ACTION_IDS} from './characters.js';

const LEVEL = {ok: 0, info: 0, warn: 1, bad: 2};
export const VERDICT = ['Compatível', 'Compatível com ressalvas', 'Incompatível'];
const verdictOf = issues => Math.max(0, ...issues.map(i => LEVEL[i.level] ?? 0));
const PROPS = new Set(['position', 'quaternion', 'scale', 'morphTargetInfluences', 'rotation']);

/** Formato pelo cabeçalho: GLB 2.0 (“glTF”, versão 2) ou glTF JSON. */
export function sniffFormat(bytes) {
  if (!bytes || bytes.byteLength < 12) return {ok: false, text: 'arquivo vazio ou truncado'};
  const dv = new DataView(bytes instanceof ArrayBuffer ? bytes : bytes.buffer, bytes.byteOffset ?? 0);
  if (dv.getUint32(0, true) === 0x46546c67) {const v = dv.getUint32(4, true), len = dv.getUint32(8, true);return {ok: v === 2, kind: 'GLB', version: v, text: v === 2 ? `GLB 2.0 · ${(len / 1024).toFixed(0)} KB` : `GLB versão ${v} (só 2.0 é suportada)`, truncated: len > bytes.byteLength};}
  const head = new TextDecoder().decode(new Uint8Array(bytes instanceof ArrayBuffer ? bytes : bytes.buffer, bytes.byteOffset ?? 0, Math.min(64, bytes.byteLength))).trim();
  if (head.startsWith('{')) return {ok: true, kind: 'glTF', text: 'glTF (JSON)'};
  if (head.startsWith('Kaydara') || head.includes('FBX')) return {ok: false, kind: 'FBX', text: 'FBX não é suportado: converta para GLB (ex.: no Animation Studio ou no Blender)'};
  return {ok: false, text: 'formato desconhecido (esperado GLB 2.0)'};
}
/** Análise de um clipe contra o objeto raiz que será animado. */
function clipIssues(clip, root, hips, height) {
  const issues = [], missing = new Set(), badProps = new Set();let found = 0;
  for (const tr of clip.tracks) {
    const dot = tr.name.lastIndexOf('.'), node = tr.name.slice(0, dot), prop = tr.name.slice(dot + 1).replace(/\[.*$/, '');
    const target = root.getObjectByName(node);
    if (!target) {missing.add(node);continue;}found++;
    if (!PROPS.has(prop)) badProps.add(`${node}.${prop}`);
    else if (prop === 'morphTargetInfluences' && !target.morphTargetInfluences) badProps.add(`${node}.${prop} (sem morph targets)`);
  }
  const coverage = clip.tracks.length ? found / clip.tracks.length : 0;
  if (!clip.tracks.length) issues.push({level: 'bad', text: 'clipe sem trilhas'});
  if (!(clip.duration > 0)) issues.push({level: 'bad', text: 'duração zero'});
  else if (clip.duration > 20) issues.push({level: 'warn', text: `duração longa (${clip.duration.toFixed(1)} s)`});
  if (missing.size) issues.push({level: coverage < .6 ? 'bad' : 'warn', text: `${missing.size} osso(s)/nó(s) ausente(s) no modelo: ${[...missing].slice(0, 4).join(', ')}${missing.size > 4 ? '…' : ''} (cobertura ${(coverage * 100).toFixed(0)}%)`});
  if (badProps.size) issues.push({level: 'warn', text: `trilhas incompatíveis: ${[...badProps].slice(0, 3).join(', ')}${badProps.size > 3 ? '…' : ''}`});
  // Root motion: a posição mundial vem da física; horizontal é descartado e vertical pode ser travado no apoio do chão.
  const hipTrack = hips && clip.tracks.find(t => t.name === `${hips.name}.position`);
  if (hipTrack) {
    const v = hipTrack.values;let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < v.length; i += 3) {minX = Math.min(minX, v[i]);maxX = Math.max(maxX, v[i]);minY = Math.min(minY, v[i + 1]);maxY = Math.max(maxY, v[i + 1]);minZ = Math.min(minZ, v[i + 2]);maxZ = Math.max(maxZ, v[i + 2]);}
    const travel = Math.hypot(maxX - minX, maxZ - minZ) * (hips.parent ? hips.parent.getWorldScale(new T.Vector3()).x : 1);
    const vertical = (maxY - minY) * (hips.parent ? hips.parent.getWorldScale(new T.Vector3()).y : 1);
    if (travel > .2 * height) issues.push({level: 'info', text: `root motion horizontal (${travel.toFixed(2)} unidades): será neutralizado — a posição vem da física`});
    if (vertical > .2 * height) issues.push({level: 'info', text: `root motion vertical (${vertical.toFixed(2)} unidades): a trava de chão impede que o clipe levante o personagem`});
  }
  return {issues, coverage, missing: [...missing]};
}
/** Valida um modelo carregado (source de loadStudioFile) e o personagem criado a partir dele. */
export function validateModel(source, character = null, bytes = null) {
  const issues = [], scene = source.scene;let meshes = 0, skinned = 0, bones = 0;
  scene.traverse(o => {if (o.isMesh) meshes++;if (o.isSkinnedMesh) skinned++;if (o.isBone) bones++;});
  const fmt = bytes ? sniffFormat(bytes) : null;
  if (fmt) issues.push({level: fmt.ok ? 'ok' : 'bad', text: `Formato: ${fmt.text}`});
  issues.push({level: meshes ? 'ok' : 'bad', text: `${meshes} malha(s), ${skinned} com skinning, ${bones} osso(s)`});
  if (meshes && !skinned) issues.push({level: 'warn', text: 'sem skinning: as animações só movem nós inteiros (sem deformação)'});
  if (!source.animations.length) issues.push({level: 'bad', text: 'nenhuma animação no arquivo'});
  const box = new T.Box3().setFromObject(scene), height = box.max.y - box.min.y;
  if (!(height > 0)) issues.push({level: 'bad', text: 'caixa do modelo vazia'});
  else {
    if (height < .05 || height > 50) issues.push({level: 'warn', text: `escala inesperada: altura ${height.toPrecision(3)} unidades (provável unidade em cm/mm); o ajuste ao colisor compensa`});
    if (Math.abs(box.min.y) > .3 * height) issues.push({level: 'warn', text: `posição vertical inesperada: base em y = ${box.min.y.toPrecision(3)} (pivô deslocado); o ajuste automático de altura compensa`});
  }
  const names = source.animations.map(c => c.name), dup = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
  if (dup.length) issues.push({level: 'warn', text: `nomes de clipe duplicados (as associações são guardadas por nome): ${dup.join(', ')}`});
  // Mapa de ações do Studio: estados inexistentes e referências quebradas.
  const actions = source.manifest?.actions || {};
  const unknown = Object.keys(actions).filter(id => !ACTION_IDS.includes(id)), broken = Object.entries(actions).filter(([, r]) => r && source.animations[r.clipIndex]?.name !== r.clipName).map(([id]) => id);
  if (unknown.length) issues.push({level: 'warn', text: `animações associadas a estados que não existem no laboratório: ${unknown.join(', ')}`});
  if (broken.length) issues.push({level: 'warn', text: `referências inválidas no mapa do Studio (clipe trocado ou ausente): ${broken.join(', ')}`});
  if (character?.missingAssociations?.length) issues.push({level: 'warn', text: `associações salvas sem clipe correspondente: ${character.missingAssociations.join(', ')}`});
  let hips = null;scene.traverse(o => {if (!hips && o.isBone && /hip|pelvis|root/i.test(o.name)) hips = o;});
  const clips = source.animations.map(c => {const r = clipIssues(c, scene, hips, height || 1);return {name: c.name, duration: c.duration, tracks: c.tracks.length, coverage: r.coverage, verdict: verdictOf(r.issues), issues: r.issues};});
  const badClips = clips.filter(c => c.verdict === 2).length, warnClips = clips.filter(c => c.verdict === 1).length;
  if (badClips) issues.push({level: 'warn', text: `${badClips} clipe(s) incompatível(is) com este modelo (ficam na biblioteca, desabilitados para associação)`});
  if (warnClips) issues.push({level: 'info', text: `${warnClips} clipe(s) com ressalvas`});
  if (clips.some(c => c.issues.some(i => /root motion/.test(i.text)))) issues.push({level: 'info', text: 'há clipes com root motion; o laboratório neutraliza o horizontal e oferece trava vertical no chão'});
  const v = Math.max(verdictOf(issues), clips.length && badClips === clips.length ? 2 : 0);
  return {kind: 'model', name: source.name, verdict: v, label: VERDICT[v], issues, clips, height, bones, skinned};
}
/** Valida um arquivo de animações (loadAnimationFile) contra o personagem que vai recebê-lo, antes de importar. */
export function validateAnimations(file, character, bytes = null) {
  const issues = [], fmt = bytes ? sniffFormat(bytes) : null;
  if (fmt) issues.push({level: fmt.ok ? 'ok' : 'bad', text: `Formato: ${fmt.text}`});
  if (!file.animations.length) issues.push({level: 'bad', text: 'nenhuma animação no arquivo'});
  // Diferença de rig: ossos do arquivo × ossos do modelo (nomes normalizados, ex.: “mixamorig:Hips” ≈ “Hips”).
  if (file.scene) {
    const theirs = new Set();file.scene.traverse(o => {if (o.isBone) theirs.add(boneKey(o.name));});
    if (theirs.size) {
      const mine = new Set(character.bones.keys()), common = [...theirs].filter(k => mine.has(k)).length, ratio = common / theirs.size;
      issues.push({level: ratio >= .9 ? 'ok' : ratio >= .6 ? 'warn' : 'bad', text: `rig: ${common} de ${theirs.size} ossos do arquivo existem no modelo (${(ratio * 100).toFixed(0)}%)${ratio < .9 ? ' — rig ou skinning diferentes' : ''}`});
    }
  }
  const existing = new Set(character.clips.map(c => c.name));let hips = character.hips, height = character.restHeight || 1;
  const clips = file.animations.map(clip => {
    // Mesma regra de nomes da importação (ossos com prefixos de exportador são reconhecidos).
    const c = clip.clone();c.tracks = c.tracks.map(tr => {const dot = tr.name.lastIndexOf('.'), node = tr.name.slice(0, dot), target = character.root.getObjectByName(node) ? node : character.bones.get(boneKey(node));const t2 = tr.clone();if (target) t2.name = target + tr.name.slice(dot);return t2;});
    const r = clipIssues(c, character.root, hips, height);
    if (existing.has(clip.name) || file.animations.filter(x => x.name === clip.name).length > 1) r.issues.push({level: 'info', text: 'nome já existe: será importado com o nome do arquivo entre colchetes'});
    return {name: clip.name, duration: clip.duration, tracks: clip.tracks.length, coverage: r.coverage, verdict: verdictOf(r.issues), issues: r.issues};
  });
  const bad = clips.filter(c => c.verdict === 2).length;
  if (bad) issues.push({level: bad === clips.length ? 'bad' : 'warn', text: `${bad} de ${clips.length} clipe(s) incompatível(is) (serão importados desabilitados, sem descartar)`});
  const v = Math.max(verdictOf(issues), clips.length && clips.every(c => c.verdict === 2) ? 2 : 0, clips.some(c => c.verdict === 1) ? 1 : 0);
  return {kind: 'animations', name: file.name, verdict: v, label: VERDICT[v], issues, clips};
}
