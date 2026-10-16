# Arenamon — Linha de base de desempenho (Etapa 5: só medição)

> **Nenhuma otimização foi feita nem é proposta por este documento.** Pelo plano aprovado, mudanças de desempenho só entram com medição que as justifique e meta definida; a física e a jogabilidade aprovadas não mudam por desempenho.

## O que foi medido (e como repetir)

`npm run measure:sim` (`scripts/measure-sim.mjs`): custo do **passo de simulação de 120 Hz** do laboratório de combate em Node, sem renderização. Lutas IA × IA táticas, 12 sementes fixas × 5 rodadas (≤ 2400 passos por luta), com aquecimento. Duas variantes: **IA × IA** (inclui a decisão da IA do azul) e **simulação sem a IA do azul** (comando vazio; o vermelho segue a IA do jogo). O script recusa-se a reportar se as lutas não forem idênticas entre rodadas (determinismo).

**Execução de 2026-10-16** (`main` @ `bed73b7`, Node 25.8, Windows 11 x64, máquina do diretor; **duas execuções seguidas**):

| Variante | Mediana µs/passo | P95 µs/passo | Passos/s (mediana) |
|---|---|---|---|
| IA × IA | 7,29 · 7,41 | 18,34 · 18,78 | ≈ 137 mil · 135 mil |
| Sem a IA do azul | 4,67 · 4,46 | 5,32 · 5,70 | ≈ 214 mil · 224 mil |

O orçamento de um passo a 120 Hz é de **8 333 µs**. A simulação usa **cerca de 0,1% do orçamento** (≈ 1 100× mais rápida que o tempo real) e a decisão da IA acrescenta ≈ 3 µs por passo em média.

## O que isto permite concluir — e o que não permite

- **Permite:** não há evidência de que a simulação (física, colisões, IA tática, mundo vazio de Moves) seja gargalo; **não se justifica otimizá-la agora**.
- **Não permite:** nada sobre FPS real. **Não foi medido:** GPU, draw calls, triângulos, VFX/partículas, sombras, tempo de abertura do HTML, memória do navegador, coleta de lixo. O heap (~19 MB) é indicativo, sem GC forçado.
- **Não representa o futuro:** o mundo está vazio (nenhum Move registrado). Projéteis, barreiras, áreas e as reflexões múltiplas de Reflect/Psyshock aumentarão o custo; a medição deve ser **refeita** quando houver Moves (cenários com N entidades, reflexões em cadeia e muitas pedras).

## Pendente para uma etapa de desempenho real (não executado)

1. **Medir no navegador, com GPU real:** o laboratório já tem medidor ao vivo e benchmark reproduzível (aba Visualizar › Desempenho; `test/perf.browser.mjs` valida o medidor, não mede o hardware). Rodar nas máquinas-alvo em **Chrome e Edge**, nos três perfis gráficos (Baixo/Médio/Alto), e registrar FPS, P95 de quadro, draw calls, triângulos e partículas.
2. **Definir metas** com o diretor (ex.: P95 de quadro em ms por perfil, tamanho máximo do HTML, tempo de abertura).
3. **Só então** decidir sobre otimizações (VFX, sombras, instanciamento, alocações), cada uma com medição antes/depois e **HTML idêntico em comportamento** (comparação byte a byte quando só houver mudança de tipos).
4. **Cenários de carga dos Moves** (quando existirem): máximo de entidades (`C.world.maxEntities`), ciclos de reflexão, 8 pedras × múltiplas barreiras.
5. **Tamanho dos artefatos** (referência em 2026-10-16): lab 1174 KB, studio 1168 KB, importador 895 KB, jogo 556 KB, placeholders 534 KB, propostas A/B/C ≈ 740 KB cada (saída de `npm run check:offline`).

## Limitações desta medição

Uma máquina, dois conjuntos de execuções; diferença observada entre as duas execuções: até ~5% na mediana e maior no P95 (amostra pequena). Não use estes números para comparar máquinas diferentes. Os valores absolutos mudam com a versão do Node e a carga da máquina no momento.
