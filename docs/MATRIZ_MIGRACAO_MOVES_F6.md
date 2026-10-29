# Matriz de migração dos Moves (F6)

> GERADO por `scripts/gen-matriz-moves-f6.mjs` a partir de `prototypes/combat-lab/test/f6-moves-contract-lib.mjs` (cenários reais em 120 Hz, semente fixa).
> Não edite à mão: o teste `prototypes/combat-lab/test/f6-moves-contract.test.mjs` falha se este arquivo estiver desatualizado. Regere com `node scripts/gen-matriz-moves-f6.mjs`.

Moves no registro: **19** (lidos de `listMoves()` depois de `registerStandardMoves()`; lista em `docs/INDICE_VIVO_MOVES.md`) + Tackle (ação base) como referência do grupo corpo a corpo.

O que cada linha prova (cenário executado, não declaração):

- **(a) evento canônico** — todo evento de dano em lutador tem `move`, `sourceKind`, `rawDamage`, `hpDamage`, `shieldAbsorbed`, `normal`, âncora do VFX (`position`, `contactPoint` ou o corpo do alvo, `docs/CONTRATO_EVENTOS_VFX.md` §6) e passa em `validateCombatEvent`;
- **(b) conservação** — por passo e por lutador, a queda de HP/escudo é exatamente a soma das transações de `resolveDamage` (livro `damageLedger`) e a soma de `rawDamage/hpDamage/shieldAbsorbed` dos eventos fecha com elas;
- **(c) sem escudo/defesa próprios** — nenhum arquivo de `src/sim` fora de `resolvers/` escreve HP/escudo nem lê `guardDamageMultiplier`/`stageDefenseReduction` sem entrada justificada (tabelas no fim);
- **(d) deslocamento declarado** — todo evento de dano declara `displacementPolicy` (`impulse` | `force` | `displacement` | `none`) e lançamento nunca vem com `none`.

Grupos do DOCX §13. «Parâmetros» = linhas da ficha no editor; a cobertura de consumidor por parâmetro (presente, persistido, A/B visível e consumido pelo Move real) é a Task 15 (F7).

## Contato corpo a corpo e counters

| Move | Cenário | Caminho do dano | Deslocamento (policy) | Eventos do lançador | VFX (dono) | Parâmetros | Consumidores (Task 15) | Status |
|---|---|---|---|---|---|---|---|---|
| `tackle` (ação base) | azul dá um Tackle (X) no vermelho parado a 2 m | tackle → combat.js resolveHit → resolveDamage (1 evento(s), 1 transação(ões); sourceKind direct; move null; âncora corpo do alvo) | impulse (impact) | impact | personagem (corpo a corpo, sem entidade); partículas impact→vfx | 0 | pendente (Task 15) | ok |
| `quick-attack` | azul usa quick-attack (tap) contra o vermelho parado a 3 m, alvo travado | tackle → combat.js resolveHit → resolveDamage (1 evento(s), 1 transação(ões); sourceKind direct; move quick-attack; âncora corpo do alvo) | displacement (impact) | aimStart, impact | personagem (corpo a corpo, sem entidade); partículas impact→vfx | 18 | pendente (Task 15) | ok |
| `bullet-punch` | azul usa bullet-punch (aim) contra o vermelho parado a 3 m, alvo travado | tackle → combat.js resolveHit → resolveDamage (1 evento(s), 1 transação(ões); sourceKind direct; move bullet-punch; âncora corpo do alvo) | impulse (impact) | aimStart, bulletVanish, bulletReturn, impact | movesVfx (src/sim/moves/bullet-punch/bullet-punch.vfx.js); partículas impact→vfx | 21 | pendente (Task 15) | ok |
| `guard-break` | azul usa guard-break (charge) contra o vermelho parado a 3 m, alvo travado | tackle → combat.js resolveHit → resolveDamage (1 evento(s), 1 transação(ões); sourceKind direct; move guard-break; âncora corpo do alvo) | displacement (impact) | chargeStart, chargeRelease, impact | personagem (corpo a corpo, sem entidade); partículas impact→vfx | 14 | pendente (Task 15) | ok |
| `feint` | azul usa Feint sem ataque em curso: recuo curto com i-frames (sem dano) | sem dano próprio (0 transação(ões)) | none | feint | world-view / compartilhado | 10 | pendente (Task 15) | ok |
| `riposte` | azul abre o Riposte; o vermelho (2 m) dispara 1 estrela do Swift dentro da janela; o contra-golpe acerta o vermelho | tackle → combat.js resolveHit → resolveDamage (1 evento(s), 1 transação(ões); sourceKind direct; move riposte; âncora corpo do alvo) | impulse (impact) | riposte, riposteStrike, impact | personagem (corpo a corpo, sem entidade); partículas impact→vfx | 18 | pendente (Task 15) | ok |
| `lunge` | azul usa lunge (tap) contra o vermelho parado a 3 m, alvo travado | tackle → combat.js resolveHit → resolveDamage (1 evento(s), 1 transação(ões); sourceKind direct; move lunge; âncora corpo do alvo) | displacement (impact) | impact | personagem (corpo a corpo, sem entidade); partículas impact→vfx | 11 | pendente (Task 15) | ok |

## Projéteis, feixes e áreas

| Move | Cenário | Caminho do dano | Deslocamento (policy) | Eventos do lançador | VFX (dono) | Parâmetros | Consumidores (Task 15) | Status |
|---|---|---|---|---|---|---|---|---|
| `water-pulse` | azul usa water-pulse (charge) contra o vermelho parado a 3 m, alvo travado | projectile → world-hit.js applyHit → resolveDamage (1 evento(s), 1 transação(ões); sourceKind direct; move water-pulse; âncora contactPoint) | displacement (impact) | chargeStart, chargeRelease, spawn, moveEffect, impact | movesVfx (src/sim/moves/water-pulse/water-pulse.vfx.js); partículas impact→vfx | 23 | pendente (Task 15) | ok |
| `swift` | azul usa swift (tap) contra o vermelho parado a 3 m, alvo travado | projectile → world-hit.js applyHit → resolveDamage (3 evento(s), 3 transação(ões); sourceKind direct; move swift; âncora contactPoint) | displacement (impact) | spawn, impact | atelier-game (voleio quarks) + world-view; partículas impact→vfx | 24 | pendente (Task 15) | ok |
| `psyshock` | azul usa psyshock (charge) contra o vermelho parado a 3 m, alvo travado | projectile → world-hit.js applyHit → resolveDamage (3 evento(s), 3 transação(ões); sourceKind direct; move psyshock; âncora contactPoint) | displacement (impact) | chargeStart, chargeRelease, spawn, impact | atelier-game (voleio quarks) + world-view; partículas impact→vfx | 35 | pendente (Task 15) | ok |
| `seed-bomb` | azul usa seed-bomb (aim) contra o vermelho parado a 3 m, alvo travado | area → world-hit.js applyHit → resolveDamage (1 evento(s), 1 transação(ões); sourceKind direct; move seed-bomb; âncora corpo do alvo) | impulse (impact) | aimStart, aimConfirm, spawn, moveEffect, detonate, impact, expire | elemental-game (quarks) + world-view; partículas impact→vfx | 29 | pendente (Task 15) | ok |
| `air-slash` | azul usa air-slash (tap) contra o vermelho parado a 3 m, alvo travado | projectile → world-hit.js applyHit → resolveDamage (1 evento(s), 1 transação(ões); sourceKind direct; move air-slash; âncora contactPoint) | displacement (impact) | spawn, moveEffect, impact | elemental-game (quarks) + world-view; partículas impact→vfx | 20 | pendente (Task 15) | ok |
| `fire-spin` | azul usa fire-spin (aim) contra o vermelho parado a 3 m, alvo travado | area → world-hit.js applyHit → resolveDamage (4 evento(s), 4 transação(ões); sourceKind direct; move fire-spin; âncora corpo do alvo) | none | aimStart, aimConfirm, spawn, impact, expire | elemental-game (quarks) + world-view; partículas impact→vfx | 26 | pendente (Task 15) | ok |
| `spikes` | azul confirma o marcador do Spikes 3 m à frente; o vermelho anda até a armadilha e a aciona | trap → world-hit.js applyHit → resolveDamage (1 evento(s), 1 transação(ões); sourceKind direct; move spikes; âncora corpo do alvo) | none | aimStart, aimConfirm, spawn, impact, trapTrigger | world-view / compartilhado; partículas impact→vfx | 21 | pendente (Task 15) | ok |
| `bounce` | azul usa bounce (charge) contra o vermelho parado a 3 m, alvo travado | bounce → world-hit.js applyHit (bounce.js) → resolveDamage (1 evento(s), 1 transação(ões); sourceKind direct; move bounce; âncora corpo do alvo) | impulse (impact) | chargeStart, chargeRelease, moveEffect, impact, bounceLand | personagem (corpo a corpo, sem entidade); partículas impact→vfx | 16 | pendente (Task 15) | ok |

## Terreno, escudos e buff

| Move | Cenário | Caminho do dano | Deslocamento (policy) | Eventos do lançador | VFX (dono) | Parâmetros | Consumidores (Task 15) | Status |
|---|---|---|---|---|---|---|---|---|
| `sand-wave` | azul usa sand-wave (tap) contra o vermelho parado a 3 m, alvo travado | area → world-hit.js applyHit → resolveDamage (1 evento(s), 1 transação(ões); sourceKind direct; move sand-wave; âncora position) | force (impact) | spawn, impact, blinded, expire | movesVfx (src/sim/moves/sand-wave/sand-wave.vfx.js); partículas impact→vfx | 51 | pendente (Task 15) | ok |
| `emerging-stone` | azul usa emerging-stone (aim) contra o vermelho parado a 3 m, alvo travado | area → world-hit.js applyHit → resolveDamage (1 evento(s), 1 transação(ões); sourceKind direct; move emerging-stone; âncora corpo do alvo) | displacement (impact), impulse (rockLaunch) | aimStart, aimConfirm, spawn, stoneBlast, impact, rockCreated, rockLaunch | world-view / compartilhado; partículas impact→vfx | 35 | pendente (Task 15) | ok |
| `harden` | azul usa Harden; 0,5 s depois o vermelho dá um Tackle nele (dano reduzido pelo status, sem knockback ofensivo) | sem dano próprio; dano do agressor auxiliar: tackle → combat.js resolveHit → resolveDamage (1 evento(s), 1 transação(ões); sourceKind direct; move null; âncora corpo do alvo) | none | moveEffect, impact | world-view / compartilhado | 6 | pendente (Task 15) | ok |
| `second-wind` | azul usa Second Wind (buff de stamina/mobilidade; sem dano) | sem dano próprio (0 transação(ões)) | none | moveEffect, statusTick | world-view / compartilhado | 7 | pendente (Task 15) | ok |
| `reflect` | azul carrega Reflect 1,5 s; o vermelho dispara Swift travado no azul; as estrelas refletidas ferem o vermelho | projectile → world-hit.js applyHit → resolveDamage (1 evento(s), 1 transação(ões); sourceKind direct; move swift; âncora contactPoint) | displacement (impact) | chargeStart, chargeRelease, spawn, reflected, impact, groundHit, expire | world-view / compartilhado; partículas impact→vfx | 26 | pendente (Task 15) | ok |

## Escrita de HP/escudo fora de `resolvers/` (lista justificada)

| Arquivo | Trecho | Motivo |
|---|---|---|
| `prototypes/combat-lab/src/sim/map/map-consumables.js` | `fighter\.hp \+= amount\|fighter\.hp = maxHp` | cura do consumível (Poção): ganho de HP, não dano |
| `prototypes/combat-lab/src/sim/map/map-consumables.js` | `fighter\.shield\.hp = Math\.min\(maxCap` | concessão do escudo do consumível (applyShield) |
| `prototypes/combat-lab/src/sim/map/map-consumables.js` | `fighter\.shield\.hp = 0;` | expiração do escudo por tempo (tickShield), não dano |
| `prototypes/combat-lab/src/sim/passive-engine.js` | `owner\.hp = Math\.min\(owner\.attributes\.hp, owner\.hp \+ p\.heal\)` | cura de passiva (heal), não dano |
| `prototypes/combat-lab/src/sim/status.js` | `if \(heal\) f\.hp = Math\.min\(f\.attributes\.hp, f\.hp \+ heal\)` | cura periódica de status, não dano (o dano periódico vai por resolveDamage) |
| `prototypes/combat-lab/src/sim/map/map-damage.js` | `destructible\.hp = Math\.max\(0, destructible\.hp - ` | HP de destrutível (entidade do mapa), não de lutador |
| `prototypes/combat-lab/src/sim/map/map-step.js` | `d\.hp = d\.maxHp` | renascimento de destrutível |
| `prototypes/combat-lab/src/sim/stone.js` | `d\.hp = 0` | destrutível destruído pela Emerging Stone (entidade do mapa) |
| `prototypes/combat-lab/src/sim/world.js` | `b\.hp -= p\.hit\?\.damage` | HP de barreira (entidade do mundo) atingida por projétil |
| `prototypes/combat-lab/src/sim/scenarios-collision.js` | `\.hp = 30` | montagem do estado inicial de cenário técnico (não roda na partida) |
| `prototypes/combat-lab/src/sim/scenarios-map.js` | `\.hp = ` | montagem do estado inicial de cenário técnico (não roda na partida) |
| `prototypes/combat-lab/src/sim/scenarios-map.js` | `\.shield = \{hp: \d+, duration: [\d.]+, maxHp: 80\};` | escudo inicial montado no cenário técnico (não roda na partida); pego pela varredura endurecida da F9 |
| `prototypes/combat-lab/src/sim/scenarios-passives.js` | `\.hp = ` | montagem do estado inicial de cenário técnico (não roda na partida) |

Nenhuma escrita fora da lista.

## Guarda/estágio de Defesa fora do resolvedor (lista justificada)

| Arquivo | Trecho | Motivo |
|---|---|---|
| `prototypes/combat-lab/src/sim/config.js` | `guardDamageMultiplier: \.5` | valor de fábrica (config) |
| `prototypes/combat-lab/src/sim/map/map-config.js` | `stageDefenseReduction: 0\.10` | valor de fábrica (config do mapa) |
| `prototypes/combat-lab/src/sim/combat.js` | `const defStageKnockbackMult = ` | estágio de Defesa reduz o KNOCKBACK do Tackle (R6.11) — reação, não dano; o dano já saiu do resolvedor |
| `prototypes/combat-lab/src/sim/moves/move-mechanics-audit.js` | `path: 'extras\.combat\.guardDamageMultiplier'` | catálogo da auditoria (texto do caminho do parâmetro) |
| `prototypes/combat-lab/src/sim/scenarios-tackle.js` | `guardDamageMultiplier` | oráculo do cenário técnico (valor esperado), não aplica dano |
| `prototypes/combat-lab/src/sim/scenarios.js` | `guardDamageMultiplier` | oráculo do cenário técnico (valor esperado), não aplica dano |

Nenhuma leitura fora da lista.
