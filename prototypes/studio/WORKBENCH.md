# Rigging Telemetry Workbench

Aba **Telemetria** do Animation Studio. É uma bancada para inspecionar um rig, gerar instruções de correção com uma IA e aplicá-las de forma verificável, sem posicionar cada articulação à mão.

- **Branch experimental:** `integration/workbench-telemetry-autorig`. Ela junta `feat/studio-rig-workbench` (`ffe71b8`) com a API oficial de `feat/studio-rig-telemetry-autorig` (`56b01a5`). **Não há merge na `main`.**
- **Motor:** a API oficial de rigging (`src/rigging/telemetry.js`, `patch.js` e `autorig.js`; contrato em `docs/CONTRATO_TECNICO_RIGGING.md`). A Workbench **não tem mais** telemetria nem motor de patch próprios.
- **Núcleo de produção do outro agente:** não foi modificado. A Workbench só chama as funções exportadas.
- **Propostas A, B e C:** continuam intocadas em `feat/studio-rigging-ui-proposals`, aguardando a sua avaliação.

## Demonstração

Sem modelo carregado, a aba mostra **Carregar demonstração**. O botão monta um personagem sintético, sem recursos proprietários, pelo fluxo da aba Rigging:
- 6 malhas independentes;
- template humanoide de 20 ossos;
- cotovelo direito 0,134 fora do espelho;
- skin;
- um clipe com uma trilha órfã.

## Fluxo

**Inspecionar → Diagnosticar → Corrigir → Comparar → Aplicar → Validar**

1. **Inspecionar.** Todos os números vêm de `inspectRig`:
   - ossos e malhas;
   - vértices, vértices não normalizados e vértices sem influência;
   - trilhas órfãs, assimetria máxima e ossos fora da geometria.

   Para cada osso (árvore com teclado, ou clique no visualizador), a interface mostra:
   - ID persistente, pai e filhos;
   - posições local, na raiz e no mundo;
   - quaternion local e comprimento do segmento;
   - matriz de bind;
   - influência por malha;
   - par de simetria com a assimetria;
   - avisos.

   Na proposta do auto-rig, o botão **Travar ponto** fica no detalhe do osso.
2. **Diagnosticar.**
   - Avisos e pares assimétricos de `inspectRig`.
   - Trilhas órfãs por clipe.
   - **Copiar para IA** e **Copiar JSON completo** entregam o objeto oficial **sem alterações**.
   - **Copiar seleção** é um recorte do mesmo schema, com o campo `selection`.
   - **Exportar JSON** gera um arquivo com a mesma telemetria.
3. **Corrigir.**
   - Recebe o patch **canônico** (`operations`).
   - Um patch no formato anterior (`ops`) é **migrado explicitamente**: a tabela "Migração do formato anterior" mostra cada operação antiga e as canônicas geradas. **Substituir no editor pelo patch canônico** troca o texto.
   - Erros mostram o caminho (`operations[2].position`) e a etapa que recusou: estrutura (`validatePatch` oficial mais a checagem de campos), limite comprovado, hierarquia ou `simulateRigPatch`.
   - Um JSON de coordenadas (`arenamon-rig`) vira um patch de `setBonePosition`.
4. **Comparar.** É um **ensaio real**:
   1. `simulateRigPatch` prevê as mudanças;
   2. `applyRigPatch` aplica;
   3. `inspectRig` mede;
   4. a própria entrada de desfazer da API restaura o modelo;
   5. a Workbench confere bit a bit que **ossos, pesos, matrizes de bind e metadados** voltaram ao estado anterior. Se não voltarem, o ensaio falha.

   Num rascunho, o ensaio roda numa cópia (veja "Como o adaptador usa a API"). A tela mostra:
   - a previsão oficial;
   - os ossos alterados (Δ posição, Δ rotação, nome, pai, criados);
   - os avisos resolvidos e os novos;
   - os vértices influenciados por osso;
   - o esqueleto proposto em laranja.
5. **Aplicar.** Gera **uma única entrada** no histórico do Studio. Desfazer e refazer (botões, Ctrl+Z e Ctrl+Y) restauram ossos, pesos, matrizes e metadados exatamente.
6. **Validar.** Gera a telemetria oficial de novo e compara com a anterior: métricas, assimetria por par e avisos.

## Rig Patch canônico

```json
{
  "schema": "arenamon-rig-patch", "version": 1,
  "description": "Simetria do cotovelo e nome da cabeça",
  "operations": [
    {"op": "mirrorBone", "jointId": "joint-…LeftElbow", "note": "o cotovelo direito está 0,13 fora do espelho"},
    {"op": "renameJoint", "jointId": "joint-…Head", "newName": "HeadMain"}
  ]
}
```

| Operação | Rig com skin | Rascunho / proposta |
|---|---|---|
| `setBonePosition`, `moveBone` | ✓ | ✓ |
| `setBoneQuaternion` (rotação de repouso) | ✓ | ✓ |
| `renameJoint`, `reparentBone`, `createBone` | ✓ | ✓ |
| `mirrorBone`, `correctSymmetry` | ✓ | **Bloqueado:** a API não altera pontos de rascunho |
| `normalizeSkinWeights`, `modifyVertexWeights`, `recomputeBindMatrices` | ✓ | Não se aplica (sem skin) |
| `deleteBone` | **Bloqueado:** a API desloca os pesos (defeito 3) | ✓ |
| `setRestPose`, `recomputeSkinningWeights` | **Bloqueado:** a API aceita, mas não executa (defeito 4) | **Bloqueado** |

Operações bloqueadas são recusadas com o motivo, nunca aplicadas em silêncio.

### Migração do formato anterior (`ops` → `operations`)

| Anterior | Canônico |
|---|---|
| `setPosition {joint, p}` | `setBonePosition {jointId, position, space: "model-root"}` |
| `translate {joint, delta}` | `moveBone {jointId, delta, space: "model-root"}` |
| `setRotation {joint, q}` | `setBoneQuaternion {jointId, quaternion}` |
| `rename {joint, name}` | `renameJoint {jointId, newName}` |
| `mirror {joint}` | `mirrorBone {jointId}` |
| `removeJoint {joint}` | `deleteBone {jointId, reparentChildren: true}` |
| `reparent {joint, parent}` | `reparentBone` **+** `setBonePosition` com a posição atual. O `reparent` antigo preservava a posição na raiz; o oficial preserva a posição local. |
| `addJoint {name, parent, p}` | `createBone {id, …}` **+** `setBonePosition {space: "model-root"}`. No rig com skin, o `position` oficial é local ao pai. |

Um patch com `ops` e `operations` ao mesmo tempo é recusado.

## Auto-rig assistido (API oficial)

Fica em **Corrigir**, quando a malha não tem ossos. A proposta gerada vive na Workbench, com estado **"Proposta do auto-rig"**, até o bind.

| Função | Implementação | Situação |
|---|---|---|
| Humanoide · 20 ossos | `generateHumanoidDraft` | ✓ fluxo completo testado na interface |
| Quadrúpede · 24 e 27 ossos | `generateQuadrupedDraft({boneCount})` | ✓ fluxo completo testado na interface, com um modelo quadrúpede sintético |
| Incerteza | `analyzeGeometry().candidateRegions[].confidence` | Confiança **por região**. A API não informa incerteza por ponto, e a interface diz isso. |
| Travar pontos | `lockedJoints` de `fitDraftToLandmarks` e de `regenerateRegion` | ✓ e também protege os pontos contra patches |
| Ajustar aos marcos | `fitDraftToLandmarks` com os centros estimados por `analyzeGeometry` (cabeça, pescoço, pelve) | ✓ respeita as travas |
| Regenerar região | `regenerateRegion` | ✓ só **cauda**. As outras regiões aparecem desabilitadas: a API devolve o rascunho inalterado. |
| Patch na proposta | `applyRigPatch` numa cópia | ✓ com prévia de pesos (bind oficial em cópias) |
| Bind | `bindDraftToModel` | ✓ uma entrada no histórico; desfazer devolve as malhas originais e a proposta |
| Rascunho criado na aba Rigging | **Editar este rascunho na Workbench** o converte em proposta | ✓ |

## Como o adaptador usa a API (`src/workbench/engine-official.js`)

- **Telemetria:** `inspectRig(model, {draft, clips})`. Em `telemetry.js` só existe a reorganização para a interface e as diferenças entre duas telemetrias oficiais.
- **Validar:** `parsePatch`, depois os limites comprovados, as travas, `simulateRigPatch` e uma checagem de ciclos (defeito 5).
- **Aplicar num rig com ossos:**
  1. `applyRigPatch(model, patch, {undoStack})`, que empilha uma entrada com snapshots antes e depois;
  2. essa entrada vira **um** comando do histórico do Studio;
  3. depois de aplicar, desfazer ou refazer, `importer.commitRig` atualiza o mapa de repouso do Studio;
  4. as matrizes de bind do snapshot são preservadas em volta do `commitRig`, que as recalcularia a partir da pose. Num GLB reimportado, o recálculo difere na última casa decimal.
- **Rascunhos:** o `applyRigPatch` oficial roda num `Group` vazio que carrega uma cópia do rascunho em `userData.arenamonRigDraft`. O modelo não é tocado e o resultado passa por `validateDraft`. Em `createBone`, o `parent` é convertido de ID para nome (veja o defeito 6).

## Defeitos encontrados na API oficial (56b01a5), para o agente responsável

Nenhum foi corrigido aqui: o núcleo de produção dele não foi modificado. Cada item tem um teste de evidência em `test/workbench.test.mjs` ou em `test/workbench.browser.mjs`.

1. **`window.__studioRig.applyPatch` não persiste.**
   - Devolve `success: true`, mas `prepareRig()` → `enterRigRest()` restaura o mapa de repouso antigo do motor do Studio, e a mudança some.
   - As matrizes de bind ficam recalculadas na pose descartada.
   - Empilha em `window.__studioHistory`, que não existe, e por isso não entra no histórico.
   - **Correção sugerida:** chamar `E.commitRig` e usar `window.__studioEditor.history.run`.
2. **`reparentBone` usa `newParent.add(bone)` em vez de `attach`.** A posição local é mantida, então o osso e a cadeia se deslocam no espaço da raiz. O editor estrutural da aba Rigging preserva a posição.
3. **`deleteBone` num rig com skin desloca os pesos.** Remove o osso da paleta (`skeleton.bones.splice`) sem remapear `skinIndex`: os vértices de cada osso seguinte passam a apontar para o osso anterior. Por isso fica bloqueado em rig vinculado.
4. **`setRestPose` e `recomputeSkinningWeights`** passam em `validatePatch` e `simulateRigPatch`, mas `applyRigPatch` não tem `case` para eles: devolve `success: true` sem mudar nada.
5. **`simulateRigPatch` não detecta ciclos.** Reparentar um osso sob um descendente passa na simulação; o apply estoura a pilha e faz rollback.
6. **Rascunhos:**
   - `mirrorBone` e `correctSymmetry` só atuam em ossos reais;
   - `createBone` grava `parent` como recebido (ID), mas o rascunho referencia pais pelo nome;
   - `applyRigPatch` lê o rascunho de `root.userData.arenamonRigDraft`, não de `options.draft`, e não sincroniza o estado da aba Rigging.
7. **`regenerateRegion`:**
   - só implementa `'tail'`; outras regiões devolvem o rascunho sem erro;
   - trava por **nome** (não por ID);
   - travar um osso `Tail*` gera um nome duplicado na recriação.
8. **`inspectRig` arredonda posições a 5 casas** (`round5`). Na conversão de coordenadas, diferenças menores que 1e-5 não contam como correção.

## Arquitetura

| Arquivo | Papel |
|---|---|
| `src/workbench/engine-official.js` | Adaptador para a API oficial: validar, ensaiar, aplicar em transação única, prévia de bind e auto-rig. Funciona em Node com um `importer` injetado. |
| `src/workbench/patch.js` | Contrato canônico, migração explícita, checagem de campos, limites comprovados e conversão de coordenadas. Puro. |
| `src/workbench/telemetry.js` | Visão do objeto de `inspectRig` para a interface, recorte por seleção e diferenças entre telemetrias. Puro. |
| `src/workbench/viewer.js` | Camadas 3D (esqueleto, eixos, simetria, heatmap e vértices sem peso dos atributos brutos) e seleção por clique. |
| `src/workbench/panel.js` | Interface: `mountWorkbench(container, {engine, viewer, layout})`. Não depende do layout do Studio. |
| `src/workbench/index.js` | Montagem na aba Telemetria. Expõe `window.__studioWorkbench.fingerprint()` para os testes. |

`engine-codex.js`, o adaptador anterior baseado em campos da interface do Rigging, foi **removido**.

## Testes

| Comando | O que cobre |
|---|---|
| `node prototypes/studio/test/workbench.test.mjs` | 18 testes em Node com a API oficial e um importador que reproduz o mapa de repouso do Studio |
| `node prototypes/studio/test/workbench.browser.mjs` | 15 verificações de ponta a ponta no Edge, offline, com cliques, teclado, área de transferência e download |

Os testes em Node cobrem:
- telemetria igual a `inspectRig`;
- recorte para a IA;
- erros com caminho;
- migração de todas as operações anteriores;
- ensaio sem efeito;
- aplicação como uma transação, com desfazer e refazer bit a bit;
- rotação de repouso;
- `reparent` migrado;
- limites bloqueados, com evidência dos defeitos;
- os 3 perfis do auto-rig (proposta, patch, bind, desfazer e refazer);
- travas, marcos e cauda;
- rascunho da aba Rigging;
- conversão de coordenadas;
- ciclos.

As verificações no navegador cobrem:
- demonstração;
- personagem montado pelos botões do Rigging;
- visão geral igual ao oficial;
- árvore, teclado, clique 3D e heatmap;
- copiar e exportar;
- rejeições;
- **comparar sem efeito permanente**, com a impressão digital igual, inclusive depois de trocar de aba;
- **aplicar em uma entrada**, com desfazer e refazer por botões e por Ctrl+Z/Ctrl+Y bit a bit;
- validar;
- GLB exportado e reimportado;
- patch anterior migrado (criar e reparentar);
- auto-rig humanoide completo;
- auto-rig quadrúpede de 24 e de 27 ossos completo;
- evidência do defeito 1;
- celular (390 px).

As capturas e o JSON de evidências ficam em `validation/workbench-*`, fora do Git.

## CI

O workflow `Arenamon Studio Rig Workbench` roda nesta branch e em `feat/studio-rig-workbench`. Ele executa `npm run verify:studio-workbench`: todas as suítes do Studio, inclusive as da API oficial. Depois executa o `npm run verify` completo.
