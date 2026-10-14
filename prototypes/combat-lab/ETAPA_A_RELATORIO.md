# Arenamon — Etapa A: relatório de execução (14/10/2026)

## Escopo e isolamento

- Base: `feat/combat-core-etapa-a`, commit `34f9b1f12757c5bd6c7d3782c747007136ad332c` (trabalho parcial do Claude).
- Branch de conclusão: `feat/combat-core-etapa-a-gpt6`. Nenhum merge na `main`.
- Fontes: `prototypes/combat-lab/src/`; HTML offline gerado pelo build: `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html` (diretório ignorado pelo Git).
- Não foram adicionados arquivos proprietários GLB/FBX ou alterados os arquivos locais do importador de outro agente.

## Alterações efetivas

1. O controlador da base parcial passou a usar `actions.dodge`, `actions.tackle` e `actions.cancel` para os parâmetros exclusivos de X/C e do cancelamento.
2. O ajustador foi reorganizado nas categorias **Esquiva C**, **Tackle X** e **Cancelamento C → X**, com sliders independentes, faixas de valores e tooltips.
3. A exportação do calibrador evoluiu para JSON versão **8**. Na importação de JSONs v5, v6 ou v7, os parâmetros compartilhados antigos são migrados de forma explícita, mantendo prioridade para campos novos definidos diretamente. A prévia apresenta campos migrados e ignorados. Presets anteriores usam a mesma migração ao carregar.
4. O Animation Studio sincroniza apenas durações de clips disponíveis e autorizadas pelo controle de sincronização. Eventos de invulnerabilidade do GLB **não reescrevem** os parâmetros autoritativos da simulação; continuam disponíveis para comparação de janelas de animação.
5. Os testes antigos de configuração foram adaptados para `actions.*`, e foi adicionada `test/etapa-a.test.mjs`.

## Resultados reproduzidos em Windows / GitHub Actions

Execução: [GitHub Actions — Etapa A](https://github.com/Ziaker/Arenamon/actions/runs/38590551618).

| Grupo | Resultado |
| --- | --- |
| `npm run build` (todos os protótipos) | PASSOU; laboratório gerado com ~803 KB |
| `node prototypes/combat-lab/test/sim.test.mjs` | PASSOU — 18 testes |
| `node prototypes/combat-lab/test/etapa-a.test.mjs` | PASSOU — 29 testes dedicados |
| `node prototypes/combat-lab/verify.mjs` | PASSOU — 15 verificações de navegador Edge offline |
| `npm run verify` na raiz | **FALHOU** em `prototypes/placeholders/verify.mjs`, num clique Playwright `#reset` que atingiu timeout na VM Windows sem GPU. A falha ocorreu antes de chegar às verificações do laboratório dentro dessa suíte. Não foi diagnosticada nem corrigida no outro protótipo. |
| Paridade com HTML v6 original | Não reproduzida neste runner; depende do HTML original em um caminho local opcional. Não confundir paridade informada anteriormente pelo Claude com evidência desta execução. |

Os 29 testes novos exercitam 8 direções de tackle X, 8 direções de esquiva C sem dano ofensivo, tackle afastando-se do alvo, independência de duração/distância/custo/invulnerabilidade, cancelamento C → X em vários momentos, stamina insuficiente, janela própria, cancelamento durante salto, ausência de invulnerabilidade adicional e clashes frontal/diagonal. Os 15 testes de navegador incluem integração com um GLB sintético exportado pelo Animation Studio, configurações, migração JSON, cenários, controles, gamepad simulado e visualização.

## Regras mantidas e decisões do usuário

- X: tackle ofensivo com contato real, inclusive lateral/traseiro/diagonal.
- C: esquiva defensiva; não causa dano. Salta sobre adversário quando atravessa o caminho relevante.
- C → X: janela própria, cobra os dois custos; preserva a altura ao cancelar um salto e por padrão herda **somente a invulnerabilidade ainda restante** de C.
- Clash: cada lutador recebe 30% do ataque do adversário e ambos são lançados.
- Defesa D: bloqueio válido não lança nem desloca o defensor.
- A fórmula antiga de empurrão do GDD **não** foi aplicada ao lançamento: sua integração é assunto da Etapa B, dependente de aprovação. O GDD v0.1 precisa de uma revisão formal sem apagar o histórico.

## Limitações e próxima decisão

1. A aprovação manual da sensação de controle, câmera e combate real pertence ao usuário. Testes automatizados não equivalem a homologação jogável.
2. O GLB de teste é **sintético**, não prova o comportamento dos personagens proprietários reais.
3. `prototypes/game/` continua com regras anteriores; a consolidação pertence à Etapa D, após aprovação das regras do laboratório.
4. O HTML do laboratório mantém a identificação visual "v7" da base original; o esquema de parâmetros exportado é v8. O próximo lançamento pode atualizar essa identificação após aceitação.
5. A execução completa de `npm run verify` continua exigindo investigação de um teste de `placeholders` na infraestrutura headless. Não alteramos código de outro protótipo para mascarar essa falha.
6. Não houve merge na main.
