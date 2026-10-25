# Desempenho da simulação com carga de Moves (2026-10-23)

> Gerado por `node prototypes/combat-lab/bench-moves.mjs --write` (#15 do plano de 23/10/2026). **Só CPU da simulação em Node**: não mede GPU, draw calls, VFX, FPS nem P95 de render. Números de uma máquina não valem para outra; compare apenas execuções no MESMO computador.

**Ambiente:** 12th Gen Intel(R) Core(TM) i5-12450H · 12 núcleos · win32 x64 · Node v25.8.0 · GPU: não medida (simulação em Node).
**Método:** 5 repetições de 1800 passos por cenário (mais aquecimento), tempo de cada `game.step` com `process.hrtime`. Orçamento de um passo a 120 Hz: **8333 µs**.

| Cenário | P50 µs | P95 µs | P99 µs | Máx µs | P95 / orçamento | Passos/s (P50) | Entidades (máx) | Heap Δ KB | Ruído entre repetições |
|---|---|---|---|---|---|---|---|---|---|
| IA × IA, nenhum Move equipado (baseline) | 17.5 | 41.1 | 108.1 | 1668 | 0.493% | 57.143 | 0 | 214 | 25.4% ⚠ alto |
| IA × IA com 4 Moves equipados em cada lado | 20 | 52 | 129.6 | 2977.1 | 0.624% | 50.000 | 3 | 630 | 27.5% ⚠ alto |
| Swift repetido (stamina infinita): muitos projéteis | 21.5 | 39.1 | 92.6 | 1734.4 | 0.469% | 46.512 | 9 | 2357 | 3.4% |
| Fire Spin repetido: várias zonas de pulso ativas | 8.2 | 11.9 | 30.5 | 1159.9 | 0.143% | 121.952 | 1 | -1344 | 7% |
| Reflect do azul contra projéteis do vermelho | 14.8 | 36.6 | 74.7 | 589.9 | 0.439% | 67.568 | 12 | -515 | 10.3% |
| Mundo no limite de entidades (C.world.maxEntities) | 189.8 | 245.5 | 337.5 | 783 | 2.946% | 5.269 | 64 | -926 | 6.9% |

## Leitura

- Quando o P95 é uma fração pequena do orçamento, a simulação **não é o gargalo** e não há motivo para otimizá-la; o limite de FPS vem do desenho (GPU/VFX), que este benchmark não vê.
- "Ruído entre repetições" é o desvio relativo das medianas das repetições; acima de 15% o resultado é marcado e deve ser repetido antes de qualquer conclusão.
- Nada aqui altera física, dano ou tick: é só medição. Otimizações só entram com meta aprovada e medição antes/depois no mesmo computador.

## Pendente (não medido)

1. FPS, P95 de quadro, draw calls, memória e GC do **navegador** com GPU real (aba Visualizar › Desempenho); o medidor existe, falta rodar nas máquinas-alvo.
2. Metas por perfil de máquina (decisão do responsável).
