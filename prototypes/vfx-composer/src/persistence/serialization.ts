import type {ValidationResult, VfxProject} from '../core/types';
import {validateProject} from '../core/validation';
import {migrateProject} from './migrations';
import {JSON_LIMITS} from '../core/json-safety';

const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor', 'code', 'script', 'eval']);

function safeParse(text: string): unknown {
  if (text.length > JSON_LIMITS.bytes / 2) throw new Error('Projeto excede limite de tamanho');
  return JSON.parse(text, (key, value: unknown) => {
    if (forbiddenKeys.has(key)) throw new Error(`Campo executável ou perigoso rejeitado: ${key}`);
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Número não finito rejeitado');
    return value;
  });
}

export function serializeProject(project: VfxProject): string {
  const result = validateProject(project);
  if (!result.ok) throw new Error(result.issues.map(item => `${item.path}: ${item.message}`).join('; '));
  const text = JSON.stringify(project);
  if (text.length > JSON_LIMITS.bytes / 2) throw new Error('Projeto excede limite de tamanho');
  return text;
}

export function deserializeProject(text: string): ValidationResult<VfxProject> {
  try {
    const migrated = migrateProject(safeParse(text));
    if (!migrated) return {ok: false, issues: [{path: 'schemaVersion', message: 'versão futura ou incompatível'}]};
    return validateProject(migrated);
  } catch (error) {
    return {ok: false, issues: [{path: '$', message: error instanceof Error ? error.message : 'JSON inválido'}]};
  }
}
