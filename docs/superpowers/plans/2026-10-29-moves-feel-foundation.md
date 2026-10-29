# Moves Feel Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar identidade de animação, fases temporais e feedback de comando dos 19 Moves sem alterar balanceamento nem remover fallbacks existentes.

**Architecture:** Criar contratos puros e aditivos para identidade visual e fases efetivas, mantendo o controlador como autoridade mecânica. Integrar a visão somente depois que os contratos estiverem cobertos por testes, com fallback integral ao caminho legado por slot.

**Tech Stack:** JavaScript ES modules, Three.js 0.186, Node test scripts, esbuild, HTML autocontido.

**Spec:** `docs/superpowers/specs/2026-10-29-moves-feel-foundation-design.md`

## Global Constraints

- Preservar integralmente todas as funcionalidades, Moves, painéis, sliders, eventos, fallbacks e telemetria existentes.
- Não alterar dano, stamina, cooldown, alcance, Power Level, IA ou regras de permissão.
- Não sobrescrever mudanças locais existentes em `characters.js`, `animation-profile.js`, `animation-editor.js` ou arquivos relacionados.
- Todo valor ajustável pelo usuário permanece acessível pela interface.
- O build final deve existir em `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html` e ser acessível por `JOGAR_ARENAMON.html`.

## Review Focus

- Move sem clipe específico deve usar exatamente a cadeia de fallback legada; coberto na Task 1.
- Mesmo Move trocado de slot deve manter identidade específica, mas fallback deve acompanhar o novo slot; coberto na Task 1.
- Timeline sem evento de hit ou com Charge não pode inventar janela ativa; coberto na Task 2.
- Comando negado ou bufferizado não pode cobrar recurso nem disparar feedback de execução; coberto na Task 3.
- Perfis antigos e mudanças simultâneas no editor de animação não podem ser sobrescritos; revisão de diff obrigatória antes das Tasks 1 e 4.

---

### Task 1: Contrato de identidade visual por Move

**Files:**
- Create: `prototypes/combat-lab/src/sim/move-presentation.js`
- Create: `prototypes/combat-lab/test/move-presentation.test.mjs`
- Modify: `prototypes/combat-lab/src/sim/moves.js`

**Interfaces:**
- Consumes: definição registrada do Move, id do Move, slot `0..3` e fase `charge | release | action`.
- Produces: `presentationActionCandidates(def, slot, phase): string[]` e campo declarativo opcional `presentation` na definição do Move.

- [ ] **Step 1: Revisar o diff vivo dos arquivos de animação**

Run: `git diff -- prototypes/combat-lab/src/view/characters.js prototypes/combat-lab/src/sim/animation-profile.js prototypes/combat-lab/src/ui/animation-editor.js`
Expected: leitura completa; nenhuma edição desta tarefa nesses arquivos.

- [ ] **Step 2: Escrever o teste inicialmente falho**

Testar que `presentationActionCandidates({id:'quick-attack', presentation:{action:'quick_attack'}}, 2, 'action')` retorna `['quick_attack', 'move_3', 'tackle', 'idle']`; sem `presentation`, retorna `['move_3', 'tackle', 'idle']`; Charge com chave específica preserva os fallbacks atuais.

- [ ] **Step 3: Rodar o teste e confirmar falha**

Run: `node prototypes/combat-lab/test/move-presentation.test.mjs`
Expected: FAIL por módulo/função ausente.

- [ ] **Step 4: Implementar o resolvedor puro**

Adicionar `presentationActionCandidates(def: object, slot: number, phase: string): string[]`, removendo duplicatas e limitando slot a `0..3`. Apenas validar o novo objeto opcional em `validateMove`; não alterar definições individuais ainda.

- [ ] **Step 5: Rodar teste focal**

Run: `node prototypes/combat-lab/test/move-presentation.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit isolado**

Run: `git add prototypes/combat-lab/src/sim/move-presentation.js prototypes/combat-lab/test/move-presentation.test.mjs prototypes/combat-lab/src/sim/moves.js && git commit -m "feat(moves): add stable presentation identity contract"`

### Task 2: Projeção única das fases efetivas

**Files:**
- Create: `prototypes/combat-lab/src/sim/move-phases.js`
- Create: `prototypes/combat-lab/test/move-phases.test.mjs`
- Modify: `prototypes/combat-lab/src/sim/move-timeline.js`

**Interfaces:**
- Consumes: `effectiveMove(def)` e seus eventos/tackle/group.
- Produces: `effectiveMovePhases(def, group): {duration, startup, active[], recovery, cancel, invulnerable[], impacts[]}`.

- [ ] **Step 1: Escrever testes inicialmente falhos**

Cobrir Move com efeito ao final do cast, Move com efeito no tick zero, Move-Tackle com `hitStart/hitEnd/chainAfter`, Charge sem duração fixa e Move sem hit.

- [ ] **Step 2: Confirmar falha**

Run: `node prototypes/combat-lab/test/move-phases.test.mjs`
Expected: FAIL por função ausente.

- [ ] **Step 3: Implementar projeção sem mudar regras**

Criar `effectiveMovePhases(def, group)` usando somente marcas que já existem na definição efetiva. Ausência de dados resulta em fase vazia, nunca inferência de dano.

- [ ] **Step 4: Fazer `buildMoveTimeline` consumir a projeção**

Substituir cálculos duplicados apenas quando a saída for equivalente; preservar labels, ticks e cues públicos.

- [ ] **Step 5: Rodar testes focais e regressão da timeline**

Run: `node prototypes/combat-lab/test/move-phases.test.mjs; node prototypes/combat-lab/test/move-timeline.test.mjs`
Expected: PASS em ambos.

- [ ] **Step 6: Commit isolado**

Run: `git add prototypes/combat-lab/src/sim/move-phases.js prototypes/combat-lab/test/move-phases.test.mjs prototypes/combat-lab/src/sim/move-timeline.js && git commit -m "refactor(moves): unify effective combat phases"`

### Task 3: Feedback observável de comando

**Files:**
- Create: `prototypes/combat-lab/src/sim/move-command-feedback.js`
- Create: `prototypes/combat-lab/test/move-command-feedback.test.mjs`
- Modify: `prototypes/combat-lab/src/sim/controller/ctrl-moves.js`
- Modify: `prototypes/combat-lab/src/sim/move-state.js`

**Interfaces:**
- Consumes: eventos já produzidos por `pressSkill`, `bufferedSkill`, mira e Charge.
- Produces: `moveCommandFeedback(event): {kind:'accepted'|'buffered'|'denied', move, slot, reason, ttl}` e estado efêmero legível pela UI.

- [ ] **Step 1: Escrever testes inicialmente falhos**

Cobrir aceite, buffer e negação; garantir que o adaptador não altera stamina, cooldown, action, charge ou buffers.

- [ ] **Step 2: Confirmar falha**

Run: `node prototypes/combat-lab/test/move-command-feedback.test.mjs`
Expected: FAIL por função ausente.

- [ ] **Step 3: Implementar adaptador puro e estado efêmero**

Adicionar `moveCommandFeedback(event)` e armazenar somente o último feedback com TTL; reutilizar os eventos e motivos existentes, sem duplicar permissões.

- [ ] **Step 4: Expor o estado em `slotStatus`**

Adicionar campo opcional `feedback` ao slot correspondente, preservando todos os estados e textos atuais.

- [ ] **Step 5: Rodar testes focais do controlador/HUD**

Run: `node prototypes/combat-lab/test/move-command-feedback.test.mjs; node prototypes/combat-lab/test/moves-ui.test.mjs; node prototypes/combat-lab/test/moves-order.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit isolado**

Run: `git add prototypes/combat-lab/src/sim/move-command-feedback.js prototypes/combat-lab/test/move-command-feedback.test.mjs prototypes/combat-lab/src/sim/controller/ctrl-moves.js prototypes/combat-lab/src/sim/move-state.js && git commit -m "feat(moves): expose immediate command feedback"`

### Task 4: Integração aditiva na visão

**Files:**
- Modify: `prototypes/combat-lab/src/view/characters.js`
- Modify: `prototypes/combat-lab/src/sim/move-timeline.js`
- Test: `prototypes/combat-lab/test/animation.test.mjs`
- Test: `prototypes/combat-lab/test/move-timeline.test.mjs`

**Interfaces:**
- Consumes: `presentationActionCandidates` da Task 1 e `effectiveMovePhases` da Task 2.
- Produces: seleção de clipe específico quando presente, com fallback legado intacto.

- [ ] **Step 1: Reabrir status e diff antes de tocar `characters.js`**

Run: `git status --short; git diff -- prototypes/combat-lab/src/view/characters.js`
Expected: mudanças de outras sessões identificadas e preservadas; se o arquivo continuar mudando, pausar esta Task e entregar Tasks 1–3 primeiro.

- [ ] **Step 2: Escrever teste de integração inicialmente falho**

Cobrir clipe específico existente, clipe específico ausente, troca de slot e Reflect/Psyshock legados.

- [ ] **Step 3: Integrar resolvedor na seleção de animação**

Trocar somente a construção da lista de candidatos; não alterar reprodução, blend, velocidade, root motion ou editor.

- [ ] **Step 4: Rodar testes focais**

Run: `node prototypes/combat-lab/test/animation.test.mjs; node prototypes/combat-lab/test/move-timeline.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit isolado**

Run: `git add prototypes/combat-lab/src/view/characters.js prototypes/combat-lab/src/sim/move-timeline.js prototypes/combat-lab/test/animation.test.mjs prototypes/combat-lab/test/move-timeline.test.mjs && git commit -m "feat(moves): select animation by move identity"`

### Task 5: Acesso, documentação, build e verificação

**Files:**
- Modify: `docs/GAMEDEV_SKILLS.md`
- Modify: `docs/PATCH_NOTES.md`
- Modify: `docs/INDICE_VIVO_MOVES.md` (somente via gerador)
- Verify: `ABRIR_ARENAMON.html`, `JOGAR_ARENAMON.html`, `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html`

**Interfaces:**
- Consumes: Tasks 1–4 completas.
- Produces: build oficial acessível e registro da mudança.

- [ ] **Step 1: Atualizar documentação e índice gerado**

Registrar arquitetura, fallbacks preservados, limitações e skills usadas; executar `npm run indice` se disponível.

- [ ] **Step 2: Rodar fluxo rápido**

Run: `npm run rapido`
Expected: build, typecheck e testes unitários rápidos aprovados.

- [ ] **Step 3: Rodar teste de navegador focal da área Moves**

Run: `node prototypes/combat-lab/test/moves.browser.mjs`
Expected: PASS.

- [ ] **Step 4: Recompilar explicitamente o Combat Lab**

Run: `npm run build:combat-lab`
Expected: `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html` atualizado.

- [ ] **Step 5: Comparar inventário antes/depois**

Confirmar 19 Moves registrados e todos os portais/painéis/slots anteriores presentes; nenhuma feature removida.

- [ ] **Step 6: Revisar diff e status**

Run: `git diff --check; git status --short`
Expected: sem erro de whitespace; somente arquivos desta entrega selecionados para commit.

- [ ] **Step 7: Commit de documentação e build regenerável**

Run: `git add docs/GAMEDEV_SKILLS.md docs/PATCH_NOTES.md docs/INDICE_VIVO_MOVES.md docs/superpowers/specs/2026-10-29-moves-feel-foundation-design.md docs/superpowers/plans/2026-10-29-moves-feel-foundation.md && git commit -m "docs(moves): document feel foundation"`

