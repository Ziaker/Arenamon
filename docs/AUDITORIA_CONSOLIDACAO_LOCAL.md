# Auditoria de consolidação local do Arenamon

Data da auditoria: 14 de outubro de 2026.

## Resultado executivo

O único checkout oficial para edição, compilação e entrega é:

`C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon`

As cinco pastas `Arenamon-*` existentes na Área de Trabalho não são clones independentes. Elas são worktrees legados vinculados ao repositório Git da pasta oficial. Todos estavam limpos, possuíam upstream e estavam sincronizados com `origin` no momento da auditoria. Nenhuma pasta foi apagada, movida ou limpa.

A pasta `Z` não pertence ao Arenamon. Ela não é um repositório Git na raiz e contém projetos independentes, incluindo `ispiraito` e `Magispell`. Ela foi somente identificada e ficou fora de qualquer alteração.

## Inventário das pastas da Área de Trabalho

| Pasta | Tipo | Branch | HEAD auditado | Estado |
|---|---|---|---|---|
| `Arenamon` | Checkout principal oficial | `feat/reorganizacao-acesso-central` | `026a682218f4c122502d9b066e34437cb738d172` | Limpo e sincronizado antes do início desta consolidação |
| `Arenamon-workbench` | Git worktree legado | `integration/workbench-telemetry-autorig` | `516ca8d61a5d7a3cf2c3c4eb279b236a70145bfa` | Limpo, 0 à frente/0 atrás |
| `Arenamon-game` | Git worktree legado | `feat/game-etapa-a` | `245e5b988c57e51a36665ec9449e5d895b563e34` | Limpo, 0 à frente/0 atrás |
| `Arenamon-diag` | Git worktree legado | `fix/studio-diagnostic-ci` | `a549d23f53d74cc1d13a0272856330c477e07afe` | Limpo, 0 à frente/0 atrás |
| `Arenamon-lab` | Git worktree legado | `feat/combat-core-etapa-a` | `f337e00baeb991ac0ea62dcf46a54acf6d95a5d5` | Limpo, 0 à frente/0 atrás |
| `Arenamon-studio` | Git worktree legado | `feat/studio-editor-fase1` | `6e46b46045cd9386623d9ee4ce7e24507c4721b4` | Limpo, 0 à frente/0 atrás |
| `Z` | Pasta independente; não é Arenamon | Não aplicável | Não aplicável | Não tocar |

Todos os worktrees Arenamon usam o remoto oficial `https://github.com/Ziaker/Arenamon.git`.

## Outros worktrees registrados

Também foram encontrados quatro worktrees gerenciados fora da pasta oficial. Todos estavam limpos e com o HEAD idêntico à branch remota:

| Branch | HEAD |
|---|---|
| `codex/rig-editor-fase1` | `73955d5e837c0e834bedc632edc6a694374258d0` |
| `codex/rig-editor-stabilization` | `7323b48f992e56ab9a7f5e475296529237df3eb4` |
| `codex/rig-editor-multimesh-tests` | `35213f923574f869eaaf4f45ffdda892311d103e` |
| `feat/studio-animation-library` | `3f3cb6793089b1dd0b8c795977b3988f131cfbc2` |

Esses checkouts também são legados sob a política atual. O conteúdo versionável já está preservado nas respectivas branches remotas. A remoção dos diretórios e dos registros de worktree depende de autorização explícita do usuário.

## Trabalho preservado e arquivos exclusivos

Não havia alterações rastreadas, staged ou arquivos não rastreados versionáveis nas cinco pastas secundárias da Área de Trabalho. Portanto, não foi necessário criar commits de resgate.

O código exclusivo de cada frente está preservado no histórico da própria branch, sem merge em `main`:

- jogo: `feat/game-etapa-a`;
- laboratório de combate: `feat/combat-core-etapa-a`;
- Animation Studio: `feat/studio-editor-fase1`;
- diagnóstico do Studio: `fix/studio-diagnostic-ci`;
- Workbench integrado: `integration/workbench-telemetry-autorig`;
- biblioteca de animações CC0: `feat/studio-animation-library`;
- rigging: branches `codex/rig-editor-*`.

Foram encontrados HTMLs compilados e fixtures ignorados pelo Git nos worktrees. Eles são artefatos regeneráveis, não a única cópia do código. O laboratório contém a fixture sintética `prototypes/combat-lab/validation/personagem-studio.glb`; ela não foi publicada. Modelos proprietários e arquivos locais sob `chars/`, `prototypes/croagunk/` e `validation/` continuam somente na pasta oficial e permanecem bloqueados pelo `.gitignore`.

Há dois stashes compartilhados pelo repositório, preservados sem aplicação ou remoção:

- `stash@{0}`: `local-wip-fix-arena-movement-camera-template`;
- `stash@{1}`: `backup-local-codex-jogavel-blocos`.

## Acesso definitivo na pasta oficial

- central de ambientes: `ABRIR_ARENAMON.html`;
- central de testes: `TESTES_ARENAMON.html`;
- jogo: `prototypes/game/dist/arenamon-jogavel.html`;
- Animation Studio e Rigging: `prototypes/studio/dist/arenamon-animation-studio.html`;
- propostas de rigging: `prototypes/studio/proposals/index.html`;
- importador: `prototypes/importer/dist/importador-prototipo.html`;
- laboratório base: `prototypes/placeholders/dist/criaturas-laboratorio.html`;
- laboratório de combate, quando a branch correspondente estiver ativa e compilada: `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html`.

Os compilados `dist/` são locais e regeneráveis. Uma branch que não contenha determinado subsistema não deve receber cópia manual conflitante de outra branch. Use o histórico Git para selecionar a branch e execute o build correspondente no checkout oficial.

## Procedimento obrigatório daqui em diante

1. Trabalhar somente na pasta oficial.
2. Permitir somente um agente escritor por vez no checkout oficial.
3. Executar `npm run verify:workspace` antes de editar.
4. Preservar cada frente na branch correspondente; não fazer merge em `main` sem autorização.
5. Não criar clones permanentes nem worktrees fora da pasta oficial.
6. Entregar fontes, relatórios e HTMLs somente dentro da pasta oficial.
7. Antes de encerrar uma tarefa, executar `npm run verify`, publicar a branch e comparar os hashes local e remoto.

## Pastas candidatas à remoção posterior

Após esta auditoria, as cinco pastas abaixo são candidatas à remoção controlada porque seus worktrees estão limpos e os commits estão publicados:

- `Arenamon-workbench`;
- `Arenamon-game`;
- `Arenamon-diag`;
- `Arenamon-lab`;
- `Arenamon-studio`.

Os quatro worktrees em `.codex/worktrees/` também são candidatos após confirmação de que nenhum processo ainda os utiliza. A remoção deve ocorrer por `git worktree remove` e somente depois de nova verificação de status e autorização expressa. `Z` não é candidata: não pertence ao Arenamon.
