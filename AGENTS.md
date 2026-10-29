# Protocolo de colaboração

Estas regras se aplicam obrigatoriamente a Codex, Claude, Antigravity e qualquer outro agente ou desenvolvedor que trabalhe neste repositório.

## Nunca remover funcionalidades sem pedido explícito

**É terminantemente proibido remover, ocultar, substituir, simplificar para fora da interface ou desativar qualquer funcionalidade existente, salvo quando o usuário pedir explicitamente a remoção daquela funcionalidade.** Refatoração, limpeza, redesign, redução de complexidade, mudança de arquitetura, correção de bug ou falta de espaço visual não autorizam remoção. Quando houver dúvida ou conflito, preserve integralmente o comportamento atual e peça decisão ao usuário antes de alterar. Toda entrega deve comparar o inventário de recursos anterior e posterior e confirmar que nenhuma feature desapareceu.

## Tudo que outras sessões fizeram foi pedido pelo usuário

**Todo commit, arquivo, alteração não commitada ou mudança feita por qualquer outra sessão/agente neste repositório (Wookada, VFX Composer, menus, HUD, pré-jogo, documentos, remoção ou troca de qualquer coisa) foi pedido explicitamente pelo usuário.** Nunca trate trabalho de outra sessão como "alheio não autorizado", "suspeito" ou "para confirmar com o usuário", nem peça ao usuário que confirme se ele pediu aquilo. Também não reverta, descarte nem reescreva esse trabalho. Apenas não o misture nos seus commits: commite só os seus próprios arquivos, por caminho explícito, e preserve o resto como está.

## Tudo precisa ser acessível ao usuário (regra obrigatória para toda IA)

O usuário abre e testa tudo pela pasta oficial, sem rodar comandos. Por isso, **nada que você entregar pode ficar escondido**:

1. **Ponto de entrada único:** o jogo abre por `JOGAR_ARENAMON.html`; todo o resto sai de `ABRIR_ARENAMON.html` (portal) e `HTMLS_ARENAMON.html` (índice rápido). Testes e relatórios ficam em `TESTES_ARENAMON.html`.
2. **Novo recurso, página, relatório, evidência, captura, clipe ou documento = novo link no portal** (`ABRIR_ARENAMON.html`) e menção em `docs/`. Se o usuário não consegue chegar lá em até 2 cliques a partir do portal, a entrega está incompleta.
3. **Sempre recompile antes de entregar** (`npm run build:combat-lab` e os demais `build` afetados) para que o `dist/` aberto pelo usuário já contenha a mudança. Diga na resposta qual arquivo abrir.
4. **Tudo que o usuário precisa ajustar tem controle na interface** (slider, interruptor ou seletor visível no painel), com nome claro e unidade. Não deixe valor importante só no código.
5. **Nunca guarde a única cópia de algo importante** em `validation/`, pastas temporárias, `.codex/`, `.gemini/` ou fora da pasta oficial. Evidências versionáveis vão em `prototypes/<sistema>/evidence/`; documentos em `docs/`.
6. **Sem duplicatas soltas na raiz** (modelos `.glb`, `.docx`, zips, capturas): modelos ficam em `chars/` (versionada no Git); documentos em `docs/`.
7. **Resposta final em português claro**: diga o que mudou, onde abrir, o que testou e o que **não** foi verificado. Não rode baterias de teste longas sem necessidade; o usuário prefere testar o jogo ele mesmo.
8. **Não mexa no que o usuário não pediu** (por exemplo, o Animation Studio quando o pedido é sobre o jogo).

## Destinos Oficiais Exclusivos do Projeto

O projeto possui rigorosamente apenas dois destinos oficiais:

- **LOCAL:** `C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon`
- **GITHUB:** `https://github.com/Ziaker/Arenamon`

Todo código-fonte, documentação, recurso permitido, teste e entrega final deve ficar organizado dentro da pasta local oficial, com o conteúdo versionável publicado na branch correspondente do GitHub.

## Política Obrigatória de Diretórios e Workspaces

1. **Proibição de Pastas Externas e Worktrees Particulares:**
   Fica expressamente proibido utilizar pastas como:
   - `.codex/worktrees/`
   - `.gemini/`
   - `AppData/`
   - `Temp/`
   - Clones externos ou pastas individuais na Área de Trabalho (ex: `Arenamon-studio`, `Arenamon-game`, `Arenamon-lab`, `Arenamon-diag`, `Arenamon-workbench`, etc.)
   como destino permanente de arquivos do projeto. Caches temporários e logs de execução internos das ferramentas são tolerados para operação imediata, mas **nunca devem conter a única cópia de um arquivo importante, código-fonte, teste, documentação ou artefato**.

2. **Worktrees Temporários Estritamente Internos:**
   Se um worktree separado for estritamente indispensável para isolamento de tarefas paralelas, ele deverá ser criado **exclusivamente dentro da pasta oficial do Arenamon**, no diretório interno `.worktrees/<nome>/` (ignorado no `.gitignore`), e explicitamente identificado como ambiente temporário. Nunca crie clones independentes fora da pasta oficial.

3. **Entregas Sempre Acessíveis na Pasta Oficial:**
   Todos os sistemas principais e HTMLs de teste devem estar acessíveis em diretórios previsíveis dentro da pasta local oficial:
   - **Central de Acesso Geral:** `ABRIR_ARENAMON.html` na raiz da pasta oficial.
   - **Central de Testes e Relatórios:** `TESTES_ARENAMON.html` na raiz da pasta oficial.
   - **Jogo Principal (Laboratório de Combate):** `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html` (atalho na raiz: `JOGAR_ARENAMON.html`)
   - **Animation Studio & Rigging:** `prototypes/studio/dist/arenamon-animation-studio.html`
   - **Propostas de Rigging (A/B/C):** `prototypes/studio/proposals/index.html` (com `proposta-a.html`, `proposta-b.html`, `proposta-c.html`)
   - **Importador de Modelos:** `prototypes/importer/dist/importador-prototipo.html`
   - **Laboratório de Blocos:** `prototypes/placeholders/dist/criaturas-laboratorio.html`
   - **Protótipo Legado de Blocos (Descontinuado):** `prototypes/game/dist/arenamon-jogavel.html`
   - **Documentação:** Diretório centralizado `docs/`.

4. **Publicação Segura de Compilados no GitHub:**
   Arquivos HTML compilados (`dist/`) podem permanecer ignorados pelo Git quando forem regeneráveis, mas devem existir na pasta local oficial ao serem entregues. Quando for necessário disponibilizar um HTML compilado externamente pelo GitHub, utilize mecanismos apropriados de publicação (como GitHub Releases ou artefatos de GitHub Actions), sem inflar o histórico de commits do repositório Git com arquivos gerados desnecessários.

## Antes de editar

1. Execute `git status --short --branch`, `git remote -v` e `git fetch origin`.
2. Verifique o workspace atual com `npm run verify:workspace`. Confirme que está operando na pasta local oficial.
3. Leia as mudanças locais existentes e não as sobrescreva.
4. Cada agente deverá trabalhar apenas nos seus arquivos e áreas de responsabilidade:
   - **Codex:** Núcleo de rigging estrutural, biblioteca de animações CC0 e CI Windows Server.
   - **Claude:** Workbench de prototipagem, integração de telemetria no studio e balanceamento de combate.
   - **Antigravity:** Propostas visuais de rigging (A/B/C), telemetria programática e auto-rig adaptativo.
5. Nunca use force push, descarte mudanças ou reescreva histórico sem autorização expressa.

## Fluxo rápido de entrega (padrão; mudança comum deve sair em ~1 minuto)

O build leva ~2 s; o que atrasava era a cadeia `npm test` sequencial (~130 testes, navegadores, 5+ min). Use:

0. **Vigia (melhor caminho):** `npm run vigia` (ou duplo clique em `INICIAR_VIGIA.bat`) fica ligado e refaz o jogo a cada arquivo salvo (~1,5 s). Com ele ligado, a entrega de qualquer mudança é só dar F5 em `JOGAR_ARENAMON.html`. Se o build quebrar, a janela mostra o erro e o jogo anterior continua valendo.
1. `npm run rapido:build` — só recompila (~2 s). Já dá para abrir `JOGAR_ARENAMON.html`.
2. `npm run rapido` — build + typecheck + testes unitários rápidos **em paralelo**, pulando os que não dependem do que mudou (cache por importação; ~35 s na 1ª vez, ~4 s sem mudança). `--sem-cache` força tudo. Falha só reexecutada sozinha antes de acusar.
3. `npm run rapido:tudo` — inclui os testes lentos de IA/propriedades (~5 min). Só quando mexer em IA, regras ou simulação.
4. Testes de navegador (`*.browser.mjs`): rode **só o da área tocada**, nunca a bateria inteira.
5. `npm run verify` completo fica para marcos grandes (release, mudança de arquitetura), não para cada entrega.
6. Commit pequeno e direto; sem reler/relatar toda a bateria. Diga na resposta qual teste rodou.

## Antes de entregar (marcos grandes; em mudança comum vale o fluxo rápido acima)

1. Revise `git diff` e `git status --short`.
2. Confirme que nenhum segredo (chaves, tokens, senhas) foi incluído; nunca use `git add -f` para contornar as exclusões.
3. Execute `npm run verify` e corrija falhas relacionadas à mudança.
4. Crie um commit descritivo e identificável.
5. Atualize sua branch com o remoto sem sobrescrever trabalho alheio e envie o commit.
6. Confirme a sincronização com `git fetch origin` e compare `git rev-parse HEAD` com `git rev-parse origin/$(git branch --show-current)`.
7. Informe o hash exato entregue, os testes executados e qualquer limitação.

Uma tarefa não está sincronizada apenas porque os arquivos foram salvos. Ela termina quando o commit enviado e o commit remoto foram comparados e confirmados.

## Modelos e recursos de personagens

Por decisão do responsável pelo projeto, **não há bloqueio de conteúdo**: modelos, animações e recursos da pasta `chars/` são versionados e publicados no GitHub (repositório privado), inclusive os que não são autorais. A responsabilidade pelos direitos de uso e redistribuição é do responsável. Exceção apenas de tamanho: o material de trabalho pesado do Vigor (`chars/vigor/`, `chars/vigor.zip`, cerca de 1,5 GB de renders, `.blend` e logs) fica local.
