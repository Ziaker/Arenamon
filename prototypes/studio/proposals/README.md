# Arenamon Animation Studio — Redesign Funcional da Área de Rigging
## Relatório Comparativo das Propostas A, B e C

Este documento apresenta a auditoria técnica, arquitetura de integração e detalhamento das três propostas visuais e funcionais desenvolvidas para a reformulação da área de Rigging do **Arenamon Animation Studio**.

O trabalho foi desenvolvido na branch isolada `feat/studio-rigging-ui-proposals`, baseada em `origin/feat/studio-rigging-fase1-gpt6`, preservando integralmente o núcleo técnico desenvolvido pelo Codex e todas as funcionalidades pré-existentes do Studio (importação FBX/GLB, biblioteca de animações, timeline, editor de eventos, root motion, câmeras, organização de clipes e exportação GLB).

---

## 1. Visão Geral dos Protótipos Entregues

Todos os três protótipos são executáveis offline em arquivos HTML únicos e independentes, renderizando modelos 3D estilizados com Three.js, esqueleto visível, marcadores clicáveis, gizmo de transformação e ferramentas completas:

| Arquivo HTML | Proposta | Paradigma Principal | Filosofia e Público-Alvo |
| :--- | :--- | :--- | :--- |
| **`proposta-a.html`** | **PROPOSTA A** | **Rigging Workspace** | Layout clássico em 3 colunas (DCC / Maya / Blender). Foco em densidade de ferramentas e acesso direto para animadores experientes. |
| **`proposta-b.html`** | **PROPOSTA B** | **Guided Rigging** | Assistente visual sequencial em 5 etapas (AccuRIG / Mixamo). Conduz o usuário com salvaguardas, linguagem natural e mini-mapa 2D. |
| **`proposta-c.html`** | **PROPOSTA C** | **Hybrid Rigging Studio** | Conceito adaptativo moderno (Control Rig / Figma / Unreal). Alterna instantaneamente entre Modo Guiado e Modo Estúdio Livre com gavetas retráteis e breadcrumbs. |
| **`index.html`** | **Portal Comparador** | **Hub de Navegação** | Painel unificado para abrir qualquer uma das três propostas e comparar suas métricas e fluxos lado a lado. |

---

## 2. Diferenças Conceituais entre as Três Abordagens

```
+---------------------------------------------------------------------------------------------------+
| PROPOSTA A (Rigging Workspace)                                                                    |
| [Topbar: Model Switcher / Undo / Redo / JSON]                                                     |
| [Coluna 1: Árvore + Auditoria] | [Coluna 2: Viewport 3D + Quad-View + HUD] | [Coluna 3: Inspetor] |
| - Fluxo livre não-linear, sem passos obrigatórios. Acesso simultâneo a todas as variáveis.        |
+---------------------------------------------------------------------------------------------------+

+---------------------------------------------------------------------------------------------------+
| PROPOSTA B (Guided Rigging)                                                                       |
| [Stepper Superior: 01 Anatomia -> 02 Articulações -> 03 Simetria -> 04 Skinning -> 05 Validação]  |
| [Painel Esquerdo: Assistente Passo a Passo + Mini-mapa 2D Paper Doll] | [Viewport 3D com Foco]     |
| - Fluxo sequencial guiado. O usuário só se preocupa com os controles pertinentes à etapa atual.   |
+---------------------------------------------------------------------------------------------------+

+---------------------------------------------------------------------------------------------------+
| PROPOSTA C (Hybrid Rigging Studio)                                                                |
| [Topbar: Mode Switcher (Guiado ⇄ Estúdio Livre) | Dock Toggles (◧ Hierarquia / ◨ Inspetor)]       |
| [Breadcrumbs 3D: Arenamon › Hips › Spine › LeftShoulder › LeftElbow]                             |
| [Viewport Imersivo Quase Fullscreen com Docks Flutuantes e Bancada de Deformação Inferior]        |
| - Adaptabilidade total. Começa guiado e pode ser aprofundado a qualquer momento em 1 clique.      |
+---------------------------------------------------------------------------------------------------+
```

### PROPOSTA A — Rigging Workspace
- **Estrutura**:
  - **Coluna Esquerda**: Árvore esquelética completa e expansível, busca em tempo real com realce, identificação visual de pai e filhos, botões para seleção de cadeia de descendentes (`Cadeia`) e isolamento, caixa de auditoria estrutural e avisos de topologia.
  - **Centro**: Viewport 3D com barra HUD de vistas técnicas (Persp, Frente, Lateral, Topo, Trás), modo **Quad-View** (4 quadrantes simultâneos para alinhamento ortogonal preciso), botão de enquadramento (Frame Joint), toggles de Raio-X, marcadores e cones ósseos, slider de transparência da malha e checkbox de simetria X-Mirror.
  - **Coluna Direita**: Inspetor organizado em 3 abas temáticas:
    1. *Articulação*: Nome, pai, comprimento euclidiano, links clicáveis para os filhos, coordenadas no espaço da raiz (inputs numéricos com precisão decimal), botão de espelhamento L/R e contadores de influência.
    2. *Pesos (Skin)*: Ativação de mapa de calor térmico na malha 3D, legenda visual de gradiente (azul escuro → ciano → verde → amarelo → vermelho), controles de pincel de edição (raio, intensidade, suavização) e normalização.
    3. *Flexão / Pose*: Eixo de teste (X/Y/Z), slider angular de -90° a +90°, botão de restauração para pose de repouso (0°) e presets rápidos de postura (T-Pose, Dobra Braços 45°, Torção Tronco 30°, Agachamento).

### PROPOSTA B — Guided Rigging
- **Estrutura**:
  - **Barra Superior**: Stepper horizontal proeminente com badges numerados e status de progresso (1 Anatomia → 2 Articulações → 3 Simetria → 4 Skinning → 5 Validação).
  - **Coluna Esquerda (Assistente Guiado)**:
    - *Etapa 1 (Anatomia)*: Escolha do modelo base (Golem Bípede vs Besta Quadrúpede ou upload de GLB), leitura das dimensões da caixa delimitadora do personagem (altura, largura, profundidade) e checklist de integridade da malha.
    - *Etapa 2 (Articulações)*: Foco guiado nas articulações, coordenadas locais, botões `← Anterior` e `Próximo →` para inspeção sequencial, e **Mini-mapa 2D Interativo (Paper Doll)** com nós clicáveis para navegação direta no corpo do personagem.
    - *Etapa 3 (Simetria)*: Ferramentas automatizadas `⇄ Espelhar Todos os Membros (Left → Right)` e `(Right → Left)` em 1 clique, com checklist de validação do eixo sagital e verificação de alinhamento ao chão.
    - *Etapa 4 (Skinning)*: Slider de fator de suavização do algoritmo, botão principal `⚙ Executar Skinning (Auto-Bind)` e mapa de calor imediato da influência.
    - *Etapa 5 (Validação)*: Testes rápidos de flexão com 1 clique (Flexão Cotovelos, Flexão Joelhos, Giro de Coluna, Agachamento), restauração da pose de repouso e exportação homologada do JSON de coordenadas.
  - **Coluna Direita / Viewport**:
    - Câmera inteligente que enquadra e reposiciona o ângulo do modelo conforme a etapa e articulação ativa.

### PROPOSTA C — Hybrid Rigging Studio
- **Estrutura**:
  - **Alternador de Modo**: Seletor no topo entre `Modo Guiado` (com roteiro inteligente e cartões simplificados) e `Modo Estúdio Livre` (com todas as ferramentas profissionais expostas).
  - **Breadcrumbs de Linhagem 3D**: Trilha de navegação flutuante no topo do viewport (`Arenamon › Hips › Spine › LeftClavicle › LeftShoulder...`). Clicar em qualquer ancestral seleciona instantaneamente o osso na hierarquia e na cena 3D.
  - **Docks Flutuantes Retráteis**:
    - *Dock Esquerda*: Hierarquia completa com busca, que pode ser recolhida via botão `◧ Hierarquia` para liberar visão panorâmica da criatura.
    - *Dock Direita*: Inspetor cirúrgico com coordenadas XYZ e o módulo **Quick-Fix Inteligente**, que analisa anomalias da articulação selecionada e oferece correções em 1 clique (ex.: *Ação Rápida de Simetria* com botão direto de espelhamento).
    - *Dock Inferior*: Bancada de flexão rápida com slider angular, botão de retorno à Rest Pose, slider de opacidade e botão de ativação de mapa de calor em tempo real.

---

## 3. Relação de Funcionalidades

### A. Funcionalidades Realmente Operacionais (Conectadas ao Three.js e ao Núcleo)
1. **Seleção e Inspeção de Articulações**:
   - Seleção bidirecional: clicando nos marcadores esféricos no viewport 3D (via raycasting) ou clicando nos nós da árvore / mini-mapa 2D.
   - Leitura e atualização instantânea de nomes, pais, filhos e comprimento euclidiano da articulação.
2. **Edição Numérica e Transformação Visual**:
   - Inputs de coordenadas X, Y, Z no espaço local da raiz do modelo (`model-root`), com precisão de até 4 casas decimais.
   - Manipulador visual 3D (TransformControls) de translação em tempo real acoplado ao osso selecionado.
3. **Simetria e Espelhamento**:
   - Espelhamento paramétrico automático em relação ao plano médio sagital (calculado a partir da bounding box da malha).
   - Espelhamento individual ou em lote de todos os pares `Left ↔ Right`.
4. **Histórico Completo de Desfazer e Refazer (Undo/Redo)**:
   - Registro de comandos estruturados com estados anteriores e posteriores, permitindo reverter translações sem perda de precisão.
5. **Visualização 3D e Câmeras**:
   - Renderização PBR com iluminação de três pontos (luz principal direcional com sombras suaves, luz de preenchimento ciano e luz de borda violeta).
   - Presets de câmera Frontal, Lateral, Superior, Traseira e Perspectiva Orbital.
   - Modo **Quad-View** funcional, renderizando simultaneamente 4 quadrantes sincronizados com tesoura WebGL (Scissor/Viewport).
   - Ajuste em tempo real de transparência da malha (opacidade de 5% a 100%).
   - Modo Raio-X funcional, garantindo visibilidade contínua dos marcadores e ossos sobre a malha sem corte de profundidade (`depthTest: false`).
   - Conectores ósseos estilizados (cones octaédricos) atualizados geometricamente ao mover qualquer articulação.
6. **Suporte a Criaturas Não-Humanoides**:
   - Alternância funcional entre **Golem Bípede (20 ossos)** e **Besta Quadrúpede com Cauda e Chifres (24 ossos)**, com anatomia adaptada e conectividade esquelética completa.
   - Suporte a carregamento de modelos externos em formato `.glb` ou `.gltf` locais via `<input type="file">`.
7. **Teste de Deformação e Rest Pose**:
   - Rotação temporária de bones em tempo real com deformação de malha no GPU.
   - Botão para retorno imediato à pose de repouso (0° em todos os eixos).
8. **Visualização Térmica de Pesos (Heatmap)**:
   - Projeção de cores de vértice térmicas dinâmicas (azul marinho → ciano → verde → amarelo → vermelho) baseadas nos pesos reais de skinning do osso selecionado.
9. **Exportação e Importação de Coordenadas JSON**:
   - Emissão e leitura determinística do JSON de coordenadas estruturado conforme schema `arenamon-rig`.
10. **Auditoria Estrutural**:
    - Diagnóstico de contagem de ossos, malhas skinned, vértices totais, detecção de ossos coincidentes e avisos de ausência de skin.

### B. Funcionalidades Demonstrativas (Projetadas para Fases Posteriores do Codex)
1. **Pintura Manual de Pesos com Pincel (Brush Weight Painting)**:
   - Os controles de Raio, Intensidade, Força e Suavização representam o design e a ergonomia da ferramenta de edição manual de pesos da Fase 2. A aplicação real de pesos por pincel dependerá da disponibilização pelo Codex da API de modificação dos buffers `skinWeight` do Three.js.
2. **Normalização Global dos Buffers de Vértices**:
   - O botão `Normalizar Pesos` demonstra o ponto de chamada do algoritmo de normalização que será exposto pelo núcleo do Codex.
3. **IK / Cinemática Inversa**:
   - Os protótipos focam em rigging direto (Forward Kinematics / FK). A cadeia de cinemática inversa com solver analítico de dois ossos para membros será integrada quando homologada pelo Codex.
4. **Retargeting Automático de Animações**:
   - O ajuste da pose de repouso atualiza as coordenadas e as matrizes de bind, mas o retargeting de trilhas de animações importadas de terceiros (ex.: Mixamo) segue como módulo futuro.

---

## 4. Camada de Integração e Contrato de API (Codex Bridge)

Para assegurar total desacoplamento entre as interfaces de usuário e a evolução do motor interno, foi estabelecido um contrato formal encapsulado na classe `RiggingBridge` (`src/shared/rig-bridge.js`):

### Métodos Principais do Contrato:

```typescript
interface RiggingBridgeAPI {
  // Gestão de Modelo e Estado
  setModel(root: THREE.Object3D): void;
  isSkinned(): boolean;
  getBones(): THREE.Bone[];
  getJoints(): JointData[];
  getJoint(name: string): JointData | null;
  getHierarchyTree(): TreeNode[];

  // Seleção e Manipulação
  selectJoint(name: string | null): void;
  selectChain(name: string): void;
  clearIsolation(): void;
  setJointPosition(name: string, p: [number, number, number], options?: { recordHistory: boolean }): boolean;
  mirrorSelectedJoint(): void;

  // Histórico
  undo(): boolean;
  redo(): boolean;

  // Auditoria e Diagnósticos
  refreshAudit(): AuditReport;
  getModelBounds(): ModelBounds;

  // Weight Painting e Influência
  getInfluenceMetrics(name: string): { vertexCount: number; avgWeight: number; maxWeight: number; active: boolean };
  getVertexHeatmapColors(name: string): Float32Array | null;

  // Deformação e Pose de Teste
  setDeformRotation(boneName: string, axis: 'x' | 'y' | 'z', angleDegrees: number): void;
  restoreRestPose(): void;

  // Skinning e Serialização
  bindSkin(options?: { smoothness: number }): BindResult;
  exportJSON(): ArenamonRigJSON;
}
```

Esta arquitetura garante que, assim que o Codex aprimorar os algoritmos de skinning ou expuser endpoints adicionais, a interface continuará operacional sem refatoração de layout.

---

## 5. Como Executar os Protótipos

Os arquivos gerados são 100% autossuficientes e não realizam nenhuma requisição de rede:

1. **Pelo Navegador (Duplo Clique)**:
   - Abra diretamente qualquer um dos arquivos abaixo no Edge, Chrome ou Firefox:
     - `prototypes/studio/proposals/index.html` (Portal Comparador)
     - `prototypes/studio/proposals/proposta-a.html` (Proposta A)
     - `prototypes/studio/proposals/proposta-b.html` (Proposta B)
     - `prototypes/studio/proposals/proposta-c.html` (Proposta C)
2. **Recompilação dos Bundles**:
   ```bash
   node prototypes/studio/proposals/build.mjs
   ```
3. **Execução da Suíte de Testes Automatizados**:
   ```bash
   node prototypes/studio/proposals/test-proposals.mjs
   ```

---

## 6. Capturas de Tela Geradas

As capturas de alta resolução encontram-se salvas na pasta `prototypes/studio/proposals/screenshots/`:
- `proposta-a.png`: Visualizador profissional em 3 colunas, Besta Quadrúpede com cauda selecionada, gizmo 3D e painel de flexão.
- `proposta-b.png`: Assistente visual guiado na Etapa 5 (Validação), com botões rápidos de teste de dobra e Golem Bípede.
- `proposta-c.png`: Studio Híbrido com modo assistido ativo, breadcrumbs 3D no topo, gavetas flutuantes e quick-fix de simetria.
- `propostas-portal.png`: Portal comparativo com tabela de recursos e botões de lançamento.
