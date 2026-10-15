# Rigging guiado (Proposta B)

A aba **Rigging** abre no **Assistente** em cinco etapas. A Proposta B foi aprovada em 15/10/2026 como interface padrão. O botão **Modo avançado** mostra o painel completo que já existia (hierarquia, coordenadas, estrutura, skin, importação e exportação de coordenadas) e dá acesso à **Telemetria / Rig Patch**.

- **Branch:** `feat/studio-rigging-guiado`. Reúne:
  - a base `fa332e0` (usabilidade, Workbench sobre a API oficial e biblioteca CC0);
  - o motor `249e34b` (histórico no `applyPatch` e dois algoritmos de pesos).
- **Merge na `main`:** não foi feito.
- **Propostas A e C:** continuam intactas em `feat/studio-rigging-ui-proposals`.

## Princípio

O Auto-Rig faz o trabalho. O assistente supervisiona, corrige e valida, sem pedir para posicionar cada osso. Toda correção passa pelo motor oficial (adaptador `workbench/engine-official.js`): cada uma é uma entrada no histórico (Ctrl+Z / Ctrl+Y) e os pontos travados são respeitados. O assistente não reconstrói nenhuma ferramenta: usa as funções oficiais de telemetria, Rig Patch, auto-rig, bind e biblioteca.

## Etapas

| Etapa | O que faz |
|---|---|
| **1 · Anatomia** | Lê o personagem: malhas, vértices, forma (bípede ou quadrúpede) e simetria da malha, tudo pela análise oficial. Se já existe rig, ele é **preservado**. Senão, sugere o perfil (humanoide 20 ou quadrúpede 24/27) e gera o Auto-Rig com um clique, já ajustado aos marcos do corpo. |
| **2 · Articulações** | Primeiro os ossos que a telemetria aponta: fora da malha, assimétricos, sem influência, segmento nulo. Há correção em lote ("trazer para dentro da malha"). Os demais ossos ficam numa lista opcional e no mini-mapa 2D, sem exigir confirmação. O osso selecionado é ajustado por arraste do gizmo ou por coordenada, e pode ser travado. |
| **3 · Simetria** | Pares Left/Right com a diferença medida. Correção par a par (Esq → Dir ou Dir → Esq). Se a malha **não** for bilateral, o espelhamento em massa fica desativado. Pontos travados nunca são movidos, e uma assimetria intencional pode ser aceita. |
| **4 · Skinning** | Os dois algoritmos do motor (proximidade de segmento e cápsula gaussiana) e a suavização. A **prévia de deformação** vincula uma **cópia** e dobra cotovelos, joelhos e coluna; o modelo não muda. O skin aplicado é desfazível. Um rig já vinculado tem os pesos preservados e não oferece rebind. |
| **5 · Validação** | Testes de flexão (cotovelos, joelhos, coluna, agachamento e cauda, se houver). Animações CC0 aparecem **só** em humanoides compatíveis; quadrúpedes recebem uma explicação. **Exportar GLB e conferir a reimportação** compara IDs, hierarquia, posições, malhas com skin, vértices sem peso e animações. Também é possível baixar o GLB. |

A câmera volta ao corpo inteiro a cada etapa: frontal para bípedes, lateral para corpos longitudinais. Ao escolher um osso, ela o enquadra.

## Branches verificadas (reconciliação)

| Branch | Situação |
|---|---|
| `fix/studio-usabilidade-viewer` (`fa332e0`) | Base. Contém a Workbench sobre a API oficial (`516ca8d`) e a biblioteca CC0 (`c4dd3c5`). |
| `feat/studio-rig-telemetry-autorig` (`249e34b`) | Mesclada sem conflitos. O adaptador foi ajustado: validação por campo oficial e limites atualizados. Os testes de evidência registram o que foi corrigido. |
| `feat/studio-animation-library` (`3f3cb67`) | Biblioteca CC0 paralela (Quaternius UAL1), feita a partir de `a549d23`, com GLB e FBX binários versionados. **Não foi mesclada:** usa os mesmos caminhos da biblioteca integrada (`library/index.js`, `retarget.js`, `ANIMATION_LIBRARY.md`), e uma união exige decidir uma só biblioteca e a política de binários no Git. Nada dela foi perdido. |
| `feat/studio-rigging-ui-proposals` | Propostas A, B e C intactas. |

## Testes

`node prototypes/studio/test/guided.browser.mjs` roda 10 verificações no Edge, offline, pelos controles da interface, com personagens sintéticos importados como arquivo GLB pelo campo de importação real.

1. Importar → Auto-Rig humanoide com um clique.
2. Problemas da telemetria primeiro, correção em lote.
3. Coordenada e arraste do gizmo, Undo exato, travar.
4. Simetria por par e em lote, com ponto travado preservado.
5. Os dois algoritmos com prévia numa cópia, skin, Undo/Redo.
6. Flexão, Walking CC0, exportação conferida.
7. Reimportar o GLB baixado (IDs, hierarquia, posições, skin, animação) e reconhecer o rig existente sem recriar.
8. Quadrúpede: perfil sugerido, 24 ossos, animações humanoides recusadas, flexão de joelhos e cauda.
9. Criatura assimétrica: espelhamento em massa desativado.
10. Modo avançado completo e retorno ao Assistente.

As capturas ficam em `validation/guiado-*.png` (fora do Git).

## Limitações

- O template humanoide do Auto-Rig coloca pulsos na borda da caixa do modelo. A etapa 2 aponta isso e corrige em lote, mas o ajuste fino em corpos muito arredondados continua manual.
- Os testes de flexão dobram em torno de um eixo calculado pela direção do osso. Servem para revelar problemas de peso, não para reproduzir a anatomia exata (por exemplo, o sentido do joelho traseiro).
- O retarget das animações CC0 não tem IK de pés nem dedos.
