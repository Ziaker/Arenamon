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
  projéteis × geometria), `c44d168` (tranche 5: save/load 3D)
- **Ambiente:** Windows, Node v24.21.0, repositório local em `C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon`
  (pasta oficial única; sem worktrees externos)
- **Estado do checkout:** limpo ao iniciar (`git status` vazio na branch acima)
- **Diferenças em relação à origem:** os 5 commits listados, enviados e verificados
  (`git rev-parse HEAD` = `git rev-parse origin/feat/camera-cinematica-zzz` após cada push)

## B. Auditoria

**Arquivos examinados:** `src/sim/combat.js`, `src/sim/physics.js`, `src/sim/map.js`, `src/sim/config.js`,
`src/sim/controller.js`, `src/sim/world.js`, `src/sim/scenarios-map.js`, `src/view/characters.js`,
`src/sim/moves/psyshock.js`, `test/*` (suítes existentes).

**Sistemas examinados:** lançamento/knockback, salto/voo/queda/pouso, teto (faces inferiores), superfícies de
apoio (plataformas/obstáculos/destrutíveis), arena circular e wall-splat, colisão lateral, máquina de estados,
interrupções simultâneas, projéteis × geometria, itens/consumíveis, save/load/replay, mixer de animação.

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

**Evidência:** saídas dos comandos acima (executados nesta tarefa); regressão completa abaixo.
**Limitação:** testes unitários de simulação (sem navegador); o teste de navegador `verify.mjs` falha por
causa pré-existente (seção F).

## E. Resultados

- **Testes unitários:** `npm run test:combat-lab:unit` — **todas as suítes aprovadas** (61 simulação, 20 Etapa A,
  8 IA tática, 4 patch, 15 locomoção, 12 animação, 10 regras, 71+14+13 VFX, 34 cenários de mapa etc.).
- **Testes de integração:** as duas suítes novas (15 + 10 cenários) cobrem as interações críticas P0.
- **Testes de propriedades:** propriedades auditadas como invariantes dedicados (pouso só na descida,
  continuidade por passo, cache do mixer limitado, futuro reproduzido igual após restore).
- **Testes de navegador:** falha pré-existente em `prototypes/combat-lab/verify.mjs` (`#arena-autoplay-toggle`
  invisível no Playwright) — **reproduzida na árvore limpa antes das mudanças**; não é regressão desta tarefa.
- **Replay/seeds:** sim.test cobre replay por estado e comparação A×B; suíte nova cobre save/load em altitude.
- **Desempenho:** não medido (pendência declarada em F).
- **Regressão do combate:** nenhuma alteração involuntária detectada (suíte antiga verde integralmente).

## F. Pendências (declaradas sem omissão)

**O que não foi implementado:** rampas/escadas/escadas diagonais (§11–14 — exigem decisão de design: a
geometria atual só suporta caixas/cilindros a eixos); laboratório de física jogável com controles de
diagnóstico (§63–64); medições de desempenho (§65–67); gamepad (proibido); balanceamento (proibido).
**O que não foi testado:** cenários de navegador (além da falha pré-existente); IA × geometria em profundidade
(perception/spatial/câmera cinematizada têm suítes próprias que continuam verdes, mas a matriz completa
grupo H — IA — não foi expandida); testes metamórficos formais (§61) — os invariantes dedicados cobrem o
espírito, sem a formalização.
**O que exige aprovação:** faces inclinadas (design de rampas/escadas); migração/remoção do VFX legado.
**O que depende de outro sistema:** nada bloqueado por terceiros.
**Rastreabilidade das 152 decisões (§78):** **parcial** — a cobertura foi classificada por área neste
relatório e nas suítes, mas a matriz decisão-a-decisão (R1.1–R11.9 × implementado/testado/evidência) não foi
gerada; declarada como pendência em vez de omitida.
**Próximo passo tecnicamente necessário:** (1) decidir e especificar rampas/escadas; (2) gerar a matriz de
rastreabilidade §78 a partir de `docs/MATRIZ_RASTREAMENTO_NOVO_MAPA.md`; (3) investigar a falha pré-existente
do `verify.mjs` de navegador.

---

*Branch `feat/camera-cinematica-zzz` — ver `docs/MAPA_REPOSITORIO.md` e o portal `ABRIR_ARENAMON.html`.*
