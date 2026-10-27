import type {ValidationIssue} from './types';

// Limites de entrada do contrato, independentes de desempenho de GPU.
export const JSON_LIMITS = Object.freeze({depth: 32, entries: 100000, stringLength: 1048576, bytes: 8388608});
const forbidden = new Set(['__proto__', 'constructor', 'prototype', 'code', 'script', 'eval', 'shaderSource', 'glsl']);

export function validateJsonData(input: unknown): ValidationIssue[] {
  const ancestors = new Set<object>();
  let entries = 0;
  const visit = (value: unknown, path: string, depth: number): ValidationIssue | null => {
    if (++entries > JSON_LIMITS.entries || depth > JSON_LIMITS.depth) return {path, message: 'Limite de tamanho ou profundidade excedido'};
    if (value === null || typeof value === 'boolean') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? null : {path, message: 'Número deve ser finito'};
    if (typeof value === 'string') return value.length <= JSON_LIMITS.stringLength ? null : {path, message: 'Texto excede limite'};
    if (typeof value !== 'object') return {path, message: 'Somente dados JSON são permitidos'};
    if (ancestors.has(value)) return {path, message: 'Ciclo não permitido'};
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return {path, message: 'Objeto deve conter somente dados simples'};
    ancestors.add(value);
    for (const key of Reflect.ownKeys(value)) {
      if (Array.isArray(value) && key === 'length') continue;
      if (typeof key !== 'string' || forbidden.has(key)) return {path, message: 'Campo executável ou perigoso rejeitado'};
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!('value' in descriptor) || !descriptor.enumerable) return {path, message: 'Accessors e campos ocultos não são permitidos'};
      const error = visit(descriptor.value, `${path}.${key}`, depth + 1);
      if (error) return error;
    }
    ancestors.delete(value);
    return null;
  };
  const error = visit(input, '$', 0);
  return error ? [error] : [];
}
