# Desempenho da simulação com carga de Moves (2026-10-29)

> **Procedência deste arquivo:** gerado por `runBench({repeats: 3, ticks: 1800})` + `toMarkdown` dentro de `test/f8-homologacao.test.mjs --lento` (as mesmas funções de `npm run bench:moves`, mas NÃO por `bench-moves.mjs --write`; a linha «Gerado por» abaixo é o texto padrão do relatório).

> Gerado por `node prototypes/combat-lab/bench-moves.mjs --write` (#15 do plano de 23/10/2026). **Só CPU da simulação em Node**: não mede GPU, draw calls, VFX, FPS nem P95 de render. Números de uma máquina não valem para outra; compare apenas execuções no MESMO computador.

**Ambiente:** 12th Gen Intel(R) Core(TM) i5-12450H · 12 núcleos · win32 x64 · Node v25.8.0 · GPU: não medida (simulação em Node).
**Método:** 3 repetições de 1800 passos por cenário (mais aquecimento), tempo de cada `game.step` com `process.hrtime`. Orçamento de um passo a 120 Hz: **8333 µs**.

| Cenário | P50 µs | P95 µs | P99 µs | Máx µs | P95 / orçamento | Passos/s (P50) | Entidades (máx) | Heap Δ KB | Ruído entre repetições |
|---|---|---|---|---|---|---|---|---|---|
| IA × IA, nenhum Move equipado (baseline) | 19.4 | 36.8 | 58.5 | 678.8 | 0.442% | 51.546 | 0 | 1395 | 4.4% |
| IA × IA com 4 Moves equipados em cada lado | 16.9 | 43 | 92.5 | 794.8 | 0.516% | 59.172 | 3 | 5967 | 7.4% |
| Swift repetido (stamina infinita): muitos projéteis | 29.8 | 70.5 | 106.7 | 710.5 | 0.846% | 33.557 | 9 | -5152 | 17% ⚠ alto |
| Fire Spin repetido: várias zonas de pulso ativas | 7.8 | 16.2 | 31 | 463.6 | 0.194% | 128.205 | 1 | 7085 | 31.4% ⚠ alto |
| Reflect do azul contra projéteis do vermelho | 20.1 | 55 | 100.6 | 591.2 | 0.66% | 49.751 | 8 | 247 | 15.8% ⚠ alto |
| Mundo no limite de entidades (C.world.maxEntities) | 271.5 | 379.4 | 619.5 | 904.2 | 4.553% | 3.683 | 64 | -11605 | 0.5% |

## Leitura

- Quando o P95 é uma fração pequena do orçamento, a simulação **não é o gargalo** e não há motivo para otimizá-la; o limite de FPS vem do desenho (GPU/VFX), que este benchmark não vê.
- "Ruído entre repetições" é o desvio relativo das medianas das repetições; acima de 15% o resultado é marcado e deve ser repetido antes de qualquer conclusão.
- Nada aqui altera física, dano ou tick: é só medição. Otimizações só entram com meta aprovada e medição antes/depois no mesmo computador.

## Pendente (não medido)

1. FPS, P95 de quadro, draw calls, memória e GC do **navegador** com GPU real (aba Visualizar › Desempenho); o medidor existe, falta rodar nas máquinas-alvo.
2. Metas por perfil de máquina (decisão do responsável).
