// Tipos compartilhados da simulação (apenas declarações: nenhum código de execução; o esbuild não os inclui no HTML).
// Uso em JSDoc: /** @param {import('./types').StatusDef} def */   (ou, em arquivos @ts-check, os typedefs locais abaixo).
// Progressivo: campos ainda não verificados ficam opcionais ou `any`; apertar conforme os arquivos entram em @ts-check.

export interface Vec {x: number; z: number}

/** Descrição de um status ao aplicá-lo (status.js). */
export interface StatusDef {
  id: string; duration: number; stacking?: 'refresh' | 'stack' | 'independent' | 'ignore'; maxStacks?: number;
  mul?: Record<string, number>; add?: Record<string, number>; flags?: Record<string, boolean>;
  tick?: {interval: number; damage?: number; heal?: number; stamina?: number}; tags?: string[];
}
/** Instância ativa dentro de `fighter.statuses`. */
export interface StatusInstance {
  id: string; source: number | null; duration: number; remaining: number; stacks: number; maxStacks: number; stacking: string;
  mul: Record<string, number>; add: Record<string, number>; flags: Record<string, boolean>;
  tick: {interval: number; damage?: number; heal?: number; stamina?: number} | null; acc: number; tags: string[];
}
/** Efeito de um movimento disparado numa linha do tempo (moves.js). Exatamente um entre spawn, status e hit. */
export interface MoveTimelineEvent {at?: number; spawn?: any; status?: StatusDef; hit?: any; effect?: string; target?: 'self' | 'opponent'}
/** Movimento de carga (charge.js): `max` em segundos (padrão 4) e substituições dos valores compartilhados de `C.world.charge`. */
export interface ChargeDef {max?: number; min?: number; minCharge?: number; group?: string; moveSlow?: number; turnSlow?: number; dodgeCancelAfter?: number; interruptCooldownFactor?: number; recovery?: number; bufferWindow?: number; boostStaminaPerSecond?: number; boostStep?: number}
/** Definição de um movimento (moves.js; ver MOVIMENTOS.md). */
export interface MoveDef {
  id: string; name?: string; description?: string; type?: string; category?: 'physical' | 'special' | 'status';
  duration?: number; cost?: number; cooldown?: number; cancelAfter?: number; cancelFrom?: string[];
  fromGuard?: boolean; fromGuardStun?: boolean; invulnerable?: [number, number]; aim?: 'target' | 'facing' | 'input';
  motion?: {type: 'none' | 'root' | 'dash' | 'walk'; distanceKey?: string; distance?: number; start?: number; end?: number}; animation?: string;
  timeline?: MoveTimelineEvent[];
  charge?: ChargeDef; cooldownBoost?: boolean;
  /** Grupo de parâmetros em `C.world[group]` (sliders do Move). */ group?: string;
  /** Mira por marcador: 'marker' (fixo) ou 'follow' (segue o lutador). */ aimMode?: 'marker' | 'follow'; castFirst?: boolean; aimAirOk?: boolean;
  /** Move que vira ação de Tackle: nome da preparação registrada. */ tackle?: string;
  groundOnly?: boolean; feint?: boolean; riposte?: boolean; keepFacing?: boolean; fromDodge?: boolean; cooldownOnStart?: boolean; needsTarget?: string;
  /** Uso no ar (sim/air.js): 'cast' o corpo segue em voo; 'descend' desce e age; 'none' (padrão) sem uso no ar. */ air?: 'none' | 'cast' | 'descend';
  durationKeys?: string[]; invulnerableKeys?: string[];
}
