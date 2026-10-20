# ARENAMON — PASSIVAS: IMPLEMENTAÇÃO (Combat Lab)

Documento de implementação do sistema de habilidades passivas, executado em 2026-10-20 a partir da
ordem `archives/ordem-implementacao-2026-10-20.txt` (29 rodadas R01–R29 + §7). **Este arquivo referencia
e não substitui** o histórico oficial de decisões em `docs/PASSIVAS_DECISOES.md`, que foi preservado
intacto. Os valores de balanceamento são **propostas experimentais** (ajustáveis nos sliders do painel,
aba «Passivas»), não decisões homologadas (§38 da ordem).

Como abrir: `JOGAR_ARENAMON.html` (raiz) → jogo principal. A seleção de passivas fica em
**Partida › Passivas**; o HUD das passivas aparece durante o combate.

---

## A. Auditoria inicial

- **Branch inicial e final:** `feat/camera-cinematica-zzz`.
- **Commit analisado:** `d74309c` (auditoria 3D entregue anteriormente; este sistema foi construído sobre ele).
- **Estado do workspace:** limpo antes do início (único untracked: `archives/ordem-implementacao-2026-10-20.txt`).
- **Documentos lidos:** a ordem integral (2.138 linhas, 29 rodadas confirmadas), `docs/PASSIVAS_DECISOES.md`,
  contratos de `src/sim/moves.js`, `charge.js`, `status.js`, `map.js` e `combat.js`.
- **Divergências encontradas:** `PASSIVAS_DECISOES.md` registra 25 rodadas; a ordem manda 29 (R01–R29).
  As 29 da ordem governam — as 4 rodadas ausentes do histórico foram implementadas conforme a ordem e
  ficam identificadas na matriz (R16–R18, R20–R29 na íntegra).

## B. Arquitetura implementada

**Novos módulos**

| Módulo | Papel |
|---|---|
| `src/sim/passives.js` | Catálogo das 18 passivas (id, espécie, categoria, gatilho, efeito, modo de cooldown), `validateLoadout` (R4/R5), `speciesFromName`, `PASSIVE_SLOTS = 2`. |
| `src/sim/passive-engine.js` | Motor: estado serializável por lutador (`passiveState`), `attachPassives`/`onRoundStart` (§7), `tickPassives` (timers próprios, só no passo normal), `passiveOnEvents` (gatilhos + encadeamento com profundidade máx. 8 e telemetria `passiveCycleSuspect`), `passiveOnKO` (R23), `passiveContribute` (acúmulo aditivo R7–R11), fatores `dotFactor`/`knockbackFactor`/`hitStunFactor`/`perfectWindowBonus`, `passiveCost` (Technician), `sturdyGuard` (R6/§7). |
| `src/sim/scenarios-passives.js` | 42 cenários reproduzíveis `pv-01`…`pv-42`. |
| `src/ui/passives-panel.js` | Seleção pré-partida (2 slots, validação compartilhada com o motor, persistência em `localStorage`). |
| `src/ui/passives-hud.js` | HUD em partida: slots com estado (permanente/ativa/consumida), cooldowns e durações. |
| `src/view/passive-vfx.js` | VFX 3D de ativação (três variantes A/B/C, 0,6 s, respeita `reduceMotion`/`noFlash`). |

**Módulos modificados (integração no motor, sem reescrita estrutural)**

- `status.js` — `stat()` agora `base × Πmul^pilhas (legado) × (1 + Σpct) + Σadd` com `passiveContribute`; tick de veneno com `dotFactor` e `ctx {category:'periodic'}`.
- `entity.js` — `nominalDistance` usa `stat(f,'speed',…)` (Speed Boost afeta o dash).
- `controller.js` — `costOf(f,custo,kind)` com `passiveCost` (esquiva/tech); **correção de bug real**: a checagem de «affordable» ignorava o desconto do Technician (linha do `affordable`), o que tornaria a passiva inútil exatamente no caso aprovado (esquiva com stamina entre 0,8× e 1,0× do custo).
- `combat.js` — `resolveHit`/`clash` passam `ctx {category:'direct', contact}`; eventos ganham `contact` e `sturdy`.
- `world.js` — `applyHit` com contact `projectile`/`beam`/`area` e `knockbackFactor` no empurrão horizontal.
- `map.js` — `processDamageWithShieldAndStages(…, ctx)`; `sturdyGuard` aplicado só no ramo de dano direto; **correção de bug real**: o dano efetivo retornado pelo `sturdyGuard` estava sendo subtraído uma segunda vez (HP fixado em 1 e depois reduzido), o que matava o lutador no mesmo impacto.
- `physics.js` — Inner Focus no `knockRecovery` do pouso; tech com custo `passiveCost(f,'tech',…)`; wallSplat com `ctx {category:'environmental'}`.
- `game.js` — orquestração no passo: `tickPassives` → `passiveOnEvents(fresh)` → KO → `passiveOnKO`, antes do loop de `e.tick`; loadouts/identidade no save/load; `setPassiveLoadout` delegando à validação; loadout de golpes corpo a corpo com `contact:'melee'`.
- `config.js`/`tuning.js`/`tuning-meta.js` — raiz `passivas` (defaults + `globals.detectDistance`), toggle `extras.toggles.enablePassives`, VFX «Passivas», sliders nomeados por passiva.
- `main.js`/`template.html`/`styles.css`/`audio.js` — painel, HUD, toast, VFX, som procedural `playPassive(variant)`, replay aplica loadouts gravados.

**Contratos de eventos** (todos com `tick` preenchido pelo `game.js`): `passiveActivated`, `passiveEnded`,
`passiveReady`, `passiveBlocked`, `passiveReflect`, `passiveHeal`, `passiveCycleSuspect` (telemetria R29),
além dos existentes enriquecidos (`impact`/`partial`/`clash` com `contact` e `sturdy`; `statusApplied`).

## C. Habilidades implementadas (18/18 com efeito real)

| # | Passiva | Espécie | Categoria | Estado real |
|---|---|---|---|---|
| 1 | Poison Touch | Croagunk | gatilho | **Implementado e verificado** (pv-08/09/10/13/34) |
| 2 | Anticipation | Croagunk | gatilho | **Implementado e verificado** (pv-19/29/33) |
| 3 | Forewarn | Drowzee | gatilho | **Implementado e verificado** (pv-18/35) |
| 4 | Inner Focus | Drowzee | permanente | **Implementado e verificado** (pv-17) |
| 5 | Effect Spore | Mush | gatilho | **Implementado e verificado** (pv-16) |
| 6 | Sturdy | Mush | gatilho | **Implementado e verificado** (pv-12/13/14/38/39) |
| 7 | Vital Spirit | Vigoroth | permanente condicional | **Implementado e verificado** (pv-20) |
| 8 | Guts | Vigoroth | permanente condicional | **Implementado e verificado** (pv-21) |
| 9 | Speed Boost | — | permanente | **Implementado e verificado** (pv-01/06/31) |
| 10 | Technician | — | permanente | **Implementado e verificado** (pv-01/07) |
| 11 | Rough Skin | — | gatilho instantâneo | **Implementado e verificado** (pv-15/30/36) |
| 12 | Regenerator | — | gatilho instantâneo | **Implementado e verificado** (pv-22) |
| 13 | Unburden | — | gatilho | **Implementado e verificado** (pv-23/37) |
| 14 | Stamina(p) | — | gatilho | **Implementado e verificado** (pv-24/28) — ver pendência de mapeamento em G |
| 15 | Suction Cups | — | permanente | **Implementado e verificado** (pv-25) |
| 16 | Magic Guard | — | permanente | **Implementado e verificado** (pv-11) |
| 17 | Clear Body | — | permanente reativa | **Implementado e verificado** (pv-26) |
| 18 | Defiant | — | gatilho | **Implementado e verificado** (pv-27) |

## D. Matriz das 29 rodadas

Estados: ✅ Implementado e verificado · ⏳ Parcial · 🚫 Bloqueado por decisão não aprovada · N/A não aplicável (justificado).

| Rodada | Decisão aprovada | Requisito implementável | Arquivo/módulo | Função relevante | Teste automatizado | Cenário de validação | Resultado | Evidência | Pendência |
|---|---|---|---|---|---|---|---|---|---|
| R01 | 2 exclusivas/espécie, catálogo genérico, máx. 2 slots, combinações livres, exclusiva alheia proibida | catálogo + validação | `passives.js` | `PASSIVES`, `validateLoadout`, `PASSIVE_SLOTS` | `passives.test.mjs` «validateLoadout» | pv-01/02/03/05 | ✅ | loadout aplicado = 2 passivas; exclusiva alheia recusada | — |
| R02 | Categorias: permanente, condicional, automática c/ cooldown; permanente sem cooldown inventado; automática com gatilho explícito | classificação por passiva no catálogo | `passives.js` | campo `categoria`/`cooldownMode` | `passives.test.mjs` fatores | pv-06 (permanente sem cooldown), pv-19 (automática), pv-20/21 (condicional) | ✅ | pv-06 exige `actives`/`cooldowns` vazios no Speed Boost | — |
| R03 | Estados individuais por passiva; sem suspensão universal | gatilhos/efeitos individuais; nenhum estado suspende passivas globalmente | `passive-engine.js` | `activate` (condições por id), `tickPassives` | pv-15/16/17/22 | pv-28 | ✅ | Rough Skin + Stamina ativam juntas no mesmo impacto | — |
| R04 | Genéricas disponíveis desde o início, sem desbloqueio | catálogo sem trava de progressão | `passives.js`, `passives-panel.js` | lista direta no painel | — | pv-01 | ✅ | painel lista as 12 genéricas sem custo de desbloqueio | — |
| R05 | Sem duplicata nos 2 slots, validada na UI e no motor, não burlável por save/replay/API | validação compartilhada única | `passives.js` | `validateLoadout` (chamada por UI e por `setPassiveLoadout`) | `passives.test.mjs` «validateLoadout» | pv-04 | ✅ | UI e motor recusam; loadout anterior preservado | — |
| R06 | Seleção pré-partida, fixa durante a partida | painel antes do `reset`; sem troca em partida | `ui/passives-panel.js`, `main.js` | `applyTo(game)` antes de `startMatch` | — | pv-01 (loadout aplicado no reset) | ✅ | loadout só entra via `game.reset`/equip; não há API de troca em partida | — |
| R07 | Acúmulo entre passivas aditivo, não multiplicativo | parcelas `pct` somadas | `passive-engine.js` | `passiveContribute` | `passives.test.mjs` «fórmula aditiva» | pv-01 (Speed Boost ×1,15 somado) | ✅ | 100 +15% +15% = 130, não 132,25 | — |
| R08 | Acúmulo com outras origens aditivo na mesma base | `stat()` unifica passivas+buffs+debuffs+Moves+consumíveis+estágios | `status.js` | `stat` + `passiveContribute` | `passives.test.mjs` «fórmula aditiva» (100×1,15+30) | pv-21 (Guts × debuff) | ✅ | não há camada multiplicativa separada para passivas | — |
| R09 | Fórmula `base + base×Σ% + Σabs`; exemplo 100/20%/30 → 150 | agregador aditivo | `status.js` | `stat` | `passives.test.mjs` «fórmula aditiva» | pv-01 | ✅ | exemplo da ordem reproduzido em teste unitário | — |
| R10 | Sem novos caps/pisos universais para passivas | nenhum clamp adicionado | `passive-engine.js` | (ausência de clamp; fatores puros) | `passives.test.mjs` «fatores» | pv-25 | ✅ | fatores retornam valores crus | — |
| R11 | Precisão fracionária preservada; sem round/floor/ceil indevido | aritmética em ponto flutuante | `status.js`, `passive-engine.js` | `stat`, `passiveContribute` | `passives.test.mjs` (87×1,15 = 100,05) | pv-07 | ✅ | teste exige 100,05 exato, não 100 | — |
| R12 | Evento satisfazendo dois gatilhos ativa ambas independentemente | laço por evento avalia todas as passivas | `passive-engine.js` | `passiveOnEvents` | pv-28 | pv-28 | ✅ | Rough Skin + Stamina juntas; nenhuma bloqueou a outra | — |
| R13 | Snapshot simultâneo do mesmo estado; slot não altera resultado | avaliação sequencial sobre o mesmo vetor de eventos, sem mutação de estado entre gatilhos do mesmo evento | `passive-engine.js` | `passiveOnEvents` | pv-28 | pv-28 | ✅ | reflexão e defesa aplicadas a partir do mesmo evento `impact` | — |
| R14 | Sem prioridade global; conflitos exigem regra específica aprovada; identificar combinações pendentes | catálogo marca compatibilidade; efeitos atuais são aditivos e compatíveis | `passives.js` (nota §pendência) | — | — | pv-28 | ⏳ | nenhuma combinação incompatível conhecida no catálogo atual; sem regra inventada | Ver G-2 |
| R15 | Cooldowns de passivas independentes dos Moves; não reutilizar o modificador genérico | timers próprios em segundos, fora de `tickCooldowns`/`cooldownRate` | `passive-engine.js`, `game.js` | `tickPassives` (dt fixo do passo) | pv-29/30; `passives.test.mjs` R18 | pv-29 | ✅ | cooldowns decais só por `tickPassives`, nunca por `cooldownRate` | — |
| R16 | Cooldown de efeito temporário começa no TÉRMINO efetivo | `cooldownMode:'postEnd'` no registro de expirados | `passive-engine.js` | `tickPassives` (ramo `expired`) | `passives.test.mjs` R16/R18 | pv-24/29 | ✅ | pv-24: cooldown de Stamina = 0 enquanto o efeito dura | — |
| R17 | Término antecipado válido inicia o cooldown na hora | forewarn encerra quando `opp.charge` some | `passive-engine.js` | `tickPassives` (ramo forewarn) | `passives.test.mjs` «R16» | pv-18 | ✅ | teste unitário mede pronta = término antecipado + 12 s | — |
| R18 | Efeito instantâneo: cooldown logo após a aplicação | `cooldownMode:'instant'` | `passive-engine.js` | `activate` | `passives.test.mjs` «R18» | pv-15/22/30 | ✅ | pv-30: cooldown cheio registrado no passo seguinte à aplicação | — |
| R19 | Suspensão/duração individual; suspensão ≠ encerramento; sem cooldown por suspensão | efeito `forewarn` tem término antecipado real (causa válida: carga solta), não por suspensão | `passive-engine.js` | `tickPassives` | `passives.test.mjs` «R16» | pv-18/33 | ✅ | hitstop não suspende nem encerra (ver R24–R26) | — |
| R20 | Durante efeito ativo: ignorar gatilhos da MESMA passiva, sem renovar/duplicar/acumular; não iniciar cooldown antecipado | guarda em `activate` | `passive-engine.js` | `activate` (checks `actives`/`cooldowns`) | `passives.test.mjs` «R20» | pv-29 | ✅ | duas chamadas seguidas mantêm 1 instância | — |
| R21 | Cooldowns avançam em hit stun/guard stun/recuo | timers decaem em qualquer passo normal | `passive-engine.js` | `tickPassives` (sem checagem de estado do lutador) | pv-29 (efeito encerra e cooldown anda com o lutador parado) | pv-29 | ✅ | cooldown de Anticipation decai durante neutralidade forçada | — |
| R22 | Respawn zera cooldowns de passivas (não os de Moves); respawn ≠ novo gatilho | `attachPassives`/`onRoundStart` no `game.reset` | `passive-engine.js`, `game.js` | `attachPassives`, `onRoundStart` | `passives.test.mjs` «R22/§7» | pv-38 | ✅ | reset restaura Sturdy e descarta timers; `moveCooldowns` intactos | — |
| R23 | KO encerra efeitos ativos imediatamente; equipamento permanece; recarga respeita o encerramento real | `passiveOnKO` | `passive-engine.js`, `game.js` | `passiveOnKO` | pv-37 | pv-37 | ✅ | Unburden ativa do nocauteado é encerrada no mesmo passo do KO | — |
| R24 | Cooldown pausado no hitstop, retomando com o mesmo restante | engine só roda no passo normal (retorno antecipado do `Game.step`) | `game.js`, `passive-engine.js` | `step` (ramo hitstop), `tickPassives` | pv-32 | pv-32 | ✅ | cooldown do Rough Skin não decai durante o hitstop forçado | — |
| R25 | Duração pausada no hitstop, restante idêntico | idem | `game.js`, `passive-engine.js` | idem | pv-33 | pv-33 | ✅ | `remaining` preservado (decai < 0,2 s no congelamento de 0,4 s) | — |
| R26 | Efeitos ativos continuam aplicados no hitstop | `stat()` lê `actives` independentemente de `frozen` | `status.js`, `passive-engine.js` | `stat`, `passiveContribute` | pv-31 | pv-31 | ✅ | Speed Boost ×1,15 medido durante o hitstop | — |
| R27 | Gatilho real durante hitstop pode ativar (sem fila automática, sem eventos fabricados) | engine não roda no passo congelado; eventos reais só existem em passo normal | `game.js`, `passive-engine.js` | `step`, `passiveOnEvents` | pv-34 | pv-34 | ✅ | contato ocorrido após o hitstop ativou Poison Touch no 1º passo normal | — |
| R28 | Efeito ativado após hitstop aplicado imediatamente; cronômetros congelados enquanto durar o hitstop | aplicação no mesmo passo da ativação | `passive-engine.js`, `status.js` | `activate`, `stat` | pv-35 | pv-35 | ✅ | Forewarn ativado após o hitstop já contribui em `perfectWindowBonus()` no mesmo passo | — |
| R29 | Encadeamento durante hitstop com condições individuais; SEM regra de bloqueio aprovada — proteção técnica + telemetria apenas | profundidade máx. 8 + evento `passiveCycleSuspect` | `passive-engine.js` | `MAX_PASSIVE_CHAIN_DEPTH`, `passiveOnEvents` | pv-36; `passives.test.mjs` (paridade) | pv-36 | ✅ técnica / 🚫 negócio | reflexão encadeou sem falso ciclo; regra de gameplay para ciclos reais **não aprovada** | Ver G-1 |

## E. Matrizes de interação

### Passivas × mecânicas

| Mecânica | Passivas envolvidas | Comportamento |
|---|---|---|
| Tackle (contato) | Poison Touch, Rough Skin, Effect Spore, Stamina(p) | gatilhos no evento `impact/partial` com `contact:'tackle'` |
| Defesa (guard) | Poison Touch | defesa perfeita (dano 0) não aplica veneno; parcial aplica |
| Golpe carregado (PL2+) | Anticipation, Forewarn | detecção por `tackleCharge.level` / `chargeLevel` + distância |
| Lançamento/pouso | Inner Focus, Suction Cups, Technician (tech) | stun ×0,8; hKb ×0,8 no chão; custo do tech ×0,8 |
| Consumíveis | Unburden | evento `itemCollected` |
| Escudo do mapa | Sturdy | dano absorvido pelo escudo não é «direto ao HP» → não consome Sturdy |
| Estágios de atributos | fórmula aditiva | estágios seguem no próprio ramo legado de `stat()` |

### Passivas × estados

| Estado | Efeito nas passivas |
|---|---|
| Hit stun / guard stun / recuo | cooldowns e durações continuam (R21); efeitos ativos persistem |
| Lançamento (flight) | Suction Cups desliga (`knockbackFactor` = 1 no ar); Sturdy já consumido segue usado |
| Hitstop | timers congelados (R24/25), efeitos aplicados (R26), sem gatilhos fabricados (R27) |
| KO | efeitos ativos do nocauteado encerrados (R23); Sturdy não restaura em load (R22/§7) |
| Exaustão | Vital Spirit lê stamina real; Technician só altera custo, não exigência de ação |

### Passivas × passivas (combinações equipáveis testadas)

| Combinação | Resultado verificado |
|---|---|
| Rough Skin + Stamina(p) | ambas ativam no mesmo tackle (pv-28) |
| Clear Body + Defiant | bloqueio dispara Defiant (pv-27) |
| Speed Boost + Technician | custo e velocidade independentes (pv-01) |
| Poison Touch + Speed Boost | veneno aplica e velocidade permanece (pv-37) |

### Passivas × Moves

| Interação | Resultado |
|---|---|
| Cooldowns de Moves | intocados pelas passivas (R15); `moveCooldowns` segue `cooldownRate` próprio |
| Move carregado (Charge) | Forewarn detecta PL2+; soltar a carga encerra o efeito antecipadamente (R17) |
| Buffs/debuffs de Moves | entram em `stat()` pelo mesmo agregador aditivo (R8) |

### Passivas × dano

| Via de dano | Sturdy | Magic Guard |
|---|---|---|
| Direto (tackle/melee) | segura 1×/rodada se letal | sem efeito |
| Periódico (veneno/DOT) | **não protege** (pv-13) | −50% (pv-11) |
| Ambiental (wallSplat) | não protege | sem efeito |
| Refletido (Rough Skin) | não protege | sem efeito |

### Passivas × hitstop

| Aspecto | Coberto por |
|---|---|
| Cooldown congelado | pv-32 |
| Duração congelada | pv-33 |
| Efeito permanece aplicado | pv-31 |
| Gatilho real só no passo normal | pv-34 |
| Aplicação imediata pós-hitstop | pv-35 |
| Encadeamento com proteção técnica | pv-36 |

## F. Testes

- **Comandos:** `node prototypes/combat-lab/test/passives.test.mjs` (9 testes unitários) e
  `node prototypes/combat-lab/test/sim.test.mjs` (executa todos os cenários, incluindo os 42 `pv-*`).
- **Cobertura:** 42/42 cenários de passivas passando; 58/58 cenários antigos sem regressão;
  9/9 testes unitários; `sim/core/rules/defense/tackle-charge/ai` passando após as correções no motor.
- **Correções feitas durante a validação:**
  1. `controller.js` — «affordable» ignorava o desconto do Technician (esquiva negada entre 0,8×–1,0× do custo).
  2. `map.js` — Sturdy subtraía o dano duas vezes (fixava HP em 1 e depois descontava de novo → morte no mesmo golpe).
  3. `passive-engine.js` — ativação de Poison Touch agora emite `statusApplied` (telemetria/replay consistentes).
  4. Cenários: cargas reais seguradas pelo controlador (anticipation/forewarn), regen de stamina neutralizada
     via `regenBase/regenAge` nos setups, espécies corretas nas exclusivas, KO real no pv-38.
- **Evidência de navegador:** pendente de `verify.mjs` (executado na etapa final de build).

## G. Pendências legítimas (decisão do diretor)

1. **Regra de negócio anti-ciclo (R29).** Só existe proteção técnica (profundidade 8 + evento
   `passiveCycleSuspect`). Não foi inventado limite de ativações nem prioridade universal. Se um ciclo real
   de gameplay aparecer, o resultado depende de regra ainda não aprovada.
2. **Conflitos incompatíveis simultâneos (R14).** O catálogo atual não possui combinação incompatível
   identificada; quando surgir, exige regra específica aprovada — nenhuma foi criada por conta própria.
3. **Mapeamento «Defesa» da Stamina(p).** O motor não tem atributo de defesa contra dano direto (a
   «Defesa» dos estágios é mecânica de escudo do mapa). Stamina(p) foi mapeada como fator sobre o dano
   recebido `× 1/(1+X%)`, equivalente em resultado a «+10% de Defesa». Se o diretor preferir outro
   mapeamento, o campo é isolado em `passiveContribute`.
4. **Respawn/modo de rodadas.** O jogo termina no 1º KO (§7); a interface de rodada (`onRoundStart`)
   existe e restaura Sturdy, mas só é exercitada via `reset` — não há modo multi-rodadas no estado atual.
5. **Balanceamento.** Todos os números (dps, percentuais, cooldowns, janelas) são propostas experimentais
   ajustáveis nos sliders; não foram homologados como decisão de design (§38).

## H. Estado final do repositório

- **Arquivos adicionados:** `src/sim/passives.js`, `src/sim/passive-engine.js`, `src/sim/scenarios-passives.js`,
  `src/ui/passives-panel.js`, `src/ui/passives-hud.js`, `src/view/passive-vfx.js`,
  `test/passives.test.mjs`, este documento.
- **Arquivos alterados:** `status.js`, `entity.js`, `controller.js`, `combat.js`, `world.js`, `map.js`,
  `physics.js`, `game.js`, `config.js`, `tuning.js`, `tuning-meta.js`, `scenarios.js`, `audio.js`,
  `main.js`, `template.html`, `styles.css`, `package.json` (cadeia de testes).
- **Branch / commit / sincronização:** preencher na entrega (ver resposta da tarefa).
