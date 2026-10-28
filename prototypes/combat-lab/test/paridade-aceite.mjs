// @ts-check
// Task 12 (F5) — regras puras de aceite das baselines de paridade visual (moves-vfx-parity.browser.mjs --aceitar=...).
// O teste nunca escreve em baselines/ sozinho; o aceite é do usuário e segue duas regras:
//  · nunca misturar layouts: as candidatas registram layout + viewport; as 5 são aceitas JUNTAS (--aceitar=todos) quando
//    todas têm a mesma assinatura. Um efeito sozinho só é aceito se o manifesto das baselines (gravado no aceite de todos)
//    tiver a mesma assinatura da candidata.
//  · efeito com análise pendente (analise-paridade.json, "pendente": true) não é aceito.

export const EFEITOS = ['sand-wave-ativo', 'bullet-punch-vanish', 'bullet-punch-impacto', 'water-pulse-voo', 'water-pulse-splash'];

/** @param {{layout?: string, viewport?: {w: number, h: number}} | null | undefined} m */
export const assinaturaLayout = m => m?.layout && m.viewport ? `${m.layout}@${m.viewport.w}x${m.viewport.h}` : '?';

/**
 * @param {{alvo: string, candidatas: any, baselines: any, analise: Record<string, any>, existe: (path: string) => boolean,
 *   candDir?: string}} o candDir só compõe o caminho testado em existe()
 * @returns {{ok: true, copias: string[], manifestoBase: any} | {ok: false, erro: string}}
 */
export function planoDeAceite({alvo, candidatas, baselines, analise, existe, candDir = 'baselines-candidatas/'}) {
  const todos = alvo === 'todos';
  if (!todos && !EFEITOS.includes(alvo)) return {ok: false, erro: `Efeito desconhecido: "${alvo}". Use --aceitar=todos ou um de: ${EFEITOS.join(', ')}`};
  if (!candidatas?.efeitos) return {ok: false, erro: 'Sem manifesto das candidatas (baselines-candidatas/candidatas.json): rode antes o teste com --update-baselines.'};
  const alvos = todos ? EFEITOS : [alvo];
  for (const ef of alvos) {
    if (analise?.[ef]?.pendente) return {ok: false, erro: `${ef} está com análise PENDENTE em analise-paridade.json — não pode ser aceito até a diferença ser explicada.`};
    if (!candidatas.efeitos[ef] || !existe(candDir + ef + '.png')) return {ok: false, erro: `Falta a candidata de ${ef}: rode o teste com --update-baselines (as 5 na mesma execução).`};
  }
  const sigs = [...new Set(alvos.map(ef => assinaturaLayout(candidatas.efeitos[ef])))];
  if (todos) {
    if (sigs.length !== 1 || sigs[0] === '?') return {ok: false, erro: `Candidatas com layout/viewport diferentes (${sigs.join(' × ')}): recapture as 5 na mesma execução de --update-baselines.`};
    const {layout, viewport} = candidatas.efeitos[EFEITOS[0]];
    return {ok: true, copias: [...EFEITOS], manifestoBase: {layout, viewport, efeitos: Object.fromEntries(EFEITOS.map(ef => [ef, candidatas.efeitos[ef]]))}};
  }
  const sigBase = assinaturaLayout(baselines);
  if (sigBase === '?' || sigBase !== sigs[0]) return {ok: false, erro: `Layout da candidata (${sigs[0]}) ≠ layout das baselines atuais (${sigBase}): aceitar um efeito só misturaria layouts. Revise as 5 e use --aceitar=todos.`};
  return {ok: true, copias: [alvo], manifestoBase: {...baselines, efeitos: {...(baselines.efeitos ?? {}), [alvo]: candidatas.efeitos[alvo]}}};
}
