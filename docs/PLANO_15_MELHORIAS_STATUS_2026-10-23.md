# Plano de 15 melhorias: o que foi entregue (23/10/2026)

Base: `docs/ARENAMON_PLANO_15_MELHORIAS_IA_MOVES_DEBUG_PERFORMANCE_2026-10-23.docx` (proposta; o responsável aprovou todas as 15 e mandou iniciar). Versão do laboratório: **1.27.0**. Tudo está na branch `codex/elemental-quarks-visual` (commits `292b16c` a `366c961`). Cada item abaixo diz o que existe, onde abrir e como provar; o que **não** foi feito está dito sem rodeios.

| # | Melhoria | Estado | Onde / como ver | Prova (comando) |
|---|---|---|---|---|
| 08 | Validador de contratos dos Moves | **Entregue** | `src/sim/move-contracts.js` · conflitos conhecidos no teste | `node prototypes/combat-lab/test/moves-contracts.test.mjs` |
| 13 | Índice vivo e mapa de impacto | **Entregue** | `docs/INDICE_VIVO_MOVES.md` (gerado) | `npm run indice` · `…/moves-indice.test.mjs` |
| 14 | CI do Combat Lab | **Escrita, NÃO executada no GitHub** | `.github/workflows/combat-lab.yml` | YAML validado localmente; falta um PR de teste (ver abaixo) |
| 11 | Captura de bug com um clique | **Entregue** | aba Partida › Captura de bug · `src/sim/bug-capture.js` | `…/bug-capture.test.mjs` · `…/bug-capture.browser.mjs` |
| 12 | Replay diferencial (1º tick divergente) | **Entregue** | `src/sim/replay-diff.js` · linha extra no Comparador A × B | `…/replay-diff.test.mjs` |
| 01 | Manifesto declarativo (ficha única) | **Entregue como piloto** | Harden e Second Wind (Normal), Swift (Burst), Guard Break (Charge) · `docs/COMO_CRIAR_UM_MOVE.md` | `…/moves-fichas.test.mjs` · `npm run novo-move` |
| 02 | Assistente guiado de ficha | **Entregue** | aba Moves › ✚ Assistente de ficha · `src/ui/move-spec-*.js` | `…/move-spec.test.mjs` · `…/move-spec.browser.mjs` |
| 09 | Perfil tático declarativo da IA | **Entregue como piloto** (os mesmos 4 Moves) | `src/sim/ai-profile.js` · campo `ai` da ficha | `…/ai-profile.test.mjs` (equivalência com as regras antigas em ~15 mil contextos) |
| 10 | Matriz de cenários por arquétipo | **Entregue** | `src/sim/move-matrix.js` (11 escopos × todos os Moves) | `…/move-matrix.test.mjs` (inclui mutações provocadas) |
| 04 | Linha do tempo do Move | **Entregue (leitura e medição); edição por arrastar NÃO** | cartão do Move › aba Linha do tempo · `src/sim/move-timeline.js` | `…/move-timeline.test.mjs` · `…/move-gizmos.browser.mjs` |
| 05 | Gizmos de colisão | **Parcial** | Visualizar › «Hitbox das entidades dos Moves» (projétil, área, parede/barreira) | `…/collision-tools.test.mjs` (confere raio, altura e rotação desenhados contra a geometria da entidade) · `…/move-gizmos.browser.mjs` (no navegador só prova que não há erro) |
| 07 | Comparador A/B de variantes de um Move | **Entregue (simulação)** | cartão › Mecânica › ⚖ Comparar variantes · `src/sim/move-ab.js` | `…/move-ab.test.mjs` |
| 15 | Benchmark representativo | **Entregue só para a simulação** | `docs/DESEMPENHO_MOVES_2026-10-23.md` · `npm run bench:moves` | `…/bench-moves.test.mjs` |
| 03 | Move Workbench visual + mecânico | **Parcial** | aba Moves unificada (Mecânica, Visual, Animação, Linha do tempo, ▶ Disparar, A/B, atalhos para Ações) | testes de navegador dos Moves |
| 06 | Presets de VFX por fase | **NÃO feito** | — | — |

## O que ficou de fora e por quê

- **#06 não foi tocado.** Os Moves elementais já têm interruptor por fase (padrão dos ateliês). Generalizar para todos exige decisão de produto sobre o que é fase de cada Move; o plano marca essa parte como `[proposta]`.
- **#03 é parcial.** Não há "viewport dominante" nem design de UX aprovado; o plano diz que esboço visual não é design aprovado. O que existe reaproveita a aba Moves.
- **#04:** a barra mostra e mede; não dá para arrastar uma marca (a edição continua nos sliders, que a barra acompanha).
- **#05:** o desenho é conferido em Node contra a geometria da entidade (raio, alturas, parede girada), mas ninguém olhou o resultado na tela: no navegador o teste só prova que o overlay existe e que ligá-lo não gera erro. Faltam beams e a comparação lado a lado com o VFX.
- **#14:** o workflow não rodou no GitHub. "Marcar quebra intencional" e "PR de teste" exigem abrir um PR; os testes de navegador ficam sob demanda (`workflow_dispatch`) por dependerem do Edge e de arquivos locais.
- **#15:** FPS, P95 de quadro, draw calls, GPU e memória do navegador **não foram medidos**. Só a CPU da simulação (no máximo ~3% do orçamento de 8333 µs, mesmo com 64 entidades).
- **#01 / #09:** 15 dos 19 Moves ainda usam o formato antigo (tabela em `moves-panel.js`, valores em `config.js`, regras de IA em `ai-new-moves.js`). Migrar é mecânico (mesmo caminho dos quatro pilotos), mas não foi feito em massa.
- **#12:** não isolei o estado por partida (`C` e os registros continuam globais); o plano exige decisão separada.

## Achados da execução (decisões pendentes do responsável)

1. `riposte.knockbackH` tem padrão 16,8 m/s e o slider vai até 15; `riposte.cost` na definição (0,8) difere do grupo (1,55; em jogo vale o grupo). Reportados no teste de contratos; **nada foi corrigido**.
2. O motor não tem trava contra velocidade infinita: um efeito que escreva `velocity = Infinity` faz o passo não terminar.
3. A esquiva C encerra o guard stun (achado do contador de combos, na branch `codex/combos`).
4. O conflito do Seed Bomb citado no plano (`range: 16` × slider 15) já não existe: o alcance padrão é 32.

## Skills usadas e não usadas

Registro em `docs/GAMEDEV_SKILLS.md`. Usadas de verdade: `arenamon-routing`, `performance-optimization` e `game-ai` (SKILL.md lidos). TDD foi feito à mão (RED sintético → GREEN) sem invocar as skills do Superpowers pela ferramenta Skill. O pacote Claude Superskills **não está disponível** nesta sessão e não foi instalado (o plano manda pedir autorização antes de instalar).

## Como rodar tudo

```bash
npm run build:combat-lab
npm run test:combat-lab:unit      # inclui contratos, fichas, índice, matriz, replay, captura, A/B, benchmark
npm run indice                    # regenera docs/INDICE_VIVO_MOVES.md
npm run fichas                    # regenera os índices das fichas
npm run novo-move -- "Nome"       # cria um Move novo
npm run bench:moves               # mede a simulação e grava docs/DESEMPENHO_MOVES_<data>.md
```

## Atualização: revisão independente e integração (23/10/2026, à noite)

- **Revisão de código independente** (subagente, skill `requesting-code-review` do Superpowers) sobre os 5 primeiros commits: 1 problema crítico, 4 importantes, 9 menores. **Corrigidos** em `366c961`, cada um com teste de regressão em `moves-revisao.test.mjs`: A/B, linha do tempo e matriz desligavam a IA do rival da partida ao vivo; CRLF da CI no Windows (`.gitattributes`); índice vivo lendo arquivos não versionados; grupo de ficha que sobrescreveria `charge`/`ai`/`beam`; `novo-move` quebrando com apóstrofo; semente da captura sem validação/escape; caminhos locais nas mensagens de erro; comando do Markdown com caracteres perigosos; ordem dos Moves nos menus; imports mortos; paridade dos 4 Moves migrados com os valores de antes (teste novo).
- **Não corrigido (informação desatualizada que já existia):** a dica de `guardBreak.damage` diz «Valor do laboratório: 14 HP», mas o valor de fábrica e o calibrado são 6 (já era assim em `5b4343a`). Decidir qual dos dois vale.
- **Integração:** os testes novos agora estão em `scripts/run-test-chain.mjs` (o `npm test` real) e os de navegador (`bug-capture`, `move-spec`, `move-gizmos`) também; a CI confere os dois índices gerados.
- **#02:** o assistente passou a ter os **quatro status independentes** por campo (proposto, aprovado, implementado, homologado); fichas antigas (um status só) continuam abrindo.
- **`npm run verify`:** parou na etapa `skills:check` (`.claude/skills` difere da fonte; já estava alterado antes deste trabalho). Rodei as demais etapas à parte: typecheck (ok), `npm test` (passou até `solid-vfx.browser`, que tem uma verificação de **tempo** em renderização por software, «quadro completo com fumaça raymarched abaixo de 1500 ms»: **falhou nas duas vezes** que rodei, 2434 ms e depois 2164 ms numa máquina livre; não toca em nada que eu mudei (fumaça volumétrica), mas **não consegui provar** que já falhava antes: a tentativa de rodar o mesmo teste no commit `6d4ad50` não compilou na worktree. Os testes seguintes da cadeia não rodaram por isso) e `check:offline` (18 HTMLs sem dependência externa, ok).
- **Claude Superskills 2.0.8:** instalado pelo responsável com `npx claude-superskills install -y`; o instalador **não detectou o Claude Code** e colocou as skills em `~/.gemini/skills` e `~/.antigravity`. Copiei as 5 do plano (`agent-skill-discovery`, `agent-skill-orchestrator`, `senior-solution-architect`, `writing-plans`, `executing-plans`) para `~/.claude/skills`; **só valem numa sessão nova** e **nenhuma foi invocada** neste trabalho. Registro de prova, tabela FATO/INFERÊNCIA/HIPÓTESE/DECISÃO e o plano do que falta: `docs/PLANO_15_MELHORIAS_PROVA_2026-10-23.md` e `docs/plans/2026-10-23-melhorias-restantes.md`.

## Atualização de 25/10/2026 (v1.38.0): auditoria do .docx contra a `main` e o que foi fechado

Auditoria item a item do `.docx` contra a `main` (c461241). Já estavam fechados antes desta rodada: #01 (os 19 Moves em `move.json` + ficha), #02, #03 parcial (Editor de Moves com palco, play, sliders, linha do tempo, A/B e gravação em disco), #04 (sem arrastar marcas), #08, #12, #14 (CI verde e quebra de propósito), #06 só no Atelier Areia/Pedra.

**Fechado nesta rodada** (branch `claude/plano15-restante`, um commit por item):

| # | O que faltava | O que mudou | Prova |
|---|---|---|---|
| 13 | Documento sem referência só aparecia como «candidato» | O teste do índice vivo **falha** se algum documento de `docs/` não for citado no portal nem em outro documento; os 5 órfãos foram ligados ao portal | `node prototypes/combat-lab/test/moves-indice.test.mjs` |
| 07 | A/B não avisava quando versão ou ambiente mudavam | Hash do ambiente sem os caminhos comparados; o editor avisa se a versão, o ambiente, o Move ou o cenário mudaram desde a comparação anterior | `…/move-ab.test.mjs` |
| 11 | Sem imagem na captura de bug | Interruptor «Incluir imagem da tela no pacote» (JPEG até 960 px); sem ele o pacote não leva imagem | `…/bug-capture.test.mjs` · `…/bug-capture.browser.mjs` |
| 10 | Sem escopo de gravidade; fuzz fora da matriz | Escopos `gravity` (×0,5 e ×2) e `fuzz` (3 roteiros aleatórios por semente), cada um com mutação provocada; relatório `docs/MATRIZ_MOVES_2026-10-25.md`: 341 ok, 0 falhas, 1 N/A | `…/move-matrix.test.mjs` · `npm run matriz` |
| 09 | 12 Moves ainda nas regras antigas (`RULES`) | Todos ganharam perfil tático declarativo na ficha (`ai: {…}`); `RULES` saiu de `ai-new-moves.js`. Equivalência com as regras antigas provada numa grade de contextos (16 Moves); mutação de borda (`<` → `<=`) é acusada | `…/ai-profile.test.mjs` |
| 05 | Faltavam hurtbox e deslocamento pretendido × real; ninguém olhou a tela | Visualizar › «Hurtbox dos lutadores» e «Deslocamento pretendido × real» (linha em Dados ao vivo); capturas reais com GPU em `prototypes/combat-lab/evidence/gizmos/` | `…/collision-tools.test.mjs` · `node prototypes/combat-lab/test/gizmos-evidencia.browser.mjs` |
| 15 | Render nunca medido com GPU | `npm run bench:render`: 3 repetições do benchmark do painel com a GPU real (Intel UHD, i5-12450H): ~106–127 FPS sem vsync, P95 11–13 ms, 31–37 draw calls, heap JS 20–60 MB. `docs/DESEMPENHO_RENDER_2026-10-25.md` | `npm run bench:render` |
| 14 | Sem verificação de tipos estritos na CI; actions com aviso de Node 20 | Etapa «TypeScript estrito (catraca)» na CI (939 erros, só pode cair) e actions v5 | `node scripts/estrito.mjs` |

**Continua de fora (decisão sua, não tarefa):** metas de desempenho por perfil (#15); arrastar marcas, versões e desfazer na linha do tempo (#04); área de visualização dominante e A/B visual lado a lado (#03); VFX por fase no jogo e nos ateliês Quarks (#06); Riposte (recuo 16,8 × slider 15; custo 0,8 × 1,55), trava contra velocidade infinita e esquiva encerrando o guard stun. **Não feito:** comparação VFX × colisor lado a lado em movimento (a captura do Air Slash mostra o anel de colisão, mas o VFX não aparece com o jogo pausado passo a passo); aviso de PRs que mexem nos mesmos arquivos e registro de documentos lidos pelo agente (#13, processo); `skills:check` do `npm run verify`.

**Decidido em 25/10/2026 (v1.38.1):** Riposte com exceção ao limite de 15 (slider do recuo horizontal até 17, o jogo segue com 16,8) e custo de fábrica = valor do jogo (1,55). O teste de contratos não tem mais conflitos conhecidos.

## Efeito visual × área de colisão em movimento (25/10/2026, v1.38.2)

Fecha o que faltava do #05. `node prototypes/combat-lab/test/vfx-colisao.browser.mjs` roda o jogo ao vivo com a GPU, dispara 8 Moves pela tecla, pausa no meio do voo e fotografa o efeito com o gizmo por cima. Página: `prototypes/combat-lab/evidence/vfx-colisao/index.html` (link no portal).

- **Corrigido:** o gizmo «Hitbox das entidades dos Moves» não desenhava o **Sand Wave**; agora mostra o retângulo real do acerto e a frente atual (linha amarela).
- **Swift:** a estrela desenhada tem raio ~0,55 m e a colisão 0,2 m (visual ≈ 2,7× maior).
- **Psyshock:** cristais de 0,35–0,56 m contra colisão de 0,2 m (1,8× a 2,8×).
- **Air Slash:** o arco do efeito é bem maior que a esfera de colisão de 0,6 m (partículas: comparação só pela foto).
- **Sand Wave:** as dunas do efeito passam das laterais e vão à frente da frente real do acerto.
- **Spikes:** visual = colisão (1,2 m). **Fire Spin:** no instante da foto só o cilindro de 1,6 m aparece (o fogo ainda não tinha surgido).
- Nada foi alterado em tamanho de efeito nem de colisão: decidir se o visual encolhe ou a colisão cresce é escolha sua.

**Atualização (v1.38.3):** Swift e Psyshock passaram a usar no jogo o visual aprovado do atelier (detalhes em `docs/LAB_AREIA_PEDRA.md`); as medidas visual × colisão do Swift e do Psyshock acima eram do visual antigo.
