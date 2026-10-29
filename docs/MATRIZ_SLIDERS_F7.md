# Matriz de cobertura dos sliders (F7)

> GERADO por `scripts/gen-matriz-sliders.mjs` a partir de `prototypes/combat-lab/test/f7-sliders-coverage-lib.mjs`. Não edite à mão: rode `node scripts/gen-matriz-sliders.mjs`.
> O teste `prototypes/combat-lab/test/f7-sliders-coverage.test.mjs` exige esta matriz em dia (ignora só o número da linha do consumidor) e reexecuta o cenário A/B de cada linha «muda».

Todo slider sai das definições reais: manifesto do Ajustes (`ui/tuning.js` `tuningManifest()`: `SECTIONS` de `ui/tuning-meta.js` + `EXTRA_SECTIONS`) e aba Moves/Editor (`MOVES_PARAMS` de `ui/moves-panel.js` = carga, IA e laser compartilhados + fichas `sim/moves/*.params.js`).
Para cada um: caminho em `C`, rótulo, unidade (lida do formato do próprio slider), faixa efetiva, padrão (`defaults()`, com a calibração), round-trip JSON (exportar → importar pelo `previewTuningImport` do Ajustes e pelo preset salvo), consumidor real (busca estática fora dos arquivos de definição) e A/B (mín × máx num cenário curto e determinístico, 120 Hz, semente fixa).

## Resumo

- Sliders: **1657** (Ajustes 1220 · Moves 437).
- Gameplay com A/B: **497** — muda no cenário: **497**.
- Visual/depuração (sem A/B da simulação): 826. Pendentes de cenário (listados com motivo): 310. Órfãos rotulados «(sem efeito)»: 24.
- Parâmetros jogáveis sem slider: nenhum (fora os 2 limites técnicos abaixo).
- Sliders numéricos sem unidade no formato (número puro: fração, multiplicador): 354 (orçamento 354, não pode crescer).

- Pendentes de A/B: 310 (orçamento 310, só diminui); pendentes só com evidência fraca de consumidor (consumerWeak): 2 (orçamento 2). Total com evidência fraca (inclui visuais): 32.

## Decisões pendentes do responsável

Sliders com significado de jogo que hoje não agem (ou só aparecem no HUD). Não foram ligados (mudaria o jogo no padrão) nem apagados (proibido sem pedido). Opções: ligar com padrão neutro, manter como legado ou remover com alias + migração de preset.

- `rules.blockPushback` (Repulsão ao bloquear (defensor) (sem efeito); padrão 0.5 m): empurraria o DEFENSOR para trás ao bloquear um tackle (hoje só existe o recuo do atacante: rules.recoil/recoilFraction); 0,5 m ligado mudaria toda defesa.
- `rules.slamAngle` (Meteor slam: ângulo do mergulho (sem efeito); padrão 0.785398 °): fixaria o ângulo de mergulho do meteor slam (hoje o mergulho mira o rival em aimSlamDive); ligado trocaria a mira por um ângulo fixo.
- `map.jumpLandingRecovery` (Atraso de recuperação ao aterrissar (s) (sem efeito); padrão 0.19 s): daria recuperação ao pousar de um pulo normal (hoje 0: physics.js land); 0,19 s ligado travaria o lutador a cada pulo.
- `map.wallDamageMultiplier` (Multiplicador de dano na borda circular (sem efeito); padrão 1 ×): multiplicaria o dano na borda circular (hoje a borda não causa dano próprio; o wall-splat usa rules.wallSplatDamage = 0); com 1 não mudaria nada até existir dano de borda.
- `actions.sprint.exhaustedStop` (Stamina zerada encerra o sprint (sem efeito); padrão 1 liga/desliga): permitiria (0) continuar o sprint com stamina zerada; hoje o sprint SEMPRE para na exaustão; com 1 o comportamento é o atual.
- `extras.ai.revision` (Revisão da IA (0 anterior · 1 revisada · 2 evoluída) (sem efeito); padrão 1 —): voltaria a IA para a revisão 0/1 (hoje tactics.js fixa a revisão 2; revisionOverride só na avaliação pareada); 2 mantém o atual.
- `map.stageCooldownReduction` (Redução de recarga por estágio (-10%); padrão 0.1 %): aplicaria −recarga por estágio de Recarga (hoje SÓ o HUD de progresso mostra o bônus; a simulação não o aplica): achado F7, consumidor fraco (só exibição).
- `map.stageSpeedBonus` (Aumento de velocidade por estágio (+5%); padrão 0.05 %): aplicaria +velocidade por estágio de Velocidade (hoje SÓ o HUD de progresso mostra o bônus; a simulação não o aplica): achado F7, consumidor fraco (só exibição).

## Órfãos (sem consumidor) — rotulados «(sem efeito)» na interface, nunca apagados

- `rules.blockPushback`: repulsão do defensor ao bloquear não é lida; o recuo da defesa usa rules.recoil/recoilFraction.
- `extras.ai.revision`: só existe a IA revisão 2: tactics.js revisionOf ignora o ajuste global (revisionOverride só na avaliação pareada).
- `profiles.balanced.defense`: f.attributes.defense não é lido (a defesa do dano usa guardDamageMultiplier/estágios); legado do v6.
- `profiles.agile.defense`: f.attributes.defense não é lido (a defesa do dano usa guardDamageMultiplier/estágios); legado do v6.
- `profiles.resistant.defense`: f.attributes.defense não é lido (a defesa do dano usa guardDamageMultiplier/estágios); legado do v6.
- `test.hp`: perfil «test» do v6: a vida vem de C.profiles[perfil].hp.
- `test.defense`: perfil «test» do v6: não é lido.
- `test.speed`: perfil «test» do v6: a velocidade vem de C.profiles[perfil].speed (só a prova de conceito physics-poc lê).
- `rules.slamAngle`: o mergulho do meteor slam mira o rival (aimSlamDive); o ângulo fixo só aparece em comentário.
- `test.speedReference`: legado do v6; mantido só para a comparação com o config.ts do jogo (official.js).
- `test.defenseMedian`: legado do v6; mantido só para a comparação com o config.ts do jogo (official.js).
- `test.pushCoefficient`: empurrão legado do v6; o laboratório usa resolvers de reação (F3).
- `test.aiRange`: legado do v6; a IA usa extras.ai.attackRange/approachDistance.
- `test.forwardTolerance`: legado do v6; a frente do golpe usa extras.combat.*Alignment.
- `map.wallDamageMultiplier`: a borda circular não causa dano próprio; o wall-splat usa rules.wallSplatDamage (0 por padrão).
- `map.jumpLandingRecovery`: o pouso de pulo normal não tem recuperação (physics.js land: wasNormalJump → 0); ligar mudaria o jogo.
- `actions.sprint.exhaustedStop`: o sprint SEMPRE termina na exaustão (ctrl-update.js); a regra «desligado» não existe.
- `extras.hud.debugFontSize`: a tela de depuração usa o CSS fixo; o valor não é aplicado.
- `extras.hud.footerFontSize`: o rodapé usa o CSS fixo; o valor não é aplicado.
- `extras.hud.menuOpacity`: o menu usa o CSS fixo; o valor não é aplicado.
- `vfx.rock.trailDensity`: o rastro da rocha não lê a densidade (view/vfx não consulta C.vfx.rock.trailDensity).
- `vfx.barrier.ripples`: a barreira não lê o interruptor de ondas.
- `vfx.laser.flowSpeed`: BeamRenderer recebe C.vfx.laser (visual-panel setConfig) mas não lê flowSpeed.
- `vfx.laser.dynamicLight`: BeamRenderer recebe C.vfx.laser (visual-panel setConfig) mas não lê dynamicLight.

## Consumidores lidos por objeto genérico (conferidos)

- `^actions\.cancel\.`: c = A.cancel (A = C.actions) no C → X de ctrl-update.js.
- `^world\.beam\.`: emissor técnico: ui/moves-panel.js (emitir laser) passa C.world.beam ao spawn; sim/beam.js e sim/world.js leem maxSegments.
- `^actions\.(dodge|tackle)\.`: p = C.actions[tipo] / actionParams(tipo): controller, motion.js (curva) e entity.js (distância nominal).
- `^profiles\.\w+\.(hp|attack|speed)$`: createFighter(C.profiles[perfil]) copia o perfil em f.attributes.
- `^extras\.(aiRed|aiBlue)\.`: P = Brain.personality() = {...NEUTRAL_PERSONALITY, ...C.extras[lado]} (sim/ai.js).
- `^vfx\.laser\.`: BeamRenderer.config recebe C.vfx.laser (ui/visual-panel.js: setConfig/setQuality).
- `^vfx\.elemental\.`: elementalCfg() = C.vfx.elemental (view/quarks/elemental-game.js).
- `^vfx\.(?!laser|elemental|post|master|solid\.|quarks)\w+\.`: famílias de efeito/tremor lidas por C.vfx[tipo] (view/vfx.js fire/shake, view/solid-fx.js).
- `^passivas\.[\w-]+\.`: P(id) = C.passivas[id] (sim/passive-engine.js).
- `^vfx\.post\.`: E = parâmetros efetivos de C.vfx.post (view/post/post-params.js → post-pipeline.js).
- `^world\.\w+\.atelierVfx$`: interruptor do rush do Ateliê lido pelo .vfx.js do Move (atelierVfxOn) e por view/quarks/atelier-game.js.
- `^display\.windows\.`: tabela de janelas [chave, rótulo, cor] lida por W = C.display.windows (ui/diagnostics-panel.js).
- `^extras\.colors\.(.+)[RGB]$`: canal RGB lido por rgb(base) / ratio(base, canal) de sim/config.js: a chave é base + R|G|B.
- `^extras\.bindings2?\.(.+)$`: tecla lida por keyFor(nome) / keyFor2(nome) (ui/input.js, main.js): o nome do comando chega como texto.

## Visual/depuração (VISUAL_OR_DEBUG)

- `^vfx\.`: efeito visual (view/vfx, solid-fx, quarks, pós-processamento).
- `^display\.`: apresentação: HUD, sombras, cenário, indicadores.
- `^camera\.|^extras\.cameraExtra\.`: câmera (view/camera).
- `^extras\.(visual|fx|hud|colors)\.`: aparência do lutador, partículas, HUD e cores.
- `^extras\.gameFeel\.(whiff|ledge|foot|track)`: game feel 5/7/8/9: feedback de golpe no vazio, pose na borda, apoio dos pés e olhar (só apresentação; não alteram a simulação).
- `^extras\.bindings2?\.`: tecla física (entrada), sem número de gameplay.
- `^rules\.(feintFx|slamRing|slamFx)`: efeito visual da finta / do meteor slam.
- `^extras\.toggles\.(showHitboxes|showAttackVectors|enableCameraFollow|enableCameraRecenter)$`: depuração visual / câmera.
- `^extras\.nav\.showDebug$`: depuração visual da navegação.
- `^locomotion\.visualTurnRate$`: giro só do indicador visual.
- `^world\.beam\.`: emissor técnico de teste (aba Moves → emitir laser e cenários técnicos de sim/scenarios-moves.js); nenhum Move do jogo dispara feixe.
- `^world\.[^.]+\.hitShake(On|Amount|Duration)$`: tremor de câmera ao acertar (view/vfx.js), só aparência.
- `^world\.\w+\.atelierVfx$`: rush visual do Ateliê; o piloto (sim/moves/pilot-coverage.js) garante que não altera o hash da simulação nem o dano.
- parâmetro visual do Move: parâmetro visual do Move (VISUAL_WORLD_KEYS em ui/moves-panel.js).

## Pendentes de cenário A/B (SENSITIVITY_PENDING)

- **combate** (80): condição não exercitada pelos cenários roteirizados de 1,5–3 s (cadeia/cancelamento específico, janela fina, clash sem lançamento, hitstop, entrada do controle).
- **ia** (29): decisão da IA tática não mudou nos duelos de 3 e 8 s (probabilidade/limiar não atingido com a semente fixa).
- **tecnico** (8): técnico de precisão/solver ou legado de comparação: sem efeito observável no cenário curto (não é parâmetro de gameplay, §14).
- **mapa** (20): condição do mapa não ocorre no cenário curto (respawn de objeto, impacto em objeto, montagem em sólido, controle aéreo fino, pick-up repetido).
- **partida** (2): lido na montagem da partida (app/match-flow.js), fora do Game: sem A/B na simulação pura.
- **ledge** (11): cenários de borda (subir, soltar, pendurar até o máximo, ser atingido, IA pendurada) não mudam: modo/dica/alcance de agarre, tempos de segurar e recarga pedem a borda em outra geometria ou input; coberto pelos testes de ledge.
- **passiva** (25): gatilho da passiva não ocorreu no duelo de 5 s nem no roteiro de 7 s com a passiva no azul (detecção de ataque, veneno/queimadura, perda de item, queda de atributo ou recarga longa).
- **nav** (3): cenários de navegação (muro, plataforma, torre, arena completa) não ficam presos nem exigem ataque com desnível: detecção de travamento e limite de altura do ataque pendentes.
- **iaMoves** (14): decisão de carga/IA com Moves não ocorreu no duelo de 6 s com Reflect/Psyshock/Water Pulse/Swift.
- **move** (118): os estágios curtos do Move (perto, defesa, longe, contra-ataque, correndo, carga curta, colado, duelo) não acionam esta condição (parede, alvo no ar, cadeia, limite técnico).

## Limites técnicos sem slider

- `world.maxEntities`: limite técnico de entidades simultâneas no mundo (salvaguarda de desempenho; acima dele a criação é recusada com evento).
- `world.slots`: quantidade de slots de Moves por lutador (estrutura do loadout e do HUD, não ajuste de equilíbrio).

## Cenários A/B

- `tackle`: tackle acertando um alvo parado (e um segundo tackle) (2.2 s).
- `guard`: tackle contra defesa (parcial e perfeita) (2.4 s).
- `clash`: clash (tackle × tackle) (2 s).
- `dodge`: esquiva (perfeita) do tackle rival, C → X e C sobre o rival (2.4 s).
- `sprint`: sprint, caminhada, X no sprint e exaustão (2.5 s).
- `charge`: tackle carregado (PL3) acertando (2.5 s).
- `feint`: finta (tackle → esquiva lateral imediata) (1.5 s).
- `wallPush`: tackle carregado jogando o rival na parede (2.5 s).
- `wall`: rival caindo na parede (wall-splat) e combo (2.2 s).
- `wallBounce`: rival subindo contra a parede (ricochete) (2 s).
- `slam`: salto sobre o rival (C) → meteor slam (X) e quique (2 s).
- `flight`: voo de lançamento, pouso e tech (C perto do chão) (2.2 s).
- `jump`: pulo, controle aéreo e footstool no rival (2.5 s).
- `duel`: duelo IA tática × IA tática (3 s) (3 s).
- `duelLong`: duelo IA tática × IA tática (8 s) (8 s).
- `duelAgile`: duelo IA × IA, perfil ágil (3 s).
- `duelResistant`: duelo IA × IA, perfil resistente (3 s).
- `duelMoves`: duelo IA × IA com Reflect, Psyshock, Water Pulse e Swift equipados (6 s) (6 s).
- `items`: consumíveis no caminho (cura, stamina, estágios, escudo) e tackle (3 s).
- `ledgeClimb`: pulo na caixa de 2,6 m, agarre de borda, pendura e sobe (Espaço + frente) (4 s).
- `ledgeDrop`: agarre de borda e solta segurando para trás; tenta agarrar de novo (4 s).
- `ledgeHang`: agarre de borda e fica pendurado até o tempo máximo (dreno de stamina) (6 s).
- `ledgeHurt`: pendurado na borda e atingido pelo tackle do rival (4 s).
- `ledgeAi`: IA do vermelho pendura na borda e sobe sozinha (aiClimb) (5 s).
- `navMuro`: navegação: muro entre os lutadores (IA ofensiva persegue) (6 s).
- `navPlataforma`: navegação: alvo em plataforma de 1,5 m (salto) (6 s).
- `navTorre`: navegação: alvo inalcançável no alto (não insiste nem ataca o vazio) (5 s).
- `navCompleto`: navegação: arena completa (muros, corredor, plataformas, zona bloqueada) (8 s).
- `<move>/perto|defesa|longe|contra-ataque|correndo|carga curta|colado|duelo`: o azul usa o Move contra o vermelho em cada estágio (duelo: IA × IA com o Move equipado, 6 s).
- `passiva/<id>`: duelo IA × IA de 5 s com a passiva nos dois lados e vida em 40%.

## Esquiva (C)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `actions.dodge.duration` | Duração · C | s | 0.05 | 8 | 0.01 | 0.657 | src/sim/air.js:25 | muda · dodge |
| `actions.dodge.cost` | Custo de stamina · C | — | 0 | 6 | 0.05 | 1 | src/sim/ai-moves.js:84 | muda · dodge |
| `actions.dodge.invulnerable` | Invulnerabilidade inicial · C | s | 0 | 2 | 0.01 | 0.2 | src/sim/animation-combat-windows.js:279 | pendente (combate) |
| `actions.dodge.distance` | Distância (× duração × velocidade) · C | × | 0 | 12 | 0.05 | 2.05 | src/sim/entity.js:55 | muda · dodge |
| `actions.dodge.curveStart` | Impulso inicial da curva · C | — | 1 | 6 | 0.05 | 1.6 | src/sim/motion.js:10 | pendente (combate) |
| `actions.dodge.steerLimit` | Limite de correção de trajetória · C | ° | 0 | 6.28319 | 0.0174533 | 0.523599 | src/sim/controller/ctrl-update.js:292 | muda · duel |
| `actions.dodge.steerRate` | Velocidade da correção · C | °/s | 0 | 50.2655 | 0.0174533 | 3.14159 | src/sim/controller/ctrl-update.js:293 | muda · duel |
| `actions.dodge.blend` | Transição de velocidade ao iniciar · C | s | 0 | 1 | 0.01 | 0.06 | src/sim/controller/ctrl-update.js:313 | muda · dodge |
| `actions.dodge.chainAfter` | Encadear outra ação após · C | s | 0 | 2 | 0.01 | 0.2 | src/sim/animation-combat-windows.js:277 | pendente (combate) |
| `actions.dodge.recovery` | Recuperação ao terminar · C | s | 0 | 2 | 0.01 | 0 | src/sim/entity.js:49 | muda · dodge |
| `actions.dodge.fromGuard` | Pode sair direto da defesa · C | liga/desliga | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-basico.js:69 | pendente (combate) |
| `actions.dodge.distanceReference` | Tempo de referência da distância · C | s | 0 | 3 | 0.01 | 0.4 | src/sim/entity.js:55 | muda · dodge |
| `actions.dodge.profile` | Curva de movimento · C | seletor | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-update.js:301 | muda · dodge |
| `actions.dodge.fromRecoil` | Pode sair do recuo · C | liga/desliga | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-basico.js:79 | pendente (combate) |
| `actions.dodge.fromGuardStun` | Pode sair do guard stun · C | liga/desliga | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-basico.js:81 | pendente (combate) |
| `actions.dodge.vaultHeight` | Altura do salto · C | m | 0 | 10 | 0.05 | 2.2 | src/sim/air.js:25 | pendente (combate) |
| `actions.dodge.vaultReachBonus` | Alcance extra para saltar · C | m | 0 | 6 | 0.05 | 0.7 | src/sim/controller/ctrl-update.js:389 | pendente (combate) |
| `actions.dodge.vaultForwardMin` | Distância mínima do rival para saltar · C | m | 0 | 4 | 0.05 | 0.1 | src/sim/controller/ctrl-update.js:393 | muda · slam |
| `actions.dodge.vaultLateralWidth` | Largura do caminho para saltar · C | m | 0 | 6 | 0.05 | 1.15 | src/sim/controller/ctrl-update.js:393 | muda · dodge |
| `actions.dodge.perfectEvadeStamina` | Stamina da esquiva perfeita · C | — | 0 | 6 | 0.05 | 0.2 | src/sim/combat.js:146 | pendente (combate) |
| `actions.dodge.counterWindow` | Janela de contra-ataque · C | s | 0 | 4 | 0.01 | 0.55 | src/sim/combat.js:145 | pendente (combate) |
| `actions.dodge.prepTime` | Fase de preparação · C | % | 0 | 0.8 | 0.01 | 0.03 | src/sim/motion.js:16 | muda · dodge |
| `actions.dodge.impulseTime` | Fase de impulso · C | % | 0.02 | 1 | 0.01 | 0.1 | src/sim/motion.js:16 | muda · dodge |
| `actions.dodge.decelStart` | Início da desaceleração · C | % | 0.1 | 1.9 | 0.01 | 0.6 | src/sim/motion.js:16 | muda · dodge |
| `actions.dodge.recoveryTime` | Fase de recuperação · C | % | 0 | 0.8 | 0.01 | 0.1 | src/sim/controller/ctrl-moves.js:291 | muda · dodge |
| `actions.dodge.prepSpeed` | Velocidade na preparação · C | % | 0 | 2 | 0.01 | 0.6 | src/sim/motion.js:17 | muda · dodge |
| `actions.dodge.travelEnd` | Velocidade ao fim do deslocamento · C | % | 0.1 | 2 | 0.01 | 0.78 | src/sim/motion.js:19 | muda · dodge |
| `actions.dodge.selfCancelFromEnd` | C só cancela C nos últimos · C | s | 0 | 3 | 0.01 | 0.1 | src/sim/controller/ctrl-basico.js:78 | pendente (combate) |
| `actions.dodge.vaultPhysics` | Salto sobre o rival como pulo físico · C | liga/desliga | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-update.js:389 | muda · slam |
| `actions.dodge.vaultUp` | Salto: impulso vertical · C | m/s | 0 | 60 | 0.1 | 9 | src/sim/controller/ctrl-update.js:389 | muda · slam |
| `actions.dodge.vaultGravity` | Salto: gravidade · C | m/s² | 1 | 300 | 0.5 | 40 | src/sim/air.js:25 | muda · slam |
| `actions.dodge.vaultHorizontal` | Salto: velocidade horizontal · C | m/s | 0 | 60 | 0.1 | 11 | src/sim/controller/ctrl-update.js:329 | muda · slam |

## Tackle (X)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `actions.tackle.duration` | Duração · X | s | 0.05 | 8 | 0.01 | 1.143 | src/sim/animation-combat-windows.js:248 | muda · tackle |
| `actions.tackle.cost` | Custo de stamina · X | — | 0 | 6 | 0.05 | 1 | src/sim/ai-moves.js:164 | muda · tackle |
| `actions.tackle.invulnerable` | Invulnerabilidade inicial · X | s | 0 | 2 | 0.01 | 0 | src/sim/animation-combat-windows.js:252 | pendente (combate) |
| `actions.tackle.distance` | Distância (× duração × velocidade) · X | × | 0 | 12 | 0.05 | 1.55 | src/sim/controller/ctrl-tackle.js:122 | muda · tackle |
| `actions.tackle.curveStart` | Impulso inicial da curva · X | — | 1 | 6 | 0.05 | 1.6 | src/sim/motion.js:10 | pendente (combate) |
| `actions.tackle.steerLimit` | Limite de correção de trajetória · X | ° | 0 | 6.28319 | 0.0174533 | 0.523599 | src/sim/controller/ctrl-update.js:292 | pendente (combate) |
| `actions.tackle.steerRate` | Velocidade da correção · X | °/s | 0 | 50.2655 | 0.0174533 | 3.14159 | src/sim/controller/ctrl-update.js:293 | pendente (combate) |
| `actions.tackle.blend` | Transição de velocidade ao iniciar · X | s | 0 | 1 | 0.01 | 0.06 | src/sim/controller/ctrl-update.js:313 | muda · tackle |
| `actions.tackle.chainAfter` | Encadear outra ação após · X | s | 0 | 2 | 0.01 | 0.2 | src/sim/animation-combat-windows.js:250 | pendente (combate) |
| `actions.tackle.recovery` | Recuperação ao terminar · X | s | 0 | 2 | 0.01 | 0 | src/sim/entity.js:49 | muda · tackle |
| `actions.tackle.fromGuard` | Pode sair direto da defesa · X | liga/desliga | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-basico.js:69 | pendente (combate) |
| `actions.tackle.distanceReference` | Tempo de referência da distância · X | s | 0 | 3 | 0.01 | 0.4 | src/sim/entity.js:55 | muda · tackle |
| `actions.tackle.profile` | Curva de movimento · X | seletor | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-update.js:301 | muda · tackle |
| `actions.tackle.fromRecoil` | Pode sair do recuo · X | liga/desliga | 0 | 1 | 1 | 0 | src/sim/controller/ctrl-basico.js:79 | pendente (combate) |
| `actions.tackle.fromGuardStun` | Pode sair do guard stun · X | liga/desliga | 0 | 1 | 1 | 0 | src/sim/controller/ctrl-basico.js:81 | pendente (combate) |
| `actions.tackle.counterSpeed` | Multiplicador do X de contra-ataque · X | × | 1 | 4 | 0.01 | 1.18 | src/sim/controller/ctrl-update.js:416 | pendente (combate) |
| `actions.tackle.prepTime` | Fase de preparação · X | % | 0 | 0.8 | 0.01 | 0.04 | src/sim/motion.js:16 | muda · tackle |
| `actions.tackle.impulseTime` | Fase de impulso · X | % | 0.02 | 1 | 0.01 | 0.08 | src/sim/motion.js:16 | muda · tackle |
| `actions.tackle.decelStart` | Início da desaceleração · X | % | 0.1 | 1.9 | 0.01 | 0.55 | src/sim/motion.js:16 | muda · tackle |
| `actions.tackle.recoveryTime` | Fase de recuperação · X | % | 0 | 0.8 | 0.01 | 0.08 | src/sim/motion.js:16 | muda · tackle |
| `actions.tackle.prepSpeed` | Velocidade na preparação · X | % | 0 | 2 | 0.01 | 0.55 | src/sim/motion.js:17 | muda · tackle |
| `actions.tackle.travelEnd` | Velocidade ao fim do deslocamento · X | % | 0.1 | 2 | 0.01 | 0.62 | src/sim/motion.js:19 | muda · tackle |
| `actions.tackle.selfCancel` | X pode cancelar o próprio X · X | liga/desliga | 0 | 1 | 1 | 0 | src/sim/controller/ctrl-basico.js:77 | pendente (combate) |
| `actions.tackle.guardCancel` | Defesa cancela o tackle · X | liga/desliga | 0 | 1 | 1 | 0 | src/sim/controller/ctrl-update.js:181 | pendente (combate) |
| `actions.tackle.perfectGuardCancel` | Toque de defesa perfeita cancela o tackle · X | liga/desliga | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-update.js:181 | pendente (combate) |

## Cancelamento C → X

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `actions.cancel.dodgeToTackle` | Permitir C → X | liga/desliga | 0 | 1 | 1 | 1 | src/sim/animation-combat-windows.js:285 | muda · slam |
| `actions.cancel.windowStart` | Início da janela | s | 0 | 2 | 0.01 | 0.3 | src/sim/animation-combat-windows.js:286 | muda · dodge |
| `actions.cancel.windowEnd` | Fim da janela | s | 0 | 8 | 0.01 | 2.35 | src/sim/controller/ctrl-basico.js:53 | pendente (combate) |
| `actions.cancel.transition` | Transição de velocidade | s | 0 | 1 | 0.01 | 0.06 | src/sim/controller/ctrl-update.js:407 | pendente (combate) |
| `actions.cancel.velocityInfluence` | Influência da velocidade de C | % | 0 | 2 | 0.05 | 1 | src/sim/controller/ctrl-update.js:407 | muda · slam |
| `actions.cancel.airDescent` | Descida no cancelamento aéreo | s | 0 | 2 | 0.01 | 0.18 | src/sim/air.js:47 | pendente (combate) |
| `actions.cancel.invulnerability` | Invulnerabilidade de X no cancelamento | Resto de C | 0 | 2 | 1 | 0 | src/sim/controller/ctrl-update.js:409 | pendente (combate) |
| `actions.cancel.windowMode` | Janela do C → X | seletor | 0 | 1 | 1 | 0 | src/sim/animation-combat-windows.js:286 | muda · dodge |
| `actions.cancel.fromEnd` | C → X: últimos segundos da esquiva | s | 0 | 3 | 0.01 | 0.61 | src/sim/animation-combat-windows.js:286 | pendente (combate) |
| `actions.cancel.perfectAnytime` | C → X a qualquer momento após esquiva perfeita | liga/desliga | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-basico.js:72 | pendente (combate) |

## Buffer de entrada

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `actions.buffer.window` | Janela do buffer de entrada | ms | 0 | 0.6 | 0.01 | 0.1 | src/sim/attempts.js:71 | muda · dodge |

## Regras gerais, defesa e stamina

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `rules.recoil` | Duração do recuo ao defender | s | 0.05 | 8 | 0.01 | 0.61 | src/sim/controller/ctrl-basico.js:79 | muda · guard |
| `rules.recoilFraction` | Distância do recuo | — | 0 | 4 | 0.01 | 0.8 | src/sim/controller/ctrl-update.js:356 | muda · guard |
| `rules.blockPushback` | Repulsão ao bloquear (defensor) (sem efeito) | m | 0 | 10 | 0.05 | 0.5 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `rules.blend` | Suavização entre ações | — | 0 | 4.3 | 0.01 | 0.43 | src/sim/controller/ctrl-update.js:376 | pendente (combate) |
| `rules.guardStun` | Atordoamento após bloqueio | s | 0 | 8 | 0.01 | 0.505 | src/sim/combat.js:189 | muda · guard |
| `rules.hitstun` | Duração da reação a impacto no solo (sem lançamento) | — | 0 | 4 | 0.01 | 0.2 | src/sim/combat.js:204 | pendente (combate) |
| `rules.perfect` | Janela da defesa perfeita | — | 0 | 4 | 0.01 | 0.34 | src/sim/controller/ctrl-update.js:186 | muda · guard |
| `rules.perfectCooldown` | Recarga da defesa perfeita | — | 0 | 20 | 0.05 | 2 | src/sim/controller/ctrl-update.js:164 | muda · duelLong |
| `rules.staminaMax` | Stamina máxima | — | 0.1 | 24 | 1 | 23.1 | src/app/match-flow.js:155 | muda · guard |
| `rules.regenDelay` | Atraso para regenerar | — | 0 | 1 | 0.001 | 0 | src/sim/controller/ctrl-update.js:171 | muda · guard |
| `rules.regenTime` | Tempo de regeneração | — | 0.1 | 20 | 0.05 | 1.4 | src/sim/controller/ctrl-update.js:171 | muda · guard |
| `rules.exhaustMode` | Quando fica exausto | seletor | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-basico.js:36 | muda · duelLong |
| `rules.comboWindow` | Janela de combo após acertar | s | 0 | 4 | 0.05 | 0.7 | src/sim/combat.js:208 | pendente (combate) |
| `rules.guardSpeed` | Velocidade defendendo (%) | — | 0.01 | 60 | 0.01 | 0.6 | src/sim/controller/ctrl-basico.js:21 | muda · duelLong |
| `rules.exhaustedSpeed` | Velocidade exausto (%) | — | 0.01 | 60 | 0.01 | 0.7 | src/sim/controller/ctrl-basico.js:21 | muda · duelLong |
| `rules.guardTurn` | Velocidade máxima de giro defendendo | ° | 0 | 50.2655 | 0.0174533 | 9.42478 | src/sim/controller/ctrl-update.js:271 | muda · duelLong |
| `rules.guardAcceleration` | Aceleração do giro defendendo | ° | 0 | 50.2655 | 0.0174533 | 47.1239 | src/sim/controller/ctrl-update.js:271 | muda · duelLong |

## Tackle carregado (PL)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `rules.tackleFriction1` | Tackle PL1: atrito durante o movimento | /s | 0 | 24 | 0.1 | 1.1 | src/sim/controller/ctrl-update.js:309 | pendente (combate) |
| `rules.tackleFriction2` | Tackle PL2: atrito durante o movimento | /s | 0 | 24 | 0.1 | 1.2 | src/sim/controller/ctrl-update.js:309 | muda · sprint |
| `rules.tackleFriction3` | Tackle PL3: atrito durante o movimento | /s | 0 | 24 | 0.1 | 1 | src/sim/controller/ctrl-update.js:309 | muda · charge |
| `rules.chargeTackleMaxTime` | Tackle carregado: tempo até o PL3 | s | 0.2 | 8 | 0.05 | 1.2 | src/sim/controller/ctrl-tackle.js:15 | muda · charge |
| `rules.chargeTackleDrain` | Tackle carregado: dreno de stamina | /s | 0 | 8 | 0.05 | 0.8 | src/sim/controller/ctrl-tackle.js:61 | muda · charge |
| `rules.chargeTackleMove` | Tackle carregado: velocidade ao andar | % | 0 | 2 | 0.01 | 0.9 | src/sim/controller/ctrl-tackle.js:64 | muda · charge |
| `rules.chargeTackleTurn` | Tackle carregado: giro durante a carga | % | 0 | 2 | 0.01 | 0.25 | src/sim/controller/ctrl-tackle.js:66 | pendente (combate) |
| `rules.chargeTackleSpeed2` | Tackle PL2: velocidade e alcance | × | 1 | 6 | 0.01 | 1.94 | src/sim/controller/ctrl-tackle.js:19 | muda · sprint |
| `rules.chargeTackleSpeed3` | Tackle PL3: velocidade e alcance | × | 1 | 8 | 0.01 | 2.71 | src/sim/controller/ctrl-tackle.js:19 | muda · charge |
| `rules.chargeTackleDamage2` | Tackle PL2: dano | × | 1 | 8 | 0.01 | 1.3 | src/sim/controller/ctrl-tackle.js:20 | pendente (combate) |
| `rules.chargeTackleDamage3` | Tackle PL3: dano | × | 1 | 12 | 0.01 | 1.7 | src/sim/controller/ctrl-tackle.js:20 | muda · charge |
| `rules.sprintTacklePL` | X no sprint: PL do tackle | PL | 1 | 3 | 1 | 2 | src/sim/controller/ctrl-update.js:233 | muda · sprint |

## Finta (esquiva rápida)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `rules.feintWindow` | Finta: janela de startup | s | 0 | 1 | 0.01 | 0.33 | src/sim/controller/ctrl-update.js:141 | muda · feint |
| `rules.feintMinAngle` | Finta: ângulo mínimo da direção | ° | 0 | 360 | 1 | 60 | src/sim/controller/ctrl-tackle.js:32 | muda · feint |
| `rules.feintDuration` | Finta: duração (× da esquiva) | % | 0.2 | 3 | 0.01 | 0.8 | src/sim/controller/ctrl-tackle.js:48 | muda · feint |
| `rules.feintDistance` | Finta: distância (× da esquiva) | × | 0.2 | 4 | 0.01 | 1 | src/sim/controller/ctrl-tackle.js:48 | muda · feint |
| `rules.feintCost` | Finta: custo de stamina | — | 0 | 8 | 0.05 | 1.6 | src/sim/controller/ctrl-tackle.js:35 | muda · feint |
| `rules.feintFxOn` | Finta: efeitos amarelos de esquiva | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:228 | visual/depuração |
| `rules.feintFxIntensity` | Finta: intensidade dos efeitos | × | 0 | 6 | 0.05 | 1 | src/view/solid-fx.js:230 | visual/depuração |
| `rules.feintFxSize` | Finta: tamanho dos efeitos | × | 0.2 | 6 | 0.05 | 1 | src/view/solid-fx.js:230 | visual/depuração |
| `rules.feintFxColor` | Finta: cor dos efeitos (amarelo → laranja) | % | 0 | 2 | 0.01 | 0.5 | src/view/solid-fx.js:229 | visual/depuração |

## Wall-splat e meteor slam

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `rules.wallSplatMinSpeed` | Wall-splat: velocidade mínima | m/s | 0 | 60 | 0.5 | 6 | src/sim/physics.js:32 | muda · wall |
| `rules.wallSplatDuration` | Wall-splat: duração | s | 0.1 | 4 | 0.01 | 0.7 | src/sim/physics.js:34 | muda · wall |
| `rules.wallSplatDamage` | Wall-splat: dano extra | HP | 0 | 60 | 0.5 | 0 | src/sim/physics.js:534 | muda · wall |
| `rules.slamAngle` | Meteor slam: ângulo do mergulho (sem efeito) | ° | 0.174533 | 2.79253 | 0.0174533 | 0.785398 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `rules.slamMinHeight` | Meteor slam: altura mínima do C → X | m | 0 | 4 | 0.05 | 0.3 | src/sim/controller/ctrl-basico.js:73 | muda · slam |
| `rules.slamDamage` | Meteor slam: dano | × | 1 | 8 | 0.01 | 1 | src/sim/controller/ctrl-tackle.js:127 | muda · slam |
| `rules.slamSpeedLoss` | Meteor slam: velocidade perdida na preparação | % | 0 | 2 | 0.01 | 0.6 | src/sim/controller/ctrl-update.js:322 | muda · slam |
| `rules.slamRingOn` | Meteor slam: anel de fogo no chão | liga/desliga | 0 | 1 | 1 | 1 | src/view/meteor-fx.js:126 | visual/depuração |
| `rules.slamRingStart` | Meteor slam: raio inicial do anel | m | 0.1 | 6 | 0.05 | 0.6 | src/view/meteor-fx.js:108 | visual/depuração |
| `rules.slamRingRadius` | Meteor slam: raio final do anel | m | 0.5 | 24 | 0.1 | 4 | src/view/meteor-fx.js:108 | visual/depuração |
| `rules.slamRingDuration` | Meteor slam: duração do anel | s | 0.1 | 5 | 0.01 | 0.7 | src/view/meteor-fx.js:107 | visual/depuração |
| `rules.slamRingThickness` | Meteor slam: espessura do anel | % | 0.05 | 2 | 0.01 | 0.35 | src/view/meteor-fx.js:99 | visual/depuração |
| `rules.slamRingIntensity` | Meteor slam: brilho do anel | × | 0 | 6 | 0.05 | 1 | src/view/meteor-fx.js:110 | visual/depuração |
| `rules.slamRingOpacity` | Meteor slam: opacidade inicial do anel | % | 0 | 2 | 0.01 | 0.9 | src/view/meteor-fx.js:110 | visual/depuração |
| `rules.slamRingFade` | Meteor slam: queda da opacidade com a duração | % | 0 | 2 | 0.01 | 1 | src/view/meteor-fx.js:110 | visual/depuração |
| `rules.slamFxOn` | Meteor slam: efeito de fogo na queda | liga/desliga | 0 | 1 | 1 | 1 | src/view/meteor-fx.js:129 | visual/depuração |
| `rules.slamFxSize` | Meteor slam: largura do fogo | × | 0.2 | 8 | 0.05 | 1 | src/view/meteor-fx.js:138 | visual/depuração |
| `rules.slamFxLength` | Meteor slam: tamanho (altura) do fogo | × | 0.2 | 10 | 0.05 | 1.45 | src/view/meteor-fx.js:138 | visual/depuração |
| `rules.slamFxIntensity` | Meteor slam: brilho do fogo | × | 0 | 6 | 0.05 | 1 | src/view/meteor-fx.js:145 | visual/depuração |
| `rules.slamFxHeat` | Meteor slam: cor (vermelho → branco) | % | 0 | 2 | 0.01 | 0.5 | src/view/meteor-fx.js:82 | visual/depuração |
| `rules.slamFxSparks` | Meteor slam: quantidade de faíscas | × | 0 | 8 | 0.05 | 1 | src/view/meteor-fx.js:150 | visual/depuração |
| `rules.slamFxFlicker` | Meteor slam: tremulação das chamas | % | 0 | 2 | 0.01 | 0.5 | src/view/meteor-fx.js:135 | visual/depuração |
| `rules.slamFxFadeOut` | Meteor slam: dissipação ao aterrissar | s | 0 | 3 | 0.01 | 0.25 | src/view/meteor-fx.js:130 | visual/depuração |
| `rules.slamGroundTime` | Meteor slam: estado no chão | s | 0 | 4 | 0.01 | 0.45 | src/sim/controller/ctrl-update.js:444 | muda · slam |
| `rules.slamGroundRadius` | Meteor slam: alcance do impacto no chão | m | 0.5 | 8 | 0.05 | 1.4 | src/sim/physics.js:566 | muda · slam |
| `rules.slamPrepTime` | Meteor slam: preparação no ar | s | 0 | 3 | 0.01 | 0.5 | src/sim/controller/ctrl-tackle.js:93 | muda · slam |
| `rules.slamHop` | Meteor slam: altura da preparação | m | 0 | 6 | 0.05 | 0.8 | src/sim/controller/ctrl-update.js:341 | muda · slam |
| `rules.slamFallTime` | Meteor slam: tempo de queda | s | 0 | 1.2 | 0.01 | 0.12 | src/sim/controller/ctrl-update.js:321 | muda · slam |
| `rules.slamImpactScale` | Meteor slam: tamanho do efeito de impacto no chão | × | 0.5 | 6 | 0.05 | 1.2 | src/view/quarks/bridge.js:74 | pendente (combate) |
| `rules.slamImpactShake` | Meteor slam: tremor da câmera no impacto | × | 0 | 6 | 0.05 | 1.2 | src/view/vfx.js:243 | pendente (combate) |
| `rules.slamRecovery` | Meteor slam: recuperação ao errar | s | 0 | 4 | 0.01 | 0.6 | src/sim/controller/ctrl-update.js:444 | pendente (combate) |
| `rules.slamLaunchHorizontal` | Ground bounce: empurrão horizontal | % | 0 | 2 | 0.01 | 0.4 | src/sim/combat.js:199 | muda · slam |
| `rules.groundBounceForce` | Ground bounce: força do quique | m/s | 0 | 60 | 0.5 | 9 | src/sim/combat.js:199 | muda · slam |
| `rules.slamBlockPushDistance` | Meteor slam bloqueado: distância do empurrão | m | 3 | 20 | 0.1 | 5 | src/sim/combat.js:180 | pendente (combate) |

## Knockback e clash

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `rules.launchGravity` | Gravidade de lançamento | — | 0.5 | 120 | 0.1 | 39.6 | src/app/live-panels.js:23 | muda · flight |
| `rules.launchUp` | Força vertical do impacto | — | 0 | 120 | 0.1 | 7.1 | src/sim/combat.js:199 | muda · tackle |
| `rules.launchHorizontal` | Força horizontal do impacto | — | 0 | 120 | 0.1 | 19.3 | src/sim/combat.js:195 | muda · tackle |
| `rules.launchDrag` | Arrasto no voo | — | 0 | 20 | 0.05 | 1.15 | src/sim/physics.js:323 | muda · flight |
| `rules.clashFraction` | Dano de clash (%) | — | 0 | 4 | 0.01 | 0.3 | src/sim/combat.js:56 | muda · clash |
| `rules.clashUp` | Força vertical do clash | — | 0 | 120 | 0.1 | 8.1 | src/sim/combat.js:62 | pendente (combate) |
| `rules.clashHorizontal` | Força horizontal do clash | — | 0 | 120 | 0.1 | 12 | src/sim/combat.js:62 | pendente (combate) |
| `rules.clashPushDistance` | Clash por empurrão: distância | m | 0 | 16 | 0.1 | 2.2 | src/sim/combat.js:61 | muda · clash |
| `rules.clashPushDuration` | Clash por empurrão: duração | s | 0.1 | 2.4 | 0.01 | 0.35 | src/sim/combat.js:61 | muda · clash |
| `rules.techWindow` | Recovery rápido: janela | s | 0.05 | 3 | 0.01 | 0.35 | src/sim/controller/ctrl-tackle.js:135 | pendente (combate) |
| `rules.techMinAir` | Recovery rápido: tempo mínimo de voo | s | 0 | 3 | 0.01 | 0 | src/sim/controller/ctrl-tackle.js:135 | muda · flight |
| `rules.techCost` | Recovery rápido: custo de stamina | — | 0 | 4 | 0.05 | 1 | src/sim/controller/ctrl-update.js:157 | muda · flight |
| `rules.landingRecovery` | Recuperação após aterrissar | s | 0 | 8 | 0.01 | 0.467 | src/sim/physics.js:251 | muda · tackle |
| `rules.wallRestitution` | Rebote na parede: horizontal | × | 0 | 4 | 0.01 | 0.28 | src/sim/map/map-collision.js:30 | muda · wallBounce |
| `rules.wallBounceVertical` | Rebote na parede: vertical (× velocidade vertical) | × | -1 | 4 | 0.01 | 1 | src/sim/physics.js:25 | muda · wallBounce |
| `rules.wallBounceUp` | Rebote na parede: impulso vertical | m/s | 0 | 40 | 0.1 | 0 | src/sim/physics.js:25 | muda · wallBounce |

## Combate e colisões

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `extras.combat.vaultCollisionHeight` | Altura de atravessamento | — | 0 | 20 | 0.05 | 1.3 | src/sim/physics.js:33 | pendente (combate) |
| `extras.combat.tackleTargetAlignment` | Alinhamento do tackle ao alvo | — | -1 | 4 | 0.01 | 0.15 | src/sim/combat.js:81 | muda · tackle |
| `extras.combat.tackleNormalAlignment` | Alinhamento da normal do tackle | — | -1 | 4 | 0.01 | 0 | src/sim/combat.js:81 | muda · tackle |
| `extras.combat.tackleClosingSpeed` | Aproximação mínima do tackle | — | 0.01 | 60 | 0.01 | 0.06 | src/sim/combat.js:81 | muda · tackle |
| `extras.combat.clashFacingAlignment` | Alinhamento para clash | — | -1 | 4 | 0.01 | 0.2 | src/sim/combat.js:26 | pendente (combate) |
| `extras.combat.clashClosingSpeed` | Aproximação mínima no clash | — | 0.01 | 60 | 0.01 | 0.06 | src/sim/combat.js:26 | pendente (combate) |
| `extras.combat.guardFrontAlignment` | Ângulo válido para defesa | — | -1 | 4 | 0.01 | 0 | src/sim/combat.js:157 | muda · guard |
| `extras.combat.guardDamageMultiplier` | Multiplicador de dano bloqueado | — | 0 | 4 | 0.01 | 0.5 | src/sim/resolvers/damage-resolver.js:81 | muda · guard |
| `extras.combat.launchAttackBase` | Base de força do lançamento | — | 0 | 4 | 0.01 | 0.85 | src/sim/combat.js:195 | muda · tackle |
| `extras.combat.launchAttackWeight` | Peso do ataque no lançamento | — | 0 | 4 | 0.01 | 0.15 | src/sim/combat.js:195 | muda · tackle |
| `extras.combat.launchAttackReference` | Referência de ataque para força | — | 0.01 | 160 | 0.5 | 20 | src/sim/combat.js:195 | muda · tackle |
| `extras.combat.launchClosingCap` | Limite de bônus por velocidade | — | 0 | 20 | 0.05 | 2 | src/sim/combat.js:195 | muda · tackle |
| `extras.combat.launchClosingMultiplier` | Velocidade → força | — | 0 | 4 | 0.01 | 0.1 | src/sim/combat.js:195 | muda · tackle |
| `extras.combat.launchNormalWeight` | Peso da normal de contato | — | 0 | 4 | 0.01 | 0.75 | src/sim/combat.js:197 | pendente (combate) |
| `extras.combat.launchCenterWeight` | Peso da direção entre centros | — | 0 | 4 | 0.01 | 0.25 | src/sim/combat.js:197 | pendente (combate) |
| `extras.combat.contactProjectionPasses` | Passagens para separar colisores | — | 1 | 20 | 1 | 4 | src/sim/physics.js:467 | pendente (combate) |
| `extras.combat.clashHitstop` | Hitstop do clash (X×X) | — | 0 | 1 | 0.001 | 0.033 | src/sim/game.js:113 | muda · clash |
| `extras.combat.impactHitstop` | Hitstop dos impactos comuns | — | 0 | 1 | 0.001 | 0.008 | src/sim/game.js:117 | muda · tackle |
| `extras.combat.hitstopDamageBoost` | Hitstop por dano: acréscimo no golpe forte | Desligado (hitstop fixo) | 0 | 6 | 0.1 | 0 | src/sim/game.js:117 | muda · tackle |
| `extras.combat.hitstopDamageRef` | Hitstop por dano: dano de referência (HP) | HP | 5 | 200 | 1 | 30 | src/sim/game.js:117 | pendente (combate) |
| `extras.combat.perfectGuardCounterWindow` | Janela de contra-ataque após defesa perfeita | — | 0 | 20 | 0.05 | 1.98 | src/sim/combat.js:185 | pendente (combate) |
| `extras.combat.exhaustRecovery` | Recuperação extra ao esgotar a stamina | — | 0 | 4 | 0.01 | 0.15 | src/sim/controller/ctrl-update.js:448 | pendente (combate) |
| `extras.combat.guardRegenFactor` | Regeneração de stamina defendendo (×) | — | 0 | 7 | 0.01 | 0.7 | src/sim/controller/ctrl-update.js:170 | pendente (combate) |
| `extras.combat.landingSkidFraction` | Deslize ao aterrissar: fração da velocidade | — | 0 | 4 | 0.01 | 0.34 | src/sim/physics.js:245 | muda · tackle |
| `extras.combat.landingSkidDrag` | Deslize ao aterrissar: atrito | — | 0 | 64 | 0.05 | 8 | src/sim/physics.js:427 | muda · tackle |
| `extras.combat.landingSkidMin` | Deslize ao aterrissar: velocidade mínima | — | 0 | 1.28 | 0.001 | 0.08 | src/sim/physics.js:428 | muda · tackle |

## Atributos: equilibrado

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `profiles.balanced.attack` | Ataque base | — | 0 | 400 | 1 | 20 | src/sim/combat.js:56 | muda · tackle |
| `profiles.balanced.defense` | Defesa base (sem efeito) | — | 0 | 400 | 1 | 50 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `profiles.balanced.speed` | Velocidade base | — | 0.01 | 60 | 0.01 | 4.19 | src/sim/controller/ctrl-basico.js:21 | muda · tackle |
| `profiles.balanced.hp` | Vida máxima base | — | 1 | 1600 | 1 | 100 | src/app/tuning-sync.js:35 | muda · tackle |

## Atributos: ágil

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `profiles.agile.attack` | Ataque base | — | 0 | 400 | 1 | 16 | src/sim/combat.js:56 | muda · duelAgile |
| `profiles.agile.defense` | Defesa base (sem efeito) | — | 0 | 400 | 1 | 35 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `profiles.agile.speed` | Velocidade base | — | 0.01 | 60 | 0.01 | 6 | src/sim/controller/ctrl-basico.js:21 | muda · duelAgile |
| `profiles.agile.hp` | Vida máxima base | — | 1 | 1600 | 1 | 100 | src/app/tuning-sync.js:35 | muda · duelAgile |

## Atributos: resistente

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `profiles.resistant.attack` | Ataque base | — | 0 | 400 | 1 | 24 | src/sim/combat.js:56 | muda · duelResistant |
| `profiles.resistant.defense` | Defesa base (sem efeito) | — | 0 | 400 | 1 | 80 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `profiles.resistant.speed` | Velocidade base | — | 0.01 | 60 | 0.01 | 4.08 | src/sim/controller/ctrl-basico.js:21 | muda · duelResistant |
| `profiles.resistant.hp` | Vida máxima base | — | 1 | 1600 | 1 | 100 | src/app/tuning-sync.js:35 | muda · duelResistant |

## Movimento

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `locomotion.acceleration` | Aceleração | m/s² | 1 | 400 | 0.5 | 40 | src/sim/controller/ctrl-basico.js:18 | muda · sprint |
| `locomotion.braking` | Frenagem | m/s² | 1 | 400 | 0.5 | 34 | src/sim/controller/ctrl-basico.js:18 | pendente (combate) |
| `locomotion.reversal` | Inversão (desaceleração contra o movimento) | m/s² | 1 | 600 | 0.5 | 62 | src/sim/controller/ctrl-basico.js:17 | pendente (combate) |
| `locomotion.turnRate` | Giro do personagem | ° | 0 | 50.2655 | 0.0174533 | 18.8496 | src/sim/controller/ctrl-basico.js:40 | muda · duel |
| `locomotion.visualTurnRate` | Giro do indicador visual | ° | 0 | 50.2655 | 0.0174533 | 21.9911 | src/sim/controller/ctrl-update.js:382 | visual/depuração |
| `locomotion.model` | Modelo de locomoção | seletor | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-basico.js:41 | muda · sprint |
| `locomotion.accelCurve` | Curva da aceleração | — | 0 | 1.9 | 0.01 | 0.55 | src/sim/controller/ctrl-basico.js:17 | muda · sprint |
| `locomotion.brakeCurve` | Curva da frenagem | — | 0 | 1.9 | 0.01 | 0.5 | src/sim/controller/ctrl-basico.js:17 | pendente (combate) |
| `locomotion.friction` | Atrito | — | 0 | 20 | 0.05 | 1.95 | src/sim/controller/ctrl-basico.js:17 | pendente (combate) |
| `locomotion.turnGrip` | Resistência à mudança de direção (aderência lateral) | m/s² | 1 | 400 | 0.5 | 52 | src/sim/controller/ctrl-basico.js:18 | muda · duel |
| `locomotion.residualSpeed` | Velocidade residual | m/s | 0 | 4 | 0.01 | 0.35 | src/sim/controller/ctrl-basico.js:17 | pendente (combate) |
| `locomotion.turnAcceleration` | Aceleração angular do giro | rad/s² | 1 | 800 | 1 | 160 | src/sim/controller/ctrl-basico.js:40 | muda · duel |
| `locomotion.moveFrame` | Referencial das setas com lock-on | seletor | 0 | 1 | 1 | 0 | src/ui/input.js:15 | pendente (combate) |
| `locomotion.frameLatch` | Travar o referencial enquanto a seta é mantida | liga/desliga | 0 | 1 | 1 | 1 | src/ui/input.js:31 | pendente (combate) |
| `locomotion.lockFacing` | Orientação do corpo com lock-on | seletor | 0 | 2 | 1 | 2 | src/sim/controller/ctrl-update.js:263 | muda · duel |
| `locomotion.stopThreshold` | Limiar das animações de freio | % | 0 | 2 | 0.01 | 0.55 | src/view/characters.js:541 | pendente (combate) |
| `locomotion.lockTackleHoming` | Lock-on: tackle sempre rumo ao oponente | liga/desliga | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-update.js:401 | pendente (combate) |

## Câmera

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `camera.distance` | Distância inicial | — | 0 | 24.8 | 0.05 | 6.2 | src/view/rig.js:10 | visual/depuração |
| `camera.height` | Altura da câmera | — | 0 | 10 | 0.05 | 2.2 | src/view/rig.js:53 | visual/depuração |
| `camera.lookHeight` | Altura do ponto focal | — | 0 | 10 | 0.05 | 1.1 | src/view/rig.js:54 | visual/depuração |
| `camera.lookAhead` | Antecipação do olhar | — | 0 | 10 | 0.05 | 1.8 | src/view/rig.js:54 | visual/depuração |
| `camera.followResponse` | Resposta ao acompanhar | — | 0 | 48 | 0.05 | 12 | src/view/rig.js:33 | visual/depuração |
| `camera.distanceResponse` | Resposta do zoom | — | 0 | 20 | 0.05 | 5 | src/view/rig.js:48 | visual/depuração |
| `camera.yawResponse` | Resposta de rotação | — | 0 | 12 | 0.05 | 3 | src/view/rig.js:32 | visual/depuração |
| `camera.maxTurnRate` | Giro máximo da câmera | ° | 0 | 25.1327 | 0.0174533 | 1.2083 | src/view/rig.js:31 | visual/depuração |
| `camera.deadZone` | Zona morta da mira | ° | 0 | 3.14159 | 0.0174533 | 0.349066 | src/view/rig.js:23 | visual/depuração |
| `camera.movingDeadZone` | Zona morta em movimento | ° | 0 | 3.14159 | 0.0174533 | 1.0472 | src/view/rig.js:23 | visual/depuração |
| `camera.closeRange` | Alvo muito próximo | — | 0 | 10 | 0.05 | 1.3 | src/view/rig.js:22 | visual/depuração |
| `camera.initialYaw` | Ângulo inicial da câmera | ° | 0 | 6.28319 | 0.0174533 | 3.34159 | src/view/rig.js:10 | visual/depuração |
| `camera.shoulder` | Deslocamento de ombro | — | 0 | 2.25 | 0.01 | 0.45 | src/view/rig.js:51 | visual/depuração |
| `camera.framingRange` | Distância de enquadramento | — | 0 | 24 | 0.05 | 6 | src/view/rig.js:43 | visual/depuração |
| `camera.distanceScale` | Zoom por separação | — | 0 | 2 | 0.01 | 0.35 | src/view/rig.js:43 | visual/depuração |
| `camera.manualHold` | Tempo de órbita manual | — | 0 | 10 | 0.05 | 1.5 | src/view/rig.js:13 | visual/depuração |
| `camera.minDistance` | Distância mínima da câmera | — | 0.1 | 19.2 | 0.05 | 4.8 | src/view/rig.js:14 | visual/depuração |
| `camera.maxDistance` | Distância máxima da câmera | — | 0.2 | 96 | 0.5 | 24 | src/view/rig.js:14 | visual/depuração |

## Câmera: ajustes avançados

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `extras.cameraExtra.idleAlignDelay` | Tempo para recentralizar câmera | — | 0 | 4.25 | 0.01 | 0.85 | src/view/rig.js:29 | visual/depuração |
| `extras.cameraExtra.idleAlignSpeed` | Velocidade de recentralização | — | 0.01 | 30 | 0.01 | 1.5 | src/view/rig.js:29 | visual/depuração |
| `extras.cameraExtra.unlockedTurnMultiplier` | Velocidade sem lock-on | — | 0 | 2 | 0.01 | 1.2 | src/view/rig.js:31 | visual/depuração |
| `extras.cameraExtra.verticalFollow` | Seguimento vertical | — | 0 | 28 | 0.05 | 7 | src/view/rig.js:39 | visual/depuração |
| `extras.cameraExtra.flightZoomFactor` | Zoom quando voando | — | 0 | 2 | 0.01 | 0.18 | src/view/rig.js:47 | visual/depuração |
| `extras.cameraExtra.flightHeightFactor` | Elevação da câmera no voo | — | 0 | 2.1 | 0.01 | 0.42 | src/view/rig.js:53 | visual/depuração |
| `extras.cameraExtra.flightLookFactor` | Elevação do olhar no voo | — | 0 | 2 | 0.01 | 0.4 | src/view/rig.js:54 | visual/depuração |
| `extras.cameraExtra.orbitSensitivity` | Sensibilidade do mouse | — | 0 | 0.5 | 0.001 | 0.006 | src/view/view.js:107 | visual/depuração |
| `extras.cameraExtra.wheelSensitivity` | Sensibilidade da roda | — | 0 | 0.5 | 0.001 | 0.01 | src/view/view.js:109 | visual/depuração |
| `extras.cameraExtra.fov` | Campo de visão (FOV) | ° | 20 | 120 | 1 | 48 | src/view/cinematic-camera.js:908 | visual/depuração |
| `extras.cameraExtra.nearClip` | Plano de corte próximo | — | 0.01 | 2 | 0.01 | 0.1 | src/view/view.js:62 | visual/depuração |
| `extras.cameraExtra.farClip` | Plano de corte distante | m | 10 | 1000 | 5 | 100 | src/view/view.js:62 | visual/depuração |
| `extras.cameraExtra.lockTargetBias` | Lock-on: foco rumo ao rival | — | 0 | 2 | 0.01 | 0.28 | src/view/rig.js:41 | visual/depuração |
| `extras.cameraExtra.lockBiasLimit` | Lock-on: deslocamento máximo do olhar | — | 0 | 18.8 | 0.05 | 4.7 | src/view/rig.js:41 | visual/depuração |
| `extras.cameraExtra.framingSeparationFactor` | Afastamento pela separação dos lutadores | — | 0 | 2.25 | 0.01 | 0.45 | src/view/rig.js:44 | visual/depuração |
| `extras.cameraExtra.framingPadding` | Margem de enquadramento no lock-on | — | 0 | 10 | 0.05 | 1.2 | src/view/rig.js:44 | visual/depuração |
| `extras.cameraExtra.cameraShakeAmount` | Tremor da câmera: intensidade | — | 0 | 2 | 0.01 | 0.12 | src/view/view.js:229 | visual/depuração |
| `extras.cameraExtra.cameraShakeDecay` | Tremor da câmera: dissipação | — | 0 | 40 | 0.05 | 10 | src/view/view.js:228 | visual/depuração |

## IA: estratégia e decisões

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `extras.ai.revision` | Revisão da IA (0 anterior · 1 revisada · 2 evoluída) (sem efeito) | — | 0 | 10 | 0.05 | 1 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `extras.ai.sprintReserve` | Reserva de stamina ao correr (IA) | — | 0 | 1.5 | 0.05 | 0.2 | src/sim/tactics.js:452 | muda · duelLong |
| `extras.ai.sprintMargin` | Distância para correr (IA) | m | -3 | 3 | 0.1 | 0 | src/sim/spatial.js:218 | muda · duel |
| `extras.ai.useCharge` | IA usa o tackle carregado | liga/desliga | 0 | 1 | 1 | 1 | src/sim/tactics.js:439 | muda · duel |
| `extras.ai.useFeint` | IA usa a finta | liga/desliga | 0 | 1 | 1 | 1 | src/sim/tactics.js:293 | muda · duelLong |
| `extras.ai.wallEscape` | IA foge do wall-splat | liga/desliga | 0 | 1 | 1 | 1 | src/sim/tactics.js:144 | pendente (ia) |
| `extras.ai.chargeMargin` | IA: margem de segurança da carga | s | 0 | 1 | 0.01 | 0.25 | src/sim/tactics.js:442 | muda · duel |
| `extras.ai.chargeChance` | IA: chance de carregar | % | 0 | 1 | 0.01 | 0.8 | src/sim/tactics.js:444 | muda · duel |
| `extras.ai.feintChance` | IA: chance de fintar | % | 0 | 1 | 0.01 | 0.5 | src/sim/tactics.js:295 | muda · duelLong |
| `extras.ai.moveSmoothing` | Suavização da intenção de movimento (IA) | rad/s | 0 | 40 | 0.5 | 10 | src/sim/ai.js:61 | muda · duel |
| `extras.ai.minDirectionHold` | Retenção contra zigue-zague (IA) | s | 0 | 0.6 | 0.01 | 0.18 | src/sim/ai.js:73 | muda · duel |
| `extras.ai.initialCooldown` | Primeira decisão da IA | — | 0 | 3 | 0.01 | 0.6 | src/sim/ai.js:45 | muda · duel |
| `extras.ai.orbitChangePeriod` | Tempo de troca de lado | — | 0 | 10 | 0.05 | 1.7 | src/sim/ai.js:91 | pendente (ia) |
| `extras.ai.threatAlignment` | Alinhamento de ameaça | — | -1 | 2 | 0.01 | 0.3 | src/sim/ai.js:29 | muda · duelLong |
| `extras.ai.threatDistance` | Raio de ameaça | — | 0 | 19.2 | 0.05 | 4.8 | src/sim/ai.js:100 | pendente (ia) |
| `extras.ai.defensiveRetreatDistance` | Recuo na defesa: distância | — | 0 | 10 | 0.05 | 2.4 | src/sim/ai.js:128 | pendente (ia) |
| `extras.ai.defensiveRetreatStrength` | Recuo na defesa: intensidade | — | 0 | 2 | 0.01 | 0.5 | src/sim/ai.js:128 | pendente (ia) |
| `extras.ai.reactiveRetreatStrength` | Recuo ao detectar ataque | — | 0 | 2 | 0.01 | 0.2 | src/sim/ai.js:134 | pendente (ia) |
| `extras.ai.approachDistance` | Distância para se aproximar | — | 0 | 12 | 0.05 | 3 | src/sim/ai.js:151 | pendente (ia) |
| `extras.ai.retreatDistance` | Distância para se afastar | — | 0 | 10 | 0.05 | 1.35 | src/sim/ai.js:152 | pendente (ia) |
| `extras.ai.retreatStrength` | Intensidade do recuo | — | 0 | 2 | 0.01 | 0.65 | src/sim/ai.js:152 | pendente (ia) |
| `extras.ai.strafeStrength` | Intensidade do movimento lateral | — | 0 | 2 | 0.01 | 0.72 | src/sim/ai.js:153 | pendente (ia) |
| `extras.ai.wallPrediction` | Previsão de parede | — | 0 | 4 | 0.01 | 0.8 | src/sim/ai.js:155 | pendente (ia) |
| `extras.ai.wallMargin` | Margem da parede | — | 0 | 10 | 0.05 | 1 | src/sim/ai.js:156 | pendente (ia) |
| `extras.ai.attackRange` | Alcance para atacar | — | 0 | 13.4 | 0.05 | 3.35 | src/sim/ai.js:157 | pendente (ia) |
| `extras.ai.combatAttackCooldown` | Intervalo de tackles da IA | — | 0 | 10 | 0.05 | 1.1 | src/sim/ai.js:125 | pendente (ia) |
| `extras.ai.lowStaminaThreshold` | Stamina crítica da IA | — | 0 | 4.75 | 0.01 | 0.95 | src/sim/ai.js:166 | pendente (ia) |
| `extras.ai.lowStaminaDistance` | Distância para recuar sem stamina | — | 0 | 10 | 0.05 | 2.5 | src/sim/ai.js:166 | pendente (ia) |
| `extras.ai.lowStaminaRetreat` | Força do recuo sem stamina | — | 0 | 3.5 | 0.01 | 0.7 | src/sim/ai.js:166 | pendente (ia) |
| `extras.ai.evadeCycle` | Ciclo de decisões evasivas | — | 1 | 12 | 1 | 3 | src/sim/ai.js:132 | pendente (ia) |
| `extras.ai.evadeCycleIndex` | Passo evasivo do ciclo | — | 0 | 12 | 1 | 2 | src/sim/ai.js:132 | pendente (ia) |

## IA: personalidade do vermelho

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `extras.aiRed.reaction` | Tempo de reação | — | 0 | 2 | 0.01 | 0.16 | src/sim/ai.js:104 | pendente (ia) |
| `extras.aiRed.reactionJitter` | Variação do tempo de reação | — | 0 | 2 | 0.01 | 0.14 | src/sim/ai.js:104 | pendente (ia) |
| `extras.aiRed.mistake` | Chance de erro | — | 0 | 2 | 0.01 | 0.16 | src/sim/ai.js:104 | pendente (ia) |
| `extras.aiRed.aggression` | Agressividade | — | 0 | 2.25 | 0.01 | 0.45 | src/sim/ai.js:157 | pendente (ia) |
| `extras.aiRed.variation` | Variação de ritmo | — | 0 | 2.25 | 0.01 | 0.45 | src/sim/ai.js:95 | muda · duel |
| `extras.aiRed.hesitation` | Hesitação (por segundo) | — | 0 | 2 | 0.01 | 0.3 | src/sim/ai.js:169 | pendente (ia) |
| `extras.aiRed.evadeChance` | Preferência por esquivar | — | 0 | 2 | 0.01 | 0.35 | src/sim/ai.js:104 | pendente (ia) |
| `extras.aiRed.style` | Estilo de luta (IA tática) | Sorteado por partida | 0 | 6 | 1 | 0 | src/ui/ai-eval-panel.js:27 | muda · duel |
| `extras.aiRed.adaptation` | Adaptação ao adversário (IA tática) | — | 0 | 2.75 | 0.01 | 0.55 | src/sim/tactics.js:122 | pendente (ia) |

## IA: personalidade do azul (IA jogador)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `extras.aiBlue.reaction` | Tempo de reação | — | 0 | 2 | 0.01 | 0.1 | src/sim/ai.js:104 | muda · duelLong |
| `extras.aiBlue.reactionJitter` | Variação do tempo de reação | — | 0 | 2 | 0.01 | 0.12 | src/sim/ai.js:104 | muda · duelLong |
| `extras.aiBlue.mistake` | Chance de erro | — | 0 | 2 | 0.01 | 0.1 | src/sim/ai.js:104 | pendente (ia) |
| `extras.aiBlue.aggression` | Agressividade | — | 0 | 3.1 | 0.01 | 0.62 | src/sim/ai.js:157 | muda · duel |
| `extras.aiBlue.variation` | Variação de ritmo | — | 0 | 2 | 0.01 | 0.4 | src/sim/ai.js:95 | muda · duel |
| `extras.aiBlue.hesitation` | Hesitação (por segundo) | — | 0 | 2 | 0.01 | 0.15 | src/sim/ai.js:169 | muda · duel |
| `extras.aiBlue.evadeChance` | Preferência por esquivar | — | 0 | 2.5 | 0.01 | 0.5 | src/sim/ai.js:104 | pendente (ia) |
| `extras.aiBlue.style` | Estilo de luta (IA tática) | Sorteado por partida | 0 | 6 | 1 | 0 | src/ui/ai-eval-panel.js:27 | muda · duel |
| `extras.aiBlue.adaptation` | Adaptação ao adversário (IA tática) | — | 0 | 3.5 | 0.01 | 0.7 | src/sim/tactics.js:122 | pendente (ia) |

## Arena e simulação

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `test.step` | Intervalo de simulação | ms | 0.00416667 | 0.0333333 | 0.0000416667 | 0.00833333 | src/app/live-panels.js:208 | muda · tackle |
| `test.maxFrame` | Maior quadro admitido | — | 0 | 2 | 0.01 | 0.1 | src/sim/game.js:229 | pendente (tecnico) |
| `test.arenaRadius` | Raio da arena circular (m) | — | 0 | 150 | 0.5 | 50 | src/nav/nav-graph.js:35 | pendente (tecnico) |
| `test.arenaHalf` | Metade do lado da arena | × m | 6 | 100 | 1 | 16 | src/nav/nav-graph.js:35 | muda · duel |
| `test.halfExtent` | Meia largura do colisor | — | 0.1 | 2.5 | 0.01 | 0.5 | src/app/live-panels.js:33 | muda · tackle |
| `test.hp` | Vida máxima base · legado (sem efeito) | — | 1 | 800 | 1 | 100 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `test.attack` | Ataque base | — | 0 | 200 | 1 | 20 | src/sim/moves/air-slash.js:22 | pendente (tecnico) |
| `test.defense` | Defesa base (sem efeito) | — | 0 | 200 | 1 | 50 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `test.speed` | Velocidade base · legado (sem efeito) | — | 0.01 | 30 | 0.01 | 4.8 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `test.attackReference` | Referência de ataque | — | 0.01 | 200 | 1 | 20 | src/sim/controller/ctrl-moves.js:132 | pendente (tecnico) |
| `test.speedReference` | Referência de velocidade (sem efeito) | — | 0.01 | 200 | 1 | 10 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `test.defenseMedian` | Mediana de defesa (sem efeito) | — | 0.01 | 200 | 1 | 50 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `test.pushCoefficient` | Coeficiente legado de empurrão (sem efeito) | — | 0 | 10 | 0.05 | 2 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `test.pushDuration` | Duração do empurrão legado | — | 0 | 2 | 0.01 | 0.3 | src/sim/physics.js:432 | pendente (tecnico) |
| `test.aiInterval` | Intervalo padrão de IA | — | 0 | 4.25 | 0.01 | 0.85 | src/sim/ai.js:133 | pendente (tecnico) |
| `test.aiRange` | Distância padrão da IA (sem efeito) | — | 0 | 13.2 | 0.05 | 3.3 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `test.contactStep` | Tamanho máximo de subpasso | — | 0.01 | 2 | 0.01 | 0.1 | src/sim/physics.js:437 | muda · duel |
| `test.epsilon` | Tolerância de contato | — | 0 | 0.000001 | 1e-9 | 1e-8 | src/sim/physics.js:157 | pendente (tecnico) |
| `test.contactShape` | Pegada do contato lutador × lutador (0 = quadrada · 1 = circular) | seletor | 0 | 1 | 1 | 1 | src/sim/physics.js:494 | pendente (tecnico) |
| `test.forwardTolerance` | Tolerância frontal legada (sem efeito) | ° | 0 | 3.14159 | 0.0174533 | 0.392699 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |

## Arena circular

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `map.arenaRadius` | Raio da arena circular (m) | m | 15 | 100 | 1 | 32.5 | src/nav/nav-graph.js:35 | muda · duelLong |
| `map.wallBounceMultiplier` | Multiplicador de rebote (borda circular; em pilares e caixas o fator total é limitado a 1) | × | 0 | 3 | 0.1 | 1 | src/sim/map/map-collision.js:30 | pendente (mapa) |
| `map.wallDamageMultiplier` | Multiplicador de dano na borda circular (sem efeito) | × | 0 | 3 | 0.1 | 1 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |

## Objetos destrutíveis

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `map.destructibleCount` | Quantidade de objetos destrutíveis | — | 0 | 20 | 1 | 4 | src/sim/map/map-spawn.js:250 | muda · duelLong |
| `map.destructibleHp` | Vida base dos destrutíveis | HP | 5 | 300 | 5 | 30 | src/sim/map/map-spawn.js:260 | muda · duelLong |
| `map.destructibleRespawnMin` | Tempo mín. respawn destrutível (s) | s | 2 | 120 | 1 | 15 | src/sim/map/map-damage.js:66 | pendente (mapa) |
| `map.destructibleRespawnMax` | Tempo máx. respawn destrutível (s) | s | 2 | 120 | 1 | 30 | src/sim/map/map-damage.js:66 | pendente (mapa) |
| `map.destructibleGhostPreview` | Prévia fantasma antes do respawn (s) | s | 0.05 | 5 | 0.01 | 2 | src/sim/map/map-step.js:37 | pendente (mapa) |
| `map.spawnClearance` | Folga mínima lutador × objeto novo (m) | m | 0 | 3 | 0.1 | 0.6 | src/sim/map/map-spawn.js:146 | muda · duelLong |
| `map.passageClearance` | Vão mínimo entre objetos sólidos (m) | m | 0 | 3 | 0.1 | 1.2 | src/sim/map/map-spawn.js:56 | muda · duelLong |
| `map.impactMinSpeed` | Velocidade mínima do impacto em destrutível (m/s) | — | 0.01 | 30 | 0.01 | 1 | src/sim/map/map-collision.js:146 | pendente (mapa) |
| `map.impactDamageToObject` | Dano ao destrutível por m/s do impacto | por m/s | 0 | 20 | 0.25 | 6 | src/sim/map/map-collision.js:147 | pendente (mapa) |
| `map.impactDamageToFighter` | Dano ao arremessado por m/s do impacto | por m/s | 0 | 20 | 0.25 | 2.5 | src/sim/map/map-collision.js:148 | pendente (mapa) |

## Obstáculos indestrutíveis

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `map.obstacleCount` | Quantidade de obstáculos indestrutíveis | — | 0 | 20 | 1 | 4 | src/sim/map/map-spawn.js:224 | muda · duelLong |

## Plataformas e salto

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `map.platformCount` | Quantidade de plataformas 3D (0 desliga) | — | 0 | 20 | 1 | 5 | src/sim/map/map-spawn.js:207 | muda · duelLong |
| `map.mountTolerance` | Tolerância de montagem em sólidos (m) | m | 0.05 | 0.5 | 0.01 | 0.25 | src/sim/collision/queries.js:108 | pendente (mapa) |
| `map.jumpPassOver` | Salto «passa por cima» da lateral por previsão (0/1) | liga/desliga | 0 | 1 | 1 | 0 | src/sim/map/map-collision.js:20 | pendente (mapa) |
| `map.launchSolidCollision` | Lançados colidem com a lateral de sólidos (0/1) | liga/desliga | 0 | 1 | 1 | 1 | src/sim/map/map-collision.js:21 | pendente (mapa) |
| `map.jumpHeight` | Altura do salto normal (m) | m | 0.5 | 10 | 0.1 | 2.4 | src/nav/nav-graph.js:17 | muda · jump |
| `map.jumpGravity` | Gravidade do salto normal (m/s²) | m/s² | 5 | 80 | 0.5 | 17.5 | src/sim/controller/ctrl-tackle.js:146 | muda · jump |
| `map.jumpInterval` | Intervalo mínimo entre saltos (s) | s | 0.05 | 10 | 0.01 | 0.12 | src/sim/controller/ctrl-update.js:455 | muda · jump |
| `map.jumpLandingRecovery` | Atraso de recuperação ao aterrissar (s) (sem efeito) | s | 0.05 | 10 | 0.01 | 0.19 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `map.jumpDrag` | Arrasto no salto (perda de vel.) | s⁻¹ | 0 | 6 | 0.05 | 0 | src/sim/physics.js:323 | muda · jump |
| `map.jumpAirControl` | Controle direcional no ar (%) | % | 0 | 2 | 0.05 | 0.85 | src/sim/controller/ctrl-update.js:97 | pendente (mapa) |
| `map.jumpImprovements` | Melhorias de salto estilo SM64 (0/1) | liga/desliga | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-tackle.js:159 | muda · jump |
| `map.jumpGravityUp` | Gravidade subindo (m/s²) | m/s² | 5 | 80 | 0.5 | 17.5 | src/sim/physics.js:287 | muda · jump |
| `map.jumpGravityDown` | Gravidade descendo (m/s²) | m/s² | 5 | 80 | 0.5 | 28.5 | src/sim/physics.js:287 | muda · jump |
| `map.jumpReleaseMult` | Gravidade ao soltar o botão (×) | × | 1 | 8 | 0.1 | 2.2 | src/sim/physics.js:288 | muda · jump |
| `map.jumpMaxFallSpeed` | Velocidade terminal de queda (m/s) | — | 0.01 | 60 | 0.01 | 15.14 | src/sim/physics.js:289 | muda · jump |
| `map.jumpAirAccel` | Aceleração do controle aéreo (m/s²) | m/s² | 0 | 80 | 0.5 | 10.5 | src/sim/controller/ctrl-update.js:95 | muda · jump |
| `map.jumpAirMaxSpeed` | Teto do controle aéreo (m/s) | — | 0.01 | 60 | 0.01 | 4.5 | src/sim/physics.js:296 | muda · jump |
| `map.jumpCoyoteTime` | Coyote time (s) | s | 0 | 1 | 0.01 | 0.1 | src/sim/ledge.js:64 | pendente (mapa) |
| `map.jumpBufferWindow` | Janela de buffer de salto (s) | s | 0 | 1 | 0.01 | 0.12 | src/sim/controller/ctrl-update.js:52 | muda · jump |

## Footstool (pisar no rival)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `map.footstoolEnabled` | Footstool: pisar no rival (0/1) | liga/desliga | 0 | 1 | 1 | 1 | src/sim/physics.js:345 | muda · jump |
| `map.footstoolDamage` | Footstool: dano (HP) | HP | 0 | 60 | 1 | 5 | src/sim/combat.js:226 | muda · jump |
| `map.footstoolBounce` | Footstool: rebote vertical (m/s) | m/s | 0 | 28 | 0.1 | 11.1 | src/sim/physics.js:358 | muda · jump |
| `map.footstoolStagger` | Footstool: stagger (s) | s | 0 | 4 | 0.05 | 0.55 | src/sim/combat.js:228 | muda · jump |
| `map.footstoolTolerance` | Footstool: tolerância lateral (m) | m | 0 | 2 | 0.01 | 0.12 | src/sim/physics.js:347 | muda · jump |
| `map.footstoolMinFallSpeed` | Footstool: vel. mínima de queda (m/s) | — | 0.01 | 60 | 0.01 | 1 | src/sim/physics.js:353 | muda · jump |
| `map.footstoolCooldown` | Footstool: recarga (s) | s | 0 | 6 | 0.05 | 0.5 | src/sim/physics.js:357 | pendente (mapa) |
| `map.footstoolVault` | Footstool: esquiva (C) por cima do rival também pisa (0/1) | liga/desliga | 0 | 1 | 1 | 1 | src/sim/physics.js:378 | pendente (mapa) |
| `map.footstoolAirAccel` | Footstool: controle aéreo após o rebote (m/s²) | m/s² | 0 | 120 | 0.5 | 46 | src/sim/physics.js:361 | muda · jump |
| `map.footstoolAirMaxSpeed` | Footstool: velocidade aérea máx. após o rebote (m/s) | — | 0.01 | 60 | 0.01 | 7.5 | src/sim/physics.js:361 | muda · jump |
| `map.footstoolVaultMargin` | Footstool pela esquiva: margem abaixo da cabeça (m) | m | 0 | 2.4 | 0.01 | 0.35 | src/sim/physics.js:379 | pendente (mapa) |

## Consumíveis e drops

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `map.itemInitialCount` | Consumíveis iniciais na arena | — | 0 | 20 | 1 | 2 | src/sim/map/map-spawn.js:278 | muda · items |
| `map.itemSpawnIntervalMin` | Tempo mín. surgimento de itens (s) | s | 2 | 120 | 1 | 20 | src/sim/map/map-spawn.js:298 | muda · items |
| `map.itemSpawnIntervalMax` | Tempo máx. surgimento de itens (s) | s | 2 | 120 | 1 | 40 | src/sim/map/map-spawn.js:298 | muda · items |
| `map.itemMaxRegular` | Limite de consumíveis regulares na arena | — | 0 | 20 | 1 | 4 | src/sim/map/map-step.js:105 | muda · items |
| `map.itemLifetime` | Duração do consumível na arena (s) | s | 2 | 120 | 1 | 15 | src/sim/map/map-spawn.js:290 | muda · duelLong |
| `map.itemPickupRadius` | Raio de coleta 3D esférico (m) | m | 0.5 | 5 | 0.1 | 1.3 | src/sim/map/map-step.js:133 | muda · items |
| `map.healHp` | Cura de HP (Pílula de HP) | HP | 5 | 100 | 5 | 20 | src/sim/map/map-consumables.js:27 | pendente (mapa) |
| `map.healStamina` | Restauração imediata de Stamina (pontos) | pontos | 1 | 10 | 1 | 2 | src/sim/map/map-consumables.js:33 | pendente (mapa) |

## Progressão de estágios e escudo

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `map.shieldDuration` | Duração do escudo temporário (s) | s | 2 | 120 | 1 | 10 | src/sim/map/map-consumables.js:79 | muda · items |
| `map.shieldCapacity` | Capacidade do escudo temporário (HP) | HP | 5 | 300 | 5 | 40 | src/sim/map/map-consumables.js:79 | muda · items |
| `map.shieldMaxCap` | Capacidade máxima acumulada do escudo (HP) | HP | 5 | 300 | 5 | 80 | src/sim/map/map-consumables.js:15 | muda · items |
| `map.stageAttackBonus` | Bônus de ataque por estágio (+10%) | % | 0.01 | 0.5 | 0.01 | 0.1 | src/sim/combat.js:54 | pendente (mapa) |
| `map.stageDefenseReduction` | Redução de dano por estágio de defesa (-10 pp) | pp | 0.01 | 0.5 | 0.01 | 0.1 | src/sim/combat.js:193 | muda · items |
| `map.stageStaminaBonus` | Stamina máxima extra por estágio (+1) | — | 0 | 20 | 1 | 1 | src/sim/entity.js:32 | muda · items |
| `map.stageCooldownReduction` | Redução de recarga por estágio (-10%) | % | 0.01 | 0.5 | 0.01 | 0.1 | src/ui/progress-values.js:12 (consumerWeak) | pendente (mapa) |
| `map.stageSpeedBonus` | Aumento de velocidade por estágio (+5%) | % | 0.01 | 0.5 | 0.01 | 0.05 | src/ui/progress-values.js:13 (consumerWeak) | pendente (mapa) |
| `map.stagesMax` | Máximo de estágios por categoria (4) | — | 0 | 20 | 1 | 4 | src/sim/map/map-consumables.js:17 | muda · items |

## Renderizador e personagens

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `extras.visual.bodyWidth` | Largura visual do corpo | — | 0.1 | 10 | 0.05 | 1 | src/view/meteor-fx.js:12 | visual/depuração |
| `extras.visual.bodyHeight` | Altura visual do corpo | — | 0.1 | 10 | 0.05 | 1.3 | src/sim/aim-marker.js:33 | visual/depuração |
| `extras.visual.bodyDepth` | Profundidade visual do corpo | — | 0.1 | 10 | 0.05 | 1 | src/view/meteor-fx.js:12 | visual/depuração |
| `extras.visual.arrowRadius` | Raio da seta frontal | — | 0 | 2 | 0.01 | 0.16 | src/view/view.js:352 | visual/depuração |
| `extras.visual.arrowLength` | Comprimento da seta frontal | — | 0 | 2.1 | 0.01 | 0.42 | src/view/view.js:352 | visual/depuração |
| `extras.visual.arrowOffset` | Deslocamento da seta | — | 0 | 2 | 0.01 | 0.2 | src/view/view.js:351 | visual/depuração |
| `extras.visual.arrowHeight` | Altura da seta | — | 0 | 10 | 0.05 | 1.48 | src/view/view.js:351 | visual/depuração |
| `extras.visual.guardScale` | Escala vertical defendendo | — | 0 | 2 | 0.01 | 1.03 | src/view/view.js:342 | visual/depuração |
| `extras.visual.landingScale` | Compressão na aterrissagem | — | 0 | 2 | 0.01 | 0.82 | src/view/view.js:342 | visual/depuração |
| `extras.visual.shadowMin` | Escala mínima da sombra | — | 0 | 2 | 0.01 | 0.3 | src/view/view.js:344 | visual/depuração |
| `extras.visual.shadowHeightFade` | Sombra versus altitude | — | 0 | 2 | 0.01 | 0.16 | src/view/view.js:344 | visual/depuração |
| `extras.visual.renderPixelRatio` | Resolução máxima ×DPR | × | 0.5 | 3 | 0.1 | 2 | src/sim/graphics.js:8 | visual/depuração |
| `extras.visual.ambientLightIntensity` | Luz ambiente | — | 0 | 10 | 0.05 | 2.5 | src/view/view.js:176 | visual/depuração |
| `extras.visual.directionalIntensity` | Luz direcional | — | 0 | 10 | 0.05 | 2 | src/view/view.js:177 | visual/depuração |
| `extras.visual.floorThickness` | Espessura do piso | — | 0 | 2 | 0.01 | 0.1 | src/view/scenery.js:112 | visual/depuração |
| `extras.visual.wallHeight` | Altura das paredes | — | 0 | 2 | 0.01 | 0.35 | src/view/scenery.js:10 | visual/depuração |
| `extras.visual.wallThickness` | Espessura das paredes | — | 0 | 2 | 0.01 | 0.15 | src/view/scenery.js:10 | visual/depuração |
| `extras.visual.gridDivisions` | Divisões da grade do piso | — | 2 | 100 | 1 | 32 | src/view/scenery.js:31 | visual/depuração |
| `extras.visual.lightX` | Luz principal: posição X | — | -30 | 30 | 0.5 | 4 | src/view/view.js:67 | visual/depuração |
| `extras.visual.lightY` | Luz principal: altura | — | -30 | 30 | 0.5 | 12 | src/view/view.js:67 | visual/depuração |
| `extras.visual.lightZ` | Luz principal: posição Z | — | -30 | 30 | 0.5 | -8 | src/view/view.js:67 | visual/depuração |

## Efeitos e feedback

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `extras.fx.impactCount` | Partículas por impacto | — | 0 | 64 | 1 | 8 | src/view/view.js:191 | visual/depuração |
| `extras.fx.clashCount` | Partículas por clash | — | 0 | 64 | 1 | 12 | src/view/view.js:191 | visual/depuração |
| `extras.fx.landingCount` | Partículas na aterrissagem | — | 0 | 64 | 1 | 7 | src/view/view.js:191 | visual/depuração |
| `extras.fx.impactDuration` | Vida das partículas | — | 0.02 | 2 | 0.01 | 0.34 | src/view/view.js:196 | visual/depuração |
| `extras.fx.clashDuration` | Vida das partículas de clash | — | 0.02 | 2.4 | 0.01 | 0.48 | src/view/view.js:196 | visual/depuração |
| `extras.fx.particleWidth` | Largura da partícula | — | 0 | 0.6 | 0.001 | 0.075 | src/view/view.js:194 | visual/depuração |
| `extras.fx.particleHeight` | Altura da partícula | — | 0 | 0.56 | 0.001 | 0.07 | src/view/view.js:194 | visual/depuração |
| `extras.fx.particleLength` | Comprimento da partícula | — | 0 | 3.3 | 0.01 | 0.66 | src/view/view.js:194 | visual/depuração |
| `extras.fx.clashParticleLength` | Comprimento de partícula clash | — | 0 | 4.75 | 0.01 | 0.95 | src/view/view.js:194 | visual/depuração |
| `extras.fx.particleOpacity` | Opacidade das partículas | — | 0 | 2 | 0.01 | 0.92 | src/view/view.js:194 | visual/depuração |
| `extras.fx.particleTravel` | Distância de expansão | — | 0 | 10 | 0.05 | 1.6 | src/view/view.js:224 | visual/depuração |
| `extras.fx.particleInitialTravel` | Distância inicial | — | 0 | 2 | 0.01 | 0.15 | src/view/view.js:224 | visual/depuração |
| `extras.fx.particleRise` | Altura da explosão | — | 0 | 2 | 0.01 | 0.36 | src/view/view.js:224 | visual/depuração |
| `extras.fx.particleHeightFromGround` | Altura de origem | — | 0 | 2 | 0.01 | 0.22 | src/view/view.js:195 | visual/depuração |
| `extras.fx.particleStretch` | Alongamento no final | — | 0 | 10 | 0.05 | 1.9 | src/view/view.js:225 | visual/depuração |
| `extras.fx.invulnRepeatDelay` | Espera entre efeitos de invulnerabilidade | ms | 0 | 5000 | 10 | 300 | src/view/view.js:216 | visual/depuração |
| `extras.fx.impactNoticeMs` | Tempo do aviso de impacto | ms | 0 | 5000 | 10 | 630 | src/ui/hud.js:72 | visual/depuração |
| `extras.fx.clashNoticeMs` | Tempo do aviso CLASH | ms | 0 | 5000 | 10 | 970 | src/ui/hud.js:72 | visual/depuração |
| `extras.fx.invulnNoticeMs` | Intervalo do aviso invulnerável | ms | 0 | 5000 | 10 | 350 | src/ui/hud.js:69 | visual/depuração |
| `extras.fx.noticeFontSize` | Tamanho do aviso | — | 0 | 56 | 1 | 30 | src/app/tuning-sync.js:32 | visual/depuração |
| `extras.fx.clashNoticeFontSize` | Tamanho do aviso de clash | — | 0 | 56 | 1 | 40 | src/app/tuning-sync.js:32 | visual/depuração |
| `extras.fx.hitboxOpacity` | Opacidade das hitboxes | — | 0 | 2 | 0.01 | 0.6 | src/view/view.js:553 | visual/depuração |
| `extras.fx.attackVectorWidth` | Largura dos vetores de ataque | — | 0 | 2 | 0.01 | 0.13 | src/view/view.js:559 | visual/depuração |

## Game feel 5–9: golpe no vazio, borda, pés, olhar e fases

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `extras.gameFeel.whiffOn` | Feedback de golpe no vazio (liga/desliga) | liga/desliga | 0 | 1 | 1 | 1 | src/view/whiff-fx.js:74 | visual/depuração |
| `extras.gameFeel.whiffTrail` | Golpe no vazio: rastro de ar (×) | × | 0 | 2 | 0.05 | 1 | src/view/whiff-fx.js:109 | visual/depuração |
| `extras.gameFeel.whiffDust` | Golpe no vazio: poeira no chão (×) | × | 0 | 2 | 0.05 | 1 | src/view/whiff-fx.js:118 | visual/depuração |
| `extras.gameFeel.whiffOvershoot` | Golpe no vazio: giro de desequilíbrio na recuperação (°) | ° | 0 | 12 | 0.5 | 4 | src/view/whiff-fx.js:126 | visual/depuração |
| `extras.gameFeel.whiffMinDistance` | Golpe no vazio: distância mínima do rival para valer (m) | m | 0 | 1 | 0.01 | 0.25 | src/view/whiff-fx.js:78 | visual/depuração |
| `extras.gameFeel.ledgeOffsetY` | Borda: ajuste vertical da pose pendurada (m) | m | -0.5 | 0.5 | 0.01 | 0 | src/view/characters.js:965 | visual/depuração |
| `extras.gameFeel.ledgeOffsetZ` | Borda: ajuste horizontal da pose, rumo à parede (m) | m | -0.5 | 0.5 | 0.01 | 0 | src/view/characters.js:962 | visual/depuração |
| `extras.gameFeel.ledgeSizeComp` | Borda: compensação do tamanho do modelo na pose pendurada (× · 0 desliga) | × | 0 | 2 | 0.05 | 1 | src/view/characters.js:964 | visual/depuração |
| `extras.gameFeel.footOn` | Apoio visual dos pés (IK) ligado | liga/desliga | 0 | 1 | 1 | 0 | src/view/characters.js:743 | visual/depuração |
| `extras.gameFeel.footMaxCorrection` | Pés: correção máxima do tornozelo (m) | m | 0 | 0.25 | 0.005 | 0.12 | src/view/rig-layers.js:193 (consumerWeak) | visual/depuração |
| `extras.gameFeel.footPelvisMax` | Pés: correção máxima da pelve (m) | m | 0 | 0.15 | 0.005 | 0.06 | src/view/rig-layers.js:194 (consumerWeak) | visual/depuração |
| `extras.gameFeel.footSmooth` | Pés: suavização da posição (s) | s | 0.02 | 0.2 | 0.01 | 0.08 | src/view/rig-layers.js:177 (consumerWeak) | visual/depuração |
| `extras.gameFeel.footPlantSpeed` | Pés: velocidade abaixo da qual o pé fica plantado (m/s) | m/s | 0 | 1.5 | 0.05 | 0.6 | src/view/rig-layers.js:210 (consumerWeak) | visual/depuração |
| `extras.gameFeel.footSlope` | Pés: alinhamento da sola ao apoio (%) | % | 0 | 100 | 1 | 60 | src/view/rig-layers.js:219 (consumerWeak) | visual/depuração |
| `extras.gameFeel.trackOn` | Olhar para o alvo travado (rastreamento aditivo) ligado | liga/desliga | 0 | 1 | 1 | 0 | src/view/characters.js:743 | visual/depuração |
| `extras.gameFeel.trackHeadYaw` | Olhar: limite horizontal da cabeça (°) | ° | 0 | 65 | 1 | 45 | src/view/rig-layers.js:281 (consumerWeak) | visual/depuração |
| `extras.gameFeel.trackHeadPitch` | Olhar: limite vertical da cabeça (°) | ° | 0 | 35 | 1 | 20 | src/view/rig-layers.js:287 (consumerWeak) | visual/depuração |
| `extras.gameFeel.trackTorso` | Olhar: contribuição do tronco (%) | % | 0 | 70 | 1 | 35 | src/view/rig-layers.js:281 (consumerWeak) | visual/depuração |
| `extras.gameFeel.trackSmooth` | Olhar: suavização da resposta (s) | s | 0.03 | 0.3 | 0.01 | 0.12 | src/view/rig-layers.js:271 (consumerWeak) | visual/depuração |
| `extras.gameFeel.trackRelease` | Olhar: tempo para voltar à pose base (s) | s | 0.03 | 0.25 | 0.01 | 0.12 | src/view/rig-layers.js:271 (consumerWeak) | visual/depuração |
| `extras.gameFeel.trackAimLimit` | Olhar: alcance do membro de mira (° a partir da pose base) | ° | 0 | 90 | 1 | 50 | src/view/rig-layers.js:295 (consumerWeak) | visual/depuração |
| `extras.gameFeel.phaseMode` | Fases da animação nos tempos do combate (0 = Definição do Move · 1 = Animação aprovada · 2 = Comparar sem aplicar) | Definição do Move | 0 | 2 | 1 | 0 | src/app/characters-sync.js:24 | pendente (combate) |
| `extras.gameFeel.phaseActive` | Fases: autorizar janela ativa vinda da animação | liga/desliga | 0 | 1 | 1 | 0 | src/main.js:121 | pendente (combate) |
| `extras.gameFeel.phaseCancel` | Fases: autorizar janela de cancelamento vinda da animação | liga/desliga | 0 | 1 | 1 | 0 | src/main.js:121 | pendente (combate) |
| `extras.gameFeel.phaseInvuln` | Fases: autorizar invulnerabilidade vinda da animação | liga/desliga | 0 | 1 | 1 | 0 | src/main.js:121 | pendente (combate) |

## HUD e visualização

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `extras.hud.uiScale` | Escala do HUD | — | 0 | 3 | 0.01 | 1 | src/app/tuning-sync.js:32 | visual/depuração |
| `extras.hud.debugFontSize` | Fonte de depuração (sem efeito) | — | 0 | 56 | 1 | 12 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `extras.hud.footerFontSize` | Fonte do rodapé (sem efeito) | — | 0 | 56 | 1 | 15 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `extras.hud.fxVisible` | Exibir partículas | liga/desliga | 0 | 1 | 1 | 1 | src/view/view.js:189 | visual/depuração |
| `extras.hud.hudVisible` | Exibir HUD | liga/desliga | 0 | 1 | 1 | 1 | src/app/tuning-sync.js:39 | visual/depuração |
| `extras.hud.debugVisible` | Mostrar depuração | liga/desliga | 0 | 1 | 1 | 0 | src/app/tuning-sync.js:39 | visual/depuração |
| `extras.hud.menuOpacity` | Opacidade do menu (sem efeito) | — | 0 | 2 | 0.01 | 0.85 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `extras.hud.fpsSmoothing` | Suavização do FPS | — | 0.01 | 0.5 | 0.01 | 0.05 | src/app/main-loop.js:23 | visual/depuração |

## Cores: canais RGB individuais

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `extras.colors.playerR` | Jogador azul · Vermelho | — | 0 | 255 | 1 | 53 | src/view/view.js:327 | visual/depuração |
| `extras.colors.playerG` | Jogador azul · Verde | — | 0 | 255 | 1 | 137 | src/view/view.js:327 | visual/depuração |
| `extras.colors.playerB` | Jogador azul · Azul | — | 0 | 255 | 1 | 255 | src/view/view.js:327 | visual/depuração |
| `extras.colors.enemyR` | Adversário vermelho · Vermelho | — | 0 | 255 | 1 | 242 | src/view/view.js:327 | visual/depuração |
| `extras.colors.enemyG` | Adversário vermelho · Verde | — | 0 | 255 | 1 | 81 | src/view/view.js:327 | visual/depuração |
| `extras.colors.enemyB` | Adversário vermelho · Azul | — | 0 | 255 | 1 | 75 | src/view/view.js:327 | visual/depuração |
| `extras.colors.floorR` | Piso · Vermelho | — | 0 | 255 | 1 | 96 | src/view/view.js:68 | visual/depuração |
| `extras.colors.floorG` | Piso · Verde | — | 0 | 255 | 1 | 109 | src/view/view.js:68 | visual/depuração |
| `extras.colors.floorB` | Piso · Azul | — | 0 | 255 | 1 | 116 | src/view/view.js:68 | visual/depuração |
| `extras.colors.wallR` | Paredes · Vermelho | — | 0 | 255 | 1 | 202 | src/view/view.js:78 | visual/depuração |
| `extras.colors.wallG` | Paredes · Verde | — | 0 | 255 | 1 | 212 | src/view/view.js:78 | visual/depuração |
| `extras.colors.wallB` | Paredes · Azul | — | 0 | 255 | 1 | 219 | src/view/view.js:78 | visual/depuração |
| `extras.colors.backgroundR` | Fundo · Vermelho | — | 0 | 255 | 1 | 32 | src/view/view.js:66 | visual/depuração |
| `extras.colors.backgroundG` | Fundo · Verde | — | 0 | 255 | 1 | 43 | src/view/view.js:66 | visual/depuração |
| `extras.colors.backgroundB` | Fundo · Azul | — | 0 | 255 | 1 | 53 | src/view/view.js:66 | visual/depuração |
| `extras.colors.gridMajorR` | Grid principal · Vermelho | — | 0 | 255 | 1 | 196 | src/view/view.js:76 | visual/depuração |
| `extras.colors.gridMajorG` | Grid principal · Verde | — | 0 | 255 | 1 | 209 | src/view/view.js:76 | visual/depuração |
| `extras.colors.gridMajorB` | Grid principal · Azul | — | 0 | 255 | 1 | 217 | src/view/view.js:76 | visual/depuração |
| `extras.colors.gridMinorR` | Grid secundário · Vermelho | — | 0 | 255 | 1 | 133 | src/view/view.js:76 | visual/depuração |
| `extras.colors.gridMinorG` | Grid secundário · Verde | — | 0 | 255 | 1 | 147 | src/view/view.js:76 | visual/depuração |
| `extras.colors.gridMinorB` | Grid secundário · Azul | — | 0 | 255 | 1 | 156 | src/view/view.js:76 | visual/depuração |
| `extras.colors.impactR` | Impacto · Vermelho | — | 0 | 255 | 1 | 255 | src/view/view.js:190 | visual/depuração |
| `extras.colors.impactG` | Impacto · Verde | — | 0 | 255 | 1 | 179 | src/view/view.js:190 | visual/depuração |
| `extras.colors.impactB` | Impacto · Azul | — | 0 | 255 | 1 | 97 | src/view/view.js:190 | visual/depuração |
| `extras.colors.clashR` | Clash · Vermelho | — | 0 | 255 | 1 | 255 | src/view/view.js:190 | visual/depuração |
| `extras.colors.clashG` | Clash · Verde | — | 0 | 255 | 1 | 229 | src/view/view.js:190 | visual/depuração |
| `extras.colors.clashB` | Clash · Azul | — | 0 | 255 | 1 | 141 | src/view/view.js:190 | visual/depuração |
| `extras.colors.landingR` | Poeira ao aterrissar · Vermelho | — | 0 | 255 | 1 | 180 | src/view/view.js:190 | visual/depuração |
| `extras.colors.landingG` | Poeira ao aterrissar · Verde | — | 0 | 255 | 1 | 193 | src/view/view.js:190 | visual/depuração |
| `extras.colors.landingB` | Poeira ao aterrissar · Azul | — | 0 | 255 | 1 | 203 | src/view/view.js:190 | visual/depuração |
| `extras.colors.partialR` | Defesa parcial · Vermelho | — | 0 | 255 | 1 | 115 | src/view/view.js:190 | visual/depuração |
| `extras.colors.partialG` | Defesa parcial · Verde | — | 0 | 255 | 1 | 202 | src/view/view.js:190 | visual/depuração |
| `extras.colors.partialB` | Defesa parcial · Azul | — | 0 | 255 | 1 | 255 | src/view/view.js:190 | visual/depuração |
| `extras.colors.perfectR` | Defesa perfeita · Vermelho | — | 0 | 255 | 1 | 157 | src/view/view.js:190 | visual/depuração |
| `extras.colors.perfectG` | Defesa perfeita · Verde | — | 0 | 255 | 1 | 255 | src/view/view.js:190 | visual/depuração |
| `extras.colors.perfectB` | Defesa perfeita · Azul | — | 0 | 255 | 1 | 210 | src/view/view.js:190 | visual/depuração |
| `extras.colors.invulnerableR` | Invulnerabilidade · Vermelho | — | 0 | 255 | 1 | 195 | src/view/view.js:190 | visual/depuração |
| `extras.colors.invulnerableG` | Invulnerabilidade · Verde | — | 0 | 255 | 1 | 215 | src/view/view.js:190 | visual/depuração |
| `extras.colors.invulnerableB` | Invulnerabilidade · Azul | — | 0 | 255 | 1 | 255 | src/view/view.js:190 | visual/depuração |
| `extras.colors.shadowR` | Sombra · Vermelho | — | 0 | 255 | 1 | 19 | src/view/view.js:291 | visual/depuração |
| `extras.colors.shadowG` | Sombra · Verde | — | 0 | 255 | 1 | 26 | src/view/view.js:291 | visual/depuração |
| `extras.colors.shadowB` | Sombra · Azul | — | 0 | 255 | 1 | 32 | src/view/view.js:291 | visual/depuração |
| `extras.colors.arrowR` | Seta frontal · Vermelho | — | 0 | 255 | 1 | 255 | src/view/view.js:328 | visual/depuração |
| `extras.colors.arrowG` | Seta frontal · Verde | — | 0 | 255 | 1 | 255 | src/view/view.js:328 | visual/depuração |
| `extras.colors.arrowB` | Seta frontal · Azul | — | 0 | 255 | 1 | 255 | src/view/view.js:328 | visual/depuração |
| `extras.colors.arrowGuardR` | Seta defendendo · Vermelho | — | 0 | 255 | 1 | 255 | src/view/view.js:353 | visual/depuração |
| `extras.colors.arrowGuardG` | Seta defendendo · Verde | — | 0 | 255 | 1 | 224 | src/view/view.js:353 | visual/depuração |
| `extras.colors.arrowGuardB` | Seta defendendo · Azul | — | 0 | 255 | 1 | 100 | src/view/view.js:353 | visual/depuração |
| `extras.colors.defeatedR` | Derrotado · Vermelho | — | 0 | 255 | 1 | 86 | src/view/view.js:349 | visual/depuração |
| `extras.colors.defeatedG` | Derrotado · Verde | — | 0 | 255 | 1 | 97 | src/view/view.js:349 | visual/depuração |
| `extras.colors.defeatedB` | Derrotado · Azul | — | 0 | 255 | 1 | 106 | src/view/view.js:349 | visual/depuração |
| `extras.colors.glowGuardR` | Brilho da defesa · Vermelho | — | 0 | 255 | 1 | 84 | src/view/view.js:350 | visual/depuração |
| `extras.colors.glowGuardG` | Brilho da defesa · Verde | — | 0 | 255 | 1 | 80 | src/view/view.js:350 | visual/depuração |
| `extras.colors.glowGuardB` | Brilho da defesa · Azul | — | 0 | 255 | 1 | 51 | src/view/view.js:350 | visual/depuração |
| `extras.colors.glowInvulnR` | Brilho da invulnerabilidade · Vermelho | — | 0 | 255 | 1 | 49 | src/view/view.js:350 | visual/depuração |
| `extras.colors.glowInvulnG` | Brilho da invulnerabilidade · Verde | — | 0 | 255 | 1 | 91 | src/view/view.js:350 | visual/depuração |
| `extras.colors.glowInvulnB` | Brilho da invulnerabilidade · Azul | — | 0 | 255 | 1 | 88 | src/view/view.js:350 | visual/depuração |
| `extras.colors.glowRecoilR` | Brilho de recuo · Vermelho | — | 0 | 255 | 1 | 96 | src/view/view.js:350 | visual/depuração |
| `extras.colors.glowRecoilG` | Brilho de recuo · Verde | — | 0 | 255 | 1 | 48 | src/view/view.js:350 | visual/depuração |
| `extras.colors.glowRecoilB` | Brilho de recuo · Azul | — | 0 | 255 | 1 | 71 | src/view/view.js:350 | visual/depuração |
| `extras.colors.glowTackleR` | Brilho de tackle · Vermelho | — | 0 | 255 | 1 | 107 | src/view/view.js:350 | visual/depuração |
| `extras.colors.glowTackleG` | Brilho de tackle · Verde | — | 0 | 255 | 1 | 54 | src/view/view.js:350 | visual/depuração |
| `extras.colors.glowTackleB` | Brilho de tackle · Azul | — | 0 | 255 | 1 | 4 | src/view/view.js:350 | visual/depuração |

## Modos de jogo

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `extras.gameModes.enemyMode` | Comportamento do adversário | Tático (estratégico) | 0 | 8 | 1 | 8 | src/app/match-flow.js:182 | pendente (partida) |
| `extras.gameModes.playerProfile` | Perfil atual do jogador | Equilibrado | 0 | 2 | 1 | 0 | src/app/tuning-sync.js:41 | pendente (partida) |

## Teclas: índices configuráveis

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `extras.bindings.forward` | Mover para cima | seletor | 0 | 50 | 1 | 0 | src/ui/input.js:96 | visual/depuração |
| `extras.bindings.back` | Mover para baixo | seletor | 0 | 50 | 1 | 1 | src/ui/input.js:96 | visual/depuração |
| `extras.bindings.left` | Mover à esquerda | seletor | 0 | 50 | 1 | 2 | src/ui/input.js:96 | visual/depuração |
| `extras.bindings.right` | Mover à direita | seletor | 0 | 50 | 1 | 3 | src/ui/input.js:96 | visual/depuração |
| `extras.bindings.tackle` | Tackle (X) | seletor | 0 | 50 | 1 | 4 | src/ui/input.js:96 | visual/depuração |
| `extras.bindings.dodge` | Esquiva (C) — segure para sprint | seletor | 0 | 50 | 1 | 5 | src/ui/input.js:96 | visual/depuração |
| `extras.bindings.defend` | Defesa (D) | seletor | 0 | 50 | 1 | 6 | src/ui/input.js:96 | visual/depuração |
| `extras.bindings.lock` | Fixar alvo | seletor | 0 | 50 | 1 | 7 | src/ui/input.js:63 | visual/depuração |
| `extras.bindings.pause` | Pausar | seletor | 0 | 50 | 1 | 8 | src/main.js:92 | visual/depuração |
| `extras.bindings.restart` | Reiniciar | seletor | 0 | 50 | 1 | 9 | src/main.js:93 | visual/depuração |
| `extras.bindings.debug` | Depuração | seletor | 0 | 50 | 1 | 10 | src/main.js:94 | visual/depuração |
| `extras.bindings.skill1` | Movimento especial 1 | seletor | 0 | 50 | 1 | 11 | src/ui/input.js:95 | visual/depuração |
| `extras.bindings.skill2` | Movimento especial 2 | seletor | 0 | 50 | 1 | 12 | src/ui/input.js:95 | visual/depuração |
| `extras.bindings.skill3` | Movimento especial 3 | seletor | 0 | 50 | 1 | 49 | src/ui/input.js:95 | visual/depuração |
| `extras.bindings.skill4` | Movimento especial 4 | seletor | 0 | 50 | 1 | 50 | src/ui/input.js:95 | visual/depuração |
| `extras.bindings.jump` | Pular | seletor | 0 | 50 | 1 | 14 | src/ui/input.js:96 | visual/depuração |

## Ativar ou desativar sistemas

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `extras.toggles.enableTackle` | Permitir tackle X | liga/desliga | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-basico.js:90 | muda · tackle |
| `extras.toggles.enableDodge` | Permitir esquiva C | liga/desliga | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-basico.js:90 | muda · dodge |
| `extras.toggles.enableDefense` | Permitir defesa D | liga/desliga | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-tackle.js:59 | muda · guard |
| `extras.toggles.enableClash` | Permitir clashes | liga/desliga | 0 | 1 | 1 | 1 | src/sim/combat.js:24 | muda · clash |
| `extras.toggles.enableInvulnerability` | Permitir invulnerabilidade | liga/desliga | 0 | 1 | 1 | 1 | src/sim/animation-combat-windows.js:245 | pendente (combate) |
| `extras.toggles.enableLaunch` | Permitir lançamento aéreo | liga/desliga | 0 | 1 | 1 | 1 | src/sim/combat.js:201 | muda · tackle |
| `extras.toggles.enableVault` | Permitir salto sobre o inimigo | liga/desliga | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-update.js:413 | muda · slam |
| `extras.toggles.enableWallBounce` | Permitir ricochete | liga/desliga | 0 | 1 | 1 | 1 | src/sim/map/map-collision.js:30 | muda · wallBounce |
| `extras.toggles.enableAIAttack` | IA pode atacar | liga/desliga | 0 | 1 | 1 | 1 | src/sim/ai.js:158 | pendente (combate) |
| `extras.toggles.enableAIReactive` | IA reage a investidas | liga/desliga | 0 | 1 | 1 | 1 | src/sim/ai.js:101 | pendente (combate) |
| `extras.toggles.enableCameraFollow` | Câmera segue jogador | liga/desliga | 0 | 1 | 1 | 1 | src/view/rig.js:33 | visual/depuração |
| `extras.toggles.enableCameraRecenter` | Câmera recentraliza sozinha | liga/desliga | 0 | 1 | 1 | 1 | src/view/rig.js:29 | visual/depuração |
| `extras.toggles.enablePlayerAI` | IA controla o jogador azul | liga/desliga | 0 | 1 | 1 | 0 | src/app/live-panels.js:37 | pendente (combate) |
| `extras.toggles.showHitboxes` | Mostrar hitboxes | liga/desliga | 0 | 1 | 1 | 0 | src/app/live-panels.js:46 | visual/depuração |
| `extras.toggles.showAttackVectors` | Mostrar vetores de ataque | liga/desliga | 0 | 1 | 1 | 0 | src/app/wire-controls.js:31 | visual/depuração |
| `extras.toggles.enableHitstop` | Hitstop: pausa curta no impacto | liga/desliga | 0 | 1 | 1 | 1 | src/sim/game.js:112 | muda · tackle |
| `extras.toggles.integerDamage` | Dano sempre inteiro (arredonda para baixo) | — | 0 | 10 | 0.05 | 1 | src/sim/damage-rule.js:9 | pendente (combate) |
| `extras.toggles.enableCounterBonus` | Bônus do contra-ataque (esquiva e defesa perfeitas) | liga/desliga | 0 | 1 | 1 | 1 | src/sim/combat.js:143 | pendente (combate) |
| `extras.toggles.enableLandingSkid` | Deslize ao aterrissar | liga/desliga | 0 | 1 | 1 | 1 | src/sim/physics.js:245 | muda · tackle |
| `extras.toggles.enableEnemyAI` | IA do oponente | liga/desliga | 0 | 1 | 1 | 1 | src/app/live-panels.js:47 | muda · duel |
| `extras.toggles.enableSprint` | Permitir sprint (C mantido) | liga/desliga | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-update.js:249 | muda · sprint |
| `extras.toggles.enemyManual` | Controle manual do vermelho | liga/desliga | 0 | 1 | 1 | 0 | src/app/match-flow.js:115 | pendente (combate) |
| `extras.toggles.enableAnimationCombatWindows` | Janelas de combate da animação | liga/desliga | 0 | 1 | 1 | 0 | src/sim/entity.js:42 | pendente (combate) |
| `extras.toggles.enableClashPush` | Clash por empurrão (em vez de lançamento) | liga/desliga | 0 | 1 | 1 | 1 | src/sim/combat.js:60 | muda · clash |
| `extras.toggles.enableTechRecovery` | Recovery rápido (C no ar) | liga/desliga | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-update.js:79 | muda · flight |
| `extras.toggles.enableChargeTackle` | Tackle carregado (segurar X) | liga/desliga | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-update.js:230 | muda · sprint |
| `extras.toggles.enableWallSplat` | Wall-splat (preso na parede) | liga/desliga | 0 | 1 | 1 | 1 | src/sim/physics.js:32 | muda · wall |
| `extras.toggles.enableMeteorSlam` | Meteor slam e ground bounce | liga/desliga | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-basico.js:73 | muda · slam |
| `extras.toggles.enableFlightSlam` | Mergulho no ar para quem foi lançado (X) | liga/desliga | 0 | 1 | 1 | 0 | src/sim/controller/ctrl-update.js:54 | pendente (combate) |
| `extras.toggles.enableTackleFeint` | Finta do tackle (C ou D cancelam) | liga/desliga | 0 | 1 | 1 | 1 | src/sim/controller/ctrl-tackle.js:55 | muda · feint |
| `extras.toggles.enableInfiniteStamina` | Stamina infinita (nunca gasta) | liga/desliga | 0 | 1 | 1 | 0 | src/sim/controller/ctrl-basico.js:26 | muda · tackle |
| `extras.toggles.enablePassives` | Sistema de passivas (catálogo experimental) | liga/desliga | 0 | 1 | 1 | 1 | src/app/main-loop.js:31 | pendente (combate) |

## Smear de Membros

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `extras.visual.smear.enableSmear` | Smear de membros no Tackle | liga/desliga | 0 | 1 | 1 | 1 | src/sim/animation-profile.js:278 (consumerWeak) | visual/depuração |
| `extras.visual.smear.smearDurationFrames` | Persistência da lâmina | quadros ( ms) | 1 | 4 | 1 | 3 | src/sim/animation-profile.js:278 (consumerWeak) | visual/depuração |
| `extras.visual.smear.smearMinVelocity` | Velocidade mínima | m/s | 5 | 25 | 0.5 | 12 | src/sim/animation-profile.js:278 (consumerWeak) | visual/depuração |
| `extras.visual.smear.smearWidth` | Largura da lâmina | m | 0.05 | 0.4 | 0.01 | 0.24 | src/sim/animation-profile.js:278 (consumerWeak) | visual/depuração |
| `extras.visual.smear.smearColorMode` | Cor da lâmina | seletor | 0 | 2 | 1 | 1 | src/view/smear-mesh.js:125 (consumerWeak) | visual/depuração |
| `extras.visual.smear.smearOpacity` | Opacidade | % | 0.2 | 1 | 0.05 | 0.75 | src/sim/animation-profile.js:278 (consumerWeak) | visual/depuração |
| `extras.visual.smear.smearPlBoost` | Reforço por Power Level | liga/desliga | 0 | 1 | 1 | 1 | src/sim/animation-profile.js:278 (consumerWeak) | visual/depuração |
| `extras.visual.smear.smearOnDodge` | Smear também na esquiva (C) | liga/desliga | 0 | 1 | 1 | 1 | src/sim/animation-profile.js:278 (consumerWeak) | visual/depuração |

## Ledge Grab (agarre de borda)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `ledge.mode` | Modo do agarre de borda | seletor | 0 | 2 | 1 | 1 | src/sim/ledge.js:94 | pendente (ledge) |
| `ledge.objects` | Aceitar caixas e destrutíveis | liga/desliga | 0 | 1 | 1 | 1 | src/sim/ledge.js:25 | muda · ledgeClimb |
| `ledge.hint` | Realçar a borda agarrável | liga/desliga | 0 | 1 | 1 | 1 | src/view/vfx.js:259 | pendente (ledge) |
| `ledge.reach` | Alcance horizontal | m | 0 | 1.5 | 0.01 | 0.35 | src/sim/ledge.js:42 | pendente (ledge) |
| `ledge.reachUp` | Altura máxima da borda acima dos pés | m | 0.2 | 3 | 0.01 | 1.25 | src/sim/ledge.js:44 | muda · ledgeClimb |
| `ledge.minUp` | Altura mínima da borda acima dos pés | m | 0 | 2 | 0.01 | 0.6 | src/sim/ledge.js:44 | muda · ledgeClimb |
| `ledge.maxRiseSpeed` | Velocidade máxima de subida para agarrar | m/s | 0 | 8 | 0.1 | 1.5 | src/sim/ledge.js:95 | muda · ledgeClimb |
| `ledge.minHangHeight` | Altura mínima da pose pendurada | m | 0 | 1 | 0.01 | 0.2 | src/sim/ledge.js:46 | pendente (ledge) |
| `ledge.hangDrop` | Pés abaixo da borda (pendurado) | m | 0.3 | 2.5 | 0.01 | 1.15 | src/sim/ledge.js:45 | muda · ledgeClimb |
| `ledge.snapTime` | Tempo do encaixe | s | 0 | 0.5 | 0.01 | 0.1 | src/sim/ledge.js:122 | muda · ledgeClimb |
| `ledge.grabCost` | Stamina ao agarrar | — | 0 | 3 | 0.05 | 0 | src/sim/ledge.js:101 | muda · ledgeClimb |
| `ledge.hangDrain` | Stamina por segundo pendurado | /s | 0 | 3 | 0.05 | 0.3 | src/sim/ledge.js:117 | muda · ledgeClimb |
| `ledge.maxHang` | Tempo máximo pendurado | s | 0 | 15 | 0.1 | 4 | src/sim/ledge.js:136 | pendente (ledge) |
| `ledge.minHang` | Espera antes de aceitar comandos | s | 0 | 1 | 0.01 | 0.15 | src/sim/ledge.js:129 | muda · ledgeClimb |
| `ledge.climbInput` | Comando para subir | seletor | 0 | 2 | 1 | 0 | src/sim/ledge.js:126 | muda · ledgeClimb |
| `ledge.climbHold` | Tempo segurando a direção para subir | s | 0 | 1 | 0.01 | 0.12 | src/sim/ledge.js:128 | pendente (ledge) |
| `ledge.climbTime` | Duração da subida | s | 0.1 | 2 | 0.01 | 0.45 | src/sim/ledge.js:139 | muda · ledgeClimb |
| `ledge.climbInset` | Posição final no topo | m | 0.1 | 1.5 | 0.01 | 0.6 | src/sim/ledge.js:50 | muda · ledgeClimb |
| `ledge.climbInvuln` | Invulnerabilidade na subida | s | 0 | 1 | 0.01 | 0 | src/sim/entity.js:67 | pendente (ledge) |
| `ledge.dropInput` | Comando para soltar | seletor | 0 | 1 | 1 | 1 | src/sim/ledge.js:126 | pendente (ledge) |
| `ledge.dropHold` | Tempo segurando para longe para soltar | s | 0 | 1 | 0.01 | 0.2 | src/sim/ledge.js:127 | muda · ledgeClimb |
| `ledge.dropPush` | Empurrão ao soltar | m/s | 0 | 6 | 0.1 | 1.2 | src/sim/ledge.js:63 | muda · ledgeDrop |
| `ledge.cooldown` | Intervalo até agarrar de novo | s | 0 | 3 | 0.05 | 0.5 | src/sim/ledge.js:62 | pendente (ledge) |
| `ledge.hurtDrops` | Golpe derruba da borda | liga/desliga | 0 | 1 | 1 | 1 | src/sim/ledge.js:110 | pendente (ledge) |
| `ledge.aiClimb` | IA sobe depois de | s | 0 | 5 | 0.05 | 0.35 | src/sim/game.js:76 | pendente (ledge) |

## Squash & Stretch do Tackle

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `extras.visual.squashStretch.enableSquashStretch` | Deformação elástica do Tackle | liga/desliga | 0 | 1 | 1 | 1 | src/sim/animation-profile.js:264 (consumerWeak) | visual/depuração |
| `extras.visual.squashStretch.squashOnDodge` | Squash & stretch também na esquiva (C) | liga/desliga | 0 | 1 | 1 | 1 | src/sim/animation-profile.js:264 (consumerWeak) | visual/depuração |
| `extras.visual.squashStretch.dodgeSquashScale` | Intensidade na esquiva | % | 0 | 2 | 0.05 | 1.3 | src/sim/animation-profile.js:264 (consumerWeak) | visual/depuração |
| `extras.visual.squashStretch.squashIntensity` | Compressão no arranque | % | 0 | 0.3 | 0.01 | 0.17 | src/view/characters.js:949 | visual/depuração |
| `extras.visual.squashStretch.stretchIntensity` | Alongamento no impulso | % | 0 | 0.4 | 0.01 | 0.31 | src/view/characters.js:949 | visual/depuração |
| `extras.visual.squashStretch.squashWindow` | Janela de compressão | ms | 0 | 150 | 1 | 60 | src/sim/animation-profile.js:264 (consumerWeak) | visual/depuração |
| `extras.visual.squashStretch.settleDuration` | Retorno amortecido | ms | 30 | 200 | 1 | 80 | src/sim/animation-profile.js:264 (consumerWeak) | visual/depuração |
| `extras.visual.squashStretch.preserveVolume` | Preservar volume | liga/desliga | 0 | 1 | 1 | 1 | src/sim/animation-profile.js:264 (consumerWeak) | visual/depuração |
| `extras.visual.squashStretch.plScaling` | Alongamento por Power Level | liga/desliga | 0 | 1 | 1 | 1 | src/sim/animation-profile.js:264 (consumerWeak) | visual/depuração |

## Sprint (C mantido)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `actions.sprint.speedMultiplier` | Velocidade do sprint | × | 1 | 6 | 0.01 | 1.8 | src/sim/controller/ctrl-update.js:361 | muda · sprint |
| `actions.sprint.acceleration` | Aceleração do sprint | m/s² | 1 | 400 | 0.5 | 26 | src/sim/controller/ctrl-basico.js:17 | muda · sprint |
| `actions.sprint.braking` | Frenagem do sprint | m/s² | 1 | 400 | 0.5 | 15 | src/sim/controller/ctrl-basico.js:17 | pendente (combate) |
| `actions.sprint.turnGrip` | Aderência lateral no sprint | m/s² | 1 | 400 | 0.5 | 28 | src/sim/controller/ctrl-basico.js:17 | pendente (combate) |
| `actions.sprint.staminaDrain` | Consumo de stamina por segundo | /s | 0 | 6 | 0.01 | 0.55 | src/sim/controller/ctrl-update.js:169 | muda · sprint |
| `actions.sprint.minStamina` | Stamina mínima para entrar | — | 0 | 6 | 0.05 | 0.2 | src/sim/controller/ctrl-update.js:249 | pendente (combate) |
| `actions.sprint.entryFraction` | Entrada a partir de (fração da esquiva) | % | 0.3 | 2 | 0.01 | 0.7 | src/sim/controller/ctrl-update.js:252 | muda · sprint |
| `actions.sprint.exhaustedStop` | Stamina zerada encerra o sprint (sem efeito) | liga/desliga | 0 | 1 | 1 | 1 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |

## VFX · geral

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.master.enabled` | Efeitos visuais (todos) | liga/desliga | 0 | 1 | 1 | 1 | src/ui/perf-panel.js:57 | visual/depuração |
| `vfx.master.maxParticles` | Limite de partículas simultâneas | — | 100 | 4000 | 50 | 1400 | src/sim/graphics.js:8 | visual/depuração |
| `vfx.master.debugLog` | Registrar motivo de cada disparo | liga/desliga | 0 | 1 | 1 | 1 | src/view/vfx.js:174 | visual/depuração |
| `vfx.master.legacy` | Efeitos legados do v6 (partículas em caixa e tremor antigo) | liga/desliga | 0 | 1 | 1 | 0 | src/ui/perf-panel.js:59 | visual/depuração |
| `vfx.master.noFlash` | Sem flashes (acessibilidade) | — | 0 | 0.5 | 0.001 | 0 | src/sim/moves/bullet-punch/bullet-punch.vfx.js:42 | visual/depuração |
| `vfx.master.reduceMotion` | Reduzir movimento (acessibilidade) | — | 0 | 0.5 | 0.001 | 0 | src/sim/moves/bullet-punch/bullet-punch.vfx.js:41 | visual/depuração |
| `vfx.master.highContrast` | Alto contraste (acessibilidade) | — | 0 | 0.5 | 0.001 | 0 | src/view/solid-fx.js:164 | visual/depuração |

## VFX 3D · geral

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.solid.enabled` | Efeitos 3D sólidos (todos) | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.solid.maxObjects` | Limite de objetos 3D ativos | — | 8 | 512 | 1 | 220 | src/view/solid-fx.js:123 | visual/depuração |
| `vfx.solid.quality` | Qualidade dos efeitos 3D | seletor | 0 | 2 | 1 | 1 | src/view/solid-fx.js:300 | visual/depuração |

## VFX 3D · Poeira do dash e da arrancada (3D)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.solidDust.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.solidDust.variant` | Estilo 3D | seletor | 0 | 7 | 1 | 4 | src/view/solid-fx.js:363 | visual/depuração |
| `vfx.solidDust.intensity` | Intensidade (força geral) | × | 0.1 | 3 | 0.01 | 0.82 | src/view/solid-fx.js:230 | visual/depuração |
| `vfx.solidDust.amount` | Quantidade / taxa de emissão | × | 0.1 | 3 | 0.01 | 3 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidDust.size` | Tamanho | × | 0.3 | 3 | 0.01 | 0.49 | src/view/solid-fx.js:230 | visual/depuração |
| `vfx.solidDust.duration` | Duração (× do padrão) | × | 0.3 | 3 | 0.01 | 1 | src/view/solid-fx.js:310 | visual/depuração |
| `vfx.solidDust.velocity` | Velocidade dos objetos (×) | × | 0.2 | 3 | 0.01 | 1.85 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidDust.scatter` | Dispersão (×) | × | 0.2 | 3 | 0.01 | 0.77 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidDust.lift` | Altura (×) | × | 0.2 | 3 | 0.01 | 2.38 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidDust.turbulence` | Turbulência e rotação (×) | × | 0 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidDust.opacity` | Opacidade | % | 0.1 | 1 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidDust.fadeStart` | Começa a sumir em (% da vida) | % | 0 | 0.98 | 0.01 | 0.39 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidDust.fadeEnd` | Some por completo em (% da vida) | % | 0.05 | 1 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidDust.color` | Cor | cor | 0 | 16777200 | 1 | 16777200 | src/view/solid-fx.js:230 | visual/depuração |
| `vfx.solidDust.color2` | Cor secundária (energia) | cor | 0 | 16777200 | 1 | 16777200 | src/view/solid-fx.js:230 | visual/depuração |

## VFX 3D · Vento do dash e da arrancada (3D)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.solidWind.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 0 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.solidWind.variant` | Estilo 3D | seletor | 0 | 3 | 1 | 2 | src/view/solid-fx.js:371 | visual/depuração |
| `vfx.solidWind.intensity` | Intensidade (força geral) | × | 0.1 | 3 | 0.01 | 1 | src/view/solid-fx.js:230 | visual/depuração |
| `vfx.solidWind.amount` | Quantidade / taxa de emissão | × | 0.1 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidWind.size` | Tamanho | × | 0.3 | 3 | 0.01 | 1 | src/view/solid-fx.js:230 | visual/depuração |
| `vfx.solidWind.duration` | Duração (× do padrão) | × | 0.3 | 3 | 0.01 | 1 | src/view/solid-fx.js:310 | visual/depuração |
| `vfx.solidWind.velocity` | Velocidade dos objetos (×) | × | 0.2 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidWind.scatter` | Dispersão (×) | × | 0.2 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidWind.lift` | Altura (×) | × | 0.2 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidWind.turbulence` | Turbulência e rotação (×) | × | 0 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidWind.opacity` | Opacidade | % | 0.1 | 1 | 0.01 | 0.7 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidWind.fadeStart` | Começa a sumir em (% da vida) | % | 0 | 0.98 | 0.01 | 0.6 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidWind.fadeEnd` | Some por completo em (% da vida) | % | 0.05 | 1 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidWind.color` | Cor | cor | 0 | 16777200 | 1 | 40447 | src/view/solid-fx.js:230 | visual/depuração |

## VFX 3D · Poeira da corrida (3D)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.solidRunDust.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.solidRunDust.variant` | Estilo 3D | seletor | 0 | 2 | 1 | 2 | src/view/solid-fx.js:11 | visual/depuração |
| `vfx.solidRunDust.intensity` | Intensidade (força geral) | × | 0.1 | 3 | 0.01 | 0.63 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunDust.amount` | Quantidade / taxa de emissão | × | 0.1 | 3 | 0.01 | 3 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunDust.size` | Tamanho | × | 0.3 | 3 | 0.01 | 0.72 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunDust.duration` | Duração (× do padrão) | × | 0.3 | 3 | 0.01 | 0.73 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunDust.velocity` | Velocidade dos objetos (×) | × | 0.2 | 3 | 0.01 | 1.48 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunDust.scatter` | Dispersão (×) | × | 0.2 | 3 | 0.01 | 0.6 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunDust.lift` | Altura (×) | × | 0.2 | 3 | 0.01 | 0.69 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunDust.turbulence` | Turbulência e rotação (×) | × | 0 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunDust.opacity` | Opacidade | % | 0.1 | 1 | 0.01 | 0.75 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunDust.fadeStart` | Começa a sumir em (% da vida) | % | 0 | 0.98 | 0.01 | 0.38 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunDust.fadeEnd` | Some por completo em (% da vida) | % | 0.05 | 1 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunDust.color` | Cor | cor | 0 | 16777200 | 1 | 16777200 | src/view/solid-fx.js:166 | visual/depuração |

## VFX 3D · Vento da corrida (3D)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.solidRunWind.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 0 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.solidRunWind.variant` | Estilo 3D | seletor | 0 | 2 | 1 | 2 | src/view/solid-fx.js:11 | visual/depuração |
| `vfx.solidRunWind.intensity` | Intensidade (força geral) | × | 0.1 | 3 | 0.01 | 1.98 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunWind.amount` | Quantidade / taxa de emissão | × | 0.1 | 3 | 0.01 | 0.52 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunWind.size` | Tamanho | × | 0.3 | 3 | 0.01 | 0.6 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunWind.duration` | Duração (× do padrão) | × | 0.3 | 3 | 0.01 | 0.64 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunWind.velocity` | Velocidade dos objetos (×) | × | 0.2 | 3 | 0.01 | 1.8 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunWind.scatter` | Dispersão (×) | × | 0.2 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunWind.lift` | Altura (×) | × | 0.2 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunWind.turbulence` | Turbulência e rotação (×) | × | 0 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunWind.opacity` | Opacidade | % | 0.1 | 1 | 0.01 | 0.7 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunWind.fadeStart` | Começa a sumir em (% da vida) | % | 0 | 0.98 | 0.01 | 0.6 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunWind.fadeEnd` | Some por completo em (% da vida) | % | 0.05 | 1 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidRunWind.color` | Cor | cor | 0 | 16777200 | 1 | 14677000 | src/view/solid-fx.js:166 | visual/depuração |

## VFX 3D · Esquiva (3D)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.solidDodge.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.solidDodge.variant` | Estilo 3D | seletor | 0 | 2 | 1 | 2 | src/view/solid-fx.js:11 | visual/depuração |
| `vfx.solidDodge.intensity` | Intensidade (força geral) | × | 0.1 | 3 | 0.01 | 1.57 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidDodge.amount` | Quantidade / taxa de emissão | × | 0.1 | 3 | 0.01 | 0.75 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidDodge.size` | Tamanho | × | 0.3 | 3 | 0.01 | 1.6 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidDodge.duration` | Duração (× do padrão) | × | 0.3 | 3 | 0.01 | 0.59 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidDodge.velocity` | Velocidade dos objetos (×) | × | 0.2 | 3 | 0.01 | 1.95 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidDodge.scatter` | Dispersão (×) | × | 0.2 | 3 | 0.01 | 0.4 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidDodge.lift` | Altura (×) | × | 0.2 | 3 | 0.01 | 0.47 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidDodge.turbulence` | Turbulência e rotação (×) | × | 0 | 3 | 0.01 | 1.72 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidDodge.opacity` | Opacidade | % | 0.1 | 1 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidDodge.fadeStart` | Começa a sumir em (% da vida) | % | 0 | 0.98 | 0.01 | 0.3 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidDodge.fadeEnd` | Some por completo em (% da vida) | % | 0.05 | 1 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidDodge.color` | Cor | cor | 0 | 16777200 | 1 | 16777200 | src/view/solid-fx.js:166 | visual/depuração |

## VFX 3D · Aterrissagem e colisão com o chão (3D)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.solidLanding.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.solidLanding.variant` | Estilo 3D | seletor | 0 | 2 | 1 | 0 | src/view/solid-fx.js:11 | visual/depuração |
| `vfx.solidLanding.intensity` | Intensidade (força geral) | × | 0.1 | 3 | 0.01 | 1.33 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidLanding.amount` | Quantidade / taxa de emissão | × | 0.1 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidLanding.size` | Tamanho | × | 0.3 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidLanding.duration` | Duração (× do padrão) | × | 0.3 | 3 | 0.01 | 1.5 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidLanding.velocity` | Velocidade dos objetos (×) | × | 0.2 | 3 | 0.01 | 0.66 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidLanding.scatter` | Dispersão (×) | × | 0.2 | 3 | 0.01 | 0.76 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidLanding.lift` | Altura (×) | × | 0.2 | 3 | 0.01 | 1.12 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidLanding.turbulence` | Turbulência e rotação (×) | × | 0 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidLanding.opacity` | Opacidade | % | 0.1 | 1 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidLanding.fadeStart` | Começa a sumir em (% da vida) | % | 0 | 0.98 | 0.01 | 0.6 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidLanding.fadeEnd` | Some por completo em (% da vida) | % | 0.05 | 1 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidLanding.color` | Cor | cor | 0 | 16777200 | 1 | 14272900 | src/view/solid-fx.js:166 | visual/depuração |

## VFX 3D · Impacto do golpe (3D)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.solidImpact.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.solidImpact.variant` | Estilo 3D | seletor | 0 | 2 | 1 | 0 | src/view/solid-fx.js:11 | visual/depuração |
| `vfx.solidImpact.intensity` | Intensidade (força geral) | × | 0.1 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidImpact.amount` | Quantidade / taxa de emissão | × | 0.1 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidImpact.size` | Tamanho | × | 0.3 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidImpact.duration` | Duração (× do padrão) | × | 0.3 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidImpact.velocity` | Velocidade dos objetos (×) | × | 0.2 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidImpact.scatter` | Dispersão (×) | × | 0.2 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidImpact.lift` | Altura (×) | × | 0.2 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidImpact.turbulence` | Turbulência e rotação (×) | × | 0 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidImpact.opacity` | Opacidade | % | 0.1 | 1 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidImpact.fadeStart` | Começa a sumir em (% da vida) | % | 0 | 0.98 | 0.01 | 0.6 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidImpact.fadeEnd` | Some por completo em (% da vida) | % | 0.05 | 1 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidImpact.color` | Cor | cor | 0 | 16777200 | 1 | 16757600 | src/view/solid-fx.js:166 | visual/depuração |

## VFX 3D · Bloqueio e defesa perfeita (3D)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.solidBlock.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.solidBlock.variant` | Estilo 3D | seletor | 0 | 2 | 1 | 2 | src/view/solid-fx.js:11 | visual/depuração |
| `vfx.solidBlock.intensity` | Intensidade (força geral) | × | 0.1 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidBlock.amount` | Quantidade / taxa de emissão | × | 0.1 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidBlock.size` | Tamanho | × | 0.3 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidBlock.duration` | Duração (× do padrão) | × | 0.3 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidBlock.velocity` | Velocidade dos objetos (×) | × | 0.2 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidBlock.scatter` | Dispersão (×) | × | 0.2 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidBlock.lift` | Altura (×) | × | 0.2 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidBlock.turbulence` | Turbulência e rotação (×) | × | 0 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidBlock.opacity` | Opacidade | % | 0.1 | 1 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidBlock.fadeStart` | Começa a sumir em (% da vida) | % | 0 | 0.98 | 0.01 | 0.6 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidBlock.fadeEnd` | Some por completo em (% da vida) | % | 0.05 | 1 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidBlock.color` | Cor | cor | 0 | 16777200 | 1 | 7588610 | src/view/solid-fx.js:166 | visual/depuração |

## VFX 3D · Colisão entre tackles (3D)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.solidClash.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 0 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.solidClash.variant` | Estilo 3D | seletor | 0 | 2 | 1 | 0 | src/view/solid-fx.js:11 | visual/depuração |
| `vfx.solidClash.intensity` | Intensidade (força geral) | × | 0.1 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidClash.amount` | Quantidade / taxa de emissão | × | 0.1 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidClash.size` | Tamanho | × | 0.3 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidClash.duration` | Duração (× do padrão) | × | 0.3 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidClash.velocity` | Velocidade dos objetos (×) | × | 0.2 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidClash.scatter` | Dispersão (×) | × | 0.2 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidClash.lift` | Altura (×) | × | 0.2 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidClash.turbulence` | Turbulência e rotação (×) | × | 0 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidClash.opacity` | Opacidade | % | 0.1 | 1 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidClash.fadeStart` | Começa a sumir em (% da vida) | % | 0 | 0.98 | 0.01 | 0.6 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidClash.fadeEnd` | Some por completo em (% da vida) | % | 0.05 | 1 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidClash.color` | Cor | cor | 0 | 16777200 | 1 | 16770400 | src/view/solid-fx.js:166 | visual/depuração |

## VFX 3D · Invocação do Reflect (3D)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.solidReflect.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.solidReflect.variant` | Estilo 3D | seletor | 0 | 2 | 1 | 0 | src/view/solid-fx.js:11 | visual/depuração |
| `vfx.solidReflect.intensity` | Intensidade (força geral) | × | 0.1 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidReflect.amount` | Quantidade / taxa de emissão | × | 0.1 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidReflect.size` | Tamanho | × | 0.3 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidReflect.duration` | Duração (× do padrão) | × | 0.3 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidReflect.velocity` | Velocidade dos objetos (×) | × | 0.2 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidReflect.scatter` | Dispersão (×) | × | 0.2 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidReflect.lift` | Altura (×) | × | 0.2 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidReflect.turbulence` | Turbulência e rotação (×) | × | 0 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidReflect.opacity` | Opacidade | % | 0.1 | 1 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidReflect.fadeStart` | Começa a sumir em (% da vida) | % | 0 | 0.98 | 0.01 | 0.6 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidReflect.fadeEnd` | Some por completo em (% da vida) | % | 0.05 | 1 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.solidReflect.color` | Cor | cor | 0 | 16777200 | 1 | 7588610 | src/view/solid-fx.js:166 | visual/depuração |

## VFX · Impacto (hit)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.hit.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/vfx.js:48 | visual/depuração |
| `vfx.hit.variant` | Variante | seletor | 0 | 3 | 1 | 1 | src/view/solid-fx.js:11 | visual/depuração |
| `vfx.hit.size` | Tamanho | × | 0.2 | 3 | 0.01 | 2.23 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.hit.duration` | Duração | s | 0.05 | 2 | 0.01 | 0.71 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.hit.count` | Quantidade de partículas | — | 1 | 80 | 1 | 18 | src/view/solid-fx.js:67 | visual/depuração |
| `vfx.hit.intensity` | Intensidade | × | 0.1 | 3 | 0.01 | 2.63 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.hit.speed` | Velocidade de expansão | m/s | 0.5 | 25 | 0.1 | 6 | src/view/solid-fx.js:243 | visual/depuração |
| `vfx.hit.opacity` | Opacidade | % | 0 | 1 | 0.01 | 0.95 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.hit.color` | Cor | cor | 0 | 16777200 | 1 | 16777200 | src/view/vfx.js:48 | visual/depuração |
| `vfx.hit.glow` | Brilho | × | 0.2 | 4 | 0.01 | 1.2 | src/view/solid-fx.js:447 | visual/depuração |
| `vfx.hit.fade` | Dissipação | — | 0.3 | 4 | 0.01 | 2.58 | src/view/solid-fx.js:291 | visual/depuração |
| `vfx.hit.color2` | Cor secundária | cor | 0 | 16777200 | 1 | 16773600 | src/view/vfx.js:48 | visual/depuração |
| `vfx.hit.cone` | Abertura do cone de fagulhas (variante D) | ° | 0 | 1.4 | 0.01 | 0.55 | src/view/vfx.js:436 | visual/depuração |
| `vfx.hit.debris` | Detritos (variante D) | × | 0 | 3 | 0.05 | 1 | src/view/vfx.js:442 | visual/depuração |
| `vfx.hit.dust` | Poeira rente ao chão (variante D) | × | 0 | 3 | 0.05 | 1 | src/view/solid-fx.js:263 | visual/depuração |
| `vfx.hit.crack` | Rachadura no chão (variante D) | × | 0 | 2 | 0.05 | 1 | src/view/vfx/runtime.js:261 | visual/depuração |
| `vfx.hit.byDamage` | Escala pelo dano e lançamento reais (variante D) | % | 0 | 1 | 0.01 | 1 | src/view/vfx.js:424 | visual/depuração |
| `vfx.hit.coreOn` | Núcleo de brilho — o círculo central (variante D) | liga/desliga | 0 | 1 | 1 | 1 | src/view/vfx.js:429 | visual/depuração |
| `vfx.hit.coreSize` | Tamanho do núcleo de brilho (variante D) | × | 0 | 3 | 0.05 | 1 | src/view/vfx.js:429 | visual/depuração |
| `vfx.hit.bladeOn` | Lâmina de luz na direção do golpe (variante D) | liga/desliga | 0 | 1 | 1 | 1 | src/view/vfx.js:430 | visual/depuração |
| `vfx.hit.bladeLength` | Comprimento da lâmina de luz (variante D) | × | 0 | 3 | 0.05 | 1 | src/view/vfx.js:430 | visual/depuração |
| `vfx.hit.bladeWidth` | Espessura da lâmina de luz (variante D) | × | 0 | 3 | 0.05 | 1 | src/view/vfx.js:430 | visual/depuração |
| `vfx.hit.ringPlaneOn` | Anel de pressão, o círculo vertical (variante D) | liga/desliga | 0 | 1 | 1 | 1 | src/view/vfx.js:432 | visual/depuração |
| `vfx.hit.ringPlaneSize` | Expansão do anel de pressão (variante D) | × | 0 | 3 | 0.05 | 1 | src/view/vfx.js:432 | visual/depuração |
| `vfx.hit.ringGroundOn` | Anel no chão (variante D) | liga/desliga | 0 | 1 | 1 | 1 | src/view/vfx.js:433 | visual/depuração |
| `vfx.hit.ringGroundSize` | Expansão do anel no chão (variante D) | × | 0 | 3 | 0.05 | 1 | src/view/vfx.js:433 | visual/depuração |
| `vfx.hit.ringOpacity` | Opacidade dos anéis (variante D) | × | 0 | 2 | 0.05 | 1 | src/view/vfx.js:427 | visual/depuração |
| `vfx.hit.sparksOn` | Fagulhas em risco (variante D) | liga/desliga | 0 | 1 | 1 | 1 | src/view/vfx.js:438 | visual/depuração |
| `vfx.hit.sparkLength` | Comprimento das fagulhas (variante D) | × | 0 | 3 | 0.05 | 1 | src/view/vfx.js:438 | visual/depuração |
| `vfx.hit.sparkWidth` | Espessura das fagulhas (variante D) | × | 0 | 3 | 0.05 | 1 | src/view/vfx.js:438 | visual/depuração |
| `vfx.hit.embersOn` | Faíscas que caem (variante D) | liga/desliga | 0 | 1 | 1 | 1 | src/view/vfx.js:439 | visual/depuração |
| `vfx.hit.emberSize` | Tamanho das faíscas que caem (variante D) | × | 0 | 3 | 0.05 | 1 | src/view/vfx.js:439 | visual/depuração |
| `vfx.hit.backSplash` | Respingo para trás (variante D) | % | 0 | 1 | 0.01 | 0.25 | src/view/vfx.js:436 | visual/depuração |
| `vfx.hit.debrisSize` | Tamanho dos detritos (variante D) | × | 0 | 3 | 0.05 | 1 | src/view/vfx.js:445 | visual/depuração |
| `vfx.hit.dustSize` | Tamanho da poeira (variante D) | × | 0 | 3 | 0.05 | 1 | src/view/vfx.js:449 | visual/depuração |

## VFX · Speedlines da esquiva

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.dodge.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.dodge.variant` | Variante | seletor | 0 | 2 | 1 | 0 | src/view/solid-fx.js:11 | visual/depuração |
| `vfx.dodge.count` | Quantidade de partículas | — | 1 | 80 | 1 | 6 | src/view/solid-fx.js:67 | visual/depuração |
| `vfx.dodge.length` | Comprimento | m | 0.1 | 4 | 0.01 | 1.4 | src/view/vfx.js:268 | visual/depuração |
| `vfx.dodge.duration` | Duração | s | 0.05 | 2 | 0.01 | 0.22 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.dodge.width` | Largura | m | 0.01 | 0.4 | 0.005 | 0.07 | src/view/vfx.js:268 | visual/depuração |
| `vfx.dodge.opacity` | Opacidade | % | 0 | 1 | 0.01 | 0.7 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.dodge.spread` | Dispersão / abertura | m | 0 | 2 | 0.01 | 0.45 | src/view/vfx.js:457 | visual/depuração |
| `vfx.dodge.interval` | Intervalo | s | 0.005 | 0.4 | 0.005 | 0.025 | src/view/vfx.js:346 | visual/depuração |
| `vfx.dodge.intensity` | Intensidade | × | 0.1 | 3 | 0.01 | 1 | src/view/vfx.js:268 | visual/depuração |
| `vfx.dodge.color` | Cor | cor | 0 | 16777200 | 1 | 16777200 | src/view/vfx.js:268 | visual/depuração |

## VFX · Speedlines do sprint

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.sprint.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.sprint.variant` | Variante | seletor | 0 | 2 | 1 | 0 | src/view/solid-fx.js:11 | visual/depuração |
| `vfx.sprint.density` | Densidade | × | 0.1 | 4 | 0.01 | 1 | src/view/vfx.js:346 | visual/depuração |
| `vfx.sprint.length` | Comprimento | m | 0.1 | 4 | 0.01 | 1.1 | src/view/solid-fx.js:146 | visual/depuração |
| `vfx.sprint.speed` | Velocidade de expansão | m/s | 0.5 | 25 | 0.1 | 9 | src/view/solid-fx.js:243 | visual/depuração |
| `vfx.sprint.spread` | Dispersão / abertura | m | 0 | 2 | 0.01 | 0.5 | src/view/vfx.js:457 | visual/depuração |
| `vfx.sprint.intensity` | Intensidade | × | 0.1 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.sprint.opacity` | Opacidade | % | 0 | 1 | 0.01 | 0.55 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.sprint.color` | Cor | cor | 0 | 16777200 | 1 | 14218500 | src/view/solid-fx.js:166 | visual/depuração |
| `vfx.sprint.frequency` | Frequência | /s | 1 | 80 | 1 | 28 | src/view/vfx.js:346 | visual/depuração |

## VFX · Bloqueio normal

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.block.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.block.variant` | Variante | seletor | 0 | 3 | 1 | 2 | src/view/solid-fx.js:11 | visual/depuração |
| `vfx.block.size` | Tamanho | × | 0.2 | 3 | 0.01 | 1 | src/view/vfx.js:338 | visual/depuração |
| `vfx.block.opacity` | Opacidade | % | 0 | 1 | 0.01 | 0.75 | src/view/vfx.js:338 | visual/depuração |
| `vfx.block.duration` | Duração | s | 0.05 | 2 | 0.01 | 0.3 | src/view/vfx.js:338 | visual/depuração |
| `vfx.block.color` | Cor | cor | 0 | 16777200 | 1 | 7588610 | src/view/vfx.js:338 | visual/depuração |
| `vfx.block.intensity` | Intensidade | × | 0.1 | 3 | 0.01 | 1.22 | src/view/vfx.js:338 | visual/depuração |
| `vfx.block.count` | Quantidade de partículas | — | 1 | 80 | 1 | 10 | src/view/vfx.js:397 | visual/depuração |
| `vfx.block.expansion` | Expansão | × | 0 | 3 | 0.01 | 1 | src/view/vfx.js:338 | visual/depuração |

## VFX · Bloqueio perfeito

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.perfect.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.perfect.variant` | Variante | seletor | 0 | 2 | 1 | 0 | src/view/solid-fx.js:11 | visual/depuração |
| `vfx.perfect.intensity` | Intensidade | × | 0.1 | 3 | 0.01 | 2.84 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.perfect.duration` | Duração | s | 0.05 | 2 | 0.01 | 0.55 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.perfect.scale` | Escala | × | 0.2 | 3 | 0.01 | 1.2 | src/view/solid-fx.js:293 | visual/depuração |
| `vfx.perfect.count` | Quantidade de partículas | — | 1 | 80 | 1 | 26 | src/view/solid-fx.js:67 | visual/depuração |
| `vfx.perfect.wave` | Tamanho da onda | m | 0.2 | 6 | 0.01 | 2.4 | src/view/solid-fx.js:156 | visual/depuração |
| `vfx.perfect.glow` | Brilho | × | 0.2 | 4 | 0.01 | 1.6 | src/view/solid-fx.js:447 | visual/depuração |
| `vfx.perfect.color` | Cor | cor | 0 | 16777200 | 1 | 10354600 | src/view/solid-fx.js:166 | visual/depuração |
| `vfx.perfect.color2` | Cor secundária | cor | 0 | 16777200 | 1 | 16777200 | src/view/solid-fx.js:230 | visual/depuração |
| `vfx.perfect.fade` | Dissipação | — | 0.3 | 4 | 0.01 | 1.4 | src/view/solid-fx.js:291 | visual/depuração |
| `vfx.perfect.flash` | Intensidade do flash | % | 0 | 1 | 0.01 | 0.55 | src/view/vfx.js:161 | visual/depuração |
| `vfx.perfect.freeze` | Congelamento visual (só poses e efeito) | ms | 0 | 0.25 | 0.005 | 0.07 | src/view/vfx.js:43 | visual/depuração |

## VFX · Colisão com o chão (knockback)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.ground.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.ground.variant` | Variante | seletor | 0 | 3 | 1 | 3 | src/view/vfx.js:348 | visual/depuração |
| `vfx.ground.radius` | Raio | m | 0.2 | 4 | 0.01 | 2.9 | src/view/vfx.js:313 | visual/depuração |
| `vfx.ground.density` | Densidade | × | 0.1 | 4 | 0.01 | 1.52 | src/view/vfx.js:346 | visual/depuração |
| `vfx.ground.duration` | Duração | s | 0.05 | 2 | 0.01 | 0.82 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.ground.intensity` | Intensidade | × | 0.1 | 3 | 0.01 | 1.57 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.ground.speed` | Velocidade de expansão | m/s | 0.5 | 25 | 0.1 | 3.5 | src/view/solid-fx.js:243 | visual/depuração |
| `vfx.ground.opacity` | Opacidade | % | 0 | 1 | 0.01 | 0.85 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.ground.particleSize` | Tamanho das partículas | m | 0.02 | 1 | 0.01 | 0.22 | src/view/vfx.js:559 | visual/depuração |
| `vfx.ground.elevation` | Elevação | × | 0 | 3 | 0.01 | 0.5 | src/view/vfx.js:559 | visual/depuração |
| `vfx.ground.color` | Cor | cor | 0 | 16777200 | 1 | 15134200 | src/view/solid-fx.js:166 | visual/depuração |
| `vfx.ground.minImpact` | Impacto mínimo para disparar | m/s | 0 | 15 | 0.1 | 2 | src/view/quarks/bridge.js:79 | visual/depuração |
| `vfx.ground.mixA` | Combinado (D): poeira (A) | × | 0 | 2 | 0.01 | 1 | src/view/vfx.js:570 | visual/depuração |
| `vfx.ground.mixB` | Combinado (D): anel (B) | × | 0 | 2 | 0.01 | 0.8 | src/view/vfx.js:570 | visual/depuração |
| `vfx.ground.mixC` | Combinado (D): estilhaços (C) | × | 0 | 2 | 0.01 | 0.6 | src/view/vfx.js:570 | visual/depuração |

## VFX · Pouso do pulo regular

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.jumpLanding.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.jumpLanding.variant` | Variante | seletor | 0 | 0 | 1 | 0 | src/view/solid-fx.js:11 | visual/depuração |
| `vfx.jumpLanding.radius` | Raio | m | 0.2 | 4 | 0.01 | 1.3 | src/view/vfx.js:313 | visual/depuração |
| `vfx.jumpLanding.rings` | Quantidade de ondas (pouso do pulo) | — | 1 | 3 | 1 | 1 | src/view/vfx/runtime.js:382 | visual/depuração |
| `vfx.jumpLanding.expansion` | Expansão | × | 0 | 3 | 0.01 | 1 | src/view/vfx.js:338 | visual/depuração |
| `vfx.jumpLanding.duration` | Duração | s | 0.05 | 2 | 0.01 | 0.35 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.jumpLanding.intensity` | Intensidade | × | 0.1 | 3 | 0.01 | 1.4 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.jumpLanding.opacity` | Opacidade | % | 0 | 1 | 0.01 | 0.8 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.jumpLanding.color` | Cor | cor | 0 | 16777200 | 1 | 14674400 | src/view/solid-fx.js:166 | visual/depuração |
| `vfx.jumpLanding.fade` | Dissipação | — | 0.3 | 4 | 0.01 | 1.4 | src/view/solid-fx.js:291 | visual/depuração |
| `vfx.jumpLanding.minImpact` | Impacto mínimo para disparar | m/s | 0 | 15 | 0.1 | 1.5 | src/view/vfx.js:251 | visual/depuração |
| `vfx.jumpLanding.fallScale` | Escala pela velocidade da queda (pouso do pulo) | % | 0 | 1 | 0.01 | 0.5 | src/view/vfx.js:377 | visual/depuração |

## VFX · Impacto vertical em paredes e objetos

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.wallImpact.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.wallImpact.variant` | Variante | seletor | 0 | 0 | 1 | 0 | src/view/solid-fx.js:11 | visual/depuração |
| `vfx.wallImpact.size` | Tamanho | × | 0.2 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.wallImpact.duration` | Duração | s | 0.05 | 2 | 0.01 | 0.45 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.wallImpact.intensity` | Intensidade | × | 0.1 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.wallImpact.opacity` | Opacidade | % | 0 | 1 | 0.01 | 0.9 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.wallImpact.color` | Cor | cor | 0 | 16777200 | 1 | 14674400 | src/view/solid-fx.js:166 | visual/depuração |
| `vfx.wallImpact.color2` | Cor secundária | cor | 0 | 16777200 | 1 | 16777200 | src/view/solid-fx.js:230 | visual/depuração |
| `vfx.wallImpact.glow` | Brilho | × | 0.2 | 4 | 0.01 | 1.2 | src/view/solid-fx.js:447 | visual/depuração |
| `vfx.wallImpact.fade` | Dissipação | — | 0.3 | 4 | 0.01 | 1.6 | src/view/solid-fx.js:291 | visual/depuração |
| `vfx.wallImpact.minSpeed` | Velocidade mínima do choque | m/s | 0 | 15 | 0.1 | 3 | src/view/vfx.js:299 | visual/depuração |
| `vfx.wallImpact.cooldown` | Intervalo entre impactos do mesmo lutador | s | 0 | 2 | 0.05 | 0.35 | src/view/vfx.js:300 | visual/depuração |
| `vfx.wallImpact.speedScale` | Escala pela velocidade do choque | % | 0 | 1 | 0.01 | 0.6 | src/view/vfx.js:384 | visual/depuração |
| `vfx.wallImpact.arenaOn` | Parede da arena (extremidades) | liga/desliga | 0 | 1 | 1 | 1 | src/view/vfx.js:297 | visual/depuração |
| `vfx.wallImpact.arenaScale` | Escala do impacto na parede da arena | × | 0 | 3 | 0.05 | 1 | src/view/vfx.js:384 | visual/depuração |
| `vfx.wallImpact.arenaHeight` | Altura equivalente da parede da arena | m | 0.2 | 6 | 0.1 | 2 | src/view/vfx.js:311 | visual/depuração |
| `vfx.wallImpact.objectsOn` | Objetos do cenário (pilares, caixas, plataformas, destrutíveis) | liga/desliga | 0 | 1 | 1 | 1 | src/view/vfx.js:297 | visual/depuração |
| `vfx.wallImpact.objectScale` | Escala do impacto em objetos | × | 0 | 3 | 0.05 | 1 | src/view/vfx.js:384 | visual/depuração |
| `vfx.wallImpact.sizeInfluence` | Influência do tamanho do objeto | % | 0 | 1 | 0.01 | 1 | src/view/vfx.js:384 | visual/depuração |
| `vfx.wallImpact.refSize` | Tamanho de referência do objeto | m | 0.5 | 6 | 0.1 | 2 | src/view/vfx.js:310 | visual/depuração |
| `vfx.wallImpact.wallRing` | Onda circular no plano da parede | liga/desliga | 0 | 1 | 1 | 1 | src/view/vfx.js:387 | visual/depuração |
| `vfx.wallImpact.wallRingSize` | Expansão da onda da parede | × | 0 | 3 | 0.05 | 1 | src/view/vfx.js:387 | visual/depuração |
| `vfx.wallImpact.wallStreak` | Faixa vertical de luz | liga/desliga | 0 | 1 | 1 | 1 | src/view/vfx.js:388 | visual/depuração |
| `vfx.wallImpact.wallStreakLength` | Comprimento da faixa vertical | × | 0 | 3 | 0.05 | 1 | src/view/vfx.js:388 | visual/depuração |
| `vfx.wallImpact.wallSparks` | Faíscas ao longo da parede | liga/desliga | 0 | 1 | 1 | 1 | src/view/vfx.js:389 | visual/depuração |
| `vfx.wallImpact.wallSparkCount` | Quantidade de faíscas da parede | — | 0 | 40 | 1 | 10 | src/view/vfx.js:389 | visual/depuração |
| `vfx.wallImpact.wallSparkLength` | Comprimento das faíscas da parede | × | 0 | 3 | 0.05 | 1 | src/view/vfx.js:389 | visual/depuração |
| `vfx.wallImpact.wallDust` | Poeira que sobe pela parede | liga/desliga | 0 | 1 | 1 | 1 | src/view/vfx.js:393 | visual/depuração |
| `vfx.wallImpact.wallDustAmount` | Quantidade de poeira da parede | × | 0 | 4 | 0.05 | 1 | src/view/vfx.js:393 | visual/depuração |
| `vfx.wallImpact.wallDustRise` | Subida da poeira | × | 0 | 3 | 0.05 | 1 | src/view/vfx.js:393 | visual/depuração |

## VFX · Clash entre tackles

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.clash.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.clash.variant` | Variante | seletor | 0 | 2 | 1 | 0 | src/view/solid-fx.js:11 | visual/depuração |
| `vfx.clash.scale` | Escala | × | 0.2 | 3 | 0.01 | 1.2 | src/view/solid-fx.js:293 | visual/depuração |
| `vfx.clash.duration` | Duração | s | 0.05 | 2 | 0.01 | 0.6 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.clash.intensity` | Intensidade | × | 0.1 | 3 | 0.01 | 2.52 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.clash.count` | Quantidade de partículas | — | 1 | 80 | 1 | 30 | src/view/solid-fx.js:67 | visual/depuração |
| `vfx.clash.color` | Cor | cor | 0 | 16777200 | 1 | 16770400 | src/view/solid-fx.js:166 | visual/depuração |
| `vfx.clash.color2` | Cor secundária | cor | 0 | 16777200 | 1 | 16743000 | src/view/solid-fx.js:230 | visual/depuração |
| `vfx.clash.radius` | Raio | m | 0.2 | 4 | 0.01 | 1.6 | src/view/vfx.js:313 | visual/depuração |
| `vfx.clash.speed` | Velocidade de expansão | m/s | 0.5 | 25 | 0.1 | 7 | src/view/solid-fx.js:243 | visual/depuração |
| `vfx.clash.glow` | Brilho | × | 0.2 | 4 | 0.01 | 1.6 | src/view/solid-fx.js:447 | visual/depuração |

## VFX · Exaustão (indicadores azuis)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.exhaust.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.exhaust.variant` | Variante | seletor | 0 | 2 | 1 | 0 | src/view/solid-fx.js:11 | visual/depuração |
| `vfx.exhaust.target` | Mostrar em | seletor | 0 | 2 | 1 | 0 | src/view/vfx.js:273 | visual/depuração |
| `vfx.exhaust.count` | Quantidade de partículas | — | 1 | 80 | 1 | 5 | src/view/solid-fx.js:67 | visual/depuração |
| `vfx.exhaust.fallSpeed` | Velocidade de queda | m/s | 0.1 | 6 | 0.01 | 1.1 | src/view/vfx.js:607 | visual/depuração |
| `vfx.exhaust.spread` | Dispersão / abertura | m | 0 | 2 | 0.01 | 0.55 | src/view/vfx.js:457 | visual/depuração |
| `vfx.exhaust.size` | Tamanho | × | 0.2 | 3 | 0.01 | 0.26 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.exhaust.opacity` | Opacidade | % | 0 | 1 | 0.01 | 0.85 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.exhaust.glow` | Brilho | × | 0.2 | 4 | 0.01 | 0.65 | src/view/solid-fx.js:447 | visual/depuração |
| `vfx.exhaust.startHeight` | Altura inicial | m | 0.3 | 4 | 0.01 | 2.1 | src/view/vfx.js:607 | visual/depuração |
| `vfx.exhaust.interval` | Intervalo | s | 0.005 | 0.4 | 0.005 | 0.14 | src/view/vfx.js:346 | visual/depuração |
| `vfx.exhaust.color` | Cor | cor | 0 | 16777200 | 1 | 5219330 | src/view/solid-fx.js:166 | visual/depuração |

## VFX · Regeneração de stamina (amarelo)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.regen.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.regen.variant` | Variante | seletor | 0 | 2 | 1 | 0 | src/view/solid-fx.js:11 | visual/depuração |
| `vfx.regen.count` | Quantidade de partículas | — | 1 | 80 | 1 | 3 | src/view/solid-fx.js:67 | visual/depuração |
| `vfx.regen.frequency` | Frequência | /s | 1 | 80 | 1 | 7 | src/view/vfx.js:346 | visual/depuração |
| `vfx.regen.speed` | Velocidade de expansão | m/s | 0.5 | 25 | 0.1 | 1.2 | src/view/solid-fx.js:243 | visual/depuração |
| `vfx.regen.height` | Altura | m | 0.3 | 4 | 0.01 | 1.8 | src/view/solid-fx.js:223 | visual/depuração |
| `vfx.regen.intensity` | Intensidade | × | 0.1 | 3 | 0.01 | 2.23 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.regen.size` | Tamanho | × | 0.2 | 3 | 0.01 | 0.28 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.regen.opacity` | Opacidade | % | 0 | 1 | 0.01 | 0.8 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.regen.spread` | Dispersão / abertura | m | 0 | 2 | 0.01 | 0.5 | src/view/vfx.js:457 | visual/depuração |
| `vfx.regen.color` | Cor | cor | 0 | 16777200 | 1 | 16765800 | src/view/solid-fx.js:166 | visual/depuração |
| `vfx.regen.scaleWithRate` | Intensidade acompanha a taxa de recuperação | liga/desliga | 0 | 1 | 1 | 1 | src/view/vfx.js:618 | visual/depuração |

## VFX · Rochas telecinéticas (Psyshock)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.rock.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.rock.variant` | Variante | seletor | 0 | 2 | 1 | 1 | src/view/world-view/wv-entities.js:58 | visual/depuração |
| `vfx.rock.scale` | Escala | × | 0.2 | 3 | 0.01 | 1 | src/view/world-view/wv-update.js:65 | visual/depuração |
| `vfx.rock.rotSpeed` | Velocidade de rotação | rad/s | 0 | 10 | 0.1 | 3.5 | src/view/world-view/wv-entities.js:91 | visual/depuração |
| `vfx.rock.trail` | Rastro de partículas | liga/desliga | 0 | 1 | 1 | 1 | src/view/world-view/wv-update.js:88 | visual/depuração |
| `vfx.rock.trailDensity` | Densidade do rastro (sem efeito) | — | 1 | 30 | 1 | 8 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `vfx.rock.shatter` | Estilhaçar no impacto | liga/desliga | 0 | 1 | 1 | 1 | src/view/world-view/wv-update.js:198 | visual/depuração |
| `vfx.rock.shatterCount` | Fragmentos de estilhaço | — | 4 | 32 | 1 | 14 | src/view/world-view/wv-particles.js:48 | visual/depuração |
| `vfx.rock.shatterSpeed` | Velocidade dos estilhaços | × | 0.2 | 3 | 0.05 | 1 | src/view/world-view/wv-particles.js:50 | visual/depuração |
| `vfx.rock.shatterLife` | Duração dos estilhaços | × | 0.3 | 3 | 0.05 | 1 | src/view/world-view/wv-particles.js:50 | visual/depuração |
| `vfx.rock.shatterSize` | Tamanho dos estilhaços | × | 0.4 | 3 | 0.05 | 1 | src/view/world-view/wv-particles.js:50 | visual/depuração |
| `vfx.rock.glow` | Brilho | × | 0.2 | 4 | 0.01 | 1.2 | src/view/solid-fx.js:447 | visual/depuração |
| `vfx.rock.cracksEmissive` | Brilho das veias de energia | liga/desliga | 0 | 1 | 1 | 1 | src/view/world-view/wv-entities.js:77 (consumerWeak) | visual/depuração |

## VFX · Barreira de energia (Reflect)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.barrier.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.barrier.variant` | Variante | seletor | 0 | 2 | 1 | 0 | src/view/world-view/wv-entities.js:147 | visual/depuração |
| `vfx.barrier.opacity` | Opacidade | % | 0 | 1 | 0.01 | 0.65 | src/view/world-view/wv-entities.js:163 | visual/depuração |
| `vfx.barrier.pulseFreq` | Frequência de pulsação | Hz | 0.5 | 8 | 0.1 | 2.2 | src/view/world-view/wv-update.js:150 | visual/depuração |
| `vfx.barrier.ripples` | Ondas de impacto na barreira (sem efeito) | liga/desliga | 0 | 1 | 1 | 1 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `vfx.barrier.shatterFragments` | Fragmentos ao quebrar | — | 6 | 48 | 2 | 20 | src/view/world-view/wv-particles.js:86 | visual/depuração |
| `vfx.barrier.shatterSpeed` | Velocidade dos estilhaços | × | 0.2 | 3 | 0.05 | 1 | src/view/world-view/wv-particles.js:87 | visual/depuração |
| `vfx.barrier.shatterLife` | Duração dos estilhaços | × | 0.3 | 3 | 0.05 | 1 | src/view/world-view/wv-particles.js:87 | visual/depuração |
| `vfx.barrier.shatterSize` | Tamanho dos estilhaços | × | 0.4 | 3 | 0.05 | 1 | src/view/world-view/wv-particles.js:87 | visual/depuração |
| `vfx.barrier.edgeGlow` | Brilho nas bordas | × | 0.2 | 3 | 0.1 | 1.4 | src/view/world-view/wv-entities.js:164 | visual/depuração |

## VFX · Elementais (Água, Fogo, Vento)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.elemental.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/quarks/elemental-game.js:37 | visual/depuração |
| `vfx.elemental.waterVariant` | Água · opção (0 = A · 1 = B · 2 = C) | — | 0 | 0.5 | 0.001 | 0 | src/sim/moves/water-pulse/water-pulse.vfx.js:31 (consumerWeak) | visual/depuração |
| `vfx.elemental.fireVariant` | Fogo · opção (0 = A · 1 = B · 2 = C) | — | 0 | 0.5 | 0.001 | 0 | src/view/quarks/elemental-game.js:20 (consumerWeak) | visual/depuração |
| `vfx.elemental.airVariant` | Vento · opção (0 = A · 1 = B · 2 = C) | — | 0 | 0.5 | 0.001 | 0 | src/view/quarks/elemental-game.js:20 (consumerWeak) | visual/depuração |
| `vfx.elemental.seedShotEffect` | Efeito de disparo do Seed Bomb | — | 0 | 0.5 | 0.001 | 0 | src/view/quarks/elemental-game.js:84 | visual/depuração |
| `vfx.elemental.shotFollowTime` | Tempo de seguimento do efeito de disparo | — | 0 | 2 | 0.01 | 0.3 | src/view/world-view/wv-update.js:316 | visual/depuração |

## Tremor · geral

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.shakeMaster.enabled` | Tremores de câmera (todos) | liga/desliga | 0 | 1 | 1 | 1 | src/ui/perf-panel.js:59 | visual/depuração |

## Tremor · Tremor ao defender

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.shakeGuard.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.shakeGuard.profile` | Perfil | seletor | 0 | 2 | 1 | 0 | src/view/vfx.js:740 | visual/depuração |
| `vfx.shakeGuard.amplitude` | Amplitude | m | 0 | 0.6 | 0.005 | 0.05 | src/view/vfx.js:749 | visual/depuração |
| `vfx.shakeGuard.duration` | Duração | s | 0.05 | 2 | 0.01 | 0.16 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.shakeGuard.frequency` | Frequência | /s | 1 | 80 | 1 | 26 | src/view/vfx.js:346 | visual/depuração |
| `vfx.shakeGuard.damping` | Amortecimento | — | 0 | 30 | 0.1 | 7 | src/view/vfx.js:754 | visual/depuração |
| `vfx.shakeGuard.angular` | Deslocamento angular | × | 0 | 3 | 0.01 | 0.6 | src/view/vfx.js:759 | visual/depuração |
| `vfx.shakeGuard.intensity` | Intensidade | × | 0.1 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.shakeGuard.limit` | Limite máximo | m | 0 | 1 | 0.01 | 0.45 | src/view/vfx.js:749 | visual/depuração |

## Tremor · Tremor ao sofrer hit

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.shakeHit.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.shakeHit.profile` | Perfil | seletor | 0 | 2 | 1 | 0 | src/view/vfx.js:740 | visual/depuração |
| `vfx.shakeHit.amplitude` | Amplitude | m | 0 | 0.6 | 0.005 | 0.12 | src/view/vfx.js:749 | visual/depuração |
| `vfx.shakeHit.duration` | Duração | s | 0.05 | 2 | 0.01 | 0.28 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.shakeHit.frequency` | Frequência | /s | 1 | 80 | 1 | 26 | src/view/vfx.js:346 | visual/depuração |
| `vfx.shakeHit.damping` | Amortecimento | — | 0 | 30 | 0.1 | 7 | src/view/vfx.js:754 | visual/depuração |
| `vfx.shakeHit.angular` | Deslocamento angular | × | 0 | 3 | 0.01 | 0.6 | src/view/vfx.js:759 | visual/depuração |
| `vfx.shakeHit.intensity` | Intensidade | × | 0.1 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.shakeHit.limit` | Limite máximo | m | 0 | 1 | 0.01 | 0.45 | src/view/vfx.js:749 | visual/depuração |

## Tremor · Tremor ao colidir com o chão

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.shakeGround.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.shakeGround.profile` | Perfil | seletor | 0 | 2 | 1 | 1 | src/view/vfx.js:740 | visual/depuração |
| `vfx.shakeGround.amplitude` | Amplitude | m | 0 | 0.6 | 0.005 | 0.09 | src/view/vfx.js:749 | visual/depuração |
| `vfx.shakeGround.duration` | Duração | s | 0.05 | 2 | 0.01 | 0.3 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.shakeGround.frequency` | Frequência | /s | 1 | 80 | 1 | 26 | src/view/vfx.js:346 | visual/depuração |
| `vfx.shakeGround.damping` | Amortecimento | — | 0 | 30 | 0.1 | 7 | src/view/vfx.js:754 | visual/depuração |
| `vfx.shakeGround.angular` | Deslocamento angular | × | 0 | 3 | 0.01 | 0.6 | src/view/vfx.js:759 | visual/depuração |
| `vfx.shakeGround.intensity` | Intensidade | × | 0.1 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.shakeGround.limit` | Limite máximo | m | 0 | 1 | 0.01 | 0.45 | src/view/vfx.js:749 | visual/depuração |

## Tremor · Tremor na defesa perfeita

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.shakePerfect.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.shakePerfect.profile` | Perfil | seletor | 0 | 2 | 1 | 2 | src/view/vfx.js:740 | visual/depuração |
| `vfx.shakePerfect.amplitude` | Amplitude | m | 0 | 0.6 | 0.005 | 0.1 | src/view/vfx.js:749 | visual/depuração |
| `vfx.shakePerfect.duration` | Duração | s | 0.05 | 2 | 0.01 | 0.3 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.shakePerfect.frequency` | Frequência | /s | 1 | 80 | 1 | 26 | src/view/vfx.js:346 | visual/depuração |
| `vfx.shakePerfect.damping` | Amortecimento | — | 0 | 30 | 0.1 | 7 | src/view/vfx.js:754 | visual/depuração |
| `vfx.shakePerfect.angular` | Deslocamento angular | × | 0 | 3 | 0.01 | 0.6 | src/view/vfx.js:759 | visual/depuração |
| `vfx.shakePerfect.intensity` | Intensidade | × | 0.1 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.shakePerfect.limit` | Limite máximo | m | 0 | 1 | 0.01 | 0.45 | src/view/vfx.js:749 | visual/depuração |

## Tremor · Tremor no clash entre tackles

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.shakeClash.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.shakeClash.profile` | Perfil | seletor | 0 | 2 | 1 | 1 | src/view/vfx.js:740 | visual/depuração |
| `vfx.shakeClash.amplitude` | Amplitude | m | 0 | 0.6 | 0.005 | 0.18 | src/view/vfx.js:749 | visual/depuração |
| `vfx.shakeClash.duration` | Duração | s | 0.05 | 2 | 0.01 | 0.42 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.shakeClash.frequency` | Frequência | /s | 1 | 80 | 1 | 26 | src/view/vfx.js:346 | visual/depuração |
| `vfx.shakeClash.damping` | Amortecimento | — | 0 | 30 | 0.1 | 7 | src/view/vfx.js:754 | visual/depuração |
| `vfx.shakeClash.angular` | Deslocamento angular | × | 0 | 3 | 0.01 | 0.6 | src/view/vfx.js:759 | visual/depuração |
| `vfx.shakeClash.intensity` | Intensidade | × | 0.1 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.shakeClash.limit` | Limite máximo | m | 0 | 1 | 0.01 | 0.45 | src/view/vfx.js:749 | visual/depuração |

## Tremor · Tremor ao bater em parede ou objeto

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.shakeWall.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 0 | src/view/solid-fx.js:124 | visual/depuração |
| `vfx.shakeWall.profile` | Perfil | seletor | 0 | 2 | 1 | 0 | src/view/vfx.js:740 | visual/depuração |
| `vfx.shakeWall.amplitude` | Amplitude | m | 0 | 0.6 | 0.005 | 0.06 | src/view/vfx.js:749 | visual/depuração |
| `vfx.shakeWall.duration` | Duração | s | 0.05 | 2 | 0.01 | 0.2 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.shakeWall.frequency` | Frequência | /s | 1 | 80 | 1 | 26 | src/view/vfx.js:346 | visual/depuração |
| `vfx.shakeWall.damping` | Amortecimento | — | 0 | 30 | 0.1 | 7 | src/view/vfx.js:754 | visual/depuração |
| `vfx.shakeWall.angular` | Deslocamento angular | × | 0 | 3 | 0.01 | 0.6 | src/view/vfx.js:759 | visual/depuração |
| `vfx.shakeWall.intensity` | Intensidade | × | 0.1 | 3 | 0.01 | 1 | src/view/solid-fx.js:63 | visual/depuração |
| `vfx.shakeWall.limit` | Limite máximo | m | 0 | 1 | 0.01 | 0.45 | src/view/vfx.js:749 | visual/depuração |

## Teclas do vermelho (controle manual)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `extras.bindings2.forward` | Vermelho · Mover para cima | seletor | 0 | 50 | 1 | 31 | src/ui/input.js:96 | visual/depuração |
| `extras.bindings2.back` | Vermelho · Mover para baixo | seletor | 0 | 50 | 1 | 28 | src/ui/input.js:96 | visual/depuração |
| `extras.bindings2.left` | Vermelho · Mover à esquerda | seletor | 0 | 50 | 1 | 27 | src/ui/input.js:96 | visual/depuração |
| `extras.bindings2.right` | Vermelho · Mover à direita | seletor | 0 | 50 | 1 | 29 | src/ui/input.js:96 | visual/depuração |
| `extras.bindings2.tackle` | Vermelho · Tackle (X) | seletor | 0 | 50 | 1 | 37 | src/ui/input.js:96 | visual/depuração |
| `extras.bindings2.dodge` | Vermelho · Esquiva (C) — segure para sprint | seletor | 0 | 50 | 1 | 38 | src/ui/input.js:96 | visual/depuração |
| `extras.bindings2.defend` | Vermelho · Defesa (D) | seletor | 0 | 50 | 1 | 39 | src/ui/input.js:96 | visual/depuração |
| `extras.bindings2.lock` | Vermelho · Fixar alvo | seletor | 0 | 50 | 1 | 40 | src/ui/input.js:63 | visual/depuração |
| `extras.bindings2.skill1` | Vermelho · Movimento especial 1 | seletor | 0 | 50 | 1 | 41 | src/ui/input.js:95 | visual/depuração |
| `extras.bindings2.skill2` | Vermelho · Movimento especial 2 | seletor | 0 | 50 | 1 | 42 | src/ui/input.js:95 | visual/depuração |
| `extras.bindings2.skill3` | Vermelho · Movimento especial 3 | seletor | 0 | 50 | 1 | 44 | src/ui/input.js:95 | visual/depuração |
| `extras.bindings2.skill4` | Vermelho · Movimento especial 4 | seletor | 0 | 50 | 1 | 45 | src/ui/input.js:95 | visual/depuração |
| `extras.bindings2.jump` | Vermelho · Pular | seletor | 0 | 50 | 1 | 14 | src/ui/input.js:96 | visual/depuração |

## VFX · Laser da Arena (BeamRenderer)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.laser.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/vfx.js:745 | visual/depuração |
| `vfx.laser.pl` | Power Level do laser de prévia | PL | 1 | 3 | 1 | 1 | src/view/vfx/beam-renderer.js:211 | visual/depuração |
| `vfx.laser.coreWidth1` | Largura do núcleo (PL1) | m | 0.01 | 0.8 | 0.005 | 0.04 | src/view/vfx/beam-renderer.js:215 | visual/depuração |
| `vfx.laser.coreWidth2` | Largura do núcleo (PL2) | m | 0.01 | 0.8 | 0.005 | 0.065 | src/view/vfx/beam-renderer.js:215 | visual/depuração |
| `vfx.laser.coreWidth3` | Largura do núcleo (PL3) | m | 0.01 | 0.8 | 0.005 | 0.095 | src/view/vfx/beam-renderer.js:215 | visual/depuração |
| `vfx.laser.coreOpacity` | Opacidade do núcleo | % | 0 | 1 | 0.05 | 0.95 | src/view/vfx/beam-renderer.js:233 | visual/depuração |
| `vfx.laser.haloWidth1` | Largura do halo (PL1) | m | 0.01 | 0.8 | 0.005 | 0.15 | src/view/vfx/beam-renderer.js:216 | visual/depuração |
| `vfx.laser.haloWidth2` | Largura do halo (PL2) | m | 0.01 | 0.8 | 0.005 | 0.24 | src/view/vfx/beam-renderer.js:216 | visual/depuração |
| `vfx.laser.haloWidth3` | Largura do halo (PL3) | m | 0.01 | 0.8 | 0.005 | 0.38 | src/view/vfx/beam-renderer.js:216 | visual/depuração |
| `vfx.laser.haloOpacity` | Opacidade do halo | % | 0 | 1 | 0.05 | 0.65 | src/view/vfx/beam-renderer.js:320 | visual/depuração |
| `vfx.laser.intensity` | Intensidade | × | 0.1 | 3 | 0.01 | 1.2 | src/view/vfx/beam-renderer.js:310 | visual/depuração |
| `vfx.laser.pulseFreq` | Frequência de pulsação | Hz | 0.5 | 8 | 0.1 | 2 | src/view/vfx/beam-renderer.js:202 | visual/depuração |
| `vfx.laser.flowSpeed` | Velocidade de fluxo (sem efeito) | — | 0.01 | 30 | 0.01 | 24 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `vfx.laser.muzzleSize` | Tamanho do muzzle | m | 0.01 | 0.8 | 0.005 | 0.28 | src/view/vfx/beam-renderer.js:230 | visual/depuração |
| `vfx.laser.contactSize` | Tamanho do flare de contato | m | 0.01 | 0.8 | 0.005 | 0.35 | src/view/vfx/beam-renderer.js:338 | visual/depuração |
| `vfx.laser.sparksPerSecond` | Centelhas no impacto (/s) | /s | 0 | 100 | 5 | 20 | src/view/vfx/beam-renderer.js:344 | visual/depuração |
| `vfx.laser.dynamicLight` | Luz dinâmica do laser (sem efeito) | liga/desliga | 0 | 1 | 1 | 1 | **SEM CONSUMIDOR** | sem efeito (órfão rotulado) |
| `vfx.laser.reflectionActive` | Nó de reflexão visível | liga/desliga | 0 | 1 | 1 | 1 | src/view/vfx/beam-renderer.js:331 | visual/depuração |
| `vfx.laser.neutralizeActive` | Desbotamento de neutralização | liga/desliga | 0 | 1 | 1 | 1 | src/view/vfx/beam-renderer.js:290 | visual/depuração |
| `vfx.laser.quality` | Qualidade dos efeitos 3D | seletor | 0 | 2 | 1 | 1 | src/view/vfx/beam-renderer.js:148 | visual/depuração |
| `vfx.laser.noFlash` | Sem flashes (acessibilidade) | liga/desliga | 0 | 1 | 1 | 0 | src/view/vfx.js:722 | visual/depuração |
| `vfx.laser.reduceMotion` | Reduzir movimento (acessibilidade) | liga/desliga | 0 | 1 | 1 | 0 | src/view/vfx.js:181 | visual/depuração |
| `vfx.laser.highContrast` | Alto contraste (acessibilidade) | liga/desliga | 0 | 1 | 1 | 0 | src/view/vfx.js:182 | visual/depuração |

## Sombras

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `display.shadow.style` | Estilo da sombra | seletor | 0 | 2 | 1 | 2 | src/sim/graphics.js:8 | visual/depuração |
| `display.shadow.opacity` | Opacidade | % | 0 | 1 | 0.01 | 0.55 | src/view/view.js:348 | visual/depuração |
| `display.shadow.radius` | Raio | m | 0.1 | 2 | 0.01 | 0.62 | src/view/view.js:346 | visual/depuração |
| `display.shadow.scaleX` | Escala X | × | 0.2 | 3 | 0.01 | 1 | src/view/view.js:347 | visual/depuração |
| `display.shadow.scaleZ` | Escala Z | × | 0.2 | 3 | 0.01 | 1 | src/view/view.js:347 | visual/depuração |
| `display.shadow.softness` | Suavidade | % | 0 | 1 | 0.05 | 0.6 | src/view/view.js:287 | visual/depuração |
| `display.shadow.offsetX` | Deslocamento X | m | -1 | 1 | 0.01 | 0 | src/view/view.js:345 | visual/depuração |
| `display.shadow.offsetZ` | Deslocamento Z | m | -1 | 1 | 0.01 | 0 | src/view/view.js:345 | visual/depuração |
| `display.shadow.intensity` | Intensidade | × | 0 | 2 | 0.01 | 1 | src/view/view.js:348 | visual/depuração |

## HUD

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `display.hud.proposal` | HUD em uso | seletor | 0 | 3 | 1 | 0 | src/app/tuning-sync.js:39 | visual/depuração |
| `display.hud.scale` | Escala das propostas | × | 0.5 | 1.6 | 0.01 | 1.11 | src/ui/hud-proposals.js:32 | visual/depuração |
| `display.hud.demoCooldowns` | Mostrar cooldowns demonstrativos | liga/desliga | 0 | 1 | 1 | 1 | src/ui/hud-proposals.js:49 | visual/depuração |
| `display.hud.demoAuto` | Ciclo automático dos cooldowns (demonstração) | liga/desliga | 0 | 1 | 1 | 1 | src/ui/hud-proposals.js:14 | visual/depuração |
| `display.hud.demoDuration` | Recarga de demonstração | s | 0.5 | 15 | 0.1 | 4 | src/ui/hud-proposals.js:11 | visual/depuração |
| `display.hud.damageDelay` | Atraso visual do dano | s | 0 | 2 | 0.01 | 0.45 | src/ui/hud-proposals.js:52 | visual/depuração |

## Habilidades passivas

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `display.passive.enabled` | Habilidades passivas visuais | liga/desliga | 0 | 1 | 1 | 1 | src/ui/passive-banner.js:11 | visual/depuração |
| `display.passive.playerAbility` | Habilidade do jogador | seletor | 0 | 2 | 1 | 0 | src/app/match-stats.js:14 | visual/depuração |
| `display.passive.enemyAbility` | Habilidade do adversário | seletor | 0 | 2 | 1 | 1 | src/app/match-stats.js:14 | visual/depuração |
| `display.passive.borderMotion` | Animação da borda metálica | seletor | 0 | 2 | 1 | 0 | src/ui/passive-banner.js:7 | visual/depuração |
| `display.passive.textScale` | Tamanho do texto “Ability” | × | 0.8 | 1.6 | 0.05 | 1.2 | src/ui/passive-banner.js:7 | visual/depuração |

## Altura visual

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `display.grounding.autoGround` | Ajuste automático de altura (GLB) | liga/desliga | 0 | 1 | 1 | 1 | src/ui/animation-editor.js:228 | visual/depuração |
| `display.grounding.visualOffset` | Altura visual global | m | -1 | 1 | 0.01 | 0 | src/ui/animation-editor.js:228 | visual/depuração |

## Indicador da janela C → X

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `display.cancelRing.inner` | Raio interno do indicador C → X | m | 0.2 | 3 | 0.01 | 1.05 | src/view/view.js:579 | visual/depuração |
| `display.cancelRing.width` | Largura do indicador C → X | m | 0.02 | 1 | 0.01 | 0.25 | src/view/view.js:579 | visual/depuração |
| `display.cancelRing.opacity` | Opacidade do indicador C → X | % | 0 | 1 | 0.01 | 0.75 | src/view/view.js:579 | visual/depuração |

## Animação: transições

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `display.animation.fade` | Transição suave entre estados | s | 0.02 | 0.6 | 0.01 | 0.19 | src/app/workspace-boot.js:45 | visual/depuração |
| `display.animation.actionFade` | Transição de entrada em X, C e reações | s | 0.02 | 0.3 | 0.01 | 0.09 | src/app/workspace-boot.js:45 | visual/depuração |
| `display.animation.locomotionHold` | Estabilidade da locomoção (histerese) | s | 0 | 0.4 | 0.01 | 0.08 | src/app/workspace-boot.js:45 | visual/depuração |
| `display.animation.speed` | Velocidade geral das animações | × | 0.25 | 3 | 0.05 | 1.75 | src/app/wire-characters.js:13 | visual/depuração |

## Diagnóstico de comandos

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `display.diagnostics.toast` | Aviso curto na arena | seletor | 0 | 2 | 1 | 1 | src/app/live-panels.js:47 | visual/depuração |
| `display.diagnostics.toastMs` | Duração do aviso | ms | 300 | 5000 | 50 | 1400 | src/ui/diagnostics-panel.js:28 | visual/depuração |
| `display.diagnostics.logExecuted` | Registrar também comandos executados | liga/desliga | 0 | 1 | 1 | 0 | src/ui/diagnostics-panel.js:19 | visual/depuração |

## Janelas de combate

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `display.windows.mode` | Indicadores de janelas de combate | seletor | 0 | 2 | 1 | 0 | src/ui/diagnostics-panel.js:88 | visual/depuração |
| `display.windows.scale` | Escala dos indicadores | × | 0.5 | 2 | 0.05 | 1 | src/ui/diagnostics-panel.js:97 | visual/depuração |
| `display.windows.opacity` | Opacidade dos indicadores | % | 0.2 | 1 | 0.05 | 0.9 | src/ui/diagnostics-panel.js:97 | visual/depuração |
| `display.windows.invulnerable` | Invulnerabilidade | liga/desliga | 0 | 1 | 1 | 1 | src/ui/diagnostics-panel.js:54 | visual/depuração |
| `display.windows.cancel` | Janela C → X | liga/desliga | 0 | 1 | 1 | 1 | src/ui/diagnostics-panel.js:55 | visual/depuração |
| `display.windows.chain` | Encadear outra ação | liga/desliga | 0 | 1 | 1 | 1 | src/ui/diagnostics-panel.js:60 | visual/depuração |
| `display.windows.recovery` | Recuperação | liga/desliga | 0 | 1 | 1 | 1 | src/ui/diagnostics-panel.js:61 | visual/depuração |
| `display.windows.guardStun` | Guard stun | liga/desliga | 0 | 1 | 1 | 1 | src/ui/diagnostics-panel.js:62 | visual/depuração |
| `display.windows.recoil` | Recuo | liga/desliga | 0 | 1 | 1 | 1 | src/ui/diagnostics-panel.js:63 | visual/depuração |
| `display.windows.perfect` | Janela da defesa perfeita | liga/desliga | 0 | 1 | 1 | 1 | src/ui/diagnostics-panel.js:64 | visual/depuração |
| `display.windows.perfectCooldown` | Recarga da defesa perfeita | liga/desliga | 0 | 1 | 1 | 1 | src/ui/diagnostics-panel.js:65 | visual/depuração |
| `display.windows.counter` | Janela de contra-ataque | liga/desliga | 0 | 1 | 1 | 1 | src/ui/diagnostics-panel.js:66 | visual/depuração |
| `display.windows.buffer` | Buffer de entrada | liga/desliga | 0 | 1 | 1 | 1 | src/ui/diagnostics-panel.js:67 | visual/depuração |
| `display.windows.hitstop` | Hitstop | liga/desliga | 0 | 1 | 1 | 0 | src/ui/diagnostics-panel.js:81 | visual/depuração |
| `display.windows.statuses` | Buffs e debuffs | liga/desliga | 0 | 1 | 1 | 1 | src/ui/diagnostics-panel.js:79 | visual/depuração |
| `display.windows.cooldowns` | Recargas dos movimentos | liga/desliga | 0 | 1 | 1 | 1 | src/ui/diagnostics-panel.js:80 | visual/depuração |

## Medidor de desempenho

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `display.perf.overlay` | Medidor compacto na arena | liga/desliga | 0 | 1 | 1 | 0 | src/ui/perf-panel.js:39 | visual/depuração |

## Passivas · Poison Touch (croagunk)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `passivas.poison-touch.dps` | Dano por segundo do veneno | — | 0 | 20 | 0.05 | 2 | src/sim/passive-engine.js:88 | pendente (passiva) |
| `passivas.poison-touch.duration` | Duração do efeito (s) | — | 0 | 24 | 0.05 | 3 | src/sim/passive-engine.js:88 | pendente (passiva) |
| `passivas.poison-touch.cooldown` | Recarga (s) | — | 0 | 96 | 0.05 | 12 | src/sim/passive-engine.js:85 | pendente (passiva) |

## Passivas · Anticipation (croagunk)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `passivas.anticipation.speedPct` | Bônus de velocidade (%) | — | 0 | 4 | 0.01 | 0.15 | src/sim/passive-engine.js:245 | pendente (passiva) |
| `passivas.anticipation.duration` | Duração do efeito (s) | — | 0 | 20 | 0.05 | 2 | src/sim/passive-engine.js:88 | pendente (passiva) |
| `passivas.anticipation.cooldown` | Recarga (s) | — | 0 | 96 | 0.05 | 12 | src/sim/passive-engine.js:85 | pendente (passiva) |
| `passivas.anticipation.detectDistance` | Distância de detecção (m) | — | 0 | 28 | 0.05 | 3.5 | src/sim/passive-engine.js:202 | pendente (passiva) |

## Passivas · Forewarn (drowzee)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `passivas.forewarn.windowBonus` | Bônus da janela perfeita (s) | — | 0 | 1 | 0.001 | 0.06 | src/sim/passive-engine.js:268 | pendente (passiva) |
| `passivas.forewarn.maxDuration` | Duração máxima do efeito (s) | — | 0 | 32 | 0.05 | 4 | src/sim/passive-engine.js:94 | pendente (passiva) |
| `passivas.forewarn.cooldown` | Recarga (s) | — | 0 | 96 | 0.05 | 12 | src/sim/passive-engine.js:85 | pendente (passiva) |
| `passivas.forewarn.detectDistance` | Distância de detecção (m) | — | 0 | 28 | 0.05 | 3.5 | src/sim/passive-engine.js:202 | pendente (passiva) |

## Passivas · Inner Focus (drowzee)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `passivas.inner-focus.stunPct` | Redução de hit stun (%) | — | 0 | 4 | 0.01 | 0.2 | src/sim/passive-engine.js:266 | muda · passiva/inner-focus/roteiro |

## Passivas · Effect Spore (mush)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `passivas.effect-spore.slowPct` | Redução de velocidade do alvo (%) | — | 0 | 4 | 0.01 | 0.15 | src/sim/passive-engine.js:247 | muda · passiva/effect-spore/roteiro |
| `passivas.effect-spore.duration` | Duração do efeito (s) | — | 0 | 24 | 0.05 | 3 | src/sim/passive-engine.js:88 | muda · passiva/effect-spore/roteiro |
| `passivas.effect-spore.cooldown` | Recarga (s) | — | 0 | 96 | 0.05 | 12 | src/sim/passive-engine.js:85 | pendente (passiva) |

## Passivas · Vital Spirit (vigoroth)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `passivas.vital-spirit.thresholdPct` | Limiar de stamina (%) | — | 0 | 4 | 0.01 | 0.3 | src/sim/passive-engine.js:256 | muda · passiva/vital-spirit/roteiro |
| `passivas.vital-spirit.regenPct` | Bônus de regeneração (%) | — | 0 | 4 | 0.01 | 0.3 | src/sim/passive-engine.js:256 | muda · passiva/vital-spirit |

## Passivas · Guts (vigoroth)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `passivas.guts.attackPct` | Bônus de ataque (%) | — | 0 | 4 | 0.01 | 0.15 | src/sim/passive-engine.js:249 | pendente (passiva) |

## Passivas · Speed Boost

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `passivas.speed-boost.speedPct` | Bônus de velocidade (%) | — | 0 | 4 | 0.01 | 0.15 | src/sim/passive-engine.js:245 | muda · passiva/speed-boost |

## Passivas · Technician

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `passivas.technician.costPct` | Desconto de custo de stamina (%) | — | 0 | 4 | 0.01 | 0.2 | src/sim/passive-engine.js:271 | muda · passiva/technician |

## Passivas · Rough Skin

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `passivas.rough-skin.reflectDamage` | Dano de retorno (HP) | — | 0 | 24 | 0.05 | 3 | src/sim/passive-engine.js:97 | muda · passiva/rough-skin/roteiro |
| `passivas.rough-skin.cooldown` | Recarga (s) | — | 0 | 80 | 0.05 | 10 | src/sim/passive-engine.js:85 | pendente (passiva) |

## Passivas · Regenerator

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `passivas.regenerator.heal` | Cura (HP) | — | 0 | 40 | 0.05 | 5 | src/sim/passive-engine.js:107 | muda · passiva/regenerator |
| `passivas.regenerator.quietTime` | Tempo sem dano para curar (s) | — | 0 | 40 | 0.05 | 5 | src/sim/passive-engine.js:199 | pendente (passiva) |
| `passivas.regenerator.cooldown` | Recarga (s) | — | 0 | 120 | 0.05 | 15 | src/sim/passive-engine.js:85 | muda · passiva/regenerator |

## Passivas · Unburden

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `passivas.unburden.speedPct` | Bônus de velocidade (%) | — | 0 | 4 | 0.01 | 0.15 | src/sim/passive-engine.js:245 | pendente (passiva) |
| `passivas.unburden.duration` | Duração do efeito (s) | — | 0 | 32 | 0.05 | 4 | src/sim/passive-engine.js:88 | pendente (passiva) |
| `passivas.unburden.cooldown` | Recarga (s) | — | 0 | 112 | 0.05 | 14 | src/sim/passive-engine.js:85 | pendente (passiva) |

## Passivas · Stamina

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `passivas.stamina.defensePct` | Bônus de defesa (%) | — | 0 | 4 | 0.01 | 0.1 | src/sim/passive-engine.js:250 | pendente (passiva) |
| `passivas.stamina.duration` | Duração do efeito (s) | — | 0 | 32 | 0.05 | 4 | src/sim/passive-engine.js:88 | muda · passiva/stamina/roteiro |
| `passivas.stamina.cooldown` | Recarga (s) | — | 0 | 80 | 0.05 | 10 | src/sim/passive-engine.js:85 | pendente (passiva) |

## Passivas · Suction Cups

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `passivas.suction-cups.knockbackPct` | Redução de empurrão horizontal (%) | — | 0 | 4 | 0.01 | 0.2 | src/sim/passive-engine.js:264 | muda · passiva/suction-cups/roteiro |

## Passivas · Magic Guard

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `passivas.magic-guard.dotReductionPct` | Redução de dano periódico (%) | — | 0 | 5 | 0.01 | 0.5 | src/sim/passive-engine.js:262 | pendente (passiva) |

## Passivas · Defiant

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `passivas.defiant.attackPct` | Bônus de ataque (%) | — | 0 | 4 | 0.01 | 0.15 | src/sim/passive-engine.js:249 | pendente (passiva) |
| `passivas.defiant.duration` | Duração do efeito (s) | — | 0 | 32 | 0.05 | 4 | src/sim/passive-engine.js:88 | pendente (passiva) |
| `passivas.defiant.cooldown` | Recarga (s) | — | 0 | 96 | 0.05 | 12 | src/sim/passive-engine.js:85 | pendente (passiva) |

## Passivas · gerais (detecção)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `passivas.globals.detectDistance` | Distância de detecção (m) | — | 0 | 28 | 0.05 | 3.5 | src/sim/passive-engine.js:202 | pendente (passiva) |

## VFX · three.quarks (experimental)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.quarks.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 0 | src/view/view.js:95 | visual/depuração |

## IA · Navegação Yuka (experimental)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `extras.nav.enableNav` | Navegação Yuka (0 = atual · 1 = rota planejada) | liga/desliga | 0 | 1 | 1 | 1 | src/nav/nav-assist.js:18 | muda · navMuro |
| `extras.nav.spacing` | Grade de navegação: espaçamento dos nós (m) | m | 0.75 | 4 | 0.25 | 1.5 | src/nav/nav-graph.js:19 | muda · navMuro |
| `extras.nav.replan` | Replanejamento: intervalo (s) | s | 0.1 | 3 | 0.05 | 0.4 | src/nav/nav-planner.js:10 | muda · navMuro |
| `extras.nav.jumpReach` | Salto de rota: alcance horizontal (m) | m | 0.05 | 6 | 0.05 | 2.4 | src/nav/nav-graph.js:24 | muda · navPlataforma |
| `extras.nav.jumpMargin` | Salto de rota: folga sob a altura do salto (m) | m | 0.05 | 6 | 0.05 | 0.1 | src/nav/nav-graph.js:23 | muda · navPlataforma |
| `extras.nav.launch` | Salto de rota: distância para decolar (m) | m | 0.05 | 6 | 0.05 | 1.5 | src/nav/nav-planner.js:10 | muda · navPlataforma |
| `extras.nav.arrival` | Chegada a um ponto da rota (m) | m | 0.05 | 6 | 0.05 | 0.55 | src/nav/nav-planner.js:10 | muda · navMuro |
| `extras.nav.stuckTime` | Detecção de travamento: janela (s) | s | 0.1 | 3 | 0.05 | 0.8 | src/nav/nav-planner.js:10 | pendente (nav) |
| `extras.nav.stuckDistance` | Detecção de travamento: deslocamento mínimo (m) | m | 0.05 | 6 | 0.05 | 0.12 | src/nav/nav-planner.js:10 | pendente (nav) |
| `extras.nav.attackMaxHeightDiff` | Alvo inalcançável: diferença de altura (m) | m | 0.05 | 6 | 0.05 | 0.8 | src/nav/nav-planner.js:10 | pendente (nav) |
| `extras.nav.suppressBlockedAttacks` | Não atacar alvo inalcançável | liga/desliga | 0 | 1 | 1 | 1 | src/nav/nav-assist.js:33 | muda · navPlataforma |
| `extras.nav.showDebug` | Mostrar rotas e nós de navegação | liga/desliga | 0 | 1 | 1 | 0 | src/view/view.js:433 | visual/depuração |
| `extras.nav.jumpPenalty` | Custo do salto na rota (× · alto = prefere contornar pelo chão) | × | 1 | 20 | 0.5 | 6 | src/nav/nav-graph.js:26 | muda · navPlataforma |
| `extras.nav.dropPenalty` | Custo da queda na rota (× · alto = evita descer de plataforma) | × | 1 | 20 | 0.5 | 6 | src/nav/nav-graph.js:27 | muda · navPlataforma |

## VFX · Pós-processamento (experimental)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `vfx.post.enabled` | Ligado | liga/desliga | 0 | 1 | 1 | 0 | src/view/view.js:524 | visual/depuração |
| `vfx.post.bloomOn` | Bloom ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/post/post-params.js:23 | visual/depuração |
| `vfx.post.bloomMode` | Modo do bloom (limiar × seleção) | seletor | 0 | 1 | 1 | 0 | src/view/post/post-pipeline.js:25 | visual/depuração |
| `vfx.post.bloomIntensity` | Bloom: intensidade | × | 0 | 4 | 0.05 | 0.9 | src/view/post/post-params.js:21 | visual/depuração |
| `vfx.post.bloomThreshold` | Bloom: limiar de brilho | — | 0 | 1.5 | 0.01 | 0.8 | src/view/post/post-pipeline.js:77 | visual/depuração |
| `vfx.post.bloomSmoothing` | Bloom: suavização do limiar | — | 0 | 1.5 | 0.01 | 0.25 | src/view/post/post-pipeline.js:77 | visual/depuração |
| `vfx.post.bloomRadius` | Bloom: raio | — | 0 | 1.5 | 0.01 | 0.7 | src/view/post/post-pipeline.js:78 | visual/depuração |
| `vfx.post.bloomAttackBoost` | Bloom: reforço em ataques energéticos | × | 0 | 4 | 0.05 | 1.8 | src/view/post/post-params.js:21 | visual/depuração |
| `vfx.post.distortOn` | Distorção de tela ligada | liga/desliga | 0 | 1 | 1 | 1 | src/view/post/post-params.js:22 | visual/depuração |
| `vfx.post.distortStrength` | Distorção: intensidade | × | 0 | 4 | 0.05 | 0.5 | src/view/post/post-pipeline.js:84 | visual/depuração |
| `vfx.post.distortSize` | Distorção: largura da onda | — | 0 | 1.5 | 0.01 | 0.28 | src/view/post/post-pipeline.js:84 | visual/depuração |
| `vfx.post.distortMinDamage` | Distorção: dano mínimo do impacto (HP) | HP | 0 | 40 | 1 | 12 | src/view/view.js:533 | visual/depuração |
| `vfx.post.chromaOn` | Aberração cromática ligada | liga/desliga | 0 | 1 | 1 | 1 | src/view/post/post-params.js:23 | visual/depuração |
| `vfx.post.chromaOffset` | Aberração: base | — | 0 | 0.006 | 0.0001 | 0.0008 | src/view/post/post-params.js:22 | visual/depuração |
| `vfx.post.chromaImpact` | Aberração: pulso no impacto | — | 0 | 0.02 | 0.0005 | 0.004 | src/view/post/post-params.js:22 | visual/depuração |
| `vfx.post.gradeOn` | Color grading ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/post/post-params.js:23 | visual/depuração |
| `vfx.post.gradeSaturation` | Grading: saturação | — | -1 | 1 | 0.02 | 0.1 | src/view/post/post-pipeline.js:82 | visual/depuração |
| `vfx.post.gradeContrast` | Grading: contraste | — | -1 | 1 | 0.02 | 0.06 | src/view/post/post-pipeline.js:83 | visual/depuração |
| `vfx.post.gradeBrightness` | Grading: brilho | — | -1 | 1 | 0.02 | 0 | src/view/post/post-pipeline.js:83 | visual/depuração |
| `vfx.post.gradeHue` | Grading: matiz | ° | -180 | 180 | 1 | 0 | src/view/post/post-pipeline.js:82 | visual/depuração |
| `vfx.post.vignetteOn` | Vinheta ligada | liga/desliga | 0 | 1 | 1 | 1 | src/view/post/post-params.js:23 | visual/depuração |
| `vfx.post.vignetteDarkness` | Vinheta: escuridão | — | 0 | 1.5 | 0.01 | 0.4 | src/view/post/post-pipeline.js:81 | visual/depuração |
| `vfx.post.vignetteOffset` | Vinheta: alcance | — | 0 | 1.5 | 0.01 | 0.3 | src/view/post/post-pipeline.js:81 | visual/depuração |
| `vfx.post.dofOn` | Profundidade de campo permitida | liga/desliga | 0 | 1 | 1 | 0 | src/view/post/post-params.js:22 | visual/depuração |
| `vfx.post.dofBokeh` | Profundidade de campo: bokeh | × | 0.5 | 8 | 0.1 | 2.5 | src/view/post/post-pipeline.js:85 | visual/depuração |
| `vfx.post.dofKoOnly` | Profundidade de campo só no K.O. | liga/desliga | 0 | 1 | 1 | 1 | src/view/post/post-pipeline.js:24 | visual/depuração |

## Hitbox espacial do golpe (experimental)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `extras.hitbox.enableShapes` | Hitbox espacial do golpe (0 = só alinhamento · 1 = esfera à frente) | liga/desliga | 0 | 1 | 1 | 0 | src/sim/combat.js:90 | pendente (combate) |
| `extras.hitbox.shapeForward` | Hitbox: distância do centro da esfera à frente (m) | m | 0.1 | 2 | 0.05 | 0.6 | src/sim/combat.js:91 | muda · tackle |
| `extras.hitbox.shapeRadius` | Hitbox: raio da esfera (m) | m | 0.1 | 2 | 0.05 | 0.4 | src/sim/combat.js:91 | pendente (combate) |

## Interpolação do desenho (movimento liso)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `display.interpolation.enabled` | Ativado (0/1) | liga/desliga | 0 | 1 | 1 | 1 | src/app/main-loop.js:25 | visual/depuração |
| `display.interpolation.maxJump` | Interpolação: não suavizar saltos maiores que (m) | m | 0.2 | 4 | 0.1 | 1.5 | src/app/main-loop.js:25 | visual/depuração |

## Cenário do laboratório

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `display.scenery.labTheme` | Cenário do laboratório (0 = visual clássico · 1 = laboratório técnico) | liga/desliga | 0 | 1 | 1 | 1 | src/view/scenery.js:94 | visual/depuração |
| `display.scenery.labBlocks` | Anel de blocos geométricos ao redor da arena | liga/desliga | 0 | 1 | 1 | 1 | src/view/scenery.js:130 | visual/depuração |
| `display.scenery.labProps` | Prismas e pilares decorativos (fora do piso) | liga/desliga | 0 | 1 | 1 | 1 | src/view/scenery.js:119 | visual/depuração |
| `display.scenery.labRulers` | Legendas dos anéis de régua (4 m, 8 m…) | liga/desliga | 0 | 1 | 1 | 1 | src/view/scenery.js:31 | visual/depuração |
| `display.scenery.labRingStep` | Distância entre os anéis de régua (m) | m | 1 | 16 | 0.5 | 4 | src/view/scenery.js:31 | visual/depuração |
| `display.scenery.labBlockScale` | Altura dos blocos do anel (×) | × | 0.2 | 4 | 0.05 | 1 | src/view/scenery.js:131 | visual/depuração |
| `display.scenery.labRimGlow` | Brilho da borda da arena | liga/desliga | 0 | 1 | 1 | 1 | src/view/scenery.js:113 | visual/depuração |

## HUD de progressão (Banco de Células)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `display.progress.pgEnabled` | HUD de progressão (Banco de Células) | liga/desliga | 0 | 1 | 1 | 1 | src/ui/progress-hud.js:44 | visual/depuração |
| `display.progress.pgLayout` | Disposição do HUD de progressão (0 = vertical · 1 = horizontal) | liga/desliga | 0 | 1 | 1 | 1 | src/ui/progress-hud.js:48 | visual/depuração |
| `display.progress.pgSubject` | HUD de progressão: de quem (0 jogador · 1 adversário · 2 ambos) | Os dois | 0 | 2 | 1 | 2 | src/ui/progress-hud.js:48 | visual/depuração |
| `display.progress.pgScale` | Tamanho do HUD de progressão · jogador | % | 0.4 | 2 | 0.05 | 1 | src/ui/progress-hud.js:56 | visual/depuração |
| `display.progress.pgScaleEnemy` | Tamanho do HUD de progressão · adversário | % | 0.4 | 2 | 0.05 | 1 | src/ui/progress-hud.js:56 | visual/depuração |
| `display.progress.pgAnimate` | Animação ao ganhar estágio | liga/desliga | 0 | 1 | 1 | 1 | src/ui/progress-hud.js:74 | visual/depuração |

## Consumíveis (Gemas Facetadas)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `display.consumables.gemStyle` | Estilo dos consumíveis (0 = clássico · 1 = Gemas Facetadas) | liga/desliga | 0 | 1 | 1 | 1 | src/view/world-view/wv-map.js:201 | visual/depuração |
| `display.consumables.gemScale` | Escala visual dos consumíveis | × | 0.3 | 3 | 0.05 | 1 | src/view/consumables-gems.js:138 | visual/depuração |
| `display.consumables.gemHover` | Altura de flutuação das gemas (m) | m | 0 | 3 | 0.05 | 0.9 | src/view/consumables-gems.js:138 | visual/depuração |
| `display.consumables.gemIndicators` | Indicadores flutuantes dos consumíveis | liga/desliga | 0 | 1 | 1 | 1 | src/view/consumables-gems.js:147 | visual/depuração |
| `display.consumables.gemIndicatorSize` | Tamanho do indicador flutuante | × | 0.3 | 3 | 0.05 | 1 | src/view/consumables-gems.js:150 | visual/depuração |
| `display.consumables.gemAnimate` | Animações dos consumíveis (giro, flutuar, brilho) | liga/desliga | 0 | 1 | 1 | 1 | src/view/consumables-gems.js:137 | visual/depuração |
| `display.consumables.gemParticles` | Centelhas dos consumíveis (three.quarks) | liga/desliga | 0 | 1 | 1 | 1 | src/view/world-view/wv-map.js:231 | visual/depuração |
| `display.consumables.gemPedestal` | Pedestal hexagonal sob os consumíveis | liga/desliga | 0 | 1 | 1 | 1 | src/view/consumables-gems.js:140 | visual/depuração |

## Objetos na frente do lutador (transparência)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `display.occlusion.occEnabled` | Objetos na frente do lutador ficam translúcidos | liga/desliga | 0 | 1 | 1 | 1 | src/view/world-view/wv-map.js:334 | visual/depuração |
| `display.occlusion.occOpacity` | Opacidade do objeto que cobre o lutador | % | 0 | 1 | 0.05 | 0.25 | src/view/world-view/wv-map.js:334 | visual/depuração |
| `display.occlusion.occFade` | Velocidade da transição de transparência | % por quadro | 0.02 | 1 | 0.02 | 0.3 | src/view/world-view/wv-map.js:334 | visual/depuração |

## Círculo de alcance dos Moves de alvo único

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `display.rangeRing.rangeOn` | Círculo de alcance dos Moves de alvo único | liga/desliga | 0 | 1 | 1 | 1 | src/view/aim-marker-view.js:16 | visual/depuração |
| `display.rangeRing.flashTime` | Duração da piscada vermelha ao soltar fora do alcance (s) | s | 0 | 3 | 0.05 | 0.7 | src/sim/controller/ctrl-moves.js:184 | visual/depuração |
| `display.rangeRing.rangeOpacity` | Opacidade do círculo de alcance | % | 0.1 | 1 | 0.05 | 0.85 | src/view/aim-marker-view.js:16 | visual/depuração |
| `display.rangeRing.rangeWidth` | Espessura do círculo de alcance (m) | m | 0.02 | 0.8 | 0.01 | 0.2 | src/view/aim-marker-view.js:16 | visual/depuração |
| `display.rangeRing.rangeFill` | Preenchimento do círculo de alcance | % | 0 | 0.6 | 0.01 | 0.12 | src/view/aim-marker-view.js:16 | visual/depuração |
| `display.rangeRing.rangeWall` | Altura da parede baixa do círculo de alcance (m) | m | 0 | 2 | 0.05 | 0.35 | src/view/aim-marker-view.js:16 | visual/depuração |

## Moves · Carga (compartilhada)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.charge.moveSlow` | Velocidade durante a carga | % | 0.2 | 2 | 0.01 | 0.75 | src/sim/charge.js:14 | muda · duelMoves |
| `world.charge.turnSlow` | Giro durante a carga | % | 0.2 | 2 | 0.01 | 0.75 | src/sim/charge.js:14 | pendente (iaMoves) |
| `world.charge.dodgeCancelAfter` | Esquiva cancela a carga após | s | 0 | 2 | 0.01 | 0.2 | src/sim/charge.js:14 | pendente (iaMoves) |
| `world.charge.interruptCooldownFactor` | Recarga após interrupção ou cancelamento | % | 0 | 2 | 0.01 | 0.5 | src/sim/charge.js:14 | pendente (iaMoves) |
| `world.charge.recovery` | Recuperação após soltar | s | 0 | 2 | 0.01 | 0.25 | src/sim/charge.js:14 | muda · duelMoves |
| `world.charge.bufferWindow` | Comando guardado no fim da esquiva | s | 0 | 1 | 0.01 | 0.15 | src/sim/charge.js:14 | pendente (iaMoves) |
| `world.charge.boostStaminaPerSecond` | Custo da recarga acelerada | — | 0 | 6 | 0.05 | 0.5 | src/sim/charge.js:14 | pendente (iaMoves) |
| `world.charge.boostStep` | Recarga encurtada por toque | s | 0.25 | 8 | 0.25 | 1 | src/sim/charge.js:14 | pendente (iaMoves) |

## Moves · IA com Moves (decisões do adversário)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.ai.newMovesRate` | Uso dos Moves novos pela IA | × | 0 | 6 | 0.1 | 1 | src/sim/ai-new-moves.js:69 | muda · duelMoves |
| `world.ai.evadeDistance` | Esquiva emergencial: distância do Tackle rival | m | 0 | 20 | 0.1 | 4.5 | src/sim/ai-moves.js:87 | pendente (iaMoves) |
| `world.ai.pl2Distance` | Psyshock: distância para carregar até PL2 | m | 0 | 30 | 0.1 | 4.8 | src/sim/ai-moves.js:111 | pendente (iaMoves) |
| `world.ai.pl3Distance` | Psyshock: distância para carregar até PL3 | m | 0 | 40 | 0.1 | 7 | src/sim/ai-moves.js:110 | pendente (iaMoves) |
| `world.ai.reflectHold` | Reflect: tempo mínimo segurando | s | 0.5 | 8 | 0.05 | 0.9 | src/sim/ai-moves.js:58 | pendente (iaMoves) |
| `world.ai.lastSecondDefend` | Defesa em cima da hora (janela) | s | 0 | 2 | 0.01 | 0.22 | src/sim/ai-moves.js:119 | pendente (iaMoves) |
| `world.ai.noTimeDefend` | Defesa sem tempo para o PL (janela) | s | 0 | 2 | 0.01 | 0.26 | src/sim/ai-moves.js:151 | muda · duelMoves |
| `world.ai.barrierBreakRange` | Barreira rival: alcance para destruir com Tackle | m | 0 | 16 | 0.1 | 3.2 | src/sim/ai-moves.js:164 | pendente (iaMoves) |
| `world.ai.barrierBreakChance` | Barreira rival: chance de tentar | % | 0 | 2 | 0.01 | 0.6 | src/sim/ai-moves.js:164 | pendente (iaMoves) |
| `world.ai.psyshockMinDistance` | Psyshock ofensivo: distância mínima | m | 0 | 24 | 0.1 | 3.5 | src/sim/ai-moves.js:172 | muda · duelMoves |
| `world.ai.psyshockMinStamina` | Psyshock ofensivo: stamina mínima | — | 0 | 12 | 0.1 | 2 | src/sim/ai-moves.js:172 | muda · duelMoves |
| `world.ai.psyshockChanceMax` | Psyshock ofensivo: chance máxima por decisão | % | 0 | 2 | 0.01 | 0.9 | src/sim/ai-moves.js:176 | muda · duelMoves |
| `world.ai.afterChargeWait` | Pausa depois de uma carga | s | 0 | 6 | 0.05 | 0.35 | src/sim/ai-moves.js:132 | pendente (iaMoves) |
| `world.ai.decisionInterval` | Intervalo entre decisões de Move | s | 0.1 | 6 | 0.05 | 0.5 | src/sim/ai-moves.js:162 | muda · duelMoves |

## Moves · Laser (emissor técnico)

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.beam.length` | Alcance do feixe | m | 4 | 80 | 1 | 24 | src/ui/moves-panel.js:177 | visual/depuração |
| `world.beam.maxSegments` | Segmentos máximos | — | 1 | 32 | 1 | 8 | src/sim/beam.js:36 | visual/depuração |
| `world.beam.interval` | Intervalo entre danos | s | 0.05 | 2 | 0.05 | 0.25 | src/ui/moves-panel.js:177 | visual/depuração |
| `world.beam.damage` | Dano por acerto | — | 0 | 40 | 0.5 | 2 | src/ui/moves-panel.js:177 | visual/depuração |

## Moves · Air Slash

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.airSlash.cost` | Custo de stamina | número | 0 | 10 | 0.05 | 0.8 | src/sim/moves.js:88 | muda · air-slash/perto |
| `world.airSlash.cooldown` | Cooldown | s | 0 | 120 | 0.5 | 6 | src/sim/moves.js:88 | muda · air-slash/duelo |
| `world.airSlash.startup` | Startup (sem hitbox) | s | 0 | 1 | 0.005 | 0.0666667 | src/sim/moves/air-slash.move.json:21 | muda · air-slash/perto |
| `world.airSlash.recovery` | Recovery | s | 0 | 2 | 0.005 | 0.166667 | src/sim/moves/air-slash.move.json:22 | muda · air-slash/perto |
| `world.airSlash.speed` | Velocidade da lâmina | m/s | 5 | 100 | 0.5 | 22 | src/sim/moves/air-slash.js:20 | muda · air-slash/perto |
| `world.airSlash.range` | Alcance | m | 2 | 50 | 0.5 | 10 | src/sim/moves/air-slash.js:24 | muda · air-slash/longe |
| `world.airSlash.radius` | Raio do colisor (equivalente) | m | 0.1 | 3 | 0.05 | 0.6 | src/sim/moves/air-slash.js:19 | muda · air-slash/perto |
| `world.airSlash.damage` | Dano (nominal) | número | 0 | 80 | 0.5 | 8 | src/sim/moves/air-slash.js:29 | muda · air-slash/perto |
| `world.airSlash.knockbackH` | Empurrão H | m/s | 0 | 15 | 0.1 | 2.5 | src/sim/moves/air-slash.js:25 | muda · air-slash/perto |
| `world.airSlash.knockbackV` | Empurrão V | m/s | 0 | 15 | 0.1 | 0 | src/sim/moves/air-slash.js:25 | muda · air-slash/perto |
| `world.airSlash.originHeight` | Altura de nascimento (mão) | m | 0.2 | 2.6 | 0.05 | 0.8 | src/sim/moves/air-slash.js:18 | muda · air-slash/perto |
| `world.airSlash.spawnForward` | Distância de nascimento | m | 0.3 | 3 | 0.05 | 0.6 | src/sim/moves/air-slash.js:18 | muda · air-slash/perto |
| `world.airSlash.counterStagger` | Counter Stagger | s | 0 | 2 | 0.01 | 0.2 | src/sim/moves/air-slash.js:26 | pendente (move) |
| `world.airSlash.pierce` | Alvos perfurados pela lâmina | inteiro | 1 | 10 | 1 | 1 | src/sim/moves/air-slash.js:24 | muda · air-slash/perto |
| `world.airSlash.visualWidth` | Desenho: largura (só aparência) | m | 0.2 | 6 | 0.05 | 1.2 | src/sim/moves/air-slash.js:26 | visual/depuração |
| `world.airSlash.visualHeight` | Desenho: altura (só aparência) | m | 0.2 | 4 | 0.05 | 0.7 | src/sim/moves/air-slash.js:26 | visual/depuração |
| `world.airSlash.visualThickness` | Desenho: espessura (só aparência) | m | 0.05 | 2 | 0.01 | 0.22 | src/sim/moves/air-slash.js:26 | visual/depuração |
| `world.airSlash.hitShakeOn` | Tremor de câmera ao acertar | liga/desliga | 0 | 1 | 1 | 0 | src/view/vfx.js:54 | visual/depuração |
| `world.airSlash.hitShakeAmount` | Tremor ao acertar: intensidade | × | 0 | 12 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |
| `world.airSlash.hitShakeDuration` | Tremor ao acertar: duração | × | 0.1 | 10 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |

## Moves · Bounce

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.bounce.cost` | Custo de stamina | número | 0 | 10 | 0.05 | 1.2 | src/sim/moves.js:88 | muda · bounce/perto |
| `world.bounce.cooldown` | Cooldown | s | 0 | 120 | 0.5 | 12 | src/sim/moves.js:88 | pendente (move) |
| `world.bounce.maxCharge` | Carga máxima | s | 0.2 | 8 | 0.05 | 1.2 | src/sim/charge.js:28 | muda · bounce/perto |
| `world.bounce.minCharge` | Carga mínima para soltar | s | 0 | 4 | 0.05 | 0 | src/sim/charge.js:29 | muda · bounce/perto |
| `world.bounce.maxDistance` | Distância horizontal máxima | m | 1 | 30 | 0.5 | 6 | src/sim/moves/bounce.js:32 | muda · bounce/perto |
| `world.bounce.heightPl1` | Altura do salto PL1 | m | 0.3 | 16 | 0.1 | 1.5 | src/sim/moves/bounce.js:22 | muda · bounce/carga curta |
| `world.bounce.heightPl2` | Altura do salto PL2 | m | 0.3 | 16 | 0.1 | 2.5 | src/sim/moves/bounce.js:22 | muda · bounce/duelo |
| `world.bounce.heightPl3` | Altura do salto PL3 | m | 0.3 | 16 | 0.1 | 3.5 | src/sim/moves/bounce.js:22 | muda · bounce/perto |
| `world.bounce.gravity` | Gravidade do arco | número | 5 | 80 | 0.5 | 17.5 | src/sim/moves/bounce.js:28 | muda · bounce/perto |
| `world.bounce.damage` | Dano nominal | número | 0 | 120 | 0.5 | 12 | src/sim/moves/bounce.js:37 | muda · bounce/perto |
| `world.bounce.knockbackH` | Knockback horizontal | m/s | 0 | 15 | 0.1 | 3 | src/sim/moves/bounce.js:52 | muda · bounce/perto |
| `world.bounce.knockbackV` | Knockback vertical | m/s | 0 | 15 | 0.1 | 6 | src/sim/moves/bounce.js:52 | muda · bounce/perto |
| `world.bounce.landRecovery` | Recuperação após o pouso | s | 0 | 4 | 0.01 | 0.25 | src/sim/moves/bounce.js:33 | muda · bounce/perto |
| `world.bounce.contactRadius` | Folga do contato na descida | m | 0 | 4 | 0.05 | 0.3 | src/sim/moves/bounce.js:68 | muda · bounce/longe |
| `world.bounce.landRadius` | Raio do impacto do pouso | m | 0 | 10 | 0.1 | 1.4 | src/sim/moves/bounce.js:83 | muda · bounce/longe |
| `world.bounce.verticalReach` | Alcance vertical do acerto | m | 0.3 | 8 | 0.1 | 1.3 | src/sim/moves/bounce.js:64 | muda · bounce/perto |

## Moves · Bullet Punch

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.bulletPunch.cost` | Custo de stamina (× Tackle) | × | 0 | 10 | 0.1 | 1.5 | src/sim/moves.js:88 | muda · bullet-punch/perto |
| `world.bulletPunch.cooldown` | Cooldown | s | 0 | 120 | 0.5 | 8 | src/sim/moves.js:88 | muda · bullet-punch/duelo |
| `world.bulletPunch.cast` | Preparação | s | 0.1 | 6 | 0.05 | 0.2 | src/sim/moves.js:85 | muda · bullet-punch/perto |
| `world.bulletPunch.vanish` | Tempo da corrida invisível | s | 0.05 | 12 | 0.05 | 0.2 | src/sim/moves/bullet-punch/bullet-punch.js:43 | muda · bullet-punch/perto |
| `world.bulletPunch.reach` | Alcance do Move (aquisição do alvo) | m | 0.5 | 40 | 0.25 | 6 | src/sim/moves/bullet-punch/bullet-punch.js:123 | muda · bullet-punch/perto |
| `world.bulletPunch.strikeReach` | Alcance do golpe na chegada | m | 0.5 | 16 | 0.1 | 2.2 | src/sim/moves/bullet-punch/bullet-punch.js:23 | muda · bullet-punch/perto |
| `world.bulletPunch.stopShort` | Distância de parada antes do alvo | m | 0.6 | 8 | 0.1 | 1.1 | src/sim/moves/bullet-punch/bullet-punch.js:40 | muda · bullet-punch/perto |
| `world.bulletPunch.hitRadius` | Raio de contato no caminho | m | 0.3 | 6 | 0.05 | 0.8 | src/sim/moves/bullet-punch/bullet-punch.js:84 | muda · bullet-punch/perto |
| `world.bulletPunch.impactMult` | Velocidade de impacto do knockback (× Tackle) | × | 0 | 10 | 0.1 | 2.6 | src/sim/moves/bullet-punch/bullet-punch.js:24 | muda · bullet-punch/perto |
| `world.bulletPunch.knockbackOwn` | Knockback próprio (em vez da fórmula do Tackle) | liga/desliga | 0 | 1 | 1 | 0 | src/sim/moves/bullet-punch/bullet-punch.js:25 | muda · bullet-punch/perto |
| `world.bulletPunch.knockbackH` | Knockback horizontal (próprio) | m/s | 0 | 15 | 0.1 | 4 | src/sim/moves/bullet-punch/bullet-punch.js:25 | muda · bullet-punch/perto |
| `world.bulletPunch.knockbackV` | Knockback vertical (próprio) | m/s | 0 | 15 | 0.1 | 0 | src/sim/moves/bullet-punch/bullet-punch.js:25 | muda · bullet-punch/perto |
| `world.bulletPunch.slow` | Redução da velocidade na preparação | % | 0 | 1.9 | 0.05 | 0.7 | src/sim/controller/ctrl-moves.js:270 | muda · bullet-punch/duelo |
| `world.bulletPunch.maxRise` | Altura de apoio na chegada (técnico) | m | 0 | 12 | 0.25 | 2 | src/sim/aim-marker.js:20 | pendente (move) |
| `world.bulletPunch.fxLines` | Linhas de velocidade no sumiço | liga/desliga | 0 | 1 | 1 | 1 | src/view/aim-marker-view.js:66 | visual/depuração |
| `world.bulletPunch.fxHideBody` | Ocultar o corpo durante o sumiço | liga/desliga | 0 | 1 | 1 | 1 | src/view/view.js:360 | visual/depuração |
| `world.bulletPunch.airReach` | Alcance vertical anti-aéreo | m | 0 | 16 | 0.25 | 3 | src/sim/moves/bullet-punch/bullet-punch.js:85 | pendente (move) |
| `world.bulletPunch.rayStep` | Passo da varredura contra paredes (técnico) | m | 0.05 | 2 | 0.05 | 0.25 | src/sim/moves/bullet-punch/bullet-punch.js:51 | pendente (move) |
| `world.bulletPunch.freeSearchRadius` | Raio máximo de busca por espaço livre (técnico) | m | 1 | 24 | 0.5 | 6 | src/sim/moves/bullet-punch/bullet-punch.js:64 | pendente (move) |
| `world.bulletPunch.freeSearchStep` | Passo da busca por espaço livre (técnico) | m | 0.05 | 2 | 0.05 | 0.25 | src/sim/moves/bullet-punch/bullet-punch.js:64 | muda · bullet-punch/contra-ataque |
| `world.bulletPunch.atelierVfx` | VFX do Ateliê (punho novo) | liga/desliga | 0 | 1 | 1 | 0 | src/sim/moves/bullet-punch/bullet-punch.vfx.js:30 | visual/depuração |

## Moves · Emerging Stone

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.emergingStone.cost` | Custo de stamina | número | 0 | 20 | 0.1 | 3 | src/sim/moves.js:88 | muda · emerging-stone/perto |
| `world.emergingStone.cooldown` | Cooldown | s | 0 | 120 | 0.5 | 9 | src/sim/moves.js:88 | muda · emerging-stone/duelo |
| `world.emergingStone.cast` | Cast físico | s | 0.1 | 6 | 0.05 | 0.55 | src/sim/moves.js:85 | muda · emerging-stone/perto |
| `world.emergingStone.castSlow` | Redução de velocidade no cast | % | 0 | 1.9 | 0.05 | 0.7 | src/sim/controller/ctrl-basico.js:21 | muda · emerging-stone/duelo |
| `world.emergingStone.minRange` | Alcance mínimo do marcador (3D) | m | 0 | 20 | 0.25 | 3 | src/sim/aim-marker.js:25 | muda · emerging-stone/perto |
| `world.emergingStone.range` | Alcance máximo do marcador (3D) | m | 1 | 60 | 0.5 | 10 | src/sim/aim-marker.js:24 | muda · emerging-stone/perto |
| `world.emergingStone.speed` | Velocidade do projétil | m/s | 2 | 120 | 0.5 | 15 | src/sim/moves/emerging-stone.js:23 | muda · emerging-stone/perto |
| `world.emergingStone.blastRadius` | Raio da explosão (horizontal) | m | 0.5 | 40 | 0.25 | 5 | src/sim/stone.js:35 | muda · emerging-stone/correndo |
| `world.emergingStone.damage` | Dano nominal da explosão | número | 0 | 200 | 1 | 20 | src/sim/moves/emerging-stone.js:24 | muda · emerging-stone/perto |
| `world.emergingStone.blastKnockback` | Empurrão radial da explosão (horizontal) | m/s | 0 | 15 | 0.5 | 8 | src/sim/stone.js:41 | muda · emerging-stone/perto |
| `world.emergingStone.blastKnockbackV` | Empurrão radial da explosão (vertical) | m/s | 0 | 15 | 0.1 | 0 | src/sim/stone.js:41 | muda · emerging-stone/perto |
| `world.emergingStone.rockScale` | Escala do prisma da rocha | × | 0.25 | 8 | 0.25 | 1 | src/sim/stone.js:111 | muda · emerging-stone/perto |
| `world.emergingStone.rockHp` | HP da rocha | inteiro | 1 | 60 | 1 | 5 | src/sim/stone.js:126 | muda · emerging-stone/perto |
| `world.emergingStone.riseTime` | Tempo de emergência | s | 0.1 | 6 | 0.05 | 0.4 | src/sim/stone.js:127 | muda · emerging-stone/perto |
| `world.emergingStone.launchH` | Lançamento da emergência: horizontal | m/s | 0 | 15 | 0.5 | 8 | src/sim/stone.js:127 | muda · emerging-stone/perto |
| `world.emergingStone.launchV` | Lançamento da emergência: vertical | m/s | 0 | 15 | 0.5 | 14 | src/sim/stone.js:127 | muda · emerging-stone/perto |
| `world.emergingStone.maxRocks` | Rochas simultâneas por dono | inteiro | 1 | 20 | 1 | 3 | src/sim/stone.js:131 | pendente (move) |
| `world.emergingStone.rockSearch` | Busca de lugar válido (m) | m | 0 | 20 | 0.25 | 4 | src/sim/stone.js:117 | pendente (move) |
| `world.emergingStone.startDistance` | Distância inicial do marcador | m | 1 | 20 | 0.25 | 5 | src/sim/aim-marker.js:45 | pendente (move) |
| `world.emergingStone.markerAccel` | Aceleração do marcador | número | 0 | 400 | 1 | 24 | src/sim/controller/ctrl-moves.js:201 | muda · emerging-stone/duelo |
| `world.emergingStone.fxTrailOn` | Rastro de terra do projétil | liga/desliga | 0 | 1 | 1 | 1 | src/view/world-view/wv-update.js:93 | visual/depuração |
| `world.emergingStone.fxTrailSize` | Tamanho do rastro de terra | × | 0.5 | 10 | 0.1 | 1.8 | src/view/world-view/wv-update.js:93 | visual/depuração |
| `world.emergingStone.markerSpeed` | Velocidade do marcador | m/s | 1 | 60 | 0.5 | 8 | src/sim/controller/ctrl-moves.js:201 | muda · emerging-stone/duelo |
| `world.emergingStone.maxRise` | Altura de apoio do marcador (técnico) | m | 0 | 12 | 0.25 | 2 | src/sim/aim-marker.js:20 | pendente (move) |
| `world.emergingStone.edgeMargin` | Folga da borda da arena (técnico) | m | 0 | 4 | 0.05 | 0.3 | src/sim/aim-marker.js:23 | pendente (move) |
| `world.emergingStone.radius` | Folga contra paredes do marcador (técnico) | m | 0 | 6 | 0.1 | 0 | src/sim/aim-marker.js:28 | pendente (move) |
| `world.emergingStone.allowOccupied` | Marcador sobre personagem? | liga/desliga | 0 | 1 | 1 | 1 | src/sim/aim-marker.js:31 | muda · emerging-stone/perto |
| `world.emergingStone.burrowMaxLife` | Tempo máximo do projétil subterrâneo (técnico) | s | 5 | 240 | 5 | 120 | src/sim/moves/emerging-stone.js:23 | pendente (move) |
| `world.emergingStone.rockBaseWidth` | Largura base da rocha | m | 0.5 | 16 | 0.25 | 3 | src/sim/stone.js:110 | muda · emerging-stone/perto |
| `world.emergingStone.rockBaseHeight` | Altura base da rocha | m | 0.5 | 16 | 0.25 | 3 | src/sim/stone.js:110 | muda · emerging-stone/perto |
| `world.emergingStone.rockSearchStep` | Passo da busca de posicionamento (técnico) | m | 0.05 | 2 | 0.05 | 0.25 | src/sim/stone.js:112 | pendente (move) |
| `world.emergingStone.supportTolerance` | Tolerância vertical de apoio da rocha (técnico) | m | 0.01 | 0.6 | 0.01 | 0.06 | src/sim/stone.js:143 | pendente (move) |
| `world.emergingStone.hitShakeOn` | Tremor de câmera ao acertar | liga/desliga | 0 | 1 | 1 | 0 | src/view/vfx.js:54 | visual/depuração |
| `world.emergingStone.hitShakeAmount` | Tremor ao acertar: intensidade | × | 0 | 12 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |
| `world.emergingStone.hitShakeDuration` | Tremor ao acertar: duração | × | 0.1 | 10 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |

## Moves · Feint

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.feint.cost` | Custo de stamina | número | 0 | 6 | 0.05 | 0.3 | src/sim/moves.js:88 | muda · feint/perto |
| `world.feint.cooldown` | Cooldown | s | 0 | 60 | 0.5 | 3 | src/sim/moves.js:88 | pendente (move) |
| `world.feint.cast` | Duração do recuo | s | 0.05 | 2 | 0.01 | 0.22 | src/sim/moves.js:85 | muda · feint/perto |
| `world.feint.cancelAfter` | Libera outras ações após | s | 0 | 2 | 0.01 | 0.0333 | src/sim/moves.js:88 | pendente (move) |
| `world.feint.cancelWindow` | Janela de cancelamento do ataque | s | 0 | 2 | 0.01 | 0.1333 | src/sim/controller/ctrl-moves.js:15 | pendente (move) |
| `world.feint.retreat` | Distância do recuo | m | 0 | 4 | 0.01 | 0.25 | src/sim/moves/feint.move.json:38 | muda · feint/perto |
| `world.feint.dashStart` | Início do impulso de recuo | s | 0 | 1 | 0.005 | 0.03 | src/sim/moves/feint.move.json:39 | muda · feint/perto |
| `world.feint.dashEnd` | Fim do impulso de recuo | s | 0.02 | 1.6 | 0.005 | 0.15 | src/sim/moves/feint.move.json:40 | muda · feint/perto |
| `world.feint.invulnStart` | I-frames: início | s | 0 | 1 | 0.005 | 0.0167 | src/sim/moves/feint.move.json:30 | pendente (move) |
| `world.feint.invulnEnd` | I-frames: fim | s | 0 | 1 | 0.005 | 0.0833 | src/sim/moves/feint.move.json:31 | pendente (move) |

## Moves · Fire Spin

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.fireSpin.cost` | Custo de stamina | número | 0 | 10 | 0.05 | 1 | src/sim/moves.js:88 | muda · fire-spin/perto |
| `world.fireSpin.cooldown` | Cooldown | s | 0 | 120 | 0.5 | 11 | src/sim/moves.js:88 | pendente (move) |
| `world.fireSpin.cast` | Cast (até a zona nascer) | s | 0.05 | 4 | 0.01 | 0.4 | src/sim/moves.js:85 | muda · fire-spin/perto |
| `world.fireSpin.recovery` | Recovery depois da zona nascer | s | 0 | 2 | 0.01 | 0.2 | src/sim/moves/fire-spin.move.json:22 | muda · fire-spin/perto |
| `world.fireSpin.range` | Alcance do marcador (3D) | m | 1 | 80 | 0.5 | 20 | src/sim/moves/fire-spin.js:19 | muda · fire-spin/perto |
| `world.fireSpin.zoneRadius` | Raio da zona | m | 0.5 | 8 | 0.05 | 1.6 | src/sim/moves/fire-spin.js:27 | muda · fire-spin/correndo |
| `world.fireSpin.zoneHeight` | Altura da zona | m | 0.5 | 10 | 0.1 | 2.4 | src/sim/moves/fire-spin.js:27 | pendente (move) |
| `world.fireSpin.life` | Duração da zona | s | 0.5 | 16 | 0.1 | 2.4 | src/sim/moves/fire-spin.js:24 | muda · fire-spin/perto |
| `world.fireSpin.interval` | Intervalo entre pulsos | s | 0.1 | 4 | 0.05 | 0.6 | src/sim/moves/fire-spin.js:24 | muda · fire-spin/perto |
| `world.fireSpin.startup` | Atraso do primeiro pulso (start-up) | s | 0 | 6 | 0.05 | 0 | src/sim/moves/fire-spin.js:24 | muda · fire-spin/perto |
| `world.fireSpin.damage` | Dano por pulso (nominal) | número | 0 | 20 | 0.25 | 2 | src/sim/moves/fire-spin.js:22 | muda · fire-spin/perto |
| `world.fireSpin.knockbackH` | Knockback horizontal por pulso | m/s | 0 | 15 | 0.1 | 0 | src/sim/moves/fire-spin.js:28 | muda · fire-spin/perto |
| `world.fireSpin.knockbackV` | Knockback vertical por pulso | m/s | 0 | 15 | 0.1 | 0 | src/sim/moves/fire-spin.js:28 | muda · fire-spin/perto |
| `world.fireSpin.guardStun` | Guard stun por pulso | s | 0 | 2 | 0.01 | 0 | src/sim/moves/fire-spin.js:28 | muda · fire-spin/defesa |
| `world.fireSpin.occlusion` | Paredes bloqueiam os pulsos | liga/desliga | 0 | 1 | 1 | 1 | src/sim/moves/fire-spin.js:28 | pendente (move) |
| `world.fireSpin.maxActive` | Zonas simultâneas por dono | inteiro | 1 | 8 | 1 | 1 | src/sim/moves/fire-spin.js:22 | pendente (move) |
| `world.fireSpin.allowOccupied` | Permitir colocar sobre um lutador | liga/desliga | 0 | 1 | 1 | 1 | src/sim/aim-marker.js:31 | muda · fire-spin/perto |
| `world.fireSpin.minRange` | Alcance mínimo do marcador | m | 0 | 20 | 0.25 | 3 | src/sim/aim-marker.js:25 | muda · fire-spin/perto |
| `world.fireSpin.markerSpeed` | Velocidade do marcador | m/s | 1 | 60 | 0.5 | 8 | src/sim/controller/ctrl-moves.js:201 | muda · fire-spin/duelo |
| `world.fireSpin.markerAccel` | Aceleração do marcador | m/s² | 0 | 200 | 1 | 24 | src/sim/controller/ctrl-moves.js:201 | muda · fire-spin/duelo |
| `world.fireSpin.startDistance` | Distância inicial do marcador | m | 0.5 | 20 | 0.25 | 3 | src/sim/aim-marker.js:45 | pendente (move) |
| `world.fireSpin.maxRise` | Altura máxima de apoio acima dos pés | m | 0 | 12 | 0.25 | 2 | src/sim/aim-marker.js:20 | pendente (move) |
| `world.fireSpin.pulsePl` | Power Level dos pulsos | inteiro | 1 | 3 | 1 | 1 | src/sim/moves/fire-spin.js:28 | pendente (move) |
| `world.fireSpin.hitShakeOn` | Tremor de câmera ao acertar | liga/desliga | 0 | 1 | 1 | 0 | src/view/vfx.js:54 | visual/depuração |
| `world.fireSpin.hitShakeAmount` | Tremor ao acertar: intensidade | × | 0 | 12 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |
| `world.fireSpin.hitShakeDuration` | Tremor ao acertar: duração | × | 0.1 | 10 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |

## Moves · Guard Break

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.guardBreak.cost` | Custo de stamina | número | 0 | 10 | 0.05 | 1 | src/sim/moves.js:88 | muda · guard-break/perto |
| `world.guardBreak.cooldown` | Cooldown | s | 0 | 120 | 0.5 | 10 | src/sim/moves.js:88 | pendente (move) |
| `world.guardBreak.cast` | Duração do golpe (pós-soltura) | s | 0.2 | 6 | 0.01 | 0.7 | src/sim/moves.js:85 | muda · guard-break/perto |
| `world.guardBreak.maxCharge` | Carga máxima | s | 0.2 | 8 | 0.05 | 1 | src/sim/charge.js:28 | pendente (move) |
| `world.guardBreak.minCharge` | Carga mínima para soltar | s | 0 | 4 | 0.05 | 0 | src/sim/charge.js:29 | muda · guard-break/perto |
| `world.guardBreak.range` | Distância do avanço | m | 0.5 | 16 | 0.1 | 2.6 | src/sim/moves/guard-break.js:20 | muda · guard-break/perto |
| `world.guardBreak.damage` | Dano nominal | número | 0 | 80 | 0.5 | 6 | src/sim/moves/guard-break.js:21 | muda · guard-break/colado |
| `world.guardBreak.knockbackH` | Knockback horizontal (sem guarda) | m/s | 0 | 15 | 0.1 | 2 | src/sim/moves/guard-break.js:22 | muda · guard-break/colado |
| `world.guardBreak.knockbackV` | Knockback vertical | m/s | 0 | 15 | 0.1 | 0 | src/sim/moves/guard-break.js:22 | muda · guard-break/colado |
| `world.guardBreak.stun` | Guard stun | s | 0 | 6 | 0.05 | 0.5 | src/sim/moves/guard-break.js:26 | pendente (move) |
| `world.guardBreak.invulnerableSeconds` | Invulnerabilidade do atacante | s | 0 | 2 | 0.01 | 0 | src/sim/moves/guard-break.js:23 | pendente (move) |
| `world.guardBreak.chainAfter` | Cancelável após | s | 0 | 4 | 0.01 | 0.47 | src/sim/moves/guard-break.js:24 | pendente (move) |
| `world.guardBreak.hitStart` | Janela ativa: início | s | 0 | 3 | 0.01 | 0.333 | src/sim/moves/guard-break.js:28 | pendente (move) |
| `world.guardBreak.hitEnd` | Janela ativa: fim | s | 0 | 3 | 0.01 | 0.533 | src/sim/moves/guard-break.js:28 | pendente (move) |

## Moves · Harden

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.harden.cost` | Custo de stamina | número | 0 | 10 | 0.05 | 0.8 | src/sim/moves.js:88 | muda · harden/perto |
| `world.harden.cooldown` | Cooldown | s | 0 | 120 | 0.5 | 10 | src/sim/moves.js:88 | pendente (move) |
| `world.harden.cast` | Duração do cast | s | 0.05 | 4 | 0.01 | 0.35 | src/sim/moves.js:85 | muda · harden/perto |
| `world.harden.duration` | Duração do efeito | s | 0.5 | 40 | 0.25 | 5 | src/sim/moves/harden.js:19 | muda · harden/perto |
| `world.harden.defensePct` | Bônus de Defesa | % | 0 | 4 | 0.05 | 0.3 | src/sim/moves/harden.js:20 | muda · harden/contra-ataque |
| `world.harden.negateKnockback` | Anula o knockback ofensivo? | liga/desliga | 0 | 1 | 1 | 1 | src/sim/moves/harden.js:20 | muda · harden/contra-ataque |

## Moves · Lunge

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.lunge.cost` | Custo de stamina | número | 0 | 10 | 0.05 | 0.75 | src/sim/moves.js:88 | muda · lunge/perto |
| `world.lunge.cooldown` | Cooldown | s | 0 | 120 | 0.5 | 6 | src/sim/moves.js:88 | pendente (move) |
| `world.lunge.cast` | Duração total da ação | s | 0.1 | 4 | 0.01 | 0.6 | src/sim/moves.js:85 | muda · lunge/perto |
| `world.lunge.range` | Distância do avanço | m | 0.5 | 24 | 0.1 | 3.5 | src/sim/moves/lunge.js:18 | muda · lunge/perto |
| `world.lunge.damage` | Dano nominal | número | 0 | 80 | 0.5 | 8 | src/sim/moves/lunge.js:19 | muda · lunge/perto |
| `world.lunge.knockbackH` | Knockback horizontal | m/s | 0 | 15 | 0.1 | 4 | src/sim/moves/lunge.js:20 | muda · lunge/perto |
| `world.lunge.knockbackV` | Knockback vertical | m/s | 0 | 15 | 0.1 | 0 | src/sim/moves/lunge.js:20 | muda · lunge/perto |
| `world.lunge.invulnerableSeconds` | Invulnerabilidade inicial | s | 0 | 2 | 0.01 | 0.1333 | src/sim/moves/lunge.js:21 | pendente (move) |
| `world.lunge.chainAfter` | Cancelável após | s | 0 | 4 | 0.01 | 0.45 | src/sim/moves/lunge.js:22 | pendente (move) |
| `world.lunge.hitStart` | Janela ativa: início | s | 0 | 2 | 0.01 | 0.19 | src/sim/moves/lunge.js:24 | pendente (move) |
| `world.lunge.hitEnd` | Janela ativa: fim | s | 0 | 2 | 0.01 | 0.26 | src/sim/moves/lunge.js:24 | pendente (move) |

## Moves · Psyshock

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.psyshock.cost` | Custo de stamina | número | 0 | 10 | 0.05 | 1 | src/sim/moves.js:88 | muda · psyshock/perto |
| `world.psyshock.cooldown` | Cooldown | s | 0 | 120 | 0.5 | 8 | src/sim/moves.js:88 | pendente (move) |
| `world.psyshock.maxCharge` | Carga máxima | s | 0.5 | 20 | 0.1 | 4 | src/sim/charge.js:28 | muda · psyshock/perto |
| `world.psyshock.minCharge` | Carga mínima para disparar | s | 0 | 8 | 0.05 | 0 | src/sim/charge.js:29 | muda · psyshock/perto |
| `world.psyshock.minStones` | Pedras iniciais | inteiro | 1 | 16 | 1 | 3 | src/sim/moves/psyshock.js:20 | muda · psyshock/perto |
| `world.psyshock.maxStones` | Pedras no máximo | inteiro | 1 | 32 | 1 | 8 | src/sim/moves/psyshock.js:20 | muda · psyshock/perto |
| `world.psyshock.stoneSeconds` | Segundos por pedra extra | s | 0.2 | 4 | 0.05 | 0.8 | src/sim/moves/psyshock.js:19 | muda · psyshock/perto |
| `world.psyshock.speedMin` | Velocidade mínima | m/s | 2 | 60 | 0.5 | 10 | src/sim/moves/psyshock.js:75 | muda · psyshock/perto |
| `world.psyshock.speedMax` | Velocidade máxima | m/s | 2 | 60 | 0.5 | 14 | src/sim/moves/psyshock.js:75 | muda · psyshock/perto |
| `world.psyshock.homingSeconds` | Duração do homing | s | 0 | 2 | 0.05 | 0.3 | src/sim/moves/psyshock.js:83 | muda · psyshock/perto |
| `world.psyshock.homingRate` | Giro máximo do homing | ° | 0 | 1440 | 10 | 180 | src/sim/moves/psyshock.js:83 | muda · psyshock/perto |
| `world.psyshock.aimHeightMin` | Mira travada: altura mínima no alvo | % | 0 | 2 | 0.05 | 0.05 | src/sim/moves/psyshock.js:72 | muda · psyshock/perto |
| `world.psyshock.aimHeightMax` | Mira travada: altura máxima no alvo | % | 0 | 2 | 0.05 | 0.95 | src/sim/moves/psyshock.js:72 | muda · psyshock/perto |
| `world.psyshock.fanAngle` | Leque sem alvo | ° | 0 | 180 | 1 | 20 | src/sim/moves/psyshock.js:71 | pendente (move) |
| `world.psyshock.searchRange` | Alcance da busca de espaço | m | 0 | 16 | 0.25 | 3 | src/sim/moves/psyshock.js:49 | muda · psyshock/colado |
| `world.psyshock.searchStep` | Passo da busca de espaço | m | 0.05 | 2 | 0.05 | 0.25 | src/sim/moves/psyshock.js:49 | muda · psyshock/colado |
| `world.psyshock.arc` | Abertura do arco das pedras | ° | 0 | 720 | 5 | 120 | src/sim/moves/psyshock.js:44 | muda · psyshock/perto |
| `world.psyshock.ringMin` | Distância mínima do lançador | m | 0.3 | 6 | 0.05 | 0.8 | src/sim/moves/psyshock.js:46 | muda · psyshock/perto |
| `world.psyshock.ringMax` | Distância máxima do lançador | m | 0.3 | 6 | 0.05 | 1.1 | src/sim/moves/psyshock.js:46 | muda · psyshock/perto |
| `world.psyshock.heightMin` | Altura mínima das pedras | m | 0 | 5 | 0.05 | 0.35 | src/sim/moves/psyshock.js:47 | muda · psyshock/perto |
| `world.psyshock.heightMax` | Altura máxima das pedras | m | 0 | 5 | 0.05 | 1.1 | src/sim/moves/psyshock.js:47 | muda · psyshock/perto |
| `world.psyshock.scaleMin` | Tamanho visual mínimo | × | 0.3 | 6 | 0.05 | 0.7 | src/sim/moves/psyshock.js:47 | visual/depuração |
| `world.psyshock.scaleMax` | Tamanho visual máximo | × | 0.3 | 6 | 0.05 | 1.3 | src/sim/moves/psyshock.js:47 | visual/depuração |
| `world.psyshock.damageFraction` | Dano-base | % | 0.01 | 2 | 0.01 | 0.2 | src/sim/moves/psyshock.js:71 | muda · psyshock/perto |
| `world.psyshock.successiveFactor` | Fator por acerto no mesmo alvo | % | 0.1 | 2 | 0.01 | 0.8 | src/sim/moves/psyshock.js:93 | muda · psyshock/perto |
| `world.psyshock.knockbackPerStone` | Knockback por pedra | m/s | 0 | 15 | 0.05 | 0.3 | src/sim/moves/psyshock.js:89 | muda · psyshock/perto |
| `world.psyshock.knockbackCap` | Teto de knockback por alvo | m/s | 0 | 15 | 0.05 | 0.9 | src/sim/moves/psyshock.js:93 | muda · psyshock/perto |
| `world.psyshock.knockbackVertical` | Lançamento vertical por pedra | m/s | 0 | 15 | 0.05 | 0 | src/sim/moves/psyshock.js:92 | muda · psyshock/perto |
| `world.psyshock.knockbackLevelBonus` | Bônus de empurrão por nível de PL | % | 0 | 3.2 | 0.05 | 0 | src/sim/moves/psyshock.js:89 | pendente (move) |
| `world.psyshock.knockbackSpeedFactor` | Empurrão acompanha a velocidade da pedra | % | 0 | 3.2 | 0.05 | 0 | src/sim/moves/psyshock.js:89 | muda · psyshock/perto |
| `world.psyshock.counterStagger` | Counter Stagger | s | 0 | 2 | 0.01 | 0.2 | src/sim/moves/psyshock.js:93 | pendente (move) |
| `world.psyshock.radius` | Raio de colisão da pedra | m | 0.05 | 1 | 0.01 | 0.2 | src/sim/moves/psyshock.js:48 | muda · psyshock/perto |
| `world.psyshock.hitShakeOn` | Tremor de câmera ao acertar | liga/desliga | 0 | 1 | 1 | 0 | src/view/vfx.js:54 | visual/depuração |
| `world.psyshock.hitShakeAmount` | Tremor ao acertar: intensidade | × | 0 | 6 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |
| `world.psyshock.hitShakeDuration` | Tremor ao acertar: duração | × | 0.1 | 5 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |

## Moves · Quick Attack

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.quickAttack.cost` | Custo de stamina | número | 0 | 10 | 0.05 | 0.75 | src/sim/moves.js:88 | muda · quick-attack/perto |
| `world.quickAttack.cooldown` | Cooldown | s | 0 | 120 | 0.5 | 6 | src/sim/moves.js:88 | muda · quick-attack/duelo |
| `world.quickAttack.acquireRange` | Alcance de aquisição do alvo | m | 1 | 40 | 0.5 | 7 | src/sim/moves/quick-attack.js:23 | muda · quick-attack/perto |
| `world.quickAttack.approachMax` | Tempo máximo da ida | s | 0.05 | 2 | 0.01 | 0.16 | src/sim/moves/quick-attack.js:31 | muda · quick-attack/perto |
| `world.quickAttack.returnMax` | Tempo máximo da volta | s | 0.05 | 2 | 0.01 | 0.14 | src/sim/moves/quick-attack.js:31 | muda · quick-attack/perto |
| `world.quickAttack.recovery` | Recuperação final | s | 0 | 2 | 0.01 | 0.12 | src/sim/moves/quick-attack.js:31 | muda · quick-attack/perto |
| `world.quickAttack.damage` | Dano nominal | número | 0 | 80 | 0.5 | 8 | src/sim/moves/quick-attack.js:28 | muda · quick-attack/perto |
| `world.quickAttack.knockbackH` | Knockback horizontal | m/s | 0 | 15 | 0.1 | 4 | src/sim/moves/quick-attack.js:29 | muda · quick-attack/perto |
| `world.quickAttack.knockbackV` | Knockback vertical | m/s | 0 | 15 | 0.1 | 0 | src/sim/moves/quick-attack.js:29 | muda · quick-attack/perto |
| `world.quickAttack.invulnerableSeconds` | Invulnerabilidade do atacante | s | 0 | 2 | 0.01 | 0 | src/sim/moves/quick-attack.js:30 | pendente (move) |
| `world.quickAttack.fxLines` | Linhas de velocidade no sumiço | liga/desliga | 0 | 1 | 1 | 1 | src/view/aim-marker-view.js:66 | visual/depuração |
| `world.quickAttack.fxHideBody` | Ocultar o corpo durante o sumiço | liga/desliga | 0 | 1 | 1 | 1 | src/view/view.js:360 | visual/depuração |
| `world.quickAttack.airReach` | Alcance vertical anti-aéreo | m | 0 | 16 | 0.25 | 3 | src/sim/controller/ctrl-moves.js:105 | pendente (move) |
| `world.quickAttack.approachStopDist` | Tolerância de chegada na ida | m | 0.02 | 2 | 0.01 | 0.15 | src/sim/moves/quick-attack.js:49 | muda · quick-attack/perto |
| `world.quickAttack.returnStopDist` | Tolerância de chegada no retorno | m | 0.02 | 2 | 0.01 | 0.08 | src/sim/moves/quick-attack.js:49 | muda · quick-attack/perto |
| `world.quickAttack.stuckTicks` | Passos travado para interromper fase | inteiro | 1 | 40 | 1 | 3 | src/sim/moves/quick-attack.js:48 | pendente (move) |
| `world.quickAttack.stuckSpeedRatio` | Limiar de velocidade de travamento | % | 0.05 | 1.8 | 0.05 | 0.3 | src/sim/moves/quick-attack.js:48 | muda · quick-attack/perto |
| `world.quickAttack.atelierVfx` | VFX do Ateliê (rush novo) | liga/desliga | 0 | 1 | 1 | 0 | src/view/quarks/atelier-game.js:256 | visual/depuração |

## Moves · Reflect

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.reflect.cost` | Custo de stamina | número | 0 | 10 | 0.05 | 1 | src/sim/moves.js:88 | muda · reflect/perto |
| `world.reflect.cooldown` | Cooldown | s | 0 | 120 | 0.5 | 8 | src/sim/moves.js:88 | pendente (move) |
| `world.reflect.maxCharge` | Carga máxima | s | 0.5 | 20 | 0.1 | 4 | src/sim/charge.js:28 | muda · reflect/perto |
| `world.reflect.widthMin` | Largura mínima | × | 0.5 | 6 | 0.05 | 1.5 | src/sim/moves/reflect.js:47 | pendente (move) |
| `world.reflect.widthMax` | Largura máxima | × | 1 | 12 | 0.05 | 3 | src/sim/moves/reflect.js:47 | pendente (move) |
| `world.reflect.heightMin` | Altura mínima | × | 0.5 | 6 | 0.05 | 1.5 | src/sim/moves/reflect.js:48 | pendente (move) |
| `world.reflect.heightMax` | Altura máxima | × | 1 | 10 | 0.05 | 2.5 | src/sim/moves/reflect.js:48 | pendente (move) |
| `world.reflect.thickness` | Espessura | m | 0.02 | 1 | 0.01 | 0.1 | src/sim/moves/reflect.js:49 | muda · reflect/perto |
| `world.reflect.gapFraction` | Distância livre à frente | % | 0 | 4 | 0.05 | 0.5 | src/sim/moves/reflect.js:49 | muda · reflect/perto |
| `world.reflect.durationBase` | Duração base | s | 1 | 20 | 0.25 | 4 | src/sim/moves/reflect.js:70 | pendente (move) |
| `world.reflect.minCharge` | Carga mínima para materializar | s | 0 | 8 | 0.05 | 0.9 | src/sim/charge.js:29 | muda · reflect/perto |
| `world.reflect.tackleRecoil` | Recuo do Tackle ao destruir | % | 0 | 1.2 | 0.01 | 0.15 | src/sim/moves/reflect.js:76 | pendente (move) |
| `world.reflect.tackleStagger` | Stagger do Tackle ao destruir | s | 0 | 2 | 0.01 | 0.25 | src/sim/moves/reflect.js:76 | pendente (move) |
| `world.reflect.tieTolerance` | Tolerância de empate geométrico | m | 0 | 0.1 | 0.001 | 0.001 | src/sim/moves/reflect.js:76 | pendente (move) |
| `world.reflect.maxReflections` | Limite de reflexões por passo | inteiro | 1 | 128 | 1 | 16 | src/sim/moves/reflect.js:76 | pendente (move) |
| `world.reflect.burstRadius` | Pulso ao invocar: alcance | m | 0 | 20 | 0.25 | 0 | src/sim/moves/reflect.js:80 | pendente (move) |
| `world.reflect.burstHeight` | Pulso ao invocar: altura | m | 0.5 | 16 | 0.25 | 3 | src/sim/moves/reflect.js:81 | pendente (move) |
| `world.reflect.burstLife` | Pulso ao invocar: duração | s | 0.02 | 2 | 0.02 | 0.1 | src/sim/moves/reflect.js:81 | pendente (move) |
| `world.reflect.burstForce` | Pulso ao invocar: força do empurrão | m/s | 0 | 15 | 0.05 | 3 | src/sim/moves/reflect.js:80 | pendente (move) |
| `world.reflect.burstVertical` | Pulso ao invocar: lançamento vertical | m/s | 0 | 15 | 0.05 | 0 | src/sim/moves/reflect.js:80 | pendente (move) |
| `world.reflect.burstDamage` | Pulso ao invocar: dano | % | 0 | 4 | 0.01 | 0 | src/sim/moves/reflect.js:80 | pendente (move) |
| `world.reflect.burstPush` | Pulso ao invocar: causa empurrão? | liga/desliga | 0 | 1 | 1 | 0 | src/sim/moves/reflect.js:80 | pendente (move) |
| `world.reflect.burstHurt` | Pulso ao invocar: causa dano? | liga/desliga | 0 | 1 | 1 | 0 | src/sim/moves/reflect.js:80 | pendente (move) |
| `world.reflect.hitShakeOn` | Tremor de câmera ao acertar | liga/desliga | 0 | 1 | 1 | 0 | src/view/vfx.js:54 | visual/depuração |
| `world.reflect.hitShakeAmount` | Tremor ao acertar: intensidade | × | 0 | 6 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |
| `world.reflect.hitShakeDuration` | Tremor ao acertar: duração | × | 0.1 | 5 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |

## Moves · Riposte

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.riposte.cost` | Custo de stamina | número | 0 | 10 | 0.05 | 1.55 | src/sim/moves.js:88 | muda · riposte/perto |
| `world.riposte.cooldown` | Cooldown | s | 0 | 120 | 0.5 | 8 | src/sim/moves.js:88 | pendente (move) |
| `world.riposte.cast` | Duração total da postura | s | 0.2 | 6 | 0.01 | 0.65 | src/sim/moves.js:85 | muda · riposte/perto |
| `world.riposte.windowStart` | Janela do contra-ataque: início | s | 0 | 4 | 0.01 | 0 | src/sim/entity.js:89 | muda · riposte/contra-ataque |
| `world.riposte.windowEnd` | Janela do contra-ataque: fim | s | 0 | 4 | 0.01 | 0.59 | src/sim/controller/ctrl-moves.js:136 | muda · riposte/contra-ataque |
| `world.riposte.damage` | Dano nominal do contra-golpe | número | 0 | 80 | 0.5 | 14 | src/sim/controller/ctrl-moves.js:132 | muda · riposte/contra-ataque |
| `world.riposte.knockbackH` | Knockback horizontal do contra-golpe | m/s | 0 | 17 | 0.1 | 16.8 | src/sim/controller/ctrl-moves.js:133 | muda · riposte/contra-ataque |
| `world.riposte.knockbackV` | Knockback vertical do contra-golpe | m/s | 0 | 15 | 0.1 | 6.6 | src/sim/controller/ctrl-moves.js:133 | muda · riposte/contra-ataque |
| `world.riposte.strikeRange` | Alcance do contra-golpe | m | 0.3 | 12 | 0.1 | 3.8 | src/sim/controller/ctrl-moves.js:135 | muda · riposte/contra-ataque |
| `world.riposte.strikePl` | Power Level do contra-golpe | inteiro | 1 | 8 | 1 | 4 | src/sim/controller/ctrl-moves.js:132 | pendente (move) |
| `world.riposte.minStrikeDuration` | Duração mínima do contra-golpe | s | 0.05 | 2 | 0.01 | 0.1 | src/sim/controller/ctrl-moves.js:130 | muda · riposte/contra-ataque |
| `world.riposte.hitstopMult` | Pausa de impacto do contra-golpe (×) | número | 0 | 16 | 0.1 | 2.5 | src/sim/game.js:118 | muda · riposte/contra-ataque |
| `world.riposte.shakeMult` | Tremor de tela do contra-golpe (×) | número | 0 | 16 | 0.1 | 2.4 | src/view/vfx.js:215 | pendente (move) |
| `world.riposte.blastOn` | Explosão visual do contra-golpe | número | 0 | 1 | 1 | 1 | src/view/riposte-fx.js:53 | visual/depuração |
| `world.riposte.blastSize` | Tamanho da explosão visual | número | 0.3 | 10 | 0.1 | 1.5 | src/view/riposte-fx.js:55 | visual/depuração |
| `world.riposte.fxOn` | Efeito visual: ligado | liga/desliga | 0 | 1 | 1 | 1 | src/view/riposte-fx.js:23 | visual/depuração |
| `world.riposte.fxIntensity` | Efeito visual: intensidade | número | 0 | 6 | 0.05 | 1 | src/view/riposte-fx.js:23 | visual/depuração |
| `world.riposte.fxSize` | Efeito visual: tamanho | número | 0.3 | 6 | 0.05 | 1 | src/view/riposte-fx.js:23 | visual/depuração |

## Moves · Sand Wave

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.sandWave.cost` | Custo de stamina | número | 0 | 10 | 0.05 | 2 | src/sim/moves.js:88 | muda · sand-wave/perto |
| `world.sandWave.cooldown` | Cooldown | s | 0 | 120 | 0.5 | 10 | src/sim/moves.js:88 | pendente (move) |
| `world.sandWave.cast` | Preparação | s | 0.05 | 4 | 0.01 | 0.25 | src/sim/moves.js:85 | muda · sand-wave/perto |
| `world.sandWave.length` | Alcance frontal (ALTURA na vista superior) | m | 0.5 | 60 | 0.25 | 10 | src/sim/moves/sand-wave/sand-wave.js:28 | muda · sand-wave/perto |
| `world.sandWave.width` | Largura | m | 0.5 | 40 | 0.25 | 3 | src/sim/moves/sand-wave/sand-wave.js:31 | muda · sand-wave/correndo |
| `world.sandWave.active` | Janela de acerto (hitbox) | s | 0.1 | 6 | 0.05 | 0.75 | src/sim/moves/sand-wave/sand-wave.js:24 | muda · sand-wave/perto |
| `world.sandWave.speedFromReach` | Velocidade sincronizada com alcance | liga/desliga | 0 | 1 | 1 | 0 | src/sim/moves/sand-wave/sand-wave.js:26 | muda · sand-wave/perto |
| `world.sandWave.waveSpeed` | Velocidade de avanço da onda | m/s | 0.25 | 80 | 0.05 | 13.3333 | src/sim/moves/sand-wave/sand-wave.js:29 | muda · sand-wave/perto |
| `world.sandWave.waveAccel` | Aceleração da frente da onda | m/s² | 0 | 80 | 0.5 | 0 | src/sim/moves/sand-wave/sand-wave.js:25 | muda · sand-wave/perto |
| `world.sandWave.dissipate` | Dissipação visual | s | 0 | 6 | 0.05 | 0.75 | src/sim/moves/sand-wave/sand-wave.js:31 | muda · sand-wave/perto |
| `world.sandWave.damage` | Dano fixo | número | 0 | 80 | 0.5 | 6 | src/sim/sand.js:145 | muda · sand-wave/perto |
| `world.sandWave.knockbackH` | Knockback horizontal (golpe inicial) | m/s | 0 | 15 | 0.1 | 0 | src/sim/sand.js:145 | muda · sand-wave/perto |
| `world.sandWave.knockbackV` | Knockback vertical (golpe inicial) | m/s | 0 | 15 | 0.1 | 0 | src/sim/sand.js:145 | muda · sand-wave/perto |
| `world.sandWave.accel` | Empurrão contínuo (aceleração) | m/s² | 0 | 80 | 0.5 | 12 | src/sim/sand.js:187 | muda · sand-wave/perto |
| `world.sandWave.pushSpeed` | Impulso inicial do empurrão | m/s | 0 | 40 | 0.5 | 13.3333 | src/sim/sand.js:155 | muda · sand-wave/perto |
| `world.sandWave.pushDuration` | Limite de tempo do empurrão | s | 0 | 6 | 0.05 | 0 | src/sim/moves/sand-wave/sand-push.js:61 | pendente (move) |
| `world.sandWave.pushDurationMode` | Duração do empurrão | inteiro | 0 | 3 | 1 | 0 | src/sim/moves/sand-wave/sand-push.js:46 | muda · sand-wave/perto |
| `world.sandWave.pushContinueAfterActive` | Modo legado: continua depois da janela de dano | liga/desliga | 0 | 1 | 1 | 0 | src/sim/moves/sand-wave/sand-push.js:66 | pendente (move) |
| `world.sandWave.pushContinuesOutsideArea` | Empurrão continua fora do retângulo (experimental) | liga/desliga | 0 | 1 | 1 | 0 | src/sim/moves/sand-wave/sand-push.js:113 | pendente (move) |
| `world.sandWave.pushReleaseDelay` | Tolerância ao perder contato | s | 0 | 1 | 0.05 | 0 | src/sim/moves/sand-wave/sand-push.js:109 | pendente (move) |
| `world.sandWave.pushContinuesDuringStagger` | Empurrão continua durante stagger/recuperação | liga/desliga | 0 | 1 | 1 | 1 | src/sim/moves/sand-wave/sand-push.js:116 | muda · sand-wave/defesa |
| `world.sandWave.pushPreserveVelocity` | Velocidade própria preservada no contato | % | 0 | 1 | 0.05 | 0 | src/sim/sand.js:152 | pendente (move) |
| `world.sandWave.pushMaxSpeed` | Velocidade máxima do empurrão | m/s | 0 | 80 | 0.5 | 13.3333 | src/sim/moves/sand-wave/sand-wave.js:36 | pendente (move) |
| `world.sandWave.pushAccelerationMode` | Modo de aceleração do empurrão | inteiro | 0 | 2 | 1 | 0 | src/sim/moves/sand-wave/sand-push.js:50 | muda · sand-wave/perto |
| `world.sandWave.pushCurvePower` | Expoente da curva de aceleração | número | 0.25 | 4 | 0.05 | 1 | src/sim/moves/sand-wave/sand-push.js:139 | muda · sand-wave/perto |
| `world.sandWave.pushTargetSpeed` | Velocidade-alvo do empurrão | m/s | 0 | 80 | 0.5 | 0 | src/sim/moves/sand-wave/sand-push.js:143 | pendente (move) |
| `world.sandWave.pushRampTime` | Constante de tempo da velocidade-alvo | s | 0.01 | 2 | 0.01 | 0.2 | src/sim/moves/sand-wave/sand-push.js:144 | pendente (move) |
| `world.sandWave.pushClearsLocomotion` | Zerar movimento próprio no primeiro contato | liga/desliga | 0 | 1 | 1 | 1 | src/sim/sand.js:152 | pendente (move) |
| `world.sandWave.pushCancelsDodge` | Empurrão bloqueia nova esquiva | liga/desliga | 0 | 1 | 1 | 1 | src/sim/sand.js:179 | pendente (move) |
| `world.sandWave.pushCancelsExistingDodge` | Empurrão interrompe esquiva em andamento | liga/desliga | 0 | 1 | 1 | 1 | src/sim/sand.js:179 | pendente (move) |
| `world.sandWave.partialFactor` | Fator do empurrão na defesa parcial | número | 0 | 2 | 0.05 | 0.5 | src/sim/sand.js:155 | muda · sand-wave/defesa |
| `world.sandWave.blind` | Duração da cegueira | s | 0 | 30 | 0.25 | 4 | src/sim/sand.js:161 | muda · sand-wave/perto |
| `world.sandWave.blindOnPartial` | Cegar também na defesa parcial | liga/desliga | 0 | 1 | 1 | 1 | src/sim/sand.js:161 | muda · sand-wave/defesa |
| `world.sandWave.wallStagger` | Stagger contra a parede | s | 0 | 4 | 0.05 | 0.3 | src/sim/sand.js:222 | pendente (move) |
| `world.sandWave.wallStaggerOn` | Ativar stagger ao ser prensado contra parede | liga/desliga | 0 | 1 | 1 | 1 | src/sim/sand.js:221 | pendente (move) |
| `world.sandWave.visionRadius` | Raio de visão do cegado | m | 2 | 60 | 0.5 | 10 | src/sim/vision.js:13 | muda · sand-wave/contra-ataque |
| `world.sandWave.fogDarkness` | Escurecimento do fog (só a câmera do cegado) | % | 0 | 2 | 0.05 | 0.6 | src/view/view.js:420 | pendente (move) |
| `world.sandWave.cell` | Resolução do caminho livre (técnico) | m | 0.1 | 2 | 0.05 | 0.25 | src/sim/sand.js:48 | pendente (move) |
| `world.sandWave.detour` | Margem de desvio (técnico) | m | 0 | 20 | 0.5 | 3 | src/sim/sand.js:48 | pendente (move) |
| `world.sandWave.replanSteps` | Recalcular obstáculos a cada (passos) | inteiro | 1 | 120 | 1 | 6 | src/sim/sand.js:106 | pendente (move) |
| `world.sandWave.waveHeight` | Altura mecânica da barragem | m | 0.1 | 6 | 0.05 | 0.35 | src/sim/moves/sand-wave/sand-wave.js:33 | pendente (move) |
| `world.sandWave.wallPressMinSpeed` | Velocidade mínima para pressão na parede (técnico) | m/s | 0.1 | 10 | 0.1 | 0.6 | src/sim/sand.js:108 | pendente (move) |
| `world.sandWave.wallPressMoveRatio` | Limiar de frenagem contra parede (técnico) | % | 0.05 | 1.8 | 0.05 | 0.25 | src/sim/sand.js:108 | muda · sand-wave/perto |
| `world.sandWave.wallPressStopRatio` | Fração da intenção que conta como parada na parede | % | 0 | 2 | 0.05 | 0.3 | src/sim/sand.js:220 | muda · sand-wave/perto |
| `world.sandWave.wallUnpinDistance` | Distância para soltar da parede | m | 0 | 1 | 0.005 | 0.01 | src/sim/sand.js:168 | pendente (move) |
| `world.sandWave.waveBottomTolerance` | Tolerância da base da onda (técnico) | m | 0 | 2 | 0.01 | 0.2 | src/sim/sand.js:121 | pendente (move) |
| `world.sandWave.hitsAirborne` | Acertar alvos em voo baixo | liga/desliga | 0 | 1 | 1 | 0 | src/sim/sand.js:119 | pendente (move) |
| `world.sandWave.maxTargets` | Máximo de alvos por execução | inteiro | 1 | 32 | 1 | 16 | src/sim/sand.js:109 | pendente (move) |
| `world.sandWave.hitShakeOn` | Tremor de câmera ao acertar | liga/desliga | 0 | 1 | 1 | 0 | src/view/vfx.js:54 | visual/depuração |
| `world.sandWave.hitShakeAmount` | Tremor ao acertar: intensidade | × | 0 | 12 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |
| `world.sandWave.hitShakeDuration` | Tremor ao acertar: duração | × | 0.1 | 10 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |

## Moves · Second Wind

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.secondWind.cost` | Custo de stamina | número | 0 | 10 | 0.05 | 0.8 | src/sim/moves.js:88 | muda · second-wind/perto |
| `world.secondWind.cooldown` | Cooldown | s | 0 | 120 | 0.5 | 12 | src/sim/moves.js:88 | pendente (move) |
| `world.secondWind.cast` | Duração do cast | s | 0.05 | 4 | 0.01 | 0.35 | src/sim/moves.js:85 | muda · second-wind/perto |
| `world.secondWind.duration` | Duração do efeito | s | 0.5 | 40 | 0.25 | 5 | src/sim/moves/second-wind.js:20 | muda · second-wind/perto |
| `world.secondWind.regenPctPerSecond` | Regeneração extra por segundo | % | 0 | 4 | 0.05 | 0.4 | src/sim/moves/second-wind.js:22 | muda · second-wind/perto |
| `world.secondWind.regenInterval` | Intervalo do pulso de regeneração | s | 0.02 | 2 | 0.02 | 0.1 | src/sim/moves/second-wind.js:18 | muda · second-wind/perto |
| `world.secondWind.mobilityCostPct` | Desconto em esquiva e sprint | % | 0 | 1.8 | 0.05 | 0.25 | src/sim/moves/second-wind.js:21 | pendente (move) |

## Moves · Seed Bomb

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.seedBomb.cost` | Custo de stamina | número | 0 | 10 | 0.05 | 1 | src/sim/moves.js:88 | muda · seed-bomb/perto |
| `world.seedBomb.cooldown` | Cooldown | s | 0 | 120 | 0.5 | 8 | src/sim/moves.js:88 | muda · seed-bomb/duelo |
| `world.seedBomb.cast` | Cast (até a semente sair) | s | 0.05 | 4 | 0.01 | 0.3 | src/sim/moves.js:85 | muda · seed-bomb/perto |
| `world.seedBomb.recovery` | Recovery | s | 0 | 2 | 0.01 | 0.2 | src/sim/moves/seed-bomb.move.json:22 | muda · seed-bomb/perto |
| `world.seedBomb.range` | Alcance do marcador (3D) | m | 2 | 128 | 0.5 | 32 | src/sim/moves/seed-bomb.js:29 | muda · seed-bomb/perto |
| `world.seedBomb.flightTime` | Tempo de voo (arco) | s | 0.2 | 3 | 0.01 | 0.65 | src/sim/moves/seed-bomb.js:37 | muda · seed-bomb/perto |
| `world.seedBomb.gravity` | Gravidade do arco | m/s² | 5 | 120 | 0.5 | 17.5 | src/sim/moves/seed-bomb.js:37 | muda · seed-bomb/perto |
| `world.seedBomb.maxSpeed` | Velocidade inicial máxima | m/s | 5 | 70 | 0.5 | 20 | src/sim/moves/seed-bomb.js:38 | muda · seed-bomb/perto |
| `world.seedBomb.seedRadius` | Raio da semente | m | 0.1 | 1.2 | 0.01 | 0.24 | src/sim/moves/seed-bomb.js:34 | muda · seed-bomb/perto |
| `world.seedBomb.lifetime` | Vida máxima da semente | s | 0.5 | 6 | 0.05 | 1.25 | src/sim/moves/seed-bomb.js:42 | muda · seed-bomb/longe |
| `world.seedBomb.explosionRadius` | Raio da explosão (esfera 3D) | m | 0.5 | 8 | 0.05 | 1.8 | src/sim/moves/seed-bomb.js:45 | muda · seed-bomb/correndo |
| `world.seedBomb.damage` | Dano da explosão (nominal) | número | 0 | 80 | 0.5 | 10 | src/sim/moves/seed-bomb.js:49 | muda · seed-bomb/perto |
| `world.seedBomb.knockbackH` | Empurrão H | m/s | 0 | 15 | 0.1 | 3 | src/sim/moves/seed-bomb.js:46 | muda · seed-bomb/perto |
| `world.seedBomb.knockbackV` | Empurrão V | m/s | 0 | 15 | 0.1 | 1 | src/sim/moves/seed-bomb.js:46 | muda · seed-bomb/perto |
| `world.seedBomb.occlusion` | Paredes bloqueiam a explosão | liga/desliga | 0 | 1 | 1 | 1 | src/sim/moves/seed-bomb.js:45 | pendente (move) |
| `world.seedBomb.blastLife` | Duração visual da explosão | s | 0.1 | 3 | 0.05 | 0.3 | src/sim/moves/seed-bomb.js:45 | visual/depuração |
| `world.seedBomb.originHeight` | Altura de lançamento (mão) | m | 0.2 | 2.6 | 0.05 | 0.8 | src/sim/moves/seed-bomb.js:33 | pendente (move) |
| `world.seedBomb.spawnForward` | Distância de nascimento | m | 0.3 | 3 | 0.05 | 0.5 | src/sim/moves/seed-bomb.js:33 | muda · seed-bomb/perto |
| `world.seedBomb.markerSpeed` | Velocidade do marcador | m/s | 1 | 60 | 0.5 | 8 | src/sim/controller/ctrl-moves.js:201 | muda · seed-bomb/duelo |
| `world.seedBomb.markerAccel` | Aceleração do marcador | m/s² | 0 | 200 | 1 | 24 | src/sim/controller/ctrl-moves.js:201 | muda · seed-bomb/duelo |
| `world.seedBomb.startDistance` | Distância inicial do marcador | m | 0.5 | 20 | 0.25 | 3 | src/sim/aim-marker.js:45 | pendente (move) |
| `world.seedBomb.minRange` | Alcance mínimo do marcador | m | 0 | 20 | 0.25 | 3 | src/sim/aim-marker.js:25 | muda · seed-bomb/perto |
| `world.seedBomb.maxRise` | Altura máxima de apoio acima dos pés | m | 0 | 12 | 0.25 | 2 | src/sim/aim-marker.js:20 | pendente (move) |
| `world.seedBomb.allowOccupied` | Permitir destino sobre um lutador | liga/desliga | 0 | 1 | 1 | 1 | src/sim/aim-marker.js:31 | muda · seed-bomb/perto |
| `world.seedBomb.counterStagger` | Counter Stagger | s | 0 | 2 | 0.01 | 0.2 | src/sim/moves/seed-bomb.js:44 | pendente (move) |
| `world.seedBomb.seedPl` | Power Level da semente | inteiro | 1 | 3 | 1 | 1 | src/sim/moves/seed-bomb.js:40 | pendente (move) |
| `world.seedBomb.hitShakeOn` | Tremor de câmera ao acertar | liga/desliga | 0 | 1 | 1 | 0 | src/view/vfx.js:54 | visual/depuração |
| `world.seedBomb.hitShakeAmount` | Tremor ao acertar: intensidade | × | 0 | 12 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |
| `world.seedBomb.hitShakeDuration` | Tremor ao acertar: duração | × | 0.1 | 10 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |

## Moves · Spikes

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.spikes.cost` | Custo de stamina | número | 0 | 10 | 0.05 | 1 | src/sim/moves.js:88 | muda · spikes/longe |
| `world.spikes.cooldown` | Cooldown | s | 0 | 120 | 0.5 | 10 | src/sim/moves.js:88 | pendente (move) |
| `world.spikes.cast` | Duração do cast | s | 0.05 | 4 | 0.01 | 0.4 | src/sim/moves.js:85 | muda · spikes/longe |
| `world.spikes.range` | Alcance de colocação (3D) | m | 1 | 30 | 0.5 | 5 | src/sim/moves/spikes.js:19 | muda · spikes/perto |
| `world.spikes.minRange` | Alcance mínimo | m | 0 | 20 | 0.25 | 0 | src/sim/aim-marker.js:25 | muda · spikes/longe |
| `world.spikes.radius` | Raio do campo | m | 0.3 | 8 | 0.05 | 1.2 | src/sim/moves/spikes.js:23 | muda · spikes/longe |
| `world.spikes.life` | Duração máxima | s | 1 | 60 | 0.5 | 8 | src/sim/moves/spikes.js:23 | muda · spikes/longe |
| `world.spikes.damage` | Dano nominal | número | 0 | 80 | 0.5 | 6 | src/sim/moves/spikes.js:24 | pendente (move) |
| `world.spikes.knockbackH` | Knockback horizontal | m/s | 0 | 15 | 0.1 | 0 | src/sim/moves/spikes.js:24 | pendente (move) |
| `world.spikes.knockbackV` | Knockback vertical | m/s | 0 | 15 | 0.1 | 0 | src/sim/moves/spikes.js:24 | pendente (move) |
| `world.spikes.armDelay` | Tempo de armação | s | 0 | 4 | 0.05 | 0.25 | src/sim/moves/spikes.js:23 | pendente (move) |
| `world.spikes.markerAccel` | Aceleração do marcador | número | 0 | 400 | 1 | 24 | src/sim/controller/ctrl-moves.js:201 | pendente (move) |
| `world.spikes.markerSpeed` | Velocidade do marcador | m/s | 1 | 60 | 0.5 | 8 | src/sim/controller/ctrl-moves.js:201 | pendente (move) |
| `world.spikes.startDistance` | Distância inicial do marcador | m | 0.5 | 20 | 0.25 | 3 | src/sim/aim-marker.js:45 | pendente (move) |
| `world.spikes.maxRise` | Altura máxima de apoio acima dos pés | m | 0 | 12 | 0.25 | 2 | src/sim/aim-marker.js:20 | pendente (move) |
| `world.spikes.trapHeight` | Altura da região ofensiva | m | 0.3 | 8 | 0.1 | 1.2 | src/sim/moves/spikes.js:23 | pendente (move) |
| `world.spikes.supportTolerance` | Tolerância de perda de apoio | m | 0.01 | 1 | 0.01 | 0.06 | src/sim/moves/spikes.js:23 | pendente (move) |
| `world.spikes.trapPl` | Power Level da armadilha | inteiro | 1 | 3 | 1 | 1 | src/sim/moves/spikes.js:24 | pendente (move) |
| `world.spikes.hitShakeOn` | Tremor de câmera ao acertar | liga/desliga | 0 | 1 | 1 | 0 | src/view/vfx.js:54 | visual/depuração |
| `world.spikes.hitShakeAmount` | Tremor ao acertar: intensidade | × | 0 | 12 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |
| `world.spikes.hitShakeDuration` | Tremor ao acertar: duração | × | 0.1 | 10 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |

## Moves · Swift

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.swift.cost` | Custo de stamina | número | 0 | 10 | 0.05 | 0.8 | src/sim/moves.js:88 | muda · swift/perto |
| `world.swift.cooldown` | Cooldown | s | 0 | 120 | 0.5 | 7 | src/sim/moves.js:88 | muda · swift/duelo |
| `world.swift.cast` | Duração da ação | s | 0.05 | 4 | 0.01 | 0.25 | src/sim/moves.js:85 | muda · swift/perto |
| `world.swift.count` | Quantidade de estrelas | inteiro | 1 | 18 | 1 | 3 | src/sim/moves/swift.js:20 | muda · swift/perto |
| `world.swift.speed` | Velocidade | m/s | 2 | 80 | 0.5 | 15 | src/sim/moves/swift.js:31 | muda · swift/perto |
| `world.swift.damage` | Dano nominal por estrela | número | 0 | 60 | 0.5 | 3 | src/sim/moves/swift.js:25 | muda · swift/perto |
| `world.swift.homingSeconds` | Duração do homing | s | 0 | 3 | 0.05 | 0.25 | src/sim/moves/swift.js:39 | muda · swift/perto |
| `world.swift.homingRate` | Correção angular do homing | ° | 0 | 1440 | 10 | 90 | src/sim/moves/swift.js:39 | muda · swift/perto |
| `world.swift.range` | Alcance máximo | m | 2 | 80 | 0.5 | 12 | src/sim/moves/swift.js:42 | muda · swift/longe |
| `world.swift.knockback` | Knockback por acerto | m/s | 0 | 15 | 0.05 | 0.3 | src/sim/moves/swift.js:43 | muda · swift/perto |
| `world.swift.knockbackV` | Knockback vertical por acerto | m/s | 0 | 15 | 0.05 | 0 | src/sim/moves/swift.js:43 | muda · swift/perto |
| `world.swift.knockbackCap` | Teto de knockback por alvo e execução | m/s | 0 | 15 | 0.05 | 0.9 | src/sim/moves/swift.js:44 | muda · swift/perto |
| `world.swift.radius` | Raio de colisão da estrela | m | 0.05 | 1 | 0.01 | 0.2 | src/sim/moves/swift.js:42 | muda · swift/perto |
| `world.swift.fanAngle` | Leque sem alvo travado | ° | 0 | 180 | 1 | 20 | src/sim/moves/swift.js:40 | pendente (move) |
| `world.swift.spawnForward` | Saída à frente do lançador | m | 0.3 | 4 | 0.05 | 0.9 | src/sim/moves/swift.js:30 | muda · swift/perto |
| `world.swift.spawnSpacing` | Espaçamento lateral na saída | m | 0 | 3 | 0.05 | 0.35 | src/sim/moves/swift.js:29 | muda · swift/perto |
| `world.swift.counterStagger` | Counter Stagger | s | 0 | 2 | 0.01 | 0.2 | src/sim/moves/swift.js:44 | pendente (move) |
| `world.swift.originHeight` | Altura base de saída das estrelas | m | 0.1 | 3.6 | 0.05 | 0.65 | src/sim/moves/swift.js:26 | muda · swift/perto |
| `world.swift.heightStep` | Alternância vertical de altura | m | 0 | 1.6 | 0.05 | 0.15 | src/sim/moves/swift.js:26 | muda · swift/perto |
| `world.swift.aimHeightMin` | Fração mínima de altura no alvo (lock-on) | número | 0 | 2 | 0.05 | 0.05 | src/sim/moves/swift.js:34 | muda · swift/perto |
| `world.swift.aimHeightMax` | Fração máxima de altura no alvo (lock-on) | número | 0.1 | 2.4 | 0.05 | 0.95 | src/sim/moves/swift.js:34 | muda · swift/perto |
| `world.swift.hitShakeOn` | Tremor de câmera ao acertar | liga/desliga | 0 | 1 | 1 | 0 | src/view/vfx.js:54 | visual/depuração |
| `world.swift.hitShakeAmount` | Tremor ao acertar: intensidade | × | 0 | 12 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |
| `world.swift.hitShakeDuration` | Tremor ao acertar: duração | × | 0.1 | 10 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |

## Moves · Water Pulse

| id | rótulo | unidade | mín | máx | passo | padrão | consumidor | A/B |
|---|---|---|---|---|---|---|---|---|
| `world.waterPulse.cost` | Custo de stamina | número | 0 | 10 | 0.05 | 1 | src/sim/moves.js:88 | muda · water-pulse/perto |
| `world.waterPulse.cooldown` | Cooldown | s | 0 | 120 | 0.5 | 9 | src/sim/moves.js:88 | muda · water-pulse/duelo |
| `world.waterPulse.maxCharge` | Carga máxima | s | 0.5 | 8 | 0.05 | 1.5 | src/sim/charge.js:28 | muda · water-pulse/perto |
| `world.waterPulse.minCharge` | Carga mínima para disparar | s | 0 | 4 | 0.05 | 0 | src/sim/charge.js:29 | muda · water-pulse/perto |
| `world.waterPulse.chargeRecovery` | Recuperação após soltar | s | 0 | 2 | 0.01 | 0.3 | src/sim/charge.js:36 | muda · water-pulse/duelo |
| `world.waterPulse.damagePl1` | Dano PL1 (nominal) | número | 0 | 80 | 0.5 | 6 | src/sim/moves/water-pulse/water-pulse.js:29 | muda · water-pulse/carga curta |
| `world.waterPulse.damagePl2` | Dano PL2 (nominal) | número | 0 | 80 | 0.5 | 9 | src/sim/moves/water-pulse/water-pulse.js:29 | muda · water-pulse/perto |
| `world.waterPulse.damagePl3` | Dano PL3 (nominal) | número | 0 | 80 | 0.5 | 12 | src/sim/moves/water-pulse/water-pulse.js:29 | pendente (move) |
| `world.waterPulse.knockbackPl1` | Empurrão H, PL1 | m/s | 0 | 15 | 0.1 | 2 | src/sim/moves/water-pulse/water-pulse.js:29 | muda · water-pulse/carga curta |
| `world.waterPulse.knockbackPl2` | Empurrão H, PL2 | m/s | 0 | 15 | 0.1 | 3 | src/sim/moves/water-pulse/water-pulse.js:29 | muda · water-pulse/perto |
| `world.waterPulse.knockbackPl3` | Empurrão H, PL3 | m/s | 0 | 15 | 0.1 | 4 | src/sim/moves/water-pulse/water-pulse.js:29 | pendente (move) |
| `world.waterPulse.knockbackV` | Empurrão V (todos os PL) | m/s | 0 | 15 | 0.1 | 0 | src/sim/moves/water-pulse/water-pulse.js:34 | muda · water-pulse/perto |
| `world.waterPulse.speed` | Velocidade do projétil | m/s | 5 | 60 | 0.5 | 14 | src/sim/moves/water-pulse/water-pulse.js:24 | muda · water-pulse/perto |
| `world.waterPulse.radius` | Raio do projétil | m | 0.1 | 1.6 | 0.01 | 0.38 | src/sim/moves/water-pulse/water-pulse.js:22 | muda · water-pulse/perto |
| `world.waterPulse.range` | Alcance | m | 3 | 40 | 0.5 | 12 | src/sim/moves/water-pulse/water-pulse.js:33 | muda · water-pulse/longe |
| `world.waterPulse.originHeight` | Altura de nascimento (mão) | m | 0.2 | 2.6 | 0.05 | 0.8 | src/sim/moves/water-pulse/water-pulse.js:21 | muda · water-pulse/perto |
| `world.waterPulse.spawnForward` | Distância de nascimento | m | 0.3 | 3 | 0.05 | 0.7 | src/sim/moves/water-pulse/water-pulse.js:21 | muda · water-pulse/perto |
| `world.waterPulse.pierce` | Corpos que a esfera atravessa | inteiro | 1 | 3 | 1 | 1 | src/sim/moves/water-pulse/water-pulse.js:33 | muda · water-pulse/perto |
| `world.waterPulse.counterStagger` | Counter Stagger | s | 0 | 2 | 0.01 | 0.2 | src/sim/moves/water-pulse/water-pulse.js:35 | pendente (move) |
| `world.waterPulse.plScaleBonus` | Crescimento da esfera por PL | % | 0 | 2 | 0.05 | 0.25 | src/sim/moves/water-pulse/water-pulse.js:31 | pendente (move) |
| `world.waterPulse.hitShakeOn` | Tremor de câmera ao acertar | liga/desliga | 0 | 1 | 1 | 0 | src/view/vfx.js:54 | visual/depuração |
| `world.waterPulse.hitShakeAmount` | Tremor ao acertar: intensidade | × | 0 | 12 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |
| `world.waterPulse.hitShakeDuration` | Tremor ao acertar: duração | × | 0.1 | 10 | 0.05 | 1 | src/view/vfx.js:54 | visual/depuração |
