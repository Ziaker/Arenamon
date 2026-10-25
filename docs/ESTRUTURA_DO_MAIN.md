# Estrutura do `main.js` do Laboratório de Combate

`prototypes/combat-lab/src/main.js` virou a **raiz de composição**: cria os objetos únicos (jogo, visão, entrada, painéis) e chama, na mesma ordem de antes, as funções de inicialização. Tudo o mais mora em `src/app/`:

| Módulo | O que tem |
|---|---|
| `match-flow.js` | iniciar/pausar partida, passo da simulação, replay, aquecimento, modo zen |
| `scenario-flow.js` | cenários, reprodução de sequências, status da gravação |
| `match-stats.js` | sons, estatísticas e fim de luta (KO), avisos de Moves |
| `tuning-sync.js` | aplicar ajustes, sincronizar estado, patch do `config.ts`, download |
| `characters-sync.js` | janelas de combate e durações vindas das animações |
| `live-panels.js` | dados ao vivo, botões, gavetas, abas, seta fora da tela |
| `main-loop.js` | o laço de quadros (`frame`) |
| `workspace-boot.js` | abertura do workspace persistente e relatórios |
| `wire-*.js` | ligações da interface (`wireRecording`, `wireExport`, `wireControls`, `wireToolbar`, `wireDrawers`, `wireKeyboard`, `wireCharacters`, `startApp`…): cada uma é o mesmo bloco de `$('x').onclick = …` de antes, agora numa função |

Regras: os módulos **só definem funções** (nada roda ao carregar); eles importam os objetos únicos de `../main.js` e só os usam em tempo de chamada. A ordem de execução do `main.js` é a de antes. Dividido por `scripts/dividir-raiz.mjs` (planos em `scripts/planos/main-*.json`); teste de fumaça: `node scripts/fumaca-navegador.mjs` (8 testes de navegador, ~4 min; precisa de `npm run build:studio` uma vez).
