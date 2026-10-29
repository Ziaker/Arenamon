# ARENAMON — AUDITORIA DE CONTRATOS E DUPLICAÇÕES (FASE F0 · BASELINE)

> **Documento oficial de conformidade técnica — Diretriz P0**  
> **Data:** 27 de Outubro de 2026  
> **Branch:** `main` | **HEAD Commit:** `9175bfe23342854a7a1820e83ea3605f0346d5bc`  
> **Worktree:** `C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon`  
> **Fonte primária:** `Arenamon_Padronizacao(1).docx`  

---

## 1. Verificação de Ambiente, Superpowers e Skills

### 1.1 Status das Superpowers (Engenharia de Software)
Em conformidade estrita com o protocolo de honestidade e verificação antes da execução, foi realizada varredura no ambiente e nos diretórios de configuração:
- `systematic-debugging`: **NÃO INSTALADA COMO PLUGIN/SKILL AVULSA**
- `test-driven-development`: **NÃO INSTALADA COMO PLUGIN/SKILL AVULSA**
- `writing-plans`: **NÃO INSTALADA COMO PLUGIN/SKILL AVULSA**
- `verification-before-completion`: **NÃO INSTALADA COMO PLUGIN/SKILL AVULSA**
- `requesting-code-review`: **NÃO INSTALADA COMO PLUGIN/SKILL AVULSA**
- `executing-plans`: **NÃO INSTALADA COMO PLUGIN/SKILL AVULSA**
- `subagent-driven-development`: **NÃO INSTALADA COMO PLUGIN/SKILL AVULSA**
- `brainstorming`: **NÃO INSTALADA COMO PLUGIN/SKILL AVULSA**

*Diretriz adotada:* Os princípios metodológicos dessas ferramentas (investigação de causa-raiz antes de tocar código, ciclos estritos RED/GREEN, portões de aceite bloqueantes, validação independente sem declarar conclusão prematura) serão executados nativamente durante todo o processo.

### 1.2 Skills de Game Development Efetivamente Carregadas
As seguintes skills foram inspecionadas em seus arquivos `SKILL.md` e registradas:

| Skill | Caminho Completo | Justificativa Técnica da Seleção |
|---|---|---|
| **`arenamon-routing`** | `C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon\.agents\skills\arenamon-routing\SKILL.md` | Roteador oficial do Arenamon; estabelece prioridade do `AGENTS.md` e stack Three.js 0.186 sem React. |
| **`physics-tuning`** | `C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon\.agents\skills\physics-tuning\SKILL.md` | Base para separação entre fixed timestep (120 Hz) e render, CCD, resolução de penetração, impulso vs força. |
| **`game-feel`** | `C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon\.agents\skills\game-feel\SKILL.md` | Diretrizes de camadas de impacto (hitstop, screen shake, decaimento quadrático de trauma), sem mascarar bugs físicos. |
| **`camera-systems`** | `C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon\.agents\skills\camera-systems\SKILL.md` | Enquadramento cinematográfico, desacoplamento entre rig e tremor, prevenção de jitter. |
| **`performance-optimization`** | `C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon\.agents\skills\performance-optimization\SKILL.md` | Métricas de orçamento de quadro (8.33 ms @ 120 Hz, 16.67 ms @ 60 Hz), pooling de malhas e controle de vazamentos Three.js. |
| **`router`** | `C:\Users\zerke\OneDrive\Área de Trabalho\Arenamon\.agents\skills\router\SKILL.md` | Identificação de fingerprint do projeto (Three.js WebGL / offline bundler). |

---

## 2. Diagnóstico do Repositório e Runtime Real

- **Ponto de entrada do usuário:** `JOGAR_ARENAMON.html` -> aponta diretamente para `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html`.
- **Portal Geral:** `ABRIR_ARENAMON.html` na raiz do repositório.
- **Configuração de Runtime Real:**
  - `this.useNewVfx = false` em `src/view/view.js:89` — o `VfxRuntime` declarativo novo permanece inativo por padrão; o sistema ativo em produção é o `VfxSystem` legado em `src/view/vfx.js`.
  - `three.quarks` roda condicionalmente sob demanda via `C.vfx.quarks.enabled`.
  - `MovesVfxRegistry` gerencia exclusivamente 3 Moves pilotos: `sand-wave`, `bullet-punch`, `water-pulse`. Para o `bullet-punch`, `cfg.atelierVfx === 1` está desativado por padrão (`0`), utilizando o caminho leve de linhas de velocidade (`aim-marker-view.js`).
- **Arquivos não commitados:** Pasta não rastreada `dumper test/` (preservada intacta).

---

## 3. Matriz de Auditoria dos Achados F0 (Confronto Código Real vs DOCX)

### 3.1 Achados de Estados e Reações (EST-01 a EST-06)

| ID | Classificação Real | Arquivo e Linha | Diagnóstico Técnico |
|---|---|---|---|
| **EST-01** | **CONFIRMADO** | `src/sim/controller/ctrl-update.js:120-125` | Ao zerar `f.knockRecovery <= 0`, zera `f.recoveryKind = null`. A cadeia ternária seguinte falha em todos os ramos e cai no fallback `'hitstun'`. O lutador sofre flicker de hitstun por 1 frame ao se recuperar de qualquer pouso ou ação. |
| **EST-02** | **CONFIRMADO** | `src/sim/combat.js:192-205` | Ao bloquear, a linha 193 atribui `attacker.action = {kind: 'recoil', ...}`, sobrescrevendo a ação atacante antes da linha 205 (`else if (attacker.action.guardBreak)`). A quebra de guarda é obliterada e nunca quebra o defensor em `resolveHit`. |
| **EST-03** | **CONFIRMADO** | `src/sim/combat.js:253-261` | `resolveFootstool` aplica `stun` e anula `action`, mas não define `defender.state = 'stagger'`, deixando o defensor com estado obsoleto do frame anterior. |
| **EST-04** | **CONFIRMADO (Condicional)** | `src/sim/controller/ctrl-moves.js:333` | `cancelCharge` acessa `ch.ticks * ch.params.step`. Se `ch.params` for nulo ou omitir `step` em estados restaurados/mockados, quebra com `TypeError: Cannot read properties of undefined`. |
| **EST-05** | **CONFIRMADO (Risco Real)** | `src/sim/controller/ctrl-update.js:67` | Na checagem `f.hp <= 0`, atribui `f.state = 'defeated'` e retorna de imediato, sem desmarcar `f.absent = false` nem limpar `f.aim`, `f.charge` ou `f.tackleCharge`. |
| **EST-06** | **CONFIRMADO** | `src/view/characters.js:468` | `1 - f.stun / Math.max(1e-6, R.guardStun)`. Quando o stun aplicado for maior que o valor padrão (`R.guardStun` ~ 0.15s), o cálculo resulta em valor negativo que é travado em zero, congelando o primeiro frame da animação. |

---

### 3.2 Achados de VFX e Apresentação (VFX-01 a VFX-07)

| ID | Classificação Real | Arquivo e Linha | Diagnóstico Técnico |
|---|---|---|---|
| **VFX-01** | **CONFIRMADO** | `src/sim/world.js:236-444`, `src/view/world-view/wv-update.js:183-205` | Entidades destruídas no mesmo passo (`barrierBroken`, `stoneClash`, `tackleClash`, `neutralized`) são marcadas `dead = true` e descartadas de `world.entities`. Como os eventos não trazem coordenadas `{x, y, z}`, `wv-update.js` avalia `pos = null` e descarta silenciosamente (`if (!pos) continue;`), silenciando anéis de choque e estilhaços. |
| **VFX-02** | **CONFIRMADO** | `src/sim/map/map-collision.js:150` | `destructibleSplat` emite `{fighter: f.id, destructible: d.id}` em vez de `target: f.id`. É descartado por `vfx.js:195` e `view.js:183` que buscam `fighters[e.target]`. Zero VFX e zero screen shake. |
| **VFX-03** | **CONFIRMADO** | `src/sim/physics.js:536`, `src/view/vfx.js:195`, `src/view/view.js:183` | `wallSplat` emitido com `attacker: null` (impacto ambiental ou por knockback sem autor) é descartado pelas rotinas de apresentação que exigem `fighters[e.attacker]` válido. |
| **VFX-04** | **CONFIRMADO** | `src/sim/moves/bounce.js:47`, `src/view/vfx.js:202`, `src/view/view.js:183` | `bounce.js` emite `clash` sem `normal` e com um único registro `attacker: f.id`. A View e o VFX exigem `attacker === 0`, fazendo com que clash iniciado pelo inimigo vermelho seja totalmente silenciado. |
| **VFX-05** | **CONFIRMADO (Runtime inativo)** | `src/view/vfx/contract.js:121` | `classifyVisualType` tem fallback `return map[result] || 'hit'`. Qualquer evento de simulação não listado é convertido em `hit`, gerando clarões e partículas espúrias no jogador caso o runtime declarativo seja ativado. |
| **VFX-06** | **CONFIRMADO** | `src/sim/combat.js:262` | `resolveFootstool` não inclui `normal`. `vfx.js:199` faz fallback para `{x: 0, z: 0}` e `view.js:275` descarta a normal do contato. |
| **VFX-07** | **CONFIRMADO** | `src/view/world-view.js:71`, `src/view/view.js:157` | `worldView.reset()` limpa módulos mas não descarta malhas de `this.particles`, `this.rings`, `this.meshes`. `view.reset()` não descarta `statusAura`, `riposteFx`, `aimMarkers`, nem reseta névoa de cegueira residual (`blindK`). |

---

### 3.3 Defeitos Estruturais Adicionais (ARC-01 a ARC-09)

| ID | Classificação Real | Arquivo e Linha | Diagnóstico Técnico |
|---|---|---|---|
| **ARC-01** | **CONFIRMADO** | `src/sim/world.js:253` | Projéteis com slider `pierce > 1` morrem no primeiro acerto porque o condicional inclui `|| ev?.result === 'impact'`, anulando completamente a contagem de alvos perfurados. |
| **ARC-02** | **CONFIRMADO** | `src/sim/map/map-spawn.js:184, 206, 231` | `found || rawPos` força o posicionamento na posição original arbitrária quando a busca por local livre falha, gerando objetos sobrepostos ou dentro de outros sólidos. |
| **ARC-03** | **CONFIRMADO** | `src/sim/physics.js:220` | `settleStatics` interrompe após 12 iterações e incrementa `staticConflicts`, admitindo penetração física não resolvida perto de quinas. |
| **ARC-04** | **CONFIRMADO** | `src/sim/sand.js`, `sand-stone-lab/src/` | Divergência entre a frente física de células da onda de areia e a malha do visualizador; o visual pode desenhar areia atravessando obstáculos sólidos. |
| **ARC-05** | **CONFIRMADO** | `src/sim/moves/sand-wave/sand-wave.vfx.js:23` | Método `onEvent` está completamente vazio. Eventos de impacto, bloqueio ou dissipação da onda não produzem resposta visual específica. |
| **ARC-06** | **CONFIRMADO** | `src/sim/moves/water-pulse/water-pulse.vfx.js:18` | `onEvent` testa `ev.result === 'hit'`, `'wallClash'`, `'shieldDeflect'`, nomes inexistentes no motor (que emite `'impact'`, `'obstacleHit'`, `'partial'`). O efeito visual de splash nunca reage aos contatos da simulação. |
| **ARC-07** | **CONFIRMADO** | `src/view/view.js:89` | Novo runtime de VFX (`VfxRuntime`) permanece desativado (`useNewVfx = false`), coexistindo com o motor legado. Modificações em `vfx/` não alteram a partida jogável a menos que o contrato e o pipeline sejam ativados com paridade. |
| **ARC-08** | **CONFIRMADO** | `src/sim/combat.js`, `src/sim/sand.js` | Coexistem três grandezas com rótulos similares: impulso instantâneo (`launch`), velocidade interpolada coreografada (`pushAway`) e força contínua por aceleração (`sandPush`). |
| **ARC-09** | **CONFIRMADO** | `src/sim/combat.js`, `src/sim/world/world-hit.js` | `applyHit` e `resolveHit` duplicam pipelines de dano, escudos, stages e decisões de knockback de forma concorrente. |

---

## 4. Inventário de Arquivos Afetados e Análise de Risco

| Módulo / Arquivo | Responsabilidade | Risco de Regressão | Estratégia de Mitigação |
|---|---|---|---|
| `src/sim/combat.js` | Resolução de combate corpo a corpo, guard break, footstool, clash | Alto | Testes TDD unitários cobrindo guard break, footstool e clash simétrico antes da modificação. |
| `src/sim/controller/ctrl-update.js` | Loop de atualização do lutador, estados e knockRecovery | Crítico | Garantir que o estado neutral seja reavaliado por prioridade de entrada sem quebrar `locoPhase`. |
| `src/sim/controller/ctrl-moves.js` | Gestão de moves especiais, charges e miras | Médio | Salvaguarda defensiva em `cancelCharge` sem alterar regras de cooldown. |
| `src/sim/world.js` | Projéteis, barreiras, feixes, colisões e perfuração (pierce) | Alto | Testar projéteis de 1 e múltiplos alvos; injetar coordenadas em eventos antes da deleção. |
| `src/sim/physics.js` | Física, pouso, colisões estáticas e wallSplat | Crítico | Manter a regra de que somente contato físico real produz `landing`. |
| `src/sim/map/map-collision.js` | Colisão com mapa e destrutíveis | Médio | Padronizar contrato do evento `destructibleSplat` compatível com a View. |
| `src/sim/map/map-spawn.js` | Geração de objetos e consumíveis | Médio | Reamostrar com fallback seguro ou descarte limpo em vez de sobreposição forçada. |
| `src/view/view.js` | Despacho de eventos visuais, overlays, reset de cena | Alto | Suportar eventos ambientais sem agressor (`attacker = null`); reset completo de memória. |
| `src/view/vfx.js` | Sistema de VFX legado (ativo no jogo) | Médio | Despachar `wallSplat` e `destructibleSplat` com `attacker = null`; clash simétrico. |
| `src/view/world-view/wv-update.js` | Anéis de choque e partículas Three.js de entidades | Alto | Garantir que eventos com coordenadas consumam `{x, y, z}` mesmo após descarte da entidade. |
| `src/view/moves-vfx-registry.js` e pilotos | VFX modular dos Moves (Sand Wave, Water Pulse, Bullet Punch) | Médio | Corrigir resultados de eventos reconhecidos em `water-pulse.vfx.js` e preencher `sand-wave.vfx.js`. |
| `src/view/characters.js` | Mapeamento de estados e progresso de animação | Médio | Corrigir normalização de guardStun prolongado. |

---

## 5. Portão de Transição da Fase F0
- [x] Inspeção completa de repositório, branch, commit e arquivos não commitados.
- [x] Verificação e relatório de indisponibilidade de Superpowers e registro de Skills Gamedev.
- [x] Confirmação e classificação individual de todos os achados EST-01..06, VFX-01..07 e ARC-01..09.
- [x] Mapeamento dos riscos e arquitetura-alvo documentada.
- [ ] **Aprovação do usuário para transição à Fase F1 (Definição de Contratos e Testes RED).**

---

## 6. Estado dos achados depois do overhaul F3–F9 (atualizado em 29/10/2026, F9)

Branch `feat/overhaul-arquitetural-f3-f9`. Os testes citados ficam em `prototypes/combat-lab/test/`. «Commit» é onde a correção entrou; os commits `6e82475`, `9ef45ba`, `8b476f8`, `7eecc57` e `c0ed032` são da main antes do branch (base `96205a5`). Status: **validado em teste** = há teste automático verde que cobre o achado; **parcial** = coberto em parte, com limite escrito ao lado; **pendente decisão humana** = depende do responsável.

| ID | Status | Teste | Commit(s) | Observação |
|---|---|---|---|---|
| EST-01 | validado em teste | `p0-vfx-states.test.mjs` (EST-01) | 6e82475, 9ef45ba | — |
| EST-02 | validado em teste | `p0-vfx-states.test.mjs` (EST-02); `f3-reaction-resolver.test.mjs` (guardBreak) | 6e82475, d4e8560 | `resolveHit` usa `applyReaction` (`recoil/guardBreak/guardStun/perfectGuard`). |
| EST-03 | validado em teste | `p0-vfx-states.test.mjs` (EST-03); `f3-reaction-resolver.test.mjs` (`stagger`) | 6e82475, d4e8560 | — |
| EST-04 | validado em teste | `p0-vfx-states.test.mjs` (EST-04) | 6e82475 | — |
| EST-05 | validado em teste | `p0-vfx-states.test.mjs` (EST-05); `f3-permissions.test.mjs` | 6e82475, a7c77dc | `actionPermissions(f)` deriva o que o lutador pode fazer (derrotado: nada). |
| EST-06 | validado em teste | `p0-vfx-states.test.mjs` (EST-06) | 6e82475 | — |
| VFX-01 | validado em teste | `p0-vfx-states.test.mjs` (VFX-01); `f5-vfx-coords.test.mjs` | 6e82475, 71536bc | Projéteis gravam o ponto do contato (CONTRATO_EVENTOS_VFX §6). |
| VFX-02 | validado em teste | `f3-combat-event.test.mjs` (destructibleSplat); `f5-vfx-dispatch.test.mjs` | 6e82475, 3e36d48 | Evento ambiental: `attackerId` null, `indirectAttackerId` preenchido. |
| VFX-03 | validado em teste | `f3-combat-event.test.mjs` (wall splat); `f5-vfx-dispatch.test.mjs` | 6e82475, 8b476f8, 3e36d48 | — |
| VFX-04 | validado em teste | `p0-vfx-states.test.mjs` (clash do Jogador 2, dois clashes no mesmo tick) | 8b476f8, 7eecc57 | — |
| VFX-05 | validado em teste | `p0-vfx-states.test.mjs` (VFX-05); `f5-vfx-dispatch.test.mjs` (resultado sem dono não desenha) | 6e82475, e5e52ae, 2f1e5dd | Tabela `OWNERS` + lista `SEM_VISUAL` em `src/view/vfx/dispatch.js`. |
| VFX-06 | validado em teste | `p0-vfx-states.test.mjs` (EST-03 confere a `normal`) | 6e82475 | — |
| VFX-07 | validado em teste | `f5-reset.test.mjs` (100 ciclos headless); `f8-homologacao.browser.mjs` (100 reinícios, memória da GPU) | 6e82475, 9dcfcf5, 33ef5d5 | — |
| ARC-01 | validado em teste | `p0-vfx-states.test.mjs` (ARC-01); `f4-geometry-gate.test.mjs` (pierce 2 no mesmo passo) | 6e82475, db5222e | — |
| ARC-02 | validado em teste | `f4-spawn.test.mjs` | 536af4b | `placeOrReject` recusa em vez de `found \|\| rawPos`; `spawnRejected` + `mapState.spawnLog`. |
| ARC-03 | validado em teste | `f4-solver.test.mjs`; `f4-geometry-gate.test.mjs` | ad4973b, db5222e | Resíduo medido (`physicsProbe.staticResidualMax/Peak`) e escape `pinEscape` acima de 0,02 m. |
| ARC-04 | parcial | `f5-vfx-coords.test.mjs` (45 casos de corte) | afb0e3e, 71536bc | A frente visual é cortada onde a física não alcança, mas continua um retângulo reto: não faz curva em volta do obstáculo. |
| ARC-05 | validado em teste | `f5-vfx-coords.test.mjs` (Sand Wave na posição do contato) | 9ef45ba, 8b476f8, 42d5235 | — |
| ARC-06 | validado em teste | `f5-vfx-coords.test.mjs` (Water Pulse: ordem `sync → onEvent`, escudo/parcial/plataforma) | 7eecc57, afb0e3e | — |
| ARC-07 | pendente decisão humana | `f5-vfx-dispatch.test.mjs` (um dono de partículas por resultado nos 4 modos) | e5e52ae, 2f1e5dd | `useNewVfx` continua `false` por padrão; ninguém viu os modos novo e quarks no navegador. |
| ARC-08 | validado em teste | `f3-reaction-resolver.test.mjs` | d4e8560 | `applyReaction` separa `impulse` (m/s), `displacement` (m e s) e a força contínua do Sand Wave (`'force'`); todo evento grava `displacementPolicy`. |
| ARC-09 | validado em teste | `f3-damage-resolver.test.mjs` (oráculo 23.040 combinações, conservação de HP); `f6-moves-contract.test.mjs` | 7e6e914, d4e8560, ad32c13 | Dano só por `resolveDamage` (varredura estática endurecida na F9). |

Adaptadores que continuam existindo e o motivo estão no relatório final `docs/RELATORIO_OVERHAUL_F0_F9.md` (seção «Auditoria de legados»).
