# Matriz Canônica de Colisões, Knockback e Superfícies de Apoio

**Fase F3 — Padronização de Reações, Knockback e Pouso**  
**Projeto Arenamon — Laboratório de Combate**

---

## 1. Separação Estrita dos 3 Pipelines de Knockback

Para evitar que impulsos instantâneos interfiram com forças contínuas ou movimentos de animação, o Arenamon padroniza três pipelines mecânicos mutuamente exclusivos:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ PIPELINE 1: IMPULSO BALÍSTICO / LAUNCH (f.flight)                        │
│ • Origem: Golpes com lançamento (launch), Meteor Slam, golpes pesados.    │
│ • Estado: 'airborne'                                                      │
│ • Dinâmica: Gravidade física ativa, parábola balística, integração CCD.  │
│ • Finalização: Chamada física real a land() ao cruzar a superfície.       │
├───────────────────────────────────────────────────────────────────────────┤
│ PIPELINE 2: FORÇA CONTÍNUA NO SOLO (f.push / f.sandPush)                 │
│ • Origem: Repulsão de Sand Wave, deslize de bloqueio de Slam, recuo.     │
│ • Estado: 'pushed'                                                        │
│ • Dinâmica: Deslocamento no plano XZ restrito por colisão de parede/rocha.│
│ • Finalização: Expiração temporal de f.knockRecovery / f.push.duration.   │
├───────────────────────────────────────────────────────────────────────────┤
│ PIPELINE 3: MOVIMENTO COREOGRAFADO (f.locomotionVelocity)                 │
│ • Origem: Lunge, Quick Attack, esquiva lateral, avanço com raiz.         │
│ • Estado: 'move' / 'dodge'                                                │
│ • Dinâmica: Orientado por curvas de animação mantendo o lutador no solo.  │
│ • Finalização: Conclusão do timeline da habilidade ou finta voluntária.   │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Invariantes de Pouso Físico Real (`landing`)

A transição para o estado `landing` obedece a critérios de aceitação rigorosos:

1. **Apenas Pouso Real Produz Landing:** A chamada ao método `land(f, flight, targetGround)` em `physics.js` é a **única** via autorizada a gerar `f.lastLanding` e transicionar o lutador para `state = 'landing'`.
2. **Pulos e Quedas Voluntárias (`wasNormalJump`):**
   - Transicionam diretamente para `'neutral'`.
   - Recuperação de pouso é zerada (`rec = 0`).
   - Efeito visual emitido é apenas a onda circular simples de impacto suave (`regular: true`), sem screen-shake destrutivo.
3. **Pouso de Lançamento por Dano (`launchedByHit`):**
   - Aplica tempo de recuperação `R.landingRecovery * stunFactor`.
   - Permite *Tech Recovery* (esquiva rápida pressionando Esquiva/C com stamina antes do contato com o solo).
   - O visual reproduz poeira de colisão com o solo proporcional à velocidade de impacto vertical $|v_y|$.
4. **Fim de Recuperação Seguro:**
   - Ao zerar `f.knockRecovery <= 0`, o lutador transiciona para `'moving'` (se houver comando direcional ativo) ou `'neutral'`.
   - É estritamente proibido qualquer fallback intermediário para `'hitstun'`.

---

## 3. Matriz de Colisões com Obstáculos e Cenário

| Elemento do Cenário | Interação com Lutador | Interação com Projétil | Evento Emitido | Reação Física |
|---|---|---|---|---|
| **Parede da Arena** | Impede translação; colisão contínua gera deslize. | Ricocheteia se refletor; destrói se comum. | `arenaHit` / `arenaBounce` / `wallSplat` | Se lutador lançado em alta velocidade horizontal: gruda na parede (`wallSplat`) por janela breve. |
| **Plataformas Elevadas** | Suporte sólido no topo ($y \ge \text{topo}$); permeável por baixo. | Colisão com face superior se não perfurante. | `platformHit` | Ajusta `f.groundY` para a altitude do topo da plataforma. |
| **Rochas Destrutíveis** | Colisor estático sólido; quebra com dano acumulado ou impacto pesado. | Absorve dano do projétil; quebra ao zerar HP. | `destructibleHit` / `destructibleSplat` / `destructibleDestroyed` | Lutador lançado contra a rocha sofre dano por impacto e gera partículas de estilhaço de pedra. |
| **Barreiras (Reflect)** | Bloqueia passagem de oponentes; vulnerável a *Tackle* e explosões. | Reflete projéteis de PL igual/menor; destrói com PL superior. | `blocked` / `reflected` / `barrierBroken` / `neutralized` | Projétil tem dono invertido e vetor de velocidade refletido pela normal da face atingida. |

---

## 4. Prevenção de Penetrações e Tunelamento (CCD)

Para garantir que personagens e projéteis rápidos não atravessem sólidos em taxas de quadro variáveis:
- Projéteis utilizam varredura volumétrica contínua (`sweepBox` / `firstContact`).
- Em caso de múltiplos contatos no mesmo passo, a resolução ocorre em ordem física temporal estrita (menor $t \in [0, 1]$).
- Lutadores empurrados contra paredes pelo *Sand Wave* ou *Meteor Slam* têm sua translação limitada pelo plano de contato da parede antes de qualquer aplicação de dano residual.

---

## 5. O que está implementado hoje (F3–F9, atualizado em 29/10/2026)

| Item | Código | Teste | Commit |
|---|---|---|---|
| Consultas de colisão únicas **para visão, navegação, projéteis do mundo e altura do chão** (`getCeilingHeight` e `map/map-collision.js` NÃO foram migrados e seguem com a resolução própria): `solidsOf(mapState, world, {platforms, barriers, destructibles})`, `pointInSolid`, `segmentClear` (amostragem de 0,2 m mantida para não mudar a IA), `navSolidsOf`, `insideFootprint`, `groundSurface`, `groundHeightAt`, `closestOnShape` | `src/sim/collision/queries.js` (consumidos por `vision.js`, `nav/nav-graph.js`, `world.js`, `map/map-step.js`, `physics.js`) | `f4-collider-queries.test.mjs` (oráculo com 5 sementes: resultado idêntico às cópias antigas) | 3fb7a64 |
| Spawn validado com recusa determinística (espiral sem sortear; o RNG fica igual) | `src/sim/map/map-spawn.js` (`placeOrReject`, `nearestValidInArena`) | `f4-spawn.test.mjs` (oráculo de 250 sementes) | 536af4b |
| Solver: penetração residual medida (`physicsProbe.staticResidualMax` por passo, `staticResidualPeak` acumulado, mostrados no painel ao vivo) e escape `pinEscape` acima de 0,02 m (busca própria em anéis de 0,1 m até 4 m, com fallback para a arena inteira) | `src/sim/physics.js`, `src/sim/collision-probe.js`, `src/app/live-panels.js` | `f4-solver.test.mjs` | ad4973b, db5222e |
| Projétil varrido contra lutadores no subpasso (antes só sobreposição no fim): corrige o tunelamento ao raspar quina (24 de 1.968 casos) | `src/sim/world.js` | `f4-geometry-gate.test.mjs` (120 m/s contra lutador parado sempre acerta; pierce 2; ricochete radial) | db5222e |
| Gate geométrico: salto sobre plataforma de 1,0 e 1,5 m só pousa com contato real; queda pela borda mantém vx/vz e cai balística; mapa reembaralhado sem interseção | — | `f4-geometry-gate.test.mjs` (14 cenários) | db5222e |
| `C.test.penetrationTolerance` (tolerância técnica, sem slider): o reset de configuração devolve o valor embutido (0,02 m) | `src/sim/config.js` (`resetConfig`) | `f4-solver.test.mjs` | F9 (este commit) |

**Limites conhecidos (não alterados):** a ordem lutador × parede no mesmo subpasso segue a ordem do laço, não o instante de impacto. O arrasto `launchDrag` age na queda pela borda, o que é uma decisão de gameplay. O efeito colateral da varredura de projéteis (2 acertos de raspão novos em 200 lutas) explica a guarda estatística do `ai-eval` que falha (ver o relatório final).

Também (revisão final do branch):
1. **Itens no meio da partida** buscam posição em 10 anéis (antes 8). Um item que antes era recusado pode nascer agora: é uma mudança pequena de gameplay.
2. **`getCeilingHeight` e `map/map-collision.js` não foram migrados** para `collision/queries.js`. A unificação vale para visão, navegação, projéteis do mundo e altura do chão.
3. **Renascimento de destrutível** tenta a cada passo e consome RNG. É um bug anterior ao overhaul, mantido para não mudar os replays.
4. **`collision-multi`**: a expectativa mudou de «sem teletransporte» para «escape ≤ 1,15 m». A mudança é intencional (Task 8, escape de imprensamento).
5. **Eventos só com x/z** (`sandStagger`, acerto do Sand Wave, `bounceLand`): o normalizador preenche `position.y = 0`. O runtime novo (`useNewVfx`, desligado por padrão) desenha no nível do chão; os anéis do WorldView usam `ev.y ?? .6`. O modo padrão não é afetado.
