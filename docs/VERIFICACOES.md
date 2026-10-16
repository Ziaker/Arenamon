# Arenamon — Registro de verificações (executadas × pendentes)

Este arquivo separa **o que foi efetivamente executado** do que **permanece pendente**. Registre aqui data, commit-base, comando e resultado; nunca marque como executado o que não foi.

## Execução de 2026-10-16 — branch `chore/arquitetura-indice-testes-checkjs` sobre `main` @ `6bcc26d`

**Ambiente:** Windows 11, Node 25.8, TypeScript 7, Edge/Chromium headless via Playwright, execução em worktree temporário (`.worktrees/arq`, com `node_modules` ligado por junção ao checkout oficial).

### Executado e aprovado

| Verificação | Comando | Resultado |
|---|---|---|
| Tipos (placeholders, game, **combat-lab novo**) | `npm run typecheck` | sem erros |
| Testes sem navegador (game, studio, combat-lab) | `npm run test:unit` | aprovados (~1,5 min) |
| Build de todos os HTMLs | `npm run build` | gerou os 6 artefatos + painel de relatórios |
| **Equivalência dos HTMLs gerados** | build desta branch × build limpo de `origin/main`, SHA-256 | **idênticos byte a byte** nos 9 HTMLs (lab, painel, jogo, importador, placeholders, studio, propostas A/B/C) — as mudanças de tipos/JSDoc não alteram o que o usuário recebe |
| Varredura estática de dependências externas | `npm run check:offline` | autoteste (16 casos que devem falhar, 9 que não) + 10 HTMLs sem referências externas |
| Navegador — combat-lab | `npm run test:combat-lab:browser` | `verify.mjs` 19/19, overhaul 116/116, workspace 43/43, calibration 32/32, diagnostics 21/21 (após 1 falha intermitente, ver abaixo), perf 23/23 e tools 18/18 (estes dois rodados à parte: a cadeia parou na falha do diagnostics) |
| Navegador — jogo, studio, importador, placeholders | `npm run test:game:browser`, `test:studio:browser`, `test:importer`, `test:placeholders` | aprovados (jogo 18 cenários; Animation Studio 20; Rigging Studio 12; importador e placeholders sem falhas) |

**Intermitência registrada:** na primeira passada, `test/diagnostics.browser.mjs` reprovou 1 de 21 verificações (“Negados · aviso curto na arena com o motivo do motor”), enquanto outros comandos rodavam em paralelo na máquina. Reexecutado 4 vezes depois, passou 21/21 todas as vezes. Como os HTMLs são idênticos aos de `origin/main`, a causa não é esta mudança; **a causa raiz não foi investigada** (suspeita: verificação sensível a tempo sob carga). Acompanhar.

### Medição adicional (2026-10-16, `main` @ `bed73b7`)

`npm run measure:sim` (2 execuções): simulação ≈ 7 µs/passo com IA × IA e ≈ 4,5 µs sem a IA do azul, contra 8 333 µs de orçamento a 120 Hz — ver `DESEMPENHO_BASELINE.md`. Não mede GPU/render.

### Fase 0 dos Moves (2026-10-16, `main` @ `badedde`, branch `test/moves-fase0-contrato`)

Executado e aprovado em worktree temporário: `npm run typecheck` (sem erros) e `npm run test:combat-lab:unit` completo (~2 min), incluindo os dois testes novos de caracterização (`moves-contract` 4 verificações; `moves-order` 4 verificações). **Não executado:** testes de navegador, `check:offline` e `verify` completo (nenhum código de jogo, HTML ou `dist` foi alterado nesta fase; só testes, `package.json` e documentação). Resultado-chave: **11 de 12** leituras de `C` testadas ainda alteram entidades já criadas — ver `docs/MOVES_TEST_MATRIX.md`.

### Fase 1 dos Moves — Charge (2026-10-16, branch `feat/moves-fase1-charge` sobre `main` @ `f715b05`)

Executado e aprovado em worktree temporário: `npm run typecheck`; `npm run test:combat-lab:unit` completo (inclui `charge.test` 18 verificações); `npm run test:combat-lab:browser` completo (verify 19/19, overhaul 116/116, workspace 43/43, calibration 32/32, diagnostics 21/21, perf 23/23, tools 18/18); `npm run check:offline`; **impressão digital de lutas IA × IA (6 sementes × 2400 passos) idêntica à da base, ignorando os campos novos do Charge** — sem Moves a partida não mudou. Correções de testes intermitentes (não de código de jogo): `diagnostics.browser` passou a esperar o aviso (e aceitar “buffer expirou” quando o quadro é lento); `verify.mjs` não exige mais que a gravação da IA tática seja estritamente menor que o número de passos. **Não executado:** testes de navegador de jogo/studio/importador/placeholders (nada neles mudou), `verify:workspace` e `verify` completo (worktree), paridade v6 (arquivo ausente).

### Fase 2 dos Moves — Reflect (2026-10-16, branch `feat/moves-fase2-reflect` sobre `main` @ `d0cbd8f`)

Executado e aprovado em worktree temporário: `npm run typecheck`; `npm run test:combat-lab:unit` completo (inclui `reflect.test` 16 verificações; `moves.test` agora garante que só `moves/standard.js` registra e só `main.js` chama `registerStandardMoves()`); `npm run test:combat-lab:browser` completo (verify 19/19, overhaul 116/116, workspace 43/43, calibration 32/32, diagnostics 21/21, perf 23/23, tools 18/18, **moves 5/5 novo**: teclado real A, offline, sem erros); `npm run check:offline`; impressão digital de lutas IA × IA **idêntica** à da base (sem Moves a partida não muda). **Defeito real encontrado só no navegador e corrigido:** a telemetria tratava todo evento como contato entre lutadores e quebrava com eventos sem alvo (início de carga, criação de entidades); agora ignora eventos sem alvo. **Não executado:** `verify:workspace`/`verify` completo (worktree), navegadores de jogo/studio/importador/placeholders (nada mudou), paridade v6 (arquivo ausente), **aprovação visual/jogável do Reflect (é sua, M28.9)**.

### NÃO executado / pendente

- `npm run verify:workspace`: **recusa worktrees por desenho** (exige o checkout oficial). Deve ser rodado na pasta oficial quando ela estiver livre.
- `npm run verify` completo numa só passada, na pasta oficial.
- `test/parity.mjs` (paridade com o v6): **ignorado** — o arquivo `arenamon-combate-laboratorio-v6.html` não existe na máquina (o teste informa e sai com sucesso). Paridade com o v6 **não comprovada** nesta execução.
- Abertura manual dos HTMLs por duplo clique em **Chrome** e **Edge** (alvos definidos pelo diretor); os testes automatizados usam Edge/Chromium com `file://`.
- Desempenho real em GPU: **não medido** (nenhuma otimização foi proposta ou feita).
- Firefox e Safari: fora dos requisitos iniciais; não testados.
- Testes locais com modelos do usuário (`test/local-character.mjs`, `studio/test/local-shot.mjs`): dependem de GLBs fora do Git.
- Workflows do GitHub Actions: não foram acionados por esta mudança (o PR não tinha checks configurados para estes comandos).

## Como registrar a próxima execução

Copie a seção acima, troque data/commit/ambiente e preencha as duas listas. Se um teste for intermitente, registre o nome, a frequência observada e se a causa foi investigada.
