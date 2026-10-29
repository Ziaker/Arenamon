# Planos de Rollback e Procedimentos de Reversão Segura

**Fase F9 — Limpeza e Salvaguarda Operacional**  
**Projeto Arenamon — Laboratório de Combate**

---

## 1. Visão Geral e Princípio de Reversibilidade

Nenhuma alteração de código realizada durante o plano P0 introduziu mudanças destrutivas na arquitetura, esquemas de dados ou formatos de save/load. Todas as correções foram pontuais, retrocompatíveis e validadas por testes unitários e determinísticos.

Caso qualquer comportamento precise ser revertido isoladamente sem afetar as demais correções, utilize os procedimentos atômicos abaixo.

---

## 2. Inventário de Arquivos Modificados

| Arquivo Modificado | Subsistema | Responsabilidade da Modificação | Impacto de Reversão |
|---|---|---|---|
| `prototypes/combat-lab/src/sim/controller/ctrl-update.js` | Controle e Recuperação | Correção EST-01 (saída de knockRecovery) e EST-05 (limpeza no KO). | Lutador voltará a piscar em hitstun ao concluir pouso/recuperação. |
| `prototypes/combat-lab/src/sim/combat.js` | Resolução de Combate | Correção EST-02 (Guard Break preservado) e EST-03 (Footstool stagger/normal). | Guard break voltará a sofrer recoil e ser anulado por bloqueio. |
| `prototypes/combat-lab/src/sim/controller/ctrl-moves.js` | Golpes e Cargas | Correção EST-04 (fallback de step em cancelCharge). | Possibilidade de TypeError caso um golpe sem step seja cancelado. |
| `prototypes/combat-lab/src/sim/world.js` | Projéteis e Entidades | Correção ARC-01 (perfuração pierce) e VFX-01 (coordenadas tridimensionais pré-morte). | Projéteis com pierce voltarão a morrer no 1º alvo; anéis de quebra de barreira sumirão. |
| `prototypes/combat-lab/src/sim/map/map-collision.js` | Colisão com Cenário | Correção VFX-02 (destructibleSplat com normal e coordenadas). | Colisão contra destrutíveis deixará de emitir normal para a câmera. |
| `prototypes/combat-lab/src/view/vfx/contract.js` | Contratos Visuais | Correção VFX-05 (mapeamento estendido em classifyVisualType). | Eventos espaciais voltarão a cair no fallback `'hit'`. |
| `prototypes/combat-lab/src/view/characters.js` | Apresentação 3D | Correção EST-06 (normalização de stunMax e clamp em [0, 1]). | Stuns longos voltarão a travar o frame inicial da animação. |
| `prototypes/combat-lab/src/view/world-view.js` & `view.js` | Motores de VFX e Reset | Correção VFX-03 (wallSplat ambiental) e VFX-07 (limpeza em reset). | Impactos ambientais em parede não darão shake; malhas acumularão na cena após reset. |
| `prototypes/combat-lab/src/sim/moves/sand-wave/sand-wave.vfx.js` | Piloto Sand Wave | População de `onEvent` com rajada de poeira. | Onda de areia voltará a ter `onEvent` vazio. |
| `prototypes/combat-lab/src/sim/moves/water-pulse/water-pulse.vfx.js` | Piloto Water Pulse | Gatilhos canônicos adicionados em `onEvent`. | Impacto d'água só disparará em eventos antigos. |

---

## 3. Procedimento de Rollback Atômico via Git

Para restaurar um arquivo específico ao estado da branch `main` pré-P0 sem afetar os outros:

```bash
# Exemplo: reverter apenas as modificações de combat.js
git checkout 9175bfe23342854a7a1820e83ea3605f0346d5bc -- prototypes/combat-lab/src/sim/combat.js

# Recompilar o bundle após qualquer reversão
npm run rapido:build
```

---

## 4. Limpeza de Artefatos Temporários

- Scripts de teste e migração em `scratch/` (`scratch/apply_p0_fixes.mjs`, `scratch/patch_*.mjs`) foram mantidos na pasta de rascunhos para histórico determinístico e podem ser arquivados ou removidos sem afetar o runtime de produção.
- A suíte canônica de testes de regressão permaneceu versionada em `prototypes/combat-lab/test/p0-vfx-states.test.mjs`.
- O bundle oficial `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html` encontra-se 100% atualizado e pronto para uso pelo usuário através de `JOGAR_ARENAMON.html`.

---

## 5. Rollback do overhaul F3–F9 (atualizado em 29/10/2026)

Branch `feat/overhaul-arquitetural-f3-f9`, criado de `feat/wookada-integracao` (`98fbc66` = main `96205a5` + 2 commits do Wookada). Cada fase é um conjunto de commits pequenos. A forma segura de desfazer uma fase é `git revert <hash>` (cria um commit novo e não reescreve histórico), do mais novo para o mais antigo, seguido de `npm run rapido:build` e `npm run rapido`. Não use `git reset --hard` nem `push --force`: o checkout é compartilhado com outras sessões.

| Fase | Commits (do mais antigo ao mais novo) | O que volta ao estado anterior | Risco de reverter |
|---|---|---|---|
| F3 dano e reação | 7e6e914, d4e8560 | Dano e reação calculados de novo em cada chamador; o evento perde `rawDamage/hpDamage/shieldAbsorbed/displacementPolicy` | Alto: F4–F8 dependem dos resolvedores. Reverter só junto com tudo o que vem depois. |
| F3 contactId, permissões, eventos | 769f04e, a7c77dc, bf2b8de, 43354f1, 3e36d48 | `contactId` volta a ser global do módulo; sem `eventId`/normalização | Alto: o despachante de VFX (F5) deduplica por `eventId`. |
| F4 colisões e mapa | 3fb7a64, 536af4b, ad4973b, db5222e | Volta a duplicação de consultas, o `found \|\| rawPos`, a penetração aceita em silêncio e o projétil sem varredura | Médio: os replays de referência continuam iguais (não houve mudança de número); o `ai-eval` volta a passar com +19. |
| F5 VFX | e5e52ae, 2f1e5dd, 9dcfcf5, 9abf3d9, 37741e2, 42d5235, afb0e3e, 71536bc | Sem despachante único (desenho duplo quarks + legado), vazamentos no reset, paridade sem ROI, posição dos projéteis no lutador 0/origem | Médio: visual. Afeta o que o jogador vê, não a simulação. |
| F6 Moves | ad32c13, 01ca8d0 | Golpes corpo a corpo e explosão do Seed Bomb sem `move` no evento | Baixo. |
| F7 Editor | a43a487, 60bad42 | Sem matriz/teste de cobertura; órfãos sem o rótulo «(sem efeito)»; Sand Wave com cegueira 0 volta ao erro | Baixo. |
| F8 homologação | 33ef5d5, d7539ac | Sem bateria F8; volta o bug da IA lendo lutadores de outra partida (`setControllerContext`) e o cache de navegação de um mapa só | Médio: o bug multijogo volta. |
| F9 limpeza e entrega | commit da F9 (ver `docs/RELATORIO_OVERHAUL_F0_F9.md`) | Docs, portal, versão 1.43.0, varredura estática endurecida e reset de `penetrationTolerance` | Baixo. |

Commits alheios ao overhaul que estão no mesmo branch (Wookada, menu, HUD, docs) **não** devem ser revertidos junto: `7783962`, `98fbc66`, `5cb4f21`, `4e37b90`, `3b5960f`, `f57e3a9`, `d079833`.
