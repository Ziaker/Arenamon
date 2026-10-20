# Auditoria da Infraestrutura Física 3D — 20/10/2026

Relatório técnico da auditoria sistêmica do Laboratório de Combate (`prototypes/combat-lab`), conduzida sob a
ordem de auditoria externa (arquivo preservado em `archives/auditoria-externa-2026-10-20.txt`) combinada com
achados próprios. Regra metodológica obedecida: **reproduzir antes de corrigir** — todo defeito listado aqui foi
confirmado por teste ou por inspeção direta do código, e toda correção é acompanhada de teste de regressão.

---

## A. Identificação

- **Escopo:** `src/sim/combat.js`, `src/sim/physics.js`, `src/sim/config.js`, `src/view/characters.js`,
  `src/sim/scenarios-map.js` e a nova suíte `test/physics3d.test.mjs`.
- **Fora de escopo (proibido pela ordem de auditoria):** balanceamento de dano/velocidades, gamepad,
  regras de combate novas (nada foi inventado; apenas invariantes físicos foram corrigidos).
- **Branch:** `feat/camera-cinematica-zzz`.

## B. Auditoria — defeitos confirmados (com reprodução)

| # | Defeito | Reprodução | Causa raiz |
|---|---------|-----------|------------|
| B1 | `launch()` descartava a altitude do alvo | Teste: vault em curso (2,2 m) → `flight.y` caía para `groundY` (0) | `flight.y = f.groundY` ignorava `vaultHeight` e voo em curso |
| B2 | Lutador subindo pela lateral de plataforma "teleportava" para o topo | Cenário `map-combat-launch-platform` + teste de lateral | Pouso exigia apenas `y ≤ topo + 0,35 m`, sem checar direção do voo |
| B3 | Não havia teto: salto sob plataforma atravessava a face inferior | Teste com plataforma de 1,9 m | Ausência total de colisão com face inferior |
| B4 | Arena circular (raio 50) era limitada pelo half-size legado 16 | Posição (60, 0) era clampada | Sentinel `!== 16` usado como cap escondido |
| B5 | Wall-splat sem autor atribuía o dano ao índice oposto | `lastAttacker = null` → dano creditado a `1 - f.id` | Fallback inventado `f.lastAttacker ?? 1 - f.id` |
| B6 | Cada entrada de estado clonava o clipe de animação | `mixer._actionsByClip` crescia sem limite | `clip.clone()` em `enter()` a cada troca de estado |
| B7 | Cenário de mapa codificava o defeito B2 como comportamento esperado | `map-combat-launch-platform` só passava por causa do "cola no topo" | Ponto de partida colado na face lateral da plataforma |

## C. Implementação

1. **`src/sim/combat.js` — `launch()`:** altitude inicial agora é
   `f.flight ? f.flight.y : (f.groundY ?? 0) + (f.vaultHeight ?? 0)` — continuidade física em vaults, juggles
   e relançamentos.
2. **`src/sim/physics.js` — pouso só na descida:** o pouso exige `vy ≤ 0 && y ≤ alvo && prevY ≥ alvo + ε`
   (cruzamento vindo de cima). Elimina o "snap" para o topo durante a subida (B2) e o pouso falso após
   batida de teto.
3. **`src/sim/physics.js` — teto:** nova exportação `getCeilingHeight(pos, world, fromY, toY)` (face inferior
   mais baixa cruzada, apenas dentro da área XZ). No ramo de voo, subir contra a face zera `vy` e apoia o
   lutador nela (`lastCeilingBump`), sem atravessar (B3).
4. **`src/sim/physics.js` — arena circular:** constante nomeada `LEGACY_SQUARE_HALF = 16` documentando que o
   valor pertence à arena quadrada legada; novo campo de teste `C.test.circleCap` (null = raio oficial) para
   cap técnico explícito em cenários de arena circular (B4).
5. **`src/sim/physics.js` — wall-splat:** autoria real do dano — `attacker` é `lastAttacker` numérico ou
   `null` (dano ambiental), nunca o índice oposto; dano segue o pipeline central
   `processDamageWithShieldAndStages` (escudo → estágios → HP) (B5).
6. **`src/view/characters.js` — mixer:** `enter()` usa o clipe do catálogo diretamente (sem `clone()`) e o
   guard de continuidade foi generalizado para qualquer reentrada do mesmo índice (o tempo das ações temporais
   continua imposto por `blend()`). Cache de ações limitado aos clipes distintos (B6).
7. **`src/sim/config.js`:** `test.circleCap` documentado.
8. **`src/sim/scenarios-map.js`:** `map-combat-launch-platform` ajustado para lançar de fora da área da
   plataforma (arco sobe, cruza a borda acima do topo e aterra no topo) — o ponto de partida anterior só
   "pousava no topo" por causa de B2 (B7).

## D. Testes

Nova suíte dedicada `test/physics3d.test.mjs` (10 testes, executor resiliente):

1. `launch()` no meio de um vault preserva a altitude física (+ continuidade após 1 passo).
2. `launch()` em alvo em voo (juggle) preserva a altitude do voo.
3. `launch()` a partir do topo de plataforma (1,5 m) cruza a borda e aterra no solo.
4. Subir pela lateral de plataforma não teleporta para o topo (pouso só na descida + continuidade por passo).
5. Salto sob plataforma alta (1,9 m): bate na face inferior e volta ao piso, sem atravessar.
6. `getCeilingHeight`: só conta faces acima da faixa cruzada e dentro da área XZ.
7. Salto normal sobre plataforma: aterrissa no topo exatamente uma vez.
8. Arena circular oficial (raio 50) não é limitada pelo half-size legado 16; `circleCap` explícito limita.
9. Wall-splat sem `lastAttacker` não atribui dano ao índice oposto (dano ambiental bruto; autoria real preservada).
10. Entradas de estado não clonam clipes e o cache de ações do mixer não cresce sem limite.

Regressão completa `npm run test:combat-lab:unit`: **todas as suítes aprovadas** (61 simulação, 20 Etapa A,
8 IA tática, 4 patch, 15 locomoção, 12 animação, 10 regras, 34 VFX, etc., sem nenhuma falha).

## E. Resultados — matriz de classificação dos cenários

| Cenário da matriz de validação | Situação |
|---|---|
| Salto normal (R2/R7) atinge ~2,0 m | ✅ já existia, verificado por regressão |
| Plataformas de 1,0 m / 1,5 m (subida, combate elevado, queda pela borda) | ✅ já existia, verificado por regressão |
| Destrutíveis / itens / escudo | ✅ já existia, verificado por regressão |
| Lançamento (C) preserva altitude (vault, juggle, plataforma) | 🔧 **corrigido + testado** (era B1) |
| Interação C → X (relançamento em voo) | 🔧 **corrigido + testado** (idem) |
| Pouso físico sobre plataforma (lançado) | 🔧 **corrigido + testado**; cenário de mapa reescrito (B2/B7) |
| Teto de plataformas (face inferior) | 🔧 **implementado + testado** (era B3) |
| Borda circular: contenção + rebote + wall-splat | 🔧 **corrigido + testado** (B4, B5) |
| Wall-splat: dano, autoria, suspensão | 🔧 **corrigido + testado** (B5) |
| Mixer de animação estável sob churn de estados | 🔧 **corrigido + testado** (B6) |
| Escadas/rampas inclinadas | ❌ **não implementado** — a engine não possui suporte a faces inclinadas; exige decisão de design própria (fora do escopo de correção) |
| Gamepad | ⛔ proibido pela ordem de auditoria |
| Balanceamento | ⛔ proibido pela ordem de auditoria |

## F. Pendências e limitações (declaradas honestamente)

1. **`npm run verify` não conclui por falha pré-existente** em `prototypes/combat-lab/verify.mjs` (teste de
   navegador: clique no `#arena-autoplay-toggle` — "element is not visible", TimeoutError do Playwright).
   **Reproduzida na árvore limpa (antes das mudanças desta auditoria)**, portanto não é regressão desta
   entrega. Toda a cadeia anterior (workspace, typecheck, builds, dezenas de suítes unitárias) passa.
2. **Sistema VFX duplicado** (`useNewVfx` legado × novo): permanece como está, sem remoção — migração
   completa é decisão pendente e não era P0.
3. **`prototypes/game` legado** (P1): não tocado nesta entrega.
4. **Rampas/escadas:** exigem infraestrutura nova (faces inclinadas); classificado como não implementado.
5. **Tolerância de borda do pouso:** a área de apoio considera a meia-largura do corpo do lutador; um pouso
   com o centro a até ~0,5 m além da borda conta como "sobre a plataforma" — comportamento intencional e
   consistente, registrado aqui para evitar surpresa.

---

*Entrega da branch `feat/camera-cinematica-zzz` — ver `docs/MAPA_REPOSITORIO.md` e o portal `ABRIR_ARENAMON.html`.*
