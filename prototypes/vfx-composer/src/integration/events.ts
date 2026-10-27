export type ComposerEventType = 'cast' | 'launch' | 'spawn' | 'hit' | 'partial' | 'perfect' | 'perfectDodge' | 'clash' | 'miss' | 'timeout' | 'wall' | 'ground' | 'status' | 'cancel' | 'unsupported';

const eventMap: Readonly<Record<string, ComposerEventType>> = Object.freeze({
  cast: 'cast', launch: 'launch', spawn: 'spawn', impact: 'hit', hit: 'hit', partial: 'partial', perfect: 'perfect', perfectDodge: 'perfectDodge', clash: 'clash', miss: 'miss', timeout: 'timeout', wall: 'wall', ground: 'ground', statusApplied: 'status', status: 'status', cancel: 'cancel',
});

export function classifyComposerEvent(result: unknown): ComposerEventType {
  return typeof result === 'string' && Object.hasOwn(eventMap, result) ? eventMap[result] : 'unsupported';
}

export function selectOutcome(result: unknown): 'finish' | 'impact' | null {
  const event = classifyComposerEvent(result);
  if (['hit', 'partial', 'perfect', 'clash', 'wall', 'ground'].includes(event)) return 'impact';
  return event === 'miss' || event === 'timeout' ? 'finish' : null;
}
