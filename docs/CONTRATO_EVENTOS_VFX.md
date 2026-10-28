# Contrato Canônico de Eventos de Combate e VFX (CombatEvent)

**Fase F1 — Padronização de Contratos e Eventos Compartilhados**  
**Projeto Arenamon — Laboratório de Combate**

---

## 1. Visão Geral e Princípios Fundamentais

No Arenamon, a simulação (`sim/`) é determinística, discreta (passos em ticks fixos) e desacoplada da apresentação (`view/`). A comunicação de acontecimentos pontuais entre a simulação e os sistemas visuais, de áudio, câmera, telemetria e HUD ocorre exclusivamente através da lista de eventos da simulação (`events: CombatEvent[]`).

### Invariantes do Contrato
1. **Preservação Espacial Obrigatória:** Nenhuma entidade pode ser removida (`dead = true`) sem que suas coordenadas espaciais reais (`position: {x, y, z}`) e a orientação (`normal: {x, y, z}`) sejam congeladas no evento de destruição/impacto.
2. **Suporte a Eventos Ambientais:** O campo `attacker` pode ser `null` quando o impacto for provocado por forças físicas do cenário (ex.: `wallSplat` por repulsão contínua em parede ou `destructibleSplat`).
3. **Mapeamento Explícito de Resultados:** Cada `result` emitido pela simulação possui representação semântica conhecida. Eventos não catalogados nunca devem receber fallback destrutivo para `'hit'`.
4. **Despacho Visual Desacoplado:** Os motores de renderização visual (`worldView`, `vfx`, `viewLegacy`, `quarks`, `post`) consomem o evento sem alterar seus dados e sem pressupor que a entidade ainda existe no grafo da simulação no quadro seguinte.

---

## 2. Estrutura do `CombatEvent`

Cada evento gerado no hot path de combate e física obedece à assinatura canônica abaixo.

**F3.4 (implementado):** todo evento que sai de `Game.step` passa por `normalizeCombatEvent` (`prototypes/combat-lab/src/sim/events/combat-event.js`) no laço final, depois do `id` e do `tick`. A normalização é *in-place* e idempotente, acrescenta os campos canônicos e **não apaga nenhum campo legado** (a view continua lendo `attacker`, `target`, `result`, `damage`, `pos`...). `validateCombatEvent(e)` devolve a lista de violações (vazia = válido); o teste `test/f3-combat-event.test.mjs` roda todos os cenários de `scenarios*.js` e 4 partidas IA×IA exigindo zero violações.

```typescript
/** Campos canônicos garantidos pela normalização (F3.4) em todo evento de Game.step. */
interface CombatEventCanonical {
  eventId: number;                 // identidade única: contador próprio por Game (eventIdSeq), atribuído a TODO evento no laço final de Game.step;
                                   // único no passo, estritamente crescente na rodada; reset() zera; save()/load() preservam (save antigo: parte de eventSeq).
                                   // NÃO é o `id` legado (id/eventSeq seguem para o hash do replay e as passivas R31)
  tick: number;                    // passo inteiro da simulação
  outcome: string;                 // = result
  attackerId: number | null;       // attacker numérico, senão null (ambiental/sistema: sempre null)
  targetId: number | null;         // target numérico, senão null
  indirectAttackerId: number | null; // autor indireto (wall splat, destructibleSplat: último atacante), senão null
  sourceKind: 'direct' | 'environmental' | 'status' | 'reflected' | 'system';
  //   o do DamageResolver quando o evento já o tem; senão environmental (category 'environmental'),
  //   status (statusApplied/statusTick/statusExpired ou category 'periodic'), system (sem alvo lutador, ou ciclo de vida de passivas/curas), direct
  position: {x: number; y: number; z: number} | null; // a position legada fica intocada quando existe; senão CÓPIA de pos | x/y/z soltos (y ausente = 0) | null
  normal: {x: number; y?: number; z: number} | null;  // normal do contato (as normais do plano do chão podem não ter y)
  rawDamage: number;               // dano bruto pedido (padrão = hpDamage)
  hpDamage: number;                // = damage (HP efetivamente tirado; 0 sem dano)
  shieldAbsorbed: number;          // 0 padrão
}
```

Regras do validador: `eventId` número finito (o teste também exige único no passo e crescente entre passos do mesmo Game, e sequências independentes entre Games); `outcome === result`; `attackerId`/`targetId` coerentes com os legados; `sourceKind` do conjunto acima; ambiental nunca tem `attackerId` numérico; `position` com x/y/z finitos ou `null`; danos finitos ≥ 0; `hpDamage === damage` quando `damage` é número.
Nota: os eventos de mapa (`destructible*`, `item*`) usam `id` para o objeto do mapa desde antes da F3 — por isso a identidade do evento é `eventId`, nunca `id`.

A assinatura histórica (F1) abaixo continua válida para os campos legados:

```typescript
interface CombatEvent {
  /** (F1, proposta não adotada) id legível; na sim vale o canônico F3.4 acima: eventId numérico de Game.step. O id legível `vfx:...` existe só no evento visual (view/vfx/contract.js). */
  eventId?: string;

  /** Passo inteiro da simulação no qual o evento foi despachado */
  tick?: number;

  /** Categoria semântica do evento */
  kind?: 'impact' | 'defense' | 'clash' | 'splat' | 'landing' | 'status' | 'projectile' | 'barrier' | 'beam' | 'area' | 'destructible' | 'item';

  /** Resultado exato do acontecimento na simulação */
  result:
    // Combate entre lutadores
    | 'impact'             // Golpe conectado com dano pleno
    | 'partial'            // Bloqueio regular (dano reduzido, chip damage)
    | 'perfect'            // Defesa perfeita (parry)
    | 'perfectDodge'       // Esquiva perfeita (slow-mo / janela de contra-ataque)
    | 'invulnerable'       // Golpe ignorado por invulnerabilidade (dodge / iframe)
    | 'clash'              // Colisão frontal de golpes ou investidas
    | 'counter'            // Interrupção ou contra-ataque prioritário
    | 'footstool'          // Salto na cabeça do adversário
    | 'riposteStrike'      // Golpe de contra-ataque do riposte
    // Interações com o cenário e física
    | 'wallSplat'          // Impacto de lutador lançado contra a parede
    | 'destructibleSplat'  // Impacto de lutador contra rocha/objeto destrutível
    | 'bounceLand'         // Pouso com impacto de investida ou move vertical
    | 'ledgeGrab'          // Agarre físico de borda
    // Projéteis e Entidades
    | 'groundHit'          // Projétil atingiu o solo
    | 'arenaHit'           // Projétil colidiu com os limites da arena
    | 'arenaBounce'        // Projétil ricocheteou na borda da arena
    | 'destructibleHit'     // Projétil causou dano a objeto destrutível
    | 'obstacleHit'        // Projétil colidiu com obstáculo estático
    | 'platformHit'        // Projétil colidiu com plataforma
    | 'barrierBroken'      // Barreira de proteção foi quebrada por dano ou limite
    | 'blocked'            // Projétil detido por barreira
    | 'reflected'          // Projétil refletido por barreira angular
    | 'reflectCycle'       // Projétil excedeu limite máximo de reflexões
    | 'neutralized'        // Projétil anulado por choque de poder menor
    | 'stoneClash'         // Choque simétrico entre dois projéteis de pedras
    | 'tackleClash'        // Choque frontal de tackle contra projétil
    | 'detonate'           // Detonação explosiva por proximidade
    | 'fieldLost'          // Área contínua expirada ou dispersada
    | 'occluded'           // Pulso de área bloqueado por obstáculo
    | 'shielded'           // Pulso de área detido por escudo
    // Mapa e Coletáveis
    | 'destructibleDamaged'   // Dano a rocha/destrutível
    | 'destructibleDestroyed' // Destruição física de rocha/destrutível
    | 'dropSpawned'          // Item gerado por quebra de destrutível
    | 'itemCollected'        // Item recolhido por lutador
    | 'statusApplied';       // Efeito de estado aplicado a um alvo

  /** ID do lutador atacante/iniciador (0 ou 1), ou null se ambiental / sistema */
  attacker: number | null;

  /** ID do lutador alvo (0 ou 1), ou null se não houver lutador alvo */
  target: number | null;

  /** ID ou chave da entidade de suporte (projétil, barreira, rocha, feixe) */
  entity?: string | number | null;

  /** ID do Move que originou o evento (ex: 'sand-wave', 'bullet-punch', 'water-pulse') */
  move?: string | null;

  /** Ponto de contato ou posição central no espaço 3D (obrigatório para efeitos espaciais) */
  position: { x: number; y: number; z: number };

  /** Vetor normal de contato ou direção de impacto (unitário) */
  normal: { x: number; y: number; z: number };

  /** Dano numérico associado ao evento (≥ 0) */
  damage?: number;

  /** Impulso de lançamento gerado pelo impacto */
  launch?: {
    direction: { x: number; y: number; z: number };
    horizontal: number;
    vertical: number;
  } | null;

  /** Nível de poder de choque do projétil/efeito (ex: 1, 2, 3) */
  pl?: number;

  /** Metadados de superfície ('ground' | 'wall' | 'rock' | null) */
  surface?: 'ground' | 'wall' | 'rock' | null;

  /** Semente pseudo-aleatória determinística para variações de partículas */
  seed?: number;

  /** Descrição textual para depuração e painel de telemetria */
  reason?: string;
}
```

---

## 3. Contratos de Emissão por Família de Sistema

### 3.1 Combate Corpo a Corpo (`combat.js`)
- **Regra:** Todo contato de ataque emite `position` calculada pela interseção ou ponto médio ponderado dos volumes de colisão, com `normal` apontando do atacante para o defensor.
- **Guard Break:** O flag `guardBreak` da ação atacante DEVE ser verificado antes da atribuição de `recoil` e repassado ao resultado do combate (`broken: true`), disparando o stagger prolongado.
- **Footstool:** Emite `result: 'footstool'`, `attacker: f.id`, `target: o.id`, `normal: {x: 0, y: -1, z: 0}`, `position: {x: o.position.x, y: o.groundY + altura, z: o.position.z}`.

### 3.2 Impactos Ambientais (`physics.js` & `map-collision.js`)
- **Impacto em Parede (`wallSplat`):** Emite `result: 'wallSplat'`, `attacker: null` (ou atacante original se rastreado), `target: f.id`, `position: {x: f.position.x, y: f.position.y, z: f.position.z}`, `normal: normalParede`.
- **Impacto em Destrutível (`destructibleSplat`):** Emite `result: 'destructibleSplat'`, `attacker: null`, `target: f.id`, `entity: d.id`, `position: {x: d.pos.x, y: 0.6, z: d.pos.z}`, `normal: normalContato`.

### 3.3 Projéteis e Barreiras (`world.js`)
- **Captura Pré-Morte:** Antes de atribuir `p.dead = true` ou `b.dead = true`:
  ```javascript
  const impactPos = { x: p.x, y: p.y ?? 0.6, z: p.z };
  const impactNormal = p.normal ?? { x: -p.vx || 0, y: 0, z: -p.vz || 1 };
  events.push({
    result: 'barrierBroken', // ou stoneClash, neutralized, detonate
    attacker: p.owner ?? null,
    target: b.owner ?? null,
    entity: b.id,
    position: impactPos,
    x: impactPos.x,
    y: impactPos.y,
    z: impactPos.z,
    normal: impactNormal,
    damage: 0
  });
  ```
- **Compatibilidade Dual:** Os campos planos legados `x, y, z` são emitidos em conjunto com `position: {x, y, z}` para preservar total compatibilidade com shaders, anéis de onda de choque (`wv-update.js`) e a camada moderna de VFX.

---

## 4. Diretrizes de Consumo Visual (`view.js`, `vfx.js`, `wv-update.js`)

1. **Eliminação do Bloqueio por Atacante Nulo:**
   - Em `view.js:183` e `vfx.js:195`, a checagem:
     `const a = fighters[e.attacker], b = fighters[e.target]; if (!a || !b) continue;`
     é substituída por validação específica do alvo `b = fighters[e.target]`. Quando o evento for ambiental (`wallSplat`, `destructibleSplat`), a presença de `b` é suficiente para despachar o efeito de impacto na parede e o shake de câmera correspondente.
2. **Tratamento Simétrico de Choques (`clash`):**
   - O filtro `if (e.result === 'clash' && e.attacker !== 0) continue;` é padronizado para evitar perda de efeitos quando o jogador 2 ou a CPU inicia o clash.
3. **Mapeamento Abrangente de Tipos Visuais (`contract.js`):**
   - `classifyVisualType` mapeia expressamente:
     - `barrierBroken` → `'shatter'`
     - `stoneClash`, `tackleClash` → `'clash'`
     - `destructibleSplat`, `wallSplat` → `'wall'`
     - `neutralized` → `'dissipate'`
     - `footstool` → `'hit'`
     - `bounceLand` → `'ground'`

---

## 5. Garantia de Limpeza e Resets (`view.reset()` & `worldView.reset()`)

Para garantir determinismo em reinicializações e testes A/B:
- `worldView.reset()` desfaz e remove todas as instâncias vivas de `rings`, `particles`, `meshes` e estilhaços geométricos.
- `view.reset()` remove auras ativas de status, marcadores de mira (`aimMarkers`), efeitos de contra-ataque (`riposteFx`) e restaura a densidade de neblina original do cenário.

---

## 6. Ponto de contato dos projéteis (F5, Task 13 — 28/10/2026)

**Semântica de `position`:** nos eventos terminais de projétil abaixo, `x/y/z` (e portanto a `position` canônica do `normalizeCombatEvent`) é o **ponto do projétil no passo do contato**, para qualquer Move de projétil (Water Pulse, Seed Bomb, Air Slash, Swift, pedras do Psyshock…).

| Resultado | Antes (sem ponto) | Agora |
|---|---|---|
| `groundHit` | runtime: `fighters[target ?? 0]` (o lutador 0), p. ex. (0, 0, −8) | ponto do contato, p. ex. (0, 0, 0,58) |
| `destructibleHit` | runtime: origem (0, 0, 0), porque o alvo é o id do destrutível | face do destrutível, p. ex. (0, 0,65, −3,0) |
| `neutralized` | runtime: `fighters[target]` (dono da barreira, p. ex. (9, 0, 9)); anel do WorldView: malha do projétil (que já saiu, então **nenhum anel**) | ponto na barreira, p. ex. (0, 0,65, −2,17); anel branco ali |
| `arenaHit`, `obstacleHit`, `platformHit`, `detonate` | sem visual no runtime nem anel; só `movesVfx` | ponto do contato (usado pelo splash do Water Pulse) |

- **Quem muda:** o runtime novo (`adaptSimEvent`: partículas e câmera, só com `useNewVfx = true`), o anel do `neutralized` no WorldView e o splash do Water Pulse.
- **Quem não muda:** o VFX legado (padrão, `useNewVfx = false`) não lê o ponto desses eventos e tem saída idêntica (teste `f5-vfx-coords`). O QuarksBridge não consome esses resultados.
- **Acerto em lutador** (`impact`/`partial`/`perfect` de projétil): a simulação grava `contactPoint {x, y, z}` e **não** `x/z`. Assim a `position` continua nula e as faíscas de impacto de todos os golpes seguem no corpo do alvo. Só o splash do Water Pulse lê `contactPoint`.
- **Sand Wave:** `impact`/`partial`/`perfect`/`sandStagger` levam `x/z` dos pés do alvo no contato.
- **Ordem de entrega no `movesVfx`:** os eventos da entidade que sai do mundo chegam ANTES de `onDeath` (`MovesVfxRegistry.sync(…, events)`), sem repetição em `onEvent`.
