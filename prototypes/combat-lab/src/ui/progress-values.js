// Valores exibidos pelo HUD de progressão (puro, sem DOM): os cinco atributos evolutivos, o estágio (0 a stagesMax) e o bônus
// acumulado lido dos MESMOS parâmetros da simulação (map.stage*), então os sliders de Mapa › Progressão aparecem no HUD.
// Só apresentação: nada aqui altera regras (src/sim/map.js continua dono dos estágios).

/** Número com até 1 casa decimal, sem zeros sobrando (30 → "30"; 7,5 → "7,5"). */
const num = n => String(Math.round(n * 10) / 10).replace('.', ',');

export const PROGRESS_ATTRS = [
  {key: 'attack', stage: 'attack', label: 'ATAQUE', short: 'ATQ', color: '#ff8a1f', fmt: (s, M) => `+${num(s * (M.stageAttackBonus ?? .1) * 100)}%`, per: M => `+${num((M.stageAttackBonus ?? .1) * 100)}% por estágio`},
  {key: 'defense', stage: 'defense', label: 'DEFESA', short: 'DEF', color: '#3f8cff', fmt: (s, M) => `−${num(s * (M.stageDefenseReduction ?? .1) * 100)} p.p.`, per: M => `−${num((M.stageDefenseReduction ?? .1) * 100)} p.p. de dano e empurrão por estágio`},
  {key: 'stamina', stage: 'staminaMax', label: 'STAMINA MÁX.', short: 'STA', color: '#2fe0a0', fmt: (s, M) => `+${num(s * (M.stageStaminaBonus ?? 1))}`, per: M => `+${num(M.stageStaminaBonus ?? 1)} ponto(s) de capacidade por estágio`},
  {key: 'cooldown', stage: 'cooldown', label: 'COOLDOWN', short: 'CD', color: '#b36bff', fmt: (s, M) => `−${num(s * (M.stageCooldownReduction ?? .1) * 100)}%`, per: M => `−${num((M.stageCooldownReduction ?? .1) * 100)}% de duração por estágio`},
  {key: 'speed', stage: 'speed', label: 'VELOCIDADE', short: 'VEL', color: '#27d3ff', fmt: (s, M) => `+${num(s * (M.stageSpeedBonus ?? .05) * 100)}%`, per: M => `+${num((M.stageSpeedBonus ?? .05) * 100)}% por estágio`},
];

/** Estágios de um lutador limitados a 0…max (estado ausente = tudo zero). */
export function stagesOf(fighter, max = 4) {
  return PROGRESS_ATTRS.map(a => Math.max(0, Math.min(max, Math.round(fighter?.stages?.[a.stage] ?? 0))));
}

/** Linhas do HUD: {key,label,short,color,stage,max,text,isMax,remaining}. */
export function progressRows(fighter, M = {}) {
  const max = Math.max(1, M.stagesMax ?? 4), st = stagesOf(fighter, max);
  return PROGRESS_ATTRS.map((a, i) => ({key: a.key, label: a.label, short: a.short, color: a.color, stage: st[i], max, text: a.fmt(st[i], M), isMax: st[i] >= max, remaining: max - st[i], per: a.per(M)}));
}
