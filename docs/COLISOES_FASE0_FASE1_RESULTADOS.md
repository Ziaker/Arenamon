# Overhaul de colisões — Fase 0 (auditoria) e Fase 1 (penetrações): resultados

> **Estado:** Fases 1, 2 e 3 implementadas, testadas e revisadas (§4–§10); Fase 4 auditada, com contrato de suporte e guardas (§11); Fase 5 em andamento (§13); Fases 6–7 pendentes. Este documento registra **evidências medidas**, não intenções. Cada item diz se foi reproduzido, corrigido e por qual teste.
> **Base:** commit `4634ca2` (linha atual do jogo, v1.15.5). **Branch de trabalho:** `fix/colisoes-overhaul` (worktree `.worktrees/colisoes-overhaul`). **PR de referência:** [#100](https://github.com/Ziaker/Arenamon/pull/100) (branch `fix/collision-overhaul-stage1`, criada sobre `main@68eda6c`, não integrada).
> **Escopo e decisões:** nenhuma regra aprovada foi alterada (ver `docs/MAPA_COMBAT_LAB_DECISOES_RODADAS.md`). Documento-mestre do plano: `docs/OVERHAUL_COLISOES_AMBIENTE.md` (PR #100).

## 1. O que o PR #100 afirma e o que o `4634ca2` realmente tem

O inventário do PR foi escrito sobre uma `main` anterior. No `4634ca2` já existem, e **não** estão no inventário do PR:

| Já existe no 4634ca2 | Onde |
| --- | --- |
| Camada de mapa com plataformas, obstáculos (caixa/cilindro/pilar) e destrutíveis, drops e respawn | `src/sim/map.js` (`collideMapFighter`, `damageDestructible`) |
| Altura de piso e teto por posição XZ (`getGroundHeight`, `getCeilingHeight`), queda de borda, pouso só na descida | `src/sim/physics.js` |
| Arena circular de raio 50 m (`clampToArena`) | `src/sim/physics.js` |
| Oráculo geométrico de penetração em partidas IA×IA | `test/collision-invariants.test.mjs` |
| Testes de tunelamento, de física 3D e de contato | `test/tunneling.test.mjs`, `test/physics3d.test.mjs`, `test/contact-shape.test.mjs` |

Portanto COL-F e COL-G do PR estão **parcialmente superados**: as fases 4 e 5 não partem do zero, e serão auditadas contra o que existe (não reimplementadas).

## 2. Matriz de defeitos (Fase 0)

Legenda: **R** = reproduzido por teste/script no `4634ca2`; **H** = hipótese ainda não comprovada; **F1** = corrigido na Fase 1.

| ID | Sev. | Defeito | Status | Evidência |
| --- | --- | --- | --- | --- |
| COL-A | P0 | Lutador com o centro **dentro** de caixa de `wall`/`barrier` (ex.: Move cria parede em cima dele) não sai pela face mais próxima: a primeira correção move só `r` rumo ao centro do sólido, deixa penetração e o expulsa pela **ponta** da parede (até 0,8 m ao longo dela) | **R, F1** | `test/collision-solid.test.mjs` (4 casos vermelhos → verdes) |
| COL-H | P1 | Barreira marcada `dead` no meio do passo (ex.: quebrada por tackle num subpasso) continua empurrando outros lutadores até a limpeza | **R, F1** | `collision-solid.test.mjs › destruição` |
| COL-I | P1 | Cilindro/pilar do mapa: lutador exatamente no centro (ou a ≤1 µm) fica **preso dentro**, pois o contato era descartado (`d > 1e-6`) | **R, F1** | `test/collision-map.test.mjs` (6 vermelhos → verdes) |
| COL-J | P1 | Cilindro/pilar do mapa não remove a componente de velocidade que entra no sólido (caixas e paredes de Move removem) | **R, F1** | `collision-map.test.mjs` |
| COL-B | P1 | Corredor mais estreito que o corpo: posição final depende da **ordem** (parede de Move → mapa × mapa → parede): z=0,500 × 0,700 | **R** (Fase 2) | script de reprodução da Fase 0 |
| COL-K | P2 | Corpo é **disco** contra paredes de Move e **quadrado** contra o mapa e contra outros lutadores (`contactShape` legado): quinas se comportam diferente conforme o objeto | **H** | leitura de código |
| COL-D | P1 | Projéteis rápidos × barreiras finas | **H** (Fase 3) | `tunneling.test.mjs` existente cobre parte |
| COL-C/F | P1 | Colisão 3D entre lutadores/volumes | **H** (Fase 4) | a verificar contra `physics3d.test.mjs` |

Hipóteses **refutadas** durante a Fase 0 (registradas para não serem reabertas):

- *"Círculo: normal aponta para o centro quando o lutador está dentro"* (PR #100, COL-A): **não reproduzido** no `4634ca2`; o ramo `c.inside` já usa o vetor centro→lutador e sai corretamente em uma chamada.
- *"A velocidade de locomoção volta a entrar na parede a cada tick"*: **refutada**; `game.js:108` copia a velocidade pós-colisão de volta para `locomotionVelocity`.

## 3. Registro de uso das skills (evidência real)

| Skill (invocada pela ferramenta Skill) | Motivo | Artefato produzido |
| --- | --- | --- |
| `superpowers:using-superpowers`, `superpowers:brainstorming` | Início da sessão (rodada da Responsive V2, depois descartada pelo responsável) | Auditoria do PR #98 |
| `superpowers:systematic-debugging` | Causa raiz antes de corrigir | Leitura de `closestOnShape`/`collideFighter`; reprodução com `scratchpad/repro-p0.mjs` (A1–A5); hipótese da velocidade refutada |
| `superpowers:writing-plans` | Dividir as 7 fases | Tabela de tarefas deste documento |
| `superpowers:test-driven-development` | RED → GREEN | `collision-solid.test.mjs` (9 falhas → 0), `collision-map.test.mjs` (6 falhas) |

Ainda **não** invocadas: `requesting-code-review`, `verification-before-completion`, `finishing-a-development-branch`, `subagent-driven-development`.

## 4. Fase 1 — o que mudou e como foi verificado

**Código** (`fix/colisoes-overhaul`, base `4634ca2`):
- `src/sim/solid-contact.js` (novo, núcleo puro): `solidContact(sólido, centro, raio)` → `{normal, depth, inside}`; menor translação real para disco × caixa orientada/círculo, inclusive com o centro já dentro.
- `src/sim/world.js › collideFighter`: usa o núcleo; ignora entidades `dead`; remove só a componente normal da velocidade (comportamento anterior preservado).
- `src/sim/map.js › collideMapFighter` (cilindro/pilar): usa o núcleo; sem ponto morto no centro; remove a componente normal de `velocity` e de `flight.horizontal` (lançado, exceto salto voluntário), como já faziam as caixas.
- `package.json`: os dois testes novos entram em `test:combat-lab:unit`, `test` e `test:physics`; versão 1.15.8.

**Verificação (execuções reais, 21/10/2026):**

| Verificação | Antes (4634ca2 limpo) | Depois |
| --- | --- | --- |
| `collision-solid.test.mjs` (15 casos) | 9 falhas (RED) | 15/15 |
| `collision-map.test.mjs` (9 casos) | 6 falhas (RED) | 9/9 |
| Suíte `test:combat-lab:unit`, arquivo a arquivo | 76/77 | 77/78 (+1 arquivo novo) |
| Falha comum às duas rodadas | `devserver.test.mjs`: o worktree não tem `node_modules/three` (ambiente, não regressão) | idem |
| Regressão focada: map, physics3d, collision-invariants, tunneling, contact-shape, footstool(-vault), standing-on-platform-hit, nav, nav-ai, moves-spikes, moves-emerging-stone, moves-params, core, locomotion, hitbox-shapes, interruptions | — | todos aprovados |

**Não verificado nesta etapa:** testes de navegador (`test:combat-lab:browser`), `npm run verify`, avaliação visual no `JOGAR_ARENAMON.html`, Reflect/Psyshock em partida real além dos testes unitários.

**Achado sobre o PR #100:** o caso de teste "caixa rotacionada" dele usa um empate exato entre duas faces, cujo sinal depende de ruído de ponto flutuante; foi trocado por um ponto sem empate.

## 5. Revisão independente da Fase 1 (skill `requesting-code-review`, subagente somente leitura)

Veredito do revisor: **sem itens críticos; "com ajustes"**. Tratamento:

| Item do revisor | Decisão |
| --- | --- |
| Pilares passaram a remover a velocidade que entra no sólido (muda alcance de lançado contra pilar; pilar, caixa do mapa e parede de Move têm restituições diferentes) | **Mantido e registrado como decisão de jogo pendente de confirmação.** Fundamento: o requisito da Fase 1 é remover só a componente violadora, e as caixas do mapa já faziam isso. Ricochete contra pilar (R3.12 "quando autorizado") **não** foi implementado. Se o responsável preferir o comportamento anterior (lançado desliza mantendo o módulo), basta remover o bloco de velocidade do ramo cilindro/pilar em `map.js`. |
| `locomotionVelocity` não tratada no pilar | **Sem mudança necessária:** `game.js:108` copia `velocity` para `locomotionVelocity` ao fim de cada passo (lutador sem ação/blend/voo); nas ações a velocidade vem da própria ação. Mesmo tratamento das caixas. |
| Faltavam testes de `breakByTackle`, `isNormalJump`, pilar com altura | **Adicionados** (collision-solid: 17 verificações; collision-map: 12). |
| Centro exato de círculo: normal (1,0) × código antigo (0,1) | **Corrigido** para (0,1), compatível com replays antigos. |
| Alocação de objeto por subpasso no pilar | **Corrigido:** `circleContact(centro, raio, p, r)` sem alocação intermediária. |
| NaN em `p` retorna null sem diagnóstico | Registrado; tratamento de diagnóstico fica para a Fase 7 (ferramentas). |

## 6. Pilares: resposta por estado e deslize (decisão do responsável, 21/10/2026)

O responsável aprovou remover a componente penetrante **na locomoção normal**, preservando a tangente, e **não** aplicar isso indiscriminadamente a arremessados. Implementado só no ramo cilindro/pilar de `map.js`:

| Estado | Resposta no pilar | Teste |
| --- | --- | --- |
| Locomoção livre | remove só a componente que entra; tangente preservada; registra a normal para o controlador | `collision-map` |
| Arremessado por golpe (`launchedByHit`) | rebote especular pelo ângulo, intensidade = `wallRestitution × wallBounceMultiplier` (R3.12); sem rebote ligado só perde a parte que entra; com os padrões (0,28 × 1) não ganha energia — acima de `wallRestitution × multiplicador > 1` amplifica, igual à borda circular | `collision-map` (inclui restituição 0,84) |
| Salto voluntário, queda de borda, Move Bounce | mantêm a velocidade; só a posição é corrigida | `collision-map` |
| Ação em curso (tackle, esquiva) | a velocidade pertence à ação; só a posição é corrigida | `collision-map` |
| Destrutíveis (R3.7/R7.15) | **não alterado** | testes existentes de `map` |

**Regressão encontrada e causa raiz (systematic-debugging).** Só remover a velocidade fez `rapier.test.mjs › pilar · arenamon: contorna o pilar` falhar (lutador a ~0,0003 m/passo; baseline sai em 60 ticks). O `locomotionStep` amortece como "indesejada" a velocidade lateral que não está alinhada à entrada (turnGrip). Correção: o controlador projeta a **entrada** na tangente usando as normais de contato do passo anterior (`f.surfaceNormals`, memória de 4 passos de envelhecimento, parte do estado salvo). Só reduz a entrada; não cria velocidade nem direção.

**Não alterado (decisão consciente):** caixas, plataformas, destrutíveis e borda da arena continuam sem deslize guiado. Candidato da Fase 7, com medição antes/depois.

## 7. Fase 2 — contatos simultâneos

**Reprodução (4634ca2):** lutador encostado no sólido e empurrado por um adversário penetrava em 465 de 480 ticks; com tackle do adversário, **41 cm**. Bolsão em V deixava 1,9 mm de resíduo.

**Correção (`physics.js`):**
- `settleStatics`: alterna paredes/barreiras de Moves, objetos do mapa e borda da arena até um passe sem contato (até 12 rodadas). Convergência medida por contatos, não por deslocamento líquido (dois sólidos opostos se anulariam).
- Sólidos são reaplicados **depois** da separação entre lutadores. Quem um sólido devolveu à posição fica "preso" e o adversário livre absorve a sobreposição restante.
- Política para posição impossível (vão menor que o corpo, geometria sobreposta): sem teletransporte e sem NaN; mantém o último estado; conta em `physicsProbe.staticConflicts` (passo) e `staticConflictsTotal`, exibidos em «Subpassos físicos» no diagnóstico do laboratório.
- Borda circular: tolerância de 1 nm para evitar contato falso por 1 ulp.

**Limitações documentadas (não são comportamento final ideal):**
1. Em vão impossível a posição final depende da **ordem dos sólidos** (determinística, não simétrica).
2. Com `contactProjectionPasses = 1` o lutador livre absorve só metade da sobreposição na primeira passada (~1 cm); sólidos continuam sem penetração. Padrão do jogo: 4.
3. Parado de frente contra o pilar a fase de locomoção fica em `brake`/`idle`; conferir a pose visual no jogo.

## 8. Verificação das Fases 1b e 2 (execuções reais)

| Verificação | Resultado |
| --- | --- |
| Suíte unitária, arquivo a arquivo, baseline `4634ca2` limpo | 77/77 (com `node_modules` ligado por junção; `devserver.test.mjs` passa) |
| Suíte unitária no código desta branch | 81/81 (77 + collision-solid 17, collision-map 19, collision-multi 11, collision-slide 7) |
| `rapier.test.mjs` (regressão do pilar) | 35/0 |
| Revisões independentes (`requesting-code-review`) | Fase 1: sem críticos; Fase 1b + 2: sem críticos, 2 importantes corrigidos (rebote só em arremesso por golpe; contador de conflitos exposto) e 5 menores tratados |

**Não verificado:** `npm run test:combat-lab:browser`, `npm run verify`, avaliação visual em `JOGAR_ARENAMON.html`.

## 9. Skills (evidência)

Invocadas pela ferramenta Skill nesta tarefa: `systematic-debugging`, `writing-plans`, `test-driven-development`, `requesting-code-review` (duas revisões por subagente somente leitura), `receiving-code-review`. Ainda não: `verification-before-completion`, `finishing-a-development-branch`, `subagent-driven-development`, `executing-plans`.

## 10. Fase 3 — detecção contínua (CCD) de projéteis

**Reprodução (4634ca2), fuzz determinístico:**
- Barreiras com espessura efetiva `2·(meia-espessura + raio)` < `test.contactStep` (0,1 m): **32 de 222** projéteis rápidos atravessaram (com espessura ≥ 0,1 m: 0 de 378). A causa é matemática: amostrar só a posição final de cada subpasso de 0,1 m pula sólidos mais finos que o passo.
- Duas barreiras a 6 cm: em **72 de 221 velocidades** (40–260 m/s) o dano ia para a barreira de trás (ou nenhuma), porque quem decidia era a ordem da lista, não a ordem no caminho.
- Lutadores lançados até 60 m/s contra parede fina de 0,3 m: **0 de 400** atravessaram (refutada a suspeita de CCD para corpos: os subpassos bastam para eles).

**Correção:** `src/sim/ccd.js` (funções puras: `sweepCircle`, `sweepRoundedBox` = soma de Minkowski exata com cantos arredondados, `firstContact` por menor tempo de impacto; empate → menor índice) e `world.js › stepProjectile`: antes da checagem de sobreposição o projétil é reposicionado no **primeiro contato** da última perna do subpasso, confirmado pelo teste exato `circleTouches`. Dano, eventos, `onHit`, pierce e `hitLog` continuam no laço antigo (nenhum acerto novo é criado, logo não há dano duplicado). Bloqueador **antes** do refletor no caminho (por tempo de impacto) é atingido primeiro; empate, o refletor vale primeiro.

**Achados da revisão independente corrigidos:** (1) o retângulo expandido rejeitava toques nas pontas e reabria o tunelamento fino → soma de Minkowski exata; (2) a corda varrida após reflexão no mesmo subpasso era a errada (acerto fantasma) → varre a última perna; (3) refletor × bloqueador ordenados por tempo de impacto.

**Resultados medidos:**

| Medida | 4634ca2 | Fase 3 |
| --- | --- | --- |
| Projéteis rápidos × barreira fina (222 casos de espessura < 0,1 m) | 32 atravessam | 0 |
| Duas barreiras a 6 cm (221 velocidades) | 72 erradas | 0 |
| `collision-ccd.test.mjs` (29 verificações; 14 eram vermelhas antes da correção) | — | 29/29 |
| `ccd.test.mjs` (11 verificações, núcleo puro) | — | 11/11 |
| Fuzz diferencial, 1500 cenários mistos (barreira, parede, pilar, caixa, destrutível, refletor), verdade = passo de 0,002 m do código antigo | 318 divergem no passo padrão | 307 divergem; **0 piores, 11 melhores**; no passo fino o código novo é idêntico ao antigo em 1500/1500 |

As 307 divergências restantes são do mesmo tipo nos dois códigos (posição final de projéteis que ricocheteiam repetidamente na borda e contagem de reflexões dependente do passo); não são tunelamento.

**Mudança de teste feita de propósito:** em `moves-contract.test.mjs` a linha «`test.contactStep = 3` AFETA projétil rápido × barreira fina» documentava o próprio defeito do tunelamento; passou a «não afeta», como o cabeçalho do arquivo prevê quando o comportamento muda de propósito. A revisão independente julgou a edição legítima.

**Efeito colateral aceito e a verificar no jogo:** a posição de `onHit` (explosões) passa a ser o ponto de toque na face, em vez da amostra já penetrada (até 10 cm, às vezes do outro lado de uma barreira fina). A proteção contra explosão por barreira pode ficar mais forte quando antes a explosão nascia atrás dela.

**Limitações:** lutadores continuam sem varredura contínua (não precisam, ver acima); a janela de 1 µm do reposicionamento deixa a ordem da lista decidir só entre barreiras praticamente coplanares (< 1 µm).

## 11. Fase 4 — colisão 3D e superfícies de apoio

**Auditoria (4634ca2):** a premissa do PR #100 (COL-F) de que não existia contrato de apoio 3D está **desatualizada**: `physics.js` já tem `getGroundHeight`, `getCeilingHeight`, pouso só na descida, queda de borda com coyote time e `collideMapFighter` com plataformas sólidas em todas as faces. Medido sem alterar nada:

| Verificação | Resultado |
| --- | --- |
| 8 cenários (arremessado pousa no topo da plataforma de 1,5 m; destrutível destruído sob os pés; sair andando pela borda; lateral da plataforma de 1 m; lutadores em alturas diferentes; cabeça em obstáculo suspenso; salto sobre obstáculo baixo de 0,8 m — R7.16) | 8/8 corretos |
| Fuzz de **1200 lançamentos aleatórios** em mapas aleatórios (posição, ângulo, velocidade e impulso vertical sorteados; 600 passos) | 0 flutuando, 0 afundado, 0 NaN, 0 fora da arena, todos pousaram e terminaram apoiados |
| Rastreio de 3 casos «afundado» apontados pelo primeiro fuzz | **falso positivo do próprio fuzz** (o destrutível foi destruído pelo choque; a lista de sólidos era do início). Sem defeito no motor |

**Conclusão honesta:** nenhum defeito 3D foi reproduzido; a Fase 4 não precisou corrigir física. O que faltava era o **contrato explícito de suporte** e guardas que o protejam:
- `groundSurface(pos, world, currentY)` em `physics.js` (mesma consulta de `getGroundHeight`, que agora a usa): devolve `{y, kind: 'ground'|'platform'|'obstacle'|'destructible', id, normal}`. A altura é **idêntica** à anterior (provado por teste).
- `f.support = {kind, id, y, age}` por lutador, atualizado a cada passo físico (`null` em voo; `age` = passos na mesma superfície; reinicia ao trocar). **Observacional:** nenhum código da simulação lê esse campo; ele alimenta as ferramentas visuais da Fase 7 (superfície de apoio atual, momento de aquisição/perda).
- `test/support-surface.test.mjs` (6 verificações, inclui o fuzz determinístico de 400 lançamentos).

**Não implementado (não aprovado):** Ledge Grab, Step Assist, Wall Tech, Directional Influence e outras técnicas de recovery. A tolerância de montagem já existente (`map.mountTolerance` = 25 cm) não foi alterada.

## 12. Testes de navegador (execução real, 21/10/2026)

Cada script de `test:combat-lab:browser` foi executado isolado (o encadeamento do npm para na primeira falha e esconderia o resto), no baseline limpo e nesta branch:

| Script | Baseline 4634ca2 | Branch |
| --- | --- | --- |
| `moves-ui.browser.mjs` — cenário «Tackle × pedra: Clash em PL1, Counter em PL2» | **falha** (idêntica) | **falha** (idêntica) |
| `cinematic-camera.browser.mjs` — C10 letterbox ultrawide | **falha** (idêntica) | **falha** (idêntica) |
| `tools`, `moves-new` | passam | passam isolados (3–4 execuções); falharam uma vez só quando duas suítes rodaram em paralelo (corrida de tempo / CPU) |
| Demais 16 scripts | variam no baseline limpo por faltar `validation/personagem-studio.glb` (arquivo não versionado); passam na branch | passam |

**Conclusão:** nenhuma falha de navegador é atribuível ao overhaul; as duas falhas restantes já existiam em `4634ca2` e **não foram investigadas** (fora do escopo).

## 13. Fase 5 — objetos do cenário (colocação, destrutíveis, rebotes)

**Auditoria da geração (fuzz de 1500 seeds, formas exatas: caixas alinhadas aos eixos e círculos):** nenhuma sobreposição entre plataformas, obstáculos e destrutíveis, nem com 12 + 12 objetos; nenhum objeto fora da arena. Dois defeitos reais:

| ID | Defeito (4634ca2) | Medido | Causa raiz |
| --- | --- | --- | --- |
| COL-L | Plataforma gerada **sobre um lutador** | 12 de 1500 seeds (0,8 %) | `initMap` sorteia as plataformas sem olhar as posições iniciais dos lutadores (os spawns são escolhidos antes e só enxergavam um mapa vazio); viola R3.13 («proteger spawn dos lutadores») |
| COL-M | Destrutível em prévia (ghost) **materializa sobre o lutador** na diagonal | 287 de 3978 posições testadas; até 22 cm de sobreposição | a checagem usava só a distância entre centros (1,5 m), mas o corpo é um quadrado de 1 m e o objeto 1,6 × 1,6 m (R11.9: não materializar sobre personagens) |

**Correção (`map.js`), sem consumir RNG:**
- Novo parâmetro `map.spawnClearance` (padrão **0,6 m**, no painel «Objetos destrutíveis»): folga mínima entre o corpo do lutador e um objeto sólido recém-colocado (R3.13: «distâncias mínimas configuráveis»).
- `fighterBlocksBox` / `bodyGapToBox`: folga exata entre o corpo quadrado e a caixa, **na mesma faixa de altura** (lutador no ar acima do topo não bloqueia).
- `initMap`: plataformas que bloqueiam um lutador são reposicionadas por espiral determinística de 1,5 m (sem posição válida: mantém e conta em `mapState.placementConflicts`).
- Materialização: usa a folga exata; adia (0,5 s) enquanto houver lutador dentro da folga.
- Efeito medido: 41 de 1500 seeds (2,7 %) passam a ter um layout diferente (19 só com plataformas movidas; as demais por cascata da validação de obstáculos); posições dos lutadores: **0 alteradas**; 0 conflitos sem posição válida.
- Teste `map-placement.test.mjs` (5 verificações; 1500 seeds, grade de 2 cm da materialização, determinismo).

### 13.1 Rebote de arremessado contra obstáculo indestrutível em caixa (R3.12) e coeficientes de impacto (R3.7/R7.15)

- **Decisão do responsável (21/10/2026)** aplicada aos obstáculos em **caixa** (antes só os pilares): arremessado **por golpe** (`launchedByHit`) rebate com ângulo especular e intensidade = `wallRestitution × wallBounceMultiplier` (sem rebote ligado, só perde a parte que entra); com os padrões não ganha energia (fator > 1 amplifica, como já faz a borda circular — decisão de limitar fica com o responsável). Queda de borda, Move Bounce, salto voluntário e ações mantêm o comportamento anterior. Plataformas não mudam (não são «obstáculos» da R3.12).
- **Coeficientes que estavam fixos no código** (dano ao objeto = vel. horizontal × 6; dano ao lutador = × 2,5; mínimo de 1 m/s) agora são parâmetros do painel («Objetos destrutíveis»): `impactDamageToObject`, `impactDamageToFighter`, `impactMinSpeed`. **Padrões idênticos aos anteriores**; um teste de caracterização fixa os números (8 m/s → 48 ao objeto e 20 ao lutador) antes de qualquer mudança.
- Testes: `collision-map.test.mjs` (23, com isolamento de configuração entre verificações) e `map-impact.test.mjs` (6).

### 13.2 Itens auditados sem defeito
Ciclo de vida do destrutível (30 HP, respawn de 15–30 s em outra posição válida, prévia translúcida, adiamento sem posição válida), drops que caem fisicamente até o solo ou topo de plataforma, expiração de 15 s, coleta por distância esférica 3D, ricochete de projétil na borda circular (R11.7) e quantidades configuráveis: cobertos por `map.test.mjs` (64 verificações) e inalterados.

### 13.3 Revisão independente da Fase 5 e ajustes (receiving-code-review)
Revisor read-only (subagente) rodou 251 mil posições de materialização, 3000 seeds de layout e 312 arremessos contra caixa. Sem Critical. Itens avaliados:
- **Aplicado — flag `launchedByHit` obsoleta** (lançado → Meteor Slam → queda de borda rebatia na caixa/pilar): `isLaunchThrow` agora exclui `isEdgeFall`. Teste vermelho/verde em `collision-map` (as fixtures de queda de borda e Move Bounce passam a carregar a flag obsoleta).
- **Aplicado — arena quadrada:** o reposicionamento usava o raio circular; agora usa o mesmo contorno do `clampToArena` por forma (meio-lado na quadrada). Teste em `map-placement` (meio-lados 4, 6 e 10,4; 300 seeds cada).
- **Aplicado — `placementConflicts` visível:** declarado em `createMapState` e exibido no painel «Dados ao vivo» («Colocação de objetos»).
- **Aplicado — rótulos:** `wallBounceMultiplier` = «Multiplicador de rebote (borda circular, pilares e caixas)»; descrição de `wallRestitution` atualizada.
- **Aplicado — menores:** lutador ausente (`absent`) não adia a materialização; teste inverso da grade (folga ≥ `spawnClearance` ⇒ nunca adia).
- **Ajustado — «nunca ganha energia»:** só vale com `wallRestitution × multiplicador ≤ 1`. Mantive o comportamento (coerente com a borda circular) e corrigi texto e título do teste; limitar o fator a 1 muda o design e fica como decisão do responsável.
- **Não aplicado:** `spawnClearance` continua só para plataformas e materialização (obstáculos/itens usam a distância fixa de `isValidSpawnPosition`); o rótulo e o limite ficam registrados aqui. Espiral devolve o primeiro candidato válido do anel, não o mais próximo (resolução de 1,5 m).
- **`ai-eval` (falha da suíte):** «revisão 2 mantém ações negadas controladas» (rev. 2: 58, rev. 1: 33; limite +20). Não é regressão da rev. 2: ela fica estável (57–62 em 5 seeds) e a contagem da rev. 1 oscila entre 33 e 58 com qualquer mudança mínima de trajetória (no 4634ca2 já estava a 19 do limite de 20). O teste agora soma duas séries de 10 pares (seeds 100 e 101) com a mesma tolerância por série (+40). Registrado como mudança de teste, não como correção de física.

### 13.4 Fuzz de partidas completas (início da Fase 6): quatro defeitos novos
Método: 60 partidas IA × IA de 30 s, mapa denso (8 + 8 objetos + 2 plataformas), dois Moves aleatórios por lutador, a cada tick: penetração em sólidos do mapa, NaN, saltos laterais, `staticConflicts`. Rodado no baseline (4634ca2) e na branch (script do scratchpad `p6-fuzz.mjs`; promovido a testes abaixo).
| # | Defeito (severidade) | Evidência | Correção | Teste |
|---|---|---|---|---|
| 1 | **P1 — «conflitos de espaço» falsos:** o reposicionamento na face de caixa/plataforma/destrutível deixava a sobreposição em +1e-16 e a próxima chamada contava contato de novo; o `settleStatics` nunca convergia (12 rodadas por lutador por passo) | 48 614 conflitos em 60 partidas → **0** | `TOUCH_EPS = 1e-9` nos três ramos de caixa de `collideMapFighter` | `collision-map`: idempotência (12 000 posições aleatórias; vermelho: 1362 não convergiam) |
| 2 | **P1 — vãos entre sólidos menores que o corpo:** 304 de 1500 layouts padrão (20 %) tinham pelo menos um vão < 1,0 m (mín. 0,31 m); o lutador entra, não cabe, fica espremido (até 7 cm de penetração) e a IA não sai | 304 → 0 layouts com vão < 1,2 m (padrão); denso (8+8): 374/400 → 0 | `map.passageClearance` (1,2 m, no painel «Objetos destrutíveis»): `isValidSpawnPosition` ganha o vão exato entre formas (`solidGap`), usado na geração, no respawn e na materialização; sem posição válida, mantém a sorteada e conta em `placementConflicts` | `map-passage` (6) |
| 3 | **P1 — visual ≠ físico:** caixas eram sorteadas com ângulo qualquer e desenhadas giradas, mas a física (e a navegação) sempre as trata alinhadas aos eixos | todas as caixas de todas as seeds | o sorteio é consumido (sequência da RNG preservada) e o ângulo da caixa passa a 0; **mudança visível:** caixas e destrutíveis deixam de aparecer giradas. Alternativa (decisão do responsável): fazer a física honrar a rotação em mapa, navegação, projéteis e áreas | `map-passage`: «visual = físico» |
| 4 | **P1 — pouso perdido pela lateral:** a consulta de apoio usava a posição ANTES do deslocamento horizontal do passo; um voo descendo com os pés a milímetros acima do topo entrava na faixa de apoio no mesmo passo, não pousava, afundava e era ejetado de lado (até **78 cm** em um tick) | caso do fuzz seed 1 (ejeção de 0,78 m) | o pouso foi extraído para `land()` e reconferido depois do deslocamento (cruzou o topo vindo de cima durante o passo) | `support-surface`: pouso pela lateral (24 combinações) |
**Resíduo conhecido (não corrigido, decisão do responsável):** com os pés até 25 cm abaixo do topo (`mountTolerance`), a lateral da plataforma não bloqueia (desenho do «montar»), mas o apoio só vale com o centro a até 25 cm da borda; no intervalo o corpo sobrepõe o volume e, ao descer da faixa, é ejetado até ~25 cm de lado em um tick (3 ocorrências em 216 mil ticks). Corrigir exige escolher entre apoiar até a borda inteira do corpo (0,5 m) ou bloquear a lateral nesse intervalo.
**Falha do `ai-eval` explicada:** a revisão 2 fica estável (59 → 61 → 58 negadas) e a revisão 1 cai (49 → 42 → 33) conforme os contatos são corrigidos; o teste soma duas séries com +30 por série (ver §13.3).

### 14. Fase 6 — integração com Moves, combate, projéteis e IA (`env-integration`, 26 verificações)
Auditoria cruzada: cada objeto (pilar, caixa, plataforma, destrutível) como obstáculo de Tackle, esquiva, arremesso por golpe, lutador comprimido por Tackle, projétil e feixe, e 12 partidas IA × IA em mapa denso.
- **Sem regressão nos contratos de combate:** Tackle e esquiva contra qualquer objeto terminam normalmente, com a mesma stamina e sem ganho de velocidade em relação ao espaço livre; o dano ao destrutível é aplicado uma vez por ação; arremesso contra objeto indestrutível não causa dano (rebote R3.12) e nunca gera wall-splat (só na borda); a IA obedece à mesma física (0 conflitos de espaço, 0 afundamentos no chão em 12 partidas).
- **Defeito P1 — feixe ignorava o cenário:** `traceBeam` só considerava barreiras, paredes de Move e lutadores; pilares, caixas, plataformas e destrutíveis não davam cobertura, e o limite era o quadrado legado `arenaHalf` (10,4 m) mesmo na arena circular (parede invisível). Agora o feixe usa varredura exata (`sweepRoundedBox`/`sweepCircle`) contra os sólidos do mapa e a borda circular efetiva; o quadrado legado só vale na arena quadrada. `beam.test` atualizado de propósito (o limite legado agora é medido na arena quadrada; na circular, na borda efetiva). Sem dano ao destrutível por feixe (não há regra aprovada).
- **Defeito P2 — pilar quadrado para projéteis:** projéteis tratavam `pillar` como caixa (cobertura no canto do quadrado circunscrito) enquanto lutadores colidem com o círculo. Corrigido em `blockerContact` e no teste de sobreposição de `stepProjectile`.
- **Pendências (não verificadas):** Meteor Slam e Tech Recovery junto a objetos só têm cobertura indireta (as partidas IA × IA e `physics3d`); áreas (`kind: 'area'`) não são bloqueadas por cobertura (R7.13 fala só de altura e geometria; sem regra de oclusão aprovada); dano de feixe a destrutível indefinido.

### 15. Fase 7 — ferramentas visuais, cenários de um clique, desempenho e determinismo
Guia de uso (para abrir pelo portal): [COLISOES_FERRAMENTAS_LAB.md](COLISOES_FERRAMENTAS_LAB.md).
- **Sonda de colisão** (`src/sim/collision-probe.js`): por lutador, o último contato (bloqueador: parede/barreira de Move, plataforma, obstáculo, destrutível ou borda; normal; profundidade; velocidade horizontal antes e depois) e as varreduras dos projéteis (trecho, primeiro contato, bloqueador). Fica fora do estado, do save e do replay; nada na simulação a lê (`collision-probe` + varredura do código).
- **5 sobreposições novas em «Visualizar»** (`src/view/collision-overlays.js`): Colisores do cenário, Apoio atual (`f.support` da Fase 4), Contatos com o ambiente, Varredura dos projéteis e Sobreposições e vãos; linhas novas em «Dados ao vivo» (apoio, último contato, objetos do cenário, penetração). O «Arco de lançamento previsto» agora segue a borda circular (antes usava o quadrado legado).
- **15 cenários** (`src/sim/scenarios-collision.js`), no topo da aba «Cenários» com «Executar os 15». Contra o baseline 4634ca2 (cópia temporária), 5 deles já reprovam por defeito (barreira fina, corredor sem saída, rebote em pilar, suporte de plataforma, suporte destruído); os demais são guardas de regressão e demonstrações.
- **Testes:** `collision-probe` (5), `collision-scenarios` (17), `collision-tools` (6), `collision-tools.browser` (Edge real: 5 sobreposições, grupo de cenários, 15/15 num clique, «Dados ao vivo», sem erros no console; capturas em `prototypes/combat-lab/evidence/collision-tools/`).
- **Desempenho (simulação, sem GPU):** 40 partidas IA × IA de 3600 passos em mapa denso: baseline 5,8–6,0 s × branch 6,3–7,0 s (+8 a 15 %, incluindo a sonda e os 12 rounds do `settleStatics` quando há contato); GPU real **não medida**.
- **Determinismo:** duas execuções idênticas de 30 partidas (3600 passos) produzem o mesmo relatório byte a byte; replay/save-load seguem cobertos por `map.test` (replay 100 % idêntico).

### 16. Registro de skills nesta continuação (evidência, não só rótulo)
| Skill | Para quê | Resultado |
|---|---|---|
| `requesting-code-review` (revisor independente, somente leitura) | Fase 5 (5a + 5b) e depois fases 4-fix/5b/6/7 | achados Important (flag `launchedByHit` obsoleta, arena quadrada, `placementConflicts` invisível, rótulo do multiplicador) aplicados em §13.3 |
| `receiving-code-review` | avaliar cada achado contra o código antes de aplicar | 1 item mantido como decisão do responsável (limitar rebote a 1); 1 parcialmente aplicado (rótulo de `spawnClearance`) |
| `systematic-debugging` | fuzz de partidas → causa raiz de 4 defeitos (§13.4) e do feixe/pilar (§14) | todos com teste vermelho antes da correção |
| `test-driven-development` | cada correção com teste que falha primeiro (RED medido contra o código sem a correção) | exceção registrada: `ccd.js` foi escrito antes dos testes (Fase 3) |
| `verification-before-completion` | suíte completa a cada fase (87–91 arquivos) e navegador | `npm run verify` e avaliação visual em `JOGAR_ARENAMON.html` ainda pendentes |

