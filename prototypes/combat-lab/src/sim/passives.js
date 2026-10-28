// @ts-check
// Sistema de habilidades passivas (CATÁLOGO EXPERIMENTAL — não homologado, ordem de implementação 2026-10-20).
// 2 exclusivas por personagem + catálogo genérico; máximo de 2 equipadas; sem duplicata (UI e motor, R1–R6).
// Identidade de espécie explícita (R15): nunca inferida só pelo modelo/GLB.
//
// Cada entrada descreve: id, nome, espécie (null = genérica), categoria, gatilho, efeito em texto,
// parâmetros experimentais (chaves em C.passivas, ajustáveis pelo painel de balanceamento, §29) e as
// rodadas de origem. A resolução em si vive em passive-engine.js.

/** Espécies com passivas exclusivas (identidade explícita, R15). "mush" é o cogumelo autoral do projeto. */
export const PASSIVE_SPECIES = ['croagunk', 'drowzee', 'mush', 'vigoroth'];

/**
 * Normaliza um nome de personagem/modelo para a espécie de passiva (R15). Sem correspondência → null
 * (só genéricas). Aceita os apelidos usados no projeto sem renomear nada (ex.: "Mosh" → mush).
 * @param {string} [name]
 * @returns {string | null}
 */
export function speciesFromName(name) {
  if (!name || typeof name !== 'string') return null;
  const n = name.toLowerCase();
  if (n.includes('croagunk')) return 'croagunk';
  if (n.includes('drowzee')) return 'drowzee';
  if (n.includes('vigoroth')) return 'vigoroth';
  if (n.includes('mosh') || n.includes('mush') || n.includes('mushroom') || n.includes('cogumelo')) return 'mush';
  if (n.includes('wookada')) return 'wookada';
  return null;
}

/**
 * Catálogo experimental das 18 passivas. `cooldownMode`: 'postEnd' (R16: cooldown começa no TÉRMINO do efeito),
 * 'instant' (R18: efeito instantâneo, cooldown logo após a aplicação), null (sem cooldown).
 * @type {Array<{id: string, nome: string, species: string | null, categoria: 'permanente' | 'gatilho', cooldownMode: 'postEnd' | 'instant' | null, gatilho: string, efeito: string, rounds: string, params: string[]}>}
 */
export const PASSIVES = [
  // ---- Exclusivas: Croagunk ----
  {id: 'poison-touch', nome: 'Poison Touch', species: 'croagunk', categoria: 'gatilho', cooldownMode: 'postEnd',
    gatilho: 'Tackle com dano real ao HP do alvo (defesa perfeita impede; escudo e guarda parcial não).',
    efeito: 'Envenena: 2 HP/s por 3 s (dano periódico). Cooldown de 12 s começa no TÉRMINO do veneno.',
    rounds: 'R1, R16, R20', params: ['dps', 'duration', 'cooldown']},
  {id: 'anticipation', nome: 'Anticipation', species: 'croagunk', categoria: 'gatilho', cooldownMode: 'postEnd',
    gatilho: 'Oponente a até detectDistance preparando tackle carregado (PL2/PL3).',
    efeito: '+15% de velocidade e esquiva por 2 s. Cooldown de 12 s pós-término. Gatilhos da mesma passiva durante o efeito são ignorados (R20).',
    rounds: 'R2, R16, R20', params: ['speedPct', 'duration', 'cooldown', 'detectDistance']},
  // ---- Exclusivas: Drowzee ----
  {id: 'forewarn', nome: 'Forewarn', species: 'drowzee', categoria: 'gatilho', cooldownMode: 'postEnd',
    gatilho: 'Oponente carregando um Move (Charge em andamento, PL2/PL3) dentro do alcance de detecção.',
    efeito: '+0,06 s na janela de defesa perfeita contra esse Move carregado; o efeito dura no máximo 4 s. Cooldown de 12 s pós-término.',
    rounds: 'R3, R16, R20', params: ['windowBonus', 'maxDuration', 'cooldown', 'detectDistance']},
  {id: 'inner-focus', nome: 'Inner Focus', species: 'drowzee', categoria: 'permanente', cooldownMode: null,
    gatilho: 'Permanente (sem gatilho nem cooldown).',
    efeito: '−20% de hit stun (recuperação de pouso após ser lançado por um golpe).',
    rounds: 'R4', params: ['stunPct']},
  // ---- Exclusivas: Mush (cogumelo autoral; "Mosh" dos docs é o mesmo personagem, sem rename) ----
  {id: 'effect-spore', nome: 'Effect Spore', species: 'mush', categoria: 'gatilho', cooldownMode: 'postEnd',
    gatilho: 'Receber acerto de contato físico (tackle corpo a corpo).',
    efeito: 'O agressor sofre −15% de velocidade por 3 s. Cooldown de 12 s pós-término.',
    rounds: 'R5, R16, R20', params: ['slowPct', 'duration', 'cooldown']},
  {id: 'sturdy', nome: 'Sturdy', species: 'mush', categoria: 'gatilho', cooldownMode: null,
    gatilho: 'Dano letal DIRETO a partir de ataque (com HP cheio ou não).',
    efeito: 'Uma vez por rodada: o HP fica exatamente em 1 em vez de zerar. Não protege de dano periódico (veneno/DOT), ambiental nem de escudo-genérico. Restaurado no início de cada rodada (§7).',
    rounds: 'R6, §7', params: []},
  // ---- Exclusivas: Vigoroth ----
  {id: 'vital-spirit', nome: 'Vital Spirit', species: 'vigoroth', categoria: 'permanente', cooldownMode: null,
    gatilho: 'Permanente, condicional: stamina abaixo de 30% do máximo.',
    efeito: '+30% de regeneração de stamina enquanto a condição vigorar.',
    rounds: 'R7', params: ['thresholdPct', 'regenPct']},
  {id: 'guts', nome: 'Guts', species: 'vigoroth', categoria: 'permanente', cooldownMode: null,
    gatilho: 'Permanente, condicional: sob status negativo válido (debuff aplicado pelo oponente).',
    efeito: '+15% de Ataque enquanto a condição vigorar.',
    rounds: 'R8', params: ['attackPct']},
  // ---- Genéricas (todas liberadas para qualquer personagem, R6) ----
  {id: 'speed-boost', nome: 'Speed Boost', species: null, categoria: 'permanente', cooldownMode: null,
    gatilho: 'Permanente (sem gatilho nem cooldown).',
    efeito: '+15% de velocidade de locomoção e dash, permanentemente.',
    rounds: 'R9', params: ['speedPct']},
  {id: 'technician', nome: 'Technician', species: null, categoria: 'permanente', cooldownMode: null,
    gatilho: 'Permanente (sem gatilho nem cooldown).',
    efeito: '−20% no custo de stamina de esquivas e de recovery de pouso (tech). Não é mais bônus de dano.',
    rounds: 'R10', params: ['costPct']},
  {id: 'rough-skin', nome: 'Rough Skin', species: null, categoria: 'gatilho', cooldownMode: 'instant',
    gatilho: 'Receber Tackle de contato físico (dano direto ao HP).',
    efeito: 'O agressor sofre 3 HP de dano de retorno. Cooldown de 10 s instantâneo (começa logo após a aplicação, R18).',
    rounds: 'R11, R18', params: ['reflectDamage', 'cooldown']},
  {id: 'regenerator', nome: 'Regenerator', species: null, categoria: 'gatilho', cooldownMode: 'instant',
    gatilho: '5 s completos sem causar nem receber dano ao HP.',
    efeito: 'Recupera 5 HP. Cooldown de 15 s instantâneo.',
    rounds: 'R12, R18', params: ['heal', 'quietTime', 'cooldown']},
  {id: 'unburden', nome: 'Unburden', species: null, categoria: 'gatilho', cooldownMode: 'postEnd',
    gatilho: 'Coletar um consumível do mapa (evento itemCollected).',
    efeito: '+15% de velocidade por 4 s. Cooldown de 14 s pós-término.',
    rounds: 'R13, R16', params: ['speedPct', 'duration', 'cooldown']},
  {id: 'stamina', nome: 'Stamina', species: null, categoria: 'gatilho', cooldownMode: 'postEnd',
    gatilho: 'Sofrer dano direto de um ataque.',
    efeito: '+10% de Defesa (dano recebido × 1/1,1) por 4 s. Cooldown de 10 s pós-término.',
    rounds: 'R14, R16, §pendência-mapeamento', params: ['defensePct', 'duration', 'cooldown']},
  {id: 'suction-cups', nome: 'Suction Cups', species: null, categoria: 'permanente', cooldownMode: null,
    gatilho: 'Permanente (sem gatilho nem cooldown).',
    efeito: '−20% de empurrão horizontal recebido enquanto apoiado no chão; não reduz vertical nem impede queda.',
    rounds: 'R15', params: ['knockbackPct']},
  {id: 'magic-guard', nome: 'Magic Guard', species: null, categoria: 'permanente', cooldownMode: null,
    gatilho: 'Permanente (sem gatilho nem cooldown).',
    efeito: '−50% de dano periódico (veneno/DOT). Não afeta dano direto.',
    rounds: 'R16', params: ['dotReductionPct']},
  {id: 'clear-body', nome: 'Clear Body', species: null, categoria: 'permanente', cooldownMode: null,
    gatilho: 'Permanente, reativo: habilidade adversária tenta reduzir Ataque/Defesa/Velocidade diretamente.',
    efeito: 'Impede a redução inimiga direta desses atributos.',
    rounds: 'R17', params: []},
  {id: 'defiant', nome: 'Defiant', species: null, categoria: 'gatilho', cooldownMode: 'postEnd',
    gatilho: 'Habilidade adversária reduz um atributo meu (mesmo caso bloqueado pelo Clear Body).',
    efeito: '+15% de Ataque por 4 s. Cooldown de 12 s pós-término.',
    rounds: 'R18, R16', params: ['attackPct', 'duration', 'cooldown']},
];

export const PASSIVE_BY_ID = Object.fromEntries(PASSIVES.map(p => [p.id, p]));
/** Máximo de passivas equipadas por lutador (R2). */
export const PASSIVE_SLOTS = 2;
/** Todas as passivas são experimentais até homologação (R8 do catálogo). */
export const PASSIVE_STATUS = 'experimental';

/** Genéricas disponíveis para qualquer espécie (R6). */
export const genericPassives = () => PASSIVES.filter(p => p.species === null);
/** Exclusivas de uma espécie (R1). */
export const exclusivePassives = species => PASSIVES.filter(p => p.species === species);

/**
 * Valida um loadout de passivas (regras R2–R6). Usado pela UI e replicado no motor (validação dupla).
 * @param {string[]} ids ids solicitados (sem duplicatas esperadas, mas verificadas)
 * @param {string | null} species espécie do lutador (speciesFromName)
 * @returns {string[]} lista de erros (vazia = válido)
 */
export function validateLoadout(ids, species) {
  const errors = [];
  if (!Array.isArray(ids)) return ['loadout inválido'];
  const clean = ids.filter(Boolean);
  if (clean.length > PASSIVE_SLOTS) errors.push(`máximo de ${PASSIVE_SLOTS} passivas equipadas (R2)`);
  if (new Set(clean).size !== clean.length) errors.push('duplicata no loadout (R5)');
  for (const id of clean) {
    const def = PASSIVE_BY_ID[id];
    if (!def) {errors.push(`passiva desconhecida: ${id}`);continue;}
    if (def.species && def.species !== species) errors.push(`${def.nome} é exclusiva de ${def.species} (R4)`);
  }
  return errors;
}
