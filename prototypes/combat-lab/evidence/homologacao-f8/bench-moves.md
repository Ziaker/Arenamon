# Desempenho da simulação com carga de Moves (2026-10-29)

> **Procedência deste arquivo:** gerado por `runBench({repeats: 3, ticks: 1800})` + `toMarkdown` dentro de `test/f8-homologacao.test.mjs --lento` (as mesmas funções de `npm run bench:moves`, mas NÃO por `bench-moves.mjs --write`; a linha «Gerado por» abaixo é o texto padrão do relatório).

> Gerado por `node prototypes/combat-lab/bench-moves.mjs --write` (#15 do plano de 23/10/2026). **Só CPU da simulação em Node**: não mede GPU, draw calls, VFX, FPS nem P95 de render. Números de uma máquina não valem para outra; compare apenas execuções no MESMO computador.

**Ambiente:** 12th Gen Intel(R) Core(TM) i5-12450H · 12 núcleos · win32 x64 · Node v25.8.0 · GPU: não medida (simulação em Node).
**Método:** 3 repetições de 1800 passos por cenário (mais aquecimento), tempo de cada `game.step` com `process.hrtime`. Orçamento de um passo a 120 Hz: **8333 µs**.

| Cenário | P50 µs | P95 µs | P99 µs | Máx µs | P95 / orçamento | Passos/s (P50) | Entidades (máx) | Heap Δ KB | Ruído entre repetições |
|---|---|---|---|---|---|---|---|---|---|
| IA × IA, nenhum Move equipado (baseline) | 23.3 | 37.3 | 64.9 | 1879.5 | 0.448% | 42.918 | 0 | -20327 | 21.8% ⚠ alto |
| IA × IA com 4 Moves equipados em cada lado | 16.5 | 38.2 | 80.6 | 553.4 | 0.458% | 60.606 | 3 | 5693 | 0.8% |
| Swift repetido (stamina infinita): muitos projéteis | 33.8 | 72.4 | 113.8 | 1049.5 | 0.869% | 29.586 | 9 | 16043 | 17.6% ⚠ alto |
| Fire Spin repetido: várias zonas de pulso ativas | 10.8 | 19.8 | 40.8 | 496.3 | 0.238% | 92.593 | 1 | 7105 | 19.2% ⚠ alto |
| Reflect do azul contra projéteis do vermelho | 18.2 | 46.5 | 92.1 | 635.8 | 0.558% | 54.945 | 8 | 233 | 11.9% |
| Mundo no limite de entidades (C.world.maxEntities) | 276.5 | 370.8 | 620.4 | 899.9 | 4.45% | 3.617 | 64 | -11321 | 0.5% |

## Leitura

- Quando o P95 é uma fração pequena do orçamento, a simulação **não é o gargalo** e não há motivo para otimizá-la; o limite de FPS vem do desenho (GPU/VFX), que este benchmark não vê.
- "Ruído entre repetições" é o desvio relativo das medianas das repetições; acima de 15% o resultado é marcado e deve ser repetido antes de qualquer conclusão.
- Nada aqui altera física, dano ou tick: é só medição. Otimizações só entram com meta aprovada e medição antes/depois no mesmo computador.

## Pendente (não medido)

1. FPS, P95 de quadro, draw calls, memória e GC do **navegador** com GPU real (aba Visualizar › Desempenho); o medidor existe, falta rodar nas máquinas-alvo.
2. Metas por perfil de máquina (decisão do responsável).
