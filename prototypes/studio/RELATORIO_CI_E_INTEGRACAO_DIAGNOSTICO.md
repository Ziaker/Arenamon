# Animation Studio: falha do CI, animações diagnósticas e integração com o editor estrutural do Codex

| Item | Situação |
|---|---|
| Branch das correções | `fix/studio-diagnostic-ci`, derivada de `feat/studio-diagnostic-animations-gpt6` (`3c80122`) |
| Integração definitiva | **não executada**: aguarda a versão corrigida do Codex |
| Arquivos do Codex e propostas do Antigravity | **não modificados** |
| Merge na `main` | **não feito** |

As referências auditadas foram:
- `origin/codex/rig-editor-fase1` @ `73955d5` (editor estrutural publicado);
- `origin/feat/studio-rigging-ui-proposals` @ `30a1f2f` (propostas visuais do Antigravity).

A branch local do Codex `codex/rig-editor-stabilization` (`7323b48`) está em andamento e não publicada. O ensaio de integração deve ser repetido sobre ela quando for entregue (seção 6).

## 1. Falha do GitHub Actions no HEAD `3c80122`

**Sintoma:** `page.click('[data-panel="project"]')` em `verify.mjs:69` estourou 30 s. O registro do Playwright mostra só "locator resolved", sem nenhuma ação depois. O código do Studio era o mesmo da execução verde anterior (`ef3e54f`): `3c80122` só reordena o workflow. Mesmo na execução verde, a etapa de layout já levava 76 s no CI e cerca de 2 s localmente.

**Medições no executor real** (instrumentação permanente em `verify.mjs`: renderizador WebGL, tempo por etapa, tarefas longas e operações lentas):

| Execução no `windows-latest` (sem GPU, WebGL em SwiftShader) | Etapa de layout | Observação |
|---|---|---|
| Original | 96–227 s | cliques isolados de 6–22 s |
| Tarefas longas de JS no mesmo período | 3,0 s no total (maior: 219 ms) | thread principal **ociosa** |
| Sem `backdrop-filter` | 86 s | ajuda pouco |
| Sem MSAA | 84 s | ajuda pouco |
| Mesmo WebGL, canvas **fora da composição** (`visibility:hidden`) | **5,6 s** | nenhuma operação lenta |
| **Correção: modo leve automático** | **3,3 s** | `verify` inteiro em ~28 s; job de 8,5 → 2 min |

**Causa raiz:** no executor sem GPU, cada quadro do canvas WebGL precisa ser entregue à composição da página em software. O canvas tem 1500×960, MSAA e anima continuamente, porque a animação segue tocando durante o teste. A cada troca de painel o canvas muda de tamanho, e a página passa segundos sem produzir quadros.

As verificações de ação do Playwright (visível, estável e recebendo eventos) esperam esses quadros. Por isso a thread principal fica ociosa e mesmo assim o clique estoura. Não é um defeito de lógica nem do teste: um usuário sem GPU teria a mesma interface travada.

**Hipóteses descartadas, com medição:**
- bloqueio por JavaScript: só 3 s de tarefas longas;
- espera de navegação em `file://`;
- o `backdrop-filter` sozinho;
- o MSAA sozinho.

**Correção (`src/gl-quality.js`):** detecta renderização em software (SwiftShader, llvmpipe, WARP) e usa o **modo leve**:
- sem MSAA;
- resolução interna de 50%;
- no máximo 30 quadros desenhados por segundo, com o tempo pulado acumulado (animação, comparação e câmera continuam no tempo real);
- sem `backdrop-filter`.

Com GPU nada muda; o modo completo foi conferido localmente com a mesma suíte. `?gl=full` e `?gl=lite` forçam um modo, e `?glscale` e `?glfps` ajustam o leve.

**Não foi usado** aumento de timeout nem clique programático. Pelo contrário: o teste de diagnóstico tinha três máscaras, e todas foram removidas (seção 2).

**Observação para o Codex (arquivo dele, não alterado):** `a39f2dc` trocou `page.click('#rg-template')` por um clique via DOM em `rigging.browser.mjs`, atribuindo o problema a "espera de navegação espúria em file:// no Edge CI". Pela medição acima, o sintoma tem a mesma causa. Depois que o modo leve entrar, esse contorno pode voltar a ser um clique real.

## 2. Defeitos corrigidos na branch derivada

| # | Defeito | Evidência | Correção |
|---|---|---|---|
| D1 | Timeouts do `verify` no CI | seção 1 | `gl-quality.js` e uso dele em `engine.js` e `ui/layout.css` |
| D2 | **Criar uma animação diagnóstica não entrava no histórico** do editor: Ctrl+Z não a removia, ao contrário de qualquer outra criação de clipe no Studio | Teste novo contra o código original: `{afterUndo: 4, gone: false}` (esperado 3) | `diagnostics/index.js`: a criação passa por `history.run` (desfazer remove, refazer recria o mesmo clipe) |
| D3 | O teste de navegador mascarava a página: substituía `requestAnimationFrame` por `setTimeout(45 ms)`, forçava `devicePixelRatio = .6` e clicava via DOM | `diagnostic-animations.browser.mjs` em `3c80122` | Removidas as três máscaras; cliques reais do Playwright. O renderizador continua SwiftShader, o mesmo do CI |
| D4 | Os testes diagnósticos não estavam no `npm test` (só no workflow próprio) | `package.json` | Incluídos os dois arquivos no `npm test` |
| D5 | O `verify` media o canvas com `devicePixelRatio`, que o renderizador não usa | `canvasMatches` | Usa `renderer.getPixelRatio()` |

## 3. As oito animações diagnósticas na cobertura

| Arquivo | O que verifica |
|---|---|
| `test/diagnostic-animations.test.mjs` (13 testes, Node) | Ids exatos das oito; cada uma se liga a ossos reais no `AnimationMixer` (nenhuma trilha órfã); só os ossos mapeados se movem; as não cíclicas (isolate, squat, tackle, dodge, guard) começam e terminam no repouso; walk, run e idle fecham o ciclo; "osso por osso" move um osso por vez; mais os testes anteriores (quaternions válidos, sem root motion, intensidade, mapeamento manual, duplicatas, parâmetros inválidos) |
| `test/diagnostic-animations.browser.mjs` (9 testes, Edge sem máscaras) | Lista com 8 movimentos; as oito geradas **pela interface**, todas as trilhas ligadas no mixer do Studio; histórico (desfazer e refazer); "Gerar e assistir"; GLB com 13 clipes em que os 10 diagnósticos mantêm `testOnly`, preset e número de trilhas |
| `npm test` / `npm run verify` | Inclui os dois arquivos acima |
| Workflow `Arenamon Studio Diagnostic Animations` | Mesma suíte, mais rigging, editor e `verify` completo |

## 4. Compatibilidade com o editor estrutural do Codex (`73955d5`)

Foi feito um **ensaio** numa árvore descartável: Codex + esta branch, sem commit e sem push. O resultado:
- **um único conflito textual** (`engine.js`, linha do `WebGLRenderer`);
- todas as suítes aprovadas no código mesclado:

| Suíte | Resultado |
|---|---|
| Editor (unitários) | 18 |
| Rigging (unitários, Codex) | 8 |
| Diagnóstico (unitários) | 13 |
| Rigging (navegador, Codex) | 16 |
| Diagnóstico (navegador) | 9 |
| `verify` | 20 |

Sonda semântica no código mesclado, com um clipe diagnóstico "Investida" já criado:

| Aspecto | Comportamento medido | Avaliação |
|---|---|---|
| **UUIDs** | As trilhas usam `uuid.quaternion`. O Codex edita no lugar (renomear, reparentar, criar e excluir não recriam ossos) e **bloqueia uma nova vinculação quando há clipes** ("mudaria UUIDs e quebraria os tracks") | Compatível |
| **Nomes** | Renomear a cabeça: 3/3 trilhas ligadas. `userData.arenamonDiagnostic.mappedRoles[].boneName` fica com o nome antigo | Compatível; metadado desatualizado (R3) |
| **Hierarquia** | Reparentar a cabeça no quadril: 3/3 ligadas, mas **a pose diverge 17,6°** no meio do clipe, porque a trilha guarda a rotação local relativa ao pai antigo | **Conflito real (R1)**, também afeta clipes importados |
| **Exclusão** | Excluir a cabeça: **2/3 ligadas**, trilha órfã, **sem aviso** no painel de diagnóstico | **Conflito real (R2)** |
| **Bind pose** | O Codex grava `q` por osso e `commitRig` atualiza o repouso. O diagnóstico lê o repouso via `enterRigRest()`, então **clipes gerados depois** usam o bind novo | Compatível; clipes antigos dependem de R1 |
| **Tracks** | Só `QuaternionKeyframeTrack`, sem posição nem escala. O Codex não reescreve trilhas de clipes | Compatível |
| **Histórico** | Criação de diagnóstico (D2) e edições estruturais do Codex estão na mesma pilha. Desfazer reparentar ou excluir restaura exatamente (0°, 3/3) | Compatível |
| **GLB** | `exportGLB` traduz UUID → clone e o GLB grava por nome. Na reimportação, as trilhas se ligam por nome e `extras` voltam para `userData` | Compatível; nomes únicos garantidos pelo Codex (`uniqueJointName`) |
| **Fluxo "Gerar e assistir"** | O diagnóstico inicia o playback dois quadros depois de sair da aba Rigging. Ao sair, o Codex restaura `playBefore` e a câmera de perspectiva | Funcionou no ensaio; é acoplamento por tempo (R4) |
| **Propostas do Antigravity** | Ficam só em `prototypes/studio/proposals/`; nenhum arquivo em comum com o Codex ou o diagnóstico | Sem conflito |

## 5. Plano de integração por arquivo

Ordem sugerida: a **versão corrigida do Codex** entra primeiro e esta branch é mesclada sobre ela.

| Arquivo | Origem | Ação | Conflito |
|---|---|---|---|
| `src/rigging/core.js`, `src/rigging/index.js`, `src/rigging/rigging.css`, `test/rigging.*`, `RIGGING_FASE1.md` | Codex | Manter integralmente | Nenhum |
| `src/engine.js` | Codex + esta branch | Ficar com as câmeras do Codex. Na linha do renderizador: `new T.WebGLRenderer({antialias: GL_QUALITY.antialias})` + `renderer.setPixelRatio(GL_QUALITY.pixelRatio)`, o `import {GL_QUALITY}` e o laço com limite de quadros (`drawPending`/`lastDraw`) | **1 conflito**, resolução mecânica (validada no ensaio) |
| `src/gl-quality.js` | esta branch | Novo | — |
| `src/ui/layout.css` | esta branch | Regra `html.gl-lite` ao final | Nenhum |
| `src/ui/shell.html` | Codex + diagnóstico | Mescla automática; sem IDs duplicados (verificado) | Nenhum |
| `src/main.js` | diagnóstico | `import './diagnostics/index.js'` | Nenhum |
| `src/diagnostics/index.js`, `src/diagnostics/presets.js` | diagnóstico (+ D2) | Novos; ajustes de R1 e R2 depois da entrega do Codex | — |
| `test/diagnostic-animations.*` | diagnóstico (+ esta branch) | Novos | — |
| `verify.mjs` | esta branch | Instrumentação, ganchos de diagnóstico (`STUDIO_VERIFY_*`) e `canvasMatches` | Nenhum (o Codex não altera) |
| `package.json` | esta branch | `test`: acrescentar os dois testes diagnósticos à lista do Codex | Revisar a ordem |
| `README.md`, `DIAGNOSTIC_ANIMATIONS.md` | ambos | Mescla automática | Nenhum |
| `.github/workflows/arenamon-studio-diagnostics.yml` | diagnóstico | Manter; tirar a branch derivada dos gatilhos depois da integração | — |
| `.github/workflows/studio-ci-render-probe.yml` | esta branch | Só experimento (`workflow_dispatch`); pode ser removido depois da integração | — |
| `prototypes/studio/proposals/**` | Antigravity | Não tocar | Nenhum |

**Regressões possíveis a observar:**
- (a) aparência no modo leve, só sem GPU: resolução de 50% e sem desfoque;
- (b) comparação A × B com o limite de quadros (o `dt` é acumulado e foi coberto pelo `verify`);
- (c) acoplamento por tempo do "Gerar e assistir" com a saída da aba Rigging (R4);
- (d) `rigging.browser.mjs` do Codex ainda usa clique via DOM em `#rg-template` (máscara herdada de `a39f2dc`).

**Riscos que precisam de decisão ou de trabalho depois da entrega do Codex:**
- **R1 – reparentar com clipes existentes:** a pose diverge porque as trilhas guardam rotações locais.
  - Proposta: o Rigging avisa antes de reparentar quando há clipes.
  - Para diagnósticos: guardar em `mappedRoles` o `uuid` e o `arenamonJointId` de cada papel e oferecer "Regenerar diagnósticos" (preset e intensidade já ficam no `userData`).
- **R2 – excluir um osso com clipes:** a trilha fica órfã sem aviso.
  - Proposta: ao receber `rigChanged`, o diagnóstico verifica as trilhas dos clipes diagnósticos e avisa quando há trilha sem osso.
  - O Codex poderia avisar no próprio diálogo de exclusão.
- **R3 – metadado `mappedRoles[].boneName` desatualizado depois de renomear:** gravar o `uuid` e atualizar o nome ao exibir.
- **R4 – "Gerar e assistir" com dois `requestAnimationFrame`:** trocar por um evento explícito de saída da aba.

**Critérios de aceitação da integração definitiva:**
1. Conflito de `engine.js` resolvido como acima; `npm run verify` verde localmente e o workflow verde no CI (layout abaixo de 10 s no executor).
2. Todas as suítes do ensaio aprovadas no código mesclado: 18, 8 (ou mais, na versão corrigida), 13, 16 (ou mais), 9 e 20.
3. Teste novo: reparentar ou excluir um osso com clipe diagnóstico existente gera aviso (R1, R2) e "Regenerar" reproduz a pose correta no rig editado.
4. Teste novo: renomear mantém as trilhas ligadas e atualiza o nome exibido (R3).
5. Desfazer e refazer intercalando criação de diagnóstico e edições estruturais restaura exatamente o estado (0°, todas as trilhas ligadas).
6. GLB depois de edições estruturais: reimportação com trilhas ligadas por nome e `testOnly` preservado.
7. Nenhum arquivo em `prototypes/studio/proposals/` alterado; nenhum recurso proprietário versionado.

## 6. O que pode ser integrado com segurança

- **Já, sem depender do Codex:**
  - modo leve sem GPU (`gl-quality.js` + `engine.js` + `layout.css`);
  - instrumentação do `verify`;
  - D2 (histórico);
  - testes sem máscara;
  - testes diagnósticos no `npm test`.

  O ensaio mostrou que tudo isso convive com `73955d5`: há um conflito mecânico e todas as suítes passam.
- **Depois da versão corrigida do Codex:** a integração definitiva, os tratamentos de R1 a R4 e um novo ensaio sobre a versão entregue. A `codex/rig-editor-stabilization` local (`7323b48`) já difere do que foi auditado.

## 7. Limitações

- O ensaio usou o rig sintético do repositório (formato Mixamo, 4 ossos), não um modelo real.
- R1 e R2 também afetam clipes importados: não são exclusivos dos diagnósticos e exigem uma decisão de produto.
- No CI, o modo leve é o que passa a ser testado (é o que um usuário sem GPU usaria). O modo completo continua coberto localmente com GPU (mesma suíte, verde).
