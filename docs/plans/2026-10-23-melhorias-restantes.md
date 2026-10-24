# Melhorias restantes do plano de 15 itens: Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (ou `executing-plans` do Claude Superskills, numa sessão nova) para implementar este plano tarefa a tarefa.

**Goal:** Fechar o que o plano de 15 melhorias deixou parcial ou pendente, sem alterar regra de jogo nem valor homologado.

**Architecture:** Mesma cadeia dos itens entregues: especificar (ficha) → validar (contratos/matriz) → editar → simular → reproduzir (captura/replay) → medir (benchmark). Cada tarefa abaixo é pequena, começa por um teste que falha e termina em commit separado.

**Tech Stack:** JavaScript ESM, Node (testes de simulação), Playwright + Edge (testes de navegador), esbuild (HTML único offline).

**Antes de tudo:** `git fetch origin`, `npm run verify:workspace`, ler `AGENTS.md` e `docs/PLANO_15_MELHORIAS_PROVA_2026-10-23.md`. Decisões pendentes (Riposte, velocidade infinita, esquiva no guard stun, VFX por fase, UX do Workbench) **não** são tarefas: dependem do responsável.

---

### Tarefa 1: Destravar o `npm test` (solid-vfx)

**Arquivos:** `prototypes/combat-lab/test/solid-vfx.browser.mjs` (verificação «quadro completo com fumaça raymarched abaixo de 1500 ms»), `src/view/smoke-volume.js`.
- Passo 1: rodar `node prototypes/combat-lab/test/solid-vfx.browser.mjs` e anotar o tempo (hoje 2164 a 2434 ms).
- Passo 2: rodar o mesmo teste no commit `5b4343a` (worktree em `.worktrees/` com `build:studio` e `build:combat-lab` completos) para provar se a falha é anterior.
- Passo 3: **decisão do responsável**: corrigir a causa (custo da fumaça por software) ou rever o limite de tempo. Não alterar o limite sem decisão.
- Esperado: `npm test` chega ao fim; só então os testes depois dele passam a contar.

### Tarefa 2: Migrar os outros 15 Moves para ficha

**Arquivos por Move:** `src/sim/moves/<id>.js`, `<id>.params.js`, linhas em `config.js`, `ui/moves-panel.js`, `new-moves.js`.
- Passo 1: para cada Move, fixar no `moves-revisao.test.mjs` os valores de fábrica de antes (como nos 4 pilotos).
- Passo 2: rodar o codemod (`migrar-ficha`, no histórico da sessão; reescrever como `prototypes/combat-lab/migrar-ficha.mjs` antes de usar).
- Passo 3: `node prototypes/combat-lab/test/moves-<id>.test.mjs`, `moves-contracts`, `move-matrix`, `moves-params`.
- Passo 4: um commit por Move. Um Move por vez: ordem sugerida do mais simples ao mais ligado ao motor (Lunge, Quick Attack, Feint, Riposte, Bounce, Spikes, Sand Wave, Bullet Punch, Emerging Stone, elementais, Reflect, Psyshock).
- Esperado: o painel, a exportação e a matriz continuam iguais; paridade de valores provada por teste.

### Tarefa 3: Replay de referência (#12) — FEITA em 23/10/2026

**Arquivos:** `src/sim/replay-diff.js`, novo `test/replays/referencia-*.json`, `test/replay-referencia.test.mjs`.
- Passo 1 (RED): teste que roda uma gravação guardada e compara com o hash/estados esperados; falha se não houver referência.
- Passo 2: gravar 3 referências (duelo com Tackle, com Quick Attack, com Reflect) e guardar os estados normalizados em intervalos.
- Passo 3: o teste acusa o primeiro tick divergente quando uma regra muda. Atualizar a referência exige decisão explícita (`--atualizar`).
- Esperado: mudar uma regra faz o teste apontar tick e campo.
- **Feito:** `src/sim/replay-referencia.js`, `test/replay-referencia.test.mjs` e 3 gravações em `test/replays/` (hash por grupo em cada tick + estado completo a cada 30 ticks). Acusa tick e grupo (e o campo quando há estado guardado). Atualizar: `node prototypes/combat-lab/test/replay-referencia.test.mjs --atualizar`.

### Tarefa 4: Matriz mais completa (#10) — FEITA em 23/10/2026

**Arquivos:** `src/sim/move-matrix.js`, campo opcional `matrix: {na: {escopo: 'razão'}}` na ficha.
- Passo 1 (RED): teste de um Move com `matrix.na.air` declarado: hoje o N/A só vem de `def.air`.
- Passo 2: escopos novos: teto, borda da arena, destrutível, refletir/neutralizar, status (Harden/Second Wind ativos). Cada um com razão de N/A quando não se aplica.
- Passo 3: gerar relatório (`docs/MATRIZ_MOVES_<data>.md`) com seed, tick, esperado e obtido.
- Esperado: nenhum escopo pulado sem razão; relatório regenerável.
- **Feito:** 16 escopos (novos: ceiling, arena-edge, destructible, reflect, status); `matrix.na` na ficha do Move; relatório `docs/MATRIZ_MOVES_2026-10-23.md` via `npm run matriz`. Resultado: 303 ok, 0 falhas, 1 N/A (semente 7). Escopos novos são genéricos (invariantes), sem regra de produto nova.

### Tarefa 5: Linha do tempo com câmera, VFX e animação (#04)

**Arquivos:** `src/sim/move-timeline.js`, `src/ui/moves-panel.js`.
- Passo 1: fonte dos eventos de câmera/VFX (hooks em `view/`) e do clipe animado por Move.
- Passo 2 (RED): marca de VFX/animação no tick certo, distinguindo tick mecânico de frame de animação.
- Passo 3: pausar o replay no tick da marca. Arrastar marca **só** com decisão do responsável.

### Tarefa 6: Benchmark de render com GPU real (#15)

**Bloqueio:** exige a máquina do responsável com GPU; no Edge headless (software) o resultado não vale.
- Passo 1: rodar o medidor ao vivo (Visualizar › Desempenho) com GLB animado, Quarks, projéteis e reflexões, 3 repetições.
- Passo 2: gravar CPU de render, FPS P95, draw calls e memória com a máquina identificada.
- Passo 3: metas por perfil (decisão do responsável) antes de qualquer otimização.

### Tarefa 7: Primeira execução da CI (#14)

- Passo 1: abrir um PR de teste que toca `prototypes/combat-lab/**` e observar o workflow.
- Passo 2: provocar uma quebra de propósito (um teste falhando) e conferir que a CI fica vermelha.
- Passo 3: ajustar Node 22 / caminhos / tempo; testes de navegador só por `workflow_dispatch`.

### Tarefa 8: #06 e #03 (dependem de decisão)

Não iniciar sem o responsável definir (a) as fases de VFX de cada Move e (b) o desenho do Workbench (viewport dominante, comparação A/B lado a lado). Registrar a decisão em `docs/` antes de editar.

---

**Validação do plano:** cada tarefa termina com os testes dela + `npx tsc --noEmit -p prototypes/combat-lab/tsconfig.json` + `npm run build:combat-lab`; ao fim de todas, `npm run verify` (hoje bloqueado por `skills:check` e `solid-vfx`).
