# Moves elementais — protótipo (23/10/2026)

Quatro Moves novos no laboratório de combate: **Water Pulse** (Água), **Fire Spin** (Fogo), **Air Slash** (Voador) e **Seed Bomb** (Grama). Origem: prompt `PROMPT_CODEX_ARENAMON_4_MOVES_ELEMENTAIS` (22/10/2026). Os **conceitos** foram aprovados pelo responsável; os **números são os do prompt e NÃO estão homologados**. Toda decisão que o prompt deixava aberta virou um **padrão provisório** (MV-P36…P41 em `docs/moves-nao-iniciados/DECISOES_PROVISORIAS_MOVES_NOVOS.md`) com slider visível. Fichas completas: `docs/moves-nao-iniciados/fichas/{water-pulse,fire-spin,air-slash,seed-bomb}.md`.

## Como abrir e testar
1. Abra **`JOGAR_ARENAMON.html`** (versão atual na barra superior).
2. Na seleção inicial (**Seleção Rápida**), cada lutador tem 4 slots de Move: escolha os quatro nos menus (aparecem junto dos demais). Ou, em jogo, a **aba Moves** (botão Moves) → "Equipar".
3. Teclas dos slots: **A, S, 3, 4** (azul) e **H, G, N, M** (vermelho manual).
4. **Aba Moves** → seções **Water Pulse / Fire Spin / Air Slash / Seed Bomb**: todos os parâmetros com unidade, descrição e valor do prompt. Valem para os **próximos usos** (M28.4).

| Move | Como usar | Em uma frase |
|---|---|---|
| **Water Pulse** | segure para carregar (até 1,5 s), solte | esfera de água reta; PL1/PL2/PL3 pela carga; 6/9/12 HP |
| **Fire Spin** | segure: marcador (setas o movem); solte para confirmar | tornado de 1,6 m, 4 pulsos de 2 HP em 2,4 s; não prende nem empurra |
| **Air Slash** | toque | lâmina de ar em 0,067 s, reta, sem homing; 8 HP |
| **Seed Bomb** | segure: marcador; solte para confirmar | semente em arco; explode ao tocar (esfera de 1,8 m, 10 HP) |

## Decisões provisórias adotadas (todas com slider)
- **Knockback:** horizontal com vertical 0 é, no motor, um **empurrão de 1,5 × H metros** com 0,63 s de recuperação (mesmo do Lunge). Os sliders avisam a distância resultante.
- **Water Pulse:** o projétil sai **no passo da soltura**; recuperação de 0,30 s a partir dela. Alcance 12 m (vida = alcance ÷ velocidade; o prompt tinha 12 m e 1,0 s, incoerentes).
- **Air Slash:** Burst **por pressão** (o prompt dizia "na soltura"); colisor = **círculo de 0,6 m**, o desenho é a caixa do prompt; mira do alvo capturada no toque.
- **Fire Spin:** pulsos **sem guard stun** (com o valor do motor a guarda travava 83% do tempo); 1 zona por dono; paredes bloqueiam o pulso; sem Clash de área.
- **Seed Bomb:** explosão **esférica 3D**, na altitude do impacto, com oclusão; gravidade 17,5; destino que exigiria mais de 20 m/s **falha**; a semente só detona (dano único).
- **Origem dos projéteis:** altitude real do atirador + 0,8 m (o padrão do Swift usava y absoluto: disparado de uma plataforma ele morria nela).

## Ajustes da mesma rodada (23/10/2026)
- **Anti-aéreo:** Quick Attack e Bullet Punch aceitam alvos em voo até `airReach` (3 m por padrão, slider na aba Moves de cada Move). Quick Attack sobe durante a ida e desce na volta; Bullet Punch sobe junto com a corrida e golpeia na altura do alvo. O alvo em voo continua inelegível para os demais Moves de contato.
- **Combo:** acertar um golpe corpo a corpo/Tackle abre uma janela de **0,7 s** (`Regras gerais… › Janela de combo após acertar`, também na aba Bloqueio › Stamina) que permite cancelar a recuperação e encadear a próxima ação. `0` desliga. Projéteis não abrem a janela.
- **Stamina infinita:** interruptor em **Bloqueio › Stamina** (`enableInfiniteStamina`). Ligado, nenhuma ação consome stamina, o lutador nunca fica exausto e a barra fica sempre no máximo.
- **Esquiva com smear/squash visíveis:** a aba **Esquiva** agora mostra as seções *Smear de Membros (inclui a esquiva)* e *Squash & Stretch (inclui a esquiva)*, com `smearOnDodge`, `squashOnDodge` e `dodgeSquashScale`. Os sliders já existiam, mas só apareciam na aba Tackle.
- **Fire Spin e Seed Bomb com o dobro do alcance:** 10 m e 16 m por padrão (os sliders de alcance vão até 30 m). O anel da prévia usa o **raio real** (`zoneRadius` 1,6 m / `explosionRadius` 1,8 m), não mais o raio genérico de 0,6 m.
- **Water Pulse:** a esfera de água cresce na mão durante a carga (PL1→PL3) e some ao soltar/interromper.

## O que mudou no motor (retrocompatível)
`world.js`: esfera 3D, `y` herdado e oclusão na `area`; `support` (Field some sem apoio); `detonateOnly` (semente); recálculo do dano da explosão na reflexão. `charge.js`: `chargeRecovery` por grupo. `controller.js`: `captureAim` (mira capturada no toque de um Burst), `targetReachOf` (aquisição anti-aérea) e consumo da janela de combo. `combat.js` abre o combo no acerto; `physics.js` permite o contato anti-aéreo. Novos: `moves/{water-pulse,fire-spin,air-slash,seed-bomb,projectile-util}.js`, `view/elemental-fx.js`. Sem Move equipado nada muda na partida (paridade testada).

## Testes
`test/moves-water-pulse.test.mjs` (15), `moves-fire-spin.test.mjs` (14), `moves-air-slash.test.mjs` (14), `moves-seed-bomb.test.mjs` (17), `ai-elemental.test.mjs` (5) e `moves-anti-air-combo-stamina.test.mjs` (7: anti-aéreo dos dois Moves, combo ligado/desligado, stamina infinita ligada/desligada). A IA usa os quatro (regras em `sim/ai-new-moves.js`).

## Limites conhecidos (não resolvidos neste protótipo)
- Números, arte e som **sem homologação**; SFX pendente.
- Oclusão só no plano XZ (paredes/obstáculos), não em altura; o motor não tem rampas nem teto para projétil.
- Water Pulse: retenção máxima de 0,30 s e reembolso na interrupção (WP-P03/P04) não implementados: a carga trava no máximo sem limite e a recarga fica cheia.
- Falha de um Move Normal/Burst depois do custo não devolve stamina (como o Spikes); só o Charge devolve.
- Destrutíveis e a semente: só coberto por leitura de código, sem teste dedicado.
- Quarks.js não foi usado (o adaptador atual tem 2 bugs conhecidos; os efeitos usam malhas do Three.js).

## Evidências de navegador (23/10/2026)
- Teste `prototypes/combat-lab/test/moves-elementais.browser.mjs` (7 verificações: equipar, acionar pelo teclado A/S/3/4, entidades criadas, sliders na aba Moves, sem erros de console, offline). Capturas em `prototypes/combat-lab/evidence/moves-elementais/` (`water-pulse.png`, `air-slash.png`, `fire-spin-marcador.png`, `fire-spin.png`, `seed-bomb.png`).
- `moves-new.browser.mjs` atualizado para os 17 Moves novos (13 passaram, 0 falharam).
- Bateria unitária: tudo passa, exceto `combat-windows.test.mjs`, que falha também sem estas mudanças (falta o GLB oficial no ambiente da nuvem).
