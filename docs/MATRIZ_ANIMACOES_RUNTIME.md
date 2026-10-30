# Matriz de animações no runtime

Gerada por `node scripts/gen-matriz-animacoes.mjs` (gameplay real: `Game` + `Character` + `AnimationMixer`, Editor fechado). A prova de cada ação vem do que o Character **tocou** durante 106 cenários de partida, nunca de chamar `stateKey()` direto nem de associar clipe genérico. Teste: `prototypes/combat-lab/test/animation-runtime.test.mjs`.

Critério de aprovação **por execução**: cada exercício de um clipe é segmentado e classificado — `CONCLUIDA_NATURALMENTE` (fim efetivo do clipe), `INTERROMPIDA_POR_NOVA_ACAO`/`INTERROMPIDA_POR_REACAO` (troca autorizada), `CORTADA_INDEVIDAMENTE` (corte para locomoção/neutral/idle sem razão autorizada com < 95% do clipe), `FALLBACK` (clipe fora da lista configurada), `SEM_CLIPE` (recurso ausente) e `NAO_ALCANCADA` (nunca tocou). Aprovação exige classificação positiva + duração mínima (≥ 8 quadros ou ≥ 25% do clipe, o que for menor) + peso máximo ≥ 0,3: um clipe de 1–4 quadros ou de peso 0,05 **nunca** é aprovado. Para ações de laço (idle, walk, sprint, block, cargas), `CONCLUIDA_NATURALMENTE` significa «mantida pelo tempo mínimo de prova».

- **Sintético** (um clipe distinto por ação): 90 aprovadas · 0 não aprovadas · 0 reserva · 0 sem clipe configurado.
  CONCLUIDA_NATURALMENTE 54 · INTERROMPIDA_POR_NOVA_ACAO 24 · INTERROMPIDA_POR_REACAO 12 · CORTADA_INDEVIDAMENTE 0 · FALLBACK 0 · SEM_CLIPE 0 · NAO_ALCANCADA 0
- **wookada.glb** (importado): 40 aprovadas · 0 não aprovadas · 2 reserva · 48 sem clipe configurado.
  CONCLUIDA_NATURALMENTE 33 · INTERROMPIDA_POR_NOVA_ACAO 5 · INTERROMPIDA_POR_REACAO 2 · CORTADA_INDEVIDAMENTE 0 · FALLBACK 0 · SEM_CLIPE 48 · NAO_ALCANCADA 0
- **Cogumelo.glb** (importado): 33 aprovadas · 0 não aprovadas · 1 reserva · 56 sem clipe configurado.
  CONCLUIDA_NATURALMENTE 20 · INTERROMPIDA_POR_NOVA_ACAO 11 · INTERROMPIDA_POR_REACAO 2 · CORTADA_INDEVIDAMENTE 0 · FALLBACK 0 · SEM_CLIPE 56 · NAO_ALCANCADA 0
- «reserva»: ação que só toca quando o clipe primário do estado não está configurado (hit, fall, downed, move_1, move_2, move_3, move_4); provada no sintético por cenários em que o primário é removido. «sem clipe configurado»: o modelo não tem clipe para a ação (o jogo usa a cadeia de reserva documentada em `STATE_ACTIONS`).

## Sintético (todas as ações)
| personagem | ação | gatilho real | clipe configurado | clipe executado | frames | parâmetros aplicados | fallback | classificação | resultado |
|---|---|---|---|---|---|---|---|---|---|
| sintético | `idle` | locomoção: parado, girar, andar nas 4 direções | act:idle | act:idle | 60208 | tempo 0.00–0.50 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (265× CONCLUIDA_NATURALMENTE) |
| sintético | `turn` | reação: acerto contra a parede (wall-splat e prensado) | act:turn | act:turn | 62 | tempo 0.01–0.38 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (3× CONCLUIDA_NATURALMENTE) |
| sintético | `walk` | locomoção: parado, girar, andar nas 4 direções | act:walk | act:walk | 949 | tempo 0.01–0.76 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (14× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `walk_back` | lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | act:walk_back | act:walk_back | 48 | tempo 0.01–0.70 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (1× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `walk_left` | lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | act:walk_left | act:walk_left | 48 | tempo 0.01–0.70 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (1× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `walk_right` | lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | act:walk_right | act:walk_right | 48 | tempo 0.01–0.70 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (1× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `sprint` | locomoção: sprint nas 4 direções e freios | act:sprint | act:sprint | 146 | tempo 0.01–0.66 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (2× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `sprint_back` | lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | act:sprint_back | act:sprint_back | 25 | tempo 0.01–0.36 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (1× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `sprint_left` | lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | act:sprint_left | act:sprint_left | 22 | tempo 0.01–0.32 s · peso 0.92 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (1× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `sprint_right` | lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | act:sprint_right | act:sprint_right | 19 | tempo 0.01–0.28 s · peso 0.79 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (1× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `walk_stop` | locomoção: parado, girar, andar nas 4 direções | act:walk_stop | act:walk_stop | 730 | tempo 0.00–0.89 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (6× CONCLUIDA_NATURALMENTE) |
| sintético | `sprint_stop` | locomoção: sprint nas 4 direções e freios | act:sprint_stop | act:sprint_stop | 370 | tempo 0.00–1.01 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (2× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `block_start` | defesa: entra, segura, sai | act:block_start | act:block_start | 313 | tempo 0.00–1.14 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (6× CONCLUIDA_NATURALMENTE) |
| sintético | `block` | defesa: entra, segura, sai | act:block | act:block | 441 | tempo 0.00–1.27 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (4× CONCLUIDA_NATURALMENTE) |
| sintético | `block_end` | defesa: entra, segura, sai | act:block_end | act:block_end | 71 | tempo 0.00–0.50 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| sintético | `guard_impact` | defesa: bloqueia um tackle (guard stun no defensor, recuo no atacante) | act:guard_impact | act:guard_impact | 120 | tempo 0.01–0.62 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| sintético | `perfect_guard` | defesa perfeita: toque de D no tempo certo | act:perfect_guard | act:perfect_guard | 53 | tempo 0.00–0.76 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `blocked` | espelho: o azul ataca um defensor (recuo do atacante, guard stun do rival) | act:blocked | act:blocked | 223 | tempo 0.00–0.89 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (3× CONCLUIDA_NATURALMENTE) |
| sintético | `hit` | reserva: sem hit_light → «hit» | act:hit | act:hit | 70 | tempo 0.00–1.01 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `hit_light` | reação: contato sem lançamento (enableLaunch desligado) → hitstun | act:hit_light | act:hit_light | 79 | tempo 0.00–1.14 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `hit_heavy` | reação: Guard Break quebra a defesa (atordoamento) | act:hit_heavy | act:hit_heavy | 245 | tempo 0.00–1.27 s · peso 1.00 | não | INTERROMPIDA_POR_REACAO | aprovada por execução (3× INTERROMPIDA_POR_REACAO) |
| sintético | `push` | reação: clash X×X (atordoamento dos dois) | act:push | act:push | 1476 | tempo 0.00–0.50 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (4× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `push_side` | Sand Wave pelo lado (empurrão lateral) | act:push_side | act:push_side | 145 | tempo 0.01–0.63 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (1× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `hit_up` | reação: tackle do rival acerta o lutador livre (hitstun, empurrão, recuperação) | act:hit_up | act:hit_up | 280 | tempo 0.01–0.30 s · peso 1.00 | não | INTERROMPIDA_POR_REACAO | aprovada por execução (19× INTERROMPIDA_POR_REACAO) |
| sintético | `hit_crush` | Sand Wave prende o alvo na parede (prensado) | act:hit_crush | act:hit_crush | 36 | tempo 0.00–0.51 s · peso 1.00 | não | INTERROMPIDA_POR_REACAO | aprovada por execução (1× INTERROMPIDA_POR_REACAO) |
| sintético | `knockback` | reação: tackle do rival acerta o lutador livre (hitstun, empurrão, recuperação) | act:knockback | act:knockback | 604 | tempo 0.13–1.00 s · peso 1.00 | não | INTERROMPIDA_POR_REACAO | aprovada por execução (20× INTERROMPIDA_POR_REACAO) |
| sintético | `fall` | reserva: sem knockback/hit_up → «fall» e «hit» | act:fall | act:fall | 45 | tempo 0.03–1.12 s · peso 1.00 | não | INTERROMPIDA_POR_REACAO | aprovada por execução (1× INTERROMPIDA_POR_REACAO) |
| sintético | `recover` | exaustão: o custo zera a stamina (recover) | act:recover | act:recover | 38 | tempo 0.00–1.28 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| sintético | `downed` | reserva: sem death → «downed» | act:downed | act:downed | 255 | tempo 0.00–0.50 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `death` | derrota: o último golpe derruba o lutador (KO) | act:death | act:death | 255 | tempo 0.00–0.63 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `recovery_tackle` | recuperação das ações (sliders de recuperação do tackle e da esquiva > 0) | act:recovery_tackle | act:recovery_tackle | 53 | tempo 0.00–0.76 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `recovery_dodge` | recuperação das ações (sliders de recuperação do tackle e da esquiva > 0) | act:recovery_dodge | act:recovery_dodge | 62 | tempo 0.00–0.89 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `recovery_move` | recuperação de Move: depois de soltar a carga (sem clipe de soltura), parado | act:recovery_move | act:recovery_move | 70 | tempo 0.00–1.01 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `tackle` | tackle X e recuperação | act:tackle | act:tackle | 3086 | tempo 0.01–1.15 s · peso 1.00 | não | INTERROMPIDA_POR_REACAO | aprovada por execução (24× INTERROMPIDA_POR_REACAO) |
| sintético | `tackle_charge` | tackle carregado PL2/PL3 | act:tackle_charge | act:tackle_charge | 964 | tempo 0.00–1.27 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (11× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `tackle_pl2` | tackle carregado 75 passos (PL2/PL3) | act:tackle_pl2 | act:tackle_pl2 | 414 | tempo 0.00–0.50 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (3× CONCLUIDA_NATURALMENTE) |
| sintético | `tackle_pl3` | tackle carregado PL2/PL3 | act:tackle_pl3 | act:tackle_pl3 | 414 | tempo 0.00–0.63 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (3× CONCLUIDA_NATURALMENTE) |
| sintético | `brake` | finta (brake): tackle cancelado pela esquiva | act:brake | act:brake | 126 | tempo 0.01–0.76 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| sintético | `meteor_prep` | meteor slam: C → X a partir do vault | act:meteor_prep | act:meteor_prep | 59 | tempo 0.00–0.85 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (1× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `meteor_dive` | meteor slam: C → X a partir do vault | act:meteor_dive | act:meteor_dive | 14 | tempo 0.00–0.19 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (1× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `meteor_ground` | meteor slam: C → X a partir do vault | act:meteor_ground | act:meteor_ground | 55 | tempo 0.00–0.79 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (1× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `dodge_forward` | locomoção: sprint nas 4 direções e freios | act:dodge_forward | act:dodge_forward | 318 | tempo 0.02–1.27 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (4× CONCLUIDA_NATURALMENTE) |
| sintético | `dodge_back` | locomoção: sprint nas 4 direções e freios | act:dodge_back | act:dodge_back | 507 | tempo 0.01–0.49 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (7× CONCLUIDA_NATURALMENTE) |
| sintético | `dodge_left` | locomoção: sprint nas 4 direções e freios | act:dodge_left | act:dodge_left | 214 | tempo 0.01–0.62 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (3× CONCLUIDA_NATURALMENTE) |
| sintético | `dodge_right` | lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | act:dodge_right | act:dodge_right | 71 | tempo 0.01–0.76 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `jump` | esquiva C nas 4 direções + vault sobre o rival | act:jump | act:jump | 68 | tempo 0.02–0.89 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| sintético | `jump_start` | salto normal: fases e pouso | act:jump_start | act:jump_start | 105 | tempo 0.00–0.20 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (7× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `jump_rise` | salto normal: fases e pouso | act:jump_rise | act:jump_rise | 192 | tempo 0.01–0.48 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (7× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `jump_apex` | salto normal: fases e pouso | act:jump_apex | act:jump_apex | 311 | tempo 0.00–1.27 s · peso 1.00 | não | INTERROMPIDA_POR_REACAO | aprovada por execução (7× INTERROMPIDA_POR_REACAO) |
| sintético | `jump_fall` | footstool: pisar no rival (atordoamento do pisado) | act:jump_fall | act:jump_fall | 58 | tempo 0.01–0.42 s · peso 1.00 | não | INTERROMPIDA_POR_REACAO | aprovada por execução (2× INTERROMPIDA_POR_REACAO) |
| sintético | `land` | salto normal: fases e pouso | act:land | act:land | 1419 | tempo 0.00–0.63 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (29× CONCLUIDA_NATURALMENTE) |
| sintético | `wall_splat` | reação: acerto contra a parede (wall-splat e prensado) | act:wall_splat | act:wall_splat | 85 | tempo 0.01–0.76 s · peso 1.00 | não | INTERROMPIDA_POR_REACAO | aprovada por execução (1× INTERROMPIDA_POR_REACAO) |
| sintético | `ledge_grab` | borda: agarrar, ficar pendurado, tentar subir bloqueado, subir e soltar | act:ledge_grab | act:ledge_grab | 33 | tempo 0.00–0.15 s · peso 0.44 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (3× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `ledge_hang` | borda: agarrar, ficar pendurado, tentar subir bloqueado, subir e soltar | act:ledge_hang | act:ledge_hang | 215 | tempo 0.00–1.01 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (2× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `ledge_climb` | borda: agarrar, ficar pendurado, tentar subir bloqueado, subir e soltar | act:ledge_climb | act:ledge_climb | 54 | tempo 0.00–1.13 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `ledge_drop` | borda: agarrar, ficar pendurado, tentar subir bloqueado, subir e soltar | act:ledge_drop | act:ledge_drop | 38 | tempo 0.00–0.54 s · peso 1.00 | não | INTERROMPIDA_POR_REACAO | aprovada por execução (1× INTERROMPIDA_POR_REACAO) |
| sintético | `ledge_blocked` | borda bloqueada: o topo está ocupado pelo rival | act:ledge_blocked | act:ledge_blocked | 35 | tempo 0.00–0.50 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `move_1` | reserva: sem a identidade do Move → clipe do slot (move_1) | act:move_1 | act:move_1 | 44 | tempo 0.00–0.63 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `move_2` | reserva: Move no slot 2 sem identidade → clipe do slot (move_2) | act:move_2 | act:move_2 | 53 | tempo 0.00–0.76 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `move_3` | reserva: Move no slot 3 sem identidade → clipe do slot (move_3) | act:move_3 | act:move_3 | 62 | tempo 0.00–0.89 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `move_4` | reserva: Move no slot 4 sem identidade → clipe do slot (move_4) | act:move_4 | act:move_4 | 70 | tempo 0.00–1.01 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `charge_reflect` | move reflect: uso real (toque, carga e soltura, confirmação de mira) | act:charge_reflect | act:charge_reflect | 1327 | tempo 0.00–1.14 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (7× CONCLUIDA_NATURALMENTE) |
| sintético | `release_reflect` | move reflect: carga segurada 160 passos e solta | act:release_reflect | act:release_reflect | 264 | tempo 0.00–1.27 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (3× CONCLUIDA_NATURALMENTE) |
| sintético | `charge_psyshock` | move psyshock: uso real (toque, carga e soltura, confirmação de mira) | act:charge_psyshock | act:charge_psyshock | 925 | tempo 0.00–0.50 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (5× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `release_psyshock` | move psyshock: uso real (toque, carga e soltura, confirmação de mira) | act:release_psyshock | act:release_psyshock | 176 | tempo 0.00–0.63 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (4× CONCLUIDA_NATURALMENTE) |
| sintético | `move_reflect` | move reflect: sem release_reflect → identidade move_reflect na soltura | act:move_reflect | act:move_reflect | 53 | tempo 0.00–0.76 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `move_psyshock` | move psyshock: sem release_psyshock → identidade move_psyshock na soltura | act:move_psyshock | act:move_psyshock | 62 | tempo 0.00–0.89 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `move_harden` | move harden: uso real (toque, carga e soltura, confirmação de mira) | act:move_harden | act:move_harden | 140 | tempo 0.00–1.01 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| sintético | `move_second-wind` | move second-wind: uso real (toque, carga e soltura, confirmação de mira) | act:move_second-wind | act:move_second-wind | 158 | tempo 0.00–1.14 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| sintético | `move_swift` | recuperação de ações (tackle, esquiva e Move) com clipes próprios | act:move_swift | act:move_swift | 264 | tempo 0.00–1.27 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (3× CONCLUIDA_NATURALMENTE) |
| sintético | `move_lunge` | move lunge: uso real (toque, carga e soltura, confirmação de mira) | act:move_lunge | act:move_lunge | 175 | tempo 0.00–0.49 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| sintético | `move_guard-break` | move guard-break: sem release_guard-break → identidade move_guard-break na soltura | act:move_guard-break | act:move_guard-break | 100 | tempo 0.00–0.63 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `move_bounce` | move bounce: sem release_bounce → identidade move_bounce na soltura | act:move_bounce | act:move_bounce | 152 | tempo 0.00–0.76 s · peso 1.00 | não | INTERROMPIDA_POR_REACAO | aprovada por execução (1× INTERROMPIDA_POR_REACAO) |
| sintético | `move_spikes` | move spikes: uso sem lock-on (mira livre), rival longe | act:move_spikes | act:move_spikes | 62 | tempo 0.00–0.89 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `move_sand-wave` | move sand-wave: uso real (toque, carga e soltura, confirmação de mira) | act:move_sand-wave | act:move_sand-wave | 350 | tempo 0.00–1.01 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (5× CONCLUIDA_NATURALMENTE) |
| sintético | `move_bullet-punch` | move bullet-punch: uso real (toque, carga e soltura, confirmação de mira) | act:move_bullet-punch | act:move_bullet-punch | 177 | tempo 0.00–1.15 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `move_emerging-stone` | move emerging-stone: uso real (toque, carga e soltura, confirmação de mira) | act:move_emerging-stone | act:move_emerging-stone | 176 | tempo 0.00–1.27 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| sintético | `move_feint` | move feint: uso real (toque, carga e soltura, confirmação de mira) | act:move_feint | act:move_feint | 70 | tempo 0.00–0.50 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| sintético | `move_riposte` | contra-ataque: Riposte (atordoamento do atacante) | act:move_riposte | act:move_riposte | 267 | tempo 0.00–0.63 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (4× CONCLUIDA_NATURALMENTE) |
| sintético | `move_quick-attack` | move quick-attack: uso real (toque, carga e soltura, confirmação de mira) | act:move_quick-attack | act:move_quick-attack | 69 | tempo 0.01–0.75 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `move_water-pulse` | move water-pulse: sem release_water-pulse → identidade move_water-pulse na soltura | act:move_water-pulse | act:move_water-pulse | 62 | tempo 0.00–0.89 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| sintético | `move_fire-spin` | move fire-spin: uso real (toque, carga e soltura, confirmação de mira) | act:move_fire-spin | act:move_fire-spin | 143 | tempo 0.00–1.02 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| sintético | `move_air-slash` | move air-slash: uso real (toque, carga e soltura, confirmação de mira) | act:move_air-slash | act:move_air-slash | 158 | tempo 0.00–1.14 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| sintético | `move_seed-bomb` | move seed-bomb: uso real (toque, carga e soltura, confirmação de mira) | act:move_seed-bomb | act:move_seed-bomb | 176 | tempo 0.00–1.27 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| sintético | `charge_guard-break` | move guard-break: uso real (toque, carga e soltura, confirmação de mira) | act:charge_guard-break | act:charge_guard-break | 1048 | tempo 0.00–0.50 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (6× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `release_guard-break` | move guard-break: uso real (toque, carga e soltura, confirmação de mira) | act:release_guard-break | act:release_guard-break | 686 | tempo 0.00–0.63 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (7× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `charge_bounce` | move bounce: uso real (toque, carga e soltura, confirmação de mira) | act:charge_bounce | act:charge_bounce | 925 | tempo 0.00–0.76 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (5× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `release_bounce` | move bounce: uso real (toque, carga e soltura, confirmação de mira) | act:release_bounce | act:release_bounce | 561 | tempo 0.00–0.89 s · peso 1.00 | não | INTERROMPIDA_POR_REACAO | aprovada por execução (4× INTERROMPIDA_POR_REACAO) |
| sintético | `charge_water-pulse` | move water-pulse: uso real (toque, carga e soltura, confirmação de mira) | act:charge_water-pulse | act:charge_water-pulse | 925 | tempo 0.00–1.01 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (5× INTERROMPIDA_POR_NOVA_ACAO) |
| sintético | `release_water-pulse` | move water-pulse: uso real (toque, carga e soltura, confirmação de mira) | act:release_water-pulse | act:release_water-pulse | 316 | tempo 0.00–1.14 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (4× CONCLUIDA_NATURALMENTE) |

## wookada.glb
| personagem | ação | gatilho real | clipe configurado | clipe executado | frames | parâmetros aplicados | fallback | classificação | resultado |
|---|---|---|---|---|---|---|---|---|---|
| wookada.glb | `idle` | locomoção: parado, girar, andar nas 4 direções | Mutant Idle | Mutant Idle | 21805 | tempo 0.01–7.35 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (169× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `turn` | reação: acerto contra a parede (wall-splat e prensado) | turn | turn | 52 | tempo 0.01–0.38 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `walk` | locomoção: parado, girar, andar nas 4 direções | Mutant Walking | Mutant Walking | 1196 | tempo 0.00–1.02 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (19× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `walk_back` | lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | Mutant Walking | Mutant Walking | 138 | tempo 0.00–1.02 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (3× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `walk_left` | lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | Mutant Walking | Mutant Walking | 101 | tempo 0.00–1.02 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `walk_right` | lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | Mutant Walking | Mutant Walking | 138 | tempo 0.00–1.02 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (3× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `sprint` | locomoção: sprint nas 4 direções e freios | sprint 8 dir | sprint 8 dir | 155 | tempo 0.01–0.63 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (3× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `sprint_back` | lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | sprint 8 dir | sprint 8 dir | 22 | tempo 0.01–0.32 s · peso 0.92 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `sprint_left` | lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | sprint 8 dir | sprint 8 dir | 23 | tempo 0.01–0.34 s · peso 0.96 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `sprint_right` | lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | sprint 8 dir | sprint 8 dir | 23 | tempo 0.01–0.34 s · peso 0.96 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `walk_stop` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `sprint_stop` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `block_start` | defesa: entra, segura, sai | block start | block start | 230 | tempo 0.00–0.88 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `block` | defesa: entra, segura, sai | bloking still | bloking still | 374 | tempo 0.00–0.34 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (4× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `block_end` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `guard_impact` | defesa: bloqueia um tackle (guard stun no defensor, recuo no atacante) | block start | block start | 181 | tempo 0.00–0.88 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (3× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `perfect_guard` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `blocked` | espelho: o azul ataca um defensor (recuo do atacante, guard stun do rival) | dash back | dash back | 74 | tempo 0.00–1.06 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `hit` | reação: contato sem lançamento (enableLaunch desligado) → hitstun | get hit | get hit 3 | 791 | tempo 0.00–1.44 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (3× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `hit_light` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `hit_heavy` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `push` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `push_side` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `hit_up` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `hit_crush` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `knockback` | reação: tackle do rival acerta o lutador livre (hitstun, empurrão, recuperação) | Sweep Fall | Sweep Fall | 1021 | tempo 0.01–0.45 s · peso 1.00 | não | INTERROMPIDA_POR_REACAO | aprovada por execução (12× INTERROMPIDA_POR_REACAO) |
| wookada.glb | `fall` | — | falling | — | 0 | — | não | — | reserva (primário presente) |
| wookada.glb | `recover` | exaustão: o custo zera a stamina (recover) | dead recovery | dead recovery | 38 | tempo 0.00–2.75 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `downed` | — | lying still post ground crash | — | 0 | — | não | — | reserva (primário presente) |
| wookada.glb | `death` | derrota: o último golpe derruba o lutador (KO) | stay dead | stay dead | 510 | tempo 0.01–1.67 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `recovery_tackle` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `recovery_dodge` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `recovery_move` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `tackle` | tackle X e recuperação | tackle 1 | tackle 1 | 1994 | tempo 0.01–2.00 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (18× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `tackle_charge` | tackle carregado PL2/PL3 | charge move start | charge move start | 664 | tempo 0.01–1.18 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (9× INTERROMPIDA_POR_NOVA_ACAO) |
| wookada.glb | `tackle_pl2` | tackle carregado 75 passos (PL2/PL3) | tackle 2 | tackle 2 | 414 | tempo 0.02–2.48 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (3× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `tackle_pl3` | tackle carregado PL2/PL3 | tackle 2 | tackle 2 | 138 | tempo 0.02–2.48 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `brake` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `meteor_prep` | meteor slam: C → X a partir do vault | jump falling | jump falling | 59 | tempo 0.00–0.05 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (1× INTERROMPIDA_POR_NOVA_ACAO) |
| wookada.glb | `meteor_dive` | meteor slam: C → X a partir do vault | Mutant Jump Attack | Mutant Jump Attack | 14 | tempo 0.00–0.19 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (1× INTERROMPIDA_POR_NOVA_ACAO) |
| wookada.glb | `meteor_ground` | meteor slam: C → X a partir do vault | bloking still | bloking still | 54 | tempo 0.00–0.35 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `dodge_forward` | locomoção: sprint nas 4 direções e freios | land to run | land to run | 304 | tempo 0.01–0.93 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (4× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `dodge_back` | locomoção: sprint nas 4 direções e freios | dodge foward | dodge foward | 651 | tempo 0.01–1.15 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (8× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `dodge_left` | locomoção: sprint nas 4 direções e freios | dodge left | dodge left | 232 | tempo 0.01–1.08 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (3× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `dodge_right` | lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | dodge right | dodge right | 140 | tempo 0.01–1.08 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `jump` | esquiva C nas 4 direções + vault sobre o rival | jump falling | jump falling | 734 | tempo 0.00–0.05 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (7× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `jump_start` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `jump_rise` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `jump_apex` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `jump_fall` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `land` | salto normal: fases e pouso | jump land | fall_hitground | 564 | tempo 0.00–1.30 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (14× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `wall_splat` | reação: acerto contra a parede (wall-splat e prensado) | Wall Crash | post fall wall crash | 85 | tempo 0.00–0.57 s · peso 1.00 | não | INTERROMPIDA_POR_REACAO | aprovada por execução (1× INTERROMPIDA_POR_REACAO) |
| wookada.glb | `ledge_grab` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `ledge_hang` | borda: agarrar, ficar pendurado, tentar subir bloqueado, subir e soltar | ledge idle (freeze frame) | ledge idle (freeze frame) | 283 | tempo 0.00–0.08 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (2× INTERROMPIDA_POR_NOVA_ACAO) |
| wookada.glb | `ledge_climb` | borda: agarrar, ficar pendurado, tentar subir bloqueado, subir e soltar | ledge up | ledge up | 54 | tempo 0.00–1.41 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `ledge_drop` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `ledge_blocked` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `move_1` | contra-ataque: Riposte (atordoamento do atacante) | move blast 2 | moveblast 6 | 2508 | tempo 0.00–1.70 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (25× INTERROMPIDA_POR_NOVA_ACAO) |
| wookada.glb | `move_2` | reserva: Move no slot 2 sem identidade → clipe do slot (move_2) | move blast | move blast | 91 | tempo 0.00–1.31 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `move_3` | reserva: Move no slot 3 sem identidade → clipe do slot (move_3) | moveblast 4 | moveblast 4 | 104 | tempo 0.00–1.50 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `move_4` | reserva: Move no slot 4 sem identidade → clipe do slot (move_4) | moveblast 3 | moveblast 3 | 117 | tempo 0.00–1.69 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `charge_reflect` | move reflect: uso real (toque, carga e soltura, confirmação de mira) | — | Mutant Idle | 1327 | tempo 0.00–4.67 s · peso 1.00 | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `release_reflect` | move reflect: carga segurada 160 passos e solta | move 1 | move 1 | 837 | tempo 0.00–2.60 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (4× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `charge_psyshock` | move psyshock: uso real (toque, carga e soltura, confirmação de mira) | — | Mutant Idle | 925 | tempo 0.00–4.67 s · peso 1.00 | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `release_psyshock` | move psyshock: uso real (toque, carga e soltura, confirmação de mira) | Stabbing | Stabbing | 385 | tempo 0.00–1.11 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (5× CONCLUIDA_NATURALMENTE) |
| wookada.glb | `move_reflect` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `move_psyshock` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `move_harden` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `move_second-wind` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `move_swift` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `move_lunge` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `move_guard-break` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `move_bounce` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `move_spikes` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `move_sand-wave` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `move_bullet-punch` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `move_emerging-stone` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `move_feint` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `move_riposte` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `move_quick-attack` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `move_water-pulse` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `move_fire-spin` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `move_air-slash` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `move_seed-bomb` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `charge_guard-break` | move guard-break: uso real (toque, carga e soltura, confirmação de mira) | — | Mutant Idle | 885 | tempo 0.00–4.67 s · peso 1.00 | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `release_guard-break` | move guard-break: uso real (toque, carga e soltura, confirmação de mira) | — | move blast | 590 | tempo 0.01–1.31 s · peso 1.00 | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `charge_bounce` | move bounce: uso real (toque, carga e soltura, confirmação de mira) | — | Mutant Idle | 925 | tempo 0.00–4.67 s · peso 1.00 | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `release_bounce` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `charge_water-pulse` | move water-pulse: uso real (toque, carga e soltura, confirmação de mira) | — | Mutant Idle | 925 | tempo 0.00–4.67 s · peso 1.00 | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| wookada.glb | `release_water-pulse` | move water-pulse: uso real (toque, carga e soltura, confirmação de mira) | — | move blast | 455 | tempo 0.00–1.31 s · peso 1.00 | não | SEM_CLIPE | sem clipe configurado (nada a provar) |

## Cogumelo.glb
| personagem | ação | gatilho real | clipe configurado | clipe executado | frames | parâmetros aplicados | fallback | classificação | resultado |
|---|---|---|---|---|---|---|---|---|---|
| Cogumelo.glb | `idle` | locomoção: parado, girar, andar nas 4 direções | idle | idle | 20516 | tempo 0.00–3.69 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (156× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `turn` | reação: acerto contra a parede (wall-splat e prensado) | alt idle | alt idle | 52 | tempo 0.01–0.38 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `walk` | locomoção: parado, girar, andar nas 4 direções | Standing Run Right | Standing Run Right | 916 | tempo 0.00–0.79 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (13× INTERROMPIDA_POR_NOVA_ACAO) |
| Cogumelo.glb | `walk_back` | lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | Run Backwards (1) | Run Backwards (1) | 60 | tempo 0.01–0.66 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (2× INTERROMPIDA_POR_NOVA_ACAO) |
| Cogumelo.glb | `walk_left` | lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | Left Strafe | Left Strafe | 56 | tempo 0.01–0.66 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (1× INTERROMPIDA_POR_NOVA_ACAO) |
| Cogumelo.glb | `walk_right` | lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | Standing Run Right | Standing Run Right | 56 | tempo 0.01–0.66 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (1× INTERROMPIDA_POR_NOVA_ACAO) |
| Cogumelo.glb | `sprint` | locomoção: sprint nas 4 direções e freios | Mutant Run | Mutant Run | 86 | tempo 0.01–0.51 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (2× INTERROMPIDA_POR_NOVA_ACAO) |
| Cogumelo.glb | `sprint_back` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `sprint_left` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `sprint_right` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `walk_stop` | locomoção: parado, girar, andar nas 4 direções | Standing Block React Large | Standing Block React Large | 630 | tempo 0.00–0.93 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (4× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `sprint_stop` | locomoção: sprint nas 4 direções e freios | Zombie Reaction Hit | Zombie Reaction Hit | 274 | tempo 0.00–1.36 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (2× INTERROMPIDA_POR_NOVA_ACAO) |
| Cogumelo.glb | `block_start` | defesa: entra, segura, sai | Big Hit To Head | Big Hit To Head | 328 | tempo 0.00–1.59 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (5× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `block` | defesa: bloqueia um tackle (guard stun no defensor, recuo no atacante) | Standing Block Idle | Standing Block Idle | 284 | tempo 0.01–1.65 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (3× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `block_end` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `guard_impact` | defesa: bloqueia um tackle (guard stun no defensor, recuo no atacante) | Standing Block React Large | Standing Block React Large | 185 | tempo 0.00–0.93 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (3× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `perfect_guard` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `blocked` | espelho: o azul ataca um defensor (recuo do atacante, guard stun do rival) | Hit Reaction | Hit Reaction | 74 | tempo 0.00–2.09 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `hit` | reação: acerto contra a parede (wall-splat e prensado) | Big Hit To Head | Big Hit To Head | 896 | tempo 0.00–1.59 s · peso 1.00 | não | INTERROMPIDA_POR_REACAO | aprovada por execução (5× INTERROMPIDA_POR_REACAO) |
| Cogumelo.glb | `hit_light` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `hit_heavy` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `push` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `push_side` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `hit_up` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `hit_crush` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `knockback` | reação: tackle do rival acerta o lutador livre (hitstun, empurrão, recuperação) | Falling | Falling | 1021 | tempo 0.01–0.37 s · peso 1.00 | não | INTERROMPIDA_POR_REACAO | aprovada por execução (12× INTERROMPIDA_POR_REACAO) |
| Cogumelo.glb | `fall` | borda: agarrar, ficar pendurado, tentar subir bloqueado, subir e soltar | Falling | Falling | 283 | tempo 0.00–0.36 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (3× INTERROMPIDA_POR_NOVA_ACAO) |
| Cogumelo.glb | `recover` | exaustão: o custo zera a stamina (recover) | recovery | recovery | 38 | tempo 0.00–1.67 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `downed` | — | Falling Down | — | 0 | — | não | — | reserva (primário presente) |
| Cogumelo.glb | `death` | derrota: o último golpe derruba o lutador (KO) | Dying Backwards | Dying Backwards | 510 | tempo 0.01–1.73 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `recovery_tackle` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `recovery_dodge` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `recovery_move` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `tackle` | tackle X e recuperação | Mutant Swiping | Mutant Swiping | 2549 | tempo 0.00–1.90 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (22× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `tackle_charge` | tackle carregado PL2/PL3 | charge | charge | 664 | tempo 0.01–2.19 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (9× INTERROMPIDA_POR_NOVA_ACAO) |
| Cogumelo.glb | `tackle_pl2` | tackle carregado 75 passos (PL2/PL3) | Standing Melee Attack 360 Low | Standing Melee Attack 360 Low | 414 | tempo 0.01–1.60 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (3× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `tackle_pl3` | tackle carregado PL2/PL3 | Flying Kick | Flying Kick | 138 | tempo 0.01–1.13 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (1× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `brake` | finta (brake): tackle cancelado pela esquiva | Jump | Jump | 126 | tempo 0.02–0.97 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (2× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `meteor_prep` | meteor slam: C → X a partir do vault | Mutant Jumping | Mutant Jumping | 59 | tempo 0.00–0.63 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (1× INTERROMPIDA_POR_NOVA_ACAO) |
| Cogumelo.glb | `meteor_dive` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `meteor_ground` | meteor slam: C → X a partir do vault | Standing Up | Standing Up | 55 | tempo 0.00–0.79 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (1× INTERROMPIDA_POR_NOVA_ACAO) |
| Cogumelo.glb | `dodge_forward` | locomoção: sprint nas 4 direções e freios | Jump Over | Jump Over | 322 | tempo 0.02–1.36 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (4× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `dodge_back` | locomoção: sprint nas 4 direções e freios | Fall A Land To Run Forward | Fall A Land To Run Forward | 579 | tempo 0.01–0.97 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (7× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `dodge_left` | locomoção: sprint nas 4 direções e freios | Hit On Side Of Head | Hit On Side Of Head | 391 | tempo 0.03–2.43 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (4× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `dodge_right` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `jump` | esquiva C nas 4 direções + vault sobre o rival | Jump | Jump Over | 788 | tempo 0.00–1.37 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (8× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `jump_start` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `jump_rise` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `jump_apex` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `jump_fall` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `land` | salto normal: fases e pouso | Fall A Land To Standing Idle 02 | Fall A Land To Standing Idle 02 | 564 | tempo 0.00–1.10 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (14× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `wall_splat` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `ledge_grab` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `ledge_hang` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `ledge_climb` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `ledge_drop` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `ledge_blocked` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_1` | contra-ataque: Riposte (atordoamento do atacante) | move 1 | move 1 | 2854 | tempo 0.00–1.73 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (23× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `move_2` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_3` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_4` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `charge_reflect` | move reflect: uso real (toque, carga e soltura, confirmação de mira) | — | idle | 1327 | tempo 0.00–3.69 s · peso 1.00 | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `release_reflect` | move reflect: carga segurada 160 passos e solta | move 1 | move 1 | 595 | tempo 0.00–1.72 s · peso 1.00 | não | CONCLUIDA_NATURALMENTE | aprovada por execução (5× CONCLUIDA_NATURALMENTE) |
| Cogumelo.glb | `charge_psyshock` | move psyshock: uso real (toque, carga e soltura, confirmação de mira) | — | idle | 925 | tempo 0.00–3.69 s · peso 1.00 | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `release_psyshock` | move psyshock: uso real (toque, carga e soltura, confirmação de mira) | — | Mutant Swiping | 655 | tempo 0.00–1.90 s · peso 1.00 | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_reflect` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_psyshock` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_harden` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_second-wind` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_swift` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_lunge` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_guard-break` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_bounce` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_spikes` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_sand-wave` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_bullet-punch` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_emerging-stone` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_feint` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_riposte` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_quick-attack` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_water-pulse` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_fire-spin` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_air-slash` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `move_seed-bomb` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `charge_guard-break` | move guard-break: uso real (toque, carga e soltura, confirmação de mira) | — | idle | 885 | tempo 0.00–3.69 s · peso 1.00 | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `release_guard-break` | move guard-break: uso real (toque, carga e soltura, confirmação de mira) | — | Mutant Swiping | 670 | tempo 0.01–1.89 s · peso 1.00 | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `charge_bounce` | move bounce: uso real (toque, carga e soltura, confirmação de mira) | — | idle | 925 | tempo 0.00–3.69 s · peso 1.00 | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `release_bounce` | — | — | — | 0 | — | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
| Cogumelo.glb | `charge_water-pulse` | move water-pulse: uso real (toque, carga e soltura, confirmação de mira) | move 1 | move 1 | 925 | tempo 0.00–1.72 s · peso 1.00 | não | INTERROMPIDA_POR_NOVA_ACAO | aprovada por execução (5× INTERROMPIDA_POR_NOVA_ACAO) |
| Cogumelo.glb | `release_water-pulse` | move water-pulse: uso real (toque, carga e soltura, confirmação de mira) | — | Mutant Swiping | 655 | tempo 0.00–1.90 s · peso 1.00 | não | SEM_CLIPE | sem clipe configurado (nada a provar) |
