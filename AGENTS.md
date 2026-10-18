# Protocolo de colaboração

Estas regras se aplicam obrigatoriamente a Codex, Claude, Antigravity e qualquer outro agente ou desenvolvedor que trabalhe neste repositório.

## Destinos Oficiais Exclusivos do Projeto

O projeto possui rigorosamente apenas dois destinos oficiais:

- **LOCAL:** `C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon`
- **GITHUB:** `https://github.com/Ziaker/Arenamon`

Todo código-fonte, documentação, recurso permitido, teste e entrega final deve ficar organizado dentro da pasta local oficial, com o conteúdo versionável publicado na branch correspondente do GitHub.

## Política Obrigatória de Diretórios e Workspaces

0. **Escritor único no checkout oficial:**
   Somente um agente pode modificar `C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon` por vez. Antes de editar, o agente deve verificar `git status --short --branch`; se surgirem mudanças durante a tarefa, deve interromper edições sobrepostas, auditar o diff e coordenar a continuidade. Outros agentes podem fazer auditorias somente leitura e preparar instruções, mas não podem alterar simultaneamente o checkout oficial nem criar clones ou worktrees permanentes.

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
4. Se outro agente estiver trabalhando no checkout oficial, não edite em paralelo. Coordene a passagem do controle; uma branch separada não autoriza dois escritores simultâneos na mesma pasta.
5. Cada agente deverá trabalhar apenas nos seus arquivos e áreas de responsabilidade:
   - **Codex:** Núcleo de rigging estrutural, biblioteca de animações CC0 e CI Windows Server.
   - **Claude:** Workbench de prototipagem, integração de telemetria no studio e balanceamento de combate.
   - **Antigravity:** Propostas visuais de rigging (A/B/C), telemetria programática e auto-rig adaptativo.
6. Nunca use force push, descarte mudanças ou reescreva histórico sem autorização expressa.

## Antes de entregar

1. Revise `git diff` e `git status --short`.
2. Confirme que nenhum segredo ou recurso proprietário foi incluído; nunca use `git add -f` para contornar as exclusões.
3. Execute `npm run verify` e corrija falhas relacionadas à mudança.
4. Crie um commit descritivo e identificável.
5. Atualize sua branch com o remoto sem sobrescrever trabalho alheio e envie o commit.
6. Confirme a sincronização com `git fetch origin` e compare `git rev-parse HEAD` com `git rev-parse origin/$(git branch --show-current)`.
7. Informe o hash exato entregue, os testes executados e qualquer limitação.

Uma tarefa não está sincronizada apenas porque os arquivos foram salvos. Ela termina quando o commit enviado e o commit remoto foram comparados e confirmados.

## Conteúdo restrito

Modelos e recursos extraídos de jogos proprietários permanecem somente no ambiente local até haver comprovação dos direitos de uso e redistribuição. Não os adicione ao Git, a releases, a Pages ou a qualquer serviço externo.
