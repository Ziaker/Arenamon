# Auditoria de limpeza de código e 10 alternativas para facilitar Moves e mecânicas

**Data:** 23/10/2026. **Escopo:** somente leitura; nada foi apagado ou movido. **Base:** checkout oficial, branch `codex/elemental-quarks-visual` (`5b4343a` + alterações locais). Métodos: grafo de imports a partir de `src/main.js`, contagem de usos de cada `export`, inventário de arquivos rastreados e de testes. Os números abaixo foram medidos, não estimados.

## 1. Retrato do código

| Área | Tamanho |
|---|---|
| `combat-lab/src` | 205 arquivos `.js`; sim 14,4 mil linhas, view 7,2 mil, ui 6,7 mil, main 1,1 mil |
| `combat-lab/test` | 166 arquivos, 20,6 mil linhas (119 `*.test.mjs`) |
| Maiores arquivos | `world-view.js` 1231, `scenarios-map.js` 1156, `main.js` 1143, `ai-eval.js` 1110, `controller.js` 1108, `map.js` 1080, `cinematic-camera.js` 1077 |
| Outros protótipos | `croagunk` 86 mil e `importer` 44 mil linhas (quase tudo gerado ou de terceiros), `studio` 27 mil |

## 2. Achados para limpeza (ordem de segurança)

### A. Pode sair sem mudar o jogo (alta confiança)
1. **`src/view/vfx/effects/passives.js` (507 linhas):** nenhum arquivo importa. Só define `PassiveFx`. Código morto confirmado.
2. **37 exports que ninguém usa** (citados só na própria declaração): `evalLoadoutMatrix`, `evalStyleMatrix`, `markerMove`, `stepsToMs/msToSteps/secondsToSteps/stepsToSeconds`, `isGraphicsPath`, `phasedSpeed`, `unregisterEffect`, `listEffects`, `compareSequence`, `headingDir`, `MOVE_SCHEMA_VERSION`, `unregisterMove`, `PASSIVE_STATUS`, `SCENARIO_KEYS`, `removeStatus`, `cleanse`, `WINDOW_KEYS`, `QUALITY_LEVELS`, `BUILD_BLOCK/PERFECT/LANDING/DODGE/SPRINT/EXHAUST/REGEN`, `buildLanding`, `buildDodge`, `buildSprint`, `buildReversal`, `buildBrake`, `buildSkid`, `buildExhaust`, `buildRegen`. Parte pode ser API deliberada (`unregisterMove`); o resto é resto de refatoração.
3. **Sondas soltas:** `test/_probe-border.mjs`, `_probe-border2.mjs`, `_probe-border3.mjs` (não rastreadas, nome de rascunho).
4. **`prototypes/sand-stone-lab.zip` e a pasta `sand-stone-lab/`:** não rastreados; o `AGENTS.md` proíbe zips soltos.
5. **`chars/mosh/Cogumelo_work.blend`, `.blend1` e `.prep.json`:** arquivos de trabalho não rastreados na pasta oficial.
6. **`dist/arenamon-combate-laboratorio.v1.15.7-backup.html`:** backup de uma versão antiga ao lado do jogo atual.
7. **41 arquivos `.pyc` rastreados** em `scripts/blender-vision/__pycache__`: mudam a cada execução e aparecem sempre como alterados. Devem entrar no `.gitignore` e sair do índice.
8. **208 imagens de evidência em `prototypes/combat-lab/evidence` rastreadas:** os testes de navegador as regravam, e hoje 5 delas aparecem alteradas sem mudança real. Gravar em pasta ignorada e promover só as que importam.

### B. Precisa de decisão (média confiança)
9. **Código usado só por testes ou scripts:** `physics-poc/*` (6 arquivos, ~440 linhas), `nav-scenarios.js`, `combat-windows-report.js` (318 linhas, o teste `combat-windows` já falha nesta base), e `clearMoves`, `clearEffects`, `factoryDefaults`, `contractCheck*`, `NEW_MOVE_IDS`. Mover para uma pasta `tools/` ou `test-support/` deixa claro que não é jogo.
10. **Protótipo legado `prototypes/game` (1,8 mil linhas):** descontinuado pelo `AGENTS.md`, mas ainda no `typecheck` e em 5 pontos do `package.json`. Cada `npm test` paga por ele.
11. **Helpers repetidos:** `escape` (7 arquivos), `hex` (4), `clamp` (5), `$` (4), mais um `ESC` próprio. Um módulo `ui/util.js` elimina isso.
12. **Testes quebrados na base:** `combat-windows`, `map`, `vfx` falham também sem mudanças recentes; `ai-eval` passa de 2 minutos; `moves-ui.browser.mjs` procura a equipagem onde ela não está mais. Teste vermelho antigo ensina a ignorar teste vermelho.
13. **Documentação:** 67 arquivos em `docs/`, vários de rodada (`RODADA_22_10_TARDE.md`, `MOVES_DECISOES_RODADAS.md`) que repetem o que já está no código. 266 refs de branch, 22 pastas em `.worktrees` (18 registradas), 3 stashes.

### C. Estrutural (maior ganho, maior risco)
14. **Um Move vive em muitos lugares.** Contando só o `second-wind`: `moves/second-wind.js`, `moves/new-moves.js`, `config.js`, `ai-new-moves.js`, `moves-panel.js`, `moves-vfx-panel.js`, `menu-styles-model.js`, `status-aura.js`, `view.js` e 8 arquivos de teste, mais 4 documentos. Quem cria um Move precisa saber de ~10 arquivos.
15. **Dados dentro de código de interface:** `moves-panel.js` tem uma tabela de ~375 linhas (`PARAMS`) com rótulo, dica e limites, separada dos valores em `config.js`; `MOVE_INFO` e `SHARED` repetem o padrão em outros arquivos.
16. **Arquivos grandes demais:** `main.js` (1143) concentra a fiação de todos os painéis; `controller.js` (1108) mistura tackle, esquiva, defesa, saltos e Moves.
17. **Tipos:** 82 de 205 arquivos têm `// @ts-check`; o resto não é checado.

## 3. Ordem sugerida de limpeza
1. Itens 1, 3, 4, 6, 7 (sem risco, só remover/ignorar). 2. Item 2 (rodar a bateria depois). 3. Itens 5 e 8 (decidir com você o que vira evidência). 4. Itens 9 a 13. 5. Itens 14 a 17 só junto das alternativas abaixo.

## 4. Dez alternativas para criar e modificar Moves/mecânicas com facilidade, sem depender de um HTML por coisa

Todas mantêm o requisito do projeto: abrir com um clique em `JOGAR_ARENAMON.html`, sem comando.

1. **Ficha única por Move (`moves/<id>.move.js`).** Um arquivo declara tudo: regras, custo, recarga, parâmetros (valor padrão, mínimo, máximo, unidade, dica), texto de ajuda, VFX e ligação com a IA. Hoje isso está em 10 lugares. O painel de Moves e a exportação leem a ficha; criar um Move vira copiar um arquivo.
2. **Painel gerado a partir dos parâmetros.** Apagar a tabela `PARAMS` de `moves-panel.js` e desenhar sliders a partir da ficha (item 1). Um parâmetro novo aparece sozinho na interface, com desfazer e exportação.
3. **Registro automático.** Trocar `new-moves.js` por um registro que descobre as fichas na hora do build (`build.mjs` já empacota tudo em um HTML). Soltar um arquivo na pasta basta; ninguém edita a lista nem o `standard.js`.
4. **Moves em dados + pequenos ganchos.** Descrever Moves simples (projétil, dash, buff, área) por dados (`kind: 'projectile', speed, damage, pl`) e deixar código só para os incomuns (Bounce, Bullet Punch). Os Moves elementais e o Swift caberiam quase inteiros em dados.
5. **Gerador de Move (`npm run novo-move`, ou um botão no laboratório).** Cria a ficha, um teste de fumaça e a página de documentação a partir de um modelo. Para quem não roda comandos: um botão “Novo Move” no painel que baixa a ficha pronta.
6. **Modo ao vivo (recarregar sem reiniciar).** Um seletor “Fichas” na interface que carrega um arquivo `.move.js` editado, sem recompilar o laboratório inteiro. Editar o arquivo e apertar um botão testa na hora.
7. **Pacotes de conteúdo em JSON importável.** Valores, VFX e fichas de dados em um `.json` que o laboratório importa (já existe importação em Ajustes). Compartilhar ou versionar um Move vira trocar um arquivo, e dá para ter variantes (A/B) lado a lado.
8. **Uma página só, com vistas internas.** Em vez de um HTML por protótipo, manter `JOGAR_ARENAMON.html` e abrir Estúdio, Importador, Quarks e relatórios como modos dentro do mesmo arquivo (hoje são 8 HTMLs em `combat-lab/dist` e outros 4 fora dele). Continua um clique, com menos duplicação de build e de código de interface.
9. **Dividir o motor em módulos pequenos por mecânica.** Quebrar `controller.js` e `main.js` por assunto (tackle, esquiva, defesa, salto, Moves, painéis), cada módulo com um contrato curto (entrada, saída, eventos). Mexer em uma mecânica deixa de arriscar as outras, e o teste fica ao lado do módulo.
10. **Contrato de eventos + testes por ficha.** Toda mecânica fala por eventos tipados (`impact`, `perfectDodge`, `moveFailed`…, como já existem) e cada ficha traz um cenário de teste declarativo (“equipar, apertar, esperar este evento”). O mesmo cenário alimenta o teste automático, o botão **▶ Disparar** e a documentação, e o `@ts-check` passa a cobrir tudo o que for ficha.

### Combinações que valem a pena
- **Menor esforço, maior efeito:** 1 + 2 + 3 (ficha única, painel gerado, registro automático). Cortam o número de arquivos por Move de ~10 para 1 sem mudar o jogo.
- **Para quem não programa:** 5 + 6 + 7.
- **Para sustentar o crescimento:** 9 + 10.

## 5. O que não foi verificado
- Não executei a limpeza nem a bateria completa; os testes citados como falhando foram rodados isoladamente.
- A análise de exports é textual: um nome usado só por reflexão ou por texto em HTML pode aparecer como “sem uso”. Confirmar item a item antes de apagar.
- Não medi o tempo do `npm test` completo nem a cobertura.
- Não auditei `croagunk`, `importer`, `studio` nem `scripts/` em profundidade.

## 6. Segunda passada (auditoria do trabalho de 23/10) e melhorias entregues

**Problemas encontrados e corrigidos**
- **Regressão real:** `world.js` deixou de limitar os pulsos de uma área por `pulses` (a trava `Math.min(a.pulses, …)` foi removida no commit `3fc12ae`); um Move com `pulses: 3` dava 4. Restaurada a trava; o Fire Spin, que calcula `pulses` pela vida, segue igual.
- **Testes desatualizados (sem bug no jogo):** `moves-fire-spin` e `moves-seed-bomb` (agora o marcador pode ficar sobre o adversário: `allowOccupied = 1`; o caso inválido passa a ser testado com a opção desligada), `moves.test` (mensagem passou a mostrar a contagem), `map.test` (salto de 2,4 m e gravidade de lançamento da calibração v8; a cena da plataforma colocava o azul no caminho do voo), `moves-ui` e `moves-elementais` (layout novo: equipagem em Ações, tempo de seguimento por Move). Tudo verde.
- **Sem interface:** `vfx.elemental.shotFollowTime` global ficou só como valor de reserva; a edição é por Move (`visual.<move>.shotFollowTime`).

**Melhoria entregue (v1.27.0): ficha única por Move.** Ver `docs/COMO_CRIAR_UM_MOVE.md`. Harden e Second Wind migrados como piloto. Cobre as alternativas 1, 2, 3 e 5 do relatório (ficha, painel gerado, registro automático e gerador `npm run novo-move`).

**Achado da matriz de cenários (#10):** o motor não tem trava contra velocidade infinita. Um efeito de Move que escreva `velocity.x = Infinity` faz o passo de simulação não terminar (o teste travou). Não corrigi; é uma salvaguarda a decidir (por exemplo, limitar a velocidade ao fim de `stepPhysics`). Valores NaN em HP, por outro lado, são pegos pela matriz com o tick exato.
