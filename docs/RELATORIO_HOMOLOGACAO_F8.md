# Relatório de homologação F8 — laboratório de combate

Data: 29/10/2026 · Task 16 do overhaul F3–F9 (spec §15) · máquina i5-12450H (12 núcleos), Node v25.8.0, Edge com WebGL real.
Evidência navegável: `prototypes/combat-lab/evidence/homologacao-f8/index.html` (números brutos em `resultado.json`).

## Como rodar

| O quê | Comando | Tempo |
|---|---|---|
| Variante curta (entra no `npm run rapido`) | `node prototypes/combat-lab/test/f8-homologacao.test.mjs` | ~6 s |
| Variante longa + grava `resultado.json` e `bench-moves.md` | `node prototypes/combat-lab/test/f8-homologacao.test.mjs --lento` (ou `F8_LENTO=1`) | ~80 s |
| Navegador (acessibilidade, pausa/foco/reinício, memória da GPU) | `npm run rapido:build` e depois `node prototypes/combat-lab/test/f8-homologacao.browser.mjs` | ~1,5 min |

## O que foi verificado (partidas reais, sem mocks)

1. **Replay e múltiplos jogos.** Dois `Game` (sementes 11 e 12, loadouts diferentes) alternados passo a passo produzem o mesmo hash do estado completo (`save()` inteiro) e os mesmos eventos, inclusive `eventId` e `contactId`, que cada um rodando sozinho (3.000 passos). Save no tick 1, 600, 1.777 e 3.000, continuado no mesmo jogo (depois de andar 37 passos e voltar) e num jogo novo: 8 de 8 idênticos bit a bit até o tick 3.600. Replays de referência verdes.
2. **100 resets.** 100 ciclos de reset + 600 passos IA × IA: nenhum array/Map/Set do jogo (até 4 níveis) nem os registros globais (Moves, ganchos, livro de dano) cresceram; os 100 ciclos terminaram no mesmo estado. O contador legado `eventSeq` (e `id`/`cause` dos eventos) é por jogo e atravessa rodadas por contrato (R31); fica fora dessa comparação. No navegador, 100 reinícios pelo Iniciar mantiveram geometrias, texturas e programas estáveis (87 / 9 / 18 nesta execução; 108 / 9 / 24 na anterior).
3. **Partidas inteiras** (arena circular padrão; mais 60 s na arena **quadrada** com `|x|,|z| ≤ arenaHalf − halfExtent`, 0 violação). 4 sementes × sessão de 180 s (21.600 passos cada; rodadas em sequência, melhor de três nas 3 primeiras): 26 rodadas, 1.659 eventos, 260 impactos, 462 passos de hitstop, 183 pousos. Invariantes checados em todo passo, com **0 violação** (pousos em apoio que sobe: 1, teto 3 no teste): sem NaN/Infinity, lutador dentro da arena, HP e stamina na faixa, conservação de HP (livro `damageLedger` + curas com evento), resíduo do solver ≤ tolerância ou pinEscape (resíduo máximo 0, 0 pinEscape), sem pouso falso (vigia da F4), hitstop sem movimento, `validateCombatEvent` em todo evento, `eventId` único e crescente.
4. **Tempo por passo** (skill performance-optimization: medir primeiro, orçamento depois). p50 0,065 ms · p95 0,164 ms · p99 0,319 ms · máx 23,7 ms (pico isolado) em 86.400 passos. Orçamento no teste: p95 < 2 ms e p50 < 1 ms (≈ 12× o medido; o passo tem 8,33 ms). É estrito sozinho e no `--lento`; dentro do `rapido` paralelo (detectado pelo `retry-fs` que o `rapido` põe no `NODE_OPTIONS`), só essas duas asserções de tempo viram aviso impresso. `bench:moves` (3 × 1.800 passos) gerado por `runBench` + `toMarkdown` dentro do teste, não por `bench-moves.mjs --write`: p95 de 20 µs a 371 µs por cenário (`evidence/homologacao-f8/bench-moves.md`).
5. **Acessibilidade e interface.** Em 30 s de IA × IA com Sem Flash + Reduzir Movimento houve golpes e nenhum tremor/flash. Controle com tudo ligado: 12 golpes → 14 tremores e 0 flash nesta execução; na anterior, 11 golpes → 16 tremores e 3 flashes. O flash depende de qual golpe sai, então a prova de Sem Flash só vale quando o controle teve flash. Pausa, quadro a quadro, perda de foco e reinício sem erro de página.

## Achados e correções

| Achado | Causa raiz | Correção |
|---|---|---|
| Dois jogos no mesmo processo divergiam no tick 252 (IA do azul) | A IA consulta `movePermission` antes do passo; a permissão lia `CTX_FIGHTERS`, global do módulo, que apontava para o último jogo simulado (ou para os objetos de antes de um load). O Bullet Punch dava `noTarget` e a decisão mudava. | `setControllerContext` em `controller/ctrl-update.js`; `Brain.command` aponta o contexto para a própria partida (`getFighters`, ligado em `Game`). Nenhum número de gameplay mudou; replays de referência seguem verdes. |
| Jogos alternados ~15× mais lentos | O grafo de navegação tinha cache de um só mapa e era reconstruído a cada troca (~10 ms). | `nav-graph.js` guarda os últimos 8 mapas; o reaproveitado volta com custos base (`resetPenalties`), idêntico a reconstruir. |
| Pouso em y 2,625 com apoio 2,6875 (semente 3) | Não é pouso falso: a rocha do Emerging Stone sobe depois da física no mesmo passo e carrega o lutador ao topo novo. | A vigia aceita apoio que subiu no passo, só quando o pouso ficou entre o topo antigo e o novo e o lutador terminou no topo novo; contado à parte (1 caso). |

## Falha conhecida fora desta entrega: `ai-eval.test.mjs`

**Não é causada pela Task 16.** A guarda «revisão 2 mantém ações negadas controladas» (`negadas(rev 2) ≤ negadas(rev 1) + 20`, 10 pares, semente 100) **passa** na main antes do branch (96205a5) e em ad4973b, e **falha** a partir de db5222e (Task 9, gate da F4): +19 → +23. Investigação: `.superpowers/sdd/2026-10-28-overhaul-f3-f9/ai-eval-investigation-report.md`.

| Commit | negadas rev 2 × rev 1 | diferença | vitórias rev 2 × rev 1 |
|---|---|---|---|
| 96205a5 (main) / ad4973b | 59 × 40 | +19 (passa) | 13 × 7 |
| db5222e em diante | 58 × 35 | +23 (falha) | 13 × 7 |

- Causa: fragilidade estatística da guarda de semente única. Medida do mesmo jeito, a main já tinha 9 das 10 sementes 100–109 acima de +20; em janelas de 10 pares a guarda falha em ~22 % das sementes nos dois commits (20/91 e 21/91).
- O que mudou: só 2 acertos de raspão legítimos de projétil em 200 lutas (sementes 104 e 198); vitórias inalteradas (13 × 7); a previsão da IA já usa um corredor contínuo.
- O contato varrido de projétil é a correção certa de tunelamento e fica. O teste **não foi alterado**; está na faixa lenta (fora do `rapido`) e aguarda a decisão do usuário (guarda estatística com várias sementes ou reancorar o limite).

## O que NÃO foi verificado

- **Intervalos de 45 s e preparação de 90 s:** o jogo não tem relógio de rodada, intervalo nem preparação; a melhor de três é contada pelo teste.
- **Fluxo completo do app (`app/match-flow.js`) sem navegador:** depende do DOM. O navegador cobriu 100 reinícios pela memória da GPU, não as coleções internas da interface.
- **Acessibilidade nos outros renderizadores** (novo, quarks, pós-processamento): só o VFX padrão foi instrumentado.
- **GPU/FPS nas máquinas-alvo:** só a simulação na CPU.
- **Penalidade de aresta travada da navegação** continua no grafo compartilhado (fora do save). Com os padrões (replanejamento 0,4 s < travamento 0,8 s) ela nunca dispara; só pesa se o slider de replanejamento passar do de travamento.
