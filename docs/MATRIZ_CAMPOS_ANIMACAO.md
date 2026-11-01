# Matriz de campos do editor de animações

Gerada por `node scripts/gen-matriz-campos-animacao.mjs` a partir de `TIMED`/`ONE_SHOT` (`view/characters.js`) e `FIELDS` (`sim/animation-profile.js`). É leitura do código, **não** uma partida rodando.

- Campos no editor: **62** (60 aplicados, 2 só registrados).
- Regra do relógio (`characters.js`, `blend()`): estados **TIMED** têm o tempo do clipe decidido pela simulação (progresso da ação). Eles **ignoram** os grupos **Loop avançado** e **Segurar quadro**. Os demais usam o relógio livre e passam pelo agendador (`view/clip-scheduler.js`).
- Fases do pulo (`jump_start/rise/apex/fall`) usam o relógio livre, mas **a troca de fase é da física** (velocidade vertical); só o «Tempo segurado» finito atrasa a troca visual (`Character.jumpHoldKeeps`), e o pouso/reação interrompem na hora.

## Ações × controles

| Grupo | Ação | Relógio do clipe | Execução | Loop avançado e Segurar quadro |
|---|---|---|---|---|
| Locomoção | `idle` | livre | laço por padrão | vale |
| Locomoção | `turn` | livre | laço por padrão | vale |
| Locomoção | `walk` | livre | laço por padrão | vale |
| Locomoção | `walk_back` | livre | laço por padrão | vale |
| Locomoção | `walk_left` | livre | laço por padrão | vale |
| Locomoção | `walk_right` | livre | laço por padrão | vale |
| Locomoção | `sprint` | livre | laço por padrão | vale |
| Locomoção | `sprint_back` | livre | laço por padrão | vale |
| Locomoção | `sprint_left` | livre | laço por padrão | vale |
| Locomoção | `sprint_right` | livre | laço por padrão | vale |
| Locomoção | `walk_stop` | livre | uma vez | vale |
| Locomoção | `sprint_stop` | livre | uma vez | vale |
| Defesa e reação | `block_start` | livre | laço por padrão | vale |
| Defesa e reação | `block` | livre | laço por padrão | vale |
| Defesa e reação | `block_end` | livre | laço por padrão | vale |
| Defesa e reação | `guard_impact` | livre | laço por padrão | vale |
| Defesa e reação | `perfect_guard` | livre | laço por padrão | vale |
| Defesa e reação | `blocked` | livre | laço por padrão | vale |
| Defesa e reação | `hit` | livre | laço por padrão | vale |
| Defesa e reação | `hit_light` | livre | laço por padrão | vale |
| Defesa e reação | `hit_heavy` | livre | laço por padrão | vale |
| Defesa e reação | `push` | livre | laço por padrão | vale |
| Defesa e reação | `push_side` | livre | laço por padrão | vale |
| Defesa e reação | `hit_up` | livre | laço por padrão | vale |
| Defesa e reação | `hit_crush` | livre | laço por padrão | vale |
| Defesa e reação | `knockback` | livre | laço por padrão | vale |
| Defesa e reação | `fall` | livre | laço por padrão | vale |
| Defesa e reação | `recover` | simulação (TIMED) | pela simulação | ignorado |
| Defesa e reação | `downed` | livre | laço por padrão | vale |
| Defesa e reação | `death` | livre | laço por padrão | vale |
| Recuperação de ataques | `recovery_tackle` | livre | uma vez | vale |
| Recuperação de ataques | `recovery_dodge` | livre | uma vez | vale |
| Recuperação de ataques | `recovery_move` | livre | uma vez | vale |
| Tackle | `tackle` | simulação (TIMED) | pela simulação | ignorado |
| Tackle | `tackle_charge` | livre | laço por padrão | vale |
| Tackle | `tackle_pl2` | simulação (TIMED) | pela simulação | ignorado |
| Tackle | `tackle_pl3` | simulação (TIMED) | pela simulação | ignorado |
| Tackle | `brake` | simulação (TIMED) | pela simulação | ignorado |
| Tackle | `meteor_prep` | livre | uma vez | vale |
| Tackle | `meteor_dive` | livre | uma vez | vale |
| Tackle | `meteor_ground` | livre | uma vez | vale |
| Esquivas | `dodge_forward` | simulação (TIMED) | pela simulação | ignorado |
| Esquivas | `dodge_back` | simulação (TIMED) | pela simulação | ignorado |
| Esquivas | `dodge_left` | simulação (TIMED) | pela simulação | ignorado |
| Esquivas | `dodge_right` | simulação (TIMED) | pela simulação | ignorado |
| Salto | `jump` | simulação (TIMED) | pela simulação | ignorado |
| Salto | `jump_start` | livre | uma vez | vale |
| Salto | `jump_rise` | livre | uma vez | vale |
| Salto | `jump_apex` | livre | uma vez | vale |
| Salto | `jump_fall` | livre | uma vez | vale |
| Salto | `land` | livre | uma vez | vale |
| Parede | `wall_splat` | livre | laço por padrão | vale |
| Borda (Ledge Grab) | `ledge_grab` | livre | uma vez | vale |
| Borda (Ledge Grab) | `ledge_hang` | livre | laço por padrão | vale |
| Borda (Ledge Grab) | `ledge_climb` | livre | laço por padrão | ignorado |
| Borda (Ledge Grab) | `ledge_drop` | livre | uma vez | vale |
| Borda (Ledge Grab) | `ledge_blocked` | livre | uma vez | vale |
| Moves | `move_1` | simulação (TIMED) | uma vez | ignorado |
| Moves | `move_2` | simulação (TIMED) | uma vez | ignorado |
| Moves | `move_3` | simulação (TIMED) | uma vez | ignorado |
| Moves | `move_4` | simulação (TIMED) | uma vez | ignorado |
| Moves | `charge_reflect` | livre | laço por padrão | ignorado |
| Moves | `release_reflect` | livre | uma vez | vale |
| Moves | `charge_psyshock` | livre | laço por padrão | ignorado |
| Moves | `release_psyshock` | livre | uma vez | vale |

## Campos por grupo

- **Reprodução** (8): `enabled`, `speed`, `loop`, `maxDuration`, `trimStart`, `trimEnd`, `visualCompletion`, `reverse`
- **Mistura** (5): `blendIn`, `blendOut`, `layerWeight`, `blendCurve`, `priority`
- **Loop** (4): `loopStart`, `loopEnd`, `repeats`, `exitCondition`
- **Loop avançado** (15): `loopStartTime`, `loopEndTime`, `introSpeed`, `cycleSpeed`, `outroSpeed`, `cyclePauseStart`, `cyclePauseEnd`, `repeatGap`, `loopCrossfade`, `loopCrossfadeWeight`, `entrySmooth`, `exitSmooth`, `conclusionBlend`, `loopExitDelay`, `cyclePhaseOffset`
- **Segurar quadro** (2): `holdFrame`, `holdFor`
- **Combate** (13): `startup`, `activeStart`, `activeEnd`, `cancelStart`, `invulnStart`, `invulnEnd`, `freezeAt`, `freezeFor`, `armor`, `bufferWindow`, `hitstopMult`, `interruptible`, `combatPriority`
- **Movimento** (8): `rootMotion`, `lockToGround`, `verticalOffset`, `rootAllowX`, `rootAllowZ`, `motionScale`, `displacement`, `verticalSpeed`
- **Transições** (3): `minTime`, `autoNext`, `fallback`
- **Princípios** (1): `squashScale`
- **Salto** (3): `jumpApexFreeze`, `jumpStartTime`, `jumpApexBand`

## Como ler

- «ignorado» não é defeito do campo: o estado depende da física. Para esses estados o controle que vale é o do próprio estado (duração da ação, regras do jogo).
- Os perfis ficam por **modelo** (hash do GLB no workspace; por nome sem workspace). Dois lutadores com o mesmo modelo dividem o perfil: é a causa mais provável de «aplica em todos» e está avisada no editor (Plano F2).
