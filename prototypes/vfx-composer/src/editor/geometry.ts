import type {PathGeometry, Vec3} from '../core/types';

export interface PathOptions {width: number; extrusion?: number; closed?: boolean; snap?: number}

const finitePoint = (point: unknown): point is Vec3 => Array.isArray(point) && point.length === 3 && point.every(value => typeof value === 'number' && Number.isFinite(value));

export function createPathGeometry(kind: PathGeometry['kind'], input: unknown, options: PathOptions): PathGeometry {
  if (!['stroke', 'curve', 'ribbon'].includes(kind)) throw new Error('Tipo de caminho inválido');
  if (!Array.isArray(input) || input.length < 2) throw new Error('Geometria degenerada: ao menos dois pontos são obrigatórios');
  if (input.length > 4096) throw new Error('Limite de 4096 pontos excedido');
  if (!input.every(finitePoint)) throw new Error('Cada ponto deve ser um vetor 3D finito');
  if (!Number.isFinite(options.width) || options.width <= 0 || options.width > 100) throw new Error('Largura deve ser finita entre 0 e 100 m');
  if (options.extrusion !== undefined && (!Number.isFinite(options.extrusion) || options.extrusion <= 0 || options.extrusion > 100)) throw new Error('Extrusão deve ser finita entre 0 e 100 m');
  if (kind !== 'ribbon' && options.extrusion !== undefined) throw new Error('Extrusão é exclusiva de Ribbon');
  if (options.snap !== undefined && (!Number.isFinite(options.snap) || options.snap <= 0 || options.snap > 100)) throw new Error('Snap deve ser finito entre 0 e 100 m');
  const snap = options.snap;
  const points = input.map(point => point.map(value => snap ? Math.round(value / snap) * snap : value) as Vec3);
  const unique = new Set(points.map(point => point.join(',')));
  if (unique.size < 2 || (options.closed && unique.size < 3)) throw new Error('Geometria degenerada após snapping');
  return {kind, points, width: options.width, ...(kind === 'ribbon' ? {extrusion: options.extrusion ?? options.width * .15} : {}), closed: options.closed ?? false};
}
