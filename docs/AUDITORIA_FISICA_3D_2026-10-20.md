# Auditoria da Infraestrutura Física 3D — 20/10/2026

Relatório técnico da auditoria sistêmica do Laboratório de Combate (`prototypes/combat-lab`), conduzida sob a
ordem de auditoria externa (preservada em `archives/auditoria-externa-2026-10-20.txt`). Regra metodológica
obedecida: **reproduzir antes de corrigir** — todo defeito listado foi confirmado por teste ou inspeção direta, e
toda correção é acompanhada de teste de regressão. Nenhuma funcionalidade foi declarada aprovada só porque o
código compila ou porque uma função com nome correspondente existe.

---

## A. Identificação

- **Repositório:** https://github.com/Ziaker/Arenamon (privado)
- **Branch:** `feat/camera-cinematica-zzz`
- **Commit inicial da tarefa:** `add16b7` (estado do checkout ao iniciar)
- **Commits finais:** `57c3e64` (tranche 1: infraestrutura fundamental), `43688b6` (tranche 2: teto com corpo
  inteiro), `189414f` (tranche 3: interrupções simultâneas + prioridade de derrota), `ddea42e` (tranche 4:
  projéteis × geometria), `c44d168` (tranche 5: save/load 3D), `7eed8c5`/`727e7d6` (tranche 6: relatório +
  conformidade), `99af60d` (verify.mjs: popup de Ferramentas), `ead7c3a` (tranche 7: §63 laboratório de
  cenários + fix ε do pouso), `bf190f0` (tranche 8: §64 diagnóstico físico ao vivo)
- **Ambiente:** Windows, Node v24.21.0, repositório local em `C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon`
  (pasta oficial única; sem worktrees externos)
- **Estado do checkout:** limpo ao iniciar (`git status` vazio na branch acima)
- **Diferenças em relação à origem:** os 6 commits listados, enviados e verificados
  (`git rev-parse HEAD` = `git rev-parse origin/feat/camera-cinematica-zzz` após cada push)
- **Conformidade §1/§2 (verificação e documentação obrigatória):** checkout confirmado limpo na branch de
  trabalho antes de editar; `AGENTS.md` e `docs/GUIA_COLABORACAO_AGENTES.md` lidos — **nenhum conflito de
  instruções identificado** (branch de trabalho respeitada, sem `main`, sem force push, sem `git add -f`,
  sem stashes tocados, área combat-lab permitida). Documentos de decisões do mapa e de Moves consultados
  pontualmente via referências cruzadas no código (R1.x–R11.x) — leitura integral de cada documento da
  lista do §2 **não** é reivindicada; declarada como limitação.

## B. Auditoria

**Arquivos examinados:** `src/sim/combat.js`, `src/sim/physics.js`, `src/sim/map.js`, `src/sim/config.js`,
`src/sim/controller.js`, `src/sim/world.js`, `src/sim/scenarios-map.js`, `src/view/characters.js`,
`src/sim/moves/psyshock.js`, `test/*` (suítes existentes).

**Sistemas examinados:** lançamento/knockback, salto/voo/queda/pouso, teto (faces inferiores), superfícies de
apoio (plataformas/obstáculos/destrutíveis), arena circular e wall-splat, colisão lateral, máquina de estados,
interrupções simultâneas, projéteis × geometria, itens/consumíveis, save/load/replay, mixer de animação.

**Mapeamento real de estados (§20 — a representação verdadeira, não os nomes assumidos):**

| Estado da lista do §20 | Representação real no motor |
|---|---|
| Neutral | `fighter.state === 'neutral'` |
| Moving / Sprint / Brake | `state 'move'` / flag `sprinting` / `state 'brake'` + `brakeLeft` |
| Dodge / Vault | ação em `fighter.action` (dodge; `vault` é resposta defensiva com `vaultHeight` físico) — **não** são `fighter.state` |
| Tackle / Tackle Charge / Move / Charge | ação `action.kind === 'tackle'` / `state 'tackleCharge'` + `tackleCharge` / Move de carga é `charge`+`fx` em `moveFx` |
| Guard / Guard Stun | flag `fighter.guard` + `guardSuppressed` / `stun > 0` |
| Hit Stun / Recovery | `knockRecovery > 0` (+ `recoveryFrom`) |
| Pushed | campo `fighter.push` |
| Airborne / Falling | `fighter.flight` (balístico; `isEdgeFall` marca queda por borda) |
| Landing | `state 'landing'` |
| Wall Splat | `state 'wallSplat'` + `fighter.wallSplat` |
| Meteor Slam | ação `action.slam` com fases (`slamPrepDone`, `slamLanded`) |
| Defeated | `state 'defeated'` (agora com prioridade sobre recuperação — B10) |
| Status temporários / passivas | `fighter.statuses`, estágios `fighter.stages`, escudo `fighter.shield` |

Conclusão do §20/§21: o motor **já separa** condição física (`flight`/`vaultHeight`/`groundY`), ação
(`action`), defesa (`guard`), status (`statuses`/`stages`/`shield`) e recuperação (`knockRecovery`) — eles
coexistem sem se sobrescrever; nenhuma refatoração de máquina de estados foi necessária. As correções B1/B10
reforçaram dois pontos onde essa separação vazava (altitude física perdida no launch; derrota pendurada em
recuperação).

**Defeitos confirmados e corrigidos (todos reproduzidos antes da correção):**

| # | Defeito | Reprodução | Causa raiz |
|---|---------|-----------|------------|
| B1 | `launch()` descartava a altitude do alvo | vault em curso (2,2 m) → `flight.y` caía para `groundY` | `flight.y = f.groundY` ignorava `vaultHeight` e voo em curso |
| B2 | Lutador subindo pela lateral "teleportava" para o topo | pouso era permitido com `vy > 0` | Pouso exigia apenas `y ≤ topo + 0,35 m`, sem checar direção do voo |
| B3 | Face inferior de plataformas era atravessada | salto sob plataforma de 1,9 m | Ausência total de colisão com face inferior |
| B4 | Arena circular (raio 50) limitada pelo half-size legado 16 | posição (60, 0) era clampada | Sentinel `!== 16` usado como cap escondido |
| B5 | Wall-splat sem autor atribuía o dano ao índice oposto | `lastAttacker = null` → dano creditado a `1 - f.id` | Fallback inventado |
| B6 | Cada entrada de estado clonava o clipe de animação | cache do mixer crescia sem limite | `clip.clone()` em `enter()` |
| B7 | Cenário de mapa codificava B2 como esperado | `map-combat-launch-platform` só passava pelo "cola no topo" | Ponto de partida colado na face lateral |
| B8 | Teto clampava os PÉS na face — o corpo penetrava no sólido; a travessia era testada pelos pés | salto sob obstáculo elevado: corpo atravessava antes de parar | Travessia testada em `flight.y` (pés) em vez de pés+bodyHeight (cabeça) |
| B9 | Contato de teto era tratado como penetração → empurrão lateral | lutador parado sob obstáculo elevado era empurrado ao encostar a cabeça | `collideMapFighter` sem distinção contato×penetração |
| B10 | Derrotado ficava pendurado em knockRecovery/landing | `hp=0` com `knockRecovery>0` oscillava 'landing' | Checagem de derrota depois da recuperação no controlador |
| B11 | Superfície na altura exata do pico do salto nunca era apoio | salto de 2,0 m sobre obstáculo de 2,0 m: atravessava a faixa do topo em queda livre e era empurrado lateralmente | Integrador Euler discreto pica ~8,4e-5 m **abaixo** da altura analítica (pico discreto 1,999916 m); tolerância `prevY ≥ alvo − 1e-6` exigia cruzamento que nunca ocorria |

**Defeitos suspeitos (não confirmados / pendentes):** tunelamento de projéteis rápidos em geometria fina do
mapa (substeps de contato existem para entidades; geometria do mapa é checada 1×/passo); empilhamento de
plataformas com folga menor que a altura do corpo (cenário degenerado, sem conteúdo aprovado que o use).

**Deficiências estruturais (declaradas, não corrigidas por depender de decisão):** ausência de faces
inclinadas (rampas/escadas) na geometria de colisão — a engine só suporta caixas/cilindros alinhados a eixos;
sistema VFX legado duplicado (`useNewVfx`) aguardando decisão de migração.

**Lacunas de implementação:** rampas (§11), escadas reais (§12), escadas diagonais/rotacionadas (§13) —
não implementadas, exigem decisão de design.

**Lacunas de teste antes da tarefa:** teto, apoio sobre obstáculos/destrutíveis, bloqueio de projéteis pela
geometria do mapa, interrupções simultâneas, save/load em altitude. Todas receberam testes novos (seção D).

**Conflitos documentais:** nenhum novo; o cenário B7 foi o único teste cujo "esperado" conflitava com a
física corrigida (reescrito com o mesmo objetivo, sem afrouxar o propósito).

**Decisões pendentes:** rampas/escadas (design), migração VFX, `prototypes/game` legado (P1, fora do escopo).

## C. Implementação

1. **`src/sim/combat.js` — `launch()`:** altitude inicial `f.flight ? f.flight.y : (f.groundY ?? 0) + (f.vaultHeight ?? 0)` — continuidade em vaults, juggles e relançamentos (B1).
2. **`src/sim/physics.js` — pouso:** só na descida e cruzando vindo de cima (`vy ≤ 0 && y ≤ alvo && prevY ≥ alvo − ε`); a subida nunca pousa (B2). ε absorve contato exato sem reabrir o teleporte.
3. **`src/sim/physics.js` — teto com corpo inteiro (B3/B8):** `getCeilingHeight(pos, world, fromY, toY)` consulta a face inferior mais baixa cruzada; a travessia é testada pela **cabeça** (`prevY + bodyHeight`, `flight.y + bodyHeight`) e os pés param a `bodyHeight` abaixo da face (nunca abaixo do piso). `lastCeilingBump` registra pés e face.
4. **`src/sim/physics.js` — arena circular:** `LEGACY_SQUARE_HALF = 16` nomeado; `C.test.circleCap` para cap técnico explícito (B4).
5. **`src/sim/physics.js` — wall-splat:** autoria real (`lastAttacker` numérico ou `null`), dano pelo pipeline central (B5).
6. **`src/sim/physics.js` — derrota:** lutador derrotado em voo aterrissa `defeated` sem recuperação de pouso (B10, parte física).
7. **`src/sim/controller.js` — derrota tem prioridade sobre knockRecovery** (B10, parte de controle).
8. **`src/sim/map.js` — contato de teto sem empurrão (B9):** obstáculos/destrutíveis ignoram o lutador cuja cabeça está exatamente na face inferior sem subida.
9. **`src/sim/config.js`:** `test.circleCap` documentado.
10. **`src/view/characters.js` — mixer:** sem `clip.clone()`; guard de continuidade generalizado; cache estável (B6).
11. **`src/sim/scenarios-map.js`:** `map-combat-launch-platform` reescrito para lançar de fora da plataforma (B7).
12. **`src/sim/physics.js` — tolerância de pouso (B11):** ε de `prevY ≥ alvo − ε` ampliado de 1e-6 para
    **1 mm** — absorve o erro de discretização do pico (~8,4e-5 m) sem permitir pouso vindo de baixo (quem
    sobe tem `vy > 0`; quem desliza pela lateral já está descendo). Reproduzido em árvore limpa.
13. **`src/sim/scenarios-map.js` — laboratório §63:** 9 cenários técnicos novos (`map-lab-*`: piso plano
    isolado, bloco sólido, duas plataformas oficiais, plataformas adjacentes/separadas, teto acessível,
    corredor estreito, lançamento contra teto, eventos simultâneos) — cobrem os itens 1, 2, 3, 11, 12, 13,
    16, 19 e 25 da lista de 25 do §63 (itens 6–10, rampas/escadas, excluídos por decisão do responsável).
14. **`src/main.js` + `src/sim/physics.js` — diagnóstico §64:** painel "Dados ao vivo" expõe por lutador
    superfície de apoio (`groundY`), altitude, velocidades horizontal/vertical, gravidade e impulso em efeito,
    último contato válido (pouso com velocidades e teto com a face) e subpassos/contatos do último passo
    (`physicsProbe`, leitura externa que não entra no estado nem no replay).

**Compatibilidade:** nenhuma regra de combate foi alterada (proibido pela ordem); todas as mudanças são
invariantes físicos. Funcionalidade preservada: toda a regressão antiga passa sem afrouxamento de asserção
(única exceção documentada: B7, reescrito).

## D. Testes

Suítes novas (comando: `node prototypes/combat-lab/test/physics3d.test.mjs` e
`node prototypes/combat-lab/test/interruptions.test.mjs`):

| Cenário | Requisito | Condição inicial | Esperado | Resultado |
|---|---|---|---|---|
| launch preserva altitude em vault / juggle / plataforma | §26/B1 | vault 2,2 m / voo 3,4 m / topo 1,5 m | `flight.y` contínuo | ✅ passou |
| launch de plataforma cruza borda e aterra no solo | §18/§26 | topo 1,5 m, arco longo | pouso no solo além da borda | ✅ passou |
| subida lateral: voo nunca termina subindo | §22/B2 | salto corrido contra lateral de 1 m | pouso só na descida; desfecho físico (montar/cair) | ✅ passou |
| salto reto sob plataforma 1,9 m: cabeça na face, volta ao piso | §19/B8 | sob o centro da plataforma | bonk a `1,9−bodyHeight`; pouso no próprio piso | ✅ passou |
| teto só conta faces cruzadas na área XZ | §19 | sondas `getCeilingHeight` | faixa/área respeitadas | ✅ passou |
| salto sobre plataforma: pouso único no topo | §18 | arco terminando no topo | exatamente 1 aterrissagem | ✅ passou |
| arena circular raio 50 sem sentinel; `circleCap` explícito | §32/B4 | posição (60,0) | clamp no raio oficial / no cap | ✅ passou |
| wall-splat sem autor: dano ambiental, sem autoria inventada | §26/B5 | `lastAttacker=null` | `attacker: null`, hp 95, rival intacto | ✅ passou |
| mixer: sem clone de clipe, cache estável sob churn | §49/B6 | 60 trocas de estado | catálogo intacto, cache ≤ nº de clipes | ✅ passou |
| obstáculo oferece apoio; topo aterrissável | §7 | salto sobre obstáculo 1,2 m | `groundY=1,2` | ✅ passou |
| obstáculo elevado: cabeça na face inferior, **sem empurrão lateral** | §19/B9 | salto reto sob obstáculo [2,3] | bonk a `2−bodyHeight`, z inalterado | ✅ passou |
| destrutível destruído perde o apoio | §30 | voo sobre destrutível sólido→destruído | apoio some | ✅ passou |
| interrupção por lançamento zera vault sem altitude fantasma | §23 | vault 1,8 m + launch | altitude absorvida 1× | ✅ passou |
| plataforma removida sob o lutador → queda balística | §9/§23 | apoiado a 1,5 m, remoção | queda da altitude real até o solo | ✅ passou |
| derrota em voo → `defeated` sem recovery | §22/§23/B10 | hp=0 no ar | estado corresponde ao fato | ✅ passou |
| cadeia lançamento→wall-splat→queda→pouso | §22 | lançado contra borda | estados encadeados coerentes | ✅ passou |
| dois impactos no mesmo passo: escudo→HP na ordem | §23 | escudo 6, dois danos 5 | absorção parcial determinística | ✅ passou |
| coleta de item + dano no mesmo passo; derrotado não coleta | §23/R10.5 | item `heal_hp` ao alcance | ambos os efeitos; vivo coleta | ✅ passou |
| projétil bloqueado por obstáculo / plataforma / destrutível | §31 | projétil a 0,65 m em voo | `obstacleHit`/`platformHit`/`destructibleHit` | ✅ passou |
| projétil acima da plataforma passa livre | §31 | projétil a 2,5 m | sem bloqueio (sem sobreposição vertical) | ✅ passou |
| save/load em voo sobre plataforma: futuro idêntico | §57 | snapshot no meio do voo | eventos e estado reproduzidos iguais | ✅ passou |

Cenários técnicos do laboratório §63 (suíte `test/map.test.mjs`, 44/44 cenários aprovados):

| Cenário (item do §63) | Verificação principal | Resultado |
|---|---|---|
| 1. Piso plano e personagem isolado | deriva < 0,05 m, altitude 0, sem voo | ✅ passou |
| 2. Bloco sólido | contido na face (sem tunelamento) + montagem do topo (expôs B11) | ✅ passou |
| 3. Duas plataformas oficiais | apoio exato a 1,0 m e 1,5 m | ✅ passou |
| 11. Plataformas adjacentes | apoio não cai ao cruzar a junção | ✅ passou |
| 12. Plataformas separadas | voo balístico sobre o fosso, pouso na 2ª plataforma | ✅ passou |
| 13. Teto inferior acessível | pés a 0,9 m, cabeça na face de 2,2 m, sem empurrão | ✅ passou |
| 16. Corredor estreito | travessia completa sem encostar nem voar | ✅ passou |
| 19. Lançamento contra o teto | pico limitado pela face a 3,0 m, retorno ao piso | ✅ passou |
| 25. Múltiplos eventos simultâneos | quebra + drop + montagem + coleta na mesma janela | ✅ passou |

**Evidência:** saídas dos comandos acima (executados nesta tarefa); regressão completa abaixo.
**Teste de navegador:** a falha pré-existente do `verify.mjs` (`#arena-autoplay-toggle` invisível — o botão
mudou de lugar na UI para o popup de Ferramentas) foi **corrigida no teste** (`99af60d`): as **19
verificações de navegador passam** após cada tranche subsequente.

## E. Resultados

**Matriz de classificação dos cenários (§59 + Partes III–XVII):**

| Cenário | Situação |
|---|---|
| Salto normal (R2/R7) atinge ~2,0 m; conservação de impulso horizontal | ✅ já existia — regressão verde |
| Plataformas 1,0 m / 1,5 m (subida, combate elevado, queda pela borda, slam do alto) | ✅ já existia — regressão verde |
| Destrutíveis / itens / escudo (geração, coleta, dano, respawn) | ✅ regressão + testes novos (coleta+dano no mesmo passo) |
| Lançamento (C) preserva altitude (vault, juggle, plataforma) | 🔧 **corrigido + testado** (B1) |
| Interação C → X (relançamento em voo preserva altitude) | 🔧 **corrigido + testado** |
| Pouso físico sobre plataforma (lançado de fora, arco limpo) | 🔧 **corrigido + testado**; cenário de mapa reescrito (B2/B7) |
| Teto de plataformas/obstáculos/destrutíveis (face inferior, corpo inteiro, sem empurrão) | 🔧 **implementado + testado** (B3, B8, B9) |
| Obstáculos/destrutíveis como superfície de apoio; apoio some ao destruir | ✅ **verificado por teste novo** (§7/§30) |
| Projéteis × geometria do mapa (obstáculo/plataforma/destrutível, sobreposição vertical) | ✅ **verificado por teste novo** (§31) |
| Borda circular: contenção, rebote, wall-splat com autoria real | 🔧 **corrigido + testado** (B4, B5) |
| Mixer de animação estável sob churn de estados | 🔧 **corrigido + testado** (B6) |
| Mapeamento de estados real (§20) e separação física/ação/defesa/status (§21) | ✅ mapeado e documentado (seção B); nenhuma refatoração necessária |
| Interrupções simultâneas (§23: pouso+hit, remoção de apoio, dois danos, itens, derrota em voo, cadeia wall-splat) | ✅ **testado** (suíte interruptions) |
| Geometria dinâmica / corpos que aparecem (barreiras e paredes de Moves) | ✅ já existia — moves-contract/beam/reflect verdes; não re-auditado em profundidade |
| Compatibilidade Moves existentes (Reflect/Psyshock/beam/consumíveis/passivas) | ✅ regressão integral verde (moves*, charge, beam, reflect, psyshock, economy, defense) |
| IA 3D: percepção, navegação em níveis, replanejamento (§44–47) | ⚠️ suítes próprias verdes (ai, tactics, perception, spatial); validação em navegador incluída no verify.mjs (19/19) com IA tática ao vivo; matriz grupo H não expandida além disso — declarada pendência |
| Câmera em diferentes alturas (§48) | ✅ testes unitários da câmera cinematizada verdes + validação em navegador pelo verify.mjs (19/19, incluindo compatibilidade de layout) |
| Save/load e replay com estados 3D (§57) | ✅ **testado** (futuro idêntico após restore em voo sobre plataforma) |
| Passo físico fixo, colisões de alta velocidade, seeds (§54–56) | ✅ já existia — regressão verde (incl. tunelamento em moves-contract) |
| Rampas / escadas reais / escadas diagonais / desníveis inclinados (§11–14) | ❌ **não implementado** — geometria atual só tem caixas/cilindros a eixos; **excluídos por decisão expressa do responsável** ("não terá rampas nem escadas por ora") |
| Laboratório de física jogável com diagnósticos (§63–64) | ✅ **feito** — 9 cenários técnicos novos na lista de cenários (itens 1–25, exceto 6–10 excluídos) + painel "Dados ao vivo" com diagnóstico físico completo e `physicsProbe` |
| Desempenho físico / separação sim-render / execução offline (§65–67) | ✅ **medido e registrado** — seção G abaixo |
| Gamepad / balanceamento | ⛔ proibido pela ordem |

- **Testes unitários:** `npm run test:combat-lab:unit` — **todas as suítes aprovadas** (34 arquivos: simulação,
  regras, locomoção, animação, VFX, 44 cenários de mapa, IA tática, física 3D, interrupções etc.).
- **Testes de integração:** as suítes novas (physics3d, interruptions) + 9 cenários de laboratório cobrem as
  interações críticas P0.
- **Testes de propriedades:** propriedades auditadas como invariantes dedicados (pouso só na descida,
  continuidade por passo, cache do mixer limitado, futuro reproduzido igual após restore).
- **Testes de navegador:** `verify.mjs` — **19/19 verificações aprovadas** (correção da causa pré-existente em
  `99af60d`); `perf.browser.mjs` — **26/26 verificações aprovadas** (seção G).
- **Replay/seeds:** sim.test cobre replay por estado e comparação A×B; suíte nova cobre save/load em altitude.
- **Desempenho:** medido nesta tarefa (seção G).
- **Regressão do combate:** nenhuma alteração involuntária detectada (suíte antiga verde integralmente).

## G. Desempenho, separação simulação/renderização e execução offline (§65–67)

**§65 — Desempenho físico (medido nesta tarefa, hardware registrado):**

| Medição | Resultado |
|---|---|
| Custo da simulação (Node, partida IA × IA tática com plataformas/obstáculos/destrutíveis) | **4,62 µs por passo** (12 000 passos, 55,5 ms) |
| Simulação a 120 Hz | ≈ 0,55 ms de CPU por segundo de jogo — meta de 120 Hz atingida com folga de ~30× |
| Subpassos de contato (média) | 1,01 por passo; contatos avaliados: 0,03 por passo |
| Benchmark de navegador (`test/perf.browser.mjs`, 26/26) | trabalho de CPU por quadro ~2,4 ms; GPU ~0,24–0,47 ms; 12–18 draw calls; 5,5–10,3 mil triângulos |
| FPS nos casos de benchmark | 49–60 FPS (caso VFX leves: **60,03 FPS**, frame 16,66 ms = limitado pelo vsync/rAF) |
| Medidor ao vivo (canvas 1500×920, perfil Alto, Edge headless) | 27,9 FPS (frame 41 ms, P95 83 ms) — ver limitação abaixo |

**Hardware de teste registrado:** 12th Gen Intel Core i5-12450H (8P+4E, 12 threads), 8 GB RAM, GPU integrada
Intel UHD Graphics (0x46A3) via ANGLE Direct3D11, GPU timer disponível, Windows 11, Edge 155 headless
(Chromium 155), canvas de benchmark 146×728 @ pixelRatio 1.

**Declarações honestas de limitação (exigidas pelo §65):** (1) a meta **60 FPS em 1080p não foi verificada
num monitor real a 60 Hz** — as medições foram em janela de benchmark pequena e em headless; o caso de
canvas grande (1500×920) mostrou 27,9 FPS com P95 de 83 ms, atribuído ao throttling de `requestAnimationFrame`
em headless (o próprio relatório do benchmark registra essa nota), não ao custo de CPU/GPU (2,4 ms e 0,4 ms,
respectivamente, muito abaixo do orçamento de 16,6 ms); (2) o gargalo medido não está na simulação nem na
renderização da cena, mas na composição do navegador em modo headless sem GPU dedicada — **a meta não é
declarada atingida para 1080p real**, apenas a folga de CPU/GPU é demonstrada. Referência comparável:
`prototypes/combat-lab/validation/perf/report.json` (ambiente + 4 casos versionados).

**§66 — Separação simulação/renderização (evidências):** perfis gráficos Baixo/Alto produzem **estado de
luta bit a bit idêntico** (`test/perf.test.mjs`); determinismo e replay por estado verdes (`sim.test`,
gravação com estado final idêntico no `verify.mjs`); save/load reproduz futuro idêntico em altitude
(suíte physics3d); toda a suíte unitária executa em **Node sem DOM** — o estado físico é dados puros
serializáveis (comentário estrutural em `createMapState` e `structuredClone` no runner de cenários);
`physicsProbe` é contador de módulo externo ao estado, sem efeito em save/replay.

**§67 — Execução offline (evidências):** `verify.mjs` e `perf.browser.mjs` rodam com `setOffline(true)` e
falhariam diante de qualquer request http(s) — 19/19 e 26/26 aprovados; o build é um **HTML único
auto-contido** (10,7 MB, `npm run build:combat-lab`) aberto pelo usuário via `JOGAR_ARENAMON.html`, sem
terminal nem servidor; nenhuma dependência externa em tempo de execução foi adicionada.

## F. Pendências (declaradas sem omissão)

**O que não foi implementado:** rampas/escadas/escadas diagonais (§11–14) — **excluídos por decisão expressa
e atual do responsável** ("não terá rampas nem escadas por ora"); caso sejam retomados, exigem decisão de
design (a geometria atual só suporta caixas/cilindros a eixos). Gamepad (proibido); balanceamento (proibido).
**O que não foi testado:** 60 FPS em monitor real 1080p (limitação de hardware/metodologia registrada na
seção G); IA × geometria em profundidade adicional (perception/spatial/câmera têm suítes próprias verdes, mas
a matriz grupo H não foi expandida além delas); testes metamórficos formais (§61) — os invariantes dedicados
cobrem o espírito, sem a formalização.
**O que exige aprovação:** faces inclinadas (design de rampas/escadas — atualmente suspensas pelo
responsável); migração/remoção do VFX legado.
**O que depende de outro sistema:** nada bloqueado por terceiros.
**Rastreabilidade das 152 decisões (§78):** atendida por documento oficial existente e auditado nesta tarefa —
`docs/MATRIZ_RASTREAMENTO_NOVO_MAPA.md` contém as **152 decisões (R1.1–R11.9)** linha a linha com requisito
aprovado, estado (150 implementado/validado + 2 arquivadas — gamepad R7.3/R9.14), localização no código,
implementação real e verificação (MAP-T01–T24); conferida a completude (152 IDs únicos) e a consistência do
sumário. As evidências novas desta auditoria (physics3d, interruptions, cenários `map-lab-*`, diagnóstico ao
vivo) complementam os testes apontados na matriz.
**Próximo passo tecnicamente necessário:** validar 60 FPS em monitor real 1080p (hardware com GPU dedicada
ou janela real a 1920×1080); decidir com o diretor se rampas/escadas serão retomadas; expandir a matriz
grupo H (IA) se o diretor exigir cobertura além das suítes existentes.

---

*Branch `feat/camera-cinematica-zzz` — ver `docs/MAPA_REPOSITORIO.md` e o portal `ABRIR_ARENAMON.html`.*
