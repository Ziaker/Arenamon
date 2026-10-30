// Gera docs/MATRIZ_ANIMACOES_RUNTIME.md: matriz dinâmica das animações no runtime (gameplay real) para o personagem sintético e para os GLBs importados.
// Uso: node scripts/gen-matriz-animacoes.mjs   (≈ 10 s)
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runAll, rowsFor, toMarkdown, RESERVA, countByClassificacao, CLASSIFICACOES} from '../prototypes/combat-lab/test/animation-runtime-matrix.mjs';
import {loadConfiguredSource, makeCharacter, configurableActions, setupRegistry} from '../prototypes/combat-lab/test/animation-runtime-harness.mjs';
import {Character} from '../prototypes/combat-lab/src/view/characters.js';

setupRegistry();
const p = f => fileURLToPath(new URL('../chars/' + f, import.meta.url));
const actions = configurableActions();
const syn = runAll(null), sRows = rowsFor('sintético', makeCharacter(actions, 'azul.glb'), syn, true);
const w = await loadConfiguredSource(p('wookada/wookada.glb'), 'wookada.glb'), c = await loadConfiguredSource(p('mosh/Cogumelo.glb'), 'Cogumelo.glb'), real = runAll([w, c]), realC = runAll([c, w]);   // cada importado é o lutador AZUL (age em todos os cenários) numa rodada própria
const wRows = rowsFor('wookada.glb', new Character(w, {persist: true}), real, false, 0), cRows = rowsFor('Cogumelo.glb', new Character(c, {persist: true}), realC, false, 0);
const cnt = rows => `${rows.filter(r => r.resultado.startsWith('aprovada')).length} aprovadas · ${rows.filter(r => r.resultado.startsWith('não aprovada')).length} não aprovadas · ${rows.filter(r => r.resultado.startsWith('reserva')).length} reserva · ${rows.filter(r => r.resultado.startsWith('sem clipe')).length} sem clipe configurado`;
const byClass = rows => {const c = countByClassificacao(rows);return CLASSIFICACOES.map(k => `${k} ${c[k]}`).join(' · ');};
const md = `# Matriz de animações no runtime

Gerada por \`node scripts/gen-matriz-animacoes.mjs\` (gameplay real: \`Game\` + \`Character\` + \`AnimationMixer\`, Editor fechado). A prova de cada ação vem do que o Character **tocou** durante ${real.builds.length} cenários de partida, nunca de chamar \`stateKey()\` direto nem de associar clipe genérico. Teste: \`prototypes/combat-lab/test/animation-runtime.test.mjs\`.

Critério de aprovação **por execução**: cada exercício de um clipe é segmentado e classificado — \`CONCLUIDA_NATURALMENTE\` (fim efetivo do clipe), \`INTERROMPIDA_POR_NOVA_ACAO\`/\`INTERROMPIDA_POR_REACAO\` (troca autorizada), \`CORTADA_INDEVIDAMENTE\` (corte para locomoção/neutral/idle sem razão autorizada com < 95% do clipe), \`FALLBACK\` (clipe fora da lista configurada), \`SEM_CLIPE\` (recurso ausente) e \`NAO_ALCANCADA\` (nunca tocou). Aprovação exige classificação positiva + duração mínima (≥ 8 quadros ou ≥ 25% do clipe, o que for menor) + peso máximo ≥ 0,3: um clipe de 1–4 quadros ou de peso 0,05 **nunca** é aprovado. Para ações de laço (idle, walk, sprint, block, cargas), \`CONCLUIDA_NATURALMENTE\` significa «mantida pelo tempo mínimo de prova».

- **Sintético** (um clipe distinto por ação): ${cnt(sRows)}.
  ${byClass(sRows)}
- **wookada.glb** (importado): ${cnt(wRows)}.
  ${byClass(wRows)}
- **Cogumelo.glb** (importado): ${cnt(cRows)}.
  ${byClass(cRows)}
- «reserva»: ação que só toca quando o clipe primário do estado não está configurado (${[...RESERVA].join(', ')}); provada no sintético por cenários em que o primário é removido. «sem clipe configurado»: o modelo não tem clipe para a ação (o jogo usa a cadeia de reserva documentada em \`STATE_ACTIONS\`).

## Sintético (todas as ações)
${toMarkdown(sRows)}

## wookada.glb
${toMarkdown(wRows)}

## Cogumelo.glb
${toMarkdown(cRows)}
`;
writeFileSync(new URL('../docs/MATRIZ_ANIMACOES_RUNTIME.md', import.meta.url), md);
console.log('docs/MATRIZ_ANIMACOES_RUNTIME.md escrito:', cnt(sRows), '|', cnt(wRows), '|', cnt(cRows));
process.exit(0);
