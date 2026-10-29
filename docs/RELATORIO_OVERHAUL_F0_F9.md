# Relatório do overhaul F0–F9 — laboratório de combate

Data: 29/10/2026 · versão do jogo **1.43.0** · branch `feat/overhaul-arquitetural-f3-f9`
HEAD antes do commit da F9: `d7539ac`. O hash do commit da F9 está no fim deste relatório, depois que o commit foi feito (ver `git log -1`).
Plano: `docs/superpowers/plans/2026-10-28-overhaul-f3-f9.md`. Livro de execução (decisões, achados e pendências de cada task): `.superpowers/sdd/2026-10-28-overhaul-f3-f9/progress.md`, com os relatórios `task-N-report.md` na mesma pasta.

> **Este relatório não diz que o overhaul está concluído.** Ele diz o que os testes mostram. As fases com pendência humana estão marcadas como tal. A seção «NÃO verificado / depende de você» lista o que só você pode decidir ou olhar.

## Como abrir

- Jogo: `JOGAR_ARENAMON.html` (aponta para `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html`, recompilado nesta entrega; a barra mostra 1.43.0).
- Portal: `ABRIR_ARENAMON.html` → «Evidências e relatórios» → «⚔ Moves e colisão» (este relatório, matrizes F6/F7, homologação F8, paridade A/B). Também estão em `HTMLS_ARENAMON.html` e `TESTES_ARENAMON.html`.

## Status por fase

Legenda: **validado em teste** (há teste automático verde); **parcial** (coberto em parte; o limite está escrito); **pendente decisão humana** (depende de você).

| Fase | Status | Requisito | Código | Teste | Evidência | Commits |
|---|---|---|---|---|---|---|
| F0 auditoria | validado em teste (achados) | Confrontar EST-01..06, VFX-01..07, ARC-01..09 com o código | — | — | `docs/AUDITORIA_CONTRATOS_E_DUPLICACOES.md` (seção 6 marca cada item com teste e commit) | 6e82475 (main, antes do branch) |
| F1 contratos | validado em teste | Contratos de eventos, reações, colisões, cobertura | — | — | `docs/CONTRATO_EVENTOS_VFX.md`, `docs/CONTRATO_REACOES_ESTADOS.md`, `docs/MATRIZ_COLISOES_E_KNOCKBACK.md`, `docs/MATRIZ_COBERTURA_NUMERICA.md` (todos com a seção «implementado hoje» da F9) | 6e82475 |
| F2 correções P0 | validado em teste | EST/VFX/ARC P0 | `ctrl-update.js`, `combat.js`, `world.js`, `vfx/contract.js`, `characters.js`… | `p0-vfx-states.test.mjs` | — | 6e82475, 9ef45ba, 8b476f8, 7eecc57, c0ed032 (main) |
| F3.1 dano | validado em teste | Autoridade única de dano | `src/sim/resolvers/damage-resolver.js` (`resolveDamage`) | `f3-damage-resolver.test.mjs` (oráculo de 23.040 combinações; conservação de HP em 6 sementes × 3.000 passos) | — | 7e6e914 |
| F3.2 reação | validado em teste (resolvedor) · **parcial** (autoridade única) | Autoridade única de reação **exceto** `applyCounterStagger` e `breakByTackle` (`world.js`) e o stagger de parede do Sand Wave (`sand.js`), que escrevem `f.stagger` direto (anteriores ao overhaul; ver CONTRATO_REACOES_ESTADOS §5); `displacementPolicy` | `src/sim/resolvers/reaction-resolver.js` (`applyReaction`) | `f3-reaction-resolver.test.mjs`; `replay-referencia` 7/7 | — | d4e8560 |
| F3.3 contactId | validado em teste | `contactId` por instância de `Game` | `combat.js` `clash(…, world)`, `world.contactSeq` | `f3-contact-id.test.mjs` | — | 769f04e, bf2b8de |
| F3.4 eventos | validado em teste | Evento normalizado, `eventId` único | `src/sim/events/combat-event.js`; `Game.eventIdSeq` | `f3-combat-event.test.mjs` | — | 43354f1, 3e36d48 |
| F3.5 permissões | validado em teste | `actionPermissions(f)` derivado | `src/sim/entity.js` | `f3-permissions.test.mjs` | — | a7c77dc |
| F4 colisões | validado em teste | Consultas únicas, spawn com recusa, solver com resíduo e escape, gate geométrico | `src/sim/collision/queries.js`, `map/map-spawn.js`, `physics.js`, `world.js` | `f4-collider-queries`, `f4-spawn`, `f4-solver`, `f4-geometry-gate` (14 cenários) | painel ao vivo: resíduo e escapes | 3fb7a64, 536af4b, ad4973b, db5222e |
| F5 VFX | **parcial / pendente decisão humana** | Despachante único, reset sem vazamento, paridade com ROI, coordenadas, captura determinística | `src/view/vfx/dispatch.js`, `view.js`, `world-view.js`, `visual-random.js`, pilotos `*.vfx.js` | `f5-vfx-dispatch`, `f5-reset`, `f5-vfx-coords`, `moves-vfx-parity.browser.mjs`, `vfx-colisao.browser.mjs` | `prototypes/combat-lab/evidence/moves-vfx-parity/AB_PARIDADE.html` | e5e52ae, 2f1e5dd, 9dcfcf5, 9abf3d9, 37741e2, 42d5235, afb0e3e, 71536bc |
| F6 Moves | validado em teste | 19 Moves pelos contratos de dano, reação e evento | `combat.js`, `seed-bomb.js`, `view/vfx.js` | `f6-moves-contract.test.mjs`, `f6-seedbomb-visual.test.mjs` | `docs/MATRIZ_MIGRACAO_MOVES_F6.md` | ad32c13, 01ca8d0 |
| F7 Editor | **parcial / pendente decisão humana** | Todo slider com consumidor real, unidade, faixa, round-trip e A/B | `ui/tuning.js` (rótulo «(sem efeito)»), `test/f7-sliders-coverage-lib.mjs`, `scripts/gen-matriz-sliders.mjs` | `f7-sliders-coverage.test.mjs` | `docs/MATRIZ_SLIDERS_F7.md` | a43a487, 60bad42 |
| F8 homologação | **parcial** | Replay, multijogo, 100 resets, partidas de 180 s, tempo por passo, acessibilidade | `controller/ctrl-update.js` (`setControllerContext`), `nav/nav-graph.js` (cache de 8 mapas) | `f8-homologacao.test.mjs` (+ `--lento`), `f8-homologacao.browser.mjs` | `prototypes/combat-lab/evidence/homologacao-f8/index.html`, `docs/RELATORIO_HOMOLOGACAO_F8.md` | 33ef5d5, d7539ac |
| F9 limpeza e entrega | validado em teste (o que foi feito) | Auditoria de legados, minors baratos, docs, portal, versão, build | ver «Auditoria de legados» e «O que a F9 mudou» | `rapido --sem-cache`, `rapido:tudo`, testes F3–F8, replay, typecheck | este relatório | commit da F9 |

## Medições

| Medida | Valor | Fonte |
|---|---|---|
| Tempo por passo da simulação (86.400 passos, 4 sementes × 180 s) | p50 0,065 ms · p95 0,164 ms · p99 0,319 ms · máx 23,7 ms (pico isolado). Orçamento: p95 < 2 ms, p50 < 1 ms (o passo tem 8,33 ms a 120 Hz) | `f8-homologacao.test.mjs --lento` (F8). Reexecução na F9: p50 0,068 · p95 0,182 · máx 29,8 ms |
| 100 resets | nenhum array/Map/Set (até 4 níveis) nem registro global cresceu; navegador: geometrias/texturas/programas estáveis (87/9/18) | `f8-homologacao.test.mjs`, `f8-homologacao.browser.mjs`, `f5-reset.test.mjs` |
| Invariantes em partidas IA × IA | 0 violação em 86.400 passos (sem NaN, HP conservado, resíduo ≤ 0,02 m ou pinEscape, sem pouso falso, hitstop parado) | F8 |
| A/B dos sliders | 1632 sliders; 499 de gameplay mudam o cenário curto entre mín e máx; 304 sem A/B observável; 805 visuais; 24 órfãos | `docs/MATRIZ_SLIDERS_F7.md` |
| Paridade visual (layout padrão, painel recolhido, última execução 28/10) | 38 de 43 verificações ok; as 5 fidelidades contra as referências antigas falham (ROI: Sand Wave 31,2 %, Bullet Punch vanish 14,7 %, impacto 9,7 %, Water Pulse voo 3,9 %, splash 37,1 %). As referências foram capturadas em outro layout e sem captura determinística; com o painel aberto, o voo do Water Pulse dá 75,56 % estável (dispersão 0 pp em 3 execuções) contra 76,8–77,0 % na base | `evidence/moves-vfx-parity/resultado-paridade-vfx.json`, relatórios das Tasks 12 e 13 |
| Matriz dos Moves | 19 Moves no registro + Tackle de referência; oráculo de 16.800 linhas sem divergência | `docs/MATRIZ_MIGRACAO_MOVES_F6.md` |

## Auditoria de legados (F9)

Regra aplicada (AGENTS.md, primeira seção): só se remove código interno com **zero** consumidores em `src/`, `test/`, `scripts/` e geradores de docs, e que não seja recurso visível. Contagem por busca de importação/chamada em 29/10/2026.

| Símbolo | Onde | Consumidores (src / test / scripts) | Decisão |
|---|---|---|---|
| `processDamageWithShieldAndStages` | `sim/map/map-damage.js` (exportado também pela fachada `sim/map.js`) | 2 (`scenarios-map.js`, `scenarios-passives.js`) / 4 (`f3-damage-resolver`, `gameplay-12-scenarios`, `interruptions`, `map.test`) / 0 | **mantido** como adaptador de `resolveDamage` (formato antigo) |
| `launch` | `sim/combat.js` | 2 (`combat.js` clash, `stone.js`) / 7 (`clash-tech`, `f3-reaction-resolver`, `f7-sliders-coverage-lib`, `gameplay-12-scenarios`, `interruptions`, `physics3d`, `tackle-slam`) / 0 | **mantido** (adaptador de `applyReaction` impulse) |
| `pushAway` | `sim/combat.js` | 1 (`combat.js`: clash e bloqueio do Slam) / 3 (`f3-reaction-resolver`, `f4-geometry-gate`, `landing-false-recovery`) / 0 | **mantido** (adaptador de `applyReaction` displacement) |
| `knockbackReaction` | `sim/combat.js` | 0 / 2 (`f3-reaction-resolver`, `landing-false-recovery`) / 0 | **mantido**: os testes de regressão de pouso falso o usam; adaptador de uma linha |
| `get/set/reset/nextClashContactSeq` | antigo `sim/combat.js` | 0 / 0 / 0 | **já removidos** em 769f04e (F3.3), trocados por `world.contactSeq` |
| `clashContactSeq` (campo de save antigo) | `sim/game.js` (hidratação) | 1 / 2 (`f3-contact-id`, `p0-vfx-states`) / 0 | **mantido**: saves antigos continuam abrindo |
| `getGroundHeightAt` | antigo `sim/map/map-step.js` | 0 / 0 (só citado no oráculo) / 0 | **já removido** em 3fb7a64 (F4), trocado por `groundHeightAt(…, {footMargin: 0})`. Na F9 saiu dos descritores velhos `scripts/planos/map.json` e `docs/CODIGO_SEM_USO_KNIP.md` |
| `insideSolid` (vision e nav-graph) | antigos | 0 / 0 / 0 | **já removido** em 3fb7a64, trocado por `pointInSolid`/`insideFootprint` |
| `collectSolids` | `nav/nav-graph.js` (alias de `navSolidsOf`) | 2 (`scenarios-collision.js`, `view/collision-overlays.js`) / 6 / 0 | **mantido** (alias) |
| `groundSurface` (reexportado por `physics.js`) | `sim/collision/queries.js` | 2 (`physics.js`, `view/collision-overlays.js` via physics) / 4 / 0 | **mantido** (reexportação) |
| `closestOnShape` (reexportado por `world-hit.js` e `world.js`) | `sim/collision/queries.js` | 7 (`aim-marker`, `projectile-util`, `psyshock`, `stone`, `trap`, `world`, `world-hit`) / 3 / 0 | **mantido** (reexportação) |
| `segmentClear`, `solidsOf` | `sim/collision/queries.js` | 3 / 3 | **mantidos** (consultas canônicas) |

**Resultado:** a F9 não removeu nenhuma função. Todos os adaptadores que sobraram têm consumidor. As únicas remoções de exportações do branch inteiro (`get/set/reset/nextClashContactSeq`, `getGroundHeightAt`, `insideSolid`) aconteceram na F3/F4, eram internas, não visíveis ao usuário, e foram trocadas por equivalentes provados por oráculo.

## O que a F9 mudou (sem alterar gameplay nem visual)

- **Varredura estática de HP endurecida** (`test/f6-moves-contract-lib.mjs`): agora pega `??=`, `||=`, `&&=`, `%=`, `**=`, `--x.hp`/`++x.hp` (prefixo), troca do objeto `.shield = {…}` e `Object.assign(…hp|shield…)`. A versão nova achou 5 linhas legítimas (escudo inicial montado em `scenarios-map.js`, cenário técnico), que ganharam entrada justificada na lista. A permissão de `combat.js` ficou ancorada em `/const defStageKnockbackMult = /`. Teste novo com 10 formas que devem ser pegas e 6 comparações que devem ser ignoradas. Matriz F6 regenerada.
- **`C.test.penetrationTolerance`**: `resetConfig` agora apaga o override (o valor volta ao embutido de 0,02 m) sem entrar em `defaults()`. Assim não vira slider, não entra em presets e não muda a matriz F7. RED → GREEN em `f4-solver.test.mjs`.
- **Tipos de `applyHit`** (`src/sim/world/world-hit.js`): JSDoc nos parâmetros. Isso fez o `typecheck-vfx` voltar a passar; é só comentário, nada muda na execução.
- **Rodada da revisão final do branch (commit seguinte):**
  - O alcance livre do Sand Wave (`freeReachOf`) fica em cache por onda, chaveado pelo registro do campo da simulação e pela geometria da onda. Antes, era remarchado a cada quadro, mesmo pausado: ~1,5 ms por chamada num mapa com 13 obstáculos. Agora são ~0,1 µs, com valor idêntico quadro a quadro ao da implementação antiga em 40 casos e 32.640 quadros (`f9-sand-reach-cache.test.mjs`).
  - Um `wallSplat` em lutador já derrotado ganha o marcador `targetDefeated` e passa no validador.
  - A telemetria calcula `actionPermissions` uma vez por lutador.
  - Um teste trava o three.quarks em 0.17.x.
- **Buraco de array** (`,,`) no gerador da matriz F7 trocado por `''`: saída idêntica.
- **Descritores velhos**: `scripts/planos/map.json` e `docs/CODIGO_SEM_USO_KNIP.md` não citam mais `getGroundHeightAt`/`insideSolid`.
- **Docs**: seções «implementado hoje» nos contratos e matrizes, plano de rollback por fase e auditoria EST/VFX/ARC com teste e commit.
- **Portal**: links novos em `ABRIR_ARENAMON.html` (relatório F0–F9 e A/B de paridade), `HTMLS_ARENAMON.html` (relatórios, matrizes, contratos, evidências) e `TESTES_ARENAMON.html`. Versão 1.42.0 → 1.43.0.
- **Não feitos, de propósito:**
  - `help` vazio (`''`) no manifesto de `ui/tuning.js` ficou como está, porque a interface depende dele: `textContent = m.help` e a busca concatenam o texto, e `undefined` apareceria escrito.
  - `CONTACT_Y` no estouro do Sand Wave quando o evento traz `y` também ficou: trocar mexeria na posição visual.

## Skills lidas e usadas por fase

Os caminhos são `.claude/skills/<nome>/SKILL.md` (cópia idêntica em `.agents/skills/`). Esta tabela só lista o que os relatórios das tasks registram.

| Fase | Skills (registradas nos relatórios) |
|---|---|
| F0–F2 (main, antes do branch) | `arenamon-routing`, `physics-tuning`, `game-feel`, `camera-systems`, `performance-optimization`, `router`, segundo `docs/AUDITORIA_CONTRATOS_E_DUPLICACOES.md` §1.2 (caminhos `.agents/skills/…`) |
| F3 (Tasks 1–5) | nenhuma skill citada nos relatórios; método TDD (RED/GREEN) registrado em cada relatório |
| F4 (Tasks 6–9) | `physics-tuning` (6, 7, 8, 9); `superpowers:systematic-debugging` (9) |
| F5 (Tasks 10–13) | `game-feel` (10, 12, 13); `threejs-scene-setup` (10–13); `performance-optimization` (11, 13) |
| F6 (Task 14) | `game-feel` |
| F7 (Task 15) | nenhuma skill citada no relatório |
| F8 (Task 16) | `performance-optimization`, `physics-tuning` |
| F9 (Task 17) | `performance-optimization` (orçamentos finais: medir primeiro e só reportar números medidos; tempo por passo reconferido no `--lento`) |

## Inventário de recursos antes × depois (AGENTS.md)

Comparação entre a base `96205a5` (main) e o estado entregue.

| Item | Antes | Depois | Situação |
|---|---|---|---|
| Exportações nomeadas em `prototypes/combat-lab/src` | 1261 | 1332 | +71. Saíram 6, todas internas e já trocadas por equivalentes: `getClashContactSeq`, `setClashContactSeq`, `resetClashContactSeq`, `nextClashContactId` (769f04e → `world.contactSeq`), `getGroundHeightAt`, `insideSolid` (3fb7a64 → `groundHeightAt`, `pointInSolid`/`insideFootprint`). Nenhuma era recurso de interface |
| Sliders (Ajustes + Moves) | 1632 | 1632 | igual (`f7-sliders-coverage.test.mjs`). 24 órfãos **rotulados**, nenhum apagado |
| Moves no registro | 19 (19 `.move.json`, 19 `.params.js`) | 19 | igual |
| Links do portal (destinos únicos) | ABRIR 174 · HTMLS 37 · TESTES 24 | ABRIR 185 · HTMLS 51 · TESTES 38 (inclui links de outras sessões ainda não commitados) | nenhum link da base sumiu (diferença de conjuntos vazia nos 3) |
| Controles do `src/template.html` | 36 input · 121 button · 34 select | 36 · 121 · 36 | nenhum `id` sumiu; 6 ids novos (cor do lutador e HUD, commits alheios 3b5960f e f57e3a9) |
| Visual do Seed Bomb | cor padrão + tremor genérico | igual (restaurado em 01ca8d0 depois da mudança da F6) | sem violação |

**Conclusão do inventário:** nenhuma funcionalidade sumiu. As mudanças visíveis estão listadas em (h) abaixo.

## Comandos rodados na F9 e resultados

Máquina i5-12450H, Node v25.8.0, 29/10/2026.

| Comando | Resultado |
|---|---|
| `npm run indice` | `docs/INDICE_VIVO_MOVES.md` atualizado |
| `npm run build:combat-lab` e `npm run rapido:build` | ok (0,8 s); `JOGAR_ARENAMON.html` continua apontando para `prototypes/combat-lab/dist/arenamon-combate-laboratorio.html`, que contém 1.43.0 |
| `node scripts/rapido.mjs --sem-cache` | **181/181 ok** em 88,2 s (moves-swift, moves-strategy e moves-ui passaram na 2ª tentativa, instáveis sob carga) |
| `npm run rapido:tudo` | **188/189** em 555,6 s. Única falha na época: `ai-eval.test.mjs`, a falha de (c), hoje RESOLVIDA por guarda estatística multi-semente. moves-sand-wave passou na 2ª tentativa |
| Testes F3–F8 um a um (`node prototypes/combat-lab/test/<arquivo>`) | f3-combat-event 9/9 · f3-contact-id 4/4 · f3-damage-resolver 5/5 · f3-permissions 5/5 · f3-reaction-resolver 8/8 · f4-collider-queries 4/4 · f4-geometry-gate 14/14 · f4-solver 8/8 · f4-spawn 7/7 · f5-reset 5/5 · f5-vfx-coords 25/25 · f5-vfx-dispatch 10/10 · f6-moves-contract 26/26 · f6-seedbomb-visual 2/2 · f7-sliders-coverage 11/11 · f8-homologacao 5/5 |
| `node prototypes/combat-lab/test/replay-referencia.test.mjs` | 7/7 |
| `node prototypes/combat-lab/test/f8-homologacao.test.mjs --lento` | 6/6. 86.400 passos: p50 0,068 ms · p95 0,182 ms · máx 29,8 ms (pico isolado); 100 resets sem crescimento; 183 pousos (1 em apoio que sobe), 260 impactos. `evidence/homologacao-f8/resultado.json` e `bench-moves.md` regravados |
| `npx tsc --noEmit -p prototypes/combat-lab/tsconfig.json` | 0 erros |
| `npm run typecheck` | falhava em `d7539ac` no passo `scripts/typecheck-vfx.mjs`, com 12 diagnósticos novos em `world-hit.js` (`info = {}` sem tipo depois dos campos da F3/F6). Corrigido na F9 só com JSDoc em `applyHit`, sem mudança de execução; os 4 módulos VFX auditados estão ok |
| `npm run estrito` | 914 erros (orçamento 939; era 926 antes do JSDoc) |

Não rodados na F9: os testes de navegador (`*.browser.mjs`, inclusive `moves-vfx-parity` e `f8-homologacao.browser`), cujos números acima vêm das Tasks 12, 13 e 16, e `npm run verify` completo.

## NÃO verificado / depende de você

**(a) 5 referências visuais esperando o seu aceite.** Abra `prototypes/combat-lab/evidence/moves-vfx-parity/AB_PARIDADE.html` (layout padrão). Se concordar, rode `node prototypes/combat-lab/test/moves-vfx-parity.browser.mjs --aceitar=todos`. O aceite é das 5 juntas e no mesmo layout. Até lá, as 5 fidelidades contra as referências antigas continuam falhando (números em «Medições»).

**(b) 24 sliders órfãos «(sem efeito)» e 2 bônus de estágio que só aparecem no HUD** (`map.stageCooldownReduction`, `map.stageSpeedBonus`). Para cada um, escolha: ligar com padrão neutro, manter como legado ou remover com alias e migração de preset. A lista com o que cada um faria está em `docs/MATRIZ_SLIDERS_F7.md`, seções «Decisões pendentes do responsável» e «Órfãos». Nada foi ligado nem apagado.

**(c) `ai-eval.test.mjs` falhava desde db5222e — RESOLVIDO** (faixa lenta, fora do `rapido`). A guarda «revisão 2 mantém ações negadas controladas» (`negadas(rev 2) ≤ negadas(rev 1) + 20`, 10 pares, semente 100) dava +19 na main e dá +23 depois do gate F4. A causa é a fragilidade estatística da guarda de semente única: na main, 9 das 10 sementes 100–109 já passavam de +20, e em janelas de 10 pares a guarda falha em ~22 % das sementes nos dois commits (20/91 e 21/91). O que mudou de fato: 2 acertos de raspão legítimos de projétil em 200 lutas; vitórias iguais (13 × 7). **RESOLVIDO: a guarda de semente única foi substituída por uma guarda estatística de 8 janelas de 10 pares (sementes 100, 110, … 170): média da diferença de negadas ≤ 22,3 por janela (13,4 + 3 × 8,4/√8, ancorada em 91 janelas medidas; medido +13,9) e média da diferença de vitórias ≥ −3,9 (medido −0,1).** (histórico da decisão: guarda estatística com várias sementes, em vez de reancorar o limite). Detalhes em `.superpowers/sdd/2026-10-28-overhaul-f3-f9/ai-eval-investigation-report.md` e `docs/RELATORIO_HOMOLOGACAO_F8.md`.

**(d) Frente visual do Sand Wave.** Ela é cortada onde a física não alcança, mas continua um retângulo reto. Não faz curva em volta do obstáculo: com parede curta, a física contorna e o visual não. Um efeito curvo segmentado é decisão sua.

**(e) Lacunas da F8:**
- o jogo não tem relógio de rodada, intervalo de 45 s nem preparação de 90 s (a melhor de três só é contada no teste);
- os 100 resets pelo fluxo do app (`app/match-flow.js`) não rodam sem navegador (dependem do DOM);
- a acessibilidade (Sem Flash, Reduzir Movimento) só foi medida no VFX padrão;
- a penalidade de aresta travada da navegação fica fora do save (com os padrões, ela nunca dispara).

**(f) Modos `useNewVfx` e quarks não foram vistos a olho no navegador.** Os testes provam um único dono de partículas por resultado nos 4 modos, mas ninguém olhou a tela.

**(g) Cobertura incompleta dos sliders:** 304 sliders de gameplay não mostram A/B observável nos cenários curtos (cada um com motivo na matriz), e 354 sliders numéricos aparecem sem unidade (fração ou multiplicador como número puro). As duas listas têm orçamento travado: a primeira só pode diminuir, a segunda não pode crescer.

**(h) Consequências que você pode notar no jogo:**
- os anéis e as partículas dos eventos de contato de projétil (`groundHit`, `destructibleHit`, `neutralized`, `arenaHit`/`obstacleHit`/`platformHit`/`detonate`) agora saem no ponto real do contato, e não mais no lutador 0 ou na origem. No modo padrão, isso só aparece no anel do `neutralized`;
- o visual do Seed Bomb continua o original (cor padrão e tremor genérico): a F6 tinha mudado e o commit 01ca8d0 restaurou.
- Itens no meio da partida buscam posição em 10 anéis (antes 8): um item que antes era recusado pode nascer agora. É uma mudança pequena de gameplay.
- O `statusTick.heal` passou a levar o HP curado de fato (antes, o nominal). A telemetria mostra `canAct`/`canMove` falsos para lutador ausente (Bullet Punch em voo).
- Também mudaram (correções, sem número de gameplay): a IA lê os lutadores da própria partida, o projétil rápido não atravessa mais o lutador ao raspar uma quina, e o lutador imprensado escapa para a posição livre mais próxima.

**(j) Limites encontrados na revisão final do branch (não alterados):**
- três caminhos de reação ainda ficam fora do `applyReaction`: `applyCounterStagger`, `breakByTackle` e o stagger de parede do Sand Wave. O seguimento sugerido é `kind: 'counterStagger'`, com teste de paridade;
- `getCeilingHeight` e `map/map-collision.js` não foram migrados para `collision/queries.js`;
- o renascimento de destrutível tenta a cada passo e consome RNG (bug anterior, mantido para não mudar os replays);
- eventos só com x/z recebem `position.y = 0` no normalizador: o runtime novo, desligado por padrão, desenha esses eventos no nível do chão;
- `batch-prune.js` mexe em internos do three.quarks 0.17. Agora um teste em `f5-reset.test.mjs` falha se a versão mudar;
- as listas de campos ignorados das baselines dos pilotos (`F3_FIELDS`/`F5_SAND`/`F5_WATER` em `moves-pilots-baseline`) cresceram. Os campos novos são verificados pelos testes F5 e F6; as baselines devem ser regravadas depois do seu aceite;
- a expectativa do `collision-multi` mudou de «sem teletransporte» para «escape ≤ 1,15 m» (intencional, Task 8).

**(i) Checkout compartilhado: commits alheios no branch.** O branch foi criado de `feat/wookada-integracao` (`98fbc66` = main `96205a5` + 2 commits do Wookada), não da main. Outras sessões vivas (Wookada, menu, HUD, docs) commitaram no mesmo checkout. Na hora do PR ou do merge, considere esses commits (são seus, mas não são do overhaul). `git log --format='%h %an %s' 96205a5..HEAD`:

| Commit | Origem | Assunto |
|---|---|---|
| 7783962 | alheio (base do branch, Wookada) | integra personagem Wookada ao laboratório |
| 98fbc66 | alheio (base do branch, Wookada) | embute o Wookada no build do laboratório |
| 7e6e914 | overhaul F3.1 | DamageResolver central |
| d4e8560 | overhaul F3.2 | ReactionResolver central |
| 769f04e | overhaul F3.3 | contactId por instância de Game |
| a7c77dc | overhaul F3.5 | actionPermissions derivadas |
| bf2b8de | overhaul F3.3 | restaura CRLF e layout de world.js |
| 43354f1 | overhaul F3.4 | CombatEvent normalizado e validado |
| 3e36d48 | overhaul F3.4 | eventId único por Game |
| 3fb7a64 | overhaul F4 | ColliderQueries únicas |
| 536af4b | overhaul F4 | spawn validado com recusa determinística |
| ad4973b | overhaul F4 | solver mede penetração residual e escapa |
| db5222e | overhaul F4 | gate geométrico + projétil varrido |
| e5e52ae | overhaul F5 | despachante único de eventos visuais |
| 2f1e5dd | overhaul F5 | pulsos no impact frame, chargeCancel/Interrupt |
| 9dcfcf5 | overhaul F5 | reset libera sobreposições e lotes vazios |
| 9abf3d9 | overhaul F5 | paridade visual com ROI e baseline protegida |
| 37741e2 | overhaul F5 | aceite das 5 juntas no mesmo layout |
| 5cb4f21 | **alheio** (Wookada) | mapa curado do Wookada e remoção do estado run |
| 4e37b90 | **alheio** (menu) | prévia do menu: Wookada apoiado no disco |
| 3b5960f | **alheio** (menu) | cor do lutador na prévia e no jogo |
| 42d5235 | overhaul F5 | coordenadas mundo/local dos emissores, captura determinística |
| afb0e3e | overhaul F5 | frente do Sand Wave corta no obstáculo, splash do Water Pulse |
| 71536bc | overhaul F5 | corte do Sand Wave pela regra da física, ponto de contato dos projéteis |
| ad32c13 | overhaul F6 | matriz executável dos 19 Moves |
| a43a487 | overhaul F7 | matriz de cobertura dos 1632 sliders |
| 60bad42 | overhaul F7 | orçamentos de pendentes, órfãos «não aplicado» |
| 01ca8d0 | overhaul F6 | VFX legado preserva o visual do Seed Bomb |
| 33ef5d5 | overhaul F8 | bateria de homologação |
| f57e3a9 | **alheio** (HUD) | HUD na cor do lutador e indicador de recarga acelerada |
| d079833 | **alheio** (docs) | brainstorm do overhaul épico da defesa |
| d7539ac | overhaul F8 | homologação F8: ai-eval documentado e ajustes |

A árvore também tem alterações não commitadas de outras sessões (VFX Composer, prejogo, editor, AGENTS.md, GAMEDEV_SKILLS). O commit da F9 não inclui nenhuma delas: só os caminhos da F9, e nos arquivos com mudanças alheias (portais, `package.json`) só o trecho da F9.
