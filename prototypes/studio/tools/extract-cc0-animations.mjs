// Extrai as animações do RobotExpressive (Tomás Laulhé / Quaternius, CC0 1.0) para o formato de dados do Studio.
//
// Uso: node prototypes/studio/tools/extract-cc0-animations.mjs <caminho/RobotExpressive.glb>
//
// O GLB não entra no Git (o .gitignore exclui *.glb). Só os DADOS das animações (keyframes de rotação e translação
// dos ossos), o esqueleto de repouso necessário para o retarget e a procedência entram em
// src/library/robot-expressive.anim.json. O arquivo de origem é conferido pelo SHA-256 antes da extração.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const SOURCE = {
  id: 'robot-expressive',
  title: 'RobotExpressive',
  author: 'Tomás Laulhé (Quaternius)',
  modifications: 'Don McCurdy (morph targets faciais, conversão FBX2GLTF, materiais); morph targets e malha não são incluídos aqui',
  license: 'CC0 1.0 Universal (domínio público)',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  url: 'https://github.com/mrdoob/three.js/tree/b924f0cad4058dc4dde71445c796980c3cd5b5ed/examples/models/gltf/RobotExpressive',
  file: 'examples/models/gltf/RobotExpressive/RobotExpressive.glb',
  commit: 'b924f0cad4058dc4dde71445c796980c3cd5b5ed',
  sha256: '047f5e5fb3bb6d378bd1df16ca6137f2a596c99b3a1b5690b4020c05aaf6f319',
  readme: 'Model by Tomás Laulhé. Before using this model on a project, consider supporting the creator\'s Patreon. CC0 1.0.',
};
/** Clipes que repetem em ciclo (os demais são ações de uma vez). */
const LOOPS = new Set(['Idle', 'Walking', 'Running', 'Dance']);
/** Alvos de IK e marcadores do rig de origem: não são articulações anatômicas e não entram no retarget. */
const SKIP = /^(PoleTarget|Foot)\./;
const r5 = v => Math.round(v * 1e5) / 1e5;

export function extract(buffer) {
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  if (sha256 !== SOURCE.sha256) throw Error(`SHA-256 inesperado (${sha256}); baixe o arquivo do commit ${SOURCE.commit}.`);
  const jsonLength = buffer.readUInt32LE(12), gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
  const binStart = 20 + jsonLength + 8, bin = buffer.subarray(binStart);
  const read = index => {
    const acc = gltf.accessors[index], view = gltf.bufferViews[acc.bufferView], n = {SCALAR: 1, VEC3: 3, VEC4: 4}[acc.type];
    if (acc.componentType !== 5126) throw Error('Esperado float32 nos dados de animação.');
    const offset = (view.byteOffset || 0) + (acc.byteOffset || 0), stride = view.byteStride || n * 4, out = [];
    for (let i = 0; i < acc.count; i++) for (let k = 0; k < n; k++) out.push(bin.readFloatLE(offset + i * stride + k * 4));
    return out;
  };
  const skin = gltf.skins[0], joints = new Set(skin.joints), parent = new Map();
  gltf.nodes.forEach((n, i) => (n.children || []).forEach(c => parent.set(c, i)));
  // Nós do esqueleto: as articulações e todos os ancestrais até a cena (para o espaço da raiz ser o da cena).
  const keep = new Set();
  for (const j of joints) for (let i = j; i !== undefined; i = parent.get(i)) keep.add(i);
  const order = [];const visit = i => {if (keep.has(i)) {order.push(i);for (const c of gltf.nodes[i].children || []) visit(c);}};
  for (const r of gltf.scenes[0].nodes) visit(r);
  const nodes = order.map(i => {const n = gltf.nodes[i];return {name: n.name, parent: parent.has(i) && keep.has(parent.get(i)) ? gltf.nodes[parent.get(i)].name : null, joint: joints.has(i),
    t: (n.translation || [0, 0, 0]).map(r5), r: n.rotation || [0, 0, 0, 1], s: (n.scale || [1, 1, 1]).map(r5)};});
  const clips = gltf.animations.map(a => {
    const tracks = [];
    for (const ch of a.channels) {
      const node = gltf.nodes[ch.target.node], path = ch.target.path;
      if (!joints.has(ch.target.node) || SKIP.test(node.name) || !['rotation', 'translation'].includes(path)) continue;
      const s = a.samplers[ch.sampler];if (s.interpolation && s.interpolation !== 'LINEAR') throw Error('Interpolação não suportada: ' + s.interpolation);
      tracks.push({node: node.name, path: path === 'rotation' ? 'quaternion' : 'position', times: read(s.input).map(r5), values: read(s.output).map(r5)});
    }
    const duration = Math.max(...tracks.map(t => t.times.at(-1)));
    return {name: a.name, duration: r5(duration), loop: LOOPS.has(a.name), tracks};
  });
  return {schema: 'arenamon-animation-library', version: 1, source: SOURCE, upAxis: 'Y', nodes, clips};
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const input = process.argv[2];if (!input) {console.error('Uso: node extract-cc0-animations.mjs <RobotExpressive.glb>');process.exit(2);}
  const data = extract(readFileSync(input)), out = fileURLToPath(new URL('../src/library/robot-expressive.anim.json', import.meta.url));
  writeFileSync(out, JSON.stringify(data) + '\n');
  console.log(`${data.clips.length} clipes, ${data.nodes.length} nós → ${out}`);
}
