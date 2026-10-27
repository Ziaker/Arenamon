import type {MaterialGraph, MaterialNode, TextureDocument, ValidationIssue} from '../core/types';

type Recipe = {color: string; emissive: string; metalness: number; opacity: number; roughness: number; transparent: boolean; operations: {id: string; type: string; params: Record<string, string | number>; inputs: Record<string, string>}[]};
type ParamRule = 'color' | 'unit' | 'positive' | 'texture';
const specs: Record<string, {inputs: string[]; outputs: string[]; params: Record<string, ParamRule>}> = {
  color: {inputs: [], outputs: ['color'], params: {color: 'color'}}, texture: {inputs: [], outputs: ['color', 'alpha'], params: {textureId: 'texture'}}, gradient: {inputs: [], outputs: ['color'], params: {startColor: 'color', endColor: 'color'}},
  noise: {inputs: [], outputs: ['value'], params: {scale: 'positive'}}, fresnel: {inputs: [], outputs: ['value'], params: {power: 'positive'}}, dissolve: {inputs: ['source', 'mask'], outputs: ['color', 'alpha'], params: {threshold: 'unit', edgeWidth: 'unit', edgeColor: 'color'}},
  multiply: {inputs: ['a', 'b'], outputs: ['color'], params: {}}, output: {inputs: ['color', 'alpha', 'emissive'], outputs: [], params: {roughness: 'unit', metalness: 'unit', opacity: 'unit', emissive: 'color'}},
};
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const validParam = (rule: ParamRule, value: unknown, textures: TextureDocument[]): boolean => rule === 'color' ? typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) : rule === 'texture' ? typeof value === 'string' && textures.some(texture => texture.id === value) : typeof value === 'number' && Number.isFinite(value) && (rule === 'unit' ? value >= 0 && value <= 1 : value > 0 && value <= 1000);
const portType = (nodeType: string, port: string, output: boolean): 'color' | 'value' | null => {if (output) {if (port === 'color') return 'color'; if (port === 'alpha' || port === 'value') return 'value'; return null;} if (nodeType === 'dissolve') return port === 'source' ? 'color' : port === 'mask' ? 'value' : null; if (nodeType === 'multiply') return port === 'a' ? 'color' : port === 'b' ? 'value' : null; if (nodeType === 'output') return port === 'color' || port === 'emissive' ? 'color' : port === 'alpha' ? 'value' : null; return null;};
const color = (value: unknown, fallback: string): string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
const number = (value: unknown, fallback: number, min = 0, max = 1): number => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function validateMaterialGraph(value: unknown, textures: TextureDocument[] = []): {ok: true; issues: []} | {ok: false; issues: ValidationIssue[]} {
  const issues: ValidationIssue[] = [], fail = (path: string, message: string) => issues.push({path, message});
  if (!object(value) || !Array.isArray(value.nodes) || !Array.isArray(value.connections) || typeof value.outputNodeId !== 'string') return {ok: false, issues: [{path: '$', message: 'Estrutura de grafo inválida'}]};
  const graph = value as unknown as MaterialGraph;
  if (graph.nodes.length < 1 || graph.nodes.length > 64) fail('nodes', 'Grafo exige 1–64 nós');
  const byId = new Map<string, MaterialNode>();
  for (const [i, node] of graph.nodes.entries()) {
    if (!object(node) || typeof node.id !== 'string' || !object(node.params)) {fail(`nodes.${i}`, 'Nó inválido'); continue;}
    if (byId.has(node.id)) fail(`nodes.${i}.id`, 'ID duplicado'); else byId.set(node.id, node);
    const spec = specs[node.type]; if (!spec) {fail(`nodes.${i}.type`, 'Tipo de nó não permitido'); continue;}
    for (const key of Object.keys(node.params)) if (!spec.params[key]) fail(`nodes.${i}.params.${key}`, 'Parâmetro não permitido'); else if (!validParam(spec.params[key], node.params[key], textures)) fail(`nodes.${i}.params.${key}`, 'Valor de parâmetro inválido');
  }
  const outputs = graph.nodes.filter(node => object(node) && node.type === 'output');
  if (outputs.length !== 1 || outputs[0]?.id !== graph.outputNodeId) fail('outputNodeId', 'Grafo exige uma única saída declarada');
  const incoming = new Set<string>(), edges = new Map<string, string[]>();
  if (graph.connections.length > 256) fail('connections', 'Limite de 256 conexões excedido');
  for (const [i, connection] of graph.connections.entries()) {
    if (!object(connection)) {fail(`connections.${i}`, 'Conexão inválida'); continue;}
    const from = byId.get(connection.fromNodeId), to = byId.get(connection.toNodeId), path = `connections.${i}`;
    if (!from || !to) {fail(path, 'Referência de nó ausente'); continue;}
    if (!specs[from.type]?.outputs.includes(connection.fromPort) || !specs[to.type]?.inputs.includes(connection.toPort) || portType(from.type, connection.fromPort, true) !== portType(to.type, connection.toPort, false)) fail(path, 'Porta incompatível');
    const input = `${to.id}:${connection.toPort}`; if (incoming.has(input)) fail(path, 'Entrada aceita uma única conexão'); incoming.add(input);
    edges.set(from.id, [...(edges.get(from.id) ?? []), to.id]);
  }
  const state = new Map<string, number>(); let cyclic = false;
  const detectCycle = (id: string): void => {if (state.get(id) === 1) {cyclic = true; return;} if (state.get(id) === 2) return; state.set(id, 1); for (const next of edges.get(id) ?? []) detectCycle(next); state.set(id, 2);};
  for (const id of byId.keys()) detectCycle(id); if (cyclic) fail('connections', 'Ciclo no grafo');
  if (!cyclic) {const memo = new Map<string, number>(); const depth = (id: string): number => {const known = memo.get(id); if (known) return known; const result = 1 + Math.max(0, ...(edges.get(id) ?? []).map(depth)); memo.set(id, result); return result;}; for (const id of byId.keys()) if (depth(id) > 16) fail(`nodes.${id}`, 'Profundidade máxima excedida');}
  const reachesOutput = (start: string, seen = new Set<string>()): boolean => start === graph.outputNodeId || (!seen.has(start) && (seen.add(start), (edges.get(start) ?? []).some(next => reachesOutput(next, seen))));
  for (const id of byId.keys()) if (!reachesOutput(id)) fail(`nodes.${id}`, 'Nó órfão não contribui para a saída');
  return issues.length ? {ok: false, issues} : {ok: true, issues: []};
}

export function compileMaterialRecipe(graph: MaterialGraph, textures: TextureDocument[] = []): Recipe {
  const checked = validateMaterialGraph(graph, textures); if (!checked.ok) throw new Error(`Grafo material inválido: ${checked.issues[0].message}`);
  const output = graph.nodes.find(node => node.id === graph.outputNodeId)!;
  const colorConnection = graph.connections.find(connection => connection.toNodeId === output.id && connection.toPort === 'color');
  const source = graph.nodes.find(node => node.id === colorConnection?.fromNodeId);
  const resolveColor = (node: MaterialNode | undefined, seen = new Set<string>()): string => {if (!node || seen.has(node.id)) return '#ffffff'; seen.add(node.id); if (node.type === 'color') return color(node.params.color, '#ffffff'); if (node.type === 'gradient') return color(node.params.startColor, '#ffffff'); if (node.type === 'dissolve') {const link = graph.connections.find(connection => connection.toNodeId === node.id && connection.toPort === 'source'); return resolveColor(graph.nodes.find(candidate => candidate.id === link?.fromNodeId), seen);} if (node.type === 'multiply') {const link = graph.connections.find(connection => connection.toNodeId === node.id && connection.toPort === 'a'); return resolveColor(graph.nodes.find(candidate => candidate.id === link?.fromNodeId), seen);} return '#ffffff';};
  const outputColor = resolveColor(source);
  const opacity = number(output.params.opacity, 1);
  const operations = [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id)).map(node => ({id: node.id, type: node.type, params: Object.fromEntries(Object.entries(node.params).sort(([a], [b]) => a.localeCompare(b))), inputs: Object.fromEntries(graph.connections.filter(connection => connection.toNodeId === node.id).sort((a, b) => a.toPort.localeCompare(b.toPort)).map(connection => [connection.toPort, `${connection.fromNodeId}.${connection.fromPort}`]))}));
  return {color: outputColor, emissive: color(output.params.emissive, '#000000'), metalness: number(output.params.metalness, 0), opacity, roughness: number(output.params.roughness, .35), transparent: opacity < 1, operations};
}
