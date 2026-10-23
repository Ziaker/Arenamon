# Ledge Grab & Mantle — decisões propostas e implementação (v1.19.0)

Fonte: issue [#95](https://github.com/Ziaker/Arenamon/issues/95) (ideia **não aprovada** até este documento). A implementação foi pedida pelo responsável em 22/10/2026; como a issue deixava as decisões em aberto, **cada decisão abaixo foi proposta com um padrão PROVISÓRIO e vira controle na interface** — nada está homologado, tudo se troca nos sliders (`ledge.*`, em **Ações › Salto › 🧗 Ledge Grab** e em **Ajustes › Mapa**). `ledge.mode = 0` desliga o recurso inteiro.

## 1. Faixa de montagem de 2,2 m (resíduo conhecido, resolvido antes do Ledge Grab)
- **Defeito medido:** com o salto novo, o corpo atravessava a lateral de caixas e plataformas e depois era **ejetado de lado (até 0,41 m)**: 35 ocorrências em 120 partidas aleatórias. Causa: `risesOver` deixava o salto «passar por cima» da lateral **por previsão** (`vy²/35 ≥ altura`); quando o botão era solto cedo ou a previsão errava, o corpo estava dentro do sólido e a colisão o empurrava para fora.
- **Decisão (provisória):** a lateral **bloqueia** o salto até os pés chegarem à faixa de montagem (`map.mountTolerance`); o corpo fica encostado na face e desliza para cima. **Controle: `map.jumpPassOver`** (0 = estrito, padrão; 1 = comportamento anterior).
- **Medido nas duas regras:** ejeções 35 → **0**; montar em caixas de 1 m, 1,5 m e 2,2 m (salto segurado ou só toque): **resultados idênticos**.
- Teste: `test/ledge.test.mjs` (fuzz de ejeções com as duas regras).

## 2. Decisões que a issue deixou em aberto

| # | Pergunta da issue | Opções avaliadas | **Padrão adotado (provisório)** | Controle |
|---|---|---|---|---|
| D1 | Ativação automática ou por botão? | A) automática ao encostar · B) automática segurando a direção da parede · C) botão (Espaço no ar) | **B**: saltar/cair contra a face **segurando a direção dela** (não agarra por acidente) | `ledge.mode` (0 desligado · 1 B · 2 C) |
| D2 | Volume de detecção, altura alcançável | — | alcance horizontal **0,35 m**; borda entre **0,6 e 1,25 m acima dos pés**; só descendo ou perto do ápice (≤ 1,5 m/s subindo); a pose pendurada precisa ficar ≥ 0,2 m acima do chão (plataformas muito baixas só se monta) | `reach`, `reachUp`, `minUp`, `maxRiseSpeed`, `minHangHeight` |
| D3 | Quais superfícies | plataformas · + caixas e destrutíveis · + pilares · + borda da arena | **plataformas, obstáculos em caixa e destrutíveis sólidos**; pilares redondos e a parede da arena **não** (sem borda plana); destrutível destruído = solta | `ledge.objects` (0 = só plataformas) |
| D4 | Velocidade horizontal e a regra «sem correção aérea» | — | o agarre **zera** a velocidade (é um estado novo, não correção de salto); o corpo é conduzido (encaixe de 0,1 s) até a pose pendurada | `snapTime` |
| D5 | Duração, custo, controles | — | pendurado até **4 s** (depois solta); **0,3 de stamina/s**; agarrar custa 0; **subir: Espaço**; **soltar: D, C ou segurar para longe da parede por 0,2 s**; 0,15 s de espera antes de aceitar comando | `maxHang`, `hangDrain`, `grabCost`, `minHang`, `climbInput` (Espaço / direção / os dois), `dropInput`, `dropHold` |
| D6 | Subida (mantle) | — | 0,45 s: sobe ao nível da borda e depois avança para o topo (centro a 0,6 m da borda); **bloqueada** se houver outro lutador no ponto, fora da arena ou sem apoio — fica pendurado (evento `ledgeBlocked`) | `climbTime`, `climbInset` |
| D7 | Estado defensivo | invulnerável · vulnerável | **vulnerável**: qualquer dano, empurrão, lançamento ou guard stun **derruba** (cai como queda de borda, com coyote); i-frames opcionais na subida | `hurtDrops` (1), `climbInvuln` (0 s) |
| D8 | Moves e X/C pendurado | — | nenhum Move nem X; C e D soltam; o HUD mostra «pendurado na borda» | — |
| D9 | Depois de soltar | — | queda de borda com empurrão de 1,2 m/s para longe da parede e **coyote time** (dá para pular logo depois); 0,5 s sem agarrar de novo | `dropPush`, `cooldown` |
| D10 | IA | A IA agarra? sobe? | agarra pelas mesmas regras (mesmo comando de direção); **sobe sozinha depois de 0,35 s**; com 0 nunca sobe e cai pelo tempo máximo | `aiClimb` |
| D11 | Feedback visual de borda válida/inválida | — | faixa **verde** sobre a borda quando está ao alcance (válida); borda inválida simplesmente não aparece; ao agarrar, o impacto vertical dos VFX escala com o sólido | `ledge.hint` |
| D12 | Animação | — | estados `ledge_hang` e `ledge_climb`; sem clipe próprio caem para `wall_splat`/`fall` e `jump`/`vault` | clipes no mapa de ações |
| D13 | Alternativas A/B/C | — | o `mode` e os `*Input` já permitem comparar A/B/C jogando, sem trocar de build | — |

## 3. Como funciona (código)
- `sim/ledge.js`: `findLedge` (geometria), `ledgeUpdate` (agarrar, encaixe → pendurado → subida, soltar). `f.ledge = {phase, t, surf, n, top, hangPos, hangY, topPos, …}`.
- O controlador chama `ledgeUpdate` antes do ramo de voo e retorna se o corpo está sob controle do agarre; a física pula o lutador (sem gravidade); `movePermission`/`chargePermission` negam com o motivo `ledge`.
- Saídas: soltar, subir, golpe, perda do apoio, stamina zerada, tempo máximo; lançamento externo apaga o estado.
- `game.js`: a IA pendurada recebe «Espaço + direção da parede» depois de `aiClimb` s.
- Determinismo: tudo na simulação (120 Hz), sem aleatoriedade; teste de repetição.

## 4. Testes e verificação
- `test/ledge.test.mjs` (17): agarre automático e por botão, sem direção não agarra, subir, soltar por D/C/direção, tempo máximo e stamina, golpe derruba (e `hurtDrops` 0), subida bloqueada por outro lutador, apoio destruído, plataformas × caixas, Moves negados + IA sobe, i-frames e custo, determinismo, **fuzz de partidas aleatórias** (sem NaN, sem ficar pendurado além do limite) e a faixa de montagem.
- `test/ledge.browser.mjs` e capturas em `prototypes/combat-lab/evidence/ledge-grab/` (ver `README.md` da pasta).

## 5. Limites e pendências
- **Nada aprovado**: os padrões são propostas; a issue #95 continua como registro até o responsável decidir.
- Sem clipes de animação próprios (usa fallback); sem plataformas móveis (não existem no jogo).
- Pilares redondos e a parede da arena não têm borda agarrável; caixas com `angle` ≠ 0 não existem hoje (a colisão também as trata como alinhadas aos eixos).
- Não há teste de gamepad (fora de escopo do mapa).
