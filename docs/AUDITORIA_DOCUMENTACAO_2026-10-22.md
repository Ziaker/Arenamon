# Auditoria de documentação — 22/10/2026

Base: `main` @ `dff532f` (v1.18.0). Método: `git fetch --prune`, `git merge-base --is-ancestor`, comparação de arquivos entre branches e `main`, leitura do código (`sim/`, `view/`, `ui/`), verificador de links relativos do portal e dos `.md`, `gh pr/issue`. **Esta auditoria não executou a suíte completa de navegador nem `npm run verify`**; os resultados de teste estão em `docs/VERIFICACOES.md`.

## 1. Documentos × código

| Documento | O que dizia | Realidade (evidência) | Ação |
|---|---|---|---|
| `docs/moves-nao-iniciados/README.md` | Emerging Stone «implementação não iniciada»; 13 Moves «em execução»; 5 genéricos «proposta» | Os 15 Moves registrados em `sim/moves/standard.js` + `new-moves.js` (`NEW_MOVE_IDS` = 13); testes `moves-<id>.test.mjs` | Tabela e aviso atualizados |
| `…/5_MOVES_GENERICOS_PROMPT.md` | «Não implementado» | Lunge, Guard Break, Feint, Riposte, Second Wind existem em `sim/moves/` | Banner de status |
| `…/EMERGING_STONE_PROMPT_IMPLEMENTACAO.md` | «Implementação não iniciada» | `sim/moves/emerging-stone.js`, `sim/stone.js` | Banner de status |
| `…/PROMPT_IMPLEMENTACAO_MOVES_NOVOS.md` | «Em execução em `feat/moves-novos`» | Branch integrada à `main` | Banner de status |
| `docs/MOVES_GENERICOS_CATALOGO.md` | «Não implementado» | Quick Attack, Swift, Harden, Spikes e Bounce implementados (v1.14.0) | Banner de status |
| `docs/MUSHROOM_MOVES_DECISOES.md` | Bullet Punch e Sand Wave «não implementados» | Implementados; Body Slam sem gameplay especificado | Banner de status |
| `docs/MOVES_DECISOES_RODADAS.md` | «Não é autorização para implementar» | Reflect/Psyshock/PL/IA implementados | Banner de status |
| `docs/PLANO_IMPLEMENTACAO_REFLECT_PSYSHOCK.md` | «Fases 1–7 aguardam» | Fases 1–7 entregues (`feat/moves-fase1…7` integradas) | Banner de status |
| `prototypes/combat-lab/MOVIMENTOS.md` | «A IA ainda não usa movimentos especiais» | `sim/ai-moves.js` e `sim/ai-new-moves.js` | Corrigido; seção nova «Moves no ar» |
| `docs/REGRAS_CRIACAO_MOVES.md` | sem regra de uso no ar | `sim/air.js` (v1.18.0) | Norma nova no §11 |
| `docs/INDICE_MODULOS.md` | sem `air.js`, `calibration-base.js`, `riposte-fx.js`, `hover-tip.js` | Módulos existem | Linhas acrescentadas |
| `docs/STATUS_PROJETOS_E_BRANCHES.md` | estado de 16/10 e tabela de 14/10 | Muito desatualizado (ver §2) | Seção 0 reescrita (22/10) |
| `docs/ROADMAP_COBERTURA.md` | «Movimentos/hit stun: N» (13/10, jogo legado) | Existem no laboratório | Marcado como histórico |
| `docs/PATCH_NOTES.md` | só no branch `docs/patch-notes` (até v1.10.0) | — | Integrado e estendido até a v1.18.0 |
| `docs/VERIFICACOES.md` | última execução 16/10 | — | Execução de 22/10 registrada, com o que **não** foi rodado |
| `docs/CALIBRACAO_BASE_V8.md` | 158 linhas | 184 linhas após a 2ª exportação | Atualizado na rodada anterior |

## 2. Branches, PRs e issues

Remotas: **116 integradas** à `main` e **32 não integradas**.

| Item | Estado | Observação |
|---|---|---|
| PR #60 `feat/tackle-ajustes-slam-carga` | aberto, **branch já é ancestral da `main`** | Pode ser fechado (conteúdo integrado). Não fechei. |
| PR #58 `docs/patch-notes` | aberto | Conteúdo agora em `docs/PATCH_NOTES.md` (estendido); o PR pode ser fechado. |
| PR #100 `fix/collision-overhaul-stage1` (rascunho) | aberto | Implementação paralela da etapa 1 (`solid-contact.js`, `world.js`); a `main` tem o overhaul de colisões completo (fases 1–7, v1.15.8–1.15.17). Provavelmente superada; decisão do responsável. |
| PR #94 `claude/elegant-carson-vzdxvo` (rascunho) | aberto | A variante D «Direcional» já está em `view/vfx.js` na `main`; conferir diferenças antes de fechar. |
| PRs #98 e #99 (rascunhos) | abertos | Propostas **não aprovadas** (Responsive Movement V2; 5 melhorias de game feel). **GF-03 (coyote time + jump buffer) já existe no código** (salto Plano D); as demais continuam propostas. Os documentos só existem nas branches; não foram trazidos para a `main`. |
| Issues #95, #96, #97 | abertas | Ledge Grab, DI e Wall Tech: propostas não aprovadas. |
| `codex/physics-colliders` | não integrada | Docs e testes de regressão de colisor (`COLISOES_HITBOX_PLATAFORMAS.md`, `collision-regression.*`) ausentes na `main`; sobrepõe o overhaul. Decisão pendente. |
| `codex/sand-stone-lab` | ativa, não integrada | Atelier de VFX (Sand Wave, Emerging Stone, Swift, Psyshock). **Não integrar sem pedido**; trabalho sem commit no checkout oficial. |
| `chore/ci-runner-mosh` | não integrada | Workflows `verify.yml` / studio e conversor Mosh FBX→GLB ausentes na `main`. |
| `codex/passive-ability-ui`, `codex/tackle-limb-smear`, `codex/tackle-squash-stretch`, `feat/combat-lab-v7` | «não integradas» pelo Git, mas **os módulos existem na `main`** (`view/passive-abilities.js`, `smear-mesh.js`, `squash-stretch.js` e testes) | Entraram por outro caminho (histórico reescrito/squash); os commits em si não são ancestrais. Seguro tratar como integradas; as branches podem ser arquivadas. |
| Studio/rigging e Etapa A (≈ 15 branches de 13–15/10) | não integradas | O Studio não foi tocado. `feat/combat-core-etapa-a`, `feat/game-etapa-a`: o jogo oficial é o laboratório (o porte para `prototypes/game` não é pedido). |

## 3. Achados fora dos documentos

- **Portal com links mortos na `main`:** `ABRIR_ARENAMON.html` e `HTMLS_ARENAMON.html` apontam para `prototypes/croagunk/dist/croagunk-laboratorio.html`, mas `prototypes/croagunk/` não está versionado na `main` (existe só na pasta local oficial). Os links para `dist/` dos demais protótipos só funcionam depois de `npm run build` (arquivos gerados, ignorados pelo Git).
- **Links absolutos de máquina** (`file:///c:/Users/zerke/...`) em `AUDITORIA_CAMERA_CINEMATICA_ZZZ.md`, `CAMERA_CINEMATICA_ZZZ.md` e `relatorio-auditoria-rig-croagunk.md`: funcionam só neste computador.
- **Checkout oficial:** o código-fonte da pasta oficial continua na branch `codex/sand-stone-lab` (v1.15.5 + trabalho sem commit); só o `dist/` foi atualizado para a v1.18.0. Recompilar ali volta ao código antigo até a `main` ser trazida para esse checkout.
- **Sem verificação visual:** nenhum recurso das versões 1.16–1.18 foi visto na tela por quem escreveu estes documentos.
- **Pendências de produto** (sem alteração): gameplay do Body Slam; IA, SFX e homologação dos 13 Moves; contra-golpe aéreo do Riposte e Emerging Stone no ar sem teste; faixa de montagem em caixas de 2,2 m.

## 4. O que **não** foi alterado

Nenhum código de jogo, PR, issue ou branch foi fechado, apagado ou movido. O Studio, o jogo legado e o checkout oficial não foram tocados.
## 5. Não auditados nesta rodada

Documentos do Animation Studio e do rigging (`CONTRATO_TECNICO_RIGGING.md`, `relatorio-auditoria-rig-croagunk.md`), de câmera cinemática, VFX (`VFX_*.md`), passivas (`PASSIVAS_*.md`), HUD (`HUD_*.md`), animações, `prototypes/combat-lab/README.md`, `OVERHAUL.md` e `CALIBRACAO.md`, e os documentos de decisão de Rodadas do mapa. Eles não foram lidos linha a linha contra o código; só entraram na verificação de links.
