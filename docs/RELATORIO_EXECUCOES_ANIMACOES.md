# Relatório por execução das animações (Wookada e Cogumelo reais)

Gerado por `node scripts/gen-relatorio-execucoes.mjs` com os GLBs reais e a configuração salva do workspace inicial, nos mesmos cenários de gameplay da [matriz](MATRIZ_ANIMACOES_RUNTIME.md) (`Game` + `Character` + `AnimationMixer`). Cada **execução** é uma ocorrência própria do clipe (identidade `chave#serial`): duas execuções seguidas do mesmo Move aparecem como linhas diferentes.

Classificações extras deste relatório: `NAO_CONCLUIDA_NO_CENARIO` = o cenário de teste acabou com o clipe tocando (nem corte nem conclusão; a conclusão do mesmo clipe está em outra execução); `SAIDA_DE_LACO` = laço (idle, andar, sprint) trocado por locomoção — normal. `CORTADA_INDEVIDAMENTE` sobra só para o corte real do runtime e precisa ser 0.

Colunas: **liberação mecânica** = tick em que a simulação soltou o lutador e o clipe seguiu em conclusão visual (— = a execução não precisou de conclusão visual); **quadros** = primeiro e último quadro efetivo do clipe a 30 fps; **peso** = peso no mixer em 0/25/50/75/100 % da execução; **velocidade confere** = taxa medida do clipe na conclusão visual × velocidade configurada no Editor.

Limitações: cenários sem plataformas/obstáculos (essa parte está no teste do app real, `animation-conclusao-visual.browser.mjs`); configurações salvas só no navegador do usuário não entram aqui; a heurística de A7 só aponta nomes — a escolha de clipe é autoral.

## wookada.glb

- Execuções medidas: **368** (40 ações com clipe próprio) · aprovadas 350 · aprovadas com ≤ 4 quadros: **0** (deve ser 0).
- Por classificação: CONCLUIDA_NATURALMENTE 247 · INTERROMPIDA_POR_NOVA_ACAO 75 · INTERROMPIDA_POR_REACAO 36 · CORTADA_INDEVIDAMENTE 0 · FALLBACK 0 · NAO_CONCLUIDA_NO_CENARIO 5 · SAIDA_DE_LACO 5.
- Velocidade na conclusão visual diferente da configurada: **0**.
- Lista completa (todas as execuções): `prototypes/combat-lab/evidence/execucoes-animacoes/wookada.json`.

### Deslizamento dos pés (só medição)
Velocidade horizontal do pé de apoio no mundo (ideal ≈ 0 enquanto apoiado): andando normal 0.86 m/s (p90 2.18; corpo 4.19 m/s; 115 quadros) · andando durante a conclusão visual do tackle 3.84 m/s (p90 3.84; corpo 0.96 m/s; 3 quadros — amostra curta, inconclusiva).
Amostra insuficiente para concluir (a conclusão visual do tackle deste modelo dura poucos quadros com a configuração salva).

### Clipes do GLB sem nenhuma associação (9)
`buff 2` (1.25 s) · `ground crash` (1.53 s) · `Mutant Jumping` (0.75 s) · `status move` (1.73 s) · `tacke 7` (1.15 s) · `tackle 3` (1.05 s) · `tackle 4` (1.40 s) · `tackle 5` (1.17 s) · `tackle 6` (1.72 s)

### Associações de sentido duvidoso (A7) — NÃO alteradas
Heurística pelo nome do clipe: só aponta o que vale conferir a olho; várias escolhas podem ser autorais e corretas (ex.: um clipe de salto para o vault).
| ação | clipe associado | o nome sugere | a ação espera | alternativas no próprio GLB |
|---|---|---|---|---|
| `vault` | roll foward | esquiva | salto | falling, jump falling, jump land, land to run, Mutant Jump Attack, Mutant Jumping |
| `guard_impact` | block start | defesa | reação | fall_hitground, get hit, get hit 2, get hit 3 |
| `blocked` | dash back | esquiva | reação | fall_hitground, get hit, get hit 2, get hit 3 |
| `wall_splat` | post fall wall crash | salto | reação | fall_hitground, get hit, get hit 2, get hit 3 |
| `meteor_prep` | jump falling | salto | ataque | charge move start, move 1, move blast, move blast 2, moveblast 3, moveblast 4 |
| `meteor_dive` | Mutant Jump Attack | salto | ataque | charge move start, move 1, move blast, move blast 2, moveblast 3, moveblast 4 |
| `dodge_forward` | land to run | salto | esquiva | dash back, dodge foward, dodge left, dodge right, roll foward |
| `knockback` | Sweep Fall | salto | reação | fall_hitground, get hit, get hit 2, get hit 3 |
| `land` | fall_hitground | reação | salto | falling, jump falling, jump land, land to run, Mutant Jump Attack, Mutant Jumping |
| `ledge_hang` | ledge idle (freeze frame) | locomoção | salto | falling, jump falling, jump land, land to run, Mutant Jump Attack, Mutant Jumping |

### Execuções (amostra por ação: a mais longa, a primeira e as não aprovadas)
| cenário | ação | execução | clipe | variante | início (tick) | liberação mecânica | fim (tick) | quadros (30 fps) | tocado | peso 0→100 % | encerramento | classificação | aprovada | velocidade confere |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| move spikes: uso real (toque, carga e soltura, confirmação de mira) | `idle` | neutral#0 | Mutant Idle | 1/1 | 1 | — | 504 | 0–221 | 70.7% | 1.00→1.00→1.00→1.00→1.00 | fim do cenário | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| locomoção: parado, girar, andar nas 4 direções | `idle` | neutral#0 | Mutant Idle | 1/1 | 1 | — | 80 | 0–35 | 11.2% | 1.00→1.00→1.00→1.00→1.00 | locomoção → walk | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| tackle carregado PL2/PL3 | `idle` | neutral#0 | Mutant Idle | 1/1 | 309 | — | 309 | 0–0 | 0.1% | 0.00→0.00→0.00→0.00→0.00 | locomoção → walk | SAIDA_DE_LACO | não | sem epílogo (relógio da simulação) |
| tackle carregado 75 passos (PL2/PL3) | `idle` | neutral#0 | Mutant Idle | 1/1 | 224 | — | 224 | 0–0 | 0.1% | 0.00→0.00→0.00→0.00→0.00 | locomoção → walk | SAIDA_DE_LACO | não | sem epílogo (relógio da simulação) |
| locomoção: parado, girar, andar nas 4 direções | `walk` | walk#0 | Mutant Walking | 1/1 | 81 | — | 166 | 0–31 | 21.4% | 0.00→0.92→1.00→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| esquiva C nas 4 direções + vault sobre o rival | `dodge_forward` | dodge_forward#1 | land to run | 1/1 | 31 | — | 108 | 0–28 | 98.9% | 0.00→1.00→1.00→1.00→1.00 | ação concluída → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| locomoção: sprint nas 4 direções e freios | `dodge_forward` | dodge_forward#1 | land to run | 1/1 | 1 | 57 | 74 | 0–28 | 100% | 1.00→1.00→1.00→1.00→1.00 | conclusão natural → sprint | CONCLUIDA_NATURALMENTE | sim | sim (1.75×) |
| locomoção: sprint nas 4 direções e freios | `sprint` | sprint#0 | sprint 8 dir | 1/1 | 249 | — | 630 | 0–19 | 94.2% | 0.00→1.00→0.92→0.44→1.00 | locomoção → walk | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| locomoção: sprint nas 4 direções e freios | `sprint` | sprint#0 | sprint 8 dir | 1/1 | 75 | — | 88 | 0–6 | 31.4% | 0.00→0.13→0.31→0.44→0.57 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| recuperação das ações (sliders de recuperação do tackle e da esquiva > 0) | `dodge_back` | dodge_back#2 | dodge foward | 1/1 | 222 | — | 341 | 0–34 | 100% | 0.00→1.00→1.00→1.00→1.00 | ação concluída → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| locomoção: sprint nas 4 direções e freios | `dodge_back` | dodge_back#2 | dodge foward | 1/1 | 171 | 227 | 248 | 0–34 | 100% | 0.00→1.00→1.00→1.00→1.00 | conclusão natural → sprint | CONCLUIDA_NATURALMENTE | sim | sim (1.75×) |
| esquiva C nas 4 direções + vault sobre o rival | `dodge_left` | dodge_left#3 | dodge left | 1/1 | 313 | — | 390 | 0–32 | 98.9% | 0.00→1.00→1.00→1.00→1.00 | ação concluída → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| locomoção: sprint nas 4 direções e freios | `dodge_left` | dodge_left#3 | dodge left | 1/1 | 341 | 397 | 417 | 0–32 | 100% | 0.00→1.00→1.00→1.00→1.00 | conclusão natural → sprint | CONCLUIDA_NATURALMENTE | sim | sim (1.75×) |
| defesa: entra, segura, sai | `block_start` | guard_enter#1 | block start | 1/1 | 21 | — | 81 | 0–26 | 99.1% | 0.00→0.66→1.00→1.00→1.00 | guard → guard | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| defesa: bloqueia um tackle (guard stun no defensor, recuo no atacante) | `block_start` | guard_enter#1 | block start | 1/1 | 1 | — | 48 | 0–21 | 77.6% | 1.00→1.00→1.00→1.00→1.00 | fim do cenário | NAO_CONCLUIDA_NO_CENARIO | não | sem epílogo (relógio da simulação) |
| defesa perfeita: toque de D no tempo certo | `block_start` | guard_enter#1 | block start | 1/1 | 1 | — | 27 | 0–11 | 42.9% | 1.00→1.00→1.00→1.00→1.00 | fim do cenário | NAO_CONCLUIDA_NO_CENARIO | não | sem epílogo (relógio da simulação) |
| reação: Guard Break quebra a defesa (atordoamento) | `block_start` | guard_enter#1 | block start | 1/1 | 1 | — | 33 | 0–14 | 52.8% | 1.00→1.00→1.00→1.00→1.00 | fim do cenário | NAO_CONCLUIDA_NO_CENARIO | não | sem epílogo (relógio da simulação) |
| defesa: bloqueia um tackle (guard stun no defensor, recuo no atacante) | `block` | guard#1 | bloking still | 1/1 | 109 | — | 221 | 0–10 | 95.8% | 0.00→1.00→1.00→1.00→1.00 | fim do cenário | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| defesa: entra, segura, sai | `block` | guard#0 | bloking still | 1/1 | 82 | — | 118 | 0–10 | 54.2% | 0.00→0.39→0.79→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| defesa perfeita: toque de D no tempo certo | `guard_impact` | guard_hit#2 | block start | 1/1 | 28 | — | 88 | 0–26 | 99.1% | 1.00→1.00→1.00→1.00→1.00 | guard → guard | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| defesa: bloqueia um tackle (guard stun no defensor, recuo no atacante) | `guard_impact` | guardStun#1 | block start | 1/1 | 49 | — | 108 | 0–26 | 99% | 1.00→1.00→1.00→1.00→1.00 | guard → guard | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| recuperação das ações (sliders de recuperação do tackle e da esquiva > 0) | `tackle` | tackle#1 | tackle 1 | 1/1 | 1 | — | 179 | 0–60 | 100% | 1.00→1.00→1.00→1.00→1.00 | ação concluída → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| tackle X e recuperação | `tackle` | tackle#1 | tackle 1 | 1/1 | 21 | — | 157 | 0–60 | 99.9% | 0.00→1.00→1.00→1.00→1.00 | ação concluída → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| tackle carregado PL2/PL3 | `tackle_charge` | tackle_charge#0 | charge move start | 1/1 | 21 | — | 170 | 0–35 | 84.9% | 0.00→1.00→1.00→1.00→1.00 | nova ação → tackle_pl3 | INTERROMPIDA_POR_NOVA_ACAO | sim | sem epílogo (relógio da simulação) |
| tackle carregado PL2/PL3 | `tackle_pl3` | tackle_pl3#1 | tackle 2 | 1/1 | 171 | — | 308 | 1–74 | 99.9% | 0.00→1.00→1.00→1.00→1.00 | ação concluída → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| footstool: pisar no rival (atordoamento do pisado) | `jump` | jump#0 | jump falling | 1/1 | 1 | — | 160 | 0–2 | 100% | 1.00→1.00→1.00→1.00→1.00 | reação de combate → landing | INTERROMPIDA_POR_REACAO | sim | sem epílogo (relógio da simulação) |
| esquiva C nas 4 direções + vault sobre o rival | `jump` | vault#5 | jump falling | 1/1 | 565 | — | 618 | 0–2 | 100% | 0.00→1.00→1.00→1.00→1.00 | ação cancelada (defesa) → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| meteor slam: C → X a partir do vault | `jump` | vault#1 | jump falling | 1/1 | 1 | — | 14 | 0–0 | 25.9% | 1.00→1.00→1.00→1.00→1.00 | fim do cenário | NAO_CONCLUIDA_NO_CENARIO | não | sem epílogo (relógio da simulação) |
| meteor slam: C → X a partir do vault | `meteor_prep` | meteor_prep#2 | jump falling | 1/1 | 15 | — | 73 | 0–2 | 100% | 1.00→1.00→1.00→1.00→1.00 | nova ação → meteor_dive | INTERROMPIDA_POR_NOVA_ACAO | sim | sem epílogo (relógio da simulação) |
| meteor slam: C → X a partir do vault | `meteor_dive` | meteor_dive#2 | Mutant Jump Attack | 1/1 | 74 | — | 87 | 0–6 | 5.1% | 0.00→0.28→0.65→0.93→1.00 | nova ação → meteor_ground | INTERROMPIDA_POR_NOVA_ACAO | sim | sem epílogo (relógio da simulação) |
| meteor slam: C → X a partir do vault | `meteor_ground` | meteor_ground#2 | bloking still | 1/1 | 88 | — | 141 | 0–10 | 100% | 0.00→1.00→1.00→1.00→1.00 | ação cancelada (defesa) → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| reação: tackle do rival acerta o lutador livre (hitstun, empurrão, recuperação) | `land` | landing#1 | jump land | 1/2 | 47 | — | 103 | 0–24 | 99.9% | 0.00→1.00→1.00→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| salto normal: fases e pouso | `land` | landing#0 | fall_hitground | 2/2 | 93 | — | 123 | 0–39 | 100% | 0.00→0.74→1.00→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | `walk_back` | walk_back#0 | Mutant Walking | 1/1 | 111 | — | 196 | 0–31 | 21.4% | 0.00→0.92→1.00→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| reação: Sand Wave empurra o alvo (pushed lateral e frontal) | `walk_back` | walk_back#1 | Mutant Walking | 1/1 | 242 | — | 247 | 0–3 | 8.5% | 0.00→0.04→0.13→0.18→0.22 | locomoção → neutral | SAIDA_DE_LACO | não | sem epílogo (relógio da simulação) |
| lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | `walk_right` | walk_right#0 | Mutant Walking | 1/1 | 221 | — | 306 | 0–31 | 21.4% | 0.00→0.92→1.00→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | `walk_left` | walk_left#0 | Mutant Walking | 1/1 | 331 | — | 416 | 0–31 | 21.4% | 0.00→0.92→1.00→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | `sprint_back` | sprint_back#0 | sprint 8 dir | 1/1 | 669 | — | 690 | 0–10 | 49.4% | 0.00→0.22→0.48→0.70→0.92 | locomoção → walk_back | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | `dodge_right` | dodge_right#3 | dodge right | 1/1 | 741 | 797 | 817 | 0–32 | 100% | 0.00→1.00→1.00→1.00→1.00 | conclusão natural → sprint_right | CONCLUIDA_NATURALMENTE | sim | sim (1.75×) |
| lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | `sprint_right` | sprint_right#0 | sprint 8 dir | 1/1 | 818 | — | 840 | 0–10 | 51.6% | 0.00→0.26→0.48→0.75→0.96 | locomoção → walk_right | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | `sprint_left` | sprint_left#0 | sprint 8 dir | 1/1 | 968 | — | 990 | 0–10 | 51.6% | 0.00→0.26→0.48→0.75→0.96 | locomoção → walk_left | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| move bounce: carga segurada 160 passos e solta | `knockback` | airborne#0 | Sweep Fall | 1/1 | 162 | — | 313 | 0–13 | 98.7% | 0.00→1.00→1.00→1.00→1.00 | reação de combate → landing | INTERROMPIDA_POR_REACAO | sim | sem epílogo (relógio da simulação) |
| reação: tackle do rival acerta o lutador livre (hitstun, empurrão, recuperação) | `knockback` | airborne#1 | Sweep Fall | 1/1 | 2 | — | 46 | 0–13 | 97.7% | 0.00→1.00→1.00→1.00→1.00 | reação de combate → landing | INTERROMPIDA_POR_REACAO | sim | sem epílogo (relógio da simulação) |
| reação: acerto contra a parede (wall-splat e prensado) | `turn` | turn#0 | turn | 1/1 | 1 | — | 26 | 0–11 | 34.5% | 1.00→1.00→1.00→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| reação: acerto contra a parede (wall-splat e prensado) | `wall_splat` | wallSplat#1 | post fall wall crash | 2/2 | 175 | — | 259 | 0–17 | 12.5% | 0.00→1.00→1.00→1.00→1.00 | reação de combate → airborne | INTERROMPIDA_POR_REACAO | sim | sem epílogo (relógio da simulação) |
| derrota: o último golpe derruba o lutador (KO) | `death` | defeated#1 | stay dead | 1/1 | 47 | — | 47 | 0–50 | 100% | 0.00→1.00→1.00→1.00→1.00 | fim do cenário | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| Sand Wave pelo lado (empurrão lateral) | `hit` | pushed#1 | get hit 3 | 3/3 | 66 | 211 | 263 | 0–43 | 100% | 0.00→1.00→1.00→1.00→1.00 | conclusão natural → neutral | CONCLUIDA_NATURALMENTE | sim | sim (1.75×) |
| reação: contato sem lançamento (enableLaunch desligado) → hitstun | `hit` | hitstun#1 | get hit 3 | 3/3 | 2 | 28 | 101 | 0–43 | 100% | 0.00→1.00→1.00→1.00→1.00 | conclusão natural → neutral | CONCLUIDA_NATURALMENTE | sim | sim (1.75×) |
| move bullet-punch: uso real (toque, carga e soltura, confirmação de mira) | `move_1` | tackle_pl2#2 | moveblast 6 | 6/6 | 169 | 287 | 302 | 0–46 | 100% | 0.00→1.00→1.00→1.00→1.00 | conclusão natural → neutral | CONCLUIDA_NATURALMENTE | sim | sim (1.75×) |
| contra-ataque: Riposte (atordoamento do atacante) | `move_1` | move_1#1 | moveblast 6 | 6/6 | 1 | — | 47 | 0–20 | 43.3% | 1.00→1.00→1.00→1.00→1.00 | nova ação → tackle | INTERROMPIDA_POR_NOVA_ACAO | sim | sem epílogo (relógio da simulação) |
| borda bloqueada: o topo está ocupado pelo rival | `ledge_hang` | ledge_hang#0 | ledge idle (freeze frame) | 1/1 | 109 | — | 269 | 0–2 | 100% | 0.00→1.00→1.00→1.00→1.00 | fim do cenário | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| borda: agarrar, ficar pendurado, tentar subir bloqueado, subir e soltar | `ledge_hang` | ledge_hang#0 | ledge idle (freeze frame) | 1/1 | 109 | — | 468 | 0–2 | 17.5% | 0.00→1.00→1.00→0.44→1.00 | ledge_climb → ledge_climb | INTERROMPIDA_POR_NOVA_ACAO | sim | sem epílogo (relógio da simulação) |
| borda: agarrar, ficar pendurado, tentar subir bloqueado, subir e soltar | `ledge_climb` | ledge_climb#0 | ledge up | 1/1 | 190 | 244 | 244 | 0–43 | 100% | 0.00→0.61→1.00→1.00→1.00 | conclusão natural → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| move psyshock: uso real (toque, carga e soltura, confirmação de mira) | `release_psyshock` | release_psyshock#1 | Stabbing | 1/1 | 122 | — | 198 | 0–33 | 99.3% | 0.00→0.83→1.00→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| move reflect: carga segurada 160 passos e solta | `release_reflect` | release_reflect#1 | move 1 | 1/1 | 162 | — | 340 | 0–78 | 99.8% | 0.00→1.00→1.00→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| recuperação de Move: depois de soltar a carga (sem clipe de soltura), parado | `release_reflect` | release_reflect#1 | move 1 | 1/1 | 242 | — | 362 | 0–52 | 67.3% | 0.00→1.00→1.00→1.00→1.00 | fim do cenário | NAO_CONCLUIDA_NO_CENARIO | não | sem epílogo (relógio da simulação) |
| tackle carregado 75 passos (PL2/PL3) | `tackle_pl2` | tackle_pl2#1 | tackle 2 | 1/1 | 86 | — | 223 | 1–74 | 99.9% | 0.00→1.00→1.00→1.00→1.00 | ação concluída → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| exaustão: o custo zera a stamina (recover) | `recover` | recover#0 | dead recovery | 1/1 | 148 | — | 166 | 0–82 | 100% | 0.00→0.46→0.83→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| reserva: Move no slot 2 sem identidade → clipe do slot (move_2) | `move_2` | move_2#1 | move blast | 1/1 | 11 | 40 | 101 | 0–39 | 100% | 0.00→1.00→1.00→1.00→1.00 | conclusão natural → neutral | CONCLUIDA_NATURALMENTE | sim | sim (1.75×) |
| reserva: Move no slot 3 sem identidade → clipe do slot (move_3) | `move_3` | move_3#1 | moveblast 4 | 1/1 | 11 | 40 | 114 | 0–45 | 100% | 0.00→1.00→1.00→1.00→1.00 | conclusão natural → neutral | CONCLUIDA_NATURALMENTE | sim | sim (1.75×) |
| reserva: Move no slot 4 sem identidade → clipe do slot (move_4) | `move_4` | move_4#1 | moveblast 3 | 1/1 | 11 | 40 | 127 | 0–51 | 100% | 0.00→1.00→1.00→1.00→1.00 | conclusão natural → neutral | CONCLUIDA_NATURALMENTE | sim | sim (1.75×) |
| espelho: o azul ataca um defensor (recuo do atacante, guard stun do rival) | `blocked` | recoil#0 | dash back | 1/1 | 48 | — | 121 | 0–32 | 99.7% | 0.00→1.00→1.00→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |

## Cogumelo.glb

- Execuções medidas: **351** (33 ações com clipe próprio) · aprovadas 331 · aprovadas com ≤ 4 quadros: **0** (deve ser 0).
- Por classificação: CONCLUIDA_NATURALMENTE 214 · INTERROMPIDA_POR_NOVA_ACAO 88 · INTERROMPIDA_POR_REACAO 37 · CORTADA_INDEVIDAMENTE 0 · FALLBACK 0 · NAO_CONCLUIDA_NO_CENARIO 6 · SAIDA_DE_LACO 6.
- Velocidade na conclusão visual diferente da configurada: **0**.
- Lista completa (todas as execuções): `prototypes/combat-lab/evidence/execucoes-animacoes/Cogumelo.json`.

### Deslizamento dos pés (só medição)
Velocidade horizontal do pé de apoio no mundo (ideal ≈ 0 enquanto apoiado): andando normal 4.96 m/s (p90 5.23; corpo 4.19 m/s; 114 quadros) · andando durante a conclusão visual do tackle 2.63 m/s (p90 3.27; corpo 2.53 m/s; 15 quadros).
Deslizamento na conclusão visual comparável ao andar normal.

### Clipes do GLB sem nenhuma associação (20)
`T-Pose` (0.07 s) · `Fall A Loop` (1.10 s) · `Falling Back Death` (1.87 s) · `Head Hit` (1.47 s) · `Hit On Legs` (1.53 s) · `Hit To Body` (1.37 s) · `Hook` (1.27 s) · `Injured Run Backwards Right Turn` (0.57 s) · `Mutant Dying` (1.97 s) · `Mutant Flexing Muscles` (2.03 s) · `Rifle Punch` (1.87 s) · `Run Backwards` (1.23 s) · `Running Forward Flip` (1.00 s) · `Running Slide` (1.57 s) · `Standing Melee Combo Attack Ver. 3` (0.93 s) · `Strafing` (0.90 s) · `Strike Foward Jog` (0.83 s) · `Zombie Stumbling` (2.70 s) · `Zombie Walk` (2.30 s) · `attack 1` (1.80 s)

### Associações de sentido duvidoso (A7) — NÃO alteradas
Heurística pelo nome do clipe: só aponta o que vale conferir a olho; várias escolhas podem ser autorais e corretas (ex.: um clipe de salto para o vault).
| ação | clipe associado | o nome sugere | a ação espera | alternativas no próprio GLB |
|---|---|---|---|---|
| `dodge_back` | Fall A Land To Run Forward | salto | esquiva | — |
| `dodge_left` | Hit On Side Of Head | reação | esquiva | — |
| `downed` | Falling Down | salto | reação | Big Hit To Head, Dying Backwards, Falling Back Death, Head Hit, Hit On Legs, Hit On Side Of Head |
| `walk_stop` | Standing Block React Large | reação | locomoção | Injured Run Backwards Right Turn, Left Strafe, Mutant Run, Run Backwards (1), Run Backwards, Running Forward Flip |
| `sprint_stop` | Zombie Reaction Hit | reação | locomoção | Injured Run Backwards Right Turn, Left Strafe, Mutant Run, Run Backwards (1), Run Backwards, Running Forward Flip |
| `brake` | Jump | salto | ataque | Flying Kick, Mutant Swiping, Rifle Punch, Standing Melee Attack 360 Low, Standing Melee Combo Attack Ver. 3, Strike Foward Jog |
| `meteor_prep` | Mutant Jumping | salto | ataque | Flying Kick, Mutant Swiping, Rifle Punch, Standing Melee Attack 360 Low, Standing Melee Combo Attack Ver. 3, Strike Foward Jog |
| `meteor_ground` | Standing Up | locomoção | ataque | Flying Kick, Mutant Swiping, Rifle Punch, Standing Melee Attack 360 Low, Standing Melee Combo Attack Ver. 3, Strike Foward Jog |
| `dodge_forward` | Jump Over | salto | esquiva | — |
| `block_start` | Big Hit To Head | reação | defesa | Standing Block Idle |
| `knockback` | Falling | salto | reação | Big Hit To Head, Dying Backwards, Falling Back Death, Head Hit, Hit On Legs, Hit On Side Of Head |

### Execuções (amostra por ação: a mais longa, a primeira e as não aprovadas)
| cenário | ação | execução | clipe | variante | início (tick) | liberação mecânica | fim (tick) | quadros (30 fps) | tocado | peso 0→100 % | encerramento | classificação | aprovada | velocidade confere |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| move spikes: uso real (toque, carga e soltura, confirmação de mira) | `idle` | neutral#0 | idle | 1/1 | 1 | — | 504 | 0–111 | 99.7% | 1.00→1.00→1.00→1.00→1.00 | fim do cenário | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| locomoção: parado, girar, andar nas 4 direções | `idle` | neutral#0 | idle | 1/1 | 1 | — | 80 | 0–35 | 31.5% | 1.00→1.00→1.00→1.00→1.00 | locomoção → walk | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| tackle carregado PL2/PL3 | `idle` | neutral#0 | idle | 1/1 | 309 | — | 309 | 0–0 | 0.4% | 0.00→0.00→0.00→0.00→0.00 | locomoção → walk | SAIDA_DE_LACO | não | sem epílogo (relógio da simulação) |
| tackle carregado 75 passos (PL2/PL3) | `idle` | neutral#0 | idle | 1/1 | 224 | — | 224 | 0–0 | 0.4% | 0.00→0.00→0.00→0.00→0.00 | locomoção → walk | SAIDA_DE_LACO | não | sem epílogo (relógio da simulação) |
| locomoção: parado, girar, andar nas 4 direções | `walk` | walk#0 | Standing Run Right | 1/1 | 216 | — | 450 | 0–15 | 63.8% | 0.00→1.00→0.75→0.35→1.00 | freio físico → walk_stop | INTERROMPIDA_POR_NOVA_ACAO | sim | sem epílogo (relógio da simulação) |
| locomoção: parado, girar, andar nas 4 direções | `walk` | walk#0 | Standing Run Right | 1/1 | 81 | — | 150 | 0–24 | 27.6% | 0.00→0.75→1.00→1.00→1.00 | freio físico → walk_stop | INTERROMPIDA_POR_NOVA_ACAO | sim | sem epílogo (relógio da simulação) |
| lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | `walk_stop` | walk_stop#0 | Standing Block React Large | 1/1 | 71 | 86 | 440 | 0–28 | 100% | 0.00→1.00→1.00→1.00→1.00 | conclusão natural → walk_back | CONCLUIDA_NATURALMENTE | sim | sim (1.75×) |
| locomoção: parado, girar, andar nas 4 direções | `walk_stop` | walk_stop#0 | Standing Block React Large | 1/1 | 151 | 166 | 480 | 0–28 | 100% | 0.00→1.00→1.00→1.00→1.00 | conclusão natural → walk | CONCLUIDA_NATURALMENTE | sim | sim (1.75×) |
| locomoção: sprint nas 4 direções e freios | `walk_stop` | walk_stop#0 | Standing Block React Large | 1/1 | 721 | 736 | 760 | 0–17 | 60.9% | 0.04→0.58→1.00→1.00→1.00 | fim do cenário | NAO_CONCLUIDA_NO_CENARIO | não | sim (1.75×) |
| locomoção: sprint nas 4 direções e freios | `dodge_forward` | dodge_forward#1 | Jump Over | 1/1 | 1 | 57 | 83 | 1–41 | 100% | 1.00→1.00→1.00→1.00→1.00 | conclusão natural → sprint | CONCLUIDA_NATURALMENTE | sim | sim (1.75×) |
| locomoção: sprint nas 4 direções e freios | `sprint` | sprint#0 | Mutant Run | 1/1 | 246 | — | 450 | 0–15 | 61.3% | 0.00→0.44→0.88→1.00→0.22 | freio físico → sprint_stop | INTERROMPIDA_POR_NOVA_ACAO | sim | sem epílogo (relógio da simulação) |
| locomoção: sprint nas 4 direções e freios | `sprint` | sprint#0 | Mutant Run | 1/1 | 84 | — | 88 | 0–2 | 8.8% | 0.00→0.04→0.09→0.13→0.18 | locomoção → neutral | SAIDA_DE_LACO | não | sem epílogo (relógio da simulação) |
| lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | `sprint` | sprint#0 | Mutant Run | 1/1 | 524 | — | 528 | 0–2 | 8.8% | 0.00→0.04→0.09→0.13→0.18 | locomoção → neutral | SAIDA_DE_LACO | não | sem epílogo (relógio da simulação) |
| recuperação das ações (sliders de recuperação do tackle e da esquiva > 0) | `dodge_back` | dodge_back#2 | Fall A Land To Run Forward | 1/1 | 222 | — | 341 | 0–29 | 100% | 0.00→1.00→1.00→1.00→1.00 | ação concluída → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| locomoção: sprint nas 4 direções e freios | `dodge_back` | dodge_back#2 | Fall A Land To Run Forward | 1/1 | 171 | 227 | 245 | 0–29 | 100% | 0.00→1.00→1.00→1.00→1.00 | conclusão natural → sprint | CONCLUIDA_NATURALMENTE | sim | sim (1.75×) |
| locomoção: sprint nas 4 direções e freios | `sprint_stop` | sprint_stop#0 | Zombie Reaction Hit | 1/1 | 281 | 289 | 714 | 0–41 | 63% | 0.00→1.00→1.00→1.00→1.00 | nova ação → dodge_left | INTERROMPIDA_POR_NOVA_ACAO | sim | sim (1.75×) |
| locomoção: sprint nas 4 direções e freios | `dodge_left` | dodge_left#3 | Hit On Side Of Head | 1/1 | 341 | 397 | 444 | 1–73 | 100% | 0.00→1.00→1.00→1.00→1.00 | conclusão natural → sprint | CONCLUIDA_NATURALMENTE | sim | sim (1.75×) |
| defesa: entra, segura, sai | `block_start` | guard_enter#1 | Big Hit To Head | 1/1 | 21 | — | 130 | 0–48 | 99.3% | 0.00→1.00→1.00→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| defesa perfeita: toque de D no tempo certo | `guard_impact` | guard_hit#2 | Standing Block React Large | 1/1 | 28 | — | 92 | 0–28 | 100% | 0.00→1.00→1.00→1.00→1.00 | guard → guard | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| defesa: bloqueia um tackle (guard stun no defensor, recuo no atacante) | `guard_impact` | guardStun#1 | Standing Block React Large | 1/1 | 49 | — | 108 | 0–28 | 99% | 0.00→1.00→1.00→1.00→1.00 | guard → guard | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| defesa: bloqueia um tackle (guard stun no defensor, recuo no atacante) | `block` | guard#1 | Standing Block Idle | 1/1 | 109 | — | 221 | 0–49 | 88.3% | 0.00→1.00→1.00→1.00→1.00 | fim do cenário | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| recuperação das ações (sliders de recuperação do tackle e da esquiva > 0) | `tackle` | tackle#1 | Mutant Swiping | 1/1 | 1 | — | 179 | 0–57 | 100% | 1.00→1.00→1.00→1.00→1.00 | ação concluída → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| tackle X e recuperação | `tackle` | tackle#1 | Mutant Swiping | 1/1 | 21 | — | 157 | 0–57 | 99.9% | 0.00→1.00→1.00→1.00→1.00 | ação concluída → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| tackle carregado PL2/PL3 | `tackle_charge` | tackle_charge#0 | charge | 1/1 | 21 | — | 170 | 0–66 | 92.4% | 0.00→1.00→1.00→1.00→1.00 | nova ação → tackle_pl3 | INTERROMPIDA_POR_NOVA_ACAO | sim | sem epílogo (relógio da simulação) |
| tackle carregado PL2/PL3 | `tackle_pl3` | tackle_pl3#1 | Flying Kick | 1/1 | 171 | — | 308 | 0–34 | 99.9% | 0.00→1.00→1.00→1.00→1.00 | ação concluída → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| footstool: pisar no rival (atordoamento do pisado) | `jump` | jump#0 | Jump Over | 2/2 | 1 | — | 160 | 0–41 | 100% | 1.00→1.00→1.00→1.00→1.00 | reação de combate → landing | INTERROMPIDA_POR_REACAO | sim | sem epílogo (relógio da simulação) |
| esquiva C nas 4 direções + vault sobre o rival | `jump` | vault#5 | Jump Over | 2/2 | 565 | — | 618 | 1–41 | 100% | 0.00→1.00→1.00→1.00→1.00 | ação cancelada (defesa) → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| meteor slam: C → X a partir do vault | `meteor_prep` | meteor_prep#2 | Mutant Jumping | 1/1 | 15 | — | 73 | 0–19 | 100% | 0.00→1.00→1.00→1.00→1.00 | nova ação → meteor_dive | INTERROMPIDA_POR_NOVA_ACAO | sim | sem epílogo (relógio da simulação) |
| meteor slam: C → X a partir do vault | `meteor_ground` | meteor_ground#2 | Standing Up | 1/1 | 88 | 142 | 142 | 0–24 | 71.6% | 0.00→1.00→1.00→1.00→1.00 | ação cancelada (defesa) → tackle_charge | INTERROMPIDA_POR_NOVA_ACAO | sim | sem epílogo (relógio da simulação) |
| finta (brake): tackle cancelado pela esquiva | `brake` | brake#0 | Jump | 1/1 | 32 | — | 94 | 0–29 | 99.9% | 0.00→0.72→1.00→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| reação: tackle do rival acerta o lutador livre (hitstun, empurrão, recuperação) | `land` | landing#1 | Fall A Land To Standing Idle 02 | 1/1 | 47 | — | 103 | 0–33 | 99.9% | 0.00→1.00→1.00→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| salto normal: fases e pouso | `land` | landing#0 | Fall A Land To Standing Idle 02 | 1/1 | 93 | — | 123 | 0–33 | 100% | 0.00→0.74→1.00→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | `walk_back` | walk_back#0 | Run Backwards (1) | 1/1 | 136 | — | 180 | 0–20 | 89.5% | 0.00→0.48→0.96→1.00→1.00 | freio físico → walk_stop | INTERROMPIDA_POR_NOVA_ACAO | sim | sem epílogo (relógio da simulação) |
| lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | `walk_right` | walk_right#0 | Standing Run Right | 1/1 | 246 | — | 855 | 0–20 | 82% | 0.00→0.61→1.00→1.00→0.44 | freio físico → walk_stop | INTERROMPIDA_POR_NOVA_ACAO | sim | sem epílogo (relógio da simulação) |
| lock-on com corpo sempre virado ao alvo: andar e sprint nas 4 direções | `walk_left` | walk_left#0 | Left Strafe | 1/1 | 356 | — | 1005 | 0–20 | 93.8% | 0.00→0.61→1.00→1.00→0.44 | freio físico → walk_stop | INTERROMPIDA_POR_NOVA_ACAO | sim | sem epílogo (relógio da simulação) |
| move bounce: carga segurada 160 passos e solta | `knockback` | airborne#0 | Falling | 1/1 | 162 | — | 313 | 0–11 | 98.7% | 0.00→1.00→1.00→1.00→1.00 | reação de combate → landing | INTERROMPIDA_POR_REACAO | sim | sem epílogo (relógio da simulação) |
| reação: tackle do rival acerta o lutador livre (hitstun, empurrão, recuperação) | `knockback` | airborne#1 | Falling | 1/1 | 2 | — | 46 | 0–11 | 97.7% | 0.00→1.00→1.00→1.00→1.00 | reação de combate → landing | INTERROMPIDA_POR_REACAO | sim | sem epílogo (relógio da simulação) |
| reação: acerto contra a parede (wall-splat e prensado) | `turn` | turn#0 | alt idle | 1/1 | 1 | — | 26 | 0–11 | 11.3% | 1.00→1.00→1.00→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| reação: Sand Wave empurra o alvo (pushed lateral e frontal) | `hit` | pushed#1 | Big Hit To Head | 1/1 | 57 | 211 | 275 | 0–48 | 100% | 0.00→1.00→1.00→1.00→1.00 | conclusão natural → neutral | CONCLUIDA_NATURALMENTE | sim | sim (1.75×) |
| reação: acerto contra a parede (wall-splat e prensado) | `hit` | wallSplat#1 | Big Hit To Head | 1/1 | 175 | — | 259 | 0–37 | 77.5% | 0.00→1.00→1.00→1.00→1.00 | reação de combate → airborne | INTERROMPIDA_POR_REACAO | sim | sem epílogo (relógio da simulação) |
| Sand Wave prende o alvo na parede (prensado) | `hit` | pushed#1 | Big Hit To Head | 1/1 | 39 | — | 40 | 0–1 | 1.8% | 0.52→0.52→0.56→0.56→0.56 | fim do cenário | NAO_CONCLUIDA_NO_CENARIO | não | sem epílogo (relógio da simulação) |
| Sand Wave prende o alvo na parede (prensado) | `hit` | stagger#2 | Big Hit To Head | 1/1 | 41 | — | 76 | 0–15 | 31.9% | 0.61→1.00→1.00→1.00→1.00 | fim do cenário | NAO_CONCLUIDA_NO_CENARIO | não | sem epílogo (relógio da simulação) |
| derrota: o último golpe derruba o lutador (KO) | `death` | defeated#1 | Dying Backwards | 1/1 | 47 | — | 47 | 0–52 | 100% | 0.00→1.00→1.00→1.00→1.00 | fim do cenário | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| move bullet-punch: uso real (toque, carga e soltura, confirmação de mira) | `move_1` | tackle_pl2#2 | move 1 | 1/1 | 169 | 287 | 304 | 0–52 | 100% | 1.00→1.00→1.00→1.00→1.00 | conclusão natural → neutral | CONCLUIDA_NATURALMENTE | sim | sim (1.75×) |
| contra-ataque: Riposte (atordoamento do atacante) | `move_1` | move_1#1 | move 1 | 1/1 | 1 | — | 47 | 0–20 | 38.7% | 1.00→1.00→1.00→1.00→1.00 | fim do cenário | NAO_CONCLUIDA_NO_CENARIO | não | sem epílogo (relógio da simulação) |
| move bullet-punch: uso real (toque, carga e soltura, confirmação de mira) | `move_1` | move_1#1 | move 1 | 1/1 | 122 | — | 168 | 0–20 | 38.7% | 0.00→1.00→1.00→1.00→1.00 | fim do cenário | NAO_CONCLUIDA_NO_CENARIO | não | sem epílogo (relógio da simulação) |
| borda bloqueada: o topo está ocupado pelo rival | `fall` | ledge_hang#0 | Falling | 1/1 | 109 | — | 269 | 0–11 | 99.4% | 0.00→1.00→1.00→1.00→1.00 | fim do cenário | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| borda: agarrar, ficar pendurado, tentar subir bloqueado, subir e soltar | `fall` | ledge_hang#0 | Falling | 1/1 | 109 | — | 189 | 0–11 | 22.2% | 0.00→0.88→1.00→1.00→1.00 | ledge_climb → ledge_climb | INTERROMPIDA_POR_NOVA_ACAO | sim | sem epílogo (relógio da simulação) |
| move water-pulse: carga segurada 320 passos e solta | `charge_water-pulse` | charge_water-pulse#0 | move 1 | 1/1 | 1 | — | 321 | 0–52 | 69.2% | 1.00→1.00→1.00→1.00→1.00 | release_water-pulse → release_water-pulse | INTERROMPIDA_POR_NOVA_ACAO | sim | sem epílogo (relógio da simulação) |
| move water-pulse: uso real (toque, carga e soltura, confirmação de mira) | `charge_water-pulse` | charge_water-pulse#0 | move 1 | 1/1 | 21 | — | 121 | 0–44 | 84.1% | 0.00→1.00→1.00→1.00→1.00 | release_water-pulse → release_water-pulse | INTERROMPIDA_POR_NOVA_ACAO | sim | sem epílogo (relógio da simulação) |
| move reflect: carga segurada 160 passos e solta | `release_reflect` | release_reflect#1 | move 1 | 1/1 | 162 | — | 280 | 0–52 | 99.3% | 0.00→1.00→1.00→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| tackle carregado 75 passos (PL2/PL3) | `tackle_pl2` | tackle_pl2#1 | Standing Melee Attack 360 Low | 1/1 | 86 | — | 223 | 0–48 | 99.9% | 0.00→1.00→1.00→1.00→1.00 | ação concluída → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| exaustão: o custo zera a stamina (recover) | `recover` | recover#0 | recovery | 1/1 | 148 | — | 166 | 0–50 | 100% | 0.00→0.46→0.83→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
| espelho: o azul ataca um defensor (recuo do atacante, guard stun do rival) | `blocked` | recoil#0 | Hit Reaction | 1/1 | 48 | — | 121 | 0–63 | 99.7% | 0.00→1.00→1.00→1.00→1.00 | locomoção → neutral | CONCLUIDA_NATURALMENTE | sim | sem epílogo (relógio da simulação) |
