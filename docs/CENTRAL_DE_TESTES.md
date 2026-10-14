# Arenamon — Central de Testes e Matriz de Verificação

Este documento consolida a documentação técnica de todas as suítes de testes do repositório Arenamon, indicando seus objetivos, comandos de execução, códigos-fonte, relatórios gerados e últimos resultados comprovados.

---

## 1. Como Executar os Testes

Os testes automatizados exigem o **Node.js (versão 20 ou superior)** e utilizam o **Playwright com Microsoft Edge** para validações ponta a ponta sem rede (`file://` offline).

### Verificação Completa do Repositório
Executa verificação de tipagem TypeScript e todas as suítes de teste de ponta a ponta:
```powershell
npm run verify
```

### Comandos Rápidos Individuais
| Suíte de Testes | Comando | Descrição |
|---|---|---|
| **Verificação Geral** | `npm run verify` | Executa typecheck + build + todas as suítes do repositório |
| **Apenas Tipagem** | `npm run typecheck` | Validação estática TypeScript sem emitir arquivos |
| **Apenas Build** | `npm run build` | Compila os arquivos HTML offline independentes |
| **Testes do Jogo (Unidade)** | `node prototypes/game/test.mjs` | 20 testes mecânicos da arena de combate |
| **Testes de Câmera/Locomoção**| `node prototypes/game/locomotion.test.mjs`| 15 cenários de órbita, lock-on e mobilidade |
| **Testes do Jogo (Navegador)** | `node prototypes/game/verify.mjs` | 18 cenários interativos no Edge (teclado real) |
| **Testes do Studio (Unidade)**| `node prototypes/studio/test/ops.test.mjs` | 18 testes unitários do editor de animações |
| **Testes de Rigging (Unidade)**| `node prototypes/studio/test/rigging.test.mjs` | 7 testes unitários do núcleo de rigging do Codex |
| **Testes do Studio (Navegador)**| `node prototypes/studio/verify.mjs` | 20 verificações de navegador no Animation Studio |
| **Testes de Rigging (Navegador)**| `node prototypes/studio/test/rigging.browser.mjs` | 12 verificações de navegador no Rigging Studio |
| **Teste Cruzado com Codex 7323b48** | `node prototypes/studio/proposals/test-codex-cross.mjs` | Validação direta com validador e metadados do Codex |
| **Testes das Propostas Visuais** | `node prototypes/studio/proposals/test-proposals.mjs` | Validação Playwright das Propostas A, B e C |

---

## 2. Matriz Detalhada de Testes

### A. Jogo Principal (`prototypes/game`)

#### 1. Testes Mecânicos de Combate
- **Arquivo de Código:** `prototypes/game/test.mjs`
- **Sistema:** Núcleo de simulação física, colisões e combate.
- **Objetivo:** Garantir matemática discreta exata de movimento em 8 direções, cálculo de impacto por contato de volumes, esquiva com tempo de invulnerabilidade e custo de stamina, guarda com absorção de impacto, cálculo de empurrão (60% ataque / 40% velocidade) e transição de estados.
- **Quantidade de Testes:** 20 cenários mecânicos.
- **Último Resultado Comprovado:** `20 mechanical scenarios passed` (100% de sucesso).

#### 2. Testes de Locomoção e Câmera
- **Arquivo de Código:** `prototypes/game/locomotion.test.mjs`
- **Sistema:** Câmera orbital híbrida e navegação desacoplada.
- **Objetivo:** Validar desacoplamento entre orientação do corpo e rotação da câmera, travamento relativo ao alvo (lock-on strafe), transições diagonais suaves, limites angulares e determinismo sob taxas de 30, 60 e 144 Hz.
- **Quantidade de Testes:** 15 cenários de locomoção.
- **Último Resultado Comprovado:** `15 locomotion/camera scenarios passed` (100% de sucesso).

#### 3. Verificações de Navegador (Ponta a Ponta)
- **Arquivo de Código:** `prototypes/game/verify.mjs`
- **Arquivo de Relatório:** `prototypes/game/validation/browser.json`
- **Evidências Visuais:** `prototypes/game/validation/` (`menu.png`, `impact.png`, `block.png`, `result.png`, `narrow.png`)
- **Sistema:** Interface jogável, renderização Three.js no Edge, eventos reais de teclado e mouse.
- **Objetivo:** Comprovar carregamento offline via `file://`, ausência de requisições externas, input de teclado real (Setas, F para guarda, C para investida), impacto na vida (HP) do adversário e layout responsivo.
- **Quantidade de Testes:** 18 cenários no navegador.
- **Último Resultado Comprovado:** `PASS: 18 browser scenarios, file:// offline, no errors or external requests` (100% de sucesso).

---

### B. Animation Studio & Rigging Studio (`prototypes/studio`)

#### 1. Operações do Editor de Animações
- **Arquivo de Código:** `prototypes/studio/test/ops.test.mjs`
- **Sistema:** Editor de clipes de animação (Action Editor).
- **Objetivo:** Validar recorte temporal não-destrutivo com interpolação de fronteiras, ajuste de velocidade, deslocamento e preservação de eventos, fechamento de loops de caminhada/corrida, extração de root motion in-place e histórico de desfazer/refazer.
- **Quantidade de Testes:** 18 testes unitários.
- **Último Resultado Comprovado:** `18 testes unitários aprovados` (100% de sucesso).

#### 2. Núcleo Técnico de Rigging (Codex)
- **Arquivo de Código:** `prototypes/studio/test/rigging.test.mjs`
- **Sistema:** Hierarquia óssea, criação de esqueleto e pesos.
- **Objetivo:** Validar bounding box no espaço da raiz, template de 20 articulações, simetria bilateral de coordenadas X, rejeição canônica de nomes duplicados, ciclos e valores inválidos, e geração de SkinnedMesh real com normalização de pesos de vértice.
- **Quantidade de Testes:** 7 testes unitários.
- **Último Resultado Comprovado:** `Rigging: 7 testes unitários aprovados` (100% de sucesso).

#### 3. Regressões e Usabilidade do Studio
- **Arquivo de Código:** `prototypes/studio/verify.mjs`
- **Arquivo de Relatório:** `prototypes/studio/validation/browser.json`
- **Evidências Visuais:** `prototypes/studio/validation/studio.png`, `compare-original.png`, etc.
- **Sistema:** Interface completa do Animation Studio no Edge.
- **Objetivo:** Comprovar abertura offline, timeline interativa, comparação A x B, drag-and-drop de clipes, exportação e reimportação de arquivos GLB e persistência de IndexedDB local.
- **Quantidade de Testes:** 20 verificações de navegador.
- **Último Resultado Comprovado:** `Animation Studio: 20 verificações de navegador aprovadas` (100% de sucesso).

#### 4. Integração do Rigging Studio no Navegador
- **Arquivo de Código:** `prototypes/studio/test/rigging.browser.mjs`
- **Arquivo de Relatório:** `prototypes/studio/validation/report.json`
- **Sistema:** Aba Rigging integrada no Animation Studio.
- **Objetivo:** Validar abertura offline da aba Rigging, template guiado com inputs numéricos, espelhamento simétrico com undo/redo, auto-bind em malha estática gerando skin real, teste de flexão e roundtrip GLB com metadados `userData.arenamonRig`.
- **Quantidade de Testes:** 12 verificações de navegador.
- **Último Resultado Comprovado:** `Rigging Studio: 12 verificações de navegador aprovadas` (100% de sucesso).

---

### C. Propostas Visuais de Rigging e Teste Cruzado (`prototypes/studio/proposals`)

#### 1. Teste Cruzado com o Núcleo Codex (`commit 7323b48`)
- **Arquivo de Código:** `prototypes/studio/proposals/test-codex-cross.mjs`
- **Núcleo Validado:** `prototypes/studio/proposals/test-codex-core-7323b48.js` (extraído verbatim de `codex/rig-editor-stabilization`)
- **Sistema:** Interoperabilidade direta entre a camada visual e o núcleo estrutural.
- **Objetivo:** Comprovar que os esqueletos gerados pelas interfaces das propostas (Humanoid-20, Quadrúpede-24, Quadrúpede-27 e SkinnedMesh) são 100% aprovados pelo validador canônico do Codex v2; validar importação no `RiggingBridge` de rascunhos mutados pelo Codex; validar paridade estrita de metadados `userData.arenamonRig` com `syncRigMetadata`; e confirmar rejeição idêntica em 6 cenários de erro da matriz canônica.
- **Quantidade de Testes:** 4 cenários / 10 verificações cruzadas.
- **Último Resultado Comprovado:** `✓ TESTE CRUZADO COM O NÚCLEO CODEX 7323b48 CONCLUÍDO COM 100% DE SUCESSO!`

#### 2. Testes Automatizados das 3 Propostas Visuais
- **Arquivo de Código:** `prototypes/studio/proposals/test-proposals.mjs`
- **Evidências Visuais:** `prototypes/studio/proposals/screenshots/` (`proposta-a.png`, `proposta-b.png`, `proposta-c.png`, `propostas-portal.png`)
- **Sistema:** Proposta A, Proposta B, Proposta C e Portal Comparador (`index.html`).
- **Objetivo:**
  1. Undo/Redo no manipulador 3D com restauração exata e teste com eventos reais de mouse no canvas.
  2. Resolução da inconsistência 24 vs 27 articulações sem escolha silenciosa ou unilateral.
  3. Heatmap em modelos multi-malha com preservação não-destrutiva de cores GLB.
  4. Validação canônica estrita de importação e persistência em SkinnedMesh e THREE.Bone.
  5. Acionamento do botão real de exportação (`#btn-export-json`) na UI após bindSkin gerando Schema v2.
  6. Rotulação transparente de controles demonstrativos (pintura e normalização de pesos).
  7. Projeção ortográfica pura do Quad-View na Proposta A.
  8. Wizard com Paper Doll 2D e auto-bind na Proposta B.
  9. Alternância Guiado/Livre e linhagem anatômica na Proposta C.
  10. Carregamento do portal comparador em processo isolado.
- **Último Resultado Comprovado:** `✓ TODAS AS 6 PRIORIDADES E CASOS DE TESTE FORAM APROVADOS!` (100% de sucesso em 19 segundos).

---

### D. Laboratório Base e Importador

#### 1. Laboratório de Criaturas (Blocos Base)
- **Arquivo de Código:** `prototypes/placeholders/verify.mjs`
- **Arquivo de Relatório:** `prototypes/placeholders/validation/report.json`
- **Evidência Visual:** `prototypes/placeholders/validation/blocks.png`
- **Objetivo:** Dois blocos geométricos sólidos (azul e vermelho), câmera orbital e reset, layout mobile responsivo, execução offline via `file://`.
- **Último Resultado Comprovado:** `PASS: dois blocos, cores, câmera, layout, file:// offline, sem erros.`

#### 2. Importador de Protótipos
- **Arquivo de Código:** `prototypes/importer/verify.mjs`
- **Evidências Visuais:** `prototypes/importer/validation/actions.png`, `preview.png`
- **Objetivo:** Importação de modelos sintéticos, descarte de texturas para modo unlit, inspeção de esqueleto e roundtrip de ações.
- **Último Resultado Comprovado:** `PASS: visualização, GLB roundtrip, unlit e rejeição de malhas ausentes.`
