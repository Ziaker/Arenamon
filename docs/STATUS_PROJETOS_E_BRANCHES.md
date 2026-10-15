# Arenamon — Status dos Projetos, Branches e Roadmap

Este documento mapeia o estado atual de desenvolvimento do Arenamon em suas diferentes frentes paralelas, distinguindo com precisão o que está aprovado, implementado, em teste ou proposto.

---

## 1. Mapa de Branches Ativas

| Branch | Responsável / Agente | Foco Principal | Status Atual | Último Commit |
|---|---|---|---|---|
| `main` | Base oficial | Versão base com blocos e catálogo | Base estável protegida; merges devem ser deliberados | `5d362c1` |
| `feat/studio-rig-telemetry-autorig` | Antigravity | Telemetria programática v1, Rig Patch transacional, Auto-Rig adaptativo, pesos selecionáveis e CI | 100% testado (26 checks no browser, 11 testes de patch, 9 de autorig); CI dedicada | `249e34b` |
| `feat/studio-animation-library` | Codex | Biblioteca de animações CC0 (Quaternius UAL1 v3), catálogo, bundles e retargeting | Implementado e documentado; testes automatizados aprovados | `3f3cb67` |
| `feat/studio-rigging-ui-proposals` | Antigravity | Três propostas visuais independentes de Rigging (A/B/C) | 100% testado offline; compatibilidade v2 com Codex | `ae39c73` |
| `feat/combat-core-etapa-a` | Claude / Equipe | Laboratório de Combate e calibração A x B | **Etapa A Aprovada** (14/10/2026); IA tática pronta | `f337e00` |
| `feat/game-etapa-a` | Claude / Equipe | Jogo principal com mecânicas de combate da Etapa A | Implementado e documentado; aguarda avaliação jogável | `245e5b9` |
| `codex/rig-editor-multimesh-tests` | Codex | Núcleo estrutural de Rigging v2 e testes multi-malha | Suíte verde no CI do Codex; 17 verificações | `35213f9` |
| `fix/studio-diagnostic-ci` | Claude / Equipe | Animações diagnósticas e otimização CI em software | 8 animações cobertas; plano de integração traçado | `a549d23` |
| `integration/workbench-telemetry-autorig` | Claude / Antigravity | Ramo de integração preliminar Workbench e Telemetria | Aguarda validação das interfaces antes da unificação | `516ca8d` |
| `feat/reorganizacao-acesso-central` | Antigravity / Claude | Central de acesso unificada, mapa e política de diretórios oficiais | **Branch atual de entrega da reorganização segura** | Em progresso |

---

## 2. Status por Subsistema

### 1. Jogo Principal (`prototypes/game`)
- **Situação:** Totalmente jogável offline em `arenamon-jogavel.html`.
- **Mecânicas Implementadas:**
  - Movimento normalizado em 8 direções.
  - Esquiva com janela de invulnerabilidade e custo de stamina.
  - Guarda ativa com absorção e guard stun.
  - Tackle físico ofensivo acionado por tecla dedicada.
  - Câmera orbital híbrida (livre e travamento de combate com Tab).
  - 3 modos de IA do oponente (Inativo, Defensivo, Ofensivo).
  - Ciclo de partida completo (Menu -> Luta -> Vitória/Derrota -> Reinício).
- **Decisões:** Parâmetros provisórios mantidos configuráveis; sem alterações na física ou controles durante esta reorganização.

### 2. Animation Studio & Rigging (`prototypes/studio`)
- **Situação:** Totalmente operacional offline em `arenamon-animation-studio.html`.
- **Action Editor:** Recorte de clipes, alteração de velocidade, fechamento de loop, extração de root motion in-place, visualização A x B, roundtrip GLB.
- **Rigging Studio (Integrado):**
  - Template guiado com 20 articulações padrão (formato Mixamo).
  - Bind pose com coordenadas legíveis X/Y/Z e espelhamento simétrico.
  - Geração de SkinnedMesh real com normalização de pesos de vértice.
  - Teste de flexão interativo no navegador.
  - Exportação e reimportação de GLB preservando `userData.arenamonRig`.

### 3. Laboratório de Combate (`prototypes/combat-lab` na branch `feat/combat-core-etapa-a`)
- **Situação:** Aprovado em 14/10/2026 para experimentação e calibração de regras da Etapa A.
- **Recursos Principais:**
  - Separação estrita de X (Tackle) e C (Esquiva).
  - IA tática com 6 estilos de combate (Agressor, Contra-atacante, Esquivador, etc.).
  - Ferramenta de comparação A x B em tempo real.
  - Exportador de patch Git para `src/config.ts` do jogo.
- **Como Acessar:** Desenvolvido isoladamente na branch `feat/combat-core-etapa-a`. Para compilar e testar localmente:
  ```powershell
  git checkout feat/combat-core-etapa-a
  npm run build:combat-lab
  ```

### 4. Propostas Visuais de Rigging (`prototypes/studio/proposals`)
- **Situação:** Três protótipos visuais concluídos e funcionais, **sem escolha de um deles pelo agente**, aguardando avaliação e homologação do usuário.
- **Identidades Visuais:**
  - **Proposta A (Rigging Workspace):** Inspirada em softwares 3D profissionais (Blender, Maya). Interface técnica em Quad-View com 3 vistas ortográficas e 1 perspectiva, manipulador 3D (Gizmo), árvore de hierarquia e inspetor de transformações.
  - **Proposta B (Guided Rigging):** Inspirada no AccuRIG e voltada para criadores e animadores iniciantes. Fluxo em 5 etapas com Paper Doll 2D, marcadores anatômicos guiados e auto-bind assistido.
  - **Proposta C (Hybrid Rigging Studio):** Experiência híbrida moderna com canvas único maximizado, alternância instantânea entre Modo Guiado e Modo Livre, barras contextuais e trilhas anatômicas (breadcrumbs).
- **Compatibilidade Técnica:** RiggingBridge sincronizado com Schema v2 do Codex (suporte a IDs de articulação e quaternions de rotação).

### 5. Telemetria Programática e Auto-Rig Adaptativo (`feat/studio-rig-telemetry-autorig`)
- **Situação:** 100% implementado, testado e publicado (commit `249e34b`).
- **Recursos Principais:**
  - **Telemetria `arenamon-rig-telemetry` v1:** Relatório numérico determinístico contendo limites geométricos, matrizes de transformação, auditoria de skinning e métricas de simetria bilateral YZ.
  - **Executor Transacional `arenamon-rig-patch` v1:** Validação prévia (*dry-run*), simulação de diferenças, *rollback* atômico e integração nativa com o histórico do editor (`window.__studioEditor.history.run`), com suporte a Ctrl+Z e Ctrl+Y.
  - **Auto-Rig Paramétrico:** Análise geométrica adaptativa de proporções, gerando esqueletos humanoides (20 ossos / chibi) e quadrúpedes (24 ou 27 ossos com escápulas e cauda paramétrica).
  - **Pesos Selecionáveis:** Algoritmos `segment-proximity` e `capsule-falloff`, comprovados nos metadados `userData.arenamonRig.autoWeights`.
  - **Contrato Documentado:** Detalhado em `docs/CONTRATO_TECNICO_RIGGING.md`, com migração explícita do formato da Workbench.

### 6. Biblioteca de Animações CC0 (`feat/studio-animation-library`)
- **Situação:** Desenvolvido pelo Codex (commit `3f3cb67`).
- **Recursos Principais:**
  - Conjunto de animações padrão CC0 (Quaternius UAL1 v3) com licença documentada em `prototypes/studio/assets/animation-library/quaternius-ual1-v3/LICENSE.txt`.
  - Módulos de catálogo, bundles e retargeting no Animation Studio.
  - Documentação em `prototypes/studio/ANIMATION_LIBRARY.md` e `DIAGNOSTIC_ANIMATIONS.md`.

---

## 3. Diretrizes para Futuras Integrações

1. **Não realizar merges automáticos na `main`:**
   A unificação das branches deve ser realizada de forma coordenada, validando testes mecânicos e visuais a cada etapa.
2. **Preservação de Conteúdo Não-Homologado:**
   As propostas visuais permanecem intactas em `prototypes/studio/proposals/` até que o usuário defina explicitamente qual direção visual deverá ser integrada ao Animation Studio oficial.
3. **Respeito aos Direitos de Uso (AGENTS.md):**
   Modelos extraídos de jogos de terceiros (como `croagunk.glb`, `croagunk-pokken.glb`, etc.) permanecem estritamente locais no computador do usuário, bloqueados pelo `.gitignore`.
4. **Política de Diretórios Oficiais (AGENTS.md):**
   Fica proibido o uso de diretórios externos ou pastas particulares de agentes (`.codex/worktrees/`, `.gemini/`, `AppData/`, etc.) como destino de arquivos do projeto. Todo conteúdo deve residir na pasta local oficial `C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon` e no repositório GitHub `https://github.com/Ziaker/Arenamon`.
