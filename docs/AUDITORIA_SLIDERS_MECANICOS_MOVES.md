# Auditoria e Overhaul dos Sliders Mecânicos dos Moves

> **Contrato central obrigatório (Regra dos Parâmetros Mecânicos Completos):**
> Nenhum valor numérico que controle o comportamento mecânico de um Move pode permanecer inacessível ao Editor de Moves, exceto constantes técnicas explicitamente identificadas, justificadas e verificadas por teste automatizado.

---

## 1. Diagnóstico Estrutural e Solução Implementada

Durante a auditoria profunda dos 19 Moves registrados (`src/sim/moves/*.move.json`, `src/sim/moves/*.js`, `src/sim/stone.js`, `src/sim/sand.js`, `src/sim/trap.js`, `src/sim/charge.js`, `src/sim/controller/ctrl-moves.js`), identificamos e eliminamos quatro problemas estruturais:

| Problema estrutural | Evidência anterior no código | Solução implementada |
| :--- | :--- | :--- |
| **1. Valores escondidos no handler** | `quick-attack.js` usava `STUCK_TICKS = 3`, `0.3` (fração de bloqueio), `0.15 m` (parada na ida) e `0.08 m` (parada na volta) fixos. | Todos promovidos às fichas `.move.json` com valor padrão idêntico ao comportamento aprovado e verificados pelo detector sintático `findUnclassifiedMoveNumbers`. |
| **2. Parâmetros de entidades espalhados** | `emerging-stone.js` criava projétil subterrâneo com `life: 120` fixo; `reflect.js` criava explosão com `height: 3` e `life: 0.1` fixos; `swift.js` usava alturas `0.65`, `0.15` e caixa de mira `0.05–0.95` fixas. | Promovidos para as fichas (`burrowMaxLife`, `burstHeight`, `burstLife`, `originHeight`, `heightStep`, `aimHeightMin`, `aimHeightMax`, etc.) e lidos da captura `P`. |
| **3. Valores de mecânica fora do Move** | `sand.js` usava `height: 0.35`, `0.6 m/s` e `0.25` para pressão de parede; `stone.js` e `trap.js` usavam tolerância `0.06 m` e dimensões fixas; `ctrl-moves.js` tinha janelas de `feint` (`0.03–0.15 s`) e `riposte` (`PL4`, `0.1 s`) fixas. | Conectados aos parâmetros do respectivo Move (`waveHeight`, `wallPressMinSpeed`, `wallPressMoveRatio`, `rockBaseWidth`, `rockBaseHeight`, `rockSearchStep`, `supportTolerance`, `dashStart`, `dashEnd`, `strikePl`, `minStrikeDuration`, `trapPl`). |
| **4. Faixas duplicadas entre painéis** | `moves-panel.js` calculava limites efetivos localmente enquanto `move-editor-panel.js` consultava `MOVES_PARAMS` indiretamente. | Unificado na função pura `effectiveRangeOf(group, row)` em `src/sim/moves/params-registry.js`, usada como fonte única de verdade por ambos os painéis e pela auditoria. |

---

## 2. Os Quatro Tipos de Parâmetros no Editor de Moves

O registro único (`src/sim/moves/params-registry.js` + `src/sim/moves/move-mechanics-audit.js`) classifica e apresenta quatro naturezas de valores no Editor de Moves (`🛠 Editor`):

1. **Parâmetros Exclusivos do Move (`exclusive`)**:
   - Declarados em `src/sim/moves/<id>.move.json` e carregados em `C.world.<grupo>`.
   - Contam com slider de faixa única (`effectiveRangeOf`), **caixa de digitação numérica exata** (`<input type="number">`), categoria oficial (16 categorias), nível de profundidade (`essencial`, `avançado`, `técnico`), arquivo/função consumidora e indicador de dependência (`depende de <chave>`).
2. **Parâmetros Herdados de Sistemas Compartilhados (`inherited`)**:
   - Exibidos na subseção **«Parâmetros herdados de sistemas compartilhados»** (`#editor-inherited`).
   - Mostram ao vivo os valores herdados de **Tackle** (`C.actions.tackle`), **Carga compartilhada** (`C.world.charge`), **Combate global** (`C.rules`, `C.extras.combat`) e **IA com Moves** (`C.world.ai`), indicando quando um parâmetro exclusivo do Move substitui ou escala o valor herdado (`substituído por ...`).
3. **Valores Calculados por Fórmula em Tempo Real (`calculated`)**:
   - Exibidos na subseção **«Valores calculados (fórmulas mecânicas em tempo real)»** (`#editor-calculated`).
   - Atualizam instantaneamente enquanto você arrasta qualquer slider (ex.: velocidades de ida/volta do Quick Attack, velocidade de propagação do Sand Wave, número máximo de pedras e teto de dano do Psyshock, pulsos e dano total do Fire Spin, velocidade horizontal exigida pelo Seed Bomb, etc.).
4. **Constantes Técnicas Justificadas (`technical`)**:
   - Exibidas na subseção **«Constantes técnicas justificadas (bloqueadas)»** (`#editor-technical`).
   - Únicos literais numéricos permitidos no código-fonte dos Moves fora de `P.<chave>`, documentados com ID, valores, arquivo e justificativa matemática/física (`IEEE754_EPSILON`, `DEG_RAD_CONVERSION`, `CHARGE_PL_LEVELS`, `BISECTION_STEPS`, `SPATIAL_SEARCH_TOPOLOGY`, `GROUND_PROBE_OFFSET`, `GEOMETRIC_COLLISION_MARGINS`).

---

## 3. Matriz das 16 Categorias Obrigatórias de Inspeção

Todo parâmetro exclusivo dos 19 Moves é classificado automaticamente em uma das 16 categorias oficiais (`MOVE_MECHANIC_CATEGORIES`):

1. **Recursos** — custo de stamina, fator de custo, desconto de mobilidade e aceleração de recarga.
2. **Preparação** — cast, startup, windup, janelas de início/fim de golpe, desaparecimento (`vanish`) e recuperação (`recovery`, `landRecovery`, `missRecovery`).
3. **Dano** — dano nominal, por nível de carga (`damagePl1..3`), por pulso, fração de Ataque e decaimento por acerto sucessivo.
4. **Hitboxes** — raio de colisão, largura, comprimento, altura mecânica (`waveHeight`, `zoneHeight`, `trapHeight`, `burstHeight`) e alcance vertical (`verticalReach`).
5. **Knockback** — empurrão horizontal/vertical, aceleração contínua (`accel`), lançamento da rocha, teto acumulado (`knockbackCap`) e multiplicador de impacto.
6. **Movimentação** — alcance de avanço, recuo (`retreat`), parada antes do alvo (`stopShort`), tolerâncias de chegada (`approachStopDist`, `returnStopDist`), detecção de bloqueio (`stuckTicks`, `stuckSpeedRatio`), alturas de salto e gravidade.
7. **Projéteis** — velocidade, quantidade, tempo de voo, tempo de vida (`lifetime`, `burrowMaxLife`), perfuração (`pierce`), homing, leque (`fanAngle`) e offsets de saída (`originHeight`, `heightStep`, `spawnForward`, `spawnSpacing`).
8. **Área e persistência** — duração de campo/barreira/armadilha, atraso para armar (`armDelay`), HP e dimensões da rocha (`rockHp`, `rockBaseWidth`, `rockBaseHeight`), limite de entidades (`maxRocks`, `maxActive`).
9. **Status** — cegueira (`blind`, `visionRadius`), bônus de defesa (`defensePct`, `negateKnockback`), regeneração de stamina (`regenPctPerSecond`, `regenInterval`) e atordoamento (`stun`, `wallStagger`, `guardStun`).
10. **Defesa e Counter** — nível de Power Level (`pulsePl`, `seedPl`, `strikePl`, `trapPl`), `counterStagger`, janela de Riposte e reflexão de dano.
11. **Cancelamentos** — `chainAfter`, `cancelAfter`, `cancelWindow` e paradas de ação.
12. **Alvo e mira** — alcance de aquisição (`acquireRange`, `reach`, `minRange`, `range`), velocidade/aceleração do marcador (`markerSpeed`, `markerAccel`) e caixa vertical de lock-on (`aimHeightMin`, `aimHeightMax`).
13. **Ambiente e colisão** — desvio A* (`cell`, `detour`, `replanSteps`), oclusão por parede (`occlusion`), passo de raycast (`rayStep`), busca de ponto livre (`freeSearchRadius`, `freeSearchStep`, `rockSearchStep`), tolerância de apoio (`supportTolerance`) e pressão contra parede (`wallPressMinSpeed`, `wallPressMoveRatio`).
14. **Eventos e múltiplos hits** — intervalo entre pulsos (`interval`), atraso do 1º pulso (`startup`) e segundos por pedra extra (`stoneSeconds`).
15. **IA do Move** — parâmetros declarativos de decisão e coordenação com `C.world.ai`.
16. **Interações globais** — multiplicadores de hitstop (`hitstopMult`) e interações com sistemas globais.

---

## 4. Inventário dos 47 Novos Sliders Mecânicos Expostos (Rodadas 1 a 4)

Todos os 47 parâmetros abaixo antes estavam fixos no código e agora possuem controle completo nas fichas `.move.json` e no Editor de Moves, mantendo exatamente os mesmos valores padrão aprovados:

### Rodada 1 — Moves Prioritários
| Move | Chave (`key`) | Rótulo no Editor | Padrão | Unidade | Consumidor real |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Quick Attack** | `approachStopDist` | Tolerância de chegada no alvo | `0.15` | `m` | `src/sim/moves/quick-attack.js` (`quickAttackStep`) |
| **Quick Attack** | `returnStopDist` | Tolerância de chegada na origem | `0.08` | `m` | `src/sim/moves/quick-attack.js` (`quickAttackStep`) |
| **Quick Attack** | `stuckTicks` | Passos bloqueado para encerrar fase | `3` | `int` | `src/sim/moves/quick-attack.js` (`quickAttackStep`) |
| **Quick Attack** | `stuckSpeedRatio` | Fração mínima de velocidade antes de travar | `0.3` | `pct` | `src/sim/moves/quick-attack.js` (`quickAttackStep`) |
| **Emerging Stone** | `burrowMaxLife` | Vida máxima de segurança do projétil subterrâneo | `120` | `sec` | `src/sim/moves/emerging-stone.js` (`emergingStoneEffect`) |
| **Emerging Stone** | `rockBaseWidth` | Largura e profundidade base da rocha | `3` | `m` | `src/sim/stone.js` (`detonateBurrow`) |
| **Emerging Stone** | `rockBaseHeight` | Altura base da rocha | `3` | `m` | `src/sim/stone.js` (`detonateBurrow`) |
| **Emerging Stone** | `rockSearchStep` | Passo da grade na busca de lugar para a rocha | `0.25` | `m` | `src/sim/stone.js` (`findRockSpot`) |
| **Emerging Stone** | `supportTolerance` | Tolerância vertical de apoio da rocha | `0.06` | `m` | `src/sim/stone.js` (`rockSpotFree`, `stepEmergingRocks`) |
| **Sand Wave** | `waveHeight` | Altura mecânica da barragem de areia | `0.35` | `m` | `src/sim/moves/sand-wave.js` (`sandWaveEffect`) |
| **Sand Wave** | `wallPressMinSpeed` | Velocidade mínima de empurrão para stagger na parede | `0.6` | `ms` | `src/sim/sand.js` (`checkSandWallPress`) |
| **Sand Wave** | `wallPressMoveRatio` | Fração máxima de avanço real para considerar barrado | `0.25` | `pct` | `src/sim/sand.js` (`checkSandWallPress`) |
| **Bullet Punch** | `rayStep` | Passo de amostragem de parede na corrida | `0.25` | `m` | `src/sim/moves/bullet-punch.js` (`firstFree`) |
| **Bullet Punch** | `freeSearchRadius` | Raio máximo de busca de ponto livre na chegada | `6` | `m` | `src/sim/moves/bullet-punch.js` (`nearestFree`) |
| **Bullet Punch** | `freeSearchStep` | Passo radial de busca de ponto livre | `0.25` | `m` | `src/sim/moves/bullet-punch.js` (`nearestFree`) |
| **Bounce** | `verticalReach` | Alcance vertical do corpo no impacto | `1.3` | `m` | `src/sim/moves/bounce.js` (`bounceLand`) |

### Rodada 2 — Projéteis, Campos e Carga
| Move | Chave (`key`) | Rótulo no Editor | Padrão | Unidade | Consumidor real |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Water Pulse** | `plScaleBonus` | Crescimento visual por nível de PL | `0.25` | `num` | `src/sim/moves/water-pulse.js` (`waterPulseEffect`) |
| **Psyshock** | `cost` | Custo de stamina | `1` | `num` | `src/sim/moves.js` (`effectiveMove`) |
| **Psyshock** | `cooldown` | Cooldown | `8` | `sec` | `src/sim/moves.js` (`effectiveMove`) |
| **Psyshock** | `maxCharge` | Carga máxima | `4` | `sec` | `src/sim/charge.js` (`chargeParams`) |
| **Psyshock** | `minCharge` | Carga mínima para disparar | `0` | `sec` | `src/sim/charge.js` (`chargeParams`) |
| **Psyshock** | `aimHeightMin` | Fração mínima de altura no alvo (lock-on) | `0.05` | `num` | `src/sim/moves/psyshock.js` (`psyshockEffect`) |
| **Psyshock** | `aimHeightMax` | Fração máxima de altura no alvo (lock-on) | `0.95` | `num` | `src/sim/moves/psyshock.js` (`psyshockEffect`) |
| **Reflect** | `cost` | Custo de stamina | `1` | `num` | `src/sim/moves.js` (`effectiveMove`) |
| **Reflect** | `cooldown` | Cooldown | `8` | `sec` | `src/sim/moves.js` (`effectiveMove`) |
| **Reflect** | `maxCharge` | Carga máxima | `4` | `sec` | `src/sim/charge.js` (`chargeParams`) |
| **Reflect** | `burstHeight` | Altura do cilindro do pulso de criação | `3` | `m` | `src/sim/moves/reflect.js` (`reflectEffect`) |
| **Reflect** | `burstLife` | Duração visual/física da área de pulso inicial | `0.1` | `sec` | `src/sim/moves/reflect.js` (`reflectEffect`) |
| **Fire Spin** | `pulsePl` | Power Level (PL) dos pulsos da zona | `1` | `int` | `src/sim/moves/fire-spin.js` (`fireSpinEffect`) |
| **Seed Bomb** | `seedPl` | Power Level (PL) da semente e explosão | `1` | `int` | `src/sim/moves/seed-bomb.js` (`seedBombEffect`) |
| **Swift** | `originHeight` | Altura base de saída das estrelas | `0.65` | `m` | `src/sim/moves/swift.js` (`swiftEffect`) |
| **Swift** | `heightStep` | Alternância vertical de altura | `0.15` | `m` | `src/sim/moves/swift.js` (`swiftEffect`) |
| **Swift** | `aimHeightMin` | Fração mínima de altura no alvo (lock-on) | `0.05` | `num` | `src/sim/moves/swift.js` (`swiftEffect`) |
| **Swift** | `aimHeightMax` | Fração máxima de altura no alvo (lock-on) | `0.95` | `num` | `src/sim/moves/swift.js` (`swiftEffect`) |
| **Air Slash** | `pierce` | Alvos que a lâmina pode atingir antes de dissipar | `1` | `int` | `src/sim/moves/air-slash.js` (`airSlashEffect`) |

### Rodada 3 — Buffs, Posturas, Armadilhas e Corpo a Corpo
| Move | Chave (`key`) | Rótulo no Editor | Padrão | Unidade | Consumidor real |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Second Wind** | `regenInterval` | Intervalo do pulso de regeneração | `0.1` | `sec` | `src/sim/moves/second-wind.js` (`secondWindEffect`) |
| **Feint** | `dashStart` | Início do recuo curto | `0.03` | `sec` | `src/sim/controller/ctrl-moves.js` (`applyMoveStep`) |
| **Feint** | `dashEnd` | Fim do recuo curto | `0.15` | `sec` | `src/sim/controller/ctrl-moves.js` (`applyMoveStep`) |
| **Riposte** | `strikePl` | Power Level (PL) do contra-golpe | `4` | `int` | `src/sim/controller/ctrl-moves.js` (`triggerRiposte`) |
| **Riposte** | `minStrikeDuration` | Duração mínima do contra-golpe após o impacto | `0.1` | `sec` | `src/sim/controller/ctrl-moves.js` (`triggerRiposte`) |
| **Spikes** | `supportTolerance` | Tolerância vertical de apoio no piso | `0.06` | `m` | `src/sim/trap.js` (`stepTraps`) |
| **Spikes** | `trapPl` | Power Level (PL) da armadilha | `1` | `int` | `src/sim/moves/spikes.js` (`spikesEffect`) |

### Rodada 4 — Sand Wave: empurrão, velocidade da frente e alvos
| Move | Chave (`key`) | Rótulo no Editor | Padrão | Unidade | Consumidor real |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Sand Wave** | `speedFromReach` | Velocidade = alcance ÷ janela ativa (sincronizada) | `1` | `yesno` | `src/sim/moves/sand-wave/sand-wave.js` (`sandWaveEffect`) |
| **Sand Wave** | `waveSpeed` | Velocidade inicial da frente (manual) | `5.333333` | `ms` | `src/sim/moves/sand-wave/sand-wave.js` (`sandWaveEffect`) |
| **Sand Wave** | `waveAccel` | Aceleração da frente da onda | `0` | `ms2` | `src/sim/moves/sand-wave/sand-wave.js` (`sandWaveEffect`) |
| **Sand Wave** | `pushSpeed` | Impulso inicial do empurrão | `0` | `ms` | `src/sim/sand.js` (`stepSand`) |
| **Sand Wave** | `pushDuration` | Limite de tempo do empurrão | `0` | `sec` | `src/sim/moves/sand-wave/sand-push.js` (`pushWindowState`) + `src/sim/sand.js` (`stepSand`) |
| **Sand Wave** | `pushClearsLocomotion` | Zerar movimento próprio no primeiro contato | `1` | `yesno` | `src/sim/sand.js` (`stepSand`) |
| **Sand Wave** | `pushCancelsDodge` | Empurrão cancela esquiva em andamento | `1` | `yesno` | `src/sim/sand.js` (`stepSand`) + `src/sim/controller/ctrl-basico.js` (`startPermission`) |
| **Sand Wave** | `blindOnPartial` | Cegar também na defesa parcial | `1` | `yesno` | `src/sim/sand.js` (`stepSand`) |
| **Sand Wave** | `hitsAirborne` | Acertar alvos em voo baixo | `0` | `yesno` | `src/sim/sand.js` (`stepSand`) |
| **Sand Wave** | `wallStaggerOn` | Ativar stagger ao ser prensado contra parede | `1` | `yesno` | `src/sim/sand.js` (`stepSand`) |
| **Sand Wave** | `wallPressStopRatio` | Fração da intenção que conta como parada na parede | `0.3` | `pct` | `src/sim/sand.js` (`stepSand`) |
| **Sand Wave** | `wallUnpinDistance` | Distância para soltar da parede | `0.01` | `m` | `src/sim/sand.js` (`stepSand`) |
| **Sand Wave** | `maxTargets` | Máximo de alvos por execução | `16` | `int` | `src/sim/sand.js` (`stepSand`) |

> Os campos `accel` (empurrão contínuo) e `partialFactor` (fator na defesa parcial) também passaram para a categoria **Knockback** e o campo `accel` entrou no filtro **Essencial**, para não ficar escondido atrás de "Avançado".

### Rodada 5/6 — Sand Wave: política do empurrão por alvo
| Move | Chave (`key`) | Rótulo no Editor | Padrão | Unidade | Consumidor real |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Sand Wave** | `pushDurationMode` | Duração do empurrão | `0` | `int` | `src/sim/moves/sand-wave/sand-push.js` (`pushWindowState`) — 0 = fim da barragem; 1/2 experimentais; 3 legado |
| **Sand Wave** | `pushDuration` | Limite de tempo do empurrão | `0` | `sec` | `sand-push.js` (`pushWindowState`) — teto opcional; 0 acompanha a política |
| **Sand Wave** | `pushContinueAfterActive` | Modo legado: continua depois da janela de dano | `0` | `yesno` | `sand-push.js` — só modo 3 |
| **Sand Wave** | `pushContinuesOutsideArea` | Empurrão continua fora do retângulo (experimental) | `0` | `yesno` | `sand-push.js` (`pushWindowState`) |
| **Sand Wave** | `pushReleaseDelay` | Tolerância ao perder contato | `0` | `sec` | `sand-push.js` (`pushWindowState`) |
| **Sand Wave** | `pushContinuesDuringStagger` | Empurrão continua durante stagger/recuperação | `1` | `yesno` | `sand-push.js` + `src/sim/controller/ctrl-update.js` |
| **Sand Wave** | `pushPreserveVelocity` | Velocidade própria preservada no contato | `0` | `pct` | `src/sim/moves/sand-wave/sand-push.js` (`applySandPushStep`) + `src/sim/sand.js` (contato) |
| **Sand Wave** | `pushMaxSpeed` | Velocidade máxima do empurrão | `0` | `ms` | `sand-push.js` (`pushAccelNow`) |
| **Sand Wave** | `pushAccelerationMode` | Modo de aceleração do empurrão | `0` | `int` | `sand-push.js` (`pushAccelNow`) |
| **Sand Wave** | `pushCurvePower` | Expoente da curva de aceleração | `1` | `num` | `sand-push.js` (`pushAccelNow`) |
| **Sand Wave** | `pushTargetSpeed` | Velocidade-alvo do empurrão | `0` | `ms` | `sand-push.js` (`pushAccelNow`) |
| **Sand Wave** | `pushRampTime` | Constante de tempo da velocidade-alvo | `0.2` | `sec` | `sand-push.js` (`pushAccelNow`) |

> **Rodada 6 (26/10/2026):** o modo 0 passou a ser **fim da barragem** (`active + dissipate` = 1,5 s), não a janela de dano. O alvo precisa permanecer dentro do retângulo após o primeiro acerto; a frente da onda não precisa continuar atrás dele. Dano/cegueira continuam únicos. `pushContinueAfterActive` virou apenas o legado do modo 3, `pushContinuesDuringStagger` passou a **1** por padrão, e a vida da onda **não é estendida** no modo 0. A prova real (parede/pinned, `barrageEnded`) está em `moves-sand-push.test.mjs`; a telemetria do Editor mostra a coluna **Fim** e a **prova de contenção**.

---

## 5. Expansão do Palco Mecânico de Testes (Fase 6)

O palco do Editor de Moves (`src/editor/move-editor-model.js` e `src/editor/move-editor-panel.js`) foi ampliado para cobrir todos os alcances e condições de combate:

- **Distância do alvo**: de `0,5 m` a **`40 m`** (com slider e caixa numérica exata `#editor-distance-num`), permitindo testar `Seed Bomb` (`32 m`), `Fire Spin` (`20 m`), `Spikes` e projéteis de longo alcance.
- **Segurar o botão (`hold`)**: de `0 s` a **`5 s`** (com slider e caixa numérica exata `#editor-hold-num`), permitindo testar cargas máximas de `4 s` (`Reflect` e `Psyshock` em PL3).
- **Janela de observação (`observeSeconds`)**: expandida até **`30 s`** considerando automaticamente `life`, `duration`, `durationBase`, `flightTime`, `lifetime` e `vanish`.
- **7 Estados do Alvo (`#editor-target`)**:
  1. `Parado` (`still`)
  2. `Defendendo` (`guard`)
  3. `Defesa perfeita` (`perfect`)
  4. `Esquivando` (`dodge`)
  5. `Atacando (Tackle)` (`tackle`)
  6. `No ar (saltando)` (`air`)
  7. `Com escudo (40 HP)` (`shield`)
- **5 Geometrias de Arena (`#editor-arena`)**:
  1. `Arena livre` (`open`)
  2. `Parede entre os dois` (`wall`)
  3. `Parede atrás do alvo` (`backwall`)
  4. `Alvo sobre plataforma (1,5 m)` (`platform`)
  5. `Com rocha destrutível` (`destructible`)

---

## 6. Como Rodar as Auditorias e Testes Automatizados

- **Auditoria sintática e de registro único (Fase 2)**:
  ```bash
  node prototypes/combat-lab/test/moves-mechanics-audit.test.mjs
  ```
- **Sensibilidade A/B, captura M28.4, extremos e determinismo (Fase 7)**:
  ```bash
  node prototypes/combat-lab/test/moves-ab-sensitivity.test.mjs
  ```
- **Palco e modelo do Editor de Moves (Fase 6)**:
  ```bash
  node prototypes/combat-lab/test/move-editor.test.mjs
  ```

---

## 7. Portão ZERO dos três pilotos (DOC03)

A cobertura mecânica de Sand Wave, Bullet Punch e Water Pulse foi fechada em **173 candidatos** (173 decididos, 0 abertos): **92 com prova A/B individual (53,2%)**, **55 herdados**, **16 técnicos justificados** e **10 bloqueados com motivo**. A rodada 4 acrescentou 13 controles exclusivos do Sand Wave (velocidade da frente, impulso/duração/limpeza/cancelamento do empurrão, cegueira na parcial, alvo aéreo, stagger de parede e limite de alvos) e 8 globais herdados de física/mundo. A rodada 5 acrescentou 12 controles de política do empurrão por alvo (duração, continuação, área, tolerância, stagger, preservação de velocidade, limite, modos de aceleração, curva, velocidade-alvo, constante de tempo e esquiva existente), todos com A/B individual; o Editor ganhou a seção **Perfil do empurrão** com simulação real a 1–4 m. A matriz, os deltas medidos e as pendências de homologação estão em [`EDITOR_MOVES_OVERHAUL_OPENCODE_RELATORIO.md`](EDITOR_MOVES_OVERHAUL_OPENCODE_RELATORIO.md). Testes: `node prototypes/combat-lab/test/moves-doc03-pilots.test.mjs` (18) e `node prototypes/combat-lab/test/moves-sand-push.test.mjs` (14).
