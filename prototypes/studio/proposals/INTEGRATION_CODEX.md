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

/** Schema de persistência JSON do Rig (compatível com v1 e v2 canônico) */
export interface ArenamonRigJSON {
  schema: 'arenamon-rig';
  version: 1 | 2;
  space: 'model-root';
  createdAt: string;
  modelName: string;
  templateType: string;
  bounds: ModelBounds;
  joints: Array<{
    id?: string;
    name: string;
    parent: string | null;
    p: [number, number, number];
    q?: [number, number, number, number];
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

## 4. Resolução da Inconsistência: 24 Ossos Declarados vs 27 Articulações Construídas

Durante a auditoria da anatomia quadrúpede (`makeCreatureTemplate`), foi identificada uma contradição numérica entre o identificador histórico (`creature-quadruped-24`) e o esqueleto instanciado (27 juntas).

### A. Investigação Anatômica:
| Grupo Anatômico | Articulações Instanciadas | Quantidade | Classificação |
| :--- | :--- | :--- | :--- |
| **Coluna e Cabeça** | `Hips`, `SpineBack`, `SpineChest`, `Neck`, `Head` | 5 | Base Quadrúpede |
| **Cauda Segmentada** | `Tail1`, `Tail2`, `Tail3` | 3 | Base Quadrúpede |
| **Patas Dianteiras** | `Left/RightShoulder`, `Left/RightFrontKnee`, `Left/RightFrontAnkle`, `Left/RightPaw` | 8 | Base Quadrúpede |
| **Patas Traseiras** | `Left/RightHip`, `Left/RightBackKnee`, `Left/RightBackAnkle`, `Left/RightBackPaw` | 8 | Base Quadrúpede |
| **Subtotal Base (Locomoção)** | *Esqueleto motor padrão para locomoção quadrúpede pura* | **24** | **Padrão 24** |
| **Estilização Facial / Monstros** | `Jaw` (mandíbula articulada), `LeftHorn`, `RightHorn` (chifres) | 3 | Adicional Criatura |
| **Total Instanciado** | *Esqueleto completo de besta fantástica estilizada* | **27** | **Expandido 27** |

### B. Resolução Técnica (Sem Redefinição Unilateral):
A inconsistência foi resolvida sem descartar os apêndices estilizados e sem forçar uma escolha unilateral sobre o template:
1. **Variante Criatura Estilizada (`creature-quadruped-27`)**: Instancia todas as 27 articulações (24 base + mandíbula e chifres). Nesta variante, `declaredCount === 27` e `actualCount === 27`.
2. **Variante Quadrúpede Base (`creature-quadruped-24`)**: Instancia exclusivamente as 24 articulações essenciais de locomoção. Nesta variante, `declaredCount === 24` e `actualCount === 24`.
3. **Controle na Interface**: Todas as três propostas oferecem a seleção explícita entre as duas variantes no menu de modelos, garantindo total conformidade entre a quantidade anunciada e a quantidade gerada em cena.

---

## 5. Compatibilidade Canônica com o Schema v2 e Persistência em SkinnedMesh

### Status de Compatibilidade com o Núcleo Estabilizado do Codex (commit 7323b48):
> [!IMPORTANT]
> O núcleo técnico do Codex na branch `codex/rig-editor-stabilization` (commit `7323b48`) introduziu o schema versão 2 (`schema: 'arenamon-rig'`, `version: 2`), com suporte a identificadores persistentes (`id`/`uuid`) e orientações em quaternion (`q: [x, y, z, w]`).
> A camada adaptadora `RiggingBridge` agora implementa **compatibilidade canônica integral com o Schema v2**:
> 1. **Validação Estrutural Canônica Idêntica ao Codex**: A importação de JSON executa a função canônica `validateDraftStructure(data)`, rejeitando com erro impeditivo imediato:
>    - Schemas desconhecidos ou formatos sem o array `joints` (`JSON de rig inválido: esperado schema arenamon-rig e joints.`);
>    - Versões não suportadas (`Versão de rig não suportada: X. Use JSON v1 ou v2.`);
>    - Articulações sem `id` no JSON v2 (`ID obrigatório no JSON v2: <nome>`);
>    - IDs duplicados (`ID de osso duplicado: <id>`);
>    - Quaternions ausentes ou não-finitos no JSON v2 (`Quaternion obrigatório e finito no JSON v2: <nome>`);
>    - Ciclos na hierarquia (`Ciclo no esqueleto: <nome>`);
>    - Esqueletos sem raiz ou com raízes múltiplas (`O esqueleto precisa de exatamente um osso raiz.`);
>    - Coordenadas ausentes ou fora do limite de segurança (`Coordenada fora de limite: <nome>`).
> 2. **Garantia de Exportação v2 Estritamente Válida**: O método `exportJSON({ version: 2 })` assegura que 100% das articulações contenham identificadores únicos gerados via `newJointId()` e quaternions finitos `[x, y, z, w]`, validando o payload completo com `validateDraftStructure(coords)` antes de emitir o arquivo.
> 3. **Persistência Real em Modelos com SkinnedMesh Ativo (`isSkinned() === true`)**:
>    - Ao vincular (`bindSkin`) ou carregar um modelo já com pele, cada instância real de `THREE.Bone` recebe `bone.userData.arenamonJointId` e seu `bone.quaternion`.
>    - O modelo Three.js mantém metadados canônicos em `model.userData.arenamonRig` com `version: 2`.
>    - A importação de coordenadas ou transformações diretamente em modelos com pele ativa atualiza em tempo real `bone.position`, `bone.userData.arenamonJointId`, `bone.quaternion` e `model.userData.arenamonRig`.
>    - O ciclo de histórico (**Undo / Redo**) restaura simetricamente tanto as transformações espaciais quanto o `userData.arenamonJointId`, `quaternion` e metadados nos ossos reais.

### 5.1. Proteção Não-Destrutiva de Cores de Vértices (Heatmap Multi-Malha):
Ao desativar a visualização térmica de pesos (`setHeatmap(false)`), o sistema não destrói mais as cores pré-existentes de malhas importadas (por exemplo, GLBs com vertex colors):
- Malhas que já possuíam atributo `color` têm seu buffer e sinalizador de material (`vertexColors = true`) preservados em backup (`userData.__origVertexColorAttribute`) e integralmente restaurados.
- Malhas sem cores originais têm o atributo temporário removido e `vertexColors` restaurado para `false`.

### 5.2. Câmeras Técnicas Ortográficas no Modo Quad-View:
O modo Quad-View não clona mais a `PerspectiveCamera`:
- Utiliza uma instância dedicada de `THREE.OrthographicCamera` (`viewport.orthoCam`).
- O frustum (left, right, top, bottom) é dimensionado analiticamente a partir das dimensões da caixa delimitadora do modelo (`modelBounds`) e da proporção de aspecto de cada quadrante.
- O quadrante Superior (Top View) define explicitamente o vetor superior como `up.set(0, 0, -1)`, eliminando bloqueio de gimbal e singularidades na renderização em projeção paralela estrita.

### 5.3. Testes Ponta a Ponta com Eventos Reais de Mouse no Canvas:
A suíte Playwright (`test-proposals.mjs`) foi expandida para além das chamadas programáticas:
- Exercita eventos reais de ponteiro (`page.mouse.move`, `page.mouse.down`, `page.mouse.move`, `page.mouse.up`) sobre os manipuladores de eixo do `TransformControls` no canvas WebGL.
- Comprova a ativação do estado `dragging`, a emissão de `dragging-changed`, o deslocamento de coordenadas 3D em tempo real, o registro de histórico atômico e a restauração perfeita pelo Undo.

---

## 6. Integração Contínua (CI) e Isolamento de Responsabilidades

1. **Workflow Dedicado às Propostas (`studio-rigging-proposals.yml`)**:
   - Criado em `.github/workflows/studio-rigging-proposals.yml` para disparar em `push` e `pull_request` na branch `feat/studio-rigging-ui-proposals`.
   - Executa a compilação offline das três propostas, a suíte completa de testes automatizados Playwright e `npm run verify`, publicando os HTMLs e capturas como artefatos de build.
2. **Preservação do Workflow Principal do Codex/Claude (`arenamon-studio-rigging.yml`)**:
   - O pipeline existente permanece intacto e dedicado à branch `feat/studio-rigging-fase1-gpt6`.
   - Não há interferência entre os ambientes de CI.
3. **Ambiente dos Runners**:
   - Os runners do GitHub Actions executam sobre **Windows Server 2025**. O lançador do Playwright em `test-proposals.mjs` foi desenhado com estratégia de fallback multicanais (`chromium` nativo -> `msedge` -> `chrome`), assegurando execução resiliente em ambientes locais e de CI.

---

## 7. Recomendações e Próximos Passos para o Codex (Fase 2)

Para a entrega estrutural da Fase 2, recomenda-se que o Codex forneça:

1. **Buffer Mutation API (Pintura Manual de Pesos)**:
   - `applyWeightBrush(mesh, boneIndex, brushCenter, radius, strength, mode: 'add' | 'smooth' | 'replace')`
2. **Normalizador Rápido de Pesos**:
   - `normalizeSkinWeights(mesh, targetBoneIndex?)`
3. **Two-Bone Analytical IK Solver**:
   - `solveTwoBoneIK(rootBone, midBone, endEffectorBone, targetPosition, poleVector)`
4. **Topology & Reparenting Editor**:
   - `addBone(name, parent, position)`, `removeBone(name)`, `reparentBone(name, newParent)` com verificação estrita de aciclicidade e IDs únicos.

