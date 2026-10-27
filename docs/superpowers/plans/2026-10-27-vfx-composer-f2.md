# VFX Composer F2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar timeline/animação, pintura de texturas e materiais declarativos seguros no Composer offline, encerrando no gate F2.

**Architecture:** O schema opcional permanece compatível com v1. Funções puras em `animation/`, `textures/` e `materials/` concentram avaliação e validação; `DocumentStore` mantém todas as mutações persistentes em Undo/Redo, enquanto a aplicação apenas projeta o estado no Three.js e nos painéis.

**Tech Stack:** TypeScript 7, Three.js 0.186, Canvas 2D, esbuild, Node assert e Playwright/Edge offline.

**Spec:** `docs/superpowers/specs/2026-10-27-vfx-composer-f2-design.md`

## Global Constraints

- Permanecer em `schemaVersion: 1`; campos F2 são opcionais e projetos F0/F1 continuam válidos.
- Não importar Three.quarks, combate, Animation Studio ou runtime do jogo.
- Não aceitar GLSL/HLSL, funções, URLs remotas ou operadores fora da allowlist.
- Todo parâmetro importante deve ter controle visível com unidade, default, passo e limites.
- Build final deve ser HTML offline autocontido, acessível pelo portal e documentado.

## Review Focus

- Tempo negativo, além da duração e troca de FPS devem ser limitados/quantizados sem drift (Task 1).
- Keyframes duplicados, fora de ordem ou com tangentes não finitas devem ser rejeitados (Task 1).
- Morph com número de pontos divergente deve falhar antes de alterar o documento (Task 1).
- Máscara com base64 inválido ou tamanho diferente de `width*height*4` deve ser rejeitada (Task 2).
- Grafo com ciclo, nó órfão, porta incompatível ou múltiplas conexões numa entrada deve ser rejeitado (Task 3).

---

### Task 1: Timeline determinística e animação de caminhos

**Files:**
- Create: `prototypes/vfx-composer/src/animation/timeline.ts`
- Modify: `prototypes/vfx-composer/src/core/types.ts`
- Modify: `prototypes/vfx-composer/src/core/content.ts`
- Modify: `prototypes/vfx-composer/src/editor/document-store.ts`
- Modify: `prototypes/vfx-composer/src/index.ts`
- Test: `prototypes/vfx-composer/test/f2-animation-material.test.mjs`

**Interfaces:**
- Produces: `quantizeTime(time, fps, duration)`, `evaluateNumericTrack(track, time)`, `evaluatePathTrack(track, time)`, `advancePlayback(state, delta)`, e mutações de track/evento/FPS no `DocumentStore`.

- [ ] Escrever testes falhos para quantização 24/30/60, step/linear/Bézier, reverse e limites.
- [ ] Rodar `node prototypes/vfx-composer/test/f2-animation-material.test.mjs` e confirmar falha por exports ausentes.
- [ ] Implementar os tipos, validadores e funções puras mínimos.
- [ ] Escrever testes falhos de morph compatível/incompatível e roundtrip antigo.
- [ ] Implementar morph, eventos e mutações Undo/Redo mínimas.
- [ ] Rodar teste F2 e testes F0/F1 até ficarem verdes.

### Task 2: Documento de textura e pintura offline

**Files:**
- Create: `prototypes/vfx-composer/src/textures/texture-document.ts`
- Modify: `prototypes/vfx-composer/src/core/types.ts`
- Modify: `prototypes/vfx-composer/src/core/content.ts`
- Modify: `prototypes/vfx-composer/src/editor/document-store.ts`
- Modify: `prototypes/vfx-composer/src/index.ts`
- Test: `prototypes/vfx-composer/test/f2-animation-material.test.mjs`

**Interfaces:**
- Produces: `createTextureDocument`, `decodeTexturePixels`, `paintTextureStroke`, `validateTextureDocument`, e `DocumentStore.upsertTexture/removeTexture`.

- [ ] Escrever testes falhos para default 256×256, pintura RGBA, base64/tamanho inválido, spritesheet e limites.
- [ ] Rodar o teste e confirmar falha pelos exports ausentes.
- [ ] Implementar armazenamento RGBA cru determinístico e mutações reversíveis.
- [ ] Rodar o teste F2 e confirmar verde sem ampliar `VisualAsset.uri`.

### Task 3: Grafo material seguro

**Files:**
- Create: `prototypes/vfx-composer/src/materials/material-graph.ts`
- Modify: `prototypes/vfx-composer/src/core/types.ts`
- Modify: `prototypes/vfx-composer/src/core/content.ts`
- Modify: `prototypes/vfx-composer/src/editor/document-store.ts`
- Modify: `prototypes/vfx-composer/src/index.ts`
- Test: `prototypes/vfx-composer/test/f2-animation-material.test.mjs`

**Interfaces:**
- Produces: `validateMaterialGraph(graph, textures)`, `compileMaterialRecipe(graph, textures)` e `DocumentStore.upsertMaterial/removeMaterial`.

- [ ] Escrever testes falhos para receita padrão estável e rejeição de ciclo, porta, nó, órfão, profundidade e referência ausente.
- [ ] Rodar o teste e confirmar falha pelos exports ausentes.
- [ ] Implementar allowlist, validação topológica e compilação determinística sem fonte de shader.
- [ ] Rodar o teste F2 e contratos de segurança F0 até verdes.

### Task 4: Workspaces e fluxo visual F2

**Files:**
- Modify: `prototypes/vfx-composer/src/app/template.html`
- Modify: `prototypes/vfx-composer/src/app/style.css`
- Modify: `prototypes/vfx-composer/src/app/main.ts`
- Create: `prototypes/vfx-composer/test/f2-app.browser.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: APIs das Tasks 1–3.
- Produces: abas Desenho/Animação/Texturas/Materiais; controles visíveis; `window.__ARENAMON_VFX_COMPOSER__` com estado/receita observável para QA.

- [ ] Escrever teste browser falho para abas, keyframe, scrub/reverse, onion skin, pintura, spritesheet, grafo inválido e duas páginas WebGL.
- [ ] Rodar após build e confirmar a primeira ausência de seletor/comportamento F2.
- [ ] Implementar timeline e onion skin sem gravar durante playback.
- [ ] Implementar canvas de pintura/importação PNG e configuração de spritesheet.
- [ ] Implementar formulário/lista do grafo e prévia Three.js a partir da receita segura.
- [ ] Rodar o teste browser offline e salvar captura/resultado em `evidence/f2/`.

### Task 5: Build, documentação e acesso

**Files:**
- Create: `docs/VFX_COMPOSER_F2.md`
- Modify: `docs/VFX_COMPOSER_F0.md`
- Modify: `ABRIR_ARENAMON.html`
- Modify: `HTMLS_ARENAMON.html`
- Modify: `TESTES_ARENAMON.html`
- Modify: `package.json`

**Interfaces:**
- Consumes: aplicação e testes F2 completos.
- Produces: entrada acessível em até dois cliques, comandos focados e instrução clara de abertura.

- [ ] Documentar capacidades, limites F2/F3/F4, controles e verificações.
- [ ] Adicionar links ao Composer e ao relatório F2 nos portais sem duplicar páginas.
- [ ] Executar typecheck, F0, F1, F2 unitário, build e browser F2.
- [ ] Revisar diff/status, confirmar ausência de segredos e alterações fora do escopo.
- [ ] Criar commit F2, enviar para `origin/main`, buscar remoto e comparar hashes local/remoto.
