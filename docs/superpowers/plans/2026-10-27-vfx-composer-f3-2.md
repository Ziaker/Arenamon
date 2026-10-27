# VFX Composer F3.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um backend visual `three.quarks` selecionável e descartável, mantendo a simulação F3.1 como verdade determinística.

**Architecture:** Um conversor puro transforma `ParticleEmitter` em receita JSON Quarks; uma camada exclusiva do navegador materializa e gerencia os sistemas. O app alterna Autoral/Quarks/A-B sem persistir essa preferência no VfxProject.

**Tech Stack:** TypeScript, Three.js 0.186, three.quarks 0.17.1, esbuild, Node test runner e Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-vfx-composer-f3-2-design.md`

## Global Constraints

- Não modificar nem importar código do Combat Lab.
- Não antecipar publicação/runtime da F4.
- Preservar JSON defensivo, limites de 12 emissores/1.400 partículas e acessibilidade visível.
- A escolha de backend não entra no documento salvo.
- Todo recurso deve ficar acessível pelo portal e o `dist/` deve ser recompilado.

## Review Focus

- Emissor inválido deve ser rejeitado antes de instanciar Quarks.
- Trocas repetidas de backend não podem acumular sistemas ou recursos.
- Rewind deve reconstruir o estado visual sem partículas do futuro.
- `reduceMotion` e perfil devem reduzir a mesma emissão efetiva usada pelo orçamento.
- Opacidade `noFlash`, blending e depthWrite devem chegar ao material real.

---

### Task 1: Contrato puro de conversão

**Files:**
- Create: `prototypes/vfx-composer/src/particles/quarks-contract.ts`
- Modify: `prototypes/vfx-composer/src/index.ts`
- Create: `prototypes/vfx-composer/test/f3-quarks.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `ParticleEmitter`, `SimulationOptions`, `particleScale`, `validateParticleEmitter`.
- Produces: `QuarksRecipe`, `toQuarksRecipe(emitter, options)`.

- [ ] Write tests with literal expectations for burst/continuous emission, four shapes, quality/accessibility, appearance/forces and malformed input.
- [ ] Run `npm run test:vfx-composer:f3:quarks`; expect failure because the export is absent.
- [ ] Implement the minimal pure recipe converter and export it.
- [ ] Run the same command; expect all contract tests to pass.

### Task 2: Adaptador de navegador e ciclo de vida

**Files:**
- Create: `prototypes/vfx-composer/src/app/quarks-particle-preview.ts`
- Create: `prototypes/vfx-composer/test/f3-quarks.browser.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `QuarksRecipe`, Three.js scene and `three.quarks` constructors.
- Produces: `QuarksParticlePreview`, `QuarksPreviewReport`.

- [ ] Write a browser test that materializes a real system, advances time, rewinds, removes it and checks zero retained systems after dispose.
- [ ] Run `npm run test:vfx-composer:f3:quarks:browser`; expect failure because the adapter is absent.
- [ ] Implement shapes, interval values, material, behaviors, rebuild-on-rewind and explicit disposal.
- [ ] Run the browser test; expect pass without page errors.

### Task 3: Controle visível e comparação A/B

**Files:**
- Modify: `prototypes/vfx-composer/src/app/main.ts`
- Modify: `prototypes/vfx-composer/src/app/style.css`
- Modify: `prototypes/vfx-composer/test/f3-quarks.browser.mjs`

**Interfaces:**
- Consumes: both preview implementations.
- Produces: visible `Autoral`, `Quarks`, `Comparar A/B` selector and combined telemetry.

- [ ] Extend the browser test to switch all three modes repeatedly and assert visibility, backend report and bounded renderer resources.
- [ ] Run the browser test; expect failure because the control is absent.
- [ ] Add the selector, mode orchestration, A/B offset and telemetry without writing the mode into VfxProject.
- [ ] Run the browser test and existing F3 browser test; expect both to pass.

### Task 4: Documentação, acesso e entrega

**Files:**
- Modify: `docs/VFX_COMPOSER_F3.md`
- Modify: `ABRIR_ARENAMON.html` only if the existing Composer link does not already satisfy two-click access.
- Create: `prototypes/vfx-composer/evidence/F3_2_VALIDATION.md`

**Interfaces:**
- Consumes: verified F3.2 behavior and test outputs.
- Produces: user-facing status, evidence and regenerated offline HTML.

- [ ] Document F3.2 limitations and the next F3 increment without claiming positional parity or FPS.
- [ ] Run typecheck, F0–F3 unit tests, targeted F3 browser tests and `npm run build:vfx-composer`.
- [ ] Review diff/status, confirm unrelated combat changes remain untouched, and record exact commands/results in evidence.
- [ ] Commit only F3.2 files, push, fetch and compare local/remote hashes.

