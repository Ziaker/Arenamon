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
