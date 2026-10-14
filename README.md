# Arenamon

Arenamon é um projeto experimental de combate 3D em arena. Este repositório privado é a fonte de verdade para o código, a documentação e os protótipos cuja distribuição foi autorizada. As decisões de design continuam registradas no GDD e não devem ser alteradas sem autorização.

## Começar

Requisitos: Node.js 20 ou superior, npm e Microsoft Edge (usado pelos testes automatizados).

```powershell
npm ci
npm run verify
```

Depois do build, abra `prototypes/game/dist/arenamon-jogavel.html` para jogar, ou `prototypes/index.html` para ver o catálogo. Os HTMLs gerados funcionam offline, via duplo clique, sem servidor local. As regras, controles, arquitetura, testes e parâmetros provisórios do jogo estão em [prototypes/game/README.md](prototypes/game/README.md).

## Protótipos disponíveis

| Versão | Laboratório | Situação |
| --- | --- | --- |
| 1.0.0 | Visualizador anterior de dois blocos | Preservado e testado offline |
| Protótipo 1 | Combate jogável com blocos, IA e fluxo de partida | Avaliação local; parâmetros provisórios identificados |
| — | Arena | Aguardando protótipo aprovado para distribuição |

O índice não aponta para modelos ou recursos extraídos de jogos. GitHub Pages não deve ser ativado até que a conta confirme suporte adequado ao repositório privado e que todo o conteúdo publicado tenha licença verificada.

## Estrutura versionada

```text
Arenamon/
├── AGENTS.md                  # Protocolo de trabalho para Codex e Antigravity
├── docs/
│   ├── GDD_Pokemon_Arena_Fighter_v0_1.docx
│   ├── ROSTER.md
│   └── relatorio-auditoria-rig-croagunk.md
├── prototypes/
│   ├── index.html             # Catálogo local das demonstrações
│   └── placeholders/
│       ├── src/               # TypeScript e template do laboratório seguro
│       ├── build.mjs          # Gera o HTML offline
│       ├── verify.mjs         # Testes funcionais e visuais
│       └── dist/              # Gerado localmente; não versionado
├── package.json
├── package-lock.json
└── tsconfig.json
```

Existem ainda, apenas na pasta local, modelos e laboratórios de pesquisa relacionados a personagens e jogos proprietários. Eles são preservados no disco, mas bloqueados pelo `.gitignore` e não fazem parte do repositório.

## Gerar e testar os HTMLs offline

```powershell
npm run build
npm run typecheck
npm test
npm run verify
```

Os testes confirmam o visualizador anterior e o novo combate: movimento, física, esquiva, defesa, tackle, stamina, IA, fluxo de partida e controles no navegador. A suíte verifica `file://` com rede desabilitada, ausência de requisições externas e erros de console. A fonte modular do jogo fica em `prototypes/game/src/`; artefatos gerados e capturas não são versionados.

## Versão e sincronização

A versão do pacote está em `package.json`. Para ver exatamente qual revisão está em uso:

```powershell
git branch --show-current
git rev-parse HEAD
git status --short --branch
```

Codex e Antigravity devem seguir o protocolo de `AGENTS.md`: verificar o Git antes de editar, preservar mudanças alheias, usar branch quando houver trabalho paralelo, executar `npm run verify`, criar um commit descritivo, enviar ao `origin` e confirmar que o commit local coincide com o remoto. Salvar um arquivo não equivale a sincronizá-lo.

## Política de recursos

- Não versionar modelos, texturas, animações, áudio ou dados extraídos de Pokkén Tournament/DX, Pokémon Scarlet/Violet ou qualquer outro jogo proprietário.
- Não contornar o `.gitignore` com `git add -f`.
- Antes de adicionar um recurso binário, registrar sua autoria, origem e licença de redistribuição.
- Manter recursos próprios ou legitimamente redistribuíveis, junto da respectiva licença.
- Tratar todo item sem licença comprovada como local e restrito.

O código deste projeto está marcado como `UNLICENSED`; nenhuma permissão pública de reutilização é concedida.

