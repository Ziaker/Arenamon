import type {AuthoringSettings, PathGeometry, Vec3} from '../core/types';

export interface PathOptions {width: number; endWidth?: number; extrusion?: number; closed?: boolean; snap?: number}
export type AssistedPathOptions = AuthoringSettings['drawingPlane'] & Pick<AuthoringSettings, 'mirrorX' | 'radialCopies'>;

const finitePoint = (point: unknown): point is Vec3 => Array.isArray(point) && point.length === 3 && point.every(value => typeof value === 'number' && Number.isFinite(value));

export function createPathGeometry(kind: PathGeometry['kind'], input: unknown, options: PathOptions): PathGeometry {
  if (!['stroke', 'curve', 'ribbon'].includes(kind)) throw new Error('Tipo de caminho inválido');
  if (!Array.isArray(input) || input.length < 2) throw new Error('Geometria degenerada: ao menos dois pontos são obrigatórios');
  if (input.length > 4096) throw new Error('Limite de 4096 pontos excedido');
  if (!input.every(finitePoint)) throw new Error('Cada ponto deve ser um vetor 3D finito');
  if (!Number.isFinite(options.width) || options.width <= 0 || options.width > 100) throw new Error('Largura deve ser finita entre 0 e 100 m');
  if (options.endWidth !== undefined && (!Number.isFinite(options.endWidth) || options.endWidth <= 0 || options.endWidth > 100)) throw new Error('Largura final deve ser finita entre 0 e 100 m');
  if (options.extrusion !== undefined && (!Number.isFinite(options.extrusion) || options.extrusion <= 0 || options.extrusion > 100)) throw new Error('Extrusão deve ser finita entre 0 e 100 m');
  if (kind !== 'ribbon' && options.extrusion !== undefined) throw new Error('Extrusão é exclusiva de Ribbon');
  if (kind !== 'ribbon' && options.endWidth !== undefined) throw new Error('Largura final é exclusiva de Ribbon');
  if (options.snap !== undefined && (!Number.isFinite(options.snap) || options.snap <= 0 || options.snap > 100)) throw new Error('Snap deve ser finito entre 0 e 100 m');
  const snap = options.snap;
  const points = input.map(point => point.map(value => snap ? Math.round(value / snap) * snap : value) as Vec3);
  const unique = new Set(points.map(point => point.join(',')));
  if (unique.size < 2 || (options.closed && unique.size < 3)) throw new Error('Geometria degenerada após snapping');
  return {kind, points, width: options.width, ...(kind === 'ribbon' ? {endWidth: options.endWidth ?? options.width, extrusion: options.extrusion ?? options.width * .15} : {}), closed: options.closed ?? false};
}

const rotateX = ([x, y, z]: Vec3, angle: number): Vec3 => [x, y * Math.cos(angle) - z * Math.sin(angle), y * Math.sin(angle) + z * Math.cos(angle)];
const rotateY = ([x, y, z]: Vec3, angle: number): Vec3 => [x * Math.cos(angle) + z * Math.sin(angle), y, -x * Math.sin(angle) + z * Math.cos(angle)];
const rotateZ = ([x, y, z]: Vec3, angle: number): Vec3 => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle), z];
const rotate = (point: Vec3, rotation: Vec3): Vec3 => rotateZ(rotateY(rotateX(point, rotation[0]), rotation[1]), rotation[2]);
const inverseRotate = (point: Vec3, rotation: Vec3): Vec3 => rotateX(rotateY(rotateZ(point, -rotation[2]), -rotation[1]), -rotation[0]);
const clean = (value: number): number => Math.abs(value) < 1e-12 ? 0 : value;

export function createAssistedPaths(input: unknown, options: AssistedPathOptions): Vec3[][] {
  if (!Array.isArray(input) || input.length < 2 || !input.every(finitePoint)) throw new Error('Caminho assistido exige ao menos dois pontos finitos');
  if (!finitePoint(options.origin) || !finitePoint(options.rotation)) throw new Error('Origem e rotação devem ser finitas');
  if (!Number.isSafeInteger(options.radialCopies) || options.radialCopies < 1 || options.radialCopies > 12) throw new Error('Repetição radial deve ficar entre 1 e 12');
  const local = input.map(point => inverseRotate(point.map((value, axis) => value - options.origin[axis]) as Vec3, options.rotation));
  const variants: Vec3[][] = [];
  for (let copy = 0; copy < options.radialCopies; copy++) {
    const angle = copy * Math.PI * 2 / options.radialCopies;
    variants.push(local.map(point => rotateY(point, angle)));
    if (options.mirrorX) variants.push(local.map(point => rotateY([-point[0], point[1], point[2]], angle)));
  }
  return variants.map(points => points.map(point => rotate(point, options.rotation).map((value, axis) => clean(value + options.origin[axis])) as Vec3));
}
