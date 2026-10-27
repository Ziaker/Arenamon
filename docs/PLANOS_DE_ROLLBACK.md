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
