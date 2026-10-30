// Gera docs/RELATORIO_EXECUCOES_ANIMACOES.md e prototypes/combat-lab/evidence/execucoes-animacoes/*.json: relatório POR EXECUÇÃO das
// animações do Wookada e do Cogumelo reais (GLB + configuração salva do workspace), clipes sem associação, associações de sentido
// duvidoso (A7) com alternativas e deslizamento dos pés durante a conclusão visual.
// Uso: node scripts/gen-relatorio-execucoes.mjs   (≈ 15 s; mesmos cenários da matriz, sem benchmark)
import {writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runAll} from '../prototypes/combat-lab/test/animation-runtime-matrix.mjs';
import {loadConfiguredSource, setupRegistry} from '../prototypes/combat-lab/test/animation-runtime-harness.mjs';
import {executionRows, orphanClips, suspiciousAssociations, footSlide, toMarkdownRows} from '../prototypes/combat-lab/test/animation-execution-report.mjs';
import {Character} from '../prototypes/combat-lab/src/view/characters.js';

setupRegistry();
const p = f => fileURLToPath(new URL('../chars/' + f, import.meta.url));
const w = await loadConfiguredSource(p('wookada/wookada.glb'), 'wookada.glb'), c = await loadConfiguredSource(p('mosh/Cogumelo.glb'), 'Cogumelo.glb');
const outDir = new URL('../prototypes/combat-lab/evidence/execucoes-animacoes/', import.meta.url);mkdirSync(outDir, {recursive: true});
const CLS = ['CONCLUIDA_NATURALMENTE', 'INTERROMPIDA_POR_NOVA_ACAO', 'INTERROMPIDA_POR_REACAO', 'CORTADA_INDEVIDAMENTE', 'FALLBACK', 'NAO_CONCLUIDA_NO_CENARIO', 'SAIDA_DE_LACO', 'SEM_CLIPE'];

const sections = [];
for (const [name, src, other] of [['wookada.glb', w, c], ['Cogumelo.glb', c, w]]) {
  const run = runAll([src, other]), ch = new Character(src, {persist: true});
  const rows = executionRows(name, ch, run, 0).filter(r => r.classificacao !== 'SEM_CLIPE');   // SEM_CLIPE = reserva tocando para ação sem clipe (na matriz)
  writeFileSync(new URL(name.replace('.glb', '') + '.json', outDir), JSON.stringify(rows, null, 1));
  const count = Object.fromEntries(CLS.map(k => [k, rows.filter(r => r.classificacao === k).length]));
  const approved = rows.filter(r => r.aprovada === 'sim').length, oneFrame = rows.filter(r => r.frames <= 4 && r.aprovada === 'sim').length;
  const speedBad = rows.filter(r => r.velocidade.startsWith('NÃO'));
  // Por ação: até 4 execuções exemplares (a mais longa, a 1ª, e TODAS as não aprovadas/cortadas até 4).
  const byAction = new Map();for (const r of rows) {const l = byAction.get(r.acao) ?? [];l.push(r);byAction.set(r.acao, l);}
  const sample = [];
  for (const [, l] of byAction) {
    const bad = l.filter(r => r.aprovada === 'não' && !['INTERROMPIDA_POR_NOVA_ACAO', 'INTERROMPIDA_POR_REACAO'].includes(r.classificacao));
    const pick = [...new Set([[...l].sort((a, b) => b.frames - a.frames)[0], l[0], ...bad])].slice(0, 4);
    sample.push(...pick);
  }
  const orphans = orphanClips(ch), sus = suspiciousAssociations(ch), feet = footSlide(src, other);
  const ft = x => x ? `${x.mediana.toFixed(2)} m/s (p90 ${x.p90.toFixed(2)}; corpo ${x.corpo.toFixed(2)} m/s; ${x.frames} quadros${x.frames < 10 ? ' — amostra curta, inconclusiva' : ''})` : 'sem ossos de pé identificáveis';
  sections.push(`## ${name}

- Execuções medidas: **${rows.length}** (${byAction.size} ações com clipe próprio) · aprovadas ${approved} · aprovadas com ≤ 4 quadros: **${oneFrame}** (deve ser 0).
- Por classificação: ${CLS.filter(k => k !== 'SEM_CLIPE').map(k => `${k} ${count[k]}`).join(' · ')}.
- Velocidade na conclusão visual diferente da configurada: **${speedBad.length}**${speedBad.length ? ' — ' + [...new Set(speedBad.map(r => r.acao))].join(', ') : ''}.
- Lista completa (todas as execuções): \`prototypes/combat-lab/evidence/execucoes-animacoes/${name.replace('.glb', '')}.json\`.

### Deslizamento dos pés (só medição)
Velocidade horizontal do pé de apoio no mundo (ideal ≈ 0 enquanto apoiado): andando normal ${ft(feet.andando)} · andando durante a conclusão visual do tackle ${ft(feet.epilogo)}.
${!(feet.andando?.frames >= 10 && feet.epilogo?.frames >= 10) ? 'Amostra insuficiente para concluir (a conclusão visual do tackle deste modelo dura poucos quadros com a configuração salva).' : feet.epilogo.mediana > feet.andando.mediana * 1.5 ? 'O pé desliza mais na conclusão visual que no andar normal: a pose do ataque não acompanha o deslocamento. É o efeito esperado de tocar o clipe inteiro com o corpo andando; corrigir exigiria camada parcial do corpo (não aprovada) — fica registrado.' : 'Deslizamento na conclusão visual comparável ao andar normal.'}

### Clipes do GLB sem nenhuma associação (${orphans.length})
${orphans.length ? orphans.map(o => `\`${o.name}\` (${o.duration.toFixed(2)} s)`).join(' · ') : 'nenhum'}

### Associações de sentido duvidoso (A7) — NÃO alteradas
Heurística pelo nome do clipe: só aponta o que vale conferir a olho; várias escolhas podem ser autorais e corretas (ex.: um clipe de salto para o vault).
${sus.length ? ['| ação | clipe associado | o nome sugere | a ação espera | alternativas no próprio GLB |', '|---|---|---|---|---|', ...sus.map(s => `| \`${s.acao}\` | ${s.clipe} | ${s.familiaClipe} | ${s.familiaEsperada} | ${s.alternativas.join(', ') || '—'} |`)].join('\n') : 'nenhuma'}

### Execuções (amostra por ação: a mais longa, a primeira e as não aprovadas)
${toMarkdownRows(sample)}
`);
}

const md = `# Relatório por execução das animações (Wookada e Cogumelo reais)

Gerado por \`node scripts/gen-relatorio-execucoes.mjs\` com os GLBs reais e a configuração salva do workspace inicial, nos mesmos cenários de gameplay da [matriz](MATRIZ_ANIMACOES_RUNTIME.md) (\`Game\` + \`Character\` + \`AnimationMixer\`). Cada **execução** é uma ocorrência própria do clipe (identidade \`chave#serial\`): duas execuções seguidas do mesmo Move aparecem como linhas diferentes.

Classificações extras deste relatório: \`NAO_CONCLUIDA_NO_CENARIO\` = o cenário de teste acabou com o clipe tocando (nem corte nem conclusão; a conclusão do mesmo clipe está em outra execução); \`SAIDA_DE_LACO\` = laço (idle, andar, sprint) trocado por locomoção — normal. \`CORTADA_INDEVIDAMENTE\` sobra só para o corte real do runtime e precisa ser 0.

Colunas: **liberação mecânica** = tick em que a simulação soltou o lutador e o clipe seguiu em conclusão visual (— = a execução não precisou de conclusão visual); **quadros** = primeiro e último quadro efetivo do clipe a 30 fps; **peso** = peso no mixer em 0/25/50/75/100 % da execução; **velocidade confere** = taxa medida do clipe na conclusão visual × velocidade configurada no Editor.

Limitações: cenários sem plataformas/obstáculos (essa parte está no teste do app real, \`animation-conclusao-visual.browser.mjs\`); configurações salvas só no navegador do usuário não entram aqui; a heurística de A7 só aponta nomes — a escolha de clipe é autoral.

${sections.join('\n')}`;
writeFileSync(new URL('../docs/RELATORIO_EXECUCOES_ANIMACOES.md', import.meta.url), md);
console.log('docs/RELATORIO_EXECUCOES_ANIMACOES.md escrito');
process.exit(0);
