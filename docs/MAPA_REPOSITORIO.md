# Arenamon — Mapa Estrutural do Repositório

Este documento é a referência oficial para desenvolvedores, agentes (Codex, Claude, Antigravity) e pesquisadores entenderem a organização do projeto Arenamon, a localização de cada componente e as razões técnicas que regem a estrutura de diretórios.

---

## 1. Visão Geral da Arquitetura

O **Arenamon** é composto por aplicações independentes e modulares desenvolvidas com Three.js e TypeScript/JavaScript, projetadas para execução **100% offline via protocolo `file://`**, sem necessidade de servidores locais.

```text
Arenamon/
├── ABRIR_ARENAMON.html           # Central de Acesso Rápido a todos os Ambientes (Duplo Clique)
├── HTMLS_ARENAMON.html           # Índice compacto dos HTMLs mais usados
├── JOGAR_ARENAMON.html           # Atalho estável para o jogo correto
├── TESTES_ARENAMON.html          # Central Interativa de Testes, Comandos e Evidências
├── README.md                     # Visão geral do projeto e guia inicial
├── AGENTS.md                     # Protocolo obrigatório de colaboração entre agentes
├── package.json                  # Scripts de build, tipagem e verificação
├── tsconfig.json                 # Configuração central de TypeScript
│
├── docs/                         # Documentação Unificada do Projeto
│   ├── MAPA_REPOSITORIO.md       # Este mapa estrutural
│   ├── CENTRAL_DE_TESTES.md      # Catálogo completo e matriz de testes
│   ├── STATUS_PROJETOS_E_BRANCHES.md # Estado das branches paralelas e roadmap
│   ├── GUIA_COLABORACAO_AGENTES.md   # Guia rápido de colaboração sem conflitos
│   ├── CONTRATO_TECNICO_RIGGING.md   # Contrato canônico de telemetria, patch e auto-rig
│   ├── OTIMIZACAO_DESEMPENHO_WARMUP.md # Diagnóstico de stuttering e arquitetura de warm-up/loading
│   ├── REVISAO_GDD_COMBATE.md    # Revisão do GDD de Combate (Etapa A aprovada)
│   ├── ROSTER.md                 # Personagens e atributos planejados
│   └── GDD_Pokemon_Arena_Fighter_v0_1.docx # Game Design Document original
│
├── scripts/                      # Scripts Utilitários de Governança
│   └── verify-workspace.mjs      # Verificação de workspace oficial (npm run verify:workspace)
│
├── prototypes/                   # Aplicações, Protótipos e Ambientes Funcionais
│   ├── index.html                # Catálogo clássico de protótipos
│   │
│   ├── combat-lab/               # 1. JOGO PRINCIPAL — ARENAMON COMBATE (ver docs/INDICE_MODULOS.md)
│   │   ├── dist/                 # Artefato compilado (npm run build)
│   │   │   └── arenamon-combate-laboratorio.html # Jogo principal completo offline (~1.5 MB)
│   │   ├── src/                  # Motor completo (X/C, Moves, VFX 3D sólidos, IA tática, UI Bento)
│   │   └── test/                 # 35+ suítes unitárias + verificações de navegador no Edge
│   │
│   ├── studio/                   # 2. ANIMATION STUDIO & RIGGING STUDIO
│   │   ├── dist/                 # Artefato compilado
│   │   │   └── arenamon-animation-studio.html # Studio de animação e rigging (1.1 MB)
│   │   ├── src/                  # Código-fonte modular (timeline, rigging, exportador GLB)
│   │   ├── test/                 # Testes unitários do editor e do núcleo de rigging
│   │   │   ├── ops.test.mjs      # 18 testes unitários do editor de animações
│   │   │   ├── rigging.test.mjs  # 7 testes unitários do núcleo de rigging
│   │   │   └── rigging.browser.mjs # 12 verificações de navegador do Rigging Studio
│   │   ├── verify.mjs            # 20 verificações de navegador do Animation Studio
│   │   ├── proposals/            # 3. PROTÓTIPOS VISUAIS DE RIGGING (Aguardando Homologação)
│   │   │   ├── index.html        # Portal comparador das propostas A, B e C
│   │   │   ├── proposta-a.html   # Proposta A: Rigging Workspace (Quad-View, Gizmo)
│   │   │   ├── proposta-b.html   # Proposta B: Guided Rigging (Paper Doll 2D, Wizard)
│   │   │   ├── proposta-c.html   # Proposta C: Hybrid Studio (Guiado ⇄ Livre)
│   │   │   ├── test-proposals.mjs# Testes automatizados das 3 propostas (Playwright)
│   │   │   ├── test-codex-cross.mjs # Teste cruzado com o núcleo Codex 7323b48
│   │   │   └── screenshots/      # Evidências e capturas visuais das propostas
│   │   └── build.mjs             # Compilador do Animation Studio
│   │
│   ├── game/                     # 4. PROTÓTIPO LEGADO DE BLOCOS (Descontinuado; não é o jogo atual)
│   │   ├── dist/
│   │   │   └── arenamon-jogavel.html  # Protótipo inicial antigo (569 KB — ignorar)
│   │   ├── src/                  # Código TypeScript inicial congelado
│   │   └── README.md             # Histórico do protótipo inicial
│   │
│   ├── placeholders/             # 5. LABORATÓRIO BASE (Criaturas Geométricas)
│   │   ├── dist/
│   │   │   └── criaturas-laboratorio.html # Visualizador simples de dois blocos (546 KB)
│   │   ├── src/                  # Código TypeScript seguro
│   │   ├── verify.mjs            # Verificação de órbita, renderização e mobile
│   │   └── build.mjs             # Compilador do laboratório base
│   │
│   ├── importer/                 # 6. IMPORTADOR DE PROTÓTIPOS E CONVERSÃO
│   │   ├── dist/
│   │   │   └── importador-prototipo.html # Importador e conversor GLB/FBX (916 KB)
│   │   ├── src/                  # Importação de malhas, descarte de texturas, unlit
│   │   └── verify.mjs            # Testes de importação e integridade
│   │
│   └── croagunk/                 # 7. DIAGNÓSTICO DE MALHA E ESQUELETO
│       ├── dist/
│       │   └── croagunk-laboratorio.html # Laboratório diagnóstico de deformação
│       └── validation/           # Capturas de mandíbula, bochechas e agachamento
│
└── .github/                      # Workflows de Integração Contínua (CI)
    └── workflows/
        ├── arenamon-studio-rigging.yml # CI de Rigging e Studio (Codex)
        └── studio-rigging-proposals.yml# CI de validação das propostas e testes
```

---

## 2. Por que os códigos-fonte não foram movidos fisicamente

Para garantir **estabilidade absoluta** e não quebrar o trabalho paralelo dos outros agentes (Codex e Claude):

1. **Dependências do Build (`npm run build`):**
   Os scripts em `package.json` dependem explicitamente de caminhos como `prototypes/game/build.mjs`, `prototypes/studio/build.mjs`, etc. Movimentações físicas indiscriminadas quebrariam scripts de compilação automáticos e referências de `tsconfig.json`.

2. **Isolamento de Branches em Aberto:**
   O Codex desenvolve ativamente em branches de rigging (`codex/rig-editor-multimesh-tests`), enquanto melhorias de combate ocorreram em `feat/game-etapa-a`. Mover arquivos de pasta geraria conflitos de merge extensos e desnecessários (`CONFLICT: file deleted/moved`).

3. **Solução Adotada (Camada Superior de Acesso):**
   Em vez de quebrar caminhos técnicos funcionais, criamos uma **camada superior intuitiva**:
   - `ABRIR_ARENAMON.html` na raiz: permite que qualquer usuário encontre e execute instantaneamente qualquer ambiente com um clique.
   - `TESTES_ARENAMON.html`: permite navegar por todos os testes, ver comandos e consultar relatórios.
   - `docs/`: pasta unificada para documentação técnica e decisões de design.

---

## 3. Guia de Localização Rápida

| O que você procura? | Caminho de Execução (Browser) | Código-Fonte / Testes | Documentação |
|---|---|---|---|
| **Jogar Arenamon** | `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html` | `prototypes/combat-lab/src/` | `docs/REVISAO_GDD_COMBATE.md` |
| **Animation Studio** | `prototypes/studio/dist/arenamon-animation-studio.html` | `prototypes/studio/src/` | `prototypes/studio/README.md` |
| **Rigging Studio (Integrado)** | Aba "Rigging" em `arenamon-animation-studio.html` | `prototypes/studio/src/rigging/` | `prototypes/studio/RIGGING_FASE1.md` |
| **Propostas de Rigging (A/B/C)**| `prototypes/studio/proposals/index.html` | `prototypes/studio/proposals/` | `prototypes/studio/proposals/README.md` |
| **Protótipo antigo de blocos** | `prototypes/game/dist/arenamon-jogavel.html` | `prototypes/game/src/` | `prototypes/game/README.md` |
| **Importador de Modelos** | `prototypes/importer/dist/importador-prototipo.html` | `prototypes/importer/src/` | `prototypes/importer/README.md` |
| **Visualizador de Blocos** | `prototypes/placeholders/dist/criaturas-laboratorio.html`| `prototypes/placeholders/src/`| `prototypes/placeholders/README.md`|
| **VFX 3D Elemental (Psíquico)** | `prototypes/vfx-elemental/dist/vfx-elemental-psiquico.html` | `prototypes/vfx-elemental/src/` | `docs/VFX_ELEMENTAL_PSIQUICO.md` |
| **HUD de Vida, Stamina & Moves (propostas)** | `prototypes/hud-moves/dist/hud-moves-laboratorio.html` | `prototypes/hud-moves/src/` | `docs/HUD_VIDA_STAMINA_MOVES_LAB.md` |
| **HUD de Progressão & Consumíveis (propostas)** | `prototypes/hud-consumiveis/dist/hud-consumiveis-laboratorio.html` | `prototypes/hud-consumiveis/src/` | `docs/HUD_CONSUMIVEIS_LAB.md` |
| **Câmera Cinemática (ZZZ)** | Botão 🎬 em `arenamon-combate-laboratorio.html` | `prototypes/combat-lab/src/view/cinematic-camera.js` | `docs/CAMERA_CINEMATICA_ZZZ.md` |
| **Matriz de Testes** | `TESTES_ARENAMON.html` | `test*.mjs` em cada pasta | `docs/CENTRAL_DE_TESTES.md` |
