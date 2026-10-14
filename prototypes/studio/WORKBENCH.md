# Rigging Telemetry Workbench

Aba **Telemetria** do Animation Studio. É uma bancada para inspecionar um rig, gerar instruções de correção com uma IA e aplicá-las de forma verificável, sem posicionar cada articulação à mão.

- **Base:** núcleo de Rigging do Codex (`origin/codex/rig-editor-multimesh-tests`, `35213f9`).
- **Branch:** `feat/studio-rig-workbench`.
- **Propostas A, B e C:** continuam intocadas em `feat/studio-rigging-ui-proposals`, aguardando a sua avaliação.

## Demonstração

Sem modelo carregado, a aba mostra **Carregar demonstração**. O botão monta um personagem sintético complexo, sem recursos proprietários, pelo fluxo real do Codex:
- 6 malhas independentes;
- template humanoide de 20 ossos;
- cotovelo direito 0,134 fora do espelho;
- skin;
- um clipe com uma trilha órfã.

## Fluxo

**Inspecionar → Diagnosticar → Corrigir → Comparar → Aplicar → Validar**

1. **Inspecionar.** Visão geral com os números do motor:
   - ossos e malhas (quantas com skin);
   - vértices;
   - articulações com aviso, pesos inválidos e vértices sem influência;
   - trilhas órfãs e estado do skinning.

   Na árvore (clique, ou teclado ↑↓←→, Home e End) ou no visualizador 3D (clique no marcador), a seleção é sincronizada com o motor do Codex. Para cada osso aparecem:
   - nome, ID persistente, pai e filhos;
   - posição local, relativa à raiz e global;
   - quaternion e comprimento do segmento;
   - influência por malha, simetria e avisos;
   - no modo **Avançado**: UUID, matriz de bind inversa e o JSON.

   Malhas independentes mostram:
   - vértices e ossos que as influenciam;
   - influências por vértice e histograma do peso dominante;
   - vértices sem influência e pesos inválidos.

   **Camadas visuais:** esqueleto, eixos do osso, simetria, heatmap real de pesos e regiões problemáticas (vértices sem influência).
2. **Diagnosticar.**
   - Avisos do `auditRig` e assimetria por par Left/Right, medida com `applyMirror` do Codex.
   - Compatibilidade de cada animação: trilhas ligadas e órfãs.
   - **Copiar para IA:** instruções com o formato do patch, mais a telemetria completa.
   - **Copiar JSON completo**.
   - **Copiar seleção:** os ossos marcados com Espaço ou caixa na árvore.
   - **Exportar JSON** para arquivo.
3. **Corrigir.**
   - Cole a resposta da IA ou importe um arquivo. Ctrl+Enter verifica os comandos.
   - Erros mostram o caminho exato (`ops[2].p`, linha do JSON) e a etapa que recusou: estrutura, operação pendente ou motor do Codex.
   - Um JSON de coordenadas do Codex (`arenamon-rig`) também é aceito: vira um patch de `setPosition`.
4. **Comparar.** É um **ensaio real**:
   1. o patch é aplicado com o motor do Codex;
   2. a telemetria é medida;
   3. a transação é desfeita, e a Workbench confere que o rig voltou exatamente ao estado anterior.

   Mostra os ossos alterados, com Δ posição, Δ rotação, nome e hierarquia, e os ossos criados e removidos. Mostra também os avisos resolvidos e os novos, as mudanças de pesos, e o esqueleto original e o proposto (em laranja) no visualizador.

   Para um rascunho ainda sem skin, **"Prever pesos após o bind"** roda o `bindDraftToModel` real do Codex em cópias do modelo, antes e depois.

   Você confirma ou cancela.
5. **Aplicar.** Uma única entrada **"Rig Patch"** no histórico do Studio. Desfazer e refazer funcionam pelos botões ou por Ctrl+Z e Ctrl+Y, sempre o patch inteiro.
6. **Validar.** Gera a telemetria de novo e compara com a de antes: métricas, assimetria e avisos.

## Auto-rig assistido

Fica em **Corrigir**, quando a malha não tem rig.

| Função | Situação |
|---|---|
| Perfil anatômico | **Humanoide · 20 ossos** (`makeTemplate` do Codex) |
| Perfis Quadrúpede 24 e Criatura 27 | **Desabilitados:** aguardam o auto-rig aprimorado do Codex |
| Proposta de esqueleto | Visível antes do bind, na árvore e no visualizador |
| Correção manual | Por patch ou pelos controles da aba Rigging |
| Coordenadas corrigidas | Por JSON |
| Prévia de pesos | Disponível |
| Skinning | `bind` do Codex |
| Teste de deformação | Aba Rigging, "Rotação de teste" |
| Desfazer | Disponível |
| **Incerteza do posicionamento** | O motor atual **não informa** a incerteza por ponto, e a interface diz isso explicitamente. Nenhum valor é inventado. |
| **Regenerar região** e **fixar ossos** | Botões desabilitados, marcados **"Experimental · aguarda API do auto-rig aprimorado do Codex"** |

## Rig Patch JSON (`arenamon-rig-patch`, versão 1)

```json
{
  "schema": "arenamon-rig-patch", "version": 1, "space": "model-root",
  "description": "Simetria do cotovelo e nome da cabeça",
  "ops": [
    {"op": "mirror", "joint": "joint-…LeftElbow", "note": "o cotovelo direito está 0,13 fora do espelho"},
    {"op": "rename", "joint": "joint-…Head", "name": "HeadMain"}
  ]
}
```

| Operação | Campos | Aplicação no Studio hoje |
|---|---|---|
| `setPosition` | `joint`, `p` | ✓ `applyJoint` do Codex |
| `translate` | `joint`, `delta` | ✓ `applyJoint` |
| `mirror` | `joint` (lado Left) | ✓ `applyMirror` + `applyJoint` |
| `rename` | `joint`, `name` | ✓ `renameBone` (ID mantido) |
| `reparent` | `joint`, `parent` | ✓ `reparentBone` |
| `addJoint` | `name`, `parent`, `p` | ✓ `addBone` + `renameBone` + `applyJoint` |
| `removeJoint` | `joint` | ✓ `deleteBone` |
| `setRotation` | `joint`, `q` | **Pendente:** o Codex não expõe a rotação de repouso (`commitOrientation` é interno). É recusado com essa mensagem. |

Detalhes do formato:
- `joint` e `parent` aceitam o **ID persistente** (recomendado) ou o nome.
- As coordenadas ficam no espaço da raiz do modelo, com a precisão completa do modelo.
- Cada operação pode ter `note`.

## Origem dos dados (nenhum indicador inventado)

| Dado | Origem |
|---|---|
| Ossos, IDs, hierarquia, posições e quaternions | `currentJoints` do Codex, ou o rascunho do Codex |
| Avisos, malhas, pesos inválidos, vértices sem influência e vértices por osso | `auditRig` do Codex |
| Assimetria | `applyMirror` do Codex numa cópia do rascunho |
| Matrizes de bind, pesos por osso e malha, histogramas e heatmap | `skeleton.boneInverses` e `skinIndex`/`skinWeight` (dados brutos) |
| Trilhas órfãs | `THREE.PropertyBinding.findNode` |
| Validação e simulação | `validateDraft` e as operações de rascunho do Codex (`renameDraftJoint`, `reparentDraftJoint`, `addDraftJoint`, `removeDraftJoint`) |

## Arquitetura e integração

| Arquivo | Papel |
|---|---|
| `src/workbench/patch.js` | Formato, validação estrutural, simulação no rascunho (funções do Codex) e diff por ID. Puro, testável em Node. |
| `src/workbench/telemetry.js` | Telemetria a partir do motor do Codex e dos dados brutos. Puro. |
| `src/workbench/engine-codex.js` | Adaptador para o motor real no Studio: validação, ensaio, aplicação em transação única e prévia de bind. |
| `src/workbench/viewer.js` | Camadas 3D e seleção por clique. Recebe um `importer` com `model`, `scene`, `camera` e `renderer`. |
| `src/workbench/panel.js` | Interface: `mountWorkbench(container, {engine, viewer, layout})`. Não depende do layout do Studio. |
| `src/workbench/styles.js` | CSS injetado pelo componente. Usa as variáveis do Studio, se existirem. |
| `src/workbench/index.js` | Montagem na aba Telemetria do Studio. |

Fora da pasta, a integração só toca três pontos do Studio: um botão e uma seção em `ui/shell.html`, o título e `NEEDS_MODEL` em `ui/layout.js`, e um `import` em `main.js`. **Nenhum arquivo central de Rigging do Codex foi alterado.**

### Contrato do motor consumido pelo painel

```text
available(): boolean                 state(): 'sem-rig'|'rascunho'|'ossos-sem-skin'|'vinculado'
telemetry({select?}): Telemetry      validate(patch): {ok, stage?, errors?, patch?, steps?}
dryRun(patch): {ok, before, after, changes, warnings:{resolved,added}, influence}
apply(patch): {ok, label}            bindPreview(patch): {ok, before, after, influence, warnings}
select(id) · selectedId() · undo() · redo() · historyState() · patchFromRigJSON(rig)
autoRig: {profiles[], createTemplate(), bind(), uncertainty: null, regenerateRegion: null, lockJoints: null}
```

### Proposta escolhida (A/B/C)

O painel e o visualizador não dependem de nenhuma proposta. Para montá-los na proposta escolhida, ela precisa fornecer um motor com o contrato acima. Há dois caminhos:
- usar o `createCodexEngine` (exige o núcleo do Codex e os pontos públicos `window.__studioRig` e `window.__studioEditor.history`);
- escrever um adaptador sobre o `RiggingBridge` da proposta, com as mesmas funções.

A escolha da proposta continua sendo sua.

### API que o Codex ainda precisa expor

Isto completa a bancada sem contornos.
1. **Telemetria e correções programáticas oficiais**, por exemplo `rig.telemetry()` e `rig.applyPatch(patch, {dryRun})`, com transação e retorno de diferenças. A Workbench passaria a chamá-las no lugar do adaptador.
2. **Rotação de repouso pública** (`setRotation`).
3. **Auto-rig aprimorado:** perfis além do humanoide, incerteza por ponto, regenerar região e ossos fixos.
4. **Aplicação sem passar pela interface do Rigging.** Hoje, renomear e reparentar via adaptador usam os campos `#rg-name` e `#rg-parent-select` do Codex, e excluir confirma pelo `window.confirm` do Codex, substituído durante a transação.

## Testes

| Comando | O que cobre |
|---|---|
| `node prototypes/studio/test/workbench.test.mjs` | 10 testes com o motor real do Codex: telemetria, pesos, simetria, trilhas órfãs, seleção, validação estrutural, simulação e rejeições do Codex, prévia de bind e conversão de coordenadas |
| `node prototypes/studio/test/workbench.browser.mjs` | 17 verificações no Edge, offline, com interação real (cliques, teclado, clique no 3D, área de transferência, download) |

Os 17 cenários de navegador:
0. estado vazio e demonstração;
1. personagem com 6 malhas, com rig e skin feitos pelos botões do Codex;
2. visão geral, com animação pausada;
3. clique na árvore mostra os dados completos do osso;
4. teclado na árvore navega e marca ossos;
5. clique no 3D seleciona o osso, sincronizado com o motor;
6. heatmap real de pesos;
7. copiar e exportar a telemetria;
8. rejeição de patches inválidos;
9. comparação com ensaio real e cancelamento;
10. aplicação;
11. desfazer e refazer por botão e por Ctrl+Z/Ctrl+Y;
12. validação com nova telemetria;
13. GLB exportado e reimportado (IDs, nomes, hierarquia, posições e skin);
14. patch estrutural (criar, reparentar e excluir);
15. auto-rig assistido;
16. celular (390 px).

As capturas ficam em `validation/workbench-*.png`.

## CI (estado verificado em 14/10/2026)

- **Esta branch (`Arenamon Studio Rig Workbench`):** todas as suítes do Studio passam no executor `windows-latest` sem GPU, pelo `npm run verify:studio-workbench`:

  | Suíte | Resultado |
  |---|---|
  | Editor (unitários) | 18 |
  | Rigging do Codex (unitários) | 12 |
  | Workbench (unitários) | 10 |
  | Rigging do Codex (navegador) | 17 |
  | Workbench (navegador) | 17 |
  | `verify` do Studio | 20 |

  A etapa de layout do `verify` do Studio estourava 30 s. A causa é a composição do canvas WebGL em software, medida em `fix/studio-diagnostic-ci`; a correção (modo leve só sem GPU) foi portada em commit próprio.
- **`npm run verify` completo:** falha no executor sem GPU **fora do Studio**, já na primeira suíte (`prototypes/placeholders/verify.mjs`, timeout do Playwright). Não foi alterado: fora do escopo desta entrega.
- **`feat/studio-rigging-ui-proposals` (`ae39c73`, última execução):** todas as etapas do Studio passam (build, validação cruzada com o Codex e testes das propostas). A falha está no passo "Verify repository status", em `prototypes/game/verify.mjs:35` (direção das setas da câmera do jogo), fora do Studio. Não alterei essa branch nem esses testes.
