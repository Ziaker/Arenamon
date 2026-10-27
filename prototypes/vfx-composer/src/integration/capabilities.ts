import type {ComposerTrigger} from '../core/types';
export interface EventCapability {status: 'available' | 'derivable-with-proof' | 'unsupported'; source: string; evidence: string}
const combat = (evidence: string): Readonly<EventCapability> => Object.freeze({status: 'available', source: 'prototypes/combat-lab/src/sim/combat.js', evidence});
const unsupported = (): Readonly<EventCapability> => Object.freeze({status: 'unsupported', source: '', evidence: 'Sem adaptador auditado nesta versão; não sintetizar evento'});
export const CAPABILITY_VERSION = 1;
// Disponibilidade por leitura dos produtores. Não representa integração F4 testada.
export const EVENT_CAPABILITIES: Readonly<Record<ComposerTrigger, Readonly<EventCapability>>> = Object.freeze({
  hit: combat('resolveHit retorna impact'), partial: combat('resolveHit retorna partial'),
  perfect: combat('resolveHit retorna perfect'), perfectDodge: combat('resolveHit retorna perfectDodge'),
  clash: combat('clash produz eventos direcionais'),
  status: Object.freeze({status: 'available', source: 'prototypes/combat-lab/src/sim/game.js', evidence: 'applyStatus emite statusApplied'}),
  cast: unsupported(), launch: unsupported(), spawn: unsupported(), miss: unsupported(),
  timeout: unsupported(), wall: unsupported(), ground: unsupported(), cancel: unsupported(),
});

export interface CapabilitySources {combat: string; game: string}
export interface CapabilityAuditIssue {trigger: ComposerTrigger; message: string}

const CONTACT_RESULT = /result:\s*perfect\s*\?\s*['"]perfect['"]\s*:\s*protectedFront\s*\?\s*['"]partial['"]\s*:\s*['"]impact['"]/;
const PRODUCER_PROOFS: ReadonlyArray<Readonly<{trigger: ComposerTrigger; source: keyof CapabilitySources; pattern: RegExp}>> = Object.freeze([
  Object.freeze({trigger: 'hit', source: 'combat', pattern: CONTACT_RESULT}),
  Object.freeze({trigger: 'partial', source: 'combat', pattern: CONTACT_RESULT}),
  Object.freeze({trigger: 'perfect', source: 'combat', pattern: CONTACT_RESULT}),
  Object.freeze({trigger: 'perfectDodge', source: 'combat', pattern: /result:\s*['"]perfectDodge['"]\s*[,}]/}),
  Object.freeze({trigger: 'clash', source: 'combat', pattern: /result:\s*['"]clash['"]\s*[,}]/}),
  Object.freeze({trigger: 'status', source: 'game', pattern: /result:\s*['"]statusApplied['"]\s*[,}]/}),
]);

/** Auditoria estática F0. Recebe texto-fonte; não importa nem executa a simulação. */
export function auditEventCapabilities(sources: CapabilitySources): CapabilityAuditIssue[] {
  return PRODUCER_PROOFS
    .filter(proof => !proof.pattern.test(sources[proof.source]))
    .map(proof => ({trigger: proof.trigger, message: `Produtor explícito não encontrado em ${proof.source}`}));
}
