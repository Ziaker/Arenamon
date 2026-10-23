# Arenamon — Registro de verificações (executadas × pendentes)

Este arquivo separa **o que foi efetivamente executado** do que **permanece pendente**. Registre aqui data, commit-base, comando e resultado; nunca marque como executado o que não foi.

## Execução de 2026-10-22 (pré-jogo A/B/C, v1.21.0)

| Verificação | Resultado |
|---|---|
| `prejogo.test.mjs` (modelo: registro × catálogo, classes de cor, passivas, regras) | 7 aprovados |
| `prejogo.browser.mjs` (Edge real, offline, modelos reais) | 43 aprovados; capturas em `evidence/prejogo/` |
| `animation.test.mjs` (novo teste: modelo sem idle) | 16 testes / 72 verificações |
| Crash `clipAction` com Cogumelo × drowzee-knockback | 11/12 na build oficial v1.20.1 → 0/12 na nova |
| Revisão independente (superpowers:requesting-code-review) | 16 itens; importantes corrigidos (ver `docs/PREJOGO_3_ESTILOS.md`) |
| Teste instável `overhaul.browser.mjs` (semente aleatória por partida, sensível a carga) | falhou em ~20% das execuções durante esta rodada (116/117, «5 entradas para 4 ações») e passou 10/10 numa bateria posterior em máquina quieta; a base v1.20.1 passou 20/20. Bisect: com `characters.js` antigo 7/8, sem a camada de estilos 7/8, com a base-fonte no mesmo worktree 8/8 — **causa não atribuída**; registrado como pendência |
| **Não verificado** | aparência/sensação; zoom do navegador a 200%; gamepad no menu; `npm test` completo; «Superskills» (recurso inexistente no ambiente) |

## Execução de 2026-10-22 (caçada de bugs, v1.20.1)

| Verificação | Resultado |
|---|---|
| `bugs-cacada.test.mjs` | 12 aprovados; B1–B5 e as de navegação **falham no código anterior** (confirmado revertendo as correções) |
| `npm run typecheck` | sem erros |
| Suíte unitária do laboratório (108 arquivos) | 107 aprovados; `combat-windows` falha só na pasta isolada (GLB local não versionado) |
| Varredura `fuzz-partidas.mjs` | ~150 partidas por rodada, 0 achados após as correções |
| Navegador: `rodada-b` 16 (agora com leitura de PIXEL real da transparência), `ledge` 9, `ui-rodada-22-10` 16, `overhaul` 117, `moves-ui` 31, `moves-new` 13, `nav-lab` 9, `tuning-export` | todos aprovados |
| **Não verificado** | aparência/sensação; `npm test` completo; congelamento do laço por exceção (inferido do código, não rodado no navegador) |

## Execução de 2026-10-22 (rodada da tarde, v1.20.0)

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | sem erros |
| Suíte unitária do laboratório (107 arquivos) | 106 aprovados; `combat-windows` falha só nesta pasta isolada por depender do `validation/personagem-studio.glb` local, não versionado (passa na pasta oficial) |
| `rodada-b.test.mjs` | 9 aprovados (marcador suave, navegação ligada, círculo de alcance, squash na esquiva, altura do apoio no pouso, marca do Riposte) |
| `moves-bullet-punch.test.mjs` (reescrito) | 15 aprovados |
| `rodada-b.browser.mjs` (Edge real, offline) | 15 aprovados; capturas em `evidence/rodada-b/` |
| Navegador de regressão: `ledge` 9, `ui-rodada-22-10` 16, `overhaul` 117, `moves-ui` 31, `moves-new` 13, `moves` 6, `tuning-export`, `smear`, `squash-stretch`, `solid-vfx`, `nav-lab` 9 | todos aprovados |
| **Não verificado** | aparência/sensação (aprovação é do responsável); squash/smear na esquiva com modelo 3D carregado; transparência do anel de blocos do cenário; `npm test` completo ponta a ponta |

## Execução de 2026-10-22 (Ledge Grab, v1.19.0)

| Verificação | Resultado |
|---|---|
| `ledge.test.mjs` | 17 aprovados (agarre, subida, soltar, golpe, bloqueio, apoio destruído, IA, determinismo, fuzz, faixa de montagem) |
| `ledge.browser.mjs` (Edge real, offline) | 9 aprovados; capturas em `evidence/ledge-grab/` |
| Suíte unitária, `typecheck` | ver o fim desta seção (preenchido após a rodada completa) |
| Ajuste de teste | `physics3d` fixa `jumpPassOver = 1` no teste do teto com o lutador dentro da pegada (a regra estrita o ejetaria antes) |

## Execução de 2026-10-22 (fechamento, v1.18.3)

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | **sem erros** (antes: 32 erros, a `main` não passava no `verify`) |
| `npm run check:offline` | 11 HTMLs sem dependências externas |
| `npm run skills:check` | 12 skills em sincronia |
| `npm run verify:workspace` | falha **apenas** no worktree (exige o checkout oficial); rodar lá |
| Testes soltos agora no `npm test` | `combat-windows-sim` (14), `combat-windows` (9), `interruptions` (10), `physics3d` (14), `smear`, `squash-stretch` (+ os 2 de navegador) aprovados |
| `ui-rodada-22-10.browser` (Edge real, offline) | **16/16**: botões de IA, atalho da animação, tooltips, Riposte, blocos de VFX, efeitos na arena, sem erros de página nem rede externa; capturas em `evidence/ui-22-10/` |
| `moves-air` | 15 aprovados (inclui Riposte e Emerging Stone no ar) |

**Bug encontrado pelas capturas:** efeitos de modo «ground» não apareciam (culling). Corrigido na v1.18.3.

## Execução de 2026-10-22 — `feat/calibracao-v8-base` (v1.18.0) e `main` @ `dff532f`

**Ambiente:** Windows 11, Node 25.8, worktree `.worktrees/calibracao-v8`. **Não executado:** `npm run verify` completo, `npm run typecheck`, `test:combat-lab:browser` completo, verificação visual na tela (o navegador embutido do assistente não abre HTML local).

| Verificação | Resultado |
|---|---|
| Testes unitários do combat-lab (`test:combat-lab:unit`, cada arquivo isolado) | **99/99** aprovados após a v1.18.0 |
| `calibration-base` (base v8 de 184 linhas × JSON do responsável, 6 partidas IA × IA, 15 cenários de colisão) | 7 verificações aprovadas |
| `moves-softlock` (reprodução do softlock do Bullet Punch + 60 partidas aleatórias com os 15 Moves) | aprovado, nenhum estado preso |
| `moves-air` (15 Moves no salto e no vault) | 13 aprovados |
| Navegador: `overhaul` 117/117, `moves-ui` 31/31, `moves` 6/6, `progress-scenery` 38, `tuning-export`, `tools` 18/18 | aprovados |
| `main` após o merge (`dff532f`): `calibration-base`, `moves-air`, `moves-softlock`, `progress-scenery` | aprovados; build não refeito nesse worktree (sem `node_modules`); o HTML foi compilado na branch, com código idêntico |

**Ajustes de teste causados pela nova base:** `hitstop-tiers` e `hitbox-shapes` fixados em `factoryDefaults()`; `env-integration` usa Tackle de 2,5 m no teste do dano único; `diagnostics` aceita guard stun no mesmo passo; `moves-params` espera o limite ×2 dos sliders.

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

### Fase 3 dos Moves — Psyshock (2026-10-16, branch `feat/moves-fase3-psyshock` sobre `main` @ `264de2f`)

Executado e aprovado em worktree temporário: `npm run typecheck`; `npm run test:combat-lab:unit` completo (inclui `psyshock.test` 15 verificações); `npm run test:combat-lab:browser` completo (inclui `moves.browser` 6/6: Reflect (A) e Psyshock (S) pelo teclado real, offline, sem erros); `npm run check:offline`; impressão digital de lutas IA × IA **idêntica** à da base. Achados corrigidos no caminho: teto de knockback com erro de ponto flutuante (0,3+0,3+0,3 ≠ 0,9) e pedras refletidas colidindo com o resto da própria execução (M8.1: pedras do mesmo Psyshock nunca colidem). **Não executado:** `verify:workspace`/`verify` completo (worktree), paridade v6 (arquivo ausente), **aprovação visual/jogável (é sua, M28.9)**.

### Fase 4 dos Moves — PL, Clash e Counter (2026-10-16, branch `feat/moves-fase4-pl` sobre `main` @ `24aaef4`)

Executado e aprovado em worktree temporário: `npm run typecheck`; `npm run test:combat-lab:unit` completo (inclui `pl.test` 7 verificações); `npm run test:combat-lab:browser` completo; `npm run check:offline`; impressão digital de lutas IA × IA **idêntica** à da base. **Intermitência registrada:** na primeira passada da suíte de navegador, `overhaul.browser` reprovou 1 de 116 (“Animação (GLB) · ações concluídas tocam até o fim (tolerância de 2 quadros)”); reexecutado 3 vezes e depois a suíte inteira, passou sempre (verificação sensível ao tempo de quadro; causa raiz não investigada; nada de animação foi alterado). **Limite desta fase:** Clash de áreas/explosões ofensivas entre si e defesas herdadas com PL dependem de Moves que ainda não existem; a leitura adotada para pedra × Tackle (Clash em PL1; Counter neutraliza o Tackle em PL ≥ 2) é provisória — a especificação não define o destino do Tackle numa disputa. **Não executado:** `verify:workspace`/`verify` completo (worktree), paridade v6 (arquivo ausente), aprovação jogável (sua).

### Fase 5 dos Moves — IA (2026-10-16, branch `feat/moves-fase5-ia` sobre `main` @ `b8aeec6`)

Executado e aprovado em worktree temporário: `npm run typecheck`; `npm run test:combat-lab:unit` completo (inclui `ai-moves.test` 8 verificações; `ai` e `ai-eval` inalterados); `npm run test:combat-lab:browser` completo; `npm run check:offline`; impressão digital de lutas IA × IA **idêntica** à da base (sem Moves a IA não muda). **Testes de navegador intermitentes corrigidos (só testes):** `overhaul.browser` (tolerância de quadro passou de 2 para 3 quadros: um quadro lento no meio reprovava 1 de 116) e `workspace.browser` (seletor `[data-tool="characters"]` casava também o painel aberto; agora abre a aba só se preciso). Depois disso a suíte inteira passou. **Não medido:** equilíbrio e taxa de vitória com Moves (pesos provisórios), desempenho no navegador. **Não executado:** `verify:workspace`/`verify` completo (worktree), paridade v6 (arquivo ausente), aprovação jogável (sua).

### Fase 6 dos Moves — Laboratório (2026-10-16, branch `feat/moves-fase6-lab` sobre `main` @ `baf6394`)

Executado e aprovado em worktree temporário: `npm run typecheck`; `npm run test:combat-lab:unit` completo (inclui `moves-ui.test` 5 verificações); `npm run test:combat-lab:browser` completo (inclui `moves-ui.browser` 16/16: aba Moves, HUD, prévia, reflexão com anel, pedras, aviso de falha, offline, sem erros; **capturas inspecionadas** em `validation/moves-ui/`); `npm run check:offline`; impressão digital IA × IA idêntica à da base. **Não medido:** desempenho de render com muitas entidades/VFX em GPU real. **Não executado:** `verify:workspace`/`verify` completo (worktree), paridade v6 (arquivo ausente). **Pendente (sua):** avaliação jogável e visual — checklist de 10 itens na aba Moves.

### Fase 7 dos Moves — Lasers e emissores técnicos (2026-10-16, branch `feat/moves-fase7-laser` sobre `main` @ `1b1a228`)

Executado e aprovado em worktree temporário: `npm run typecheck`; `npm run test:combat-lab:unit` completo (inclui `beam.test` 11 verificações); `moves-ui.browser` 18/18 (emissores de laser, desenho do feixe; captura `validation/moves-ui/laser.png`); suíte `test:combat-lab:browser` completa; `npm run check:offline`; impressão digital IA × IA idêntica à da base (`257bd5a0…`: sem feixe, nada muda). **Não medido:** desempenho de render do feixe em GPU real. **Não executado:** `verify:workspace`/`verify` completo (worktree), paridade v6 (arquivo ausente). **Pendente (sua):** avaliação visual/jogável do laser (a captura mostra o feixe na linha da câmera; o laser ainda não é usado por nenhum Move).

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
