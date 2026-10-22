# Arenamon — Status dos Projetos, Branches e Roadmap

Este documento mapeia o estado atual de desenvolvimento do Arenamon em suas diferentes frentes paralelas, distinguindo com precisão o que está aprovado, implementado, em teste ou proposto.

---

## 0. Estado verificado em 22/10/2026 (derivado do Git e do código; prevalece sobre as seções 0 de 16/10 e 1)

Verificação: `git fetch --prune`, `git merge-base --is-ancestor` contra `origin/main` (`dff532f`, v1.18.0), comparação de arquivos e leitura do código. Detalhes e evidências em `docs/AUDITORIA_DOCUMENTACAO_2026-10-22.md`.

- **Jogo principal:** `prototypes/combat-lab` (v1.18.0), aberto por `JOGAR_ARENAMON.html`. Base de calibração do responsável (`sim/calibration-base.js`, 184 linhas) é o padrão do jogo e do laboratório. Os 15 Moves (Reflect, Psyshock e os 13 novos) estão implementados e usáveis também no ar (`sim/air.js`). O que mudou por versão está em `docs/PATCH_NOTES.md`.
- **Integradas à `main` (116 branches remotas):** todo o combate/laboratório até a v1.18.0 (`feat/calibracao-v8-base`, `feat/hud-*`, `feat/moves-*`, `feat/ferramentas-open-source`, overhaul de colisões, tackle fases 1–4, passivas, biblioteca de personagens, Blender Vision), as rodadas de documentação de Moves (`docs/moves-*`, `docs/emerging-stone-*`, `docs/sand-wave-*`, `docs/mushroom-*`) e a reorganização de acesso.
- **Código de combate ainda fora da `main` (decisão pendente):** `codex/physics-colliders` (alinha hitboxes e colisores do mapa; **sobrepõe** o overhaul de colisões já integrado), `fix/collision-overhaul-stage1` (PR #100, rascunho; implementação paralela da etapa 1, provavelmente superada), `claude/elegant-carson-vzdxvo` (PR #94, variante D do VFX de impacto; o código da variante já existe na `main`), `codex/sand-stone-lab` (atelier de VFX de Sand Wave/Emerging Stone/Swift/Psyshock, **trabalho ativo, não integrar sem pedido**), `chore/ci-runner-mosh` (workflow `verify` e conversor Mosh).
- **Branches antigas do Studio/rigging e da Etapa A (≈ 25 de 13–15/10):** continuam sem integração (`feat/studio-*`, `codex/rig-editor-*`, `feat/combat-core-etapa-a*`, `feat/game-etapa-a`, `fix/studio-*`, `integration/*`). O Studio não foi tocado nesta rodada.
- **Só documentação, sem integração:** `docs/patch-notes` (integrado a esta auditoria como `docs/PATCH_NOTES.md`), `docs/responsive-movement-v2-proposta` (PR #98) e `docs/game-feel-cinco-melhorias` (PR #99), ambos rascunhos de **propostas não aprovadas**; issues #95 (Ledge Grab), #96 (DI) e #97 (Wall Tech) também são propostas não aprovadas.
- **Pendências de produto conhecidas:** gameplay do Body Slam não especificado; IA, SFX e homologação dos 13 Moves novos; faixa de montagem em caixas de 2,2 m (resíduo de colisão); verificação visual na tela e bateria completa de navegador das versões 1.16–1.18.

## 0-b. Estado verificado em 16/10/2026 (histórico, derivado do Git)

Verificação: `git fetch` e `git merge-base --is-ancestor` contra `origin/main`. A tabela da seção 1 é anterior e **parcialmente desatualizada** (ex.: o laboratório de combate já está na `main`; hashes de commit de branches mudaram).

- **Já integradas à `main`:** `feat/combat-lab-overhaul`, `feat/combat-lab-calibracao`, `feat/combat-moves-base`, `feat/reorganizacao-acesso-central`, `feat/studio-editor-fase1`, `feat/studio-rigging-fase1-gpt6`, `feat/studio-rigging-ui-proposals`, `integration/rigging-proposals-codex-v2`, `fix/arena-movement-camera`, `codex/jogavel-blocos`, `docs/moves-decisoes-rodadas`.
- **Ainda NÃO integradas:** `feat/combat-core-etapa-a` (`f337e00`), `feat/game-etapa-a` (`245e5b9`), `feat/studio-rig-telemetry-autorig` (`249e34b`), `feat/studio-animation-library` (`3f3cb67`), `feat/studio-cc0-animation-library`, `feat/studio-rigging-guiado`, `feat/studio-rig-workbench`, `integration/workbench-telemetry-autorig` (`516ca8d`), `fix/studio-diagnostic-ci` (`a549d23`), `fix/studio-usabilidade-viewer`, `codex/rig-editor-fase1`, `codex/rig-editor-stabilization`, `codex/rig-editor-multimesh-tests`, `feat/combat-lab-v7`, `feat/combat-core-etapa-a-gpt6`, `feat/studio-diagnostic-animations-gpt6`, `tests/combate-regressao`.
- **Documentos de domínio dos Moves:** `docs/MOVES_DECISOES_RODADAS.md` (design aprovado; implementação não autorizada) e `docs/MAPA_COMBAT_LAB_DECISOES_RODADAS.md` (mapa da arena).
- **Índice de módulos e testes:** `docs/INDICE_MODULOS.md`. **O que foi ou não executado:** `docs/VERIFICACOES.md`.

---

## 1. Mapa de Branches Ativas (tabela histórica de 14–15/10/2026: hashes e status antigos; vale a seção 0)

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

### 1. Jogo Principal — Combat Lab (`prototypes/combat-lab`)
- **Situação:** **Jogo oficial ativo**, totalmente jogável offline em `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html` (atalho `JOGAR_ARENAMON.html`).
- **Mecânicas e Sistemas Implementados:**
  - Separação estrita de `X` (Tackle em 8 direções) e `C` (Esquiva sem dano), janela de cancelamento `C → X` e clash entre tackles.
  - **Moves Especiais (`A` / `S`) e Power Level (`PL1–PL3`):** `Reflect` (barreira de energia 3D com reflexão de projéteis/lasers e quebra por tackle) e `Psyshock` (formação e disparo de rochas telecinéticas 3D).
  - **VFX 3D Sólidos & `VfxRuntime`:** 9 famílias de malhas volumétricas 3D (poeira de dash em 8 estilos, vento, corrida, esquiva, aterrissagem, impacto, bloqueio e clash), `BeamRenderer` para lasers e modelos 3D de rochas/barreiras.
  - **Personagens GLB do Studio:** Importação de modelos animados com mapa de ações e sincronização das durações de animação.
  - **IA Tática de 5 Fases:** Percepção honesta, predição, controle espacial, economia de stamina, modelagem do oponente e planejamento de sequência em 6 estilos estratégicos.
  - **Dashboard Bento Zero-Scroll & Modo Arena:** 9 abas sem rolagem vertical (`0 px` overflow) + botão `⚔ Modo Arena` para jogar em tela cheia.
- **Como Compilar:**
  ```powershell
  npm run build:combat-lab
  ```

### 2. Animation Studio & Rigging (`prototypes/studio`)
- **Situação:** Totalmente operacional offline em `arenamon-animation-studio.html`.
- **Action Editor & 3 Modos:** Viewport 3D soberano com modos **Rigging**, **Animar** e **Preview & Entrega**, recorte de clipes, alteração de velocidade, fechamento de loop, extração de root motion in-place, visualização A x B e roundtrip GLB.
- **Rigging Studio (Integrado):**
  - Template guiado com 20 articulações padrão (formato Mixamo).
  - Bind pose com coordenadas legíveis X/Y/Z e espelhamento simétrico.
  - Geração de SkinnedMesh real com normalização de pesos de vértice.
  - Teste de flexão interativo no navegador.
  - Exportação e reimportação de GLB preservando `userData.arenamonRig`.

### 3. Protótipo Inicial Legado de Blocos (`prototypes/game` — Descontinuado)
- **Situação:** Descontinuado como jogo principal (`arenamon-jogavel.html`). Preservado apenas para histórico e compatibilidade dos scripts de teste antigos. O jogo oficial é `prototypes/combat-lab`.

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
