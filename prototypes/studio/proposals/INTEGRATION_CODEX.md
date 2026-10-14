# Arenamon Animation Studio — Especificação de Integração de Rigging
## Contrato de Integração Interface (UI) ⇄ Núcleo de Rigging (Codex)

Este documento especifica os contratos de dados, métodos e eventos necessários para a comunicação bidirecional e desacoplada entre a interface do usuário (UI) e o motor de rigging desenvolvido pelo Codex.

A camada adaptadora está implementada em `prototypes/studio/proposals/src/shared/rig-bridge.js`.

---

## 1. Princípios Arquiteturais

1. **Desacoplamento Rigoroso**: A interface gráfica nunca manipula propriedades internas do `THREE.Skeleton` ou do `THREE.SkinnedMesh` diretamente. Todas as operações são mediadas pelo adaptador `RiggingBridge`.
2. **Espaço de Coordenadas Único**: Todas as leituras e escritas de coordenadas na UI são medidas no **espaço local da raiz do modelo** (`model-root`), garantindo que rotações de visualização, zoom de câmera ou transformações de nós pais nunca corrompam a posição 3D das articulações.
3. **Imutabilidade e Rastreabilidade**: Cada operação que altera a geometria esquelética gera um comando com snapshot reversível (`from` e `to`), preservando a pilha de Desfazer e Refazer (Undo/Redo).
4. **Isolamento de Operações Estruturais**: O processo de vinculação de skinning (`bindSkin`) é uma operação estrutural que substitui `THREE.Mesh` por `THREE.SkinnedMesh`. Como tal, o histórico anterior de rascunho de pontos é intencionalmente limpo para evitar inconsistências com UUIDs.

---

## 2. Contratos de API (TypeScript Definitions)

```typescript
/** Identificação e coordenadas no espaço da raiz do modelo */
export interface JointData {
  name: string;
  parent: string | null;
  /** Coordenadas [X, Y, Z] relativas à raiz do modelo */
  p: [number, number, number];
  /** Coordenadas locais do osso (quando já vinculado a um Bone) */
  local?: [number, number, number];
  /** Coordenadas no espaço de mundo Three.js */
  world?: [number, number, number];
  uuid?: string;
}

/** Nó da árvore de hierarquia */
export interface HierarchyNode extends JointData {
  children: HierarchyNode[];
}

/** Dimensões e centro geométrico da malha */
export interface ModelBounds {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
  center: [number, number, number];
  vertices: number;
}

/** Relatório de auditoria e telemetria estrutural */
export interface AuditReport {
  schema: 'arenamon-rig-audit';
  version: 1;
  bounds: ModelBounds;
  bones: number;
  skinnedMeshes: number;
  meshes: Array<{
    name: string;
    vertices: number;
    skinned: boolean;
    bones: number;
    unused: number;
    invalidWeights: number;
    zeroWeights: number;
  }>;
  warnings: string[];
  vertexInfluences?: Record<string, number>;
}

/** Métricas de influência de um osso específico */
export interface JointInfluenceMetrics {
  vertexCount: number;
  avgWeight: number;
  maxWeight: number;
  active: boolean;
}

/** Schema de persistência JSON do Rig */
export interface ArenamonRigJSON {
  schema: 'arenamon-rig';
  version: 1;
  space: 'model-root';
  createdAt: string;
  modelName: string;
  templateType: string;
  bounds: ModelBounds;
  joints: Array<{
    name: string;
    parent: string | null;
    p: [number, number, number];
    local?: [number, number, number];
    world?: [number, number, number];
  }>;
  audit?: AuditReport;
}

/** Contrato da Camada Adaptadora */
export interface IRiggingBridge {
  // 1. Gestão e Ciclo de Vida do Modelo
  setModel(root: THREE.Object3D | null): void;
  isSkinned(): boolean;
  getModelBounds(): ModelBounds;

  // 2. Consulta de Ossos e Hierarquia
  getBones(): THREE.Bone[];
  getJoints(): JointData[];
  getJoint(name: string): JointData | null;
  getHierarchyTree(): HierarchyNode[];
  getDescendants(name: string): Set<string>;

  // 3. Seleção e Isolamento
  selectJoint(name: string | null): void;
  selectChain(name: string): void;
  clearIsolation(): void;

  // 4. Edição de Posição e Espelhamento
  setJointPosition(name: string, p: [number, number, number], options?: { recordHistory: boolean }): boolean;
  getSymmetricCompanion(name: string): string | null;
  mirrorSelectedJoint(): void;

  // 5. Histórico (Undo / Redo)
  undo(): boolean;
  redo(): boolean;

  // 6. Auditoria
  refreshAudit(): void;

  // 7. Pesos (Skinning & Heatmap)
  getInfluenceMetrics(name: string): JointInfluenceMetrics;
  getVertexHeatmapColors(name: string): Float32Array | null;

  // 8. Testes de Deformação
  captureRestPose(): void;
  setDeformRotation(boneName: string, axis: 'x' | 'y' | 'z', angleDegrees: number): void;
  restoreRestPose(): void;

  // 9. Vinculação Estrutural
  bindSkin(options?: { smoothness: number }): { bones: THREE.Bone[]; vertices: number; replacements: any[] };

  // 10. Serialização
  exportJSON(): ArenamonRigJSON;
}
```

---

## 3. Mapeamento das Funções do Núcleo Codex consumidas pela UI

A camada adaptadora consome diretamente as funções já estabelecidas e testadas em `prototypes/studio/src/rigging/core.js`:

| Função em `core.js` | Função na Camada Adaptadora | Finalidade |
| :--- | :--- | :--- |
| `modelBounds(root)` | `bridge.getModelBounds()` | Mede a caixa delimitadora precisa no espaço local do modelo. |
| `makeTemplate(bounds)` | `bridge.initTemplate('humanoid-20')` | Gera o rascunho de 20 posições guiadas para personagens bípedes. |
| `makeCreatureTemplate(bounds)` | `bridge.initTemplate('creature-quadruped-24')` | Gera o rascunho de 24 posições guiadas para criaturas quadrúpedes com cauda. |
| `collectBones(root)` | `bridge.getBones()` | Localiza de forma não-redundante todos os `THREE.Bone` na hierarquia. |
| `currentJoints(root)` | `bridge.getJoints()` | Converte posições de mundo dos ossos para o espaço da raiz do modelo. |
| `auditRig(root)` | `bridge.refreshAudit()` | Executa validações geométricas, consistência de pesos, nomes duplicados e vértices sem controle. |
| `validateDraft(draft, bounds)` | `bridge.validateDraft(data)` | Garante unicidade de nomes, ausência de ciclos e raiz única antes de qualquer bind. |
| `applyMirror(draft, name)` | `bridge.mirrorSelectedJoint()` | Calcula o espelho paramétrico em relação ao centro médio. |
| `bindDraftToModel(root, draft, opts)` | `bridge.bindSkin({smoothness})` | Cria os objetos `SkinnedMesh`, `Skeleton`, `skinIndex` e `skinWeight`. |
| `exportCoordinates(root, draft)` | `bridge.exportJSON()` | Serializa com precisão numérica completa para intercâmbio. |

---

## 4. Recomendações e Próximos Passos para o Codex (Fase 2)

Para a implementação subsequente das ferramentas avançadas de rigging, recomenda-se que o Codex disponibilize as seguintes APIs complementares:

1. **Buffer Mutation API (Pintura de Pesos Manual)**:
   - Endpoint: `applyWeightBrush(mesh, boneIndex, brushCenter, radius, strength, mode: 'add' | 'smooth' | 'replace')`
   - Permite que o pincel da UI altere os buffers `skinWeight` diretamente no GPU/CPU sem recriar o `SkinnedMesh`.
2. **Normalizador Rápido de Pesos**:
   - Endpoint: `normalizeSkinWeights(mesh, targetBoneIndex?)`
   - Normaliza as 4 influências por vértice para garantir que a soma seja rigorosamente 1.0.
3. **Two-Bone Analytical IK Solver**:
   - Endpoint: `solveTwoBoneIK(rootBone, midBone, endEffectorBone, targetPosition, poleVector)`
   - Para manipulação direta das patas e mãos no teste de pose.
4. **Bone Reparenting / Topology Editor**:
   - Endpoints: `addBone(name, parent, position)`, `removeBone(name)`, `reparentBone(name, newParent)`.
