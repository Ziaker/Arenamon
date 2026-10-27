# VFX Composer F1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a autoria geométrica e o QA visual da F1 com planos orientáveis, desenho assistido, tapering, seleção profissional e controles normativos.

**Architecture:** O schema continua retrocompatível e o `DocumentStore` permanece a fonte autoral. Funções geométricas puras geram cópias assistidas; a camada Three.js só projeta o documento e mantém estado transitório de interação.

**Tech Stack:** TypeScript 7, Three.js 0.186, esbuild, Node assert, Playwright Edge.

**Spec:** `docs/superpowers/specs/2026-10-27-vfx-composer-f1-1-design.md`

## Global Constraints

- Não alterar simulação, combate, dano, hitboxes, Animation Studio ou efeitos aprovados.
- Preservar projetos schema v1 existentes e defaults neutros.
- Manter HTML único, offline e acessível pelo portal.
- Todo valor geométrico importante deve ter controle visível, unidade e validação finita.

## Review Focus

- Plano rotacionado não pode produzir `NaN` quando paralelo à câmera.
- Simetria e repetição não podem gerar IDs duplicados ou geometria degenerada.
- Tapering ausente em projeto antigo deve renderizar largura constante.
- Nós travados não podem mudar por campo numérico nem gizmo.
- Isolamento e painéis recolhidos não podem alterar o JSON publicado.

---

### Task 1: Contratos geométricos F1.1

**Files:**
- Modify: `prototypes/vfx-composer/src/core/types.ts`
- Modify: `prototypes/vfx-composer/src/core/validation.ts`
- Modify: `prototypes/vfx-composer/src/editor/geometry.ts`
- Modify: `prototypes/vfx-composer/src/editor/document-store.ts`
- Modify: `prototypes/vfx-composer/test/f1-document.test.mjs`

**Interfaces:**
- Produces: `createAssistedPaths(points: Vec3[], options: AssistedPathOptions): Vec3[][]`, `setPathTaper(id: string, endWidth: number)`, `setLocked(id: string, locked: boolean)`, `setAuthoringSettings(settings: AuthoringSettings)`, primitivas `sphere` e `plane`.

- [x] Escrever `F1.1 contratos: taper, primitivas, lock, authoring e cópias assistidas` com expectativas literais para espelho e quatro cópias radiais.
- [x] Executar `npm run test:vfx-composer:f1`; esperado RED por `createAssistedPaths`/setters ausentes.
- [x] Implementar tipos e validação retrocompatível, com defaults apenas nos consumidores.
- [x] Implementar a função pura e setters reversíveis, rejeitando valores não finitos e nós travados.
- [x] Executar `npm run test:vfx-composer:f1` e `npm run test:vfx-composer`; esperado PASS.

### Task 2: Interface e viewport profissional

**Files:**
- Modify: `prototypes/vfx-composer/src/app/template.html`
- Modify: `prototypes/vfx-composer/src/app/style.css`
- Modify: `prototypes/vfx-composer/src/app/main.ts`
- Modify: `prototypes/vfx-composer/test/f1-app.browser.mjs`

**Interfaces:**
- Consumes: contratos da Task 1.
- Produces: plano orientável, controles pareados, vistas ortográficas, multi-seleção, lock, isolamento e gizmo local/global.

- [x] Ampliar `f1-app.browser.mjs` com plano rotacionado, pares range/number, esfera/plano, multi-seleção por delta, lock, isolamento, local/global e snapshot JSON invariável para estado transitório.
- [x] Executar `npm run build:vfx-composer` e `npm run test:vfx-composer:f1:browser`; esperado RED no primeiro seletor F1.1 ausente.
- [x] Implementar UI e projeção Three.js mínimas.
- [x] Executar `npm run test:vfx-composer:f1:browser`; esperado PASS sem erros de console nem rede.

### Task 3: Evidências, documentação e gate

**Files:**
- Modify: `docs/VFX_COMPOSER_F1.md`
- Modify: `docs/GAMEDEV_SKILLS.md`
- Modify: `TESTES_ARENAMON.html`
- Create: `prototypes/vfx-composer/evidence/f1-1/frontal.png`
- Create: `prototypes/vfx-composer/evidence/f1-1/lateral.png`

**Interfaces:**
- Consumes: aplicação compilada da Task 2.
- Produces: QA frontal/lateral navegável e estado explícito do que segue pendente.

- [x] Gerar build offline e capturas frontal/lateral da mesma cena e alvo pelo teste real.
- [x] Atualizar documentação e portal de testes.
- [x] Rodar contratos F0/F1, typecheck, build e teste Edge focado.
- [x] Revisar diff, segredos e arquivos não relacionados; manter `dumper test/` fora.
