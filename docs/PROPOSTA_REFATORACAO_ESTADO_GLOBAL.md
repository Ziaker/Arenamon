# Proposta (NÃO autorizada): estado global `C`, `REGISTRY` de Moves e ciclo de importação

> **Status:** proposta para decisão do diretor. **Nada aqui foi implementado.** Não refatorar sem aprovação específica.
> **Base:** `main` (após o PR #1), `prototypes/combat-lab/src/sim/`. Auditoria por leitura de código; **nenhuma medição de desempenho foi feita**.

## Contrato obrigatório, independente desta refatoração

Rodada 28.4 dos Moves (ver `MOVES_DECISOES_RODADAS.md`): alterações de sliders valem para **usos posteriores**; entidades já criadas mantêm os parâmetros capturados na criação. A futura implementação dos Moves deve **capturar explicitamente**, ao criar cada execução/entidade, os parâmetros que a regem — mesmo que `C` continue global. Tipagem sozinha não garante isso.

## Problema 1 — Configuração viva `C` global e mutável

- **Concreto:** `config.js` exporta `C = defaults()`. 18 módulos de `sim/` (`controller`, `world`, `game`, `physics`, `combat`, `entity`, `moves`, `tactics`…) leem `C.*` no momento do uso; a interface e `main.js` alteram `C` durante a partida (`resetConfig`, ajustador, presets, A×B).
- **Impacto esperado:** uma entidade de longa vida (barreira de 8 s, projétil em voo) que leia `C` a cada passo muda de comportamento quando um slider se move — o que contraria M28.4. Em `world.js`, `spawn` copia o *template* da entidade (velocidade, raio, vida, `hit`…) para dentro dela — esses campos já ficam congelados na criação —, mas o passo (`stepWorld`) e `applyHit` leem `C.*` a cada execução (`C.test.contactStep`, `C.test.arenaHalf`, `C.test.halfExtent`, `C.rules.*`, `C.extras.combat/toggles`). Logo, regras de física e de acerto de uma entidade já em voo mudam se o slider correspondente mudar; os parâmetros próprios do Move, não. Quais campos precisam de captura é uma decisão a tomar junto com a implementação dos Moves (não verificado por teste).
- **Risco para física/compatibilidade:** alto se mal feito: o passo é determinístico e há testes de paridade (v6), replay e propriedades. Trocar `C` por um parâmetro explícito toca quase todos os módulos.
- **Opções (da menos para a mais invasiva):**
  1. *Só convenção:* as entidades copiam em `spawn` os campos que precisam (`snapshot` de parâmetros) e nunca leem `C` depois. Sem mudar a estrutura de `C`.
  2. *Instantâneo por partida:* `Game` recebe uma cópia congelada de `C` ao iniciar/reiniciar; sliders valem só para a próxima partida (muda a experiência do ajustador — exige decisão de produto).
  3. *Injeção:* passar `cfg` explícito em todas as funções (refatoração ampla).
- **Benefício mensurável:** teste que altera sliders no meio de uma execução e verifica que entidades existentes mantêm seus valores (hoje não existe); redução do número de módulos que importam `config.js` diretamente.
- **Testes necessários:** novo teste de "slider mid-flight" para cada tipo de entidade; `core`, `sim`, `properties`, `moves`, `calibration`, `parity` (quando houver o v6) idênticos antes/depois; comparação byte a byte do HTML gerado quando só houver mudança de tipos.

## Problema 2 — `REGISTRY` de Moves global

- **Concreto:** `moves.js` guarda `const REGISTRY = new Map()` no módulo. Duas partidas no mesmo processo compartilham o registro; `Game.save()` guarda `loadouts` (ids), não as definições; `load` num processo com registro diferente falha ou muda de comportamento.
- **Impacto esperado:** moderado hoje (registro vazio); alto quando houver Moves reais, cenários e replays que dependam de versões das definições.
- **Risco:** baixo a médio — a API (`registerMove`, `getMove`…) é pequena e usada em poucos pontos.
- **Opção:** registro por instância de `Game` (ou módulo que exporte uma fábrica) e `save` incluindo as definições usadas (ou um hash/versão delas).
- **Benefício mensurável:** replay reproduzível com definições embutidas; testes isolados sem `clearMoves()`.
- **Testes necessários:** `moves.test.mjs` (registro vazio, validação), save/load com definições, dois `Game` simultâneos com registros diferentes.

## Problema 3 — Ciclo de importação `entity → moves → world → entity`

- **Concreto:** `entity.js` importa `moves.js`; `moves.js` importa `world.js`; `world.js` importa `entity.js`. Funciona porque os usos ficam dentro de funções (ESM resolve em tempo de execução).
- **Impacto esperado:** baixo hoje; atrapalha tipagem estrita, ferramentas de grafo e qualquer uso em tempo de carga.
- **Risco:** baixo se feito por extração (mover o que `entity.js` precisa de `moves.js` para um módulo folha); a lógica não muda.
- **Benefício mensurável:** grafo de imports acíclico verificável por script (`madge`-like simples).
- **Testes necessários:** suíte `test:combat-lab:unit` completa e comparação do HTML gerado.

## Ordem sugerida (se aprovada)

1. Teste "slider mid-flight" (documenta o comportamento atual sem mudar código). 2. Ciclo (extração simples). 3. Registro por instância. 4. Decisão de produto sobre o escopo de `C`. Cada passo em PR separado, com os testes acima e HTML idêntico quando aplicável.

## Perguntas ao diretor

- Sliders devem continuar valendo ao vivo para o jogador/IA (comportamento atual) e só **entidades** congelarem parâmetros, ou toda a partida deve usar um instantâneo?
- Aprova começar pelo teste "slider mid-flight" sem alterar código?
