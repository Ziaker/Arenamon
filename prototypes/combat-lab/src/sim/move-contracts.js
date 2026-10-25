// @ts-check
// Validador de contratos dos Moves (#08 do plano de 15 melhorias): lê o registro e a configuração VIVOS e devolve uma lista de problemas por
// Move / campo, sem corrigir nada. Puro (recebe tudo por parâmetro): serve ao teste, à CI e a qualquer painel futuro.
// Severidade: 'error' = quebra um contrato (o Move não funciona ou o controle mente); 'warn' = divergência que merece decisão do responsável.
//
// Contratos verificados, por Move registrado:
//   1. a definição passa em validateMove (campos, timeline, charge, aim…);
//   2. `def.group` existe em C.world e toda chave numérica do grupo tem controle (linha do painel) — nenhum parâmetro sem slider;
//   3. toda linha do painel aponta para uma chave que existe, com valor padrão DENTRO de min..max do slider (senão o controle não representa o padrão);
//   4. todo efeito citado na timeline e toda preparação de tackle estão registrados;
//   5. custo/recarga/duração da definição e do grupo coincidem (o grupo vence em jogo; diferença = documentação enganosa).

/**
 * @typedef {{id: string, field: string, severity: 'error' | 'warn', message: string}} ContractIssue
 * @typedef {[string, string, string, string, number, number, number, Function, boolean?]} ParamRowTuple linha do painel: [grupo, chave, rótulo, dica, min, max, passo, formato, aprovado]
 */

/**
 * @param {{moves: any[], world: Record<string, any>, rows: ParamRowTuple[], hasEffect: (name: string) => boolean, hasTackleSetup: (name: string) => boolean, validateMove?: (def: any) => boolean}} env
 * @returns {ContractIssue[]}
 */
export function checkMoveContracts(env) {
  /** @type {ContractIssue[]} */ const issues = [];
  const add = (/** @type {string} */ id, /** @type {string} */ field, /** @type {'error' | 'warn'} */ severity, /** @type {string} */ message) => issues.push({id, field, severity, message});
  const rowsByGroup = new Map();
  for (const r of env.rows) {if (!rowsByGroup.has(r[0])) rowsByGroup.set(r[0], new Map());rowsByGroup.get(r[0]).set(r[1], r);}
  const groupsOfMoves = new Set(env.moves.map(m => m.group).filter(Boolean));

  for (const def of env.moves) {
    const id = def.id;
    if (env.validateMove) try {env.validateMove(def);} catch (e) {add(id, 'definição', 'error', /** @type {Error} */ (e).message);}
    const g = def.group ? env.world[def.group] : null;
    if (def.group && !g) {add(id, 'group', 'error', `grupo "${def.group}" não existe em C.world`);continue;}
    if (g) {
      const rows = rowsByGroup.get(def.group) ?? new Map();
      for (const [key, value] of Object.entries(g)) {
        if (typeof value !== 'number') continue;
        const row = rows.get(key);
        if (!row) add(id, `${def.group}.${key}`, 'error', 'parâmetro sem controle na aba Moves');
        else if (value < row[4] - 1e-9 || value > row[5] + 1e-9) add(id, `${def.group}.${key}`, 'warn', `padrão ${value} fora do slider ${row[4]}..${row[5]} (o controle não consegue representar o valor)`);
      }
      for (const key of rows.keys()) if (!(key in g)) add(id, `${def.group}.${key}`, 'error', 'linha do painel aponta para uma chave que não existe em C.world');
      for (const [fieldDef, key] of [['cost', 'cost'], ['cooldown', 'cooldown'], ['duration', 'cast']]) {
        if (typeof def[fieldDef] === 'number' && typeof g[key] === 'number' && Math.abs(def[fieldDef] - g[key]) > 1e-9 && !def.durationKeys) add(id, `${def.group}.${key}`, 'warn', `definição diz ${def[fieldDef]} e o grupo ${g[key]} (em jogo vale o grupo)`);
      }
    }
    for (const [i, ev] of (def.timeline ?? []).entries()) if (ev.effect && !env.hasEffect(ev.effect)) add(id, `timeline[${i}].effect`, 'error', `efeito "${ev.effect}" não está registrado`);
    if (def.tackle && !env.hasTackleSetup(def.tackle)) add(id, 'tackle', 'error', `preparação de tackle "${def.tackle}" não está registrada`);
  }
  // Linhas de grupos de Move sem nenhum Move registrado apontando para eles (órfãs) — fora os grupos globais (charge, ai, beam…), que não são de um Move.
  for (const group of rowsByGroup.keys()) if (!groupsOfMoves.has(group) && !(group in env.world)) add('(painel)', group, 'error', 'grupo do painel não existe em C.world');
  return issues;
}

/** Formata a lista para relatório legível (uma linha por problema). */
export const formatIssues = (/** @type {ContractIssue[]} */ issues) => issues.map(i => `${i.severity === 'error' ? '✗' : '⚠'} ${i.id} · ${i.field}: ${i.message}`).join('\n');
