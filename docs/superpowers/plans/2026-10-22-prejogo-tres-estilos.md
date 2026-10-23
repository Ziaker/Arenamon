# Pré-jogo com três identidades visuais (A Impacto · B Quadrinhos · C Clássico) — plano de implementação

> **Para executores:** superpowers:executing-plans (execução nativa, decidida pelo diretor ao enviar o prompt autônomo `ARENAMON_PROMPT_CLAUDE_PRE_JOGO_3_ESTILOS.docx`; o diretor mandou «seguir à risca», então não há pausa para revisão do plano). Passos com `- [ ]`.

**Meta:** três telas alternáveis (A/B/C) sobre o menu de Seleção Rápida real (`#menu`), com o MESMO estado (`quickMenu.state`), prévia 3D real, Moves de `listMoves()`, passivas de `passives.js`, e feedback de seleção com three.quarks.

**Arquitetura:** `menu-quick.js` continua sendo a única fonte de estado e ganha uma API de comandos/eventos (`setMove`, `setPassive`, `selectCharacter`, `characters()`, `onChange`); os seletores `<select>` atuais passam a chamar a mesma API. Uma camada de visão (`menu-styles.js`) desenha A/B/C a partir de `menu-styles-model.js` (dados reais, funções puras testáveis em Node) e reparenta os canvases das prévias existentes. O estilo escolhido é só preferência de visão (`localStorage`), padrão = menu atual; nenhum loadout por tema.

**Stack:** three.js 0.186 (prévia existente), three.quarks (`QuarksFx` de `view/quarks/adapter.js` com presets próprios do menu), esbuild (build-lib), Playwright/Edge para o teste de navegador.

**Spec:** `ARENAMON_PROMPT_CLAUDE_PRE_JOGO_3_ESTILOS.docx` (diretor, 22/10/2026).

## Restrições globais (copiadas do prompt)
- Escritor único / worktree em `.worktrees/prejogo` (dentro da pasta oficial); não alterar `prototypes/hud-moves/` (padrão de comparação).
- Moves SÓ de `listMoves()` após `registerStandardMoves()`; nunca lista nominal; sem duplicata no mesmo lutador; passivas via `genericPassives()/exclusivePassives()/validateLoadout()`, máx. 2 distintas.
- Trocar A/B/C não chama `game.reset()`, não inicia partida, não perde seleção; sem números de gameplay fictícios; sem «equipamentos» inventados (auditado: no projeto «equipamento» = os dois espaços de passivas, `PASSIVAS_DECISOES.md` Rodada 5; não existe inventário → interpretação = loadouts).
- Respeitar `prefers-reduced-motion`; feedback por mais de uma pista visual; teclado e ponteiro.
- Sem dependência nova, sem asset de terceiros, sem Moves/balanceamento/HUD de combate novos; nenhum estilo vira oficial.

## Revisão de foco (casos que o prompt implica e nenhuma tarefa cobriria sozinha)
1. Nenhum modelo salvo / modelo faltando → mensagem de estado, sem seleção fictícia (teste T4).
2. WebGL indisponível → prévia some, menu continua funcional (teste T4).
3. Trocar de espécie com passiva exclusiva equipada → invalida e avisa (teste T2).
4. Mesmo Move escolhido em outro slot → o antigo slot esvazia (teste T2).
5. Trocar estilo no meio de uma escolha pendente → nada reseta (teste T4).

## Mapa de arquivos
- Modificar `ui/menu-quick.js` (API + eventos), `ui/menu-preview.js` (expor cena/`resize`/gancho de tick), `template.html` (seletor A/B/C + `#menu-styled`), `main.js` (ligar), `build-lib.mjs` (concatenar `menu-styles.css`), `ui/moves-panel.js` NÃO muda.
- Criar `ui/menu-styles-model.js`, `ui/menu-styles.js`, `ui/menu-fx.js`, `src/menu-styles.css`, `test/prejogo.test.mjs`, `test/prejogo.browser.mjs`, `docs/PREJOGO_3_ESTILOS.md`, `evidence/prejogo/`.

### Tarefa T1 — API de estado e eventos em `menu-quick.js`
**Produz:** `quickMenu.setMove(slot, i, id|null)`, `setPassive(slot, i, id|null)`, `selectCharacter(slot, modelId|null)` (async), `characters(slot) → [{id, name, current}]`, `onChange(fn) → off`, `previews`, `speciesOf(slot)`; `fn({type: 'move'|'passive'|'char'|'init', slot})`.
- [ ] Escrever teste de navegador mínimo (ou de Node com DOM falso) que chama `setMove` duas vezes com o mesmo id em slots diferentes e espera o slot antigo vazio e `game.loadouts` atualizado.
- [ ] Refatorar os `onchange` dos `<select>` para chamar as mesmas funções; emitir evento ao final de cada mudança.
- [ ] Conferir que `applyAll/collect/apply` ficam idênticos (teste existente `moves-ui`/`overhaul` continua verde).

### Tarefa T2 — Modelo de dados `menu-styles-model.js` (puro)
**Produz:** `moveCatalog(moves) → [{id,name,description,cost,cooldown,icon}]` (só campos que EXISTEM no Move efetivo), `passiveCatalog(species) → {exclusive:[…], generic:[…]}` com `{id,nome,categoria,gatilho,efeito,origem:'exclusiva'|'genérica'}`, `iconForMove(id)`, `invalidReasons(passives, species)`.
- [ ] Teste Node (`prejogo.test.mjs`): IDs do catálogo ⊂ `listMoves()` após `registerStandardMoves()`; Move documentado e não registrado não aparece; exclusivas só da espécie; `invalidReasons` reproduz `validateLoadout`.
- [ ] Implementar com `listMoves`, `genericPassives`, `exclusivePassives`, `validateLoadout`.

### Tarefa T3 — Estrutura comum das três telas + preview reparentado
**Produz:** `createMenuStyles({$, quickMenu, ui, keys}) → {setStyle(id|'none'), get style}`; `#menu-styled` com, por lutador: prévia (canvas existente reparentado), personagem (chips), 4 slots de Move, 2 de passiva, candidatos (cartas) e caixa de detalhe real; teclado (setas/Enter/Esc) e foco visível; estados vazio/indisponível/erro com texto.
- [ ] Marcar no teste de navegador: A→B→C→A mantém `quickMenu.collect()` idêntico, não muda `game.tick`/`game.phase`.
- [ ] Implementar a visão sobre `quickMenu` somente por API; `localStorage['arenamon.menuStyle']` guarda só o estilo.

### Tarefa T4 — Fidelidade visual A/B/C (`menu-styles.css`)
- [ ] Portar tokens/recortes/sombras/animações de `hud-a.css`, `hud-b.css`, `hud-c.css` com a matriz de correspondência em `docs/PREJOGO_3_ESTILOS.md` (componente novo → seletor original → alteração justificada).
- [ ] `prefers-reduced-motion` desliga animações; seleção sinalizada por forma + cor + texto.
- [ ] Capturas 1280×720 e 1920×1080 por estilo e comparação lado a lado com `hud{A,B,C}-neutro-720p.png`.

### Tarefa T5 — three.quarks no feedback de seleção (`menu-fx.js`)
**Produz:** `createMenuFx(preview) → {burst(style, kind), setReduced(bool), dispose()}` com três presets (A faíscas vermelho/amarelo angulares; B estrelas ciano/amarelo/magenta; C partículas suaves verde-água/azul) via `QuarksFx` na cena da prévia.
- [ ] Teste de navegador: trocar personagem/Move dispara `burst` (contagem em `fx.stats.emitted`); com movimento reduzido o fator cai; sem erros de console.

### Tarefa T6 — Integração, testes, build, portal, entrega
- [ ] `main.js` liga `createMenuStyles` e atualiza no `attachWorkspace/refresh`; botão Iniciar usa `quickMenu.applyAll()` sem mudança.
- [ ] Teste: iniciar combate com a seleção visível → `game.fighters[i].loadout` e passivas iguais; voltar ao menu mantém a seleção.
- [ ] Rodar `npm run build:combat-lab`, `verify:workspace`, tipos, suíte relevante; link no portal; commit/push; comparar remoto.
