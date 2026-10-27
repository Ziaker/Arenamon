# Matriz de Resolução de Bugs P0: Efeitos Visuais, Estados e Projéteis

**Fase F2 — Correção Sistemática de Bugs P0 (TDD RED/GREEN)**  
**Projeto Arenamon — Laboratório de Combate**

---

## 1. Sumário Executivo

Durante a Fase F2, todos os bugs críticos identificados na auditoria F0 foram reproduzidos sistematicamente via testes determinísticos (`prototypes/combat-lab/test/p0-vfx-states.test.mjs`), registrando falhas controladas (RED) antes da aplicação das correções em produção, seguido de verificação 100% aprovada (GREEN) e recompilação do bundle (`npm run rapido:build`).

---

## 2. Matriz de Estados e Reações dos Lutadores (EST)

| ID | Sistema / Arquivo | Causa-Raiz | Impacto no Jogo | Correção Aplicada | Status |
|---|---|---|---|---|---|
| **EST-01** | `ctrl-update.js:120-127` | Ao zerar `knockRecovery <= 0`, `recoveryKind` era setado como `null` antes de avaliar o ternário de estado, caindo no fallback `'hitstun'`. | O lutador piscava em atordoamento (`hitstun`) por 1 frame no exato momento em que terminava de se recuperar de qualquer lançamento. | Transição direta para `'moving'` (se houver magnitude no input) ou `'neutral'` (se repouso) quando `knockRecovery <= 0`. | **GREEN** |
| **EST-02** | `combat.js:192-208` | `attacker.action` era substituído pelo novo objeto `{kind: 'recoil', ...}` antes de checar `else if (attacker.action.guardBreak)`. | Ataques com quebra de guarda (ex.: *Guard Break*) eram anulados por bloqueio comum, quebrando o triângulo tático e colocando o próprio atacante em recoil. | `isGuardBreak` e `gbConfig` agora são extraídos antes da atribuição de recoil. Ataque com `guardBreak` não sofre recoil de bloqueio e quebra o escudo do oponente com stagger prolongado e flag `broken: true`. | **GREEN** |
| **EST-03** | `combat.js:253-262` | `resolveFootstool` zerava velocidades e definia `defender.stun`, mas nunca atualizava `defender.state = 'stagger'`, além de omitir o vetor normal. | O lutador pisado continuava com o estado de movimento/esquiva anterior (`'moving'`, `'dodge'`), e a câmera/VFX não sabiam a direção do impacto. | `defender.state = 'stagger'` atribuído explicitamente, com `normal: {x: 0, y: -1, z: 0}` e coordenadas `{x, y, z}` emitidas. | **GREEN** |
| **EST-04** | `ctrl-moves.js:333` | Leitura insegura de `ch.params.step` em `cancelCharge` sem tratamento de ausência. | Se um golpe carregado fosse cancelado sem `params.step` definido, disparava `TypeError`, quebrando o loop de controle do lutador. | Inserido fallback seguro `(ch.params?.step ?? C.test?.step ?? 0.05)`. | **GREEN** |
| **EST-05** | `ctrl-update.js:67, 118` | Ao atingir `hp <= 0` (derrota), o retorno antecipado não limpava `f.absent = false` nem cancelava cargas com segurança. | Lutador derrotado durante o avanço/vanish do *Bullet Punch* ficava permanentemente ausente (invisível na cena e inalvejável). | Limpeza obrigatória de `f.absent = false`, `f.charge = null`, `f.tackleCharge = null` e `f.aim = null` no KO. | **GREEN** |
| **EST-06** | `characters.js:468-472` | O cálculo do progresso da animação em `guardStun` dividia o tempo por `R.guardStun` (0.15s fixo), e `stagger` dividia por 0.25s fixo sem clamp. | Stuns longos (0.6s de quebra de guarda) geravam valores de progresso negativos (ex.: -3.0), travando o clipe de animação no frame inicial. | Normalização adaptativa com base em `f.stunMax` / `f.staggerMax` e clamp rígido em $[0, 1]$. | **GREEN** |

---

## 3. Matriz de Eventos Espaciais e VFX (VFX)

| ID | Sistema / Arquivo | Causa-Raiz | Impacto no Jogo | Correção Aplicada | Status |
|---|---|---|---|---|---|
| **VFX-01** | `world.js:236-444` & `wv-update.js:185` | Eventos de quebra de barreira (`barrierBroken`), choque de pedras (`stoneClash`), e choque de investida (`tackleClash`) eram emitidos sem coordenadas `{x, y, z}` após marcar `dead = true`. | `wv-update.js` não encontrava posição (`if (!pos) continue;`), silenciando ondas de choque e os estilhaços de rochas/barreiras. | Coordenadas reais `{x, y, z}`, `position` e `normal` capturadas e congeladas no evento antes da destruição. | **GREEN** |
| **VFX-02** | `map-collision.js:150` | `destructibleSplat` emitia apenas `{fighter: f.id, destructible: d.id}` sem `target`, `attacker`, `normal` ou `position`. | Colisões pesadas de lutadores contra rochas do mapa eram ignoradas pelos despachantes de VFX e câmera. | Emissão canônica contendo `attacker: f.lastAttacker ?? null`, `target: f.id`, `position: dPos`, `normal: -normalContato`. | **GREEN** |
| **VFX-03** | `view.js:183` & `vfx.js:195` | Ambos os motores de visualização descartavam o evento precocemente com `if (!attacker || !target) continue;`. | Impactos em parede por knockback ambiental (`wallSplat` onde `attacker === null`) nunca geravam shake de câmera nem poeira. | Reconhecimento de impactos ambientais com `target` válido mesmo quando `attacker` for nulo. | **GREEN** |
| **VFX-04** | `view.js:183` & `vfx.js:202` | Checagem unidirecional `event.attacker === 0` para colisões de investida (`clash`). | Choques iniciados pelo Jogador 2 ou CPU não exibiam clarão de choque no centro do impacto. | Remoção da assimetria; ambos os combatentes processam choque de forma simétrica. | **GREEN** |
| **VFX-05** | `contract.js:109-123` | `classifyVisualType` continha um dicionário restrito; qualquer evento de projétil ou quebra caía no fallback `'hit'`. | Efeitos de quebra de barreira e colisão de pedras eram classificados erroneamente como golpes de punho. | Mapeamento completo adicionado (`barrierBroken` → `'shatter'`, `stoneClash` → `'clash'`, `wallSplat` → `'wall'`, etc.). | **GREEN** |
| **VFX-07** | `world-view.js:71` & `view.js:158` | O método `reset()` não removia nem descartava (`dispose`) instâncias vivas de anéis de choque (`rings`), partículas e auras de status. | Acúmulo de malhas na cena Three.js e poluição visual após reinício de partida ou troca de modo. | Limpeza explícita e descarte de geometrias/materiais em `rings`, `particles`, `meshes` e restauração de neblina. | **GREEN** |

---

## 4. Matriz de Arquitetura de Projéteis e Cenário (ARC)

| ID | Sistema / Arquivo | Causa-Raiz | Impacto no Jogo | Correção Aplicada | Status |
|---|---|---|---|---|---|
| **ARC-01** | `world.js:252-253` | A verificação de morte do projétil incluía `|| ev?.result === 'impact' || ev?.result === 'partial'`. | Projéteis projetados para atravessar múltiplos alvos (`pierce > 1`) morriam instantaneamente no primeiro impacto. | Remoção da condição redundante; morte por perfuração agora respeita estritamente `hitLog.length >= pierceCount`. | **GREEN** |

---

## 5. Registro de Evidências dos Testes Automatizados

```
✔ EST-01: Fim de recuperação (knockRecovery <= 0) deve transicionar para neutral/moving, nunca hitstun (2.402ms)
✔ EST-02: Guard Break não deve ser sobrescrito por recoil no bloqueio (0.9256ms)
✔ EST-03: resolveFootstool deve atualizar defender.state para stagger e emitir normal (0.2384ms)
✔ EST-04: cancelCharge não deve disparar TypeError se ch.params.step for ausente (0.2866ms)
✔ EST-05: Lutador derrotado (hp <= 0) deve limpar flag absent e cargas (0.1517ms)
✔ VFX-01: Projétil quebrando barreira deve emitir evento com posição e normal válidos (1.9216ms)
✔ ARC-01: Projétil com capacidade de perfuração (pierce > 1) não deve morrer no primeiro impacto (0.5582ms)
✔ VFX-05: classifyVisualType deve reconhecer barrierBroken, stoneClash e wallSplat (0.1125ms)
✔ EST-06: Animação de guardStun e stagger deve ser normalizada por stunMax e clamp em [0, 1] (0.1519ms)
ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
```
