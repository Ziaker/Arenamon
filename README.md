# Arenamon

Arenamon é um projeto experimental de combate 3D em arena. Este repositório privado é a fonte de verdade para o código, a documentação e os protótipos cuja distribuição foi autorizada. As decisões de design continuam registradas no GDD e não devem ser alteradas sem autorização.

---

## 🚀 Como Começar Imediatamente

Para abrir e utilizar qualquer módulo, protótipo ou teste sem precisar de terminal ou servidor web, basta abrir o arquivo central de acesso por **duplo clique no navegador**:

👉 **[`ABRIR_ARENAMON.html`](ABRIR_ARENAMON.html)**

Esse arquivo funciona 100% offline via protocolo `file://` e oferece atalhos diretos para:
- **Jogo Principal (Laboratório de Combate)** (`prototypes/combat-lab/dist/arenamon-combate-laboratorio.html` ou [`JOGAR_ARENAMON.html`](JOGAR_ARENAMON.html))
- **Animation Studio & Rigging Studio** (`prototypes/studio/dist/arenamon-animation-studio.html`)
- **Propostas Visuais de Rigging (A, B e C)** (`prototypes/studio/proposals/index.html`)
- **Central Interativa de Testes** ([`TESTES_ARENAMON.html`](TESTES_ARENAMON.html))
- **Laboratórios de Importação e Diagnóstico**
- **Documentação Unificada** em `docs/`

---

## 🛠️ Ambiente de Desenvolvimento e Testes

Requisitos: Node.js 20 ou superior, npm e Microsoft Edge (usado pelos testes automatizados Playwright).

```powershell
npm ci
npm run verify
```

### Comandos de Compilação e Verificação
```powershell
npm run build     # Gera todos os bundles HTML offline independentes
npm run typecheck # Validação estática de tipos TypeScript
npm test          # Executa todas as suítes de testes unitários e de navegador
npm run verify    # Executa typecheck + test de ponta a ponta
```

Para detalhes de cada comando e seus objetivos, consulte a **[Central de Testes](docs/CENTRAL_DE_TESTES.md)** ou abra **[`TESTES_ARENAMON.html`](TESTES_ARENAMON.html)**.

---

## 📁 Estrutura de Diretórios e Documentação

O repositório foi organizado de forma segura e não-destrutiva, preservando a modularidade do código e evitando conflitos com branches ativas:

```text
Arenamon/
├── ABRIR_ARENAMON.html           # Central de Acesso Rápido a todos os Ambientes
├── JOGAR_ARENAMON.html           # Atalho direto para o Jogo Principal (Combat Lab)
├── HTMLS_ARENAMON.html           # Índice rápido dos HTMLs compilados
├── TESTES_ARENAMON.html          # Central Interativa de Testes, Comandos e Evidências
├── README.md                     # Este guia inicial
├── AGENTS.md                     # Protocolo obrigatório de colaboração entre agentes
├── package.json                  # Scripts e dependências
│
├── docs/                         # Documentação Central Unificada
│   ├── MAPA_REPOSITORIO.md       # Mapa estrutural e justificativa das pastas
│   ├── CENTRAL_DE_TESTES.md      # Catálogo e matriz técnica completa de testes
│   ├── STATUS_PROJETOS_E_BRANCHES.md # Status das branches paralelas e roadmap
│   ├── GUIA_COLABORACAO_AGENTES.md   # Guia prático de trabalho para agentes
│   ├── REVISAO_GDD_COMBATE.md    # Revisão do GDD de Combate (Etapa A aprovada)
│   ├── ROSTER.md                 # Roster e atributos dos lutadores
│   └── GDD_Pokemon_Arena_Fighter_v0_1.docx # Game Design Document original
│
├── prototypes/                   # Aplicações e Ambientes Funcionais
│   ├── combat-lab/               # JOGO PRINCIPAL (Laboratório de Combate 3D completo)
│   ├── studio/                   # Animation Studio e Rigging Studio integrado
│   │   └── proposals/            # Três propostas visuais independentes de Rigging
│   ├── placeholders/             # Laboratório base com dois blocos geométricos
│   ├── importer/                 # Importador e conversor de modelos FBX/GLB
│   ├── croagunk/                 # Laboratório local de diagnóstico de deformação
│   └── game/                     # Protótipo inicial legado de blocos (descontinuado)
│
└── .github/workflows/            # Workflows de Integração Contínua (CI)
```

---

## 📌 Status dos Ambientes e Protótipos

| Ambiente | Localização Principal | Situação |
|---|---|---|
| **Jogo Principal (Combat Lab)** | `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html` | **Jogo oficial ativo** · X/C, Moves, VFX 3D, IA Tática e UI Zero-Scroll |
| **Animation Studio** | `prototypes/studio/dist/arenamon-animation-studio.html` | Totalmente operacional · 3 Modos (Rigging, Animar, Preview) |
| **Propostas de Rigging** | `prototypes/studio/proposals/index.html` | 3 opções funcionais · Aguarda homologação |
| **Visualizador de Blocos**| `prototypes/placeholders/dist/criaturas-laboratorio.html` | Base segura de blocos geométricos 1.0.0 |
| **Importador de Modelos** | `prototypes/importer/dist/importador-prototipo.html` | Conversão flat color sem assets restritos |
| **Protótipo Legado (Descontinuado)** | `prototypes/game/dist/arenamon-jogavel.html` | Protótipo inicial de blocos preservado apenas para histórico |

---

## 🤝 Protocolo de Colaboração e Versão

Codex, Claude, Antigravity e qualquer colaborador humano devem seguir as regras de **[`AGENTS.md`](AGENTS.md)** e **[`docs/GUIA_COLABORACAO_AGENTES.md`](docs/GUIA_COLABORACAO_AGENTES.md)**:

1. Nunca altere a `main` diretamente e nunca use `git push --force`.
2. Verifique o Git (`git status`, `git remote -v`, `git fetch origin`, `git stash list`) antes de editar.
3. Preserve todos os stashes locais existentes.
4. Execute `npm run verify` antes de submeter qualquer alteração.
5. Confirme a sincronização comparando `git rev-parse HEAD` com `git rev-parse origin/<sua-branch>`.

---

## ⚖️ Política de Recursos e Conteúdo Restrito

- **Modelos e recursos extraídos de franquias ou jogos proprietários** (como Pokkén Tournament ou Pokémon) permanecem **estritamente no ambiente local**, bloqueados pelo `.gitignore`.
- Nunca utilize `git add -f` para forçar a inclusão desses arquivos.
- Todo recurso binário versionado deve possuir autoria comprovada ou licença explícita de redistribuição.
- O código deste projeto está marcado como `UNLICENSED`; nenhuma permissão pública de reutilização é concedida.
