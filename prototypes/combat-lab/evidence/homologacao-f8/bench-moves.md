# Desempenho da simulação com carga de Moves (2026-10-29)

> Gerado por `node prototypes/combat-lab/bench-moves.mjs --write` (#15 do plano de 23/10/2026). **Só CPU da simulação em Node**: não mede GPU, draw calls, VFX, FPS nem P95 de render. Números de uma máquina não valem para outra; compare apenas execuções no MESMO computador.

**Ambiente:** 12th Gen Intel(R) Core(TM) i5-12450H · 12 núcleos · win32 x64 · Node v25.8.0 · GPU: não medida (simulação em Node).
**Método:** 3 repetições de 1800 passos por cenário (mais aquecimento), tempo de cada `game.step` com `process.hrtime`. Orçamento de um passo a 120 Hz: **8333 µs**.

| Cenário | P50 µs | P95 µs | P99 µs | Máx µs | P95 / orçamento | Passos/s (P50) | Entidades (máx) | Heap Δ KB | Ruído entre repetições |
|---|---|---|---|---|---|---|---|---|---|
| IA × IA, nenhum Move equipado (baseline) | 19.8 | 39.2 | 61.6 | 347.9 | 0.47% | 50.505 | 0 | 732 | 11.4% |
| IA × IA com 4 Moves equipados em cada lado | 16.7 | 37.5 | 78 | 643.3 | 0.45% | 59.880 | 3 | 5447 | 3.1% |
| Swift repetido (stamina infinita): muitos projéteis | 31.3 | 74.2 | 116.5 | 7409 | 0.89% | 31.949 | 9 | -45102 | 19.8% ⚠ alto |
| Fire Spin repetido: várias zonas de pulso ativas | 9.3 | 16 | 39.7 | 524.7 | 0.192% | 107.527 | 1 | 7112 | 20.6% ⚠ alto |
| Reflect do azul contra projéteis do vermelho | 17.6 | 46.3 | 101.8 | 540.1 | 0.556% | 56.818 | 8 | 284 | 14.5% |
| Mundo no limite de entidades (C.world.maxEntities) | 264.1 | 356.5 | 527.7 | 994.8 | 4.278% | 3.786 | 64 | 32015 | 1.3% |

## Leitura

- Quando o P95 é uma fração pequena do orçamento, a simulação **não é o gargalo** e não há motivo para otimizá-la; o limite de FPS vem do desenho (GPU/VFX), que este benchmark não vê.
- "Ruído entre repetições" é o desvio relativo das medianas das repetições; acima de 15% o resultado é marcado e deve ser repetido antes de qualquer conclusão.
- Nada aqui altera física, dano ou tick: é só medição. Otimizações só entram com meta aprovada e medição antes/depois no mesmo computador.

## Pendente (não medido)

1. FPS, P95 de quadro, draw calls, memória e GC do **navegador** com GPU real (aba Visualizar › Desempenho); o medidor existe, falta rodar nas máquinas-alvo.
2. Metas por perfil de máquina (decisão do responsável).
