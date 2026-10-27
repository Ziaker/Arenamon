import {PHASE_NAMES, type EffectBinding, type PhaseMap, type ValidationIssue, type ValidationResult, type VfxProject, type VfxRuntime} from './types';
import {parseVersion} from './version';
import {validateJsonData} from './json-safety';
import {validateContent} from './content';

const triggers = new Set(['cast', 'launch', 'spawn', 'hit', 'partial', 'perfect', 'perfectDodge', 'clash', 'miss', 'timeout', 'wall', 'ground', 'status', 'cancel']);
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const issue = (issues: ValidationIssue[], path: string, message: string) => issues.push({path, message});
const safeRelativePath = (value: string): boolean => {
  return value.length <= 240 && /^[A-Za-z0-9_.\/-]+$/.test(value) && !value.startsWith('/') && value.split('/').every(part => part && part !== '.' && part !== '..' && !part.endsWith('.') && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part));
};

function validatePhases(value: unknown, issues: ValidationIssue[], path = 'phases'): value is PhaseMap {
  if (!record(value)) { issue(issues, path, 'deve ser um objeto'); return false; }
  for (const name of PHASE_NAMES) {
    const phase = value[name];
    if (!record(phase)) { issue(issues, `${path}.${name}`, 'fase obrigatória ausente'); continue; }
    if (typeof phase.enabled !== 'boolean') issue(issues, `${path}.${name}.enabled`, 'deve ser booleano');
    if (!finite(phase.duration)) issue(issues, `${path}.${name}.duration`, 'deve ser um número finito');
    else if (phase.duration < 0 || phase.duration > 3600) issue(issues, `${path}.${name}.duration`, 'deve ficar entre 0 e 3600 segundos');
    if (!Array.isArray(phase.tracks)) issue(issues, `${path}.${name}.tracks`, 'deve ser uma lista');
  }
  return issues.length === 0;
}

export function validateProject(value: unknown): ValidationResult<VfxProject> {
  const issues: ValidationIssue[] = [];
  const unsafe = validateJsonData(value);
  if (unsafe.length) return {ok: false, issues: unsafe};
  if (!record(value)) return {ok: false, issues: [{path: '$', message: 'projeto deve ser um objeto'}]};
  if (value.schema !== 'arenamon.vfx-project') issue(issues, 'schema', 'schema inválido');
  if (value.schemaVersion !== 1) issue(issues, 'schemaVersion', value.schemaVersion === undefined ? 'campo obrigatório' : 'versão futura ou incompatível');
  for (const key of ['projectId', 'effectId'] as const) if (!text(value[key])) issue(issues, key, 'texto obrigatório');
  if (!Number.isSafeInteger(value.revision) || Number(value.revision) < 1) issue(issues, 'revision', 'inteiro positivo obrigatório');
  validatePhases(value.phases, issues);
  for (const key of ['nodes', 'assets', 'subeffects', 'pinnedComponents'] as const) if (!Array.isArray(value[key])) issue(issues, key, 'deve ser uma lista');
  if (Array.isArray(value.assets)) value.assets.forEach((asset, index) => {
    if (!record(asset) || !text(asset.assetId) || !text(asset.uri) || !safeRelativePath(String(asset.uri))) issue(issues, `assets.${index}`, 'assetId e caminho relativo seguro são obrigatórios');
  });
  if (!record(value.timeline) || typeof value.timeline.fps !== 'number' || ![24, 30, 60].includes(value.timeline.fps) || !Array.isArray(value.timeline.tracks)) issue(issues, 'timeline', 'fps deve ser 24, 30 ou 60 e tracks deve ser lista');
  if (!record(value.qualityProfiles)) issue(issues, 'qualityProfiles', 'deve ser um objeto');
  if (!record(value.accessibility) || typeof value.accessibility.noFlash !== 'boolean' || typeof value.accessibility.reduceMotion !== 'boolean') issue(issues, 'accessibility', 'noFlash e reduceMotion são obrigatórios');
  if (Array.isArray(value.pinnedComponents)) value.pinnedComponents.forEach((component, index) => {
    if (!record(component) || !text(component.componentId) || !text(component.version) || !parseVersion(String(component.version))) issue(issues, `pinnedComponents.${index}`, 'componentId e versão fixa semântica são obrigatórios');
  });
  issues.push(...validateContent(value));
  return issues.length ? {ok: false, issues} : {ok: true, value: value as unknown as VfxProject, issues: []};
}

export function validateRuntime(value: unknown): ValidationResult<VfxRuntime> {
  const issues: ValidationIssue[] = [];
  const unsafe = validateJsonData(value);
  if (unsafe.length) return {ok: false, issues: unsafe};
  if (!record(value)) return {ok: false, issues: [{path: '$', message: 'runtime deve ser um objeto'}]};
  if (value.schema !== 'arenamon.vfx-runtime') issue(issues, 'schema', 'schema inválido');
  if (value.schemaVersion !== 1) issue(issues, 'schemaVersion', 'versão futura ou incompatível');
  if (!text(value.effectId)) issue(issues, 'effectId', 'texto obrigatório');
  if (!text(value.version) || !parseVersion(String(value.version))) issue(issues, 'version', 'versão semântica fixa obrigatória');
  validatePhases(value.phases, issues);
  if (!record(value.budget) || ['particles', 'lights', 'drawCalls'].some(key => !Number.isSafeInteger((value.budget as Record<string, unknown>)[key]) || Number((value.budget as Record<string, unknown>)[key]) < 0)) issue(issues, 'budget', 'custos inteiros não negativos são obrigatórios');
  // O runtime F0 contém somente envelopes de fase. Tracks compiladas exigem o schema do compilador F4.
  if (record(value.phases)) for (const name of PHASE_NAMES) {
    const phase = value.phases[name];
    if (record(phase) && Array.isArray(phase.tracks) && phase.tracks.length) issue(issues, `phases.${name}.tracks`, 'Runtime F0 não executa tracks; compilador F4 necessário');
  }
  return issues.length ? {ok: false, issues} : {ok: true, value: value as unknown as VfxRuntime, issues: []};
}

export function validateEffectBinding(value: unknown): ValidationResult<EffectBinding> {
  const issues: ValidationIssue[] = [];
  const unsafe = validateJsonData(value);
  if (unsafe.length) return {ok: false, issues: unsafe};
  if (!record(value)) return {ok: false, issues: [{path: '$', message: 'binding deve ser um objeto'}]};
  for (const key of ['moveId', 'effectId', 'anchor'] as const) if (!text(value[key])) issue(issues, key, 'texto obrigatório');
  if (typeof value.anchor === 'string' && !['contact', 'attacker', 'target', 'center', 'ground', 'surface'].includes(value.anchor) && !/^socket:[A-Za-z0-9_.-]{1,128}$/.test(value.anchor)) issue(issues, 'anchor', 'Âncora inválida');
  if (!text(value.trigger) || !triggers.has(value.trigger)) issue(issues, 'trigger', 'trigger não suportado');
  if (!text(value.version) || !parseVersion(String(value.version))) issue(issues, 'version', 'versão fixa semântica obrigatória');
  if (!record(value.offsets) || !finite(value.offsets.x) || !finite(value.offsets.y) || !finite(value.offsets.z)) issue(issues, 'offsets', 'x, y e z finitos são obrigatórios');
  return issues.length ? {ok: false, issues} : {ok: true, value: value as unknown as EffectBinding, issues: []};
}
