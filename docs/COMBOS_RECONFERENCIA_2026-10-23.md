# Sistema de combos: reconferência inicial

Base de trabalho: `origin/main` em `052b4fe19b094aadc57972c43b8311d361ee5f8f`, worktree temporário `.worktrees/combos`, branch `codex/combos`.

## Decisões recebidas

- D1: encadeamento livre entre Moves compatíveis com as permissões existentes.
- D2: exibir somente combos confirmados, sem contador de pressão.
- D3: contar inicialmente apenas acertos corpo a corpo.
- D4: defesa, escudo e dano zero não contam.
- D5: juggle, wall loops e scaling ficam para uma etapa futura, sem números presumidos.

## Estado real do código

- `prototypes/combat-lab/src/sim/config.js`: `comboWindow` começa em 0,7 s; janelas de combate ligadas à animação permanecem desligadas por padrão.
- `prototypes/combat-lab/src/sim/combat.js`: `resolveHit` abre `comboLeft` quando o Tackle causa dano positivo ao HP. Já deduplica contato por alvo durante a ação ou por janela ativa.
- `prototypes/combat-lab/src/sim/entity.js`: `chainOpen` usa `comboLeft` para permitir iniciar outra ação. Isso comprova permissão de encadeamento, não segundo acerto.
- `prototypes/combat-lab/src/sim/controller.js`: `movePermission` ainda aplica cooldown, stamina, recuperação, silêncio, stun, alvo e condições de solo/ar. `startMove` consome `comboLeft`.
- `prototypes/combat-lab/src/sim/world.js`: `applyHit` resolve ataques de entidades e efeitos, incluindo contato `melee`; projéteis e áreas persistentes passam pelo mesmo caminho. Esses eventos não podem ser tratados indiscriminadamente como combos.
- `prototypes/combat-lab/src/sim/game.js`: os eventos recebem `id` e `tick` no passo fixo; `save/load` clonam o estado da simulação. Um rastreador futuro deve entrar nesse estado e aceitar saves antigos sem o campo.
- `prototypes/combat-lab/test/moves-anti-air-combo-stamina.test.mjs`: o teste Tackle → Quick Attack verifica `movePermission`, mas não comprova que o segundo golpe acertou o mesmo defensor.

## Caracterização executada

O teste `prototypes/combat-lab/test/combo-contact-characterization.test.mjs` monta uma arena sem obstáculos e com IA desligada. Tackle e Quick Attack atingiram o mesmo defensor em eventos distintos: `id=1`, `tick=9`, `20 HP`; depois `id=3`, `tick=16`, `8 HP`. O Quick Attack começou após o primeiro impacto e depois do hitstop. Entre esses eventos, não houve passo normal em que `canAct` ou `canMove` do defensor retornasse verdadeiro. O teste passa nessa configuração, mas ainda falta um contrato completo para todas as formas de resposta defensiva antes de alimentar um contador global.

## Próximo recorte de implementação

Definir e testar a disponibilidade legal de defesa, esquiva e contra-ataque em todos os estados relevantes. Em seguida, introduzir um contador observacional, sem mudar dano, física, permissões ou IA. Integrar o contador ao save/load e à interface somente após verificar deduplicação, reset por resposta legal e elegibilidade de contato corpo a corpo.

O DOCX de origem está em [ARENAMON_SISTEMA_COMBOS_AUDITORIA_PLANO_PROMPT.docx](ARENAMON_SISTEMA_COMBOS_AUDITORIA_PLANO_PROMPT.docx). O trabalho nesta etapa é reconferência; nenhum combo confirmado novo foi implementado neste relatório.
