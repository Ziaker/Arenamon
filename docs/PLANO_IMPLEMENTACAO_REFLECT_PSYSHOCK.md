# Plano de implementação — Reflect e Psyshock no laboratório de combate

> **Status: PLANO APROVADO em 2026-10-16 (decisões D1–D7 conforme as recomendações; aprovação por fase, D7).** Fase 0 entregue em PR próprio (testes de caracterização, sem alterar código de jogo); **Fases 1–7 aguardam aprovação individual.**
> **Fonte das regras:** `docs/MOVES_DECISOES_RODADAS.md` (IDs `M<rodada>.<item>`; Rodada 30 = decisões de 16/10/2026). Este plano não cria regras novas: onde falta decisão, aparece como **Decisão pendente (Dn)**.
> **Base de código lida em 2026-10-16 (`main` @ `a822df7`):** `sim/{moves,world,status,controller,entity,game,config,recording,physics}.js`, `ui/input.js`, `view/world-view.js`, `test/moves.test.mjs`. **Não lidos a fundo:** `tactics.js`/`ai.js` (apenas buscado uso de movimentos: nenhum), `vfx.js`, painéis de `ui/`, `scenarios.js`. Onde isso afeta o plano, está marcado.
> **Escopo:** laboratório (`prototypes/combat-lab/`). O jogo oficial (`prototypes/game`) **não** é tocado (porte exige autorização separada).

## 1. Resumo

O motor já tem a infraestrutura de Moves (registro, ação `move` com linha do tempo, entidades `projectile/barrier/wall/area`, `applyHit` único, status). **Faltam sete capacidades** que Reflect e Psyshock exigem e que o motor não tem hoje:

1. **Charge** (segurar o botão, soltar para executar) — hoje um Move é uma ação de duração fixa disparada por um *toque*.
2. **Reflexão** de projéteis — hoje a barreira só **bloqueia** (o projétil morre).
3. **Power Level, Clash e Counter** — não existem.
4. **Homing** limitado de projétil (0,3 s, 180°/s) e **pontos de mira** sorteados.
5. **Contabilidade por execução e por alvo** (multiplicador 0,8ⁿ por acerto; teto de knockback 0,9 m/s por alvo).
6. **Tackle destrói barreira** (hoje `physics`/`combat` não conhecem entidades do mundo) e **proteção contra explosão** (M30.7).
7. **Captura de parâmetros na criação** (contrato M28.4) — hoje o passo do mundo lê `C.*` a cada execução.

**Proposta: 7 fases, um PR por fase, nada de código sem aprovação.** A ordem minimiza risco: primeiro testes que travam o comportamento atual, depois o Charge (infraestrutura), depois cada Move.

## 2. Contrato M28.4 — como capturar parâmetros (arquitetura)

Regra a cumprir: *sliders valem para usos posteriores; entidades já criadas mantêm o que receberam.*

**Mecanismo proposto:**
- **`MoveParams` (instantâneo do uso):** um objeto simples e congelado, montado **uma vez** a partir de `C` (`C.moves.*`, provisórios de M30.10) e guardado na ação (`f.action.params`). Contém tudo que o Move usa: tempos, custos, dimensões de referência (M30.4), velocidades, leque, alcances, tolerâncias, dano-base, tetos.
- **Entidades** (`spawn`) recebem **uma cópia** do subconjunto necessário em `entity.captured` (também congelada). **Nenhum código de Move lê `C.*` depois da criação**: lê `entity.captured` / `action.params`.
- **Atributos de combate** (Ataque etc.) seguem M30.1: lidos **no disparo** (e **na reflexão**, do refletor) e gravados em `captured.damage`; no impacto **não** se multiplica o Ataque de novo (evita contar duas vezes: hoje `applyHit` multiplica por `stat(owner,'attack',1)`).
- **O que continua global (`C`) de propósito:** regras de mundo e física compartilhadas (`C.test.step`, `arenaHalf`, `contactStep`, `rules.*` de defesa/guard stun). Mudá-las ao vivo continua mudando a partida inteira (comportamento atual, fora do contrato dos Moves). *Ponto para decisão: D1.*
- **Teste obrigatório do contrato (Fase 0):** “slider mid-flight” — altera cada slider de Move com entidades vivas e prova que elas não mudam; passa a ser executado em todas as fases.
- **Não se refatora `C` nem `REGISTRY` agora** (decisão do diretor); este mecanismo convive com eles.

## 3. Decisões pendentes para aprovar (marcadas Dn)

| ID | Pergunta | Recomendação |
|---|---|---|
| **D1** | O `MoveParams` é capturado **no início do uso** (ao apertar) ou **na materialização/disparo**? (M28.4 diz “usos posteriores”.) | **Início do uso**: um slider mexido durante os 4 s de carga não muda aquele uso. **APROVADA (2026-10-16).** |
| **D2** | **Onde registrar** Reflect e Psyshock? O teste `moves.test` garante “registro vazio ao carregar o motor”. | Registrar no **bootstrap do laboratório** (`main.js` → `registerStandardMoves()`), **não** no núcleo `sim/`. Os testes do núcleo continuam com registro vazio; testes novos registram explicitamente. **APROVADA (2026-10-16).** |
| **D3** | Teclas padrão: hoje `skill1–4` = `1,2,3,4`; M1.1/M16.6 pedem **A e S** (e D, Z reservadas). `KeyD` hoje é a **defesa** do laboratório (M2.1 manda Shift). | Mudar só `skill1=A` e `skill2=S` agora (livres hoje). **Não** mexer na defesa (D) até existir o 3º slot. **APROVADA (2026-10-16).** |
| **D4** | Velocidade de cada pedra: “10–14 m/s” — **uniforme sorteada por pedra** (semente) ou valor único por execução? (M5.5 não diz.) | Sorteio uniforme **por pedra**, provisório e configurável (P15-like). **APROVADA (2026-10-16).** |
| **D5** | **Lasers e emissores técnicos** (M3.5, M17.5–7, M20.6, M28.3) são uma entidade nova (`beam`) e muito trabalho. | **Fase 7 separada**, depois dos dois Moves validados. Reflect é entregue já refletindo projéteis. **APROVADA (2026-10-16).** |
| **D6** | Subquestões abertas **P13** (Ataque base × efetivo), **P14** (pedra refletida no teto; vertical), **P15** (sorteio dos pontos). | Implementar com **padrão provisório identificado** (base; conta na execução original; só horizontal; uniforme na caixa) e registrar cada um como M31.x quando você decidir. **APROVADA (2026-10-16).** |
| **D7** | Aprovação **por fase** (merge de cada PR só com seu OK) ou do plano inteiro? | Por fase. **APROVADA (2026-10-16).** |

## 4. Fases

Convenções: **T** = testes; **R** = riscos; **A** = critério de aceite. Toda fase roda `npm run typecheck`, `npm run test:combat-lab:unit`, `npm run test:combat-lab:browser` (quando toca UI/HTML), `npm run check:offline` e confirma que **sem Moves equipados a partida é idêntica à atual** (teste de regressão por estado). Tamanhos relativos: **P** pequeno, **M** médio, **G** grande — **não medidos** (estimativa por leitura de código).

### Fase 0 — Travar o comportamento atual (P, sem mudar código de jogo) — **ENTREGUE (PR da Fase 0)**
- **Arquivos:** `test/` (novos): `moves-contract.test.mjs` (“slider mid-flight”: hoje **deve revelar** quais leituras de `C` afetam entidades vivas — resultado documentado, não corrigido), `moves-order.test.mjs` (ordem defesa → X/C → Move atual, base de M30.9). `package.json` (inclui no `test:combat-lab:unit` e em `test`).
- **A:** testes passam no estado atual; relatório do que o contrato M28.4 exige corrigir.
- **R:** baixo (só testes). **Reversível:** sim.

### Fase 1 — Charge no controlador (G) — **ENTREGUE (PR da Fase 1)**
- **O que:** hold/release de slot; estado de carga; custo no início; interrupção com meio cooldown; cancelamento por defesa/Dodge (≥0,2 s); sem iniciar no ar; interrompe se perder o apoio (M27.1); sem carga simultânea; −25% velocidade linear e angular; buffer de 0,15 s no fim do Dodge; recuperação de 0,25 s; aceleração de cooldown por novo toque físico (custo proporcional); ordem do passo M30.9; falha com devolução de stamina e sem cooldown. Tudo sobre `MoveParams`.
- **Arquivos:** `sim/moves.js` (schema `charge`, validação), `sim/entity.js` (campos do lutador; comando: `skillHeld[]`, `skillReleased`), `sim/controller.js` (`updateFighter`: charging, cancelamentos, penalidades; `movePermission`), `sim/config.js` (novo grupo `C.moves` provisório, M30.10), `sim/types.d.ts`, `ui/input.js` (teclado: held/keyup; gamepad: borda de soltura), `main.js` (fiação), `sim/movement.js`/`recording.js` (comandos com campos novos — **compatível**: a gravação guarda o objeto de comando inteiro; gravações antigas ficam sem os campos, tratados como falso), testes.
- **T:** `charge.test.mjs`: M2.4–M2.6, M7.1–M7.9, M15.1–M15.4, M16.1–M16.8, M26s.8, M27.1, M27.4, M30.9; propriedades (milhares de situações aleatórias sem violar invariantes: stamina ≥ 0, no máximo uma ação, determinismo); `properties`/`core`/`sim`/`rules`/`locomotion` **inalterados**.
- **R:** **alto** — mexe no controlador e na forma do comando (usada por IA, gravação, replay, cenários). *Mitigação:* campos novos com padrão neutro; testes de regressão “sem Move = idêntico”; revisão do diff do controlador por você.
- **A:** com registro vazio ou slot vazio, nada muda (estado idêntico em lutas IA × IA de semente fixa, antes/depois); com um Move de teste (definido só nos testes) o ciclo carregar → soltar → recuperar funciona e respeita cada regra acima.

### Fase 2 — Reflect (G) — **ENTREGUE (PR da Fase 2)**
- **O que:** barreira refletora: criação na soltura; dimensões de referência (M30.4) com 1,5×–3× largura e 1,5×–2,5× altura; espessura 0,10 m (M29.2); distância 50% da profundidade; base na altitude do apoio com tolerância (M27.2); maior retângulo válido e falha com reembolso (M13.6–M13.7, M26s.3); orientação congelada; duração 4 s + carga; múltiplas barreiras; PL1–3 por carga (marcos por contagem de passos); sólida para os dois personagens com deslize; **reflexão especular** pela frente e pelas bordas, verso atravessável (M30.5); troca de dono; cancela homing; recalcula dano (M30.1); ciclos degenerados (M17.2); **Tackle destrói** (recuo + stagger 0,25 s); **explosão destrói e protege** (M30.6/M30.7); ordem de contatos por passo (M30.6); preview com colisão e feedback.
- **Arquivos:** `sim/world.js` (colisão projétil×barreira por **segmento varrido** — o passo atual usa subpassos de 0,1 m com teste de círculo, insuficiente para uma placa de 0,10 m a 14 m/s; novas funções de face/borda/verso; reflexão; proteção de explosão), `sim/physics.js` e/ou `sim/combat.js` (Tackle × barreira: hoje **nenhum** dos dois conhece entidades do mundo), `sim/moves.js`+novo `sim/moves/standard.js` (definição de Reflect como dados + `registerStandardMoves`), `view/world-view.js` e `view/vfx.js` (painel, preview, VFX de expiração/destruição, intensidade por PL), `ui/hud*.js` (slot/carga/PL), testes.
- **T:** `reflect.test.mjs`: M3.x, M4.x, M13.x, M14.x, M19.x, M30.4–M30.7; casos de quina, entrada pelo verso, ciclo degenerado, duas barreiras em ricochete, explosão atrás/na frente, Tackle, falha por falta de espaço; “slider mid-flight” para dimensões e duração; determinismo save/load/replay com barreira viva.
- **R:** **alto** — reescreve a colisão de projétil (tunelamento, estabilidade numérica em incidência rasante) e acopla Tackle ao mundo. *Mitigação:* teste de segmento varrido com projéteis rápidos e placa fina; limite de reflexões por passo (M30.10); fase só entra com a Fase 1 aprovada.
- **A:** todos os testes acima; HTML offline limpo (`check:offline`); lab abre e o Reflect funciona manualmente (**aprovação visual/jogável sua**, M28.9).

### Fase 3 — Psyshock (G) — **ENTREGUE (PR da Fase 3)**
- **O que:** 3→8 pedras (+1 a cada 0,8 s); posições visuais com busca de espaço livre à frente (3,0 m) e falha total com reembolso (M29.3); seguem o lançador com inércia (0,15 s); disparo simultâneo; velocidade 10–14 m/s (D4); lock-on: pontos sorteados na caixa lógica por semente (M30.8) + homing 0,3 s/180°/s, cancelado por reflexão e ao perder o alvo (M27.5); sem lock-on: leque de 20°; dano-base **0,2 × Ataque gravado no disparo** (M30.1) idêntico em todas as pedras (M30.2); **0,8ⁿ no impacto por alvo e execução**; knockback 0,3 m/s por pedra, teto 0,9 por alvo/execução (M30.3); PL compartilhado; pedras do mesmo dono não colidem entre si, de donos diferentes se destroem (M8.2); defesa comum/perfeita/i-frames por pedra (M6.4).
- **Arquivos:** `sim/world.js` (homing, `executionId`, tabela de acertos por alvo, pedra×pedra), `sim/moves/standard.js` (definição de Psyshock), `sim/config.js`, `view/{world-view,vfx}.js`, `ui/hud*.js`, testes.
- **T:** `psyshock.test.mjs`: M1.4–M1.7, M4.7–M4.9, M6.3, M8.1–M8.3, M10.1–M10.3, M11.x, M12.x, M26s.5–M26s.7, M27.3, M27.5, M29.3, M30.1–M30.3, M30.8; reprodutibilidade por semente dos pontos de mira; “slider mid-flight”; Psyshock × Reflect de ponta a ponta (reflexão devolve dano com o Ataque do refletor).
- **R:** **médio-alto** (homing e muitas entidades; limite `C.world.maxEntities`=64 vs 8 pedras × vários usos). *Mitigação:* teste de carga; recusa já existente (`spawnRefused`).
- **A:** testes + medição com `npm run measure:sim` refeita (carga de Moves) **sem exigir meta** (não há meta definida).

### Fase 4 — Power Level, Clash e Counter (M) — **ENTREGUE (PR da Fase 4), no escopo de Reflect, Psyshock e Tackle**
- **O que:** PL em entidades e ações (Tackle PL1 fixo); Clash (PL igual) e Counter (PL diferente) para as interações elegíveis; Counter Stagger de 0,2 s (só se o vencedor atinge o corpo; sem acumular; pode interromper Charge); eventos e telemetria (M20.9).
- **Arquivos:** `sim/combat.js`, `sim/world.js`, `sim/telemetry.js`, `ui` (HUD/telemetria), testes `pl.test.mjs` (M18–M22).
- **R:** **médio** — pode mexer em resultados do Tackle existente. *Mitigação:* PL só entra quando há Move equipado; testes `core`/`rules` inalterados.
- **Nota:** pode ser fundida às Fases 2–3 se você preferir menos PRs (aumenta o tamanho de cada um).

### Fase 5 — IA (M) — **ENTREGUE (PR da Fase 5)**
- **O que:** a IA tática usa Reflect e Psyshock com **as mesmas permissões** do jogador (M15.7–M15.8, M27.6): quando criar a barreira, quando soltar o Charge, PL a escolher, desviar de barreiras/projéteis refletidos, Tackle para destruir barreira; telemetria opcional das decisões.
- **Arquivos:** `sim/tactics.js` (hoje **não** usa movimentos), `sim/ai.js`, `sim/ai-eval.js`, testes `ai.test`/`ai-eval.test` (não podem regredir) + novo `ai-moves.test.mjs`.
- **R:** **médio** — mudar a IA pode alterar o equilíbrio (a IA revisada já foi calibrada). *Mitigação:* comportamento novo só com Moves equipados; sem Moves, `ai-eval` idêntico.

### Fase 6 — Laboratório: HUD, ajustes, cenários (M) — **ENTREGUE tecnicamente (PR da Fase 6); a aprovação visual/jogável é do diretor**
- **O que:** HUD real dos slots (hoje as propostas A/B/C usam cooldowns de demonstração), sliders dos parâmetros de `C.moves` com marca “provisório”, cenários repetíveis (Reflect/Psyshock/Tackle, PL1–3, falta de espaço), overlays técnicos opcionais (desligados), pausa/passo/seed (já existem), controle alternável e IA no não controlado (M28.2: parcialmente existe), documentação (`MOVIMENTOS.md`, `INDICE_MODULOS.md`).
- **Arquivos:** `ui/{hud,hud-proposals,tuning,tuning-meta,presets-panel}.js`, `sim/scenarios.js`, `main.js`, `test/*.browser.mjs`.
- **A:** testes de navegador novos; **homologação jogável por você** (checklist existente em `ui/homologation.js`).

### Fase 7 — Lasers e emissores técnicos (G, opcional) — **ENTREGUE tecnicamente (PR da Fase 7); a aprovação visual/jogável é do diretor**
- Nova entidade `beam` com reflexão contínua, segmentos, mudança de dono e recálculo ao sumir a barreira (M17.5–7, M20.6) e emissores de laser/explosão de teste (M28.3). **Só após as Fases 1–6 aprovadas.**

## 5. Matriz mínima regra → teste (resumo)

| Regras | Teste |
|---|---|
| Charge, custo, cooldown, interrupção, cancelamento, ordem | `charge.test` (Fase 1) |
| Geometria, reflexão, faces/bordas/verso, duração, falha | `reflect.test` (Fase 2) |
| Pedras, mira, homing, dano 0,8ⁿ, knockback, falha de espaço | `psyshock.test` (Fase 3) |
| PL, Clash, Counter, stagger | `pl.test` (Fase 4) |
| Uso pela IA com as mesmas regras | `ai-moves.test` (Fase 5) |
| Contrato M28.4 | `moves-contract.test` (Fase 0, em todas) |
| Sem Moves ⇒ partida idêntica | regressão por estado (todas) |

A matriz completa (cada `M…` → teste) será mantida em `docs/MOVES_TEST_MATRIX.md` durante a Fase 0.

## 6. Riscos transversais

1. **Forma do comando e do lutador** (Fase 1) é consumida por IA, input, gravação, replay, cenários e testes: mudança de contrato mais ampla do plano.
2. **Colisão de placa fina com projétil rápido** (Fase 2): tunelamento e reflexão numérica instável.
3. **Estado global `C`** (não refatorado): a disciplina de captura depende de revisão e do teste “slider mid-flight”.
4. **Sem paridade com o v6** nesta máquina (arquivo ausente): a regressão se apoia nos testes existentes e em comparação de estados antes/depois.
5. **HTML gerado:** a partir da Fase 1 o HTML **muda de propósito** (comparação byte a byte deixa de valer; vale a regressão por estado e `check:offline`).
6. **Pendências abertas** (P11, P13–P15) seguem com padrão provisório marcado; nada é apresentado como aprovado.
7. **Desempenho:** simulação hoje ≈ 7 µs/passo (`DESEMPENHO_BASELINE.md`); GPU/VFX **não medidos** — pedras, barreiras e VFX podem pesar no navegador.

## 7. Processo

- Uma **branch e um PR por fase**, em worktree temporário (`.worktrees/<nome>`); o checkout oficial não é tocado.
- Antes de cada fase: confirmar `git status`, `fetch`, e seu OK explícito para aquela fase.
- Em cada PR: lista do que foi **executado** e do que **não** foi (como `VERIFICACOES.md`), e hash enviado × hash remoto.
- **Nada** é mesclado sem sua aprovação da fase; a aprovação visual/jogável é sua (M28.9).
- Reflect e Psyshock só ficam **equipados por padrão** após a homologação jogável; até lá, opt-in por preset.
