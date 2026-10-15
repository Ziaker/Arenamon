# Arenamon Animation Studio — Contrato Técnico de Rigging
**Versão:** 1.0.0  
**Data:** 14/10/2026  
**Módulos:** `telemetry.js`, `patch.js`, `autorig.js`, `core.js`, `index.js`  
**Destinatários:** Agentes de IA (Codex, Antigravity, Claude) e Interfaces do Studio.

---

## 1. Visão Geral e Princípios Fundamentais

O núcleo técnico de Rigging do Arenamon Animation Studio foi expandido para fornecer **inspeção programática completa**, **correção transacional declarativa de esqueletos** e **auto-rig adaptativo** sem requerer manipulação manual por gizmo na interface 3D.

### Princípios do Contrato
1. **Separação Rígida entre Métricas e Hipóteses:** Métricas matemáticas e geométricas (distâncias, ortogonalidade de matrizes, soma de pesos normalizados, simetria numérica) são expressas com rigor numérico. Nenhuma estrutura é declarada "anatomicamente perfeita" apenas por passar na validação algébrica.
2. **Segurança Transacional e Atomicidade:** Nenhuma operação danifica o modelo em caso de falha. Todo patch passa por validação prévia (*dry-run*), simulação de diferenças e captura de *snapshot* completo, garantindo *rollback* integral.
3. **Identificadores Estáveis (`jointId`):** Articulações e ossos possuem IDs persistentes invariantes a renomeações.
4. **Zero `eval`:** Todas as instruções são expressas em esquemas declarativos JSON validados estritamente contra tipos e intervalos numéricos.

---

## 2. API de Telemetria (`arenamon-rig-telemetry` v1)

### 2.1 Método de Invocação
```javascript
import { inspectRig, exportTelemetryJSON } from './src/rigging/telemetry.js';

// No contexto do navegador / Studio:
const telemetry = window.__studioRig.inspectRig(options);
const jsonString = window.__studioRig.exportTelemetryJSON(options);
```

### 2.2 Estrutura do Relatório JSON

```json
{
  "schema": "arenamon-rig-telemetry",
  "version": 1,
  "timestamp": "2026-10-14T23:55:00.000Z",
  "modelName": "CreatureBody",
  "bounds": {
    "min": [-0.6, 0.0, -0.3],
    "max": [0.6, 2.8, 0.3],
    "size": [1.2, 2.8, 0.6],
    "center": [0.0, 1.4, 0.0],
    "vertices": 1420
  },
  "identification": {
    "totalBones": 20,
    "roots": ["joint-hips"],
    "hierarchy": [
      {
        "id": "joint-hips",
        "name": "Hips",
        "parent": null,
        "parentId": null,
        "children": ["joint-spine", "joint-lefthip", "joint-righthip"],
        "depth": 0
      }
    ],
    "duplicateNames": [],
    "duplicateIds": [],
    "invalidReferences": [],
    "meshCount": 1,
    "skinnedMeshCount": 1,
    "staticMeshCount": 0,
    "meshes": [
      {
        "name": "BodyMesh",
        "type": "SkinnedMesh",
        "vertices": 1420,
        "skinned": true,
        "skeletonBoneCount": 20
      }
    ]
  },
  "transforms": {
    "bones": [
      {
        "id": "joint-hips",
        "name": "Hips",
        "local": { "position": [0, 1.35, 0], "quaternion": [0, 0, 0, 1], "scale": [1, 1, 1] },
        "world": { "position": [0, 1.35, 0], "quaternion": [0, 0, 0, 1], "scale": [1, 1, 1] },
        "modelRoot": { "position": [0, 1.35, 0], "quaternion": [0, 0, 0, 1] },
        "segmentLength": 0,
        "localMatrix": [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,1.35,0,1],
        "worldMatrix": [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,1.35,0,1],
        "bindMatrixInverse": [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,-1.35,0,1]
      }
    ],
    "hasRestPoseStored": true
  },
  "skinning": {
    "isSkinned": true,
    "meshes": [
      {
        "meshName": "BodyMesh",
        "vertices": 1420,
        "zeroWeightVertices": 0,
        "unnormalizedVertices": 0,
        "uninfluencedBones": [],
        "influencesPerBone": { "Hips": 120, "Spine": 340 },
        "weightStats": {
          "minNonZero": 0.045,
          "max": 1.0,
          "avgInfluencesPerVertex": 2.6,
          "maxInfluencesPerVertex": 4
        },
        "deformationWarnings": []
      }
    ],
    "sharedSkeletons": [
      { "skeletonIndex": 0, "meshNames": ["BodyMesh"], "boneCount": 20, "isShared": false }
    ],
    "globalUninfluencedBonesCount": 0
  },
  "consistency": {
    "symmetry": {
      "plane": "YZ",
      "centerPlaneX": 0.0,
      "pairs": [
        {
          "leftName": "LeftShoulder",
          "leftId": "joint-l-shoulder",
          "rightName": "RightShoulder",
          "rightId": "joint-r-shoulder",
          "asymmetryDelta": 0.00001,
          "isSymmetric": true
        }
      ],
      "maxAsymmetryDelta": 0.00001,
      "isGloballySymmetric": true
    },
    "outsideBounds": [],
    "coincidentSegments": [],
    "collinearSegments": [],
    "unexpectedHierarchies": [],
    "orphanAnimationTracks": [],
    "structuralRiskFlags": []
  },
  "metrics": {
    "mathematicalPass": true,
    "warningCount": 0,
    "warnings": []
  },
  "notes": "Relatório de telemetria diagnóstica. Métricas numéricas e geométricas não constituem validação ou certificação anatômica."
}
```

---

## 3. Contrato de Rig Patch (`arenamon-rig-patch` v1)

### 3.1 Formato JSON Declarativo

```json
{
  "schema": "arenamon-rig-patch",
  "version": 1,
  "targetModel": "CreatureBody",
  "operations": [
    {
      "op": "setBonePosition",
      "jointId": "joint-spine",
      "space": "model-root",
      "position": [0.0, 1.45, 0.0]
    },
    {
      "op": "moveBone",
      "jointId": "LeftElbow",
      "space": "local",
      "delta": [0.05, 0.0, 0.0]
    },
    {
      "op": "mirrorBone",
      "jointId": "LeftElbow"
    },
    {
      "op": "renameJoint",
      "jointId": "Head",
      "newName": "Cranium"
    },
    {
      "op": "createBone",
      "id": "joint-tail-1",
      "name": "Tail1",
      "parent": "Hips",
      "position": [0.0, 0.6, -0.4],
      "quaternion": [0, 0, 0, 1]
    },
    {
      "op": "deleteBone",
      "jointId": "UnusedAccessoryBone",
      "reparentChildren": true
    },
    {
      "op": "correctSymmetry",
      "referenceSide": "Left"
    },
    {
      "op": "normalizeSkinWeights",
      "meshName": "BodyMesh"
    }
  ]
}
```

### 3.2 Operações Suportadas

| Operação | Parâmetros Obrigatórios | Parâmetros Opcionais | Efeito / Descrição |
| :--- | :--- | :--- | :--- |
| `setBonePosition` | `jointId`, `position` `[x,y,z]` | `space` (`'model-root'` ou `'local'`) | Define a posição exata da articulação. |
| `setBoneQuaternion` | `jointId`, `quaternion` `[x,y,z,w]` | — | Define a orientação em repouso. |
| `moveBone` | `jointId`, `delta` `[dx,dy,dz]` | `space` (`'model-root'` ou `'local'`) | Desloca a articulação incrementalmente. |
| `renameJoint` | `jointId`, `newName` | — | Renomeia o osso e preserva hierarquias filhas. |
| `createBone` | `name`, `position` | `id`, `parent`, `quaternion` | Insere novo osso e registra na paleta de skinning. |
| `deleteBone` | `jointId` | `reparentChildren` (padrão `true`) | Remove articulação reparenteando filhos ao pai. |
| `reparentBone` | `jointId`, `newParentJointId` | — | Altera a relação de parentesco. |
| `mirrorBone` | `jointId` | `symmetryCenter` | Espelha coordenadas no plano bilateral YZ. |
| `correctSymmetry` | — | `referenceSide` (`'Left'` ou `'Right'`) | Corrige todos os pares bilaterais simultaneamente. |
| `recomputeBindMatrices`| — | — | Recalcula `boneInverses` para a pose atual. |
| `normalizeSkinWeights` | — | `meshName` | Normaliza a soma dos 4 pesos por vértice para 1.0. |
| `modifyVertexWeights` | `meshName`, `vertexIndex`, `influences` | — | Modifica influências pontuais por vértice. |

### 3.3 Relatório de Diferenças do Pre-Flight (*Dry Run*)

Antes de aplicar qualquer modificação, execute `simulateRigPatch(root, patch)`.
Retorno estruturado:
```json
{
  "valid": true,
  "errors": [],
  "warnings": [
    "Renomear 'Head' para 'Cranium' pode afetar trilhas de animação externas."
  ],
  "diff": {
    "bonesAdded": [
      { "id": "joint-tail-1", "name": "Tail1", "parent": "Hips" }
    ],
    "bonesRemoved": [],
    "bonesMoved": [
      { "id": "joint-spine", "name": "Spine", "op": "setBonePosition" }
    ],
    "bonesRotated": [],
    "bonesRenamed": [
      { "id": "Head", "from": "Head", "to": "Cranium" }
    ],
    "bonesReparented": [],
    "skinningImpacted": true
  }
}
```

---

## 4. API de Auto-Rig Avançado (`autorig.js`)

### 4.1 Análise Geométrica (`analyzeGeometry`)
Inspeciona as dimensões, orientação, densidade por fatias axiais e identifica regiões candidatas com nível de confiança:
```javascript
import { analyzeGeometry } from './src/rigging/autorig.js';

const analysis = analyzeGeometry(modelRoot);
console.log(analysis.proportions.isQuadrupedCandidate); // true/false
console.log(analysis.symmetry.score);                  // 0.0 .. 1.0
console.log(analysis.candidateRegions.head);          // { yRange, confidence, estimatedCenter }
```

### 4.2 Geração de Templates Paramétricos
- `generateHumanoidDraft(bounds, analysis, { proportions: 'standard' | 'chibi', armSpread })`: Gera esqueleto de 20 ossos adaptado à morfologia.
- `generateQuadrupedDraft(bounds, analysis, { boneCount: 24 | 27, withTail: true })`: Gera esqueleto com patas traseiras e dianteiras independentes, com opção de 24 ou 27 ossos (incluindo escápulas).
- `fitDraftToLandmarks(draft, landmarks, { lockedJoints: ['Hips'] })`: Ajuste assistido por pontos anatômicos sem sobrescrever ossos travados.
- `computeEnhancedSkinningWeights(mesh, skeleton, { smoothness: 0.15 })`: Algoritmo de cápsula óssea com falloff exponencial que previne pinçamento e vértices com peso zero.

---

## 5. API de Alto Nível para Interfaces Antigravity

Disponível no objeto global do visualizador:
```javascript
// Obter telemetria completa
const telemetry = window.__studioRig.inspectRig();

// Simulação sem aplicar (gera relatório de diferenças)
const preflight = window.__studioRig.simulatePatch(patchJSON);

// Aplicação transacional com Undo/Redo automático
const result = window.__studioRig.applyPatch(patchJSON);

// Gerador fluente programático
const patch = window.__studioRig.createPatchBuilder()
  .moveBone('Spine', [0, 0.1, 0])
  .mirrorBone('LeftShoulder')
  .build();

window.__studioRig.applyPatch(patch);
```

---

## 6. Migração do Formato da Workbench (`migrateWorkbenchPatch`)

### 6.1 Histórico e Incompatibilidade
A Workbench de prototipagem utilizava um formato preliminar baseado em `schema: 'workbench-rig-patch'` com chave `ops` e nomenclaturas abreviadas (`type: 'move'`, `bone: '...'`).
Para garantir determinismo, integridade de tipos e atomicidade, o contrato canônico do Animation Studio adota estritamente `schema: 'arenamon-rig-patch'`, versão 1, com chave `operations` e `jointId`. Patches legados não migrados são rejeitados com erro explícito.

### 6.2 Tabela de Conversão

| Workbench (Legado) | Rig Patch Canônico (`arenamon-rig-patch` v1) | Notas |
| :--- | :--- | :--- |
| `schema: "workbench-rig-patch"` | `schema: "arenamon-rig-patch"` | Obrigatório |
| `ops: [...]` | `operations: [...]` | Array de operações |
| `type: "move"`, `bone: B`, `delta: D` | `op: "moveBone"`, `jointId: B`, `delta: D` | `space` padrão `'model-root'` |
| `type: "setPosition"`, `bone: B`, `pos: P` | `op: "setBonePosition"`, `jointId: B`, `position: P` | `space` padrão `'model-root'` |
| `type: "rename"`, `bone: B`, `name: N` | `op: "renameJoint"`, `jointId: B`, `newName: N` | Atualiza referências filhas |
| `type: "create"`, `name: N`, `p: P` | `op: "createBone"`, `name: N`, `position: P` | Suporta `id` e `parent` |
| `type: "delete"`, `bone: B` | `op: "deleteBone"`, `jointId: B` | `reparentChildren: true` |
| `type: "reparent"`, `bone: B`, `parent: P` | `op: "reparentBone"`, `jointId: B`, `newParentJointId: P` | |
| `type: "mirror"`, `bone: B` | `op: "mirrorBone"`, `jointId: B` | Espelhamento bilateral |

### 6.3 Função Utilitária de Migração
```javascript
import { migrateWorkbenchPatch } from './src/rigging/patch.js';

const legacyWorkbenchPatch = {
  schema: 'workbench-rig-patch',
  version: 1,
  ops: [
    { type: 'move', bone: 'Hips', delta: [0, 0.2, 0] },
    { type: 'rename', bone: 'Head', name: 'Cranium' }
  ]
};

// Conversão segura e tipada para o formato canônico
const canonicalPatch = migrateWorkbenchPatch(legacyWorkbenchPatch);
window.__studioRig.applyPatch(canonicalPatch);
```

---

## 7. Algoritmos de Pesos de Skinning e Comprovação

O Animation Studio disponibiliza dois algoritmos de pesagem automática na vinculação de malhas (`bindDraftToModel`), selecionáveis via interface (`#rg-weights`) ou API:

1. **`segment-proximity` (Padrão Legado):**
   - Proximidade linear ao segmento entre articulações pai e filho.
   - Cálculo leve e compatibilidade regressiva com modelos e workflows prévios.
2. **`capsule-falloff` (Algoritmo Aprimorado):**
   - Utiliza modelo volumétrico de cápsula óssea com decaimento exponencial relativo ao comprimento do segmento.
   - Previne vértices com peso zero em geometrias complexas e multi-malha, suavizando deformações em cotovelos, joelhos e articulações da coluna.

### Comprovação do Algoritmo nos Metadados
Ao executar a vinculação, o algoritmo utilizado é persistido explicitamente no `userData.arenamonRig` de cada modelo e no retorno da operação:
```javascript
// Exemplo de metadados gravados na raiz do modelo:
{
  "schema": "arenamon-rig",
  "version": 2,
  "autoWeights": {
    "method": "capsule-falloff", // ou "segment-proximity"
    "smoothness": 0.15,
    "calculatedAt": "2026-10-14T23:55:00.000Z"
  },
  "joints": [ ... ]
}
```

---

## 8. Escopo Anatômico e Limitações do Auto-Rig

> [!IMPORTANT]
> **Princípio de Honestidade Técnica:** Não existe "auto-rig universal". O sistema do Arenamon não reivindica capacidade de gerar esqueletos adequados para qualquer malha arbitrária sem restrições.

### Morfologias Suportadas e Comprovadas
1. **Humanoide 20 Ossos (`generateHumanoidDraft`):**
   - Proporções padrão (estilo realista/heróico) e chibi.
   - Adequado para bípedes antropomórficos com cabeça, tronco, 2 braços e 2 pernas.
2. **Quadrúpede 24 Ossos (`generateQuadrupedDraft` com `boneCount: 24`):**
   - Estrutura simétrica com cintura pélvica, cintura escapular genérica, coluna torácica/lombar, pescoço, cabeça e 4 patas (coxa/braço, canela/antebraço, pata).
3. **Quadrúpede 27 Ossos (`generateQuadrupedDraft` com `boneCount: 27`):**
   - Inclui escápulas (`LeftScapula`, `RightScapula`) e âncoras torácicas especializadas para criaturas carnívoras e quadrúpedes robustos que demandam maior liberdade de ombro.
4. **Cadeias Paramétricas de Cauda:**
   - Adicionáveis opcionalmente (`withTail: true`) com múltiplos segmentos ajustáveis.

### Limitações Explícitas
- **Morfologias Não-Padrão:** Criaturas serpentinas puras, artrópodes multicelulares (aranhas, centopeias), seres amorfos ou com asas adicionais **não** utilizam auto-rig automático puro.
- **Ajuste Assistido:** Para modelos fora do padrão humanoide/quadrúpede, deve-se utilizar `fitDraftToLandmarks` com marcos anatômicos declarados ou construir o esqueleto declarativamente via `RigPatchBuilder`.

