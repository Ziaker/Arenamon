# Plano de 15 melhorias: o que foi entregue (23/10/2026)

Base: `docs/ARENAMON_PLANO_15_MELHORIAS_IA_MOVES_DEBUG_PERFORMANCE_2026-10-23.docx` (proposta; o responsável aprovou todas as 15 e mandou iniciar). Versão do laboratório: **1.27.0**. Tudo está na pasta oficial, **sem commit**. Cada item abaixo diz o que existe, onde abrir e como provar; o que **não** foi feito está dito sem rodeios.

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
