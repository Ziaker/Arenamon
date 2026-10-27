# Arenamon VFX Composer F1 Implementation Plan

**Goal:** Entregar a aplicação offline e a autoria geométrica previstas na F1 sem antecipar F2–F4.

**Architecture:** `DocumentStore` é a fonte autoral; adaptadores de persistência e ferramentas operam sobre JSON validado; a camada Three.js projeta o documento no viewport e libera recursos ao reconstruir.

**Tech Stack:** TypeScript 7, Three.js 0.186, esbuild, Node assert, Playwright Edge.

**Spec:** `docs/ARENAMON_VFX_COMPOSER_ESPECIFICACAO_E_PROMPT_CODEX_48_DECISOES.docx`

## Global Constraints

- Não importar nem alterar simulação, combate, dano, hitboxes ou Animation Studio.
- HTML final único, local e offline; portal aponta para ele.
- Todo ajuste relevante tem controle visível com nome e unidade.
- Dados autorais continuam válidos pelo schema F0.

### Task 1: Documento editável e histórico

**Files:** `src/editor/document-store.ts`, `test/f1-document.test.mjs`, `src/index.ts`.

**Produces:** `DocumentStore`, criação/remoção/transformação de nós, seleção, transação composta, undo/redo e limite de histórico.

- [x] RED: operações preservam validade; transação composta desfaz em um passo; redo é invalidado por nova edição.
- [x] GREEN: implementar store sem DOM/Three.js.

### Task 2: Persistência e arquivos

**Files:** `src/editor/autosave.ts`, `src/editor/file-io.ts`, testes unitários.

**Produces:** autosave por revisão, recuperação validada, JSON upload/download e adaptador opcional File System Access.

- [x] RED/GREEN: salvar e reabrir sem perda; corrupção preserva último snapshot bom; APIs ausentes usam fallback.

### Task 3: Aplicação e viewport offline

**Files:** `src/app/main.ts`, `src/app/style.css`, `src/app/template.html`, `build.mjs`.

**Produces:** cena/câmera/OrbitControls/resize, hierarquia, propriedades, primitivas, seleção e TransformControls.

- [x] Browser RED/GREEN: abre offline, cria primitiva, seleciona, transforma e atualiza o documento.

### Task 4: Ferramentas geométricas

**Files:** `src/editor/geometry.ts`, UI e testes.

**Produces:** stroke livre, stroke em plano/superfície, curva, ribbon, vértices, extrusão, pivô e snapping.

- [x] Testar limites, finitude, coordenadas local/mundo e geometria não degenerada.
- [x] Testar cada controle visível no navegador.

### Task 5: Recuperação, descoberta e gate F1

**Files:** portais, `TESTES_ARENAMON.html`, `docs/VFX_COMPOSER_F1.md`, evidências.

- [x] Reabrir projeto sem perda no Edge offline.
- [x] Rodar testes F0+F1, typecheck, build e teste de navegador focado.
- [x] Parar antes da F2 e registrar o não verificado.

## Review Focus

- Undo de transformação composta não pode deixar hierarquia/referências inválidas.
- Reabertura não pode restaurar revisão mais antiga sobre uma nova.
- Coordenadas não finitas ou geometria degenerada devem ser rejeitadas.
- Remoção precisa liberar geometria/material Three.js sem apagar assets referenciados por outros nós.
- `file://` deve funcionar sem rede e sem depender da File System Access API.
