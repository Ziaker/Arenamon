import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root = new URL('../', import.meta.url);
await mkdir(new URL('validation/', root), {recursive: true});
await build({entryPoints: [fileURLToPath(new URL('src/index.ts', root))], bundle: true, platform: 'node', format: 'esm', outfile: fileURLToPath(new URL('validation/f2.mjs', root))});
const api = await import(new URL('validation/f2.mjs', root));
const fixture = () => JSON.parse(readFileSync(new URL('fixtures/canonical-project.json', import.meta.url), 'utf8'));

assert.equal(typeof api.quantizeTime, 'function', 'a F2 exporta o relógio de timeline');
assert.equal(api.quantizeTime(.041, 24, 2), 1 / 24);
assert.equal(api.quantizeTime(.041, 30, 2), 1 / 30);
assert.equal(api.quantizeTime(99, 60, 2), 2);
assert.equal(api.quantizeTime(-1, 60, 2), 0);

const baseTrack = {id: 'x', targetId: 'shape', property: 'position.x', keyframes: [
  {time: 0, value: 0, interpolation: 'linear'},
  {time: 1, value: 10, interpolation: 'linear'},
]};
assert.equal(api.evaluateNumericTrack(baseTrack, .25), 2.5);
assert.equal(api.evaluateNumericTrack({...baseTrack, keyframes: [{time: 0, value: 2, interpolation: 'step'}, {time: 1, value: 9, interpolation: 'linear'}]}, .9), 2);
assert.equal(api.evaluateNumericTrack({...baseTrack, keyframes: [{time: 0, value: 0, interpolation: 'bezier', outTangent: 0}, {time: 1, value: 10, interpolation: 'linear', inTangent: 0}]}, .5), 5);
assert.deepEqual(api.advancePlayback({time: .1, duration: 2, direction: -1, playing: true}, .25), {time: 0, duration: 2, direction: -1, playing: false});

const pathTrack = {id: 'morph', targetId: 'path', property: 'path.points', keyframes: [
  {time: 0, value: [[0, 0, 0], [1, 0, 0]], interpolation: 'linear'},
  {time: 1, value: [[0, 2, 0], [3, 0, 0]], interpolation: 'linear'},
]};
assert.deepEqual(api.evaluatePathTrack(pathTrack, .5), [[0, 1, 0], [2, 0, 0]]);
assert.throws(() => api.evaluatePathTrack({...pathTrack, keyframes: [...pathTrack.keyframes, {time: 2, value: [[0, 0, 0]], interpolation: 'linear'}]}, 1.5), /topologia/i);

const texture = api.createTextureDocument({id: 'mask', name: 'Máscara', width: 2, height: 2});
assert.equal(api.decodeTexturePixels(texture).length, 16);
const painted = api.paintTextureStroke(texture, {x: 0, y: 0, radius: 1, color: '#ff0000', opacity: 1});
assert.deepEqual([...api.decodeTexturePixels(painted).slice(0, 4)], [255, 0, 0, 255]);
assert.equal(api.validateTextureDocument({...texture, rgbaBase64: 'AA=='}).ok, false);
assert.equal(api.validateTextureDocument({...texture, spriteSheet: {columns: 2, rows: 2, fps: 24}}).ok, true);

const graph = {
  id: 'material-main', name: 'Material principal', outputNodeId: 'out',
  nodes: [
    {id: 'color', type: 'color', params: {color: '#44aaff'}},
    {id: 'out', type: 'output', params: {roughness: .35, metalness: 0}},
  ],
  connections: [{fromNodeId: 'color', fromPort: 'color', toNodeId: 'out', toPort: 'color'}],
};
assert.equal(api.validateMaterialGraph(graph, [painted]).ok, true);
assert.deepEqual({...api.compileMaterialRecipe(graph, [painted]), operations: undefined}, {color: '#44aaff', emissive: '#000000', metalness: 0, opacity: 1, roughness: .35, transparent: false, operations: undefined});
assert.equal(api.compileMaterialRecipe(graph, [painted]).operations.length, 2);
assert.equal(JSON.stringify(api.compileMaterialRecipe(graph, [painted])), JSON.stringify(api.compileMaterialRecipe(structuredClone(graph), [painted])));
assert.equal(api.validateMaterialGraph({...graph, connections: [...graph.connections, {fromNodeId: 'out', fromPort: 'color', toNodeId: 'color', toPort: 'color'}]}, [painted]).ok, false);
assert.equal(api.validateMaterialGraph({...graph, nodes: [...graph.nodes, {id: 'rogue', type: 'glsl', params: {}}]}, [painted]).ok, false);
assert.equal(api.validateMaterialGraph({...graph, nodes: [{id: 'color', type: 'color', params: {color: '#44aaff', url: 'https://invalid'}}, graph.nodes[1]]}, [painted]).ok, false);
assert.equal(api.validateMaterialGraph({...graph, nodes: [graph.nodes[0], {id: 'out', type: 'output', params: {roughness: NaN}}]}, [painted]).ok, false);
assert.equal(api.validateMaterialGraph({...graph, connections: null}, [painted]).ok, false);
assert.equal(api.validateMaterialGraph({...graph, nodes: [null, graph.nodes[1]]}, [painted]).ok, false);
assert.equal(api.validateMaterialGraph({...graph, connections: [null]}, [painted]).ok, false);
assert.equal(api.validateMaterialGraph({...graph, nodes: [{id: 'noise', type: 'noise', params: {scale: 2}}, graph.nodes[1]], connections: [{fromNodeId: 'noise', fromPort: 'value', toNodeId: 'out', toPort: 'color'}]}, [painted]).ok, false);
const proceduralGraph = {id: 'procedural', name: 'Dissolve', outputNodeId: 'out', nodes: [
  {id: 'base', type: 'color', params: {color: '#ffffff'}}, {id: 'mask', type: 'noise', params: {scale: 4}},
  {id: 'cut', type: 'dissolve', params: {threshold: .5, edgeWidth: .1, edgeColor: '#ffaa00'}}, {id: 'out', type: 'output', params: {roughness: .4, metalness: 0}},
], connections: [
  {fromNodeId: 'base', fromPort: 'color', toNodeId: 'cut', toPort: 'source'}, {fromNodeId: 'mask', fromPort: 'value', toNodeId: 'cut', toPort: 'mask'}, {fromNodeId: 'cut', fromPort: 'color', toNodeId: 'out', toPort: 'color'},
]};
assert.equal(api.validateMaterialGraph(proceduralGraph, [painted]).ok, true);
assert.deepEqual(api.compileMaterialRecipe(proceduralGraph, [painted]).operations.map(operation => operation.type), ['color', 'dissolve', 'noise', 'output']);

const oldProject = fixture();
assert.equal(api.validateProject(oldProject).ok, true);
const store = new api.DocumentStore(oldProject);
store.addNode({id: 'shape', kind: 'mesh', parentId: null, assetIds: [], geometry: {kind: 'box', size: [1, 1, 1]}});
store.setTimelineFps(60);
store.setTimelineDuration(2);
store.upsertTrack(baseTrack);
store.upsertTexture(painted);
store.upsertMaterial(graph);
assert.equal(store.project.timeline.fps, 60);
assert.equal(store.project.timeline.duration, 2);
assert.equal(store.project.textures.length, 1);
assert.equal(store.project.materials.length, 1);
assert.equal(store.undo(), true);
assert.deepEqual(store.project.materials, []);
assert.equal(api.validateProject(JSON.parse(JSON.stringify(store.project))).ok, true);
assert.equal(api.validateProject({...fixture(), textures: [null]}).ok, false);

// F3.2: explosão radial determinística (mesma função usada pelo preset e pela ferramenta da UI).
const radialTargets = [{id: 'a', origin: [0, 1, 0]}, {id: 'b', origin: [1, 0, -1]}];
const radial = api.buildRadialTracks(radialTargets, {radius: 4, seed: 7, lift: .5, steps: [{time: 0, reach: 0}, {time: .9, reach: 1}]});
assert.equal(radial.length, 6, 'dois alvos geram três trilhas de posição cada');
assert.deepEqual(radial.map(track => track.id), ['track-a-position-x', 'track-a-position-y', 'track-a-position-z', 'track-b-position-x', 'track-b-position-y', 'track-b-position-z']);
const firstDirection = api.radialDirection(0, radialTargets.length, 7);
assert.deepEqual(radial[0].keyframes.map(frame => frame.value), [0, Number((firstDirection[0] * 4).toFixed(5))]);
radial.forEach(track => assert.equal(track.keyframes.length, 2));
assert.equal(JSON.stringify(api.buildRadialTracks(radialTargets, {radius: 4, seed: 7, lift: .5, steps: [{time: 0, reach: 0}, {time: .9, reach: 1}]})), JSON.stringify(radial), 'mesma semente devolve a mesma explosão');
assert.notEqual(JSON.stringify(api.buildRadialTracks(radialTargets, {radius: 4, seed: 8, lift: .5, steps: [{time: 0, reach: 0}, {time: .9, reach: 1}]})), JSON.stringify(radial), 'semente diferente muda as direções');
const direction = api.radialDirection(0, 8, 7);
assert.ok(Math.abs(Math.hypot(...direction) - 1) < 1e-9, 'direção radial é unitária');
assert.ok(direction[1] >= -1 && direction[1] <= 1, 'direção radial fica dentro da esfera');
assert.throws(() => api.buildRadialTracks(radialTargets, {radius: 0, seed: 7, steps: [{time: 0, reach: 0}]}), /Raio/);
assert.throws(() => api.buildRadialTracks(radialTargets, {radius: 4, seed: 7, steps: [{time: .1, reach: 0}]}), /t = 0/);
assert.throws(() => api.buildRadialTracks(radialTargets, {radius: 4, seed: 7, steps: [{time: 0, reach: 0}, {time: 0, reach: 1}]}), /crescentes/);
assert.throws(() => api.radialDirection(0, 8, -1), /Semente/);

console.log('✓ F2: timeline determinística, morph, textura RGBA, grafo material seguro e explosão radial.');
