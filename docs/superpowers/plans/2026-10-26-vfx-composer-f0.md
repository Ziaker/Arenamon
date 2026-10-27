# Arenamon VFX Composer F0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar exclusivamente os contratos e a fundação F0 do Arenamon VFX Composer, sem interface, renderização ou alteração de gameplay.

**Architecture:** Um pacote TypeScript isolado em `prototypes/vfx-composer` define dados autorais, validação defensiva, relógio de seis fases, eventos somente leitura, persistência e orçamentos. O pacote não importa `sim`, Three.js, DOM ou módulos de renderização e é exercitado por testes Node que compilam a fonte real com esbuild.

**Tech Stack:** TypeScript 7, Node.js, esbuild, `node:assert/strict`.

**Spec:** `docs/ARENAMON_VFX_COMPOSER_ESPECIFICACAO_E_PROMPT_CODEX_48_DECISOES.docx`

## Global Constraints

- Executar apenas F0 e parar antes de F1.
- Preservar combate, `Game.step`, hitboxes, dano, invulnerabilidade e renderizadores legados.
- Fases normativas: `start`, `launch`, `body`, `hold`, `finish`, `impact`.
- Autoria em 30 FPS por padrão, selecionável em 24/30/60, sem alterar o passo da simulação.
- Eventos desconhecidos nunca viram `hit`/`impact`.
- Projetos importados não executam código e não aceitam caminhos absolutos ou traversal.
- Componentes compartilhados permanecem fixados por versão.

## Review Focus

- JSON com `NaN`, `Infinity`, campos ausentes ou versão futura deve falhar com diagnóstico claro.
- Versões `1.9` e `1.10` precisam ordenar semanticamente, sem comparação lexical.
- `miss`, `timeout`, `cancel` e evento desconhecido nunca podem escolher `impact`.
- Todas as fases desligadas devem preservar dados e produzir estado invisível explícito.
- Cancelamento e cleanup devem ser idempotentes e determinísticos.

---

### Task 1: Schemas e validação defensiva

**Files:**
- Create: `prototypes/vfx-composer/src/core/types.ts`
- Create: `prototypes/vfx-composer/src/core/validation.ts`
- Create: `prototypes/vfx-composer/test/f0-contracts.test.mjs`
- Create: `prototypes/vfx-composer/tsconfig.json`

**Interfaces:**
- Produces: `validateProject`, `validateRuntime`, `validateEffectBinding`, `VfxProject`, `VfxRuntime`, `EffectBinding`.

- [ ] Escrever testes que rejeitam campos ausentes, não finitos, versão futura, IDs/anchors/triggers inválidos e aceitam fixture canônica.
- [ ] Executar o teste e confirmar falha por exports ausentes.
- [ ] Implementar tipos, limites, diagnósticos por caminho e validação sem dependências externas.
- [ ] Executar teste e typecheck até aprovar.

### Task 2: Versão, migração e persistência

**Files:**
- Create: `prototypes/vfx-composer/src/core/version.ts`
- Create: `prototypes/vfx-composer/src/persistence/serialization.ts`
- Create: `prototypes/vfx-composer/src/persistence/migrations.ts`
- Create: `prototypes/vfx-composer/test/fixtures/canonical-project.json`

**Interfaces:**
- Consumes: `VfxProject`, `validateProject`.
- Produces: `compareVersions`, `serializeProject`, `deserializeProject`, `migrateProject`.

- [ ] Escrever testes para `1.9 < 1.10`, roundtrip estrutural, pinned component imutável, versão futura e JSON perigoso.
- [ ] Confirmar RED.
- [ ] Implementar comparação e persistência canônica com migração explícita.
- [ ] Confirmar GREEN.

### Task 3: Relógio, branching, eventos e cancelamento

**Files:**
- Create: `prototypes/vfx-composer/src/core/clock.ts`
- Create: `prototypes/vfx-composer/src/integration/events.ts`
- Create: `prototypes/vfx-composer/src/core/lifecycle.ts`

**Interfaces:**
- Consumes: fases e tipos do projeto.
- Produces: `buildAuthoringClock`, `sampleAuthoringClock`, `classifyComposerEvent`, `VisualLifecycle`.

- [ ] Escrever testes para fases off, branching `finish|impact`, 24/30/60, miss/timeout/desconhecido, cancel/cleanup idempotente.
- [ ] Confirmar RED.
- [ ] Implementar máquinas explícitas sem adaptar o scheduler legado por igualdade de nomes.
- [ ] Confirmar GREEN.

### Task 4: Determinismo e orçamento

**Files:**
- Create: `prototypes/vfx-composer/src/core/determinism.ts`
- Create: `prototypes/vfx-composer/src/core/budget.ts`
- Create: `prototypes/vfx-composer/src/index.ts`

**Interfaces:**
- Produces: `createDeterministicRandom`, `evaluateBudget`, barrel público F0.

- [ ] Escrever testes de seed/replay, perfis low/medium/high e bloqueio de publicação por teto excedido.
- [ ] Confirmar RED.
- [ ] Implementar PRNG isolado e avaliação agregada sem afirmar metas de FPS.
- [ ] Confirmar GREEN e typecheck.

### Task 5: Descoberta, relatório e verificação

**Files:**
- Modify: `package.json`
- Modify: `ABRIR_ARENAMON.html`
- Modify: `HTMLS_ARENAMON.html`
- Modify: `TESTES_ARENAMON.html`
- Modify: `docs/GAMEDEV_SKILLS.md`
- Create: `docs/VFX_COMPOSER_F0.md`

**Interfaces:**
- Consumes: scripts e resultados das Tasks 1–4.
- Produces: comandos `typecheck:vfx-composer`, `test:vfx-composer`, descoberta em até dois cliques e relatório de F0.

- [ ] Integrar scripts e links sem sobrescrever entradas existentes.
- [ ] Rodar `npm run test:vfx-composer`, `npm run typecheck:vfx-composer`, `npm run rapido`, `npm run build:combat-lab` e `npm run verify:workspace`.
- [ ] Revisar diff/status e registrar exatamente o verificado e o não verificado.
